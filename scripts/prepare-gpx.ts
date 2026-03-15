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

// Map each display-simplified point to its cumulative distance from the smoothed track
const cumulativeDistances: number[] = simplifiedCoords.map((coord) => {
  let minDist = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < mildCoords.length; i++) {
    const dx = coord[0] - mildCoords[i][0];
    const dy = coord[1] - mildCoords[i][1];
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  }
  return mildCumulativeDistances[closestIdx];
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
