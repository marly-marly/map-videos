import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import mongKokMeta from "../data/mong-kok-meta.json";

export interface MongKokProps {
  routeColor: string;
  routeWidth: number;
}

const meta = mongKokMeta as unknown as SegmentMeta;

export const MongKok: React.FC<MongKokProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="mong-kok.png"
    metaData={meta}
  />
);
