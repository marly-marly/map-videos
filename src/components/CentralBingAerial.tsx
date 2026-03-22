import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/central-bing-aerial-meta.json";

export interface CentralBingAerialProps {
  routeColor: string;
  routeWidth: number;
}

const typedMeta = meta as unknown as SegmentMeta;

export const CentralBingAerial: React.FC<CentralBingAerialProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="central-bing-aerial.png"
    metaData={typedMeta}
    cameraEffect={{ startZoom: 1.0, endZoom: 1.2, anchor: [0.51, 0.21] }}
  />
);
