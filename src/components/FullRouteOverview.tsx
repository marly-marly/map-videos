import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  interpolate,
} from "remotion";
import type { SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/full-route-overview-meta.json";

const typedMeta = meta as unknown as SegmentMeta;

// Scale raw distance to match our calibrated total
const DISPLAY_TOTAL_KM = 71.83;
const KM_SCALE = DISPLAY_TOTAL_KM / typedMeta.segmentLengthKm;


export const FullRouteOverview: React.FC<{ showHud?: boolean }> = ({ showHud = true }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();
  const m = typedMeta;

  const progress = frame / durationInFrames;

  // --- Animation phases ---
  const drawEnd = 0.7;
  const holdEnd = 0.8;
  // fadeEnd = 1.0

  // Draw progress: 0→1 over 0–70%
  const drawProgress = Math.min(1, Math.max(0, progress / drawEnd));

  // Map opacity: full during draw+hold, fades out 80–100%
  const mapOpacity = interpolate(progress, [holdEnd, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // HUD opacity: fades out during 75–90%
  const hudOpacity = interpolate(progress, [0.75, 0.9], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Route glow intensity: normal during draw, intensifies as map fades
  const glowIntensity = interpolate(progress, [holdEnd, 1], [8, 20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Route line opacity: always visible
  const routeOpacity = interpolate(progress, [0.95, 1], [1, 0.9], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Vignette intensity
  const vignetteOpacity = interpolate(progress, [holdEnd, 1], [0.5, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Build SVG path
  const svgPath = useMemo(() => {
    const pts = m.segmentPoints;
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  }, [m]);

  // Previous route path (none for full overview)
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [svgPath]);

  const dashOffset = pathLength > 0 ? pathLength * (1 - drawProgress) : pathLength;

  // Runner dot position
  const currentPoint = useMemo(() => {
    if (!pathRef.current || pathLength === 0) return { x: 0, y: 0 };
    const pt = pathRef.current.getPointAtLength(pathLength * drawProgress);
    return { x: pt.x, y: pt.y };
  }, [drawProgress, pathLength]);

  // Distance display (scaled)
  const currentDistanceKm = DISPLAY_TOTAL_KM * drawProgress;

  // Elevation gain
  const cumulativeElevGain = useMemo(() => {
    const dists = m.segmentDistances;
    const elevs = m.segmentElevations;
    const targetDist = m.segmentLengthKm * drawProgress;
    let gain = 0;
    for (let i = 1; i < elevs.length; i++) {
      if (dists[i] > targetDist) {
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
    const ELEV_GAIN_SCALE = 2889 / 2853;
    return gain * ELEV_GAIN_SCALE;
  }, [drawProgress, m]);

  // Pulsing glow on runner dot
  const glowPulse = 0.4 + 0.3 * Math.sin((frame / fps) * Math.PI * 2);

  // During logo phase, subtle pulse on the route line
  const logoPulse = progress > holdEnd
    ? 0.85 + 0.15 * Math.sin((frame / fps) * Math.PI * 1.5)
    : 1;

  // Show runner dot only during draw phase
  const showRunner = drawProgress > 0 && drawProgress < 1;


  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Terrain map background */}
      <img
        src={staticFile("full-route-overview-composite.png")}
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
        viewBox={`0 0 ${m.outputWidth} ${m.outputHeight}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          opacity: routeOpacity * logoPulse,
        }}
      >
        <defs>
          <filter id="overview-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={glowIntensity} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="overview-runner-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Route casing (dark outline) */}
        <path
          d={svgPath}
          fill="none"
          stroke="rgba(0,0,0,0.6)"
          strokeWidth={14}
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
          stroke="#ff4444"
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
          filter="url(#overview-glow)"
        />

        {/* Runner dot */}
        {showRunner && (
          <>
            <circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r={16}
              fill="#ff4444"
              opacity={glowPulse}
              filter="url(#overview-runner-glow)"
            />
            <circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r={7}
              fill="#ffffff"
              stroke="#ff4444"
              strokeWidth={4}
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
          background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${vignetteOpacity}) 100%)`,
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
            opacity: hudOpacity,
          }}
        >
          <div
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: 120,
              fontWeight: 700,
              color: "white",
              textShadow: "0 3px 20px rgba(0,0,0,0.95), 0 0px 6px rgba(0,0,0,0.6)",
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
              textShadow: "0 2px 12px rgba(0,0,0,0.9), 0 0px 4px rgba(0,0,0,0.5)",
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
