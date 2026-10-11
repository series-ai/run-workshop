"""Alien specimen bust, in the Pirate Nation mecha style.

One iconic shape (rule K3): one oversized alien cranium clamped into a
copper socket on a steel hex pedestal, the way the PN skull well carries
its skull. Three big features settle the read (F4): two huge sunken
sockets with a cyan glow, a dark sensor visor across the brow with a cyan
eye, and two thick back-swept fins with copper tips. The cranium is
painted as hull plate: close bone tones, panel seams, rivet dots and a
dark framed edge, with a slatted glow vent on the back, so it reads as a
sci-fi specimen and not as a bare skull (S1, S2, S3, S4). The theme
colour lives in the cyan containment ring, the vent and the hazard band
on the pedestal (C3). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _props import dots, hull, ngon_prism, slats
from pnkit import box, edges
import pnshapes
from pnshapes import coords, facets
from voxgrid import PALETTE, RAMP_SHADES, Asset, Grid, Part

W, H, D = 26, 38, 26
CX, CZ = 13.0, 13.0
PED = 15  # top of the pedestal


def pedestal() -> Grid:
    g = Grid(W, PED + 4, D)
    X, Y, Z = coords(g)
    rad = np.hypot(X - CX, Z - CZ)

    base = ngon_prism(g, "y", CX, CZ, 11.0, 0, 5, "iron", 4, n=6)
    P.flat(g, base, "iron", 4)
    P.flat(g, base & (Y > 4), "iron", 5)
    pnpaint.hazard(g, base & (Y > 0.5) & (Y < 2.5), period=6, a=("orange", 5), b=("iron", 3), frame="wall")
    P.flat(g, base & (Y < 1), "iron", 2)

    col = ngon_prism(g, "y", CX, CZ, 8.0, 5, PED - 2, "steel", 4, n=6)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "steel", 4, size=(7, 6), frame=fr)
    P.flat(g, col & (np.abs(Y - 10) < 1.1), "bone", 6)  # one white hull band
    P.flat(g, col & (np.abs(Y - 10) < 0.4), "bone", 7)

    collar = ngon_prism(g, "y", CX, CZ, 9.5, PED - 2, PED, "rust", 5, n=6)
    P.flat(g, collar, "rust", 5)
    P.flat(g, collar & (Y > PED - 1), "rust", 6)
    cap = ngon_prism(g, "y", CX, CZ, 8.0, PED, PED + 1, "steel", 5, n=6)
    P.flat(g, cap, "steel", 5)
    P.flat(g, cap & (rad < 6.0), "cyan", 6)  # the containment ring glows
    P.flat(g, cap & (rad < 4.4), "cyan", 7)

    # A steel socket collar and four tall copper clamp arms hold the head,
    # so the bust and the pedestal read as one object (F3).
    sock = ngon_prism(g, "y", CX, CZ, 7.0, PED + 1, PED + 3, "steel", 4, n=6)
    P.flat(g, sock, "steel", 4)
    P.flat(g, sock & (Y > PED + 2), "steel", 5)
    P.flat(g, sock & (rad < 5.6), "steel", 2)
    for ang in (0.5, 2.6, 3.7, 5.8):
        ax, az = CX + 5.6 * np.cos(ang), CZ + 5.6 * np.sin(ang)
        arm = box(g, ax - 1.5, PED + 1, az - 1.5, ax + 1.5, PED + 7, az + 1.5, "rust", 5)
        P.flat(g, arm & (Y > PED + 5.5), "rust", 6)
        P.flat(g, arm & (Y < PED + 2.5), "rust", 3)
        P.flat(g, arm & (np.abs(Y - (PED + 4)) < 0.6), "steel", 5)  # the clamp bolt
    return g


def skull() -> Grid:
    """The cranium: the house skull shape, alien-sized, painted as hull
    plate with panel seams, rivets and a sensor visor, plus two thick
    back-swept fins with copper tips (F2, F3, S2, S4)."""
    S = 15
    g = Grid(22, 24, 23)
    X, Y, Z = coords(g)
    m = pnshapes.skull(g, 11.0, 1, 10.0, s=S, ramp="bone", base=6, eyes=("cyan", 7), socket=("iron", 1), seed=5)
    bone = m & (g.a // RAMP_SHADES == PALETTE["ramps"]["bone"])

    # Close tones instead of per-voxel mottle: a lit crown, a dark underside
    # and a framed edge (S3, S4).
    P.flat(g, bone, "bone", 6)
    P.flat(g, bone & (Y > 15), "bone", 7)
    P.flat(g, bone & (Y < 6), "bone", 5)
    P.flat(g, edges(m) & bone, "bone", 3)

    # Hull panel seams and rivet dots across the cranium (S1, S2).
    crown = bone & (Y > 10)
    P.flat(g, crown & (np.abs(X - 11) < 0.6) & (Z > 5), "bone", 4)       # the crown ridge
    for yy in (12.5, 16.5):
        P.flat(g, crown & (np.abs(Y - yy) < 0.5), "bone", 4)             # two ring seams
        for xx in (5.5, 8.5, 13.5, 16.5):
            P.flat(g, crown & (np.abs(Y - yy) < 0.5) & (np.abs(X - xx) < 0.6), "bone", 7)
    P.flat(g, bone & (np.abs(Z - 10) < 0.5) & (Y > 17), "bone", 4)

    # A dark sensor visor across the brow with one cyan eye (C3).
    visor = m & (Z < 6.2) & (Y > 10.0) & (Y < 12.5)
    P.flat(g, visor, "iron", 2)
    P.flat(g, visor & (np.abs(X - 11) < 4.5) & (Y > 10.6) & (Y < 11.9), "cyan", 6)
    P.flat(g, visor & (np.abs(X - 11) < 4.5) & (Y > 11.1) & (Y < 11.9), "cyan", 7)
    P.flat(g, visor & (np.abs(X - 11) < 1.2), "steel", 4)

    # Two thick back-swept fins with copper tips (F3, F4).
    for x0, x1 in ((3, 7), (15, 19)):
        g.prism("x", [(13, 11), (17, 12), (19, 21), (13.5, 19)], x0, x1, P.C("bone", 6))
        fin = g.solids[-1].mask(g.shape)
        for mm, fr in facets(g, g.solids[-1:]):
            P.flat(g, mm, "bone", 6)
        P.flat(g, fin & (Y > 17), "bone", 7)
        P.flat(g, edges(fin), "bone", 3)
        P.flat(g, fin & (Z > 17.5), "rust", 5)
        P.flat(g, fin & (Z > 19.0), "rust", 6)
        P.flat(g, fin & (np.abs(Z - 15) < 0.5), "bone", 4)
        P.flat(g, fin & (np.abs(Z - 12.5) < 0.5), "bone", 4)

    # A copper neck band where the cranium meets the socket collar.
    neck = m & (Y > 3.5) & (Y < 5.5)
    P.flat(g, neck, "rust", 5)
    P.flat(g, neck & (Y > 4.5), "rust", 6)
    P.flat(g, neck & (np.floor(X) % 3 == 0), "rust", 3)

    # One framed glow vent on the back, instead of two stray cyan patches.
    back = (g.a != 0) & (Z > 13.5) & (Y > 8) & (Y < 15) & (np.abs(X - 11) < 4.5)
    P.flat(g, back, "iron", 2)
    P.flat(g, back & (np.abs(X - 11) < 3.5) & (Y > 8.6) & (Y < 14.4), "cyan", 5)
    P.flat(g, back & (np.abs(X - 11) < 3.5) & (Y > 8.6) & (Y < 14.4) & (np.floor(Y) % 2 == 0), "iron", 3)
    P.flat(g, back & (np.abs(X - 11) < 3.5) & (np.abs(Y - 11.5) < 0.6), "cyan", 7)
    return g


def build() -> Asset:
    root = Part("alien-skull-relic", pedestal())
    root.add(Part("skull", skull(), pivot=(11.0, 0.0, 10.0), at=(CX, float(PED) + 2.0, CZ + 1.0), rot=(0.0, -7.0, 0.0)))
    return Asset(id="space-props-alien-skull-relic", pack="space", category="props", name="Alien Specimen Bust", root=root)
