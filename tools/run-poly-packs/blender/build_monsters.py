"""Build run-poly-monsters: non-uniform Orc/Troll UAL1 archetypes, 23-joint Dire Wolf, and 28-joint Giant Spider.

Usage (see scripts/build.ts):
  blender --background --factory-startup --python build_monsters.py -- --core <core-rig.glb> --stage <dir> --meta <dir>
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
from mathutils import Euler, Matrix, Vector  # noqa: E402

import polykit as pk  # noqa: E402
from polykit import X, Y, Z, V  # noqa: E402
from build_core import build_body  # noqa: E402
from build_packs import (  # noqa: E402
    PACK_TABLE,
    SKIN_BACK,
    SKIN_NECK,
    SKIN_PAULDRON_L,
    arm_stack,
    belt,
    check_compositions,
    leg_stack,
    pelvis_shell,
    preset,
    torso_plate,
    torso_stack,
)

PACK = 'monsters'
SOURCE_RIG = pk.TOOL_ROOT / 'assets/source/ual1-base.glb'
SKIN_PAULDRON_ORC_L = pk.rigid(clavicle_l=0.55, upperarm_l=0.45)
QUADRUPED_CONTRACT = pk.load_json('quadruped-rig.json')
ARACHNID_CONTRACT = pk.load_json('arachnid-rig.json')


# --------------------------------------------------------------------------
# Math helpers for procedural glTF clips
# --------------------------------------------------------------------------

def euler_quat(rx=0.0, ry=0.0, rz=0.0):
    """Quaternion [x, y, z, w] for glTF from XYZ radians."""
    q = Euler((rx, ry, rz), 'XYZ').to_quaternion()
    return [float(q.x), float(q.y), float(q.z), float(q.w)]


def sample_clip(name, duration, hz, tracks_fn):
    steps = max(2, int(round(duration * hz)))
    times = np.linspace(0.0, duration, steps + 1, dtype=np.float32)
    tracks = {}
    for step_idx, t in enumerate(times):
        u = float(t / duration) if duration > 0 else 0.0
        pose = tracks_fn(u, float(t))
        for joint, vals in pose.items():
            j_tracks = tracks.setdefault(joint, {})
            for path, vec in vals.items():
                j_tracks.setdefault(path, []).append(vec)
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


def spike(part, base, tip, radius, region, *, n=3, flat=1.0, up=Y, cap=False, **options):
    """A pointed facet cone: one ring at `base` and one apex at `tip`. It costs n triangles.

    Use it for fur tufts, claws, teeth and iron spikes. `flat` below 1 makes a blade-like section.
    Put the base inside the parent volume: the base is open unless `cap` is set.
    """
    base, tip = Vector(base), Vector(tip)
    axis = (tip - base).normalized()
    hint = Vector(up)
    if axis.cross(hint.normalized()).length < 0.25:
        hint = X if abs(axis.x) < 0.8 else Z
    right, upward, _ = pk.frame_from(axis, hint)
    return part.loft([pk.ring(base, right, upward, radius, radius * flat, n)], region, tip_end=tip, cap_start=cap,
                     **options)


def torso_at(body, height, fraction, grow=0.0, side='front', lift=0.0):
    """A point on the torso surface. `fraction` is the part of the half width (-1 right side, +1 left side)."""
    half = (pk.station_at(body, height).w + grow) * 0.97
    return pk.torso_point(body, height, max(-1.0, min(1.0, fraction)) * half, grow, side, lift)


def tilted_torso_ring(body, height, grow, tilt, **options):
    """A torso ring that slopes: the left side (+X) is at `height + tilt`, the right side at `height - tilt`."""
    level = pk.torso_ring(body, height, grow, **options)
    half = max(point.x for point in level)
    return [pk.torso_ring(body, height + tilt * point.x / half, grow, **options)[column]
            for column, point in enumerate(level)]


def torso_strap(part, body, stations, region, *, half=0.026, thick=0.014, ao=-0.04):
    """A solid strap that follows the torso surface (rule F3: real thickness, no flat sheet).

    stations: rows of (side, height, fraction, grow). side is 'front', 'back' or 'top' (over the shoulder).
    """
    centres = []
    for side, height, fraction, grow in stations:
        x = fraction * pk.station_at(body, height).w
        centres.append((side, x, height, grow))
    rings, refs = [], []
    for index, (side, x, height, grow) in enumerate(centres):
        _, x0, y0, _ = centres[max(index - 1, 0)]
        _, x1, y1, _ = centres[min(index + 1, len(centres) - 1)]
        along = Vector((x1 - x0, y1 - y0, 0.0))
        across = Vector((1.0, 0.0, 0.0)) if along.length < 1e-6 or side == 'top' else Vector((along.y, -along.x, 0.0)).normalized()
        if across.x < 0:
            across = -across
        row, ref = [], []
        for edge, lift in ((1, 0.0), (1, thick), (-1, thick), (-1, 0.0)):
            ex, ey = x + across.x * half * edge, height + across.y * half * edge
            if side == 'top':
                centre_z = body.torso['shoulder'].zc
                row.append(V(ex, height + grow + lift, centre_z))
                ref.append(V(ex, height, centre_z))
            else:
                limit = (pk.station_at(body, ey).w + grow) * 0.97
                ex = max(-limit, min(limit, ex))
                row.append(pk.torso_point(body, ey, ex, grow, side, lift))
                ref.append(pk.torso_point(body, ey, max(-limit + grow, min(limit - grow, ex)), 0.0, side))
        rings.append(row)
        refs.append(ref)
    with part.skinned(pk.SKIN_TORSO):
        return part.loft(rings, region, refs=refs, closed=False, ao=ao)


# --------------------------------------------------------------------------
# Non-uniform UAL1 archetypes: Orc & Troll
# --------------------------------------------------------------------------

make_monster_body = pk.make_monster_body
ORC_BODY = pk.ORC_BODY
TROLL_BODY = pk.TROLL_BODY
MONSTER_BODIES = pk.MONSTER_BODIES


def build_orc_body(part, body):
    build_body(part, body)
    # Muscular upper trap ridge on shoulders for silhouette weight
    with part.skinned(pk.SKIN_TORSO), part.tagged('chest'):
        torso_plate(part, body, 1.50, 7, 0.004, 0.18, 0.09, 0.022, 'skin', shrink=0.72, ao=-0.06)


def build_troll_body(part, body):
    build_body(part, body)
    # Hunched shoulder hump that sits inside the troll hide yoke without poking through.
    with part.skinned(pk.SKIN_TORSO), part.tagged('chest'):
        torso_plate(part, body, 1.49, 7, 0.004, 0.20, 0.14, 0.024, 'skin', shrink=0.68, ao=-0.08)


def head_orc(part):
    part.skin = pk.SKIN_HEAD
    shape = pk.ORC_HEAD_SHAPE
    part.loft([pk.head_ring(shape, pk.HEAD_Y[k]) for k in pk.HEAD_STATION_KEYS], 'skin', cap_start=True, cap_end=True)
    # Broad flat orc nose wedge (4 tris)
    nz = pk.head_front_z(shape, 1.825)
    top, left, right, tip = (
        part.vert(V(0, 1.855, nz - 0.002)),
        part.vert(V(0.024, 1.820, nz - 0.002)),
        part.vert(V(-0.024, 1.820, nz - 0.002)),
        part.vert(V(0, 1.824, nz + 0.032)),
    )
    g = part.group()
    inside = V(0, 1.832, nz - 0.025)
    part.face((top, left, tip), 'skin', group=g, away_from=inside)
    part.face((top, tip, right), 'skin', group=g, away_from=inside)
    part.face((left, right, tip), 'skin', group=g, away_from=inside, ao=-0.12)
    # Heavy furrowed brow + piercing eyes + pointed ears + upward ivory tusks
    with part.mirrored():
        ez = pk.head_front_z(shape, 1.868)
        part.plate(V(0.046, 1.868, ez), Z, Y, 0.032, 0.014, 0.005, 'accent', shrink=0.82, ao=0.18)
        part.plate(V(0.046, 1.894, pk.head_front_z(shape, 1.894) + 0.002), Z, V(-0.22, 0.97, 0),
                   0.056, 0.020, 0.014, 'hair', shrink=0.95)
        part.prism(V(0.114, 1.842, pk.HEAD_Z - 0.008), V(0.186, 1.868, pk.HEAD_Z - 0.032),
                   0.026, 0.004, 3, 'skin', up=Y, cap_start=False, cap_end=False, ao=-0.04)
        t_base = V(0.048, 1.766, pk.head_front_z(shape, 1.766) + 0.002)
        part.prism(t_base, t_base + V(0.010, 0.056, 0.018), 0.013, 0.003, 4, 'accent', up=X, cap_start=False, ao=0.14)
    part.plate(V(0, 1.772, pk.head_front_z(shape, 1.772) + 0.001), Z, Y, 0.090, 0.016, 0.005, 'hair', shrink=0.95, ao=-0.4)


def head_troll(part):
    part.skin = pk.SKIN_HEAD
    # Small skull, heavy brow and a wide jaw that juts out past the upper lip (underbite).
    shape = pk.TROLL_HEAD_SHAPE
    part.loft([pk.head_ring(shape, pk.HEAD_Y[k]) for k in pk.HEAD_STATION_KEYS], 'skin', cap_start=True, cap_end=True)
    front = lambda height: pk.head_front_z(shape, height)  # noqa: E731
    # Long hooked nose.
    nz = front(1.84)
    part.tube([V(0, 1.880, nz - 0.006), V(0, 1.836, nz + 0.058), V(0, 1.782, nz + 0.050)],
              [0.022, 0.027, 0.010], 4, 'skin', up=X, cap_start=False, cap_end=True, ao=-0.06)
    # One brow ridge that points down at the centre (scowl). It puts the eyes in shade.
    bz = front(1.895) - 0.006
    part.slab([V(0.104, 1.920, bz), V(0.106, 1.892, bz), V(0, 1.866, bz + 0.004), V(-0.106, 1.892, bz),
               V(-0.104, 1.920, bz), V(0, 1.926, bz)], 0.026, 'skin', normal=Z, shrink=0.88, ao=-0.07)
    # Mouth gash under the nose and the lower lip of the underbite.
    part.plate(V(0, 1.772, front(1.772) - 0.002), Z, Y, 0.104, 0.014, 0.004, 'hair', shrink=0.9, ao=-0.4)
    part.box(V(0, 1.744, front(1.744) - 0.006), (0.136, 0.034, 0.030), 'skin', taper=0.84, ao=-0.04)
    with part.mirrored():
        spike(part, V(0.048, 1.858, front(1.858) - 0.004), V(0.048, 1.858, front(1.858) + 0.008), 0.017, 'accent',
              n=4, flat=0.6, up=Y, ao=0.2)
        # Long drooping ear.
        spike(part, V(0.098, 1.846, pk.HEAD_Z - 0.012), V(0.262, 1.872, pk.HEAD_Z - 0.066), 0.040, 'skin', n=4,
              flat=0.4, up=Y, ao=-0.04)
        # Lower tusk that curves up past the lip.
        base = V(0.060, 1.750, front(1.750) - 0.008)
        part.tube([base, base + V(0.014, 0.046, 0.026)], [0.017, 0.012], 3, 'accent', up=X,
                  tip_end=base + V(0.004, 0.108, 0.016), ao=0.12)
    # Three tufts of a ragged crest (tagged 'hair' so hidesHair headwear hides them cleanly) and a chin tuft.
    with part.tagged('hair'):
        for z_offset, height, lean in ((0.050, 0.085, 0.020), (-0.006, 0.110, 0.045), (-0.062, 0.080, 0.070)):
            spike(part, V(0, 1.962, pk.HEAD_Z + z_offset), V(0, 1.962 + height, pk.HEAD_Z + z_offset - lean), 0.030, 'hair',
                  n=3, flat=0.55, up=Z)
    spike(part, V(0, 1.716, front(1.716) - 0.034), V(0, 1.628, front(1.716) + 0.012), 0.030, 'hair', n=3, flat=0.6, up=Z)


def hair_orc_mohawk(part, shape=pk.HEAD_ENVELOPE):
    part.skin = pk.SKIN_HEAD
    part.covers = ['hair']
    top_y = pk.HEAD_Y['crown']
    for i, (z_off, h) in enumerate(((0.06, 0.075), (0.01, 0.095), (-0.04, 0.088), (-0.09, 0.070))):
        part.prism(V(0, top_y - 0.012, pk.HEAD_Z + z_off), V(0, top_y + h, pk.HEAD_Z + z_off - 0.012),
                   0.026, 0.004, 4, 'hair', up=Z, ao=0.04 if i == 1 else -0.02)
    # Back ponytail braid + brass ring anchored to skull back surface
    back_z = pk.HEAD_Z - pk.head_section(shape, 1.84)[2] * pk.HEAD_PLANE
    part.prism(V(0, 1.84, back_z + 0.01), V(0, 1.82, back_z - 0.028), 0.026, 0.022, 6, 'accent', up=X)
    part.tube([V(0, 1.82, back_z - 0.022), V(0, 1.72, back_z - 0.068), V(0, 1.56, back_z - 0.045)],
              [0.024, 0.030, 0.006], 5, 'hair', up=X, cap_end=True)


def torso_orc_harness(part, body):
    b = body
    # Leave muscular arms bare under the bracers; cover torso chest and trouser waistband.
    part.covers = ['chest', 'legs_waist']
    torso_stack(part, b, [('hips', 0.012, {'y': 1.07}), ('belt', 0.015),
                          ('ribs', 0.016), ('chest', 0.018), ('shoulder', 0.016),
                          ('neck_base', 0.014, {'skin': SKIN_NECK})], 'primary',
                cap_end=True,
                band_regions=['secondary', 'primary', 'primary', 'secondary', 'secondary'],
                band_ao=[-0.06, -0.02, 0.02, -0.04, -0.06])
    belt(part, b, 1.135, 0.015, 0.066, 'secondary', bulge=0.006, flat=False)
    torso_plate(part, b, 1.135, 2, 0.040, 0.076, 0.060, 0.016, 'metal', corner=0.014)
    # Forged chest plate with a spiked boss.
    torso_plate(part, b, 1.425, 2, 0.040, 0.104, 0.100, 0.016, 'metal', shrink=0.74, corner=0.022, ao=0.04)
    boss = pk.facet(pk.torso_ring(b, 1.425, 0.052), 2)[0]
    with part.skinned(pk.SKIN_TORSO), part.anchored(pk.facet(pk.torso_ring(b, 1.425), 2)[0]):
        spike(part, boss, boss + V(0, 0.006, 0.062), 0.026, 'metal', n=4, up=Y, ao=0.1)
    # Studded leather strap from the left shoulder to the right hip (follows ribs & chest stations).
    strap = [('front', 1.215, -0.70, 0.026), ('front', 1.355, -0.20, 0.029),
             ('front', 1.465, 0.21, 0.034), ('front', 1.548, 0.52, 0.029)]
    torso_strap(part, b, strap, 'secondary', half=0.024, thick=0.012, ao=-0.08)
    with part.skinned(pk.SKIN_TORSO):
        for height, fraction in ((1.262, -0.55), (1.355, -0.20), (1.515, 0.40)):
            with part.anchored(torso_at(b, height, fraction)):
                spike(part, torso_at(b, height, fraction, 0.038), torso_at(b, height, fraction, 0.062), 0.015, 'metal',
                      n=3, up=Y, ao=0.1)
    with part.mirrored():
        arm_stack(part, b, [(4.12, 0.002), (4.85, 0.016), (5.75, 0.002)],
                  'secondary', band_regions=['secondary', 'metal'],
                  band_ao=[-0.04, -0.08])
        # Layered pauldron. Starts inward on the collar and uses two_sided=True so no gap opens under the arm.
        with part.skinned(SKIN_PAULDRON_ORC_L):
            plates = [pk.arm_ring(b, 0.35, 0.022), pk.arm_ring(b, 1.15, 0.036), pk.arm_ring(b, 1.85, 0.024)]
            part.loft(plates, 'metal', band_regions=['metal', 'secondary'], band_ao=[0.04, -0.08],
                      two_sided=True, thickness=0.006, inner_ao=-0.22)
            top = pk.facet(plates[1], 1, axis=X)[0]
            spike(part, top - V(0, 0.016, 0), top + V(0.050, 0.118, 0.006), 0.030, 'accent', n=4, up=Z, ao=0.1)
            spike(part, top - V(0.050, 0.016, 0.02), top + V(-0.030, 0.074, -0.030), 0.020, 'accent', n=3, up=Z, ao=0.1)


def torso_troll_hide(part, body):
    b = body
    # A one-shoulder hide + belt. Belly/chest stay bare, while legs_waist hides trouser belt buckles under our belt.
    part.covers = ['legs_waist']
    shoulder, neck = b.torso['shoulder'].y, b.torso['neck_base'].y

    # 1. Hide yoke: low on the left ribs, high on the right shoulder, with narrowed lateral flare under the pauldron.
    spec = [
        (1.372, 0.038, -0.125, {'widen': -0.030, 'front': 0.010, 'back': 0.008}),
        (1.405, 0.038, -0.125, {'widen': -0.038, 'front': 0.012, 'back': 0.008}),
        (1.500, 0.044, -0.045, {'widen': -0.042, 'front': 0.012, 'back': 0.008}),
        (shoulder, 0.040, 0.0, {'widen': -0.036, 'front': 0.010, 'back': 0.008}),
        (neck, 0.032, 0.0, {}),
    ]
    rings = [tilted_torso_ring(b, height, grow, tilt, **opts) for height, grow, tilt, opts in spec]
    refs = [tilted_torso_ring(b, height, 0.0, tilt) for height, _, tilt, _ in spec]
    with part.skinned(pk.SKIN_TORSO):
        part.loft(rings, 'primary', refs=refs, ring_skins=[None, None, None, None, SKIN_NECK],
                  band_regions=['hair', 'primary', 'primary', 'primary'], band_ao=[0.06, -0.04, 0.0, -0.06])
        # Fur tufts that hang from the hem on the left side (front, side and back).
        for column, drop in ((2, 0.060), (1, 0.085), (0, 0.100), (9, 0.085), (8, 0.060)):
            hem, inner = rings[0][column], refs[0][column]
            out = V(hem.x - inner.x, 0, hem.z - inner.z).normalized()
            with part.anchored(inner):
                spike(part, hem + V(0, 0.022, 0) - out * 0.012, hem + out * 0.026 - V(0, drop, 0), 0.040, 'hair', n=3,
                      flat=0.5, up=out, ao=-0.06)

    # 2. Fur pauldron on the left shoulder, with three tufts on its rim.
    with part.skinned(SKIN_PAULDRON_L):
        cap = [pk.arm_ring(b, 0.88, 0.034), pk.arm_ring(b, 1.38, 0.046), pk.arm_ring(b, 1.85, 0.032)]
        part.loft(cap, 'hair', band_ao=[0.06, -0.06], cap_start=True, cap_end=True)
        crown = pk.facet(cap[1], 1, axis=X)[0]
        for dx, dz in ((-0.030, 0.040), (0.040, -0.030)):
            spike(part, crown + V(dx, -0.016, dz), crown + V(dx + 0.050, 0.070, dz * 1.6), 0.040, 'hair', n=3, flat=0.55,
                  up=Z, ao=0.04)
        centre = pk.centroid(cap[2])
        for column in (0, 1, 2):
            rim = cap[2][column]
            out = (rim - centre).normalized()
            spike(part, rim - V(0.034, 0, 0) - out * 0.014, rim + V(0.080, -0.020, 0) + out * 0.024, 0.038, 'hair',
                  n=3, flat=0.5, up=out, ao=-0.1)

    # 3. Leather cross-strap: right hip, over the chest, over the left shoulder, down the back.
    torso_strap(part, b, [('front', 1.200, -0.66, 0.012), ('front', 1.330, -0.26, 0.016), ('front', 1.455, 0.22, 0.046),
                          ('front', 1.535, 0.50, 0.050), ('front', shoulder, 0.54, 0.050), ('top', shoulder, 0.56, 0.046),
                          ('back', shoulder, 0.48, 0.050), ('back', 1.500, 0.44, 0.050),
                          ('back', 1.360, -0.08, 0.016), ('back', 1.200, -0.62, 0.012)], 'secondary')
    # Forged iron ring where the strap crosses the chest, and two rivets.
    with part.skinned(pk.SKIN_TORSO):
        with part.anchored(torso_at(b, 1.330, -0.26)):
            part.plate(torso_at(b, 1.330, -0.26, 0.026), Z, Y, 0.082, 0.082, 0.014, 'metal', corner=0.024, shrink=0.8,
                       ao=0.05)
            part.plate(torso_at(b, 1.330, -0.26, 0.040), Z, Y, 0.036, 0.036, 0.004, 'secondary', shrink=0.8, ao=-0.3)
            # Bone talismans that hang from the ring.
            for dx, drop in ((-0.022, 0.092), (0.020, 0.074)):
                top = torso_at(b, 1.300, -0.26, 0.030) + V(dx, 0, 0)
                spike(part, top, top + V(dx * 0.6, -drop, 0.006), 0.014, 'accent', n=3, up=Z, ao=0.1)
        for height, fraction, grow in ((1.455, 0.22, 0.058), (1.232, -0.56, 0.024)):
            with part.anchored(torso_at(b, height, fraction)):
                spike(part, torso_at(b, height, fraction, grow), torso_at(b, height, fraction, grow + 0.022), 0.015,
                      'metal', n=4, up=Y, ao=0.1)

    # 4. Belt with an iron buckle and a hide pouch on the right hip.
    belt(part, b, 1.135, 0.026, 0.060, 'secondary', flat=False)
    torso_plate(part, b, 1.135, 2, 0.038, 0.064, 0.056, 0.016, 'metal', corner=0.016)
    centre, normal, _ = pk.facet(pk.torso_ring(b, 1.095, 0.038), 4)
    with part.skinned(pk.SKIN_TORSO), part.anchored(pk.facet(pk.torso_ring(b, 1.125), 4)[0]):
        part.box(centre + normal * 0.024, (0.080, 0.096, 0.050), 'primary', right=Y.cross(normal), taper=0.84, ao=-0.06)
        part.plate(centre + normal * 0.050 + V(0, 0.026, 0), normal, Y, 0.086, 0.040, 0.008, 'secondary', shrink=0.86)

    with part.mirrored():
        # Strapped bicep band with a bone stud, and a forearm wrap.
        arm_stack(part, b, [(2.10, 0.010), (2.34, 0.026), (2.58, 0.010)], 'secondary', band_ao=[-0.02, -0.08])
        stud, normal, _ = pk.facet(pk.arm_ring(b, 2.34, 0.020), 1, axis=X)
        with part.skinned(pk.SKIN_ARM_L), part.anchored(pk.facet(pk.arm_ring(b, 2.34), 1, axis=X)[0]):
            spike(part, stud, stud + normal * 0.050, 0.018, 'accent', n=3, up=X, ao=0.1)
        arm_stack(part, b, [(4.1, 0.014), (5.0, 0.022), (6.0, 0.016)], 'secondary', band_ao=[-0.02, -0.09])


def legs_orc_kilt(part, body):
    b = body
    part.covers = ['pelvis', 'thigh', 'shin', 'foot']
    pelvis_shell(part, b, 'secondary', grow=0.012, ao=-0.06)
    # Split left/right war-kilt tasset panels wrapping the thighs + compact upper front loin tab.
    kilt_rings = [
        pk.skirt_tail_ring(b, 1.135, torso_grow=0.024, torso_weight=1.0, back_x=0.012, front_x=0.016),
        pk.skirt_tail_ring(b, 0.985, clearance=0.024, torso_grow=0.026, back_x=0.014, front_x=0.018, torso_weight=0.30),
        pk.skirt_tail_ring(b, 0.815, clearance=0.025, torso_grow=0.028, back_x=0.016, front_x=0.020, torso_weight=0.0),
    ]
    kilt_skins = [pk.skirt_skin(1.0), pk.skirt_skin(0.30), pk.skirt_skin(0.0)]
    with part.mirrored():
        part.loft(kilt_rings, 'primary', ring_skins=kilt_skins, closed=False,
                  band_ao=[0.0, -0.05], two_sided=True, thickness=0.005, inner_ao=-0.22)
    tab_top = [V(0.044, 1.135, pk.torso_surface_z(b, 1.135, 0.044, 0.026)),
               V(-0.044, 1.135, pk.torso_surface_z(b, 1.135, -0.044, 0.026))]
    tab_bot = [V(0.048, 0.985, pk.torso_surface_z(b, 0.985, 0.048, 0.044) + 0.020),
               V(-0.048, 0.985, pk.torso_surface_z(b, 0.985, -0.048, 0.044) + 0.020)]
    with part.skinned(pk.SKIN_TORSO):
        part.loft([tab_top, tab_bot], 'secondary', closed=False, toward=Z,
                  ring_skins=[pk.SKIN_TORSO, pk.Skin(allowed=('thigh_l', 'thigh_r'), blend={'pelvis': 0.25})],
                  two_sided=True, thickness=0.005, inner_ao=-0.22)
    with part.mirrored():
        leg_stack(part, b, [(0, 0.014), (2.4, 0.014), (3.65, 0.024), (5, 0.020)],
                  'skin', band_regions=['skin', 'secondary', 'metal'])
        pk.build_foot(part, b, 'secondary', grow=0.015, sole=0.016, sole_region='metal', ao=-0.06)


def legs_troll_wraps(part, body):
    b = body
    part.covers = ['pelvis', 'thigh']
    pelvis_shell(part, b, 'primary', grow=0.012, ao=-0.06)
    # Layer 1: split left/right ragged hide tassets with a pointed fur V-hem on the outer thigh.
    r0 = pk.skirt_tail_ring(b, 1.115, torso_grow=0.030, torso_weight=1.0, back_x=0.014, front_x=0.016)
    r1 = pk.skirt_tail_ring(b, 0.985, clearance=0.040, torso_grow=0.044, back_x=0.016, front_x=0.018, torso_weight=0.15)
    r2_base = pk.skirt_tail_ring(b, 0.800, clearance=0.042, torso_grow=0.052, back_x=0.018, front_x=0.020, torso_weight=0.0)
    v_drops = (0.04, -0.02, -0.075, -0.03, 0.04)  # lower ragged point over outer-front thigh
    r2 = [V(pt.x, pt.y + dy, pt.z) for pt, dy in zip(r2_base, v_drops)]
    with part.mirrored():
        part.loft([r0, r1, r2], 'primary',
                  ring_skins=[pk.skirt_skin(1.0), pk.skirt_skin(0.15), pk.skirt_skin(0.0)],
                  closed=False, band_regions=['primary', 'hair'], band_ao=[-0.04, 0.05],
                  two_sided=True, thickness=0.005, inner_region='secondary', inner_ao=-0.20)
    # Layer 2: compact high-cut front leather apron + stitched bone talismans (moves with thighs during crouch/sit).
    apron_top = [torso_at(b, 1.125, fraction, 0.040) for fraction in (0.30, 0.0, -0.30)]
    apron_bot = [
        torso_at(b, 1.005, 0.34, 0.054) + V(0, 0, 0.022),
        torso_at(b, 0.975, 0.0, 0.056) + V(0, 0, 0.024),
        torso_at(b, 1.005, -0.34, 0.054) + V(0, 0, 0.022),
    ]
    with part.skinned(pk.SKIN_TORSO):
        part.loft([apron_top, apron_bot], 'secondary', closed=False, toward=Z,
                  ring_skins=[pk.SKIN_TORSO, pk.Skin(allowed=('thigh_l', 'thigh_r'), blend={'pelvis': 0.30})],
                  two_sided=True, thickness=0.005, inner_ao=-0.22)
        # Stitched bone talismans high on the apron so they never dip into sitting thighs.
        for fraction in (-0.18, 0.18):
            with part.anchored(torso_at(b, 1.08, fraction)):
                centre = torso_at(b, 1.065, fraction, 0.064)
                part.loft([pk.ring(centre, X, Z, 0.013, 0.011, 4)], 'accent', tip_start=centre + V(0, 0.036, -0.004),
                          tip_end=centre - V(0, 0.040, -0.006), ao=0.08)
    with part.mirrored():
        # Bare thighs, then layered shin wraps.
        leg_stack(part, b, [(0, 0.010), (1, 0.012), (2.4, 0.010), (3.2, 0.022), (4.6, 0.022), (5.0, 0.012)],
                  'skin', band_regions=['skin', 'skin', 'secondary', 'primary', 'secondary'],
                  band_ao=[0, 0, -0.04, 0.02, -0.1])
        # Three bone claws on each foot (raised cleanly above toe swing arc).
        with part.skinned(pk.SKIN_FOOT_L):
            for sx in (-0.028, 0.0, 0.028):
                base = V(pk.ANKLE.x + sx, 0.032, 0.148)
                spike(part, base, base + V(sx * 0.25, 0.004, 0.028), 0.012, 'accent', n=3, up=Y, ao=0.06)


def headwear_orc_horned(part, shape=pk.HEAD_ENVELOPE):
    part.skin = pk.SKIN_HEAD
    rim = pk.HEAD_Y['brow'] - 0.008
    pk.head_shell(part, 'metal', 0.028, front=rim, temple=rim, side=rim - 0.02, back=rim - 0.03,
                  top_lift=0.014, flare=0.012, shape=shape)
    # Iron nose guard
    part.plate(V(0, rim - 0.018, pk.head_front_z(shape, rim, 0.028) + 0.008), Z, Y, 0.026, 0.088, 0.010, 'metal')
    # Twin curved bull horns anchored to the expanded helmet side wall
    side_x = pk.head_side_x(shape, rim + 0.045, 0.022) - 0.008
    with part.mirrored():
        path = [V(side_x, rim + 0.045, pk.HEAD_Z), V(side_x + 0.092, rim + 0.075, pk.HEAD_Z + 0.025),
                V(side_x + 0.127, rim + 0.165, pk.HEAD_Z + 0.065), V(side_x + 0.092, rim + 0.240, pk.HEAD_Z + 0.090)]
        part.tube(path, [0.032, 0.026, 0.016, 0.004], 5, 'accent', up=Z, cap_start=True, cap_end=True, ao=0.1)


def back_orc_trophy(part, body):
    b = body
    back_z = pk.torso_surface_z(b, 1.44, 0.0, 0.036, 'back')
    # The rack is narrow at bind time: a wide-shouldered orc scales the upper spine in X at run time.
    with part.skinned(SKIN_BACK), part.anchored(pk.torso_point(b, 1.44, 0.0, 0.0, 'back')):
        part.box(V(0, 1.44, back_z - 0.026), (0.250, 0.050, 0.044), 'primary', bevel=0.008)
        with part.mirrored():
            base, top = V(0.082, 1.250, back_z - 0.030), V(0.146, 1.800, back_z - 0.108)
            part.tube([base, top], [0.019, 0.015], 5, 'primary', up=Z, cap_start=True, cap_end=False)
            # Leather lashing where the pole crosses the bar.
            cross = base + (top - base) * ((1.44 - base.y) / (top.y - base.y))
            part.box(cross, (0.052, 0.056, 0.050), 'secondary', ao=-0.06)
            # Trophy skull that looks back, with a dark eye band and an iron spike.
            skull = top + V(0, 0.030, 0)
            part.box(skull, (0.084, 0.088, 0.088), 'accent', bevel=0.014, taper=0.86)
            part.plate(skull + V(0, 0.006, -0.044), -Z, Y, 0.062, 0.022, 0.004, 'secondary', shrink=0.9, ao=-0.4)
            spike(part, skull + V(0, 0.036, 0), skull + V(0.012, 0.150, -0.022), 0.017, 'metal', n=4, up=Z, ao=0.08)


def held_orc_cleaver(part):
    # Canonical grip frame: handle +Y, blade edge +Z.
    part.tube([V(0, -0.10, 0), V(0, 0.11, 0)], [0.022, 0.020], 6, 'secondary', up=Z, cap_start=True, ao=-0.06)
    part.lathe([(0.016, -0.14), (0.038, -0.11), (0.022, -0.09)], 6, 'accent', cap_start=True)
    part.box(V(0, 0.13, 0.012), (0.046, 0.038, 0.150), 'metal', taper=(0.8, 0.86))
    # Forged blade: a thick spine that tapers to a bevel line, then a bright honed edge with two notches.
    #          y,     spine z, bevel z, edge z, half thickness
    stations = ((0.150, -0.030, 0.085, 0.118, 0.012),
                (0.270, -0.040, 0.128, 0.170, 0.013),
                (0.360, -0.044, 0.108, 0.136, 0.013),
                (0.470, -0.046, 0.168, 0.214, 0.012),
                (0.560, -0.038, 0.150, 0.186, 0.011),
                (0.650, 0.010, 0.120, 0.150, 0.008))
    tip = V(0, 0.735, 0.090)
    body = [[V(t * 0.45, y, bevel), V(t, y, spine), V(-t, y, spine), V(-t * 0.45, y, bevel)]
            for y, spine, bevel, edge, t in stations]
    part.loft(body, 'metal', closed=False, cap_start=True, tip_end=tip, ao=-0.12)
    edge = [[V(-t * 0.45, y, bevel), V(0, y, edge), V(t * 0.45, y, bevel)] for y, spine, bevel, edge, t in stations]
    part.loft(edge, 'metal', closed=False, tip_end=tip, ao=0.2)
    # Dark fuller groove on each flat, and a hook on the spine.
    for side in (1, -1):
        part.plate(V(side * 0.0125, 0.400, 0.040), X * side, Y, 0.040, 0.300, 0.003, 'secondary', shrink=0.7, ao=-0.3)
    spike(part, V(0, 0.560, -0.030), V(0, 0.640, -0.105), 0.022, 'metal', n=4, flat=0.4, up=X, ao=-0.06)


def held_troll_club(part):
    # Canonical grip frame: handle along +Y. A heavy wooden club with rope lashing, two iron bands and iron spikes.
    part.tube([V(0, -0.14, 0), V(0, 0.24, 0), V(0, 0.46, 0.004), V(0, 0.66, 0.006), V(0, 0.84, 0.0)],
              [0.024, 0.030, 0.070, 0.100, 0.070], 6, 'primary', up=Z, cap_start=True, cap_end=True,
              band_ao=[-0.08, -0.02, 0.0, -0.04])
    # Pommel knob and leather grip wrap.
    part.lathe([(0.020, -0.180), (0.040, -0.150), (0.026, -0.124)], 6, 'secondary', cap_start=True, ao=-0.06)
    part.lathe([(0.028, -0.085), (0.035, -0.010), (0.030, 0.105)], 6, 'secondary', band_ao=[-0.04, -0.1])
    # Rope lashing at the neck of the club.
    part.lathe([(0.048, 0.300), (0.064, 0.350), (0.060, 0.400)], 6, 'accent', center=(0, 0, 0.003),
               band_ao=[-0.12, -0.04])
    # Two forged iron bands with a row of spikes on each.
    for low, high, radius, turn in ((0.500, 0.566, 0.092, 0.0), (0.690, 0.756, 0.106, 45.0)):
        part.lathe([(radius - 0.012, low), (radius + 0.002, (low + high) / 2), (radius - 0.010, high)], 6,
                   'metal', center=(0, 0, 0.005), band_ao=[-0.04, 0.06])
        for index in range(4):
            angle = math.radians(turn + index * 90.0)
            out = V(math.cos(angle), 0.0, math.sin(angle))
            middle = V(0, (low + high) / 2, 0.005)
            spike(part, middle + out * (radius - 0.018), middle + out * (radius + 0.090) + V(0, 0.012, 0), 0.026,
                  'metal', n=3, up=Y, ao=0.08)


def held_spiked_buckler(part):
    # Left hand: +X is the back of the hand. The disc axis is +X.
    offset, centre = 0.218, 0.050
    turn = Matrix(((0, 1, 0, offset), (0, 0, 1, 0), (1, 0, 0, centre), (0, 0, 0, 1)))
    with part.placed(turn):
        # Wooden disc, forged iron rim, iron boss with a long spike.
        part.lathe([(0.136, 0.0), (0.128, 0.030)], 8, 'primary', cap_start=True, cap_end=True, ao=-0.04)
        part.lathe([(0.132, -0.004), (0.152, 0.012), (0.128, 0.030)], 8, 'metal', band_ao=[-0.08, 0.06])
        part.lathe([(0.064, 0.032), (0.052, 0.062)], 6, 'metal', tip_end=V(0, 0.145, 0), ao=0.06)
        # Four iron spikes on the wood.
        for index in range(4):
            angle = math.radians(45 + index * 90)
            out = V(math.cos(angle), 0, math.sin(angle))
            spike(part, out * 0.096 + V(0, 0.024, 0), out * 0.108 + V(0, 0.088, 0), 0.022, 'metal', n=3, up=out,
                  ao=0.08)
    part.tube([V(0, -0.075, 0), V(0, 0.075, 0)], [0.016, 0.016], 4, 'secondary', up=Z)
    for height in (0.082, -0.082):
        part.box(V(offset / 2, height, 0), (offset, 0.024, 0.032), 'secondary', ao=-0.1)


# --------------------------------------------------------------------------
# Monster World Props (3D/monsters)
# --------------------------------------------------------------------------

def prop_orc_totem(part):
    # Prop palette roles: skin = stone, primary = wood, secondary = dark paint, accent = bone and rope, metal = iron,
    # hair = moss and feathers.
    part.lathe([(0.340, 0.0), (0.300, 0.110), (0.235, 0.110), (0.190, 0.230)], 6, 'skin', cap_start=True,
               band_ao=[-0.04, 0.06, -0.02])
    # Carved pole: three wood blocks with iron bands in the notches between them.
    pole = [(0.112, 0.200), (0.122, 0.560), (0.098, 0.590), (0.098, 0.640), (0.132, 0.670), (0.132, 1.020),
            (0.098, 1.050), (0.098, 1.100), (0.118, 1.130), (0.104, 1.900), (0.086, 2.180)]
    part.lathe(pole, 6, 'primary', cap_end=True,
               band_regions=['primary', 'primary', 'metal', 'primary', 'secondary', 'primary', 'metal', 'primary',
                             'primary', 'primary'],
               band_ao=[-0.04, -0.1, 0.04, -0.1, 0.0, -0.1, 0.04, -0.1, 0.0, -0.04])
    # War face on the painted block: bone eyes, a brow bar and three teeth.
    for side in (1, -1):
        part.plate(V(side * 0.048, 0.900, 0.112), Z, V(-side * 0.3, 1, 0), 0.050, 0.030, 0.012, 'accent', shrink=0.8, ao=0.14)
    part.plate(V(0, 0.958, 0.112), Z, Y, 0.150, 0.026, 0.020, 'primary', shrink=0.9, ao=0.04)
    for x in (-0.042, 0.0, 0.042):
        spike(part, V(x, 0.800, 0.108), V(x, 0.720, 0.128), 0.018, 'accent', n=3, up=Z, ao=0.1)
    # Crossbar with rope lashing, bone charms and moss feathers.
    part.tube([V(-0.450, 1.560, 0.0), V(0.450, 1.560, 0.0)], [0.050, 0.050], 6, 'primary', up=Y, cap_start=True,
              cap_end=True, ao=-0.04)
    part.lathe([(0.108, 1.470), (0.128, 1.500), (0.128, 1.620), (0.106, 1.650)], 6, 'accent', band_ao=[-0.14, -0.04, -0.14])
    for side in (1, -1):
        part.tube([V(side * 0.300, 1.560, 0), V(side * 0.380, 1.560, 0)], [0.062, 0.062], 6, 'accent', up=Y, ao=-0.1)
        for x, drop, region, flat in ((0.290, 0.250, 'accent', 1.0), (0.345, 0.330, 'hair', 0.3), (0.400, 0.210, 'accent', 1.0)):
            spike(part, V(side * x, 1.530, 0.004), V(side * (x + 0.012), 1.530 - drop, 0.020), 0.030 if flat < 1 else 0.022,
                  region, n=4, flat=flat, up=Z, ao=0.06)
    # Horned beast skull on the top: cranium, jaw, dark sockets and two horns with dark tips.
    part.box(V(0, 2.300, 0.020), (0.270, 0.230, 0.260), 'accent', taper=0.80, bevel=0.030, ao=0.04)
    part.box(V(0, 2.150, 0.080), (0.170, 0.090, 0.200), 'accent', taper=(1.0, 1.2), ao=-0.06)
    for side in (1, -1):
        part.plate(V(side * 0.062, 2.300, 0.150), Z, V(side * 0.3, 1, 0), 0.066, 0.058, 0.006, 'secondary', shrink=0.8, ao=-0.3)
        part.tube([V(side * 0.115, 2.360, 0.010), V(side * 0.270, 2.420, 0.040), V(side * 0.340, 2.560, 0.090)],
                  [0.050, 0.036, 0.018], 5, 'accent', up=Z, tip_end=V(side * 0.300, 2.700, 0.130),
                  band_regions=['accent', 'secondary'], band_ao=[0.04, 0.0])
    spike(part, V(0, 2.245, 0.146), V(0, 2.170, 0.170), 0.026, 'secondary', n=3, up=Z, ao=-0.2)


def prop_spider_egg_sac(part):
    # Prop palette roles: skin = web silk and stone, accent = pale egg sacs, secondary = dark spider legs.
    part.lathe([(0.460, 0.0), (0.410, 0.060), (0.270, 0.120)], 8, 'skin', cap_start=True, cap_end=True,
               band_ao=[-0.06, 0.04])
    # Three faceted sacs. Each has a web band, and each leans a little.
    for x, z, radius, height, lean in ((0.0, -0.040, 0.215, 0.640, 0.0), (-0.215, 0.150, 0.140, 0.420, 14.0),
                                       (0.225, 0.110, 0.155, 0.470, -11.0)):
        base = 0.090
        with part.placed(Matrix.Translation(V(x, base, z)) @ Matrix.Rotation(math.radians(lean), 4, 'Z')):
            part.lathe([(radius * 0.55, 0.0), (radius, height * 0.26), (radius * 1.06, height * 0.52),
                        (radius * 0.82, height * 0.78), (radius * 0.42, height * 0.94)], 8, 'accent',
                       tip_end=V(0, height * 1.06, 0), band_regions=['accent', 'skin', 'accent', 'accent'],
                       band_ao=[-0.1, -0.04, 0.04, 0.08])
    # A hatchling leaves the large sac: a dark tear with three legs.
    part.plate(V(0.060, 0.560, 0.150), V(0.3, 0.3, 1), Y, 0.090, 0.120, 0.006, 'secondary', shrink=0.6, ao=-0.3)
    for dx, dy, dz in ((0.110, 0.130, 0.130), (-0.050, 0.170, 0.150), (0.030, -0.060, 0.190)):
        spike(part, V(0.060, 0.560, 0.150), V(0.060 + dx, 0.560 + dy, 0.150 + dz), 0.016, 'secondary', n=3, up=Y)
    # Silk strands from the ground to the sacs, and a clutch of small eggs.
    for index in range(6):
        angle = math.radians(20 + index * 60)
        foot = V(math.cos(angle) * 0.430, 0.020, math.sin(angle) * 0.430)
        top = V(math.cos(angle) * 0.150, 0.380 + 0.05 * (index % 2), math.sin(angle) * 0.150 - 0.02)
        part.tube([foot, top], [0.020, 0.010], 3, 'skin', up=Y, ao=0.08)
    for x, z, size in ((0.330, -0.160, 0.050), (0.260, -0.250, 0.040), (-0.300, -0.170, 0.046), (-0.120, 0.330, 0.042),
                       (0.060, 0.350, 0.050)):
        centre = V(x, 0.060 + size, z)
        part.loft([pk.ring(centre, X, Z, size, size, 4)], 'accent', tip_start=centre - V(0, size * 1.1, 0),
                  tip_end=centre + V(0, size * 1.3, 0), ao=0.06)


def prop_bone_pile(part):
    # Prop palette roles: skin = earth, accent = bone, secondary = dark sockets.
    part.lathe([(0.440, 0.0), (0.380, 0.050), (0.210, 0.100)], 8, 'skin', cap_start=True, cap_end=True, band_ao=[-0.06, 0.0])

    def bone(start, end, radius):
        start, end = V(*start), V(*end)
        knob = (end - start).normalized() * (radius * 1.5)
        part.tube([start, start + knob, end - knob, end], [radius * 1.7, radius, radius, radius * 1.7], 5, 'accent',
                  up=Y, cap_start=True, cap_end=True, band_ao=[-0.02, 0.04, -0.02])

    bone((-0.340, 0.110, 0.150), (0.160, 0.170, 0.260), 0.022)
    bone((-0.200, 0.120, -0.240), (0.300, 0.150, -0.100), 0.024)
    bone((0.120, 0.110, 0.300), (0.340, 0.250, -0.020), 0.020)
    bone((-0.300, 0.110, -0.060), (-0.060, 0.330, -0.160), 0.020)
    bone((-0.080, 0.150, 0.080), (0.060, 0.560, -0.040), 0.021)
    # Rib cage: four ribs that arc over the pile.
    for index, z in enumerate((-0.160, -0.060, 0.040, 0.140)):
        reach = 0.250 - 0.020 * abs(index - 1.5)
        for side in (1, -1):
            part.tube([V(side * 0.030, 0.150, z), V(side * reach * 0.80, 0.300, z + 0.010),
                       V(side * reach, 0.440, z + 0.030)], [0.020, 0.016, 0.012], 3, 'accent', up=Z,
                      tip_end=V(side * reach * 0.70, 0.560, z + 0.050), ao=0.04)
    # Main skull at the front: cranium, brow, sockets, jaw and teeth.
    with part.placed(Matrix.Translation(V(0.060, 0.230, 0.270)) @ Matrix.Rotation(math.radians(-16), 4, 'X')
                     @ Matrix.Rotation(math.radians(14), 4, 'Y')):
        part.loft([pk.ring(V(0, 0.010, -0.110), X, Y, 0.072, 0.070, 6), pk.ring(V(0, 0.020, -0.020), X, Y, 0.108, 0.100, 6),
                   pk.ring(V(0, 0.010, 0.060), X, Y, 0.100, 0.088, 6), pk.ring(V(0, -0.020, 0.120), X, Y, 0.064, 0.056, 6)],
                  'accent', cap_start=True, cap_end=True, band_ao=[-0.04, 0.04, 0.0])
        part.box(V(0, -0.086, 0.070), (0.110, 0.036, 0.130), 'accent', taper=(1.0, 1.15), ao=-0.08)
        for side in (1, -1):
            part.plate(V(side * 0.044, 0.020, 0.094), V(side * 0.3, 0.2, 1), Y, 0.046, 0.044, 0.005, 'secondary',
                       shrink=0.8, ao=-0.3)
            spike(part, V(side * 0.030, -0.056, 0.118), V(side * 0.032, -0.100, 0.126), 0.012, 'accent', n=3, up=Z, ao=0.1)
        spike(part, V(0, -0.012, 0.122), V(0, -0.046, 0.138), 0.016, 'secondary', n=3, up=Z, ao=-0.2)
    # Small horned skull at the back.
    with part.placed(Matrix.Translation(V(-0.200, 0.200, -0.180)) @ Matrix.Rotation(math.radians(38), 4, 'Y')):
        part.box(V(0, 0, 0), (0.150, 0.130, 0.170), 'accent', bevel=0.020, taper=0.84)
        part.plate(V(0, 0.006, 0.086), Z, Y, 0.110, 0.036, 0.005, 'secondary', shrink=0.86, ao=-0.3)
        for side in (1, -1):
            spike(part, V(side * 0.060, 0.050, -0.010), V(side * 0.170, 0.170, 0.030), 0.026, 'accent', n=4, up=Z, ao=0.06)


def prop_spiked_barricade(part):
    # Prop palette roles: primary = wood, secondary = dark wood, accent = rope, metal = iron.
    # Two X-shaped trestles hold one beam. Each trestle log has a cut point.
    for x in (-0.500, 0.500):
        for lean, low, high in ((24.0, -0.230, 0.180), (-24.0, 0.230, -0.180)):
            part.tube([V(x, 0.0, low), V(x, 0.900, high)], [0.052, 0.042], 5, 'secondary', up=X, cap_start=True,
                      tip_end=V(x, 1.020, high + (0.050 if lean > 0 else -0.050)), ao=-0.02)
        part.tube([V(x - 0.070, 0.470, 0.0), V(x + 0.070, 0.470, 0.0)], [0.096, 0.096], 6, 'accent', up=Y, ao=-0.1)
    part.tube([V(-0.660, 0.470, 0.0), V(0.660, 0.470, 0.0)], [0.074, 0.074], 6, 'primary', up=Y, cap_start=True,
              cap_end=True)
    for x in (-0.250, 0.250):
        part.tube([V(x - 0.035, 0.470, 0.0), V(x + 0.035, 0.470, 0.0)], [0.084, 0.084], 6, 'metal', up=Y, ao=0.04)
    # Five stakes through the beam. They point forward and up, and each has an iron tip.
    for index, x in enumerate((-0.370, -0.125, 0.0, 0.125, 0.370)):
        pitch = 34.0 if index % 2 == 0 else 46.0
        length = 1.060 if index % 2 == 0 else 0.900
        with part.placed(Matrix.Translation(V(x, 0.470, 0.0)) @ Matrix.Rotation(math.radians(pitch), 4, 'X')):
            part.tube([V(0, -0.420, 0), V(0, length - 0.520, 0), V(0, length - 0.420, 0)], [0.046, 0.040, 0.032], 5,
                      'primary', up=Z, cap_start=True, tip_end=V(0, length - 0.220, 0),
                      band_regions=['primary', 'metal'], band_ao=[0.0, 0.06])
    # Rope lashing on the middle stake and a skull trophy on the beam.
    part.tube([V(-0.040, 0.470, 0.0), V(0.040, 0.470, 0.0)], [0.100, 0.100], 6, 'accent', up=Y, ao=-0.08)
    part.box(V(0.250, 0.620, 0.020), (0.130, 0.130, 0.140), 'accent', bevel=0.020, taper=0.84)
    part.plate(V(0.250, 0.630, 0.091), Z, Y, 0.094, 0.032, 0.005, 'secondary', shrink=0.86, ao=-0.3)


# --------------------------------------------------------------------------
# Quadruped: 23-joint Dire Wolf
# --------------------------------------------------------------------------

def build_dire_wolf_mesh(solver):
    """Dire Wolf on the 23-joint quadruped rig.

    Palette roles: primary = coat, secondary = dark mane, legs and tail tip, skin = pale muzzle, chest and inner ear,
    hair = nose and mouth, accent = teeth and claws, metal = eyes (the metal region is the brightest region).
    Each chunk has rigid weights. The joint names have the side inside the name (leg_fl_upper), so `Part.mirrored()`
    cannot rename them: the legs use a loop over both sides.
    """
    part = pk.Part('body_dire_wolf')
    wp = {k: V(*v) for k, v in QUADRUPED_CONTRACT['worldPositions'].items()}
    bone = lambda **weights: pk.rigid(**weights)  # noqa: E731

    def section(centre, rx, up, down, n=8):
        return pk.ring(V(*centre), X, Y, rx, up, n, rv_neg=down, squareness=0.86, phase=math.pi / n)

    # ---- torso: rump, haunch, tucked loin, ribs, deep chest, forechest, neck ------------------------------------
    stations = (
        ((0, 0.630, -0.500), 0.070, 0.070, 0.070, bone(pelvis=1.0)),
        ((0, 0.655, -0.330), 0.165, 0.165, 0.185, bone(pelvis=1.0)),
        ((0, 0.665, -0.100), 0.125, 0.135, 0.115, bone(spine_01=1.0)),
        ((0, 0.690, 0.120), 0.165, 0.165, 0.205, bone(spine_02=1.0)),
        ((0, 0.725, 0.330), 0.195, 0.185, 0.265, bone(chest=1.0)),
        ((0, 0.750, 0.470), 0.150, 0.160, 0.215, bone(chest=0.5, neck=0.5)),
        ((0, 0.815, 0.570), 0.112, 0.120, 0.135, bone(neck=1.0)),
    )
    part.loft([section(c, rx, up, down) for c, rx, up, down, _ in stations], 'primary', cap_start=True, cap_end=True,
              ring_skins=[skin for *_, skin in stations], band_ao=[-0.06, 0.0, 0.02, 0.03, -0.02, -0.04])

    # ---- mane: a collar mass on the neck and three tiers of tufts ------------------------------------------------
    collar = (((0, 0.770, 0.420), 0.185, 0.205, 0.215, bone(chest=1.0)),
              ((0, 0.800, 0.500), 0.178, 0.200, 0.200, bone(chest=0.4, neck=0.6)),
              ((0, 0.850, 0.580), 0.120, 0.128, 0.120, bone(neck=1.0)))
    part.loft([section(c, rx, up, down) for c, rx, up, down, _ in collar], 'secondary',
              ring_skins=[skin for *_, skin in collar], band_ao=[-0.04, 0.03])

    def tuft_ring(centre, radius, reach, back, size, angles, region, skin, n=3, ao=-0.04):
        """Tufts around a centre. Each tuft starts on the ring and points out and back (-Z)."""
        with part.skinned(skin):
            for angle in angles:
                out = V(math.cos(math.radians(angle)), math.sin(math.radians(angle)), 0)
                base = V(*centre) + out * radius
                spike(part, base, base + out * reach + V(0, 0, -back), size, region, n=n, flat=0.5, up=Z, ao=ao)

    tuft_ring((0, 0.860, 0.570), 0.080, 0.105, 0.150, 0.066, (90, 38, 142, -8, 188), 'secondary', bone(neck=1.0), n=4)
    tuft_ring((0, 0.800, 0.470), 0.150, 0.100, 0.190, 0.078, (90, 52, 128, 14, 166, -32, 212), 'secondary',
              bone(chest=0.6, neck=0.4), n=4)
    tuft_ring((0, 0.745, 0.340), 0.165, 0.060, 0.200, 0.070, (66, 114, 24, 156), 'primary', bone(chest=1.0), ao=0.02)
    # Pale chest bib: three tufts that hang from the forechest.
    with part.skinned(bone(chest=1.0)):
        part.tube([V(0, 0.640, 0.560), V(0, 0.530, 0.600)], [(0.085, 0.060), (0.060, 0.040)], 4, 'skin', up=Z,
                  tip_end=V(0, 0.420, 0.570), ao=0.04)
        for side in (1, -1):
            spike(part, V(side * 0.085, 0.640, 0.520), V(side * 0.110, 0.455, 0.520), 0.062, 'skin', n=4, flat=0.6, up=Z)
            spike(part, V(side * 0.150, 0.560, 0.380), V(side * 0.165, 0.400, 0.330), 0.050, 'primary', n=3, flat=0.5,
                  up=Z, ao=-0.06)
    # Dorsal ridge down the spine.
    for z, top, joint in ((0.200, 0.875, 'spine_02'), (0.030, 0.825, 'spine_01'), (-0.140, 0.805, 'spine_01'),
                          (-0.300, 0.820, 'pelvis')):
        with part.skinned(bone(**{joint: 1.0})):
            spike(part, V(0, top - 0.030, z + 0.050), V(0, top + 0.062, z - 0.070), 0.050, 'secondary', n=4, flat=0.42,
                  up=Z, ao=-0.02)

    # ---- head: skull, tapered muzzle, brow, eyes, ears, cheek tufts, upper teeth ---------------------------------
    with part.skinned(bone(head=1.0)):
        skull = (((0, 0.915, 0.545), 0.085, 0.085, 0.085), ((0, 0.925, 0.620), 0.126, 0.106, 0.112),
                 ((0, 0.918, 0.715), 0.104, 0.090, 0.094), ((0, 0.898, 0.790), 0.064, 0.052, 0.044),
                 ((0, 0.888, 0.900), 0.051, 0.042, 0.030), ((0, 0.882, 0.992), 0.037, 0.034, 0.022))
        part.loft([section(c, rx, up, down) for c, rx, up, down in skull], 'primary', cap_start=True, cap_end=True,
                  band_regions=['secondary', 'primary', 'primary', 'skin', 'skin'], band_ao=[-0.04, 0.02, 0.0, 0.02, 0.04])
        part.box(V(0, 0.896, 1.004), (0.052, 0.038, 0.036), 'hair', taper=0.8, ao=0.06)
        for side in (1, -1):
            # Glowing eye under a hard brow wedge.
            eye_normal = V(side * 0.80, 0.16, 0.58)
            part.plate(V(side * 0.096, 0.938, 0.700), eye_normal, Y, 0.050, 0.026, 0.008, 'metal', shrink=0.8, ao=0.25)
            part.plate(V(side * 0.084, 0.972, 0.694), V(side * 0.62, 0.55, 0.56), V(-side * 0.42, 0.9, 0), 0.074, 0.020,
                       0.016, 'secondary', shrink=0.86, ao=-0.06)
            # Tall ear with a pale inner face.
            spike(part, V(side * 0.078, 0.990, 0.596), V(side * 0.122, 1.165, 0.560), 0.050, 'primary', n=4, flat=0.36,
                  up=Z)
            spike(part, V(side * 0.082, 1.000, 0.612), V(side * 0.118, 1.120, 0.586), 0.028, 'skin', n=3, flat=0.4,
                  up=Z, ao=-0.1)
            # Two cheek tufts that sweep back from the jaw line.
            spike(part, V(side * 0.100, 0.905, 0.650), V(side * 0.215, 0.865, 0.545), 0.056, 'skin', n=4, flat=0.42, up=Y)
            spike(part, V(side * 0.088, 0.868, 0.670), V(side * 0.170, 0.790, 0.590), 0.046, 'primary', n=3, flat=0.45,
                  up=Y, ao=-0.06)
            # Upper canine and two small teeth.
            spike(part, V(side * 0.034, 0.866, 0.934), V(side * 0.037, 0.796, 0.944), 0.013, 'accent', n=3, up=Z, ao=0.12)
            for z, drop in ((0.872, 0.034), (0.816, 0.030)):
                spike(part, V(side * 0.043, 0.866, z), V(side * 0.045, 0.866 - drop, z + 0.004), 0.009, 'accent', n=3,
                      up=Z, ao=0.1)

    # ---- hinged jaw with a dark mouth floor and lower canines ----------------------------------------------------
    with part.skinned(bone(jaw=1.0)):
        jaw = (((0, 0.836, 0.700), 0.078, 0.030), ((0, 0.826, 0.800), 0.053, 0.026), ((0, 0.830, 0.900), 0.039, 0.020),
               ((0, 0.836, 0.976), 0.027, 0.015))
        part.loft([pk.ring(V(*c), X, Y, rx, ry, 6, squareness=0.85) for c, rx, ry in jaw], 'skin', cap_start=True,
                  cap_end=True, band_ao=[-0.08, -0.02, 0.02])
        part.plate(V(0, 0.851, 0.860), Y, Z, 0.050, 0.170, 0.004, 'hair', shrink=0.8, ao=-0.3)
        for side in (1, -1):
            spike(part, V(side * 0.030, 0.846, 0.952), V(side * 0.033, 0.900, 0.962), 0.011, 'accent', n=3, up=Z, ao=0.12)

    # ---- tail: thick core, dark tip, three tiers of angular tufts ------------------------------------------------
    tail = ((V(0, 0.645, -0.440), 0.058, bone(pelvis=0.5, tail_01=0.5)), (V(0, 0.615, -0.550), 0.088, bone(tail_01=1.0)),
            (wp['tail_02'], 0.104, bone(tail_02=1.0)), (V(0, 0.530, -0.740), 0.098, bone(tail_02=0.5, tail_03=0.5)),
            (wp['tail_03'], 0.076, bone(tail_03=1.0)))
    part.tube([point for point, _, _ in tail], [radius for _, radius, _ in tail], 8, 'primary', up=Y,
              ring_skins=[skin for *_, skin in tail], tip_end=V(0, 0.425, -0.975),
              band_regions=['primary', 'primary', 'secondary', 'secondary'], band_ao=[-0.04, 0.02, 0.0, -0.04])
    for centre, joint, size in ((V(0, 0.610, -0.560), 'tail_01', 0.060), (V(0, 0.560, -0.670), 'tail_02', 0.070),
                                (V(0, 0.505, -0.790), 'tail_03', 0.062)):
        along = V(0, -0.40, -0.92).normalized()
        with part.skinned(bone(**{joint: 1.0})):
            for out in (V(0, 0.92, -0.40), V(0, -0.92, 0.40), V(1, 0, 0), V(-1, 0, 0), V(0.7, 0.65, -0.28),
                        V(-0.7, 0.65, -0.28)):
                out = out.normalized()
                spike(part, centre + out * (size * 0.9), centre + out * (size * 2.0) + along * (size * 2.6), size, 'secondary',
                      n=3, flat=0.5, up=along, ao=-0.02)

    # ---- legs: muscle flares, six-sided limbs, paws with claws ----------------------------------------------------
    for side, tag in ((1, 'l'), (-1, 'r')):
        for front in (True, False):
            name = f'leg_{"f" if front else "b"}{tag}'
            upper, lower, paw = f'{name}_upper', f'{name}_lower', f'{name}_paw'
            u, l, p = wp[upper], wp[lower], wp[paw]
            trunk = 'chest' if front else 'pelvis'
            if front:
                path = [u + V(0, 0.130, 0.0), u + V(0, 0.0, 0.0), u.lerp(l, 0.55), l, l.lerp(p, 0.6),
                        p + V(0, -0.008, 0.010)]
                radii = [(0.066, 0.106), (0.078, 0.104), (0.064, 0.084), (0.050, 0.060), (0.039, 0.045), (0.039, 0.045)]
                flare = [(0.450, 0.800), (0.370, 0.895), (0.235, 0.860), (0.205, 0.650), (0.355, 0.540)]
                flare_x, flare_depth = 0.145, 0.064
                feather = (V(u.x, 0.340, 0.235), V(u.x, 0.265, 0.120))
            else:
                # Hip, thigh mass, stifle bulge to the front, hock, cannon, paw.
                path = [u + V(0, 0.100, 0.020), u + V(0, -0.040, 0.030), V(u.x, 0.470, -0.325), l, l.lerp(p, 0.6),
                        p + V(0, -0.008, 0.010)]
                radii = [(0.072, 0.140), (0.088, 0.152), (0.072, 0.102), (0.043, 0.053), (0.035, 0.041), (0.039, 0.045)]
                flare = [(-0.195, 0.740), (-0.290, 0.835), (-0.425, 0.785), (-0.460, 0.605), (-0.310, 0.520)]
                flare_x, flare_depth = 0.130, 0.058
                feather = (V(u.x, 0.365, -0.445), V(u.x, 0.300, -0.560))
            skins = [bone(**{trunk: 0.5, upper: 0.5}), bone(**{upper: 1.0}), bone(**{upper: 1.0}), bone(**{lower: 1.0}),
                     bone(**{lower: 1.0}), bone(**{paw: 1.0})]
            part.tube(path, radii, 6, 'primary', up=Z, ring_skins=skins, cap_start=True, cap_end=False,
                      band_regions=['primary', 'primary', 'primary', 'secondary', 'secondary'],
                      band_ao=[0.0, 0.02, -0.02, -0.04, -0.08])
            # Faceted shoulder blade or haunch plate on the flank.
            with part.skinned(bone(**{trunk: 0.55, upper: 0.45})):
                part.slab([V(side * flare_x, y, z) for z, y in flare], flare_depth, 'primary',
                          normal=X * side, shrink=0.7, back=True, ao=0.04)
            # Feather tuft on the back of the elbow or the hock.
            with part.skinned(bone(**{(upper if front else lower): 1.0})):
                spike(part, feather[0], feather[1], 0.040, 'secondary', n=3, flat=0.45, up=X)
            with part.skinned(bone(**{paw: 1.0})):
                part.box(V(p.x, p.y - 0.030, p.z + 0.050), (0.098, 0.060, 0.134), 'secondary', bevel=0.013, taper=0.82,
                         ao=0.04)
                for cx in (-0.028, 0.0, 0.028):
                    base = V(p.x, p.y - 0.044, p.z + 0.108) + V(cx, 0, 0)
                    spike(part, base, base + V(cx * 0.25, -0.014, 0.046), 0.013, 'accent', n=3, up=Y, ao=0.1)

    return part.to_mesh(solver)


def wolf_clips():
    p0 = V(*QUADRUPED_CONTRACT['worldPositions']['pelvis'])
    tau = math.tau

    def rot(rx=0.0, ry=0.0, rz=0.0):
        return {'rotation': euler_quat(rx, ry, rz)}

    def pelvis(rx=0.0, ry=0.0, rz=0.0, y=0.0, z=0.0):
        return {'translation': [p0.x, p0.y + y, p0.z + z], 'rotation': euler_quat(rx, ry, rz)}

    def legs(pose, front_l, front_r, hind_l, hind_r):
        """Each leg: (upper, lower, paw) rotation about X. A negative upper angle moves the paw forward."""
        for leg, (upper, lower, paw) in (('fl', front_l), ('fr', front_r), ('bl', hind_l), ('br', hind_r)):
            pose[f'leg_{leg}_upper'] = rot(upper)
            pose[f'leg_{leg}_lower'] = rot(lower)
            pose[f'leg_{leg}_paw'] = rot(paw)
        return pose

    def stride(phase, duty, reach):
        """Paw angle (+ forward) and lift (0 to 1) of one leg. The stance part has a constant ground speed."""
        phase %= 1.0
        if phase < duty:
            return reach * (1.0 - 2.0 * phase / duty), 0.0
        swing = (phase - duty) / (1.0 - duty)
        return reach * (2.0 * ease(swing) - 1.0), math.sin(math.pi * swing)

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
            'pelvis': pelvis(0.020 * math.sin(2 * a), 0.045 * math.sin(a), 0.025 * math.sin(a), y=0.004 + 0.006 * math.cos(2 * a)),
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
        # Four-beat lateral walk: keep paws level with floor in stance and toes-up during swing.
        walk_front_keys = [
            (0.00, {'up': -0.34, 'lo': 0.02, 'pw': 0.28}),
            (0.32, {'up': 0.00, 'lo': 0.10, 'pw': -0.10}),
            (0.64, {'up': 0.34, 'lo': 0.18, 'pw': -0.52}),
            (0.78, {'up': 0.02, 'lo': 1.24, 'pw': -1.08}),
            (0.88, {'up': -0.28, 'lo': 1.02, 'pw': -0.84}),
            (0.95, {'up': -0.38, 'lo': 0.36, 'pw': -0.10}),
            (1.00, {'up': -0.34, 'lo': 0.02, 'pw': 0.28}),
        ]
        walk_hind_keys = [
            (0.00, {'up': -0.34, 'lo': 0.02, 'pw': 0.26}),
            (0.32, {'up': 0.02, 'lo': 0.08, 'pw': -0.10}),
            (0.64, {'up': 0.34, 'lo': 0.16, 'pw': -0.48}),
            (0.80, {'up': -0.06, 'lo': -0.88, 'pw': 0.30}),
            (0.92, {'up': -0.34, 'lo': -0.32, 'pw': 0.16}),
            (1.00, {'up': -0.34, 'lo': 0.02, 'pw': 0.26}),
        ]
        poses = {}
        for leg, offset in (('bl', 0.0), ('fl', 0.25), ('br', 0.5), ('fr', 0.75)):
            keys = walk_front_keys if leg[0] == 'f' else walk_hind_keys
            k = keyed(((u % 1.0) + offset) % 1.0, keys)
            poses[leg] = (k['up'], k['lo'], k['pw'])
        return legs(pose, poses['fl'], poses['fr'], poses['bl'], poses['br'])

    def run_fn(u, _t):
        # Double-suspension rotary gallop:
        # u=0.00 extended flight (concave spine, forward-reaching forelimbs, trailing hindlimbs);
        # u=0.50 collected C-arch (tightly folded elbows under chest, abducted hindlimbs whipping forward).
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
        u_wrap = u % 1.0
        for leg, offset, side, keys in (
            ('fl', -0.09, 1.0, front_keys),
            ('fr', 0.05, -1.0, front_keys),
            ('bl', 0.05, 1.0, hind_keys),
            ('br', -0.06, -1.0, hind_keys),
        ):
            k = keyed((u_wrap + offset) % 1.0, keys)
            pose[f'leg_{leg}_upper'] = rot(k['up'], side * k['aby'], side * k['abz'])
            pose[f'leg_{leg}_lower'] = rot(k['lo'])
            pose[f'leg_{leg}_paw'] = rot(k['pw'])
        return pose

    def attack_fn(u, _t):
        # Coil (0.30), lunge and bite (0.50), follow through (0.62), then a smooth return to the start pose.
        keys = [
            (0.00, {}),
            (0.30, {'z': -0.14, 'y': 0.068, 'pelvis': 0.05, 'chest': 0.06, 'neck': -0.24, 'head': 0.10, 'jaw': 0.42,
                    'front_up': -0.24, 'front_lo': 0.52, 'front_paw': -0.22, 'hind_up': -0.28, 'hind_lo': 0.50, 'hind_paw': -0.18,
                    'tail': -0.22}),
            (0.50, {'z': 0.34, 'y': 0.12, 'pelvis': -0.18, 'chest': -0.10, 'neck': 0.22, 'head': -0.16, 'jaw': 0.80,
                    'front_up': -0.78, 'front_lo': 0.48, 'front_paw': 0.15, 'hind_up': 0.50, 'hind_lo': -0.14,
                    'hind_paw': -0.32, 'tail': 0.45}),
            (0.62, {'z': 0.26, 'y': 0.045, 'pelvis': -0.02, 'chest': 0.06, 'neck': 0.22, 'head': 0.10, 'jaw': 0.02,
                    'front_up': -0.40, 'front_lo': 0.28, 'front_paw': 0.08, 'hind_up': 0.34, 'hind_lo': -0.10, 'hind_paw': -0.22,
                    'tail': 0.20}),
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
        # The rear settles firmly with planted paws on y >= 0 while chest and muzzle lift into a howl.
        rise = ease(u / 0.24) if u < 0.24 else (1.0 if u < 0.76 else 1.0 - ease((u - 0.76) / 0.24))
        sway = math.sin(u * tau * 2.0) * rise
        tremble = math.sin(u * tau * 9.0) * rise
        sink, lean = 0.012 * rise, -0.12 * rise
        arch = -0.09 * rise
        pose = {
            'pelvis': pelvis(lean, y=0.042 * rise - sink, z=-0.02 * rise),
            'spine_02': rot(arch),
            'chest': rot(-0.14 * rise),
            'neck': rot((-0.46 - 0.03 * sway) * rise, 0.04 * sway),
            'head': rot((-0.42 - 0.03 * sway) * rise, 0.03 * sway),
            'jaw': rot(0.10 + (0.42 + 0.05 * tremble) * rise),
            'tail_01': rot(0.30 * rise, 0.08 * sway),
            'tail_02': rot(0.12 * rise, 0.10 * sway),
            'tail_03': rot(0.10 * rise),
        }
        front = (-(lean + arch - 0.14 * rise), 0.0, 0.0)
        hind = (-lean - 0.22 * rise, 0.34 * rise, -0.12 * rise)
        return legs(pose, front, front, hind, hind)

    def death_fn(u, _t):
        # Take a hit (head/neck snap up and back, jaws wide), knees give way, then slam belly-down with splayed limbs.
        keys = [
            (0.00, {'jaw': 0.08}),
            # Phase 1: Impact recoil — jolt back, front lifts, head/neck whip up and back with open jaws; hind knees absorb blow.
            (0.14, {'y': 0.020, 'z': -0.11, 'rx': -0.22, 'ry': -0.14, 'rz': 0.03,
                    's1': -0.07, 's2': -0.08, 'ch': -0.07, 'nk_x': -0.50, 'nk_z': 0.04,
                    'hd_x': -0.36, 'hd_y': -0.10, 'hd_z': 0.06, 'jaw': 0.68, 'tx': 0.25, 'tz': -0.05,
                    'fl_u': -0.26, 'fl_ry': 0.06, 'fl_rz': 0.10, 'fl_l': 0.36, 'fl_p': -0.14,
                    'fr_u': -0.32, 'fr_ry': -0.06, 'fr_rz': -0.12, 'fr_l': 0.42, 'fr_p': -0.16,
                    'bl_u': -0.40, 'bl_ry': 0.12, 'bl_rz': 0.14, 'bl_l': 0.56, 'bl_p': -0.18,
                    'br_u': -0.44, 'br_ry': -0.12, 'br_rz': -0.16, 'br_l': 0.60, 'br_p': -0.20}),
            # Phase 2: Limbs buckle cleanly outward/forward while head whiplashes forward-down from recoil.
            (0.30, {'y': -0.055, 'z': -0.14, 'rx': 0.02, 'ry': -0.09, 'rz': 0.05,
                    's1': 0.04, 's2': 0.05, 'ch': 0.04, 'nk_x': 0.12, 'nk_z': -0.06,
                    'hd_x': 0.10, 'hd_y': -0.04, 'hd_z': -0.05, 'jaw': 0.46, 'tx': 0.22, 'tz': -0.12,
                    'fl_u': -1.32, 'fl_ry': 0.16, 'fl_rz': 0.20, 'fl_l': 0.50, 'fl_p': 0.72,
                    'fr_u': -1.40, 'fr_ry': -0.20, 'fr_rz': -0.22, 'fr_l': 0.34, 'fr_p': 0.96,
                    'bl_u': -1.36, 'bl_ry': 0.22, 'bl_rz': 0.22, 'bl_l': 0.88, 'bl_p': 0.42,
                    'br_u': -1.40, 'br_ry': -0.22, 'br_rz': -0.22, 'br_l': 0.92, 'br_p': 0.42}),
            # Phase 3: Heavy brisket/belly collapse onto floor (upright with subtle cant); limbs splayed naturally on ground.
            (0.54, {'y': -0.340, 'z': -0.18, 'rx': 0.04, 'ry': -0.06, 'rz': 0.09,
                    's1': 0.03, 's2': 0.03, 'ch': 0.03, 'nk_x': 0.48, 'nk_z': -0.13,
                    'hd_x': 0.16, 'hd_y': 0.16, 'hd_z': -0.10, 'jaw': 0.26, 'tx': 0.34, 'tz': -0.24,
                    'fl_u': -1.66, 'fl_ry': 0.24, 'fl_rz': 0.22, 'fl_l': 0.56, 'fl_p': 1.00,
                    'fr_u': -1.72, 'fr_ry': -0.28, 'fr_rz': -0.24, 'fr_l': 0.36, 'fr_p': 1.24,
                    'bl_u': -1.72, 'bl_ry': 0.42, 'bl_rz': 0.28, 'bl_l': 0.96, 'bl_p': 0.66,
                    'br_u': -1.76, 'br_ry': -0.42, 'br_rz': -0.28, 'br_l': 1.00, 'br_p': 0.66}),
            # Phase 4: Brief impact rebound of head & chest.
            (0.67, {'y': -0.322, 'z': -0.18, 'rx': 0.03, 'ry': -0.06, 'rz': 0.09,
                    's1': 0.02, 's2': 0.03, 'ch': 0.02, 'nk_x': 0.40, 'nk_z': -0.12,
                    'hd_x': 0.08, 'hd_y': 0.16, 'hd_z': -0.10, 'jaw': 0.32, 'tx': 0.30, 'tz': -0.22,
                    'fl_u': -1.62, 'fl_ry': 0.24, 'fl_rz': 0.22, 'fl_l': 0.52, 'fl_p': 0.98,
                    'fr_u': -1.68, 'fr_ry': -0.28, 'fr_rz': -0.24, 'fr_l': 0.34, 'fr_p': 1.22,
                    'bl_u': -1.68, 'bl_ry': 0.42, 'bl_rz': 0.28, 'bl_l': 0.92, 'bl_p': 0.64,
                    'br_u': -1.72, 'br_ry': -0.42, 'br_rz': -0.28, 'br_l': 0.96, 'br_p': 0.64}),
            # Phase 5: Limp settled collapse flat on brisket/belly.
            (0.84, {'y': -0.345, 'z': -0.18, 'rx': 0.04, 'ry': -0.06, 'rz': 0.10,
                    's1': 0.03, 's2': 0.03, 'ch': 0.03, 'nk_x': 0.52, 'nk_z': -0.15,
                    'hd_x': 0.18, 'hd_y': 0.18, 'hd_z': -0.12, 'jaw': 0.16, 'tx': 0.36, 'tz': -0.26,
                    'fl_u': -1.68, 'fl_ry': 0.24, 'fl_rz': 0.22, 'fl_l': 0.58, 'fl_p': 1.00,
                    'fr_u': -1.74, 'fr_ry': -0.28, 'fr_rz': -0.24, 'fr_l': 0.38, 'fr_p': 1.24,
                    'bl_u': -1.74, 'bl_ry': 0.42, 'bl_rz': 0.28, 'bl_l': 0.98, 'bl_p': 0.66,
                    'br_u': -1.78, 'br_ry': -0.42, 'br_rz': -0.28, 'br_l': 1.02, 'br_p': 0.66}),
            (1.00, {'y': -0.345, 'z': -0.18, 'rx': 0.04, 'ry': -0.06, 'rz': 0.10,
                    's1': 0.03, 's2': 0.03, 'ch': 0.03, 'nk_x': 0.52, 'nk_z': -0.15,
                    'hd_x': 0.18, 'hd_y': 0.18, 'hd_z': -0.12, 'jaw': 0.16, 'tx': 0.36, 'tz': -0.26,
                    'fl_u': -1.68, 'fl_ry': 0.24, 'fl_rz': 0.22, 'fl_l': 0.58, 'fl_p': 1.00,
                    'fr_u': -1.74, 'fr_ry': -0.28, 'fr_rz': -0.24, 'fr_l': 0.38, 'fr_p': 1.24,
                    'bl_u': -1.74, 'bl_ry': 0.42, 'bl_rz': 0.28, 'bl_l': 0.98, 'bl_p': 0.66,
                    'br_u': -1.78, 'br_ry': -0.42, 'br_rz': -0.28, 'br_l': 1.02, 'br_p': 0.66}),
        ]
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
# Arachnid: 28-joint Giant Spider
# --------------------------------------------------------------------------

def build_giant_spider_mesh(solver):
    """Giant Spider on the 28-joint arachnid rig.

    Palette roles: primary = dark chitin, secondary = armour plates and femur shells, hair = grooves,
    accent = eyes, hourglass marks and leg tips, metal = fangs and knee spurs.
    The joint names have the side inside the name (leg_1_l_coxa), so the legs use a loop over both sides.
    """
    part = pk.Part('body_giant_spider')
    wp = {k: V(*v) for k, v in ARACHNID_CONTRACT['worldPositions'].items()}
    bone = lambda **weights: pk.rigid(**weights)  # noqa: E731

    def section(centre, rx, up, down, n=8):
        return pk.ring(V(*centre), X, Y, rx, up, n, rv_neg=down, squareness=0.86, phase=math.pi / n)

    # ---- cephalothorax with an armoured carapace shield ----------------------------------------------------------
    with part.skinned(bone(body=1.0)):
        shell = (((0, 0.330, -0.100), 0.100, 0.070, 0.070), ((0, 0.345, -0.020), 0.175, 0.110, 0.090),
                 ((0, 0.345, 0.100), 0.185, 0.115, 0.090), ((0, 0.335, 0.200), 0.130, 0.085, 0.075))
        part.loft([section(c, rx, up, down) for c, rx, up, down in shell], 'primary', cap_start=True, cap_end=True,
                  band_ao=[-0.06, 0.02, -0.02])
        part.slab([V(0, 0.444, 0.205), V(0.112, 0.444, 0.105), V(0.104, 0.444, -0.040), V(0, 0.444, -0.095),
                   V(-0.104, 0.444, -0.040), V(-0.112, 0.444, 0.105)], 0.036, 'secondary', normal=Y, shrink=0.66, ao=0.06)
        part.plate(V(0, 0.481, 0.040), Y, Z, 0.026, 0.100, 0.004, 'hair', shrink=0.7, ao=-0.3)
        for side in (1, -1):
            # Two carapace horns on each flank.
            spike(part, V(side * 0.150, 0.415, 0.110), V(side * 0.235, 0.520, 0.070), 0.036, 'secondary', n=3, flat=0.6,
                  up=Z, ao=0.04)
            spike(part, V(side * 0.150, 0.410, -0.010), V(side * 0.220, 0.495, -0.070), 0.030, 'secondary', n=3, flat=0.6,
                  up=Z, ao=0.0)

    # ---- abdomen: banded bulb, hourglass marks, dorsal spines, spinnerets ----------------------------------------
    with part.skinned(bone(abdomen=1.0)):
        bulb = (((0, 0.370, -0.070), 0.090, 0.080, 0.070), ((0, 0.420, -0.200), 0.220, 0.200, 0.160),
                ((0, 0.460, -0.400), 0.290, 0.260, 0.200), ((0, 0.450, -0.580), 0.260, 0.230, 0.190),
                ((0, 0.410, -0.730), 0.150, 0.130, 0.120))
        part.loft([section(c, rx, up, down) for c, rx, up, down in bulb], 'primary', cap_start=True,
                  tip_end=V(0, 0.370, -0.835), band_regions=['primary', 'secondary', 'primary', 'secondary'],
                  band_ao=[-0.06, 0.02, 0.0, -0.06])

        def top(z):
            """Height of the flat top facet of the abdomen at z."""
            for (c0, _, up0, _), (c1, _, up1, _) in zip(bulb, bulb[1:]):
                if c1[2] <= z <= c0[2]:
                    t = (z - c0[2]) / (c1[2] - c0[2])
                    return (c0[1] + up0) + ((c1[1] + up1) - (c0[1] + up0)) * t
            raise ValueError(f'z = {z} is outside the abdomen.')

        def mark(points, depth=0.014):
            outline = [V(x, top(z) - 0.004, z) for x, z in points]
            part.slab(outline, depth, 'accent', shrink=0.78, ao=0.16,
                      normal=pk.polygon_normal(outline) * (1 if pk.polygon_normal(outline).y > 0 else -1))

        # Hourglass on the back: two triangles that meet at the middle, and a small rear mark.
        mark([(-0.096, -0.225), (0.096, -0.225), (0.0, -0.392)])
        mark([(0.0, -0.408), (0.104, -0.570), (-0.104, -0.570)])
        mark([(0.0, -0.600), (0.050, -0.700), (-0.050, -0.700)], depth=0.010)
        for z, lean in ((-0.300, 0.050), (-0.490, 0.085)):
            for side in (1, -1):
                base = V(side * 0.165, top(z) - 0.045, z)
                spike(part, base, base + V(side * 0.075, 0.095, -lean), 0.034, 'secondary', n=3, flat=0.6, up=Z)
        for x, y, reach in ((0.0, 0.345, 0.105), (0.046, 0.385, 0.080), (-0.046, 0.385, 0.080)):
            spike(part, V(x, y, -0.790), V(x * 1.5, y - 0.050, -0.790 - reach), 0.030, 'secondary', n=3, up=Y, ao=-0.06)

    # ---- head: eye cluster, chelicerae with fangs, pedipalps ----------------------------------------------------
    with part.skinned(bone(head=1.0)):
        skull = (((0, 0.335, 0.185), 0.118, 0.080, 0.070), ((0, 0.335, 0.285), 0.126, 0.086, 0.070),
                 ((0, 0.326, 0.350), 0.086, 0.060, 0.054))
        part.loft([section(c, rx, up, down) for c, rx, up, down in skull], 'primary', cap_start=True, cap_end=True,
                  band_ao=[0.02, -0.02])
        for side in (1, -1):
            # Two main eyes on the front, then three smaller eyes up the side of the head.
            part.plate(V(side * 0.034, 0.366, 0.336), V(0, 0.42, 0.9), Y, 0.036, 0.032, 0.010, 'accent', shrink=0.7, ao=0.25)
            for x, y, z, out, size in ((0.074, 0.380, 0.312, V(0.5, 0.6, 0.62), 0.016),
                                       (0.050, 0.412, 0.270, V(0.2, 1.0, 0.25), 0.014),
                                       (0.104, 0.380, 0.262, V(0.9, 0.42, 0.1), 0.013)):
                base = V(side * x, y, z)
                spike(part, base, base + V(side * out.x, out.y, out.z).normalized() * 0.020, size, 'accent', n=4, up=Z,
                      ao=0.25)
            # Chelicera: a thick base segment, then a curved fang with a barb.
            part.tube([V(side * 0.044, 0.312, 0.330), V(side * 0.052, 0.240, 0.404)], [0.042, 0.034], 5, 'secondary', up=X,
                      cap_end=True, ao=-0.02)
            part.tube([V(side * 0.052, 0.248, 0.400), V(side * 0.042, 0.168, 0.426)], [0.023, 0.015], 4, 'metal', up=X,
                      tip_end=V(side * 0.012, 0.092, 0.388), ao=0.06)
            spike(part, V(side * 0.046, 0.200, 0.428), V(side * 0.052, 0.176, 0.474), 0.012, 'metal', n=3, up=X, ao=0.08)
            # Pedipalp: a short feeler with two segments beside the fangs.
            part.tube([V(side * 0.100, 0.316, 0.300), V(side * 0.152, 0.340, 0.420), V(side * 0.136, 0.246, 0.496)],
                      [0.030, 0.027, 0.021], 4, 'primary', up=Y, tip_end=V(side * 0.112, 0.160, 0.512),
                      band_regions=['primary', 'secondary'], band_ao=[0.0, 0.04])

    # ---- eight legs: coxa, armoured femur, knee spur, tapered tibia, tip on y = 0 --------------------------------
    leg_tips = {1: V(0.60, 0.0, 0.66), 2: V(0.76, 0.0, 0.28), 3: V(0.76, 0.0, -0.18), 4: V(0.62, 0.0, -0.60)}
    for side, tag in ((1, 'l'), (-1, 'r')):
        for index, tip in leg_tips.items():
            coxa, femur, tibia = (f'leg_{index}_{tag}_{segment}' for segment in ('coxa', 'femur', 'tibia'))
            c, f, t = wp[coxa], wp[femur], wp[tibia]
            tip = V(side * tip.x, tip.y, tip.z)
            out = V(t.x - c.x, 0, t.z - c.z).normalized()
            path = [c - out * 0.040, f, f.lerp(t, 0.48) + V(0, 0.022, 0), t, t.lerp(tip, 0.62) + out * 0.016,
                    tip + V(0, 0.120, 0) - out * 0.030]
            radii = [0.044, 0.050, 0.060, 0.050, 0.032, 0.021]
            skins = [bone(**{coxa: 1.0}), bone(**{femur: 1.0}), bone(**{femur: 1.0}), bone(**{tibia: 1.0}),
                     bone(**{tibia: 1.0}), bone(**{tibia: 1.0})]
            part.tube(path, radii, 6, 'primary', up=Y, ring_skins=skins, tip_end=tip,
                      band_regions=['primary', 'secondary', 'secondary', 'primary', 'accent'],
                      band_ao=[-0.06, 0.04, 0.0, -0.02, 0.06])
            with part.skinned(bone(**{tibia: 1.0})):
                spike(part, t - V(0, 0.020, 0), t + V(0, 0.120, 0) + out * 0.050, 0.034, 'metal', n=3, flat=0.6, up=out,
                      ao=0.06)
            with part.skinned(bone(**{femur: 1.0})):
                middle = f.lerp(t, 0.48)
                spike(part, middle + V(0, 0.030, 0), middle + V(0, 0.125, 0) - out * 0.030, 0.026, 'secondary', n=3,
                      flat=0.6, up=out)

    return part.to_mesh(solver)


def spider_clips():
    b0 = V(*ARACHNID_CONTRACT['worldPositions']['body'])
    tau = math.tau

    def rot(rx=0.0, ry=0.0, rz=0.0):
        return {'rotation': euler_quat(rx, ry, rz)}

    def body(rx=0.0, ry=0.0, rz=0.0, y=0.0, z=0.0):
        return {'translation': [b0.x, b0.y + y, b0.z + z], 'rotation': euler_quat(rx, ry, rz)}

    def leg(pose, index, side, *, yaw=0.0, lift=0.0, reach=0.0, level=0.0):
        """One leg. yaw + = the tip moves forward, lift + = the knee rises, reach + = the tibia swings out and up.

        `level` turns the leg about X at the coxa. It takes a body pitch out of the leg.
        """
        s = 1.0 if side == 'l' else -1.0
        pose[f'leg_{index}_{side}_coxa'] = rot(level, -s * yaw, s * lift * 0.30)
        pose[f'leg_{index}_{side}_femur'] = rot(0, 0, s * lift * 0.60)
        pose[f'leg_{index}_{side}_tibia'] = rot(0, 0, s * reach)

    def stride(phase, duty, reach):
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
        # Alternating tetrapod gait with forward bias on leg_4 so rear tibias never graze the abdomen bulb.
        a = u * tau
        pose = {
            'body': body(0.02 * math.sin(2 * a), 0.03 * math.sin(a), 0.0,
                         y=-0.004 + bob * (0.5 - 0.5 * math.cos(2 * a))),
            'abdomen': rot(0.06 + 0.04 * math.sin(2 * a + 0.9), -0.04 * math.sin(a)),
            'head': rot(0.03 * math.sin(2 * a), -0.03 * math.sin(a)),
        }
        for index in (1, 2, 3, 4):
            for side in ('l', 'r'):
                group_a = (index % 2 == 1) == (side == 'l')
                leg_yaw = stride_yaw * (0.50 if index == 4 else 1.0)
                yaw_bias = 0.04 if index == 1 else (0.22 if index == 4 else 0.0)
                angle, lift = stride(u + (0.0 if group_a else 0.5), 0.56, leg_yaw)
                leg_lift = lift_amount * (0.72 if index == 3 else 1.0) * lift
                leg(pose, index, side, yaw=angle + yaw_bias, lift=leg_lift, reach=(0.36 if index == 4 else 0.26) * lift)
        return pose

    def attack_fn(u, _t):
        # Rear up with head tilted back to bare fangs (0.28..0.40), fast forward lunge + downward fang bite
        # & front-leg pincer clamp (0.54), brief latch/yank (0.66), then recover (1.00).
        keys = [
            (0.00, {}),
            (0.28, {'rx': -0.36, 'y': 0.10, 'z': -0.07, 'ab_x': 0.26, 'hd_x': -0.34,
                    'l1_y': -0.22, 'l1_l': 1.02, 'l1_r': 0.46, 'l2_y': 0.04, 'l2_l': 0.42, 'l2_r': 0.18}),
            (0.40, {'rx': -0.44, 'y': 0.11, 'z': -0.10, 'ab_x': 0.34, 'hd_x': -0.44,
                    'l1_y': -0.26, 'l1_l': 1.12, 'l1_r': 0.52, 'l2_y': 0.06, 'l2_l': 0.50, 'l2_r': 0.22}),
            (0.54, {'rx': 0.02, 'y': 0.072, 'z': 0.26, 'ab_x': -0.12, 'hd_x': 0.38,
                    'l1_y': 0.36, 'l1_l': 0.42, 'l1_r': -0.02, 'l2_y': 0.14, 'l2_l': 0.20, 'l2_r': 0.08}),
            (0.66, {'rx': 0.02, 'y': 0.052, 'z': 0.20, 'ab_x': -0.05, 'hd_x': 0.26,
                    'l1_y': 0.26, 'l1_l': 0.26, 'l1_r': 0.0, 'l2_y': 0.10, 'l2_l': 0.14, 'l2_r': 0.04}),
            (1.00, {}),
        ]
        k = keyed(u, keys)
        g = lambda name: k.get(name, 0.0)  # noqa: E731
        rx = g('rx')
        pose = {
            'body': body(rx, y=g('y'), z=g('z')),
            'abdomen': rot(g('ab_x')),
            'head': rot(g('hd_x')),
        }
        rear_level = max(0.0, -rx)
        fwd_level = max(0.0, rx)
        for side in ('l', 'r'):
            leg(pose, 1, side, yaw=g('l1_y'), lift=g('l1_l'), reach=g('l1_r'), level=0.20 * rear_level - fwd_level)
            leg(pose, 2, side, yaw=g('l2_y'), lift=g('l2_l'), reach=g('l2_r'), level=0.40 * rear_level - fwd_level)
            leg(pose, 3, side, lift=0.04 * rear_level, level=0.90 * rear_level)
            leg(pose, 4, side, yaw=0.08 * rear_level, lift=0.04 * rear_level, level=0.90 * rear_level)
        return pose

    def death_fn(u, _t):
        # Take a hit (head and front carapace jerk up/back, front legs flinch), then drop belly-first into a collapsed curl.
        keys = [
            (0.00, {}),
            (0.15, {'y': 0.06, 'z': -0.09, 'rx': -0.36, 'ry': 0.08, 'rz': -0.03,
                    'ab_x': 0.26, 'hd_x': -0.34, 'hd_y': -0.06, 'hd_z': 0.0,
                    'l1_l': 0.78, 'l1_r': 0.34, 'l1_y': -0.10, 'l1_lv': 0.0,
                    'l2_l': 0.42, 'l2_r': 0.18, 'l2_y': 0.02,  'l2_lv': 0.15,
                    'l3_l': -0.02, 'l3_r': 0.06, 'l3_y': 0.08, 'l3_lv': 0.34,
                    'l4_l': -0.02, 'l4_r': 0.08, 'l4_y': 0.20, 'l4_lv': 0.36}),
            (0.34, {'y': -0.10, 'z': -0.13, 'rx': -0.06, 'ry': 0.05, 'rz': 0.06,
                    'ab_x': 0.12, 'hd_x': -0.26, 'hd_y': 0.06, 'hd_z': 0.14,
                    'l1_l': 0.64, 'l1_r': -0.18, 'l1_y': 0.04, 'l1_lv': 0.0,
                    'l2_l': 0.64, 'l2_r': -0.16, 'l2_y': 0.06, 'l2_lv': 0.0,
                    'l3_l': 0.60, 'l3_r': -0.10, 'l3_y': 0.02, 'l3_lv': 0.06,
                    'l4_l': 0.50, 'l4_r': 0.04,  'l4_y': 0.30, 'l4_lv': 0.06}),
            (0.56, {'y': -0.181, 'z': -0.14, 'rx': -0.02, 'ry': 0.05, 'rz': 0.09,
                    'ab_x': 0.08, 'hd_x': -0.44, 'hd_y': 0.18, 'hd_z': 0.22,
                    'l1_l': 0.80, 'l1_r': -0.24, 'l1_y': 0.08, 'l1_lv': 0.0,
                    'l2_l': 0.84, 'l2_r': -0.22, 'l2_y': 0.06, 'l2_lv': 0.0,
                    'l3_l': 0.78, 'l3_r': -0.14, 'l3_y': 0.04, 'l3_lv': 0.0,
                    'l4_l': 0.66, 'l4_r': 0.06,  'l4_y': 0.36, 'l4_lv': 0.0}),
            (0.68, {'y': -0.164, 'z': -0.14, 'rx': -0.03, 'ry': 0.05, 'rz': 0.09,
                    'ab_x': 0.10, 'hd_x': -0.38, 'hd_y': 0.18, 'hd_z': 0.22,
                    'l1_l': 0.84, 'l1_r': -0.26, 'l1_y': 0.08, 'l1_lv': 0.0,
                    'l2_l': 0.88, 'l2_r': -0.24, 'l2_y': 0.06, 'l2_lv': 0.0,
                    'l3_l': 0.82, 'l3_r': -0.16, 'l3_y': 0.04, 'l3_lv': 0.0,
                    'l4_l': 0.70, 'l4_r': 0.04,  'l4_y': 0.36, 'l4_lv': 0.0}),
            (0.84, {'y': -0.184, 'z': -0.14, 'rx': -0.02, 'ry': 0.05, 'rz': 0.10,
                    'ab_x': 0.08, 'hd_x': -0.46, 'hd_y': 0.18, 'hd_z': 0.24,
                    'l1_l': 0.78, 'l1_r': -0.22, 'l1_y': 0.08, 'l1_lv': 0.0,
                    'l2_l': 0.82, 'l2_r': -0.20, 'l2_y': 0.06, 'l2_lv': 0.0,
                    'l3_l': 0.76, 'l3_r': -0.12, 'l3_y': 0.04, 'l3_lv': 0.0,
                    'l4_l': 0.64, 'l4_r': 0.08,  'l4_y': 0.38, 'l4_lv': 0.0}),
            (1.00, {'y': -0.184, 'z': -0.14, 'rx': -0.02, 'ry': 0.05, 'rz': 0.10,
                    'ab_x': 0.08, 'hd_x': -0.46, 'hd_y': 0.18, 'hd_z': 0.24,
                    'l1_l': 0.78, 'l1_r': -0.22, 'l1_y': 0.08, 'l1_lv': 0.0,
                    'l2_l': 0.82, 'l2_r': -0.20, 'l2_y': 0.06, 'l2_lv': 0.0,
                    'l3_l': 0.76, 'l3_r': -0.12, 'l3_y': 0.04, 'l3_lv': 0.0,
                    'l4_l': 0.64, 'l4_r': 0.08,  'l4_y': 0.38, 'l4_lv': 0.0}),
        ]
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

    builders = {'Idle': (24, idle_fn), 'Walk': (24, lambda u, _t: gait_fn(u, 0.12, 0.56, 0.006)),
                'Run': (30, lambda u, _t: gait_fn(u, 0.15, 0.72, 0.008)), 'Attack': (30, attack_fn),
                'Death': (24, death_fn)}
    # The contract owns the clip names, their order and their durations.
    return [sample_clip(clip['name'], clip['duration'], *builders[clip['name']]) for clip in ARACHNID_CONTRACT['clips']]


# --------------------------------------------------------------------------
# Pack assembly
# --------------------------------------------------------------------------

def build_ual1_monsters(core, solver, builder, parts):
    parts_file = 'monsters-parts.glb'
    for body_id, label, fn in (
        ('body_orc', 'Orc Muscular', build_orc_body),
        ('body_troll', 'Troll Hulking', build_troll_body),
    ):
        part = pk.Part(body_id)
        fn(part, MONSTER_BODIES[body_id])
        mesh = part.to_mesh(solver)
        builder.add_mesh(mesh)
        parts.append(pk.part_entry(mesh, PACK, 'body', label, parts_file, rig_id='ual1'))

    for head_id, label, fn in (('head_orc', 'Orc Tusked', head_orc), ('head_troll', 'Troll Snout', head_troll)):
        part = pk.Part(head_id)
        fn(part)
        mesh = part.to_mesh(solver)
        builder.add_mesh(mesh)
        parts.append(pk.part_entry(mesh, PACK, 'head', label, parts_file, rig_id='ual1'))

    hair_mesh = pk.build_head_skinned('hair_orc_mohawk', hair_orc_mohawk, solver)
    builder.add_mesh(hair_mesh)
    parts.append(pk.part_entry(hair_mesh, PACK, 'hair', 'Orc War-Mohawk', parts_file, rig_id='ual1'))

    # Morphable monster gear built across all UAL1 body archetypes (athletic + heavy + slim + orc + troll)
    for slot, fn, label, rules in (
        ('torso', torso_orc_harness, 'Orc War Harness', {}),
        ('torso', torso_troll_hide, 'Troll Fetish Hide', {}),
        ('legs', legs_orc_kilt, 'Orc War Kilt & Greaves', {}),
        ('legs', legs_troll_wraps, 'Troll Loincloth & Wraps', {}),
        ('headwear', headwear_orc_horned, 'Orc Horned Helm', {'hides_hair': True}),
        ('back', back_orc_trophy, 'Orc Trophy Rack', {}),
    ):
        if slot == 'headwear':
            mesh = pk.build_head_skinned(fn.__name__, fn, solver)
        else:
            mesh = pk.build_skinned(fn.__name__, fn, solver)
        builder.add_mesh(mesh)
        parts.append(pk.part_entry(mesh, PACK, slot, label, parts_file, rig_id='ual1', **rules))


def main():
    args = pk.script_args(__doc__, 'core', 'stage', 'meta')
    core = pk.Rig(args.core)
    core.check_contract()
    source = pk.Rig(SOURCE_RIG)
    solver = pk.WeightSolver(source)

    characters = pk.leaf_dir(args.stage, PACK, 'characters')
    world = pk.leaf_dir(args.stage, PACK, 'world')

    parts = []
    # 1. UAL1 monster parts (Orc & Troll)
    ual1_builder = pk.GlbBuilder()
    ual1_builder.add_rig(core, with_clips=False)
    build_ual1_monsters(core, solver, ual1_builder, parts)
    ual1_builder.write(characters / 'monsters-parts.glb')

    # 2. Quadruped rig + Dire Wolf
    q_file = 'quadruped-rig.glb'
    q_builder = pk.GlbBuilder()
    q_builder.add_custom_rig(QUADRUPED_CONTRACT, wolf_clips(), rig_name='Quadruped_Rig')
    q_path = characters / q_file
    q_builder.write(q_path)  # write shell rig to initialize SegmentWeightSolver from exact positions
    q_rig = pk.Rig(q_path, expected_joints=QUADRUPED_CONTRACT['joints'])
    q_rig.check_contract(contract=QUADRUPED_CONTRACT)
    q_solver = pk.SegmentWeightSolver(q_rig)
    q_builder_full = pk.GlbBuilder()
    q_builder_full.add_custom_rig(QUADRUPED_CONTRACT, wolf_clips(), rig_name='Quadruped_Rig')
    wolf_mesh = build_dire_wolf_mesh(q_solver)
    q_builder_full.add_mesh(wolf_mesh)
    q_builder_full.write(q_path)
    parts.append(pk.part_entry(wolf_mesh, PACK, 'body', 'Dire Wolf', q_file, rig_id='quadruped'))

    # 3. Arachnid rig + Giant Spider
    a_file = 'arachnid-rig.glb'
    a_builder = pk.GlbBuilder()
    a_builder.add_custom_rig(ARACHNID_CONTRACT, spider_clips(), rig_name='Arachnid_Rig')
    a_path = characters / a_file
    a_builder.write(a_path)
    a_rig = pk.Rig(a_path, expected_joints=ARACHNID_CONTRACT['joints'])
    a_rig.check_contract(contract=ARACHNID_CONTRACT)
    a_solver = pk.SegmentWeightSolver(a_rig)
    a_builder_full = pk.GlbBuilder()
    a_builder_full.add_custom_rig(ARACHNID_CONTRACT, spider_clips(), rig_name='Arachnid_Rig')
    spider_mesh = build_giant_spider_mesh(a_solver)
    a_builder_full.add_mesh(spider_mesh)
    a_builder_full.write(a_path)
    parts.append(pk.part_entry(spider_mesh, PACK, 'body', 'Giant Spider', a_file, rig_id='arachnid'))

    # 4. Held weapons
    held = []
    for build, label, hand in (
        (held_orc_cleaver, 'Orc Cleaver', 'hand_r'),
        (held_troll_club, 'Troll Spiked Club', 'hand_r'),
        (held_spiked_buckler, 'Spiked Buckler', 'hand_l'),
    ):
        part = pk.Part(build.__name__)
        build(part)
        mesh = part.to_mesh()
        rel = f'held/{mesh.name}.glb'
        held.append(pk.held_entry(mesh, PACK, label, hand, rel, pk.write_static_glb(characters / rel, mesh)))

    # 5. Monster world props
    props = []
    for build, label in (
        (prop_orc_totem, 'Orc Skull Totem'),
        (prop_spider_egg_sac, 'Spider Egg Sacs'),
        (prop_bone_pile, 'Bone Pile'),
        (prop_spiked_barricade, 'Spiked Barricade'),
    ):
        part = pk.Part(build.__name__)
        build(part)
        mesh = part.to_mesh()
        low, high = mesh.positions.min(axis=0), mesh.positions.max(axis=0)
        mesh.positions -= np.array([(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2])
        rel = f'props/{mesh.name}.glb'
        props.append(pk.prop_entry(mesh, PACK, label, rel, pk.write_static_glb(world / rel, mesh)))

    presets = [
        preset('monsters', 'monster_orc_warlord', 'Orc Warlord', 'Sword_Attack',
               {'skin': '#4f6b3a', 'hair': '#1d1c20', 'primary': '#6b4328', 'secondary': '#4a3a2f',
                'accent': '#e2d4b0', 'metal': '#68727c', 'eye': '#9e3c24'},
               body='body_orc', head='head_orc', hair='hair_orc_mohawk', torso='torso_orc_harness',
               legs='legs_orc_kilt', headwear='headwear_orc_horned', back='back_orc_trophy',
               right='held_orc_cleaver', left='held_spiked_buckler',
               height=1.14, shoulderWidth=1.46, torsoBulk=1.38, waistScale=1.22, headScale=1.08,
               limbThickness=1.40, armLength=1.08),
        preset('monsters', 'monster_troll_brute', 'Troll Brute', 'Sword_Idle',
               {'skin': '#4c6770', 'hair': '#a8926e', 'primary': '#6e4e35', 'secondary': '#463a31',
                'accent': '#ddd1b4', 'metal': '#6a737c', 'eye': '#8a5628'},
               body='body_troll', head='head_troll', hair=None, torso='torso_troll_hide',
               legs='legs_troll_wraps', right='held_troll_club',
               height=1.34, legRatio=0.88, shoulderWidth=1.50, torsoBulk=1.34, waistScale=1.24, headScale=0.90,
               limbThickness=1.32, armLength=1.32),
        {
            'id': 'monster_dire_wolf', 'pack': PACK, 'label': 'Dire Wolf', 'rigId': 'quadruped', 'clip': 'Run',
            'body': 'body_dire_wolf', 'head': None, 'hair': None, 'torso': None, 'legs': None,
            'headwear': None, 'back': None, 'heldRight': None, 'heldLeft': None,
            'palette': {'skin': '#a7adb5', 'hair': '#22252b', 'primary': '#687080', 'secondary': '#3a404b',
                        'accent': '#ece0bf', 'metal': '#f2a32a', 'eye': '#f2a32a'},
            'proportions': {'height': 1.05, 'shoulderWidth': 1.05, 'torsoBulk': 1.08, 'waistScale': 1.0,
                            'headScale': 1.05, 'limbThickness': 1.05},
        },
        {
            'id': 'monster_giant_spider', 'pack': PACK, 'label': 'Giant Spider', 'rigId': 'arachnid', 'clip': 'Attack',
            'body': 'body_giant_spider', 'head': None, 'hair': None, 'torso': None, 'legs': None,
            'headwear': None, 'back': None, 'heldRight': None, 'heldLeft': None,
            'palette': {'skin': '#383244', 'hair': '#1d1926', 'primary': '#332c42', 'secondary': '#514366',
                        'accent': '#de3a4c', 'metal': '#a3abb9', 'eye': '#de3a4c'},
            'proportions': {'height': 1.0, 'shoulderWidth': 1.0, 'torsoBulk': 1.0, 'waistScale': 1.0,
                            'headScale': 1.0, 'limbThickness': 1.0},
        },
    ]

    catalog = pk.pack_catalog(
        PACK,
        parts=parts,
        held=held,
        props=props,
        presets=presets,
        clips=core.clips,
        creature_rigs=[
            {'rigId': 'quadruped', 'rigModelPath': q_file, 'clips': [c['name'] for c in QUADRUPED_CONTRACT['clips']]},
            {'rigId': 'arachnid', 'rigModelPath': a_file, 'clips': [c['name'] for c in ARACHNID_CONTRACT['clips']]},
        ],
    )

    manifest_path = args.meta / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['packs'] = [p for p in manifest['packs'] if p['pack'] != PACK] + [catalog]
    check_compositions(manifest['packs'])
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')

    print(f'PACK {PACK}')
    for kind in ('parts', 'heldItems', 'props'):
        for entry in catalog[kind]:
            print(f'  {entry.get("slot", kind):9s} {entry["id"]:28s} {entry["triangles"]:5d} tris')
    print(f'MANIFEST UPDATED {manifest_path}')


if __name__ == '__main__':
    main()
