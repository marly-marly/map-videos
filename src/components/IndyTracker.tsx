/**
 * IndyTracker — Indiana Jones style map tracking composition.
 *
 * The camera closely follows the moving dot as it traces the route,
 * panning the map dynamically to keep the dot near the center.
 */
import React, { useMemo, useEffect, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import {
  coordsToPixels,
  mapProviderEnum,
  mapProviderOptionalEnum,
  blendModeEnum,
} from "../lib/tile-viewport";
import {
  bearing,
  computePathMetrics,
  elevationGainAtDraw,
  findCoordsAtDistance,
  glowPulseOpacity,
  offsetPoint,
  pointAtDrawFraction,
  polylineToPath,
  scaledDistanceAtDraw,
} from "../lib/route-geometry";
import { computeCenteredViewport } from "../lib/centered-viewport";
import { seededRandom } from "../lib/seeded-random";
import { useGpxSegment } from "../hooks/useGpxSegment";
import { TileMapBackground } from "./TileMapBackground";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

// Props are grouped into nested z.object()s so Remotion Studio renders them
// as collapsible sections. The React component destructures each group into
// the same names used previously, so the body doesn't need to change.

const routeGroup = z.object({
  gpxFile: z.string().describe("GPX filename in public/ folder"),
  startKm: z.number().min(0).describe("Start km (0 = route start)"),
  endKm: z.number().min(0).describe("End km (9999 = full route)"),
  durationSeconds: z.number().min(1).max(300).describe("Video duration in seconds"),
  holdAtEnd: z.number().min(0).max(50).describe("% of duration to freeze at the end after drawing finishes (line, dot, photos all hold)"),
});

const mapGroup = z.object({
  provider: mapProviderEnum.describe("Start tile provider"),
  provider2: mapProviderOptionalEnum.describe("Optional overlay on top of provider ('none' = no overlay)"),
  provider2BlendMode: blendModeEnum.describe("Blend mode for provider2 over provider"),
  providerEnd: mapProviderEnum.describe("End tile provider (same = no transition)"),
  providerEnd2: mapProviderOptionalEnum.describe("Optional overlay on top of providerEnd ('none' = no overlay)"),
  providerEnd2BlendMode: blendModeEnum.describe("Blend mode for providerEnd2 over providerEnd"),
  tileTransitionStart: z.number().min(0).max(100).describe("Tile crossfade begins at % of duration"),
  tileTransitionEnd: z.number().min(0).max(100).describe("Tile crossfade ends at % of duration"),
  zoom: z.number().min(10).max(19).describe("Tile zoom (higher = more detail)"),
});

const cameraGroup = z.object({
  cameraZoom: z.number().min(10).max(500).describe("Camera closeness to dot (100=default, 200=2x tighter, 50=wider)"),
  cameraTracking: z.enum(["follow", "cinematic"]).describe("follow = smooth tracking, cinematic = pre-calculated smooth path ignoring zigzags"),
  lookAhead: z.number().min(-200).max(200).describe("Camera offset (positive=ahead, negative=behind dot)"),
});

const lineGroup = z.object({
  routeColor: z.string().describe("Route line color"),
  routeWidth: z.number().min(1).max(50).describe("Route line width"),
  dotSize: z.number().min(0).max(200).describe("Dot size (0=hidden, 100=default)"),
  dotPulseSpeed: z.number().min(0).max(500).describe("Dot pulse speed (0=static, 100=default)"),
  routeGlow: z.number().min(0).max(200).describe("Route glow (0=off, 100=default)"),
  routeCasing: z.number().min(0).max(200).describe("Dark outline (0=off, 100=default)"),
  routeShadow: z.number().min(0).max(200).describe("Soft shadow (0=off, 100=default)"),
  smoothRoute: z.number().min(0).max(100).describe("Round corners on route (0=sharp, 50=default, 100=very smooth)"),
});

const photosGroup = z.object({
  photos: z.string().describe("Comma-separated photo filenames"),
  photosFolder: z.string().describe("Subfolder in public/ for photos"),
  photoPositions: z.string().describe("Comma-separated km values where photos appear (e.g. 2.5,4.0,6.3)"),
  photoStyle: z.enum(["scattered", "neat", "on-route", "backdrop"]).describe("scattered/neat/on-route = pinned thumbnails, backdrop = full-screen photo behind the map"),
  photoSize: z.number().min(1).max(50).describe("Photo size (% of viewport width) — pinned styles only"),
  photoTilt: z.number().min(0).max(30).describe("Random tilt on photos (0=straight, 8=default scattered, 30=wild)"),
  photoReveal: z.enum(["fade", "drop", "instant"]).describe("How photos appear when line reaches them"),
  photoRevealSpeed: z.number().min(10).max(500).describe("Reveal animation speed (100=default, 50=slower, 200=faster)"),
  photoSeed: z.number().min(0).max(9999).describe("Random seed for scattered placement"),
  // Backdrop-only controls
  photoBlendMode: blendModeEnum.describe("How the map blends over the backdrop photo (backdrop style only)"),
  photoBackdropOpacity: z.number().min(0).max(100).describe("Backdrop photo intensity (100=full, 0=hidden)"),
  photoMovement: z
    .enum([
      "none",
      "ken-burns",
      "zoom-in",
      "zoom-out",
      "pan-left",
      "pan-right",
      "pan-up",
      "pan-down",
    ])
    .describe("Cinematic movement for backdrop photos: zoomed in first so pans never show black edges"),
  photoZoomAmount: z.string().describe("Comma-separated zoom amount per photo for all movements (% — 100=default, 0=static, 500=dramatic, negative=reverse direction). Pans get proportional zoom baseline + travel. Single value applies to all; last value repeats for unspecified photos."),
  photoTransition: z
    .enum([
      "crossfade",
      "cut",
      "dip-to-black",
      "slide-left",
      "slide-up",
      "wipe",
      "zoom",
    ])
    .describe("How backdrop photos hand off to the next one (backdrop style only)"),
});

const hudGroup = z.object({
  distanceScale: z.number().min(50).max(200).describe("Scale km counter to match Strava (100=as-is, 112=for route.gpx)"),
  showDistance: z.boolean().describe("Show distance counter"),
  showElevation: z.boolean().describe("Show elevation counter"),
  distanceLabel: z.string().describe("Distance label (empty = ↔)"),
  elevationLabel: z.string().describe("Elevation label (empty = ↑)"),
});

export const indyTrackerSchema = z.object({
  route: routeGroup.describe("Which GPX slice and for how long"),
  map: mapGroup.describe("Tile providers + optional era crossfade"),
  camera: cameraGroup.describe("How the camera follows the runner"),
  line: lineGroup.describe("Route line and runner dot styling"),
  photos: photosGroup.describe("Pinned thumbnails or backdrop photos"),
  hud: hudGroup.describe("On-screen labels"),
});

export type IndyTrackerProps = z.infer<typeof indyTrackerSchema>;

/**
 * Dynamic duration from props.
 *
 * Annotated with Remotion's own `CalculateMetadataFunction` at the concrete
 * props type. Do NOT go back to scraping the signature via
 * `Parameters<typeof Composition>[0]["calculateMetadata"]` — applying
 * `Parameters<>` to a generic function erases its type parameters to their
 * constraints, so the props collapse to `Record<string, unknown>` and the
 * return type then fails to match at the call site in Root.tsx.
 */
export const calculateIndyTrackerMetadata: CalculateMetadataFunction<
  IndyTrackerProps
> = ({ props }) => ({
  durationInFrames: Math.round(props.route.durationSeconds * 30),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PhotoPlacement {
  filename: string;
  km: number;
  geoPosition: [number, number]; // geographic position for rendering
  rotation: number; // degrees
  safeRevealKm: number; // km the dot must have passed before photo can show
}

/**
 * Per-layer style for one side of a backdrop photo transition.
 * `role` is "from" (outgoing) or "to" (incoming). `progress` is 0→1 across
 * the transition window. Transforms compose on a wrapper div so the inner
 * <Img>'s Ken-Burns movement keeps working independently.
 */
type TransitionLayerStyle = {
  opacity: number;
  transform: string;
  clipPath?: string;
  hidden?: boolean;
};

// Identity color for each CSS blend mode — i.e. the color that, when placed
// beneath the map, produces a result indistinguishable from the un-blended map.
// Used as the "pre-photo" baseline so the map doesn't blend into the dark
// AbsoluteFill background before the first backdrop photo arrives. HSL-based
// modes (hue/saturation/color/luminosity) have no clean identity colour — we
// pick mid-grey, which is a reasonable visual approximation.
const BLEND_NEUTRAL: Record<string, string> = {
  normal: "transparent",
  multiply: "#ffffff",
  screen: "#000000",
  overlay: "#808080",
  darken: "#ffffff",
  lighten: "#000000",
  "color-dodge": "#000000",
  "color-burn": "#ffffff",
  "hard-light": "#808080",
  "soft-light": "#808080",
  difference: "#000000",
  exclusion: "#000000",
  hue: "#808080",
  saturation: "#808080",
  color: "#808080",
  luminosity: "#808080",
};

function getTransitionStyle(
  mode:
    | "crossfade"
    | "cut"
    | "dip-to-black"
    | "slide-left"
    | "slide-up"
    | "wipe"
    | "zoom",
  role: "from" | "to",
  progress: number,
): TransitionLayerStyle {
  const p = Math.max(0, Math.min(1, progress));
  switch (mode) {
    case "cut":
      // No window — renderer never calls us mid-transition, just pass through.
      return role === "from"
        ? { opacity: 0, transform: "none", hidden: true }
        : { opacity: 1, transform: "none" };
    case "crossfade":
      return role === "from"
        ? { opacity: 1 - p, transform: "none" }
        : { opacity: p, transform: "none" };
    case "dip-to-black":
      // Photo fades out in first half, next fades in second half.
      // A full-screen black overlay (rendered separately) peaks at p=0.5
      // to cover map + route too.
      return role === "from"
        ? { opacity: Math.max(0, 1 - 2 * p), transform: "none" }
        : { opacity: Math.max(0, 2 * p - 1), transform: "none" };
    case "slide-left":
      // New photo slides in from the right; old slides out to the left.
      return role === "from"
        ? { opacity: 1, transform: `translateX(${-100 * p}%)` }
        : { opacity: 1, transform: `translateX(${100 * (1 - p)}%)` };
    case "slide-up":
      return role === "from"
        ? { opacity: 1, transform: `translateY(${-100 * p}%)` }
        : { opacity: 1, transform: `translateY(${100 * (1 - p)}%)` };
    case "wipe":
      // New photo wipes in from left to right via clip-path inset.
      return role === "from"
        ? { opacity: 1, transform: "none" }
        : {
            opacity: 1,
            transform: "none",
            clipPath: `inset(0 ${100 * (1 - p)}% 0 0)`,
          };
    case "zoom":
      // Old zooms forward and fades; new comes in from smaller scale.
      return role === "from"
        ? { opacity: 1 - p, transform: `scale(${1 + 0.3 * p})` }
        : { opacity: p, transform: `scale(${0.85 + 0.15 * p})` };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const IndyTracker: React.FC<IndyTrackerProps> = (props) => {
  // Unpack grouped props back into flat locals. Keeping the old names means
  // the rest of the component body is untouched by the schema refactor.
  const { gpxFile, startKm, endKm, holdAtEnd } = props.route;
  const {
    provider,
    provider2,
    provider2BlendMode,
    providerEnd,
    providerEnd2,
    providerEnd2BlendMode,
    tileTransitionStart,
    tileTransitionEnd,
    zoom,
  } = props.map;
  const { cameraZoom, cameraTracking, lookAhead } = props.camera;
  const {
    routeColor,
    routeWidth,
    dotSize,
    dotPulseSpeed,
    routeGlow,
    routeCasing,
    routeShadow,
    smoothRoute,
  } = props.line;
  const {
    photos,
    photosFolder,
    photoPositions,
    photoStyle,
    photoSize,
    photoTilt,
    photoReveal,
    photoRevealSpeed,
    photoSeed,
    photoBlendMode,
    photoBackdropOpacity,
    photoMovement,
    photoZoomAmount,
    photoTransition,
  } = props.photos;
  const {
    distanceScale,
    showDistance,
    showElevation,
    distanceLabel,
    elevationLabel,
  } = props.hud;
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();

  // Load GPX, process the route, and slice out startKm→endKm. The hook owns
  // the delayRender handshake so no frame is captured until the fetch resolves.
  const { gpxData, segment } = useGpxSegment(gpxFile, startKm, endKm);

  // Preload all photos so they're ready before any frame is captured
  const photoFiles = useMemo(() => {
    if (!photos) return [];
    return photos.split(",").map((s) => s.trim()).filter(Boolean);
  }, [photos]);

  // Per-photo zoom amount (%) — accepts a comma-separated list. Last value
  // repeats for unspecified photos so a single number still works as a
  // global default. Negative values flip the zoom direction (ken-burns and
  // zoom-in then zoom OUT, starting from a zoomed-in framing).
  const photoZoomAmounts = useMemo(() => {
    const parsed = (photoZoomAmount || "")
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));
    return parsed.length > 0 ? parsed : [100];
  }, [photoZoomAmount]);

  const [photoHandle] = useState(() =>
    photoFiles.length > 0
      ? delayRender("Loading photos", { timeoutInMilliseconds: 30000 })
      : null
  );

  useEffect(() => {
    if (!photoHandle || photoFiles.length === 0) return;
    let loaded = 0;
    const total = photoFiles.length;
    const done = () => {
      loaded++;
      if (loaded >= total && photoHandle) {
        continueRender(photoHandle);
      }
    };
    photoFiles.forEach((filename) => {
      const img = new Image();
      img.onload = done;
      img.onerror = done;
      img.src = staticFile(photosFolder ? `${photosFolder}/${filename}` : filename);
    });
  }, [photoFiles, photosFolder, photoHandle]);

  // Animation progress
  const progress = frame / durationInFrames;
  // drawEnd = fraction of duration where the line/dot/photos finish moving.
  // The remaining (holdAtEnd %) freezes the scene on the final frame state.
  const drawEnd = Math.max(0.01, 1 - holdAtEnd / 100);
  const easedDraw = Math.min(1, Math.max(0, progress / drawEnd));

  const segmentLengthKm = segment?.segmentLengthKm ?? 0;
  // Read distance from the actual segmentDistances array (which has ferry gaps)
  // instead of linear interpolation, so the counter freezes during ferry crossings.
  const currentDistanceKm = useMemo(() => {
    if (!segment) return startKm;
    return scaledDistanceAtDraw(
      segment.segmentDistances,
      startKm,
      easedDraw,
      distanceScale
    );
  }, [segment, startKm, easedDraw, distanceScale]);

  // Current geographic position (raw dot position)
  const currentGeo = useMemo(() => {
    if (!segment) return null;
    return findCoordsAtDistance(
      segment.coords,
      segment.segmentDistances,
      segmentLengthKm * easedDraw
    );
  }, [segment, segmentLengthKm, easedDraw]);

  // Pre-compute a cinematic camera path by heavily simplifying the route.
  // Simplification tolerance scales with cameraZoom: tighter zoom = less
  // simplification (small zigzags still matter), wider zoom = smooth over more.
  const cinematicPath = useMemo(() => {
    if (!segment || cameraTracking !== "cinematic") return null;

    // Tolerance in degrees: at cameraZoom 100, ~0.01° ≈ 1km.
    // At cameraZoom 200 (tighter), ~0.005° ≈ 500m.
    // At cameraZoom 50 (wider), ~0.02° ≈ 2km.
    // This is intentionally aggressive — we want to flatten out V-shapes and zigzags.
    const baseTolerance = 0.01;
    const tolerance = baseTolerance / (cameraZoom / 100);

    // Douglas-Peucker simplification on the coordinates
    const coords = segment.coords;
    const simplified: [number, number][] = [coords[0]];
    const stack: [number, number][] = [[0, coords.length - 1]];

    while (stack.length > 0) {
      const [start, end] = stack.pop()!;
      let maxDist = 0;
      let maxIdx = start;

      // Find point farthest from the line start→end
      const [sx, sy] = coords[start];
      const [ex, ey] = coords[end];
      const dx = ex - sx;
      const dy = ey - sy;
      const lenSq = dx * dx + dy * dy;

      for (let i = start + 1; i < end; i++) {
        const [px, py] = coords[i];
        let dist: number;
        if (lenSq === 0) {
          dist = Math.sqrt((px - sx) * (px - sx) + (py - sy) * (py - sy));
        } else {
          const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / lenSq));
          const projX = sx + t * dx;
          const projY = sy + t * dy;
          dist = Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
        }
        if (dist > maxDist) {
          maxDist = dist;
          maxIdx = i;
        }
      }

      if (maxDist > tolerance) {
        stack.push([start, maxIdx]);
        stack.push([maxIdx, end]);
      }
    }

    // Collect simplified indices and sort
    const keepSet = new Set<number>([0, coords.length - 1]);
    // Re-run to collect kept indices properly
    const indices: number[] = [];
    function simplify(start: number, end: number) {
      if (end - start <= 1) return;
      const [sx, sy] = coords[start];
      const [ex, ey] = coords[end];
      const ddx = ex - sx;
      const ddy = ey - sy;
      const lSq = ddx * ddx + ddy * ddy;
      let mDist = 0;
      let mIdx = start;
      for (let i = start + 1; i < end; i++) {
        const [px, py] = coords[i];
        let d: number;
        if (lSq === 0) d = Math.sqrt((px - sx) * (px - sx) + (py - sy) * (py - sy));
        else {
          const t = Math.max(0, Math.min(1, ((px - sx) * ddx + (py - sy) * ddy) / lSq));
          const ex = px - sx - t * ddx;
          const ey = py - sy - t * ddy;
          d = Math.sqrt(ex * ex + ey * ey);
        }
        if (d > mDist) { mDist = d; mIdx = i; }
      }
      if (mDist > tolerance) {
        keepSet.add(mIdx);
        simplify(start, mIdx);
        simplify(mIdx, end);
      }
    }
    simplify(0, coords.length - 1);

    const sortedIndices = Array.from(keepSet).sort((a, b) => a - b);
    const simplifiedCoords = sortedIndices.map((i) => coords[i]);
    const simplifiedDists = sortedIndices.map((i) => segment.segmentDistances[i]);

    return { coords: simplifiedCoords, distances: simplifiedDists };
  }, [segment, cameraTracking, cameraZoom]);

  // Camera position: depends on tracking mode
  const smoothedCameraGeo = useMemo(() => {
    if (!segment || !currentGeo) return currentGeo;

    // lookAhead as fraction of segment length: ±200 maps to ±20% of segment
    const offsetKm = (lookAhead / 100) * segmentLengthKm * 0.1;
    const cameraDraw = Math.max(0, Math.min(1, easedDraw + offsetKm / segmentLengthKm));
    const cameraKm = segmentLengthKm * cameraDraw;

    if (cameraTracking === "cinematic" && cinematicPath) {
      // Interpolate along the simplified cinematic path
      const pos = findCoordsAtDistance(
        cinematicPath.coords,
        cinematicPath.distances,
        cameraKm
      );

      // Generous smoothing on top of the simplified path to prevent any kinks
      const windowKm = segmentLengthKm * 0.08;
      const numSamples = 15;
      let sumLng = 0, sumLat = 0, totalWeight = 0;
      for (let i = 0; i < numSamples; i++) {
        const t = i / (numSamples - 1);
        const sKm = Math.max(0, Math.min(segmentLengthKm, cameraKm - windowKm + windowKm * 2 * t));
        const sPos = findCoordsAtDistance(cinematicPath.coords, cinematicPath.distances, sKm);
        const d = (t - 0.5) * 2;
        const w = Math.exp(-(d * d) * 2);
        sumLng += sPos[0] * w;
        sumLat += sPos[1] * w;
        totalWeight += w;
      }
      return [sumLng / totalWeight, sumLat / totalWeight] as [number, number];
    }

    // "follow" mode: average over a small window of the original route
    const numSamples = 15;
    const windowFraction = 0.04;

    let sumLng = 0;
    let sumLat = 0;
    let totalWeight = 0;

    for (let i = 0; i < numSamples; i++) {
      const t = i / (numSamples - 1);
      const sampleDraw = cameraDraw - windowFraction + windowFraction * 2 * t;
      const clampedDraw = Math.max(0, Math.min(1, sampleDraw));
      const sampleKm = segmentLengthKm * clampedDraw;
      const pos = findCoordsAtDistance(segment.coords, segment.segmentDistances, sampleKm);

      const distFromCenter = Math.abs(t - 0.5) * 2;
      const weight = Math.exp(-distFromCenter * distFromCenter * 2);
      sumLng += pos[0] * weight;
      sumLat += pos[1] * weight;
      totalWeight += weight;
    }

    return [sumLng / totalWeight, sumLat / totalWeight] as [number, number];
  }, [segment, currentGeo, segmentLengthKm, easedDraw, lookAhead, cameraTracking, cinematicPath]);

  // Dynamic viewport centered on the smoothed camera position
  const viewport = useMemo(() => {
    if (!smoothedCameraGeo) return null;
    return computeCenteredViewport(smoothedCameraGeo[0], smoothedCameraGeo[1], zoom, provider, cameraZoom / 100);
  }, [smoothedCameraGeo, zoom, provider, cameraZoom]);

  // Second viewport for tile transition (only when providers differ)
  const hasTileTransition = providerEnd !== provider;
  const viewportEnd = useMemo(() => {
    if (!smoothedCameraGeo || !hasTileTransition) return null;
    return computeCenteredViewport(smoothedCameraGeo[0], smoothedCameraGeo[1], zoom, providerEnd, cameraZoom / 100);
  }, [smoothedCameraGeo, zoom, providerEnd, cameraZoom, hasTileTransition]);

  // Secondary / overlay viewports for each era. Only computed when the
  // corresponding providerX2 is not "none". Each gets its own viewport so
  // per-provider tile caps (TILE_MAX_ZOOM) are respected independently.
  const hasProvider2 = provider2 !== "none";
  const viewport2 = useMemo(() => {
    if (!smoothedCameraGeo || !hasProvider2) return null;
    return computeCenteredViewport(smoothedCameraGeo[0], smoothedCameraGeo[1], zoom, provider2, cameraZoom / 100);
  }, [smoothedCameraGeo, zoom, provider2, cameraZoom, hasProvider2]);

  const hasProviderEnd2 = providerEnd2 !== "none";
  const viewportEnd2 = useMemo(() => {
    if (!smoothedCameraGeo || !hasTileTransition || !hasProviderEnd2) return null;
    return computeCenteredViewport(smoothedCameraGeo[0], smoothedCameraGeo[1], zoom, providerEnd2, cameraZoom / 100);
  }, [smoothedCameraGeo, zoom, providerEnd2, cameraZoom, hasTileTransition, hasProviderEnd2]);

  // Convert ALL segment coords to pixels in the dynamic viewport
  const segmentPoints = useMemo(() => {
    if (!segment || !viewport) return [];
    return coordsToPixels(segment.coords, viewport);
  }, [segment, viewport]);

  // SVG path — optionally smoothed with Catmull-Rom → cubic bezier conversion
  const svgPath = useMemo(() => {
    if (segmentPoints.length < 2) return "";

    if (smoothRoute <= 0) {
      // Sharp path
      return polylineToPath(segmentPoints);
    }

    // Catmull-Rom spline → cubic bezier curves
    // tension controls how much the curve cuts corners (0 = straight, 1 = max smooth)
    const tension = smoothRoute / 100;
    const pts = segmentPoints;
    let d = `M ${pts[0].x} ${pts[0].y}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[Math.min(pts.length - 1, i + 1)];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      // Catmull-Rom to cubic bezier control points
      const cp1x = p1.x + (p2.x - p0.x) * tension / 6;
      const cp1y = p1.y + (p2.y - p0.y) * tension / 6;
      const cp2x = p2.x - (p3.x - p1.x) * tension / 6;
      const cp2y = p2.y - (p3.y - p1.y) * tension / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    return d;
  }, [segmentPoints, smoothRoute]);

  // Path measurement — computed synchronously from segmentPoints so the dot
  // never lags a frame behind the line (see computePathMetrics for why).
  const pathMetrics = useMemo(
    () => computePathMetrics(segmentPoints),
    [segmentPoints]
  );

  const pathLength = pathMetrics.totalLength;
  const dashOffset = pathLength > 0 ? pathLength * (1 - easedDraw) : pathLength;

  // Runner dot position — binary-search the polyline to the drawn distance.
  // Note this measures polyline length, not bezier arc length, which is what
  // keeps the dot on the visible line even when smoothRoute > 0.
  const currentPoint = useMemo(
    () => pointAtDrawFraction(segmentPoints, pathMetrics, easedDraw),
    [segmentPoints, easedDraw, pathMetrics]
  );

  // Elevation gain
  const cumulativeElevGain = useMemo(() => {
    if (!segment) return 0;
    return elevationGainAtDraw(
      segment.segmentDistances,
      segment.segmentElevations,
      segmentLengthKm * easedDraw,
      segment.segmentStartElevGain
    );
  }, [easedDraw, segment, segmentLengthKm]);

  // Pulse
  const glowPulse = glowPulseOpacity(dotPulseSpeed, frame, fps);

  // Photo placements — precompute geographic positions offset from route
  const photoList = useMemo(() => {
    if (!photos || !photoPositions || !segment) return [];
    const filenames = photos.split(",").map((s) => s.trim()).filter(Boolean);
    const positions = photoPositions.split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
    const rng = seededRandom(photoSeed);

    // Compute offset distance in km based on viewport size
    const viewKm = 4.0 / (cameraZoom / 100);
    const offsetKm = viewKm * (photoSize / 100) * 0.8;

    // For on-route: compute how much km the photo covers on the route.
    // We need the dot to be this far past the photo center before revealing.
    // The photo spans ~photoSize% of viewport, which is photoSize% of viewKm.
    const photoCoverageKm = viewKm * (photoSize / 100) * 0.7;

    const placements: PhotoPlacement[] = [];
    for (let i = 0; i < Math.min(filenames.length, positions.length); i++) {
      const km = positions[i];
      if (km > segment.segmentLengthKm) continue;

      const pos = findCoordsAtDistance(segment.coords, segment.segmentDistances, km);
      const nearbyKm = Math.min(segment.segmentLengthKm, km + 0.1);
      const posAhead = findCoordsAtDistance(segment.coords, segment.segmentDistances, nearbyKm);
      const routeBearing = bearing(pos, posAhead);

      let geoPosition: [number, number];
      let rotation: number;
      let safeRevealKm: number;

      if (photoStyle === "on-route") {
        // Place directly on the route — no perpendicular offset
        geoPosition = pos;
        rotation = photoTilt > 0 ? (rng() - 0.5) * photoTilt * 2 : 0;
        // Safe to reveal when dot is past the photo's coverage area.
        // Check if the route comes back near this point (switchbacks/corners).
        // Walk forward along the route from km until the route is consistently
        // far enough from this point.
        let safeKm = km + photoCoverageKm;
        for (let checkKm = km + 0.1; checkKm < Math.min(segment.segmentLengthKm, km + photoCoverageKm * 3); checkKm += 0.1) {
          const checkPos = findCoordsAtDistance(segment.coords, segment.segmentDistances, checkKm);
          const distLng = (checkPos[0] - pos[0]) * 111 * Math.cos((pos[1] * Math.PI) / 180);
          const distLat = (checkPos[1] - pos[1]) * 111;
          const distKm = Math.sqrt(distLng * distLng + distLat * distLat);
          if (distKm < photoCoverageKm * 0.6) {
            // Route comes back near this point — delay reveal further
            safeKm = Math.max(safeKm, checkKm + photoCoverageKm);
          }
        }
        safeRevealKm = safeKm;
      } else {
        // Scattered or neat: offset perpendicular to route
        const side = i % 2 === 0 ? 90 : -90;
        let perpBearing = routeBearing + side;

        rotation = photoTilt > 0 ? (rng() - 0.5) * photoTilt * 2 : 0;
        const jitterBearing = photoStyle === "scattered" ? (rng() - 0.5) * 30 : 0;
        perpBearing += jitterBearing;

        geoPosition = offsetPoint(pos, perpBearing, offsetKm);
        safeRevealKm = km; // no delay needed for offset photos
      }

      placements.push({ filename: filenames[i], km, geoPosition, rotation, safeRevealKm });
    }
    return placements;
  }, [photos, photosFolder, photoPositions, photoStyle, photoSize, photoSeed, segment, cameraZoom]);

  // Convert photo positions to pixels in current viewport
  const photoPixels = useMemo(() => {
    if (!viewport || photoList.length === 0) return [];
    const geoCoords = photoList.map((p) => p.geoPosition);
    return coordsToPixels(geoCoords, viewport);
  }, [viewport, photoList]);

  // Backdrop photos — sorted by km so we can crossfade from one to the next
  // as the dot crosses trigger points. Used only when photoStyle === "backdrop".
  const backdropPhotos = useMemo(() => {
    if (photoStyle !== "backdrop") return [];
    return [...photoList].sort((a, b) => a.km - b.km);
  }, [photoList, photoStyle]);

  // Loading state
  if (!viewport || !segment) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "white", fontSize: 48, fontFamily: "'Courier New', monospace" }}>
          {!gpxData ? `Loading ${gpxFile}...` : "Processing route..."}
        </div>
      </AbsoluteFill>
    );
  }

  const ds = dotSize / 100;

  // Backdrop transition state.
  //
  // Instead of treating each photo independently, we resolve the "from" and
  // "to" photos involved in any currently-happening transition, plus the
  // progress (0 = from is whole, 1 = to is whole). Cut has no transition
  // window; everything else uses backdropFadeWindow. Downstream code picks
  // per-transition styling (opacity/transform/clipPath).
  const backdropFadeWindow =
    (segmentLengthKm * 0.03) / (photoRevealSpeed / 100);
  const currentKmForBackdrop = segmentLengthKm * easedDraw;

  let backdropActiveIndex = -1;
  for (let i = 0; i < backdropPhotos.length; i++) {
    if (backdropPhotos[i].km <= currentKmForBackdrop) backdropActiveIndex = i;
    else break;
  }
  const transitionWindow = photoTransition === "cut" ? 0 : backdropFadeWindow;
  let transitionFrom = backdropActiveIndex;
  let transitionTo = -1;
  let transitionProgress = 0;
  if (backdropActiveIndex > 0 && transitionWindow > 0) {
    const activeKm = backdropPhotos[backdropActiveIndex].km;
    if (currentKmForBackdrop < activeKm + transitionWindow) {
      transitionFrom = backdropActiveIndex - 1;
      transitionTo = backdropActiveIndex;
      transitionProgress =
        (currentKmForBackdrop - activeKm) / transitionWindow;
    }
  }

  const isBackdrop = photoStyle === "backdrop";
  const mapBlendMode = isBackdrop ? photoBlendMode : "normal";

  // Pre-photo blend ramp.
  //
  // If the first backdrop photo isn't at km=0, we don't want photoBlendMode
  // applied to the map from frame 0 — the map would blend with the empty
  // dark AbsoluteFill background and look wrong. Instead, we ramp the blend
  // in over `backdropFadeWindow` km leading up to the first photo's km, with
  // a pure-colour "neutral" layer (the blend mode's identity colour) sitting
  // beneath the map until the photo crossfades in over it.
  //
  // blendActivation: 0 = no blend (neutral fill visible), 1 = full blend
  // (photo visible). Stays at 1 once we've passed the first photo's km, and
  // also when there's no first-photo offset to worry about.
  const firstPhotoKm = backdropPhotos[0]?.km ?? 0;
  const blendRampStart = Math.max(0, firstPhotoKm - backdropFadeWindow);
  const blendActivation =
    !isBackdrop || backdropPhotos.length === 0 || firstPhotoKm <= 0
      ? 1
      : Math.max(
          0,
          Math.min(
            1,
            (currentKmForBackdrop - blendRampStart) /
              Math.max(1e-6, firstPhotoKm - blendRampStart),
          ),
        );

  // We're showing photo[0] in the soft-fade "approach" mode whenever the dot
  // hasn't yet reached its trigger km. This intentionally starts at frame 0
  // (not at blendRampStart) so the <Img> mounts and decodes early — keeping
  // it mounted with opacity = blendActivation (which is 0 before the ramp
  // begins) avoids the mid-playback stall that delayRender would otherwise
  // trigger when a fresh <Img> mounts halfway through the segment.
  const inApproachWindow =
    isBackdrop &&
    backdropPhotos.length > 0 &&
    backdropActiveIndex < 0;

  // Cinematic movement for backdrop photos.
  //
  // All pan variants baseline the image at scale 1.15 so there's ~7% overflow
  // on each axis; the ±4% translate stays well inside that headroom, which
  // prevents any black edges from peeking in. Ken-burns combines a slow zoom
  // with a seeded diagonal drift so each photo drifts a different direction.
  //
  // `progress` is how far through this photo's lifetime we are (0 at its
  // own trigger km, 1 at the next photo's trigger km, or end of segment).
  const movementTransform = (progress: number, index: number): string => {
    const p = Math.max(0, Math.min(1, progress));
    // Look up this photo's zoom amount from the parsed list. List shorter
    // than the photo count → last value repeats. Magnitude controls how much
    // the photo zooms; sign controls direction (positive = push in, negative
    // = pull out, starting from an already-zoomed-in framing).
    const raw =
      photoZoomAmounts[index] ??
      photoZoomAmounts[photoZoomAmounts.length - 1] ??
      100;
    const mag = Math.abs(raw) / 100;
    // For negative values we reverse `p` on the curve — the photo begins at
    // the zoomed-in / end-of-pan position and travels back to baseline.
    // Drift on ken-burns is left unchanged so motion direction is independent
    // of zoom direction (cinematic "pull-back while panning" still works).
    const direction = raw >= 0 ? p : 1 - p;
    // Pan-mode parameters. At mag=1 these match the previous hardcoded
    // values (1.15 scale + ±4% travel). Zoom baseline and pan distance
    // scale together so the translate never reveals black edges (~53% of
    // available headroom is used at any mag).
    const zoomBasePan = 1 + 0.15 * mag;
    const panAmt = 4 * mag;
    switch (photoMovement) {
      case "none":
        return "none";
      case "zoom-in":
        return `scale(${1.0 + 0.2 * mag * direction})`;
      case "zoom-out":
        // Start zoomed in by `0.2 * mag`, end at 1.0 (matches original
        // 1.2 → 1.0 sweep when mag = 1). Negative raw inverts to a zoom-in.
        return `scale(${1.0 + 0.2 * mag * (1 - direction)})`;
      case "pan-left":
        return `scale(${zoomBasePan}) translate(${-panAmt + 2 * panAmt * direction}%, 0%)`;
      case "pan-right":
        return `scale(${zoomBasePan}) translate(${panAmt - 2 * panAmt * direction}%, 0%)`;
      case "pan-up":
        return `scale(${zoomBasePan}) translate(0%, ${-panAmt + 2 * panAmt * direction}%)`;
      case "pan-down":
        return `scale(${zoomBasePan}) translate(0%, ${panAmt - 2 * panAmt * direction}%)`;
      case "ken-burns": {
        // Seeded-per-photo angle so each photo drifts its own direction
        const rng = seededRandom(photoSeed + index * 37 + 1);
        const angle = rng() * Math.PI * 2;
        const tx = Math.cos(angle) * 3.5 * p;
        const ty = Math.sin(angle) * 3.5 * p;
        // 1.1 baseline gives pan headroom regardless of zoom amount; only
        // the 0.12 zoom delta is scaled. At mag 0 the photo still drifts.
        const scale = 1.1 + 0.12 * mag * direction;
        return `scale(${scale}) translate(${tx}%, ${ty}%)`;
      }
      default:
        return "none";
    }
  };

  // Movement progress for backdrop photo i — paced in *frame* time, not in
  // drawn-km, so effects like ken-burns / pan keep animating through the
  // `holdAtEnd` freeze. Non-last photos still finish their movement at the
  // exact frame the next photo activates (identical to the drawn-km cadence),
  // so only the trailing photo benefits from the extended lifetime.
  //
  // Pre-roll + tail extension: we shift the lifetime to span the photo's
  // *visible* window — i.e. from when its fade-in *begins* to when its
  // fade-out *ends*. Without this the photo sits stationary for the full
  // fade-in (motion at p=0), then jerks into motion once visible, and
  // freezes again at p=1 during the fade-out. Photo[0] uses the approach
  // window (`backdropFadeWindow`, runs even when photoTransition === "cut");
  // later photos use `transitionWindow` (which is 0 for "cut", giving no
  // shift — and with cut there's no fade to overlap with anyway).
  const backdropProgressFor = (index: number): number => {
    const me = backdropPhotos[index];
    if (!me) return 0;
    const next = backdropPhotos[index + 1];

    const lenKm = Math.max(1e-6, segmentLengthKm);
    const naiveStart = drawEnd * (me.km / lenKm) * durationInFrames;
    const naiveEnd = next
      ? drawEnd * (next.km / lenKm) * durationInFrames
      : durationInFrames;

    const preRollKm = index === 0 ? backdropFadeWindow : transitionWindow;
    const preRollFrames =
      drawEnd * (preRollKm / lenKm) * durationInFrames;
    // Tail extension: photo[i] keeps moving while it fades out into photo[i+1]
    // (same `transitionWindow` km that covers the cross-fade). Last photo
    // already runs to durationInFrames so no tail shift needed.
    const tailFrames = next
      ? drawEnd * (transitionWindow / lenKm) * durationInFrames
      : 0;

    const startFrame = Math.max(0, naiveStart - preRollFrames);
    const endFrame = Math.min(durationInFrames, naiveEnd + tailFrames);
    const lifetime = Math.max(1, endFrame - startFrame);
    return (frame - startFrame) / lifetime;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Backdrop photo layer — full-screen photos behind the map. Each photo
          crossfades into the next as the runner crosses its trigger km. The
          map above uses mixBlendMode to blend into this layer. */}
      {isBackdrop && backdropPhotos.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: photoBackdropOpacity / 100,
          }}
        >
          {/* Neutral baseline — the blend mode's identity colour. Sits beneath
              the photo layers so the map has something benign to blend with
              before the first photo arrives. Fades to 0 as the first photo
              fades in (blendActivation: 0 → 1). */}
          {blendActivation < 1 && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor:
                  BLEND_NEUTRAL[mapBlendMode] || "transparent",
                opacity: 1 - blendActivation,
              }}
            />
          )}
          {(() => {
            // Render the "from" and (if transitioning) the "to" photo with
            // transition-specific styling. Movement lives on the inner <Img>
            // so it composes cleanly with the wrapper's transition transform.
            //
            // The "approach" case (photo[0] before its trigger km) reuses the
            // same DOM element with a soft-fade style. Crucial: render it
            // through this same code path with the SAME key as the post-trigger
            // "from" layer, so React keeps the <Img> mounted across the
            // boundary instead of unmounting + remounting (which causes a
            // visible flash as the new <Img> re-fires its delayRender).
            const renderLayer = (
              role: "from" | "to",
              idx: number,
              isApproach: boolean,
            ) => {
              const photo = backdropPhotos[idx];
              if (!photo) return null;
              // During the approach window we always use a plain crossfade
              // regardless of the user's photoTransition (e.g. "cut" would
              // otherwise hide the layer). Once past the boundary, the user's
              // chosen transition style takes over with full opacity.
              const style = isApproach
                ? { opacity: blendActivation, transform: "none" as string | undefined, clipPath: undefined as string | undefined }
                : getTransitionStyle(
                    photoTransition,
                    role,
                    transitionProgress,
                  );
              if ("hidden" in style && style.hidden) return null;
              return (
                <div
                  key={`backdrop-${role}-${idx}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: style.opacity,
                    transform: style.transform,
                    clipPath: style.clipPath,
                    overflow: "hidden",
                  }}
                >
                  <Img
                    src={staticFile(
                      photosFolder
                        ? `${photosFolder}/${photo.filename}`
                        : photo.filename,
                    )}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: movementTransform(
                        backdropProgressFor(idx),
                        idx,
                      ),
                      transformOrigin: "center center",
                      willChange: "transform",
                    }}
                  />
                </div>
              );
            };
            // Resolve which photo plays the "from" role. In the approach
            // window we pin it to photo[0] so the entry fades smoothly into
            // the regular flow once backdropActiveIndex catches up.
            const fromIdx = inApproachWindow ? 0 : transitionFrom;
            return (
              <>
                {fromIdx >= 0 && renderLayer("from", fromIdx, inApproachWindow)}
                {transitionTo >= 0 && renderLayer("to", transitionTo, false)}
              </>
            );
          })()}
        </div>
      )}

      {/* Dip-to-black overlay — covers the whole screen (above map, route,
          HUD) so the transition truly dips to black, not just the photo. */}
      {isBackdrop &&
        photoTransition === "dip-to-black" &&
        transitionTo >= 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "black",
              opacity: Math.max(
                0,
                1 - Math.abs(transitionProgress - 0.5) * 2,
              ),
              zIndex: 100,
              pointerEvents: "none",
            }}
          />
        )}

      {/* Map tiles — start provider era (with optional secondary overlay).
          When in backdrop mode, the outer div uses mix-blend-mode to blend
          with the backdrop photo below. isolation: isolate still correctly
          scopes provider2's blend to within this container. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          isolation: "isolate",
          mixBlendMode: mapBlendMode,
        }}
      >
        <TileMapBackground
          viewport={viewport}
          style={provider === "ocean-composite" ? "ocean-composite" : "satellite"}
        />
        {hasProvider2 && viewport2 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              mixBlendMode: provider2BlendMode,
            }}
          >
            <TileMapBackground
              viewport={viewport2}
              style={provider2 === "ocean-composite" ? "ocean-composite" : "satellite"}
            />
          </div>
        )}
      </div>

      {/* Map tiles — end provider era (crossfade on top) */}
      {hasTileTransition && viewportEnd && (() => {
        const startF = (tileTransitionStart / 100) * durationInFrames;
        const endF = (tileTransitionEnd / 100) * durationInFrames;
        const endOpacity = endF > startF
          ? interpolate(frame, [startF, endF], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 0;
        if (endOpacity <= 0) return null;
        return (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              isolation: "isolate",
              opacity: endOpacity,
              mixBlendMode: mapBlendMode,
            }}
          >
            <TileMapBackground
              viewport={viewportEnd}
              style={providerEnd === "ocean-composite" ? "ocean-composite" : "satellite"}
            />
            {hasProviderEnd2 && viewportEnd2 && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  mixBlendMode: providerEnd2BlendMode,
                }}
              >
                <TileMapBackground
                  viewport={viewportEnd2}
                  style={providerEnd2 === "ocean-composite" ? "ocean-composite" : "satellite"}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* SVG route overlay */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          {routeShadow > 0 && (
            <filter id="indy-route-shadow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={12 * (routeShadow / 100)} />
            </filter>
          )}
          {routeGlow > 0 && (
            <>
              <filter id="indy-route-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation={8 * (routeGlow / 100)} result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="indy-runner-glow" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur in="SourceGraphic" stdDeviation={12 * (routeGlow / 100)} result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </>
          )}
        </defs>

        {/* Route shadow */}
        {routeShadow > 0 && (
          <path d={svgPath} fill="none"
            stroke={`rgba(0,0,0,${0.5 * (routeShadow / 100)})`}
            strokeWidth={routeWidth + 20 * (routeShadow / 100)}
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={pathLength} strokeDashoffset={dashOffset}
            filter="url(#indy-route-shadow)" />
        )}

        {/* Route casing */}
        {routeCasing > 0 && (
          <path d={svgPath} fill="none"
            stroke={`rgba(0,0,0,${0.6 * (routeCasing / 100)})`}
            strokeWidth={routeWidth + 6 * (routeCasing / 100)}
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={pathLength} strokeDashoffset={dashOffset} />
        )}

        {/* Route line */}
        <path d={svgPath} fill="none"
          stroke={routeColor} strokeWidth={routeWidth}
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={pathLength} strokeDashoffset={dashOffset}
          filter={routeGlow > 0 ? "url(#indy-route-glow)" : undefined} />

        {/* Runner dot */}
        {easedDraw > 0 && dotSize > 0 && (
          <>
            <circle cx={currentPoint.x} cy={currentPoint.y}
              r={32 * ds} fill={routeColor} opacity={glowPulse}
              filter={routeGlow > 0 ? "url(#indy-runner-glow)" : undefined} />
            <circle cx={currentPoint.x} cy={currentPoint.y}
              r={15 * ds} fill="#ffffff" stroke={routeColor} strokeWidth={6 * ds} />
          </>
        )}
      </svg>

      {/* Photos pinned to map — only for pinned styles; backdrop style
          renders photos full-screen behind the map instead. */}
      {!isBackdrop && photoList.length > 0 && (
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: width, height: height,
          pointerEvents: "none", zIndex: 2,
        }}>
          {photoList.map((photo, i) => {
            if (i >= photoPixels.length) return null;
            const px = photoPixels[i];
            const currentKm = segmentLengthKm * easedDraw;

            // Only show if the dot has safely passed this photo
            const triggerKm = photo.safeRevealKm;
            if (currentKm < triggerKm) return null;

            // Reveal animation
            // Reveal speed: 100 = default, 50 = 2x slower, 200 = 2x faster
            const revealWindow = (segmentLengthKm * 0.03) / (photoRevealSpeed / 100);
            const revealProgress = Math.min(1, (currentKm - triggerKm) / revealWindow);
            let opacity = 1;
            let scale = 1;
            let translateY = 0;

            if (photoReveal === "fade") {
              opacity = revealProgress;
            } else if (photoReveal === "drop") {
              const t = revealProgress;
              scale = t < 0.5 ? 0.8 + 0.4 * (t / 0.5) : 1.2 - 0.2 * ((t - 0.5) / 0.5);
              translateY = (1 - t) * -60;
              opacity = Math.min(1, t * 3);
            }

            const sizePx = (photoSize / 100) * width;

            // On-route style: use route bearing for rotation so photo aligns with trail
            const displayRotation = photo.rotation;

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: px.x,
                  top: px.y,
                  width: sizePx,
                  height: sizePx * 0.67,
                  transform: `translate(-50%, -50%) rotate(${displayRotation}deg) scale(${scale}) translateY(${translateY}px)`,
                  opacity,
                  boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 3px 10px rgba(0,0,0,0.4)",
                  border: "3px solid rgba(255,255,255,0.2)",
                  overflow: "hidden",
                }}
              >
                {/* Remotion's <Img> wraps delayRender around the image load,
                    so every render tab waits for its own decode to finish.
                    A plain <img> caused frames to occasionally capture the
                    photo mid-decode, making it flicker through the fade-in. */}
                <Img
                  src={staticFile(photosFolder ? `${photosFolder}/${photo.filename}` : photo.filename)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Vignette */}
      <div style={{
        position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)",
        pointerEvents: "none", zIndex: 5,
      }} />

      {/* HUD */}
      {(showDistance || showElevation) && (
        <div style={{
          position: "absolute", bottom: 80, left: 80,
          display: "flex", flexDirection: "column", gap: 16, zIndex: 10,
        }}>
          {showDistance && (
            <div style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: 120, fontWeight: 700, color: "white",
              textShadow: "0 3px 20px rgba(0,0,0,0.95), 0 0px 6px rgba(0,0,0,0.6)",
              lineHeight: 1,
            }}>
              {distanceLabel || "↔"} {currentDistanceKm.toFixed(1)} km
            </div>
          )}
          {showElevation && (
            <div style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: 72, fontWeight: 500, color: "rgba(255,255,255,0.85)",
              textShadow: "0 2px 12px rgba(0,0,0,0.9), 0 0px 4px rgba(0,0,0,0.5)",
              lineHeight: 1,
            }}>
              {elevationLabel || "↑"} {Math.round(cumulativeElevGain).toLocaleString()} m
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
