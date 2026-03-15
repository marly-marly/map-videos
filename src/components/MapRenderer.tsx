import React, { useEffect, useRef, useState } from "react";
import {
  continueRender,
  delayRender,
  useCurrentFrame,
} from "remotion";
import maplibregl from "maplibre-gl";
import { mapStyle } from "../lib/map-style";
import type { CameraState } from "../hooks/useRouteAnimation";
import type { Feature, LineString } from "geojson";

interface MapRendererProps {
  camera: CameraState;
  visibleRoute: Feature<LineString>;
  currentPosition: [number, number];
  routeColor: string;
  routeWidth: number;
}

export const MapRenderer: React.FC<MapRendererProps> = ({
  camera,
  visibleRoute,
  currentPosition,
  routeColor,
  routeWidth,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initializedRef = useRef(false);
  const [handle] = useState(() =>
    delayRender("Waiting for map to initialize")
  );
  const frame = useCurrentFrame();

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: camera.center,
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.bearing,
      interactive: false,
      fadeDuration: 0,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });

    // Suppress tile fetch errors (happens when scrubbing fast in Studio)
    map.on("error", (e) => {
      if (e.error?.message?.includes("Failed to fetch")) return;
      console.warn("Map error:", e.error);
    });

    map.once("idle", () => {
      // Add route source and layers
      map.addSource("route", {
        type: "geojson",
        data: visibleRoute,
      });

      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#000000",
          "line-width": routeWidth + 4,
          "line-opacity": 0.5,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": routeColor,
          "line-width": routeWidth,
          "line-opacity": 0.95,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      });

      // Runner marker
      map.addSource("runner", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: currentPosition,
          },
          properties: {},
        },
      });

      map.addLayer({
        id: "runner-glow",
        type: "circle",
        source: "runner",
        paint: {
          "circle-radius": 18,
          "circle-color": routeColor,
          "circle-opacity": 0.3,
          "circle-blur": 0.5,
        },
      });

      map.addLayer({
        id: "runner-dot",
        type: "circle",
        source: "runner",
        paint: {
          "circle-radius": 8,
          "circle-color": "#ffffff",
          "circle-stroke-color": routeColor,
          "circle-stroke-width": 4,
        },
      });

      mapRef.current = map;
      continueRender(handle);
    });
  }, []);

  // Update map on each frame
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateHandle = delayRender(`Waiting for map update frame ${frame}`);

    map.jumpTo({
      center: camera.center,
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.bearing,
    });

    // Update route data
    const routeSource = map.getSource("route") as maplibregl.GeoJSONSource;
    if (routeSource) {
      routeSource.setData(visibleRoute);
    }

    // Update runner position
    const runnerSource = map.getSource("runner") as maplibregl.GeoJSONSource;
    if (runnerSource) {
      runnerSource.setData({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: currentPosition,
        },
        properties: {},
      });
    }

    map.once("idle", () => {
      continueRender(updateHandle);
    });

    // Timeout fallback in case idle never fires
    const timeout = setTimeout(() => {
      try {
        continueRender(updateHandle);
      } catch {
        // Already continued
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [frame, camera, visibleRoute, currentPosition]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
};
