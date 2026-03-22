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
    cameraEffect={{ startZoom: 1.0, endZoom: 1.25, anchor: [0.44, 0.21] }}
  />
);
