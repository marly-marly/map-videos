/**
 * Carto raster basemaps require an API key (otherwise tiles are an
 * "API KEY REQUIRED" watermark). The key lives in .env as REMOTION_CARTO_KEY;
 * Remotion only exposes env vars with the REMOTION_ prefix to the bundle.
 */
export const withCartoKey = (url: string): string => {
  const key = process.env.REMOTION_CARTO_KEY;
  if (!key || !url.includes("basemaps.cartocdn.com")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}key=${key}`;
};
