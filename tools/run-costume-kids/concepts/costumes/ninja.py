"""Ninja: the kid wrapped in black from head to toe, only the eyes peeking
out of a skin-coloured slot in the hood (like the mummy's peek), a red
headband knotted at the back with tails flying, a red sash, grey wrist and
shin wraps, and a toy sword in a red scabbard slung across the back, its hilt
poking up over the giant head. A toy throwing star in one mitten, the bucket
in the other."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

BLACK, BLACK_L, WRAP, RED, RED_D = (0.12, 0.12, 0.16), (0.22, 0.22, 0.28), (0.5, 0.5, 0.56), (0.92, 0.14, 0.16), (0.68, 0.08, 0.1)
STEEL, GOLD, GRIP = (0.82, 0.86, 0.9), (1.0, 0.78, 0.18), (0.95, 0.95, 0.92)

X90 = (math.radians(90), 0, 0)


def arm(s, hand, sleeve, r=0.11, mitt=True):
    """A sleeve from the shoulder to a mitten at `hand`."""
    sh = (s * (TW * 0.5 + 0.08), 0, TOP - 0.15)
    d = [h - a for a, h in zip(sh, hand)]
    L = math.sqrt(sum(c * c for c in d))
    side = "l" if s > 0 else "r"
    with part("arm." + side):
        limb(sh, tuple(h - c / L * 0.14 for h, c in zip(hand, d)), r, sleeve)
    if mitt:
        with part("hand." + side):
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
    body(shirt=BLACK, pants=BLACK, leg_colour=BLACK, shoe=BLACK, arms=False)
    fy = -TD * 0.5
    # the tabi toe split and shin wraps
    for s in (-1, 1):
        side = "l" if s > 0 else "r"
        with part("foot." + side):
            box(s * TW * 0.24 + s * 0.1, -FOOT * 0.8, FOOT * 0.25, 0.03, 0.06, 0.3, BLACK_L)
        for k, z in enumerate((FOOT * 0.5, HIP - 0.08)):
            with part("leg." + side):
                can(s * TW * 0.24, 0, z, 0.14, 0.09, WRAP, n=6, rot=(math.radians(8 if k else -8), 0, 0))
    with part("chest"):
        # the jacket crossover and the red sash with a knot
        for s in (-1, 1):
            box(s * 0.12, fy - 0.02, HIP + TH * 0.68, 0.1, 0.04, 0.55, BLACK_L, rot=(0, s * math.radians(35), 0))
    with part("body"):
        box(0, 0, HIP + TH * 0.32, TW + 0.06, TD + 0.06, 0.16, RED, bevel=0.03)
        box(0.25, fy - 0.08, HIP + TH * 0.32, 0.18, 0.1, 0.18, RED_D, bevel=0.04)
        box(0.32, fy - 0.08, HIP + TH * 0.1, 0.12, 0.05, 0.36, RED, rot=(0, math.radians(-15), 0))
    with part("chest"):
        # the sword strap across the chest
        box(0, fy - 0.03, HIP + TH * 0.7, 0.12, 0.04, 1.15, RED_D, rot=(0, math.radians(-50), 0))
    # arms with grey wrist wraps; a throwing star in the left, the bucket in the right
    lh = hand_points()[-1]
    arm(-1, lh, BLACK)
    rh = hand_points()[1]
    arm(1, rh, BLACK)
    for s, h in ((-1, lh), (1, rh)):
        with part("arm.l" if s > 0 else "arm.r"):
            can(h[0] - s * 0.04, h[1] + 0.03, h[2] + 0.22, 0.14, 0.12, WRAP, n=6)
    with part("prop.r"):  # the throwing star and its rivet, one prop
        star(lh[0] - 0.08, lh[1] - 0.3, lh[2] + 0.02, 0.32, 0.05, STEEL, n=4, inner=0.35, spin=math.radians(20))
        can(lh[0] - 0.08, lh[1] - 0.34, lh[2] + 0.02, 0.06, 0.04, BLACK, n=8, rot=X90)
    bucket(rh, full=True, size=0.6)
    with part("chest"):
        # the toy sword across the back: a red scabbard, a gold guard, a wrapped hilt up over the head
        w = HEAD
        by = w * 0.46 + 0.16
        p0, p1 = Vector((-1.15, by, 0.55)), Vector((0.95, by, 4.0))
        d = (p1 - p0).normalized()
        bar(p0, p1, 0.13, 0.13, RED, n=6)
        bar(p1, p1 + d * 0.06, 0.13, 0.13, GOLD, n=6)
        g = p1 + d * 0.12
        bar(g - d * 0.05, g + d * 0.05, 0.3, 0.3, GOLD, n=8)
        bar(g + d * 0.05, g + d * 0.85, 0.1, 0.1, GRIP, n=6)
        for k in range(4):
            c = g + d * (0.15 + k * 0.2)
            bar(c - d * 0.04, c + d * 0.04, 0.115, 0.115, BLACK, n=6)
        c = g + d * 0.9
        ball(c.x, c.y, c.z, 0.24, 0.24, 0.24, GOLD, seg=6, ring=4)
    with part("head"):
        # the hood: a black rounded cube, a wrap seam, the eye slot
        hz = HEAD_Z
        box(0, 0, hz + 0.03, w * 1.02, w * 0.94, w * 0.92, BLACK, bevel=w * 0.15, segs=2)  # its bottom flush with the head's
        for dz, t in ((-0.42, 4), (-0.72, -3)):
            box(0, -w * 0.47, hz + dz, w * 0.78, 0.06, 0.08, BLACK_L, rot=(0, math.radians(t), 0))
        ez = hz + 0.08
        fy2 = -w * 0.47
        box(0, fy2 - 0.01, ez, 1.7, 0.06, 0.58, SKIN, bevel=0.06)
        for s in (-1, 1):
            ex = s * w * 0.22
            can(ex, fy2 - 0.05, ez, w * 0.08, 0.06, DARK, n=10, rot=X90)
            can(ex - w * 0.03, fy2 - 0.09, ez + w * 0.04, w * 0.027, 0.04, WHITE, n=6, rot=X90)
            box(s * 0.75, fy2 - 0.05, ez - 0.2, 0.18, 0.04, 0.08, CHEEK)
            box(s * w * 0.22 + s * 0.02, fy2 - 0.06, ez + 0.22, 0.4, 0.05, 0.08, DARK, rot=(0, s * math.radians(-12), 0))  # determined brows
        # the red headband with a knot and two tails flying at the back
        bz = hz + 0.58
        box(0, 0, bz, w * 1.05, w * 0.97, 0.34, RED, bevel=0.1)
        ky = w * 0.485 + 0.08
        box(0.3, ky, bz, 0.3, 0.2, 0.3, RED_D, bevel=0.08)
        box(0.55, ky + 0.12, bz - 0.35, 0.22, 0.06, 0.8, RED, rot=(math.radians(20), math.radians(-25), 0))
        box(0.8, ky + 0.2, bz - 0.15, 0.22, 0.06, 0.7, RED, rot=(math.radians(25), math.radians(-55), 0))


if __name__ == "__main__" or True:
    run({"ninja": build})
