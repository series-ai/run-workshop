"""Tool cart, in the Pirate Nation mecha style.

One chunky icon (rule K3): a hazard-orange mechanic's cart with three
painted drawers in accent colours and copper pulls, a steel top tray with a
lip, four stubby castor wheels (octagons, true facets, F2) and a copper push
handle on the +x side. An oversized wrench lies across the top at an angle
(F4, F5), beside a welding torch and a cable spool. Detail is paint (S1).
Faces -Z.
"""
import numpy as np

import paint as P
from _props import cham_prism, ngon_prism
from pnkit import box, edges
from pnshapes import bar, coords, tyre
from voxgrid import C, Asset, Grid, Part

W, D = 26, 16
X0, X1, Z0, Z1 = 2, 22, 2, 14
Y0, Y1 = 4, 18  # body


def cart() -> Grid:
    g = Grid(W, Y1 + 2, D)
    X, Y, Z = coords(g)
    for cx in (X0 + 2.5, X1 - 2.5):
        for cz in (Z0 + 2.5, Z1 - 2.5):
            box(g, cx - 1, 3, cz - 1, cx + 1, Y0, cz + 1, "steel", 4)
            tyre(g, "x", 2.0, cz, 2.0, cx - 1, cx + 1, rubber=("iron", 5), hub=("steel", 6))
    body = cham_prism(g, "z", X0, Y0, X1, Y1, 1.5, Z0, Z1, "orange", 5)
    P.flat(g, body, "orange", 5)
    P.flat(g, body & (np.abs(Z - Z0 - 0.5) > 0.4) & ((X < X0 + 1) | (X > X1 - 1)), "orange", 4)
    # three drawers on the front
    front = body & (Z < Z0 + 1)
    cols = [("red", 4), ("gold", 5), ("teal", 4)]
    for k, (y0, y1) in enumerate(((5, 9), (9.5, 13), (13.5, 17))):
        dr = front & (Y > y0) & (Y < y1) & (X > X0 + 1) & (X < X1 - 1)
        P.flat(g, dr, *cols[k])
        P.flat(g, dr & ((Y < y0 + 0.9) | (X < X0 + 1.9) | (X > X1 - 1.9)), cols[k][0], cols[k][1] - 1)
    for y in (7, 11, 15):
        box(g, 9, y, Z0 - 1, 15, y + 1, Z0, "rust", 5)
    # the top tray with a lip
    tray = box(g, X0 - 1, Y1, Z0 - 1, X1 + 1, Y1 + 1, Z1 + 1, "steel", 5)
    lip = box(g, X0 - 1, Y1 + 1, Z0 - 1, X1 + 1, Y1 + 2, Z0, "steel", 4) | box(g, X0 - 1, Y1 + 1, Z1, X1 + 1, Y1 + 2, Z1 + 1, "steel", 4)
    P.flat(g, edges(tray), "steel", 3)
    # push handle on +x
    for zz in (Z0 + 1, Z1 - 3):
        box(g, X1, 13, zz, X1 + 3, 15, zz + 2, "steel", 4)
    grip = box(g, X1 + 2, 12, Z0, X1 + 4, 16, Z1, "rust", 4)
    P.flat(g, grip & (Y > 15), "rust", 6)
    return g


def wrench() -> Grid:
    g = Grid(20, 2, 8)
    X, Y, Z = coords(g)
    bar(g, "y", (3, 4), (16, 4), 2.4, 0, 2, "steel", 6)
    g.prism("y", [(15, 1), (20, 1), (20, 7), (15, 7), (15, 5.4), (18, 5.4), (18, 2.6), (15, 2.6)], 0, 2, C("steel", 6))
    head = box(g, 0, 0, 1, 5, 2, 7, "steel", 6)
    m = g.a > 0
    P.flat(g, m & (Y > 1), "steel", 7)
    P.flat(g, m & (np.abs(Z - 4) < 0.6) & (X > 6) & (X < 14) & (Y > 1), "steel", 5)
    P.flat(g, m & (X > 7) & (X < 12) & (Y > 1), "red", 5)  # the grip
    return g


def spool() -> Grid:
    g = Grid(8, 8, 6)
    X, Y, Z = coords(g)
    for z0 in (0, 5):
        ngon_prism(g, "z", 4, 4, 3.6, z0, z0 + 1, "orange", 5)
    core = ngon_prism(g, "z", 4, 4, 2.6, 1, 5, "toxic", 4)
    P.flat(g, core & (np.floor(Z) % 2 == 0), "toxic", 5)
    return g


def torch() -> Grid:
    g = Grid(4, 4, 10)
    X, Y, Z = coords(g)
    b = ngon_prism(g, "z", 2, 2, 1.8, 0, 7, "rust", 4)
    P.flat(g, b & (Z > 5), "gold", 6)
    ngon_prism(g, "z", 2, 2, 1.0, 7, 10, "steel", 5, r_top=0.6)
    return g


def build() -> Asset:
    root = Part("tool-cart", cart())
    root.add(Part("wrench", wrench(), pivot=(10.0, 0.0, 4.0), at=(11.0, float(Y1 + 1), 7.0), rot=(0.0, 24.0, 0.0)))
    root.add(Part("spool", spool(), pivot=(4.0, 0.0, 3.0), at=(18.0, float(Y1 + 1), 10.0), rot=(0.0, 10.0, 0.0)))
    root.add(Part("torch", torch(), pivot=(2.0, 0.0, 5.0), at=(5.0, float(Y1 + 1), 10.0), rot=(0.0, -70.0, 0.0)))
    return Asset(id="space-props-tool-cart", pack="space", category="props", name="Tool Cart", root=root)
