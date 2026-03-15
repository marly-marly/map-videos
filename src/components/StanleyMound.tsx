import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import stanleyMoundMeta from "../data/stanley-mound-meta.json";

export interface StanleyMoundProps {
  routeColor: string;
  routeWidth: number;
}

const meta = stanleyMoundMeta as unknown as SegmentMeta;

export const StanleyMound: React.FC<StanleyMoundProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="stanley-mound.png"
    metaData={meta}
  />
);
