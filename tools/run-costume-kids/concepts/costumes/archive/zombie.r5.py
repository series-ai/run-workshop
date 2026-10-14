"""Zombie kid: a cute shambling zombie. Green face paint over the face (a
painted layer over the skin head, not a different skin; the mitts stay skin) with sleepy half-lidded
eyes, purple under-eye shadows, a little groaning mouth, a stitched scar and a
sticking plaster. Messy hair, a torn faded shirt (ragged hem, a rip, one
sleeve torn off at the elbow), patched shorts, bare legs: one sock pulled up,
one slouched down round the ankle. Arms out front in the zombie walk, a
bandage on the bare forearm; the empty bucket dangles from one mitten."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

PAINT, PAINT_D, SHADOW = (0.55, 0.82, 0.45), (0.36, 0.62, 0.30), (0.56, 0.42, 0.68)
SHIRT, SHIRT_D, SHORTS, PATCH = (0.62, 0.54, 0.82), (0.44, 0.36, 0.62), (0.48, 0.38, 0.28), (0.95, 0.6, 0.2)
SOCK, SOCK_BAND, SNEAKER = (0.98, 0.97, 0.94), (0.9, 0.3, 0.3), (0.42, 0.50, 0.44)
HAIR, BANDAGE, PLASTER = (0.20, 0.16, 0.14), (0.98, 0.96, 0.9), (0.98, 0.78, 0.62)


def build():
    body(shirt=SHIRT, pants=SHORTS, leg_colour=SKIN, shoe=SNEAKER, arms=False)
    fy = -TD * 0.5 - 0.02
    # socks: the left pulled up with a stripe, the right slouched down round the ankle
    lx, rx = -TW * 0.24, TW * 0.24
    can(lx, 0, 0.33, 0.13, 0.26, SOCK, n=6)
    can(lx, 0, 0.43, 0.135, 0.05, SOCK_BAND, n=6)
    for k, (z, r) in enumerate(((0.23, 0.16), (0.3, 0.145))):
        can(rx, 0, z, r, 0.08, SOCK, n=6, rot=(math.radians(8 if k else -6), 0, 0))
    # the torn shirt: a ragged hem of points, a rip with a peek of the vest, a patch on the shorts
    for k in (-1.5, -0.5, 0.5, 1.5):
        can(k * 0.22, fy + 0.03, HIP + TH * 0.3, 0.1, 0.18, SHIRT, n=4, r2=0.0, rot=(math.radians(180), 0, math.radians(45)))
    box(0.2, fy - 0.01, HIP + TH * 0.7, 0.22, 0.03, 0.16, SHIRT_D, rot=(0, math.radians(20), 0))
    box(-0.2, fy - 0.01, HIP + TH * 0.52, 0.16, 0.03, 0.1, SHIRT_D, rot=(0, math.radians(-15), 0))
    box(-0.22, fy - 0.01, HIP + 0.12, 0.2, 0.03, 0.16, PATCH)
    for k in (-1, 0, 1):
        box(-0.22 + k * 0.06, fy - 0.03, HIP + 0.12, 0.02, 0.02, 0.2, DARK)
    # arms straight out front: the left in a sleeve, the right sleeve torn at the elbow
    hz = TOP + 0.0
    for s in (-1, 1):
        sx = s * (TW * 0.5 + 0.1)
        if s < 0:
            limb((sx, 0, TOP - 0.15), (sx, -1.0, hz), 0.13, SHIRT)
        else:
            limb((sx, 0, TOP - 0.15), (sx, -0.5, TOP - 0.07), 0.14, SHIRT)
            for k in (-1, 1):
                can(sx + k * 0.08, -0.55, TOP - 0.18, 0.06, 0.16, SHIRT, n=4, r2=0.0, rot=(math.radians(160), 0, 0))
            limb((sx, -0.45, TOP - 0.08), (sx, -1.0, hz), 0.1, SKIN)
            can(sx, -0.78, TOP - 0.03, 0.125, 0.18, BANDAGE, n=6, rot=(math.radians(80), 0, 0))
        box(sx, -1.15, hz, MITT, MITT * 1.1, MITT * 0.8, SKIN, bevel=MITT * 0.2, segs=2)
        box(sx - s * MITT * 0.4, -1.08, hz + 0.14, 0.12, 0.2, 0.16, SKIN, bevel=0.04)
    bucket((-(TW * 0.5 + 0.1), -1.15, hz), full=False, size=0.62)
    # the head: skin, a green face-paint layer on the front, messy hair
    w = HEAD
    box(0, 0, HEAD_Z, w, w * 0.92, w * 0.9, SKIN, bevel=w * 0.14, segs=2)
    box(0, w * 0.05, HEAD_Z + w * 0.3, w * 1.04, w * 0.98, w * 0.36, HAIR, bevel=w * 0.14, segs=2)
    for x, y, a in ((-0.7, -0.4, -30), (-0.2, -0.2, 15), (0.35, 0.1, -10), (0.8, -0.3, 35), (0.1, 0.6, 20)):
        can(x, y, HEAD_Z + w * 0.48 + 0.15, 0.22, 0.45, HAIR, n=4, r2=0.0, rot=(0, math.radians(a), math.radians(45)))
    # the paint: a thin green layer over the whole face (just outside the skin head, under the hair)
    box(0, 0, HEAD_Z, w * 1.015, w * 0.92 * 1.015, w * 0.9 * 1.01, PAINT, bevel=w * 0.14, segs=2)
    ffy = -w * 0.92 * 1.015 * 0.5
    # sleepy eyes: a dark eye, a half-shut lid and an under-eye shadow
    ez = HEAD_Z + 0.02
    for s in (-1, 1):
        ex = s * 0.55
        box(ex, ffy - 0.03, ez - 0.27, 0.46, 0.03, 0.12, SHADOW, bevel=0.01)
        can(ex, ffy - 0.04, ez, 0.2, 0.06, DARK, n=10, rot=(math.radians(90), 0, 0))
        can(ex - 0.07, ffy - 0.08, ez - 0.07, 0.05, 0.04, WHITE, n=6, rot=(math.radians(90), 0, 0))
        box(ex, ffy - 0.09, ez + 0.11, 0.48, 0.06, 0.24, PAINT_D, bevel=0.02)
        box(ex, ffy - 0.11, ez + 0.0, 0.5, 0.04, 0.05, DARK)
        box(s * 0.83, ffy - 0.03, ez - 0.45, 0.28, 0.03, 0.12, (0.85, 0.5, 0.6))  # faded blush
    # a little groaning mouth with one tooth
    box(0.05, ffy - 0.04, HEAD_Z - 0.5, 0.36, 0.04, 0.2, DARK, bevel=0.03)
    box(0.12, ffy - 0.07, HEAD_Z - 0.44, 0.1, 0.03, 0.08, WHITE)
    # a stitched scar across the forehead-cheek and a sticking plaster on the brow
    box(-0.6, ffy - 0.04, HEAD_Z + 0.42, 0.5, 0.03, 0.04, DARK, rot=(0, math.radians(-12), 0))
    for k in (-1, 0, 1):
        box(-0.6 + k * 0.15, ffy - 0.05, HEAD_Z + 0.42 + k * -0.03, 0.04, 0.03, 0.18, DARK)
    box(0.55, ffy - 0.04, HEAD_Z + 0.46, 0.42, 0.04, 0.16, PLASTER, bevel=0.02, rot=(0, math.radians(30), 0))
    box(0.55, ffy - 0.06, HEAD_Z + 0.46, 0.12, 0.03, 0.12, (0.9, 0.66, 0.5), rot=(0, math.radians(30), 0))


if __name__ == "__main__" or True:
    run({"zombie": build})
