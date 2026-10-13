"""Vampire bat: the kid in a dark purple bat suit, arms spread wide as wings:
scalloped purple membranes stretched from each arm down to the hips, dark
finger ribs, the kid's mitts at the wing tips. A hood with huge pointy bat
ears (pink inside) frames the face, which has two tiny fangs; a little
red-lined cape on the back and a pale fuzzy belly. No bucket: both arms are
busy being wings."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403

SUIT, SUIT_D, WING, RIB = (0.30, 0.20, 0.42), (0.20, 0.13, 0.30), (0.52, 0.30, 0.70), (0.22, 0.13, 0.32)
BELLY, EAR_IN, RIM, LINING = (0.78, 0.68, 0.88), (1.0, 0.62, 0.74), (0.62, 0.48, 0.80), (0.86, 0.12, 0.24)


def squash(o, sx=1.0, sy=1.0, sz=1.0):
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    return o


def plate(pts, y, t, rgb):
    """A flat polygon in the x-z plane at depth y, thickness t."""
    me = bpy.data.meshes.new("plate")
    me.from_pydata([(x, y, z) for x, z in pts], [], [list(range(len(pts)))])
    o = bpy.data.objects.new("plate", me)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    sol = o.modifiers.new("s", "SOLIDIFY")
    sol.thickness = t
    sol.offset = 0
    return finish(o, rgb)


def shell(cy, a, z0, z1, r0, r1, t, rgb_out, rgb_in, n=12):
    """A thick open arc of a cone around the back (angle 0 = +y)."""
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


def build():
    body(shirt=SUIT, pants=SUIT_D, leg_colour=SUIT, shoe=SUIT_D, arms=False)
    fy = -TD * 0.5 - 0.02
    box(0, fy, HIP + TH * 0.5, TW * 0.6, 0.05, TH * 0.75, BELLY, bevel=0.06)          # fuzzy belly
    for k in (-1, 0, 1):
        can(k * 0.16, fy, HIP + TH * 0.11, 0.07, 0.12, BELLY, n=4, r2=0.0, rot=(math.pi, 0, math.radians(45)))
    # the little cape on the back
    shell(0.08, math.radians(100), HIP + 0.05, TOP + 0.05, 0.85, 0.58, 0.05, SUIT_D, LINING)
    # wing arms: spread out and up, a scalloped membrane down to the hips
    for s in (-1, 1):
        sh = (s * (TW * 0.5 + 0.06), 0.0, TOP - 0.15)
        hand = (s * 1.95, -0.05, TOP + 0.25)
        limb(sh, hand, 0.12, SUIT)
        tips = [(2.2, 0.72), (1.55, 0.28), (0.95, 0.22)]
        pts = [(0.45, TOP - 0.1), (1.92, TOP + 0.22), tips[0], (1.78, 0.98), tips[1], (1.22, 0.62), tips[2], (0.68, 0.55), (0.45, 0.6)]
        plate([(s * x, z) for x, z in pts], 0.06, 0.06, WING)
        for tx, tz in tips:
            limb((s * 1.88, 0.06, TOP + 0.2), (s * tx, 0.06, tz), 0.06, RIB)
        hand_mitt(hand[0] + s * 0.05, -0.08, hand[2] + 0.05, s, MITT, SKIN)
    # the hood: a big dark block with a lilac rim and the kid's face in the opening
    box(0, 0.2, HEAD_Z + 0.05, HEAD * 1.1, HEAD * 0.96, HEAD * 1.06, SUIT, bevel=0.5, segs=2)
    fz = HEAD_Z - 0.15
    box(0, -0.18, fz, HEAD * 0.88, HEAD * 0.76, HEAD * 0.76, RIM, bevel=0.42, segs=2)
    box(0, -0.25, fz, HEAD * 0.8, HEAD * 0.76, HEAD * 0.68, SKIN, bevel=0.38, segs=2)
    ffy = -0.25 - HEAD * 0.38
    face(0, fz, ffy, HEAD * 0.82)
    mz = fz - HEAD * 0.82 * 0.14 - 0.08
    for s in (-1, 1):
        can(s * 0.09, ffy - 0.03, mz, 0.065, 0.04, WHITE, n=3, rot=(math.radians(90), 0, math.radians(180)))
    # a bat face on the hood brow: a tiny snub nose and a fuzzy tuft
    top = HEAD_Z + 0.05 + HEAD * 0.53
    hfy = 0.2 - HEAD * 0.48
    box(0, hfy - 0.02, top - 0.42, 0.42, 0.12, 0.24, SUIT_D, bevel=0.08)
    for s in (-1, 1):
        ball(s * 0.08, hfy - 0.09, top - 0.42, 0.08, 0.04, 0.08, DARK, seg=6, ring=4)
    can(0, 0.1, top + 0.15, 0.18, 0.4, SUIT_D, n=4, r2=0.0, rot=(math.radians(-20), 0, math.radians(45)))
    # huge bat ears, tipped out
    for s in (-1, 1):
        o = can(s * 0.95, 0.15, top + 0.5, 0.68, 1.25, SUIT, n=4, r2=0.0, rot=(0, s * math.radians(-22), math.radians(45)))
        squash(o, 1.0, 0.45, 1.0)
        o = can(s * 0.93, -0.03, top + 0.42, 0.42, 0.8, EAR_IN, n=4, r2=0.0, rot=(0, s * math.radians(-22), math.radians(45)))
        squash(o, 1.0, 0.35, 1.0)


if __name__ == "__main__" or True:
    run({"vampire-bat": build})
