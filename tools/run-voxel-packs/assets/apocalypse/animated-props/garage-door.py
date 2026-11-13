"""Garage roller door, in the Pirate Nation style.

A chunky wall section a pickup drives through: two brick piers, a thick
steel lintel with a GARAGE sign and hazard stripes, and a faceted drum
housing on top (true slopes). The corrugated shutter, with vision slots,
a skull tag, a handle and a padlock, rolls up into the drum on `open` and
drops on `close`. A caged orange lamp on the pier blinks on `idle`. The
opening is 52 wide and 46 tall. Bricks, ribs, stains and graffiti are paint.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, keys, make
from pnkit import box, edges
from voxgrid import Clip, Grid

SZ = (70, 64, 24)
OX0, OX1, OY1 = 9, 61, 48  # the opening
WZ0, WZ1 = 6, 18  # wall depth
SLAB = 2
LAMP = (5.0, 44.0, WZ0 - 2.5)


def wall() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    slab = box(g, 0, 0, 0, 70, SLAB, 24, "sand", 5)
    PP.concrete(g, slab, "sand", 5, size=12, cracks=4, frame="top", seed=1)
    P.flat(g, slab & (Y > 1) & (np.hypot(X - 40, (Z - 8) * 1.6) < 5), "sand", 3)  # an oil stain
    for tx in (22, 46):  # tyre marks
        P.flat(g, slab & (Y > 1) & (np.abs(X - tx) < 2) & (Z < 4), "sand", 4)
    piers = box(g, 0, SLAB, WZ0, OX0 - 1, 56, WZ1, "red", 4) | box(g, OX1 + 1, SLAB, WZ0, 70, 56, WZ1, "red", 4)
    P.stone(g, piers, "red", 4, block=(6, 3), cracks=0.1, seed=2)
    P.flat(g, edges(piers), "red", 3)
    PP.blotch(g, piers, "sand", 5, cell=2, chance=0.04, seed=3)  # chipped bricks
    # steel guide channels with bolts
    for x0 in (OX0 - 1, OX1 - 1):
        ch = box(g, x0, SLAB, WZ0 - 2, x0 + 2, OY1, WZ0 + 2, "steel", 5)
        P.flat(g, ch & (np.floor(Y) % 8 == 4), "steel", 7)
    # the lintel: a thick steel beam with a GARAGE sign and hazard stripes
    lint = box(g, 0, OY1, WZ0 - 2, 70, 56, WZ1, "steel", 5)
    P.plates(g, lint, "steel", 5, size=(14, 8), seed=4)
    sign = box(g, 15, OY1, WZ0 - 3, 55, 56, WZ0 - 2, "gold", 6)
    P.flat(g, sign & ((X < 16) | (X > 54)), "gold", 4)
    tw, th = G.text_size("GARAGE")
    G.text(g, "-z", WZ0 - 3, 35 - tw // 2, OY1 + 1, "GARAGE", "darkwood", 4)
    PP.hazard(g, lint & (Z < WZ0 - 1) & ((X < 16) | (X > 54)), period=6, a=("gold", 5), b=("darkwood", 4))
    # the drum housing (a faceted octagon along x) on top of the lintel
    drum = S.disc(g, "x", 58.5, (WZ0 + WZ1) / 2, 5.0, 2, 68, "teal", 4, n=8)
    P.plates(g, drum, "teal", 4, size=(16, 6), seed=5)
    for x0 in (2, 66):
        cap = S.disc(g, "x", 58.5, (WZ0 + WZ1) / 2, 5.4, x0, x0 + 2, "steel", 3, n=8)
        del cap
    # a control box on the right pier and the lamp bracket on the left
    cb = box(g, OX1 + 2, 18, WZ0 - 3, OX1 + 7, 28, WZ0, "khaki", 5)
    P.outline(g, cb, "khaki", 3, normal="z")
    for by, col in ((25, ("red", 5)), (21, ("toxic", 6))):
        P.flat(g, cb & (Z < WZ0 - 2) & (np.abs(Y - by) < 1.1) & (np.abs(X - (OX1 + 4.5)) < 1.1), *col)
    box(g, 3, 40, WZ0 - 3, 7, 42, WZ0, "steel", 4)
    return g


def shutter() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    s = box(g, OX0, SLAB, WZ0, OX1, OY1, WZ0 + 2, "teal", 5)
    P._paint(g, s, "teal", np.where(np.floor(Y) % 3 == 0, 3, np.where(np.floor(Y) % 3 == 1, 5, 4)))
    bar = box(g, OX0, SLAB, WZ0 - 1, OX1, SLAB + 3, WZ0 + 2, "steel", 4)
    P.outline(g, bar, "steel", 3, normal="z")
    slots = s & (Y > 33) & (Y < 36) & (((X - OX0) % 10) >= 3) & (((X - OX0) % 10) < 8)
    P.flat(g, slots, "teal", 3)
    # a red skull tag and a dripping stripe, sprayed on
    G.icon(g, "-z", WZ0 - 1, 40, 14, "skull", "bone", 7, scale=2)
    G.text(g, "-z", WZ0 - 1, 14, 26, "KEEP", "gold", 6)
    G.text(g, "-z", WZ0 - 1, 16, 17, "OUT", "gold", 6)
    P.flat(g, s & (Z < WZ0 + 1) & (Y > 13) & (Y < 15) & (X > 13) & (X < 36), "gold", 6)
    handle = box(g, 33, SLAB + 3, WZ0 - 3, 37, SLAB + 5, WZ0 - 1, "steel", 7)
    lock = box(g, 43, SLAB + 1, WZ0 - 3, 46, SLAB + 5, WZ0 - 1, "gold", 5)
    del handle, lock
    PP.blotch(g, s & (Y < 12), "rust", 5, cell=2, chance=0.08, seed=6)
    return g


def lamp() -> Grid:
    g = Grid(*SZ)
    lx, ly, lz = LAMP
    dome = S.dome(g, lx, lz, ly, 2.6, h=4.0, n=8, rings=2, ramp="orange", base=6, ribs=("steel", 4), painter=lambda gg, mm, fr: P.flat(gg, mm, "orange", 6))
    base = S.disc(g, "y", lx, lz, 3.0, ly - 1, ly, "steel", 4, n=8)
    del dome, base
    return g


def build():
    rig = Rig("garage-door", (35, 0, 12), wall())
    rig.add("shutter", shutter(), ((OX0 + OX1) / 2, OY1, WZ0 + 1))
    rig.add("lamp", lamp(), LAMP)
    up = keys((0, (1, 1, 1)), (1.2, (1, 0.06, 1)), (1.3, (1, 0.07, 1)))
    down = keys((0, (1, 0.07, 1)), (1.0, (1, 1, 1)), (1.08, (1, 0.97, 1)), (1.15, (1, 1, 1)))
    blink = keys((0, (1, 1, 1)), (0.15, (1.35, 1.35, 1.35)), (0.3, (1, 1, 1)), (0.45, (1.35, 1.35, 1.35)), (0.6, (1, 1, 1)))
    idle = keys((0, (1, 1, 1)), (0.75, (1.2, 1.2, 1.2)), (1.5, (1, 1, 1)))
    return make("animated-props", "garage-door", "Garage Roller Door", rig.root,
                clips=[Clip("open", {"shutter": {"scale": up}, "lamp": {"scale": blink}}, loop=False),
                       Clip("close", {"shutter": {"scale": down}, "lamp": {"scale": blink}}, loop=False),
                       Clip("idle", {"lamp": {"scale": idle}})],
                sockets=[rig.socket("socket-lamp", (LAMP[0], LAMP[1] + 2, LAMP[2]), parent="lamp")])
