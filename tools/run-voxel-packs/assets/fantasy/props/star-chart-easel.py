"""Star chart easel in the Pirate Nation style.

A chunky timber easel carries the oversized function prop (rule F4): a
chart board of deep night-blue with gold stars, cyan constellation lines
and a cream border, set a little askew on its frame (rule F5). A brass
astrolabe ring, a rolled chart and a lit candle sit on the tray below
(rule K1). About 30 wide and 38 tall.
"""

import numpy as np

import paint as P
from _props import candle, coords, plank_box
from pnkit import box
from pnshapes import bar, disc, last, rotate
from voxgrid import C, Asset, Grid, Part

W, H, D = 30, 40, 26
TRAY = 11  # the tray underside
BY0, BY1 = 13, 37  # the board
STARS = ((5, 4), (10, 2), (16, 6), (8, 11), (14, 13), (19, 10), (4, 15), (12, 18), (18, 17), (7, 20))
LINES = (((5, 4), (10, 2)), ((10, 2), (16, 6)), ((16, 6), (19, 10)), ((8, 11), (14, 13)), ((14, 13), (12, 18)))


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # two splayed front legs and one long back leg
    for p0, p1 in (((4, 1), (9, 14)), ((26, 1), (21, 14))):
        leg = bar(g, "z", p0, p1, 2.8, 15, 18, "darkwood", 4)
        P.planks(g, leg, "darkwood", 4, width=3, across="y", frame="z", nails=False, seed=p0[0])
        P.outline(g, leg, "darkwood", 2, normal="z")
    back = bar(g, "x", (1, 23), (33, 16), 3.0, 13, 16, "darkwood", 5)
    P.planks(g, back, "darkwood", 5, width=3, across="y", frame="x", nails=False, seed=7)

    # the tray and its lip
    tray = plank_box(g, 2, TRAY, 4, 28, TRAY + 2, 17, "wood", 6, across="y", width=4, seed=1)
    P.flat(g, tray & (Yi == TRAY), "darkwood", 3)
    lip = box(g, 2, TRAY + 2, 4, 28, TRAY + 5, 6, "wood", 7)
    P.planks(g, lip, "wood", 7, width=3, across="y", frame="z", nails=True, seed=2)
    P.outline(g, lip, "darkwood", 3, normal="z")

    # the chart board, set a little askew
    pts = rotate([(3, BY0), (27, BY0), (27, BY1), (3, BY1)], 15, 24, 4.0)
    g.prism("z", pts, 12, 15, C("wood", 6))
    frame = last(g)
    P.planks(g, frame, "wood", 6, width=4, across="y", frame="z", nails=True, seed=3)
    P.outline(g, frame, "darkwood", 3, normal="z")
    face = frame & (Zi == 12)
    U = (X - 15) * np.cos(np.radians(4.0)) + (Y - 24) * np.sin(np.radians(4.0))
    V = -(X - 15) * np.sin(np.radians(4.0)) + (Y - 24) * np.cos(np.radians(4.0))
    field = face & (np.abs(U) < 10.0) & (np.abs(V) < 10.0)
    P.flat(g, face, "wood", 7)
    P.flat(g, face & (np.abs(U) < 11.2) & (np.abs(V) < 11.2), "bone", 7)  # the cream mount
    P.flat(g, field, "navy", 3)
    for (ax, ay), (bx, by) in LINES:  # constellation lines
        n = max(abs(bx - ax), abs(by - ay))
        for t in range(n + 1):
            pu, pv = ax + (bx - ax) * t / n - 10, ay + (by - ay) * t / n - 10
            P.flat(g, field & (np.abs(U - pu) < 0.9) & (np.abs(V - pv) < 0.9), "cyan", 5)
    for sx, sy in STARS:  # gold stars
        d = np.hypot(U - (sx - 10), V - (sy - 10))
        P.flat(g, field & (d < 1.7), "gold", 6)
        P.flat(g, field & (d < 0.9), "gold", 7)
    moon = np.hypot(U + 5.5, V + 6.0)
    P.flat(g, field & (moon < 3.4), "gold", 6)
    P.flat(g, field & (moon < 3.4) & (np.hypot(U + 4.0, V + 6.6) < 3.0), "navy", 3)
    for cx0 in (4, 25):  # corner brackets
        P.flat(g, frame & (np.abs(U - (cx0 - 15)) < 3.0) & (np.abs(V - 11.5) < 1.6), "gold", 5)
        P.flat(g, frame & (np.abs(U - (cx0 - 15)) < 3.0) & (np.abs(V + 11.5) < 1.6), "gold", 5)

    # a brass astrolabe, a rolled chart and a candle on the tray
    ring = disc(g, "z", 7, TRAY + 9, 4.4, 7, 9, "gold", 5, n=8)
    rr = np.hypot(X - 7, Y - (TRAY + 9))
    P.flat(g, ring & (rr < 3.2), "navy", 3)
    P.flat(g, ring & (rr < 3.2) & ((np.abs(X - 7) < 0.7) | (np.abs(Y - (TRAY + 9)) < 0.7)), "gold", 6)
    P.flat(g, ring & (rr > 3.6), "gold", 6)
    roll = disc(g, "x", TRAY + 4, 9, 2.0, 16, 25, "bone", 7, n=6)
    P.flat(g, roll & ((Xi % 4) == 0), "bone", 6)
    P.flat(g, roll & (np.abs(Xi - 20) < 1), "red", 5)
    candle(g, 25, TRAY + 5, 10, h=6, w=2, wax=("bone", 7))

    root = Part("star-chart-easel", g)
    return Asset(id="fantasy-props-star-chart-easel", pack="fantasy", category="props", name="Star Chart Easel", root=root)
