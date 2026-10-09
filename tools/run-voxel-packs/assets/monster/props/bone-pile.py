"""Bone pile, in the Pirate Nation haunted style.

A low faceted soil mound heaped with big cartoon bones (dog bones with
round knuckles, true diagonals), a ribcage of curved rib bars on a spine,
a chunky skull with glowing sockets and a broken purple shield half
buried in the soil (leaning, rule F5). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _props import bone, idx, mound, prop, tufts
from voxgrid import C, Grid


def build():
    g = Grid(32, 18, 28)
    cx, cz = 16, 14
    mound(g, cx, cz, 13, 3, top=0.65, ramp="wood", base=3, moss=0.1, seed=1)
    X, Y, Z = idx(g)
    # the ribcage: a spine along x and four pairs of curved ribs (true diagonals)
    sx0, sx1, sz = cx - 3, cx + 9, cz + 3
    S.bar(g, "y", (sx0, sz), (sx1, sz), 2.0, 3, 5, "bone", 5)
    for k in range(4):
        rx = sx0 + 2 + k * 2.6
        for s in (-1, 1):
            p0 = (sz, 4.5)
            p1 = (sz + s * 4.5, 8.5 - k * 0.4)
            p2 = (sz + s * 6.5, 4.0)
            S.bar(g, "x", (p0[1], p0[0]), (p1[1], p1[0]), 1.6, rx, rx + 1.4, "bone", 6)
            S.bar(g, "x", (p1[1], p1[0]), (p2[1], p2[0]), 1.6, rx, rx + 1.4, "bone", 6)
    # big bones lying at angles
    bone(g, "y", (cx - 12, cz - 6), (cx - 1, cz - 9), 3, 5, r=1.4)
    bone(g, "y", (cx + 2, cz - 10), (cx + 12, cz - 4), 3, 5, r=1.4)
    bone(g, "y", (cx - 11, cz + 8), (cx - 5, cz - 1), 3, 5, r=1.3)
    bone(g, "z", (cx + 10, 3), (cx + 13, 10), cz + 7, cz + 9, r=1.2)  # one sticks up out of the soil
    # the skull on top of the heap
    S.skull(g, cx - 5, 3, cz - 1, s=9, ramp="bone", base=6, eyes=("toxic", 6), socket=("purple", 1), seed=2)
    # a broken shield leaning in the soil: a heater shape, tilted back
    pts = [(0, 0), (4, -3), (8, 0), (8, 7), (0, 7)]
    pts = [(cx + 5 + u, 1 + v) for u, v in pts]
    pts = S.rotate(pts, cx + 9, 1, -12)
    pts = [(u, max(1.0, v)) for u, v in pts]
    g.prism("z", pts, cz - 4, cz - 2, C("purple", 5))
    sh = S.last(g)
    P.flat(g, sh & S.seams(g, [g.solids[-1]], 0.9), "gold", 4)
    P.flat(g, sh & (np.abs(X + 0.5 - (cx + 9)) < 1.1), "gold", 5)
    P.flat(g, sh & (Y == 5), "gold", 5)
    tufts(g, [(4, 6), (27, 20), (9, 24)])
    return prop("bone-pile", "Bone Pile", g)
