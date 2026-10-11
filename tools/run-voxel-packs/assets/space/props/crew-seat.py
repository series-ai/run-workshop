"""Pilot seat, in the Pirate Nation mecha style.

One chunky icon (rule K3): a big padded red flight chair on an octagonal
steel swivel column and a tapered foot (true slopes, F2). The back leans
back (a rotated part, F5) and carries a padded headrest; orange harness
straps and the cushion seams are painted (S1). Two white armrests hold a
gold-knobbed joystick and a glowing teal arm display. Faces -Z.
"""
import numpy as np

import paint as P
from _props import cham_prism, dots, hull, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, D = 22, 20
CX, CZ = 11.0, 10.0
YS = 12  # seat top


def cushion(g: Grid, mask: np.ndarray, seam_axis: int, lo: float, hi: float, step: float) -> None:
    """Red padding with dark tuck seams every `step` across one axis."""
    c = coords(g)[seam_axis]
    P.flat(g, mask, "red", 4)
    for k in np.arange(lo + step, hi - 0.5, step):
        P.flat(g, mask & (np.abs(c - k) < 0.5), "red", 3)


def base() -> Grid:
    g = Grid(W, YS + 6, D)
    X, Y, Z = coords(g)
    foot = cham_prism(g, "y", CX - 8, CZ - 8, CX + 8, CZ + 8, 5, 0, 3, "steel", 4, inset=3)
    for m, fr in facets(g):
        P.plates(g, m, "steel", 5, size=(6, 4), rivets=False, frame=fr)
    col = ngon_prism(g, "y", CX, CZ, 2.5, 3, 8, "steel", 5)
    P.flat(g, col & (np.floor(Y) % 2 == 0), "steel", 6)
    P.flat(g, col, "steel", 5)
    P.flat(g, col & (np.abs(Y - 5.5) < 0.6), "orange", 5)
    pan = box(g, 3, 8, 3, W - 3, 10, D - 3, "steel", 4)
    P.flat(g, edges(pan), "steel", 3)
    seat = cham_prism(g, "y", 3, 2, W - 3, D - 3, 2.5, 10, YS + 1, "red", 4, inset=0.8)
    cushion(g, seat, 0, 3, W - 3, 4)
    P.flat(g, seat & (Y > YS) & (np.abs(X - CX) < 1.6), "orange", 5)  # the crotch strap
    # armrests with a joystick and an arm display
    for x0 in (1, W - 4):
        post = box(g, x0 + 1, 8, 12, x0 + 2, YS + 3, 14, "steel", 4)
        arm = box(g, x0, YS + 3, 4, x0 + 3, YS + 5 - 1 + 1, 16, "bone", 5)
        P.flat(g, edges(arm), "bone", 3)
    disp = (X > 1) & (X < 3) & (Y > YS + 4) & (Z > 7) & (Z < 13) & (g.a > 0)
    P.flat(g, disp, "cyan", 6)
    P.flat(g, disp & (np.floor(Z) % 2 == 0), "cyan", 4)
    return g


def stick() -> Grid:
    g = Grid(3, 6, 3)
    box(g, 1, 0, 1, 2, 4, 2, "iron", 5)
    k = box(g, 0, 3, 0, 3, 6, 3, "gold", 5)
    P.flat(g, k & (coords(g)[1] > 5), "gold", 7)
    P.flat(g, k & (coords(g)[2] < 1) & (coords(g)[1] > 4), "red", 5)
    return g


def back() -> Grid:
    """The seat back and headrest (grid origin at the hinge, bottom rear)."""
    g = Grid(W - 4, 24, 5)
    X, Y, Z = coords(g)
    shell = box(g, 0, 0, 2, W - 4, 16, 5, "steel", 5)
    hull(g, shell, "steel", 5, size=(9, 8), seed=3)
    pad = cham_prism(g, "z", 1, 0, W - 5, 15, 2, 0, 2, "red", 4, inset=0.0)
    cushion(g, pad, 1, 0, 15, 5)
    # two harness straps over the shoulders
    for xx in (4.5, W - 8.5):
        P.flat(g, pad & (np.abs(X - xx) < 1.2) & (Z < 1), "orange", 5)
        P.flat(g, pad & (np.abs(X - xx) < 1.2) & (Z < 1) & (np.abs(Y - 7.5) < 1.1), "steel", 6)  # buckles
    head = cham_prism(g, "z", 4, 17, W - 8, 24, 2, 0, 5, "red", 4)
    cushion(g, head, 1, 17, 24, 10)
    P.flat(g, head & (Z > 4), "steel", 4)
    for xx in (6, W - 10):
        box(g, xx, 15, 2, xx + 2, 17, 4, "steel", 5)
    dots(g, shell & (Z > 4), "+z", [(9, 10)], 3, "orange", 5)
    return g


def build() -> Asset:
    root = Part("crew-seat", base())
    root.add(Part("back", back(), pivot=(0.0, 0.0, 5.0), at=(2.0, float(YS - 1), float(D - 2)), rot=(-12.0, 0.0, 0.0)))
    root.add(Part("joystick", stick(), pivot=(1.5, 0.0, 1.5), at=(W - 2.5, float(YS + 5), 6.5), rot=(-10.0, 0.0, -6.0)))
    return Asset(id="space-props-crew-seat", pack="space", category="props", name="Pilot Seat", root=root)
