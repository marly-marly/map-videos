import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/stanley-mound-bing-aerial-meta.json";

export type StanleyMoundBingAerialProps = {
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

export const StanleyMoundBingAerial: React.FC<StanleyMoundBingAerialProps> = ({
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
    mapFile="stanley-mound-bing-aerial.png"
    metaData={typedMeta}
    cameraEffect={{ startZoom: 1.2, endZoom: 1.0, anchor: [0.53, 0.21] }}
  />
);
