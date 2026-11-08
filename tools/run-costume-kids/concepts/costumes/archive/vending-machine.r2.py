"""Vending machine: a tall red box costume. A glass front with three shelves
of snacks (chip bags, cans, candy bars) and a glint on the glass; a side
column with a little green display, a keypad, a coin slot and a coin return;
a dark pickup flap at the bottom; the kid's face looks out of a cutout in the
top header. Mitts out the side holes (one with the full bucket), tiny shoes
underneath."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

RED, RED_D, FRAME, SILVER, SILVER_D = (0.88, 0.16, 0.2), (0.68, 0.1, 0.14), (0.25, 0.25, 0.3), (0.8, 0.82, 0.86), (0.55, 0.57, 0.62)
GLASS_BACK, SHELF, DISPLAY, SLOT, GLINT = (0.2, 0.26, 0.4), (0.7, 0.72, 0.78), (0.35, 0.95, 0.5), (0.1, 0.1, 0.12), (0.85, 0.95, 1.0)
SNACKS = [(1.0, 0.8, 0.15), (0.3, 0.65, 1.0), (0.95, 0.35, 0.55), (0.4, 0.85, 0.35), (1.0, 0.55, 0.15), (0.65, 0.4, 0.9)]
HAIR = (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)


def build():
    body(leg_colour=(0.22, 0.22, 0.28), shoe=(0.95, 0.95, 0.95), torso=False, arms=False)
    W, D, z0, z1 = 2.7, 1.7, 0.55, 5.1
    box(0, 0, (z0 + z1) / 2, W, D, z1 - z0, RED, bevel=0.16, segs=2)
    fy = -D / 2
    # the header with the face cutout
    hz = 4.45
    box(0, fy - 0.02, hz, 1.75, 0.08, 1.2, FRAME, bevel=0.1, segs=2)
    box(0, fy - 0.06, hz - 0.03, 1.5, 0.06, 0.98, SKIN, bevel=0.12, segs=2)
    box(0, fy - 0.1, hz + 0.33, 1.4, 0.05, 0.22, HAIR, bevel=0.04)
    face(0, hz - 0.05, fy - 0.09, 1.4, eye=0.16, gap=0.2)
    for s in (-1, 1):
        for k in range(3):
            ball(s * 1.12, fy - 0.03, hz - 0.35 + k * 0.35, 0.12, 0.08, 0.12, (1.0, 0.92, 0.5), seg=6, ring=4)  # marquee lights
    # the glass front with shelves of snacks
    gx, gw, gz0, gz1 = -0.35, 1.75, 1.45, 3.75
    gz = (gz0 + gz1) / 2
    box(gx, fy - 0.02, gz, gw + 0.2, 0.08, gz1 - gz0 + 0.2, FRAME, bevel=0.06)
    box(gx, fy - 0.04, gz, gw, 0.08, gz1 - gz0, GLASS_BACK)
    rows = 3
    rh = (gz1 - gz0) / rows
    for r in range(rows):
        sz = gz0 + r * rh + 0.08
        box(gx, fy - 0.12, sz, gw - 0.05, 0.16, 0.05, SHELF)
        for c in range(4):
            x = gx - gw / 2 + 0.25 + c * 0.42
            col = SNACKS[(r * 4 + c) % len(SNACKS)]
            kind = (r + c) % 3
            if kind == 0:     # a chip bag
                box(x, fy - 0.14, sz + 0.3, 0.34, 0.12, 0.48, col, bevel=0.05)
                box(x, fy - 0.21, sz + 0.32, 0.16, 0.03, 0.14, WHITE)
            elif kind == 1:   # a can
                can(x, fy - 0.15, sz + 0.24, 0.13, 0.4, col, n=8)
                can(x, fy - 0.15, sz + 0.45, 0.11, 0.03, SILVER, n=8)
            else:             # a candy bar
                box(x, fy - 0.14, sz + 0.2, 0.34, 0.1, 0.24, col, bevel=0.03)
                box(x, fy - 0.2, sz + 0.2, 0.34, 0.03, 0.08, (0.4, 0.22, 0.12))
            limb((x - 0.12, fy - 0.1, sz + 0.06), (x + 0.12, fy - 0.1, sz + 0.06), 0.03, SILVER_D, n=4)  # the spiral coil
    for dx, h in ((-0.45, 1.3), (-0.15, 0.6)):  # glints on the glass
        box(gx + dx, fy - 0.24, gz + 0.3, 0.1, 0.03, h, GLINT, rot=(0, math.radians(30), 0))
    # the side column: display, keypad, coin slot, coin return
    cx = 0.95
    box(cx, fy - 0.02, 2.6, 0.55, 0.06, 2.3, SILVER, bevel=0.04)
    box(cx, fy - 0.06, 3.5, 0.42, 0.04, 0.22, DISPLAY)
    for r in range(4):
        for c in range(3):
            box(cx - 0.14 + c * 0.14, fy - 0.08, 3.2 - r * 0.15, 0.1, 0.06, 0.1, (WHITE if r < 3 else (1.0, 0.85, 0.2)), bevel=0.015)
    box(cx, fy - 0.06, 2.35, 0.3, 0.04, 0.3, SILVER_D, bevel=0.03)
    box(cx, fy - 0.09, 2.35, 0.06, 0.04, 0.2, SLOT)        # coin slot
    box(cx, fy - 0.06, 1.95, 0.32, 0.04, 0.08, SLOT)        # bill slot
    box(cx, fy - 0.06, 1.6, 0.26, 0.06, 0.22, SLOT, bevel=0.04)  # coin return
    # the pickup flap at the bottom
    box(-0.35, fy - 0.02, 0.98, 1.9, 0.08, 0.55, FRAME, bevel=0.05)
    box(-0.35, fy - 0.07, 0.98, 1.7, 0.06, 0.4, SLOT, bevel=0.04)
    box(-0.35, fy - 0.12, 1.08, 1.6, 0.06, 0.22, SILVER_D, rot=(math.radians(-12), 0, 0))
    box(0, 0, z0 + 0.06, W + 0.04, D + 0.04, 0.12, RED_D)     # the kick plate
    # mitts out the side holes; the right one holds the bucket
    for s in (-1, 1):
        can(s * (W / 2 + 0.01), 0, 2.2, 0.26, 0.04, FRAME, n=10, rot=(0, math.radians(90), 0))
    lh = (-1.75, -0.2, 1.85)
    limb((-1.3, 0, 2.2), lh, 0.12, RED_D)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.8, -0.25, 1.95)
    limb((1.3, 0, 2.2), rh, 0.12, RED_D)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.66)


if __name__ == "__main__" or True:
    run({"vending-machine": build})
