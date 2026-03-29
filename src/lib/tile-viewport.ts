/**
 * Tile grid computation, viewport bounds, and coordinate→pixel transforms.
 * Ported from scripts/render-static-map.ts viewport logic.
 */
import {
  lngToTileX,
  latToTileY,
  tileToQuadkey,
  TILE_SIZE,
} from "./mercator";

const OUTPUT_WIDTH = 3840;
const OUTPUT_HEIGHT = 2160;

export interface TileInfo {
  x: number;
  y: number;
  pixelLeft: number;
  pixelTop: number;
  url: string;
}

export interface TileViewport {
  tiles: TileInfo[];
  /** Total pixel width of the full tile grid */
  gridWidth: number;
  /** Total pixel height of the full tile grid */
  gridHeight: number;
  /** Pixel offset into grid for the viewport left edge */
  cropLeft: number;
  /** Pixel offset into grid for the viewport top edge */
  cropTop: number;
  /** Pixel width of the viewport window (before scaling to output) */
  cropWidth: number;
  /** Pixel height of the viewport window */
  cropHeight: number;
  zoom: number;
  /** Scale factor: outputWidth / cropWidth */
  scale: number;
  /** Tile grid origin (min tile X) */
  tileMinX: number;
  /** Tile grid origin (min tile Y) */
  tileMinY: number;
}

const TILE_URLS: Record<string, string> = {
  esri: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  bing: "https://ecn.t0.tiles.virtualearth.net/tiles/a{quadkey}.jpeg?g=1",
  hillshade:
    "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
  ocean:
    "https://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
  cartodark: "https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
};

function buildTileUrl(
  provider: string,
  x: number,
  y: number,
  z: number
): string {
  const template = TILE_URLS[provider] || TILE_URLS.esri;
  return template
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y))
    .replace("{quadkey}", tileToQuadkey(x, y, z));
}

/**
 * Compute the tile viewport for a set of coordinates.
 */
export function computeViewport(
  coords: [number, number][],
  options: {
    zoom?: number;
    padding?: number;
    offsetX?: number;
    offsetY?: number;
    provider?: string;
  } = {}
): TileViewport {
  const {
    zoom = 17,
    padding = 0.35,
    offsetX = 0,
    offsetY = 0,
    provider = "esri",
  } = options;

  // Compute bounding box
  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  // Add padding
  const dLng = (maxLng - minLng) * padding;
  const dLat = (maxLat - minLat) * padding;
  minLng -= dLng;
  maxLng += dLng;
  minLat -= dLat;
  maxLat += dLat;

  // Convert to pixels
  const topLeftPx = {
    x: lngToTileX(minLng, zoom) * TILE_SIZE,
    y: latToTileY(maxLat, zoom) * TILE_SIZE,
  };
  const botRightPx = {
    x: lngToTileX(maxLng, zoom) * TILE_SIZE,
    y: latToTileY(minLat, zoom) * TILE_SIZE,
  };

  let pxWidth = botRightPx.x - topLeftPx.x;
  let pxHeight = botRightPx.y - topLeftPx.y;
  const targetAspect = OUTPUT_WIDTH / OUTPUT_HEIGHT;
  const currentAspect = pxWidth / pxHeight;

  // Expand to 16:9 aspect ratio
  if (currentAspect < targetAspect) {
    const newWidth = pxHeight * targetAspect;
    const expand = (newWidth - pxWidth) / 2;
    topLeftPx.x -= expand;
    botRightPx.x += expand;
    pxWidth = newWidth;
  } else {
    const newHeight = pxWidth / targetAspect;
    const expand = (newHeight - pxHeight) / 2;
    topLeftPx.y -= expand;
    botRightPx.y += expand;
    pxHeight = newHeight;
  }

  // Apply viewport offset
  if (offsetX !== 0 || offsetY !== 0) {
    const shiftX = pxWidth * offsetX;
    const shiftY = pxHeight * offsetY;
    topLeftPx.x += shiftX;
    botRightPx.x += shiftX;
    topLeftPx.y += shiftY;
    botRightPx.y += shiftY;
  }

  // Determine tile range
  const tileMinX = Math.floor(topLeftPx.x / TILE_SIZE);
  const tileMaxX = Math.floor(botRightPx.x / TILE_SIZE);
  const tileMinY = Math.floor(topLeftPx.y / TILE_SIZE);
  const tileMaxY = Math.floor(botRightPx.y / TILE_SIZE);

  let tilesX = tileMaxX - tileMinX + 1;
  let tilesY = tileMaxY - tileMinY + 1;

  // Safety cap: prevent browser crash from too many tiles
  const MAX_TILES = 10000;
  if (tilesX * tilesY > MAX_TILES) {
    console.warn(`Tile count ${tilesX * tilesY} exceeds limit ${MAX_TILES} — reduce zoom or narrow the segment`);
    // Trim tiles symmetrically to stay within budget
    while (tilesX * tilesY > MAX_TILES) {
      if (tilesX > tilesY) tilesX--;
      else tilesY--;
    }
  }

  const safeTileMaxX = tileMinX + tilesX - 1;
  const safeTileMaxY = tileMinY + tilesY - 1;

  // Build tile list
  const tiles: TileInfo[] = [];
  for (let ty = tileMinY; ty <= safeTileMaxY; ty++) {
    for (let tx = tileMinX; tx <= safeTileMaxX; tx++) {
      tiles.push({
        x: tx,
        y: ty,
        pixelLeft: (tx - tileMinX) * TILE_SIZE,
        pixelTop: (ty - tileMinY) * TILE_SIZE,
        url: buildTileUrl(provider, tx, ty, zoom),
      });
    }
  }

  // Crop offsets within the tile grid
  const cropLeft = topLeftPx.x - tileMinX * TILE_SIZE;
  const cropTop = topLeftPx.y - tileMinY * TILE_SIZE;

  return {
    tiles,
    gridWidth: tilesX * TILE_SIZE,
    gridHeight: tilesY * TILE_SIZE,
    cropLeft,
    cropTop,
    cropWidth: pxWidth,
    cropHeight: pxHeight,
    zoom,
    scale: OUTPUT_WIDTH / pxWidth,
    tileMinX,
    tileMinY,
  };
}

/**
 * Convert lng/lat coordinates to pixel positions in the 3840x2160 output.
 */
export function coordsToPixels(
  coords: [number, number][],
  viewport: TileViewport
): { x: number; y: number }[] {
  const { zoom, tileMinX, tileMinY, cropLeft, cropTop, scale } = viewport;
  return coords.map(([lng, lat]) => {
    const globalX = lngToTileX(lng, zoom) * TILE_SIZE;
    const globalY = latToTileY(lat, zoom) * TILE_SIZE;
    const gridX = globalX - tileMinX * TILE_SIZE;
    const gridY = globalY - tileMinY * TILE_SIZE;
    return {
      x: (gridX - cropLeft) * scale,
      y: (gridY - cropTop) * scale,
    };
  });
}

export { TILE_URLS, OUTPUT_WIDTH, OUTPUT_HEIGHT };
