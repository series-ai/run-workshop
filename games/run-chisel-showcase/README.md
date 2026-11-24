# RUN Chisel Packs Showcase

A RUN workshop showcase demonstrating the **stylized faceted low-poly modular avatar, creature, and world-prop system** built on one shared **53-joint Quaternius UAL1 CC0 skeleton** (`89` CC0 clips: UAL1 + UAL2 + KayKit 2H Rifle) plus **7 CC0 Mesh2Motion creature rigs** across **Core**, **Medieval**, **WW2**, **Sim**, **Cyberpunk**, and **Monsters**, engineered for **120 Hz on S23 Ultra** and `jam-ready-assets` + `@series-inc/rundot-game-sdk` distribution.

## Run it

```bash
# 1. Build & export catalogs from the Blender pipeline (requires Blender 5.1)
cd ../../tools/run-chisel-packs
npm install && npm run build && npm run validate && npm run catalog

# 2. Launch the showcase (or render 512x512 Gallery thumbnails first)
cd ../../games/run-chisel-showcase
npm install
npm run thumbnails -- --all
npm run dev        # http://localhost:5194
```

Other scripts: `npm run build` (pinned production build via `src/pins.ts`), `npm run build:local`, `npm run preview` (port `4194`), `npm run typecheck`, `npm test`, `npm run deploy`.

## Tabs

- **Architecture & Spec** — System summary, S23 Ultra mobile law, and `jam-ready-assets` leaf mapping.
- **Asset Gallery** — Searchable, filterable thumbnail browser across all 6 Chisel packs (`run-chisel-*`), slots, held items, props, and presets with live 3D OrbitControls inspector, clip playback, bounds, and license badges.
- **Parametric Avatar Lab** — Mix & match body archetypes, creatures, heads, hair, torsos, legs, headwear, backpacks, and held props; tune skeletal/facial proportions and 7 semantic UV shader palette regions live; play all 89 UAL1 + creature CC0 clips.
- **Context Stage** — Side-by-side Medieval, WW2, Sim, Cyberpunk, and Monsters dioramas sharing the exact same shader and performance budget.
- **S23 Ultra Perf Bench** — Spawn 1–64 simultaneous animated avatars with toggleable mobile policy (DPR <= 1.5, blob shadows, distance mixer throttling) and real-time FPS / p95 frame-ms / draw-call / triangle telemetry.
