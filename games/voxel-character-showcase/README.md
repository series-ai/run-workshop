# RUN Voxel Character Showcase

Interactive 3D showcase for the **Teardown-style configurable voxel character & context system** (`tools/run-voxel-characters`), built on one shared **53-joint Quaternius UAL1 CC0 skeleton** (`43` animation clips) plus **23-joint Quadruped** and **28-joint Arachnid** creature rigs across **Heist**, **Industrial**, **Security**, and **Creatures** contexts, engineered for **120 Hz on Samsung Galaxy S23 Ultra** and `jam-ready-assets` distribution.

## Run it

```bash
# 1. Build, validate & export catalogs from the Blender pipeline (requires Blender 5.1)
cd ../../tools/run-voxel-characters
npm install && npm run build && npm run validate && npm run catalog

# 2. Launch the showcase
cd ../../games/voxel-character-showcase
npm install
npm run dev        # http://localhost:5195
```

Other scripts: `npm run build:local`, `npm run preview` (port `4195`), `npm run typecheck`, `npm test`, `npm run deploy`.

## Tabs

- **Art Direction & Spec** — System summary, Teardown voxel grammar (`5 cm` lattice, 3×5 faces in a 5×7 head envelope, C-claw hands, baked crevice AO + `TEXCOORD_1` mottling), S23 Ultra 120 Hz budgets, and `jam-ready-assets` leaf mapping.
- **Parametric Voxel Lab** — Mix & match body builds (`body_slim`, `body_athletic`, `body_heavy`, `body_scrap_bot`, `body_dire_wolf`, `body_giant_spider`), sculpted voxel heads, hair, stepped 1-voxel outfits, hats, backpacks, and held weapons/tools; tune parametric skeletal proportions and 6 semantic UV shader palette regions live; play all 43 UAL1 / creature clips.
- **Context Stage (Heist · Industrial · Security · Creatures)** — Side-by-side themed dioramas sharing the exact same rig, dual-UV shader, and blob-shadow policy.
- **S23 Ultra Perf Bench** — Spawn 1–64 simultaneous animated voxel avatars with toggleable mobile policy (`DPR <= 1.5`, blob shadows, distance mixer throttling) and real-time FPS / p95 frame-ms / draw-call / triangle telemetry.
