"""Iron candelabra, in the Pirate Nation haunted style.

A tall wrought-iron floor candelabra: four clawed legs (true diagonal
bars), an octagonal stem with three knobs, a chunky skull at the hub and
two curling arms (true diagonals). Three fat purple candles with painted
wax drips burn with the shared PN flame, the middle one highest. About
39 tall: the flames burn above a person's head. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _props import big_skull, candle, idx, prop
from pnkit import box
from voxgrid import C, Grid

IRON = ("iron", 6)


def build():
    g = Grid(28, 42, 16)
    cx, cz = 14, 8
    X, Y, Z = idx(g)
    # four clawed legs from the stem foot to the ground
    for s in (-1, 1):
        S.bar(g, "z", (cx, 7), (cx + s * 8, 1), 2.2, cz - 1, cz + 1, *IRON)
        S.bar(g, "x", (7, cz), (1, cz + s * 6.5), 2.2, cx - 1, cx + 1, *IRON)
        box(g, cx + s * 8 - 1.5, 0, cz - 1.5, cx + s * 8 + 1.5, 1, cz + 1.5, "iron", 5)
        box(g, cx - 1.5, 0, cz + s * 6.5 - 1.5, cx + 1.5, 1, cz + s * 6.5 + 1.5, "iron", 5)
    # the stem with three knobs
    S.disc(g, "y", cx, cz, 1.6, 5, 23, *IRON)
    for ky, kr in ((5, 2.8), (12, 2.4), (19, 2.4)):
        S.disc(g, "y", cx, cz, kr, ky, ky + 2, "iron", 7)
    # the skull on the hub
    big_skull(g, cx, 19, cz, s=7, base=6, eyes=("toxic", 6))
    # two curling arms with candle cups (true diagonals)
    for s in (-1, 1):
        S.bar(g, "z", (cx + s * 2, 21), (cx + s * 8, 22), 2.0, cz - 1, cz + 1, *IRON)
        S.bar(g, "z", (cx + s * 8, 22), (cx + s * 10, 26), 2.0, cz - 1, cz + 1, *IRON)
        S.bar(g, "z", (cx + s * 8, 21.5), (cx + s * 6, 17.5), 1.6, cz - 1, cz + 1, *IRON)  # the curl
        S.disc(g, "y", cx + s * 10, cz, 2.6, 26, 27, "gold", 4)
        candle(g, cx + s * 10 - 1.5, 27, cz - 1.5, h=5, w=3, wax="purple", wax_base=5)
    S.disc(g, "y", cx, cz, 2.6, 28, 29, "gold", 4)
    candle(g, cx - 1.5, 29, cz - 1.5, h=3, w=3, wax="purple", wax_base=5)
    iron = (g.a == C(*IRON))
    P.flat(g, iron & (Y % 4 == 0), "iron", 5)
    return prop("candelabra", "Iron Candelabra", g)
