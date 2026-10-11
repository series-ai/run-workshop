"""Drone launch crate, in the Pirate Nation mecha style.

One iconic shape (rule K3): a chunky chamfered steel crate (true diagonals,
F2) whose four sides are clean white hull panels, each framed dark and
crossed by one deliberate hazard-orange band (S3, S4). The oversized
function prop is the launch dome on the lid: a big glowing cyan lens in a
copper ring with four clean bolt caps (F4). A copper hatch with a latch
light marks the front. Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _props import bolt_row, cham_prism, dots, ngon_prism, service_panel, slats
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 26, 27, 24
X0, X1, Z0, Z1 = 1, 25, 1, 23
Y0, Y1 = 3, 19  # the crate body
CX, CZ = 13.0, 12.0


def crate() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Steel skids with hazard-orange end caps: the base reads in a thumbnail.
    for z0 in (Z0 + 1, Z1 - 4):
        sk = box(g, X0 - 1, 0, z0, X1 + 1, Y0, z0 + 3, "steel", 3)
        P.flat(g, sk & (Y > Y0 - 1.5), "steel", 4)
        P.flat(g, sk & (np.floor(X) % 5 == 0), "steel", 2)
        P.flat(g, sk & ((X < X0 + 2) | (X > X1 - 2)), "orange", 5)
        P.flat(g, sk & ((X < X0 + 2) | (X > X1 - 2)) & (Y > Y0 - 1.5), "orange", 6)
        P.flat(g, edges(sk), "iron", 2)

    # The chamfered steel frame.
    cham_prism(g, "y", X0, Z0, X1, Z1, 3.0, Y0, Y1, "steel", 4)
    body = g.solids[-1].mask(g.shape)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "steel", 4, size=(8, 7), frame=fr)
    P.flat(g, edges(body), "steel", 2)

    # Every side: a white hull field in a steel frame, with one hazard band,
    # a framed service panel, bolt rows and a vent, so no face is bare (S4).
    sides = (
        ("-z", body & (Z < Z0 + 1), X, X0 + 4, X1 - 4),
        ("+z", body & (Z > Z1 - 1), X, X0 + 4, X1 - 4),
        ("-x", body & (X < X0 + 1), Z, Z0 + 4, Z1 - 4),
        ("+x", body & (X > X1 - 1), Z, Z0 + 4, Z1 - 4),
    )
    nrm = {"-z": "z", "+z": "z", "-x": "x", "+x": "x"}
    for k, (face, fm, U, u0, u1) in enumerate(sides):
        wall = fm & (g.a != 0) & (U > u0 - 1) & (U < u1 + 1) & (Y > Y0 + 1) & (Y < Y1 - 1)
        P.flat(g, wall, "bone", 6)
        P.plates(g, wall, "bone", 6, size=(9, 7), frame=nrm[face], seed=2 + k)
        P.outline(g, wall, "steel", 3, normal=nrm[face])
        P.flat(g, wall & (Y > Y1 - 6) & (Y < Y1 - 4), "orange", 5)  # the hazard band
        P.flat(g, wall & (np.abs(Y - (Y1 - 5)) < 0.5), "orange", 3)
        bolt_row(g, wall, face, (Y1 - 5.0,), u0, u1, 6.0, "orange", 3)
        if face == "+z":  # two narrow panels, so the back is not the front
            mid = (u0 + u1) / 2
            service_panel(g, wall, face, u0, Y0 + 2, mid - 0.5, Y1 - 6.5, "bone", 6, rim=("steel", 3), seam=None)
            service_panel(g, wall, face, mid + 0.5, Y0 + 2, u1, Y1 - 6.5, "bone", 6, rim=("steel", 3), seam=None)
        else:
            service_panel(g, wall, face, u0, Y0 + 2, u1, Y1 - 6.5, "bone", 6, rim=("steel", 3))
        if face in ("-x", "+x"):  # a small vent on the two narrow sides
            slats(g, wall, face, u0 + 4.0, Y1 - 3.5, u1 - 4.0, Y1 - 1.5, "steel", 3, 5, rim=("steel", 4))

    # Hazard-orange corner caps and a cyan glow strip on every chamfer pillar.
    dx = np.minimum(X - X0, X1 - X)
    dz = np.minimum(Z - Z0, Z1 - Z)
    pillar = body & (g.a != 0) & (dx + dz < 4.2)
    P.flat(g, pillar, "steel", 4)
    P.flat(g, pillar & (dx + dz > 3.0), "steel", 5)
    P.flat(g, pillar & (Y < Y0 + 4), "orange", 5)
    P.flat(g, pillar & (Y < Y0 + 4) & (dx + dz > 3.0), "orange", 6)
    P.flat(g, pillar & (Y > Y1 - 4), "orange", 5)
    P.flat(g, pillar & (Y > Y1 - 4) & (dx + dz > 3.0), "orange", 6)
    P.flat(g, pillar & (Y > Y0 + 5) & (Y < Y1 - 5) & (dx + dz > 3.0), "cyan", 6)
    P.flat(g, pillar & (Y > Y0 + 5) & (Y < Y1 - 5) & (dx + dz > 3.0) & (np.floor(Y) % 3 == 0), "cyan", 7)

    # The front hatch: copper, with a latch light and a dark seam.
    hatch = body & (Z < Z0 + 1) & (X > X0 + 7) & (X < X1 - 7) & (Y > Y0 + 4) & (Y < Y1 - 7)
    P.flat(g, hatch, "rust", 5)
    P.flat(g, hatch & (np.abs(X - CX) < 0.6), "rust", 3)
    P.flat(g, hatch & (Y > Y1 - 8.5), "rust", 6)
    P.flat(g, hatch & (Y < Y0 + 5.5), "rust", 4)
    P.outline(g, hatch, "steel", 3, normal="z")
    dots(g, body & (Z < Z0 + 1), "-z", [(CX, Y0 + 5.5)], 1.0, "cyan", 7)

    # The lid: a steel deck with four bolt caps and the launch dome.
    lid = box(g, X0 + 1, Y1, Z0 + 1, X1 - 1, Y1 + 2, Z1 - 1, "steel", 5)
    P.plates(g, lid, "steel", 5, size=(7, 7), frame="top")
    P.flat(g, edges(lid), "steel", 2)
    for x0 in (X0 + 2, X1 - 5):
        for z0 in (Z0 + 2, Z1 - 5):
            cap = box(g, x0, Y1 + 2, z0, x0 + 3, Y1 + 3, z0 + 3, "orange", 5)
            P.flat(g, cap & (Y > Y1 + 2.4), "orange", 6)
    ring = ngon_prism(g, "y", CX, CZ, 6.4, Y1 + 2, Y1 + 4, "rust", 5, n=8)
    rad = np.hypot(X - CX, Z - CZ)
    P.flat(g, ring, "rust", 4)
    P.flat(g, ring & (Y > Y1 + 3), "rust", 6)
    P.flat(g, ring & (Y > Y1 + 3) & (rad < 5.4), "rust", 3)
    # The core: a bright glowing lens, lit right through to the rim.
    lens = ngon_prism(g, "y", CX, CZ, 4.6, Y1 + 3, Y1 + 6, "cyan", 5, n=8, r_top=3.2)
    for m, fr in facets(g, g.solids[-1:]):
        P.flat(g, m, "cyan", 5)
    P.flat(g, lens & (Y > Y1 + 4), "cyan", 6)
    P.flat(g, lens & (Y > Y1 + 5), "cyan", 7)
    P.flat(g, lens & (Y < Y1 + 3.6), "cyan", 4)
    P.flat(g, lens & (Y > Y1 + 5.2) & (rad < 2.2), "bone", 7)

    # Corner status lights so the crate reads from every side.
    for face, pts in (("-z", [(X0 + 3, Y1 - 3), (X1 - 3, Y1 - 3)]), ("+z", [(X0 + 3, Y1 - 3), (X1 - 3, Y1 - 3)])):
        dots(g, body & ((Z < Z0 + 1) if face == "-z" else (Z > Z1 - 1)), face, pts, 1.0, "cyan", 6, hi=("cyan", 7))
    return g


def build() -> Asset:
    root = Part("drone-crate", crate())
    return Asset(id="space-props-drone-crate", pack="space", category="props", name="Drone Launch Crate", root=root)
