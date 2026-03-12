import React from "react";
import { AbsoluteFill } from "remotion";
import { MapRenderer } from "./MapRenderer";
import { KilometerCounter } from "./KilometerCounter";
import { useRouteAnimation } from "../hooks/useRouteAnimation";
import routeData from "../data/route-processed.json";
import type { RouteData } from "../lib/route-utils";

export interface MapRouteVideoProps {
  routeColor: string;
  routeWidth: number;
}

export const MapRouteVideo: React.FC<MapRouteVideoProps> = ({
  routeColor,
  routeWidth,
}) => {
  const route = routeData as unknown as RouteData;

  const {
    visibleRoute,
    currentPosition,
    currentDistanceKm,
    currentElevation,
    camera,
  } = useRouteAnimation(route);

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a2e" }}>
      <MapRenderer
        camera={camera}
        visibleRoute={visibleRoute}
        currentPosition={currentPosition}
        routeColor={routeColor}
        routeWidth={routeWidth}
      />
      <KilometerCounter
        distanceKm={currentDistanceKm}
        elevation={currentElevation}
        totalDistanceKm={route.properties.totalDistanceKm}
      />

      {/* Cinematic vignette */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />

      {/* Route name */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 80,
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 42,
          fontWeight: 700,
          color: "white",
          textShadow:
            "0 2px 12px rgba(0,0,0,0.9), 0 0px 4px rgba(0,0,0,0.5)",
          zIndex: 10,
        }}
      >
        {route.properties.name}
      </div>
    </AbsoluteFill>
  );
};
