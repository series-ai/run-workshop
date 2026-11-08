"""Mafioso: a cute old-movie gangster parody. The kid in a charcoal
pinstripe suit with big shoulder pads, a white shirt and a red tie, a red
carnation on the lapel, two-tone spat shoes, slicked black hair with
sideburns, a huge dark fedora with a
deep pinched dimple and a cream band, tipped low, and a black violin case in the right mitten. Full bucket in
the left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

SUIT, SUIT_L, STRIPE, SHIRT, TIE = (0.24, 0.24, 0.30), (0.32, 0.32, 0.40), (0.78, 0.78, 0.86), (0.98, 0.98, 0.96), (0.85, 0.12, 0.16)
HAT, BAND, HAIR, CASE, LATCH = (0.18, 0.17, 0.2), (0.95, 0.9, 0.78), (0.06, 0.05, 0.07), (0.1, 0.09, 0.11), (0.85, 0.75, 0.4)
LEAF = (0.25, 0.65, 0.25)

X90 = (math.radians(90), 0, 0)


def arm(s, hand, sleeve, r=0.11, mitt=True):
    """A sleeve from the shoulder to a mitten at `hand`."""
    sh = (s * (TW * 0.5 + 0.08), 0, TOP - 0.15)
    d = [h - a for a, h in zip(sh, hand)]
    L = math.sqrt(sum(c * c for c in d))
    limb(sh, tuple(h - c / L * 0.14 for h, c in zip(hand, d)), r, sleeve)
    if mitt:
        hand_mitt(*hand, s, MITT, SKIN)


def bar(p0, p1, r0, r1, rgb, n=6):
    """A tapered bar between two points."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def mesh_obj(verts, faces, rgb, t=0.0):
    me = bpy.data.meshes.new("m")
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new("m", me)
    bpy.context.scene.collection.objects.link(o)
    if t:
        sol = o.modifiers.new("s", "SOLIDIFY")
        sol.thickness = t
        sol.offset = 0
    return finish(o, rgb)


def star(cx, y, cz, r, t, rgb, n=5, inner=0.45, spin=0.0):
    """A flat n-pointed star facing -y."""
    v = [(cx, y, cz)]
    for i in range(2 * n):
        a = math.pi / 2 + spin + i * math.pi / n
        rr = r if i % 2 == 0 else r * inner
        v.append((cx + rr * math.cos(a), y, cz + rr * math.sin(a)))
    return mesh_obj(v, [(0, 1 + i, 1 + (i + 1) % (2 * n)) for i in range(2 * n)], rgb, t)


def slab(pts, t, rgb):
    """A flat quad (4 corner points) given thickness t."""
    return mesh_obj(pts, [(0, 1, 2, 3)], rgb, t)


def build():
    body(shirt=SUIT, pants=SUIT, leg_colour=SUIT, shoe=DARK, arms=False)
    fy = -TD * 0.5
    # spats: white tops over black toes
    for s in (-1, 1):
        box(s * TW * 0.24, -FOOT * 0.15, FOOT * 0.38, FOOT * 0.78, FOOT * 0.8, FOOT * 0.24, SHIRT, bevel=0.06)
    # pinstripes down the jacket, the trousers and the legs
    for x in (-0.36, -0.12, 0.12, 0.36):
        box(x, fy - 0.01, HIP + TH * 0.4, 0.03, 0.04, TH * 0.75, STRIPE)
    for s in (-1, 1):
        box(s * TW * 0.24, -0.11, HIP - 0.08, 0.03, 0.04, 0.2, STRIPE)
    # the jacket front: a white shirt V, a red tie, lapels, buttons, the carnation
    can(0, fy - 0.02, TOP - 0.25, 0.26, 0.05, SHIRT, n=3, rot=(math.radians(90), 0, math.radians(-90)))
    box(0, fy - 0.06, TOP - 0.3, 0.1, 0.04, 0.42, TIE)
    box(0, fy - 0.06, TOP - 0.1, 0.16, 0.05, 0.12, TIE)
    for s in (-1, 1):
        box(s * 0.2, fy - 0.05, TOP - 0.3, 0.12, 0.04, 0.5, SUIT_L, rot=(0, s * math.radians(-22), 0))
    for z in (HIP + 0.25, HIP + 0.42):
        ball(0.0, fy - 0.05, z, 0.08, 0.05, 0.08, DARK, seg=6, ring=4)
    cx, cz = -0.3, TOP - 0.28
    for i in range(6):
        a = i * math.pi / 3
        ball(cx + 0.07 * math.cos(a), fy - 0.12, cz + 0.07 * math.sin(a), 0.14, 0.12, 0.14, TIE, seg=6, ring=4)
    ball(cx, fy - 0.17, cz, 0.12, 0.08, 0.12, (0.65, 0.05, 0.1), seg=6, ring=4)
    box(cx + 0.08, fy - 0.1, cz - 0.15, 0.12, 0.03, 0.06, LEAF, rot=(0, math.radians(30), 0))
    # big shoulder pads
    for s in (-1, 1):
        box(s * (TW * 0.5 + 0.05), 0, TOP - 0.08, 0.36, TD * 0.9, 0.22, SUIT, bevel=0.07)
    # right mitten: the violin case, carried along the side; left: the bucket
    rh = (0.82, -0.08, 0.72)
    arm(1, rh, SUIT, r=0.12)
    cx, cy = rh[0] + 0.12, rh[1] + 0.05
    box(cx, cy + 0.38, 0.38, 0.3, 0.8, 0.62, CASE, bevel=0.12, segs=2)        # the lower bout
    box(cx, cy - 0.22, 0.4, 0.3, 0.5, 0.48, CASE, bevel=0.1, segs=2)          # the upper bout
    box(cx, cy - 0.62, 0.41, 0.28, 0.45, 0.26, CASE, bevel=0.08, segs=2)      # the neck
    box(cx, cy + 0.0, 0.4, 0.33, 1.5, 0.05, LATCH)                             # the seam
    for y in (cy - 0.45, cy + 0.55):
        box(cx + 0.17, y, 0.42, 0.04, 0.1, 0.12, LATCH)
    limb((cx, cy - 0.12, 0.65), (cx, cy - 0.12, 0.78), 0.035, LATCH)
    limb((cx, cy + 0.16, 0.65), (cx, cy + 0.16, 0.78), 0.035, LATCH)
    hand_mitt(*rh, 1, MITT, SKIN)
    lh = (-0.82, -0.2, 0.75)
    arm(-1, lh, SUIT, r=0.12)
    bucket(lh, full=True, size=0.6)
    # the head: slicked black hair with a side part and sideburns, a pencil moustache
    w = HEAD
    kid_head(hair=HAIR)
    for s in (-1, 1):
        box(s * (w * 0.5 - 0.06), -0.6, HEAD_Z + 0.35, 0.16, 0.4, 0.6, HAIR, bevel=0.05)
    # the big fedora: a wide snap brim, a tall crown that covers the whole head
    # top, split by a deep dimple down the middle and pinched in at the front
    fedora(HEAD_Z + w * 0.3)


def crown(W, Wt, H, D, dip, rgb, pinch=0.72):
    """A fedora crown: tapered sides, a top with a deep crease down the middle
    (front to back), pinched narrower at the front. Built as a two-section loft."""
    def section(y, sx, dz):
        prof = [(-W / 2, 0), (W / 2, 0), (Wt / 2, H), (Wt * 0.24, H + 0.1), (0, H - dip - dz), (-Wt * 0.24, H + 0.1), (-Wt / 2, H)]
        out = []
        for i, (x, z) in enumerate(prof):
            k = sx if z > 0.2 else 1.0
            out.append((x * k, y, z))
        return out
    f = section(-D / 2, pinch, 0.15)
    bk = section(D / 2, 1.0, -0.1)
    n = len(f)
    faces = [list(range(n))[::-1], list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    o = mesh_obj(f + bk, faces, rgb)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    bv = o.modifiers.new("b", "BEVEL")
    bv.width = 0.14
    bv.segments = 2
    bv.limit_method = "ANGLE"
    return o


def fedora(bz):
    w = HEAD
    tilt = (math.radians(-7), 0, math.radians(-5))
    from mathutils import Euler, Matrix
    before = set(bpy.data.objects)
    br = can(0, -0.12, 0, 1.0, 0.14, HAT, n=14)                                  # the oval brim
    br.scale = (w * 0.98, w * 0.84, 1.0)
    crown(w * 1.12, w * 0.98, 1.55, w * 1.02, 0.5, HAT)
    box(0, 0, 0.27, w * 1.12, w * 1.04, 0.36, BAND, bevel=0.06)                    # the band
    box(w * 0.5, -w * 0.3, 0.55, 0.12, 0.35, 0.6, (0.85, 0.15, 0.2), rot=(0, math.radians(-15), math.radians(-30)))  # a red feather tuck
    objs = [o for o in bpy.data.objects if o not in before]
    M = Matrix.Translation((0, 0, bz)) @ Euler(tilt, "XYZ").to_matrix().to_4x4()
    for o in objs:
        o.matrix_world = M @ o.matrix_world

if __name__ == "__main__" or True:
    run({"mafioso": build})
