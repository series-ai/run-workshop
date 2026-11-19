# Teardown-Style Voxel Character Authoring Guide

Use this guide when you add a character, a head, a hair style, an outfit, a hat, a held item, a
creature or a world prop to `tools/run-voxel-characters`. It applies to a human author and to a
model (Claude, Fable, Gemini, Codex).

[`art-direction.md`](art-direction.md) gives the reason and the measured value of each rule. This
guide gives the steps and the code.

---

## 1. Checklist (each item is a rule)

1. **Measure the reference first.** Count the voxel columns and rows on the head, the chest, the
   arm and the leg of the reference. A Teardown human is `38–39` voxels tall.
2. **One voxel size.** A human uses `CHAR_VOX = 0.05 m` for the body, the outfit, the head, the
   hair and the headwear. Do not use a smaller voxel for the head.
3. **Sculpt on the lattice.** Use `core.seg()` with the row and column constants of
   `build_core.py`. The lattice is the T-pose of the default humanoid proportions: the runtime then
   shows each voxel as a cube.
4. **Orthogonal faces only.** Build with `VoxelGrid` and `VoxelPart` (`blender/voxchar.py`).
5. **One bone for each segment** (weight `1.0`).
6. **Long, deep face.** The skin skull is `3 × 5 × 4` (`H/W = 1.67`, `4` deep front-to-back). Its
   width is `38%` to `50%` of the chest width. Do not make it wider.
7. **Head envelope.** The hair or the headwear is `5` wide: one voxel out of the skull on each
   side (`5 × 7` envelope). Its width is `65%` or more of the chest width.
8. **Sturdy neck, chin overhang, limbs, and shoes.** The neck (`2 × 5 × 2`, `NECK_Y = (28, 32)`)
   uses `half_x=True` only (`NECK_Z = (-1, 0)` = `-0.05 .. +0.05 m`), anchoring `2` blocks into the
   torso and dipping into a `1`-block front neckline pocket (`open_neck=True`) so it visibly enters
   the shirt while keeping `1` block exposed above the shoulders below the `2`-voxel (`10 cm`) chin
   overhang of the `4`-deep skull (`HEAD_Z = (-1, 2)`). Bare arms are `2 × 2`; thighs are `3 × 3`;
   bare calves are `2 × 2` (`CALF_X`, `half_x=True`) and trouser/boot calves are `3 × 2`
   (`TROUSER_CALF_X`). Shoes sit flush at the calf back (`FOOT_Z = (-1, 1)` + `TOE_Z = (2, 2)`),
   `wide=True` under trousers/boots and `wide=False` under shorts. The chest is `7 × 3`.
9. **Face from a face map.** Three columns: eye, nose, eye. Five rows: forehead (`35`), eyes
   (`34`), nose (`33`), mouth (`32`), lit chin (`31`). Each eye is one flush voxel on `z = 2` (do
   not carve `-` pits into the eye row). The ears are one voxel out of the skull on rows `33 .. 34`,
   `z = 0` (`2` cheek columns ahead).
10. **Warm face tones.** Cheeks and lips are skin shades. Keep the front chin lit (`s`/`L`) and
    never blend it into `SKIN_WARM` like the neck. No saturated red mouth. No neon eye.
11. **Features below an overhang are flush.** The game camera looks down at the head.
12. **Sharp features.** Eyes, lenses, lips, badges, buckles and LEDs have `mottle=False`.
13. **Flat torso box.** Use `core.shirt_torso()`: a trunk and a yoke that you paint as one box.
14. **Stepped garments.** A collar, a jacket sleeve, a vest, a pouch and a knee pad step out by one
    voxel.
15. **Dark-albedo floor.** `primary`, `secondary` and `leather` have a relative luminance of `0.03`
    or more (`#333333` or lighter).
16. **Triangle budget.** Composed character `<= 2,200`. Head `<= 280`, hair `<= 220`,
    torso `<= 700`, legs `<= 520`, headwear `<= 360`, back `<= 320`, held `<= 400`, prop `<= 650`.
17. **Visual proof.** Make the comparison sheets (section 9) and examine each sheet.

`npm run validate` checks items 2, 3, 4, 5, 6, 7, 8, 15 and 16.

A creature has its own checklist in section 7. The build checks each item of it.

---

## 2. Palette and voxel helpers

```python
import build_core as core
import voxchar as vk
from voxchar import vox

# vox(region, shade, mottle=True, emissive=False)
# Regions: skin, hair, primary, secondary, accent, metal, trim, leather, visor, detail.
# Shade: -1 (dark) to +1 (bright). One level is 0.125. Use multiples of 0.125.

core.SKIN          # base skin
core.SKIN_LIGHT    # +0.125  highlight (forehead, nose, lit chin center)
core.SKIN_WARM     # -0.125  ears, under-jaw, temples, neck
core.SKIN_BLUSH    # -0.25   cheek blush
core.SKIN_CORAL    # -0.375  deep blush on the cheekbone
core.SKIN_LIP      # -0.5    lips (mottle off)
core.SKIN_SOCKET   # -0.75   soft brown eye socket (mottle off)

JACKET = vox('primary')
JACKET_TRIM = vox('primary', -0.25)
BADGE = vox('accent', 0.375, mottle=False)        # sharp, no mottle
LED = vox('accent', emissive=True)                # glow
```

The shader turns the dark skin shades rosy. Thus a cheek or a lip needs no palette region.

Palette values for a new preset:

| Region | Rule | Example |
| --- | --- | --- |
| `skin` | Peach, not orange | `#f2b792` |
| `visor` (eyes, lenses) | Blue-teal or slate-teal, not neon | `#3a93bd`, `#3f8f9c` |
| `primary`, `secondary`, `leather` | Relative luminance `>= 0.03` | charcoal tee `#4a423f` |
| `detail` | Red cloth, paint, pouches. Not lips. | `#cf3e32` |

---

## 3. Recipe: a head (slot `head`)

Start from `core.head_base()`. It makes the `3 × 5 × 4` skull (`HEAD_Z = (-1, 2)`), shades only
the rear jaw above the neck `SKIN_WARM` so the `2`-voxel forward chin stands cleanly apart, and
adds the `1 × 2` ears at `z = 0`. Then paint the face with two maps of `3 × 5` letters.

```python
def head_field_medic():
    """Calm medic: flush grey-blue eyes, soft cheeks, 1-wide mouth, lit chin."""
    part = vk.VoxelPart('head_field_medic', covers=(core.TAG_HEAD,))
    grid = core.head_base(part)
    core.paint_face(grid, (
        'wLw',    # row 35  forehead: warm temples, highlight
        'EwE',    # row 34  eyes: one voxel each
        'cnc',    # row 33  cheek blush, nose
        'wmw',    # row 32  mouth: a flush skin tone
        'wsw',    # row 31  lit chin front
    ), core.NOSE_RELIEF, {
        **core.FACE_TONES,
        'E': vox('visor', -0.125, mottle=False),
    })
    return part
```

Rules for the maps:

- The rows go from row 35 down to row 31. Column `0` is `x = -1` (the right side of the character).
- `.` in the tone map keeps the skull color. A cell with relief must have a tone.
- The relief map has the same shape: `.` flush (`z = 2`), `+` one voxel proud (`z = 3`), `-` one voxel recessed (`z = 1`).
- `FACE_TONES` holds the shared letters: `L s w c C m o n B`. Add a letter for an iris, a frame, a
  beard or a plate.
- Eyes: one flush voxel (`.`) on `x = ±1`, row 34 (`z = 2`). Do not carve `-` pits into the skull
  face plane — it creates hollow black sockets (use a flush warm brown like `vox('leather', -0.125, mottle=False)` for dark eyes).
- Cheeks: `c` or `C` on row 33 (nose row).
- Mouth: `m` on row 32, 1 or 2 wide, kept flush (`.`) on clean-shaven heads so it does not carve a
  deep hole into the skull.
- Nose: `n` proud on row 33 (or proud brows on row 35 for Chris).
- Chin: row 31 stays lit (`s`, `L`, or `wsw`) so the `2`-voxel overhang above `neck_01` reads clearly.
- A beard is proud on rows `31 .. 32`, with jaw sides (`x = ±2`, 5 wide) and a step on row 30, and
  one tucked peach mouth (`m` proud on row 32). See `head_bearded_craftsman`.
- Glasses/shades: use flush (`.`) lenses on row 34 (`VwV`) without heavy black forehead bars
  above them. See `head_cool_shades`.
- Do not put a part on `x = ±2` of the top row (row 35): `validate.ts` reads the width of the top
  face as the face width.
- The head budget is `280` triangles. A `3 × 5 × 4` face uses `138` to `170`.

Add the head to `HEADS` in `build_core.py`. `core.skinned_mesh()` adds the ragdoll colliders and
the lattice data.

---

## 4. Recipe: hair and headwear

Hair (slot `hair`) uses `core.hair_part(name)`. It gives a part with `covers=('hair',)` and a grid
with `PAD_HAIR`. Do not put `tag='hair'` on the grids of a hair part: a part must not cover its own
regions (`validate.ts`).

```python
def hair_side_part():
    part, grid = core.hair_part('hair_side_part')
    h0, h_hi, h_lo = vox('hair'), vox('hair', 0.25), vox('hair', -0.25)
    grid.fill(-core.SIDE, core.CROWN, core.NAPE, core.SIDE, core.CROWN, core.FRONT, h0)        # 5-wide cap, row 36
    grid.fill(-core.SIDE, core.CROWN + 1, core.NAPE, core.HALF, core.CROWN + 1, core.FRONT, h_hi)   # top row, off center
    grid.fill(-core.HALF, core.HEAD_NOSE_Y, core.NAPE, core.HALF, core.TOP, core.NAPE, h_lo)   # nape
    for side in (-core.SIDE, core.SIDE):
        grid.fill(side, core.TOP, core.NAPE, side, core.TOP, core.HEAD_EAR_Z + 1, h_lo)        # sideburns, row 35
    return part
```

- The cap on row 36 is `5` wide (`x = -2 .. 2`) and flush with the face plane (`z <= FRONT = 2`). The
  forehead row (`35`) then stays in view. A fringe overhang (`z = FRINGE = 3`) covers half of the width
  at most.
- Sideburns on row 35 keep the ears (rows `33 .. 34`, `z = 0`) in view. Longer side panels hide the ears.
- Use three tones and an off-center top row. A symmetric stepped crown reads as a hat.
- A hair part must be `5` wide: `validate.ts` stops a head envelope below `65%` of the chest.

Headwear (slot `headwear`) uses `core.hat_slab()` for a band, a cuff or a brim.

```python
def headwear_flat_cap():
    part = vk.VoxelPart('headwear_flat_cap', covers=('hair',))
    shell = core.HEAD_SHELL
    front_shell = core.HEAD_FRONT_SHELL
    back, front = core.HEAD_Z
    grid = core.seg(part, 'Head', (-shell, shell), (core.HEAD_BROW_Y, core.CROWN_Y + 1), (-shell, front_shell),
                    pad=core.PAD_HEADWEAR)
    hair = vox('hair', -0.125)
    for side in (-shell, shell):
        grid.fill(side, core.HEAD_BROW_Y, -shell, side, core.HEAD_BROW_Y, core.HEAD_EAR_Z + 1, hair)   # sideburns
    core.hat_slab(grid, core.CROWN_Y, vox('secondary', -0.25))                                       # band on row 36
    grid.fill(-shell, core.CROWN_Y, front_shell, shell, core.CROWN_Y, front_shell, vox('secondary', -0.25))   # peak
    grid.fill(-shell, core.CROWN_Y + 1, -shell, shell, core.CROWN_Y + 1, front, vox('secondary'))             # crown
    return part
```

- A cap, a hard hat, a bucket hat, and a beanie cuff sit on row 36 (`CROWN_Y`); a bandana wraps the
  forehead row (`HEAD_BAND_Y = HEAD_BROW_Y = 35`).
- Set `hides_hair=True` in the part table for a full hat or a helmet. Set `False` for a headband.
- A hat that hides the hair must carry its own hair (sideburns, a nape, a bob). See
  `headwear_sec_peaked_cap` and `headwear_red_bob_hat`.

---

## 5. Recipe: an outfit (slots `torso` and `legs`)

A torso part covers `chest` (`core.TORSO_COVERS`). A torso part with long sleeves also covers the
arms (`core.SLEEVED_TORSO_COVERS`). A legs part covers `core.LEGS_COVERS`.

```python
def torso_work_polo():
    part = vk.VoxelPart('torso_work_polo', covers=core.TORSO_COVERS)
    shirt, trim = vox('primary'), vox('primary', -0.25)
    torso = core.shirt_torso(part, shirt, hem=trim)        # 7 x 3 box, rows 20..29: trunk and yoke
    badge_y = core.SHOULDER_Y - 3                          # rows 26..27: in the trunk
    torso.fill(1, badge_y, core.TORSO_FRONT, 2, badge_y + 1, core.TORSO_FRONT, vox('accent', 0.125, mottle=False))
    core.low_collar(part, trim)                            # 1-voxel collar on row 30 (leave off for flat tees)
    core.short_sleeves(part, shirt, trim)                  # flush sleeves with a rolled cuff
    return part
```

The torso box:

- `shirt_torso()` returns a `TorsoBox`. Paint it with `fill`, `set`, `set_sym` and `clear` in
  lattice rows. The trunk (rows `20 .. 27`, `spine_02`) and the yoke (rows `28 .. 29`, `spine_03`)
  get the paint that is in their rows. By default `open_neck=True` clears `(-1..1, SHOULDER_Y, TORSO_FRONT)`
  so the `2 × 5 × 2` neck drops visibly `1` block into the chest instead of sitting on top; use
  `open_neck=False` only with a 4-sided `core.low_collar(..., turtleneck=True)`. Keep `core.low_collar()`
  on row `30` (`COLLAR_Y`) for jackets, vests, aprons, coveralls, scarves, and guard shirts.
- Keep a badge, a pocket or a patch in one piece: rows `<= 27` or rows `>= 28`.
- `y=(core.BELT_Y, core.SHOULDER_Y)` starts the box on the belt row (a tunic, an apron).
  `grid_y` and `z` make the grids larger for a skirt, a pouch or an antenna.
- Belt gear that must stay on the hips is a `pelvis` grid with `PAD_BELT`. See
  `torso_sec_guard_shirt`.
- A back item is on `spine_02`: it moves with the trunk.

Sleeves and arms:

- Bare arm: `ARM_Y`, `ARM_Z` (`2 × 2`).
- Short sleeve: `core.short_sleeves()` or `SLEEVE_SHORT_X` with `core.paint_short_sleeve()`. It is
  flush on the arm with `PAD_GARMENT`.
- Jacket / coverall / tunic sleeve: flush on `ARM_UPPER_X`, `ARM_Y`, `ARM_Z` with
  `PAD_GARMENT_OUTER` (matching the forearm on `ARM_LOWER_X` with `PAD_GARMENT_OUTER`). Put a cuff
  on the last forearm columns. (`SLEEVE_Y`/`SLEEVE_Z` + `SLEEVE_LATTICE` is only for oversized
  forearm gauntlets, not shoulders.)
- Start an upper-arm sleeve at `ARM_UPPER_X[0]` (`4`). That cell is the shoulder cap.
- Gloves: `core.claw_hands(part, palm=..., fingers=..., pad=...)` and add `'hands'` to the covers.

Layers:

- Outer layer (vest, apron, plate, pouch): `z = TORSO_FRONT + 1` and `z = TORSO_BACK - 1`.
- Pads: `PAD_JOINT` (`0.001`), `PAD_GARMENT` (`0.002`), `PAD_GARMENT_OUTER` (`0.004`), `PAD_BELT`
  (`0.005`), `PAD_BACK` (`0.006`).
- Legs: use `core.trouser_hips()` and the leg helpers of `build_heist.py` (`trouser_legs`) or
  `build_industrial_security.py` (`limb_pair`). The thigh has `PAD_JOINT`. Use `TROUSER_CALF_X`
  (`3 × 2`) + `core.shoes(..., wide=True)` for trousers and boots, or `CALF_X` (`2 × 2`,
  `half_x=True`) + `core.shoes(..., wide=False)` for bare calves and shorts. End the calf at `CALF_Y[0]`
  above the shoe, and use dark `leather` (not `metal`) for dark boot soles so `toneFloor` does not
  lift them to grey.

Proportions and clips:

- The default proportions are `contracts/data/proportions.json` → `humanoid.defaults`. The meshes
  are sculpted for them. Do not change them for one character. If you change them for all
  characters, the build tells you when a rig pivot is off the lattice (`load_pose`).
- A preset can change the proportions (`proportions={...}`). Its voxels are then not exact cubes.
  Keep the change small. Run `npm run validate` after a change: the animation audit checks the
  preset clip.
- A body with a build morph (`body_slim`, `body_heavy`) makes the garments thinner or thicker. Use
  `body_athletic` for exact cubes.
- A held item needs a clip with a closed grip: `Idle_Torch_Loop`, `Sword_Idle`, `Pistol_Idle_Loop`,
  `Pistol_Aim_Neutral` or `Idle_Loop` for `hand_r`; `Idle_Torch_Loop` or `Idle_Loop` for `hand_l`.

---

## 6. Recipe: a held item

A held item is a static part. The grip origin `(0, 0, 0)` is in the grip channel of the C-claw.

- `+Y` is the shaft, `+Z` is the forward direction, `+X` is the palm side.
- For `hand_r`, `minX >= -0.032 m`. The item then stays clear of the back of the hand.
- Use `HELD_VOX` (`0.026 m` to `0.028 m`) for a tool with fine detail. Use `core.CHAR_VOX` for a
  large tool (the sledgehammer): its one-voxel shaft fills the `5 cm` grip channel.

```python
def held_mallet():
    part = vk.VoxelPart('held_mallet')
    grid = part.add_grid(vk.VoxelGrid(0, 1, -5, 16, -2, 2, voxel_size=core.HELD_VOX, center_x=True, center_z=True))
    grid.fill(0, -5, 0, 0, 13, 0, vox('leather', 0.125))       # shaft
    grid.fill(0, 14, -2, 1, 16, 2, vox('metal', -0.375))       # head
    return part
```

---

## 7. Recipe: world props and creatures

- **World prop**: `voxel_size = PROP_VOX` (`0.05 m`), `min_y = 0`, symmetric X and Z bounds with
  `center_x=True, center_z=True`. `prop_entry` checks that the prop stands on `y = 0` and is centered.

### Creature checklist (each item is a rule of `art-direction.md` section 10)

The Guard Hound (`blender/build_creatures.py` → `build_guard_hound`) is the reference. Read it first.

1. **Measure the rig first.** Print the rest position of each joint in voxels, its parent, and
   which joints the clips move. You need these numbers for items 5 to 8.
2. **Use the kit.** Sculpt with `creature_kit.Sculpt`. Bind with `creature_segment` (a rig of
   `contracts/data/*-rig.json`) or `CreatureSculptor` (an external glTF rig). Do not call
   `custom_segment` with a joint position: the limbs then leave the lattice.
3. **Author in creature space**: `+Y` up, `+Z` forward, `+X` left, world lattice cells. For a rig that
   faces `+X`, pass `forward='+X'`. Author the left limbs and mirror them.
4. **Step the trunk**: chest `9`, waist `5` to `7`, hips `7` (waist / chest `<= 0.8`).
5. **Head**: `5 × 5 × 5` skull, `3`-wide muzzle. The head is `0.5` to `0.8` of the chest on the eye row.
6. **Each animated joint of a chain has a segment.** The segment has its joint inside it, reaches
   the joint of its child, and touches its child. A scapula or a pelvis joint gets a hidden link in
   the columns of its leg, inside the trunk.
7. **Lower legs are `2 × 2`** below the leg joint, at most one cell out of the chest side.
8. **Paws**: a pad row on `y = 0` and a toe step of `1` to `2` cells. Give each trunk, head,
   lower-leg and paw sculpt its `role`.
9. **Eyes**: `Sculpt.eyes()`, flush, in the head segment. A brow is one bar, one cell out. A pet has
   no brow.
10. **Ears are one cell thick.** Cheek fur, masks and folded ears are paint, not boxes.
11. **Pads**: two segments that share surface cells have different pads. The build names the cell.
12. **Palette**: each mottled region is `0.03` or more. A darker nose or pupil has `mottle=False`.
13. **Visual proof**: rest pose (side, front, head close-up) and three gait phases next to the
    Guard Hound (`art-direction.md` section 10.8).

The build checks items 2 to 12 except the skull size and the ear thickness. `npm run validate` and
`npm run validate:creature` check the lattice, the silhouette, the palette and each clip again on
the built file.

### A quadruped on a contract rig (the creature packs)

```python
from creature_kit import QuadrupedAudit, Sculpt

def build_guard_hound(rig):
    part = vk.VoxelPart('body_dire_wolf')
    coat, tan, eye = vox('primary'), vox('skin'), vox('accent', emissive=True, mottle=False)
    audit = QuadrupedAudit(part.name, VOXEL, QUADRUPED_CONTRACT['parents'])

    def seg(bone, sculpt, **options):
        creature_segment(part, rig, bone, sculpt, audit=audit, **options)

    seg('pelvis', Sculpt().box((-3, 3), (13, 19), (-12, -3), coat), role='trunk')     # hips 7
    seg('spine_01', Sculpt().box((-2, 2), (14, 18), (-5, 3), coat), role='trunk')     # waist 5
    seg('chest', Sculpt().box((-4, 4), (12, 21), (8, 13), coat), role='trunk')        # chest 9
    seg('head', Sculpt()
        .box((-2, 2), (21, 25), (15, 19), coat)          # 5 x 5 x 5 skull
        .box((-1, 1), (22, 23), (20, 24), coat)          # 3-wide muzzle
        .eyes((1, 2), 24, 19, eye)                       # flush, in the front cells of the skull
        .box((-2, 2), 25, 20, vox('primary', -0.3)),     # one brow bar, one cell out
        pad=JOINT_PAD, role='head')
    seg('leg_fl_upper', Sculpt().box((3, 4), (7, 13), (6, 8), coat), mirror=True, pad=JOINT_PAD, role='front_upper')
    seg('leg_fl_lower', Sculpt().box((3, 4), (1, 8), (7, 8), tan), mirror=True, role='front_lower')
    seg('leg_fl_paw', Sculpt().box((3, 4), 0, (7, 10), vox('hair')).box((3, 4), 1, (9, 10), tan),
        mirror=True, role='front_paw')
    # ... neck, jaw, tail and hind legs: see build_creatures.py
    audit.check()                                        # stops the build on a broken rule
    return part.to_mesh(rig, morph=False)
```

### A creature on an external glTF rig

```python
from creature_kit import CreatureSculptor, Sculpt

PALETTE = {'skin': '#efe4cf', 'hair': '#3d3538', 'primary': '#cb5a26', 'secondary': '#93401a',
           'accent': '#ffb02e', 'metal': '#c2cad4', 'leather': '#43322c', 'visor': '#1e1612'}

s = CreatureSculptor('fox_rig.glb', 'voxel_red_fox', 0.052, PALETTE)          # forward='+X' for a +X rig
s.seg('hips', Sculpt().box((-3, 3), (15, 22), (-16, -6), vox('primary')), role='trunk')
s.seg('front_leg_shoulder_l', Sculpt().box((2, 3), (17, 21), (3, 10), vox('primary')),
      mirror_bone='front_leg_shoulder_r', pad=3)                               # hidden scapula link
s.seg('front_leg_upper_l', Sculpt().box((3, 4), (9, 17), (7, 10), vox('primary')),
      mirror_bone='front_leg_upper_r', pad=2, role='front_upper')
# ... one segment for each animated joint of each chain
stats = s.export_glb('fox_voxel.glb')    # runs the checks, then writes the rig, its clips and the mesh
```

`export_glb` raises one error that lists each broken rule, for example:

```
voxel_timber_wolf: 2 creature rule(s) are broken (docs/art-direction.md section 10).
  1. Segment "BackUpperLeg.L": its joint (cell position 4.0, 15.7, -4.3) is 3.7 voxels on Z outside the segment
     (limit 1). The segment tears off in a clip. Put the cells around the joint, or bind them to the bone whose
     joint is inside them.
  2. Segment "FrontUpperLeg.L" hangs on "Torso2", but the clips move 'FrontShoulder.L' between them and that
     joint has no segment. ...
```

Then check the built file:

```bash
npm run validate:creature -- fox_voxel.glb
# OK   fox_voxel.glb: 946 tris, 34 segments, voxel 0.052, 21 clips, max stretch 0.0%, max segment gap 0.21 voxels
```

- A spider or a bot that is not a quadruped uses `CreatureSculptor(..., quadruped=False)`: the
  silhouette checks do not run, the lattice, pad, joint, palette and motion checks do.
- A creature body has `1,100` triangles maximum (the `body` budget). The seven animals use `506` to `946`.

---

## 8. Build and validate

```bash
cd tools/run-voxel-characters
npm run build        # Blender scripts -> out/jam-stage and out/meta/manifest.json
npm run catalog      # showcase catalogs -> games/voxel-character-showcase/public/catalog
npm run validate     # normals, rigid weights, budgets, sculpt lattice, silhouette ratios, dark floor, ragdolls,
                     # creature lattice + quadruped silhouette + clip motion, animation audit
npm run validate:creature -- <creature.glb>   # the creature checks on a file of CreatureSculptor
npm run typecheck && npm test
```

`npm run build` writes `out/meta/humanoid-pose.json` (the sculpt pose) before it starts Blender.
`npm run validate` skins each part in the sculpt pose, checks the lattice and prints the measured
silhouette, for example
`Silhouette: face 0.150 m / chest 0.358 m = 42%, hair 0.254 m = 71%, neck 0.100 m, bare arm 0.100 m.`

---

## 9. Visual proof

```bash
cd tools/run-voxel-characters
node scripts/verify-visual.mjs       # all presets, stages and the perf bench -> out/previews

VERIFY_OUT=/tmp/voxchar-shots VERIFY_DPR=2 VERIFY_CLIP=Idle_Loop node scripts/verify-visual.mjs
python3 scripts/compare-references.py --shots /tmp/voxchar-shots \
    --references <dir with the ref_*.png stills> --out <dir> --version v6 \
    [--previous <dir with the shots of the earlier version> --previous-label v5]
```

Examine each `cmp_*.png` sheet. Do these checks on each character:

1. Voxels: can you count `3` columns on the face, `5` on the head with its hair, `7` on the chest?
2. Face: is it `3` wide × `5` tall × `4` deep (`15 × 25 × 20 cm`) with two cheek columns ahead of the ear (`z = 0`), flush eyes (`.`) on `z = 2`, and a crisp `2`-voxel (`10 cm`) chin overhang above the neck? Can you see two eyes, a nose and a mouth?
3. Head: does the hair or the hat give the head its width?
4. Neck and arms: are the neck and bare arms `2 × 2`, does the neck sit flush with the torso/skull back (`NECK_Z = (-1, 0)` without `half_z=True`) and dip `1` block into the shirt neckline cutout (`open_neck=True`) below the chin overhang, and is the shoulder cap level with the chest top?
5. Torso: is the shirt front one flat box?
6. Tones: is the mouth a skin tone? Do the cheeks show a blush?
7. Dark garments: can you see the `1 × 1` voxel facets?
8. Hats and packs: does a part go through the head?

If one answer is no, change the part and make the sheets again.

For a creature, use the eight checks of `art-direction.md` section 10.8.
