"""Cheesemonger's shelf in the Pirate Nation style.

A pale planked case with a dark frame and two open shelves, topped by the
oversized function prop (rule F4): a giant gold cheese wheel with a cut
wedge and a knife. The back board carries a painted gold wheel sign on a
royal-blue field, so the prop reads from every side (rule C3). Red-waxed
rounds, a blue cloth bundle and a crock fill the shelves. About 34 wide
and 35 tall.
"""

import numpy as np

import paint as P
from _props import coords, plank_box
from pnkit import box
from pnshapes import cone, disc, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 34, 36, 18
PX = (2, 29)  # side post x starts (3 thick)
X0, X1 = 5, 29  # shelf span
ZF, ZB = 2, 15  # front and back of the case
TOP = 26  # top slab underside
S1, S2 = 9, 18  # shelf tops


def wheel_cheese(g: Grid, cx: float, cz: float, y0: float, r: float, h: float, wax: str = "red") -> np.ndarray:
    """A cheese round: a gold octagon with a waxed rim band and a lit top."""
    m = disc(g, "y", cx, cz, r, y0, y0 + h, "gold", 6, n=8)
    X, Y, Z = coords(g)
    d = np.hypot(X - cx, Z - cz)
    P.flat(g, m & (d > r - 1.3), wax, 5)
    P.flat(g, m & (Y > y0 + h - 1), "gold", 7)
    P.flat(g, m & (Y < y0 + 1), "gold", 4)
    return m


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi = np.floor(X).astype(int)

    # the back board: cream planks, a blue field and a painted gold wheel
    back = box(g, PX[0], 0, ZB - 3, PX[1] + 3, TOP, ZB, "bone", 6)
    P.planks(g, back, "bone", 6, width=4, across="x", nails=False, grain=False, seed=1)
    outer = back & (Z > ZB - 1.4)  # the rear face carries the shop sign
    P.flat(g, outer, "blue", 3)
    P.outline(g, outer, "gold", 6, normal="z")
    rad = np.hypot(X - 17, Y - 14)
    P.flat(g, outer & (rad < 8.0), "gold", 7)
    P.flat(g, outer & (rad < 8.0) & (rad > 6.4), "red", 5)
    P.flat(g, outer & (rad < 5.0) & (X > 17) & (Y < 14), "bone", 7)  # the cut wedge in the sign
    inner = back & (Z < ZB - 2.4)
    P.flat(g, inner, "bone", 7)  # a pale wall so the goods read in the shade
    P.flat(g, inner & (Y > S1 + 1) & (Y < S1 + 4), "blue", 4)
    P.flat(g, inner & (Y > S2 + 1) & (Y < S2 + 4), "red", 5)

    # side posts, a plinth, two shelves and an overhanging top slab
    for px in PX:
        post = box(g, px, 0, ZF, px + 3, TOP, ZB, "wood", 6)
        P.planks(g, post, "wood", 6, width=3, across="x", frame="x", nails=False, seed=px)
        P.outline(g, post, "darkwood", 3, normal="x")
    plinth = box(g, PX[0], 0, ZF - 1, PX[1] + 3, 3, ZB, "darkwood", 4)
    P.planks(g, plinth, "darkwood", 4, width=3, across="y", frame="z", nails=True, seed=2)
    for sy in (S1, S2):
        plank_box(g, X0, sy - 2, ZF - 1, X1, sy, ZB - 3, "wood", 7, across="y", width=4, seed=sy)
    slab = plank_box(g, PX[0] - 1, TOP, ZF - 2, PX[1] + 4, TOP + 2, ZB + 1, "wood", 7, across="y", width=5, seed=3)
    P.flat(g, slab & (Y < TOP + 1), "darkwood", 3)

    # the giant cheese wheel on the slab, a cut wedge and a knife
    big = wheel_cheese(g, 15, 8, TOP + 2, 7.5, 7, wax="red")
    d = np.hypot(X - 15, Z - 8)
    cut = big & (X > 15) & (Z < 8) & (d < 7.6)
    g.carve(cut)
    face = big & ~cut & (d < 7.0) & ((np.abs(X - 15) < 1.0) | (np.abs(Z - 8) < 1.0))
    P.flat(g, face, "gold", 7)  # the pale cut faces
    P.flat(g, big & ~cut & (Y > TOP + 7) & (d < 4.0) & (np.floor(X).astype(int) % 5 == 0), "gold", 5)  # rind marks
    g.prism("y", [(24, 3), (30, 3), (27, 9)], TOP + 2, TOP + 7, C("gold", 7))  # the cut wedge
    wedge = last(g)
    P.flat(g, wedge & (Z < 4), "red", 5)
    P.flat(g, wedge & (Y > TOP + 6), "gold", 6)
    blade = box(g, 19, TOP + 2, 12, 29, TOP + 3, 14, "steel", 6)
    P.flat(g, blade & (X < 22), "darkwood", 3)  # the handle
    P.flat(g, blade & (X > 22) & (Z > 12.6), "steel", 7)

    # the upper shelf: a red-waxed drum, a half wheel and a crock
    drum = cone(g, "y", 9, 7, 3.4, S2, S2 + 7, "red", 5, n=8, r_top=3.0)
    P.flat(g, drum & (Y > S2 + 6), "gold", 7)
    P.flat(g, drum & ((np.floor(Y).astype(int) - S2) % 3 == 0), "red", 4)
    half = wheel_cheese(g, 22, 7, S2, 4.2, 4, wax="leaf")
    P.flat(g, half & (X > 22) & (np.abs(Z - 7) < 4.5), "gold", 7)
    crock = cone(g, "y", 27, 7, 2.4, S2, S2 + 5, "cyan", 4, n=6, r_top=1.9)
    P.flat(g, crock & (Y > S2 + 4), "bone", 6)

    # the lower shelf: two stacked rounds and a cloth bundle
    wheel_cheese(g, 11, 7, S1, 4.6, 4, wax="red")
    wheel_cheese(g, 11, 7, S1 + 4, 3.8, 3, wax="red")
    bundle = cone(g, "y", 23, 7, 4.2, S1, S1 + 6, "blue", 4, n=6, r_top=1.6)
    P.flat(g, bundle & (Y > S1 + 4), "blue", 5)
    P.flat(g, bundle & (Y < S1 + 1), "blue", 3)
    P.flat(g, bundle & (Y > S1 + 5), "bone", 7)  # the knotted cloth top
    P.flat(g, bundle & (np.floor(Z).astype(int) % 4 == 0) & (Y < S1 + 4), "blue", 5)

    # on the plinth: a stacked pair of rounds and a loose wedge, well lit
    wheel_cheese(g, 9, 7, 3, 4.0, 4, wax="rust")
    wheel_cheese(g, 9, 7, 7, 3.2, 2, wax="rust")
    g.prism("y", [(18, 3), (26, 3), (22, 10)], 3, 8, C("gold", 7))
    loose = last(g)
    P.flat(g, loose & (Z < 4), "red", 5)
    P.flat(g, loose & (Y > 7), "gold", 6)
    cloth = box(g, 15, 3, ZF + 7, 28, 5, ZB - 3, "blue", 4)
    P.flat(g, cloth & (Y > 4), "blue", 5)
    P.outline(g, cloth, "bone", 6, normal="y")

    root = Part("cheese-shelf", g)
    return Asset(id="fantasy-props-cheese-shelf", pack="fantasy", category="props", name="Cheese Shelf", root=root)
