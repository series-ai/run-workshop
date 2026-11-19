"""Cat onesie: the kid in an orange tabby kigurumi: a big hood with pointy
cat ears and darker stripes, the kid's face in a cream-rimmed opening with
painted whiskers and a pink nose, a cream belly patch, paw mitts with pink
pads and a long striped tail curling up at the side. Carries the empty
bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

ORANGE, STRIPE, CREAM = (1.0, 0.56, 0.16), (0.82, 0.34, 0.06), (1.0, 0.90, 0.74)
PINK, NOSE = (1.0, 0.62, 0.72), (0.95, 0.42, 0.55)


def squash(o, sx=1.0, sy=1.0, sz=1.0):
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    return o


def bar(p0, p1, r0, r1, rgb, n=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


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


def paw(x, y, z, s):
    hand_mitt(x, y, z, s, MITT, ORANGE)
    ball(x, y - MITT * 0.5, z - 0.04, 0.2, 0.06, 0.18, PINK, seg=6, ring=4)
    for k in (-1, 0, 1):
        ball(x + k * 0.1, y - MITT * 0.5, z + 0.13, 0.07, 0.05, 0.07, PINK, seg=6, ring=4)


def build():
    body(shirt=ORANGE, pants=ORANGE, leg_colour=ORANGE, shoe=STRIPE, arms=False)
    with part("chest"):
        fy = -TD * 0.5
        # the cream belly patch and tabby stripes on the sides
        box(0, fy - 0.01, HIP + TH * 0.45, TW * 0.55, 0.04, TH * 0.7, CREAM, bevel=0.02)
        for s in (-1, 1):
            for z in (HIP + 0.25, HIP + 0.55):
                box(s * (TW * 0.5 - 0.1), fy - 0.01, z, 0.2, 0.04, 0.09, STRIPE)
    # the arms: stripes on the sleeves, the right hangs, the left holds the bucket (both hang: the rig swings a raised arm down)
    sx = TW * 0.5 + 0.08
    for s in (-1, 1):
        side = "l" if s > 0 else "r"
        with part("arm." + side):
            limb((s * sx, 0, TOP - 0.15), (s * (sx + 0.16), -0.05, TOP - ARM_DROP), 0.11, ORANGE)
            can(s * (sx + 0.09), -0.03, TOP - 0.33, 0.12, 0.08, STRIPE, n=6)
        with part("hand." + side):
            paw(s * (sx + 0.18), -0.08, TOP - 0.66, s)
    bucket(hand_points()[-1], full=False, size=0.6)
    with part("body"):  # the tail is the onesie's: it rides the hips
        # the long tail: out of the back, sweeping round to the side and curling up
        pts = [(0.0, 0.3, HIP + 0.1), (0.35, 0.65, HIP - 0.02), (0.8, 0.8, HIP + 0.05), (1.15, 0.75, HIP + 0.35), (1.3, 0.6, HIP + 0.75),
               (1.22, 0.45, HIP + 1.05), (1.0, 0.4, HIP + 1.12), (0.9, 0.42, HIP + 0.92)]
        for i, (a, b) in enumerate(zip(pts, pts[1:])):
            bar(a, b, 0.13, 0.13, STRIPE if i % 2 else ORANGE, n=6)
            ball(*b, 0.26, 0.26, 0.26, STRIPE if i % 2 else ORANGE, seg=6, ring=4)
        ball(*pts[-1], 0.3, 0.3, 0.3, CREAM, seg=6, ring=4)
    with part("head"):
        # the hood: a big orange block, a cream rim and the kid's face in the opening
        box(0, 0.2, HEAD_Z + 0.12, HEAD * 1.05, HEAD * 0.96, HEAD * 1.02, ORANGE, bevel=0.5, segs=2)
        fz = HEAD_Z - 0.15
        box(0, -0.18, fz, HEAD * 0.88, HEAD * 0.76, HEAD * 0.76, CREAM, bevel=0.42, segs=2)
        box(0, -0.25, fz, HEAD * 0.8, HEAD * 0.76, HEAD * 0.68, SKIN, bevel=0.38, segs=2)
        ffy = -0.25 - HEAD * 0.38
        face(0, fz, ffy, HEAD * 0.82, smile=False)
        # a little "w" cat mouth, a pink nose and painted whiskers
        can(0, ffy - 0.03, fz - 0.12, 0.09, 0.05, NOSE, n=3, rot=(math.radians(90), 0, math.radians(180)))
        for s in (-1, 1):
            box(s * 0.08, ffy - 0.02, fz - 0.26, 0.16, 0.04, 0.05, DARK, rot=(0, s * math.radians(25), 0))
            for k, ang in ((-1, -12), (1, 12)):
                box(s * 0.55, ffy - 0.02, fz - 0.2 + k * 0.08, 0.36, 0.03, 0.035, DARK, rot=(0, s * math.radians(ang), 0))
        # tabby stripes over the top of the hood and down its sides
        top = HEAD_Z + 0.12 + HEAD * 0.51
        for x in (-0.22, 0.22):
            box(x, 0.25, top - 0.03, 0.2, 1.5, 0.1, STRIPE)
        for s in (-1, 1):
            for z in (HEAD_Z + 0.35, HEAD_Z - 0.15):
                box(s * HEAD * 0.525, 0.3, z, 0.1, 1.1, 0.16, STRIPE)
        # big cat ears: the hood's top corners pull up into thick ears
        hw, hb = HEAD * 0.525, 0.5
        for s in (-1, 1):
            hood_ear(s, s * (hw + 0.01), top - 0.9, 1.2, 2.15, -0.85, 0.9, ORANGE, inner=PINK, tip_in=0.18, lift=1.0)


if __name__ == "__main__" or True:
    run({"cat-onesie": build})
