import * as turf from "@turf/turf";
import type { Feature, LineString, Position } from "geojson";

export interface RouteData {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties: {
    name: string;
    totalDistanceKm: number;
    pointCount: number;
    originalPointCount: number;
    bbox: [number, number, number, number];
    center: [number, number];
    cumulativeDistances: number[];
    elevations: number[];
  };
}

export function getVisibleRoute(
  routeData: RouteData,
  currentDistanceKm: number
): Feature<LineString> {
  const line = turf.lineString(
    routeData.geometry.coordinates
  ) as Feature<LineString>;
  if (currentDistanceKm <= 0) {
    return turf.lineString([
      routeData.geometry.coordinates[0],
      routeData.geometry.coordinates[0],
    ]);
  }
  if (currentDistanceKm >= routeData.properties.totalDistanceKm) {
    return line;
  }
  return turf.lineSliceAlong(line, 0, currentDistanceKm, {
    units: "kilometers",
  });
}

export function getCurrentPosition(
  routeData: RouteData,
  currentDistanceKm: number
): [number, number] {
  const line = turf.lineString(routeData.geometry.coordinates);
  const clampedDist = Math.min(
    Math.max(0, currentDistanceKm),
    routeData.properties.totalDistanceKm
  );
  const point = turf.along(line, clampedDist, { units: "kilometers" });
  return point.geometry.coordinates as [number, number];
}

export function getSmoothedBearing(
  routeData: RouteData,
  currentDistanceKm: number,
  windowKm: number = 2.0
): number {
  const totalDist = routeData.properties.totalDistanceKm;
  const line = turf.lineString(routeData.geometry.coordinates);

  // Sample multiple bearings across the window and use circular mean
  // This avoids the 360°/0° wraparound problem and produces very smooth results
  const samples = 8;
  let sinSum = 0;
  let cosSum = 0;

  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1); // 0 to 1
    const sampleDist = currentDistanceKm - windowKm + t * windowKm * 2;
    const behind = Math.max(0, Math.min(totalDist, sampleDist - 0.3));
    const ahead = Math.max(0, Math.min(totalDist, sampleDist + 0.3));

    // Skip if behind and ahead are the same (would produce invalid bearing)
    if (Math.abs(ahead - behind) < 0.01) continue;

    const p1 = turf.along(line, behind, { units: "kilometers" });
    const p2 = turf.along(line, ahead, { units: "kilometers" });
    const b = turf.bearing(p1, p2);

    const rad = (b * Math.PI) / 180;
    // Weight samples closer to current position more heavily (gaussian-ish)
    const distFromCenter = Math.abs(t - 0.5) * 2; // 0 at center, 1 at edges
    const weight = Math.exp(-distFromCenter * distFromCenter * 2);
    sinSum += Math.sin(rad) * weight;
    cosSum += Math.cos(rad) * weight;
  }

  return (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
}

export function getLookaheadPosition(
  routeData: RouteData,
  currentDistanceKm: number,
  lookaheadKm: number = 0.3
): [number, number] {
  const line = turf.lineString(routeData.geometry.coordinates);
  const targetDist = Math.min(
    currentDistanceKm + lookaheadKm,
    routeData.properties.totalDistanceKm
  );
  const point = turf.along(line, targetDist, { units: "kilometers" });
  return point.geometry.coordinates as [number, number];
}

export function getCurrentElevation(
  routeData: RouteData,
  currentDistanceKm: number
): number {
  const { cumulativeDistances, elevations } = routeData.properties;

  if (currentDistanceKm <= 0) return elevations[0];
  if (currentDistanceKm >= routeData.properties.totalDistanceKm) {
    return elevations[elevations.length - 1];
  }

  // Find the two surrounding points and interpolate
  for (let i = 1; i < cumulativeDistances.length; i++) {
    if (cumulativeDistances[i] >= currentDistanceKm) {
      const t =
        (currentDistanceKm - cumulativeDistances[i - 1]) /
        (cumulativeDistances[i] - cumulativeDistances[i - 1]);
      return elevations[i - 1] + t * (elevations[i] - elevations[i - 1]);
    }
  }
  return elevations[elevations.length - 1];
}
