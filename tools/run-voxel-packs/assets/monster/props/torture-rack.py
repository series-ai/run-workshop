"""Torture rack, in the Pirate Nation haunted style.

A heavy planked frame on four braced legs (true diagonal braces) holding
a slatted bed long enough for a person. Octagonal rollers turn at both
ends, a big spoked crank wheel with a handle sits on one side, ropes run
from the rollers to open manacles, and the bed is blood-stained, with a
bucket underneath. The long axis runs front to back.
"""
import numpy as np

import paint as P
import pnshapes as S
from _props import idx, planked, prop, shackle, union
from pnkit import box, edges
from voxgrid import C, Grid

L = 44
BED = 14  # bed top


def build():
    g = Grid(28, 28, L + 2)
    X, Y, Z = idx(g)
    x0, x1 = 4, 24
    z0, z1 = 1, L + 1
    # legs and braces
    for lx in (x0, x1 - 4):
        for lz in (z0, z1 - 4):
            box(g, lx, 0, lz, lx + 4, BED, lz + 4, "wood", 4)
        S.bar(g, "x", (1, z0 + 4), (BED - 3, z0 + 12), 2.6, lx + 1, lx + 3, "wood", 5)
        S.bar(g, "x", (1, z1 - 4), (BED - 3, z1 - 12), 2.6, lx + 1, lx + 3, "wood", 5)
    rails = box(g, x0, BED - 4, z0, x0 + 4, BED, z1, "wood", 5) | box(g, x1 - 4, BED - 4, z0, x1, BED, z1, "wood", 5)
    planked(g, rails, "wood", 5, width=4, across="y", seed=1)
    slats = box(g, x0 + 4, BED - 2, z0 + 6, x1 - 4, BED - 1, z1 - 6, "wood", 6)
    P.flat(g, slats & (Z % 3 == 0), "wood", 3)
    stain = slats & ((((X + 0.5 - 13) ** 2 / 9 + (Z + 0.5 - 22) ** 2 / 30) < 1) | ((np.abs(X + 0.5 - 11) < 1) & (Z > 22) & (Z < 32)) | ((np.abs(X + 0.5 - 15) < 1) & (Z > 14) & (Z < 20)))
    P.flat(g, stain, "blood", 4)
    # rollers at both ends, with painted rope turns
    for rz in (z0 + 3, z1 - 3):
        roll = S.disc(g, "x", BED + 1.5, rz, 2.6, x0, x1, "wood", 6)
        P.flat(g, roll & (X % 3 == 0), "wood", 4)
        P.flat(g, roll & (np.abs(X + 0.5 - 11) < 1.5) | roll & (np.abs(X + 0.5 - 17) < 1.5), "sand", 5)
    # ropes from the rollers to the manacles
    for mz, sgn in ((z0 + 9, 1), (z1 - 9, -1)):
        for mx in (11, 17):
            S.bar(g, "x", (BED + 1.5, mz - sgn * 6), (BED, mz), 1.1, mx - 0.5, mx + 0.5, "sand", 5)
            shackle(g, mx, BED + 0.5, mz, "iron", 6, face="y")
    # the crank wheel on the +x side, with a handle
    w = S.wheel(g, "x", z1 - 8, BED + 1.5 - 7, 7, x1, x1 + 2, n=8, spokes=4, gaps=True, tyre=("iron", 6), rim=("wood", 5), spoke=("wood", 6), hub=("gold", 5))
    S.bar(g, "z", (x1 + 2, BED + 7), (x1 + 4, BED + 7), 1.6, z1 - 8.8, z1 - 7.2, "iron", 6)
    box(g, x1 + 3, BED + 5, z1 - 8.5, x1 + 4, BED + 10, z1 - 7.5, "wood", 6)
    S.bar(g, "z", (x1, BED - 2), (x1 + 2, BED - 2), 1.6, z1 - 8.8, z1 - 7.2, "iron", 6)  # the axle stub
    # a bucket underneath
    start = len(g.solids)
    g.prism("y", S.flat_ngon(14, 22, 3, 8), 0, 6, C("wood", 5), top=S.flat_ngon(14, 22, 3.8, 8))
    bucket = union(g, start)
    P.flat(g, bucket & ((Y == 1) | (Y == 4)), "iron", 6)
    P.flat(g, bucket & (Y == 5) & (S.radial(g, "y", 14, 22) < 2.8), "blood", 5)
    return prop("torture-rack", "Torture Rack", g)
