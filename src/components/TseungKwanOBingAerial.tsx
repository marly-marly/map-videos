import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/tseung-kwan-o-bing-aerial-meta.json";

export interface TseungKwanOBingAerialProps {
  routeColor: string;
  routeWidth: number;
  dotSize?: number;
  dotPulseSpeed?: number;
  routeGlow?: number;
  routeCasing?: number;
}

const typedMeta = meta as unknown as SegmentMeta;

export const TseungKwanOBingAerial: React.FC<TseungKwanOBingAerialProps> = ({
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
    mapFile="tseung-kwan-o-bing-aerial.png"
    metaData={typedMeta}
    cameraEffect={{ startZoom: 1.15, endZoom: 1.0, anchor: [0.5, 0.5] }}
  />
);
