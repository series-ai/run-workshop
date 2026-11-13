"""Mess hall table, in the Pirate Nation mecha style.

One iconic shape (rule K3): a long white hull table top in a dark steel rim
on two trestle legs faced with white hull panels, with a bench on each side
carried by visible steel brackets (F3), so nothing hovers. The oversized
function prop is the ration dispenser standing on the table: a copper column
with a big cyan screen, a steel hood and a glowing tap (F4). Panel seams,
rivets and one hazard band on the feet carry the detail as paint (S1, S4).
Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _props import cham_prism, dots, hull, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 38, 32, 28
TY = 16  # table top underside
TZ0, TZ1 = 9, 19
LEGS = (5, 27)  # low x of each trestle leg
BZ = (2, 21)  # low z of each bench


def table() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    for lx in LEGS:
        foot = box(g, lx - 2, 0, TZ0, lx + 8, 3, TZ1, "iron", 4)
        P.flat(g, foot & (Y > 2), "iron", 5)
        pnpaint.hazard(g, foot & (Y > 0.5) & (Y < 2.5), period=6, a=("orange", 5), b=("iron", 3), frame="wall")
        P.flat(g, foot & (Y < 1), "iron", 2)
        # The trestle plate: a white hull face in a dark steel edge.
        plate = cham_prism(g, "y", lx, TZ0, lx + 6, TZ1, 1.5, 3, TY, "steel", 4)
        for m, fr in facets(g, g.solids[-1:]):
            P.plates(g, m, "steel", 4, size=(6, 7), frame=fr)
        P.flat(g, edges(plate), "steel", 2)
        for zm in (plate & (Z < TZ0 + 1), plate & (Z > TZ1 - 1)):
            pan = zm & (Y > 5) & (Y < 14) & (X > lx + 0.5) & (X < lx + 5.5)
            P.flat(g, pan, "bone", 6)
            P.flat(g, pan & (np.abs(Y - 9.5) < 0.6), "bone", 4)
            P.outline(g, pan, "steel", 2, normal="z")
        for bz in BZ:  # brackets out to each bench
            arm = box(g, lx + 1, 9, min(bz + 2, TZ0), lx + 5, 12, max(bz + 4, TZ1), "steel", 3)
            P.flat(g, edges(arm), "steel", 2)

    # The table top: white hull in a dark steel rim.
    top = box(g, 1, TY, TZ0, W - 1, TY + 2, TZ1, "bone", 6)
    P.plates(g, top, "bone", 6, size=(8, 7), frame="top")
    P.flat(g, top & (Y < TY + 1), "steel", 3)
    rim = box(g, 0, TY, TZ0 - 1, W, TY + 2, TZ0, "steel", 4) | box(g, 0, TY, TZ1, W, TY + 2, TZ1 + 1, "steel", 4)
    rim |= box(g, 0, TY, TZ0 - 1, 1, TY + 2, TZ1 + 1, "steel", 4)
    rim |= box(g, W - 1, TY, TZ0 - 1, W, TY + 2, TZ1 + 1, "steel", 4)
    P.flat(g, rim & (Y > TY + 1), "steel", 5)
    P.flat(g, rim & (Y < TY + 1), "steel", 2)

    # Two long benches: a white hull seat with a teal cushion, on dark rails.
    for bz in BZ:
        rail = box(g, 4, 10, bz + 1, W - 4, 12, bz + 4, "steel", 3)
        P.flat(g, rail & (np.floor(X) % 6 == 0), "steel", 2)
        for ex in (3, W - 5):  # end plates, so the bench is clearly carried
            ep = box(g, ex, 8, bz, ex + 2, 14, bz + 5, "steel", 4)
            P.flat(g, edges(ep), "steel", 2)
        seat = box(g, 3, 12, bz, W - 3, 14, bz + 5, "bone", 6)
        P.flat(g, seat & (Y < 13), "steel", 3)
        P.flat(g, seat & (Y > 13) & (Z > bz + 0.5) & (Z < bz + 4.5), "teal", 5)
        P.flat(g, seat & (Y > 13) & (Z > bz + 1.5) & (Z < bz + 3.5), "teal", 6)
        P.flat(g, seat & (Y > 13) & (np.abs(Z - (bz + 2.5)) < 0.6) & (np.floor(X) % 8 < 4), "cyan", 6)
        P.outline(g, seat & (Y > 13), "steel", 2, normal="y")

    # The oversized ration dispenser standing on the table.
    col = ngon_prism(g, "y", 19.0, 14.0, 5.0, TY + 2, TY + 11, "rust", 5, n=8)
    P.flat(g, col, "rust", 5)
    P.flat(g, col & (Y < TY + 4), "rust", 3)
    P.flat(g, col & (Y > TY + 9.5), "rust", 6)
    P.flat(g, col & (Z < 10.0), "rust", 6)
    hood = ngon_prism(g, "y", 19.0, 14.0, 6.0, TY + 11, TY + 14, "steel", 4, n=8, r_top=3.6)
    for m, fr in facets(g, g.solids[-1:]):
        P.flat(g, m, "steel", 4)
    P.flat(g, hood & (Y > TY + 13), "steel", 6)
    P.flat(g, (g.a != 0) & (Y > TY + 13.5) & (np.hypot(X - 19, Z - 14) < 2.0), "cyan", 7)
    scr = col & (Z < 10.2) & (X > 15.5) & (X < 22.5) & (Y > TY + 4) & (Y < TY + 10)
    P.flat(g, scr, "cyan", 2)
    P.flat(g, scr & (X > 16.5) & (X < 21.5) & (Y > TY + 5) & (Y < TY + 9), "cyan", 5)
    P.flat(g, scr & (np.floor(Y) % 2 == 0) & (X > 16.5) & (X < 21.5) & (Y > TY + 5) & (Y < TY + 9), "cyan", 6)
    P.flat(g, scr & ((X < 16.5) | (X > 21.5) | (Y < TY + 5) | (Y > TY + 9)), "steel", 2)
    tap = box(g, 18, TY + 2, TZ0 - 2, 20, TY + 4, TZ0 + 1, "steel", 5)
    P.flat(g, tap & (Y < TY + 3), "cyan", 7)
    P.flat(g, col & (Z > 18.0) & (np.abs(X - 19) < 1.1) & (Y > TY + 6) & (Y < TY + 9), "orange", 5)

    # Two mess trays and a copper mug, so the top is not bare.
    for tx in (7.0, 31.0):
        tray = box(g, tx - 4, TY + 2, 11, tx + 4, TY + 3, 17, "bone", 7)
        P.flat(g, tray & (np.abs(X - tx) < 2.1) & (Z > 12.5) & (Z < 15.5), "orange", 5)
        P.outline(g, tray, "steel", 3, normal="y")
    mug = ngon_prism(g, "y", 13.0, 16.5, 1.6, TY + 2, TY + 5, "rust", 5, n=8)
    P.flat(g, mug & (Y > TY + 4), "rust", 6)
    return g


def build() -> Asset:
    root = Part("mess-table", table())
    return Asset(id="space-props-mess-table", pack="space", category="props", name="Mess Hall Table", root=root)
