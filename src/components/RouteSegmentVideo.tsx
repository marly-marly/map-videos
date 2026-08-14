import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { z } from "zod";

/** Zod schema for the segment props exposed in the Remotion Studio sidebar */
export const segmentPropsSchema = z.object({
  routeColor: z.string().describe("Route line color"),
  routeWidth: z.number().min(1).max(50).describe("Route line width"),
  dotSize: z.number().min(0).max(200).describe("Leading dot size (0=hidden, 100=default)"),
  dotPulseSpeed: z.number().min(0).max(500).describe("Dot flash speed (0=static, 100=default)"),
  routeGlow: z.number().min(0).max(200).describe("Route glow (0=off, 100=default)"),
  routeCasing: z.number().min(0).max(200).describe("Dark outline (0=off, 100=default)"),
  // Tile transition: crossfade from mapFile to mapFileEnd
  mapFileEnd: z.string().describe("Second map PNG for tile transition (empty=no transition)"),
  tileTransitionStart: z.number().min(0).max(100).describe("Tile crossfade begins at % of duration"),
  tileTransitionEnd: z.number().min(0).max(100).describe("Tile crossfade ends at % of duration"),
  // HUD
  showDistance: z.boolean().describe("Show distance counter"),
  showElevation: z.boolean().describe("Show elevation gain counter"),
  distanceLabel: z.string().describe("Distance label (empty = ↔)"),
  elevationLabel: z.string().describe("Elevation label (empty = ↑)"),
});

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
  /** Leading dot size (0 = hidden, 100 = default) */
  dotSize?: number;
  /** Dot flash speed (0 = no pulse, 100 = default 1Hz) */
  dotPulseSpeed?: number;
  /** Route glow intensity (0 = off, 100 = default) */
  routeGlow?: number;
  /** Dark outline around route (0 = off, 100 = default) */
  routeCasing?: number;
  /** Second map PNG for tile transition (empty = no transition) */
  mapFileEnd?: string;
  /** Tile crossfade begins at % of duration */
  tileTransitionStart?: number;
  /** Tile crossfade ends at % of duration */
  tileTransitionEnd?: number;
  /** Show distance counter */
  showDistance?: boolean;
  /** Show elevation gain counter */
  showElevation?: boolean;
  /** Distance label (empty = ↔) */
  distanceLabel?: string;
  /** Elevation label (empty = ↑) */
  elevationLabel?: string;
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
  dotSize = 100,
  dotPulseSpeed = 100,
  routeGlow = 100,
  routeCasing = 100,
  mapFileEnd = "",
  tileTransitionStart = 0,
  tileTransitionEnd = 0,
  showDistance = true,
  showElevation = true,
  distanceLabel = "",
  elevationLabel = "",
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
  const pulseRate = dotPulseSpeed / 100;
  const glowPulse = pulseRate > 0
    ? 0.4 + 0.3 * Math.sin((frame / fps) * Math.PI * 2 * pulseRate)
    : 0.7;

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
      {/* Satellite map background — start provider.
          Remotion's <Img> (capital I), not a plain <img>: <Img> holds a
          delayRender handle until its own decode finishes. With a plain <img>
          the renderer races the PNG decode, and the same frame rendered twice
          could differ across ~74% of pixels (max channel delta 245) as the
          basemap alternated between a full and a partial decode. */}
      <Img
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

      {/* Satellite map background — end provider (crossfade on top).
          Mounted from frame 0 at opacity 0 rather than conditionally rendered
          once the crossfade starts. An <Img> that first mounts mid-timeline
          fires its delayRender there and stalls the render at that frame;
          mounting early moves the decode pause to frame 0 where it is
          invisible. Do not reinstate an `endOpacity <= 0 -> return null`
          early return here. */}
      {mapFileEnd && (() => {
        const startF = (tileTransitionStart / 100) * durationInFrames;
        const endF = (tileTransitionEnd / 100) * durationInFrames;
        const endOpacity = endF > startF
          ? interpolate(frame, [startF, endF], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 0;
        return (
          <Img
            src={staticFile(mapFileEnd)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              opacity: endOpacity * mapOpacity,
            }}
          />
        );
      })()}

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
          {routeGlow > 0 && (
            <filter id="route-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={8 * (routeGlow / 100)} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}

          {/* Stronger glow for the runner dot */}
          {routeGlow > 0 && (
            <filter
              id="runner-glow"
              x="-200%"
              y="-200%"
              width="500%"
              height="500%"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation={12 * (routeGlow / 100)} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
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
          filter={routeGlow > 0 ? "url(#route-glow)" : undefined}
        />

        {/* Runner dot */}
        {easedDraw > 0 && dotSize > 0 && (() => {
          const ds = dotSize / 100;
          return (
            <>
              <circle
                cx={currentPoint.x}
                cy={currentPoint.y}
                r={22 * ds}
                fill={routeColor}
                opacity={glowPulse}
                filter={routeGlow > 0 ? "url(#runner-glow)" : undefined}
              />
              <circle
                cx={currentPoint.x}
                cy={currentPoint.y}
                r={10 * ds}
                fill="#ffffff"
                stroke={routeColor}
                strokeWidth={5 * ds}
              />
            </>
          );
        })()}
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
            opacity: mapOpacity,
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
