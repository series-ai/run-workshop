# RUN Voxel Characters — Technical Architecture

This pipeline (`tools/run-voxel-characters`) generates **Teardown-style orthogonal voxel characters, modular outfits, held weapons/tools, beasts/bots, and grounded world props** that share the exact **Quaternius UAL1 53-joint CC0 rig & 43 animation clips** plus **23-joint Quadruped** and **28-joint Arachnid** creature rigs, compiled into `jam-ready-assets`-compatible packs targeting **120 Hz on Samsung Galaxy S23 Ultra**.

---

## 1. End-to-End Pipeline

```
Blender 5.1 (--background --factory-startup)
  ├── blender/voxchar.py                Canonical voxel grid, greedy mesher, crevice AO, dual UVs, UAL1/creature GLB builder, ragdoll fitter
  ├── blender/build_core.py             core-rig.glb (53 UAL1 joints, 43 clips, 3 morphable bodies, 6 heads, 6 hairs)
  ├── blender/build_heist.py            heist-pack.glb + held items + heist world props
  ├── blender/build_industrial_security.py  industrial-pack.glb + security-pack.glb + held items + world props
  ├── blender/creature_kit.py           Creature sculpt kit: world lattice, creature space, external-rig bind, quadruped build checks
  └── blender/build_creatures.py        quadruped-rig.glb, arachnid-rig.glb, creatures-pack.glb + world props
         │
         ▼
out/jam-stage/run-voxchar-{core,heist,industrial,security,creatures}/
  ├── 3D/characters/*.glb + License.txt
  └── 3D/<worldTheme>/*.glb + License.txt
         │
         ▼ (npm run build + npm run validate + npm run catalog)
out/meta/manifest.json                  Resolved pack catalogs + ragdoll physics bodies
games/voxel-character-showcase/public/catalog/   Live showcase catalogs & Vite alias @jam-stage
```

---

## 2. Rigid-Segment Voxel Geometry & Greedy Meshing

Unlike smooth low-poly meshes (`tools/run-poly`), orthogonal voxel characters cannot use vertex-blended skinning across soft joints (which bends flat cube faces into diagonal skew triangles) and cannot afford raw unmerged cubes (which blow mobile triangle budgets).

`voxchar.py` solves both in `_greedy_mesh_grid(...)`:

1. **Integer Voxel Grids (`VoxelGrid`)**: Each rigid bone segment (`pelvis`, `spine_02`, `spine_03`, `neck_01`, `Head`, `upperarm_l`, `lowerarm_l`, `hand_l`, `thigh_l`, `calf_l`, `foot_l`, plus mirrored `_r` or custom creature segments) is authored in integer voxel cells (`CHAR_VOX = 0.05 m` for the body, the garments and the head of UAL1 humanoids, from `contracts/data/proportions.json`; `VOX = 0.04 m` for creatures). All humanoid segments use one lattice (`build_core.py`): the T-pose of the default humanoid proportions.
2. **Rigid Segments**: Forearm and calf grids overlap the parent segment by 1 voxel at the joint, while torso grids are centered on `x = 0, z = 0.025`. A torso garment is two pieces that are painted as one box (`TorsoBox`): a trunk on `spine_02` and a shoulder yoke on `spine_03`. Every vertex inside a segment receives weight `1.0` to that single bone — keeping cubes 100% rigid across all 43 UAL1 animations.
3. **Baked Per-Face Crevice AO**: For every exposed face, the mesher samples the 4 diagonal/adjacent neighbor cells in the plane ahead of the face (`occ = 0..4`), quantizing occlusion into `0`, `1`, or `2` darken steps before merging.
4. **2D Greedy Merging**: Faces on each slice plane are merged into maximal coplanar quads that share `(region, quantized_shade_after_ao, mottle_flag)`.
5. **Dual-UV Encoding (`TEXCOORD_0` + `TEXCOORD_1`)**:
   - `TEXCOORD_0`: `(region_u, shade_v)` — `u` selects one of 6 semantic palette bands (`skin`, `hair`, `primary`, `secondary`, `accent`, `metal`), while `v ∈ [0.15, 0.85]` encodes baked shade + crevice AO (`v = 0.96 >= 0.92` marks emissive `accent` voxels such as cybernetic glowing eyes or status LEDs).
   - `TEXCOORD_1`: `(voxel_u + seed, voxel_v + seed)` — preserves the exact `1×1` voxel cell grid across greedy-merged rectangles so the custom WebGL fragment shader (`polyMaterial.ts`) can compute `floor(vVoxelGrid + 0.001)` and apply a crisp ±5.5% per-voxel tonal micro-mottle with zero extra geometry. Setting `mottle=False` writes `(-999, -999)` into `TEXCOORD_1` so eyes, glasses, logos, and emissive optics stay razor-clean.

---

## 3. Skeletal Contracts, Body Morphs & Parametric Proportions

### Rigs (`contracts/rig.ts` & `contracts/data/ual1-rig.json`)
- **Humanoids (`ual1`)**: Byte-exact copy of the 53 Quaternius UAL1 joints, inverse bind matrices, and 43 clips from `assets/source/ual1-base.glb`.
- **Creatures (`quadruped`, `arachnid`)**: 23-joint Quadruped (`quadruped-rig.glb`, 6 procedural clips) and 28-joint Arachnid (`arachnid-rig.glb`, 6 procedural clips) matching the showcase contract (`contracts/rig.ts`).

### Orthogonal Body Morphs (`body_slim` / `body_heavy`)
To support continuous physique blending (`build ∈ [-1, +1]`) without breaking axis-aligned voxel normals, `VoxelPart.to_mesh()` scales each segment's vertex positions along X and Z around that segment's `morph_center` (`DEFAULT_MORPH_SCALES`). Because every face stays orthogonal to X, Y, or Z, normals remain strictly axis-aligned across any blend weight.

### Sculpt Pose (`contracts/humanoidPose.ts`, `voxchar.SculptPose`)
The runtime scales each bone for the proportions of a character. A voxel that is a cube in the bind pose is thus not a cube in the game. The voxel humans are sculpted in the **sculpt pose**: the rest pose of the rig with the default humanoid proportions (`contracts/data/proportions.json` → `humanoid.defaults`).

1. `scripts/build.ts` writes the scale of each UAL1 bone for the default proportions to `out/meta/humanoid-pose.json` (`humanoidSculptPose()` uses `boneScaleFor`, the function of the runtime).
2. `voxchar.SculptPose` computes the position of each joint in the sculpt pose (each child joint moves with the scale of its parent, the soles go on `y = 0`) and maps each sculpted vertex to the bind pose: `bind = bind_joint + (sculpted - posed_joint) / scale`. Morph deltas get the same inverse scale.
3. The runtime applies the scale. The result is the sculpted lattice: each voxel is a `0.05 m` cube.
4. `scripts/validate.ts` skins each humanoid part through the runtime path (`restPoseVertices` in `src/animationAudit.ts`) and stops when a vertex is off the lattice (`assertOnSculptLattice`). Each part records its largest layer pad in `polyLattice` for the tolerance.

### Parametric Proportions (`contracts/proportions.ts`)
Runtime `proportionRig.ts` modifies skeleton inverse bind matrices (`height`, `legRatio`, `build`, `shoulderWidth`, `torsoBulk`, `waistScale`, `headScale`, `limbThickness`, `armLength`, `bodyLength`) without baking duplicate GLBs, keeping composed heads, hands, boots, and held items true-to-scale while grounding feet on `y = 0`.

---

## 4. Modular Layering, Culling & Ragdoll Physics

- **Single-Draw-Call Body Composition (`mergeParts`)**: `composePolyAvatar.ts` + `polyRig.ts` merge `body + head + (optional hair) + torso + legs + (optional headwear) + (optional back)` into a single `SkinnedMesh` buffer bound to the instance skeleton (`1` draw call + `1` shared radial blob shadow + `0..2` held `Mesh` sockets on `hand_r`/`hand_l`).
- **Tag-Based Surface Culling (`polyRegions` / `polyCovers`)**:
  - Parts tag occluded sub-segments (`hair`, `chest`, `legs_waist`, etc.); when an upper layer includes a tag in `polyCovers`, its triangles are stripped during merge so z-fighting never happens under jackets, helmets, or hats.
  - Self-cover is forbidden and enforced by `scripts/validate.ts`.
- **Mesh-Measured Ragdoll Colliders (`contracts/ragdoll.ts`)**: `voxchar.py` measures tight-fitting local capsule bounds (`a`, `b`, `radius`) per ragdoll bone (`measure_ragdoll_colliders`), resolved per composed preset into `meta/manifest.json` and `public/catalog/*/catalog.json`. The voxel humans use a dense probe of the surface voxel lattice (`build_core.collider_probe`). The trunk of a torso garment is one rigid box, but its rows fit the pelvis, the waist and the chest colliders of the body (`torso_anatomy_bone`).

---

## 5. Validation & Mobile Budgets (`contracts/data/budgets.json`)

`npm run validate` enforces every contract automatically before catalogs ship:
- Orthogonal normals check on every vertex (`|max_axis - 1| <= 0.02`, zero diagonal normals).
- `1` primitive / `1` material per mesh (`<= 2,200` triangles per composed avatar with held tools).
- `TEXCOORD_0` and `TEXCOORD_1` present and finite; bone weights normalized (`sum == 1.0`).
- Canonical held-socket palm clearance (`hand_r`: `minX >= -0.032`) and grip orientation in actual UAL1 animations (`assertHeldPresetClips`).
- Sculpt lattice of the voxel humans (`assertOnSculptLattice`): in the default pose each vertex is on the half lattice of `humanoid.voxelSize`, within the layer pad of its part.
- Teardown silhouette ratios of the voxel humans, measured on the built meshes in the sculpt pose (`assertSilhouetteContract`): skin face width / chest width, head height / face width, hair or headwear width / chest width (the head envelope), neck width / face width, bare arm thickness / chest width, calf / thigh width, flush-back heel alignment, shoe length, and sole toe step. The limits are in `contracts/data/proportions.json`.
- Dark-albedo floor of the garment colors of each preset palette (`garmentRegionsBelowDarkFloor`, `MIN_GARMENT_LUMINANCE` in `contracts/palette.ts`).
- Rigid segments on each part: one joint with weight `1.0` for each vertex (`firstNonRigidVertex`).
- Creature checks on the built file (`src/creatureAudit.ts`, also `npm run validate:creature` for a creature on an external rig): the world lattice and the axis-aligned normals in the skinned rest pose, feet on `y = 0`, the quadruped silhouette of `quadruped.silhouette` (chest, waist, head, `2 x 2` lower legs, paw toe step, one-cell shoulder and haunch steps), the dark-albedo floor of each mottled palette region, and for each clip the scale and the shear of the bones (`<= 2%`) and the gap between a segment and the segment that holds it (`<= 1` voxel). `blender/creature_kit.py` checks the same contract on the voxel cells at build time (`QuadrupedAudit`).
- Creature X-side joint binding (`assertCreatureLegSides`), grounded props (`min.y == 0`), and full animation clip audit (`animationAudit.ts`) verifying zero `NaN` vertices and no floor penetration across `A_TPose`, preset clips, and creature gaits.
