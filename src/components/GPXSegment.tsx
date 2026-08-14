/**
 * GPXSegment — Self-service Remotion composition for any GPX route.
 *
 * Drop a .gpx file into public/, set the filename in props, configure
 * start/end km, style, and HUD options in Remotion Studio's sidebar.
 */
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { getPreviousRouteCoords } from "../lib/route-processor";
import {
  computeViewport,
  coordsToPixels,
  mapProviderEnum,
  mapProviderOptionalEnum,
  blendModeEnum,
} from "../lib/tile-viewport";
import {
  computePathMetrics,
  elevationGainAtDraw,
  glowPulseOpacity,
  pointAtDrawFraction,
  polylineToPath,
  scaledDistanceAtDraw,
} from "../lib/route-geometry";
import { useGpxSegment } from "../hooks/useGpxSegment";
import { TileMapBackground } from "./TileMapBackground";

// ---- Prop groups ----------------------------------------------------------
// Nested z.object() groups render as collapsible sections in Remotion Studio's
// props panel. The `.describe()` on each group becomes the section tooltip.
// Keep per-field descriptions so each control still has its own help text.

const routeGroup = z.object({
  gpxFile: z.string().describe("GPX filename in public/ folder"),
  startKm: z.number().min(0).describe("Start km (0 = route start, decimals allowed e.g. 3.45). If startKm === endKm the dot stays frozen at this km."),
  endKm: z.number().min(0).describe("End km (9999 = full route, decimals allowed e.g. 5.8). If startKm === endKm no line draws — dot stays still."),
  durationSeconds: z.number().min(1).max(300).describe("Duration in seconds"),
});

// Map tiles — up to three providers render in sequence:
//   providerStart → provider → providerEnd
const mapGroup = z.object({
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
});

// Camera framing — zoom ramp, anchor, tracking, and viewport offsets.
const cameraGroup = z.object({
  cameraStartZoom: z.number().min(1).max(1000).describe("Camera zoom % (100 = default, 1 = extreme wide, 1000 = 10x in)"),
  cameraEndZoom: z.number().min(1).max(1000).describe("Camera zoom % (100 = default, 1 = extreme wide, 1000 = 10x in)"),
  cameraZoomDelay: z.number().min(0).max(100).describe("Delay before zoom starts (% of duration)"),
  cameraZoomEndDelay: z.number().min(0).max(100).describe("Zoom ends at this % of duration (must be > cameraZoomDelay)"),
  cameraAnchorX: z.number().min(0).max(100).describe("Camera zoom pivot X (% from left)"),
  cameraAnchorY: z.number().min(0).max(100).describe("Camera zoom pivot Y (% from top)"),
  cameraAnchorMode: z.enum(["center", "start", "end", "dot"]).describe("Where camera zooms toward (center=default, dot=follows the moving dot)"),
  cameraTracking: z.enum(["animated", "still"]).describe("animated = zoom + anchor follow per props, still = camera locked at start zoom, no movement"),
  padding: z.number().min(0).max(200).describe("Padding around segment (% — 35 = default)"),
  offsetX: z.number().min(-500).max(500).describe("Viewport shift X (% of view width)"),
  offsetY: z.number().min(-500).max(500).describe("Viewport shift Y (% of view height)"),
});

// Route line + runner dot styling, plus undraw/previous-trail toggles.
const lineGroup = z.object({
  routeColor: z.string().describe("Route line color"),
  routeWidth: z.number().min(1).max(50).describe("Route line width"),
  dotSize: z.number().min(0).max(200).describe("Leading dot size (0 = hidden, 100 = default)"),
  dotPulseSpeed: z.number().min(0).max(500).describe("Dot flash speed (0 = no pulse, 100 = default, 500 = fast)"),
  routeGlow: z.number().min(0).max(200).describe("Route glow intensity (0 = off, 100 = default, 200 = intense)"),
  routeCasing: z.number().min(0).max(200).describe("Dark outline around route (0 = off, 100 = default)"),
  routeShadow: z.number().min(0).max(200).describe("Soft shadow under route (0 = off, 50 = subtle, 100 = default)"),
  showPreviousRoute: z.boolean().describe("Show dim trail of previous route"),
  reverseDrawing: z.boolean().describe("Start fully drawn, undraw over time"),
});

// Color-wash fades layered above tiles but beneath the route.
const fadeGroup = z.object({
  fadeInColor: z.string().describe("Fade in from this color at start (empty = no fade in)"),
  fadeOutColor: z.string().describe("Fade out to this color at end (empty = no fade out)"),
  fadeInOutLength: z.number().min(0).max(60).describe("Fade duration in seconds (applies to both in + out; 0 = off)"),
});

const hudGroup = z.object({
  distanceScale: z.number().min(50).max(200).describe("Scale km counter to match Strava (100=as-is, 112=for route.gpx)"),
  showDistance: z.boolean().describe("Show distance counter"),
  showElevation: z.boolean().describe("Show elevation counter"),
  distanceLabel: z.string().describe("Distance label (empty = ↔)"),
  elevationLabel: z.string().describe("Elevation label (empty = ↑)"),
});

export const gpxSegmentSchema = z.object({
  route: routeGroup.describe("Which GPX slice and for how long"),
  map: mapGroup.describe("Tile providers + optional era crossfades"),
  camera: cameraGroup.describe("How the camera frames the scene"),
  line: lineGroup.describe("Route line and runner dot styling"),
  fade: fadeGroup.describe("Color fade in/out overlays"),
  hud: hudGroup.describe("On-screen labels"),
});

export type GPXSegmentProps = z.infer<typeof gpxSegmentSchema>;

export const GPXSegment: React.FC<GPXSegmentProps> = (props) => {
  const { gpxFile, startKm, endKm } = props.route;
  const {
    providerStart,
    providerStart2,
    providerStart2BlendMode,
    providerStartTransitionStart,
    providerStartTransitionEnd,
    provider,
    provider2,
    provider2BlendMode,
    providerEnd,
    providerEnd2,
    providerEnd2BlendMode,
    tileTransitionStart,
    tileTransitionEnd,
    zoom,
    zoomReduction,
  } = props.map;
  const {
    cameraStartZoom,
    cameraEndZoom,
    cameraZoomDelay,
    cameraZoomEndDelay,
    cameraAnchorX,
    cameraAnchorY,
    cameraAnchorMode,
    cameraTracking,
    padding,
    offsetX,
    offsetY,
  } = props.camera;
  const {
    routeColor,
    routeWidth,
    dotSize,
    dotPulseSpeed,
    routeGlow,
    routeCasing,
    routeShadow,
    showPreviousRoute,
    reverseDrawing,
  } = props.line;
  const { fadeInColor, fadeOutColor, fadeInOutLength } = props.fade;
  const {
    distanceScale,
    showDistance,
    showElevation,
    distanceLabel,
    elevationLabel,
  } = props.hud;

  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();

  // Load the GPX file, process the route, and slice out startKm→endKm.
  // The hook owns the delayRender handshake so no frame is captured until the
  // fetch resolves.
  const { gpxData, route, segment } = useGpxSegment(gpxFile, startKm, endKm);

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
  const svgPath = useMemo(() => polylineToPath(segmentPoints), [segmentPoints]);

  const prevPath = useMemo(() => polylineToPath(previousPoints), [previousPoints]);

  // Path measurement — computed synchronously from segmentPoints so the dot
  // never lags a frame behind the line (see computePathMetrics for why).
  const pathMetrics = useMemo(
    () => computePathMetrics(segmentPoints),
    [segmentPoints]
  );

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
  // A zero-length segment has no line to walk, so the dot is pinned to the one
  // point instead; pointAtDrawFraction would otherwise divide by a zero total.
  const currentPoint = useMemo(() => {
    if (isPointOnly && segmentPoints.length > 0) {
      return { x: segmentPoints[0].x, y: segmentPoints[0].y };
    }
    return pointAtDrawFraction(segmentPoints, pathMetrics, easedDraw);
  }, [easedDraw, pathMetrics, isPointOnly, segmentPoints]);

  // Read distance from actual segmentDistances (which skips ferry gaps)
  const currentDistanceKm = useMemo(() => {
    if (!segment) return startKm;
    return scaledDistanceAtDraw(
      segment.segmentDistances,
      startKm,
      easedDraw,
      distanceScale
    );
  }, [segment, startKm, easedDraw, distanceScale]);

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

  const glowPulse = glowPulseOpacity(dotPulseSpeed, frame, fps);

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
          {hasProviderStart2 && viewportStart2 && (
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
