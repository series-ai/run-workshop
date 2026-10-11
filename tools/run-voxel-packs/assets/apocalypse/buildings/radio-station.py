"""A community radio station: a low block hut with a lean-to roof beside a
tall red and white lattice mast with a beacon, guy wires and a dish."""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import idx, lattice, limb, make
from _rep_bld import boards_x, text_c
from pnkit import box, door, edges, window
from voxgrid import C, Grid, Part

SIZE = (112, 136, 92)
HX0, HX1, HZ0, HZ1, HTOP = 10, 62, 30, 80, 38   # the hut
MX, MZ, MTOP = 86, 50, 118                       # the mast


def build():
    g = Grid(*SIZE)
    X, Y, Z = idx(g)
    yard = box(g, 2, 0, 4, 110, 3, 90, "sand", 4)
    PP.concrete(g, yard, "sand", 4, size=14, cracks=9, frame="top", seed=1)
    # The mast stands on a concrete footing.
    footing = box(g, MX - 14, 3, MZ - 14, MX + 14, 6, MZ + 14, "steel", 5)
    PP.concrete(g, footing, "steel", 5, size=7, cracks=2, frame="top", seed=2)
    P.flat(g, edges(footing), "steel", 3)

    # The hut: cinder blocks, a teal base band, a lean-to corrugated roof.
    hut = box(g, HX0, 3, HZ0, HX1, HTOP, HZ1, "sand", 5)
    P.stone(g, hut, "sand", 5, block=(8, 4), mortar=-2, cracks=0.1, seed=3)
    P.flat(g, hut & (Y < 9), "teal", 3)
    P.flat(g, hut & (Y == 9), "teal", 2)
    P.grime(g, hut & (Y < 14), height=5, seed=4)
    for x0 in (HX0 - 1, HX1 - 3):
        for z0 in (HZ0 - 1, HZ1 - 3):
            post = box(g, x0, 3, z0, x0 + 4, HTOP + 1, z0 + 4, "steel", 4)
            P.flat(g, edges(post), "steel", 2)
    g.prism("x", [(HTOP, HZ0 - 8), (HTOP + 9, HZ0 - 8), (HTOP + 4, HZ1 + 5), (HTOP, HZ1 + 5)], HX0 - 4, HX1 + 4, C("rust", 4))
    roof = g.solids[-1].mask(g.shape)
    PP.corrugate(g, roof, "rust", 4, period=3, sheet=10, frame=((1, 0, 0), (0, -5, 13)), seed=5)
    P.flat(g, roof & ((X < HX0 - 2) | (X >= HX1 + 2)), "darkwood", 3)
    PP.blotch(g, roof, "rust", 2, cell=3, chance=0.06, seed=6)

    # Door, windows and the ON AIR board on the front.
    door(g, "-z", HZ0, 18, 34, 3, 31, leaf="teal", seed=7)
    window(g, "-z", HZ0, 42, 56, 14, 28, glass="gold", glow=5)
    window(g, "+z", HZ1, 18, 32, 14, 28, glass="gold", glow=4)
    window(g, "+z", HZ1, 40, 54, 14, 28, glass="gold", glow=4)
    window(g, "-x", HX0, 44, 58, 14, 28, glass="gold", glow=4)
    boards_x(g, "+z", HZ1, 40, 54, 14, 28, seed=8)
    sign = box(g, 14, 40, HZ0 - 12, 56, 51, HZ0 - 8, "red", 4)
    P.outline(g, sign, "darkwood", 2, normal="z")
    text_c(g, "-z", HZ0 - 12, 35, 42, "ON AIR", "gold", 7)

    # The dish on the roof looks up toward the sky.
    box(g, 44, HTOP + 5, 56, 47, HTOP + 12, 59, "steel", 4)
    dish = S.disc(g, "z", 45.5, HTOP + 20, 9, 55, 58, "bone", 6, n=8)
    P.flat(g, dish & ((X - 45.5) ** 2 + (Y - HTOP - 19.5) ** 2 < 25), "bone", 5)
    P.outline(g, dish, "steel", 3, normal="z")
    limb(g, (45.5, HTOP + 20, 55), (45.5, HTOP + 20, 48), 1.0, 0.6, "steel", 3)
    box(g, 44, HTOP + 19, 46, 47, HTOP + 22, 49, "red", 4)

    # The mast: four legs, girts and X braces, painted in red and white bands.
    levels = list(range(8, MTOP, 14)) + [MTOP]
    mast = lattice(g, MX, MZ, 6, MTOP, 11, 3.5, levels, leg=1.8, brace=1.1, ramp="bone", shade=6)
    band = (Y // 14) % 2 == 0
    P.flat(g, mast & band, "red", 4)
    P.flat(g, mast & ~band, "bone", 6)
    # A whip antenna and a red beacon cage crown the mast.
    cap = box(g, MX - 4, MTOP, MZ - 4, MX + 4, MTOP + 3, MZ + 4, "steel", 4)
    P.flat(g, edges(cap), "steel", 2)
    beacon = box(g, MX - 2, MTOP + 3, MZ - 2, MX + 2, MTOP + 8, MZ + 2, "red", 6)
    P.flat(g, beacon & (Y == MTOP + 7), "red", 7)
    limb(g, (MX, MTOP + 8, MZ), (MX, MTOP + 17, MZ), 0.8, 0.5, "steel", 4)
    for yy in (40, 76, 104):
        for sx in (-1, 1):
            h = 11 + (3.5 - 11) * (yy - 6) / (MTOP - 6)
            arm = box(g, MX + sx * h - (4 if sx < 0 else 0), yy, MZ - 1, MX + sx * h + (4 if sx > 0 else 0), yy + 2, MZ + 1, "steel", 3)
            panel = box(g, MX + sx * (h + 3) - 1.5, yy - 6, MZ - 2, MX + sx * (h + 3) + 1.5, yy + 8, MZ + 2, "steel", 5)
            P.plates(g, panel, "steel", 5, size=(3, 5), seed=yy + sx)
    # Guy wires run from the mast to anchors on the ground.
    for ax, az in ((106, 82), (106, 18), (64, 86)):
        limb(g, (MX + (2 if ax > MX else -2), 92, MZ + (2 if az > MZ else -2)), (ax, 4, az), 0.7, 0.7, "iron", 3)
        anchor = box(g, ax - 3, 3, az - 3, ax + 3, 6, az + 3, "steel", 4)
        P.flat(g, edges(anchor), "steel", 2)
    # A signal cable runs from the mast into the hut wall.
    for a, b in (((MX - 10, 22, MZ), (HX1 + 1, 22, MZ)),):
        limb(g, a, b, 0.9, 0.9, "darkwood", 2)

    # A generator and two fuel drums stand by the hut.
    gen = box(g, 66, 3, 14, 82, 16, 26, "gold", 4)
    PP.plated(g, gen, "gold", 4, size=(6, 5), seed=9)
    P.flat(g, gen & (Z == 14) & (Y > 6) & (Y < 13) & (X > 69) & (X < 79), "darkwood", 2)
    box(g, 78, 16, 16, 80, 21, 18, "steel", 3)
    for cx, cz, ramp in ((6, 22, "red"), (6, 12, "teal")):
        drum = S.disc(g, "y", cx, cz, 4.5, 3, 18, ramp, 4, n=8)
        P.flat(g, drum & ((Y == 7) | (Y == 13)), ramp, 2)
        P.flat(g, drum & (Y == 17), "steel", 4)
    return make("buildings", "radio-station", "Community Radio Station", Part("radio-station", g))
