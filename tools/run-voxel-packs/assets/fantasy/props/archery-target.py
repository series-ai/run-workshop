"""Archery target in the Pirate Nation style.

One iconic shape (rule K3): a big round straw butt (an octagon, true
facets) painted with cream, blue, red and gold rings, leaning back on a
wooden A-frame easel (true diagonal legs). Three chunky arrows stick out
of it, one in the gold. Detail is paint (rule S1). About 24 wide, 30 tall.
"""

import numpy as np

import paint as P
from _props import brace, coords, tufts
from pnkit import box
from pnshapes import bar, flat_ngon, last, radial
from voxgrid import C, Asset, Grid, Part

W, H, D = 26, 31, 26
CX, CY = 13, 17  # target centre
R = 10.5
TZ = 9  # front of the target


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # easel legs: two front legs splayed, one back leg (true slopes)
    for sx in (-1, 1):
        brace(g, "z", (CX + sx * 9.5, 1.6), (CX + sx * 5, CY + 6), 3, TZ + 3, TZ + 5, "wood", 5)
    brace(g, "x", (1.6, TZ + 12), (CY + 6, TZ + 5.5), 3, CX - 1.5, CX + 1.5, "wood", 4)
    rail = box(g, CX - 9, 7, TZ + 3, CX + 9, 9, TZ + 5, "darkwood", 4)
    P.planks(g, rail, "darkwood", 4, width=2, across="y", nails=True)
    # the straw butt: an octagon 4 deep, rim painted as straw, face as rings
    g.prism("z", flat_ngon(CX, CY, R, 8), TZ, TZ + 3, C("gold", 5))
    butt = last(g)
    P.thatch(g, butt, "gold", 5, band=3, frame="wall", seed=2)
    face = butt & (Z < TZ + 1)
    rr = radial(g, "z", CX, CY)
    for r, ramp, shade in ((R - 1.2, "bone", 6), (R - 3.2, "blue", 4), (R - 5.2, "red", 4), (R - 7.4, "gold", 6)):
        P.flat(g, face & (rr < r), ramp, shade)
    P.flat(g, face & (rr < 1.2), "gold", 7)
    for r in (R - 1.2, R - 3.2, R - 5.2, R - 7.4):
        P.flat(g, face & (np.abs(rr - r) < 0.45), "darkwood", 4)
    # arrows: dark shafts with bright red and cream fletchings
    for ax, ay, dz in ((CX + 0.5, CY + 0.5, 8), (CX - 5.5, CY + 4.5, 7), (CX + 4.5, CY - 5.5, 8)):
        bar(g, "x", (ay, TZ), (ay + 1.5, TZ - dz), 1.4, ax - 0.7, ax + 0.7, "wood", 6)
        fz = TZ - dz
        fl = box(g, int(ax) - 1, int(ay + 1.5) - 1, int(fz), int(ax) + 2, int(ay + 1.5) + 2, int(fz) + 3, "red", 5)
        P.flat(g, fl & ((X - ax) * (Y - ay - 1.5) > 0), "bone", 6)
    tufts(g, [(CX - 11, TZ + 1), (CX + 9, TZ + 10)])
    root = Part("archery-target", g)
    return Asset(id="fantasy-props-archery-target", pack="fantasy", category="props", name="Archery Target", root=root)
