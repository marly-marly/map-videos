import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import mountNicholsonMeta from "../data/mount-nicholson-meta.json";

export interface MountNicholsonProps {
  routeColor: string;
  routeWidth: number;
}

const meta = mountNicholsonMeta as unknown as SegmentMeta;

export const MountNicholson: React.FC<MountNicholsonProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="mount-nicholson.png"
    metaData={meta}
  />
);
