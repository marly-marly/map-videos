import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/stanley-mound-bing-aerial-meta.json";

export interface StanleyMoundBingAerialProps {
  routeColor: string;
  routeWidth: number;
}

const typedMeta = meta as unknown as SegmentMeta;

export const StanleyMoundBingAerial: React.FC<StanleyMoundBingAerialProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="stanley-mound-bing-aerial.png"
    metaData={typedMeta}
  />
);
