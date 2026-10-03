"""Military ammo crate, in the Pirate Nation style.

One chunky icon (rule K3): an olive plank crate with a hazard-yellow band,
a big 12GA stencil, steel latches and rope handles. Its lid stands ajar
on the back hinge (a rest rotation, rule F5), so the red shotgun shells
packed inside show on the top face. Two loose shells lie in front. Planks,
stencils and the shells are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
from _props import asset, child, root
from pnkit import box, edges
from pnshapes import coords, disc
from voxgrid import Grid

W, H, D = 26, 12, 14


def body() -> Grid:
    g = Grid(W + 2, H + 1, D + 6)
    X, Y, Z = coords(g)
    z0 = 4
    m = box(g, 1, 0, z0, W + 1, H, z0 + D, "khaki", 5)
    P.planks(g, m, "khaki", 5, width=4, across="y", seed=1)
    P.flat(g, edges(m), "khaki", 3)
    P.flat(g, m & (Y > 8) & (Y < 10) & ~edges(m), "gold", 5)  # the yellow band
    tw, _ = pnglyph.text_size("12GA")
    pnglyph.text(g, "-z", z0, 1 + W // 2 - tw // 2, 1, "12GA", "bone", 7)
    # shells packed inside: the top face, in rows of red cases with brass heads
    top = m & (Y > H - 1) & ~edges(m)
    P.flat(g, top, "khaki", 2)
    shell = top & (np.floor(X) % 3 != 0) & (np.floor(Z) % 3 != 0)
    P.flat(g, shell, "red", 5)
    P.flat(g, shell & (np.floor(X) % 3 == 1) & (np.floor(Z) % 3 == 1), "gold", 6)
    # steel latches on the front, rope handles on the ends
    for lx in (6, W - 5):
        box(g, lx, H - 4, z0 - 1, lx + 2, H, z0, "steel", 6)
    for hx in (0, W + 1):
        box(g, hx, 6, z0 + 4, hx + 1, 8, z0 + D - 4, "sand", 6)
    # two loose shells in front
    for k, sx in enumerate((8, 12)):
        s = disc(g, "x", 1.0, 1.0 + k * 1.5, 1.0, sx, sx + 4, "red", 5)
        P.flat(g, s & (X < sx + 1.2), "gold", 6)
    return g


def lid() -> Grid:
    g = Grid(W + 2, 3, D + 1)
    m = box(g, 0, 0, 0, W + 2, 2, D + 1, "khaki", 5)
    P.planks(g, m, "khaki", 5, width=4, across="x", seed=2, frame="top")
    P.flat(g, edges(m), "khaki", 3)
    pnglyph.icon(g, "top", 2, W // 2 - 3, 3, "star", "bone", 6)
    return g


def build():
    g = body()
    r = root("ammo-crate", g)
    # the lid is hinged on the back top edge and stands 38° open
    child(r, "lid", lid(), pivot=(0.0, 0.0, D + 1.0), at_grid=(0.0, H, 4 + D + 0.5), rot=(38.0, 0.0, 0.0))
    return asset("ammo-crate", "Ammo Crate", r)
