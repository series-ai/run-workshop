"""Scroll rack in the Pirate Nation style.

A pale timber pigeonhole case: twelve dark-framed cells, each with two
flat cream scroll ends set inside the frame and a vivid ribbon tail
hanging over each end (rule C3), under a
pediment with a gold seal. Two scrolls rest on the cap and one lies open
on the floor with a red wax seal. About 32 wide and 36 tall.
"""

import numpy as np

import paint as P
from _props import coords, plank_box
from pnkit import box
from pnshapes import disc, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 32, 38, 21
X0, X1 = 1, 31
Y0, Y1 = 3, 29  # the cell block
ZF, ZB = 5, 18
COLS = (1, 8.5, 16, 23.5, 31)
ROWS = (3, 11.7, 20.3, 29)
RIBBON = ("red", "blue", "cyan", "magenta", "leaf", "gold")


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # the case: a pale back, pale sides and dark dividers
    back = box(g, X0, 0, ZB - 3, X1, Y1 + 1, ZB, "bone", 6)
    P.planks(g, back, "bone", 6, width=4, across="x", nails=False, grain=False, seed=1)
    P.flat(g, back & (Z > ZB - 1.4), "blue", 3)  # a painted field on the rear face
    P.flat(g, back & (Z > ZB - 1.4) & (np.hypot(X - 16, Y - 16) < 7.0), "gold", 6)
    P.flat(g, back & (Z > ZB - 1.4) & (np.hypot(X - 16, Y - 16) < 5.4), "blue", 3)
    P.flat(g, back & (Z > ZB - 1.4) & (np.hypot(X - 16, Y - 16) < 3.0), "gold", 7)
    cells = box(g, X0, Y0, ZB - 6, X1, Y1, ZB - 2, "darkwood", 2)  # the shaded back of the cells
    P.flat(g, cells, "darkwood", 2)
    for cx in COLS:
        div = box(g, cx - 1, Y0, ZF, cx + 1, Y1, ZB - 2, "darkwood", 4)
        P.planks(g, div, "darkwood", 4, width=2, across="x", frame="x", nails=False, seed=int(cx))
    for cy in ROWS:
        shelf = box(g, X0, cy - 1, ZF, X1, cy + 1, ZB - 2, "darkwood", 4)
        P.planks(g, shelf, "darkwood", 4, width=2, across="y", frame="z", nails=False, seed=int(cy))

    # the scroll ends: two per cell, set back 1 voxel behind the dividers so
    # they stay inside the frame. Each end is a flat cream disc with a dark
    # rim and a rolled core, and a vivid ribbon tail hangs over it (rule C3).
    k = 0
    SF = ZF + 1  # the front face of the scroll ends
    for r in range(3):
        cy = (ROWS[r] + ROWS[r + 1]) / 2
        for c in range(4):
            cx = (COLS[c] + COLS[c + 1]) / 2
            for dx, dy in ((-0.95, -1.5), (0.95, 1.5)):
                sx, sy, rr = cx + dx, cy + dy, 1.75
                sc = disc(g, "z", sx, sy, rr, SF, ZB - 3, "bone", 6, n=8)
                d = np.hypot(X - sx, Y - sy)
                face = sc & (Zi == SF)
                P.flat(g, sc, "sand", 5)
                P.flat(g, face, "bone", 6)
                P.flat(g, face & (d > rr - 0.55), "sand", 4)  # the dark rim (rule S4)
                P.flat(g, face & (d < 0.75), "sand", 3)  # the rolled core
                col = RIBBON[k % len(RIBBON)]
                g.prism("z", [(sx - 0.6, sy + 0.2), (sx + 0.6, sy + 0.2), (sx + 0.9, sy - 2.3), (sx, sy - 1.7), (sx - 0.9, sy - 2.3)],
                        ZF, SF, C(col, 5))
                tail = last(g)
                P.flat(g, tail, col, 5)
                P.flat(g, tail & (Y > sy - 0.8), col, 6)
                k += 1

    # the cap and a pediment with a gold seal
    cap = plank_box(g, X0 - 2, Y1, ZF - 2, X1 + 2, Y1 + 3, ZB + 1, "wood", 7, across="y", width=4, seed=5)
    P.flat(g, cap & (Yi == Y1), "darkwood", 3)
    g.prism("z", [(X0, Y1 + 3), (X1, Y1 + 3), (22, Y1 + 8), (10, Y1 + 8)], ZB - 4, ZB, C("wood", 6))
    ped = last(g)
    P.planks(g, ped, "wood", 6, width=4, across="y", frame="z", nails=False, seed=6)
    P.outline(g, ped, "darkwood", 3, normal="z")
    P.flat(g, ped & (np.hypot(X - 16, Y - (Y1 + 5)) < 2.6), "gold", 6)
    P.flat(g, ped & (np.hypot(X - 16, Y - (Y1 + 5)) < 1.4), "red", 5)
    # a plinth under the case
    base = plank_box(g, X0 - 1, 0, ZF - 1, X1 + 1, Y0, ZB, "wood", 5, across="y", width=3, seed=7)
    P.flat(g, base & (Yi < 1), "darkwood", 3)

    # two scrolls lying on the cap and one unrolled on the floor
    for sx, col in ((7, "red"), (21, "cyan")):
        roll = disc(g, "x", Y1 + 4, ZF + 4, 2.0, sx, sx + 9, "bone", 7, n=6)
        P.flat(g, roll & ((Xi % 4) == 0), "bone", 6)
        P.flat(g, roll & (np.abs(Xi - sx - 4) < 1), col, 5)
        box(g, sx - 1, Y1 + 3, ZF + 3, sx, Y1 + 6, ZF + 6, "gold", 5)
        box(g, sx + 9, Y1 + 3, ZF + 3, sx + 10, Y1 + 6, ZF + 6, "gold", 5)

    root = Part("scroll-rack", g)
    return Asset(id="fantasy-props-scroll-rack", pack="fantasy", category="props", name="Scroll Rack", root=root)
