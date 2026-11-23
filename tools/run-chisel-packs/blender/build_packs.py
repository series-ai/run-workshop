"""Build the context packs (medieval, ww2, sim, cyberpunk) on the exact UAL1 rig of run-chisel-core.

Each pack gets:
  3D/characters/<pack>-parts.glb   skinned outfit parts (torso, legs, headwear, back)
  3D/characters/held/<id>.glb      held items in the canonical grip frame (rule M3)
  3D/<theme>/props/<id>.glb        grounded world props (rule M4)
The script also writes out/meta/manifest.json with the core and context pack catalogs.

Usage (see scripts/build.ts):
  blender --background --factory-startup --python build_packs.py -- --core <core-rig.glb> --stage <dir> --meta <dir>

Outfit builders take (part, body). The kit runs each builder for every body
archetype and stores the differences as morph targets, so one outfit fits all
bodies. A builder must make the same topology for every body.
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import polykit as pk  # noqa: E402
from build_core import HUMAN_HEIGHT_MULTIPLIER  # noqa: E402
from polykit import X, Y, Z, V  # noqa: E402

SOURCE_RIG = pk.TOOL_ROOT / 'assets/source/ual1-base.glb'

# Layer clearances over the base body (rule F4).
CLOTH, JACKET, OVER = 0.008, 0.014, 0.022

SKIN_NECK = pk.Skin(allowed=('spine_03', 'neck_01'))
SKIN_BACK = pk.Skin(allowed=('spine_02', 'spine_03'))
SKIN_PAULDRON_L = pk.rigid(upperarm_l=0.92, clavicle_l=0.08)
ENVELOPE = pk.HEAD_ENVELOPE
BROW = pk.HEAD_Y['brow']


# --------------------------------------------------------------------------
# Garment helpers
# --------------------------------------------------------------------------

def torso_stack(part, body, spec, region, *, sleeves=False, **options):
    """Loft torso rings. spec rows: (station or height, grow[, {'y', 'widen', 'front', 'back', 'skin', 'hem'}])."""
    rings, refs, skins = [], [], []
    for key, grow, *rest in spec:
        extra = dict(rest[0]) if rest else {}
        skins.append(extra.pop('skin', None))
        hem_clearance = extra.pop('hem', None)
        height_y = extra.get('y')
        if hem_clearance is not None:
            y_val = height_y if height_y is not None else (body.torso[key].y if isinstance(key, str) else key)
            rings.append(pk.hip_hem_torso_ring(
                body, y_val, grow, clearance=hem_clearance,
                extra_widen=extra.get('widen', 0.0),
                extra_front=extra.get('front', 0.0),
                extra_back=extra.get('back', 0.0),
            ))
        else:
            rings.append(pk.torso_ring(body, key, grow, **extra))
        refs.append(pk.torso_ring(body, key, 0.0, y=height_y))
    with part.skinned(pk.SKIN_TORSO):
        if sleeves:
            chest = next(i for i, row in enumerate(spec) if row[0] == 'chest')
            return pk.loft_sleeved_torso(part, rings, refs, chest, region, ring_skins=skins, **options)
        return part.loft(rings, region, refs=refs, ring_skins=skins, **options)


def _default_arm_skin(index):
    if index <= 0.05:
        return pk.SKIN_TORSO
    if index <= 1.05:
        return pk.SKIN_SHOULDER_CAP_L
    if 2.85 <= index <= 3.15:
        return pk.SKIN_ELBOW_HI_L
    if 3.85 <= index <= 4.15:
        return pk.SKIN_ELBOW_LO_L
    if index >= 5.45:
        return pk.SKIN_FOREARM_END_L
    return pk.SKIN_ARM_L


def arm_stack(part, body, spec, region, *, armhole=None, **options):
    """Loft left arm rings. spec rows: (station index, grow[, x])."""
    rings = [pk.arm_ring(body, index, grow, x=rest[0] if rest else None) for index, grow, *rest in spec]
    refs = [pk.arm_ring(body, index, 0.0, x=rest[0] if rest else None) for index, grow, *rest in spec]
    if armhole is not None:
        rings[0], refs[0] = armhole
    if 'ring_skins' not in options:
        options['ring_skins'] = [_default_arm_skin(index) for index, *_ in spec]
    with part.skinned(pk.SKIN_ARM_L):
        return part.loft(rings, region, refs=refs, **options)


def _default_leg_skin(index):
    if index <= 0.01:
        return pk.SKIN_HIP_SOCKET_L
    if 4.8 <= index < 5.5:
        return pk.SKIN_ANKLE_HI_L
    if 5.5 <= index < 6.5:
        return pk.SKIN_ANKLE_L
    if index >= 6.5:
        return pk.SKIN_ANKLE_IN_L
    return pk.SKIN_LEG_L


def leg_stack(part, body, spec, region, **options):
    """Loft left leg rings. spec rows: (station index, grow[, y])."""
    rings = [pk.leg_ring(body, index, grow, y=rest[0] if rest else None) for index, grow, *rest in spec]
    refs = [pk.leg_ring(body, index, 0.0, y=rest[0] if rest else None) for index, grow, *rest in spec]
    if 'ring_skins' not in options:
        options['ring_skins'] = [_default_leg_skin(index) for index, *_ in spec]
    with part.skinned(pk.SKIN_LEG_L):
        return part.loft(rings, region, refs=refs, **options)


def belt(part, body, height, grow, width, region, *, bulge=0.010, flat=True, ao=-0.05):
    """A raised band around the torso."""
    half = width / 2
    if flat:
        rows = [(height - half, grow), (height - half + 0.006, grow + bulge), (height + half - 0.006, grow + bulge),
                (height + half, grow)]
    else:
        rows = [(height - half, grow), (height, grow + bulge), (height + half, grow)]
    return torso_stack(part, body, rows, region, ao=ao)


def pelvis_shell(part, body, region, *, grow=CLOTH, hips_grow=None, top=1.168, ao=0.0, skip_seat_sides=False):
    """Trouser seat from the crotch to the waistband with granular cell tags for skirt/kilt culling."""
    hg = grow + 0.002 if hips_grow is None else hips_grow
    if skip_seat_sides:
        torso_stack(part, body, [('belt', grow), ('belt', grow, {'y': top})], region, ao=ao, band_tags=['legs_waist'])
        with part.skinned(pk.SKIN_TORSO):
            c_pts, c_ref = pk.torso_ring(body, 'crotch', grow), pk.torso_ring(body, 'crotch', 0.0)
            h_pts, h_ref = pk.torso_ring(body, 'hips', hg), pk.torso_ring(body, 'hips', 0.0)
            b_pts, b_ref = pk.torso_ring(body, 'belt', grow), pk.torso_ring(body, 'belt', 0.0)
            part.loft([[c_pts[2], c_pts[3]], [h_pts[2], h_pts[3]], [b_pts[2], b_pts[3]]],
                      region, refs=[[c_ref[2], c_ref[3]], [h_ref[2], h_ref[3]], [b_ref[2], b_ref[3]]],
                      closed=False, toward=Z, ao=ao, band_tags=['legs_seat_front', 'legs_seat_front'])
            part.loft([[c_pts[2], c_pts[3]], [c_pts[7], c_pts[8]]], region,
                      refs=[[c_ref[2], c_ref[3]], [c_ref[7], c_ref[8]]],
                      closed=False, toward=-Y, ao=ao, band_tags=['legs_seat_crotch'])
        return None
    cell_tags, start_cap_tag = pk.pelvis_cell_tags()
    return torso_stack(part, body, [('crotch', grow), ('hips', hg), ('belt', grow), ('belt', grow, {'y': top})],
                       region, cap_start=True, ao=ao, cell_tags=cell_tags, start_cap_tag=start_cap_tag)


def front_strip(part, body, rows, region, **options):
    """A strip on the torso front. rows: (height, half width, grow)."""
    rings, refs = [], []
    for height, half, grow in rows:
        rings.append([pk.torso_point(body, height, half, grow), pk.torso_point(body, height, -half, grow)])
        refs.append([pk.torso_point(body, height, half), pk.torso_point(body, height, -half)])
    with part.skinned(pk.SKIN_TORSO):
        return part.loft(rings, region, refs=refs, closed=False, toward=Z, **options)


def front_bevel_panel(part, body, rows, region, *, inset=0.003, ao=0.0, cap_start=False, cap_end=False,
                      tip_start=None, tip_end=None):
    """A 3D bevelled strip on the torso front that follows intermediate chest stations.

    rows: (height, x_left, x_right, base_grow, top_grow) with x_left > x_right.
    """
    rings, refs = [], []
    for height, x_left, x_right, base_grow, top_grow in rows:
        in_d = min(inset, max(0.0, (x_left - x_right) * 0.25))
        rings.append([
            pk.torso_point(body, height, x_left, base_grow),
            pk.torso_point(body, height, x_left - in_d, top_grow),
            pk.torso_point(body, height, x_right + in_d, top_grow),
            pk.torso_point(body, height, x_right, base_grow),
        ])
        refs.append([
            pk.torso_point(body, height, x_left),
            pk.torso_point(body, height, x_left - in_d),
            pk.torso_point(body, height, x_right + in_d),
            pk.torso_point(body, height, x_right),
        ])
    with part.skinned(pk.SKIN_TORSO):
        return part.loft(rings, region, refs=refs, closed=False, ao=ao,
                         cap_start=cap_start, cap_end=cap_end, tip_start=tip_start, tip_end=tip_end)


def torso_plate(part, body, height, index, grow, width, tall, depth, region, **options):
    """A bevelled plate on one flat side of the torso. The plate uses the skin weights of its centre."""
    center, normal, _ = pk.facet(pk.torso_ring(body, height, grow), index)
    with part.skinned(pk.SKIN_TORSO), part.anchored(pk.facet(pk.torso_ring(body, height), index)[0]):
        return part.plate(center, normal, Y, width, tall, depth, region, **options)


def shoulder_strap(part, body, region, *, x=0.062, half=0.014, grow=0.025, low_front=1.30, low_back=1.38):
    """Left pack strap over the shoulder. Use inside `part.mirrored()`."""
    sh, nb = body.torso['shoulder'], body.torso['neck_base']

    def _top_y(px):
        t = max(0.0, min(1.0, (px - nb.w) / max(1e-4, sh.w - nb.w)))
        return nb.y + t * (sh.y - nb.y) + grow

    rows = [('back', low_back), ('back', 1.52), ('top', 0.0), ('front', 1.54), ('front', 1.465), ('front', 1.38),
            ('front', low_front)]
    rings, refs = [], []
    for side, height in rows:
        if side == 'top':
            center = sh.zc
            y_in, y_out = _top_y(x - half), _top_y(x + half)
            rings.append([V(x - half, y_in, center), V(x + half, y_out, center)])
            refs.append([V(x - half, y_in - grow, center), V(x + half, y_out - grow, center)])
        else:
            limit = pk.station_at(body, height).w * 0.96
            x_in = min(x - half, limit - half)
            x_out = min(x + half, limit)
            rings.append([pk.torso_point(body, height, x_in, grow, side), pk.torso_point(body, height, x_out, grow, side)])
            refs.append([pk.torso_point(body, height, x_in, 0.0, side), pk.torso_point(body, height, x_out, 0.0, side)])
    with part.skinned(pk.SKIN_TORSO):
        return part.loft(rings, region, refs=refs, closed=False, ao=-0.06)


def open_front(points):
    """Reorder a torso ring so that an open loft leaves out the flat front side."""
    return points[3:] + points[:3]


def hat_hair(part, shape=ENVELOPE, *, temple=-0.020, side=-0.026, back=-0.128):
    """Hair below a hat. The hat hides the hair slot, so the hat brings its own."""
    pk.head_shell(part, 'hair', 0.010, front=BROW + 0.03, temple=BROW + temple, side=BROW + side, back=BROW + back,
                  top_lift=0.0, ao=-0.04, shape=shape)


def head_facet(height, index, grow, shape=ENVELOPE):
    return pk.facet(pk.head_ring(shape, height, grow), index)


# --------------------------------------------------------------------------
# Medieval
# --------------------------------------------------------------------------

def torso_medieval_knight(part, body):
    part.covers = ['chest', 'upperarm', 'forearm', 'hand', 'legs_waist']
    neck = body.torso['neck_base'].y
    armhole = torso_stack(part, body, [('hips', 0.015, {'y': 1.072, 'hem': 0.010}), ('waist', 0.016), ('ribs', 0.018),
                             ('chest', 0.024), ('shoulder', 0.016), ('neck_base', 0.012),
                             ('neck_base', 0.016, {'y': neck + 0.040, 'skin': SKIN_NECK})], 'metal', sleeves=True,
                band_ao=[-0.06, 0, 0.03, 0.03, 0, 0.05])
    # Tabard strip and brass emblem on the breastplate.
    front_strip(part, body, [(1.10, 0.052, 0.022), (1.235, 0.046, 0.024), (1.355, 0.052, 0.028),
                             (body.torso['chest'].y, 0.058, 0.034)], 'primary')
    torso_plate(part, body, 1.405, 2, 0.040, 0.058, 0.070, 0.010, 'accent', shrink=0.7)
    belt(part, body, 1.135, 0.015, 0.050, 'secondary', bulge=0.006, flat=False)
    torso_plate(part, body, 1.135, 2, 0.028, 0.050, 0.046, 0.012, 'accent')
    with part.mirrored():
        arm_stack(part, body, [(0, 0.003), (2, 0.009), (3, 0.008), (4, 0.010), (5.45, 0.011), (6, 0.011)],
                  'metal', armhole=armhole, cap_end=True, band_regions=['metal', 'secondary', 'secondary', 'metal', 'metal'])
        with part.skinned(SKIN_PAULDRON_L):
            part.loft([pk.arm_ring(body, 0.85, 0.025), pk.arm_ring(body, 1.15, 0.026), pk.arm_ring(body, 1.45, 0.018)],
                      'metal', cap_start=False, band_regions=['metal', 'accent'], ao=0.04)
        pk.build_hand(part, body, 'metal', grow=0.002)


def torso_medieval_tunic(part, body):
    part.covers = [
        'chest', 'upperarm', 'forearm', 'legs_waist', 'legs_seat_sides', 'legs_seat_back', 'legs_seat_front',
        'legs_seat_crotch',
    ]
    neck = body.torso['neck_base'].y
    armhole = torso_stack(part, body, [('belt', 0.014, {'y': 1.158}), ('waist', 0.014),
                             ('ribs', 0.014), ('chest', 0.016), ('shoulder', 0.014), ('neck_base', 0.008)], 'primary', sleeves=True)
    # Split left/right tunic tasset panels enclosing pelvis + dressed thighs across strides and sitting/jogging.
    skirt_rings = pk.skirt_tail_rings(body, [
        {'y': 1.158, 'clearance': 0.001, 'back_x': 0.004, 'front_x': 0.004},
        {'y': 1.060, 'clearance': 0.008, 'back_x': 0.004, 'front_x': 0.004,
         'front_pad': 0.014, 'back_pad': 0.024},
        {'y': 0.985, 'clearance': 0.006, 'back_x': 0.006, 'front_x': 0.006, 'front_pad': 0.003, 'back_pad': 0.032},
        {'y': 0.875, 'clearance': 0.005, 'back_x': 0.008, 'front_x': 0.010, 'back_pad': 0.022},
    ], two_sided_margin=0.0045)
    skirt_cells = pk.skirt_cell_skins([1.0, 0.22, 0.04, 0.0], [1.0, 0.92, 0.95, 0.0], [1.0, 0.18, 0.04, 0.0])
    with part.mirrored():
        part.loft(skirt_rings, 'primary', cell_skins=skirt_cells, closed=False,
                  band_regions=['primary', 'primary', 'accent'], band_ao=[0.0, 0.0, -0.04],
                  two_sided=True, thickness=0.004, inner_ao=-0.20)
    # Hooded mantle over the shoulders (tucked laterally inside sleeve tops, tapering smoothly onto chest).
    torso_stack(part, body, [(1.515, 0.018, {'front': 0.006, 'back': 0.008}),
                             ('shoulder', 0.018, {'widen': -0.002, 'front': 0.006, 'back': 0.010}),
                             ('neck_base', 0.014),
                             ('neck_base', 0.016, {'y': neck + 0.032, 'back': 0.012, 'skin': SKIN_NECK})], 'secondary', ao=0.02)
    belt(part, body, 1.160, 0.015, 0.042, 'secondary', bulge=0.006, flat=False)
    torso_plate(part, body, 1.160, 2, 0.027, 0.046, 0.042, 0.012, 'metal')
    center, normal, _ = pk.facet(pk.torso_ring(body, 1.160, 0.026), 3)
    with part.skinned(pk.SKIN_TORSO), part.anchored(pk.facet(pk.torso_ring(body, 1.160), 3)[0]):
        part.box(center + normal * 0.026, (0.048, 0.036, 0.026), 'secondary', right=Y.cross(normal), taper=0.86,
                 ao=-0.08)
    with part.mirrored():
        arm_stack(part, body, [(0, 0.011), (1, 0.012), (2, 0.012), (2.9, 0.016), (3.0, 0.008), (4, 0.008), (5, 0.008),
                               (6, 0.010), (6.0, 0.000, 0.654)], 'primary', armhole=armhole,
                  band_regions=['primary'] * 3 + ['primary', 'secondary', 'secondary', 'secondary', 'secondary'],
                  band_ao=[0, 0, 0, -0.2, -0.04, -0.04, -0.04, -0.22])


def legs_medieval_greaves(part, body):
    part.covers = ['pelvis', 'thigh', 'shin', 'foot']
    pelvis_shell(part, body, 'secondary', ao=-0.06)
    with part.mirrored():
        leg_stack(part, body, [(0, 0.009), (1, 0.011), (2, 0.010), (3, 0.012), (4, 0.016), (5, 0.017), (6, 0.016),
                               (7, 0.011)], 'metal',
                  band_regions=['secondary', 'metal', 'secondary', 'metal', 'metal', 'metal', 'metal'],
                  band_ao=[-0.06, 0, -0.1, 0, 0, 0, -0.08])
        center, normal, _ = pk.facet(pk.leg_ring(body, 2.5, 0.014), 1)
        with part.skinned(pk.SKIN_LEG_L), part.anchored(pk.facet(pk.leg_ring(body, 2.5), 1)[0]):
            part.plate(center, normal, Y, 0.094, 0.120, 0.032, 'metal', shrink=0.55, ao=0.05)
        pk.build_foot(part, body, 'metal', grow=0.012)


def legs_medieval_breeches(part, body):
    part.covers = ['pelvis', 'thigh', 'shin', 'foot']
    pelvis_shell(part, body, 'secondary')
    with part.mirrored():
        leg_stack(part, body, [(0, CLOTH), (1, 0.010), (2, 0.010), (3.45, 0.012), (3.45, 0.024),
                               (5, 0.017), (6, 0.015), (7, 0.011)], 'secondary',
                  band_ao=[0, 0, 0, -0.16, -0.08, -0.1, -0.1])
        pk.build_foot(part, body, 'secondary', grow=0.013, sole=0.014, ao=-0.08)


def headwear_great_helm(part, shape=ENVELOPE):
    part.skin = pk.SKIN_HEAD
    grow = 0.026
    wide = pk.head_ring(shape, BROW, grow)

    def lifted(height, scale):
        return [V(point.x * scale, height, pk.HEAD_Z + (point.z - pk.HEAD_Z) * scale) for point in wide]

    part.loft([pk.head_ring(shape, pk.HEAD_Y['plug'], grow + 0.008), pk.head_ring(shape, pk.HEAD_Y['chin'], grow + 0.006),
               wide, lifted(1.992, 0.98), lifted(2.012, 0.86)], 'metal',
              cap_end=True, band_regions=['accent', 'metal', 'metal', 'metal'])
    eye = pk.HEAD_Y['cheek'] + 0.026
    for index, width in ((1, 0.100), (0, 0.060), (2, 0.060)):
        center, normal, _ = head_facet(eye, index, grow, shape)
        part.plate(center, normal, Y, width, 0.016, 0.003, 'secondary', shrink=0.9, ao=-0.5)
    center, normal, _ = head_facet(1.84, 1, grow, shape)
    part.plate(center, normal, Y, 0.022, 0.230, 0.010, 'accent', shrink=0.7)
    center, normal, _ = head_facet(eye + 0.030, 1, grow, shape)
    part.plate(center, normal, Y, 0.102, 0.022, 0.009, 'accent', shrink=0.8)


def headwear_kettle_helm(part, shape=ENVELOPE):
    part.skin = pk.SKIN_HEAD
    rim = BROW - 0.010
    pk.head_shell(part, 'metal', 0.024, front=rim, temple=rim, side=rim, back=rim, top_lift=0.016, shape=shape)
    part.loft([pk.head_ring(shape, rim + 0.004, 0.024), pk.head_ring(shape, rim - 0.030, 0.105),
               pk.head_ring(shape, rim - 0.036, 0.024)], 'metal', band_ao=[0.04, -0.24])
    part.box(V(0, pk.HEAD_Y['crown'] + 0.034, pk.HEAD_Z), (0.020, 0.022, 0.168), 'metal', taper=(0.5, 0.8), ao=0.05)
    hat_hair(part, shape)


def back_medieval_cloak(part, body):
    columns = [6, 7, 8, 9]
    neck = body.torso['neck_base'].y
    skin_cape = pk.Skin(allowed=('pelvis', 'spine_01', 'spine_02', 'spine_03'))
    # Mantle ring clears breastplate collar while staying tucked inside the pauldron line.
    torso_stack(part, body, [('shoulder', 0.036, {'y': 1.548, 'widen': -0.010, 'front': 0.010, 'back': 0.012, 'skin': SKIN_BACK}),
                             ('shoulder', 0.036, {'widen': -0.010, 'front': 0.010, 'back': 0.010, 'skin': SKIN_BACK}),
                             ('neck_base', 0.022, {'y': neck + 0.026, 'skin': SKIN_NECK})], 'primary', ao=0.03)
    with part.skinned(SKIN_BACK), part.anchored(pk.torso_point(body, 1.548, 0.0)):
        part.plate(pk.torso_point(body, 1.552, 0.0, 0.046), Z, Y, 0.054, 0.044, 0.012, 'accent')
    rows = [('shoulder', 0.046, 1.548, -0.010, 0.008, 0.0), ('chest', 0.052, 1.440, -0.014, 0.018, 0.006),
            ('belt', 0.056, 1.135, -0.022, 0.028, 0.010), ('hips', 0.062, 0.880, -0.024, 0.036, 0.014),
            ('hips', 0.070, 0.560, -0.026, 0.044, 0.018)]
    rings, refs = [], []
    sway_weights = (0.0, 0.8, 0.8, 0.0)
    for key, grow, height, widen, back_extra, fold in rows:
        points = pk.torso_ring(body, key, grow, y=height, widen=widen, back=back_extra)
        base = pk.torso_ring(body, key, 0.0, y=height)
        middle = pk.centroid(points)
        row = []
        for slot, column in enumerate(columns):
            point = points[column]
            sway = fold * sway_weights[slot]
            outward = V(point.x - middle.x, 0, point.z - middle.z).normalized()
            row.append(point + outward * sway)
        rings.append(row)
        refs.append([base[column] for column in columns])
    with part.skinned(skin_cape):
        part.loft(rings, 'primary', refs=refs, closed=False, toward=-Z,
                  band_regions=['primary'] * 3 + ['accent'], two_sided=True, thickness=0.005,
                  inner_region='secondary', inner_ao=-0.20)


def held_broadsword(part):
    part.tube([V(0, -0.078, 0), V(0, 0.078, 0)], [0.018, 0.016], 6, 'secondary', up=Z)
    part.lathe([(0.012, -0.130), (0.033, -0.104), (0.019, -0.078)], 5, 'accent', cap_start=True)
    part.box(V(0, 0.094, 0), (0.038, 0.030, 0.280), 'metal')
    for side in (1, -1):
        part.plate(V(side * 0.019, 0.094, 0), X * side, Y, 0.034, 0.024, 0.007, 'accent')
    part.loft([pk.ring(V(0, 0.108, 0), Z, X, 0.050, 0.012, 4), pk.ring(V(0, 0.800, 0), Z, X, 0.038, 0.009, 4)], 'metal',
              tip_end=V(0, 1.030, 0))


def held_heater_shield(part):
    # Left hand: +X is the back of the hand. Shield clears full wrist flexion in Sword_Attack without oversized stilts.
    offset, centre = 0.140, 0.045
    outline = [(-0.22, 0.26), (0.22, 0.26), (0.23, 0.03), (0.14, -0.19), (0.0, -0.33), (-0.14, -0.19), (-0.23, 0.03)]
    part.slab([V(offset, y, centre + z) for z, y in outline], 0.022, 'metal', normal=X, shrink=0.92, back=True)
    part.slab([V(offset + 0.022, y * 0.86 - 0.005, centre + z * 0.86) for z, y in outline], 0.012, 'primary', normal=X,
              shrink=0.93)
    part.plate(V(offset + 0.034, -0.026, centre), X, Y, 0.066, 0.400, 0.009, 'accent', shrink=0.84)
    part.plate(V(offset + 0.034, 0.096, centre), X, Y, 0.320, 0.066, 0.009, 'accent', shrink=0.84)
    part.tube([V(0, -0.068, 0), V(0, 0.068, 0)], [0.014, 0.014], 4, 'secondary', up=Z)
    for height in (0.068, -0.068):
        part.tube([V(0.0, height, 0.0), V(offset + 0.004, height * 1.04, 0.010)], [0.011, 0.009], 4, 'secondary',
                  up=Z, ao=-0.1)


def held_torch(part):
    part.tube([V(0, -0.17, 0), V(0, 0.33, 0)], [0.017, 0.021], 6, 'secondary', up=Z, cap_start=True)
    part.lathe([(0.024, 0.300), (0.050, 0.360), (0.054, 0.440), (0.040, 0.452)], 6, 'metal', band_ao=[0, 0.02, -0.2])
    part.lathe([(0.040, 0.436), (0.068, 0.505), (0.050, 0.580)], 5, 'accent', tip_end=V(0.014, 0.680, 0.0), ao=0.2)
    part.prism(V(-0.026, 0.50, 0.022), V(-0.044, 0.630, 0.034), 0.030, 0.003, 4, 'accent', up=Z, cap_start=False, ao=0.26)


def prop_barrel(part):
    profile = [(0.250, 0.0), (0.276, 0.10), (0.290, 0.10), (0.303, 0.18), (0.290, 0.18), (0.326, 0.46), (0.290, 0.74),
               (0.303, 0.74), (0.290, 0.82), (0.276, 0.82), (0.250, 0.92)]
    regions = ['primary', 'metal', 'metal', 'metal', 'primary', 'primary', 'metal', 'metal', 'metal', 'primary']
    part.lathe(profile, 10, 'primary', band_regions=regions, cap_start=True)
    part.lathe([(0.250, 0.92), (0.224, 0.92), (0.224, 0.89)], 10, 'secondary', cap_end=True, ao=-0.08)


def prop_crate(part):
    size = 0.70
    part.box(V(0, size / 2, 0), (size, size, size), 'primary', bevel=0.02, ao=-0.06)
    half = size / 2 + 0.008
    for sx in (-1, 1):
        for sz in (-1, 1):
            part.box(V(sx * half, size / 2, sz * half), (0.080, size + 0.016, 0.080), 'secondary', bevel=0.012)
    for axis, normal in ((X, Z), (Z, X)):
        for side in (-1, 1):
            for height in (0.075, size - 0.075):
                part.box(V(0, height, 0) + normal * (side * half), (size - 0.08, 0.090, 0.050), 'secondary', right=axis,
                         ao=-0.04)
    part.plate(V(0, size, 0), Y, Z, 0.50, 0.50, 0.018, 'primary', shrink=0.9, ao=0.06)


def prop_weapon_rack(part):
    for side in (-1, 1):
        part.box(V(side * 0.62, 0.63, 0), (0.074, 1.26, 0.074), 'primary', bevel=0.012, taper=0.86)
        part.box(V(side * 0.62, 0.04, 0), (0.094, 0.08, 0.56), 'primary', bevel=0.012, taper=(1.0, 0.8))
    for height, depth in ((1.12, 0.03), (0.34, 0.07)):
        part.box(V(0, height, depth), (1.36, 0.070, 0.058), 'secondary', right=X, bevel=0.010)
    lean = Matrix.Rotation(math.radians(-9), 4, 'X')
    # Sword, spear and axe that lean on the top rail.
    with part.placed(Matrix.Translation(V(-0.34, 0.14, 0.26)) @ lean):
        part.tube([V(0, 0.90, 0), V(0, 1.06, 0)], [0.016, 0.016], 4, 'secondary', up=Z)
        part.box(V(0, 0.885, 0), (0.24, 0.028, 0.034), 'metal', bevel=0.006)
        part.loft([pk.ring(V(0, 0.87, 0), X, Z, 0.044, 0.011, 4), pk.ring(V(0, 0.22, 0), X, Z, 0.034, 0.008, 4)], 'metal',
                  tip_end=V(0, 0.0, 0))
        part.lathe([(0.016, 1.06), (0.028, 1.085), (0.012, 1.11)], 5, 'accent', cap_end=True)
    with part.placed(Matrix.Translation(V(0.02, 0.02, 0.27)) @ lean):
        part.tube([V(0, 0.0, 0), V(0, 1.62, 0)], [0.017, 0.015], 6, 'primary', up=Z, cap_start=True)
        part.loft([pk.ring(V(0, 1.60, 0), X, Z, 0.020, 0.014, 4), pk.ring(V(0, 1.68, 0), X, Z, 0.050, 0.012, 4)], 'metal',
                  tip_end=V(0, 1.92, 0))
    with part.placed(Matrix.Translation(V(0.38, 0.02, 0.27)) @ lean):
        part.tube([V(0, 0.0, 0), V(0, 1.12, 0)], [0.018, 0.016], 6, 'primary', up=Z, cap_start=True, cap_end=True)
        part.slab([V(0.01, 0.84, 0), V(0.20, 0.74, 0), V(0.22, 1.10, 0), V(0.01, 1.02, 0)], 0.016, 'metal', normal=Z,
                  shrink=0.9, back=True)
    # Round shield on the low rail.
    part.lathe([(0.25, 0.0), (0.27, 0.02), (0.20, 0.05)], 8, 'accent', center=(0, 0, 0), cap_start=True, cap_end=True)
    shield_ids = part.pos[-24:]
    turn = Matrix.Translation(V(-0.02, 0.36, 0.13)) @ Matrix.Rotation(math.radians(76), 4, 'X')
    for index in range(len(part.pos) - 24, len(part.pos)):
        part.pos[index] = turn @ part.pos[index]
    del shield_ids


def prop_war_banner(part):
    part.box(V(0, 0.09, 0), (0.50, 0.18, 0.50), 'skin', taper=0.74, bevel=0.03, corner=0.05, ao=-0.06)
    part.tube([V(0, 0.16, 0), V(0, 3.02, 0)], [0.032, 0.026], 6, 'primary', up=Z)
    part.lathe([(0.026, 3.02), (0.050, 3.07), (0.020, 3.14)], 6, 'metal', tip_end=V(0, 3.34, 0))
    part.box(V(0, 2.80, 0.03), (1.02, 0.046, 0.046), 'primary', bevel=0.008)
    rows = [(2.78, 0.0), (2.30, 0.020), (1.82, -0.016), (1.50, 0.012)]
    rings = [[V(-0.44, y, 0.058 + wave), V(0.0, y, 0.058 - wave * 0.6), V(0.44, y, 0.058 + wave)] for y, wave in rows]
    rings.append([V(-0.44, 1.14, 0.066), V(0.0, 1.40, 0.052), V(0.44, 1.14, 0.066)])
    part.loft(rings, 'accent', closed=False, toward=Z, band_regions=['accent', 'accent', 'accent', 'metal'],
              two_sided=True, thickness=0.006, inner_ao=-0.16)
    part.plate(V(0, 2.20, 0.066), Z, Y, 0.30, 0.34, 0.012, 'metal', shrink=0.6, corner=0.09)
    for side in (-1, 1):
        part.prism(V(side * 0.48, 2.78, 0.03), V(side * 0.48, 2.52, 0.03), 0.022, 0.004, 4, 'metal', up=Z)


# --------------------------------------------------------------------------
# WW2
# --------------------------------------------------------------------------

def epaulette(part, body, region, grow=0.018):
    """Left shoulder strap plate. Use inside `part.mirrored()`."""
    sh = body.torso['shoulder']
    nb = body.torso['neck_base']
    p_sh = V(sh.w + grow * 0.85, sh.y, sh.zc)
    p_nb = V(nb.w + grow * 0.65, nb.y, nb.zc)
    slope = p_sh - p_nb
    slope.z = 0.0
    length = slope.length
    tangent = slope / max(length, 1e-4)
    normal = V(-tangent.y, tangent.x, 0.0)
    anchor = p_nb.lerp(p_sh, 0.54)
    center = anchor + normal * 0.004
    strap_len = min(0.058, length * 0.72)
    with part.skinned(pk.SKIN_TORSO), part.anchored(anchor):
        part.plate(center, normal, Z, strap_len, 0.038, 0.008, region, shrink=0.8)


def torso_ww2_field_jacket(part, body):
    part.covers = ['chest', 'upperarm', 'forearm', 'legs_waist']
    neck = body.torso['neck_base'].y
    armhole = torso_stack(part, body, [('hips', 0.017, {'y': 1.068, 'hem': 0.012}), ('belt', 0.018), ('waist', 0.016), ('ribs', 0.015),
                             ('chest', 0.017), ('shoulder', 0.015), ('neck_base', 0.009)], 'primary', sleeves=True)
    torso_stack(part, body, [('neck_base', 0.010, {'y': neck - 0.004}), ('neck_base', 0.020, {'y': neck + 0.018}),
                             ('neck_base', 0.012, {'y': neck + 0.044, 'skin': SKIN_NECK})], 'primary', band_ao=[-0.1, 0.06])
    belt(part, body, 1.130, 0.018, 0.056, 'secondary', bulge=0.006, flat=False)
    torso_plate(part, body, 1.130, 2, 0.030, 0.056, 0.044, 0.010, 'metal')
    with part.mirrored():
        arm_stack(part, body, [(0, 0.010), (1, 0.011), (2, 0.011), (3, 0.008), (4, 0.009), (5.55, 0.012),
                               (6.0, 0.010), (6.0, 0.000, 0.654)], 'primary', armhole=armhole,
                  band_ao=[0, 0, 0, 0, 0, -0.08, -0.22])
        torso_plate(part, body, 1.425, 1, 0.034, 0.068, 0.086, 0.012, 'primary', shrink=0.84, ao=0.05)
        torso_plate(part, body, 1.474, 1, 0.035, 0.072, 0.030, 0.018, 'primary', shrink=0.86, ao=-0.07)
        torso_plate(part, body, 1.118, 1, 0.025, 0.068, 0.078, 0.012, 'secondary', shrink=0.84, ao=-0.02)
        epaulette(part, body, 'primary')


def torso_ww2_trenchcoat(part, body):
    part.covers = ['chest', 'upperarm', 'forearm', 'legs_waist', 'legs_seat_sides', 'legs_seat_back']
    neck = body.torso['neck_base'].y
    armhole = torso_stack(part, body, [('belt', 0.015, {'y': 1.158}), ('waist', 0.016), ('ribs', 0.016), ('chest', 0.018),
                             ('shoulder', 0.016), ('neck_base', 0.010)], 'primary', sleeves=True)
    # Split left/right coat tails with a center-back vent and open front so trousers/front-flap stay visible and thighs move freely.
    skirt_rings = pk.skirt_tail_rings(body, [
        {'y': 1.158, 'clearance': 0.001, 'back_x': 0.012, 'front_x': 0.048},
        {'y': 1.060, 'clearance': 0.008, 'back_x': 0.014, 'front_x': 0.064,
         'front_pad': 0.026, 'back_pad': 0.024},
        {'y': 0.985, 'clearance': 0.007, 'back_x': 0.016, 'front_x': 0.066, 'front_pad': 0.026, 'back_pad': 0.032},
        {'y': 0.900, 'clearance': 0.006, 'back_x': 0.018, 'front_x': 0.068, 'front_pad': 0.018, 'back_pad': 0.028},
        {'y': 0.680, 'clearance': 0.005, 'back_x': 0.020, 'front_x': 0.070, 'front_pad': 0.008, 'back_pad': 0.010},
    ], diag_deg=41.0, two_sided_margin=0.0045)
    skirt_cells = pk.skirt_cell_skins(
        [1.0, 0.35, 0.06, 0.0, 0.0],
        [1.0, 0.95, 0.92, 0.45, 0.0],
        [1.0, 0.32, 0.06, 0.0, 0.0],
        [1.0, 0.35, 0.06, 0.0, 0.0],
    )
    with part.mirrored():
        part.loft(skirt_rings, 'primary', cell_skins=skirt_cells, closed=False,
                  band_ao=[0.0, 0.0, 0.0, -0.04], two_sided=True, thickness=0.004, inner_ao=-0.22)
    torso_stack(part, body, [('neck_base', 0.012, {'y': neck - 0.004}), ('neck_base', 0.018, {'y': neck + 0.038, 'skin': SKIN_NECK})],
                'primary', ao=0.05)
    torso_stack(part, body, [('belt', 0.019, {'y': 1.140}), ('belt', 0.019, {'y': 1.180})], 'secondary', ao=-0.05)
    torso_plate(part, body, 1.160, 2, 0.028, 0.060, 0.042, 0.010, 'metal')
    # Multi-station bevelled lapels following ribs/chest/shoulder so the convex chest never pokes through.
    w_ribs = pk.station_at(body, 1.355).w
    w_chest = body.torso['chest'].w
    w_sh = body.torso['shoulder'].w
    w_top = pk.station_at(body, neck - 0.008).w
    chest_y = body.torso['chest'].y
    sh_y = body.torso['shoulder'].y
    lapel_rows = [
        (1.355, min(0.064, w_ribs * 0.44), 0.008, 0.019, 0.029),
        (chest_y, min(0.084, w_chest * 0.48), 0.018, 0.021, 0.031),
        (sh_y, min(0.088, w_sh * 0.52), 0.028, 0.019, 0.029),
        (neck - 0.008, min(0.046, w_top * 0.72), 0.022, 0.014, 0.023),
    ]
    with part.mirrored():
        front_bevel_panel(part, body, lapel_rows, 'primary', inset=0.004, ao=0.07,
                          tip_start=pk.torso_point(body, 1.295, 0.010, 0.023))
        with part.skinned(pk.SKIN_TORSO):
            base_pt = pk.torso_point(body, 1.30, 0.045, 0.023)
            with part.anchored(pk.torso_point(body, 1.30, 0.045)):
                part.loft([pk.rect_ring(base_pt, X, Y, 0.012, 0.012)], 'metal',
                          tip_end=base_pt + Z * 0.009, toward=Z, ao=0.06)
    with part.mirrored():
        arm_stack(part, body, [(0, 0.010), (1, 0.012), (2, 0.011), (3, 0.009), (4, 0.010),
                               (5.5, 0.011), (6.0, 0.011), (6.0, 0.000, 0.654)],
                  'primary', armhole=armhole, band_ao=[0, 0, 0, 0, 0, 0, -0.22])
        epaulette(part, body, 'primary', grow=0.018)


def legs_ww2_field_trousers(part, body):
    part.covers = ['pelvis', 'thigh', 'shin', 'foot']
    pelvis_shell(part, body, 'primary', ao=-0.05)
    with part.mirrored():
        leg_stack(part, body, [(0, 0.009), (1, 0.011), (2, 0.010), (3.45, 0.012), (3.45, 0.021),
                               (5, 0.017), (6, 0.015), (7, 0.011)],
                  'primary', band_regions=['primary', 'primary', 'primary', 'secondary', 'secondary', 'secondary', 'secondary'],
                  band_ao=[-0.05, -0.05, -0.05, -0.2, 0, 0, -0.08])
        pk.build_foot(part, body, 'secondary', grow=0.012, sole=0.014, sole_region='metal', ao=-0.1)


def legs_ww2_officer_breeches(part, body):
    part.covers = ['pelvis', 'thigh', 'shin', 'foot']
    pelvis_shell(part, body, 'primary', ao=-0.05)
    with part.mirrored():
        leg_stack(part, body, [(0, 0.009), (1, 0.011), (2.35, 0.010), (2.35, 0.020), (4.0, 0.017),
                               (5, 0.015), (6, 0.014), (7, 0.010)],
                  'primary', band_regions=['primary', 'primary', 'secondary', 'secondary', 'secondary', 'secondary', 'secondary'],
                  band_ao=[-0.05, -0.03, -0.16, -0.06, -0.06, -0.12, -0.12])
        pk.build_foot(part, body, 'secondary', grow=0.012, sole=0.014, sole_region='metal', ao=-0.1)


def headwear_m1_helmet(part, shape=ENVELOPE):
    part.skin = pk.SKIN_HEAD
    pk.head_shell(part, 'primary', 0.034, front=BROW + 0.002, temple=BROW - 0.020, side=BROW - 0.040, back=BROW - 0.048,
                  top_lift=0.004, flare=0.016, ao=-0.06, shape=shape)
    center, normal, _ = head_facet(BROW + 0.034, 1, 0.034, shape)
    part.plate(center, normal, Y, 0.102, 0.016, 0.005, 'secondary', shrink=0.9)
    hat_hair(part, shape)


def headwear_officer_cap(part, shape=ENVELOPE):
    part.skin = pk.SKIN_HEAD
    low, mid = BROW + 0.002, BROW + 0.040
    base = pk.head_ring(shape, low, 0.016)
    band = pk.head_ring(shape, mid, 0.022)
    middle = pk.centroid(band)
    crown = []
    for column, point in enumerate(band):
        lift = 0.064 if column in (1, 2) else (0.046 if column in (0, 3) else 0.030)
        out = V(point.x - middle.x, 0, point.z - middle.z) * 0.36
        crown.append(V(point.x + out.x, mid + lift, point.z + out.z))
    part.loft([base, band, crown], 'primary', band_regions=['accent', 'primary'],
              tip_end=V(0, mid + 0.050, pk.HEAD_Z - 0.010))
    center, normal, _ = head_facet(low, 1, 0.016, shape)
    part.slab([base[1] + V(0, 0.006, 0), base[2] + V(0, 0.006, 0), base[2] + V(-0.012, -0.022, 0.066),
               base[1] + V(0.012, -0.022, 0.066)], 0.008, 'secondary', normal=Y, shrink=0.9, back=True, ao=-0.3)
    center, normal, _ = head_facet(mid + 0.028, 1, 0.040, shape)
    part.plate(center, normal, Y, 0.040, 0.040, 0.010, 'metal', corner=0.012, ao=0.1)
    hat_hair(part, shape)


def back_ww2_field_pack(part, body):
    back = pk.torso_surface_z(body, 1.40, 0.0, 0.018, 'back')
    with part.skinned(SKIN_BACK), part.anchored(pk.torso_point(body, 1.40, 0.0, 0.0, 'back')):
        part.box(V(0, 1.365, back - 0.076), (0.300, 0.360, 0.152), 'secondary', bevel=0.020)
        part.plate(V(0, 1.440, back - 0.152), -Z, Y, 0.262, 0.170, 0.016, 'secondary', shrink=0.9, ao=0.06)
        for side in (1, -1):
            part.plate(V(side * 0.072, 1.340, back - 0.166), -Z, Y, 0.030, 0.050, 0.008, 'metal')
        part.tube([V(-0.176, 1.590, back - 0.072), V(0.176, 1.590, back - 0.072)], [0.052, 0.052], 5, 'primary', up=Y,
                  cap_start=True, cap_end=True, ao=-0.04)
        part.lathe([(0.046, 1.205), (0.056, 1.245), (0.056, 1.315), (0.030, 1.345)], 5, 'metal',
                   center=(-0.196, 0, back - 0.080), cap_start=True, cap_end=True)
    with part.mirrored():
        shoulder_strap(part, body, 'secondary')


def held_rifle(part):
    # Compact folding-stock carbine: angled outward (-13 deg Y) & shifted (-X, +Y, +Z) so butt/receiver clear forearm/palm.
    def section(z, y, half_w, half_h):
        return pk.ring(V(0, y, z), X, Y, half_w, half_h, 6, squareness=0.8, phase=math.pi / 6)

    xform = Matrix.Translation(V(-0.017, 0.018, 0.022)) @ Matrix.Rotation(math.radians(-13), 4, 'Y')
    with part.placed(xform):
        grip = Matrix.Rotation(math.radians(-14), 4, 'X')
        with part.placed(Matrix.Translation(V(0, -0.016, -0.004)) @ grip):
            part.box(V(0, 0, 0), (0.028, 0.094, 0.044), 'secondary', taper=0.9)
        part.loft([section(-0.062, 0.034, 0.021, 0.034), section(0.110, 0.036, 0.022, 0.032),
                   section(0.540, 0.038, 0.020, 0.024)], 'secondary', cap_start=True, cap_end=True)
        part.box(V(0, 0.062, 0.058), (0.034, 0.044, 0.220), 'metal', bevel=0.008)
        part.tube([V(0, 0.062, 0.168), V(0, 0.062, 0.880)], [0.014, 0.012], 6, 'metal', up=Y, cap_end=True)
        part.plate(V(0, 0.074, 0.830), Y, Z, 0.012, 0.030, 0.026, 'metal', shrink=0.6)
        part.plate(V(0, 0.084, -0.024), Y, Z, 0.022, 0.040, 0.018, 'metal', shrink=0.6)
        part.slab([V(0, 0.002, 0.024), V(0, 0.002, 0.104), V(0, -0.032, 0.086), V(0, -0.032, 0.042)], 0.010, 'metal',
                  normal=X, shrink=0.9, back=True)
        part.box(V(0, 0.008, 0.158), (0.028, 0.054, 0.058), 'metal')
        # Folded carbine wire stock along outer (-X) flank forward of z=-0.062.
        part.box(V(-0.015, 0.048, 0.120), (0.008, 0.014, 0.340), 'metal')
        part.box(V(-0.005, 0.038, -0.056), (0.028, 0.062, 0.012), 'metal')


def held_smg(part):
    # Retracted-stock SMG: angled outward (-13 deg Y) & shifted outward (-X) within palm-back bounds (minX >= -0.032).
    xform = Matrix.Translation(V(-0.017, 0.016, 0.022)) @ Matrix.Rotation(math.radians(-13), 4, 'Y')
    with part.placed(xform):
        grip = Matrix.Rotation(math.radians(-14), 4, 'X')
        with part.placed(Matrix.Translation(V(0, -0.016, 0.0)) @ grip):
            part.box(V(0, 0, 0), (0.024, 0.094, 0.044), 'secondary', taper=0.9)
        part.box(V(0, 0.058, 0.105), (0.032, 0.062, 0.330), 'metal', bevel=0.010)
        part.tube([V(0, 0.062, 0.270), V(0, 0.062, 0.470)], [0.020, 0.018], 6, 'metal', up=Y)
        part.tube([V(0, 0.062, 0.470), V(0, 0.062, 0.560)], [0.014, 0.017], 6, 'metal', up=Y, cap_start=True, cap_end=True)
        part.box(V(0, -0.036, 0.195), (0.024, 0.132, 0.042), 'metal', ao=-0.1)
        front = Matrix.Rotation(math.radians(8), 4, 'X')
        with part.placed(Matrix.Translation(V(0, -0.012, 0.330)) @ front):
            part.box(V(0, 0, 0), (0.026, 0.092, 0.040), 'secondary', taper=0.86)
        part.box(V(-0.015, 0.048, 0.060), (0.008, 0.014, 0.220), 'metal')
        part.box(V(-0.004, 0.042, -0.056), (0.028, 0.068, 0.012), 'secondary')
        part.plate(V(0, 0.090, -0.032), Y, Z, 0.018, 0.034, 0.016, 'metal', shrink=0.6)


def held_pistol(part):
    # Weapons are 1.15 times life size so that they read at a distance (rule F2).
    # Angle outward (-14 deg Y) and shift (-X, +Y, +Z) so slide & barrel clear palm and thigh_r/trenchcoat.
    xform = Matrix.Translation(V(-0.018, 0.022, 0.028)) @ Matrix.Rotation(math.radians(-14), 4, 'Y') @ Matrix.Scale(1.15, 4)
    with part.placed(xform):
        grip = Matrix.Rotation(math.radians(-12), 4, 'X')
        with part.placed(Matrix.Translation(V(0, -0.014, -0.006)) @ grip):
            part.box(V(0, 0, 0), (0.024, 0.092, 0.044), 'secondary', bevel=0.007, taper=0.92)
        part.box(V(0, 0.050, 0.056), (0.026, 0.040, 0.200), 'metal', bevel=0.008)
        part.tube([V(0, 0.046, 0.152), V(0, 0.046, 0.180)], [0.011, 0.011], 6, 'metal', up=Y, cap_end=True, ao=-0.2)
        part.slab([V(0, 0.030, 0.026), V(0, 0.030, 0.094), V(0, -0.004, 0.080), V(0, -0.004, 0.036)], 0.008, 'metal',
                  normal=X, shrink=0.9, back=True)
        part.plate(V(0, 0.070, -0.032), Y, Z, 0.016, 0.026, 0.014, 'metal', shrink=0.6)


def held_ww2_dispatch(part):
    # Turn the printed face toward the camera at the left hand socket.
    with part.placed(Matrix.Rotation(math.radians(-75), 4, 'Z')):
        # Keep the folded tab narrow through the grip.
        sections = [(0, -.022, .028), (0, .027, .028), (0, .042, .09),
                    (.034, .138, .09), (.034, .218, .09)]
        rings = [pk.rect_ring(V(x, 0, z), X, Y, .001, half_width) for x, z, half_width in sections]
        part.loft(rings, 'skin', cap_start=True, cap_end=True, ao=.25)

        # Print on the flat panel above the grip.
        for y, length in [(.051, .042), (.040, .031)]:
            part.plate(V(.033, y, .175), -X, Y, length, .003, .0003, 'secondary')
        part.plate(V(.033, -.046, .178), -X, Y, .025, .021, .0003, 'accent', corner=.005)


def held_ammo_can(part):
    # Left hand carry: handle at palm x=+0.006 (<=0.032), straps angle outward (+X) so heavy can clears thigh_l/trousers.
    part.tube([V(0.006, -0.062, 0), V(0.006, 0.062, 0)], [0.013, 0.013], 6, 'metal', up=Z)
    cx = 0.168
    for side in (1, -1):
        sy = side * 0.064
        part.loft([
            pk.rect_ring(V(0.008, sy, -0.004), X, Y, 0.009, 0.009),
            pk.rect_ring(V(0.020, sy, 0.030), X, Y, 0.009, 0.009),
            pk.rect_ring(V(cx, sy, 0.095), X, Y, 0.010, 0.009),
        ], 'metal', cap_start=True, cap_end=True)
    part.box(V(cx, 0, 0.190), (0.300, 0.200, 0.150), 'primary', right=Y, up=Z, bevel=0.012, corner=0.014)
    part.plate(V(cx, 0, 0.090), -Z, Y, 0.130, 0.270, 0.014, 'primary', shrink=0.9, ao=0.06)
    for side in (1, -1):
        part.plate(V(cx + side * 0.075, 0, 0.190), X * side, Y, 0.110, 0.180, 0.006, 'accent', shrink=0.9)
    part.plate(V(cx, 0.150, 0.130), Y, Z, 0.050, 0.060, 0.010, 'metal')


def prop_sandbag_wall(part):
    rows = [(0.105, [-0.96, -0.32, 0.32, 0.96], 0.0), (0.300, [-0.64, 0.0, 0.64], 0.02), (0.495, [-0.32, 0.32], -0.02)]
    count = 0
    for height, columns, depth in rows:
        for x in columns:
            turn = Matrix.Rotation(math.radians((count % 3 - 1) * 5), 4, 'Y')
            with part.placed(Matrix.Translation(V(x, height, depth)) @ turn):
                part.box(V(0, 0, 0), (0.60, 0.21, 0.32), 'skin', bevel=0.055, corner=0.07, taper=0.94,
                         ao=-0.05 * (count % 3))
            count += 1


def prop_jerrycan(part):
    part.box(V(0, 0.215, 0), (0.340, 0.430, 0.160), 'primary', bevel=0.022, corner=0.030)
    for side in (1, -1):
        for angle in (34, -34):
            up = Matrix.Rotation(math.radians(angle), 4, 'Z') @ Y
            part.plate(V(0, 0.210, side * 0.080), Z * side, up, 0.036, 0.330, 0.010, 'primary', shrink=0.8, ao=0.07)
    for x in (-0.082, 0.0, 0.082):
        part.box(V(x * 0.9 - 0.02, 0.455, 0), (0.024, 0.050, 0.110), 'primary', bevel=0.006, ao=-0.08)
    part.box(V(-0.02, 0.482, 0), (0.230, 0.022, 0.110), 'primary', bevel=0.006)
    part.lathe([(0.030, 0.430), (0.030, 0.492), (0.022, 0.508)], 6, 'metal', center=(0.125, 0, 0), cap_end=True)


def prop_ammo_crate(part):
    part.box(V(0, 0.150, 0), (0.800, 0.300, 0.360), 'primary', bevel=0.012)
    part.plate(V(0, 0.300, 0), Y, Z, 0.760, 0.320, 0.022, 'primary', shrink=0.96, ao=0.05)
    for side in (1, -1):
        part.box(V(side * 0.408, 0.160, 0), (0.030, 0.230, 0.340), 'secondary', bevel=0.006)
        part.box(V(side * 0.436, 0.185, 0), (0.030, 0.040, 0.160), 'secondary', bevel=0.008, ao=-0.1)
    part.plate(V(0, 0.150, 0.180), Z, Y, 0.460, 0.090, 0.005, 'accent', shrink=0.96)
    for x in (-0.24, 0.24):
        part.plate(V(x, 0.270, 0.180), Z, Y, 0.060, 0.070, 0.014, 'metal')


def prop_field_radio(part):
    part.box(V(0, 0.190, 0), (0.440, 0.340, 0.200), 'primary', bevel=0.020, corner=0.024)
    for x in (-0.16, 0.16):
        part.box(V(x, 0.012, 0), (0.060, 0.024, 0.180), 'secondary', bevel=0.006)
    part.plate(V(0, 0.200, 0.100), Z, Y, 0.380, 0.270, 0.008, 'secondary', shrink=0.94, ao=-0.24)
    for x, radius in ((-0.110, 0.042), (0.020, 0.030)):
        part.tube([V(x, 0.230, 0.108), V(x, 0.230, 0.140)], [radius, radius * 0.8], 6, 'metal', up=Y, cap_end=True)
    part.plate(V(0.120, 0.250, 0.108), Z, Y, 0.090, 0.060, 0.008, 'accent', shrink=0.88, ao=0.1)
    part.plate(V(0.120, 0.150, 0.108), Z, Y, 0.090, 0.050, 0.010, 'metal', shrink=0.8)
    part.tube([V(-0.170, 0.360, -0.050), V(-0.170, 1.660, -0.050)], [0.010, 0.005], 4, 'metal', up=Z, cap_end=True)
    part.box(V(0.030, 0.386, -0.010), (0.240, 0.040, 0.050), 'secondary', bevel=0.010, ao=-0.2)
    for x in (-0.07, 0.13):
        part.box(V(x, 0.376, -0.010), (0.056, 0.050, 0.060), 'secondary', bevel=0.010, ao=-0.26)


# --------------------------------------------------------------------------
# Sim
# --------------------------------------------------------------------------

def sneaker(part, body):
    pk.build_foot(part, body, 'accent', grow=0.010, sole=0.020, sole_region='metal')


def torso_sim_hoodie(part, body):
    part.covers = ['chest', 'upperarm', 'forearm', 'legs_waist']
    neck = body.torso['neck_base'].y
    armhole = torso_stack(part, body, [('hips', 0.017, {'y': 1.072, 'hem': 0.011}), ('hips', 0.022, {'y': 1.100}), ('belt', 0.021), ('waist', 0.018),
                             ('ribs', 0.018), ('chest', 0.020), ('shoulder', 0.018), ('neck_base', 0.010)], 'primary', sleeves=True,
                band_ao=[-0.12, 0, 0, 0, 0, 0, 0])
    # Hood that lies on the upper back.
    torso_stack(part, body, [('neck_base', 0.011, {'y': neck - 0.006}),
                             ('neck_base', 0.022, {'y': neck + 0.024, 'back': 0.042}),
                             ('neck_base', 0.014, {'y': neck + 0.058, 'back': 0.036, 'skin': SKIN_NECK})], 'primary',
                band_ao=[-0.08, 0.05])
    # Kangaroo pocket conforms across belt (1.135) so outer corners never tuck into body_heavy/orc.
    w_hip = pk.station_at(body, 1.085).w
    w_belt = body.torso['belt'].w
    w_waist = body.torso['waist'].w
    p_bot = min(0.092, w_hip * 0.58)
    p_mid = min(0.080, w_belt * 0.54)
    p_top = min(0.062, w_waist * 0.46)
    front_bevel_panel(part, body, [
        (1.085, p_bot, -p_bot, 0.024, 0.034),
        (1.135, p_mid, -p_mid, 0.023, 0.034),
        (1.215, p_top, -p_top, 0.020, 0.031),
    ], 'primary', inset=0.005, ao=-0.08, cap_start=True, cap_end=True)
    with part.skinned(pk.SKIN_TORSO):
        for side in (1, -1):
            with part.anchored(pk.torso_point(body, 1.50, side * 0.030)):
                part.plate(pk.torso_point(body, 1.490, side * 0.030, 0.030), Z, Y, 0.014, 0.104, 0.009, 'accent')
    with part.mirrored():
        arm_stack(part, body, [(0, 0.011), (1, 0.012), (2, 0.012), (3, 0.012), (4, 0.014), (5.5, 0.015), (5.6, 0.011),
                               (6.0, 0.012), (6.0, 0.000, 0.654)], 'primary', armhole=armhole,
                  band_ao=[0, 0, 0, 0, 0, -0.16, -0.1, -0.22])


def torso_sim_blazer(part, body):
    part.covers = ['chest', 'upperarm', 'forearm', 'legs_waist']
    neck = body.torso['neck_base'].y
    armhole = torso_stack(part, body, [('hips', 0.018, {'y': 1.066, 'hem': 0.012}), ('belt', 0.018), ('waist', 0.016), ('ribs', 0.016),
                             ('chest', 0.018), ('shoulder', 0.017), ('neck_base', 0.009)], 'primary', sleeves=True)
    torso_stack(part, body, [('neck_base', 0.010, {'y': neck - 0.004}), ('neck_base', 0.009, {'y': neck + 0.026, 'skin': SKIN_NECK})],
                'metal', ao=0.12)
    # Curved V-front shirt panel conforming across ribs/chest/shoulder proud of the blazer shell.
    chest_y = body.torso['chest'].y
    sh_y = body.torso['shoulder'].y
    shirt_spec = [(1.355, 0.024, 0.022), (chest_y, 0.042, 0.025), (sh_y, 0.048, 0.024), (neck - 0.004, 0.030, 0.018)]
    shirt_rings = [
        [pk.torso_point(body, y, hw, grow), pk.torso_point(body, y, 0.0, grow), pk.torso_point(body, y, -hw, grow)]
        for y, hw, grow in shirt_spec
    ]
    shirt_refs = [
        [pk.torso_point(body, y, hw), pk.torso_point(body, y, 0.0), pk.torso_point(body, y, -hw)]
        for y, hw, _ in shirt_spec
    ]
    with part.skinned(pk.SKIN_TORSO):
        part.loft(shirt_rings, 'metal', refs=shirt_refs, closed=False, toward=Z, ao=0.14,
                  tip_start=pk.torso_point(body, 1.275, 0.0, 0.022))
    # 3D bevelled tie with knot and pointed blade sitting cleanly proud of the shirt at every chest station.
    front_bevel_panel(part, body, [
        (1.365, 0.016, -0.016, 0.028, 0.037),
        (chest_y, 0.015, -0.015, 0.032, 0.041),
        (sh_y, 0.012, -0.012, 0.030, 0.039),
        (sh_y + 0.008, 0.015, -0.015, 0.026, 0.035),
        (neck - 0.004, 0.011, -0.011, 0.022, 0.030),
    ], 'accent', inset=0.003, tip_start=pk.torso_point(body, 1.315, 0.0, 0.032), cap_end=True)
    # Mirrored multi-station blazer lapels framing the V-opening outside the tie up to the collar.
    w_ribs = pk.station_at(body, 1.355).w
    w_chest = body.torso['chest'].w
    w_sh = body.torso['shoulder'].w
    w_top = pk.station_at(body, neck - 0.006).w
    lapel_rows = [
        (1.355, min(0.060, w_ribs * 0.40), 0.020, 0.022, 0.030),
        (chest_y, min(0.078, w_chest * 0.44), 0.032, 0.024, 0.033),
        (sh_y, min(0.082, w_sh * 0.50), 0.036, 0.025, 0.033),
        (neck - 0.006, min(0.046, w_top * 0.72), 0.024, 0.019, 0.026),
    ]
    with part.mirrored():
        front_bevel_panel(part, body, lapel_rows, 'primary', inset=0.003, ao=0.08,
                          tip_start=pk.torso_point(body, 1.265, 0.014, 0.023), cap_end=True)
    with part.skinned(pk.SKIN_TORSO), part.anchored(pk.torso_point(body, 1.20, 0.0)):
        for height in (1.150, 1.235):
            part.plate(pk.torso_point(body, height, 0.012, 0.019), Z, Y, 0.024, 0.024, 0.008, 'metal', corner=0.007)
    torso_plate(part, body, 1.448, 1, 0.024, 0.050, 0.020, 0.008, 'accent', shrink=0.9)
    with part.mirrored():
        arm_stack(part, body, [(0, 0.011), (1, 0.012), (2, 0.012), (3, 0.011), (4, 0.013), (5.6, 0.014), (5.6, 0.008),
                               (6.0, 0.009), (6.0, 0.000, 0.654)], 'primary', armhole=armhole,
                  band_regions=['primary'] * 5 + ['metal', 'metal', 'metal'],
                  band_ao=[0, 0, 0, 0, 0, -0.1, 0.12, -0.22])


def torso_sim_varsity(part, body):
    part.covers = ['chest', 'upperarm', 'forearm', 'legs_waist']
    neck = body.torso['neck_base'].y
    armhole = torso_stack(part, body, [('hips', 0.017, {'y': 1.072, 'hem': 0.011}), ('hips', 0.019, {'y': 1.098}), ('belt', 0.015), ('waist', 0.013),
                             ('ribs', 0.012), ('chest', 0.013), ('shoulder', 0.012), ('neck_base', 0.008),
                             ('neck_base', 0.010, {'y': neck + 0.028, 'skin': SKIN_NECK})], 'primary', sleeves=True,
                band_regions=['accent'] + ['primary'] * 6 + ['accent'])
    front_strip(part, body, [(1.085, 0.014, 0.023), (1.135, 0.014, 0.019), (1.235, 0.014, 0.017),
                             (1.355, 0.014, 0.018), (body.torso['chest'].y, 0.014, 0.019), (body.torso['shoulder'].y, 0.014, 0.018),
                             (body.torso['shoulder'].y + 0.008, 0.014, 0.016)], 'metal', ao=0.08)
    torso_plate(part, body, 1.440, 1, 0.025, 0.064, 0.078, 0.009, 'accent', shrink=0.8, corner=0.014)
    with part.mirrored():
        arm_stack(part, body, [(0, 0.010), (1, 0.011), (2, 0.011), (3, 0.009), (4, 0.010), (5.5, 0.010), (5.6, 0.008),
                               (6.0, 0.009), (6.0, 0.000, 0.654)], 'metal', armhole=armhole,
                  band_regions=['metal'] * 5 + ['accent', 'accent', 'accent'],
                  band_ao=[0.06, 0.06, 0.06, 0.06, 0.06, -0.16, 0, -0.22])


def legs_sim_jeans(part, body):
    part.covers = ['pelvis', 'thigh', 'shin', 'foot']
    pelvis_shell(part, body, 'secondary')
    with part.mirrored():
        leg_stack(part, body, [(0, CLOTH), (1, 0.009), (2, 0.009), (3, 0.0115), (4, 0.011), (5, 0.012), (6, 0.016),
                               (6, 0.004, 0.155), (7, 0.003, 0.125)],
                  'secondary', band_regions=['secondary'] * 7 + ['metal'],
                  band_ao=[0, 0, 0, 0, 0, 0.08, -0.20, -0.06])
        sneaker(part, body)


def legs_sim_shorts(part, body):
    part.covers = ['pelvis', 'thigh', 'foot']
    pelvis_shell(part, body, 'secondary')
    with part.mirrored():
        leg_stack(part, body, [(0, 0.010), (1, 0.017), (1.82, 0.022), (1.92, 0.023)], 'secondary',
                  band_regions=['secondary', 'secondary', 'accent'])
        leg_stack(part, body, [(5.15, 0.008), (6.0, 0.009), (7.0, 0.005)], 'metal', ao=0.08)
        sneaker(part, body)


def headwear_sim_cap(part, shape=ENVELOPE):
    part.skin = pk.SKIN_HEAD
    pk.head_shell(part, 'primary', 0.016, front=BROW + 0.004, temple=BROW - 0.008, side=BROW - 0.022, back=BROW - 0.030,
                  top_lift=0.012, shape=shape)
    part.lathe([(0.018, pk.HEAD_Y['crown'] + 0.022), (0.012, pk.HEAD_Y['crown'] + 0.036)], 6, 'accent',
               center=(0, 0, pk.HEAD_Z), cap_end=True)
    front = pk.head_front_z(shape, BROW, 0.016)
    low = BROW + 0.004
    brim = [V(0.070, low, front - 0.026), V(0.066, low - 0.010, front + 0.046), V(0.036, low - 0.016, front + 0.086),
            V(-0.036, low - 0.016, front + 0.086), V(-0.066, low - 0.010, front + 0.046), V(-0.070, low, front - 0.026)]
    part.slab(brim, 0.010, 'accent', normal=Y, shrink=0.94, back=True)
    hat_hair(part, shape)


def headwear_sim_beanie(part, shape=ENVELOPE):
    part.skin = pk.SKIN_HEAD
    low = BROW - 0.030
    pk.head_shell(part, 'primary', 0.020, front=low + 0.02, temple=low + 0.01, side=low, back=low - 0.014, top_lift=0.030,
                  shape=shape)
    part.loft([pk.head_ring(shape, low - 0.016, 0.022), pk.head_ring(shape, low + 0.012, 0.036),
               pk.head_ring(shape, low + 0.040, 0.024)], 'primary', ao=0.09)
    top = pk.HEAD_Y['crown'] + 0.036
    part.lathe([(0.016, top), (0.042, top + 0.032)], 5, 'accent', center=(0, 0, pk.HEAD_Z),
               tip_end=V(0, top + 0.080, pk.HEAD_Z))
    hat_hair(part, shape, temple=-0.016, side=-0.024, back=-0.130)


def back_sim_daypack(part, body):
    back = pk.torso_surface_z(body, 1.40, 0.0, 0.015, 'back')
    with part.skinned(SKIN_BACK), part.anchored(pk.torso_point(body, 1.40, 0.0, 0.0, 'back')):
        part.box(V(0, 1.370, back - 0.074), (0.290, 0.410, 0.148), 'primary', taper=(0.82, 0.96), bevel=0.024)
        part.plate(V(0, 1.290, back - 0.148), -Z, Y, 0.200, 0.170, 0.034, 'secondary', shrink=0.84)
        part.plate(V(0, 1.470, back - 0.142), -Z, Y, 0.190, 0.022, 0.008, 'accent', shrink=0.94)
        part.box(V(0, 1.592, back - 0.060), (0.090, 0.030, 0.024), 'secondary')
        part.lathe([(0.034, 1.200), (0.038, 1.330), (0.022, 1.350), (0.022, 1.376)], 5, 'metal',
                   center=(0.176, 0, back - 0.070), cap_start=True, cap_end=True, band_regions=['metal', 'metal', 'accent'])
    with part.mirrored():
        shoulder_strap(part, body, 'secondary', low_front=1.26)


def held_coffee_cup(part):
    # Right hand: rotate -30 deg about X so cup stays upright in Idle_Loop/Jog_Fwd_Loop; keep compact & outward from thigh_r.
    xform = Matrix.Translation(V(-0.007, 0.016, 0.022)) @ Matrix.Rotation(math.radians(-30), 4, 'X')
    with part.placed(xform):
        profile = [(0.018, -0.064), (0.020, -0.024), (0.022, -0.024), (0.023, 0.032), (0.021, 0.032), (0.023, 0.064)]
        part.lathe(profile, 8, 'accent', cap_start=True, band_regions=['accent', 'secondary', 'secondary', 'secondary', 'accent'])
        part.lathe([(0.024, 0.064), (0.024, 0.074), (0.018, 0.082)], 8, 'metal', cap_end=True, ao=0.1)


def held_phone(part):
    # Left hand: +X is outward away from thigh_l; screen faces -X (toward reader/palm).
    part.box(V(0.022, 0.040, 0.0), (0.076, 0.156, 0.013), 'secondary', right=Z, up=Y, bevel=0.003, corner=0.010, ao=-0.2)
    part.plate(V(0.0155, 0.040, 0.0), -X, Y, 0.064, 0.140, 0.002, 'accent', shrink=0.97, ao=0.2)


def held_briefcase(part):
    # Left hand carry: handle at palm x=+0.006 (<=0.032), straps angle outward (+X) so briefcase clears thigh_l/jeans.
    part.tube([V(0.006, -0.066, 0), V(0.006, 0.066, 0)], [0.013, 0.013], 6, 'secondary', up=Z)
    cx = 0.150
    for side in (1, -1):
        sy = side * 0.068
        part.loft([
            pk.rect_ring(V(0.008, sy, -0.004), X, Y, 0.009, 0.009),
            pk.rect_ring(V(0.020, sy, 0.028), X, Y, 0.009, 0.009),
            pk.rect_ring(V(cx, sy, 0.072), X, Y, 0.010, 0.009),
        ], 'secondary', cap_start=True, cap_end=True, ao=-0.1)
    part.box(V(cx, 0, 0.230), (0.460, 0.330, 0.110), 'secondary', right=Y, up=Z, bevel=0.014, corner=0.016)
    for side in (1, -1):
        part.plate(V(cx + 0.055, side * 0.130, 0.090), X, Y, 0.040, 0.046, 0.010, 'metal')
        part.plate(V(cx + 0.055, side * 0.215, 0.230), X, Y, 0.330, 0.020, 0.006, 'accent', shrink=0.9)


def prop_cafe_table(part):
    part.lathe([(0.250, 0.0), (0.250, 0.028), (0.060, 0.064), (0.036, 0.090), (0.036, 0.700), (0.090, 0.722)], 10, 'metal',
               cap_start=True)
    part.lathe([(0.110, 0.722), (0.390, 0.730), (0.390, 0.766), (0.368, 0.778)], 10, 'primary', cap_end=True)
    part.lathe([(0.070, 0.778), (0.078, 0.788)], 8, 'skin', center=(0.12, 0, 0.06), cap_end=True)
    part.lathe([(0.030, 0.788), (0.040, 0.850), (0.034, 0.850)], 8, 'accent', center=(0.12, 0, 0.06), cap_end=True)


def prop_park_bench(part):
    for side in (-1, 1):
        x = side * 0.70
        part.box(V(x, 0.225, 0.190), (0.050, 0.450, 0.060), 'metal', bevel=0.010, taper=0.8)
        back = Matrix.Translation(V(x, 0.0, -0.200)) @ Matrix.Rotation(math.radians(-12), 4, 'X')
        with part.placed(back):
            part.box(V(0, 0.450, 0), (0.050, 0.900, 0.060), 'metal', bevel=0.010, taper=0.8)
        part.box(V(x, 0.430, 0.0), (0.050, 0.040, 0.460), 'metal', bevel=0.008)
        part.box(V(x, 0.640, -0.020), (0.064, 0.036, 0.480), 'metal', bevel=0.010)
    for depth in (-0.130, 0.010, 0.150):
        part.box(V(0, 0.470, depth), (1.560, 0.034, 0.118), 'primary', bevel=0.008, ao=0.03 if depth == 0.010 else 0)
    for height, depth in ((0.640, -0.315), (0.800, -0.350)):
        tilt = Matrix.Translation(V(0, height, depth)) @ Matrix.Rotation(math.radians(-12), 4, 'X')
        with part.placed(tilt):
            part.box(V(0, 0, 0), (1.560, 0.120, 0.034), 'primary', bevel=0.008)


def prop_street_bollard(part):
    profile = [(0.115, 0.0), (0.115, 0.050), (0.078, 0.090), (0.072, 0.600), (0.079, 0.600), (0.079, 0.690), (0.072, 0.690),
               (0.072, 0.790), (0.090, 0.820), (0.090, 0.860)]
    regions = ['metal', 'metal', 'metal', 'accent', 'accent', 'accent', 'metal', 'metal', 'metal']
    part.lathe(profile, 8, 'metal', cap_start=True, band_regions=regions, tip_end=V(0, 0.940, 0))


def prop_planter(part):
    part.lathe([(0.300, 0.0), (0.380, 0.400), (0.410, 0.400), (0.410, 0.470), (0.350, 0.470), (0.350, 0.420)], 4, 'skin',
               cap_start=True, phase=math.pi / 4)
    part.lathe([(0.350, 0.420)], 4, 'secondary', cap_end=True, phase=math.pi / 4, ao=-0.2)
    for x, z, size, height in ((0.0, 0.0, 1.0, 0.46), (0.13, 0.09, 0.72, 0.42), (-0.12, -0.08, 0.78, 0.42),
                               (-0.08, 0.13, 0.6, 0.40)):
        part.lathe([(0.110 * size, height), (0.230 * size, height + 0.14 * size), (0.170 * size, height + 0.32 * size)],
                   5, 'hair', center=(x, 0, z), cap_start=True, tip_end=V(x, height + 0.46 * size, z),
                   phase=x * 7 + z * 3)


# --------------------------------------------------------------------------
# Cyberpunk
# --------------------------------------------------------------------------

def torso_cyber_edgerunner(part, body):
    part.covers = ['chest', 'upperarm', 'forearm', 'legs_waist']
    neck = body.torso['neck_base'].y
    armhole = torso_stack(part, body, [('hips', 0.017, {'y': 1.072, 'hem': 0.012}), ('hips', 0.019, {'y': 1.098}), ('belt', 0.015),
                             ('waist', 0.014), ('ribs', 0.015), ('chest', 0.017), ('shoulder', 0.016), ('neck_base', 0.010)],
                'primary', sleeves=True, band_ao=[-0.08, 0, 0, 0, 0.02, 0.02, 0])
    # High flared tech-collar with glowing neon inner rim.
    torso_stack(part, body, [('neck_base', 0.011, {'y': neck - 0.004}),
                             ('neck_base', 0.022, {'y': neck + 0.032, 'widen': 0.010, 'back': 0.020, 'front': 0.008}),
                             ('neck_base', 0.024, {'y': neck + 0.062, 'widen': 0.014, 'back': 0.026, 'front': 0.006, 'skin': SKIN_NECK})],
                'primary', band_regions=['primary', 'accent'], band_ao=[-0.06, 0.14])
    belt(part, body, 1.132, 0.016, 0.044, 'secondary', bulge=0.007, flat=False)
    torso_plate(part, body, 1.132, 2, 0.026, 0.048, 0.036, 0.010, 'metal')
    # Central neon data strip and asymmetric tech-plate on left chest.
    front_strip(part, body, [(1.170, 0.011, 0.019), (1.235, 0.011, 0.018), (1.355, 0.012, 0.020),
                             (body.torso['chest'].y, 0.012, 0.022), (body.torso['shoulder'].y, 0.012, 0.021), (neck - 0.004, 0.011, 0.017)],
                'accent', ao=0.14)
    torso_plate(part, body, 1.445, 1, 0.026, 0.058, 0.066, 0.010, 'secondary', shrink=0.84, ao=0.02)
    torso_plate(part, body, 1.445, 1, 0.034, 0.042, 0.020, 0.008, 'metal', shrink=0.88)
    with part.mirrored():
        arm_stack(part, body, [(0, 0.011), (1, 0.013), (2, 0.012), (2.9, 0.013), (3.1, 0.009), (4, 0.010),
                               (5.45, 0.011), (5.65, 0.013), (6.0, 0.010), (6.0, 0.000, 0.654)],
                  'primary', armhole=armhole,
                  band_regions=['primary', 'primary', 'primary', 'secondary', 'metal', 'metal', 'accent', 'metal', 'metal'],
                  band_ao=[0, 0.02, 0, -0.14, 0.04, 0.04, 0.16, 0.0, -0.22])


def torso_cyber_netrunner(part, body):
    part.covers = ['chest', 'upperarm', 'forearm', 'legs_waist']
    neck = body.torso['neck_base'].y
    armhole = torso_stack(part, body, [('hips', 0.016, {'y': 1.074, 'hem': 0.011}), ('belt', 0.013), ('waist', 0.011),
                             ('ribs', 0.012), ('chest', 0.014), ('shoulder', 0.012), ('neck_base', 0.009),
                             ('neck_base', 0.012, {'y': neck + 0.036, 'skin': SKIN_NECK})],
                'secondary', sleeves=True,
                band_regions=['secondary', 'secondary', 'secondary', 'primary', 'primary', 'secondary', 'accent'],
                band_ao=[-0.06, 0, 0, 0.04, 0.04, -0.04, 0.14])
    front_strip(part, body, [(1.140, 0.012, 0.017), (1.235, 0.014, 0.016), (1.355, 0.016, 0.017),
                             (body.torso['chest'].y, 0.018, 0.019), (body.torso['shoulder'].y, 0.014, 0.017), (neck - 0.004, 0.010, 0.014)],
                'accent', ao=0.16)
    torso_plate(part, body, 1.455, 2, 0.021, 0.056, 0.046, 0.010, 'metal', shrink=0.86, ao=0.08)
    with part.mirrored():
        arm_stack(part, body, [(0, 0.010), (1, 0.011), (2, 0.010), (3, 0.008), (4, 0.010),
                               (5.45, 0.011), (5.65, 0.012), (6.0, 0.010), (6.0, 0.000, 0.654)],
                  'secondary', armhole=armhole,
                  band_regions=['primary', 'secondary', 'secondary', 'primary', 'primary', 'accent', 'metal', 'metal'],
                  band_ao=[0.04, 0, -0.04, 0.04, 0.04, 0.16, 0.02, -0.22])


def torso_cyber_enforcer(part, body):
    part.covers = ['chest', 'upperarm', 'forearm', 'legs_waist']
    neck = body.torso['neck_base'].y
    chest_y = body.torso['chest'].y
    sh_y = body.torso['shoulder'].y
    armhole = torso_stack(part, body, [('hips', 0.017, {'y': 1.072, 'hem': 0.012}), ('belt', 0.015), ('waist', 0.014),
                             ('ribs', 0.018), ('chest', 0.022), ('shoulder', 0.018), ('neck_base', 0.011),
                             ('neck_base', 0.015, {'y': neck + 0.040, 'skin': SKIN_NECK})],
                'secondary', sleeves=True,
                band_regions=['secondary', 'secondary', 'primary', 'primary', 'primary', 'metal', 'accent'],
                band_ao=[-0.08, -0.04, 0.04, 0.06, 0.04, 0.02, 0.12])
    front_bevel_panel(part, body, [
        (1.320, 0.048, -0.048, 0.022, 0.032),
        (chest_y, 0.058, -0.058, 0.026, 0.036),
        (sh_y, 0.044, -0.044, 0.022, 0.031),
    ], 'metal', inset=0.006, ao=0.06, cap_start=True, cap_end=True)
    front_strip(part, body, [(1.355, 0.013, 0.034), (chest_y, 0.013, 0.038), (sh_y, 0.012, 0.033)], 'accent', ao=0.18)
    belt(part, body, 1.132, 0.016, 0.050, 'secondary', bulge=0.007, flat=False)
    torso_plate(part, body, 1.132, 2, 0.028, 0.052, 0.042, 0.011, 'metal')
    with part.mirrored():
        arm_stack(part, body, [(0, 0.011), (1, 0.012), (2, 0.011), (3, 0.008), (4, 0.011),
                               (5.5, 0.011), (5.65, 0.009), (6.0, 0.010), (6.0, 0.000, 0.654)],
                  'secondary', armhole=armhole,
                  band_regions=['secondary', 'secondary', 'secondary', 'metal', 'metal', 'accent', 'metal', 'metal'],
                  band_ao=[0, 0, -0.04, 0.04, 0.04, 0.15, 0, -0.22])
        with part.skinned(SKIN_PAULDRON_L):
            part.loft([pk.arm_ring(body, 0.85, 0.023), pk.arm_ring(body, 1.15, 0.025), pk.arm_ring(body, 1.45, 0.017)],
                      'primary', cap_start=False, cap_end=True, band_regions=['primary', 'metal'], ao=0.05)


def legs_cyber_cargo(part, body):
    part.covers = ['pelvis', 'thigh', 'shin', 'foot']
    pelvis_shell(part, body, 'secondary', ao=-0.04)
    with part.mirrored():
        leg_stack(part, body, [(0, CLOTH), (1, 0.011), (2, 0.011), (3, 0.013), (4, 0.014),
                               (5, 0.016), (6, 0.015), (7, 0.010)],
                  'secondary',
                  band_regions=['secondary', 'secondary', 'accent', 'secondary', 'primary', 'primary', 'metal'],
                  band_ao=[0, 0, 0.14, 0, 0.02, -0.06, -0.08])
        center, normal, _ = pk.facet(pk.leg_ring(body, 2.5, 0.014), 1)
        with part.skinned(pk.SKIN_LEG_L), part.anchored(pk.facet(pk.leg_ring(body, 2.5), 1)[0]):
            part.plate(center, normal, Y, 0.078, 0.098, 0.022, 'metal', shrink=0.7, ao=0.06)
        pk.build_foot(part, body, 'primary', grow=0.012, sole=0.020, sole_region='metal')


def legs_cyber_cyberlegs(part, body):
    part.covers = ['pelvis', 'thigh', 'shin', 'foot']
    pelvis_shell(part, body, 'secondary', ao=-0.04)
    with part.mirrored():
        leg_stack(part, body, [(0, CLOTH), (1, 0.010), (1.9, 0.011), (3, 0.010), (4, 0.010),
                               (5, 0.011), (6, 0.011), (7, 0.009)],
                  'metal',
                  band_regions=['secondary', 'accent', 'metal', 'metal', 'accent', 'metal', 'metal'],
                  band_ao=[0, 0.16, 0.04, 0.02, 0.16, 0, -0.08])
        pk.build_foot(part, body, 'metal', grow=0.010, sole=0.018, sole_region='secondary')


def headwear_cyber_helm(part, shape=ENVELOPE):
    part.skin = pk.SKIN_HEAD
    grow = 0.024
    wide = pk.head_ring(shape, BROW, grow)

    def lifted(height, scale):
        return [V(point.x * scale, height, pk.HEAD_Z + (point.z - pk.HEAD_Z) * scale) for point in wide]

    part.loft([pk.head_ring(shape, pk.HEAD_Y['plug'] + 0.006, grow + 0.008), pk.head_ring(shape, pk.HEAD_Y['jaw'], grow + 0.005),
               wide, lifted(1.984, 0.96), lifted(2.010, 0.80)],
              'primary', cap_end=True, band_regions=['secondary', 'primary', 'primary', 'primary'])
    eye = pk.HEAD_Y['cheek'] + 0.022
    for index, width in ((1, 0.098), (0, 0.056), (2, 0.056)):
        center, normal, _ = head_facet(eye, index, grow, shape)
        part.plate(center, normal, Y, width, 0.024, 0.008, 'accent', shrink=0.88, ao=0.22)
    # Angular respirator chin plate and twin cybernetic ear comms fins.
    center, normal, _ = head_facet(pk.HEAD_Y['jaw'], 1, grow + 0.004, shape)
    part.plate(center, normal, Y, 0.076, 0.068, 0.012, 'secondary', shrink=0.8, ao=-0.06)
    for index in (0, 3):
        center, normal, _ = head_facet(1.880, index, grow, shape)
        part.plate(center, normal, Y, 0.026, 0.105, 0.016, 'metal', shrink=0.7, ao=0.06)


def headwear_cyber_visor(part, shape=ENVELOPE):
    # Open-hair AR wraparound cyber visor (<= 32 tris so worst open-hat + hair stays <= 159).
    part.skin = pk.SKIN_HEAD
    stations = (
        (0, 1.866, 1.886, 0.008, 0.016),
        (1, 1.844, 1.894, 0.016, 0.028),
        (2, 1.844, 1.894, 0.016, 0.028),
        (3, 1.866, 1.886, 0.008, 0.016),
    )
    rings = []
    for col, y_lo, y_hi, g_in, g_out in stations:
        p_in_lo = pk.head_ring(shape, y_lo, g_in)[col]
        p_out_lo = pk.head_ring(shape, y_lo, g_out)[col]
        p_out_hi = pk.head_ring(shape, y_hi, g_out)[col]
        p_in_hi = pk.head_ring(shape, y_hi, g_in)[col]
        rings.append([p_in_lo, p_out_lo, p_out_hi, p_in_hi])
    part.loft(rings, 'accent', band_regions=['secondary', 'accent', 'secondary'],
              cap_start=True, cap_end=True, ao=0.18)


def back_cyber_deck(part, body):
    back = pk.torso_surface_z(body, 1.40, 0.0, 0.015, 'back')
    with part.skinned(SKIN_BACK), part.anchored(pk.torso_point(body, 1.40, 0.0, 0.0, 'back')):
        part.box(V(0, 1.385, back - 0.062), (0.250, 0.340, 0.116), 'secondary', taper=(0.84, 0.94), bevel=0.018)
        part.plate(V(0, 1.395, back - 0.120), -Z, Y, 0.168, 0.240, 0.016, 'primary', shrink=0.88)
        part.plate(V(0, 1.405, back - 0.134), -Z, Y, 0.030, 0.180, 0.010, 'accent', shrink=0.92, ao=0.2)
        for side in (1, -1):
            part.tube([V(side * 0.088, 1.545, back - 0.056), V(side * 0.096, 1.720, back - 0.072)],
                      [0.009, 0.005], 4, 'metal', up=Z, cap_end=True)
    with part.mirrored():
        shoulder_strap(part, body, 'secondary', low_front=1.28)


def held_cyber_katana(part):
    part.tube([V(0, -0.078, 0), V(0, 0.078, 0)], [0.017, 0.015], 6, 'secondary', up=Z)
    part.lathe([(0.010, -0.118), (0.024, -0.096), (0.016, -0.078)], 6, 'accent', cap_start=True, ao=0.15)
    part.box(V(0, 0.092, 0), (0.036, 0.020, 0.130), 'metal', bevel=0.004)
    part.plate(V(0, 0.110, 0.014), Z, Y, 0.024, 0.022, 0.010, 'accent', ao=0.18)
    # Single-edged blade with metallic spine and glowing thermal cutting edge along +Z.
    part.loft([
        [V(-0.006, 0.104, -0.018), V(0.006, 0.104, -0.018), V(0.0, 0.104, 0.026)],
        [V(-0.005, 0.780, -0.014), V(0.005, 0.780, -0.014), V(0.0, 0.780, 0.026)],
    ], 'metal', tip_end=V(0.0, 1.010, 0.036))
    part.loft([
        [V(-0.003, 0.106, 0.022), V(0.003, 0.106, 0.022), V(0.0, 0.106, 0.034)],
        [V(-0.0025, 0.780, 0.022), V(0.0025, 0.780, 0.022), V(0.0, 0.780, 0.033)],
    ], 'accent', tip_end=V(0.0, 1.010, 0.042), ao=0.22)


def held_smart_smg(part):
    xform = Matrix.Translation(V(-0.017, 0.016, 0.022)) @ Matrix.Rotation(math.radians(-13), 4, 'Y')
    with part.placed(xform):
        grip = Matrix.Rotation(math.radians(-14), 4, 'X')
        with part.placed(Matrix.Translation(V(0, -0.016, 0.0)) @ grip):
            part.box(V(0, 0, 0), (0.024, 0.094, 0.044), 'secondary', taper=0.9)
        part.box(V(0, 0.058, 0.130), (0.034, 0.068, 0.340), 'primary', bevel=0.009)
        part.box(V(0, 0.062, 0.350), (0.028, 0.050, 0.130), 'metal', bevel=0.007)
        part.plate(V(-0.017, 0.064, 0.145), -X, Y, 0.180, 0.014, 0.005, 'accent', ao=0.2)
        part.plate(V(0, 0.095, 0.130), Y, Z, 0.018, 0.210, 0.014, 'metal', shrink=0.8)
        part.box(V(0, -0.028, 0.210), (0.024, 0.118, 0.042), 'metal', ao=-0.1)


def held_holo_deck(part):
    # Left hand: compact cyberdeck chassis + glowing projected holographic screen wing.
    part.box(V(0.021, 0.036, 0.0), (0.088, 0.136, 0.013), 'secondary', right=Z, up=Y, bevel=0.003, corner=0.008, ao=-0.16)
    part.plate(V(0.0145, 0.036, 0.0), -X, Y, 0.072, 0.116, 0.002, 'metal', shrink=0.95)
    part.plate(V(0.015, 0.134, 0.016), -X, Y, 0.092, 0.072, 0.003, 'accent', shrink=0.96, ao=0.24)
    part.tube([V(0.024, 0.104, -0.036), V(0.024, 0.172, -0.036)], [0.005, 0.003], 4, 'metal', up=Z, cap_end=True)


def prop_holo_kiosk(part):
    part.box(V(0, 0.440, 0), (0.860, 0.880, 0.540), 'secondary', bevel=0.024, ao=-0.1)
    part.box(V(0, 1.380, -0.040), (0.760, 1.040, 0.340), 'primary', bevel=0.020)
    part.plate(V(0, 1.420, 0.130), Z, Y, 0.620, 0.840, 0.018, 'hair', shrink=0.94, ao=0.22)
    for side in (-1, 1):
        part.box(V(side * 0.395, 1.360, 0.050), (0.040, 1.020, 0.140), 'accent', bevel=0.006, ao=0.18)
    part.box(V(0, 1.980, 0.080), (0.940, 0.140, 0.560), 'secondary', bevel=0.016, taper=0.9)
    part.tube([V(-0.280, 2.050, -0.080), V(-0.280, 2.480, -0.080)], [0.018, 0.008], 5, 'metal', up=Z, cap_end=True)


def prop_server_terminal(part):
    part.box(V(0, 0.820, 0), (0.620, 1.640, 0.480), 'primary', bevel=0.022, taper=0.94)
    part.box(V(0, 0.040, 0), (0.700, 0.080, 0.560), 'secondary', bevel=0.010)
    for height in (0.480, 0.860, 1.240):
        part.plate(V(0, height, 0.236), Z, Y, 0.460, 0.240, 0.016, 'secondary', shrink=0.94, ao=-0.16)
    part.plate(V(0, 1.420, 0.244), Z, Y, 0.420, 0.048, 0.010, 'hair', ao=0.22)
    part.plate(V(0.304, 0.900, 0.0), X, Y, 0.056, 1.220, 0.012, 'accent', ao=0.18)
    part.tube([V(0.180, 1.640, -0.120), V(0.180, 1.960, -0.120)], [0.014, 0.006], 4, 'metal', up=Z, cap_end=True)


def prop_cyber_crate(part):
    part.box(V(0, 0.240, 0), (0.780, 0.480, 0.520), 'primary', bevel=0.028, corner=0.034)
    part.plate(V(0, 0.480, 0), Y, Z, 0.680, 0.420, 0.024, 'secondary', shrink=0.92, ao=0.05)
    for x in (-0.280, 0.280):
        part.box(V(x, 0.250, 0), (0.060, 0.500, 0.548), 'secondary', bevel=0.008)
    part.plate(V(0, 0.280, 0.260), Z, Y, 0.360, 0.044, 0.010, 'accent', ao=0.2)
    for x in (-0.180, 0.180):
        part.plate(V(x, 0.390, 0.260), Z, Y, 0.050, 0.065, 0.012, 'metal')


def prop_neon_bollard(part):
    part.box(V(0, 0.050, 0), (0.280, 0.100, 0.280), 'metal', bevel=0.012)
    part.box(V(0, 0.490, 0), (0.160, 0.800, 0.160), 'secondary', bevel=0.016, taper=0.86)
    for side, axis in ((1, Z), (-1, Z), (1, X), (-1, X)):
        part.plate(V(0, 0.560, 0) + axis * (side * 0.078), axis * side, Y, 0.036, 0.520, 0.008, 'accent', ao=0.22)
    part.box(V(0, 0.910, 0), (0.145, 0.050, 0.145), 'metal', bevel=0.008)


# --------------------------------------------------------------------------
# Work clothes
# --------------------------------------------------------------------------

def work_shirt(part, body, *, rolled=False, field='primary', sleeve='secondary'):
    part.covers = ['chest', 'upperarm', 'legs_waist']
    hole = torso_stack(part, body, [
        ('hips', .017, {'y': 1.075, 'hem': .012}), ('belt', .021), ('waist', .016),
        ('ribs', .014), ('chest', .016), ('shoulder', .014), ('neck_base', .007),
    ], field, sleeves=True)
    sleeve_rows = [(0, .012), (1, .016), (2, .018), (3, .014)]
    if rolled:
        sleeve_rows.extend([(3.05, .024), (3.28, .024), (3.30, .004)])
    else:
        part.covers.append('forearm')
        sleeve_rows.extend([(4, .012), (5, .013), (6, .009), (6, .001, .654)])
    with part.mirrored():
        arm_stack(part, body, sleeve_rows, sleeve, armhole=hole)


def work_straps(part, body, region, x, half, bottom):
    heights = [bottom] + [station.y for station in (body.torso[k] for k in ('ribs', 'chest', 'shoulder'))
                          if station.y > bottom]
    rings, refs = [], []
    for side, rows in [('back', heights), ('front', reversed(heights))]:
        for y in rows:
            outer = min(x + half, pk.station_at(body, y).w * .89)
            xs = (outer - 2 * half, outer)
            rings.append([pk.torso_point(body, y, px, .029, side) for px in xs])
            refs.append([pk.torso_point(body, y, px, 0, side) for px in xs])
        if side == 'back':
            middle = body.torso['shoulder']
            rings.append([V(px, middle.y + .030, middle.zc) for px in xs])
            refs.append([V(px, middle.y, middle.zc) for px in xs])
    with part.mirrored(), part.skinned(pk.SKIN_TORSO):
        shoulder = len(heights) - 1
        for start, stop, direction in [(0, shoulder + 1, -Z), (shoulder, shoulder + 3, Y),
                                       (shoulder + 2, len(rings), Z)]:
            part.loft(rings[start:stop], region, refs=refs[start:stop], closed=False, toward=direction, ao=-.04)


def bib(part, body, widths, region):
    heights = (1.079, 1.135, 1.215, 1.38, 1.465, 1.50)
    rings, refs = [], []
    for height, width in zip(heights, widths):
        half = min(width, pk.station_at(body, height).w * .78)
        xs = (half, half * .52, 0, -half * .52, -half)
        rings.append([pk.torso_point(body, height, x, .034) for x in xs])
        refs.append([pk.torso_point(body, height, x) for x in xs])
    with part.skinned(pk.SKIN_TORSO):
        part.loft(rings, region, refs=refs, closed=False, toward=Z,
                  two_sided=True, thickness=.004, inner_ao=-.20)
    work_straps(part, body, region, .057, .013, 1.485)


def torso_sim_counter_apron(part, body):
    work_shirt(part, body, rolled=True, sleeve='primary')
    bib(part, body, (.122, .115, .106, .083, .079, .071), 'secondary')
    torso_plate(part, body, 1.427, 2, .043, .060, .029, .005, 'accent')


def torso_sim_road_vest(part, body):
    work_shirt(part, body)
    work_straps(part, body, 'accent', .083, .025, 1.275)
    belt(part, body, 1.275, .022, .042, 'accent', bulge=.004, flat=False)
    with part.mirrored():
        torso_plate(part, body, 1.162, 1, .026, .072, .075, .024, 'primary', corner=.012)


def torso_medieval_inn_doublet(part, body):
    work_shirt(part, body, rolled=True, sleeve='accent')
    # The padded collar folds out over the linen yoke.
    torso_stack(part, body, [(1.507, .023), ('shoulder', .032), ('neck_base', .012)], 'secondary')
    belt(part, body, 1.155, .022, .081, 'secondary', flat=False)
    front_strip(part, body, [(1.19, .018, .026), (1.38, .026, .025), (1.51, .032, .028)], 'secondary')
    for height in (1.31, 1.414):
        torso_plate(part, body, height, 2, .034, .047, .013, .006, 'metal')


def torso_medieval_smith_apron(part, body):
    work_shirt(part, body, rolled=True, field='secondary', sleeve='secondary')
    bib(part, body, (.145, .128, .111, .091, .077, .073), 'primary')
    belt(part, body, 1.196, .039, .037, 'accent', flat=False)
    torso_plate(part, body, 1.155, 3, .038, .067, .092, .029, 'secondary', corner=.012)


def torso_cyber_bench_harness(part, body):
    work_shirt(part, body, rolled=True, field='secondary')
    work_straps(part, body, 'primary', .073, .024, 1.245)
    # A wide diagnostic screen spans the harness rails.
    torso_plate(part, body, 1.396, 2, .048, .176, .100, .027, 'metal', corner=.018)
    torso_plate(part, body, 1.396, 2, .079, .133, .065, .006, 'accent', corner=.010)
    belt(part, body, 1.245, .023, .054, 'primary', flat=False)


def wrap_panel(part, body, rows, region, **options):
    fitted = []
    for height, left, right, base, top in rows:
        scale = pk.station_at(body, height).w / .165
        fitted.append((height, left * scale, right * scale, base, top))
    front_bevel_panel(part, body, fitted, region, **options)


def torso_cyber_transit_shell(part, body):
    work_shirt(part, body)
    neck = body.torso['neck_base'].y
    torso_stack(part, body, [(1.477, .025), ('shoulder', .033), ('neck_base', .018),
                             ('neck_base', .028, {'y': neck + .036, 'skin': SKIN_NECK})],
                'primary', band_regions=['metal', 'primary', 'accent'])
    wrap_panel(part, body, [(1.08, .081, .040, .027, .039), (1.215, .064, .030, .021, .029),
                                   (1.38, -.020, -.055, .021, .029), (1.49, -.067, -.10, .022, .034)],
                      'secondary', inset=.004, cap_start=True)


def torso_ww2_rail_bibs(part, body):
    work_shirt(part, body, field='secondary')
    bib(part, body, (.129, .125, .114, .103, .089, .082), 'primary')
    torso_plate(part, body, 1.394, 2, .044, .113, .064, .011, 'primary', corner=.009)
    with part.mirrored():
        with part.skinned(pk.SKIN_TORSO):
            part.plate(pk.torso_point(body, 1.50, .057, .042), Z, Y, .031, .022, .007, 'metal')


def torso_ww2_orderly_wrap(part, body):
    work_shirt(part, body, rolled=True, sleeve='primary')
    # The overlap crosses from the left collar to the opposite waist tie.
    wrap_panel(part, body, [
        (1.082, .099, -.071, .024, .034), (1.135, .094, -.072, .024, .034),
        (1.215, .090, -.067, .021, .030), (1.38, .104, -.009, .021, .030),
        (1.465, .089, .026, .021, .030), (1.538, .069, .044, .021, .030),
    ], 'primary', inset=.007, cap_start=True)
    belt(part, body, 1.214, .032, .038, 'secondary', flat=False)
    torso_plate(part, body, 1.411, 3, .028, .058, .072, .010, 'secondary', corner=.009)


def headwear_rail_flatcap(part, shape=ENVELOPE):
    part.skin = pk.SKIN_HEAD
    low = BROW + .002
    base = pk.head_ring(shape, low, .014)
    band = pk.head_ring(shape, low + .020, .017)
    crown = [V(p.x * 1.18, low + .064 - (p.z - pk.HEAD_Z) * .18, p.z + .018) for p in band]
    top = pk.head_ring(shape, pk.HEAD_Y['crown'], .018)
    top = [p + V(0, .013, 0) for p in top]
    part.loft([base, band, crown, top], 'primary', band_regions=['secondary', 'primary', 'primary'],
              tip_end=V(0, pk.HEAD_Y['crown'] + .026, pk.HEAD_Z - .016))
    front = pk.head_front_z(shape, low, .015)
    part.slab([V(.069, low, front - .023), V(.053, low - .012, front + .044),
               V(-.053, low - .012, front + .044), V(-.069, low, front - .023)],
              .009, 'secondary', normal=Y, back=True)
    hat_hair(part, shape)


def proportions(**changes):
    values = {'height': 1.0, 'legRatio': 0.94, 'armLength': 0.96, 'shoulderWidth': 1.04, 'torsoBulk': 1.0,
              'waistScale': 1.0, 'headScale': 1.0, 'limbThickness': 1.02}
    values.update(changes)
    return values


def preset(pack, preset_id, label, clip, palette, *, body, head, hair, torso, legs, headwear=None, back=None,
           right=None, left=None, **scale):
    if pack in ('medieval', 'ww2', 'sim', 'cyberpunk'):
        scale['height'] = scale.get('height', 1.0) * HUMAN_HEIGHT_MULTIPLIER
    return {'id': preset_id, 'pack': pack, 'label': label, 'clip': clip, 'body': body, 'head': head, 'hair': hair,
            'torso': torso, 'legs': legs, 'headwear': headwear, 'back': back, 'heldRight': right, 'heldLeft': left,
            'palette': palette, 'proportions': proportions(**scale)}


PACK_TABLE = {
    'medieval': {
        'parts': [
            ('torso', torso_medieval_knight, 'Knight Plate', {}),
            ('torso', torso_medieval_tunic, 'Belted Tunic', {'hides_legs_upper': True}),
            ('legs', legs_medieval_greaves, 'Plate Greaves', {}),
            ('legs', legs_medieval_breeches, 'Breeches and Boots', {}),
            ('headwear', headwear_great_helm, 'Great Helm', {'hides_hair': True}),
            ('headwear', headwear_kettle_helm, 'Kettle Helm', {'hides_hair': True}),
            ('back', back_medieval_cloak, 'Travel Cloak', {}),
            ('torso', torso_medieval_inn_doublet, 'Inn Doublet', {}),
            ('torso', torso_medieval_smith_apron, 'Leather Smith Apron', {}),
        ],
        'held': [(held_broadsword, 'Broadsword', 'hand_r'), (held_heater_shield, 'Heater Shield', 'hand_l'),
                 (held_torch, 'Torch', 'hand_l')],
        'props': [(prop_barrel, 'Oak Barrel'), (prop_crate, 'Supply Crate'), (prop_weapon_rack, 'Weapon Rack'),
                  (prop_war_banner, 'War Banner')],
        'presets': [
            preset('medieval', 'medieval_knight', 'Knight Captain', 'Sword_Idle',
                   {'skin': '#d8a67e', 'hair': '#4a2e1f', 'primary': '#9e332d', 'secondary': '#593e29', 'accent': '#d49d3b',
                    'metal': '#8a94a0', 'eye': '#2e5d8c'},
                   body='body_athletic', head='head_hero', hair='hair_short_part', torso='torso_medieval_knight',
                   legs='legs_medieval_greaves', headwear='headwear_great_helm', back='back_medieval_cloak',
                   right='held_broadsword', left='held_heater_shield', height=1.04, shoulderWidth=1.1, torsoBulk=1.06,
                   limbThickness=1.06),
            preset('medieval', 'medieval_squire', 'Torchbearer Squire', 'Idle_Torch_Loop',
                   {'skin': '#ecc8aa', 'hair': '#a84f2b', 'primary': '#3f6b45', 'secondary': '#5c3c24', 'accent': '#d9a441',
                    'metal': '#8c96a3', 'eye': '#346b4c'},
                   body='body_slim', head='head_cheerful', hair='hair_swept', torso='torso_medieval_tunic',
                   legs='legs_medieval_breeches', left='held_torch', height=0.96, legRatio=0.95, armLength=0.98,
                   shoulderWidth=1.06, limbThickness=1.0),
            preset('medieval', 'medieval_guard', 'Town Guard', 'Sword_Idle',
                   {'skin': '#bc8358', 'hair': '#25262b', 'primary': '#2f4f8a', 'secondary': '#5c3c24', 'accent': '#d9a441',
                    'metal': '#8c96a3', 'eye': '#1f2634'},
                   body='body_heavy', head='head_stern', hair='hair_short_part', torso='torso_medieval_tunic',
                   legs='legs_medieval_greaves', headwear='headwear_kettle_helm', right='held_broadsword',
                   left='held_heater_shield', legRatio=0.94, armLength=1.02, shoulderWidth=1.08, torsoBulk=1.06,
                   limbThickness=1.0),
            preset('medieval', 'medieval_innkeeper', 'Innkeeper', 'Idle_Loop',
                   dict(pk.COLOR_DIRECTION['packs']['medieval']['avatar'], primary='#71484a', secondary='#533a2a', accent='#d5bc91'),
                   body='body_athletic', head='head_cheerful', hair='hair_short_part',
                   torso='torso_medieval_inn_doublet', legs='legs_medieval_breeches', legRatio=0.88, shoulderWidth=0.96),
            preset('medieval', 'medieval_village_smith', 'Village Smith', 'Idle_Loop',
                   dict(pk.COLOR_DIRECTION['packs']['medieval']['avatar'], primary='#8f5837', secondary='#989786', accent='#483321'),
                   body='body_athletic', head='head_stern', hair='hair_swept',
                   torso='torso_medieval_smith_apron', legs='legs_medieval_breeches', legRatio=0.88, shoulderWidth=0.96),
        ],
    },
    'ww2': {
        'parts': [
            ('torso', torso_ww2_field_jacket, 'M41 Field Jacket', {}),
            ('torso', torso_ww2_trenchcoat, 'Officer Trenchcoat', {'hides_legs_upper': True}),
            ('legs', legs_ww2_field_trousers, 'Field Trousers and Gaiters', {}),
            ('legs', legs_ww2_officer_breeches, 'Officer Breeches and Jackboots', {}),
            ('headwear', headwear_m1_helmet, 'M1 Steel Helmet', {'hides_hair': True}),
            ('headwear', headwear_officer_cap, 'Officer Peaked Cap', {'hides_hair': True}),
            ('back', back_ww2_field_pack, 'Field Pack', {}),
            ('torso', torso_ww2_rail_bibs, 'Railway Bib Overalls', {}),
            ('torso', torso_ww2_orderly_wrap, 'Wrap Work Smock', {}),
            ('headwear', headwear_rail_flatcap, 'Railway Flat Cap', {'hides_hair': True}),
        ],
        'held': [(held_rifle, 'Service Rifle', 'hand_r'), (held_smg, 'Submachine Gun', 'hand_r'),
                 (held_pistol, 'Service Pistol', 'hand_r'), (held_ammo_can, 'Ammo Can', 'hand_l'),
                 (held_ww2_dispatch, 'Inspection Dispatch', 'hand_l')],
        'props': [(prop_sandbag_wall, 'Sandbag Wall'), (prop_jerrycan, 'Jerrycan'), (prop_ammo_crate, 'Ammo Crate'),
                  (prop_field_radio, 'Field Radio')],
        'presets': [
            preset('ww2', 'ww2_rifleman', 'Rifleman', 'Ranged_2H_Aiming',
                   {'skin': '#d8a67e', 'hair': '#25262b', 'primary': '#566045', 'secondary': '#8a7c5a', 'accent': '#b8503c',
                    'metal': '#454c52', 'eye': '#1f2634'},
                   body='body_athletic', head='head_hero', hair='hair_short_part', torso='torso_ww2_field_jacket',
                   legs='legs_ww2_field_trousers', headwear='headwear_m1_helmet', back='back_ww2_field_pack',
                   right='held_rifle'),
            preset('ww2', 'ww2_officer', 'Field Officer', 'Pistol_Idle_Loop',
                   {'skin': '#ecc8aa', 'hair': '#cfa563', 'primary': '#5c635f', 'secondary': '#4a4238', 'accent': '#b84a39',
                    'metal': '#3a4046', 'eye': '#2e5d8c'},
                   body='body_athletic', head='head_stern', hair='hair_short_part', torso='torso_ww2_trenchcoat',
                   legs='legs_ww2_officer_breeches', headwear='headwear_officer_cap', right='held_pistol',
                   height=1.02, shoulderWidth=1.12),
            preset('ww2', 'ww2_sapper', 'Assault Sapper', 'Walk_Loop',
                   {'skin': '#945d3b', 'hair': '#25262b', 'primary': '#545e43', 'secondary': '#8c7d5b', 'accent': '#d4a24c',
                    'metal': '#3a4046', 'eye': '#3c2a21'},
                   body='body_heavy', head='head_cheerful', hair='hair_short_part', torso='torso_ww2_field_jacket',
                   legs='legs_ww2_field_trousers', headwear='headwear_m1_helmet', right='held_smg', left='held_ammo_can',
                   legRatio=0.95, armLength=1.02, torsoBulk=1.06, limbThickness=1.06),
            preset('ww2', 'ww2_rail_worker', 'Civilian Rail Worker', 'Walk_Loop',
                   dict(pk.COLOR_DIRECTION['packs']['ww2']['avatar'], primary='#3c5265', secondary='#ac9f83', accent='#716444'),
                   body='body_athletic', head='head_stern', hair='hair_short_part',
                   torso='torso_ww2_rail_bibs', legs='legs_ww2_field_trousers', headwear='headwear_rail_flatcap', legRatio=0.88, shoulderWidth=0.96),
            preset('ww2', 'ww2_depot_orderly', 'Depot Medical Orderly', 'Idle_Loop',
                   dict(pk.COLOR_DIRECTION['packs']['ww2']['avatar'], primary='#dbd5bd', secondary='#6a796f', accent='#966652'),
                   body='body_slim', head='head_cheerful', hair='hair_short_part',
                   torso='torso_ww2_orderly_wrap', legs='legs_ww2_field_trousers', legRatio=0.88),
        ],
    },
    'sim': {
        'parts': [
            ('torso', torso_sim_hoodie, 'Pullover Hoodie', {}),
            ('torso', torso_sim_blazer, 'Tailored Blazer', {}),
            ('torso', torso_sim_varsity, 'Varsity Jacket', {}),
            ('legs', legs_sim_jeans, 'Jeans and Sneakers', {}),
            ('legs', legs_sim_shorts, 'Shorts and Sneakers', {}),
            ('headwear', headwear_sim_cap, 'Baseball Cap', {'hides_hair': True}),
            ('headwear', headwear_sim_beanie, 'Pom Beanie', {'hides_hair': True}),
            ('back', back_sim_daypack, 'Daypack', {}),
            ('torso', torso_sim_counter_apron, 'Counter Apron', {}),
            ('torso', torso_sim_road_vest, 'Reflective Road Vest', {}),
        ],
        'held': [(held_coffee_cup, 'Coffee Cup', 'hand_r'), (held_phone, 'Phone', 'hand_l'),
                 (held_briefcase, 'Briefcase', 'hand_l')],
        'props': [(prop_cafe_table, 'Cafe Table'), (prop_park_bench, 'Park Bench'), (prop_street_bollard, 'Street Bollard'),
                  (prop_planter, 'Planter')],
        'presets': [
            preset('sim', 'sim_student', 'Coffee Run Student', 'Jog_Fwd_Loop',
                   {'skin': '#bc7751', 'hair': '#32273d', 'primary': '#fb6655', 'secondary': '#3348a1', 'accent': '#73e5be',
                    'metal': '#a3bfca', 'eye': '#426757'},
                   body='body_slim', head='head_cheerful', hair='hair_bob', torso='torso_sim_hoodie', legs='legs_sim_jeans',
                   back='back_sim_daypack', right='held_coffee_cup', left='held_phone',
                   height=0.96, legRatio=0.95, armLength=0.96, headScale=1.06, limbThickness=1.0),
            preset('sim', 'sim_executive', 'Executive', 'Walk_Formal_Loop',
                   {'skin': '#e9ad81', 'hair': '#693c39', 'primary': '#3348a1', 'secondary': '#d8e1eb', 'accent': '#fb6655',
                    'metal': '#b6ccda', 'eye': '#305774'},
                   body='body_athletic', head='head_stern', hair='hair_short_part', torso='torso_sim_blazer',
                   legs='legs_sim_jeans', left='held_briefcase', height=1.03, shoulderWidth=1.06),
            preset('sim', 'sim_varsity', 'Varsity Dancer', 'Dance_Loop',
                   {'skin': '#895639', 'hair': '#514fa2', 'primary': '#2db58b', 'secondary': '#f2c56a', 'accent': '#fb6655',
                    'metal': '#e6ecef', 'eye': '#49352f'},
                   body='body_heavy', head='head_hero', hair='hair_ponytail', torso='torso_sim_varsity',
                   legs='legs_sim_shorts', headwear='headwear_sim_beanie', legRatio=0.93, torsoBulk=1.06, limbThickness=1.04),
            preset('sim', 'sim_shopkeeper', 'Shopkeeper', 'Idle_Loop',
                   dict(pk.COLOR_DIRECTION['packs']['sim']['avatar'], primary='#eff0da', secondary='#34675f', accent='#ed855d'),
                   body='body_slim', head='head_cheerful', hair='hair_bob',
                   torso='torso_sim_counter_apron', legs='legs_sim_jeans', legRatio=0.88),
            preset('sim', 'sim_street_worker', 'Street Service Worker', 'Walk_Loop',
                   dict(pk.COLOR_DIRECTION['packs']['sim']['avatar'], primary='#e99541', secondary='#344553', accent='#f1e9aa'),
                   body='body_athletic', head='head_hero', hair='hair_short_part',
                   torso='torso_sim_road_vest', legs='legs_sim_jeans', headwear='headwear_sim_cap', legRatio=0.88, shoulderWidth=0.96),
        ],
    },
    'cyberpunk': {
        'parts': [
            ('torso', torso_cyber_edgerunner, 'Edgerunner High-Collar Jacket', {}),
            ('torso', torso_cyber_netrunner, 'Netrunner Plugsuit', {}),
            ('torso', torso_cyber_enforcer, 'Corp Enforcer Armor', {}),
            ('legs', legs_cyber_cargo, 'Tech Cargo & Mag-Boots', {}),
            ('legs', legs_cyber_cyberlegs, 'Chrome Cyber-Legs', {}),
            ('headwear', headwear_cyber_helm, 'Oni Cyber Helm', {'hides_hair': True}),
            ('headwear', headwear_cyber_visor, 'Neon AR Visor', {'hides_hair': False}),
            ('back', back_cyber_deck, 'Neural Relay Pack', {}),
            ('torso', torso_cyber_bench_harness, 'Diagnostic Harness', {}),
            ('torso', torso_cyber_transit_shell, 'Transit Shell', {}),
        ],
        'held': [(held_cyber_katana, 'Thermal Katana', 'hand_r'), (held_smart_smg, 'Smart Pulse SMG', 'hand_r'),
                 (held_holo_deck, 'Holo Cyberdeck', 'hand_l')],
        'props': [(prop_holo_kiosk, 'Holo Kiosk'), (prop_server_terminal, 'Server Terminal'),
                  (prop_cyber_crate, 'Cyber Crate'), (prop_neon_bollard, 'Neon Bollard')],
        'presets': [
            preset('cyberpunk', 'cyber_edgerunner', 'Street Edgerunner', 'Sword_Idle',
                   {'skin': '#744535', 'hair': '#f64c87', 'primary': '#5845bd', 'secondary': '#b9cfe2',
                    'accent': '#40f5ce', 'metal': '#889dca', 'eye': '#40f5ce'},
                   body='body_athletic', head='head_hero', hair='hair_swept', torso='torso_cyber_edgerunner',
                   legs='legs_cyber_cargo', headwear='headwear_cyber_visor', back='back_cyber_deck',
                   right='held_cyber_katana', height=1.02, shoulderWidth=1.08, torsoBulk=1.04),
            preset('cyberpunk', 'cyber_netrunner', 'Ghost Netrunner', 'Jog_Fwd_Loop',
                   {'skin': '#f2c8b2', 'hair': '#c6cfda', 'primary': '#2b9db8', 'secondary': '#2b2b54',
                    'accent': '#f64c87', 'metal': '#a3bfca', 'eye': '#40f5ce'},
                   body='body_slim', head='head_cheerful', hair='hair_bob', torso='torso_cyber_netrunner',
                   legs='legs_cyber_cyberlegs', headwear='headwear_cyber_visor', back='back_cyber_deck',
                   left='held_holo_deck', height=0.97, legRatio=0.96, armLength=0.96, headScale=1.04, limbThickness=0.96),
            preset('cyberpunk', 'cyber_enforcer', 'Corp Enforcer', 'Pistol_Idle_Loop',
                   {'skin': '#895639', 'hair': '#32273d', 'primary': '#e2ebf3', 'secondary': '#394578',
                    'accent': '#f54345', 'metal': '#6b7ea4', 'eye': '#f54345'},
                   body='body_heavy', head='head_stern', hair='hair_short_part', torso='torso_cyber_enforcer',
                   legs='legs_cyber_cargo', headwear='headwear_cyber_helm', right='held_smart_smg',
                   height=1.04, legRatio=0.94, shoulderWidth=1.10, torsoBulk=1.08, limbThickness=1.06),
            preset('cyberpunk', 'cyber_ronin', 'Chrome Ronin', 'Sword_Attack',
                   {'skin': '#bc7751', 'hair': '#32273d', 'primary': '#e03b6a', 'secondary': '#2e2b4f',
                    'accent': '#ffe188', 'metal': '#b6ccda', 'eye': '#ffe188'},
                   body='body_athletic', head='head_stern', hair='hair_ponytail', torso='torso_cyber_edgerunner',
                   legs='legs_cyber_cyberlegs', right='held_cyber_katana',
                   height=1.01, shoulderWidth=1.06, limbThickness=1.02),
            preset('cyberpunk', 'cyber_bench_technician', 'Bench Technician', 'Idle_Loop',
                   dict(pk.COLOR_DIRECTION['packs']['cyberpunk']['avatar'], primary='#6963b7', secondary='#333452', accent='#62e2ce'),
                   body='body_slim', head='head_hero', hair='hair_swept',
                   torso='torso_cyber_bench_harness', legs='legs_cyber_cargo', headwear='headwear_cyber_visor', legRatio=0.88, shoulderWidth=0.96),
            preset('cyberpunk', 'cyber_transit_worker', 'Transit Worker', 'Walk_Loop',
                   dict(pk.COLOR_DIRECTION['packs']['cyberpunk']['avatar'], primary='#48788c', secondary='#393953', accent='#f6c977'),
                   body='body_heavy', head='head_stern', hair='hair_short_part',
                   torso='torso_cyber_transit_shell', legs='legs_cyber_cyberlegs', legRatio=0.84, shoulderWidth=0.92, armLength=1.02),
        ],
    },
}


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def build_pack(pack, table, core, solver, stage):
    characters = pk.leaf_dir(stage, pack, 'characters')
    world = pk.leaf_dir(stage, pack, 'world')
    parts_file = f'{pack}-parts.glb'
    builder = pk.GlbBuilder()
    builder.add_rig(core, with_clips=False)
    parts = []
    for slot, build, label, rules in table['parts']:
        if slot == 'headwear':
            mesh = pk.build_head_skinned(build.__name__, build, solver)
        else:
            mesh = pk.build_skinned(build.__name__, build, solver)
        builder.add_mesh(mesh)
        parts.append(pk.part_entry(mesh, pack, slot, label, parts_file, **rules))
    builder.write(characters / parts_file)
    if not np.array_equal(pk.Rig(characters / parts_file).inverse_bind, core.inverse_bind):
        raise ValueError(f'{parts_file}: the inverse bind matrices changed.')

    held = []
    for build, label, hand in table['held']:
        part = pk.Part(build.__name__)
        build(part)
        mesh = part.to_mesh()
        path = f'held/{mesh.name}.glb'
        held.append(pk.held_entry(mesh, pack, label, hand, path, pk.write_static_glb(characters / path, mesh)))

    props = []
    for build, label in table['props']:
        part = pk.Part(build.__name__)
        build(part)
        mesh = part.to_mesh()
        low, high = mesh.positions.min(axis=0), mesh.positions.max(axis=0)
        # Rule M4: ground the prop and centre it on X/Z.
        mesh.positions -= np.array([(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2])
        path = f'props/{mesh.name}.glb'
        props.append(pk.prop_entry(mesh, pack, label, path, pk.write_prop_glb(world / path, mesh, pack)))
    from build_props import build_extra_props_for_pack
    props.extend(build_extra_props_for_pack(pack, world))
    return pk.pack_catalog(pack, parts=parts, held=held, props=props, presets=table['presets'])


def check_compositions(packs):
    """Every preset (including held items) and the worst slot mix must stay inside the composed avatar budget."""
    limit = pk.BUDGETS['mobilePolicy']['maxTrianglesPerComposedAvatar']
    parts = {entry['id']: entry for catalog in packs for entry in catalog['parts']}
    held = {entry['id']: entry for catalog in packs for entry in catalog['heldItems']}
    for catalog in packs:
        for item in catalog['presets']:
            ids = [item[slot] for slot in ('body', 'head', 'hair', 'torso', 'legs', 'headwear', 'back') if item[slot]]
            missing = [part for part in ids if part not in parts]
            held_ids = [item[hand] for hand in ('heldRight', 'heldLeft') if item[hand]]
            missing += [h for h in held_ids if h not in held]
            if missing:
                raise ValueError(f'Preset {item["id"]} uses unknown ids: {missing}')
            if item['headwear'] and parts[item['headwear']]['rules']['hidesHair'] and item['hair'] in ids:
                ids.remove(item['hair'])
            total = sum(parts[part]['triangles'] for part in ids) + sum(held[h]['triangles'] for h in held_ids)
            if total > limit:
                raise ValueError(f'Preset {item["id"]}: {total} triangles (with held) exceed the avatar budget ({limit}).')
            print(f'  preset {item["id"]:20s} {total:5d} tris (incl held)')
    worst = {}
    for entry in parts.values():
        if entry.get('rigId', 'ual1') != 'ual1':
            continue
        worst[entry['slot']] = max(worst.get(entry['slot'], 0), entry['triangles'])
    open_hats = [
        entry['triangles'] for entry in parts.values()
        if entry.get('rigId', 'ual1') == 'ual1' and entry['slot'] == 'headwear' and not entry['rules']['hidesHair']
    ]
    head_layer = max(worst.get('hair', 0) + max(open_hats, default=0), worst.get('headwear', 0))
    total = sum(worst[slot] for slot in ('body', 'head', 'torso', 'legs', 'back')) + head_layer
    print(f'  worst slot mix {total} tris (limit {limit})')
    if total > limit:
        raise ValueError(f'The worst slot mix has {total} triangles (limit {limit}).')


def main():
    args = pk.script_args(__doc__, 'core', 'stage', 'meta')
    core = pk.Rig(args.core)
    core.check_contract()
    source = pk.Rig(SOURCE_RIG)
    if not np.array_equal(core.inverse_bind, source.inverse_bind):
        raise ValueError('The core rig and the source rig have different inverse bind matrices.')
    solver = pk.WeightSolver(source)

    packs = [json.loads((args.meta / 'core.json').read_text())]
    for pack, table in PACK_TABLE.items():
        catalog = build_pack(pack, table, core, solver, args.stage)
        packs.append(catalog)
        print(f'PACK {pack}')
        for kind in ('parts', 'heldItems', 'props'):
            for entry in catalog[kind]:
                print(f'  {entry.get("slot", kind):9s} {entry["id"]:28s} {entry["triangles"]:5d} tris')
    check_compositions(packs)
    (args.meta / 'manifest.json').write_text(json.dumps({'version': 1, 'packs': packs}, indent=2) + '\n')
    print(f'MANIFEST {args.meta / "manifest.json"}')


if __name__ == '__main__':
    main()
