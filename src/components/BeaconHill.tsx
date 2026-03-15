import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import beaconHillMeta from "../data/beacon-hill-meta.json";

export interface BeaconHillProps {
  routeColor: string;
  routeWidth: number;
}

const meta = beaconHillMeta as unknown as SegmentMeta;

export const BeaconHill: React.FC<BeaconHillProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="beacon-hill.png"
    metaData={meta}
  />
);
