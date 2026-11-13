"""Looted shopping cart, in the Pirate Nation style.

A chunky wire basket (thick rails and corner posts; its sides flare on
true diagonals) on a steel chassis with three castors: the fourth is
missing, so the whole cart slumps onto that corner (rule F5). A red
handle and red rim bumpers, and the loot heaped inside: a red gas can, canned food, a teddy
bear and a baseball bat sticking out. Wire mesh on the tray is paint
(rule S1).
"""
import numpy as np

import paint as P
from _props import asset, child, root
from pnkit import box, edges
from pnshapes import bar, coords, disc
from voxgrid import Grid

W = 16  # basket width (x)
Y0, Y1 = 7, 18  # basket bottom and rim
ZB0, ZB1 = 4, 20  # basket bottom front / back
ZT0, ZT1 = 1, 23  # rim front / back (flared)


def cart() -> Grid:
    g = Grid(W + 4, 26, 26)
    X, Y, Z = coords(g)
    # chassis rails and castors (the front-right one is missing)
    for x in (1, W - 2):
        box(g, x, 2.5, 3, x + 3, 4, 22, "red", 4)
    for (cx, cz) in ((2.5, 5), (W - 0.5, 20), (2.5, 20)):
        disc(g, "x", 1.5, cz, 1.5, cx - 1, cx + 1, "steel", 3)
        box(g, cx - 0.5, 2.5, cz - 0.5, cx + 0.5, 4, cz + 0.5, "steel", 5)
    # lower tray for big items
    tray = box(g, 2, 4, 6, W, 5, 19, "steel", 5)
    P.flat(g, tray & ((np.floor(X) % 3 == 0) | (np.floor(Z) % 3 == 0)), "steel", 6)
    # the basket floor: a steel plate with painted mesh
    fl = box(g, 1, Y0, ZB0, W + 1, Y0 + 1, ZB1, "steel", 4)
    P.flat(g, fl & ((np.floor(X) % 3 == 0) | (np.floor(Z) % 3 == 0)), "steel", 6)
    # struts from the chassis to the basket
    for x in (1.5, W - 0.5):
        bar(g, "x", (4, 20), (Y0, 17), 1.4, x - 0.7, x + 0.7, "steel", 5)
        bar(g, "x", (4, 5), (Y0, 6), 1.4, x - 0.7, x + 0.7, "steel", 5)
    # flared sides: slanted posts at the corners and between, in the (y, z) plane
    for x in (1, W):
        for zb, zt in ((ZB0, ZT0), (ZB0 + 5.3, ZT0 + 7.3), (ZB0 + 10.6, ZT0 + 14.6), (ZB1, ZT1)):
            bar(g, "x", (Y0, zb), (Y1, zt), 1.2, x, x + 1, "steel", 6)
    # front and back walls: slanted bars in the (y, z) plane across x
    for z0, z1 in ((ZB0, ZT0), (ZB1, ZT1)):
        for x in (5, 9, 13):
            bar(g, "x", (Y0, z0), (Y1, z1), 1.2, x, x + 1, "steel", 6)
    # rails: two levels round the basket (boxes, each level at its flare)
    for y, f in ((Y1 - 1, 1.0), (Y0 + 5, 0.5)):
        za = ZB0 + (ZT0 - ZB0) * f
        zb = ZB1 + (ZT1 - ZB1) * f
        ramp, sh = ("red", 5) if f == 1.0 else ("steel", 6)  # the rim wears red plastic bumpers
        box(g, 1, y, za - 0.5, W + 1, y + 1, za + 0.5, ramp, sh)
        box(g, 1, y, zb - 0.5, W + 1, y + 1, zb + 0.5, ramp, sh)
        box(g, 1, y, za, 2, y + 1, zb, ramp, sh)
        box(g, W, y, za, W + 1, y + 1, zb, ramp, sh)
    # the red handle across the back, and its uprights
    for x in (1, W):
        bar(g, "x", (Y1 - 1, ZT1), (Y1 + 3, ZT1 + 2), 1.2, x, x + 1, "steel", 5)
    h = box(g, 0, Y1 + 2, ZT1 + 1, W + 2, Y1 + 4, ZT1 + 3, "red", 5)
    P.flat(g, h & (Y > Y1 + 3), "red", 6)
    # the loot
    can = box(g, 3, Y0 + 1, 8, 9, Y0 + 11, 12, "red", 5)
    P.flat(g, edges(can), "red", 3)
    box(g, 4, Y0 + 11, 9, 8, Y0 + 12, 11, "red", 4)
    box(g, 7, Y0 + 11, 10, 8, Y0 + 13, 11, "gold", 6)
    for k, (cx, cz) in enumerate(((12, 7), (14, 9), (12.5, 10))):
        c = disc(g, "y", cx, cz, 1.4, Y0 + 1, Y0 + 5, ("gold", "teal", "red")[k], 5, n=6)
        P.flat(g, c & (Y > Y0 + 4), "steel", 6)
    # the teddy bear: a chunky body and head with ears, sitting at the back
    bear = box(g, 7, Y0 + 1, 15, 13, Y0 + 8, 20, "rust", 5)
    head = box(g, 7.5, Y0 + 8, 15.5, 12.5, Y0 + 13, 19.5, "rust", 5)
    for ex in (7.5, 11.5):
        box(g, ex, Y0 + 13, 17, ex + 1, Y0 + 14.5, 18, "rust", 4)
    P.flat(g, head & (Z < 16) & (np.abs(X - 10) < 1.1) & (Y > Y0 + 9) & (Y < Y0 + 11), "sand", 6)  # muzzle
    for ex in (8.5, 11.5):
        P.flat(g, head & (Z < 16) & (np.abs(X - ex) < 0.6) & (np.abs(Y - Y0 - 11.5) < 0.6), "darkwood", 3)
    P.flat(g, bear & (Z < 16) & (np.abs(X - 10) < 1.5) & (Y > Y0 + 3) & (Y < Y0 + 6), "sand", 6)  # tummy
    # the baseball bat leaning out over the side
    bat = bar(g, "z", (13.5, Y0 + 2), (17.2, Y0 + 17), 2.0, 12, 14, "wood", 6)
    P.flat(g, bat & (Y < Y0 + 6), "wood", 4)
    return g


def build():
    # on the ground: the castor that broke off, and a can that rolled away
    g = Grid(30, 4, 34)
    X, Y, Z = coords(g)
    lost = disc(g, "x", 1.5, 3.0, 1.5, 22, 24, "steel", 3)
    box(g, 21, 0, 5, 22, 3, 6, "steel", 5)
    can = disc(g, "x", 1.4, 28, 1.4, 4, 8, "gold", 5, n=6)
    P.flat(g, can & (X < 5), "steel", 6)
    r = root("shopping-cart", g)
    # the cart slumps onto the corner whose castor is missing (front right)
    child(r, "cart", cart(), pivot=(W / 2 + 1, 0.0, 13.0), at_grid=(12.0, 0.5, 15.0), rot=(-3.0, 0.0, -4.0))
    return asset("shopping-cart", "Looted Shopping Cart", r)
