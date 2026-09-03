# Pirate Nation Art Showcase

A browsable library for the **MIT-licensed Pirate Nation art & audio pack**
(© 2026 Proof of Play, Inc.) — 375 voxel-style GLB models with 355 previews,
513 UI/icon sprites, and 30 music/SFX tracks. The pack comes from the archival
open-source release at <https://github.com/proofofplay/piratenation-game>
(commit `dc921b65`).

## Run it

```bash
npm install
npm run dev        # http://localhost:5190
```

Other scripts: `npm run build`, `npm run preview` (port 4190),
`npm run typecheck`, `npm test` (vitest), and `npm run test:e2e` (playwright).
Run `npm run thumbnails -- --out /private/tmp/pirate-nation-thumbnails` to
render model previews into a caller-selected directory. Run
`npm run export:jam-assets -- --source <source> --out <dir>` to stage the pack as four
`jam-ready-assets` packs — models / icons / ui / audio — transcoding audio
to mp3 and writing a licence per pack.

## Deploying

This app runs on RUN.world. It keeps catalog metadata and legal documents in
`public/catalog/pirate-nation/`. It loads binary files from four pinned
`jam-ready-assets` packs through the RUN asset-library SDK. The game bundle
does not contain the 341 MB binary payload.

```bash
rundot login                                    # once per machine
rundot init --name "Pirate Nation Art Showcase" --build-path ./dist
npm run deploy                                  # builds, then uploads
```

`rundot init` registers the game and writes `game.config.prod.json`, which is
per-account and gitignored — see `CONTRIBUTING.md`. `rundot deploy` uploads a
build for an already-registered game.

During local development, the SDK mock returns the pinned asset-library URL
shape. A published RUN app uses the host-aware asset-library CDN. The catalog
JSON and legal files use same-origin paths.

The four pins are defined in `src/assetLibrary.ts`:

| Key | Pack | Version |
|---|---|---|
| models | `proofofplay-pirate-nation/3D/pirate` | `2ae870ead5c1` |
| icons | `proofofplay-pirate-nation/icons` | `ec3e46dfcd27` |
| ui | `proofofplay-pirate-nation/ui` | `97835c36f9f1` |
| audio | `proofofplay-pirate-nation/audio` | `064b51d95ed5` |

`jam-ready-assets` PR #8 (`a423ddd4`) moved packs from `<bucket>/<theme>/<pack>/`
to `<pack>/<bucket>/<theme>/`, so all four ids changed. The versions did not: the
manifest hashes pack-relative paths, which the move preserved. The pre-move
prefixes are still served — the GCS mirror never deletes a `packs/` prefix — so
this is a catch-up, not a break.

Release order: merge the preview addition in `jam-ready-assets`, wait for its
mirror workflow, verify the live pack version, then publish this app.

## What the showcase shows

- **Home** — hero landing with pinned UI-pack menu background, five exploration
  route cards, and session-only progress tracking.
- **Models** — a thumbnail grid over the 355 visual GLBs in 10 categories
  (the 20 `…-collision` GLBs are not separate entries), with search, sort,
  category chips, `←`/`→` keyboard paging and a Random button. A model is
  always on the stage beside the grid, opening with the shared `MODEL_PREVIEW_YAW`
  matching the thumbnails: orbit, turntable, wireframe,
  animation-clip playback (~148 models are animated), and a Collision toggle
  that swaps in the collision geometry where the pack ships one. The detail
  panel lists real dimensions from baked bounds, grid footprint, source path,
  and license.
- **Scene** — several models on one stage, uniformly scaled and grounded, with
  category and reshuffle controls. This is the surface that proves `src/pack3d/`.
- **Avatar Lab** — a full pirate character creator. The shared art file ships
  326 part meshes on one 16-bone rig (12 slots: 19 species, 72 headwear,
  82 tops, …) plus 32 animation clips; the lab composes parts on the client,
  tints skin/hair, and exports the selection as JSON. (See diagnosis notes in
  [`docs/avatar-z-fighting.md`](docs/avatar-z-fighting.md)).
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
public/catalog/pirate-nation/      # local metadata and legal files
  models.json|audio.json|sprites.json
  manifest.json, LICENSE, PROVENANCE.md
src/
  assetLibrary.ts              # four pinned packs and SDK URL resolver
  catalog.ts                   # local catalog access (fetch + cache)
  avatar/                      # avatar part catalog + composer (from game-bot)
  pack3d/                      # reusable canvas, model, layout, camera helpers
  components/                  # ModelViewer (built on pack3d)
  tabs/                        # Dashboard, ModelGallery, SceneStage, AvatarLab, …
```

The avatar module (`src/avatar/`) is ported from the game-bot repo's
`modules/asset-pirate-nation-avatar` — composing is picking a subset of node
names from one shared rig, no mesh merging or retargeting.

## Reusing the renderer

`src/pack3d/` is the reusable half of this app: a canvas preset carrying the
depth-buffer fix, a model component that places by catalogue bounds, and
layout helpers that make several models composable in one scene. See
[`src/pack3d/README.md`](src/pack3d/README.md).

## Attribution

MIT — Copyright (c) 2026 Proof of Play, Inc. See
`public/catalog/pirate-nation/LICENSE` and `THIRD_PARTY_NOTICES.md`. The binary
packs are published in `jam-ready-assets`. Keep the notice with any
redistribution.
