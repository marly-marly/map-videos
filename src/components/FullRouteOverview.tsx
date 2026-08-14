/**
 * FullRouteOverview — the whole 72 km route drawn over a static terrain composite.
 *
 * One prop-driven component covering every overview variant we render: colour
 * or greyscale terrain, with or without the distance/elevation HUD, and with or
 * without the five named summits labelled along the route. It replaces the old
 * FullRouteOverview / FullRouteOverviewBW / FullRouteOverviewPeaks trio, which
 * were ~95% copy-paste of each other.
 */
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  interpolate,
} from "remotion";
import { z } from "zod";
import type { SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/full-route-overview-meta.json";

// ---- Schema ---------------------------------------------------------------
// Flat, unlike GPXSegment/IndyTracker: there are only four knobs here, so
// Studio's props panel reads better without collapsible sections. Fields are
// required (not `.default()`) so every Composition states its variant
// explicitly in defaultProps, the same way the other schema-driven
// compositions in Root.tsx do.

export const fullRouteOverviewSchema = z.object({
  showHud: z.boolean().describe("Show the distance + elevation gain counters"),
  showPeaks: z.boolean().describe("Label the five named summits along the route"),
  grayscale: z.boolean().describe("Desaturate the terrain (the route line stays coloured)"),
  routeColor: z.string().describe("Route line and runner dot color"),
});

export type FullRouteOverviewProps = z.infer<typeof fullRouteOverviewSchema>;

const typedMeta = meta as unknown as SegmentMeta;

// Calibrated total for the HUD — the raw track measures slightly differently.
const DISPLAY_TOTAL_KM = 71.83;

// Calibration so the HUD's gain reads as the figure we publish (2889 m) rather
// than the raw sum of the track's positive deltas (2853 m).
const ELEV_GAIN_SCALE = 2889 / 2853;

/** Named summits labelled along the route (showPeaks), in km order. */
const PEAKS = [
  { en: "Devil's Peak", zh: "魔鬼山", km: 7.06, elev: 214, labelSide: "right" as const },
  { en: "Mount Butler", zh: "畢拿山", km: 15.96, elev: 419, labelSide: "left" as const },
  { en: "The Twins", zh: "孖崗山", km: 23.81, elev: 377, labelSide: "right" as const },
  { en: "Mount Nicholson", zh: "聶高信山", km: 32.80, elev: 417, labelSide: "left" as const },
  { en: "Beacon Hill", zh: "筆架山", km: 50.49, elev: 440, labelSide: "right" as const },
];

export const FullRouteOverview: React.FC<FullRouteOverviewProps> = ({
  showHud,
  showPeaks,
  grayscale,
  routeColor,
}) => {
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

  // The greyscale variant is the *same* PNG with a CSS filter, not a separate
  // asset — and two numbers were tuned alongside that filter rather than being
  // knobs of their own: flat grey terrain needs a tighter glow and a darker
  // casing for the line to stay legible. Deriving both from `grayscale` keeps
  // the registered compositions pure flag combinations, with no numeric
  // defaults to keep in sync across five <Composition> entries.
  const terrainFilter = grayscale
    ? "grayscale(100%) contrast(1.1) brightness(0.9)"
    : undefined;
  const glowRange: [number, number] = grayscale ? [6, 16] : [8, 20];
  const casingColor = grayscale ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.6)";

  // Filter ids have to be unique per rendered document. The glow filter bakes
  // in glowIntensity, which differs between the two terrain treatments, so the
  // id is scoped by variant — instances that share an id also share an
  // intensity, so sharing the filter is harmless.
  const glowId = grayscale ? "overview-glow-bw" : "overview-glow";

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
  const glowIntensity = interpolate(progress, [holdEnd, 1], glowRange, {
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

  // Path measurement — computed synchronously from the same points we build
  // `d` from, as IndyTracker does. The three predecessors measured with
  // SVGPathElement.getTotalLength() inside a useEffect, so on the very first
  // render pathLength was still 0: that emitted stroke-dasharray="0", which SVG
  // reads as "no dashing at all", flashing the entire route in solid on frame 0
  // instead of undrawn — while currentPoint hit its pathLength === 0 guard and
  // parked the runner dot at (0,0). It bit frame 0, `remotion still`, and every
  // remount. The path is a pure polyline (M/L only), so summing segment lengths
  // yields exactly the arc length getTotalLength() would have returned — the
  // pixel units that drive dashoffset and the dot are unchanged.
  const pathMetrics = useMemo(() => {
    const pts = m.segmentPoints;
    if (pts.length < 2) return { totalLength: 0, cumLengths: [0] };
    const cumLengths: number[] = [0];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      cumLengths.push(total);
    }
    return { totalLength: total, cumLengths };
  }, [m]);

  const pathLength = pathMetrics.totalLength;
  const dashOffset = pathLength * (1 - drawProgress);

  // Runner dot position — binary-search the polyline to the drawn pixel
  // distance, so the dot sits exactly where the dash pattern ends.
  const currentPoint = useMemo(() => {
    const pts = m.segmentPoints;
    if (pts.length === 0) return { x: 0, y: 0 };
    if (pts.length === 1) return { x: pts[0].x, y: pts[0].y };
    const target = pathMetrics.totalLength * drawProgress;
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
      x: pts[lo].x + t * (pts[hi].x - pts[lo].x),
      y: pts[lo].y + t * (pts[hi].y - pts[lo].y),
    };
  }, [m, drawProgress, pathMetrics]);

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

  // Peak positions in pixel coords. Nearest-distance scan over segmentDistances
  // (runs once — the points are a static module constant).
  // Note drawFraction is a *km* fraction while drawProgress is the time/pixel
  // draw fraction, so a label can appear a hair before or after the dot reaches
  // its summit. That is how the shipped Peaks video reads; left as-is.
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
      {/* Terrain map background — one composite PNG, optionally desaturated */}
      <img
        src={staticFile("full-route-overview-composite.png")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: mapOpacity,
          filter: terrainFilter,
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
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
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
          stroke={casingColor}
          strokeWidth={14}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
        />

        {/* Route line with glow */}
        <path
          d={svgPath}
          fill="none"
          stroke={routeColor}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
          filter={`url(#${glowId})`}
        />

        {/* Runner dot */}
        {showRunner && (
          <>
            <circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r={16}
              fill={routeColor}
              opacity={glowPulse}
              filter="url(#overview-runner-glow)"
            />
            <circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r={7}
              fill="#ffffff"
              stroke={routeColor}
              strokeWidth={4}
            />
          </>
        )}

        {/* Peak markers — revealed as the line reaches them, and fading out
            with the terrain in the last 20% (peakOpacity folds in mapOpacity) */}
        {showPeaks && peakPositions.map((peak, i) => {
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
