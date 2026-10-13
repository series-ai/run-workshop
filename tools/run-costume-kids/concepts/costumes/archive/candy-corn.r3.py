"""Candy corn: a giant fat three-stripe candy corn kernel over the whole kid,
head and all: a wide yellow base, an orange middle round the head and a
tall white tip shooting way up, faceted and bulging, with a glossy
highlight. The kid's standard face looks out of a big opening in the orange
band; mitts poke out the yellow base (the right one with the full bucket),
tiny shoes underneath."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

YEL, ORANGE, ORANGE_D, TIP, SHINE = (1.0, 0.82, 0.12), (1.0, 0.5, 0.06), (0.86, 0.36, 0.04), (0.98, 0.97, 0.92), (1.0, 1.0, 1.0)
HAIR = (0.3, 0.17, 0.09)
Z0, Z1, RB = 0.58, 7.0, 2.05
ROT = (0, 0, math.radians(15))


def r_at(z):
    t = (z - Z0) / (Z1 - Z0)
    return max(0.05, RB * (1 - t ** 3.0))


def cut(obj, cutter):
    """Boolean `cutter` out of `obj` (the cutter is hidden)."""
    m = obj.modifiers.new("cut", "BOOLEAN")
    m.object, m.operation = cutter, "DIFFERENCE"
    cutter.hide_render = True
    return obj


def opening(w=HEAD * 0.86, h=HEAD * 0.78, back=-0.6, front=-3.0, bevel=0.45):
    """A cutter for the face opening round the standard face."""
    return box(0, (back + front) / 2, HEAD_Z - HEAD * 0.06, w, back - front, h, WHITE, bevel=bevel, segs=3)


def band(za, zb, rgb, steps, hole):
    for k in range(steps):
        a = za + (zb - za) * k / steps
        b = za + (zb - za) * (k + 1) / steps
        o = can(0, 0, (a + b) / 2, r_at(a), b - a + 0.005, rgb, n=12, r2=r_at(b), rot=ROT)
        if hole and a < HEAD_Z + HEAD * 0.4 and b > HEAD_Z - HEAD * 0.5:
            cut(o, hole)


def build():
    body(leg_colour=(0.97, 0.97, 0.97), shoe=(0.45, 0.25, 0.75), torso=False, arms=False)
    kid_head(hair=HAIR)
    hole = opening()
    # a rounded bottom, then the three bands
    can(0, 0, Z0 - 0.05, RB - 0.12, 0.1, YEL, n=12, r2=RB, rot=ROT)
    band(Z0, 2.0, YEL, 3, hole)
    band(2.0, 4.55, ORANGE, 5, hole)
    band(4.55, Z1, TIP, 6, None)
    ball(0, 0, Z1, 0.24, 0.24, 0.18, TIP, seg=8, ring=4)
    # the fringe peeks out under the top of the opening
    box(0, -HEAD * 0.46 - 0.02, HEAD_Z + HEAD * 0.26, HEAD * 0.7, 0.1, 0.3, HAIR, bevel=0.08)   # the fringe
    # a glossy highlight streak on the upper left
    for z, h in ((5.4, 0.8), (4.65, 0.25)):
        x = -r_at(z) * 0.55
        box(x, -r_at(z) * 0.8, z, 0.2, 0.06, h, SHINE, rot=(math.radians(-15), 0, math.radians(-30)))
    # mitts poke out of the yellow base; the right one holds the bucket
    lh = (-2.3, -0.35, 1.15)
    limb((-1.6, -0.2, 1.4), lh, 0.12, YEL)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (2.35, -0.4, 1.3)
    limb((1.6, -0.2, 1.45), rh, 0.12, YEL)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.66)


if __name__ == "__main__" or True:
    render_costume("candy-corn", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
