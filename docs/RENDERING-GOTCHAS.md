# Rendering gotchas

Hard-won lessons from debugging this project. Each entry is a bug that was actually hit,
diagnosed, and fixed — the fix is load-bearing, so **read the reasoning before changing the
code it describes**. Most of these are invisible in a static read of the source and only
show up as a one-frame flash or a stall in a 4K render.

---

## 1. Use Remotion's `<Img>`, never a plain `<img>`, for anything that fades

**Symptom:** a photo flickers or shows a single wrong frame partway through its fade-in.

**Cause:** a plain `<img>` does not participate in Remotion's frame-capture handshake. The
renderer can sample a frame while the browser is still decoding the image, capturing a
partially-decoded (or blank) bitmap.

**Fix:** import `Img` from `remotion` and use `<Img>` (capital I). It wraps a per-tab
`delayRender` around its own load, so every render worker waits for its own decode.

**This was measured, not theorised.** `RouteSegmentVideo` and `FullRouteOverview` used plain
`<img>` for their basemap PNGs. Rendering the *same* frame twice from *unchanged* code:

| composition | plain `<img>` | with `<Img>` |
|---|---|---|
| `Backup-Kowloon-BingAerial` f300 | max delta **245**, 73.98% of pixels differ | max delta **3**, 0.06% |
| `TseungKwanO` f300 | max delta **183**, 0.24% | max delta **2**, 0.04% |

The route line, dot and HUD were stable throughout — they're SVG/DOM. It was the aerial
basemap alternating between a full and a partial decode. Two lessons: the artifact is
nondeterministic, so it appears on *some* frames of a long render and not others; and it
inflated these compositions' pixel-comparison noise floor to 245, making any before/after
verification on them meaningless until fixed.

---

## 2. A `<Img>` that first mounts mid-timeline stalls the render

**Symptom:** the video visibly hitches at the exact moment a new photo is supposed to
appear, even though the photo itself is correct.

**Cause:** `<Img>` calls `delayRender` on mount. If the element first mounts at, say, frame
300, the renderer pauses at frame 300 waiting for the decode. In Studio playback this reads
as a stutter; in a render it's a real stall.

**Fix:** mount the element at frame 0 with `opacity: 0` and animate opacity, rather than
conditionally rendering it into existence later. The decode then happens at frame 0 where a
pause is invisible, and the image is ready by the time it needs to be seen.

In `IndyTracker.tsx` this is why `inApproachWindow` deliberately has **no** lower bound on
`blendActivation` — photo[0] is mounted from frame 0 even when it is fully transparent. A
comment marks this; do not "optimise" it away.

`RouteSegmentVideo.tsx` has the same pattern for its tile-crossfade layer. That layer used to
be conditionally rendered behind an `if (endOpacity <= 0) return null` guard, which was
harmless while it was a plain `<img>` — but the moment it became an `<Img>` (see #1) that
guard would have made it mount mid-timeline and stall the render exactly at the crossfade.
It is now mounted from frame 0 at opacity 0. **Fixing #1 and #2 together is not optional:**
converting a conditionally-rendered `<img>` to `<Img>` without also hoisting its mount just
trades one artifact for a worse one.

---

## 3. Keep the React key stable across conditional render branches

**Symptom:** a photo flashes at the boundary between two rendering states, even though both
states compute a correct opacity.

**Cause:** if branch A renders `<div key="approach">` and branch B renders
`<div key="from-0">`, React unmounts one and mounts the other at the boundary. The freshly
mounted `<Img>` re-fires its `delayRender` (see #2) and the DOM element loses its decoded
bitmap for a frame.

**Fix:** route both states through the same render function with the **same key**, and vary
only the style. `IndyTracker.tsx`'s `renderLayer(role, idx, isApproach)` exists precisely
for this — the approach state and the post-trigger "from" state both render with key
`backdrop-from-0`.

---

## 4. CSS blend modes are not animatable — cross-fade a neutral layer instead

**Symptom:** you want the map's `mix-blend-mode` to "come in" gradually, but any attempt to
interpolate the blend mode itself does nothing (it's a discrete property).

**Fix:** keep the blend mode constant and cross-fade what sits *beneath* it. Put a solid
layer of the blend mode's **identity colour** behind the photo and fade that layer out as
the photo fades in. The identity colour is the colour that makes the blend a no-op:

| Blend mode | Identity | Blend mode | Identity |
|---|---|---|---|
| `multiply`, `darken`, `color-burn` | white `#ffffff` | `screen`, `lighten`, `color-dodge`, `difference`, `exclusion` | black `#000000` |
| `normal` | transparent | `overlay`, `hard-light`, `soft-light` | mid-grey `#808080` |
| `hue`, `saturation`, `color`, `luminosity` | mid-grey `#808080` (approximation — these have no true identity colour) | | |

This table is `BLEND_NEUTRAL` in `IndyTracker.tsx`. The alpha compositing works out because
a photo at opacity `p` over a neutral layer at opacity `1 - p` gives full coverage at every
`p`, so the map always has something benign to blend against.

---

## 5. Pan headroom: the scale baseline and the translate distance must scale together

**Symptom:** black wedges creep in at the edges of a panning backdrop photo.

**Cause:** a `translate` on a `cover`-fitted image moves it off its own box. You need the
image scaled up enough that the translate stays inside the overflow.

**The invariant:** for `scale(S)`, the overflow available on *each* side is `(S - 1) / 2` of
the element size. So a `±T%` translate is safe iff `T <= 50 * (S - 1)`.

The pan modes use `S = 1 + 0.15 * mag` and `T = 4 * mag`, which uses
`4 / 7.5 ≈ 53%` of the available headroom **at every value of `mag`** — both terms are
linear in `mag`, so the safety margin is scale-invariant. If you change one coefficient you
must change the other. At `mag = 0` it degenerates safely to `scale(1)` with no travel.

Ken Burns uses a fixed `1.1` baseline (7.5% headroom in the unscaled case is not needed
because its drift is capped at 3.5%) plus a `mag`-scaled zoom delta, so the photo still
drifts even at `mag = 0`.

---

## 6. Compute SVG path length in JS, not via `getTotalLength()`

**Symptom:** the runner dot visibly detaches from the end of the route line for one frame,
specifically while the camera is panning.

**Cause:** `SVGPathElement.getTotalLength()` / `getPointAtLength()` require the DOM to be
committed, so they can only be read in an effect. That's one frame *late*: when the viewport
pans, `segmentPoints` changes, the path re-renders, but the dot is still positioned from the
previous frame's measurement.

**Fix:** compute cumulative segment lengths synchronously from the same points array used to
build the path (`pathMetrics` in `IndyTracker.tsx` / `GPXSegment.tsx`), and binary-search it
for the dot position. Dot and line then derive from one source of truth every frame.

Note this measures **polyline** length, not bezier arc length. For the smoothing tensions
actually used the two agree to well under a pixel, and crucially the dot then sits on the
polyline vertices the path passes through — so it tracks the *visible* line rather than
floating ahead of it. The older `FullRouteOverview*` compositions still use the
`getTotalLength()` pattern; they get away with it because their camera is static.

---

## 7. Tile fetch failures must resolve, never reject

`TileMapBackground.tsx` prefetches every tile with `new Image()` and up to 6 retries with
exponential backoff (capped at 3 s), holding one `delayRender` handle per distinct URL set.

Failed tiles **resolve** rather than reject. If a failure rejected, one bad CDN response
would hold a `delayRender` handle open until the frame timeout and stall the whole render.
Resolving means a bad tile degrades to a gap instead of killing the frame. Frame timeout is
120 s in the component and 60 s globally in `remotion.config.ts`.

---

## 8. Esri's advertised zoom levels lie

Esri `MapServer` metadata advertises levels-of-detail that have no actual imagery behind
them for a given region. Requesting above real coverage returns a "Map data not available"
placeholder tile, not a 404 — so it fails *silently* and looks like a rendering bug.

`TILE_MAX_ZOOM` in `src/lib/tile-viewport.ts` caps each provider empirically (tested against
tile byte sizes for the Hong Kong region). NatGeo advertises z16 but only has real HK tiles
to z12. Other regions may support higher zoom; the caps are deliberately conservative so
they hold globally. `clampZoomForProvider()` applies them, and `computeViewport()` returns
the clamped zoom so route/dot pixel maths stays consistent with the tile grid.

---

## 9. The distance counter reads the distances array, not a linear interpolation

`currentDistanceKm` indexes into `segment.segmentDistances` rather than interpolating
`startKm → endKm` linearly. This is intentional: the GPX has gaps where the route crosses
water by ferry. Indexing the real distances array makes the on-screen counter **freeze**
during a ferry crossing instead of ticking up through a distance nobody ran.

---

## 10. `--gl=angle` on Windows, `--concurrency=1` for the tile CDNs

`--gl=angle` is required for stable WebGL/canvas output on Windows. It's set globally in
`remotion.config.ts` and re-passed in the npm scripts so a direct
`npx remotion render …` still gets it.

`--concurrency=1` is defensive: multiple render worker tabs hammering the tile CDNs in
parallel gets you throttled, which surfaces as tile timeouts. Raise it only if you've
confirmed the providers tolerate it.

---

## 11. `holdAtEnd` freezes the line but not the photo movement

`easedDraw` is the master clock for line drawing, dot position, distance/elevation counters,
photo activation, and photo cross-fades. `holdAtEnd` shortens `drawEnd` so all of those
finish early and hold on the final frame.

Backdrop **photo movement** deliberately does not use that clock. `backdropProgressFor()`
is paced in raw `frame` time so Ken Burns / pans keep moving through the hold. Non-last
photos still start and end on the same frames the line-driven cadence would have given, so
only the trailing photo gets the extended lifetime.

That function also applies a **pre-roll and tail extension**: the movement window is shifted
to span the photo's *visible* window (from when its fade-in begins to when its fade-out
ends) rather than its activation window. Without the shift the photo sits motionless through
its whole fade-in, jerks into motion once opaque, then freezes again during its fade-out.
