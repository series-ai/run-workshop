"""Werewolf: the kid in a big furry wolf hood (the wolf's head sits on top,
pointy ears, a long snout with a black nose and two little fangs over the
kid's brow, fur tufts at the cheeks), a torn red/black flannel shirt, jeans,
and furry mitts with white claws. Carries the empty bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

FUR, FUR_D, MUZZLE = (0.52, 0.44, 0.40), (0.38, 0.31, 0.29), (0.80, 0.72, 0.64)
RED, CHECK, JEANS = (0.88, 0.16, 0.14), (0.16, 0.08, 0.08), (0.30, 0.46, 0.75)
EAR_IN, CLAW, WOLF_EYE = (0.95, 0.60, 0.65), (0.98, 0.96, 0.90), (1.0, 0.82, 0.15)


def squash(o, sx=1.0, sy=1.0, sz=1.0):
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    return o


def claw_mitt(x, y, z, s):
    hand_mitt(x, y, z, s, MITT, FUR)
    for k in (-1, 0, 1):
        can(x + k * 0.1, y - 0.2, z - 0.24, 0.05, 0.16, CLAW, n=4, r2=0.0, rot=(math.radians(200), 0, 0))


def build():
    body(shirt=RED, pants=JEANS, arms=False)
    # flannel checks: two dark stripes down and across the shirt front, a ragged hem
    fy = -TD * 0.5 - 0.01
    for s in (-1, 1):
        box(s * 0.22, fy, HIP + TH * 0.66, 0.12, 0.03, TH * 0.66, CHECK)
    box(0, fy - 0.005, HIP + TH * 0.7, TW, 0.03, 0.1, CHECK)
    for k in (-1.5, -0.5, 0.5, 1.5):
        can(k * 0.22, fy + 0.02, HIP + TH * 0.3, 0.09, 0.16, RED, n=4, r2=0.0, rot=(math.radians(180), 0, 0))
    box(0.2, fy - 0.01, HIP + 0.14, 0.2, 0.03, 0.14, (0.55, 0.68, 0.92))  # a jeans patch
    # arms: the right one hangs, the left holds the bucket up
    sx = TW * 0.5 + 0.08
    limb((sx, 0, TOP - 0.15), (sx + 0.16, -0.05, TOP - ARM_DROP), 0.11, RED)
    claw_mitt(sx + 0.18, -0.08, TOP - 0.66, 1)
    hx, hy, hz = -1.15, -0.3, TOP - 0.2
    limb((-sx, 0, TOP - 0.15), (hx + 0.12, hy, hz + 0.05), 0.11, RED)
    claw_mitt(hx, hy, hz, -1)
    bucket((hx, hy, hz), full=False, size=0.6)
    # a big bushy tail sticking out the back
    pts = [(0, 0.3, HIP + 0.1, 0.16), (0.1, 0.65, HIP + 0.05, 0.26), (0.25, 1.0, HIP + 0.2, 0.3), (0.38, 1.25, HIP + 0.5, 0.24), (0.42, 1.35, HIP + 0.8, 0.12)]
    for (x0, y0, z0, r0), (x1, y1, z1, r1) in zip(pts, pts[1:]):
        p0, p1 = Vector((x0, y0, z0)), Vector((x1, y1, z1))
        d = p1 - p0
        o = can(0, 0, 0, r0, d.length, FUR if r1 > 0.13 else MUZZLE, n=6, r2=r1)
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = d.to_track_quat("Z", "Y")
        o.location = (p0 + p1) / 2
    # a fur ruff round the neck
    can(0, 0, TOP + 0.08, 0.68, 0.3, FUR, n=8, r2=0.55)
    # the kid's head (skin only, the hood is the hair)
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
    face(0, HEAD_Z - 0.18, -HEAD * 0.46, HEAD)
    # the hood: back and sides framing the face, a fur cap (the wolf's head) on top
    box(0, 0.3, HEAD_Z - 0.05, HEAD * 1.14, HEAD * 0.86, HEAD * 1.02, FUR, bevel=0.4, segs=2)
    cap_z = HEAD_Z + 0.95
    box(0, -0.06, cap_z, HEAD * 1.18, HEAD * 1.0, 1.15, FUR, bevel=0.32, segs=2)
    front = -0.06 - HEAD * 0.5
    # the wolf's eyes on the cap, with cheeky brows
    for s in (-1, 1):
        box(s * 0.62, front - 0.02, cap_z + 0.22, 0.3, 0.05, 0.22, WOLF_EYE)
        box(s * 0.6, front - 0.05, cap_z + 0.2, 0.12, 0.04, 0.16, DARK)
        box(s * 0.6, front - 0.03, cap_z + 0.42, 0.42, 0.06, 0.1, FUR_D, rot=(0, s * math.radians(-14), 0))
    # the snout, the nose and two little fangs over the kid's brow
    box(0, front - 0.45, cap_z - 0.2, 0.95, 1.0, 0.6, MUZZLE, bevel=0.14, segs=2)
    box(0, front - 0.4, cap_z + 0.08, 0.82, 0.85, 0.24, FUR, bevel=0.08)
    ball(0, front - 0.95, cap_z - 0.0, 0.42, 0.24, 0.3, DARK, seg=8, ring=5)
    for s in (-1, 1):
        can(s * 0.26, front - 0.8, cap_z - 0.58, 0.08, 0.24, CLAW, n=4, r2=0.0, rot=(math.radians(180), 0, 0))
    # big pointy ears
    for s in (-1, 1):
        ex, ez = s * 0.88, cap_z + 0.5
        o = can(ex, 0.05, ez + 0.4, 0.55, 0.95, FUR, n=4, r2=0.0, rot=(0, s * math.radians(-12), math.radians(45)))
        squash(o, 1.0, 0.55, 1.0)
        o = can(ex - s * 0.02, -0.12, ez + 0.32, 0.32, 0.6, EAR_IN, n=4, r2=0.0, rot=(0, s * math.radians(-12), math.radians(45)))
        squash(o, 1.0, 0.4, 1.0)
    # fur tufts: wedges at the cheeks and one on top
    for s in (-1, 1):
        for dz, ang in ((-0.85, 125), (-0.35, 105)):
            can(s * HEAD * 0.6, -0.2, HEAD_Z + dz, 0.28, 0.65, FUR, n=4, r2=0.0, rot=(0, s * math.radians(ang), 0))
    can(0, 0.1, cap_z + 0.62, 0.2, 0.45, FUR_D, n=4, r2=0.0, rot=(math.radians(-25), 0, 0))
    can(0, 0.45, cap_z + 0.55, 0.2, 0.45, FUR_D, n=4, r2=0.0, rot=(math.radians(-35), 0, 0))


if __name__ == "__main__" or True:
    run({"werewolf": build})
