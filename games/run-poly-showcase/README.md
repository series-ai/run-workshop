# RUN Poly Packs Showcase

A proof-of-concept RUN workshop app demonstrating a **stylized faceted low-poly configurable avatar & prop system** built on one shared **53-joint Quaternius UAL1 CC0 skeleton** (`89` CC0 clips: UAL1 + UAL2 + KayKit 2H Rifle) across **Medieval**, **WW2**, **Sim**, and **Monsters** contexts, engineered for **120 Hz on S23 Ultra** and `jam-ready-assets` + `@series-inc/rundot-game-sdk` distribution.

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
- **Parametric Avatar Lab** — Mix & match body archetypes, heads, hair, torsos, legs, headwear, back packs, and held props across Medieval, WW2, Sim, and Monsters; tune skeletal & facial proportions and 7 semantic UV shader palette regions live; play all 89 UAL1/UAL2/KayKit clips.
- **Context Stage** — Side-by-side Medieval, WW2, Sim, and Monsters dioramas sharing the exact same shader and performance budget.
- **S23 Ultra Perf Bench** — Spawn 1–64 simultaneous animated avatars with toggleable mobile policy (DPR <= 1.5, blob shadows, distance mixer throttling) and real-time FPS / p95 frame-ms / draw-call / triangle telemetry.
