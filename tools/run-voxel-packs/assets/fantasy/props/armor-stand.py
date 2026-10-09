"""Armor stand in the Pirate Nation style.

A caricature knight's harness (rule F4) on a cross-footed wooden stand:
short greaves, a flared skirt and a big chest (true-slope frustums) under
a royal-blue tabard with a gold crown, huge rounded pauldrons, hanging
gauntlets and an oversized great helm with a dark visor slit and a red
plume. A red kite shield leans at its feet (rule F5). About 30 wide and
44 tall (person-sized).
"""

import numpy as np

import paint as P
from _props import coords, glyph, heater, plank_box
from pnkit import box, edges
from pnshapes import flat_ngon, last, quad
from voxgrid import C, Asset, Grid, Part

W, H, D = 34, 48, 26
CX, CZ = 16, 13


def steel_box(g: Grid, x0, y0, z0, x1, y1, z1, shade: int = 5):
    m = box(g, x0, y0, z0, x1, y1, z1, "steel", shade)
    P.flat(g, edges(m), "steel", shade - 1)
    return m


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # the cross-footed stand and its post
    plank_box(g, CX - 9, 0, CZ - 2, CX + 9, 2, CZ + 2, "wood", 5, across="y", width=2, seed=1)
    plank_box(g, CX - 2, 0, CZ - 8, CX + 2, 2, CZ + 8, "wood", 5, across="y", width=2, seed=2)
    box(g, CX - 1.5, 2, CZ - 1.5, CX + 1.5, 16, CZ + 1.5, "wood", 4)
    # greaves and sabatons
    for sx in (-1, 1):
        x0 = CX + sx * 3.5 - 2
        steel_box(g, x0, 2, CZ - 2, x0 + 4, 14, CZ + 2, 5)
        steel_box(g, x0, 2, CZ - 4, x0 + 4, 4, CZ + 2, 4)  # the foot
        P.flat(g, (g.a > 0) & (np.abs(X - (x0 + 2)) < 2.1) & (np.abs(Y - 9) < 1.1) & (np.abs(Z - CZ) < 2.1), "gold", 5)  # knee
    # the skirt (fauld) and the chest: octagon frustums
    g.prism("y", flat_ngon(CX, CZ, 5.0, 8), 13, 19, C("steel", 5), top=flat_ngon(CX, CZ, 6.0, 8))
    skirt = last(g)
    g.prism("y", flat_ngon(CX, CZ, 5.0, 8), 19, 24, C("steel", 5), top=flat_ngon(CX, CZ, 7.0, 8))
    chest = last(g)
    g.prism("y", flat_ngon(CX, CZ, 7.0, 8), 24, 30, C("steel", 5), top=flat_ngon(CX, CZ, 5.5, 8))
    chest |= last(g)
    P.flat(g, (skirt | chest) & (np.floor(Y) % 3 == 0) & (Y < 19), "steel", 4)  # skirt lames
    # the tabard: blue front and back panels with a gold trim and a crown
    tab = (skirt | chest) & (np.abs(X - CX) < 5.2) & (Y < 28)
    P.flat(g, tab, "blue", 4)
    P.flat(g, tab & ((np.abs(np.abs(X - CX) - 4.7) < 0.5) | (Y < 14)), "gold", 5)
    glyph(g, "-z", CZ - 7, CX - 4, 21, "crown", "gold", 6, reach=4)
    P.flat(g, chest & (np.abs(Y - 24.5) < 0.6), "darkwood", 4)  # the belt
    # pauldrons: big rounded shoulder plates (true slopes) and hanging gauntlets
    for sx in (-1, 1):
        cx = CX + sx * 8
        pts = [(cx - 4, 24), (cx + 4, 24), (cx + 4.5, 28), (cx + 2, 31), (cx - 2, 31), (cx - 4.5, 28)]
        g.prism("z", pts, CZ - 4, CZ + 4, C("steel", 6))
        pd = last(g)
        P.flat(g, pd & ((Y < 25) | (Y > 30)), "gold", 5)
        P.flat(g, pd & (np.abs(Y - 27.5) < 0.6), "steel", 4)
        steel_box(g, cx - 1.5, 15, CZ - 2, cx + 1.5, 24, CZ + 2, 5)  # arm
        steel_box(g, cx - 2, 12, CZ - 2.5, cx + 2, 16, CZ + 2.5, 4)  # gauntlet
    # the great helm: a big box with a flared top, a visor slit and a gold ridge
    helm = steel_box(g, CX - 4.5, 30, CZ - 4.5, CX + 4.5, 39, CZ + 4.5, 5)
    g.prism("y", flat_ngon(CX, CZ, 4.5, 8), 39, 41, C("steel", 6), top=flat_ngon(CX, CZ, 3.0, 8))
    face = helm & (Z < CZ - 3.5)
    P.flat(g, face & (np.abs(Y - 35.5) < 0.6) & (np.abs(X - CX) < 3.5), "steel", 1)
    P.flat(g, face & (np.abs(X - CX) < 0.6) & (Y < 35), "steel", 2)
    P.flat(g, face & (Y < 34) & (Y > 31) & (np.abs(X - CX) > 1) & (np.abs(X - CX) < 3) & (np.floor(Y) % 2 == 0) & (np.floor(X) % 2 == 0), "steel", 2)
    box(g, CX - 0.5, 39, CZ - 4.5, CX + 0.5, 42, CZ + 4.5, "gold", 5)
    # the plume sweeping back (a true slope)
    g.prism("x", quad((41, CZ - 1), (45, CZ + 6), 1.8, 1.2, cap=1.0), CX - 1, CX + 1, C("red", 5))
    P.flat(g, last(g) & (Y > 43), "red", 6)
    # a red kite shield leaning at its feet
    heater(g, CX + 10, 1, CZ - 9, 9, 13, t=2, field=("red", 4), rim=("gold", 5), lean=-10.0, charge="lion", ink=("gold", 6))
    root = Part("armor-stand", g)
    return Asset(id="fantasy-props-armor-stand", pack="fantasy", category="props", name="Armor Stand", root=root)
