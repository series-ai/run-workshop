---
title: Pirate Nation jam pack and asset-library showcase
status: done
owner: run-workshop
created: 2026-08-28
updated: 2026-08-28
tags: [pirate-nation, jam-ready-assets, asset-library, threejs]
---

# Pirate Nation jam pack and asset-library showcase

> **For agentic workers:** Use the create-spec plan with the execute-spec
> skill. Steps use checkbox syntax for tracking.

**Goal:** Add the generated model thumbnails to the existing Pirate Nation 3D
pack in jam-ready-assets, then make the RUN showcase load all binary assets
through SDK 5.28.0-beta.2 while preserving its viewer and Three.js scene
features.

**Architecture:** Keep one Pirate Nation 3D pack. Store each thumbnail in the
same model category as its GLB, under Previews/<model-id>.jpg. Keep the app's
catalog JSON and legal documents local. Resolve models, thumbnails, sprites,
and audio through four pinned asset-library packs.

**Tech Stack:** React, React Three Fiber, drei, Three.js, RUN game SDK, Vite,
Vitest, Playwright, Git LFS, and the jam-ready-assets manifest pipeline.

## Overview

The jam repository already contains four Proof of Play packs. The 355 model
thumbnails are generated previews of the existing 3D assets. They belong in
the existing 3D model pack, not in a new UI pack. This follows the repository's
existing Previews pattern and keeps each preview beside the data that it
describes.

The showcase currently carries the full 345 MB local payload under
public/cdn-assets/pirate-nation. The RUN asset-library SDK can resolve the
published pack versions without placing those binaries in the game project.
The app will keep only local metadata, legal files, code, and generated test
artifacts outside public/.

## Background

### jam-ready-assets pattern

The live repository is /Users/pany/dev/jam-ready-assets at commit
00dbd827e. It contains these four Proof of Play packs:

| Key | Pack id | Current version | Runtime files | Total files |
|---|---|---:|---:|---:|
| models | 3D/pirate/proofofplay-pirate-nation-models | 54524c5714a8 | 375 | 378 |
| icons | ui/proofofplay-pirate-nation-icons | ec3e46dfcd27 | 152 | 154 |
| ui | ui/proofofplay-pirate-nation-ui | 97835c36f9f1 | 363 | 365 |
| audio | audio/proofofplay-pirate-nation-audio | 064b51d95ed5 | 30 | 33 |

The repository's 3D rule in
/Users/pany/dev/jam-ready-assets/scripts/build-manifest.mjs includes .jpg
and .png files below a directory that contains .glb files. Existing 3D
packs use Previews/ directories for per-asset preview images. The mirror in
scripts/mirror-to-gcs.mjs already maps .jpg to image/jpeg.

The repository has 296 packs, 292 CC0 packs, and 4 MIT packs. Adding files to
the existing model pack does not change those counts. It does not require a
manifest code change, a UI .jpg rule, or a new pack.

### Thumbnail audit

The workshop source is
/Users/pany/.paseo/worktrees/05tg6iwp/majestic-bat/games/pirate-nation-showcase/public/cdn-assets/pirate-nation.
It contains 375 model GLBs, 355 visual-model entries, and 355 matching JPEG
thumbnails. Every visual model has one thumbnail. No thumbnail destination is
duplicated.

For a model entry with
runtime/models/ships/ships-ship-pirate-xl.glb, the jam path is
ships/Previews/ships-ship-pirate-xl.jpg. For the Kraken, the path is
world-bosses/Previews/world-bosses-creature-16x16-kraken.jpg. All 355
destination directories contain a model GLB, so the existing 3D runtime rule
will mirror all 355 JPEGs.

The updated model pack will contain:

- 375 GLBs;
- 355 model JPEGs;
- preview.png, License.txt, and PROVENANCE.md;
- 730 runtime files and 733 total files.

Using the current manifest OIDs and the current thumbnail bytes, the expected
content-derived model-pack version is now 2ae870ead5c1 after the corrected
front-facing thumbnail bytes were added. The manifest builder is the
authority. The implementation must verify this value after it adds the files
and use the generated value if the source bytes change.

### Workshop state

The showcase has uncommitted scene-kit work in the same worktree. The current
feature set includes:

- collision GLBs behind a Collision toggle instead of separate gallery cards;
- repaired GLBs with the vertex-baked Y-normalization fix;
- logarithmic depth buffering on the Three.js canvases;
- cloned materials, animation discovery, camera fitting, turntable, wireframe,
  light-stage, and collision controls;
- the Avatar Lab with composition, tint, animation, and display controls;
- thumbnail cards, search, filters, keyboard navigation, Random, and a
  persistent model stage;
- PackCanvas, PackModel, FitCamera, ViewerErrorBoundary, modelTransform, and
  layoutRow in src/pack3d/;
- the Scene tab with category selection, reshuffling, grounded row layout, and
  light/dark stage control.

The current local payload also contains manifest.json, runtime/models.json,
runtime/audio.json, runtime/sprites.json, prefabs.json, and prefab index data.
The app does not use prefab data.

### SDK contract

The beta package is @series-inc/rundot-game-sdk@5.28.0-beta.2. Its asset
library exposes:

~~~ts
interface AssetLibraryApi {
  getPackBaseUrl(packId: string, version: string): Promise<string>
  loadAssetsBundle(game: string, bundleKey: string, fileType?: string): Promise<ArrayBuffer>
}
~~~

The showcase uses getPackBaseUrl. It appends a pack-relative path to the
returned base URL. It does not use loadAssetsBundle, the old
cdn.resolveAssetUrl API, a GCS URL, or a local binary fallback.

The SDK mock resolves the same published asset-library paths during local
development. A published RUN host resolves the paths through its host-aware
CDN. The app must call RundotGameAPI.initializeAsync() before it reads
RundotGameAPI.assetLibrary.

## Requirements

### jam-ready-assets

R1. Add all 355 generated model thumbnails to the existing
3D/pirate/proofofplay-pirate-nation-models pack.

R2. Derive each thumbnail path from its model path. Remove the leading
models/ segment, keep the model category directory, add Previews/, and use
<model-id>.jpg as the file name.

R3. Keep the existing root preview.png, License.txt, PROVENANCE.md, and 375
model GLBs. Keep the other three Proof of Play packs byte-for-byte unchanged.

R4. Do not create a thumbnail pack. Do not change the UI runtime extension
list. Do not change scripts/build-manifest.mjs or scripts/mirror-to-gcs.mjs
for this addition.

R5. Store the new JPEGs with Git LFS. The model pack must report 730 runtime
files and 733 total files. Its content-derived version must be verified from
the generated v2 manifest.

R6. Keep the jam catalog at 296 packs, 292 CC0 packs, and 4 MIT packs. Keep
the model pack creator as Proof of Play and its licence as MIT.

### run-workshop showcase

R7. Pin the four existing pack ids in one typed module. Use model version
2ae870ead5c1 after the jam manifest confirms it. Keep the existing icon, UI,
and audio versions: ec3e46dfcd27, 97835c36f9f1, and 064b51d95ed5.

R8. Resolve every binary asset with
RundotGameAPI.assetLibrary.getPackBaseUrl. Cache one base URL promise per
pack. Remove a rejected promise from the cache so a later request can retry.
Encode each path segment while preserving slash separators.

R9. Await SDK initialization before reading the asset-library API. Surface SDK
or asset resolution errors through the existing error boundaries and loading
states. Do not fall back to public/cdn-assets, a GCS URL, or an empty asset.

R10. Keep manifest.json, models.json, audio.json, and sprites.json under
public/catalog/pirate-nation. Keep LICENSE and PROVENANCE.md there. Do not copy
prefabs.json or prefab index data.

R11. Map catalog entries to these pack-relative paths:

- model entries: strip models/ from relativePath and use the models pack;
- collision entries: use the same model mapping as visual entries;
- avatar model paths: strip runtime/models/ and use the models pack;
- icon sprites: strip sprites/icons/ and use the icons pack;
- UI and branding sprites: strip sprites/ui/ or sprites/branding/ and use
  the UI pack;
- audio entries: strip audio/, change .wav to .mp3, and use the audio pack;
- model thumbnails: derive <category>/Previews/<model-id>.jpg from the model
  relativePath and use the models pack.

R12. Keep the ModelViewer collision toggle. Keep active-entry selection,
material cloning, animation discovery, camera fitting, wireframe, turntable,
light-stage, and logarithmic-depth behavior.

R13. Keep the Avatar Lab, Sprite Library, Audio Room, Dashboard, Model Gallery,
thumbnail route, and Scene tab. Port only their asset references. Keep the
Audio Room note accurate: the CDN path is MP3 while catalog metadata retains
the source format.

R14. Keep PackCanvas and PackModel as reusable Three.js helpers. Keep
bounds-based placement, row layout, cloned scenes, shadow flags, and the
viewer error boundary. Keep the collision and z-fighting fixes.

R15. Keep the thumbnail generator. It must read local model metadata, load the
remote model through the SDK, and write JPEGs only to a required caller-owned
output directory. It must not write generated images into public/.

R16. Remove the full local binary payload only after the jam pack is mirrored
and live model and thumbnail URLs pass verification. Keep the exporter with a
required --source option so it never assumes that the deleted payload exists.
Remove the completed one-time normalization repair command and its tests after
the repaired GLBs are published.

R17. The production build must contain local catalog JSON and legal documents.
It must contain no Pirate Nation GLB, MP3, WAV, or generated thumbnail JPEG.

R18. Make useAssetUrl compare a stable pack + path key. A new
AssetReference object with the same key must not start a new request.

R19. Document the four pins, the SDK loading path, local mock behavior, jam
release order, local metadata, and reusable Three.js scene helpers.

## Non-goals

- Do not create a fifth jam pack.
- Do not add .jpg to the UI runtime extension list.
- Do not enable or change GCS CORS.
- Do not make the browser read manifest/v2 or files.json.
- Do not construct a GCS URL in application code.
- Do not use loadAssetsBundle for these packs.
- Do not change the licence policy.
- Do not rewrite the three unchanged Proof of Play packs.
- Do not change repaired model geometry.
- Do not redesign the Avatar Lab.
- Do not add a prefab scene loader.
- Do not merge the scene helpers into a shared repository package.

## Acceptance Criteria

### jam-ready-assets

- [x] The existing model pack contains 355 files under category Previews/
      directories, with one JPEG for every visual model.
- [x] The generated v2 manifest reports the model pack with creator Proof of
      Play, licence MIT, 730 runtime files, and 733 total files.
- [x] The model-pack version is 2ae870ead5c1, or the plan records a verified
      content change and updates the app pin to the generated version.
- [x] The icon, UI, and audio pack versions remain ec3e46dfcd27,
      97835c36f9f1, and 064b51d95ed5.
- [x] The generated catalog reports 296 packs, 292 CC0 packs, and 4 MIT packs.
- [x] node --test scripts/license-policy.test.mjs passes and the pack check
      creates no rejection file.
- [x] After the mirror workflow completes, a model GLB, a collision GLB, a
      model thumbnail, an icon, and an audio file each return HTTP 200 from
      paths read from the live v2 pack manifests. The thumbnail returns
      image/jpeg.

### run-workshop showcase

- [x] @series-inc/rundot-game-sdk is pinned to 5.28.0-beta.2 in both
      package.json and package-lock.json.
- [x] npm run typecheck, npm test, npm run test:e2e, and npm run build pass.
- [x] The build contains dist/catalog/pirate-nation/models.json and no
      dist/cdn-assets directory.
- [x] The build contains no .glb, .mp3, .wav, or generated model thumbnail .jpg
      files.
- [x] The Models tab displays thumbnails from the models pack. A model with
      collision geometry has no duplicate collision card. Its Collision button
      loads the collision GLB and returns to the visual GLB.
- [x] The Scene tab renders five grounded models. Reshuffle changes the row.
      The stage control changes the backdrop.
- [x] The Avatar Lab, Sprite Library, Audio Room, Dashboard, and thumbnail
      route load through the SDK-backed mappings.
- [x] The thumbnail command renders one model into a temporary output
      directory without writing a binary under public/.
- [x] The e2e request audit finds no request containing
      /cdn-assets/pirate-nation/.
- [x] The app README and src/pack3d/README.md describe the asset-library
      loading path and the retained Three.js helpers.

## File Roster

### jam-ready-assets

| File | Action | Why |
|---|---|---|
| /Users/pany/dev/jam-ready-assets/3D/pirate/proofofplay-pirate-nation-models/ | add 355 LFS files under category Previews directories | Keep each generated preview beside the model category that it describes. The existing 3D runtime rule mirrors these files. |

No jam manifest or documentation file needs a code change. The existing model
pack already has its licence, provenance, creator mapping, and preview
conventions.

### run-workshop

| File | Action | Why |
|---|---|---|
| games/pirate-nation-showcase/package.json | modify | Pin SDK 5.28.0-beta.2 and remove the one-time repair command. |
| games/pirate-nation-showcase/package-lock.json | modify | Record the exact SDK dependency tree. |
| games/pirate-nation-showcase/scripts/export-to-jam-assets.ts | modify | Export four packs from an explicit source snapshot and attach model thumbnails to the existing 3D pack. |
| games/pirate-nation-showcase/scripts/export-to-jam-assets.test.ts | modify | Test four packs, model thumbnail pairing, 3D JPEG runtime handling, counts, and licence output. |
| games/pirate-nation-showcase/scripts/render-thumbnails.ts | modify | Read local metadata, resolve remote models, and write to a required output directory. |
| games/pirate-nation-showcase/scripts/repair-model-normalization.ts | delete | The repaired GLBs are published in the jam model pack. |
| games/pirate-nation-showcase/scripts/repair-model-normalization.test.ts | delete | Remove tests for the completed one-time repair command. |
| games/pirate-nation-showcase/src/assetLibrary.ts | create | Define four pack pins and the cached SDK resolver. |
| games/pirate-nation-showcase/src/assetLibrary.test.ts | create | Test initialization ordering, URL joining, caching, retry, and exact pins. |
| games/pirate-nation-showcase/src/catalog.ts | modify | Load local metadata and map catalog entries to typed pack references. |
| games/pirate-nation-showcase/src/catalog.test.ts | modify | Test local metadata paths and all four pack mappings, including thumbnails. |
| games/pirate-nation-showcase/src/useAssetUrl.ts | modify | Resolve typed references and use a stable dependency key. |
| games/pirate-nation-showcase/src/main.tsx | modify | Keep bounded SDK boot and remove the local binary fallback message. |
| games/pirate-nation-showcase/src/components/ModelViewer.tsx | modify | Use the model reference while preserving collision and viewer controls. |
| games/pirate-nation-showcase/src/pack3d/PackModel.tsx | modify | Resolve model entries through the typed mapping. |
| games/pirate-nation-showcase/src/pack3d/README.md | modify | Document the asset-reference boundary and reusable scene helpers. |
| games/pirate-nation-showcase/src/tabs/AvatarLab.tsx | modify | Resolve the avatar GLB from the models pack. |
| games/pirate-nation-showcase/src/tabs/ModelGallery.tsx | modify | Resolve model GLBs, downloads, and category previews from the models pack. |
| games/pirate-nation-showcase/src/tabs/SpriteLibrary.tsx | modify | Resolve icon, UI, and branding sprites from their two packs. |
| games/pirate-nation-showcase/src/tabs/AudioRoom.tsx | modify | Resolve source-format catalog entries as CDN MP3 paths. |
| games/pirate-nation-showcase/src/thumb.tsx | modify | Resolve thumbnail-renderer model GLBs through the SDK. |
| games/pirate-nation-showcase/src/tabs/Dashboard.tsx | modify | Display local metadata and the four pinned pack ids. |
| games/pirate-nation-showcase/public/catalog/pirate-nation/manifest.json | move | Keep the app metadata local after removing the binary pack. |
| games/pirate-nation-showcase/public/catalog/pirate-nation/models.json | move | Keep model entries and repaired bounds local. |
| games/pirate-nation-showcase/public/catalog/pirate-nation/audio.json | move | Keep audio metadata local. |
| games/pirate-nation-showcase/public/catalog/pirate-nation/sprites.json | move | Keep sprite metadata local. |
| games/pirate-nation-showcase/public/catalog/pirate-nation/LICENSE | move | Keep the MIT notice in the app distribution. |
| games/pirate-nation-showcase/public/catalog/pirate-nation/PROVENANCE.md | move and modify | Document the jam model pack and generated Previews/ files. |
| games/pirate-nation-showcase/public/cdn-assets/pirate-nation/ | delete | Remove the vendored binary payload after jam publication and live checks. |
| games/pirate-nation-showcase/public/cdn-assets/README.md | delete | Remove documentation for the deleted local payload. |
| games/pirate-nation-showcase/e2e/smoke.spec.ts | modify | Assert local metadata, remote pack URLs, preserved controls, and no local binary requests. |
| games/pirate-nation-showcase/README.md | modify | Document SDK loading, four pins, local metadata, thumbnail generation, and release order. |
| games/pirate-nation-showcase/THIRD_PARTY_NOTICES.md | modify | Update metadata paths and retain the MIT attribution. |

The existing files in src/pack3d/PackCanvas.tsx,
src/pack3d/modelTransform.ts, src/pack3d/layout.ts, and
src/tabs/SceneStage.tsx remain in place. Their behavior is covered by the
scene acceptance criteria and existing tests.

## Implementation Plan

### Task 1: Update the jam exporter for the existing 3D pack

**Files:**

- Modify: games/pirate-nation-showcase/scripts/export-to-jam-assets.ts
- Test: games/pirate-nation-showcase/scripts/export-to-jam-assets.test.ts

- [x] **Step 1: Add failing exporter tests.** Keep four pack declarations. Add
  this contract to the test file:

~~~ts
it('attaches thumbnails to the existing model pack', () => {
  expect(JAM_PACKS).toHaveLength(4)
  expect(JAM_PACKS[0]).toMatchObject({
    slug: 'proofofplay-pirate-nation-models',
    destDir: '3D/pirate/proofofplay-pirate-nation-models',
    category: '3d',
    expectedFiles: 375,
    expectedThumbnailFiles: 355,
  })
})

it('counts JPEG previews below a GLB directory as 3D runtime files', () => {
  expect(runtimeFileCount('3d', [
    'ships/ships-boat.glb',
    'ships/Previews/ships-boat.jpg',
    'preview.png',
    'License.txt',
  ])).toBe(2)
})

it('does not apply the obsolete 400-file fallback cap to the model pack', () => {
  expect(runtimeFileCount('3d', Array.from(
    { length: 730 },
    (_, index) => index < 375
      ? 'category/model-' + index + '.glb'
      : 'category/Previews/thumb-' + index + '.jpg',
  ))).toBe(730)
})
~~~

- [x] **Step 2: Run the exporter tests.**

Run:

~~~bash
cd /Users/pany/.paseo/worktrees/05tg6iwp/majestic-bat/games/pirate-nation-showcase
npx vitest run scripts/export-to-jam-assets.test.ts
~~~

Expected: FAIL because the exporter still declares no thumbnail attachment
and counts only .glb files for a 3D pack.

- [x] **Step 3: Implement the exporter contract.** Add
expectedThumbnailFiles: 355 to the model pack. Remove the obsolete local
400-file cap. Mirror the jam 3D rule with an underGlbDir helper. Require
--source /private/tmp/pirate-nation-source and read all source files from that
directory. Load
runtime/models.json, filter collision entries, verify 355 visual entries, and
copy each thumbnail to:

~~~ts
const modelPath = entry.relativePath.replace(/^models\//, '')
const slash = modelPath.lastIndexOf('/')
if (slash < 1) throw new Error(entry.id + ': model path has no category directory')
const destination = join(
  stageRoot,
  modelPath.slice(0, slash),
  'Previews',
  entry.id + '.jpg',
)
~~~

Verify every source thumbnail exists. Verify no destination repeats. Keep the
existing atomic staging and stale-destination removal. Keep --verified-by and
add --verified-on for reproducible licence headers. Copy the existing root
preview, licence, and provenance files into each of the four output packs.
Count the model pack after the thumbnail copies and require 730 runtime files
and 733 total files.

- [x] **Step 4: Run the exporter tests.**

Run:

~~~bash
npx vitest run scripts/export-to-jam-assets.test.ts
~~~

Expected: PASS.

### Task 2: Build and validate the four jam pack outputs

**Files:**

- Create outside the repository: /private/tmp/pirate-nation-jam-export/
- Read: games/pirate-nation-showcase/public/cdn-assets/pirate-nation/

- [x] **Step 1: Export from the current source snapshot.**

Run:

~~~bash
cd /Users/pany/.paseo/worktrees/05tg6iwp/majestic-bat/games/pirate-nation-showcase
rm -rf /private/tmp/pirate-nation-jam-export
npm run export:jam-assets -- \
  --source public/cdn-assets/pirate-nation \
  --out /private/tmp/pirate-nation-jam-export \
  --verified-on 2026-08-26
~~~

Expected: four output packs. The model pack has 733 files and 730 runtime
files. The output has 355 model preview JPEGs and no WAV files.

- [x] **Step 2: Validate thumbnail pairing and file types.**

Run:

~~~bash
cd /private/tmp/pirate-nation-jam-export
test "$(find 3D/pirate/proofofplay-pirate-nation-models -path '*/Previews/*.jpg' -type f | wc -l | tr -d ' ')" = 355
test "$(find 3D/pirate/proofofplay-pirate-nation-models -type f | wc -l | tr -d ' ')" = 733
test "$(find 3D/pirate/proofofplay-pirate-nation-models -name '*.glb' -o -name '*.jpg' | wc -l | tr -d ' ')" = 730
test "$(find . -name '*.wav' | wc -l | tr -d ' ')" = 0
~~~

Expected: all commands exit 0.

- [x] **Step 3: Test exporter failure paths.** Remove the icons source tree
from a copy of the source. Run the exporter and confirm it names the missing
tree. Remove one model thumbnail from another copy. Run the exporter and
confirm it names the model id and does not leave a completed destination.

Run:

~~~bash
cd /Users/pany/.paseo/worktrees/05tg6iwp/majestic-bat/games/pirate-nation-showcase
rm -rf /private/tmp/pirate-nation-source-missing
cp -R public/cdn-assets/pirate-nation /private/tmp/pirate-nation-source-missing
rm -rf /private/tmp/pirate-nation-source-missing/runtime/sprites/icons
if npm run export:jam-assets -- --source /private/tmp/pirate-nation-source-missing --out /private/tmp/pirate-nation-jam-fail 2>/tmp/pirate-nation-jam-fail.log; then exit 1; fi
grep -q 'missing source tree runtime/sprites/icons' /tmp/pirate-nation-jam-fail.log
rm -rf /private/tmp/pirate-nation-source-thumb-missing
cp -R public/cdn-assets/pirate-nation /private/tmp/pirate-nation-source-thumb-missing
rm /private/tmp/pirate-nation-source-thumb-missing/thumbnails/ships-ship-pirate-xl.jpg
if npm run export:jam-assets -- --source /private/tmp/pirate-nation-source-thumb-missing --out /private/tmp/pirate-nation-jam-fail-thumb 2>/tmp/pirate-nation-jam-fail-thumb.log; then exit 1; fi
grep -q 'ships-ship-pirate-xl' /tmp/pirate-nation-jam-fail-thumb.log
~~~

Expected: the command fails before it reports a successful export.

### Task 3: Add the previews to jam-ready-assets and verify the manifest

**Files:**

- Add: /Users/pany/dev/jam-ready-assets/3D/pirate/proofofplay-pirate-nation-models/ category Previews JPEG files

- [x] **Step 1: Create a jam branch from current main.** Work in
/Users/pany/dev/jam-ready-assets. Copy only the updated model pack from the
temporary export into the existing model-pack directory. Do not copy or
rewrite the icon, UI, or audio packs.

Run:

~~~bash
cd /Users/pany/dev/jam-ready-assets
git status --short
git switch main
git pull --ff-only
git switch -c add-pirate-nation-model-previews
rm -rf 3D/pirate/proofofplay-pirate-nation-models
cp -R /private/tmp/pirate-nation-jam-export/3D/pirate/proofofplay-pirate-nation-models 3D/pirate/
~~~

Expected: the branch starts from current main. Only the existing model pack
and its 355 new JPEG files differ.

- [x] **Step 2: Check Git LFS tracking.**

Run:

~~~bash
cd /Users/pany/dev/jam-ready-assets
git check-attr filter -- 3D/pirate/proofofplay-pirate-nation-models/ships/Previews/ships-ship-pirate-xl.jpg
~~~

Expected: the file reports filter: lfs.

- [x] **Step 3: Run the jam checks.** Do not change the manifest scripts.

Run:

~~~bash
cd /Users/pany/dev/jam-ready-assets
node --test scripts/license-policy.test.mjs
SKIP_PUBLISHED_CHECK=1 node scripts/build-manifest.mjs
test ! -e .rejected-packs.json
git diff --check
~~~

Expected: the licence tests pass. The manifest reports 296 packs, 292 CC0
packs, and 4 MIT packs. The model pack reports 730 runtime files and 733
total files. The generated model version is 2ae870ead5c1.

- [x] **Step 4: Confirm unchanged pack pins.** Read
manifest/v2/index.json and assert the icon, UI, and audio versions remain
ec3e46dfcd27, 97835c36f9f1, and 064b51d95ed5.

### Task 4: Verify the mirrored model pack before changing the app pin

**Files:**

- Read: /Users/pany/dev/jam-ready-assets/manifest/v2/index.json
- Read: the pack manifest in the commit directory named by
  /Users/pany/dev/jam-ready-assets/manifest/v2/index.json

- [x] **Step 1: Wait for the jam merge workflow.** The app pin must not change
to the new model version until the jam repository merge workflow mirrors the
updated pack.

- [x] **Step 2: Read live paths from the v2 pack manifests.** Select one
visual GLB, one collision GLB, and one Previews/*.jpg entry from the live model
pack manifest. Select one icon and one MP3 from their live pack manifests.

- [x] **Step 3: Check live responses.** Use the paths returned by the manifest.
Do not invent file names. Confirm HTTP 200. Confirm the thumbnail has
Content-Type: image/jpeg, a GLB has model/gltf-binary, and the audio file has
audio/mpeg.

Run:

~~~bash
node --input-type=module -e '
const base = "https://storage.googleapis.com/run-asset-library"
const index = await (await fetch(base + "/manifest/v2/index.json")).json()
const ids = {
  models: "3D/pirate/proofofplay-pirate-nation-models",
  icons: "ui/proofofplay-pirate-nation-icons",
  audio: "audio/proofofplay-pirate-nation-audio",
}
const manifests = {}
for (const [key, id] of Object.entries(ids)) {
  const pack = index.packs.find((entry) => entry.id === id)
  manifests[key] = {
    id,
    version: pack.version,
    files: await (await fetch(
      base + "/manifest/v2/commits/" + index.commit + "/packs/" + id.replaceAll("/", "--") + ".json",
    )).then((response) => response.json()),
  }
}
const checks = [
  [manifests.models, (file) => file.path.endsWith(".glb") && !file.path.endsWith("-collision.glb"), "model/gltf-binary"],
  [manifests.models, (file) => file.path.endsWith("-collision.glb"), "model/gltf-binary"],
  [manifests.models, (file) => file.path.endsWith(".jpg"), "image/jpeg"],
  [manifests.icons, (file) => file.runtime, "image/png"],
  [manifests.audio, (file) => file.path.endsWith(".mp3"), "audio/mpeg"],
]
for (const [pack, select, expectedType] of checks) {
  const file = pack.files.files.find(select)
  if (!file) throw new Error("required live file is missing")
  const url = base + "/packs/" + pack.id + "@" + pack.version + "/" + file.path
  const response = await fetch(url)
  const type = response.headers.get("content-type") || ""
  if (response.status !== 200 || !type.startsWith(expectedType)) {
    throw new Error(response.status + " " + type + " for " + url)
  }
  console.log(response.status, type, url)
}
'
~~~

Expected: the model pack selects a JPEG preview. The icon and audio packs
select runtime files. Each response reports HTTP 200 and the expected type.

- [x] **Step 4: Record the live model version.** It must be 2ae870ead5c1. If
the version differs, compare the file OIDs with the local manifest, record the
byte change in the app README, and use the generated version in the next task.

### Task 5: Add the typed asset-library resolver

**Files:**

- Create: games/pirate-nation-showcase/src/assetLibrary.ts
- Create: games/pirate-nation-showcase/src/assetLibrary.test.ts
- Modify: games/pirate-nation-showcase/package.json
- Modify: games/pirate-nation-showcase/package-lock.json

- [x] **Step 1: Pin the SDK.**

Run:

~~~bash
cd /Users/pany/.paseo/worktrees/05tg6iwp/majestic-bat/games/pirate-nation-showcase
npm install --save-exact @series-inc/rundot-game-sdk@5.28.0-beta.2
~~~

Expected: package.json and package-lock.json contain 5.28.0-beta.2.

- [x] **Step 2: Add failing resolver tests.** Mock
@series-inc/rundot-game-sdk/api. Test the following behavior:

~~~ts
expect(PIRATE_PACKS).toEqual({
  models: { id: '3D/pirate/proofofplay-pirate-nation-models', version: '2ae870ead5c1' },
  icons: { id: 'ui/proofofplay-pirate-nation-icons', version: 'ec3e46dfcd27' },
  ui: { id: 'ui/proofofplay-pirate-nation-ui', version: '97835c36f9f1' },
  audio: { id: 'audio/proofofplay-pirate-nation-audio', version: '064b51d95ed5' },
})

await resolveAssetUrl({ pack: 'models', path: 'ships/Previews/ship (1).jpg' })
expect(getPackBaseUrl).toHaveBeenCalledWith(
  '3D/pirate/proofofplay-pirate-nation-models',
  '2ae870ead5c1',
)
expect(resolvedUrl).toMatch(/ships\/Previews\/ship%20%281%29\.jpg$/)
~~~

Also test that initializeAsync resolves before getPackBaseUrl, two model
references call getPackBaseUrl once, and a rejected base URL can succeed on the
next request.

- [x] **Step 3: Implement the resolver.** Use this module contract:

~~~ts
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

export const PIRATE_PACKS = {
  models: {
    id: '3D/pirate/proofofplay-pirate-nation-models',
    version: '2ae870ead5c1',
  },
  icons: {
    id: 'ui/proofofplay-pirate-nation-icons',
    version: 'ec3e46dfcd27',
  },
  ui: {
    id: 'ui/proofofplay-pirate-nation-ui',
    version: '97835c36f9f1',
  },
  audio: {
    id: 'audio/proofofplay-pirate-nation-audio',
    version: '064b51d95ed5',
  },
} as const

export type PiratePackKey = keyof typeof PIRATE_PACKS

export interface AssetReference {
  pack: PiratePackKey
  path: string
}

const baseUrls = new Map<PiratePackKey, Promise<string>>()
let initialization: Promise<void> | undefined

function ensureInitialized(): Promise<void> {
  if (!initialization) {
    initialization = RundotGameAPI.initializeAsync().catch((error) => {
      initialization = undefined
      throw error
    })
  }
  return initialization
}

export function clearAssetLibraryCacheForTests(): void {
  baseUrls.clear()
  initialization = undefined
}

export async function resolveAssetUrl(reference: AssetReference): Promise<string> {
  await ensureInitialized()
  const pack = PIRATE_PACKS[reference.pack]
  let base = baseUrls.get(reference.pack)
  if (!base) {
    base = RundotGameAPI.assetLibrary
      .getPackBaseUrl(pack.id, pack.version)
      .then((url) => {
        if (!url) throw new Error('Asset library returned an empty pack URL')
        return url.replace(/\/+$/, '')
      })
      .catch((error) => {
        baseUrls.delete(reference.pack)
        throw error
      })
    baseUrls.set(reference.pack, base)
  }
  const path = reference.path.split('/').map(encodeURIComponent).join('/')
  return (await base) + '/' + path
}
~~~

- [x] **Step 4: Run resolver tests and typecheck.**

Run:

~~~bash
npx vitest run src/assetLibrary.test.ts
npm run typecheck
~~~

Expected: PASS.

### Task 6: Move local metadata and port catalog mappings

**Files:**

- Move: public/cdn-assets/pirate-nation/manifest.json to
  public/catalog/pirate-nation/manifest.json
- Move: public/cdn-assets/pirate-nation/runtime/models.json to
  public/catalog/pirate-nation/models.json
- Move: public/cdn-assets/pirate-nation/runtime/audio.json to
  public/catalog/pirate-nation/audio.json
- Move: public/cdn-assets/pirate-nation/runtime/sprites.json to
  public/catalog/pirate-nation/sprites.json
- Move: public/cdn-assets/pirate-nation/LICENSE to
  public/catalog/pirate-nation/LICENSE
- Move: public/cdn-assets/pirate-nation/PROVENANCE.md to
  public/catalog/pirate-nation/PROVENANCE.md
- Modify: src/catalog.ts
- Modify: src/catalog.test.ts
- Modify: src/useAssetUrl.ts
- Modify: src/main.tsx

- [x] **Step 1: Move only the six used metadata and legal files.** Keep the
binary tree, prefabs.json, and prefab index data in place until the remote
asset checks pass.

- [x] **Step 2: Add failing catalog mapping tests.** Replace local URL tests
with these typed mapping cases while keeping the existing bounds, collision,
format, and catalog-load tests:

~~~ts
expect(modelAssetReference({ relativePath: 'models/ships/ship.glb' })).toEqual({
  pack: 'models',
  path: 'ships/ship.glb',
})
expect(avatarAssetReference('runtime/models/characters-skins/avatar.glb')).toEqual({
  pack: 'models',
  path: 'characters-skins/avatar.glb',
})
expect(thumbnailAssetReference({
  id: 'ships-ship-pirate-xl',
  relativePath: 'models/ships/ships-ship-pirate-xl.glb',
})).toEqual({
  pack: 'models',
  path: 'ships/Previews/ships-ship-pirate-xl.jpg',
})
expect(audioAssetReference({ relativePath: 'audio/music/track.wav' })).toEqual({
  pack: 'audio',
  path: 'music/track.mp3',
})
~~~

- [x] **Step 3: Implement local metadata fetch and mappings.** Use a relative
catalog/pirate-nation prefix for same-app fetches. Return AssetReference
objects instead of URL strings. The thumbnail mapping must derive its category
from the model entry:

~~~ts
export function modelAssetReference(
  entry: Pick<PirateNationModelEntry, 'relativePath'>,
): AssetReference {
  return { pack: 'models', path: entry.relativePath.replace(/^models\//, '') }
}

export function avatarAssetReference(packRelativePath: string): AssetReference {
  return { pack: 'models', path: packRelativePath.replace(/^runtime\/models\//, '') }
}

export function thumbnailAssetReference(
  entry: Pick<PirateNationModelEntry, 'id' | 'relativePath'>,
): AssetReference {
  const modelPath = modelAssetReference(entry).path
  const slash = modelPath.lastIndexOf('/')
  if (slash < 1) throw new Error(entry.id + ': model path has no category directory')
  return {
    pack: 'models',
    path: modelPath.slice(0, slash) + '/Previews/' + entry.id + '.jpg',
  }
}

export function spriteAssetReference(
  entry: Pick<PirateNationSpriteEntry, 'relativePath' | 'category'>,
): AssetReference {
  if (entry.category === 'icons') {
    return { pack: 'icons', path: entry.relativePath.replace(/^sprites\/icons\//, '') }
  }
  return {
    pack: 'ui',
    path: entry.relativePath.replace(/^sprites\/(?:ui|branding)\//, ''),
  }
}

export function audioAssetReference(
  entry: Pick<PirateNationAudioEntry, 'relativePath'>,
): AssetReference {
  return {
    pack: 'audio',
    path: entry.relativePath.replace(/^audio\//, '').replace(/\.wav$/i, '.mp3'),
  }
}
~~~

Keep buildCollisionIndex, isCollisionModel, formatBytes, and gridFootprint.
Change fetchJson to fetch local metadata with
fetch('catalog/pirate-nation/' + path) and keep its cache.

Change useAssetUrl to accept AssetReference | null and call resolveAssetUrl.
Derive key = reference ? reference.pack + ':' + reference.path : ''. Use key
as the effect dependency. Reset URL and error when the key changes or becomes
empty. Keep cancellation and error propagation.

Remove PACK_CDN_PREFIX, setRunSdkReady, resolvePackAssetUrl, and every local
binary fallback. Keep the bounded SDK boot in main.tsx, but change its warning
to say that remote assets may be unavailable.

- [x] **Step 4: Run catalog tests and typecheck.**

Run:

~~~bash
npx vitest run src/catalog.test.ts
npm run typecheck
~~~

Expected: PASS.

### Task 7: Port consumers without changing viewer behavior

**Files:**

- Modify: src/components/ModelViewer.tsx
- Modify: src/pack3d/PackModel.tsx
- Modify: src/tabs/AvatarLab.tsx
- Modify: src/tabs/ModelGallery.tsx
- Modify: src/tabs/SpriteLibrary.tsx
- Modify: src/tabs/AudioRoom.tsx
- Modify: src/tabs/Dashboard.tsx
- Modify: src/thumb.tsx

- [x] **Step 1: Replace every binary reference helper.** Use
modelAssetReference in ModelViewer, PackModel, ModelGallery downloads, and
the thumbnail route. Use avatarAssetReference in AvatarLab. Use
thumbnailAssetReference(entry) in model cards. Use spriteAssetReference and
audioAssetReference in their libraries.

- [x] **Step 2: Preserve the model viewer contract.** Keep
activeEntry = showCollision && collisionEntry ? collisionEntry : entry.
Keep the Collision button, fitKey={activeEntry.id}, scene cloning, animation
list, material cloning, wireframe state, turntable state, backdrop, light rig,
and PackCanvas logarithmic depth buffer.

- [x] **Step 3: Update Dashboard and Audio Room text.** Dashboard must show
local catalog metadata and the four pinned pack ids. It must not show a local
runtime path. Audio Room must state that the CDN serves MP3 files while the
catalog retains source-format metadata.

- [x] **Step 4: Update the pack3d README.** State that callers pass catalog
entries to PackModel, which maps them to typed asset references. State that
PackCanvas enables logarithmic depth and that modelTransform and layoutRow
place models by catalog bounds.

- [x] **Step 5: Run the existing unit suite.**

Run:

~~~bash
npm test
~~~

Expected: PASS. Existing avatar, repair-data, catalog, layout, and model
transform coverage remains active.

### Task 8: Keep thumbnail generation and remove the vendored payload

**Files:**

- Modify: scripts/render-thumbnails.ts
- Modify: src/thumb.tsx
- Modify: scripts/export-to-jam-assets.ts
- Modify: package.json
- Delete after live verification: scripts/repair-model-normalization.ts
- Delete after live verification: scripts/repair-model-normalization.test.ts
- Delete after live verification: public/cdn-assets/README.md
- Delete after live verification: public/cdn-assets/pirate-nation/

- [x] **Step 1: Change the thumbnail script input and output.** Read
public/catalog/pirate-nation/models.json. Require
--out /private/tmp/pirate-nation-thumbnails or another caller-selected output
directory. Resolve the output to an absolute path. Keep --force, --limit, collision filtering,
320x320 JPEG capture, and per-model error reporting. Create only the requested
output directory. Do not write to public/.

- [x] **Step 2: Render one remote thumbnail.**

Run:

~~~bash
npm run thumbnails -- --out /private/tmp/pirate-nation-thumbnails --limit 1
file /private/tmp/pirate-nation-thumbnails/*.jpg
test "$(find public -type f -name '*.jpg' | wc -l | tr -d ' ')" = 0
~~~

Expected: one JPEG is written outside the app public tree. The command uses
the SDK-backed model URL in src/thumb.tsx.

- [x] **Step 3: Remove the one-time repair command.** Delete repair:models
from package.json. Delete the repair script and its test only after the jam
model pack and live URL checks prove that the repaired GLBs are published.

- [x] **Step 4: Remove the local binary payload.** Delete the local payload
after Tasks 3 and 4. Keep only the six files under
public/catalog/pirate-nation. Update the exporter documentation to require a
separate source snapshot through --source.

### Task 9: Add remote-load regression tests

**Files:**

- Modify: e2e/smoke.spec.ts

- [x] **Step 1: Update local metadata assertions.** Change catalog requests to
catalog/pirate-nation/*.json. Keep all existing tab and behavior tests.

- [x] **Step 2: Add the request audit.** Register page.on('request') before
navigation. Fail the test if a request URL contains
/cdn-assets/pirate-nation/.

- [x] **Step 3: Assert model-pack model and thumbnail URLs.** On the Models tab,
wait for a thumbnail URL containing:

~~~text
/packs/3D/pirate/proofofplay-pirate-nation-models@2ae870ead5c1/
~~~

Open the shipwright model. Wait for its visual GLB. Click Collision and wait
for the collision GLB from the same pack version. Assert the control remains
available and toggles back.

- [x] **Step 4: Assert the other pack mappings.** Open Audio, Sprites, Avatar
Lab, and Scene. Assert their requests contain the pinned audio, icon/UI, or
model pack ids and versions. Assert the Scene tab still renders five model
roots. Match pack ids and versions, not a physical storage hostname.

- [x] **Step 5: Run e2e tests.**

Run:

~~~bash
npm run test:e2e
~~~

Expected: all existing tests and the new remote request assertions pass after
the jam mirror is live.

### Task 10: Update documentation and complete verification

**Files:**

- Modify: games/pirate-nation-showcase/README.md
- Modify: games/pirate-nation-showcase/THIRD_PARTY_NOTICES.md
- Modify: games/pirate-nation-showcase/public/catalog/pirate-nation/PROVENANCE.md

- [x] **Step 1: Document the release path.** State that the app uses SDK
5.28.0-beta.2, local mock asset-library URLs during development, and the
host-aware asset-library CDN in a published RUN app. List the four pack ids and
versions. State that metadata and legal files remain local and binary assets
come from jam-ready-assets. Keep npm run dev, npm run build, npm run preview,
npm run thumbnails -- --out ..., and npm run deploy.

- [x] **Step 2: Update attribution paths.** Keep the Proof of Play MIT notice,
source repository, pinned upstream commit, and repair note. State that model
previews are generated JPEG derivatives stored under each model category's
Previews/ directory in the jam 3D pack.

- [x] **Step 3: Run the complete showcase verification.**

Run:

~~~bash
cd /Users/pany/.paseo/worktrees/05tg6iwp/majestic-bat/games/pirate-nation-showcase
npm install
npm run typecheck
npm test
npm run test:e2e
npm run build
test -f dist/catalog/pirate-nation/models.json
test ! -e dist/cdn-assets
! find dist -type f \( -name '*.glb' -o -name '*.mp3' -o -name '*.wav' \) -print -quit | grep -q .
! find dist -type f -path '*thumbnails/*.jpg' -print -quit | grep -q .
~~~

Expected: every command exits 0. The build contains metadata and legal files,
but no binary Pirate Nation payload.

- [x] **Step 4: Run the browser smoke check.** Start npm run dev. Open the
Models, Scene, Avatar Lab, Sprites, and Audio tabs. Confirm model thumbnails,
remote GLBs, audio, and sprites load. Confirm the Collision control loads a
separate collision GLB. Close the browser after the check.

## Release order

1. Update and test the exporter.
2. Add the 355 JPEGs to the existing jam 3D model pack.
3. Run the jam manifest and licence checks.
4. Open and merge the jam pull request.
5. Wait for the mirror workflow.
6. Verify live model, collision, thumbnail, icon, and audio URLs.
7. Pin the verified model-pack version in the showcase.
8. Port the showcase to the SDK and local metadata layout.
9. Run the remote-load tests.
10. Remove the local binary payload.
11. Run the full showcase build and browser check.

Do not delete the local binaries before the jam mirror and live model checks
pass. The local tree is the current exporter source snapshot.

## Open Questions

There are no product questions. The manifest builder decides the final model
pack version. If it differs from 2ae870ead5c1, inspect the OID difference,
record the reason, and update the single app pin before running e2e tests.

## Review record

This revision follows the jam repository's current 3D layout and runtime rule.
The previous separate-thumbnail-pack design was removed. The stale UI .jpg
requirement, fifth pack, fifth pin, 297-pack count, and separate thumbnail
version were removed. The model-pack count and candidate version were computed
from the current manifest and 355 current thumbnail files.

Manual review checked all eight review dimensions, the 355 model-to-thumbnail
pairing, the 730 runtime and 733 total file counts, the four SDK pins, the
release order, and the preservation of the collision and Three.js behavior.
The opposite-runtime Claude reviewer was unavailable because its CLI was not
logged in.
