"""Frankenstein's monster: a giant flat-topped green block head (face paint)
with a black jagged fringe, neck bolts and a stitched scar, a too-short
purple-grey jacket over a green shirt, arms held forward in the zombie pose
(the full bucket dangles from one mitten) and heavy black boots."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

GREEN, GREEN_D = (0.52, 0.80, 0.38), (0.40, 0.66, 0.30)
HAIR, JACKET, JACKET_D = (0.10, 0.09, 0.12), (0.36, 0.30, 0.48), (0.26, 0.21, 0.36)
BOLT, BOLT_D, BOOT, SCAR = (0.72, 0.74, 0.78), (0.50, 0.52, 0.56), (0.12, 0.11, 0.12), (0.18, 0.22, 0.14)


def build():
    body(shirt=GREEN_D, pants=(0.20, 0.20, 0.24), leg_colour=(0.20, 0.20, 0.24), shoe=BOOT, arms=False)
    # heavy boots: tall thick soles and cuffs
    for s in (-1, 1):
        fx = s * TW * 0.24
        box(fx, -FOOT * 0.25, 0.05, FOOT * 0.85, FOOT * 1.25, 0.1, (0.3, 0.3, 0.32), bevel=0.03)
        box(fx, 0, FOOT * 0.5, 0.36, 0.36, 0.22, BOOT, bevel=0.05)
    # the too-short jacket: stops above the belly, open at the front, with lapels
    for s in (-1, 1):
        box(s * TW * 0.3, 0, TOP - 0.22, TW * 0.44, TD + 0.08, 0.5, JACKET, bevel=0.06)
        box(s * 0.16, -TD * 0.5 - 0.06, TOP - 0.16, 0.16, 0.06, 0.34, JACKET_D, rot=(0, s * math.radians(20), 0))
    box(0, TD * 0.04, TOP - 0.22, TW * 0.2, TD, 0.5, JACKET)
    # arms straight forward, short sleeves that show the wrists
    hz = TOP + 0.02
    for s in (-1, 1):
        sx = s * (TW * 0.5 + 0.1)
        limb((sx, 0, TOP - 0.15), (sx, -1.05, hz), 0.15, JACKET)
        limb((sx, -1.05, hz), (sx, -1.25, hz), 0.1, SKIN)
        box(sx, -1.4, hz, MITT, MITT * 1.1, MITT * 0.8, SKIN, bevel=MITT * 0.2, segs=2)
        box(sx - s * MITT * 0.4, -1.33, hz + 0.14, 0.12, 0.2, 0.16, SKIN, bevel=0.04)
    bucket((TW * 0.5 + 0.1, -1.4, hz), full=True, size=0.62)
    # the head: a tall green block with a dead-flat top
    hw, hh = HEAD * 0.96, HEAD * 1.0
    hc = TOP + 0.3 + hh * 0.5
    box(0, 0, hc, hw, hw * 0.92, hh, GREEN, bevel=0.14, segs=2)
    fy = -hw * 0.46
    # flat black hair cap with a jagged fringe
    box(0, 0.03, hc + hh * 0.42, hw * 1.04, hw * 0.98, hh * 0.22, HAIR, bevel=0.06)
    for k in range(7):
        x = -hw * 0.43 + k * hw * 0.143
        can(x, fy - 0.03, hc + hh * 0.26, 0.2, 0.36, HAIR, n=3, r2=None, rot=(math.radians(90), 0, math.radians(180)))
    # the stitched scar across the forehead
    box(-0.25, fy - 0.03, hc + 0.3, 0.8, 0.04, 0.06, SCAR, rot=(0, math.radians(-8), 0))
    for k in range(4):
        box(-0.55 + k * 0.2, fy - 0.04, hc + 0.3 + (k - 1.5) * 0.028, 0.05, 0.04, 0.24, SCAR)
    # the face: sleepy-heavy eyebrows, round shiny eyes, cheeks, a flat little mouth
    ez = hc - 0.3
    for s in (-1, 1):
        ex = s * 0.55
        can(ex, fy - 0.02, ez, 0.2, 0.06, DARK, n=10, rot=(math.radians(90), 0, 0))
        can(ex - 0.07, fy - 0.06, ez + 0.07, 0.07, 0.04, WHITE, n=6, rot=(math.radians(90), 0, 0))
        box(ex, fy - 0.03, ez + 0.3, 0.5, 0.06, 0.12, HAIR)
        box(s * 0.85, fy - 0.01, ez - 0.32, 0.3, 0.04, 0.14, (0.95, 0.6, 0.6))
    box(0, fy - 0.02, ez - 0.55, 0.5, 0.04, 0.08, DARK)
    box(0.18, fy - 0.03, ez - 0.51, 0.08, 0.04, 0.12, WHITE)  # a snaggle tooth
    # neck bolts poking out of the sides, low on the head
    for s in (-1, 1):
        can(s * (hw * 0.5 + 0.15), 0, hc - hh * 0.3, 0.12, 0.3, BOLT, n=6, rot=(0, math.radians(90), 0))
        can(s * (hw * 0.5 + 0.32), 0, hc - hh * 0.3, 0.2, 0.12, BOLT_D, n=6, rot=(0, math.radians(90), 0))


if __name__ == "__main__" or True:
    run({"frankenstein": build})
