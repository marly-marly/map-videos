import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import siuMaShanMeta from "../data/siu-ma-shan-meta.json";

export interface SiuMaShanProps {
  routeColor: string;
  routeWidth: number;
}

const meta = siuMaShanMeta as unknown as SegmentMeta;

export const SiuMaShan: React.FC<SiuMaShanProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="siu-ma-shan.png"
    metaData={meta}
  />
);
