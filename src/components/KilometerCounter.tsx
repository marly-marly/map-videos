import React from "react";

interface KilometerCounterProps {
  distanceKm: number;
  elevation: number;
  totalDistanceKm: number;
}

export const KilometerCounter: React.FC<KilometerCounterProps> = ({
  distanceKm,
  elevation,
  totalDistanceKm,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 80,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 10,
      }}
    >
      {/* Distance */}
      <div
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 72,
          fontWeight: 700,
          color: "white",
          textShadow:
            "0 2px 12px rgba(0,0,0,0.9), 0 0px 4px rgba(0,0,0,0.5)",
          lineHeight: 1,
        }}
      >
        {distanceKm.toFixed(1)} km
      </div>

      {/* Elevation */}
      <div
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 36,
          fontWeight: 400,
          color: "rgba(255,255,255,0.85)",
          textShadow:
            "0 2px 8px rgba(0,0,0,0.9), 0 0px 4px rgba(0,0,0,0.5)",
          lineHeight: 1,
        }}
      >
        {Math.round(elevation)}m elev
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: 300,
          height: 6,
          backgroundColor: "rgba(255,255,255,0.2)",
          borderRadius: 3,
          overflow: "hidden",
          marginTop: 4,
        }}
      >
        <div
          style={{
            width: `${(distanceKm / totalDistanceKm) * 100}%`,
            height: "100%",
            backgroundColor: "#ff4444",
            borderRadius: 3,
            transition: "none",
          }}
        />
      </div>
    </div>
  );
};
