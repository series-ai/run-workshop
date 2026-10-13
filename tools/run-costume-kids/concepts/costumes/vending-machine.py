"""Vending machine: a huge chunky red vending machine worn as a giant
square head, towering way over the kid. The kid's standard face looks out
of the pickup flap down low (the silver flap pushed up and in over the
fringe); above it a big glass front with three shelves of snacks (chip
bags, cans, candy bars) and a glint, a side column with a green display, a
keypad and coin slots, and a lit marquee along the top. Mitts out the side
holes (the right one with the full bucket), legs and shoes underneath."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
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


def cut(obj, cutter):
    """Boolean `cutter` out of `obj` (the cutter is hidden)."""
    m = obj.modifiers.new("cut", "BOOLEAN")
    m.object, m.operation = cutter, "DIFFERENCE"
    cutter.hide_render = True
    return obj


def opening(w=HEAD * 0.88, h=HEAD * 0.78, back=-0.6, front=-3.0, bevel=0.2):
    """A cutter for the face opening round the standard face."""
    return box(0, (back + front) / 2, HEAD_Z - HEAD * 0.06, w, back - front, h, WHITE, bevel=bevel, segs=2)


def build():
    body(shirt=RED_D, pants=(0.22, 0.22, 0.28), leg_colour=(0.22, 0.22, 0.28), shoe=(0.95, 0.95, 0.95), arms=False)
    kid_head(hair=HAIR)
    with part("body"):  # the whole machine is one rigid suit
        W, D, yc, z0, z1 = 3.7, 2.9, 0.12, 0.6, 7.8
        # the body's hole is a touch bigger than the frame's, so the frame lines it (no shared walls)
        cut(box(0, yc, (z0 + z1) / 2, W, D, z1 - z0, RED, bevel=0.2, segs=2), opening(w=HEAD * 0.88 + 0.12, h=HEAD * 0.78 + 0.12))
        fy = yc - D / 2
        fz = HEAD_Z - HEAD * 0.06
        # the pickup flap down low: a dark frame round the face, the flap pushed up and in
        fr = box(0, fy + 0.39, fz, HEAD * 0.88 + 0.36, 0.88, HEAD * 0.78 + 0.36, FRAME, bevel=0.1, segs=2)  # runs back past the hole
        cut(fr, opening(back=0.5))
        with part("head"):
            box(0, -HEAD * 0.46 - 0.02, HEAD_Z + HEAD * 0.26, HEAD * 0.7, 0.1, 0.3, HAIR, bevel=0.08)   # the fringe
        top = fz + HEAD * 0.39
        box(0, fy + 0.08, top - 0.12, HEAD * 0.86, 0.06, 0.34, SILVER_D, rot=(math.radians(-62), 0, 0))
        box(0, fy - 0.03, top + 0.32, 1.1, 0.06, 0.16, SLOT)           # the "push" label strip
        box(0, fy - 0.075, top + 0.32, 0.8, 0.04, 0.07, WHITE)
        # the glass front with shelves of snacks, way up over the head
        gx, gw, gz0, gz1 = -0.45, 2.45, 4.35, 6.95
        gz = (gz0 + gz1) / 2
        box(gx, fy - 0.02, gz, gw + 0.22, 0.08, gz1 - gz0 + 0.22, FRAME, bevel=0.06)
        box(gx, fy - 0.06, gz, gw, 0.08, gz1 - gz0, GLASS_BACK)   # 0.04 proud of the frame, its back sunk in
        rows = 4
        rh = (gz1 - gz0) / rows
        for r in range(rows):
            sz = gz0 + r * rh + 0.06
            box(gx, fy - 0.12, sz, gw - 0.05, 0.16, 0.05, SHELF)
            for c in range(5):
                x = gx - gw / 2 + 0.26 + c * 0.48
                col = SNACKS[(r * 5 + c) % len(SNACKS)]
                kind = (r + c) % 3
                if kind == 0:     # a chip bag
                    box(x, fy - 0.14, sz + 0.3, 0.36, 0.14, 0.48, col)
                    box(x, fy - 0.215, sz + 0.32, 0.16, 0.04, 0.14, WHITE)
                elif kind == 1:   # a can
                    can(x, fy - 0.15, sz + 0.24, 0.14, 0.42, col, n=8)
                    can(x, fy - 0.15, sz + 0.46, 0.12, 0.03, SILVER, n=8)
                else:             # a candy bar
                    box(x, fy - 0.14, sz + 0.2, 0.36, 0.1, 0.24, col)
                    box(x, fy - 0.2, sz + 0.2, 0.39, 0.04, 0.08, (0.4, 0.22, 0.12))   # the wrapper band, wider than the bar
        for dx, h in ((-0.6, 1.2), (-0.3, 0.55)):  # glints on the glass
            box(gx + dx, fy - 0.24, gz + 0.25, 0.11, 0.03, h, GLINT, rot=(0, math.radians(30), 0))
        # the side column: display, keypad, coin slot, bill slot
        cx = 1.36
        box(cx, fy - 0.02, 5.65, 0.7, 0.06, 2.6, SILVER, bevel=0.04)   # front at fy - 0.05; everything on it sinks in
        box(cx, fy - 0.06, 6.6, 0.5, 0.04, 0.26, DISPLAY)
        for r in range(4):
            for c in range(3):
                box(cx - 0.16 + c * 0.16, fy - 0.08, 6.25 - r * 0.17, 0.12, 0.08, 0.12, (WHITE if r < 3 else (1.0, 0.85, 0.2)))
        box(cx, fy - 0.06, 5.25, 0.34, 0.04, 0.34, SILVER_D, bevel=0.03)
        box(cx, fy - 0.095, 5.25, 0.07, 0.05, 0.22, SLOT)       # coin slot
        box(cx, fy - 0.06, 4.75, 0.36, 0.04, 0.09, SLOT)        # bill slot
        # the lit marquee along the top
        box(0, fy - 0.02, 7.38, W - 0.3, 0.08, 0.46, FRAME, bevel=0.05)
        for k in range(9):
            ball(-1.5 + k * 0.375, fy - 0.07, 7.38, 0.16, 0.1, 0.16, (1.0, 0.92, 0.5), seg=6, ring=3)
        # a coin return beside the flap
        box(1.5, fy - 0.04, 2.2, 0.3, 0.06, 0.26, SLOT, bevel=0.04)
        box(0, yc, z0 + 0.05, W + 0.06, D + 0.06, 0.12, RED_D)     # the kick plate (its bottom just under the body's)
        # mitts out the side holes; the right one holds the bucket
        for s in (-1, 1):
            can(s * (W / 2 + 0.02), -0.3, 1.5, 0.26, 0.06, FRAME, n=10, rot=(0, math.radians(90), 0))
    lh = (-2.3, -0.5, 1.1)
    with part("hand.r"):  # the sleeve stub and mitt flap together out of the side hole
        limb((-1.8, -0.3, 1.5), lh, 0.12, RED_D)
        hand_mitt(*lh, -1, MITT, SKIN)
    rh = (2.35, -0.55, 1.2)
    with part("hand.l"):
        limb((1.8, -0.3, 1.5), rh, 0.12, RED_D)
        hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.66)


if __name__ == "__main__" or True:
    render_costume("vending-machine", build, sys.argv[sys.argv.index("--") + 1], ortho=9.6, target_z=3.9)
