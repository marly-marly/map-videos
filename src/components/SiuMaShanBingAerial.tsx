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
  />
);
