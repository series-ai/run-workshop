"""Plasma fuel cell, in the Pirate Nation mecha style.

One iconic shape (rule K3): a tall octagonal plasma canister that glows
bright blue through a big window with level ticks, held in a light steel
cage with white hull collars, on a tapered hazard-striped foot ring (F2).
A clean copper cap carries a cyan emitter. Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
from _props import cham_prism, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

S = 16
C0 = S / 2


def body() -> Grid:
    g = Grid(S, 26, S)
    X, Y, Z = coords(g)
    # the foot: a chamfered frustum with hazard stripes on its slopes
    foot = cham_prism(g, "y", 0, 0, S, S, 4, 0, 6, "orange", 5, inset=1.5)
    for m, fr in facets(g, g.solids[-1:]):
        U, V = P.uv(g, fr)
        u0, v0 = int(U[m].min()), int(V[m].min())
        stripe = ((U - u0 + V - v0) // 4) % 2 == 0
        P.flat(g, m & stripe, "orange", 5)
        P.flat(g, m & ~stripe, "iron", 5)
    P.flat(g, foot & (Y > 5), "steel", 4)
    # the glowing canister
    can = ngon_prism(g, "y", C0, C0, 5, 6, 21, "plasma", 3)
    P.flat(g, can, "plasma", 3)
    P.flat(g, can & (Y > 9) & (Y < 18), "plasma", 5)
    P.flat(g, can & (Y > 15) & (Y < 18), "plasma", 7)  # the charge level
    P.flat(g, can & ((Y > 7) & (Y < 9) | (Y > 19) & (Y < 21)), "cyan", 5)
    P.flat(g, can & (Y > 18) & (Y < 21), "cyan", 6)
    P.flat(g, can & (np.abs(X - C0) < 1.6) & (Y > 7) & (Y < 20) & (np.floor(Y) % 3 == 0), "steel", 6)  # ticks
    # four slim corner rails leave the bright core visible
    for x0 in (2.0, S - 4.0):
        for z0 in (2.0, S - 4.0):
            post = box(g, x0, 6, z0, x0 + 2, 22, z0 + 2, "steel", 5)
            P.flat(g, post, "steel", 6)
            P.flat(g, edges(post), "steel", 4)
    for y0 in (6, 20):
        collar = cham_prism(g, "y", 1, 1, S - 1, S - 1, 3.5, y0, y0 + 2, "steel", 5)
        P.flat(g, collar, "steel", 6)
        P.flat(g, edges(collar), "steel", 3)
        # broad white front plates make the collars read as hull parts
        P.flat(g, collar & (Z < 2.5) & (X > 4) & (X < 12), "bone", 6)
    # the cap: clean copper panels with one dark seam ring
    cap = cham_prism(g, "y", 3, 3, S - 3, S - 3, 2.5, 22, 25, "rust", 4, inset=2)
    angle = np.arctan2(Z - C0, X - C0)
    panel = (np.floor((angle + np.pi) * 4 / np.pi).astype(int) % 2) == 0
    P.flat(g, cap, "rust", 4)
    P.flat(g, cap & panel, "rust", 5)
    P.flat(g, cap & (np.abs(Y - 23.5) < 0.6), "rust", 2)
    P.flat(g, cap & (Y > 24), "rust", 6)
    return g


def valve() -> Grid:
    g = Grid(8, 7, 8)
    ngon_prism(g, "y", 4, 4, 3.2, 0, 1, "steel", 5)
    ngon_prism(g, "y", 4, 4, 2.8, 1, 2, "orange", 5)
    ngon_prism(g, "y", 4, 4, 1.5, 2, 4, "steel", 5, r_top=1.1)
    bulb = ngon_prism(g, "y", 4, 4, 1.5, 4, 5, "cyan", 5, r_top=2.2)
    bulb |= ngon_prism(g, "y", 4, 4, 2.2, 5, 6, "cyan", 6)
    bulb |= ngon_prism(g, "y", 4, 4, 2.2, 6, 7, "cyan", 6, r_top=1.4)
    X, Y, Z = coords(g)
    P.flat(g, bulb & (Y > 5) & (Y < 6) & (np.abs(X - 4) < 1.2), "cyan", 7)
    return g


def build() -> Asset:
    root = Part("fuel-cell", body())
    root.add(Part("valve", valve(), pivot=(4.0, 0.0, 4.0), at=(C0, 25.0, C0), rot=(6.0, 20.0, -5.0)))
    return Asset(id="space-props-fuel-cell", pack="space", category="props", name="Plasma Fuel Cell", root=root)
