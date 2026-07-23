# 3D PFX Library

A React Three Fiber (R3F) particle-effects library with a browser to preview,
search and performance-profile the effects.

- **`src/`** — the library (the reusable artifact). A catalog of 500 ranked
  particle effects, each with a typed preset, plus `GamePfx`, a deterministic
  R3F runtime/preview component, mobile/perf metadata, catalog search, and
  export helpers. Public entry: `src/index.tsx`.
- **`viewer/`** — a Vite + React app (the harness) to browse, preview and tune
  effects, plus a headless profiling harness (`viewer/scripts/profile-browser.ts`).

Imported from the `game-bot` project. The effects are **authored-preview
grade** — they are visually authored presets, not production-signed-off
(no real-device capture sign-off). Use the profiling tools below to validate
and tune before shipping any effect in a game.

## Develop

```bash
npm install
npm run dev        # Vite dev server (viewer)
npm run build      # production build → dist/
npm run preview    # serve the built bundle
npm run test       # vitest (library + viewer)
npm run typecheck  # tsc --noEmit (see "Types" below)
```

## Profile effects

Headless (Playwright) performance capture, written to a gitignored `.profiles/`:

```bash
npm run profile            # representative suite
npm run profile:authored   # all authored presets
npm run profile:catalog-stress
npm run profile:all
```

## Use the library in a game

Import from the library entry (`src/index.tsx`):

```tsx
import { GamePfx, PFX_PRESETS, createGamePfxComponent } from './path/to/3d-pfx-library/src'
```

`GamePfx` targets `@react-three/fiber@8` / `three@~0.170` / React 18. Copy the
`src/` (and `assets/`) directory into your project, or reference it directly.

## Regenerating assets

Every effect texture is embedded as a base64 data URI directly in `src/`, so
the library compiles and runs with **no external asset files** — `assets/` is
not part of the bundle (building with `assets/` removed produces an identical
module graph). The files under `assets/` are inputs for *regenerating* those
embedded atlases, via `viewer/scripts/`:

| Script | Status |
| --- | --- |
| `build-muzzle-flash-atlas.mjs` | Runnable — all inputs present in `assets/`. |
| `build-plasma-impact-flipbook.mjs` | Runnable — all inputs present in `assets/`. |
| `build-particle-sprite-atlas.mjs` | Needs the Kenney Particle Pack fetched separately; pass its directory as the first argument. |
| `build-unity-fireball-flipbook.mjs` | Not runnable — needs `assets/runtime/unity-fireball-64.png` + `assets/unity-fireball-64.provenance.json`, which are not distributed with this tool (they were absent upstream too). |
| `build-unity-small-flame-flipbook.mjs` | Not runnable — same, for `unity-small-flame-64.*`. |

The two non-runnable scripts are kept as a record of how the committed Unity
Labs Paris flipbooks were produced. Their output (`src/fireballFlipbook.ts`,
`src/flameFlipbook.ts`) is committed, so both effects work at runtime; only
regeneration is unavailable.

## Types

The library is authored as raw TS transpiled by esbuild/Vite (its origin
contract — no build step). `npm run typecheck` reports a handful of known
authored-preview type looseness issues in the generated catalog; these do not
affect the build (`vite build` transpiles regardless) or the runtime.

## Third-party assets

Bundled sprite/flipbook assets are CC0 1.0; the particle renderer is modeled on
wawa-vfx (MIT). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
