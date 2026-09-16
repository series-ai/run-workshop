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
