"""Bedsheet ghost: the kid under a big white sheet with two eye holes. The
sheet drapes over the giant head and falls in a wide flared skirt with a
scalloped hem; the shoes peek out underneath. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

SHEET, SHEET_D = (0.96, 0.96, 0.94), (0.82, 0.83, 0.86)


def build():
    body(arms=False, torso=False, legs=False, shoe=(0.85, 0.2, 0.2))
    hs = HEAD * 1.04
    # the sheet over the head: a rounded block a little bigger than the head
    box(0, 0, HEAD_Z + 0.05, hs, hs * 0.92, HEAD * 0.95, SHEET, bevel=hs * 0.2, segs=3)
    # the drape: from under the head, flaring out to the hem just above the shoes
    can(0, 0, (FOOT * 0.55 + TOP + 0.4) / 2, hs * 0.62, TOP + 0.4 - FOOT * 0.55, SHEET, n=10, r2=hs * 0.48)
    # the scalloped hem: rounded tabs around the bottom
    for k in range(10):
        a = 2 * math.pi * (k + 0.5) / 10
        r = hs * 0.6
        ball(r * math.cos(a), r * math.sin(a), FOOT * 0.62, 0.62, 0.62, 0.4, SHEET, seg=8, ring=4)
    # the arms push the sheet out at the sides, one hand pokes out holding the bucket
    for s in (-1, 1):
        ball(s * hs * 0.55, -0.1, TOP - 0.2, 0.7, 0.6, 0.6, SHEET, seg=8, ring=5)
    hand_mitt(2.0, -0.3, TOP - 0.1, 1, MITT, SKIN)
    limb((1.3, -0.15, TOP), (1.85, -0.3, TOP - 0.05), 0.22, SHEET)  # the sheet sleeve over the arm
    bucket((2.0, -0.3, TOP - 0.1), full=True, size=0.75)
    # two big oval eye holes and a little dark mouth hole
    fy = -hs * 0.46 - 0.02
    for s in (-1, 1):
        ball(s * 0.48, fy, HEAD_Z + 0.1, 0.42, 0.08, 0.6, (0.06, 0.05, 0.06), seg=10, ring=6)
    ball(0, fy, HEAD_Z - 0.55, 0.28, 0.08, 0.34, (0.06, 0.05, 0.06), seg=8, ring=5)
    # soft folds: a couple of slightly darker panels down the drape
    for s in (-1, 1):
        box(s * 0.5, -hs * 0.56, (FOOT + TOP) * 0.45, 0.12, 0.05, TOP * 0.7, SHEET_D, rot=(math.radians(-12), 0, s * 0.1))


def bucket_empty():
    bucket((0, 0, 1.6), full=False, size=1.4)


def bucket_full():
    bucket((0, 0, 1.6), full=True, size=1.4)


if __name__ == "__main__" or True:
    run({"ghost": build, "bucket-empty": bucket_empty, "bucket-full": bucket_full})
