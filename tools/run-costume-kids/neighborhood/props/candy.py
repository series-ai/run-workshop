"""Candy pickups (concepts/candy-pickups.png): wrapped candy, swirl lollipop,
candy corn, chocolate bar, gumdrop and caramel apple. Faceted, flat colours,
~1 unit tall (kid-hand scale but readable as a pickup), pivot at the base.
Budget <= 400 tris each.

    Blender -b -t 1 --factory-startup --python neighborhood/props/candy.py -- neighborhood/renders [slug ...]
"""
import math
import os
import random
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from streetkit import *  # noqa: E402,F403
from mathutils import Euler  # noqa: E402

AX = (0, math.radians(90), 0)
AY = (math.radians(90), 0, 0)
ORANGE = (0.96, 0.52, 0.12)
BLACK = (0.15, 0.13, 0.15)
GREEN = (0.40, 0.75, 0.30)
PINK = (0.95, 0.52, 0.66)
PINK_LT = (0.99, 0.84, 0.88)
WHITE = (0.98, 0.96, 0.92)
STICK = (0.92, 0.80, 0.62)
YELLOW = (0.99, 0.86, 0.22)
CHOC = (0.48, 0.29, 0.19)
CHOC_LT = (0.56, 0.35, 0.23)
FOIL = (0.70, 0.71, 0.74)
PURPLE = (0.62, 0.38, 0.85)
SUGAR = (0.90, 0.84, 0.98)
CARAMEL = (0.68, 0.42, 0.20)
RED = (0.88, 0.20, 0.18)
NUT = (0.90, 0.74, 0.52)


def tilt(rx=0.0, ry=0.0, rz=0.0):
    """Turn everything built so far about the origin."""
    R = Euler((rx, ry, rz)).to_matrix().to_4x4()
    for o in bpy.context.scene.objects:
        o.matrix_world = R @ o.matrix_world


def wrapped():
    ball(0, 0, 0, 0.95, 0.62, 0.62, ORANGE, seg=10, ring=6)
    for x in (-0.14, 0.14):
        can(x, 0, 0, 0.3, 0.1, BLACK, n=10, rot=AX)
    for sx in (-1, 1):
        can(sx * 0.6, 0, 0, 0.07, 0.3, GREEN, n=6, r2=0.24, rot=(0, sx * math.radians(90), 0))
        can(sx * 0.42, 0, 0, 0.1, 0.12, GREEN, n=6, rot=AX)
    tilt(ry=math.radians(-35))


def lollipop():
    limb((0.0, 0, 0.0), (0.0, 0, 0.62), 0.05, STICK, n=5)
    cz = 0.92
    can(0, 0, cz, 0.36, 0.2, PINK, n=12, rot=AY)
    for sy in (-1, 1):                                            # a white spiral on both faces
        pts = [(sy * math.cos(a) * r, sy * 0.1, cz + math.sin(a) * r)
               for a, r in ((i * 0.75, 0.03 + i * 0.024) for i in range(13))]
        tube(pts, [0.045] * len(pts), PINK_LT, n=4, tip=False)
    rng = random.Random(3)
    for i in range(6):                                            # sprinkles round the rim top
        a = math.radians(30 + i * 24)
        box(math.cos(a) * 0.34, rng.uniform(-0.06, 0.06), cz + math.sin(a) * 0.34, 0.08, 0.05, 0.04,
            rng.choice([YELLOW, GREEN, ORANGE, PURPLE]), rot=(0, -a, 0))
    tilt(ry=math.radians(14))


def candy_corn():
    can(0, 0, 0.18, 0.4, 0.36, YELLOW, n=8, r2=0.35)
    can(0, 0, 0.53, 0.35, 0.34, ORANGE, n=8, r2=0.24)
    can(0, 0, 0.81, 0.24, 0.22, WHITE, n=8, r2=0.13)
    dome(0, 0, 0.92, 0.26, 0.26, 0.1, WHITE, seg=8, ring=1)


def chocolate():
    box(0, 0, 0.5, 0.7, 0.16, 1.0, CHOC, bevel=0.03)
    for cx in (-0.17, 0.17):
        for cz in (0.58, 0.85):
            box(cx, -0.09, cz, 0.26, 0.05, 0.2, CHOC_LT, bevel=0.02)
    box(0, 0, 0.22, 0.78, 0.22, 0.44, FOIL)                       # the foil sleeve
    for x, h in ((-0.28, 0.14), (0.0, 0.08), (0.24, 0.12)):     # torn edge
        hull([(x + dx, y, 0.44) for dx in (-0.12, 0.12) for y in (-0.11, 0.11)]
             + [(x, y, 0.44 + h) for y in (-0.11, 0.11)], FOIL)
    tilt(rx=math.radians(-8))


def gumdrop():
    can(0, 0, 0.24, 0.46, 0.48, PURPLE, n=10, r2=0.38)
    dome(0, 0, 0.48, 0.76, 0.76, 0.34, PURPLE, seg=10, ring=2)
    rng = random.Random(5)
    for i in range(12):
        a = rng.uniform(0, 2 * math.pi)
        z = rng.uniform(0.12, 0.72)
        r = 0.45 - 0.1 * z if z < 0.48 else 0.38 * math.sqrt(max(0.05, 1 - ((z - 0.48) / 0.34) ** 2))
        box(math.cos(a) * r, math.sin(a) * r, z, 0.07, 0.07, 0.07, SUGAR, rot=(a, a * 0.5, a))


def caramel_apple():
    can(0, 0, 0.03, 0.36, 0.06, CARAMEL, n=10)                    # the pooled drip
    ball(0, 0, 0.38, 0.84, 0.84, 0.74, CARAMEL, seg=10, ring=6)
    dome(0, 0, 0.63, 0.6, 0.6, 0.18, RED, seg=8, ring=1)          # the red apple top
    limb((0, 0, 0.6), (0.06, 0, 1.2), 0.05, STICK, n=5)
    rng = random.Random(9)
    for i in range(10):
        a = rng.uniform(0, 2 * math.pi)
        z = rng.uniform(0.15, 0.5)
        r = 0.42 * math.sqrt(max(0.1, 1 - ((z - 0.38) / 0.37) ** 2))
        box(math.cos(a) * r, math.sin(a) * r, z, 0.08, 0.08, 0.07, NUT, rot=(a, 0.4, a))


CANDY = {"candy-wrapped": wrapped, "candy-lollipop": lollipop, "candy-corn": candy_corn,
         "candy-chocolate": chocolate, "candy-gumdrop": gumdrop, "candy-apple": caramel_apple}

main_for(CANDY, "candy")
