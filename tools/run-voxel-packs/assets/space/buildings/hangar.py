"""Starship hangar, in the Pirate Nation mecha style.

A tall faceted steel arch (a quonset, true slopes) with painted rib bands
and a teal ridge skylight, outlined on both ends by thick dark arch
frames (rule F3). The front is one giant function prop: a segmented bay
door in a hazard-striped portal with a big painted 07, a crew wicket door
and a HANGAR sign in the gable, worked by an oversized copper winch gear.
A one-storey control annex with a lean-to roof sits on the +X side, and a
big exhaust fan spins on the roof on `idle`. Floodlights, crates and fuel
drums on a striped apron. Detail is painted. Faces -Z (the bay door).
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import hull_on, band, beacon, big_gear, blast_door, coords, corner_posts, crate, facet_paint, fuel_drum, plates_on, sign, spot, steel_box, window
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, turn

W, H, D = 158, 96, 128
G = 4  # apron top
Z0, Z1 = 22, 118  # arch ends; the front is z = Z0
ARCH = [(20, G), (130, G), (130, 36), (122, 63), (104, 83), (75, 91), (46, 83), (28, 63), (20, 36)]
CXA = 75


def body() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    apron = box(g, 4, 0, 2, 154, G, 124, "steel", 4)
    P.plates(g, apron, "steel", 4, size=(16, 16), rivets=False, seed=1)
    P.flat(g, apron & (Y > G - 1) & (Z < 12) & (np.abs(X - CXA) < 1.5), "gold", 6)  # taxi line
    P.flat(g, apron & (Y > G - 1) & (Z < 9) & ((np.floor(X) // 4) % 2 == 0) & ((X < 30) | (X > 120)), "orange", 5)
    P.flat(g, edges(apron), "steel", 2)
    # the arch
    n0 = len(g.solids)
    g.prism("z", ARCH, Z0, Z1, C("bone", 5))
    arch = S.last(g)
    facet_paint(g, g.solids[n0:], hull_on("bone", 5, size=(16, 8), seed=2))
    ribs = arch & (np.floor(Z - Z0) % 16 < 3) & (Z > Z0 + 4) & (Z < Z1 - 4)
    P.flat(g, ribs, "steel", 3)
    P.flat(g, ribs & (np.floor(Z - Z0) % 16 == 1) & (np.floor(X + Y) % 4 == 0), "steel", 6)
    P.flat(g, arch & S.seams(g, g.solids[n0:], 0.8), "steel", 4)
    sky = arch & (Y > 86) & (np.abs(X - CXA) < 9) & (np.floor(Z - Z0) % 16 >= 4) & (Z > Z0 + 6) & (Z < Z1 - 6)
    P.flat(g, sky, "cyan", 6)
    P.flat(g, sky & (np.abs(X - CXA) < 2), "cyan", 7)
    P.flat(g, arch & (Y < G + 3), "steel", 3)
    P.flat(g, arch & (Y > G + 30) & (Y < G + 33) & ~ribs, "orange", 5)  # a stripe along the hull
    # thick dark arch frames on both ends
    for z0, z1 in ((Z0 - 3, Z0 + 1), (Z1 - 1, Z1 + 3)):
        for p0, p1 in zip(ARCH[1:] + ARCH[:1], ARCH[2:] + ARCH[:2]):
            if p0[1] == G and p1[1] == G:
                continue
            m = S.bar(g, "z", p0, p1, 5, z0, z1, "steel", 3)
            P.flat(g, m & (np.floor(X + Y) % 6 == 0), "steel", 5)
    side_windows(g)
    front(g)
    back(g)
    annex(g)
    roof_housing(g)
    yard(g)
    return g


def side_windows(g: Grid) -> None:
    for face, plane in (("-x", 20), ("+x", 130)):
        for zc in (40, 56, 72, 88, 104):
            if face == "+x" and 38 <= zc <= 80:
                continue
            window(g, face, plane, zc - 5, zc + 5, 16, 28)


def front(g: Grid) -> None:
    X, Y, Z = coords(g)
    # the portal: hazard-striped columns and lintel
    portal = box(g, 31, G, Z0 - 4, 38, 66, Z0, "steel", 3) | box(g, 112, G, Z0 - 4, 119, 66, Z0, "steel", 3)
    portal |= box(g, 34, 62, Z0 - 4, 116, 69, Z0, "steel", 3)
    band_ = ((np.floor(X + Y) // 3) % 2 == 0)
    P.flat(g, portal & band_, "orange", 5)
    P.flat(g, portal & ~band_, "steel", 2)
    P.flat(g, edges(portal), "steel", 2)
    # the segmented bay door
    door = box(g, 38, G, Z0 - 2, 112, 62, Z0, "orange", 5)
    seg = np.floor(Y - G) % 8
    P.flat(g, door & ((np.floor((Y - G) / 8) % 2) == 0), "orange", 6)
    P.flat(g, door & (seg == 0), "orange", 3)
    P.flat(g, door & (seg == 4) & (np.floor(X) % 10 == 3), "orange", 7)  # rivets
    P.flat(g, door & (Y < G + 5), "orange", 5)
    P.flat(g, door & (Y < G + 5) & ((np.floor(X + Y) // 2) % 2 == 0), "steel", 2)
    win = door & (Y > G + 41) & (Y < G + 47) & (np.floor(X - 38) % 12 > 2) & (X > 40) & (X < 110)
    P.flat(g, win, "cyan", 6)
    P.flat(g, win & (Y > G + 45), "cyan", 7)
    tw, _th = pnglyph.text_size("07", 3)
    pnglyph.text(g, "-z", Z0 - 2, int(CXA - tw / 2), G + 16, "07", "bone", 7, scale=3)
    # crew wicket door in the bay door
    wk = door & (X > 43) & (X < 57) & (Y < G + 24) & (Y > G + 1)
    P.flat(g, wk, "steel", 5)
    P.flat(g, wk & ((X < 44) | (X > 56) | (Y > G + 23)), "steel", 3)
    P.flat(g, wk & (Y > G + 15) & (Y < G + 20) & (X > 46) & (X < 54), "cyan", 6)
    P.flat(g, wk & (Y > G + 10) & (Y < G + 11.5) & (X > 52) & (X < 55), "gold", 6)
    sign(g, "-z", Z0, CXA, 71, "HANGAR", scale=1, pad=2)
    # the winch: a big copper gear on the portal with a drive pipe
    big_gear(g, "-z", Z0 - 4, 27, 52, 9, teeth=10, thick=3)
    S.pipe(g, [(27, G, Z0 - 7), (27, 40, Z0 - 7)], s=4, ramp="rust", base=4)
    for cu, cv in ((28, 70), (122, 70)):
        spot(g, "-z", Z0 - 1, cu, cv, s=5)


def back(g: Grid) -> None:
    X, Y, Z = coords(g)
    big_gear(g, "+z", Z1, CXA, 56, 12, teeth=12, thick=3)
    blast_door(g, "+z", Z1, 94, 110, G, G + 22, seed=9)
    S.pipe(g, [(40, G, Z1 + 4), (40, 50, Z1 + 4), (60, 50, Z1 + 4)], s=4, ramp="rust", base=4)


def annex(g: Grid) -> None:
    X, Y, Z = coords(g)
    ax0, ax1, az0, az1, top = 130, 152, 40, 78, 34
    steel_box(g, ax0, G, az0, ax1, top, az1, seed=5)
    corner_posts(g, ax0 + 1, ax1, az0, az1, G, top, size=3)
    n0 = len(g.solids)
    g.prism("z", [(126, top - 1), (155, top - 7), (155, top - 3), (126, top + 3)], az0 - 3, az1 + 3, C("rust", 4))
    facet_paint(g, g.solids[n0:], plates_on("rust", 4, size=(8, 6), seed=6))
    blast_door(g, "-z", az0, 134, 148, G, G + 20, seed=7)
    window(g, "+x", ax1, 52, 64, 14, 24)
    window(g, "+x", ax1, 67, 74, 14, 24, bar=False)
    beacon(g, 148, top, 72, h=10)


def roof_housing(g: Grid) -> None:
    hs = steel_box(g, 58, 78, 80, 92, 94, 110, seed=8)
    X, Y, Z = coords(g)
    P.flat(g, hs & (Y > 92), "orange", 5)
    ring = S.disc(g, "y", 75, 95, 17, 94, 96, "rust", 4, n=12)
    P.flat(g, ring & (S.ngon_radius(g, "y", 75, 95, 12) > 15.5), "rust", 3)


def yard(g: Grid) -> None:
    crate(g, 6, G, 6, 10)
    crate(g, 7, G + 10, 8, 7, ramp="steel", base=5, stripe=("orange", 5))
    crate(g, 17, G, 6, 8)
    fuel_drum(g, 138, 12, G, h=13, r=5)
    fuel_drum(g, 148, 16, G, h=13, r=5, ramp="steel")
    fuel_drum(g, 142, 27, G, h=11, r=4.5, ramp="rust")


def fan() -> Grid:
    """The exhaust fan: four wide copper blades (true diagonals) on a hub."""
    g = Grid(34, 6, 34)
    c = 17
    for k in range(4):
        blade = S.rotate([(c + 2, c - 3), (c + 16, c - 7), (c + 16, c + 3), (c + 2, c + 2)], c, c, 90 * k)
        g.prism("y", blade, 0, 3, C("rust", 5))
        m = S.last(g)
        P.flat(g, m & edges(m), "rust", 3)
    hub = S.disc(g, "y", c, c, 4, 0, 5, "steel", 4)
    X, Y, Z = coords(g)
    P.flat(g, hub & (Y > 4), "gold", 6)
    return g


def build() -> Asset:
    g = body()
    root = Part("hangar", g, pivot=(W / 2, 0.0, D / 2))
    root.add(Part("fan", fan(), pivot=(17.0, 0.0, 17.0), at=(75 - W / 2, 96.0, 95 - D / 2)))
    return Asset(
        id="space-buildings-hangar", pack="space", category="buildings", name="Starship Hangar", root=root,
        clips=[Clip("idle", {"fan": {"rot": turn(1.0, "y", 360.0)}})],
    )
