import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/tai-tam-bing-aerial-meta.json";

export interface TaiTamBingAerialProps {
  routeColor: string;
  routeWidth: number;
}

const typedMeta = meta as unknown as SegmentMeta;

export const TaiTamBingAerial: React.FC<TaiTamBingAerialProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="tai-tam-bing-aerial.png"
    metaData={typedMeta}
  />
);
