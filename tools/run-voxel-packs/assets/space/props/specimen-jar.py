"""Xenobiology specimen containment jar, in the Pirate Nation mecha style.

One iconic shape (rule K3): a pressurized laboratory jar on a steel plinth.
The plinth is plated, vented and bolted, with a hazard band and a cyan
readout (S2, S4). An 8-gon cyan containment cylinder is held between two
copper clamp collars by four dark steel frame struts on the diagonal
facets (F3), and carries a bright fluid line and a lit core. The front
facet shows a pale alien specimen with a dark outline, an orange eye,
and two limbs. The specimen stays inside the glass (C3, K3).
A framed white hull label sits in the
head space above the fluid. A steel locking collar with four copper clamp
lugs and a cyan pilot light caps the jar, so nothing reads as a cork.
Cold vapour drifts from the top vent. Detail is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _props import ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part, Socket

W, H, D = 22, 32, 24
CX, CZ = 11.0, 13.0
R_JAR = 7.5
GY0, GY1 = 9, 24  # the glass between the collars


def jar() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    rad = np.hypot(X - CX, Z - CZ)
    ang = np.arctan2(Z - CZ, X - CX)

    # The plinth: a steel 8-gon, plated and bolted, with a hazard band.
    plinth = ngon_prism(g, "y", CX, CZ, R_JAR + 2.0, 0, 6, "steel", 5, n=8)
    for f, fr in facets(g, g.solids[-1:]):
        P.plates(g, f, "steel", 5, size=(9, 6), rivets=False, frame=fr)
    P.flat(g, plinth & (Y < 1.0), "steel", 3)
    pnpaint.hazard(g, plinth & (Y > 1.5) & (Y < 3.5), period=5, a=("orange", 5), b=("steel", 4), frame="wall")
    P.flat(g, plinth & (Y > 5), "steel", 6)
    P.flat(g, plinth & (Y > 5) & (rad < R_JAR + 1.0), "steel", 4)
    P.flat(g, plinth & (Y > 5) & (rad > R_JAR + 1.6), "steel", 3)
    # A slatted vent on the back and a cyan readout on the front.
    vent = plinth & (Z > CZ + R_JAR + 0.5) & (Y > 3.6) & (Y < 5.6) & (np.abs(X - CX) < 3.5)
    P.flat(g, vent, "steel", 3)
    P.flat(g, vent & (np.floor(Y) % 2 == 0), "steel", 6)
    disp = box(g, CX - 3.5, 3, 2, CX + 3.5, 6, 3, "steel", 3)
    face = disp & (Z < 2.5)
    P.flat(g, face, "cyan", 5)
    P.flat(g, face & (np.floor(Y) % 2 == 0), "cyan", 7)
    P.flat(g, face & (X > CX + 2.0), "cyan", 3)
    P.outline(g, face, "steel", 2, normal="z")

    # Lower copper clamp collar.
    collar_b = ngon_prism(g, "y", CX, CZ, R_JAR + 0.8, 6, 9, "rust", 5, n=8)
    P.flat(g, collar_b, "rust", 5)
    P.flat(g, collar_b & (Y > 8), "rust", 6)
    P.flat(g, collar_b & (np.floor(X) % 4 == 0), "rust", 3)  # clamp bolts
    P.flat(g, edges(collar_b), "rust", 3)

    # The containment cylinder: cyan fluid with a lit core and a fluid line.
    cyl = ngon_prism(g, "y", CX, CZ, R_JAR, GY0, GY1, "cyan", 4, n=8)
    P.flat(g, cyl, "cyan", 5)
    P.flat(g, cyl & (Y > GY0 + 2) & (Y < GY1 - 3), "cyan", 6)
    P.flat(g, cyl & (Y > GY0 + 5) & (Y < GY1 - 6), "cyan", 7)
    P.flat(g, cyl & (Y < GY0 + 1.5), "cyan", 3)
    P.flat(g, cyl & (np.abs(Y - (GY1 - 3.5)) < 0.6), "bone", 7)   # the fluid line
    P.flat(g, cyl & (Y > GY1 - 3), "cyan", 2)                     # head space above it
    # Four dark steel struts carry the glass between the collars (F3).
    strut = np.zeros(g.shape, dtype=bool)
    for a0 in (0.785, 2.356, -2.356, -0.785):
        strut |= cyl & (np.abs(np.angle(np.exp(1j * (ang - a0)))) < 0.13)
    P.flat(g, strut, "steel", 4)
    P.flat(g, strut & (np.abs(np.angle(np.exp(1j * (ang - 0.785)))) < 0.05), "steel", 5)
    P.flat(g, strut & (Y > GY1 - 2), "steel", 3)
    P.flat(g, strut & (Y < GY0 + 2), "steel", 3)
    for yy in (GY0 + 4, GY0 + 9):  # bolted cross ties on every strut
        P.flat(g, strut & (np.abs(Y - yy) < 0.6), "steel", 6)

    # Paint the specimen on the front glass. The cylinder stays flush.
    PY_ = 17.0
    front_glass = cyl & (Z < CZ - R_JAR + 1.2)
    oval = front_glass & (((X - CX) / 4.3) ** 2 + ((Y - PY_) / 5.2) ** 2 < 1.0)
    P.flat(g, oval, "teal", 3)
    body = oval & (((X - CX) / 2.8) ** 2 + ((Y - PY_) / 3.5) ** 2 < 1.0)
    P.flat(g, body, "bone", 6)
    P.flat(g, body & (Y > PY_ + 1.5), "bone", 7)
    eye = body & (np.abs(X - CX) < 1.3) & (np.abs(Y - (PY_ + 0.7)) < 1.3)
    P.flat(g, eye, "orange", 6)
    P.flat(g, eye & (np.abs(X - CX) < 0.5), "iron", 2)
    for tx in (-2.0, 2.0):
        limb = front_glass & (np.abs(X - (CX + tx)) < 0.9) & (Y > PY_ - 5.2) & (Y < PY_ - 2.4)
        P.flat(g, limb, "bone", 5)

    # A framed white hull label in the head space above the fluid line.
    label = cyl & (Z < CZ - R_JAR + 1.0) & (np.abs(X - CX) < 2.6) & (Y > GY1 - 2.6) & (Y < GY1 - 0.4)
    P.flat(g, label, "iron", 2)
    P.flat(g, label & (np.abs(X - CX) < 1.6) & (Y > GY1 - 2.4) & (Y < GY1 - 0.6), "bone", 6)
    P.flat(g, label & (np.abs(X - CX) < 0.6) & (Y > GY1 - 2.4) & (Y < GY1 - 0.6), "orange", 5)

    # Upper copper clamp collar.
    collar_t = ngon_prism(g, "y", CX, CZ, R_JAR + 0.8, GY1, GY1 + 3, "rust", 5, n=8)
    P.flat(g, collar_t, "rust", 5)
    P.flat(g, collar_t & (Y > GY1 + 2), "rust", 6)
    P.flat(g, collar_t & (np.floor(X) % 4 == 0), "rust", 3)
    P.flat(g, edges(collar_t), "rust", 3)

    # The lid: a sloped steel cap, a locking collar with four copper clamp
    # lugs and a short vent stack with a cyan pilot light (no cork).
    lid = ngon_prism(g, "y", CX, CZ, R_JAR, GY1 + 3, GY1 + 5, "steel", 5, n=8, r_top=R_JAR - 2.0)
    for f, fr in facets(g, g.solids[-1:]):
        P.flat(g, f, "steel", 5)
    P.flat(g, lid & (Y > GY1 + 4), "steel", 6)
    P.flat(g, lid & (Y > GY1 + 4) & (rad > R_JAR - 2.6), "steel", 4)
    P.flat(g, lid & (Y < GY1 + 3.6), "steel", 4)
    lock = ngon_prism(g, "y", CX, CZ, 4.0, GY1 + 5, GY1 + 6, "steel", 6, n=8)
    P.flat(g, lock, "steel", 6)
    P.flat(g, lock & (Y > GY1 + 5.5), "steel", 7)
    for a0 in (0.0, 1.571, 3.142, -1.571):  # four copper clamp lugs
        lx, lz = CX + 4.0 * np.cos(a0), CZ + 4.0 * np.sin(a0)
        lug = box(g, lx - 1.5, GY1 + 4, lz - 1.5, lx + 1.5, GY1 + 6, lz + 1.5, "rust", 5)
        P.flat(g, lug & (Y > GY1 + 5), "rust", 6)
        P.flat(g, edges(lug), "rust", 3)
    stack = ngon_prism(g, "y", CX, CZ, 2.4, GY1 + 6, GY1 + 8, "steel", 5, n=8)
    P.flat(g, stack, "steel", 5)
    P.flat(g, stack & (Y > GY1 + 7), "cyan", 7)
    return g


def build() -> Asset:
    root = Part("specimen-jar", jar())
    socket_spores = Socket("socket-spores", at=(float(CX), float(H), float(CZ)))
    return Asset(
        id="space-props-specimen-jar",
        pack="space",
        category="props",
        name="Xenobiology Specimen Jar",
        root=root,
        sockets=[socket_spores],
        pfx=[{"effectId": "rvx-space-spore-drift", "socket": "socket-spores", "trigger": "idle", "size": 14}],
    )
