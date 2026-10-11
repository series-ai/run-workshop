"""Stained single mattress, in the Pirate Nation style.

One big soft icon (rule K3), sized for a 36-voxel person: a mattress with
piped, bevelled edges (true slopes) slumped with one end up on a sand
cinder block (a rest rotation, rule F5). Red ticking stripes, quilt
tufts, a stain map and a torn corner with burst springs are paint and
thin bars (rule S1). A pillow and a tin can lie beside it.
"""
import numpy as np

import paint as P
from _props import asset, bevel, child, pillow, root
from pnkit import box, edges
from pnshapes import bar, coords, disc
from voxgrid import Grid

ML, MW, MT = 40, 20, 6  # mattress length (x), width (z), thickness


def mattress() -> Grid:
    g = Grid(ML, MT + 3, MW)
    X, Y, Z = coords(g)
    m = bevel(g, "x", 0, 0, MT, MW, 0, ML, "bone", 6, ch=1.5)
    # ticking stripes along the length, on the top and the sides
    stripe = (np.floor(Z) % 4 < 2)
    P.flat(g, m & stripe & (Y > 1), "red", 5)  # red ticking: the vivid accent
    P.flat(g, m & (np.floor(Y) == 2) & ~(Y > MT - 1), "red", 4)
    # piping: a darker rim on the bevels, and the ends
    P.flat(g, m & ((Y < 1.2) | (Y > MT - 1.2)) & ((Z < 1.6) | (Z > MW - 1.6)), "bone", 4)
    P.flat(g, m & ((X < 1) | (X > ML - 1)) & ((Y < 1.2) | (Y > MT - 1.2) | (Z < 1.6) | (Z > MW - 1.6)), "bone", 4)
    top = m & (Y > MT - 1)
    # quilt tufts in a grid, and a big stain map
    P.flat(g, top & (np.floor(X) % 6 == 3) & (np.floor(Z) % 6 == 3), "bone", 3)
    stain = top & (np.hypot((X - 14) / 1.4, Z - 8) < 4.5)
    P.flat(g, stain, "sand", 5)
    P.flat(g, stain & (np.hypot((X - 14) / 1.4, Z - 8) > 3.6), "sand", 4)
    P.flat(g, top & (np.hypot(X - 24, Z - 14) < 2.2), "gold", 5)
    # a torn corner with burst springs
    tear = top & (X > ML - 9) & (Z < 7)
    P.flat(g, tear, "sand", 4)
    for sx, sz in ((ML - 6, 2.5), (ML - 3, 4.5), (ML - 7, 5)):
        bar(g, "x", (MT - 1, sz), (MT + 2.5, sz + 0.8), 0.9, sx, sx + 1, "steel", 6)
        box(g, sx - 0.5, MT + 2, sz, sx + 1.5, MT + 3, sz + 2, "steel", 5)
    return g


def build():
    g = Grid(46, 10, 28)
    X, Y, Z = coords(g)
    # the cinder block that props up the +x end
    cb = box(g, 34, 0, 6, 42, 6, 20, "sand", 5)
    P.flat(g, edges(cb), "sand", 4)
    P.flat(g, cb & (Z < 7) & (Y > 1) & (Y < 5) & ((np.abs(X - 36.5) < 1.5) | (np.abs(X - 39.5) < 1.5)), "sand", 2)
    # the pillow and a tin can on the ground in front
    pw = pillow(g, 8, 4.2, 0, 11, 6, 4, angle=8, ramp="sky", base=5, puff=1.2, bulge=True, chamfer=1.5)
    P.flat(g, pw & (np.abs(X - 8) < 0.6), "sky", 3)
    can = disc(g, "x", 1.5, 3.0, 1.5, 22, 26, "steel", 6, n=6)
    P.flat(g, can & (X > 23) & (X < 25), "red", 5)
    r = root("mattress", g)
    # the mattress: its -x end on the ground, its +x end on the block (about 9°)
    child(r, "mattress-body", mattress(), pivot=(0.0, 0.0, 0.0), at_grid=(3.0, 0.0, 7.0), rot=(0.0, -6.0, 9.0))
    return asset("mattress", "Stained Mattress", r)
