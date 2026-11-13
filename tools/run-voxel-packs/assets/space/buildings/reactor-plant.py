"""Fusion power plant, in the Pirate Nation mecha style.

The function prop is an oversized white cooling tower (rule F4): two
12-sided frustums that pinch in and flare out (a faceted hyperboloid, true
slopes) with hazard-orange warning bands and dark air-inlet arches. Beside
it, a plated reactor drum under a faceted steel dome with a glowing teal
crown and a bolt emblem, entered through a vestibule with a steep gable and
a blast door. In front, a turbine hall with a steep steel roof, a FUSION
sign and a big intake fan in a copper ring that spins on `idle`. Big
flanged copper coolant pipes tie them together; a lattice pylon and a
transformer stand in the yard. Detail is painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import beacon, big_gear, blast_door, coords, corner_posts, crate, facet_paint, fuel_drum, hull_on, plates_on, sign, steel_box, steel_roof, truss, window
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, turn

W, H, D = 150, 104, 112
G = 4
TX, TZ = 42, 66  # cooling tower axis
RX, RZ = 110, 70  # reactor axis
BX0, BX1, BZ0, BZ1, BY1 = 12, 86, 10, 36, 42  # turbine hall
FAN = (38, 21)  # fan centre on the hall front (x, y)


def body() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    slab = box(g, 2, 0, 2, 148, G, 110, "steel", 4)
    P.plates(g, slab, "steel", 4, size=(16, 16), rivets=False, seed=1)
    P.flat(g, slab & (Y > G - 1) & ((X < 5) | (X > 145) | (Z < 5) | (Z > 107)) & ((np.floor(X + Z) // 3) % 2 == 0), "orange", 5)
    P.flat(g, edges(slab), "steel", 2)
    tower(g)
    reactor(g)
    hall(g)
    pipes(g)
    yard(g)
    return g


def tower(g: Grid) -> None:
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    lo = S.cone(g, "y", TX, TZ, 28, G, 60, "bone", 5, n=12, r_top=18)
    hi = S.cone(g, "y", TX, TZ, 23, 60, 100, "bone", 5, n=12, r_top=18, tip="lo")
    solids = g.solids[n0:]
    facet_paint(g, solids, hull_on("bone", 5, size=(10, 8), seed=2))
    m = lo | hi
    P.flat(g, m & S.seams(g, solids, 0.7), "bone", 4)
    # warning bands and a dark lip at the top
    P.flat(g, m & (Y > 84) & (Y < 91), "orange", 5)
    P.flat(g, m & ((np.abs(Y - 84.5) < 0.6) | (np.abs(Y - 90.5) < 0.6)), "orange", 3)
    P.flat(g, m & (Y > 70) & (Y < 76), "orange", 5)
    P.flat(g, m & (Y > 97), "steel", 3)
    # air-inlet arches around the foot
    ang = np.degrees(np.arctan2(Z - TZ, X - TX)) % 30
    arch = m & (Y < G + 12) & (np.abs(ang - 15) < 5) & ((Y < G + 8) | (np.abs(ang - 15) < 5 - (Y - G - 8) * 1.2))
    P.flat(g, arch, "steel", 3)
    P.flat(g, m & (Y < G + 1.5), "steel", 3)
    ring = S.disc(g, "y", TX, TZ, 24.5, 97, 100, "steel", 4, n=12)
    d = S.ngon_radius(g, "y", TX, TZ, 12)
    P.flat(g, ring & (d < 21), "steel", 3)  # the open throat
    P.flat(g, ring & (d < 15), "bone", 4)  # a wisp of steam inside
    P.flat(g, ring & (d > 21) & (d < 22) , "steel", 5)


def reactor(g: Grid) -> None:
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    drum = S.disc(g, "y", RX, RZ, 24, G, 32, "steel", 5, n=12)
    facet_paint(g, g.solids[n0:], plates_on("steel", 5, size=(10, 7), seed=3))
    ang = np.degrees(np.arctan2(Z - RZ, X - RX)) % 30
    vent = drum & (Y > 18) & (Y < 26) & (np.abs(ang - 15) < 4)
    P.flat(g, vent, "cyan", 6)
    P.flat(g, vent & (Y > 24), "cyan", 7)
    band = S.disc(g, "y", RX, RZ, 25, 29, 33, "orange", 5, n=12)
    P.flat(g, band & ((np.floor(X + Z + Y) // 2) % 2 == 0), "steel", 3)
    dome = S.dome(g, RX, RZ, 33, 24, h=22, n=12, rings=3, ramp="rust", base=4, cap_r=7, ribs=("rust", 2))
    crown = S.disc(g, "y", RX, RZ, 7, 55, 60, "cyan", 6, n=12)
    P.flat(g, crown & (Y > 59), "cyan", 7)
    P.flat(g, crown & S.seams(g, [g.solids[-1]], 0.7), "rust", 3)
    cap = S.disc(g, "y", RX, RZ, 4, 60, 63, "rust", 4, n=8)
    beacon(g, RX, 63, RZ, h=4)
    # vestibule with a steep gable and a blast door
    vx0, vx1, vz0, vz1 = 98, 122, 36, 50
    steel_box(g, vx0, G, vz0, vx1, 30, vz1, seed=4)
    corner_posts(g, vx0, vx1, vz0, vz1, G, 30, size=3)
    steel_roof(g, vx0, vx1, vz0, vz1, 31, 46, ridge="z", overhang=3, seed=5)
    blast_door(g, "-z", vz0, 103, 117, G, G + 20, seed=6)
    iw, ih = pnglyph.icon_size("bolt")
    plate = box(g, RX - 7, 33, vz0 - 2, RX + 7, 44, vz0, "orange", 5)
    P.flat(g, edges(plate), "orange", 3)
    pnglyph.icon(g, "-z", vz0 - 2, RX - iw // 2, 34, "bolt", "gold", 7)


def hall(g: Grid) -> None:
    X, Y, Z = coords(g)
    steel_box(g, BX0, G, BZ0, BX1, BY1, BZ1, seed=7)
    corner_posts(g, BX0, BX1, BZ0, BZ1, G, BY1)
    steel_roof(g, BX0, BX1, BZ0, BZ1, BY1 + 1, BY1 + 18, ridge="x", overhang=4, seed=8)
    blast_door(g, "-z", BZ0, 64, 78, G, G + 20, seed=9)
    sign(g, "-z", BZ0, 71, 30, "FUSION", scale=1, pad=2)
    big_gear(g, "-x", BX0, 23, 26, 8, teeth=9, thick=3)
    # the fan housing on the front wall: a dark back plate and a copper collar
    back = S.disc(g, "z", FAN[0], FAN[1], 12, BZ0 - 1, BZ0, "steel", 2, n=12)
    outer = S.flat_ngon(FAN[0], FAN[1], 13.5, 12, -np.pi / 2)
    inner = S.flat_ngon(FAN[0], FAN[1], 11.2, 12, -np.pi / 2)
    for k in range(12):
        g.prism("z", [outer[k], outer[(k + 1) % 12], inner[(k + 1) % 12], inner[k]], BZ0 - 5, BZ0, C("rust", 4 + (k % 2)))
        P.flat(g, S.last(g) & (Z < BZ0 - 4), "rust", 6 if k % 2 else 5)


def pipes(g: Grid) -> None:
    # coolant loop: reactor -> tower, tower -> hall
    S.pipe(g, [(RX - 20, 16, RZ + 8), (TX + 30, 16, RZ + 8)], s=6, ramp="rust", base=4)
    S.pipe(g, [(88, 24, RZ - 8), (92, 24, RZ - 8), (92, 24, 26), (84, 24, 26)], s=6, ramp="rust", base=4)
    S.pipe(g, [(TX - 22, 10, TZ - 16), (TX - 22, 10, BZ1 + 3), (TX - 22, 24, BZ1 + 3), (TX - 22, 24, BZ1 - 2)], s=5, ramp="rust", base=4)


def yard(g: Grid) -> None:
    X, Y, Z = coords(g)
    # lattice pylon at the back right (true diagonals)
    truss(g, "z", (138, G), (140, 78), 10, 96, 98, ramp="rust", base=5, braces=6, thick=2)
    truss(g, "z", (138, G), (140, 78), 10, 105, 107, ramp="rust", base=5, braces=6, thick=2)
    arm = box(g, 128, 74, 95, 149, 78, 108, "rust", 4)
    P.flat(g, edges(arm), "rust", 3)
    for x in (130, 146):
        ins = box(g, x - 1, 68, 100, x + 1, 74, 102, "cyan", 5)
        P.flat(g, ins & (np.floor(Y) % 2 == 0), "bone", 6)
    # transformer
    tr = steel_box(g, 128, G, 8, 146, 22, 26, seed=10)
    P.flat(g, tr & (np.floor(X) % 3 == 0) & (Z < 8.9) & (Y > G + 3) & (Y < 19), "steel", 3)
    for x in (131, 137, 143):
        c = box(g, x - 1, 22, 15, x + 1, 28, 17, "cyan", 5)
        P.flat(g, c & (np.floor(Y) % 2 == 0), "bone", 6)
    crate(g, 90, G, 6, 10)
    crate(g, 92, G + 10, 8, 6, ramp="steel", base=5, stripe=("orange", 5))
    fuel_drum(g, 6 + 4, 48, G, h=12, r=4.5)
    fuel_drum(g, 6 + 4, 60, G, h=12, r=4.5, ramp="steel")


def fan() -> Grid:
    """The intake fan: five broad copper blades (true slopes) on a gold hub."""
    g = Grid(24, 24, 3)
    c = 12
    for k in range(5):
        blade = S.rotate([(c + 1.5, c - 2.5), (c + 10.4, c - 4.5), (c + 10.8, c + 2.5), (c + 1.5, c + 2)], c, c, 72 * k)
        g.prism("z", blade, 0, 2, C("rust", 5))
        m = S.last(g)
        P.outline(g, m, "rust", 3, normal="z")
    hub = S.disc(g, "z", c, c, 3.5, 0, 3, "gold", 5)
    P.flat(g, hub & (S.ngon_radius(g, "z", c, c, 8) < 1.8), "gold", 7)
    return g


def build() -> Asset:
    g = body()
    root = Part("reactor-plant", g)
    root.add(Part("fan", fan(), pivot=(12.0, 12.0, 1.5), at=(FAN[0], FAN[1], BZ0 - 2.5)))  # z BZ0-4..BZ0-1
    return Asset(
        id="space-buildings-reactor-plant", pack="space", category="buildings", name="Fusion Power Plant", root=root,
        clips=[Clip("idle", {"fan": {"rot": turn(0.8, "z", 450.0)}})],
    )
