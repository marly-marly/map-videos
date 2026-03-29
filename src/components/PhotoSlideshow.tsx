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
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const photoSlideshowSchema = z.object({
  photos: z
    .string()
    .describe("Comma-separated photo paths (relative to public/, or just filenames if photosFolder is set)"),
  photosFolder: z
    .string()
    .describe("Subfolder in public/ (leave empty if photos contains full paths)"),
  style: z.enum([
    "ken-burns",
    "mosaic",
    "photo-prints",
    "film-strip",
    "parallax",
    "editorial-grid",
    "slide-push",
    "zoom-through-black",
  ]).describe("Layout style"),
  transitionType: z.enum([
    "crossfade",
    "blur-gaussian",
    "blur-radial",
    "blur-zoom",
    "fade-through-black",
  ]).describe("Transition effect between photos"),
  transitionDurationFrames: z
    .number()
    .min(3)
    .max(30)
    .describe("Transition duration in frames"),
  durationSeconds: z
    .number()
    .min(1)
    .max(120)
    .describe("Total video duration in seconds"),
  photoDurationSeconds: z
    .number()
    .min(0.5)
    .max(10)
    .describe("How long each photo is visible (seconds, used by non-mosaic styles)"),
  backgroundColor: z.string().describe("Background color (hex)"),
  borderStyle: z
    .enum(["none", "thin-white", "polaroid", "shadow"])
    .describe("Optional border/frame style"),
  zoomIntensity: z
    .number()
    .min(0)
    .max(50)
    .describe("Zoom intensity % (15 = default)"),
  zoomDirection: z
    .enum(["in", "out", "alternate"])
    .describe("Zoom direction: in, out, or alternating in/out"),
  randomSeed: z
    .number()
    .min(0)
    .max(9999)
    .describe("Seed for reproducible randomness (photo-prints)"),
});

export type PhotoSlideshowProps = z.infer<typeof photoSlideshowSchema>;

/** Dynamically set composition duration from the durationSeconds prop */
export const calculatePhotoSlideshowMetadata: Parameters<
  typeof import("remotion").Composition
>[0]["calculateMetadata"] = ({ props }) => {
  const p = props as PhotoSlideshowProps;
  return {
    durationInFrames: Math.round(p.durationSeconds * 30),
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function parsePhotos(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Resolve a photo path to a URL. Supports:
 *  - Absolute paths (C:\... or /...) → served via /local-files/ prefix
 *  - Relative names with folder → staticFile(folder/name)
 *  - Relative paths without folder → staticFile(path)
 */
function resolvePhotoSrc(photo: string, folder: string): string {
  // Absolute Windows path (C:\...) or Unix path (/...)
  if (/^[A-Za-z]:[\\/]/.test(photo) || photo.startsWith("/")) {
    // Serve via Webpack devServer's /local-files/ static mount
    const normalized = photo.replace(/\\/g, "/");
    return `/local-files/${normalized}`;
  }
  return staticFile(folder ? `${folder}/${photo}` : photo);
}

// ---------------------------------------------------------------------------
// Transition helper — computes opacity + CSS filter for any transition type
// ---------------------------------------------------------------------------

type TransitionType = "crossfade" | "blur-gaussian" | "blur-radial" | "blur-zoom" | "fade-through-black";

interface TransitionResult {
  opacity: number;
  filter: string;
}

function computeTransition(params: {
  frame: number;
  startFrame: number;
  endFrame: number;
  transitionFrames: number;
  transitionType: TransitionType;
  isFirst: boolean;
  isLast: boolean;
}): TransitionResult {
  const { frame, startFrame, endFrame, transitionFrames, transitionType, isFirst, isLast } = params;

  let opacity = 1;
  let filter = "";

  // Enter transition
  if (!isFirst && frame < startFrame + transitionFrames) {
    const t = interpolate(frame, [startFrame, startFrame + transitionFrames], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });

    switch (transitionType) {
      case "blur-gaussian":
        // Incoming: fade in while unblurring — outgoing stays opaque and blurs out
        opacity = t;
        filter = `blur(${interpolate(t, [0, 1], [25, 0])}px)`;
        break;
      case "blur-radial":
        opacity = t;
        filter = `blur(${interpolate(t, [0, 1], [18, 0])}px) brightness(${interpolate(t, [0, 1], [1.4, 1])})`;
        break;
      case "blur-zoom":
        opacity = t;
        filter = `blur(${interpolate(t, [0, 1], [15, 0])}px) contrast(${interpolate(t, [0, 1], [1.3, 1])}) saturate(${interpolate(t, [0, 1], [0.7, 1])})`;
        break;
      case "fade-through-black":
        opacity = t;
        break;
      case "crossfade":
      default:
        opacity = t;
        break;
    }
  }

  // Exit transition
  if (!isLast && frame > endFrame - transitionFrames) {
    const t = interpolate(frame, [endFrame - transitionFrames, endFrame], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });

    switch (transitionType) {
      case "blur-gaussian":
        // Outgoing: stay fully opaque, just blur out — incoming fades in on top
        filter = `blur(${interpolate(t, [0, 1], [0, 25])}px)`;
        break;
      case "blur-radial":
        filter = `blur(${interpolate(t, [0, 1], [0, 18])}px) brightness(${interpolate(t, [0, 1], [1, 1.4])})`;
        break;
      case "blur-zoom":
        filter = `blur(${interpolate(t, [0, 1], [0, 15])}px) contrast(${interpolate(t, [0, 1], [1, 1.3])}) saturate(${interpolate(t, [0, 1], [1, 0.7])})`;
        break;
      case "fade-through-black":
        opacity = 1 - t;
        break;
      case "crossfade":
      default:
        // Outgoing stays opaque — incoming fades in on top (no black bleed)
        break;
    }
  }

  return { opacity, filter };
}

// ---------------------------------------------------------------------------
// Ken Burns presets (cycling)
// ---------------------------------------------------------------------------

type KBPreset = {
  scaleFrom: number;
  scaleTo: number;
  xFrom: number;
  xTo: number;
  yFrom: number;
  yTo: number;
};

const KB_PRESETS: KBPreset[] = [
  { scaleFrom: 1.0, scaleTo: 1.18, xFrom: 0, xTo: -2, yFrom: 0, yTo: -1 },
  { scaleFrom: 1.15, scaleTo: 1.0, xFrom: -3, xTo: 2, yFrom: -1, yTo: 0 },
  { scaleFrom: 1.0, scaleTo: 1.12, xFrom: 2, xTo: -1, yFrom: 1, yTo: -1 },
  { scaleFrom: 1.12, scaleTo: 1.0, xFrom: 0, xTo: 0, yFrom: -2, yTo: 1 },
  { scaleFrom: 1.0, scaleTo: 1.2, xFrom: -1, xTo: 1, yFrom: 0, yTo: -2 },
  { scaleFrom: 1.18, scaleTo: 1.02, xFrom: 2, xTo: -2, yFrom: 1, yTo: 0 },
  { scaleFrom: 1.0, scaleTo: 1.15, xFrom: -2, xTo: 0, yFrom: -1, yTo: 1 },
  { scaleFrom: 1.1, scaleTo: 1.0, xFrom: 1, xTo: -1, yFrom: 0, yTo: -1 },
];

// ---------------------------------------------------------------------------
// Border wrapper
// ---------------------------------------------------------------------------

function PhotoWithBorder({
  src,
  borderStyle,
  style,
}: {
  src: string;
  borderStyle: string;
  style?: React.CSSProperties;
}) {
  const borderStyles: Record<string, React.CSSProperties> = {
    none: {},
    "thin-white": { border: "4px solid white" },
    polaroid: {
      borderTop: "6px solid white",
      borderLeft: "6px solid white",
      borderRight: "6px solid white",
      borderBottom: "48px solid white",
    },
    shadow: { boxShadow: "0 8px 40px rgba(0,0,0,0.6)" },
  };

  const bs = borderStyles[borderStyle] || {};
  const needsPadding = borderStyle === "polaroid" || borderStyle === "thin-white";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...bs,
        ...(style || {}),
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          ...(needsPadding ? {} : {}),
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style: Ken Burns
// ---------------------------------------------------------------------------

function RenderKenBurns({
  photoFiles,
  folder,
  frame,
  durationInFrames,
  transitionFrames,
  transitionType,
  photoDurationFrames,
  zoomIntensity,
  zoomDirection,
  backgroundColor,
  borderStyle,
}: StyleProps) {
  const pd = photoDurationFrames;

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {photoFiles.map((photo, i) => {
        const startFrame = i * pd;
        const endFrame = startFrame + pd;
        if (frame < startFrame - transitionFrames || frame > endFrame + transitionFrames) return null;

        const kb = KB_PRESETS[i % KB_PRESETS.length];
        const intensity = zoomIntensity / 0.15;

        const localProgress = interpolate(frame, [startFrame, endFrame], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const zoomIn = zoomDirection === "in" || (zoomDirection === "alternate" && i % 2 === 0);
        const baseScale = 1 + zoomIntensity;
        const scaleFrom = zoomIn ? 1 : baseScale;
        const scaleTo = zoomIn ? baseScale : 1;
        const scale = interpolate(localProgress, [0, 1], [scaleFrom, scaleTo]);
        // Clamp pan targets at each endpoint using that endpoint's scale,
        // then interpolate between the clamped values. This keeps the image
        // in-bounds at every frame and prevents mid-animation direction reversal.
        const maxPanStart = ((scaleFrom - 1) / scaleFrom) * 50;
        const maxPanEnd = ((scaleTo - 1) / scaleTo) * 50;
        const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
        const tx = interpolate(localProgress, [0, 1], [
          clamp(kb.xFrom * intensity, maxPanStart),
          clamp(kb.xTo * intensity, maxPanEnd),
        ]);
        const ty = interpolate(localProgress, [0, 1], [
          clamp(kb.yFrom * intensity, maxPanStart),
          clamp(kb.yTo * intensity, maxPanEnd),
        ]);

        const { opacity, filter } = computeTransition({
          frame, startFrame, endFrame, transitionFrames, transitionType,
          isFirst: i === 0, isLast: i === photoFiles.length - 1,
        });

        return (
          <AbsoluteFill
            key={i}
            style={{
              opacity,
              filter: filter || undefined,
              transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
            }}
          >
            <PhotoWithBorder
              src={resolvePhotoSrc(photo, folder)}
              borderStyle={borderStyle}
            />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Style: Mosaic
// Batching rules based on orientation of first photo in batch:
// - Portrait first: show this + next N portraits side by side (2-5 cols)
// - Landscape first with 3+ more landscapes following: 2x2 grid
// - Landscape first without 3 more landscapes: show as single full-frame
// ---------------------------------------------------------------------------

type MosaicBatch = {
  photos: string[];
  layout: "single" | "side-by-side" | "grid-2x2";
};

function buildMosaicBatches(
  photoFiles: string[],
  orientations: ("portrait" | "landscape")[]
): MosaicBatch[] {
  const batches: MosaicBatch[] = [];
  let i = 0;

  while (i < photoFiles.length) {
    const orient = orientations[i];

    if (orient === "portrait") {
      // Collect this + consecutive portraits (up to 5)
      let end = i + 1;
      while (
        end < photoFiles.length &&
        orientations[end] === "portrait" &&
        end - i < 5
      ) {
        end++;
      }
      const count = end - i;
      if (count >= 2) {
        batches.push({
          photos: photoFiles.slice(i, end),
          layout: "side-by-side",
        });
        i = end;
      } else {
        // Single portrait — show full frame
        batches.push({ photos: [photoFiles[i]], layout: "single" });
        i++;
      }
    } else {
      // Landscape — check if 3 more landscapes follow
      let consecutiveLandscapes = 1;
      for (let j = i + 1; j < photoFiles.length && j < i + 4; j++) {
        if (orientations[j] === "landscape") consecutiveLandscapes++;
        else break;
      }

      if (consecutiveLandscapes >= 4) {
        batches.push({
          photos: photoFiles.slice(i, i + 4),
          layout: "grid-2x2",
        });
        i += 4;
      } else {
        // Not enough for a grid — show each as single full-frame
        batches.push({ photos: [photoFiles[i]], layout: "single" });
        i++;
      }
    }
  }

  return batches;
}

function RenderMosaic({
  photoFiles,
  folder,
  frame,
  fps,
  durationInFrames,
  backgroundColor,
  transitionFrames,
  zoomIntensity,
}: StyleProps) {
  const gap = 6;

  // Detect orientation by loading images via <Img> — we approximate based on
  // common photo aspect ratios. For Remotion we can't measure at render time,
  // so we use a heuristic: filenames or a fixed list. Since we can't know
  // orientations at render time without async image loading, we'll use the
  // video aspect ratio as a proxy — photos wider than 16:9 are landscape.
  // For now, assume all photos from the folder follow the same convention.
  // The user will separate portrait/landscape batches in the photos list.
  //
  // Better approach: use delayRender + img.onload to detect. But for simplicity
  // we'll detect using a hidden img element approach with useState.

  const [orientations, setOrientations] = React.useState<
    ("portrait" | "landscape")[]
  >(() => photoFiles.map(() => "landscape")); // default

  const handle = React.useMemo(
    () => {
      try {
        // delayRender may not be available in all contexts
        const { delayRender } = require("remotion");
        return delayRender("Detecting photo orientations");
      } catch {
        return null;
      }
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    const results: ("portrait" | "landscape")[] = new Array(photoFiles.length).fill("landscape");
    let loaded = 0;

    photoFiles.forEach((photo, i) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        results[i] = img.naturalHeight > img.naturalWidth ? "portrait" : "landscape";
        loaded++;
        if (loaded === photoFiles.length) {
          setOrientations([...results]);
          if (handle) {
            try {
              const { continueRender } = require("remotion");
              continueRender(handle);
            } catch {}
          }
        }
      };
      img.onerror = () => {
        if (cancelled) return;
        loaded++;
        if (loaded === photoFiles.length) {
          setOrientations([...results]);
          if (handle) {
            try {
              const { continueRender } = require("remotion");
              continueRender(handle);
            } catch {}
          }
        }
      };
      img.src = resolvePhotoSrc(photo, folder);
    });

    return () => { cancelled = true; };
  }, [photoFiles.join(","), folder]);

  const batches = React.useMemo(
    () => buildMosaicBatches(photoFiles, orientations),
    [photoFiles, orientations]
  );

  // Distribute time equally across batches
  if (batches.length === 0) {
    return <AbsoluteFill style={{ backgroundColor }} />;
  }
  const batchDuration = durationInFrames / batches.length;
  const currentBatchIdx = Math.min(
    Math.floor(frame / batchDuration),
    batches.length - 1
  );
  const batchStart = currentBatchIdx * batchDuration;
  const batchFrame = frame - batchStart;
  const batch = batches[currentBatchIdx];

  const transFrames = transitionFrames;
  const isLastBatch = currentBatchIdx === batches.length - 1;

  const renderCell = (photo: string, i: number) => {
    const stagger = i * 5;
    const revealProgress = spring({
      frame: batchFrame - stagger,
      fps,
      config: { damping: 20, stiffness: 100, mass: 0.9 },
    });
    // zoomIntensity is already 0-0.5 (divided by 100 in main component). Default 0.15.
    const holdScale = interpolate(batchFrame, [0, batchDuration], [1 + 0.13 * zoomIntensity, 1 + 0.53 * zoomIntensity], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const slideY = interpolate(revealProgress, [0, 1], [30, 0]);

    // Exit fade near end of batch (not for last batch)
    const exitOpacity = isLastBatch
      ? 1
      : interpolate(
          batchFrame,
          [batchDuration - transFrames, batchDuration],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

    return (
      <div
        key={`${currentBatchIdx}-${i}`}
        style={{
          overflow: "hidden",
          transform: `translateY(${slideY}px)`,
          opacity: revealProgress * exitOpacity,
        }}
      >
        <Img
          src={resolvePhotoSrc(photo, folder)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${holdScale})`,
          }}
        />
      </div>
    );
  };

  let gridStyle: React.CSSProperties;

  if (batch.layout === "single") {
    gridStyle = {
      gridTemplateColumns: "1fr",
      gridTemplateRows: "1fr",
    };
  } else if (batch.layout === "side-by-side") {
    gridStyle = {
      gridTemplateColumns: `repeat(${batch.photos.length}, 1fr)`,
      gridTemplateRows: "1fr",
    };
  } else {
    // grid-2x2
    gridStyle = {
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
    };
  }

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "grid",
          gap,
          ...gridStyle,
        }}
      >
        {batch.photos.map((photo, i) => renderCell(photo, i))}
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Style: Photo Prints
// ---------------------------------------------------------------------------

function RenderPhotoPrints({
  photoFiles,
  folder,
  frame,
  fps,
  durationInFrames,
  photoDurationFrames,
  zoomIntensity,
  backgroundColor,
  borderStyle,
  randomSeed,
}: StyleProps) {
  const rng = seededRandom(randomSeed);

  // Pre-compute random positions for each photo
  const prints = photoFiles.map((photo, i) => {
    const rotation = (rng() - 0.5) * 16; // -8 to +8 degrees
    // Reduce scatter as photos get larger (zoomIntensity is 0-0.5 after /100)
    const scatter = Math.max(0.2, 1 - zoomIntensity * 2);
    const offsetX = (rng() - 0.5) * 20 * scatter;
    const offsetY = (rng() - 0.5) * 12 * scatter;
    const dropDelay = i * 8; // staggered drop
    return { photo, rotation, offsetX, offsetY, dropDelay };
  });

  const totalDuration = durationInFrames;
  const dropPhase = totalDuration * 0.7; // 70% of time for drops
  const dropInterval = photoFiles.length > 1 ? dropPhase / (photoFiles.length - 1) : dropPhase;

  return (
    <AbsoluteFill style={{ backgroundColor: backgroundColor || "#1a1a1a" }}>
      {prints.map((p, i) => {
        const dropStart = i * dropInterval;
        if (frame < dropStart) return null;

        const dropProgress = spring({
          frame: frame - dropStart,
          fps,
          config: { damping: 22, stiffness: 80, mass: 1.2 },
        });

        const scale = interpolate(dropProgress, [0, 1], [1.15, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // zoomIntensity is 0-0.5 (after /100 in main). Scale print size: 0→55%, 0.5→130%
        const photoW = 55 + zoomIntensity * 150; // 55% → 130%
        const photoH = 55 + zoomIntensity * 150; // 55% → 130%

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${50 + p.offsetX - photoW / 2}%`,
              top: `${50 + p.offsetY - photoH / 2}%`,
              width: `${photoW}%`,
              height: `${photoH}%`,
              transform: `rotate(${p.rotation}deg) scale(${scale})`,
              opacity: dropProgress,
              zIndex: i,
              boxShadow: "0 12px 60px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.4)",
              border: borderStyle === "polaroid" ? undefined : "3px solid rgba(255,255,255,0.15)",
              ...(borderStyle === "polaroid"
                ? {
                    padding: "8px 8px 56px 8px",
                    backgroundColor: "white",
                    border: "none",
                  }
                : {}),
              ...(borderStyle === "thin-white" ? { border: "4px solid white" } : {}),
            }}
          >
            <Img
              src={resolvePhotoSrc(p.photo, folder)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Style: Slow Pan
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Style: Film Strip
// ---------------------------------------------------------------------------

function RenderFilmStrip({
  photoFiles,
  folder,
  frame,
  durationInFrames,
  backgroundColor,
  borderStyle,
}: StyleProps) {
  const gap = 16; // px between frames
  const totalPhotos = photoFiles.length;
  // Each photo takes full viewport width; strip scrolls left
  const totalStripWidth = totalPhotos * 100; // in vw units
  const scrollProgress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scroll from first photo centered to last photo centered
  const maxScroll = (totalPhotos - 1) * 100;
  const currentScroll = scrollProgress * maxScroll;

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      {/* Film perforations top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 40,
          backgroundColor: "#111",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 60,
          paddingLeft: 20,
        }}
      >
        {Array.from({ length: 80 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 24,
              height: 16,
              borderRadius: 4,
              backgroundColor: "#333",
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Photos strip */}
      <div
        style={{
          position: "absolute",
          top: 40,
          bottom: 40,
          left: 0,
          display: "flex",
          transform: `translateX(-${currentScroll}vw)`,
          transition: "none",
        }}
      >
        {photoFiles.map((photo, i) => (
          <div
            key={i}
            style={{
              width: "100vw",
              height: "100%",
              flexShrink: 0,
              padding: `0 ${gap / 2}px`,
            }}
          >
            <Img
              src={resolvePhotoSrc(photo, folder)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        ))}
      </div>

      {/* Film perforations bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 40,
          backgroundColor: "#111",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 60,
          paddingLeft: 20,
        }}
      >
        {Array.from({ length: 80 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 24,
              height: 16,
              borderRadius: 4,
              backgroundColor: "#333",
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Style: Parallax
// ---------------------------------------------------------------------------

function RenderParallax({
  photoFiles,
  folder,
  frame,
  durationInFrames,
  transitionFrames,
  transitionType,
  photoDurationFrames,
  backgroundColor,
}: StyleProps) {
  const pd = photoDurationFrames;
  const fgSpeed = 1;
  const bgSpeed = 0.4;

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {photoFiles.map((photo, i) => {
        const startFrame = i * pd;
        const endFrame = startFrame + pd;
        if (frame < startFrame - pd || frame > endFrame + pd) return null;

        const localProgress = interpolate(frame, [startFrame, endFrame], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const isCurrent =
          frame >= startFrame - transitionFrames && frame <= endFrame + transitionFrames;
        const isBackground = !isCurrent;

        const speed = isBackground ? bgSpeed : fgSpeed;
        const tx = interpolate(localProgress, [0, 1], [5 * speed, -5 * speed]);
        const scale = isBackground ? 1.05 : 1.15;

        const trans = computeTransition({
          frame, startFrame, endFrame, transitionFrames, transitionType,
          isFirst: i === 0, isLast: i === photoFiles.length - 1,
        });

        return (
          <AbsoluteFill
            key={i}
            style={{
              opacity: isBackground ? trans.opacity * 0.3 : trans.opacity,
              filter: trans.filter || undefined,
              zIndex: isBackground ? 0 : 1,
            }}
          >
            <Img
              src={resolvePhotoSrc(photo, folder)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${scale}) translateX(${tx}%)`,
              }}
            />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Style: Editorial Grid
// ---------------------------------------------------------------------------

function RenderEditorialGrid({
  photoFiles,
  folder,
  frame,
  fps,
  durationInFrames,
  photoDurationFrames,
  backgroundColor,
  borderStyle,
}: StyleProps) {
  // Build grid beats: 2x2 grids (4 photos each) or 3-col (3 photos each)
  const beats: { photos: string[]; cols: number }[] = [];
  let idx = 0;
  let gridType = 0;
  while (idx < photoFiles.length) {
    const cols = gridType % 2 === 0 ? 2 : 3;
    const count = cols === 2 ? Math.min(4, photoFiles.length - idx) : Math.min(3, photoFiles.length - idx);
    beats.push({ photos: photoFiles.slice(idx, idx + count), cols });
    idx += count;
    gridType++;
  }

  const beatDuration = durationInFrames / beats.length;
  const currentBeatIndex = Math.min(Math.floor(frame / beatDuration), beats.length - 1);
  const beatStart = currentBeatIndex * beatDuration;
  const beatFrame = frame - beatStart;
  const beat = beats[currentBeatIndex];

  const rows = beat.cols === 2 ? 2 : 1;
  const gap = 12;

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <div
        style={{
          position: "absolute",
          top: gap,
          left: gap,
          right: gap,
          bottom: gap,
          display: "grid",
          gridTemplateColumns: `repeat(${beat.cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap,
        }}
      >
        {beat.photos.map((photo, i) => {
          const stagger = i * 6;
          const revealProgress = spring({
            frame: beatFrame - stagger,
            fps,
            config: { damping: 20, stiffness: 100, mass: 0.9 },
          });

          // Exit: all cells clip out together
          const exitProgress = interpolate(beatFrame, [beatDuration - 10, beatDuration], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const clipTop = interpolate(revealProgress, [0, 1], [100, 0]);
          const clipBottom = exitProgress > 0 ? interpolate(exitProgress, [0, 1], [0, 100]) : 0;

          // Subtle zoom during hold
          const holdScale = interpolate(beatFrame, [0, beatDuration], [1.05, 1.1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={`${currentBeatIndex}-${i}`}
              style={{
                overflow: "hidden",
                clipPath: `inset(${clipTop}% 0 ${clipBottom}% 0)`,
              }}
            >
              <Img
                src={resolvePhotoSrc(photo, folder)}
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
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Style: Slide Push — photos slide in from alternating directions, pushing
// the previous photo out. Clean, directional, very broadcast-feeling.
// ---------------------------------------------------------------------------

function RenderSlidePush({
  photoFiles,
  folder,
  frame,
  fps,
  durationInFrames,
  transitionFrames,
  photoDurationFrames,
  zoomIntensity,
  backgroundColor,
}: StyleProps) {
  const pd = photoDurationFrames;
  const zScale = 1 + zoomIntensity * 0.3;

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      {photoFiles.map((photo, i) => {
        const startFrame = i * pd;
        const endFrame = startFrame + pd;
        if (frame < startFrame - transitionFrames || frame > endFrame + transitionFrames) return null;

        // Alternate direction: even=left, odd=right
        const fromRight = i % 2 === 0;

        // Enter: slide from offscreen
        const enterProgress = i === 0 ? 1 : interpolate(
          frame, [startFrame, startFrame + transitionFrames], [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const enterX = fromRight
          ? interpolate(enterProgress, [0, 1], [100, 0])
          : interpolate(enterProgress, [0, 1], [-100, 0]);

        // Exit: push offscreen in opposite direction
        const exitProgress = (i < photoFiles.length - 1)
          ? interpolate(frame, [endFrame - transitionFrames, endFrame], [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 0;
        const exitX = fromRight
          ? interpolate(exitProgress, [0, 1], [0, -100])
          : interpolate(exitProgress, [0, 1], [0, 100]);

        const tx = enterProgress < 1 ? enterX : exitX;

        // Subtle zoom during hold
        const holdProgress = interpolate(frame, [startFrame, endFrame], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        const scale = interpolate(holdProgress, [0, 1], [zScale, zScale + zoomIntensity * 0.1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });

        return (
          <AbsoluteFill
            key={i}
            style={{
              transform: `translateX(${tx}%)`,
              zIndex: i,
            }}
          >
            <Img
              src={resolvePhotoSrc(photo, folder)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${scale})`,
              }}
            />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Style: Zoom Through Black — zoom into current photo until it goes dark,
// then zoom out from next photo. Creates a punchy, dramatic rhythm.
// ---------------------------------------------------------------------------

function RenderZoomThroughBlack({
  photoFiles,
  folder,
  frame,
  fps,
  durationInFrames,
  transitionFrames,
  photoDurationFrames,
  zoomIntensity,
  backgroundColor,
}: StyleProps) {
  const pd = photoDurationFrames;

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {photoFiles.map((photo, i) => {
        const startFrame = i * pd;
        const endFrame = startFrame + pd;
        if (frame < startFrame - transitionFrames || frame > endFrame + transitionFrames) return null;

        const localProgress = interpolate(frame, [startFrame, endFrame], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });

        // Enter: zoom out from very large + fade in
        let opacity = 1;
        let scale = 1 + zoomIntensity * 0.15;

        if (i > 0 && frame < startFrame + transitionFrames) {
          const t = interpolate(frame, [startFrame, startFrame + transitionFrames], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          opacity = t;
          scale = interpolate(t, [0, 1], [3 + zoomIntensity * 2, 1 + zoomIntensity * 0.15]);
        }

        // Exit: zoom in very large + fade out
        if (i < photoFiles.length - 1 && frame > endFrame - transitionFrames) {
          const t = interpolate(frame, [endFrame - transitionFrames, endFrame], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          opacity = 1 - t;
          scale = interpolate(t, [0, 1], [1 + zoomIntensity * 0.15, 3 + zoomIntensity * 2]);
        }

        // Subtle drift during hold
        const holdScale = interpolate(localProgress, [0, 1],
          [scale, scale + zoomIntensity * 0.05],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        return (
          <AbsoluteFill key={i} style={{ opacity }}>
            <Img
              src={resolvePhotoSrc(photo, folder)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${holdScale})`,
              }}
            />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Shared types for style renderers
// ---------------------------------------------------------------------------

interface StyleProps {
  photoFiles: string[];
  folder: string;
  frame: number;
  fps: number;
  durationInFrames: number;
  transitionFrames: number;
  transitionType: TransitionType;
  photoDurationFrames: number;
  zoomIntensity: number;
  zoomDirection: "in" | "out" | "alternate";
  backgroundColor: string;
  borderStyle: string;
  randomSeed: number;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const PhotoSlideshow: React.FC<PhotoSlideshowProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const photoFiles = parsePhotos(props.photos);
  const photoDurationFrames = Math.round(props.photoDurationSeconds * fps);
  // For grouped styles (mosaic, editorial-grid), use all photos since multiple
  // photos are shown per beat. For single-photo styles, cap to fit the duration.
  const isGroupedStyle = props.style === "mosaic" || props.style === "editorial-grid";
  const maxPhotos = isGroupedStyle
    ? photoFiles.length
    : Math.max(1, Math.floor(durationInFrames / photoDurationFrames));
  const activePhotos = photoFiles.slice(0, maxPhotos);

  const styleProps: StyleProps = {
    photoFiles: activePhotos,
    folder: props.photosFolder,
    frame,
    fps,
    durationInFrames,
    transitionFrames: props.transitionDurationFrames,
    transitionType: props.transitionType,
    photoDurationFrames,
    zoomIntensity: props.zoomIntensity / 100,
    zoomDirection: props.zoomDirection,
    backgroundColor: props.backgroundColor,
    borderStyle: props.borderStyle,
    randomSeed: props.randomSeed,
  };

  switch (props.style) {
    case "ken-burns":
      return <RenderKenBurns {...styleProps} />;
    case "mosaic":
      return <RenderMosaic {...styleProps} />;
    case "photo-prints":
      return <RenderPhotoPrints {...styleProps} />;
    case "film-strip":
      return <RenderFilmStrip {...styleProps} />;
    case "parallax":
      return <RenderParallax {...styleProps} />;
    case "editorial-grid":
      return <RenderEditorialGrid {...styleProps} />;
    case "slide-push":
      return <RenderSlidePush {...styleProps} />;
    case "zoom-through-black":
      return <RenderZoomThroughBlack {...styleProps} />;
    default:
      return <RenderKenBurns {...styleProps} />;
  }
};
