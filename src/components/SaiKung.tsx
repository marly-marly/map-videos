import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import saiKungMeta from "../data/sai-kung-meta.json";

export interface SaiKungProps {
  routeColor: string;
  routeWidth: number;
}

const meta = saiKungMeta as unknown as SegmentMeta;

export const SaiKung: React.FC<SaiKungProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="sai-kung.png"
    metaData={meta}
  />
);
