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

const DISPLAY_TOTAL_KM = 71.83;

const PEAKS = [
  { en: "Devil's Peak", zh: "魔鬼山", km: 7.06, elev: 214, labelSide: "right" as const },
  { en: "Mount Butler", zh: "畢拿山", km: 15.96, elev: 419, labelSide: "left" as const },
  { en: "The Twins", zh: "孖崗山", km: 23.81, elev: 377, labelSide: "right" as const },
  { en: "Mount Nicholson", zh: "聶高信山", km: 32.80, elev: 417, labelSide: "left" as const },
  { en: "Beacon Hill", zh: "筆架山", km: 50.49, elev: 440, labelSide: "right" as const },
];

export const FullRouteOverviewPeaks: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();
  const m = typedMeta;

  const progress = frame / durationInFrames;

  const drawEnd = 0.7;
  const holdEnd = 0.8;

  const drawProgress = Math.min(1, Math.max(0, progress / drawEnd));

  const mapOpacity = interpolate(progress, [holdEnd, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowIntensity = interpolate(progress, [holdEnd, 1], [8, 20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const routeOpacity = interpolate(progress, [0.95, 1], [1, 0.9], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const vignetteOpacity = interpolate(progress, [holdEnd, 1], [0.5, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const svgPath = useMemo(() => {
    const pts = m.segmentPoints;
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  }, [m]);

  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [svgPath]);

  const dashOffset = pathLength > 0 ? pathLength * (1 - drawProgress) : pathLength;

  const currentPoint = useMemo(() => {
    if (!pathRef.current || pathLength === 0) return { x: 0, y: 0 };
    const pt = pathRef.current.getPointAtLength(pathLength * drawProgress);
    return { x: pt.x, y: pt.y };
  }, [drawProgress, pathLength]);

  const glowPulse = 0.4 + 0.3 * Math.sin((frame / fps) * Math.PI * 2);

  const logoPulse = progress > holdEnd
    ? 0.85 + 0.15 * Math.sin((frame / fps) * Math.PI * 1.5)
    : 1;

  const showRunner = drawProgress > 0 && drawProgress < 1;

  // Peak positions in pixel coords
  const peakPositions = useMemo(() => {
    const dists = m.segmentDistances;
    const pts = m.segmentPoints;
    const totalLen = dists[dists.length - 1];
    return PEAKS.map((peak) => {
      let bestIdx = 0, bestDiff = Infinity;
      for (let i = 0; i < dists.length; i++) {
        const diff = Math.abs(dists[i] - peak.km);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
      }
      return {
        ...peak,
        x: pts[bestIdx].x,
        y: pts[bestIdx].y,
        drawFraction: peak.km / totalLen,
      };
    });
  }, [m]);

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
          <filter id="peaks-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={glowIntensity} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="peaks-runner-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Route casing */}
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
          filter="url(#peaks-glow)"
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
              filter="url(#peaks-runner-glow)"
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

        {/* Peak markers */}
        {peakPositions.map((peak, i) => {
          const appeared = drawProgress >= peak.drawFraction;
          if (!appeared) return null;

          const fadeIn = Math.min(1, (drawProgress - peak.drawFraction) / 0.03);
          const peakOpacity = fadeIn * mapOpacity;
          if (peakOpacity <= 0) return null;

          const offset = 40;
          const labelX = peak.labelSide === "right" ? peak.x + offset : peak.x - offset;
          const anchor = peak.labelSide === "right" ? "start" : "end";

          return (
            <g key={i} opacity={peakOpacity}>
              {/* Marker triangle */}
              <polygon
                points={`${peak.x},${peak.y - 24} ${peak.x - 10},${peak.y - 6} ${peak.x + 10},${peak.y - 6}`}
                fill="white"
                stroke="rgba(0,0,0,0.5)"
                strokeWidth={2}
              />
              {/* Peak dot */}
              <circle cx={peak.x} cy={peak.y} r={5} fill="white" stroke="rgba(0,0,0,0.4)" strokeWidth={1.5} />
              {/* Chinese name — stroke background */}
              <text
                x={labelX}
                y={peak.y - 16}
                textAnchor={anchor}
                fill="black"
                stroke="rgba(0,0,0,0.8)"
                strokeWidth={8}
                paintOrder="stroke"
                fontSize={32}
                fontFamily="'Courier New', Courier, monospace"
                fontWeight={700}
              >
                {peak.zh}
              </text>
              {/* Chinese name — fill */}
              <text
                x={labelX}
                y={peak.y - 16}
                textAnchor={anchor}
                fill="white"
                fontSize={32}
                fontFamily="'Courier New', Courier, monospace"
                fontWeight={700}
              >
                {peak.zh}
              </text>
              {/* English name + elevation — stroke background */}
              <text
                x={labelX}
                y={peak.y + 12}
                textAnchor={anchor}
                fill="black"
                stroke="rgba(0,0,0,0.8)"
                strokeWidth={6}
                paintOrder="stroke"
                fontSize={20}
                fontFamily="'Courier New', Courier, monospace"
                fontWeight={500}
              >
                {peak.en} ({peak.elev}m)
              </text>
              {/* English name + elevation — fill */}
              <text
                x={labelX}
                y={peak.y + 12}
                textAnchor={anchor}
                fill="rgba(255,255,255,0.85)"
                fontSize={20}
                fontFamily="'Courier New', Courier, monospace"
                fontWeight={500}
              >
                {peak.en} ({peak.elev}m)
              </text>
            </g>
          );
        })}
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
    </AbsoluteFill>
  );
};
