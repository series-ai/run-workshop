# RUN Voxel Characters — Technical Architecture

This pipeline (`tools/run-voxel-characters`) generates **canonical 5 cm orthogonal voxel characters, modular outfits, snug half-voxel headwear, held weapons/tools/shields, bipedal monsters, rigid-segment beasts/bots, and grounded world props** that share the exact **Quaternius UAL1 53-joint CC0 rig & 43 animation clips** plus **23-joint Quadruped**, **28-joint Arachnid**, and **7 external animal rigs**, compiled into `jam-ready-assets`-compatible packs targeting **120 Hz on Samsung Galaxy S23 Ultra**.

---

## 1. End-to-End Pipeline

```
Blender 5.1 (--background --factory-startup)
  ├── blender/voxchar.py                   Canonical voxel grid, greedy mesher, baked crevice/overhang AO, dual UVs, UAL1/creature GLB builder, ragdoll fitter
  ├── blender/build_core.py                core-rig.glb (53 UAL1 joints, 43 clips, 3 morphable bodies, 6 heads, 6 hairs) + shared lattice & limb helpers
  ├── blender/build_heist.py               heist-pack.glb + held items + heist world props
  ├── blender/build_industrial_security.py industrial-pack.glb + security-pack.glb + held items + world props
  ├── blender/creature_kit.py              Creature sculpt kit: world lattice, creature space, external-rig bind, quadruped build checks
  ├── blender/build_animals.py             7 external animal rigs (fox, horse, wolf, corgi, pug, German shepherd, cat) at matched real-world rig_scale tiers
  ├── blender/build_creatures.py           quadruped-rig.glb, arachnid-rig.glb, scrap-bot.glb, animal GLBs + creature world props
  ├── blender/build_orcs_trolls.py         Bipedal monster bodies (Orc Raider/Warboss, Moss/Cave Troll) + cleaver, club & tower shield
  └── blender/build_fantasy.py             fantasy-pack.glb (knight armor, sallet, greathelm, cape + monsters) + held weapons/shields + medieval props
         │
         ▼
out/jam-stage/run-cubix-{core,heist,industrial,security,creatures,fantasy}/
  ├── 3D/characters/*.glb + License.txt
  └── 3D/<worldTheme>/*.glb + License.txt
         │
         ▼ (npm run build + npm run validate + npm run catalog)
out/meta/manifest.json                     Resolved pack catalogs + ragdoll physics bodies
games/voxel-character-showcase/public/catalog/   Metadata-only showcase catalogs (zero GLBs bundled)
         │
         ├── dev / build:local ──► vite localJamAssets() serves /jam/<leafId>/<path> from out/jam-stage/ or ~/dev/jam-ready-assets
         └── production build ───► npm run stage -> JRA PR -> GCS mirror -> src/pins.ts -> RundotGameAPI.assetLibrary.getPackBaseUrl()
```

> **Expanding packs (`jam-ready-assets`)**: Whenever new assets or packs are added here, stage them to `series-ai/jam-ready-assets` (`npm run stage -- --target <jra-checkout>`), update `preview-sources.json` + `preview.webp`, merge the JRA PR so GCS mirrors them, and update `games/voxel-character-showcase/src/pins.ts` with the new 12-char leaf version hashes.

---

## 2. Rigid-Segment Voxel Geometry & Zero-Texture Shading

Unlike smooth low-poly meshes (`tools/run-poly`), orthogonal voxel characters cannot use vertex-blended skinning across soft joints (which bends flat cube faces into diagonal skew triangles), cannot afford raw unmerged cubes (which blow mobile triangle budgets), and ship **zero bitmap textures** on any GLB.

`voxchar.py` + `polyMaterial.ts` solve geometry, shading, and texture-free surface variation in `_greedy_mesh_grid(...)`:

1. **Multi-Tier Integer Voxel Grids (`VoxelGrid`)**: Each rigid bone segment (`pelvis`, `spine_02`, `spine_03`, `neck_01`, `Head`, `upperarm_l`, `lowerarm_l`, `hand_l`, `thigh_l`, `calf_l`, `foot_l`, plus mirrored `_r` or custom creature segments) is authored in integer voxel cells at the tier matching its asset class:
   - **`CHAR_VOX = 0.05 m`**: Humanoid bodies, outfits, heads, hair, bipedal monsters, world props (`PROP_VOX`), and oversized two-handed tools (`held_sledgehammer`).
   - **`HAT_VOX = 0.025 m`**: Snug humanoid headwear (`CHAR_VOX / 2`, `origin_world=(0, 0, 0)`, `center_*=False`) so caps, beanies, and visored helmets hug the `15 × 25 × 20 cm` skull cleanly.
   - **`HELD_VOX = 0.026–0.028 m`**: Detailed held weapons, tools, and forearm-mounted shields.
   - **Creature tiers (`VOX = 0.04 m` / `rig_scale`)**: Large mounts `0.05 m` (horse), medium/large beasts `0.04 m` (guard hound, wolf, shepherd, spider, scrap-bot), small wild canids `0.03 m` (fox), small pets `0.02 m` (corgi, pug, cat).
2. **Rigid Segments & Torso Split**: Forearm and calf grids overlap the parent segment by 1 voxel at the joint, while torso grids are centered on `x = 0, z = 0.025`. A humanoid torso garment is two pieces painted as one box (`TorsoBox`): a trunk on `spine_02` and a shoulder yoke on `spine_03`. Every vertex inside a segment receives weight `1.0` to a single bone — keeping cubes 100% rigid across all 43 UAL1 clips and creature gaits.
3. **Baked Per-Face Crevice & Overhang AO**: For every exposed face, the mesher samples adjacent (`×2`) and diagonal (`×1`) neighbors in the plane ahead of the face, adds `+2` darken steps for downward `-Y` underside faces, and adds `+2` overhang darken steps directly below brows, brims, collars, and plates (`bake_ao=True`). `scripts/validate.ts` rejects `bake_ao=False` on all non-`creatures` avatar parts, all bipedal monsters, all held items, and all props.
4. **2D Greedy Merging & Edge-Safe Layer Padding**: Coplanar faces sharing `(region, quantized_shade_after_ao, mottle_flag)` are merged into maximal quads. Each padded quad expands in-plane by `layer_pad` **only along edges with no adjacent quad on that plane**, preventing neighboring `mottle=False` feature quads (eyes, badges) from overlapping and z-fighting.
5. **Dual-UV Encoding (`TEXCOORD_0` + `TEXCOORD_1`)**:
   - `TEXCOORD_0`: `(region_u, shade_v)` — `u` selects one of **10 semantic palette bands** (`skin`, `hair`, `primary`, `secondary`, `accent`, `metal`, `trim`, `leather`, `visor`, `detail`), while `v ∈ [0.15, 0.85]` encodes 17 levels of quantized shade + baked AO (`v = 0.96 >= 0.92` marks emissive `accent` voxels such as cybernetic eyes, forge ingots, or status LEDs).
   - `TEXCOORD_1`: `(voxel_u + seed_u, voxel_v + seed_v)` — preserves the exact `1×1` voxel cell grid across greedy-merged rectangles so the custom WebGL fragment shader (`polyMaterial.ts`) computes `floor(vVoxelGrid + 0.001)` and applies per-cell tonal + subtle hue micro-mottle (`±6%` cloth/hair/wood, `±4.8%` skin mosaic with warm/cool hue jitter, `2×` gain below `darkFloorLuma`) plus per-region PBR roughness/metalness (`metal` `0.26 / 0.48`, `visor` `0.16 / 0.12`, `leather` `0.46 / 0.06`, cloth/trim/detail `0.82 / 0.0`, `hair` `0.78 / 0.0`, `skin` `0.86 / 0.0` with rosy/brown shadow ramp). Setting `mottle=False` writes `(-999, -999)` into `TEXCOORD_1` so eyes, visors, heraldry, teeth/tusks, and badges remain crisp.

---

## 3. Skeletal Contracts, Body Morphs & Parametric Proportions

### Rigs (`contracts/rig.ts` & `contracts/data/ual1-rig.json`)
- **Humanoids & Bipedal Monsters (`ual1`)**: Byte-exact copy of the 53 Quaternius UAL1 joints, inverse bind matrices, and 43 clips from `assets/source/ual1-base.glb`.
- **Creatures (`quadruped`, `arachnid`, and external animal rigs)**: 23-joint Quadruped (`quadruped-rig.glb`, 6 procedural clips), 28-joint Arachnid (`arachnid-rig.glb`, 6 procedural clips), plus 7 external CC0/RUN animal rigs (`fox`, `horse`, `wolf`, `corgi`, `pug`, `gsd`, `cat`) normalized into real-world metres via `rig_scale`.

### Orthogonal Body Morphs (`body_slim` / `body_heavy`)
To support continuous physique blending (`build ∈ [-1, +1]`) without breaking axis-aligned voxel normals, `VoxelPart.to_mesh()` scales each segment's vertex positions along X and Z around that segment's `morph_center` (`DEFAULT_MORPH_SCALES`). Because every face stays orthogonal to X, Y, or Z, normals remain strictly axis-aligned across any blend weight.

### Sculpt Pose (`contracts/humanoidPose.ts`, `voxchar.SculptPose`)
The runtime scales each bone for the proportions of a character. A voxel that is a cube in the bind pose is therefore not a cube in the game. Voxel humans and UAL1 monsters are sculpted in the **sculpt pose**: the rest pose of the rig with the default humanoid proportions (`contracts/data/proportions.json` → `humanoid.defaults`).

1. `scripts/build.ts` writes the scale of each UAL1 bone for the default proportions to `out/meta/humanoid-pose.json` (`humanoidSculptPose()` uses `boneScaleFor`, the same function used by the runtime).
2. `voxchar.SculptPose` computes the position of each joint in the sculpt pose (each child joint moves with the scale of its parent, soles sit on `y = 0`) and maps each sculpted vertex to the bind pose: `bind = bind_joint + (sculpted - posed_joint) / scale`. Morph deltas get the same inverse scale.
3. The runtime applies the scale, producing exact `0.05 m` cubes on one lattice (`0.025 m` on headwear).
4. `scripts/validate.ts` skins each part through the runtime path (`restPoseVertices` in `src/animationAudit.ts`) and rejects any vertex off the lattice (`assertOnSculptLattice`), using `polyLattice.maxPad` as the pad tolerance.

### Parametric Proportions (`contracts/proportions.ts`)
Runtime `proportionRig.ts` modifies skeleton inverse bind matrices (`height`, `legRatio`, `build`, `shoulderWidth`, `torsoBulk`, `waistScale`, `headScale`, `limbThickness`, `armLength`, `bodyLength`) without baking duplicate GLBs, keeping composed heads, hands, boots, and held items true-to-scale while grounding feet on `y = 0`. Note that `clavicle.x` scales much faster with `shoulderWidth` than `spine_03.x`, and `upperSpineY` absorbs low `legRatio` at high `height` — see `docs/art-direction.md` section 11 when tuning monster proportions.

---

## 4. Modular Layering, Held Sockets & Ragdoll Physics

- **Single-Draw-Call Body Composition (`mergeParts`)**: `composePolyAvatar.ts` + `polyRig.ts` merge `body + head + (optional hair) + torso + legs + (optional headwear) + (optional back)` into a single `SkinnedMesh` buffer bound to the instance skeleton (`1` draw call + `1` shared `64×64` radial blob shadow + `0..2` held `Mesh` sockets on `hand_r`/`hand_l`).
- **Held Grip Styles (`handle` vs `forearm_shield`)**:
  - `handle` (default): weapon/tool shaft along `+Y` with grip channel at `(0, 0, 0)`, obeying palm-back clearance (`minX >= -0.032 m` on `hand_r`, `maxX <= +0.032 m` on `hand_l`).
  - `forearm_shield` (`hand_l` only): shield face mounts flat on the outer left forearm (`+X_held >= 0.098 m`, `maxX >= 0.115 m`, `minX >= -0.05 m`) with a fist bar at `(0, 0, 0)` and an open leather arm-strap near `-Z_held <= -0.14 m`. `PolyAvatar.tsx` shifts forearm shields outward along `+X` when `limbThickness` or `body_heavy` widens the forearm.
- **Tag-Based Surface Culling (`polyRegions` / `polyCovers`)**:
  - Parts tag occluded sub-segments (`hair`, `chest`, `hips`, `legs_upper`, `hands`, etc.); when an outer layer includes a tag in `polyCovers`, covered triangles are stripped during merge so z-fighting never happens under jackets, armor, helmets, or hats.
  - Self-cover is forbidden and enforced by `scripts/validate.ts`.
- **Mesh-Measured Ragdoll Colliders (`contracts/ragdoll.ts`)**: `voxchar.py` measures tight-fitting local capsule bounds (`a`, `b`, `radius`) per ragdoll bone (`measure_ragdoll_colliders`), resolved per composed preset into `meta/manifest.json` and `public/catalog/*/catalog.json`. Humanoid parts use a dense surface lattice probe (`build_core.collider_probe`), mapping `spine_02` garment rows onto pelvis, waist, and chest capsules (`torso_anatomy_bone`).

---

## 5. Validation & Mobile Budgets (`contracts/data/budgets.json`)

`npm run validate` enforces every contract automatically before catalogs ship:
- Orthogonal normals check on every vertex (`|max_axis - 1| <= 0.02`, zero diagonal normals).
- `1` primitive / `1` material (`VoxChar_Atlas_Mat`) per mesh (`<= 2,200` triangles per composed avatar with held items).
- `TEXCOORD_0` and `TEXCOORD_1` present and finite; bone weights normalized (`sum == 1.0`) and strictly rigid (`firstNonRigidVertex`).
- Baked AO enforced (`assertBakedAo`) on all non-`creatures` avatar parts, all bipedal monsters, all held items, and all props.
- Canonical held-socket clearance (`handle` palm clearance + `forearm_shield` outer-forearm & strap geometry) and closed-hand grip orientation across all frames of each preset's clip (`assertHeldPresetClips`, plus `>= 0.25 m` separation on dual-wielding presets).
- Sculpt lattice of UAL1 parts (`assertOnSculptLattice`): in the sculpt pose each vertex lies on the half lattice of `humanoid.voxelSize` (`0.025 m` step), within the part's `polyLattice.maxPad`.
- Canonical silhouette ratios of the voxel humans (`assertSilhouetteContract` in `contracts/data/proportions.json`): skin face width / chest width, head height / face width, hair width / chest width, headwear width / chest width & `maxHeadwearHeight`, neck width / face width, bare arm thickness / chest width, calf / thigh width, flush-back heel alignment, shoe length, and sole toe step.
- Bipedal monster contract (`assertBipedalMonsterContract`): `maxWaistToChestWidth <= 0.82`, `minHeadDepthMeters >= 0.24 m`, `minHeadForwardOffset >= 0.025 m`, `minFootLengthMeters >= 0.22 m`, and `requireBakedAo = true`.
- Prop craft contract (`assertPropCraft`): grounded on `y = 0` (`|min.y| <= 0.015 m`), centered on X/Z, `minHeightMeters >= 0.20 m`, and `minUniqueShades >= 3`.
- Dark-albedo floor on garment colors (`garmentRegionsBelowDarkFloor`, `MIN_GARMENT_LUMINANCE = 0.03` in `contracts/palette.ts`).
- Creature checks (`src/creatureAudit.ts` and `npm run validate:creature`): world lattice, axis-aligned normals in skinned rest pose, feet on `y = 0`, `quadruped.silhouette`, dark-albedo floor on every mottled palette region, bone scale/shear `<= 2%`, and segment gap `<= 1` voxel across every clip. `blender/creature_kit.py` checks the same contract on voxel cells at build time (`QuadrupedAudit`).
- Creature X-side joint binding (`assertCreatureLegSides`) and full animation clip audit (`animationAudit.ts`) verifying zero `NaN` vertices, zero ragdoll self-collisions, and no floor penetration across `A_TPose`, preset clips, and creature gaits.
