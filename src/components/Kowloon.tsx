import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import kowloonMeta from "../data/kowloon-meta.json";

export interface KowloonProps {
  routeColor: string;
  routeWidth: number;
}

const meta = kowloonMeta as unknown as SegmentMeta;

export const Kowloon: React.FC<KowloonProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="kowloon.png"
    metaData={meta}
  />
);
