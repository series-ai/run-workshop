"""Candelabra in the Pirate Nation style.

A brass stand (warm gold, rule C1) on three splayed claw feet (true
diagonals) with a knobbed octagonal stem. Five arms lift chunky cream
candles in gold cups: a straight centre, two low arms and two high arms
that sweep up on true slopes. The candles differ in height and one leans
(rule F5). About 22 wide and 36 tall.
"""

import numpy as np

import paint as P
from _props import brace, candle, coords
from pnkit import box
from pnshapes import disc
from voxgrid import Asset, Grid, Part

W, H, D = 24, 40, 14
CX, CZ = 12, 6
ARM_Y = 24


def cup(g: Grid, cx, y, cz) -> None:
    c = box(g, cx - 1.5, y, cz - 1.5, cx + 1.5, y + 2, cz + 1.5, "gold", 5)
    _X, Y, _Z = coords(g)
    P.flat(g, c & (Y > y + 1), "gold", 7)


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # feet: three splayed legs and a round foot plate
    brace(g, "z", (CX - 8, 1.2), (CX - 1, 6), 2.0, CZ - 1, CZ + 1, "gold", 4)
    brace(g, "z", (CX + 8, 1.2), (CX + 1, 6), 2.0, CZ - 1, CZ + 1, "gold", 4)
    brace(g, "x", (1.2, CZ + 5.5), (6, CZ + 0.5), 2.0, CX - 1, CX + 1, "gold", 4)
    # the stem with knobs
    stem = disc(g, "y", CX, CZ, 1.5, 5, ARM_Y, "gold", 5, n=8)
    for ky in (7, 14):
        disc(g, "y", CX, CZ, 2.6, ky, ky + 2, "gold", 6, n=8)
    P.flat(g, stem & (np.floor(X) == CX - 2), "gold", 6)
    # the arm bar and the upswept outer arms
    arm = box(g, CX - 6, ARM_Y, CZ - 1, CX + 6, ARM_Y + 2, CZ + 1, "gold", 5)
    P.flat(g, arm & (Y > ARM_Y + 1), "gold", 6)
    brace(g, "z", (CX - 5, ARM_Y + 1), (CX - 9, ARM_Y + 6), 2.0, CZ - 1, CZ + 1, "gold", 5)
    brace(g, "z", (CX + 5, ARM_Y + 1), (CX + 9, ARM_Y + 6), 2.0, CZ - 1, CZ + 1, "gold", 5)
    # cups and candles
    cup(g, CX, ARM_Y + 2, CZ)
    candle(g, CX, ARM_Y + 4, CZ, h=7, w=2)
    for sx, y, h in ((-5, ARM_Y + 2, 4), (5, ARM_Y + 2, 5), (-9, ARM_Y + 6, 3), (9, ARM_Y + 6, 4)):
        cup(g, CX + sx, y, CZ)
        candle(g, CX + sx, y + 2, CZ, h=h, w=2)
    # wax drips on two candles
    P.flat(g, (g.a > 0) & (np.floor(X) == CX - 1) & (np.floor(Z) == CZ - 1) & (Y > ARM_Y + 6) & (Y < ARM_Y + 8), "bone", 7)
    root = Part("candelabra", g)
    return Asset(id="fantasy-props-candelabra", pack="fantasy", category="props", name="Candelabra", root=root)
