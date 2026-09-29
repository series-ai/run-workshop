"""Hazard barrier, in the Pirate Nation mecha style.

One iconic shape (rule K3): a heavy road block board with bold orange and
white hazard stripes, on two steel A-frame feet (true slopes, F2). A big red
no-entry disc sits in the middle, an oversized amber warning lamp stands on
the left end and a copper plasma-fence emitter coil with a cyan glow on the
right end. The board sags a little to one side (F5). Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint
from _props import lamp, ngon_prism
from pnkit import box, edges
from pnshapes import coords
from voxgrid import C, Asset, Grid, Part

W, D = 34, 12
BY0, BY1 = 7, 15  # the board
BZ0, BZ1 = 4, 8


def feet(g: Grid) -> None:
    X, Y, Z = coords(g)
    for x0 in (4, W - 8):
        g.prism("x", [(0, 0), (0, D), (2, D - 1), (BY1 - 1, BZ1), (BY1 - 1, BZ0), (2, 1)], x0, x0 + 4, C("steel", 4))
        f = g.solids[-1].mask(g.shape)
        P.flat(g, f, "steel", 4)
        P.flat(g, f & (Y < 1), "steel", 3)
        P.flat(g, f & ((X < x0 + 1) | (X > x0 + 3)), "steel", 3)
        P.flat(g, f & (Y < 2) & ((Z < 1.5) | (Z > D - 1.5)), "iron", 5)  # rubber pads


def board() -> Grid:
    """The striped board (y 2..10, z 1..5) with a big no-entry disc standing
    proud of its front face and overlapping its edges (rule F4)."""
    g = Grid(W, BY1 - BY0 + 4, BZ1 - BZ0 + 1)
    X, Y, Z = coords(g)
    b = box(g, 0, 2, 1, W, BY1 - BY0 + 2, BZ1 - BZ0 + 1, "bone", 6)
    pnpaint.hazard(g, b, period=6, a=("orange", 5), b=("bone", 6))
    P.flat(g, edges(b), "steel", 4)
    P.flat(g, b & ((X < 1) | (X > W - 1)), "steel", 4)
    disc = ngon_prism(g, "z", W / 2, 6.0, 5.5, 0, 1, "red", 4)
    rr = np.hypot(X - W / 2, Y - 6.0)
    P.flat(g, disc & (rr > 4.6), "bone", 7)
    P.flat(g, disc & (np.abs(Y - 6.0) < 1.1) & (np.abs(X - W / 2) < 3.1), "bone", 7)
    return g


def build() -> Asset:
    g = Grid(W, BY1 + 1, D)
    feet(g)
    root = Part("hazard-barrier", g)
    root.add(Part("board", board(), pivot=(W / 2, 2.0, 3.0), at=(W / 2, float(BY0), 6.0), rot=(0.0, 0.0, -2.0)))
    top = Grid(W, 10, 8)
    lamp(top, 4.0, 0, 4.0, r=2.8, h=5, glass=("gold", 6), cap=("steel", 3))
    box(top, 1, 0, 2, 7, 1, 6, "steel", 4)
    coil = ngon_prism(top, "y", W - 4.0, 4.0, 2.2, 0, 7, "rust", 4)
    Xc, Yc, Zc = coords(top)
    P.flat(top, coil & (np.floor(Yc) % 2 == 0), "rust", 6)
    orb = ngon_prism(top, "y", W - 4.0, 4.0, 1.6, 7, 9, "cyan", 6, r_top=0.8)
    root.add(Part("top", top, pivot=(W / 2, 0.0, 4.0), at=(W / 2, float(BY1), 6.0), rot=(0.0, 0.0, -2.0)))
    return Asset(id="space-props-hazard-barrier", pack="space", category="props", name="Hazard Barrier", root=root)
