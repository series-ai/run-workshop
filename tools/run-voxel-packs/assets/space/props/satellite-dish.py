"""Satellite dish, in the Pirate Nation mecha style.

One iconic shape (rule K3): an oversized white dish (a faceted octagonal
frustum, true slopes, F2) tilted up toward the sky on a copper yoke over a
steel column and a white control box. A feed horn on a thick strut sits in
front of the dish with a blinking red tip; an orange rim ring and painted
ribs make the dish read as a bowl. The dish is turned a little (F5).
Detail is paint (S1). The dish faces -Z.
"""
import numpy as np

import paint as P
from _pn import pipe
from _props import dots, glow, hull, ngon_prism
from pnkit import box, edges
from pnshapes import bar, coords, facets
from voxgrid import Asset, Clip, Grid, Part, sway

W, D = 20, 18
CX, CZ = 10.0, 10.0


def base() -> Grid:
    g = Grid(W, 18, D)
    X, Y, Z = coords(g)
    cb = box(g, 2, 0, 3, 18, 8, 17, "bone", 5)
    hull(g, cb, "bone", 5, size=(8, 8), seed=3)
    P.flat(g, cb & (Y < 1), "bone", 3)
    glow(g, "-z", 3, 4, 11, 2, 6, glass=("cyan", 5), rim=("steel", 3), bar=False, glint=False)
    dots(g, cb & (Z < 3.5), "-z", [(13.5, 4.5), (16, 4.5)], 1.1, "orange", 6)
    col = ngon_prism(g, "y", CX, CZ, 2.8, 8, 16, "steel", 5)
    P.flat(g, col & (np.abs(Y - 11.5) < 0.6), "orange", 5)
    ring = ngon_prism(g, "y", CX, CZ, 4, 8, 9, "steel", 4)
    # a cable from the box down the back
    pipe(g, [(15, 6, 17.5), (15, 1.5, 17.5)], s=2, ramp="rust", base=4, flange=False)
    return g


def yoke() -> Grid:
    g = Grid(20, 10, 6)
    X, Y, Z = coords(g)
    b = box(g, 3, 0, 1, 17, 2, 5, "rust", 4)
    for x0 in (2, 16):
        arm = box(g, x0, 0, 1, x0 + 2, 10, 5, "rust", 4)
        P.flat(g, arm & (Y > 8), "rust", 6)
    P.flat(g, edges(b), "rust", 3)
    return g


def dish() -> Grid:
    """The bowl: a shallow octagonal frustum opening toward +y (its front
    once tilted), with rings, ribs and a feed horn on a strut."""
    g = Grid(28, 16, 28)
    X, Y, Z = coords(g)
    c = 14.0
    back = ngon_prism(g, "y", c, c, 4.5, 0, 2, "steel", 4)
    bowl = ngon_prism(g, "y", c, c, 6.0, 2, 6, "bone", 5, r_top=13.0)
    for m, fr in facets(g):
        P.flat(g, m, "bone", 4)
    top = bowl & (Y > 5)
    rr = np.hypot(X - c, Z - c)
    ang = np.arctan2(Z - c, X - c)
    P.flat(g, top, "bone", 6)
    P.flat(g, top & (np.abs(rr - 8) < 0.6), "bone", 4)
    P.flat(g, top & (np.abs(rr - 4) < 0.6), "bone", 4)
    P.flat(g, top & (rr > 11.3), "orange", 5)
    P.flat(g, top & (np.abs(((ang / (2 * np.pi) * 8) % 1) - 0.5) * rr < 0.45) & (rr < 11.3) & (rr > 2), "bone", 4)
    # the feed strut and horn
    box(g, c - 1, 6, c - 1, c + 1, 13, c + 1, "steel", 5)
    horn = ngon_prism(g, "y", c, c, 1.6, 12, 15, "rust", 4, r_top=2.4)
    tip = box(g, c - 1, 15, c - 1, c + 1, 16, c + 1, "red", 6)
    return g


def build() -> Asset:
    root = Part("satellite-dish", base())
    yk = root.add(Part("yoke", yoke(), pivot=(10.0, 0.0, 3.0), at=(CX, 16.0, CZ), rot=(0.0, -12.0, 0.0)))
    yk.add(Part("dish", dish(), pivot=(14.0, 1.0, 14.0), at=(0.0, 8.0, 0.0), rot=(-50.0, 0.0, 0.0)))
    return Asset(id="space-props-satellite-dish", pack="space", category="props", name="Satellite Dish", root=root,
                 # the yoke pans across the sky and the dish nods as it scans
                 clips=[Clip("idle", {"yoke": {"rot": sway(10.0, amp=(0.0, 30.0, 0.0))}, "dish": {"rot": sway(10.0, amp=(6.0, 0.0, 0.0), cycles=(2, 1, 1))}})])
