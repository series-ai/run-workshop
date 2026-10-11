"""Coffin stack, in the Pirate Nation haunted style.

After PN decorations-decoration-1x2-coffin (19×7×11): an undertaker's pile
of three PN coffins. Two closed coffins lie side by side on low trestles,
their narrow foot ends to the front. The third lies across them, open, its
lid pushed askew so the purple satin shows. Crosses, handles and the
brass name plate are the accents; the planks are paint.
"""
import numpy as np

import paint as P
from _props import candle, coffin, idx, planked, prop
from pnkit import box
from voxgrid import Grid

L, W, H = 22, 11, 7


def build():
    g = Grid(30, 32, 26)
    # low trestles under the bottom pair (so the stack is not a heap on the floor)
    for z0 in (4, 17):
        planked(g, box(g, 1, 0, z0, 25, 2, z0 + 3, "wood", 5), "wood", 5, width=2, across="x", nails=False, seed=z0)
    y = 2
    coffin(g, 6.5, 12, y, L, W, H, along="z", wood="rust", base=2, lid="rust", lid_base=3, cross=("gold", 5), seed=1)
    coffin(g, 19.5, 12, y, L, W, H, along="z", wood="wood", base=4, lid="wood", lid_base=5, cross=("bone", 6), seed=4)
    # the top coffin lies across the pair, open, with its lid pushed askew
    top = y + H + 1
    coffin(g, 13, 12, top, 20, 10, H, along="x", wood="rust", base=2, lid="rust", lid_base=3, cross=("gold", 5), open_lining="magenta", lid_turn=16, lid_shift=(1.5, 5.0), lid_lift=0, handles=False, seed=7)
    g = g.flip("z")  # the narrow foot ends of the bottom pair face the front (-z)
    X, Y, Z = idx(g)
    # a brass name plate on each foot end, and a stub candle on a lid
    for cx in (6.5, 19.5):
        m = box(g, cx - 2, y + 2, 2, cx + 2, y + 5, 3, "gold", 4)
        P.flat(g, m & (Y == y + 3) & ((X % 2) == 0), "gold", 2)
    candle(g, 19, y + H, 20, h=5, w=2)
    return prop("coffin-stack", "Coffin Stack", g)
