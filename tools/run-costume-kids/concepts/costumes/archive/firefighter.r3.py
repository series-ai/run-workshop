"""Firefighter: the kid in a big red fire helmet (long back brim, ribbed
dome, a gold shield badge standing up at the front), a yellow turnout coat
with silver reflective stripes and black clasps, tall black boots, and a
red hose that loops round the back and up to a brass nozzle in the right
mitten. The empty bucket hangs from the left mitten."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

YEL, YEL_D, STRIPE, LIME = (1.0, 0.80, 0.08), (0.88, 0.64, 0.05), (0.84, 0.87, 0.9), (0.80, 1.0, 0.25)
RED, RED_D, GOLD, BRASS, BOOT = (0.9, 0.12, 0.12), (0.66, 0.07, 0.08), (1.0, 0.78, 0.18), (0.95, 0.70, 0.25), (0.12, 0.11, 0.12)
HOSE, HAIR = (0.80, 0.12, 0.10), (0.32, 0.18, 0.09)

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


def hose(pts, r=0.12):
    for a, b in zip(pts, pts[1:]):
        limb(a, b, r, HOSE, n=8)
    for p in pts[1:-1]:
        ball(*p, r * 2.1, r * 2.1, r * 2.1, HOSE, seg=8, ring=5)


def build():
    body(shirt=YEL, pants=YEL, leg_colour=BOOT, shoe=BOOT, torso=False, arms=False)
    # tall boots: a cuff on each leg
    for s in (-1, 1):
        can(s * TW * 0.24, 0, HIP - 0.12, 0.18, 0.24, BOOT, n=8)
        can(s * TW * 0.24, 0, HIP - 0.01, 0.2, 0.06, YEL, n=8)
    # the coat: long, flaring a little, with silver stripes and black clasps
    can(0, 0, HIP + 0.05, TW * 0.68, 0.5, YEL, n=8, r2=TW * 0.6)
    box(0, 0, HIP + TH * 0.6, TW + 0.05, TD + 0.05, TH * 0.8, YEL, bevel=0.08)
    for z in (HIP - 0.08, HIP + TH * 0.5):
        box(0, 0, z, TW + 0.12, TD + 0.12, 0.13, STRIPE, bevel=0.03)
        box(0, 0, z + 0.075, TW + 0.1, TD + 0.1, 0.03, LIME)
        box(0, 0, z - 0.075, TW + 0.1, TD + 0.1, 0.03, LIME)
    fy = -(TD + 0.05) / 2
    box(0, fy - 0.01, HIP + 0.3, 0.04, 0.04, 1.1, YEL_D)
    for z in (HIP + 0.25, HIP + 0.72):
        box(0, fy - 0.04, z, 0.26, 0.06, 0.08, DARK, bevel=0.02)
    can(0, 0, TOP + 0.06, 0.5, 0.2, YEL, n=8)                               # the stand-up collar
    # left arm hangs with the bucket; right arm forward with the nozzle
    lh = (-0.76, -0.1, 0.7)
    arm(-1, lh, YEL, r=0.13)
    can(-0.69, -0.06, 0.9, 0.15, 0.1, STRIPE, n=8, rot=(0, math.radians(-20), 0))
    bucket(lh, full=False, size=0.6)
    rh = (0.95, -0.6, 0.95)
    arm(1, rh, YEL, r=0.13)
    bar((0.82, -0.42, 1.05), (0.86, -0.48, 1.0), 0.15, 0.15, STRIPE, n=8)
    bar((rh[0], rh[1] - 0.15, rh[2] + 0.02), (rh[0], rh[1] - 0.45, rh[2] + 0.08), 0.13, 0.13, BRASS, n=8)
    bar((rh[0], rh[1] - 0.45, rh[2] + 0.08), (rh[0], rh[1] - 0.85, rh[2] + 0.16), 0.11, 0.05, BRASS, n=8)
    can(rh[0], rh[1] - 0.3, rh[2] + 0.06, 0.16, 0.1, DARK, n=8, rot=(math.radians(80), 0, 0))
    hand_mitt(*rh, 1, MITT, SKIN)
    # the hose: from the nozzle down to the ground, round the back, in a coil
    hose([(rh[0] + 0.05, rh[1] + 0.25, rh[2] - 0.1), (1.25, -0.15, 0.55), (1.35, 0.5, 0.14), (0.9, 1.25, 0.14),
          (-0.2, 1.5, 0.14), (-1.1, 1.2, 0.14), (-1.4, 0.4, 0.14), (-1.2, -0.2, 0.14)])
    for k in range(2):
        o = bpy.ops.mesh.primitive_torus_add(major_radius=0.5 - k * 0.04, minor_radius=0.12, major_segments=14, minor_segments=6,
                                             location=(-1.6, 0.9, 0.12 + k * 0.22))
        finish(bpy.context.object, HOSE if k == 0 else RED_D)
    # the head
    kid_head(hair=HAIR)
    # the helmet: a ribbed dome on a brim that runs long at the back
    w = HEAD
    hz = HEAD_Z + 0.95
    box(0, 0.35, hz - 0.35, w * 1.2, w * 1.4, 0.14, RED, bevel=0.3, segs=2, rot=(math.radians(-6), 0, 0))
    box(0, 0.08, hz + 0.1, w * 1.06, w * 1.02, 1.05, RED, bevel=0.45, segs=3)
    for x in (-0.45, 0.0, 0.45):
        box(x, 0.1, hz + 0.58, 0.14, w * 0.85, 0.16, RED_D, bevel=0.05)
    # the shield badge standing up at the front
    by, bz = -w * 0.47 - 0.2, hz + 0.45
    box(0, by, bz, 1.0, 0.12, 0.85, GOLD, bevel=0.06, rot=(math.radians(15), 0, 0))
    box(0, by + 0.1, bz - 0.36, 0.64, 0.11, 0.64, GOLD, bevel=0.04, rot=(math.radians(15), math.radians(45), 0))
    box(0, by - 0.06, bz + 0.03, 0.74, 0.08, 0.6, WHITE, bevel=0.03, rot=(math.radians(15), 0, 0))
    box(0, by - 0.11, bz + 0.03, 0.14, 0.06, 0.46, RED, rot=(math.radians(15), 0, 0))           # a big "1"
    box(-0.06, by - 0.12, bz + 0.21, 0.14, 0.06, 0.08, RED, rot=(math.radians(15), 0, math.radians(0)))


if __name__ == "__main__" or True:
    run({"firefighter": build})
