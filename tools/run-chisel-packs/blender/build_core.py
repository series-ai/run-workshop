"""Build run-chisel-core: the exact UAL1 rig, all clips, and the faceted bodies, heads and hair.

Usage (see scripts/build.ts):
  blender --background --factory-startup --python build_core.py -- --source <ual1-base.glb> --stage <dir> --meta <dir>
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import polykit as pk  # noqa: E402
from polykit import X, Y, Z, V  # noqa: E402

PACK = 'core'
RIG_FILE = 'core-rig.glb'


# --------------------------------------------------------------------------
# Bodies
# --------------------------------------------------------------------------

def build_body(part, body):
    ref = pk.BODIES[pk.BASE_BODY]
    torso_keys = pk.TORSO_KEYS[:-1]
    rings = [pk.torso_ring(body, key) for key in torso_keys]
    t_refs = [pk.torso_ring(ref, key) for key in torso_keys]
    armhole = pk.loft_sleeved_torso(part, rings, t_refs, torso_keys.index('chest'), 'skin', cap_start=True, cap_end=False,
              ring_skins=[pk.SKIN_TORSO] * len(rings),
              band_tags=['pelvis', 'pelvis', 'chest', 'chest', 'chest', 'chest', 'chest'])
    nb_y = body.torso['neck_base'].y - 0.004
    nb_ref_y = ref.torso['neck_base'].y - 0.004
    with part.tagged('neck'):
        part.loft(
            [pk.neck_ring(body, 'neck_base', y=nb_y, inset=0.97), pk.neck_ring(body, 'neck_top')],
            'skin',
            refs=[pk.neck_ring(ref, 'neck_base', y=nb_ref_y, inset=0.97), pk.neck_ring(ref, 'neck_top')],
            ring_skins=[pk.SKIN_TORSO, pk.SKIN_HEAD],
        )
    with part.mirrored():
        arm_skins = [
            pk.SKIN_TORSO,
            pk.SKIN_SHOULDER_CAP_L,
            pk.SKIN_ARM_L,
            pk.SKIN_ELBOW_HI_L,
            pk.SKIN_ELBOW_LO_L,
            pk.SKIN_ARM_L,
            pk.SKIN_FOREARM_END_L,
        ]
        with part.skinned(pk.SKIN_ARM_L):
            a_rings = [pk.arm_ring(body, index) for index in range(len(body.arm))]
            a_refs = [pk.arm_ring(ref, index) for index in range(len(body.arm))]
            a_rings[0], a_refs[0] = armhole
            part.loft(a_rings, 'skin', refs=a_refs, cap_start=False, cap_end=True,
                      ring_skins=arm_skins, band_tags=['upperarm'] * 3 + ['forearm'] * 3)
        pk.build_hand(part, body)
        with part.skinned(pk.SKIN_LEG_L):
            skins = [
                pk.SKIN_HIP_SOCKET_L,
                pk.SKIN_LEG_L,
                pk.SKIN_LEG_L,
                pk.SKIN_LEG_L,
                pk.SKIN_LEG_L,
                pk.SKIN_ANKLE_HI_L,
                pk.SKIN_ANKLE_L,
                pk.SKIN_ANKLE_IN_L,
            ]
            l_rings = [pk.leg_ring(body, index) for index in range(len(body.leg))]
            l_refs = [pk.leg_ring(ref, index) for index in range(len(body.leg))]
            part.loft(l_rings, 'skin', refs=l_refs, cap_start=False,
                      ring_skins=skins, band_tags=['thigh', 'thigh', 'shin', 'shin', 'shin', 'shin', 'shin'])
        pk.build_foot(part, body)


# --------------------------------------------------------------------------
# Heads
# --------------------------------------------------------------------------

def _morphed_head_shape(shape, jaw=0.0):
    if abs(jaw) < 1e-6:
        return shape
    out = dict(shape)
    cw, czf, czb = out['chin']
    out['chin'] = (cw + 0.007 * jaw, czf + 0.004 * jaw, czb)
    jw, jzf, jzb = out['jaw']
    out['jaw'] = (jw + 0.007 * jaw, jzf + 0.003 * jaw, jzb)
    return out


def build_head(part, spec, *, jaw=0.0, nose=0.0, brow=0.0, smile=0.0, blink=0.0):
    shape = _morphed_head_shape(spec.shape, jaw)
    part.skin = pk.SKIN_HEAD
    part.loft([pk.head_ring(shape, pk.HEAD_Y[key]) for key in pk.HEAD_STATION_KEYS], 'skin', cap_start=True, cap_end=True)

    # Nose: a wedge from the brow line to the tip.
    length, half_width, height = spec.nose
    length += 0.008 * nose
    half_width += 0.0035 * nose
    height += 0.005 * nose
    base_y = pk.HEAD_Y['jaw'] + 0.034
    top = V(0, base_y + height, pk.head_front_z(shape, base_y + height) - 0.002)
    front = pk.head_front_z(shape, base_y) - 0.002
    left, right = V(half_width, base_y, front), V(-half_width, base_y, front)
    tip = V(0, base_y + 0.008, front + length)
    ids = [part.vert(point) for point in (top, left, right, tip)]
    group = part.group()
    inside = V(0, base_y + height * 0.4, front - 0.02)
    part.face((ids[0], ids[1], ids[3]), 'skin', group=group, away_from=inside)
    part.face((ids[0], ids[3], ids[2]), 'skin', group=group, away_from=inside)
    part.face((ids[1], ids[2], ids[3]), 'skin', group=group, away_from=inside, ao=-0.12)

    eye_w, eye_h, spacing, eye_y = spec.eye
    eye_h_eff = max(0.0025, eye_h * (1.0 - 0.84 * blink))
    eye_y_eff = eye_y - eye_h * 0.24 * blink
    brow_w, brow_h, brow_d, tilt = spec.brow
    tilt_eff = tilt + 0.22 * brow
    mouth_w, mouth_h, smile_base = spec.mouth
    eye_z = pk.head_front_z(shape, eye_y_eff) - 0.001
    brow_y = eye_y + eye_h / 2 + brow_h / 2 + 0.006 + 0.004 * brow
    brow_z = pk.head_front_z(shape, brow_y) - 0.001
    with part.mirrored():
        part.plate(V(spacing, eye_y_eff, eye_z), Z, Y, eye_w, eye_h_eff, 0.004, 'eye', shrink=0.84, ao=-0.10)
        up = V(-math.sin(tilt_eff), math.cos(tilt_eff), 0)
        part.plate(V(spacing + 0.002, brow_y, brow_z), Z, up, brow_w, brow_h, brow_d, 'hair', shrink=0.8, ao=-0.10)
        ear_y = pk.HEAD_Y['cheek'] + 0.004
        part.plate(V(pk.head_side_x(shape, ear_y) - 0.002, ear_y, pk.HEAD_Z - 0.006), X, Y, 0.034, 0.054, 0.017, 'skin',
                   shrink=0.62)

    mouth_y = pk.HEAD_Y['jaw'] - 0.012
    mouth_z = pk.head_front_z(shape, mouth_y) - 0.0015
    if spec.beard:
        # Beard: a faceted band around the jaw in the hair colour.
        columns = [7, 0, 1, 2, 3, 4]
        rings = []
        for height_y, grow in ((pk.HEAD_Y['plug'] + 0.008, 0.006), (pk.HEAD_Y['chin'] + 0.026, 0.012),
                               (pk.HEAD_Y['jaw'] + 0.026, 0.008)):
            points = pk.head_ring(shape, height_y, grow)
            rings.append([points[column] for column in columns])
        part.loft(rings, 'hair', closed=False, ao=-0.04)
        part.plate(V(0, mouth_y + 0.022 + 0.003 * smile, pk.head_front_z(shape, mouth_y + 0.022) + 0.006), Z, Y,
                   0.058 + 0.006 * smile, 0.014, 0.008, 'hair', shrink=0.8)
    else:
        half = (mouth_w + 0.008 * smile) / 2
        smile_eff = smile_base + 0.007 * smile
        outline = [V(-half, mouth_y + smile_eff, mouth_z), V(-half * 0.5, mouth_y - mouth_h / 2, mouth_z),
                   V(half * 0.5, mouth_y - mouth_h / 2, mouth_z), V(half, mouth_y + smile_eff, mouth_z),
                   V(half * 0.5, mouth_y + mouth_h / 2, mouth_z), V(-half * 0.5, mouth_y + mouth_h / 2, mouth_z)]
        part.slab(outline, 0.003, 'skin', normal=Z, shrink=0.86, ao=-0.34)


# --------------------------------------------------------------------------
# Hair
# --------------------------------------------------------------------------

def _brow(offset=0.0):
    return pk.HEAD_Y['brow'] + offset


def _back_z(height, grow=0.0, shape=pk.HEAD_ENVELOPE):
    return pk.HEAD_Z - (pk.head_section(shape, height)[2] + grow) * pk.HEAD_PLANE


def hair_short_part(part, shape=pk.HEAD_ENVELOPE):
    part.skin = pk.SKIN_HEAD
    part.covers = ['hair']
    pk.head_shell(part, 'hair', 0.011, front=_brow(0.014), temple=_brow(-0.014), side=_brow(-0.070), back=_brow(-0.128),
                  top_lift=0.010, shape=shape)
    # Fringe swept to the left side of the head, with a hard part line.
    front = pk.head_front_z(shape, _brow(0.02), 0.011)
    part.slab([V(-0.054, _brow(0.008), front - 0.010), V(0.068, _brow(-0.008), front - 0.014),
               V(0.072, _brow(0.040), front - 0.032), V(-0.048, _brow(0.052), front - 0.028)], 0.020, 'hair',
              normal=V(0.1, 0.35, 1), shrink=0.8)
    part.box(V(-0.034, pk.HEAD_Y['crown'] + 0.009, 0.022), (0.016, 0.015, 0.138), 'hair', taper=(0.5, 0.86), ao=-0.06)


def hair_swept(part, shape=pk.HEAD_ENVELOPE):
    part.skin = pk.SKIN_HEAD
    part.covers = ['hair']
    pk.head_shell(part, 'hair', 0.013, front=_brow(0.018), temple=_brow(-0.010), side=_brow(-0.082), back=_brow(-0.146),
                  top_lift=0.012, shape=shape)
    # Quiff: a wedge that rises from the hairline and sweeps back.
    front = pk.head_front_z(shape, _brow(0.026), 0.013)
    top = pk.HEAD_Y['crown']
    rings = [
        [V(0.058, _brow(0.018), front - 0.012), V(-0.058, _brow(0.018), front - 0.012),
         V(-0.052, _brow(0.044), front - 0.028), V(0.052, _brow(0.044), front - 0.028)],
        [V(0.062, top - 0.012, front - 0.010), V(-0.062, top - 0.012, front - 0.010),
         V(-0.054, top + 0.038, front - 0.038), V(0.054, top + 0.038, front - 0.038)],
        [V(0.050, top + 0.006, -0.028), V(-0.050, top + 0.006, -0.028), V(-0.042, top + 0.038, -0.044), V(0.042, top + 0.038, -0.044)],
    ]
    part.loft(rings, 'hair', cap_start=True, tip_end=V(0, top, -0.114))
    # Three back spikes.
    for x, drop, lean in ((0.0, 0.106, 0.0), (0.044, 0.090, 0.35), (-0.044, 0.090, -0.35)):
        base = V(x, _brow(-drop), _back_z(_brow(-drop), shape=shape) + 0.014)
        part.prism(base, base + V(lean * 0.05, -0.058, -0.040), 0.026, 0.004, 3, 'hair', up=X, cap_start=False)


def hair_ponytail(part, shape=pk.HEAD_ENVELOPE):
    part.skin = pk.SKIN_HEAD
    part.covers = ['hair']
    pk.head_shell(part, 'hair', 0.010, front=_brow(0.016), temple=_brow(-0.020), side=_brow(-0.066), back=_brow(-0.122),
                  top_lift=0.008, shape=shape)
    back = _back_z(_brow(0.012), 0.010, shape=shape)
    tie = _brow(0.016)
    part.prism(V(0, tie, back + 0.014), V(0, tie + 0.010, back - 0.026), 0.027, 0.024, 6, 'accent', up=X)
    path = [V(0, tie + 0.012, back - 0.022), V(0, tie - 0.026, back - 0.076), V(0, tie - 0.136, back - 0.090),
            V(0, tie - 0.260, back - 0.058)]
    part.tube(path, [0.027, 0.042, 0.034, 0.006], 5, 'hair', up=X, cap_start=True, cap_end=True)
    front = pk.head_front_z(shape, _brow(0.012), 0.010)
    part.slab([V(-0.062, _brow(0.004), front - 0.010), V(0.062, _brow(0.004), front - 0.010),
               V(0.054, _brow(0.046), front - 0.028), V(-0.054, _brow(0.046), front - 0.028)], 0.012, 'hair',
              normal=V(0, 0.3, 1), shrink=0.82)


def hair_bob(part, shape=pk.HEAD_ENVELOPE):
    part.skin = pk.SKIN_HEAD
    part.covers = ['hair']
    pk.head_shell(part, 'hair', 0.014, front=_brow(-0.004), temple=_brow(-0.100), side=_brow(-0.166), back=_brow(-0.182),
                  top_lift=0.010, flare=0.016, levels=(_brow(-0.110),), shape=shape)
    # Blunt fringe across the forehead.
    front = pk.head_front_z(shape, _brow(-0.004), 0.014)
    part.slab([V(-0.070, _brow(-0.028), front - 0.009), V(0.070, _brow(-0.028), front - 0.009),
               V(0.064, _brow(0.030), front - 0.022), V(-0.064, _brow(0.030), front - 0.022)], 0.014, 'hair',
              normal=V(0, 0.2, 1), shrink=0.86)


HAIR = {
    'hair_short_part': ('Short Part', hair_short_part),
    'hair_swept': ('Swept Quiff', hair_swept),
    'hair_ponytail': ('Ponytail', hair_ponytail),
    'hair_bob': ('Bob Cut', hair_bob),
}


# --------------------------------------------------------------------------
# Athletic Basewear
# --------------------------------------------------------------------------

def torso_core_tee(part, body):
    part.covers = ['chest', 'legs_waist']
    neck = body.torso['neck_base'].y
    torso_spec = [
        ('hips', 0.015, {'y': 1.074}),
        ('belt', 0.011),
        ('waist', 0.010),
        ('ribs', 0.011),
        ('chest', 0.012),
        ('shoulder', 0.011),
        ('neck_base', 0.006),
        ('neck_base', 0.008, {'y': neck + 0.016}),
    ]
    t_rings, t_refs = [], []
    for key, grow, *rest in torso_spec:
        extra = dict(rest[0]) if rest else {}
        if key == 'hips':
            t_rings.append(pk.hip_hem_torso_ring(body, extra.get('y', body.torso['hips'].y), grow, clearance=0.005))
        else:
            t_rings.append(pk.torso_ring(body, key, grow, **extra))
        t_refs.append(pk.torso_ring(body, key, 0.0, y=extra.get('y')))
    with part.skinned(pk.SKIN_TORSO):
        armhole = pk.loft_sleeved_torso(part, t_rings, t_refs, 4, 'primary',
                  band_regions=['primary'] * 6 + ['accent'],
                  band_ao=[-0.08, 0.0, 0.0, 0.02, 0.02, 0.0, 0.06])
        center, normal, _ = pk.facet(pk.torso_ring(body, 1.44, 0.022), 2)
        with part.anchored(pk.facet(pk.torso_ring(body, 1.44), 2)[0]):
            part.plate(center, normal, Y, 0.050, 0.036, 0.005, 'accent', corner=0.008, ao=0.04)

    sleeve_spec = [(0, 0.011), (1, 0.012), (2.0, 0.012), (2.08, 0.014), (2.08, 0.002), (1.90, 0.002)]
    s_skins = [
        pk.SKIN_TORSO if index <= 0.05
        else (pk.SKIN_SHOULDER_CAP_L if index <= 1.05 else pk.SKIN_ARM_L)
        for index, _ in sleeve_spec
    ]
    with part.mirrored(), part.skinned(pk.SKIN_ARM_L):
        s_rings = [pk.arm_ring(body, index, grow) for index, grow in sleeve_spec]
        s_refs = [pk.arm_ring(body, index, 0.0) for index, _ in sleeve_spec]
        s_rings[0], s_refs[0] = armhole
        part.loft(s_rings, 'primary', refs=s_refs, ring_skins=s_skins,
                  band_regions=['primary', 'primary', 'accent', 'primary', 'primary'],
                  band_ao=[0.0, 0.0, 0.05, -0.18, -0.18])


def legs_core_shorts(part, body):
    part.covers = ['pelvis', 'thigh', 'foot']
    pelvis_spec = [('crotch', 0.008), ('hips', 0.010), ('belt', 0.010), ('belt', 0.012, {'y': 1.168})]
    p_rings, p_refs = [], []
    for key, grow, *rest in pelvis_spec:
        extra = dict(rest[0]) if rest else {}
        p_rings.append(pk.torso_ring(body, key, grow, **extra))
        p_refs.append(pk.torso_ring(body, key, 0.0, y=extra.get('y')))
    cell_tags, start_cap_tag = pk.pelvis_cell_tags()
    with part.skinned(pk.SKIN_TORSO):
        part.loft(p_rings, 'secondary', refs=p_refs, cap_start=True,
                  band_regions=['secondary', 'secondary', 'accent'],
                  band_ao=[-0.06, -0.02, 0.04],
                  cell_tags=cell_tags, start_cap_tag=start_cap_tag)

    shorts_spec = [(0, 0.003), (1, 0.004), (1.60, 0.005), (1.74, 0.005), (1.74, 0.001), (1.58, 0.001)]
    shorts_skins = [pk.SKIN_HIP_SOCKET_L] + [pk.SKIN_LEG_L] * (len(shorts_spec) - 1)
    with part.mirrored():
        with part.skinned(pk.SKIN_LEG_L):
            l_rings = [pk.leg_ring(body, index, grow) for index, grow in shorts_spec]
            l_refs = [pk.leg_ring(body, index, 0.0) for index, _ in shorts_spec]
            part.loft(l_rings, 'secondary', refs=l_refs, ring_skins=shorts_skins,
                      band_regions=['secondary', 'secondary', 'accent', 'secondary', 'secondary'],
                      band_ao=[0.0, 0.0, 0.04, -0.18, -0.18])
            sock_spec = [(5.15, 0.006), (6.0, 0.007), (7.0, 0.003)]
            sock_rings = [pk.leg_ring(body, index, grow) for index, grow in sock_spec]
            sock_refs = [pk.leg_ring(body, index, 0.0) for index, _ in sock_spec]
            sock_skins = [pk.SKIN_ANKLE_HI_L, pk.SKIN_ANKLE_L, pk.SKIN_ANKLE_IN_L]
            part.loft(sock_rings, 'metal', refs=sock_refs, ring_skins=sock_skins, ao=0.10)
        pk.build_foot(part, body, 'primary', grow=0.009, sole=0.016, sole_region='metal', ao=0.02)


# --------------------------------------------------------------------------
# Grip sockets
# --------------------------------------------------------------------------

def three_euler_xyz(matrix):
    """Euler angles in the three.js 'XYZ' order for a 3x3 rotation matrix."""
    m = matrix
    y = math.asin(max(-1.0, min(1.0, m[0][2])))
    if abs(m[0][2]) < 0.9999999:
        return [math.atan2(-m[1][2], m[2][2]), y, math.atan2(-m[0][1], m[0][0])]
    return [math.atan2(m[2][1], m[1][1]), y, 0.0]


def canonical_sockets(rig):
    """Grip frame in hand bone space: handle along +Y, aim along +Z, origin at the palm centre (rule M3).

    In the T pose the item's +Y points forward (thumb side) and its +Z points away from the body.
    """
    sockets = {}
    for bone, side in (('hand_r', -1.0), ('hand_l', 1.0)):
        frame = rig.frame(bone)
        aim = V(side, 0, 0)
        handle = V(0, 0, 1)
        world = np.array([list(handle.cross(aim)), list(handle), list(aim)]).T
        local = np.array(frame.transposed()) @ world
        palm = frame.transposed() @ V(side * 0.090, -0.040, 0.004)
        sockets[bone] = {'bone': bone, 'palmOffset': [round(v, 4) for v in palm],
                         'rotationEuler': [round(v, 4) for v in three_euler_xyz(local.tolist())]}
    return sockets


def check_sockets(sockets):
    """The sockets of the rig contract must stay on the canonical grip frame that the held items use."""
    for bone, expected in sockets.items():
        contract = pk.RIG_CONTRACT['heldSockets'][bone]
        turn = max(abs(math.remainder(a - b, math.tau)) for a, b in zip(contract['rotationEuler'], expected['rotationEuler']))
        shift = max(abs(a - b) for a, b in zip(contract['palmOffset'], expected['palmOffset']))
        if turn > 0.02 or shift > 0.03:
            raise ValueError(f'contracts/data/ual1-rig.json heldSockets.{bone} is off the canonical grip frame. '
                             f'Expected about {expected}.')


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def verify_core(path, rig, expected_clips, modified_clips=()):
    """Verify joints, inverse bind matrices, byte-exact UAL1 clips, and structural integrity of all clips."""
    modified = set(modified_clips)
    built = pk.Rig(path)
    built.check_contract()
    if not np.array_equal(built.inverse_bind, rig.inverse_bind):
        raise ValueError('The inverse bind matrices changed.')
    if built.clips != expected_clips or len(built.clips) != len(pk.RIG_CONTRACT['clips']):
        raise ValueError(f'The clip list changed: got {len(built.clips)}, expected {len(expected_clips)}.')
    source_joint = {node: joint for joint, node in enumerate(rig.joint_nodes)}
    for ours, theirs in zip(built.doc['animations'][:len(rig.doc['animations'])], rig.doc['animations']):
        if ours['name'] != theirs['name']:
            raise ValueError(f'{ours["name"]}: expected {theirs["name"]}.')
        if ours['name'] in modified:
            if not ours['channels']:
                raise ValueError(f'{ours["name"]}: modified clip has no channels.')
            continue
        if len(ours['channels']) != len(theirs['channels']):
            raise ValueError(f'{ours["name"]}: the channel count changed.')
        for mine, source in zip(ours['channels'], theirs['channels']):
            if (mine['target']['node'], mine['target']['path']) != (source_joint[source['target']['node']], source['target']['path']):
                raise ValueError(f'{ours["name"]}: a channel target changed.')
            for key in ('input', 'output'):
                _, a = pk.accessor_bytes(built.doc, built.bin, ours['samplers'][mine['sampler']][key])
                _, b = pk.accessor_bytes(rig.doc, rig.bin, theirs['samplers'][source['sampler']][key])
                if a != b:
                    raise ValueError(f'{ours["name"]}: clip sample bytes changed.')
    joint_count = len(built.joint_nodes)
    for clip in built.doc['animations']:
        for ch in clip['channels']:
            target_node = ch['target']['node']
            if target_node < 0 or target_node >= joint_count:
                raise ValueError(f'{clip["name"]}: invalid target node {target_node}')
            if ch['target']['path'] == 'rotation':
                arr = pk.accessor_array(built.doc, built.bin, clip['samplers'][ch['sampler']]['output'])
                if not np.all(np.isfinite(arr)):
                    raise ValueError(f'{clip["name"]}: non-finite quaternion sample')
    names = {node.get('name') for node in built.doc['nodes']}
    leaked = [name for name in names if name and name.startswith(('Jill_', 'Stage_', 'Club_', 'Work_'))]
    if leaked or len(built.doc['materials']) != 1 or built.doc.get('images') or built.doc.get('textures'):
        raise ValueError(f'Source meshes or materials leaked into the core rig: {leaked}')


def main():
    import argparse
    import retarget

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--stage', type=Path, required=True)
    parser.add_argument('--meta', type=Path, required=True)
    parser.add_argument('--ual2', type=Path, default=None)
    parser.add_argument('--kaykit-ranged', type=Path, default=None)
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    args = parser.parse_args(argv)

    rig = pk.Rig(args.source)
    rig.check_contract(check_clips=False)
    solver = pk.WeightSolver(rig)

    u1_state = retarget.Ual1SkeletonState(rig)
    fixed_clips = {clip['name']: clip for clip in retarget.fix_ual1_pistol_clips(u1_state, args.source)}
    sword_idle = retarget.fix_ual1_sword_idle_clip(u1_state, args.source)
    fixed_clips[sword_idle['name']] = sword_idle

    builder = pk.GlbBuilder()
    builder.add_rig(rig, with_clips=True, replace_clips=fixed_clips)

    ual2_path = args.ual2 or (args.source.parent / 'ual2-standard.glb')
    kaykit_path = args.kaykit_ranged or (args.source.parent / 'kaykit-combat-ranged.glb')
    if ual2_path.exists():
        for clip in retarget.retarget_ual2_clips(u1_state, ual2_path):
            builder.add_clip(clip)
    if kaykit_path.exists():
        for clip in retarget.retarget_kaykit_ranged_clips(u1_state, kaykit_path):
            builder.add_clip(clip)
    all_clip_names = [c['name'] for c in builder.doc.get('animations', ())]

    entries = []

    body_parts = {}
    for body in pk.BODIES.values():
        part = pk.Part(body.id)
        build_body(part, body)
        body_parts[body.id] = (body, part)
    for body_id, (body, part) in body_parts.items():
        variants = {other_id: other_part for other_id, (_, other_part) in body_parts.items() if other_id != body_id}
        mesh = part.to_mesh(solver, variants)
        builder.add_mesh(mesh)
        entries.append(pk.part_entry(mesh, PACK, 'body', body.label, RIG_FILE))
    head_morph_axes = {
        'face_jaw': {'jaw': 1.0},
        'face_nose': {'nose': 1.0},
        'face_brow': {'brow': 1.0},
        'face_smile': {'smile': 1.0},
        'face_blink': {'blink': 1.0},
    }
    for spec in pk.HEADS.values():
        part = pk.Part(spec.id)
        build_head(part, spec)
        variants = {}
        for m_name, kwargs in head_morph_axes.items():
            other = pk.Part(spec.id)
            build_head(other, spec, **kwargs)
            variants[m_name] = other
        mesh = part.to_mesh(solver, variants)
        builder.add_mesh(mesh)
        entries.append(pk.part_entry(mesh, PACK, 'head', spec.label, RIG_FILE))
    for hair_id, (label, build) in HAIR.items():
        mesh = pk.build_head_skinned(hair_id, build, solver)
        builder.add_mesh(mesh)
        entries.append(pk.part_entry(mesh, PACK, 'hair', label, RIG_FILE))
    for slot, part_id, label, build in (
        ('torso', 'torso_core_tee', 'Athletic Tee', torso_core_tee),
        ('legs', 'legs_core_shorts', 'Athletic Shorts', legs_core_shorts),
    ):
        mesh = pk.build_skinned(part_id, build, solver)
        builder.add_mesh(mesh)
        entries.append(pk.part_entry(mesh, PACK, slot, label, RIG_FILE))

    path = pk.leaf_dir(args.stage, PACK, 'characters') / RIG_FILE
    size = builder.write(path)
    verify_core(path, rig, all_clip_names, modified_clips=fixed_clips.keys())

    default_props = {'height': 1.0, 'legRatio': 0.94, 'armLength': 0.96, 'shoulderWidth': 1.04, 'torsoBulk': 1.0, 'waistScale': 1.0, 'headScale': 1.0, 'limbThickness': 1.02}
    core_presets = [
        {
            'id': 'core_athletic', 'pack': PACK, 'label': 'Core Athletic', 'rigId': 'ual1', 'clip': 'Idle_Loop',
            'body': 'body_athletic', 'head': 'head_hero', 'hair': 'hair_short_part', 'torso': 'torso_core_tee', 'legs': 'legs_core_shorts',
            'headwear': None, 'back': None, 'heldRight': None, 'heldLeft': None,
            'palette': {'skin': '#d8a67e', 'hair': '#4a2e1f', 'primary': '#3f6b8f', 'secondary': '#4a5568', 'accent': '#d9a441', 'metal': '#8a94a0', 'eye': '#2e5d8c'},
            'proportions': {**default_props},
        },
        {
            'id': 'core_heavy', 'pack': PACK, 'label': 'Core Heavy', 'rigId': 'ual1', 'clip': 'Walk_Loop',
            'body': 'body_heavy', 'head': 'head_stern', 'hair': 'hair_swept', 'torso': 'torso_core_tee', 'legs': 'legs_core_shorts',
            'headwear': None, 'back': None, 'heldRight': None, 'heldLeft': None,
            'palette': {'skin': '#bc8358', 'hair': '#25262b', 'primary': '#7c3f34', 'secondary': '#4a3d33', 'accent': '#d49d3b', 'metal': '#8a94a0', 'eye': '#63462c'},
            'proportions': {**default_props, 'legRatio': 0.93, 'shoulderWidth': 1.08, 'torsoBulk': 1.1, 'limbThickness': 1.12},
        },
        {
            'id': 'core_slim', 'pack': PACK, 'label': 'Core Slim', 'rigId': 'ual1', 'clip': 'Jog_Fwd_Loop',
            'body': 'body_slim', 'head': 'head_cheerful', 'hair': 'hair_ponytail', 'torso': 'torso_core_tee', 'legs': 'legs_core_shorts',
            'headwear': None, 'back': None, 'heldRight': None, 'heldLeft': None,
            'palette': {'skin': '#ecc8aa', 'hair': '#a84f2b', 'primary': '#3f6b45', 'secondary': '#4f5565', 'accent': '#db6e48', 'metal': '#9ca3af', 'eye': '#346b4c'},
            'proportions': {**default_props, 'height': 0.95, 'legRatio': 0.98, 'armLength': 0.97, 'shoulderWidth': 1.0, 'headScale': 1.04, 'limbThickness': 0.94},
        },
    ]

    args.meta.mkdir(parents=True, exist_ok=True)
    catalog = pk.pack_catalog(PACK, parts=entries, clips=all_clip_names, presets=core_presets, rig_model_path=RIG_FILE)
    (args.meta / 'core.json').write_text(json.dumps(catalog, indent=2) + '\n')
    sockets = canonical_sockets(rig)
    (args.meta / 'grip-sockets.json').write_text(json.dumps(sockets, indent=2) + '\n')
    check_sockets(sockets)

    print(f'CORE {path} {size} bytes, {len(rig.names)} joints, {len(all_clip_names)} clips')
    for entry in entries:
        print(f'  {entry["slot"]:9s} {entry["id"]:18s} {entry["triangles"]:5d} tris')


if __name__ == '__main__':
    main()
