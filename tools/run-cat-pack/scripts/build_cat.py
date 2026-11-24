"""Build a procedural low-poly cat for one build (body type).

blender -b -t 1 --factory-startup -P scripts/build_cat.py -- <build> <out.glb>

Art direction: concepts/singles/D-sleek-*.png ("sleek cute"). Level back,
straight column legs on small oval paws, a short thick neck under a big round
head (a separate part, build_heads.py), and a thick tail held up in an S.

Like the dog pack, every build has identical topology (fixed ring and side
counts), so breeds share one rig, one UV layout and one set of pattern masks,
and any two builds can be blended vertex for vertex for breeding. Unlike the
dogs, cats have their own skeleton (a five-bone tail) and their own clips
(cat_anims.py).

The file holds:
  body              torso + neck + legs (skinned)
  tail_<type>       one mesh per tail type, skinned to tail.0-4 (show one)
  coat_<type>       coat shells: semilong, long, rex (show one or none)
  socket_head       where the head part attaches (on the head bone)
  rig               the skeleton, with the clips as animations

Faces are tagged in COLOR_0 (catkit.TAG_RGB). UV sets: TEXCOORD_0 is an
even-density unwrap for tiling patterns; TEXCOORD_1 is the side projection for
region patterns, laid out by anatomy rather than projected:
  tail   u 0-0.04, v base (0) to tip (1)
  body   u 0.05 (rump) to 0.70 (top of neck), v = round the body: 1 on the
         spine, 0.5 on the sides, 0 under the belly / down the throat
  legs   hind u 0.70-0.72, front u 0.72-0.75, v paw (0) to top (1)
  head   u 0.76-1 (the head parts' face window)
Coat shells copy the coordinates of the nearest body vertex.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.append(os.path.dirname(__file__))
from catkit import UV_TILE, Builder, even_uvs, export, ring_points  # noqa: E402
import cat_anims  # noqa: E402
import rig  # noqa: E402

# --------------------------------------------------------------------------
# Builds. Metres for a medium cat; the export is normalised to body length 1
# and breeds set their own size. Cute rules for every build: legs stay
# straight and fairly thick, the head is big (head_h), the neck is short.
BASE = dict(
    body_len=0.3,         # rump to front of chest
    leg=0.115,            # ground to underside of the chest (legs about as long as the body is deep)
    chest=(0.066, 0.078), # half-width, half-depth: a deep, full chest
    tuck=0.84,            # waist depth vs chest
    rump=0.96,
    neck_len=0.04, neck_angle=70, neck_r=(0.054, 0.058),   # thick and short: the head sits on the chest
    head_h=0.19,          # head part height (the head part is authored at height 1)
    leg_r=0.022, thigh=0.042, paw=0.025,
    stance=0.85,
    tail_len=0.3, tail_r=0.022,
    ear_scale=1.0,
    box=2.3,              # body cross-section: 2 = round, higher = squarer (the Maine Coon is 3.6)
)
BUILDS = {
    # The everyday cat: Domestic Shorthair, American / European Shorthair, Russian
    # Blue, bobtails, Manx. Most of the variety is in heads, ears, tails and coats.
    'domestic': dict(),
    # Round and low: British Shorthair, Persian, Exotic, Scottish Fold, Chartreux.
    # A barrel body, short thick legs, a big round head.
    'cobby': dict(body_len=0.27, leg=0.09, chest=(0.078, 0.082), tuck=1.0, rump=1.05, neck_r=(0.06, 0.062),
                  head_h=0.21, leg_r=0.027, thigh=0.048, paw=0.03, tail_len=0.24, tail_r=0.028, box=2.1),
    # Big and square: Maine Coon, Norwegian Forest, Siberian, Ragdoll. A long,
    # deep, boxy body with a flat back and straight underline, heavy legs.
    'large': dict(body_len=0.42, leg=0.12, chest=(0.088, 0.1), tuck=1.0, rump=1.04, neck_r=(0.075, 0.078),
                  neck_len=0.035, head_h=0.235, leg_r=0.032, thigh=0.058, paw=0.036, tail_len=0.36, tail_r=0.032,
                  box=3.6, stance=0.95),
    # Long and lean, wild-looking: Abyssinian, Bengal, Savannah, Mau, Siamese,
    # Oriental, Sphynx, Rex. Long legs, tucked waist, a long thin tail.
    'wild': dict(body_len=0.34, leg=0.15, chest=(0.05, 0.064), tuck=0.76, rump=0.92, neck_len=0.065,
                 neck_r=(0.04, 0.045), head_h=0.175, leg_r=0.018, thigh=0.032, paw=0.021, tail_len=0.38,
                 tail_r=0.017, box=2.1),
    # Munchkin, Minskin, Bambino: an everyday cat on very short legs.
    'munchkin': dict(leg=0.055, leg_r=0.022, thigh=0.033, paw=0.025, tail_len=0.27),
    # Kitten: any breed's baby. Big head, short body, short legs and tail.
    'kitten': dict(body_len=0.2, leg=0.078, chest=(0.045, 0.05), tuck=0.95, rump=1.0, neck_len=0.035,
                   neck_r=(0.036, 0.04), head_h=0.189, leg_r=0.018, thigh=0.027, paw=0.022, tail_len=0.17,
                   tail_r=0.018),
}

SIDES = 10        # torso ring sides
LIMB_SIDES = 6    # leg ring sides
TAIL_SIDES = 6
TAIL_BONES = 8    # a long, flexible tail: most of a cat's expression is in it
TAIL_RINGS = 2 * TAIL_BONES + 1   # every tail type has the same ring count

args = sys.argv[sys.argv.index('--') + 1:]
build_name, dst = args[:2]
P = {**BASE, **BUILDS[build_name]}
bpy.ops.wm.read_factory_settings(use_empty=True)
B = Builder()


def catmull(points, samples_per_seg):
    out = []
    pts = [points[0]] + points + [points[-1]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for s in range(samples_per_seg):
            t = s / samples_per_seg
            out.append(tuple(
                0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t ** 3)
                for a, b, c, d in zip(p0, p1, p2, p3)))
    out.append(points[-1])
    return out


# --------------------------------------------------------------------------
# Torso and neck: one tube along a level back, the neck rising steeply into
# the head. Control points: (x, z, half-w, half-h).
half = P['body_len'] / 2
cw, ch = P['chest']
zc = P['leg'] + ch
na = math.radians(P['neck_angle'])
neck_base = Vector((half - 0.01, 0, zc + ch * 0.45))
neck_dir = Vector((math.cos(na), 0, math.sin(na)))
head_back = neck_base + neck_dir * P['neck_len']
r = P['rump']
ctrl = [
    (-half - 0.025, zc + ch * 0.12, cw * r * 0.55, ch * r * 0.55),     # behind the rump
    (-half + 0.02, zc + ch * 0.06, cw * r, ch * r * 0.95),             # rump
    (-half * 0.35, zc + ch * (1 - P['tuck']) * 0.5, cw * 0.9, ch * P['tuck']),   # waist
    (half * 0.3, zc, cw, ch),                                          # ribs
    (half + 0.012, zc + ch * 0.02, cw * 0.98, ch * 0.98),             # full, rounded chest
    (neck_base.x + 0.01, neck_base.z, P['neck_r'][0] * 1.2, P['neck_r'][1] * 1.25),   # base of neck
    (*(neck_base + neck_dir * P['neck_len'] * 0.55).xz, *P['neck_r']),
    (head_back.x, head_back.z, P['neck_r'][0] * 0.9, P['neck_r'][1] * 0.9),           # inside the head
]
samples = catmull(ctrl, 2)
centers = [Vector((s[0], 0, s[1])) for s in samples]
rings = []
for i, s in enumerate(samples):
    a, b = centers[max(i - 1, 0)], centers[min(i + 1, len(centers) - 1)]
    # The neck and the ring inside the head stay round; the body takes the build's squareness.
    rings.append(ring_points(centers[i], b - a, s[2], s[3], SIDES, exp=P['box'] if i <= 9 else 2.3))
torso_vs = B.tube(rings)

# --------------------------------------------------------------------------
# Legs: straight columns ending in small oval paws (the last two rings turn
# forward to make the paw).
leg_vs = []


def leg(points, radii):
    lr_ = []
    for i, (c, (w, d)) in enumerate(zip(points, radii)):
        t = points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]
        if i >= len(points) - 2:
            t = Vector((0.4, 0, -1)) if i == len(points) - 2 else Vector((1, 0, -0.15))
        lr_.append(ring_points(c, t, w, d, LIMB_SIDES, exp=2.0))
    leg_vs.append(B.tube(lr_))
    return points, lr_


L, lr, th, pw = P['leg'], P['leg_r'], P['thigh'], P['paw']
front_legs, rear_legs = [], []
for side in (1, -1):
    y = side * cw * 0.58 * P['stance']
    fx = half - 0.02
    front_legs.append(leg(
        [Vector((fx, y, zc)), Vector((fx - 0.004, y, zc - ch * 0.95)), Vector((fx, y, L * 0.55)),
         Vector((fx + 0.002, y, L * 0.14)), Vector((fx + pw * 0.15, y, pw * 0.55)),
         Vector((fx + pw * 1.15, y, pw * 0.42))],
        [(lr * 1.6, lr * 1.9), (lr * 1.2, lr * 1.3), (lr, lr * 1.05), (lr * 0.9, lr * 0.92),
         (pw, pw * 0.72), (pw * 0.78, pw * 0.48)]))
    y = side * cw * 0.6 * r
    bx = -half + 0.035
    rear_legs.append(leg(
        [Vector((bx, y, zc + ch * 0.1)), Vector((bx + 0.006, y, zc - ch * 0.75)), Vector((bx + 0.01, y, L * 0.6)),
         Vector((bx - 0.004, y, L * 0.16)), Vector((bx + pw * 0.1, y, pw * 0.55)),
         Vector((bx + pw * 1.1, y, pw * 0.42))],
        [(th * 0.95, th * 1.5), (th * 0.75, th * 1.05), (lr * 1.1, lr * 1.2), (lr * 0.9, lr * 0.95),
         (pw, pw * 0.72), (pw * 0.78, pw * 0.48)]))

# --------------------------------------------------------------------------
# Normalise to cat space: nose toward +X, body length 1, feet at 0, centred.
# Measured on the body only, so tails and coats don't change the scale.
lo_x = min(v.co.x for v in B.bm.verts)
hi_x = max(v.co.x for v in B.bm.verts)
real_length = hi_x - lo_x
body_top = max(v.co.z for v in B.bm.verts)


def norm(co):
    return Vector(((co.x - (lo_x + hi_x) / 2) / real_length, co.y / real_length, co.z / real_length))


BODY_U0, BODY_U1 = 0.05, 0.70
LEG_U = {'hind': 0.71, 'front': 0.735}


# --------------------------------------------------------------------------
# Tails: every type is TAIL_RINGS rings along a curve from the top of the
# rump, so all of them skin to the same five tail bones. Angles in degrees per
# segment (180 = straight back, 90 = straight up); the classic pose is an S:
# back and up, straight up, then the tip curling forward.
tail_base = Vector((-half - 0.005, 0, zc + ch * 0.62))
TAILS = {
    'long': dict(length=1.0, r=1.0, angles=[158, 132, 108, 94, 86, 76, 52, 25]),
    'thin': dict(length=1.1, r=0.75, angles=[150, 120, 100, 92, 94, 88, 70, 48]),
    'plume': dict(length=1.0, r=[1.2, 1.7, 2.1, 2.3, 2.3, 2.2, 2.0, 1.7, 1.1], angles=[140, 112, 96, 92, 94, 88, 70, 50],
                  sides=8),
    'thick': dict(length=0.8, r=1.3, angles=[140, 112, 96, 90, 90, 84, 70, 52]),
    'bob': dict(length=0.22, r=[1.3, 1.6, 1.9, 2.0, 2.0, 1.9, 1.7, 1.3, 0.6], angles=[130, 115, 100, 90, 80, 70, 60, 50],
                sides=8),
    # Curled up and over the back (American Bobtail with a long tail, some Siberians).
    'curl': dict(length=0.85, r=1.1, angles=[118, 96, 72, 46, 16, -18, -55, -80]),
    'stub': dict(length=0.08, r=[1.2, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.5, 0.2], angles=[140] * 8),
}


def resample(vals, n):
    """Linear resample of a list to n entries (the specs are written with a few)."""
    if len(vals) == n:
        return list(vals)
    out = []
    for i in range(n):
        f = i * (len(vals) - 1) / (n - 1)
        j = min(int(f), len(vals) - 2)
        out.append(vals[j] + (vals[j + 1] - vals[j]) * (f - j))
    return out


def tail_curve(spec):
    """TAIL_RINGS points: one tucked into the rump, then segments along `angles`."""
    seg = P['tail_len'] * spec['length'] / (TAIL_RINGS - 2)
    pts = [tail_base + Vector((0.012, 0, -0.004)), tail_base.copy()]
    p = tail_base.copy()
    for a in resample(spec['angles'], TAIL_RINGS - 2):
        a = math.radians(a)
        p = p + Vector((math.cos(a), 0, math.sin(a))) * seg
        pts.append(p.copy())
    return pts


def tail_mesh(name, spec):
    pts = tail_curve(spec)
    rr = resample(spec['r'] if isinstance(spec['r'], list) else [spec['r'] * x for x in
                                                                 (1.15, 1.05, 1.0, 1.0, 0.97, 0.94, 0.9, 0.8, 0.55)],
                  TAIL_RINGS)
    sides = spec.get('sides', TAIL_SIDES)
    T = Builder()
    trs = []
    for i, c in enumerate(pts):
        t = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]
        rad = P['tail_r'] * rr[i]
        trs.append(ring_points(c, t, rad, rad, sides, exp=2.0))
    ring_vs = T.tube(trs)
    T.bm.verts.index_update()
    ring_of = {v.index: i for i, ring in enumerate(ring_vs) for v in ring}
    for v in T.bm.verts:
        v.co = norm(v.co)
    T.bm.verts.index_update()
    obj = T.to_object(name)
    even_uvs(obj, UV_TILE)
    # Tail strip of the region masks: u ~0.02, v = how far along the tail.
    m = obj.data
    proj = m.uv_layers.new(name='Projection')
    nring = len(ring_vs) - 1
    for loop in m.loops:
        proj.data[loop.index].uv = (0.02, ring_of.get(loop.vertex_index, nring) / nring)
    m.uv_layers.active = m.uv_layers['UVMap']
    # Weights: ring i (1..TAIL_RINGS-1) sits at chain position
    # (i - 1) / (TAIL_RINGS - 2) * TAIL_BONES, blended between neighbouring bones.
    w = {}
    last = TAIL_BONES - 1
    for vi, i in ring_of.items():
        if i <= 1:
            w[vi] = {'pelvis': 0.5, 'tail.0': 0.5} if i == 0 else {'tail.0': 1.0}
            continue
        f = min((i - 1) / (TAIL_RINGS - 2) * TAIL_BONES - 0.5, last)
        f = max(f, 0.0)
        b0 = min(int(f), last)
        k = f - b0
        ww = {f'tail.{b0}': 1 - k}
        if k > 0 and b0 < last:
            ww[f'tail.{b0 + 1}'] = k
        w[vi] = ww
    return obj, w, [norm(p) for p in pts]


# --------------------------------------------------------------------------
# Coat shells from the body's own rings, as on the dogs: alternating vertices
# pushed out more give faceted fur.
def fluff(ring, center, f, phase, spike=0.09, drop=0.0):
    out = []
    for k, p in enumerate(ring):
        d = p - center
        jag = 1 + spike if (k + phase) % 2 == 0 else 1 - spike * 0.45
        q = center + d * f * jag
        if drop and d.z < 0:
            q.z -= drop * (0.75 if (k + phase) % 2 else 1.0)
        out.append(q)
    return out


def shell(src_rings, src_centers, first, profile, spike=0.09):
    out = []
    for i, f in enumerate(profile):
        f, drop = f if isinstance(f, tuple) else (f, 0.0)
        out.append(fluff(src_rings[first + i], src_centers[first + i], f, i, spike, drop))
    return out


legs_all = front_legs + rear_legs
COATS = {
    # Semi-longhair: neck ruff, britches on the back legs, a soft belly fringe.
    'semilong': [(shell(rings, centers, 9, [1.15, 1.32, 1.42, 1.38, 1.22], 0.12), False)]
                + [(shell(rings, centers, 2, [(1.06, ch * x) for x in (0.12, 0.25, 0.3, 0.3, 0.25, 0.15)], 0.08), False)]
                + [(shell(lr_, pts, 0, [1.35, 1.4, 1.2], 0.12), False) for pts, lr_ in rear_legs],
    # Longhair (Persian): a full coat over body and neck, fluffy legs.
    'long': [(shell(rings, centers, 0, [1.2, 1.35, 1.42, 1.45, 1.45, 1.45, 1.45, 1.45, 1.5, 1.55, 1.55, 1.5, 1.4,
                                        1.3, 1.15], 0.12), True)]
            + [(shell(lr_, pts, 0, [1.3, 1.35, 1.25, 1.15], 0.12), False) for pts, lr_ in legs_all],
    # Ruff: a lion's mane round the neck and chest only (Norwegian, Siberian in winter coat).
    'ruff': [(shell(rings, centers, 8, [1.1, 1.3, 1.5, 1.55, 1.45, 1.25], 0.16), False)],
    # Fluffy: a medium coat all over, softer than longhair (Ragdoll, Birman, British Longhair).
    'fluffy': [(shell(rings, centers, 0, [1.12, 1.2, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 1.3, 1.35, 1.35, 1.3, 1.22,
                                          1.15, 1.08], 0.1), True)]
              + [(shell(lr_, pts, 0, [1.2, 1.22, 1.12], 0.1), False) for pts, lr_ in legs_all],
    # Rex: short, wavy.
    'rex': [(shell(rings, centers, 0, [1.06] * 15, 0.1), True)],
}

# --------------------------------------------------------------------------
# Skeleton. Cat-specific: pelvis / spine / chest, neck, head, a five-bone
# tail, four-bone legs. Local X of every bone points to the cat's right (see
# rig.py), so "pitch" bends the same way on every bone.
waist = Vector((-half * 0.35, 0, zc))
rump_c = Vector((-half + 0.02, 0, zc + ch * 0.06))
ribs = Vector((half * 0.3, 0, zc))
chest_front = Vector((half, 0, zc + ch * 0.05))
TORSO_SEGMENTS = [('pelvis', waist, rump_c), ('spine', waist, ribs), ('chest', ribs, chest_front),
                  ('neck', neck_base, head_back)]
FRONT_RINGS = [{'chest': .45, 'upperarm': .55}, {'upperarm': .6, 'forearm': .4}, {'forearm': 1},
               {'forearm': .4, 'wrist': .6}, {'wrist': .3, 'paw': .7}, {'paw': 1}]
REAR_RINGS = [{'pelvis': .45, 'thigh': .55}, {'thigh': .7, 'shin': .3}, {'shin': 1},
              {'shin': .4, 'hock': .6}, {'hock': .3, 'hind_paw': .7}, {'hind_paw': 1}]
B.bm.verts.index_update()
weights = {}
# The torso rings ride leaf copies of the spine and chest bones (spine_breath,
# chest_breath): scaling those swells the belly and ribs for breathing without
# scaling the neck, head or legs that hang off the real spine and chest.
BREATH = {'spine': 'spine_breath', 'chest': 'chest_breath'}
for ring_v, c in zip(torso_vs, centers):
    w = {BREATH.get(b_, b_): x for b_, x in rig.segment_weights(c, TORSO_SEGMENTS).items()}
    for v in ring_v:
        weights[v.index] = w
for li, vs in enumerate(leg_vs):
    sd = 'L' if li < 2 else 'R'
    table = FRONT_RINGS if li % 2 == 0 else REAR_RINGS
    for ring_v, rw in zip(vs, table):
        w = {(b_ if b_ in ('chest', 'pelvis') else f'{b_}.{sd}'): x for b_, x in rw.items()}
        for v in ring_v:
            weights[v.index] = w

# UV2 by anatomy (see the docstring): torso rings round the body, legs along their length.
uv2 = {}
for i, ring_v in enumerate(torso_vs):
    u = BODY_U0 + (BODY_U1 - BODY_U0) * i / (len(torso_vs) - 1)
    for k, v in enumerate(ring_v):
        uv2[v.index] = (u, (1 + math.cos(2 * math.pi * k / SIDES)) / 2)
for li, vs in enumerate(leg_vs):
    u = LEG_U['front' if li % 2 == 0 else 'hind']
    for i, ring_v in enumerate(vs):
        for v in ring_v:
            uv2[v.index] = (u, 1 - i / (len(vs) - 1))

for v in B.bm.verts:
    v.co = norm(v.co)
body = B.to_object('body')
me = body.data
tris = len(me.polygons)
even_uvs(body, UV_TILE)


def add_projection(obj, lookup):
    m = obj.data
    proj = m.uv_layers.new(name='Projection')
    for loop in m.loops:
        proj.data[loop.index].uv = lookup(loop.vertex_index, m.vertices[loop.vertex_index].co)
    m.uv_layers.active = m.uv_layers['UVMap']


add_projection(body, lambda vi, co: uv2[vi])
from mathutils import kdtree  # noqa: E402
_kd = kdtree.KDTree(len(me.vertices))
for vtx in me.vertices:
    _kd.insert(vtx.co, vtx.index)
_kd.balance()


def nearest_uv2(vi, co):
    return uv2[_kd.find(co)[1]]

mat = bpy.data.materials.new('cat')
me.materials.append(mat)

coat_objs = []
for coat, tubes in COATS.items():
    S = Builder()
    for tube_rings, cap in tubes:
        S.tube([[norm(p) for p in ring] for ring in tube_rings], cap_start=cap, cap_end=False)
    obj = S.to_object(f'coat_{coat}')
    even_uvs(obj, UV_TILE)
    add_projection(obj, nearest_uv2)
    obj.data.materials.append(mat)
    coat_objs.append(obj)

tail_objs = []
tail_pts = None
for name, spec in TAILS.items():
    obj, w, pts = tail_mesh(f'tail_{name}', spec)
    obj.data.materials.append(mat)
    tail_objs.append((obj, w))
    if name == 'long':
        tail_pts = pts

# Bones (cat space).
n = norm
bones = [('root', n(Vector((waist.x, 0, 0))), n(Vector((waist.x, 0, zc * 0.3))), None),
         ('spine', n(waist), n(ribs), 'root'),
         ('pelvis', n(waist), n(rump_c), 'spine'),
         ('chest', n(ribs), n(chest_front), 'spine'),
         ('neck', n(neck_base), n(head_back), 'chest'),
         ('head', n(head_back), n(head_back + Vector((P['head_h'] * 0.6, 0, 0))), 'neck'),
         ('spine_breath', n(waist), n(ribs), 'spine'),
         ('chest_breath', n(ribs), n(chest_front), 'chest'),
         # No skin: its Y scale squashes the eyes shut in the viewer / game
         # (1 = open, ~0.1 = closed), the way the ear bones drive the ears.
         ('lids', n(head_back + Vector((P['head_h'] * 0.4, 0, 0))),
          n(head_back + Vector((P['head_h'] * 0.4, 0, P['head_h'] * 0.3))), 'head')]
# The tail chain follows the 'long' tail's curve at rest, TAIL_BONES equal
# bones from ring 1 to the tip.


def along(pos):
    i = min(int(pos), len(tail_pts) - 2)
    return tail_pts[i].lerp(tail_pts[i + 1], pos - i)


span = TAIL_RINGS - 2
for k in range(TAIL_BONES):
    a = along(1 + span * k / TAIL_BONES)
    b = along(min(1 + span * (k + 1) / TAIL_BONES, len(tail_pts) - 1.0001))
    if k == TAIL_BONES - 1:
        b = tail_pts[-1] + (tail_pts[-1] - tail_pts[-2]) * 0.3
    bones.append((f'tail.{k}', a, b, 'pelvis' if k == 0 else f'tail.{k - 1}'))
# Ear bones (no skin): their rotation drives the ear parts in the viewer /
# game, like the dog pack's jaw bone. They point straight up from the head.
for sd, sy in (('L', 1), ('R', -1)):
    base = head_back + Vector((P['head_h'] * 0.3, sy * P['head_h'] * 0.3, P['head_h'] * 0.6))
    bones.append((f'ear.{sd}', n(base), n(base + Vector((0, 0, P['head_h'] * 0.4))), 'head'))
for sd, (fpts, _), (rpts, _) in zip('LR', front_legs, rear_legs):
    f = [n(p) for p in fpts]
    q = [n(p) for p in rpts]
    bones += [(f'upperarm.{sd}', f[0], f[1], 'chest'), (f'forearm.{sd}', f[1], f[3], f'upperarm.{sd}'),
              (f'wrist.{sd}', f[3], f[4], f'forearm.{sd}'), (f'paw.{sd}', f[4], f[5], f'wrist.{sd}'),
              (f'thigh.{sd}', q[0], q[2], 'pelvis'), (f'shin.{sd}', q[2], q[3], f'thigh.{sd}'),
              (f'hock.{sd}', q[3], q[4], f'shin.{sd}'), (f'hind_paw.{sd}', q[4], q[5], f'hock.{sd}')]
arm = rig.build_armature(bones)
rig.skin(body, arm, weights)
for obj in coat_objs:
    rig.copy_weights(obj, body)
    rig.attach(obj, arm)
for obj, w in tail_objs:
    rig.skin(obj, arm, w)

e = bpy.data.objects.new('socket_head', None)
e.location = n(head_back)
e.scale = (P['head_h'] / real_length,) * 3
e['ear_scale'] = P['ear_scale']
bpy.context.scene.collection.objects.link(e)
bpy.context.view_layer.update()   # so parent_to_bone keeps its location and scale
rig.parent_to_bone(e, arm, 'head')

# --clips a,b,c bakes only those clips (fast iteration on animation).
only = args[args.index('--clips') + 1].split(',') if '--clips' in args else None
cat_anims.bake_all(arm, body, only)
arm['looping_clips'] = cat_anims.LOOPING

export(dst)
print('CAT', build_name, tris, 'tris', len(me.vertices), 'verts', f'length {real_length:.2f}',
      'bones', len(bones))
