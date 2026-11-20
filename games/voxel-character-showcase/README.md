# RUN Cubix Showcase

Interactive 3D showcase for the **canonical orthogonal voxel character & context system** (`tools/run-voxel-characters`), built on one shared **53-joint Quaternius UAL1 CC0 skeleton** (`43` animation clips) plus **23-joint Quadruped**, **28-joint Arachnid**, and external creature rigs across **Heist**, **Industrial**, **Security**, **Creatures**, and **Fantasy** contexts, engineered for **120 Hz on Samsung Galaxy S23 Ultra** and `jam-ready-assets` distribution.

Production app: https://w.run/panysaurusrex/run-cubix

## Run it

```bash
# 1. Build, validate & export metadata catalogs (requires Blender 5.1)
cd ../../tools/run-voxel-characters
npm install && npm run build && npm run validate && npm run catalog

# 2. Launch the showcase
cd ../../games/voxel-character-showcase
npm install
npm run dev        # http://localhost:5195
```

Other scripts: `npm run build:local`, `npm run preview` (port `4195`), `npm run typecheck`, `npm test`, `npm run deploy`.

## Asset loading & expanding packs (`jam-ready-assets`)

- **No local GLB copies are bundled in this app**: `public/catalog/` holds JSON metadata only.
- **Production (`npm run build` / `npm run deploy`)**: `src/assetSource.ts` resolves every GLB exclusively through the RUN SDK (`RundotGameAPI.assetLibrary.getPackBaseUrl(leafId, PINS[leafId])`), backed by the `jam-ready-assets` CDN. `vite.config.ts` (`requirePins()`) fails production builds if any pack leaf in `contracts/data/packs.json` is missing from `src/pins.ts`.
- **Local dev & preview (`npm run dev` / `npm run build:local`)**: Vite's `localJamAssets()` middleware serves `/jam/<leafId>/<path>` from `VITE_VOXCHAR_STAGE_DIR` (`tools/run-voxel-characters/out/jam-stage` by default) or `VITE_JAM_ASSETS_DIR` (`~/dev/jam-ready-assets` by default).
- **When expanding packs**: Stage updated packs to `series-ai/jam-ready-assets` (`npm --prefix ../../tools/run-voxel-characters run stage -- --target <jra-checkout>`), open/merge the JRA PR so GCS mirrors the new content, and update `src/pins.ts` with the new 12-character leaf hashes from `manifest/v2/index.json` before deploying.

## Tabs

- **Art Direction & Spec** — System summary, canonical voxel grammar (`5 cm` body / `2.5 cm` headwear lattice, 3×5×4 faces in a 5×7 head envelope, C-claw hands, baked crevice AO + `TEXCOORD_1` mottling), S23 Ultra 120 Hz budgets, and `jam-ready-assets` leaf mapping.
- **Parametric Voxel Lab** — Mix & match body builds (`body_slim`, `body_athletic`, `body_heavy`, `body_orc_*`, `body_troll_*`, `body_scrap_bot`, `body_dire_wolf`, `body_giant_spider`, and 7 animal mounts/pets), sculpted voxel heads, hair, stepped 1-voxel outfits, hats, backpacks, and held weapons/tools/shields; tune parametric skeletal proportions and 10 semantic UV shader palette regions live; play all 43 UAL1 / creature clips.
- **Animation Reviewer** — Inspect any preset or custom rig across all clips with ragdoll collider overlays and bounds readouts.
- **Context Stage (Heist · Industrial · Security · Creatures · Fantasy)** — Side-by-side themed dioramas sharing the exact same rig, dual-UV shader, and blob-shadow policy.
- **S23 Ultra Perf Bench** — Spawn 1–64 simultaneous animated voxel avatars with toggleable mobile policy (`DPR <= 1.5`, blob shadows, distance mixer throttling) and real-time FPS / p95 frame-ms / draw-call / triangle telemetry.
