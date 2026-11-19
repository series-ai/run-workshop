"""Yard decorations (concepts/street-props.png): two tombstones, a hay bale
with pumpkins, a leaf pile, a mailbox, a fire hydrant, a "SPOOKY ST" street
sign (chunky raised letters), a crow on a post, a round bush and a hedge.
Budget <= 600 tris each.

    Blender -b -t 1 --factory-startup --python neighborhood/props/yard.py -- neighborhood/renders [slug ...]
"""
import math
import os
import random
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from streetkit import *  # noqa: E402,F403

AX = (0, math.radians(90), 0)
AY = (math.radians(90), 0, 0)
STONE = (0.62, 0.62, 0.66)
STONE_DK = (0.50, 0.50, 0.55)
DIRT = (0.40, 0.32, 0.26)
GRASS = (0.38, 0.52, 0.26)
MOSS = (0.45, 0.58, 0.28)
STRAW = (0.93, 0.80, 0.45)
STRAW_DK = (0.80, 0.66, 0.34)
TWINE = (0.55, 0.38, 0.22)
ORANGE = (0.95, 0.50, 0.13)
STEM = (0.36, 0.45, 0.20)
CREAM = (0.95, 0.90, 0.70)
LEAVES = [(0.93, 0.47, 0.13), (0.82, 0.24, 0.14), (0.97, 0.70, 0.20), (0.88, 0.36, 0.12)]
WOOD = (0.62, 0.44, 0.28)
WOOD_DK = (0.46, 0.33, 0.23)
RED = (0.84, 0.18, 0.15)
RED_DK = (0.66, 0.13, 0.12)
METAL = (0.55, 0.56, 0.60)
SIGN = (0.20, 0.27, 0.30)
SIGN_EDGE = (0.92, 0.92, 0.88)
BLACK = (0.13, 0.12, 0.15)
BEAK = (0.32, 0.30, 0.34)
EYE = (0.98, 0.82, 0.25)
LEAF_G = [(0.27, 0.42, 0.24), (0.32, 0.48, 0.26), (0.24, 0.37, 0.22)]


def tuft(x, y, rgb=GRASS, h=0.35):
    for dx, a in ((-0.08, -0.3), (0.06, 0.25), (0.0, 0.0)):
        can(x + dx, y, h / 2, 0.07, h, rgb, n=4, r2=0.0, rot=(0, a, 0))


def pumpkin(x, y, z0, s, gourd=False):
    rgb = CREAM if gourd else ORANGE
    ball(x, y, z0 + s * 0.38, s, s, s * 0.76, rgb, seg=8, ring=5)
    can(x, y, z0 + s * 0.8, 0.06 + s * 0.04, s * 0.22, STEM, n=5)


# ---------------------------------------------------------------- tombstones

def tombstone_round():
    box(0, 0, 0.12, 2.2, 1.1, 0.24, DIRT, bevel=0.06)
    box(0, 0, 0.95, 1.6, 0.42, 1.5, STONE, bevel=0.07)
    can(0, 0, 1.6, 0.8, 0.42, STONE, n=10, rot=AY)
    box(0, -0.24, 1.3, 0.22, 0.08, 1.05, STONE_DK)                 # raised cross
    box(0, -0.24, 1.55, 0.7, 0.08, 0.22, STONE_DK)
    box(0, -0.24, 0.55, 1.1, 0.06, 0.12, STONE_DK)                 # an epitaph line
    for x, y in ((-0.85, -0.35), (0.9, -0.3), (0.7, 0.4)):
        tuft(x, y)
    box(0.55, -0.22, 2.0, 0.35, 0.05, 0.2, MOSS, rot=(0, 0.4, 0))


def tombstone_cross():
    box(0, 0, 0.12, 1.8, 1.2, 0.24, DIRT, bevel=0.06)
    box(0, 0, 0.4, 1.1, 0.75, 0.35, STONE_DK, bevel=0.05)
    rot = (0, math.radians(7), 0)
    box(0.12, 0, 1.75, 0.48, 0.4, 2.7, STONE, bevel=0.06, rot=rot)
    box(0.22, 0, 2.35, 1.6, 0.4, 0.46, STONE, bevel=0.06, rot=rot)
    box(-0.2, -0.21, 0.95, 0.3, 0.05, 0.25, MOSS, rot=(0, 0.3, 0))
    for x, y in ((-0.7, -0.45), (0.75, -0.4)):
        tuft(x, y)


# ---------------------------------------------------------------- harvest

def hay_bale():
    box(0, 0, 0.7, 2.8, 1.5, 1.4, STRAW, bevel=0.12)
    for x in (-0.75, 0.75):                                         # twine bands
        box(x, 0, 0.7, 0.12, 1.56, 1.46, TWINE)
    for x, z in ((-1.2, 1.38), (1.0, 1.38), (1.42, 0.5)):           # straw tufts
        can(x, -0.2, z, 0.12, 0.25, STRAW_DK, n=4, r2=0.0, rot=(0.4, 0.5, 0))
    pumpkin(-0.55, -0.05, 1.4, 1.1)
    pumpkin(0.5, 0.15, 1.4, 0.75)
    pumpkin(0.05, -0.35, 1.4, 0.45, gourd=True)
    pumpkin(-1.1, -1.25, 0, 1.0)
    pumpkin(0.6, -1.15, 0, 0.6)


def leaf_pile():
    rng = random.Random(4)
    dome(0, 0, 0, 3.0, 2.6, 1.35, (0.90, 0.55, 0.18), seg=8, ring=3, base=0.05)
    for i in range(34):
        a = rng.uniform(0, 2 * math.pi)
        rr = math.sqrt(rng.uniform(0.25, 1)) * 0.97 if i < 26 else rng.uniform(1.05, 1.5)
        x, y = math.cos(a) * rr * 1.5, math.sin(a) * rr * 1.3
        k = max(0.0, 1 - (x / 1.5) ** 2 - (y / 1.3) ** 2)
        z = 1.35 * math.sqrt(k) * 0.9 + 0.04 if i < 26 else 0.03
        tip = 0.6 * (1 - math.sqrt(k)) if i < 26 else 0.0          # leaves lie along the slope
        box(x, y, z, 0.6, 0.44, 0.06, rng.choice(LEAVES), rot=(rng.uniform(-0.3, 0.3) - tip * math.sin(a), tip * math.cos(a), a))


# ---------------------------------------------------------------- street furniture

def mailbox():
    box(0, 0.1, 1.35, 0.3, 0.3, 2.7, WOOD, bevel=0.03)
    box(0, 0.1, 2.75, 0.5, 1.1, 0.12, WOOD_DK)
    box(0, 0.0, 3.06, 0.9, 1.5, 0.5, RED, bevel=0.03)
    can(0, 0.0, 3.3, 0.45, 1.5, RED, n=10, rot=AY)
    box(0, -0.76, 3.15, 0.8, 0.04, 0.6, RED_DK)                    # door
    box(0, -0.8, 3.2, 0.14, 0.06, 0.1, METAL)                      # latch
    box(0.5, 0.25, 3.25, 0.06, 0.12, 0.7, RED_DK)                  # flag arm (up)
    box(0.5, 0.42, 3.53, 0.06, 0.38, 0.24, RED)                    # flag


def hydrant():
    can(0, 0, 0.1, 0.6, 0.2, RED_DK, n=8)
    can(0, 0, 0.85, 0.42, 1.3, RED, n=8)
    can(0, 0, 1.55, 0.52, 0.16, RED_DK, n=8)
    dome(0, 0, 1.6, 0.86, 0.86, 0.42, RED, seg=8, ring=2)
    can(0, 0, 2.08, 0.13, 0.18, RED_DK, n=5)
    for sx in (-1, 1):                                             # side nozzles with caps
        can(sx * 0.5, 0, 1.12, 0.17, 0.24, RED, n=6, rot=AX)
        can(sx * 0.63, 0, 1.12, 0.12, 0.08, RED_DK, n=5, rot=AX)
    can(0, -0.5, 1.05, 0.24, 0.26, RED, n=6, rot=AY)                # front pumper
    can(0, -0.65, 1.05, 0.15, 0.08, RED_DK, n=5, rot=AY)


# a 3 x 5 block font: rectangles (x0, z0, x1, z1) in grid cells
FONT = {
    "S": ((0, 4, 3, 5), (0, 2, 1, 5), (0, 2, 3, 3), (2, 0, 3, 3), (0, 0, 3, 1)),
    "P": ((0, 0, 1, 5), (0, 4, 3, 5), (2, 2, 3, 5), (0, 2, 3, 3)),
    "O": ((0, 0, 1, 5), (2, 0, 3, 5), (0, 4, 3, 5), (0, 0, 3, 1)),
    "K": ((0, 0, 1, 5), (1, 2, 2, 3), (2, 3, 3, 5), (2, 0, 3, 2)),
    "Y": ((0, 3, 1, 5), (2, 3, 3, 5), (0, 2, 3, 3), (1, 0, 2, 3)),
    "T": ((0, 4, 3, 5), (1, 0, 2, 4)),
}


def raised_text(text, cx, y, cz, cell, rgb):
    adv = [4 if ch != " " else 2 for ch in text]
    width = (sum(adv) - 1) * cell
    x = cx - width / 2
    for ch, a in zip(text, adv):
        for x0, z0, x1, z1 in FONT.get(ch, ()):
            box(x + (x0 + x1) / 2 * cell, y, cz + ((z0 + z1) / 2 - 2.5) * cell,
                (x1 - x0) * cell, 0.06, (z1 - z0) * cell, rgb)
        x += a * cell


def street_sign():
    can(0, 0, 0.12, 0.3, 0.24, METAL, n=6)
    can(0, 0, 3.5, 0.12, 7.0, METAL, n=6)
    can(0, 0, 7.05, 0.16, 0.12, METAL, n=6)
    box(0.4, 0, 6.35, 3.5, 0.14, 0.8, SIGN_EDGE, bevel=0.04)       # white rim
    box(0.4, 0, 6.35, 3.34, 0.18, 0.64, SIGN)
    raised_text("SPOOKY ST", 0.4, -0.1, 6.35, 0.09, SIGN_EDGE)
    box(0, 0, 5.75, 0.14, 2.6, 0.55, SIGN, bevel=0.03)             # the cross street blade (blank)


def crow_post():
    box(0, 0, 1.3, 0.46, 0.46, 2.6, WOOD, bevel=0.04)
    hull([(x, y, z) for x in (-0.23, 0.23) for y in (-0.23, 0.23)
          for z in ((2.6, 2.75) if y < 0 else (2.6, 2.6))], WOOD_DK)  # weathered slanted cap
    # the crow, facing front-left
    rot = math.radians(-35)
    c, s = math.cos(rot), math.sin(rot)

    def P(x, y, z):
        return (x * c - y * s, x * s + y * c, z)
    for sx in (-1, 1):
        limb(P(sx * 0.1, 0.0, 2.72), P(sx * 0.1, 0.02, 3.0), 0.035, BEAK, n=4)
    ball(*P(0, 0.05, 3.3), 0.62, 0.95, 0.62, BLACK, seg=8, ring=5, rot=(0, 0, rot))
    ball(*P(0, -0.42, 3.72), 0.48, 0.5, 0.48, BLACK, seg=8, ring=5)
    can(*P(0, -0.74, 3.7), 0.11, 0.3, BEAK, n=4, r2=0.0, rot=(math.radians(95), 0, rot))
    for sx in (-1, 1):
        ball(*P(sx * 0.2, -0.56, 3.8), 0.08, 0.08, 0.08, EYE, seg=4, ring=3)
        hull([P(sx * x, y, z) for x, y, z in ((0.3, -0.3, 3.5), (0.34, 0.2, 3.55), (0.3, 0.55, 3.2),
                                               (0.24, -0.25, 3.25), (0.26, 0.3, 3.1))], BLACK)  # folded wing
    hull([P(x, y, z) for x, y, z in ((-0.14, 0.4, 3.25), (0.14, 0.4, 3.25), (-0.22, 0.95, 3.0),
                                      (0.22, 0.95, 3.0), (0, 0.4, 3.4), (0, 0.95, 3.08))], BLACK)  # tail


# ---------------------------------------------------------------- greenery

def bush():
    rng = random.Random(2)
    for x, y, z, s in ((0, 0, 0.9, 2.1), (-0.85, -0.2, 0.7, 1.5), (0.9, -0.1, 0.75, 1.6),
                       (0.2, 0.5, 1.4, 1.5), (-0.3, -0.45, 1.5, 1.2)):
        ball(x, y, z, s, s, s * 0.9, rng.choice(LEAF_G), seg=7, ring=5)
    for i in range(3):                                              # a few berries
        a = rng.uniform(3.6, 5.8)
        ball(math.cos(a) * 1.0, math.sin(a) * 0.9, 1.0 + i * 0.25, 0.16, 0.16, 0.16, (0.80, 0.22, 0.18), seg=4, ring=3)


def hedge():
    box(0, 0, 1.15, 4.0, 1.6, 2.1, LEAF_G[0], bevel=0.35)
    rng = random.Random(6)
    for i, x in enumerate((-1.4, -0.45, 0.5, 1.4)):
        s = rng.uniform(1.1, 1.4)
        ball(x, rng.uniform(-0.2, 0.2), 2.05, s, 1.4, s * 0.7, LEAF_G[1 + i % 2], seg=7, ring=4)
    for x in (-1.0, 0.95):
        ball(x, -0.72, 1.0, 1.2, 0.5, 1.2, LEAF_G[2], seg=6, ring=4)


YARD = {"tombstone-round": tombstone_round, "tombstone-cross": tombstone_cross,
        "hay-bale": hay_bale, "leaf-pile": leaf_pile, "mailbox": mailbox, "hydrant": hydrant,
        "street-sign": street_sign, "crow-post": crow_post, "bush": bush, "hedge": hedge}

main_for(YARD, "yard")
