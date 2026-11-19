"""Cat onesie: the kid in an orange tabby kigurumi: a big hood with pointy
cat ears and darker stripes, the kid's face in a cream-rimmed opening with
painted whiskers and a pink nose, a cream belly patch, paw mitts with pink
pads and a long striped tail curling up at the side. Carries the empty
bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
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


def paw(x, y, z, s):
    hand_mitt(x, y, z, s, MITT, ORANGE)
    ball(x, y - MITT * 0.5, z - 0.04, 0.2, 0.06, 0.18, PINK, seg=6, ring=4)
    for k in (-1, 0, 1):
        ball(x + k * 0.1, y - MITT * 0.5, z + 0.13, 0.07, 0.05, 0.07, PINK, seg=6, ring=4)


def build():
    body(shirt=ORANGE, pants=ORANGE, leg_colour=ORANGE, shoe=STRIPE, arms=False)
    fy = -TD * 0.5
    # the cream belly patch and tabby stripes on the sides
    box(0, fy - 0.01, HIP + TH * 0.45, TW * 0.55, 0.04, TH * 0.7, CREAM, bevel=0.02)
    for s in (-1, 1):
        for z in (HIP + 0.25, HIP + 0.55):
            box(s * (TW * 0.5 - 0.1), fy - 0.01, z, 0.2, 0.04, 0.09, STRIPE)
    # the arms: stripes on the sleeves, the right hangs, the left holds the bucket
    sx = TW * 0.5 + 0.08
    limb((sx, 0, TOP - 0.15), (sx + 0.16, -0.05, TOP - ARM_DROP), 0.11, ORANGE)
    can(sx + 0.09, -0.03, TOP - 0.33, 0.12, 0.08, STRIPE, n=6)
    paw(sx + 0.18, -0.08, TOP - 0.66, 1)
    hx, hy, hz = -1.15, -0.3, TOP - 0.2
    limb((-sx, 0, TOP - 0.15), (hx + 0.12, hy, hz + 0.05), 0.11, ORANGE)
    bar((-sx - 0.2, -0.12, TOP - 0.15), (-sx - 0.3, -0.16, TOP - 0.16), 0.12, 0.12, STRIPE)
    paw(hx, hy, hz, -1)
    bucket((hx, hy, hz), full=False, size=0.6)
    # the long tail: out of the back, sweeping round to the side and curling up
    pts = [(0.0, 0.3, HIP + 0.1), (0.35, 0.65, HIP - 0.02), (0.8, 0.8, HIP + 0.05), (1.15, 0.75, HIP + 0.35), (1.3, 0.6, HIP + 0.75),
           (1.22, 0.45, HIP + 1.05), (1.0, 0.4, HIP + 1.12), (0.9, 0.42, HIP + 0.92)]
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        bar(a, b, 0.13, 0.13, STRIPE if i % 2 else ORANGE, n=6)
        ball(*b, 0.26, 0.26, 0.26, STRIPE if i % 2 else ORANGE, seg=6, ring=4)
    ball(*pts[-1], 0.3, 0.3, 0.3, CREAM, seg=6, ring=4)
    # the hood: a big orange block, a cream rim and the kid's face in the opening
    box(0, 0.2, HEAD_Z + 0.05, HEAD * 1.1, HEAD * 0.96, HEAD * 1.06, ORANGE, bevel=0.5, segs=2)
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
    top = HEAD_Z + 0.05 + HEAD * 0.53
    for x in (-0.45, 0.0, 0.45):
        box(x, 0.25, top - 0.03, 0.2, 1.5, 0.1, STRIPE)
    for s in (-1, 1):
        for z in (HEAD_Z + 0.35, HEAD_Z - 0.15):
            box(s * HEAD * 0.55, 0.3, z, 0.1, 1.1, 0.16, STRIPE)
    # big cat ears
    for s in (-1, 1):
        o = can(s * 0.82, 0.1, top + 0.38, 0.62, 0.9, ORANGE, n=4, r2=0.0, rot=(0, s * math.radians(-10), math.radians(45)))
        squash(o, 1.0, 0.5, 1.0)
        o = can(s * 0.8, -0.08, top + 0.3, 0.36, 0.55, PINK, n=4, r2=0.0, rot=(0, s * math.radians(-10), math.radians(45)))
        squash(o, 1.0, 0.4, 1.0)


if __name__ == "__main__" or True:
    run({"cat-onesie": build})
