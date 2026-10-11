"""Dock marker sign, in the Pirate Nation mecha style.

One iconic shape (rule K3): a faceted steel pedestal with a copper collar
and a white hull column, carrying a chunky steel mast that holds one bold
display high and clear of the emitter cap, so nothing looks pasted on
(F3, F6). The display is a cyan field with scan lines in a thick steel
bezel with rivets, and its graphic is a deliberate dock chevron over a
landing bar with even margins. Panel seams, rivet rows, a hazard band and
a glowing cyan seam work the pedestal, the column and the collar, so no
part is plain (S1, S2, S4). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _props import bolt_row, cham_prism, dots, ngon_prism, service_panel, slats
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 24, 40, 24
CX, CZ = 12.0, 12.0
TOP = 20   # top of the copper emitter collar
MAST = 25  # where the display sits


def pedestal() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    rad = np.hypot(X - CX, Z - CZ)

    # The base: a faceted steel plinth with plate seams, bolts, a wide
    # hazard band and a glowing cyan seam under its top lip.
    base = ngon_prism(g, "y", CX, CZ, 10.0, 0, 5, "steel", 5, n=8)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "steel", 5, size=(10, 5), rivets=False, frame=fr)
    P.flat(g, base & (Y < 1), "steel", 3)
    pnpaint.hazard(g, base & (Y > 0.8) & (Y < 3.2), period=6, a=("orange", 5), b=("steel", 3), frame="wall")
    P.flat(g, base & (Y > 3.0) & (Y < 3.8), "cyan", 6)          # the glowing seam
    P.flat(g, base & (Y > 3.0) & (Y < 3.8) & (np.floor(X) % 4 == 0), "cyan", 7)
    P.flat(g, base & (Y > 4), "steel", 6)
    P.flat(g, base & (Y > 4) & (rad < 8.0), "steel", 5)
    P.flat(g, edges(base), "steel", 3)

    # The tapered pedestal: a true slope with plate seams and bolt dots.
    ped = ngon_prism(g, "y", CX, CZ, 8.0, 4, 8, "steel", 5, n=8, r_top=6.0)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "steel", 5, size=(8, 5), rivets=False, frame=fr)
    P.flat(g, ped & (Y > 7), "steel", 6)
    P.flat(g, ped & (Y > 7) & (rad < 5.0), "steel", 5)
    P.flat(g, edges(ped), "steel", 3)

    # The white hull column: a chamfered block whose four broad faces take
    # framed panels, copper bands, rivets, a readout and a vent (S2, S4).
    cham_prism(g, "y", CX - 5.5, CZ - 5.5, CX + 5.5, CZ + 5.5, 2.0, 8, TOP - 3, "bone", 6)
    col = g.solids[-1].mask(g.shape)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "bone", 6, size=(9, 7), frame=fr)
    dxc = np.minimum(X - (CX - 5.5), (CX + 5.5) - X)
    dzc = np.minimum(Z - (CZ - 5.5), (CZ + 5.5) - Z)
    cpost = col & (dxc + dzc < 3.2)
    P.flat(g, cpost, "steel", 4)
    P.flat(g, cpost & (dxc + dzc > 2.0), "steel", 5)
    for yy in (9.0, TOP - 4.0):
        P.flat(g, col & (np.abs(Y - yy) < 0.9), "rust", 5)
        P.flat(g, col & (np.abs(Y - yy) < 0.4), "rust", 6)
    for face, fm, U, u0, u1 in (("-z", col & (Z < CZ - 4.5), X, CX - 4.0, CX + 4.0),
                                ("+z", col & (Z > CZ + 4.5), X, CX - 4.0, CX + 4.0),
                                ("-x", col & (X < CX - 4.5), Z, CZ - 4.0, CZ + 4.0),
                                ("+x", col & (X > CX + 4.5), Z, CZ - 4.0, CZ + 4.0)):
        wall = fm & (g.a != 0) & (Y > 9.6) & (Y < TOP - 4.6)
        service_panel(g, wall, face, u0, 10.0, u1, TOP - 5.0, "bone", 6, rim=("steel", 3), seam=None)
        bolt_row(g, wall, face, (10.5, TOP - 5.5), u0, u1, 4.0, "bone", 7)
    # A teal readout on the front and a slatted vent on the back.
    pan = col & (Z < CZ - 4.5) & (Y > 10.6) & (Y < TOP - 5.6) & (np.abs(X - CX) < 3.0)
    P.flat(g, pan, "cyan", 5)
    P.flat(g, pan & (np.floor(Y) % 2 == 0), "cyan", 6)
    P.flat(g, pan & (np.abs(Y - 11.5) < 0.6) & (X < CX + 1.0), "cyan", 7)
    P.flat(g, pan & (np.abs(Y - 13.5) < 0.6) & (X > CX - 1.0), "cyan", 7)
    P.outline(g, pan, "steel", 2, normal="z")
    slats(g, col & (Z > CZ + 4.5), "+z", CX - 3.0, 10.8, CX + 3.0, TOP - 5.8, "steel", 3, 5, rim=("steel", 4))

    # The copper emitter collar: steel joint plates and a bright cyan lens.
    collar = ngon_prism(g, "y", CX, CZ, 7.0, TOP - 3, TOP, "rust", 5, n=8)
    P.flat(g, collar, "rust", 5)
    P.flat(g, collar & (Y > TOP - 1), "rust", 6)
    for a0 in (0.785, 2.356, -2.356, -0.785):
        jx, jz = CX + 6.2 * np.cos(a0), CZ + 6.2 * np.sin(a0)
        P.flat(g, collar & (np.abs(X - jx) < 1.4) & (np.abs(Z - jz) < 1.4), "steel", 5)
        P.flat(g, collar & (np.abs(X - jx) < 0.7) & (np.abs(Z - jz) < 0.7), "steel", 3)
    P.flat(g, collar & (rad < 5.4) & (Y > TOP - 1), "cyan", 6)
    P.flat(g, collar & (rad < 3.4) & (Y > TOP - 1), "cyan", 7)
    P.flat(g, edges(collar), "rust", 3)

    # The mast: a chunky steel post with copper bands and a cyan strip, so
    # the display is clearly carried and clears the cap (F3).
    mast = box(g, CX - 2.5, TOP, CZ - 2.5, CX + 2.5, MAST, CZ + 2.5, "steel", 5)
    P.flat(g, mast & (Z < CZ - 2.0), "steel", 6)
    P.flat(g, mast & (Z > CZ + 2.0), "steel", 4)
    for yy in (TOP + 1.5, MAST - 2.5):
        P.flat(g, mast & (np.abs(Y - yy) < 0.9), "rust", 5)
        P.flat(g, mast & (np.abs(Y - yy) < 0.4), "rust", 6)
    P.flat(g, mast & (np.abs(X - CX) < 1.1) & (Z < CZ - 2.0), "cyan", 6)
    P.flat(g, edges(mast), "steel", 3)
    # The bracket plate the display bolts onto.
    brk = box(g, CX - 6, MAST - 2, CZ - 1, CX + 6, MAST + 1, CZ + 2, "steel", 5)
    P.flat(g, brk & (Y > MAST - 0.5), "steel", 6)
    P.flat(g, brk & (Y < MAST - 1.0), "steel", 4)
    for bx in (CX - 4.0, CX + 3.0):
        P.flat(g, brk & (np.abs(X - bx) < 0.7) & (Z < CZ - 0.5), "rust", 5)
    P.flat(g, edges(brk), "steel", 3)
    return g


def panel() -> Grid:
    """The display: a cyan field with scan lines in a thick riveted steel
    bezel, carrying one dock chevron over a landing bar (F6)."""
    gw, gh = 26, 13
    g = Grid(gw, gh, 3)
    X, Y, Z = coords(g)
    m = box(g, 0, 0, 0, gw, gh, 2, "steel", 5)
    P.plates(g, m, "steel", 5, size=(9, 7), frame="z")
    P.flat(g, m & (Z > 1), "steel", 4)                       # the casing back
    P.flat(g, m & (Z > 1) & (X > 2) & (X < gw - 2) & (Y > 2) & (Y < gh - 2), "steel", 6)
    P.flat(g, m & (Z > 1) & (np.floor(Y) % 3 == 0) & (X > 3) & (X < gw - 3) & (Y > 2) & (Y < gh - 2), "steel", 3)
    P.flat(g, edges(m), "steel", 4)
    bez = m & (Z < 1)
    P.flat(g, bez, "steel", 6)
    P.flat(g, bez & ((X < 1) | (X > gw - 1) | (Y < 1) | (Y > gh - 1)), "steel", 4)
    for bx in (2.5, gw - 3.5):                               # bezel rivets
        for by in (1.5, gh - 2.5):
            P.flat(g, bez & (np.abs(X - bx) < 0.6) & (np.abs(Y - by) < 0.6), "steel", 7)

    field = bez & (X > 2.5) & (X < gw - 2.5) & (Y > 1.5) & (Y < gh - 1.5)
    P.flat(g, field, "cyan", 6)
    P.flat(g, field & (np.floor(Y) % 2 == 0), "cyan", 7)     # scan lines
    P.outline(g, field, "cyan", 3, normal="z")
    # A header bar with four tick marks across the top of the field.
    head = field & (Y > gh - 4.0)
    P.flat(g, head, "cyan", 3)
    for hx in (5.5, 9.5, 13.5, 17.5):
        P.flat(g, head & (np.abs(X - hx) < 0.6) & (Y < gh - 2.6), "cyan", 7)
    P.flat(g, head & (X > gw - 6.0) & (Y < gh - 2.6), "orange", 6)
    # The graphic: a dock chevron over a landing bar, with even margins.
    cxp = gw / 2.0
    d = np.abs(X - cxp)
    arm = field & (Y > 3.5) & (Y < 9.5) & (np.abs(d - (Y - 3.5)) < 1.3)
    P.flat(g, arm, "cyan", 1)
    P.flat(g, arm & (Y > 4.5) & (np.abs(d - (Y - 3.5)) < 0.6), "cyan", 3)
    bar = field & (Y > 2.0) & (Y < 3.2) & (d < 6.0)
    P.flat(g, bar, "cyan", 1)
    P.flat(g, bar & (d < 5.0) & (Y > 2.4), "cyan", 3)
    return g


def build() -> Asset:
    root = Part("holo-sign", pedestal())
    root.add(Part("panel", panel(), pivot=(13.0, 0.0, 2.0), at=(CX, float(MAST), CZ - 1.5), rot=(0.0, 0.0, -5.0)))
    return Asset(id="space-props-holo-sign", pack="space", category="props", name="Dock Marker Sign", root=root)
