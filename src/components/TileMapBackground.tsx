/**
 * Renders a map tile grid as positioned <img> elements.
 *
 * Uses delayRender/continueRender to ensure all tiles are loaded before
 * Remotion captures the frame. A fresh delayRender handle is acquired every
 * time the set of required tiles changes, so every frame waits for its own
 * tiles — not just the first one. We also prefetch via the Image() constructor
 * so tile completion is tracked independently of the DOM <img> tags, which
 * Remotion may sample before their load events fire in some browsers.
 *
 * Failed tiles are retried with exponential backoff before being given up on.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { continueRender, delayRender } from "remotion";
import type { TileViewport } from "../lib/tile-viewport";

interface TileMapBackgroundProps {
  viewport: TileViewport;
  style?: "satellite" | "ocean-composite";
  filter?: string;
  opacity?: number;
}

// Retry a tile URL up to MAX_RETRIES times with exponential backoff.
// Resolves (never rejects) so one flaky tile can't hang the whole frame.
const MAX_RETRIES = 6;
function prefetchTile(url: string, isCancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    let attempt = 0;
    const tryLoad = () => {
      if (isCancelled()) return resolve();
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => {
        if (isCancelled()) return resolve();
        if (attempt < MAX_RETRIES) {
          const delay = Math.min(3000, 250 * Math.pow(2, attempt));
          attempt++;
          setTimeout(tryLoad, delay);
        } else {
          // Give up — keep the frame moving. The <img> will keep its own
          // retry attempts via onError below.
          resolve();
        }
      };
      img.src = url;
    };
    tryLoad();
  });
}

export const TileMapBackground: React.FC<TileMapBackgroundProps> = ({
  viewport,
  style = "satellite",
  filter,
  opacity = 1,
}) => {
  const { gridWidth, gridHeight, cropLeft, cropTop, scale } = viewport;

  // Collect every tile URL the frame needs, so we can block rendering until
  // they're all fetched (or given up on).
  const allTileUrls = useMemo(() => {
    const urls: string[] = [];
    if (style === "ocean-composite") {
      const HILL_MAX_ZOOM = 16;
      const hillZoom = Math.min(viewport.zoom, HILL_MAX_ZOOM);
      const hillZoomDiff = viewport.zoom - hillZoom;
      const hillRatio = Math.pow(2, hillZoomDiff);

      if (hillZoomDiff === 0) {
        viewport.tiles.forEach((t) => {
          urls.push(
            `https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/${viewport.zoom}/${t.y}/${t.x}`
          );
        });
      } else {
        const mainMinX = viewport.tileMinX;
        const mainMinY = viewport.tileMinY;
        const mainMaxX = mainMinX + Math.ceil(gridWidth / 256) - 1;
        const mainMaxY = mainMinY + Math.ceil(gridHeight / 256) - 1;
        const hMinX = Math.floor(mainMinX / hillRatio);
        const hMaxX = Math.floor(mainMaxX / hillRatio);
        const hMinY = Math.floor(mainMinY / hillRatio);
        const hMaxY = Math.floor(mainMaxY / hillRatio);
        for (let ty = hMinY; ty <= hMaxY; ty++) {
          for (let tx = hMinX; tx <= hMaxX; tx++) {
            urls.push(
              `https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/${hillZoom}/${ty}/${tx}`
            );
          }
        }
      }
      viewport.tiles.forEach((t) => {
        urls.push(
          `https://basemaps.cartocdn.com/light_nolabels/${viewport.zoom}/${t.x}/${t.y}.png`
        );
      });
    } else {
      viewport.tiles.forEach((t) => urls.push(t.url));
    }
    return urls;
  }, [viewport, style, gridWidth, gridHeight]);

  // Stable join key — lets us depend on URL *contents* instead of array identity.
  const urlsKey = useMemo(() => allTileUrls.join("|"), [allTileUrls]);

  // One delayRender handle per distinct URL set. Every time the viewport pans
  // enough to pull in new tiles, we block the frame until those are loaded.
  useEffect(() => {
    if (allTileUrls.length === 0) return;
    const handle = delayRender("Loading map tiles", {
      timeoutInMilliseconds: 120000,
    });
    let cancelled = false;
    const isCancelled = () => cancelled;
    Promise.all(allTileUrls.map((url) => prefetchTile(url, isCancelled))).then(
      () => {
        if (!cancelled) continueRender(handle);
      }
    );
    return () => {
      cancelled = true;
      continueRender(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey]);

  // Retry state for the rendered <img> tags themselves. Even with prefetch,
  // the DOM tags have to re-decode the response from cache; if that fails
  // visibly we still want to retry rather than show a black square.
  const retryCount = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    retryCount.current.clear();
  }, [urlsKey]);

  const onTileError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const src = img.src;
    const retries = retryCount.current.get(src) || 0;
    if (retries < MAX_RETRIES) {
      retryCount.current.set(src, retries + 1);
      const delay = Math.min(3000, 250 * Math.pow(2, retries));
      setTimeout(() => {
        img.src = "";
        img.src = src;
      }, delay);
    }
  };

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: 3840,
    height: 2160,
    overflow: "hidden",
    opacity,
    filter,
  };

  const innerStyle: React.CSSProperties = {
    position: "absolute",
    width: gridWidth,
    height: gridHeight,
    transform: `translate(${-cropLeft * scale}px, ${-cropTop * scale}px) scale(${scale})`,
    transformOrigin: "0 0",
  };

  // Render tiles with GPU compositing to prevent sub-pixel seams
  const renderTileLayer = (tiles: typeof viewport.tiles, tileSize = 257) => (
    <div style={{ ...innerStyle, backfaceVisibility: "hidden" }}>
      {tiles.map((tile) => (
        <img
          key={`${tile.x}-${tile.y}`}
          src={tile.url}
          onError={onTileError}
          style={{
            position: "absolute",
            left: tile.pixelLeft,
            top: tile.pixelTop,
            width: tileSize,
            height: tileSize,
            display: "block",
            backgroundColor: "#0a0a0a",
          }}
        />
      ))}
    </div>
  );

  if (style === "ocean-composite") {
    // Hillshade tiles max out at ~zoom 16. Cap and scale up for higher zooms.
    const HILL_MAX_ZOOM = 16;
    const hillZoom = Math.min(viewport.zoom, HILL_MAX_ZOOM);
    const hillZoomDiff = viewport.zoom - hillZoom;
    const hillRatio = Math.pow(2, hillZoomDiff);

    let hillLayer;
    if (hillZoomDiff === 0) {
      // Same zoom — use viewport tiles directly
      const hillTiles = viewport.tiles.map((t) => ({
        ...t,
        url: `https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/${viewport.zoom}/${t.y}/${t.x}`,
      }));
      hillLayer = renderTileLayer(hillTiles);
    } else {
      // Lower zoom — compute which tiles cover the viewport and scale up
      const mainMinX = viewport.tileMinX;
      const mainMinY = viewport.tileMinY;
      const mainMaxX = mainMinX + Math.ceil(gridWidth / 256) - 1;
      const mainMaxY = mainMinY + Math.ceil(gridHeight / 256) - 1;
      const hMinX = Math.floor(mainMinX / hillRatio);
      const hMaxX = Math.floor(mainMaxX / hillRatio);
      const hMinY = Math.floor(mainMinY / hillRatio);
      const hMaxY = Math.floor(mainMaxY / hillRatio);
      const hTileSize = 256 * hillRatio;

      const hTiles: { x: number; y: number; pixelLeft: number; pixelTop: number; url: string }[] = [];
      for (let ty = hMinY; ty <= hMaxY; ty++) {
        for (let tx = hMinX; tx <= hMaxX; tx++) {
          hTiles.push({
            x: tx,
            y: ty,
            pixelLeft: (tx * hillRatio - mainMinX) * 256,
            pixelTop: (ty * hillRatio - mainMinY) * 256,
            url: `https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/${hillZoom}/${ty}/${tx}`,
          });
        }
      }
      hillLayer = (
        <div style={{ ...innerStyle, backfaceVisibility: "hidden" }}>
          {hTiles.map((tile) => (
            <img
              key={`hill-${tile.x}-${tile.y}`}
              src={tile.url}
              onError={onTileError}
              style={{
                position: "absolute",
                left: tile.pixelLeft,
                top: tile.pixelTop,
                width: hTileSize + 1,
                height: hTileSize + 1,
                display: "block",
                backgroundColor: "#0a0a0a",
              }}
            />
          ))}
        </div>
      );
    }

    // CartoDB Positron tiles for water coloring — light gray land, blue water,
    // works at all zoom levels. Blended on top of hillshade via multiply mode.
    const waterTiles = viewport.tiles.map((t) => ({
      ...t,
      url: `https://basemaps.cartocdn.com/light_nolabels/${viewport.zoom}/${t.x}/${t.y}.png`,
    }));

    return (
      <div style={containerStyle}>
        {hillLayer}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 3840,
            height: 2160,
            overflow: "hidden",
            mixBlendMode: "multiply",
            opacity: 1,
          }}
        >
          {renderTileLayer(waterTiles)}
        </div>
      </div>
    );
  }

  return <div style={containerStyle}>{renderTileLayer(viewport.tiles)}</div>;
};
