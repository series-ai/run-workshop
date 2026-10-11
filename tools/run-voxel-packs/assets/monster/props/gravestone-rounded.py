"""Rounded gravestone, in the Pirate Nation haunted style.

After PN decorations-decoration-1x1-headstone-c and the weathered headstone:
one chunky round-topped stone (a prism, leaning a little, rule F5) on a
stone slab, with a painted cross, a crack and moss at its foot. In front
lies the grave: a soil mound with true sloped sides, wilted flowers and a
stub candle. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from pnpaint import blotch
from _props import candle, flowers, grave, idx, masonry, prop, tufts
from pnkit import box
from voxgrid import Grid


def build():
    g = Grid(22, 30, 30)
    cx = 11
    zb = 20  # the stone's slab
    grave(g, cx - 7, 3, cx + 7, zb + 1, h=3, inset=2.5, moss=0.04, seed=1)
    slab = box(g, cx - 8, 0, zb, cx + 8, 3, zb + 7, "stone", 4)
    masonry(g, slab, "stone", 4, block=(8, 3), seed=2)
    stone = S.tombstone(g, cx, zb + 3.5, w=15, h=22, t=5, y0=3, lean=-5, ramp="gray", base=5, glyph="cross", ink=("gray", 2), seed=3)
    X, Y, Z = idx(g)
    # a chipped shoulder and a crack
    P.flat(g, stone & (Z < zb + 2) & (np.abs((X - cx - 3) - (Y - 17) * 0.5) < 0.6) & (Y > 12) & (Y < 21), "gray", 2)
    blotch(g, stone & (Y > 19), "moss", 5, cell=2, chance=0.12, seed=4)
    flowers(g, [(cx - 3, 8), (cx - 1, 9), (cx + 2, 7)], 3)
    candle(g, cx + 5, 3, zb - 1, h=5, w=2)
    tufts(g, [(cx - 9, 6), (cx + 8, 14), (cx - 8, 24)])
    return prop("gravestone-rounded", "Rounded Gravestone", g)
