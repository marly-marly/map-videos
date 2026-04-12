import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/mong-kok-bing-aerial-meta.json";

export interface MongKokBingAerialProps {
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

export const MongKokBingAerial: React.FC<MongKokBingAerialProps> = ({
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
    mapFile="mong-kok-bing-aerial.png"
    metaData={typedMeta}
  />
);
