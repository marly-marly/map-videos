/**
 * Render a high-res satellite map by stitching Esri World Imagery tiles.
 * Outputs a PNG + metadata JSON for use in Remotion compositions.
 *
 * Usage: npx tsx scripts/render-static-map.ts
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";

// ---------- Config ----------
// CLI args: npx tsx scripts/render-static-map.ts [startKm] [endKm] [outputName] [offsetX%] [offsetY%] [padding] [--provider=name]
// offsetX/offsetY shift the viewport as a fraction of its size (e.g. 0.2 = 20% right, -0.1 = 10% left)
const args = process.argv.slice(2);
const flagArgs = args.filter(a => a.startsWith('--'));
const posArgs = args.filter(a => !a.startsWith('--'));
const SEGMENT_START_KM = posArgs[0] ? parseFloat(posArgs[0]) : 4;
const SEGMENT_END_KM = posArgs[1] ? parseFloat(posArgs[1]) : 8.5;
const OUTPUT_NAME = posArgs[2] || "static-map";
const OFFSET_X = posArgs[3] ? parseFloat(posArgs[3]) : 0; // positive = shift view right
const OFFSET_Y = posArgs[4] ? parseFloat(posArgs[4]) : 0; // positive = shift view down (negative = up)
const PADDING_FACTOR = posArgs[5] ? parseFloat(posArgs[5]) : 0.35; // padding around the route segment (default 35%)
const ZOOM = 17; // zoom level (17 gives ~1.1m/px at lat 22)
const TILE_SIZE = 256;
const OUTPUT_WIDTH = 3840;
const OUTPUT_HEIGHT = 2160;

// Tile providers
const providerFlag = flagArgs.find(a => a.startsWith('--provider='));
const PROVIDER = providerFlag ? providerFlag.split('=')[1] : 'esri';

const TILE_URLS: Record<string, string> = {
  esri: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  mapbox: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${process.env.MAPBOX_ACCESS_TOKEN || ''}`,
  google: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  bing: "https://ecn.t0.tiles.virtualearth.net/tiles/a{quadkey}.jpeg?g=1",
};
const TILE_URL = TILE_URLS[PROVIDER] || TILE_URLS.esri;
if (PROVIDER !== 'esri') console.log(`Using tile provider: ${PROVIDER}`);

// ---------- Web Mercator math ----------

function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    Math.pow(2, zoom)
  );
}

function tileXToLng(x: number, zoom: number): number {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tileYToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// Convert lng/lat to pixel position in the stitched image
function lngLatToPixel(
  lng: number,
  lat: number,
  zoom: number,
  originTileX: number,
  originTileY: number
): { x: number; y: number } {
  const globalX = lngToTileX(lng, zoom) * TILE_SIZE;
  const globalY = latToTileY(lat, zoom) * TILE_SIZE;
  const originX = originTileX * TILE_SIZE;
  const originY = originTileY * TILE_SIZE;
  return {
    x: globalX - originX,
    y: globalY - originY,
  };
}

// ---------- Bing quadkey helper ----------
function tileToQuadkey(x: number, y: number, z: number): string {
  let quadkey = '';
  for (let i = z; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    quadkey += digit;
  }
  return quadkey;
}

// ---------- Tile fetching ----------

async function fetchTile(
  z: number,
  x: number,
  y: number
): Promise<Buffer> {
  let url = TILE_URL.replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
  if (url.includes("{quadkey}")) {
    url = url.replace("{quadkey}", tileToQuadkey(x, y, z));
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error("unreachable");
}

// ---------- Main ----------

async function main() {
  // Load route data
  const routeData = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../src/data/route-processed.json"),
      "utf-8"
    )
  );
  const { cumulativeDistances, elevations } = routeData.properties;
  const coords: [number, number][] = routeData.geometry.coordinates;

  // Extract segment indices
  const startIdx = cumulativeDistances.findIndex(
    (d: number) => d >= SEGMENT_START_KM
  );
  const endIdx = cumulativeDistances.findIndex(
    (d: number) => d >= SEGMENT_END_KM
  );
  const rawSegmentCoords = coords.slice(startIdx, endIdx + 1);

  // Resample at equal geographic distance intervals (every 20m)
  // so the SVG path length is proportional to real-world distance,
  // giving constant visual speed regardless of original GPS point density.
  const RESAMPLE_INTERVAL_KM = 0.02; // 20 meters
  const segmentLine = turf.lineString(rawSegmentCoords);
  const segmentTotalKm = turf.length(segmentLine, { units: "kilometers" });
  const resampledCoords: [number, number][] = [];
  for (let d = 0; d <= segmentTotalKm; d += RESAMPLE_INTERVAL_KM) {
    const pt = turf.along(segmentLine, d, { units: "kilometers" });
    resampledCoords.push(pt.geometry.coordinates as [number, number]);
  }
  // Always include the last point
  resampledCoords.push(rawSegmentCoords[rawSegmentCoords.length - 1]);
  const segmentCoords = resampledCoords;

  console.log(
    `Segment: km ${SEGMENT_START_KM}-${SEGMENT_END_KM}, ${rawSegmentCoords.length} raw → ${segmentCoords.length} resampled points`
  );

  // Compute bounding box of segment
  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of segmentCoords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  // Add padding
  const dLng = (maxLng - minLng) * PADDING_FACTOR;
  const dLat = (maxLat - minLat) * PADDING_FACTOR;
  minLng -= dLng;
  maxLng += dLng;
  minLat -= dLat;
  maxLat += dLat;

  // Expand to 16:9 aspect ratio
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  // Convert current bounds to pixels to figure out aspect
  const topLeftPx = {
    x: lngToTileX(minLng, ZOOM) * TILE_SIZE,
    y: latToTileY(maxLat, ZOOM) * TILE_SIZE,
  };
  const botRightPx = {
    x: lngToTileX(maxLng, ZOOM) * TILE_SIZE,
    y: latToTileY(minLat, ZOOM) * TILE_SIZE,
  };

  let pxWidth = botRightPx.x - topLeftPx.x;
  let pxHeight = botRightPx.y - topLeftPx.y;
  const targetAspect = OUTPUT_WIDTH / OUTPUT_HEIGHT;
  const currentAspect = pxWidth / pxHeight;

  if (currentAspect < targetAspect) {
    // Too tall, widen
    const newWidth = pxHeight * targetAspect;
    const expand = (newWidth - pxWidth) / 2;
    topLeftPx.x -= expand;
    botRightPx.x += expand;
    pxWidth = newWidth;
  } else {
    // Too wide, heighten
    const newHeight = pxWidth / targetAspect;
    const expand = (newHeight - pxHeight) / 2;
    topLeftPx.y -= expand;
    botRightPx.y += expand;
    pxHeight = newHeight;
  }

  // Apply viewport offset (shift the camera without changing zoom)
  if (OFFSET_X !== 0 || OFFSET_Y !== 0) {
    const shiftX = pxWidth * OFFSET_X;
    const shiftY = pxHeight * OFFSET_Y;
    topLeftPx.x += shiftX;
    botRightPx.x += shiftX;
    topLeftPx.y += shiftY;
    botRightPx.y += shiftY;
    console.log(`Applied viewport offset: ${OFFSET_X * 100}% right, ${OFFSET_Y * 100}% down`);
  }

  // Convert back to lng/lat for the final bounds
  const finalMinLng = tileXToLng(topLeftPx.x / TILE_SIZE, ZOOM);
  const finalMaxLng = tileXToLng(botRightPx.x / TILE_SIZE, ZOOM);
  const finalMaxLat = tileYToLat(topLeftPx.y / TILE_SIZE, ZOOM);
  const finalMinLat = tileYToLat(botRightPx.y / TILE_SIZE, ZOOM);

  console.log(
    `Final bounds: [${finalMinLng.toFixed(5)}, ${finalMinLat.toFixed(5)}] to [${finalMaxLng.toFixed(5)}, ${finalMaxLat.toFixed(5)}]`
  );
  console.log(
    `Pixel dimensions before crop: ${Math.round(pxWidth)} x ${Math.round(pxHeight)}`
  );

  // Determine which tiles we need
  const tileMinX = Math.floor(topLeftPx.x / TILE_SIZE);
  const tileMaxX = Math.floor(botRightPx.x / TILE_SIZE);
  const tileMinY = Math.floor(topLeftPx.y / TILE_SIZE);
  const tileMaxY = Math.floor(botRightPx.y / TILE_SIZE);

  const tilesX = tileMaxX - tileMinX + 1;
  const tilesY = tileMaxY - tileMinY + 1;
  const totalTiles = tilesX * tilesY;

  console.log(
    `Tiles: ${tilesX}x${tilesY} = ${totalTiles} tiles at zoom ${ZOOM}`
  );

  // Download all tiles (with concurrency limit)
  const CONCURRENCY = 6;
  const tileBuffers: Map<string, Buffer> = new Map();
  const tileQueue: { x: number; y: number }[] = [];

  for (let ty = tileMinY; ty <= tileMaxY; ty++) {
    for (let tx = tileMinX; tx <= tileMaxX; tx++) {
      tileQueue.push({ x: tx, y: ty });
    }
  }

  let fetched = 0;
  async function processBatch(batch: { x: number; y: number }[]) {
    await Promise.all(
      batch.map(async ({ x, y }) => {
        const buf = await fetchTile(ZOOM, x, y);
        tileBuffers.set(`${x},${y}`, buf);
        fetched++;
        if (fetched % 10 === 0 || fetched === totalTiles) {
          process.stdout.write(`\rDownloaded ${fetched}/${totalTiles} tiles`);
        }
      })
    );
  }

  for (let i = 0; i < tileQueue.length; i += CONCURRENCY) {
    await processBatch(tileQueue.slice(i, i + CONCURRENCY));
  }
  console.log("\nStitching tiles...");

  // Create the stitched image
  const stitchedWidth = tilesX * TILE_SIZE;
  const stitchedHeight = tilesY * TILE_SIZE;

  const compositeInputs: sharp.OverlayOptions[] = [];
  for (let ty = tileMinY; ty <= tileMaxY; ty++) {
    for (let tx = tileMinX; tx <= tileMaxX; tx++) {
      const buf = tileBuffers.get(`${tx},${ty}`);
      if (buf) {
        compositeInputs.push({
          input: buf,
          left: (tx - tileMinX) * TILE_SIZE,
          top: (ty - tileMinY) * TILE_SIZE,
        });
      }
    }
  }

  // Create base image and composite tiles
  const stitched = sharp({
    create: {
      width: stitchedWidth,
      height: stitchedHeight,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(compositeInputs)
    .png();

  // Crop to the exact 16:9 viewport
  const cropLeft = Math.round(topLeftPx.x - tileMinX * TILE_SIZE);
  const cropTop = Math.round(topLeftPx.y - tileMinY * TILE_SIZE);
  const cropWidth = Math.round(pxWidth);
  const cropHeight = Math.round(pxHeight);

  const croppedBuf = await sharp(await stitched.toBuffer())
    .extract({
      left: cropLeft,
      top: cropTop,
      width: Math.min(cropWidth, stitchedWidth - cropLeft),
      height: Math.min(cropHeight, stitchedHeight - cropTop),
    })
    .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: "fill" })
    .png()
    .toBuffer();

  // Save the output
  const outDir = path.join(__dirname, "../src/data");
  const outPng = path.join(outDir, `${OUTPUT_NAME}.png`);
  fs.writeFileSync(outPng, croppedBuf);
  // Also copy to public for Remotion's staticFile()
  const publicPng = path.join(__dirname, "../public", `${OUTPUT_NAME}.png`);
  fs.writeFileSync(publicPng, croppedBuf);
  console.log(`Saved ${outPng} (${OUTPUT_WIDTH}x${OUTPUT_HEIGHT})`);

  // Convert route segment coordinates to pixel positions in the final image
  // We need to map from lng/lat → pixel in the cropped+resized image
  const segmentPixels: { x: number; y: number }[] = segmentCoords.map(
    ([lng, lat]: [number, number]) => {
      // Position in the uncropped stitched image
      const globalX = lngToTileX(lng, ZOOM) * TILE_SIZE;
      const globalY = latToTileY(lat, ZOOM) * TILE_SIZE;
      // Position relative to the crop window
      const relX = globalX - topLeftPx.x;
      const relY = globalY - topLeftPx.y;
      // Scale to output dimensions
      return {
        x: (relX / pxWidth) * OUTPUT_WIDTH,
        y: (relY / pxHeight) * OUTPUT_HEIGHT,
      };
    }
  );

  // Compute cumulative distances for the resampled segment
  const segmentDistances: number[] = [];
  for (let i = 0; i < segmentCoords.length; i++) {
    segmentDistances.push(i * RESAMPLE_INTERVAL_KM);
  }
  // Fix last entry to be exact total
  segmentDistances[segmentDistances.length - 1] = segmentTotalKm;

  // Interpolate elevations at resampled positions from original display data
  const origSegDists = cumulativeDistances
    .slice(startIdx, endIdx + 1)
    .map((d: number) => d - cumulativeDistances[startIdx]);
  const origSegElevs: number[] = elevations.slice(startIdx, endIdx + 1);

  const segmentElevations: number[] = segmentDistances.map((d: number) => {
    if (d <= 0) return origSegElevs[0];
    if (d >= origSegDists[origSegDists.length - 1])
      return origSegElevs[origSegElevs.length - 1];
    for (let i = 1; i < origSegDists.length; i++) {
      if (origSegDists[i] >= d) {
        const t = (d - origSegDists[i - 1]) / (origSegDists[i] - origSegDists[i - 1]);
        return origSegElevs[i - 1] + t * (origSegElevs[i] - origSegElevs[i - 1]);
      }
    }
    return origSegElevs[origSegElevs.length - 1];
  });

  // Convert all route points from km 0 to segment start into pixel positions
  // (for showing the previous route as a dim trail)
  const prevCoords = coords.slice(0, startIdx + 1);
  const prevPixels: { x: number; y: number }[] = prevCoords.map(
    ([lng, lat]: [number, number]) => {
      const globalX = lngToTileX(lng, ZOOM) * TILE_SIZE;
      const globalY = latToTileY(lat, ZOOM) * TILE_SIZE;
      const relX = globalX - topLeftPx.x;
      const relY = globalY - topLeftPx.y;
      return {
        x: (relX / pxWidth) * OUTPUT_WIDTH,
        y: (relY / pxHeight) * OUTPUT_HEIGHT,
      };
    }
  );

  const metadata = {
    bounds: {
      minLng: finalMinLng,
      maxLng: finalMaxLng,
      minLat: finalMinLat,
      maxLat: finalMaxLat,
    },
    outputWidth: OUTPUT_WIDTH,
    outputHeight: OUTPUT_HEIGHT,
    zoom: ZOOM,
    segmentStartKm: cumulativeDistances[startIdx],
    segmentEndKm: cumulativeDistances[endIdx],
    segmentLengthKm:
      cumulativeDistances[endIdx] - cumulativeDistances[startIdx],
    segmentPoints: segmentPixels,
    previousRoutePoints: prevPixels,
    segmentDistances,
    segmentElevations,
    peakElevation: Math.max(...segmentElevations),
    segmentStartElevGain: (() => {
      // Scale factor to match Strava's elevation gain (2889m vs our computed 2853m)
      const ELEV_GAIN_SCALE = 2889 / 2853;
      let gain = 0;
      for (let i = 1; i < elevations.length; i++) {
        if (i >= startIdx) break;
        const diff = elevations[i] - elevations[i - 1];
        if (diff > 0) gain += diff;
      }
      return Math.round(gain * ELEV_GAIN_SCALE);
    })(),
  };

  const metaPath = path.join(outDir, `${OUTPUT_NAME}-meta.json`);
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  console.log(`Saved ${metaPath}`);
  console.log(
    `Segment: ${metadata.segmentLengthKm.toFixed(1)} km, peak ${metadata.peakElevation.toFixed(0)}m`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
