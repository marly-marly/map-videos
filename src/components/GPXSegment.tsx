/**
 * GPXSegment — Self-service Remotion composition for any GPX route.
 *
 * Drop a .gpx file into public/, set the filename in props, configure
 * start/end km, style, and HUD options in Remotion Studio's sidebar.
 */
import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { parseGPX } from "../lib/gpx-browser-parser";
import {
  processRoute,
  extractSegment,
  getPreviousRouteCoords,
} from "../lib/route-processor";
import { computeViewport, coordsToPixels } from "../lib/tile-viewport";
import { TileMapBackground } from "./TileMapBackground";

export interface GPXSegmentProps {
  /** GPX filename in public/ folder */
  gpxFile: string;
  /** Start km (0 = route start) */
  startKm: number;
  /** End km (use a large number like 9999 for full route) */
  endKm: number;
  /** Map provider */
  provider: "esri" | "bing" | "hillshade" | "terrain-composite";
  /** Route line color */
  routeColor: string;
  /** Route line width */
  routeWidth: number;
  /** Show distance + elevation HUD */
  showHud: boolean;
  /** Show dim trail of previous route */
  showPreviousRoute: boolean;
  /** Tile zoom level (17 = satellite detail, 14 = overview) */
  zoom: number;
  /** Padding around segment (0.35 = 35%) */
  padding: number;
  /** Viewport shift X (fraction, e.g. 0.1 = 10% right) */
  offsetX: number;
  /** Viewport shift Y (fraction, e.g. 0.1 = 10% down) */
  offsetY: number;
  /** Duration in seconds */
  durationSeconds: number;
}

export const GPXSegment: React.FC<GPXSegmentProps> = ({
  gpxFile,
  startKm,
  endKm,
  provider,
  routeColor,
  routeWidth,
  showHud,
  showPreviousRoute,
  zoom,
  padding,
  offsetX,
  offsetY,
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

  // Compute viewport
  const viewport = useMemo(() => {
    if (!segment) return null;
    return computeViewport(segment.coords, {
      zoom,
      padding,
      offsetX,
      offsetY,
      provider: provider === "terrain-composite" ? "hillshade" : provider,
    });
  }, [segment, zoom, padding, offsetX, offsetY, provider]);

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

  const glowPulse = 0.4 + 0.3 * Math.sin((frame / fps) * Math.PI * 2);

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

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Map tiles */}
      <TileMapBackground
        viewport={viewport}
        style={
          provider === "terrain-composite" ? "terrain-composite" : "satellite"
        }
      />

      {/* SVG route overlay */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          <filter
            id="gpx-route-glow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="8"
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
              stdDeviation="12"
              result="blur"
            />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
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

        {/* Route casing */}
        <path
          d={svgPath}
          fill="none"
          stroke="rgba(0,0,0,0.6)"
          strokeWidth={routeWidth + 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
        />

        {/* Route line with glow */}
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
          filter="url(#gpx-route-glow)"
        />

        {/* Runner dot */}
        {easedDraw > 0 && (
          <>
            <circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r={22}
              fill={routeColor}
              opacity={glowPulse}
              filter="url(#gpx-runner-glow)"
            />
            <circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r={10}
              fill="#ffffff"
              stroke={routeColor}
              strokeWidth={5}
            />
          </>
        )}
      </svg>

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
