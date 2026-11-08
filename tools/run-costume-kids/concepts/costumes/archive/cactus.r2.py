"""Cactus: the kid in a big green rounded-cube cactus suit with dark ribs and
little cream spines, a pink flower on top. The kid's face looks out a
window in the front; the arms are two cactus arms bent up, mitts waving out
of the tips; the full bucket hangs off the crook of the right arm."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

GREEN, GREEN_D, SPINE, PINK, PINK_D, POLLEN = (0.36, 0.74, 0.3), (0.22, 0.55, 0.22), (1.0, 0.96, 0.8), (1.0, 0.5, 0.72), (0.92, 0.32, 0.58), (1.0, 0.86, 0.2)
WIN, HAIR = (0.72, 0.9, 1.0), (0.3, 0.17, 0.09)


def face_window(cz, fy, frame, w=1.3, h=1.15):
    """The kid's face in a clear rounded-square window on a costume front at y=fy."""
    box(0, fy + 0.02, cz, w + 0.26, 0.2, h + 0.26, frame, bevel=0.2, segs=2)
    box(0, fy - 0.04, cz, w, 0.2, h, WIN, bevel=0.16, segs=2)
    box(0, fy - 0.1, cz - 0.04, w * 0.84, 0.2, h * 0.82, SKIN, bevel=0.16, segs=2)
    box(0, fy - 0.2, cz + h * 0.3, w * 0.78, 0.12, h * 0.2, HAIR, bevel=0.05)
    face(0, cz - 0.06, fy - 0.2, 1.4, eye=0.16, gap=0.2)
    box(-w * 0.3, fy - 0.15, cz + h * 0.32, 0.12, 0.04, 0.1, WHITE)


def spines(x, y, z, axis):
    """A little V pair of spines sticking out along `axis` ('-y', '+x', '-x', '+z')."""
    for s in (-1, 1):
        if axis == "-y":
            can(x + s * 0.05, y - 0.08, z, 0.035, 0.2, SPINE, n=4, r2=0.0, rot=(math.radians(90), 0, s * 0.4))
        elif axis in ("+x", "-x"):
            sg = 1 if axis == "+x" else -1
            can(x + sg * 0.08, y + s * 0.05, z, 0.035, 0.2, SPINE, n=4, r2=0.0, rot=(0, sg * math.radians(90), s * 0.4))
        else:
            can(x + s * 0.05, y, z + 0.08, 0.035, 0.2, SPINE, n=4, r2=0.0, rot=(0, s * 0.4, 0))


def cactus_arm(s, hz, x0, x1, top):
    """A cactus arm: out from the side at height hz, then up to `top`."""
    box(s * (x0 + x1) / 2, 0, hz, x1 - x0 + 0.2, 0.62, 0.6, GREEN, bevel=0.24, segs=2)
    box(s * x1, 0, (hz + top) / 2, 0.62, 0.62, top - hz + 0.6, GREEN, bevel=0.26, segs=2)
    for k in range(3):
        box(s * x1 + (k - 1) * 0.18, -0.31, (hz + top) / 2, 0.06, 0.04, top - hz, GREEN_D)
    for z in (hz + 0.35, (hz + top) / 2 + 0.2, top - 0.05):
        spines(s * x1, -0.31, z, "-y")
        spines(s * (x1 + 0.31), 0, z - 0.15, "+x" if s > 0 else "-x")
    spines(s * (x0 + x1) / 2, 0, hz + 0.3, "+z")
    hand_mitt(s * x1, -0.05, top + 0.45, -s, MITT, SKIN)


def build():
    body(leg_colour=GREEN_D, shoe=(0.55, 0.32, 0.16), torso=False, arms=False)
    # the body: a big rounded cube with dark ribs
    W, D, z0, z1 = 2.4, 2.0, 0.55, 4.85
    box(0, 0, (z0 + z1) / 2, W, D, z1 - z0, GREEN, bevel=0.75, segs=3)
    fy = -D / 2
    for x in (-0.95, 0.95):
        box(x, -0.74, (z0 + z1) / 2, 0.08, 0.06, z1 - z0 - 1.4, GREEN_D)
    for x in (-0.3, 0.3):
        box(x, fy - 0.01, 1.4, 0.06, 0.04, 1.2, GREEN_D)
    face_window(3.35, fy - 0.02, GREEN_D)
    # spines in columns down the ribs and the front
    for x, y in ((-0.95, -0.77), (0.95, -0.77)):
        for z in (1.2, 1.9, 2.6, 3.3, 4.0):
            spines(x, y, z, "-y")
    for x in (-0.3, 0.3):
        for z in (1.0, 1.6, 2.2):
            spines(x, fy - 0.02, z, "-y")
    for s in (-1, 1):
        for z in (1.4, 2.9, 3.9):
            spines(s * W / 2, 0, z, "+x" if s > 0 else "-x")
    # cactus arms, mitts out of the tips
    cactus_arm(-1, 2.45, 1.05, 1.75, 3.55)
    cactus_arm(1, 2.0, 1.05, 1.85, 3.15)
    # the bucket hangs from the crook of the right arm
    bucket((1.45, -0.05, 1.82), full=True, size=0.62)
    # a pink flower on top
    fz = z1 + 0.08
    for k in range(6):
        a = 2 * math.pi * k / 6
        ball(0.3 * math.cos(a), 0.3 * math.sin(a), fz, 0.42, 0.42, 0.2, PINK if k % 2 else PINK_D, seg=8, ring=4, rot=(0, 0, a))
    ball(0, 0, fz + 0.08, 0.28, 0.28, 0.2, POLLEN, seg=8, ring=4)


if __name__ == "__main__" or True:
    run({"cactus": build})
