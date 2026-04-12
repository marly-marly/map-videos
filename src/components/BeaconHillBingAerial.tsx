import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/beacon-hill-bing-aerial-meta.json";

export interface BeaconHillBingAerialProps {
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
}

const typedMeta = meta as unknown as SegmentMeta;

export const BeaconHillBingAerial: React.FC<BeaconHillBingAerialProps> = ({
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
    mapFile="beacon-hill-bing-aerial.png"
    metaData={typedMeta}
    cameraEffect={{ startZoom: 1.25, endZoom: 1.0, anchor: [0.21, 0.75] }}
  />
);
