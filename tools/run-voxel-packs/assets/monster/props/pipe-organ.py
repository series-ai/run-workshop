"""Haunted pipe organ, in the Pirate Nation haunted style.

A dark planked case with a steep pointed top (true slopes) and a magenta
rose glow, fronted by a symmetric rank of fat gold pipes (octagons with
painted dark mouths), the tallest in the middle. Below sits a chunky
console with two manuals of bone keys, a music stand with a sheet, a
skull and two candles, and a bench in front. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import big_skull, candle, idx, planked, prop
from pnkit import box, edges
from voxgrid import C, Grid

W = 40


def build():
    g = Grid(W, 50, 26)
    X, Y, Z = idx(g)
    cx = W / 2
    # the case behind the pipes, with a pointed top
    case = box(g, 1, 0, 14, W - 1, 38, 22, "wood", 4)
    planked(g, case, "wood", 4, width=4, across="x", nails=False, seed=1)
    g.prism("z", [(1, 38), (W - 1, 38), (cx, 49)], 14, 22, C("purple", 4))
    top = S.last(g)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 4, row=3, width=4, frame=fr, seed=2))
    P.flat(g, top & (Z == 14), "wood", 5)
    P.outline(g, top & (Z == 14), "wood", 3, normal="z")
    rose = S.disc(g, "z", cx, 42, 3.2, 13, 14, "magenta", 6)
    P.flat(g, rose & (S.radial(g, "z", cx, 42) < 1.3), "magenta", 7)
    # the pipes: tallest in the middle
    heights = [16, 20, 24, 28, 33, 28, 24, 20, 16]
    for k, h in enumerate(heights):
        px = 4.5 + k * 3.9
        pipe = S.disc(g, "y", px, 12.5, 1.8, 14, 14 + h, "gold", 4 if k % 2 else 5)
        P.flat(g, pipe & (X == int(px)), "gold", 6)
        mouth = pipe & (Z < 12) & (Y >= 16) & (Y < 19) & (np.abs(X + 0.5 - px) < 1.1)
        P.flat(g, mouth, "wood", 2)
        P.flat(g, pipe & (Y == 14 + h - 1), "gold", 3)
    # the console: two manuals, a music stand
    con = box(g, 5, 0, 5, W - 5, 13, 14, "wood", 5)
    planked(g, con, "wood", 5, width=3, across="y", seed=3)
    for ky, kz in ((9, 5), (11, 7)):
        keys = box(g, 8, ky, kz - 2, W - 8, ky + 1, kz + 1, "bone", 7)
        P.flat(g, keys & (X % 2 == 0) & (Z >= kz), "wood", 2)
    stand = box(g, cx - 6, 13, 10, cx + 6, 19, 11, "wood", 5)
    sheet = box(g, cx - 4, 14, 9, cx + 4, 19, 10, "bone", 7)
    P.flat(g, sheet & (Y % 2 == 0) & (X != int(cx)), "wood", 3)
    big_skull(g, 9, 13, 11, s=6, base=6, eyes=("magenta", 6))
    candle(g, W - 10, 13, 10, h=4, w=2)
    candle(g, W - 7, 13, 11, h=6, w=2)
    # the bench
    bench = box(g, cx - 8, 6, 0, cx + 8, 8, 4, "purple", 4)
    for bx in (cx - 7, cx + 5):
        box(g, bx, 0, 1, bx + 2, 6, 3, "wood", 4)
    P.flat(g, edges(bench), "gold", 4)
    return prop("pipe-organ", "Haunted Pipe Organ", g)
