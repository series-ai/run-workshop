"""Cowboy: the kid under a huge tan cowboy hat (a creased crown, a wide brim
curling up at the sides, a dark band), a red spotted bandana, a blue shirt
with a brown leather vest and a gold sheriff star, a belt with a big buckle,
fringed leather chaps over blue jeans, brown boots with silver spurs, and a
lasso: a rope coil in the right mitten swinging a big loop out to the side.
Full bucket in the left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

HAT, HAT_D, BAND, SHIRT, JEANS = (0.86, 0.62, 0.34), (0.70, 0.46, 0.22), (0.36, 0.2, 0.1), (0.35, 0.60, 0.95), (0.25, 0.42, 0.78)
VEST, VEST_D, CHAPS, BOOT, GOLD = (0.55, 0.32, 0.16), (0.40, 0.22, 0.1), (0.72, 0.46, 0.24), (0.48, 0.26, 0.12), (1.0, 0.80, 0.16)
RED, ROPE, SILVER, HAIR = (0.9, 0.15, 0.15), (0.92, 0.76, 0.42), (0.8, 0.82, 0.86), (0.55, 0.30, 0.12)

X90 = (math.radians(90), 0, 0)


def arm(s, hand, sleeve, r=0.11, mitt=True):
    """A sleeve from the shoulder to a mitten at `hand`."""
    sh = (s * (TW * 0.5 + 0.08), 0, TOP - 0.15)
    d = [h - a for a, h in zip(sh, hand)]
    L = math.sqrt(sum(c * c for c in d))
    sd = "l" if s > 0 else "r"
    with part(f"arm.{sd}"):
        limb(sh, tuple(h - c / L * 0.14 for h, c in zip(hand, d)), r, sleeve)
    if mitt:
        with part(f"hand.{sd}"):
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


def ring(c, r, minor, rgb, rot=(0, 0, 0), n=16):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=minor, major_segments=n, minor_segments=4, location=c, rotation=rot)
    return finish(bpy.context.object, rgb)


def build():
    body(shirt=SHIRT, pants=JEANS, leg_colour=JEANS, shoe=BOOT, arms=False)
    fy = -TD * 0.5
    # boots: a heel, a cuff, a spur wheel at the back
    for s in (-1, 1):
        x = s * TW * 0.24
        with part("foot.l" if s > 0 else "foot.r"):
            box(x, 0.12, 0.08, 0.32, 0.3, 0.16, BAND, bevel=0.03)
            can(x, 0, FOOT * 0.6, 0.16, 0.22, BOOT, n=8)
            box(x, 0.36, 0.22, 0.04, 0.2, 0.04, SILVER)
            can(x, 0.48, 0.22, 0.13, 0.04, SILVER, n=6, rot=(0, math.radians(90), 0))
            ball(x, 0.48, 0.22, 0.08, 0.08, 0.08, SILVER, seg=6, ring=4)
    # chaps: leather over the jeans with fringe down the outside
    for s in (-1, 1):
        x = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            can(x, 0, HIP - 0.08, 0.17, 0.32, CHAPS, n=8)
            for k in range(4):
                box(x + s * 0.18, -0.1 + k * 0.07, HIP - 0.12, 0.04, 0.03, 0.3, CHAPS)
    # the belt and the big buckle
    with part("body"):
        box(0, 0, HIP + 0.08, TW + 0.04, TD + 0.04, 0.12, BAND, bevel=0.02)
        box(0, fy - 0.05, HIP + 0.08, 0.3, 0.06, 0.22, GOLD, bevel=0.04)
        box(0, fy - 0.08, HIP + 0.08, 0.16, 0.04, 0.1, SILVER)
    with part("chest"):
        # the vest: two front panels, a back, the sheriff star
        box(0, 0.1, HIP + TH * 0.62, TW + 0.06, TD - 0.1, TH * 0.72, VEST, bevel=0.06)
        for s in (-1, 1):
            box(s * (TW * 0.5 - 0.17), fy - 0.02, HIP + TH * 0.6, 0.34, 0.08, TH * 0.7, VEST, bevel=0.03)
            box(s * (TW * 0.5 - 0.17), fy - 0.06, HIP + TH * 0.3, 0.3, 0.03, 0.04, VEST_D)
        star(-0.3, fy - 0.08, HIP + TH * 0.72, 0.2, 0.06, GOLD, n=6, inner=0.55)
        # the bandana: a band round the neck, a spotted triangle at the front
        can(0, 0, TOP + 0.04, 0.44, 0.18, RED, n=8)
        can(0, fy - 0.12, TOP - 0.1, 0.3, 0.07, RED, n=3, rot=(math.radians(90), 0, math.radians(90)))
        for x, z in ((-0.1, TOP - 0.05), (0.1, TOP - 0.05), (0.0, TOP - 0.2)):
            box(x, fy - 0.16, z, 0.07, 0.03, 0.07, WHITE)
    # standard hanging arms: the left mitten with the bucket; the right mitten with a rope
    # coil and a big loop swung out to the side, clear of the head
    lh, rh = hand_points()[-1], hand_points()[1]
    arm(-1, lh, SHIRT, r=0.11)
    bucket(lh, full=True, size=0.6)
    arm(1, rh, SHIRT, r=0.11)
    with part("prop.l"):  # the whole lasso is one prop: the coil, the rope and the big loop
        for k in range(3):
            ring((rh[0] + 0.04, rh[1] - 0.05 + k * 0.05, rh[2] - 0.3), 0.27 - k * 0.02, 0.04, ROPE, rot=(math.radians(90), 0, math.radians(15)), n=12)
        lc = (rh[0] + 1.2, rh[1] - 0.1, rh[2] + 0.15)
        limb((rh[0] + 0.15, rh[1] - 0.05, rh[2] + 0.05), (lc[0] - 0.48, lc[1], lc[2] - 0.08), 0.045, ROPE)
        ring(lc, 0.5, 0.05, ROPE, rot=(math.radians(75), math.radians(10), 0), n=18)
    # the head
    w = HEAD
    kid_head(hair=HAIR)
    with part("head"):
        # the huge hat: wide brim curling up at the sides, a creased crown, a dark band
        hz = HEAD_Z + w * 0.4
        box(0, 0.0, hz, 3.2, w * 1.15, 0.12, HAT, bevel=0.2, segs=2)
        for s in (-1, 1):
            box(s * 1.72, 0.0, hz + 0.2, 0.6, w * 1.08, 0.12, HAT, bevel=0.2, segs=2, rot=(0, s * math.radians(-45), 0))
        box(0, 0.05, hz + 0.55, w * 0.72, w * 0.66, 1.0, HAT, bevel=0.3, segs=2)
        box(0, 0.05, hz + 0.2, w * 0.74, w * 0.68, 0.24, BAND, bevel=0.06)
        box(0, 0.1, hz + 1.03, 0.16, w * 0.3, 0.05, HAT_D)          # the crease along the top
        star(0.0, -w * 0.33 - 0.04, hz + 0.2, 0.12, 0.04, SILVER, n=5)


if __name__ == "__main__" or True:
    run({"cowboy": build})
