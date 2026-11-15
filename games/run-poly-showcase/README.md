# RUN Poly Packs Showcase

A proof-of-concept RUN workshop app demonstrating a **Synty-inspired low-poly configurable avatar & prop system** built on one shared **53-joint Quaternius UAL1 CC0 skeleton** (`43` clips) across **Medieval**, **WW2**, and **Sim** contexts, engineered for **120 Hz on S23 Ultra** and `jam-ready-assets` + `@series-inc/rundot-game-sdk` distribution.

## Run it

```bash
# 1. Build & export catalogs from the Blender pipeline (requires Blender 5.1)
cd ../../tools/run-poly-packs
npm install && npm run build && npm run validate && npm run catalog

# 2. Launch the showcase
cd ../../games/run-poly-showcase
npm install
npm run dev        # http://localhost:5194
```

Other scripts: `npm run build:local`, `npm run preview` (port `4194`), `npm run typecheck`, `npm test`, `npm run deploy`.

## Tabs

- **Architecture & Spec** — System summary, S23 Ultra mobile law, and `jam-ready-assets` leaf mapping.
- **Parametric Avatar Lab** — Mix & match body archetypes, heads, hair, torsos, legs, headwear, back packs, and held props across Medieval, WW2, and Sim; tune 6 skeletal proportions and 6 semantic UV shader palette regions live; play all 43 UAL1 clips.
- **3-Context Stage** — Side-by-side Medieval, WW2, and Sim dioramas sharing the exact same rig and shader system.
- **S23 Ultra Perf Bench** — Spawn 1–64 simultaneous animated avatars with toggleable mobile policy (DPR <= 1.5, blob shadows, distance mixer throttling) and real-time FPS / p95 frame-ms / draw-call / triangle telemetry.
