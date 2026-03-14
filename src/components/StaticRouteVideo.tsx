import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import staticMapMeta from "../data/static-map-meta.json";

export interface DevilsPeakProps {
  routeColor: string;
  routeWidth: number;
}

const meta = staticMapMeta as unknown as SegmentMeta;

export const DevilsPeak: React.FC<DevilsPeakProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="static-map.png"
    metaData={meta}
  />
);
