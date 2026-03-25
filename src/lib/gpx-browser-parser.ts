/**
 * Browser-based GPX parser using native DOMParser.
 * No npm dependencies required.
 */

export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number;
}

export interface ParsedGPX {
  name: string;
  points: GpxPoint[];
}

export function parseGPX(gpxXml: string): ParsedGPX {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxXml, "application/xml");

  // Check for parse errors
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error(`GPX parse error: ${parseError.textContent}`);
  }

  // Extract track name
  const nameEl = doc.querySelector("trk > name");
  const name = nameEl?.textContent || "Route";

  // Extract all trackpoints
  const trkpts = doc.querySelectorAll("trkpt");
  const points: GpxPoint[] = [];

  for (const trkpt of trkpts) {
    const lat = parseFloat(trkpt.getAttribute("lat") || "0");
    const lon = parseFloat(trkpt.getAttribute("lon") || "0");
    const eleEl = trkpt.querySelector("ele");
    const ele = eleEl ? parseFloat(eleEl.textContent || "0") : 0;
    points.push({ lat, lon, ele });
  }

  if (points.length === 0) {
    throw new Error("No trackpoints found in GPX file");
  }

  return { name, points };
}
