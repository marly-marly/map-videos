/**
 * Renders a map tile grid as positioned <img> elements.
 */
import React from "react";
import type { TileViewport } from "../lib/tile-viewport";

interface TileMapBackgroundProps {
  viewport: TileViewport;
  style?: "satellite" | "terrain-composite";
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

  const renderTileLayer = (tiles: typeof viewport.tiles) => (
    <div style={innerStyle}>
      {tiles.map((tile) => (
        <img
          key={`${tile.x}-${tile.y}`}
          src={tile.url}
          style={{
            position: "absolute",
            left: tile.pixelLeft,
            top: tile.pixelTop,
            width: 256,
            height: 256,
            display: "block",
          }}
        />
      ))}
    </div>
  );

  if (style === "terrain-composite") {
    const hillTiles = viewport.tiles.map((t) => ({
      ...t,
      url: `https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/${viewport.zoom}/${t.y}/${t.x}`,
    }));
    const oceanTiles = viewport.tiles.map((t) => ({
      ...t,
      url: `https://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile/${viewport.zoom}/${t.y}/${t.x}`,
    }));

    return (
      <div style={containerStyle}>
        {renderTileLayer(hillTiles)}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 3840,
            height: 2160,
            overflow: "hidden",
            mixBlendMode: "multiply",
            opacity: 0.4,
          }}
        >
          {renderTileLayer(oceanTiles)}
        </div>
      </div>
    );
  }

  return <div style={containerStyle}>{renderTileLayer(viewport.tiles)}</div>;
};
