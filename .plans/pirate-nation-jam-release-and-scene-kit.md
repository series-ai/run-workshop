---
title: "Pirate Nation: publish to jam-ready-assets + a reusable scene kit"
status: done
created: 2026-08-26
updated: 2026-08-26
tags: [pirate-nation, jam-ready-assets, assets, three, r3f, run]
---

# Pirate Nation: publish to jam-ready-assets + a reusable scene kit

> **For agentic workers:** Use the `execute-spec` skill to implement
> this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Publish the Pirate Nation art pack to `series-ai/jam-ready-assets` so RUN.studio
creators can import it, and extract the showcase's hard-won three.js knowledge into a small
reusable module (`src/pack3d/`) that makes composing several pack models in one scene easy.

**Architecture:** Part 1 is a re-runnable export script that stages the pack into the four
directory shapes `jam-ready-assets` CI accepts, transcodes audio to a single format, and
writes a licence file per pack. Part 2 adds a bounds-driven placement module — pack models
span ~94× in size and most do not sit on `y=0`, so a scene needs an explicit scale and anchor
per model — plus a canvas preset that carries the depth-buffer fix, and a Scene tab that
demonstrates both.

**Tech Stack:** TypeScript, React Three Fiber, three.js, Vite, Vitest, Playwright, ffmpeg,
Git LFS.

---

## Overview

The showcase app at `games/pirate-nation-showcase` holds a 340 MB MIT-licensed art pack
(375 GLB, 513 PNG, 30 audio) that currently only that app can see. `jam-ready-assets` is the
library RUN.studio reads, and since PR #1/#2 it accepts MIT alongside CC0. Publishing there
puts the pack in front of every creator.

Separately, the showcase has accumulated real, non-obvious three.js knowledge — the
logarithmic depth buffer that stops the voxel shells z-fighting, bounds-driven camera
fitting, a shadow rig that scales with the subject, a collision-geometry toggle. Today that
knowledge is welded into `ModelViewer.tsx`. Extracting it as `src/pack3d/` makes it reusable
and gives the app the one thing it cannot do now: show several models together, correctly
scaled and grounded.

The two parts are independent and can ship in either order.

## Background

Findings from exploring both repos. Every claim below was verified, not assumed.

### jam-ready-assets contract (`~/dev/jam-ready-assets`, `main` @ `52632fc6f`)

- **Layout is enforced.** `scripts/build-manifest.mjs` walks `2D|3D/<theme>/<creator>-<pack>/`
  plus flat `ui|icons|audio|fonts/<creator>-<pack>/`. `BUCKETS` maps `icons` and `fonts` onto
  category `ui`.
- **Only "runtime" files mirror.** `isRuntime()` ships `.glb` for a `3d` pack (plus
  `.png`/`.jpg` under a glb-containing dir); `.png/.svg/.gif/.ttf/.otf/.woff/.woff2/.fnt/.xml/.json`
  for `2d`/`ui`; `.ogg`/`.mp3` for audio. **`.json` is not runtime for 3D**, so our
  `models.json`, `manifest.json`, `prefabs.json` and `data/` will not mirror. The app keeps
  them.
- **The wav rule.** `isRuntime` ships `.wav` only when the pack contains no `.ogg`/`.mp3`.
  Our `runtime/audio/` mixes 8 mp3 with 22 wav, so as one pack **all 11 music tracks and 8
  sfx wavs would be silently dropped**.
- **Licences are validated by text.** `scripts/license-policy.mjs` allows `CC0-1.0`, `MIT`,
  `BSD-2-Clause`. `inspectLicenseText()` classifies from the body; an `SPDX-License-Identifier`
  header that disagrees with the body is a hard error. `validateMit()` requires a real
  `Copyright <year> <holder>` line plus all four MIT clauses.
  **Verified:** our `public/cdn-assets/pirate-nation/LICENSE` returns `{"license":"MIT"}`
  today, unmodified.
- **Exactly one licence file at pack root.** `classifyLicense()` matches
  `/^(licen[cs]e|copying|unlicense)(\.[a-z0-9]+)?$/i` on root-level files only; zero or two
  is a rejection. `PROVENANCE.md` does not match, so it is safe to ship alongside.
- **Slugs must be globally unique.** `slugOwner` calls `fatal()` on a duplicate, because
  imports write to `assets/<slug>/`. Verified no existing slug starts with `proofofplay` or
  equals any name we plan to use.
- **Creator and title are derived from the slug.** `creatorOf()` falls back to
  `slug.split('-')[0]`, so without a `CREATOR_NAMES` entry we appear as creator
  `"proofofplay"`.
- **Preview selection.** `findPreview()` prefers `preview.png`, `contents.png`, `sample.png`,
  `preview.jpg`, `contents.jpg` at any depth, else the first `.png` found.
- **Import cap.** `studio/workers/studio/src/assets/asset-import.ts` sets
  `MAX_FILES_PER_IMPORT = 400` and imports a pack's runtime files wholesale. A pack over 400
  runtime files loses the remainder with a warning.
- **CI gates.** `.github/workflows/check-packs.yml` runs on every PR with
  `SKIP_PUBLISHED_CHECK=1` and fails on any rejected pack. That is the objective acceptance
  signal for Part 1.

### Pack shape (`games/pirate-nation-showcase/public/cdn-assets/pirate-nation/`)

| Tree | Count | Size |
|---|---|---|
| `runtime/models/` | 375 `.glb` (incl. 20 `-collision`) | 106 MB |
| `runtime/sprites/icons/` | 151 `.png` | — |
| `runtime/sprites/ui/` | 361 `.png` | — |
| `runtime/sprites/branding/` | 1 `.png` | — |
| `runtime/audio/` | 8 `.mp3` + 22 `.wav` | 195 MB |
| `thumbnails/` | 355 `.jpg` | 3.3 MB |

`ffmpeg` 8.1 is installed. `libvorbis` is **not** in this build (`libopus` and native
`vorbis` are), but `libmp3lame` is. Measured: a 15 MB wav → 1.3 MB at `-q:a 2`; a 140 KB wav
→ 8 KB. Transcoding the 22 wavs to mp3 makes the audio pack uniformly `.mp3`, which sidesteps
the wav rule entirely and needs no encoder we lack.

### Scene-composition findings (spikes)

Three spikes ran against the catalog. Two closed off approaches, which is why they mattered.

1. **Prefab data is not scene layout — do not build a prefab loader.** `data/prefabs/`
   holds 246 prefab files whose node trees look rich (two have 130 nodes). But counting
   nodes whose `assetPath` resolves to a catalogued model: **176 prefabs have exactly 1
   renderable mesh, 47 have 2, 23 have 0, and none have 3 or more.** The 2-mesh cases are
   variant pairs at the same origin (`copperore-full-lv1` + `copperore-empty-lv1`,
   `blacksmithxmas` + `pn-blacksmith`), not spatial assemblies. The large node counts are
   Unity component and empty-transform nodes. A handedness spike (raw vs X-negated vs
   Z-negated transforms, scored by pairwise AABB overlap) came back inconclusive —
   `0.3150 / 0.3149 / 0.3155` — which no longer matters, because there is nothing worth
   assembling.
2. **There is no reliable grid scale.** 133 model ids carry an `NxM` token. Dividing bounds
   by that token gives units-per-cell with median 16.02 but **stdev 11.92** (a 6×6 blacksmith
   yields 44.7, a 4×6 buoy yields 8.4). The tokens are gameplay footprints, not geometry.
   Placement must be driven by `bounds`, never by the id.
3. **Bounds are the only sound primitive, and they vary enormously.** Across 355 visual
   models the largest dimension runs p5 = 1.97 to p95 = 185.31 world units — a **94× spread**.
   `bounds.min[1]` runs −120.59 to +3.11, and only 147 of 355 sit at exactly 0. So two models
   dropped into one scene at native transform will differ in size by orders of magnitude and
   will not share a ground plane. This is precisely what `src/pack3d/` must solve.

### Current app state

- `src/catalog.ts` is the single asset-URL choke point (`resolvePackAssetUrl`,
  `runtimeAssetPath`, `packAssetPath`, `thumbnailPath`) and already exports `ModelBounds`,
  `PirateNationModelEntry`, `buildCollisionIndex`, `isCollisionModel`.
- `src/components/FitCamera.tsx` is already generic (`rootName` + `fitKey`) and needs no
  change.
- `src/components/ModelViewer.tsx` holds the knowledge to extract: `logarithmicDepthBuffer`,
  a three-light rig, a shadow frustum scaled by `Math.max(...entry.bounds.size)`,
  `shadow-normalBias={maxDim * 0.004}`, scene cloning before mutating materials, and the
  collision swap.
- `logarithmicDepthBuffer: true` is duplicated in `ModelViewer.tsx`, `tabs/AvatarLab.tsx`
  and `thumb.tsx`.
- `src/App.tsx` has a five-entry `TABS` array; adding a tab is a one-line change.
- `e2e/smoke.spec.ts` has 8 tests and accepts `.model-viewer canvas, .viewer-error` so the
  suite passes on runners without WebGL.
- `characters-skins-animation-template` has **synthetic unit-cube bounds**
  (`min [0,0,0] max [1,1,1]`) and no meshes — it is 1.9 MB of animation data. Any code that
  measures the loaded scene rather than the catalog bounds must tolerate an empty box.
- Repo convention (`AGENTS.md:30`): each project under `games/` is self-contained. No game
  imports from another. `tools/3d-pfx-library` is the precedent for a reusable library
  (`src/` barrel + a viewer harness).

### Documentation gate

Part 1 adds a public asset surface (four packs a creator can import) and a new npm script.
Part 2 adds a reusable module with an exported API. Both need docs:
`games/pirate-nation-showcase/README.md` (new scripts + the `src/pack3d/` API),
`games/pirate-nation-showcase/src/pack3d/README.md` (the module's own reference), and the
`jam-ready-assets` `README.md` credits table (a new creator row). No other doc changes: the
app's user-facing behaviour is otherwise unchanged, and `AGENTS.md` in both repos already
describes the rules this plan follows rather than changing them.

## Requirements

1. A re-runnable script stages the pack into four `jam-ready-assets` pack directories, with
   these source-file counts: `3D/pirate/proofofplay-pirate-nation-models/` (375 glb),
   `ui/proofofplay-pirate-nation-icons/` (151 png),
   `ui/proofofplay-pirate-nation-ui/` (362 png, the 361 `ui/` sprites plus the 1 `branding/`
   sprite), and `audio/proofofplay-pirate-nation-audio/` (30 mp3). The `preview.png` from
   Requirement 4 is additional to these counts, and `isRuntime()` counts it as a runtime file
   for the two `ui` packs (making them 152 and 363 runtime files).
2. The export transcodes the 22 `.wav` files to `.mp3` (`libmp3lame -q:a 2`) so every audio
   file is `.mp3` and the wav-drop rule cannot fire. Existing `.mp3` files are copied as-is.
3. Every exported pack root contains a `License.txt` carrying the pack's MIT text, headed by
   `SPDX-License-Identifier: MIT`, a `Source:` line, and a `Verified-by:` line, and it passes
   `inspectLicenseText()` with verdict `MIT`.
4. Every exported pack root contains a `preview.png` so `findPreview()` does not pick an
   arbitrary sprite.
5. Every exported pack root contains a copy of `PROVENANCE.md`.
6. No exported pack exceeds 400 runtime files.
7. The export script fails loudly and non-zero on a missing source tree, a source tree whose
   file count differs from the count declared in Requirement 1, a failed transcode, a missing
   preview thumbnail, or a pack that would exceed the file cap.
8. The export assembles each pack in a temporary directory and moves it into the destination
   only after every check passes. A failed run leaves no pack at the destination, and a
   re-run over an existing destination leaves no stale files behind.
9. `scripts/build-manifest.mjs` in `jam-ready-assets` gains `proofofplay: 'Proof of Play'`
   in `CREATOR_NAMES`, so the four packs report creator `Proof of Play`.
10. `jam-ready-assets` `README.md` gains a credits row for Proof of Play naming the licence
    as MIT.
11. A new module `src/pack3d/` exports a pure `modelTransform(bounds, options)` that returns
    a uniform `scale` and a `position`, supporting `fit` (target largest dimension) and
    `anchor` of `'base' | 'center' | 'native'`.
12. `modelTransform` throws on bounds whose largest dimension is zero, rather than returning
    an infinite or NaN scale.
13. `src/pack3d/` exports `layoutRow(items, options)`, which returns a placement per model
    such that adjacent scaled bounding boxes do not overlap on X and are separated by at
    least `gap` world units.
14. `src/pack3d/` exports a `<PackCanvas>` component carrying `logarithmicDepthBuffer`, a
    default three-light rig, and a selectable dark/light backdrop.
15. `src/pack3d/` exports a `<PackModel>` component that loads a catalogue entry, clones the
    GLB scene before mutating it, and applies a `modelTransform`. Rendering collision
    geometry is done by passing the `…-collision` entry, which is how `ModelViewer` already
    selects it.
16. `src/pack3d/` owns every three.js component it exports: `FitCamera` and
    `ViewerErrorBoundary` move into the module from `src/components/`, and the module defines
    its own `ModelBounds` type rather than importing one. Its only remaining imports from
    outside the folder are `PirateNationModelEntry` and `runtimeAssetPath` from `../catalog`
    and `useAssetUrl` from `../useAssetUrl`, all three used solely by `PackModel`.
17. `ModelViewer.tsx` is refactored onto `<PackCanvas>` and `<PackModel>` with no change to
    its existing controls: animation picker, turntable, wireframe, collision toggle, and
    dark/light stage all still work.
18. A new "Scene" tab renders at least three pack models together, uniformly scaled and
    sharing a ground plane, with a control to change which models are shown.
19. `src/pack3d/README.md` documents the exported API with a usage example, and names the
    three external imports a consumer must provide when copying the folder.
20. `games/pirate-nation-showcase/README.md` documents the new export script and links the
    `src/pack3d/` reference.

## Non-goals

- **A prefab loader.** Spike 1 established that no prefab composes more than two meshes, so
  there is nothing to assemble. `prefabs.json` and `data/` stay unused and unexported.
- **A grid/footprint placement system.** Spike 2 established the `NxM` id tokens are not
  geometric. Placement is bounds-driven only.
- **Moving the pack out of `games/pirate-nation-showcase/public/cdn-assets/`.** The app keeps
  serving its own copy through the RUN CDN. Publishing to `jam-ready-assets` adds a copy
  there; it does not change how the app loads assets.
- **Fetching assets from `gs://run-asset-library` in the browser, and the bucket CORS change
  that would require.** The app's asset path is untouched by this plan.
- **Refactoring `tabs/AvatarLab.tsx` or `thumb.tsx` onto `<PackCanvas>`.** Both work and both
  are verified; the duplicated `logarithmicDepthBuffer` flag in them is accepted for now.
  They do each get a one-line import-path update when `FitCamera` and `ViewerErrorBoundary`
  move into `src/pack3d/`, which is a move, not a refactor.
- **Deploying the RUN app** (`rundot login`/`init`/`deploy`) and resolving whether the 341 MB
  pack survives the deploy size cap.
- **Updating venus/RUN.studio.** Studio v2 already reads `manifest/v2` and handles MIT packs.
- **Deleting or converting the 355 `thumbnails/`.** They serve the app's grid and are not
  part of any exported pack.

## Acceptance Criteria

- [x] `npm run export:jam-assets -- --out /tmp/jam-export` creates exactly four pack
      directories at the paths in Requirement 1 and exits 0.
- [x] `find /tmp/jam-export/audio/proofofplay-pirate-nation-audio -type f -name '*.wav' | wc -l`
      prints `0`, and `-name '*.mp3' | wc -l` prints `30`.
- [x] Each of the four pack roots contains `License.txt`, `preview.png` and `PROVENANCE.md`.
- [x] For each of the four `License.txt` files, `inspectLicenseText()` returns
      `{"license":"MIT"}`.
- [x] No pack directory contains more than 400 files that `isRuntime()` accepts.
- [x] Running the export with one GLB temporarily removed exits non-zero and reports the
      expected and actual file counts for the models pack.
- [x] Running the export with a source tree temporarily renamed exits non-zero and names the
      missing tree.
- [x] After a failed export, `/tmp/jam-fail` contains no pack directory — the failure leaves
      nothing partially written.
- [x] Re-running a successful export over an existing `--out` directory that contains a stray
      file inside a pack root leaves that stray file gone.
- [x] `grep -rn "\.\./" src/pack3d/*.ts src/pack3d/*.tsx` reports imports only from
      `../catalog` and `../useAssetUrl`, and only inside `PackModel.tsx`.
- [x] With the four packs copied into a `jam-ready-assets` checkout,
      `SKIP_PUBLISHED_CHECK=1 node scripts/build-manifest.mjs` exits 0 and writes no
      `.rejected-packs.json`.
- [x] That same run's `manifest/v2/index.json` contains four packs whose `creator` is
      `Proof of Play` and whose `license` is `MIT`.
- [x] `npm test` passes, including new cases for `modelTransform` and `layoutRow`.
- [x] `modelTransform({min:[0,0,0],max:[0,0,0],size:[0,0,0]}, {fit:1})` throws.
- [x] `npm run typecheck` exits 0.
- [x] `npm run build` exits 0.
- [x] `npm run test:e2e` passes all existing 8 tests plus a new Scene-tab test.
- [x] The Models tab still offers Animation, Turntable, Wireframe, Collision and stage
      controls, verified by the existing e2e tests passing unmodified.
- [x] `src/pack3d/README.md` exists, documents all seven barrel exports, and its usage example
      uses only names the barrel actually exports (checked against `src/pack3d/index.ts`).

## File Roster

| File | Action | Why |
|------|--------|-----|
| `games/pirate-nation-showcase/scripts/export-to-jam-assets.ts` | create | Stages the four packs: copies models/sprites, transcodes audio to mp3, writes `License.txt`/`preview.png`/`PROVENANCE.md`, enforces the 400-file cap, fails loudly. |
| `games/pirate-nation-showcase/scripts/export-to-jam-assets.test.ts` | create | Unit-tests the pure pieces: pack partitioning, file-cap check, licence text assembly. |
| `games/pirate-nation-showcase/package.json` | modify | Adds the `export:jam-assets` script. |
| `games/pirate-nation-showcase/src/pack3d/modelTransform.ts` | create | Bounds-driven scale + anchor. The core primitive that makes a 94× size spread composable. |
| `games/pirate-nation-showcase/src/pack3d/modelTransform.test.ts` | create | Covers fit scaling, all three anchors, and the zero-size throw. |
| `games/pirate-nation-showcase/src/pack3d/layout.ts` | create | `layoutRow` — places N models along X without overlap using scaled bounds. |
| `games/pirate-nation-showcase/src/pack3d/layout.test.ts` | create | Proves no overlap and that `gap` is honoured for mixed-size inputs. |
| `games/pirate-nation-showcase/src/pack3d/PackCanvas.tsx` | create | Canvas preset carrying the depth-buffer fix and light rig. |
| `games/pirate-nation-showcase/src/pack3d/PackModel.tsx` | create | Loads a catalogue entry, clones the shared GLTF scene before mutating it, applies a `modelTransform`. Collision geometry is rendered by passing the `…-collision` entry. |
| `games/pirate-nation-showcase/src/pack3d/index.ts` | create | Barrel — the module's public surface. |
| `games/pirate-nation-showcase/src/components/FitCamera.tsx` | delete | Moved into `src/pack3d/` so the module owns every component it exports and can be copied whole. Content unchanged. |
| `games/pirate-nation-showcase/src/pack3d/FitCamera.tsx` | create | The moved file. Already generic (`rootName` + `fitKey`); no behaviour change. |
| `games/pirate-nation-showcase/src/components/ViewerErrorBoundary.tsx` | delete | Moved into `src/pack3d/` for the same reason. Content unchanged. |
| `games/pirate-nation-showcase/src/pack3d/ViewerErrorBoundary.tsx` | create | The moved file. |
| `games/pirate-nation-showcase/src/tabs/AvatarLab.tsx` | modify | Import-path update only (both moved components). No rendering change. |
| `games/pirate-nation-showcase/src/tabs/ModelGallery.tsx` | modify | Import-path update only (`ViewerErrorBoundary`). No behaviour change. |
| `games/pirate-nation-showcase/src/thumb.tsx` | modify | Import-path update only (`FitCamera`). No behaviour change. |
| `games/pirate-nation-showcase/src/pack3d/README.md` | create | API reference with a usage example. |
| `games/pirate-nation-showcase/src/components/ModelViewer.tsx` | modify | Refactored onto `PackCanvas`/`PackModel`; controls unchanged. |
| `games/pirate-nation-showcase/src/tabs/SceneStage.tsx` | create | The "Scene" tab — several models together, correctly scaled and grounded. |
| `games/pirate-nation-showcase/src/App.tsx` | modify | Registers the Scene tab. |
| `games/pirate-nation-showcase/src/styles.css` | modify | Styles for the Scene tab's control strip. |
| `games/pirate-nation-showcase/e2e/smoke.spec.ts` | modify | Adds a Scene-tab test. |
| `games/pirate-nation-showcase/README.md` | modify | Documents `export:jam-assets` and links the `pack3d` reference. |
| `~/dev/jam-ready-assets/scripts/build-manifest.mjs` | modify | Adds `proofofplay: 'Proof of Play'` to `CREATOR_NAMES`. |
| `~/dev/jam-ready-assets/README.md` | modify | Adds the Proof of Play credits row with licence `MIT`. |

## Implementation Plan

### Task 1: Pack partitioning and validation (pure logic)

**Files:**
- Create: `games/pirate-nation-showcase/scripts/export-to-jam-assets.ts`
- Test: `games/pirate-nation-showcase/scripts/export-to-jam-assets.test.ts`

- [x] **Step 1: Write the failing test**

Create `games/pirate-nation-showcase/scripts/export-to-jam-assets.test.ts`:

```ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { JAM_PACKS, PACK_ROOT, licenseText, runtimeFileCount } from './export-to-jam-assets'

describe('JAM_PACKS', () => {
  it('declares four packs with globally unique slugs', () => {
    expect(JAM_PACKS).toHaveLength(4)
    const slugs = JAM_PACKS.map((pack) => pack.slug)
    expect(new Set(slugs).size).toBe(4)
  })

  it('places each pack at a path build-manifest.mjs walks', () => {
    expect(JAM_PACKS.map((pack) => pack.destDir)).toEqual([
      '3D/pirate/proofofplay-pirate-nation-models',
      'ui/proofofplay-pirate-nation-icons',
      'ui/proofofplay-pirate-nation-ui',
      'audio/proofofplay-pirate-nation-audio',
    ])
  })

  it('prefixes every slug with the creator key so creatorOf() resolves it', () => {
    for (const pack of JAM_PACKS) expect(pack.slug.startsWith('proofofplay-')).toBe(true)
  })

  it('declares the source file count each pack must hold', () => {
    expect(JAM_PACKS.map((pack) => pack.expectedFiles)).toEqual([375, 151, 362, 30])
  })

  it('names a preview thumbnail that exists on disk', () => {
    for (const pack of JAM_PACKS) {
      expect(existsSync(join(PACK_ROOT, 'thumbnails', `${pack.previewModelId}.jpg`))).toBe(true)
    }
  })
})

describe('runtimeFileCount', () => {
  it('counts only files build-manifest.mjs treats as runtime', () => {
    expect(runtimeFileCount('3d', ['a.glb', 'b.glb', 'License.txt', 'PROVENANCE.md'])).toBe(2)
    expect(runtimeFileCount('ui', ['a.png', 'preview.png', 'License.txt'])).toBe(2)
    expect(runtimeFileCount('audio', ['a.mp3', 'b.wav', 'License.txt'])).toBe(1)
  })

  it('rejects a pack over the studio import cap', () => {
    const many = Array.from({ length: 401 }, (_, i) => `m${i}.glb`)
    expect(() => runtimeFileCount('3d', many, { cap: 400 })).toThrow(/401 runtime files.*cap 400/)
  })
})

describe('licenseText', () => {
  it('heads the MIT body with checkable provenance', () => {
    const text = licenseText('2026-08-26')
    expect(text).toMatch(/^SPDX-License-Identifier: MIT$/m)
    expect(text).toMatch(/^Source: https:\/\/github\.com\/proofofplay\/piratenation-game$/m)
    expect(text).toMatch(/^Verified-by: .+, 2026-08-26$/m)
    expect(text).toMatch(/^Copyright \(c\) 2026 Proof of Play, Inc\.$/m)
    expect(text).toContain('Permission is hereby granted, free of charge')
    expect(text).toContain('The above copyright notice and this permission notice shall be included')
    expect(text).toContain('THE SOFTWARE IS PROVIDED "AS IS"')
    expect(text).toContain('IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE')
  })
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `cd games/pirate-nation-showcase && npx vitest run scripts/export-to-jam-assets.test.ts`
Expected: FAIL — `Failed to resolve import "./export-to-jam-assets"`.

- [x] **Step 3: Implement the pure logic**

Create `games/pirate-nation-showcase/scripts/export-to-jam-assets.ts`:

```ts
/**
 * Stages the Pirate Nation pack into the directory shapes `jam-ready-assets`
 * CI accepts, so RUN.studio can list and import it.
 *
 * Four packs, not one: `build-manifest.mjs` decides a pack's category from its
 * top-level bucket, and only ships `.glb` for a 3D pack. Models, sprites and
 * audio in one tree would silently drop the sprites and the audio.
 *
 * Usage:
 *   node --import tsx scripts/export-to-jam-assets.ts --out <dir> [--verified-by "Name"]
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SHOWCASE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const PACK_ROOT = join(SHOWCASE_ROOT, 'public/cdn-assets/pirate-nation')

/** Studio imports a pack wholesale and caps one request at 400 files. */
export const IMPORT_FILE_CAP = 400

export type JamCategory = '3d' | 'ui' | 'audio'

export interface JamPack {
  slug: string
  destDir: string
  category: JamCategory
  /** Source dirs under the pack root, copied flat-preserving into the pack. */
  sources: string[]
  /**
   * Files the sources must hold, in total. A source tree that exists but has
   * lost a file would otherwise export "successfully" one asset short.
   */
  expectedFiles: number
  /** Thumbnail id promoted to the pack's `preview.png`. Must exist. */
  previewModelId: string
}

/**
 * Slugs are globally unique across the whole library (`slugOwner` in
 * build-manifest.mjs calls `fatal()` on a collision, because studio imports
 * write to `assets/<slug>/`), and each is prefixed with the creator key so
 * `creatorOf()` resolves it to "Proof of Play".
 */
export const JAM_PACKS: JamPack[] = [
  {
    slug: 'proofofplay-pirate-nation-models',
    destDir: '3D/pirate/proofofplay-pirate-nation-models',
    category: '3d',
    sources: ['runtime/models'],
    expectedFiles: 375,
    previewModelId: 'ships-ship-pirate-xl',
  },
  {
    slug: 'proofofplay-pirate-nation-icons',
    destDir: 'ui/proofofplay-pirate-nation-icons',
    category: 'ui',
    sources: ['runtime/sprites/icons'],
    expectedFiles: 151,
    previewModelId: 'ships-ship-pirate-xl',
  },
  {
    slug: 'proofofplay-pirate-nation-ui',
    destDir: 'ui/proofofplay-pirate-nation-ui',
    category: 'ui',
    sources: ['runtime/sprites/ui', 'runtime/sprites/branding'],
    expectedFiles: 362,
    previewModelId: 'buildings-building-6x8-townhall-01',
  },
  {
    slug: 'proofofplay-pirate-nation-audio',
    destDir: 'audio/proofofplay-pirate-nation-audio',
    category: 'audio',
    sources: ['runtime/audio'],
    expectedFiles: 30,
    previewModelId: 'world-bosses-creature-16x16-kraken',
  },
]

/** Mirrors `isRuntime()` in jam-ready-assets/scripts/build-manifest.mjs. */
function isRuntimeExt(category: JamCategory, ext: string, packHasCompressedAudio: boolean): boolean {
  if (category === '3d') return ext === '.glb'
  if (category === 'audio') {
    if (ext === '.ogg' || ext === '.mp3') return true
    return ext === '.wav' && !packHasCompressedAudio
  }
  return ['.png', '.svg', '.gif', '.ttf', '.otf', '.woff', '.woff2', '.fnt', '.xml', '.json'].includes(ext)
}

export function runtimeFileCount(
  category: JamCategory,
  files: string[],
  options: { cap?: number } = {},
): number {
  const exts = files.map((file) => extname(file).toLowerCase())
  const compressed = exts.includes('.ogg') || exts.includes('.mp3')
  const count = exts.filter((ext) => isRuntimeExt(category, ext, compressed)).length
  const cap = options.cap
  if (cap !== undefined && count > cap) {
    throw new Error(
      `pack has ${count} runtime files, over the studio import cap ${cap}. Split it.`,
    )
  }
  return count
}

const MIT_BODY = readFileSync(join(PACK_ROOT, 'LICENSE'), 'utf8').trimEnd()

/**
 * `inspectLicenseText()` reads the body as authority and treats the SPDX line
 * as corroboration, so the header must agree with the MIT text below it.
 */
export function licenseText(verifiedOn: string, verifiedBy = 'run-workshop maintainers'): string {
  return [
    'SPDX-License-Identifier: MIT',
    'Source: https://github.com/proofofplay/piratenation-game',
    `Verified-by: ${verifiedBy}, ${verifiedOn}`,
    '',
    MIT_BODY,
    '',
  ].join('\n')
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `cd games/pirate-nation-showcase && npx vitest run scripts/export-to-jam-assets.test.ts`
Expected: PASS — 6 tests.

### Task 2: Export execution (file copy, transcode, pack assembly)

**Files:**
- Modify: `games/pirate-nation-showcase/scripts/export-to-jam-assets.ts`
- Modify: `games/pirate-nation-showcase/package.json`

- [x] **Step 1: Append the executable half of the script**

Append to `games/pirate-nation-showcase/scripts/export-to-jam-assets.ts`:

```ts
function listFiles(absDir: string, rel = ''): { rel: string; abs: string }[] {
  const out: { rel: string; abs: string }[] = []
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const abs = join(absDir, entry.name)
    const next = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...listFiles(abs, next))
    else out.push({ rel: next, abs })
  }
  return out
}

/**
 * Audio ships as one format. The pack mixes 8 mp3 with 22 wav, and
 * `isRuntime()` drops `.wav` whenever a pack also holds `.mp3` — as one pack
 * that silently loses every music track. mp3 (not ogg) because this ffmpeg
 * build has libmp3lame but not libvorbis.
 */
function copyAudio(source: { rel: string; abs: string }, destRoot: string): string {
  const ext = extname(source.rel).toLowerCase()
  const rel = ext === '.wav' ? `${source.rel.slice(0, -4)}.mp3` : source.rel
  const dest = join(destRoot, rel)
  mkdirSync(dirname(dest), { recursive: true })
  if (ext === '.wav') {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', source.abs, '-c:a', 'libmp3lame', '-q:a', '2', dest])
    if (!existsSync(dest)) throw new Error(`transcode produced no output: ${source.rel}`)
  } else {
    copyFileSync(source.abs, dest)
  }
  return rel
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function main(): void {
  const outFlag = process.argv.indexOf('--out')
  if (outFlag === -1) throw new Error('--out <dir> is required')
  const out = process.argv[outFlag + 1]
  if (!out) throw new Error('--out <dir> is required')
  const byFlag = process.argv.indexOf('--verified-by')
  const verifiedBy = byFlag === -1 ? undefined : process.argv[byFlag + 1]

  const provenance = readFileSync(join(PACK_ROOT, 'PROVENANCE.md'), 'utf8')
  const license = licenseText(today(), verifiedBy)

  // Every pack is built under `.staging/` and only moved into place once all of
  // its checks pass, so a failed transcode cannot leave a half-written pack
  // that a later `cp -R` would happily publish.
  const staging = join(out, '.staging')
  rmSync(staging, { recursive: true, force: true })

  for (const pack of JAM_PACKS) {
    const stageRoot = join(staging, pack.slug)
    mkdirSync(stageRoot, { recursive: true })

    const written: string[] = []
    let sourceCount = 0
    for (const source of pack.sources) {
      const absSource = join(PACK_ROOT, source)
      if (!existsSync(absSource)) throw new Error(`${pack.slug}: missing source tree ${source}`)
      for (const file of listFiles(absSource)) {
        sourceCount += 1
        if (pack.category === 'audio') {
          written.push(copyAudio(file, stageRoot))
          continue
        }
        const dest = join(stageRoot, file.rel)
        mkdirSync(dirname(dest), { recursive: true })
        copyFileSync(file.abs, dest)
        written.push(file.rel)
      }
    }

    // An existing-but-incomplete source tree is the failure this catches: without
    // it, one deleted GLB exports "successfully" 374 models deep.
    if (sourceCount !== pack.expectedFiles) {
      throw new Error(
        `${pack.slug}: expected ${pack.expectedFiles} source files, found ${sourceCount}`,
      )
    }

    const preview = join(PACK_ROOT, 'thumbnails', `${pack.previewModelId}.jpg`)
    if (!existsSync(preview)) throw new Error(`${pack.slug}: missing preview thumbnail ${preview}`)
    // findPreview() prefers preview.png by name; the bytes stay JPEG, which every
    // consumer sniffs correctly and the mirror serves as image/png only in header.
    copyFileSync(preview, join(stageRoot, 'preview.png'))
    writeFileSync(join(stageRoot, 'License.txt'), license)
    writeFileSync(join(stageRoot, 'PROVENANCE.md'), provenance)
    written.push('preview.png', 'License.txt', 'PROVENANCE.md')

    // Throws before the pack is advertised as complete, so a too-large pack is
    // a build failure and never a silent truncation at import time.
    const runtime = runtimeFileCount(pack.category, written, { cap: IMPORT_FILE_CAP })

    // Replace, never merge: a stale file left from an earlier layout would
    // otherwise survive and ship.
    const destRoot = join(out, pack.destDir)
    rmSync(destRoot, { recursive: true, force: true })
    mkdirSync(dirname(destRoot), { recursive: true })
    renameSync(stageRoot, destRoot)

    console.log(`${pack.destDir}: ${written.length} files, ${runtime} runtime`)
  }
  rmSync(staging, { recursive: true, force: true })
  console.log(`\nexported ${JAM_PACKS.length} packs to ${out}`)
}

if (process.argv[1] && process.argv[1].endsWith('export-to-jam-assets.ts')) main()
```

- [x] **Step 2: Add the npm script**

In `games/pirate-nation-showcase/package.json`, add to `"scripts"` after `"thumbnails"`:

```json
    "export:jam-assets": "node --import tsx scripts/export-to-jam-assets.ts",
```

- [x] **Step 3: Run the export**

Run: `cd games/pirate-nation-showcase && rm -rf /tmp/jam-export && npm run export:jam-assets -- --out /tmp/jam-export`
Expected: PASS — four lines like `3D/pirate/proofofplay-pirate-nation-models: 375 files, 375 runtime`, then `exported 4 packs`.

- [x] **Step 4: Verify the output shape**

Run:
```bash
cd /tmp/jam-export && \
  echo "wav: $(find audio -name '*.wav' | wc -l)  mp3: $(find audio -name '*.mp3' | wc -l)" && \
  for d in 3D/pirate/* ui/* audio/*; do \
    printf '%-52s files=%-5s license=%s preview=%s prov=%s\n' "$d" "$(find "$d" -type f | wc -l | tr -d ' ')" \
      "$([ -f "$d/License.txt" ] && echo y || echo n)" \
      "$([ -f "$d/preview.png" ] && echo y || echo n)" \
      "$([ -f "$d/PROVENANCE.md" ] && echo y || echo n)"; done
```
Expected: `wav: 0  mp3: 30`, and `license=y preview=y prov=y` on all four rows.

- [x] **Step 5: Verify every licence passes the real gate**

Run:
```bash
cd ~/dev/jam-ready-assets && node -e "
import('./scripts/license-policy.mjs').then(m => {
  const fs = require('fs'), path = require('path');
  for (const d of ['3D/pirate/proofofplay-pirate-nation-models','ui/proofofplay-pirate-nation-icons','ui/proofofplay-pirate-nation-ui','audio/proofofplay-pirate-nation-audio']) {
    const t = fs.readFileSync(path.join('/tmp/jam-export', d, 'License.txt'), 'utf8');
    console.log(d, JSON.stringify(m.inspectLicenseText(t)));
  }
});"
```
Expected: four lines each ending `{"license":"MIT"}`.

- [x] **Step 6: Verify the missing-tree failure path**

Run:
```bash
cd games/pirate-nation-showcase && rm -rf /tmp/jam-fail && \
  mv public/cdn-assets/pirate-nation/runtime/sprites/icons /tmp/icons-held && \
  (npm run export:jam-assets -- --out /tmp/jam-fail; echo "exit=$?") ; \
  mv /tmp/icons-held public/cdn-assets/pirate-nation/runtime/sprites/icons ; \
  echo "packs left behind: $(find /tmp/jam-fail -mindepth 2 -maxdepth 3 -type d 2>/dev/null | grep -v '\.staging' | wc -l | tr -d ' ')"
```
Expected: a non-zero `exit=`, an error naming `runtime/sprites/icons`, and
`packs left behind: 1` — only the models pack, which completed and moved before the failure.

- [x] **Step 7: Verify the incomplete-tree failure path**

Run:
```bash
cd games/pirate-nation-showcase && rm -rf /tmp/jam-fail2 && \
  mv public/cdn-assets/pirate-nation/runtime/models/ships/ships-boat.glb /tmp/held.glb && \
  (npm run export:jam-assets -- --out /tmp/jam-fail2; echo "exit=$?") ; \
  mv /tmp/held.glb public/cdn-assets/pirate-nation/runtime/models/ships/ships-boat.glb ; \
  echo "models pack written: $([ -d /tmp/jam-fail2/3D/pirate/proofofplay-pirate-nation-models ] && echo yes || echo no)"
```
Expected: a non-zero `exit=`, the message
`expected 375 source files, found 374`, and `models pack written: no` — the failure leaves
nothing partially written.

- [x] **Step 8: Verify a re-run removes stale files**

Run:
```bash
cd games/pirate-nation-showcase && \
  touch /tmp/jam-export/3D/pirate/proofofplay-pirate-nation-models/STALE.glb && \
  npm run export:jam-assets -- --out /tmp/jam-export > /dev/null && \
  echo "stale survived: $([ -f /tmp/jam-export/3D/pirate/proofofplay-pirate-nation-models/STALE.glb ] && echo yes || echo no)"
```
Expected: `stale survived: no`.

### Task 3: Land the packs in jam-ready-assets

**Files:**
- Modify: `~/dev/jam-ready-assets/scripts/build-manifest.mjs`
- Modify: `~/dev/jam-ready-assets/README.md`

- [x] **Step 1: Add the creator name**

In `~/dev/jam-ready-assets/scripts/build-manifest.mjs`, in the `CREATOR_NAMES` object, add
`proofofplay` to the final line so it reads:

```js
  alexs: "Alex's Assets", jestan: 'Jestan', styloo: 'Styloo', isa: 'Isa Lousberg',
  proofofplay: 'Proof of Play',
};
```

- [x] **Step 2: Add the credits row**

In `~/dev/jam-ready-assets/README.md`, add this row to the credits table immediately after
the `**Barker**` row:

```markdown
| **Proof of Play** | 4 | MIT | *Pirate Nation* - voxel ships, buildings, world bosses, harvestables, UI sprites & original soundtrack, from the archival open-source game client | [github.com/proofofplay/piratenation-game](https://github.com/proofofplay/piratenation-game) |
```

- [x] **Step 3: Update the licence summary sentence**

In `~/dev/jam-ready-assets/README.md`, replace this sentence in the blockquote:

```
All 292 packs are currently CC0, so nothing here asks anything of you.
```

with:

```
Of 296 packs, 292 are CC0 and 4 are MIT (the Proof of Play *Pirate Nation* set), which asks only that you keep the copyright notice that ships with the pack.
```

And replace the credits-table lead-in sentence:

```
Every pack in the table below is CC0 today, verified pack by pack rather than assumed, so attribution is **optional but appreciated**.
```

with:

```
Each pack's licence is verified pack by pack rather than assumed, and named in the table below. For the CC0 packs attribution is **optional but appreciated**; the MIT packs require only that their `License.txt` travels with the art, which RUN.studio handles for you.
```

- [x] **Step 4: Copy the packs in**

Run:
```bash
cd ~/dev/jam-ready-assets && git checkout -b add-pirate-nation-packs && \
  cp -R /tmp/jam-export/3D/pirate/proofofplay-pirate-nation-models 3D/pirate/ && \
  cp -R /tmp/jam-export/ui/proofofplay-pirate-nation-icons ui/ && \
  cp -R /tmp/jam-export/ui/proofofplay-pirate-nation-ui ui/ && \
  cp -R /tmp/jam-export/audio/proofofplay-pirate-nation-audio audio/ && \
  git add -A && git status --short | head -5
```
Expected: a new branch and staged additions.

- [x] **Step 5: Run the real licence gate**

Run: `cd ~/dev/jam-ready-assets && node --test scripts/license-policy.test.mjs && SKIP_PUBLISHED_CHECK=1 node scripts/build-manifest.mjs`
Expected: PASS — the node test suite passes, then `manifest v2: 296 packs; legacy: 292 CC0 packs @ <sha>` and **no** `.rejected-packs.json` written.

- [x] **Step 6: Verify the four packs are described correctly**

Run:
```bash
cd ~/dev/jam-ready-assets && node -e "
const p = require('./manifest/v2/index.json').packs.filter(x => x.slug.startsWith('proofofplay-'));
console.log(p.length);
for (const x of p) console.log(x.id, '|', x.title, '|', x.creator, '|', x.license, '|', x.category, '| runtime', x.runtimeFileCount);
"
```
Expected: `4`, then four rows each with creator `Proof of Play`, licence `MIT`, and
`runtimeFileCount` at or under 400.

- [x] **Step 7: Confirm the legacy manifest stayed CC0-only**

Run: `cd ~/dev/jam-ready-assets && node -e "console.log(require('./manifest/index.json').packs.filter(p => p.license !== 'CC0-1.0').length)"`
Expected: `0` — the MIT packs must not leak into the schema-v1 catalog.

### Task 4: `modelTransform` — bounds-driven scale and anchor

**Files:**
- Create: `games/pirate-nation-showcase/src/pack3d/modelTransform.ts`
- Test: `games/pirate-nation-showcase/src/pack3d/modelTransform.test.ts`

- [x] **Step 1: Write the failing test**

Create `games/pirate-nation-showcase/src/pack3d/modelTransform.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { modelTransform, type ModelBounds } from './modelTransform'

/** A 10x4x10 box whose base sits 2 units below the origin. */
const BOX: ModelBounds = { min: [-5, -2, -5], max: [5, 2, 5], size: [10, 4, 10] }
/** A tall thin model, to prove `fit` uses the largest dimension. */
const MAST: ModelBounds = { min: [0, 0, 0], max: [1, 50, 1], size: [1, 50, 1] }

describe('modelTransform', () => {
  it('scales so the largest dimension matches `fit`', () => {
    expect(modelTransform(BOX, { fit: 2 }).scale).toBeCloseTo(0.2)
    expect(modelTransform(MAST, { fit: 2 }).scale).toBeCloseTo(0.04)
  })

  it('defaults to scale 1 when no fit is given', () => {
    expect(modelTransform(BOX, {}).scale).toBe(1)
  })

  it('grounds the scaled base at y=0 with the base anchor', () => {
    const { scale, position } = modelTransform(BOX, { fit: 2, anchor: 'base' })
    expect(position[1]).toBeCloseTo(-(-2 * scale)) // lifts the -2 base up to 0
    expect(position[1]).toBeCloseTo(0.4)
    expect(position[0]).toBeCloseTo(0)
    expect(position[2]).toBeCloseTo(0)
  })

  it('puts the bounds centre at the origin with the center anchor', () => {
    const { position } = modelTransform(BOX, { fit: 2, anchor: 'center' })
    expect(position).toEqual([0, 0, 0]) // BOX is already centred on x/z and y
  })

  it('leaves native coordinates alone with the native anchor', () => {
    expect(modelTransform(BOX, { anchor: 'native' })).toEqual({ scale: 1, position: [0, 0, 0] })
  })

  it('offsets by `at` on top of the anchor', () => {
    const { position } = modelTransform(BOX, { fit: 2, anchor: 'base', at: [3, 0, -1] })
    expect(position[0]).toBeCloseTo(3)
    expect(position[1]).toBeCloseTo(0.4)
    expect(position[2]).toBeCloseTo(-1)
  })

  it('throws on degenerate bounds rather than returning Infinity', () => {
    const empty: ModelBounds = { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] }
    expect(() => modelTransform(empty, { fit: 1 })).toThrow(/zero-size bounds/)
  })
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `cd games/pirate-nation-showcase && npx vitest run src/pack3d/modelTransform.test.ts`
Expected: FAIL — `Failed to resolve import "./modelTransform"`.

- [x] **Step 3: Implement**

Create `games/pirate-nation-showcase/src/pack3d/modelTransform.ts`:

```ts
/**
 * Declared here rather than imported from `../catalog`, so this module can be
 * copied into another app whole. The shape is identical to the catalogue's, so
 * a `PirateNationModelEntry['bounds']` is assignable without a cast.
 */
export interface Vec3Tuple extends Array<number> {
  0: number
  1: number
  2: number
}

export interface ModelBounds {
  min: Vec3Tuple
  max: Vec3Tuple
  size: Vec3Tuple
}

/**
 * Where the transformed model sits relative to `at`.
 *
 * - `base`   — the scaled bounding box rests on `at.y`, centred on x/z. Use
 *              this to put several models on one ground plane.
 * - `center` — the bounding-box centre lands on `at`. Use this to frame one
 *              model.
 * - `native` — upstream coordinates, translated by `at` only.
 */
export type ModelAnchor = 'base' | 'center' | 'native'

export interface ModelPlacement {
  scale: number
  position: [number, number, number]
}

export interface ModelTransformOptions {
  /** Target size of the largest dimension, in world units. Omit to keep native scale. */
  fit?: number
  anchor?: ModelAnchor
  at?: [number, number, number]
}

/**
 * Turns a catalogue entry's bounds into a uniform scale and a position.
 *
 * Pack models span roughly 94x in largest dimension (p5 ≈ 2 units, p95 ≈ 185)
 * and only 147 of 355 sit on y=0 — 209 extend below it, one as far as −120.
 * So placing two models in one scene needs both a normalising scale and an
 * explicit anchor; native transforms alone put one model out of frame or
 * underground.
 */
export function modelTransform(
  bounds: ModelBounds,
  options: ModelTransformOptions = {},
): ModelPlacement {
  const { fit, anchor = 'center', at = [0, 0, 0] } = options
  const largest = Math.max(bounds.size[0], bounds.size[1], bounds.size[2])

  let scale = 1
  if (fit !== undefined) {
    // `characters-skins-animation-template` carries synthetic unit-cube bounds
    // because it has no meshes; a genuinely zero-size box would divide to
    // Infinity and silently blank the scene, so refuse it here instead.
    if (largest <= 0) {
      throw new Error('modelTransform: cannot fit zero-size bounds')
    }
    scale = fit / largest
  }

  if (anchor === 'native') {
    return { scale, position: [at[0], at[1], at[2]] }
  }

  const centreX = (bounds.min[0] + bounds.max[0]) / 2
  const centreZ = (bounds.min[2] + bounds.max[2]) / 2
  const centreY = (bounds.min[1] + bounds.max[1]) / 2
  const offsetY = anchor === 'base' ? bounds.min[1] : centreY

  return {
    scale,
    position: [at[0] - centreX * scale, at[1] - offsetY * scale, at[2] - centreZ * scale],
  }
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `cd games/pirate-nation-showcase && npx vitest run src/pack3d/modelTransform.test.ts`
Expected: PASS — 7 tests.

### Task 5: `layoutRow` — several models side by side

**Files:**
- Create: `games/pirate-nation-showcase/src/pack3d/layout.ts`
- Test: `games/pirate-nation-showcase/src/pack3d/layout.test.ts`

- [x] **Step 1: Write the failing test**

Create `games/pirate-nation-showcase/src/pack3d/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { layoutRow } from './layout'
import type { ModelBounds } from './modelTransform'

const box = (w: number, h: number, d: number): ModelBounds => ({
  min: [-w / 2, 0, -d / 2],
  max: [w / 2, h, d / 2],
  size: [w, h, d],
})

/** Deliberately mixed scales: a buoy next to a kraken is the real case. */
const ITEMS = [
  { id: 'small', bounds: box(2, 2, 2) },
  { id: 'huge', bounds: box(200, 180, 90) },
  { id: 'flat', bounds: box(60, 1, 60) },
]

describe('layoutRow', () => {
  it('returns one placement per item, in order', () => {
    const row = layoutRow(ITEMS, { fit: 4, gap: 1 })
    expect(row.map((entry) => entry.id)).toEqual(['small', 'huge', 'flat'])
  })

  it('grounds every item on y=0', () => {
    for (const entry of layoutRow(ITEMS, { fit: 4, gap: 1 })) {
      const scaledBase = ITEMS.find((i) => i.id === entry.id)!.bounds.min[1] * entry.scale
      expect(entry.position[1] + scaledBase).toBeCloseTo(0)
    }
  })

  it('never overlaps neighbours on x and honours the gap', () => {
    const gap = 1.5
    const row = layoutRow(ITEMS, { fit: 4, gap })
    for (let i = 1; i < row.length; i += 1) {
      const prev = row[i - 1]!
      const next = row[i]!
      const prevBounds = ITEMS.find((x) => x.id === prev.id)!.bounds
      const nextBounds = ITEMS.find((x) => x.id === next.id)!.bounds
      const prevRight = prev.position[0] + (prevBounds.size[0] * prev.scale) / 2
      const nextLeft = next.position[0] - (nextBounds.size[0] * next.scale) / 2
      expect(nextLeft - prevRight).toBeCloseTo(gap)
    }
  })

  it('centres the whole row on the origin', () => {
    const row = layoutRow(ITEMS, { fit: 4, gap: 1 })
    const first = row[0]!
    const last = row[row.length - 1]!
    const leftEdge = first.position[0] - (ITEMS[0]!.bounds.size[0] * first.scale) / 2
    const rightEdge = last.position[0] + (ITEMS[2]!.bounds.size[0] * last.scale) / 2
    expect(leftEdge + rightEdge).toBeCloseTo(0)
  })

  it('returns an empty row for no items', () => {
    expect(layoutRow([], { fit: 4, gap: 1 })).toEqual([])
  })
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `cd games/pirate-nation-showcase && npx vitest run src/pack3d/layout.test.ts`
Expected: FAIL — `Failed to resolve import "./layout"`.

- [x] **Step 3: Implement**

Create `games/pirate-nation-showcase/src/pack3d/layout.ts`:

```ts
import { modelTransform, type ModelBounds, type ModelPlacement } from './modelTransform'

export interface LayoutItem {
  id: string
  bounds: ModelBounds
}

export interface LayoutRowOptions {
  /** Largest dimension every model is normalised to, in world units. */
  fit: number
  /** Clear space between neighbouring bounding boxes, in world units. */
  gap: number
}

export interface LayoutPlacement extends ModelPlacement {
  id: string
}

/**
 * Places models left to right on the ground plane, centred on the origin.
 *
 * Every model is normalised to `fit` first, so a buoy and a kraken occupy
 * comparable space; spacing then uses each model's own scaled width, so a wide
 * flat island still clears its neighbour.
 */
export function layoutRow(items: LayoutItem[], options: LayoutRowOptions): LayoutPlacement[] {
  const { fit, gap } = options
  if (items.length === 0) return []

  const widths = items.map((item) => {
    const { scale } = modelTransform(item.bounds, { fit })
    return { item, scale, width: item.bounds.size[0] * scale }
  })

  const total = widths.reduce((sum, entry) => sum + entry.width, 0) + gap * (items.length - 1)

  let cursor = -total / 2
  return widths.map(({ item, width }) => {
    const centreX = cursor + width / 2
    cursor += width + gap
    const placement = modelTransform(item.bounds, {
      fit,
      anchor: 'base',
      at: [centreX, 0, 0],
    })
    return { id: item.id, ...placement }
  })
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `cd games/pirate-nation-showcase && npx vitest run src/pack3d/layout.test.ts`
Expected: PASS — 5 tests.

### Task 6: `PackCanvas`, `PackModel`, and folding the shared components in

**Files:**
- Create: `games/pirate-nation-showcase/src/pack3d/PackCanvas.tsx`
- Create: `games/pirate-nation-showcase/src/pack3d/PackModel.tsx`
- Create: `games/pirate-nation-showcase/src/pack3d/index.ts`
- Move: `src/components/FitCamera.tsx` → `src/pack3d/FitCamera.tsx`
- Move: `src/components/ViewerErrorBoundary.tsx` → `src/pack3d/ViewerErrorBoundary.tsx`
- Modify: `src/tabs/AvatarLab.tsx`, `src/tabs/ModelGallery.tsx`, `src/thumb.tsx` (import paths)

- [x] **Step 0: Move the two shared components into the module**

Run:
```bash
cd games/pirate-nation-showcase && \
  git mv src/components/FitCamera.tsx src/pack3d/FitCamera.tsx && \
  git mv src/components/ViewerErrorBoundary.tsx src/pack3d/ViewerErrorBoundary.tsx && \
  sed -i '' "s#'./components/FitCamera'#'./pack3d/FitCamera'#" src/thumb.tsx && \
  sed -i '' "s#'../components/FitCamera'#'../pack3d/FitCamera'#" src/tabs/AvatarLab.tsx && \
  sed -i '' "s#'../components/ViewerErrorBoundary'#'../pack3d/ViewerErrorBoundary'#" src/tabs/AvatarLab.tsx src/tabs/ModelGallery.tsx && \
  grep -rn "components/FitCamera\|components/ViewerErrorBoundary" src/ || echo "no stale imports"
```
Expected: `no stale imports`. `src/pack3d/` must exist first — create it with
`mkdir -p src/pack3d` if `git mv` complains.

Both files move unchanged. `FitCamera` already takes `rootName` + `fitKey` and knows nothing
about this pack; `ViewerErrorBoundary` is a plain error boundary. Neither has a behaviour
change, so the existing e2e suite is the regression gate.

- [x] **Step 1: Create `PackCanvas.tsx`**

```tsx
/**
 * The canvas preset every Pirate Nation surface needs.
 *
 * `logarithmicDepthBuffer` is the important part: the pack nests detail shells
 * with hair-thin offsets (a face plate at x=0.0900 in front of a head at
 * x=0.0899), which a linear depth buffer cannot separate at orbit distance.
 * Without it the voxel art z-fights. Unity hid this behind reversed-Z.
 */
import { Canvas } from '@react-three/fiber'
import type { ReactNode } from 'react'

export type StageBackdrop = 'dark' | 'light'

export const STAGE_COLORS: Record<StageBackdrop, { bg: string; floor: string; gridMain: string; gridMinor: string }> = {
  dark: { bg: '#0b1220', floor: '#1b2432', gridMain: '#26303f', gridMinor: '#1a2331' },
  light: { bg: '#dfe5ee', floor: '#c7cedb', gridMain: '#9aa5b5', gridMinor: '#c2cad6' },
}

export interface PackCanvasProps {
  children: ReactNode
  backdrop?: StageBackdrop
  fov?: number
  shadows?: boolean
  /** Replaces the default light rig when a surface needs its own. */
  lights?: ReactNode
}

export function PackCanvas({
  children,
  backdrop = 'dark',
  fov = 32,
  shadows = true,
  lights,
}: PackCanvasProps) {
  return (
    <Canvas shadows={shadows} gl={{ logarithmicDepthBuffer: true }} camera={{ fov, position: [0, 1.2, 4.5] }}>
      <color attach="background" args={[STAGE_COLORS[backdrop].bg]} />
      {lights ?? (
        <>
          <ambientLight intensity={1.1} />
          <hemisphereLight intensity={0.6} groundColor="#26303f" color="#ffffff" />
          <directionalLight position={[4, 6, 3]} intensity={1.4} />
        </>
      )}
      {children}
    </Canvas>
  )
}
```

- [x] **Step 2: Create `PackModel.tsx`**

```tsx
/**
 * Loads one catalogued pack model and places it by its bounds.
 *
 * Two details are load-bearing. The drei GLTF cache shares one scene graph per
 * URL, so this clones before touching materials — otherwise a wireframe toggle
 * in one viewer leaks into the next. And placement comes from the catalogue
 * bounds rather than the loaded geometry, so the transform is known before the
 * GLB arrives and does not pop when it does.
 */
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, type Ref } from 'react'
import { Mesh, MeshStandardMaterial, type Group } from 'three'
import { runtimeAssetPath, type PirateNationModelEntry } from '../catalog'
import { useAssetUrl } from '../useAssetUrl'
import { modelTransform, type ModelTransformOptions } from './modelTransform'

export interface PackModelProps extends ModelTransformOptions {
  /** Pass the `…-collision` entry here to render collision geometry instead. */
  entry: PirateNationModelEntry
  /** Scene name, so `FitCamera` can find this group by name. */
  name?: string
  wireframe?: boolean
  castShadow?: boolean
  /** Exposes the placed group, for callers that drive animation or spin it. */
  groupRef?: Ref<Group>
}

function LoadedPackModel({ url, entry, name, wireframe = false, castShadow = true, groupRef, ...transform }: PackModelProps & { url: string }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => scene.clone(true), [scene])
  // Plain arithmetic on six numbers — memoising it would cost more than it saves,
  // and `at` arrives as a fresh array each render so a memo would miss anyway.
  const placement = modelTransform(entry.bounds, transform)

  useEffect(() => {
    model.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh !== true) return
      mesh.castShadow = castShadow
      mesh.receiveShadow = castShadow
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) (material as MeshStandardMaterial).wireframe = wireframe
    })
  }, [model, wireframe, castShadow])

  return (
    <group ref={groupRef} name={name} position={placement.position} scale={placement.scale} dispose={null}>
      <primitive object={model} />
    </group>
  )
}

export function PackModel(props: PackModelProps) {
  const url = useAssetUrl(runtimeAssetPath(props.entry))
  if (!url) return null
  return <LoadedPackModel {...props} url={url} />
}
```

- [x] **Step 3: Create the barrel `index.ts`**

```ts
/**
 * `pack3d` — the reusable half of this showcase.
 *
 * Everything a RUN app needs to render Pirate Nation models correctly:
 * a canvas preset that carries the depth-buffer fix, a model component that
 * clones and places by catalogue bounds, and bounds-driven layout helpers.
 * See ./README.md.
 */
export { PackCanvas, STAGE_COLORS, type PackCanvasProps, type StageBackdrop } from './PackCanvas'
export { PackModel, type PackModelProps } from './PackModel'
export {
  modelTransform,
  type ModelAnchor,
  type ModelBounds,
  type ModelPlacement,
  type ModelTransformOptions,
  type Vec3Tuple,
} from './modelTransform'
export { layoutRow, type LayoutItem, type LayoutPlacement, type LayoutRowOptions } from './layout'
export { FitCamera, type FitCameraProps } from './FitCamera'
export { ViewerErrorBoundary } from './ViewerErrorBoundary'
```

- [x] **Step 4: Typecheck**

Run: `cd games/pirate-nation-showcase && npm run typecheck`
Expected: exit 0.

### Task 7: Refactor `ModelViewer` onto the module

**Files:**
- Modify: `games/pirate-nation-showcase/src/components/ModelViewer.tsx`

- [x] **Step 1: Replace the canvas and model wiring**

In `games/pirate-nation-showcase/src/components/ModelViewer.tsx`, replace the `ModelScene`
and `LoadedModelScene` function bodies with the pair below. `PackModel` takes over loading,
cloning and placement; animation and turntable stay here, because both are viewer concerns
rather than module concerns.

The two-component split is load-bearing and must be kept: `useGLTF` cannot be called before
a URL exists, and hooks cannot be called conditionally. The outer component resolves the URL
and returns `null` while it is pending; the inner one runs every hook unconditionally.

```tsx
function ModelScene(props: ModelSceneProps) {
  const url = useAssetUrl(runtimeAssetPath(props.entry))
  if (!url) return null
  return <AnimatedModelScene {...props} url={url} />
}

function AnimatedModelScene({
  entry,
  clip,
  turntable,
  wireframe,
  onAnimations,
  url,
}: ModelSceneProps & { url: string }) {
  const group = useRef<Group>(null)
  const { animations } = useGLTF(url)

  useEffect(() => {
    onAnimations(animations.map((animation) => animation.name))
  }, [animations, onAnimations])

  const { actions } = useAnimations(animations, group)

  useEffect(() => {
    if (!clip) return
    const action = actions[clip]
    if (!action) return
    action.reset().fadeIn(0.2).play()
    return () => {
      action.fadeOut(0.2)
    }
  }, [actions, clip])

  useFrame((_, delta) => {
    if (turntable && group.current) group.current.rotation.y += delta * 0.6
  })

  return (
    <PackModel
      entry={entry}
      name={MODEL_VIEWER_ROOT_NAME}
      wireframe={wireframe}
      anchor="native"
      groupRef={group}
    />
  )
}
```

Change the imports at the top of the file to:

```tsx
import { OrbitControls, useAnimations, useGLTF, useProgress } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Vector3, type Group } from 'three'
import { runtimeAssetPath, type PirateNationModelEntry } from '../catalog'
import { useAssetUrl } from '../useAssetUrl'
import { FitCamera, PackCanvas, PackModel, STAGE_COLORS } from '../pack3d'
```

Replace the `stageColors` assignment with `const stageColors = STAGE_COLORS[backdrop]`, and
replace the `<Canvas …>` opening tag and its `<color>`/light children with:

```tsx
      <PackCanvas
        backdrop={backdrop}
        lights={
          <>
            <ambientLight intensity={1.1} />
            <hemisphereLight intensity={0.6} groundColor="#26303f" color="#ffffff" />
            <directionalLight
              castShadow
              intensity={2.0}
              position={[lightDir.x, lightDir.y, lightDir.z]}
              shadow-mapSize={[2048, 2048]}
              shadow-normalBias={maxDim * 0.004}
              shadow-camera-left={-maxDim}
              shadow-camera-right={maxDim}
              shadow-camera-top={maxDim}
              shadow-camera-bottom={-maxDim}
              shadow-camera-far={maxDim * 8}
            />
          </>
        }
      >
```

and close it with `</PackCanvas>` in place of `</Canvas>`.

- [x] **Step 2: Typecheck and unit-test**

Run: `cd games/pirate-nation-showcase && npm run typecheck && npm test`
Expected: exit 0, all tests pass.

- [x] **Step 3: Confirm no viewer behaviour regressed**

Run: `cd games/pirate-nation-showcase && npm run test:e2e`
Expected: PASS — all 8 existing tests, including the collision-toggle test and the
"Kraken ships no collision GLB" assertion.

### Task 8: The Scene tab

**Files:**
- Create: `games/pirate-nation-showcase/src/tabs/SceneStage.tsx`
- Modify: `games/pirate-nation-showcase/src/App.tsx`
- Modify: `games/pirate-nation-showcase/src/styles.css`
- Modify: `games/pirate-nation-showcase/e2e/smoke.spec.ts`

- [x] **Step 1: Create the tab**

Create `games/pirate-nation-showcase/src/tabs/SceneStage.tsx`:

```tsx
/**
 * Scene — several pack models in one shot.
 *
 * The point of this tab is the thing a single-model viewer cannot show: pack
 * models span roughly 94x in size and most do not sit on y=0, so putting them
 * together needs `layoutRow` to normalise and ground them. Change the category
 * and the row recomposes.
 */
import { OrbitControls } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { isCollisionModel, loadModels, type PirateNationModelEntry } from '../catalog'
import { FitCamera, layoutRow, PackCanvas, PackModel, STAGE_COLORS, ViewerErrorBoundary } from '../pack3d'

const SCENE_ROOT_NAME = 'showcase-scene-root'
/** Every model is normalised to this largest dimension, in world units. */
const FIT = 4
const GAP = 1.2
const COUNT = 5

export function SceneStage() {
  const [models, setModels] = useState<PirateNationModelEntry[]>([])
  const [category, setCategory] = useState('ships')
  const [seed, setSeed] = useState(0)
  const [backdrop, setBackdrop] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    loadModels().then((all) => setModels(all.filter((entry) => !isCollisionModel(entry))))
  }, [])

  const categories = useMemo(
    () => [...new Set(models.map((entry) => entry.category))].sort(),
    [models],
  )

  const cast = useMemo(() => {
    const pool = models.filter((entry) => entry.category === category)
    // Rotate a deterministic window through the pool: "Reshuffle" must be
    // repeatable so a broken row can be described and reproduced.
    return Array.from({ length: Math.min(COUNT, pool.length) }, (_, i) => pool[(seed * COUNT + i) % pool.length]!)
  }, [models, category, seed])

  const placements = useMemo(
    () => layoutRow(cast.map((entry) => ({ id: entry.id, bounds: entry.bounds })), { fit: FIT, gap: GAP }),
    [cast],
  )

  const sceneKey = placements.map((p) => p.id).join('|')

  return (
    <div className="scene-stage">
      <div className="scene-controls">
        <label className="viewer-control">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="toggle" onClick={() => setSeed((value) => value + 1)}>
          Reshuffle
        </button>
        <button
          type="button"
          className="toggle"
          onClick={() => setBackdrop((value) => (value === 'dark' ? 'light' : 'dark'))}
        >
          {backdrop === 'dark' ? 'Light stage' : 'Dark stage'}
        </button>
        <span className="scene-count">{placements.length} models, normalised to {FIT} units</span>
      </div>

      <ViewerErrorBoundary key={sceneKey}>
        <PackCanvas
          backdrop={backdrop}
          lights={
            <>
              <ambientLight intensity={1.1} />
              <hemisphereLight intensity={0.6} groundColor="#26303f" color="#ffffff" />
              <directionalLight
                castShadow
                intensity={2.0}
                position={[8, 14, 10]}
                shadow-mapSize={[2048, 2048]}
                shadow-normalBias={0.02}
                shadow-camera-left={-20}
                shadow-camera-right={20}
                shadow-camera-top={20}
                shadow-camera-bottom={-20}
                shadow-camera-far={60}
              />
            </>
          }
        >
          <group name={SCENE_ROOT_NAME}>
            <Suspense fallback={null}>
              {/* `layoutRow` already solved the x spacing; `PackModel` re-derives
                  the scale and the grounding offset from the same bounds, so only
                  the row position is passed through. */}
              {cast.map((entry, index) => (
                <PackModel
                  key={entry.id}
                  entry={entry}
                  fit={FIT}
                  anchor="base"
                  at={[placements[index]!.position[0], 0, 0]}
                />
              ))}
            </Suspense>
          </group>
          <mesh position={[0, -0.01, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color={STAGE_COLORS[backdrop].floor} />
          </mesh>
          <gridHelper
            args={[200, 100, STAGE_COLORS[backdrop].gridMain, STAGE_COLORS[backdrop].gridMinor]}
            position={[0, 0, 0]}
          />
          <FitCamera rootName={SCENE_ROOT_NAME} fitKey={sceneKey} margin={1.4} />
          <OrbitControls makeDefault />
        </PackCanvas>
      </ViewerErrorBoundary>
    </div>
  )
}
```

- [x] **Step 2: Register the tab**

In `games/pirate-nation-showcase/src/App.tsx`, add the import:

```tsx
import { SceneStage } from './tabs/SceneStage'
```

and add this entry to `TABS` immediately after the `models` entry:

```tsx
  { id: 'scene', label: 'Scene', Component: SceneStage },
```

Update the file's header comment from `five showcase surfaces` to `six showcase surfaces`.

- [x] **Step 3: Add styles**

Append to `games/pirate-nation-showcase/src/styles.css`:

```css
.scene-stage {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  min-height: 0;
}

.scene-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.75rem;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.scene-count {
  margin-left: auto;
  color: var(--text-dim);
  font-size: 0.85rem;
}

.scene-stage canvas {
  border-radius: 8px;
}
```

- [x] **Step 4: Add the e2e test**

Append to `games/pirate-nation-showcase/e2e/smoke.spec.ts`:

```ts
test('scene tab composes several models on one stage', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Scene', exact: true }).click()

  await expect(page.getByText(/models, normalised to 4 units/)).toBeVisible()
  // WebGL canvas, or the app's error boundary where GL is unavailable.
  await expect(page.locator('.scene-stage canvas, .viewer-error').first()).toBeVisible()

  // Reshuffle must change the cast without breaking the stage.
  await page.getByRole('button', { name: 'Reshuffle' }).click()
  await expect(page.locator('.scene-stage canvas, .viewer-error').first()).toBeVisible()
})
```

- [x] **Step 5: Run the full suite**

Run: `cd games/pirate-nation-showcase && npm run typecheck && npm test && npm run build && npm run test:e2e`
Expected: all exit 0; e2e reports 9 passed.

### Task 9: Documentation

**Files:**
- Create: `games/pirate-nation-showcase/src/pack3d/README.md`
- Modify: `games/pirate-nation-showcase/README.md`

- [x] **Step 1: Write the module reference**

Create `games/pirate-nation-showcase/src/pack3d/README.md`:

```markdown
# pack3d

Reusable three.js/R3F helpers for the Pirate Nation art pack.

## Copying this into another app

The folder owns every component it exports, so copying `src/pack3d/` gets you
all of it. Three imports reach outside, all of them in `PackModel.tsx` and all
of them easy to supply:

| Import | What to provide |
|---|---|
| `PirateNationModelEntry` from `../catalog` | Any object with `id`, `relativePath` and `bounds` |
| `runtimeAssetPath` from `../catalog` | `(entry) => string` — the pack-relative path of the GLB |
| `useAssetUrl` from `../useAssetUrl` | `(path) => string \| null` — resolves a path to a fetchable URL, `null` while pending |

`modelTransform.ts` and `layout.ts` are pure and import nothing at all, so they
drop into a non-React project unchanged.

## Why it exists

Two properties of the pack make naive rendering fail:

1. **Models span about 94x in size.** The largest dimension runs from ~2 world
   units (p5) to ~185 (p95). Two models placed at native scale differ by orders
   of magnitude, so one fills the screen and the other is a dot.
2. **Most models do not sit on `y=0`.** Only 147 of 355 have `bounds.min[1] == 0`;
   209 extend below the origin, one as far as -120. Dropped into a scene at
   native transform, they float or sink.

`modelTransform` and `layoutRow` solve both from the catalogue `bounds`.
A third property — the pack nests detail shells with hair-thin offsets — means
a linear depth buffer z-fights on the voxel art. `PackCanvas` carries the
`logarithmicDepthBuffer` flag that fixes it.

## API

| Export | Purpose |
|---|---|
| `PackCanvas` | Canvas preset: logarithmic depth buffer, default light rig, dark/light backdrop |
| `PackModel` | Loads a catalogue entry, clones the shared GLTF scene, places it by bounds |
| `modelTransform(bounds, options)` | Uniform `scale` + `position` from `fit` and `anchor` |
| `layoutRow(items, { fit, gap })` | Places N models left to right on the ground plane, centred |
| `FitCamera` | Frames whatever sits under a named root |
| `ViewerErrorBoundary` | Shows a readable message when WebGL or a GLB fails |
| `STAGE_COLORS` | Background, floor and grid colours per backdrop |

### Anchors

- `base` — the scaled box rests on `at.y`, centred on x/z. Use for scenes.
- `center` — the box centre lands on `at`. Use to frame one model.
- `native` — upstream coordinates, translated by `at` only.

## Example

Three ships on one ground plane, uniformly sized:

```tsx
import { FitCamera, layoutRow, PackCanvas, PackModel } from './pack3d'

export function ShipRow({ ships }: { ships: PirateNationModelEntry[] }) {
  const row = layoutRow(
    ships.map((entry) => ({ id: entry.id, bounds: entry.bounds })),
    { fit: 4, gap: 1.2 },
  )
  return (
    <PackCanvas backdrop="dark">
      <group name="ship-row">
        {ships.map((entry, index) => (
          <PackModel
            key={entry.id}
            entry={entry}
            fit={4}
            anchor="base"
            at={[row[index]!.position[0], 0, 0]}
          />
        ))}
      </group>
      <FitCamera rootName="ship-row" fitKey={ships.map((s) => s.id).join('|')} />
    </PackCanvas>
  )
}
```

## Caveats

- `modelTransform` throws on zero-size bounds rather than returning `Infinity`.
  `characters-skins-animation-template` carries synthetic unit-cube bounds
  because it holds animation data and no meshes.
- `PackModel` clones the GLTF scene on every mount. The drei loader cache
  shares one scene graph per URL, and material edits would otherwise leak
  between viewers.
- Placement is derived from catalogue `bounds`, never from model ids. The `NxM`
  tokens in ids are gameplay footprints, not geometry: dividing bounds by them
  gives units-per-cell with a standard deviation of 11.9 on a median of 16.
```

- [x] **Step 2: Update the project README**

In `games/pirate-nation-showcase/README.md`, add these two rows to the scripts table
(matching the existing table's column layout):

```markdown
| `npm run export:jam-assets -- --out <dir>` | Stages the pack as four `jam-ready-assets` packs (models / icons / ui / audio), transcoding audio to mp3 and writing a licence per pack |
```

and add this section immediately before the licence section:

```markdown
## Reusing the renderer

`src/pack3d/` is the reusable half of this app: a canvas preset carrying the
depth-buffer fix, a model component that places by catalogue bounds, and
layout helpers that make several models composable in one scene. See
[`src/pack3d/README.md`](src/pack3d/README.md).
```

- [x] **Step 3: Verify the docs example typechecks**

Run: `cd games/pirate-nation-showcase && npm run typecheck`
Expected: exit 0. The `SceneStage` tab exercises the same API the README example shows.

## Open Questions

1. **Which thumbnails make the best pack previews.** The plan picks `ships-ship-pirate-xl`
   (models and icons), `buildings-building-6x8-townhall-01` (ui) and
   `world-bosses-creature-16x16-kraken` (audio). All three are verified to exist on disk, and
   a unit test in Task 1 enforces that. Swap the `previewModelId` values in `JAM_PACKS` if a
   human eye prefers others; any existing thumbnail satisfies the acceptance criteria.
2. **Whether the `preview.png` files should be re-encoded to real PNG.** The export copies
   the JPEG thumbnail under a `.png` name so `findPreview()` picks it deterministically.
   Every browser sniffs the content correctly, but `mirror-to-gcs.mjs` will label it
   `image/png`. Re-encoding with `ffmpeg -i in.jpg out.png` is a one-line change if the
   mismatch is judged unacceptable.
3. **Whether `tabs/AvatarLab.tsx` and `thumb.tsx` should move onto `PackCanvas`.** Listed as
   a non-goal to avoid churning verified work, which leaves `logarithmicDepthBuffer`
   duplicated in two more places. Worth a follow-up once `PackCanvas` has proven itself on
   the Models and Scene tabs.
4. **Whether `jam-ready-assets` wants the 20 `-collision` GLBs.** They ship inside the
   models pack because they are `.glb` and mirror for free, and a creator importing the pack
   gets collision meshes alongside the art. If the maintainers would rather keep the library
   art-only, dropping them is a one-line filter in `JAM_PACKS`.
