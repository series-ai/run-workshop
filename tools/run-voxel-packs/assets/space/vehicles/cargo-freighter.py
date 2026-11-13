"""Cargo freighter, in the Pirate Nation mecha style.

A heavy blocky space hauler. A tall hazard-orange bow block with a sloped
nose (true slopes) carries a wide band of glowing teal bridge windows over
a steel grille, big headlights and a painted hull number. A plated steel
spine carries six chunky corrugated cargo containers (orange, teal and
white, with stencils) under two thick gantry arches, with two fuel tanks
slung below. A big plated engine block with four copper-ringed nozzles
(frustums with glowing throats) closes the stern. Four splayed landing legs
(true diagonals) with pads. A radar dish on the bow sweeps on `idle`; the
hull shudders on `move` (exhaust PFX at socket-engine). Detail is painted.
Faces -Z (the bow).
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
import pnshapes as S
from _bld import coords, facet_paint, plates_on, rel, steel_box
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket, turn

W, H, D = 74, 70, 140
CX = 37
SPINE = (24, 50, 22, 32)  # x0, x1, y0, y1
BOW_X0, BOW_X1, BOW_TOP = 12, 62, 56
ENG_Z0, ENG_Z1 = 114, 130
NOZ = [(CX - 11, 26), (CX + 11, 26), (CX - 11, 42), (CX + 11, 42)]


def hull() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    x0, x1, y0, y1 = SPINE
    steel_box(g, x0, y0, 30, x1, y1, ENG_Z0, seed=1)
    bow(g)
    containers(g)
    stern(g)
    under(g)
    return g


def bow(g: Grid) -> None:
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    g.prism("x", [(14, 10), (14, 36), (BOW_TOP, 36), (BOW_TOP, 20), (40, 6), (24, 4)], BOW_X0, BOW_X1, C("orange", 6))
    b = S.last(g)
    facet_paint(g, g.solids[n0:], plates_on("orange", 6, size=(10, 8), seed=2))
    P.flat(g, b & S.seams(g, g.solids[n0:], 0.8), "orange", 4)
    P.flat(g, b & ((X < BOW_X0 + 1) | (X > BOW_X1 - 1)) & ((Y < 15) | (Y > BOW_TOP - 1)), "orange", 4)
    # the bridge: a band of glowing windows on the sloped nose
    zf = 6 + (Y - 40) * (20 - 6) / (BOW_TOP - 40)
    br = b & (Y > 42) & (Y < 52) & (Z < zf + 2) & (X > BOW_X0 + 3) & (X < BOW_X1 - 3)
    P.flat(g, br, "cyan", 6)
    P.flat(g, br & (Y > 49), "cyan", 7)
    P.flat(g, br & (np.floor(X - BOW_X0) % 9 == 0), "iron", 4)
    # grille and headlights on the lower nose
    gr = b & (Z < 7) & (Y > 18) & (Y < 34) & (np.abs(X - CX) < 12)
    P.flat(g, gr, "steel", 3)
    P.flat(g, gr & (np.floor(Y) % 3 == 0), "steel", 5)
    for hx in (BOW_X0 + 4, BOW_X1 - 11):
        lamp = box(g, hx, 20, 3, hx + 7, 28, 6, "gold", 7)
        P.flat(g, edges(lamp), "steel", 3)
    # hazard stripes on the chin
    ch = b & (Y < 18) & (Z < 12)
    pnpaint.hazard(g, ch, period=6, a=("orange", 6), b=("iron", 3))
    # hull number on both flanks
    for face, plane in (("-x", BOW_X0), ("+x", BOW_X1)):
        pnglyph.text(g, face, plane, 14, 26, "07", "bone", 7, scale=2)
    # radar mast on the roof
    m = box(g, CX - 3, BOW_TOP, 24, CX + 3, BOW_TOP + 4, 30, "steel", 4)
    P.flat(g, edges(m), "steel", 2)


def containers(g: Grid) -> None:
    X, Y, Z = coords(g)
    ramps = [("orange", 5), ("teal", 5), ("bone", 6), ("teal", 5), ("bone", 6), ("orange", 5)]
    k = 0
    for z0 in (40, 66, 92):
        for x0 in (14, 38):
            ramp, base = ramps[k]
            c = box(g, x0, 32, z0, x0 + 22, 50, z0 + 22, ramp, base)
            pnpaint.corrugate(g, c, ramp, base, period=3, sheet=11, length=40, seed=k)
            P.flat(g, edges(c), "iron", 4)
            P.flat(g, c & (Y > 49), ramp, base + 1)
            k += 1
    # stencils on the outer sides
    pnglyph.icon(g, "+x", 60, 44, 36, "planet", "bone", 7)
    pnglyph.icon(g, "-x", 14, 70, 36, "star", "gold", 6)
    # two thick gantry arches over the containers
    for z0 in (62, 88):
        a = box(g, 10, 22, z0, 14, 54, z0 + 4, "steel", 4) | box(g, 60, 22, z0, 64, 54, z0 + 4, "steel", 4) | box(g, 10, 50, z0, 64, 55, z0 + 4, "steel", 4)
        P.flat(g, a & (Y > 52) & ((np.floor(X) // 3) % 2 == 0), "orange", 5)
        P.flat(g, edges(a), "steel", 2)


def stern(g: Grid) -> None:
    X, Y, Z = coords(g)
    e = steel_box(g, 14, 16, ENG_Z0, 60, 52, ENG_Z1, seed=3)
    P.flat(g, e & (Y > 50), "orange", 5)
    for nx, ny in NOZ:
        n = S.cone(g, "z", nx, ny, 7, ENG_Z1, ENG_Z1 + 8, "rust", 4, n=8, r_top=5, tip="lo")
        facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.plates(gg, mm, "rust", 4, size=(4, 3), rivets=False, frame=fr))
        d = S.ngon_radius(g, "z", nx, ny, 8)
        P.flat(g, n & (Z > ENG_Z1 + 7) & (d < 5.5), "cyan", 7)
        P.flat(g, n & (Z > ENG_Z1 + 7) & (d >= 5.5), "rust", 3)
    # a big exhaust stack on top
    S.pipe(g, [(52, 52, ENG_Z0 + 6), (52, 62, ENG_Z0 + 6)], s=5, ramp="rust", base=4)


def under(g: Grid) -> None:
    X, Y, Z = coords(g)
    for tx in (28, 46):
        t = S.disc(g, "z", tx, 17, 5, 40, 108, "bone", 6, n=8)
        P.flat(g, t & ((np.abs(Z - 50) < 1.5) | (np.abs(Z - 98) < 1.5)), "orange", 5)
        P.flat(g, t & (Y < 13), "bone", 5)
    for z0 in (36, 104):
        for s in (-1, 1):
            m = S.bar(g, "z", (CX + s * 12, 22), (CX + s * 30, 3), 5, z0, z0 + 5, "steel", 4)
            P.flat(g, m & (np.floor(Y) % 6 == 0), "orange", 5)
            pad = box(g, CX + s * 30 - 5, 0, z0 - 2, CX + s * 30 + 5, 3, z0 + 7, "steel", 3)
            P.flat(g, edges(pad), "steel", 2)


def dish() -> Grid:
    g = Grid(22, 12, 22)
    X, Y, Z = coords(g)
    base = S.disc(g, "y", 11, 11, 3, 0, 4, "steel", 4)
    bowl = S.cone(g, "y", 11, 11, 10, 4, 8, "bone", 6, n=10, r_top=4, tip="lo")
    face = bowl & (Y > 7)
    P.flat(g, face & (np.floor(np.hypot(X - 11, Z - 11)) % 4 == 0), "bone", 4)
    P.flat(g, bowl & (np.hypot(X - 11, Z - 11) > 8.5), "orange", 5)
    box(g, 10, 8, 10, 12, 12, 12, "rust", 4)
    return g


def build() -> Asset:
    g = hull()
    pv = (CX, 30.0, D / 2)
    root = Part("freighter", g, pivot=pv)
    root.add(Part("dish", dish(), pivot=(11.0, 0.0, 11.0), at=rel(pv, (CX, BOW_TOP + 4, 27))))
    shudder = [(i * 0.25, (0.0, 0.5 * ((-1) ** i), 0.0)) for i in range(9)]
    return Asset(
        id="space-vehicles-cargo-freighter", pack="space", category="vehicles", name="Cargo Freighter", root=root,
        clips=[Clip("idle", {"dish": {"rot": turn(3.0, "y", 120.0)}}), Clip("move", {"dish": {"rot": turn(2.0, "y", 180.0)}, "freighter": {"loc": shudder}})],
        sockets=[Socket("socket-engine", at=rel(pv, (CX, 34, ENG_Z1 + 9)))],
        pfx=[{"effectId": "rvx-space-engine-exhaust", "socket": "socket-engine", "trigger": "clip:move", "size": 44, "aim": [0.0, 0.0, 1.0]}],
    )
