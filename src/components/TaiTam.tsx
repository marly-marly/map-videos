import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import taiTamMeta from "../data/tai-tam-meta.json";

export interface TaiTamProps {
  routeColor: string;
  routeWidth: number;
}

const meta = taiTamMeta as unknown as SegmentMeta;

export const TaiTam: React.FC<TaiTamProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="tai-tam.png"
    metaData={meta}
  />
);
