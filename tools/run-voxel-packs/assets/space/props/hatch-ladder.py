"""Hatch access ladder, in the Pirate Nation mecha style.

One iconic shape (rule K3): a white hull bulkhead panel with a pressure
hatch at the top and a ladder bolted to it, so every part is carried by the
same plate and nothing floats. Two thick steel stiles (F3) hold wide copper
rungs; an oversized hazard-orange lever sits on a visible steel bracket
beside the hatch (F4); a copper band, a hazard kickplate and a cyan light
strip carry the theme (C1, C3). Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _props import dots, hull, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 22, 46, 12
Z0, Z1 = 6, 12  # the wall plate
HY = 34  # the hatch centre
SX = (4, 16)  # the two stiles


def ladder() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # The bulkhead plate: white hull in a dark steel frame.
    plate = box(g, 0, 0, Z0, W, H, Z1, "bone", 6)
    hull(g, plate, "bone", 6, size=(8, 8), edge=3, seed=12)
    P.flat(g, edges(plate), "steel", 2)
    for x0 in (0, W - 3):  # thick steel edge posts
        post = box(g, x0, 0, Z0 - 1, x0 + 3, H, Z1 + 1, "steel", 4)
        P.plates(g, post, "steel", 4, size=(6, 9))
        P.flat(g, edges(post), "steel", 2)
    cap = box(g, 0, H - 3, Z0 - 1, W, H, Z1 + 1, "steel", 4)
    P.flat(g, cap & (Y > H - 1.5), "steel", 5)
    P.flat(g, edges(cap), "steel", 2)
    sill = box(g, 0, 0, Z0 - 1, W, 4, Z1 + 1, "iron", 4)
    pnpaint.hazard(g, sill & (Y > 0.5) & (Y < 3), period=6, a=("orange", 5), b=("iron", 3), frame="wall")
    P.flat(g, edges(sill), "iron", 2)
    P.flat(g, plate & (Y > 20) & (Y < 22), "rust", 5)  # one copper band
    P.flat(g, plate & (np.abs(Y - 21) < 0.4), "rust", 6)
    for yy in (26, 28, 30):  # a painted vent on the back face
        P.flat(g, plate & (Z > Z1 - 1) & (np.abs(Y - yy) < 0.4) & (X > 6) & (X < 16), "bone", 3)
    P.flat(g, plate & (Z > Z1 - 1) & (Y > 10) & (Y < 16) & (X > 7) & (X < 15), "orange", 5)
    P.flat(g, plate & (Z > Z1 - 1) & (Y > 11) & (Y < 15) & (X > 8) & (X < 14), "orange", 3)
    strip = plate & (Z < Z0 + 1) & (Y > H - 6) & (Y < H - 4) & (X > 4) & (X < W - 4)
    P.flat(g, strip, "cyan", 6)
    P.flat(g, strip & (np.floor(X) % 4 == 0), "cyan", 7)

    # The pressure hatch, set into the plate.
    rad = np.hypot(X - 11.0, Y - HY)
    ring = ngon_prism(g, "z", 11.0, float(HY), 7.0, Z0 - 2, Z0, "rust", 5, n=8)
    P.flat(g, ring, "rust", 5)
    P.flat(g, ring & (Z < Z0 - 1), "rust", 6)
    P.flat(g, ring & (rad < 5.6), "rust", 3)
    lid = ngon_prism(g, "z", 11.0, float(HY), 5.0, Z0 - 2, Z0, "steel", 5, n=8)
    P.flat(g, lid, "steel", 5)
    P.flat(g, lid & (Z < Z0 - 1), "steel", 6)
    P.flat(g, lid & (rad < 3.4) & (Z < Z0 - 1), "cyan", 6)
    P.flat(g, lid & (rad < 1.8) & (Z < Z0 - 1), "cyan", 7)
    for k in range(6):
        a = k * np.pi / 3
        bx, by = 11.0 + 4.2 * np.cos(a), HY + 4.2 * np.sin(a)
        P.flat(g, lid & (np.hypot(X - bx, Y - by) < 1.1) & (Z < Z0 - 1), "rust", 6)

    # The two stiles and the wide copper rungs between them.
    for x0 in SX:
        st = box(g, x0, 4, Z0 - 4, x0 + 2, 28, Z0, "steel", 4)
        P.flat(g, st & (Z < Z0 - 3), "steel", 5)
        P.flat(g, st & (np.floor(Y) % 5 == 0), "steel", 2)
        P.flat(g, edges(st), "steel", 2)
        for yy in range(6, 27, 5):  # the brackets that bolt each stile to the plate
            br = box(g, x0, yy, Z0 - 1, x0 + 2, yy + 2, Z0 + 1, "steel", 3)
            P.flat(g, br, "steel", 3)
    for yy in range(6, 27, 5):
        r = box(g, SX[0], yy, Z0 - 3, SX[1] + 2, yy + 2, Z0 - 1, "rust", 5)
        P.flat(g, r & (Y > yy + 1), "rust", 4)
        P.flat(g, r & (Z < Z0 - 2), "rust", 6)

    # The oversized lever on a visible steel bracket beside the hatch.
    brk = box(g, 2, HY - 3, Z0 - 3, 5, HY + 3, Z0, "steel", 4)
    P.flat(g, brk & (Z < Z0 - 2), "steel", 5)
    P.flat(g, edges(brk), "steel", 2)
    lev = box(g, 2, HY - 1, Z0 - 6, 4, HY + 8, Z0 - 3, "orange", 5)
    P.flat(g, lev & (Z < Z0 - 5), "orange", 6)
    P.flat(g, lev & (X < 3), "orange", 4)
    P.flat(g, lev & (Y > HY + 6), "orange", 3)
    dots(g, plate & (Z < Z0 + 1), "-z", [(17.5, HY + 5.5)], 1.1, "cyan", 7)
    dots(g, plate & (Z < Z0 + 1), "-z", [(17.5, HY - 5.5)], 1.1, "orange", 6)
    return g


def build() -> Asset:
    root = Part("hatch-ladder", ladder())
    return Asset(id="space-props-hatch-ladder", pack="space", category="props", name="Hatch Access Ladder", root=root)
