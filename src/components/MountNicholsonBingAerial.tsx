import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/mount-nicholson-bing-aerial-meta.json";

export interface MountNicholsonBingAerialProps {
  routeColor: string;
  routeWidth: number;
  dotSize?: number;
  dotPulseSpeed?: number;
  routeGlow?: number;
  routeCasing?: number;
}

const typedMeta = meta as unknown as SegmentMeta;

export const MountNicholsonBingAerial: React.FC<MountNicholsonBingAerialProps> = ({
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
    mapFile="mount-nicholson-bing-aerial.png"
    metaData={typedMeta}
    cameraEffect={{ startZoom: 1.0, endZoom: 1.25, anchor: [0.44, 0.21] }}
  />
);
