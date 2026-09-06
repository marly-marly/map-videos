/**
 * Centered (dot-following) viewport computation.
 *
 * This is the counterpart to computeViewport() in tile-viewport.ts, which does
 * fit-bounds framing over a whole set of coordinates. Here the framing is
 * driven by a single moving point instead: the caller supplies where the camera
 * currently is and we derive a bbox around it. IndyTracker uses this so the map
 * pans with the runner; GPXSegment deliberately does NOT — it frames the whole
 * segment once and zooms with CSS. Keep the two approaches separate.
 */
import { computeViewport } from "./tile-viewport";
import {
  lngToTileX,
  latToTileY,
  tileXToLng,
  tileYToLat,
  TILE_SIZE,
} from "./mercator";

/**
 * Compute a viewport centered on a geographic point.
 * The visible area is determined by zoom level — at zoom 17, each pixel
 * covers ~1.1m at lat 22, so 3840px ≈ 4.2km wide.
 */
export function computeCenteredViewport(
  centerLng: number,
  centerLat: number,
  zoom: number,
  provider: string,
  cameraScale: number = 1, // 1 = default, 2 = 2x tighter, 0.5 = 2x wider
) {
  // Convert center to pixel space to calculate the geographic extent
  const centerPxX = lngToTileX(centerLng, zoom) * TILE_SIZE;
  const centerPxY = latToTileY(centerLat, zoom) * TILE_SIZE;

  // Output is 3840x2160. Divide by cameraScale to zoom in/out.
  // Add 20% extra on each side to handle look-ahead shifting.
  const margin = 1.2;
  const halfW = ((3840 / 2) * margin) / cameraScale;
  const halfH = ((2160 / 2) * margin) / cameraScale;

  const topLeftPxX = centerPxX - halfW;
  const topLeftPxY = centerPxY - halfH;
  const botRightPxX = centerPxX + halfW;
  const botRightPxY = centerPxY + halfH;

  // Convert back to lng/lat for bounds
  const minLng = tileXToLng(topLeftPxX / TILE_SIZE, zoom);
  const maxLng = tileXToLng(botRightPxX / TILE_SIZE, zoom);
  const maxLat = tileYToLat(topLeftPxY / TILE_SIZE, zoom);
  const minLat = tileYToLat(botRightPxY / TILE_SIZE, zoom);

  // Use computeViewport with a bbox that covers the centered area
  return computeViewport(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    {
      zoom,
      padding: 0,
      offsetX: 0,
      offsetY: 0,
      provider: provider === "ocean-composite" ? "hillshade" : provider,
    },
  );
}
