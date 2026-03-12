import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Easing,
  interpolate,
} from "remotion";
import staticMapMeta from "../data/static-map-meta.json";

export interface StaticRouteVideoProps {
  routeColor: string;
  routeWidth: number;
}

interface SegmentMeta {
  segmentPoints: { x: number; y: number }[];
  segmentDistances: number[];
  segmentElevations: number[];
  segmentLengthKm: number;
  segmentStartKm: number;
  peakElevation: number;
  outputWidth: number;
  outputHeight: number;
}

const meta = staticMapMeta as unknown as SegmentMeta;

export const StaticRouteVideo: React.FC<StaticRouteVideoProps> = ({
  routeColor,
  routeWidth,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();

  // Build SVG path from segment points
  const svgPath = useMemo(() => {
    const pts = meta.segmentPoints;
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  }, []);

  // Measure the SVG path length on first render
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [svgPath]);

  // Animation timing
  // 0-8%: fade in map, pause
  // 8-92%: draw the line
  // 92-100%: hold complete, fade out
  const fadeInEnd = 0.08;
  const drawStart = 0.08;
  const drawEnd = 0.92;
  const fadeOutStart = 0.92;

  const progress = frame / durationInFrames;

  // Map fade in
  const mapOpacity = interpolate(progress, [0, fadeInEnd * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Line drawing progress (0 to 1)
  const drawProgress = interpolate(
    progress,
    [drawStart, drawEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  // Apply easing for cinematic feel — slow start, steady middle, slow end
  const easedDraw =
    drawProgress < 0.1
      ? interpolate(drawProgress, [0, 0.1], [0, 0.1], {
          easing: Easing.out(Easing.cubic),
          extrapolateRight: "clamp",
        })
      : drawProgress > 0.9
        ? interpolate(drawProgress, [0.9, 1], [0.9, 1], {
            easing: Easing.in(Easing.cubic),
            extrapolateRight: "clamp",
          })
        : drawProgress;

  // Calculate stroke-dashoffset
  const dashOffset = pathLength > 0 ? pathLength * (1 - easedDraw) : pathLength;

  // Current position along the path (for runner dot)
  const currentPoint = useMemo(() => {
    if (!pathRef.current || pathLength === 0) return { x: 0, y: 0 };
    const pt = pathRef.current.getPointAtLength(pathLength * easedDraw);
    return { x: pt.x, y: pt.y };
  }, [easedDraw, pathLength]);

  // Current distance and elevation (interpolated)
  const currentDistanceKm = useMemo(() => {
    return meta.segmentStartKm + meta.segmentLengthKm * easedDraw;
  }, [easedDraw]);

  const currentElevation = useMemo(() => {
    const dists = meta.segmentDistances;
    const elevs = meta.segmentElevations;
    const targetDist = meta.segmentLengthKm * easedDraw;
    if (targetDist <= 0) return elevs[0];
    if (targetDist >= dists[dists.length - 1]) return elevs[elevs.length - 1];
    for (let i = 1; i < dists.length; i++) {
      if (dists[i] >= targetDist) {
        const t =
          (targetDist - dists[i - 1]) / (dists[i] - dists[i - 1]);
        return elevs[i - 1] + t * (elevs[i] - elevs[i - 1]);
      }
    }
    return elevs[elevs.length - 1];
  }, [easedDraw]);

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
    return gain;
  }, [easedDraw]);

  // Fade out at end
  const overlayOpacity = interpolate(
    progress,
    [fadeOutStart, 1],
    [0, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Pulsing glow on the runner dot
  const glowPulse = 0.4 + 0.3 * Math.sin((frame / fps) * Math.PI * 2);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Satellite map background */}
      <img
        src={staticFile("static-map.png")}
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
          {currentDistanceKm.toFixed(1)} km
        </div>
        <div
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 48,
            fontWeight: 400,
            color: "rgba(255,255,255,0.85)",
            textShadow:
              "0 2px 12px rgba(0,0,0,0.9), 0 0px 4px rgba(0,0,0,0.5)",
            lineHeight: 1,
          }}
        >
          {Math.round(currentElevation)}m elev
        </div>
        <div
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 48,
            fontWeight: 400,
            color: "rgba(255,255,255,0.85)",
            textShadow:
              "0 2px 12px rgba(0,0,0,0.9), 0 0px 4px rgba(0,0,0,0.5)",
            lineHeight: 1,
          }}
        >
          +{Math.round(cumulativeElevGain)}m gain
        </div>
      </div>

      {/* End fade overlay */}
      {overlayOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: `rgba(10, 10, 10, ${overlayOpacity})`,
            zIndex: 20,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
