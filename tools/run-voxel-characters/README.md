# RUN Cubix (`tools/run-voxel-characters`)

Canonical **5 cm orthogonal voxel character, outfit, weapon/tool, beast/monster, and world prop generator** built on the shared **53-joint Quaternius UAL1 CC0 skeleton (43 clips)** plus **23-joint Quadruped**, **28-joint Arachnid**, and **7 external animal rigs**, packaged for `jam-ready-assets` and **120 Hz on Samsung Galaxy S23 Ultra**.

---

## Quick Start

```bash
cd tools/run-voxel-characters
npm install
npm run build        # Build all 6 packs (29 presets) via Blender 5.1 -> out/jam-stage/ + out/meta/
npm run validate     # Verify orthogonal normals, budgets, sculpt lattice, silhouette, UV0/UV1, AO, morphs, ragdolls & clip audits
npm run validate:creature -- <creature.glb>   # Check a creature that blender/creature_kit.py wrote on an external rig
npm run catalog      # Export catalogs to games/voxel-character-showcase/public/catalog/
npm run typecheck && npm test
```

Launch the interactive 3D showcase (`http://localhost:5195`):

```bash
cd ../../games/voxel-character-showcase
npm install && npm run dev
```

Or run automated headless Playwright + WebGL visual verification (saves PNGs to `out/previews/`):

```bash
node tools/run-voxel-characters/scripts/verify-visual.mjs
# If port 5199 is already occupied:
VERIFY_PORT=5211 node tools/run-voxel-characters/scripts/verify-visual.mjs
```

## Level kit exports

`npm run build` writes `out/cubix-level-kits.zip`. Each world has a `demo.glb` scene and a `demo.voxels.json` file with the occupied cells, materials, and placements. The same pair is in `level-kit/` in each staged pack leaf. Each world also has an instanced scene, actor and equipment files, and `level-kit/gameplay.json`. The gameplay file contains interaction points and routes. See the [gameplay board guide](docs/gameplay-boards.md) and [voxel file format](docs/level-voxel-format.md).

The build verifies the voxel round trip before it replaces the ZIP. To check an existing archive, run this command.

```bash
blender --background --factory-startup --python-exit-code 1 --python blender/verify_level_voxels.py -- --archive out/cubix-level-kits.zip
```

---

## Expanding Packs & Publishing to `jam-ready-assets`

Whenever you add new characters, outfits, gear, creatures, props, or packs—or revise existing assets—**publish the updated assets to `series-ai/jam-ready-assets`** so RUN apps (including `games/voxel-character-showcase`) load them through the RUN SDK asset library rather than keeping local copies:

1. **Rebuild, validate, visually verify, and export catalogs** in `tools/run-voxel-characters`:
   ```bash
   npm run build && npm run validate && npm run catalog && npm test
   VERIFY_PORT=5211 node scripts/verify-visual.mjs
   ```
2. **Stage directly into a `jam-ready-assets` branch/worktree**:
   ```bash
   npm run stage -- --target <jam-ready-assets checkout>
   ```
   Each pack sits at the JRA repo root as `run-cubix-<slug>/3D/<theme>/` (never inside a wrapper folder), with its `.glb` files and `License.txt`.
3. **Update square thumbnails (`preview.webp` + `preview-sources.json`) and run JRA CI checks** inside `<jam-ready-assets checkout>`:
   - Ensure every new or modified leaf has an entry in `preview-sources.json`, a generated square `512×512` `preview.webp`, and updated `README.md` credits/counts if adding a new pack.
   - Run:
     ```bash
     npm run previews:generate && npm run previews:check
     npm test
     SKIP_PUBLISHED_CHECK=1 node scripts/build-manifest.mjs
     node scripts/check-visual-assets.mjs
     node scripts/check-keywords.mjs origin/main
     ```
4. **Open a PR on `series-ai/jam-ready-assets` and wait for merge + GCS mirror**.
5. **Pin the published 12-character leaf hashes** from JRA's published `manifest/v2/index.json` into [`games/voxel-character-showcase/src/pins.ts`](../../games/voxel-character-showcase/src/pins.ts), then run `npm run build` in `games/voxel-character-showcase` (`requirePins()` verifies every leaf pin before production builds succeed).

---

## Packs Generated (`out/jam-stage/`)

6 packs · **29 presets** · 62 modular avatar parts · 14 held items · 13 grounded world props:

| Pack Directory | Context | Key Contents |
|---|---|---|
| `run-cubix-core` | Core UAL1 Rig & Bodies (CC0-1.0) | 53-joint UAL1 skeleton + 43 clips, `body_slim`/`body_athletic`/`body_heavy`, 6 sculpted `3×5×4` heads, 6 layered voxel hairstyles (`5×7` head envelope), 3 starter presets |
| `run-cubix-heist` | Heist & Demolition | Sledgehammer hero tee & jeans, belted tunic & scout hat, open jacket & scarf, tattoo scout vest & shorts, backpack, detonators, crowbar, rubble/vault props (4 presets) |
| `run-cubix-industrial` | Workshop & Industrial | Weathered handyman shirt w/ work gloves & waist pack, mechanic apron, cargo pants, knit beanie, welding cap, hard hat, pipe wrench, blowtorch, chest & drum props (3 presets) |
| `run-cubix-security` | Security & Cyber-Tech | Collared guard uniform w/ utility belt & peaked cap, tactical knee-pad trousers, cyber-enforcer harness w/ glowing emissive visor, forearm riot shield, helmet, pistol, terminal props (3 presets) |
| `run-cubix-creatures` | Voxel Beasts & Bots | Guard Hound (`quadruped` 23-joint rig), Scrap Spider (`arachnid` 28-joint rig), Demolition Scrap-Bot (`ual1`), 7 external animal rigs (Fox, Horse, Wolf, Corgi, Pug, German Shepherd, Cat), kennel & beacon props (10 presets) |
| `run-cubix-fantasy` | Fantasy & Medieval | Royal Vanguard & Iron Templar knights (plate harness, surcoat, greaves, sallet, greathelm, cape, broadsword, war hammer, forearm heater shield) + Orc Raider, Orc Warboss, Moss Troll, Cave Troll (cleaver, crag club, tower shield) + medieval props (6 presets) |

---

## Documentation

- [`docs/art-direction.md`](file:///Users/pany/.t3/worktrees/run-workshop/t3-50caaa3c-814705892dd61b3d/tools/run-voxel-characters/docs/art-direction.md) — Canonical scale (`CHAR_VOX = 0.05 m`), all voxel density tiers (`0.025 m` headwear, `0.026–0.028 m` held gear, `0.02–0.05 m` creature `rig_scale` tiers), the sculpt lattice, segment dimensions, face maps, C-claw hand geometry, 1-voxel garment relief, 10-region zero-texture PBR shader & baked AO, creature/monster/prop rules, and the **Squint Test** visual standard.
- [`docs/architecture.md`](file:///Users/pany/.t3/worktrees/run-workshop/t3-50caaa3c-814705892dd61b3d/tools/run-voxel-characters/docs/architecture.md) — End-to-end Blender-to-WebGL pipeline, rigid-segment greedy mesher, `TEXCOORD_0`/`TEXCOORD_1` shader encoding, orthogonal morphs, `SculptPose`, ragdoll fitter, `jam-ready-assets` staging/pinning, and S23 Ultra performance & validation contracts.
- [`blender/creature_kit.py`](file:///Users/pany/.t3/worktrees/run-workshop/t3-50caaa3c-814705892dd61b3d/tools/run-voxel-characters/blender/creature_kit.py) — Creature kit: one world lattice, one authoring space (`+Z` forward, also for `+X` rigs), the `inverse(W_j @ IBM_j)` bind for external glTF rigs, and build-time quadruped checks.
- [`docs/AUTHORING_GUIDE.md`](file:///Users/pany/.t3/worktrees/run-workshop/t3-50caaa3c-814705892dd61b3d/tools/run-voxel-characters/docs/AUTHORING_GUIDE.md) — Step-by-step Python recipes using `voxchar.py`, `build_core.py`, and `creature_kit.py` plus the `jam-ready-assets` release flow so any LLM or artist can author and ship matching humans, headwear, outfits, forearm shields, bipedal monsters, creatures, and props.

## Level kits

Run `npm run build` and `npm run catalog`. The **Level Kits** tab of the local
showcase opens a demo for each pack. Use **Viewpoint** to check the route.
Select a model to see it alone and check its dimensions. See the [level kit art guide](docs/art-direction.md#level-kits)
for the grid, pivots, and scene layouts.

Find the individual GLBs in each staged world leaf's `level-kit/` folder.
The Core world leaf is `run-cubix-core/3D/prototype-blocks`. It uses
the CC0 license. Keep the leaf license with any copies. Find the complete
scenes in `out/level-demos/`. Each scene uses the same models and transforms
as the showcase. The GLBs include vertex colors for use with a standard
glTF material.

Publish the updated leaves and update the showcase pins before releasing a
production build that uses the new models.

See the [level reference study](docs/level-reference-study.md) for the six
comparisons and the changes to routes, surfaces, and materials.

### Vehicles

The level demos use parked vehicle meshes. Select a vehicle in **Level Kits**
and use **Vehicle motion** to play a clip or return to the parked pose.

Use the animated GLBs in the same leaf's `vehicles/` directory in a game.
Each GLB has an unskinned `vehicle_root` at ground level. +Z is forward and
+Y is up. The root stores `wheelRadiusMeters`. Rotate each `*_spin` child
around local X. Turn the steering parents around local Y. The forklift steers
at the rear. The market wagon turns the entire front axle.

The **Drive** clip spins the wheels in place. Move `vehicle_root` with your
game's controller. For a rolling wheel, use distance in meters divided by
wheel radius as its rotation in radians. The steering and equipment clips
use separate pivots. The crane has a turntable, trolley, cable, and hook.
The forklift has a fork carriage. The rover has a roof scanner.

The utility pickup and ranger truck also have a named `tailgate` pivot and
a **Lower Tailgate** clip. The utility pickup also has a **Roll and brake**
preview. It moves the `vehicle_travel` pivot about 1 m forward, stops, then
returns to the parked pose. The clip leaves `vehicle_root` available to
the game controller.

The vehicle bodies use 10 cm voxels. The driven wheel meshes use 5 cm voxels.
The moving GLBs use vertex colors and baked voxel occlusion. Paint, rubber,
metal, glass, wood, and lamp lenses use separate glTF materials. A rigid
part can contain more than one surface material and still has one pivot.

Road and industrial vehicles have named lamp nodes and separate lens meshes.
Use **Vehicle lights** to see them in the showcase. The GLBs use
`KHR_lights_punctual` spotlights with an intensity of zero at rest. Read
`intensityOn` from each lamp node's extras to turn on that lamp. The lens with
the matching name ends in `_lens`. Its `emissiveOn` value gives the linear
RGB emission for that lens. Clone the lens material per vehicle instance to
change it independently. The market wagon has wood and metal surfaces.

`npm run validate` checks the exported GLBs with a standard glTF loader.
It checks wheel pivots, clip motion, parked poses, and lamp mounts.

### Gameplay boards

The six original worlds and the four standalone boards export mesh scenes,
raw voxels, and stable IDs for points, routes, equipment, actors, and vehicles.
See the [gameplay board guide](docs/gameplay-boards.md) for builds and engine import.
