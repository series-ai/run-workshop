# Material controls verification

This document maps the material-controls work to its proof. The plan is
`.plans/pfx-material-controls.html` at the repository root. That plan is a
local, ignored file.

Status: T1 to T7. T1 proves launch, drive, capture, failure detection, and
cleanup. T3 and T4 add real atlas playback, the shared material features on
the four supported paths, and their `shader` and `cost` cases. T5 adds the
detail-viewer inspector, measured runtime status, and recipe replay through
the three entry points (`inspector` case). T6 gives the two pilots material
settings. T7 adds optional depth fade with a caller-owned depth source, the
viewer host example `viewer/src/MaterialDepthStage.tsx`, the `depth` case,
and depth cost in the `cost` case. T7 also plays explicit frame animation at
the atlas rate in actual particle age.

## Feature map

| Area | Covered | Proof case | Task |
| --- | --- | --- | --- |
| Baseline GamePfx render, fixed time and camera | Yes | `baseline` | T1 |
| Pre-change quality capture for the two pilots | Yes | `capture` | T1 |
| Real atlas frame playback and the proof atlas | Yes | `shader` | T3 |
| Shared UV, distortion, mask, dissolve, and rim | Yes | `shader`, `cost` | T4 |
| All 500 recipes: factory path tag against the resolver | Yes | `shader` | T4 |
| Catalog detail editing and recipe replay through GamePfx, PfxById, and the drop-in factory | Yes | `inspector` | T5 |
| Measured loading, ready, and error status with a real fault, Retry, and stale results | Yes | `inspector` | T5 |
| Optional host depth fading, both projections, every fallback | Yes | `depth`, `cost` | T7 |
| Frame rate in actual particle age for different durations | Yes | `shader` | T7 |

Excluded from new feature coverage: the feed, pack rendering, and other
consumers. The `baseline` case protects their no-feature output. No local
browser run can close the physical-device gate.

## Commands

Run all commands from `tools/3d-pfx-library`. Each run needs a new output
folder inside `.context/` or `.profiles/`. The runner does not overwrite
evidence.

```bash
node --import tsx viewer/scripts/verify-material-controls.ts --case baseline --output .context/material-controls/<run>/baseline
node --import tsx viewer/scripts/verify-material-controls.ts --case negative-control --output .context/material-controls/<run>/negative-control
node --import tsx viewer/scripts/verify-material-controls.ts --case capture \
  --batch material-controls-before --effect flame-burst,portal-idle-loop \
  --output .context/material-controls/<run>/capture-before
node --import tsx viewer/scripts/verify-material-controls.ts --case doctor --output .context/material-controls/<run>/doctor
node --import tsx viewer/scripts/verify-material-controls.ts --case shader --output .context/material-controls/<run>/shader
node --import tsx viewer/scripts/verify-material-controls.ts --case cost --output .context/material-controls/<run>/cost
node --import tsx viewer/scripts/verify-material-controls.ts --case inspector --output .context/material-controls/<run>/inspector
node --import tsx viewer/scripts/verify-material-controls.ts --case depth --output .context/material-controls/<run>/depth
node --import tsx viewer/scripts/verify-material-inspector.ts --output .context/material-controls/<run>/inspector-ui
```

`verify-material-inspector.ts` is the detailed control suite for the normal
viewer (accessible names, units, limits, disabled reasons, reset, copy, and
invalid input). It owns its own Vite process on port 48389. Its expected
values start from the catalog recipe's base material, because the T6 pilots
now have material settings.

The `capture` and `doctor` cases accept `--quality low|high`. The runner then
adds `materialQuality=<value>` to the viewer URL that it passes to
`quality:capture`, and the doctor checks the visible "Material quality"
selector, the stage `data-material-quality` value, and the absence of a query
error. Without `--quality`, the URL and the checks are unchanged. The
`material-controls-before` batch refuses `--quality`.

```bash
node --import tsx viewer/scripts/verify-material-controls.ts --case capture \
  --batch material-controls-final-high --effect flame-burst,portal-idle-loop --quality high \
  --output .context/material-controls/<run>/capture-final-high
```

Exit codes: `0` pass, `1` fail or blocked, `2` case not implemented yet,
`64` usage error. The `negative-control` case must exit `1`. Its two
`negative-control:*` checks are deliberately wrong. All its other checks must
pass.

Every case is implemented. A future planned case writes a run record with
status `not-implemented` and never reports a pass.

## Owned server

The runner starts Vite directly:
`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 48373 --strictPort`.

- If port 48373 has a listener, the run stops with `PortBusy`. The runner does
  not attach to that server and does not stop it.
- Do not use `npm run dev` for proof. Its `predev` script stops other
  listeners on the port.
- After start, `lsof` must show the child PID as the only listener.
- The runner stops only its own child. It then checks that the port is free.

## Run marker and doctor

The runner passes three values to its Vite child:
`VITE_PFX_RUN_TOKEN`, `VITE_PFX_SOURCE_REVISION`, and `VITE_PFX_SOURCE_DIFF`.
`viewer/src/main.tsx` writes them to `<html>` as `data-pfx-run-token`,
`data-pfx-source-revision`, and `data-pfx-source-diff`. A normal `npm run dev`
sets none of them.

The doctor is read-only. It navigates and reads. It checks:

1. The run token, the source revision, and the diff hash.
2. A WebGL context that is not lost.
3. A rendered-frame handshake. The proof route uses `data-pfx-proof-frame` on
   the canvas. The normal viewer uses the existing
   `data-pfx-review-capture-token` route.
4. No Vite error overlay.

To check a server that this run does not own, use attach mode. Attach mode
does not start or stop a server:

```bash
node --import tsx viewer/scripts/verify-material-controls.ts --case doctor \
  --attach-url http://127.0.0.1:48373/ --expect-run-token <token> \
  --output .context/material-controls/<run>/doctor-attach
```

## Proof fixture

Route: `/?materialProof=1`. Source: `viewer/src/MaterialProofApp.tsx`. The
normal app keeps its route.

Proof cases (visible "Proof case" selector):

| Case | What renders |
| --- | --- |
| `baseline-gamepfx` | Production `GamePfx` without a provider (T1). |
| `frame-oracle` | One particle through the production sprite material and geometry factories. |
| `material-gamepfx` | `GamePfx` with a scenario `recipeOverride` inside `PfxMaterialProvider`. |
| `dispatch-tags` | All 500 catalog effects through `GamePfx`, in a hidden group. |
| `cost-edits` | `GamePfx` with a working recipe that visible buttons edit. |
| `compile-error-control` | Negative control: a deliberately invalid shader. |
| `recipe-replay` | A visible "Recipe JSON" import, then the parsed recipe through the selected "Entry point": `GamePfx`, `PfxById` (catalog ID), or a `createGamePfxComponent` component. |
| `runtime-status` | `GamePfx` for `flame-burst` without catalog material, the real `MaterialInspector` for its upward-licks layer, and `PfxMaterialRuntimeProbe`. |
| `depth` | `MaterialDepthStage`: its own canvas with an opaque ground and contact box, a `smoke-puff` override with depth fade on its three alpha layers, `PfxMaterialProvider` with a caller depth source, and the host capture adapter. |

`baseline-gamepfx` has a "Recipe source" selector. `catalog` renders the
catalog recipe. `catalog without material settings` removes every
`tuning.material`. The T6 pilots have material settings, so the `shader`
case compares that frozen source with the T1 images. Every material scenario
and cost recipe also starts from the source without material settings.

The non-baseline cases add "Material scenario", "Material quality", and
"Reduced motion" controls. The frame oracle adds "Particle variant", "Sprite
size", "UV transform", "Particle duration", and "Frame blend". The preview time accepts −10 to 10
seconds. After the handshake the canvas also carries `data-pfx-proof-layers`:
per layer, the factory path tag, material and geometry UUIDs, shader defines,
the active sampler uniforms of the compiled program, the opacity uniform, and
the binding summary. It refreshes every 30 frames.

### Frame oracle

The fixture draws an original atlas in a 2D canvas: 4 × 2 cells of 128
texels, one colour and one black numeral per frame, and a 2-texel magenta
sentinel ring on each cell edge. It registers the atlas as `proof-numbered`
(4 frames per second, cell inset 0.06) through `createPfxAtlasRegistry` and
`PfxMaterialProvider`. The one-instance input has life `[variant, 1]`,
emission window 1, lifetime 1, and effective timing 1 (style `fantasy`,
tempo 1, feel version 1, so freshness is off). With the default duration 1,
age is `fract(t + variant)`. The "Particle duration" selector sets the
life multiplier `d` to 0.5 or 2: then age is `fract(t / d + variant) × d`.
The expected frame comes from the public `getPfxAtlasFrameIndex` with that
actual age. Each duration row also records the frame that `progress ×
lifetime` would select; the check requires a different frame there.

The runner classifies each pixel by the chromaticity of (pixel − background)
and requires: the expected frame on at least 90% of classified pixels, no
pixel of another frame, and no sentinel pixel. A blended frame may also show
its two partner colours where the other frame's numeral is black.

### Composition rules (T3/T4)

- A layer without `material` sets no shader define. The preprocessor removes
  every material block, so its output is unchanged. The `shader` case compares
  these images with the T1 images pixel for pixel.
- Only `material.frameAnimation` removes the legacy pulse. The runner reads
  the opacity uniform that `PfxSurface` writes each frame.
- Frame animation samples with an explicit level of detail from the
  continuous local UV and widens the cell inset to cover the trilinear
  footprint at that level. Each blended frame resolves its own cell.
- Mask and dissolve multiply the alpha that survived the existing erosion or
  break. The dissolve edge mixes in only where coverage survives.
- An explicit rim replaces the existing rim term and its hot-colour input.
  Power 2.2 and strength 1 with no colour reproduce the throat baseline
  exactly.
- Distortion needs `quality: 'high'`. Low quality and reduced motion remove
  its sampler and report a named reason. Depth fade reports
  `needs-high-quality` at low quality and `needs-depth-source` when the
  provider has no `depthSource` ref.
- UV scale applies about the cell centre. Scroll is periodic with a period of
  one UV unit in effect time (preview time × timing × style × tempo).

The fixture renders the production `GamePfx`. It uses seed 2718, DPR 1, and
these visible controls: Proof case, Effect, Preview time (seconds), and
Camera. The canvas gets `data-pfx-proof-frame` only after three frames
rendered the current selection. The token format is
`proof:<case>:<effect>:<timeMs>:<camera>`. The fixture also shows the legacy
pulse values and the frame-animation state. Every catalog layer without
`material.frameAnimation` or `flipbookAtlas` shows "No animation sheet".

## Inspector case

`--case inspector` runs at 390 × 844 and 1440 × 900 with clipboard permission
for the local origin only.

1. Normal detail viewer (`flame-burst`, 0.25 s, three-quarter camera,
   isolated framing, high quality by default). The default state reports
   `ready@<revision>`. UV rotation, dissolve, and distortion edits change
   pixels. Low quality disables the distortion input with a reason, keeps its
   value, and gives the same image as low quality before distortion. The
   existing Opacity field changes pixels. On `portal-idle-loop`, Opacity and
   the palette colour change pixels (flame layers set `colorOverride`, so the
   palette does not reach them). A paused page clock holds a real `loading`
   state for a screenshot; after resume it becomes `ready` for the same
   revision. The unsupported `glass-shards` layer shows the empty state.
   Emulated reduced motion reports `ready` and disables UV scroll.
2. Copy recipe JSON with one layer disabled. Node parses the copied text with
   `parsePfxAuthoredRecipeJson`. The JSON has the material values and the
   opacity edit, omits the disabled layer, and has no quality field.
3. Replay. The copied text goes into the fixture "Recipe JSON" field. At high
   and low quality, `GamePfx`, `PfxById`, and the drop-in component give
   pixel-identical paused images. High differs from low. The source recipe
   gives a different image. A corrupted copy shows a named field error.
4. Runtime status. The fixture registry adds `proof-corrupt`: a data URI with
   a PNG signature and bytes that are not PNG chunks. It passes the registry
   checks. The browser decoder rejects it, so the fault is real. Selecting it
   gives `error` for that revision. The preview shows the last ready recipe
   with zero differing pixels. The selection stays. Retry measures the same
   values again (`loading`, then `error`, at a new revision). Two edits in
   separate tasks (the fault atlas, then `proof-numbered`) prove that the
   pending fault measurement does not replace the newer edit: the log has no
   error for either revision, and the newer one becomes `ready`.
5. Every revision reports `loading` before it settles and settles once. No
   page or console error occurs. The decode fault reports through the status
   only.

## Runtime status

`viewer/src/materialRuntimeStatus.tsx` is viewer code. It is not library API.
`usePfxMaterialPreview(scope, candidate, resourceInputs)` gives one revision
for each change of the effect, the valid working recipe, the preset, the
quality, reduced motion, or Retry. `PfxMaterialRuntimeProbe` wraps the
preview inside the `Canvas`. For each revision it reports `loading`, compiles
the mounted subtree (`compileAsync` when the renderer has parallel shader
compilation, else `compile`), and then reads each frame, until the revision
settles: the program `LINK_STATUS` and each texture. A texture without an
image is pending. A host atlas with `userData.pfxLoad.state === 'error'` is
an error. The stale check runs inside the state updater against the
committed revision. On an error the preview shows the last ready recipe of
the same effect. The probe then stops, because a fallback is not the
measured revision.

Limits: a built-in sheet has no load-state record, so a built-in image that
never decodes stays `loading`. If the first revision of an effect fails,
there is no ready recipe, and the preview shows nothing.

## Capture provenance

The `capture` case:

1. Refuses an existing batch folder. For `material-controls-before`, it also
   requires that `src/` is unchanged against `HEAD`.
2. Starts the owned server and runs the doctor on the viewer route.
3. Runs `npm run quality:capture -- --effect <ids> --batch <id> --url http://127.0.0.1:48373/`.
4. Samples the port owner each second during capture. Any other listener fails
   the run.
5. Runs the doctor again. It then checks the manifest effects and the eleven
   files for each effect.
6. Writes `capture-provenance.json`. This file holds SHA-256 hashes of the
   manifest and of each image, the run token, the server PID, the capture URL,
   the material quality, and the source identity.

`quality:capture` alone attaches to any server that answers. Its output is
source proof only with this provenance record.

## Shader case

`--case shader` runs at 390 × 844 and 1440 × 900:

1. The no-feature images at the T1 times and cameras equal the T1 images.
2. The frame oracle (identity times 0.10, 0.25, 0.50, 0.75 → frames 0–3;
   variant 0.5 → 7, wrap to 0, 5; t = −0.40 → 2; reduced motion → 0;
   minified, rotated, tiled, and blended frames).
3. Material scenarios: neutral settings equal their reference images; each
   feature extreme changes pixels; a fully dissolved layer equals the recipe
   without that layer; low-quality distortion equals the catalog image.
4. Sampler uniforms per program and draw calls per configuration.
5. All 500 recipes: each supported resolver path has exactly that factory
   tag; an unsupported path has no tag, except a named conservative
   exclusion (`special-mesh-geometry`, `bubble-shell-cluster`).
6. The compile-error negative control must reach the console record.

## Depth case

`--case depth` (V6) drives the visible depth controls: Depth source, Depth
projection, Depth buffer, Contact box, Stage size, Depth fade distance (world
units), Smoke visible, Auto-rotate view, Late view update, Force capture
error, Depth stage mounted, Export depth image, and Check runtime status. The
canvas carries `data-pfx-depth-proof` (`MaterialProofDepthReport`): render
calls in the last frame, the drawn variant per layer (`soft`, `soft-gated`,
`hard`, or `none`), the validity that the consumers saw, reported fallback
reasons, host capture and restore counters, the caller texture dispose
counts, and variant material identities.

Frame order in the stage: camera rig and pass counter at −3, provider token
at −2, host capture at −1, consumers and diagnostics at 0, then the late view
update at 0 (after the consumers, so the draw-time guard must catch it).

At 390 × 844, for the perspective and the orthographic camera:

1. No provider is the baseline. A valid high-quality source draws `soft` on
   all three layers with `uPfxSceneDepth`, changes pixels, and renders two
   passes per frame. The baseline renders one.
2. Low quality and a provider without a ref equal the baseline pixel for
   pixel, with one pass and the same samplers.
3. A null ref, a stale token (capture paused), a different capture camera,
   declared reversed and packed depth, a declared XR capture, a forced
   capture error, and a real `logarithmicDepthBuffer` renderer each draw
   `hard`, name the expected reason, and equal their no-provider baseline
   pixel for pixel. After the forced error the renderer state equals the
   saved state.
4. Changed pixels lie inside the smoke. The difference from the baseline
   grows with the fade distance (0.1, 0.4, 1.2).
5. With the box in front of the smoke, every box pixel that the hard render
   shows without smoke is also smoke-free in the soft render.
6. The exported depth image is the same with and without smoke, and the
   depth scene holds only `ground` and `contact-box`.
7. A late view update after the consumers gives the hard result and reports
   `camera-matrix-mismatch`.

Perspective only at 390 × 844: continuous auto-rotate stays `soft` on every
frame; auto-rotate with a late view update never draws an open soft
material; a resize recreates the target and stays valid; a host that keeps
its old target after a resize falls back (`size-mismatch`) until it
recaptures; 20 valid/stale transitions keep one variant pair, one program
count, one texture count, and no disposed live variant; the runtime status
check reads `ready` with the depth texture bound; and unmount keeps the
caller texture (no dispose event during unmount, same UUID after remount, the
remounted image equals the first image). At 1440 × 900 the perspective
checks 1 to 7 run again.

A fractional canvas size can make the main viewport one pixel taller than the
drawing buffer. The host captures with the main viewport and stamps it; the
draw-time guard compares the viewports. A three r170 depth texture keeps its
first WebGL2 storage size, so the owner releases the GPU copy when the target
size changes (`ownerReleases`).

## Cost case

`--case cost` drives `flame-burst` and `portal-idle-loop` with the visible
edit buttons. It checks that frames, scalar edits, and equal recipe objects
keep every material and geometry identity; that a structural edit replaces
and disposes one material; that the existing opacity and colour controls
change pixels; and that 100 scalar/structural/reset cycles return the
renderer counters and the image to the warm start. For depth (T7, reported
separately) it reads the depth stage without a provider, with a provider
without a ref, at low quality, and with a valid source at high quality:
render calls per frame, main draw calls, samplers, programs, textures,
geometries, and animation-frame intervals. Only the valid high-quality state
adds a pass and one sampler per depth-fade layer. Animation-frame intervals
are main-thread diagnostics, not GPU timings. It then builds this source
and profiles it with `viewer/scripts/profile-browser.ts` against an owned
`vite preview` child on port 48374. The dev server is not used for timing: it
serves unbundled modules with HMR.

## Run record

Each run writes `run.json` with schema
`run-workshop.pfx-material-controls-run.v1`. It holds the status
(`pass`, `fail`, `blocked`, or `not-implemented`), the command, the working
folder, the source SHA, the uncommitted diff hash, the lockfile hash, tool
versions, inputs, server ownership and cleanup, each check with its expected
and observed value, and every artifact path. Checks of kind `observation`
record facts. They do not pass or fail.

Local Chromium uses SwiftShader. Its images and counters are diagnostic. They
are not physical-device evidence.

## Comparison videos

Use `viewer/scripts/capture-material-video.ts` with a frozen Vite build.
The script serves that build on its own local port. It uses the real viewer
and the public Timeline control. It takes two keyboard steps of 1/60 second
for each frame. FFmpeg encodes the images at 30 frames per second.

```bash
node --import tsx viewer/scripts/capture-material-video.ts \
  --effect flame-burst --label before --camera-distance 2.6 \
  --build-dir .context/material-controls/videos/before-build \
  --output .context/material-controls/videos/flame-before-close
```

Use a new output folder for each run. Keep the same camera distance, seed,
viewport, and sampled times for the after run. The flame pair uses distance
2.6. The portal pair uses distance 5.2. The manifest records the build hash,
browser version, sampled times, errors, and video path. A failed run remains
in its own folder. The script closes its browser and server after a run.

The before clips use the original renderer from `d46759fa`. The after clips
(`flame-after-pilot`, `portal-after-pilot`) and the side-by-side files in
`pilot-comparisons` use the pilot build in `videos/pilot-build`. These videos
do not grant visual or device approval.

## Stronger art comparison

The first flame and idle portal pilots had small visible changes. The next
comparison uses `portal-burst` and `shield-burst`. Each keeps three layers.
The portal uses the `portal-aperture` shader with a dark opening and inward
spiral bands. It shares the vortex path tag, UV controls, and distortion
controls. The shader key remains part of the material resource key. The
existing `vortex-swirl` shader remains unchanged.

Evidence is in `.context/material-controls/stronger-pilots/`. Videos use the
real viewer, the same camera distance, and exact public timeline samples.
The comparison repeats the common time interval. Full source clips remain
next to the frame manifests. These are local art checks. They do not replace
independent production review or physical device evidence.


## Subject comparisons

The next comparisons use `hologram-burst`, `dissolve`, `ghost-burst`, and
`poison-cloud`. Each effect has two layers with its own geometry and shaders.
These paths do not accept the shared material settings. The parser rejects
such settings. The normal opacity and palette controls still apply.

The hologram projects a cyan bust. Dissolve removes a solid ceramic urn with
an amber edge and surface fragments. Ghost forms a mask and torn wisps, then
fully disappears. Poison keeps a low gas bank on the ground through its loop.
The code is original. These effects use no imported source assets.

The hologram, dissolve, and ghost clips use camera distance 3.8. Poison uses
5.2. Each pair keeps the same camera, crop, seed, viewport, and timeline
samples. The complete source clips stay with their manifests. The paired
videos include each full cycle and repeat it four times.

Ghost and poison evidence is in
`.context/material-controls/ghost-poison/`. The final build is
`after-final-build`. Final captures are `ghost-after-final` and
`poison-after-final`. Paired videos are in `comparisons-final`.
`renderer-proof/result.json` records actual WebGL draw calls, reduced-motion
wisp bounds, loop repeatability, opacity, and palette checks. These local
SwiftShader checks do not grant physical-device or production approval.


## Warp comparison

`warp-burst` uses two dedicated layers: a folded grid and directional traces.
The shader bends the drawn geometry. It does not sample or distort the scene
image. Both layers use the normal palette and opacity controls. These paths
reject shared material settings.

Evidence is in `.context/material-controls/warp-burst/`. The `before` and
`after` captures use camera distance 3.8 and the same 24 timeline samples.
The normal cycle is 0.7781228433402345 seconds. The paired video is in
`comparison/warp-burst-before-after.mp4`.

Run the measured renderer proof from the package folder:

```bash
node .context/material-controls/warp-burst/renderer-proof/run.mjs
```

The proof uses the real materials and geometry. It checks WebGL draw calls,
empty rest frames, repeat frames, quality, opacity, palette, and reduced
motion. It compares reduced motion at matching lifecycle phases. The
GamePfx reduced-motion period is longer because the normal controls slow
the clock. The local SwiftShader result does not establish device speed
or production approval.


## Five-effect batch 1

The batch contains five separate effects. Each has two dedicated layers.
The normal palette and opacity controls affect both layers. The parser
rejects shared material settings on these shader paths.

| Effect | Body | Accent |
| --- | --- | --- |
| `frost-burst` | Growing crystal blades | Cold mist and flakes |
| `electric-burst` | Connected branched discharge | Corona and sparks |
| `plasma-burst` | Small ion packet | Unequal curved filaments |
| `water-burst` | Thin splash crown and surface | Falling droplets |
| `bubble-burst` | Thin film with an opening edge | Film scraps and droplets |

Evidence is in `.context/material-controls/batch-01/`. Each effect has
`before`, `after-candidate`, and `comparison-candidate` folders. Earlier
`after-final` and `comparison-final` folders keep the first correction.
Each pair uses camera
distance 3.8, the same seed and viewport, and exact public timeline samples
at 30 fps. All five keep their earlier periods. All 90 final frost, electric,
and bubble frames match their first reviewed captures exactly.

The water reduced-motion path scales the full droplet arc about its launch
point. It scales gravity with launch velocity. The old path scaled velocity
alone, which could increase movement between matching lifecycle phases.
The new water body uses normal alpha blending without depth writes. Light
from the background and drops can pass through the thin sheet. Triangle
order is set for the default three-quarter view. Alpha overlaps can differ
at other camera angles. Some reduced-motion drops fade before they reach
the surface; rest still hides the effect.

The initial renderer proof and its failures remain in `renderer-proof`.
The first correction has a separate focused proof:

```bash
node .context/material-controls/batch-01/renderer-proof/final/run.mjs
```

That proof passed 562 checks. It checks the first corrected water and plasma
paths and repeats integration checks through `GamePfx` for all five. It
reuses the other three results only after their source hashes match.
Negative controls must fail the same motion limits. The stage-label check
uses samples on both sides of 0.6 to avoid a floating point boundary;
image and travel limits stay unchanged. The shared shader case also passed
all 500 recipe dispatch checks. Local SwiftShader results do not grant
physical-device or production approval.

The new material prototypes are in `material-redesign`. Plasma uses nine
short open strands. Water uses less broad coverage and no depth writes.
The earlier water depth-write control does not apply to this version.
The current proof checks background visibility and zero-opacity
non-occlusion instead. Run it from the package folder:

```bash
node .context/material-controls/batch-01/renderer-proof/candidate/run.mjs
```

This proof passed 645 checks with no failures. It retains the earlier motion
limits. All five effects pass fresh `GamePfx` integration checks. Water uses
normal blending without depth writes, and the checker remains visible
through its sheet. The three unchanged effects retain their earlier
art reviews. The new water and plasma prototypes have no new peer art
approval. Both earlier art-review rounds remain in the evidence folder.

## Bubble revision

The user accepted the other four effects and requested a further bubble
revision. Only `bubbleBurstThinFilm.ts` changes. The revised film has less
broad colour. An uneven tear crosses it in about 0.11 seconds. Fine liquid
strands and drops replace the large film fragments.

Evidence is in `.context/material-controls/bubble-revision/`. The `before`
clip matches the last delivered bubble exactly. The `after` clip keeps all
34 timeline samples, camera distance 3.8, and the 1.1041329710144925-second
period. The paired video is in `comparison`. The earlier batch clips stay
unchanged. The output review says KEEP, with small bright drops as a minor
readability concern. It gives no device or performance approval.

Run the focused renderer proof from the package folder:

```bash
node .context/material-controls/bubble-revision/renderer-proof/run.mjs
```

It passed 461 checks. It measures each drop from its own GPU origin because
the release points cover the bubble surface. Reduced-motion travel is about
0.41 of normal travel. The negative control stays at 1.0. Dense rupture
frames match `GamePfx` exactly. The output is empty by phase 0.575. Two draw
calls continue until lifecycle rest; rest samples use no draw calls.
These checks use local SwiftShader at one fixed camera.

The source review passed with no findings. The primary review timed out.
The Sol fallback completed the review. The raw report retains the primary
model label; `source-review.log` records the actual route. The full test
suite still has the two known erosion failures, with 745 tests passing.

## Five-effect batch 2

This batch contains rune, healing, holy, acid, and slime bursts. Each uses
two dedicated paths. Rune uses spatial stroke cells. Healing uses open
strands and a cross. Holy uses separate rays and feather particles. Acid
uses a connected wet patch, low tongues, and fine spray. Slime uses a gel
surface with tapering necks and delayed drops.

Both layers use the normal palette and opacity controls. Their recipe
records identify the original module and its use. They need no imported
texture, scene sample, or depth pass. Alpha overlap order can differ with
the view. These paths reject shared material bindings.

Evidence is in `.context/material-controls/batch-02/`. The original clips
stay in each effect's `before` folder. The first after clips and review
remain in `after`. The corrected clips use `after-final`, with paired
videos in `comparison-final`. All pairs use camera distance 3.8 and the
same 165 public timeline samples at 30 fps.

Four periods remain bit-identical. Healing differs by one IEEE-754 step,
about 1.11e-16 seconds, after tempo compensates for the removed particle
cycle scale. Its sample times and frame count remain identical. The
comparison records this specific limit.

The first source review found signed GLSL squares written with `pow`.
The corrected shaders use multiplication. The first renderer record also
keeps 16 extra healing pre-rest empty-image failures. All 424 declared-rest
checks passed. Those pre-rest samples are observations in the final proof;
the declared-rest limit remains zero pixels and zero draw calls.

The final source review passes with no P0 or P1 finding. The final renderer
proof passes all 2,990 checks. All 165 `GamePfx` images match the real
factory output. All 476 declared-rest checks have zero pixels and zero
draw calls. This evidence uses local Chromium with SwiftShader. It gives
no physical-device timing result. Typecheck and build pass. The package
suite has 749 passes and the two known erosion failures.

The final output review keeps rune, healing, holy, and slime. Acid still
needs work: its early splash strips have blunt ends. The connected pool,
fine spray, and recession fixes pass. The comparison marks acid as needing
revision. This is the second and final normal review round. The batch is
not recorded as fully accepted.


### User-directed redo of batch two

The user rejected all five batch-two designs. The user identified wrong
shapes and materials as the main fault. The redo replaces the five module
and recipe pairs. It keeps their keys, clocks, periods, controls, and empty
rest. Earlier accepted effects remain unchanged.

Rune now uses carved fragments with cut faces and recessed channels.
Healing uses soft folded particles around a central space. Holy uses
screen-composed layers of gold light. Acid uses curved torn sheet particles
and small drops. Slime uses a closed gel surface with a neck, one break,
and recoil. The new internal geometry replaces the old line symbols, ray
fan, flat liquid pads, and fixed stalks.

Rune and slime write depth for dense matter. Their zero-opacity fragments
discard before depth can change the scene. Healing uses normal blending
for its body and additive blending for seeds. Holy uses custom screen
composition for its body and additive blending for accents. Acid uses
normal blending without depth writes. These paths still reject shared
material bindings. They add no texture or scene pass.

Evidence is in `.context/material-controls/batch-02-redo/`. The rejected
`batch-02/<effect>/after-final` clips are the new before clips. Initial redo
clips remain in `after`. Corrected clips use `after-final`. The final
comparison files use `comparison-final`. All five have the same camera,
period, and 165 timeline samples as their before clips. Master videos and
the final inline videos each show four complete cycles.

Source reviews R1 and R2 pass with no P0 or P1 finding. Current typecheck
and build pass. Tests have 749 passes and the two known erosion failures.
Output R2 keeps rune, healing, acid, and slime. It rejects the old holy
cylinder and metal strips. The current holy prototype replaces them with
soft spatial light. This new design has no independent art acceptance.

The first independent renderer check found a real slime normal defect at
the pinch. The repair changes only the normal calculation. A focused GPU
check reproduces the old defect and finds finite normals and framebuffer
values after the repair. Surface positions stay equal. All 35 ordinary
viewer frames also stay equal. Source R2 covers this repair.

Delivery files use `comparisons-delivery-inline.html`. Holy and slime use
75 new frames in `after-repair`. The other three reuse 90 verified frames.
All pairs retain the same camera, periods, and sample times. Four-cycle
videos contain 660 frames. The capture receipt is
`delivery-capture/result.json`. All 876 source hashes match the frozen
capture source. Old builds and failed checks remain available.

The old motion test counted live points that produced no triangle pixels.
Its per-phase coverage failure is preserved. Its square camera also differs
from the official capture camera. The prepared raster test has not run.
Current motion coverage is not certified. The bounded integrated check
passes all 874 checks. All 150 normal and reduced-motion comparisons at
75 official times match the real `GamePfx` output exactly. All 48 float
framebuffer checks and 192 vertex-output checks are finite. The receipt is
`renderer-proof/repaired-bounded/result.json`. The three unchanged effects
retain 90 matching source-bound samples. No physical device or canonical
approval is recorded.

### User selection after the replacement comparison

The user keeps the replacement acid and slime effects. The user selects the
prior versions of rune, healing, and holy from the left side of the
comparison. The three modules and their recipes are restored exactly from
`batch-02-redo/before-source`. Their six source hashes match the earlier
`batch-02/source-review-r2.json` review. Acid and slime stay unchanged.

Only the three selected effects' material policy expectations change in
the tests. The restored paths use normal blending without depth writes.
All existing behavior and geometry assertions stay. Typecheck and build
pass. All 97 fresh frames match the selected prior captures in bytes and
pixels: rune 27, healing 30, and holy 40. Tests have 749 passes and the two
known erosion failures. Acid and slime, prior evidence, and `dist` stay
unchanged. Selection evidence is in
`.context/material-controls/batch-02-selection/verification/result.json`.
Earlier replacement comparisons and reviews remain historical evidence.

### Batch three prototypes

This batch contains teleport, spawn, despawn, dash, and reflect bursts.
Each has two authored shader paths. Teleport uses separated spatial
strokes. Spawn uses rising light around an open space. Despawn breaks
sections into a low exit path. Dash uses soft directional ribbons.
Reflect uses an angled contact fan and returned streaks.

The factory interface and burst clock stay the same. All five periods
match their before clips exactly. The integration adds ten typed shader
keys. Existing factory and runtime branches stay unchanged. The test
change replaces two obsolete phase names. It removes no assertion.

Typecheck and build pass. Tests have 749 passes and the two known erosion
failures. The shared shader check passes 54 assertions with three
observations. Its no-feature images and all 500 dispatch rows pass.
The scope check finds only 15 expected source files changed. Earlier
accepted effects stay unchanged.

Before and after captures each have 130 frames. They use the same camera,
periods, and sample times. Five master videos each contain four cycles.
The inline comparison has 264,881 characters. Layout checks pass at 390
and 1440 pixels with no horizontal overflow or console errors. The first output review asked for changes to all five. Each author made
one bounded correction. The final captures retain the same 130 times,
periods, and camera. Their inline HTML has 251,073 characters and passes
both layout checks. Final source review R2 passes with no findings.

R1 found that the material helper raised authored opacity zero to 0.05.
The fix uses a zero minimum for these ten new shader keys. Earlier keys
retain the previous policy. The real `GamePfx` check reproduces the old
fault. The final checks cover zero opacity, small values, and a control
that restores the old fault.

Final renderer verification passes 1,930 checks with zero failures.
It includes 260 official pairs, 60 camera-angle pairs, and 30 boundary
pairs. All 380 recorded pairs match exact RGBA and image hashes. Fresh
checks cover 98 factory float frames, 196 vertex cases, and 20 integrated
float frames. Coverage and semantic rotation remain unproved. Raw earlier
failures stay available. Final output review R2 keeps teleport, despawn,
dash, and reflect. Spawn still has hard crossings and brackets at its peak.
The delivered comparison marks it as a prototype that needs more work.
All 130 final frames were inspected with their before frames. All five
comparison videos played. No further normal art round ran.

All 881 frozen source hashes match. Earlier modules and recipes stay
unchanged. The delivery HTML passes both layout checks and retains the
reviewed video bytes. The local checks grant no physical device or
canonical approval. Evidence is in `.context/material-controls/batch-03/`.


### Batch 3 user revision

The user requested another pass for teleport, despawn, dash and reflect. The user preferred the newer spawn and requested a refinement. This request supersedes the earlier local visual judgments. The new packet is `.context/material-controls/batch-03-user-revision/`.

The before clips use the original batch 3 version for four effects. Spawn uses the last delivered revision. The packet records all 130 sample times and the unchanged periods. Camera distance is 3.8.

All five module and recipe pairs are released. Exactly ten source files changed against the user revision baseline. The type check and isolated build pass. The test suite has 749 passes and the same two known erosion failures. The failure messages match the baseline. `dist` is unchanged. Source review, viewer captures and bounded renderer checks are in progress. These checks do not give device or canonical approval.

The bounded correction changes only the teleport and reflect modules. Teleport has a broader central arrival and lower reduced-motion intensity. Reflect has a concentrated contact peak and softer fan gaps. Spawn, despawn and dash stay unchanged from the user-revision R1 capture. The final type check and isolated build pass. The suite remains at 749 passes and two exact baseline failures. Final evidence is in progress.

Final source R2 passes with no findings. The bounded renderer run passes all 2,040 checks. All 380 factory and `GamePfx` pairs match. The sampled teleport reduced-motion peak ratio is 0.77065. Final capture has 48 new frames and 82 byte-exact reused frames. Root also verifies six unchanged master and inline videos. Final gallery previews pass at 390 px and 1440 px without overflow or console errors. Evidence: `final-capture/result.json`, `renderer-proof/final/handoff.json`, and `source-review-r2.json` in the user-revision packet. Visual R2 keeps all five effects. Motion coverage, semantic rotation and physical-device results remain unproved.

The user-revision delivery gallery is `comparisons-delivery-inline.html` in the packet. It uses one column below 900 px so the videos stay larger at normal chat width. All five embedded video files match the final assembly. Previews pass at 390 px, 728 px and 1440 px. The gallery is rendered in the thread. `visual-review-r2.json` records the 48 new frame checks, 82 reused frame checks, five video playbacks, minor findings and motion limits. All source owners and resources are released. No third normal review ran. User preference remains separate from the local comparative review.
