"""Wizard's bookcase in the Pirate Nation style.

A tall chunky darkwood case (person-sized) with a steep tiled crest (true
slopes) and four shelves of big book spines in many colours with gold
bands; one book leans and one lies flat (rule F5). A glowing cyan crystal
ball on a gold stand and a candle sit on top (rule C3: the magic accent).
Detail is paint (rule S1). About 28 wide and 44 tall.
"""

import numpy as np

import paint as P
from _props import book, candle, coords, plank_box
from pnkit import box
from pnshapes import flat_ngon, last, rotate
from voxgrid import C, Asset, Grid, Part

W, H, D = 32, 50, 14
X0, X1, Z0, Z1 = 2, 30, 2, 12
SHELVES = (3, 12, 20, 28)
TOP = 36
COVERS = [("red", 4), ("blue", 4), ("leaf", 3), ("gold", 5), ("magenta", 4), ("orange", 4), ("sky", 4), ("red", 3), ("forest", 4), ("darkwood", 5)]


def spines(g: Grid, sy: int, top: int, seed: int) -> None:
    rng = np.random.default_rng(seed)
    x = X0 + 3
    k = seed
    while x < X1 - 5:
        w = int(rng.integers(2, 4))
        h = int(rng.integers(max(4, top - sy - 4), top - sy))
        ramp, shade = COVERS[k % len(COVERS)]
        b = box(g, x, sy, Z0 + 2, x + w, sy + h, Z1 - 2, ramp, shade)
        _X, Y, Z = coords(g)
        P.flat(g, b & ((np.abs(Y - (sy + 1.5)) < 0.5) | (np.abs(Y - (sy + h - 1.5)) < 0.5)), "gold", 6)
        P.flat(g, b & (Z > Z0 + 3) & (Y > sy + h - 1), "bone", 6)  # page tops
        x += w
        k += 3
        if rng.random() < 0.15:
            x += 1


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    back = box(g, X0, 0, Z1 - 2, X1, TOP, Z1, "darkwood", 6)
    P.planks(g, back, "darkwood", 6, width=4, across="x", nails=False, seed=1)
    for sx in (X0, X1 - 3):
        plank_box(g, sx, 0, Z0, sx + 3, TOP, Z1, "darkwood", 5, across="x", width=3, seed=sx)
    for k, sy in enumerate(SHELVES):
        plank_box(g, X0 + 3, sy - 2, Z0, X1 - 3, sy, Z1 - 2, "wood", 5, across="y", width=2, seed=10 + k)
    plank_box(g, X0 - 1, TOP, Z0 - 1, X1 + 1, TOP + 2, Z1, "darkwood", 4, across="y", width=2, seed=5)
    tops = list(SHELVES[1:]) + [TOP]
    for k, (sy, top) in enumerate(zip(SHELVES, tops)):
        spines(g, sy, top - 2, seed=k * 7 + 1)
    # a leaning book at the end of the second shelf and a flat pile on the third
    pts = rotate([(X1 - 7, SHELVES[1]), (X1 - 4, SHELVES[1]), (X1 - 4, SHELVES[1] + 7), (X1 - 7, SHELVES[1] + 7)], X1 - 4, SHELVES[1], -18)
    g.prism("z", pts, Z0 + 2, Z1 - 2, C("blue", 4))
    lb = last(g)
    P.flat(g, lb & (Z < Z0 + 3), "blue", 5)
    book(g, X1 - 8, SHELVES[2], Z0 + 2, X1 - 3, SHELVES[2] + 2, Z1 - 3, "red", 4)
    book(g, X1 - 7, SHELVES[2] + 2, Z0 + 3, X1 - 3, SHELVES[2] + 4, Z1 - 3, "leaf", 3)
    # the crystal ball on a gold stand, and a candle
    cx, cz = 10, 7
    box(g, cx - 2, TOP + 2, cz - 2, cx + 2, TOP + 4, cz + 2, "gold", 5)
    g.prism("y", flat_ngon(cx, cz, 2.2, 8), TOP + 4, TOP + 6.5, C("cyan", 5), top=flat_ngon(cx, cz, 3.4, 8))
    ball = last(g)
    g.prism("y", flat_ngon(cx, cz, 3.4, 8), TOP + 6.5, TOP + 9, C("cyan", 5), top=flat_ngon(cx, cz, 1.8, 8))
    ball |= last(g)
    P.flat(g, ball & (X < cx - 1) & (Y > TOP + 6), "cyan", 7)
    P.flat(g, ball & (Y < TOP + 5), "cyan", 4)
    candle(g, 22, TOP + 2, 6, h=4, w=2)
    root = Part("bookshelf", g)
    return Asset(id="fantasy-props-bookshelf", pack="fantasy", category="props", name="Wizard's Bookcase", root=root)
