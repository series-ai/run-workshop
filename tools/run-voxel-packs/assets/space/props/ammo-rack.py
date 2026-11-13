"""Munitions rack, in the Pirate Nation mecha style.

One iconic shape (rule K3): a chunky steel cabinet on a dark hazard plinth,
with a wide open bay. The bay is lined with warm white hull panels, so four
oversized copper shells with cyan charge windows and a row of teal power
cells read at thumbnail size (F6). An oversized hazard-orange sign leans back
off the top rail on two visible steel brackets (F4, F5). White hull panels,
copper trim and a cyan strip carry the theme on every side (C1, C3). Detail
is paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import bolt_row, cham_prism, dots, hull, ngon_prism, service_panel, slats
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 26, 30, 16
X0, X1, Z0, Z1 = 1, 25, 2, 14
Y0, Y1 = 4, 28  # cabinet body
BX0, BX1 = X0 + 3, X1 - 3  # the open bay
BY0, BY1 = Y0 + 2, Y1 - 4
SHELF = 15


def rack() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Dark plinth with one clean hazard band along its front lip.
    plinth = box(g, X0 - 1, 0, Z0 - 1, X1 + 1, Y0, Z1 + 1, "iron", 4)
    P.flat(g, plinth & (Y > Y0 - 1.5), "iron", 5)
    pnpaint.hazard(g, plinth & (Y > 0) & (Y < 3), period=6, a=("orange", 5), b=("iron", 3), frame="wall")
    P.flat(g, edges(plinth), "iron", 2)

    # The cabinet: a chamfered steel block (true diagonals at the corners).
    cham_prism(g, "y", X0, Z0, X1, Z1, 2.5, Y0, Y1, "steel", 4)
    body = g.solids[-1].mask(g.shape)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "steel", 4, size=(9, 7), frame=fr)
    P.flat(g, edges(body), "steel", 2)

    # Open the bay and line it with white hull, so the contents read bright.
    bay = P.region(g, BX0, BY0, Z0 - 2, BX1, BY1, Z0 + 6)
    g.carve(bay)
    liner = body & ~bay & (X > BX0 - 1.5) & (X < BX1 + 0.5) & (Y > BY0 - 1.5) & (Y < BY1 + 0.5)
    P.flat(g, liner & (g.a != 0), "bone", 6)
    hull(g, liner & (g.a != 0), "bone", 6, size=(8, 6), edge=2, seed=3)
    # A steel lip frames the opening (S4).
    lip = body & (g.a != 0) & (Z < Z0 + 1) & (
        ((X > BX0 - 2.5) & (X < BX0 + 0.5)) | ((X > BX1 - 1.5) & (X < BX1 + 1.5))
        | ((Y > BY0 - 2.5) & (Y < BY0 + 0.5)) | ((Y > BY1 - 1.5) & (Y < BY1 + 1.5))
    )
    P.flat(g, lip, "steel", 3)
    P.flat(g, lip & ((X < BX0 - 1.5) | (X > BX1 + 0.5) | (Y < BY0 - 1.5) | (Y > BY1 + 0.5)), "steel", 2)

    # One mid shelf, copper-faced so the two tiers separate at a glance.
    shelf = box(g, BX0, SHELF, Z0 - 2, BX1, SHELF + 2, Z0 + 6, "steel", 5)
    P.flat(g, shelf & (Z < Z0 - 0.5), "rust", 5)
    P.flat(g, edges(shelf), "steel", 2)

    # Lower tier: four oversized copper shells with a cyan charge window.
    for cx in (6.5, 13.0, 19.5):
        shell = ngon_prism(g, "y", cx, 4.6, 2.5, Y0 + 2, SHELF, "rust", 5, n=8)
        P.flat(g, shell, "rust", 5)
        P.flat(g, shell & (Z < 3.5), "rust", 6)
        P.flat(g, shell & (Y > SHELF - 2), "steel", 3)  # collar
        P.flat(g, shell & (Y > Y0 + 8) & (Y < Y0 + 10), "bone", 6)  # painted band
        win = shell & (Y > Y0 + 4) & (Y < Y0 + 7) & (Z < 3.5) & (np.abs(X - cx) < 1.6)
        P.flat(g, win, "cyan", 6)
        P.flat(g, win & (Y < Y0 + 6), "cyan", 7)
        P.flat(g, shell & (Y > Y0 + 1.5) & (Y < Y0 + 3), "iron", 4)  # base ring
    # A copper retaining rail across the lower tier, inside the frame.
    rail = box(g, BX0, 12, Z0 - 2, BX1, 13, Z0 - 1, "rust", 4)
    P.flat(g, rail & (X > BX0 + 1) & (X < BX1 - 1), "rust", 6)
    # Steel end caps close both ends of the shelf, so nothing hangs loose.
    for ex in (BX0 - 1, BX1):
        cap = box(g, ex, SHELF - 1, Z0 - 2, ex + 1, BY1, Z0 + 6, "steel", 4)
        P.flat(g, cap & (Z < Z0 - 0.5), "steel", 5)
        P.flat(g, cap & (Y < SHELF + 0.5), "steel", 3)
        P.flat(g, cap & (Y > BY1 - 1.5), "steel", 3)

    # Upper tier: six teal power cells in white hull sleeves.
    for cx in (6.0, 9.5, 13.0, 16.5, 20.0):
        cell = box(g, cx - 1.4, SHELF + 2, Z0 - 2, cx + 1.4, BY1 - 1, Z0 + 2, "bone", 6)
        P.flat(g, edges(cell), "bone", 3)
        face = cell & (Z < Z0 - 1)
        P.flat(g, face & (Y > SHELF + 4) & (Y < BY1 - 2), "cyan", 6)
        P.flat(g, face & (Y > SHELF + 5) & (Y < BY1 - 3), "cyan", 7)
        P.flat(g, cell & (Y > BY1 - 2.5), "rust", 5)  # contact cap

    # The two broad sides: one framed white hull panel each, with a stencil.
    for face_m, lo in ((body & (X < X0 + 1), None), (body & (X > X1 - 1), None)):
        pan = face_m & (g.a != 0) & (Y > Y0 + 5) & (Y < Y1 - 6) & (Z > Z0 + 2.5) & (Z < Z1 - 2.5)
        hull(g, pan, "bone", 6, size=(6, 5), edge=3, seed=5)
    for xm in (body & (g.a != 0) & (X < X0 + 1), body & (g.a != 0) & (X > X1 - 1)):
        P.flat(g, xm & (Y > Y0 + 1) & (Y < Y0 + 4), "orange", 5)
        P.flat(g, xm & (Y > Y1 - 5) & (Y < Y1 - 3), "rust", 5)
        for yy in (Y0 + 7, Y0 + 9, Y0 + 11):  # painted vent slots
            P.flat(g, xm & (np.abs(Y - yy) < 0.6) & (Z > Z0 + 4) & (Z < Z1 - 4), "steel", 2)
    for xm in (body & (g.a != 0) & (X < X0 + 1), body & (g.a != 0) & (X > X1 - 1)):
        P.flat(g, xm & (Y > Y0 + 13) & (Y < Y0 + 17) & (Z > Z0 + 3) & (Z < Z0 + 7), "rust", 5)

    # The back: a white hull face in a steel frame, broken into two broad
    # service panels with a vent and one substantial copper latch (S4).
    back = body & (g.a != 0) & (Z > Z1 - 1)
    P.flat(g, back, "bone", 6)
    P.plates(g, back, "bone", 6, size=(11, 9), frame="z")
    P.flat(g, back & (Y < Y0 + 3), "steel", 3)  # steel kick plate
    P.flat(g, back & (np.abs(Y - (Y0 + 3)) < 0.6), "steel", 2)
    P.outline(g, back, "steel", 3, normal="z")
    service_panel(g, back, "+z", X0 + 2.0, Y0 + 4, 12.0, Y1 - 5, "bone", 6, rim=("steel", 3))
    service_panel(g, back, "+z", 14.0, Y0 + 4, X1 - 2.0, Y1 - 5, "bone", 6, rim=("steel", 3))
    slats(g, back, "+z", 15.0, Y1 - 11, X1 - 3.0, Y1 - 6.5, "steel", 2, 5, rim=("steel", 4))
    P.flat(g, back & (Y > Y1 - 4) & (Y < Y1 - 2), "rust", 5)  # copper trim band
    P.flat(g, back & (np.abs(Y - (Y1 - 3)) < 0.4), "rust", 6)
    bolt_row(g, back, "+z", (Y1 - 3.5,), X0 + 3, X1 - 2, 5.0, "rust", 3)
    # One substantial copper latch across the seam, with a steel keeper.
    keeper = box(g, 11, 12, Z1, 15, 22, Z1 + 1, "steel", 4)
    P.flat(g, keeper & (np.abs(Y - 17) > 3.5), "steel", 5)
    P.flat(g, keeper & ((X < 12) | (X > 14)), "steel", 5)
    P.flat(g, keeper & (Y > 12) & (Y < 21) & (X > 11.5) & (X < 14.5), "steel", 2)
    latch = box(g, 12, 14, Z1, 14, 20, Z1 + 2, "rust", 5)
    P.flat(g, latch & (Y > 18.5), "rust", 6)
    P.flat(g, latch & (Y < 15.5), "rust", 4)
    strip = back & (Y > Y1 - 2) & (Y < Y1 - 1) & (X > X0 + 3) & (X < X1 - 3)
    P.flat(g, strip, "cyan", 6)
    P.flat(g, strip & (np.floor(X) % 4 == 0), "cyan", 7)
    dots(g, back, "+z", [(6.5, 8.5), (9.5, 8.5)], 1.0, "cyan", 6, hi=("cyan", 7))
    dots(g, back, "+z", [(19.5, 8.5)], 1.0, "orange", 6)
    pnglyph.icon(g, "+z", Z1 - 1, 5, 10, "gear", "bone", 3, depth=2)

    # Top deck: a copper vent bar between the two sign brackets.
    top = body & (g.a != 0) & (Y > Y1 - 1.5)
    P.flat(g, top, "steel", 3)
    grille = top & (X > X0 + 4) & (X < X1 - 4) & (Z > Z0 + 4) & (Z < Z1 - 1)
    P.flat(g, grille, "rust", 4)
    P.flat(g, grille & (np.floor(X) % 3 == 0), "rust", 6)
    P.flat(g, body & (g.a != 0) & (Y > Y1 - 1.5) & (Z > Z1 - 2), "steel", 2)
    for bx in (5, 18):  # the two brackets the sign stands on
        br = box(g, bx, Y1, Z0 + 1, bx + 3, Y1 + 3, Z0 + 5, "steel", 4)
        P.flat(g, br & (Y > Y1 + 2), "steel", 5)
        P.flat(g, br & (Y > Y1 + 1) & (Y < Y1 + 2), "steel", 2)
        P.flat(g, edges(br), "steel", 2)
        boss = box(g, bx - 1, Y1 + 1, Z0 + 2, bx + 4, Y1 + 3, Z0 + 4, "rust", 5)  # the hinge boss
        P.flat(g, boss & (Y > Y1 + 2), "rust", 6)
        P.flat(g, edges(boss), "rust", 3)
    # A spine bar ties the two brackets together, so the sign is carried.
    spine = box(g, 7, Y1, Z0 + 2, 19, Y1 + 2, Z0 + 4, "steel", 3)
    P.flat(g, spine & (Y > Y1 + 1), "steel", 4)
    P.flat(g, edges(spine), "steel", 2)
    return g


def sign() -> Grid:
    """The oversized status board: a cyan readout over a hazard chevron
    band, in a steel casing whose back carries vents and a mount plate."""
    gw, gh = 18, 11
    g = Grid(gw, gh, 4)
    X, Y, Z = coords(g)
    plate = box(g, 0, 0, 0, gw, gh, 3, "steel", 4)
    P.plates(g, plate, "steel", 4, size=(8, 6), frame="z")
    P.flat(g, edges(plate), "steel", 2)
    front = plate & (Z < 1)
    P.flat(g, front, "steel", 3)
    P.flat(g, front & ((Y < 1) | (Y > gh - 1) | (X < 1) | (X > gw - 1)), "steel", 2)
    # The lower two thirds: a hazard chevron band in a framed well.
    chev = front & (Y > 1) & (Y < gh - 5) & (X > 1) & (X < gw - 1)
    pnpaint.hazard(g, chev, period=8, a=("orange", 5), b=("iron", 3), frame="z")
    P.outline(g, chev, "iron", 2, normal="z")
    # The upper third: a working cyan readout with tick bars and a cursor.
    scr = front & (Y > gh - 5) & (Y < gh - 1) & (X > 1) & (X < gw - 1)
    P.flat(g, scr, "cyan", 3)
    P.flat(g, scr & (np.floor(Y) % 2 == 0), "cyan", 4)
    for cx, h in ((3.5, 1), (5.5, 3), (7.5, 2), (9.5, 3), (11.5, 1)):
        P.flat(g, scr & (np.abs(X - cx) < 0.7) & (Y > gh - 5) & (Y < gh - 5 + h + 0.5), "cyan", 7)
    P.flat(g, scr & (np.abs(Y - (gh - 1.5)) < 0.6) & (X > 2) & (X < gw - 4), "cyan", 6)
    P.flat(g, scr & (X > gw - 4) & (X < gw - 2) & (Y > gh - 4) & (Y < gh - 2), "orange", 6)
    P.outline(g, scr, "iron", 2, normal="z")
    # The casing back: a chamfered bevel, a vented panel and a mount plate.
    back = plate & (Z > 2)
    P.flat(g, back, "steel", 4)
    P.flat(g, back & ((Y < 1) | (Y > gh - 1) | (X < 1) | (X > gw - 1)), "steel", 2)
    P.flat(g, back & (X > 1) & (X < 8) & (Y > 2) & (Y < gh - 2), "steel", 5)
    P.flat(g, back & (X > 1) & (X < 8) & (Y > 2) & (Y < gh - 2) & (np.floor(Y) % 2 == 0), "steel", 2)
    P.flat(g, back & (X > 9) & (X < gw - 2) & (Y > 2) & (Y < gh - 2), "bone", 5)
    P.outline(g, back & (X > 9) & (X < gw - 2) & (Y > 2) & (Y < gh - 2), "steel", 2, normal="z")
    for cx in (10.5, gw - 3.5):
        for cy in (3.5, gh - 3.5):
            P.flat(g, back & (np.abs(X - cx) < 0.7) & (np.abs(Y - cy) < 0.7), "rust", 5)
    mount = box(g, 4, 0, 2, gw - 4, 3, 4, "steel", 3)  # the mount plate and stand
    P.flat(g, mount & (Y > 1.5), "steel", 4)
    P.flat(g, edges(mount), "steel", 2)
    return g


def build() -> Asset:
    root = Part("ammo-rack", rack())
    root.add(Part("sign", sign(), pivot=(9.0, 0.0, 3.0), at=(13.0, float(Y1), float(Z0) + 3.0), rot=(-9.0, 0.0, 2.0)))
    return Asset(id="space-props-ammo-rack", pack="space", category="props", name="Munitions Ammo Rack", root=root)
