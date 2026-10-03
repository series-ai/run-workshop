# Wreck Yard

A multiplayer voxel destruction yard on RUN syncplay. Grab and throw voxel
bodies with the hand, carve them with the torch until pieces fall off, and
watch them float or sink in the tank. Only the torch and fuel drum blasts
change a voxel shape: a hit moves a body but does not chip it. A torch cut or
a blast break glows red with heat, then turns brown, then burnt black. Every client runs the same deterministic
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

## Controls and fullscreen

On a surface that can capture the mouse (desktop web, Steam), the yard runs
behind a start plate. One click on **Click to play** enters fullscreen and
captures the mouse. When the cursor comes free (Escape, the RUN toolbar,
alt-tab), the pause menu opens: solo stops, and a room keeps running while you
stand still. **Resume** captures the mouse again, and enters fullscreen again if
you left it. A second Escape, or **Exit fullscreen** in the pause menu, leaves
fullscreen. The orbit tool (`O`) frees the cursor without the menu; click the
yard to look again. If the browser keeps refusing the capture, **Play in a
window** switches to drag-to-look, and **Capture mouse** switches back. Phones
and other surfaces without pointer lock skip the gate and use drag-to-look.

Inside RUN.world the game is a frame, so only the host may go fullscreen or
lock the pointer: `src/game/capturePort.ts` uses the RUN SDK System API there,
and the browser's own APIs at top level (local dev). `src/game/playGate.ts`
holds the rules. While a host error modal is open in fullscreen, one Escape
both closes the modal and leaves fullscreen (the SDK handles that key too).

For tests, `?capture=off` turns capture off (drag-to-look, no gate) and
`?capture=fake` uses a fake port on `window.__CAPTURE_FAKE__`. Both work in dev
and preview builds. The design is in
[.plans/wreck-yard-fullscreen-play-gate.html](../../.plans/wreck-yard-fullscreen-play-gate.html).

## Commands

- `npm run dev` — dev server with the RUN sandbox
- `npm run build` — identity check, typecheck, production build
- `npm test` — unit, codec, and determinism tests
- `npm run test:e2e` — Playwright smoke test against the preview build
- `npm run verify:live` — browser checks against a running dev server
  (`npm run dev -- --host 127.0.0.1 --port 4400 --strictPort`, or set
  `AUDIT_URL`): collision coverage, controls, click feedback, contraptions,
  solid scenery, and live frame time. Results go to `test-results/`.
- `npm run profile:sim` — per-tick simulation and rollback cost, for SDK comparisons
- `npm run identity:generate` — regenerate `src/sim/identity.generated.json`
  after any change under `src/sim` or `tools/voxel-kit/src`
- `npm run deploy` — build and deploy with the `rundot` CLI

## Where things live

- `src/sim/` — the deterministic simulation: `state.ts`, `input.ts`, `step.ts`,
  `fracture.ts`, `physics.ts`, `presets.ts`, `codec.ts`, `session.ts`. Nothing
  here reads a clock. Trig runs through the Syncplay deterministic math shim
  (`src/deterministicMath.ts`), which loads before any sim module. The identity generator
  hashes every file in this folder plus the kit.
- `src/game/match.ts` — the syncplay runner controller (solo and rooms).
- `src/net/rooms.ts` — room transports through the RUN SDK realtime API.
- `src/render/` — presentation: projection and interpolation, the raymarched
  voxel renderer, yard shell, water, occlusion, pointer input.
- `src/ui/Hud.tsx` — tools, stats, lobby, status.
- `src/game/playGate.ts`, `src/game/capturePort.ts`, `src/ui/usePlayGate.ts`,
  `src/ui/PlayGate.tsx` — fullscreen, mouse capture, the start plate, and the pause menu.
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
