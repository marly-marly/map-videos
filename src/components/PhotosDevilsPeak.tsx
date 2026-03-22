import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
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

type KenBurnsPreset = {
  scaleFrom: number;
  scaleTo: number;
  xFrom: number;
  xTo: number;
  yFrom: number;
  yTo: number;
};

const KB_PRESETS: KenBurnsPreset[] = [
  { scaleFrom: 1.0, scaleTo: 1.18, xFrom: 0, xTo: -2, yFrom: 0, yTo: -1 },
  { scaleFrom: 1.15, scaleTo: 1.0, xFrom: -3, xTo: 2, yFrom: -1, yTo: 0 },
  { scaleFrom: 1.0, scaleTo: 1.12, xFrom: 2, xTo: -1, yFrom: 1, yTo: -1 },
  { scaleFrom: 1.12, scaleTo: 1.0, xFrom: 0, xTo: 0, yFrom: -2, yTo: 1 },
  { scaleFrom: 1.0, scaleTo: 1.2, xFrom: -1, xTo: 1, yFrom: 0, yTo: -2 },
  { scaleFrom: 1.18, scaleTo: 1.02, xFrom: 2, xTo: -2, yFrom: 1, yTo: 0 },
  { scaleFrom: 1.0, scaleTo: 1.15, xFrom: -2, xTo: 0, yFrom: -1, yTo: 1 },
  { scaleFrom: 1.1, scaleTo: 1.0, xFrom: 1, xTo: -1, yFrom: 0, yTo: -1 },
];

const FADE_FRAMES = 9;

export const PhotosDevilsPeak: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const photoCount = PHOTOS.length;
  const photoDuration = durationInFrames / photoCount;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {PHOTOS.map((photo, i) => {
        const startFrame = i * photoDuration;
        const endFrame = startFrame + photoDuration;

        const kb = KB_PRESETS[i % KB_PRESETS.length];

        const localProgress = interpolate(
          frame,
          [startFrame, endFrame],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const scale = interpolate(localProgress, [0, 1], [kb.scaleFrom, kb.scaleTo]);
        const tx = interpolate(localProgress, [0, 1], [kb.xFrom, kb.xTo]);
        const ty = interpolate(localProgress, [0, 1], [kb.yFrom, kb.yTo]);

        let opacity: number;
        if (i === 0) {
          opacity = interpolate(
            frame,
            [endFrame - FADE_FRAMES, endFrame],
            [1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
        } else if (i === photoCount - 1) {
          opacity = interpolate(
            frame,
            [startFrame, startFrame + FADE_FRAMES],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
        } else {
          const fadeIn = interpolate(
            frame,
            [startFrame, startFrame + FADE_FRAMES],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const fadeOut = interpolate(
            frame,
            [endFrame - FADE_FRAMES, endFrame],
            [1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          opacity = Math.min(fadeIn, fadeOut);
        }

        if (frame < startFrame - FADE_FRAMES || frame > endFrame + FADE_FRAMES) {
          return null;
        }

        return (
          <AbsoluteFill
            key={photo}
            style={{
              opacity,
              transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
              willChange: "transform, opacity",
            }}
          >
            <Img
              src={staticFile(`photos-devils-peak/${photo}`)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
