# INKLINE — Stick Figure Works

An original 3D stick-figure pack and RUN showcase. The style uses thin cel-shaded gunmetal figures with ink edges, red threats, strong poses, cool white architecture, and graphic effects.

The pack contains 12 skinned characters, 85 clips in each character, 291 props, and 64 effect presets. The props include 185 industrial parts for complete levels. Three assembled scenes cover an industrial district, a service yard, and roof works. They include ramps, platforms, rails, pipes, machines, warehouses, fencing, cargo, loading docks, repair bays, and roof access.

The showcase has nine views: overview, model catalog, avatar editor, animation player, effects, district, combat, parkour, and performance. Combat and parkour use the original district. Service Yard and Roof Works are assembled scene options for inspection and reuse. They do not add new collision routes to the playable demo. It supports desktop and phone controls. The four camera modes are perspective, side, top, and third person.

## Pack setup (required once)

The generated asset bytes are not part of this repository. They are committed once, in the
[jam-ready-assets](https://github.com/series-ai/jam-ready-assets) pack `run-inkline`, which is the
verified artifact this showcase was built against. Link it before running the app:

```bash
# from the run-workshop checkout (sibling clone), or set INKLINE_PACK_DIR to the pack
git clone https://github.com/series-ai/jam-ready-assets.git ../jam-ready-assets
npm run pack:link   # verifies pack checksums, mirrors public/assets, rebuilds catalogs
```

`npm run dev`, `build`, `test`, and `test:e2e` run `pack:link` automatically; it is a no-op when
the linked tree already matches the pack inventory. The two Blender-authored catalogs
(`public/assets/characters.json`, `public/assets/props.json`) are committed here as app metadata
and are checked against the pack copies on every link.

## Run

```sh
npm ci
npm run dev
```

Open `http://localhost:5197`. Select Combat or Parkour to play. Use WASD or the arrow keys to move. Press Space to jump. Hold Shift to run. Press J to strike or fire. Press R to reset. Phones have on-screen controls.

## Video review

Open `http://localhost:5197/review/index.html` for the recorded tour. The page includes chapter links, captions, still images, and MP4 downloads. Its motion review page shows all 85 clips without effects. A separate normal-speed video compares release 1.2 with the 1.3 correction. A phone-layout video shows the on-screen controls and close weapon views. The video shows the district, parkour, combat, role kits, motion, effects, and models. It also includes actual body and equipment comparison sheets.

The review files are in `public/review/`. Keep this directory together to use its `index.html` as a local video review page. Links to the live app and asset ZIP require the app server. The capture script is `docs/verification/recording/art-tour.js`.

## Character direction

Six body families support twelve roles. Body selection preserves the current avatar settings. The role kit button applies a complete starting setup. Users can edit every kit. The animation library has an equipment selector for direct weapon inspection. Read [the Flash reference study](docs/flash-reference-study.md) for source links and shape decisions. Study 04 is a generated concept benchmark. The review sheets show the actual meshes.

## Files

- `public/assets/characters/`: 12 GLBs with an 18-bone rig and 85 clips each.
- `public/assets/props/`: 291 original GLBs.
- `public/assets/source/`: editable Blender files.
- `public/assets/scenes/`: Industrial District, Service Yard, and Roof Works GLBs.
- `public/assets/environment-layouts.json`: scene catalog with GLB, placement JSON, and editable Blender paths.
- `public/assets/{industrial-district,service-yard,roof-works}.json`: placements, actors, and scene settings.
- `public/assets/previews/`: model, animation, and effect previews.
- `public/assets/effects/`: 64 transparent, eight-frame sprite sheets.
- `public/assets/manifest.json`: dimensions, triangle counts, paths, tags, and clips.
- `src/runtime/`: reusable avatar, effects, collision, and scene code.
- The exported pack lives in [jam-ready-assets/run-inkline](https://github.com/series-ai/jam-ready-assets/tree/main/run-inkline).

## Build and check

```sh
npm run typecheck
npm test
npm run test:e2e
npm run assets:verify -- --require-previews
# With the development server running:
node --import tsx scripts/verify-motion.ts
npm run build
```

To regenerate the original files, use Blender 5.1 and the image tools below:

```sh
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r scripts/requirements.txt
npx playwright install chromium
npm run assets:build
# Keep the dev server running for preview capture.
node --import tsx scripts/render-previews.ts
npm run assets:export
python3 scripts/verify-export.py
```

The export script creates `dist-pack/run-inkline` and the ZIP download. Run `python3 scripts/package-showcase.py` to create a separate showcase source ZIP. That archive excludes installed dependencies and prebuilt downloads. Run `npm run assets:export` after unpacking it to restore the full-pack download.

Each asset leaf has provenance and license notices under the RUN Repository Supplemental License v1.0. The export includes editable sources, runtime code, previews, metadata, and file checksums.

## Performance

The target is 60 FPS at 1280×720 with 20 figures and 10 effects on a high-end Android phone from 2022. The app also has a 100-figure stress scene. **Physical Android performance is not yet verified.** Browser measurements are in `docs/verification/browser-benchmark.json`.

All GLBs use unlit materials. Static district meshes are combined by material. Effects use seven instanced shape pools with a total limit of 2,048 particles. The runtime uses collision proxies rather than the visual meshes.

Read [reuse.md](docs/reuse.md), [pack-content.md](docs/pack-content.md), [art-direction.md](docs/art-direction.md), and [performance.md](docs/performance.md) for the contracts and test limits.

All pack geometry, rigs, animation definitions, effect recipes, and sprite sheets were created for this project. No franchise meshes or textures are included. Keep the supplied license notice with redistributed pack files.

The showcase source and assets are licensed under the RUN Repository Supplemental License v1.0 in `LICENSE.md`. Dependencies retain their own notices.

## Expansion pass history

This pass adds 24 animations, 48 environment objects, and 24 effects. Staffs, shields, daggers, hammers, and swords use separate combat sequences. Scrapper, Heavy, and Striker use moves that match their roles. Camera clearance checks the visible environment geometry.

Read [animation expansion](docs/animation-expansion.md), [environment expansion](docs/environment-expansion.md), [level scenes](docs/environment-layouts.md), and [effect expansion](docs/effects-expansion.md) for the content and checks. Open [the review index](public/review/index.html) for the new video and actual asset captures.


## Kinetic refinement history

Release 1.2 refines 29 existing clips. It adds bounded hit reactions, narrow weapon and limb trails, short shot traces, one-edge attack buffering, and a Reduced motion option. The overview combines combat with a ramp run, jump, landing, and return. Dust uses open strokes with a fade. Camera and weapon visibility tests use a static bounds hierarchy before exact triangle tests. Preview cameras fit the full clip, including raised tools. Staff grips use one authored contact reference across all bodies. Seventeen grounded clips keep foot contact across all 12 bodies. The GLB export samples at 120 Hz to preserve that contact between authored poses. The low-ceiling camera checks its last clear view before it repeats the full search.

Read [the animation notes](docs/kinetic-animation.md), [the Stick Fight study](docs/reference/kinetic-study-stickfight.md), and [the Stickfigurez study](docs/reference/kinetic-study-stickfigurez.md). The Stickfigurez study includes official still images and a short normal-speed gameplay clip. The study separates visible results from internal timing assumptions.

The prior expansion compatibility report applies to that earlier pass. This refinement intentionally changes existing animation tracks. The current motion and contact reports validate the new output.

## Quality correction

Release 1.3 removes the shoulder and hip bars. The twelve bodies share one stick figure construction. The pack has 85 clips per body, including separate forward recovery. The motion pass adds planted support phases, stronger action shapes, matching travel speeds, and corrected secondary actions.

The camera preserves the selected direction through obstruction and resize. Local foreground cutaways keep the player and one nearby reacting target visible. Hit reactions follow the force. Pale figures use a skinned contour. Head size changes use the neck attachment point. Orange prop surfaces have authored geometry clearance. The bow string follows the draw hand and releases at contact. The animation browser selects a matching tool with each clip; the equipment control can replace it.

Read [the style assessment](docs/style-correction.md), [the character contract](docs/character-contract.md), and [the runtime contract](docs/kinetic-runtime.md). Current checks are listed in [the verification index](docs/verification/README.md). Earlier pass reports are historical records.

## Effects and motion pass — 1.4.0

All 64 effects and all 85 clips received a review. Effects use clearer shapes and smaller bursts. Effect scale now changes the whole burst. Selected animations use new poses and shorter timing. The reload hand remains free. Read [the pass notes](docs/effects-motion-polish.md) and the current review page. Read contact times from the new catalog.

## Joint and spine correction — 1.3.1

Release 1.3.1 used continuous elbow, knee, and wrist tubes without separate joint spheres. Routine spine curvature is reduced while body lean, support feet, and action directions remain. Each figure in that release had 1,712 triangles. Read [the correction report](docs/verification/correction/line-refinement.md). That release supplied updated assets for the live demo and all 85 motion-review clips. Earlier full-pack films are labeled as 1.3.0 reference material.

## Combat stance and gun correction — 1.4.1

Punches use less torso lean. Standing kicks place the support foot below the body. Rifle and shotgun stocks meet the arm junction. Recoil starts after the firing event. The shotgun pump and rifle magazine move with the support hand. Weapon fit uses shared data in `src/runtime/firearms.json`. The exported character source includes this file. Clip durations and contact times stay at their 1.4.0 values.

Read [the correction notes](docs/combat-stance.md). The review index links the new motion films and side-view comparisons.

## Foot contact correction — 1.4.2

Standing attacks, reactions, and celebrations now hold both feet on the ground. Kicks keep their support foot fixed. The demo holds position during landing recovery. Read [the contact notes](docs/foot-contact.md). The current review films use the rebuilt character files.

## Block stance correction — 1.4.3

The block stance is shorter. The body is more upright. Both feet stay planted through a smaller weight shift. Read [the block notes](docs/block-stance.md).

## Lower gun hold — 1.4.4

The rifle and shotgun sit at the lower chest in hold and firing poses. Arm contact follows the lower position. The shotgun hand grips the rear of the pump. The rifle magazine uses a shorter withdrawal path. Read [the gun height notes](docs/gun-height.md).

## Uniform joint shape — 1.4.5

This correction replaces blended elbow and knee rings with equal-radius rigid tube sections and round ends. All 12 figures pass the joint-shape and prior motion checks. Each figure has 2,416 triangles and keeps 18 bones. Small floor-contact pose changes are measured separately. Read [the joint shape notes](docs/joint-shape.md) for the required proof and limits.
