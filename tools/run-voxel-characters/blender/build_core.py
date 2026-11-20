"""Build the core pack: the UAL1 rig, 5 cm canonical voxel bodies, sculpted heads, hair, and starter outfit.

Usage (Blender 5.1, headless):
  blender --background --factory-startup --python build_core.py -- \
      --source <ual1-base.glb> --stage <stage_dir> --meta <meta_dir>

`npm run build` writes `<meta>/humanoid-pose.json` first. This script reads it.

Output:
  <stage>/run-cubix-core/3D/characters/core-rig.glb  (rig, shared clips, all core parts)
  <meta>/core.json                                     (pack catalog)

`build_heist.py` and `build_industrial_security.py` share the lattice, the anatomy
and the segment helpers defined here.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from itertools import product
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

import voxchar as vk  # noqa: E402
from voxchar import vox  # noqa: E402

PACK = 'core'
RIG_FILE = 'core-rig.glb'

# --------------------------------------------------------------------------
# Canonical voxel sizes (metres)
# --------------------------------------------------------------------------

CHAR_VOX = float(vk.PROPORTION_CONTRACT['humanoid']['voxelSize'])   # 5.0 cm: body, outfit, head, hair
HAT_VOX = float(vk.PROPORTION_CONTRACT['humanoid']['headwearVoxelSize'])   # 2.5 cm: snug humanoid headwear
HELD_VOX = 0.028     # 2.8 cm held tools & weapons
PROP_VOX = 0.05      # 5.0 cm world props

# --------------------------------------------------------------------------
# Sculpt lattice
#
# The voxel humans are sculpted in the T-pose of the default humanoid proportions
# (`contracts/data/proportions.json` -> `humanoid.defaults`). All segments use one lattice:
#
#   X  cell i is centered on x = i * CHAR_VOX.       Torso -3..3, skull -1..1, left leg 1..3, left arm 4..18.
#   Y  row j is [j, j + 1] * CHAR_VOX above the floor. The character is 38–39 rows (1.90–1.95 m) with hair.
#   Z  cell k is centered on z = SPINE_Z + k * CHAR_VOX.   Torso -1..1 (3 deep), skull -1..2 (4 deep), face plane k = 2.
#
# A part with an even cell count (the 2 x 2 neck, calf and shoe) uses the half lattice: cell i is
# [i, i + 1] * CHAR_VOX. It is symmetric about the same axis and half a voxel inside the odd part.
# `vk.SculptPose` writes the bind-pose mesh, thus the runtime shows these cells as exact cubes.
# --------------------------------------------------------------------------

SPINE_Z = 0.025
LATTICE_ORIGIN = (0.0, 0.0, SPINE_Z)

TAG_CHEST = 'chest'
TAG_HIPS = 'hips'
TAG_HEAD = 'head'
TAG_ARMS_UPPER = 'arms_upper'
TAG_ARMS_LOWER = 'arms_lower'
TAG_HANDS = 'hands'
TAG_LEGS_UPPER = 'legs_upper'
TAG_LEGS_LOWER = 'legs_lower'
TAG_FEET = 'feet'
TAG_HAIR = 'hair'

TORSO_COVERS = (TAG_CHEST,)
SLEEVED_TORSO_COVERS = (TAG_CHEST, TAG_ARMS_UPPER, TAG_ARMS_LOWER)
LEGS_COVERS = (TAG_HIPS, TAG_LEGS_UPPER, TAG_LEGS_LOWER, TAG_FEET)

# Rows (inclusive) from the floor. Canonical human proportions: 2 shoe rows, 17 leg rows, 1 belt row,
# 10 shirt rows, 1 exposed neck row (plus 2 rows inside the torso/neckline), 5 face rows and 2 hair rows.
SHOE_Y = (0, 1)         # 0.00 m .. 0.10 m
CALF_Y = (2, 11)        # 0.10 m .. 0.60 m: from the top of the shoe to one row above the knee joint (0.56 m)
THIGH_Y = (11, 18)      # 0.55 m .. 0.95 m: the hip joint is at 0.956 m
HIPS_Y = (18, 22)       # 0.90 m .. 1.15 m: crotch row, belt row, and three rows below the shirt
BELT_Y = 19             # 0.95 m .. 1.00 m: trouser belt row
TAIL_Y = (20, 22)       # 1.00 m .. 1.15 m: the shirt rows that hang over the pelvis
WAIST_Y = (22, 25)      # 1.10 m .. 1.30 m: body waist (one row into the hips and one row into the chest)
CHEST_Y = (25, 29)      # 1.25 m .. 1.50 m: body chest
SHOULDER_Y = CHEST_Y[1] # top chest row. The top of the shoulders is at 1.50 m.
TORSO_Y = (TAIL_Y[0], SHOULDER_Y)   # 1.00 m .. 1.50 m: the 10 rows of a shirt
YOKE_Y = (28, SHOULDER_Y)           # 1.40 m .. 1.50 m: shoulder rows of a shirt. They turn with the arms.
TRUNK_Y = (TORSO_Y[0], YOKE_Y[0] - 1)   # 1.00 m .. 1.40 m: the flat box of a shirt below the shoulders
COLLAR_Y = 30           # 1.50 m .. 1.55 m: 1-block collar row rising around the neck base
NECK_Y = (28, 32)       # 1.40 m .. 1.65 m: anchored 2 blocks deep inside chest/shirt, exposing 1 block above shoulders
ARM_Y = (28, 29)        # 1.40 m .. 1.50 m: the T-pose arm is level with the top of the shoulders

# Columns and depth cells.
CHEST_HALF_X = 3        # 7 wide (35 cm boxy torso)
HIPS_HALF_X = 3
TORSO_Z = (-1, 1)       # 3 deep (15 cm): -0.05 m .. +0.10 m
TORSO_BACK, TORSO_FRONT = TORSO_Z
TORSO_OUTER_Z = (TORSO_BACK - 1, TORSO_FRONT + 1)   # jackets, vests and pouches step out one voxel
NECK_X = (-1, 0)        # half lattice: 2 wide (10 cm), centered below the 3-wide skull
NECK_Z = (-1, 0)        # 2 deep (-0.05..+0.05 m), flush with torso/skull back -> head sits 1 block forward (2-voxel chin)
THIGH_X = (1, 3)        # 3 wide (15 cm): inner face 2.5 cm from the centerline, outer face on the hip side
THIGH_Z = (-1, 1)       # 3 deep, flush with the hips
THIGH_BACK, THIGH_FRONT = THIGH_Z
CALF_X = (1, 2)         # half lattice: 2 wide (10 cm) bare calf, centered below the thigh
TROUSER_CALF_X = (1, 3) # 3 wide (15 cm) trouser or boot calf, flush with the thigh X
CALF_Z = (-1, 0)        # 2 deep: back face flush with the thigh, the knee steps in at the front
CALF_BACK, CALF_FRONT = CALF_Z
CALF_OUTER_Z = (CALF_BACK, CALF_FRONT + 1)          # shin guards and knee pads step out one voxel
FOOT_X = CALF_X         # half lattice: 2 wide shoe below a bare calf
FOOT_Z = (-1, 1)        # flush at the back with the calf, 1 voxel in front of the shin: -0.05 m .. +0.10 m
TOE_Z = (2, 2)          # toe tip on the sole row: +0.10 m .. +0.15 m (in front of the ball joint at +0.093 m)

ARM_UPPER_X = (4, 10)   # 0.175 m .. 0.525 m. Cell 4 is the shoulder cap between the chest side and the joint.
SHOULDER_CAP_X = ARM_UPPER_X[0]   # the cap has the lower arm row only (see `round_shoulder_cap`)
SLEEVE_SHORT_X = (4, 6) # short sleeve: shoulder cap and two voxels of the upper arm
ARM_LOWER_X = (10, 15)  # 0.475 m .. 0.775 m: one voxel into the upper arm (the elbow joint is at 0.512 m)
HAND_X = (16, 18)       # 0.775 m .. 0.925 m: heel, grip channel, fingers (the wrist joint is at 0.759 m)
ARM_Z = (0, 1)          # 2 deep (10 cm): 0.00 m .. 0.10 m, flush with the chest front
HAND_Y = (27, 29)       # the hand is 3 tall: the grip channel is one row below the arm
# A 3 x 3 sleeve (jacket, coverall, pauldron) around the 2 x 2 arm: centered rows 28..30 and half-lattice depth.
SLEEVE_Y = (28, 30)
SLEEVE_Z = (-1, 1)
SLEEVE_LATTICE = {'center_y': True, 'half_z': True}

# Head: a 3 x 5 x 4 skin skull (15 x 25 x 20 cm) on the exact 5 cm lattice (jaw at 1.55 m, 1 block above shoulders).
HEAD_Y_OFFSET = 0.0
HEAD_LATTICE_ORIGIN = (0.0, HEAD_Y_OFFSET, SPINE_Z)
HEAD_HALF_X = 1
HEAD_Z = (-1, 2)        # 4 deep front-to-back (-0.05 .. +0.15 m): 2 cheek columns ahead of ear, 1 behind
HEAD_FACE_Z = 2         # face plane; the nose, a beard and glasses step out to z = 3
HEAD_SHELL = 2          # |x| of the side shell and |z| of the rear nape (-2) one voxel outside the skull
HEAD_FRONT_SHELL = HEAD_FACE_Z + 1   # z = 3, one voxel in front of the face plane (fringes, peaks, brims, visor)
HEAD_EAR_Z = 0          # ears sit on z = 0, aligned with neck front and leaving two cheek columns (z = 1..2) ahead
HEAD_JAW_Y = 31         # 1.55 m .. 1.60 m: chin / jaw row (overhangs the neck front by 2 voxels / 10 cm)
HEAD_MOUTH_Y = 32       # 1.60 m .. 1.65 m: mouth. The head joint is at 1.65 m.
HEAD_NOSE_Y = 33        # 1.65 m .. 1.70 m: nose, cheek blush, ear lobe
HEAD_EYE_Y = 34         # 1.70 m .. 1.75 m: eyes, upper ear
HEAD_BROW_Y = 35        # 1.75 m .. 1.80 m: forehead. Sideburns, heavy brows and headbands are on this row.
HEAD_BAND_Y = HEAD_BROW_Y
HEAD_TOP_Y = HEAD_BROW_Y   # top row of the skull
CROWN_Y = HEAD_TOP_Y + 1   # 1.80 m: first row above the skull (hair cap, hat band)

# Half-voxel headwear lattice (`HAT_VOX = 0.025 m`, `center_x=center_y=center_z=False`):
# Cell c spans [c * HAT_VOX, (c + 1) * HAT_VOX] in model/sculpt space; Z=0 is z=0.0 m (spine center is at +0.025 m).
HAT_ORIGIN = (0.0, 0.0, 0.0)
HAT_SKULL_X = (-3, 2)      # -0.075..+0.075 m (15 cm skin skull)
HAT_SHELL_X = (-4, 3)      # -0.100..+0.100 m (20 cm snug headwear wall — 2.5 cm thin shell!)
HAT_BRIM_X = (-5, 4)       # -0.125..+0.125 m (25 cm wide brim / ear clearance)
HAT_SKULL_Z = (-2, 5)      # -0.050..+0.150 m (20 cm skull depth; face plane at z = +0.150 m)
HAT_SHELL_Z = (-3, 6)      # -0.075..+0.175 m (25 cm snug shell; clears nose/visor at z = 6)
HAT_VISOR_Z = 7            # +0.175..+0.200 m (outer face +0.204 m with PAD_HEADWEAR, clears proud nose/brows)
HAT_JAW_Y = 62             # 1.550 m
HAT_MOUTH_Y = 64           # 1.600 m
HAT_NOSE_Y = 66            # 1.650 m
HAT_EYE_Y = 68             # 1.700 m
HAT_BROW_Y = 70            # 1.750..1.800 m (forehead rows 70..71)
HAT_CROWN_Y = 72           # 1.800 m (first row above the skull)

LEG_BONES = ('thigh_l', 'calf_l', 'foot_l', 'ball_l')
FOOT_BONES = ('foot_l', 'ball_l')
TOE_BONE = 'ball_l'
LEG_INNER_X = 0.5 * CHAR_VOX   # inner face of the thigh: the build morphs keep it 2.5 cm off the centerline

# Layer pads (metres). Two layers are never in the same plane.
PAD_JOINT = 0.001       # thigh over calf and forearm over upper arm at their one-voxel overlap
PAD_GARMENT = 0.002
PAD_GARMENT_OUTER = 0.004
PAD_BELT = 0.005        # belt gear on the pelvis, outside the shirt box
PAD_SHOE = PAD_GARMENT  # the shoe is proud of the calf when the ankle turns
PAD_HAIR = 0.002
PAD_HEADWEAR = 0.004
PAD_BACK = 0.006        # back packs and their straps lie outside PAD_GARMENT_OUTER shells

# Default proportions of the voxel humans. `contracts/catalog.ts` reads the same file.
DEFAULT_PROPORTIONS = dict(vk.PROPORTION_CONTRACT['humanoid']['defaults'])

# Design position of the limb pivots on the lattice (None = no constraint on that axis).
# `load_pose` compares them with the rig at the default proportions.
ARM_BONES = ('upperarm_l', 'lowerarm_l', 'hand_l')
ARM_AXIS_Y = ARM_Y[1] * CHAR_VOX            # 1.45 m: the bone axis is between the two arm rows
ARM_AXIS_Z = SPINE_Z + 0.5 * CHAR_VOX       # 0.05 m: the bone axis is between the two arm depth cells
SCULPT_JOINTS = {
    'thigh_l': (2 * CHAR_VOX, (THIGH_Y[1] + 1) * CHAR_VOX, None),
    'calf_l': (2 * CHAR_VOX, THIGH_Y[0] * CHAR_VOX, None),
    'upperarm_l': ((ARM_UPPER_X[0] + 0.5) * CHAR_VOX, ARM_AXIS_Y, ARM_AXIS_Z),
    'lowerarm_l': ((ARM_LOWER_X[0] + 0.5) * CHAR_VOX, ARM_AXIS_Y, ARM_AXIS_Z),
    'hand_l': ((HAND_X[0] - 0.5) * CHAR_VOX, ARM_AXIS_Y, ARM_AXIS_Z),
    'neck_01': (0.0, (COLLAR_Y + 1) * CHAR_VOX, None),
    'Head': (0.0, HEAD_NOSE_Y * CHAR_VOX, SPINE_Z),
}
SCULPT_JOINT_TOLERANCE = 0.02

# Skin tone steps. One step is 0.125 of shade. The shader turns the dark steps rosy (see polyMaterial.ts).
SKIN = vox('skin')
SKIN_LIGHT = vox('skin', 0.125)                 # forehead and nose highlight
SKIN_WARM = vox('skin', -0.125)                 # ears, jaw, temples, neck
SKIN_BLUSH = vox('skin', -0.25)                 # cheek blush
SKIN_CORAL = vox('skin', -0.375)                # deep blush on the cheekbone
SKIN_LIP = vox('skin', -0.5, mottle=False)      # lips: a skin tone, never a saturated red
SKIN_SOCKET = vox('skin', -0.75, mottle=False)  # soft brown eye socket


# --------------------------------------------------------------------------
# Sculpt pose and segment helpers
# --------------------------------------------------------------------------

POSE = None   # vk.SculptPose of the UAL1 rig. `load_pose` sets it before a builder makes a mesh.


def load_pose(rig, meta_dir):
    """Read the sculpt pose (`<meta>/humanoid-pose.json`) and check that the rig pivots are on the lattice."""
    global POSE
    path = Path(meta_dir) / 'humanoid-pose.json'
    if not path.exists():
        raise FileNotFoundError(f'{path} is missing. `npm run build` writes it before it starts Blender.')
    pose = vk.SculptPose(rig, path)
    if abs(pose.voxel_size - CHAR_VOX) > 1e-9:
        raise ValueError(f'{path}: voxel size {pose.voxel_size} is not the contract value {CHAR_VOX}.')
    if pose.proportions != {**pose.proportions, **DEFAULT_PROPORTIONS}:
        raise ValueError(f'{path}: its proportions are not the humanoid defaults of proportions.json.')
    for bone, design in SCULPT_JOINTS.items():
        joint = pose.joint(bone)
        for axis, target in enumerate(design):
            if target is not None and abs(joint[axis] - target) > SCULPT_JOINT_TOLERANCE:
                raise ValueError(
                    f'{bone}: joint axis {axis} is at {joint[axis]:.4f} m in the sculpt pose. The lattice has it at '
                    f'{target:.4f} m. Change humanoid.defaults in proportions.json or the lattice rows.')
    POSE = pose
    return pose


def _morph_anchor(bone):
    """Center and scale of the body_slim / body_heavy morph of one segment."""
    if bone in FOOT_BONES:
        return (LEG_INNER_X, 0.0, SPINE_Z), (0.0, 0.0)
    scale = vk.DEFAULT_MORPH_SCALES[bone]
    if bone in LEG_BONES:
        return (LEG_INNER_X, 0.0, SPINE_Z), scale
    if bone in ARM_BONES:
        return SCULPT_JOINTS[bone], scale
    return LATTICE_ORIGIN, scale


def round_shoulder_cap(grid, *, columns=1):
    """Remove the top row of the shoulder cap of an upper arm or a sleeve.

    The cap column is on the body side of the shoulder joint. When the arm hangs, its top row turns up and
    out and makes a square shoulder pad above the collarbone. Without that row the shoulder steps down
    one voxel from the yoke to the arm. Call it on the body arm and on each sleeve, thus no skin shows.
    """
    grid.clear(SHOULDER_CAP_X, ARM_Y[1], ARM_Z[0], SHOULDER_CAP_X + columns - 1, ARM_Y[1], ARM_Z[1])


def seg(part, bone, x, y, z, *, tag=None, pad=0.0, half_x=False, half_z=False, center_y=False):
    """Add one rigid segment on the sculpt lattice. `x`, `y` and `z` are inclusive cell ranges.

    Author the left side or the centerline. `add_twin`, `to_right` and `paired` make the right side.
    """
    origin = HEAD_LATTICE_ORIGIN if bone == 'Head' else LATTICE_ORIGIN
    grid = part.custom_segment(
        bone, origin, x[0], x[1], y[0], y[1], z[0], z[1],
        voxel_size=CHAR_VOX, tag=tag, layer_pad=pad,
        center_x=not half_x, center_y=center_y, center_z=not half_z,
    )
    grid.morph_center, grid.morph_scale = _morph_anchor(bone)
    return grid


def hat_seg(part, x, y, z, *, pad=PAD_HEADWEAR, bone='Head', tag=None):
    """Add one half-voxel (`HAT_VOX = 0.025 m`) headwear segment on the sculpt lattice."""
    grid = part.custom_segment(
        bone, HAT_ORIGIN, x[0], x[1], y[0], y[1], z[0], z[1],
        voxel_size=HAT_VOX, tag=tag, layer_pad=pad,
        center_x=False, center_y=False, center_z=False,
    )
    grid.morph_center, grid.morph_scale = _morph_anchor(bone)
    return grid


def hat_fill_sym(grid, x0, x1, y0, y1, z0, z1, code):
    """Fill inclusive half-voxel box `[x0..x1]` and its X-mirror `[-x1-1..-x0-1]`."""
    grid.fill(x0, y0, z0, x1, y1, z1, code)
    grid.fill(-x1 - 1, y0, z0, -x0 - 1, y1, z1, code)


def add_twin(part, grid):
    part.segments.append(grid.clone_mirrored_x(vk.mirror_name(grid.bone)))


def to_right(part, grid):
    if part.segments[-1] is not grid:
        raise ValueError(f'{part.name}: only the last segment can move to the right side.')
    part.segments[-1] = grid.clone_mirrored_x(vk.mirror_name(grid.bone))


def paired(part, bone, x, y, z, paint, paint_right=None, *, tag=None, pad=0.0, **lattice):
    left = seg(part, bone, x, y, z, tag=tag, pad=pad, **lattice)
    paint(left)
    if paint_right is None:
        add_twin(part, left)
        return
    right = seg(part, bone, x, y, z, tag=tag, pad=pad, **lattice)
    paint_right(right)
    to_right(part, right)


def region_ranges(part):
    ranges = {}
    offset = 0
    open_tag = None
    for segment in part.segments:
        count = len(segment.build_geometry()[4])
        if count == 0:
            continue
        tag = segment.tag
        if tag:
            if tag in ranges and open_tag != tag:
                raise ValueError(f'{part.name}: the segments of region "{tag}" are not adjacent.')
            ranges.setdefault(tag, [offset, 0])[1] += count
        open_tag = tag
        offset += count
    return ranges


def sculpt_mesh(part, rig):
    """Bind-pose mesh of a part that is sculpted on the lattice."""
    if POSE is None:
        raise RuntimeError('Call build_core.load_pose(rig, meta_dir) before you make a humanoid mesh.')
    return part.to_mesh(rig, morph=True, pose=POSE)


def torso_anatomy_bone(row):
    """Body segment below one row of a torso garment. The garment is one rigid box on spine_03."""
    if row <= TAIL_Y[1]:
        return 'pelvis'
    if row < CHEST_Y[0]:
        return 'spine_02'
    return 'spine_03'


def collider_probe(part, rig):
    """All voxel-lattice points on the surface of the part, each bound to the bone of its body segment.

    The greedy mesh has very few vertices. The collider fit uses a median and a percentile, thus one
    pocket or pad moved a capsule by 8 cm. The dense lattice gives each surface voxel the same weight.
    """
    positions, joints = [], []
    for segment in part.segments:
        filled = np.pad(segment.data != 0, 1)
        sx, sy, sz = segment.data.shape
        neighbours = sum(
            filled[dx:dx + sx + 1, dy:dy + sy + 1, dz:dz + sz + 1].astype(np.int8)
            for dx, dy, dz in product((0, 1), repeat=3)
        )
        lattice = np.argwhere((neighbours > 0) & (neighbours < 8))
        if not len(lattice):
            continue
        sculpted = (lattice - np.array(segment.pivot_vox)) * segment.voxel_size + np.array(segment.origin_world)
        if segment.collider_bone_for_row is None:
            bones = np.full(len(lattice), segment.bone, dtype=object)
        else:
            rows = segment.min_c[1] + np.maximum(lattice[:, 1] - 1, 0)
            bones = np.array([segment.collider_bone_for_row(int(row)) for row in rows], dtype=object)
        for bone in sorted(set(bones.tolist())):
            mask = bones == bone
            positions.append(POSE.to_bind(bone, sculpted[mask]))
            joints.append(np.full(int(mask.sum()), rig.index[bone], dtype=np.uint8))
    points = np.concatenate(positions).astype(np.float32)
    joint_rows = np.zeros((len(points), 4), dtype=np.uint8)
    joint_rows[:, 0] = np.concatenate(joints)
    weight_rows = np.zeros((len(points), 4), dtype=np.float32)
    weight_rows[:, 0] = 1.0
    empty = np.zeros((0, 2), dtype=np.float32)
    return vk.MeshData(part.name, points, np.zeros_like(points), empty, empty, np.zeros(0, dtype=np.int32), joint_rows, weight_rows)


def measure_colliders(part, rig):
    """Mesh-measured ragdoll capsules in the shape of `ragdollCapsuleSchema` (contracts/ragdoll.ts).

    `vk.measure_ragdoll_colliders` returns a, b and radius. The catalog schema also requires `type: 'capsule'`.
    """
    measured = vk.measure_ragdoll_colliders(collider_probe(part, rig), rig, 'ual1')
    if not measured:
        raise ValueError(f'{part.name}: no ragdoll collider was measured.')
    return {bone: {'type': 'capsule', **capsule} for bone, capsule in measured.items()}


def skinned_mesh(part, rig):
    """Bind-pose mesh of a part with its region ranges and its ragdoll colliders."""
    mesh = sculpt_mesh(part, rig)
    extras = dict(mesh.extras or {})
    regions = region_ranges(part)
    if regions:
        extras['polyRegions'] = regions
    extras['polyRagdollColliders'] = measure_colliders(part, rig)
    # `scripts/validate.ts` skins the mesh in the sculpt pose and checks that each vertex is on this lattice.
    extras['polyLattice'] = {
        'voxelSize': min(segment.voxel_size for segment in part.segments),
        'maxPad': round(max(segment.layer_pad for segment in part.segments), 6),
    }
    mesh.extras = extras
    return mesh


# --------------------------------------------------------------------------
# Shared limbs: C-claw hands and 2-wide shoes
# --------------------------------------------------------------------------

def claw_hands(part, *, palm=SKIN, fingers=None, cuff=None, tag=None, pad=PAD_GARMENT):
    """Chunky C-claw hand: 3 long, 3 tall, 2 deep, and a thumb.

    Side view in the T-pose (x along the arm, y up):   row 29  P P P   back of the hand
                                                       row 28  H . F   heel, grip channel, curled fingers
                                                       row 27  H . F
    The grip channel (x = 17) holds the shaft of a held item: the UAL1 held socket is in its center.
    The palm rows are toward the body when the arm hangs. The thumb is on +Z.
    """
    fingers = fingers if fingers is not None else SKIN_WARM
    x0, x1 = HAND_X
    y0, y1 = HAND_Y
    z0, z1 = ARM_Z
    grid = seg(part, 'hand_l', HAND_X, HAND_Y, (z0, z1 + 1), tag=tag, pad=pad)
    grid.fill(x0, y1, z0, x1, y1, z1, palm)             # Back of the hand
    grid.fill(x0, y0, z0, x0, y1 - 1, z1, palm)         # Heel of the palm
    grid.fill(x1, y0, z0, x1, y1 - 1, z1, fingers)      # Curled fingers
    grid.set(x0, y1 - 1, z1 + 1, fingers)               # Thumb on +Z
    if cuff is not None:
        grid.paint_if_filled(x0, y0, z0, x0, y1, z1, cuff)
    add_twin(part, grid)
    return grid


@dataclass(frozen=True)
class Shoe:
    """Colors of a 2-row shoe: 3 long on both rows (flush at heel, +1 in front of shin) + 1 sole toe tip."""
    upper: int
    sole: int
    toe: int
    heel: int | None = None
    saddle: int | None = None
    stripe: int | None = None
    collar: int | None = None
    tread: int | None = None


SNEAKER = Shoe(
    upper=vox('trim', 0.45),
    sole=vox('leather', -0.55),
    toe=vox('trim', 0.65),
    stripe=vox('detail', 0.05),
    collar=vox('primary', -0.2),
)


def shoes(part, shoe, *, tag=None, pad=PAD_SHOE, wide=False):
    """Add chunky shoes: 2 rows, 3 long flush at the calf back (+1 in front), and a sole toe tip."""
    x_range = TROUSER_CALF_X if wide else FOOT_X
    half_x = not wide
    x0, x1 = x_range
    z0, z1 = FOOT_Z
    upper_row, sole_row = SHOE_Y[1], SHOE_Y[0]
    foot = seg(part, 'foot_l', x_range, SHOE_Y, FOOT_Z, tag=tag, pad=pad, half_x=half_x)
    foot.fill(x0, upper_row, z0, x1, upper_row, z1, shoe.upper)
    foot.fill(x0, sole_row, z0, x1, sole_row, z1, shoe.sole)
    if shoe.heel is not None:
        foot.fill(x0, sole_row, z0, x1, upper_row, z0, shoe.heel)           # Full-height heel column
    if shoe.collar is not None:
        foot.fill(x0, upper_row, z0, x1, upper_row, z0, shoe.collar)       # Heel tab
    if shoe.saddle is not None:
        foot.fill(x0, sole_row, z0 + 1, x1, upper_row, z0 + 1, shoe.saddle)   # Mid-shoe saddle band
    if shoe.stripe is not None:
        foot.fill(x0, sole_row, z0 + 1, x1, sole_row, z0 + 1, shoe.stripe)   # Sole stripe
        foot.fill(x0, sole_row, z1, x1, sole_row, z1, shoe.upper)
    if shoe.tread is not None:
        foot.fill(x0, sole_row, z0 + 1, x1, sole_row, z0 + 1, shoe.tread)    # Work-boot sole tread
    add_twin(part, foot)

    toe = seg(part, TOE_BONE, x_range, (sole_row, sole_row), TOE_Z, tag=tag, pad=pad, half_x=half_x)
    toe.fill(x0, sole_row, TOE_Z[0], x1, sole_row, TOE_Z[1], shoe.toe)
    add_twin(part, toe)


# --------------------------------------------------------------------------
# Bodies (one 5 cm lattice, all 16 ragdoll segments)
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Build:
    label: str
    torso_half: int
    torso_z: tuple[int, int]
    thigh_x: tuple[int, int]
    thigh_z: tuple[int, int]


BUILDS = {
    'body_athletic': Build('Athletic Body', torso_half=CHEST_HALF_X, torso_z=TORSO_Z, thigh_x=THIGH_X, thigh_z=THIGH_Z),
    'body_slim': Build('Slim Body', torso_half=2, torso_z=TORSO_Z, thigh_x=(1, 2), thigh_z=THIGH_Z),
    'body_heavy': Build('Heavy Body', torso_half=CHEST_HALF_X, torso_z=(TORSO_BACK, TORSO_FRONT + 1),
                        thigh_x=THIGH_X, thigh_z=(THIGH_BACK, THIGH_FRONT + 1)),
}


def fill_skull(grid, code):
    """Fill the canonical 3 x 5 x 4 skull: jaw row (31) up to forehead row (35), front-to-back (-1..2)."""
    half = HEAD_HALF_X
    grid.fill(-half, HEAD_JAW_Y, HEAD_Z[0], half, HEAD_TOP_Y, HEAD_Z[1], code)


def build_body(name, build):
    """Base body with all 16 ragdoll groups. A torso part and a legs part always cover its torso and legs."""
    part = vk.VoxelPart(name)
    briefs = vox('secondary', -0.35)
    sock = vox('trim', 0.45)
    half = build.torso_half
    z0, z1 = build.torso_z

    hips = seg(part, 'pelvis', (-half, half), HIPS_Y, (z0, z1), tag=TAG_HIPS)
    hips.fill(-half, HIPS_Y[0], z0, half, HIPS_Y[1], z1, SKIN)
    hips.fill(-half, HIPS_Y[0], z0, half, BELT_Y + 1, z1, briefs)

    seg(part, 'spine_02', (-half, half), WAIST_Y, (z0, z1), tag=TAG_CHEST).fill(
        -half, WAIST_Y[0], z0, half, WAIST_Y[1], z1, SKIN,
    )
    seg(part, 'spine_03', (-half, half), CHEST_Y, (z0, z1), tag=TAG_CHEST).fill(
        -half, CHEST_Y[0], z0, half, CHEST_Y[1], z1, SKIN,
    )

    # 2 x 2 neck (flush with torso/skull back -> 2-voxel chin overhang) and plain 3 x 5 x 4 skull
    seg(part, 'neck_01', NECK_X, NECK_Y, NECK_Z, half_x=True).fill(
        NECK_X[0], NECK_Y[0], NECK_Z[0], NECK_X[1], NECK_Y[1], NECK_Z[1], SKIN_WARM,
    )
    fill_skull(seg(part, 'Head', (-HEAD_HALF_X, HEAD_HALF_X), (HEAD_JAW_Y, HEAD_TOP_Y), HEAD_Z, tag=TAG_HEAD), SKIN)

    upper = seg(part, 'upperarm_l', ARM_UPPER_X, ARM_Y, ARM_Z, tag=TAG_ARMS_UPPER)
    upper.fill(ARM_UPPER_X[0], ARM_Y[0], ARM_Z[0], ARM_UPPER_X[1], ARM_Y[1], ARM_Z[1], SKIN)
    round_shoulder_cap(upper)
    add_twin(part, upper)

    lower = seg(part, 'lowerarm_l', ARM_LOWER_X, ARM_Y, ARM_Z, tag=TAG_ARMS_LOWER, pad=PAD_JOINT)
    lower.fill(ARM_LOWER_X[0], ARM_Y[0], ARM_Z[0], ARM_LOWER_X[1], ARM_Y[1], ARM_Z[1], SKIN)
    add_twin(part, lower)

    claw_hands(part, tag=TAG_HANDS)

    x0, x1 = build.thigh_x
    tz0, tz1 = build.thigh_z
    thigh = seg(part, 'thigh_l', (x0, x1), THIGH_Y, (tz0, tz1), tag=TAG_LEGS_UPPER, pad=PAD_JOINT)
    thigh.fill(x0, THIGH_Y[0], tz0, x1, THIGH_Y[1], tz1, SKIN)
    thigh.fill(x0, THIGH_Y[1] - 1, tz0, x1, THIGH_Y[1], tz1, briefs)
    add_twin(part, thigh)

    cx0, cx1 = CALF_X
    calf = seg(part, 'calf_l', CALF_X, CALF_Y, CALF_Z, tag=TAG_LEGS_LOWER, half_x=True)
    calf.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CALF_Y[1], CALF_FRONT, vox('skin', -0.04))
    calf.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CALF_Y[0] + 2, CALF_FRONT, sock)
    add_twin(part, calf)

    shoes(part, SNEAKER, tag=TAG_FEET)
    return part


# --------------------------------------------------------------------------
# Sculpted heads (3 wide x 5 tall x 4 deep skin skull, ears and hair one voxel out)
#
# Face columns (x = -1 .. +1):  eye | nose | eye              ears at x = +/-2, on z = 0 (2 cheek columns ahead)
#
#   row 35  forehead (sideburns and heavy brows at its sides)
#   row 34  eyes: one voxel each, upper ear
#   row 33  nose (one voxel proud), cheek blush, ear lobe
#   row 32  mouth
#   row 31  chin (lit face front overhanging the neck by 2 voxels / 10 cm)
#
# The skin face is 3 voxels wide and 5 rows tall (H/W = 1.67), and the skull is 4 voxels deep
# front-to-back (-1..2). Hair or a hat adds one voxel on each side and two rows on top.
# --------------------------------------------------------------------------

FACE_ROWS = HEAD_TOP_Y - HEAD_JAW_Y + 1
FACE_COLUMNS = 2 * HEAD_HALF_X + 1

# Relief of one face cell: on the face plane, one voxel out of it, or one voxel into it.
RELIEF_FLUSH, RELIEF_PROUD, RELIEF_RECESSED = '.', '+', '-'
FACE_KEEP = '.'

BROW = vox('hair', -0.25, mottle=False)
NOSE = vox('skin', 0.125, mottle=False)

# Tone letters that all faces share. A head adds its own letters (iris, frame, plate).
FACE_TONES = {
    'L': SKIN_LIGHT,      # highlight
    's': SKIN,            # base skin
    'w': SKIN_WARM,       # warm: temple, jaw sides, ears, neck, bridge of the nose
    'c': SKIN_BLUSH,      # cheek blush
    'C': SKIN_CORAL,      # deep blush on the cheekbone
    'm': SKIN_LIP,        # lip
    'o': SKIN_SOCKET,     # soft brown eye socket
    'n': NOSE,            # nose
    'B': BROW,            # brow
}


def paint_face(grid, tones, relief, legend):
    """Paint the face from two 3 x 5 maps. The rows go from the forehead row (35) down to the jaw row (31).

    `tones` gives the color letter of each cell (`.` keeps the skull color).
    `relief` gives the depth of each cell: `.` flush, `+` one voxel proud, `-` one voxel recessed.
    Column 0 is x = -1, the right side of the character.
    """
    if len(tones) != FACE_ROWS or len(relief) != FACE_ROWS:
        raise ValueError(f'A face map must have {FACE_ROWS} rows.')
    for index, (tone_row, relief_row) in enumerate(zip(tones, relief)):
        if len(tone_row) != FACE_COLUMNS or len(relief_row) != FACE_COLUMNS:
            raise ValueError(f'Face row {index} must have {FACE_COLUMNS} columns.')
        y = HEAD_TOP_Y - index
        for column, (tone, depth) in enumerate(zip(tone_row, relief_row)):
            x = column - HEAD_HALF_X
            if tone == FACE_KEEP:
                if depth != RELIEF_FLUSH:
                    raise ValueError(f'Face cell ({x}, {y}) has relief "{depth}" but no tone.')
                continue
            if tone not in legend:
                raise ValueError(f'Face cell ({x}, {y}) has the unknown tone "{tone}".')
            if depth == RELIEF_PROUD:
                grid.set(x, y, HEAD_FACE_Z + 1, legend[tone])
            elif depth == RELIEF_RECESSED:
                grid.clear(x, y, HEAD_FACE_Z, x, y, HEAD_FACE_Z)
                grid.set(x, y, HEAD_FACE_Z - 1, legend[tone])
            elif depth == RELIEF_FLUSH:
                if not grid.get(x, y, HEAD_FACE_Z):
                    raise ValueError(f'Face cell ({x}, {y}) is not on the skull.')
                grid.set(x, y, HEAD_FACE_Z, legend[tone])
            else:
                raise ValueError(f'Face cell ({x}, {y}) has the unknown relief "{depth}".')


NOSE_RELIEF = ('...', '...', '.+.', '...', '...')   # the nose is one voxel proud on the nose row


def head_base(part, *, ears=True):
    """Canonical head: 3 x 5 x 4 skull, warm rear jaw above neck, lit forward chin, and 1 x 2 ears at z = 0."""
    grid = seg(part, 'Head', (-HEAD_SHELL, HEAD_SHELL), (HEAD_JAW_Y - 1, HEAD_TOP_Y), (-HEAD_SHELL, HEAD_FRONT_SHELL))
    fill_skull(grid, SKIN)
    # Warm shade on the rear jaw above the neck so the 2-voxel forward chin stays clean and lit.
    grid.paint_if_filled(-HEAD_HALF_X, HEAD_JAW_Y, HEAD_Z[0], HEAD_HALF_X, HEAD_JAW_Y, HEAD_EAR_Z, SKIN_WARM)
    if ears:
        for side in (-HEAD_SHELL, HEAD_SHELL):
            grid.set(side, HEAD_EYE_Y, HEAD_EAR_Z, SKIN_WARM)                      # Upper ear
            grid.set(side, HEAD_NOSE_Y, HEAD_EAR_Z, SKIN_BLUSH)                    # Ear lobe
    return grid


def head_rugged_hero():
    """Open, friendly face: lit brow, one-voxel eyes, proud nose, freckled cheeks, level mouth, soft stubble jaw."""
    part = vk.VoxelPart('head_rugged_hero', covers=(TAG_HEAD,))
    grid = head_base(part)
    paint_face(grid, (
        'sLs',
        'EsE',
        'wnc',
        'smw',
        'wLw',
    ), NOSE_RELIEF, {**FACE_TONES, 'E': vox('visor', 0.0, mottle=False)})
    for side in (-HEAD_SHELL + 1, HEAD_SHELL - 1):
        grid.paint_if_filled(side, HEAD_JAW_Y, HEAD_EAR_Z + 1, side, HEAD_JAW_Y, HEAD_EAR_Z + 1, SKIN_BLUSH)   # Stubble shade on the jaw sides
    return part


def head_bearded_craftsman():
    """Bearded craftsman: heavy proud brows, flush eyes below the brows, proud nose, 5-wide beard."""
    part = vk.VoxelPart('head_bearded_craftsman', covers=(TAG_HEAD,))
    grid = head_base(part)
    beard = vox('hair', 0.0)
    beard_dark = vox('hair', -0.25)
    front = HEAD_FACE_Z + 1
    paint_face(grid, (
        'BsB',
        'EsE',
        'CnC',
        'hmh',
        'HHH',
    ), (
        '+.+',
        '...',
        '.+.',
        '+.+',
        '+++',
    ), {
        **FACE_TONES, 'h': beard, 'H': beard_dark,
        'E': vox('visor', 0.0, mottle=False),
        'm': vox('skin', -0.125, mottle=False),                                   # Peach mouth in the beard
    })
    for side in (-HEAD_SHELL, HEAD_SHELL):
        grid.fill(side, HEAD_JAW_Y, HEAD_EAR_Z, side, HEAD_MOUTH_Y, HEAD_FACE_Z, beard)   # Beard on the jaw sides: 5 wide
    grid.fill(-HEAD_HALF_X, HEAD_JAW_Y - 1, HEAD_FACE_Z, HEAD_HALF_X, HEAD_JAW_Y - 1, front, beard_dark)   # Stepped lower beard
    return part


def head_cyber_visor():
    """Steel plate on the right third of the face, a dark visor bar across the eye row, one glowing optic.

    The plate is one full column and the visor bar is one full row, thus the two edges are straight.
    The left side of the face stays human.
    """
    part = vk.VoxelPart('head_cyber_visor', covers=(TAG_HEAD,))
    grid = head_base(part)
    plate = vox('metal', -0.125)
    dark_plate = vox('metal', -0.5)
    paint_face(grid, (
        'Pss',
        'GDT',
        'Pnc',
        'Pmw',
        'Dss',
    ), (
        '+..',
        '...',
        '.+.',
        '...',
        '...',
    ), {
        **FACE_TONES, 'P': plate, 'D': dark_plate, 'G': vox('accent', emissive=True),
        'T': vox('hair', 0.25, mottle=False),
    })
    side = -HEAD_SHELL
    grid.fill(side, HEAD_NOSE_Y, HEAD_EAR_Z, side, HEAD_EYE_Y, HEAD_EAR_Z + 1, vox('metal', 0.0))   # Temple pod
    return part


def head_cool_shades():
    """Give the Lookout dark sunglasses and a tapered chin."""
    part = vk.VoxelPart('head_cool_shades', covers=(TAG_HEAD,))
    grid = head_base(part)
    paint_face(grid, (
        'wLw',
        'VwV',
        'cnc',
        'wmw',
        'wsw',
    ), NOSE_RELIEF, {**FACE_TONES, 'V': vox('visor', 0.0, mottle=False)})
    for side in (-1, 1):
        grid.clear(side, HEAD_JAW_Y, HEAD_FACE_Z, side, HEAD_JAW_Y, HEAD_FACE_Z)
    return part


def head_scarred_veteran():
    """Veteran: flush slate eyes, a pale scar through the left column, proud nose, lit chin."""
    part = vk.VoxelPart('head_scarred_veteran', covers=(TAG_HEAD,))
    grid = head_base(part)
    paint_face(grid, (
        'wsX',
        'EwE',
        'cnX',
        'cmw',
        'sLs',
    ), NOSE_RELIEF, {
        **FACE_TONES, 'X': vox('skin', 0.25, mottle=False),                       # Pale scar
        'E': vox('visor', -0.125, mottle=False),
    })
    return part


def head_keen_scout():
    """Scout: flush warm-brown eyes, rosy cheeks, proud nose, warm mouth, lit chin."""
    part = vk.VoxelPart('head_keen_scout', covers=(TAG_HEAD,))
    grid = head_base(part)
    paint_face(grid, (
        'wLw',
        'OwO',
        'CnC',
        'wmw',
        'wsw',
    ), NOSE_RELIEF, {**FACE_TONES, 'O': vox('leather', -0.125, mottle=False)})
    return part


def head_core_runner():
    """Give the Runner a tapered chin and a shallow nose."""
    part = vk.VoxelPart('head_core_runner', covers=(TAG_HEAD,))
    grid = head_base(part)
    paint_face(grid, ('wLw', 'EwE', 'CnC', 'wmw', 'sLs'), ('...',) * FACE_ROWS, {
        **FACE_TONES, 'E': vox('leather', -0.35, mottle=False),
    })
    for side in (-1, 1):
        grid.clear(side, HEAD_JAW_Y, HEAD_FACE_Z, side, HEAD_JAW_Y, HEAD_FACE_Z)
    return part


HEADS = (
    ('Rugged Hero Head', head_rugged_hero),
    ('Bearded Craftsman Head', head_bearded_craftsman),
    ('Cyber Visor Head', head_cyber_visor),
    ('Cool Shades Head', head_cool_shades),
    ('Scarred Veteran Head', head_scarred_veteran),
    ('Keen Scout Head', head_keen_scout),
    ('Runner Head', head_core_runner),
)


# --------------------------------------------------------------------------
# Hair: a 5-wide cap on rows 36..37 above the 5-tall skull, side / nape / fringe panels one voxel out of
# the skull. The ears are on rows 33..34 of the side shell (z = 0). A side panel on row 35 keeps them in view.
# --------------------------------------------------------------------------

TOP = HEAD_TOP_Y              # forehead row: sideburns and temple panels are on it
CROWN = CROWN_Y               # first hair row above the skull
SIDE = HEAD_SHELL             # |x| of the side panels
NAPE = -HEAD_SHELL            # z of the nape panel
FRINGE = HEAD_FRONT_SHELL     # z of the fringe panel (one voxel in front of face plane z = 2)
HALF = HEAD_HALF_X
BACK, FRONT = HEAD_Z          # (-1, 2)


def hair_part(name, *, back=NAPE):
    part = vk.VoxelPart(name, covers=(TAG_HAIR,))
    grid = seg(part, 'Head', (-SIDE, SIDE), (HEAD_JAW_Y, CROWN + 2), (back, FRINGE), pad=PAD_HAIR)
    return part, grid


def hair_short_quiff():
    """Short crop with a raised front quiff: a 5-wide cap, a centered 3-wide top row, a 2-row lift at the hairline."""
    part, grid = hair_part('hair_short_quiff')
    h0, h_hi, h_lo = vox('hair', 0.0), vox('hair', 0.25), vox('hair', -0.25)
    grid.fill(-SIDE, CROWN, NAPE, SIDE, CROWN, FRONT, h0)          # 5-wide cap, flush with the face plane
    grid.fill(-HALF, CROWN + 1, BACK, HALF, CROWN + 1, FRONT, h_hi)   # Centered top row
    grid.fill(-HALF, CROWN + 1, FRINGE, HALF, CROWN + 1, FRINGE, h_hi)   # Quiff: one voxel in front of the hairline
    grid.fill(-HALF, CROWN + 2, FRONT, HALF, CROWN + 2, FRINGE, h0)   # Quiff lift
    grid.fill(-HALF, HEAD_EYE_Y, NAPE, HALF, TOP, NAPE, h_lo)      # Short back
    for side in (-SIDE, SIDE):
        grid.fill(side, TOP, NAPE, side, TOP, HEAD_EAR_Z, h_lo)    # Short temples above the ears
    return part


def hair_wavy_blonde():
    """Tousled waves: lumpy 3-row crown, a fringe that overhangs one brow, ear-length sides."""
    part, grid = hair_part('hair_wavy_blonde')
    h0, h_hi, h_lo = vox('hair', 0.0), vox('hair', 0.25), vox('hair', -0.25)
    grid.fill(-SIDE, CROWN, NAPE, SIDE, CROWN, FRONT, h0)
    grid.fill(-SIDE, CROWN, FRINGE, 0, CROWN, FRINGE, h0)          # Fringe overhang on the right half
    grid.fill(-SIDE, CROWN + 1, NAPE, SIDE, CROWN + 1, FRONT, h_hi)
    grid.fill(-SIDE, CROWN + 2, BACK, -HALF, CROWN + 2, FRONT, h0)    # Tousled lumps
    grid.fill(HALF, CROWN + 2, NAPE, SIDE, CROWN + 2, 1, h0)
    grid.fill(-SIDE, TOP, FRINGE, -HALF, TOP, FRINGE, h_hi)        # Fringe lock over the right brow
    grid.fill(-HALF, HEAD_MOUTH_Y, NAPE, HALF, TOP, NAPE, h_lo)    # Layered nape
    for side in (-SIDE, SIDE):
        grid.fill(side, HEAD_EYE_Y, NAPE, side, TOP, FRONT, h0)    # Ear-length sides
    return part


def hair_cropped_fade():
    """Chunky high-and-tight taper fade."""
    part, grid = hair_part('hair_cropped_fade')
    h0, h_hi, h_fade = vox('hair', 0.0), vox('hair', 0.125), vox('hair', 0.25)
    grid.fill(-SIDE, CROWN, NAPE, SIDE, CROWN, FRONT, h0)
    grid.fill(-HALF, CROWN + 1, BACK, HALF, CROWN + 1, FRONT, h_hi)   # High top
    grid.fill(-HALF, HEAD_EYE_Y, NAPE, HALF, TOP, NAPE, h_fade)    # Faded nape
    for side in (-SIDE, SIDE):
        grid.fill(side, TOP, NAPE, side, TOP, HEAD_EAR_Z + 1, h_fade)   # Faded temple band
    return part


def hair_bob_cut():
    """Chunky chin-length parted bob. The sides and the nape wrap the head and hide the ears."""
    part, grid = hair_part('hair_bob_cut')
    h0, h_hi, h_lo = vox('hair', 0.0), vox('hair', 0.125), vox('hair', -0.125)
    grid.fill(-SIDE, CROWN, NAPE, SIDE, CROWN, FRONT, h0)
    grid.fill(-SIDE, CROWN + 1, NAPE, HALF, CROWN + 1, FRONT, h_hi)   # Parted top row
    grid.fill(-HALF, HEAD_MOUTH_Y, NAPE, HALF, TOP, NAPE, h_lo)
    for side in (-SIDE, SIDE):
        grid.fill(side, HEAD_MOUTH_Y, NAPE, side, TOP, FRONT, h0)
    grid.clear(SIDE, HEAD_MOUTH_Y, FRONT - 1, SIDE, HEAD_NOSE_Y, FRONT)
    grid.set(-SIDE, HEAD_JAW_Y, HEAD_EAR_Z, h_lo)
    grid.fill(-SIDE, CROWN, FRINGE, 0, CROWN, FRINGE, h_hi)        # Parted side of the fringe
    return part


def hair_buzz_crew():
    """Close crew cut with a short crown and faded temples."""
    part, grid = hair_part('hair_buzz_crew')
    h_top, h_fade = vox('hair', 0.0), vox('hair', 0.25)
    grid.fill(-SIDE, CROWN, NAPE, SIDE, CROWN, FRONT, h_top)
    grid.fill(-HALF, CROWN + 1, BACK, HALF, CROWN + 1, 1, h_fade)
    for side in (-SIDE, SIDE):
        grid.clear(side, CROWN, FRONT, side, CROWN, FRONT)         # Rounded front corners
        grid.fill(side, TOP, NAPE, side, TOP, HEAD_EAR_Z + 1, h_fade)   # Temple fade band
    grid.fill(-HALF, TOP, NAPE, HALF, TOP, NAPE, h_fade)
    return part


def hair_slick_back():
    """Swept-back hair: a flat cap that goes back over the nape, dark temples above the ears."""
    part, grid = hair_part('hair_slick_back', back=NAPE - 1)
    h0, h_hi, h_lo = vox('hair', 0.0), vox('hair', 0.25), vox('hair', -0.25)
    grid.fill(-SIDE, CROWN, NAPE, SIDE, CROWN, FRONT, h0)          # Cap, from the hairline to the nape
    grid.fill(-HALF, CROWN, 1, HALF, CROWN, FRONT, h_hi)           # Swept front highlight
    grid.fill(-HALF, CROWN, NAPE - 1, HALF, CROWN + 1, NAPE - 1, h0)   # Volume at the back of the crown
    grid.fill(-HALF, CROWN + 1, NAPE, HALF, CROWN + 1, 0, h0)
    grid.fill(-HALF, HEAD_NOSE_Y, NAPE, HALF, TOP, NAPE, h_lo)
    for side in (-SIDE, SIDE):
        grid.fill(side, TOP, NAPE, side, TOP, HEAD_EAR_Z + 1, h_lo)   # Temples above the ears
    return part


def hat_slab(grid, y, code, *, reach=HEAD_SHELL, z_back=None, z_front=HEAD_FACE_Z):
    """One hat row around or above the skull: a band, a cuff or a brim."""
    grid.fill(-reach, y, -reach if z_back is None else z_back, reach, y, z_front, code)


HAIR = (
    ('Short Quiff', hair_short_quiff),
    ('Wavy Blonde', hair_wavy_blonde),
    ('Cropped Fade', hair_cropped_fade),
    ('Bob Cut', hair_bob_cut),
    ('Buzz Crew', hair_buzz_crew),
    ('Slick Back', hair_slick_back),
)


# --------------------------------------------------------------------------
# Starter outfit & shared garment builders
# --------------------------------------------------------------------------

class TorsoBox:
    """The trunk and the yoke of a torso garment. Paint them as one box with lattice rows."""

    def __init__(self, trunk, yoke):
        self.trunk = trunk
        self.yoke = yoke

    def fill(self, *box):
        self.trunk.fill(*box)
        self.yoke.fill(*box)

    def clear(self, *box):
        self.trunk.clear(*box)
        self.yoke.clear(*box)

    def set(self, x, y, z, code):
        self.trunk.set(x, y, z, code)
        self.yoke.set(x, y, z, code)

    def set_sym(self, x, y, z, code):
        self.set(x, y, z, code)
        self.set(-x, y, z, code)


def shirt_torso(part, shirt, *, hem=None, y=TORSO_Y, grid_y=None, z=TORSO_OUTER_Z, open_neck=True):
    """The torso of a garment: a 7-wide, 3-deep box from the belt row up to the shoulders, in two rigid pieces.

    The canonical voxel torso is one flat box. The UAL1 spine turns at the waist and at the chest, thus:
      - the trunk (rows 20..27) is on spine_02. It is one box with no seam on the shirt front. It hangs
        over the trouser hips and turns on them at the belt.
      - the yoke (rows 28..29) is on spine_03 with the arms, the neck and the collar. Its seam is 2 cm
        above the chest joint, thus the two pieces stay together when the chest turns.
    `open_neck` carves a 1-block front neckline pocket in row 29 so the neck drops into the shirt.
    `grid_y` and `z` can widen the grids for an outer layer, a skirt, a pouch or an antenna.
    The ragdoll colliders fit the trunk rows to the pelvis, the waist and the chest of the body.
    """
    grid_y = grid_y or y
    trunk = seg(part, 'spine_02', (-CHEST_HALF_X, CHEST_HALF_X), (grid_y[0], TRUNK_Y[1]), z, pad=PAD_GARMENT_OUTER)
    trunk.collider_bone_for_row = torso_anatomy_bone
    yoke = seg(part, 'spine_03', (-CHEST_HALF_X, CHEST_HALF_X), (YOKE_Y[0], grid_y[1]), z, pad=PAD_GARMENT_OUTER)
    torso = TorsoBox(trunk, yoke)
    torso.fill(-CHEST_HALF_X, y[0], TORSO_BACK, CHEST_HALF_X, y[1], TORSO_FRONT, shirt)
    if hem is not None:
        torso.fill(-CHEST_HALF_X, y[0], TORSO_BACK, CHEST_HALF_X, y[0], TORSO_FRONT, hem)
    if open_neck:
        torso.clear(-1, SHOULDER_Y, TORSO_FRONT, 1, SHOULDER_Y, TORSO_FRONT)
    return torso


def low_collar(part, code, *, turtleneck=False, back=True):
    """1-block-tall collar on row 30 (1.50..1.55 m) framing the neck base above the shoulders."""
    if turtleneck:
        x0, x1 = NECK_X[0] - 1, NECK_X[1] + 1
        z0 = NECK_Z[0] - 1
        ring = seg(part, 'spine_03', (x0, x1), (COLLAR_Y, COLLAR_Y), (z0, TORSO_FRONT),
                   pad=0.0, half_x=True)
        ring.fill(x0, COLLAR_Y, z0, x1, COLLAR_Y, TORSO_FRONT, code)
        ring.clear(NECK_X[0], COLLAR_Y, NECK_Z[0], NECK_X[1], COLLAR_Y, NECK_Z[1])
        return ring

    z0 = NECK_Z[0] - 1
    ring = seg(part, 'spine_03', (-2, 2), (COLLAR_Y, COLLAR_Y), (z0, NECK_Z[1]), pad=PAD_GARMENT_OUTER)
    if back:
        ring.fill(-2, COLLAR_Y, z0, 2, COLLAR_Y, z0, code)
    for x in (-2, 2):
        ring.fill(x, COLLAR_Y, NECK_Z[0], x, COLLAR_Y, NECK_Z[1], code)
    return ring


def paint_short_sleeve(grid, shirt, cuff, *, cap_columns=1):
    """Paint one short sleeve flush on the 2 x 2 upper arm with a cuff on the last voxel column."""
    x0, x1 = SLEEVE_SHORT_X
    grid.fill(x0, ARM_Y[0], ARM_Z[0], x1, ARM_Y[1], ARM_Z[1], shirt)
    grid.fill(x1, ARM_Y[0], ARM_Z[0], x1, ARM_Y[1], ARM_Z[1], cuff)
    round_shoulder_cap(grid, columns=cap_columns)


def harness_straps(part, code, columns, y0, *, z=TORSO_FRONT + 1, pad=PAD_BACK):
    """Front straps of a back pack from row `y0` up to the shoulders, one voxel in front of the torso.

    The rows of the trunk are on spine_02 and the rows of the yoke are on spine_03, the same split as
    `shirt_torso`. Thus a strap stays on the garment when the chest turns.
    """
    x0, x1 = min(columns), max(columns)
    for bone, rows in (('spine_02', (y0, TRUNK_Y[1])), ('spine_03', YOKE_Y)):
        if rows[0] > rows[1]:
            continue
        grid = seg(part, bone, (x0, x1), rows, (z, z), pad=pad)
        for x in columns:
            grid.fill(x, rows[0], z, x, rows[1], z, code)


def short_sleeves(part, shirt, cuff):
    """Add a flush short sleeve over the bare upper arm."""
    sleeve = seg(part, 'upperarm_l', SLEEVE_SHORT_X, ARM_Y, ARM_Z, pad=PAD_GARMENT)
    paint_short_sleeve(sleeve, shirt, cuff)
    add_twin(part, sleeve)
    return sleeve


def shape_chest_front(torso, cloth, seam):
    """Step the fabric forward above the fitted waist."""
    front = TORSO_FRONT + 1
    torso.fill(-2, 26, front, 2, 26, front, cloth)
    torso.fill(-1, 25, front, 1, 25, front, seam)
    for side in (-1, 1):
        x0, x1 = sorted((side, 2 * side))
        torso.fill(x0, 27, front, x1, 27, front, cloth)


def lower_shoulder_line(torso, *, from_column=CHEST_HALF_X):
    """Lower the outer yoke by one row and keep the collar at its original height."""
    z0, z1 = TORSO_OUTER_Z
    torso.clear(-CHEST_HALF_X, SHOULDER_Y, z0, -from_column, SHOULDER_Y, z1)
    torso.clear(from_column, SHOULDER_Y, z0, CHEST_HALF_X, SHOULDER_Y, z1)


def runner_sleeves(part, shirt, cuff):
    sleeve = seg(part, 'upperarm_l', SLEEVE_SHORT_X, ARM_Y, ARM_Z, pad=PAD_GARMENT)
    paint_short_sleeve(sleeve, shirt, cuff, cap_columns=2)
    add_twin(part, sleeve)
    x0, x1 = SLEEVE_SHORT_X[1] + 1, ARM_UPPER_X[1]
    upper = seg(part, 'upperarm_l', (x0, x1), ARM_Y, ARM_Z)
    upper.fill(x0, ARM_Y[0], ARM_Z[0], x1, ARM_Y[1], ARM_Z[1], SKIN)
    add_twin(part, upper)


def torso_core_tee(*, fitted=False):
    """Ringer athletic tee: contrast neck band and sleeve cuffs, darker side panels, a flush two-voxel chest mark."""
    covers = (TAG_CHEST, TAG_ARMS_UPPER) if fitted else TORSO_COVERS
    part = vk.VoxelPart('torso_runner_tee' if fitted else 'torso_core_tee', covers=covers)
    shirt = vox('primary', 0.0)
    shade = vox('primary', -0.25)
    ringer = vox('trim', 0.25)
    hem_y = TAIL_Y[1] if fitted else TORSO_Y[0]
    torso = shirt_torso(part, shirt, hem=shade, y=(hem_y, SHOULDER_Y))
    torso.fill(-1, SHOULDER_Y - 1, TORSO_FRONT, 1, SHOULDER_Y - 1, TORSO_FRONT, ringer)   # Neck band below the neckline
    for side in (-CHEST_HALF_X, CHEST_HALF_X):
        torso.fill(side, hem_y + 1, TORSO_BACK + 1, side, TRUNK_Y[1], TORSO_FRONT - 1, shade)   # Side panel
    if fitted:
        for side in (-CHEST_HALF_X, CHEST_HALF_X):
            torso.clear(side, 22, TORSO_BACK, side, 24, TORSO_FRONT)
        shape_chest_front(torso, shirt, shade)
        band = seg(part, 'pelvis', (-2, 2), (TORSO_Y[0], hem_y - 1), TORSO_Z, pad=PAD_GARMENT_OUTER)
        band.fill(-2, TORSO_Y[0], TORSO_BACK, 2, hem_y - 1, TORSO_FRONT, shade)
        lower_shoulder_line(torso, from_column=2)
        runner_sleeves(part, shirt, ringer)
    else:
        short_sleeves(part, shirt, ringer)
    mark_z = TORSO_FRONT + 1 if fitted else TORSO_FRONT
    torso.fill(1, SHOULDER_Y - 3, mark_z, 2, SHOULDER_Y - 3, mark_z, vox('accent', 0.125, mottle=False))
    return part


def trouser_hips(part, cloth, *, belt=None, buckle=None):
    """Trouser pelvis block: crotch row, belt row, and a dark core that goes three rows up into the shirt.

    The shirt trunk turns on the hips at the belt. When it lifts off the belt, the core is behind the gap.
    """
    hips = seg(part, 'pelvis', (-HIPS_HALF_X, HIPS_HALF_X), HIPS_Y, (TORSO_BACK, TORSO_FRONT + 1), pad=PAD_GARMENT)
    hips.fill(-HIPS_HALF_X, HIPS_Y[0], TORSO_BACK, HIPS_HALF_X, BELT_Y, TORSO_FRONT, cloth)
    hips.fill(-HIPS_HALF_X + 1, BELT_Y + 1, 0, HIPS_HALF_X - 1, HIPS_Y[1], 0, vox('leather', -0.75))
    if belt is not None:
        hips.fill(-HIPS_HALF_X, BELT_Y, TORSO_BACK, HIPS_HALF_X, BELT_Y, TORSO_FRONT, belt)
    if buckle is not None:
        hips.set(0, BELT_Y, TORSO_FRONT, buckle)
    return hips


def bare_knees(part, hem):
    """Continue the bare calf up to the hem. The knee turns with the thigh."""
    rows = (THIGH_Y[0], hem - 1)
    knee = seg(part, 'thigh_l', CALF_X, rows, CALF_Z, half_x=True, pad=PAD_JOINT)
    knee.fill(CALF_X[0], rows[0], CALF_BACK, CALF_X[1], rows[1], CALF_FRONT, SKIN)
    add_twin(part, knee)


def legs_core_shorts():
    """Athletic shorts above the knee: belt, side stripe, hem band, striped crew socks, sneakers."""
    part = vk.VoxelPart('legs_core_shorts', covers=LEGS_COVERS)
    cloth = vox('secondary', 0.0)
    trouser_hips(part, cloth, belt=vox('leather', -0.25), buckle=vox('metal', 0.45, mottle=False))

    tx0, tx1 = THIGH_X
    hem = THIGH_Y[1] - 4                                           # The shorts end above the knee
    thigh = seg(part, 'thigh_l', THIGH_X, THIGH_Y, THIGH_Z, pad=PAD_JOINT)
    thigh.fill(tx0, hem, THIGH_BACK, tx1, THIGH_Y[1], THIGH_FRONT, cloth)
    thigh.fill(tx1, hem + 1, THIGH_BACK + 1, tx1, THIGH_Y[1], THIGH_FRONT - 1, vox('trim', 0.25))   # Side stripe
    thigh.fill(tx0, hem, THIGH_BACK, tx1, hem, THIGH_FRONT, vox('secondary', -0.25))                # Hem band
    add_twin(part, thigh)
    bare_knees(part, hem)

    cx0, cx1 = CALF_X
    sock_y = CALF_Y[0] + 2
    calf = seg(part, 'calf_l', CALF_X, CALF_Y, CALF_Z, half_x=True)
    calf.fill(cx0, CALF_Y[0], CALF_BACK, cx1, CALF_Y[1], CALF_FRONT, vox('skin', -0.04))
    calf.fill(cx0, CALF_Y[0], CALF_BACK, cx1, sock_y, CALF_FRONT, vox('trim', 0.45))
    calf.fill(cx0, sock_y, CALF_BACK, cx1, sock_y, CALF_FRONT, vox('detail', 0.0))                  # Sock stripe
    add_twin(part, calf)
    shoes(part, SNEAKER)
    return part


# --------------------------------------------------------------------------
# Catalog
# --------------------------------------------------------------------------

def preset(preset_id, pack, label, clip, palette, *, body, head, hair, torso, legs,
           headwear=None, back=None, held_right=None, held_left=None, proportions=None):
    return {
        'id': preset_id,
        'pack': pack,
        'label': label,
        'rigId': 'ual1',
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


PRESETS = (
    preset(
        'core_rookie', PACK, 'Core Rookie', 'Idle_Loop',
        {'skin': '#e9ad85', 'hair': '#b98a4a', 'primary': '#cf9130', 'secondary': '#34505c',
         'accent': '#f2ead8', 'metal': '#c9ced6', 'trim': '#efe7d6', 'leather': '#5a3f2c',
         'visor': '#55793f', 'detail': '#2f7f8c'},
        body='body_athletic', head='head_rugged_hero', hair='hair_short_quiff',
        torso='torso_core_tee', legs='legs_core_shorts',
    ),
    preset(
        'core_runner', PACK, 'Core Runner', 'Walk_Loop',
        {'skin': '#d8986b', 'hair': '#382a26', 'primary': '#2d9286', 'secondary': '#3a3f4b',
         'accent': '#ec6a3c', 'metal': '#d8dce2', 'trim': '#e8ecee', 'leather': '#4b3324',
         'visor': '#40c2ea', 'detail': '#e04f36'},
        body='body_slim', head='head_core_runner', hair='hair_bob_cut',
        torso='torso_runner_tee', legs='legs_core_shorts',
        proportions={'shoulderWidth': 1.39, 'waistScale': 0.87, 'limbThickness': 0.95},
    ),
    preset(
        'core_veteran', PACK, 'Core Veteran', 'Walk_Formal_Loop',
        {'skin': '#ab6a43', 'hair': '#9aa0a8', 'primary': '#5d6b3a', 'secondary': '#524432',
         'accent': '#cfa63c', 'metal': '#c2c7cf', 'trim': '#dad2c2', 'leather': '#432d20',
         'visor': '#4a9dbd', 'detail': '#9e3e2d'},
        body='body_heavy', head='head_scarred_veteran', hair='hair_buzz_crew',
        torso='torso_core_tee', legs='legs_core_shorts',
    ),
)


def check_preset_budgets(presets, parts, held=()):
    limit = vk.BUDGETS['mobilePolicy']['maxTrianglesPerComposedAvatar']
    part_by_id = {entry['id']: entry for entry in parts}
    held_by_id = {entry['id']: entry for entry in held}
    for item in presets:
        headwear = part_by_id[item['headwear']] if item['headwear'] else None
        hide_hair = bool(headwear and headwear['rules']['hidesHair'])
        slots = ('body', 'head', 'torso', 'legs', 'headwear', 'back') + (() if hide_hair else ('hair',))
        total = sum(part_by_id[item[slot]]['triangles'] for slot in slots if item[slot])
        total += sum(held_by_id[item[key]]['triangles'] for key in ('heldRight', 'heldLeft') if item[key])
        if total > limit:
            raise ValueError(f'Preset "{item["id"]}": {total} triangles exceed the avatar budget ({limit}).')
        print(f'  preset {item["id"]}: {total} / {limit} triangles')


def write_catalog(meta_dir, catalog):
    path = Path(meta_dir) / f'{catalog["pack"]}.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(catalog, indent=2) + '\n')
    return path


def core_parts():
    for name, build in BUILDS.items():
        yield 'body', build.label, build_body(name, build)
    for label, make in HEADS:
        yield 'head', label, make()
    for label, make in HAIR:
        yield 'hair', label, make()
    yield 'torso', 'Core Tee', torso_core_tee()
    yield 'torso', 'Fitted Runner Tee', torso_core_tee(fitted=True)
    yield 'legs', 'Core Shorts', legs_core_shorts()


def add_staff_idle(builder):
    """Keep the idle motion and hold the right grip upright in front of the hip."""
    clips = builder.doc['animations']
    idle = next(clip for clip in clips if clip['name'] == 'Idle_Loop')
    rotations = {
        'upperarm_r': (-0.084682, -0.639249, 0.509146, 0.570053),
        'lowerarm_r': (0.723696, 0.000977, -0.138419, 0.676094),
        'hand_r': (0.030235, 0.469977, 0.142292, 0.870609),
    }
    samplers = []
    channels = []
    time = builder._accessor(np.array([0], dtype=np.float32), 'SCALAR', bounds=True)
    for channel in idle['channels']:
        target = channel['target']
        sampler = idle['samplers'][channel['sampler']]
        rotation = rotations.get(builder.doc['nodes'][target['node']]['name'])
        if target['path'] == 'rotation' and rotation is not None:
            quat = np.array([rotation], dtype=np.float32)
            quat /= np.linalg.norm(quat)
            output = builder._accessor(quat, 'VEC4')
            sampler = {'input': time, 'output': output, 'interpolation': 'LINEAR'}
        channels.append({'sampler': len(samplers), 'target': target})
        samplers.append(sampler)
    clips.append({'name': 'Staff_Idle_Loop', 'samplers': samplers, 'channels': channels})


def main():
    args = vk.script_args('Build the core voxel character pack.', 'source', 'stage', 'meta')
    rig = vk.RigData(args.source, vk.RIG_CONTRACT['joints'])
    rig.check_contract(check_clips=False)
    load_pose(rig, args.meta)

    builder = vk.GlbBuilder()
    builder.add_rig(rig, with_clips=True)
    for extra in ('ual2-clips.glb', 'kaykit-2h-clips.glb'):
        extra_path = args.source.parent / extra
        if not extra_path.exists():
            raise FileNotFoundError(f'Missing source clips GLB: {extra_path}')
        builder.add_extra_clips(extra_path)
    add_staff_idle(builder)
    builder.check_clips(vk.RIG_CONTRACT)

    entries = []
    for slot, label, part in core_parts():
        mesh = skinned_mesh(part, rig)
        builder.add_mesh(mesh)
        entries.append(vk.part_entry(mesh, PACK, slot, label, RIG_FILE))
        print(f'  {slot:<8} {mesh.name:<26} {mesh.triangles:>5} triangles')

    size = builder.write(vk.leaf_dir(args.stage, PACK, 'characters') / RIG_FILE)
    check_preset_budgets(PRESETS, entries)
    catalog = vk.pack_catalog(
        PACK,
        parts=entries,
        presets=PRESETS,
        clips=[clip['name'] for clip in vk.RIG_CONTRACT['clips']],
        rig_model_path=RIG_FILE,
    )
    path = write_catalog(args.meta, catalog)
    print(f'Wrote {RIG_FILE} ({size} bytes, {len(entries)} parts, {len(builder.doc["animations"])} clips) and {path}.')


if __name__ == '__main__':
    main()
