"""Dungeon pillar, in the Pirate Nation haunted style (kit piece).

One PN tile square, kit height: a purple slate base and capital (the
courses of the kit walls) joined to an octagonal grey stone shaft by true
chamfers, with two iron straps, a glowing skull on the capital, a chain
with a manacle and moss at the foot.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import KIT_H, chain, damp, idx, prop, shackle, union
from pnkit import box
from voxgrid import C, Grid

N = 16


def build():
    g = Grid(N, KIT_H, N)
    X, Y, Z = idx(g)
    c = N / 2
    base = box(g, 0, 0, 0, N, 4, N, "purple", 3)
    P.stone(g, base, "purple", 3, block=(8, 4), seed=1)
    cap = box(g, 0, KIT_H - 3, 0, N, KIT_H, N, "purple", 5)
    P.stone(g, cap, "purple", 5, block=(6, 3), seed=2)
    P.stone(g, cap & (Y == KIT_H - 1), "purple", 6, block=(6, 4), frame="top", seed=5)
    oct6 = S.flat_ngon(c, c, 6, 8)
    sq = [(c + (u - c) * (c - 0.5) / max(abs(u - c), abs(v - c)), c + (v - c) * (c - 0.5) / max(abs(u - c), abs(v - c))) for u, v in oct6]
    start = len(g.solids)
    g.prism("y", sq, 4, 7, C("gray", 5), top=oct6)
    S.disc(g, "y", c, c, 6, 7, KIT_H - 7, "gray", 4)
    g.prism("y", oct6, KIT_H - 7, KIT_H - 3, C("gray", 5), top=sq)
    shaft = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 4, block=(5, 4), frame=fr, seed=3))
    P.flat(g, shaft & S.seams(g, g.solids[start + 1:start + 2], 0.8), "gray", 5)
    for by in (14, 30):
        P.flat(g, shaft & (Y >= by) & (Y < by + 2), "iron", 6)
    # the skull on the capital front, the chain and the manacle
    pnglyph.stamp(g, "-z", 0, int(c - 3), KIT_H - 9, [".####.", "######", "#oo#oo", "##oo##", ".#.#.#"], {"#": C("bone", 6), "o": C("toxic", 5)}, reach=3)
    box(g, c + 2, 28, 1, c + 4, 30, 2.5, "iron", 6)
    chain(g, c + 3, 1.5, 28, 3, "iron", 6)
    shackle(g, c + 3, 20.5, 1.5, "iron", 6, face="z")
    damp(g, shaft | base, seed=4)
    return prop("dungeon-pillar", "Dungeon Pillar", g)
