/**
 * Web Mercator math utilities for converting between geographic coordinates,
 * tile coordinates, and pixel positions.
 * Ported from scripts/render-static-map.ts.
 */

const TILE_SIZE = 256;

export function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

export function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    Math.pow(2, zoom)
  );
}

export function tileXToLng(x: number, zoom: number): number {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

export function tileYToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function tileToQuadkey(x: number, y: number, z: number): string {
  let quadkey = "";
  for (let i = z; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    quadkey += digit;
  }
  return quadkey;
}

/**
 * Convert lng/lat to pixel position relative to a tile grid origin.
 */
export function lngLatToPixel(
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

export { TILE_SIZE };
