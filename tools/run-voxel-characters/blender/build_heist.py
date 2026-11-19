"""Build the heist pack: demolition outfits, headwear, a back pack, held tools, and props.

Usage (Blender 5.1, headless):
  blender --background --factory-startup --python build_heist.py -- \
      --core <core-rig.glb> --stage <stage_dir> --meta <meta_dir>

Output:
  <stage>/run-voxchar-heist/3D/characters/heist-pack.glb   (rig without clips, outfit parts)
  <stage>/run-voxchar-heist/3D/characters/held_*.glb       (static held items)
  <stage>/run-voxchar-heist/3D/heist/prop_*.glb            (static world props)
  <meta>/heist.json                                        (pack catalog)

Run `build_core.py` first. This script reads the core rig and `<meta>/core.json`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402

import build_core as core  # noqa: E402
import voxchar as vk  # noqa: E402
from build_core import (  # noqa: E402
    ARM_LOWER_X, ARM_UPPER_X, ARM_Y, ARM_Z, BELT_Y, CALF_BACK, CALF_FRONT, CALF_OUTER_Z, CALF_X, CALF_Y, CALF_Z,
    CHEST_HALF_X, CROWN_Y, HEAD_BAND_Y, HEAD_FRONT_SHELL, HEAD_HALF_X, HEAD_MOUTH_Y, HEAD_NOSE_Y, HEAD_SHELL,
    HEAD_TOP_Y, HEAD_Z, PAD_BACK, PAD_GARMENT, PAD_GARMENT_OUTER, PAD_HEADWEAR, PAD_JOINT, SHOULDER_Y,
    SLEEVE_LATTICE, SLEEVE_Y, SLEEVE_Z, TAIL_Y, THIGH_BACK, THIGH_FRONT, THIGH_X,
    THIGH_Y, THIGH_Z, TORSO_BACK, TORSO_FRONT, TORSO_OUTER_Z, TORSO_Y, TROUSER_CALF_X, paired, seg,
)
from voxchar import vox  # noqa: E402

PACK = 'heist'
PARTS_FILE = 'heist-pack.glb'
HELD_VOX = core.HELD_VOX
PROP_VOX = core.PROP_VOX

# Front outer layer of a jacket, vest or flared hem: one voxel in front of the base torso.
OUTER_FRONT = TORSO_FRONT + 1
OUTER_BACK = TORSO_BACK - 1
THIGH_OUTER_Z = (THIGH_BACK, THIGH_FRONT + 1)   # holsters and pouches step out one voxel


# --------------------------------------------------------------------------
# Torso parts
# --------------------------------------------------------------------------

def arm_band(part, bone, x, code, *, right=False, detail=None):
    """Add a band that lies flush on one 2 x 2 bare arm (a tattoo, a watch, or a brace)."""
    band = seg(part, bone, x, ARM_Y, ARM_Z, pad=PAD_GARMENT)
    band.fill(x[0], ARM_Y[0], ARM_Z[0], x[1], ARM_Y[1], ARM_Z[1], code)
    if detail is not None:
        detail(band)
    if right:
        core.to_right(part, band)
    return band


def torso_heist_tee():
    """Teardown hero charcoal tee with 2x2 gold chest badge, sleeve tattoo, and wrist watch."""
    part = vk.VoxelPart('torso_heist_tee', covers=core.TORSO_COVERS)
    shirt = vox('primary', 0.0)
    torso = core.shirt_torso(part, shirt, hem=vox('primary', -0.25))               # Untucked hem above the belt
    badge_y = SHOULDER_Y - 3                                                       # Top two rows of the trunk
    torso.fill(1, badge_y, TORSO_FRONT, 2, badge_y + 1, TORSO_FRONT, vox('accent', 0.0, mottle=False))   # 2x2 Teardown chest badge
    torso.set(1, badge_y, TORSO_FRONT, vox('accent', 0.25, mottle=False))
    torso.set(2, badge_y + 1, TORSO_FRONT, vox('accent', 0.25, mottle=False))
    # Tuck the side seams above the belt. Leave a short tail across the front.
    for side in (-CHEST_HALF_X, CHEST_HALF_X):
        torso.clear(side, TORSO_Y[0], TORSO_BACK, side, TORSO_Y[0] + 1, TORSO_BACK)
    torso.fill(-2, TORSO_Y[0], OUTER_FRONT, 2, TORSO_Y[0], OUTER_FRONT, shirt)
    core.short_sleeves(part, shirt, vox('primary', -0.25))
    arm_band(
        part, 'upperarm_l', (7, 8), vox('hair', -0.25),
        detail=lambda band: band.fill(7, ARM_Y[0], ARM_Z[0], 7, ARM_Y[1], ARM_Z[1], vox('detail', 0.0)),   # Ink stripe
    )
    arm_band(
        part, 'lowerarm_l', (14, 15), vox('leather', -0.375),
        detail=lambda band: band.set(14, ARM_Y[1], ARM_Z[1], vox('accent', 0.375, mottle=False)),   # Watch face
    )
    return part


def open_front(grid, y0, y1, lining, *, half=1):
    """Open the front of a jacket block so the inner shirt shows one voxel behind."""
    grid.clear(-half, y0, OUTER_FRONT, half, y1, OUTER_FRONT)
    grid.fill(-half, y0, TORSO_FRONT, half, y1, TORSO_FRONT, lining)


def torso_heist_open_jacket():
    """Royal purple open jacket, crimson scarf, and crisp cream undershirt."""
    part = vk.VoxelPart('torso_heist_open_jacket', covers=core.SLEEVED_TORSO_COVERS)
    jacket = vox('primary', 0.0)
    trim = vox('primary', -0.25)
    lapel = vox('primary', 0.25)
    shirt = vox('trim', 0.25)
    scarf = vox('detail', 0.0)
    y0, y1 = TORSO_Y

    torso = core.shirt_torso(part, jacket, z=(TORSO_BACK, OUTER_FRONT))
    torso.fill(-CHEST_HALF_X, y0, OUTER_FRONT, CHEST_HALF_X, y1, OUTER_FRONT, jacket)   # Front panels, one voxel out
    torso.fill(-CHEST_HALF_X, y0, TORSO_BACK, CHEST_HALF_X, y0, OUTER_FRONT, trim)      # Hem band
    open_front(torso, y0, y1, shirt)
    torso.clear(-1, SHOULDER_Y, TORSO_FRONT, 1, SHOULDER_Y, TORSO_FRONT)
    for side in (-3, 3):
        torso.clear(side, y0 + 4, OUTER_FRONT, side, y1 - 2, OUTER_FRONT)
        torso.set(side, y0 + 3, OUTER_FRONT, trim)                                 # Pocket flaps
    for side in (-2, 2):
        torso.fill(side, y1 - 3, OUTER_FRONT, side, y1, OUTER_FRONT, lapel)        # Turned lapels
    for side in (-1, 1):
        torso.fill(side, y1 - 1, OUTER_FRONT, side, y1, OUTER_FRONT, scarf)        # Scarf V sides leaving undershirt open
    torso.set(0, y1 - 2, OUTER_FRONT, scarf)
    torso.fill(-1, y1 - 4, OUTER_FRONT, -1, y1 - 2, OUTER_FRONT, vox('detail', -0.25))   # Scarf drape
    core.low_collar(part, scarf)

    def upper_sleeve(grid):
        grid.fill(ARM_UPPER_X[0], ARM_Y[0], ARM_Z[0], ARM_UPPER_X[1], ARM_Y[1], ARM_Z[1], jacket)
        grid.fill(5, ARM_Y[0], ARM_Z[0], 5, ARM_Y[1], ARM_Z[1], trim)   # Shoulder seam

    def lower_sleeve(grid):
        grid.fill(ARM_LOWER_X[0], ARM_Y[0], ARM_Z[0], ARM_LOWER_X[1], ARM_Y[1], ARM_Z[1], jacket)
        grid.fill(14, ARM_Y[0], ARM_Z[0], 14, ARM_Y[1], ARM_Z[1], trim)            # Jacket cuff
        grid.fill(15, ARM_Y[0], ARM_Z[0], 15, ARM_Y[1], ARM_Z[1], shirt)           # Undershirt cuff peek

    paired(part, 'upperarm_l', ARM_UPPER_X, ARM_Y, ARM_Z, upper_sleeve, pad=PAD_GARMENT_OUTER)
    paired(part, 'lowerarm_l', ARM_LOWER_X, ARM_Y, ARM_Z, lower_sleeve, pad=PAD_GARMENT_OUTER)
    return part


def torso_heist_belted_tunic():
    """Mustard belted tunic with leather harness, twin brass buckles, and forearm wraps."""
    part = vk.VoxelPart('torso_heist_belted_tunic', covers=core.SLEEVED_TORSO_COVERS)
    cloth = vox('primary', 0.0)
    shade = vox('primary', -0.25)
    belt = vox('leather', -0.25)
    buckle = vox('accent', 0.375, mottle=False)
    wrap = vox('leather', -0.125)
    y0 = BELT_Y                                                                    # The tunic hangs over the belt row
    belt_y = TAIL_Y[1] + 1

    torso = core.shirt_torso(part, cloth, y=(y0, SHOULDER_Y), z=TORSO_OUTER_Z, open_neck=False)
    torso.fill(-CHEST_HALF_X, y0, OUTER_BACK, CHEST_HALF_X, belt_y - 1, OUTER_FRONT, cloth)   # Flared tunic skirt
    torso.fill(-CHEST_HALF_X, y0, OUTER_BACK, CHEST_HALF_X, y0, OUTER_FRONT, shade)
    torso.fill(-CHEST_HALF_X, belt_y, OUTER_BACK, CHEST_HALF_X, belt_y, OUTER_FRONT, belt)    # Proud leather belt
    for side in (-1, 1):
        torso.set(side, belt_y, OUTER_FRONT, buckle)                               # Twin buckles
    for side in (-3, 3):
        torso.fill(side, SHOULDER_Y, TORSO_BACK, side, SHOULDER_Y, TORSO_FRONT, shade)   # Shoulder caps
    torso.set(2, SHOULDER_Y - 2, TORSO_FRONT, vox('trim', 0.375, mottle=False))    # Chest patch
    core.low_collar(part, shade, turtleneck=True)

    def upper_sleeve(grid):
        grid.fill(ARM_UPPER_X[0], ARM_Y[0], ARM_Z[0], 7, ARM_Y[1], ARM_Z[1], cloth)
        grid.fill(7, ARM_Y[0], ARM_Z[0], 7, ARM_Y[1], ARM_Z[1], shade)   # Sleeve band

    def upper_wrap(grid):
        grid.fill(8, ARM_Y[0], ARM_Z[0], ARM_UPPER_X[1], ARM_Y[1], ARM_Z[1], wrap)

    def lower_sleeve(grid):
        grid.fill(ARM_LOWER_X[0], ARM_Y[0], ARM_Z[0], ARM_LOWER_X[1], ARM_Y[1], ARM_Z[1], wrap)
        grid.fill(12, ARM_Y[0], ARM_Z[0], 12, ARM_Y[1], ARM_Z[1], vox('trim', -0.125))     # Wrap band
        grid.fill(15, ARM_Y[0], ARM_Z[0], 15, ARM_Y[1], ARM_Z[1], vox('leather', -0.5))    # Wrist cuff

    paired(part, 'upperarm_l', (ARM_UPPER_X[0], 7), ARM_Y, ARM_Z, upper_sleeve, pad=PAD_GARMENT_OUTER)
    paired(part, 'upperarm_l', (8, ARM_UPPER_X[1]), ARM_Y, ARM_Z, upper_wrap, pad=PAD_GARMENT)
    paired(part, 'lowerarm_l', ARM_LOWER_X, ARM_Y, ARM_Z, lower_sleeve, pad=PAD_GARMENT_OUTER)
    return part


def torso_heist_tattoo_vest():
    """Olive field vest over crisp white tee, full ink sleeves, and leather wrist brace."""
    part = vk.VoxelPart('torso_heist_tattoo_vest', covers=core.TORSO_COVERS)
    vest = vox('primary', 0.0)
    vest_dark = vox('primary', -0.25)
    shirt = vox('trim', 0.375)
    ink = vox('hair', -0.25)
    vest_y = TAIL_Y[1]                                                             # The vest ends above two rows of tee tail

    torso = core.shirt_torso(part, shirt, hem=vox('trim', 0.0))                    # Tee tail below the vest
    torso.fill(-CHEST_HALF_X, vest_y, TORSO_BACK, CHEST_HALF_X, SHOULDER_Y, TORSO_FRONT, vest)
    torso.fill(-CHEST_HALF_X, vest_y, OUTER_FRONT, -2, SHOULDER_Y, OUTER_FRONT, vest)    # Vest panels, one voxel out
    torso.fill(2, vest_y, OUTER_FRONT, CHEST_HALF_X, SHOULDER_Y, OUTER_FRONT, vest)
    torso.fill(-1, vest_y, TORSO_FRONT, 1, SHOULDER_Y - 1, TORSO_FRONT, shirt)     # Tee in the vest opening
    torso.clear(-1, SHOULDER_Y, TORSO_FRONT, 1, SHOULDER_Y, TORSO_FRONT)
    torso.fill(-CHEST_HALF_X, vest_y, TORSO_BACK, CHEST_HALF_X, vest_y, TORSO_BACK, vest_dark)   # Rear hem
    for side in (-3, 3):
        torso.set(side, vest_y + 1, OUTER_FRONT, vest_dark)                        # Utility pockets
        torso.fill(side, SHOULDER_Y, TORSO_BACK, side, SHOULDER_Y, OUTER_FRONT, vest_dark)   # Shoulder tabs
    torso.set(3, SHOULDER_Y - 2, OUTER_FRONT, vest_dark)                           # Chest pocket
    core.low_collar(part, vest_dark)

    core.short_sleeves(part, shirt, vox('trim', 0.0))

    def ink_stripe(code):
        return lambda band: band.fill(8, ARM_Y[0], ARM_Z[0], 8, ARM_Y[1], ARM_Z[1], code)

    arm_band(part, 'upperarm_l', (7, 9), ink, detail=ink_stripe(vox('detail', 0.0)))
    arm_band(part, 'upperarm_l', (7, 9), ink, right=True, detail=ink_stripe(vox('visor', -0.25)))
    arm_band(part, 'lowerarm_l', (11, 13), ink)
    arm_band(
        part, 'lowerarm_l', (13, 15), vox('leather', -0.375), right=True,
        detail=lambda band: band.fill(14, ARM_Y[0], ARM_Z[0], 14, ARM_Y[1], ARM_Z[1], vox('accent', 0.125)),  # Wrist brace
    )
    return part


# --------------------------------------------------------------------------
# Legs parts
# --------------------------------------------------------------------------

def trouser_legs(part, cloth, *, thigh_detail=None, thigh_detail_right=None, calf_detail=None,
                 thigh_z=THIGH_Z, calf_z=CALF_Z):
    """Add full-length trouser legs: 3 x 3 thighs over sturdy 3 x 2 calves that go into the shoes."""
    tx0, tx1 = THIGH_X
    cx0, cx1 = TROUSER_CALF_X

    def thigh(grid, detail):
        grid.fill(tx0, THIGH_Y[0], THIGH_BACK, tx1, THIGH_Y[1], THIGH_FRONT, cloth)
        grid.clear(tx0, THIGH_Y[0], THIGH_FRONT, tx0, THIGH_Y[0] + 1, THIGH_FRONT)
        if detail is not None:
            detail(grid)

    def calf(grid):
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CALF_Y[1], CALF_FRONT, cloth)
        if calf_detail is not None:
            calf_detail(grid)

    paired(
        part, 'thigh_l', THIGH_X, THIGH_Y, thigh_z,
        lambda grid: thigh(grid, thigh_detail),
        None if thigh_detail_right is None else lambda grid: thigh(grid, thigh_detail_right),
        pad=PAD_JOINT,
    )
    paired(part, 'calf_l', TROUSER_CALF_X, CALF_Y, calf_z, calf)


KNEE_Y = THIGH_Y[0]             # lowest thigh row: worn knees
CUFF_Y = CALF_Y[0]              # lowest calf row, above the shoe: rolled cuffs


def legs_heist_holster_jeans():
    """Blue denim jeans with leather thigh holster and tri-color Teardown sneakers."""
    part = vk.VoxelPart('legs_heist_holster_jeans', covers=core.LEGS_COVERS)
    denim = vox('secondary', 0.0)
    faded = vox('secondary', 0.25)
    leather = vox('leather', -0.125)
    core.trouser_hips(part, denim, belt=vox('leather', -0.5), buckle=vox('metal', 0.625, mottle=False))
    tx0, tx1 = THIGH_X
    cx0, cx1 = TROUSER_CALF_X
    strap_y = THIGH_Y[1] - 3

    def knee(grid):
        grid.fill(tx0 + 1, KNEE_Y, THIGH_FRONT, tx1, KNEE_Y + 1, THIGH_FRONT, faded)   # Worn denim knees

    def holster(grid):
        knee(grid)
        grid.fill(tx0, strap_y, THIGH_BACK, tx1, strap_y, THIGH_FRONT, vox('leather', -0.5))   # Thigh strap
        grid.fill(tx1, strap_y - 2, THIGH_FRONT + 1, tx1, strap_y, THIGH_FRONT + 1, leather)   # Outer front holster
        grid.set(tx1, strap_y - 2, THIGH_FRONT + 1, vox('accent', 0.25, mottle=False))         # Brass snap

    def cuff(grid):
        grid.fill(cx0, CUFF_Y, CALF_BACK, cx1, CUFF_Y, CALF_FRONT + 1, faded)          # Rolled denim cuffs

    trouser_legs(part, denim, thigh_detail=holster, thigh_detail_right=knee, calf_detail=cuff, thigh_z=THIGH_OUTER_Z, calf_z=CALF_OUTER_Z)
    core.shoes(part, core.Shoe(
        upper=vox('trim', 0.625), sole=vox('trim', 0.625), toe=vox('trim', 0.75),
        heel=vox('trim', 0.25), saddle=vox('detail', 0.0),
    ), wide=True)
    return part


def legs_heist_denim_sneakers():
    """Light teal denim trousers with clean two-tone sneakers."""
    part = vk.VoxelPart('legs_heist_denim_sneakers', covers=core.LEGS_COVERS)
    denim = vox('secondary', 0.0)
    seam = vox('secondary', -0.25)
    hips = core.trouser_hips(part, denim, belt=vox('leather', -0.25), buckle=vox('metal', 0.375, mottle=False))
    for side in (-3, 3):
        hips.set(side, BELT_Y - 1, TORSO_FRONT, seam)                              # Pocket seams below the belt
    tx0, tx1 = THIGH_X
    cx0, cx1 = TROUSER_CALF_X

    def thigh(grid):
        grid.fill(tx0 + 1, KNEE_Y, THIGH_FRONT, tx1, KNEE_Y + 1, THIGH_FRONT, vox('secondary', 0.25))

    def cuff(grid):
        grid.fill(cx0, CUFF_Y, CALF_BACK, cx1, CUFF_Y, CALF_FRONT + 1, vox('secondary', 0.25))

    trouser_legs(part, denim, thigh_detail=thigh, calf_detail=cuff, calf_z=CALF_OUTER_Z)
    core.shoes(part, core.Shoe(
        upper=vox('trim', 0.375), sole=vox('leather', -0.5), toe=vox('trim', 0.625),
        stripe=vox('accent', 0.0),
    ), wide=True)
    return part


def legs_heist_tactical_strap():
    """Dark slate trousers with tactical thigh rig, knee pads, and dark boots."""
    part = vk.VoxelPart('legs_heist_tactical_strap', covers=core.LEGS_COVERS)
    cloth = vox('secondary', 0.0)
    strap = vox('leather', -0.375)
    core.trouser_hips(part, cloth, belt=strap, buckle=vox('metal', 0.5, mottle=False))
    tx0, tx1 = THIGH_X
    cx0, cx1 = TROUSER_CALF_X
    strap_y = THIGH_Y[1] - 2

    def strapped(grid):
        grid.fill(tx0, strap_y, THIGH_BACK, tx1, strap_y, THIGH_FRONT, strap)      # Thigh strap
        grid.set(tx0 + 1, strap_y, THIGH_FRONT, vox('metal', 0.375, mottle=False))   # Strap buckle
        grid.fill(tx1, strap_y - 3, THIGH_FRONT + 1, tx1, strap_y - 1, THIGH_FRONT + 1, strap)   # Outer thigh pouch

    def knee_pad(grid):
        grid.fill(cx0, CALF_Y[1] - 2, CALF_FRONT + 1, cx1, CALF_Y[1] - 1, CALF_FRONT + 1, vox('leather', -0.5))

    trouser_legs(part, cloth, thigh_detail=strapped, thigh_detail_right=lambda grid: None, calf_detail=knee_pad,
                 thigh_z=THIGH_OUTER_Z, calf_z=CALF_OUTER_Z)
    core.shoes(part, core.Shoe(
        upper=vox('leather', -0.5), sole=vox('leather', -0.75), toe=vox('leather', -0.625),
        collar=vox('secondary', -0.25),
    ), wide=True)
    return part


def legs_heist_cargo_shorts():
    """Tan knee-length cargo shorts, bright socks, and rugged trail boots."""
    part = vk.VoxelPart('legs_heist_cargo_shorts', covers=core.LEGS_COVERS)
    cloth = vox('secondary', 0.0)
    flap = vox('secondary', -0.25)
    core.trouser_hips(part, cloth, belt=vox('leather', -0.25), buckle=vox('metal', 0.5, mottle=False))
    tx0, tx1 = THIGH_X
    cx0, cx1 = CALF_X
    hem = THIGH_Y[0] + 1                                                           # The shorts end one row above the knee row
    sock_y = CALF_Y[0] + 4

    def thigh(grid):
        grid.fill(tx0, hem, THIGH_BACK, tx1, THIGH_Y[1], THIGH_FRONT, cloth)      # Loose cargo leg
        grid.fill(tx0, hem, THIGH_BACK, tx1, hem, THIGH_FRONT, flap)               # Hem
        grid.fill(tx1, hem + 2, THIGH_FRONT + 1, tx1, hem + 3, THIGH_FRONT + 1, flap)   # Cargo pocket

    def calf(grid):
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CALF_Y[1], CALF_FRONT, vox('skin', -0.04))
        grid.fill(cx0, CALF_Y[0], CALF_BACK, cx1, sock_y, CALF_FRONT, vox('accent', 0.0))   # Tall socks
        grid.fill(cx0, sock_y, CALF_BACK, cx1, sock_y, CALF_FRONT, vox('trim', 0.375))      # Sock stripe

    paired(part, 'thigh_l', THIGH_X, THIGH_Y, THIGH_OUTER_Z, thigh, pad=PAD_JOINT)
    core.bare_knees(part, hem)
    paired(part, 'calf_l', CALF_X, CALF_Y, CALF_Z, calf, half_x=True)
    core.shoes(part, core.Shoe(
        upper=vox('leather', -0.5), sole=vox('leather', -0.625), toe=vox('leather', -0.375),
        collar=vox('leather', 0.125), stripe=vox('leather', 0.125),
    ))
    return part


# --------------------------------------------------------------------------
# Headwear and back
# --------------------------------------------------------------------------

def headwear_red_bob_hat():
    """Chunky Teardown red bucket hat: 7-wide brim above the forehead, 2-row crown, dark bob that frames the face.

    The brim goes one voxel in front of the face plane. A deeper brim hides the lenses from the game camera.
    """
    part = vk.VoxelPart('headwear_red_bob_hat')
    shell = HEAD_SHELL
    brim = shell + 1
    front_shell = HEAD_FRONT_SHELL
    grid = seg(part, 'Head', (-brim, brim), (HEAD_MOUTH_Y, CROWN_Y + 2), (-brim, front_shell), pad=PAD_HEADWEAR)
    hair = vox('hair', -0.125)
    lock = vox('hair', 0.125)
    back, front = HEAD_Z
    grid.fill(-HEAD_HALF_X, HEAD_MOUTH_Y, -shell, HEAD_HALF_X, HEAD_TOP_Y, -shell, hair)   # Back bob curtain
    for side in (-shell, shell):
        grid.fill(side, HEAD_MOUTH_Y, -shell, side, HEAD_TOP_Y, front, hair)       # Side curtains over the ears
        grid.set(side, HEAD_MOUTH_Y, front, lock)                                  # Curled tips at the jaw
    core.hat_slab(grid, CROWN_Y, vox('detail', -0.25), reach=brim, z_front=front_shell)   # 7-wide brim (+1 front)
    grid.fill(-shell, CROWN_Y + 1, -shell, shell, CROWN_Y + 2, front, vox('detail', 0.125))   # Crown
    grid.fill(-shell, CROWN_Y + 1, -shell, shell, CROWN_Y + 1, front, vox('detail', -0.125))  # Crown band
    return part


def headwear_bandana():
    """Tied bandana: a one-row band around the forehead, a knot and two tails at the back."""
    part = vk.VoxelPart('headwear_bandana')
    shell = HEAD_SHELL
    front_shell = HEAD_FRONT_SHELL
    tail = -shell - 1
    grid = seg(part, 'Head', (-shell, shell), (HEAD_MOUTH_Y, HEAD_BAND_Y), (tail, front_shell), pad=PAD_HEADWEAR)
    cloth = vox('detail', 0.0)
    grid.fill(-shell, HEAD_BAND_Y, -shell, shell, HEAD_BAND_Y, front_shell, cloth)   # Headband wrap around forehead
    grid.clear(-HEAD_HALF_X, HEAD_BAND_Y, HEAD_Z[0], HEAD_HALF_X, HEAD_BAND_Y, HEAD_Z[1])   # The skull is inside it
    grid.fill(-HEAD_HALF_X, HEAD_BAND_Y, front_shell, 0, HEAD_BAND_Y, front_shell, vox('detail', 0.25))   # Fold highlight
    grid.fill(0, HEAD_BAND_Y, tail, 0, HEAD_BAND_Y, tail, vox('detail', -0.25))    # Knot
    grid.fill(-1, HEAD_NOSE_Y, tail, -1, HEAD_BAND_Y, tail, cloth)                 # Hanging tails
    grid.fill(1, HEAD_MOUTH_Y, tail, 1, HEAD_BAND_Y, tail, vox('detail', -0.125))
    return part


def back_demolition_pack():
    """Canvas demolition backpack with shoulder straps and three crimson charges."""
    part = vk.VoxelPart('back_demolition_pack')
    near, far = OUTER_BACK, OUTER_BACK - 1                                         # Pack body: 2 voxels behind the shirt
    y0, y1 = SHOULDER_Y - 4, SHOULDER_Y - 1
    grid = seg(part, 'spine_02', (-3, 3), (y0, SHOULDER_Y + 1), (far, OUTER_FRONT), pad=PAD_BACK)
    canvas = vox('leather', -0.25)
    strap = vox('leather', -0.5)
    grid.fill(-2, y0, far, 2, y1, near, canvas)                                    # Pack body
    grid.fill(-2, y1, far, 2, y1, far, vox('leather', 0.0))                        # Top flap
    grid.set(0, y0 + 1, far, vox('metal', 0.5, mottle=False))                      # Buckle
    for x in (-2, 0, 2):
        grid.fill(x, SHOULDER_Y, far, x, SHOULDER_Y, near, vox('detail', 0.0))     # Red explosive charges
        grid.set(x, SHOULDER_Y + 1, far, vox('trim', 0.5))                         # Fuse caps, behind the head
    for side in (-2, 2):
        grid.fill(side, y0 + 1, OUTER_FRONT, side, SHOULDER_Y, OUTER_FRONT, strap)   # Front harness straps
    return part


# --------------------------------------------------------------------------
# Held items (@ 2.8 cm HELD_VOX; the sledgehammer @ CHAR_VOX): +Y shaft, +Z forward, grip at the origin
# --------------------------------------------------------------------------

def static_grid(part, x, y, z, voxel):
    """Add a static grid. X and Z cells are symmetric about the origin. Y starts at origin."""
    grid = vk.VoxelGrid(x[0], x[1], y[0], y[1], z[0], z[1], voxel_size=voxel, center_x=True, center_z=True)
    return part.add_grid(grid)


def held_sledgehammer():
    """Teardown sledgehammer at the voxel size of the body: the shaft is one voxel and fills the grip channel."""
    part = vk.VoxelPart('held_sledgehammer')
    grid = static_grid(part, (0, 1), (-3, 14), (-2, 2), core.CHAR_VOX)
    grid.fill(0, -3, 0, 0, 11, 0, vox('leather', 0.125))                           # Hardwood shaft
    grid.set(0, -3, 0, vox('leather', -0.375))                                     # Pommel
    grid.fill(0, 12, -2, 1, 14, 2, vox('metal', -0.375))                           # Heavy steel head: 2 x 3 x 5
    grid.fill(0, 13, -2, 1, 13, -2, vox('metal', -0.125))                          # Struck faces
    grid.fill(0, 13, 2, 1, 13, 2, vox('metal', 0.125))
    return part


def held_detonator():
    part = vk.VoxelPart('held_detonator')
    grid = static_grid(part, (0, 1), (-3, 7), (-1, 1), HELD_VOX)
    grid.fill(0, -3, 0, 0, 0, 0, vox('leather', -0.45))                            # Grip
    grid.fill(0, 1, -1, 1, 3, 1, vox('metal', -0.35))                              # Housing
    grid.fill(0, 1, -1, 1, 1, 1, vox('detail', 0.05))                              # Hazard stripe
    grid.fill(1, 2, 0, 1, 2, 0, vox('trim', 0.45, mottle=False))                   # Keypad
    grid.set(1, 3, 1, vox('accent', emissive=True))                                # Armed LED
    grid.fill(0, 4, -1, 0, 7, -1, vox('metal', 0.35))                              # Antenna
    grid.set(0, 4, 1, vox('detail', 0.25, mottle=False))                           # Red trigger button
    return part


def held_crowbar():
    part = vk.VoxelPart('held_crowbar')
    grid = static_grid(part, (0, 0), (-6, 18), (-1, 2), HELD_VOX)
    steel = vox('metal', 0.3)
    grid.fill(0, -5, 0, 0, 16, 0, vox('detail', 0.0))                              # Painted shaft
    grid.fill(0, -6, 0, 0, -6, 1, steel)                                           # Chisel end
    grid.fill(0, 17, 0, 0, 18, 1, steel)                                           # Gooseneck bend
    grid.fill(0, 18, 2, 0, 18, 2, steel)
    grid.fill(0, 16, 2, 0, 17, 2, steel)                                           # Forged claw tip
    grid.fill(0, -2, 0, 0, 2, 0, vox('hair', -0.4))                                # Grip wrap
    return part


def held_duffel_bag():
    """Duffel bag for the left hand, hanging cleanly on the palm side (-X)."""
    part = vk.VoxelPart('held_duffel_bag')
    grid = static_grid(part, (-2, 0), (-6, 6), (0, 6), HELD_VOX)
    canvas = vox('primary', -0.35)
    strap = vox('leather', -0.4)
    grid.fill(-2, -6, 2, 0, 6, 6, canvas)                                          # Bag body
    for y in (-6, 6):
        grid.fill(-2, y, 2, 0, y, 6, vox('primary', -0.1))                         # End caps
    grid.fill(-1, -5, 2, -1, 5, 2, vox('accent', 0.15, mottle=False))              # Brass zip
    grid.fill(-1, -2, 0, -1, 2, 0, strap)                                          # Handle
    for y in (-2, 2):
        grid.fill(-1, y, 0, -1, y, 1, strap)
        grid.fill(-2, y, 2, 0, y, 6, strap)                                        # Strap bands
    return part


HELD = (
    ('Sledgehammer', 'hand_r', held_sledgehammer),
    ('Detonator', 'hand_r', held_detonator),
    ('Crowbar', 'hand_r', held_crowbar),
    ('Duffel Bag', 'hand_l', held_duffel_bag),
)


# --------------------------------------------------------------------------
# World props: base on y = 0, centered on X and Z (@ 5 cm PROP_VOX)
# --------------------------------------------------------------------------

def prop_explosive_crate():
    part = vk.VoxelPart('prop_explosive_crate')
    grid = static_grid(part, (-5, 5), (0, 12), (-5, 5), PROP_VOX)
    planks = vox('leather', 0.45)
    frame = vox('leather', 0.15)
    grid.fill(-5, 0, -5, 5, 10, 5, frame)
    grid.fill(-4, 1, -4, 4, 9, 4, planks)
    for z in (-5, 5):
        grid.clear(-4, 1, z, 4, 9, z)
    for x in (-5, 5):
        grid.clear(x, 1, -4, x, 9, 4)
    grid.clear(-4, 10, -4, 4, 10, 4)
    for z in (-4, 4):
        for x in range(-4, 5):
            grid.fill(x, 4, z, x, 6, z, vox('accent', 0.1) if (x // 2) % 2 == 0 else vox('primary', -0.3))
    for z in (-2, 0, 2):
        grid.fill(-3, 10, z, 3, 10, z, vox('detail', 0.05))                        # Charges in open top
        grid.fill(-1, 10, z, 0, 10, z, vox('primary', -0.3))
        grid.set(4, 10, z, vox('metal', 0.6))
    grid.set(4, 11, 0, vox('accent', emissive=True))
    return part


def prop_brick_rubble():
    """Mound of bricks and concrete chunks."""
    part = vk.VoxelPart('prop_brick_rubble')
    grid = static_grid(part, (-10, 10), (0, 6), (-7, 7), PROP_VOX)
    rng = np.random.default_rng(41)
    bricks = (vox('detail', -0.2), vox('detail', -0.35), vox('leather', 0.05), vox('detail', -0.05))
    concrete = (vox('metal', 0.1), vox('metal', -0.15), vox('metal', 0.3))
    for level, (half_x, half_z, count) in enumerate(((9, 6, 17), (6, 4, 9), (3, 2, 4))):
        y = level * 2
        for _ in range(count):
            along_x = rng.random() < 0.5
            size_x, size_z = (4, 2) if along_x else (2, 4)
            x = int(rng.integers(-half_x, half_x - size_x + 2))
            z = int(rng.integers(-half_z, half_z - size_z + 2))
            is_brick = rng.random() < 0.72
            code = bricks[int(rng.integers(len(bricks)))] if is_brick else concrete[int(rng.integers(len(concrete)))]
            height = 2 if is_brick else int(rng.integers(1, 4))
            grid.fill(x, y, z, x + size_x - 1, y + height - 1, z + size_z - 1, code)
    grid.fill(-10, 0, -1, -9, 0, 0, concrete[0])
    grid.fill(9, 0, 0, 10, 0, 1, bricks[0])
    grid.fill(-2, 0, -7, 0, 0, -6, bricks[1])
    grid.fill(1, 0, 6, 2, 0, 7, concrete[1])
    return part


def prop_safety_barrier():
    part = vk.VoxelPart('prop_safety_barrier')
    grid = static_grid(part, (-11, 11), (0, 15), (-3, 3), PROP_VOX)
    steel = vox('metal', -0.1)
    for side in (-1, 1):
        x0, x1 = sorted((side * 10, side * 9))
        grid.fill(x0, 0, -3, x1, 0, 3, vox('metal', -0.35))
        grid.fill(x0, 1, 0, x1, 13, 0, steel)
    grid.fill(-11, 4, 1, 11, 5, 1, vox('metal', 0.2))
    for x in range(-11, 12):
        for y in range(9, 13):
            stripe = ((x + (y - 9) // 2) // 2) % 2 == 0
            grid.set(x, y, 1, vox('accent', 0.1) if stripe else vox('primary', -0.3))
    grid.fill(-1, 13, 1, 1, 13, 1, vox('metal', -0.4))
    grid.set(0, 14, 1, vox('accent', emissive=True))
    return part


PROPS = (
    ('Explosive Crate', prop_explosive_crate),
    ('Brick Rubble', prop_brick_rubble),
    ('Safety Barrier', prop_safety_barrier),
)


# --------------------------------------------------------------------------
# Catalog
# --------------------------------------------------------------------------

PARTS = (
    ('torso', 'Heist Tee', torso_heist_tee, {}),
    ('legs', 'Holster Jeans', legs_heist_holster_jeans, {'hides_legs_upper': True}),
    ('torso', 'Open Jacket', torso_heist_open_jacket, {}),
    ('legs', 'Denim and Sneakers', legs_heist_denim_sneakers, {'hides_legs_upper': True}),
    ('torso', 'Belted Tunic', torso_heist_belted_tunic, {}),
    ('legs', 'Tactical Strap Trousers', legs_heist_tactical_strap, {'hides_legs_upper': True}),
    ('torso', 'Tattoo Vest', torso_heist_tattoo_vest, {}),
    ('legs', 'Cargo Shorts', legs_heist_cargo_shorts, {'hides_legs_upper': True}),
    ('headwear', 'Red Bob Hat', headwear_red_bob_hat, {'hides_hair': True}),
    ('headwear', 'Bandana', headwear_bandana, {'hides_hair': False}),
    ('back', 'Demolition Pack', back_demolition_pack, {}),
)

PRESETS = (
    core.preset(
        'heist_wrecker', PACK, 'Heist Wrecker', 'Idle_Loop',
        {'skin': '#f2b792', 'hair': '#4a2f20', 'primary': '#595055', 'secondary': '#2f6da8',
         'accent': '#e09d38', 'metal': '#8d96a0', 'trim': '#e8e2d7', 'leather': '#70472b',
         'visor': '#3a93bd', 'detail': '#cf3e32'},
        body='body_athletic', head='head_rugged_hero', hair='hair_short_quiff',
        torso='torso_heist_tee', legs='legs_heist_holster_jeans',
        held_right='held_sledgehammer',
    ),
    core.preset(
        'heist_fixer', PACK, 'Heist Fixer', 'Walk_Formal_Loop',
        {'skin': '#ecb08c', 'hair': '#cfa042', 'primary': '#5c3f9c', 'secondary': '#6fa3a8',
         'accent': '#d99c38', 'metal': '#b8c0c8', 'trim': '#ebe3cf', 'leather': '#5b3b28',
         'visor': '#3f8f9c', 'detail': '#b02c44'},
        body='body_athletic', head='head_scarred_veteran', hair='hair_wavy_blonde',
        torso='torso_heist_open_jacket', legs='legs_heist_denim_sneakers',
        held_left='held_duffel_bag',
    ),
    core.preset(
        'heist_lookout', PACK, 'Heist Lookout', 'Idle_Loop',
        {'skin': '#eeb38e', 'hair': '#33282b', 'primary': '#cf9d46', 'secondary': '#3b4868',
         'accent': '#eb9b38', 'metal': '#9ca5af', 'trim': '#e6dfd2', 'leather': '#43372f',
         'visor': '#3fa9cf', 'detail': '#c93a42'},
        body='body_athletic', head='head_cool_shades', hair='hair_bob_cut',
        torso='torso_heist_belted_tunic', legs='legs_heist_tactical_strap',
        headwear='headwear_red_bob_hat', held_right='held_detonator',
    ),
    core.preset(
        'heist_scout', PACK, 'Heist Scout', 'Sword_Idle',
        {'skin': '#f2b792', 'hair': '#4a2f20', 'primary': '#627442', 'secondary': '#b28f58',
         'accent': '#2e9386', 'metal': '#a4adb7', 'trim': '#ebe7df', 'leather': '#5a3d2a',
         'visor': '#3ebae6', 'detail': '#cf3e32'},
        body='body_athletic', head='head_keen_scout', hair='hair_slick_back',
        torso='torso_heist_tattoo_vest', legs='legs_heist_cargo_shorts',
        headwear='headwear_bandana', back='back_demolition_pack',
        held_right='held_crowbar',
    ),
)


def main():
    args = vk.script_args('Build the heist voxel character pack.', 'core', 'stage', 'meta')
    rig = vk.RigData(args.core, vk.RIG_CONTRACT['joints'])
    core.load_pose(rig, args.meta)
    core_parts = json.loads((Path(args.meta) / 'core.json').read_text())['parts']
    characters = vk.leaf_dir(args.stage, PACK, 'characters')
    world = vk.leaf_dir(args.stage, PACK, 'world')

    builder = vk.GlbBuilder()
    builder.add_rig(rig, with_clips=False)
    parts = []
    for slot, label, make, rules in PARTS:
        mesh = core.skinned_mesh(make(), rig)
        builder.add_mesh(mesh)
        parts.append(vk.part_entry(mesh, PACK, slot, label, PARTS_FILE, **rules))
        print(f'  {slot:<8} {mesh.name:<28} {mesh.triangles:>5} triangles')
    builder.write(characters / PARTS_FILE)

    held = []
    for label, hand, make in HELD:
        mesh = make().to_mesh(static=True)
        file_name = f'{mesh.name}.glb'
        size = vk.write_static_glb(characters / file_name, mesh)
        held.append(vk.held_entry(mesh, PACK, label, hand, file_name, size))
        print(f'  held     {mesh.name:<28} {mesh.triangles:>5} triangles  x {mesh.bounds()["min"][0]:+.3f}..{mesh.bounds()["max"][0]:+.3f}')

    props = []
    for label, make in PROPS:
        mesh = make().to_mesh(static=True)
        file_name = f'{mesh.name}.glb'
        size = vk.write_static_glb(world / file_name, mesh)
        props.append(vk.prop_entry(mesh, PACK, label, file_name, size))
        print(f'  prop     {mesh.name:<28} {mesh.triangles:>5} triangles  size {mesh.bounds()["size"]}')

    core.check_preset_budgets(PRESETS, [*core_parts, *parts], held)
    catalog = vk.pack_catalog(PACK, parts=parts, held=held, props=props, presets=PRESETS)
    path = core.write_catalog(args.meta, catalog)
    print(f'Wrote {PARTS_FILE} ({len(parts)} parts), {len(held)} held items, {len(props)} props, and {path}.')


if __name__ == '__main__':
    main()
