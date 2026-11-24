"""Hazmat suit: a bright yellow hazard suit. A big boxy hood over the giant
head with a wide clear visor (the kid's face and fringe inside), a chunky
respirator under the visor with a round filter canister, black gloves and
black boots with taped cuffs, black-and-yellow warning stripes round the
chest and a hazard badge. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

# glass() from the spaceman (its source, minus its run line)
_src = open(_PKG + "/concepts/costumes/spaceman.py").read()
exec(compile(_src[: _src.rindex("\nif __name__")], "spaceman.py", "exec"))

YEL, YEL_D, BLACK, GREY_M, GREY_L = (1.0, 0.84, 0.1), (0.88, 0.68, 0.05), (0.12, 0.12, 0.13), (0.35, 0.36, 0.4), (0.6, 0.62, 0.66)
TAPE, HAIR = (0.25, 0.25, 0.28), (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)


def stripes(x, y, z, w, h, n=5, rot=(0, 0, 0)):
    """A black band with slanted yellow warning stripes on it (facing -y)."""
    box(x, y, z, w, 0.05, h, BLACK)
    for k in range(n):
        sx = x - w / 2 + w * (k + 0.5) / n
        box(sx, y - 0.02, z, w / n * 0.45, 0.04, h * 1.1, YEL, rot=(0, math.radians(35), 0))


def build():
    body(shirt=YEL, pants=YEL, leg_colour=YEL, shoe=BLACK, sleeve=YEL, mitt=BLACK, torso=False)
    # a baggy suit torso, a bit bigger than the base torso
    box(0, 0, HIP + TH * 0.5, TW + 0.2, TD + 0.2, TH + 0.1, YEL, bevel=0.16, segs=2)
    fy = -(TD + 0.2) / 2
    # the warning stripe band and a hazard badge
    box(0, 0, HIP + 0.32, TW + 0.24, TD + 0.24, 0.2, BLACK, bevel=0.03)
    for k in range(6):
        box(-0.45 + k * 0.18, fy - 0.03, HIP + 0.32, 0.08, 0.04, 0.24, YEL, rot=(0, math.radians(35), 0))
    can(0, fy - 0.02, HIP + 0.68, 0.17, 0.04, BLACK, n=3, rot=(math.radians(90), 0, math.radians(180)))
    can(0, fy - 0.04, HIP + 0.66, 0.11, 0.04, YEL, n=3, rot=(math.radians(90), 0, math.radians(180)))
    box(0, fy - 0.06, HIP + 0.67, 0.03, 0.03, 0.08, BLACK)
    # taped cuffs on the boots and gloves
    for s in (-1, 1):
        can(s * TW * 0.24, 0, FOOT * 0.55, 0.17, 0.12, TAPE, n=8)
        hx, hy, hz = hand_points()[s]
        can(hx - s * 0.02, hy + 0.04, hz + 0.3, 0.15, 0.1, TAPE, n=8)
    bucket(hand_points()[1], full=True, size=0.65)
    # the big boxy hood
    hz = HEAD_Z + 0.05
    box(0, 0.08, hz, HEAD * 1.08, HEAD * 0.98, HEAD * 1.04, YEL, bevel=0.42, segs=2)
    box(0, 0.08, hz - HEAD * 0.52 + 0.14, HEAD * 1.06, HEAD * 0.96, 0.2, YEL_D, bevel=0.08)  # the hood's seam at the bottom
    for s in (-1, 1):
        box(s * HEAD * 0.54, 0.1, hz + 0.1, 0.05, 0.08, HEAD * 0.75, YEL_D)  # side seams
    hfy = 0.08 - HEAD * 0.49
    # the visor: a black frame, the kid's face behind clear plastic
    vz = hz + 0.18
    vw, vh = HEAD * 0.82, HEAD * 0.56
    box(0, hfy + 0.02, vz, vw + 0.22, 0.3, vh + 0.22, BLACK, bevel=0.14, segs=2)
    box(0, hfy - 0.06, vz - 0.02, vw * 0.94, 0.2, vh * 0.92, SKIN, bevel=0.16, segs=2)
    box(0, hfy - 0.16, vz + vh * 0.34, vw * 0.88, 0.12, vh * 0.22, HAIR, bevel=0.06)
    face(0, vz - 0.12, hfy - 0.16, HEAD * 0.74)
    o = box(0, hfy - 0.25, vz, vw, 0.06, vh, WHITE, bevel=0.02)
    glass(o, rgb=(0.75, 0.92, 1.0), alpha=0.14)
    for k, (gx, gw) in enumerate(((-vw * 0.32, 0.12), (-vw * 0.22, 0.06))):
        box(gx, hfy - 0.29, vz + 0.05, gw, 0.03, vh * 0.7, WHITE, rot=(0, math.radians(20), 0))  # glint stripes
    # the respirator under the visor: a rounded snout, a round filter canister and a side one
    rz = hz - 0.82
    box(0, hfy - 0.2, rz, 0.9, 0.42, 0.5, GREY_M, bevel=0.14, segs=2)
    can(0, hfy - 0.5, rz - 0.04, 0.3, 0.32, GREY_L, n=12, rot=X90)
    can(0, hfy - 0.67, rz - 0.04, 0.24, 0.04, GREY_M, n=12, rot=X90)
    for k in range(3):
        box(0, hfy - 0.69, rz - 0.14 + k * 0.1, 0.32, 0.03, 0.04, BLACK)
    for s in (-1, 1):
        can(s * 0.62, hfy - 0.18, rz + 0.02, 0.17, 0.26, GREY_L, n=10, rot=(math.radians(90), 0, s * math.radians(-30)))
        can(s * 0.71, hfy - 0.32, rz + 0.02, 0.13, 0.04, BLACK, n=10, rot=(math.radians(90), 0, s * math.radians(-30)))


if __name__ == "__main__" or True:
    run({"hazmat": build})
