# map-videos

Remotion project for rendering animated 4K videos of the **HK Southern Loop 2025** trail run — moving-map shots, route reveals, photo slideshows, and full-route flyovers. Each composition is a React component in `src/components/` registered in `src/Root.tsx`.

---

## Quick start

```bash
npm install
npm run studio
```

Studio opens at **http://localhost:3000**. Pick a composition from the left sidebar, scrub the timeline, and tweak props live in the right panel.

> The script is `studio`, **not** `start`. `npm start` will fail with `Missing script: "start"`.

---

## Available scripts

| Script | What it does |
|---|---|
| `npm run studio` | Launch Remotion Studio (the dev server). |
| `npm run render` | Render the `MapRouteVideo` composition end-to-end (`--gl=angle --concurrency=1`). |
| `npm run render:test` | Render frames `0-150` of `MapRouteVideo` to `out/test.mp4` for a fast smoke test. |
| `npm run prepare-gpx` | Read `HK_Southern_Loop_2025.gpx`, simplify with Turf, and write the processed track to `src/data/route-processed.json`. Run this whenever the source GPX changes. |

To render a composition other than `MapRouteVideo`:

```bash
npx remotion render <CompositionId> --gl=angle --concurrency=1 out/<name>.mp4
```

`<CompositionId>` is the `id` prop on `<Composition>` in `src/Root.tsx` (e.g. `IndyTracker`, `GPXSegment`, `FullRouteOverview`, `01-TseungKwanO-BingAerial`, …).

---

## Repository layout

```
.
├── HK_Southern_Loop_2025.gpx     Source GPX (input to prepare-gpx)
├── public/                       Static assets served by Remotion
│   ├── route.gpx                 Primary GPX consumed at runtime
│   ├── *.png                     Pre-rendered static map backgrounds per segment
│   ├── photos-devils-peak/       Photo-slideshow assets
│   └── photos-mount-davis/
├── remotion.config.ts            Renderer config (ANGLE GL, 60s timeout)
├── scripts/
│   ├── prepare-gpx.ts            Simplify + bake distances into route-processed.json
│   └── render-static-map.ts      One-off static map renderer
├── src/
│   ├── Root.tsx                  Composition registry — every video is listed here
│   ├── components/               One file per composition (~38 of them)
│   │   ├── IndyTracker.tsx       Cinematic moving-camera tracker (grouped schema)
│   │   ├── GPXSegment.tsx        Generic configurable segment (grouped schema)
│   │   ├── PhotoSlideshow.tsx    Photo deck with Ken Burns / mosaic / film-strip styles
│   │   ├── FullRouteOverview*.tsx Static full-route flyovers
│   │   ├── TileMapBackground.tsx Tile grid renderer with retry + delayRender
│   │   └── (per-segment named wrappers: DevilsPeak, SiuMaShan, …)
│   └── lib/
│       ├── tile-viewport.ts      Tile providers, viewport math, coord→pixel
│       ├── route-processor.ts    Distance/elevation/segment extraction
│       ├── gpx-browser-parser.ts Browser-safe GPX parser
│       ├── mercator.ts           Web Mercator helpers
│       └── map-style.ts
└── out/                          Rendered videos (gitignored — actually it's not, see Maintenance)
```

---

## Headline compositions

- **`IndyTracker`** — Cinematic camera that follows the runner along the route. Schema is grouped into `route` / `map` / `camera` / `line` / `photos` / `hud` sections in the props panel. Supports backdrop photos with blend modes, photo movement (ken-burns, pan, zoom), photo transitions (crossfade, wipe, dip-to-black, …), and dual-era tile crossfades.
- **`GPXSegment`** — Generic single-segment composition; same grouped-schema pattern (`route` / `map` / `camera` / `line` / `fade` / `hud`). Three-era tile pipeline: `providerStart` → `provider` → `providerEnd` with crossfade windows expressed as `% of duration`.
- **`FullRouteOverview` / `-BW` / `-Peaks` / `-NoHUD`** — Static fly-over of the entire loop with logo reveal.
- **`PhotoSlideshow`** — 4K photo deck. Styles: `ken-burns`, `mosaic`, `photo-prints`, `film-strip`, `parallax`, `editorial-grid`, `slide-push`, `zoom-through-black`. `calculateMetadata` adapts `durationInFrames` to the chosen photo count.
- **`01-TseungKwanO-BingAerial` … `11-SaiKung-BingAerial`** — Pre-configured numbered segments with `BingAerial` map. Use these as the canonical export list for the final video.

All compositions render at **3840 × 2160 @ 30 fps**.

---

## Adding a new GPX route

1. Drop the new `.gpx` file in `public/` (e.g. `public/my-route.gpx`).
2. In Studio, open the `GPXSegment` composition and set `route.gpxFile` to the new filename.
3. Adjust `route.startKm` / `route.endKm` to slice the segment you want.
4. (Optional) If you also want the simplified JSON track for the static `MapRouteVideo` flyover, replace `HK_Southern_Loop_2025.gpx` at the repo root and rerun `npm run prepare-gpx`.

---

## Tile providers

Defined in `src/lib/tile-viewport.ts` (`TILE_URLS` + `MAP_PROVIDER_KEYS`). All providers are **free, no API key required**. The pyramid maxes out per provider — `TILE_MAX_ZOOM` in the same file caps zoom requests so you never hit a 404 on a high-detail provider that only serves to z16.

To add a new provider:
1. Add the URL template to `TILE_URLS` (`{z}/{x}/{y}` or `{quadkey}` style).
2. Add the key to `MAP_PROVIDER_KEYS` so the Zod enum picks it up — both `gpxSegmentSchema` and `indyTrackerSchema` derive from it.
3. If it has a zoom cap, add it to `TILE_MAX_ZOOM`.
4. Synthesised providers (e.g. `ocean-composite`, which is hillshade × Carto light blended in `TileMapBackground.tsx`) only need an entry in `MAP_PROVIDER_KEYS` plus the rendering branch.

---

## Maintenance notes

### Tile loading — why `delayRender`?

`src/components/TileMapBackground.tsx` acquires a fresh `delayRender` handle for **every distinct URL set** (joined by `|` as a stable key). It prefetches each tile via `new Image()` with up to 6 retries and exponential backoff (capped at 3 s). The `<img>` tags themselves also retry on `onError`. This is the only thing standing between you and a black square in your render — touch carefully.

Failed tiles **resolve, never reject**, so one bad CDN response can't stall a frame indefinitely. Frame timeout is set to **120 s** in the component and **60 s** globally in `remotion.config.ts`.

### `<Img>` vs `<img>` for photos

Use Remotion's `<Img>` (capital I) for images that must be fully loaded before a frame is captured — particularly inside fade-in animations, where a plain `<img>` can be sampled mid-decode and produce a one-frame flash. `<Img>` wraps a per-tab `delayRender` for you.

### Pre-existing TypeScript errors

`npx tsc --noEmit` reports a small set of long-standing errors unrelated to current work:

- `provider*2 !== "none"` comparison errors in `IndyTracker.tsx` and `GPXSegment.tsx` — `mapProviderOptionalEnum` resolves to `MapProvider` (no `"none"`) in the inferred prop type. Doesn't affect runtime.
- `FC<…Props>` → `LooseComponentType<Record<string, unknown>>` mismatches on per-segment wrapper components in `Root.tsx` — silenced with `@ts-expect-error` directives.
- `CalculateMetadataFunction<Record<string, unknown>>` mismatches on `IndyTracker` and `PhotoSlideshow` compositions — Remotion generics quirk.

These are tolerated. Fix them if you want, but they don't break Studio or rendering.

### Render flags

- `--gl=angle` — required on Windows for stable WebGL/canvas output. Set globally in `remotion.config.ts` and re-passed in the npm scripts so direct `npx remotion render …` still works.
- `--concurrency=1` — defensive against the tile CDN throttling concurrent requests across worker tabs. Bump it if you have a fast connection and the CDNs cooperate.

### Output directory

`out/` holds rendered MP4s. **It is not in `.gitignore`** (only `node_modules/`, `dist/`, `.cache/` are) — commit deliberately and clean up large files before pushing.

### Segment coordinates — do not edit casually

The km boundaries on the numbered segments (`01-TseungKwanO-BingAerial` through `11-SaiKung-BingAerial`) are calibrated against the source GPX. **Do not modify segment start/end coordinates or km boundaries unless explicitly asked** — they're the source of truth for the final video assembly.

### Code style

- Prettier with default config (`.prettierrc`).
- TypeScript strict-ish; the schema-driven compositions (`IndyTracker`, `GPXSegment`, `PhotoSlideshow`) infer their props from Zod via `z.infer<typeof schema>` rather than hand-maintained interfaces. Keep that pattern when adding new ones.
- Schema groups (`route`, `map`, `camera`, `line`, `fade`/`photos`, `hud`) render as collapsible sections in Studio. Add new fields inside the appropriate group rather than at the top level.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Missing script: "start"` | Use `npm run studio` instead of `npm start`. |
| Black squares in the rendered map | Tile CDN flaked. The frame waits up to 120 s with retries; if it consistently times out, the provider is genuinely down — switch to a backup provider or lower the zoom. |
| One-frame flash on photo fade-in | Make sure the photo uses Remotion's `<Img>` (capital I), not a plain `<img>`. |
| Black edges when camera pans on a backdrop photo | The pan math in `IndyTracker` keeps the inner image at `scale(1.15)` baseline (7.5% overflow per axis) — don't reduce it below `1.08` or the math no longer covers the ±4% translate envelope. |
| Studio freezes on a heavy composition | Drop `--concurrency` (it's already 1 for renders) and lower the camera zoom on the in-Studio preview — Studio renders at full 4K too. |
