import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/mount-nicholson-bing-aerial-meta.json";

export interface MountNicholsonBingAerialProps {
  routeColor: string;
  routeWidth: number;
}

const typedMeta = meta as unknown as SegmentMeta;

export const MountNicholsonBingAerial: React.FC<MountNicholsonBingAerialProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="mount-nicholson-bing-aerial.png"
    metaData={typedMeta}
  />
);
