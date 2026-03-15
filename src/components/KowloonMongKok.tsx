import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import kowloonMongKokMeta from "../data/kowloon-mong-kok-meta.json";

export interface KowloonMongKokProps {
  routeColor: string;
  routeWidth: number;
}

const meta = kowloonMongKokMeta as unknown as SegmentMeta;

export const KowloonMongKok: React.FC<KowloonMongKokProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="kowloon-mong-kok.png"
    metaData={meta}
  />
);
