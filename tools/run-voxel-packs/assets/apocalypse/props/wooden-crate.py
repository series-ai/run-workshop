"""Stack of salvage crates, in the Pirate Nation style.

Three chunky crates (rule K3): a one-tile (16) plank crate with a true
diagonal brace and a painted skull warning, a smaller crate in front of it
with a red-cross patch, and a khaki MRE crate on top, turned a little (rule
F5). A red pry bar leans on the stack; loose straw lies at the base.
Planks, nails, frames and stencils are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
from _props import asset, child, crate, root, tuft
from pnkit import box, edges
from pnshapes import bar, coords
from voxgrid import Grid

BX, BZ = 15, 7  # big crate corner


def big_crate(g: Grid) -> None:
    m = crate(g, BX, 0, BZ, 16, 16, 16, "sand", 5, seed=1)
    # a diagonal brace on the front: a true slope, 1 voxel proud
    b = bar(g, "z", (BX + 2.5, 2.5), (BX + 13.5, 13.5), 2.6, BZ - 1, BZ, "rust", 4)
    P.planks(g, b, "rust", 4, width=3, across="y", nails=True, seed=2)
    # a skull warning on the +x side (seen in the front and side views)
    X, Y, Z = coords(g)
    patch = m & (X > BX + 15) & (np.abs(Y - 8) < 6) & (np.abs(Z - BZ - 8) < 6.5)
    P.flat(g, patch, "bone", 6)
    P.outline(g, patch, "red", 4, normal="x")
    iw, ih = pnglyph.icon_size("skull")
    pnglyph.icon(g, "+x", BX + 16, int(BZ + 8 - iw / 2 + 0.5), int(8 - ih / 2 + 0.5), "skull", "red", 4)


def small_crate(g: Grid, x0, z0) -> None:
    m = crate(g, x0, 0, z0, 11, 11, 11, "sand", 6, seed=3)
    X, Y, Z = coords(g)
    patch = m & (Z < z0 + 1) & (np.abs(X - x0 - 5.5) < 4.2) & (np.abs(Y - 5.5) < 4.7)
    P.flat(g, patch, "bone", 7)
    iw, ih = pnglyph.icon_size("cross")
    pnglyph.icon(g, "-z", z0, int(x0 + 5.5 - iw / 2 + 0.5), int(5.5 - ih / 2 + 0.5), "cross", "red", 4)


def mre_crate() -> Grid:
    g = Grid(18, 8, 12)
    m = box(g, 0, 0, 0, 18, 8, 12, "khaki", 5)
    P.planks(g, m, "khaki", 5, width=4, across="y", seed=4)
    P.flat(g, edges(m), "khaki", 3)
    tw, _th = pnglyph.text_size("MRE")
    pnglyph.text(g, "-z", 0, 9 - tw // 2, 1, "MRE", "bone", 7)
    X, Y, Z = coords(g)
    for x in (0, 17):  # rope handles on the ends
        P.flat(g, m & (np.floor(X) == x) & (np.abs(Y - 5) < 1) & (np.abs(Z - 6) < 2.5), "sand", 6)
    return g


def pry_bar() -> Grid:
    g = Grid(3, 20, 12)
    m = bar(g, "x", (0.8, 2.5), (18.5, 9.0), 1.8, 0, 3, "red", 5)  # (y, z): leans back onto the crate
    P.flat(g, m & (coords(g)[1] > 16), "steel", 5)
    hook = bar(g, "x", (0.9, 2.2), (3.2, 1.2), 1.6, 0, 3, "steel", 5)
    P.flat(g, hook, "steel", 5)
    return g


def build():
    g = Grid(34, 18, 26)
    big_crate(g)
    small_crate(g, 3, 3)
    for x, z, k in ((1, 16, 0), (31, 5, 1), (13, 2, 2), (27, 23, 3)):
        tuft(g, x, z, 0, ramp="gold", seed=k)
    r = root("wooden-crate", g)
    child(r, "mre-crate", mre_crate(), pivot=(9.0, 0.0, 6.0), at_grid=(BX + 7, 16, BZ + 8), rot=(0.0, 14.0, 0.0))
    child(r, "pry-bar", pry_bar(), pivot=(1.5, 0.0, 2.5), at_grid=(BX + 12, 0, BZ - 7.5), rot=(0.0, 0.0, -6.0))
    return asset("wooden-crate", "Salvage Crates", r)
