# voxel-kit

Engine-agnostic voxel destruction core, extracted from the game-bot
voxel-physics modules for [Wreck Yard](../../games/wreck-yard/). Pure
TypeScript with zero runtime dependencies, shipped as source.

## What is inside

- `voxelToolkit` — dense `Uint8Array` volumes (palette index, 0 = empty):
  stamp, carve sphere/capsule, scorch shells, connected components, bounds, crop,
  demo palette and material params.
- `buoyancy` — voxel-sampled tank buoyancy with hydrostatic force, drag, and
  torque. Waves use `deterministicSin`.
- `worldOcclusion` — shared occupancy volume for shadow and ambient blocking.
- `voxelAcceleration` — macro occupancy volume for raymarch skipping.
- `deterministicMath` — `deterministicSin`, `deterministicCos`, quaternion
  rotate, conjugate, normalize. Built from IEEE add, multiply, divide, and
  floor only, so results are bit-identical across JavaScript engines.

## Determinism

Everything in this package avoids `Math.sin`, `Math.cos`, `Math.atan2`,
`Math.exp`, `Math.pow`, `Math.log`, `Math.random`, and clocks.
`determinismAudit.test.ts` scans the sources and fails on any of them. Use
this package inside lockstep simulations without further wrapping.

## Usage

```json
"voxel-kit": "file:../../tools/voxel-kit"
```

```ts
import { carveCapsule, classifySupportedVoxelFragments, makeEmptyVoxelField, stampBox } from 'voxel-kit';
```

## Commands

- `npm test` — unit tests
- `npm run typecheck` — strict tsc, no emit
