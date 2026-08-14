import { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { parseGPX } from "../lib/gpx-browser-parser";
import { processRoute, extractSegment } from "../lib/route-processor";
import type { ProcessedRoute, SegmentData } from "../lib/route-processor";

export interface GpxSegmentState {
  /** Raw GPX XML, or null while the fetch is still in flight. */
  gpxData: string | null;
  /** Parsed + distance-annotated whole route, or null if parsing failed. */
  route: ProcessedRoute | null;
  /**
   * `endKm` clamped to the route's real length. Callers pass 9999 to mean
   * "to the end of the route"; clamping here means every downstream consumer
   * (and the useMemo dep array below) sees the real number instead.
   */
  actualEndKm: number;
  /** The requested startKm→actualEndKm slice, or null if not ready. */
  segment: SegmentData | null;
}

/**
 * Load a GPX file from public/ and slice out a km range.
 *
 * Owns the delayRender handshake: Remotion is told to hold off capturing any
 * frame until the fetch resolves, and continueRender() runs on both the success
 * and failure paths — forgetting the failure path is how you get a render that
 * hangs for the full 30s timeout on a typo'd filename rather than failing fast.
 *
 * Parse and slice failures are logged and surface as `null` rather than
 * throwing, because throwing from a composition body kills the whole render;
 * returning null lets the caller show a loading/error frame instead.
 */
export function useGpxSegment(
  gpxFile: string,
  startKm: number,
  endKm: number
): GpxSegmentState {
  const [gpxData, setGpxData] = useState<string | null>(null);
  const [gpxHandle] = useState(() =>
    delayRender("Loading GPX file", { timeoutInMilliseconds: 30000 })
  );

  useEffect(() => {
    fetch(staticFile(gpxFile))
      .then((r) => r.text())
      .then((text) => {
        setGpxData(text);
        continueRender(gpxHandle);
      })
      .catch(() => {
        console.error(`Failed to load GPX file: ${gpxFile}`);
        continueRender(gpxHandle);
      });
  }, [gpxFile, gpxHandle]);

  const route = useMemo(() => {
    if (!gpxData) return null;
    try {
      const parsed = parseGPX(gpxData);
      return processRoute(parsed.points);
    } catch (e) {
      console.error("GPX processing error:", e);
      return null;
    }
  }, [gpxData]);

  const actualEndKm = route ? Math.min(endKm, route.totalDistanceKm) : endKm;

  const segment = useMemo(() => {
    if (!route) return null;
    try {
      return extractSegment(route, startKm, actualEndKm);
    } catch (e) {
      console.error("Segment extraction error:", e);
      return null;
    }
  }, [route, startKm, actualEndKm]);

  return { gpxData, route, actualEndKm, segment };
}
