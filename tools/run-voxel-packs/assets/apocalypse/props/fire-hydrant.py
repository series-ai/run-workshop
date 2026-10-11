"""Cracked fire hydrant, in the Pirate Nation style.

One chunky caricature icon (rules F4, K3): a fat octagonal hazard-yellow
barrel on a wide flange, a red faceted bonnet (a true frustum) with a
pentagon nut, two red side caps and a big front pumper nozzle whose cap
hangs off on its chain. The crack at the base, the bolts and the leak are
paint; a flat teal puddle spreads round the foot (rule S1). The hanging
cap and the leaning puddle make it asymmetric (rule F5).
"""
import math

import numpy as np

import paint as P
from _props import asset, root
from pnshapes import coords, cone, disc, ngon_radius
from voxgrid import C, Grid

CX, CZ = 11, 13
R = 5.0  # barrel flat radius
Y0, Y1 = 3, 15  # barrel bottom and top


def build():
    g = Grid(22, 22, 25)
    X, Y, Z = coords(g)
    # the puddle: one flat irregular slab, 1 voxel thick
    pts = [(CX + r * math.cos(a), CZ + r * math.sin(a) * 0.85 - 1) for a, r in zip(np.linspace(0, 2 * math.pi, 11)[:-1], (10.5, 9, 10.8, 8.5, 9.5, 10.9, 9.2, 10.4, 8.8, 10))]
    g.prism("y", pts, 0, 1, C("teal", 5))
    pud = g.solids[-1].mask(g.shape)
    P.flat(g, pud & (np.hypot(X - CX + 3, Z - CZ + 4) < 2.2), "teal", 7)  # glints
    P.flat(g, pud & (np.abs(np.hypot(X - CX, Z - CZ) - 8) < 0.5), "teal", 6)  # ripple
    # flange with painted bolts
    fl = disc(g, "y", CX, CZ, 6.5, 1, Y0, "gold", 3)
    ang = np.arctan2(Z - CZ, X - CX)
    P.flat(g, fl & (Y > Y0 - 1) & (ngon_radius(g, "y", CX, CZ) > 5.2) & (np.cos(ang * 4) > 0.8), "steel", 6)
    # the barrel: yellow, lit on the front-left, a dark crack from the flange
    body = disc(g, "y", CX, CZ, R, Y0, Y1, "gold", 5)
    P.mottle(g, body, "gold", 5, cell=3, seed=2)
    P.flat(g, body & (ang > 1.9) & (ang < 2.9), "gold", 6)
    crack = body & (np.abs((X - CX - 1.5) + 0.6 * (Y - Y0)) < 0.6) & (Y < Y0 + 6) & (Z < CZ - 3)
    P.flat(g, crack, "gold", 1)
    P.flat(g, body & (Y < Y0 + 1), "gold", 3)
    band = disc(g, "y", CX, CZ, R + 0.8, Y1 - 1, Y1 + 1, "red", 4)
    P.flat(g, band & (Y > Y1), "red", 5)
    # bonnet (a frustum) and the pentagon operating nut
    bon = cone(g, "y", CX, CZ, R, Y1 + 1, Y1 + 5, "red", 4, r_top=2.4)
    P.mottle(g, bon, "red", 4, cell=2, seed=3)
    nut = disc(g, "y", CX, CZ, 1.6, Y1 + 5, Y1 + 7, "red", 3, n=5)
    P.flat(g, nut & (Y > Y1 + 6), "red", 5)
    # side caps (x) and the front pumper nozzle (-z), all red with a dark rim
    ny = 10
    for lo, hi in ((CX - R - 3, CX - R + 1), (CX + R - 1, CX + R + 3)):
        cap = disc(g, "x", ny, CZ, 2.2, lo, hi, "red", 4)
        P.flat(g, cap & ((X < lo + 1) | (X > hi - 1)), "red", 5)
    noz = disc(g, "z", CX, ny - 1, 3.5, CZ - R - 2, CZ - R + 1, "gold", 4)
    mouth = noz & (Z < CZ - R - 1) & (ngon_radius(g, "z", CX, ny - 1) < 2.3)
    P.flat(g, mouth, "rust", 3)
    P.flat(g, mouth & (ngon_radius(g, "z", CX, ny - 1) < 1.2), "teal", 5)
    # the cap lies on the puddle in front, still on its chain
    cap = disc(g, "y", CX - 4, CZ - R - 4, 2.6, 1, 3, "red", 4)
    P.flat(g, cap & (Y > 2), "red", 5)
    g.prism("z", [(CX - 2.5, ny - 3.5), (CX - 1.5, ny - 3.5), (CX - 3.5, 2.5), (CX - 4.5, 2.5)], CZ - R - 3, CZ - R - 2, C("steel", 5))
    # a thin leak line running into the puddle
    P.flat(g, body & (np.abs(X - CX + 2) < 0.6) & (Z < CZ - 3) & (Y < ny - 3), "teal", 5)
    return asset("fire-hydrant", "Cracked Fire Hydrant", root("fire-hydrant", g))
