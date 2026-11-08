"""Vampire bat: the kid in a dark purple bat suit, arms spread wide as wings:
scalloped purple membranes stretched from each arm down to the hips, dark
finger ribs, the kid's mitts at the wing tips. A hood with huge pointy bat
ears (pink inside) frames the face, which has two tiny fangs; a little
red-lined cape on the back and a pale fuzzy belly. The right wing ends in a
little claw instead of a mitt: that arm hangs at the side in a suit sleeve and
carries the full pumpkin bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

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


def wedge(pts_f, pts_b, rgb, bevel=0.0, segs=2):
    """A solid from a front polygon and a back polygon (same vertex count)."""
    import bmesh
    me = bpy.data.meshes.new("w")
    bm = bmesh.new()
    vf = [bm.verts.new(p) for p in pts_f]
    vb = [bm.verts.new(p) for p in pts_b]
    n = len(vf)
    bm.faces.new(vf)
    bm.faces.new(list(reversed(vb)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vf[j], vf[i], vb[i], vb[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("w", me)
    bpy.context.scene.collection.objects.link(o)
    finish(o, rgb, bevel, segs)
    if bevel:
        o.modifiers["b"].limit_method = "ANGLE"
    return o


def hood_ear(s, xo, zb, bw, h, yf, yb, rgb, inner=None, tip_d=0.3, tip_in=0.3, bevel=0.1, lift=0.7, shoulder=0.0):
    """A thick ear that grows out of a hood's top corner: its outer edge
    carries the hood's side wall straight up (for `shoulder` units, then
    leans to the tip), its base sinks into the hood, and it tapers in depth
    to a thin tip. s = side (-1 left, 1 right)."""
    xi, xt, zt = xo - s * bw, xo - s * bw * tip_in, zb + h
    outer = [(xo, zb)] + ([(xo, zb + shoulder)] if shoulder else []) + [(xt, zt)]
    poly = outer + [(xi, zb)]
    front = [(x, yf, z) for x, z in poly]
    back = [(x, yb, z) for x, z in poly]
    front[len(outer) - 1] = (xt, yf + 0.04, zt)
    back[len(outer) - 1] = (xt, yf + tip_d, zt)
    wedge(front, back, rgb, bevel)
    if inner:  # the inside, from just above the hood up to near the tip
        def at(edge, z):
            for (x0, z0), (x1, z1) in zip(edge, edge[1:]):
                if z0 <= z <= z1:
                    return x0 + (x1 - x0) * (z - z0) / max(z1 - z0, 1e-6)
            return edge[-1][0]
        zl = zb + lift
        xol, xil = at(outer, zl) - s * 0.18, at([(xi, zb), (xt, zt)], zl) + s * 0.18
        tri = [(xol, zl), (xil, zl), (xt - s * 0.04 * (1 if tip_in >= 0 else -1), zt - 0.34)]
        wedge([(x, yf - 0.03, z) for x, z in tri], [(x, yf + 0.05, z) for x, z in tri], inner, 0.03)


WY = 0.45  # the wings sit just behind the shoulders' line


def build():
    body(shirt=SUIT, pants=SUIT_D, leg_colour=SUIT, shoe=SUIT_D, arms=False)
    fy = -TD * 0.5 - 0.02
    with part("chest"):
        box(0, fy, HIP + TH * 0.5, TW * 0.6, 0.05, TH * 0.75, BELLY, bevel=0.06)          # fuzzy belly
    with part("body"):
        for k in (-1, 0, 1):
            can(k * 0.16, fy, HIP + TH * 0.11, 0.07, 0.12, BELLY, n=4, r2=0.0, rot=(math.pi, 0, math.radians(45)))
    with part("chest"):
        # the little cape on the back, clear behind the wings
        shell(0.08, math.radians(40), HIP + 0.05, TOP + 0.05, 0.85, 0.58, 0.05, SUIT_D, LINING)
    # wing arms: spread out and up, a scalloped membrane down to the hips. The wings
    # are worn on the back: each whole wing (arm, membrane, ribs and the mitt at its
    # tip) rides the chest, so it never folds up into the hood
    for s in (-1, 1):
        with part("chest"):
            sh = (s * (TW * 0.5 + 0.06), WY, TOP - 0.15)
            hand = (s * 1.95, WY - 0.05, TOP + 0.25)
            limb(sh, hand, 0.12, SUIT)
            tips = [(2.2, 0.72), (1.55, 0.28), (0.95, 0.22)]
            pts = [(0.45, TOP - 0.1), (1.92, TOP + 0.22), tips[0], (1.78, 0.98), tips[1], (1.22, 0.62), tips[2], (0.68, 0.55), (0.45, 0.6)]
            plate([(s * x, z) for x, z in pts], WY + 0.06, 0.06, WING)
            for tx, tz in tips:
                limb((s * 1.88, WY + 0.06, TOP + 0.2), (s * tx, WY + 0.06, tz), 0.06, RIB)
            if s > 0:
                hand_mitt(hand[0] + s * 0.05, WY - 0.08, hand[2] + 0.05, s, MITT, SKIN)
            else:  # the bucket wing: a little hooked claw at the tip, the kid's own arm hangs in front
                can(hand[0] + s * 0.05, WY - 0.02, hand[2] + 0.12, 0.1, 0.3, RIB, n=6, r2=0.0, rot=(0, math.radians(-25), 0))
    # the right arm hangs at the side in a suit sleeve, carrying the full pumpkin bucket
    sx = -(TW * 0.5 + 0.08)
    with part("arm.r"):
        limb((sx, 0, TOP - 0.15), (sx - 0.16, -0.05, TOP - ARM_DROP), 0.11, SUIT)
    with part("hand.r"):
        hand_mitt(*hand_points()[-1], -1, MITT, SKIN)
    bucket(hand_points()[-1], full=True, size=0.6)
    with part("head"):
        hood()


def hood():
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
    # huge bat ears: the hood's top corners pull up and flare out into them
    hw = HEAD * 0.55
    for s in (-1, 1):
        hood_ear(s, s * (hw + 0.01), top - 0.55, 1.4, 1.75, -0.85, 0.9, SUIT, inner=EAR_IN, tip_in=-0.06, lift=0.75)

if __name__ == "__main__" or True:
    run({"vampire-bat": build})
