---
title: "Repair vertex-baked Y-normalization in pack GLBs"
status: done
created: 2026-08-23
updated: 2026-08-24
tags: [pirate-nation-showcase, asset-pipeline, bugfix]
---

# Repair vertex-baked Y-normalization in pack GLBs

> **For agentic workers:** Use the `execute-spec` skill to implement
> this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Undo the extractor's vertex-baked `normalizedShift` in the 279 affected pack GLBs so composite models render assembled again, and refresh the stale catalog metadata (`bounds`, `sizeBytes`, `normalizedShift`) to match.

**Architecture:** A Node/TypeScript script patches each GLB's float32 POSITION data in place (subtract `normalizedShift` from every Y), recomputes assembled-pose bounds from the node graph with three.js matrix math, and updates `models.json` (bounds, `sizeBytes`, `normalizedShift: 0` — which also makes the script idempotent). Apply mode preflights every model before the first write, so a refusal cannot leave the pack half-patched. A `--verify` mode compares repaired models vertex-by-vertex against their upstream sources; unit tests cover the binary mechanics.

**Tech Stack:** Node 24, TypeScript (run via `tsx`), vitest, `three` for matrix/AABB math, plain GLB binary parsing (no new dependencies).

---

## Overview

The pack extractor normalized every model by adding `normalizedShift` to mesh **vertex Y coordinates** instead of to the root node's translation. Composite models place parts through rotated pivot nodes, so the baked lift is rotated per part: rotated parts fly off diagonally while unrotated parts (hulls, masts) stay — 141 models visibly explode (ships, buildings, the kraken), and all 279 shifted models sit at a wrong height. The extractor lives in another repo, so this plan repairs the extracted data in place: subtracting the shift from vertex data exactly restores the upstream pose (verified against upstream sources on 5 models spanning skinned/non-skinned, placeholder/real art).

## Background

Investigation findings (all verified in this session):

- **Root cause**: extracted GLBs have node TRS identical to upstream (checked undead ship 62/62 nodes, galleon 16/16, bank, kraken, shipwright — all 0 diffs) but every POSITION accessor's Y is uniformly `+normalizedShift` (undead +36.5, galleon +15.5, bank +12.5, kraken +28.5, shipwright +14.0). X/Z deviations are exactly 0. Inverse-bind matrices are untouched (shipwright: byte-identical).
- **Count**: 279 of 375 entries in `public/assets/pirate-nation/runtime/models.json` have `normalizedShift != 0`; 141 of those have divergent part rotations (= visibly scattered).
- **Catalog bounds are computed from raw mesh-space accessor unions** (no node transforms), so they describe neither the source pose nor the exploded render. The viewer's shadow rig scales off `bounds.size` (`src/components/ModelViewer.tsx:106`), so repaired models need recomputed bounds.
- **GLB mechanics**: all 375 GLBs are plain glTF 2.0 binaries (header + JSON chunk + one BIN chunk, no trailing bytes, `extensionsUsed` empty — no Draco). All 2526 POSITION accessors are non-sparse float32 VEC3, all have `min`/`max`, and all fit inside their BIN chunk (re-verified across the pack). Strides vary from 12 to 60 bytes, and primitives share accessors (2526 unique vs 3832 references), so patching must honor `byteStride` and dedupe by accessor index.
- **`normalizedShift` is not consumed** by any code in this repo (only the type in `src/catalog.ts:35` and a test fixture). Nothing under `games/` references the pack. GLBs are Git-LFS tracked, so git is the rollback mechanism.
- **Skinned models**: 23 are skinned AND shifted (galleon, shipwright/foundry/workshop buildings, …). Per the glTF spec a skinned node's own transform is ignored (bind pose lives in vertex data), which the bounds computation must respect.
- **Formatting**: `models.json` is 2-space pretty-printed with **no trailing newline**; entries carry `sizeBytes`, which a GLB repack can invalidate (JSON-chunk padding) so it must be rewritten too.
- Test tooling: vitest include is `src/**/*.test.{ts,tsx}` (`vite.config.ts:26`); tsconfig `include` is `["src", "e2e"]` with `types: ["node"]`; `tsx` is already a devDependency and the repo's script-running convention is `node --import tsx …` (see `src/avatar/avatarCatalog.generated.ts:9`).
- Math: `three@0.170` (plus `@types/three@0.170`) is already a dependency, and its ESM build imports fine from a `tsx`-run node script. The script reuses `Matrix4.compose` / `Box3.applyMatrix4` instead of hand-rolled matrix code.
- Docs gate: observable behavior change = models render assembled. The pack's provenance doc `public/assets/pirate-nation/PROVENANCE.md` has sections 1–5, so the repair becomes section 6; `README.md` documents the npm scripts ("Other scripts", line 16-17) and must list the new one. No other doc surface is affected.

## Requirements

1. A script `scripts/repair-model-normalization.ts` patches every `models.json` entry with `normalizedShift != 0`: subtract the shift from every POSITION accessor's Y floats (deduped by accessor index, honoring `byteStride`), update accessor `min`/`max`, recompute `bounds` from the assembled pose (node-graph world AABBs; skinned nodes use raw bind-pose AABBs), set `normalizedShift: 0`, update `sizeBytes`, and repack the GLB.
2. The script is idempotent: a second run changes nothing (reports 0 pending models).
3. The script refuses models it can't safely patch (sparse or non-float32/VEC3 POSITION, missing BIN chunk, unreadable file) with an error naming the model id; per current data zero refusals are expected.
4. Apply mode preflights: it parses and validates every pending GLB before it writes the first byte, so one refusal aborts the run with the pack untouched. (Without this, a failure at model N leaves N-1 GLBs patched while `models.json` still lists their shifts, and a retry double-subtracts.)
5. A `--dry-run` mode reports what would change without writing; a `--verify` mode downloads the upstream sources of a fixed 5-model sample and confirms repaired vertex data matches within 1e-3.
6. Unit tests cover GLB parse/patch/write round-trip, stride handling, accessor dedupe, bounds math (rotated pivot + skinned node), and accessor validation/rejection.
7. Existing behavior is preserved: `npm test`, `npm run typecheck`, and `npm run test:e2e` all pass after the repair.
8. `PROVENANCE.md` records the repair; `README.md` lists the new npm script.

## Non-goals

- Fixing the external extractor (separate repo; this is the data-side repair).
- Recomputing `bounds` for models whose `normalizedShift` is already 0 (their bounds stay mesh-union approximations — see Open Questions).
- Re-extracting or re-downloading the pack, touching audio/sprites, or the Avatar Lab.
- Investigating the separate collision-GLB scale question noted earlier.
- Committing the result (user's call; GLBs are LFS-tracked).

## Acceptance Criteria

- [x] `npm test` passes including the new `scripts/repair-model-normalization.test.ts` cases.
- [x] `npm run typecheck` passes with `scripts/` added to the tsconfig include.
- [x] `npm run repair:models -- --dry-run` lists 279 pending models; after `npm run repair:models`, a second dry-run reports 0 pending.
- [x] `npm run repair:models -- --verify` passes: all 5 sample models match upstream vertex data within 1e-3.
- [x] After repair, the `ships-item-4x8-pirateshipsmallundead` catalog bounds have `size[1]` in 96.1 ± 0.5 and `min[1]` in -15.1 ± 0.5 — the assembled source pose.
- [x] `npm run test:e2e` passes (6 tests).
- [x] Visual check: the undead ship screenshot after repair shows an assembled ship (parts attached), unlike the exploded reference in the conversation.
- [x] `PROVENANCE.md` has a section 6 that records the repair; `README.md` "Other scripts" mentions `repair:models` and links §6.

## File Roster

| File | Action | Why |
|------|--------|-----|
| `tools/pirate-nation-showcase/scripts/repair-model-normalization.ts` | create | The repair tool: GLB parse/patch/write, bounds computation, preflight, upstream verify, CLI (Req 1–5) |
| `tools/pirate-nation-showcase/scripts/repair-model-normalization.test.ts` | create | Unit tests for the binary mechanics and bounds math (Req 6) |
| `tools/pirate-nation-showcase/vite.config.ts` | modify | Add `scripts/**/*.test.ts` to vitest include (Req 6) |
| `tools/pirate-nation-showcase/tsconfig.json` | modify | Add `scripts` to include so the tool is typechecked (Req 7) |
| `tools/pirate-nation-showcase/package.json` | modify | Add `repair:models` npm script (Req 1, 8) |
| `tools/pirate-nation-showcase/public/assets/pirate-nation/runtime/models.json` | modify (by script) | `bounds`, `sizeBytes`, `normalizedShift: 0` for 279 entries (Req 1) |
| `tools/pirate-nation-showcase/public/assets/pirate-nation/runtime/models/**/*.glb` | modify (by script, 279 files) | Un-shifted vertex data (Req 1) |
| `tools/pirate-nation-showcase/public/assets/pirate-nation/PROVENANCE.md` | modify | Record the repair (Req 8) |
| `tools/pirate-nation-showcase/README.md` | modify | List `repair:models` in "Other scripts" (Req 8) |

## Implementation Plan

All commands run from `tools/pirate-nation-showcase/`.

### Task 1: The repair script and its tests

**Files:**
- Create: `tools/pirate-nation-showcase/scripts/repair-model-normalization.ts`
- Create: `tools/pirate-nation-showcase/scripts/repair-model-normalization.test.ts`
- Modify: `tools/pirate-nation-showcase/vite.config.ts`
- Modify: `tools/pirate-nation-showcase/tsconfig.json`

- [x] **Step 1: Wire up tooling and write the failing tests**

In `vite.config.ts`, change the test include to:

```ts
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
```

In `tsconfig.json`, change the include to:

```json
  "include": ["src", "e2e", "scripts"]
```

Create `scripts/repair-model-normalization.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  applyShiftToPositions,
  computeAssembledBounds,
  parseGlb,
  positionAccessorIndices,
  validatePositionAccessors,
  writeGlb,
  type Gltf,
} from './repair-model-normalization'

function pad4(buf: Buffer): Buffer {
  const pad = (4 - (buf.length % 4)) % 4
  return pad ? Buffer.concat([buf, Buffer.alloc(pad)]) : buf
}

/** Two-mesh GLB: mesh 0 is tightly packed (stride 12) and shared by two
 * primitives (dedupe check); mesh 1 is interleaved pos+normal+uv (stride 32).
 * Node 'b' carries a 180° yaw + translation for the bounds test. */
function buildTestGlb(): { buf: Buffer; gltf: Gltf } {
  const positions0 = Buffer.from(new Float32Array([1, 2, 3, 4, 5, 6]).buffer)
  const interleaved = Buffer.from(
    new Float32Array([
      1, 2, 3, 0, 1, 0, 0, 0, // vert 0: pos xyz, normal, uv
      4, 5, 6, 0, 1, 0, 1, 1, // vert 1
    ]).buffer,
  )
  const bin = pad4(Buffer.concat([positions0, interleaved]))
  const gltf: Gltf = {
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'root', children: [1, 2] },
      { name: 'a', mesh: 0 },
      { name: 'b', mesh: 1, translation: [10, 0, 0], rotation: [0, 1, 0, 0] },
    ],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0 } }, { attributes: { POSITION: 0 } }] },
      { primitives: [{ attributes: { POSITION: 1 } }] },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 2, type: 'VEC3', min: [1, 2, 3], max: [4, 5, 6] },
      { bufferView: 1, componentType: 5126, count: 2, type: 'VEC3', min: [1, 2, 3], max: [4, 5, 6] },
    ],
    bufferViews: [{ byteOffset: 0 }, { byteOffset: 24, byteStride: 32 }],
  }
  return { buf: writeGlb(gltf, bin), gltf }
}

describe('parseGlb', () => {
  it('rejects non-GLB data', () => {
    expect(() => parseGlb(Buffer.from('definitely not a glb file'))).toThrow(/magic/)
  })

  it('round-trips through writeGlb', () => {
    const { buf } = buildTestGlb()
    const { gltf } = parseGlb(buf)
    expect(gltf.nodes.map((n) => n.name)).toEqual(['root', 'a', 'b'])
    expect(gltf.accessors[1]!.max).toEqual([4, 5, 6])
  })
})

describe('positionAccessorIndices', () => {
  it('dedupes accessors shared between primitives', () => {
    const { gltf } = buildTestGlb()
    expect(positionAccessorIndices(gltf)).toEqual([0, 1])
  })
})

describe('validatePositionAccessors', () => {
  it('accepts the test model and rejects bad component types and missing bounds', () => {
    const { gltf } = buildTestGlb()
    expect(() => validatePositionAccessors(gltf)).not.toThrow()

    delete gltf.accessors[1]!.min
    expect(() => validatePositionAccessors(gltf)).toThrow(/min and max/)

    gltf.accessors[1]!.componentType = 5123 // uint16
    expect(() => validatePositionAccessors(gltf)).toThrow(/float32 VEC3/)
  })

  it('rejects an accessor that reaches past the BIN chunk', () => {
    const { gltf } = buildTestGlb()
    expect(() => validatePositionAccessors(gltf, 8)).toThrow(/BIN chunk/)
  })
})

describe('applyShiftToPositions', () => {
  it('shifts only Y, honors byteStride, updates min/max, shifts shared accessors once', () => {
    const { buf } = buildTestGlb()
    const { gltf, binStart } = parseGlb(buf)
    applyShiftToPositions(buf, binStart, gltf, -2)

    expect(gltf.accessors[0]!.min).toEqual([1, 0, 3])
    expect(gltf.accessors[0]!.max).toEqual([4, 3, 6])
    expect(gltf.accessors[1]!.min).toEqual([1, 0, 3])

    // Tightly packed accessor 0 at binStart: vert0 Y at +4, vert1 Y at +16.
    expect(buf.readFloatLE(binStart + 4)).toBe(0)
    expect(buf.readFloatLE(binStart + 16)).toBe(3)
    expect(buf.readFloatLE(binStart + 0)).toBe(1) // X untouched
    expect(buf.readFloatLE(binStart + 8)).toBe(3) // Z untouched

    // Interleaved accessor 1 (base binStart+24, stride 32): vert0 Y at +28,
    // vert1 Y at +60; normals and uvs must be untouched.
    expect(buf.readFloatLE(binStart + 28)).toBe(0)
    expect(buf.readFloatLE(binStart + 60)).toBe(3)
    expect(buf.readFloatLE(binStart + 36)).toBe(0) // vert0 normal x
    expect(buf.readFloatLE(binStart + 48)).toBe(0) // vert0 uv u
    expect(buf.readFloatLE(binStart + 80)).toBe(1) // vert1 uv u

    // Patched data must survive a repack: write the buffer back out and
    // parse it again, exactly as the repair does.
    const written = writeGlb(gltf, buf.subarray(binStart))
    const round = parseGlb(written)
    expect(round.gltf.accessors[0]!.min).toEqual([1, 0, 3])
    expect(written.readFloatLE(round.binStart + 4)).toBe(0)
  })

  it('rejects sparse accessors', () => {
    const { buf } = buildTestGlb()
    const { gltf, binStart } = parseGlb(buf)
    gltf.accessors[0]!.sparse = { count: 1 }
    expect(() => applyShiftToPositions(buf, binStart, gltf, 1)).toThrow(/sparse/)
  })
})

describe('computeAssembledBounds', () => {
  it('unions node-transformed AABBs and ignores skinned node transforms', () => {
    const { gltf } = buildTestGlb()
    // Mesh 1 box (1..4, 2..5, 3..6) under 180° yaw + t=[10,0,0] lands at
    // x 6..9, y 2..5, z -6..-3. Union with mesh 0 at identity:
    expect(computeAssembledBounds(gltf)).toEqual({
      min: [1, 2, -6],
      max: [9, 5, 6],
      size: [8, 3, 12],
    })

    // Node 'a' becomes skinned and gains a large translation. A skinned node
    // is posed by its joints, so the translation must not move the bounds.
    // Without the skin rule the union would reach x = 104.
    gltf.nodes[1]!.skin = 0
    gltf.nodes[1]!.translation = [100, 0, 0]
    expect(computeAssembledBounds(gltf)).toEqual({
      min: [1, 2, -6],
      max: [9, 5, 6],
      size: [8, 3, 12],
    })
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/`
Expected: FAIL — cannot find module `./repair-model-normalization`

- [x] **Step 3: Implement**

Create `scripts/repair-model-normalization.ts`:

```ts
/**
 * Repairs the vertex-baked Y-normalization in the Pirate Nation pack GLBs.
 * The extractor added `normalizedShift` to the mesh vertex data. It must add
 * the shift to the root transform. As a result, each rotated part of a
 * composite model moved away from its pivot. Subtract the shift to restore
 * the upstream pose. Use --verify to compare the result with upstream.
 *
 * Usage:
 *   node --import tsx scripts/repair-model-normalization.ts [--dry-run|--verify]
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'

const SHOWCASE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACK_RUNTIME = join(SHOWCASE_ROOT, 'public/assets/pirate-nation/runtime')
const MODELS_JSON = join(PACK_RUNTIME, 'models.json')

const UPSTREAM_BASE =
  'https://media.githubusercontent.com/media/proofofplay/piratenation-game/' +
  'dc921b650c8a1d7c449b2a3553949d3e7c8266e9/'

/** Models spot-checked against upstream during diagnosis: placeholder and
 * real art, skinned and non-skinned, single- and multi-part. */
const VERIFY_SAMPLE = [
  'buildings-bldg-5x5-bank',
  'world-bosses-creature-16x16-kraken',
  'ships-building-4x7-shipwright-lv1',
  'ships-item-4x8-pirateshipsmallundead',
  'ships-pn-galleon-optimized-x1',
] as const

export interface ModelEntry {
  id: string
  relativePath: string
  sourceRelativePath: string
  sizeBytes: number
  normalizedShift: number
  bounds: { min: number[]; max: number[]; size: number[] }
}

export interface GltfAccessor {
  bufferView: number
  byteOffset?: number
  componentType: number
  count: number
  type: string
  min?: number[]
  max?: number[]
  sparse?: unknown
}

export interface Gltf {
  scene?: number
  scenes: { nodes: number[] }[]
  nodes: {
    name?: string
    mesh?: number
    skin?: number
    children?: number[]
    translation?: number[]
    rotation?: number[]
    scale?: number[]
  }[]
  meshes: { primitives: { attributes: Record<string, number> }[] }[]
  accessors: GltfAccessor[]
  bufferViews: { buffer?: number; byteOffset?: number; byteStride?: number }[]
}

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942
const FLOAT32 = 5126

export function parseGlb(buf: Buffer): { gltf: Gltf; binStart: number } {
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error('not a GLB (bad magic)')
  if (buf.readUInt32LE(4) !== 2) throw new Error('expected GLB version 2')
  const jsonLen = buf.readUInt32LE(12)
  if (buf.readUInt32LE(16) !== CHUNK_JSON) throw new Error('chunk 0 is not JSON')
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as Gltf
  const binStart = 20 + jsonLen + 8
  if (binStart > buf.length || buf.readUInt32LE(binStart - 4) !== CHUNK_BIN) {
    throw new Error('chunk 1 is not BIN')
  }
  return { gltf, binStart }
}

export function writeGlb(gltf: Gltf, bin: Buffer): Buffer {
  let json = Buffer.from(JSON.stringify(gltf), 'utf8')
  const pad = (4 - (json.length % 4)) % 4
  if (pad) json = Buffer.concat([json, Buffer.from(' '.repeat(pad))])
  const out = Buffer.alloc(12 + 8 + json.length + 8 + bin.length)
  out.writeUInt32LE(GLB_MAGIC, 0)
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(out.length, 8)
  out.writeUInt32LE(json.length, 12)
  out.writeUInt32LE(CHUNK_JSON, 16)
  json.copy(out, 20)
  out.writeUInt32LE(bin.length, 20 + json.length)
  out.writeUInt32LE(CHUNK_BIN, 20 + json.length + 4)
  bin.copy(out, 20 + json.length + 8)
  return out
}

/** POSITION accessor indices, deduped — primitives share accessors. */
export function positionAccessorIndices(gltf: Gltf): number[] {
  const indices = new Set<number>()
  for (const mesh of gltf.meshes) {
    for (const prim of mesh.primitives) indices.add(prim.attributes.POSITION)
  }
  return [...indices]
}

/** Throws if any POSITION accessor cannot be patched in place. The preflight
 * calls this on every model before the first write, and the patch path calls
 * it again. A bad model then aborts the run instead of half-patching the pack.
 * Pass `binLength` to also check that each accessor stays inside the BIN
 * chunk. Every check covers a case the current pack does not contain. */
export function validatePositionAccessors(gltf: Gltf, binLength?: number): void {
  for (const ai of positionAccessorIndices(gltf)) {
    const acc = gltf.accessors[ai]!
    if (acc.sparse) throw new Error(`accessor ${ai}: sparse POSITION not supported`)
    if (acc.componentType !== FLOAT32 || acc.type !== 'VEC3') {
      throw new Error(`accessor ${ai}: expected float32 VEC3 POSITION`)
    }
    if (acc.min?.length !== 3 || acc.max?.length !== 3) {
      throw new Error(`accessor ${ai}: POSITION needs 3-component min and max`)
    }
    const view = gltf.bufferViews[acc.bufferView]
    if (!view) throw new Error(`accessor ${ai}: missing bufferView ${acc.bufferView}`)
    if (binLength !== undefined) {
      const stride = view.byteStride ?? 12
      const start = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0)
      const end = start + (acc.count - 1) * stride + 12
      if (start < 0 || end > binLength) {
        throw new Error(`accessor ${ai}: reaches byte ${end} of a ${binLength}-byte BIN chunk`)
      }
    }
  }
}

/** Adds `deltaY` to every POSITION Y float in `buf` and to accessor min/max. */
export function applyShiftToPositions(
  buf: Buffer,
  binStart: number,
  gltf: Gltf,
  deltaY: number,
): void {
  validatePositionAccessors(gltf, buf.length - binStart)
  for (const ai of positionAccessorIndices(gltf)) {
    const acc = gltf.accessors[ai]!
    const view = gltf.bufferViews[acc.bufferView]!
    const stride = view.byteStride ?? 12
    const start = binStart + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0)
    for (let i = 0; i < acc.count; i++) {
      const off = start + i * stride + 4
      buf.writeFloatLE(buf.readFloatLE(off) + deltaY, off)
    }
    acc.min![1]! += deltaY // min/max presence is guaranteed by the validator
    acc.max![1]! += deltaY
  }
}

// --- Assembled-pose bounds ---

function nodeLocalMatrix(node: Gltf['nodes'][number]): Matrix4 {
  return new Matrix4().compose(
    new Vector3().fromArray(node.translation ?? [0, 0, 0]),
    new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
    new Vector3().fromArray(node.scale ?? [1, 1, 1]),
  )
}

/** World-space AABB over the assembled pose. Skinned nodes are posed by
 * their joints, so per the glTF spec their node transform is ignored. */
export function computeAssembledBounds(gltf: Gltf): ModelEntry['bounds'] {
  const identity = new Matrix4()
  const world: (Matrix4 | null)[] = new Array(gltf.nodes.length).fill(null)
  const walk = (ni: number, parent: Matrix4): void => {
    const m = new Matrix4().multiplyMatrices(parent, nodeLocalMatrix(gltf.nodes[ni]!))
    world[ni] = m
    for (const c of gltf.nodes[ni]!.children ?? []) walk(c, m)
  }
  for (const ni of gltf.scenes[gltf.scene ?? 0]!.nodes) walk(ni, identity)

  const bounds = new Box3() // starts empty: min +Inf, max -Inf
  gltf.nodes.forEach((node, i) => {
    if (node.mesh === undefined) return
    const m = node.skin !== undefined ? identity : world[i]!
    for (const prim of gltf.meshes[node.mesh]!.primitives) {
      const acc = gltf.accessors[prim.attributes.POSITION]!
      const box = new Box3(
        new Vector3().fromArray(acc.min!),
        new Vector3().fromArray(acc.max!),
      )
      bounds.union(box.applyMatrix4(m))
    }
  })
  const round = (v: Vector3): number[] => v.toArray().map((x) => Math.round(x * 1000) / 1000)
  const min = round(bounds.min)
  const max = round(bounds.max)
  return {
    min,
    max,
    size: max.map((x, i) => Math.round((x - min[i]!) * 1000) / 1000),
  }
}

// --- CLI ---

/** Reads and parses one model's GLB. Every failure names the model id. */
function loadGlb(entry: ModelEntry): { buf: Buffer; gltf: Gltf; binStart: number } {
  const path = join(PACK_RUNTIME, entry.relativePath)
  let buf: Buffer
  try {
    buf = readFileSync(path)
  } catch {
    throw new Error(`${entry.id}: cannot read ${entry.relativePath}`)
  }
  try {
    return { buf, ...parseGlb(buf) }
  } catch (err) {
    throw new Error(`${entry.id}: ${(err as Error).message}`)
  }
}

/** Parses and validates one model without writing. The buffer is released
 * on return, so a preflight of the whole pack costs a second read, not RAM. */
function preflight(entry: ModelEntry): void {
  const { buf, gltf, binStart } = loadGlb(entry)
  try {
    validatePositionAccessors(gltf, buf.length - binStart)
  } catch (err) {
    throw new Error(`${entry.id}: ${(err as Error).message}`)
  }
}

/** Patches one model and replaces its GLB atomically. Every error names the
 * model id. The caller writes the catalog immediately after each model, so a
 * crash cannot leave a patched GLB paired with a nonzero shift in the
 * catalog — which a retry would subtract a second time. */
function repairOne(entry: ModelEntry): void {
  try {
    const { buf, gltf, binStart } = loadGlb(entry)
    applyShiftToPositions(buf, binStart, gltf, -entry.normalizedShift)
    entry.bounds = computeAssembledBounds(gltf)
    const out = writeGlb(gltf, buf.subarray(binStart))
    const path = join(PACK_RUNTIME, entry.relativePath)
    writeFileSync(`${path}.tmp`, out)
    renameSync(`${path}.tmp`, path)
    entry.sizeBytes = out.length
    entry.normalizedShift = 0
  } catch (err) {
    const message = (err as Error).message
    throw new Error(message.startsWith(`${entry.id}: `) ? message : `${entry.id}: ${message}`)
  }
}

function writeCatalog(models: ModelEntry[]): void {
  writeFileSync(`${MODELS_JSON}.tmp`, JSON.stringify(models, null, 2))
  renameSync(`${MODELS_JSON}.tmp`, MODELS_JSON)
}

/** Downloads the upstream sources of the sample models and compares every
 * POSITION float against the repaired GLBs. Post-repair the data must match
 * upstream to within float32 round-trip noise. */
async function verifySample(models: ModelEntry[]): Promise<void> {
  for (const id of VERIFY_SAMPLE) {
    const entry = models.find((m) => m.id === id)
    if (!entry) throw new Error(`sample model ${id} not in catalog`)
    const response = await fetch(UPSTREAM_BASE + entry.sourceRelativePath)
    if (!response.ok) throw new Error(`${id}: upstream HTTP ${response.status}`)
    const src = JSON.parse(await response.text()) as Gltf & { buffers: { uri: string }[] }
    // An upstream .gltf holds many buffers — the bank has 240, one per
    // bufferView. Decode the buffer that each bufferView names, and keep it.
    const decoded = new Map<number, Buffer>()
    const srcBuffer = (bi: number): Buffer => {
      let bin = decoded.get(bi)
      if (!bin) {
        const uri = src.buffers[bi]?.uri
        if (!uri?.startsWith('data:')) {
          throw new Error(`${id}: upstream buffer ${bi} is not embedded`)
        }
        bin = Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64')
        decoded.set(bi, bin)
      }
      return bin
    }
    const outBin = readFileSync(join(PACK_RUNTIME, entry.relativePath))
    const { gltf, binStart } = parseGlb(outBin)

    // Nodes are matched by name. Some models repeat a name (the galleon has
    // two nodes called "galleon"), so reject a name that two mesh nodes share
    // instead of letting the map keep only the last one.
    const srcByName = new Map<string, Gltf['nodes'][number]>()
    for (const node of src.nodes) {
      if (node.mesh === undefined || !node.name) continue
      if (srcByName.has(node.name)) throw new Error(`${id}: two mesh nodes named ${node.name}`)
      srcByName.set(node.name, node)
    }
    let maxDev = 0
    for (const node of gltf.nodes) {
      if (node.mesh === undefined) continue
      const srcNode = srcByName.get(node.name ?? '')
      if (!srcNode) throw new Error(`${id}: no upstream mesh node named ${node.name}`)
      const outPrims = gltf.meshes[node.mesh]!.primitives
      const srcPrims = src.meshes[srcNode.mesh!]!.primitives
      if (outPrims.length !== srcPrims.length) {
        throw new Error(`${id}: primitive count differs on ${node.name}`)
      }
      outPrims.forEach((prim, pi) => {
        const outAcc = gltf.accessors[prim.attributes.POSITION]!
        const srcAcc = src.accessors[srcPrims[pi]!.attributes.POSITION]!
        if (outAcc.count !== srcAcc.count) {
          throw new Error(`${id}: vertex count differs on ${node.name}`)
        }
        const outView = gltf.bufferViews[outAcc.bufferView]!
        const srcView = src.bufferViews[srcAcc.bufferView]!
        const outStart = binStart + (outView.byteOffset ?? 0) + (outAcc.byteOffset ?? 0)
        const srcStart = (srcView.byteOffset ?? 0) + (srcAcc.byteOffset ?? 0)
        const outStride = outView.byteStride ?? 12
        const srcStride = srcView.byteStride ?? 12
        const srcBin = srcBuffer(srcView.buffer ?? 0)
        const srcEnd = srcStart + (srcAcc.count - 1) * srcStride + 12
        if (srcEnd > srcBin.length) {
          throw new Error(`${id}: upstream accessor on ${node.name} overruns its buffer`)
        }
        for (let v = 0; v < outAcc.count; v++) {
          for (let c = 0; c < 3; c++) {
            const a = outBin.readFloatLE(outStart + v * outStride + c * 4)
            const b = srcBin.readFloatLE(srcStart + v * srcStride + c * 4)
            maxDev = Math.max(maxDev, Math.abs(a - b))
          }
        }
      })
    }
    console.log(`${id}: max vertex deviation vs upstream = ${maxDev.toExponential(2)}`)
    if (maxDev > 1e-3) throw new Error(`${id}: deviation ${maxDev} exceeds 1e-3`)
  }
  console.log('verify: all 5 sample models match upstream within 1e-3')
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? '--apply'
  const models = JSON.parse(readFileSync(MODELS_JSON, 'utf8')) as ModelEntry[]

  if (mode === '--verify') {
    await verifySample(models)
    return
  }

  const pending = models.filter((m) => m.normalizedShift !== 0)
  console.log(`${pending.length} models with normalizedShift ≠ 0`)
  for (const entry of pending) console.log(`  ${entry.id} (shift ${entry.normalizedShift})`)
  if (mode === '--dry-run') return
  if (mode !== '--apply') throw new Error(`unknown mode "${mode}" (want --apply, --dry-run, --verify)`)

  // Preflight every model first. A refusal halfway through the write loop
  // would leave patched GLBs beside a models.json that still lists their
  // shifts, and the retry would subtract the shift a second time.
  for (const entry of pending) preflight(entry)
  console.log(`preflight passed for ${pending.length} models; writing`)

  // The catalog is rewritten after every model. It is 265 kB, so 279 rewrites
  // cost little, and each one keeps the catalog in step with the files.
  for (const entry of pending) {
    repairOne(entry)
    writeCatalog(models)
  }
  console.log(`repaired ${pending.length} GLBs and updated models.json`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/`
Expected: PASS — 8 tests

### Task 2: npm script wiring and dry-run

**Files:**
- Modify: `tools/pirate-nation-showcase/package.json`

- [x] **Step 1: Add the npm script**

In `package.json`, add to `scripts`:

```json
    "repair:models": "node --import tsx scripts/repair-model-normalization.ts",
```

- [x] **Step 2: Dry-run against the real pack**

Run: `npm run repair:models -- --dry-run`
Expected: prints `279 models with normalizedShift ≠ 0` followed by the id list; writes nothing (`git status` shows no GLB or models.json changes)

- [x] **Step 3: Typecheck the new script**

Run: `npm run typecheck`
Expected: PASS

### Task 3: Apply the repair and verify end to end

**Files:**
- Modify (by script): `tools/pirate-nation-showcase/public/assets/pirate-nation/runtime/models.json`
- Modify (by script): 279 GLBs under `tools/pirate-nation-showcase/public/assets/pirate-nation/runtime/models/`

- [x] **Step 1: Apply**

Run: `npm run repair:models`
Expected: `preflight passed for 279 models; writing` then `repaired 279 GLBs and updated models.json`

If the run stops part way, the catalog stays in step with the files: each GLB
is replaced by an atomic rename, and the catalog is rewritten after each model.
Restart the command to continue. Delete any leftover `*.tmp` file in the pack
directory first (`find public/assets/pirate-nation/runtime -name '*.tmp' -delete`).
To undo everything, restore the pack from Git LFS:
`git checkout -- public/assets/pirate-nation/runtime`.

- [x] **Step 2: Confirm idempotence**

Run: `npm run repair:models -- --dry-run`
Expected: `0 models with normalizedShift ≠ 0`

- [x] **Step 3: Verify against upstream sources**

Run: `npm run repair:models -- --verify`
Expected: PASS — 5 lines of `max vertex deviation …` (each ≤ 1e-3, typically ≈ 1e-5 from float32 round-tripping) and `verify: all 5 sample models match upstream within 1e-3`

- [x] **Step 4: Spot-check the repaired catalog bounds**

Run: `node -e "const m=require('./public/assets/pirate-nation/runtime/models.json'); const e=m.find(x=>x.id==='ships-item-4x8-pirateshipsmallundead'); console.log(JSON.stringify(e.bounds))"`
Expected: `size[1]` within 96.1 ± 0.5 and `min[1]` within -15.1 ± 0.5 (assembled source pose; was size 73 / min 0)

- [x] **Step 5: Full suite**

Run: `npm run typecheck && npm test && npm run test:e2e`
Expected: PASS — typecheck clean, all vitest green, 6 e2e green (the kraken/shipwright poses change but the assertions are structural)

- [x] **Step 6: Visual confirmation**

Create a throwaway Playwright spec `e2e/repair-visual.debug.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('undead ship renders assembled after repair', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).click()
  const box = page.getByPlaceholder(/Search \d+ models/)
  await expect(box).toBeVisible()
  await box.fill('pirateshipsmallundead')
  await page.getByRole('button', { name: /Pirateshipsmallundead/ }).first().click()
  await expect(page.locator('.model-viewer canvas, .viewer-error').first()).toBeVisible()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'test-results/repair-undead.png' })
})
```

Run: `npx playwright test e2e/repair-visual.debug.spec.ts`
Expected: test passes; open `test-results/repair-undead.png` and confirm the ship is assembled (mast/sails/spine attached to the hull — compare with the exploded screenshot in the conversation). Then delete the debug spec:

Run: `rm e2e/repair-visual.debug.spec.ts`

### Task 4: Document the repair

**Files:**
- Modify: `tools/pirate-nation-showcase/public/assets/pirate-nation/PROVENANCE.md`
- Modify: `tools/pirate-nation-showcase/README.md`

- [x] **Step 1: PROVENANCE.md**

Append a new section at the end of `PROVENANCE.md` (the file already ends at section 5):

```markdown
## 6. Post-extraction repairs

### 2026-08-24 — Y-normalization repair

The extractor normalized each model with a `normalizedShift`. It added that
shift to the mesh vertex Y coordinates. It must add the shift to the root node
transform. Composite models hold their parts under rotated pivot nodes. Each
rotated pivot also rotated the baked shift. As a result, 141 multi-part models
showed their parts away from the correct position (ships, buildings, world
bosses). All 279 shifted models were also too high.

The script `scripts/repair-model-normalization.ts` subtracted the shift from
the POSITION data of each affected GLB. This restores the upstream pose. The
`--verify` mode compared 5 repaired models with the upstream sources named in
`sourceRelativePath`. The maximum vertex deviation was less than 1e-3.

The script also refreshed `bounds`, `sizeBytes`, and `normalizedShift` in
`runtime/models.json`. The `bounds` of a repaired model is the world AABB of
the assembled pose. For a skinned model it is the bind-pose AABB. The `bounds`
of a model with no shift is still the extractor's mesh-space union.

The script is idempotent. Run `npm run repair:models` again after a
re-extract. Check a re-extract against upstream with
`npm run repair:models -- --verify`.
```

- [x] **Step 2: README.md**

In `README.md`, change the "Other scripts" paragraph to:

```markdown
Other scripts: `npm run build`, `npm run preview` (port 4190),
`npm run typecheck`, `npm test` (vitest), `npm run test:e2e` (playwright),
`npm run repair:models` (one-time GLB normalization repair; see
`public/assets/pirate-nation/PROVENANCE.md` §6).
```

- [x] **Step 3: Final verification**

Run: `npm run typecheck && npm test && npm run test:e2e`
Expected: PASS

## Open Questions

- Bounds for the 96 models that never had a shift remain the extractor's mesh-space unions (wrong for composite models with part offsets, e.g. multi-part decorations). Recompute them with the same `computeAssembledBounds` in a follow-up if the metadata inaccuracy ever matters — deliberately out of scope to keep this repair's blast radius tied to the actual bug.
- The extractor itself (external repo) still produces the broken normalization; a re-extract would reintroduce it. The fix should land there too, but that's outside this repo.
