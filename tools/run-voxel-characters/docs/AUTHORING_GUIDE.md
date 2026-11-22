# Canonical Voxel Character Authoring Guide

Use this guide when adding a character, head, hairstyle, outfit, hat/helmet, held item, forearm
shield, bipedal monster, creature, or world prop to `tools/run-voxel-characters`. It gives exact
Python recipes, lattice constants, shader pitfalls, and validation rules for LLMs and human artists.

[`art-direction.md`](art-direction.md) documents the rationale and measured target values for every rule.

---

## 1. Master Checklist

1. **Measure & pick the right voxel tier.**
   - Humanoids & bipedal monsters: `CHAR_VOX = 0.05 m` (`38–39` voxels tall = `1.90–1.95 m`).
   - Snug humanoid headwear: `HAT_VOX = 0.025 m` (`CHAR_VOX / 2`, `origin=(0,0,0)`, `center_*=False`).
   - Detailed held items & shields: `HELD_VOX = 0.026–0.028 m` (two-handed sledgehammer uses `CHAR_VOX`).
   - World props: `PROP_VOX = 0.05 m`.
   - Creatures (`rig_scale`): Horse `0.05 m` · Guard Hound / Wolf / Shepherd / Spider / Bot `0.04 m` ·
     Fox `0.03 m` · Small pets (Corgi, Pug, Cat) `0.02 m`.
2. **Sculpt on the lattice.** Humanoids use `core.seg()` in the T-pose of `humanoid.defaults` (`SculptPose`
   ensures runtime voxels render as exact cubes). Creatures use `creature_kit.Sculpt` + `CreatureSculptor`.
3. **Orthogonal faces & rigid single-bone segments.** Weight `1.0` to one bone per segment (`VoxelGrid` /
   `VoxelPart`), never smooth/beveled normals.
4. **Long, deep face (`3 × 5 × 4`).** Skull width is `38%` to `50%` of chest width (`H/W >= 1.5`); `4`
   deep (`HEAD_Z = (-1, 2)`) gives `2` cheek columns ahead of `z = 0` ears and a `2`-voxel chin overhang.
5. **Head envelope (`5 × 7` hair, snug `20–25 cm` headwear).** Hair adds `1` voxel (`5 cm`) per side
   (`>= 65%` chest width). Snug `0.025 m` hats hug at `20–25 cm` wide (`<= 0.36 m` tall).
6. **Sturdy neck, limbs, and flush shoes.** Neck `2 × 5 × 2` (`half_x=True`, regular `NECK_Z = (-1, 0)`)
   drops `1` block into the `open_neck=True` chest socket. Bare arms `2 × 2` with `round_shoulder_cap()`;
   thighs `3 × 3`; bare calves `2 × 2` (`half_x=True`) or trouser calves `3 × 2`; shoes flush at calf
   back (`FOOT_Z = (-1, 1)` + `TOE_Z = (2, 2)`), `wide=True` under trousers/boots.
7. **Flush eyes, warm skin tones, `mottle=False` sharp details.** Keep eyes flush (`.`) on `z = 2` (no
   carved `-` pits). Mouths use skin shade `m` (never `detail` red). Set `mottle=False` on eyes, lenses,
   lips, badges, heraldry, tusks, keypads, and LEDs.
8. **Baked AO mandatory (`bake_ao=True`).** Never pass `bake_ao=False` on humanoids, headwear, monsters,
   held items, or props (`validate.ts` rejects it).
9. **Flat torso box (`core.shirt_torso`) & stepped relief.** Keep badges/pockets within trunk (`<= 27`)
   or yoke (`>= 28`). Step collars (`row 30`), outer vests (`z = ±2`), pouches, and knee pads by `1` voxel.
10. **Dark-albedo floor & material region rules.** `primary`, `secondary`, and `leather` must have WCAG
    relative luminance `>= 0.03` (`#333333` or lighter). **Never use `metal` on dark boot soles** (use `leather`).
11. **Budgets & rig checks.** Composed avatar `<= 2,200` tris (`body <= 1,100`, `head <= 280`, `hair <= 220`,
    `torso <= 700`, `legs <= 520`, `headwear <= 360`, `back <= 320`, `held <= 400`, `prop <= 650`).
12. **Visual proof + Squint Test.** Run `verify-visual.mjs` and check every asset at thumbnail/squint scale.

---

## 2. Palette & 10 zero-texture shader regions

```python
import build_core as core
import voxchar as vk
from voxchar import vox

# vox(region, shade=0.0, mottle=True, emissive=False)
# Shade: -1.0 (dark) to +1.0 (bright) in 0.125 increments (17 levels).
# Set emissive=True on 'accent' voxels to output v = 0.96 (>= 0.92 emissive threshold).
```

| `region` | Rough / Metal | Sky Reflect | Mottle | Palette & Usage Rules |
| --- | --- | --- | --- | --- |
| `skin` | `0.86 / 0.00` | `—` | `±4.8%` + hue | Peach (`#e8aa7e`–`#f2b792`) for humans, never orange. Dark steps tint rosy (`SKIN_BLUSH`, `SKIN_LIP`), then warm brown (`SKIN_SOCKET`). |
| `hair` | `0.78 / 0.00` | `—` | `±6%` | Hair, beards; `mottle=False` for sharp dark animal noses/pads. |
| `primary` | `0.82 / 0.00` | `—` | `±6%` | Main garment / fur / surcoat. **Luminance `>= 0.03`.** |
| `secondary` | `0.82 / 0.00` | `—` | `±6%` | Trousers / mail / secondary coat / rock. **Luminance `>= 0.03`.** |
| `accent` | `0.82 / 0.00` | `—` | `±6%` | Badges, brass/gold trim (`mottle=False`), or glowing lights (`emissive=True`). |
| `metal` | `0.26 / 0.48` | `0.52` | `±6%` | Steel/iron armor, blades, buckles (`metalBoost = 1.18`). **Never use for dark boot soles** (lifts to light grey). |
| `trim` | `0.82 / 0.00` | `—` | `±6%` | Crisp shirts, sneakers, ivory tusks/claws (`mottle=False` for tusks/badges). |
| `leather` | `0.46 / 0.06` | `—` | `±6%` | Boots, dark boot soles, belts, straps, wood handles, dark eyes (`mottle=False`). **Luminance `>= 0.03`.** |
| `visor` | `0.16 / 0.12` | `0.35` | `±6%` | Glossy eyes (blue-teal/slate-teal, `mottle=False`), sunglasses, visors, dark mouth cavities (`mottle=False`). |
| `detail` | `0.82 / 0.00` | `—` | `±6%` | Matte bold cloth/paint (scarves, red hats, crosses, war-paint, lichen) without white specular glare. Never use for human lips. |

---

## 3. Recipe: a human head (`slot = 'head'`)

Start from `core.head_base(part)` — it constructs the `3 × 5 × 4` skull (`HEAD_Z = (-1, 2)`), shades
only the rear jaw above the neck `SKIN_WARM` so the `2`-voxel forward chin pops cleanly, and places
`1 × 2` ears on `z = 0`. Then paint the `3 × 5` face map from row `35` down to row `31` (col `0` = `x = -1`):

```python
def head_field_medic():
    """Calm medic: flush grey-blue eyes, soft cheeks, 1-wide mouth, lit chin."""
    part = vk.VoxelPart('head_field_medic', covers=(core.TAG_HEAD,))
    grid = core.head_base(part)
    core.paint_face(grid, (
        'wLw',    # row 35  forehead: warm temples, highlight
        'EwE',    # row 34  eyes: one flush voxel each
        'cnc',    # row 33  cheek blush, nose
        'wmw',    # row 32  mouth: flush skin lip tone (no carved hole)
        'wsw',    # row 31  lit chin front (contrasts cleanly against neck_01)
    ), core.NOSE_RELIEF, {
        **core.FACE_TONES,
        'E': vox('visor', -0.125, mottle=False),
    })
    return part
```

Face map rules:
- Relief symbols: `.` flush (`z = 2`), `+` proud (`z = 3`), `-` recessed (`z = 1`).
- Keep eyes flush (`.`) on `row 34` and clean-shaven mouths flush (`.`) on `row 32`.
- Keep row `31` lit (`s`, `L`, `wsw`). Keep `x = ±2` of `row 35` empty so `validate.ts` reads true skull width.
- Shared `FACE_TONES`: `L` (`+0.125`), `s` (`0`), `w` (`-0.125`), `c` (`-0.25`), `C` (`-0.375`), `m`
  (`-0.5, mottle=False`), `o` (`-0.75, mottle=False`), `n` (`+0.125, mottle=False`), `B` (brow).
- Budget: `<= 280` triangles (`138`–`170` typical).

---

## 4. Recipe: hair & snug `0.025 m` headwear

### Hair (`slot = 'hair'`)

Use `core.hair_part(name)` (`covers=('hair',)`, `PAD_HAIR = 0.002`). Never tag internal hair grids `tag='hair'`.

```python
def hair_side_part():
    part, grid = core.hair_part('hair_side_part')
    h0, h_hi, h_lo = vox('hair'), vox('hair', 0.25), vox('hair', -0.25)
    grid.fill(-core.SIDE, core.CROWN, core.NAPE, core.SIDE, core.CROWN, core.FRONT, h0)          # 5-wide cap, row 36
    grid.fill(-core.SIDE, core.CROWN + 1, core.NAPE, core.HALF, core.CROWN + 1, core.FRONT, h_hi) # asymmetric top row
    grid.fill(-core.HALF, core.HEAD_NOSE_Y, core.NAPE, core.HALF, core.TOP, core.NAPE, h_lo)     # nape
    for side in (-core.SIDE, core.SIDE):
        grid.fill(side, core.TOP, core.NAPE, side, core.TOP, core.HEAD_EAR_Z + 1, h_lo)          # sideburns row 35
    return part
```

### Snug headwear (`slot = 'headwear'`, `HAT_VOX = 0.025 m`)

Always use `core.hat_seg()` (`HAT_VOX = 0.025 m`, `origin=(0,0,0)`, `center_*=False`, `PAD_HEADWEAR = 0.004`):

```python
def headwear_flat_cap():
    part = vk.VoxelPart('headwear_flat_cap', covers=('hair',))
    grid = core.hat_seg(part, core.HAT_SHELL_X, (core.HAT_BROW_Y, core.HAT_CROWN_Y + 2), (-3, 7))
    hair = vox('hair', -0.125)
    core.hat_fill_sym(grid, 3, 3, core.HAT_BROW_Y, core.HAT_BROW_Y + 1, -3, 2, hair)   # high sideburns above y=66..69 ears/pod
    grid.fill(-4, core.HAT_CROWN_Y, -3, 3, core.HAT_CROWN_Y, 6, vox('secondary', -0.25))  # snug band at y=72 (1.80 m)
    grid.fill(-3, core.HAT_CROWN_Y, 7, 2, core.HAT_CROWN_Y, 7, vox('secondary', -0.25))   # 2.5 cm front peak
    grid.fill(-4, core.HAT_CROWN_Y + 1, -3, 3, core.HAT_CROWN_Y + 2, 5, vox('secondary'))  # crown
    return part
```

Headwear checklist:
- **Open-face caps / hard hats / welding caps**: seat front brim at `HAT_CROWN_Y - 1 = 71` (`1.775 m`)
  with peak at `z = 7..8`, or start front band at `HAT_CROWN_Y = 72` (`1.80 m`) with side/nape cuffs
  at `y = 70..71` behind `z = 5` (clears proud brows at `y = 70..71, z = 6..7`).
- **Closed / visored helmets (`sallet`, `greathelm`, `riot_helmet`)**: widen cheek/ear sides to
  `HAT_BRIM_X = (-5, 4)` across `y = 65..71, z = -3..3` to clear ears and `head_cyber_visor`'s temple
  pod; place solid visors at `HAT_VISOR_Z = 7` with eye slit at `HAT_EYE_Y = 68..69`; for sallets, pair
  a recessed chin **bevor** (`y = 62..65, z = 6`) + rear **lobster tail** (`z = -4..-3`) beneath the `z = 7` visor.
- **Included hair**: when `hides_hair=True`, tuck nape hair (`y = 66..71, z = -3`) and high sideburns
  (`y = 70..71, z = -3..2`), never dropping into `y = 66..69`.
- **Budget & bounds**: `headwearToChestWidth ∈ [0.55, 0.92]`, `maxHeadwearHeight <= 0.36 m`, `<= 360` tris.

---

## 5. Recipe: outfits (`torso`, `legs`, `back`)

```python
def torso_work_polo():
    part = vk.VoxelPart('torso_work_polo', covers=core.TORSO_COVERS)
    shirt, trim = vox('primary'), vox('primary', -0.25)
    torso = core.shirt_torso(part, shirt, hem=trim)        # 7 x 3 box, rows 20..29 (spine_02 + spine_03)
    badge_y = core.SHOULDER_Y - 3                          # rows 26..27 (inside trunk)
    torso.fill(1, badge_y, core.TORSO_FRONT, 2, badge_y + 1, core.TORSO_FRONT, vox('accent', 0.125, mottle=False))
    core.low_collar(part, trim)                            # 1-voxel collar on row 30 (COLLAR_Y)
    core.short_sleeves(part, shirt, trim)                  # flush 2 x 2 sleeves w/ round_shoulder_cap()
    return part
```

- **TorsoBox split**: Trunk is `rows 20..27` (`spine_02`), yoke is `rows 28..29` (`spine_03`). Keep
  pockets/badges strictly inside `<= 27` or `>= 28`. Keep `open_neck=True` unless wearing a 4-sided
  `core.low_collar(..., turtleneck=True)`.
- **Sleeves & shoulder caps**: Use flush `2 × 2` sleeves (`ARM_UPPER_X` starting at `4`, `ARM_Y`, `ARM_Z`)
  with `core.round_shoulder_cap()` (`PAD_GARMENT` for tees, `PAD_GARMENT_OUTER` for jackets/coveralls/tunics).
  Reserve `SLEEVE_Y / SLEEVE_Z / SLEEVE_LATTICE` (`3 × 3`) strictly for armored forearm gauntlets.
- **Gloves**: `core.claw_hands(part, palm=..., fingers=..., cuff=...)` and include `core.TAG_HANDS` in `covers`.
- **Legs & boots**: `core.trouser_hips()` + `3 × 3` thighs (`PAD_JOINT`) + `TROUSER_CALF_X` (`3 × 2`) +
  `core.shoes(..., wide=True)` (or `CALF_X` + `wide=False` for shorts). Stop calf at `CALF_Y[0] = 2`. Use
  `leather` (not `metal`) for dark boot soles.

---

## 6. Recipe: held items & forearm shields

### Handle weapons & tools (`grip_style = 'handle'`, default)

Origin `(0, 0, 0)` sits in the C-claw grip channel; `+Y` is the shaft, `+Z` is forward, `+X` is toward
the palm for `hand_r`. Enforce `minX >= -0.032 m` (`hand_r`) or `maxX <= +0.032 m` (`hand_l`).

```python
def held_mallet():
    part = vk.VoxelPart('held_mallet')
    grid = part.add_grid(vk.VoxelGrid(0, 1, -5, 16, -2, 2, voxel_size=core.HELD_VOX, center_x=True, center_z=True))
    grid.fill(0, -5, 0, 0, 13, 0, vox('leather', 0.125))       # shaft
    grid.fill(0, 14, -2, 1, 16, 2, vox('metal', -0.375))       # head
    return part
```

### Forearm-mounted shields (`grip_style = 'forearm_shield'`, `hand_l` only)

Never mount shields off the thumb edge into the thigh. Mount the board flat on the **outer left forearm
(`+X_held >= 0.098 m`, `maxX >= 0.115 m`, `minX >= -0.05 m`)**, place the grip bar at `(0, 0, 0)` with a
pinky-side standoff, and wrap an open `leather` forearm strap near the elbow at `-Z <= -0.14 m`:

```python
def held_shield():
    part = vk.VoxelPart('held_custom_shield')
    grid = static_grid(part, (-1, 5), (-5, 5), (-10, 5), core.HELD_VOX)  # HELD_VOX = 0.028 m
    grid.fill(0, -2, 0, 0, 2, 0, LEATHER_DARK)                            # fist bar at (0,0,0)
    grid.fill(1, -2, 0, 3, -2, 0, LEATHER_DARK)                           # pinky standoff to x=+4 board
    grid.fill(-1, -2, -7, -1, 3, -7, LEATHER_DARK)                        # open elbow strap (-0.196 m <= -0.14 m)
    grid.fill(0, -2, -7, 3, -2, -7, LEATHER_DARK)
    grid.fill(0, 3, -7, 3, 3, -7, LEATHER_DARK)
    grid.fill(4, -4, -9, 4, 4, 4, METAL)                                  # outer forearm shield face (x >= +0.112 m)
    return part
```

- Pass `{'grip_style': 'forearm_shield'}` in the `HELD` table so `PolyAvatar.tsx` shifts it for thicker
  forearms and `validate.ts` applies forearm rules.
- **Clip rule**: Presets carrying a `hand_l` shield **must use `Idle_Loop` or `Idle_Torch_Loop`** (never
  `Sword_Idle`, which opens `middle_03_l` past `z = 0.05` and fails `assertHeldPresetClips`).

---

## 7. Recipes: bipedal monsters, creatures & world props

### World props (`slot = 'prop'`)
- `PROP_VOX = 0.05 m`, `center_x=True, center_z=True`, grounded at `y = 0` (`|min.y| <= 0.015 m`).
- Height `>= 0.20 m`, at least `3` unique UV shade/region tones, `bake_ao=True`, `<= 650` triangles.

### Bipedal monsters (`body_orc_*`, `body_troll_*`, `body_ogre_*`)

Use `creature_kit.Sculpt` (`Sculpt.cut()`, **not** `.clear()` — `VoxelGrid` uses `.clear()`) written onto
`core.seg(...)` grids so UAL1 `SculptPose` and morphs work seamlessly:

```python
# Key proportions & geometry guards (see build_orcs_trolls.py):
# 1. Bridge chest out to x=(-5, 5) on rows 27..29 and start upperarm_l at x=4:
#    `proportions.ts` scales clavicle.x ~15x faster than spine_03.x with shoulderWidth, so narrow chests gap!
# 2. Pair legRatio=0.78 with height in 0.96..1.14 (higher height with short legs stretches torso voxels).
# 3. Keep forearm in y=(28, 30), z=(-1, 1) and thigh in x=(1, 3), z=(-1, 1) so limbThickness 1.22..1.32
#    clears thighs cleanly in Idle_Loop / Idle_Torch_Loop / Sword_Idle.
# 4. Sink skull (y=29..36, z=0..5 >= 0.24 m deep), protrude underbite chin (z=5), carve dark open mouth
#    (y=31, z=3, open air at z=4) under a heavy brow ridge (z=3..5), add rising IVORY tusks (z=5),
#    hunched back arch (y=29..33), hide/tasset loincloth (never boxer briefs), and 5-long clawed feet (z=-1..3).
```

### Quadrupeds & external-rig creatures (`creature_kit.py`)

Read `build_guard_hound` (`build_creatures.py`) and `build_animals.py` first:

1. **Measure rig joints & active clip tracks first.** Never skip an animated joint in a limb/tail chain
   (hidden `2`-cell trunk links for animated scapulas/pelvises).
2. **Author in `+Y` up, `+Z` forward, `+X` left** (`forward='+X'` for `+X`-facing rigs) using world
   lattice cells and `rig_scale` mapped to real-world voxel tiers (`0.05` horse, `0.04` hound/wolf/gsd,
   `0.03` fox, `0.02` corgi/pug/cat).
3. **Quadruped contract (`QuadrupedAudit`)**: stepped trunk (`waist / chest <= 0.8`), eye-row skull width
   `0.44..0.80` of chest, `2 × 2` lower legs, `1..2`-cell paw toe step on `y = 0..1`, `<= 1`-cell
   shoulder/haunch plates, `<= 1`-voxel joint offset, `1`-cell thick ears, flush `Sculpt.eyes()`.
4. **Palette**: every mottled surface region `luminance >= 0.03`; darker noses/pupils use `mottle=False`.
5. **Check standalone GLBs**: `npm run validate:creature -- <creature.glb>` (`<= 2%` stretch, `<= 1` voxel gap).

---

## 8. Build, validate, and Squint Test

```bash
cd tools/run-voxel-characters
npm run build        # Blender 5.1 -> out/jam-stage/ + out/meta/manifest.json
npm run catalog      # Export catalogs -> games/voxel-character-showcase/public/catalog/
npm run validate     # Normals, rigid weights, budgets, AO, sculpt lattice, silhouette, dark floor,
                     # ragdolls, held-clip grips, bipedalMonster, prop craft, creature gait audits
npm run typecheck && npm test

# Visual verification & Squint Test:
VERIFY_PORT=5211 node scripts/verify-visual.mjs   # renders all presets/stages -> out/previews/
```

Examine every rendered PNG in `out/previews/` **at normal zoom AND shrunk to ~200 px / squinted**:
- Does the **silhouette alone** clearly distinguish every archetype (knights, bandits, welders, orcs, trolls, animals)?
- Are **2–3 bold value & shape masses** readable without squinting at `1`-voxel surface noise?
- Are **eyes, mouth, chin overhang, brow shadow, headwear fit, shoulder caps, and dark cloth facets** crisp and artifact-free?
- Do **shields sit cleanly along the outer left forearm** and **weapons/claws clear thighs in idle clips**?

If any answer is no, iterate on the voxel sculpt and re-verify before considering the asset done.

---

## 9. Publishing expanded packs to `jam-ready-assets`

Do **not** ship binary `.glb` copies inside `games/voxel-character-showcase` or any downstream RUN app. Whenever you add new assets or expand packs (or add a new pack key in `contracts/data/packs.json`), publish the staged leaves to `series-ai/jam-ready-assets` and pin their versions:

1. **Stage into a `jam-ready-assets` branch/worktree**:
   ```bash
   cd tools/run-voxel-characters
   npm run build && npm run validate && npm run catalog && npm test
   npm run stage -- --target <jam-ready-assets checkout>
   ```
   Packs sit directly at the root of `jam-ready-assets` as `<pack-dir>/3D/<theme>/` (e.g. `run-cubix-fantasy/3D/fantasy/`), never inside a parent wrapper folder.
2. **Author square previews & update JRA metadata**:
   - Render updated previews (`VERIFY_PORT=5211 node scripts/verify-visual.mjs`) and crop/export square `1024×1024` sources into `.preview-sources/` for each added or changed leaf.
   - Register every leaf in `preview-sources.json` (run `npm run previews:generate && npm run previews:check`), verify `.glb` and `preview.webp` are tracked by Git LFS, and update JRA's `README.md` credits/counts if adding a new pack.
3. **Run JRA CI validation gates locally** inside `<jam-ready-assets checkout>`:
   ```bash
   npm test
   SKIP_PUBLISHED_CHECK=1 node scripts/build-manifest.mjs
   node scripts/check-visual-assets.mjs
   node scripts/check-keywords.mjs origin/main
   ```
4. **Open a PR on `series-ai/jam-ready-assets`**. Once merged and mirrored to GCS (`manifest/v2/index.json`), update `games/voxel-character-showcase/src/pins.ts` with the new 12-character version hashes for every modified/added leaf (otherwise `npm run build` fails cleanly via `requirePins()`).
