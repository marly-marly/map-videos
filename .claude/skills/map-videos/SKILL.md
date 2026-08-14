---
name: map-videos
description: Use when working in the map-videos Remotion project — editing or adding video compositions, tuning route/camera/photo props, adding map tile providers, debugging rendering artifacts (flicker, black edges, stalls, missing tiles), or rendering output. Covers IndyTracker, GPXSegment, FullRouteOverview, and PhotoSlideshow.
---

# map-videos

Remotion project rendering 4K (3840×2160 @ 30fps) trail-run videos of the **HK Southern Loop
2025** route. Every video is a React component in `src/components/` registered in
`src/Root.tsx`.

## Orient yourself first

Read these before making non-trivial changes — they exist so you don't have to rediscover
things the hard way:

| file | when |
|---|---|
| `docs/ARCHITECTURE.md` | any structural change; explains data flow, layer stack, coordinate spaces, known debt |
| `docs/RENDERING-GOTCHAS.md` | **any change affecting what a frame looks like** — 11 real debugged bugs |
| `README.md` | commands, provider list, troubleshooting |

## Commands

```bash
npm run studio      # dev server → http://localhost:3000  (NOT `npm start` — no such script)
npm run prepare-gpx # re-simplify the source GPX after replacing it
```

```bash
npx remotion compositions
```

```bash
npx remotion still IndyTracker out/f.png --frame=300 --gl=angle
```

```bash
npx remotion render IndyTracker --gl=angle --concurrency=1 out/indy.mp4
```

`--gl=angle` is required on Windows. `--concurrency=1` keeps the tile CDNs from throttling.
A full 4K render takes many minutes — prefer `remotion still` at a chosen frame when
verifying a visual change, and pick a frame where the thing you changed is actually visible.

The repo also has `.claude/launch.json` with a `remotion-studio` config, so `preview_start`
can launch Studio by name rather than shelling out.

## The mental model that matters

Remotion renders **one frame at a time** as a pure function of `useCurrentFrame()`. There is
no animation loop. Consequences that trip people up:

- All animation is `frame -> style`. Never `setTimeout`, never CSS transitions, never
  `Date.now()`.
- Anything async (GPX fetch, map tile, image decode) **must** hold a `delayRender` handle
  until ready, and **must** release it on every path including errors — or the frame hangs
  until timeout.
- A component mounting mid-timeline fires a fresh `delayRender` and stalls the render at that
  frame. Mount at frame 0 with `opacity: 0` instead. (Gotcha #2 — this one is not obvious.)

One value, `easedDraw` in `[0,1]`, is the master clock for the route line, dot, counters, and
photo activation. `holdAtEnd` shortens it so everything finishes early and holds. Backdrop
*photo movement* is deliberately paced in raw frame time instead, so it keeps moving through
the hold.

## Adding or changing a prop

The flagship compositions derive props from nested zod groups — `z.infer<typeof schema>`,
never a hand-written interface. Nested `z.object()`s become collapsible sections in the Studio
panel.

1. Add the field to the **existing group** it belongs to (`route`, `map`, `camera`, `line`,
   `photos`/`fade`, `hud`) — not at the top level.
2. Give it `.describe()` written for a non-programmer; it's the Studio tooltip.
3. Use `.min()`/`.max()` so Studio renders a slider. Make the range generous — the user has
   asked to widen ranges more than once.
4. Express magnitudes as **percentages where `100` = the previous hardcoded default**. This
   keeps every existing render byte-identical when the prop lands.
5. Add the matching default to that composition's `defaultProps` in `src/Root.tsx`. Forgetting
   this is the most common mistake — the schema and `defaultProps` must stay in sync.
6. Destructure it in the component's per-group destructuring block near the top.

For a **per-item** value, prefer a comma-separated string prop over N scalars — `photoPositions`
and `photoZoomAmount` do this. Convention: parse with `.split(",").map(parseFloat).filter(n => !isNaN(n))`,
let a single value apply to everything, and let the **last value repeat** when the list is
shorter than the item count.

## Visual invariants you must not break

These are load-bearing. Full reasoning in `docs/RENDERING-GOTCHAS.md`.

- **Use Remotion's `<Img>`, never plain `<img>`,** for anything that fades. A plain `<img>`
  gets sampled mid-decode → one-frame flash.
- **Keep React keys stable** across conditional render branches. A changed key remounts the
  element, re-fires `delayRender`, and flashes.
- **Pan headroom:** for `scale(S)` with a `±T%` translate, safety requires `T <= 50*(S-1)`.
  The pan modes use `S = 1 + 0.15*mag`, `T = 4*mag` — both linear in `mag`, so the margin
  holds at every value. **Change one coefficient and you must change the other**, or black
  edges appear.
- **Blend modes aren't animatable.** To ramp one in, cross-fade a solid layer of the blend
  mode's *identity colour* beneath it (`BLEND_NEUTRAL` in `IndyTracker.tsx`).
- **Compute SVG path length in JS**, not `getTotalLength()`. The DOM-measured version is one
  frame stale, which detaches the dot from the line whenever the camera pans.
- **The distance counter indexes `segmentDistances`** rather than interpolating linearly, so
  it freezes during ferry crossings. That's intentional.

## Adding a tile provider

In `src/lib/tile-viewport.ts`:
1. Add the URL template to `TILE_URLS` (`{z}/{x}/{y}` or `{quadkey}`).
2. Add the key to `MAP_PROVIDER_KEYS` — the zod enum derives from it, so both compositions
   pick it up automatically.
3. If it has a zoom ceiling, add it to `TILE_MAX_ZOOM`. **Verify empirically** — Esri's
   advertised LODs overstate real coverage and out-of-coverage tiles return a
   "Map data not available" placeholder rather than a 404, so it fails silently.
4. Synthesised providers (e.g. `ocean-composite`) also need a branch in `TileMapBackground`.

## Hard rules

- **Never change segment start/end coordinates or km boundaries** unless explicitly asked.
  They're calibrated against the source GPX and are the source of truth for final assembly.
- **Never commit to `out/`.** It's gitignored; renders are hundreds of MB.
- **Keep `npx tsc --noEmit` at zero errors.** It was 27 and was driven to 0 deliberately;
  don't reintroduce debt. If you need `@ts-expect-error`, you probably want
  `export type Foo = {…}` instead of `export interface Foo {…}` — see ARCHITECTURE.md.

## Verifying a change

1. `npx tsc --noEmit` → 0 errors.
2. `npx remotion compositions` → still lists 38; this actually bundles, so it catches import
   and registry breakage that `tsc` misses.
3. `npx remotion still <Id> … --frame=N` at a frame where your change is visible, and **look
   at the image**. For a claimed behaviour-preserving refactor, render the same frame before
   and after and compare.

Expect small localised differences in *map imagery* between two renders — tile CDNs serve
different captures over time. That is not a regression. A moved route line or dot is.

## Known debt — check `docs/ARCHITECTURE.md` before "fixing"

Several things look like bugs but are deliberate open questions, most notably: 13 legacy
compositions are handed 11 props each that their wrappers silently discard, and the 24
per-segment wrapper components are pure boilerplate awaiting a decision on that first item.
Both are documented with the reasoning. Don't "tidy" them without asking — the fix changes
what existing videos look like.
