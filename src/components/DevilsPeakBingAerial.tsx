import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/devils-peak-bing-aerial-meta.json";

export interface DevilsPeakBingAerialProps {
  routeColor: string;
  routeWidth: number;
  dotSize?: number;
  dotPulseSpeed?: number;
  routeGlow?: number;
  routeCasing?: number;
}

const typedMeta = meta as unknown as SegmentMeta;

export const DevilsPeakBingAerial: React.FC<DevilsPeakBingAerialProps> = ({
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
    mapFile="devils-peak-bing-aerial.png"
    metaData={typedMeta}
    cameraEffect={{ startZoom: 1.3, endZoom: 1.0, anchor: [0.72, 0.36] }}
  />
);
