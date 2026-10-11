"""High-output ion power battery, in the Pirate Nation mecha style.

One iconic shape (rule K3): a ruggedized portable starship ion power cell. The
heavy steel chassis features chamfered corners and shock-absorbing iron bumper
corners (F2, F3). The front face holds an oversized glowing cyan ion energy
column divided into illuminated power segments, dual rotary circuit breakers,
and a hazard-striped base. The top cap mounts heavy positive (+) copper and
negative (-) dark iron bus terminal lugs. An insulated copper carrying handle
spans the top, tilted slightly askew (F5). Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import cham_prism, dots, ngon_prism, panel
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 20, 22, 16
X0, X1 = 2, 18
Z0, Z1 = 2, 14
Y_BODY = 17


def battery() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Base skid feet (Y=0 to 2)
    feet = box(g, X0 - 1, 0, Z0 - 1, X1 + 1, 2, Z1 + 1, "iron", 4)
    P.flat(g, edges(feet), "iron", 3)
    pnpaint.hazard(g, feet & (coords(g)[2] < Z0 + 1), period=4, a=("orange", 5), b=("iron", 4))

    # Main battery casing (Y=2 to Y_BODY): chamfered steel prism
    n0 = len(g.solids)
    body = cham_prism(g, "y", X0, Z0, X1, Z1, 2.5, 2, Y_BODY, "steel", 4)
    for f, fr in facets(g, g.solids[n0:]):
        P.plates(g, f, "steel", 4, size=(8, 6), frame=fr, seed=7)
    P.flat(g, edges(body), "steel", 3)

    # 4 Heavy protective corner bumpers in dark iron
    for cx in (X0, X1 - 3):
        for cz in (Z0, Z1 - 3):
            bump = box(g, cx, 2, cz, cx + 3, Y_BODY, cz + 3, "iron", 5)
            P.flat(g, edges(bump), "iron", 3)
            # Gold corner bolts
            P.flat(g, bump & ((Y == 4) | (Y == 15)), "rust", 6)

    # Front recessed ion cell window panel (X=6 to 14, Y=4 to 15, Z=Z0 to Z0+2)
    window_frame = box(g, 5, 4, Z0, 15, 15, Z0 + 2, "iron", 4)
    P.flat(g, edges(window_frame), "iron", 3)

    # Glowing cyan ion energy plasma core inside window
    cell = box(g, 6, 5, Z0 - 1, 14, 14, Z0 + 1, "cyan", 6)
    P.flat(g, cell, "cyan", 6)
    P.flat(g, cell & (coords(g)[2] < Z0), "cyan", 7)
    # Energy segment divider bars (horizontal lines)
    for sy in (7, 10, 12):
        P.flat(g, cell & (np.abs(Y - sy) < 0.6), "teal", 4)
    # High-charge glint along left side
    P.flat(g, cell & (X == 7) & (coords(g)[2] < Z0), "bone", 7)

    # Two rotary circuit breaker switches below the energy cell
    dots(g, body, "-z", [(4.5, 3.5)], 1.1, "rust", 5)
    dots(g, body, "-z", [(15.5, 3.5)], 1.1, "rust", 5)
    P.flat(g, body & (coords(g)[2] < Z0 + 1) & (np.hypot(X - 4.5, Y - 3.5) < 0.5), "gold", 6)
    P.flat(g, body & (coords(g)[2] < Z0 + 1) & (np.hypot(X - 15.5, Y - 3.5) < 0.5), "gold", 6)

    # Side cooling vent louvers on -X and +X (Y=5 to 13, Z=5 to 11)
    for sx, face in ((X0, "-x"), (X1 - 1, "+x")):
        vent = body & (Y >= 6) & (Y <= 13) & (Z >= 5) & (Z <= 11) & (np.abs(X - (sx + 0.5)) < 1.0)
        P.flat(g, vent & (np.floor(Y) % 2 == 0), "steel", 2)
        P.flat(g, vent & (np.floor(Y) % 2 != 0), "steel", 5)

    # Top terminal deck (Y=Y_BODY to Y_BODY + 2): dark steel plate
    top_deck = box(g, X0 + 1, Y_BODY, Z0 + 1, X1 - 1, Y_BODY + 2, Z1 - 1, "iron", 5)
    P.flat(g, edges(top_deck), "iron", 3)

    # Positive (+) terminal post on left (X=5.5, Z=CZ): copper lug
    cz = (Z0 + Z1) / 2
    pos_terminal = ngon_prism(g, "y", 5.5, cz, 2.0, Y_BODY + 2, Y_BODY + 5, "rust", 5, n=8)
    P.flat(g, edges(pos_terminal), "rust", 4)
    P.flat(g, pos_terminal & (Y > Y_BODY + 4), "gold", 6)
    # Stamped "+" symbol in gold on deck near positive terminal
    P.flat(g, top_deck & (Y == Y_BODY + 1) & (np.abs(X - 5.5) < 1.5) & (np.abs(Z - (cz - 3)) < 0.6), "rust", 6)
    P.flat(g, top_deck & (Y == Y_BODY + 1) & (np.abs(X - 5.5) < 0.6) & (np.abs(Z - (cz - 3)) < 1.5), "rust", 6)

    # Negative (-) terminal post on right (X=14.5, Z=CZ): dark iron/steel lug
    neg_terminal = ngon_prism(g, "y", 14.5, cz, 2.0, Y_BODY + 2, Y_BODY + 5, "steel", 4, n=8)
    P.flat(g, edges(neg_terminal), "steel", 3)
    P.flat(g, neg_terminal & (Y > Y_BODY + 4), "steel", 6)
    # Stamped "-" symbol on deck near negative terminal
    P.flat(g, top_deck & (Y == Y_BODY + 1) & (np.abs(X - 14.5) < 1.5) & (np.abs(Z - (cz - 3)) < 0.6), "steel", 6)

    # Front stencil "ION"
    pnglyph.text(g, "-z", Z0 - 1, 7, 15, "ION", "orange", 6, depth=2, reach=1)

    return g


def handle() -> Grid:
    # Heavy insulated copper carrying handle arching over the top (F3, F5)
    hw, hh, hd = 14, 5, 4
    g = Grid(hw, hh, hd)
    # U-shaped handle
    poly = [(0, 0), (2, 0), (2, hh), (hw - 2, hh), (hw - 2, 0), (hw, 0), (hw, hh + 1), (0, hh + 1)]
    g.prism("z", [(0, 0), (14, 0), (14, 5), (0, 5)], 1, 3, P.C("rust", 5))
    h_mask = g.solids[-1].mask(g.shape)
    # Cutout under grip
    inner = box(g, 2, 0, 0, 12, 3, hd, "steel", 1)
    h_mask &= ~inner
    P.flat(g, h_mask, "rust", 5)
    P.flat(g, edges(h_mask), "rust", 4)
    # Rubberized center grip
    P.flat(g, h_mask & (coords(g)[0] >= 4) & (coords(g)[0] <= 10) & (coords(g)[1] >= 3), "iron", 4)
    return g


def build() -> Asset:
    root = Part("ion-battery", battery())
    # Add carrying handle on top deck, turned slightly askew (F5)
    root.add(Part("handle", handle(), pivot=(7.0, 0.0, 2.0), at=(float(W) / 2, float(Y_BODY) + 1.0, float(D) / 2), rot=(0.0, -8.0, 0.0)))
    return Asset(id="space-props-ion-battery", pack="space", category="props", name="High-Output Ion Battery", root=root)
