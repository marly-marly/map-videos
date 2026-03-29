/**
 * Renders a map tile grid as positioned <img> elements.
 * Uses delayRender/continueRender to ensure all tiles are loaded before
 * Remotion captures the frame.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { continueRender, delayRender } from "remotion";
import type { TileViewport } from "../lib/tile-viewport";

interface TileMapBackgroundProps {
  viewport: TileViewport;
  style?: "satellite" | "ocean-composite";
  filter?: string;
  opacity?: number;
}

export const TileMapBackground: React.FC<TileMapBackgroundProps> = ({
  viewport,
  style = "satellite",
  filter,
  opacity = 1,
}) => {
  const { gridWidth, gridHeight, cropLeft, cropTop, scale } = viewport;

  // Collect all tile URLs that need to load for this frame
  const allTileUrls = React.useMemo(() => {
    const urls: string[] = [];
    if (style === "ocean-composite") {
      const HILL_MAX_ZOOM = 16;
      const hillZoom = Math.min(viewport.zoom, HILL_MAX_ZOOM);
      const hillZoomDiff = viewport.zoom - hillZoom;
      const hillRatio = Math.pow(2, hillZoomDiff);

      if (hillZoomDiff === 0) {
        viewport.tiles.forEach((t) => {
          urls.push(`https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/${viewport.zoom}/${t.y}/${t.x}`);
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
            urls.push(`https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/${hillZoom}/${ty}/${tx}`);
          }
        }
      }
      viewport.tiles.forEach((t) => {
        urls.push(`https://basemaps.cartocdn.com/light_nolabels/${viewport.zoom}/${t.x}/${t.y}.png`);
      });
    } else {
      viewport.tiles.forEach((t) => urls.push(t.url));
    }
    return urls;
  }, [viewport, style, gridWidth, gridHeight]);

  // Delay render until all tiles are loaded
  const [handle] = useState(() => delayRender("Loading map tiles", { timeoutInMilliseconds: 120000 }));
  const loadedCount = useRef(0);
  const totalTiles = allTileUrls.length;
  const continued = useRef(false);

  const onTileLoad = useCallback(() => {
    loadedCount.current++;
    if (loadedCount.current >= totalTiles && !continued.current) {
      continued.current = true;
      continueRender(handle);
    }
  }, [handle, totalTiles]);

  const onTileError = useCallback(() => {
    // Count errors as "loaded" so we don't block forever
    loadedCount.current++;
    if (loadedCount.current >= totalTiles && !continued.current) {
      continued.current = true;
      continueRender(handle);
    }
  }, [handle, totalTiles]);

  // Reset on tile URL changes
  useEffect(() => {
    loadedCount.current = 0;
    continued.current = false;
  }, [allTileUrls]);

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
          onLoad={onTileLoad}
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
            x: tx, y: ty,
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
              onLoad={onTileLoad}
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
