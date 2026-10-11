"""Robot head bust, in the Pirate Nation mecha style.

A display bust of a service droid head, the space pack's answer to the PN
mecha totem (scale class `person-size`). One iconic shape (K3): an oversized
chamfered head in white hull plate, framed in dark steel (F3), with a heavy
copper brow, two square cyan eye panels, a slotted vocoder grille and a
four-light status pad. Copper ear pods sit on the temples and a hazard-orange
crest runs over the crown; an aerial leans off the left temple (F5). The head
turns on a clamped socket collar over a tiered plinth whose four faces carry
framed service panels, a vent, bolt rows and a copper name plate. Detail is
paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
from _props import bolt_row, cham_prism, dots, hull, ngon_prism, service_panel, slats
from pnkit import box, edges
from pnshapes import coords, facets, last
from voxgrid import C, Asset, Clip, Grid, Part, sway

W, H, D = 30, 26, 28     # the plinth grid
PCX, PCZ = 15.0, 14.0    # plinth centre
COLLAR_Y = 24            # the top of the socket collar; the head sits here

HW, HH, HD = 22, 22, 24  # the head grid
HCX, HCZ = 11.0, 12.0


def _frame(g: Grid, m: np.ndarray, ramp: str, shade: int) -> None:
    """A dark 1-voxel outline on the skin of a block (S4)."""
    P.flat(g, edges(m), ramp, shade)


# ------------------------------------------------------------- the plinth --


def plinth() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    skirt = cham_prism(g, "y", 2, 1, 28, 27, 4, 0, 3, "steel", 4)
    for f, fr in facets(g, g.solids[-1:]):
        P.plates(g, f, "steel", 4, size=(6, 3), rivets=True, frame=fr)
    _frame(g, skirt, "steel", 2)
    band = skirt & (Y < 2) & (Y > 0)
    P.flat(g, band, "orange", 5)
    P.flat(g, band & (np.floor((X + Z) / 4) % 2 == 1), "steel", 3)

    bod = cham_prism(g, "y", 4, 3, 26, 25, 3, 3, 18, "bone", 5)
    hull(g, bod, "bone", 5, size=(8, 7), edge=0, rivets=False, seed=4)
    front, back = bod & (Z < 4), bod & (Z > 24)
    left, right = bod & (X < 5), bod & (X > 25)

    # every face is worked: a framed panel, a vent, bolt rows, copper trim
    for face, sel, u0, u1 in (("+z", back, 6.0, 24.0), ("-x", left, 5.0, 23.0), ("+x", right, 5.0, 23.0)):
        service_panel(g, sel, face, u0, 6.0, u1, 15.0, ramp="bone", base=6, rim=("steel", 2))
    slats(g, left, "-x", 8.0, 7.5, 20.0, 10.5, ramp="steel", dark=2, lit=5, rim=("steel", 3))
    slats(g, right, "+x", 8.0, 7.5, 20.0, 10.5, ramp="steel", dark=2, lit=5, rim=("steel", 3))
    slats(g, back, "+z", 9.0, 7.0, 21.0, 11.0, ramp="steel", dark=2, lit=5, rim=("steel", 3))
    for face, sel, u0, u1 in (("-z", front, 5.0, 25.0), ("+z", back, 5.0, 25.0), ("-x", left, 4.0, 24.0), ("+x", right, 4.0, 24.0)):
        bolt_row(g, sel, face, [4.5, 16.5], u0, u1, step=4.0, ramp="steel", shade=3)

    # a copper trim band round the body, real geometry (F3)
    trim = cham_prism(g, "y", 3, 2, 27, 26, 3, 15, 17, "rust", 5)
    P.flat(g, trim & (Y > 16), "rust", 6)
    _frame(g, trim, "rust", 3)

    # the name plate, the one piece of writing on the bust (C3)
    plate = box(g, 4, 3, 1, 26, 15, 4, "rust", 4)
    P.plates(g, plate, "rust", 4, size=(10, 6), rivets=True, frame="z")
    _frame(g, plate, "rust", 2)
    inner = box(g, 5, 4, 0, 25, 14, 2, "bone", 6)
    P.flat(g, inner, "bone", 6)
    P.flat(g, inner & (Y > 12.5), "bone", 7)
    P.outline(g, inner, "bone", 4, normal="z")
    # one deliberate stencil and a cyan readout, with even margins (C3, F6)
    pnglyph.icon(g, "-z", 0, 7, 5, "gear", "steel", 2, depth=2, reach=1)
    rd = inner & (Z < 1) & (X > 17.5) & (X < 24.5) & (Y > 5.5) & (Y < 12.5)
    P.flat(g, rd, "cyan", 4)
    P.flat(g, rd & (np.floor(Y) % 2 == 0) & (X < 23.5), "cyan", 7)
    P.outline(g, rd, "steel", 2, normal="z")
    dots(g, plate & (Z < 2), "-z", [(4.5, 4.0), (25.5, 4.0), (4.5, 14.0), (25.5, 14.0)], 0.9, "gold", 6, hi=("gold", 7))

    corn = cham_prism(g, "y", 2, 1, 28, 27, 4, 18, 21, "steel", 4)
    P.flat(g, corn & (Y > 20), "steel", 5)
    _frame(g, corn, "steel", 2)
    sq = np.maximum(np.abs(X - PCX), np.abs(Z - PCZ))
    P.flat(g, corn & (Y > 20) & (np.abs(sq - 10.0) < 0.6), "rust", 5)
    P.flat(g, corn & (Y > 20) & (np.abs(sq - 8.0) < 0.6), "steel", 3)
    dots(g, corn & (Y > 20), "top", [(6.0, 6.0), (24.0, 6.0), (6.0, 22.0), (24.0, 22.0)], 1.1, "rust", 5, hi=("gold", 7))

    # the socket collar the head clamps into
    col = ngon_prism(g, "y", PCX, PCZ, 7.0, 21, COLLAR_Y, "steel", 3, n=8)
    P.flat(g, col & (Y > COLLAR_Y - 1), "steel", 2)
    P.flat(g, col & (Y < 22), "rust", 5)
    for dx, dz in ((-6, 0), (6, 0), (0, -6), (0, 6)):
        lug = box(g, PCX + dx - 1.5, 20, PCZ + dz - 1.5, PCX + dx + 1.5, COLLAR_Y + 1, PCZ + dz + 1.5, "rust", 5)
        P.flat(g, lug, "rust", 5)
        P.flat(g, lug & (Y > COLLAR_Y), "rust", 6)
        P.flat(g, lug & (Y < 21), "rust", 3)
        P.flat(g, lug & (np.abs(Y - 22.5) < 0.6), "gold", 6)
    # cable ports feeding the collar
    for dz in (-4, 4):
        ngon_prism(g, "x", 22.0, PCZ + dz, 1.6, 24, 27, "steel", 4, n=6)
    return g


# --------------------------------------------------------------- the head --


def head() -> Grid:
    g = Grid(HW, HH, HD)
    X, Y, Z = coords(g)

    cran = cham_prism(g, "y", 2, 4, 20, 22, 2, 0, 16, "bone", 5)
    hull(g, cran, "bone", 5, size=(7, 6), edge=0, rivets=False, seed=7)
    _frame(g, cran, "steel", 3)
    # hull seams over the crown, so the big pale top is not one bare field
    P.flat(g, cran & (Y > 15) & ((np.abs(X - HCX) < 0.6) | (np.abs(Z - HCZ) < 0.6)), "steel", 3)
    P.flat(g, cran & (Y > 15) & ((np.abs(X - 4.0) < 0.6) | (np.abs(X - 18.0) < 0.6) | (np.abs(Z - 6.0) < 0.6) | (np.abs(Z - 20.0) < 0.6)), "bone", 4)
    dots(g, cran & (Y > 15), "top", [(5.0, 7.0), (17.0, 7.0), (5.0, 19.0), (17.0, 19.0)], 1.0, "rust", 5, hi=("gold", 7))
    P.flat(g, cran & (np.abs(Y - 9.0) < 0.6) & ((X < 3) | (X > 19) | (Z > 21)), "steel", 3)
    P.flat(g, cran & (Y < 1.5), "steel", 3)

    back, left, right = cran & (Z > 21), cran & (X < 3), cran & (X > 19)
    service_panel(g, back, "+z", 5.0, 2.0, 17.0, 9.0, ramp="bone", base=6, rim=("steel", 2))
    slats(g, back, "+z", 6.0, 10.0, 16.0, 14.0, ramp="steel", dark=2, lit=5, rim=("steel", 3))
    bolt_row(g, back, "+z", [1.0, 15.0], 4.0, 18.0, step=4.0, ramp="steel", shade=3)
    for face, sel in (("-x", left), ("+x", right)):
        service_panel(g, sel, face, 6.0, 2.0, 20.0, 6.5, ramp="bone", base=6, rim=("steel", 2))
        bolt_row(g, sel, face, [14.5], 6.0, 20.0, step=4.0, ramp="steel", shade=3)
    # cable ports on the back of the skull
    for dx in (-5, 0, 5):
        port = ngon_prism(g, "z", HCX + dx, 4.0, 1.8, 21, 24, "rust", 5, n=6)
        P.flat(g, port & (Z > 23), "steel", 3)

    # the brow: a heavy copper beam capping the face (F3)
    brow = box(g, 2, 13, 2, 20, 16, 6, "rust", 5)
    P.flat(g, brow & (Y > 15), "rust", 6)
    P.flat(g, brow & (Z < 3), "rust", 4)
    P.flat(g, brow & (np.abs(Y - 13.0) < 0.6), "rust", 2)
    dots(g, brow & (Z < 3), "-z", [(4.0, 14.5), (18.0, 14.5)], 1.0, "gold", 6, hi=("gold", 7))

    # the visor recess and the two oversized eye panels (F4, C3)
    vis = box(g, 3, 5, 1, 19, 13, 5, "steel", 3)
    P.flat(g, vis, "steel", 3)
    P.flat(g, vis & (Z < 2), "steel", 4)
    P.flat(g, vis & (np.abs(X - HCX) < 1.0), "steel", 2)
    for x0 in (4, 12):
        eye = box(g, x0, 6, 0, x0 + 6, 12, 3, "cyan", 5)
        ef = eye & (Z < 1)
        P.flat(g, ef, "cyan", 6)
        P.flat(g, ef & (np.abs(X - (x0 + 3)) < 2.0) & (np.abs(Y - 9.0) < 2.0), "cyan", 7)
        P.flat(g, ef & (np.abs(X - (x0 + 2.0)) < 1.0) & (np.abs(Y - 10.0) < 1.0), "bone", 7)
        P.flat(g, ef & ((X < x0 + 1) | (X > x0 + 5) | (Y < 7) | (Y > 11)), "cyan", 3)
        P.outline(g, eye, "rust", 5, normal="z")
        P.flat(g, eye & (Z > 1), "rust", 3)

    # the vocoder grille and a four-light status pad
    gr = box(g, 4, 0, 2, 18, 5, 6, "steel", 5)
    P.flat(g, gr & (Z < 3) & (np.floor(X) % 2 == 0), "steel", 2)
    P.flat(g, gr & (Y > 4), "rust", 5)
    P.flat(g, gr & (Y < 1), "rust", 4)
    P.outline(g, gr & (Z < 3), "steel", 2, normal="z")
    for cx, ramp, shade in ((7.5, "cyan", 7), (9.5, "orange", 6), (12.5, "gold", 6), (14.5, "cyan", 7)):
        dots(g, gr & (Z < 3) & (np.abs(coords(g)[1] - 4.5) < 0.9), "-z", [(cx, 4.5)], 0.8, ramp, shade)

    # copper ear pods on the temples (F4)
    for lo, hi, out in ((0, 3, True), (19, 22, False)):
        pod = ngon_prism(g, "x", 8.5, 12.0, 4.2, lo, hi, "rust", 5, n=8)
        P.flat(g, pod & ((X < lo + 1) | (X > hi - 1)), "rust", 4)
        k0, k1 = (lo, lo + 1) if out else (hi - 1, hi)
        rim = ngon_prism(g, "x", 8.5, 12.0, 2.6, k0, k1, "steel", 3, n=8)
        P.flat(g, rim, "steel", 3)
        P.flat(g, rim & (np.hypot(Y - 8.5, Z - 12.0) < 1.3), "cyan", 7)

    # the hazard crest: a true-slope fin over the crown (F2, F4)
    g.prism("x", [(15.0, 6.0), (20.0, 10.0), (20.0, 15.0), (15.0, 20.0)], 9, 13, C("orange", 5))
    crest = last(g)
    P.flat(g, crest, "orange", 5)
    P.flat(g, crest & (Y > 18.5), "orange", 6)
    P.flat(g, crest & ((X < 10) | (X > 12)), "orange", 4)
    P.flat(g, crest & (Y < 16.5), "steel", 3)
    P.flat(g, crest & (Y > 19.5) & (np.abs(X - HCX) < 0.6), "cyan", 7)
    return g


def aerial() -> Grid:
    """A thin aerial with a copper collar and a cyan tip."""
    g = Grid(5, 8, 5)
    X, Y, Z = coords(g)
    base = box(g, 0, 0, 0, 5, 2, 5, "rust", 5)
    P.flat(g, base & (Y > 1), "rust", 6)
    P.flat(g, base & (Y < 1), "rust", 3)
    dots(g, base & (Y > 1), "top", [(1.0, 1.0), (4.0, 1.0), (1.0, 4.0), (4.0, 4.0)], 0.8, "gold", 6)
    mast = box(g, 1, 2, 1, 4, 5, 4, "steel", 6)
    P.flat(g, mast & ((X < 2) | (X > 3) | (Z < 2) | (Z > 3)), "steel", 4)
    coll = box(g, 0, 4, 0, 5, 6, 5, "steel", 3)
    P.flat(g, coll & (Y > 5), "steel", 5)
    lens = box(g, 1, 5, 1, 4, 8, 4, "cyan", 6)
    P.flat(g, lens & (Y > 7), "bone", 7)
    P.flat(g, lens & ((X < 2) | (X > 3) | (Z < 2) | (Z > 3)) & (Y < 7), "cyan", 3)
    return g


def build() -> Asset:
    root = Part("robot-head-bust", plinth())
    hd = root.add(Part("head", head(), pivot=(HCX, 0.0, HCZ), at=(PCX, float(COLLAR_Y), PCZ), rot=(0.0, -6.0, 0.0)))
    hd.add(Part("aerial", aerial(), pivot=(2.5, 0.0, 2.5), at=(-4.5, 15.5, -3.0), rot=(-7.0, 0.0, 9.0)))
    return Asset(
        id="space-props-robot-head-bust", pack="space", category="props", name="Robot Head Bust", root=root,
        # the display unit still tracks the room
        clips=[Clip("idle", {
            "head": {"rot": sway(6.0, amp=(0.0, 7.0, 0.0), base=(0.0, -6.0, 0.0))},
            "aerial": {"rot": sway(6.0, amp=(0.0, 0.0, 3.0), base=(-7.0, 0.0, 9.0), phase=(0.0, 0.0, 1.2))},
        })],
    )
