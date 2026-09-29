"""Pumpkin patch, in the Pirate Nation haunted style.

After PN decorations-pumpkin01a–03b: three PN rib pumpkins (a big one, a
middle one and a small one) on a raised soil bed with true sloped sides,
joined by green vines with flat leaves. A leaning wooden marker says BOO
and a pitchfork stands stuck in the soil (true diagonals). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import grave, idx, prop, tufts
from pnkit import box
from voxgrid import C, Grid


def leaf(g: Grid, x, y, z, a: float, s: float = 3.0) -> None:
    """A flat diamond leaf lying on the soil, turned `a` degrees."""
    pts = [(-s, 0), (0, -s * 0.6), (s, 0), (0, s * 0.6)]
    pts = S.rotate([(x + u, z + v) for u, v in pts], x, z, a)
    g.prism("y", pts, y, y + 1, C("forest", 6))
    m = S.last(g)
    Xc, Yc, Zc = S.coords(g)
    P.flat(g, m & (np.abs((Xc - x) * math.sin(math.radians(a)) - (Zc - z) * math.cos(math.radians(a))) < 0.6), "forest", 4)


def build():
    g = Grid(38, 38, 28)
    X, Y, Z = idx(g)
    grave(g, 1, 3, 37, 27, h=3, inset=2, ramp="wood", base=3, moss=0.03, seed=1)
    # vines and leaves first, so the pumpkins sit over them
    S.bar(g, "y", (8, 12), (20, 18), 1.4, 3, 4, "forest", 5)
    S.bar(g, "y", (20, 18), (29, 10), 1.4, 3, 4, "forest", 5)
    S.bar(g, "y", (29, 10), (33, 20), 1.2, 3, 4, "forest", 5)
    for lx, lz, la in ((13, 16, 20), (24, 13, -35), (31, 16, 70), (6, 20, 120), (17, 22, 10)):
        leaf(g, lx, 3, lz, la)
    S.pumpkin(g, 11, 3, 11, w=16, h=12, ramp="orange", base=4, seed=2)
    S.pumpkin(g, 27, 3, 17, w=12, h=9, ramp="orange", base=3, seed=3)
    S.pumpkin(g, 25, 3, 7, w=8, h=6, ramp="orange", base=5, seed=4)
    # the leaning BOO marker
    tw, th = pnglyph.text_size("BOO")
    start = len(g.solids)
    g.prism("z", S.rotate([(6, 3), (8, 3), (8, 22), (6, 22)], 7, 3, 4), 22, 24, C("wood", 5))
    g.prism("z", [(3, 14), (tw + 6, 14), (tw + 6, 23), (3, 23)], 20, 22, C("wood", 6))
    sign = S.last(g)
    P.planks(g, sign, "wood", 6, width=3, across="y", nails=True, frame="z")
    P.outline(g, sign, "wood", 3, normal="z")
    pnglyph.text(g, "-z", 20, 5, 15, "BOO", "red", 3)
    # the pitchfork stuck in the soil, leaning back
    S.bar(g, "x", (1, 21), (32, 24), 1.8, 33, 35, "wood", 6)
    box(g, 32.5, 31, 22, 35.5, 32.5, 27, "iron", 6)
    for tz in (22.5, 24.5, 26.5):
        box(g, 33.5, 32, tz - 0.5, 34.5, 37, tz + 0.5, "iron", 7)
    tufts(g, [(3, 5), (35, 4), (2, 25)], y0=3)
    return prop("pumpkin-patch", "Pumpkin Patch", g)
