import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/wan-chai-gap-bing-aerial-meta.json";

export interface WanChaiGapBingAerialProps {
  routeColor: string;
  routeWidth: number;
}

const typedMeta = meta as unknown as SegmentMeta;

export const WanChaiGapBingAerial: React.FC<WanChaiGapBingAerialProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="wan-chai-gap-bing-aerial.png"
    metaData={typedMeta}
  />
);
