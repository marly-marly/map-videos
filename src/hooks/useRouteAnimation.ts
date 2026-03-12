import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { RouteData } from "../lib/route-utils";
import {
  getVisibleRoute,
  getCurrentPosition,
  getSmoothedBearing,
  getCurrentElevation,
  getLookaheadPosition,
} from "../lib/route-utils";
import type { Feature, LineString } from "geojson";

export interface CameraState {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface AnimationState {
  visibleRoute: Feature<LineString>;
  currentPosition: [number, number];
  currentDistanceKm: number;
  currentElevation: number;
  progress: number;
  camera: CameraState;
}

export function useRouteAnimation(routeData: RouteData): AnimationState {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const totalDistanceKm = routeData.properties.totalDistanceKm;
  const routeCenter = routeData.properties.center;

  // Map frame to progress (0 to 1)
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const currentDistanceKm = progress * totalDistanceKm;
  const visibleRoute = getVisibleRoute(routeData, currentDistanceKm);
  const currentPosition = getCurrentPosition(routeData, currentDistanceKm);
  const currentElevation = getCurrentElevation(routeData, currentDistanceKm);

  // Camera phases
  const camera = computeCamera(
    frame,
    durationInFrames,
    routeData,
    currentDistanceKm,
    currentPosition,
    routeCenter
  );

  return {
    visibleRoute,
    currentPosition,
    currentDistanceKm,
    currentElevation,
    progress,
    camera,
  };
}

function computeCamera(
  frame: number,
  totalFrames: number,
  routeData: RouteData,
  currentDistanceKm: number,
  currentPosition: [number, number],
  routeCenter: [number, number]
): CameraState {
  const progress = frame / totalFrames;

  const establishEnd = 0.05;
  const followEnd = 0.93;

  // During follow phase, use look-ahead position for smoother camera
  // Camera centers ~300m ahead of the runner so you see the route coming
  const lookaheadPos = getLookaheadPosition(routeData, currentDistanceKm, 0.3);

  // Bearing smoothed over 2km window with circular averaging
  const bearing = getSmoothedBearing(routeData, currentDistanceKm, 2.0);

  if (progress < establishEnd) {
    // Phase 1: Cinematic establishing shot — swoop in from overview
    const t = progress / establishEnd;
    const eased = Easing.inOut(Easing.cubic)(t);

    const startPos = routeData.geometry.coordinates[0] as [number, number];

    return {
      center: [
        routeCenter[0] + (startPos[0] - routeCenter[0]) * eased,
        routeCenter[1] + (startPos[1] - routeCenter[1]) * eased,
      ],
      zoom: 11.5 + eased * 4.5, // 11.5 → 16
      pitch: 25 + eased * 40, // 25 → 65
      bearing: bearing * eased, // ease into route bearing
    };
  }

  if (progress < followEnd) {
    // Phase 2: Follow the runner with smooth look-ahead camera
    // Subtle zoom breathing for cinematic feel — slow sine wave
    const followProgress = (progress - establishEnd) / (followEnd - establishEnd);
    const breathe = Math.sin(followProgress * Math.PI * 6) * 0.15;

    return {
      center: lookaheadPos,
      zoom: 15.8 + breathe,
      pitch: 65,
      bearing,
    };
  }

  // Phase 3: Cinematic pull-out to reveal full route
  const t = (progress - followEnd) / (1 - followEnd);
  const eased = Easing.inOut(Easing.cubic)(t);

  return {
    center: [
      lookaheadPos[0] + (routeCenter[0] - lookaheadPos[0]) * eased,
      lookaheadPos[1] + (routeCenter[1] - lookaheadPos[1]) * eased,
    ],
    zoom: 15.8 - eased * 4.3, // 15.8 → 11.5
    pitch: 65 - eased * 20, // 65 → 45
    bearing: bearing * (1 - eased), // ease bearing to 0
  };
}
