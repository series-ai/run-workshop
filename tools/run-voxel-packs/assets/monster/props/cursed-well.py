"""Cursed well, in the Pirate Nation haunted style.

After PN props-interactive-item-2x2-wishingwell: a round grey stone well
(an octagon with painted blocks and a light stone rim) full of glowing
toxic-green water, two timber posts carrying a crank beam and a steep
purple tiled gable roof (true slopes). A rope drops to a bucket above the
water; a skull glyph glows on the front of the wall. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import idx, planked, prop, tufts, union
from pnkit import box, edges
from voxgrid import C, Grid

R = 10.5


def build():
    g = Grid(30, 42, 30)
    cx = cz = 15
    X, Y, Z = idx(g)
    start = len(g.solids)
    S.disc(g, "y", cx, cz, R, 0, 11, "gray", 4)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 4, block=(5, 3), frame=fr, seed=1))
    rim = S.disc(g, "y", cx, cz, R + 1, 11, 13, "gray", 6)
    P.stone(g, rim, "gray", 6, block=(4, 2), frame="top", seed=2)
    rad = S.ngon_radius(g, "y", cx, cz)
    water = rim & (Y == 12) & (rad < R - 1.5)
    P.flat(g, water, "toxic", 5)
    P.flat(g, water & (np.abs(np.hypot(X + 0.5 - cx, Z + 0.5 - cz) - 4.5) < 0.7), "toxic", 7)
    P.flat(g, water & (np.hypot(X + 0.5 - cx - 2, Z + 0.5 - cz + 3) < 1.2), "toxic", 7)
    P.flat(g, rim & (Y == 12) & (rad >= R - 1.5) & (rad < R - 0.6), "gray", 3)
    # moss creeping up the wall
    from pnpaint import blotch

    blotch(g, (g.a > 0) & (Y < 5), "moss", 5, cell=2, chance=0.12, seed=3)
    # a glowing skull on the front of the wall
    sk = [".###.", "#####", "#o#o#", "##o##", ".#.#."]
    pnglyph.stamp(g, "-z", cz - R, cx - 2, 3, sk, {"#": C("toxic", 6), "o": C("gray", 2)}, reach=2)
    # two posts, a crank beam with a handle, a rope and a bucket
    posts = box(g, cx - 12, 11, cz - 1.5, cx - 9, 29, cz + 1.5, "wood", 5) | box(g, cx + 9, 11, cz - 1.5, cx + 12, 29, cz + 1.5, "wood", 5)
    planked(g, posts, "wood", 5, width=3, across="x", nails=False, seed=4)
    beam = S.disc(g, "x", 24, cz, 1.6, cx - 9, cx + 9, "wood", 4)
    P.flat(g, beam & (np.abs(X + 0.5 - cx) < 2), "wood", 6)
    S.bar(g, "z", (cx + 12, 24), (cx + 14, 24), 1.4, cz - 0.7, cz + 0.7, "iron", 6)
    S.bar(g, "x", (24, cz), (20, cz - 1), 1.4, cx + 13.5, cx + 15, "iron", 6)
    box(g, cx - 0.5, 18, cz - 0.5, cx + 0.5, 23, cz + 0.5, "sand", 5)
    start = len(g.solids)
    g.prism("y", S.flat_ngon(cx, cz, 2.2, 8), 14, 18, C("wood", 5), top=S.flat_ngon(cx, cz, 3, 8))
    bucket = union(g, start)
    P.flat(g, bucket & (Y == 16), "iron", 6)
    # the steep purple gable roof along x, with gable boards
    ey, ry, th = 28, 36, 2.2
    for s in (-1, 1):
        g.prism("x", [(ey, cz + s * 9), (ey + th, cz + s * 9), (ry + th, cz), (ry, cz)], cx - 14, cx + 14, C("purple", 4))
    roof = union(g, len(g.solids) - 2)
    S.paint_facets(g, g.solids[-2:], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 4, row=3, width=4, frame=fr, seed=5))
    P.flat(g, roof & ((X < cx - 12) | (X >= cx + 12)), "wood", 6)
    ridge = box(g, cx - 14.5, ry + 1, cz - 1, cx + 14.5, ry + 3, cz + 1, "wood", 6)
    tufts(g, [(cx - 12, cz - 8), (cx + 10, cz + 10), (cx + 11, cz - 9)])
    return prop("cursed-well", "Cursed Well", g)
