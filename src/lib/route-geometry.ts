/**
 * Route geometry — the pure maths behind the route-drawing compositions.
 *
 * Every function here was previously duplicated verbatim (or near-verbatim)
 * in both GPXSegment.tsx and IndyTracker.tsx. Nothing in this file touches
 * React, Remotion or the DOM, so the compositions can call it straight from a
 * useMemo body without any hook-ordering concerns.
 *
 * The comments are the point of this file as much as the code is: several of
 * them record why an obvious-looking simplification is wrong (see
 * computePathMetrics and pointAtDrawFraction in particular). Read them before
 * "tidying" anything here.
 */

/** A point in output pixel space, as returned by coordsToPixels(). */
export interface PixelPoint {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Geographic interpolation
// ---------------------------------------------------------------------------

/**
 * Find [lng, lat] at a given distance along the segment by interpolation.
 *
 * Throws on empty input rather than returning `coords[0]`. The original
 * combined the empty check with the `targetKm <= 0` early return, so an empty
 * array returned `undefined` while claiming to return `[number, number]` —
 * which then blew up further downstream at a confusing place. Callers all
 * guard on a loaded segment, so empty input means a genuine upstream bug and
 * is better surfaced here.
 */
export function findCoordsAtDistance(
  coords: [number, number][],
  distances: number[],
  targetKm: number,
): [number, number] {
  if (coords.length === 0) {
    throw new Error("findCoordsAtDistance: coords is empty");
  }
  if (targetKm <= 0) return coords[0];
  if (targetKm >= distances[distances.length - 1])
    return coords[coords.length - 1];

  // Binary search for the interval
  let lo = 0;
  let hi = distances.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (distances[mid] <= targetKm) lo = mid;
    else hi = mid;
  }

  const t = (targetKm - distances[lo]) / (distances[hi] - distances[lo]);
  return [
    coords[lo][0] + t * (coords[hi][0] - coords[lo][0]),
    coords[lo][1] + t * (coords[hi][1] - coords[lo][1]),
  ];
}

/** Compute bearing between two [lng, lat] points in degrees. */
export function bearing(a: [number, number], b: [number, number]): number {
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Offset a [lng, lat] point by a distance in a given bearing (degrees). */
export function offsetPoint(
  point: [number, number],
  bearingDeg: number,
  distanceKm: number,
): [number, number] {
  const R = 6371; // earth radius km
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (point[1] * Math.PI) / 180;
  const lng1 = (point[0] * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceKm / R) +
      Math.cos(lat1) * Math.sin(distanceKm / R) * Math.cos(brng),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distanceKm / R) * Math.cos(lat1),
      Math.cos(distanceKm / R) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

// ---------------------------------------------------------------------------
// SVG path building + measurement
// ---------------------------------------------------------------------------

/**
 * Build a sharp (un-smoothed) SVG path from pixel points.
 *
 * Returns "" for fewer than two points so callers can use the result as a
 * truthiness check for "is there a line to draw".
 */
export function polylineToPath(points: PixelPoint[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

export interface PathMetrics {
  totalLength: number;
  cumLengths: number[];
}

/**
 * Path measurement — computed synchronously from the pixel points.
 *
 * Previously we used SVGPathElement.getTotalLength() and getPointAtLength(),
 * which required an effect to run after the DOM committed. That caused the
 * leading dot to use stale path data for one frame whenever the points
 * changed (e.g. while the camera panned), making the dot visibly detach from
 * the line. Computing lengths in JS from the same points we build the path
 * from keeps the dot and line perfectly in sync every frame.
 */
export function computePathMetrics(points: PixelPoint[]): PathMetrics {
  if (points.length < 2) {
    return { totalLength: 0, cumLengths: [0] };
  }
  const cumLengths: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.hypot(dx, dy);
    cumLengths.push(total);
  }
  return { totalLength: total, cumLengths };
}

/**
 * Runner dot position — binary-search the polyline to the drawn distance.
 *
 * Note: this measures polyline length, not bezier arc length. For the tension
 * values we use in practice (see IndyTracker's smoothRoute) the two agree to
 * well under a pixel, and crucially the dot lives on the *polyline* vertices
 * the path passes through, so the dot tracks the visible line instead of
 * floating ahead of it.
 *
 * Degenerate inputs fall back to a sensible fixed location rather than
 * throwing: no points → the origin, one point → that point.
 */
export function pointAtDrawFraction(
  points: PixelPoint[],
  metrics: PathMetrics,
  drawFraction: number,
): PixelPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const target = metrics.totalLength * drawFraction;
  const cum = metrics.cumLengths;
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
    x: points[lo].x + t * (points[hi].x - points[lo].x),
    y: points[lo].y + t * (points[hi].y - points[lo].y),
  };
}

// ---------------------------------------------------------------------------
// HUD readouts
// ---------------------------------------------------------------------------

/**
 * Distance readout for the HUD counter.
 *
 * Reads from the actual segmentDistances array (which has ferry gaps baked in)
 * instead of interpolating linearly over the segment length, so the counter
 * freezes during ferry crossings rather than ticking up across the water.
 *
 * `distanceScale` is a percentage (100 = as-is) used to reconcile GPX distance
 * with what Strava reports for the same activity.
 */
export function scaledDistanceAtDraw(
  segmentDistances: number[],
  startKm: number,
  drawFraction: number,
  distanceScale: number,
): number {
  const dists = segmentDistances;
  // Find the distance at the current draw position
  const targetIdx = Math.min(
    dists.length - 1,
    Math.round(drawFraction * (dists.length - 1)),
  );
  return (startKm + dists[targetIdx]) * (distanceScale / 100);
}

/**
 * Cumulative elevation gain up to `targetDist` km along the segment.
 *
 * Only positive deltas count (this is gain, not net change). The final partial
 * interval is interpolated so the counter moves smoothly instead of jumping a
 * whole GPX point at a time. `startElevGain` carries the gain accumulated
 * before the segment started, so a mid-route segment continues the route total
 * rather than restarting from zero.
 */
export function elevationGainAtDraw(
  distances: number[],
  elevations: number[],
  targetDist: number,
  startElevGain: number,
): number {
  const dists = distances;
  const elevs = elevations;

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
  return (startElevGain || 0) + gain;
}

/**
 * Opacity for the pulsing glow halo behind the runner dot.
 *
 * `dotPulseSpeed` is a percentage: 0 = static, 100 = default 1Hz, 500 = fast.
 * A speed of 0 returns a constant 0.7 rather than a sine at 0Hz, so the glow
 * sits at a sensible brightness instead of being pinned to the sine's value
 * at t=0.
 */
export function glowPulseOpacity(
  dotPulseSpeed: number,
  frame: number,
  fps: number,
): number {
  const pulseRate = dotPulseSpeed / 100; // 0 = static, 1 = default 1Hz, 5 = fast
  return pulseRate > 0
    ? 0.4 + 0.3 * Math.sin((frame / fps) * Math.PI * 2 * pulseRate)
    : 0.7;
}
