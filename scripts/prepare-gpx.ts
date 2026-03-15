import * as fs from "fs";
import * as path from "path";
import GpxParser from "gpxparser";
import * as turf from "@turf/turf";

const gpxPath = path.resolve(__dirname, "../HK_Southern_Loop_2025.gpx");
const outputPath = path.resolve(__dirname, "../src/data/route-processed.json");

console.log("Reading GPX file...");
const gpxData = fs.readFileSync(gpxPath, "utf-8");

const gpx = new GpxParser();
gpx.parse(gpxData);

const track = gpx.tracks[0];
if (!track) {
  throw new Error("No track found in GPX file");
}

const points = track.points;
console.log(`Parsed ${points.length} trackpoints`);

// Convert to GeoJSON LineString
const coordinates: [number, number][] = points.map((p) => [p.lon, p.lat]);
const elevations: number[] = points.map((p) => p.ele ?? 0);

const fullLine = turf.lineString(coordinates);

// Simplify using Douglas-Peucker (tolerance in degrees, ~0.0001 ≈ 10m)
const simplified = turf.simplify(fullLine, {
  tolerance: 0.0001,
  highQuality: true,
});

const simplifiedCoords = simplified.geometry.coordinates as [number, number][];
console.log(
  `Simplified from ${coordinates.length} to ${simplifiedCoords.length} points`
);

// Compute cumulative distances from a lightly simplified version of the original track.
// Raw GPS (47k points) has jitter that inflates distance (~77km).
// Our display simplification (913 points) cuts too many corners (~69.7km).
// A mild simplification (~0.00002° ≈ 2m tolerance) removes jitter while preserving true path.
const mildSimplified = turf.simplify(fullLine, {
  tolerance: 0.000045,
  highQuality: true,
});
const mildCoords = mildSimplified.geometry.coordinates as [number, number][];
console.log(`Mild simplification: ${coordinates.length} → ${mildCoords.length} points`);

const mildCumulativeDistances: number[] = [0];
for (let i = 1; i < mildCoords.length; i++) {
  const from = turf.point(mildCoords[i - 1]);
  const to = turf.point(mildCoords[i]);
  const dist = turf.distance(from, to, { units: "kilometers" });
  mildCumulativeDistances.push(mildCumulativeDistances[i - 1] + dist);
}
const totalDistanceKm = mildCumulativeDistances[mildCumulativeDistances.length - 1];
console.log(`Smoothed total distance: ${totalDistanceKm.toFixed(2)} km`);

// Detect ferry rides: segments where consecutive mildly-simplified points are >500m apart
// and cross water (large lat change). Subtract ferry distances from cumulative totals.
const FERRY_GAP_THRESHOLD_KM = 0.5;
let ferryDistanceTotal = 0;
const ferryAdjustments: number[] = new Array(mildCoords.length).fill(0);
for (let i = 1; i < mildCoords.length; i++) {
  const gap = mildCumulativeDistances[i] - mildCumulativeDistances[i - 1];
  const latDiff = Math.abs(mildCoords[i][1] - mildCoords[i - 1][1]);
  // Ferry: large gap AND significant latitude change AND the points are in the harbour area
  // (lat ~22.28-22.30, lng ~114.15-114.18 = Victoria Harbour)
  const avgLat = (mildCoords[i][1] + mildCoords[i - 1][1]) / 2;
  const isHarbourArea = avgLat > 22.28 && avgLat < 22.30;
  if (gap > FERRY_GAP_THRESHOLD_KM && latDiff > 0.003 && isHarbourArea) {
    console.log(`Ferry detected at km ${mildCumulativeDistances[i - 1].toFixed(1)}-${mildCumulativeDistances[i].toFixed(1)} (${gap.toFixed(2)} km)`);
    ferryDistanceTotal += gap;
  }
  ferryAdjustments[i] = ferryDistanceTotal;
}
if (ferryDistanceTotal > 0) {
  console.log(`Total ferry distance subtracted: ${ferryDistanceTotal.toFixed(2)} km`);
}

// Map mild-simplified coordinates to nearest elevation values (for more accurate elevation gain)
const mildElevations: number[] = mildCoords.map((coord) => {
  let minDist = Infinity;
  let closestEle = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const dx = coord[0] - coordinates[i][0];
    const dy = coord[1] - coordinates[i][1];
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      closestEle = elevations[i];
    }
  }
  return closestEle;
});
let mildElevGain = 0;
for (let i = 1; i < mildElevations.length; i++) {
  if (mildElevations[i] > mildElevations[i - 1]) mildElevGain += mildElevations[i] - mildElevations[i - 1];
}
console.log(`Elevation gain (mild, ${mildCoords.length} pts): ${mildElevGain.toFixed(0)} m`);

// Adjusted cumulative distances (ferry rides removed)
const adjustedMildDistances = mildCumulativeDistances.map((d, i) => d - ferryAdjustments[i]);
const adjustedTotalKm = adjustedMildDistances[adjustedMildDistances.length - 1];
console.log(`Adjusted total distance (no ferry): ${adjustedTotalKm.toFixed(2)} km`);

// Map each display-simplified point to its cumulative distance from the smoothed track.
// Use projection onto the mild track line (not just nearest vertex) for accuracy.
const mildLine = turf.lineString(mildCoords);
const cumulativeDistances: number[] = simplifiedCoords.map((coord) => {
  const pt = turf.point(coord);
  const snapped = turf.nearestPointOnLine(mildLine, pt, { units: "kilometers" });
  const segIdx = snapped.properties.index!; // index of the segment start vertex

  // Interpolate the raw distance between the two vertices of the matched segment
  // (ferry subtraction is NOT applied to the km counter — segments simply skip ferry portions)
  if (segIdx >= mildCoords.length - 1) {
    return mildCumulativeDistances[mildCoords.length - 1];
  }
  const segStart = mildCumulativeDistances[segIdx];
  const segEnd = mildCumulativeDistances[segIdx + 1];
  const segLen = mildCumulativeDistances[segIdx + 1] - mildCumulativeDistances[segIdx];
  if (segLen === 0) return segStart;
  // snapped.properties.location is the distance along the line from its start
  const locOnLine = snapped.properties.location!; // km from start of mildLine
  const locInSeg = locOnLine - mildCumulativeDistances[segIdx];
  const t = Math.max(0, Math.min(1, locInSeg / segLen));
  return segStart + t * (segEnd - segStart);
});

// Map simplified coordinates back to nearest elevation values
const simplifiedElevations: number[] = simplifiedCoords.map((coord) => {
  // Find the closest original point
  let minDist = Infinity;
  let closestEle = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const dx = coord[0] - coordinates[i][0];
    const dy = coord[1] - coordinates[i][1];
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      closestEle = elevations[i];
    }
  }
  return closestEle;
});

// Compute bounding box
const bbox = turf.bbox(simplified);

// Compute center
const center = turf.center(simplified);

const output = {
  type: "Feature" as const,
  geometry: simplified.geometry,
  properties: {
    name: track.name || "Route",
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    pointCount: simplifiedCoords.length,
    originalPointCount: coordinates.length,
    bbox,
    center: center.geometry.coordinates,
    cumulativeDistances,
    elevations: simplifiedElevations,
    mildElevations,
    mildCumulativeDistances,
  },
};

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Output written to ${outputPath}`);
console.log(`Total distance: ${totalDistanceKm.toFixed(2)} km`);
console.log(`Bounding box: [${bbox.join(", ")}]`);
console.log(`Center: [${center.geometry.coordinates.join(", ")}]`);
