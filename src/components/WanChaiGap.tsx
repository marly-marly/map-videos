import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import wanChaiGapMeta from "../data/wan-chai-gap-meta.json";

export interface WanChaiGapProps {
  routeColor: string;
  routeWidth: number;
}

const meta = wanChaiGapMeta as unknown as SegmentMeta;

export const WanChaiGap: React.FC<WanChaiGapProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="wan-chai-gap.png"
    metaData={meta}
  />
);
