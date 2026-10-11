"""Deck floor hatch, in the Pirate Nation mecha style.

One iconic shape (rule K3): a steel deck slab with plain painted plating,
one clean diagonal hazard band along its rim only, and an oversized copper
hatch ring in the middle holding a steel lid with a glowing cyan lens (F4).
A short control pylon with a cyan screen gives the silhouette height, so the
prop reads at thumbnail size from the side as well as from above (F6).
Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _props import bolt_row, dots, hull, lamp, ngon_prism, service_panel, slats
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

# A 32 x 32 tile (two grid tiles) with a deck top at y 2, so the hatch sits
# nearly flush with the floor (Art Director repair).
W, H, D = 32, 28, 32
CX, CZ = 16.0, 16.0
SY = 2  # deck top


def hatch() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    rad = np.hypot(X - CX, Z - CZ)

    # The deck slab: steel plating, framed dark, with worked side walls.
    slab = box(g, 0, 0, 0, W, SY, D, "steel", 4)
    P.flat(g, slab & (Y > SY - 1.5), "steel", 5)
    P.flat(g, slab & (Y > SY - 1.5) & ((np.floor(X) % 7 == 0) | (np.floor(Z) % 7 == 0)), "steel", 3)
    P.flat(g, slab & (Y < 1), "iron", 3)
    P.flat(g, edges(slab), "steel", 2)
    # Every side wall of the slab: two framed panels, bolts and a vent (S4).
    for face, fm, u0, u1 in (("-z", slab & (Z < 1), 1, W - 1),
                             ("+z", slab & (Z > D - 1), 1, W - 1),
                             ("-x", slab & (X < 1), 1, D - 1),
                             ("+x", slab & (X > W - 1), 1, D - 1)):
        P.flat(g, fm, "steel", 4)
        P.flat(g, fm & (np.floor(X + Z) % 8 == 0), "steel", 2)
        P.flat(g, fm & (Y > SY - 1.5), "steel", 3)
    # One hazard band, on the rim only.
    rim = slab & (Y > SY - 1.5) & ((X < 2) | (X > W - 2) | (Z < 2) | (Z > D - 2))
    pnpaint.hazard(g, rim, period=8, a=("orange", 5), b=("iron", 4), frame="top")
    inner = slab & (Y > SY - 1.5) & ((np.abs(X - 2) < 0.6) | (np.abs(X - (W - 2)) < 0.6)
                                     | (np.abs(Z - 2) < 0.6) | (np.abs(Z - (D - 2)) < 0.6))
    P.flat(g, inner, "iron", 3)
    # Painted tread plate on the open deck, so no tile is bare (S2).
    deck = slab & (Y > SY - 1.5) & (X > 2.5) & (X < W - 2.5) & (Z > 2.5) & (Z < D - 2.5) & (rad > 11.0)
    P.flat(g, deck, "steel", 5)
    P.flat(g, deck & (np.floor(X + Z) % 4 == 0) & (np.floor(X - Z) % 4 == 0), "steel", 6)  # tread studs
    P.flat(g, deck & ((np.floor(X) % 9 == 0) | (np.floor(Z) % 9 == 0)), "steel", 3)  # plate seams
    P.flat(g, deck & (np.floor(X) % 9 == 0) & (np.floor(Z) % 9 == 0), "steel", 7)  # seam bolts

    # The oversized copper hatch: a stepped ring broken into eight bolted
    # segments by steel joints, with a cyan inlay that marks it as powered.
    ang = np.arctan2(Z - CZ, X - CX)
    seg = np.floor((ang + np.pi) / (2 * np.pi) * 8)
    joint = np.abs(((ang + np.pi) / (2 * np.pi) * 8) % 1 - 0.5) > 0.44
    ring = ngon_prism(g, "y", CX, CZ, 10.5, SY - 1, SY + 2, "rust", 5, n=8)
    P.flat(g, ring, "rust", 5)
    P.flat(g, ring & (Y > SY + 1), "rust", 6)
    P.flat(g, ring & (Y > SY + 1) & (rad < 9.2), "rust", 3)
    P.flat(g, ring & (Y > SY + 1) & (rad > 9.6) & (seg % 2 == 0), "rust", 4)  # inset divisions
    P.flat(g, ring & joint & (Y > SY + 1), "steel", 5)  # steel joint plates on the rim
    P.flat(g, ring & joint & (Y > SY + 1) & (rad > 9.8), "steel", 3)
    P.flat(g, ring & (Y > SY + 1) & (rad > 8.6) & (rad < 9.3), "cyan", 6)  # the glowing inlay
    P.flat(g, ring & (Y > SY + 1) & (rad > 8.9) & (rad < 9.3), "cyan", 7)
    lid = ngon_prism(g, "y", CX, CZ, 8.4, SY + 2, SY + 4, "steel", 5, n=8)
    P.flat(g, lid, "steel", 4)
    P.flat(g, lid & (Y > SY + 3), "steel", 6)
    P.flat(g, lid & (Y > SY + 3) & (rad > 7.0), "steel", 4)
    P.flat(g, lid & (Y > SY + 3) & (rad > 7.0) & (seg % 2 == 0), "steel", 5)
    P.flat(g, lid & (Y > SY + 3) & joint & (rad > 4.6), "steel", 3)
    for k in range(4):  # four clean copper bolt caps on the lid
        a = k * np.pi / 2 + np.pi / 4
        bx, bz = CX + 6.0 * np.cos(a), CZ + 6.0 * np.sin(a)
        P.flat(g, lid & (np.abs(X - bx) < 1.6) & (np.abs(Z - bz) < 1.6) & (Y > SY + 3), "rust", 6)
        P.flat(g, lid & (np.abs(X - bx) < 0.6) & (np.abs(Z - bz) < 0.6) & (Y > SY + 3), "rust", 4)
    P.flat(g, lid & (Y > SY + 3) & (np.abs(X - CX) < 0.8), "iron", 2)

    # The locking lever: a chunky copper handle on a steel pivot boss, bolted
    # to the lid, so the hatch has one clear function prop (K3, F4).
    boss = ngon_prism(g, "y", CX - 6.0, CZ, 2.4, SY + 4, SY + 6, "steel", 5, n=8)
    P.flat(g, boss, "steel", 5)
    P.flat(g, boss & (Y > SY + 5), "steel", 6)
    lever = box(g, CX - 12, SY + 5, CZ - 1.5, CX - 5, SY + 7, CZ + 1.5, "rust", 5)
    P.flat(g, lever & (Y > SY + 6), "rust", 6)
    P.flat(g, lever & (X < CX - 10.5), "rust", 3)
    P.flat(g, lever & (np.abs(Z - CZ) > 1.0), "rust", 3)
    grip = box(g, CX - 12, SY + 5, CZ - 2.5, CX - 10, SY + 8, CZ + 2.5, "steel", 4)
    P.flat(g, grip & (Y > SY + 7), "steel", 5)
    P.flat(g, grip & (Y < SY + 6), "steel", 3)
    P.flat(g, grip & (np.abs(Z - CZ) < 1.2) & (Y > SY + 6) & (Y < SY + 7.5), "cyan", 6)

    return g


def build() -> Asset:
    root = Part("floor-hatch", hatch())
    return Asset(id="space-props-floor-hatch", pack="space", category="props", name="Deck Floor Hatch", root=root)
