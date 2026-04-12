import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/wan-chai-gap-bing-aerial-meta.json";

export interface WanChaiGapBingAerialProps {
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

export const WanChaiGapBingAerial: React.FC<WanChaiGapBingAerialProps> = ({
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
    mapFile="wan-chai-gap-bing-aerial.png"
    metaData={typedMeta}
    cameraEffect={{ startZoom: 1.3, endZoom: 1.0, anchor: [0.71, 0.76] }}
  />
);
