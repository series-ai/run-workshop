"""Dungeon crates, in the Pirate Nation haunted style.

Two chunky crates side by side and a third stacked on top, turned a little
(rule F5). Planked sides with a dark frame on every edge and iron bands
(paint), a bone-white skull stencil on the front, a toxic-green potion on
the top crate and a small keg on the floor beside them. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import idx, prop
from pnkit import box, crate, edges
from voxgrid import C, Grid, Part

S_ = 14  # crate size


def band(g: Grid, m: np.ndarray, y0: int, y1: int) -> None:
    X, Y, Z = idx(g)
    P.flat(g, m & ~edges(m) & ((Y == y0 + 3) | (Y == y1 - 4)), "iron", 6)


def build():
    g = Grid(40, 30, 18)
    X, Y, Z = idx(g)
    z0 = 2
    a = crate(g, 1, 0, z0, S_, ramp="wood", frame="darkwood", base=5, seed=1)
    b = crate(g, S_ + 2, 0, z0 + 1, S_, ramp="wood", frame="darkwood", base=4, seed=2)
    P.flat(g, edges(a) | edges(b), "darkwood", 6)
    band(g, a, 0, S_)
    band(g, b, 0, S_)
    sk = ["..#####..", ".#######.", "#########", "#oo###oo#", "#oo###oo#", "####o####", ".#######.", "..#.#.#.."]
    pnglyph.stamp(g, "-z", z0, 3, 3, sk, {"#": C("bone", 7), "o": C("wood", 3)})
    pnglyph.text(g, "-z", z0 + 1, S_ + 4, 5, "XXX", "red", 4)
    # the keg beside them
    S.drum(g, 34.5, z0 + 7, 0, 10, 4.0, ramp="wood", base=5, hoop="iron", band=("red", 4), wear=False)
    # the top crate, turned a little
    t = Grid(14, 20, 14)
    tm = crate(t, 1, 0, 1, 12, ramp="wood", frame="darkwood", base=5, seed=3)
    P.flat(t, edges(tm), "darkwood", 6)
    band(t, tm, 0, 12)
    pnglyph.icon(t, "-z", 1, 3, 2, "drop", "toxic", 5)
    # a toxic potion standing on it: an octagon flask with a cork
    S.disc(t, "y", 8.5, 8.5, 2.5, 12, 16, "toxic", 5)
    S.disc(t, "y", 8.5, 8.5, 1.2, 16, 18, "toxic", 6)
    box(t, 8, 18, 8, 9.5, 19, 9.5, "wood", 6)
    root = prop("dungeon-crate", "Dungeon Crates", g)
    piv = root.root.pivot
    top = Part("top-crate", t, pivot=(7.0, 0.0, 7.0), at=(12 - piv[0], S_ - piv[1], z0 + 8 - piv[2]), rot=(0.0, 12.0, 0.0))
    root.root.add(top)
    return root
