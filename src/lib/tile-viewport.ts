/**
 * Tile grid computation, viewport bounds, and coordinate→pixel transforms.
 * Ported from scripts/render-static-map.ts viewport logic.
 */
import { z } from "zod";
import { lngToTileX, latToTileY, tileToQuadkey, TILE_SIZE } from "./mercator";

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

// ---------------------------------------------------------------------------
// Tile providers
// ---------------------------------------------------------------------------
//
// All providers below are free and require NO API key. Two groups:
//   1. URL-based providers registered in TILE_URLS (most of them).
//   2. Synthesized providers handled directly by TileMapBackground:
//      - "ocean-composite": hillshade × Carto light_nolabels via blend
//
// If you add a new URL-based provider, add its key BOTH to TILE_URLS and
// to MAP_PROVIDER_KEYS so the Zod enum picks it up. Synthesized providers
// only need to be added to MAP_PROVIDER_KEYS (plus TileMapBackground logic).

const TILE_URLS: Record<string, string> = {
  // --- Satellite / aerial ---------------------------------------------------
  esri: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  bing: "https://ecn.t0.tiles.virtualearth.net/tiles/a{quadkey}.jpeg?g=1",

  // --- Relief / terrain -----------------------------------------------------
  hillshade:
    "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
  ocean:
    "https://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
  "esri-terrain":
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}",
  "esri-relief":
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
  "esri-physical":
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}",
  opentopomap: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",

  // --- Outdoor / trails (overlays render partially transparent) -------------
  cyclosm: "https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
  "waymarked-hiking": "https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png",
  "waymarked-cycling":
    "https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png",

  // --- Minimal / artistic ---------------------------------------------------
  cartodark: "https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
  "esri-light-gray":
    "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  "esri-dark-gray":
    "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",

  // --- Street / labeled general maps ---------------------------------------
  "esri-topo":
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
  "esri-street":
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  "esri-natgeo":
    "https://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}",
  "carto-voyager":
    "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
  "carto-voyager-nolabels":
    "https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png",
  "carto-light": "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  "carto-dark-labels": "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  osm: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  "osm-france": "https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
  "osm-hot": "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
  wikimedia: "https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png",
};

/**
 * All provider keys usable in composition props. Includes both URL-based
 * providers (registered above in TILE_URLS) and synthesized providers handled
 * directly in TileMapBackground (e.g. "ocean-composite").
 *
 * Single source of truth — both GPXSegment and IndyTracker import the
 * derived mapProviderEnum / MapProvider below.
 */
export const MAP_PROVIDER_KEYS = [
  // ---- High-detail (support zoom 17+) ------------------------------------
  // Satellite / aerial
  "esri",
  "bing",
  // Relief / terrain
  "ocean-composite", // synthesized in TileMapBackground
  "opentopomap",
  // Outdoor / trails
  "cyclosm",
  "waymarked-hiking",
  "waymarked-cycling",
  // Minimal / artistic
  "cartodark",
  // Street / labeled
  "esri-topo",
  "esri-street",
  "carto-voyager",
  "carto-voyager-nolabels",
  "carto-light",
  "carto-dark-labels",
  "osm",
  "osm-france",
  "osm-hot",
  "wikimedia",

  // ---- Low-zoom overview providers (capped, pixelated at high zoom) ------
  // Listed last in the dropdown so they don't get picked accidentally for
  // detailed route videos. See TILE_MAX_ZOOM for each one's ceiling.
  "hillshade", // cap 16
  "esri-light-gray", // cap 14
  "esri-dark-gray", // cap 14
  "esri-terrain", // cap 13
  "esri-relief", // cap 13
  "esri-natgeo", // cap 12
  "ocean", // cap 10
  "esri-physical", // cap 8
] as const;

export type MapProvider = (typeof MAP_PROVIDER_KEYS)[number];

/** Zod enum for composition schemas — import this in props schemas. */
export const mapProviderEnum = z.enum(MAP_PROVIDER_KEYS);

/**
 * Same as MAP_PROVIDER_KEYS but with a sentinel "none" option for optional
 * slots (e.g. the secondary/overlay provider on each era). Use this for any
 * provider slot where "off / don't render this layer" is valid.
 */
export const MAP_PROVIDER_OPTIONAL_KEYS = [
  "none",
  ...MAP_PROVIDER_KEYS,
] as const;
export type MapProviderOptional = (typeof MAP_PROVIDER_OPTIONAL_KEYS)[number];
export const mapProviderOptionalEnum = z.enum(MAP_PROVIDER_OPTIONAL_KEYS);

/**
 * CSS mix-blend-mode options for stacking two tile providers in the same era.
 * "normal" = overlay straight on top (subject to any transparency in the
 * overlay's tiles — e.g. waymarked-hiking tiles are PNG with transparent
 * background so "normal" just draws trail lines on top).
 * "multiply" darkens (good for hillshade over color basemaps).
 * "screen" brightens. Others are the standard Photoshop-style blends.
 */
export const BLEND_MODE_KEYS = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
] as const;
export type BlendMode = (typeof BLEND_MODE_KEYS)[number];
export const blendModeEnum = z.enum(BLEND_MODE_KEYS);

/**
 * Loose UI grouping so pickers can show organized sections.
 * Purely cosmetic — the enum itself is flat.
 */
export const MAP_PROVIDER_GROUPS: { label: string; keys: MapProvider[] }[] = [
  { label: "Satellite", keys: ["esri", "bing"] },
  {
    label: "Relief / terrain",
    keys: ["ocean-composite", "opentopomap"],
  },
  {
    label: "Outdoor / trails",
    keys: ["cyclosm", "waymarked-hiking", "waymarked-cycling"],
  },
  {
    label: "Minimal / artistic",
    keys: ["cartodark"],
  },
  {
    label: "Street / labeled",
    keys: [
      "esri-topo",
      "esri-street",
      "carto-voyager",
      "carto-voyager-nolabels",
      "carto-light",
      "carto-dark-labels",
      "osm",
      "osm-france",
      "osm-hot",
      "wikimedia",
    ],
  },
  {
    label: "Low-zoom / overview (pixelated above their cap)",
    keys: [
      "hillshade",
      "ocean",
      "esri-natgeo",
      "esri-light-gray",
      "esri-dark-gray",
      "esri-terrain",
      "esri-relief",
      "esri-physical",
    ],
  },
];

/**
 * Per-provider maximum tile zoom. Requests above this cap are clamped to the
 * provider's max so the tile server returns real imagery instead of a
 * "Map data not available" placeholder. Tiles appear pixelated above the cap.
 *
 * Important: Esri's advertised LODs in /MapServer metadata often overstate
 * actual coverage. E.g. NatGeo advertises z16 but HK only has real tiles up
 * to z12. Caps below are empirically tested against tile byte-sizes/hashes
 * for the HK region — other regions may support higher zoom for some
 * providers, but these caps guarantee non-placeholder tiles globally.
 *
 * Only list providers that actually hit a practical cap; unlisted providers
 * are assumed to support at least zoom 18.
 */
export const TILE_MAX_ZOOM: Partial<Record<MapProvider, number>> = {
  // Esri overview-only basemaps (metadata-confirmed low caps)
  "esri-physical": 8,
  ocean: 10,
  "esri-natgeo": 12,
  "esri-terrain": 13,
  "esri-relief": 13,
  "esri-light-gray": 14,
  "esri-dark-gray": 14,
  // Esri mid-detail (confirmed working at z16)
  hillshade: 16,
  // Waymarked Trails overlays max out around 18
  "waymarked-hiking": 18,
  "waymarked-cycling": 18,
  // OpenTopoMap — server-side policy caps at 17
  opentopomap: 17,
};

/** Clamp a requested tile zoom to the provider's max. */
export function clampZoomForProvider(provider: string, zoom: number): number {
  const max = TILE_MAX_ZOOM[provider as MapProvider];
  return max != null ? Math.min(zoom, max) : zoom;
}

function buildTileUrl(
  provider: string,
  x: number,
  y: number,
  z: number,
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
  } = {},
): TileViewport {
  const {
    zoom: requestedZoom = 17,
    padding = 0.35,
    offsetX = 0,
    offsetY = 0,
    provider = "esri",
  } = options;

  // Clamp zoom to the provider's max so low-res providers (e.g. esri-physical
  // maxes at 8) still render real tiles instead of a server-side placeholder.
  // coordsToPixels() reads zoom from the returned viewport so the route/dot
  // math stays consistent with the tile grid.
  const zoom = clampZoomForProvider(provider, requestedZoom);

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

  // Handle degenerate zero-extent bbox (all coords identical — e.g. when
  // startKm === endKm in a GPX segment). Expand to a small default window
  // around the point so the viewport math doesn't break and the user gets
  // a visible area to pad around.
  if (maxLng - minLng < 1e-9 && maxLat - minLat < 1e-9) {
    const MIN_DELTA = 0.001; // ~100 m per side
    minLng -= MIN_DELTA;
    maxLng += MIN_DELTA;
    minLat -= MIN_DELTA;
    maxLat += MIN_DELTA;
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
    console.warn(
      `Tile count ${tilesX * tilesY} exceeds limit ${MAX_TILES} — reduce zoom or narrow the segment`,
    );
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
  {
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
  viewport: TileViewport,
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
