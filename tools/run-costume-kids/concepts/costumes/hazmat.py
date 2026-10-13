"""Hazmat suit: a bright yellow hazard suit. A big boxy hood over the
standard head, open at the front in a thick black frame so the kid's whole
face shows (no visor, no glass), a chunky respirator on the chin under the
opening with a round filter canister, black gloves and
black boots with taped cuffs, black-and-yellow warning stripes round the
chest and a hazard badge. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

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
    with part("chest"):  # the baggy suit top, its stripe band and the hazard badge
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
        sd = "l" if s > 0 else "r"
        with part(f"foot.{sd}"):
            can(s * TW * 0.24, 0, FOOT * 0.55, 0.17, 0.12, TAPE, n=8)
        hx, hy, hz = hand_points()[s]
        with part(f"hand.{sd}"):
            can(hx - s * 0.02, hy + 0.04, hz + 0.3, 0.15, 0.1, TAPE, n=8)
    bucket(hand_points()[1], full=True, size=0.6)
    # the big boxy hood round the standard head, its front set back so the face pokes out
    with part("head"):
        head_cube(0, HEAD_Z, HEAD, SKIN, HAIR)
        hz = HEAD_Z + 0.16
        hw, hd, hh = HEAD * 1.14, HEAD * 1.12, HEAD * 1.04
        hfy = -HEAD * 0.4
        hy = hfy + hd / 2
        box(0, hy, hz, hw, hd, hh, YEL, bevel=0.55, segs=2)
        box(0, hy, hz - hh / 2 + 0.14, hw - 0.04, hd - 0.04, 0.2, YEL_D, bevel=0.08)  # the hood's seam at the bottom
        for s in (-1, 1):
            box(s * hw / 2, hy + 0.1, hz + 0.1, 0.05, 0.08, hh * 0.7, YEL_D)  # side seams
        # the face opening: a thick black rubber frame, about as wide as the face
        ow, oz0, oz1 = HEAD * 0.45, HEAD_Z - 0.95, HEAD_Z + 0.95
        fy, ft = hfy - 0.1, 0.3
        bw = hw / 2 - ow
        for s in (-1, 1):
            box(s * (ow + bw / 2), fy, (oz0 + oz1) / 2, bw, ft, oz1 - oz0 + 0.5, BLACK, bevel=0.1, segs=2)
        box(0, fy, oz1 + 0.17, ow * 2 + 0.2, ft, 0.34, BLACK, bevel=0.1, segs=2)
        box(0, fy, oz0 - 0.14, ow * 2 + 0.2, ft, 0.3, BLACK, bevel=0.1, segs=2)
        # the respirator on the chin, below the opening: a rounded snout, a round filter canister and side ones
        rz = oz0 - 0.3
        box(0, fy - 0.2, rz, 0.95, 0.42, 0.55, GREY_M, bevel=0.14, segs=2)
        can(0, fy - 0.5, rz - 0.04, 0.32, 0.32, GREY_L, n=12, rot=X90)
        can(0, fy - 0.67, rz - 0.04, 0.26, 0.04, GREY_M, n=12, rot=X90)
        for k in range(3):
            box(0, fy - 0.69, rz - 0.14 + k * 0.1, 0.34, 0.03, 0.04, BLACK)
        for s in (-1, 1):
            can(s * 0.66, fy - 0.18, rz + 0.02, 0.19, 0.28, GREY_L, n=10, rot=(math.radians(90), 0, s * math.radians(-30)))
            can(s * 0.76, fy - 0.33, rz + 0.02, 0.14, 0.04, BLACK, n=10, rot=(math.radians(90), 0, s * math.radians(-30)))

if __name__ == "__main__" or True:
    run({"hazmat": build})
