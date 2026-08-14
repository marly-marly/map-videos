# Architecture

How this project turns a GPX file into a 4K video. Read this before making structural
changes; read [RENDERING-GOTCHAS.md](RENDERING-GOTCHAS.md) before touching anything that
affects what a frame looks like.

---

## The one-paragraph version

Every video is a React component that renders a **single frame** as a function of
`useCurrentFrame()`. There is no animation loop and no mutable timeline — Remotion calls the
component once per frame and screenshots the DOM. So all animation is expressed as
`frame -> style`, and anything asynchronous (a GPX fetch, a map tile, an image decode) must
block frame capture via `delayRender` until it's ready, or the screenshot catches a
half-built frame.

---

## Data flow

```
HK_Southern_Loop_2025.gpx            public/route.gpx
        │                                    │
        │ npm run prepare-gpx                │ fetched at runtime by the
        │ (offline, Turf simplify)           │ composition itself
        ▼                                    ▼
src/data/route-processed.json        lib/gpx-browser-parser  parseGPX()
        │                                    ▼
        │                            lib/route-processor     processRoute()
        │                                    │   → distances[], elevations[], totals
        │                                    ▼
        │                            lib/route-processor     extractSegment(startKm, endKm)
        │                                    │   → SegmentData for just this slice
        │                                    ▼
        │                            lib/tile-viewport       computeViewport() / centered
        │                                    │   → which tiles, at what zoom, cropped how
        │                                    ▼
        │                            lib/tile-viewport       coordsToPixels()
        │                                    │   → lng/lat → 3840×2160 pixel space
        ▼                                    ▼
  static PNG path                     SVG <path> + tile <img> grid
  (FullRouteOverview,                 (GPXSegment, IndyTracker)
   RouteSegmentVideo)
```

Two families of composition, distinguished by where the map comes from:

- **Pre-rendered PNG** — `FullRouteOverview`, `RouteSegmentVideo` and its per-segment
  wrappers. The basemap is a PNG baked once by `scripts/render-static-map.ts` and committed
  to `src/data/`, paired with a `*-meta.json` holding the viewport metadata and the projected
  pixel points. Cheap and deterministic; the camera can only pan/zoom within the baked image.
- **Live tiles** — `GPXSegment`, `IndyTracker`. `TileMapBackground` fetches a tile grid at
  render time. Expensive and network-dependent, but the camera can go anywhere at any zoom
  and providers can be crossfaded.

Active creative work happens in the live-tile family. The PNG family is effectively frozen.

---

## Layer stack

Both live-tile compositions build the frame as the same ordered stack of absolutely
positioned layers. Order matters, and `zIndex` is used sparingly:

```
 ┌───────────────────────────────────────────┐
 │ HUD (distance / elevation)      zIndex 10 │
 │ Vignette                        zIndex  5 │
 │ Dip-to-black overlay            zIndex 100│  ← above everything, only mid-transition
 │ Pinned photo thumbnails         zIndex  2 │  ← non-backdrop styles only
 │ SVG route: shadow, casing, line, dot      │
 │ Map tiles — end provider era (crossfade)  │
 │ Map tiles — start provider era            │  ← mixBlendMode applies here
 │ Backdrop photo layer                      │  ← backdrop style only
 │ Neutral blend-identity fill               │  ← see gotcha #4
 │ AbsoluteFill #0a0a0a                      │
 └───────────────────────────────────────────┘
```

The **map** carries the `mixBlendMode`, blending *down* into the backdrop photo beneath it.
Each tile-era container sets `isolation: isolate` so a secondary provider's blend stays
scoped inside its own era instead of leaking onto the photo.

---

## The master clock

One value drives nearly everything: `easedDraw`, in `[0, 1]`.

```
progress   = frame / durationInFrames
drawEnd    = 1 - holdAtEnd/100        (IndyTracker)   or  0.85  (GPXSegment)
easedDraw  = clamp01(progress / drawEnd)
```

`easedDraw` drives the route dash offset, the runner dot, the distance and elevation
counters, photo activation, and photo cross-fades. `holdAtEnd` shortens `drawEnd` so all of
that finishes early and freezes on the final frame. GPXSegment additionally supports
`reverseDrawing`, which inverts `easedDraw` so the route *un*draws.

The one deliberate exception is **backdrop photo movement**, which is paced in raw `frame`
time so Ken Burns and pans keep moving through the hold. See gotcha #11.

---

## Coordinate spaces

Four, and mixing them up is the most common source of subtle bugs:

| space | unit | produced by |
|---|---|---|
| geographic | `[lng, lat]` degrees | GPX parse |
| route distance | km along the track | `processRoute` → `segmentDistances[]` |
| tile pixel | global Web Mercator pixels at a zoom | `lib/mercator` |
| output pixel | 0..3840 × 0..2160 | `coordsToPixels(coords, viewport)` |

Two traps:
- **km fraction ≠ pixel-arc-length fraction.** Mercator scales with latitude and the plan
  view ignores elevation, so `peak.km / totalKm` is not the same fraction as
  `pixelLengthSoFar / totalPixelLength`. `FullRouteOverview`'s peak labels compare the two
  and can pop a hair early or late; the mismatch is called out in a comment there.
- **Zoom is clamped per provider.** `computeViewport` returns the *clamped* zoom, and all
  pixel maths must use that returned value rather than the requested one, or the route will
  sit offset from the tiles. See gotcha #8.

---

## Props: nested zod groups

`IndyTracker`, `GPXSegment`, and `FullRouteOverview` derive their props from a zod schema
rather than a hand-written interface:

```ts
const routeGroup  = z.object({ gpxFile: z.string().describe("…"), … });
const cameraGroup = z.object({ … });

export const indyTrackerSchema = z.object({
  route:  routeGroup.describe("Which GPX slice and for how long"),
  camera: cameraGroup.describe("How the camera follows the runner"),
  …
});
export type IndyTrackerProps = z.infer<typeof indyTrackerSchema>;
```

Why it's shaped this way:
- A nested `z.object()` renders as a **collapsible section** in the Studio props panel. With
  50+ knobs, a flat schema is unusable.
- `.describe()` on a *field* becomes its tooltip; on a *group* it becomes the section
  tooltip.
- `z.infer` means the type can never drift from the schema. **Never hand-maintain a props
  interface for these.**
- Passing `schema={…}` to `<Composition>` also makes props type-check properly, which is why
  these compositions need no `@ts-expect-error` (see below).

Conventions when adding a prop: put it in the group it belongs to, give it a `.describe()`
written for a non-programmer, use `min`/`max` so Studio renders a slider, and express
magnitudes as percentages where `100` means "the previous hardcoded default" — that keeps
existing renders unchanged when the prop is introduced.

`FullRouteOverview` deliberately uses a **flat** schema; with four booleans, sections would
be noise.

---

## Composition registry

`src/Root.tsx` is the single registry — if it isn't listed there, it doesn't exist. Three
tiers, in increasing order of health:

1. **Schema-bearing** (`GPXSegment`, `IndyTracker`, `PhotoSlideshow`, `FullRouteOverview`) —
   pass `schema={…}`, props fully type-checked, no suppressions. **New compositions should
   look like these.**
2. **Schema-less with `segmentPropsSchema`** — the 11 numbered `NN-Name-BingAerial` entries.
   These are the canonical export list for the final video.
3. **Legacy, suppressed** — the 13 older entries carrying
   `// @ts-expect-error Remotion Composition generics`. See "Known debt".

### Why `@ts-expect-error` was needed at all

Worth understanding before you copy the pattern. Remotion's `Composition` infers its `Props`
type parameter from exactly one site — the `component` prop — and constrains it to
`Record<string, unknown>`. TypeScript grants an *implicit index signature* to type
**aliases** but never to **`interface`** declarations. So a component whose props are
`export interface FooProps { … }` fails the constraint, inference silently falls back to
`Record<string, unknown>`, and the `component` assignment then errors.

The fix is a one-keyword change — `export type FooProps = { … }` — with no runtime effect.
That is why the schema-bearing compositions never hit this: their props are
`z.infer<typeof schema>`, which *is* a type alias.

---

## `delayRender`: the async contract

Anything async must hold a `delayRender` handle. Three instances:

| what | where | note |
|---|---|---|
| GPX fetch | `IndyTracker` / `GPXSegment` | one handle, released on load *or error* |
| tile grid | `TileMapBackground` | one handle **per distinct URL set**, re-acquired on every pan |
| photo decode | Remotion's `<Img>` | automatic, per render tab |

The iron rule: **every path must release the handle, including the error path.** A rejected
promise that skips `continueRender` hangs the frame until timeout. `TileMapBackground`
resolves failed tiles rather than rejecting them for exactly this reason (gotcha #7).

---

## Known debt

Deliberately not fixed, in rough priority order:

1. **24 near-identical wrapper components.** Each `NN-Name-BingAerial` wrapper is ~56 lines
   of pure prop forwarding differing only in a PNG filename, a meta JSON import, and a camera
   effect. They should collapse to one descriptor table plus a factory, with `Root.tsx`
   rendering the numbered set from a loop. The `defaultProps` trim that used to block this is
   done, so the 13 legacy wrappers now reduce cleanly to
   `(routeColor, routeWidth, mapFile, meta)` — one table row each.
2. **Unreferenced assets.** `public/full-route-overview.png`,
   `-cartodark.png`, and `-ocean.png` are not used by any component — all variants load
   `full-route-overview-composite.png`.
3. **The maplibre-gl path is vestigial.** `MapRouteVideo` → `MapRenderer` →
   `useRouteAnimation` → `route-utils` / `map-style` is the original implementation and pulls
   in the whole `maplibre-gl` dependency. Nothing else imports it, but it is still the target
   of `npm run render`, so it can't be deleted without redirecting that script.
4. **`elevationGainAtDraw`'s tail interpolation reads oddly.** The partial-step term is
   written `interpElev - elevs[i-1]`, which algebraically reduces to
   `t * (elevs[i] - elevs[i-1])`. The result is correct; the expression just looks like a
   half-finished edit. Left in its original form in both call sites so the refactor stayed
   provably behaviour-preserving. Safe to simplify, but do it as its own change.

### Duplication deliberately retained

`src/lib/route-geometry.ts`, `centered-viewport.ts`, `seeded-random.ts` and
`src/hooks/useGpxSegment.ts` hold what IndyTracker, GPXSegment and PhotoSlideshow genuinely
share. Four things were left duplicated on purpose — don't "finish the job" without reading
why:

- **`easedDraw` / `drawEnd`.** GPXSegment uses `0.85` plus a `reverseDrawing` inversion;
  IndyTracker derives it from `holdAtEnd` and has no reverse. Different product features, not
  accidental divergence. A shared helper would need four parameters to wrap three lines of
  arithmetic.
- **The `segmentPoints` memo.** Identical in both, but the body is a single call to the
  already-shared `coordsToPixels`. There is no logic left to extract.
- **`dashOffset`.** A one-liner; a lib call would be longer than the code.
- **The per-provider viewport memos.** GPXSegment fits bounds over the whole segment across
  up to three provider eras; IndyTracker centres on the moving runner. Superficially similar,
  fundamentally different. Only `computeCenteredViewport` was extracted, and its header says
  so explicitly.
