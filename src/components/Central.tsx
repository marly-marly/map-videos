import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import centralMeta from "../data/central-meta.json";

export interface CentralProps {
  routeColor: string;
  routeWidth: number;
}

const meta = centralMeta as unknown as SegmentMeta;

export const Central: React.FC<CentralProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="central.png"
    metaData={meta}
  />
);
