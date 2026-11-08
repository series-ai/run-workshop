"""Cupcake: the kid's head wears a giant pink frosting swirl hat (three
stacked rounded tiers, each twisted a little, drips over the brow, rainbow
sprinkles and a cherry on top). The body is the cake: a chocolate muffin top
over a pleated blue cupcake-wrapper skirt; white tights, mitts out over the
rim, one holding the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import random
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

PINK, PINK_D, CHERRY, STEM = (1.0, 0.66, 0.8), (0.95, 0.5, 0.7), (0.9, 0.08, 0.15), (0.35, 0.55, 0.15)
WRAP, WRAP_D, CAKE = (0.45, 0.76, 0.98), (0.3, 0.58, 0.88), (0.55, 0.32, 0.18)
SPRINKLES = [(1.0, 0.95, 0.3), (0.3, 0.8, 1.0), (0.5, 0.9, 0.4), (1.0, 1.0, 1.0), (0.7, 0.4, 0.95), (1.0, 0.45, 0.2)]


def sprinkles(rnd, cx, cy, z, w, d, n, ang):
    for i in range(n):
        u, v = rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5)
        x = cx + u * w * math.cos(ang) - v * d * math.sin(ang)
        y = cy + u * w * math.sin(ang) + v * d * math.cos(ang)
        box(x, y, z, 0.2, 0.06, 0.06, SPRINKLES[i % len(SPRINKLES)], rot=(0, 0, rnd.uniform(0, 3.1)))


def build():
    rnd = random.Random(5)
    body(shirt=CAKE, pants=WRAP, leg_colour=(0.97, 0.97, 0.97), shoe=(0.95, 0.4, 0.6), torso=False, arms=False)
    # the pleated wrapper skirt: a flared cup with ribs
    z0, z1, r0, r1 = 0.55, 1.35, 0.78, 1.12
    can(0, 0, (z0 + z1) / 2, r0, z1 - z0, WRAP, n=16, r2=r1)
    for k in range(16):
        a = 2 * math.pi * (k + 0.5) / 16
        limb((r0 * math.cos(a), r0 * math.sin(a), z0 + 0.02), (r1 * math.cos(a), r1 * math.sin(a), z1 - 0.02), 0.06, WRAP_D, n=4)
    can(0, 0, z1, r1 + 0.03, 0.08, WRAP_D, n=16)
    # the chocolate muffin top over the rim
    box(0, 0, 1.55, 2.3, 2.2, 0.6, CAKE, bevel=0.26, segs=2)
    # arms out over the rim; the right mitt holds the bucket
    lh = (-1.45, -0.2, 1.15)
    limb((-0.95, 0, 1.55), lh, 0.12, CAKE)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.5, -0.25, 1.3)
    limb((0.95, 0, 1.6), rh, 0.12, CAKE)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.68)
    # the head: no hair (it is under the frosting)
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
    face(0, HEAD_Z - HEAD * 0.05, -HEAD * 0.46, HEAD)
    # the frosting swirl hat: a wide brim with drips, then two twisted tiers
    box(0, 0.02, 3.98, 2.78, 2.58, 0.55, PINK, bevel=0.26, segs=2)
    for x, h, w in ((-0.95, 0.5, 0.4), (-0.35, 0.32, 0.34), (0.3, 0.55, 0.42), (0.95, 0.36, 0.36)):
        ball(x, -1.18, 3.72 - h * 0.35, w, 0.3, h + 0.2, PINK, seg=8, ring=6)
    for s in (-1, 1):
        ball(s * 1.32, -0.6, 3.6, 0.3, 0.38, 0.55, PINK, seg=8, ring=6)
    box(0, 0.02, 4.45, 2.05, 1.9, 0.52, PINK_D, bevel=0.23, segs=2, rot=(0, 0, math.radians(18)))
    box(0, 0.02, 4.86, 1.35, 1.25, 0.46, PINK, bevel=0.2, segs=2, rot=(0, 0, math.radians(36)))
    sprinkles(rnd, 0, 0.02, 4.265, 2.3, 2.1, 22, 0)
    sprinkles(rnd, 0, 0.02, 4.72, 1.6, 1.45, 12, math.radians(18))
    sprinkles(rnd, 0, 0.02, 5.1, 0.9, 0.8, 6, math.radians(36))
    for i in range(8):                                    # a few on the brim front
        box(rnd.uniform(-1.1, 1.1), -1.3, rnd.uniform(3.85, 4.1), 0.18, 0.05, 0.06, SPRINKLES[i % 6], rot=(0, rnd.uniform(0, 3.1), 0))
    # the cherry
    ball(0, 0, 5.3, 0.5, 0.5, 0.46, CHERRY, seg=10, ring=8)
    ball(-0.1, -0.2, 5.4, 0.12, 0.06, 0.1, WHITE, seg=6, ring=4)
    limb((0, 0, 5.5), (0.15, 0.05, 5.7), 0.035, STEM)


if __name__ == "__main__" or True:
    run({"cupcake": build})
