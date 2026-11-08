"""Alien carry: the "carried off by an alien" illusion costume. A tall lime
alien (huge black almond eyes, a tiny grin, bobbly antennae, a silver collar)
stands behind the kid, its long arms scooping the kid up: one arm under the
kid's back, the other under the knees, with fake little kid legs in jeans and
sneakers dangling over it. The kid's real head and mitts are the carried kid
(one mitt waving, one with the full bucket); the kid's real legs, in green
tights and green alien shoes, are the alien's legs."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

ALIEN, ALIEN_D, SILVER = (0.55, 0.9, 0.3), (0.36, 0.7, 0.2), (0.8, 0.83, 0.9)
SHIRT, STRIPE, JEANS, SNEAK, HAIR = (0.95, 0.45, 0.2), (1.0, 0.85, 0.3), (0.25, 0.42, 0.78), (0.95, 0.25, 0.3), (0.3, 0.17, 0.09)


def arm(pts, r=0.2):
    for a, b in zip(pts, pts[1:]):
        limb(a, b, r, ALIEN, n=8)
    for p in pts[1:-1]:
        ball(*p, r * 2.1, r * 2.1, r * 2.1, ALIEN, seg=8, ring=6)


def claw(x, y, z, s):
    """A three-finger alien hand, palm up, fingers curling round."""
    ball(x, y, z, 0.42, 0.42, 0.3, ALIEN, seg=8, ring=6)
    for k in (-1, 0, 1):
        limb((x, y + k * 0.12, z), (x - s * 0.28, y + k * 0.15, z + 0.18), 0.06, ALIEN, n=6)
        ball(x - s * 0.3, y + k * 0.15, z + 0.2, 0.15, 0.15, 0.15, ALIEN_D, seg=6, ring=4)


def build():
    body(shirt=ALIEN, pants=ALIEN, leg_colour=ALIEN, shoe=ALIEN_D, torso=False, arms=False)
    # the alien's hips and belly where the kid's real body is
    box(0, 0.25, 0.95, 1.55, 1.3, 1.0, ALIEN, bevel=0.35, segs=2)
    box(0, 0.25, 1.35, 1.6, 1.35, 0.18, SILVER, bevel=0.06)  # a silver belt
    # the alien's tall body behind the kid's head
    box(0, 1.5, 3.0, 1.9, 1.0, 3.3, ALIEN, bevel=0.45, segs=3)
    box(0, 1.2, 4.45, 1.6, 1.3, 0.3, SILVER, bevel=0.1)  # the collar
    # the alien head: a big upside-down egg, looking down at the kid
    hx, hy, hz = 0, 0.95, 5.4
    ball(hx, hy, hz, 2.5, 2.1, 2.1, ALIEN, seg=14, ring=10)
    ball(hx, hy, hz - 0.85, 1.3, 1.2, 0.8, ALIEN, seg=10, ring=6)  # the pointy chin
    fy = hy - 1.0
    for s in (-1, 1):
        o = ball(s * 0.55, fy + 0.12, hz - 0.05, 0.82, 0.3, 1.15, DARK, seg=10, ring=8, rot=(0, s * math.radians(-30), 0))
        ball(s * 0.55 - 0.15, fy - 0.03, hz + 0.18, 0.2, 0.06, 0.24, WHITE, seg=6, ring=4)
        box(s * 0.85, fy + 0.2, hz - 0.6, 0.25, 0.04, 0.1, CHEEK)
        limb((s * 0.45, hy + 0.1, hz + 0.95), (s * 0.75, hy + 0.2, hz + 1.3), 0.05, ALIEN_D, n=6)
        ball(s * 0.75, hy + 0.2, hz + 1.35, 0.26, 0.26, 0.26, (1.0, 0.4, 0.75), seg=8, ring=6)
    box(0, fy + 0.22, hz - 0.72, 0.28, 0.04, 0.06, DARK)  # a tiny grin
    # the carried kid: a fake little shirt torso under the real head...
    box(0, -0.25, 1.55, 1.2, 0.95, 0.5, SHIRT, bevel=0.15, segs=2)
    box(0, -0.25, 1.55, 1.23, 0.98, 0.14, STRIPE)
    # ...and fake legs in jeans, bent over the alien's right arm, dangling
    for k, dy in enumerate((-0.15, -0.55)):
        knee = (1.45, dy - 0.2, 1.45)
        limb((0.45, dy, 1.45), knee, 0.15, JEANS)
        ball(*knee, 0.32, 0.32, 0.32, JEANS, seg=8, ring=6)
        foot = (1.55, dy - 0.25, 0.75)
        limb(knee, foot, 0.14, JEANS)
        box(foot[0] + 0.02, foot[1] - 0.12, foot[2] - 0.12, 0.34, 0.5, 0.26, SNEAK, bevel=0.08, segs=2)
    # the alien arms scoop the kid: right under the knees, left under the back
    arm([(1.0, 1.4, 4.25), (1.75, 0.6, 2.6), (1.25, -0.95, 1.2)])
    claw(1.0, -1.0, 1.25, 1)
    arm([(-1.0, 1.4, 4.25), (-1.75, 0.6, 2.6), (-1.05, -0.6, 1.3)])
    claw(-0.82, -0.62, 1.35, -1)
    # the kid's real head
    kid_head(hair=HAIR)
    # the kid's mitts: the right one waves, the left one holds the bucket
    lh = (-1.6, -0.95, 1.7)
    limb((-0.5, -0.4, 1.7), lh, 0.11, SHIRT)
    hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=True, size=0.6)
    rh = (1.6, -0.85, 2.65)
    limb((0.5, -0.4, 1.75), rh, 0.11, SHIRT)
    hand_mitt(*rh, 1, MITT, SKIN)


if __name__ == "__main__" or True:
    render_costume("alien-carry", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
