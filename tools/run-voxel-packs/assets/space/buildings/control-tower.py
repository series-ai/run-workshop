"""Spaceport control tower, in the Pirate Nation mecha style.

A plated steel lobby with thick dark corner posts, a wide short blast door
and a CTRL sign sits on an octagonal plinth. A sloped steel skirt (true
slopes) carries a tapered white octagonal shaft with dark bands, teal
window slits and a copper pipe. On top, the oversized function prop: a
flared control cab (a steel frustum under a band of glowing teal glass)
under a steel cap, and a big radar reflector that sweeps on `idle`. A
leaning antenna and beacons give it life. Detail is painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import band, beacon, big_gear, blast_door, coords, corner_posts, crate, facet_paint, fuel_drum, glass_band, hull_on, plates_on, sign, steel_box, window
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, turn

W, H, D = 64, 140, 62
CX, CZ = 32, 31
LX0, LX1, LZ0, LZ1, LY0, LY1 = 12, 52, 13, 49, 4, 45  # lobby
SK1 = 58  # skirt top
SH1 = 98  # shaft top
CAB0, GL0, GL1, ROOF1 = 98, 108, 121, 127


def body() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    plinth = S.disc(g, "y", CX, CZ, 30, 0, LY0, "steel", 4)
    facet_paint(g, [g.solids[-1]], plates_on("steel", 4, size=(10, 5), seed=1))
    P.flat(g, plinth & (Y > LY0 - 1) & (S.ngon_radius(g, "y", CX, CZ, 8) > 27), "orange", 5)
    P.flat(g, plinth & (Y > LY0 - 1) & (S.ngon_radius(g, "y", CX, CZ, 8) > 27) & ((np.floor(X + Z) // 3) % 2 == 0), "iron", 3)
    lobby(g)
    # sloped skirt from the lobby roof to the shaft
    n0 = len(g.solids)
    g.prism("y", [(LX0 - 2, LZ0 - 2), (LX1 + 2, LZ0 - 2), (LX1 + 2, LZ1 + 2), (LX0 - 2, LZ1 + 2)], LY1, SK1, C("steel", 5), top=[(CX - 13, CZ - 13), (CX + 13, CZ - 13), (CX + 13, CZ + 13), (CX - 13, CZ + 13)])
    facet_paint(g, g.solids[n0:], plates_on("steel", 5, size=(8, 6), seed=2))
    sk = S.last(g)
    P.flat(g, sk & (Y < LY1 + 1), "iron", 3)
    P.flat(g, sk & S.seams(g, g.solids[n0:], 0.9), "iron", 4)
    shaft(g)
    cab(g)
    yard(g)
    return g


def lobby(g: Grid) -> None:
    X, Y, Z = coords(g)
    steel_box(g, LX0, LY0, LZ0, LX1, LY1, LZ1, seed=3)
    corner_posts(g, LX0, LX1, LZ0, LZ1, LY0, LY1)
    band(g, LX0 - 2, LY1 - 4, LZ0 - 2, LX1 + 2, LY1, LZ1 + 2)
    blast_door(g, "-z", LZ0, 22, 42, LY0, LY0 + 24, seed=4)
    sign(g, "-z", LZ0, CX, LY0 + 28, "CTRL", scale=1, pad=2)
    for face, plane in (("-x", LX0), ("+x", LX1)):
        window(g, face, plane, 19, 29, 18, 32)
        window(g, face, plane, 35, 43, 18, 32)
    # PN mecha: a big copper gear and pipework on the back wall
    big_gear(g, "+z", LZ1, CX - 4, 24, 10, teeth=10)
    S.pipe(g, [(CX + 13, LY0, LZ1 + 3), (CX + 13, 38, LZ1 + 3), (CX + 13, 38, LZ1 - 1)], s=4, ramp="rust", base=4)
    S.pipe(g, [(LX0 + 5, LY0, LZ1 + 3), (LX0 + 5, 14, LZ1 + 3)], s=4, ramp="rust", base=4)
    # doorstep with a hazard edge
    step = box(g, 18, LY0 - 2, 5, 46, LY0, LZ0, "steel", 3)
    P.flat(g, step, "steel", 4)
    P.flat(g, step & (Z < 6.5) & ((np.floor(X) // 2) % 2 == 0), "orange", 5)


def shaft(g: Grid) -> None:
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    m = S.cone(g, "y", CX, CZ, 12, SK1, SH1, "bone", 5, n=8, r_top=9)
    facet_paint(g, g.solids[n0:], hull_on("bone", 5, size=(10, 9), seed=5))
    P.flat(g, m & S.seams(g, g.solids[n0:], 0.8), "bone", 3)
    # teal window slits on the front and side facets
    front = m & (Z < CZ - 7)
    for y0 in (60, 72, 84):
        P.flat(g, front & (Y > y0) & (Y < y0 + 7) & (np.abs(X - CX) < 2.5), "cyan", 6)
        P.flat(g, front & (Y > y0 + 5) & (Y < y0 + 7) & (np.abs(X - CX) < 2.5), "cyan", 7)
    side = m & (X > CX + 7)
    for y0 in (66, 80):
        P.flat(g, side & (Y > y0) & (Y < y0 + 7) & (np.abs(Z - CZ) < 2.5), "cyan", 6)
    # dark steel bands
    for y0 in (SK1, 76, SH1 - 4):
        r = 12.6 - 3 * (y0 - SK1) / (SH1 - SK1)
        b = S.disc(g, "y", CX, CZ, r + 0.8, y0, y0 + 3, "iron", 4)
        P.flat(g, b & (np.floor(X + Z) % 5 == 0) & (Y > y0 + 1) & (Y < y0 + 2), "iron", 6)
    # hazard band just under the cab
    hz = m & (Y > 90) & (Y < 93)
    P.flat(g, hz & ((np.floor(X + Z + Y) // 2) % 2 == 0), "orange", 5)
    P.flat(g, hz & ((np.floor(X + Z + Y) // 2) % 2 == 1), "iron", 3)
    # a copper riser on standoffs up the +X side
    S.pipe(g, [(CX + 16, SK1 - 1, CZ + 4), (CX + 16, SH1 + 2, CZ + 4)], s=4, ramp="rust", base=4)
    for y in (64, 86):
        box(g, CX + 9, y, CZ + 3, CX + 15, y + 2, CZ + 5, "iron", 4)


def cab(g: Grid) -> None:
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    S.cone(g, "y", CX, CZ, 21, CAB0, GL0, "steel", 4, n=8, r_top=9, tip="lo")
    facet_paint(g, g.solids[n0:], plates_on("steel", 4, size=(7, 5), seed=6))
    deck = S.disc(g, "y", CX, CZ, 23, GL0 - 2, GL0, "iron", 4)
    P.flat(g, deck & (S.ngon_radius(g, "y", CX, CZ, 8) > 21.5) & ((np.floor(X + Z) // 3) % 2 == 0), "orange", 5)
    n1 = len(g.solids)
    glass = S.disc(g, "y", CX, CZ, 20, GL0, GL1, "cyan", 6)
    glass_band(g, glass, g.solids[n1:])
    # mid transom and a glint on each facet
    P.flat(g, glass & (np.floor(Y) == GL0 + 4), "rust", 3)
    n2 = len(g.solids)
    roof = S.cone(g, "y", CX, CZ, 23, GL1, ROOF1, "steel", 5, n=8, r_top=11)
    facet_paint(g, g.solids[n2:], plates_on("steel", 5, size=(7, 4), seed=7))
    P.flat(g, roof & (Y < GL1 + 1.5), "orange", 5)
    P.flat(g, roof & S.seams(g, g.solids[n2:], 0.8) & (Y > GL1 + 1.5), "iron", 4)
    cap = S.disc(g, "y", CX, CZ, 11, ROOF1, ROOF1 + 2, "iron", 4)
    P.flat(g, cap & (S.ngon_radius(g, "y", CX, CZ, 8) < 5), "rust", 4)
    mount = S.disc(g, "y", CX, CZ, 4, ROOF1 + 2, ROOF1 + 7, "rust", 4)
    P.flat(g, mount & (Y > ROOF1 + 6), "rust", 6)
    beacon(g, CX - 8, ROOF1 + 2, CZ + 6, h=5)
    beacon(g, CX + 8, ROOF1 + 2, CZ - 6, h=3, lamp=("orange", 6))


def yard(g: Grid) -> None:
    crate(g, 3, LY0, 20, 9)
    crate(g, 4, LY0 + 9, 22, 6, ramp="steel", base=5, stripe=("orange", 5))
    fuel_drum(g, 56, 18, LY0, h=12, r=4.5)
    fuel_drum(g, 55, 42, LY0, h=12, r=4.5, ramp="steel")


def radar() -> Grid:
    """The sweeping radar: a long white reflector tilted up, on a copper
    yoke, with orange tips and a teal feed strip."""
    L = 58
    g = Grid(L, 14, 12)
    X, Y, Z = coords(g)
    yoke = box(g, L / 2 - 3, 0, 4, L / 2 + 3, 6, 8, "rust", 4)
    P.flat(g, edges(yoke), "rust", 3)
    refl = S.bar(g, "x", (4, 9), (13, 3), 3, 0, L, "bone", 6)
    P.mottle(g, refl, "bone", 6, cell=3, seed=8)
    P.flat(g, refl & ((X < 4) | (X > L - 4)), "orange", 5)
    P.flat(g, refl & (np.floor(X) % 8 == 0), "bone", 4)
    feed = S.bar(g, "x", (5, 6), (7, 5), 1.5, 8, L - 8, "cyan", 6)
    P.flat(g, feed, "cyan", 7)
    return g


def antenna() -> Grid:
    g = Grid(4, 26, 4)
    box(g, 1, 0, 1, 3, 22, 3, "iron", 4)
    box(g, 0, 8, 0, 4, 9, 4, "rust", 4)
    box(g, 0, 15, 0, 4, 16, 4, "rust", 4)
    box(g, 0, 22, 0, 4, 26, 4, "red", 5)
    return g


def build() -> Asset:
    g = body()
    root = Part("control-tower", g, pivot=(CX, 0.0, CZ))
    rg = radar()
    root.add(Part("radar", rg, pivot=(rg.shape[0] / 2, 0.0, 6.0), at=(0.0, ROOF1 + 7, 0.0)))
    root.add(Part("antenna", antenna(), pivot=(2.0, 0.0, 2.0), at=(-12.0, ROOF1 + 2, -3.0), rot=(-8.0, 0.0, 12.0)))
    return Asset(
        id="space-buildings-control-tower", pack="space", category="buildings", name="Spaceport Control Tower", root=root,
        clips=[Clip("idle", {"radar": {"rot": turn(3.0, "y", 120.0)}})],
    )
