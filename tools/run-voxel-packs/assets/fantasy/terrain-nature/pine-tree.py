"""Frost pine in the Pirate Nation style.

PN pines are a short trunk under stacked, tapering clumps of big leaf
blocks. Here: a curved faceted trunk on a root flare, five octagonal leaf
tiers (sloped frustums, each turned a little and shifted off-centre so the
tree leans and is not a perfect cone, rule F5) and a pointed top. Painted
needles, snow caps with drips on every tier and a few blue-white frost
glints. About 36 wide and 66 tall (PN pine 26×60). Faces -Z.
"""
import math

import numpy as np

import paint as P
from _life import asset, coords, leaves, ngon, plan, trunk
from voxgrid import Grid, Part

S = (44, 72, 44)
CX, CZ = 22.0, 22.0
# tiers: (y0, y1, bottom radius, top radius, x shift, z shift, turn)
TIERS = [
    (14, 27, 18.0, 10.0, 0.0, 0.0, 0.0),
    (23, 36, 15.5, 8.0, 0.8, -0.4, 0.2),
    (32, 45, 12.5, 6.0, 1.4, -0.6, 0.05),
    (41, 53, 9.5, 4.0, 2.0, -0.4, 0.25),
    (49, 60, 6.5, 2.0, 2.4, 0.0, 0.1),
]


def build():
    g = Grid(*S)
    X, Y, Z = coords(g)
    # root flare and a curved trunk (sheared frustums: true slopes)
    trunk(g, [(CX, 0, CZ), (CX + 0.3, 3, CZ), (CX + 0.6, 10, CZ - 0.2), (CX + 1.2, 18, CZ - 0.4)], [6.5, 4.2, 3.6, 3.0], ramp="wood", base=3, n=6, seed=1)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))
    for k, (y0, y1, r0, r1, dx, dz, turn) in enumerate(TIERS):
        start = len(g.solids)
        tier = plan(g, ngon(CX + dx, CZ + dz, r0, 8, turn + math.pi / 8), y0, y1, "forest", 5,
                    top=ngon(CX + dx + 0.6, CZ + dz, r1, 8, turn + math.pi / 8))
        leaves(g, g.solids[start:], "forest", 5, seed=10 + k)
        # the tier's lower rim a shade darker (a painted overhang shadow)
        P.flat(g, tier & (Y < y0 + 1.5), "forest", 3)
        # a snow cap with round drips down the slope (bands, no speckle)
        drip = (P._hash(np.floor(np.arctan2(Z - CZ, X - CX) * 4).astype(int), seed=20 + k) % np.uint64(3)).astype(int)
        # snow sits on the visible upper slope, just under the next tier's rim
        cover = TIERS[k + 1][0] if k + 1 < len(TIERS) else 58
        snow = tier & (Y > cover - 3.5 - drip * 1.5)
        P.flat(g, snow, "bone", 7)
        P.flat(g, snow & (Y < cover - 2.5 - drip * 1.5 + 1.0), "bone", 6)
    # the tip: a pointed snowy cone
    plan(g, ngon(CX + 2.6, CZ, 3.5, 8, math.pi / 8), 58, 66, "bone", 7, top=[(CX + 3.4, CZ + 0.2)] * 8)
    tip = g.solids[-1].mask(g.shape)
    P.flat(g, tip & (Y < 60), "forest", 5)
    # grass and a snow patch at the foot
    base = plan(g, ngon(CX, CZ, 8.5, 7, 0.4), 0, 1, "bone", 6)
    P.flat(g, base & ((P._hash(Xi // 2, Zi // 2, seed=41) % np.uint64(3)) == 0), "bone", 7)
    root = Part("pine-tree", g, pivot=(CX, 0.0, CZ))
    return asset("terrain-nature", "pine-tree", "Frost Pine", root)
