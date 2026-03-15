import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/tseung-kwan-o-bing-aerial-meta.json";

export interface TseungKwanOBingAerialProps {
  routeColor: string;
  routeWidth: number;
}

const typedMeta = meta as unknown as SegmentMeta;

export const TseungKwanOBingAerial: React.FC<TseungKwanOBingAerialProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="tseung-kwan-o-bing-aerial.png"
    metaData={typedMeta}
  />
);
