# 3D PFX Library

A React Three Fiber (R3F) particle-effects library with a browser to preview,
search and performance-profile the effects.

- **`src/`** — the library (the reusable artifact). A catalog of 500 ranked
  particle effects, each with a typed preset, plus `GamePfx`, a deterministic
  R3F runtime/preview component, mobile/perf metadata, catalog search, and
  export helpers. Public entry: `src/index.ts` (a barrel).
- **`viewer/`** — a Vite + React app (the harness) to browse, preview and tune
  effects, plus a headless profiling harness (`viewer/scripts/profile-browser.ts`).

Imported from the `game-bot` project. The effects are **authored-preview
grade** — they are visually authored presets, not production-signed-off
(no real-device capture sign-off). Use the profiling tools below to validate
and tune before shipping any effect in a game.

## Pack effects (inspect packs)

Themed effects that are not part of the locked 500-effect catalog live in
`src/inspect-packs/`: Burger Shop, Duelyst, Pirate Nation, and the RUN voxel
packs (`rvxRecipes.ts`, ids `rvx-<pack>-<effect>`). They use the emitter
system in `src/burger-shop/`; `geometry: 'cube'` draws voxel debris. The RUN
voxel effects follow [docs/rvx-pfx-style.md](docs/rvx-pfx-style.md): toon
shapes from `scripts/make-rvx-textures.py`, pack theme colours, nominal
size 1, and the archetypes in `src/inspect-packs/rvx/kit.ts`.
`src/PfxById.tsx` plays any catalog or inspect-pack effect by id.

## Develop

```bash
npm install
npm run dev        # Vite dev server (viewer)
npm run build      # production build → dist/
npm run preview    # serve the built bundle
npm run test       # vitest (library + viewer)
npm run typecheck  # tsc --noEmit (see "Types" below)
```

## Profile effects

Headless (Playwright) performance capture, written to a gitignored `.profiles/`:

```bash
npm run profile            # representative suite
npm run profile:authored   # all authored presets
npm run profile:catalog-stress
npm run profile:all
```

## Review visual quality

The quality harness turns deterministic captures, three independent peer
reviews, and physical-device evidence into the canonical matrix and improvement
ledger:

```bash
npm run quality:status
npm run quality:capture -- --effect fireball --batch review-001
npm run quality:assemble -- --iteration 1 --reviews review-a.json,review-b.json,review-c.json
```

Start with [the quality-review workflow](docs/quality-review-workflow.md).
[The production standard](docs/production-pfx-standard.md) defines acceptance;
[the craft guide](docs/pfx-craft-guide.md) covers authoring and remediation.
Raw screenshots, review packets, and device profiles stay in ignored
`.context/`; the compact resumable handoff is tracked under `quality/`.
Scripts package and validate evidence but never award visual scores.

## Use the library in a game

Import from the library entry (`src/index.ts`):

```tsx
import { GamePfx, PFX_PRESETS, createGamePfxComponent } from './path/to/3d-pfx-library/src'
```

`GamePfx` targets `@react-three/fiber@8` / `three@~0.170` / React 18. Copy the
`src/` (and `assets/`) directory into your project, or reference it directly.

## Layer material controls

Material settings belong to `surface.tuning.material` in an authored recipe.
Use **Copy recipe JSON** in the viewer to save layer edits. Preset JSON keeps
its existing v1 format. It does not include layer edits. Copy recipe JSON
omits disabled layers.

Parse recipe JSON before you use it:

```tsx
import { Canvas } from '@react-three/fiber'
import {
  GamePfx,
  PfxMaterialProvider,
  createPfxPreset,
  parsePfxAuthoredRecipeJson,
} from './path/to/3d-pfx-library/src'

const recipe = parsePfxAuthoredRecipeJson(recipeJsonText)
const preset = createPfxPreset(recipe.effectId)

function Preview() {
  return (
    <Canvas>
      <PfxMaterialProvider quality="high">
        <GamePfx preset={preset} recipeOverride={recipe} previewTimeSeconds={0.25} />
      </PfxMaterialProvider>
    </Canvas>
  )
}
```

The parser rejects unknown fields, invalid values, unknown atlas IDs, and
features that the layer cannot render. `PfxRecipeParseError` gives the field
path and error code. Use `parsePfxAuthoredRecipe` for an external object.
`parsePfxMaterialTuning` checks a material object. The recipe parser also
checks its layer capabilities.

The provider must be inside `Canvas`. Its default quality is `low`.
`high` enables texture distortion and optional depth fade. Quality is preview
or host state. It is not part of recipe JSON. The detail viewer starts at
high quality. The feed uses low quality. Reduced motion stops decorative
scrolling and distortion. It freezes explicit frame animation at frame zero.

| Render path | Material features |
| --- | --- |
| Generic sprite | Local UV transform and scroll, distortion, mask, dissolve, frame animation |
| Generic sprite with explicit `blend: 'alpha'` | The sprite features plus optional depth fade |
| Explicit Fresnel or hex shell | Mask, dissolve, rim |
| Vortex swirl | Local UV transform and distortion; constant values |
| Portal throat | Rim; constant values |

Special mesh geometries and custom shader aliases are excluded. The inspector
uses `resolvePfxMaterialPath` and `getPfxMaterialCapability` to show supported
controls. An explicit rim replaces the existing rim term. An omitted setting
keeps the existing output.

UV scroll uses local UV units per second. Rotation uses radians. A life value
is a number or `{ kind: 'life', values: [start, middle, end] }`. Its three stops
are at normalized age 0, 0.5, and 1. Continuous mesh paths accept constants.
`PFX_MATERIAL_LIMITS` defines the input bounds.

The old `smoke-8`, `flame-8`, `magic-12`, and `impact-6` names select a
**Legacy pulse**. They change opacity and size. They do not select image
frames. Only explicit `material.frameAnimation` replaces that pulse. Other
material settings keep it.

Real frame animation uses a registered atlas. The default registry contains
`unity-small-flame-64` and `unity-fireball-64`. Use
`PFX_BUILTIN_ATLAS_IDS` for typed source recipes. To use a custom atlas, create
one registry with `createPfxAtlasRegistry`. Pass that registry to the parser
and provider. Recipe JSON stores only its atlas ID. Replay needs the same
registry. The special plasma-impact sheet uses a separate factory.
The atlas `frameRate` is frames per second of actual particle age, in effect
seconds. Particles with different durations play at the same rate. The legacy
`flipbookAtlas` path keeps its old timing.

### Optional depth fade with host scene depth

Depth fade (`material.softParticles.distance`, in world units) fades an
explicit alpha sprite where it meets opaque scene geometry. The library adds
no depth pass. The host owns the scene depth and gives it to the provider:

1. Create one `THREE.DepthTexture`. You own it. The library never disposes
   it.
2. Create one descriptor with `createPfxMaterialDepthSource(texture)`. Keep it
   in a stable ref and pass the ref as `depthSource` to
   `PfxMaterialProvider`. Set `ref.current` to `null` when you have no depth.
3. Finish camera and opaque-object updates at a priority below `-2`.
4. Capture once per canvas in `useFrame` at
   `PFX_MATERIAL_DEPTH_CAPTURE_PRIORITY` (`-1`), and only at `high` quality.
   Read the token with `usePfxMaterialFrame()`. Call
   `invalidatePfxMaterialDepthSource(descriptor)` first. Render only opaque
   objects into a render target that has your texture as its `depthTexture`
   and the main render's viewport. After a successful render, call
   `stampPfxMaterialDepthSource(descriptor, { camera, width, height, token,
   xr: false, viewport })`. Save and restore the render target, viewport,
   scissor, clear state, and renderer flags in `finally`.
5. Do not use a positive priority. R3F renders the frame as usual.

At priority 0, each depth-fade layer validates the descriptor with
`validatePfxMaterialDepthSource`. The source is valid only for standard
WebGL depth with a perspective or orthographic camera, this provider frame,
the active camera, equal camera matrices, and the current drawing-buffer
size. Logarithmic, reversed, or packed depth, XR, a different camera, a late
camera change, a resize without recapture, and a missing or stale capture
select the existing hard depth test. Each layer has two prebuilt materials.
`PfxSurface` compiles both programs when it commits a new pair, before any
frame draws it, and the pair starts on the hard material. While the pair
exists, only the priority-0 selector writes the mesh `material`. Each frame
selects one by reference; a frame does not compile, allocate, or dispose a
material. A draw-time check catches a camera change after the
priority-0 consumers. `onDepthFallback` reports each fallback reason once per
provider; the default is one `console.warn`. A player never sees an error.

Without `depthSource`, at `low` quality, or without a provider, depth fade
adds no texture sample and no pass. When you recreate the render target for
a new size, release the GPU copy of your texture with `texture.dispose()`
before you attach it again: three r170 allocates WebGL2 depth storage once.
Detach the texture (`target.depthTexture = null`) before
`target.dispose()`, because a render target disposes its attached depth
texture. `viewer/src/MaterialDepthStage.tsx` is a complete host example.

`GamePfx`, components from `createGamePfxComponent`, and catalog IDs through
`PfxById` accept `recipeOverride` and `previewTimeSeconds`. Import `PfxById`
from `src/PfxById`. Inspect-pack IDs reject these two options. The showcase
has a separate declaration file that does not expose the new optional props.
`PfxById` always uses the catalog preset and its seed. It has no
`reducedMotion` prop. It sets `screenAnchor={false}`. The same recipe, time,
camera, and quality give the same image through all three entry points.

A host that mounts the sprite or mesh material factories directly resolves
the layer binding with `resolvePfxMaterialBinding({ effectId, surface,
atlasRegistry, quality, reducedMotion })`. The function returns `null` for a
layer without `material`. It throws `PfxRecipeParseError` for invalid input.
Pass the binding to `createPfxSpriteEmissionMaterial`. Call
`updatePfxMaterialClock(material, binding, effectSeconds)` once per frame to
move the scroll offsets. It allocates nothing.

A host atlas texture records its load state in
`texture.userData[PFX_TEXTURE_LOAD_USERDATA_KEY]` as `PfxTextureLoadState`
(`loading`, `ready`, or `error` with a message). An image that does not
decode leaves the atlas cache, so the next material for that atlas loads it
again. The library has no status API of its own. The detail viewer measures
its preview in `viewer/src/materialRuntimeStatus.tsx`: it compiles the
mounted preview, then reads the program link status and the texture load
state. Each edit gets a revision. A result for an older revision is
ignored. On an error the preview shows the last ready recipe, the edits stay,
and Retry measures the same values again.

See [material verification](docs/material-controls-verification.md) for the
real browser fixture, evidence commands, and video capture.

## Library layout

Upstream, the whole library was a single 53,501-line `index.tsx`. It has been
mechanically decomposed into **~277 modules** by a dependency-graph tool: every
top-level declaration is assigned to an ordered layer (promoted so each
declaration's dependencies sit in the same or an earlier layer, which makes the
module graph acyclic by construction — no init-time TDZ), then oversized layers
are bin-split in topological order.

| Path | What |
| --- | --- |
| `src/index.ts` | barrel — the public API, unchanged |
| `src/effects/*.ts` | **~254 per-effect code modules** (geometry / material / lifecycle / appearance), e.g. `effects/mudBurst.ts` |
| `src/recipes/*.ts` | **500 per-effect authored recipes** — one file per catalog effect id, e.g. `recipes/fireball.ts`; assembled into `AUTHORED_EFFECT_RECIPES` by `constants/02.ts` in original key order |
| `src/constants/*` | pure data (taxonomy seeds, budgets, sprites) |
| `src/build.tsx` | taxonomy generation, preset/component builders |
| `src/tooling/*` | audit / evidence / review reporting |
| `src/types/*` | shared type declarations |
| `src/PfxSurface.tsx` | the surface render dispatcher (see below) |

~740 of the 777 modules are under 300 lines. The one remaining large file is
`PfxSurface.tsx` (~4.1k lines): a **single React component** — the render
dispatcher for every surface kind — whose logic lives inside `useMemo`/`useFrame`
hook closures. Decomposing it is a behavioral refactor of the hot render path
(not a file split) and is intentionally left for a dedicated change.

Bundle: the viewer imports the whole catalog, so `dist` is unchanged. The eager
catalog consts (`PFX_TAXONOMY = buildTaxonomy()`) still run at load, so importing
one effect module runs the catalog build — genuine per-effect tree-shaking would
need the catalog made lazy (a public-API change), which is intentionally out of
scope here.

To use a single effect without pulling the whole catalog, import its module
directly:

```ts
import { createPfxMudBurstClodGeometry } from './3d-pfx-library/src/effects/mudBurst'
```

## Regenerating assets

Every effect texture is embedded as a base64 data URI directly in `src/`, so
the library compiles and runs with **no external asset files** — `assets/` is
not part of the bundle (building with `assets/` removed produces an identical
module graph). The files under `assets/` are inputs for *regenerating* those
embedded atlases, via `viewer/scripts/`:

| Script | Status |
| --- | --- |
| `build-muzzle-flash-atlas.mjs` | Runnable — all inputs present in `assets/`. |
| `build-plasma-impact-flipbook.mjs` | Runnable — all inputs present in `assets/`. |
| `build-particle-sprite-atlas.mjs` | Needs the Kenney Particle Pack fetched separately; pass its directory as the first argument. |
| `build-unity-fireball-flipbook.mjs` | Not runnable — needs `assets/runtime/unity-fireball-64.png` + `assets/unity-fireball-64.provenance.json`, which are not distributed with this tool (they were absent upstream too). |
| `build-unity-small-flame-flipbook.mjs` | Not runnable — same, for `unity-small-flame-64.*`. |

The two non-runnable scripts are kept as a record of how the committed Unity
Labs Paris flipbooks were produced. Their output (`src/fireballFlipbook.ts`,
`src/flameFlipbook.ts`) is committed, so both effects work at runtime; only
regeneration is unavailable.

## Types

The library is authored as raw TS transpiled by esbuild/Vite (its origin
contract — no build step). `npm run typecheck` reports a handful of known
authored-preview type looseness issues in the generated catalog; these do not
affect the build (`vite build` transpiles regardless) or the runtime.

## Third-party assets

Bundled third-party sprite/flipbook assets are CC0 1.0, and the Pirate Nation
VFX stamps are MIT; the particle renderer is modeled on wawa-vfx (MIT). The RUN
voxel textures in `assets/run-voxel/` are Series-owned, under the RUN License.
See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The `portal-aperture` mesh shader uses a dark center and inward spiral bands.
It supports the same constant UV and high-quality distortion settings as
`vortex-swirl`. It uses normal alpha blending so the opening can remain dark
over the scene. It adds no render pass. The original `vortex-swirl` output is
unchanged. The `portal-burst` recipe uses the new shader.

A recipe override must have the selected preset's effect ID. A mismatch throws
`PfxRecipeOverrideMismatchError`. A material host with invalid uniform metadata
throws `PfxMaterialHostContractError`. Both errors are public exports.
