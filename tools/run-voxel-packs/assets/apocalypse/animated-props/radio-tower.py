"""Radio tower, in the Pirate Nation style.

A tall caricature mast, almost three persons high: a tapered four-legged
lattice with X braces (true slopes) in red and white aviation bands, on a
concrete pad with a khaki junction box. A grated work platform with a
railing carries a big dish that scans on `idle`; panel antennas ring the
top, and a whip antenna ends in a red beacon that blinks on `idle`.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, keys, lattice, limb, make, plan
from pnkit import box, edges
from voxgrid import Clip, Grid

SZ = (48, 100, 48)
CX = CZ = 23.5
Y0, Y1 = 3, 80
HALF0, HALF1 = 11.0, 3.0
LEVELS = (Y0, 16, 30, 44, 58, 70, Y1)
PLAT = 58
DISH = (CX, PLAT + 9.0, CZ)
BEACON_Y = 95


def half(y):
    return HALF0 + (HALF1 - HALF0) * (y - Y0) / (Y1 - Y0)


def tower() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    pad = box(g, CX - 15, 0, CZ - 15, CX + 15, Y0, CZ + 15, "sand", 5)
    PP.concrete(g, pad, "sand", 5, size=10, cracks=4, frame="top", seed=1)
    P.outline(g, pad, "sand", 3, normal="y")
    for sx in (-1, 1):
        for sz in (-1, 1):
            foot = box(g, CX + sx * HALF0 - 2.5, Y0, CZ + sz * HALF0 - 2.5, CX + sx * HALF0 + 2.5, Y0 + 2, CZ + sz * HALF0 + 2.5, "steel", 4)
            del foot
    mast = lattice(g, CX, CZ, Y0, Y1, HALF0, HALF1, LEVELS, leg=1.5, brace=0.9, ramp="bone", shade=7)
    band = ((np.floor(Y) - Y0) // 13) % 2 == 0
    P.flat(g, mast & band, "red", 4)
    P.flat(g, mast & ~band, "bone", 7)
    # a grated platform with a railing
    h = half(PLAT) + 3
    deck = box(g, CX - h, PLAT, CZ - h, CX + h, PLAT + 1.5, CZ + h, "steel", 5)
    P.flat(g, deck & (((np.floor(X) + np.floor(Z)) % 3) == 0), "steel", 3)
    P.flat(g, edges(deck), "gold", 5)
    rail = np.zeros(g.shape, dtype=bool)
    for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        rail |= box(g, CX + sx * h - (1 if sx > 0 else 0), PLAT + 1, CZ + sz * h - (1 if sz > 0 else 0), CX + sx * h + (0 if sx > 0 else 1), PLAT + 7, CZ + sz * h + (0 if sz > 0 else 1), "gold", 5)
    for zz in (CZ - h, CZ + h - 1):
        rail |= box(g, CX - h, PLAT + 6, zz, CX + h, PLAT + 7, zz + 1, "gold", 5)
    for xx in (CX - h, CX + h - 1):
        rail |= box(g, xx, PLAT + 6, CZ - h, xx + 1, PLAT + 7, CZ + h, "gold", 5)
    # panel antennas round the top, a whip antenna
    for dx, dz in ((0, -1), (1, 0), (-1, 0)):
        px, pz = CX + dx * (HALF1 + 2), CZ + dz * (HALF1 + 2)
        pan = box(g, px - 2 + abs(dz) * 0.5 - abs(dx), Y1 - 12, pz - 2 + abs(dx) * 0.5 - abs(dz), px + 2 - abs(dz) * 0.5 + abs(dx), Y1 + 2, pz + 2 - abs(dx) * 0.5 + abs(dz), "bone", 6)
        P.outline(g, pan, "steel", 4)
    cap = box(g, CX - 4, Y1, CZ - 4, CX + 4, Y1 + 2, CZ + 4, "steel", 4)
    whip = limb(g, (CX, Y1 + 2, CZ), (CX, BEACON_Y, CZ), 1.0, 0.7, "steel", 5, n=4)
    del cap, whip
    # a junction box and a cable tray at the foot
    jb = box(g, CX - 18, Y0, CZ - 6, CX - 12, Y0 + 9, CZ + 1, "khaki", 5)
    P.outline(g, jb, "khaki", 3)
    G.icon(g, "-z", CZ - 6, int(CX - 18.5), Y0 + 1, "bolt", "gold", 6)
    return g


def dish() -> Grid:
    g = Grid(*SZ)
    dx, dy, dz = DISH
    arm = limb(g, (dx, dy, dz), (dx, dy, dz - 10), 1.2, None, "steel", 5, n=4)
    back = S.cone(g, "z", dx, dy, 3.0, dz - 13, dz - 10, "steel", 5, r_top=8.5, tip="lo")
    face = S.disc(g, "z", dx, dy, 9.0, dz - 14, dz - 13, "bone", 7, n=8)
    horn = limb(g, (dx, dy, dz - 14), (dx, dy, dz - 19), 0.8, None, "steel", 6, n=4)
    X, Y, Z = ctr(g)
    P.flat(g, face & (np.hypot(X - dx, Y - dy) < 1.5), "red", 4)
    P.flat(g, face & (S.ngon_radius(g, "z", dx, dy, 8) > 7.9), "red", 4)
    del arm, back, horn
    return g


def beacon() -> Grid:
    g = Grid(*SZ)
    S.disc(g, "y", CX, CZ, 1.6, BEACON_Y - 1, BEACON_Y, "steel", 4, n=8)
    S.dome(g, CX, CZ, BEACON_Y, 1.8, h=3.0, n=8, rings=2, ramp="red", base=6, ribs=None, painter=lambda gg, mm, fr: P.flat(gg, mm, "red", 6))
    return g


def build():
    rig = Rig("radio-tower", (CX, 0, CZ), tower())
    rig.add("dish", dish(), DISH)
    rig.add("beacon", beacon(), (CX, BEACON_Y - 1.0, CZ))
    idle = {"dish": {"rot": keys((0, (0, 0, 0)), (1.5, (0, 50, 0)), (3.0, (0, 0, 0)), (4.5, (0, -50, 0)), (6.0, (0, 0, 0)))},
            "beacon": {"scale": keys((0, (1, 1, 1)), (0.12, (1.5, 1.5, 1.5)), (0.25, (1, 1, 1)), (1.5, (1, 1, 1)), (1.62, (1.5, 1.5, 1.5)), (1.75, (1, 1, 1)), (3.0, (1, 1, 1)), (3.12, (1.5, 1.5, 1.5)), (3.25, (1, 1, 1)), (4.5, (1, 1, 1)), (4.62, (1.5, 1.5, 1.5)), (4.75, (1, 1, 1)), (6.0, (1, 1, 1)))}}
    return make("animated-props", "radio-tower", "Radio Tower", rig.root,
                clips=[Clip("idle", idle)],
                sockets=[rig.socket("socket-beacon", (CX, BEACON_Y + 2, CZ), parent="beacon")])
