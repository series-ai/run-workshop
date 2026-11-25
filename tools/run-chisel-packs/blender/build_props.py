"""World props (static modular environment pieces + rigged/animated interactive props) for all 5 themed packs.

Every prop follows the RUN Chisel prop contract:
  - Single mesh & single material (Poly_Atlas_Mat)
  - Hard faceted normals, 7-region UV palette + AO ramp (color-direction.json)
  - Grounded at y = 0 and centered on X/Z
  - <= 650 triangles and <= 81,920 bytes per GLB
  - Animated props use PropWeightSolver + custom bone hierarchy + glTF LINEAR tracks
"""

import math
from pathlib import Path

import numpy as np
from mathutils import Euler, Matrix, Vector

import polykit as pk
from polykit import X, Y, Z, V


# --------------------------------------------------------------------------
# Animation & Build Helpers
# --------------------------------------------------------------------------

def euler_quat(rx=0.0, ry=0.0, rz=0.0):
    """Quaternion [x, y, z, w] for glTF from XYZ radians."""
    q = Euler((rx, ry, rz), 'XYZ').to_quaternion()
    return [float(q.x), float(q.y), float(q.z), float(q.w)]


def ease(t):
    t = max(0.0, min(1.0, float(t)))
    return t * t * (3.0 - 2.0 * t)


def pingpong(u):
    return 1.0 - abs(2.0 * u - 1.0)


def lerp(a, b, t):
    return a + (b - a) * t


def sample_prop_clip(contract, name, duration, hz, tracks_fn):
    """Sample a procedural clip {'name', 'times', 'tracks'} onto a prop contract.

    `tracks_fn(u, t)` returns `{joint_name: {'rot': (rx, ry, rz), 'pos': (dx, dy, dz), 'scale': (sx, sy, sz)}}`.
    `pos` is an offset added to each joint's rest local translation so glTF overrides stay anchored.
    """
    steps = max(2, int(round(duration * hz)))
    times = np.linspace(0.0, float(duration), steps + 1, dtype=np.float32)
    joints = contract['joints']
    parents = contract['parents']
    world_pos = {k: np.array(v, dtype=np.float64) for k, v in contract['worldPositions'].items()}
    rest_rel = {}
    for j in joints:
        p = parents[j]
        rest_rel[j] = world_pos[j] if p is None else (world_pos[j] - world_pos[p])

    raw_tracks = {}
    for t in times:
        u = float(t / duration) if duration > 0 else 0.0
        pose = tracks_fn(u, float(t))
        for joint, channels in pose.items():
            jt = raw_tracks.setdefault(joint, {})
            if 'rot' in channels:
                q = euler_quat(*channels['rot'])
                lst = jt.setdefault('rotation', [])
                if lst:
                    prev = lst[-1]
                    if prev[0] * q[0] + prev[1] * q[1] + prev[2] * q[2] + prev[3] * q[3] < 0.0:
                        q = [-q[0], -q[1], -q[2], -q[3]]
                lst.append(q)
            if 'pos' in channels:
                dx, dy, dz = channels['pos']
                pvec = rest_rel[joint] + np.array([dx, dy, dz], dtype=np.float64)
                jt.setdefault('translation', []).append([float(pvec[0]), float(pvec[1]), float(pvec[2])])
            if 'scale' in channels:
                sx, sy, sz = channels['scale']
                jt.setdefault('scale', []).append([float(sx), float(sy), float(sz)])
    return {'name': name, 'times': times, 'tracks': raw_tracks}


def make_contract(joints, parents, world_positions):
    return {
        'joints': list(joints),
        'parents': dict(parents),
        'worldPositions': {k: [float(v[0]), float(v[1]), float(v[2])] for k, v in world_positions.items()},
    }


def spike(part, base, tip, radius, region, *, n=4, flat=1.0, up=Z, cap=False, **options):
    base, tip = Vector(base), Vector(tip)
    axis = (tip - base).normalized()
    hint = Vector(up)
    if axis.cross(hint.normalized()).length < 0.25:
        hint = X if abs(axis.x) < 0.8 else Y
    right, upward, _ = pk.frame_from(axis, hint)
    return part.loft([pk.ring(base, right, upward, radius, radius * flat, n)], region, tip_end=tip, cap_start=cap, **options)


def build_static_prop(pack, world_dir, builder, label):
    part = pk.Part(builder.__name__)
    builder(part)
    mesh = part.to_mesh()
    low, high = mesh.positions.min(axis=0), mesh.positions.max(axis=0)
    mesh.positions -= np.array([(low[0] + high[0]) / 2.0, low[1], (low[2] + high[2]) / 2.0])
    rel = f'props/{mesh.name}.glb'
    size = pk.write_prop_glb(world_dir / rel, mesh, pack)
    return pk.prop_entry(mesh, pack, label, rel, size)


def build_animated_prop(pack, world_dir, builder, clips_builder, label):
    part = pk.Part(builder.__name__)
    contract = builder(part)
    solver = pk.PropWeightSolver(contract['joints'], default_bone=contract['joints'][0])
    mesh = part.to_mesh(solver=solver)
    low, high = mesh.positions.min(axis=0), mesh.positions.max(axis=0)
    shift = np.array([-(low[0] + high[0]) / 2.0, -low[1], -(low[2] + high[2]) / 2.0], dtype=np.float64)
    mesh.positions += shift
    for j in contract['joints']:
        wp = contract['worldPositions'][j]
        contract['worldPositions'][j] = [float(wp[0] + shift[0]), float(wp[1] + shift[1]), float(wp[2] + shift[2])]
    clips = clips_builder(contract)
    rel = f'props/{mesh.name}.glb'
    size = pk.write_prop_glb(world_dir / rel, mesh, pack, contract=contract, animations=clips)
    return pk.prop_entry(mesh, pack, label, rel, size, clips=[c['name'] for c in clips])


# ==========================================================================
# MEDIEVAL PROPS (8 static + 5 animated)
# ==========================================================================

def prop_stone_floor_tile(part):
    # 2.0 x 2.0m modular dungeon floor slab with staggered beveled flagstones & moss accent.
    part.box(V(0, 0.045, 0), (2.00, 0.090, 2.00), 'secondary', ao=-0.22)
    stones = [
        (-0.50, -0.50, 0.92, 0.92, 0.02),
        (0.50, -0.62, 0.92, 0.68, 0.04),
        (0.50, 0.36, 0.92, 1.18, -0.02),
        (-0.50, 0.48, 0.92, 0.96, 0.05),
    ]
    for x, z, w, d, ao in stones:
        part.plate(V(x, 0.090, z), Y, Z, w, d, 0.032, 'skin', shrink=0.92, corner=0.04, ao=ao)
    part.box(V(-0.74, 0.115, 0.72), (0.16, 0.04, 0.16), 'hair', taper=0.7, ao=0.06)
    part.box(V(0.70, 0.115, -0.76), (0.14, 0.036, 0.14), 'hair', taper=0.7, ao=0.04)


def prop_dungeon_wall(part):
    # 2.0m wide x 2.2m tall modular dungeon stone wall with plinth, timber beam, and battlements.
    part.box(V(0, 0.16, 0), (2.00, 0.32, 0.44), 'skin', bevel=0.02, ao=-0.10)
    part.box(V(0, 1.06, 0), (1.96, 1.48, 0.34), 'skin', ao=-0.02)
    # Recessed ashlar blocks on front & back
    for side in (-1, 1):
        for bx, by, bw, bh in ((-0.48, 0.68, 0.80, 0.34), (0.48, 0.68, 0.80, 0.34),
                               (0.0, 1.16, 0.88, 0.34), (-0.64, 1.56, 0.56, 0.30), (0.64, 1.56, 0.56, 0.30)):
            part.plate(V(bx, by, side * 0.17), Z * side, Y, bw, bh, 0.024, 'skin', shrink=0.88, ao=0.05)
    # Timber tie beam & iron bolts
    part.box(V(0, 1.82, 0), (2.02, 0.14, 0.40), 'primary', bevel=0.015, ao=-0.04)
    for x in (-0.72, 0.0, 0.72):
        part.box(V(x, 1.82, 0), (0.07, 0.16, 0.43), 'metal', ao=0.04)
    # Two merlons on top
    for x in (-0.52, 0.52):
        part.box(V(x, 2.05, 0), (0.64, 0.32, 0.38), 'skin', bevel=0.02, taper=0.92, ao=0.06)


def prop_dungeon_pillar(part):
    part.box(V(0, 0.14, 0), (0.62, 0.28, 0.62), 'skin', bevel=0.03, corner=0.06, ao=-0.08)
    part.lathe([(0.25, 0.28), (0.21, 0.38), (0.20, 1.92), (0.26, 2.04)], 8, 'skin',
               band_regions=['skin', 'skin', 'skin'], band_ao=[-0.04, 0.0, 0.04])
    part.box(V(0, 2.16, 0), (0.66, 0.24, 0.66), 'skin', bevel=0.03, corner=0.06, ao=0.06)
    # Iron collar & wall torch bracket ring
    part.lathe([(0.225, 1.32), (0.235, 1.38), (0.225, 1.44)], 8, 'metal', band_ao=[0.04, 0.08])
    part.box(V(0, 1.38, 0.25), (0.06, 0.08, 0.14), 'metal')
    part.box(V(0, 1.46, 0.30), (0.07, 0.14, 0.07), 'accent', taper=0.7, ao=0.18)


def prop_wooden_bridge(part):
    # 2.2m span x 1.3m wide arched wooden plank bridge
    xs = [-1.04, -0.68, -0.34, 0.0, 0.34, 0.68, 1.04]
    ys = [0.04, 0.16, 0.25, 0.28, 0.25, 0.16, 0.04]
    # Curved side stringer beams anchored on ground at x=+/-1.08
    for sz in (-0.58, 0.58):
        rings = [pk.rect_ring(V(x, y + 0.03, sz), Z, Y, 0.045, 0.055) for x, y in zip(xs, ys)]
        part.loft(rings, 'secondary', cap_start=True, cap_end=True, ao=-0.08)
    # Deck planks across the span (7 separate planks for clear chiseled gaps)
    for x, y in zip(xs, ys):
        tilt = -math.atan2(0.28 - y, max(0.2, abs(x))) * (1 if x >= 0 else -1) * 0.45
        with part.placed(Matrix.Translation(V(x, y + 0.09, 0)) @ Matrix.Rotation(tilt, 4, 'Z')):
            part.box(V(0, 0, 0), (0.27, 0.055, 1.24), 'primary', bevel=0.008, ao=0.03)
    # Four corner posts + handrail beams
    for sx in (-0.72, 0.72):
        py = 0.16
        for sz in (-0.58, 0.58):
            part.box(V(sx, py + 0.42, sz), (0.09, 0.84, 0.09), 'secondary', bevel=0.01, taper=0.88)
            part.box(V(sx, py + 0.86, sz), (0.11, 0.08, 0.11), 'metal', taper=0.8)
    for sz in (-0.58, 0.58):
        part.box(V(0, 0.86, sz), (1.58, 0.065, 0.075), 'primary', bevel=0.008, ao=0.04)


def prop_anvil_forge(part):
    # Oak stump + steel horned anvil + stone forge hearth with glowing embers
    part.lathe([(0.23, 0.0), (0.21, 0.44)], 8, 'primary', center=(-0.28, 0, 0.05), cap_start=True, cap_end=True, ao=-0.06)
    with part.placed(Matrix.Translation(V(-0.28, 0.44, 0.05))):
        part.box(V(0, 0.05, 0), (0.34, 0.10, 0.22), 'metal', bevel=0.012, ao=-0.04)
        part.box(V(0, 0.16, 0), (0.18, 0.14, 0.14), 'metal', taper=0.82)
        part.box(V(0.02, 0.27, 0), (0.40, 0.09, 0.18), 'metal', bevel=0.01)
        spike(part, V(0.22, 0.27, 0), V(0.42, 0.30, 0), 0.048, 'metal', n=4, up=Y, ao=0.06)
    # Hearth forge on right
    with part.placed(Matrix.Translation(V(0.32, 0, -0.06))):
        part.box(V(0, 0.32, 0), (0.56, 0.64, 0.52), 'skin', bevel=0.025, ao=-0.06)
        part.box(V(0, 0.67, 0), (0.62, 0.08, 0.58), 'secondary', bevel=0.012)
        part.plate(V(0, 0.71, 0), Y, Z, 0.40, 0.36, 0.05, 'accent', shrink=0.75, ao=0.20)
        part.box(V(0, 0.86, -0.18), (0.30, 0.36, 0.20), 'skin', taper=0.80, ao=-0.04)


def prop_tavern_table(part):
    # 1.50m x 0.86m x 0.78m oak banquet table with mugs and trencher
    for sx in (-0.54, 0.54):
        part.box(V(sx, 0.05, 0), (0.10, 0.10, 0.76), 'secondary', bevel=0.012, taper=0.9)
        part.box(V(sx, 0.38, 0), (0.09, 0.62, 0.10), 'secondary', bevel=0.01)
        part.box(V(sx, 0.66, 0), (0.09, 0.08, 0.72), 'secondary', bevel=0.01)
    part.box(V(0, 0.24, 0), (1.10, 0.08, 0.08), 'secondary', bevel=0.008)
    for z in (-0.28, 0.0, 0.28):
        part.box(V(0, 0.74, z), (1.52, 0.065, 0.26), 'primary', bevel=0.01, ao=0.03)
    # Metal tankards & platter
    for tx, tz in ((-0.36, 0.14), (0.34, -0.10)):
        part.lathe([(0.048, 0.77), (0.044, 0.89)], 6, 'metal', center=(tx, 0, tz), cap_end=True, ao=0.06)
    part.lathe([(0.13, 0.77), (0.16, 0.79)], 8, 'accent', center=(0.04, 0, 0.02), cap_end=True, ao=0.08)


def prop_tree_oak(part):
    # Faceted oak tree: grounded root buttresses, trunk, boughs, 3 foliage crowns
    part.lathe([(0.30, 0.0), (0.17, 0.26), (0.13, 1.08), (0.10, 1.65)], 6, 'primary', cap_start=True,
               band_regions=['secondary', 'primary', 'primary'], band_ao=[-0.10, 0.0, -0.04])
    part.tube([V(0, 1.28, 0), V(-0.46, 1.72, 0.16)], [0.08, 0.045], 5, 'primary', up=Z, cap_end=True)
    part.tube([V(0, 1.42, 0), V(0.44, 1.82, -0.14)], [0.075, 0.045], 5, 'primary', up=Z, cap_end=True)
    # 3 faceted boulder-like canopy clusters
    for cx, cy, cz, rx, ry, rz, ao in (
        (0.0, 2.22, 0.0, 0.76, 0.62, 0.74, 0.06),
        (-0.50, 1.90, 0.20, 0.48, 0.40, 0.48, -0.02),
        (0.48, 1.98, -0.18, 0.46, 0.38, 0.46, 0.02),
    ):
        part.lathe([(rx * 0.48, cy - ry), (rx, cy - ry * 0.22), (rx * 0.92, cy + ry * 0.25), (rx * 0.45, cy + ry * 0.78)],
                   7, 'hair', center=(cx, 0, cz), cap_start=True, tip_end=V(cx, cy + ry, cz), ao=ao)


def prop_boulder_cluster(part):
    # Grounded cluster of 3 faceted angular stone boulders + moss tuft
    specs = [
        (0.0, 0.0, -0.06, 0.56, 0.72, 0.52, 0.0, 0.02),
        (-0.44, 0.0, 0.24, 0.34, 0.44, 0.32, 22.0, -0.04),
        (0.42, 0.0, 0.26, 0.28, 0.34, 0.26, -34.0, -0.06),
    ]
    for x, y, z, rx, h, rz, yaw, ao in specs:
        with part.placed(Matrix.Translation(V(x, y, z)) @ Matrix.Rotation(math.radians(yaw), 4, 'Y')):
            part.lathe([(rx * 0.82, 0.0), (rx, h * 0.42), (rx * 0.68, h * 0.86)], 6, 'skin',
                       scale_z=rz / rx, cap_start=True, tip_end=V(0, h, 0), ao=ao)
    part.plate(V(0.02, 0.58, 0.14), V(0.1, 0.85, 0.45), Y, 0.28, 0.22, 0.05, 'hair', shrink=0.72, ao=0.05)


def prop_treasure_chest(part):
    contract = make_contract(
        ['base', 'lid'],
        {'base': None, 'lid': 'base'},
        {'base': [0, 0, 0], 'lid': [0, 0.34, -0.22]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.box(V(0, 0.17, 0), (0.76, 0.34, 0.44), 'primary', bevel=0.018, ao=-0.04)
        for x in (-0.34, 0.0, 0.34):
            part.box(V(x, 0.175, 0), (0.055, 0.35, 0.46), 'metal', ao=0.04)
        part.box(V(0, 0.26, 0.225), (0.10, 0.11, 0.03), 'metal', ao=0.08)
        # Gold/gem loot pile tucked inside chest so Opening reveals treasure!
        part.box(V(0, 0.33, 0.0), (0.58, 0.06, 0.32), 'secondary', ao=-0.2)
        for gx, gz, s in ((-0.16, 0.04, 0.08), (0.0, -0.02, 0.10), (0.17, 0.05, 0.075)):
            part.lathe([(s, 0.35), (s * 0.6, 0.42)], 5, 'accent', center=(gx, 0, gz), tip_end=V(gx, 0.45, gz), ao=0.22)
    with part.skinned(pk.rigid(lid=1.0)):
        # Barrel-vaulted lid hinged at [0, 0.34, -0.22]
        profile = [
            V(-0.39, 0.34, -0.22),
            V(-0.39, 0.49, -0.16),
            V(-0.39, 0.56, 0.0),
            V(-0.39, 0.49, 0.16),
            V(-0.39, 0.34, 0.22),
        ]
        rings = [
            profile,
            [V(0.39, p.y, p.z) for p in profile],
        ]
        part.loft(rings, 'primary', cap_start=True, cap_end=True, ao=0.04)
        for x in (-0.34, 0.0, 0.34):
            s_ring = [V(x - 0.03, p.y + 0.012, p.z + (0.012 if p.z > 0 else (-0.012 if p.z < 0 else 0))) for p in profile]
            e_ring = [V(x + 0.03, p.y + 0.012, p.z + (0.012 if p.z > 0 else (-0.012 if p.z < 0 else 0))) for p in profile]
            part.loft([s_ring, e_ring], 'metal', cap_start=True, cap_end=True, ao=0.08)
        part.box(V(0, 0.35, 0.235), (0.08, 0.09, 0.03), 'accent', ao=0.14)
    return contract


def _chest_clips(contract):
    return [
        sample_prop_clip(contract, 'Closed', 0.8, 12, lambda u, _t: {
            'lid': {'rot': (0.0, 0.0, 0.0)},
        }),
        sample_prop_clip(contract, 'Opening', 1.1, 20, lambda u, _t: {
            'lid': {'rot': (-1.45 * ease(u), 0.0, 0.0)},
        }),
        sample_prop_clip(contract, 'Open', 1.2, 12, lambda u, _t: {
            'lid': {'rot': (-1.42 + 0.04 * math.sin(u * math.tau), 0.0, 0.0)},
        }),
    ]


def prop_portcullis_gate(part):
    contract = make_contract(
        ['base', 'gate'],
        {'base': None, 'gate': 'base'},
        {'base': [0, 0, 0], 'gate': [0, 0, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        # The deep arch rests on four courses of dressed stone.
        for side in (-1, 1):
            for bottom, top, width, depth, shade in (
                (0, .29, .38, .50, -.08), (.29, .77, .32, .45, .01),
                (.77, 1.28, .34, .46, -.04), (1.28, 1.48, .40, .50, .08),
            ):
                part.box(V(side*.90, (bottom+top)/2, 0), (width, top-bottom, depth),
                         'skin', bevel=.014, ao=shade)

        # The two stone arches leave a slot for the grate.
        for i in range(7):
            left = math.pi*i/7
            right = math.pi*(i+1)/7
            crown = i == 3
            profile = []
            for angle, outer in ((left, False), (left, True), (right, True), (right, False)):
                rx = 1.09 if outer else .73
                ry = (1.22/math.sin(3*math.pi/7) if crown else 1.14) if outer else .62
                profile.append((rx*math.cos(angle), 1.48+ry*math.sin(angle)))
            depth = .25 if crown else .235
            middle = [V(x, y, depth-.025) for x, y in profile]
            center = sum(middle, V(0, 0, 0))/4
            bevel = [center+(v-center)*.93+Z*.025 for v in middle]
            slot = .115
            part.loft([[V(x, y, slot) for x, y in profile], middle, bevel], 'skin',
                      cap_start=True, cap_end=True, ao=.10 if crown else .02-(i%3)*.045)
            part.loft([[V(x, y, z) for x, y in profile] for z in (-depth, -slot)], 'skin',
                      cap_start=True, cap_end=True, ao=.02-(i%3)*.045)

        # Two timber beams guide the sections into the slot.
        for z in (-.155, .155):
            part.box(V(0, 2.47, z), (1.59, .45, .08), 'primary', ao=-.08)

    # Each section slides behind the one below it. Uniform weights keep it rigid.
    for bottom, top, z, travel in (
        (.18, .81, .075, 1.0), (.64, 1.45, 0, 2/3), (1.28, 2.08, -.075, 1/3),
    ):
        with part.skinned(pk.rigid(base=1-travel, gate=travel)):
            for x in (-.54, -.18, .18, .54):
                part.box(V(x, (top+bottom)/2, z), (.095, top-bottom, .058), 'primary',
                         cap_end=False)
                if travel == 1.0:
                    spike(part, V(x, bottom, z), V(x, .02, z), .052, 'metal', n=4, up=Z,
                          flat=.55)
            part.box(V(0, top-.045, z), (1.47, .09, .075), 'metal', ao=.04)
    return contract


def _portcullis_clips(contract):
    lift = 1.80
    return [
        sample_prop_clip(contract, 'Closed', 0.8, 12, lambda u, _t: {
            'gate': {'pos': (0.0, 0.0, 0.0)},
        }),
        sample_prop_clip(contract, 'Raise', 1.4, 20, lambda u, _t: {
            'gate': {'pos': (0.0, lift * ease(u), 0.0)},
        }),
        sample_prop_clip(contract, 'Open', 1.2, 12, lambda u, _t: {
            'gate': {'pos': (0.0, lift, 0.0)},
        }),
    ]


def prop_brazier_fire(part):
    contract = make_contract(
        ['base', 'flame_outer', 'flame_inner'],
        {'base': None, 'flame_outer': 'base', 'flame_inner': 'base'},
        {'base': [0, 0, 0], 'flame_outer': [0, 0.84, 0], 'flame_inner': [0, 0.86, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        for i in range(3):
            ang = math.radians(i * 120.0)
            fx, fz = math.cos(ang) * 0.28, math.sin(ang) * 0.28
            tx, tz = math.cos(ang) * 0.22, math.sin(ang) * 0.22
            part.tube([V(fx, 0.0, fz), V(tx, 0.72, tz)], [0.036, 0.030], 4, 'metal', up=Y, cap_start=True, ao=-0.06)
        part.lathe([(0.16, 0.60), (0.34, 0.74), (0.36, 0.88), (0.28, 0.88), (0.20, 0.78)], 8, 'metal',
                   cap_start=True, band_ao=[-0.08, 0.02, 0.06, -0.15])
        part.lathe([(0.24, 0.80), (0.14, 0.87)], 6, 'secondary', cap_end=True, ao=-0.12)
    with part.skinned(pk.rigid(flame_outer=1.0)):
        part.lathe([(0.17, 0.84), (0.21, 1.00), (0.12, 1.20)], 5, 'accent', cap_start=True,
                   tip_end=V(0.02, 1.44, 0.0), ao=0.18)
    with part.skinned(pk.rigid(flame_inner=1.0)):
        part.lathe([(0.10, 0.86), (0.12, 1.04), (0.06, 1.24)], 4, 'accent', cap_start=True,
                   tip_end=V(-0.02, 1.40, 0.02), ao=0.30)
    return contract


def _brazier_clips(contract):
    def idle_fn(u, _t):
        s1 = 1.0 + 0.16 * math.sin(u * math.tau * 2.0)
        s2 = 1.0 + 0.20 * math.cos(u * math.tau * 3.0)
        return {
            'flame_outer': {'rot': (0.06 * math.sin(u * math.tau), u * math.tau, 0.06 * math.cos(u * math.tau)),
                            'scale': (0.94 + 0.08 * math.sin(u * math.tau * 2.0), s1, 0.94 + 0.08 * math.cos(u * math.tau * 2.0))},
            'flame_inner': {'rot': (0.08 * math.cos(u * math.tau * 2.0), -u * math.tau, 0.08 * math.sin(u * math.tau * 2.0)),
                            'scale': (1.0, s2, 1.0)},
        }
    return [sample_prop_clip(contract, 'Idle', 1.6, 20, idle_fn)]


def prop_floor_spike_trap(part):
    contract = make_contract(
        ['base', 'spikes'],
        {'base': None, 'spikes': 'base'},
        {'base': [0, 0, 0], 'spikes': [0, 0.06, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.box(V(0, 0.05, 0), (1.24, 0.10, 1.24), 'skin', bevel=0.018, ao=-0.06)
        part.box(V(0, 0.085, 0), (1.02, 0.05, 1.02), 'secondary', ao=-0.16)
        for sx in (-0.32, 0.0, 0.32):
            for sz in (-0.32, 0.0, 0.32):
                part.lathe([(0.07, 0.105), (0.055, 0.125)], 6, 'metal', center=(sx, 0, sz), cap_end=True, ao=0.04)
    with part.skinned(pk.rigid(spikes=1.0)):
        # Full 0.42m spikes anchored at y=0.06; scale_y=0.14 retracts flush inside sockets in Armed
        for sx in (-0.32, 0.0, 0.32):
            for sz in (-0.32, 0.0, 0.32):
                part.loft([pk.ring(V(sx, 0.06, sz), X, Z, 0.044, 0.044, 4)], 'metal',
                          tip_end=V(sx, 0.48, sz), cap_start=True, ao=0.08)
    return contract


def _spike_trap_clips(contract):
    def snap_fn(u, _t):
        if u < 0.25:
            sy = lerp(0.14, 1.0, ease(u / 0.25))
        elif u < 0.75:
            sy = 1.0
        else:
            sy = lerp(1.0, 0.14, ease((u - 0.75) / 0.25))
        return {'spikes': {'scale': (1.0, sy, 1.0)}}
    return [
        sample_prop_clip(contract, 'Armed', 0.8, 12, lambda u, _t: {
            'spikes': {'scale': (1.0, 0.14, 1.0)},
        }),
        sample_prop_clip(contract, 'Snap', 1.2, 24, snap_fn),
        sample_prop_clip(contract, 'Reset', 1.0, 16, lambda u, _t: {
            'spikes': {'scale': (1.0, lerp(1.0, 0.14, ease(u)), 1.0)},
        }),
    ]


def prop_target_dummy(part):
    contract = make_contract(
        ['base', 'post'],
        {'base': None, 'post': 'base'},
        {'base': [0, 0, 0], 'post': [0, 0.14, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.box(V(0, 0.05, 0), (0.64, 0.10, 0.14), 'secondary', bevel=0.012)
        part.box(V(0, 0.05, 0), (0.14, 0.10, 0.64), 'secondary', bevel=0.012)
        part.lathe([(0.10, 0.09), (0.08, 0.18)], 6, 'metal', cap_end=True, ao=0.04)
    with part.skinned(pk.rigid(post=1.0)):
        part.tube([V(0, 0.14, 0), V(0, 1.56, 0)], [0.05, 0.042], 6, 'primary', up=Z, cap_end=True)
        part.tube([V(-0.46, 1.32, 0), V(0.46, 1.32, 0)], [0.036, 0.036], 6, 'primary', up=Y, cap_start=True, cap_end=True)
        # Straw sack torso
        part.lathe([(0.14, 0.78), (0.22, 1.04), (0.23, 1.34), (0.13, 1.48)], 8, 'skin',
                   cap_start=True, cap_end=True, band_ao=[-0.06, 0.02, 0.04])
        # Bullseye target disc on front
        part.box(V(0, 1.15, 0.23), (0.30, 0.30, 0.04), 'accent', bevel=0.01, corner=0.05, ao=0.06)
        part.plate(V(0, 1.15, 0.25), Z, Y, 0.12, 0.12, 0.015, 'skin', corner=0.03, ao=0.14)
        # Pot helm head
        part.lathe([(0.12, 1.49), (0.14, 1.72), (0.10, 1.79)], 8, 'metal', cap_start=True, cap_end=True, ao=0.06)
    return contract


def _dummy_clips(contract):
    return [
        sample_prop_clip(contract, 'Idle', 2.0, 16, lambda u, _t: {
            'post': {'rot': (0.04 * math.sin(u * math.tau), 0.0, 0.03 * math.cos(u * math.tau))},
        }),
        sample_prop_clip(contract, 'Hit', 1.1, 24, lambda u, _t: {
            'post': {'rot': (-0.58 * math.exp(-3.4 * u) * math.sin(u * math.pi * 3.0), 0.0, 0.06 * math.sin(u * math.pi * 2.0))},
        }),
    ]


# ==========================================================================
# WW2 PROPS (5 static + 5 animated)
# ==========================================================================

def prop_czech_hedgehog(part):
    # Three interlocking steel I-beam girders meeting at center [0, 0.56, 0] and grounded at y=0
    dirs = [
        V(1.0, 0.92, 0.35).normalized(),
        V(-0.85, 0.92, 0.72).normalized(),
        V(-0.15, 0.92, -1.00).normalized(),
    ]
    center = V(0, 0.56, 0)
    for d in dirs:
        span = 0.56 / d.y
        p0 = center - d * (span - 0.04)
        p1 = center + d * (span - 0.04)
        part.tube([p0, p1], [0.068, 0.068], 4, 'metal', up=Y if abs(d.y) < 0.9 else X,
                  cap_start=True, cap_end=True, ao=0.02)
        # Amber hazard tips on top ends
        part.tube([p1 - d * 0.14, p1 + d * 0.01], [0.072, 0.072], 4, 'accent',
                  up=Y if abs(d.y) < 0.9 else X, cap_end=True, ao=0.10)
    part.box(center, (0.24, 0.22, 0.24), 'secondary', bevel=0.015, ao=-0.08)


def prop_bunker_wall(part):
    # 2.0m wide x 1.65m tall sloped reinforced concrete pillbox wall with firing slit
    part.box(V(0, 0.42, 0), (2.00, 0.84, 0.62), 'skin', bevel=0.025, taper=(0.98, 0.90), ao=-0.06)
    for sx in (-0.64, 0.64):
        part.box(V(sx, 1.04, 0), (0.72, 0.40, 0.54), 'skin', ao=-0.02)
    # Recessed dark firing embrasure slot
    part.box(V(0, 1.04, 0.0), (0.58, 0.36, 0.46), 'eye', ao=-0.35)
    part.box(V(0, 1.42, 0), (2.08, 0.36, 0.68), 'skin', bevel=0.03, taper=(1.0, 0.88), ao=0.04)
    # Sandbag row along the top parapet
    for x in (-0.66, 0.0, 0.66):
        part.box(V(x, 1.65, 0.08), (0.58, 0.16, 0.28), 'secondary', bevel=0.04, corner=0.04, ao=0.02)


def prop_barbed_wire_fence(part):
    # 2.0m wide crossed X-picket wooden posts + 3 barbed wire coils
    for x in (-0.82, 0.0, 0.82):
        part.tube([V(x, 0.0, -0.34), V(x, 0.94, 0.30)], [0.042, 0.036], 5, 'secondary', up=X, cap_start=True, cap_end=True)
        part.tube([V(x, 0.0, 0.34), V(x, 0.94, -0.30)], [0.042, 0.036], 5, 'secondary', up=X, cap_start=True, cap_end=True)
        part.box(V(x, 0.48, 0), (0.10, 0.10, 0.12), 'metal', ao=-0.05)
    # Horizontal wire rails + faceted diamond wire coils along X
    for wy, wz in ((0.32, 0.16), (0.54, 0.0), (0.76, -0.14)):
        part.tube([V(-0.98, wy, wz), V(0.98, wy, wz)], [0.014, 0.014], 4, 'metal', up=Y, cap_start=True, cap_end=True)
        for bx in (-0.66, -0.22, 0.22, 0.66):
            part.box(V(bx, wy, wz), (0.045, 0.08, 0.08), 'accent', ao=0.08)


def prop_watchtower(part):
    # The posts support the roof above a standing guard.
    for sx in (-1, 1):
        for sz in (-1, 1):
            part.tube([V(sx * 0.68, 0.0, sz * 0.68), V(sx * 0.50, 3.57, sz * 0.50)], [0.065, 0.052], 4,
                      'secondary', up=Z, cap_start=True, cap_end=True, ao=-0.06)
    # Cross braces
    for sz in (-0.58, 0.58):
        part.box(V(0, 0.82, sz), (1.18, 0.07, 0.07), 'secondary')
    # Plank deck at y=1.56
    part.box(V(0, 1.56, 0), (1.36, 0.10, 1.36), 'primary', bevel=0.012, ao=0.02)
    # Sandbagged parapet walls around deck
    for sx in (-1, 1):
        part.box(V(sx * 0.60, 2.07, 0), (0.12, 0.94, 1.24), 'primary', bevel=0.01)
    part.box(V(0, 2.07, -.60), (1.24,.94,.12), 'primary', bevel=.01)
    for x in (-.47,.47):
        part.box(V(x,2.07,.60), (.30,.94,.12), 'primary', bevel=.01)
    # Pitched hip roof
    part.box(V(0, 3.61, 0), (1.36, 0.08, 1.36), 'secondary', bevel=0.01)
    part.loft([pk.rect_ring(V(0, 3.65, 0), X, Z, 0.72, 0.72)], 'primary', tip_end=V(0, 4.09, 0), cap_start=True, ao=0.08)
    # The upper rung sits one step below the deck.
    for lx in (-0.20, 0.20):
        part.tube([V(lx, 0.0, 0.82), V(lx, 1.62, 0.62)], [0.028, 0.026], 4, 'secondary', up=X, cap_start=True, cap_end=True)
    for k in range(5):
        t = (.15 + k * .30) / 1.60
        part.box(V(0, t * 1.60, 0.82 - t * 0.20), (0.42, 0.036, 0.036), 'primary')


def prop_trench_duckboard(part):
    # 2.0m x 1.1m wooden trench walkway with mud base
    part.box(V(0, 0.025, 0), (2.00, 0.05, 1.12), 'secondary', ao=-0.20)
    for sz in (-0.36, 0.36):
        part.box(V(0, 0.065, sz), (1.96, 0.05, 0.11), 'secondary', bevel=0.008)
    for k in range(8):
        px = -0.84 + k * 0.24
        part.box(V(px, 0.105, 0), (0.18, 0.036, 1.04), 'primary', bevel=0.006, ao=0.03 * (1 if k % 2 == 0 else -1))


def prop_radar_dish(part):
    contract = make_contract(
        ['base', 'turret', 'dish'],
        {'base': None, 'turret': 'base', 'dish': 'turret'},
        {'base': [0, 0, 0], 'turret': [0, 0.90, 0], 'dish': [0, 1.24, 0.04]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        for i in range(3):
            ang = math.radians(i * 120.0)
            part.tube([V(math.cos(ang) * 0.44, 0.0, math.sin(ang) * 0.44), V(0, 0.78, 0)], [0.042, 0.036], 4,
                      'metal', up=Y, cap_start=True, ao=-0.05)
        part.box(V(0, 0.46, 0), (0.34, 0.30, 0.30), 'primary', bevel=0.018)
        part.lathe([(0.16, 0.74), (0.14, 0.90)], 8, 'metal', cap_start=True, cap_end=True)
    with part.skinned(pk.rigid(turret=1.0)):
        part.box(V(0, 1.04, 0), (0.20, 0.28, 0.22), 'primary', bevel=0.014)
        part.box(V(0, 1.22, -0.04), (0.24, 0.14, 0.16), 'metal', bevel=0.01)
    with part.skinned(pk.rigid(dish=1.0)):
        with part.placed(Matrix.Translation(V(0, 1.26, 0.08)) @ Matrix.Rotation(math.radians(-68), 4, 'X')):
            part.lathe([(0.06, 0.0), (0.28, 0.06), (0.48, 0.20)], 8, 'skin', cap_start=True,
                       two_sided=True, thickness=0.016, inner_region='metal', ao=0.04)
            part.tube([V(0, 0.02, 0), V(0, 0.36, 0)], [0.028, 0.016], 4, 'accent', up=Z, cap_end=True, ao=0.14)
    return contract


def _radar_clips(contract):
    return [
        sample_prop_clip(contract, 'Idle', 2.4, 16, lambda u, _t: {
            'turret': {'rot': (0.0, u * math.tau, 0.0)},
            'dish': {'rot': (0.14 * math.sin(u * math.tau * 2.0), 0.0, 0.0)},
        }),
    ]


def prop_parachute_crate(part):
    contract = make_contract(
        ['base', 'crate', 'lid', 'canopy'],
        {'base': None, 'crate': 'base', 'lid': 'crate', 'canopy': 'crate'},
        {'base': [0, 0, 0], 'crate': [0, 0, 0], 'lid': [0, 0.44, -0.26], 'canopy': [0, 0.48, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.box(V(0, 0.015, 0), (0.72, 0.03, 0.56), 'secondary', bevel=0.008, ao=-0.16)
    with part.skinned(pk.rigid(crate=1.0)):
        part.box(V(0, 0.23, 0), (0.68, 0.42, 0.52), 'primary', bevel=0.018)
        part.plate(V(0, 0.23, 0.26), Z, Y, 0.28, 0.10, 0.01, 'accent', ao=0.12)
    with part.skinned(pk.rigid(lid=1.0)):
        part.box(V(0, 0.47, 0), (0.72, 0.07, 0.56), 'primary', bevel=0.012, ao=0.06)
        part.box(V(0, 0.47, 0.28), (0.12, 0.06, 0.03), 'metal')
    with part.skinned(pk.rigid(canopy=1.0)):
        # Cords + faceted octagonal canvas dome skinned together around lid pivot [0, 0.48, 0]
        for sx in (-0.28, 0.28):
            for sz in (-0.24, 0.24):
                part.tube([V(sx, 0.48, sz), V(sx * 0.72, 1.18, sz * 0.72)], [0.010, 0.010], 4, 'secondary', up=Y)
        part.lathe([(0.66, 1.18), (0.54, 1.48), (0.24, 1.68)], 8, 'skin',
                   tip_end=V(0, 1.74, 0), two_sided=True, thickness=0.014, inner_ao=-0.14,
                   band_regions=['skin', 'accent', 'skin'], ao=0.04)
    return contract


def _parachute_clips(contract):
    return [
        sample_prop_clip(contract, 'Drop', 1.8, 20, lambda u, _t: {
            'crate': {'pos': (0.0, 0.85 * (1.0 - ease(u)), 0.0),
                      'rot': (0.05 * math.sin(u * math.tau * 2.0), 0.0, 0.08 * math.sin(u * math.tau))},
            'canopy': {'scale': (1.0, 1.0, 1.0)},
        }),
        sample_prop_clip(contract, 'Land', 1.2, 20, lambda u, _t: {
            'crate': {'pos': (0.0, 0.0, 0.0)},
            'canopy': {'pos': (0.0, 0.02 * ease(u), 0.0),
                       'scale': (lerp(1.0, 0.44, ease(u)), lerp(1.0, 0.08, ease(u)), lerp(1.0, 0.44, ease(u)))},
        }),
        sample_prop_clip(contract, 'Open', 1.2, 20, lambda u, _t: {
            'lid': {'rot': (-1.45 * ease(u), 0.0, 0.0)},
            'canopy': {'pos': (0.46, -0.44, 0.0), 'scale': (0.38, 0.08, 0.38)},
        }),
    ]


def prop_landmine(part):
    contract = make_contract(
        ['base', 'charge'],
        {'base': None, 'charge': 'base'},
        {'base': [0, 0, 0], 'charge': [0, 0.04, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.lathe([(0.24, 0.0), (0.25, 0.05), (0.20, 0.09)], 8, 'primary', cap_start=True, cap_end=True, ao=-0.06)
    with part.skinned(pk.rigid(charge=1.0)):
        part.lathe([(0.16, 0.03), (0.16, 0.13), (0.11, 0.15)], 8, 'metal', cap_start=True, cap_end=True, ao=0.04)
        for px, pz in ((0.0, 0.06), (-0.05, -0.04), (0.05, -0.04)):
            part.box(V(px, 0.18, pz), (0.028, 0.07, 0.028), 'accent', ao=0.14)
    return contract


def _landmine_clips(contract):
    return [
        sample_prop_clip(contract, 'Idle', 1.2, 12, lambda u, _t: {
            'charge': {'pos': (0.0, 0.015 * math.sin(u * math.tau), 0.0)},
        }),
        sample_prop_clip(contract, 'Pop', 1.0, 24, lambda u, _t: {
            'charge': {'pos': (0.0, 0.78 * pingpong(u), 0.0), 'rot': (0.0, u * math.tau * 2.0, 0.0)},
        }),
    ]


def prop_mg_turret(part):
    contract = make_contract(
        ['base', 'swivel', 'barrel'],
        {'base': None, 'swivel': 'base', 'barrel': 'swivel'},
        {'base': [0, 0, 0], 'swivel': [0, 0.72, 0], 'barrel': [0, 0.80, 0.08]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        # Sandbag semicircle bunker lip + steel tripod legs
        for ang_deg in (-55, -20, 20, 55):
            ang = math.radians(ang_deg)
            with part.placed(Matrix.Translation(V(math.sin(ang) * 0.44, 0.10, math.cos(ang) * 0.44)) @ Matrix.Rotation(ang, 4, 'Y')):
                part.box(V(0, 0, 0), (0.34, 0.20, 0.24), 'skin', bevel=0.04, ao=-0.04)
        for fx, fz in ((-0.34, -0.32), (0.34, -0.32), (0.0, 0.36)):
            part.tube([V(fx, 0.0, fz), V(0, 0.70, 0)], [0.036, 0.030], 4, 'metal', up=Y, cap_start=True)
    with part.skinned(pk.rigid(swivel=1.0)):
        part.box(V(0, 0.80, -0.04), (0.14, 0.14, 0.36), 'primary', bevel=0.012)
        part.box(V(-0.14, 0.78, -0.02), (0.12, 0.16, 0.20), 'accent', bevel=0.01)
        part.box(V(0, 0.82, 0.12), (0.36, 0.26, 0.04), 'metal', bevel=0.008)
    with part.skinned(pk.rigid(barrel=1.0)):
        part.tube([V(0, 0.82, 0.14), V(0, 0.82, 0.76)], [0.032, 0.026], 6, 'metal', up=Y, cap_end=True)
        part.box(V(0, 0.74, -0.26), (0.08, 0.10, 0.14), 'secondary')
    return contract


def _mg_clips(contract):
    return [
        sample_prop_clip(contract, 'Idle', 1.6, 12, lambda u, _t: {
            'swivel': {'rot': (0.0, 0.18 * math.sin(u * math.tau), 0.0)},
        }),
        sample_prop_clip(contract, 'Fire', 0.6, 24, lambda u, _t: {
            'barrel': {'pos': (0.0, 0.0, -0.08 * pingpong((u * 4.0) % 1.0))},
            'swivel': {'rot': (-0.04 * math.sin(u * math.tau * 4.0), 0.06 * math.sin(u * math.tau), 0.0)},
        }),
        sample_prop_clip(contract, 'Sweep', 2.0, 20, lambda u, _t: {
            'swivel': {'rot': (0.0, 0.68 * math.sin(u * math.tau), 0.0)},
        }),
    ]


def prop_barrier_arm(part):
    contract = make_contract(
        ['base', 'arm'],
        {'base': None, 'arm': 'base'},
        {'base': [0, 0, 0], 'arm': [-0.60, 0.84, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.box(V(-0.62, 0.08, 0), (0.50, 0.16, 0.44), 'skin', bevel=0.02, ao=-0.08)
        part.box(V(-0.62, 0.54, 0), (0.28, 0.80, 0.26), 'primary', bevel=0.018)
        part.box(V(-0.62, 0.84, 0), (0.34, 0.22, 0.34), 'metal', bevel=0.014)
        # Rest cradle post on the right end
        part.box(V(0.76, 0.44, 0), (0.14, 0.88, 0.14), 'metal', bevel=0.01)
    with part.skinned(pk.rigid(arm=1.0)):
        # Boom bar + counterweight
        part.box(V(-0.88, 0.86, 0), (0.24, 0.14, 0.14), 'secondary', bevel=0.01)
        for idx, bx in enumerate((-0.34, 0.02, 0.38, 0.74)):
            reg = 'accent' if idx % 2 == 0 else 'skin'
            part.box(V(bx, 0.88, 0), (0.34, 0.09, 0.06), reg, bevel=0.008, ao=0.06)
    return contract


def _barrier_clips(contract):
    return [
        sample_prop_clip(contract, 'Down', 0.8, 12, lambda u, _t: {
            'arm': {'rot': (0.0, 0.0, 0.0)},
        }),
        sample_prop_clip(contract, 'Raise', 1.2, 20, lambda u, _t: {
            'arm': {'rot': (0.0, 0.0, 1.32 * ease(u))},
        }),
    ]


# ==========================================================================
# SIM PROPS (9 static + 5 animated)
# ==========================================================================

def prop_sidewalk_tile(part):
    # 2.0 x 2.0m concrete sidewalk tile with curb edge along +Z
    part.box(V(0, 0.055, 0), (2.00, 0.11, 2.00), 'secondary', ao=-0.16)
    for sx in (-0.50, 0.50):
        for sz in (-0.50, 0.44):
            part.plate(V(sx, 0.11, sz), Y, Z, 0.94, 0.86, 0.018, 'skin', shrink=0.96, ao=0.03)
    part.box(V(0, 0.075, 0.92), (2.00, 0.15, 0.16), 'skin', bevel=0.015, ao=0.04)
    part.plate(V(0, 0.152, 0.92), Y, Z, 1.92, 0.10, 0.006, 'accent', ao=0.10)


def prop_road_crosswalk(part):
    # 2.0 x 2.0m asphalt crosswalk tile with raised crisp white zebra stripes
    part.box(V(0, 0.035, 0), (2.00, 0.07, 2.00), 'secondary', ao=-0.12)
    for x in (-0.66, -0.22, 0.22, 0.66):
        part.plate(V(x, 0.070, 0.0), Y, Z, 0.28, 1.48, 0.010, 'skin', shrink=0.96, ao=0.12)
    for sz in (-0.94, 0.94):
        part.box(V(0, 0.045, sz), (2.00, 0.09, 0.12), 'metal', ao=-0.04)


def prop_streetlamp(part):
    part.lathe([(0.20, 0.0), (0.18, 0.18), (0.11, 0.36), (0.07, 0.46), (0.05, 2.68)], 8, 'secondary',
               cap_start=True, band_ao=[-0.06, 0.0, -0.02, 0.02])
    part.tube([V(0, 2.66, 0), V(0, 2.89, 0.16), V(0, 2.90, 0.41),
               V(0, 2.81, 0.46)], [0.044, 0.038, 0.033, 0.030], 6, 'secondary', up=X)
    # A shallow metal shade covers the glass diffuser.
    part.lathe([(0.090, 2.54), (0.155, 2.59), (0.174, 2.66),
                (0.20, 2.67), (0.13, 2.78), (0.047, 2.83)], 8, 'metal',
               center=(0, 0, 0.46), cap_start=True, cap_end=True,
               band_regions=['skin', 'skin', 'secondary', 'secondary', 'metal'])


def prop_bus_stop(part):
    part.box(V(0, 0.03, 0), (2.04, 0.06, 0.92), 'skin', bevel=0.01, ao=-0.06)
    for sx in (-0.90, 0.90):
        part.box(V(sx, 1.12, -0.34), (0.09, 2.12, 0.09), 'metal', bevel=0.01)
    part.box(V(0, 1.08, -0.36), (1.76, 1.66, 0.05), 'eye', ao=0.04)
    part.box(V(0, 2.22, 0.02), (2.14, 0.10, 1.04), 'accent', bevel=0.018, ao=0.06)
    # Interior bench + transit sign
    part.box(V(0, 0.46, -0.08), (1.36, 0.06, 0.36), 'primary', bevel=0.01)
    for sx in (-0.54, 0.54):
        part.box(V(sx, 0.24, -0.08), (0.08, 0.42, 0.30), 'metal')
    part.box(V(0.68, 1.32, -0.32), (0.34, 0.48, 0.04), 'skin', ao=0.10)


def prop_trash_bin(part):
    part.lathe([(0.24, 0.0), (0.25, 0.08), (0.22, 0.68)], 8, 'metal', cap_start=True, cap_end=True, ao=-0.04)
    for i in range(6):
        ang = math.radians(i * 60.0)
        with part.placed(Matrix.Translation(V(math.cos(ang) * 0.23, 0.38, math.sin(ang) * 0.23)) @ Matrix.Rotation(-ang, 4, 'Y')):
            part.box(V(0, 0, 0), (0.035, 0.52, 0.14), 'primary', bevel=0.006)
    part.lathe([(0.24, 0.68), (0.25, 0.78), (0.16, 0.94)], 8, 'accent', cap_start=True, tip_end=V(0, 0.98, 0), ao=0.08)


def prop_picket_fence(part):
    # 2.0m wide white picket fence
    for sx in (-0.94, 0.94):
        part.box(V(sx, 0.48, 0), (0.11, 0.96, 0.11), 'skin', bevel=0.01)
        part.box(V(sx, 1.00, 0), (0.13, 0.08, 0.13), 'accent', taper=0.75)
    for ry in (0.26, 0.72):
        part.box(V(0, ry, -0.02), (1.88, 0.07, 0.05), 'skin')
    for k in range(7):
        px = -0.72 + k * 0.24
        part.box(V(px, 0.45, 0.02), (0.11, 0.78, 0.035), 'skin', ao=0.04)
        spike(part, V(px, 0.84, 0.02), V(px, 0.94, 0.02), 0.055, 'skin', n=4, up=Z, ao=0.08)


def prop_hedge_row(part):
    # 2.0m wide manicured boxwood hedge in a stone curb
    part.box(V(0, 0.10, 0), (2.00, 0.20, 0.64), 'skin', bevel=0.02, ao=-0.06)
    part.box(V(0, 0.56, 0), (1.92, 0.74, 0.54), 'hair', bevel=0.06, taper=0.92, ao=0.04)
    for px in (-0.64, 0.0, 0.64):
        part.box(V(px, 0.94, 0), (0.50, 0.16, 0.42), 'hair', bevel=0.04, ao=0.10)


def prop_park_tree(part):
    part.lathe([(0.20, 0.0), (0.12, 0.30), (0.10, 1.24)], 6, 'secondary', cap_start=True, ao=-0.04)
    part.tube([V(0, 1.04, 0), V(-0.34, 1.50, 0.12)], [0.06, 0.04], 5, 'secondary', up=Z, cap_end=True)
    part.tube([V(0, 1.12, 0), V(0.32, 1.54, -0.10)], [0.06, 0.04], 5, 'secondary', up=Z, cap_end=True)
    for cx, cy, cz, rx, ry, ao in ((0, 2.06, 0, 0.66, 0.64, 0.06), (-0.38, 1.74, 0.14, 0.42, 0.40, 0.0), (0.36, 1.78, -0.12, 0.40, 0.38, 0.02)):
        part.lathe([(rx * 0.55, cy - ry * 0.8), (rx, cy - ry * 0.15), (rx * 0.82, cy + ry * 0.45)], 7, 'hair',
                   center=(cx, 0, cz), cap_start=True, tip_end=V(cx, cy + ry * 0.95, cz), ao=ao)


def prop_fountain_basin(part):
    part.lathe([(0.78, 0.0), (0.80, 0.36), (0.70, 0.36), (0.68, 0.22)], 8, 'skin',
               cap_start=True, band_ao=[-0.06, 0.06, -0.10])
    part.lathe([(0.69, 0.28)], 8, 'eye', cap_end=True, ao=0.12)
    part.lathe([(0.22, 0.26), (0.14, 0.44), (0.12, 0.92), (0.34, 1.00), (0.34, 1.08)], 8, 'skin',
               band_ao=[-0.04, 0.02, 0.06, 0.08])
    part.lathe([(0.10, 1.08), (0.06, 1.30)], 6, 'eye', tip_end=V(0, 1.44, 0), ao=0.18)


def prop_vending_machine(part):
    contract = make_contract(
        ['base', 'machine', 'can'],
        {'base': None, 'machine': 'base', 'can': 'machine'},
        {'base': [0, 0, 0], 'machine': [0, 0, 0], 'can': [0.0, 0.26, 0.32]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        for sx in (-0.34, 0.34):
            for sz in (-0.24, 0.24):
                part.box(V(sx, 0.03, sz), (0.10, 0.06, 0.10), 'metal')
    with part.skinned(pk.rigid(machine=1.0)):
        part.box(V(0, 0.94, 0), (0.88, 1.76, 0.62), 'accent', bevel=0.02)
        part.plate(V(-0.08, 1.12, 0.31), Z, Y, 0.48, 0.88, 0.02, 'skin', ao=0.14)
        part.plate(V(0.28, 1.06, 0.31), Z, Y, 0.14, 0.44, 0.02, 'metal', ao=0.04)
        part.box(V(0, 0.28, 0.30), (0.54, 0.22, 0.08), 'secondary', ao=-0.20)
    with part.skinned(pk.rigid(can=1.0)):
        part.lathe([(0.055, 0.20), (0.055, 0.35)], 6, 'primary', center=(0.0, 0, 0.34), cap_start=True, cap_end=True, ao=0.18)
    return contract


def _vending_clips(contract):
    return [
        sample_prop_clip(contract, 'Idle', 1.4, 12, lambda u, _t: {
            'machine': {'rot': (0.0, 0.0, 0.012 * math.sin(u * math.tau * 2.0))},
            'can': {'scale': (0.05, 0.05, 0.05)},
        }),
        sample_prop_clip(contract, 'Dispense', 1.2, 24, lambda u, _t: {
            'machine': {'pos': (0.0, 0.035 * math.sin(u * math.pi * 4.0) * (1.0 - u), 0.0),
                        'rot': (0.0, 0.0, 0.04 * math.sin(u * math.pi * 5.0) * (1.0 - u))},
            'can': {'pos': (0.0, -0.05 * ease(u), 0.20 * ease(u)),
                    'rot': (u * math.pi * 2.0, 0.0, 0.0),
                    'scale': (1.0, 1.0, 1.0) if u > 0.25 else (0.1, 0.1, 0.1)},
        }),
    ]


def prop_traffic_light(part):
    contract = make_contract(
        ['base', 'light_red', 'light_amber', 'light_green'],
        {'base': None, 'light_red': 'base', 'light_amber': 'base', 'light_green': 'base'},
        {'base': [0, 0, 0], 'light_red': [0, 2.38, 0.14], 'light_amber': [0, 2.16, 0.14], 'light_green': [0, 1.94, 0.14]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.lathe([(0.18, 0.0), (0.16, 0.12), (0.08, 0.24), (0.06, 1.82)], 8, 'metal', cap_start=True)
        part.box(V(0, 2.16, 0.02), (0.30, 0.78, 0.26), 'secondary', bevel=0.018)
        for ly in (2.38, 2.16, 1.94):
            part.box(V(0, ly + 0.08, 0.19), (0.18, 0.04, 0.12), 'secondary', ao=-0.06)
    with part.skinned(pk.rigid(light_red=1.0)):
        part.plate(V(0, 2.38, 0.15), Z, Y, 0.14, 0.14, 0.022, 'accent', corner=0.03, ao=0.20)
    with part.skinned(pk.rigid(light_amber=1.0)):
        part.plate(V(0, 2.16, 0.15), Z, Y, 0.14, 0.14, 0.022, 'primary', corner=0.03, ao=0.22)
    with part.skinned(pk.rigid(light_green=1.0)):
        part.plate(V(0, 1.94, 0.15), Z, Y, 0.14, 0.14, 0.022, 'hair', corner=0.03, ao=0.24)
    return contract


def _traffic_light_clips(contract):
    def loop_fn(u, _t):
        r_on = 1.35 if u < 0.35 else 0.75
        g_on = 1.35 if 0.35 <= u < 0.78 else 0.75
        a_on = 1.35 if u >= 0.78 else 0.75
        return {
            'light_red': {'scale': (r_on, r_on, r_on)},
            'light_green': {'scale': (g_on, g_on, g_on)},
            'light_amber': {'scale': (a_on, a_on, a_on)},
        }
    return [sample_prop_clip(contract, 'Loop', 3.0, 12, loop_fn)]


def prop_mailbox(part):
    contract = make_contract(
        ['base', 'door', 'flag'],
        {'base': None, 'door': 'base', 'flag': 'base'},
        {'base': [0, 0, 0], 'door': [0, 0.88, 0.18], 'flag': [0.15, 0.98, 0.04]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.box(V(0, 0.44, 0), (0.12, 0.88, 0.12), 'primary', bevel=0.01)
        part.box(V(0, 0.88, 0), (0.28, 0.05, 0.44), 'primary', bevel=0.008)
        part.box(V(0, 1.00, -0.02), (0.24, 0.22, 0.38), 'accent', bevel=0.04, ao=0.04)
    with part.skinned(pk.rigid(door=1.0)):
        part.box(V(0, 0.99, 0.185), (0.22, 0.20, 0.03), 'metal', bevel=0.006, ao=0.08)
    with part.skinned(pk.rigid(flag=1.0)):
        part.box(V(0.145, 1.06, 0.04), (0.02, 0.18, 0.03), 'skin', ao=0.10)
        part.box(V(0.145, 1.13, 0.08), (0.02, 0.07, 0.08), 'accent', ao=0.16)
    return contract


def _mailbox_clips(contract):
    return [
        sample_prop_clip(contract, 'Closed', 0.8, 12, lambda u, _t: {
            'door': {'rot': (0.0, 0.0, 0.0)},
            'flag': {'rot': (-1.45, 0.0, 0.0)},
        }),
        sample_prop_clip(contract, 'Open', 1.2, 20, lambda u, _t: {
            'door': {'rot': (1.45 * ease(u), 0.0, 0.0)},
            'flag': {'rot': (-1.45 * (1.0 - ease(u)), 0.0, 0.0)},
        }),
    ]


def prop_shop_awning(part):
    contract = make_contract(
        ['base', 'canopy', 'sign'],
        {'base': None, 'canopy': 'base', 'sign': 'base'},
        {'base': [0, 0, 0], 'canopy': [0, 2.02, -0.22], 'sign': [0, 1.56, 0.28]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        for sx in (-0.84, 0.84):
            part.box(V(sx, 1.04, -0.22), (0.09, 2.08, 0.09), 'secondary', bevel=0.01)
            part.box(V(sx, 0.04, -0.22), (0.16, 0.08, 0.16), 'metal')
        part.box(V(0, 2.04, -0.22), (1.84, 0.09, 0.12), 'metal')
        part.box(V(0, 1.66, 0.04), (0.06, 0.05, 0.56), 'metal')
    with part.skinned(pk.rigid(canopy=1.0)):
        # Sloped bistro awning with alternating blue/white scallops
        for k in range(5):
            cx = -0.68 + k * 0.34
            reg = 'accent' if k % 2 == 0 else 'skin'
            with part.placed(Matrix.Translation(V(cx, 1.92, 0.14)) @ Matrix.Rotation(math.radians(24), 4, 'X')):
                part.box(V(0, 0, 0), (0.33, 0.045, 0.80), reg, ao=0.06)
            part.box(V(cx, 1.72, 0.50), (0.33, 0.14, 0.04), reg, ao=0.04)
    with part.skinned(pk.rigid(sign=1.0)):
        part.box(V(0, 1.50, 0.28), (0.48, 0.28, 0.04), 'primary', bevel=0.008)
        part.plate(V(0, 1.50, 0.302), Z, Y, 0.38, 0.18, 0.01, 'skin', ao=0.14)
    return contract


def _awning_clips(contract):
    return [
        sample_prop_clip(contract, 'Idle', 2.4, 16, lambda u, _t: {
            'canopy': {'rot': (0.03 * math.sin(u * math.tau), 0.0, 0.0)},
            'sign': {'rot': (0.0, 0.0, 0.12 * math.sin(u * math.tau))},
        }),
    ]


def prop_park_swing(part):
    contract = make_contract(
        ['base', 'swing'],
        {'base': None, 'swing': 'base'},
        {'base': [0, 0, 0], 'swing': [0, 1.96, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        for sx in (-0.72, 0.72):
            for sz in (-0.54, 0.54):
                part.tube([V(sx, 0.0, sz), V(sx * 0.88, 1.98, 0.0)], [0.042, 0.036], 6, 'accent', up=Z, cap_start=True)
        part.tube([V(-0.76, 1.96, 0), V(0.76, 1.96, 0)], [0.046, 0.046], 6, 'metal', up=Y, cap_start=True, cap_end=True)
    with part.skinned(pk.rigid(swing=1.0)):
        for sx in (-0.28, 0.28):
            part.tube([V(sx, 1.96, 0), V(sx, 0.56, 0)], [0.014, 0.014], 4, 'metal', up=Z)
        part.box(V(0, 0.54, 0), (0.64, 0.055, 0.24), 'primary', bevel=0.01, ao=0.05)
    return contract


def _swing_clips(contract):
    return [
        sample_prop_clip(contract, 'Idle', 2.2, 16, lambda u, _t: {
            'swing': {'rot': (0.10 * math.sin(u * math.tau), 0.0, 0.0)},
        }),
        sample_prop_clip(contract, 'Swing', 1.8, 24, lambda u, _t: {
            'swing': {'rot': (0.58 * math.sin(u * math.tau), 0.0, 0.0)},
        }),
    ]


# ==========================================================================
# CYBERPUNK PROPS (6 static + 5 animated)
# ==========================================================================

def prop_metal_grate_tile(part):
    # 2.0 x 2.0m industrial deck plate with steel catwalk ribs & neon under-conduit
    part.box(V(0, 0.04, 0), (2.00, 0.08, 2.00), 'secondary', ao=-0.16)
    part.box(V(0, 0.06, 0), (1.76, 0.05, 1.76), 'eye', ao=0.10)
    for x in (-0.72, -0.24, 0.24, 0.72):
        part.box(V(x, 0.09, 0), (0.14, 0.03, 1.88), 'metal', ao=0.04)
    for z in (-0.72, 0.0, 0.72):
        part.box(V(0, 0.095, z), (1.88, 0.028, 0.14), 'primary', ao=0.02)
    for sx in (-0.88, 0.88):
        for sz in (-0.88, 0.88):
            part.box(V(sx, 0.098, sz), (0.20, 0.03, 0.20), 'accent', ao=0.08)


def prop_concrete_barrier(part):
    # 2.0m wide sloped cyber jersey barrier with neon chevrons
    part.box(V(0, 0.14, 0), (2.00, 0.28, 0.62), 'skin', bevel=0.02, ao=-0.06)
    part.box(V(0, 0.56, 0), (1.96, 0.56, 0.42), 'skin', bevel=0.02, taper=(0.98, 0.62), ao=0.02)
    for x in (-0.64, 0.0, 0.64):
        part.plate(V(x, 0.52, 0.18), Z, Y, 0.26, 0.10, 0.012, 'eye', ao=0.24)
        part.box(V(x, 0.14, 0), (0.14, 0.29, 0.64), 'metal', ao=0.04)


def prop_vent_duct(part):
    part.box(V(0, 0.38, 0), (1.16, 0.76, 0.82), 'primary', bevel=0.025)
    part.box(V(0, 0.05, 0), (1.24, 0.10, 0.90), 'secondary', bevel=0.01)
    for y in (0.28, 0.42, 0.56):
        part.box(V(-0.18, y, 0.415), (0.52, 0.06, 0.03), 'metal', ao=-0.06)
    part.lathe([(0.16, 0.76), (0.16, 0.96), (0.22, 0.96)], 6, 'metal', center=(0.24, 0, 0.0), cap_end=True)
    part.plate(V(0.32, 0.46, 0.415), Z, Y, 0.16, 0.34, 0.012, 'eye', ao=0.22)


def prop_neon_archway(part):
    # 2.4m wide x 2.6m tall steel cyber street archway with neon tubes & sign blade
    for sx in (-1.04, 1.04):
        part.box(V(sx, 0.14, 0), (0.34, 0.28, 0.44), 'secondary', bevel=0.02)
        part.box(V(sx, 1.32, 0), (0.24, 2.12, 0.32), 'primary', bevel=0.015)
        part.plate(V(sx - sx * 0.12, 1.30, 0), X * (-sx), Y, 0.08, 1.68, 0.016, 'eye', ao=0.24)
    part.box(V(0, 2.48, 0), (2.48, 0.30, 0.40), 'secondary', bevel=0.02)
    part.plate(V(0, 2.48, 0.205), Z, Y, 1.84, 0.12, 0.014, 'eye', ao=0.26)
    part.box(V(0.62, 2.80, 0.08), (0.94, 0.34, 0.08), 'accent', bevel=0.01, ao=0.14)


def prop_ramen_stand(part):
    # Compact cyberpunk street ramen stall (1.6m wide)
    part.box(V(0, 0.44, 0), (1.56, 0.88, 0.78), 'secondary', bevel=0.02, ao=-0.06)
    part.box(V(0, 0.92, 0.08), (1.64, 0.08, 0.88), 'primary', bevel=0.012)
    for sx in (-0.70, 0.70):
        part.box(V(sx, 1.48, -0.30), (0.10, 1.12, 0.10), 'metal')
    # Slanted awning roof + glowing neon sign + two lanterns
    with part.placed(Matrix.Translation(V(0, 2.02, 0.02)) @ Matrix.Rotation(math.radians(14), 4, 'X')):
        part.box(V(0, 0, 0), (1.76, 0.12, 1.02), 'accent', bevel=0.015, ao=0.06)
    part.box(V(0, 2.26, 0.32), (1.16, 0.26, 0.06), 'eye', ao=0.24)
    for lx in (-0.56, 0.56):
        part.lathe([(0.06, 1.66), (0.10, 1.76), (0.06, 1.86)], 6, 'eye', center=(lx, 0, 0.42), cap_start=True, cap_end=True, ao=0.22)
    part.lathe([(0.14, 0.96), (0.16, 1.16)], 6, 'metal', center=(-0.28, 0, 0.04), cap_end=True, ao=0.06)


def prop_alley_dumpster(part):
    part.box(V(0, 0.05, 0), (1.28, 0.10, 0.76), 'metal')
    part.box(V(0, 0.50, 0), (1.36, 0.82, 0.84), 'primary', bevel=0.02, taper=1.08)
    for sx in (-0.34, 0.34):
        part.box(V(sx, 0.94, 0), (0.62, 0.08, 0.86), 'secondary', bevel=0.012, ao=0.04)
    part.plate(V(0, 0.56, 0.44), Z, Y, 0.52, 0.10, 0.012, 'eye', ao=0.20)


def prop_blast_door(part):
    contract = make_contract(
        ['base', 'door_l', 'door_r', 'lock_bar'],
        {'base': None, 'door_l': 'base', 'door_r': 'base', 'lock_bar': 'base'},
        {'base': [0, 0, 0], 'door_l': [-0.40, 1.10, 0], 'door_r': [0.40, 1.10, 0], 'lock_bar': [0, 1.10, 0.14]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        for sx in (-0.98, 0.98):
            part.box(V(sx, 1.22, 0), (0.36, 2.44, 0.44), 'secondary', bevel=0.02)
        part.box(V(0, 2.34, 0), (2.32, 0.32, 0.46), 'secondary', bevel=0.02)
        part.box(V(0, 0.04, 0), (2.26, 0.08, 0.42), 'metal')
    with part.skinned(pk.rigid(door_l=1.0)):
        part.box(V(-0.40, 1.13, 0), (0.78, 2.10, 0.16), 'primary', bevel=0.015)
        part.plate(V(-0.36, 1.18, 0.085), Z, Y, 0.32, 1.40, 0.016, 'metal', ao=0.04)
    with part.skinned(pk.rigid(door_r=1.0)):
        part.box(V(0.40, 1.13, 0), (0.78, 2.10, 0.16), 'primary', bevel=0.015)
        part.plate(V(0.36, 1.18, 0.085), Z, Y, 0.32, 1.40, 0.016, 'metal', ao=0.04)
    with part.skinned(pk.rigid(lock_bar=1.0)):
        part.box(V(0, 1.10, 0.12), (0.28, 0.24, 0.06), 'eye', bevel=0.008, ao=0.25)
    return contract


def _blast_door_clips(contract):
    return [
        sample_prop_clip(contract, 'Closed', 0.8, 12, lambda u, _t: {
            'door_l': {'pos': (0.0, 0.0, 0.0)},
            'door_r': {'pos': (0.0, 0.0, 0.0)},
            'lock_bar': {'scale': (1.0, 1.0, 1.0)},
        }),
        sample_prop_clip(contract, 'SlideOpen', 1.3, 20, lambda u, _t: {
            'door_l': {'pos': (-0.64 * ease(u), 0.0, 0.0)},
            'door_r': {'pos': (0.64 * ease(u), 0.0, 0.0)},
            'lock_bar': {'scale': (max(0.08, 1.0 - ease(u) * 0.92), 1.0, 1.0)},
        }),
        sample_prop_clip(contract, 'Locked', 1.0, 12, lambda u, _t: {
            'lock_bar': {'scale': (1.0 + 0.15 * math.sin(u * math.tau * 2.0), 1.0 + 0.15 * math.sin(u * math.tau * 2.0), 1.0)},
        }),
    ]


def prop_security_camera(part):
    contract = make_contract(
        ['base', 'turret', 'head'],
        {'base': None, 'turret': 'base', 'head': 'turret'},
        {'base': [0, 0, 0], 'turret': [0, 1.94, 0], 'head': [0, 2.02, 0.08]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.box(V(0, 0.08, 0), (0.40, 0.16, 0.40), 'secondary', bevel=0.015)
        part.box(V(0, 1.02, 0), (0.14, 1.82, 0.14), 'metal', taper=0.82)
    with part.skinned(pk.rigid(turret=1.0)):
        part.box(V(0, 1.96, 0), (0.18, 0.12, 0.18), 'secondary', bevel=0.01)
    with part.skinned(pk.rigid(head=1.0)):
        part.box(V(0, 2.04, 0.12), (0.20, 0.16, 0.36), 'primary', bevel=0.015)
        part.box(V(0, 2.04, 0.31), (0.12, 0.10, 0.04), 'eye', ao=0.25)
    return contract


def _camera_clips(contract):
    return [
        sample_prop_clip(contract, 'Sweep', 2.6, 20, lambda u, _t: {
            'turret': {'rot': (0.0, 0.92 * math.sin(u * math.tau), 0.0)},
            'head': {'rot': (0.22 + 0.08 * math.sin(u * math.tau * 2.0), 0.0, 0.0)},
        }),
        sample_prop_clip(contract, 'Alert', 1.2, 20, lambda u, _t: {
            'turret': {'rot': (0.0, 0.22 * math.sin(u * math.tau * 3.0), 0.0)},
            'head': {'rot': (0.34, 0.0, 0.0)},
        }),
    ]


def prop_laser_gate(part):
    contract = make_contract(
        ['base', 'beams'],
        {'base': None, 'beams': 'base'},
        {'base': [0, 0, 0], 'beams': [0, 1.0, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.box(V(0, 0.04, 0), (1.92, 0.08, 0.26), 'primary', bevel=0.01)
        for sx in (-0.86, 0.86):
            part.box(V(sx, 0.98, 0), (0.24, 1.88, 0.28), 'secondary', bevel=0.018, taper=0.90)
            for ly in (0.48, 0.88, 1.28, 1.68):
                part.box(V(sx - sx * 0.13, ly, 0), (0.04, 0.08, 0.10), 'metal')
    with part.skinned(pk.rigid(beams=1.0)):
        for ly in (0.48, 0.88, 1.28, 1.68):
            part.tube([V(-0.74, ly, 0), V(0.74, ly, 0)], [0.022, 0.022], 4, 'eye', up=Y, ao=0.25)
    return contract


def _laser_clips(contract):
    return [
        sample_prop_clip(contract, 'Active', 1.2, 16, lambda u, _t: {
            'beams': {'scale': (1.0, 0.85 + 0.35 * math.sin(u * math.tau * 3.0), 0.85 + 0.35 * math.sin(u * math.tau * 3.0))},
        }),
        sample_prop_clip(contract, 'Disable', 1.0, 20, lambda u, _t: {
            'beams': {'scale': (max(0.02, 1.0 - ease(u) * 0.98), max(0.05, 1.0 - ease(u) * 0.95), max(0.05, 1.0 - ease(u) * 0.95))},
        }),
    ]


def prop_hover_drone(part):
    contract = make_contract(
        ['base', 'drone', 'rotor_l', 'rotor_r'],
        {'base': None, 'drone': 'base', 'rotor_l': 'drone', 'rotor_r': 'drone'},
        {'base': [0, 0, 0], 'drone': [0, 1.18, 0], 'rotor_l': [-0.36, 1.24, 0], 'rotor_r': [0.36, 1.24, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        # Grounded charging dock pad at y=0
        part.lathe([(0.44, 0.0), (0.40, 0.06), (0.30, 0.08)], 8, 'secondary', cap_start=True, cap_end=True, ao=-0.06)
        part.lathe([(0.24, 0.082), (0.14, 0.09)], 8, 'eye', cap_end=True, ao=0.20)
    with part.skinned(pk.rigid(drone=1.0)):
        part.box(V(0, 1.18, 0), (0.42, 0.22, 0.44), 'primary', bevel=0.03, corner=0.04)
        part.box(V(0, 1.18, 0.22), (0.24, 0.10, 0.06), 'eye', ao=0.25)
        part.box(V(0, 1.22, 0), (0.76, 0.06, 0.10), 'metal')
    with part.skinned(pk.rigid(rotor_l=1.0)):
        part.lathe([(0.16, 1.22), (0.16, 1.28)], 6, 'secondary', center=(-0.36, 0, 0), cap_start=True, cap_end=True)
        part.box(V(-0.36, 1.29, 0), (0.28, 0.018, 0.045), 'accent', ao=0.14)
    with part.skinned(pk.rigid(rotor_r=1.0)):
        part.lathe([(0.16, 1.22), (0.16, 1.28)], 6, 'secondary', center=(0.36, 0, 0), cap_start=True, cap_end=True)
        part.box(V(0.36, 1.29, 0), (0.28, 0.018, 0.045), 'accent', ao=0.14)
    return contract


def _drone_clips(contract):
    return [
        sample_prop_clip(contract, 'Hover', 1.6, 20, lambda u, _t: {
            'drone': {'pos': (0.0, 0.14 * math.sin(u * math.tau), 0.0),
                      'rot': (0.05 * math.sin(u * math.tau), 0.08 * math.cos(u * math.tau), 0.0)},
            'rotor_l': {'rot': (0.0, u * math.tau * 3.0, 0.0)},
            'rotor_r': {'rot': (0.0, -u * math.tau * 3.0, 0.0)},
        }),
        sample_prop_clip(contract, 'Alert', 1.2, 20, lambda u, _t: {
            'drone': {'pos': (0.0, 0.08 * math.sin(u * math.tau * 2.0), 0.08),
                      'rot': (0.28, 0.18 * math.sin(u * math.tau), 0.0)},
            'rotor_l': {'rot': (0.0, u * math.tau * 4.0, 0.0)},
            'rotor_r': {'rot': (0.0, -u * math.tau * 4.0, 0.0)},
        }),
        sample_prop_clip(contract, 'Stun', 1.2, 20, lambda u, _t: {
            'drone': {'pos': (0.0, -0.58 * ease(pingpong(u)), 0.0),
                      'rot': (0.32 * math.sin(u * math.tau * 2.0), 0.0, 0.36 * math.cos(u * math.tau * 2.0))},
            'rotor_l': {'rot': (0.0, u * math.tau, 0.0)},
            'rotor_r': {'rot': (0.0, -u * math.tau, 0.0)},
        }),
    ]


def prop_data_core(part):
    contract = make_contract(
        ['base', 'ring_outer', 'ring_inner', 'crystal'],
        {'base': None, 'ring_outer': 'base', 'ring_inner': 'base', 'crystal': 'base'},
        {'base': [0, 0, 0], 'ring_outer': [0, 1.24, 0], 'ring_inner': [0, 1.24, 0], 'crystal': [0, 1.24, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.box(V(0, 0.16, 0), (0.76, 0.32, 0.76), 'secondary', bevel=0.03, corner=0.08, ao=-0.06)
        part.box(V(0, 0.38, 0), (0.56, 0.14, 0.56), 'metal', bevel=0.02, corner=0.06)
        part.plate(V(0, 0.455, 0), Y, Z, 0.36, 0.36, 0.012, 'eye', corner=0.06, ao=0.22)
    with part.skinned(pk.rigid(ring_outer=1.0)):
        for ang_deg in (0, 90, 180, 270):
            ang = math.radians(ang_deg)
            with part.placed(Matrix.Translation(V(0, 1.24, 0)) @ Matrix.Rotation(ang, 4, 'Z')):
                part.box(V(0.46, 0.0, 0), (0.07, 0.32, 0.08), 'accent', ao=0.10)
    with part.skinned(pk.rigid(ring_inner=1.0)):
        for ang_deg in (45, 135, 225, 315):
            ang = math.radians(ang_deg)
            with part.placed(Matrix.Translation(V(0, 1.24, 0)) @ Matrix.Rotation(ang, 4, 'Y')):
                part.box(V(0.32, 0.0, 0), (0.05, 0.18, 0.06), 'metal', ao=0.12)
    with part.skinned(pk.rigid(crystal=1.0)):
        part.loft([pk.ring(V(0, 1.24, 0), X, Z, 0.16, 0.16, 4)], 'eye',
                  tip_start=V(0, 0.96, 0), tip_end=V(0, 1.54, 0), ao=0.26)
    return contract


def _data_core_clips(contract):
    return [
        sample_prop_clip(contract, 'Spin', 2.4, 20, lambda u, _t: {
            'ring_outer': {'rot': (0.35 * math.sin(u * math.tau), u * math.tau, 0.0)},
            'ring_inner': {'rot': (u * math.tau, -u * math.tau, 0.0)},
            'crystal': {'pos': (0.0, 0.08 * math.sin(u * math.tau * 2.0), 0.0), 'rot': (0.0, u * math.tau, 0.0)},
        }),
        sample_prop_clip(contract, 'Hack', 1.2, 24, lambda u, _t: {
            'ring_outer': {'rot': (u * math.tau, u * math.tau * 2.0, 0.0), 'scale': (1.16, 1.16, 1.16)},
            'ring_inner': {'rot': (-u * math.tau * 2.0, u * math.tau, 0.0), 'scale': (1.20, 1.20, 1.20)},
            'crystal': {'pos': (0.0, 0.18 * math.sin(u * math.tau * 3.0), 0.0), 'rot': (0.0, -u * math.tau * 2.0, 0.0)},
        }),
    ]


# ==========================================================================
# MONSTERS PROPS (6 static + 5 animated)
# ==========================================================================

def prop_obsidian_pillar(part):
    part.lathe([(0.44, 0.0), (0.38, 0.24), (0.30, 0.34)], 6, 'skin', cap_start=True, ao=-0.06)
    part.lathe([(0.26, 0.34), (0.24, 1.88), (0.14, 2.38)], 6, 'secondary', tip_end=V(0, 2.52, 0), ao=0.02)
    # Iron chain collars + bone rune plaques
    for y in (0.76, 1.48):
        part.lathe([(0.27, y), (0.28, y + 0.07), (0.27, y + 0.14)], 6, 'metal', band_ao=[0.04, 0.08])
    part.plate(V(0, 1.14, 0.22), Z, Y, 0.14, 0.42, 0.016, 'accent', ao=0.16)


def prop_broken_arch(part):
    # 2.2m wide x 2.35m tall jagged ruined monster stone arch
    part.box(V(-0.84, 0.92, 0), (0.44, 1.84, 0.46), 'skin', bevel=0.02, taper=0.92, ao=-0.04)
    part.box(V(0.84, 0.72, 0), (0.44, 1.44, 0.46), 'skin', bevel=0.02, taper=0.90, ao=-0.06)
    # Asymmetric intact left arch span + broken jagged stone teeth on right
    part.box(V(-0.36, 2.02, 0), (1.42, 0.38, 0.42), 'skin', bevel=0.02, ao=0.04)
    spike(part, V(0.32, 2.02, 0), V(0.58, 1.94, 0), 0.14, 'skin', n=4, up=Y)
    spike(part, V(0.84, 1.42, 0), V(0.86, 1.72, 0), 0.16, 'skin', n=4, up=Z)
    part.box(V(-0.62, 2.24, 0.04), (0.32, 0.10, 0.34), 'hair', ao=0.04)
    part.tube([V(-0.22, 1.84, 0), V(-0.22, 1.54, 0)], [0.024, 0.020], 4, 'metal', up=Z, cap_end=True)


def prop_crag_boulder(part):
    for cx, cz, rx, h, lean in ((0.0, -0.05, 0.46, 1.24, 8.0), (-0.42, 0.18, 0.30, 0.82, -16.0), (0.40, 0.20, 0.28, 0.72, 18.0)):
        with part.placed(Matrix.Translation(V(cx, 0.0, cz)) @ Matrix.Rotation(math.radians(lean), 4, 'Z')):
            part.lathe([(rx, 0.0), (rx * 0.72, h * 0.65)], 5, 'secondary', cap_start=True, tip_end=V(0, h, 0), ao=-0.02)
    part.box(V(-0.24, 0.24, 0.34), (0.18, 0.14, 0.16), 'eye', bevel=0.02, ao=0.14)


def prop_dead_tree(part):
    part.lathe([(0.28, 0.0), (0.15, 0.32), (0.11, 1.24), (0.07, 1.84)], 6, 'primary', cap_start=True,
               tip_end=V(-0.08, 2.48, 0.04), ao=-0.04)
    part.tube([V(0, 1.22, 0), V(-0.48, 1.74, 0.22), V(-0.68, 2.18, 0.16)], [0.07, 0.042, 0.016], 5, 'secondary', up=Z, cap_end=True)
    part.tube([V(0, 1.48, 0), V(0.50, 1.94, -0.18), V(0.72, 2.34, -0.08)], [0.065, 0.036, 0.014], 5, 'secondary', up=Z, cap_end=True)
    part.box(V(-0.44, 1.66, 0.20), (0.16, 0.10, 0.12), 'hair', ao=0.04)


def prop_cage_cart(part):
    # Grounded 4-wheel timber cage cart
    for sx in (-0.48, 0.48):
        for sz in (-0.48, 0.48):
            with part.placed(Matrix.Translation(V(sx, 0.24, sz)) @ Matrix.Rotation(math.radians(90), 4, 'Z')):
                part.lathe([(0.24, -0.04), (0.24, 0.04)], 8, 'secondary', cap_start=True, cap_end=True, ao=-0.06)
                part.lathe([(0.12, -0.05), (0.12, 0.05)], 6, 'metal', cap_start=True, cap_end=True)
    part.box(V(0, 0.32, 0), (0.94, 0.10, 1.28), 'primary', bevel=0.012)
    # Iron cage bars + top roof frame
    for cx in (-0.38, -0.13, 0.13, 0.38):
        for cz in (-0.52, 0.52):
            part.box(V(cx, 1.30, cz), (0.04, 1.86, 0.04), 'metal')
    for cx in (-.38,.38):
        for cz in (-.18,.18):
            part.box(V(cx,1.30,cz), (.04,1.86,.04), 'metal')
    part.box(V(0, 2.27, 0), (0.88, 0.08, 1.14), 'secondary', bevel=0.01)
    part.box(V(0, .86, .52), (.76,.06,.04), 'metal')
    part.box(V(0, 0.86, 0.54), (0.16, 0.16, 0.08), 'accent', bevel=0.02, ao=0.10)


def prop_skull_brazier(part):
    part.lathe([(0.34, 0.0), (0.24, 0.16), (0.14, 0.72), (0.30, 0.84)], 6, 'skin', cap_start=True, ao=-0.04)
    part.box(V(0, 0.98, 0), (0.36, 0.30, 0.36), 'accent', bevel=0.03, taper=0.86, ao=0.06)
    for side in (-1, 1):
        part.plate(V(side * 0.08, 0.98, 0.18), Z, Y, 0.08, 0.06, 0.01, 'eye', ao=0.18)
        spike(part, V(side * 0.16, 1.06, 0), V(side * 0.36, 1.32, 0.06), 0.045, 'accent', n=4, up=Z, ao=0.10)
    part.lathe([(0.18, 1.12), (0.12, 1.24)], 5, 'eye', tip_end=V(0, 1.38, 0), ao=0.22)


def prop_egg_hatch(part):
    contract = make_contract(
        ['base', 'shell_top', 'claws'],
        {'base': None, 'shell_top': 'base', 'claws': 'base'},
        {'base': [0, 0, 0], 'shell_top': [0, 0.44, -0.18], 'claws': [0, 0.36, 0.06]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.lathe([(0.44, 0.0), (0.38, 0.12), (0.26, 0.18)], 8, 'skin', cap_start=True, cap_end=True, ao=-0.06)
        part.lathe([(0.20, 0.12), (0.32, 0.32), (0.26, 0.48)], 8, 'accent', cap_start=True, cap_end=True, ao=0.04)
    with part.skinned(pk.rigid(shell_top=1.0)):
        part.lathe([(0.26, 0.46), (0.22, 0.64), (0.12, 0.76)], 8, 'accent', cap_start=True, tip_end=V(0, 0.84, 0), ao=0.10)
    with part.skinned(pk.rigid(claws=1.0)):
        for cx in (-0.08, 0.0, 0.08):
            spike(part, V(cx, 0.32, 0.04), V(cx * 1.3, 0.56, 0.18), 0.026, 'secondary', n=4, up=Z, ao=0.06)
    return contract


def _egg_clips(contract):
    return [
        sample_prop_clip(contract, 'Pulse', 1.4, 20, lambda u, _t: {
            'shell_top': {'pos': (0.0, 0.03 * math.sin(u * math.tau * 2.0), 0.0),
                          'rot': (0.05 * math.sin(u * math.tau), 0.0, 0.06 * math.cos(u * math.tau))},
            'claws': {'scale': (0.05, 0.05, 0.05)},
        }),
        sample_prop_clip(contract, 'Hatch', 1.4, 24, lambda u, _t: {
            'shell_top': {'rot': (-1.18 * ease(u), 0.0, 0.25 * ease(u))},
            'claws': {'pos': (0.0, 0.16 * ease(u), 0.06 * ease(u)),
                      'scale': (1.0, 1.0, 1.0) if u > 0.2 else (0.1, 0.1, 0.1)},
        }),
        sample_prop_clip(contract, 'Broken', 1.2, 12, lambda u, _t: {
            'shell_top': {'rot': (-1.22, 0.0, 0.25)},
            'claws': {'pos': (0.0, 0.14 + 0.03 * math.sin(u * math.tau), 0.06)},
        }),
    ]


def prop_ritual_portal(part):
    contract = make_contract(
        ['base', 'vortex', 'rune_ring'],
        {'base': None, 'vortex': 'base', 'rune_ring': 'base'},
        {'base': [0, 0, 0], 'vortex': [0, 1.25, 0], 'rune_ring': [0, 1.25, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.box(V(0, 0.08, 0), (2.14, 0.16, 0.66), 'skin', bevel=0.025, ao=-0.08)
        for sx in (-0.82, 0.82):
            part.box(V(sx, 1.18, 0), (0.34, 2.04, 0.40), 'skin', bevel=0.02, taper=0.90)
        part.box(V(0, 2.28, 0), (2.10, 0.36, 0.46), 'skin', bevel=0.03, ao=0.04)
        for sx in (-0.64, 0.64):
            part.box(V(sx, 2.52, 0), (0.20, 0.22, 0.22), 'accent', taper=0.80, ao=0.10)
    with part.skinned(pk.rigid(vortex=1.0)):
        with part.placed(Matrix.Translation(V(0, 1.25, 0)) @ Matrix.Rotation(math.radians(90), 4, 'X')):
            part.lathe([(0.48, -0.02), (0.48, 0.02)], 8, 'eye', cap_start=True, cap_end=True, ao=0.22)
            part.lathe([(0.24, -0.03), (0.24, 0.03)], 6, 'secondary', cap_start=True, cap_end=True, ao=-0.20)
    with part.skinned(pk.rigid(rune_ring=1.0)):
        for ang_deg in (0, 60, 120, 180, 240, 300):
            ang = math.radians(ang_deg)
            with part.placed(Matrix.Translation(V(0, 1.25, 0)) @ Matrix.Rotation(ang, 4, 'Z')):
                part.box(V(0.58, 0, 0.04), (0.09, 0.14, 0.06), 'accent', ao=0.12)
    return contract


def _portal_clips(contract):
    return [
        sample_prop_clip(contract, 'Idle', 2.4, 20, lambda u, _t: {
            'vortex': {'rot': (0.0, 0.0, u * math.tau)},
            'rune_ring': {'rot': (0.0, 0.0, -u * math.tau)},
        }),
        sample_prop_clip(contract, 'Activate', 1.4, 24, lambda u, _t: {
            'vortex': {'rot': (0.0, 0.0, u * math.tau * 2.0), 'scale': (1.0 + 0.18 * math.sin(u * math.tau), 1.0 + 0.18 * math.sin(u * math.tau), 1.0)},
            'rune_ring': {'rot': (0.0, 0.0, -u * math.tau * 2.0), 'scale': (1.14, 1.14, 1.14)},
        }),
    ]


def prop_lava_vent(part):
    contract = make_contract(
        ['base', 'plume'],
        {'base': None, 'plume': 'base'},
        {'base': [0, 0, 0], 'plume': [0, 0.24, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.lathe([(0.64, 0.0), (0.50, 0.24), (0.34, 0.36), (0.24, 0.26)], 8, 'secondary',
                   cap_start=True, cap_end=True, band_ao=[-0.08, 0.02, -0.14])
        part.lathe([(0.24, 0.26)], 6, 'eye', cap_end=True, ao=0.22)
    with part.skinned(pk.rigid(plume=1.0)):
        part.lathe([(0.16, 0.26), (0.22, 0.56), (0.14, 0.92)], 6, 'eye', cap_start=True, tip_end=V(0, 1.18, 0), ao=0.24)
    return contract


def _lava_clips(contract):
    return [
        sample_prop_clip(contract, 'Idle', 1.6, 16, lambda u, _t: {
            'plume': {'scale': (0.85, 0.38 + 0.18 * math.sin(u * math.tau), 0.85),
                      'rot': (0.0, u * math.tau, 0.0)},
        }),
        sample_prop_clip(contract, 'Erupt', 1.2, 24, lambda u, _t: {
            'plume': {'scale': (1.0 + 0.35 * pingpong(u), 0.40 + 1.25 * pingpong(u), 1.0 + 0.35 * pingpong(u)),
                      'rot': (0.0, u * math.tau * 2.0, 0.0)},
        }),
    ]


def prop_bear_trap(part):
    contract = make_contract(
        ['base', 'jaw_l', 'jaw_r', 'plate'],
        {'base': None, 'jaw_l': 'base', 'jaw_r': 'base', 'plate': 'base'},
        {'base': [0, 0, 0], 'jaw_l': [-0.10, 0.06, 0], 'jaw_r': [0.10, 0.06, 0], 'plate': [0, 0.08, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.box(V(0, 0.03, 0), (0.82, 0.06, 0.20), 'metal', bevel=0.01, ao=-0.06)
        part.box(V(0, 0.03, 0), (0.22, 0.06, 0.82), 'metal', bevel=0.01, ao=-0.06)
    with part.skinned(pk.rigid(plate=1.0)):
        part.lathe([(0.16, 0.06), (0.14, 0.10)], 6, 'accent', cap_end=True, ao=0.14)
    with part.skinned(pk.rigid(jaw_l=1.0)):
        part.box(V(-0.28, 0.08, 0), (0.34, 0.05, 0.54), 'metal', bevel=0.01)
        for tz in (-0.18, 0.0, 0.18):
            spike(part, V(-0.42, 0.10, tz), V(-0.40, 0.22, tz), 0.028, 'accent', n=4, up=Z, ao=0.14)
    with part.skinned(pk.rigid(jaw_r=1.0)):
        part.box(V(0.28, 0.08, 0), (0.34, 0.05, 0.54), 'metal', bevel=0.01)
        for tz in (-0.18, 0.0, 0.18):
            spike(part, V(0.42, 0.10, tz), V(0.40, 0.22, tz), 0.028, 'accent', n=4, up=Z, ao=0.14)
    return contract


def _bear_trap_clips(contract):
    return [
        sample_prop_clip(contract, 'Armed', 0.8, 12, lambda u, _t: {
            'jaw_l': {'rot': (0.0, 0.0, 0.0)},
            'jaw_r': {'rot': (0.0, 0.0, 0.0)},
            'plate': {'pos': (0.0, 0.0, 0.0)},
        }),
        sample_prop_clip(contract, 'Snap', 1.0, 24, lambda u, _t: {
            'jaw_l': {'rot': (0.0, 0.0, -1.25 * ease(min(1.0, u * 3.0)) if u < 0.75 else -1.25 * (1.0 - ease((u - 0.75) / 0.25)))},
            'jaw_r': {'rot': (0.0, 0.0, 1.25 * ease(min(1.0, u * 3.0)) if u < 0.75 else 1.25 * (1.0 - ease((u - 0.75) / 0.25)))},
            'plate': {'pos': (0.0, -0.025 * ease(min(1.0, u * 3.0)), 0.0)},
        }),
    ]


def prop_boss_altar(part):
    contract = make_contract(
        ['base', 'crystal', 'shard_l', 'shard_r'],
        {'base': None, 'crystal': 'base', 'shard_l': 'base', 'shard_r': 'base'},
        {'base': [0, 0, 0], 'crystal': [0, 1.22, 0], 'shard_l': [-0.46, 1.14, 0], 'shard_r': [0.46, 1.14, 0]},
    )
    with part.skinned(pk.rigid(base=1.0)):
        part.lathe([(0.84, 0.0), (0.80, 0.18), (0.64, 0.22), (0.58, 0.44)], 8, 'skin', cap_start=True, cap_end=True,
                   band_ao=[-0.06, 0.02, -0.04])
        for sx in (-0.54, 0.54):
            for sz in (-0.54, 0.54):
                part.box(V(sx, 0.26, sz), (0.16, 0.52, 0.16), 'metal', taper=0.80)
    with part.skinned(pk.rigid(crystal=1.0)):
        part.loft([pk.ring(V(0, 1.22, 0), X, Z, 0.22, 0.22, 5)], 'eye',
                  tip_start=V(0, 0.80, 0), tip_end=V(0, 1.68, 0), ao=0.22)
    with part.skinned(pk.rigid(shard_l=1.0)):
        part.loft([pk.ring(V(-0.46, 1.14, 0), X, Z, 0.08, 0.08, 4)], 'eye',
                  tip_start=V(-0.46, 0.94, 0), tip_end=V(-0.46, 1.38, 0), ao=0.18)
    with part.skinned(pk.rigid(shard_r=1.0)):
        part.loft([pk.ring(V(0.46, 1.14, 0), X, Z, 0.08, 0.08, 4)], 'eye',
                  tip_start=V(0.46, 0.94, 0), tip_end=V(0.46, 1.38, 0), ao=0.18)
    return contract


def _boss_altar_clips(contract):
    return [
        sample_prop_clip(contract, 'Idle', 2.2, 20, lambda u, _t: {
            'crystal': {'pos': (0.0, 0.12 * math.sin(u * math.tau), 0.0), 'rot': (0.0, u * math.tau, 0.0)},
            'shard_l': {'pos': (0.0, 0.08 * math.cos(u * math.tau), 0.0), 'rot': (0.0, -u * math.tau, 0.0)},
            'shard_r': {'pos': (0.0, -0.08 * math.cos(u * math.tau), 0.0), 'rot': (0.0, -u * math.tau, 0.0)},
        }),
        sample_prop_clip(contract, 'Shatter', 1.4, 24, lambda u, _t: {
            'crystal': {'pos': (0.0, -0.58 * ease(u), 0.0), 'rot': (0.4 * ease(u), u * math.tau, 0.0),
                        'scale': (max(0.15, 1.0 - 0.85 * ease(u)), max(0.15, 1.0 - 0.85 * ease(u)), max(0.15, 1.0 - 0.85 * ease(u)))},
            'shard_l': {'pos': (-0.42 * ease(u), -0.68 * ease(u), 0.18 * ease(u)), 'rot': (0.8 * ease(u), 0.0, 1.1 * ease(u))},
            'shard_r': {'pos': (0.42 * ease(u), -0.68 * ease(u), -0.18 * ease(u)), 'rot': (-0.8 * ease(u), 0.0, -1.1 * ease(u))},
        }),
    ]


# ==========================================================================
# Export Registry per Pack
# ==========================================================================

EXTRA_STATIC_PROPS = {
    'medieval': [
        (prop_stone_floor_tile, 'Stone Floor Tile'),
        (prop_dungeon_wall, 'Dungeon Stone Wall'),
        (prop_dungeon_pillar, 'Dungeon Stone Pillar'),
        (prop_wooden_bridge, 'Wooden Plank Bridge'),
        (prop_anvil_forge, 'Blacksmith Anvil & Forge'),
        (prop_tavern_table, 'Tavern Banquet Table'),
        (prop_tree_oak, 'Faceted Oak Tree'),
        (prop_boulder_cluster, 'Mossy Boulder Cluster'),
    ],
    'ww2': [
        (prop_czech_hedgehog, 'Czech Hedgehog Obstacle'),
        (prop_bunker_wall, 'Concrete Bunker Wall'),
        (prop_barbed_wire_fence, 'Barbed Wire Entanglement'),
        (prop_watchtower, 'Timber Guard Watchtower'),
        (prop_trench_duckboard, 'Trench Duckboard'),
    ],
    'sim': [
        (prop_sidewalk_tile, 'Sidewalk Curb Tile'),
        (prop_road_crosswalk, 'Road Crosswalk Tile'),
        (prop_streetlamp, 'Classic Streetlamp'),
        (prop_bus_stop, 'City Bus Stop Shelter'),
        (prop_trash_bin, 'City Litter Bin'),
        (prop_picket_fence, 'Suburban Picket Fence'),
        (prop_hedge_row, 'Manicured Hedge Row'),
        (prop_park_tree, 'Faceted Park Tree'),
        (prop_fountain_basin, 'Town Plaza Fountain'),
    ],
    'cyberpunk': [
        (prop_metal_grate_tile, 'Industrial Grate Floor Tile'),
        (prop_concrete_barrier, 'Cyber Jersey Barrier'),
        (prop_vent_duct, 'Rooftop AC Vent Unit'),
        (prop_neon_archway, 'Neon Street Archway'),
        (prop_ramen_stand, 'Cyber Noodle Kiosk'),
        (prop_alley_dumpster, 'Cyber Alley Dumpster'),
    ],
    'monsters': [
        (prop_obsidian_pillar, 'Obsidian Rune Pillar'),
        (prop_broken_arch, 'Ruined Monster Arch'),
        (prop_crag_boulder, 'Basalt Crag Formation'),
        (prop_dead_tree, 'Twisted Dead Tree'),
        (prop_cage_cart, 'Iron Prisoner Cage'),
        (prop_skull_brazier, 'Horned Skull Brazier'),
    ],
}

ANIMATED_PROPS = {
    'medieval': [
        (prop_treasure_chest, _chest_clips, 'Treasure Chest'),
        (prop_portcullis_gate, _portcullis_clips, 'Portcullis Gate'),
        (prop_brazier_fire, _brazier_clips, 'Blazing Iron Brazier'),
        (prop_floor_spike_trap, _spike_trap_clips, 'Floor Spike Trap'),
        (prop_target_dummy, _dummy_clips, 'Training Target Dummy'),
    ],
    'ww2': [
        (prop_radar_dish, _radar_clips, 'Rotating Radar Dish'),
        (prop_parachute_crate, _parachute_clips, 'Airborne Supply Crate'),
        (prop_landmine, _landmine_clips, 'Bouncing Betty Landmine'),
        (prop_mg_turret, _mg_clips, 'Sandbagged MG Turret'),
        (prop_barrier_arm, _barrier_clips, 'Checkpoint Barrier Gate'),
    ],
    'sim': [
        (prop_vending_machine, _vending_clips, 'Soda Vending Machine'),
        (prop_traffic_light, _traffic_light_clips, 'Animated Traffic Light'),
        (prop_mailbox, _mailbox_clips, 'Suburban Mailbox'),
        (prop_shop_awning, _awning_clips, 'Bistro Shop Awning'),
        (prop_park_swing, _swing_clips, 'Playground Swing Set'),
    ],
    'cyberpunk': [
        (prop_blast_door, _blast_door_clips, 'Sliding Blast Door'),
        (prop_security_camera, _camera_clips, 'Tracking Security Camera'),
        (prop_laser_gate, _laser_clips, 'Security Laser Barrier'),
        (prop_hover_drone, _drone_clips, 'Patrol Hover Drone'),
        (prop_data_core, _data_core_clips, 'Holo Data Core'),
    ],
    'monsters': [
        (prop_egg_hatch, _egg_clips, 'Hatching Monster Egg'),
        (prop_ritual_portal, _portal_clips, 'Shaman Ritual Portal'),
        (prop_lava_vent, _lava_clips, 'Volcanic Lava Vent'),
        (prop_bear_trap, _bear_trap_clips, 'Giant Iron Bear Trap'),
        (prop_boss_altar, _boss_altar_clips, 'Boss Crystal Altar'),
    ],
}


def build_extra_props_for_pack(pack, world_dir):
    from props_level_cyberpunk import CYBERPUNK_LEVEL_ANIMATED, CYBERPUNK_LEVEL_STATIC
    from props_level_medieval import MEDIEVAL_LEVEL_ANIMATED, MEDIEVAL_LEVEL_STATIC
    from props_level_monsters import MONSTERS_LEVEL_ANIMATED, MONSTERS_LEVEL_STATIC
    from props_level_sim import SIM_LEVEL_ANIMATED, SIM_LEVEL_STATIC
    from props_level_ww2 import WW2_LEVEL_ANIMATED, WW2_LEVEL_STATIC

    level_static = {
        'medieval': MEDIEVAL_LEVEL_STATIC,
        'ww2': WW2_LEVEL_STATIC,
        'sim': SIM_LEVEL_STATIC,
        'cyberpunk': CYBERPUNK_LEVEL_STATIC,
        'monsters': MONSTERS_LEVEL_STATIC,
    }
    level_animated = {
        'medieval': MEDIEVAL_LEVEL_ANIMATED,
        'ww2': WW2_LEVEL_ANIMATED,
        'sim': SIM_LEVEL_ANIMATED,
        'cyberpunk': CYBERPUNK_LEVEL_ANIMATED,
        'monsters': MONSTERS_LEVEL_ANIMATED,
    }

    entries = []
    for builder, label in [*EXTRA_STATIC_PROPS.get(pack, ()), *level_static.get(pack, ())]:
        entries.append(build_static_prop(pack, world_dir, builder, label))
    for builder, clips_builder, label in [*ANIMATED_PROPS.get(pack, ()), *level_animated.get(pack, ())]:
        entries.append(build_animated_prop(pack, world_dir, builder, clips_builder, label))
    return entries
