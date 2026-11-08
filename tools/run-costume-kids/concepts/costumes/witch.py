"""Witch: the kid under a giant crooked pointy hat (taller than the kid) with a
green band and a gold buckle, the crown kinking back and flopping over at the
tip. Ginger hair, a purple dress, a dark cape, orange/black striped stockings
and purple shoes with buckles. A straw broom is carried at her side in one mitten
(bristles out behind) and a tiny black cat sits on the hat brim by her shoulder. The
other mitten holds the full bucket. Rendered with a taller camera for the hat."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from mathutils import Matrix
from props import bucket

HAT, HAT_D, BAND, GOLD = (0.46, 0.24, 0.66), (0.32, 0.15, 0.48), (0.36, 0.80, 0.30), (1.0, 0.78, 0.22)
DRESS, CAPE, CAPE_IN = (0.54, 0.30, 0.74), (0.16, 0.12, 0.22), (0.36, 0.80, 0.30)
STOCK_A, STOCK_B, HAIR = (1.0, 0.55, 0.12), (0.12, 0.10, 0.14), (0.88, 0.40, 0.14)
STRAW, STRAW_D, STICK = (0.98, 0.80, 0.36), (0.86, 0.62, 0.22), (0.56, 0.34, 0.18)
CAT, CAT_EYE = (0.12, 0.11, 0.15), (1.0, 0.86, 0.15)


def squash(o, sx=1.0, sy=1.0, sz=1.0):
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    return o


def bar(p0, p1, r0, r1, rgb, n=8):
    """A tapered bar from p0 (radius r0) to p1 (radius r1)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def shell(cy, a, z0, z1, r0, r1, t, rgb_out, rgb_in, n=12):
    """A thick open arc of a cone around the back (angle 0 = +y), from z0 at
    radius r0 to z1 at radius r1, spanning -a..a; outer and inner colours."""
    import bmesh
    for rgb, off in ((rgb_out, 0.0), (rgb_in, -t)):
        me = bpy.data.meshes.new("shell")
        bm = bmesh.new()
        rows = []
        for (z, r) in ((z0, r0 + off), (z1, r1 + off)):
            rows.append([bm.verts.new((r * math.sin(-a + 2 * a * i / n), cy + r * math.cos(-a + 2 * a * i / n), z))
                         for i in range(n + 1)])
        for i in range(n):
            bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
        bm.normal_update()
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new("shell", me)
        bpy.context.scene.collection.objects.link(o)
        bpy.context.view_layer.objects.active = o
        sol = o.modifiers.new("s", "SOLIDIFY")
        sol.thickness = t
        finish(o, rgb)


def witch_hat(bz):
    """The giant crooked witch hat sitting on the head, brim at z = bz."""
    rz = math.radians(22.5)
    can(0, 0, bz, 2.15, 0.16, HAT_D, n=12)                                   # the brim
    can(0, 0, bz + 0.1, 1.95, 0.08, HAT, n=12)
    # the crown: a straight cone base, then kinked tapering segments flopping back and over
    can(0, 0, bz + 0.75, 1.5, 1.5, HAT, n=8, r2=0.98, rot=(0, 0, rz))
    can(0, 0, bz + 0.32, 1.48, 0.46, BAND, n=8, r2=1.35, rot=(0, 0, rz))        # the band
    pts = [(0, 0, bz + 1.5), (0.12, 0.2, bz + 2.6), (0.42, 0.42, bz + 3.45), (0.95, 0.5, bz + 3.95), (1.5, 0.4, bz + 3.85)]
    rad = [0.98, 0.68, 0.42, 0.22, 0.04]
    for i in range(len(pts) - 1):
        bar(pts[i], pts[i + 1], rad[i], rad[i + 1], HAT, n=8)
        if 0 < i + 1 < len(pts) - 1:
            ball(*pts[i + 1], rad[i + 1] * 2, rad[i + 1] * 2, rad[i + 1] * 2, HAT, seg=8, ring=6)
    ball(0, 0, bz + 1.5, 1.96, 1.96, 0.5, HAT, seg=8, ring=4)
    # a little patch on the crown and the gold buckle on the band
    box(0.4, -0.8, bz + 1.95, 0.32, 0.05, 0.28, BAND, rot=(math.radians(14), 0, math.radians(20)))
    by = -1.42 * math.cos(rz) - 0.04
    box(0, by, bz + 0.32, 0.6, 0.07, 0.5, GOLD, bevel=0.04)
    box(0, by - 0.03, bz + 0.32, 0.34, 0.07, 0.26, BAND)


def black_cat(x, y, z, face_dir=-1):
    """A tiny black cat sitting at (x, y, z): its bottom on z."""
    ball(x, y, z + 0.25, 0.5, 0.42, 0.55, CAT, seg=8, ring=6)                 # body
    box(x, y - 0.06, z + 0.68, 0.5, 0.42, 0.42, CAT, bevel=0.12, segs=2)      # head
    for s in (-1, 1):
        can(x + s * 0.15, y - 0.04, z + 0.95, 0.12, 0.22, CAT, n=4, r2=0.0, rot=(0, 0, math.radians(45)))
        can(x + s * 0.15, y - 0.12, z + 0.94, 0.06, 0.12, (0.95, 0.55, 0.7), n=4, r2=0.0, rot=(0, 0, math.radians(45)))
        box(x + s * 0.11, y - 0.28, z + 0.7, 0.12, 0.04, 0.14, CAT_EYE)
        box(x + s * 0.11, y - 0.3, z + 0.7, 0.04, 0.04, 0.12, DARK)
        ball(x + s * 0.1, y - 0.17, z + 0.03, 0.14, 0.16, 0.1, CAT, seg=6, ring=4)  # front paws
    can(x, y - 0.29, z + 0.62, 0.035, 0.03, (0.95, 0.5, 0.65), n=3, rot=(math.radians(90), 0, math.radians(180)))
    # the tail curling up behind
    pts = [(x, y + 0.2, z + 0.12), (x + 0.3, y + 0.3, z + 0.18), (x + 0.42, y + 0.25, z + 0.45), (x + 0.36, y + 0.2, z + 0.65)]
    for a, b in zip(pts, pts[1:]):
        bar(a, b, 0.055, 0.055, CAT, n=6)


def build():
    body(shoe=DRESS, legs=False, torso=False, arms=False)
    # striped stockings, a bit longer so they disappear up the dress
    for s in (-1, 1):
        fx = s * TW * 0.24
        side = "l" if s > 0 else "r"
        with part(f"leg.{side}"):
            limb((fx, 0, FOOT * 0.4), (fx, 0, HIP + 0.3), 0.11, STOCK_A)
            for z in (0.28, 0.46, 0.64):
                can(fx, 0, z, 0.125, 0.07, STOCK_B, n=6)
        with part(f"foot.{side}"):
            box(fx, -FOOT * 0.7, FOOT * 0.3, 0.2, 0.06, 0.14, GOLD)  # shoe buckles
    with part("body"):
        # the dress: a flared bell with a jagged hem and a black waist cord
        hem = HIP + 0.24
        can(0, 0, (hem + TOP) / 2, 0.82, TOP - hem, DRESS, n=8, r2=0.5, rot=(0, 0, math.radians(22.5)))
        for k in range(8):
            a = 2 * math.pi * (k + 0.5) / 8
            can(0.78 * math.cos(a), 0.78 * math.sin(a), hem - 0.06, 0.13, 0.14, DRESS, n=4, r2=0.0, rot=(math.pi, 0, a))
        can(0, 0, HIP + 0.55, 0.62, 0.08, STOCK_B, n=8, rot=(0, 0, math.radians(22.5)))
    with part("chest"):
        # the cape behind, dark outside, green inside
        shell(0.08, math.radians(118), HIP - 0.1, TOP + 0.05, 1.0, 0.6, 0.06, CAPE, CAPE_IN)
    # both arms hang; the left mitt (+x) holds the broom, the right one the bucket
    sx = TW * 0.5 + 0.08
    hp = hand_points()
    for s in (-1, 1):
        side = "l" if s > 0 else "r"
        with part(f"arm.{side}"):
            limb((s * sx, 0, TOP - 0.15), (s * sx + s * 0.16, -0.05, TOP - ARM_DROP), 0.11, DRESS)
        with part(f"hand.{side}"):
            hand_mitt(*hp[s], s, MITT, SKIN)
    # the broom, all of it one prop: carried at the side like a lance, the stick
    # forward and up, the bristles out behind, clear of the floor and the cape
    from props import broom
    with part("prop.l"):
        before = set(bpy.data.objects)
        broom()
        q = Vector((0, 0, -1)).rotation_difference(Vector((0.75, 0.55, -0.3)).normalized())
        M = Matrix.Translation(hp[1]) @ q.to_matrix().to_4x4()
        for o in set(bpy.data.objects) - before:
            o.matrix_world = M @ o.matrix_world
    bucket(hp[-1], full=True, size=0.6)
    with part("head"):
        # the head with long ginger hair hanging down the sides and back
        w = HEAD
        box(0, 0, HEAD_Z, w, w * 0.92, w * 0.9, SKIN, bevel=w * 0.14, segs=2)
        box(0, w * 0.05, HEAD_Z + 0.62, w * 1.04, w * 0.98, 0.6, HAIR, bevel=0.2, segs=2)
        box(0, 0.3, HEAD_Z + 0.02, w * 1.08, w * 0.7, w * 0.85, HAIR, bevel=0.3, segs=2)
        for s in (-1, 1):
            box(s * w * 0.5, -0.45, HEAD_Z - 0.55, 0.36, 0.5, 1.0, HAIR, bevel=0.14, segs=2)   # side locks
            box(s * w * 0.5, -0.45, HEAD_Z - 1.1, 0.3, 0.42, 0.3, HAIR, bevel=0.1, rot=(0, s * math.radians(25), 0))
        face(0, HEAD_Z - w * 0.05, -w * 0.46, w)
        ball(0.48, -w * 0.46 - 0.02, HEAD_Z - 0.38, 0.1, 0.06, 0.1, (0.55, 0.78, 0.3), seg=6, ring=4)  # a silly wart
        bz = HEAD_Z + 0.95
        witch_hat(bz)
        black_cat(-1.62, -0.55, bz + 0.08)


if __name__ == "__main__" or True:
    out = sys.argv[sys.argv.index("--") + 1]
    render_costume("witch", build, out, ortho=9.6, target_z=3.9)
