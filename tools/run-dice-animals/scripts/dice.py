"""Dice animals: every farm animal is the same perfect cube on four tiny nub
feet, so they stack on a grid. The top stays flat (ears, wings and horns sit
on the sides; markings are flat paint), so another die sits on it.

Each animal is a node hierarchy with TRS clips, exported as a GLB:

    root
      feet                 the four nubs
      body                 the cube and its markings (pivot: bottom centre)
        eyes               eyes, shines (blinks)
        ear_l, ear_r       ears or wings (waggle, flop)
        tail

Clips (30 fps): idle (loop), hop (loop), waggle (loop), happy, land.

    Blender -b --factory-startup -t 1 --python dice.py -- <out dir> [animal ...]

Writes <animal>.glb and a <animal>-34.png still for each animal.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # bobble.py, blockout.py
from bobble import *  # noqa: F401,F403,E402
import bobble  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

FPS = 30
S = 2.0                  # the die: an S x S x S cube
ROUND = 0.12             # bevel, as a fraction of S (crisp but soft)
NUB_H = 0.16             # the feet lift the cube this much
BOTTOM = NUB_H
CZ = BOTTOM + S / 2      # cube centre
FRONT = -S / 2           # the front face (y)
TOP = BOTTOM + S
X90 = (math.radians(90), 0, 0)
PINK = (1.0, 0.58, 0.68)

# -------------------------------------------------------------- groups
_group = ["body"]
_parts = {}


class group:
    """with group('ear_l'): ...  every object made inside belongs to that node."""

    def __init__(self, name):
        self.name = name

    def __enter__(self):
        self.before = set(bpy.data.objects)
        self.prev = _group[0]
        _group[0] = self.name

    def __exit__(self, *a):
        new = [o for o in bpy.data.objects if o not in self.before]
        _parts.setdefault(self.name, []).extend(new)
        _group[0] = self.prev


def front_z(v):
    """A height on the front face, v in -1..1 (bottom..top)."""
    return CZ + v * S * 0.5


def flat(x, y, z, w, d, h, rgb, b=0.04):
    return box(x, y, z, w, d, h, rgb, bevel=b)


# -------------------------------------------------------------- shared pieces
def die(coat):
    box(0, 0, CZ, S, S, S, coat, bevel=S * ROUND, segs=3)


FEET = {}  # foot node -> pivot (the middle of its sole)


def feet(rgb):
    FEET.clear()
    for sx in (-1, 1):
        for sy in (-1, 1):
            name = "foot_" + ("f" if sy < 0 else "b") + ("l" if sx < 0 else "r")
            with group(name):
                box(sx * S * 0.3, sy * S * 0.3, NUB_H * 0.5 + 0.02, 0.42, 0.42, NUB_H + 0.04, rgb, bevel=0.07, segs=2)
            FEET[name] = Vector((sx * S * 0.3, sy * S * 0.3, 0.0))


EYES = []   # (x, y, z, r) of each eye, left then right
MOUTH = []  # (z, y, w) of the smile, if the animal has a mouth


def eyes(v=0.12, gap=0.2, r=0.17, cheeks=True, cheek_v=-0.12):
    EYES.clear()
    for s, tag in ((-1, "l"), (1, "r")):
        ex, ez = s * S * gap, front_z(v)
        with group(f"eye_{tag}"):
            can(ex, FRONT - 0.03, ez, r, 0.08, DARK, n=12, rot=X90)
            can(ex - r * 0.35, FRONT - 0.08, ez + r * 0.38, r * 0.36, 0.04, WHITE, n=8, rot=X90)
            can(ex + r * 0.38, FRONT - 0.08, ez - r * 0.4, r * 0.16, 0.04, WHITE, n=6, rot=X90)
        EYES.append([ex, FRONT, ez, r])
    if cheeks:
        for s in (-1, 1):
            ball(s * S * 0.33, FRONT + 0.02, front_z(cheek_v), 0.34, 0.1, 0.18, PINK, seg=10, ring=4)


def stroke(pts, y, r=0.035, rgb=DARK, n=8):
    """A drawn line on the face: one round tube swept through the (x, z)
    points (mitred at gentle bends), with a ball on the ends and on sharp
    corners. One tube instead of a bar and a ball per segment keeps the face
    parts light (a spiral eye was ~2.5k triangles)."""
    import bmesh
    pts = [Vector((x, y, z)) for x, z in pts]
    Y = Vector((0, 1, 0))
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        d0 = (p - pts[i - 1]).normalized() if i > 0 else None
        d1 = (pts[i + 1] - p).normalized() if i < len(pts) - 1 else None
        t = ((d0 or d1) + (d1 or d0)).normalized()
        side = t.cross(Y).normalized()
        miter = min(1 / max(side.dot(d0.cross(Y).normalized()), 1e-3), 2.0) if d0 and d1 else 1.0
        rings.append([bm.verts.new(p + side * (r * miter * math.cos(a)) + Y * (r * math.sin(a)))
                      for a in (2 * math.pi * k / n for k in range(n))])
        if d0 and d1 and d0.angle(d1) > math.radians(50):
            ball(p.x, p.y, p.z, r * 2, r * 1.2, r * 2, rgb, seg=8, ring=4)
    for a, b in zip(rings, rings[1:]):
        for k in range(n):
            bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("stroke")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("stroke", me)
    bpy.context.scene.collection.objects.link(o)
    finish(o, rgb)
    for p in (pts[0], pts[-1]):
        ball(p.x, p.y, p.z, r * 2, r * 1.2, r * 2, rgb, seg=8, ring=4)


def w_shape(z, y, w, rgb=DARK, flip=False):
    """The little 'w' smile as one connected stroke; flipped, a sad mouth."""
    k = -1 if flip else 1
    h = w * 0.32 * k
    stroke([(-w, z + h), (-w * 0.5, z), (0, z + h * 0.75), (w * 0.5, z), (w, z + h)], y, r=max(w * 0.11, 0.022), rgb=rgb)


def w_mouth(z, y=FRONT - 0.03, w=0.2, rgb=DARK):
    with group("mouth_smile"):
        w_shape(z, y, w, rgb)
    if not MOUTH:
        MOUTH.append((z, y, w))


def side_ears(coat, inner, length=0.62, width=0.3, z=0.55, droop=-20, out=0.18, y=-0.25):
    """Flat ears on the upper sides, angled out (below the top plane)."""
    for s, tag in ((-1, "l"), (1, "r")):
        with group(f"ear_{tag}"):
            x = s * (S / 2 + length * 0.36 - 0.05)
            zz = front_z(z)
            rot = (0, s * math.radians(droop), 0)
            box(x, y, zz, length, width * 0.5, width, coat, bevel=0.08, segs=2, rot=rot)
            box(x + s * 0.03, y - width * 0.26, zz, length * 0.66, 0.04, width * 0.55, inner, bevel=0.03, rot=rot)


def ear_pivots(z=0.55, y=-0.25):
    return {f"ear_{t}": Vector((s * S / 2, y, front_z(z))) for s, t in ((-1, "l"), (1, "r"))}


def tail_at(z=0.0):
    return Vector((0, S / 2, front_z(z)))


# -------------------------------------------------------------- animals
# each returns the pivots of its moving nodes (ears, eyes, tail)
def cow():
    COAT, PATCH, MUZ, MUZ_D, HORN, HOOF = (0.99, 0.98, 0.96), (0.16, 0.14, 0.17), (1.0, 0.7, 0.76), (0.86, 0.44, 0.55), (1.0, 0.9, 0.6), (0.36, 0.3, 0.3)
    die(COAT)
    feet(HOOF)
    for x, y, z, w, d, h in ((S / 2, 0.35, CZ + 0.15, 0.06, 0.9, 0.8), (-S / 2, -0.2, CZ - 0.2, 0.06, 0.7, 0.6),
                             (-0.35, 0.3, TOP, 0.9, 0.8, 0.06), (0.5, S / 2, CZ + 0.3, 0.6, 0.06, 0.5)):
        flat(x, y, z, w, d, h, PATCH)
    flat(0.62, FRONT, front_z(0.8), 0.5, 0.06, 0.28, PATCH)
    eyes(v=0.3, cheek_v=0.06)
    mz = front_z(-0.1)
    box(0, FRONT - 0.08, mz, 0.85, 0.2, 0.43, MUZ, bevel=0.1, segs=2)
    for s in (-1, 1):
        flat(s * 0.19, FRONT - 0.19, mz + 0.03, 0.11, 0.04, 0.15, MUZ_D, b=0.03)
    w_mouth(mz - 0.11, y=FRONT - 0.19, w=0.15)
    for s in (-1, 1):  # horns out the side corners, below the top
        can(s * (S / 2 + 0.1), -0.25, front_z(0.82), 0.09, 0.28, HORN, n=8, r2=0.05, rot=(0, s * math.radians(70), 0))
    side_ears(COAT, MUZ, z=0.5)
    with group("tail"):
        t = tail_at(0.1)
        limb(t, t + Vector((0.2, 0.25, -0.45)), 0.05, COAT)
        box(*(t + Vector((0.22, 0.28, -0.6))), 0.22, 0.22, 0.3, PATCH, bevel=0.07)
    return {**ear_pivots(0.5), "tail": tail_at(0.1)}


def pig():
    COAT, DARKP, SNOUT, NOST, HOOF, MUD = (1.0, 0.68, 0.76), (0.94, 0.5, 0.62), (1.0, 0.58, 0.68), (0.78, 0.32, 0.46), (0.86, 0.44, 0.56), (0.5, 0.34, 0.2)
    die(COAT)
    feet(HOOF)
    flat(S / 2, 0.4, CZ - 0.35, 0.06, 0.45, 0.3, MUD)
    eyes(v=0.3, cheek_v=0.06)
    sz = front_z(-0.1)
    box(0, FRONT - 0.1, sz, 0.62, 0.24, 0.42, SNOUT, bevel=0.1, segs=2)
    for s in (-1, 1):
        flat(s * 0.13, FRONT - 0.23, sz + 0.01, 0.1, 0.04, 0.2, NOST, b=0.03)
    w_mouth(sz - 0.3, w=0.15)
    # ear flaps hinged on the top front edge, folded down over the front corners
    for s_, tag in ((-1, "l"), (1, "r")):
        with group(f"ear_{tag}"):
            box(s_ * 0.66, FRONT - 0.1, TOP - 0.2, 0.52, 0.1, 0.38, COAT, bevel=0.05, segs=2, rot=(math.radians(-14), 0, s_ * math.radians(-10)))
            box(s_ * 0.66, FRONT - 0.16, TOP - 0.21, 0.32, 0.04, 0.22, DARKP, bevel=0.03, rot=(math.radians(-14), 0, s_ * math.radians(-10)))
    with group("tail"):
        t = tail_at(0.2)
        pts = [t + Vector((0.14 * math.cos(a) * (1 - a / 14), 0.06 + a * 0.025, 0.14 * math.sin(a) * (1 - a / 14))) for a in [i * 0.7 for i in range(10)]]
        for p0, p1 in zip(pts, pts[1:]):
            limb(p0, p1, 0.045, DARKP)
    return {"ear_l": Vector((-0.6, FRONT - 0.05, TOP - 0.04)), "ear_r": Vector((0.6, FRONT - 0.05, TOP - 0.04)),
            "tail": tail_at(0.2)}


def sheep():
    WOOL, FACE, EAR_IN, HOOF, FLOWER = (1.0, 0.99, 0.96), (0.98, 0.88, 0.76), (1.0, 0.68, 0.74), (0.3, 0.25, 0.28), (1.0, 0.55, 0.72)
    die(WOOL)
    feet(HOOF)
    # low blocky wool tiles on the top and sides (flat enough to stack on)
    for i in range(3):
        for j in range(3):
            u, v = (i - 1) * 0.6, (j - 1) * 0.6
            box(u, v, TOP + 0.02, 0.5, 0.5, 0.12, WOOL, bevel=0.05)
            for s in (-1, 1):
                box(s * (S / 2 + 0.03), u, CZ + v, 0.12, 0.5, 0.5, WOOL, bevel=0.05)
            box(u, S / 2 + 0.03, CZ + v, 0.5, 0.12, 0.5, WOOL, bevel=0.05)
    # a wool frame round the face on the front
    for x, z, w, h in ((0, front_z(0.82), S * 0.9, 0.34), (-0.82, CZ, 0.34, S * 0.9), (0.82, CZ, 0.34, S * 0.9), (0, front_z(-0.85), S * 0.9, 0.3)):
        box(x, FRONT - 0.04, z, w, 0.14, h, WOOL, bevel=0.06)
    box(0, FRONT - 0.03, CZ - 0.02, 1.4, 0.1, 1.3, FACE, bevel=0.12, segs=2)
    eyes(v=0.08, gap=0.17, r=0.16, cheek_v=-0.18)
    for tag in ("l", "r"):  # the eyes sit on the raised face plate
        for o in _parts.get(f"eye_{tag}", []):
            o.location.y -= 0.06
    for e in EYES:
        e[1] -= 0.06
    with group("nose"):  # the nose moves up out of the way of an open mouth
        can(0, FRONT - 0.1, front_z(-0.18), 0.1, 0.06, (0.95, 0.5, 0.6), n=3, r2=0.0, rot=(math.radians(90), 0, math.radians(180)))
    w_mouth(front_z(-0.33), y=FRONT - 0.1, w=0.14)
    side_ears(HOOF, EAR_IN, length=0.5, width=0.26, z=0.35, droop=-28)
    fx, fz = 0.62, front_z(0.82)
    for k in range(4):
        a = k * math.pi / 2
        box(fx + 0.1 * math.cos(a), FRONT - 0.13, fz + 0.1 * math.sin(a), 0.14, 0.06, 0.14, FLOWER, bevel=0.03)
    box(fx, FRONT - 0.16, fz, 0.1, 0.06, 0.1, (1.0, 0.85, 0.3), bevel=0.02)
    with group("tail"):
        box(0, S / 2 + 0.2, front_z(0.1), 0.42, 0.3, 0.42, WOOL, bevel=0.12, segs=2)
    return {**ear_pivots(0.35), "tail": tail_at(0.1)}


def two_feet(rgb):
    FEET.clear()
    for sx in (-1, 1):
        name = "foot_" + ("l" if sx < 0 else "r")
        with group(name):
            box(sx * 0.42, -0.05, NUB_H * 0.5 + 0.02, 0.5, 0.62, NUB_H + 0.04, rgb, bevel=0.08, segs=2)
            for t in (-1, 0, 1):  # three little toes
                box(sx * 0.42 + t * 0.16, -0.4, 0.06, 0.12, 0.2, 0.1, rgb, bevel=0.03)
        FEET[name] = Vector((sx * 0.42, -0.05, 0.0))


def bird(coat, beak, feet_rgb, comb=None, bill=False, wing=None, eye_v=0.32, eye_gap=0.18, eye_r=0.17, beak_v=0.1,
         beak_shape="pyramid"):
    die(coat)
    two_feet(feet_rgb)
    eyes(v=eye_v, gap=eye_gap, r=eye_r, cheek_v=eye_v - 0.24)
    if bill:  # a small flat duck bill just under the eyes
        box(0, FRONT - 0.16, front_z(0.04), 0.66, 0.34, 0.17, beak, bevel=0.07, segs=2)
    elif beak_shape == "pyramid":  # a little pyramid beak just under the eyes
        r = 0.19
        can(0, FRONT - r * 0.9, front_z(beak_v), r, r * 1.6, beak, n=4, r2=0.0, rot=(math.radians(90), 0, math.radians(45)))
    if comb:
        for x, h in ((-0.22, 0.3), (0.0, 0.4), (0.22, 0.3)):  # rounded comb tufts on the front top edge
            ball(x, FRONT - 0.06, TOP - 0.04 - h * 0.25, 0.24, 0.18, h, comb, seg=10, ring=7)
        ball(0, FRONT - 0.08, front_z(-0.18), 0.2, 0.14, 0.26, comb, seg=10, ring=7)  # a round wattle drop
    wing = wing or coat
    for s_, tag in ((-1, "l"), (1, "r")):
        with group(f"ear_{tag}"):  # rounded wings: the 'ears' of a bird
            ball(s_ * (S / 2 + 0.06), 0.2, CZ - 0.12, 0.2, 0.95, 0.8, wing, seg=12, ring=8)
            ball(s_ * (S / 2 + 0.08), 0.62, CZ - 0.32, 0.16, 0.42, 0.36, wing, seg=10, ring=6)
    with group("tail"):
        for k, a_ in enumerate((-25, 0, 25)):
            ball(math.sin(math.radians(a_)) * 0.25, S / 2 + 0.08, front_z(0.4) + 0.06 * (k == 1), 0.22, 0.2, 0.55, wing,
                 seg=8, ring=6)
    return {"ear_l": Vector((-S / 2, 0.2, CZ + 0.25)), "ear_r": Vector((S / 2, 0.2, CZ + 0.25)), "tail": tail_at(0.25)}


def chicken():
    return bird((1.0, 0.99, 0.96), (1.0, 0.72, 0.18), (1.0, 0.62, 0.15), comb=(0.94, 0.22, 0.24), wing=(0.95, 0.93, 0.9))


def equine(coat, muzzle, mane, hoof, ear_len=0.6, blaze=None, hat=None):
    die(coat)
    feet(hoof)
    eyes(v=0.3, cheek_v=0.06)
    mz = front_z(-0.1)
    box(0, FRONT - 0.08, mz, 0.85, 0.2, 0.45, muzzle, bevel=0.1, segs=2)
    for s in (-1, 1):
        flat(s * 0.19, FRONT - 0.19, mz + 0.03, 0.1, 0.04, 0.14, tuple(c * 0.55 for c in coat), b=0.03)
    w_mouth(mz - 0.11, y=FRONT - 0.19, w=0.15)
    if blaze:
        flat(0, FRONT, front_z(0.62), 0.22, 0.06, 0.5, blaze)
        flat(0, 0.0, TOP, 0.24, S * 0.6, 0.06, blaze)
    # the mane: a flat strip down the back and a forelock on the front top edge
    flat(0, S / 2, CZ + 0.3, 0.6, 0.08, S * 0.7, mane)
    for x in (-0.18, 0.0, 0.18):
        box(x, FRONT - 0.05, TOP - 0.18, 0.2, 0.12, 0.34, mane, bevel=0.06)
    side_ears(coat, PINK, length=ear_len, width=0.3, z=0.68, droop=-40 if ear_len < 0.8 else -30)
    with group("tail"):
        t = tail_at(0.2)
        for k in (-1, 0, 1):
            limb(t, t + Vector((k * 0.12, 0.25, -0.6)), 0.07, mane)
    return {**ear_pivots(0.68), "tail": tail_at(0.2)}


def horse():
    return equine((0.86, 0.48, 0.24), (0.98, 0.88, 0.74), (0.32, 0.18, 0.1), (0.3, 0.22, 0.2), blaze=(0.99, 0.97, 0.92))


def donkey():
    return equine((0.62, 0.62, 0.68), (0.95, 0.94, 0.92), (0.3, 0.28, 0.32), (0.3, 0.27, 0.3), ear_len=0.95)


def goat():
    COAT, WHITE_, HORN, HOOF = (0.9, 0.72, 0.5), (0.99, 0.97, 0.93), (0.6, 0.58, 0.56), (0.3, 0.25, 0.22)
    die(COAT)
    feet(HOOF)
    flat(0, FRONT, front_z(-0.3), 0.95, 0.06, 0.8, WHITE_, b=0.15)
    eyes(v=0.3, cheek_v=0.06)
    with group("nose"):  # the nose moves up out of the way of an open mouth
        can(0, FRONT - 0.06, front_z(0.0), 0.1, 0.06, PINK, n=3, r2=0.0, rot=(math.radians(90), 0, math.radians(180)))
    w_mouth(front_z(-0.14), w=0.16)
    box(0, FRONT - 0.08, BOTTOM + 0.1, 0.3, 0.16, 0.36, WHITE_, bevel=0.07)  # beard
    for s in (-1, 1):  # chunky horns curling back and down along the upper sides
        pts = [(-0.55, TOP - 0.15), (-0.2, TOP - 0.05), (0.15, TOP - 0.15), (0.35, TOP - 0.45), (0.25, TOP - 0.72)]
        for (y0, z0), (y1, z1) in zip(pts, pts[1:]):
            limb((s * (S / 2 + 0.08), y0, z0), (s * (S / 2 + 0.08), y1, z1), 0.13, HORN, n=8)
        for y, z in pts:
            ball(s * (S / 2 + 0.08), y, z, 0.27, 0.27, 0.27, HORN, seg=8, ring=6)
    side_ears(COAT, PINK, length=0.6, width=0.28, z=0.4, droop=-5)
    flat(0, S / 2, CZ, 0.7, 0.06, 0.9, WHITE_)
    with group("tail"):
        t = tail_at(0.6)
        box(*(t + Vector((0, 0.12, 0.12))), 0.18, 0.2, 0.34, WHITE_, bevel=0.06, rot=(math.radians(-25), 0, 0))
    return {**ear_pivots(0.4), "tail": tail_at(0.6)}


def bunny():
    COAT, CREAM = (0.86, 0.66, 0.46), (0.99, 0.94, 0.86)
    die(COAT)
    feet(CREAM)
    eyes(v=0.3, cheek_v=0.06)
    box(0, FRONT - 0.05, front_z(-0.08), 0.8, 0.12, 0.42, CREAM, bevel=0.12, segs=2)
    with group("nose"):  # the nose moves up out of the way of an open mouth
        can(0, FRONT - 0.13, front_z(0.03), 0.1, 0.06, PINK, n=3, r2=0.0, rot=(math.radians(90), 0, math.radians(180)))
    for s in (-1, 1):
        box(s * 0.07, FRONT - 0.12, front_z(-0.24), 0.12, 0.04, 0.16, WHITE)  # buck teeth
    # long ears lying flat back over the top
    for s_, tag in ((-1, "l"), (1, "r")):
        with group(f"ear_{tag}"):
            x = s_ * 0.42
            box(x, FRONT + 0.75, TOP + 0.05, 0.46, 1.5, 0.1, COAT, bevel=0.05, segs=2, rot=(0, 0, s_ * math.radians(-8)))
            box(x, FRONT + 0.72, TOP + 0.11, 0.26, 1.2, 0.03, PINK, bevel=0.01, rot=(0, 0, s_ * math.radians(-8)))
    with group("tail"):
        ball(0, S / 2 + 0.12, front_z(-0.35), 0.5, 0.4, 0.5, WHITE, seg=10, ring=7)
    return {"ear_l": Vector((-0.42, FRONT + 0.1, TOP)), "ear_r": Vector((0.42, FRONT + 0.1, TOP)), "tail": tail_at(-0.35),
            "ear_axis": "x"}


def dog():
    COAT, SPOT, NOSE, TONGUE = (0.98, 0.94, 0.86), (0.62, 0.4, 0.22), (0.16, 0.12, 0.12), (1.0, 0.45, 0.55)
    die(COAT)
    feet(SPOT)
    flat(0.42, FRONT, front_z(0.34), 0.72, 0.06, 0.62, SPOT, b=0.15)  # a patch round one eye
    flat(-S / 2, 0.3, CZ + 0.1, 0.06, 0.9, 0.8, SPOT, b=0.15)
    flat(0.2, 0.1, TOP, 0.8, 0.7, 0.06, SPOT, b=0.15)
    eyes(v=0.3, cheek_v=0.06)
    box(0, FRONT - 0.07, front_z(-0.12), 0.85, 0.16, 0.46, COAT, bevel=0.12, segs=2)
    with group("nose"):  # the nose moves up out of the way of an open mouth
        box(0, FRONT - 0.17, front_z(0.0), 0.28, 0.06, 0.18, NOSE, bevel=0.06)
    w_mouth(front_z(-0.16), y=FRONT - 0.16, w=0.16)
    box(0.04, FRONT - 0.16, front_z(-0.28), 0.15, 0.04, 0.16, TONGUE, bevel=0.04)
    box(0, FRONT - 0.04, front_z(-0.78), 1.4, 0.08, 0.16, (0.88, 0.2, 0.25), bevel=0.04)  # a red collar
    box(0, FRONT - 0.1, front_z(-0.9), 0.16, 0.06, 0.16, (1.0, 0.8, 0.25), bevel=0.04)
    # floppy ears hanging down the upper sides
    for s, tag in ((-1, "l"), (1, "r")):
        with group(f"ear_{tag}"):
            box(s * (S / 2 + 0.08), -0.35, front_z(0.42), 0.16, 0.6, 0.95, SPOT, bevel=0.08, segs=2, rot=(0, s * math.radians(-12), 0))
    with group("tail"):
        t = tail_at(0.3)
        limb(t, t + Vector((0.0, 0.3, 0.4)), 0.08, COAT)
        ball(*(t + Vector((0.0, 0.32, 0.45))), 0.2, 0.2, 0.2, SPOT, seg=8, ring=6)
    return {"ear_l": Vector((-S / 2, -0.35, front_z(0.85))), "ear_r": Vector((S / 2, -0.35, front_z(0.85))), "tail": tail_at(0.3)}


def mouse():
    COAT, BELLY = (0.72, 0.62, 0.58), (0.97, 0.9, 0.86)
    die(COAT)
    feet(PINK)
    flat(0, FRONT, front_z(-0.45), 1.1, 0.06, 0.8, BELLY, b=0.15)
    eyes(v=0.32, gap=0.2, cheek_v=0.08)
    with group("nose"):  # the nose moves up out of the way of an open mouth
        ball(0, FRONT - 0.08, front_z(0.06), 0.22, 0.16, 0.18, PINK, seg=8, ring=6)
    w_mouth(front_z(-0.08), w=0.15)
    for s in (-1, 1):
        for dz in (-0.05, 0.05):
            box(s * 0.52, FRONT - 0.06, front_z(0.04) + dz, 0.4, 0.02, 0.025, DARK)
    # big round ears on the upper sides
    for s, tag in ((-1, "l"), (1, "r")):
        with group(f"ear_{tag}"):
            can(s * (S / 2 + 0.06), -0.2, front_z(0.6), 0.48, 0.1, COAT, n=16, rot=(0, math.radians(90), 0))
            can(s * (S / 2 + 0.12), -0.2, front_z(0.6), 0.34, 0.04, PINK, n=16, rot=(0, math.radians(90), 0))
    with group("tail"):
        t = tail_at(-0.75)
        pts = [t + Vector((0.3 * math.sin(a * 2), 0.1 + 0.35 * a, -0.0 * a)) for a in [i * 0.3 for i in range(7)]]
        pts = [Vector((p.x, p.y, max(p.z, 0.05))) for p in pts]
        for p0, p1 in zip(pts, pts[1:]):
            limb(p0, p1, 0.04, PINK)
    return {"ear_l": Vector((-S / 2, -0.2, front_z(0.6))), "ear_r": Vector((S / 2, -0.2, front_z(0.6))), "tail": tail_at(-0.75)}


def pointy_ear(s_, tag, coat, inner, z=0.62, y=-0.3, w=0.58, h=0.74, out=24, tip=None, inset=-0.04):
    """A chunky pointed ear with chamfered edges (like the dog's ears, but up):
    three stacked rounded blocks narrowing to a soft point, rising from the
    upper side edge and leaning out, its base set into the die. Above the top
    it stays outside the die's footprint, so another die still stacks on it."""
    th = math.radians(s_ * out)
    piv = Vector((s_ * (S / 2 - inset), y, front_z(z)))

    def at(lx, lz):  # ear-local (across, up) -> world, leaning out about the base
        return piv + Vector((lx * math.cos(th) + lz * math.sin(th), 0, -lx * math.sin(th) + lz * math.cos(th)))

    def chamfer(o, width):
        m = o.modifiers.new("b", "BEVEL")
        m.width, m.segments, m.limit_method = width, 2, "NONE"
        return o

    with group(f"ear_{tag}"):
        c = at(0, h * 0.5)  # one solid four-sided point, flattened front to back, its edges rounded off
        o = can(c.x, c.y, c.z, w / 2, h, coat, n=4, r2=0.04, rot=(0, th, 0))
        o.scale = (1, 0.42, 1)
        chamfer(o, 0.05)
        ci = at(0, h * 0.42)
        o = can(ci.x, ci.y - 0.1, ci.z, w * 0.29, h * 0.66, inner, n=4, r2=0.02, rot=(0, th, 0))
        o.scale = (1, 0.25, 1)
        if tip:
            ct = at(0, h * 0.86)
            o = can(ct.x, ct.y, ct.z, w * 0.13, h * 0.3, tip, n=4, r2=0.02, rot=(0, th, 0))
            o.scale = (1, 0.6, 1)
            chamfer(o, 0.02)
    return piv


def mallard():
    GREEN, BODY, CHEST, BILL, BILL_D, WING, BLUE = (0.2, 0.62, 0.36), (0.7, 0.66, 0.62), (0.62, 0.36, 0.22), (1.0, 0.8, 0.2), (0.92, 0.6, 0.12), (0.56, 0.5, 0.46), (0.25, 0.42, 0.95)
    die(BODY)
    two_feet((1.0, 0.6, 0.15))
    # the green head: the top part of the die, with a white collar ring under it
    cap_h = S * 0.48
    box(0, 0, TOP - cap_h / 2 + 0.015, S + 0.03, S + 0.03, cap_h, GREEN, bevel=S * ROUND, segs=3)
    box(0, 0, TOP - cap_h - 0.02, S + 0.07, S + 0.07, 0.11, WHITE, bevel=0.045)
    flat(0, FRONT - 0.01, front_z(-0.2), 1.1, 0.06, 0.42, (0.74, 0.46, 0.3), b=0.2)  # a soft chestnut breast
    eyes(v=0.58, gap=0.2, cheek_v=0.34)
    for tag in ("l", "r"):
        for o in _parts.get(f"eye_{tag}", []):
            o.location.y -= 0.02
    for e in EYES:
        e[1] -= 0.02
    # a big flat duck bill sticking out under the eyes, upper over lower
    bz = front_z(0.24)
    box(0, FRONT - 0.26, bz, 0.84, 0.56, 0.17, BILL, bevel=0.08, segs=2)
    box(0, FRONT - 0.22, bz - 0.12, 0.7, 0.44, 0.08, BILL_D, bevel=0.035)
    for s_ in (-1, 1):
        box(s_ * 0.15, FRONT - 0.44, bz + 0.09, 0.07, 0.07, 0.03, BILL_D)  # nostrils
    for s_, tag in ((-1, "l"), (1, "r")):
        with group(f"ear_{tag}"):  # wings, with the blue stripe
            ball(s_ * (S / 2 + 0.06), 0.25, CZ - 0.25, 0.2, 0.95, 0.75, WING, seg=12, ring=8)
            box(s_ * (S / 2 + 0.15), 0.38, CZ - 0.2, 0.04, 0.4, 0.14, BLUE, bevel=0.02)
    with group("tail"):  # the little black curl
        t = tail_at(0.32)
        pts = [t + Vector((0, 0.08 + 0.18 * math.sin(a), 0.18 * (1 - math.cos(a)))) for a in [i * 0.55 for i in range(8)]]
        for p0, p1 in zip(pts, pts[1:]):
            limb(p0, p1, 0.06, DARK)
        ball(0, S / 2 + 0.1, front_z(0.1), 0.42, 0.24, 0.32, WHITE, seg=8, ring=6)
    return {"ear_l": Vector((-S / 2, 0.25, CZ + 0.1)), "ear_r": Vector((S / 2, 0.25, CZ + 0.1)), "tail": tail_at(0.32)}


def hen():
    BROWN, DARKB, SPECK = (0.8, 0.48, 0.24), (0.62, 0.34, 0.16), (0.98, 0.86, 0.66)
    p = bird(BROWN, (1.0, 0.76, 0.2), (1.0, 0.66, 0.18), comb=(0.94, 0.22, 0.24), wing=DARKB)
    for x, y, z in ((S / 2, -0.3, CZ + 0.5), (S / 2, 0.5, CZ + 0.6), (-S / 2, 0.1, CZ + 0.55), (-S / 2, -0.45, CZ + 0.62),
                    (0.3, 0.4, TOP), (-0.45, -0.2, TOP), (0.5, -0.5, TOP)):
        if abs(x) == S / 2:
            flat(x, y, z, 0.06, 0.16, 0.12, SPECK, b=0.03)
        else:
            flat(x, y, z, 0.16, 0.12, 0.06, SPECK, b=0.03)
    return p


def rooster():
    GOLD, RED, DARKG, COPPER = (1.0, 0.7, 0.32), (0.92, 0.2, 0.2), (0.12, 0.32, 0.26), (0.78, 0.36, 0.14)
    p = bird(GOLD, (1.0, 0.82, 0.25), (1.0, 0.66, 0.18), comb=RED, wing=COPPER)
    for x, h in ((-0.32, 0.36), (0.32, 0.36)):  # a bigger comb
        ball(x, FRONT - 0.06, TOP - 0.04 - h * 0.25, 0.22, 0.17, h, RED, seg=10, ring=7)
    ball(0, FRONT - 0.08, front_z(-0.32), 0.18, 0.12, 0.22, RED, seg=10, ring=7)  # a longer wattle
    with group("tail"):  # big arched tail feathers sweeping back (never above the top)
        for k, (dx, col) in enumerate(((-0.36, DARKG), (-0.12, COPPER), (0.12, DARKG), (0.36, COPPER))):
            pts = [Vector((dx, S / 2 + 0.05 + 0.75 * math.sin(a), front_z(0.1) + 0.9 * math.sin(a * 0.9)))
                   for a in [i * 0.3 for i in range(7)]]
            pts = [Vector((p_.x, p_.y, min(p_.z, TOP - 0.08))) for p_ in pts]
            for p0, p1 in zip(pts, pts[1:]):
                limb(p0, p1, 0.1 - 0.008 * k, col)
            ball(*pts[-1], 0.22, 0.22, 0.22, col, seg=8, ring=6)
    return p


def chick():
    YEL, YEL_D, ORANGE = (1.0, 0.86, 0.26), (0.98, 0.76, 0.18), (1.0, 0.56, 0.12)
    p = bird(YEL, ORANGE, ORANGE, wing=YEL_D, eye_r=0.21, eye_gap=0.19)
    for x, h, lean in ((-0.12, 0.26, 12), (0.04, 0.34, -6), (0.18, 0.24, -18)):  # a little fluff tuft on the front top edge
        ball(x, FRONT + 0.1, TOP - 0.06, 0.12, 0.12, h, YEL_D, seg=8, ring=6, rot=(0, math.radians(lean), 0))
    return p


def goose():
    WHITE_, BILL, KNOB, WING = (1.0, 0.99, 0.97), (1.0, 0.56, 0.14), (0.95, 0.42, 0.1), (0.86, 0.87, 0.9)
    die(WHITE_)
    two_feet((1.0, 0.56, 0.14))
    eyes(v=0.38, gap=0.2, cheek_v=0.16)
    bz = front_z(0.14)
    box(0, FRONT - 0.3, bz, 0.5, 0.64, 0.22, BILL, bevel=0.1, segs=2)  # a long orange bill...
    ball(0, FRONT - 0.04, bz + 0.16, 0.3, 0.18, 0.24, KNOB, seg=10, ring=7)  # ...with the knob at its base
    for s_ in (-1, 1):
        box(s_ * 0.1, FRONT - 0.58, bz + 0.1, 0.06, 0.06, 0.03, KNOB)
    # a red ribbon bow at the neck
    box(0, FRONT - 0.04, front_z(-0.32), 1.6, 0.08, 0.14, (0.9, 0.22, 0.28), bevel=0.04)
    for s_ in (-1, 1):
        box(s_ * 0.2, FRONT - 0.1, front_z(-0.32), 0.3, 0.1, 0.22, (0.9, 0.22, 0.28), bevel=0.06, rot=(0, s_ * math.radians(20), 0))
    ball(0, FRONT - 0.12, front_z(-0.32), 0.14, 0.12, 0.14, (0.78, 0.15, 0.2), seg=8, ring=6)
    for s_, tag in ((-1, "l"), (1, "r")):
        with group(f"ear_{tag}"):
            ball(s_ * (S / 2 + 0.06), 0.25, CZ - 0.15, 0.22, 1.1, 0.85, WING, seg=12, ring=8)
    with group("tail"):
        box(0, S / 2 + 0.12, front_z(0.3), 0.7, 0.3, 0.3, WING, bevel=0.12, segs=2, rot=(math.radians(-25), 0, 0))
    return {"ear_l": Vector((-S / 2, 0.25, CZ + 0.25)), "ear_r": Vector((S / 2, 0.25, CZ + 0.25)), "tail": tail_at(0.3)}


def turkey():
    BROWN, DARKB, CREAM, ORANGE, RED = (0.56, 0.36, 0.22), (0.42, 0.26, 0.16), (0.98, 0.9, 0.74), (0.92, 0.52, 0.2), (0.88, 0.2, 0.22)
    p = bird(BROWN, (1.0, 0.78, 0.25), (1.0, 0.64, 0.2), wing=DARKB)
    bz = front_z(0.1)
    limb((0.04, FRONT - 0.12, bz + 0.18), (0.08, FRONT - 0.3, bz - 0.22), 0.065, RED)  # the snood over the beak
    ball(0.08, FRONT - 0.3, bz - 0.26, 0.14, 0.14, 0.16, RED, seg=8, ring=6)
    ball(-0.02, FRONT - 0.08, bz - 0.3, 0.22, 0.16, 0.3, RED, seg=10, ring=7)  # the wattle
    with group("tail"):  # the fan: banded feathers in a half circle behind, as wide as the die, below the top
        c = Vector((0, S / 2 + 0.16, CZ - 0.05))
        for i in range(11):
            a = math.radians(-90 + 18 * i)
            d = Vector((math.sin(a), 0, math.cos(a)))
            for r0, r1, col in ((0.2, 0.95, DARKB), (0.95, 1.3, ORANGE), (1.3, 1.58, CREAM)):
                m = c + d * ((r0 + r1) / 2) + Vector((0, 0.02 * (i % 2), 0))
                box(m.x, m.y, m.z, 0.42 - 0.08 * (r0 > 0.5) + 0.1 * (r0 > 1.0), 0.08, r1 - r0, col, bevel=0.04, rot=(0, a, 0))
    p["tail"] = Vector((0, S / 2 + 0.16, CZ - 0.05))
    return p


def fox():
    ORANGE, WHITE_, DARKF = (0.96, 0.5, 0.18), (1.0, 0.97, 0.92), (0.24, 0.16, 0.14)
    die(ORANGE)
    feet(DARKF)
    flat(0, FRONT, front_z(-0.42), 1.5, 0.06, 0.8, WHITE_, b=0.25)
    flat(0, FRONT, front_z(-0.05), 0.9, 0.06, 0.32, WHITE_, b=0.12)
    eyes(v=0.3, cheek_v=0.06)
    box(0, FRONT - 0.07, front_z(-0.1), 0.62, 0.16, 0.36, WHITE_, bevel=0.1, segs=2)
    with group("nose"):  # the nose moves up out of the way of an open mouth
        box(0, FRONT - 0.17, front_z(0.0), 0.2, 0.06, 0.14, DARK, bevel=0.05)
    w_mouth(front_z(-0.13), y=FRONT - 0.16, w=0.14)
    pl = pointy_ear(-1, "l", ORANGE, WHITE_, tip=DARKF)
    pr = pointy_ear(1, "r", ORANGE, WHITE_, tip=DARKF)
    with group("tail"):  # a big bushy tail, white tipped, curling round the side
        t = tail_at(-0.45)
        for k, (dx, dy, dz, r, col) in enumerate(((0.1, 0.22, 0.0, 0.42, ORANGE), (0.42, 0.42, 0.14, 0.56, ORANGE),
                                                  (0.86, 0.36, 0.32, 0.6, ORANGE), (1.12, 0.06, 0.46, 0.44, WHITE_))):
            ball(t.x + dx, t.y + dy, t.z + dz, r, r, r * 0.9, col, seg=12, ring=8)
    return {"ear_l": pl, "ear_r": pr, "tail": tail_at(-0.45)}


def hedgehog():
    SPINE, SPINE_T, FACE, NOSE = (0.5, 0.34, 0.24), (0.86, 0.74, 0.6), (0.98, 0.86, 0.7), (0.16, 0.12, 0.12)
    die(SPINE)
    feet((0.96, 0.7, 0.66))
    # spines: little pointed cones out of the back, the sides and (low) the top
    def spike(p_, n_, h):
        q = Vector((0, 0, 1)).rotation_difference(n_)
        o = can(p_.x + n_.x * h * 0.5, p_.y + n_.y * h * 0.5, p_.z + n_.z * h * 0.5, 0.11, h, SPINE, n=6, r2=0.015)
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = q
        ball(*(p_ + n_ * (h * 0.9)), 0.05, 0.05, 0.05, SPINE_T, seg=6, ring=4)
    for i in range(4):
        for j in range(4):
            u, v = -0.72 + 0.48 * i + 0.12 * (j % 2), -0.72 + 0.48 * j
            spike(Vector((u, v + 0.15, TOP - 0.02)), Vector((0, 0.35, 1)).normalized(), 0.14)   # low on top
            spike(Vector((u, S / 2 - 0.02, CZ + v)), Vector((0, 1, 0.3)).normalized(), 0.3)    # the back
            for s_ in (-1, 1):
                if v > -0.6:
                    spike(Vector((s_ * (S / 2 - 0.02), u * 0.8 + 0.2, CZ + v)), Vector((s_, 0.4, 0.2)).normalized(), 0.24)
    box(0, FRONT - 0.04, CZ - 0.12, 1.5, 0.1, 1.4, FACE, bevel=0.2, segs=2)  # the face
    eyes(v=0.24, gap=0.2, cheek_v=0.0)
    for tag in ("l", "r"):
        for o in _parts.get(f"eye_{tag}", []):
            o.location.y -= 0.06
    for e in EYES:
        e[1] -= 0.06
    with group("nose"):  # a shiny button nose
        ball(0, FRONT - 0.16, front_z(-0.04), 0.24, 0.18, 0.2, NOSE, seg=10, ring=7)
    w_mouth(front_z(-0.2), y=FRONT - 0.1, w=0.14)
    for s_, tag in ((-1, "l"), (1, "r")):
        with group(f"ear_{tag}"):
            can(s_ * 0.62, FRONT - 0.06, front_z(0.58), 0.15, 0.08, FACE, n=14, rot=X90)
            can(s_ * 0.62, FRONT - 0.1, front_z(0.58), 0.09, 0.03, (0.95, 0.66, 0.66), n=14, rot=X90)
    return {"ear_l": Vector((-0.62, FRONT - 0.06, front_z(0.58))), "ear_r": Vector((0.62, FRONT - 0.06, front_z(0.58)))}


# -------------------------------------------------------------- shared bits for the wild ones
def round_ear(s_, tag, coat, inner, r=0.32, y=-0.35, z=None):
    """A round ear on the top side edge, mostly outside the die's footprint."""
    zc = TOP - 0.14 if z is None else z
    with group(f"ear_{tag}"):
        ball(s_ * (S / 2 + 0.08), y, zc, 2 * r, 0.26, 2 * r * 0.95, coat, seg=14, ring=9)
        ball(s_ * (S / 2 + 0.1), y - 0.11, zc - 0.02, 1.2 * r, 0.06, 1.1 * r, inner, seg=12, ring=7)
    return Vector((s_ * S / 2, y, zc - 0.16))


def eye_backs(rgb, k=1.45):
    """Pale discs behind the eyes, so dark eyes show on a dark face."""
    for x, y, z, r in EYES:
        can(x, y + 0.012, z, r * k, 0.03, rgb, n=20, rot=X90)


def nose_tri(z, rgb=PINK, y=FRONT - 0.13, r=0.1):
    with group("nose"):  # the nose moves up out of the way of an open mouth
        can(0, y, z, r, 0.06, rgb, n=3, r2=0.0, rot=(math.radians(90), 0, math.radians(180)))


def nose_box(z, rgb=DARK, y=FRONT - 0.17, w=0.2, h=0.14):
    with group("nose"):
        box(0, y, z, w, 0.06, h, rgb, bevel=0.05)


def ringed_tail(start, pts_off, r, cols):
    with group("tail"):
        pts = [start + Vector(p_) for p_ in pts_off]
        for i, (p0, p1) in enumerate(zip(pts, pts[1:])):
            col = cols[i % len(cols)]
            limb(p0, p1, r, col, n=10)
            ball(*p1, 2 * r, 2 * r, 2 * r, col, seg=10, ring=7)


def tuft_tail(start, dirv, length, coat, tuft):
    with group("tail"):
        end = start + Vector(dirv).normalized() * length
        limb(start, end, 0.06, coat)
        ball(*end, 0.26, 0.26, 0.34, tuft, seg=10, ring=7)


def stripes(col, faces=("top", "x", "-x", "back"), n=3, w=0.2, length=None):
    """Flat stripes over the top and down the sides and back."""
    for k in range(n):
        o = (k - (n - 1) / 2) * (S * 0.7 / max(n - 1, 1))
        if "top" in faces:
            flat(o, 0.1, TOP, w, length or S * 0.7, 0.06, col)
        for s_ in (-1, 1):
            if ("x" if s_ > 0 else "-x") in faces:
                flat(s_ * S / 2, 0.1 + o, CZ + 0.15, 0.06, w, length or S * 0.6, col)
        if "back" in faces:
            flat(o, S / 2, CZ + 0.15, w, 0.06, length or S * 0.6, col)


# -------------------------------------------------------------- cats, in coats
def cat_base(coat, stripe=None, muzzle=(1.0, 0.96, 0.9), feet_c=(1.0, 0.96, 0.9), whisk=DARK, eye_back=None, ear_c=None,
             ear_in=PINK, tail_c=None, patches=(), chest=None, mask=None, nose=PINK):
    die(coat)
    feet(feet_c)
    if stripe:
        stripes(stripe)
        flat(0, FRONT, front_z(0.72), 0.2, 0.06, 0.4, stripe)
    for (x, y, z, w, d, h, col) in patches:
        flat(x, y, z, w, d, h, col, b=min(w, d, h) * 0.45 if min(w, d, h) > 0.07 else 0.15)
    if chest:
        flat(0, FRONT, front_z(-0.6), 1.2, 0.06, 0.6, chest, b=0.25)
    if mask:  # the Siamese points: a soft dark mask round the muzzle
        box(0, FRONT - 0.01, front_z(-0.02), 1.1, 0.04, 0.85, mask, bevel=0.3, segs=3)
    eyes(v=0.3, cheek_v=0.06)
    if eye_back:
        eye_backs(eye_back)
    box(0, FRONT - 0.05, front_z(-0.06), 0.72, 0.12, 0.4, muzzle, bevel=0.12, segs=2)
    nose_tri(front_z(0.04), nose)
    w_mouth(front_z(-0.1), y=FRONT - 0.13, w=0.15)
    for s_ in (-1, 1):
        for dz in (-0.05, 0.05):
            box(s_ * 0.58, FRONT - 0.12, front_z(-0.04) + dz, 0.4, 0.02, 0.025, whisk,
                rot=(0, s_ * math.radians(8) * (1 if dz > 0 else -1), 0))
    pl = pointy_ear(-1, "l", ear_c or coat, ear_in)
    pr = pointy_ear(1, "r", ear_c or coat, ear_in)
    tc = tail_c or (coat, stripe or coat)
    with group("tail"):
        t = tail_at(-0.4)
        pts = [t + Vector((0.0, 0.08 + 0.3 * math.sin(a), 0.6 * a)) for a in [i * 0.25 for i in range(6)]]
        for i, (p0, p1) in enumerate(zip(pts, pts[1:])):
            limb(p0, p1, 0.08, tc[i % 2])
    return {"ear_l": pl, "ear_r": pr, "tail": tail_at(-0.4)}


def cat():
    return cat_base((1.0, 0.58, 0.22), stripe=(0.86, 0.38, 0.12))


def cat_grey():
    return cat_base((0.64, 0.65, 0.7), stripe=(0.42, 0.43, 0.48), muzzle=(0.98, 0.98, 0.98), feet_c=(0.98, 0.98, 0.98))


def cat_black():
    BLACK = (0.17, 0.16, 0.19)
    return cat_base(BLACK, muzzle=(0.3, 0.29, 0.33), feet_c=BLACK, whisk=(0.95, 0.95, 0.95), eye_back=(0.86, 0.92, 0.36),
                    ear_in=(0.86, 0.5, 0.6), tail_c=(BLACK, BLACK))


def cat_tuxedo():
    BLACK, WHITE_ = (0.17, 0.16, 0.19), (0.99, 0.98, 0.97)
    p = cat_base(BLACK, muzzle=WHITE_, feet_c=WHITE_, whisk=(0.95, 0.95, 0.95), eye_back=(0.86, 0.92, 0.36),
                 chest=WHITE_, tail_c=(BLACK, BLACK))
    flat(0, FRONT, front_z(-0.12), 0.9, 0.06, 0.5, WHITE_, b=0.22)  # the white lower face
    return p


def cat_calico():
    WHITE_, ORANGE, BLACK = (0.99, 0.97, 0.94), (0.98, 0.58, 0.22), (0.2, 0.18, 0.2)
    patches = [(0.45, -0.2, TOP, 0.8, 0.7, 0.06, ORANGE), (-0.4, 0.45, TOP, 0.7, 0.8, 0.06, BLACK),
               (S / 2, 0.3, CZ + 0.3, 0.06, 0.9, 0.7, ORANGE), (-S / 2, -0.1, CZ + 0.2, 0.06, 0.8, 0.8, BLACK),
               (-S / 2, 0.6, CZ - 0.4, 0.06, 0.6, 0.5, ORANGE), (0.2, S / 2, CZ + 0.1, 0.9, 0.06, 0.8, BLACK),
               (-0.55, FRONT, front_z(0.68), 0.6, 0.06, 0.45, ORANGE), (0.6, FRONT, front_z(0.76), 0.5, 0.06, 0.32, BLACK)]
    return cat_base(WHITE_, patches=patches, tail_c=(ORANGE, BLACK), ear_c=None)


def cat_siamese():
    CREAM, POINT = (0.98, 0.92, 0.8), (0.42, 0.3, 0.24)
    return cat_base(CREAM, muzzle=(0.62, 0.48, 0.4), feet_c=POINT, eye_back=(0.62, 0.84, 1.0), ear_c=POINT, ear_in=(0.86, 0.6, 0.6),
                    tail_c=(POINT, POINT), mask=POINT, whisk=(0.95, 0.95, 0.95), nose=(0.3, 0.2, 0.18))


# -------------------------------------------------------------- owls, four ways
def owl_base(coat, wing, disc, chest, beak_kind, beak_c, tufts=True, speck=None, heart=False, eye_back=None):
    p = bird(coat, beak_c, (1.0, 0.72, 0.25), wing=wing, eye_v=0.3, eye_gap=0.22, eye_r=0.2, beak_v=0.04, beak_shape="none")
    if heart:  # a barn owl's heart-shaped face
        for s_ in (-1, 1):
            can(s_ * 0.42, FRONT - 0.005, front_z(0.36), 0.52, 0.04, disc, n=24, rot=X90)
        can(0, FRONT - 0.006, front_z(-0.12), 0.62, 0.04, disc, n=3, r2=0.0, rot=(math.radians(90), 0, math.radians(180)))
    else:
        for s_ in (-1, 1):
            can(s_ * S * 0.22, FRONT - 0.005, front_z(0.3), 0.38, 0.04, disc, n=20, rot=X90)
    if eye_back:
        eye_backs(eye_back, k=1.3)
    if chest:
        flat(0, FRONT, front_z(-0.58), 1.1, 0.06, 0.55, chest, b=0.2)
    bz = front_z(0.06)
    if beak_kind == "nub":  # a tiny soft round beak
        ball(0, FRONT - 0.07, bz, 0.2, 0.16, 0.22, beak_c, seg=10, ring=7)
    elif beak_kind == "drop":  # a little rounded drop pointing down
        teardrop(0, FRONT - 0.06, bz - 0.02, 0.26, beak_c, depth=0.6, tilt=180)
    elif beak_kind == "line":  # drawn: a small V
        stroke([(-0.09, bz + 0.08), (0, bz - 0.06), (0.09, bz + 0.08)], FRONT - 0.03, 0.03, beak_c)
    for x, y, z in (speck or ()):
        if abs(x) >= S / 2 - 1e-6:
            flat(x, y, z, 0.06, 0.12, 0.1, wing, b=0.03)
        elif abs(y) >= S / 2 - 1e-6:
            flat(x, y, z, 0.12, 0.06, 0.1, wing, b=0.03)
        else:
            flat(x, y, z, 0.12, 0.1, 0.06, wing, b=0.03)
    if tufts:
        for s_, tag in ((-1, "tl"), (1, "tr")):
            pointy_ear(s_, tag, coat, wing, z=0.7, y=-0.35, w=0.36, h=0.46, out=16)
            _parts.pop(f"ear_{tag}")  # ungrouped, so they join the body
    return p


def owl():
    return owl_base((0.6, 0.42, 0.28), (0.44, 0.3, 0.2), (0.94, 0.84, 0.66), (0.98, 0.9, 0.74), "nub", (1.0, 0.8, 0.3))


def owl_barn():
    return owl_base((0.86, 0.66, 0.42), (0.6, 0.5, 0.42), (1.0, 0.98, 0.95), None, "drop", (0.92, 0.72, 0.62), tufts=False,
                    heart=True, speck=[(0.4, 0.2, TOP), (-0.3, -0.3, TOP), (S / 2, 0.3, CZ + 0.4), (-S / 2, -0.2, CZ + 0.5)])


# -------------------------------------------------------------- raccoon, again
# -------------------------------------------------------------- the wild ones
def elephant():
    GREY, GREY_D, PINK_IN, TUSK = (0.66, 0.68, 0.78), (0.54, 0.56, 0.66), (0.94, 0.72, 0.78), (1.0, 0.98, 0.92)
    die(GREY)
    feet(GREY_D)
    eyes(v=0.4, cheek_v=0.16)
    with group("nose"):  # the trunk: down the front, curling forward at the tip
        pts = [Vector((0, FRONT - 0.05, front_z(0.12)))] + [Vector((0, FRONT - 0.12 - 0.05 * k * k, front_z(0.02 - 0.2 * k))) for k in range(1, 5)]
        pts.append(pts[-1] + Vector((0, -0.18, 0.06)))
        for i, (p0, p1) in enumerate(zip(pts, pts[1:])):
            limb(p0, p1, 0.2 - 0.02 * i, GREY, n=12)
            ball(*p1, 0.4 - 0.04 * i, 0.4 - 0.04 * i, 0.4 - 0.04 * i, GREY, seg=12, ring=8)
        for k in range(1, 4):  # trunk wrinkles
            box(0, pts[k].y - 0.2 + 0.02 * k, pts[k].z, 0.26 - 0.03 * k, 0.03, 0.03, GREY_D)
    for s_ in (-1, 1):  # little tusks
        can(s_ * 0.32, FRONT - 0.12, front_z(-0.3), 0.06, 0.26, TUSK, n=8, r2=0.02, rot=(math.radians(70), 0, 0))
    for s_, tag in ((-1, "l"), (1, "r")):  # big flapping ears
        with group(f"ear_{tag}"):
            ball(s_ * (S / 2 + 0.06), -0.25, CZ + 0.1, 0.16, 1.3, 1.3, GREY, seg=16, ring=10)
            ball(s_ * (S / 2 + 0.13), -0.3, CZ + 0.08, 0.04, 0.95, 0.95, PINK_IN, seg=14, ring=9)
    tuft_tail(tail_at(0.0), (0.2, 1, -0.6), 0.5, GREY, GREY_D)
    return {"ear_l": Vector((-S / 2, -0.25, CZ + 0.5)), "ear_r": Vector((S / 2, -0.25, CZ + 0.5)), "tail": tail_at(0.0)}


def koala():
    GREY, FLUFF, NOSE = (0.62, 0.63, 0.67), (0.97, 0.97, 0.97), (0.22, 0.2, 0.24)
    die(GREY)
    feet((0.48, 0.48, 0.52))
    flat(0, FRONT, front_z(-0.6), 1.0, 0.06, 0.5, FLUFF, b=0.2)
    eyes(v=0.3, gap=0.26, r=0.15, cheek_v=0.04)
    with group("nose"):  # the big oval nose
        box(0, FRONT - 0.1, front_z(0.0), 0.36, 0.2, 0.5, NOSE, bevel=0.15, segs=3)
    w_mouth(front_z(-0.3), w=0.14)
    pl = round_ear(-1, "l", GREY, FLUFF, r=0.44, y=-0.2)
    pr = round_ear(1, "r", GREY, FLUFF, r=0.44, y=-0.2)
    return {"ear_l": pl, "ear_r": pr}


def penguin():
    BLACK, WHITE_, ORANGE = (0.16, 0.17, 0.22), (0.99, 0.99, 0.98), (1.0, 0.6, 0.15)
    p = bird(BLACK, ORANGE, ORANGE, wing=BLACK, eye_v=0.3, eye_gap=0.2, beak_v=0.08)
    # the white face and belly on the front, round at the top
    for s_ in (-1, 1):
        can(s_ * 0.35, FRONT + 0.004, front_z(0.42), 0.48, 0.02, WHITE_, n=24, rot=X90)
    box(0, FRONT + 0.004, front_z(-0.3), 1.6, 0.02, 1.25, WHITE_, bevel=0.009, segs=1)
    return p


def frog():
    GREEN, GREEN_D, BELLY = (0.42, 0.8, 0.32), (0.3, 0.64, 0.22), (0.86, 0.96, 0.62)
    die(GREEN)
    feet(GREEN_D)
    flat(0, FRONT, front_z(-0.42), 1.4, 0.06, 0.8, BELLY, b=0.2)
    for s_ in (-1, 1):  # the eye bumps on the front top corners
        ball(s_ * 0.5, FRONT + 0.22, TOP - 0.42, 0.78, 0.74, 0.72, GREEN, seg=14, ring=10)
    eyes(v=0.56, gap=0.25, r=0.2, cheek_v=0.2)
    for tag in ("l", "r"):
        for o in _parts.get(f"eye_{tag}", []):
            o.location.y -= 0.17
    for e in EYES:
        e[1] -= 0.17
    for s_ in (-1, 1):
        box(s_ * 0.1, FRONT - 0.03, front_z(0.12), 0.06, 0.04, 0.05, GREEN_D)  # nostrils
    w_mouth(front_z(-0.02), w=0.26)
    for s_, tag in ((-1, "l"), (1, "r")):  # little round ears behind the eye bumps
        with group(f"ear_{tag}"):
            ball(s_ * (S / 2 + 0.04), -0.15, TOP - 0.42, 0.2, 0.4, 0.38, GREEN, seg=12, ring=8)
            ball(s_ * (S / 2 + 0.09), -0.17, TOP - 0.42, 0.06, 0.24, 0.22, BELLY, seg=10, ring=6)
    return {"ear_l": Vector((-S / 2, -0.15, TOP - 0.42)), "ear_r": Vector((S / 2, -0.15, TOP - 0.42))}


def cheeks_on_top(y=FRONT - 0.045):
    """Pink cheeks drawn in front of a mask or face plate."""
    for x, _, z, r in EYES:
        ball(math.copysign(S * 0.33, x), y, z - 0.24, 0.34, 0.1, 0.18, PINK, seg=10, ring=4)


def raccoon():
    GREY, DARKR, LIGHT = (0.64, 0.64, 0.68), (0.2, 0.19, 0.22), (0.97, 0.96, 0.97)
    die(GREY)
    feet(DARKR)
    box(0, FRONT - 0.005, front_z(0.3), S * 0.9, 0.05, 0.46, DARKR, bevel=0.2, segs=2)
    can(0, FRONT - 0.008, front_z(0.12), 0.24, 0.05, DARKR, n=3, r2=0.0, rot=(math.radians(90), 0, math.radians(180)))
    flat(0, FRONT, front_z(0.72), 0.18, 0.06, 0.4, DARKR)
    for s_ in (-1, 1):
        flat(s_ * 0.52, FRONT, front_z(0.66), 0.46, 0.06, 0.16, LIGHT, b=0.06)
    eyes(v=0.3, cheeks=False)
    eye_backs(LIGHT, k=1.5)
    cheeks_on_top()
    box(0, FRONT - 0.07, front_z(-0.18), 0.82, 0.16, 0.42, LIGHT, bevel=0.12, segs=2)
    nose_box(front_z(-0.06), w=0.22, h=0.15)
    w_mouth(front_z(-0.22), y=FRONT - 0.16, w=0.14)
    pl = round_ear(-1, "l", GREY, LIGHT, r=0.3)
    pr = round_ear(1, "r", GREY, LIGHT, r=0.3)
    ringed_tail(Vector((S / 2 - 0.2, S / 2 - 0.1, BOTTOM + 0.35)),
                [(0, 0, 0), (0.35, 0.05, 0.05), (0.62, -0.25, 0.15), (0.75, -0.65, 0.32), (0.7, -1.05, 0.58), (0.55, -1.3, 0.9)],
                0.2, (GREY, DARKR))
    return {"ear_l": pl, "ear_r": pr, "tail": Vector((S / 2 - 0.2, S / 2 - 0.1, BOTTOM + 0.35))}


def skunk():
    BLACK, WHITE_ = (0.17, 0.16, 0.2), (0.99, 0.99, 0.98)
    die(BLACK)
    feet(BLACK)
    # the markings: a stripe up the forehead that splits in two down the back
    flat(0, FRONT, front_z(0.68), 0.3, 0.06, 0.62, WHITE_, b=0.1)
    flat(0, -0.72, TOP, 0.42, 0.56, 0.06, WHITE_, b=0.14)
    for s_ in (-1, 1):
        flat(s_ * 0.42, 0.25, TOP, 0.28, 1.5, 0.06, WHITE_, b=0.12)
        flat(s_ * 0.42, S / 2, TOP - 0.4, 0.28, 0.06, 0.8, WHITE_, b=0.12)
    eyes(v=0.3, cheeks=False)
    eye_backs((0.9, 0.9, 0.94), k=1.3)
    cheeks_on_top(y=FRONT - 0.03)
    box(0, FRONT - 0.06, front_z(-0.1), 0.6, 0.14, 0.36, (0.32, 0.31, 0.36), bevel=0.1, segs=2)
    nose_box(front_z(0.0), rgb=(0.92, 0.6, 0.66), y=FRONT - 0.15, w=0.18, h=0.12)
    w_mouth(front_z(-0.16), y=FRONT - 0.14, w=0.13, rgb=(0.9, 0.9, 0.92))
    pl = round_ear(-1, "l", BLACK, (0.5, 0.4, 0.46), r=0.2)
    pr = round_ear(1, "r", BLACK, (0.5, 0.4, 0.46), r=0.2)
    with group("tail"):  # a big plume: one smooth curve up behind the back, a white stripe down its middle
        base = Vector((S / 2 - 0.45, S / 2 + 0.02, BOTTOM + 0.35))  # up beside the back right corner, so it shows
        n = 6  # few, soft-shaded balls: still one continuous plume at a third of the triangles
        for i in range(n + 1):
            u = i / n
            p_ = base + Vector((0.32 * math.sin(math.pi * u * 0.6), 0.16 * math.sin(math.pi * u * 0.8), 1.9 * u - 0.25 * u * u))
            r = 0.36 + 0.34 * math.sin(math.pi * min(1.0, u * 1.1))
            ball(p_.x, p_.y, p_.z, r * 1.25, r, r, BLACK, seg=10, ring=7)
            ball(p_.x + r * 0.5, p_.y - r * 0.1, p_.z, r * 0.3, r * 0.5, r * 1.5, WHITE_, seg=8, ring=5)  # stripe on the outside
    return {"ear_l": pl, "ear_r": pr, "tail": Vector((S / 2 - 0.45, S / 2 + 0.02, BOTTOM + 0.35))}


def lion():
    """The sheep's shape language: a blocky mane framing the face and running
    back over the front half like a hood."""
    COAT, MANE, MANE_D, FACE, MUZ = (0.97, 0.78, 0.42), (0.86, 0.5, 0.2), (0.76, 0.4, 0.16), (0.99, 0.86, 0.58), (1.0, 0.95, 0.84)
    die(COAT)
    feet(COAT)
    # the mane: four chunky blocks along each edge of the face, and one row of matching blocks right
    # behind them wrapping over the top and down the sides, attached and lined up
    P = (-0.79, -0.265, 0.265, 0.79)
    ring = [(x, 0.79) for x in P] + [(x, -0.79) for x in P] + [(s_ * 0.79, z) for s_ in (-1, 1) for z in (-0.265, 0.265)]
    for k, (x, z) in enumerate(ring):
        box(x, FRONT - 0.14, CZ + z, 0.5, 0.38, 0.5, MANE if k % 2 else MANE_D, bevel=0.15, segs=2)
    for k, x in enumerate(P):  # over the top
        box(x, FRONT + 0.32, TOP - 0.1, 0.5, 0.62, 0.42, MANE_D if k % 2 else MANE, bevel=0.15, segs=2)
    for s_ in (-1, 1):  # down the sides
        for k, z in enumerate(P):
            box(s_ * (S / 2 + 0.02), FRONT + 0.32, CZ + z, 0.4, 0.62, 0.5, MANE if (k + (s_ > 0)) % 2 else MANE_D, bevel=0.15, segs=2)
    box(0, FRONT - 0.03, CZ - 0.02, 1.36, 0.1, 1.3, FACE, bevel=0.12, segs=2)
    eyes(v=0.24, gap=0.18, r=0.16, cheek_v=0.0)
    for tag in ("l", "r"):
        for o in _parts.get(f"eye_{tag}", []):
            o.location.y -= 0.06
    for e in EYES:
        e[1] -= 0.06
    box(0, FRONT - 0.12, front_z(-0.2), 0.6, 0.12, 0.34, MUZ, bevel=0.1, segs=2)
    nose_tri(front_z(-0.08), (0.66, 0.36, 0.32), y=FRONT - 0.2, r=0.1)
    w_mouth(front_z(-0.26), y=FRONT - 0.19, w=0.13)
    pl = round_ear(-1, "l", COAT, MANE, r=0.22, y=-0.05, z=TOP - 0.02)
    pr = round_ear(1, "r", COAT, MANE, r=0.22, y=-0.05, z=TOP - 0.02)
    tuft_tail(tail_at(-0.2), (0.3, 1, 0.5), 0.75, COAT, MANE_D)
    return {"ear_l": pl, "ear_r": pr, "tail": tail_at(-0.2)}


def tiger():
    COAT, BLACK, WHITE_ = (0.98, 0.56, 0.16), (0.16, 0.13, 0.12), (1.0, 0.98, 0.95)
    die(COAT)
    feet(WHITE_)
    stripes(BLACK, n=2, w=0.32)  # a few bold stripes
    for x, h in ((-0.32, 0.3), (0.0, 0.42), (0.32, 0.3)):
        flat(x, FRONT, TOP - h / 2 - 0.08, 0.16, 0.06, h, BLACK, b=0.06)
    for s_ in (-1, 1):
        flat(s_ * 0.52, FRONT, front_z(-0.45), 0.8, 0.06, 0.5, WHITE_, b=0.2)
    eyes(v=0.3, cheek_v=0.06)
    box(0, FRONT - 0.07, front_z(-0.12), 0.7, 0.14, 0.4, WHITE_, bevel=0.12, segs=2)
    nose_tri(front_z(0.0), PINK, y=FRONT - 0.16, r=0.11)
    w_mouth(front_z(-0.18), y=FRONT - 0.15, w=0.14)
    pl = round_ear(-1, "l", COAT, WHITE_, r=0.24)
    pr = round_ear(1, "r", COAT, WHITE_, r=0.24)
    ringed_tail(tail_at(-0.3), [(0, 0, 0), (0.1, 0.3, 0.2), (0.15, 0.45, 0.55), (0.1, 0.42, 0.9)], 0.11, (COAT, BLACK))
    return {"ear_l": pl, "ear_r": pr, "tail": tail_at(-0.3)}


def zebra():
    WHITE_, BLACK = (0.99, 0.99, 0.98), (0.14, 0.13, 0.15)
    die(WHITE_)
    feet(BLACK)
    stripes(BLACK, faces=("top", "x", "-x", "back"), n=3, w=0.28)  # fewer, bolder stripes
    for x in (-0.18, 0.0, 0.18):
        box(x, FRONT - 0.05, TOP - 0.18, 0.2, 0.12, 0.34, BLACK, bevel=0.06)  # forelock
    for x in (-0.46, 0.46):
        flat(x, FRONT, front_z(0.72), 0.16, 0.06, 0.32, BLACK, b=0.06)
    eyes(v=0.3, cheek_v=0.06)
    mz = front_z(-0.12)
    box(0, FRONT - 0.08, mz, 0.85, 0.2, 0.45, (0.26, 0.25, 0.28), bevel=0.1, segs=2)
    for s_ in (-1, 1):
        flat(s_ * 0.19, FRONT - 0.19, mz + 0.03, 0.1, 0.04, 0.14, (0.5, 0.48, 0.52), b=0.03)
    w_mouth(mz - 0.11, y=FRONT - 0.19, w=0.15, rgb=(0.85, 0.85, 0.88))
    pl = pointy_ear(-1, "l", WHITE_, (0.9, 0.9, 0.92), tip=BLACK, out=30)
    pr = pointy_ear(1, "r", WHITE_, (0.9, 0.9, 0.92), tip=BLACK, out=30)
    tuft_tail(tail_at(0.2), (0.15, 1, -0.7), 0.55, WHITE_, BLACK)
    return {"ear_l": pl, "ear_r": pr, "tail": tail_at(0.2)}


def giraffe():
    COAT, SPOT, MUZ, HORN = (0.99, 0.8, 0.38), (0.72, 0.44, 0.2), (0.99, 0.92, 0.74), (0.62, 0.38, 0.2)
    die(COAT)
    feet(SPOT)
    # an even pattern: the same rounded patch, the same spacing, raised a touch
    P, G = 0.44, 0.62
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            box(i * G, j * G, TOP + 0.01, P, P, 0.08, SPOT, bevel=0.1, segs=2)
            for s_ in (-1, 1):
                box(s_ * (S / 2 + 0.01), i * G, CZ + j * G, 0.08, P, P, SPOT, bevel=0.1, segs=2)
            box(i * G, S / 2 + 0.01, CZ + j * G, P, 0.08, P, SPOT, bevel=0.1, segs=2)
    for x in (-G, G):
        box(x, FRONT - 0.01, CZ + G, P, 0.08, P * 0.8, SPOT, bevel=0.1, segs=2)
    eyes(v=0.3, cheek_v=0.06)
    box(0, FRONT - 0.07, front_z(-0.14), 0.86, 0.16, 0.48, MUZ, bevel=0.14, segs=2)
    for s_ in (-1, 1):
        flat(s_ * 0.18, FRONT - 0.15, front_z(-0.06), 0.1, 0.04, 0.12, SPOT, b=0.03)
    w_mouth(front_z(-0.24), y=FRONT - 0.15, w=0.15)
    for s_ in (-1, 1):
        b0 = Vector((s_ * (S / 2 - 0.1), -0.15, TOP - 0.2))
        b1 = b0 + Vector((s_ * 0.24, 0, 0.42))
        limb(b0, b1, 0.08, COAT)
        ball(*b1, 0.22, 0.22, 0.22, HORN, seg=10, ring=7)
    side_ears(COAT, PINK, length=0.44, width=0.24, z=0.42, droop=-15)
    tuft_tail(tail_at(0.1), (0.15, 1, -0.7), 0.55, COAT, SPOT)
    return {**ear_pivots(0.42), "tail": tail_at(0.1)}


def panda():
    WHITE_, BLACK = (0.99, 0.99, 0.98), (0.15, 0.15, 0.17)
    die(WHITE_)
    feet(BLACK)
    for s_ in (-1, 1):
        flat(s_ * S / 2, 0.0, BOTTOM + 0.42, 0.06, S * 0.9, 0.8, BLACK, b=0.2)
    flat(0, S / 2, BOTTOM + 0.42, S * 0.9, 0.06, 0.8, BLACK, b=0.2)
    flat(0, 0.25, TOP, S * 0.95, 0.5, 0.06, BLACK, b=0.2)
    eyes(v=0.3, cheeks=False)
    for (x, y, z, r), s_ in zip(EYES, (-1, 1)):  # eye patches slanting down and outward
        ball(x + s_ * 0.05, FRONT + 0.02, z - 0.05, 0.62, 0.1, 0.46, BLACK, seg=16, ring=8, rot=(0, s_ * math.radians(30), 0))
    eye_backs((0.94, 0.94, 0.96), k=1.25)
    cheeks_on_top(y=FRONT - 0.03)
    nose_box(front_z(-0.06), w=0.24, h=0.15, y=FRONT - 0.06)
    w_mouth(front_z(-0.2), y=FRONT - 0.04, w=0.15)
    pl = round_ear(-1, "l", BLACK, (0.3, 0.3, 0.33))
    pr = round_ear(1, "r", BLACK, (0.3, 0.3, 0.33))
    return {"ear_l": pl, "ear_r": pr}


def moose():
    COAT, MUZ, ANT, DARKM = (0.44, 0.3, 0.21), (0.58, 0.42, 0.3), (0.92, 0.82, 0.62), (0.26, 0.18, 0.13)
    die(COAT)
    feet(DARKM)
    eyes(v=0.36, cheek_v=0.12)
    mz = front_z(-0.3)
    box(0, FRONT - 0.22, mz, 1.0, 0.5, 0.66, MUZ, bevel=0.2, segs=2)
    for s_ in (-1, 1):
        ball(s_ * 0.2, FRONT - 0.47, mz + 0.08, 0.14, 0.06, 0.18, DARKM, seg=8, ring=5)
    w_mouth(mz - 0.2, y=FRONT - 0.48, w=0.15)
    ball(0, FRONT + 0.02, BOTTOM + 0.12, 0.3, 0.26, 0.36, COAT, seg=8, ring=6)
    # antlers: one graphic shape each side: a paddle with three tines growing out of its top edge,
    # all on one plane and leaning up together; close to the head and forward
    for s_ in (-1, 1):
        th = math.radians(-s_ * 8)
        base = Vector((s_ * (S / 2 - 0.12), -0.5, TOP - 0.42))

        def at(lx, lz):
            x = s_ * lx
            return base + Vector((x * math.cos(th) + lz * math.sin(th), 0, -x * math.sin(th) + lz * math.cos(th)))
        a, b = at(0.0, 0.0), at(0.2, 0.08)
        limb(a, b, 0.1, ANT)
        pc = at(0.48, 0.16)
        box(pc.x, pc.y, pc.z, 0.66, 0.16, 0.32, ANT, bevel=0.12, segs=2, rot=(0, th, 0))
        for lx in (0.28, 0.48, 0.68):
            tp = at(lx, 0.4)
            box(tp.x, tp.y, tp.z, 0.15, 0.16, 0.3, ANT, bevel=0.06, segs=2, rot=(0, th, 0))
    side_ears(COAT, (0.7, 0.55, 0.45), length=0.42, width=0.26, z=0.36, droop=-25, y=-0.05)
    with group("tail"):
        ball(0, S / 2 + 0.08, front_z(0.2), 0.22, 0.2, 0.26, COAT, seg=8, ring=6)
    return {**ear_pivots(0.36, y=-0.05), "tail": tail_at(0.2)}


def monkey():
    COAT, FACE, MUZ, DARKM = (0.54, 0.35, 0.22), (0.99, 0.84, 0.68), (0.99, 0.76, 0.6), (0.42, 0.26, 0.18)
    die(COAT)
    feet(FACE)
    # one clean heart-shaped face (like the barn owl's), with a little muzzle standing out of it
    for s_ in (-1, 1):
        can(s_ * 0.38, FRONT - 0.005, front_z(0.3), 0.46, 0.04, FACE, n=28, rot=X90)
    can(0, FRONT - 0.006, front_z(-0.18), 0.7, 0.04, FACE, n=3, r2=0.0, rot=(math.radians(90), 0, math.radians(180)))
    eyes(v=0.3, gap=0.19, cheek_v=0.06)
    box(0, FRONT - 0.08, front_z(-0.22), 0.66, 0.16, 0.38, MUZ, bevel=0.14, segs=2)
    for s_ in (-1, 1):
        flat(s_ * 0.08, FRONT - 0.16, front_z(-0.12), 0.06, 0.04, 0.07, DARKM, b=0.02)
    w_mouth(front_z(-0.28), y=FRONT - 0.16, w=0.13)
    for x, h, lean in ((-0.14, 0.28, 18), (0.0, 0.36, 0), (0.14, 0.28, -18)):  # a little hair tuft
        box(x, FRONT + 0.12, TOP - 0.02 + h * 0.3, 0.14, 0.14, h, COAT, bevel=0.05, rot=(0, math.radians(lean), 0))
    for s_, tag in ((-1, "l"), (1, "r")):  # big round ears at eye level
        with group(f"ear_{tag}"):
            can(s_ * (S / 2 + 0.06), -0.25, front_z(0.3), 0.4, 0.12, COAT, n=24, rot=(0, math.radians(90), 0))
            can(s_ * (S / 2 + 0.13), -0.25, front_z(0.3), 0.27, 0.04, FACE, n=24, rot=(0, math.radians(90), 0))
    with group("tail"):  # a curly tail up the side, so it shows
        t = Vector((S / 2 - 0.3, S / 2, BOTTOM + 0.4))
        pts = [t + Vector((0.3 + 0.25 * math.sin(a), 0.1 + 0.2 * math.cos(a) * 0.3, 0.22 * a)) for a in [i * 0.6 for i in range(11)]]
        for p0, p1 in zip(pts, pts[1:]):
            limb(p0, p1, 0.075, COAT)
    return {"ear_l": Vector((-S / 2, -0.25, front_z(0.3))), "ear_r": Vector((S / 2, -0.25, front_z(0.3))),
            "tail": Vector((S / 2 - 0.3, S / 2, BOTTOM + 0.4))}


def hippo():
    COAT, MUZ, DARKH, TOOTH = (0.62, 0.56, 0.74), (0.8, 0.7, 0.84), (0.4, 0.34, 0.46), (1.0, 0.98, 0.94)
    die(COAT)
    feet(DARKH)
    eyes(v=0.58, cheek_v=0.36)
    mz = front_z(-0.12)  # the muzzle sits up high
    box(0, FRONT - 0.24, mz, 1.6, 0.56, 0.76, MUZ, bevel=0.24, segs=2)
    for s_ in (-1, 1):
        ball(s_ * 0.36, FRONT - 0.3, mz + 0.38, 0.2, 0.16, 0.08, DARKH, seg=10, ring=5)
        box(s_ * 0.36, FRONT - 0.53, mz - 0.28, 0.14, 0.04, 0.16, TOOTH, bevel=0.04)
    pl = round_ear(-1, "l", COAT, MUZ, r=0.2)
    pr = round_ear(1, "r", COAT, MUZ, r=0.2)
    tuft_tail(tail_at(-0.1), (0.1, 1, -0.4), 0.3, COAT, DARKH)
    return {"ear_l": pl, "ear_r": pr, "tail": tail_at(-0.1)}


def crocodile():
    GREEN, GREEN_D, BELLY, TOOTH = (0.38, 0.64, 0.3), (0.26, 0.48, 0.2), (0.82, 0.9, 0.56), (1.0, 0.99, 0.95)
    die(GREEN)
    feet(GREEN_D)
    sz = front_z(-0.1)  # the long snout, up high now (it still takes the cell in front)
    box(0, FRONT - 0.5, sz, 1.5, 1.0, 0.56, GREEN, bevel=0.18, segs=2)
    box(0, FRONT - 0.5, sz - 0.24, 1.36, 0.9, 0.1, BELLY, bevel=0.04)
    for s_ in (-1, 1):
        for k in range(4):
            can(s_ * 0.7, FRONT - 0.2 - 0.22 * k, sz - 0.3, 0.05, 0.14, TOOTH, n=4, r2=0.0, rot=(math.radians(180), 0, 0))
        ball(s_ * 0.24, FRONT - 0.88, sz + 0.28, 0.2, 0.2, 0.14, GREEN_D, seg=8, ring=5)
        ball(s_ * 0.52, FRONT + 0.18, TOP - 0.3, 0.66, 0.6, 0.56, GREEN, seg=14, ring=9)
    eyes(v=0.68, gap=0.26, r=0.17, cheeks=False)
    for s_ in (-1, 1):  # cheeks on the face between the eye bumps and the snout
        ball(s_ * 0.6, FRONT - 0.03, CZ + 0.3, 0.34, 0.1, 0.16, PINK, seg=10, ring=4)
    for tag in ("l", "r"):
        for o in _parts.get(f"eye_{tag}", []):
            o.location.y -= 0.12
    for e in EYES:
        e[1] -= 0.12
    for i in range(3):
        for x in (-0.4, 0.4):
            box(x, -0.3 + 0.55 * i, TOP + 0.03, 0.22, 0.3, 0.1, GREEN_D, bevel=0.04)
    with group("tail"):
        t = tail_at(-0.3)
        box(t.x, t.y + 0.4, t.z - 0.1, 0.8, 0.8, 0.5, GREEN, bevel=0.2, segs=2)
    return {"tail": tail_at(-0.3)}


# -------------------------------------------------------------- bears
def bear_base(coat, muzzle, feet_c, ear_in, nose=DARK, eye_back=None, extra=None):
    die(coat)
    feet(feet_c)
    eyes(v=0.3, cheeks=eye_back is None, cheek_v=0.06)
    if eye_back:
        eye_backs(eye_back, k=1.3)
        cheeks_on_top(y=FRONT - 0.03)
    box(0, FRONT - 0.08, front_z(-0.12), 0.8, 0.18, 0.46, muzzle, bevel=0.14, segs=2)
    nose_box(front_z(0.0), rgb=nose, w=0.26, h=0.16, y=FRONT - 0.19)
    w_mouth(front_z(-0.2), y=FRONT - 0.18, w=0.15)
    pl = round_ear(-1, "l", coat, ear_in)
    pr = round_ear(1, "r", coat, ear_in)
    if extra:
        extra()
    with group("tail"):
        ball(0, S / 2 + 0.1, front_z(-0.3), 0.3, 0.26, 0.3, coat, seg=10, ring=7)
    return {"ear_l": pl, "ear_r": pr, "tail": tail_at(-0.3)}


def bear():
    return bear_base((0.56, 0.36, 0.22), (0.86, 0.7, 0.52), (0.42, 0.26, 0.16), (0.86, 0.7, 0.52))


def bear_black():
    return bear_base((0.2, 0.19, 0.22), (0.82, 0.66, 0.48), (0.14, 0.13, 0.15), (0.42, 0.38, 0.4), eye_back=(0.86, 0.8, 0.72))


def bear_polar():
    return bear_base((0.98, 0.97, 0.94), (1.0, 1.0, 0.99), (0.9, 0.88, 0.84), (0.9, 0.86, 0.82))


def bear_sun():
    GOLD = (0.99, 0.8, 0.42)

    def crescent():  # the golden chest patch
        ball(0, FRONT + 0.005, front_z(-0.72), 1.05, 0.06, 0.34, GOLD, seg=24, ring=10)
    return bear_base((0.22, 0.19, 0.2), GOLD, (0.16, 0.14, 0.15), (0.45, 0.4, 0.4), eye_back=(0.9, 0.84, 0.74), extra=crescent)


def bear_teddy():
    HONEY, MUZ, PATCH, RED = (0.88, 0.64, 0.38), (0.99, 0.9, 0.72), (0.96, 0.82, 0.6), (0.88, 0.2, 0.26)

    def stitches():
        # a seam down the forehead, a stitched patch on one side, a bow tie
        stroke([(0, front_z(0.88)), (0, front_z(0.56))], FRONT - 0.03, 0.022, (0.5, 0.34, 0.2))
        for z in (0.82, 0.72, 0.62):
            stroke([(-0.06, front_z(z)), (0.06, front_z(z))], FRONT - 0.03, 0.018, (0.5, 0.34, 0.2))
        box(S / 2 + 0.01, 0.3, CZ + 0.2, 0.06, 0.6, 0.55, PATCH, bevel=0.03)
        for k in range(4):
            box(S / 2 + 0.04, 0.3 - 0.27 + 0.18 * k, CZ + 0.2 + 0.3, 0.02, 0.06, 0.03, (0.5, 0.34, 0.2))
        for s_ in (-1, 1):
            box(s_ * 0.18, FRONT - 0.06, front_z(-0.72), 0.32, 0.1, 0.24, RED, bevel=0.06, rot=(0, s_ * math.radians(14), 0))
        ball(0, FRONT - 0.09, front_z(-0.72), 0.16, 0.14, 0.16, (0.74, 0.14, 0.2), seg=8, ring=6)
    return bear_base(HONEY, MUZ, (0.72, 0.5, 0.3), MUZ, extra=stitches)


def turtle():
    """The whole die is the shell; a little head pokes out of the front."""
    SKIN, SHELL, PLATE, RIM = (0.74, 0.86, 0.46), (0.36, 0.6, 0.3), (0.5, 0.74, 0.38), (0.56, 0.42, 0.24)
    die(SHELL)
    feet(SKIN)
    box(0, 0, BOTTOM + 0.42, S + 0.14, S + 0.14, 0.2, (0.24, 0.44, 0.22), bevel=0.09, segs=2)  # the shell's lip
    can(0, 0, TOP + 0.02, 0.4, 0.06, PLATE, n=6)
    for k in range(6):
        a = math.radians(30 + 60 * k)
        can(0.68 * math.cos(a), 0.68 * math.sin(a), TOP + 0.01, 0.25, 0.05, PLATE, n=6)
    for s_ in (-1, 1):
        for y, z in ((-0.5, 0.25), (0.15, 0.25), (-0.18, -0.3), (0.5, -0.3)):
            can(s_ * (S / 2 + 0.01), y, CZ + z, 0.22, 0.04, PLATE, n=6, rot=(0, math.radians(90), 0))
    for x, z in ((-0.5, 0.25), (0.15, 0.25), (-0.18, -0.3), (0.5, -0.3)):
        can(x, S / 2 + 0.01, CZ + z, 0.22, 0.04, PLATE, n=6, rot=(math.radians(90), 0, 0))
    for x in (-0.62, 0.62):
        can(x, FRONT - 0.01, CZ + 0.45, 0.22, 0.04, PLATE, n=6, rot=(math.radians(90), 0, 0))
    # the head: a soft block poking out of the front, low; the face is on it
    hz, hw, hd = front_z(-0.28), 1.3, 0.62
    box(0, FRONT - hd / 2 + 0.1, hz, hw, hd, 0.95, SKIN, bevel=0.3, segs=3)
    shift = -(hd - 0.1)  # the face sits on the head's front, this far out from the die's front
    eyes(v=-0.18, gap=0.16, r=0.15, cheeks=False)
    for tag in ("l", "r"):
        for o in _parts.get(f"eye_{tag}", []):
            o.location.y += shift
    for e in EYES:
        e[1] += shift
    for x, y, z, r in EYES:
        ball(math.copysign(0.42, x), y + 0.04, z - 0.2, 0.26, 0.08, 0.14, PINK, seg=10, ring=4)
    w_mouth(front_z(-0.5), y=FRONT + shift - 0.03, w=0.13)
    with group("tail"):
        can(0, S / 2 + 0.12, front_z(-0.6), 0.1, 0.3, SKIN, n=8, r2=0.02, rot=(math.radians(-90), 0, 0))
    return {"tail": tail_at(-0.6)}


ANIMALS = {"cow": cow, "pig": pig, "sheep": sheep, "horse": horse, "donkey": donkey, "goat": goat,
           "chicken": chicken, "hen": hen, "rooster": rooster, "chick": chick, "duck": mallard, "goose": goose, "turkey": turkey,
           "bunny": bunny, "cat": cat, "cat_grey": cat_grey, "cat_black": cat_black, "cat_tuxedo": cat_tuxedo,
           "cat_calico": cat_calico, "cat_siamese": cat_siamese, "dog": dog, "mouse": mouse, "frog": frog, "fox": fox,
           "owl": owl, "owl_barn": owl_barn, "raccoon": raccoon,
           "hedgehog": hedgehog, "turtle": turtle, "skunk": skunk, "lion": lion, "tiger": tiger, "bear": bear, "bear_black": bear_black, "bear_polar": bear_polar, "bear_sun": bear_sun,
           "bear_teddy": bear_teddy, "panda": panda,
           "moose": moose, "elephant": elephant, "giraffe": giraffe, "zebra": zebra, "monkey": monkey, "koala": koala,
           "penguin": penguin, "hippo": hippo, "crocodile": crocodile}


# -------------------------------------------------------------- nodes
def join(objs, name, pivot, bake=True):
    objs = [o for o in objs if o.type == "MESH" and o.name in bpy.data.objects]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        for m in list(o.modifiers):
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    bpy.context.scene.cursor.location = Vector(pivot)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    o.name = o.data.name = name
    o.rotation_mode = "QUATERNION"
    if bake:
        bake_colors(o)
    return o


def bake_colors(o):
    """A part in several colours: paint each face's colour into the mesh and
    swap its materials for one shared vertex-colour material, so the node
    draws in one call instead of one per colour. Single-colour parts keep their
    own material, so a game still tints them by setting its colour."""
    me = o.data
    if len(me.materials) < 2:
        return
    cols = [m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value[:] for m in me.materials]
    attr = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    data = [0.0] * (len(me.loops) * 4)
    for p in me.polygons:
        c = cols[p.material_index]
        for li in p.loop_indices:
            data[li * 4:li * 4 + 4] = c
    attr.data.foreach_set("color", data)
    me.materials.clear()
    me.materials.append(vertex_color_mat())


def vertex_color_mat():
    m = bpy.data.materials.get("colors")
    if not m:
        m = bpy.data.materials.new("colors")
        m.use_backface_culling = True
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        bsdf.inputs["Roughness"].default_value = 0.9
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    return m


EAR_AXIS = ["y"]
HIDE = Vector((1e-3, 1e-3, 1e-3))  # hidden face parts are scaled to (almost) nothing
TONGUE = (1.0, 0.45, 0.55)
C = Vector((0, 0, CZ))           # the cube centre at rest
EYE_KINDS = ("happy", "line", "x", "spiral")   # the drawn eyes that replace the open eyes
FACE_NODES = ("eye_l", "eye_r", "brow_l", "brow_r") + tuple(f"{k}_{t}" for k in EYE_KINDS for t in ("l", "r")) + \
             ("mouth_smile", "mouth_oh", "mouth_grin", "mouth_sad", "mouth_wavy", "sweat", "nose")
HIDDEN_AT_REST = ("brow_l", "brow_r") + tuple(f"{k}_{t}" for k in EYE_KINDS for t in ("l", "r")) + \
                 ("mouth_oh", "mouth_grin", "mouth_sad", "mouth_wavy", "sweat")
NOSE_UP = 0.08  # how far the nose rises when the mouth opens into an 'oh'


def teardrop(x, y, z, h, rgb, depth=0.45, tilt=-14):
    """A smooth teardrop: a round bottom tapering into one soft point, as one
    mesh (a lathe of r = sin t * sin(t / 2)), flattened front to back, with a
    little white shine."""
    import bmesh
    rings, segs = 10, 12
    verts, faces = [], []
    w = h * 0.58
    for i in range(rings + 1):
        t = math.pi * i / rings  # 0: the point (top), pi: the bottom
        rad = w * math.sin(t) * math.sin(t / 2) ** 1.4
        zz = h * 0.5 * math.cos(t)
        for j in range(segs):
            a = 2 * math.pi * j / segs
            verts.append((rad * math.cos(a), rad * math.sin(a) * depth, zz))
    for i in range(rings):
        for j in range(segs):
            a, b = i * segs + j, i * segs + (j + 1) % segs
            faces.append((a, b, b + segs, a + segs))
    me = bpy.data.meshes.new("drop")
    me.from_pydata(verts, [], faces)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # outward, for backface culling
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("drop", me)
    bpy.context.scene.collection.objects.link(o)
    o.location = (x, y, z)
    o.rotation_euler = (0, math.radians(tilt), 0)
    finish(o, rgb)
    for poly in me.polygons:
        poly.use_smooth = True
    # the shine: a small white fleck on the round part
    ball(x - h * 0.1, y - h * 0.5 * depth * 0.55, z - h * 0.1, h * 0.12, h * 0.05, h * 0.18, WHITE, seg=8, ring=6)
    return o


def side_of(tag):
    return -1 if tag == "l" else 1


def face_parts():
    """Brows, happy '^' eyes and the extra mouths, built next to the eyes and
    smile. They are hidden at rest; expressions show and move them."""
    piv = {}
    for (x, y, z, r), tag in zip(EYES, ("l", "r")):
        piv[f"eye_{tag}"] = Vector((x, y, z))
        with group(f"brow_{tag}"):
            box(x, y - 0.05, z + r * 1.7, r * 1.6, 0.05, 0.075, DARK, bevel=0.025)
        piv[f"brow_{tag}"] = Vector((x, y - 0.05, z + r * 1.7))
        ey = y - 0.05
        lw = 0.04
        with group(f"happy_{tag}"):  # a closed happy eye: ^, joined at the peak
            stroke([(x - r * 0.75, z - r * 0.3), (x, z + r * 0.38), (x + r * 0.75, z - r * 0.3)], ey, lw)
        with group(f"line_{tag}"):  # a sleepy closed eye: a soft line, dipping a little
            stroke([(x - r * 0.8, z + r * 0.08), (x - r * 0.3, z - r * 0.12), (x + r * 0.3, z - r * 0.12), (x + r * 0.8, z + r * 0.08)], ey, lw)
        with group(f"x_{tag}"):  # an X eye
            stroke([(x - r * 0.6, z - r * 0.6), (x + r * 0.6, z + r * 0.6)], ey, lw)
            stroke([(x - r * 0.6, z + r * 0.6), (x + r * 0.6, z - r * 0.6)], ey, lw)
        with group(f"spiral_{tag}"):  # a dizzy spiral eye
            n = 22
            stroke([(x + r * (0.08 + 1.05 * i / n) * math.cos(i * 0.6 * -side_of(tag)),
                     z + r * (0.08 + 1.05 * i / n) * math.sin(i * 0.6 * -side_of(tag))) for i in range(n + 1)], ey, 0.022)
        for n_ in ("happy", "line", "x", "spiral"):
            piv[f"{n_}_{tag}"] = Vector((x, ey, z))
    if MOUTH:
        z, y, w = MOUTH[0]
        piv["mouth_smile"] = Vector((0, y, z))
        with group("mouth_oh"):
            o = can(0, y - 0.01, z + 0.01, max(w * 0.42, 0.075), 0.05, DARK, n=14, rot=X90)
            o.scale = (1, 1.3, 1)
        with group("mouth_grin"):
            box(0, y - 0.01, z, w * 1.5, 0.05, w * 0.8, DARK, bevel=w * 0.3, segs=2)
            box(0, y - 0.04, z - w * 0.18, w * 0.8, 0.03, w * 0.3, TONGUE, bevel=w * 0.12, segs=2)
        with group("mouth_sad"):
            w_shape(z - w * 0.05, y, w, flip=True)
        with group("mouth_wavy"):  # a wobbly scared zigzag
            k = 6
            stroke([(-w * 1.1 + 2.2 * w * i / k, z + (w * 0.22 if i % 2 else -w * 0.12)) for i in range(k + 1)], y, max(w * 0.1, 0.022))
        for n in ("mouth_oh", "mouth_grin", "mouth_sad", "mouth_wavy"):
            piv[n] = Vector((0, y, z))
    if EYES:  # a sweat drop beside the face, by the right eye
        x, y, z, r = EYES[1]
        sx, sz = x + r * 2.0, z + r * 0.9
        with group("sweat"):
            teardrop(sx, y - 0.07, sz, 0.36, (0.52, 0.82, 1.0))
        piv["sweat"] = Vector((sx, y - 0.06, sz))
    return piv


def build(animal):
    _parts.clear()
    EYES.clear()
    MOUTH.clear()
    before = set(bpy.data.objects)
    piv = ANIMALS[animal]()
    EAR_AXIS[0] = piv.pop("ear_axis", "y")
    piv.update(face_parts())
    if _parts.get("nose"):
        ns = _parts["nose"]
        piv["nose"] = sum((o.location for o in ns), Vector()) / len(ns)
    allnew = [o for o in bpy.data.objects if o not in before]
    grouped = {o for objs in _parts.values() for o in objs}
    _parts["body"] = [o for o in allnew if o not in grouped]
    piv["body"] = Vector((0, 0, BOTTOM))
    piv.update(FEET)
    root = bpy.data.objects.new("root", None)
    bpy.context.scene.collection.objects.link(root)
    root.rotation_mode = "QUATERNION"
    nodes = {"root": root}
    for name in tuple(FEET) + ("body",) + FACE_NODES + ("ear_l", "ear_r", "tail"):
        if _parts.get(name):
            nodes[name] = join(_parts[name], name, piv[name])
    rest = {}
    for n, o in nodes.items():
        if n == "root":
            continue
        par = "root" if n == "body" or n.startswith("foot_") else "body"
        o.parent = nodes[par]
        o.matrix_parent_inverse = Matrix()
        rest[n] = piv[n] - (piv[par] if par != "root" else Vector())
        o.location = rest[n]
        if n in HIDDEN_AT_REST:
            o.scale = HIDE
    return nodes, rest


# -------------------------------------------------------------- motion helpers
def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def ease_in(t):
    t = min(max(t, 0.0), 1.0)
    return t * t


def ease_out(t):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) * (1 - t)


def seg(t, a, b):
    """0..1 progress of t through [a, b)."""
    return min(max((t - a) / (b - a), 0.0), 1.0)


def T(v):
    return Matrix.Translation(Vector(v))


def about(p, m):
    return T(p) @ m @ T(-Vector(p))


def rq(axis, deg):
    return Quaternion(Vector(axis), math.radians(deg))


# points that can touch the ground: the cube corners and the feet corners
_CUBE_PTS = [Vector((x, y, z)) for x in (-S / 2, S / 2) for y in (-S / 2, S / 2) for z in (BOTTOM, TOP)]
_GROUND_PTS = _CUBE_PTS + [Vector((x, y, 0.0)) for x in (-0.8, 0.8) for y in (-0.8, 0.8)]


def fit(q, lift=0.0, dx=0.0, dy=0.0):
    """Rotate the die about its centre, then drop it so its lowest corner
    touches the ground (so a tilted die rests on an edge or a corner)."""
    m = about(C, q.to_matrix().to_4x4())
    low = min((m @ p).z for p in _GROUND_PTS)
    return T((dx, dy, lift - low)) @ m


def hop_curve(t, h=0.9, sq=0.16):
    """One bounce, t 0..1: (lift, squash). Squash > 0 is flatter, < 0 taller."""
    if t < 0.18:
        k = ease(t / 0.18)
        return 0.0, sq * k
    if t < 0.78:
        k = (t - 0.18) / 0.6
        return h * math.sin(math.pi * k), sq * (1 - min(1, k * 4)) - 0.1 * math.sin(math.pi * min(1, k * 1.6))
    k = (t - 0.78) / 0.22
    return 0.0, sq * 1.1 * math.sin(math.pi * k) * (1 - k * 0.3)


# -------------------------------------------------------------- expressions
EXPR = {  # eye (sx, sz), eyes (open | happy | line | x | spiral), brow (raise, tilt: + worried / - cross), mouth, sweat, look (dx, dz)
    "neutral": dict(),
    "playful": dict(mouth="grin"),
    "scared": dict(eye=(0.7, 0.7), brow=(0.13, 30), mouth="wavy", sweat=True),
    "surprised": dict(eye=(1.08, 1.22), brow=(0.06, 20), mouth="oh"),
    "happy": dict(eyes="happy", mouth="grin"),
    "excited": dict(eye=(1.1, 1.12), brow=(0.08, -4), mouth="grin"),
    "oof": dict(eyes="x", brow=(-0.02, -16), mouth="oh"),
    "dizzy": dict(eyes="spiral", brow=(0.02, 16), mouth="wavy"),
    "sleepy": dict(eyes="line"),
    "sad": dict(eye=(1.0, 0.88), brow=(0.03, 24), mouth="sad", look=(0.0, -0.05)),
}


def face_trs(rest, p):
    """Local TRS of every face node for pose p."""
    e = dict(EXPR[p.get("expr", "neutral")])
    e.update(p.get("face", {}))
    sx, sz = e.get("eye", (1.0, 1.0))
    sz *= p.get("blink", 1.0)
    lx, lz = p.get("look", e.get("look", (0.0, 0.0)))
    kind = e.get("eyes", "open")
    brow = e.get("brow")
    mouth = e.get("mouth", "smile")
    one = Vector((1, 1, 1))
    out = {}
    for tag, side in (("l", -1), ("r", 1)):
        out[f"eye_{tag}"] = (rest[f"eye_{tag}"] + Vector((lx, 0, lz)), Quaternion(),
                             Vector((sx, 1, max(sz, 0.02))) if kind == "open" else HIDE)
        for k in EYE_KINDS:
            spin = rq((0, 1, 0), side * p.get("eye_spin", 0.0)) if k == "spiral" else Quaternion()
            out[f"{k}_{tag}"] = (rest[f"{k}_{tag}"], spin, one if k == kind else HIDE)
        if brow:
            out[f"brow_{tag}"] = (rest[f"brow_{tag}"] + Vector((0, 0, brow[0])), rq((0, 1, 0), side * brow[1]), one)
        else:
            out[f"brow_{tag}"] = (rest[f"brow_{tag}"], Quaternion(), HIDE)
    for m in ("smile", "oh", "grin", "sad", "wavy"):
        out[f"mouth_{m}"] = (rest.get(f"mouth_{m}"), Quaternion(), one if m == mouth else HIDE)
    out["sweat"] = (rest.get("sweat"), Quaternion(), one if e.get("sweat") else HIDE)
    if rest.get("nose") is not None:
        out["nose"] = (rest["nose"] + Vector((0, 0, NOSE_UP if mouth == "oh" else 0.0)), Quaternion(), one)
    return out


# -------------------------------------------------------------- clips
# Each clip is a function of t (0..1) returning a pose dict:
#   M: the die's rigid transform (world), from fit() or an explicit pivot roll
#   squash: flatten (+) / stretch (-) about the ground under the die (only applied while it sits flat)
#   expr, blink, look, face: the face
#   ears: target ear angle in degrees (+ perked up, - drooped); ears_direct: (l, r) set exactly, no spring
#   tail: tail swing in degrees
def c_idle(t):
    sq = 0.02 * math.sin(2 * math.pi * t)
    look = (-0.045, 0.0) if 0.18 < t < 0.36 else (0.045, 0.0) if 0.74 < t < 0.88 else (0.0, 0.0)
    return dict(M=fit(Quaternion()), squash=sq, blink=1 - 0.95 * max(0.0, 1 - abs(t - 0.6) / 0.04), look=look,
                ears=22 if 0.4 < t < 0.45 else 0, tail=12 * math.sin(4 * math.pi * t))


def c_waggle(t):
    a = 28 * math.sin(4 * math.pi * t)
    return dict(M=fit(rq((0, 1, 0), 4 * math.sin(4 * math.pi * t))), expr="playful", ears_direct=(a, -a),
                tail=20 * math.sin(8 * math.pi * t))


class Roller:
    """A die tipping over its leading bottom edge, a quarter turn at a time.
    Each tip accelerates like a fall, the face slams flat (squash), rocks
    back a touch and settles, then tips again."""

    def __init__(self, axis, tips=4, tip_frames=(13, 11, 11, 12), hold=6, lead=8, tail=22):
        self.axis = Vector(axis)                      # world rotation axis for a tip
        self.dirv = self.axis.cross(Vector((0, 0, 1)))  # travel direction (a + turn about the axis tips the top this way)
        self.tips, self.tip_frames, self.hold, self.lead, self.tail = tips, tip_frames, hold, lead, tail
        self.n = lead + sum(tip_frames[:tips]) + hold * (tips - 1) + tail
        # precompute the rest matrix after every tip, and each tip's pivot edge
        self.mats, self.pivots = [fit(Quaternion())], []
        for k in range(tips):
            m = self.mats[-1]
            pts = [m @ p for p in _CUBE_PTS]
            lead_d = max(p.dot(self.dirv) for p in pts)
            pivot = self.dirv * lead_d
            self.pivots.append(pivot)
            nxt = about(pivot, Matrix.Rotation(math.radians(90), 4, self.axis)) @ m
            if k == 0:  # the first tip starts up on the feet: drop the feet height so every tip is one cube
                nxt = T(-self.dirv * BOTTOM + Vector((0, 0, 0))) @ nxt
            if k == tips - 1:  # the last tip lands back on the feet
                nxt = T((0, 0, BOTTOM)) @ nxt
            self.mats.append(nxt)

    def __call__(self, t):
        f = t * self.n
        if f < self.lead:  # lean back onto the trailing edge, then go
            u = f / self.lead
            back = Matrix.Rotation(math.radians(-7 * math.sin(math.pi * u)), 4, self.axis)
            pts = [self.mats[0] @ p for p in _CUBE_PTS]
            trail = self.dirv * min(p.dot(self.dirv) for p in pts)
            return dict(M=about(trail, back) @ self.mats[0], expr="surprised" if u > 0.4 else "neutral", ears=-10)
        f -= self.lead
        for k in range(self.tips):
            d = self.tip_frames[k]
            if f < d:  # tipping, faster and faster
                u = f / d
                ang = 90 * ease_in(u)
                m = about(self.pivots[k], Matrix.Rotation(math.radians(ang), 4, self.axis)) @ self.mats[k]
                if k == 0:
                    m = T(-self.dirv * BOTTOM * ease_in(u)) @ m
                if k == self.tips - 1:
                    m = T((0, 0, BOTTOM * ease_in(u))) @ m
                return dict(M=m, expr="scared", ears=-18)
            f -= d
            last = k == self.tips - 1
            h = self.tail if last else self.hold
            if f < h:  # slam flat, rock back, settle
                u = f / h
                m = self.mats[k + 1]
                if last:
                    sq = 0.2 * math.sin(math.pi * seg(u, 0, 0.25)) - 0.06 * math.sin(math.pi * seg(u, 0.25, 0.5))
                    expr = "oof" if u < 0.15 else "dizzy" if u < 0.7 else "neutral"
                    return dict(M=m, squash=sq, expr=expr, blink=1 - 0.95 * max(0.0, 1 - abs(u - 0.82) / 0.05))
                if u < 0.45:
                    return dict(M=m, squash=0.13 * math.sin(math.pi * u / 0.45), expr="scared", ears=-18)
                v = (u - 0.45) / 0.55
                rock = Matrix.Rotation(math.radians(-5 * math.sin(math.pi * v)), 4, self.axis)
                pts = [m @ p for p in _CUBE_PTS]
                trail = self.dirv * min(p.dot(self.dirv) for p in pts)
                return dict(M=about(trail, rock) @ m, expr="scared", ears=-18)
            f -= h
        return dict(M=self.mats[-1], expr="neutral")




# -------------------------------------------------------------- weight
# The roll's rules for every clip: moves accelerate into a contact (gravity),
# a contact is a hard stop with the squash peaking at once, edges land first
# and the die slaps flat, and rocks are small and die out fast.
def impact(f, f0, amp, tau=2.4, w=1.05):
    """Squash from a hit at frame f0: peaks at once, overshoots into a little
    stretch, settles."""
    if f < f0:
        return 0.0
    d = f - f0
    return amp * math.exp(-d / tau) * math.cos(d * w)


def arc(f, f0, f1, h):
    """A ballistic hop between frames f0 and f1: slows to the top, speeds into the ground."""
    if f <= f0 or f >= f1:
        return 0.0
    u = (f - f0) / (f1 - f0)
    return 4 * h * u * (1 - u)


def launch(f, f0, f1, amp=0.12):
    """Stretch on take-off, easing out as it rises."""
    if f < f0 or f >= f1:
        return 0.0
    return -amp * (1 - (f - f0) / (f1 - f0))


def c_hop(t):
    n = 26
    f = t * n
    sq = 0.15 * ease(f / 4) if f < 4 else launch(f, 4, 10) + impact(f, 18, 0.22)
    return dict(M=fit(Quaternion(), arc(f, 4, 18, 0.95)), squash=sq, tail=25 * arc(f, 4, 18, 1.0))


def rock(f, f0, f1, deg):
    """Up onto an edge (slowing) and back down (speeding into the clunk)."""
    u = (f - f0) / (f1 - f0)
    return deg * (ease_out(u / 0.5) if u < 0.5 else 1 - ease_in((u - 0.5) / 0.5))


def c_tap(t):
    n = 22
    f = t * n
    sq = 0.17 * ease(f / 2) if f < 2 else launch(f, 2, 6, 0.1) + impact(f, 11, 0.18)
    return dict(M=fit(Quaternion(), arc(f, 2, 11, 0.38)), squash=sq, expr="happy" if f < 17 else "neutral", ears=12)


def c_happy(t):
    n = 50
    f = t * n
    if f < 3:
        sq = 0.13 * ease(f / 3)
    elif f < 16:
        sq = launch(f, 3, 8) + impact(f, 15, 0.2)
    elif f < 20:
        sq = impact(f, 15, 0.2) + 0.16 * ease((f - 16) / 4)
    else:
        sq = launch(f, 20, 26) + impact(f, 38, 0.24)
    z = arc(f, 3, 15, 0.7) + arc(f, 20, 38, 1.15)
    spin = 360 * ease(seg(f, 22, 36))
    return dict(M=fit(rq((0, 0, 1), spin), z), squash=sq, expr="happy", ears=15, tail=30 * math.sin(f * 0.8))


def c_excited(t):
    n = 46
    f = t * n
    z = arc(f, 2, 9, 0.38) + arc(f, 12, 19, 0.38) + arc(f, 25, 40, 1.3)
    sq = 0.0
    if f < 2:
        sq = 0.12 * ease(f / 2)
    elif f < 12:
        sq = launch(f, 2, 5, 0.1) + impact(f, 9, 0.16) + (0.12 * ease((f - 10) / 2) if f >= 10 else 0)
    elif f < 21:
        sq = launch(f, 12, 15, 0.1) + impact(f, 19, 0.16)
    elif f < 25:  # wind up for the big one
        sq = impact(f, 19, 0.16) + 0.2 * ease((f - 21) / 4)
    else:
        sq = launch(f, 25, 31, 0.15) + impact(f, 40, 0.26)
    twist = 360 * ease(seg(f, 26, 38))
    return dict(M=fit(rq((0, 0, 1), twist), z), squash=sq, expr="excited", ears=26, tail=30 * math.sin(f * 0.9))


def c_sleep(t):
    """Fast asleep and still enough to sleep in a stack: it stays flat on its
    base, breathing slowly and gently, ears relaxed, with one short little
    snore and a tiny ear twitch per loop."""
    a = 2 * math.pi * t
    sq = 0.014 * math.sin(a * 2)          # two slow breaths per loop
    snore = 0.3 < t < 0.4
    twitch = 10 * max(0.0, 1 - abs(t - 0.75) / 0.02)
    return dict(M=fit(Quaternion()), squash=sq, expr="sleepy", face={"mouth": "oh"} if snore else {}, ears=-14 + twitch)


# -------------------------------------------------------------- spin: start, loop, end
Q_CORNER = Vector((1, 1, 1)).normalized().rotation_difference(Vector((0, 0, 1)))
SPIN_W = 30.0      # degrees per frame at full speed
SPIN_LOOP = 24     # the loop: two turns
SPIN_WOB = 2.0     # the little wobble while it spins


def top(ang, wob, f_axis):
    """The die balanced on a corner, turned `ang` about the vertical, with a
    wobble whose axis precesses once per loop."""
    k = 2 * math.pi * f_axis / SPIN_LOOP
    return rq((0, 0, 1), ang) @ rq((math.cos(k), math.sin(k), 0), wob) @ Q_CORNER


def c_spin_start(t):
    """Wind up (crouch, counter-twist), pop onto a corner and build speed."""
    n = 38
    f = t * n
    if f < 10:
        u = f / 10
        return dict(M=fit(rq((0, 0, 1), -60 * ease(u))), squash=0.17 * ease(u), expr="excited", ears=10)
    ang = -60 + SPIN_W * (f - 10) ** 2 / (2 * 28)   # speeds up from 0 to full over 28 frames: ends on 360
    if f < 20:  # up onto the corner
        u = (f - 10) / 10
        q = rq((0, 0, 1), ang) @ Quaternion().slerp(Q_CORNER, ease(u))
        return dict(M=fit(q, 0.55 * math.sin(math.pi * u)), squash=launch(f, 10, 15, 0.12), expr="excited", ears=22)
    wob = SPIN_WOB * ease(seg(f, 20, 26))
    return dict(M=fit(top(ang, wob, f - n)), expr="happy", ears=25)


def c_spin_loop(t):
    f = t * SPIN_LOOP
    return dict(M=fit(top(SPIN_W * f, SPIN_WOB, f)), expr="happy", ears=25)


# -------------------------------------------------------------- clatter
# A die settling on a table: clack, clack, tk-tk-tk. Each rock lifts one
# bottom edge (slowing), drops back (speeding into the clunk) and the next one
# goes the other way, smaller and quicker.
DROP_CLATTER = [((0, 1, 0), 5.5, 5), ((1, 0, 0), -3.6, 4), ((0, 1, 0), -2.3, 3), ((1, 0, 0), 1.4, 3), ((0, 1, 0), 0.8, 2),
                ((1, 0, 0), -0.4, 2)]
LIGHT_CLATTER = [((1, 0, 0), -3.5, 4), ((0, 1, 0), 2.2, 3), ((1, 0, 0), 1.2, 3), ((0, 1, 0), -0.6, 2)]


def clatter(f, f0, seq=DROP_CLATTER, base=None):
    """Pose for frame f of a clatter starting at f0 (after the main slam).
    Returns (quaternion, squash); the squash is the little clunk of every
    contact. `base` is the resting orientation (default upright)."""
    base = base or Quaternion()
    t = f - f0
    q = Quaternion()
    contacts = []
    c = f0
    for axis, deg, d in seq:
        c += d
        contacts.append((c, abs(deg)))
    acc = 0
    for axis, deg, d in seq:
        if 0 <= t - acc < d:
            q = rq(axis, rock(t - acc + f0, f0, f0 + d, deg))
            break
        acc += d
    sq = sum(impact(f, cf, 0.012 * a + 0.01, tau=1.4, w=1.3) for cf, a in contacts)
    return base @ q, sq


def clatter_len(seq=DROP_CLATTER):
    return sum(d for _, _, d in seq)


def c_squish(t):
    """Something lands on top: one big squash, held, then a jelly wobble out
    (wider, taller, side to side), settling."""
    n = 44
    f = t * n
    jel = (0.0, 0.0)
    if f < 2:
        sq = 0.38 * ease_out(f / 2)
    elif f < 12:
        sq = 0.36
    else:
        d = f - 12
        env = math.exp(-d / 6.0)
        sq = 0.36 * env * math.cos(d * 0.62)
        jel = (0.07 * env * math.sin(d * 0.62 + 0.4), -0.07 * env * math.sin(d * 0.62 + 0.4))
    expr = "oof" if f < 14 else "surprised" if f < 22 else "neutral"
    return dict(M=fit(Quaternion()), squash=sq, jelly=jel, expr=expr, ears=-28 if f < 13 else 0,
                blink=1 - 0.95 * max(0.0, 1 - abs(f - 36) / 1.5))


# -------------------------------------------------------------- teeter: in, loop, out
def teeter_q(t):
    a = 2 * math.pi * t
    tilt = 24 + 6 * math.sin(a) + 2.5 * math.sin(3 * a + 0.7)
    return rq((0, 1, 0), tilt) @ rq((1, 0, 0), 2.5 * math.sin(2 * a)) @ rq((0, 0, 1), 1.2 * math.sin(9 * a))


def teeter_ears(t):
    flail = 24 * math.sin(16 * math.pi * t)
    return (flail - 10, -flail - 10)


def c_teeter_loop(t):
    """Balanced on one bottom edge, tipped right over, wobbling and catching itself."""
    return dict(M=fit(teeter_q(t)), expr="scared", ears_direct=teeter_ears(t), look=(0.05, -0.02), tail=20 * math.sin(12 * math.pi * t))


def c_teeter_in(t):
    """Gets tipped: up onto the edge, overshoots, catches itself."""
    n = 30
    f = t * n
    end = teeter_q(0.0)
    if f < 6:
        return dict(M=fit(Quaternion()), expr="surprised", ears=10)
    if f < 18:  # tips up, slowing as it gets there
        u = (f - 6) / 12
        return dict(M=fit(rq((0, 1, 0), 32 * ease_out(u))), expr="scared", ears_direct=(-10 - 20 * u, -10 - 20 * u))
    u = (f - 18) / 12  # nearly over! then back to the balance point
    q = rq((0, 1, 0), 32).slerp(end, ease(u))
    return dict(M=fit(q), expr="scared", ears_direct=tuple(e * ease(u) - 30 * (1 - ease(u)) for e in teeter_ears(0.0)), look=(0.05 * u, -0.02 * u))


# -------------------------------------------------------------- walk, run, jump
QUAD_FEET = {"foot_fl": ("l", "f"), "foot_fr": ("r", "f"), "foot_bl": ("l", "b"), "foot_br": ("r", "b")}
BIRD_FEET = {"foot_l": ("l", "f"), "foot_r": ("r", "f")}


def steps(t, lift, swing):
    """Foot offsets (dy, dz) for a two-step cycle: one side steps (lifts, swings
    forward), the other is planted and slides back. Diagonal pairs for four feet."""
    out = {}
    for name, (side, end) in list(QUAD_FEET.items()) + list(BIRD_FEET.items()):
        first = (side == "l") == (end == "f") if name in QUAD_FEET else side == "l"
        ph = (t + (0.0 if first else 0.5)) % 1.0
        if ph < 0.5:  # swinging forward, in the air
            u = ph / 0.5
            out[name] = (swing * math.cos(math.pi * u), lift * math.sin(math.pi * u))
        else:  # planted, sliding back under the body
            u = (ph - 0.5) / 0.5
            out[name] = (-swing * math.cos(math.pi * u), 0.0)
    return out


def c_walk(t):
    """A waddle: the die rocks onto one side's edge while the other side's feet step."""
    a = 2 * math.pi * t
    rockq = rq((0, 1, 0), 5 * math.sin(a)) @ rq((1, 0, 0), 3) @ rq((0, 0, 1), 3 * math.sin(a))
    bob = 0.07 * abs(math.sin(a))
    sq = -0.03 * abs(math.sin(a)) + 0.05 * max(0.0, math.cos(2 * a)) ** 8
    return dict(M=fit(rockq, bob), squash=sq, feet=steps(t, 0.14, 0.3), tail=15 * math.sin(a))


def c_spin(t):
    """The whole spin in one clip: start, two loops, end."""
    n = 38 + 2 * SPIN_LOOP + 76
    f = t * n
    if f < 38:
        return c_spin_start(f / 38)
    f -= 38
    if f < 2 * SPIN_LOOP:
        return c_spin_loop((f % SPIN_LOOP) / SPIN_LOOP)
    return c_spin_end((f - 2 * SPIN_LOOP) / 76)


class RollIn:
    """Thrown in like a die onto a table: it flies in tumbling, hits, rolls on
    fast with a clack at every face, slows on the last tip, clatters and
    stops on its spot (the origin) facing front."""

    def __init__(self, axis=(1, 0, 0), tips=4, air=12, tip_frames=(5, 5, 6, 9), settle=24):
        self.r = Roller(axis, tips=tips, tip_frames=tip_frames, hold=0, lead=0, tail=1)
        self.air, self.tip_frames, self.settle = air, tip_frames, settle
        end = self.r.mats[-1].translation.copy()
        end.z = 0
        self.shift = T(-end)                 # so the roll ends on the origin
        self.n = air + sum(tip_frames) + settle

    def __call__(self, t):
        f = t * self.n
        r = self.r
        if f < self.air:  # flying in from behind and above, spinning a full turn
            u = f / self.air
            back = -r.dirv * 4.0 * (1 - u)
            m = T(back + Vector((0, 0, 2.8 * (1 - u * u)))) @ about(C, Matrix.Rotation(math.radians(360 * u), 4, r.axis))
            return dict(M=self.shift @ m, expr="surprised", ears=20)
        f -= self.air
        contact = self.air
        for k, d in enumerate(self.tip_frames):
            if f < d:  # momentum: an even turn, a little hop off every face
                u = f / d
                last = k == len(self.tip_frames) - 1
                ang = 90 * (ease_in(u) if last else u)
                m = about(r.pivots[k], Matrix.Rotation(math.radians(ang), 4, r.axis)) @ r.mats[k]
                if k == 0:
                    m = T(-r.dirv * BOTTOM * u) @ m
                if last:
                    m = T((0, 0, BOTTOM * ease_in(u))) @ m
                hop = 0.0 if last else 0.12 * math.sin(math.pi * u) * (1 - k * 0.3)
                return dict(M=self.shift @ T((0, 0, hop)) @ m, expr="scared", ears=-15)
            f -= d
            contact += d
        q, sq = clatter(f, 0, DROP_CLATTER)
        sq += impact(f, 0, 0.22)
        m = T(r.mats[-1].translation) @ fit(q)
        m.translation.z = fit(q).translation.z
        expr = "oof" if f < 3 else "dizzy" if f < 18 else "neutral"
        return dict(M=self.shift @ m, squash=sq, expr=expr)



# -------------------------------------------------------------- settles
def jelly_settle(f, f0, amp):
    """The squish settle: a squash at the contact that wobbles out like jelly
    (flatter, taller, wider one way then the other), fading."""
    if f < f0:
        return 0.0, (0.0, 0.0)
    d = f - f0
    env = math.exp(-d / 5.5)
    j = 0.2 * amp * env * math.sin(d * 0.62 + 0.4)
    return amp * env * math.cos(d * 0.62), (j, -j)


def settles(f, hits):
    """Sum of jelly settles for [(frame, amp), ...]."""
    sq, jx, jy = 0.0, 0.0, 0.0
    for f0, a in hits:
        s_, (x, y) = jelly_settle(f, f0, a)
        sq, jx, jy = sq + s_, jx + x, jy + y
    return sq, (jx, jy)


BIG_CLATTER = [((0, 1, 0), 8.0, 8), ((1, 0, 0), -3.0, 6)]


def c_drop(t):
    """A long fall, a corner hits, it slams flat, one big clatter rock and a
    smaller one, then a jelly settle."""
    n = 56
    f = t * n
    tilt = lambda k: rq((1, 0, 0), 11 + 3 * k) @ rq((0, 1, 0), -15 - 4 * k)
    if f < 13:
        u = f / 13
        return dict(M=fit(tilt(u), 5.0 * (1 - u * u)), squash=-0.08 * u, expr="surprised", ears=12)
    if f < 16:
        u = (f - 13) / 3
        return dict(M=fit(tilt(1).slerp(Quaternion(), ease_in(u))), expr="oof")
    q, _ = clatter(f, 17, BIG_CLATTER)
    sq, jel = settles(f, [(16, 0.26), (25, 0.07), (31, 0.12)])
    expr = "oof" if f < 25 else "dizzy" if f < 33 else "neutral"
    return dict(M=fit(q), squash=sq, jelly=jel, expr=expr, blink=1 - 0.95 * max(0.0, 1 - abs(f - 42) / 1.5))


def c_land(t):
    n = 30
    f = t * n
    if f < 11:
        u = f / 11
        return dict(M=fit(rq((1, 0, 0), 7), 3.0 * (1 - u * u)), squash=-0.06 * u, expr="surprised")
    if f < 13:
        u = (f - 11) / 2
        return dict(M=fit(rq((1, 0, 0), 7 * (1 - ease_in(u)))), expr="oof")
    sq, jel = jelly_settle(f, 13, 0.28)
    return dict(M=fit(Quaternion()), squash=sq, jelly=jel, expr="oof" if f < 18 else "happy" if f > 22 else "neutral")


def c_place(t):
    n = 32
    f = t * n
    tq = rq((1, 0, 0), 6) @ rq((0, 1, 0), -7)
    if f < 8:
        u = f / 8
        return dict(M=fit(Quaternion().slerp(tq, ease(u)), 0.5 * ease_out(u)), expr="surprised", ears=8)
    if f < 10:
        return dict(M=fit(tq, 0.5), expr="surprised")
    if f < 15:
        u = (f - 10) / 5
        return dict(M=fit(tq, 0.5 * (1 - ease_in(u))), expr="surprised")
    if f < 17:
        u = (f - 15) / 2
        return dict(M=fit(tq.slerp(Quaternion(), ease_in(u))))
    sq, jel = jelly_settle(f, 17, 0.17)
    return dict(M=fit(Quaternion()), squash=sq, jelly=jel, expr="happy")


def c_teeter_out(t):
    """Loses its balance and drops back flat, with a jelly settle."""
    n = 36
    f = t * n
    start = teeter_q(0.0)
    if f < 5:
        u = f / 5
        return dict(M=fit(start.slerp(rq((0, 1, 0), 28), ease_out(u))), expr="scared", ears_direct=teeter_ears(0.0))
    if f < 11:
        u = (f - 5) / 6
        return dict(M=fit(rq((0, 1, 0), 28 * (1 - ease_in(u)))), expr="surprised", ears=20)
    sq, jel = jelly_settle(f, 11, 0.24)
    return dict(M=fit(Quaternion()), squash=sq, jelly=jel, expr="oof" if f < 15 else "neutral",
                blink=1 - 0.95 * max(0.0, 1 - abs(f - 28) / 1.5))


def c_jump(t):
    n = 46
    f = t * n
    tuck = {k: (0.0, 0.07) for k in list(QUAD_FEET) + list(BIRD_FEET)}
    if f < 9:
        u = ease(f / 9)
        return dict(M=fit(rq((1, 0, 0), -3 * u)), squash=0.24 * u, expr="excited", ears=-8 * u)
    if f < 31:
        z = arc(f, 9, 31, 1.9)
        q = rq((1, 0, 0), -3 + 9 * seg(f, 9, 31))
        return dict(M=fit(q, z), squash=launch(f, 9, 16, 0.2), feet=tuck if 11 < f < 29 else {},
                    expr="excited" if f < 22 else "surprised", ears=20)
    if f < 33:
        u = (f - 31) / 2
        return dict(M=fit(rq((1, 0, 0), 6 * (1 - ease_in(u)))), expr="surprised")
    sq, jel = jelly_settle(f, 33, 0.28)
    return dict(M=fit(Quaternion()), squash=sq, jelly=jel, expr="happy")


def c_run(t):
    """Leaning forward; the feet do the work (big quick steps), the body only
    bobs a little and dips on each footfall."""
    a = 2 * math.pi * t
    k = (t * 2) % 1.0
    lift = 0.09 * math.sin(math.pi * k) ** 2
    sq = 0.05 * max(0.0, math.cos(math.pi * k)) ** 6
    q = rq((1, 0, 0), 8) @ rq((0, 1, 0), 3 * math.sin(a)) @ rq((0, 0, 1), 2 * math.sin(a))
    return dict(M=fit(q, lift), squash=sq, feet=steps(t, 0.3, 0.5), expr="playful", ears=-16, tail=25 * math.sin(2 * a))


def c_sad(t):
    """Slow: a long sigh in, a deflating sigh out, and back. No twitches."""
    a = 2 * math.pi * t
    sq = 0.03 - 0.05 * math.cos(a) * 0.5 - 0.02 * math.cos(2 * a) * 0.5
    tilt = rq((1, 0, 0), 4 + 2 * math.sin(a - 1.2))
    return dict(M=fit(tilt), squash=sq, expr="sad", ears=-28 + 8 * math.sin(a - 1.2), blink=1 - 0.95 * max(0.0, 1 - abs(t - 0.55) / 0.02))


def c_spin_end(t):
    """Slows down, wobbles wider, tips over faster and faster, slams flat
    facing front: one big clatter rock, a smaller one, a jelly settle."""
    n = 76
    f = t * n
    D = 48
    if f < D:
        ang = SPIN_W * f - SPIN_W * f * f / (2 * D)
        wob = SPIN_WOB + 12 * ease_in(seg(f, 18, D))
        return dict(M=fit(top(ang, wob, f)), expr="happy" if f < 30 else "surprised", ears=25 - 30 * seg(f, 30, D))
    q48 = top(720, SPIN_WOB + 12, D)
    if f < 54:
        u = (f - D) / 6
        return dict(M=fit(q48.slerp(Quaternion(), ease_in(u))), expr="surprised")
    q, _ = clatter(f, 55, BIG_CLATTER)
    sq, jel = settles(f, [(54, 0.26), (63, 0.07), (69, 0.1)])
    return dict(M=fit(q), squash=sq, jelly=jel, expr="oof" if f < 60 else "dizzy" if f < 66 else "happy")


ROLL_IN = RollIn()


ROLL = Roller((1, 0, 0))
ROLL_SIDE = Roller((0, -1, 0))

# name, frames, loop, fn
CLIPS = [("idle", 60, True, c_idle), ("walk", 32, True, c_walk), ("run", 20, True, c_run), ("hop", 26, True, c_hop),
         ("jump", 46, False, c_jump), ("excited", 46, True, c_excited), ("waggle", 30, True, c_waggle),
         ("happy", 50, False, c_happy), ("tap", 22, False, c_tap), ("land", 30, False, c_land), ("place", 32, False, c_place),
         ("drop", 56, False, c_drop), ("squish", 44, False, c_squish),
         ("roll", ROLL.n, False, ROLL), ("roll_side", ROLL_SIDE.n, False, ROLL_SIDE), ("roll_in", ROLL_IN.n, False, ROLL_IN),
         ("spin", 38 + 2 * SPIN_LOOP + 76, False, c_spin), ("spin_start", 38, False, c_spin_start),
         ("spin_loop", SPIN_LOOP, True, c_spin_loop), ("spin_end", 76, False, c_spin_end),
         ("teeter_in", 30, False, c_teeter_in), ("teeter_loop", 60, True, c_teeter_loop), ("teeter_out", 36, False, c_teeter_out),
         ("sleep", 120, True, c_sleep), ("sad", 120, True, c_sad)]


def dizzy_spin(poses):
    """Spiral eyes turn while dizzy."""
    for f, p in enumerate(poses):
        e = EXPR[p.get("expr", "neutral")]
        if e.get("eyes") == "spiral":
            p["eye_spin"] = f * 24.0


def body_world(p):
    m = p["M"]
    sq = p.get("squash", 0.0)
    w = m @ T((0, 0, BOTTOM))
    jx, jy = p.get("jelly", (0.0, 0.0))
    if sq or jx or jy:  # squash about the ground under the die; jelly wobbles wider one way, narrower the other
        c = m @ C
        w = about((c.x, c.y, 0.0), Matrix.Diagonal(((1 + sq * 0.6) * (1 + jx), (1 + sq * 0.6) * (1 + jy), 1 - sq, 1))) @ w
    return w


def ear_track(poses, loop):
    """Spring ears: they chase their target angle and get thrown by the die's
    vertical acceleration, so they lag, flop on landings and float in the air."""
    n = len(poses)
    zs = [(p["M"] @ C).z for p in poses]
    k, c, g = 0.25, 0.32, 70.0
    e, v = 0.0, 0.0
    out = [0.0] * n
    for cycle in range(3 if loop else 1):
        for i in range(n):
            if loop:
                a = zs[(i + 1) % n] - 2 * zs[i] + zs[(i - 1) % n]
            else:
                a = (zs[min(i + 1, n - 1)] - 2 * zs[i] + zs[max(i - 1, 0)]) if 0 < i < n - 1 else 0.0
            target = poses[i].get("ears", 0.0)
            v += -k * (e - target) - c * v - g * a
            e += v
            e = max(-55.0, min(55.0, e))
            out[i] = e
    return out


def ear_quat(tag, a):
    s = -1 if tag == "l" else 1
    if EAR_AXIS[0] == "x":  # ears lying back on the top: they lift (never sink into the die)
        return rq((1, 0, 0), max(0.0, a) * 1.3)
    return rq((0, 1, 0), -s * a)  # side ears: + flaps up, - droops


def bake(nodes, rest):
    for name, n, loop, fn in CLIPS:
        action = bpy.data.actions.new(name)
        poses = [fn(f / n) for f in range(n + 1)]
        dizzy_spin(poses)
        ears = ear_track(poses[:-1] if loop else poses, loop)
        if loop:
            ears.append(ears[0])
        for f, p in enumerate(poses):
            trs = {}
            loc, rot, sca = body_world(p).decompose()
            trs["body"] = (loc, rot, sca)
            for k in nodes:  # each foot rides the die, plus its own step
                if k.startswith("foot_"):
                    dy, dz = p.get("feet", {}).get(k, (0.0, 0.0))
                    loc, rot, sca = (p["M"] @ T(rest[k] + Vector((0, dy, dz)))).decompose()
                    trs[k] = (loc, rot, Vector((1, 1, 1)))
            trs.update({k: v for k, v in face_trs(rest, p).items() if k in nodes})
            for tag in ("l", "r"):
                a = p["ears_direct"][0 if tag == "l" else 1] if "ears_direct" in p else ears[f]
                trs[f"ear_{tag}"] = (rest.get(f"ear_{tag}"), ear_quat(tag, a), Vector((1, 1, 1)))
            trs["tail"] = (rest.get("tail"), rq((0, 0, 1), p.get("tail", 0.0)), Vector((1, 1, 1)))
            for k, (l, r, sc) in trs.items():
                o = nodes.get(k)
                if o is None:
                    continue
                ad = o.animation_data or o.animation_data_create()
                ad.action = action
                o.location, o.rotation_quaternion, o.scale = l, r, sc
                for path in ("location", "rotation_quaternion", "scale"):
                    o.keyframe_insert(path, frame=f)
        for k, o in nodes.items():
            if k == "root" or not o.animation_data:
                continue
            ad = o.animation_data
            for layer in action.layers:
                for strip in layer.strips:
                    bag = strip.channelbag(ad.action_slot)
                    if bag:
                        for fc in bag.fcurves:
                            for kp in fc.keyframe_points:
                                kp.interpolation = "LINEAR"
            track = ad.nla_tracks.new()
            track.name = name
            strip = track.strips.new(name, 0, action)
            strip.action_slot = ad.action_slot
            track.mute = True
            ad.action = None
        action.use_frame_range = True
        action.frame_start, action.frame_end = 0, n
        action.use_cyclic = loop
    rest_pose(nodes, rest)


def rest_pose(nodes, rest, expr="neutral"):
    p = dict(M=fit(Quaternion()), expr=expr)
    for k, (l, r, sc) in face_trs(rest, p).items():
        if k in nodes:
            nodes[k].location, nodes[k].rotation_quaternion, nodes[k].scale = l, r, sc
    for k in ("body", "ear_l", "ear_r", "tail") + tuple(k for k in nodes if k.startswith("foot_")):
        if k in nodes:
            nodes[k].location = rest[k]
            nodes[k].rotation_quaternion = Quaternion()
            nodes[k].scale = Vector((1, 1, 1))


def still(path):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.97, 0.93, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    scene.world = world
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 2.3
    sun.data.angle = math.radians(12)
    sun.rotation_euler = (math.radians(40), math.radians(18), math.radians(35))
    scene.collection.objects.link(sun)
    scene.render.resolution_x, scene.render.resolution_y = 520, 520
    scene.render.film_transparent = True
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 4.4
    scene.collection.objects.link(cam)
    target = Vector((0, 0, 1.15))
    cam.location = target + Vector((0.62, -1.0, 0.42)).normalized() * 40
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    bpy.data.objects.remove(sun)


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    out, animals = args[0], args[1:] or list(ANIMALS)
    os.makedirs(out, exist_ok=True)
    for a in animals:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bobble._mats.clear()
        bpy.context.scene.render.fps = FPS
        nodes, rest = build(a)
        bake(nodes, rest)
        if os.environ.get("FACES"):  # a still of every expression, for review
            for e in EXPR:
                rest_pose(nodes, rest, e)
                still(os.path.join(out, f"{a}-face-{e}.png"))
            rest_pose(nodes, rest)
        still(os.path.join(out, f"{a}-34.png"))
        bpy.ops.export_scene.gltf(filepath=os.path.join(out, f"{a}.glb"), export_format="GLB", export_yup=True,
                                  export_apply=False, export_animations=True, export_animation_mode="ACTIONS",
                                  export_merge_animation="ACTION", export_force_sampling=True,
                                  export_optimize_animation_size=True, export_optimize_animation_keep_anim_object=True,
                                  export_texcoords=False, export_skins=False, export_morph=False,
                                  export_cameras=False, export_lights=False, export_extras=False)
        print("WROTE", a)


if not os.environ.get("DICE_NO_MAIN"):
    main()
