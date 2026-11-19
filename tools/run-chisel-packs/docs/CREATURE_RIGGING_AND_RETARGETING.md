# RUN Chisel Packs — Creature Rigging, Skinning & Retargeting Guide

This guide documents the procedural rigging, skin-weighting, CC0 animation retargeting, and automated geometry audit rules for all **7 non-humanoid creature archetypes** in `run-chisel-monsters/3D/characters` (`tools/run-chisel-packs/blender/build_monsters.py`, `creatures_land.py`, `creatures_sky_sea.py`, `retarget.py`, and `contracts/data/*-rig.json`).

---

## 1. The 7 Creature Skeleton Contracts

| Rig ID | Contract File | Joints | Clips | Example Creatures | Grounded Rest Bones |
| :--- | :--- |---:|---:| :--- | :--- |
| `quadruped` | `contracts/data/quadruped-rig.json` | 23 | 16 | `body_dire_wolf`, `body_warhorse` | `leg_fl_paw`, `leg_fr_paw`, `leg_bl_paw`, `leg_br_paw` |
| `arachnid` | `contracts/data/arachnid-rig.json` | 28 | 9 | `body_giant_spider` | 8 leg tips (`leg_1..4_{l,r}_tibia`) |
| `avian` | `contracts/data/avian-rig.json` | 21 | 8 | `body_frost_eagle` | `foot_l`, `foot_r` |
| `dragon` | `contracts/data/dragon-rig.json` | 28 | 11 | `body_ember_drake` | `foreleg_foot_l/r`, `hindleg_foot_l/r` |
| `kaiju` | `contracts/data/kaiju-rig.json` | 22 | 8 | `body_tyrant_rex` | `foot_l`, `foot_r` |
| `serpent` | `contracts/data/serpent-rig.json` | 12 | 7 | `body_basilisk` | `pelvis`, `spine_01..02`, `tail_01..04`, `tail_tip` |
| `aquatic` | `contracts/data/aquatic-rig.json` | 13 | 6 | `body_abyssal_shark` | Hovering (lowest fin at `y ≈ 0.31`) |

Every creature is exported as a single **`body`** slot part in `monsters-parts.glb` (`<= 1,100` triangles total, `1` `Poly_Atlas_Mat`, all 7 palette UV regions used).

---

## 2. Procedural Skinning Rules (`SegmentWeightSolver`)

Creature meshes do **not** transfer weights from a humanoid body; they bind directly through `SegmentWeightSolver`:

1. **Rigid Chunks by Default, 70/30 Socket Blending at High-Flex Joints**:
   - Rigid chunks keep faceted plates crisp without candy-wrapper collapse.
   - At major hip/shoulder/spine/tail sockets (`thigh`/`pelvis`, `upperarm`/`chest`, `spine`/`tail`), assign **70/30 socket weights** so extreme poses (e.g., `Tyrant_Rex` `Tail_Attack`, `Ember_Drake` `Walk` & `Take_Off`) bend cleanly without tearing open the hull.
2. **Minimum Bone Ownership**:
   - Every non-root joint MUST own at least **4 unique vertices** with weight `>= 0.35`, verified automatically in Blender and `validate.ts`.
3. **Strict Bilateral Separation (`|x| > 0.015`)**:
   - Any vertex weighted `>= 0.5` to a `_l` or `_r` bone MUST sit outside `|x| <= 0.015` (and on the matching sign side of `X`).
   - **Never use `Part.mirrored()`** on bone names whose side token sits inside the name (e.g., `leg_fl_upper`, `leg_1_l_coxa`) — `mirror_name()` only swaps `_l` / `_r` suffixes. Always loop over left/right side specs explicitly.
4. **Watertight Joints Under Full Pose Excursion**:
   - Overlap adjacent limb segments inside sockets (`6–15 mm` overlap) and cap open cylinder/prism rings so when joints rock across `Idle`, `Run`, `Attack`, `Roar`, and `Death`, zero hollow interior holes or inverted backfaces appear.

---

## 3. Mesh2Motion CC0 Animation Retargeting (`retarget.py`)

Creature clips are retargeted at build time from CC0 **Mesh2Motion Assets** rigs into the exact contract clip names and durations:

1. **Rest-Pose Delta Compensation**:
   - Map source bone rotation deltas in rest-compensated local coordinates onto the target Chisel bone frames (`('delta', source_bone)`).
   - Never copy raw world Euler angles across differing rest poses.
2. **Level-Foot & Ground Contact Rules**:
   - When a source metatarsal/ankle pitches strongly while source toes stay planted (e.g., dragon walk/stance), follow root/level foot orientation or apply foot clamping so claws do not stab below the ground plane.
   - **Floor Contract (`y >= -0.02`)**: Every vertex across **every keyed frame of every clip** must remain at `y >= -0.02` in glTF space. Grounded `Walk` clips must also touch down (`min y <= 0.018`) so creatures do not float during locomotion.
   - **Wing/Tail Floor Clamp**: Large feathered wing-hands and tail fans (`Frost Eagle` `Death`, `Ember Wyvern` `Take_Off`) clamp vertical pelvis/root drop against downward wing/tail extent so feathers never clip underground.
3. **Seamless Loop & Return-to-Start Discipline**:
   - Attack/roar clips use smooth easing (`keyed()`) back to the rest/idle start frame (`t = 0` and `t = duration`) so crossfades never snap.
   - Gaits pair constant-speed stance phases with clean parabolic swing lift (`stride()`).

---

## 4. Automated Verification & Ragdoll Bounds

Every creature passes three automated verification gates:

1. **Blender Geometry & Pose Gate** (`creatures_land.py`, `creatures_sky_sea.py`, `build_monsters.py`):
   - Triangle count `<= 1,100`, 7 palette regions populated, bilateral side checks, bind ground `y = 0.0` (except `aquatic`), all-clip per-frame vertex floor check (`y >= -0.02`), and ragdoll collider count parity (`22/22` Warhorse, `21/21` Rex, `11/11` Basilisk, `20/20` Eagle, `27/27` Wyvern, `12/12` Shark, with capsule radius capped at `<= 0.24`).
2. **Node GLB Contract Validator (`npm run validate`)**:
   - Validates joint hierarchy parity against `contracts/data/*-rig.json`, unit normals, normalized 4-bone weights, zero NaNs, and S23 Ultra composed budget (`<= 2,200` tris).
3. **Geometry-Accurate Animation Audit (`npm test` -> `src/animationAudit.test.ts`)**:
   - Loads exported GLBs in Node/Three.js, steps every clip frame-by-frame with `AnimationMixer`, checks floor grounding, and asserts zero hard geometric interpenetrations/self-crossings across all 8 creature presets.
