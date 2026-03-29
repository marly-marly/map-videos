/**
 * GPXSegment — Self-service Remotion composition for any GPX route.
 *
 * Drop a .gpx file into public/, set the filename in props, configure
 * start/end km, style, and HUD options in Remotion Studio's sidebar.
 */
import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  AbsoluteFill,
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
import { computeViewport, coordsToPixels } from "../lib/tile-viewport";
import { TileMapBackground } from "./TileMapBackground";

export const gpxSegmentSchema = z.object({
  gpxFile: z.string().describe("GPX filename in public/ folder"),
  startKm: z.number().min(0).describe("Start km (0 = route start)"),
  endKm: z.number().min(0).describe("End km (9999 = full route)"),
  durationSeconds: z.number().min(1).max(300).describe("Duration in seconds"),
  // Map tiles
  provider: z.enum(["esri", "bing", "hillshade", "ocean-composite", "cartodark"]).describe("Map tile provider (start)"),
  providerEnd: z.enum(["esri", "bing", "hillshade", "ocean-composite", "cartodark"]).describe("Map tile provider (end) — same = no transition"),
  tileTransitionStart: z.number().min(0).max(100).describe("Tile crossfade begins at % of duration"),
  tileTransitionEnd: z.number().min(0).max(100).describe("Tile crossfade ends at % of duration"),
  zoom: z.number().min(10).max(19).describe("Tile zoom (19=max detail, 14=overview)"),
  zoomReduction: z.number().min(0).max(5).describe("Reduce tile zoom for the zoomed-out provider (0 = same, 2 = 2 levels lower)"),
  // Camera zoom
  cameraStartZoom: z.number().min(1).max(1000).describe("Camera zoom % (100 = default, 1 = extreme wide, 1000 = 10x in)"),
  cameraEndZoom: z.number().min(1).max(1000).describe("Camera zoom % (100 = default, 1 = extreme wide, 1000 = 10x in)"),
  cameraZoomDelay: z.number().min(0).max(100).describe("Delay before zoom starts (% of duration)"),
  cameraZoomEndDelay: z.number().min(0).max(100).describe("Freeze zoom before end (% of duration)"),
  cameraAnchorX: z.number().min(0).max(100).describe("Camera zoom pivot X (% from left)"),
  cameraAnchorY: z.number().min(0).max(100).describe("Camera zoom pivot Y (% from top)"),
  // Viewport
  padding: z.number().min(0).max(2).describe("Padding around segment (0.35 = 35%)"),
  offsetX: z.number().min(-500).max(500).describe("Viewport shift X (% of view width)"),
  offsetY: z.number().min(-500).max(500).describe("Viewport shift Y (% of view height)"),
  // Route
  routeColor: z.string().describe("Route line color"),
  routeWidth: z.number().min(1).max(50).describe("Route line width"),
  dotSize: z.number().min(0).max(200).describe("Leading dot size (0 = hidden, 100 = default)"),
  dotPulseSpeed: z.number().min(0).max(500).describe("Dot flash speed (0 = no pulse, 100 = default, 500 = fast)"),
  routeGlow: z.number().min(0).max(200).describe("Route glow intensity (0 = off, 100 = default, 200 = intense)"),
  routeCasing: z.number().min(0).max(200).describe("Dark outline around route (0 = off, 100 = default)"),
  showPreviousRoute: z.boolean().describe("Show dim trail of previous route"),
  // HUD
  showHud: z.boolean().describe("Show distance + elevation HUD"),
});

export interface GPXSegmentProps {
  /** GPX filename in public/ folder */
  gpxFile: string;
  /** Start km (0 = route start) */
  startKm: number;
  /** End km (use a large number like 9999 for full route) */
  endKm: number;
  /** Map provider */
  provider: "esri" | "bing" | "hillshade" | "ocean-composite" | "cartodark";
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
  /** Show distance + elevation HUD */
  showHud: boolean;
  /** Show dim trail of previous route */
  showPreviousRoute: boolean;
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
  /** Tile provider to transition TO (same as provider = no transition) */
  providerEnd: "esri" | "bing" | "hillshade" | "ocean-composite" | "cartodark";
  /** When tile crossfade begins (0-100 % of duration) */
  tileTransitionStart: number;
  /** When tile crossfade completes (0-100 % of duration) */
  tileTransitionEnd: number;
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
  routeColor,
  routeWidth,
  dotSize,
  dotPulseSpeed,
  routeGlow,
  routeCasing,
  showHud,
  showPreviousRoute,
  zoom,
  zoomReduction,
  padding,
  offsetX,
  offsetY,
  providerEnd,
  tileTransitionStart,
  tileTransitionEnd,
  cameraStartZoom,
  cameraEndZoom,
  cameraZoomDelay,
  cameraZoomEndDelay,
  cameraAnchorX,
  cameraAnchorY,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();

  // Load and parse GPX file
  const [gpxData, setGpxData] = useState<string | null>(null);

  useEffect(() => {
    fetch(staticFile(gpxFile))
      .then((r) => r.text())
      .then((text) => {
        setGpxData(text);
      })
      .catch(() => {
        console.error(`Failed to load GPX file: ${gpxFile}`);
      });
  }, [gpxFile]);

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
  const effectivePadding = minCameraScale < 1 ? padding / minCameraScale : padding;

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

  // Second viewport for tile transition (only when providers differ)
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

  // Path measurement
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [svgPath]);

  // Animation progress
  const progress = frame / durationInFrames;
  const drawEnd = 0.85;
  const easedDraw = Math.min(1, Math.max(0, progress / drawEnd));
  const dashOffset =
    pathLength > 0 ? pathLength * (1 - easedDraw) : pathLength;

  // Runner dot
  const currentPoint = useMemo(() => {
    if (!pathRef.current || pathLength === 0) return { x: 0, y: 0 };
    const pt = pathRef.current.getPointAtLength(pathLength * easedDraw);
    return { x: pt.x, y: pt.y };
  }, [easedDraw, pathLength]);

  // Distance
  const segmentLengthKm = segment?.segmentLengthKm ?? 0;
  const currentDistanceKm = startKm + segmentLengthKm * easedDraw;

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
  const delayStart = cameraZoomDelay / 100;
  const delayEnd = cameraZoomEndDelay / 100;
  const zoomWindow = 1 - delayStart - delayEnd;
  const linearProgress = zoomWindow <= 0
    ? 0
    : Math.min(1, Math.max(0, (frame / durationInFrames - delayStart) / zoomWindow));
  // Smoothstep ease-in-out: gradual acceleration and deceleration
  const cameraProgress = linearProgress * linearProgress * (3 - 2 * linearProgress);
  const startZ = cameraStartZoom / 100;
  const endZ = cameraEndZoom / 100;
  const rawZoom = startZ + (endZ - startZ) * cameraProgress;
  const cameraZoom = rawZoom / minCameraScale; // normalize: minScale→1.0, maxScale→max/min

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
          transformOrigin: `${cameraAnchorX}% ${cameraAnchorY}%`,
        }}
      >
      {/* Map tiles — start provider */}
      <TileMapBackground
        viewport={viewport}
        style={
          provider === "ocean-composite" ? "ocean-composite" : "satellite"
        }
      />

      {/* Map tiles — end provider (crossfade on top) */}
      {hasTileTransition && viewportEnd && (() => {
        const startF = (tileTransitionStart / 100) * durationInFrames;
        const endF = (tileTransitionEnd / 100) * durationInFrames;
        const endOpacity = endF > startF
          ? interpolate(frame, [startF, endF], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 1;
        return (
          <TileMapBackground
            viewport={viewportEnd}
            style={providerEnd === "ocean-composite" ? "ocean-composite" : "satellite"}
            opacity={endOpacity}
          />
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

        {/* Route casing (dark outline) */}
        {routeCasing > 0 && (
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
        <path
          ref={pathRef}
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

        {/* Runner dot */}
        {easedDraw > 0 && dotSize > 0 && (() => {
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
      {showHud && (
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
            ↔ {currentDistanceKm.toFixed(1)} km
          </div>
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
            ↑ {Math.round(cumulativeElevGain).toLocaleString()} m
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
