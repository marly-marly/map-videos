import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import * as turf from "@turf/turf";
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
    routeCenter,
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

/**
 * Pre-compute a smooth camera path by heavily simplifying the route.
 * Returns a function that gives the camera [lng, lat] at any distance.
 * The result is a very gentle path that ignores small turns entirely.
 */
let _cachedCameraPath: {
  coords: [number, number][];
  distances: number[];
} | null = null;
let _cachedRouteId: string | null = null;

function getCameraPosition(
  routeData: RouteData,
  currentDistanceKm: number,
): [number, number] {
  // Cache the simplified path (expensive to compute)
  const routeId = `${routeData.geometry.coordinates.length}-${routeData.properties.totalDistanceKm}`;
  if (_cachedRouteId !== routeId) {
    const line = turf.lineString(routeData.geometry.coordinates);
    // Heavy simplification — tolerance ~0.005 degrees ≈ 500m
    // This produces a very smooth path with only the major direction changes
    const simplified = turf.simplify(line, {
      tolerance: 0.005,
      highQuality: true,
    });
    const simplifiedCoords = simplified.geometry.coordinates as [
      number,
      number,
    ][];

    // Compute cumulative distances along the simplified path
    const distances: number[] = [0];
    for (let i = 1; i < simplifiedCoords.length; i++) {
      const d = turf.distance(
        turf.point(simplifiedCoords[i - 1]),
        turf.point(simplifiedCoords[i]),
        { units: "kilometers" },
      );
      distances.push(distances[i - 1] + d);
    }

    _cachedCameraPath = { coords: simplifiedCoords, distances };
    _cachedRouteId = routeId;
  }

  const { coords, distances } = _cachedCameraPath!;
  const totalDist = distances[distances.length - 1];

  // Map the current route distance to a position on the simplified path
  // Scale proportionally since simplified path may be shorter
  const scaledDist =
    (currentDistanceKm / routeData.properties.totalDistanceKm) * totalDist;
  const clampedDist = Math.max(0, Math.min(totalDist, scaledDist));

  // Find and interpolate along simplified path
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= clampedDist) {
      const t =
        (clampedDist - distances[i - 1]) / (distances[i] - distances[i - 1]);
      return [
        coords[i - 1][0] + t * (coords[i][0] - coords[i - 1][0]),
        coords[i - 1][1] + t * (coords[i][1] - coords[i - 1][1]),
      ];
    }
  }
  return coords[coords.length - 1];
}

/**
 * Compute bearing from the simplified camera path — ultra smooth since
 * the simplified path has no small turns.
 */
function getCameraBearing(
  routeData: RouteData,
  currentDistanceKm: number,
): number {
  // Get two points on the simplified path slightly apart
  const behindKm = Math.max(0, currentDistanceKm - 1.0);
  const aheadKm = Math.min(
    routeData.properties.totalDistanceKm,
    currentDistanceKm + 1.0,
  );

  const p1 = getCameraPosition(routeData, behindKm);
  const p2 = getCameraPosition(routeData, aheadKm);

  // If points are too close, return 0
  const dist = Math.sqrt(
    (p2[0] - p1[0]) * (p2[0] - p1[0]) + (p2[1] - p1[1]) * (p2[1] - p1[1]),
  );
  if (dist < 0.00001) return 0;

  return turf.bearing(turf.point(p1), turf.point(p2));
}

function computeCamera(
  frame: number,
  totalFrames: number,
  routeData: RouteData,
  currentDistanceKm: number,
  currentPosition: [number, number],
  routeCenter: [number, number],
): CameraState {
  const progress = frame / totalFrames;

  const establishEnd = 0.05;
  const followEnd = 0.93;

  // Camera follows a heavily simplified version of the route (500m tolerance).
  // This produces ultra-smooth panning that only reacts to major direction changes.
  const smoothedPos = getCameraPosition(routeData, currentDistanceKm);

  // Bearing derived from the simplified camera path — inherently smooth
  const bearing = getCameraBearing(routeData, currentDistanceKm);

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
    // Phase 2: Follow the runner with smooth camera
    // Subtle zoom breathing for cinematic feel — slow sine wave
    const followProgress =
      (progress - establishEnd) / (followEnd - establishEnd);
    return {
      center: smoothedPos,
      zoom: 15.8,
      pitch: 65,
      bearing,
    };
  }

  // Phase 3: Cinematic pull-out to reveal full route
  const t = (progress - followEnd) / (1 - followEnd);
  const eased = Easing.inOut(Easing.cubic)(t);

  return {
    center: [
      smoothedPos[0] + (routeCenter[0] - smoothedPos[0]) * eased,
      smoothedPos[1] + (routeCenter[1] - smoothedPos[1]) * eased,
    ],
    zoom: 15.8 - eased * 4.3, // 15.8 → 11.5
    pitch: 65 - eased * 20, // 65 → 45
    bearing: bearing * (1 - eased), // ease bearing to 0
  };
}
