/**
 * GPXSegment — Self-service Remotion composition for any GPX route.
 *
 * Drop a .gpx file into public/, set the filename in props, configure
 * start/end km, style, and HUD options in Remotion Studio's sidebar.
 */
import React, { useMemo, useEffect, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { z } from "zod";
import { parseGPX } from "../lib/gpx-browser-parser";
import {
  processRoute,
  extractSegment,
  getPreviousRouteCoords,
} from "../lib/route-processor";
import {
  computeViewport,
  coordsToPixels,
  mapProviderEnum,
  mapProviderOptionalEnum,
  blendModeEnum,
  type MapProvider,
  type MapProviderOptional,
  type BlendMode,
} from "../lib/tile-viewport";
import { TileMapBackground } from "./TileMapBackground";

export const gpxSegmentSchema = z.object({
  gpxFile: z.string().describe("GPX filename in public/ folder"),
  startKm: z.number().min(0).describe("Start km (0 = route start, decimals allowed e.g. 3.45). If startKm === endKm the dot stays frozen at this km."),
  endKm: z.number().min(0).describe("End km (9999 = full route, decimals allowed e.g. 5.8). If startKm === endKm no line draws — dot stays still."),
  durationSeconds: z.number().min(1).max(300).describe("Duration in seconds"),
  // Map tiles — up to three providers render in sequence:
  //   providerStart → provider → providerEnd
  providerStart: mapProviderEnum.describe("Earliest map provider (same as 'provider' = no pre-transition)"),
  providerStart2: mapProviderOptionalEnum.describe("Optional overlay on top of providerStart ('none' = no overlay)"),
  providerStart2BlendMode: blendModeEnum.describe("Blend mode for providerStart2 over providerStart"),
  providerStartTransitionStart: z.number().min(0).max(100).describe("providerStart→provider crossfade begins at % of duration"),
  providerStartTransitionEnd: z.number().min(0).max(100).describe("providerStart→provider crossfade ends at % of duration"),
  provider: mapProviderEnum.describe("Main map provider (middle era)"),
  provider2: mapProviderOptionalEnum.describe("Optional overlay on top of provider ('none' = no overlay)"),
  provider2BlendMode: blendModeEnum.describe("Blend mode for provider2 over provider"),
  providerEnd: mapProviderEnum.describe("Last map provider (same as 'provider' = no end transition)"),
  providerEnd2: mapProviderOptionalEnum.describe("Optional overlay on top of providerEnd ('none' = no overlay)"),
  providerEnd2BlendMode: blendModeEnum.describe("Blend mode for providerEnd2 over providerEnd"),
  tileTransitionStart: z.number().min(0).max(100).describe("provider→providerEnd crossfade begins at % of duration"),
  tileTransitionEnd: z.number().min(0).max(100).describe("provider→providerEnd crossfade ends at % of duration"),
  zoom: z.number().min(10).max(19).describe("Tile zoom (19=max detail, 14=overview)"),
  zoomReduction: z.number().min(0).max(5).describe("Reduce tile zoom for the zoomed-out provider (0 = same, 2 = 2 levels lower)"),
  // Fades — color overlays that sit ABOVE tiles but BELOW the route
  fadeInColor: z.string().describe("Fade in from this color at start (empty = no fade in)"),
  fadeOutColor: z.string().describe("Fade out to this color at end (empty = no fade out)"),
  fadeInOutLength: z.number().min(0).max(60).describe("Fade duration in seconds (applies to both in + out; 0 = off)"),
  // Camera zoom
  cameraStartZoom: z.number().min(1).max(1000).describe("Camera zoom % (100 = default, 1 = extreme wide, 1000 = 10x in)"),
  cameraEndZoom: z.number().min(1).max(1000).describe("Camera zoom % (100 = default, 1 = extreme wide, 1000 = 10x in)"),
  cameraZoomDelay: z.number().min(0).max(100).describe("Delay before zoom starts (% of duration)"),
  cameraZoomEndDelay: z.number().min(0).max(100).describe("Zoom ends at this % of duration (must be > cameraZoomDelay)"),
  cameraAnchorX: z.number().min(0).max(100).describe("Camera zoom pivot X (% from left)"),
  cameraAnchorY: z.number().min(0).max(100).describe("Camera zoom pivot Y (% from top)"),
  // Viewport
  padding: z.number().min(0).max(200).describe("Padding around segment (% — 35 = default)"),
  offsetX: z.number().min(-500).max(500).describe("Viewport shift X (% of view width)"),
  offsetY: z.number().min(-500).max(500).describe("Viewport shift Y (% of view height)"),
  // Route
  routeColor: z.string().describe("Route line color"),
  routeWidth: z.number().min(1).max(50).describe("Route line width"),
  dotSize: z.number().min(0).max(200).describe("Leading dot size (0 = hidden, 100 = default)"),
  dotPulseSpeed: z.number().min(0).max(500).describe("Dot flash speed (0 = no pulse, 100 = default, 500 = fast)"),
  routeGlow: z.number().min(0).max(200).describe("Route glow intensity (0 = off, 100 = default, 200 = intense)"),
  routeCasing: z.number().min(0).max(200).describe("Dark outline around route (0 = off, 100 = default)"),
  routeShadow: z.number().min(0).max(200).describe("Soft shadow under route (0 = off, 50 = subtle, 100 = default)"),
  showPreviousRoute: z.boolean().describe("Show dim trail of previous route"),
  // Animation
  reverseDrawing: z.boolean().describe("Start fully drawn, undraw over time"),
  cameraAnchorMode: z.enum(["center", "start", "end", "dot"]).describe("Where camera zooms toward (center=default, dot=follows the moving dot)"),
  cameraTracking: z.enum(["animated", "still"]).describe("animated = zoom + anchor follow per props, still = camera locked at start zoom, no movement"),
  // HUD
  distanceScale: z.number().min(50).max(200).describe("Scale km counter to match Strava (100=as-is, 112=for route.gpx)"),
  showDistance: z.boolean().describe("Show distance counter"),
  showElevation: z.boolean().describe("Show elevation counter"),
  distanceLabel: z.string().describe("Distance label (empty = ↔)"),
  elevationLabel: z.string().describe("Elevation label (empty = ↑)"),
});

export interface GPXSegmentProps {
  /** GPX filename in public/ folder */
  gpxFile: string;
  /** Start km (0 = route start) */
  startKm: number;
  /** End km (use a large number like 9999 for full route) */
  endKm: number;
  /** Map provider */
  provider: MapProvider;
  /** Optional overlay on top of provider (`none` = no overlay) */
  provider2: MapProviderOptional;
  /** Blend mode for provider2 over provider */
  provider2BlendMode: BlendMode;
  /** Route line color */
  routeColor: string;
  /** Route line width */
  routeWidth: number;
  /** Leading dot size (0 = hidden, 100 = default) */
  dotSize: number;
  /** Dot flash speed (0 = no pulse, 100 = default, 500 = fast) */
  dotPulseSpeed: number;
  /** Route glow intensity (0 = off, 100 = default, 200 = intense) */
  routeGlow: number;
  /** Dark outline around route (0 = off, 100 = default) */
  routeCasing: number;
  /** Soft shadow under route (0 = off, 100 = default) */
  routeShadow: number;
  /** Scale km counter to match Strava */
  distanceScale: number;
  /** Show distance counter */
  showDistance: boolean;
  /** Show elevation counter */
  showElevation: boolean;
  /** Distance label (empty = ↔) */
  distanceLabel: string;
  /** Elevation label (empty = ↑) */
  elevationLabel: string;
  /** Show dim trail of previous route */
  showPreviousRoute: boolean;
  /** Start fully drawn, undraw over time */
  reverseDrawing: boolean;
  /** Where camera zooms toward */
  cameraAnchorMode: "center" | "start" | "end" | "dot";
  /** Camera tracking mode — "still" disables all camera movement */
  cameraTracking: "animated" | "still";
  /** Tile zoom level (17 = satellite detail, 14 = overview) */
  zoom: number;
  /** Reduce tile zoom for the zoomed-out provider */
  zoomReduction: number;
  /** Padding around segment (0.35 = 35%) */
  padding: number;
  /** Viewport shift X (fraction, e.g. 0.1 = 10% right) */
  offsetX: number;
  /** Viewport shift Y (fraction, e.g. 0.1 = 10% down) */
  offsetY: number;
  /** Duration in seconds */
  durationSeconds: number;
  /** Earliest map provider (same as `provider` = no pre-transition) */
  providerStart: MapProvider;
  /** Optional overlay on top of providerStart (`none` = no overlay) */
  providerStart2: MapProviderOptional;
  /** Blend mode for providerStart2 over providerStart */
  providerStart2BlendMode: BlendMode;
  /** providerStart→provider crossfade begin (% of duration) */
  providerStartTransitionStart: number;
  /** providerStart→provider crossfade end (% of duration) */
  providerStartTransitionEnd: number;
  /** Tile provider to transition TO (same as provider = no transition) */
  providerEnd: MapProvider;
  /** Optional overlay on top of providerEnd (`none` = no overlay) */
  providerEnd2: MapProviderOptional;
  /** Blend mode for providerEnd2 over providerEnd */
  providerEnd2BlendMode: BlendMode;
  /** When tile crossfade begins (0-100 % of duration) */
  tileTransitionStart: number;
  /** When tile crossfade completes (0-100 % of duration) */
  tileTransitionEnd: number;
  /** Fade in from this color (empty = no fade in) */
  fadeInColor: string;
  /** Fade out to this color (empty = no fade out) */
  fadeOutColor: string;
  /** Fade duration in seconds */
  fadeInOutLength: number;
  /** Camera zoom at start (100 = no zoom, 150 = 50% in) */
  cameraStartZoom: number;
  /** Camera zoom at end (100 = no zoom, 150 = 50% in) */
  cameraEndZoom: number;
  /** Delay before zoom starts (% of duration) */
  cameraZoomDelay: number;
  /** Freeze zoom before end (% of duration) */
  cameraZoomEndDelay: number;
  /** Camera zoom pivot X (0-100 % from left) */
  cameraAnchorX: number;
  /** Camera zoom pivot Y (0-100 % from top) */
  cameraAnchorY: number;
}

export const GPXSegment: React.FC<GPXSegmentProps> = ({
  gpxFile,
  startKm,
  endKm,
  provider,
  provider2,
  provider2BlendMode,
  routeColor,
  routeWidth,
  dotSize,
  dotPulseSpeed,
  routeGlow,
  routeCasing,
  routeShadow,
  distanceScale,
  showDistance,
  showElevation,
  distanceLabel,
  elevationLabel,
  showPreviousRoute,
  reverseDrawing,
  cameraAnchorMode,
  cameraTracking,
  zoom,
  zoomReduction,
  padding,
  offsetX,
  offsetY,
  providerStart,
  providerStart2,
  providerStart2BlendMode,
  providerStartTransitionStart,
  providerStartTransitionEnd,
  providerEnd,
  providerEnd2,
  providerEnd2BlendMode,
  tileTransitionStart,
  tileTransitionEnd,
  fadeInColor,
  fadeOutColor,
  fadeInOutLength,
  cameraStartZoom,
  cameraEndZoom,
  cameraZoomDelay,
  cameraZoomEndDelay,
  cameraAnchorX,
  cameraAnchorY,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();

  // Load and parse GPX file — delayRender ensures no frames are captured until loaded
  const [gpxData, setGpxData] = useState<string | null>(null);
  const [gpxHandle] = useState(() => delayRender("Loading GPX file", { timeoutInMilliseconds: 30000 }));

  useEffect(() => {
    fetch(staticFile(gpxFile))
      .then((r) => r.text())
      .then((text) => {
        setGpxData(text);
        continueRender(gpxHandle);
      })
      .catch(() => {
        console.error(`Failed to load GPX file: ${gpxFile}`);
        continueRender(gpxHandle);
      });
  }, [gpxFile, gpxHandle]);

  // Process route
  const route = useMemo(() => {
    if (!gpxData) return null;
    try {
      const parsed = parseGPX(gpxData);
      return processRoute(parsed.points);
    } catch (e) {
      console.error("GPX processing error:", e);
      return null;
    }
  }, [gpxData]);

  // Extract segment
  const actualEndKm = route
    ? Math.min(endKm, route.totalDistanceKm)
    : endKm;

  const segment = useMemo(() => {
    if (!route) return null;
    try {
      return extractSegment(route, startKm, actualEndKm);
    } catch (e) {
      console.error("Segment extraction error:", e);
      return null;
    }
  }, [route, startKm, actualEndKm]);

  const minCameraScale = Math.min(cameraStartZoom, cameraEndZoom) / 100;

  // Convert offset percentages to fractions
  const oX = offsetX / 100;
  const oY = offsetY / 100;

  // Both viewports must cover the same physical area (the widest view).
  // The padding is inflated based on the most zoomed-out camera state.
  const basePadding = padding / 100;
  const effectivePadding = minCameraScale < 1 ? basePadding / minCameraScale : basePadding;

  // Apply zoomReduction to whichever provider is shown at the more zoomed-out camera state.
  // Lower tile zoom = fewer tiles for the same area = faster loading.
  const startIsWider = cameraStartZoom <= cameraEndZoom;
  const startZoomLevel = startIsWider
    ? Math.max(10, zoom - zoomReduction)
    : zoom;
  const endZoomLevel = startIsWider
    ? zoom
    : Math.max(10, zoom - zoomReduction);

  // Compute viewport (start provider — base for coordinates and route overlay)
  const viewport = useMemo(() => {
    if (!segment) return null;
    return computeViewport(segment.coords, {
      zoom: startZoomLevel,
      padding: effectivePadding,
      offsetX: oX,
      offsetY: oY,
      provider: provider === "ocean-composite" ? "hillshade" : provider,
    });
  }, [segment, startZoomLevel, effectivePadding, oX, oY, provider]);

  // Second viewport for tile transition (only when providers differ).
  // Uses the SAME zoom as the start provider so both tile grids align perfectly.
  // The zoomReduction only lowers the wider provider's zoom to reduce tile count.
  const hasTileTransition = providerEnd !== provider;
  const viewportEnd = useMemo(() => {
    if (!segment || !hasTileTransition) return null;
    return computeViewport(segment.coords, {
      zoom: endZoomLevel,
      padding: effectivePadding,
      offsetX: oX,
      offsetY: oY,
      provider: providerEnd === "ocean-composite" ? "hillshade" : providerEnd,
    });
  }, [segment, endZoomLevel, effectivePadding, oX, oY, providerEnd, hasTileTransition]);

  // Third viewport: providerStart (rendered before 'provider' takes over).
  // Always uses the main zoom level — there's no extra zoomReduction era for it.
  const hasProviderStart = providerStart !== provider;
  const viewportStart = useMemo(() => {
    if (!segment || !hasProviderStart) return null;
    return computeViewport(segment.coords, {
      zoom: startZoomLevel,
      padding: effectivePadding,
      offsetX: oX,
      offsetY: oY,
      provider: providerStart === "ocean-composite" ? "hillshade" : providerStart,
    });
  }, [segment, startZoomLevel, effectivePadding, oX, oY, providerStart, hasProviderStart]);

  // Secondary / overlay viewports for each era. Only computed when the
  // corresponding "providerX2" is not "none". Each gets its own viewport
  // because zoom caps differ per provider (see TILE_MAX_ZOOM) — computeViewport
  // clamps internally so the secondary tiles stay within their server's cap.
  const hasProviderStart2 = providerStart2 !== "none";
  const viewportStart2 = useMemo(() => {
    if (!segment || !hasProviderStart || !hasProviderStart2) return null;
    return computeViewport(segment.coords, {
      zoom: startZoomLevel,
      padding: effectivePadding,
      offsetX: oX,
      offsetY: oY,
      provider: providerStart2 === "ocean-composite" ? "hillshade" : providerStart2,
    });
  }, [segment, startZoomLevel, effectivePadding, oX, oY, providerStart2, hasProviderStart, hasProviderStart2]);

  const hasProvider2 = provider2 !== "none";
  const viewport2 = useMemo(() => {
    if (!segment || !hasProvider2) return null;
    return computeViewport(segment.coords, {
      zoom: startZoomLevel,
      padding: effectivePadding,
      offsetX: oX,
      offsetY: oY,
      provider: provider2 === "ocean-composite" ? "hillshade" : provider2,
    });
  }, [segment, startZoomLevel, effectivePadding, oX, oY, provider2, hasProvider2]);

  const hasProviderEnd2 = providerEnd2 !== "none";
  const viewportEnd2 = useMemo(() => {
    if (!segment || !hasTileTransition || !hasProviderEnd2) return null;
    return computeViewport(segment.coords, {
      zoom: endZoomLevel,
      padding: effectivePadding,
      offsetX: oX,
      offsetY: oY,
      provider: providerEnd2 === "ocean-composite" ? "hillshade" : providerEnd2,
    });
  }, [segment, endZoomLevel, effectivePadding, oX, oY, providerEnd2, hasTileTransition, hasProviderEnd2]);

  // Convert coordinates to pixels
  const segmentPoints = useMemo(() => {
    if (!segment || !viewport) return [];
    return coordsToPixels(segment.coords, viewport);
  }, [segment, viewport]);

  const previousPoints = useMemo(() => {
    if (!route || !viewport || !showPreviousRoute) return [];
    const prevCoords = getPreviousRouteCoords(route, startKm);
    return coordsToPixels(prevCoords, viewport);
  }, [route, viewport, showPreviousRoute, startKm]);

  // SVG path
  const svgPath = useMemo(() => {
    if (segmentPoints.length < 2) return "";
    let d = `M ${segmentPoints[0].x} ${segmentPoints[0].y}`;
    for (let i = 1; i < segmentPoints.length; i++) {
      d += ` L ${segmentPoints[i].x} ${segmentPoints[i].y}`;
    }
    return d;
  }, [segmentPoints]);

  const prevPath = useMemo(() => {
    if (previousPoints.length < 2) return "";
    let d = `M ${previousPoints[0].x} ${previousPoints[0].y}`;
    for (let i = 1; i < previousPoints.length; i++) {
      d += ` L ${previousPoints[i].x} ${previousPoints[i].y}`;
    }
    return d;
  }, [previousPoints]);

  // Path measurement — computed synchronously from segmentPoints.
  // Previously used SVGPathElement.getTotalLength()/getPointAtLength() via a
  // useEffect, which caused the dot to lag one frame behind path changes and
  // visibly detach from the line during camera panning. Computing lengths in
  // JS keeps the dot and the drawn line in perfect sync every frame.
  const pathMetrics = useMemo(() => {
    if (segmentPoints.length < 2) {
      return { totalLength: 0, cumLengths: [0] };
    }
    const cumLengths: number[] = [0];
    let total = 0;
    for (let i = 1; i < segmentPoints.length; i++) {
      const dx = segmentPoints[i].x - segmentPoints[i - 1].x;
      const dy = segmentPoints[i].y - segmentPoints[i - 1].y;
      total += Math.hypot(dx, dy);
      cumLengths.push(total);
    }
    return { totalLength: total, cumLengths };
  }, [segmentPoints]);

  const pathLength = pathMetrics.totalLength;

  // Animation progress
  const progress = frame / durationInFrames;
  const drawEnd = 0.85;
  const rawDraw = Math.min(1, Math.max(0, progress / drawEnd));
  // Reverse: start fully drawn (1), undraw to 0
  const easedDraw = reverseDrawing ? 1 - rawDraw : rawDraw;
  const dashOffset =
    pathLength > 0 ? pathLength * (1 - easedDraw) : pathLength;

  // Distance
  const segmentLengthKm = segment?.segmentLengthKm ?? 0;
  // When startKm === endKm the segment has zero length — no line is drawn,
  // the dot just sits on the single point.
  const isPointOnly = segmentLengthKm === 0;

  // Runner dot position — binary-search the polyline to the drawn distance.
  // Falls back to the single point location for degenerate segments.
  const currentPoint = useMemo(() => {
    if (isPointOnly && segmentPoints.length > 0) {
      return { x: segmentPoints[0].x, y: segmentPoints[0].y };
    }
    if (segmentPoints.length === 0) return { x: 0, y: 0 };
    if (segmentPoints.length === 1) return segmentPoints[0];
    const target = pathMetrics.totalLength * easedDraw;
    const cum = pathMetrics.cumLengths;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= target) lo = mid;
      else hi = mid;
    }
    const segLen = cum[hi] - cum[lo];
    const t = segLen > 0 ? (target - cum[lo]) / segLen : 0;
    return {
      x: segmentPoints[lo].x + t * (segmentPoints[hi].x - segmentPoints[lo].x),
      y: segmentPoints[lo].y + t * (segmentPoints[hi].y - segmentPoints[lo].y),
    };
  }, [easedDraw, pathMetrics, isPointOnly, segmentPoints]);
  // Read distance from actual segmentDistances (which skips ferry gaps)
  const currentDistanceKm = useMemo(() => {
    if (!segment) return startKm;
    const dists = segment.segmentDistances;
    const targetIdx = Math.min(
      dists.length - 1,
      Math.round(easedDraw * (dists.length - 1))
    );
    return (startKm + dists[targetIdx]) * (distanceScale / 100);
  }, [segment, startKm, easedDraw, distanceScale]);

  // Elevation gain
  const cumulativeElevGain = useMemo(() => {
    if (!segment) return 0;
    const dists = segment.segmentDistances;
    const elevs = segment.segmentElevations;
    const targetDist = segmentLengthKm * easedDraw;

    let gain = 0;
    for (let i = 1; i < elevs.length; i++) {
      if (dists[i] > targetDist) {
        if (dists[i - 1] < targetDist) {
          const t =
            (targetDist - dists[i - 1]) / (dists[i] - dists[i - 1]);
          const interpElev = elevs[i - 1] + t * (elevs[i] - elevs[i - 1]);
          const diff = interpElev - elevs[i - 1];
          if (diff > 0) gain += diff;
        }
        break;
      }
      const diff = elevs[i] - elevs[i - 1];
      if (diff > 0) gain += diff;
    }
    return (segment.segmentStartElevGain || 0) + gain;
  }, [easedDraw, segment, segmentLengthKm]);

  const pulseRate = dotPulseSpeed / 100; // 0 = static, 1 = default 1Hz, 5 = fast
  const glowPulse = pulseRate > 0
    ? 0.4 + 0.3 * Math.sin((frame / fps) * Math.PI * 2 * pulseRate)
    : 0.7;

  // Dynamic camera anchor based on mode (must be before early return).
  // In "still" mode, the "dot" anchor (which moves with the dot = bounces) is
  // replaced by cameraAnchorX/Y. The static anchor modes (center/start/end)
  // still work in still mode — they don't bounce, they just pick a fixed
  // zoom target.
  const effectiveAnchor = useMemo(() => {
    const resolvedMode =
      cameraTracking === "still" && cameraAnchorMode === "dot"
        ? "center"
        : cameraAnchorMode;
    if (resolvedMode === "center") {
      return { x: cameraAnchorX, y: cameraAnchorY };
    }
    if (resolvedMode === "start" && segmentPoints.length > 0) {
      return {
        x: (segmentPoints[0].x / width) * 100,
        y: (segmentPoints[0].y / height) * 100,
      };
    }
    if (resolvedMode === "end" && segmentPoints.length > 0) {
      const last = segmentPoints[segmentPoints.length - 1];
      return { x: (last.x / width) * 100, y: (last.y / height) * 100 };
    }
    if (resolvedMode === "dot" && currentPoint) {
      return {
        x: (currentPoint.x / width) * 100,
        y: (currentPoint.y / height) * 100,
      };
    }
    return { x: cameraAnchorX, y: cameraAnchorY };
  }, [cameraTracking, cameraAnchorMode, cameraAnchorX, cameraAnchorY, segmentPoints, currentPoint, width, height]);

  // Loading state
  if (!viewport || !segment) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: 48,
            fontFamily: "'Courier New', monospace",
          }}
        >
          {!gpxData
            ? `Loading ${gpxFile}...`
            : !route
              ? "Processing route..."
              : "Preparing segment..."}
        </div>
      </AbsoluteFill>
    );
  }

  // Camera zoom — normalized so the most zoomed-out state = scale 1.0.
  // The viewport is computed at the widest (most zoomed-out) padding, so
  // CSS scale only ever goes UP from 1.0, preventing any black edges.
  // Both delays are measured from the start of the video (%).
  // Zoom animates between cameraZoomDelay% and cameraZoomEndDelay%.
  // If endDelay <= startDelay or endDelay is 0, zoom runs from startDelay to 100%.
  const zoomStart = cameraZoomDelay / 100;
  const zoomEnd = cameraZoomEndDelay > cameraZoomDelay ? cameraZoomEndDelay / 100 : 1;
  const zoomWindow = zoomEnd - zoomStart;
  const linearProgress = zoomWindow <= 0
    ? 0
    : Math.min(1, Math.max(0, (frame / durationInFrames - zoomStart) / zoomWindow));
  // Smoothstep ease-in-out: gradual acceleration and deceleration
  const cameraProgress = linearProgress * linearProgress * (3 - 2 * linearProgress);
  const startZ = cameraStartZoom / 100;
  const endZ = cameraEndZoom / 100;
  const cameraZoom = startZ + (endZ - startZ) * cameraProgress;

  // Fade overlays (sit above tiles, below the route so the route stays visible).
  const fadeFrames = Math.max(0, fadeInOutLength) * fps;
  const fadeInOpacity = fadeFrames > 0 && fadeInColor
    ? Math.max(0, 1 - frame / fadeFrames)
    : 0;
  const fadeOutOpacity = fadeFrames > 0 && fadeOutColor
    ? Math.max(0, (frame - (durationInFrames - fadeFrames)) / fadeFrames)
    : 0;

  // providerStart → provider crossfade.
  // Before providerStartTransitionStart: providerStart fully opaque, provider hidden.
  // After providerStartTransitionEnd: providerStart hidden, provider fully opaque.
  const pStartF = (providerStartTransitionStart / 100) * durationInFrames;
  const pEndF = (providerStartTransitionEnd / 100) * durationInFrames;
  const providerRevealOpacity = hasProviderStart
    ? (pEndF > pStartF
        ? interpolate(frame, [pStartF, pEndF], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        : (frame >= pStartF ? 1 : 0))
    : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Camera zoom wrapper — contains tiles + route, not vignette/HUD */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          overflow: "hidden",
          transform: `scale(${cameraZoom})`,
          transformOrigin: `${effectiveAnchor.x}% ${effectiveAnchor.y}%`,
        }}
      >
      {/* Map tiles — providerStart era (earliest; sits at the bottom) */}
      {hasProviderStart && viewportStart && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            isolation: "isolate",
          }}
        >
          <TileMapBackground
            viewport={viewportStart}
            style={providerStart === "ocean-composite" ? "ocean-composite" : "satellite"}
          />
          {hasProviderStart2 && viewportStart2 && providerStart2 !== "none" && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                mixBlendMode: providerStart2BlendMode,
              }}
            >
              <TileMapBackground
                viewport={viewportStart2}
                style={providerStart2 === "ocean-composite" ? "ocean-composite" : "satellite"}
              />
            </div>
          )}
        </div>
      )}

      {/* Map tiles — provider era (middle; crossfades in over providerStart) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          isolation: "isolate",
          opacity: providerRevealOpacity,
        }}
      >
        <TileMapBackground
          viewport={viewport}
          style={provider === "ocean-composite" ? "ocean-composite" : "satellite"}
        />
        {hasProvider2 && viewport2 && provider2 !== "none" && (
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

      {/* Map tiles — providerEnd era (crossfade on top at the end of the video) */}
      {hasTileTransition && viewportEnd && (() => {
        const startF = (tileTransitionStart / 100) * durationInFrames;
        const endF = (tileTransitionEnd / 100) * durationInFrames;
        const endOpacity = endF > startF
          ? interpolate(frame, [startF, endF], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 1;
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
            }}
          >
            <TileMapBackground
              viewport={viewportEnd}
              style={providerEnd === "ocean-composite" ? "ocean-composite" : "satellite"}
            />
            {hasProviderEnd2 && viewportEnd2 && providerEnd2 !== "none" && (
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

      {/* Fade-in overlay (color covers tiles but is underneath the route) */}
      {fadeInColor && fadeInOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: fadeInColor,
            opacity: fadeInOpacity,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Fade-out overlay */}
      {fadeOutColor && fadeOutOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: fadeOutColor,
            opacity: fadeOutOpacity,
            pointerEvents: "none",
          }}
        />
      )}

      {/* SVG route overlay */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          {routeShadow > 0 && (
            <filter
              id="gpx-route-shadow"
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation={12 * (routeShadow / 100)}
              />
            </filter>
          )}
          {routeGlow > 0 && (
            <>
              <filter
                id="gpx-route-glow"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation={8 * (routeGlow / 100)}
                  result="blur"
                />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter
                id="gpx-runner-glow"
                x="-200%"
                y="-200%"
                width="500%"
                height="500%"
              >
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation={12 * (routeGlow / 100)}
                  result="blur"
                />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </>
          )}
        </defs>

        {/* Previous route dim trail */}
        {prevPath && (
          <path
            d={prevPath}
            fill="none"
            stroke={routeColor}
            strokeWidth={routeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.4}
          />
        )}

        {/* Route shadow (soft blur underneath) */}
        {routeShadow > 0 && !isPointOnly && (
          <path
            d={svgPath}
            fill="none"
            stroke={`rgba(0,0,0,${0.5 * (routeShadow / 100)})`}
            strokeWidth={routeWidth + 20 * (routeShadow / 100)}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            strokeDashoffset={dashOffset}
            filter="url(#gpx-route-shadow)"
          />
        )}

        {/* Route casing (dark outline) */}
        {routeCasing > 0 && !isPointOnly && (
          <path
            d={svgPath}
            fill="none"
            stroke={`rgba(0,0,0,${0.6 * (routeCasing / 100)})`}
            strokeWidth={routeWidth + 6 * (routeCasing / 100)}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            strokeDashoffset={dashOffset}
          />
        )}

        {/* Route line */}
        {!isPointOnly && (
          <path
            d={svgPath}
            fill="none"
            stroke={routeColor}
            strokeWidth={routeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            strokeDashoffset={dashOffset}
            filter={routeGlow > 0 ? "url(#gpx-route-glow)" : undefined}
          />
        )}

        {/* Runner dot */}
        {(isPointOnly || easedDraw > 0 || reverseDrawing) && dotSize > 0 && (() => {
          const ds = dotSize / 100;
          const glowR = 32 * ds;
          const innerR = 15 * ds;
          const strokeW = 6 * ds;
          return (
            <>
              {routeGlow > 0 && (
                <circle
                  cx={currentPoint.x}
                  cy={currentPoint.y}
                  r={glowR}
                  fill={routeColor}
                  opacity={glowPulse}
                  filter="url(#gpx-runner-glow)"
                />
              )}
              <circle
                cx={currentPoint.x}
                cy={currentPoint.y}
                r={innerR}
                fill="#ffffff"
                stroke={routeColor}
                strokeWidth={strokeW}
              />
            </>
          );
        })()}
      </svg>
      </div>{/* end camera zoom wrapper */}

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />

      {/* HUD */}
      {(showDistance || showElevation) && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 80,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            zIndex: 10,
          }}
        >
          {showDistance && (
            <div
              style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: 120,
                fontWeight: 700,
                color: "white",
                textShadow:
                  "0 3px 20px rgba(0,0,0,0.95), 0 0px 6px rgba(0,0,0,0.6)",
                lineHeight: 1,
              }}
            >
              {distanceLabel || "↔"} {currentDistanceKm.toFixed(1)} km
            </div>
          )}
          {showElevation && (
            <div
              style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: 72,
                fontWeight: 500,
                color: "rgba(255,255,255,0.85)",
                textShadow:
                  "0 2px 12px rgba(0,0,0,0.9), 0 0px 4px rgba(0,0,0,0.5)",
                lineHeight: 1,
              }}
            >
              {elevationLabel || "↑"} {Math.round(cumulativeElevGain).toLocaleString()} m
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
