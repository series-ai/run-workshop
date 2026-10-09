"""Plasma lantern, in the Pirate Nation mecha style.

The space pack's lamp post (the PN mecha lamp archetype, scale class `lamp`).
One iconic shape (K3): a tall white hull mast on a tiered steel plinth,
framed by dark corner posts and two copper collars (F3). An oversized copper
high-voltage relay hangs off the front, off-centre, with a cyan readout and a
slatted vent (F4, F5); a flanged conduit climbs the +X side into the head. On
top a wide steel eave carries the lantern: four cyan plasma panes quartered
by dark mullions and a proud copper belt, with a white-hot filament down the
middle and the light spilling onto both eaves. A turning orange warning
beacon caps it, and a copper heat sink leans off the -X side (F5). Detail is
paint (S1). Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
from _pn import pipe
from _props import bolt_row, cham_prism, dots, hull, ngon_prism, service_panel, slats
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Clip, Grid, Part, Socket, turn

W, H, D = 26, 64, 26
CX = CZ = 13.0

M0, M1 = 8, 18          # mast footprint in x and z
MY0, MY1 = 6, 40        # mast bottom and top
CAGE0, CAGE1 = 5, 21    # lantern cage footprint
CAGE_Y0, CAGE_Y1 = 44, 56
BELT_Y = 49             # the copper belt across the panes
CORE_Y = (CAGE_Y0 + CAGE_Y1) / 2
TOP_Y = 58              # top of the upper eave, where the beacon sits


def _frame(g: Grid, m: np.ndarray, ramp: str, shade: int) -> None:
    """A dark 1-voxel outline on the skin of a block (S4)."""
    P.flat(g, edges(m), ramp, shade)


def _pane(g: Grid, sel, A, Y, a0: float, a1: float, y0: float, y1: float) -> None:
    """One plasma pane: a dark glass rim, a lit field and a white-hot core."""
    m = sel & (A > a0) & (A < a1) & (Y > y0) & (Y < y1)
    P.flat(g, m, "cyan", 5)
    ca, cy = (a0 + a1) / 2, (y0 + y1) / 2
    P.flat(g, m & (np.abs(A - ca) < (a1 - a0) / 2 - 1.0) & (np.abs(Y - cy) < (y1 - y0) / 2 - 1.0), "cyan", 6)
    hot = m & (np.abs(A - ca) < 1.6) & (np.abs(Y - cy) < (y1 - y0) / 2 - 1.2)
    P.flat(g, hot, "cyan", 7)
    P.flat(g, hot & (np.abs(A - ca) < 0.6), "bone", 7)
    P.flat(g, m & ((A < a0 + 1) | (A > a1 - 1) | (Y < y0 + 1) | (Y > y1 - 1)), "cyan", 3)


# --------------------------------------------------------------- the body --


def plinth(g: Grid) -> None:
    X, Y, Z = coords(g)
    skirt = cham_prism(g, "y", 3, 3, 23, 23, 4, 0, 3, "steel", 4)
    for f, fr in facets(g, g.solids[-1:]):
        P.plates(g, f, "steel", 4, size=(6, 3), rivets=True, frame=fr)
    P.flat(g, skirt & (Y > 2), "steel", 5)
    _frame(g, skirt, "steel", 2)
    # a hazard band in large blocks, not dashes (C3)
    band = skirt & (Y < 2) & (Y > 0)
    P.flat(g, band, "orange", 5)
    P.flat(g, band & (np.floor((X + Z) / 4) % 2 == 1), "steel", 3)

    step = cham_prism(g, "y", 5, 5, 21, 21, 3, 3, 6, "steel", 3)
    P.flat(g, step & (Y > 5), "steel", 5)
    _frame(g, step, "iron", 4)
    for face, sel in (("-z", step & (Z < 6)), ("+z", step & (Z > 20)), ("-x", step & (X < 6)), ("+x", step & (X > 20))):
        bolt_row(g, sel, face, [4.0], 6.0, 20.0, step=4.0, ramp="steel", shade=5)


def mast(g: Grid) -> None:
    X, Y, Z = coords(g)
    core = box(g, M0, MY0, M0, M1, MY1, M1, "bone", 5)
    hull(g, core, "bone", 5, size=(7, 10), edge=0, rivets=False, seed=3)
    front, back = core & (Z < M0 + 1), core & (Z > M1 - 1)
    left, right = core & (X < M0 + 1), core & (X > M1 - 1)

    # every broad face gets a framed panel; none is left bare
    service_panel(g, front, "-z", 9.5, 27.0, 16.5, 33.0, ramp="bone", base=6, rim=("steel", 2))
    pnglyph.icon(g, "-z", M0, 11, 28, "bolt", "orange", 5, depth=2, reach=1)
    for face, sel in (("+z", back), ("-x", left), ("+x", right)):
        service_panel(g, sel, face, 9.5, 25.0, 16.5, 33.0, ramp="bone", base=6, rim=("steel", 2))
    slats(g, left, "-x", 10.5, 13.0, 15.5, 22.0, ramp="steel", dark=2, lit=5, rim=("steel", 3))
    slats(g, right, "+x", 10.5, 13.0, 15.5, 17.0, ramp="steel", dark=2, lit=5, rim=("steel", 3))
    for face, sel in (("-z", front), ("+z", back), ("-x", left), ("+x", right)):
        bolt_row(g, sel, face, [12.0, 34.0], 9.0, 17.0, step=3.0, ramp="steel", shade=3)

    # the powered conduit seam up the back (C3)
    P.flat(g, back & (np.abs(X - CX) < 1.1) & (Y > 13) & (Y < 24), "cyan", 5)
    P.flat(g, back & (np.abs(X - CX) < 0.6) & (Y > 13) & (Y < 24), "cyan", 7)

    # corner posts framing the volume in a dark tone (F3), banded in copper
    for x0, z0 in ((M0, M0), (M1 - 2, M0), (M0, M1 - 2), (M1 - 2, M1 - 2)):
        post = box(g, x0, MY0, z0, x0 + 2, MY1, z0 + 2, "steel", 5)
        P.flat(g, edges(post), "steel", 3)
        P.flat(g, post & ((np.abs(Y - 18.5) < 1.1) | (np.abs(Y - 31.5) < 1.1)), "rust", 5)

    # two copper collars, real geometry (F3)
    for y0, y1, shade in ((8, 11, 4), (35, 38, 5)):
        col = cham_prism(g, "y", M0 - 1, M0 - 1, M1 + 1, M1 + 1, 2, y0, y1, "rust", shade)
        P.flat(g, col & (Y > y1 - 1), "rust", min(7, shade + 2))
        _frame(g, col, "rust", 2)
        dots(g, col & (Z < M0), "-z", [(10.0, y0 + 1.5), (16.0, y0 + 1.5)], 0.9, "gold", 6, hi=("gold", 7))


def relay(g: Grid) -> None:
    """The oversized function prop: a high-voltage relay set off-centre on
    the front of the mast (F4, F5)."""
    X, Y, Z = coords(g)
    bod = cham_prism(g, "z", 4, 14, 16, 27, 2, 2, 9, "steel", 4)
    P.plates(g, bod, "steel", 4, size=(6, 5), rivets=True, frame="z")
    _frame(g, bod, "steel", 2)
    P.flat(g, bod & (Y < 16.5), "rust", 5)          # a copper trim foot
    P.flat(g, bod & (np.abs(Y - 16.0) < 0.6), "rust", 3)

    # a chunky steel bezel round a cyan readout: ticks, a level bar, a cursor
    bez = box(g, 5, 16, 1, 15, 25, 3, "steel", 4)
    _frame(g, bez, "steel", 2)
    scr = box(g, 6, 17, 0, 14, 24, 2, "cyan", 4)
    sf = scr & (Z < 1)
    P.flat(g, scr, "cyan", 4)
    P.flat(g, sf & (np.floor(Y) % 2 == 1), "cyan", 5)
    for by, w in ((18.5, 7.0), (20.5, 5.0), (22.5, 3.0)):
        P.flat(g, sf & (np.abs(Y - by) < 0.6) & (X > 6.5) & (X < 6.5 + w), "cyan", 7)
    P.flat(g, sf & (np.abs(X - 12.5) < 0.6) & (Y > 17.5) & (Y < 19.5), "bone", 7)
    P.outline(g, scr, "steel", 2, normal="z")

    # a hazard cap on the box top in large blocks (C3)
    cap = bod & (Y > 25.5)
    P.flat(g, cap, "orange", 5)
    P.flat(g, cap & (np.floor(X / 3) % 2 == 0), "orange", 4)
    P.flat(g, bod & (np.abs(Y - 25.0) < 0.6), "steel", 3)

    slats(g, bod & (X < 5), "-x", 3.0, 16.0, 8.0, 25.0, ramp="steel", dark=2, lit=5, rim=("steel", 3))
    bolt_row(g, bod & (X > 15), "+x", [17.0, 24.0], 3.0, 8.0, step=3.0, ramp="steel", shade=6)
    dots(g, bod & (Z < 3), "-z", [(6.5, 26.5), (13.5, 26.5)], 0.9, "gold", 6, hi=("gold", 7))

    # thick mount brackets tying the relay to the mast (F3)
    for by in (14, 25):
        br = box(g, 4, by, 8, 16, by + 2, 10, "steel", 3)
        P.flat(g, br & (np.floor(X / 3) % 2 == 0), "steel", 4)


def conduit(g: Grid) -> None:
    """The flanged conduit climbing the +X side into the head."""
    pipe(g, [(17.0, 19.0, 13.0), (21.0, 19.0, 13.0), (21.0, 36.0, 13.0), (18.0, 36.0, 13.0)], s=2, ramp="rust", base=5, flange=True)
    X, Y, Z = coords(g)
    riser = (g.a > 0) & (X > 19.5) & (Y > 21) & (Y < 34)
    P.flat(g, riser & (np.abs(Z - CZ) < 1.1), "rust", 6)
    P.flat(g, riser & (np.floor(Y / 5) % 2 == 0) & (np.abs(Z - CZ) < 2.2), "rust", 3)


def head(g: Grid) -> None:
    X, Y, Z = coords(g)
    mount = cham_prism(g, "y", 5, 5, 21, 21, 3, 40, 42, "steel", 3)
    P.flat(g, mount & (Y > 41), "steel", 4)
    dots(g, mount & (Z < 6), "-z", [(8.0, 40.8), (18.0, 40.8)], 0.9, "rust", 6)

    eave = cham_prism(g, "y", 3, 3, 23, 23, 5, 42, 44, "steel", 4)
    for f, fr in facets(g, g.solids[-1:]):
        P.plates(g, f, "steel", 4, size=(5, 3), rivets=True, frame=fr)
    _frame(g, eave, "steel", 2)
    P.flat(g, eave & (Y < 43), "rust", 5)                     # a copper rim underneath
    P.flat(g, eave & (Y > 43), "cyan", 5)                     # light spilling on the eave top
    P.flat(g, eave & (Y > 43) & (np.abs(X - CX) + np.abs(Z - CZ) < 9), "cyan", 6)

    # the glass cage: plasma panes quartered by mullions and a copper belt
    cage = box(g, CAGE0, CAGE_Y0, CAGE0, CAGE1, CAGE_Y1, CAGE1, "cyan", 6)
    skin = cage & ((X < CAGE0 + 1) | (X > CAGE1 - 1) | (Z < CAGE0 + 1) | (Z > CAGE1 - 1))
    P.flat(g, skin, "steel", 3)
    xf = skin & ((Z < CAGE0 + 1) | (Z > CAGE1 - 1))
    zf = skin & ((X < CAGE0 + 1) | (X > CAGE1 - 1))
    for sel, A in ((xf, X), (zf, Z)):
        for a0, a1 in ((CAGE0 + 2, 12), (14, CAGE1 - 2)):
            for y0, y1 in ((CAGE_Y0, BELT_Y), (BELT_Y + 2, CAGE_Y1)):
                _pane(g, sel, A, Y, a0, a1, y0, y1)

    belt = box(g, CAGE0 - 1, BELT_Y, CAGE0 - 1, CAGE1 + 1, BELT_Y + 2, CAGE1 + 1, "rust", 5)
    P.flat(g, belt & (Y > BELT_Y + 1), "rust", 6)
    _frame(g, belt, "rust", 3)
    dots(g, belt & (Z < CAGE0), "-z", [(9.0, BELT_Y + 1.0), (17.0, BELT_Y + 1.0)], 0.9, "gold", 6)

    for x0, z0 in ((CAGE0, CAGE0), (CAGE1 - 2, CAGE0), (CAGE0, CAGE1 - 2), (CAGE1 - 2, CAGE1 - 2)):
        post = box(g, x0, CAGE_Y0, z0, x0 + 2, CAGE_Y1, z0 + 2, "steel", 4)
        P.flat(g, edges(post), "steel", 2)
        P.flat(g, post & (np.abs(Y - (BELT_Y + 1)) < 1.6), "rust", 5)

    top = cham_prism(g, "y", 3, 3, 23, 23, 5, CAGE_Y1, TOP_Y, "steel", 4)
    for f, fr in facets(g, g.solids[-1:]):
        P.plates(g, f, "steel", 4, size=(5, 3), rivets=True, frame=fr)
    _frame(g, top, "steel", 2)
    P.flat(g, top & (Y < CAGE_Y1 + 1), "cyan", 5)             # light spilling on the eave underside
    P.flat(g, top & (Y > TOP_Y - 1), "steel", 5)
    rr = np.hypot(X - CX, Z - CZ)
    P.flat(g, top & (Y > TOP_Y - 1) & (np.abs(rr - 7.5) < 0.7), "rust", 5)
    dots(g, top & (Y > TOP_Y - 1), "top", [(6.0, 6.0), (20.0, 6.0), (6.0, 20.0), (20.0, 20.0)], 1.0, "orange", 5, hi=("gold", 7))


def body() -> Grid:
    g = Grid(W, H, D)
    plinth(g)
    mast(g)
    relay(g)
    conduit(g)
    head(g)
    return g


# -------------------------------------------------------- the moving bits --


def beacon() -> Grid:
    """A turning warning beacon: one lit lens sector, so the spin reads."""
    g = Grid(9, 5, 9)
    X, Y, Z = coords(g)
    base = ngon_prism(g, "y", 4.5, 4.5, 3.6, 0, 1, "steel", 3)
    P.flat(g, base, "steel", 3)
    lens = ngon_prism(g, "y", 4.5, 4.5, 3.0, 1, 4, "orange", 5)
    P.flat(g, lens & (Z < 4.5) & (np.abs(X - 4.5) < 1.7), "gold", 7)
    P.flat(g, lens & (Z < 4.5) & (np.abs(X - 4.5) < 0.6), "bone", 7)
    P.flat(g, lens & (Y > 3.5), "orange", 6)
    cap = ngon_prism(g, "y", 4.5, 4.5, 2.4, 4, 5, "steel", 4, r_top=1.4)
    P.flat(g, cap, "steel", 5)
    return g


def heat_sink() -> Grid:
    """A copper heat sink: four proud fins on a steel bracket."""
    g = Grid(12, 11, 7)
    X, Y, Z = coords(g)
    plate = box(g, 8, 0, 1, 12, 11, 6, "steel", 4)
    P.plates(g, plate, "steel", 4, size=(4, 4), rivets=True, frame="x")
    _frame(g, plate, "steel", 2)
    for y0 in (1, 4, 7):
        f = box(g, 1, y0, 2, 9, y0 + 2, 5, "rust", 5)
        P.flat(g, f & (Y > y0 + 1), "rust", 6)
        P.flat(g, f & (X < 2), "cyan", 6)
        _frame(g, f, "rust", 3)
    spine = box(g, 7, 0, 2, 9, 11, 5, "rust", 4)
    P.flat(g, spine & (np.floor(Y / 3) % 2 == 0), "rust", 3)
    return g


def build() -> Asset:
    root = Part("plasma-lantern", body())
    root.add(Part("beacon", beacon(), pivot=(4.5, 0.0, 4.5), at=(CX, float(TOP_Y), CZ)))
    root.add(Part("heat-sink", heat_sink(), pivot=(11.0, 5.5, 3.5), at=(8.5, 31.0, CZ), rot=(0.0, 0.0, 12.0)))
    return Asset(
        id="space-props-plasma-lantern", pack="space", category="props", name="Plasma Lantern", root=root,
        sockets=[Socket("socket-arc", at=(10.0, 27.5, 5.0))],
        # the beacon turns: one whole turn in four seconds
        clips=[Clip("idle", {"beacon": {"rot": turn(4.0, "y", 90.0)}})],
        pfx=[{"effectId": "rvx-space-stun-arc", "socket": "socket-arc", "trigger": "idle", "size": 10}],
    )
