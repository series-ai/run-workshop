"""Alien egg clutch, in the Pirate Nation style.

One chunky icon (rule K3): four leathery purple xeno eggs of different
sizes, each a stack of faceted octagonal frustums (true slopes, F2) with
painted toxic-green veins and paler tops. The biggest egg has split open
into four curled petals (tilted parts, F5) around a glowing green core,
and they all sit in a slick of green resin goo. Detail is paint (S1).
"""
import numpy as np

import paint as P
from _props import ngon_prism
from pnshapes import bar, coords
from voxgrid import C, Asset, Grid, Part


def egg(g: Grid, cx, cz, r, h, y0=1.0, open_top=False) -> np.ndarray:
    """An egg of three octagonal frustums, widest a third of the way up."""
    y1, y2 = y0 + h * 0.35, y0 + h * 0.7
    ngon_prism(g, "y", cx, cz, r * 0.6, y0, y1, "purple", 4, r_top=r)
    ngon_prism(g, "y", cx, cz, r, y1, y2, "purple", 4, r_top=r * 0.85)
    if not open_top:
        ngon_prism(g, "y", cx, cz, r * 0.85, y2, y0 + h, "purple", 4, r_top=r * 0.3)
    X, Y, Z = coords(g)
    m = (g.a > 0) & (np.hypot(X - cx, Z - cz) < r + 1.5) & (Y > y0 - 0.5)
    P.flat(g, m, "purple", 4)
    P.flat(g, m & (Y > y0 + h * 0.6), "purple", 5)
    P.flat(g, m & (Y < y0 + h * 0.2), "purple", 3)
    ang = np.arctan2(Z - cz, X - cx)
    vein = np.abs(((ang / (2 * np.pi) * 5 + (Y - y0) / (h * 1.6)) % 1) - 0.5) < 0.05
    P.flat(g, m & vein, "toxic", 4)
    return m


def clutch() -> Grid:
    g = Grid(28, 20, 26)
    X, Y, Z = coords(g)
    g.prism("y", [(2, 8), (8, 2), (18, 1), (26, 6), (27, 16), (21, 24), (9, 25), (1, 17)], 0, 1, C("toxic", 3))
    goo = g.solids[-1].mask(g.shape)
    P.flat(g, goo & (P._hash(np.floor(X).astype(int) // 2, np.floor(Z).astype(int) // 2, seed=4) % np.uint64(5) == 0), "toxic", 5)
    egg(g, 12, 13, 7.0, 13, open_top=True)
    core = ngon_prism(g, "y", 12, 13, 5.2, 9, 12, "toxic", 5, r_top=3.5)
    P.flat(g, core & (Y > 11), "toxic", 7)
    egg(g, 21.5, 7, 4.0, 11)
    egg(g, 5.5, 7, 3.5, 9)
    egg(g, 22, 18.5, 3.0, 8)
    return g


def petal() -> Grid:
    g = Grid(3, 9, 10)
    bar(g, "x", (1.5, 1.5), (6.5, 7.5), 2.6, 0, 3, "purple", 5)
    X, Y, Z = coords(g)
    P.flat(g, (g.a > 0) & (Y > 5), "purple", 6)
    P.flat(g, (g.a > 0) & (Y < 2), "purple", 4)
    return g


def build() -> Asset:
    root = Part("alien-eggs", clutch())
    for k, ry in enumerate((10.0, 100.0, 190.0, 280.0)):
        root.add(Part(f"petal-{k}", petal(), pivot=(1.5, 1.0, -4.0), at=(12.0, 10.0, 13.0), rot=(0.0, ry, 0.0)))
    return Asset(id="space-props-alien-eggs", pack="space", category="props", name="Alien Egg Clutch", root=root)
