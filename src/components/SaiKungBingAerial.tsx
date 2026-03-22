import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import meta from "../data/sai-kung-bing-aerial-meta.json";

export interface SaiKungBingAerialProps {
  routeColor: string;
  routeWidth: number;
}

const typedMeta = meta as unknown as SegmentMeta;

export const SaiKungBingAerial: React.FC<SaiKungBingAerialProps> = ({
  routeColor,
  routeWidth,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    mapFile="sai-kung-bing-aerial.png"
    metaData={typedMeta}
    cameraEffect={{ startZoom: 2.2, endZoom: 1.0, anchor: [0.23, 0.66] }}
  />
);
