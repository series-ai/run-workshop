"""Cardboard robot: a homemade box robot. A giant cardboard box head with two
cut-out eye holes (the kid's eyes peek out), a felt-tip mouth grille and
drawn-on buttons, bottle-cap ears, a foil-ball antenna; a box body with dials,
bottle caps and a foil panel; ribbed silver dryer-hose arms ending in the
kid's mitts. Carries the empty bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

CARD, CARD_D, TAPE = (0.80, 0.58, 0.34), (0.62, 0.42, 0.22), (0.92, 0.85, 0.62)
FOIL, FOIL_D, INK = (0.84, 0.86, 0.9), (0.62, 0.65, 0.7), (0.15, 0.12, 0.12)
RED, BLUE, GREEN, YEL = (0.95, 0.22, 0.2), (0.2, 0.5, 0.95), (0.3, 0.8, 0.35), (1.0, 0.82, 0.1)
X90 = (math.radians(90), 0, 0)


def hose(p0, p1, r=0.2, n=5):
    """A ribbed dryer-hose arm: alternating silver rings along a bar."""
    limb(p0, p1, r * 0.6, FOIL_D, n=8)
    for k in range(n):
        t = (k + 0.5) / n
        p = tuple(a + (b - a) * t for a, b in zip(p0, p1))
        d = [b - a for a, b in zip(p0, p1)]
        L = math.sqrt(sum(c * c for c in d))
        q = tuple(c - dc / L * 0.06 for c, dc in zip(p, d))
        limb(q, tuple(c + dc / L * 0.06 for c, dc in zip(p, d)), r, FOIL, n=8)


def build():
    body(pants=(0.35, 0.36, 0.4), shoe=(0.2, 0.2, 0.22), torso=False, arms=False)
    # the box body and everything drawn or stuck on it ride the hips (the dial used to be guessed onto a leg)
    with part("body"):
        # the box body
        bw, bd, bz0, bz1 = 1.45, 1.1, HIP - 0.05, TOP + 0.15
        bzc = (bz0 + bz1) / 2
        box(0, 0, bzc, bw, bd, bz1 - bz0, CARD, bevel=0.03)
        fy = -bd / 2
        box(0, fy - 0.01, bzc + 0.15, 0.95, 0.04, 0.55, FOIL, bevel=0.02)                      # foil panel
        for i, c in enumerate((RED, YEL, BLUE)):                                                  # bottle caps
            can(-0.3 + i * 0.3, fy - 0.06, bzc + 0.15, 0.1, 0.1, c, n=10, rot=X90)
        can(-0.35, fy - 0.04, bzc - 0.38, 0.17, 0.06, INK, n=10, rot=X90)                       # a dial
        box(-0.35 + 0.05, fy - 0.08, bzc - 0.33, 0.04, 0.03, 0.14, WHITE, rot=(0, math.radians(-35), 0))
        for k in range(3):
            box(0.15 + k * 0.17, fy - 0.01, bzc - 0.38, 0.1, 0.03, 0.1, (GREEN, RED, YEL)[k])  # drawn lights
        box(0, 0, bz1 - 0.01, bw * 0.6, bd + 0.02, 0.08, TAPE)                                   # tape strip
    # dryer-hose arms stuck out of the box's sides (part of the box suit), the mitts out at their
    # ends, clear of the box; the right one holds the bucket
    lh = (-1.6, -0.2, 0.66)
    with part("body"):
        hose((-bw / 2 - 0.02, 0, 0.74), (lh[0] + 0.15, lh[1] + 0.05, lh[2] + 0.06))
    with part("hand.r"):
        hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.62, -0.25, 0.76)
    with part("body"):
        hose((bw / 2 + 0.02, 0, 0.76), (rh[0] - 0.15, rh[1] + 0.05, rh[2] + 0.04))
    with part("hand.l"):
        hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=False, size=0.56)
    # a ribbed foil neck between the boxes
    with part("chest"):
        hose((0, 0, TOP + 0.08), (0, 0, TOP + 0.42), r=0.3, n=2)
    with part("head"):
        # the box head
        hw, hd, hh = 2.6, 2.3, 2.3
        hz = HEAD_Z - HEAD * 0.45 + hh / 2   # the box head sits where the kid's head is
        box(0, 0, hz, hw, hd, hh, CARD, bevel=0.03)
        box(0, 0, hz + hh / 2 + 0.01, hw * 0.98, 0.3, 0.04, TAPE)                                 # flap seam tape
        for s in (-1, 1):
            box(s * hw * 0.25, 0, hz + hh / 2 + 0.02, 0.02, hd * 0.95, 0.04, CARD_D)            # flap lines
        hy = -hd / 2
        # cut-out eye holes with the kid's eyes looking out (skin, eye, shine)
        for s in (-1, 1):
            ex, ez = s * 0.55, hz + 0.25
            box(ex, hy - 0.005, ez, 0.74, 0.04, 0.58, INK)
            box(ex, hy - 0.025, ez, 0.6, 0.04, 0.44, SKIN)
            can(ex, hy - 0.05, ez, 0.15, 0.06, DARK, n=10, rot=X90)
            can(ex - 0.05, hy - 0.08, ez + 0.06, 0.05, 0.04, WHITE, n=6, rot=X90)
            can(s * 1.33, 0, hz, 0.24, 0.12, (RED if s < 0 else BLUE), n=10, rot=(0, math.radians(90), 0))  # cap ears
            box(s * 0.95, hy - 0.01, hz - 0.35, 0.3, 0.03, 0.15, CHEEK)                          # felt-tip blush
        # a foil band round the bottom of the head
        box(0, 0, hz - hh / 2 + 0.1, hw + 0.04, hd + 0.04, 0.16, FOIL)
        # a felt-tip mouth grille and drawn-on buttons on the forehead
        box(0, hy - 0.01, hz - 0.55, 0.9, 0.03, 0.34, INK)
        for k in range(4):
            box(-0.33 + k * 0.22, hy - 0.025, hz - 0.55, 0.1, 0.03, 0.26, FOIL)
        for k, c in enumerate((RED, YEL, GREEN)):
            can(-0.4 + k * 0.4, hy - 0.02, hz + 0.82, 0.09, 0.04, c, n=8, rot=X90)
        box(0.9, hy - 0.01, hz + 0.82, 0.3, 0.03, 0.1, FOIL)
        # the antenna: a bent wire with a foil ball, on a bottle-cap base
        can(0, 0, hz + hh / 2 + 0.06, 0.2, 0.1, RED, n=10)
        limb((0, 0, hz + hh / 2), (0.15, 0, hz + hh / 2 + 0.7), 0.04, FOIL_D)
        ball(0.15, 0, hz + hh / 2 + 0.8, 0.36, 0.36, 0.36, FOIL, seg=8, ring=6)


if __name__ == "__main__" or True:
    run({"cardboard-robot": build})
