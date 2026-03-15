import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import tseungKwanOMeta from "../data/tseung-kwan-o-meta.json";

export interface TseungKwanOProps {
  routeColor: string;
  routeWidth: number;
}

const meta = tseungKwanOMeta as unknown as SegmentMeta;

export const TseungKwanO: React.FC<TseungKwanOProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="tseung-kwan-o.png"
    metaData={meta}
  />
);
