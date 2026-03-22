import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const PHOTOS = [
  "DSC09415.jpg",
  "DSC09420.jpg",
  "DSC09421.jpg",
  "DSC09423.jpg",
  "DSC09430.jpg",
  "DSC09431.jpg",
  "DSC09440.jpg",
  "DSC09441.jpg",
];

/**
 * Style 02: Split-screen mosaic with staggered reveals.
 *
 * - Photos slide in from different directions with a spring animation
 * - Layout alternates between full-bleed, side-by-side, and grid arrangements
 * - Each "beat" lasts ~1.25s, with photos sliding out before the next beat
 */

type Layout = {
  photos: number[];
  positions: { x: string; y: string; w: string; h: string; from: "left" | "right" | "top" | "bottom" }[];
};

const LAYOUTS: Layout[] = [
  // Beat 1: Single hero
  {
    photos: [0],
    positions: [{ x: "0%", y: "0%", w: "100%", h: "100%", from: "bottom" }],
  },
  // Beat 2: Vertical split
  {
    photos: [1, 2],
    positions: [
      { x: "0%", y: "0%", w: "50%", h: "100%", from: "left" },
      { x: "50%", y: "0%", w: "50%", h: "100%", from: "right" },
    ],
  },
  // Beat 3: Single hero
  {
    photos: [3],
    positions: [{ x: "0%", y: "0%", w: "100%", h: "100%", from: "top" }],
  },
  // Beat 4: Horizontal split
  {
    photos: [4, 5],
    positions: [
      { x: "0%", y: "0%", w: "100%", h: "50%", from: "top" },
      { x: "0%", y: "50%", w: "100%", h: "50%", from: "bottom" },
    ],
  },
  // Beat 5: Triple
  {
    photos: [5, 6, 7],
    positions: [
      { x: "0%", y: "0%", w: "34%", h: "100%", from: "left" },
      { x: "34%", y: "0%", w: "33%", h: "100%", from: "bottom" },
      { x: "67%", y: "0%", w: "33%", h: "100%", from: "right" },
    ],
  },
  // Beat 6: Final hero with zoom
  {
    photos: [7],
    positions: [{ x: "0%", y: "0%", w: "100%", h: "100%", from: "right" }],
  },
];

export const PhotosDevilsPeak02: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const beatCount = LAYOUTS.length;
  const beatDuration = durationInFrames / beatCount; // 50 frames per beat

  const currentBeatIndex = Math.min(
    Math.floor(frame / beatDuration),
    beatCount - 1
  );
  const beatStart = currentBeatIndex * beatDuration;
  const beatFrame = frame - beatStart;

  const layout = LAYOUTS[currentBeatIndex];

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {layout.positions.map((pos, i) => {
        const photo = PHOTOS[layout.photos[i]];
        const stagger = i * 4;

        const slideIn = spring({
          frame: beatFrame - stagger,
          fps,
          config: { damping: 18, stiffness: 120, mass: 0.8 },
        });

        const exitProgress = interpolate(
          beatFrame,
          [beatDuration - 8, beatDuration],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const directionMap = {
          left: { enter: `translateX(-110%)`, exit: `translateX(-110%)` },
          right: { enter: `translateX(110%)`, exit: `translateX(110%)` },
          top: { enter: `translateY(-110%)`, exit: `translateY(-110%)` },
          bottom: { enter: `translateY(110%)`, exit: `translateY(110%)` },
        };

        const dir = directionMap[pos.from];

        // Subtle zoom during hold
        const holdScale = interpolate(
          beatFrame,
          [0, beatDuration],
          [1.02, 1.08],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        return (
          <div
            key={`${currentBeatIndex}-${i}`}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: pos.w,
              height: pos.h,
              overflow: "hidden",
              transform: interpolateTransform(slideIn, exitProgress, dir),
            }}
          >
            <Img
              src={staticFile(`photos-devils-peak/${photo}`)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${holdScale})`,
              }}
            />
          </div>
        );
      })}

      {/* Thin white grid lines for split layouts */}
      {layout.positions.length > 1 && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            opacity: interpolate(
              spring({ frame: beatFrame - 6, fps, config: { damping: 20, stiffness: 100 } }),
              [0, 1],
              [0, 0.6]
            ),
          }}
        >
          {layout.positions.length === 2 && layout.positions[1].x !== "0%" && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "0%",
                width: 4,
                height: "100%",
                backgroundColor: "white",
                transform: "translateX(-50%)",
              }}
            />
          )}
          {layout.positions.length === 2 && layout.positions[1].y === "50%" && (
            <div
              style={{
                position: "absolute",
                left: "0%",
                top: "50%",
                width: "100%",
                height: 4,
                backgroundColor: "white",
                transform: "translateY(-50%)",
              }}
            />
          )}
          {layout.positions.length === 3 && (
            <>
              <div
                style={{
                  position: "absolute",
                  left: "34%",
                  top: "0%",
                  width: 4,
                  height: "100%",
                  backgroundColor: "white",
                  transform: "translateX(-50%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "67%",
                  top: "0%",
                  width: 4,
                  height: "100%",
                  backgroundColor: "white",
                  transform: "translateX(-50%)",
                }}
              />
            </>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

function interpolateTransform(
  slideIn: number,
  exitProgress: number,
  dir: { enter: string; exit: string }
): string {
  if (exitProgress > 0) {
    const exitX = dir.exit.includes("translateX")
      ? parseFloat(dir.exit.match(/-?\d+/)![0]) * exitProgress
      : 0;
    const exitY = dir.exit.includes("translateY")
      ? parseFloat(dir.exit.match(/-?\d+/)![0]) * exitProgress
      : 0;
    return `translate(${exitX}%, ${exitY}%)`;
  }

  const enterX = dir.enter.includes("translateX")
    ? parseFloat(dir.enter.match(/-?\d+/)![0]) * (1 - slideIn)
    : 0;
  const enterY = dir.enter.includes("translateY")
    ? parseFloat(dir.enter.match(/-?\d+/)![0]) * (1 - slideIn)
    : 0;
  return `translate(${enterX}%, ${enterY}%)`;
}
