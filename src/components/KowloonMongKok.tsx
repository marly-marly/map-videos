import React from "react";
import { RouteSegmentVideo, SegmentMeta } from "./RouteSegmentVideo";
import kowloonMongKokMeta from "../data/kowloon-mong-kok-meta.json";

export interface KowloonMongKokProps {
  routeColor: string;
  routeWidth: number;
  dotSize?: number;
  dotPulseSpeed?: number;
  routeGlow?: number;
  routeCasing?: number;
}

const meta = kowloonMongKokMeta as unknown as SegmentMeta;

export const KowloonMongKok: React.FC<KowloonMongKokProps> = ({
  routeColor,
  routeWidth,
  dotSize,
  dotPulseSpeed,
  routeGlow,
  routeCasing,
}) => (
  <RouteSegmentVideo
    routeColor={routeColor}
    routeWidth={routeWidth}
    dotSize={dotSize}
    dotPulseSpeed={dotPulseSpeed}
    routeGlow={routeGlow}
    routeCasing={routeCasing}
    mapFile="kowloon-mong-kok.png"
    metaData={meta}
    cameraEffect={{ startZoom: 1.4, endZoom: 1.0, anchor: [0.41, 0.88] }}
  />
);
