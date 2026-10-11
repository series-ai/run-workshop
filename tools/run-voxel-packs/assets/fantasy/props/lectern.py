"""Spell lectern in the Pirate Nation style.

A carved darkwood stand: a cross foot, a thick octagonal post with gold
bands and a slanted desk (a true slope) holding an oversized open grimoire
whose pages glow with cyan runes (rule C3). A candle and a quill pot sit on
a side ledge. Detail is paint (rule S1). About 20 wide and 28 tall.
"""

import math

import numpy as np

import paint as P
from _props import candle, coords, plank_box
from pnkit import box
from pnshapes import disc, facets, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 24, 32, 20
CX, CZ = 11, 10
DY = 20  # desk low edge (front)
TILT = 30.0  # desk slope (degrees)


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    for x0, z0, x1, z1 in ((CX - 7, CZ - 2, CX + 7, CZ + 2), (CX - 2, CZ - 7, CX + 2, CZ + 7)):
        f = box(g, x0, 0, z0, x1, 2, z1, "darkwood", 4)
        P.planks(g, f, "darkwood", 4, width=2, across="y", seed=1)
    post = disc(g, "y", CX, CZ, 2.0, 2, DY, "darkwood", 5, n=8)
    P.planks(g, post, "darkwood", 5, width=2, across="x", nails=False, seed=2)
    for by in (4, 16):
        disc(g, "y", CX, CZ, 2.8, by, by + 2, "gold", 5, n=8)
    # the slanted desk: front edge low, back edge high (a wedge prism along x)
    depth = 12
    rise = depth * math.tan(math.radians(TILT))
    z0, z1 = CZ - depth / 2, CZ + depth / 2
    g.prism("x", [(DY, z0), (DY + 2, z0), (DY + 2 + rise, z1), (DY + rise, z1), (DY - 2, z1), (DY - 2, CZ)], CX - 8, CX + 8, C("darkwood", 4))
    desk = last(g)
    P.planks(g, desk, "darkwood", 4, width=3, across="z", nails=False, seed=3)
    box(g, CX - 8, DY, z0 - 1, CX + 8, DY + 4, z0, "darkwood", 3)
    # the open book lying on the slope: two page blocks and a red cover edge
    g.prism("x", [(DY + 2, z0 + 1), (DY + 2 + (depth - 2) * math.tan(math.radians(TILT)), z1 - 1), (DY + 4 + (depth - 2) * math.tan(math.radians(TILT)), z1 - 1), (DY + 4, z0 + 1)], CX - 7, CX + 7, C("bone", 6))
    pages = last(g)
    top_faces = [(m, fr) for m, fr in facets(g) if isinstance(fr, tuple) and fr[1][1] < -0.1 and fr[1][2] < 0]
    P.flat(g, pages, "bone", 6)
    P.flat(g, pages & (np.abs(X - CX) < 0.6), "red", 4)  # the spine gutter
    P.flat(g, pages & ((X < CX - 6) | (X > CX + 6)), "red", 4)  # cover edges
    for m, fr in top_faces:
        P.flat(g, m & (np.abs(X - CX) >= 1) & (np.abs(X - CX) < 6) & ((np.floor(X) + np.floor(Y * 1.3)) % 4 == 0), "cyan", 5)
        P.flat(g, m & (np.abs(X - CX) >= 1) & (np.abs(X - CX) < 6) & ((np.floor(Y * 1.3) % 3) == 0), "bone", 5)
    # a side ledge with a candle and a quill pot
    plank_box(g, CX + 8, 11, CZ - 3, CX + 12, 13, CZ + 3, "wood", 5, across="y", width=2, seed=4)
    box(g, CX + 2, 11, CZ - 1, CX + 8, 13, CZ + 1, "darkwood", 4)
    candle(g, CX + 10, 13, CZ - 1, h=4, w=2)
    box(g, CX + 9, 13, CZ + 1, CX + 11, 15, CZ + 3, "blue", 3)
    box(g, CX + 10, 15, CZ + 2, CX + 11, 19, CZ + 3, "bone", 7)
    root = Part("lectern", g)
    return Asset(id="fantasy-props-lectern", pack="fantasy", category="props", name="Spell Lectern", root=root)
