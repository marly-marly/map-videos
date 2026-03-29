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
}

const typedMeta = meta as unknown as SegmentMeta;

export const MongKokBingAerial: React.FC<MongKokBingAerialProps> = ({
  routeColor,
  routeWidth,
  dotSize,
  dotPulseSpeed,
  routeGlow,
  routeCasing,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    dotSize={dotSize}
    dotPulseSpeed={dotPulseSpeed}
    routeGlow={routeGlow}
    routeCasing={routeCasing}
    mapFile="mong-kok-bing-aerial.png"
    metaData={typedMeta}
  />
);
