"""Build run-cubix-creatures: guard hound (23-joint quadruped), scrap spider (28-joint arachnid), demolition bot (UAL1).

Usage (see scripts/build.ts):
  blender --background --factory-startup --python build_creatures.py -- --core <core-rig.glb> --stage <dir> --meta <dir>

Outputs:
  <stage>/run-cubix-creatures/3D/characters/quadruped-rig.glb   rig + 6 clips + body_dire_wolf
  <stage>/run-cubix-creatures/3D/characters/arachnid-rig.glb    rig + 5 clips + body_giant_spider
  <stage>/run-cubix-creatures/3D/characters/scrap-bot.glb       UAL1 rig (no clips) + body_scrap_bot
  <stage>/run-cubix-creatures/3D/creatures/props/*.glb          world props
  <meta>/creatures.json                                           pack catalog
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
from mathutils import Euler  # noqa: E402

import voxchar as vk  # noqa: E402
from build_animals import build_all_animals  # noqa: E402
from build_exotics import build_all_exotics  # noqa: E402
from creature_kit import QuadrupedAudit, Sculpt, lattice_anchor  # noqa: E402
from voxchar import vox  # noqa: E402

PACK = 'creatures'
VOXEL = 0.04  # Creature voxel. It is the same as the character voxel.
PROP_VOXEL = 0.05
JOINT_PAD = 0.002  # Lifts the faces of one segment where two segments share a plane at a joint.
QUADRUPED_CONTRACT = vk.load_json('quadruped-rig.json')
ARACHNID_CONTRACT = vk.load_json('arachnid-rig.json')
# contracts/ragdoll.ts has 16 UAL1 ragdoll bodies. A creature rig has one body for each joint except the root.
UAL1_RAGDOLL_BODIES = 16


# --------------------------------------------------------------------------
# Voxel authoring helpers
# --------------------------------------------------------------------------

_SIDE_TOKENS = (('_fl_', '_fr_'), ('_bl_', '_br_'), ('_l_', '_r_'))


def mirror_creature_bone(name):
    """Name of the joint on the other side. vk.mirror_name knows only the `_l` and `_r` suffixes."""
    for left, right in _SIDE_TOKENS:
        if left in name:
            return name.replace(left, right)
        if right in name:
            return name.replace(right, left)
    if name.endswith('_l'):
        return name[:-2] + '_r'
    if name.endswith('_r'):
        return name[:-2] + '_l'
    raise ValueError(f'Joint "{name}" has no side. It cannot be mirrored.')


def creature_segment(part, rig, bone, sculpt, *, mirror=False, pad=0.0, bake_ao=True, role=None, audit=None):
    """Bind one sculpt, given in world lattice cells, to one joint of a creature rig.

    `audit` is a `QuadrupedAudit`. It records the segment and its `role` for the quadruped checks.
    """
    cell, origin, centred = lattice_anchor(rig.position[bone], VOXEL)
    (x0, x1), (y0, y1), (z0, z1) = sculpt.bounds(cell)
    grid = part.custom_segment(bone, origin, x0, x1, y0, y1, z0, z1, voxel_size=VOXEL, layer_pad=pad,
                               bake_ao=bake_ao, center_x=centred, center_z=False)
    sculpt.write(grid, cell)
    if audit is not None:
        audit.add(bone, sculpt, rig.position[bone], pad=pad, role=role)
    elif role is not None:
        raise ValueError(f'Segment "{bone}" has the role "{role}" but no audit.')
    if mirror:
        part.segments.append(grid.clone_mirrored_x(mirror_creature_bone(bone)))


def ual1_segment(part, bone, sculpt, *, mirror=False, pad=0.0, bake_ao=True):
    """Bind one sculpt, given in the canonical UAL1 segment cells of docs/art-direction.md, to one UAL1 joint."""
    central = abs(vk.UAL1_SEGMENT_ORIGINS[bone][0]) < 1e-6
    (x0, x1), (y0, y1), (z0, z1) = sculpt.bounds()
    grid = part.ual1_segment(bone, x0, x1, y0, y1, z0, z1, layer_pad=pad, bake_ao=bake_ao,
                             center_x=central, center_z=central)
    sculpt.write(grid)
    if mirror:
        part.segments.append(grid.clone_mirrored_x(mirror_creature_bone(bone)))


def box_capsule(points, joint):
    """A capsule along Z that fits in the bounding box of the points, in joint space.

    A creature joint has no bind rotation, so joint space is model space minus the joint position.
    """
    low, high = points.min(axis=0), points.max(axis=0)
    centre, half = (low + high) / 2, (high - low) / 2
    radius = float(min(half[0], half[1]))
    reach = max(0.0, float(half[2]) - radius)
    offset = centre - np.array(joint, dtype=np.float64)
    return {
        'a': [round(float(offset[0]), 5), round(float(offset[1]), 5), round(float(offset[2] - reach), 5)],
        'b': [round(float(offset[0]), 5), round(float(offset[1]), 5), round(float(offset[2] + reach), 5)],
        'radius': round(radius, 5),
    }


def ragdoll_colliders(mesh, rig, rig_id):
    """Mesh-measured capsules for each ragdoll body that contracts/ragdoll.ts defines for the rig.

    vk.measure_ragdoll_colliders gives 16 groups for the quadruped: it has no group for `chest` and `jaw`, and it
    puts each paw in the lower leg. The validator needs one capsule for each joint except the root (22). This
    function measures the bodies that are not in the kit result. It also adds the `type` field that
    ragdollCapsuleSchema in contracts/ragdoll.ts requires and the kit result does not have.
    """
    colliders = vk.measure_ragdoll_colliders(mesh, rig, rig_id)
    if rig_id == 'ual1':
        expected = UAL1_RAGDOLL_BODIES
    else:
        owner = mesh.joints[:, 0]  # Rigid segments: each vertex has weight 1.0 on slot 0.
        for index, name in enumerate(rig.names):
            if name == 'root' or name in colliders:
                continue
            points = mesh.positions[owner == index].astype(np.float64)
            if len(points) < 4:
                raise ValueError(f'{mesh.name}: joint "{name}" has no voxel segment for a ragdoll capsule.')
            colliders[name] = box_capsule(points, rig.position[name])
        expected = len(rig.names) - 1
    if len(colliders) != expected:
        raise ValueError(f'{mesh.name}: {len(colliders)} ragdoll colliders, expected {expected} ({rig_id}).')
    return {name: {'type': 'capsule', **capsule} for name, capsule in colliders.items()}


# --------------------------------------------------------------------------
# Math helpers for procedural glTF clips (same generators as run-poly-packs build_monsters.py)
# --------------------------------------------------------------------------

def euler_quat(rx=0.0, ry=0.0, rz=0.0):
    """Quaternion [x, y, z, w] for glTF from XYZ radians."""
    q = Euler((rx, ry, rz), 'XYZ').to_quaternion()
    return [float(q.x), float(q.y), float(q.z), float(q.w)]


def sample_clip(name, duration, hz, tracks_fn):
    steps = max(2, int(round(duration * hz)))
    times = np.linspace(0.0, duration, steps + 1, dtype=np.float32)
    tracks = {}
    for t in times:
        pose = tracks_fn(float(t / duration), float(t))
        for joint, values in pose.items():
            joint_tracks = tracks.setdefault(joint, {})
            for path, vector in values.items():
                joint_tracks.setdefault(path, []).append(vector)
    return {'name': name, 'times': times, 'tracks': tracks}


def ease(t):
    """Smoothstep of t in 0..1. The speed is zero at each end."""
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def keyed(u, keys):
    """Blend key poses with smoothstep. keys: rows of (u, {channel: value}). A channel that a key leaves out is 0."""
    for (u0, pose0), (u1, pose1) in zip(keys, keys[1:]):
        if u <= u1:
            k = ease((u - u0) / (u1 - u0))
            return {name: pose0.get(name, 0.0) + (pose1.get(name, 0.0) - pose0.get(name, 0.0)) * k
                    for name in {*pose0, *pose1}}
    return dict(keys[-1][1])


def rot(rx=0.0, ry=0.0, rz=0.0):
    return {'rotation': euler_quat(rx, ry, rz)}


# --------------------------------------------------------------------------
# Quadruped: guard hound on the 23-joint rig
# --------------------------------------------------------------------------

def build_guard_hound(rig):
    """Guard hound. Cells are world lattice cells (see lattice_anchor). The left legs are mirrored to the right.

    Palette roles: primary = coat, skin = tan marks and lower legs, secondary = harness, hair = nose, pads and
    mouth, accent = status lamp and eyes, metal = armour plates, collar tag and fangs.
    """
    part = vk.VoxelPart('body_dire_wolf')
    coat, coat_dark, tan = vox('primary'), vox('primary', -0.3), vox('skin')
    harness, black = vox('secondary'), vox('hair', -0.2)
    collar, plate = vox('secondary', -0.25), vox('metal', -0.25)
    bright = vox('metal', 0.5, mottle=False)
    eye = vox('accent', emissive=True, mottle=False)

    audit = QuadrupedAudit(part.name, VOXEL, QUADRUPED_CONTRACT['parents'])

    def seg(bone, sculpt, **options):
        creature_segment(part, rig, bone, sculpt, audit=audit, **options)

    # ---- trunk: rump, tucked loin, ribs with a harness, deep chest with a tan bib ---------------------------------
    seg('pelvis', Sculpt().box((-3, 3), (13, 19), (-12, -3), coat), role='trunk')
    seg('spine_01', Sculpt().box((-2, 2), (14, 18), (-5, 3), coat), role='trunk')
    seg('spine_02', Sculpt()
        .box((-3, 3), (13, 19), (2, 9), coat)
        .paint((-3, 3), (13, 19), (5, 6), harness)
        .box((-2, 2), 20, (3, 8), plate), role='trunk')
    seg('chest', Sculpt()
        .box((-4, 4), (12, 21), (8, 13), coat)
        .paint((-2, 2), (12, 16), 13, tan), role='trunk')

    # ---- neck with a status lamp and a tag --------------------------------------------------------------------
    seg('neck', Sculpt()
        .box((-2, 2), (17, 22), (12, 15), coat)
        .box((-3, 3), (19, 20), (11, 16), collar)
        .paint_both(3, 20, 15, plate)
        .box(0, 18, 16, plate)
        .paint(0, 19, 16, eye))

    # ---- head: skull, upper muzzle, nose, fangs, cyber-eyes below a brow, pointed ears ---------------------------
    seg('head', Sculpt()
        .box((-2, 2), (21, 25), (15, 19), coat)
        .box((-1, 1), 23, (20, 24), coat)
        .box((-1, 1), 22, (20, 24), tan)
        .paint((-1, 1), 23, 24, black)
        .both(1, 21, 24, bright)
        .eyes((1, 2), 24, 19, eye)
        .box((-2, 2), 25, 20, coat_dark)
        .both(2, 26, (15, 16), coat)
        .both(2, 27, 15, coat_dark), pad=JOINT_PAD, role='head')

    # ---- hinged lower snout: chin step, dark mouth floor, lower fangs --------------------------------------------
    seg('jaw', Sculpt()
        .box((-1, 1), (20, 21), (18, 23), tan)
        .cut((-1, 1), 20, 23)
        .paint(0, 21, (20, 23), black)
        .paint_both(1, 21, (22, 23), bright))

    # ---- whip tail ------------------------------------------------------------------------------------------------
    seg('tail_01', Sculpt().box(0, (15, 16), (-16, -11), coat))
    seg('tail_02', Sculpt().box(0, (14, 15), (-18, -15), coat).box(0, (13, 14), (-20, -17), coat), pad=JOINT_PAD)
    seg('tail_03', Sculpt().box(0, (12, 13), (-22, -19), coat).box(0, (11, 12), (-24, -21), tan))

    # ---- legs: armoured shoulder and haunch, tan lower leg, paw with a toe box on a black pad --------------------
    seg('leg_fl_upper', Sculpt().box((3, 4), (7, 13), (6, 8), coat).box(4, (13, 16), (6, 8), coat).box(5, (12, 16), (5, 9), plate),
        mirror=True, pad=JOINT_PAD, role='front_upper')
    seg('leg_fl_lower', Sculpt().box((3, 4), (1, 8), (7, 8), tan), mirror=True, role='front_lower')
    seg('leg_fl_paw', Sculpt().box((3, 4), 0, (7, 10), black).box((3, 4), 1, (9, 10), tan), mirror=True,
        role='front_paw')
    seg('leg_bl_upper', Sculpt()
        .box((3, 4), (11, 17), (-11, -6), coat)
        .box((3, 4), (8, 10), (-12, -9), coat)
        .box(5, (13, 16), (-10, -7), plate), mirror=True, pad=JOINT_PAD, role='back_upper')
    seg('leg_bl_lower', Sculpt().box((3, 4), (1, 9), (-10, -9), tan), mirror=True, role='back_lower')
    seg('leg_bl_paw', Sculpt().box((3, 4), 0, (-10, -7), black).box((3, 4), 1, (-8, -7), tan), mirror=True,
        role='back_paw')

    # The Guard Hound is the reference of the quadruped rules: it must pass each check.
    audit.check()
    return part.to_mesh(rig, morph=False)


def hound_clips():
    p0 = QUADRUPED_CONTRACT['worldPositions']['pelvis']
    tau = math.tau

    def pelvis(rx=0.0, ry=0.0, rz=0.0, y=0.0, z=0.0):
        return {'translation': [p0[0], p0[1] + y, p0[2] + z], 'rotation': euler_quat(rx, ry, rz)}

    def legs(pose, front_l, front_r, hind_l, hind_r):
        """Each leg: (upper, lower, paw) rotation about X. A negative upper angle moves the paw forward."""
        for leg, (upper, lower, paw) in (('fl', front_l), ('fr', front_r), ('bl', hind_l), ('br', hind_r)):
            pose[f'leg_{leg}_upper'] = rot(upper)
            pose[f'leg_{leg}_lower'] = rot(lower)
            pose[f'leg_{leg}_paw'] = rot(paw)
        return pose

    def idle_fn(u, _t):
        s, s2 = math.sin(u * tau), math.sin(u * tau * 2.0)
        pose = {
            'pelvis': pelvis(0.015 * s, 0, 0, y=0.010 * s),
            'spine_02': rot(-0.015 * s),
            'chest': rot(-0.030 * s),
            'neck': rot(-0.10 + 0.04 * s, 0.10 * math.sin(u * tau + 0.6)),
            'head': rot(0.08 - 0.03 * s, 0.14 * math.sin(u * tau + 0.2), 0.05 * s),
            'jaw': rot(0.16 + 0.07 * s2),
            'tail_01': rot(-0.10 + 0.04 * s, 0.20 * s2),
            'tail_02': rot(0.10, 0.26 * math.sin(u * tau * 2.0 - 0.7)),
            'tail_03': rot(0.14, 0.30 * math.sin(u * tau * 2.0 - 1.4)),
        }
        return legs(pose, (0.02 * s, 0, 0), (0.02 * s, 0, 0), (-0.015 * s, 0, 0), (-0.015 * s, 0, 0))

    def walk_fn(u, _t):
        a = u * tau
        pose = {
            'pelvis': pelvis(0.020 * math.sin(2 * a), 0.045 * math.sin(a), 0.025 * math.sin(a),
                             y=0.032 + 0.012 * math.cos(2 * a)),
            'spine_01': rot(-0.012 * math.sin(2 * a), -0.045 * math.sin(a)),
            'spine_02': rot(-0.012 * math.sin(2 * a), -0.035 * math.sin(a)),
            'chest': rot(0.020 * math.sin(2 * a + 0.5), -0.055 * math.sin(a), -0.025 * math.sin(a)),
            'neck': rot(0.10 + 0.05 * math.sin(2 * a), 0.03 * math.sin(a)),
            'head': rot(-0.06 - 0.05 * math.sin(2 * a - 0.4), -0.02 * math.sin(a)),
            'jaw': rot(0.12),
            'tail_01': rot(0.14 + 0.03 * math.cos(2 * a), 0.18 * math.sin(a)),
            'tail_02': rot(0.10, 0.22 * math.sin(a - 0.7)),
            'tail_03': rot(0.08, 0.24 * math.sin(a - 1.4)),
        }
        # Four-beat lateral walk: the paws stay level with the floor in stance and point up in swing.
        front_keys = [
            (0.00, {'up': -0.34, 'lo': 0.02, 'pw': 0.28}),
            (0.32, {'up': 0.00, 'lo': 0.10, 'pw': -0.10}),
            (0.64, {'up': 0.34, 'lo': 0.18, 'pw': -0.52}),
            (0.78, {'up': 0.02, 'lo': 1.24, 'pw': -1.08}),
            (0.88, {'up': -0.28, 'lo': 1.02, 'pw': -0.84}),
            (0.95, {'up': -0.38, 'lo': 0.36, 'pw': -0.10}),
            (1.00, {'up': -0.34, 'lo': 0.02, 'pw': 0.28}),
        ]
        hind_keys = [
            (0.00, {'up': -0.34, 'lo': 0.02, 'pw': 0.26}),
            (0.32, {'up': 0.02, 'lo': 0.08, 'pw': -0.10}),
            (0.64, {'up': 0.34, 'lo': 0.16, 'pw': -0.48}),
            (0.80, {'up': -0.06, 'lo': -0.88, 'pw': 0.30}),
            (0.92, {'up': -0.34, 'lo': -0.32, 'pw': 0.16}),
            (1.00, {'up': -0.34, 'lo': 0.02, 'pw': 0.26}),
        ]
        poses = {}
        for leg, offset in (('bl', 0.0), ('fl', 0.25), ('br', 0.5), ('fr', 0.75)):
            k = keyed(((u % 1.0) + offset) % 1.0, front_keys if leg[0] == 'f' else hind_keys)
            poses[leg] = (k['up'], k['lo'], k['pw'])
        return legs(pose, poses['fl'], poses['fr'], poses['bl'], poses['br'])

    def run_fn(u, _t):
        # Double-suspension rotary gallop:
        # u = 0.00 extended flight (concave spine, front legs reach forward, hind legs trail);
        # u = 0.50 collected C-arch (elbows fold below the chest, hind legs swing forward on the outside).
        body_keys = [
            (0.00, {'py': 0.092, 'pz': 0.025, 'prx': 0.17, 's1': -0.14, 's2': -0.13, 'ch': -0.09, 'nk': 0.40, 'hd': -0.20, 'jaw': 0.34, 't1': 0.36, 't2': 0.18, 't3': 0.10}),
            (0.09, {'py': 0.066, 'pz': 0.020, 'prx': 0.13, 's1': -0.08, 's2': -0.07, 'ch': -0.04, 'nk': 0.28, 'hd': -0.17, 'jaw': 0.30, 't1': 0.44, 't2': 0.22, 't3': 0.12}),
            (0.22, {'py': 0.036, 'pz': 0.005, 'prx': 0.01, 's1': 0.02, 's2': 0.03, 'ch': 0.03, 'nk': 0.12, 'hd': -0.14, 'jaw': 0.24, 't1': 0.50, 't2': 0.24, 't3': 0.12}),
            (0.36, {'py': 0.032, 'pz': -0.010, 'prx': -0.16, 's1': 0.14, 's2': 0.14, 'ch': 0.11, 'nk': -0.12, 'hd': -0.08, 'jaw': 0.24, 't1': 0.42, 't2': 0.15, 't3': 0.02}),
            (0.50, {'py': 0.028, 'pz': -0.025, 'prx': -0.26, 's1': 0.20, 's2': 0.20, 'ch': 0.15, 'nk': -0.24, 'hd': -0.06, 'jaw': 0.28, 't1': 0.28, 't2': 0.05, 't3': -0.10}),
            (0.63, {'py': 0.018, 'pz': -0.015, 'prx': -0.19, 's1': 0.13, 's2': 0.13, 'ch': 0.10, 'nk': -0.13, 'hd': -0.10, 'jaw': 0.32, 't1': 0.22, 't2': 0.04, 't3': -0.08}),
            (0.77, {'py': 0.054, 'pz': 0.005, 'prx': 0.01, 's1': -0.03, 's2': -0.03, 'ch': -0.02, 'nk': 0.14, 'hd': -0.14, 'jaw': 0.36, 't1': 0.24, 't2': 0.08, 't3': 0.04}),
            (0.90, {'py': 0.090, 'pz': 0.020, 'prx': 0.14, 's1': -0.12, 's2': -0.11, 'ch': -0.08, 'nk': 0.34, 'hd': -0.18, 'jaw': 0.36, 't1': 0.30, 't2': 0.14, 't3': 0.08}),
            (1.00, {'py': 0.092, 'pz': 0.025, 'prx': 0.17, 's1': -0.14, 's2': -0.13, 'ch': -0.09, 'nk': 0.40, 'hd': -0.20, 'jaw': 0.34, 't1': 0.36, 't2': 0.18, 't3': 0.10}),
        ]
        b = keyed(u % 1.0, body_keys)
        front_keys = [
            (0.00, {'up': -0.88, 'lo': -0.14, 'pw': 0.20, 'aby': 0.00, 'abz': 0.00}),
            (0.13, {'up': -0.66, 'lo': 0.04, 'pw': 0.52, 'aby': 0.00, 'abz': 0.00}),
            (0.25, {'up': -0.08, 'lo': 0.18, 'pw': -0.16, 'aby': 0.00, 'abz': 0.00}),
            (0.36, {'up': 0.30, 'lo': 0.48, 'pw': -0.58, 'aby': 0.00, 'abz': -0.02}),
            (0.45, {'up': 0.06, 'lo': 1.38, 'pw': -0.74, 'aby': 0.00, 'abz': -0.02}),
            (0.55, {'up': -0.18, 'lo': 1.56, 'pw': -0.76, 'aby': 0.00, 'abz': -0.02}),
            (0.76, {'up': -0.60, 'lo': 1.42, 'pw': -0.68, 'aby': 0.00, 'abz': -0.01}),
            (0.86, {'up': -0.86, 'lo': 0.94, 'pw': -0.20, 'aby': 0.00, 'abz': 0.00}),
            (0.95, {'up': -0.90, 'lo': 0.08, 'pw': 0.06, 'aby': 0.00, 'abz': 0.00}),
            (1.00, {'up': -0.88, 'lo': -0.14, 'pw': 0.20, 'aby': 0.00, 'abz': 0.00}),
        ]
        hind_keys = [
            (0.00, {'up': 0.54, 'lo': 0.42, 'pw': -0.35, 'aby': 0.02, 'abz': 0.02}),
            (0.16, {'up': 0.24, 'lo': -0.78, 'pw': 0.36, 'aby': 0.16, 'abz': 0.16}),
            (0.36, {'up': -0.52, 'lo': -0.84, 'pw': 0.65, 'aby': 0.30, 'abz': 0.28}),
            (0.50, {'up': -0.76, 'lo': -0.20, 'pw': 0.60, 'aby': 0.30, 'abz': 0.28}),
            (0.64, {'up': -0.62, 'lo': 0.02, 'pw': 0.56, 'aby': 0.24, 'abz': 0.22}),
            (0.78, {'up': 0.04, 'lo': 0.16, 'pw': -0.12, 'aby': 0.06, 'abz': 0.06}),
            (0.92, {'up': 0.56, 'lo': 0.48, 'pw': -0.45, 'aby': 0.02, 'abz': 0.02}),
            (1.00, {'up': 0.54, 'lo': 0.42, 'pw': -0.35, 'aby': 0.02, 'abz': 0.02}),
        ]
        pose = {
            'pelvis': pelvis(b['prx'], y=b['py'], z=b['pz']),
            'spine_01': rot(b['s1']),
            'spine_02': rot(b['s2']),
            'chest': rot(b['ch']),
            'neck': rot(b['nk']),
            'head': rot(b['hd']),
            'jaw': rot(b['jaw']),
            'tail_01': rot(b['t1']),
            'tail_02': rot(b['t2']),
            'tail_03': rot(b['t3']),
        }
        for leg, offset, side, keys in (('fl', -0.09, 1.0, front_keys), ('fr', 0.05, -1.0, front_keys),
                                        ('bl', 0.05, 1.0, hind_keys), ('br', -0.06, -1.0, hind_keys)):
            k = keyed(((u % 1.0) + offset) % 1.0, keys)
            pose[f'leg_{leg}_upper'] = rot(k['up'], side * k['aby'], side * k['abz'])
            pose[f'leg_{leg}_lower'] = rot(k['lo'])
            pose[f'leg_{leg}_paw'] = rot(k['pw'])
        return pose

    def attack_fn(u, _t):
        # Coil (0.30), lunge and bite (0.50), follow through (0.62), then a smooth return to the start pose.
        keys = [
            (0.00, {}),
            (0.30, {'z': -0.14, 'y': 0.068, 'pelvis': 0.05, 'chest': 0.06, 'neck': -0.24, 'head': 0.10, 'jaw': 0.42,
                    'front_up': -0.24, 'front_lo': 0.52, 'front_paw': -0.22, 'hind_up': -0.28, 'hind_lo': 0.50,
                    'hind_paw': -0.18, 'tail': -0.22}),
            (0.50, {'z': 0.34, 'y': 0.12, 'pelvis': -0.18, 'chest': -0.10, 'neck': 0.22, 'head': -0.16, 'jaw': 0.80,
                    'front_up': -0.78, 'front_lo': 0.48, 'front_paw': 0.15, 'hind_up': 0.50, 'hind_lo': -0.14,
                    'hind_paw': -0.32, 'tail': 0.45}),
            (0.62, {'z': 0.26, 'y': 0.045, 'pelvis': -0.02, 'chest': 0.06, 'neck': 0.22, 'head': 0.10, 'jaw': 0.02,
                    'front_up': -0.40, 'front_lo': 0.28, 'front_paw': 0.08, 'hind_up': 0.34, 'hind_lo': -0.10,
                    'hind_paw': -0.22, 'tail': 0.20}),
            (1.00, {}),
        ]
        k = keyed(u, keys)
        get = lambda name: k.get(name, 0.0)  # noqa: E731
        pose = {
            'pelvis': pelvis(get('pelvis'), y=get('y'), z=get('z')),
            'chest': rot(get('chest')),
            'neck': rot(get('neck')),
            'head': rot(get('head')),
            'jaw': rot(0.10 + get('jaw')),
            'tail_01': rot(get('tail')),
            'tail_02': rot(0.5 * get('tail')),
        }
        front = (get('front_up') - get('pelvis') - get('chest'), get('front_lo'), get('front_paw'))
        hind = (get('hind_up') - get('pelvis'), get('hind_lo'), get('hind_paw'))
        return legs(pose, front, front, hind, hind)

    def howl_fn(u, _t):
        # Plant all four paws on the floor with a braced squat while the chest and muzzle lift into a howl.
        wp = QUADRUPED_CONTRACT['worldPositions']

        def rot_yz(v, rx):
            c, s = math.cos(rx), math.sin(rx)
            return (v[0] * c - v[1] * s, v[0] * s + v[1] * c)

        def offset_yz(a, b):
            return (wp[b][1] - wp[a][1], wp[b][2] - wp[a][2])

        def wrap_pi(x):
            return (x + math.pi) % tau - math.pi

        def solve_leg_ik(hip_yz, u_name, l_name, p_name, parent_rx):
            ru, rl, rp = wp[u_name], wp[l_name], wp[p_name]
            ay, az = rl[1] - ru[1], rl[2] - ru[2]
            by, bz = rp[1] - rl[1], rp[2] - rl[2]
            l1, l2 = math.hypot(ay, az), math.hypot(by, bz)
            ang_a0, ang_b0 = math.atan2(az, ay), math.atan2(bz, by)
            dy, dz = rp[1] - hip_yz[0], rp[2] - hip_yz[1]
            dist = min(math.hypot(dy, dz), (l1 + l2) * 0.999)
            cos_a = max(-1.0, min(1.0, (l1 * l1 + dist * dist - l2 * l2) / (2.0 * l1 * dist)))
            world_ang_a = math.atan2(dz, dy) + math.acos(cos_a)
            ey, ez = l1 * math.cos(world_ang_a), l1 * math.sin(world_ang_a)
            world_ang_b = math.atan2(dz - ez, dy - ey)
            up_rx = wrap_pi(world_ang_a - ang_a0 - parent_rx)
            lo_rx = wrap_pi(world_ang_b - ang_b0 - parent_rx - up_rx)
            pw_rx = wrap_pi(-(parent_rx + up_rx + lo_rx))
            return (up_rx, lo_rx, pw_rx)

        rise = ease(u / 0.24) if u < 0.24 else (1.0 if u < 0.76 else 1.0 - ease((u - 0.76) / 0.24))
        sway = math.sin(u * tau * 2.0) * rise
        tremble = math.sin(u * tau * 9.0) * rise
        lean, arch, chest_rx = -0.06 * rise, -0.08 * rise, -0.16 * rise
        py, pz = -0.060 * rise, -0.020 * rise
        pose = {
            'pelvis': pelvis(lean, y=py, z=pz),
            'spine_02': rot(arch),
            'chest': rot(chest_rx),
            'neck': rot((-0.46 - 0.03 * sway) * rise, 0.04 * sway),
            'head': rot((-0.42 - 0.03 * sway) * rise, 0.03 * sway),
            'jaw': rot(0.10 + (0.42 + 0.05 * tremble) * rise),
            'tail_01': rot(0.30 * rise, 0.08 * sway),
            'tail_02': rot(0.12 * rise, 0.10 * sway),
            'tail_03': rot(0.10 * rise),
        }
        p_pel = (wp['pelvis'][1] + py, wp['pelvis'][2] + pz)
        p_s1 = tuple(a + b for a, b in zip(p_pel, rot_yz(offset_yz('pelvis', 'spine_01'), lean)))
        p_s2 = tuple(a + b for a, b in zip(p_s1, rot_yz(offset_yz('spine_01', 'spine_02'), lean)))
        p_ch = tuple(a + b for a, b in zip(p_s2, rot_yz(offset_yz('spine_02', 'chest'), lean + arch)))
        rx_ch = lean + arch + chest_rx
        p_flu = tuple(a + b for a, b in zip(p_ch, rot_yz(offset_yz('chest', 'leg_fl_upper'), rx_ch)))
        p_blu = tuple(a + b for a, b in zip(p_pel, rot_yz(offset_yz('pelvis', 'leg_bl_upper'), lean)))
        front = solve_leg_ik(p_flu, 'leg_fl_upper', 'leg_fl_lower', 'leg_fl_paw', rx_ch)
        hind = solve_leg_ik(p_blu, 'leg_bl_upper', 'leg_bl_lower', 'leg_bl_paw', lean)
        return legs(pose, front, front, hind, hind)

    def death_fn(u, _t):
        # Hit recoil (head and neck go up and back, jaws open), the legs fold, then the belly hits the floor.
        keys = [
            (0.00, {'jaw': 0.08}),
            (0.14, {'y': 0.020, 'z': -0.11, 'rx': -0.22, 'ry': -0.14, 'rz': 0.03,
                    's1': -0.07, 's2': -0.08, 'ch': -0.07, 'nk_x': -0.50, 'nk_z': 0.04,
                    'hd_x': -0.36, 'hd_y': -0.10, 'hd_z': 0.06, 'jaw': 0.68, 'tx': 0.25, 'tz': -0.05,
                    'fl_u': -0.26, 'fl_ry': 0.06, 'fl_rz': 0.10, 'fl_l': 0.36, 'fl_p': -0.14,
                    'fr_u': -0.32, 'fr_ry': -0.06, 'fr_rz': -0.12, 'fr_l': 0.42, 'fr_p': -0.16,
                    'bl_u': -0.40, 'bl_ry': 0.12, 'bl_rz': 0.14, 'bl_l': 0.56, 'bl_p': -0.18,
                    'br_u': -0.44, 'br_ry': -0.12, 'br_rz': -0.16, 'br_l': 0.60, 'br_p': -0.20}),
            (0.30, {'y': -0.055, 'z': -0.14, 'rx': 0.02, 'ry': -0.09, 'rz': 0.05,
                    's1': 0.04, 's2': 0.05, 'ch': 0.04, 'nk_x': 0.12, 'nk_z': -0.06,
                    'hd_x': 0.10, 'hd_y': -0.04, 'hd_z': -0.05, 'jaw': 0.46, 'tx': 0.22, 'tz': -0.12,
                    'fl_u': -1.32, 'fl_ry': 0.16, 'fl_rz': 0.20, 'fl_l': 0.50, 'fl_p': 0.72,
                    'fr_u': -1.40, 'fr_ry': -0.20, 'fr_rz': -0.22, 'fr_l': 0.34, 'fr_p': 0.96,
                    'bl_u': -1.36, 'bl_ry': 0.22, 'bl_rz': 0.22, 'bl_l': 0.88, 'bl_p': 0.42,
                    'br_u': -1.40, 'br_ry': -0.22, 'br_rz': -0.22, 'br_l': 0.92, 'br_p': 0.42}),
            (0.54, {'y': -0.280, 'z': -0.18, 'rx': 0.04, 'ry': -0.06, 'rz': 0.09,
                    's1': 0.03, 's2': 0.03, 'ch': 0.03, 'nk_x': 0.48, 'nk_z': -0.13,
                    'hd_x': 0.16, 'hd_y': 0.16, 'hd_z': -0.10, 'jaw': 0.26, 'tx': 0.34, 'tz': -0.24,
                    'fl_u': -1.66, 'fl_ry': 0.24, 'fl_rz': 0.22, 'fl_l': 0.56, 'fl_p': 1.00,
                    'fr_u': -1.72, 'fr_ry': -0.28, 'fr_rz': -0.24, 'fr_l': 0.36, 'fr_p': 1.24,
                    'bl_u': -1.72, 'bl_ry': 0.42, 'bl_rz': 0.28, 'bl_l': 0.96, 'bl_p': 0.66,
                    'br_u': -1.76, 'br_ry': -0.42, 'br_rz': -0.28, 'br_l': 1.00, 'br_p': 0.66}),
            (0.67, {'y': -0.264, 'z': -0.18, 'rx': 0.03, 'ry': -0.06, 'rz': 0.09,
                    's1': 0.02, 's2': 0.03, 'ch': 0.02, 'nk_x': 0.40, 'nk_z': -0.12,
                    'hd_x': 0.08, 'hd_y': 0.16, 'hd_z': -0.10, 'jaw': 0.32, 'tx': 0.30, 'tz': -0.22,
                    'fl_u': -1.62, 'fl_ry': 0.24, 'fl_rz': 0.22, 'fl_l': 0.52, 'fl_p': 0.98,
                    'fr_u': -1.68, 'fr_ry': -0.28, 'fr_rz': -0.24, 'fr_l': 0.34, 'fr_p': 1.22,
                    'bl_u': -1.68, 'bl_ry': 0.42, 'bl_rz': 0.28, 'bl_l': 0.92, 'bl_p': 0.64,
                    'br_u': -1.72, 'br_ry': -0.42, 'br_rz': -0.28, 'br_l': 0.96, 'br_p': 0.64}),
            (0.84, {'y': -0.285, 'z': -0.18, 'rx': 0.04, 'ry': -0.06, 'rz': 0.10,
                    's1': 0.03, 's2': 0.03, 'ch': 0.03, 'nk_x': 0.52, 'nk_z': -0.15,
                    'hd_x': 0.18, 'hd_y': 0.18, 'hd_z': -0.12, 'jaw': 0.16, 'tx': 0.36, 'tz': -0.26,
                    'fl_u': -1.68, 'fl_ry': 0.24, 'fl_rz': 0.22, 'fl_l': 0.58, 'fl_p': 1.00,
                    'fr_u': -1.74, 'fr_ry': -0.28, 'fr_rz': -0.24, 'fr_l': 0.38, 'fr_p': 1.24,
                    'bl_u': -1.74, 'bl_ry': 0.42, 'bl_rz': 0.28, 'bl_l': 0.98, 'bl_p': 0.66,
                    'br_u': -1.78, 'br_ry': -0.42, 'br_rz': -0.28, 'br_l': 1.02, 'br_p': 0.66}),
        ]
        keys.append((1.00, keys[-1][1]))
        k = keyed(u, keys)
        g = lambda name: k.get(name, 0.0)  # noqa: E731
        pose = {
            'pelvis': pelvis(g('rx'), g('ry'), g('rz'), y=g('y'), z=g('z')),
            'spine_01': rot(g('s1'), 0.0, 0.02 * g('rz')),
            'spine_02': rot(g('s2'), 0.0, 0.02 * g('rz')),
            'chest': rot(g('ch'), 0.0, 0.02 * g('rz')),
            'neck': rot(g('nk_x'), 0.0, g('nk_z')),
            'head': rot(g('hd_x'), g('hd_y'), g('hd_z')),
            'jaw': rot(g('jaw')),
            'tail_01': rot(g('tx'), 0.0, g('tz')),
            'tail_02': rot(0.35 * g('tx'), 0.0, 0.7 * g('tz')),
            'tail_03': rot(-0.25 * g('tx'), 0.0, 0.5 * g('tz')),
        }
        for leg in ('fl', 'fr', 'bl', 'br'):
            pose[f'leg_{leg}_upper'] = rot(g(f'{leg}_u'), g(f'{leg}_ry'), g(f'{leg}_rz'))
            pose[f'leg_{leg}_lower'] = rot(g(f'{leg}_l'))
            pose[f'leg_{leg}_paw'] = rot(g(f'{leg}_p'))
        return pose

    builders = {'Idle': (24, idle_fn), 'Walk': (24, walk_fn), 'Run': (30, run_fn), 'Attack': (30, attack_fn),
                'Death': (24, death_fn), 'Howl': (24, howl_fn)}
    # The contract owns the clip names, their order and their durations.
    return [sample_clip(clip['name'], clip['duration'], *builders[clip['name']]) for clip in QUADRUPED_CONTRACT['clips']]


# --------------------------------------------------------------------------
# Arachnid: scrap spider on the 28-joint rig
# --------------------------------------------------------------------------

# One row for each left leg, in world lattice cells: the coxa stub, three femur steps that go up and out from the
# femur joint to the knee, and three tibia columns that go down and out from the knee to y = 0. The steps stay near
# the line between the joints: the legs then keep clear of each other in the clips, and the fitted ragdoll capsules
# stay thin. The femurs of legs 2 and 3 are one cell thick: Attack turns leg 3 by 0.4 rad about X in relation to
# leg 2, and thick femurs then touch.
SPIDER_LEGS = {
    1: {'coxa': ((3, 5), (8, 9), (4, 6)),
        'femur': (((5, 6), (9, 11), (6, 7)), ((7, 8), (11, 13), (7, 8)), ((8, 10), (13, 15), (9, 10))),
        'tibia': (((10, 11), (9, 15), (10, 11)), ((12, 13), (4, 10), (11, 12)), ((13, 14), (0, 5), (13, 14)))},
    2: {'coxa': ((4, 6), (8, 9), (2, 3)),
        'femur': (((6, 8), (9, 10), 3), ((8, 10), (11, 12), 3), ((10, 12), (13, 14), 3)),
        'tibia': (((11, 12), (10, 16), (3, 4)), ((13, 14), (5, 11), (3, 4)), ((15, 16), (0, 6), (4, 5)))},
    3: {'coxa': ((4, 6), (8, 9), (-2, -1)),
        'femur': (((6, 8), (9, 10), -2), ((8, 10), (11, 12), -2), ((10, 12), (13, 14), -2)),
        'tibia': (((11, 12), (10, 16), (-3, -2)), ((13, 14), (5, 11), (-3, -2)), ((15, 16), (0, 6), (-4, -3)))},
    4: {'coxa': ((3, 5), (8, 9), (-5, -3)),
        'femur': (((5, 6), (9, 11), (-6, -5)), ((7, 8), (11, 13), (-7, -6)), ((8, 10), (13, 15), (-9, -8))),
        'tibia': (((10, 11), (9, 15), (-10, -9)), ((12, 13), (4, 10), (-11, -10)), ((13, 14), (0, 5), (-13, -12)))},
}


def build_scrap_spider(rig):
    """Scrap spider. Cells are world lattice cells (see lattice_anchor). The left legs are mirrored to the right.

    Palette roles: primary = hazard-yellow hull, hair = black stripes, joints and feet, secondary = dark chassis,
    metal = bare steel struts and fangs, accent = glowing optics.
    """
    part = vk.VoxelPart('body_giant_spider')
    hull, chassis, black = vox('primary'), vox('secondary'), vox('hair', -0.2)
    steel, steel_dark = vox('metal'), vox('metal', -0.3)
    optic = vox('accent', emissive=True, mottle=False)

    def seg(bone, sculpt, **options):
        creature_segment(part, rig, bone, sculpt, **options)

    # ---- chassis with a yellow top plate. One free cell stays between the chassis and each femur. ----------------
    seg('body', Sculpt().box((-3, 3), (7, 10), (-3, 4), chassis).box((-2, 2), 11, (-2, 3), hull))

    # ---- sensor head: hood, two main optics, two side optics, steel fangs ---------------------------------------
    seg('head', Sculpt()
        .box((-2, 2), (7, 9), (4, 8), chassis)
        .box((-2, 2), 10, (6, 9), hull)
        .both((1, 2), 9, 8, optic)
        .both(3, 8, (6, 7), optic)
        .both((1, 2), (5, 7), 9, steel), bake_ao=False)

    # ---- abdomen: yellow tank with black hazard bands and a rear warning light ----------------------------------
    tank = (Sculpt()
            .box((-2, 2), (8, 11), (-5, -3), chassis)
            .box((-4, 4), (8, 13), (-18, -6), hull)
            .box((-5, 5), (9, 12), (-17, -7), hull)
            .box((-3, 3), 14, (-17, -7), hull)
            .box((-1, 1), (10, 12), -18, chassis)
            .box(0, 11, -18, optic))
    for z in (-15, -10):
        tank.paint((-5, 5), (9, 14), z, black)
    seg('abdomen', tank, bake_ao=False)

    # ---- eight legs: coxa stub, stepped femur, stepped tibia with a black foot column on y = 0 -------------------
    # Only the femur has a pad. It overlaps the coxa and the tibia, and the tibia must stop exactly on y = 0.
    for index, leg in SPIDER_LEGS.items():
        seg(f'leg_{index}_l_coxa', Sculpt().box(*leg['coxa'], black), mirror=True, bake_ao=False)
        femur = Sculpt()
        for box in leg['femur']:
            femur.box(*box, steel)
        seg(f'leg_{index}_l_femur', femur, mirror=True, pad=JOINT_PAD, bake_ao=False)
        knee, shin, foot = leg['tibia']
        seg(f'leg_{index}_l_tibia', Sculpt().box(*knee, steel_dark).box(*shin, steel_dark).box(*foot, black),
            mirror=True, bake_ao=False)

    return part.to_mesh(rig, morph=False)


def spider_clips():
    b0 = ARACHNID_CONTRACT['worldPositions']['body']
    tau = math.tau

    def body(rx=0.0, ry=0.0, rz=0.0, y=0.0, z=0.0):
        return {'translation': [b0[0], b0[1] + y, b0[2] + z], 'rotation': euler_quat(rx, ry, rz)}

    def leg(pose, index, side, *, yaw=0.0, lift=0.0, reach=0.0, level=0.0):
        """One leg. yaw + = the tip moves forward, lift + = the knee rises, reach + = the tibia swings out and up.

        `level` turns the leg about X at the coxa. It takes a body pitch out of the leg.
        """
        s = 1.0 if side == 'l' else -1.0
        pose[f'leg_{index}_{side}_coxa'] = rot(level, -s * yaw, s * lift * 0.30)
        pose[f'leg_{index}_{side}_femur'] = rot(0, 0, s * lift * 0.60)
        pose[f'leg_{index}_{side}_tibia'] = rot(0, 0, s * reach)

    def stride(phase, duty, reach):
        """Leg yaw (+ forward) and lift (0 to 1). The stance part has a constant ground speed."""
        phase %= 1.0
        if phase < duty:
            return reach * (1.0 - 2.0 * phase / duty), 0.0
        swing = (phase - duty) / (1.0 - duty)
        return reach * (2.0 * ease(swing) - 1.0), math.sin(math.pi * swing)

    def idle_fn(u, _t):
        s, s2 = math.sin(u * tau), math.sin(u * tau * 2.0)
        pose = {
            'body': body(0.02 * s, 0, 0, y=0.014 * s),
            'abdomen': rot(0.06 * s, 0.03 * math.sin(u * tau + 0.8)),
            'head': rot(0.05 * s2, 0.05 * s),
        }
        for index in (1, 2, 3, 4):
            for side in ('l', 'r'):
                # The front pair taps the ground like a feeler. The other legs take the breath of the body.
                tap = max(0.0, math.sin(u * tau * 2.0 + (0.0 if side == 'l' else 1.6))) if index == 1 else 0.0
                leg(pose, index, side, yaw=0.10 * tap, lift=0.30 * tap - 0.035 * s, reach=0.10 * tap)
        return pose

    def gait_fn(u, stride_yaw, lift_amount, bob):
        # Alternating tetrapod gait. Leg 4 has a half stride and a forward bias, so the rear tibias stay clear of
        # the abdomen. The bias is 0.10 rad (the poly spider has 0.22): at 0.22 the voxel shin of leg 4 touches leg 3.
        a = u * tau
        pose = {
            'body': body(0.02 * math.sin(2 * a), 0.03 * math.sin(a), 0.025 * math.sin(a),
                         y=0.014 + bob * (0.5 - 0.5 * math.cos(2 * a))),
            'abdomen': rot(0.06 + 0.04 * math.sin(2 * a + 0.9), -0.04 * math.sin(a)),
            'head': rot(0.03 * math.sin(2 * a), -0.03 * math.sin(a)),
        }
        for index in (1, 2, 3, 4):
            for side in ('l', 'r'):
                group_a = (index % 2 == 1) == (side == 'l')
                leg_yaw = stride_yaw * (0.50 if index == 4 else 1.0)
                yaw_bias = 0.04 if index == 1 else (0.10 if index == 4 else 0.0)
                angle, lift = stride(u + (0.0 if group_a else 0.5), 0.5, leg_yaw)
                leg_lift = lift_amount * (0.72 if index == 3 else 1.0) * lift
                leg(pose, index, side, yaw=angle + yaw_bias, lift=leg_lift, reach=(0.36 if index == 4 else 0.26) * lift)
        return pose

    def attack_fn(u, _t):
        # Rear up (0.36), hold the threat with wide front legs (0.48), slam above the ground (0.60), return.
        keys = [
            (0.00, {}),
            (0.36, {'rear': 1.0, 'y': 0.15, 'z': -0.06, 'front': 1.0}),
            (0.48, {'rear': 1.08, 'y': 0.16, 'z': -0.08, 'front': 1.12}),
            (0.60, {'rear': 0.0, 'y': 0.015, 'z': 0.14, 'front': 0.06}),
            (0.74, {'rear': 0.0, 'y': 0.005, 'z': 0.06, 'front': 0.02}),
            (1.00, {}),
        ]
        k = keyed(u, keys)
        rear, front = k.get('rear', 0.0), k.get('front', 0.0)
        pitch = -0.56 * rear
        pose = {
            'body': body(pitch, y=k.get('y', 0.0), z=k.get('z', 0.0)),
            'abdomen': rot(0.42 * rear),
            'head': rot(0.24 * rear),
        }
        for side in ('l', 'r'):
            # A negative yaw moves leg 1 out to the side. It does not cross x = 0.
            leg(pose, 1, side, yaw=-0.16 * max(0.0, front), lift=0.95 * front, reach=0.45 * front)
            leg(pose, 2, side, yaw=0.06 * front, lift=0.55 * front, reach=0.28 * front, level=-0.30 * pitch)
            leg(pose, 3, side, lift=0.04 * abs(rear), level=-pitch)
            leg(pose, 4, side, yaw=0.08 * abs(rear), lift=0.04 * abs(rear), level=-pitch)
        return pose

    def death_fn(u, _t):
        # Hit recoil (head and front of the chassis go up and back), then the belly drops and the legs curl.
        keys = [
            (0.00, {}),
            (0.15, {'y': 0.06, 'z': -0.09, 'rx': -0.36, 'ry': 0.08, 'rz': -0.03,
                    'ab_x': 0.26, 'hd_x': -0.34, 'hd_y': -0.06, 'hd_z': 0.0,
                    'l1_l': 0.78, 'l1_r': 0.34, 'l1_y': -0.10, 'l1_lv': 0.0,
                    'l2_l': 0.42, 'l2_r': 0.18, 'l2_y': 0.02, 'l2_lv': 0.15,
                    'l3_l': -0.02, 'l3_r': 0.06, 'l3_y': 0.08, 'l3_lv': 0.34,
                    'l4_l': -0.02, 'l4_r': 0.08, 'l4_y': 0.20, 'l4_lv': 0.36}),
            (0.34, {'y': -0.10, 'z': -0.13, 'rx': -0.06, 'ry': 0.05, 'rz': 0.06,
                    'ab_x': 0.12, 'hd_x': -0.26, 'hd_y': 0.06, 'hd_z': 0.14,
                    'l1_l': 0.64, 'l1_r': -0.18, 'l1_y': 0.04, 'l1_lv': 0.0,
                    'l2_l': 0.64, 'l2_r': -0.16, 'l2_y': 0.06, 'l2_lv': 0.0,
                    'l3_l': 0.60, 'l3_r': -0.10, 'l3_y': 0.02, 'l3_lv': 0.06,
                    'l4_l': 0.50, 'l4_r': 0.04, 'l4_y': 0.30, 'l4_lv': 0.06}),
            (0.56, {'y': -0.172, 'z': -0.14, 'rx': -0.02, 'ry': 0.05, 'rz': 0.09,
                    'ab_x': 0.08, 'hd_x': -0.44, 'hd_y': 0.18, 'hd_z': 0.22,
                    'l1_l': 0.80, 'l1_r': -0.24, 'l1_y': 0.08, 'l1_lv': 0.0,
                    'l2_l': 0.84, 'l2_r': -0.22, 'l2_y': 0.06, 'l2_lv': 0.0,
                    'l3_l': 0.78, 'l3_r': -0.14, 'l3_y': 0.04, 'l3_lv': 0.0,
                    'l4_l': 0.66, 'l4_r': 0.06, 'l4_y': 0.36, 'l4_lv': 0.0}),
            (0.68, {'y': -0.155, 'z': -0.14, 'rx': -0.03, 'ry': 0.05, 'rz': 0.09,
                    'ab_x': 0.10, 'hd_x': -0.38, 'hd_y': 0.18, 'hd_z': 0.22,
                    'l1_l': 0.84, 'l1_r': -0.26, 'l1_y': 0.08, 'l1_lv': 0.0,
                    'l2_l': 0.88, 'l2_r': -0.24, 'l2_y': 0.06, 'l2_lv': 0.0,
                    'l3_l': 0.82, 'l3_r': -0.16, 'l3_y': 0.04, 'l3_lv': 0.0,
                    'l4_l': 0.70, 'l4_r': 0.04, 'l4_y': 0.36, 'l4_lv': 0.0}),
            (0.84, {'y': -0.175, 'z': -0.14, 'rx': -0.02, 'ry': 0.05, 'rz': 0.10,
                    'ab_x': 0.08, 'hd_x': -0.46, 'hd_y': 0.18, 'hd_z': 0.24,
                    'l1_l': 0.78, 'l1_r': -0.22, 'l1_y': 0.08, 'l1_lv': 0.0,
                    'l2_l': 0.82, 'l2_r': -0.20, 'l2_y': 0.06, 'l2_lv': 0.0,
                    'l3_l': 0.76, 'l3_r': -0.12, 'l3_y': 0.04, 'l3_lv': 0.0,
                    'l4_l': 0.64, 'l4_r': 0.08, 'l4_y': 0.38, 'l4_lv': 0.0}),
        ]
        keys.append((1.00, keys[-1][1]))
        k = keyed(u, keys)
        g = lambda name: k.get(name, 0.0)  # noqa: E731
        pose = {
            'body': body(g('rx'), g('ry'), g('rz'), y=g('y'), z=g('z')),
            'abdomen': rot(g('ab_x')),
            'head': rot(g('hd_x'), g('hd_y'), g('hd_z')),
        }
        for index in (1, 2, 3, 4):
            for side in ('l', 'r'):
                leg(pose, index, side, yaw=g(f'l{index}_y'), lift=g(f'l{index}_l'), reach=g(f'l{index}_r'),
                    level=g(f'l{index}_lv'))
        return pose

    builders = {'Idle': (24, idle_fn), 'Walk': (24, lambda u, _t: gait_fn(u, 0.12, 0.56, 0.024)),
                'Run': (30, lambda u, _t: gait_fn(u, 0.15, 0.72, 0.038)), 'Attack': (30, attack_fn),
                'Death': (24, death_fn)}
    # The contract owns the clip names, their order and their durations.
    return [sample_clip(clip['name'], clip['duration'], *builders[clip['name']]) for clip in ARACHNID_CONTRACT['clips']]


# --------------------------------------------------------------------------
# UAL1: demolition scrap-bot
# --------------------------------------------------------------------------

def build_scrap_bot(rig):
    """Demolition scrap-bot. Cells are the canonical UAL1 segment cells of docs/art-direction.md.

    Palette roles: skin = steel chassis, hair = dark joints, hoses and treads, primary = painted armour,
    secondary = power pack, metal = chrome piston rods and claws, accent = glowing sensor eye and lamps.
    """
    part = vk.VoxelPart('body_scrap_bot')
    steel, dark, armour = vox('skin'), vox('hair', -0.1), vox('primary')
    pack, chrome = vox('secondary'), vox('metal', 0.3)
    tread_low, tread_high = vox('hair', -0.5), vox('hair', 0.2)
    lamp = vox('accent', emissive=True, mottle=False)

    def seg(bone, sculpt, **options):
        ual1_segment(part, bone, sculpt, **options)

    # The hips and the arms are slim: in Walk_Loop the UAL1 forearm goes 11 cm from the thigh joint.
    # ---- torso: narrow pelvis, piston waist, armoured chest with a power pack ------------------------------------
    seg('pelvis', Sculpt().box((-2, 2), (-2, 3), (-2, 2), steel).box((-1, 1), (-1, 2), 3, armour))
    seg('spine_02', Sculpt().box((-1, 1), (-3, 3), (-1, 1), dark).both(2, (-2, 2), 0, chrome))
    seg('spine_03', Sculpt()
        .box((-4, 4), (-1, 4), (-2, 2), steel)
        .box((-3, 3), (0, 3), 3, armour)
        .paint((-3, 3), 1, 3, dark)
        .paint(2, 3, 3, lamp)
        .box((-3, 3), (0, 4), -3, pack)
        .both(2, (5, 6), -3, dark))
    seg('neck_01', Sculpt().box((-1, 1), (-1, 2), (-1, 1), dark))

    # ---- head: dark visor with a cyclops eye, hood, side bolts, antenna with a lamp ------------------------------
    seg('Head', Sculpt()
        .box((-3, 3), (0, 5), (-3, 3), steel)
        .paint((-2, 2), (1, 4), 3, dark)
        .paint((-1, 1), (2, 3), 3, lamp)
        .box((-3, 3), 5, 4, armour)
        .box((-2, 2), 6, (-2, 2), armour)
        .both(4, (2, 3), (-1, 1), dark)
        .box(2, (7, 8), -2, dark)
        .box(2, 9, -2, lamp))

    # ---- arms: pauldron, chrome piston rod, elbow barrel, second rod, two-prong claw -----------------------------
    seg('upperarm_l', Sculpt()
        .box((0, 3), (-2, 2), (-2, 2), armour)
        .box(4, (-1, 1), (-1, 1), dark)
        .box((5, 7), 0, 0, chrome), mirror=True)
    seg('lowerarm_l', Sculpt()
        .box((-1, 1), (-1, 1), (-1, 1), steel)
        .paint(1, (-1, 1), (-1, 1), armour)
        .box((2, 4), (0, 1), (-1, 0), dark)
        .box((5, 6), 0, 0, chrome), mirror=True)
    seg('hand_l', Sculpt()
        .box((0, 1), (0, 1), (-1, 1), dark)
        .box((2, 3), (0, 1), 1, chrome)
        .box((2, 3), (0, 1), -1, chrome), mirror=True, bake_ao=False)

    # ---- legs: plated thigh, knee pad, piston shin, heavy boot with a toe cap and treads -------------------------
    seg('thigh_l', Sculpt()
        .box((-2, 0), (-12, -1), (-2, 1), steel)
        .paint((-2, 0), (-12, -11), (-2, 1), dark)
        .box((-2, 0), (-9, -4), 2, armour), mirror=True)
    seg('calf_l', Sculpt()
        .box((-2, 0), (-6, 0), (-1, 1), steel)
        .box((-2, 0), (-2, 0), 2, armour)
        .box(-1, (-11, -7), 0, chrome), mirror=True)
    boot = (Sculpt()
            .box((-2, 0), (0, 1), (-2, 1), dark)
            .box((-2, 1), (-3, -1), (-2, 3), armour)
            .cut((-2, 1), -1, (2, 3))
            .paint((-2, 1), (-3, -2), (2, 3), chrome)
            .box((-2, 1), -4, (-2, 3), tread_low)
            .paint((-2, 1), -4, (0, 1), tread_high))
    seg('foot_l', boot, mirror=True)

    return part.to_mesh(rig, morph=True)


# --------------------------------------------------------------------------
# World props (3D/creatures). Cells: X and Z are centred, Y starts on the floor.
# --------------------------------------------------------------------------

def prop_dog_kennel():
    """Palette roles: primary = planks, secondary = plinth, accent = red roof, hair = door shadow, metal = plate and bowl."""
    plank, plank_dark, plinth = vox('primary'), vox('primary', -0.3), vox('secondary', -0.2)
    roof, ridge, shadow = vox('accent', -0.25), vox('metal', -0.2), vox('hair', -0.5)
    steel, kibble = vox('metal'), vox('skin', 0.1)
    kennel = (Sculpt()
              .box((-10, 10), 0, (-12, 12), plinth)
              .box((-9, 9), (1, 12), (-11, 11), plank))
    for y in (4, 8, 12):
        kennel.paint((-9, 9), y, (-11, 11), plank_dark)
    # Door recess with a stepped arch and a dark back wall.
    kennel.cut((-4, 4), (1, 8), (10, 11)).cut((-3, 3), 9, (10, 11)).paint((-4, 4), (1, 9), 9, shadow)
    # Gable roof: the ridge is along Z.
    for step, half in enumerate((11, 9, 7, 5, 3, 1)):
        kennel.box((-half, half), 13 + step, (-13, 13), ridge if half == 1 else roof)
    kennel.box((-3, 3), (10, 11), 12, steel)
    # Food bowl in front of the door.
    kennel.box((5, 8), (0, 1), (15, 18), steel).paint((6, 7), 1, (16, 17), kibble)
    return kennel


def prop_scrap_beacon():
    """Palette roles: skin = concrete, hair = tyre and lamp collar, metal = post, accent = bands and glowing dome,
    primary = scrap plate, secondary = control box."""
    concrete, tyre, post = vox('skin'), vox('hair', -0.2), vox('metal')
    band, scrap, scrap_dark = vox('accent', -0.2), vox('primary'), vox('primary', -0.35)
    control = vox('secondary')
    glow = vox('accent', emissive=True, mottle=False)
    beacon = (Sculpt()
              .box((-4, 4), (0, 1), (-4, 4), concrete)
              .box((-3, 3), 2, (-3, 3), tyre)
              .box((-1, 1), (3, 20), (-1, 1), post))
    for y in (5, 9, 13):
        beacon.paint((-1, 1), (y, y + 1), (-1, 1), band)
    # Scrap plate on the back of the post and a control box with a status lamp on the front.
    beacon.box((-4, 4), (15, 19), -2, scrap).paint((-4, 4), 17, -2, scrap_dark)
    beacon.box((-2, 2), (10, 14), (2, 3), control).paint(1, 13, 3, glow)
    # Lamp collar and a stepped glowing dome.
    beacon.box((-3, 3), 21, (-3, 3), tyre)
    beacon.box((-2, 2), (22, 23), (-2, 2), glow).box((-1, 1), 24, (-1, 1), glow).box(0, 25, 0, glow)
    return beacon


def build_prop(name, sculpt):
    (x0, x1), (y0, y1), (z0, z1) = sculpt.bounds()
    grid = vk.VoxelGrid(x0, x1, y0, y1, z0, z1, voxel_size=PROP_VOXEL, center_x=True, center_z=True)
    sculpt.write(grid)
    part = vk.VoxelPart(name)
    part.add_grid(grid)
    mesh = part.to_mesh(static=True)
    low, high = mesh.positions.min(axis=0), mesh.positions.max(axis=0)
    mesh.positions -= np.array([(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2], dtype=np.float32)
    return mesh


# --------------------------------------------------------------------------
# Pack assembly
# --------------------------------------------------------------------------

def add_body(builder, mesh, rig, rig_id):
    mesh.extras = {**(mesh.extras or {}), 'polyRagdollColliders': ragdoll_colliders(mesh, rig, rig_id)}
    if rig_id != 'ual1':
        # creature_segment puts each segment on the world lattice. `scripts/validate.ts` checks each vertex.
        mesh.extras['polyLattice'] = {'voxelSize': VOXEL, 'maxPad': JOINT_PAD}
    builder.add_mesh(mesh)


def build_creature_rig(path, contract, rig_name, rig_id, clips, build_mesh):
    """Write one creature GLB: the custom rig, its clips and the body mesh. Return the mesh."""
    shell = vk.GlbBuilder()
    shell.add_custom_rig(contract, animations=clips, rig_name=rig_name)
    shell.write(path)  # RigData reads the joints from a file. The full GLB replaces this file below.
    rig = vk.RigData(path, expected_joints=contract['joints'])
    rig.check_contract(contract=contract)
    builder = vk.GlbBuilder()
    builder.add_custom_rig(contract, animations=clips, rig_name=rig_name)
    mesh = build_mesh(rig)
    add_body(builder, mesh, rig, rig_id)
    builder.write(path)
    return mesh


def creature_preset(preset_id, label, rig_id, body, clip, palette):
    return {
        'id': preset_id, 'pack': PACK, 'label': label, 'rigId': rig_id, 'clip': clip,
        'body': body, 'head': None, 'hair': None, 'torso': None, 'legs': None,
        'headwear': None, 'back': None, 'heldRight': None, 'heldLeft': None,
        'palette': palette,
        'proportions': {'height': 1.0, 'shoulderWidth': 1.0, 'torsoBulk': 1.0, 'waistScale': 1.0,
                        'headScale': 1.0, 'limbThickness': 1.0},
    }


def main():
    args = vk.script_args(__doc__, 'core', 'stage', 'meta')
    core = vk.RigData(args.core, expected_joints=vk.RIG_CONTRACT['joints'])
    core.check_contract()

    characters = vk.leaf_dir(args.stage, PACK, 'characters')
    world = vk.leaf_dir(args.stage, PACK, 'world')
    parts = []

    # 1. Quadruped rig + guard hound
    quadruped_file = 'quadruped-rig.glb'
    hound = build_creature_rig(characters / quadruped_file, QUADRUPED_CONTRACT, 'Quadruped_Rig', 'quadruped',
                               hound_clips(), build_guard_hound)
    parts.append(vk.part_entry(hound, PACK, 'body', 'Guard Hound', quadruped_file, rig_id='quadruped'))

    # 2. Arachnid rig + scrap spider
    arachnid_file = 'arachnid-rig.glb'
    spider = build_creature_rig(characters / arachnid_file, ARACHNID_CONTRACT, 'Arachnid_Rig', 'arachnid',
                                spider_clips(), build_scrap_spider)
    parts.append(vk.part_entry(spider, PACK, 'body', 'Scrap Spider', arachnid_file, rig_id='arachnid'))

    # 3. UAL1 demolition scrap-bot (the clips stay in the core rig)
    bot_file = 'scrap-bot.glb'
    bot_builder = vk.GlbBuilder()
    bot_builder.add_rig(core, with_clips=False)
    bot = build_scrap_bot(core)
    add_body(bot_builder, bot, core, 'ual1')
    bot_builder.write(characters / bot_file)
    parts.append(vk.part_entry(bot, PACK, 'body', 'Demolition Scrap-Bot', bot_file, rig_id='ual1'))

    animal_parts, animal_presets, animal_rigs = build_all_animals(characters)
    parts.extend(animal_parts)

    exotic_parts, exotic_presets, exotic_rigs = build_all_exotics(characters)
    parts.extend(exotic_parts)

    # 4. World props
    props = []
    for build, label in ((prop_dog_kennel, 'Dog Kennel'), (prop_scrap_beacon, 'Scrap Beacon')):
        mesh = build_prop(build.__name__, build())
        rel = f'props/{mesh.name}.glb'
        props.append(vk.prop_entry(mesh, PACK, label, rel, vk.write_static_glb(world / rel, mesh)))

    presets = [
        creature_preset('creature_guard_hound', 'Guard Hound', 'quadruped', 'body_dire_wolf', 'Howl',
                        {'skin': '#a5693c', 'hair': '#1c1b1e', 'primary': '#3b3d44', 'secondary': '#4a5240',
                         'accent': '#ff3b2a', 'metal': '#8e969e'}),
        creature_preset('creature_scrap_spider', 'Scrap Spider', 'arachnid', 'body_giant_spider', 'Attack',
                        {'skin': '#8a5a3c', 'hair': '#1f2023', 'primary': '#bf9a45', 'secondary': '#4a4e55',
                         'accent': '#ff4d2e', 'metal': '#8a929b'}),
        creature_preset('creature_demolition_bot', 'Demolition Scrap-Bot', 'ual1', 'body_scrap_bot', 'Walk_Loop',
                        {'skin': '#88929b', 'hair': '#26272b', 'primary': '#bf8a44', 'secondary': '#4f5660',
                         'accent': '#ff2a1f', 'metal': '#b9c0c8'}),
        *animal_presets,
        *exotic_presets,
    ]

    catalog = vk.pack_catalog(
        PACK,
        parts=parts,
        props=props,
        presets=presets,
        clips=[clip['name'] for clip in vk.RIG_CONTRACT['clips']],
        # validate.ts, animationAudit.ts and the showcase resolve rigModelPath from the 3D/characters leaf.
        creature_rigs=[
            {'rigId': 'quadruped', 'rigModelPath': quadruped_file,
             'clips': [c['name'] for c in QUADRUPED_CONTRACT['clips']]},
            {'rigId': 'arachnid', 'rigModelPath': arachnid_file,
             'clips': [c['name'] for c in ARACHNID_CONTRACT['clips']]},
            *animal_rigs,
            *exotic_rigs,
        ],
    )
    args.meta.mkdir(parents=True, exist_ok=True)
    meta_path = args.meta / f'{PACK}.json'
    meta_path.write_text(json.dumps(catalog, indent=2) + '\n')

    print(f'PACK {PACK}')
    for kind in ('parts', 'props'):
        for entry in catalog[kind]:
            colliders = len(entry.get('ragdollColliders', ()))
            note = f'  {colliders} ragdoll colliders ({entry["rigId"]})' if colliders else ''
            print(f'  {entry.get("slot", "prop"):6s} {entry["id"]:20s} {entry["triangles"]:5d} tris{note}')
    print(f'CATALOG WRITTEN {meta_path}')


if __name__ == '__main__':
    main()
