import type { StyleSpecification } from "maplibre-gl";

const CARTO_KEY = process.env.REMOTION_CARTO_KEY ?? "";

// Use CARTO Voyager "no labels" @2x tiles — high-res raster without text.
// No labels means no warped/mushy text on 3D terrain, and a cleaner cinematic look.
export const mapStyle: StyleSpecification = {
  version: 8,
  sources: {
    "carto-nolabels": {
      type: "raster",
      tiles: [
        `https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png?key=${CARTO_KEY}`,
        `https://b.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png?key=${CARTO_KEY}`,
        `https://c.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png?key=${CARTO_KEY}`,
        `https://d.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png?key=${CARTO_KEY}`,
      ],
      tileSize: 512,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      maxzoom: 20,
    },
    "terrain-dem": {
      type: "raster-dem",
      tiles: [
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 15,
      encoding: "terrarium",
    },
  },
  terrain: {
    source: "terrain-dem",
    exaggeration: 1.5,
  },
  layers: [
    {
      id: "carto-tiles",
      type: "raster",
      source: "carto-nolabels",
      minzoom: 0,
      maxzoom: 20,
    },
    {
      id: "hillshade",
      type: "hillshade",
      source: "terrain-dem",
      paint: {
        "hillshade-exaggeration": 0.5,
        "hillshade-shadow-color": "#000000",
        "hillshade-highlight-color": "#ffffff",
        "hillshade-illumination-direction": 315,
      },
    },
  ],
};
