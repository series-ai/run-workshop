"""Alchemist table, in the Pirate Nation haunted style.

A thick planked table on four splayed legs (true diagonals, rule F5) with
a stretcher bar, crowded with oversized glowing potions: a round toxic-
green flask, a tall violet bottle and a square blood-red one, an open
grimoire (two sloped page slabs), a skull with a candle on its crown and
a stone mortar. The labels, bubbles and page lines are paint. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import big_skull, candle, idx, planked, prop, union
from pnkit import box, edges
from voxgrid import C, Grid

TOP = 16  # table top height


def flask(g: Grid, cx, cz, y0, r: float, h: int, neck: int, ramp: str, shade: int, n: int = 8) -> np.ndarray:
    """An n-gon potion bottle: a body, a shoulder frustum, a neck, a cork,
    a painted label band, a glint and bubbles."""
    start = len(g.solids)
    S.disc(g, "y", cx, cz, r, y0, y0 + h, ramp, shade, n=n)
    g.prism("y", S.flat_ngon(cx, cz, r, n), y0 + h, y0 + h + 2, C(ramp, shade), top=S.flat_ngon(cx, cz, max(1.0, r * 0.4), n))
    S.disc(g, "y", cx, cz, max(1.0, r * 0.4), y0 + h + 2, y0 + h + 2 + neck, ramp, min(7, shade + 1), n=n)
    m = union(g, start)
    cork = box(g, cx - 1, y0 + h + 2 + neck, cz - 1, cx + 1, y0 + h + 3 + neck, cz + 1, "wood", 6)
    X, Y, Z = idx(g)
    P.flat(g, m & (Y == y0 + h // 2) | m & (Y == y0 + h // 2 + 1), "bone", 7)
    P.flat(g, m & (Y > y0 + 1) & (Y < y0 + h - 1) & ((P._hash(X, Y, Z, seed=int(cx * 7)) % np.uint64(7)) == 0), ramp, min(7, shade + 2))
    P.flat(g, m & (Y == y0), ramp, max(1, shade - 2))
    return m | cork


def build():
    g = Grid(38, 36, 20)
    X, Y, Z = idx(g)
    x0, x1, z0, z1 = 2, 36, 3, 17
    # splayed legs and a stretcher
    for lx, sx in ((x0 + 2, -1), (x1 - 2, 1)):
        for lz, sz in ((z0 + 2, -1), (z1 - 2, 1)):
            S.bar(g, "z", (lx, TOP), (lx + sx * 1.5, 0.2), 3.2, lz - 1.5, lz + 1.5, "wood", 4)
    st = box(g, x0 + 2, 5, (z0 + z1) / 2 - 1, x1 - 2, 7, (z0 + z1) / 2 + 1, "wood", 4)
    top = box(g, x0, TOP, z0, x1, TOP + 3, z1, "wood", 5)
    planked(g, top, "wood", 5, width=3, across="z", seed=1)
    P.flat(g, top & (Y == TOP), "wood", 3)
    # the potions
    flask(g, 8, 10, TOP + 3, 4.5, 6, 3, "toxic", 5)
    flask(g, 16, 13, TOP + 3, 2.6, 9, 3, "arcane", 4)
    b = box(g, 27, TOP + 3, 10, 32, TOP + 10, 15, "blood", 5)
    P.flat(g, edges(b), "blood", 3)
    box(g, 28.5, TOP + 10, 11.5, 30.5, TOP + 13, 13.5, "blood", 6)
    box(g, 28.5, TOP + 13, 11.5, 30.5, TOP + 14, 13.5, "wood", 6)
    lab = box(g, 27.5, TOP + 5, 9, 31.5, TOP + 8, 10, "bone", 7)
    P.flat(g, lab & (X == 29), "blood", 3)
    # the open grimoire: two sloped page slabs on a purple cover
    cov = box(g, 17, TOP + 3, 4, 27, TOP + 4, 10, "purple", 4)
    P.flat(g, edges(cov), "gold", 4)
    g.prism("z", [(17.5, TOP + 4), (21.8, TOP + 4), (21.8, TOP + 5.5), (17.5, TOP + 6.5)], 4.5, 9.5, C("bone", 7))
    g.prism("z", [(22.2, TOP + 4), (26.5, TOP + 4), (26.5, TOP + 6.5), (22.2, TOP + 5.5)], 4.5, 9.5, C("bone", 7))
    pages = (g.a == C("bone", 7)) & (X >= 17) & (X < 27) & (Z >= 4) & (Z < 10) & (Y >= TOP + 4)
    P.flat(g, pages & (Z % 2 == 0) & (X != 21) & (X != 22), "bone", 5)
    P.flat(g, pages & (Z == 6) & (X < 21), "blood", 4)
    # a skull with a candle on its crown, and a stone mortar
    big_skull(g, 33, TOP + 3, 7, s=6, base=6, eyes=("magenta", 6))
    candle(g, 32, TOP + 3 + 8, 6, h=3, w=2)
    S.cone(g, "y", 5, 5, 2.4, TOP + 3, TOP + 6, "stone", 5, n=8, r_top=3.2)
    P.flat(g, (Y == TOP + 5) & (np.hypot(X + 0.5 - 5, Z + 0.5 - 5) < 2) & (g.a > 0), "stone", 2)
    return prop("potion-table", "Alchemist Table", g)
