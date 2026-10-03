"""Spiked barricade (a cheval de frise), in the Pirate Nation style.

One chunky icon (rule K3): a thick octagonal log with four pairs of
sharpened stakes driven through it in X shapes, so every stake is a true
diagonal with a pointed tip (rule F2). Rope lashings, the fresh-cut bone
tips and one bloody tip are paint (rule S1); a hub cap nailed to the log
is a crude shield. The pairs splay at slightly different angles (rule F5).
"""

import numpy as np

import paint as P
from _props import asset, root, stake, tuft
from pnshapes import coords, disc, ngon_radius
from voxgrid import Grid

L = 38
LY, LZ = 8, 14  # log axis (y, z)
T = 2.6  # stake thickness along x


def build():
    g = Grid(L, 24, 28)
    X, Y, Z = coords(g)
    log = disc(g, "x", LY, LZ, 2.8, 0, L, "rust", 4)
    P.planks(g, log, "rust", 4, width=2, across="y", length=(12, 18), nails=False, seed=1)
    P.flat(g, log & ((X < 1) | (X > L - 1)), "sand", 5)  # cut ends
    P.flat(g, log & ((X < 1) | (X > L - 1)) & (ngon_radius(g, "x", LY, LZ) < 1.4), "rust", 5)
    for k, x in enumerate((3.0, 12.0, 21.5, 31.0)):
        spread = (6.0, 6.5, 5.5, 6.2)[k]
        rise = (10.0, 10.8, 9.6, 10.4)[k]
        for s in (-1, 1):
            p0 = (1.4, LZ - s * spread)  # (y, z): the foot on the ground
            t = (LY + rise - 1.4) / (LY - 1.4)  # the stake passes through the log axis
            p1 = (LY + rise, LZ - s * spread + t * s * spread)
            tip = ("red", 3) if (k, s) == (2, 1) else ("bone", 6)
            m = stake(g, "x", p0, p1, 1.2, x + (0.5 if s > 0 else -0.5), x + T + (0.5 if s > 0 else -0.5), "sand", 4, tip=tip)
            P.flat(g, m & (np.abs(Y - LY) < 2.5), "bone", 5)  # the rope lashing at the log
            P.flat(g, m & (np.abs(Y - LY) < 2.5) & (np.floor(Y) % 2 == 0), "bone", 3)
    # a hub cap nailed on the log as a shield
    hub = disc(g, "z", 17, LY, 3.6, LZ - 4, LZ - 2, "steel", 6)
    d = ngon_radius(g, "z", 17, LY)
    P.flat(g, hub & (d > 2.8), "steel", 4)
    P.flat(g, hub & (d < 1.2), "gold", 5)
    tuft(g, 8, 4, 0, seed=1)
    tuft(g, 27, 18, 0, seed=2)
    return asset("spike-barricade", "Spiked Barricade", root("spike-barricade", g))
