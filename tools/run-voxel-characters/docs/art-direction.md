# Teardown-Style Voxel Character Art Direction

This document is the visual and geometric specification of **RUN Voxel Characters**
(`tools/run-voxel-characters`). The target is the look of the Teardown characters: large cubes of
one size, a long and thin face, a head envelope that the hair makes, a flat torso box, sturdy
limbs, a warm voxel mosaic on the skin, and crisp facets on dark cloth. All presets run on a
Samsung Galaxy S23 Ultra at 120 Hz (`<= 2,200` triangles and `1` to `3` draw calls for each
character).

The rules below are the result of the v6–v14 passes. Each pass started with a count of the
voxels on the Teardown reference stills. Each rule gives the measured Teardown value, the v5–v13
defect that it prevents, and the place in the code that holds it.

## Where each rule lives

| Rule | Source of truth | Automatic check |
| --- | --- | --- |
| Voxel size of the humans | `contracts/data/proportions.json` → `humanoid.voxelSize` | `npm run validate` (sculpt lattice), `contracts.test.ts` |
| Default proportions (the sculpt pose) | `contracts/data/proportions.json` → `humanoid.defaults` | Build (`load_pose`), `npm run validate` (sculpt lattice) |
| Lattice rows, columns and depth cells | `blender/build_core.py` (constants at the top) | Build fails on a bad face map or a pivot off the lattice |
| Silhouette ratios (head, torso, limbs, shoes) | `contracts/data/proportions.json` → `humanoid.silhouette` | `npm run validate` measures the built meshes |
| Dark-albedo floor of garments | `contracts/palette.ts` → `MIN_GARMENT_LUMINANCE` | `npm run validate`, `contracts.test.ts` |
| Triangle budgets | `contracts/data/budgets.json` | Build and `npm run validate` |
| Skin ramp, mottle, dark floor in the shader | `games/voxel-character-showcase/src/avatar/polyMaterial.ts` → `LOOK` | `scripts/compare-references.py` (visual) |
| Quadruped silhouette (chest, waist, head, legs, paws, brow) | `contracts/data/proportions.json` → `quadruped.silhouette` | Build (`creature_kit.QuadrupedAudit`), `npm run validate`, `npm run validate:creature` |
| Creature motion (cubes stay cubes, segments stay together) | `contracts/data/proportions.json` → `creature.motion` | `npm run validate`, `npm run validate:creature` (`src/creatureAudit.ts`) |
| Creature lattice, authoring space and bind | `blender/creature_kit.py` | Build, `npm run validate`, `npm run validate:creature` |

---

## 1. Measured Teardown values

The values come from the reference stills (hero, blonde, red hat, bandana, guard, Chris). One voxel
of the hero is `20.5 px`. The count is the same on the head, the chest and the shoes.

| Part | Teardown (voxels) | v5 | v14 |
| --- | --- | --- | --- |
| Height with hair | `38–39` | `56` (`2.01 m` at `0.036 m`) | `38–39` (`1.90–1.95 m` at `0.05 m`) |
| Skin skull (W × H × D) | `3 × 5 × 4` | `7 × 8 × 5` | `3 × 5 × 4` |
| Head envelope with hair (width × height) | `5 × 7` | `9 × 10` | `5 × 7` |
| Eye | `1 × 1` | `2 × 1` | `1 × 1` |
| Chest (width × depth) | `7 × 3` | `9 × 4` | `7 × 3` |
| Shirt rows, belt rows | `10`, `1` | `13` to `14` (stretched voxels) | `10`, `1` |
| Bare arm section | `2 × 2` | `3 × 3` | `2 × 2` |
| Thigh section, calf section | `3 × 3`, `2 × 2` bare / `3 × 2` trousers | `4 × 4`, `4 × 4` | `3 × 3`, `2 × 2` bare / `3 × 2` trousers |
| Leg rows, shoe rows | `16.5`, `2` | `28`, `4` | `17`, `2` |
| Shoe footprint (width × length) | `2–3 × (3 + 1)` flush at calf back | `4 × 5` | `2` bare / `3` trousers × `(3 + 1)` flush |

The v5–v13 defects that the user reported:

- **The faces were too wide and too square.** The v5 skin face was `25.2 × 28.8 cm` (H/W `1.14`).
  The Teardown face is `3` columns wide and `5` rows tall (`H/W = 1.67`).
- **The voxels were too small.** The v5 face had `7` columns and the v5 chest had `9` columns. A
  Teardown face has `3` columns and a Teardown chest has `7` columns.
- **The voxels were not cubes.** The v5 meshes were sculpted in the bind pose. The runtime
  proportions then made a chest voxel `3.9 × 4.7 cm` and a leg voxel `3.6 × 3.1 cm`.
- **The v6 trouser calves were too narrow and shoes stuck out behind the heel.** `FOOT_Z = (-2, 0)`
  sat `1` voxel (`5 cm`) behind `CALF_BACK = -1`, and `2 × 2` calves below `3 × 3` thighs made
  trouser legs look spindly. `v7` widens trouser/boot calves to `3 × 2` (`TROUSER_CALF_X`) and aligns
  every shoe flush at `z = -1` (`3`-long upper + `1`-long sole toe).
- **The v8 heads looked flat front-to-back (`3` deep) and lacked chins; v9–v10 stretched vertically (`3 × 6`) instead.**
  In Teardown, the face stays `5` rows tall (`3 × 5`), while the skull is `4` voxels deep front-to-back
  (`HEAD_Z = (-1, 2)`, leaving `2` cheek columns ahead of `HEAD_EAR_Z = 0` and `1` column behind).
  Paired with a `2 × 2` neck (`NECK_Z = (-1, 0)` = `-0.05..+0.05 m`, flush with the torso and skull
  back) and a lit front chin, the head sits **`1` full block forward on the neck** with a clean
  **`2`-voxel (`10 cm`) chin overhang** in front without making the face tall.
- **The v13 necks appeared to "sit on top" of flat shirts.** `NECK_Y = (29, 32)` and flat
  `SHOULDER_Y = 29` fronts hid the neck-to-chest entry. `v14` anchors `NECK_Y = (28, 32)` `2` blocks
  into `spine_03`, sets `HEAD_Y_OFFSET = 0.0`, carves a `1`-block front neckline socket
  (`open_neck=True` at `SHOULDER_Y = 29, z = 1`), and builds full `1`-block collars on `COLLAR_Y = 30`.

---

## 2. Scale and lattice

### One voxel size

| Asset | Voxel size | Constant |
| --- | --- | --- |
| Body, outfit, head, hair, headwear | `0.05 m` | `CHAR_VOX` (`humanoid.voxelSize`) |
| Sledgehammer | `0.05 m` | `CHAR_VOX`: the shaft is one voxel and fills the grip channel |
| Other held tools and weapons | `0.02 m` to `0.028 m` | `HELD_VOX` |
| World props | `0.05 m` | `PROP_VOX` |
| Sculpted creatures (wolf, spider, scrap-bot) | `0.04 m` | `voxchar.VOX` |
| A creature on an external rig | One size for the whole creature, in the units of the rig (section 10) | `CreatureSculptor(voxel=...)` |

Every face normal is axis-aligned. `validate.ts` rejects a normal that is not.

### Sculpt pose: cubes in the game, not in the bind pose

The runtime scales each bone for the proportions of a character (`proportionRig.ts`). A mesh that
is sculpted in the bind pose thus shows voxels that are not cubes. The v6 meshes are sculpted in
the **sculpt pose**: the T-pose of the rig with the default humanoid proportions.

1. `contracts/data/proportions.json` → `humanoid.defaults` holds the default proportions
   (`height 0.97`, `legRatio 0.9`, `shoulderWidth 1.46`, `armLength 0.95`, all others `1`).
2. `npm run build` writes the scale of each UAL1 bone for these proportions to
   `out/meta/humanoid-pose.json` (`contracts/humanoidPose.ts`).
3. `blender/voxchar.py` → `SculptPose` gives the position of each joint in the sculpt pose and maps
   each sculpted vertex to the bind pose: `bind = bind_joint + (sculpted - posed_joint) / scale`.
4. The runtime applies the scale again. The result is the sculpted lattice: each voxel is a
   `0.05 m` cube.

`npm run validate` skins each part through the runtime path and stops when a vertex is not on the
lattice (`assertOnSculptLattice`). A preset with other proportions (`ind_craftsman`) and a body
with a build morph (`body_slim`, `body_heavy`) are a small change from the cubes. That is correct.

The default proportions put the rig pivots on the lattice: the hip joint at `0.956 m` (the bottom of
the belt row), the shoulder joint at `(0.224, 1.445) m` (the chest side plus one arm half, one arm
half below the shoulder top), the wrist at `0.759 m` and the head joint at `1.646 m`.
`build_core.load_pose` stops the build when a pivot is more than `2 cm` from its lattice position.

### One lattice (`build_core.py`)

All segments of a human use one lattice in the sculpt pose.

```
X  cell i is centered on x = i * 0.05 m       torso -3..3, skull -1..1, left leg 1..3, left arm 4..18
Y  row j is [j, j + 1] * 0.05 m from the floor (HEAD_Y_OFFSET = 0.0)
Z  cell k is centered on z = 0.025 m + k * 0.05 m       torso -1..1, skull -1..2, face plane k = 2
```

A part with an even cell count (the `2`-wide neck X and bare calf X, the `2`-wide shoe under
shorts, the low collar ring X) uses the **half lattice** (`half_x=True`): cell `i` is
`[i, i + 1] * 0.05 m`. It is symmetric about the X axis and half a voxel inside the odd part above
it. On Z, `NECK_Z = (-1, 0)` sits on the regular lattice (`-0.05 .. +0.05 m`), flush with `TORSO_BACK`
and `HEAD_Z[0]`, so the `4`-deep skull (`HEAD_Z = (-1, 2)` = `-0.05 .. +0.15 m`) sits `1` full block
forward on the neck and overhangs it by `2` voxels (`10 cm`) at the chin. Trouser/boot calves
(`TROUSER_CALF_X = (1, 3)`) and `wide=True` shoes sit on the full odd lattice so their outer and
inner columns stay flush with `THIGH_X = (1, 3)`.

### Rows (`38–39` rows, `1.90–1.95 m`)

| Rows | Part | Constants |
| --- | --- | --- |
| `0 .. 1` | Shoe | `SHOE_Y` |
| `2 .. 11` | Calf (one row above the knee joint) | `CALF_Y` |
| `11 .. 18` | Thigh | `THIGH_Y` |
| `18 .. 22` | Trouser hips: crotch row, belt row `19`, dark core below the shirt | `HIPS_Y`, `BELT_Y` |
| `20 .. 27` | Shirt trunk (`spine_02`) | `TRUNK_Y` |
| `28 .. 29` | Shirt yoke (`open_neck` front neckline pocket on `29`) and T-pose arms (`spine_03`) | `YOKE_Y`, `ARM_Y`, `SHOULDER_Y` |
| `28 .. 32` | Neck (`1.40 .. 1.65 m`, `2` blocks into chest, `1` block exposed) & optional `1`-block collar (`30`) | `NECK_Y`, `COLLAR_Y` |
| `31 .. 35` | Skull (`1.55 .. 1.80 m`): chin/jaw (`31`), mouth (`32`), nose (`33`), eyes (`34`), forehead (`35`) | `HEAD_JAW_Y .. HEAD_BROW_Y`, `HEAD_Y_OFFSET` |
| `36 .. 38` | Hair cap, hat band, and crown (`1.80 .. 1.95 m`) | `CROWN_Y` |

### Segment table (`CHAR_VOX = 0.05 m`)

| Segment | Voxels (X × Y × Z) | Size | Constants |
| --- | --- | --- | --- |
| Skin skull | `3 × 5 × 4` | `15 × 25 × 20 cm` | `HEAD_HALF_X = 1`, `HEAD_Z = (-1, 2)` |
| Ears, hair panels, hat bands | one voxel out of the skull | `25 cm` across | `HEAD_SHELL = 2`, `HEAD_FRONT_SHELL = 3`, `HEAD_EAR_Z = 0` |
| Hair cap, hat crown | rows `36 .. 38` | top at `1.90 m` to `1.95 m` | `CROWN_Y = 36`, `HEAD_Y_OFFSET = 0.0` |
| Neck | `2 × 5 × 2` (`half_x=True`) | `10 × 10 cm` section, `10 cm` in torso, `5 cm` exposed + `5 cm` neckline dip, `10 cm` chin overhang | `NECK_X`, `NECK_Y`, `NECK_Z` |
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

These ratios are a contract. `npm run validate` measures them on the built meshes in the sculpt
pose and stops the build of a wide face, a pinhead, a pencil neck, a matchstick arm, a spindly calf,
or a misaligned shoe.

| Ratio / Measure | Contract | Teardown | v5 | v14 |
| --- | --- | --- | --- | --- |
| Skin face width / garment chest width | `0.38` to `0.50` | `3 / 7 = 0.43` | `0.76` (defect) | `0.42` |
| Head height / skin face width | `>= 1.5` | `5 / 3 = 1.67` | `1.14` (defect) | `1.67` |
| Hair width / chest width (head envelope) | `0.65` to `0.90` | `5 / 7 = 0.71` | `1.0` | `0.71` |
| Headwear width / chest width | `>= 0.65` | `0.71` to `1.0` (a brim) | `1.0` | `0.71` to `1.0` |
| Neck width / skin face width | `>= 0.60` | `2 / 3 = 0.67` | `0.43` | `0.67` |
| Bare arm thickness / chest width | `>= 0.27` | `2 / 7 = 0.29` | `0.33` | `0.28` |
| Calf width / thigh width | `>= 0.65` | `0.67` bare / `1.0` trousers | `1.0` | `0.67` bare / `0.99` trousers |
| Shoe length (`foot_l` + `ball_l`) | `>= 0.19 m` | `4` voxels (`0.20 m`) | `0.18 m` | `0.204 m` |
| Shoe heel offset behind calf back | `<= 0.01 m` | `0` (flush at `z = -1`) | `0.036 m` | `0.002 m` |
| Sole toe step in front of upper | `>= 0.04 m` | `1` voxel (`0.05 m`) | `0.036 m` | `0.050 m` |

The **head envelope** is the reason that a thin face does not read as a pinhead. The hair or the
headwear adds one voxel on each side of the skull and two rows on top: `5 × 7` voxels
(`25 × 35 cm`, H/W `1.4`, `~18%` of the height). Each head needs hair or headwear that is `5` wide.

---

## 3. Rigid segments

- Each voxel segment has weight `1.0` on one UAL1 bone. A blend across a joint bends the cubes.
- **Torso garment: a trunk and a yoke** (`shirt_torso`). The Teardown torso is one flat box. The
  UAL1 spine turns about `11°` at the waist and `11°` at the chest in the idle pose. Three pieces
  (v5) showed as stacked plates at `0.05 m`. One box on the chest bone moved `9 cm` off the hips.
  - The **trunk** (rows `20 .. 27`) is one box on `spine_02`. The shirt front has no seam.
  - The **yoke** (rows `28 .. 29`) is on `spine_03` with the arms, the neck and the collar. Its
    seam is `2 cm` above the chest joint, thus the two pieces stay together.
  - The trunk hangs over the trouser hips and turns on them at the belt. The hips have a dark core
    three rows up into the trunk (`trouser_hips`), thus no hole shows when the trunk lifts.
  - Paint the two pieces as one box: `TorsoBox.fill`, `set`, `clear`. Keep a badge or a pocket in
    one piece (rows `<= 27` or rows `>= 28`).
  - Belt gear that must stay on the hips (the duty belt of the guard) is a `pelvis` grid with
    `PAD_BELT`. Back items are on `spine_02` with the trunk.
- The ragdoll colliders of a torso garment fit its rows to the pelvis, the waist and the chest of
  the body (`torso_anatomy_bone`, `collider_probe`).
- The upper arm starts at the chest side (`ARM_UPPER_X[0] = 4`). Cell `4` is the **shoulder cap**:
  in the T-pose it is level with the shoulder top, and when the arm hangs its top is at the
  shoulder top and its inner face is on the chest side.
- The forearm goes one voxel into the upper arm. The thigh top is at the hip joint and the calf
  goes one row above the knee joint. The calf stops at the top of the shoe: a calf row inside the
  shoe comes out of the toe when the ankle turns.
- Two layers are never in the same plane. Pads: joint `0.001`, garment and shoe `0.002`, outer
  garment `0.004`, belt gear `0.005`, back item `0.006`.
- A pad moves each face out along its normal. A quad grows by the pad in its plane only on an edge
  that has no other quad of that plane next to it (`voxchar._greedy_mesh_grid`). Before this rule,
  two quads of one plane grew into each other and the border of each eye and each dark patch on a
  padded segment flickered.

---

## 4. Head and face

### Face grid

The face is the front plane of the skull (`z = 2`, `HEAD_FACE_Z`). The skull is `3 × 5 × 4`
(`HEAD_Z = (-1, 2)`, `15 × 25 × 20 cm`), giving `2` full cheek columns (`z = 1..2`) ahead of the
ear (`z = 0`).

```
columns  x = -1    0    +1            ears at x = -2 and x = +2, on z = 0 (HEAD_EAR_Z)
          eye | nose | eye

row 35  HEAD_BROW_Y    forehead. Sideburns, headbands and heavy brows are on this row.
row 34  HEAD_EYE_Y     eyes: one flush voxel each. Upper ear.
row 33  HEAD_NOSE_Y    nose (one voxel proud), cheek blush, ear lobe
row 32  HEAD_MOUTH_Y   mouth
row 31  HEAD_JAW_Y     lit chin front (overhangs the neck by 2 voxels / 10 cm)
```

Rules:

1. **Three wide, five tall, four deep (`3 × 5 × 4`).** Do not make the skin skull wider than `3`.
   A wider face reads square (the v5 defect). The `4`-voxel front-to-back depth keeps Teardown's
   elongated head silhouette and `2`-voxel chin overhang without stretching the face vertically
   past `5` rows.
2. **Each eye is one voxel** on `x = ±1`. Column `0` is the nose. No brow row is necessary: the
   hair cap or the hat band is directly above the forehead row.
3. **The forehead row stays in view.** A hair cap starts on `CROWN_Y = 36` flush with the face
   plane (`z <= 2`) or adds a fringe overhang (`z = 3`, `HEAD_FRONT_SHELL`) across at most half
   its width. A hat band sits on row `36` (`CROWN_Y`), while a headband wraps row `35`
   (`HEAD_BAND_Y = HEAD_BROW_Y`).
4. **The ears go one voxel out of the skull** on `x = ±2`, rows `33 .. 34`, `z = 0` (`HEAD_EAR_Z`).
   Two full cheek columns (`z = 1 .. 2`) stay in view ahead of the ear in a three-quarter view.
   The upper ear is `SKIN_WARM` and the lobe is `SKIN_BLUSH`.
5. **The camera looks down at the head.** Keep eyes and lenses flush (`.` on row `34`) across all
   heads so brows and hat brims never cast pit shadows into carved eye sockets.

### Face maps (`paint_face`)

A face is two maps of `3 × 5` letters: the tones and the relief. The rows go from row `35` down to
row `31`. Column `0` is `x = -1`, the right side of the character. `.` keeps the skull color.

```python
paint_face(grid, (
    'wLs',    # 35  forehead: warm temple, highlight
    'EwE',    # 34  eyes: one voxel each
    'cnc',    # 33  cheek blush, nose
    '.mm',    # 32  2-wide smirk toward his left
    'sLs',    # 31  lit chin front (head_base shades only z <= 0 rear jaw above neck warm)
), NOSE_RELIEF, {**FACE_TONES, 'E': vox('visor', 0.0, mottle=False)})
```

Relief letters: `.` flush (`z = 2`), `+` one voxel proud (`z = 3`), `-` one voxel recessed (`z = 1`).
`NOSE_RELIEF` is the common relief: the nose is proud on row `33`.

Shared tone letters (`FACE_TONES`):

| Letter | Constant | Shade | Use |
| --- | --- | --- | --- |
| `L` | `SKIN_LIGHT` | `+0.125` | Forehead and chin highlight |
| `s` | `SKIN` | `0` | Base skin |
| `w` | `SKIN_WARM` | `-0.125` | Temples, rear jaw above neck, ears, neck, bridge of the nose |
| `c` | `SKIN_BLUSH` | `-0.25` | Cheek blush, ear lobe, stubble |
| `C` | `SKIN_CORAL` | `-0.375` | Deep blush on the cheekbone |
| `m` | `SKIN_LIP` | `-0.5`, mottle off | Lips |
| `o` | `SKIN_SOCKET` | `-0.75`, mottle off | Soft brown eye socket |
| `n` | `NOSE` | `+0.125`, mottle off | Nose |
| `B` | `BROW` | hair `-0.25`, mottle off | Heavy brow |

### Feature rules

- **Eyes**: use the `visor` region for an iris (blue-teal `#3a93bd`, slate-teal `#3f8f9c`) and a
  warm dark brown like `vox('leather', -0.125, mottle=False)` for a dark eye (`head_keen_scout`).
  Always set `mottle=False` and keep eyes flush (`.`) on `z = 2`. Do not carve `-` eye sockets or
  use a neon cyan.
- **Nose**: one proud voxel on row `33`. A large nose (Chris, Fixer) uses `3` or `n` proud on row
  `33` with a warm nose bridge (`w`) on row `34`. The baked AO darkens the cells next to the nose.
  Do not paint that shadow.
- **Cheeks**: `c` or `C` on row `33`, columns `±1`. With the lit chin, ears, and voxel mottle, the
  skin reads as a mosaic.
- **Mouth**: a flush skin tone (`m`), 1 or 2 wide on row `32`. Never use `-` on clean-shaven mouths
  (a carved hole reads as an open gasping O-mouth) and never use `detail` or a saturated red.
- **Chin**: row `31` stays lit (`s`, `L`, `wsw`) so the `2`-voxel overhang cleanly separates from
  `SKIN_WARM` on `neck_01`.
- **Beard**: proud (`z = 3`) on rows `31 .. 32` (mustache on row `32` or sculpted lower jaw), on
  the jaw sides (`x = ±2`, 5 wide), a step on row `30`, and one flush peach voxel tucked inside the
  beard for the mouth.
- **Glasses/shades**: flush (`.`) lenses on row `34` (`VwV`) with a flush nose bridge and no
  heavy black forehead bar above them.
- **Triangle budget**: a head has `280` triangles maximum. The v13 heads use `138` to `170`.

### Hair

- A **cap** on row `36` (`CROWN_Y`): `5` wide, from the nape (`z = -2`) to the face plane (`z = 2`).
  A second row on row `37` is narrower and off center.
- **Sideburns** on row `35` at `x = ±2` keep the ears (rows `33 .. 34`, `z = 0`) in view. Longer
  side panels hide the ears (a bob).
- A **nape** panel on `z = -2`.
- Use three tones (`0`, `+0.25`, `-0.25`) and an asymmetric top row. A symmetric stepped crown
  reads as a hat.
- `validate.ts` stops a hair part that is less than `65%` of the chest width.

### Headwear

- A **band** (`hat_slab`) is `5` wide × `6` deep (`z = -2 .. 2` or `+3` peak/brim) on row `36`
  (`CROWN_Y`), above the forehead row. A cap, a hard hat, a beanie cuff and a helmet dome use it.
  A bucket hat brim is `7` wide and goes one voxel in front of the face plane (`HEAD_FRONT_SHELL = 3`):
  a deeper brim hides the eyes from the game camera.
- A **headband** (`HEAD_BAND_Y = HEAD_BROW_Y = 35`) wraps row `35` so the forehead reads cleanly
  below the crown.
- A **crown** is on rows `37 .. 38`. A peak goes one voxel to the front of the band (`z = 3`).
- A hat that hides the hair carries its own hair: sideburns on row `35` and a nape.
- Headwear has `PAD_HEADWEAR = 0.004`. Hair has `PAD_HAIR = 0.002`.

---

## 5. Neck, limbs and hands

- **Neck**: `2 × 5 × 2` (`half_x=True`, regular Z `NECK_Z = (-1, 0)`), centered in X below the skull
  and flush with the torso/skull back (`-0.05 .. +0.05 m`, `NECK_Y = (28, 32)` = `1.40 .. 1.65 m`). It
  anchors `2` blocks (`10 cm`) into `spine_03` and `10 cm` into the skull (`jaw = 1.55 m` with
  `HEAD_Y_OFFSET = 0.0`), exposing `1` full block (`5 cm`) cleanly above the shoulders plus dipping
  `1` block (`5 cm`) visibly down into the open chest neckline socket (`SHOULDER_Y = 29, z = 1`).
  Because the neck sits flush with the back of the `4`-deep skull (`-0.05 m`, directly beneath the ear
  `HEAD_EAR_Z = 0` and skull back), the head sits `1` full block forward on the neck with a crisp
  `2`-voxel (`10 cm`) chin overhang in front (`+0.15 m` face plane vs `+0.05 m` neck front). A
  `3`-wide neck reads as a bull neck below a `3`-wide face.
- **Collar**: tees and open garments clear `(-1..1, SHOULDER_Y, TORSO_FRONT)` (`open_neck=True` in
  `shirt_torso()`) so the front chest opens `1` block deep around the neck without punching a skin
  cell onto `TORSO_FRONT`. Jackets, scarves, vests, aprons, coveralls, and guard shirts add
  `low_collar()` on `COLLAR_Y = 30` (`1.50 .. 1.55 m`, full `1` block tall): `turtleneck=False`
  places `x = ±2` side panels on `z = -1..0` plus optional rear `z = -2` (`center_x=True`, leaving the
  `3`-wide skull and `2`-wide front neckline completely open), while `turtleneck=True` (`half_x=True`
  with center `(-1..0, -1..0)` cleared) wraps all 4 sides around the neck base.
- **Bare arms**: `2 × 2` (`10 cm`) for the upper arm and the forearm.
- **Short & jacket sleeves**: flush on the `2 × 2` upper arm (`ARM_Y = (28, 29)`, `ARM_Z = (0, 1)`)
  using `PAD_GARMENT` (`2 mm`) for shirts/short sleeves and `PAD_GARMENT_OUTER` (`4 mm`) for
  jackets, coveralls, tunics, and shoulder caps so shoulders stay level with `SHOULDER_Y` (`1.50 m`)
  instead of puffing upward. The last column of `SLEEVE_SHORT_X` forms the cuff.
- **Armored cyber gauntlet**: `3 × 3` on the cyber forearm (`SLEEVE_Y`, `SLEEVE_Z`, `SLEEVE_LATTICE`)
  while keeping the shoulder pauldron flush on `ARM_Y`, `ARM_Z` (`PAD_GARMENT_OUTER`).
- **Hand**: the C-claw of `claw_hands()`. The grip channel on `x = 17` holds the shaft of a held
  item. The UAL1 held socket is in the center of the channel.

  ```
  side view      row 29  P P P    back of the hand
  (x along arm)  row 28  H . F    heel, grip channel, curled fingers
                 row 27  H . F    the thumb is on +Z
  ```

- Under shorts, the exposed knee has the same centered `2 × 2` section as the calf.
  It moves with the thigh. The wider hem ends above it.
- **Legs**: `3 × 3` thighs (`THIGH_X = (1, 3)`). Bare calves (`body_*`, shorts) are `2 × 2`
  (`CALF_X = (1, 2)`, `half_x=True`). Trouser and boot calves are `3 × 2` (`TROUSER_CALF_X = (1, 3)`),
  keeping the outer leg line flush with the thigh. Legs stay `5 cm` apart (`LEG_INNER_X = 0.025 m`).
- **Shoe**: two rows (`SHOE_Y = (0, 1)`), flush at the back of the calf (`FOOT_Z = (-1, 1)`, extending
  `+1` in front of the shin), plus a `1`-voxel sole toe tip (`TOE_Z = (2, 2)`, in front of the
  `ball_l` joint at `+0.093 m`) for a `4`-voxel (`20 cm`) footprint. Use `wide=True` (`3` wide) under
  `3 × 2` trousers/boots and `wide=False` (`2` wide) under bare calves/shorts.
  - **Teardown sneaker**: off-white heel (`heel`), bold red saddle across both rows (`saddle`), and
    crisp white front & stepped toe (`upper`, `sole`, `toe`).
  - **Work / patrol boot**: `leather` dark tones for `upper` and `sole` (never bright `metal` soles
    on dark boots, because `toneFloor` lifts `metal` to light grey). Security patrol boots run a
    tall shaft up the shin (`CALF_Y[0] .. CALF_Y[1] - 3`) right below the knee pad.

---

## 6. Garment stepping

Do not paint detail on a flat box. Step each silhouette piece by one voxel.

1. **Shirt hem**: the trunk starts on row `20` and hides the trouser core. A tunic or a work shirt
   can start on the belt row `19`.
2. **Belt**: pelvis row `19` (`BELT_Y`), at the hip joint.
3. **Outer layer**: a vest, an apron, a plate or a pouch is on `z = 2` (front) and `z = -2` (back).
4. **Sleeves**: flush with `SHOULDER_Y` (`2 × 2` + `PAD_GARMENT` / `PAD_GARMENT_OUTER` step).
5. **Collar & neckline**: shirts open a `1`-block front neckline pocket on `SHOULDER_Y` (`open_neck=True`), while jackets, vests, aprons, coveralls, and guard shirts add a `1`-block `low_collar()` on row `30` around the neck.
6. **Knee pads, pockets, holsters**: one voxel out on the thigh or the calf.
7. **Shoe sole**: the bottom row of a boot has a contrast tone.

---

## 7. Shading

Three layers make the surface. No texture file is necessary. The v6 pass did not change the
shader: the v5 values are correct.

### Shade steps

`vox(region, shade)` has `17` shade levels. One level is `0.125`. The baked crevice AO uses the same
levels: one AO step is one level. Use multiples of `0.125`.

### Baked AO

`voxchar.py` darkens a face by one or two levels when a neighbor is in front of it, and by one more
level below an overhang. A voxel with `mottle=False` gets one level at most.

### Skin ramp

The shader turns the dark skin levels rosy, then warm brown. Thus a cheek and a lip are skin shades.
They need no palette region.

| Shade | Level name | Rendered tone |
| --- | --- | --- |
| `+0.125` | light | peach highlight |
| `0` | base | palette skin |
| `-0.125` | warm | a little darker and warmer |
| `-0.25` | blush | rosy (`skinBlushTint` at 73%) |
| `-0.375` to `-0.5` | coral, lip | deep rose (`skinBlushTint` at 100%) |
| `-0.75` | socket | warm brown (`skinShadowTint`) |

### `LOOK` constants (`polyMaterial.ts`)

| Constant | Value | Reason |
| --- | --- | --- |
| `rampDark` | `0.54` | A dark shade of a dark shirt keeps its facet contrast. |
| `toneFloor` | `0.42` | The same. |
| `mottleAmplitude` | `0.12` | `±6%` tone for each `1 × 1` voxel cell on cloth, hair and wood. |
| `skinMottle` | `0.8` | Skin is a voxel mosaic (`±4.8%`), not flat clay. |
| `skinHueJitter` | `0.05` | Each skin voxel gets a small warm or cool hue offset. |
| `skinBlushTint` | `(1.15, 0.77, 0.85)` | Rosy cheeks and lips from the skin region. |
| `skinShadowTint` | `(1.10, 0.84, 0.76)` | Warm brown sockets and crevices. |
| `darkFloor` | `(0.030, 0.031, 0.037)` | Lift of a color below `darkFloorLuma`. |
| `darkMottleGain` | `2.0` | A dark color needs a larger mottle to show its facets. |
| Gloss of the `detail` region | cloth | A red hat or scarf must not have a white top face. |

### Palette rules

- **Dark-albedo floor**: the `primary`, `secondary` and `leather` colors must have a relative
  luminance of `0.03` or more (`#333333` is `0.033`). `npm run validate` rejects a darker preset.
- **Skin**: a peach tone (`#f2b792`), not an orange tone (`#f0ab78`). The blush reads pink on peach.
- **Eyes**: blue-teal or slate-teal. No neon cyan.
- **Lips**: skin shades only.
- **Saturation**: keep `primary` and `secondary` between `0.18` and `0.65`.

---

## 8. Budgets (S23 Ultra, 120 Hz)

- Composed character with held items: `<= 2,200` triangles and `1` to `3` draw calls. The v6 human
  presets use `938` to `1,482` triangles (v5: `1,138` to `1,682`). Larger voxels make fewer quads.
- Body `<= 1,100` · Head `<= 280` · Hair `<= 220` · Torso `<= 700` · Legs `<= 520` ·
  Headwear `<= 360` · Back `<= 320` · Held `<= 400` · Prop `<= 650`.
- Held items use the UAL1 palm grip: `+Y` shaft, `+Z` forward, `minX >= -0.032 m` for `hand_r`.
- World props stand on `y = 0` and are centered on X and Z.

---

## 9. Visual proof

A look change is not done until the comparison sheets are examined.

```bash
cd tools/run-voxel-characters
npm run build && npm run catalog && npm run validate && npm run typecheck && npm test
node scripts/verify-visual.mjs                       # out/previews, zero console errors

# One neutral pose at 2x, then the sheets against the Teardown stills
VERIFY_OUT=/tmp/voxchar-shots VERIFY_DPR=2 VERIFY_CLIP=Idle_Loop node scripts/verify-visual.mjs
python3 scripts/compare-references.py --shots /tmp/voxchar-shots \
    --references <dir with the ref_*.png stills> --out <dir> --version v6 \
    [--previous <dir with the shots of the earlier version> --previous-label v5]
```

Examine `cmp_bodies_<version>.png` and `cmp_1_hero` to `cmp_6_guard`. Count the voxels: a face has
`3` columns, a head with hair has `5`, a chest has `7`. Reject the change when a character has a
wide or square face, small voxels, a head with no envelope, a thin neck or arm, a torso in plates,
a saturated mouth, or a dark garment with no facets.

To make a new character, measure the reference first: count the voxel columns and rows on the
head, the chest, the arm and the leg. Then sculpt on the lattice of section 2.

---

## 10. Quadrupeds and creatures

The **Guard Hound** (`blender/build_creatures.py` → `build_guard_hound`) is the reference of each
voxel quadruped. This section gives its rules. Each rule has the defect that it prevents. The
defects are from the first pass on seven external rigs (fox, horse, wolf, corgi, pug, shepherd,
cat). The kit `blender/creature_kit.py` holds the rules as code: a sculpt that breaks a rule stops
the build with a message that names the rule.

### Why the first pass failed

| Defect in the renders | Cause | Rule |
| --- | --- | --- |
| Limbs half a voxel off the trunk | Each segment had its origin on the raw joint position. Each limb then had its own lattice. | 10.1 |
| Sculpts of a `+X` rig with swapped axes and two mirror helpers | The rig space was the authoring space. | 10.1 |
| Chunks that flew off in a gait (largest gap: horse `5.8`, pug `5.4`, fox `3.8`, cat `2.4`, shepherd `2.4` voxels) | A limb chain skipped an animated joint, or a joint was far from the cells of its segment. | 10.3 |
| Bobblehead (cat head `7` wide on a `7`-wide chest, pug head `9` wide) | No head-to-chest contract. | 10.2 |
| Box trunk (corgi `7 / 7`) | No chest-to-waist contract. | 10.2 |
| Bricks on the side of a leg or a head | Shoulder patches, cheek tufts and ear slabs were boxes one cell out. | 10.2, 10.4 |
| Cap brims | A brow slab covered the top of the skull and a crown slab was on top of it. | 10.4 |
| Flicker at eye borders | Padded quads of one plane grew into each other (section 3). An eye on its own bone filled a socket in the head. | 10.4 |
| Dark coats with no facets (`hair` and `leather` at `0.020` to `0.028`) | The dark floor was checked on three regions only. | 10.6 |
| Legs that shrank in the cat lie-down clips (`88%`) | The clips of the rig scale bones. | 10.5 |

### 10.1 One lattice and one authoring space

- **Creature space**: `+Y` up, `+Z` forward, `+X` the left side. Author each creature in this space.
  For a rig that faces `+X`, pass `forward='+X'` to `CreatureSculptor`. Do not swap axes in a sculpt.
- **World lattice**: a sculpt gives world lattice cells. Cell `c` on X is `[(c - 0.5), (c + 0.5)] * v`.
  The body is then symmetric and an odd width (`5`, `7`, `9`) is centred. Row `j` on Y and cell `k`
  on Z are `[j, j + 1] * v`. Row `0` stands on `y = 0`.
- **The half-voxel rule**: the origin of a segment is its joint moved to the nearest lattice point.
  For a joint that is not on the centre plane, the lattice points on X are at `(column + 0.5) * v`
  (`creature_kit.lattice_anchor`). Never use the raw joint position as an origin.
- **Mirror**: author the centre segments and the left limbs. `mirror=True` (`creature_segment`) or
  `mirror_bone=` (`CreatureSculptor.seg`) makes the right limb. The sculptor stops on a rig that is
  not symmetric.
- **Real-world scale (`rig_scale`) and Teardown voxel tiers**: one voxel size per creature, chosen from the
  Teardown tiers to match real-world scale against a `1.90 m` (`0.05 m` voxel) human and `1.12 m`
  (`0.04 m` voxel) Guard Hound:
  - Large mounts (horse): `0.05 m` (`CHAR_VOX` / `PROP_VOX`).
  - Medium / large canids (Guard Hound, wolf, shepherd): `0.04 m` (`VOXEL`).
  - Small wild canids (fox): `0.03 m`.
  - Small pets (corgi, pug, cat): `0.02 m` (`HELD_VOX` tier, ~`26`–`30` voxels tall).
  Pass `rig_scale=...` to `CreatureSculptor` to bring external rigs (cm rigs, `100×` Blender armatures, or
  `2×` meshes) into real-world metres before sculpting at the matching Teardown voxel tier, rather than
  distorting `voxel` to match raw rig units (which starves small pets to `21` blocky voxels or turns a
  corgi into a `400 m` giant).

### 10.2 Silhouette (`quadruped.silhouette`)

Measured on the Guard Hound. The build checks each value on the voxel cells. `npm run validate`
measures them again on the built mesh of a quadruped on the 23-joint contract rig.

| Part | Guard Hound | Contract | Defect outside the contract |
| --- | --- | --- | --- |
| Chest × waist × hips (width) | `9 × 5 × 7` | waist / chest `<= 0.8` | A trunk of one width reads as a box. |
| Skull (W × H × D) | `5 × 5 × 5` | — | A taller or deeper skull reads as a tower. |
| Head width on the eye row / chest width | `5 / 9 = 0.56` | `0.44` to `0.8` | Above: bobblehead. Below: pinhead. |
| Head segment with ears and fur / chest width | `0.56` | `<= 1.0` | A head wider than the chest. |
| Muzzle | `3` wide, `2` rows, `5` long, jaw `1` cell shorter | — | A `5`-wide muzzle reads as a box snout. |
| Lower leg section | `2 × 2` | `2 × 2` on each row | Wider: a post. `1` wide: a stick. |
| Paw | pad row on `y = 0`, toe box `2` cells in front | toe step `1` to `2`, rows `0 .. 1`, heel flush | A paw with no step reads as a stump. |
| Shoulder plate or haunch | `1` cell out of the chest side | `<= 1` cell | A larger step reads as a brick on the side. |
| Leg columns to leg joint (X) | `0.125` voxels | `<= 1` voxel | A leg far from its bone swings wide. |

Breed changes stay in the contract: a pug or corgi has a `7`-wide skull on an `11`-wide chest
(`7 / 11 = 0.64`); a cat or fox has a `5`-wide skull on a `7`-wide chest (`5 / 7 = 0.71`); a horse has a
`5`-wide skull on an `11`-wide barrel (`5 / 11 = 0.45`) and eyes on the sides of the head.

### 10.3 Segments and joints

A voxel segment is rigid (section 3). The rules below keep the segments in one piece in each clip.

1. **The joint is in its segment.** A joint is at most `1` voxel outside the cells of its segment on
   Y and Z (`maxPivotOutsideVoxels`). A segment turns about its joint: cells that are far from the
   joint fly off.
2. **A segment reaches the joint of its child and touches its child.** The upper leg goes down to the
   knee joint. The two segments share one row at the joint, and one of them has a pad.
3. **Each animated joint of a chain has a segment.** Do not skip a joint between two segments. The
   first pug had no segment on the upper arm: the forearm joint moved `7.8` voxels in relation to the
   chest segment in the run clip. `CreatureSculptor` reads the clips and names each joint that a sculpt skips.
4. **A joint with no visible part gets a hidden link.** A scapula or a pelvis joint is inside the
   trunk. Give it cells inside the trunk, in the columns of its leg and two cells thick. When the
   joint turns far, the link shows as the top of the leg. A thin plate shows as a spike.
5. **The trunk follows the spine joints.** Use one segment for each spine joint that the clips move:
   hips, waist, ribs, chest. The segment that the front legs hang on is the chest. A narrower
   segment goes into its neighbour, thus no hole opens when the spine bends.
6. **Coincident faces need a pad.** When two segments both show a face of the same cell, one of them
   needs a larger pad. The build names the cell. `CreatureSculptor.seg(pad=n)` takes pad levels
   (`n * 2.5%` of a voxel). `creature_segment(pad=JOINT_PAD)` takes metres.
7. **The bind is `inverse(W_j @ IBM_j)`.** `W_j` is the rest world matrix of the joint node and `IBM_j`
   is its inverse bind matrix. The sculptor stores each vertex with this matrix. The skinned rest
   pose is then the sculpt for a rig with a scale (`100` on the wolf armature), a rotation or
   changed bind matrices (the pug). Do not sculpt in the bind space of a joint.

### 10.4 Head and face

```
Guard Hound head, side view (rows 20 .. 27, +Z to the right)

row 27        e                 ear tip
row 26        e e               ears: 1 cell thick on x = +-2, 2 cells deep
row 25    S S S S S B           top skull row. B = brow bar, 1 cell in front of the skull
row 24    S S S S E             E = eye: in the front cells of the skull, directly below the brow
row 23    S S S S S M M M M N   upper muzzle, nose on the tip
row 22    S S S S S m m m m m   lower muzzle (light)
row 21    S S S j j j j j j f   jaw segment, f = fang below the muzzle tip
row 20          j j j j j       chin: 1 cell shorter than the jaw row above
```

- **Eyes are flush.** Make them with `Sculpt.eyes()`: a pair of cells in the surface of the skull.
  The build stops an eye that is behind another cell, in a pit between proud cells, or proud of the
  skull. A horse has `facing='side'`.
- **Eyes are in the head segment.** Do not bind an eye to an eye joint and do not cut a socket for
  it. The eye of the first corgi moved `8.8` voxels in one clip.
- **A brow is one bar.** It is on the top skull row, as wide as the skull and `1` cell in front of
  it (`maxBrowOverhangVoxels`). Keep the skull colour on the top of the skull. A slab that covers the
  top and a crown on it read as a cap.
- **A pet has no brow.** The corgi, the pug and the cat have dark flush eyes above the muzzle.
- **Glowing eyes** use `vox('accent', emissive=True, mottle=False)`, `2` wide and `1` tall. Dark eyes
  and noses use `vox('visor', -0.25, mottle=False)`.
- **Ears are one cell thick.** A dog ear is on `x = ±2`, two cells deep, with a one-cell tip. A cat
  or a corgi ear is thin on Z and faces the front. A folded pug ear is a flush dark triangle on the
  skull side: a block on the side reads as headphones.
- **Cheek fur and masks are paint.** Paint the surface cells of the skull. A box one cell out of the
  head widens the face and reads as a brick.

### 10.5 Legs, paws and tails

- A leg is: an upper segment (`2` wide, `3` to `6` deep, it goes into the trunk), a `2 × 2` lower
  column, and a paw. A long hind leg adds a stepped shank between the haunch and the column.
- A paw is the Guard Hound paw: a dark pad row on `y = 0` and a toe box on row `1` in front of the
  column. The column goes down to row `1`.
- A rig with one joint for a leg (the corgi) uses two sculpts on that joint: the column
  (`role='front_lower'`) and the paw (`role='front_paw'`). The column goes up to the joint inside
  the body.
- A tail follows its joints. Each tail joint gets a short segment from its joint to the next joint.
  A tail that hangs from a level tail chain tears off (the first horse: `5.8` voxels).
- A rig with IK feet (the Quaternius wolf) keeps the paws on the IK foot joints. The audit measures
  the gap between a paw and the leg that it touches.
- `CreatureSculptor.export_glb` does not copy scale channels. A bone with a scale makes voxels that
  are not cubes.

### 10.6 Palette

- Each region that a creature shows as a **mottled surface** has a relative luminance of `0.03` or
  more: coats, masks, saddles, stockings and paw pads. `CreatureSculptor` checks this on the sculpt
  and `validate:creature` checks it on the built mesh.
- A darker colour is for a sharp feature only, with `mottle=False`: a nose, a pupil.
- The pack presets keep the garment check of section 7 (`primary`, `secondary`, `leather`). The
  Guard Hound uses `hair` only for its nose, its pads and its mouth.

### 10.7 Motion checks on the built file (`creature.motion`)

`src/creatureAudit.ts` loads the built GLB, skins it, and samples each clip.

| Measure | Limit | Guard Hound | First animal pass |
| --- | --- | --- | --- |
| Scale or shear of a bone that owns voxels | `2%` | `0%` | `88%` (cat) |
| Gap between a segment and the segment that holds it | `1` voxel | `0.00` | up to `5.8` voxels |
| Distance of a rest-pose vertex from the half lattice | pad + `0.4%` of a voxel | `0` | — |

After the rules of this section the seven animals have `0%` stretch and a largest gap of `0.86`
voxels in `194` clips.

### 10.8 Visual proof for a creature

Render the creature next to the Guard Hound in the rest pose (side, front, head close-up) and in
three phases of its gait. Reject the creature when one answer is no:

1. Trunk: can you count `9`, `5` to `7` and `7` columns on the chest, the waist and the hips?
2. Head: is it `5` wide on the eye row (a stocky breed `7`)? Is it narrower than the chest?
3. Face: are the eyes flush and directly below one brow bar, or flush above the muzzle on a pet?
4. Legs: are the lower legs `2 × 2`? Does each paw have a pad row and a toe step?
5. Sides: is each shoulder or haunch step one cell? Is there a brick on a leg or on the head?
6. Gait: do all segments stay in one piece? Does a plate or a spike come out of the trunk?
7. Dark coats: can you see the `1 × 1` facets?
8. Borders: are the borders of the eyes and the dark patches clean in a close-up?
