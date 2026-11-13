"""Power cell crate, in the Pirate Nation mecha style.

One chunky icon (rule K3): an open steel ammo crate packed with six big
glowing cyan battery cells (hexagonal, true facets). Hazard-orange trim
and thick copper handles on the ends; the lid leans on the +x side at an
angle (F5) and one cell has tipped out onto the ground in front. Detail is
paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint
from _props import hull, ngon_prism
from pnkit import box, edges
from pnshapes import coords
from voxgrid import Asset, Grid, Part

W, D = 24, 18
X0, X1, Z0, Z1 = 2, 22, 3, 17  # crate outer
HT = 9  # wall height
T = 2  # wall thickness


def cell(g: Grid, cx, cz, y0, h, glow="cyan") -> np.ndarray:
    """An upright hexagonal battery cell: steel ends, a glowing core with a
    bright charge band, and a copper terminal."""
    m = ngon_prism(g, "y", cx, cz, 2.2, y0, y0 + h, "steel", 4, n=6)
    _X, Y, _Z = coords(g)
    P.flat(g, m & (Y > y0 + 1.2) & (Y < y0 + h - 1.2), glow, 4)
    P.flat(g, m & (Y > y0 + h - 4.2) & (Y < y0 + h - 1.2), glow, 5)
    P.flat(g, m & (np.abs(Y - (y0 + h - 5.5)) < 0.6), glow, 7)
    P.flat(g, m & (Y > y0 + h - 1), "steel", 5)
    m |= ngon_prism(g, "y", cx, cz, 1.0, y0 + h, y0 + h + 1, "rust", 5, n=6)
    return m


def crate() -> Grid:
    g = Grid(W, 18, D)
    X, Y, Z = coords(g)
    floor = box(g, X0, 0, Z0, X1, 2, Z1, "steel", 3)
    walls = box(g, X0, 0, Z0, X1, HT, Z0 + T, "steel", 4) | box(g, X0, 0, Z1 - T, X1, HT, Z1, "steel", 4)
    walls |= box(g, X0, 0, Z0, X0 + T, HT, Z1, "steel", 4) | box(g, X1 - T, 0, Z0, X1, HT, Z1, "steel", 4)
    hull(g, walls, "steel", 5, size=(10, 9), edge=0, seed=3)
    P.flat(g, floor, "steel", 2)
    # hazard trim along the rim, dark edges, a stencil band
    pnpaint.hazard(g, walls & (Y > HT - 2), period=4, a=("orange", 5), b=("iron", 5))
    P.flat(g, walls & (Y < 1), "steel", 2)
    P.flat(g, walls & (Z < Z0 + 1) & (Y > 2.5) & (Y < 5.5) & (np.abs(X - 12) < 5), "cyan", 3)
    P.flat(g, walls & (Z < Z0 + 1) & (np.abs(Y - 4) < 0.6) & (np.abs(X - 12) < 4) & (np.floor(X) % 2 == 0), "cyan", 7)
    # copper carry handles on both ends
    for x0, x1 in ((0, X0), (X1, W)):
        h = box(g, x0, 4, 7, x1, 6, 13, "rust", 4)
        P.flat(g, h & (Y > 5), "rust", 6)
    # six cells in two rows
    for k, (cx, cz) in enumerate(((6.5, 7.5), (12, 7.5), (17.5, 7.5), (6.5, 12.5), (12, 12.5), (17.5, 12.5))):
        cell(g, cx, cz, 2, 13 if k % 3 != 1 else 14, glow="cyan" if k != 4 else "toxic")
    return g


def lid() -> Grid:
    g = Grid(3, 12, 15)
    m = box(g, 0, 0, 0, 3, 12, 15, "steel", 4)
    hull(g, m, "steel", 4, size=(7, 6), seed=6)
    pnpaint.hazard(g, m & (coords(g)[1] < 2), period=4, a=("orange", 5), b=("iron", 5))
    return g


def loose_cell() -> Grid:
    g = Grid(6, 15, 6)
    cell(g, 3.0, 3.0, 0, 13)
    return g


def build() -> Asset:
    root = Part("power-cell-crate", crate())
    root.add(Part("lid", lid(), pivot=(0.0, 0.0, 7.5), at=(X1 + 1.0, 0.0, 10.0), rot=(0.0, 0.0, -18.0)))
    root.add(Part("loose-cell", loose_cell(), pivot=(3.0, 3.0, 3.0), at=(11.0, 2.55, 0.0), rot=(0.0, 20.0, 90.0)))
    return Asset(id="space-props-power-cell-crate", pack="space", category="props", name="Power Cell Crate", root=root)
