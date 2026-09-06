import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/siu-ma-shan-bing-aerial-meta.json";

export type SiuMaShanBingAerialProps = {
  routeColor: string;
  routeWidth: number;
  dotSize?: number;
  dotPulseSpeed?: number;
  routeGlow?: number;
  routeCasing?: number;
  mapFileEnd?: string;
  tileTransitionStart?: number;
  tileTransitionEnd?: number;
  showDistance?: boolean;
  showElevation?: boolean;
  distanceLabel?: string;
  elevationLabel?: string;
};

const typedMeta = meta as unknown as SegmentMeta;

export const SiuMaShanBingAerial: React.FC<SiuMaShanBingAerialProps> = ({
  routeColor,
  routeWidth,
  dotSize,
  dotPulseSpeed,
  routeGlow,
  routeCasing,
  mapFileEnd,
  tileTransitionStart,
  tileTransitionEnd,
  showDistance,
  showElevation,
  distanceLabel,
  elevationLabel,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    dotSize={dotSize}
    dotPulseSpeed={dotPulseSpeed}
    routeGlow={routeGlow}
    routeCasing={routeCasing}
    mapFileEnd={mapFileEnd}
    tileTransitionStart={tileTransitionStart}
    tileTransitionEnd={tileTransitionEnd}
    showDistance={showDistance}
    showElevation={showElevation}
    distanceLabel={distanceLabel}
    elevationLabel={elevationLabel}
    mapFile="siu-ma-shan-bing-aerial.png"
    metaData={typedMeta}
    cameraEffect={{ startZoom: 1.25, endZoom: 1.0, anchor: [0.64, 0.22] }}
  />
);
