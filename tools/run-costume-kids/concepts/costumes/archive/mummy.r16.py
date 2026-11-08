"""Mummy: the kid wrapped head to toe in off-white bandage bands at slight
angles, one shiny eye peeking out of a gap, arms forward in the mummy walk,
loose bandage ends trailing from the head and an arm, bright sneakers
showing underneath. No bucket (both arms are out)."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403

BAND, BAND2, BAND_D = (0.98, 0.95, 0.86), (0.90, 0.86, 0.74), (0.76, 0.71, 0.60)
SNEAKER = (0.25, 0.75, 0.80)


def band_box(x, y, z, sx, sy, sz, k, tilt):
    box(x, y, z, sx, sy, sz, BAND if k % 2 == 0 else BAND2, bevel=min(sz, sy) * 0.3, segs=1, rot=(0, math.radians(tilt), 0))


def build():
    body(shirt=BAND_D, pants=BAND_D, leg_colour=BAND2, shoe=SNEAKER, arms=False)
    # torso bands
    for k, (z, t) in enumerate(((HIP + 0.08, 4), (HIP + 0.3, -6), (HIP + 0.52, 5), (HIP + 0.73, -4))):
        with part("body" if k < 2 else "chest"):
            band_box(0, 0, z, TW + 0.08, TD + 0.08, 0.2, k, t)
    # leg rings
    for s in (-1, 1):
        for k, z in enumerate((FOOT * 0.5, HIP - 0.08)):
            with part("leg.l" if s > 0 else "leg.r"):
                can(s * TW * 0.24, 0, z, 0.14, 0.1, BAND if k else BAND2, n=6, rot=(math.radians(s * 8), 0, 0))
    # arms straight forward, wrapped in rings
    hz = TOP + 0.02
    # (the rig swings these to its hanging pose: the rings and the loose end go with the arm)
    for s in (-1, 1):
        sx = s * (TW * 0.5 + 0.1)
        with part("arm.l" if s > 0 else "arm.r"):
            limb((sx, 0, TOP - 0.15), (sx, -1.05, hz), 0.13, BAND2)
            for k in range(4):
                y = -0.15 - k * 0.27
                can(sx, y, TOP - 0.15 + (hz - TOP + 0.15) * (-y / 1.05), 0.16, 0.12, BAND if k % 2 == 0 else BAND2, n=6,
                    rot=(math.radians(90 + (8 if k % 2 else -8)), 0, 0))
        with part("hand.l" if s > 0 else "hand.r"):
            box(sx, -1.2, hz, MITT, MITT * 1.1, MITT * 0.8, SKIN, bevel=MITT * 0.2, segs=2)
            box(sx - s * MITT * 0.4, -1.13, hz + 0.14, 0.12, 0.2, 0.16, SKIN, bevel=0.04)
    # the loose bandage end hanging from the left wrist
    lx = -(TW * 0.5 + 0.1)
    with part("arm.r"):
        box(lx - 0.05, -0.92, hz - 0.35, 0.18, 0.04, 0.6, BAND, rot=(math.radians(-10), math.radians(12), 0))
        box(lx - 0.12, -0.86, hz - 0.78, 0.18, 0.04, 0.34, BAND2, rot=(math.radians(-10), math.radians(-14), 0))
    with part("head"):
        # the head: a dark wrapped core with bandage bands at slight angles
        w = HEAD
        box(0, 0, HEAD_Z, w, w * 0.92, w * 0.9, BAND_D, bevel=w * 0.14, segs=2)
        bw, bd = w * 1.03, w * 0.96
        rows = ((0.86, 3), (0.48, -5), (-0.34, 6), (-0.72, -3), (-0.88, 2))  # the lowest band stays up off the shoulders
        for k, (dz, t) in enumerate(rows):
            hw = bw if -0.85 < dz < 0.9 else bw * 0.92
            band_box(0, 0, HEAD_Z + dz, hw, bd if -0.85 < dz < 0.9 else bd * 0.92, 0.48, k, t)
        box(0, 0, HEAD_Z + 1.0, w * 0.97, w * 0.89, 0.36, BAND2, bevel=0.15, segs=2)
        box(0.1, 0, HEAD_Z + 1.18, 0.5, w * 0.9, 0.08, BAND, bevel=0.03, rot=(0, 0, math.radians(30)))
        # the eye row: a band over the right half, a gap with the peeking eye on the left
        ez = HEAD_Z + 0.08
        band_box(0.42, 0, ez, bw - 0.84, bd, 0.48, 1, -8)
        band_box(-0.75, 0.2, ez, 1.1, bd - 0.4, 0.42, 0, 0)
        fy = -w * 0.46
        box(-0.6, fy - 0.01, ez, 0.92, 0.06, 0.46, SKIN, bevel=0.04)
        can(-0.56, fy - 0.05, ez, 0.21, 0.06, DARK, n=10, rot=(math.radians(90), 0, 0))
        can(-0.62, fy - 0.09, ez + 0.07, 0.075, 0.04, WHITE, n=6, rot=(math.radians(90), 0, 0))
        box(-0.86, fy - 0.05, ez - 0.13, 0.18, 0.04, 0.08, CHEEK)
        # a little smile peeking between the lower bands
        box(0.1, -w * 0.48 - 0.02, HEAD_Z - 0.56, 0.36, 0.04, 0.07, DARK)
        # the loose bandage end flapping off the top right of the head
        box(1.3, -0.3, HEAD_Z + 0.55, 0.3, 0.05, 0.8, BAND, rot=(0, math.radians(-28), 0))
        box(1.58, -0.3, HEAD_Z - 0.05, 0.3, 0.05, 0.6, BAND2, rot=(0, math.radians(-10), 0))
        box(1.62, -0.3, HEAD_Z - 0.5, 0.3, 0.05, 0.4, BAND, rot=(0, math.radians(12), 0))

if __name__ == "__main__" or True:
    run({"mummy": build})
