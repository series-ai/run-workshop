# Pirate Nation Art Showcase

A browsable library for the **MIT-licensed Pirate Nation art & audio pack**
(© 2026 Proof of Play, Inc.) — 375 voxel-style GLB models, 513 UI/icon
sprites, and 30 music/SFX tracks, extracted from the archival open-source
release at <https://github.com/proofofplay/piratenation-game> (commit
`dc921b65`).

## Run it

```bash
npm install
npm run dev        # http://localhost:5190
```

Other scripts: `npm run build`, `npm run preview` (port 4190),
`npm run typecheck`, `npm test` (vitest), `npm run test:e2e` (playwright),
`npm run thumbnails` (re-render the model grid thumbnails),
`npm run repair:models` (one-time GLB normalization repair; see
`public/cdn-assets/pirate-nation/PROVENANCE.md` §6).

## Deploying

This app runs on RUN.world. The pack lives in `public/cdn-assets/`, which
`rundot deploy` uploads to the CDN, so the game bundle stays small (1.3 MB
against a 341 MB pack).

```bash
rundot login                                    # once per machine
rundot init --name "Pirate Nation Art Showcase" --build-path ./dist
npm run deploy                                  # builds, then uploads
```

`rundot init` registers the game and writes `game.config.prod.json`, which is
per-account and gitignored — see `CONTRIBUTING.md`. `rundot deploy` only
uploads builds for an already-registered game, so `init` comes first and only
once.

Locally there is no RUN host, so the SDK does not initialize and asset paths
resolve to `cdn-assets/…` straight from `public/`. That is expected; the
console warning on boot says so.

## What the showcase shows

- **Overview** — pack manifest, curated collections, provenance/attribution.
- **Models** — a thumbnail grid over the 355 visual GLBs in 10 categories
  (the 20 `…-collision` GLBs are not separate entries), with search, sort,
  category chips, `←`/`→` keyboard paging and a Random button. A model is
  always on the stage beside the grid: orbit, turntable, wireframe,
  animation-clip playback (~148 models are animated), and a Collision toggle
  that swaps in the collision geometry where the pack ships one. The detail
  panel lists real dimensions from baked bounds, grid footprint, source path,
  and license.
- **Avatar Lab** — a full pirate character creator. The shared art file ships
  326 part meshes on one 16-bone rig (12 slots: 19 species, 72 headwear,
  82 tops, …) plus 32 animation clips; the lab composes parts on the client,
  tints skin/hair, and exports the selection as JSON.
- **Sprites** — 513 icons/UI/branding PNGs with subcategory grouping, zoom,
  and dark/light/checkerboard backdrops for alpha art.
- **Audio** — the original score (11 tracks, WAV masters) and 19 SFX with an
  inline player; nothing downloads until you press play.

## What it cannot show

- Unity particle-system VFX, animator controllers/blend trees (only raw clips
  survive the port).
- Paid packs removed from the source release (Epic Toon FX, Stylized Water 2).
- Third-party packs excluded from the extraction for license reasons:
  Honeti GUI, Pixel Art Icons, Animated Loading Icons, Meebits,
  DemoPlaceholder art, commercial `SND####` SFX.
- Baked voxel islands (Unity `.asset`) — the 6 exported island GLBs stand in.
- Anything playable — this is an art library, not the game.

## Layout

```
public/cdn-assets/pirate-nation/   # the pack (LICENSE + PROVENANCE.md + catalogs)
  runtime/models|audio|sprites # 375 GLB / 30 tracks / 513 PNG
  runtime/*.json               # per-type catalogs (bounds, sizes, provenance)
  manifest.json                # pack overview + collections
src/
  catalog.ts                   # typed catalog access (fetch + cache)
  avatar/                      # avatar part catalog + composer (from game-bot)
  components/                  # ModelViewer, FitCamera, ViewerErrorBoundary
  tabs/                        # Dashboard, ModelGallery, AvatarLab, …
```

The avatar module (`src/avatar/`) is ported from the game-bot repo's
`modules/asset-pirate-nation-avatar` — composing is picking a subset of node
names from one shared rig, no mesh merging or retargeting.

## Attribution

MIT — Copyright (c) 2026 Proof of Play, Inc. See
`public/cdn-assets/pirate-nation/LICENSE` and `THIRD_PARTY_NOTICES.md`. Keep the
notice with any redistribution.
