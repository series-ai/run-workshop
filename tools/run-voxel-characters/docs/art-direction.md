# Canonical Voxel Character Art Direction

This document is the visual and geometric specification of **RUN Voxel Characters**
(`tools/run-voxel-characters`). The target look is chunky, legible orthogonal voxel art: large cubes
of consistent scale per asset tier, a long and deep face, a wide head envelope formed by hair or
snug headwear, a crisp boxy torso, sturdy limbs, a warm voxel mosaic on skin, and readable `1 × 1`
facets even on dark cloth. All presets run on a Samsung Galaxy S23 Ultra at 120 Hz (`<= 2,200`
triangles and `1` to `3` draw calls per character).

The rules below codify every lesson from the v5–v14 humanoid passes, the 7-animal creature pass,
and the fantasy knights / bipedal monsters / headwear / shield passes. Each rule states the
canonical value, the failure mode it prevents, and the file that enforces it.

## Where each rule lives

| Rule | Source of truth | Automatic check |
| --- | --- | --- |
| Voxel size of humans & headwear | `contracts/data/proportions.json` → `humanoid.voxelSize`, `headwearVoxelSize` | `npm run validate` (sculpt lattice), `contracts.test.ts` |
| Default proportions (the sculpt pose) | `contracts/data/proportions.json` → `humanoid.defaults` | Build (`load_pose`), `npm run validate` (sculpt lattice) |
| Lattice rows, columns, and depth cells | `blender/build_core.py` (constants at the top) | Build fails on a bad face map or a pivot off the lattice |
| Silhouette ratios (head, headwear, torso, limbs, shoes) | `contracts/data/proportions.json` → `humanoid.silhouette` | `npm run validate` measures the built meshes |
| Bipedal monster silhouette & baked AO | `contracts/data/proportions.json` → `bipedalMonster` | `npm run validate` (`assertBipedalMonsterContract`, `assertBakedAo`) |
| World prop craft & grounding | `contracts/data/proportions.json` → `prop` | `npm run validate` (`assertPropCraft`, `min.y == 0`) |
| Dark-albedo floor of garments | `contracts/palette.ts` → `MIN_GARMENT_LUMINANCE` | `npm run validate`, `contracts.test.ts` |
| Triangle budgets & draw calls | `contracts/data/budgets.json` | Build and `npm run validate` |
| 10-region PBR, skin ramp, mottle, dark floor in shader | `games/voxel-character-showcase/src/avatar/polyMaterial.ts` → `LOOK` | Visual inspection + **Squint Test** (section 9) |
| Quadruped silhouette (chest, waist, head, legs, paws, brow) | `contracts/data/proportions.json` → `quadruped.silhouette` | Build (`creature_kit.QuadrupedAudit`), `npm run validate`, `npm run validate:creature` |
| Creature motion (cubes stay cubes, segments stay together) | `contracts/data/proportions.json` → `creature.motion` | `npm run validate`, `npm run validate:creature` (`src/creatureAudit.ts`) |
| Creature lattice, authoring space, real-world `rig_scale`, bind | `blender/creature_kit.py` | Build, `npm run validate`, `npm run validate:creature` |

---

## 1. Canonical humanoid values & solved defects

Canonical proportions match a `1.90 m`–`1.95 m` tall character built from `0.05 m` cubes (`38–39`
voxels tall):

| Part | Canonical (voxels) | v5 (rejected) | Current standard |
| --- | --- | --- | --- |
| Height with hair | `38–39` | `56` (`2.01 m` at `0.036 m`) | `38–39` (`1.90–1.95 m` at `0.05 m`) |
| Skin skull (W × H × D) | `3 × 5 × 4` | `7 × 8 × 5` | `3 × 5 × 4` |
| Head envelope with hair (width × height) | `5 × 7` | `9 × 10` | `5 × 7` |
| Eye | `1 × 1` | `2 × 1` | `1 × 1` |
| Chest (width × depth) | `7 × 3` | `9 × 4` | `7 × 3` |
| Shirt rows, belt rows | `10`, `1` | `13` to `14` (stretched voxels) | `10`, `1` |
| Bare arm section | `2 × 2` | `3 × 3` | `2 × 2` |
| Thigh section, calf section | `3 × 3`, `2 × 2` bare / `3 × 2` trousers | `4 × 4`, `4 × 4` | `3 × 3`, `2 × 2` bare / `3 × 2` trousers |
| Leg rows, shoe rows | `17`, `2` | `28`, `4` | `17`, `2` |
| Shoe footprint (width × length) | `2–3 × (3 + 1)` flush at calf back | `4 × 5` | `2` bare / `3` trousers × `(3 + 1)` flush |

Historical defects that these rules permanently prevent:

- **Wide, square faces (v5)**: `25.2 × 28.8 cm` (H/W `1.14`) looked squat. Canonical faces are `3`
  columns wide and `5` rows tall (`15 × 25 cm`, H/W `1.67`).
- **Over-dense meshes (v5)**: `7`-wide faces and `9`-wide chests broke the chunky silhouette. Canonical
  faces are `3` columns and chests are `7` columns.
- **Stretched bind-pose cubes (v5)**: Sculpting in the unscaled bind pose caused runtime proportions to
  squash chest voxels (`3.9 × 4.7 cm`) and leg voxels (`3.6 × 3.1 cm`). Sculpting in `SculptPose` keeps
  runtime voxels exact cubes.
- **Spindly trouser calves & backward-protruding heels (v6)**: `FOOT_Z = (-2, 0)` stuck out `5 cm` behind
  `CALF_BACK = -1`, and `2 × 2` trouser calves looked thin under `3 × 3` thighs. Trouser/boot calves are
  `3 × 2` (`TROUSER_CALF_X`), and every shoe sits flush at `z = -1` (`3`-long upper + `1`-long sole toe).
- **Pancake skulls vs tall heads (v8–v10)**: `3`-deep heads lacked chins, while `3 × 6` faces looked
  stretched. Keeping `3 × 5` face height with `4`-deep skulls (`HEAD_Z = (-1, 2)`, `2` cheek columns
  ahead of `HEAD_EAR_Z = 0`) paired with a `2 × 2` neck (`NECK_Z = (-1, 0)`) gives a **`1`-block forward
  head offset** and a crisp **`2`-voxel (`10 cm`) chin overhang** without elongating the face.
- **Heads floating on flat shirts (v13)**: Anchoring `NECK_Y = (28, 32)` `2` blocks into `spine_03`,
  setting `HEAD_Y_OFFSET = 0.0`, carving a `1`-block front neckline socket (`open_neck=True` at
  `SHOULDER_Y = 29, z = 1`), and building full `1`-block collars on `COLLAR_Y = 30` seats the neck cleanly.

---

## 2. Scale, voxel density tiers, and lattice

### Voxel density tiers across all assets

Choose the voxel tier strictly by asset class and real-world scale against a `1.90 m` (`0.05 m` voxel)
human:

| Asset class | Voxel size | Ratio to body | Constant / Rule |
| --- | --- | --- | --- |
| Humanoid body, outfit, head, hair | `0.05 m` | `1×` | `CHAR_VOX` (`humanoid.voxelSize`) |
| Bipedal monster (`body_orc_*`, `body_troll_*`) | `0.05 m` | `1×` | Same UAL1 lattice as humans (`CHAR_VOX`), silhouette pushed via `proportions` + lattice bulk |
| Snug humanoid headwear (caps, hats, helms, hoods) | `0.025 m` | `1/2×` | `HAT_VOX` (`humanoid.headwearVoxelSize`, half-voxel lattice, `origin=(0,0,0)`) |
| Oversized two-handed held tools (sledgehammer) | `0.05 m` | `1×` | `CHAR_VOX`: 1-voxel shaft fills the `5 cm` C-claw grip channel |
| Detailed held weapons, tools, forearm shields | `0.026 m` – `0.028 m` | `~1/2×` | `HELD_VOX` (`0.026` industrial/security, `0.028` heist/fantasy) |
| Static world props | `0.05 m` | `1×` | `PROP_VOX` |
| Large animal mounts (Horse) | `0.05 m` | `1×` | `CreatureSculptor(voxel=0.05, rig_scale=...)` |
| Medium/large creatures (Guard Hound, Wolf, Shepherd, Spider, Scrap-Bot) | `0.04 m` | `0.8×` | `voxchar.VOX` / `CreatureSculptor(voxel=0.04, rig_scale=...)` |
| Small wild canids (Fox) | `0.03 m` | `0.6×` | `CreatureSculptor(voxel=0.03, rig_scale=...)` |
| Small pets (Corgi, Pug, Cat) | `0.02 m` | `0.4×` | `CreatureSculptor(voxel=0.02, rig_scale=...)` (`~26–30` voxels tall) |

Every face normal must be strictly axis-aligned (`±X`, `±Y`, `±Z`). `validate.ts` rejects any diagonal
or beveled normal.

### Sculpt pose: cubes in the game, not in the bind pose

The runtime scales each bone for the proportions of a character (`proportionRig.ts`). A mesh that
is sculpted in the bind pose thus shows voxels that are not cubes. Humanoid and bipedal-monster parts
are sculpted in the **sculpt pose**: the T-pose of the rig with `humanoid.defaults`:

1. `contracts/data/proportions.json` → `humanoid.defaults` holds the default proportions
   (`height 0.97`, `legRatio 0.9`, `shoulderWidth 1.46`, `armLength 0.95`, all others `1`).
2. `npm run build` writes the scale of each UAL1 bone for these proportions to
   `out/meta/humanoid-pose.json` (`contracts/humanoidPose.ts`).
3. `blender/voxchar.py` → `SculptPose` computes each joint position in the sculpt pose and maps
   each sculpted vertex back to the bind pose: `bind = bind_joint + (sculpted - posed_joint) / scale`.
4. The runtime applies the scale again, recovering exact cubes on one lattice.

`npm run validate` skins each part through the runtime path (`restPoseVertices`) and fails if any
vertex is off the half lattice (`0.025 m` step, tolerance `maxPad + 0.5 mm`). Presets with custom
proportions (craftsmen, orcs, trolls) and morphed bodies (`body_slim`, `body_heavy`) intentionally
scale away from `1:1` cubes at runtime.

The default proportions put the rig pivots on the lattice: hip joint at `0.956 m` (bottom of belt row),
shoulder joint at `(0.224, 1.445) m` (chest side + one arm half, one arm half below shoulder top),
wrist at `0.759 m`, and head joint at `1.646 m`. `build_core.load_pose` halts the build if any pivot
drifts more than `2 cm` from its lattice position.

### One humanoid lattice (`build_core.py`)

```
X  cell i is centered on x = i * 0.05 m       torso -3..3, skull -1..1, left leg 1..3, left arm 4..18
Y  row j is [j, j + 1] * 0.05 m from floor    HEAD_Y_OFFSET = 0.0
Z  cell k is centered on z = 0.025 + k * 0.05 torso -1..1, skull -1..2, face plane k = 2
```

A part with an even cell count (`2`-wide neck X, bare calf X, shorts shoe X, low collar ring X) uses
the **half lattice** (`half_x=True`): cell `i` spans `[i, i + 1] * 0.05 m`. On Z, `NECK_Z = (-1, 0)` stays
on the regular lattice (`-0.05 .. +0.05 m`), flush with `TORSO_BACK` and `HEAD_Z[0]`, so the `4`-deep
skull (`HEAD_Z = (-1, 2)` = `-0.05 .. +0.15 m`) sits `1` full block forward on the neck and overhangs
by `2` voxels (`10 cm`) at the chin. Trouser/boot calves (`TROUSER_CALF_X = (1, 3)`) and `wide=True`
shoes use the full odd lattice so outer and inner columns stay flush with `THIGH_X = (1, 3)`.

### Rows (`38–39` rows, `1.90–1.95 m`)

| Rows | Part | Constants |
| --- | --- | --- |
| `0 .. 1` | Shoe | `SHOE_Y` |
| `2 .. 11` | Calf (one row above the knee joint) | `CALF_Y` |
| `11 .. 18` | Thigh | `THIGH_Y` |
| `18 .. 22` | Trouser hips: crotch row, belt row `19`, dark core below the shirt | `HIPS_Y`, `BELT_Y` |
| `20 .. 27` | Shirt trunk (`spine_02`) | `TRUNK_Y` |
| `28 .. 29` | Shirt yoke (`open_neck` front neckline pocket on `29`) & T-pose arms (`spine_03`) | `YOKE_Y`, `ARM_Y`, `SHOULDER_Y` |
| `28 .. 32` | Neck (`1.40 .. 1.65 m`, `2` blocks into chest, `1` exposed) & optional `1`-block collar (`30`) | `NECK_Y`, `COLLAR_Y` |
| `31 .. 35` | Skull (`1.55 .. 1.80 m`): chin (`31`), mouth (`32`), nose (`33`), eyes (`34`), forehead (`35`) | `HEAD_JAW_Y .. HEAD_BROW_Y`, `HEAD_Y_OFFSET` |
| `36 .. 38` | Hair cap, hat band, and crown (`1.80 .. 1.95 m`) | `CROWN_Y` |

### Segment table (`CHAR_VOX = 0.05 m`)

| Segment | Voxels (X × Y × Z) | Size | Constants |
| --- | --- | --- | --- |
| Skin skull | `3 × 5 × 4` | `15 × 25 × 20 cm` | `HEAD_HALF_X = 1`, `HEAD_Z = (-1, 2)` |
| Ears, hair panels, hat bands | `1` voxel out of the skull | `25 cm` across | `HEAD_SHELL = 2`, `HEAD_FRONT_SHELL = 3`, `HEAD_EAR_Z = 0` |
| Hair cap, hat crown | rows `36 .. 38` | top at `1.90 m` to `1.95 m` | `CROWN_Y = 36`, `HEAD_Y_OFFSET = 0.0` |
| Neck | `2 × 5 × 2` (`half_x=True`) | `10 × 10 cm` section, `10 cm` in torso, `5 cm` exposed, `10 cm` chin overhang | `NECK_X`, `NECK_Y`, `NECK_Z` |
| Chest, waist, hips | `7 × n × 3` | `35 × 15 cm` section | `CHEST_HALF_X = 3`, `TORSO_Z = (-1, 1)` |
| Bare arm (upper and lower) | `2 × 2` section | `10 cm` | `ARM_Y = (28, 29)`, `ARM_Z = (0, 1)` |
| Short & jacket sleeve | `2 × 2` flush (`+2..4 mm` pad) | `10 cm + pad` | `ARM_Y`, `ARM_Z`, `PAD_GARMENT` / `PAD_GARMENT_OUTER` |
| Cyber forearm gauntlet | `3 × 3` section | `15 cm` | `SLEEVE_Y`, `SLEEVE_Z`, `SLEEVE_LATTICE` |
| Hand (C-claw) | `3 × 3 × 2` and a thumb | `15 × 15 × 10 cm` | `HAND_X`, `HAND_Y`, `claw_hands()` |
| Thigh | `3 × 8 × 3` | `15 cm` section | `THIGH_X = (1, 3)`, `THIGH_Z` |
| Calf (bare / shorts) | `2 × 10 × 2` (half lattice in X) | `10 × 10 cm` section | `CALF_X`, `CALF_Z` |
| Calf (trousers / boots) | `3 × 10 × 2` | `15 × 10 cm` section | `TROUSER_CALF_X`, `CALF_Z` |
| Shoe (bare / trousers) | `2` or `3 × 2 × 3` + `1` sole toe | `10–15 × 10 × 20 cm` | `FOOT_X` / `TROUSER_CALF_X`, `FOOT_Z`, `TOE_Z` |

### Silhouette ratios

`npm run validate` measures these ratios in the sculpt pose and fails any wide face, pinhead,
mushroom hat, pencil neck, matchstick arm, spindly calf, or misaligned shoe:

| Ratio / Measure | Contract | Canonical | v5 (rejected) | Current |
| --- | --- | --- | --- | --- |
| Skin face width / garment chest width | `0.38` to `0.50` | `3 / 7 = 0.43` | `0.76` | `0.42` |
| Head height / skin face width | `>= 1.5` | `5 / 3 = 1.67` | `1.14` | `1.67` |
| Hair width / chest width (head envelope) | `0.65` to `0.90` | `5 / 7 = 0.71` | `1.0` | `0.71` |
| Headwear width / chest width | `0.55` to `0.92` | `0.57` to `0.72` (`HAT_VOX`) | `1.0` | `0.58` to `0.72` |
| Headwear vertical span | `<= 0.36 m` | `0.15` to `0.30 m` | `0.35 m` | `<= 0.32 m` |
| Neck width / skin face width | `>= 0.60` | `2 / 3 = 0.67` | `0.43` | `0.67` |
| Bare arm thickness / chest width | `>= 0.27` | `2 / 7 = 0.29` | `0.33` | `0.28` |
| Calf width / thigh width | `>= 0.65` | `0.67` bare / `1.0` trousers | `1.0` | `0.67` bare / `0.99` trousers |
| Shoe length (`foot_l` + `ball_l`) | `>= 0.19 m` | `4` voxels (`0.20 m`) | `0.18 m` | `0.204 m` |
| Shoe heel offset behind calf back | `<= 0.01 m` | `0` (flush at `z = -1`) | `0.036 m` | `0.002 m` |
| Sole toe step in front of upper | `>= 0.04 m` | `1` voxel (`0.05 m`) | `0.036 m` | `0.050 m` |

The **head envelope** prevents narrow faces from reading as pinheads: hair adds one `0.05 m` voxel
per side (`5 × 7` = `25 × 35 cm`, `~18%` of body height), while snug `0.025 m` headwear hugs at
`20–25 cm` wide (`HAT_SHELL_X` / `HAT_BRIM_X`) rather than towering as a `35 cm` mushroom cap.

---

## 3. Rigid segments & layer padding

- Each voxel segment has weight `1.0` on one bone. Blending across joints skews orthogonal cubes.
- **Torso garment: a trunk and a yoke** (`shirt_torso`). The canonical voxel torso reads as one flat
  box while the UAL1 spine bends `~11°` at the waist and `~11°` at the chest in idle:
  - **Trunk** (rows `20 .. 27`) on `spine_02`: seamless shirt front; hangs over `trouser_hips` (whose
    dark core extends up 3 rows so no gap ever opens).
  - **Yoke** (rows `28 .. 29`) on `spine_03`: moves with arms, neck, and collar; seam sits `2 cm`
    above the chest joint.
  - Paint both seamlessly via `TorsoBox.fill`, `set`, `clear`, keeping badges/pockets strictly inside
    either trunk (`<= 27`) or yoke (`>= 28`).
  - Hip-locked duty belts live on `pelvis` (`PAD_BELT`). Back items live on `spine_02` (`PAD_BACK`).
- **Shoulder cap**: Upper arms start at `ARM_UPPER_X[0] = 4`. Use `round_shoulder_cap()` (removes top
  cap row on `SHOULDER_CAP_X`) on bodies and sleeves so arms avoid blocky boxy shoulder pads when hanging.
- **Joint overlap & footwear safety**: Forearms overlap upper arms by 1 voxel (`ARM_LOWER_X = (10, 15)`).
  Calves rise 1 row above the knee joint (`CALF_Y = (2, 11)`) and **stop at `CALF_Y[0] = 2`** above the
  shoe (calf rows inside the shoe poke out of the toe when the ankle flexes).
- **Anti-z-fighting layer pads (`PAD_*`)**:
  `PAD_JOINT = 0.001`, `PAD_GARMENT = 0.002`, `PAD_HAIR = 0.002`, `PAD_SHOE = 0.002`,
  `PAD_GARMENT_OUTER = 0.004`, `PAD_HEADWEAR = 0.004`, `PAD_BELT = 0.005`, `PAD_BACK = 0.006`.
- **Edge-safe pad expansion (`voxchar._greedy_mesh_grid`)**: A pad shifts each face out along its normal,
  and expands the quad in-plane **only on edges with no adjacent quad on that plane**. Expanding all 4
  edges unconditionally caused adjacent `mottle=False` eye/emblem quads to intersect and flicker.

---

## 4. Head, face, hair, and snug headwear

### Face grid (`3 × 5 × 4`)

The face is the front plane of the skull (`z = 2`, `HEAD_FACE_Z`). `HEAD_Z = (-1, 2)` (`15 × 25 × 20 cm`)
provides `2` cheek columns (`z = 1..2`) ahead of the ear (`z = 0`).

```
columns  x = -1    0    +1            ears at x = -2 and x = +2, on z = 0 (HEAD_EAR_Z)
          eye | nose | eye

row 35  HEAD_BROW_Y    forehead (sideburns, headbands, and heavy brows sit here)
row 34  HEAD_EYE_Y     eyes: one flush voxel each; upper ear
row 33  HEAD_NOSE_Y    nose (1 voxel proud), cheek blush, ear lobe
row 32  HEAD_MOUTH_Y   mouth
row 31  HEAD_JAW_Y     lit chin front (overhangs neck by 2 voxels / 10 cm)
```

Rules:
1. **Never widen the skin skull past `3` columns** (`3 × 5 × 4`).
2. **Eyes (`1 × 1`) stay flush (`.`) on `row 34, z = 2`** (`x = ±1`) so overhanging hair, brows, and
   hat brims never cast dark pit shadows into recessed eye sockets. Use `mottle=False`.
3. **Forehead stays visible (`row 35`)**: hair caps start on `CROWN_Y = 36` flush (`z <= 2`) or add at
   most a half-width fringe (`z = 3`).
4. **Ears sit at `x = ±2, rows 33..34, z = 0`** (`SKIN_WARM` upper, `SKIN_BLUSH` lobe).
5. **Mouths use flush skin tones (`SKIN_LIP`, `-0.5`, `mottle=False`)** — never carve `-` on
   clean-shaven mouths (reads as an open gasping hole) and never use `detail` red.
6. **Chins stay lit (`s`, `L`, `wsw`)** on `row 31` so the `10 cm` overhang separates crisply from
   `SKIN_WARM` on `neck_01`.
7. **Beards** step proud (`z = 3`) on rows `31..32`, widen to `x = ±2` on the jaw, drop a step on `row 30`,
   and tuck a 1-voxel flush peach mouth (`m` proud) inside.
8. **Head budget**: `<= 280` triangles (canonical heads use `138` to `170`).

### Hair

- Cap on `row 36` (`5` wide, `z = -2..2`) + narrower off-center top `row 37` (symmetric crowns read as
  hats).
- Sideburns on `row 35, x = ±2` (leave ears visible) + nape panel on `z = -2`.
- Use 3 shade steps (`0`, `+0.25`, `-0.25`) and set `covers=('hair',)` without tagging internal grids
  `tag='hair'`.

### Snug headwear (`HAT_VOX = 0.025 m` half-voxel lattice)

Authoring hats on the coarse `0.05 m` lattice produces giant `25–35 cm` mushroom lids sitting too high
above the face. **All humanoid headwear uses `HAT_VOX = 0.025 m`** (`CHAR_VOX / 2`, `origin_world=(0, 0, 0)`,
`center_x=center_y=center_z=False` via `core.hat_seg()`):

- **Core constants (`build_core.py`)**:
  - `HAT_SKULL_X = (-3, 2)` (`-0.075 .. +0.075 m`, `15 cm` skull)
  - `HAT_SHELL_X = (-4, 3)` (`-0.100 .. +0.100 m`, `20 cm` snug wall = `2.5 cm` thickness)
  - `HAT_BRIM_X = (-5, 4)` (`-0.125 .. +0.125 m`, `25 cm` brim / ear clearance)
  - `HAT_SKULL_Z = (-2, 5)` (`-0.050 .. +0.150 m`, face plane at `z = +0.150 m`)
  - `HAT_SHELL_Z = (-3, 6)` (`-0.075 .. +0.175 m`, clears skull + brow)
  - `HAT_VISOR_Z = 7` (`+0.175 .. +0.200 m` + `4 mm` pad, clears proud nose at `+0.200 m`)
  - Rows: `HAT_JAW_Y = 62`, `HAT_MOUTH_Y = 64`, `HAT_NOSE_Y = 66`, `HAT_EYE_Y = 68`, `HAT_BROW_Y = 70`
    (`70..71` forehead), `HAT_CROWN_Y = 72` (`1.80 m`).
- **Brow & brim seating**:
  - Caps/hard-hats/welding caps seat their brim at `HAT_CROWN_Y - 1 = 71` (`1.775 m`) with front peak
    at `z = 7..8` (clearing proud brows at `y = 70..71, z = 6..7`), or start their front band/cuff at
    `HAT_CROWN_Y = 72` while dropping side/nape cuffs to `y = 70..71` behind `z = 5`.
  - Keep `headwearToChestWidth` in `[0.55, 0.92]` and `maxHeadwearHeight <= 0.36 m` (`<= 360` tris).
- **Full & visored helmets (`sallet`, `greathelm`, `riot_helmet`)**:
  - **Ear & cyber-pod clearance**: Skull ears (`|x| = 0.125 m, y = 66..69, z = 0..1`) and
    `head_cyber_visor`'s temple pod (`x = -0.125..-0.075, y = 66..69, z = 0..3`) reach `HAT_BRIM_X`.
    Closed helmets must widen cheek/ear sides to `HAT_BRIM_X = (-5, 4)` across `y = 65..71, z = -3..3`
    while tapering the brow/crown to `HAT_SHELL_X = (-4, 3)`.
  - **Faceplate & bevor clearance**: Visors sit at `HAT_VISOR_Z = 7` with slit aligned at `HAT_EYE_Y = 68..69`.
    Closed sallets pair the `z = 7` visor with a recessed chin **bevor** (`y = 62..65, z = 6`) and rear
    **lobster tail** (`z = -4..-3`) so the helmet reads as one continuous historical silhouette without nose
    or chin clipping.
  - **Included hair**: Parts with `hides_hair=True` add tucked nape hair (`y = 66..71, z = -3`) and
    high sideburns (`y = 70..71, z = -3..2`), staying cleanly above the `y = 66..69` ears/temple pod.

---

## 5. Neck, limbs, hands, shields, and footwear

- **Neck**: `2 × 5 × 2` (`half_x=True`, regular `NECK_Z = (-1, 0)`), `NECK_Y = (28, 32)`. Anchors `2`
  blocks into `spine_03` and `2` into the skull (`HEAD_Y_OFFSET = 0.0`), exposing `1` block cleanly
  above shoulders plus `1` block visible in the chest neckline pocket (`open_neck=True`).
- **Collars**: Shirts carve `(-1..1, SHOULDER_Y, TORSO_FRONT)` (`open_neck=True`). Jackets, vests,
  aprons, coveralls, scarves, and armor add `low_collar()` on `COLLAR_Y = 30` (`turtleneck=False` opens
  the front; `turtleneck=True` with `open_neck=False` closes all 4 sides cleanly).
- **Arms & sleeves**: Bare arms `2 × 2`. Short & jacket sleeves sit flush on `ARM_Y = (28, 29), ARM_Z = (0, 1)`
  (`PAD_GARMENT` / `PAD_GARMENT_OUTER`) with `round_shoulder_cap()`. Only cybernetic forearm gauntlets use
  the `3 × 3` `SLEEVE_Y / SLEEVE_Z / SLEEVE_LATTICE` grid.
- **Hands (`claw_hands()`)**: `3 × 3 × 2` + thumb on `+Z`. Grip channel at `x = 17` matches the UAL1
  held socket.
- **Forearm shields (`gripStyle = 'forearm_shield'`, `hand_l` only)**:
  - Held shields do **not** stick edge-on off the thumb side into the thigh (`hand_l` handle rule).
  - Mount the shield board flat along the **outer left forearm (`+X_held >= 0.098 m`, `maxX >= 0.115 m`,
    `minX >= -0.05 m`)**, place the fist grip bar at `(0, 0, 0)` with a pinky-side standoff bracket, and
    wrap an open `leather` forearm strap toward the elbow at `-Z_held <= -0.14 m`.
  - **Clip constraint**: Presets holding a shield in `hand_l` **must use `Idle_Loop` or `Idle_Torch_Loop`**,
    never `Sword_Idle` (where `middle_03_l.z > 0.05` opens the left hand and fails `assertHeldPresetClips`).
  - `PolyAvatar.tsx` shifts `forearm_shield` items outward along `+X` when `limbThickness` or `body_heavy`
    thickens the forearm.
- **Legs & shoes**:
  - `3 × 3` thighs (`THIGH_X = (1, 3)`). `2 × 2` bare calves (`CALF_X = (1, 2), half_x=True`) or `3 × 2`
    trouser/boot calves (`TROUSER_CALF_X = (1, 3)`). Legs stay `5 cm` apart (`LEG_INNER_X = 0.025 m`).
  - Shoes span `SHOE_Y = (0, 1)`, flush at calf back (`FOOT_Z = (-1, 1)`) + `1`-voxel sole toe (`TOE_Z = (2, 2)`
    ahead of `ball_l` at `+0.093 m`). Use `wide=True` under trousers/boots, `wide=False` under bare calves.
  - **Important material rule**: Use dark `leather` (never `metal`) for dark boot uppers and soles —
    `metal` boosts luminance (`1.18`), lifts roughness to glossy steel (`0.26`), and adds `0.52` sky reflection,
    turning dark rubber soles light grey.

---

## 6. Garment stepping

Never paint complex outfits onto a single flat box. Step silhouette elements by 1 voxel:

1. **Shirt hem**: trunk starts on `row 20` (tunic/work shirt/tassets can drop to `BELT_Y = 19`).
2. **Belt**: `pelvis` row `19` (`PAD_BELT`).
3. **Outer layer**: vests, aprons, breastplates, pouches on `z = TORSO_FRONT + 1 = 2` and `z = TORSO_BACK - 1 = -2`.
4. **Sleeves**: flush `2 × 2` with rolled cuff on last column (`round_shoulder_cap()`).
5. **Collar & neckline**: `open_neck=True` cutout or `low_collar()` on `row 30`.
6. **Knee pads, cargo pockets, holsters**: `1` voxel proud on thigh or calf (`CALF_OUTER_Z`).
7. **Shoe sole**: distinct dark `leather` bottom row + `TOE_Z` front lip.

### Fantasy casters

Use dark cloth, worn leather, or dull metal for most of the model. Use lighter
tones on raised seams, plate edges, and fasteners. Limit glow to one small area,
such as a staff crystal, a lantern core, or a visor slit. Use dark leather for
boots and soles.

Build lapels, collars, and shoulder plates one voxel deep. Use the 5 cm body
lattice for garments and the 2.5 cm lattice for headwear. Use the shoulder and
head shapes to distinguish the character in a small preview. Keep cloaks and
mantles close to the shoulder line. Attach folded wings to `spine_03` and
check the wing tips against the arms during a full stride. Put tattoo colors
on the skin surface. Use a clear band or mark that reads at thumbnail size.

Use `coat()` and `split_skirt()` in
[`build_mages_goblins.py`](../blender/build_mages_goblins.py) for layered coats
and robes. Attach each lower panel to its thigh. Recess the lowest fixed hem
behind the front of the hip. Cut the inside edge of each panel near the knee.
Keep the outside edge clear of the hand during the arm swing.

| Caster | Palette and garment | Head and held items |
| --- | --- | --- |
| Arcane Archmage | Midnight blue, slate, and aged brass. Long split coat. | Pointed hat with a broken brass dial, ring staff, and bound book. |
| Ember Battlemage | Oxblood cloth and blackened iron. Raised furnace vents on one shoulder. | Visored helm, cleaver, and caged brazier. |
| Frost Cryomancer | Slate blue and pale fur. Ice splinters on one shoulder. | Low ice crown, glacier lance, and buckler. |
| Storm Warlock | Charcoal and violet. Folded moth wings with pointed tips. | Half-mask hood, storm fork in the left hand, and void lantern in the right. |
| Necromancer | Ash-black robes and dull iron. Bone plates on one shoulder. | Peaked cowl, scythe, and skull censer. |
| Spirit Shaman | Earth brown, sage, and bone. Short thigh wraps with a tattoo on one calf. | Beast-skull brow mask, crook, and hide drum. |
| Swamp Witch | Moss, plum, and worn copper. Fitted vest and one-sided shawl with fungi. | Defined cheekbones, crooked hat, knotwood staff, and lantern flask. |
| Sorceress | Wine, indigo, and antique gold. V-neck gown, long gloves, and upward ivory wings. | Tapered chin, pale blonde hair, low diadem, gold scepter, and orb. |

Keep the face clear below the Archmage's front brim and the Necromancer's
cowl. Trim the front edge in 2.5 cm steps. Check the eyes in the front and
three-quarter views at thumbnail size.

Use the same check for workwear, helmets, and creature faces. Shorten a
projecting edge by one cell where it hides the eye line. Keep the brim in
front of the crown. Keep the visor or eye slit on closed helmets. On
creatures, use a lighter cell next to the pupil when the eye blends into
the fur or scales.

Keep the forehead and cheek width on the 5 cm face grid. Step the chin corners
back toward the neck to shape the jaw. Give each face its own nose depth and
cheek shading. For fitted garments, narrow the waist rows and keep the upper
chest at full width. Keep the thigh panels separate beneath the hem.

For the Runner, Lookout, Witch, and Sorceress, step the chest fabric forward
one voxel above the fitted waist. Use the material of each outfit on that
surface. Keep the center of the neckline clear of hair and headwear when
viewed from the front. For the Sorceress, keep one light skin cell between
the eyes and lift the diadem ornament above the brow.

Lower the outer shoulder row on these four outfits. Keep the collar at its
original height. On the Runner tee, start the step one column closer to the
neck and remove the top row from the two inner sleeve columns. Check the
sleeve and bare upper arm together through the walk and jog cycles.

Build each staff shaft along local `+Y`. Center it on the grip channel at the
origin. Use `Staff_Idle_Loop` for an upright staff in the right hand.

Check each caster with both held items equipped. Inspect the front, three-quarter,
side, and back views. Check `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, and the
equipped idle at 24 fps. Inspect the hip and hand clearances at mid-stride. Keep
the full model under 2,200 triangles and the headwear at or below 0.36 m.

---

## 7. Zero-texture material design, shading & baked AO

Every character, monster, weapon, creature, and prop shares **one zero-texture `VoxChar_Atlas_Mat`**
shader (`polyMaterial.ts`) driven purely by `TEXCOORD_0` and `TEXCOORD_1` (the only bitmap in the entire
showcase is a single `64×64` radial canvas gradient for floor blob shadows).

### All 10 semantic material regions (`contracts/palette.ts` + `polyMaterial.ts`)

| `u` | Index | Region | Roughness | Metalness | Sky Reflect | Mottle Gain | Role & Authoring Rules |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `0.05` | `0` | `skin` | `0.86` | `0.00` | `0` | `0.8×` + `0.05` hue | Skin mosaic (`±4.8%`); negative shades tint rosy (`skinBlushTint`), then warm brown (`skinShadowTint`). Use peach `#e8aa7e`/`#f2b792` for humans. |
| `0.15` | `1` | `hair` | `0.78` | `0.00` | `0` | `1.0×` | Hair, beards, animal noses/paw pads (`mottle=False` for sharp dark pads/noses). |
| `0.25` | `2` | `primary` | `0.82` | `0.00` | `0` | `1.0×` | Main garment / hull / fur / surcoat. **Must satisfy `luminance >= 0.03`.** |
| `0.35` | `3` | `secondary` | `0.82` | `0.00` | `0` | `1.0×` | Trousers / mail / under-layer / stone. **Must satisfy `luminance >= 0.03`.** |
| `0.45` | `4` | `accent` | `0.82` | `0.00` | `0` | `1.0×` | Badges, brass/gold trim (`mottle=False`), and **emissive target (`v >= 0.92`, `emissiveGain = 1.65`)** for optics/LEDs/hot forge metal. |
| `0.55` | `5` | `metal` | `0.26` | `0.48` | `0.52` | `1.0×` | Plate armor, blades, buckles, iron bands (`metalBoost = 1.18`). **Never use for dark boot soles!** |
| `0.65` | `6` | `trim` | `0.82` | `0.00` | `0` | `1.0×` | Crisp sneaker uppers, shirts, ivory tusks/bones/teeth (`mottle=False` on tusks & sharp trim). |
| `0.75` | `7` | `leather` | `0.46` | `0.06` | `0` | `1.0×` | Boots, soles, belts, holsters, weapon grips, wood shafts, warm dark eyes (`mottle=False`). **Must satisfy `luminance >= 0.03`.** |
| `0.85` | `8` | `visor` | `0.16` | `0.12` | `0.35` | `1.0×` | Glossy eyes (`mottle=False`), helmet visors, sunglasses, dark mouth cavities, goggles. |
| `0.95` | `9` | `detail` | `0.82` | `0.00` | `0` | `1.0×` | Matte bold cloth/paint (scarves, red hats, heraldic crosses, war-paint, lichen) — matte `0.82` roughness prevents specular glare on saturated red tops. |

### Quantized shade steps & baked crevice/overhang AO (`voxchar.py`)

- **17 quantized shade levels (`0.125` per step)**: `vox(region, shade)` maps `shade ∈ [-1, +1]` into
  `v ∈ [0.15, 0.85]`. `v = 0.96` (`>= 0.92`) triggers `polyEmissive = 1.0`.
- **Mandatory baked AO (`bake_ao=True`)**: `_greedy_mesh_grid` samples the voxel slice in front of
  each exposed face:
  - `weighted = edge_occ * 2 + diag_occ` → `+1` darken step if `>= 2`, `+2` steps if `>= 6`.
  - Downward `-Y` faces receive `+2` darken steps.
  - Upward `+Y` faces get `+2` if covered overhead, or `-1` highlight if completely unobstructed (`edge_occ == 0`).
  - Side (`±X`, `±Z`) faces directly under an overhanging upper voxel (`up1 > 0`, e.g. under brows, hat brims,
    collars, pauldrons, belts) receive `+2` darken steps (clamped at `4` total AO steps).
  - `validate.ts` rejects `bake_ao=False` on all non-`creatures` avatar parts, all bipedal monsters,
    all held items, and all props.
- **Shader micro-mottle & `coolShadowTint`**:
  - Non-emissive voxels with `mottle=True` hash `floor(TEXCOORD_1 + 0.001)` for `±6%` (`mottleAmplitude = 0.12`)
    per-cell luminance jitter + subtle hue shift (`±4.8%` on `skin`).
  - Non-skin shadow valleys mix toward cool slate (`(0.88, 0.93, 1.05)`), whereas skin shadow valleys
    mix toward `skinBlushTint` (`(1.15, 0.77, 0.85)`) then `skinShadowTint` (`(1.10, 0.84, 0.76)`).
  - Colors below `darkFloorLuma = 0.1` get `darkFloor = (0.030, 0.031, 0.037)` lift and `2×` mottle gain so
    charcoal/black garments retain crisp `1 × 1` facets.
  - Set `mottle=False` (`TEXCOORD_1 = (-999, -999)`) on eyes, irises, glasses, visors, lips, teeth/tusks,
    metal trim, heraldic emblems, keypads, and LEDs.

### `LOOK` constants (`polyMaterial.ts`)

| Constant | Value | Reason |
| --- | --- | --- |
| `rampDark` / `rampBright` | `0.44` / `1.20` | Strong facet contrast between lit tops and shadowed recesses |
| `toneFloor` | `0.38` | Prevents pitch-black facets in deep AO corners |
| `darkFloor` / `darkFloorLuma` | `(0.030, 0.031, 0.037)` / `0.1` | Lifts near-black albedos so facets stay legible |
| `darkMottleGain` | `2.0` | Doubles `1 × 1` facet contrast on dark coats/armor |
| `mottleAmplitude` | `0.12` | `±6%` per-cell tonal variation across greedy quads |
| `skinMottle` / `skinHueJitter` | `0.8` / `0.05` | Warm mosaic skin (`±4.8%`) without looking muddy |
| `skinBlushTint` / `skinShadowTint` | `(1.15, 0.77, 0.85)` / `(1.10, 0.84, 0.76)` | Rosy cheeks/lips and warm brown eye sockets from one `skin` color |
| `rimStrength` / `rimPower` | `0.44` / `2.6` | Crisp Fresnel silhouette separation against dark/midground scenes |
| `metalBoost` / `metalRoughness` / `metalness` / `metalSky` | `1.18` / `0.26` / `0.48` / `0.52` | Specular plate steel highlight + sky reflection |
| `emissiveGain` | `1.65` | Glowing eyes, runes, ingots, and visor LEDs |

### Palette rules

- **Dark-albedo floor (`MIN_GARMENT_LUMINANCE = 0.03`)**: `primary`, `secondary`, and `leather` must
  all have WCAG relative luminance `>= 0.03` (`#333333` is `0.033`). `npm run validate` rejects darker presets.
- **Skin**: warm peach (`#e8aa7e`–`#f2b792`) for humans; never saturated orange.
- **Eyes**: `visor` blue-teal/slate-teal or warm dark `leather` (`mottle=False`); never neon cyan on humans.
- **Saturation**: keep `primary` and `secondary` saturation between `0.18` and `0.65` so value hierarchy
  (not garish neon) carries the character.

---

## 8. Budgets (S23 Ultra, 120 Hz)

- Composed character with held items: `<= 2,200` triangles and `1` to `3` draw calls.
- Per-slot caps (`contracts/data/budgets.json`):
  - `body <= 1,100` · `head <= 280` · `hair <= 220` · `torso <= 700` · `legs <= 520` ·
    `headwear <= 360` · `back <= 320` · `held <= 400` (`<= 64 KB`) · `prop <= 650` (`<= 80 KB`).
- Held items:
  - `'handle'` (default): `+Y` shaft, `+Z` forward, `(0, 0, 0)` in grip channel; `minX >= -0.032 m`
    (`hand_r`) or `maxX <= +0.032 m` (`hand_l`).
  - `'forearm_shield'` (`hand_l` only): `+X >= 0.098 m` (`maxX >= 0.115 m`, `minX >= -0.05 m`), handle at
    `(0, 0, 0)`, open strap at `-Z <= -0.14 m`. Must pair with `Idle_Loop` or `Idle_Torch_Loop`.
- World props: grounded at `y = 0` (`|min.y| <= 0.015 m`) and centered on X/Z (`|center.x|, |center.z| <= 0.05 m`).

---

## 9. Visual proof & The Squint Test

Automated geometry/animation validation proves a mesh is **valid**, not that it looks **iconic**. Every
new or edited asset must pass headless visual verification **and the Squint Test** before sign-off:

```bash
cd tools/run-voxel-characters
npm run build && npm run catalog && npm run validate && npm run typecheck && npm test
VERIFY_PORT=5211 node scripts/verify-visual.mjs     # out/previews/ + zero console errors

# Optional 2x reference comparison sheets:
VERIFY_OUT=/tmp/voxchar-shots VERIFY_DPR=2 VERIFY_CLIP=Idle_Loop node scripts/verify-visual.mjs
python3 scripts/compare-references.py --shots /tmp/voxchar-shots \
    --references <dir with ref_*.png> --out <dir> --version current
```

### The Squint Test (mandatory visual gate)

Look at each preview image **shrunk down to thumbnail size (~150–250 px tall) or squinted**. Reject and
resculpt if any of these fail:

1. **Instant silhouette read**: At thumbnail scale, can you immediately identify the archetype (knight vs
   bandit vs welder vs orc vs cave troll vs hound) purely from the outer outline — before reading small props?
2. **2–3 bold value & silhouette masses**: Does the character read via clear primary shapes (hunched trap
   ridge + underbite jaw + sweeping horns/crests; broad pauldrons + heraldic surcoat cross; distinct hat/helmet
   silhouette) rather than noisy `1`-voxel checkerboarding or flat uniform boxes?
3. **Posture & focal hierarchy**: Does the eye go immediately to the head/face/eyes/weapons, with clear
   dark-to-light separation (overhanging brow/brim shadows, glowing or clean eyes, lit chin/snout, clean
   negative space between limbs and torso)?
4. **Proportional integrity**: Can you count `3` columns on a human face, `5` on hair/head envelope, `7`
   on chest, flush `2 × 2` bare arms/sleeves, flush heels, and clean `0.025 m` hats with zero brow/ear/nose clipping?
5. **No dark-blob collapse**: Do dark garments, coats, boots, and hides clearly show crisp `1 × 1`
   facets and AO crevices rather than flat silhouettes?

---

## 10. Quadrupeds and creatures (`creature_kit.py`)

The **Guard Hound** (`blender/build_creatures.py` → `build_guard_hound`) is the reference voxel quadruped.
`blender/creature_kit.py` enforces these rules at build time, and `npm run validate` / `npm run validate:creature`
re-check the built GLBs.

### Why the first animal pass failed

| Defect in renders | Cause | Rule |
| --- | --- | --- |
| Limbs half a voxel off the trunk | Each segment used raw joint position as origin | 10.1 |
| Swapped axes & broken mirrors on `+X` rigs | Rig space used as authoring space | 10.1 |
| Chunks flying off in gaits (gaps up to `5.8` voxels) | Skipped animated joint or pivot outside segment | 10.3 |
| Bobbleheads (`7/7` cat, `9/9` pug) & box trunks (`7/7` corgi) | No head-to-chest or waist-to-chest contract | 10.2 |
| Side bricks on legs/head & cap-brim brows | Unstepped `1`-cell cheek/shoulder slabs & stacked crowns | 10.2, 10.4 |
| Flickering eye borders | Unconditional pad growth + eye bound to separate eye bone | 10.4 |
| Facetless dark coats (`0.020–0.028` luminance) | Dark floor checked on 3 regions only | 10.6 |
| Shrinking limbs in lie-down clips (`88%`) | Scale animation channels copied onto rigid segments | 10.5 |

### 10.1 One lattice, one authoring space, real-world `rig_scale`

- **Creature space**: `+Y` up, `+Z` forward, `+X` left. Pass `forward='+X'` to `CreatureSculptor` for `+X` rigs.
- **World lattice**: Cell `c` on X spans `[(c - 0.5), (c + 0.5)] * v` (symmetric odd widths `5, 7, 9`).
  Y/Z cells span `[j, j + 1] * v` with row `0` on `y = 0`.
- **Half-voxel anchor rule**: Segment origins snap joints to nearest lattice points (`creature_kit.lattice_anchor`).
- **Mirror**: Author center segments and left limbs (`mirror=True` / `mirror_bone=`).
- **`rig_scale` normalization**: Pass `rig_scale=...` to `CreatureSculptor` to convert `cm`/`100×`/`2×`
  external rigs into real-world metres **before** sculpting at the matching tier (`0.05 m` horse, `0.04 m`
  hound/wolf/shepherd, `0.03 m` fox, `0.02 m` corgi/pug/cat). Never distort `voxel` to match raw rig units.
- **`Sculpt` vs `VoxelGrid` API**: `creature_kit.Sculpt` uses `.cut(x, y, z)` and `.paint(...)` (`0` = empty);
  `voxchar.VoxelGrid` uses `.clear(x0, y0, z0, x1, y1, z1)` and `.paint_if_filled(...)`.

### 10.2 Quadruped silhouette (`quadruped.silhouette`)

| Part | Guard Hound | Contract | Defect outside contract |
| --- | --- | --- | --- |
| Chest × waist × hips (width) | `9 × 5 × 7` | waist / chest `<= 0.8` | Equal-width trunk reads as a box |
| Skull (W × H × D) | `5 × 5 × 5` | — | Taller/deeper skull reads as a tower |
| Eye-row head width / chest width | `5 / 9 = 0.56` | `0.44` to `0.8` | Above: bobblehead; below: pinhead |
| Head + ears / chest width | `0.56` | `<= 1.0` | Head wider than chest |
| Muzzle | `3` wide, `2` rows, `5` long, jaw `1` shorter | — | `5`-wide muzzle reads as a box snout |
| Lower leg section | `2 × 2` | `2 × 2` every row | Wider = post; `1` wide = stick |
| Paw | pad row `y = 0`, toe box `2` cells forward | toe step `1..2`, `y = 0..1`, flush heel | Stump foot |
| Shoulder plate / haunch step | `1` cell out | `<= 1` cell | Larger = brick on side |
| Leg columns vs joint X | `0.125` voxels | `<= 1` voxel | Leg swings wide off bone |

### 10.3 Segments, joints, and bind

1. Joint inside segment (`<= 1` voxel outside on Y/Z, `maxPivotOutsideVoxels`).
2. Segment reaches child joint with 1-row overlap + differential pad (`pad=n * 2.5%` voxel or `JOINT_PAD`).
3. Every animated joint in a chain owns a segment (hidden trunk link for animated scapulas/pelvises).
4. Spine follows every animated spine joint (hips, waist, ribs, chest).
5. Coincident faces require different pads.
6. Bind formula: `inverse(W_j @ IBM_j)` stores rest-pose sculpt vertices accurately on rotated/scaled rigs.

### 10.4–10.8 Creature head, limbs, palette, motion, and proof

- **Flush eyes (`Sculpt.eyes(..., facing='front'|'side')`)**: inside the `head` segment (never a separate
  bone, never recessed behind brow overhang). Brows are `1` bar `1` cell proud (`maxBrowOverhangVoxels`);
  pets (`corgi`, `pug`, `cat`) have no brow.
- **Ears**: `1` cell thick (`x = ±2` dogs, thin Z front-facing cats/corgis, flush painted triangle on pugs).
- **Cheek fur/masks**: painted on existing skull cells, not proud side slabs.
- **Tails**: follow every tail joint. **No scale animation tracks** exported (`CreatureSculptor.export_glb`).
- **Palette**: every mottled creature region must satisfy `luminance >= 0.03` (use `mottle=False` for darker
  noses/pupils).
- **Motion audit (`creature.motion`)**: `<= 2%` bone stretch/shear, `<= 1` voxel segment gap across all clips.

---

## 11. Bipedal monsters (`bipedalMonster` — Orcs, Trolls, Ogres)

Bipedal monsters (`body_orc_*`, `body_troll_*`, `body_ogre_*` in `build_orcs_trolls.py`) share the UAL1
53-joint rig for all 43 clips while breaking human proportions into hulking beast silhouettes.

### Critical `proportions.ts` scaling traps learned from Orcs & Trolls

1. **Asymmetric `clavicle.x` vs `spine_03.x` scaling (`shoulderWidth`)**:
   In `contracts/proportions.ts`, `clavicle.x = max(1 + 2.8*(shoulderWidth - 1), minClavX)` scales nearly
   `15×` faster with `shoulderWidth` than `spine_03.x = 1 + 0.18*(shoulderWidth - 1) + 0.25*(torsoBulk - 1)`!
   At `shoulderWidth = 1.62`, `clavicle` pushes the shoulder joint far outward — **if your chest stops at
   `x = (-4, 4)` and `upperarm_l` starts at `x = 5`, an ugly floating armpit gap opens**.
   - **Rule**: Bridge the upper chest out to `x = (-5, 5)` across `y = (27, 29)` (and `30` mantle on trolls)
     and anchor `upperarm_l` inside at `x = 4` (`(4, 10)`) so arms seat solidly into the ribcage.
2. **Do not pair high `height` with low `legRatio`**:
   `humanStatureFor` forces `upperSpineY` to absorb whatever height short legs (`legRatio = 0.78`) leave behind.
   Keep monster `height` in **`0.96 .. 1.14`** with `legRatio = 0.78` (`1.20+` vertically stretches torso
   voxels and breaks `1:1` chunky proportion).
3. **Prevent idle forearm/thigh self-collisions**:
   Keep forearms cleanly inside `y = (28, 30), z = (-1, 1)` and thighs inside `x = (1, 3), z = (-1, 1)`
   so hulking `limbThickness = 1.22..1.32` + `shoulderWidth = 1.56..1.64` passes `Idle_Loop`,
   `Idle_Torch_Loop`, and `Sword_Idle` with zero ragdoll self-collisions (`validate.ts` audits every frame).

### Silhouette & validation contract (`proportions.json` → `bipedalMonster`)

1. **Baked AO mandatory (`requireBakedAo = true`)**: Never pass `bake_ao=False`. Overhanging brows,
   shoulder armor, tusks, jawlines, and dorsal crags rely on baked crevice/overhang shadows.
2. **Hunched V-taper (`maxWaistToChestWidth <= 0.82`)**: Tight `5`-wide waist (`x = (-2, 2), spine_02`)
   flaring into a `9`–`11`-wide chest (`spine_03`) with a tall dorsal trapezius arch rising to `y = 32..33`
   behind the head.
3. **Sunken forward-thrust beast skull (`minHeadDepthMeters >= 0.24 m`, `minHeadForwardOffset >= 0.025 m`)**:
   - Sink the skull down into the hunched shoulders (`y = 29..36`) and push it forward (`z = 0..5`, `>= 5`
     cells deep = `>= 25 cm`).
   - Sculpt a protruding **underbite jaw/chin shelf (`z = 5`)**, a **dark open mouth cavity (`MOUTH_DARK`
     at `y = 31, z = 3`, leaving `z = 4` open air)** beneath a heavy overhanging **brow ridge (`z = 3..5`)**,
     fierce `1 × 1` `mottle=False` eyes at `z = 3`, and **tall `IVORY` tusks rising out of the underbite
     jaw at `z = 5`** (`y = 30..32`, or `33` on Warboss/Cave Troll).
   - Top each archetype with a bold Squint-Test silhouette feature: Warboss iron war-helm + sweeping horns +
     crimson war-crest; Orc Raider tall dark mohawk; Moss Troll bold moss back mantle & crest; Cave Troll
     sweeping ivory cavern horns + bioluminescent `MARK` spine ridge.
4. **No human underwear / boxer briefs**: Never paint `CLOTH` speedos onto monster hips. Sculpt rugged
   `HIDE` / `IRON` war belts, hanging loincloth tatters, tassets, and tropy plates (`z = ±2`).
5. **Clawed beast feet (`minFootLengthMeters >= 0.22 m`)**: `3`-wide, `5`-long feet (`z = -1..3` = `0.25 m`)
   with split ivory/iron toe claws grounded on `y = 0`.

---

## 12. World props (`prop`)

World props (`prop_*`, `PROP_VOX = 0.05 m`) stand on `y = 0` (`|min.y| <= 0.015 m`) and center on X/Z
(`|center.x|, |center.z| <= 0.05 m`):

1. **Non-trivial stature (`minHeightMeters >= 0.20 m`)**: Props read clearly beside `1.90 m` humans.
2. **Multi-shade / stepped silhouette (`minUniqueShades >= 3`)**: Break up boxes with stepped frames,
   recessed panels, iron bands, weathered planks, latches, or glowing emissive accents (`bake_ao = True`).
3. **Triangle & byte budgets**: `<= 650` triangles, `<= 80 KB`, `1` shared `VoxChar_Atlas_Mat` material.
