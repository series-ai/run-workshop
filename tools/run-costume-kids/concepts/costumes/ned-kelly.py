"""Ned Kelly: the kid in a huge chunky iron bucket helmet that swallows the
standard head (8 sides, a flat top plate, rivets, a brow bar, and a long eye
slot the width of the face where the kid's eyes peer out), a ginger beard
spilling under the rim, a brown
duster with a flared skirt, a steel breastplate and apron plate, shoulder
plates and a stubby carbine in the right mitten and the full bucket in the left. Ported from ned_bobble.py."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

STEEL, STEEL_D, STEEL_L, COAT, COAT_D = (0.50, 0.56, 0.64), (0.28, 0.31, 0.37), (0.72, 0.77, 0.84), (0.55, 0.32, 0.18), (0.36, 0.20, 0.11)
RUST = (0.78, 0.40, 0.16)
BEARD, WOOD, IRON = (0.85, 0.40, 0.12), (0.55, 0.33, 0.16), (0.2, 0.2, 0.22)


def build():
    body(shirt=COAT, sleeve=COAT, leg_colour=(0.30, 0.28, 0.22), torso=False)
    with part("body"):
        # the duster: a short skirt that flares out, then the body
        can(0, 0.02, HIP + 0.12, TW * 0.72, 0.42, COAT, n=8, r2=TW * 0.52)
    with part("chest"):
        box(0, 0, HIP + TH * 0.62, TW, TD, TH * 0.72, COAT, bevel=0.08)
        # the breastplate and the apron plate
        box(0, -TD * 0.5 - 0.03, HIP + TH * 0.66, TW * 0.86, 0.1, TH * 0.62, STEEL, bevel=0.03)
    with part("body"):
        box(0, -TD * 0.5 - 0.12, HIP + 0.06, TW * 0.62, 0.08, 0.42, STEEL_D, bevel=0.02, rot=(math.radians(-14), 0, 0))
    with part("chest"):
        # shoulder plates
        for s in (-1, 1):
            box(s * (TW * 0.5 + 0.08), 0, TOP - 0.12, 0.34, 0.34, 0.22, STEEL_D, bevel=0.06)
    with part("prop.l"):
        # a stubby carbine in the right mitten, pointing forward
        rx = TW * 0.5 + 0.26
        cz = TOP - 0.86  # carried low, clear of the big helmet
        box(rx, -0.5, cz, 0.12, 1.0, 0.16, WOOD, bevel=0.03)
        can(rx, -0.95, cz + 0.06, 0.06, 0.4, IRON, n=6, rot=(math.radians(90), 0, 0))
        box(rx, 0.12, cz - 0.08, 0.14, 0.34, 0.26, WOOD, bevel=0.04)
    # the left mitten carries the bucket
    bucket(hand_points()[-1], full=True, size=0.6)
    with part("head"):
        # the beard spilling out under the helmet
        box(0, -HEAD * 0.5, TOP + 0.2, 1.2, 0.5, 0.42, BEARD, bevel=0.15, segs=2)
        for k in (-2, -1, 0, 1, 2):
            can(k * 0.22, -HEAD * 0.5 - 0.05, TOP - 0.08, 0.16, 0.36, BEARD, n=6, r2=0.02, rot=(math.radians(180), 0, 0))
        # the helmet: a huge flat-topped iron bucket (8 sides, a flat face to the
        # front) that swallows the whole standard head, with a long eye slot
        ap = HEAD * 0.64                       # apothem: the flat faces sit this far out
        r = ap / math.cos(math.pi / 8)
        z0, z1 = TOP + 0.42, HEAD_Z + HEAD * 0.58  # the rim sits up off the shoulders
        hz = (z0 + z1) / 2
        octa(0, 0, hz, r, z1 - z0, STEEL, r2=r * 0.94)
        octa(0, 0, z0 + 0.12, r * 1.06, 0.26, STEEL_D)              # the heavy bottom rim
        octa(0, 0, z1 + 0.06, r * 0.96, 0.16, STEEL_D)               # the riveted top plate
        octa(0, 0, z1 + 0.18, r * 0.62, 0.14, STEEL_L)              # the domed crown plate
        front = -ap
        # the eye slot, the width of the face: skin and the kid's own eyes peer out
        ey = HEAD_Z
        box(0, front - 0.03, ey, HEAD * 0.86, 0.1, 0.62, DARK)
        box(0, front - 0.05, ey, HEAD * 0.78, 0.08, 0.48, SKIN)
        for s in (-1, 1):
            ex = s * HEAD * 0.22
            can(ex, front - 0.1, ey, 0.19, 0.06, DARK, n=10, rot=(math.radians(90), 0, 0))
            can(ex - 0.08, front - 0.14, ey + 0.08, 0.065, 0.04, WHITE, n=6, rot=(math.radians(90), 0, 0))
        # a thick brow bar over the slot and a nose guard plate below it
        box(0, front - 0.08, ey + 0.42, HEAD * 0.95, 0.16, 0.2, STEEL_L, bevel=0.05)
        box(0, front - 0.06, ey - 0.62, 0.36, 0.12, 0.6, STEEL_L, bevel=0.05)
        # rivets round the top and bottom bands and down the front corners
        for k in range(8):
            a = 2 * math.pi * k / 8
            for z in (z1 - 0.3,):
                for t in (-0.3, 0.3):
                    px, py = ap * math.cos(a) - t * math.sin(a), ap * math.sin(a) + t * math.cos(a)
                    f = 1.0 - 0.06 * (z - z0) / (z1 - z0)
                    ball(px * f, py * f, z, 0.14, 0.14, 0.14, STEEL_D, seg=6, ring=4)
        for s in (-1, 1):
            for z in (ey - 0.55, ey - 0.9):
                ball(s * 0.82, front - 0.04, z, 0.13, 0.08, 0.13, STEEL_D, seg=6, ring=4)
        # a couple of dents and a rust spot
        ball(0.9, front + 0.01, ey - 1.05, 0.26, 0.06, 0.2, STEEL_D, seg=6, ring=4)

if __name__ == "__main__" or True:
    run({"ned-kelly": build})
