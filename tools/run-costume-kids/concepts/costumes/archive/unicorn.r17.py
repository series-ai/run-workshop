"""Unicorn: the kid in a pastel pink unicorn onesie. The hood encloses the
kid's head with the whole face showing in a white-rimmed opening; pointy
ears grow out of the hood's top corners, a huge gold-and-cream spiral horn
stands up from the brow, and a big chunky rainbow mane runs from the crown
down the back to the waist, with a rainbow forelock. A lilac belly patch,
gold hoof shoes, a rainbow tail curling up behind, pink cuffs. Carries the
full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

R = math.radians
FY = -HEAD * 0.46
SX = TW * 0.5 + 0.08
PINK, PINK_D, RIM, LILAC = (1.0, 0.80, 0.90), (0.95, 0.64, 0.80), (1.0, 0.98, 1.0), (0.80, 0.72, 1.0)
HORN, HORN_L, HOOF = (1.0, 0.82, 0.30), (1.0, 0.96, 0.78), (0.95, 0.72, 0.25)
RAINBOW = [(1.0, 0.36, 0.42), (1.0, 0.62, 0.25), (1.0, 0.88, 0.30), (0.45, 0.86, 0.45), (0.35, 0.65, 1.0), (0.66, 0.45, 0.95)]


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


def hood_ear(s, xo, zb, bw, h, yf, yb, rgb, inner=None, tip_d=0.3, tip_in=0.3, bevel=0.1, lift=0.7):
    """A thick ear growing out of a hood's top corner (from cat-onesie.py)."""
    xi, xt, zt = xo - s * bw, xo - s * bw * tip_in, zb + h
    outer = [(xo, zb), (xt, zt)]
    poly = outer + [(xi, zb)]
    front = [(x, yf, z) for x, z in poly]
    back = [(x, yb, z) for x, z in poly]
    front[1] = (xt, yf + 0.04, zt)
    back[1] = (xt, yf + tip_d, zt)
    wedge(front, back, rgb, bevel)
    if inner:
        def at(edge, z):
            (x0, z0), (x1, z1) = edge
            return x0 + (x1 - x0) * (z - z0) / max(z1 - z0, 1e-6)
        zl = zb + lift
        xol, xil = at(outer, zl) - s * 0.16, at([(xi, zb), (xt, zt)], zl) + s * 0.16
        tri = [(xol, zl), (xil, zl), (xt, zt - 0.32)]
        wedge([(x, yf - 0.03, z) for x, z in tri], [(x, yf + 0.05, z) for x, z in tri], inner, 0.03)


def build():
    body(shirt=PINK, pants=PINK, leg_colour=PINK, shoe=HOOF, arms=False)
    fy = -TD * 0.5
    with part("chest"):
        box(0, fy - 0.01, HIP + TH * 0.45, TW * 0.58, 0.04, TH * 0.72, LILAC, bevel=0.03)  # belly patch
    for s in (-1, 1):  # hoof rims on the shoes
        with part("foot.l" if s > 0 else "foot.r"):
            box(s * TW * 0.24, -FOOT * 0.25, FOOT * 0.46, FOOT * 0.8, FOOT * 1.2, 0.08, PINK_D, bevel=0.03)
    # both arms hang, pink cuffs; the right mitt (-x) carries the bucket
    for s in (-1, 1):
        side = "l" if s > 0 else "r"
        h = hand_points()[s]
        with part(f"arm.{side}"):
            limb((s * SX, 0, TOP - 0.15), (s * SX + s * 0.16, -0.05, TOP - ARM_DROP), 0.11, PINK)
        with part(f"hand.{side}"):
            can(h[0] - s * 0.02, h[1] + 0.02, h[2] + 0.28, 0.15, 0.1, PINK_D, n=8)
            hand_mitt(*h, s, MITT, SKIN)
    bucket(hand_points()[-1], full=True, size=0.6)
    # the rainbow tail: out of the back, curling up
    with part("body"):
        pts = [(0.0, 0.35, HIP + 0.15), (0.25, 0.8, HIP + 0.0), (0.6, 1.05, HIP + 0.2), (0.85, 1.1, HIP + 0.6), (0.9, 1.0, HIP + 1.0), (0.7, 0.9, HIP + 1.25)]
        for i, (a, b) in enumerate(zip(pts, pts[1:])):
            bar(a, b, 0.2, 0.2, RAINBOW[i % 6], n=8)
            ball(*b, 0.48 - i * 0.03, 0.48 - i * 0.03, 0.48 - i * 0.03, RAINBOW[i % 6], seg=8, ring=5)
    with part("head"):
        hood()


def hood():
    # the head, then the hood round it (encloses the head; the face shows in the rim)
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
    face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
    hz = HEAD_Z + 0.19
    HW, HH = HEAD * 1.22, HEAD * 1.04
    box(0, 0.2, hz, HW, HEAD * 0.98, HH, PINK, bevel=0.6, segs=3)
    # the fluffy white rim round the face opening, just behind the face
    box(0, FY + 0.3, HEAD_Z + 0.06, HEAD * 1.1, 0.5, HEAD * 0.95, RIM, bevel=0.22, segs=3)
    top = hz + HH * 0.5
    # the ears out of the hood's top corners
    for s in (-1, 1):
        hood_ear(s, s * (HW * 0.5 - 0.02), top - 0.85, 1.0, 2.2, -0.45, 0.65, PINK, inner=LILAC, tip_in=0.15, lift=1.0)
    # the rainbow mane: six fat strands side by side from the brow over the crown
    # and down the back to the waist, curling out at the end
    path = [(-0.75, top + 0.05), (-0.2, top + 0.3), (0.4, top + 0.38), (1.0, top + 0.2), (1.5, top - 0.3), (1.78, top - 1.0),
            (1.85, top - 1.8), (1.8, top - 2.6), (1.95, top - 3.2), (2.2, top - 3.45)]
    for k, c in enumerate(RAINBOW):
        x = -0.75 + k * 0.3
        pts = [(x * (1.0 + 0.12 * (i > 4)), y + 0.08 * math.sin(k * 1.3 + i), z) for i, (y, z) in enumerate(path)]
        for i, (a_, b_) in enumerate(zip(pts, pts[1:])):
            bar(a_, b_, 0.29, 0.29, c, n=8)
            ball(*b_, 0.6, 0.6, 0.6, c, seg=8, ring=5)
        ball(*pts[0], 0.6, 0.6, 0.6, c, seg=8, ring=5)
    # the huge spiral horn: banded frustums leaning a little forward, a spiral ridge
    base = Vector((0, -0.55, top - 0.15))
    d = Vector((0, -0.22, 1.0)).normalized()
    L, r0 = 3.0, 0.62
    n = 7
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        bar(base + d * L * t0, base + d * L * t1, r0 * (1 - t0) + 0.02, r0 * (1 - t1) + 0.02, HORN if i % 2 == 0 else HORN_L, n=10)
    for i in range(40):  # the spiral ridge
        t = i / 40
        a = t * 2 * math.pi * 3.5
        rr = r0 * (1 - t) + 0.02
        p = base + d * L * t + Vector((rr * math.cos(a), rr * math.sin(a) * 0.95, 0))
        ball(*p, 0.16 * (1 - t * 0.6), 0.16 * (1 - t * 0.6), 0.16 * (1 - t * 0.6), HORN_L, seg=6, ring=4)
    ball(*(base + d * L), 0.12, 0.12, 0.12, HORN_L, seg=6, ring=4)


if __name__ == "__main__" or True:
    render_costume("unicorn", build, sys.argv[sys.argv.index("--") + 1], ortho=9.6, target_z=3.9)
