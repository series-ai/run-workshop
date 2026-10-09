"""Fuel hose reel, in the Pirate Nation mecha style.

One iconic shape (rule K3): an oversized reel between two sloped white hull
posts on a dark plinth (F2, F3). The flanges are plain steel discs with one
hazard-orange rim band and a copper hub; between them the hose is wound in
wide copper wraps with a dark line between each wrap, so there is no fine
checker anywhere (S3). A copper crank turns the axle, a cyan gauge sits on
one post and a nozzle rests in its cradle. Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _props import dots, hull, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 32, 30, 24
CY, CZ = 17.0, 12.0  # the axle
R = 9.0  # flange radius
PX0, PX1 = 4, 28  # the inner faces of the two posts


def reel() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    rad = np.hypot(Y - CY, Z - CZ)

    # Dark plinth with one clean hazard band.
    base = box(g, 0, 0, 1, W, 4, D - 1, "iron", 4)
    P.flat(g, base & (Y > 3), "iron", 5)
    pnpaint.hazard(g, base & (Y > 0.5) & (Y < 2.5), period=6, a=("orange", 5), b=("iron", 3), frame="wall")
    P.flat(g, edges(base), "iron", 2)

    # Two sloped posts of white hull plate in a steel edge (a true slope).
    for x0, x1 in ((0, PX0), (PX1, W)):
        g.prism("x", [(4, 2), (4, D - 2), (24, 15), (24, 9)], x0, x1, P.C("bone", 6))
        post = g.solids[-1].mask(g.shape)
        for m, fr in facets(g, g.solids[-1:]):
            P.flat(g, m, "bone", 6)
        P.flat(g, post & (np.abs(Y - 14) < 0.6), "bone", 4)  # one painted seam
        P.flat(g, post & (np.abs(Z - CZ) < 0.6) & (Y > 15), "bone", 4)
        P.flat(g, edges(post), "steel", 2)
        P.flat(g, post & (Y > 5) & (Y < 8), "orange", 5)
        P.flat(g, post & (np.abs(Y - 6.5) < 0.4), "orange", 3)
        P.flat(g, post & (Y > 21), "steel", 4)

    # The hose: wide copper wraps with a dark line between them.
    core = ngon_prism(g, "x", CY, CZ, 6.2, PX0 + 2, PX1 - 2, "steel", 4, n=12)
    P.flat(g, core, "steel", 4)
    P.flat(g, core & (np.floor(X) % 3 == 0), "steel", 2)
    P.flat(g, core & (np.floor(X) % 3 == 1), "steel", 5)
    P.flat(g, core & (np.abs(X - 16) < 1.6), "cyan", 6)  # one coolant wrap
    P.flat(g, core & (rad < 3.2), "rust", 4)  # the copper drum shows at the ends

    # Two plain steel flanges with one hazard-orange rim band and a hub.
    for x0, x1 in ((PX0, PX0 + 2), (PX1 - 2, PX1)):
        fl = ngon_prism(g, "x", CY, CZ, R, x0, x1, "steel", 4, n=12)
        P.flat(g, fl, "steel", 4)
        P.flat(g, fl & (rad > R - 1.8), "orange", 5)
        P.flat(g, fl & (rad > R - 0.8), "orange", 3)
        P.flat(g, fl & (rad < 4.4), "steel", 3)
        P.flat(g, fl & (rad < 2.8), "rust", 5)
        P.flat(g, fl & (rad < 1.4), "rust", 6)
        for k in range(3):  # three painted spoke lines, the only pattern
            a = k * np.pi / 3
            P.flat(g, fl & (np.abs((Y - CY) * np.cos(a) - (Z - CZ) * np.sin(a)) < 0.6) & (rad > 2.8) & (rad < R - 2.0), "steel", 3)

    # The axle and the copper crank on the +x side.
    ngon_prism(g, "x", CY, CZ, 1.8, 2, W - 2, "steel", 5, n=8)
    arm = box(g, W - 4, CY - 1.0, CZ - 1.0, W - 1, CY + 7.0, CZ + 1.0, "rust", 5)
    P.flat(g, arm, "rust", 5)
    P.flat(g, edges(arm), "rust", 3)
    grip = box(g, W - 6, CY + 5.0, CZ - 1.5, W - 1, CY + 7.0, CZ + 2.5, "rust", 6)
    P.flat(g, grip & (Z > CZ + 1.0), "rust", 4)

    # A cyan gauge on the -x post and status lamps on the plinth.
    gm = (g.a != 0) & (X < 1) & (Y > 11) & (Y < 17) & (Z > 7) & (Z < 15)
    P.flat(g, gm, "cyan", 5)
    P.flat(g, gm & (Y > 12) & (Y < 16) & (Z > 8) & (Z < 14), "cyan", 6)
    P.flat(g, gm & (np.abs(Y - 14) < 0.6) & (Z > 9) & (Z < 13), "cyan", 7)
    P.outline(g, gm, "steel", 2, normal="x")
    dots(g, base & (Z < 2), "-z", [(7.5, 2.5)], 1.0, "cyan", 7)
    dots(g, base & (Z < 2), "-z", [(24.5, 2.5)], 1.0, "orange", 6)

    # The nozzle resting in a copper cradle on the plinth.
    P.flat(g, base & (Y > 3) & (np.floor(Z) % 6 == 0), "iron", 3)  # painted deck lines
    P.flat(g, base & (Y > 3) & (np.floor(X) % 8 == 0), "iron", 3)
    for cx in (12, 20):
        cr = box(g, cx, 4, 2, cx + 2, 7, 7, "rust", 5)
        P.flat(g, edges(cr), "rust", 3)
    noz = ngon_prism(g, "x", 7.0, 4.5, 2.2, 10, 22, "steel", 4, n=8)
    P.flat(g, noz, "steel", 4)
    P.flat(g, noz & (Y > 7), "steel", 5)
    P.flat(g, noz & (X > 18) & (X < 20), "rust", 5)
    P.flat(g, noz & (X > 20), "steel", 3)
    P.flat(g, (g.a != 0) & (X > 20.5) & (np.hypot(Y - 7.0, Z - 4.5) < 1.4), "cyan", 7)
    return g


def build() -> Asset:
    root = Part("fuel-hose-reel", reel())
    return Asset(id="space-props-fuel-hose-reel", pack="space", category="props", name="Fuel Hose Reel", root=root)
