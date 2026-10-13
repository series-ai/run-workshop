"""Black cat onesie: the spooky-cute counterpart to the tabby cat onesie. A
soft black kigurumi with a big hood, pointy ears (pink inside) and two big
glowing yellow cat eyes with slit pupils on the hood above the kid's face.
The face sits a little lower in a smoky-grey rim with painted whiskers and a
pink nose; a grey belly patch, a purple collar with a gold bell, black paw
mitts with pink pads and a long black tail curling up with a purple bow.
Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

BLACK, BLACK_D, RIM, BELLY = (0.17, 0.16, 0.22), (0.10, 0.09, 0.13), (0.46, 0.44, 0.54), (0.34, 0.32, 0.40)
PINK, NOSE, EYE, EYE_HI = (1.0, 0.62, 0.72), (0.95, 0.42, 0.55), (1.0, 0.86, 0.12), (1.0, 0.98, 0.70)
COLLAR, BELL = (0.62, 0.30, 0.86), (1.0, 0.78, 0.22)


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


def glow(o, strength=1.5):
    """Make an object's material glow a little (the hood eyes)."""
    m = o.data.materials[0].copy()
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    c = m.diffuse_color
    bsdf.inputs["Emission Color"].default_value = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1.0)
    bsdf.inputs["Emission Strength"].default_value = strength
    o.data.materials[0] = m
    return o


def paw(x, y, z, s):
    hand_mitt(x, y, z, s, MITT, BLACK)
    ball(x, y - MITT * 0.5, z - 0.04, 0.2, 0.06, 0.18, PINK, seg=6, ring=4)
    for k in (-1, 0, 1):
        ball(x + k * 0.1, y - MITT * 0.5, z + 0.13, 0.07, 0.05, 0.07, PINK, seg=6, ring=4)


def build():
    body(shirt=BLACK, pants=BLACK, leg_colour=BLACK, shoe=BLACK_D, arms=False)
    fy = -TD * 0.5
    box(0, fy - 0.01, HIP + TH * 0.42, TW * 0.55, 0.04, TH * 0.64, BELLY, bevel=0.02)
    # the collar and bell
    box(0, 0, TOP - 0.06, TW + 0.06, TD + 0.06, 0.12, COLLAR, bevel=0.04)
    ball(0, fy - 0.1, TOP - 0.18, 0.2, 0.18, 0.2, BELL, seg=8, ring=6)
    box(0, fy - 0.19, TOP - 0.22, 0.1, 0.02, 0.03, DARK)
    # the arms: the right hangs, the left holds the bucket
    sx = TW * 0.5 + 0.08
    limb((sx, 0, TOP - 0.15), (sx + 0.16, -0.05, TOP - ARM_DROP), 0.11, BLACK)
    paw(sx + 0.18, -0.08, TOP - 0.66, 1)
    hx, hy, hz = -1.15, -0.3, TOP - 0.2
    limb((-sx, 0, TOP - 0.15), (hx + 0.12, hy, hz + 0.05), 0.11, BLACK)
    paw(hx, hy, hz, -1)
    bucket((hx, hy, hz), full=True, size=0.6)
    # the long black tail curling up at the side, a purple bow near the tip
    pts = [(0.0, 0.3, HIP + 0.1), (0.35, 0.65, HIP - 0.02), (0.8, 0.8, HIP + 0.05), (1.15, 0.75, HIP + 0.35), (1.3, 0.6, HIP + 0.75),
           (1.22, 0.45, HIP + 1.05), (1.0, 0.4, HIP + 1.12), (0.9, 0.42, HIP + 0.92)]
    for a, b in zip(pts, pts[1:]):
        bar(a, b, 0.13, 0.13, BLACK, n=6)
        ball(*b, 0.26, 0.26, 0.26, BLACK, seg=6, ring=4)
    bx, by, bz = pts[4]
    for s in (-1, 1):
        o = can(bx + s * 0.14, by, bz, 0.13, 0.26, COLLAR, n=4, r2=0.02, rot=(0, s * math.radians(-90), 0))
    ball(bx, by, bz, 0.14, 0.3, 0.14, COLLAR, seg=6, ring=4)
    # the hood: a big black block, a grey rim and the kid's face lower in the opening
    box(0, 0.2, HEAD_Z + 0.05, HEAD * 1.1, HEAD * 0.96, HEAD * 1.06, BLACK, bevel=0.5, segs=2)
    fz = HEAD_Z - 0.38
    box(0, -0.18, fz, HEAD * 0.86, HEAD * 0.76, HEAD * 0.68, RIM, bevel=0.4, segs=2)
    box(0, -0.25, fz, HEAD * 0.78, HEAD * 0.76, HEAD * 0.6, SKIN, bevel=0.36, segs=2)
    ffy = -0.25 - HEAD * 0.38
    face(0, fz, ffy, HEAD * 0.8, smile=False)
    can(0, ffy - 0.03, fz - 0.12, 0.09, 0.05, NOSE, n=3, rot=(math.radians(90), 0, math.radians(180)))
    for s in (-1, 1):
        box(s * 0.08, ffy - 0.02, fz - 0.26, 0.16, 0.04, 0.05, DARK, rot=(0, s * math.radians(25), 0))
        for k, ang in ((-1, -12), (1, 12)):
            box(s * 0.55, ffy - 0.02, fz - 0.2 + k * 0.08, 0.36, 0.03, 0.035, DARK, rot=(0, s * math.radians(ang), 0))
    # the glowing yellow cat eyes on the hood, above the face: almond shapes with slit pupils
    hfy = 0.2 - HEAD * 0.48
    ez = HEAD_Z + 0.88
    for s in (-1, 1):
        ex = s * 0.6
        o = box(ex, hfy - 0.02, ez, 0.62, 0.08, 0.36, EYE, bevel=0.12, segs=2, rot=(0, s * math.radians(-12), 0))
        glow(o, 2.0)
        box(ex, hfy - 0.07, ez, 0.08, 0.04, 0.32, BLACK_D, bevel=0.02)
        box(ex - s * 0.14, hfy - 0.07, ez + 0.07, 0.07, 0.03, 0.07, EYE_HI)
    # big cat ears
    top = HEAD_Z + 0.05 + HEAD * 0.53
    for s in (-1, 1):
        o = can(s * 0.82, 0.1, top + 0.38, 0.62, 0.9, BLACK, n=4, r2=0.0, rot=(0, s * math.radians(-10), math.radians(45)))
        squash(o, 1.0, 0.5, 1.0)
        o = can(s * 0.8, -0.08, top + 0.3, 0.36, 0.55, PINK, n=4, r2=0.0, rot=(0, s * math.radians(-10), math.radians(45)))
        squash(o, 1.0, 0.4, 1.0)


if __name__ == "__main__" or True:
    run({"black-cat": build})
