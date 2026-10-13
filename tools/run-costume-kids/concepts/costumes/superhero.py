"""Superhero: the kid in a royal-blue suit with a giant gold star emblem
across the chest, red trunks, a gold belt, red boots, a red domino mask
over the eyes, a swoosh of black hair with a curl, and a big red cape
flaring out behind. One fist punched up to the sky, the other at the side
carrying the full pumpkin bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

BLUE, RED, RED_D, GOLD, HAIR = (0.15, 0.38, 0.92), (0.92, 0.14, 0.18), (0.72, 0.08, 0.12), (1.0, 0.80, 0.12), (0.10, 0.08, 0.12)

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
    body(shirt=BLUE, pants=RED, leg_colour=BLUE, shoe=RED, arms=False)
    fy = -TD * 0.5
    # boots: red cuffs up the legs
    for s in (-1, 1):
        with part("leg.l" if s > 0 else "leg.r"):
            can(s * TW * 0.24, 0, FOOT * 0.55, 0.16, 0.2, RED, n=8)
            can(s * TW * 0.24, 0, FOOT * 0.7, 0.18, 0.07, RED_D, n=8)
    # the belt and buckle
    with part("body"):
        box(0, 0, HIP + TH * 0.36, TW + 0.04, TD + 0.04, 0.1, GOLD, bevel=0.02)
        box(0, fy - 0.05, HIP + TH * 0.36, 0.2, 0.06, 0.16, RED, bevel=0.02)
    with part("chest"):
        # the giant star emblem on a gold disc filling the chest
        ez = HIP + TH * 0.7
        can(0, fy - 0.03, ez, 0.4, 0.06, GOLD, n=12, rot=X90)
        star(0, fy - 0.08, ez, 0.36, 0.06, RED)
        # the cape: a red sheet from the shoulders, flaring out behind and to one side
        slab([(-0.5, 0.38, TOP), (0.5, 0.38, TOP), (1.2, 1.25, 0.25), (-1.65, 1.15, 0.45)], 0.07, RED)
        slab([(-1.65, 1.15, 0.45), (-0.5, 0.38, TOP), (-0.62, 0.3, TOP - 0.05), (-1.8, 0.85, 0.75)], 0.07, RED_D)
        for s in (-1, 1):
            box(s * 0.42, 0.2, TOP - 0.02, 0.32, 0.4, 0.14, RED, bevel=0.05)              # the shoulder clasps
            can(s * 0.42, -0.04, TOP - 0.02, 0.1, 0.06, GOLD, n=8, rot=X90)
    # right fist punched up to the sky
    rh = (1.5, -0.2, 2.25)
    with part("arm.l"):
        arm(1, rh, BLUE, r=0.12, mitt=False)
    with part("hand.l"):
        hand_mitt(*rh, 1, MITT, SKIN)
        can(1.38, -0.18, 2.0, 0.17, 0.2, RED, n=8, rot=(0, math.radians(-28), 0))
    # the other fist hangs at the side, in a red glove cuff
    sx = TW * 0.5 + 0.08
    with part("arm.r"):
        limb((-sx, 0, TOP - 0.15), (-sx - 0.16, -0.05, TOP - ARM_DROP), 0.12, BLUE)
    with part("hand.r"):
        can(-sx - 0.17, -0.06, TOP - 0.47, 0.17, 0.18, RED, n=8)
        hand_mitt(*hand_points()[-1], -1, MITT, SKIN)
    bucket(hand_points()[-1], full=True, size=0.6)
    # the head: swooshed black hair with a curl, and the domino mask
    kid_head(hair=HAIR)
    w = HEAD
    with part("head"):
        # a big swooshy curl springing up off the front of the hair
        bar((0.15, -0.95, HEAD_Z + 1.12), (-0.25, -1.25, HEAD_Z + 1.55), 0.22, 0.05, HAIR, n=6)
        bar((0.55, -0.95, HEAD_Z + 1.1), (0.4, -1.2, HEAD_Z + 1.4), 0.16, 0.04, HAIR, n=6)
        mz = HEAD_Z + 0.12
        fy2 = -w * 0.46
        box(0, fy2 + 0.005, mz, 1.75, 0.04, 0.5, RED, bevel=0.015)
        for s in (-1, 1):
            box(s * 0.95, fy2 + 0.005, mz + 0.12, 0.38, 0.04, 0.22, RED, rot=(0, s * math.radians(-25), 0))   # the pointy tips
        # the mask ties flapping at the back
        for s in (-1, 1):
            box(s * 0.25, w * 0.47 + 0.15, mz - 0.25, 0.14, 0.05, 0.6, RED, rot=(math.radians(20), s * math.radians(20), 0))
        box(0, 0.02, mz, w * 1.02, w * 0.9, 0.16, RED)


if __name__ == "__main__" or True:
    run({"superhero": build})
