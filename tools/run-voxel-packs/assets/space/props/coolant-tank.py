"""Coolant tank, in the Pirate Nation mecha style.

One iconic shape (rule K3): a fat white hull cylinder (a 12-gon, true
facets) on a dark octagonal plinth, capped by a steel shoulder and an
oversized copper valve with a cross handle (F4). Steel band rings, not
straps, hold the shell; a steel riser with copper couplings hugs one side;
one big cyan sight glass in a steel frame shows the coolant level. Hazard
orange marks the plinth. Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _props import dots, hull, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 26, 36, 26
CX, CZ = 13.0, 13.0
Y0, Y1 = 4, 26  # the shell
R = 9.5


def tank() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    rad = np.hypot(X - CX, Z - CZ)

    # Dark octagonal plinth with one clean hazard band.
    base = ngon_prism(g, "y", CX, CZ, 11.5, 0, Y0, "steel", 3, n=8)
    P.flat(g, base, "steel", 3)
    P.flat(g, base & (Y > Y0 - 1.5), "steel", 4)
    pnpaint.hazard(g, base & (Y > 0.5) & (Y < 3), period=6, a=("orange", 5), b=("steel", 2), frame="wall")
    P.flat(g, base & (Y < 1), "steel", 1)
    P.flat(g, base & (np.abs(Y - (Y0 - 0.5)) < 0.6), "steel", 2)

    # The shell: a 12-gon of white hull plate, framed top and bottom.
    shell = ngon_prism(g, "y", CX, CZ, R, Y0, Y1, "bone", 6, n=12)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "bone", 6, size=(8, 11), frame=fr)
    P.flat(g, shell & ((Y < Y0 + 2) | (Y > Y1 - 2)), "steel", 3)
    P.flat(g, shell & ((np.abs(Y - (Y0 + 0.5)) < 0.6) | (np.abs(Y - (Y1 - 1.5)) < 0.6)), "steel", 2)
    ring = shell & (np.abs(Y - 15.5) < 1.6)  # one wide copper band ring
    P.flat(g, ring, "rust", 5)
    P.flat(g, ring & (np.abs(Y - 15.5) < 0.6), "rust", 6)
    P.flat(g, shell & ((np.abs(Y - 13.4) < 0.6) | (np.abs(Y - 17.6) < 0.6)), "rust", 3)

    # One big sight glass on the front, seated flush in a steel frame.
    front = shell & (Z < CZ - R + 1.2)
    glass = front & (Y > 7) & (Y < 14) & (np.abs(X - CX) < 3.2)
    P.flat(g, glass, "cyan", 5)
    P.flat(g, glass & (Y < 12), "cyan", 6)
    P.flat(g, glass & (np.abs(X - (CX - 2)) < 0.6) & (Y > 9) & (Y < 11), "cyan", 7)
    P.flat(g, front & (((np.abs(Y - 6.5) < 0.6) | (np.abs(Y - 14.5) < 0.6)) & (np.abs(X - CX) < 4.2)
                       | ((np.abs(np.abs(X - CX) - 3.8) < 0.6) & (Y > 6) & (Y < 15))), "steel", 2)

    # The steel shoulder and the oversized copper valve.
    ngon_prism(g, "y", CX, CZ, R, Y1, Y1 + 4, "steel", 4, n=12, r_top=6.0)
    for m, fr in facets(g, g.solids[-1:]):
        P.flat(g, m, "steel", 4)
    P.flat(g, (g.a != 0) & (Y > Y1 + 2.5) & (Y < Y1 + 4) & (rad > 4.5), "steel", 5)
    neck = ngon_prism(g, "y", CX, CZ, 4.6, Y1 + 4, Y1 + 6, "rust", 4, n=8)
    P.flat(g, neck, "rust", 4)
    P.flat(g, neck & (Y > Y1 + 5), "rust", 5)
    hub = ngon_prism(g, "y", CX, CZ, 2.6, Y1 + 6, Y1 + 9, "rust", 5, n=8)
    P.flat(g, hub & (Y > Y1 + 8), "rust", 6)
    for x0, z0, x1, z1 in ((CX - 7, CZ - 1.5, CX + 7, CZ + 1.5), (CX - 1.5, CZ - 7, CX + 1.5, CZ + 7)):
        bar = box(g, x0, Y1 + 7, z0, x1, Y1 + 9, z1, "rust", 5)
        P.flat(g, bar & (Y > Y1 + 8), "rust", 6)
        P.flat(g, edges(bar), "rust", 3)
    P.flat(g, (g.a != 0) & (Y > Y1 + 8) & (rad < 1.4), "cyan", 7)

    # A steel riser with copper couplings, hugging the back of the shell.
    riser = box(g, CX - 1.5, Y0 + 2, CZ + R - 1.5, CX + 1.5, Y1 + 3, CZ + R + 2.0, "steel", 4)
    P.flat(g, riser & (X > CX), "steel", 5)
    P.flat(g, edges(riser), "steel", 2)
    for yy in (Y0 + 3, 15, Y1 + 1):
        cpl = box(g, CX - 2.5, yy, CZ + R - 2.0, CX + 2.5, yy + 2, CZ + R + 2.5, "rust", 5)
        P.flat(g, edges(cpl), "rust", 3)

    # Two framed status lamps low on the back, so the tank reads from behind.
    back = shell & (Z > CZ + R - 1.2)
    for cx, col in ((CX - 4, "cyan"), (CX + 4, "orange")):
        hsg = back & (np.abs(X - cx) < 2.2) & (Y > 19) & (Y < 23)
        P.flat(g, hsg, "steel", 2)
        P.flat(g, hsg & (np.abs(X - cx) < 1.2) & (Y > 20) & (Y < 22), col, 6)
        P.flat(g, hsg & (np.abs(X - cx) < 0.6) & (Y > 20.5) & (Y < 21.5), col, 7)
    return g


def build() -> Asset:
    root = Part("coolant-tank", tank())
    return Asset(id="space-props-coolant-tank", pack="space", category="props", name="Coolant Tank", root=root)
