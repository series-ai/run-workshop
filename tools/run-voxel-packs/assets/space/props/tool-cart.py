"""Steel service cart with hull drawers, a lit label and tray tools. Faces -Z."""
import numpy as np

import paint as P
import pnpaint
from _props import cham_prism, dots, ngon_prism
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
            box(g, cx - 1, 3, cz - 1, cx + 1, Y0, cz + 1, "steel", 3)
            tyre(g, "x", 2.0, cz, 2.0, cx - 1, cx + 1, rubber=("steel", 2), hub=("steel", 4))
    body = cham_prism(g, "z", X0, Y0, X1, Y1, 1.5, Z0, Z1, "steel", 5)
    P.flat(g, body, "steel", 5)
    # Paint one framed hull panel on each broad side and on the rear.
    side_back = body & ((X < X0 + 1) | (X > X1 - 1) | (Z > Z1 - 1))
    panel_x = side_back & (X < X0 + 1) | side_back & (X > X1 - 1)
    panel_x &= (Y > 6) & (Y < 16) & (Z > Z0 + 1.5) & (Z < Z1 - 1.5)
    panel_back = side_back & (Z > Z1 - 1) & (Y > 6) & (Y < 16) & (X > X0 + 2) & (X < X1 - 2)
    P.flat(g, panel_x | panel_back, "bone", 6)
    # Fine steel seams and corner bolts frame each painted plate.
    P.flat(g, side_back & (np.abs(Y - 10.5) < 0.6), "steel", 4)
    for y in (7, 15):
        P.flat(g, side_back & (np.abs(Y - y) < 0.6) & ((X < X0 + 1) | (X > X1 - 1) | (Z > Z1 - 1)), "steel", 3)
    P.flat(g, side_back & (np.abs(X - 12) < 0.6) & (Z > Z1 - 1) & (Y > 7) & (Y < 15), "steel", 3)
    for y in (7, 15):
        dots(g, side_back & (X < X0 + 1), "-x", [(Z0 + 2, y), (Z1 - 2, y)], 0.7, "orange", 6)
        dots(g, side_back & (X > X1 - 1), "+x", [(Z0 + 2, y), (Z1 - 2, y)], 0.7, "orange", 6)
        dots(g, side_back & (Z > Z1 - 1), "+z", [(X0 + 2, y), (X1 - 2, y)], 0.7, "orange", 6)
    # A short hazard strip marks the lower service edge.
    pnpaint.hazard(g, side_back & (Y > 4.5) & (Y < 6.5), period=4, a=("orange", 5), b=("iron", 5))
    # three drawers on the front
    front = body & (Z < Z0 + 1)
    cols = [("bone", 6), ("bone", 5), ("bone", 6)]
    for k, (y0, y1) in enumerate(((5, 9), (9.5, 13), (13.5, 17))):
        dr = front & (Y > y0) & (Y < y1) & (X > X0 + 1) & (X < X1 - 1)
        P.flat(g, dr, *cols[k])
        P.flat(g, dr & ((Y < y0 + 0.6) | (Y > y1 - 0.6) | (X < X0 + 1.9) | (X > X1 - 1.9)), "steel", 3)
        P.flat(g, dr & (X > 17) & (X < 20) & (Y > y0 + 1) & (Y < y1 - 1), "teal", 5)
        P.flat(g, dr & (X > 18) & (X < 19.5) & (Y > y0 + 1) & (Y < y1 - 1), "cyan", 7)
    for y in (7, 11, 15):
        pull = box(g, 9, y, Z0 - 1, 15, y + 1, Z0, "rust", 5)
        P.flat(g, pull & (X > 10) & (X < 14), "steel", 6)
    dots(g, body & (Z < Z0 + 1), "-z", [(4, 6), (20, 6), (4, 12), (20, 12), (4, 16), (20, 16)], 0.7, "iron", 6)
    # the top tray with a lip
    tray = box(g, X0 - 1, Y1, Z0 - 1, X1 + 1, Y1 + 1, Z1 + 1, "steel", 5)
    lip = box(g, X0 - 1, Y1 + 1, Z0 - 1, X1 + 1, Y1 + 2, Z0, "steel", 4) | box(g, X0 - 1, Y1 + 1, Z1, X1 + 1, Y1 + 2, Z1 + 1, "steel", 4)
    P.flat(g, edges(tray), "steel", 3)
    # push handle on +x
    for zz in (Z0 + 1, Z1 - 3):
        box(g, X1, 13, zz, X1 + 3, 15, zz + 2, "steel", 4)
    grip = box(g, X1 + 2, 13, Z0 + 2, X1 + 4, 15, Z1 - 2, "steel", 5)
    P.flat(g, grip & (np.floor(Z) % 3 == 0), "rust", 5)
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
    P.flat(g, m & (X > 7) & (X < 12) & (Y > 1), "rust", 5)  # insulated copper grip
    P.flat(g, m & (np.abs(X - 8) < 0.6) & (Y > 1), "cyan", 6)
    return g


def spool() -> Grid:
    g = Grid(8, 8, 6)
    X, Y, Z = coords(g)
    for z0 in (0, 5):
        hub = ngon_prism(g, "z", 4, 4, 3.6, z0, z0 + 1, "orange", 5)
        P.flat(g, hub & (np.hypot(X - 4, Y - 4) < 1.6), "steel", 6)
        P.flat(g, hub & (np.hypot(X - 4, Y - 4) < 0.7), "cyan", 6)
    core = ngon_prism(g, "z", 4, 4, 2.6, 1, 5, "teal", 4)
    P.flat(g, core & (np.floor(Z) % 2 == 0), "cyan", 5)
    return g


def torch() -> Grid:
    g = Grid(4, 4, 10)
    X, Y, Z = coords(g)
    b = ngon_prism(g, "z", 2, 2, 1.8, 0, 7, "rust", 4)
    P.flat(g, b & (Z > 5), "bone", 6)
    ngon_prism(g, "z", 2, 2, 1.0, 7, 10, "cyan", 5, r_top=0.6)
    return g


def build() -> Asset:
    root = Part("tool-cart", cart())
    root.add(Part("wrench", wrench(), pivot=(10.0, 0.0, 4.0), at=(12.0, float(Y1 + 1), 7.0), rot=(0.0, 8.0, 0.0)))
    root.add(Part("spool", spool(), pivot=(4.0, 0.0, 3.0), at=(18.0, float(Y1 + 1), 11.0), rot=(0.0, 0.0, 0.0)))
    root.add(Part("torch", torch(), pivot=(2.0, 0.0, 5.0), at=(5.0, float(Y1 + 1), 10.0), rot=(0.0, -70.0, 0.0)))
    return Asset(id="space-props-tool-cart", pack="space", category="props", name="Tool Cart", root=root)
