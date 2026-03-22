import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/siu-ma-shan-bing-aerial-meta.json";

export interface SiuMaShanBingAerialProps {
  routeColor: string;
  routeWidth: number;
}

const typedMeta = meta as unknown as SegmentMeta;

export const SiuMaShanBingAerial: React.FC<SiuMaShanBingAerialProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="siu-ma-shan-bing-aerial.png"
    metaData={typedMeta}
    cameraEffect={{ startZoom: 1.25, endZoom: 1.0, anchor: [0.64, 0.22] }}
  />
);
