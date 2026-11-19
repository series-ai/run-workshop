"""Sky and sea creature bodies for RUN Chisel Packs: Frost Eagle, Ember Drake and Abyssal Shark.

Each builder returns one skinned `MeshData` (one material, rigid bone weights) for its creature rig contract:
  build_avian_eagle_mesh   -> body_frost_eagle    (avian-rig.json, 21 joints)
  build_dragon_drake_mesh  -> body_ember_drake    (dragon-rig.json, 28 joints)
  build_aquatic_shark_mesh -> body_abyssal_shark  (aquatic-rig.json, 13 joints)

The joint names of these rigs end in `_l` and `_r`, so `Part.mirrored()` renames the weights of the right side.

Verification (builds each body on its shell rig and checks the budget, colliders, palette, sides and floor):
  blender --background --factory-startup --python creatures_sky_sea.py
"""

import math
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import polykit as pk  # noqa: E402
from polykit import X, Y, Z, V  # noqa: E402

AVIAN_CONTRACT = pk.load_json('avian-rig.json')
DRAGON_CONTRACT = pk.load_json('dragon-rig.json')
AQUATIC_CONTRACT = pk.load_json('aquatic-rig.json')

bone = pk.rigid


# --------------------------------------------------------------------------
# Shared shape helpers
# --------------------------------------------------------------------------

def spike(part, base, tip, radius, region, *, n=3, flat=1.0, up=Y, cap=False, **options):
    """A pointed facet cone: one ring at `base` and one apex at `tip`. It costs n triangles.

    This is the same shape as `build_monsters.spike`. Put the base inside the parent volume: the base is open
    unless `cap` is set.
    """
    base, tip = Vector(base), Vector(tip)
    axis = (tip - base).normalized()
    hint = Vector(up)
    if axis.cross(hint.normalized()).length < 0.25:
        hint = X if abs(axis.x) < 0.8 else Z
    right, upward, _ = pk.frame_from(axis, hint)
    return part.loft([pk.ring(base, right, upward, radius, radius * flat, n)], region, tip_end=tip, cap_start=cap,
                     **options)


def section(centre, rx, up, down, n=8):
    """A body cross-section in the XY plane with a flat top, flat flanks and a flat belly."""
    return pk.ring(V(*centre), X, Y, rx, up, n, rv_neg=down, squareness=0.86, phase=math.pi / n)


def hull(part, rings, skins, cell_region, *, band_ao=None, cap_start=None, cap_end=None, tip_start=None,
         tip_end=None, omitted_cells=()):
    """A closed loft with one palette region for each cell: `cell_region(row, column)` names it.

    `Part.loft` has one region for each band. A creature needs a pale belly below a dark back in one band.
    `cap_start` and `cap_end` are the regions of the flat end caps. `tip_start` and `tip_end` are apex points.
    """
    count = len(rings[0])
    if any(len(points) != count for points in rings):
        raise ValueError('All rings of a hull need the same point count.')
    if len(skins) != len(rings):
        raise ValueError('A hull needs one skin for each ring.')
    group = part.group()
    ids = []
    for points, skin in zip(rings, skins):
        with part.skinned(skin):
            ids.append([part.vert(point) for point in points])
    centres = [pk.centroid(points) for points in rings]

    def shade(row):
        return band_ao[row] if band_ao else 0.0

    for row in range(len(rings) - 1):
        middle = (centres[row] + centres[row + 1]) / 2
        for column in range(count):
            if (row, column) in omitted_cells:
                continue
            following = (column + 1) % count
            quad = (ids[row][column], ids[row][following], ids[row + 1][following], ids[row + 1][column])
            part.face(quad, cell_region(row, column), ao=shade(row), group=group, away_from=middle)
    if cap_start:
        part.face(ids[0], cap_start, group=group, toward=centres[0] - centres[1])
    if cap_end:
        part.face(ids[-1], cap_end, group=group, toward=centres[-1] - centres[-2])
    for tip, row, band in ((tip_start, 0, 0), (tip_end, -1, len(rings) - 2)):
        if tip is None:
            continue
        with part.skinned(skins[row]):
            apex = part.vert(tip)
        for column in range(count):
            following = (column + 1) % count
            part.face((ids[row][column], ids[row][following], apex), cell_region(band, column), ao=shade(band),
                      group=group, away_from=centres[row])
    return ids


def blade(part, root, tip, half_width, region, tip_region=None, *, face=Y, ridge=0.012, widest=0.55,
          root_scale=0.6, ao=0.0, tip_ao=0.0):
    """A feather blade: a flat underside and one ridge on the `face` side. It costs 9 triangles.

    The blade is widest at `widest` of its length. The last part can have its own region (dark feather tips).
    """
    root, tip = Vector(root), Vector(tip)
    side, lift, _ = pk.frame_from(tip - root, Vector(face))
    middle = root.lerp(tip, widest)

    def ridge_section(centre, half):
        return [centre - side * half, centre + lift * ridge, centre + side * half]

    belly = ridge_section(middle, half_width)
    part.loft([ridge_section(root, half_width * root_scale), belly], region, ao=ao)
    part.loft([belly], tip_region or region, tip_end=tip, ao=tip_ao)


def mandible(part, stations, skins, tip):
    """Join the mouth rim to a narrow chin. Each station gives z, rim height, width and depth."""
    rings = []
    for z, y, width, depth in stations:
        rings.append([V(x * width, y + h * depth, z) for x, h in
                      ((1, 0), (0.70, 0.16), (-0.70, 0.16), (-1, 0), (-0.65, -0.62),
                       (0, -1), (0.65, -0.62))])
    hull(part, rings, skins, lambda row, col: 'hair' if col < 3 else 'skin',
         cap_start='skin', tip_end=tip)


def lens(leading, trailing, half, normal):
    """A fin section: leading edge, one face, trailing edge, the other face."""
    leading, trailing = Vector(leading), Vector(trailing)
    middle = (leading + trailing) / 2
    return [leading, middle + normal * half, trailing, middle - normal * half]


# --------------------------------------------------------------------------
# Avian: 21-joint Frost Eagle
# --------------------------------------------------------------------------

# Rows of (heading in degrees from +Z, length, height of the claw point). The avian foot has no toe joint: the toes
# pitch with the foot. Long toes dig into the floor at push-off, and high claw points make the walk float.
EAGLE_TOES = ((-32, 0.125, 0.010), (0, 0.140, 0.010), (32, 0.125, 0.010), (180, 0.050, 0.004))


def build_avian_eagle_mesh(solver):
    """Frost Eagle on the 21-joint avian rig.

    Palette roles: primary = slate plumage, secondary = dark flight-feather tips and back mantle, skin = pale chest
    and belly plumage, hair = dark brow tufts and feather bars, accent = golden beak, shins and talons,
    metal = frost-steel talon bands, eye = eyes.
    Each chunk has rigid weights. The feet rest on y = 0.
    """
    part = pk.Part('body_frost_eagle')
    wp = {name: V(*value) for name, value in AVIAN_CONTRACT['worldPositions'].items()}

    # ---- torso: rump, pelvis, loin, deep breast, shoulders, neck -------------------------------------------------
    torso = (
        ((0, 0.515, -0.300), 0.060, 0.045, 0.045, bone(pelvis=0.55, tail_01=0.45)),
        ((0, 0.495, -0.100), 0.120, 0.105, 0.110, bone(pelvis=1.0)),
        ((0, 0.498, 0.010), 0.135, 0.118, 0.126, bone(pelvis=0.50, spine_01=0.50)),
        ((0, 0.500, 0.120), 0.148, 0.128, 0.142, bone(spine_01=1.0)),
        ((0, 0.508, 0.215), 0.155, 0.136, 0.156, bone(spine_01=0.50, chest=0.50)),
        ((0, 0.515, 0.310), 0.160, 0.142, 0.168, bone(chest=1.0)),
        ((0, 0.555, 0.440), 0.120, 0.112, 0.140, bone(chest=0.55, neck=0.45)),
        ((0, 0.600, 0.540), 0.084, 0.078, 0.086, bone(neck=1.0)),
        ((0, 0.635, 0.620), 0.068, 0.062, 0.066, bone(neck=1.0)),
    )

    def torso_region(row, column):
        if column in (4, 5, 6):
            return 'skin'
        if row in (1, 2, 3, 4) and column in (0, 1, 2):
            return 'secondary'
        return 'primary'

    hull(part, [section(c, rx, up, down) for c, rx, up, down, _ in torso], [skin for *_, skin in torso],
         torso_region, band_ao=[-0.06, -0.01, 0.0, 0.02, 0.02, 0.03, -0.02, -0.04], cap_start='primary')

    # ---- neck ruff and breast feathers ---------------------------------------------------------------------------
    def tuft_ring(centre, radius, reach, back, size, rows, skin, n=3):
        """Tufts around a centre. Each tuft starts on the ring and points out and back (-Z)."""
        with part.skinned(skin):
            for angle, region in rows:
                out = V(math.cos(math.radians(angle)), math.sin(math.radians(angle)), 0)
                base = V(*centre) + out * radius
                spike(part, base, base + out * reach + V(0, 0, -back), size, region, n=n, flat=0.5, up=Z, ao=-0.02)

    tuft_ring((0, 0.610, 0.560), 0.060, 0.035, 0.100, 0.048,
              ((90, 'primary'), (40, 'primary'), (140, 'primary'), (-5, 'primary'), (185, 'primary'),
               (-50, 'skin'), (230, 'skin'), (-90, 'skin')), bone(neck=1.0))
    tuft_ring((0, 0.560, 0.450), 0.100, 0.033, 0.116, 0.056,
              ((20, 'primary'), (160, 'primary'), (-25, 'skin'), (205, 'skin'), (-65, 'skin'), (245, 'skin')),
              bone(chest=0.6, neck=0.4))
    with part.skinned(bone(chest=1.0)):
        for x, y, z, half in ((0, 0.401, 0.411, 0.055), (0.072, 0.415, 0.382, 0.040),
                              (-0.072, 0.415, 0.382, 0.040)):
            blade(part, V(x, y, z), V(x * 1.12, y - 0.059, z - 0.120), half, 'skin',
                  face=-Y, ridge=0.009, widest=0.38)
    # Mantle: dark scapular feathers that lie on the back.
    for x, z, length, joint in ((0.060, 0.330, 0.270, 'chest'), (-0.060, 0.330, 0.270, 'chest'),
                                (0.0, 0.170, 0.300, 'spine_01')):
        with part.skinned(bone(**{joint: 1.0})):
            blade(part, V(x, 0.640, z), V(x * 1.5, 0.628, z - length), 0.066, 'secondary', 'hair', ridge=0.018,
                  ao=-0.02)

    # ---- head: skull, hooked beak, brow, eyes, crest --------------------------------------------------------------
    with part.skinned(bone(head=1.0)):
        skull = (((0, 0.635, 0.600), 0.066, 0.060, 0.064), ((0, 0.652, 0.670), 0.090, 0.082, 0.082),
                 ((0, 0.646, 0.740), 0.082, 0.072, 0.074), ((0, 0.626, 0.792), 0.054, 0.046, 0.050))
        hull(part, [section(c, rx, up, down) for c, rx, up, down in skull],
             [bone(neck=0.45, head=0.55), part.skin, part.skin, part.skin],
             lambda row, column: 'skin' if column in (4, 5, 6) or row == 2 else 'primary', band_ao=[-0.02, 0.02, 0.04])
        # Upper beak: a deep base, then a hook that points down past the lower mandible.
        part.tube([V(0, 0.628, 0.780), V(0, 0.620, 0.862), V(0, 0.584, 0.914)],
                  [(0.046, 0.046), (0.036, 0.038), (0.020, 0.026)], 4, 'accent', up=Y, tip_end=V(0, 0.528, 0.922),
                  band_ao=[0.02, 0.08])
        for side in (1, -1):
            eye = [V(side * x, y, z) for x, y, z in
                   ((0.084, 0.676, 0.697), (0.079, 0.665, 0.748), (0.081, 0.658, 0.726),
                    (0.084, 0.662, 0.704))]
            part.slab(eye, 0.004, 'eye', normal=V(side, 0.08, 0.16), shrink=0.86, ao=0.22)
            blade(part, V(side * 0.078, 0.686, 0.685), V(side * 0.071, 0.668, 0.765),
                  0.013, 'hair', face=X * side, ridge=0.006, widest=0.38)
            spike(part, V(side * 0.070, 0.700, 0.700), V(side * 0.104, 0.742, 0.590), 0.024, 'hair', n=3, flat=0.5,
                  up=Z)
        for x, y, reach in ((0.0, 0.722, 0.130), (0.042, 0.706, 0.105), (-0.042, 0.706, 0.105)):
            spike(part, V(x, y, 0.660), V(x * 1.6, y + 0.060, 0.660 - reach), 0.034, 'primary', n=3, flat=0.5, up=Z,
                  ao=-0.04)

    # ---- hinged lower mandible -----------------------------------------------------------------------------------
    with part.skinned(bone(jaw=1.0)):
        part.loft([pk.ring(V(0, 0.576, 0.752), X, Y, 0.040, 0.018, 4),
                   pk.ring(V(0, 0.572, 0.826), X, Y, 0.028, 0.014, 4)], 'accent', cap_start=True,
                  ring_skins=[bone(head=0.40, jaw=0.60), bone(jaw=1.0)],
                  tip_end=V(0, 0.576, 0.878), ao=-0.04)

    # ---- tail: covert wedge and a fan of seven feathers ----------------------------------------------------------
    part.loft([pk.ring(V(0, 0.520, -0.260), X, Y, 0.075, 0.042, 4), pk.ring(V(0, 0.536, -0.400), X, Y, 0.100, 0.030, 4),
               pk.ring(V(0, 0.550, -0.500), X, Y, 0.090, 0.020, 4)], 'primary', cap_end=True,
              ring_skins=[bone(pelvis=0.45, tail_01=0.55), bone(tail_01=1.0), bone(tail_01=0.50, tail_02=0.50)],
              band_ao=[-0.04, 0.0])
    with part.skinned(bone(tail_02=1.0)):
        for index, angle in enumerate((-39, -26, -13, 0, 13, 26, 39)):
            a = math.radians(angle)
            length = 0.400 - 0.0016 * abs(angle)
            lift = 0.010 if index % 2 else 0.0
            root = V(math.sin(a) * 0.050, 0.548 + lift, -0.440)
            blade(part, root, root + V(math.sin(a) * length, 0.012, -math.cos(a) * length), 0.052, 'primary',
                  'secondary', ridge=0.014, ao=-0.02)

    with part.mirrored():
        # ---- wing: arm, coverts, secondaries, primaries --------------------------------------------------------
        shoulder, elbow, wrist = wp['wing_upper_l'], wp['wing_mid_l'], wp['wing_tip_l']
        upper, mid, tip = bone(wing_upper_l=1.0), bone(wing_mid_l=1.0), bone(wing_tip_l=1.0)
        part.tube([shoulder + V(-0.020, 0.020, 0.010), shoulder.lerp(elbow, 0.5) + V(0, 0.012, 0.015), elbow,
                   elbow.lerp(wrist, 0.5) + V(0, 0.004, 0.020), wrist],
                  [(0.066, 0.040), (0.060, 0.034), (0.052, 0.030), (0.042, 0.025), (0.032, 0.020)], 4, 'primary', up=Y,
                  ring_skins=[bone(chest=0.55, wing_upper_l=0.45), upper,
                              bone(wing_upper_l=0.50, wing_mid_l=0.50), mid,
                              bone(wing_mid_l=0.50, wing_tip_l=0.50)],
                  tip_end=wrist + V(0.090, -0.010, -0.050),
                  band_ao=[-0.06, -0.04, -0.04, -0.02])

        def flight(root, sweep, length, half, skin, drop=0.035):
            """A flight feather. `sweep` is the angle from the back (-Z) to the side (+X) in degrees."""
            a = math.radians(sweep)
            shaft = V(math.sin(a) * length, -drop, -math.cos(a) * length)
            side, lift, _ = pk.frame_from(shaft, Y)
            # Broad vanes overlap along the shaft. A short oblique edge rounds each feather tip.
            with part.skinned(skin):
                outline = [part.vert(root + shaft * t + side * half * w) for t, w in
                           ((0, -0.36), (0.56, -1), (0.93, -0.59), (1, 0.08),
                            (0.86, 0.65), (0.52, 0.94), (0, 0.36))]
                ridge = part.vert(root + shaft * 0.64 + lift * 0.011)
                group = part.group()
                for i, current in enumerate(outline):
                    following = outline[(i + 1) % len(outline)]
                    part.face((current, following, ridge), 'secondary' if i in (2, 3) else 'primary',
                              toward=lift, group=group)
                part.face(outline, 'primary', toward=-lift, group=group)

        def coverts(start, end, depth, skin):
            """A plate over the feather roots of one arm segment. Its rear edge has two feather points."""
            front = [start + V(0, 0.019, 0.020), end + V(0, 0.017, 0.018)]
            rear_end, rear_start = end + V(0.030, -0.012, -depth), start + V(0.010, -0.012, -depth)
            rear = [rear_end, rear_end.lerp(rear_start, 0.48) + Z * 0.020, rear_start]
            with part.skinned(skin):
                part.slab(front + rear, 0.009, 'primary', normal=Y, shrink=0.88, ao=0.06)

        for index, t in enumerate((0.22, 0.52, 0.82)):
            flight(shoulder.lerp(elbow, t) + V(0, -0.010 - 0.004 * index, -0.030), 11 + 8 * t, 0.213 + 0.115 * t, 0.084, upper)
        for index, t in enumerate((0.10, 0.36, 0.62, 0.88)):
            flight(elbow.lerp(wrist, t) + V(0, -0.010 - 0.004 * index, -0.025), 16 + 14 * t, 0.330 + 0.072 * t, 0.082,
                   mid)
        for index, (sweep, length) in enumerate(((20, 0.440), (36, 0.460), (52, 0.450), (68, 0.400), (82, 0.340))):
            flight(wrist + V(0.005 * index, -0.010 - 0.004 * index, -0.010), sweep, length, 0.056, tip, drop=0.030)
        coverts(shoulder.lerp(elbow, 0.08), shoulder.lerp(elbow, 0.98), 0.157, upper)
        coverts(elbow.lerp(wrist, 0.02), elbow.lerp(wrist, 0.96), 0.160, mid)
        with part.skinned(tip):
            blade(part, wrist + V(-0.020, 0.012, 0.0), wrist + V(0.170, 0.0, -0.170), 0.056, 'primary', ridge=0.014,
                  ao=0.06)

        # ---- leg: feathered thigh, scaled shin, talon band, three front toes and one back toe ---------------------
        hip, knee, ankle = wp['leg_upper_l'], wp['leg_lower_l'], wp['foot_l']
        thigh, shin, foot = bone(leg_upper_l=1.0), bone(leg_lower_l=1.0), bone(foot_l=1.0)
        part.tube([hip + V(0, 0.070, 0.020), hip + V(0, -0.020, 0), hip.lerp(knee, 0.6), knee, knee.lerp(ankle, 0.55),
                   ankle + V(0, -0.012, 0)],
                  [(0.058, 0.072), (0.064, 0.078), (0.050, 0.060), (0.028, 0.030), (0.020, 0.022), (0.022, 0.024)], 5,
                  'primary', up=Z, cap_start=True,
                  ring_skins=[bone(pelvis=0.45, leg_upper_l=0.55), bone(pelvis=0.20, leg_upper_l=0.80), thigh,
                              bone(leg_upper_l=0.50, leg_lower_l=0.50), shin,
                              bone(leg_lower_l=0.50, foot_l=0.50)],
                  band_regions=['primary', 'primary', 'primary', 'accent', 'accent'],
                  band_ao=[0.0, 0.02, -0.02, -0.02, 0.02])
        with part.skinned(thigh):
            for z, drop in ((-0.150, 0.110), (-0.090, 0.130)):
                spike(part, V(hip.x, 0.330, z), V(hip.x + 0.010, 0.330 - drop, z - 0.050), 0.040, 'primary', n=3,
                      flat=0.5, up=X, ao=-0.04)
        with part.skinned(shin):
            band = knee.lerp(ankle, 0.72)
            part.loft([pk.ring(band + V(0, 0.016, 0), X, Z, 0.030, 0.030, 4),
                       pk.ring(band + V(0, -0.016, 0), X, Z, 0.030, 0.030, 4)], 'metal', ao=0.08)
        with part.skinned(foot):
            pad = V(ankle.x, 0.0, ankle.z)
            for angle, length, claw_y in EAGLE_TOES:
                a = math.radians(angle)
                heading = V(math.sin(a), 0, math.cos(a))
                side = Y.cross(heading)

                def toe_section(centre, half, top, side=side):
                    return [centre - side * half, centre + Y * top, centre + side * half]

                knuckle = toe_section(pad + heading * (length * 0.56), 0.016, 0.034)
                part.loft([toe_section(pad - heading * 0.008, 0.020, 0.040), knuckle], 'accent', ao=-0.02)
                part.loft([knuckle], 'accent', tip_end=pad + heading * length + Y * claw_y, ao=0.1)

    return part.to_mesh(solver)


# --------------------------------------------------------------------------
# Dragon: 28-joint Ember Drake
# --------------------------------------------------------------------------

def build_dragon_drake_mesh(solver):
    """Ember Drake on the 28-joint dragon rig.

    Palette roles: primary = ember dorsal scales, secondary = obsidian wing membranes and back plates,
    skin = ochre belly plates, hair = dark nostrils, mouth and horn bases, accent = ivory horns, teeth and claws,
    metal = scale trim and spurs, eye = eyes.
    Each chunk has rigid weights. The four feet rest on y = 0.
    """
    part = pk.Part('body_ember_drake')
    wp = {name: V(*value) for name, value in DRAGON_CONTRACT['worldPositions'].items()}

    # ---- trunk and S-curved neck: one hull with belly plates -----------------------------------------------------
    trunk = (
        ((0, 0.650, -0.560), 0.100, 0.100, 0.090, bone(pelvis=0.55, tail_01=0.45)),
        ((0, 0.660, -0.280), 0.170, 0.158, 0.160, bone(pelvis=1.0)),
        ((0, 0.652, -0.120), 0.160, 0.150, 0.154, bone(pelvis=0.50, spine_01=0.50)),
        ((0, 0.645, 0.040), 0.152, 0.142, 0.148, bone(spine_01=1.0)),
        ((0, 0.660, 0.190), 0.176, 0.162, 0.170, bone(spine_01=0.50, chest=0.50)),
        ((0, 0.675, 0.340), 0.200, 0.180, 0.190, bone(chest=1.0)),
        ((0, 0.725, 0.540), 0.140, 0.134, 0.150, bone(chest=0.55, neck=0.45)),
        ((0, 0.815, 0.700), 0.104, 0.098, 0.104, bone(neck=1.0)),
        ((0, 0.875, 0.830), 0.090, 0.084, 0.088, bone(neck=1.0)),
        ((0, 0.890, 0.930), 0.078, 0.074, 0.078, bone(neck=0.3, head=0.7)),
    )
    hull(part, [section(c, rx, up, down) for c, rx, up, down, _ in trunk], [skin for *_, skin in trunk],
         lambda row, column: 'skin' if column in (4, 5, 6) else 'primary',
         band_ao=[-0.06, -0.01, 0.0, 0.03, 0.01, -0.02, 0.03, -0.03, 0.02], cap_start='primary')

    # ---- dorsal ridge: back plates from the neck to the hips ------------------------------------------------------
    for z, top, joint, size in ((0.800, 0.955, 'neck', 0.040), (0.680, 0.900, 'neck', 0.046),
                                (0.520, 0.850, 'chest', 0.054), (0.330, 0.846, 'chest', 0.062),
                                (0.110, 0.795, 'spine_01', 0.058), (-0.110, 0.795, 'spine_01', 0.054),
                                (-0.330, 0.815, 'pelvis', 0.050)):
        with part.skinned(bone(**{joint: 1.0})):
            spike(part, V(0, top - 0.040, z + 0.050), V(0, top + 0.075, z - 0.085), size, 'secondary', n=4, flat=0.4,
                  up=Z, ao=-0.02)

    # ---- tail: whip with belly plates, dorsal spikes and a barbed spade -------------------------------------------
    tail = (((0, 0.650, -0.540), 0.098, bone(pelvis=0.45, tail_01=0.55)), ((0, 0.635, -0.760), 0.084, bone(tail_01=1.0)),
            ((0, 0.620, -0.960), 0.070, bone(tail_01=0.50, tail_02=0.50)), ((0, 0.610, -1.180), 0.055, bone(tail_02=1.0)),
            ((0, 0.600, -1.400), 0.041, bone(tail_02=0.50, tail_03=0.50)), ((0, 0.600, -1.600), 0.028, bone(tail_03=1.0)))
    hull(part, [pk.ring(V(*c), X, Y, radius, radius, 6, phase=math.pi / 6) for c, radius, _ in tail],
         [skin for *_, skin in tail], lambda row, column: 'skin' if column in (3, 4) else 'primary',
         band_ao=[0.0, -0.03, 0.02, -0.03, 0.02])
    for z, top, joint, size in ((-0.560, 0.745, 'tail_01', 0.042), (-0.760, 0.716, 'tail_01', 0.038),
                                (-0.960, 0.688, 'tail_02', 0.034)):
        with part.skinned(bone(**{joint: 1.0})):
            spike(part, V(0, top - 0.030, z + 0.040), V(0, top + 0.055, z - 0.070), size, 'secondary', n=3, flat=0.45,
                  up=Z)
    with part.skinned(bone(tail_03=1.0)):
        part.loft([pk.ring(V(0, 0.600, -1.580), X, Y, 0.030, 0.028, 4),
                   pk.ring(V(0, 0.600, -1.700), X, Y, 0.120, 0.020, 4)], 'secondary', tip_end=V(0, 0.600, -1.930),
                  ao=-0.02)

    # ---- head: armoured skull and snout, horns, brow, eyes, nostrils, upper teeth ---------------------------------
    with part.skinned(bone(head=1.0)):
        skull = (((0, 0.890, 0.910), 0.088, 0.080), ((0, 0.900, 0.990), 0.122, 0.094),
                 ((0, 0.880, 1.100), 0.090, 0.064), ((0, 0.866, 1.240), 0.066, 0.046),
                 ((0, 0.862, 1.305), 0.044, 0.032))
        # Column 4 is the flat underside. On the snout it is the roof of the mouth.
        hull(part, [pk.ring(V(*c), X, Y, rx, ry, 6, squareness=0.85) for c, rx, ry in skull],
             [bone(neck=0.40, head=0.60), part.skin, part.skin, part.skin, part.skin],
             lambda row, column: 'hair' if column == 4 and row >= 1 else 'primary', band_ao=[-0.04, 0.02, 0.0, 0.04],
             cap_end='primary')
        part.slab([V(0, 0.972, 0.940), V(0.062, 0.968, 1.000), V(0, 0.944, 1.110), V(-0.062, 0.968, 1.000)], 0.022,
                  'secondary', normal=V(0, 1, 0.2), shrink=0.7, ao=0.04)
        for side in (1, -1):
            # Main horn: a dark base collar, then an ivory curve that sweeps back and up.
            part.tube([V(side * 0.066, 0.940, 0.950), V(side * 0.084, 0.990, 0.880), V(side * 0.110, 1.060, 0.780)],
                      [0.038, 0.032, 0.022], 4, 'accent', up=Z, tip_end=V(side * 0.128, 1.170, 0.640),
                      band_regions=['hair', 'accent'], band_ao=[-0.04, 0.04])
            spike(part, V(side * 0.100, 0.860, 0.960), V(side * 0.170, 0.850, 0.840), 0.026, 'accent', n=3, up=Y,
                  ao=0.04)
            part.plate(V(side * 0.103, 0.912, 1.030), V(side * 0.86, 0.22, 0.46), Y, 0.052, 0.020, 0.008, 'eye',
                       shrink=0.8, ao=0.25)
            spike(part, V(side * 0.092, 0.936, 1.075), V(side * 0.138, 0.988, 0.930), 0.026, 'metal', n=3, flat=0.5,
                  up=Z, ao=0.04)
            part.slab([V(side * 0.014, 0.892, 1.288), V(side * 0.040, 0.886, 1.270), V(side * 0.022, 0.896, 1.240)],
                      0.006, 'hair', normal=V(side * 0.3, 1, 0.1), shrink=0.7, ao=-0.2)
            for x, z, y in ((0.051, 1.110, 0.835), (0.043, 1.182, 0.835), (0.033, 1.258, 0.835)):
                spike(part, V(side * x, y, z), V(side * x, y - 0.027, z - 0.005), 0.009,
                      'accent', n=3, up=Z, ao=0.10)

    with part.skinned(bone(jaw=1.0)):
        jaw = ((0.939, 0.858, 0.048, 0.029), (1.025, 0.831, 0.084, 0.039),
               (1.136, 0.822, 0.064, 0.028), (1.245, 0.826, 0.043, 0.018))
        mandible(part, jaw, [bone(head=0.45, jaw=0.55), part.skin, part.skin, part.skin], V(0, 0.832, 1.293))
        for side in (1, -1):
            for x, z in ((0.051, 1.143), (0.039, 1.213)):
                spike(part, V(side * x, 0.823, z), V(side * x, 0.843, z - 0.004), 0.008,
                      'accent', up=Z, ao=0.10)

    with part.mirrored():
        # ---- wing: arm bones, three fingers, thumb claw, faceted membrane -----------------------------------------
        shoulder, elbow, wrist = wp['wing_upper_l'], wp['wing_mid_l'], wp['wing_tip_l']
        upper, mid, tip = bone(wing_upper_l=1.0), bone(wing_mid_l=1.0), bone(wing_tip_l=1.0)
        wrist = elbow.lerp(wrist, 0.78) - Z * 0.095
        part.tube([shoulder + V(-0.060, -0.030, 0), shoulder.lerp(elbow, 0.5), elbow, elbow.lerp(wrist, 0.5), wrist],
                  [(0.075, 0.054), (0.086, 0.048), (0.052, 0.040), (0.043, 0.024), (0.033, 0.023)], 5, 'primary', up=Y,
                  ring_skins=[bone(chest=0.55, wing_upper_l=0.45), upper,
                              bone(wing_upper_l=0.50, wing_mid_l=0.50), mid,
                              bone(wing_mid_l=0.50, wing_tip_l=0.50)],
                  cap_end=True, band_ao=[0.0, 0.02, 0.0, 0.02])
        fingers = (V(1.888, 0.641, 0.155), V(1.671, 0.610, -0.229), V(1.338, 0.621, -0.391))
        with part.skinned(tip):
            for finger in fingers:
                spike(part, wrist, finger, 0.022, 'primary', n=3, up=Y, ao=0.04)
            spike(part, wrist + V(0, 0.010, 0.010), wrist + V(0.044, 0.031, 0.050), 0.024, 'accent', n=3, up=Y, ao=0.08)
        # Membrane rows go from the leading edge to the trailing edge. The middle point of each row sags.
        rows = (
            (shoulder + V(-0.020, -0.020, -0.020), V(0.130, 0.740, 0.020), bone(wing_upper_l=0.6, chest=0.4),
             bone(wing_upper_l=0.4, spine_01=0.6)),
            (shoulder.lerp(elbow, 0.5), V(0.480, 0.720, -0.090), upper, upper),
            (elbow, V(0.800, 0.690, -0.310), bone(wing_upper_l=0.5, wing_mid_l=0.5),
             bone(wing_upper_l=0.5, wing_mid_l=0.5)),
            (elbow.lerp(wrist, 0.5), V(1.100, 0.650, -0.310), mid, bone(wing_mid_l=0.6, wing_tip_l=0.4)),
            (wrist, fingers[2], bone(wing_mid_l=0.5, wing_tip_l=0.5), tip),
            (wrist, V(1.498, 0.622, -0.202), tip, tip),
            (wrist, fingers[1], tip, tip),
            (wrist, V(1.660, 0.627, 0.010), tip, tip),
            (wrist, fingers[0], tip, tip),
        )
        part.loft([[lead, lead.lerp(trail, 0.5) + V(0, -0.030, 0), trail] for lead, trail, _, _ in rows], 'secondary',
                  closed=False, toward=Y, two_sided=True, thickness=0.006, inner_ao=-0.12,
                  cell_skins=[[lead_skin, trail_skin, trail_skin] for _, _, lead_skin, trail_skin in rows],
                  band_ao=[-0.04, 0.02, -0.04, 0.02, -0.02, 0.03, -0.02, 0.03])

        # ---- four legs: muscle flare, clawed foot ------------------------------------------------------------------
        for prefix, trunk_bone, front in (('foreleg', 'chest', True), ('hindleg', 'pelvis', False)):
            upper_name, lower_name, foot_name = (f'{prefix}_{segment}_l' for segment in ('upper', 'lower', 'foot'))
            hip, knee, ankle = wp[upper_name], wp[lower_name], wp[foot_name]
            thigh, shin, foot = bone(**{upper_name: 1.0}), bone(**{lower_name: 1.0}), bone(**{foot_name: 1.0})
            bulge = V(0, 0, 0.012) if front else V(0, 0, 0.040)
            radii = ([(0.082, 0.110), (0.090, 0.118), (0.064, 0.075), (0.062, 0.072), (0.035, 0.042), (0.039, 0.042)]
                     if front else
                     [(0.090, 0.140), (0.100, 0.152), (0.077, 0.119), (0.062, 0.074), (0.035, 0.042), (0.039, 0.042)])
            part.tube([hip + V(0, 0.100, 0), hip + V(0, -0.020, 0), hip.lerp(knee, 0.55) + bulge, knee,
                       knee.lerp(ankle, 0.52) - Z * 0.028, ankle], radii, 5, 'primary', up=Z, cap_start=True,
                      ring_skins=[bone(**{trunk_bone: 0.70, upper_name: 0.30}),
                                  bone(**{trunk_bone: 0.25, upper_name: 0.75}), thigh,
                                  bone(**{upper_name: 0.50, lower_name: 0.50}), shin,
                                  bone(**{lower_name: 0.50, foot_name: 0.50})],
                      band_ao=[0.0, 0.03, -0.02, 0.0, -0.04])
            with part.skinned(shin):
                # Spur on the back of the elbow or the hock.
                spike(part, knee + V(0, 0.010, -0.030), knee + V(0, 0.070, -0.150), 0.026, 'metal', n=3, flat=0.5,
                      up=X, ao=0.06)
            with part.skinned(foot):
                pad = [pk.ring(V(ankle.x, y, ankle.z + dz), X, Z, w, d, 6) for y, dz, w, d in
                       ((ankle.y, 0.0, 0.039, 0.042), (0, 0.055, 0.065, 0.078))]
                part.loft(pad, 'primary', cap_end=True,
                          ring_skins=[bone(**{lower_name: 0.45, foot_name: 0.55}), foot])
                for dx in (-0.042, 0, 0.042):
                    base = V(ankle.x + dx, 0.020, ankle.z + 0.094 - abs(dx) * 0.3)
                    knuckle = base + V(dx * 0.26, 0.002, 0.039)
                    rim = pk.ring(knuckle, X, Y, 0.020, 0.017, 3, phase=math.pi / 2)
                    part.loft([rim], 'primary', tip_start=base - Z * 0.060)
                    part.loft([rim], 'accent', tip_end=knuckle + V(dx * 0.22, -0.021, 0.049))

    return part.to_mesh(solver)


# --------------------------------------------------------------------------
# Aquatic: 13-joint Abyssal Shark
# --------------------------------------------------------------------------

# Angles of one body cross-section in degrees. 0 is the left side (+X), 90 is the back (+Y).
# The two narrow flank facets (354..6 and 174..186) are the lateral stripe.
SHARK_PROFILE = (6, 46, 80, 100, 134, 174, 186, 232, 308, 354)
SHARK_STRIPE = (5, 9)
SHARK_BELLY = (6, 7, 8)
SHARK_TOP = 2

# Rows of (z, centre y, half width, height above the centre, depth below the centre, skin). Snout to tail.
SHARK_STATIONS = (
    (0.900, 0.652, 0.075, 0.040, 0.035, bone(head=1.0)),
    (0.780, 0.660, 0.135, 0.080, 0.060, bone(head=1.0)),
    (0.640, 0.665, 0.175, 0.125, 0.100, bone(head=1.0)),
    (0.500, 0.660, 0.205, 0.165, 0.165, bone(head=0.45, neck=0.55)),
    (0.340, 0.650, 0.225, 0.195, 0.200, bone(neck=1.0)),
    (0.250, 0.638, 0.232, 0.205, 0.210, bone(neck=0.50, pelvis=0.50)),
    (0.160, 0.625, 0.235, 0.210, 0.215, bone(pelvis=1.0)),
    (0.030, 0.618, 0.228, 0.208, 0.205, bone(pelvis=0.50, spine_01=0.50)),
    (-0.100, 0.610, 0.215, 0.200, 0.190, bone(spine_01=1.0)),
    (-0.280, 0.600, 0.185, 0.175, 0.160, bone(spine_01=0.5, tail_01=0.5)),
    (-0.460, 0.590, 0.150, 0.145, 0.130, bone(tail_01=1.0)),
    (-0.640, 0.575, 0.110, 0.110, 0.100, bone(tail_01=0.5, tail_02=0.5)),
    (-0.840, 0.560, 0.075, 0.080, 0.070, bone(tail_02=1.0)),
    (-1.020, 0.548, 0.048, 0.055, 0.050, bone(tail_02=0.5, tail_fin=0.5)),
    (-1.160, 0.540, 0.035, 0.045, 0.042, bone(tail_fin=1.0)),
)


def shark_point(z, y, rx, up, down, angle):
    """A point of the shark cross-section at `angle` degrees."""
    c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    return V(rx * math.copysign(abs(c) ** 0.9, c), y + (up if s >= 0 else down) * math.copysign(abs(s) ** 0.9, s), z)


def shark_surface(z, angle):
    """A point on a facet of the shark body. `angle` must be inside one facet of SHARK_PROFILE."""
    for before, after in zip(SHARK_STATIONS, SHARK_STATIONS[1:]):
        if after[0] <= z <= before[0]:
            t = (z - before[0]) / (after[0] - before[0])
            row = [before[index] + (after[index] - before[index]) * t for index in range(5)]
            break
    else:
        raise ValueError(f'z = {z} is outside the shark body.')
    # The facet from the last profile angle to the first one crosses 0 degrees.
    angle %= 360
    if angle < SHARK_PROFILE[0]:
        angle += 360
    profile = SHARK_PROFILE + (SHARK_PROFILE[0] + 360,)
    low = max(a for a in profile if a <= angle)
    high = min(a for a in profile if a >= angle)
    if low == high:
        return shark_point(*row, angle)
    return shark_point(*row, low).lerp(shark_point(*row, high), (angle - low) / (high - low))


def build_aquatic_shark_mesh(solver):
    """Abyssal Shark on the 13-joint aquatic rig. The body hovers at the contract bind height (pelvis y = 0.62).

    Palette roles: primary = slate-blue dorsal hide, secondary = dark fin tips and dorsal crest, skin = pale belly,
    hair = gill slits, nostrils and mouth interior, accent = teeth, metal = pale lateral stripe and tail keels,
    eye = eyes. Each chunk has rigid weights.
    """
    part = pk.Part('body_abyssal_shark')
    wp = {name: V(*value) for name, value in AQUATIC_CONTRACT['worldPositions'].items()}

    # ---- body: snout, head, gill region, trunk, peduncle ----------------------------------------------------------
    def body_region(row, column):
        if column == 7 and row == 1:
            return 'hair'  # The roof of the mouth over the lower jaw.
        if column in SHARK_BELLY:
            return 'skin'
        if column in SHARK_STRIPE and row >= 3:
            return 'metal'
        if column == SHARK_TOP and row >= 3:
            return 'secondary'
        return 'primary'

    body = hull(part, [[shark_point(z, y, rx, up, down, angle) for angle in SHARK_PROFILE]
                for z, y, rx, up, down, _ in SHARK_STATIONS], [skin for *_, skin in SHARK_STATIONS], body_region,
         band_ao=[0.04, 0.02, 0.0, -0.03, 0.01, 0.02, 0.02, 0.03, 0.0, 0.02, -0.02, 0.02, -0.02, -0.04],
         tip_start=V(0, 0.646, 1.010), cap_end='primary', omitted_cells={(3, 0), (3, 4)})

    # Cut four tapered gill openings into each flank. The outside edges share the hull vertices.
    for side, low_col, high_col in ((1, 0, 1), (-1, 5, 4)):
        low, high = body[3][low_col], body[3][high_col]
        end_low, end_high = body[4][low_col], body[4][high_col]
        normal = V(side, 0.4, 0)
        previous = (low, high)
        for i in range(4):
            z = 0.482 - 0.035 * i
            for offset, depth in ((0, 0), (-0.008, -0.004), (-0.014, 0.002)):
                points = []
                for station, angle in ((z + offset * 0.45, 10 + i), (z - 0.012 + offset, 42 - i * 2)):
                    head = 0.45 * (station - 0.34) / 0.16
                    with part.skinned(bone(head=head, neck=1 - head)):
                        point = shark_surface(station, angle)
                        points.append(part.vert(V(side * (point.x + depth), point.y, point.z)))
                a, b = points
                region = 'hair' if depth < 0 else 'primary'
                part.face((previous[0], previous[1], b, a), region, toward=normal)
                if previous[0] != low:
                    part.face((low, previous[0], a), 'primary', toward=normal)
                    part.face((high, b, previous[1]), 'primary', toward=normal)
                previous = a, b
        a, b = previous
        part.face((a, b, end_high, end_low), 'primary', toward=normal)
        part.face((low, a, end_low), 'primary', toward=normal)
        part.face((high, end_high, b), 'primary', toward=normal)

    with part.mirrored():
        with part.skinned(bone(head=1.0)):
            for z in (0.662, 0.707, 0.751, 0.792, 0.823):
                root = shark_surface(z, 308)
                spike(part, root + V(-0.005, 0.006, 0), root + V(-0.010, -0.018, -0.005),
                      0.009, 'accent', up=Z, ao=0.10)
            eye = [shark_surface(z, angle) for z, angle in
                   ((0.739, 7), (0.714, 24), (0.678, 23), (0.690, 7))]
            part.slab(eye, 0.005, 'secondary', normal=V(1, 0.38, 0.28), shrink=0.7)
            iris = [shark_surface(z, angle) + V(0.006, 0, 0) for z, angle in
                    ((0.728, 12), (0.708, 21), (0.693, 16), (0.709, 9))]
            part.slab(iris, 0.002, 'eye', normal=X, shrink=0.85, ao=0.18)
            nostril = [shark_surface(z, angle) for z, angle in
                       ((0.877, 23), (0.861, 32), (0.846, 27), (0.860, 20))]
            part.slab(nostril, 0.002, 'hair', normal=V(1, 0.5, 0.3), shrink=0.84)

        # ---- pectoral fin: a long swept blade with a dark tip ------------------------------------------------------
        with part.skinned(bone(fin_l=1.0)):
            normal = V(0.36, 0.93, 0.05).normalized()
            part.loft([lens(V(0.170, 0.490, 0.275), V(0.170, 0.500, 0.045), 0.032, normal),
                       lens(V(0.330, 0.440, 0.170), V(0.350, 0.440, -0.040), 0.024, normal),
                       lens(V(0.480, 0.380, 0.030), V(0.510, 0.375, -0.120), 0.016, normal),
                       lens(V(0.590, 0.336, -0.110), V(0.610, 0.332, -0.200), 0.010, normal)], 'primary',
                      ring_skins=[bone(pelvis=0.60, fin_l=0.40), bone(fin_l=1.0), bone(fin_l=1.0), bone(fin_l=1.0)],
                      tip_end=V(0.660, 0.312, -0.300), band_regions=['primary', 'primary', 'secondary'],
                      band_ao=[0.0, 0.02, -0.02])
        # ---- pelvic fin ----------------------------------------------------------------------------------------------
        with part.skinned(bone(pelvic_fin_l=1.0)):
            normal = V(0.45, 0.88, 0.10).normalized()
            part.loft([lens(V(0.070, 0.495, -0.440), V(0.070, 0.500, -0.590), 0.022, normal),
                       lens(V(0.160, 0.440, -0.530), V(0.175, 0.440, -0.640), 0.013, normal)], 'primary',
                      ring_skins=[bone(tail_01=0.60, pelvic_fin_l=0.40), bone(pelvic_fin_l=1.0)],
                      tip_end=V(0.245, 0.385, -0.720), band_regions=['secondary'], ao=-0.02)
        # ---- keel on each side of the tail stalk -----------------------------------------------------------------
        with part.skinned(bone(tail_02=1.0)):
            part.slab([shark_surface(-0.860, 3), shark_surface(-0.940, 5), shark_surface(-1.010, 0),
                       shark_surface(-0.940, -5)], 0.014, 'metal', normal=X, shrink=0.5, ao=0.08)

    # ---- hinged lower jaw: dark mouth floor and lower teeth --------------------------------------------------------
    with part.skinned(bone(jaw=1.0)):
        jaw = ((0.495, 0.593, 0.060, 0.033), (0.606, 0.574, 0.112, 0.042),
               (0.702, 0.586, 0.102, 0.030), (0.782, 0.599, 0.077, 0.021),
               (0.834, 0.610, 0.042, 0.012))
        mandible(part, jaw, [bone(neck=0.50, head=0.50), bone(head=0.25, jaw=0.75),
                             part.skin, part.skin, part.skin], V(0, 0.620, 0.874))
        for side in (1, -1):
            for z, y, width, depth in jaw[2:]:
                root = V(side * width * 0.79, y + depth * 0.04, z)
                spike(part, root, root + V(-side * 0.005, 0.017, -0.005), 0.008,
                      'accent', up=Z, ao=0.1)

    # ---- dorsal fins and anal fin -----------------------------------------------------------------------------------
    with part.skinned(bone(pelvis=0.5, spine_01=0.5)):
        part.loft([lens(V(0, 0.790, 0.150), V(0, 0.780, -0.190), 0.032, X),
                   lens(V(0, 0.930, 0.030), V(0, 0.920, -0.150), 0.022, X),
                   lens(V(0, 1.050, -0.080), V(0, 1.040, -0.200), 0.014, X),
                   lens(V(0, 1.130, -0.180), V(0, 1.125, -0.250), 0.008, X)], 'primary',
                  tip_end=V(0, 1.180, -0.320), band_regions=['primary', 'primary', 'secondary'],
                  band_ao=[0.0, 0.02, -0.02])
    with part.skinned(bone(tail_01=1.0)):
        part.loft([lens(V(0, 0.690, -0.560), V(0, 0.670, -0.700), 0.016, X),
                   lens(V(0, 0.760, -0.660), V(0, 0.755, -0.730), 0.009, X)], 'primary',
                  tip_end=V(0, 0.800, -0.770), band_regions=['secondary'], ao=-0.02)
        part.loft([lens(V(0, 0.490, -0.640), V(0, 0.500, -0.760), 0.014, X),
                   lens(V(0, 0.440, -0.730), V(0, 0.442, -0.790), 0.008, X)], 'skin',
                  tip_end=V(0, 0.410, -0.830), ao=-0.04)
    # Dorsal scutes between the head and the fin, and behind the fin.
    for z, joint in ((0.420, 'neck'), (0.290, 'neck'), (-0.300, 'spine_01'), (-0.420, 'tail_01')):
        with part.skinned(bone(**{joint: 1.0})):
            scale = [shark_surface(z + dz, angle) for dz, angle in
                     ((0.052, 90), (0, 78), (-0.053, 90), (0, 102))]
            part.slab(scale, 0.009, 'secondary', normal=Y, shrink=0.4, ao=-0.02)

    # ---- caudal fin: long upper lobe, short lower lobe -----------------------------------------------------------
    with part.skinned(bone(tail_fin=1.0)):
        stalk = wp['tail_fin']
        part.loft([lens(stalk + V(0, 0.020, 0.070), stalk + V(0, 0.030, -0.080), 0.030, X),
                   lens(V(0, 0.720, -1.240), V(0, 0.770, -1.400), 0.022, X),
                   lens(V(0, 0.880, -1.400), V(0, 0.930, -1.530), 0.014, X),
                   lens(V(0, 0.990, -1.530), V(0, 1.020, -1.610), 0.008, X)], 'primary',
                  tip_end=V(0, 1.070, -1.680), band_regions=['primary', 'primary', 'secondary'],
                  band_ao=[0.0, 0.02, -0.02])
        part.loft([lens(stalk + V(0, -0.010, 0.060), stalk + V(0, -0.020, -0.070), 0.026, X),
                   lens(V(0, 0.410, -1.270), V(0, 0.398, -1.360), 0.016, X)], 'primary',
                  tip_end=V(0, 0.310, -1.440), band_regions=['secondary'], ao=-0.02)

    return part.to_mesh(solver)


# --------------------------------------------------------------------------
# Verification
# --------------------------------------------------------------------------

CREATURES = {
    'avian': (AVIAN_CONTRACT, build_avian_eagle_mesh, 'build_retargeted_avian_clips', 'Avian_Rig'),
    'dragon': (DRAGON_CONTRACT, build_dragon_drake_mesh, 'build_retargeted_dragon_clips', 'Dragon_Rig'),
    'aquatic': (AQUATIC_CONTRACT, build_aquatic_shark_mesh, 'build_retargeted_aquatic_clips', 'Aquatic_Rig'),
}
GROUNDED_RIGS = ('avian', 'dragon')
FLOOR_CLIPS = ('Idle', 'Walk', 'Death', 'Take_Off', 'Land')
MAX_TRIANGLES = pk.BUDGETS['classes']['body']['maxTriangles']
SIDE_MARGIN = 0.015
FLOOR_LIMIT = -0.02


def build_creature(rig_id, work_dir):
    """Build one body on a shell rig GLB. Return (mesh, contract, retargeted clips)."""
    import retarget

    contract, build, clips_name, rig_name = CREATURES[rig_id]
    clips = getattr(retarget, clips_name)(contract, pk.TOOL_ROOT / 'assets/source/creatures')
    shell = pk.GlbBuilder()
    shell.add_custom_rig(contract, clips, rig_name=rig_name)
    path = Path(work_dir) / f'{rig_id}-rig.glb'
    shell.write(path)
    rig = pk.Rig(path, expected_joints=contract['joints'])
    rig.check_contract(contract=contract)
    mesh = build(pk.SegmentWeightSolver(rig))
    if rig_id in GROUNDED_RIGS:
        clips = retarget.clamp_clips_to_floor(clips, [mesh], contract)
    return mesh, contract, clips


def posed_positions(mesh, contract, clip, frame):
    """Linear blend skinning of the bind mesh at one clip frame. The bind rotations of a creature rig are identity."""
    names = contract['joints']
    rest = np.array([contract['worldPositions'][name] for name in names], dtype=np.float64)
    rotation = np.zeros((len(names), 3, 3))
    position = np.zeros((len(names), 3))
    for index, name in enumerate(names):
        tracks = clip['tracks'].get(name, {})
        local = np.eye(3)
        if 'rotation' in tracks:
            x, y, z, w = tracks['rotation'][frame]
            local = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                              [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                              [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        parent = contract['parents'][name]
        if parent is None:
            rotation[index], position[index] = local, rest[index]
            continue
        parent_index = names.index(parent)
        if parent_index >= index:
            raise ValueError(f'Joint {name} comes before its parent.')
        offset = np.array(tracks['translation'][frame]) if 'translation' in tracks else rest[index] - rest[parent_index]
        rotation[index] = rotation[parent_index] @ local
        position[index] = position[parent_index] + rotation[parent_index] @ offset
    posed = np.zeros_like(mesh.positions)
    for slot in range(4):
        joints = mesh.joints[:, slot]
        moved = np.einsum('vij,vj->vi', rotation[joints], mesh.positions - rest[joints]) + position[joints]
        posed += moved * mesh.weights[:, slot:slot + 1]
    return posed


def verify(rig_id, work_dir):
    """Check one body against the rules of the brief. Return a report dict. `failures` lists each failed rule."""
    mesh, contract, clips = build_creature(rig_id, work_dir)
    names = contract['joints']
    failures = []
    if mesh.triangles > MAX_TRIANGLES:
        failures.append(f'{mesh.triangles} triangles exceed the body budget ({MAX_TRIANGLES})')
    colliders = pk.measure_ragdoll_colliders(mesh, pk.Rig(Path(work_dir) / f'{rig_id}-rig.glb', names), rig_id)
    missing = sorted(set(names) - {'root'} - set(colliders))
    if missing:
        failures.append(f'no ragdoll collider for {missing}')
    region_of_u = {round(u, 4): region for region, u in pk.REGION_U.items()}
    regions = {}
    for u in mesh.uvs[mesh.indices.reshape(-1, 3)[:, 0], 0]:
        region = region_of_u[round(float(u), 4)]
        regions[region] = regions.get(region, 0) + 1
    if set(regions) != set(pk.REGIONS):
        failures.append(f'palette regions {sorted(set(pk.REGIONS) - set(regions))} are not used')
    sides = {'l': 0, 'r': 0}
    for position, joints, weights in zip(mesh.positions, mesh.joints, mesh.weights):
        for joint, weight in zip(joints, weights):
            name = names[int(joint)]
            if weight < 0.5 or name[-2:] not in ('_l', '_r'):
                continue
            sides[name[-1]] += 1
            if position[0] * (1 if name.endswith('_l') else -1) <= SIDE_MARGIN:
                failures.append(f'a {name} vertex is at x = {position[0]:.4f}')
    if not sides['l'] or sides['l'] != sides['r']:
        failures.append(f'the side vertex counts differ: {sides}')
    bounds = mesh.bounds()
    grounded = rig_id in GROUNDED_RIGS
    if grounded and abs(bounds['min'][1]) > 0.003:
        failures.append(f'the bind pose is not on y = 0 (min y = {bounds["min"][1]})')
    floors = {}
    for clip in clips:
        lows = [float(posed_positions(mesh, contract, clip, frame)[:, 1].min()) for frame in range(len(clip['times']))]
        floors[clip['name']] = {'min': round(min(lows), 4), 'end': round(lows[-1], 4)}
        if grounded and clip['name'] in FLOOR_CLIPS and min(lows) < FLOOR_LIMIT:
            failures.append(f'clip {clip["name"]} sinks to y = {min(lows):.4f} (limit {FLOOR_LIMIT})')
    return {'mesh': mesh.name, 'triangles': mesh.triangles, 'colliders': len(colliders), 'joints': len(names),
            'regions': regions, 'sides': sides, 'bounds': bounds, 'floors': floors, 'failures': failures}


def main():
    failed = False
    with tempfile.TemporaryDirectory() as work_dir:
        for rig_id in CREATURES:
            report = verify(rig_id, work_dir)
            print(f'{"FAIL" if report["failures"] else "OK"} {report["mesh"]}: {report["triangles"]} triangles, '
                  f'{report["colliders"]}/{report["joints"] - 1} ragdoll colliders')
            print(f'   regions {report["regions"]}')
            print(f'   sides {report["sides"]} bounds min {report["bounds"]["min"]} max {report["bounds"]["max"]}')
            for name, floor in report['floors'].items():
                print(f'   clip {name:16s} min y {floor["min"]:8.4f}  end {floor["end"]:8.4f}')
            for failure in report['failures']:
                failed = True
                print(f'   FAILED: {failure}')
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
