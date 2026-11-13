"""Exobiology sample field container, in the Pirate Nation mecha style.

One iconic shape (rule K3): a ruggedized exobiology sample collection case.
Constructed from white hull composite plates with chamfered edges and dark iron
shock bumpers (F2, F3). The top lid features a reinforced observation viewport
revealing glowing alien crystal geological specimens (lime, magenta, cyan) held
in stasis foam (F4). Heavy copper toggle clamps lock the lid. An ergonomic
copper carrying handle spans the top, tilted slightly askew (F5). A biohazard
stencil diamond and tracking barcode mark the front panel. Detail is paint
(S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import cham_prism, dots, hull, ngon_prism, panel
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 20, 14, 16
X0, X1 = 2, 18
Z0, Z1 = 2, 14


def crate() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Base rubberized skid rails (Y=0 to 2)
    skids = box(g, X0 - 1, 0, Z0 - 1, X1 + 1, 2, Z1 + 1, "iron", 4)
    P.flat(g, edges(skids), "iron", 3)
    pnpaint.hazard(g, skids & (coords(g)[2] < Z0 + 1), period=4, a=("orange", 5), b=("iron", 4))

    # Main case body (Y=2 to 9): chamfered white hull shell
    n0 = len(g.solids)
    body = cham_prism(g, "y", X0, Z0, X1, Z1, 2.0, 2, 9, "bone", 5)
    for f, fr in facets(g, g.solids[n0:]):
        hull(g, f, "bone", 5, size=(6, 5), frame=fr, seed=4)
    P.flat(g, edges(body), "bone", 3)

    # 4 Protective iron corner bumpers
    for cx in (X0, X1 - 2):
        for cz in (Z0, Z1 - 2):
            bump = box(g, cx, 1, cz, cx + 2, 9, cz + 2, "iron", 5)
            P.flat(g, edges(bump), "iron", 3)
            dots(g, bump, "top", [(cx + 1, cz + 1)], 0.6, "gold", 6)

    # Front recessed label panel (X=5 to 15, Y=3 to 8, Z=Z0-1 to Z0)
    lbl = box(g, 5, 3, Z0 - 1, 15, 8, Z0, "steel", 4)
    P.flat(g, edges(lbl), "steel", 3)
    # Biohazard warning diamond in orange
    P.flat(g, lbl & (np.abs((X - 7.5) + (Y - 5.5)) < 1.4) & (np.abs((X - 7.5) - (Y - 5.5)) < 1.4), "orange", 6)
    P.flat(g, lbl & (coords(g)[0] >= 7.0) & (coords(g)[0] <= 8.0) & (coords(g)[1] >= 5.0) & (coords(g)[1] <= 6.0), "iron", 2)
    # Barcode lines on right side of label
    for bx in (10, 11, 13, 14):
        P.flat(g, lbl & (coords(g)[0] == bx) & (coords(g)[1] >= 4) & (coords(g)[1] <= 7), "iron", 2)

    # Heavy copper toggle clamp latches on front (-Z face, at X=5 and X=15)
    for cx in (4, 16):
        latch = box(g, cx - 1, 6, Z0 - 1.5, cx + 1, 11, Z0, "rust", 5)
        P.flat(g, edges(latch), "rust", 3)
        P.flat(g, latch & (coords(g)[1] == 8), "gold", 6)

    # Case lid (Y=9 to 13): chamfered lid with recessed top viewport
    lid = cham_prism(g, "y", X0 - 0.5, Z0 - 0.5, X1 + 0.5, Z1 + 0.5, 2.0, 9, 12, "steel", 4)
    P.flat(g, edges(lid), "steel", 3)

    # Top viewport bezel frame (X=5 to 15, Z=4 to 12, Y=11 to 13)
    bezel = box(g, 5, 11, 4, 15, 13, 12, "rust", 5)
    P.flat(g, edges(bezel), "rust", 3)
    # Glass window pane (Y=12 to 13)
    glass = box(g, 6, 12, 5, 14, 13, 11, "cyan", 5)
    P.flat(g, glass, "cyan", 5)
    # Glass glints and edge highlight
    P.flat(g, glass & (coords(g)[0] == 7) & (coords(g)[2] == 6), "bone", 7)
    P.flat(g, glass & (coords(g)[0] == 8) & (coords(g)[2] == 7), "cyan", 7)

    # Glowing alien specimen crystals visible through the glass (painted under window)
    # Lime green mineral cluster
    P.flat(g, glass & (X >= 7) & (X <= 9) & (Z >= 8) & (Z <= 10), "lime", 6)
    P.flat(g, glass & (X == 8) & (Z == 9), "lime", 7)
    # Magenta exotic crystal shard
    P.flat(g, glass & (X >= 11) & (X <= 13) & (Z >= 6) & (Z <= 8), "magenta", 6)
    P.flat(g, glass & (X == 12) & (Z == 7), "magenta", 7)

    # Side drop handles in copper on -X and +X
    for sx, sign in ((X0, -1), (X1, 1)):
        h_side = box(g, sx - (1 if sign < 0 else 0), 4, 6, sx + (0 if sign < 0 else 1), 7, 10, "rust", 5)
        P.flat(g, edges(h_side), "rust", 4)

    return g


def handle() -> Grid:
    # Top carrying handle, angled slightly askew (F5)
    hw, hh, hd = 10, 4, 3
    g = Grid(hw, hh, hd)
    # U-shaped handle
    h_bar = box(g, 0, 0, 0, hw, hh, hd, "rust", 5)
    inner = box(g, 2, 0, 0, hw - 2, 2, hd, "steel", 1)
    h_bar &= ~inner
    P.flat(g, h_bar, "rust", 5)
    P.flat(g, edges(h_bar), "rust", 4)
    # Central rubber grip
    P.flat(g, h_bar & (coords(g)[0] >= 3) & (coords(g)[0] <= 7) & (coords(g)[1] >= 2), "iron", 4)
    return g


def build() -> Asset:
    root = Part("sample-crate", crate())
    # Add carrying handle on top of lid, slightly angled (F5)
    root.add(Part("handle", handle(), pivot=(5.0, 0.0, 1.5), at=(10.0, 12.0, 8.0), rot=(0.0, 8.0, 0.0)))
    return Asset(id="space-props-sample-crate", pack="space", category="props", name="Exobiology Sample Container", root=root)
