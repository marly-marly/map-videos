import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";

export interface CameraEffect {
  /** Starting zoom level (1 = no zoom, 1.2 = 20% zoomed in) */
  startZoom: number;
  /** Ending zoom level */
  endZoom: number;
  /** Anchor point for zoom: 0-1 range, e.g. [0.5, 0.5] = center */
  anchor?: [number, number];
}

export interface RouteSegmentVideoProps {
  routeColor: string;
  routeWidth: number;
  mapFile: string;
  metaData: SegmentMeta;
  cameraEffect?: CameraEffect;
}

export interface SegmentMeta {
  segmentPoints: { x: number; y: number }[];
  previousRoutePoints?: { x: number; y: number }[];
  segmentDistances: number[];
  segmentElevations: number[];
  segmentLengthKm: number;
  segmentStartKm: number;
  peakElevation: number;
  segmentStartElevGain: number;
  outputWidth: number;
  outputHeight: number;
}

export const RouteSegmentVideo: React.FC<RouteSegmentVideoProps> = ({
  routeColor,
  routeWidth,
  mapFile,
  metaData,
  cameraEffect,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();
  const meta = metaData;

  // Build SVG path from segment points
  const svgPath = useMemo(() => {
    const pts = meta.segmentPoints;
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  }, [meta]);

  // Build SVG path for previous route (before this segment)
  const prevPath = useMemo(() => {
    const pts = meta.previousRoutePoints;
    if (!pts || pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  }, [meta]);

  // Measure the SVG path length on first render
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [svgPath]);

  const progress = frame / durationInFrames;

  // No fade — always fully visible
  const mapOpacity = 1;

  // Line drawing: finish at 85% of duration, hold still for the last 15%
  const drawEnd = 0.85;
  const easedDraw = Math.min(1, Math.max(0, progress / drawEnd));

  // Calculate stroke-dashoffset
  const dashOffset = pathLength > 0 ? pathLength * (1 - easedDraw) : pathLength;

  // Current position along the path (for runner dot)
  const currentPoint = useMemo(() => {
    if (!pathRef.current || pathLength === 0) return { x: 0, y: 0 };
    const pt = pathRef.current.getPointAtLength(pathLength * easedDraw);
    return { x: pt.x, y: pt.y };
  }, [easedDraw, pathLength]);

  // Current distance (interpolated)
  const currentDistanceKm = useMemo(() => {
    return meta.segmentStartKm + meta.segmentLengthKm * easedDraw;
  }, [easedDraw, meta]);

  // Cumulative positive elevation gain
  const cumulativeElevGain = useMemo(() => {
    const dists = meta.segmentDistances;
    const elevs = meta.segmentElevations;
    const targetDist = meta.segmentLengthKm * easedDraw;

    let gain = 0;
    for (let i = 1; i < elevs.length; i++) {
      if (dists[i] > targetDist) {
        // Interpolate the partial segment
        if (dists[i - 1] < targetDist) {
          const t = (targetDist - dists[i - 1]) / (dists[i] - dists[i - 1]);
          const interpElev = elevs[i - 1] + t * (elevs[i] - elevs[i - 1]);
          const diff = interpElev - elevs[i - 1];
          if (diff > 0) gain += diff;
        }
        break;
      }
      const diff = elevs[i] - elevs[i - 1];
      if (diff > 0) gain += diff;
    }
    // Scale factor to match Strava's elevation gain (2889m vs computed 2853m)
    const ELEV_GAIN_SCALE = 2889 / 2853;
    return (meta.segmentStartElevGain || 0) + gain * ELEV_GAIN_SCALE;
  }, [easedDraw, meta]);

  // Pulsing glow on the runner dot
  const glowPulse = 0.4 + 0.3 * Math.sin((frame / fps) * Math.PI * 2);

  // Camera zoom effect
  const cameraZoom = cameraEffect
    ? cameraEffect.startZoom + (cameraEffect.endZoom - cameraEffect.startZoom) * progress
    : 1;
  const cameraAnchor = cameraEffect?.anchor ?? [0.5, 0.5];

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Zoomable map + route container */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: `scale(${cameraZoom})`,
          transformOrigin: `${cameraAnchor[0] * 100}% ${cameraAnchor[1] * 100}%`,
        }}
      >
      {/* Satellite map background */}
      <img
        src={staticFile(mapFile)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: mapOpacity,
        }}
      />

      {/* SVG route overlay */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${meta.outputWidth} ${meta.outputHeight}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          opacity: mapOpacity,
        }}
      >
        <defs>
          {/* Glow filter for the route line */}
          <filter id="route-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Stronger glow for the runner dot */}
          <filter
            id="runner-glow"
            x="-200%"
            y="-200%"
            width="500%"
            height="500%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Previous route — dim trail showing earlier segments */}
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
          filter="url(#route-glow)"
        />

        {/* Runner dot — outer glow */}
        {easedDraw > 0 && (
          <>
            <circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r={22}
              fill={routeColor}
              opacity={glowPulse}
              filter="url(#runner-glow)"
            />
            {/* Runner dot — white center */}
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
      </div>

      {/* Cinematic vignette */}
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

      {/* HUD: Distance counter */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 80,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          zIndex: 10,
          opacity: mapOpacity,
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

    </AbsoluteFill>
  );
};
