# CLAUDE.md

Remotion project rendering 4K (3840×2160 @ 30fps) trail-run videos of the **HK Southern Loop
2025** route. Every video is a React component in `src/components/` registered in
`src/Root.tsx`.

## Read these before non-trivial work

| file | when |
|---|---|
| `docs/RENDERING-GOTCHAS.md` | **before changing anything that affects what a frame looks like** — 11 real debugged bugs whose fixes look arbitrary and are easy to "tidy" away |
| `docs/ARCHITECTURE.md` | any structural change — data flow, layer stack, coordinate spaces, prop conventions, and the open questions |
| `.claude/skills/map-videos/SKILL.md` | condensed working guide |

## Commands

```bash
npm run studio
```

Dev server on http://localhost:3000. **There is no `npm start`** — that fails with
`Missing script`.

```bash
npx remotion compositions
```

Bundles and lists all 38 compositions. Catches import/registry breakage that `tsc` misses.

```bash
npx remotion still <Id> out/f.png --frame=N --gl=angle
```

`--gl=angle` is required on Windows. Add `--concurrency=1` for full renders (tile CDN
throttling). Prefer a still at a well-chosen frame over a full render when verifying.

## Non-negotiables

- **Never change segment start/end coordinates or km boundaries** unless explicitly asked.
  They're calibrated against the source GPX and are the source of truth for final assembly.
- **Keep `npx tsc --noEmit` at zero errors.** It was 27 and was driven to 0 deliberately. If
  you're reaching for `@ts-expect-error` on a `<Composition>`, you almost certainly want
  `export type Foo = {…}` instead of `export interface Foo {…}` — Remotion's inferred `Props`
  must satisfy `Record<string, unknown>`, and TS grants an implicit index signature to type
  aliases but never to interfaces.
- **Never commit to `out/`** — gitignored, renders are hundreds of MB.
- **Use Remotion's `<Img>`, never a plain `<img>`,** for anything that fades.
- Animation is always `frame -> style`. No `setTimeout`, no CSS transitions, no `Date.now()`.
  Anything async must hold a `delayRender` handle and release it on **every** path including
  errors.

## Two things that will confuse you

- **Studio writes `defaultProps` back into `src/Root.tsx`** when props are edited in the UI
  and saved. A dirty `Root.tsx` is often the user's tuning, not leftover agent work. Check
  `git diff src/Root.tsx` before assuming.
- **Studio playback shows map tiles popping in; renders do not.** The renderer blocks each
  frame on its own tile set via `delayRender`. Never tune visuals from Studio playback.

## Adding a prop

Schema-bearing compositions derive props from nested zod groups via `z.infer` — never a
hand-written interface. Add the field to the group it belongs to, give it a `.describe()`
written for a non-programmer, use `.min()`/`.max()` so Studio renders a slider, express
magnitudes as percentages where `100` = the previous hardcoded default, and **add the
matching default to `src/Root.tsx`** (forgetting this is the most common mistake). For
per-item values prefer one comma-separated string over N scalars, with the last value
repeating.
