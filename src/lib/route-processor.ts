/**
 * Route processing: simplification, distance/elevation computation.
 * Ported from scripts/prepare-gpx.ts for browser use.
 * Uses @turf/turf (already installed).
 */
import * as turf from "@turf/turf";
import type { GpxPoint } from "./gpx-browser-parser";

export interface ProcessedRoute {
  /** Display-simplified coordinates [lng, lat][] */
  simplifiedCoords: [number, number][];
  /** Elevation at each simplified point */
  elevations: number[];
  /** Cumulative distance (km) at each simplified point */
  cumulativeDistances: number[];
  /** Total route distance in km */
  totalDistanceKm: number;
  /** Bounding box [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
}

export interface SegmentData {
  /** Resampled coordinates [lng, lat][] at 20m intervals */
  coords: [number, number][];
  /** Pixel positions (set later by tile-viewport) */
  segmentPoints: { x: number; y: number }[];
  /** Previous route points before segment (set later) */
  previousRoutePoints: { x: number; y: number }[];
  /** Cumulative distance at each resampled point (within segment) */
  segmentDistances: number[];
  /** Elevation at each resampled point */
  segmentElevations: number[];
  /** Segment length in km */
  segmentLengthKm: number;
  /** Segment start km on route */
  segmentStartKm: number;
  /** Peak elevation in segment */
  peakElevation: number;
  /** Elevation gain from route start to segment start */
  segmentStartElevGain: number;
}

/**
 * Process raw GPX points into a simplified route with distances and elevations.
 */
export function processRoute(points: GpxPoint[]): ProcessedRoute {
  const coordinates: [number, number][] = points.map((p) => [p.lon, p.lat]);
  const rawElevations = points.map((p) => p.ele);

  const fullLine = turf.lineString(coordinates);

  // Douglas-Peucker simplification (~0.0001° ≈ 10m tolerance)
  const simplified = turf.simplify(fullLine, {
    tolerance: 0.0001,
    highQuality: true,
  });
  const simplifiedCoords = simplified.geometry
    .coordinates as [number, number][];

  // Compute cumulative distances along simplified line
  const cumulativeDistances: number[] = [0];
  for (let i = 1; i < simplifiedCoords.length; i++) {
    const from = turf.point(simplifiedCoords[i - 1]);
    const to = turf.point(simplifiedCoords[i]);
    const dist = turf.distance(from, to, { units: "kilometers" });
    cumulativeDistances.push(cumulativeDistances[i - 1] + dist);
  }
  const totalDistanceKm =
    cumulativeDistances[cumulativeDistances.length - 1];

  // Map simplified coordinates to nearest elevation values
  const elevations: number[] = simplifiedCoords.map((coord) => {
    let minDist = Infinity;
    let closestEle = 0;
    for (let i = 0; i < coordinates.length; i++) {
      const dx = coord[0] - coordinates[i][0];
      const dy = coord[1] - coordinates[i][1];
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        closestEle = rawElevations[i];
      }
    }
    return closestEle;
  });

  const bbox = turf.bbox(simplified) as [number, number, number, number];

  return {
    simplifiedCoords,
    elevations,
    cumulativeDistances,
    totalDistanceKm,
    bbox,
  };
}

/**
 * Extract a segment from a processed route by km range,
 * resample at 20m intervals for smooth animation.
 */
export function extractSegment(
  route: ProcessedRoute,
  startKm: number,
  endKm: number
): SegmentData {
  const { simplifiedCoords, cumulativeDistances, elevations } = route;

  // Find indices for the segment
  let startIdx = 0;
  for (let i = 0; i < cumulativeDistances.length; i++) {
    if (cumulativeDistances[i] >= startKm) {
      startIdx = i;
      break;
    }
  }
  let endIdx = simplifiedCoords.length - 1;
  for (let i = 0; i < cumulativeDistances.length; i++) {
    if (cumulativeDistances[i] >= endKm) {
      endIdx = i;
      break;
    }
  }

  const rawSegmentCoords = simplifiedCoords.slice(startIdx, endIdx + 1);
  if (rawSegmentCoords.length < 2) {
    throw new Error(
      `Segment ${startKm}-${endKm}km has too few points (${rawSegmentCoords.length})`
    );
  }

  // Resample at 20m intervals
  const RESAMPLE_INTERVAL_KM = 0.02;
  const segmentLine = turf.lineString(rawSegmentCoords);
  const segmentTotalKm = turf.length(segmentLine, { units: "kilometers" });
  const resampledCoords: [number, number][] = [];
  for (let d = 0; d <= segmentTotalKm; d += RESAMPLE_INTERVAL_KM) {
    const pt = turf.along(segmentLine, d, { units: "kilometers" });
    resampledCoords.push(pt.geometry.coordinates as [number, number]);
  }
  resampledCoords.push(rawSegmentCoords[rawSegmentCoords.length - 1]);

  // Compute distances within segment
  const segmentDistances: number[] = [0];
  for (let i = 1; i < resampledCoords.length; i++) {
    const from = turf.point(resampledCoords[i - 1]);
    const to = turf.point(resampledCoords[i]);
    const dist = turf.distance(from, to, { units: "kilometers" });
    segmentDistances.push(segmentDistances[i - 1] + dist);
  }

  // Map resampled points to nearest elevation
  const allCoords = simplifiedCoords;
  const allElevations = elevations;
  const segmentElevations: number[] = resampledCoords.map((coord) => {
    let minDist = Infinity;
    let closestEle = 0;
    for (let i = 0; i < allCoords.length; i++) {
      const dx = coord[0] - allCoords[i][0];
      const dy = coord[1] - allCoords[i][1];
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        closestEle = allElevations[i];
      }
    }
    return closestEle;
  });

  const peakElevation = Math.max(...segmentElevations);

  // Elevation gain from route start to segment start
  let segmentStartElevGain = 0;
  for (let i = 1; i < elevations.length; i++) {
    if (cumulativeDistances[i] >= startKm) break;
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) segmentStartElevGain += diff;
  }

  // Previous route coordinates (from start to segment start)
  const previousCoords = simplifiedCoords.slice(0, startIdx + 1);

  return {
    coords: resampledCoords,
    segmentPoints: [], // filled by tile-viewport
    previousRoutePoints: [], // filled by tile-viewport
    segmentDistances,
    segmentElevations,
    segmentLengthKm: segmentDistances[segmentDistances.length - 1],
    segmentStartKm: startKm,
    peakElevation,
    segmentStartElevGain,
  };
}

/**
 * Get all previous route coordinates before a given km value.
 */
export function getPreviousRouteCoords(
  route: ProcessedRoute,
  beforeKm: number
): [number, number][] {
  const { simplifiedCoords, cumulativeDistances } = route;
  let endIdx = 0;
  for (let i = 0; i < cumulativeDistances.length; i++) {
    if (cumulativeDistances[i] >= beforeKm) {
      endIdx = i;
      break;
    }
  }
  return simplifiedCoords.slice(0, endIdx + 1);
}
