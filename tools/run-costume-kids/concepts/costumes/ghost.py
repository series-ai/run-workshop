"""Bedsheet ghost: the kid under a big white sheet with two eye holes. The
sheet drapes over the kid's standard head, keeping its shape (the hair a
soft ridge under the cloth), with ghost eyes and an "oooo" mouth, and falls in a wide flared skirt with a
scalloped hem; the shoes peek out underneath. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

SHEET, SHEET_D = (0.96, 0.96, 0.94), (0.82, 0.83, 0.86)


def build():
    body(arms=False, torso=False, legs=False, shoe=(0.85, 0.2, 0.2))
    with part("head"):  # the sheet over the head
        hs = HEAD * 1.06
        # the sheet over the kid's standard head: it takes the head's exact shape,
        # the hair cap showing as a soft ridge under the cloth
        box(0, 0, HEAD_Z, hs, HEAD * 0.98, HEAD * 0.94, SHEET, bevel=HEAD * 0.14, segs=2)
        box(0, HEAD * 0.05, HEAD_Z + HEAD * 0.3, HEAD * 1.08, HEAD * 1.02, HEAD * 0.4, SHEET, bevel=HEAD * 0.14, segs=2)
    with part("body"):  # the drape, its hem and the arm bumps
        # the drape: falling from the head's edges, flaring out to the hem just above the shoes
        z0, z1 = FOOT * 0.75, HEAD_Z - HEAD * 0.36
        octa(0, 0.05, (z0 + z1) / 2, hs * 0.72, z1 - z0, SHEET, r2=hs * 0.46)
        # the scalloped hem: rounded tabs around the bottom
        for k in range(10):
            a = 2 * math.pi * (k + 0.5) / 10
            r = hs * 0.66
            ball(r * math.cos(a), 0.05 + r * math.sin(a), FOOT * 0.8, 0.66, 0.66, 0.42, SHEET, seg=8, ring=4)
        # the arms push the sheet out at the sides, one hand pokes out holding the bucket
        for s in (-1, 1):
            ball(s * hs * 0.55, -0.1, TOP - 0.2, 0.7, 0.6, 0.6, SHEET, seg=8, ring=5)
    with part("hand.l"):  # the mitt flaps where it leaves the sheet sleeve
        hand_mitt(2.0, -0.3, TOP - 0.1, 1, MITT, SKIN)
    with part("body"):
        limb((1.3, -0.15, TOP), (1.85, -0.3, TOP - 0.05), 0.22, SHEET)  # the sheet sleeve over the arm
    bucket((2.0, -0.3, TOP - 0.1), full=True, size=0.75)
    with part("head"):
        # the ghost face where the kid's face is: two big oval eye holes, an "oooo" mouth, blush
        fy = -HEAD * 0.49 - 0.02
        ez = HEAD_Z - HEAD * 0.05 + HEAD * 0.07
        for s in (-1, 1):
            ball(s * HEAD * 0.22, fy, ez, 0.5, 0.08, 0.72, (0.06, 0.05, 0.06), seg=10, ring=6)
            ball(s * HEAD * 0.22 - 0.09, fy - 0.03, ez + 0.15, 0.13, 0.04, 0.16, WHITE, seg=6, ring=4)
            box(s * HEAD * 0.34, fy + 0.01, ez - 0.48, 0.32, 0.04, 0.14, CHEEK)
        ball(0, fy, HEAD_Z - HEAD * 0.22, 0.34, 0.08, 0.44, (0.06, 0.05, 0.06), seg=8, ring=5)
    with part("body"):
        # soft folds: a couple of slightly darker panels down the drape
        for s in (-1, 1):
            box(s * 0.55, -hs * 0.56, (FOOT + TOP) * 0.45, 0.12, 0.05, TOP * 0.7, SHEET_D, rot=(math.radians(-10), 0, s * 0.1))


def bucket_empty():
    bucket((0, 0, 1.6), full=False, size=1.4)


def bucket_full():
    bucket((0, 0, 1.6), full=True, size=1.4)


if __name__ == "__main__" or True:
    run({"ghost": build, "bucket-empty": bucket_empty, "bucket-full": bucket_full})
