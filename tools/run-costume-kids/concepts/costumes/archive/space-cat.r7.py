"""Space cat: the spaceman crossover. The same puffy white suit, backpack and
fishbowl helmet, but in pink trim: inside the bowl the kid wears a pink
headband with two chunky white cat ears, the kid inside has whiskers and a pink nose painted on, a
puffy suit tail curls out the back, and the little flag has a fish on it.
Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

# the spaceman's suit, helmet and arms (its source, minus its run line)
_src = open(_PKG + "/concepts/costumes/spaceman.py").read()
exec(compile(_src[: _src.rindex("\nif __name__")], "spaceman.py", "exec"))

PINK, PINK_D, NOSE, FISH = (1.0, 0.55, 0.72), (0.9, 0.38, 0.6), (0.95, 0.42, 0.55), (0.3, 0.75, 0.95)


def squash(o, sx=1.0, sy=1.0, sz=1.0):
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
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


def fish(x, y, z):
    """A little fish on the flag: a body, a tail fin and an eye."""
    ball(x + 0.05, y - 0.05, z, 0.34, 0.06, 0.22, FISH, seg=8, ring=6)
    can(x - 0.2, y - 0.05, z, 0.12, 0.05, FISH, n=3, rot=(math.radians(90), 0, math.radians(90)))
    can(x + 0.14, y - 0.09, z + 0.03, 0.025, 0.03, DARK, n=6, rot=X90)


def build():
    suit(trim=PINK)
    arms_flag_bucket(flag=PINK, emblem=fish)
    cz = HEAD_Z + 0.32
    r = 2.12
    helmet(cz, r, collar_rgb=PINK)
    # whiskers and a pink nose painted on the kid inside
    fz, fy = HEAD_Z - HEAD * 0.05, -HEAD * 0.46
    can(0, fy - 0.03, fz - 0.14, 0.09, 0.05, NOSE, n=3, rot=(math.radians(90), 0, math.radians(180)))
    for s in (-1, 1):
        for k, ang in ((-1, -12), (1, 12)):
            box(s * 0.74, fy - 0.03, fz - 0.27 + k * 0.09, 0.42, 0.03, 0.035, DARK, rot=(0, s * math.radians(ang), 0))
    # cat ears on a pink headband over the kid's hair, inside the bowl
    ht = HEAD_Z + HEAD * 0.3 + HEAD * 0.18          # top of the hair cap
    box(0, 0.05, ht, HEAD * 1.07, 0.32, 0.14, PINK, bevel=0.05)
    for s in (-1, 1):
        box(s * HEAD * 0.535, 0.05, ht - 0.38, 0.14, 0.32, 0.8, PINK, bevel=0.05)
        hood_ear(s, s * 1.24, ht - 0.12, 1.02, 1.08, -0.24, 0.34, SUIT, inner=PINK, tip_in=0.22, lift=0.28, bevel=0.08)
    # a puffy suit tail curling out of the back, pink tip
    pts = [(0.0, 0.5, HIP + 0.15), (0.1, 1.0, HIP + 0.0), (0.2, 1.45, HIP + 0.2), (0.25, 1.65, HIP + 0.6), (0.15, 1.55, HIP + 0.95)]
    for i, (p0, p1) in enumerate(zip(pts, pts[1:])):
        limb(p0, p1, 0.14, SUIT, n=8)
        ball(*p1, 0.34, 0.34, 0.34, PINK if i == len(pts) - 2 else SUIT, seg=8, ring=6)


if __name__ == "__main__" or True:
    run({"space-cat": build})
