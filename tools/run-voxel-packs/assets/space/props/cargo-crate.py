"""Cargo crate stack, in the Pirate Nation mecha style.

One chunky icon (rule K3): a big white hull-plated freight crate with thick
hazard-orange corner guards, a steel base skid, a hazard-striped lid band, a
sloped lid (true slopes, F2), a glowing teal latch and a stencilled "07".
A smaller steel supply box sits on top, turned and tilted (F5). Detail is
paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import cham_prism, glow, hull, panel
from pnkit import box, edges
from pnshapes import coords
from voxgrid import Asset, Grid, Part

W, D = 26, 20
X0, X1, Z0, Z1 = 1, 25, 1, 19  # crate body
Y0, Y1 = 2, 17  # body bottom and top


def crate() -> Grid:
    g = Grid(W, 21, D)
    X, Y, Z = coords(g)
    skid = box(g, 2, 0, 2, W - 2, Y0, D - 2, "steel", 3)
    P.flat(g, skid & (Y > 1), "steel", 4)
    body = box(g, X0 + 1, Y0, Z0 + 1, X1 - 1, Y1, Z1 - 1, "bone", 5)
    hull(g, body, "bone", 5, size=(11, 8), seed=4)
    # hazard band under the lid on every side
    pnpaint.hazard(g, body & (Y > Y1 - 3.5), period=4, a=("orange", 5), b=("iron", 5))
    # thick corner guards (rule F3)
    for cx in (X0, X1 - 4):
        for cz in (Z0, Z1 - 4):
            guard = box(g, cx, Y0, cz, cx + 4, Y1, cz + 4, "orange", 5)
            P.flat(g, edges(guard), "orange", 3)
            P.flat(g, guard & (np.abs(Y - 5.5) < 0.6), "steel", 6)  # bolt rows
            P.flat(g, guard & (np.abs(Y - 13.5) < 0.6), "steel", 6)
    # the lid: a chamfered frustum, so its rim is a true slope
    lid = cham_prism(g, "y", X0, Z0, X1, Z1, 3, Y1, Y1 + 3, "steel", 5, inset=1.5)
    P.plates(g, lid, "steel", 5, size=(12, 9), frame="top")
    P.flat(g, lid & (Y < Y1 + 1), "steel", 3)
    # the latch and the stencil on the front
    glow(g, "-z", Z0 + 1, 10, 16, 12, 17, glass=("cyan", 6), rim=("steel", 3), d=2, bar=False, glint=False)
    pnglyph.text(g, "-z", Z0 + 1, 8, 3, "07", "iron", 4)
    # a gear badge on the visible +x side
    pnglyph.icon(g, "+x", X1 - 1, 6, 5, "gear", "rust", 4)
    return g


def supply_box() -> Grid:
    g = Grid(14, 8, 11)
    X, Y, Z = coords(g)
    b = box(g, 0, 0, 0, 14, 7, 11, "steel", 5)
    hull(g, b, "steel", 5, size=(7, 7), seed=2)
    band = b & (Y > 4) & (Y < 6)
    P.flat(g, band, "orange", 5)
    panel(g, "-z", 0, 4, 10, 1, 4, "cyan", 5, outline=0)
    P.flat(g, b & (Z < 1) & (Y > 1) & (Y < 3) & (X > 4) & (X < 10), "cyan", 7)
    handle = box(g, 5, 7, 4, 9, 8, 7, "rust", 4)
    P.flat(g, edges(handle), "rust", 3)
    return g


def build() -> Asset:
    root = Part("cargo-crate", crate())
    root.add(Part("supply-box", supply_box(), pivot=(7.0, 0.0, 5.5), at=(11.0, 20.0, 9.5), rot=(0.0, 18.0, -4.0)))
    return Asset(id="space-props-cargo-crate", pack="space", category="props", name="Cargo Crate Stack", root=root)
