"""Build the `industrial` and `security` voxel character packs.

Usage (see scripts/build.ts):
  blender --background --factory-startup --python build_industrial_security.py -- \
      --core <core-rig.glb> --stage <stage_dir> --meta <meta_dir>

Output for each pack:
  <stage>/run-voxchar-<pack>/3D/characters/<pack>-pack.glb   skinned parts on the UAL1 rig
  <stage>/run-voxchar-<pack>/3D/characters/held_*.glb        static held items
  <stage>/run-voxchar-<pack>/3D/<pack>/prop_*.glb            static world props
  <meta>/<pack>.json                                         pack catalog
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from itertools import product
from pathlib import Path
from typing import Callable

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_core as core  # noqa: E402
import voxchar as vk  # noqa: E402
from build_core import (  # noqa: E402
    ARM_LOWER_X, ARM_UPPER_X, ARM_Y, ARM_Z, BELT_Y, CALF_BACK, CALF_FRONT, CALF_OUTER_Z, CALF_Y, CALF_Z,
    CHEST_HALF_X, CROWN_Y, HEAD_BROW_Y, HEAD_EAR_Z, HEAD_EYE_Y, HEAD_FRONT_SHELL, HEAD_HALF_X,
    HEAD_JAW_Y, HEAD_MOUTH_Y, HEAD_NOSE_Y, HEAD_SHELL, HEAD_TOP_Y, HEAD_Z, HIPS_HALF_X, PAD_BACK, PAD_BELT,
    PAD_GARMENT, PAD_GARMENT_OUTER, PAD_HEADWEAR, PAD_JOINT, SHOULDER_Y, SLEEVE_LATTICE, SLEEVE_SHORT_X,
    SLEEVE_Y, SLEEVE_Z, THIGH_BACK, THIGH_FRONT, THIGH_X, THIGH_Y, THIGH_Z, TORSO_BACK, TORSO_FRONT,
    TORSO_OUTER_Z, TORSO_Y, TROUSER_CALF_X, seg,
)

RIG_ID = 'ual1'

CORE_BODIES = ('body_athletic', 'body_slim', 'body_heavy')
CORE_HEADS = ('head_bearded_craftsman', 'head_rugged_hero', 'head_cyber_visor', 'head_scarred_veteran', 'head_keen_scout')
CORE_HAIR = ('hair_short_quiff', 'hair_cropped_fade', 'hair_buzz_crew')

CLOSED_GRIP_CLIPS = {
    'hand_r': ('Idle_Torch_Loop', 'Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Sword_Idle', 'Idle_Loop'),
    'hand_l': ('Idle_Torch_Loop', 'Idle_Loop'),
}

HELD_VOX = 0.026   # 2.6 cm chunky Teardown tools & pistol
PROP_VOX = core.PROP_VOX
PALM_CLEARANCE = 0.032

SHIRT_PAD = PAD_GARMENT
HEADWEAR_PAD = PAD_HEADWEAR
BACK_PAD = PAD_BACK

# Outer torso layer (apron, plate carrier, pouches): one voxel outside the 3-deep base torso.
OUTER_FRONT = TORSO_FRONT + 1
OUTER_BACK = TORSO_BACK - 1
THIGH_OUTER_Z = (THIGH_BACK, THIGH_FRONT + 1)
KNEE_Y = THIGH_Y[0]             # lowest thigh row
CUFF_Y = CALF_Y[0]              # lowest calf row, above the shoe

DEFAULT_PROPORTIONS = {
    **core.DEFAULT_PROPORTIONS,
    'bodyLength': 1.0,
}


def c(region: str, shade: float = 0.0, *, mottle: bool = True, emissive: bool = False) -> int:
    """Voxel color code. `shade` is -1 (dark) to +1 (bright)."""
    return vk.vox(region, shade, mottle=mottle, emissive=emissive)


GLOW = c('accent', emissive=True)


# --------------------------------------------------------------------------
# Shared geometry helpers (sculpt lattice of build_core)
# --------------------------------------------------------------------------

def limb_pair(part: vk.VoxelPart, bone_l: str, x, y, z, paint: Callable[[vk.VoxelGrid], None],
              paint_right: Callable[[vk.VoxelGrid], None] | None = None, *, pad=0.0, **lattice):
    """Add left limb segment and its mirror, returning (left, right)."""
    left = seg(part, bone_l, x, y, z, pad=pad, **lattice)
    paint(left)
    if paint_right is None:
        right = left.clone_mirrored_x(vk.mirror_name(bone_l))
        part.add_grid(right)
        return left, right
    proto = vk.VoxelPart('_proto')
    right_src = seg(proto, bone_l, x, y, z, pad=pad, **lattice)
    paint_right(right_src)
    right = right_src.clone_mirrored_x(vk.mirror_name(bone_l))
    part.add_grid(right)
    return left, right


def right_only(part: vk.VoxelPart, bone_l: str, x, y, z, paint: Callable[[vk.VoxelGrid], None], *,
               pad=0.0, **lattice) -> vk.VoxelGrid:
    """Add right-side segment authored in left-side coordinates."""
    proto = vk.VoxelPart('_proto')
    grid = seg(proto, bone_l, x, y, z, pad=pad, **lattice)
    paint(grid)
    return part.add_grid(grid.clone_mirrored_x(vk.mirror_name(bone_l)))


def static_part(name: str, bounds: tuple[int, ...], voxel_size: float, *, center_x: bool = False, center_z: bool = False):
    """Static one-grid part (held item or world prop). Cell y=0 starts at origin."""
    part = vk.VoxelPart(name)
    grid = part.add_grid(vk.VoxelGrid(*bounds, voxel_size=voxel_size, center_x=center_x, center_z=center_z))
    return part, grid


BARE_UPPER_X = (SLEEVE_SHORT_X[1] + 1, ARM_UPPER_X[1])   # upper arm below a short sleeve


def add_short_sleeve_arm(part: vk.VoxelPart, shirt: int, cuff: int, skin: int, *,
                         band: int | None = None, right_only_arm: bool = False):
    """Add a flush short sleeve above the bare upper arm."""

    def paint_sleeve(grid: vk.VoxelGrid):
        core.paint_short_sleeve(grid, shirt, cuff)
        if band is not None:
            x = SLEEVE_SHORT_X[1] - 1
            grid.fill(x, ARM_Y[0], ARM_Z[0], x, ARM_Y[1], ARM_Z[1], band)

    def paint_bare(grid: vk.VoxelGrid):
        grid.fill(BARE_UPPER_X[0], ARM_Y[0], ARM_Z[0], BARE_UPPER_X[1], ARM_Y[1], ARM_Z[1], skin)

    add = right_only if right_only_arm else limb_pair
    add(part, 'upperarm_l', SLEEVE_SHORT_X, ARM_Y, ARM_Z, paint_sleeve, pad=PAD_GARMENT)
    add(part, 'upperarm_l', BARE_UPPER_X, ARM_Y, ARM_Z, paint_bare)


def paint_trouser_pelvis(part: vk.VoxelPart, cloth: int, waistband: int) -> vk.VoxelGrid:
    """Trouser pelvis block with the waistband on the belt row, below the shirt tail."""
    return core.trouser_hips(part, cloth, belt=waistband)


# --------------------------------------------------------------------------
# Industrial pack: 10-region palette mapping
# --------------------------------------------------------------------------

IND_SHIRT = c('primary')
IND_SHIRT_DARK = c('primary', -0.28)
IND_SKIN = c('skin')
IND_APRON = c('leather', 0.25)
IND_APRON_GRIME = c('leather', -0.25)
IND_APRON_BLEACH = c('trim', 0.15)
IND_PACK = c('leather', 0.5)
IND_PACK_FLAP = c('leather', -0.125)
IND_RED = c('detail', 0.05)
IND_RED_DARK = c('detail', -0.3)
IND_GLOVE = c('accent', 0.125)
IND_GLOVE_DARK = c('accent', -0.125)
IND_GLOVE_CUFF = c('accent', -0.35)
IND_PANTS = c('secondary', 0.08)
IND_PANTS_DARK = c('secondary', -0.28)
IND_PANTS_WET = c('secondary', -0.5)
IND_DUST = c('leather', 0.2)
IND_BOOT = c('leather', -0.55)
IND_SOLE = c('leather', -0.75)
IND_TOE = c('leather', -0.625)
IND_LEATHER = c('leather', -0.22)
IND_STEEL = c('metal', -0.15)
IND_STEEL_DARK = c('metal', -0.55)
IND_KNIT = c('trim', 0.28)
IND_KNIT_CUFF = c('trim', 0.02)
IND_KNIT_SHADOW = c('trim', -0.22)
IND_HAT = c('trim', 0.32)
IND_HAT_RIM = c('trim', 0.05)
IND_REFLECTIVE = c('trim', 0.55, mottle=False)
IND_BADGE = c('accent', 0.25, mottle=False)


# --------------------------------------------------------------------------
# Industrial pack: avatar parts
# --------------------------------------------------------------------------

def torso_ind_work_apron() -> vk.VoxelPart:
    """Olive work shirt, stained khaki-tan apron, waist pack with crimson pouch, cobalt rubber gloves."""
    part = vk.VoxelPart('torso_ind_work_apron', covers=('chest', 'arms_upper', 'hands'))
    y0 = BELT_Y                                                         # The shirt hangs over the belt row
    bib_y = SHOULDER_Y - 2                                              # Top row of the apron bib

    # Work shirt with the belt on its hem row. The apron skirt and the packs hang over the belt row.
    torso = core.shirt_torso(part, IND_SHIRT, hem=IND_LEATHER, y=(y0, SHOULDER_Y), z=(TORSO_BACK, OUTER_FRONT + 1))
    torso.fill(-3, y0, OUTER_FRONT, 3, y0 + 3, OUTER_FRONT, IND_APRON)
    torso.fill(-2, y0 + 4, OUTER_FRONT, 2, bib_y, OUTER_FRONT, IND_APRON)   # Apron: skirt and bib
    torso.set_sym(2, bib_y + 1, OUTER_FRONT, IND_APRON)                 # Neck straps
    for side in (-2, 2):
        torso.fill(side, SHOULDER_Y, TORSO_BACK, side, SHOULDER_Y, OUTER_FRONT, IND_APRON)
    torso.fill(1, y0 + 4, OUTER_FRONT, 2, y0 + 5, OUTER_FRONT, IND_RED)    # Vivid red paint stain
    torso.set(2, y0 + 4, OUTER_FRONT, IND_RED_DARK)
    torso.fill(-2, y0 + 3, OUTER_FRONT, -1, y0 + 3, OUTER_FRONT, IND_APRON_GRIME)
    torso.set(-2, y0 + 4, OUTER_FRONT, IND_APRON_GRIME)
    torso.set(-1, bib_y - 1, OUTER_FRONT, IND_APRON_BLEACH)
    torso.set(1, bib_y, OUTER_FRONT, IND_APRON_GRIME)
    torso.fill(-2, y0, OUTER_FRONT + 1, 0, y0 + 2, OUTER_FRONT + 1, IND_PACK)   # Bulging waist pack
    torso.fill(-3, y0 + 2, OUTER_FRONT + 1, 0, y0 + 2, OUTER_FRONT + 1, IND_PACK_FLAP)
    torso.fill(2, y0, OUTER_FRONT + 1, 2, y0 + 1, OUTER_FRONT + 1, IND_RED)     # Crimson side pouch
    torso.set(2, y0 + 1, OUTER_FRONT + 1, IND_RED_DARK)
    torso.set(-1, y0 + 1, OUTER_FRONT + 1, IND_STEEL)
    core.low_collar(part, IND_SHIRT_DARK)

    add_short_sleeve_arm(part, IND_SHIRT, IND_SHIRT_DARK, IND_SKIN)

    # Chunky cobalt rubber gloves with darker cuffed wrists
    core.claw_hands(part, palm=IND_GLOVE, fingers=IND_GLOVE_DARK, cuff=IND_GLOVE_CUFF, pad=PAD_GARMENT_OUTER)
    return part


def legs_ind_weathered_cargo() -> vk.VoxelPart:
    """Blue-grey cargo pants with dried mud, crimson smear, and dark charcoal work boots on grey soles."""
    part = vk.VoxelPart('legs_ind_weathered_cargo', covers=('hips', 'legs_upper', 'legs_lower', 'feet'))
    pelvis = paint_trouser_pelvis(part, IND_PANTS, IND_PANTS_DARK)
    pelvis.set(3, BELT_Y - 1, TORSO_FRONT, IND_DUST)
    tx0, tx1 = THIGH_X
    cx0, cx1 = TROUSER_CALF_X

    def thigh_left(grid: vk.VoxelGrid):
        grid.fill(tx0, THIGH_Y[0], THIGH_BACK, tx1, THIGH_Y[1], THIGH_FRONT, IND_PANTS)
        grid.fill(tx1 - 1, KNEE_Y + 1, THIGH_FRONT + 1, tx1, KNEE_Y + 2, THIGH_FRONT + 1, IND_PANTS_DARK)   # Cargo pocket
        grid.fill(tx1 - 1, KNEE_Y + 4, THIGH_FRONT, tx1, KNEE_Y + 5, THIGH_FRONT, IND_RED_DARK)   # Red paint smear
        grid.set(tx1, KNEE_Y + 6, THIGH_FRONT, IND_RED)

    def thigh_right(grid: vk.VoxelGrid):
        grid.fill(tx0, THIGH_Y[0], THIGH_BACK, tx1, THIGH_Y[1], THIGH_FRONT, IND_PANTS)
        grid.fill(tx0, KNEE_Y, THIGH_FRONT, tx1 - 1, KNEE_Y + 1, THIGH_FRONT, IND_DUST)   # Dust on right knee
        grid.fill(tx1, KNEE_Y + 3, THIGH_BACK, tx1, KNEE_Y + 4, THIGH_FRONT, IND_PANTS_WET)

    limb_pair(part, 'thigh_l', THIGH_X, THIGH_Y, THIGH_OUTER_Z, thigh_left, thigh_right, pad=PAD_JOINT)

    def calf_left(grid: vk.VoxelGrid):
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CALF_Y[1], CALF_FRONT, IND_PANTS)
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CUFF_Y, CALF_FRONT, IND_DUST)   # Mud on trouser cuffs
        grid.set(cx1, CUFF_Y + 2, CALF_FRONT, IND_DUST)

    def calf_right(grid: vk.VoxelGrid):
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CALF_Y[1], CALF_FRONT, IND_PANTS)
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CUFF_Y, CALF_FRONT, IND_DUST)
        grid.fill(cx0, CUFF_Y + 3, CALF_FRONT, cx1, CUFF_Y + 4, CALF_FRONT, IND_PANTS_WET)

    limb_pair(part, 'calf_l', TROUSER_CALF_X, CALF_Y, CALF_Z, calf_left, calf_right)

    core.shoes(part, core.Shoe(
        upper=c('metal', -0.625), sole=c('metal', -0.45), toe=c('metal', -0.45),
        tread=c('metal', -0.7),
    ), wide=True)
    return part


def headwear_knit_beanie() -> vk.VoxelPart:
    """Chunky Teardown knit toque: folded cuff above the forehead, ribbed crown, lumpy slouched top."""
    part = vk.VoxelPart('headwear_knit_beanie', covers=('hair',))
    shell = HEAD_SHELL
    front_shell = HEAD_FRONT_SHELL
    back, front = HEAD_Z
    cuff = CROWN_Y                                                     # The cuff leaves the forehead row in view
    grid = seg(part, 'Head', (-shell, shell), (HEAD_BROW_Y, cuff + 2), (-shell, front_shell), pad=HEADWEAR_PAD)
    grid.fill(-HEAD_HALF_X, HEAD_BROW_Y, -shell, HEAD_HALF_X, HEAD_BROW_Y, -shell, IND_KNIT_SHADOW)   # Nape drop
    for side in (-shell, shell):
        grid.fill(side, HEAD_BROW_Y, -shell, side, HEAD_BROW_Y, HEAD_EAR_Z, IND_KNIT_SHADOW)   # Cuff drop behind temples
    core.hat_slab(grid, cuff, IND_KNIT_CUFF, z_front=front_shell)      # Folded cuff: 1 voxel proud of face
    grid.fill(-shell, cuff + 1, -shell, shell, cuff + 1, front, IND_KNIT)   # Crown row
    grid.fill(-shell, cuff + 2, -shell, 0, cuff + 2, 1, IND_KNIT)      # Lumpy slouched top toward the back right
    grid.fill(1, cuff + 2, back, 1, cuff + 2, front - 1, IND_KNIT)
    for x in (-shell, shell):                                       # Knit ribs on the cuff
        grid.set(x, cuff, front_shell, IND_KNIT_SHADOW)
    for z in (-shell, 0):
        grid.set(-shell, cuff, z, IND_KNIT_SHADOW)
        grid.set(shell, cuff, z, IND_KNIT_SHADOW)
    return part


def torso_ind_coveralls() -> vk.VoxelPart:
    """One-piece industrial coveralls: steel zip, chest pocket, hi-vis bands, rear tool pouch."""
    part = vk.VoxelPart('torso_ind_coveralls', covers=('chest', 'arms_upper', 'arms_lower'))
    y0 = TORSO_Y[0]

    torso = core.shirt_torso(part, IND_SHIRT, hem=IND_SHIRT_DARK, grid_y=(BELT_Y, SHOULDER_Y), z=TORSO_OUTER_Z)
    torso.fill(-CHEST_HALF_X, y0 + 3, TORSO_BACK, CHEST_HALF_X, y0 + 3, TORSO_FRONT, IND_REFLECTIVE)   # Reflective waist stripe
    torso.fill(0, y0 + 1, TORSO_FRONT, 0, SHOULDER_Y - 1, TORSO_FRONT, IND_STEEL)   # Center zip
    torso.fill(2, SHOULDER_Y - 2, OUTER_FRONT, 3, SHOULDER_Y - 1, OUTER_FRONT, IND_SHIRT)   # Chest pocket
    torso.fill(2, SHOULDER_Y - 1, OUTER_FRONT, 3, SHOULDER_Y - 1, OUTER_FRONT, IND_SHIRT_DARK)
    torso.fill(-3, SHOULDER_Y - 1, TORSO_FRONT, -2, SHOULDER_Y - 1, TORSO_FRONT, IND_BADGE)   # Name badge
    torso.fill(-2, BELT_Y, OUTER_BACK, 0, y0 + 1, OUTER_BACK, IND_LEATHER)          # Rear leather tool pouch
    core.low_collar(part, IND_SHIRT_DARK)

    def sleeve(arm: vk.VoxelGrid):
        arm.fill(ARM_UPPER_X[0], ARM_Y[0], ARM_Z[0], ARM_UPPER_X[1], ARM_Y[1], ARM_Z[1], IND_SHIRT)
        arm.fill(7, ARM_Y[0], ARM_Z[0], 7, ARM_Y[1], ARM_Z[1], IND_REFLECTIVE)   # Hi-vis sleeve band

    def forearm_sleeve(arm: vk.VoxelGrid):
        arm.fill(ARM_LOWER_X[0], ARM_Y[0], ARM_Z[0], ARM_LOWER_X[1], ARM_Y[1], ARM_Z[1], IND_SHIRT)
        arm.fill(15, ARM_Y[0], ARM_Z[0], 15, ARM_Y[1], ARM_Z[1], IND_SHIRT_DARK)   # Wrist cuff

    limb_pair(part, 'upperarm_l', ARM_UPPER_X, ARM_Y, ARM_Z, sleeve, pad=PAD_GARMENT_OUTER)
    limb_pair(part, 'lowerarm_l', ARM_LOWER_X, ARM_Y, ARM_Z, forearm_sleeve, pad=PAD_GARMENT_OUTER)
    return part


def legs_ind_heavy_boots() -> vk.VoxelPart:
    """Coverall legs tucked into tall steel-toe leather boots."""
    part = vk.VoxelPart('legs_ind_heavy_boots', covers=('hips', 'legs_upper', 'legs_lower', 'feet'))
    paint_trouser_pelvis(part, IND_SHIRT, IND_SHIRT)
    tx0, tx1 = THIGH_X
    cx0, cx1 = TROUSER_CALF_X
    shaft_y = CALF_Y[0] + 5                                            # Top row of the boot shaft

    def thigh(grid: vk.VoxelGrid):
        grid.fill(tx0, THIGH_Y[0], THIGH_BACK, tx1, THIGH_Y[1], THIGH_FRONT, IND_SHIRT)
        grid.fill(tx0, KNEE_Y, THIGH_FRONT, tx1, KNEE_Y, THIGH_FRONT, IND_SHIRT_DARK)   # Knee reinforcement

    def calf(grid: vk.VoxelGrid):
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CALF_Y[1], CALF_FRONT, IND_SHIRT)
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, shaft_y, CALF_FRONT, IND_BOOT)        # Tall boot shaft
        grid.fill(cx0, shaft_y, CALF_BACK, cx1, shaft_y, CALF_FRONT, IND_LEATHER)       # Boot collar
        grid.fill(cx0, CUFF_Y + 1, CALF_FRONT + 1, cx1, CUFF_Y + 2, CALF_FRONT + 1, IND_BOOT)   # Shin guard
        grid.set(cx1, CUFF_Y + 2, CALF_FRONT + 1, IND_STEEL)                            # Outer buckle

    limb_pair(part, 'thigh_l', THIGH_X, THIGH_Y, THIGH_Z, thigh, pad=PAD_JOINT)
    limb_pair(part, 'calf_l', TROUSER_CALF_X, CALF_Y, CALF_OUTER_Z, calf)
    core.shoes(part, core.Shoe(
        upper=IND_BOOT, sole=IND_SOLE, toe=IND_TOE, collar=IND_BOOT,
    ), wide=True)
    return part


def headwear_hard_hat() -> vk.VoxelPart:
    """Chunky Teardown hard hat: brim above the forehead, front peak, dome, top ridge."""
    part = vk.VoxelPart('headwear_hard_hat', covers=('hair',))
    shell = HEAD_SHELL
    front_shell = HEAD_FRONT_SHELL
    peak = front_shell + 1
    back, front = HEAD_Z
    grid = seg(part, 'Head', (-shell, shell), (CROWN_Y, CROWN_Y + 2), (-shell, peak), pad=HEADWEAR_PAD)
    core.hat_slab(grid, CROWN_Y, IND_HAT_RIM, z_front=front_shell)      # Brim (+1 in front of face)
    grid.fill(-HEAD_HALF_X, CROWN_Y, peak, HEAD_HALF_X, CROWN_Y, peak, IND_HAT_RIM)   # Front peak
    grid.fill(-shell, CROWN_Y + 1, -shell, shell, CROWN_Y + 1, front, IND_HAT)           # Dome shell
    grid.fill(-HEAD_HALF_X, CROWN_Y + 2, -shell, HEAD_HALF_X, CROWN_Y + 2, front, IND_HAT)
    grid.fill(0, CROWN_Y + 2, -shell, 0, CROWN_Y + 2, front, IND_HAT_RIM)                # Top crest ridge
    grid.set(0, CROWN_Y + 1, front, IND_BADGE)                         # Front badge
    return part


def back_tool_roll() -> vk.VoxelPart:
    """Canvas tool roll slung across upper back with leather straps and tools."""
    part = vk.VoxelPart('back_tool_roll')
    near, far = OUTER_BACK, OUTER_BACK - 1                             # Roll: 2 voxels behind the shirt
    y0 = SHOULDER_Y - 3
    grid = seg(part, 'spine_02', (-3, 4), (y0, SHOULDER_Y), (far, OUTER_FRONT), pad=BACK_PAD)
    canvas = c('trim', -0.25)
    grid.fill(-3, y0, far, 3, y0 + 1, near, canvas)                    # Canvas roll
    grid.fill(-2, y0, far, -2, y0 + 1, near, IND_LEATHER)              # Leather straps
    grid.fill(2, y0, far, 2, y0 + 1, near, IND_LEATHER)
    grid.fill(-3, y0, far, -3, y0 + 1, near, c('trim', -0.375))        # Closed end
    grid.set(4, y0 + 1, far, IND_STEEL)                                # Wrench jaw
    grid.set(4, y0, far, IND_RED)                                      # Red screwdriver handle
    grid.fill(2, y0 + 2, near, 2, SHOULDER_Y, near, IND_LEATHER)       # Shoulder sling
    grid.fill(2, y0 + 1, OUTER_FRONT, 2, SHOULDER_Y, OUTER_FRONT, IND_LEATHER)
    return part


# --------------------------------------------------------------------------
# Industrial pack: held items (@ 2.6 cm HELD_VOX / 2.0 cm Blowtorch)
# --------------------------------------------------------------------------

def held_pipe_wrench() -> vk.VoxelPart:
    part, grid = static_part('held_pipe_wrench', (-1, 0, -5, 13, -1, 3), HELD_VOX)
    grid.fill(-1, -5, -1, 0, 7, 0, IND_RED)                            # Red painted handle
    grid.fill(-1, -5, -1, 0, -5, 0, IND_STEEL_DARK)
    grid.fill(-1, 8, -1, 0, 13, 0, IND_STEEL)                          # Forged shank
    grid.fill(-1, 12, 1, 0, 13, 3, IND_STEEL)                          # Hook jaw
    grid.fill(-1, 11, 3, 0, 11, 3, IND_STEEL_DARK)
    grid.fill(-1, 9, 1, 0, 10, 2, IND_STEEL)                           # Heel jaw
    grid.fill(-1, 10, -1, 0, 11, -1, IND_STEEL_DARK)                   # Knurled nut
    return part


def held_blowtorch() -> vk.VoxelPart:
    part, grid = static_part('held_blowtorch', (-1, 1, -6, 8, -1, 11), 0.02, center_x=True, center_z=True)
    grid.fill(-1, -6, -1, 1, 3, 1, c('accent', 0.0))                   # Gas cylinder
    grid.fill(-1, -6, -1, 1, -6, 1, c('accent', -0.4))
    grid.fill(-1, 1, -1, 1, 1, 1, IND_REFLECTIVE)
    grid.fill(0, 4, 0, 0, 7, 0, IND_STEEL)
    grid.fill(0, 5, -1, 0, 5, -1, IND_RED)                             # Red valve knob
    grid.fill(0, 7, 1, 0, 7, 6, IND_STEEL)
    grid.fill(-1, 6, 7, 1, 8, 8, IND_STEEL_DARK)
    grid.fill(0, 7, 9, 0, 7, 11, GLOW)                                 # Emissive flame
    grid.fill(-1, 7, 9, 1, 7, 9, GLOW)
    grid.fill(0, 6, 9, 0, 8, 9, GLOW)
    return part


# --------------------------------------------------------------------------
# Industrial pack: world props (@ 5.0 cm PROP_VOX)
# --------------------------------------------------------------------------

def prop_oil_drum() -> vk.VoxelPart:
    """0.6 m x 0.9 m steel drum with rib bands, recessed lid, and rust."""
    part, grid = static_part('prop_oil_drum', (-6, 5, 0, 17, -6, 5), PROP_VOX)
    body, rib, lid = c('accent', -0.1), c('accent', -0.4), c('metal', -0.3)
    for x in range(-6, 6):
        for z in range(-6, 6):
            if (x + 0.5) ** 2 + (z + 0.5) ** 2 > 6.1 ** 2:
                continue
            inner = (x + 0.5) ** 2 + (z + 0.5) ** 2 <= 4.9 ** 2
            grid.fill(x, 0, z, x, 16 if inner else 17, z, body)
            for band in (0, 6, 11, 17):
                if not (inner and band == 17):
                    grid.set(x, band, z, rib)
            if inner:
                grid.set(x, 16, z, lid)
    grid.fill(2, 16, -1, 3, 16, 0, c('metal', -0.7, mottle=False))
    grid.fill(3, 1, 5, 4, 3, 5, IND_RED_DARK)
    grid.fill(-6, 7, -2, -6, 8, 0, IND_RED_DARK)
    return part


def prop_wooden_crate() -> vk.VoxelPart:
    """0.7 m timber crate with recessed plank panels and stencil mark."""
    part, grid = static_part('prop_wooden_crate', (-7, 6, 0, 13, -7, 6), PROP_VOX)
    frame, plank, gap = c('leather', 0.15), c('leather', 0.5), c('leather', -0.25)
    grid.fill(-7, 0, -7, 6, 13, 6, frame)
    grid.fill(-6, 1, -6, 5, 12, 5, plank)
    grid.clear(-5, 2, 6, 4, 11, 6)
    grid.clear(-5, 2, -7, 4, 11, -7)
    grid.clear(6, 2, -5, 6, 11, 4)
    grid.clear(-7, 2, -5, -7, 11, 4)
    grid.clear(-5, 13, -5, 4, 13, 4)
    for y in (5, 8):
        grid.fill(-5, y, 5, 4, y, 5, gap)
        grid.fill(-5, y, -6, 4, y, -6, gap)
        grid.fill(5, y, -5, 5, y, 4, gap)
        grid.fill(-6, y, -5, -6, y, 4, gap)
    grid.fill(-1, 12, -5, -1, 12, 4, gap)
    grid.fill(-3, 9, 5, -1, 10, 5, c('accent', 0.0, mottle=False))
    return part


def prop_workbench() -> vk.VoxelPart:
    """1.6 m workbench: plank top, steel frame, pegboard, vise, and red toolbox."""
    part, grid = static_part('prop_workbench', (-16, 15, 0, 25, -7, 7), PROP_VOX)
    wood, steel, steel_dark = c('leather', 0.45), c('metal', -0.35), c('metal', -0.65)
    for x0 in (-16, 14):
        for z0 in (-7, 5):
            grid.fill(x0, 0, z0, x0 + 1, 15, z0 + 1, steel)
    grid.fill(-15, 4, -6, 14, 4, 5, c('leather', 0.1))
    grid.fill(-16, 16, -7, 15, 17, 6, wood)
    grid.fill(-16, 16, 6, 15, 16, 6, c('leather', 0.15))
    grid.fill(-16, 18, -7, 15, 25, -7, c('primary', -0.2))
    grid.fill(-12, 21, -6, -12, 24, -6, steel)
    grid.fill(-13, 24, -6, -11, 24, -6, steel)
    grid.fill(-8, 20, -6, -8, 24, -6, c('accent', 0.0))
    grid.fill(-14, 18, 3, -11, 19, 5, steel_dark)
    grid.fill(-14, 18, 6, -11, 20, 7, steel)
    grid.fill(5, 18, -3, 11, 20, 1, IND_RED)
    grid.fill(5, 20, -3, 11, 20, 1, IND_RED_DARK)
    grid.fill(7, 21, -1, 9, 21, -1, steel)
    grid.fill(-4, 5, -4, 0, 8, 0, c('metal', -0.2))
    return part


# --------------------------------------------------------------------------
# Security pack: 10-region palette mapping
# --------------------------------------------------------------------------

SEC_SHIRT = c('primary')
SEC_SHIRT_DARK = c('primary', -0.32)
SEC_SHIRT_LIGHT = c('primary', 0.42)
SEC_SKIN = c('skin')
SEC_UNDERSHIRT = c('accent', 0.18)
SEC_BADGE = c('accent', 0.42, mottle=False)
SEC_BADGE_DARK = c('accent', -0.15, mottle=False)
SEC_BAND = c('trim', 0.45)
SEC_PANTS = c('secondary')
SEC_PANTS_DARK = c('secondary', -0.28)
SEC_BELT = c('leather', -0.35)
SEC_PAD = c('leather', -0.5)
SEC_PAD_CAP = c('secondary', 0.25)
SEC_BOOT = c('leather', -0.125)
SEC_SOLE = c('leather', -0.75)
SEC_RED = c('detail', 0.05)
SEC_RED_DARK = c('detail', -0.3)
SEC_STEEL = c('metal', 0.05)
SEC_STEEL_DARK = c('metal', -0.5)
SEC_GUNMETAL = c('metal', -0.72)
SEC_RIG = c('secondary', -0.15)
SEC_RIG_LIGHT = c('secondary', 0.35)
SEC_VISOR = c('visor', 0.1, mottle=False)


# --------------------------------------------------------------------------
# Security pack: avatar parts
# --------------------------------------------------------------------------

def torso_sec_guard_shirt() -> vk.VoxelPart:
    """Collared security shirt, yellow V-neck undershirt, epaulettes, belt & crimson pouch."""
    part = vk.VoxelPart('torso_sec_guard_shirt', covers=('chest', 'arms_upper'))
    y0 = TORSO_Y[0] + 1                                                 # Tucked uniform: the shirt ends above the duty belt

    torso = core.shirt_torso(part, SEC_SHIRT, y=(y0, SHOULDER_Y), z=TORSO_OUTER_Z)
    torso.fill(0, y0, TORSO_FRONT, 0, SHOULDER_Y - 3, TORSO_FRONT, SEC_SHIRT_DARK)        # Button placket
    torso.fill(-1, SHOULDER_Y - 1, TORSO_FRONT, 1, SHOULDER_Y - 1, TORSO_FRONT, SEC_UNDERSHIRT)   # Yellow V-neck
    torso.set(0, SHOULDER_Y - 2, TORSO_FRONT, SEC_UNDERSHIRT)
    torso.fill(1, SHOULDER_Y - 4, OUTER_FRONT, 2, SHOULDER_Y - 2, OUTER_FRONT, SEC_SHIRT)
    torso.fill(1, SHOULDER_Y - 2, OUTER_FRONT, 2, SHOULDER_Y - 2, OUTER_FRONT, SEC_SHIRT_LIGHT)   # Left chest pocket flap
    torso.set(-2, SHOULDER_Y - 2, TORSO_FRONT, SEC_BADGE)              # Gold shield badge
    torso.set(-2, SHOULDER_Y - 3, TORSO_FRONT, SEC_BADGE_DARK)
    for side in (-3, 3):                                               # Epaulettes flush on the shoulder top row
        torso.fill(side, SHOULDER_Y, TORSO_BACK, side, SHOULDER_Y, TORSO_FRONT, SEC_SHIRT_DARK)
        torso.set(side, SHOULDER_Y, 0, SEC_BADGE)
    core.low_collar(part, SEC_SHIRT_DARK)

    # Duty belt and its gear stay on the hips: a pelvis grid on the belt row and the first shirt row.
    belt_y = (BELT_Y, TORSO_Y[0])
    gear = seg(part, 'pelvis', (-HIPS_HALF_X, HIPS_HALF_X), (BELT_Y - 1, belt_y[1]), TORSO_OUTER_Z, pad=PAD_BELT)
    gear.fill(-HIPS_HALF_X, belt_y[0], TORSO_BACK, HIPS_HALF_X, belt_y[1], TORSO_FRONT, SEC_BELT)   # Duty belt
    gear.set(0, belt_y[1], TORSO_FRONT, SEC_STEEL)                     # Belt buckle
    gear.fill(2, belt_y[0], OUTER_FRONT, 2, belt_y[1], OUTER_FRONT, SEC_RED)              # Red pouch, front-left
    gear.set(2, belt_y[1], OUTER_FRONT, SEC_RED_DARK)
    gear.fill(-3, belt_y[0] - 1, OUTER_FRONT, -2, belt_y[1], OUTER_FRONT, SEC_BELT)       # Holster, front-right
    gear.fill(-1, belt_y[0], OUTER_BACK, 0, belt_y[1], OUTER_BACK, SEC_STEEL_DARK)        # Cuff case, rear

    add_short_sleeve_arm(part, SEC_SHIRT, SEC_SHIRT_DARK, SEC_SKIN, band=SEC_BAND)
    return part


def legs_sec_kneepad_cargo() -> vk.VoxelPart:
    """Tactical cargo pants with stepped dark knee pads and tall laced patrol boots."""
    part = vk.VoxelPart('legs_sec_kneepad_cargo', covers=('hips', 'legs_upper', 'legs_lower', 'feet'))
    paint_trouser_pelvis(part, SEC_PANTS, SEC_PANTS_DARK)
    tx0, tx1 = THIGH_X
    cx0, cx1 = TROUSER_CALF_X
    shaft_top = CALF_Y[1] - 3                                          # Tall patrol boot shaft rises below the knee pad

    def thigh(grid: vk.VoxelGrid):
        grid.fill(tx0, THIGH_Y[0], THIGH_BACK, tx1, THIGH_Y[1], THIGH_FRONT, SEC_PANTS)
        grid.fill(tx1, KNEE_Y + 3, THIGH_FRONT + 1, tx1, KNEE_Y + 4, THIGH_FRONT + 1, SEC_PANTS_DARK)   # Cargo pocket

    def calf(grid: vk.VoxelGrid):
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CALF_Y[1], CALF_FRONT, SEC_PANTS)
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, shaft_top, CALF_FRONT, SEC_BOOT)                     # Tall boot shaft
        grid.fill(cx0, shaft_top, CALF_BACK, cx1, shaft_top, CALF_FRONT, c('leather', -0.4))           # Boot cuff
        grid.fill(cx0, CALF_Y[1] - 2, CALF_FRONT + 1, cx1, CALF_Y[1] - 1, CALF_FRONT + 1, SEC_PAD)     # Chunky knee pad
        grid.fill(cx0, CALF_Y[1] - 1, CALF_FRONT + 1, cx1, CALF_Y[1] - 1, CALF_FRONT + 1, SEC_PAD_CAP)
        grid.fill(cx0 + 1, CUFF_Y, CALF_FRONT + 1, cx1, CUFF_Y + 2, CALF_FRONT + 1, SEC_BOOT)

    limb_pair(part, 'thigh_l', THIGH_X, THIGH_Y, THIGH_OUTER_Z, thigh, pad=PAD_JOINT)
    limb_pair(part, 'calf_l', TROUSER_CALF_X, CALF_Y, CALF_OUTER_Z, calf)
    core.shoes(part, core.Shoe(
        upper=SEC_BOOT, sole=SEC_SOLE, toe=SEC_SOLE, collar=SEC_BOOT,
    ), wide=True)
    return part


def headwear_sec_peaked_cap() -> vk.VoxelPart:
    """Teardown peaked patrol cap: band above the forehead, broad peak, 2-row crown with gold badge, tucked hair.

    The band leaves the forehead row in view. The eyes stay clear below the peak.
    """
    part = vk.VoxelPart('headwear_sec_peaked_cap', covers=('hair',))
    shell = HEAD_SHELL
    front_shell = HEAD_FRONT_SHELL
    back, front = HEAD_Z
    grid = seg(part, 'Head', (-shell, shell), (HEAD_NOSE_Y, CROWN_Y + 2), (-shell, front_shell), pad=HEADWEAR_PAD)
    hair = c('hair', -0.125)
    grid.fill(-HEAD_HALF_X, HEAD_EYE_Y, -shell, HEAD_HALF_X, HEAD_BROW_Y, -shell, hair)   # Back hair nape
    for side in (-shell, shell):
        grid.fill(side, HEAD_BROW_Y, -shell, side, HEAD_BROW_Y, HEAD_EAR_Z + 1, hair)   # Sideburns above ears/cheeks
    core.hat_slab(grid, CROWN_Y, SEC_SHIRT_DARK)                       # Dark cap band above forehead, flush with face
    grid.fill(-shell, CROWN_Y, front_shell, shell, CROWN_Y, front_shell, SEC_SHIRT_DARK)   # Broad peak
    grid.fill(-shell, CROWN_Y + 1, -shell, shell, CROWN_Y + 1, front, SEC_SHIRT)       # Crown
    grid.fill(-HEAD_HALF_X, CROWN_Y + 2, back, HEAD_HALF_X, CROWN_Y + 2, front, SEC_SHIRT_LIGHT)   # Raised crown front
    grid.set(0, CROWN_Y + 1, front, SEC_BADGE)                         # Gold badge on the crown front
    return part


def torso_sec_cyber_vest() -> vk.VoxelPart:
    """Tactical plate carrier with emissive status pip, shoulder radio, and cybernetic left arm."""
    part = vk.VoxelPart('torso_sec_cyber_vest', covers=('chest', 'arms_upper'))
    y0 = TORSO_Y[0]
    plate_y = (y0 + 3, SHOULDER_Y - 1)                                  # Rows of the plate carrier

    # Combat shirt with the belt on its hem row
    torso = core.shirt_torso(part, SEC_SHIRT_DARK, hem=SEC_BELT, grid_y=(y0, SHOULDER_Y + 2), z=(OUTER_BACK, OUTER_FRONT + 1))
    torso.fill(-2, plate_y[0], OUTER_FRONT, 2, plate_y[1], OUTER_FRONT, SEC_RIG)   # Front plate carrier
    torso.fill(-2, plate_y[0], OUTER_BACK, 2, plate_y[1], OUTER_BACK, SEC_RIG)     # Rear plate carrier
    for x in (-2, 0, 2):
        torso.set(x, plate_y[0], OUTER_FRONT + 1, SEC_RIG_LIGHT)       # Mag pouches
    for side in (-2, 2):
        torso.fill(side, SHOULDER_Y, OUTER_BACK, side, SHOULDER_Y, OUTER_FRONT, SEC_RIG)   # Shoulder straps
    torso.fill(-1, SHOULDER_Y - 4, OUTER_FRONT + 1, 1, SHOULDER_Y - 3, OUTER_FRONT + 1, SEC_RIG_LIGHT)   # Admin pouch
    torso.set(-1, SHOULDER_Y - 1, OUTER_FRONT, GLOW)                   # Emissive status pip
    torso.fill(2, SHOULDER_Y - 1, OUTER_FRONT + 1, 2, SHOULDER_Y, OUTER_FRONT + 1, SEC_STEEL_DARK)   # Shoulder radio
    torso.set(2, SHOULDER_Y, OUTER_FRONT + 1, GLOW)                    # Radio LED
    torso.fill(3, SHOULDER_Y, OUTER_FRONT + 1, 3, SHOULDER_Y + 2, OUTER_FRONT + 1, SEC_GUNMETAL)   # Antenna
    core.low_collar(part, SEC_RIG, back=False)

    sy0, sy1 = SLEEVE_Y
    sz0, sz1 = SLEEVE_Z
    cuff_x = SLEEVE_SHORT_X[1]
    pauldron = seg(part, 'upperarm_l', SLEEVE_SHORT_X, ARM_Y, ARM_Z, pad=PAD_GARMENT_OUTER)
    pauldron.fill(SLEEVE_SHORT_X[0], ARM_Y[0], ARM_Z[0], cuff_x, ARM_Y[1], ARM_Z[1], SEC_STEEL)   # Left cyber shoulder plate
    pauldron.fill(cuff_x, ARM_Y[0], ARM_Z[0], cuff_x, ARM_Y[1], ARM_Z[1], SEC_STEEL_DARK)
    cyber_upper = seg(part, 'upperarm_l', BARE_UPPER_X, ARM_Y, ARM_Z)
    cyber_upper.fill(BARE_UPPER_X[0], ARM_Y[0], ARM_Z[0], BARE_UPPER_X[1], ARM_Y[1], ARM_Z[1], SEC_GUNMETAL)   # Cyber upperarm

    forearm = seg(part, 'lowerarm_l', ARM_LOWER_X, SLEEVE_Y, SLEEVE_Z, pad=PAD_GARMENT_OUTER, **SLEEVE_LATTICE)
    forearm.fill(ARM_LOWER_X[0], sy0, sz0, ARM_LOWER_X[1], sy1, sz1, SEC_STEEL)   # Armored 3x3 cyber forearm
    forearm.fill(ARM_LOWER_X[0], sy0, sz0, ARM_LOWER_X[0], sy1, sz1, SEC_STEEL_DARK)   # Elbow ring
    forearm.fill(ARM_LOWER_X[1], sy0, sz0, ARM_LOWER_X[1], sy1, sz1, SEC_STEEL_DARK)   # Wrist ring
    forearm.fill(12, sy1, 0, 13, sy1, 0, GLOW)                         # Power strip

    add_short_sleeve_arm(part, SEC_SHIRT_DARK, SEC_RIG, SEC_SKIN, right_only_arm=True)
    return part


def headwear_riot_helmet() -> vk.VoxelPart:
    """Chunky riot helmet: shell over the skull, cheek guards, neck guard, raised tinted visor."""
    part = vk.VoxelPart('headwear_riot_helmet', covers=('hair',))
    shell_x = HEAD_SHELL
    front_shell = HEAD_FRONT_SHELL
    back, front = HEAD_Z
    grid = seg(part, 'Head', (-shell_x, shell_x), (HEAD_JAW_Y, CROWN_Y + 1), (-shell_x, front_shell), pad=HEADWEAR_PAD)
    shell = c('primary', -0.5)
    grid.fill(-shell_x, CROWN_Y, -shell_x, shell_x, CROWN_Y, front, shell)                 # Top dome
    grid.fill(-HEAD_HALF_X, HEAD_JAW_Y, -shell_x, HEAD_HALF_X, HEAD_TOP_Y, -shell_x, shell)   # Rear shell & neck guard
    grid.fill(-HEAD_HALF_X, HEAD_JAW_Y, -shell_x, HEAD_HALF_X, HEAD_JAW_Y, -shell_x, SEC_STEEL_DARK)   # Steel rear rim
    for side in (-shell_x, shell_x):
        grid.fill(side, HEAD_BROW_Y, -shell_x, side, HEAD_TOP_Y, front, shell)             # Upper side walls
        grid.fill(side, HEAD_JAW_Y, -shell_x, side, HEAD_EYE_Y, HEAD_EAR_Z, shell)         # Ear and rear jaw guard
        grid.fill(side, HEAD_JAW_Y, front, side, HEAD_MOUTH_Y, front, shell)               # Cheek guards
    grid.fill(-shell_x, CROWN_Y, front_shell, shell_x, CROWN_Y, front_shell, SEC_VISOR)    # Raised tinted visor
    grid.fill(-HEAD_HALF_X, HEAD_BROW_Y, front_shell, HEAD_HALF_X, HEAD_BROW_Y, front_shell, SEC_VISOR)
    grid.fill(0, CROWN_Y + 1, -shell_x, 0, CROWN_Y + 1, front, SEC_STEEL_DARK)             # Crest stripe
    return part


def back_radio_pack() -> vk.VoxelPart:
    """Tactical field radio pack with frequency dial, emissive beacon, and stub antenna."""
    part = vk.VoxelPart('back_radio_pack')
    near, far = OUTER_BACK, OUTER_BACK - 1                             # Case: 2 voxels behind the shirt
    y0 = SHOULDER_Y - 3
    grid = seg(part, 'spine_02', (-2, 2), (y0, SHOULDER_Y + 2), (far, OUTER_FRONT), pad=BACK_PAD)
    grid.fill(-2, y0, far, 2, SHOULDER_Y - 1, near, SEC_STEEL_DARK)    # Case
    grid.fill(-2, SHOULDER_Y - 1, far, 2, SHOULDER_Y - 1, near, SEC_GUNMETAL)   # Lid
    grid.fill(-1, y0, far, 0, y0 + 1, far, SEC_GUNMETAL)               # Speaker grille
    grid.set(1, y0 + 1, far, SEC_VISOR)                                # Cyan display dial
    grid.set(-1, SHOULDER_Y, far, GLOW)                                # Beacon LED
    grid.fill(2, SHOULDER_Y, far, 2, SHOULDER_Y + 1, far, SEC_GUNMETAL)   # Stub antenna, below the helmet neck guard
    grid.set(2, SHOULDER_Y + 2, far, SEC_STEEL)
    for side in (-2, 2):
        grid.fill(side, y0 + 1, OUTER_FRONT, side, SHOULDER_Y, OUTER_FRONT, SEC_BELT)   # Front harness straps
    return part


# --------------------------------------------------------------------------
# Security pack: held items (@ 2.6 cm HELD_VOX)
# --------------------------------------------------------------------------

def held_voxel_pistol() -> vk.VoxelPart:
    part, grid = static_part('held_voxel_pistol', (-1, 0, -4, 4, -2, 6), HELD_VOX)
    grid.fill(-1, -4, -1, 0, 0, 0, c('leather', -0.45))                # Textured grip
    grid.fill(-1, -4, -1, 0, -4, 0, SEC_GUNMETAL)
    grid.fill(-1, 1, -2, 0, 3, 5, SEC_STEEL_DARK)                      # Frame & slide
    grid.fill(-1, 3, -2, 0, 3, 5, SEC_GUNMETAL)
    grid.fill(-1, 2, 6, 0, 2, 6, SEC_GUNMETAL)                         # Muzzle
    grid.fill(-1, 4, -2, 0, 4, -2, SEC_GUNMETAL)                       # Rear sight
    grid.fill(-1, 4, 5, 0, 4, 5, SEC_GUNMETAL)                         # Front sight
    grid.fill(-1, 0, 1, 0, 0, 2, SEC_GUNMETAL)                         # Trigger guard
    grid.fill(-1, 2, 1, 0, 2, 2, SEC_STEEL)                            # Ejection port
    return part


def held_walkie_talkie() -> vk.VoxelPart:
    part, grid = static_part('held_walkie_talkie', (-1, 0, -4, 8, -2, 1), HELD_VOX)
    grid.fill(-1, -4, -2, 0, 3, 1, SEC_STEEL_DARK)
    grid.fill(-1, -2, 1, 0, -1, 1, SEC_GUNMETAL)
    grid.fill(-1, 1, 1, 0, 2, 1, SEC_VISOR)                            # Backlit screen
    grid.fill(-1, 3, 1, 0, 3, 1, GLOW)                                 # Transmit LED
    grid.fill(-1, 4, 0, 0, 4, 1, SEC_GUNMETAL)
    grid.fill(-1, 4, -2, -1, 7, -2, SEC_GUNMETAL)
    grid.set(-1, 8, -2, SEC_STEEL)
    return part


# --------------------------------------------------------------------------
# Security pack: world props (@ 5.0 cm PROP_VOX)
# --------------------------------------------------------------------------

def prop_security_terminal() -> vk.VoxelPart:
    """Access terminal: steel pedestal, keyboard deck, card reader, and emissive monitor."""
    part, grid = static_part('prop_security_terminal', (-6, 6, 0, 29, -5, 4), PROP_VOX, center_x=True)
    case, case_dark, panel = c('metal', -0.45), c('metal', -0.75), c('primary', -0.1)
    grid.fill(-5, 0, -5, 5, 1, 2, case_dark)
    grid.fill(-4, 2, -4, 4, 17, 1, case)
    grid.fill(-3, 4, 1, 3, 14, 1, panel)
    grid.fill(2, 9, 1, 2, 10, 1, GLOW)
    grid.fill(-5, 18, -5, 5, 18, 4, case_dark)
    grid.fill(-4, 19, 0, 1, 19, 3, c('trim', 0.25))
    grid.fill(3, 19, 1, 4, 19, 2, SEC_VISOR)
    grid.fill(-1, 19, -4, 1, 20, -3, case)
    grid.fill(-6, 21, -4, 6, 29, -3, case_dark)
    grid.fill(-5, 22, -3, 5, 28, -3, GLOW)
    grid.fill(-4, 26, -3, 1, 26, -3, c('accent', -0.5, mottle=False))
    grid.fill(-4, 24, -3, 3, 24, -3, c('accent', -0.5, mottle=False))
    return part


def prop_locker_cabinet() -> vk.VoxelPart:
    """Two-door steel locker with vents, handles, number plates, and plinth."""
    part, grid = static_part('prop_locker_cabinet', (-9, 9, 0, 37, -5, 5), PROP_VOX, center_x=True)
    door, seam, vent = c('primary', 0.0), c('primary', -0.6), c('primary', -0.8, mottle=False)
    grid.fill(-9, 0, -5, 9, 37, 4, door)
    grid.fill(-9, 0, -5, 9, 1, 4, seam)
    grid.fill(-9, 37, -5, 9, 37, 4, c('primary', -0.3))
    grid.fill(0, 2, 4, 0, 36, 4, seam)
    for side in (-1, 1):
        for y in (30, 32, 34):
            grid.fill(2 * side, y, 4, 7 * side, y, 4, vent)
        grid.fill(2 * side, 17, 5, 2 * side, 20, 5, SEC_STEEL)
        grid.fill(4 * side, 26, 4, 5 * side, 27, 4, SEC_BADGE)
    return part


# --------------------------------------------------------------------------
# Pack tables
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class PartSpec:
    build: Callable[[], vk.VoxelPart]
    slot: str
    label: str
    hides_hair: bool = False
    hides_legs_upper: bool = False


@dataclass(frozen=True)
class HeldSpec:
    build: Callable[[], vk.VoxelPart]
    label: str
    hand: str


@dataclass(frozen=True)
class PropSpec:
    build: Callable[[], vk.VoxelPart]
    label: str


@dataclass(frozen=True)
class PackSpec:
    key: str
    parts: tuple[PartSpec, ...]
    held: tuple[HeldSpec, ...]
    props: tuple[PropSpec, ...]
    presets: tuple[dict, ...]

    @property
    def glb_name(self) -> str:
        return f'{self.key}-pack.glb'


def preset(pack: str, preset_id: str, label: str, *, clip: str, body: str, head: str, hair: str,
           torso: str, legs: str, headwear: str | None, back: str | None,
           held_right: str | None, held_left: str | None, palette: dict,
           proportions: dict | None = None) -> dict:
    return {
        'id': preset_id,
        'pack': pack,
        'label': label,
        'rigId': RIG_ID,
        'clip': clip,
        'body': body,
        'head': head,
        'hair': hair,
        'torso': torso,
        'legs': legs,
        'headwear': headwear,
        'back': back,
        'heldRight': held_right,
        'heldLeft': held_left,
        'palette': palette,
        'proportions': {**DEFAULT_PROPORTIONS, **(proportions or {})},
    }


INDUSTRIAL = PackSpec(
    key='industrial',
    parts=(
        PartSpec(torso_ind_work_apron, 'torso', 'Work Shirt, Apron & Waist Pack'),
        PartSpec(legs_ind_weathered_cargo, 'legs', 'Weathered Cargo Pants', hides_legs_upper=True),
        PartSpec(headwear_knit_beanie, 'headwear', 'Knit Beanie', hides_hair=True),
        PartSpec(torso_ind_coveralls, 'torso', 'Zip Coveralls'),
        PartSpec(legs_ind_heavy_boots, 'legs', 'Coverall Legs & Heavy Boots', hides_legs_upper=True),
        PartSpec(headwear_hard_hat, 'headwear', 'Hard Hat', hides_hair=True),
        PartSpec(back_tool_roll, 'back', 'Tool Roll'),
    ),
    held=(
        HeldSpec(held_pipe_wrench, 'Pipe Wrench', 'hand_r'),
        HeldSpec(held_blowtorch, 'Blowtorch', 'hand_r'),
    ),
    props=(
        PropSpec(prop_oil_drum, 'Oil Drum'),
        PropSpec(prop_wooden_crate, 'Wooden Crate'),
        PropSpec(prop_workbench, 'Workbench'),
    ),
    presets=(
        preset(
            'industrial', 'ind_craftsman', 'Workshop Craftsman',
            clip='Idle_Loop', body='body_athletic', head='head_bearded_craftsman', hair='hair_short_quiff',
            torso='torso_ind_work_apron', legs='legs_ind_weathered_cargo', headwear='headwear_knit_beanie',
            back=None, held_right='held_pipe_wrench', held_left=None,
            palette={
                'skin': '#f4b998', 'hair': '#786350', 'primary': '#677844',
                'secondary': '#6c8398', 'accent': '#3863b8', 'metal': '#8e98a3',
                'trim': '#e6dac1', 'leather': '#bea17a', 'visor': '#40b8a8', 'detail': '#c83428',
            },
            # Stocky Chris Seabranch build: shorter, deeper chest, heavier limbs, larger head.
            proportions={'height': 0.92, 'torsoBulk': 1.1, 'waistScale': 1.04, 'limbThickness': 1.08, 'headScale': 1.04},
        ),
        preset(
            'industrial', 'ind_welder', 'Pipe Welder',
            clip='Idle_Loop', body='body_athletic', head='head_scarred_veteran', hair='hair_buzz_crew',
            torso='torso_ind_coveralls', legs='legs_ind_heavy_boots', headwear='headwear_knit_beanie',
            back='back_tool_roll', held_right='held_blowtorch', held_left=None,
            palette={
                'skin': '#d49062', 'hair': '#382419', 'primary': '#4b5f76',
                'secondary': '#3b424c', 'accent': '#3996e8', 'metal': '#9ca5b0',
                'trim': '#dfd6c1', 'leather': '#593b27', 'visor': '#46c6eb', 'detail': '#c43a2e',
            },
        ),
        preset(
            'industrial', 'ind_foreman', 'Site Foreman',
            clip='Idle_Talking_Loop', body='body_athletic', head='head_rugged_hero', hair='hair_cropped_fade',
            torso='torso_ind_coveralls', legs='legs_ind_weathered_cargo', headwear='headwear_hard_hat',
            back='back_tool_roll', held_right=None, held_left=None,
            palette={
                'skin': '#a8643e', 'hair': '#2a221d', 'primary': '#c9712b',
                'secondary': '#597084', 'accent': '#3a66b2', 'metal': '#9ba4ae',
                'trim': '#ebe1c4', 'leather': '#6b472d', 'visor': '#40bce6', 'detail': '#c23a2c',
            },
        ),
    ),
)

SECURITY = PackSpec(
    key='security',
    parts=(
        PartSpec(torso_sec_guard_shirt, 'torso', 'Guard Shirt & Utility Belt'),
        PartSpec(legs_sec_kneepad_cargo, 'legs', 'Knee-Pad Cargo Pants', hides_legs_upper=True),
        PartSpec(headwear_sec_peaked_cap, 'headwear', 'Peaked Guard Cap', hides_hair=True),
        PartSpec(torso_sec_cyber_vest, 'torso', 'Cyber-Tech Vest & Armored Arm'),
        PartSpec(headwear_riot_helmet, 'headwear', 'Riot Helmet', hides_hair=True),
        PartSpec(back_radio_pack, 'back', 'Radio Pack'),
    ),
    held=(
        HeldSpec(held_voxel_pistol, 'Voxel Pistol', 'hand_r'),
        HeldSpec(held_walkie_talkie, 'Walkie-Talkie', 'hand_l'),
    ),
    props=(
        PropSpec(prop_security_terminal, 'Security Terminal'),
        PropSpec(prop_locker_cabinet, 'Locker Cabinet'),
    ),
    presets=(
        preset(
            'security', 'sec_night_guard', 'Night Guard',
            clip='Idle_Loop', body='body_athletic', head='head_keen_scout', hair='hair_short_quiff',
            torso='torso_sec_guard_shirt', legs='legs_sec_kneepad_cargo', headwear='headwear_sec_peaked_cap',
            back=None, held_right='held_voxel_pistol', held_left=None,
            palette={
                'skin': '#eeb38e', 'hair': '#2b1d15', 'primary': '#2d728a',
                'secondary': '#5c4730', 'accent': '#e6b53a', 'metal': '#86909a',
                'trim': '#e0e6ec', 'leather': '#584a3f', 'visor': '#3ec2ec', 'detail': '#c6362c',
            },
        ),
        preset(
            'security', 'sec_cyber_enforcer', 'Cyber Enforcer',
            clip='Idle_Loop', body='body_athletic', head='head_cyber_visor', hair='hair_buzz_crew',
            torso='torso_sec_cyber_vest', legs='legs_sec_kneepad_cargo', headwear=None,
            back='back_radio_pack', held_right='held_voxel_pistol', held_left=None,
            palette={
                'skin': '#976346', 'hair': '#232429', 'primary': '#495a69',
                'secondary': '#5b7646', 'accent': '#38d8f2', 'metal': '#929ba4',
                'trim': '#d4dce2', 'leather': '#54515a', 'visor': '#38d8f2', 'detail': '#c83e32',
            },
        ),
        preset(
            'security', 'sec_tactical_officer', 'Tactical Officer',
            clip='Idle_Torch_Loop', body='body_athletic', head='head_scarred_veteran', hair='hair_cropped_fade',
            torso='torso_sec_guard_shirt', legs='legs_sec_kneepad_cargo', headwear='headwear_riot_helmet',
            back='back_radio_pack', held_right=None, held_left='held_walkie_talkie',
            palette={
                'skin': '#cf8c60', 'hair': '#2a221d', 'primary': '#2b4062',
                'secondary': '#3b3f47', 'accent': '#4a88e0', 'metal': '#86909a',
                'trim': '#dce2e8', 'leather': '#50505b', 'visor': '#35ccf0', 'detail': '#be342c',
            },
        ),
    ),
)

PACK_SPECS = (INDUSTRIAL, SECURITY)

REQUIRED_COVERS = {
    'torso': ('chest',),
    'legs': ('hips', 'legs_upper', 'legs_lower', 'feet'),
}


# --------------------------------------------------------------------------
# Contract checks (the same rules as scripts/validate.ts, applied at build time)
# --------------------------------------------------------------------------

def check_part(spec: PartSpec, part: vk.VoxelPart):
    missing = [tag for tag in REQUIRED_COVERS.get(spec.slot, ()) if tag not in part.covers]
    if missing:
        raise ValueError(f'{part.name}: a {spec.slot} part must cover {missing}.')
    if not part.name.startswith(f'{spec.slot}_'):
        raise ValueError(f'{part.name}: the ID must start with "{spec.slot}_".')


def check_held(spec: HeldSpec, mesh: vk.MeshData):
    lo, hi = mesh.positions.min(axis=0), mesh.positions.max(axis=0)
    clear = lo[0] >= -PALM_CLEARANCE if spec.hand == 'hand_r' else hi[0] <= PALM_CLEARANCE
    if not clear:
        raise ValueError(f'{mesh.name}: geometry goes through the back of the palm (x={lo[0]:.3f}..{hi[0]:.3f}).')
    if lo[1] > 0.04 or hi[1] < -0.04 or lo[2] > 0.06 or hi[2] < -0.06:
        raise ValueError(f'{mesh.name}: the grip origin is too far from the geometry.')


def check_presets(spec: PackSpec, part_slots: dict[str, str], held_hands: dict[str, str], clips: set[str]):
    known = {
        'body': set(CORE_BODIES),
        'head': set(CORE_HEADS),
        'hair': set(CORE_HAIR),
    }
    for slot in ('torso', 'legs', 'headwear', 'back'):
        known[slot] = {part_id for part_id, part_slot in part_slots.items() if part_slot == slot}
    for entry in spec.presets:
        name = entry['id']
        if entry['clip'] not in clips:
            raise ValueError(f'{name}: the rig has no clip "{entry["clip"]}".')
        for slot, ids in known.items():
            value = entry[slot]
            if value is not None and value not in ids:
                raise ValueError(f'{name}: unknown {slot} "{value}".')
        for field, hand in (('heldRight', 'hand_r'), ('heldLeft', 'hand_l')):
            value = entry[field]
            if value is None:
                continue
            if held_hands.get(value) != hand:
                raise ValueError(f'{name}: "{value}" is not a {hand} item of this pack.')
            if entry['clip'] not in CLOSED_GRIP_CLIPS[hand]:
                raise ValueError(f'{name}: clip "{entry["clip"]}" opens {hand}. It cannot hold "{value}".')


# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------

def build_pack(spec: PackSpec, rig: vk.RigData, stage: Path, meta: Path) -> dict:
    characters = vk.leaf_dir(stage, spec.key, 'characters')
    world = vk.leaf_dir(stage, spec.key, 'world')

    builder = vk.GlbBuilder()
    builder.add_rig(rig, with_clips=False)
    part_entries = []
    part_slots: dict[str, str] = {}
    for part_spec in spec.parts:
        part = part_spec.build()
        check_part(part_spec, part)
        mesh = core.skinned_mesh(part, rig)
        builder.add_mesh(mesh)
        part_entries.append(vk.part_entry(
            mesh, spec.key, part_spec.slot, part_spec.label, spec.glb_name,
            hides_hair=part_spec.hides_hair, hides_legs_upper=part_spec.hides_legs_upper, rig_id=RIG_ID,
        ))
        if mesh.name in part_slots:
            raise ValueError(f'{mesh.name}: duplicate part ID.')
        part_slots[mesh.name] = part_spec.slot
        print(f'  part  {mesh.name:<28} {mesh.triangles:>4} tris')
    builder.write(characters / spec.glb_name)

    held_entries = []
    held_hands: dict[str, str] = {}
    for held_spec in spec.held:
        mesh = held_spec.build().to_mesh(static=True)
        check_held(held_spec, mesh)
        path = f'{mesh.name}.glb'
        size = vk.write_static_glb(characters / path, mesh)
        held_entries.append(vk.held_entry(mesh, spec.key, held_spec.label, held_spec.hand, path, size))
        held_hands[mesh.name] = held_spec.hand
        print(f'  held  {mesh.name:<28} {mesh.triangles:>4} tris  {size} bytes')

    prop_entries = []
    for prop_spec in spec.props:
        mesh = prop_spec.build().to_mesh(static=True)
        path = f'{mesh.name}.glb'
        size = vk.write_static_glb(world / path, mesh)
        prop_entries.append(vk.prop_entry(mesh, spec.key, prop_spec.label, path, size))
        print(f'  prop  {mesh.name:<28} {mesh.triangles:>4} tris  {size} bytes')

    clips = {clip['name'] for clip in vk.RIG_CONTRACT['clips']}
    check_presets(spec, part_slots, held_hands, clips)

    catalog = vk.pack_catalog(spec.key, parts=part_entries, held=held_entries, props=prop_entries, presets=spec.presets)
    meta.mkdir(parents=True, exist_ok=True)
    (meta / f'{spec.key}.json').write_text(json.dumps(catalog, indent=2) + '\n')
    return catalog


def main():
    args = vk.script_args('Build the industrial and security voxel character packs.', 'core', 'stage', 'meta')
    rig = vk.RigData(args.core, vk.RIG_CONTRACT['joints'])
    core.load_pose(rig, args.meta)
    for spec in PACK_SPECS:
        print(f'[{spec.key}]')
        catalog = build_pack(spec, rig, args.stage, args.meta)
        print(f'  {len(catalog["parts"])} parts, {len(catalog["heldItems"])} held items, '
              f'{len(catalog["props"])} props, {len(catalog["presets"])} presets')


if __name__ == '__main__':
    main()
