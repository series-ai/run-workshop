# Wreck Yard

A multiplayer voxel destruction yard on RUN syncplay. Grab and throw voxel
bodies with the hand, carve them with the torch until pieces fall off, and
watch them float or sink in the tank. Every client runs the same deterministic
simulation; only inputs cross the wire, and rollback plus late join keep
everyone in sync.

> New to run-workshop? Start with [Getting Started](../../GETTING_STARTED.md).

## Local setup

```bash
npm install
cp .env.example .env   # optional for local play
npm run dev
```

Open the printed URL. The app starts in solo mode. Use **Quick match**,
**Create room**, or **Join** with a room code to play together.

## Commands

- `npm run dev` — dev server with the RUN sandbox
- `npm run build` — identity check, typecheck, production build
- `npm test` — unit, codec, and determinism tests
- `npm run test:e2e` — Playwright smoke test against the preview build
- `npm run identity:generate` — regenerate `src/sim/identity.generated.json`
  after any change under `src/sim` or `tools/voxel-kit/src`
- `npm run deploy` — build and deploy with the `rundot` CLI

## Where things live

- `src/sim/` — the deterministic simulation: `state.ts`, `input.ts`, `step.ts`,
  `fracture.ts`, `physics.ts`, `presets.ts`, `codec.ts`, `session.ts`. Nothing
  here reads a clock or uses engine-dependent math. The identity generator
  hashes every file in this folder plus the kit.
- `src/game/match.ts` — the syncplay runner controller (solo and rooms).
- `src/net/rooms.ts` — room transports through the RUN SDK realtime API.
- `src/render/` — presentation: projection and interpolation, the raymarched
  voxel renderer, yard shell, water, occlusion, pointer input.
- `src/ui/Hud.tsx` — tools, stats, lobby, status.
- Voxel operations come from [tools/voxel-kit](../../tools/voxel-kit/).

## Units

The syncplay solver integrates per tick. Positions are meters, velocities are
meters per tick, and gravity is meters per tick². `src/sim/constants.ts` holds
the conversions; the buoyancy boundary converts to and from per-second units.

## Rendering style

Wreck Yard uses a custom retro-futuristic cel-shaded graphic novel aesthetic targeting visual parity with the production concept art.

### Pipeline architecture

1. **Quantized Cel Shading:** All geometry renders via `<Toon>` materials (`toonMaterial.tsx`) and the raymarched voxel volume shader (`toonGlsl.ts`), quantizing lighting into discrete stepped diffuse bands (`ART_STYLE.ramp`).
2. **Ink Edge Post-Process:** `InkComposer.tsx` runs a single composite pass executing a 4-sample screen-space depth + normal Sobel kernel (`inkShader.ts`), drawing dark ink line contours (`ART_STYLE.ink`) around voxel bodies, props, and architectural silhouettes while excluding uninked background elements (such as the stepped sky dome).
3. **Multi-layer Industrial Skyline:** Procedural silhouettes (`skylineShapes.ts`, `Skyline.tsx`) populate the distant yard horizon across quantized atmospheric depth steps.
4. **Greedy Voxel Dressing:** Procedural scrap stacks, concrete barriers, and salvage debris (`voxelProps.ts`, `voxelMesher.ts`, `YardDressing.tsx`) merge coplanar faces into single-draw-call meshes within a strict 250,000 triangle budget.

### Single tuning point

All aesthetic constants (palette colors, ramp thresholds, edge detection weights, sky gradients, fog colors) are centralized in:
`src/render/style/artStyle.ts` (`ART_STYLE`).

To tune or restyle the game, modify `ART_STYLE`. No shader code or component logic needs manual adjustments.

### Style metrics verification

To inspect and verify visual style parity metrics (luma, dark/bright fractions, ink line density, draw call budget):

```bash
# Run Playwright E2E vista capture and metric assertions
npx playwright test e2e/style-vista.spec.ts

# Run standalone metrics analysis on any captured screenshot
node scripts/style-metrics.mjs test-results/style-vista.png
```
