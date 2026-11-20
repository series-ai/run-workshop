"""Build the fantasy pack: knight armor, helms, a cape, weapons, a shield, and medieval props.

Usage (Blender 5.1, headless):
  blender --background --factory-startup --python build_fantasy.py -- \
      --core <core-rig.glb> --stage <stage_dir> --meta <meta_dir>

Output:
  <stage>/run-cubix-fantasy/3D/characters/fantasy-pack.glb   (rig without clips, avatar parts)
  <stage>/run-cubix-fantasy/3D/characters/held_*.glb         (static held items)
  <stage>/run-cubix-fantasy/3D/fantasy/prop_*.glb            (static world props)
  <meta>/fantasy.json                                          (pack catalog)

Run `build_core.py` first. This script reads the core rig and `<meta>/core.json`.

The knights are in this file. The orcs and the trolls are in `build_orcs_trolls.py`. That module gives
`PARTS`, `HELD` and `PRESETS` in the shape of the tables below, and this script adds them to the pack.

Palette regions of the knight set:
  metal      plate armor                 primary    heraldic field (surcoat, cape, shield, plume)
  secondary  mail and arming cloth       detail     heraldic charge (the cross), cape hem
  accent     brass and gold trim         leather    belts, grips and straps
  visor      eye slits, breathing holes  trim       not used by the armor (shoe and sock defaults)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_core as core  # noqa: E402
import voxchar as vk  # noqa: E402
from build_core import (  # noqa: E402
    ARM_LOWER_X, ARM_UPPER_X, ARM_Y, ARM_Z, BELT_Y, CALF_BACK, CALF_FRONT, CALF_OUTER_Z, CALF_Y, CHEST_HALF_X,
    COLLAR_Y, CROWN_Y, HEAD_BROW_Y, HEAD_EYE_Y, HEAD_FRONT_SHELL, HEAD_HALF_X, HEAD_JAW_Y, HEAD_MOUTH_Y,
    HEAD_NOSE_Y, HEAD_SHELL, HEAD_Z, PAD_BACK, PAD_GARMENT_OUTER, PAD_HEADWEAR, PAD_JOINT, PAD_SHOE, SHOE_Y,
    SHOULDER_Y, TAIL_Y, THIGH_BACK, THIGH_FRONT, THIGH_X, THIGH_Y, TOE_BONE, TOE_Z, TORSO_BACK, TORSO_FRONT,
    TORSO_OUTER_Z, TROUSER_CALF_X, TRUNK_Y, YOKE_Y, paired, seg,
)
from voxchar import vox  # noqa: E402

PACK = 'fantasy'
PARTS_FILE = 'fantasy-pack.glb'
ORC_MODULE = 'build_orcs_trolls'
HELD_VOX = core.HELD_VOX
PROP_VOX = core.PROP_VOX

OUTER_FRONT = TORSO_FRONT + 1
OUTER_BACK = TORSO_BACK - 1
SKIRT_Y = (TAIL_Y[0] + 1, TAIL_Y[1]) # rows 21..22 (1.05..1.15 m) on pelvis, clearing lifted thighs in idle & walk
SWORD_BELT_Y = SKIRT_Y[1] + 1         # row 23: sword belt at the waist above the tassets/skirt

# The same rules as scripts/validate.ts, applied at build time.
PALM_CLEARANCE = 0.032              # a held item cannot go through the back of the palm
MIN_GARMENT_LUMINANCE = 0.03        # contracts/palette.ts: dark floor of the garment regions
GARMENT_REGIONS = ('primary', 'secondary', 'leather')
DEFAULT_LEATHER = '#4f3626'         # contracts/palette.ts: resolvePaletteColors

STEEL = vox('metal', 0.0)
STEEL_LIGHT = vox('metal', 0.25)
STEEL_DARK = vox('metal', -0.375)
STEEL_EDGE = vox('metal', 0.5, mottle=False)
GOLD = vox('accent', 0.125, mottle=False)
GOLD_DARK = vox('accent', -0.25, mottle=False)
MAIL = vox('secondary', 0.0)
MAIL_DARK = vox('secondary', -0.25)
CLOTH = vox('primary', 0.0)
CLOTH_DARK = vox('primary', -0.25)
CLOTH_LIGHT = vox('primary', 0.25)
CHARGE = vox('detail', 0.0, mottle=False)
LEATHER = vox('leather', -0.125)
LEATHER_DARK = vox('leather', -0.45)
SLIT = vox('visor', -0.5, mottle=False)
GLOW = vox('accent', emissive=True)


# --------------------------------------------------------------------------
# Torso parts
# --------------------------------------------------------------------------

def gauntlets(part, *, plate, fingers, cuff):
    """Armored claw hands. The torso part covers the `hands` region of the body."""
    core.claw_hands(part, palm=plate, fingers=fingers, cuff=cuff, pad=PAD_GARMENT_OUTER)


def torso_knight_plate():
    """Plate harness: fluted breastplate, backplate, gorget, tassets, pauldrons, vambraces, gauntlets.

    The pauldron is the sleeve of the upper arm with one raised lame of two voxels. It is 5 cm proud of
    the arm and does not go above the shoulder line when the arm hangs. The tassets and mail skirt are
    bound to the pelvis above BELT_Y, with row 20 recessed behind the hip front and split by a center
    tabard so forward spine bends and lifted thighs stay clear.
    """
    part = vk.VoxelPart('torso_knight_plate', covers=(*core.SLEEVED_TORSO_COVERS, core.TAG_HANDS))
    half = CHEST_HALF_X
    plate_y = (SWORD_BELT_Y + 1, SHOULDER_Y - 1)                       # rows of the breastplate

    torso = core.shirt_torso(part, STEEL_DARK, y=(SWORD_BELT_Y, SHOULDER_Y), z=TORSO_OUTER_Z)
    torso.fill(-half, SWORD_BELT_Y, TORSO_BACK, half, SWORD_BELT_Y, TORSO_FRONT, LEATHER_DARK)   # Sword belt
    torso.set(0, SWORD_BELT_Y, TORSO_FRONT, GOLD)                                         # Buckle
    # Breastplate: one voxel proud, 5 wide at the chest and 3 wide at the waist.
    torso.fill(-2, plate_y[0] + 1, OUTER_FRONT, 2, plate_y[1], OUTER_FRONT, STEEL_LIGHT)
    torso.fill(-1, plate_y[0], OUTER_FRONT, 1, plate_y[0], OUTER_FRONT, STEEL_LIGHT)
    torso.fill(0, plate_y[0], OUTER_FRONT, 0, plate_y[1], OUTER_FRONT, STEEL_EDGE)        # Center ridge
    torso.fill(-2, plate_y[0] + 1, OUTER_BACK, 2, plate_y[1], OUTER_BACK, STEEL)          # Backplate
    gorget = core.low_collar(part, STEEL, turtleneck=True)
    gorget.paint_if_filled(-HEAD_SHELL, COLLAR_Y, TORSO_FRONT, HEAD_SHELL, COLLAR_Y, TORSO_FRONT, GOLD)   # Gorget trim

    skirt = seg(part, 'pelvis', (-half, half), (TAIL_Y[0], SKIRT_Y[1]), TORSO_OUTER_Z, pad=PAD_GARMENT_OUTER)
    skirt.fill(-half, TAIL_Y[0], TORSO_BACK, half, TAIL_Y[0], 0, MAIL)                    # Recessed hauberk bridge on row 20
    skirt.set(0, TAIL_Y[0], TORSO_FRONT, CLOTH)                                           # Center tabard drop between legs
    skirt.fill(-half, SKIRT_Y[0], TORSO_BACK, half, SKIRT_Y[1], TORSO_FRONT, MAIL)        # Mail skirt below the belt
    for x0, x1 in ((-half, -1), (1, half)):
        skirt.fill(x0, SKIRT_Y[0], OUTER_FRONT, x1, SKIRT_Y[1], OUTER_FRONT, STEEL)       # Tassets
    skirt.fill(0, SKIRT_Y[0], TORSO_FRONT, 0, SKIRT_Y[1], TORSO_FRONT, CLOTH)             # Heraldic cloth between the tassets
    skirt.fill(-half, SKIRT_Y[0], OUTER_BACK, half, SKIRT_Y[1], OUTER_BACK, STEEL)        # Culet at the back

    ux0, ux1 = ARM_UPPER_X
    lx0, lx1 = ARM_LOWER_X
    lame_y = ARM_Y[1] + 1

    def upper_arm(grid):
        grid.fill(ux0, ARM_Y[0], ARM_Z[0], ux0 + 2, ARM_Y[1], ARM_Z[1], STEEL_LIGHT)      # Pauldron on the arm
        grid.fill(ux0 + 2, ARM_Y[0], ARM_Z[0], ux0 + 2, ARM_Y[1], ARM_Z[1], GOLD_DARK)    # Pauldron rim
        grid.fill(ux0 + 1, lame_y, ARM_Z[0], ux0 + 2, lame_y, ARM_Z[1], STEEL)            # Raised lame: 2 voxels long
        grid.fill(ux0 + 3, ARM_Y[0], ARM_Z[0], ux1, ARM_Y[1], ARM_Z[1], MAIL)             # Mail sleeve

    def forearm(grid):
        grid.fill(lx0, ARM_Y[0], ARM_Z[0], lx1, ARM_Y[1], ARM_Z[1], STEEL)                # Vambrace
        grid.fill(lx1, ARM_Y[0], ARM_Z[0], lx1, ARM_Y[1], ARM_Z[1], STEEL_DARK)           # Wrist band

    paired(part, 'upperarm_l', ARM_UPPER_X, (ARM_Y[0], lame_y), ARM_Z, upper_arm, pad=PAD_GARMENT_OUTER)
    paired(part, 'lowerarm_l', ARM_LOWER_X, ARM_Y, ARM_Z, forearm, pad=PAD_GARMENT_OUTER)
    gauntlets(part, plate=STEEL, fingers=STEEL_DARK, cuff=STEEL_LIGHT)
    return part


def torso_knight_templar():
    """Surcoat over a mail hauberk: cross on the chest and the back, proud belt, mail sleeves, gauntlets."""
    part = vk.VoxelPart('torso_knight_templar', covers=(*core.SLEEVED_TORSO_COVERS, core.TAG_HANDS))
    half = CHEST_HALF_X
    chest_y = SWORD_BELT_Y + 1

    torso = core.shirt_torso(part, MAIL, y=(SWORD_BELT_Y, SHOULDER_Y), z=TORSO_OUTER_Z)
    torso.fill(-2, chest_y, TORSO_BACK, 2, SHOULDER_Y, TORSO_FRONT, CLOTH)                # Surcoat: the mail shows at the sides
    torso.clear(-1, SHOULDER_Y, TORSO_FRONT, 1, SHOULDER_Y, TORSO_FRONT)                  # Neckline
    torso.fill(-half, SWORD_BELT_Y, OUTER_BACK, half, SWORD_BELT_Y, OUTER_FRONT, LEATHER_DARK)   # Proud belt
    torso.set(0, SWORD_BELT_Y, OUTER_FRONT, GOLD)                                         # Buckle
    for z in (TORSO_FRONT, TORSO_BACK):                                                   # Cross: 3 wide, 5 tall
        torso.fill(0, chest_y, z, 0, SHOULDER_Y - 1, z, CHARGE)
        torso.fill(-1, SHOULDER_Y - 2, z, 1, SHOULDER_Y - 2, z, CHARGE)
    core.low_collar(part, MAIL_DARK, turtleneck=True)                                     # Mail collar

    skirt = seg(part, 'pelvis', (-half, half), (TAIL_Y[0], SKIRT_Y[1]), TORSO_OUTER_Z, pad=PAD_GARMENT_OUTER)
    skirt.fill(-half, TAIL_Y[0], TORSO_BACK, half, TAIL_Y[0], 0, MAIL_DARK)               # Recessed hauberk hem on row 20
    skirt.set(0, TAIL_Y[0], OUTER_FRONT, CLOTH_DARK)                                      # Center surcoat split between legs
    skirt.set(0, TAIL_Y[0], TORSO_FRONT, CLOTH_DARK)
    skirt.fill(-half, SKIRT_Y[0], TORSO_BACK, half, SKIRT_Y[1], TORSO_FRONT, MAIL)
    skirt.fill(-2, SKIRT_Y[0], OUTER_BACK, 2, SKIRT_Y[1], OUTER_FRONT, CLOTH)             # Flared surcoat skirt
    skirt.fill(-2, SKIRT_Y[0], OUTER_BACK, 2, SKIRT_Y[0], OUTER_FRONT, CLOTH_DARK)        # Skirt hem
    skirt.fill(-half, SKIRT_Y[0], TORSO_BACK, half, SKIRT_Y[0], TORSO_FRONT, MAIL_DARK)   # Hauberk hem at the sides
    skirt.set(1, SWORD_BELT_Y - 1, OUTER_FRONT, LEATHER_DARK)                             # Belt end

    ux0, ux1 = ARM_UPPER_X
    lx0, lx1 = ARM_LOWER_X

    def upper_arm(grid):
        grid.fill(ux0, ARM_Y[0], ARM_Z[0], ux1, ARM_Y[1], ARM_Z[1], MAIL)                 # Mail sleeve
        grid.fill(ux0, ARM_Y[0], ARM_Z[0], ux0 + 1, ARM_Y[1], ARM_Z[1], CLOTH_DARK)       # Surcoat shoulder
        core.round_shoulder_cap(grid)

    def forearm(grid):
        grid.fill(lx0, ARM_Y[0], ARM_Z[0], lx1, ARM_Y[1], ARM_Z[1], MAIL)
        grid.fill(lx0 + 2, ARM_Y[0], ARM_Z[0], lx1, ARM_Y[1], ARM_Z[1], LEATHER)          # Leather bracer
        grid.fill(lx1, ARM_Y[0], ARM_Z[0], lx1, ARM_Y[1], ARM_Z[1], STEEL_DARK)           # Gauntlet cuff

    paired(part, 'upperarm_l', ARM_UPPER_X, ARM_Y, ARM_Z, upper_arm, pad=PAD_GARMENT_OUTER)
    paired(part, 'lowerarm_l', ARM_LOWER_X, ARM_Y, ARM_Z, forearm, pad=PAD_GARMENT_OUTER)
    gauntlets(part, plate=STEEL, fingers=LEATHER_DARK, cuff=STEEL_DARK)
    return part


# --------------------------------------------------------------------------
# Legs
# --------------------------------------------------------------------------

def legs_knight_greaves():
    """Plate legs: mail hips, cuisses with a proud front plate, poleyns, ridged greaves, pointed sabatons."""
    part = vk.VoxelPart('legs_knight_greaves', covers=core.LEGS_COVERS)
    core.trouser_hips(part, MAIL, belt=MAIL_DARK)
    tx0, tx1 = THIGH_X
    cx0, cx1 = TROUSER_CALF_X
    ridge_x = cx0 + 1
    cuisse_y = (THIGH_Y[0] + 1, THIGH_Y[1] - 3)                        # rows of the proud cuisse plate
    poleyn_y = (CALF_Y[1] - 2, CALF_Y[1] - 1)                          # the knee guard is on the calf, below the joint

    def thigh(grid):
        grid.fill(tx0, THIGH_Y[0], THIGH_BACK, tx1, THIGH_Y[1], THIGH_FRONT, MAIL)        # Mail at the hip
        grid.fill(tx0, THIGH_Y[0], THIGH_BACK, tx1, THIGH_Y[1] - 2, THIGH_FRONT, STEEL)   # Cuisse
        grid.fill(tx0, cuisse_y[0], THIGH_FRONT + 1, tx1, cuisse_y[1], THIGH_FRONT + 1, STEEL_LIGHT)   # Front plate

    def calf(grid):
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CALF_Y[1], CALF_FRONT, STEEL)           # Greave
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CALF_Y[0], CALF_FRONT, STEEL_DARK)      # Ankle band
        grid.fill(cx0, poleyn_y[0], CALF_FRONT + 1, cx1, poleyn_y[1], CALF_FRONT + 1, STEEL_LIGHT)   # Poleyn knee plate

    paired(part, 'thigh_l', THIGH_X, THIGH_Y, (THIGH_BACK, THIGH_FRONT + 1), thigh, pad=PAD_JOINT)
    paired(part, 'calf_l', TROUSER_CALF_X, CALF_Y, CALF_OUTER_Z, calf)
    # Sabatons: the wide shoe with a dark heel column, and one more toe voxel for the pointed tip.
    core.shoes(part, core.Shoe(upper=STEEL, sole=STEEL_DARK, toe=STEEL_LIGHT, heel=STEEL_DARK), wide=True)
    tip_z = TOE_Z[1] + 1
    tip = seg(part, TOE_BONE, (ridge_x, ridge_x), (SHOE_Y[0], SHOE_Y[0]), (tip_z, tip_z), pad=PAD_SHOE)
    tip.set(ridge_x, SHOE_Y[0], tip_z, STEEL_EDGE)
    core.add_twin(part, tip)
    return part


# --------------------------------------------------------------------------
# Headwear and back
# --------------------------------------------------------------------------

def headwear_knight_greathelm():
    """Snug flat-top barrel great helm at 0.025 m resolution: recessed T-visor slit, brass cross, breathing slits."""
    part = vk.VoxelPart('headwear_knight_greathelm', covers=('hair',))
    grid = core.hat_seg(part, core.HAT_BRIM_X, (core.HAT_JAW_Y, core.HAT_CROWN_Y + 2), (-3, core.HAT_VISOR_Z))
    top_y = core.HAT_CROWN_Y + 2                                                   # 1.875 m (total height 0.333 m)
    grid.fill(-4, core.HAT_JAW_Y, -3, 3, top_y, core.HAT_VISOR_Z, STEEL)           # Main barrel enclosing skull & brows
    core.hat_fill_sym(grid, -5, -5, core.HAT_NOSE_Y - 1, core.HAT_CROWN_Y, -3, 3, STEEL)   # Ear & temple armor
    grid.fill(-4, top_y, -3, 3, top_y, core.HAT_VISOR_Z, STEEL_LIGHT)              # Crown plate
    grid.fill(-4, core.HAT_JAW_Y, -3, 3, core.HAT_JAW_Y, core.HAT_VISOR_Z, STEEL_DARK)   # Lower rim
    # Recessed eye slits (depth 6 SLIT behind front plate 7 so face never z-fights).
    for x0, x1 in ((-3, -2), (1, 2)):
        grid.clear(x0, core.HAT_EYE_Y, core.HAT_VISOR_Z, x1, core.HAT_EYE_Y + 1, core.HAT_VISOR_Z)
        grid.fill(x0, core.HAT_EYE_Y, 6, x1, core.HAT_EYE_Y + 1, 6, SLIT)
    # Brass cross: upright nasal & horizontal brow bar wrapping corners.
    grid.fill(-1, core.HAT_JAW_Y, core.HAT_VISOR_Z, 0, top_y, core.HAT_VISOR_Z, GOLD)
    grid.fill(-4, core.HAT_BROW_Y, core.HAT_VISOR_Z, 3, core.HAT_BROW_Y + 1, core.HAT_VISOR_Z, GOLD)
    core.hat_fill_sym(grid, -4, -4, core.HAT_BROW_Y, core.HAT_BROW_Y + 1, 5, 6, GOLD)
    # Cheek breathing perforations.
    for x in (-3, 2):
        grid.set(x, core.HAT_MOUTH_Y, core.HAT_VISOR_Z, SLIT)
        grid.set(x, core.HAT_NOSE_Y, core.HAT_VISOR_Z, SLIT)
    return part


def headwear_knight_sallet():
    """Snug gothic visored sallet + bevor at 0.025 m resolution: skull dome, visor slit, chin bevor, tail, plume."""
    part = vk.VoxelPart('headwear_knight_sallet', covers=('hair',))
    dome_y = core.HAT_CROWN_Y + 1
    grid = core.hat_seg(part, core.HAT_BRIM_X, (core.HAT_JAW_Y, dome_y + 2), (-4, core.HAT_VISOR_Z))
    # Upper skull dome (y = 71..73).
    grid.fill(-4, core.HAT_BROW_Y + 1, -3, 3, core.HAT_CROWN_Y, 6, STEEL)
    grid.fill(-3, dome_y, -2, 2, dome_y, 4, STEEL_LIGHT)
    # Ear & temple clearance armor + back shell (y = 66..71).
    core.hat_fill_sym(grid, -5, -5, core.HAT_NOSE_Y, core.HAT_BROW_Y + 1, -3, 3, STEEL)
    grid.fill(-4, core.HAT_NOSE_Y, -3, 3, core.HAT_BROW_Y + 1, -3, STEEL)
    # Contiguous steel bevor & articulated lobster-tail neck guard (y = 62..65).
    grid.fill(-4, core.HAT_JAW_Y, -4, 3, core.HAT_MOUTH_Y + 1, -3, STEEL)          # Rear lobster tail
    grid.fill(-4, core.HAT_JAW_Y, 6, 3, core.HAT_MOUTH_Y + 1, 6, STEEL)            # Front chin bevor (recessed under z=7 visor)
    core.hat_fill_sym(grid, -4, -4, core.HAT_JAW_Y, core.HAT_MOUTH_Y + 1, -2, 5, STEEL)   # Cheek/jaw wrap
    # Hinged front visor over upper face (clears nose at y=66..67, z=6..7 & brows at y=70..71, z=6..7).
    grid.fill(-4, core.HAT_NOSE_Y, core.HAT_VISOR_Z, 3, core.HAT_NOSE_Y + 1, core.HAT_VISOR_Z, STEEL)
    core.hat_fill_sym(grid, -4, -4, core.HAT_NOSE_Y, core.HAT_EYE_Y + 1, 5, 6, STEEL)
    grid.fill(-3, core.HAT_EYE_Y, 6, 2, core.HAT_EYE_Y + 1, 6, SLIT)               # Recessed eye slit
    grid.fill(-4, core.HAT_EYE_Y, core.HAT_VISOR_Z, -4, core.HAT_EYE_Y + 1, core.HAT_VISOR_Z, STEEL)
    grid.fill(3, core.HAT_EYE_Y, core.HAT_VISOR_Z, 3, core.HAT_EYE_Y + 1, core.HAT_VISOR_Z, STEEL)
    grid.fill(-4, core.HAT_BROW_Y, core.HAT_VISOR_Z, 3, core.HAT_BROW_Y + 1, core.HAT_VISOR_Z, GOLD)
    # Plume crest (y = 74..75, total height 62..75 = 0.358 m <= 0.36 m).
    grid.fill(-1, dome_y + 1, -4, 0, dome_y + 1, 3, CLOTH)
    grid.fill(-1, dome_y + 2, -4, 0, dome_y + 2, 1, CLOTH)
    return part


def back_knight_cape():
    """Heraldic cloak in three rigid pieces: shoulder mantle with two clasps, back drape, flared tail.

    The mantle turns with the chest, the drape with the waist and the tail with the hips, the same split
    as the torso garments. The tail is one voxel behind the drape, thus the thighs do not go through it.
    """
    part = vk.VoxelPart('back_knight_cape')
    half = CHEST_HALF_X
    drape_z = OUTER_BACK
    tail_z = OUTER_BACK - 1
    tail_y = (THIGH_Y[0] + 2, TRUNK_Y[0] - 1)                          # from above the knee up to the belt row

    mantle = seg(part, 'spine_03', (-half, half), YOKE_Y, (drape_z, TORSO_FRONT), pad=PAD_BACK)
    mantle.fill(-half, YOKE_Y[0], drape_z, half, YOKE_Y[1], drape_z, CLOTH)
    for side in (-half, half):
        mantle.fill(side, SHOULDER_Y, TORSO_BACK, side, SHOULDER_Y, TORSO_FRONT, CLOTH)   # Mantle on the shoulder edge
        mantle.set(side, SHOULDER_Y, TORSO_FRONT, GOLD)                                   # Shoulder clasp, flush with the chest

    drape = seg(part, 'spine_02', (-half, half), TRUNK_Y, (drape_z, drape_z), pad=PAD_BACK)
    drape.fill(-half, TRUNK_Y[0], drape_z, half, TRUNK_Y[1], drape_z, CLOTH)

    tail = seg(part, 'pelvis', (-half, half), tail_y, (tail_z, drape_z), pad=PAD_BACK)
    tail.fill(-half, tail_y[1], drape_z, half, tail_y[1], drape_z, CLOTH)                 # Step below the drape
    tail.fill(-half, tail_y[0], tail_z, half, tail_y[1], tail_z, CLOTH)
    tail.fill(-half, tail_y[0] + 1, tail_z, half, tail_y[0] + 1, tail_z, CHARGE)          # Hem stripe
    tail.fill(-half, tail_y[0], tail_z, half, tail_y[0], tail_z, CLOTH_DARK)
    for x in (-2, 2):
        tail.paint_if_filled(x, tail_y[0] + 2, tail_z, x, tail_y[1] - 1, tail_z, CLOTH_DARK)   # Two folds in the tail
    return part


# --------------------------------------------------------------------------
# Held items (@ 2.8 cm HELD_VOX): +Y shaft, +Z forward, grip at the origin
# --------------------------------------------------------------------------

def static_grid(part, x, y, z, voxel):
    """Add a static grid. X and Z cells are symmetric about the origin. Y starts at the origin."""
    grid = vk.VoxelGrid(x[0], x[1], y[0], y[1], z[0], z[1], voxel_size=voxel, center_x=True, center_z=True)
    return part.add_grid(grid)


def held_broadsword():
    """Arming sword: brass wheel pommel, leather grip, 7-wide crossguard, 3-wide blade with a fuller."""
    part = vk.VoxelPart('held_broadsword')
    guard_y = 2
    blade_y = (guard_y + 1, 22)
    grid = static_grid(part, (0, 0), (-5, blade_y[1] + 2), (-3, 3), HELD_VOX)
    grid.fill(0, -4, -1, 0, -4, 1, GOLD)                                                  # Wheel pommel
    grid.set(0, -5, 0, GOLD_DARK)
    grid.fill(0, -3, 0, 0, guard_y - 1, 0, LEATHER_DARK)                                  # Grip
    grid.fill(0, guard_y, -3, 0, guard_y, 3, GOLD)                                        # Crossguard
    for z in (-3, 3):
        grid.set(0, guard_y + 1, z, GOLD_DARK)                                            # Quillon tips, toward the blade
    grid.fill(0, blade_y[0], -1, 0, blade_y[1], 1, STEEL_EDGE)                            # Blade: two bright edges
    grid.fill(0, blade_y[0], 0, 0, blade_y[1] - 4, 0, STEEL_DARK)                         # Fuller
    grid.fill(0, blade_y[1] - 3, 0, 0, blade_y[1] + 2, 0, STEEL_LIGHT)                    # Flat and point
    return part


def held_warhammer():
    """War hammer on an ash haft: flanged face in front, back spike, top spike, steel langets."""
    part = vk.VoxelPart('held_warhammer')
    head_y = (15, 17)
    grid = static_grid(part, (0, 1), (-6, head_y[1] + 2), (-4, 2), HELD_VOX)
    grid.fill(0, -5, 0, 0, head_y[0] - 1, 0, vox('leather', 0.375))                       # Ash haft
    grid.set(0, -6, 0, STEEL_DARK)                                                        # Butt cap
    grid.fill(0, -2, 0, 0, 2, 0, LEATHER_DARK)                                            # Grip wrap
    grid.fill(0, head_y[0] - 4, 0, 0, head_y[0] - 1, 0, STEEL_DARK)                       # Langets
    grid.fill(0, head_y[0], -1, 1, head_y[1], 0, STEEL)                                   # Head block
    grid.fill(0, head_y[0] + 1, 1, 1, head_y[0] + 1, 1, STEEL_DARK)                       # Neck of the face
    grid.fill(0, head_y[0], 2, 1, head_y[1], 2, STEEL_LIGHT)                              # Flanged face
    grid.fill(0, head_y[0] + 1, -2, 1, head_y[0] + 1, -2, STEEL)                          # Back spike
    grid.fill(0, head_y[0] + 1, -4, 0, head_y[0] + 1, -3, STEEL_EDGE)
    grid.fill(0, head_y[1] + 1, 0, 0, head_y[1] + 2, 0, STEEL_EDGE)                       # Top spike
    grid.fill(0, head_y[0], 0, 1, head_y[0], 0, GOLD_DARK)                                # Brass collar
    return part


# Heater shield: rows along Z from the flat top toward the elbow (-Z) to the shield point (+Z).
SHIELD_TOP_Z = -12
SHIELD_Y_ROWS = (
    *((-5, 5),) * 10,
    (-4, 4), (-4, 4), (-4, 4),
    (-2, 2), (-2, 2),
    (0, 0),
)
SHIELD_BOARD_X = 4


def held_heater_shield():
    """Forearm-mounted heater shield for the left hand (`gripStyle: 'forearm_shield'`).

    Mounts flat along the outer left forearm (`+X_held >= 0.098 m`, clearing the `+0.094 m`
    gauntlet/forearm). A leather grip bar sits in the fist at `(0, 0, 0)`, braced by a pinky-side
    standoff, with an open leather arm-strap wrapping the forearm near `-Z_held <= -0.18 m`.
    """
    part = vk.VoxelPart('held_heater_shield')
    rows = {SHIELD_TOP_Z + index: span for index, span in enumerate(SHIELD_Y_ROWS)}
    board_x, boss_x = SHIELD_BOARD_X, SHIELD_BOARD_X + 1
    grid = part.add_grid(vk.VoxelGrid(
        -1, boss_x, -5, 5, min(rows), max(rows),
        voxel_size=HELD_VOX, center_x=True, center_y=True, center_z=True,
    ))
    # Fist grip bar at (0, 0, 0) + pinky-side standoff connecting to the shield inner face.
    grid.fill(0, -2, 0, 0, 2, 0, LEATHER_DARK)
    grid.fill(1, -2, 0, board_x - 1, -2, 0, LEATHER_DARK)
    # Open forearm leather strap around elbow (z = -8, hollow across y = -1..2 for the forearm).
    grid.fill(-1, -2, -8, -1, 3, -8, LEATHER_DARK)
    grid.fill(0, -2, -8, board_x - 1, -2, -8, LEATHER_DARK)
    grid.fill(0, 3, -8, board_x - 1, 3, -8, LEATHER_DARK)
    # Shield board & steel rim along outer forearm (x = +4, [+0.098, +0.126] m).
    for z, (y0, y1) in rows.items():
        grid.fill(board_x, y0, z, board_x, y1, z, STEEL)
    # Heraldic field & bold cross charge inside the steel rim, plus crisp brass boss stud at x = +5.
    for z, (y0, y1) in rows.items():
        near = [rows[k] for k in (z - 1, z, z + 1) if k in rows]
        if len(near) < 3:
            continue
        field = (max(s[0] for s in near) + 1, min(s[1] for s in near) - 1)
        if field[0] <= field[1]:
            grid.fill(board_x, field[0], z, board_x, field[1], z, CLOTH)
    cross_z = SHIELD_TOP_Z + 6
    grid.paint_if_filled(board_x, -1, SHIELD_TOP_Z + 1, board_x, 1, 1, CHARGE)         # Vertical cross arm
    grid.paint_if_filled(board_x, -4, cross_z - 1, board_x, 4, cross_z + 1, CHARGE)    # Horizontal cross arm
    return part


# --------------------------------------------------------------------------
# World props: base on y = 0, centered on X and Z (@ 5 cm PROP_VOX)
# --------------------------------------------------------------------------

WOOD = vox('leather', 0.25)
WOOD_DARK = vox('leather', -0.25)
STONE = vox('secondary', 0.125)
STONE_DARK = vox('secondary', -0.25)
IRON = vox('metal', -0.5)


def prop_weapon_rack():
    """Timber weapon rack: two posts on feet, two rails, and two swords, a spear and an axe on the rails."""
    part = vk.VoxelPart('prop_weapon_rack')
    grid = static_grid(part, (-10, 10), (0, 27), (-3, 3), PROP_VOX)
    rail_z, weapon_z = 1, 2
    low_rail, top_rail = 5, 19
    for x in (-9, 9):
        grid.fill(x, 0, -3, x, 0, 3, WOOD_DARK)                                           # Foot
        grid.fill(x, 1, 0, x, 22, 0, WOOD)                                                # Post
        grid.set(x, 23, 0, WOOD_DARK)                                                     # Post cap
    grid.fill(-10, low_rail, rail_z, 10, low_rail, rail_z, WOOD_DARK)
    grid.fill(-10, top_rail, rail_z, 10, top_rail, rail_z, WOOD_DARK)
    for x, pommel_y in ((-6, 24), (-2, 23)):                                              # Swords: hung by the guard, point down
        guard_y = top_rail + 1
        grid.fill(x, low_rail + 2, weapon_z, x, top_rail, weapon_z, STEEL_LIGHT)
        grid.fill(x - 1, guard_y, weapon_z, x + 1, guard_y, weapon_z, GOLD)
        grid.fill(x, guard_y + 1, weapon_z, x, pommel_y - 1, weapon_z, LEATHER_DARK)
        grid.set(x, pommel_y, weapon_z, GOLD_DARK)
    grid.fill(2, 1, weapon_z, 2, 24, weapon_z, vox('leather', 0.5))                       # Spear shaft
    grid.fill(2, 25, weapon_z, 2, 27, weapon_z, STEEL_EDGE)                               # Spear head
    grid.fill(6, 1, weapon_z, 6, 21, weapon_z, vox('leather', 0.375))                     # Axe haft
    grid.fill(7, 18, weapon_z, 8, 21, weapon_z, STEEL)                                    # Axe blade
    grid.fill(8, 17, weapon_z, 8, 22, weapon_z, STEEL_EDGE)                               # Axe edge
    return part


def prop_castle_brazier():
    """Iron fire basket on four legs and a stone plinth, with coals and an emissive flame."""
    part = vk.VoxelPart('prop_castle_brazier')
    grid = static_grid(part, (-3, 3), (0, 18), (-3, 3), PROP_VOX)
    bowl_y = (10, 12)
    grid.fill(-3, 0, -3, 3, 1, 3, STONE)                                                  # Plinth
    grid.fill(-2, 2, -2, 2, 2, 2, STONE_DARK)                                             # Plinth step
    for x in (-2, 2):
        for z in (-2, 2):
            grid.fill(x, 3, z, x, bowl_y[0] - 1, z, IRON)                                 # Legs
    grid.fill(-2, 6, -2, 2, 6, 2, IRON)                                                   # Brace ring
    grid.clear(-1, 6, -1, 1, 6, 1)
    grid.fill(-2, bowl_y[0], -2, 2, bowl_y[0], 2, IRON)                                   # Basket floor
    grid.fill(-3, bowl_y[0] + 1, -3, 3, bowl_y[1], 3, IRON)                               # Basket wall
    grid.fill(-3, bowl_y[1], -3, 3, bowl_y[1], 3, vox('metal', -0.125))                   # Basket rim
    grid.fill(-2, bowl_y[1], -2, 2, bowl_y[1], 2, vox('detail', -0.625))                  # Coals
    for x, z in ((-2, 1), (1, -2), (2, 2)):
        grid.set(x, bowl_y[1], z, GLOW)                                                   # Embers
    flame_y = bowl_y[1] + 1
    grid.fill(-1, flame_y, -1, 1, flame_y + 1, 1, GLOW)                                   # Flame body
    grid.fill(-1, flame_y + 2, 0, 0, flame_y + 3, 0, GLOW)                                # Flame tongues
    grid.fill(0, flame_y + 2, -1, 0, flame_y + 2, 1, GLOW)
    grid.set(0, flame_y + 4, 0, GLOW)
    grid.set(1, flame_y + 2, 1, GLOW)
    return part


def prop_stone_anvil():
    """Forge anvil on a dressed stone block: foot, waist, face, round horn, square heel, and a hot ingot."""
    part = vk.VoxelPart('prop_stone_anvil')
    grid = static_grid(part, (-6, 6), (0, 12), (-3, 3), PROP_VOX)
    block_top = 5
    grid.fill(-4, 0, -3, 4, block_top, 3, STONE)                                          # Stone block
    grid.fill(-4, 0, -3, 4, 0, 3, STONE_DARK)                                             # Footing course
    grid.fill(-4, 3, -3, 4, 3, 3, STONE_DARK)                                             # Mortar joint
    grid.fill(-3, block_top + 1, -2, 3, block_top + 1, 2, IRON)                           # Anvil foot
    grid.fill(-2, block_top + 2, -1, 2, block_top + 3, 1, IRON)                           # Waist
    face_y = block_top + 4
    grid.fill(-4, face_y, -2, 4, face_y + 1, 2, STEEL)                                    # Body
    grid.fill(-4, face_y + 1, -2, 4, face_y + 1, 2, STEEL_LIGHT)                          # Hardened face
    grid.fill(5, face_y + 1, -1, 5, face_y + 1, 1, STEEL)                                 # Horn
    grid.set(6, face_y + 1, 0, STEEL_LIGHT)
    grid.fill(-6, face_y + 1, -1, -5, face_y + 1, 1, STEEL)                               # Heel
    grid.fill(0, face_y + 2, 0, 2, face_y + 2, 0, GLOW)                                   # Hot ingot on the face
    return part


# --------------------------------------------------------------------------
# Catalog
# --------------------------------------------------------------------------

# The knight parts are first: the default fantasy avatar of the showcase takes the first part of each slot.
KNIGHT_PARTS = (
    ('torso', 'Plate Harness', torso_knight_plate, {}),
    ('torso', 'Templar Surcoat & Hauberk', torso_knight_templar, {}),
    ('legs', 'Plate Greaves & Sabatons', legs_knight_greaves, {'hides_legs_upper': True}),
    ('headwear', 'Visored Sallet & Plume', headwear_knight_sallet, {'hides_hair': True}),
    ('headwear', 'Great Helm', headwear_knight_greathelm, {'hides_hair': True}),
    ('back', 'Heraldic Cape', back_knight_cape, {}),
)

KNIGHT_HELD = (
    ('Broadsword', 'hand_r', held_broadsword),
    ('War Hammer', 'hand_r', held_warhammer),
    ('Heater Shield', 'hand_l', held_heater_shield, {'grip_style': 'forearm_shield'}),
)

PROPS = (
    ('Weapon Rack', prop_weapon_rack),
    ('Castle Brazier', prop_castle_brazier),
    ('Stone Anvil', prop_stone_anvil),
)

# Both knights hold two items. `Sword_Idle` opens the left hand, thus the validator rejects a shield in it.
KNIGHT_PRESETS = (
    core.preset(
        'fantasy_royal_knight', PACK, 'Royal Vanguard', 'Idle_Loop',
        {'skin': '#e8aa7e', 'hair': '#3a271d', 'primary': '#2b4f9e', 'secondary': '#4a5260',
         'accent': '#dba93a', 'metal': '#b9c2cc', 'trim': '#ece6d6', 'leather': '#5c3c27',
         'visor': '#262d38', 'detail': '#ece4cf'},
        body='body_athletic', head='head_keen_scout', hair='hair_cropped_fade',
        torso='torso_knight_plate', legs='legs_knight_greaves',
        headwear='headwear_knight_sallet', back='back_knight_cape',
        held_right='held_broadsword', held_left='held_heater_shield',
    ),
    core.preset(
        'fantasy_iron_templar', PACK, 'Iron Templar', 'Idle_Loop',
        {'skin': '#d9a077', 'hair': '#2a221d', 'primary': '#e2dccb', 'secondary': '#55585e',
         'accent': '#b8893a', 'metal': '#7f8389', 'trim': '#e6dfd0', 'leather': '#4a3324',
         'visor': '#1f232a', 'detail': '#a02c28'},
        body='body_athletic', head='head_scarred_veteran', hair='hair_buzz_crew',
        torso='torso_knight_templar', legs='legs_knight_greaves',
        headwear='headwear_knight_greathelm',
        held_right='held_warhammer', held_left='held_heater_shield',
    ),
)


def load_extra_module(module_name):
    """Load an optional companion fantasy module if present in this directory."""
    path = Path(__file__).resolve().with_name(f'{module_name}.py')
    if not path.exists():
        print(f'NOTE: {path.name} is not here.')
        return None
    import importlib
    module = importlib.import_module(module_name)
    for name in ('PARTS', 'HELD', 'PRESETS'):
        if not hasattr(module, name):
            raise AttributeError(f'{path.name} has no `{name}` table.')
    return module


def relative_luminance(hex_color):
    """WCAG relative luminance of a `#rrggbb` color (the same formula as contracts/palette.ts)."""
    def channel(offset):
        value = int(hex_color[offset:offset + 2], 16) / 255
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)


def check_palettes(presets):
    for item in presets:
        palette = {'leather': DEFAULT_LEATHER, **item['palette']}
        for region in GARMENT_REGIONS:
            luminance = relative_luminance(palette[region])
            if luminance < MIN_GARMENT_LUMINANCE:
                raise ValueError(
                    f'Preset "{item["id"]}": {region} {palette[region]} has luminance {luminance:.3f}. '
                    f'The minimum is {MIN_GARMENT_LUMINANCE}.')


def check_held(mesh, hand, grip_style='handle'):
    bounds = mesh.bounds()
    lo, hi = bounds['min'], bounds['max']
    if grip_style == 'forearm_shield':
        if hand != 'hand_l':
            raise ValueError(f'{mesh.name}: forearm_shield must use hand_l, got {hand}.')
        if hi[0] < 0.115 or lo[0] < -0.05:
            raise ValueError(f'{mesh.name}: forearm_shield must mount along +X forearm (x = {lo[0]:.3f} .. {hi[0]:.3f}).')
        if lo[2] > -0.14:
            raise ValueError(f'{mesh.name}: forearm_shield must extend up forearm (minZ = {lo[2]:.3f}).')
        if lo[1] > 0.04 or hi[1] < -0.04 or hi[2] < -0.06:
            raise ValueError(f'{mesh.name}: the grip origin is too far from the geometry.')
        return
    clear = lo[0] >= -PALM_CLEARANCE if hand == 'hand_r' else hi[0] <= PALM_CLEARANCE
    if not clear:
        raise ValueError(f'{mesh.name}: geometry goes through the back of the palm (x = {lo[0]:.3f} .. {hi[0]:.3f}).')
    if lo[1] > 0.04 or hi[1] < -0.04 or lo[2] > 0.06 or hi[2] < -0.06:
        raise ValueError(f'{mesh.name}: the grip origin is too far from the geometry.')


def unique_ids(kind, rows, name_of):
    names = [name_of(row) for row in rows]
    repeated = sorted({name for name in names if names.count(name) > 1})
    if repeated:
        raise ValueError(f'Fantasy pack: {kind} IDs occur more than one time: {repeated}.')


def main():
    args = vk.script_args('Build the fantasy voxel character pack.', 'core', 'stage', 'meta')
    rig = vk.RigData(args.core, vk.RIG_CONTRACT['joints'])
    core.load_pose(rig, args.meta)
    core_parts = json.loads((Path(args.meta) / 'core.json').read_text())['parts']
    characters = vk.leaf_dir(args.stage, PACK, 'characters')
    world = vk.leaf_dir(args.stage, PACK, 'world')

    orcs = load_extra_module(ORC_MODULE)
    mages = load_extra_module('build_mages_goblins')
    mystics = load_extra_module('build_mystics')
    part_rows = (*KNIGHT_PARTS, *(orcs.PARTS if orcs else ()), *(mages.PARTS if mages else ()), *(mystics.PARTS if mystics else ()))
    held_rows = (*KNIGHT_HELD, *(orcs.HELD if orcs else ()), *(mages.HELD if mages else ()), *(mystics.HELD if mystics else ()))
    presets = (*KNIGHT_PRESETS, *(orcs.PRESETS if orcs else ()), *(mages.PRESETS if mages else ()), *(mystics.PRESETS if mystics else ()))
    unique_ids('preset', presets, lambda item: item['id'])
    check_palettes(presets)

    builder = vk.GlbBuilder()
    builder.add_rig(rig, with_clips=False)
    parts = []
    for slot, label, make, rules in part_rows:
        mesh = core.skinned_mesh(make(), rig)
        builder.add_mesh(mesh)
        parts.append(vk.part_entry(mesh, PACK, slot, label, PARTS_FILE, **rules))
        print(f'  {slot:<8} {mesh.name:<28} {mesh.triangles:>5} triangles')
    unique_ids('part', parts, lambda entry: entry['id'])
    builder.write(characters / PARTS_FILE)

    held = []
    for row in held_rows:
        label, hand, make = row[:3]
        opts = row[3] if len(row) > 3 else {}
        grip_style = opts.get('grip_style', 'handle')
        mesh = make().to_mesh(static=True)
        check_held(mesh, hand, grip_style=grip_style)
        file_name = f'{mesh.name}.glb'
        size = vk.write_static_glb(characters / file_name, mesh)
        held.append(vk.held_entry(mesh, PACK, label, hand, file_name, size, grip_style=grip_style))
        bounds = mesh.bounds()
        print(f'  held     {mesh.name:<28} {mesh.triangles:>5} triangles  x {bounds["min"][0]:+.3f}..{bounds["max"][0]:+.3f}')
    unique_ids('held item', held, lambda entry: entry['id'])

    props = []
    for label, make in PROPS:
        mesh = make().to_mesh(static=True)
        file_name = f'{mesh.name}.glb'
        size = vk.write_static_glb(world / file_name, mesh)
        props.append(vk.prop_entry(mesh, PACK, label, file_name, size))
        print(f'  prop     {mesh.name:<28} {mesh.triangles:>5} triangles  size {mesh.bounds()["size"]}')

    core.check_preset_budgets(presets, [*core_parts, *parts], held)
    catalog = vk.pack_catalog(PACK, parts=parts, held=held, props=props, presets=presets)
    path = core.write_catalog(args.meta, catalog)
    print(f'Wrote {PARTS_FILE} ({len(parts)} parts), {len(held)} held items, {len(props)} props, '
          f'{len(presets)} presets, and {path}.')


if __name__ == '__main__':
    main()
