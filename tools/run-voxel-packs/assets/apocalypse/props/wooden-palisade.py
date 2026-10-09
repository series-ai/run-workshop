"""Wooden palisade, in the Pirate Nation style.

A fence piece with a clear silhouette (rules F2, F6): sharpened stakes of
staggered height and a slight lean, with painted grain, splits and worn
tips. Behind them two dark rails stop on the end stakes and finish in
visible wire lashings, braced on a true diagonal and bolted with rusted
steel plates. A hazard-striped warning board hangs crooked on the face with
a painted skull, a signal-red rag is tied to one stake and zombie-teal moss
climbs the feet (rules C3, F5). Every mark is paint (rule S1).
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, child, chips, root, rust_wear, weeds
from pnkit import box, edges
from pnshapes import bar, coords
from voxgrid import C, Grid

GW, GH, GD = 32, 28, 16
Z0 = 6  # the stake plane
HEIGHTS = (20, 23, 21, 25, 22, 24, 20, 23)


def sign() -> Grid:
    """The hazard warning board."""
    g = Grid(14, 11, 2)
    m = box(g, 0, 0, 0, 14, 11, 2, "gold", 6)
    pnpaint.hazard(g, P.region(g, 0, 0, 0, 14, 3, 2), period=4, a=("gold", 7), b=("darkwood", 3), frame="z")
    pnglyph.icon(g, "-z", 0, 2, 3, "skull", "darkwood", 1)
    P.flat(g, edges(m), "darkwood", 2)
    return g


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    weeds(g, 27, Z0 + 3, seed=1)
    weeds(g, 3, Z0 - 3, seed=2)
    stakes = np.zeros(g.shape, dtype=bool)
    for k, h in enumerate(HEIGHTS):
        sx = k * 4
        lean = math.sin(k * 1.7) * 1.2
        lean = max(lean, 0.0) if k == 0 else (min(lean, 0.0) if k == len(HEIGHTS) - 1 else lean)
        g.prism("z", [(sx, 0.0), (sx + 4, 0.0), (sx + 4 + lean, float(h - 4)), (sx + lean, float(h - 4))], Z0, Z0 + 4, C("wood", 6))
        stakes |= g.solids[-1].mask(g.shape)
        g.prism("z", [(sx + lean, float(h - 4)), (sx + 4 + lean, float(h - 4)), (sx + 2 + lean, float(h))], Z0, Z0 + 4, C("wood", 6))
        tip = g.solids[-1].mask(g.shape)
        stakes |= tip
        P.flat(g, tip, "wood", 7)
    P.planks(g, stakes, "wood", 6, width=4, across="x", length=(16, 26), nails=False, seed=3)
    P.flat(g, edges(stakes), "darkwood", 4)
    for k in range(0, GW, 7):  # painted splits down the shafts
        P.flat(g, stakes & (np.abs(X - k - 2) < 0.6) & (Y > 4) & (Y < 16), "wood", 4)
    P.flat(g, stakes & (Y < 5) & ((np.floor(X + Y) % 5) == 0), "teal", 4)  # moss at the feet
    P.grime(g, stakes, height=3, seed=4)
    chips(g, stakes, ((5, 12, Z0, 3.0), (21, 7, Z0, 2.6), (28, 15, Z0 + 4, 2.4)), "wood", 4, seed=5)
    # two rails behind, stopping on the end stakes, with lashings and bolts
    rails = np.zeros(g.shape, dtype=bool)
    for ry in (6, 15):
        rails |= box(g, 0, ry, Z0 + 4, GW, ry + 3, Z0 + 7, "darkwood", 5)
    rails |= bar(g, "z", (3.0, 4.0), (28.0, 18.0), 1.7, Z0 + 7, Z0 + 9, "darkwood", 5)
    P.planks(g, rails, "darkwood", 5, width=3, across="y", nails=False, seed=6)
    P.flat(g, edges(rails), "darkwood", 3)
    bolts = np.zeros(g.shape, dtype=bool)
    for k in range(len(HEIGHTS)):
        bx = 3 + k * 4
        for ry in (6, 15):
            bolts |= box(g, bx, ry, Z0 + 3, bx + 2, ry + 3, Z0 + 5, "steel", 6)
    for lx in (0, GW - 4):  # the wire lashings at both ends
        for ry in (5, 14):
            bolts |= box(g, lx, ry, Z0 + 3, lx + 3, ry + 5, Z0 + 8, "steel", 4)
    P.flat(g, bolts, "steel", 5)
    P.flat(g, bolts & ((np.floor(X + Y) % 3) == 0), "steel", 4)
    rust_wear(g, bolts, seed=7, shade=5, run=5, grime=0)
    # a signal-red rag tied high on one stake
    rag = bar(g, "z", (13.0, 19.0), (10.0, 13.0), 1.6, Z0 - 2, Z0 + 1, "red", 5)
    P.flat(g, rag & (np.floor(Y) % 3 == 0), "red", 3)
    P.outline(g, rag, "red", 3, normal="z")
    r = root("wooden-palisade", g)
    child(r, "sign", sign(), pivot=(7.0, 11.0, 2.0), at_grid=(21.0, 19.0, float(Z0)), rot=(0.0, 0.0, -8.0))
    return asset("wooden-palisade", "Wooden Palisade", r)
