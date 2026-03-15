import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/beacon-hill-bing-aerial-meta.json";

export interface BeaconHillBingAerialProps {
  routeColor: string;
  routeWidth: number;
}

const typedMeta = meta as unknown as SegmentMeta;

export const BeaconHillBingAerial: React.FC<BeaconHillBingAerialProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="beacon-hill-bing-aerial.png"
    metaData={typedMeta}
  />
);
