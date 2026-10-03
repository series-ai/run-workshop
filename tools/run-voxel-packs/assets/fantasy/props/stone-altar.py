"""Temple altar in the Pirate Nation style.

A block of warm stone on two broad steps, with an overhanging top slab.
Carved royal-blue panels flank a red runner with a gold trim and a gold
fleur that drapes over the top and down the front (rule C3: the accent
says sacred). Two tall gold candlesticks, a jewelled chalice and an open
book stand on it. Detail is paint (rule S1). About 30 wide and 26 tall.
"""

import numpy as np

import paint as P
from _props import candle, coords, gem, glyph, stone_box
from pnkit import box
from pnshapes import disc, flat_ngon
from voxgrid import C, Asset, Grid, Part

W, H, D = 32, 30, 24
CX = 16
Z0 = 6  # altar front


def candlestick(g: Grid, x, y, z) -> None:
    disc(g, "y", x, z, 2.0, y, y + 1, "gold", 4, n=6)
    box(g, x - 0.5, y + 1, z - 0.5, x + 0.5, y + 6, z + 0.5, "gold", 5)
    box(g, x - 1.5, y + 6, z - 1.5, x + 1.5, y + 7, z + 1.5, "gold", 6)
    candle(g, x, y + 7, z, h=4, w=2)


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    stone_box(g, 1, 0, Z0 - 5, 31, 2, Z0 + 16, "sand", 3, block=(6, 3), seed=1)
    stone_box(g, 3, 2, Z0 - 2, 29, 4, Z0 + 14, "sand", 4, block=(5, 2), seed=2)
    stone_box(g, 5, 4, Z0, 27, 13, Z0 + 11, "sand", 4, block=(5, 3), seed=3)
    stone_box(g, 4, 13, Z0 - 1, 28, 16, Z0 + 12, "sand", 6, block=(8, 3), seed=4)
    # carved side panels on the front, painted a shade darker with a gold rim
    for px in (7, 22):
        pan = (g.a > 0) & (X > px) & (X < px + 4) & (Y > 5) & (Y < 12) & (Z < Z0 + 0.6)
        P.flat(g, pan, "blue", 4)
        P.outline(g, pan, "gold", 5, normal="z")
    # the red runner over the top and down the front
    run = box(g, 10, 16, Z0 - 1, 22, 17, Z0 + 12, "red", 4)
    run |= box(g, 10, 5, Z0 - 2, 22, 17, Z0 - 1, "red", 4)
    run |= box(g, 10, 5, Z0 + 12, 22, 17, Z0 + 13, "red", 4)
    P.outline(g, run & (Z < Z0 - 1), "gold", 6, normal="z")
    P.flat(g, run & (Y < 7), "gold", 6)
    glyph(g, "-z", Z0 - 2, CX - 3, 9, "fleur", "gold", 6)
    # candlesticks, a chalice and an open book
    candlestick(g, 7, 16, Z0 + 5)
    candlestick(g, 25, 16, Z0 + 5)
    disc(g, "y", CX, Z0 + 7, 1.6, 17, 18, "gold", 4, n=6)
    box(g, CX - 0.5, 18, Z0 + 6.5, CX + 0.5, 20, Z0 + 7.5, "gold", 5)
    g.prism("y", flat_ngon(CX, Z0 + 7, 1.2, 6), 20, 23, C("gold", 6), top=flat_ngon(CX, Z0 + 7, 2.2, 6))
    gem(g, CX, 20, Z0 + 4.5, r=1.5, h=2.5, ramp="red", shade=5)
    pages = box(g, CX - 5, 17, Z0 + 1, CX + 5, 18, Z0 + 5, "bone", 6)
    P.flat(g, pages & (np.abs(X - CX) < 0.6), "red", 3)
    P.flat(g, pages & (np.abs(X - CX) > 1) & (np.floor(Z) % 2 == 0) & (np.abs(X - CX) < 4.5), "bone", 4)
    root = Part("stone-altar", g)
    return Asset(id="fantasy-props-stone-altar", pack="fantasy", category="props", name="Temple Altar", root=root)
