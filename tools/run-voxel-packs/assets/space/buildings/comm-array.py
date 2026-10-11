"""Deep-space comm array, in the Pirate Nation mecha style.

The function prop is oversized (rule F4): a giant white dish bowl (a
12-sided frustum, true slopes) with painted rings, a hazard-orange rim and
a copper feed horn on three diagonal struts, tilted up on a copper yoke
over a big turntable gear. It slews on `idle`. It stands on a tapered white
octagonal pedestal with dark bands and a painted ladder. A small plated
relay hut with a steep steel gable roof, a blast door and a COMM sign sits
at the foot, piped to the pedestal. Detail is painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import band, beacon, big_gear, blast_door, coords, corner_posts, crate, facet_paint, fuel_drum, hull_on, plates_on, sign, steel_box, steel_roof, window
from pnkit import box, edges
from voxgrid import Asset, Clip, Grid, Part

W, H, D = 70, 72, 70
CX, CZ = 38, 40  # pedestal axis
PY0, PY1 = 4, 58  # pedestal
HX0, HX1, HZ0, HZ1, HY1 = 3, 25, 6, 28, 28  # relay hut


def base() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    pl = S.disc(g, "y", 35, 35, 34, 0, PY0, "steel", 4)
    facet_paint(g, [g.solids[-1]], plates_on("steel", 4, size=(10, 6), seed=1))
    rim = pl & (Y > PY0 - 1) & (S.ngon_radius(g, "y", 35, 35, 8) > 31)
    P.flat(g, rim, "orange", 5)
    P.flat(g, rim & ((np.floor(X + Z) // 3) % 2 == 0), "steel", 2)
    # the pedestal: a tapered white octagon
    n0 = len(g.solids)
    ped = S.cone(g, "y", CX, CZ, 15, PY0, PY1, "bone", 5, n=8, r_top=9)
    facet_paint(g, g.solids[n0:], hull_on("bone", 5, size=(9, 10), seed=2))
    P.flat(g, ped & S.seams(g, g.solids[n0:], 0.8), "bone", 3)
    for y0 in (PY0, 30, PY1 - 4):
        r = 15 - 6 * (y0 - PY0) / (PY1 - PY0)
        b = S.disc(g, "y", CX, CZ, r + 0.9, y0, y0 + 4, "steel", 3)
        P.flat(g, b & (np.floor(X + Z) % 5 == 0) & (np.floor(Y) == y0 + 2), "steel", 6)
        if y0 == 30:  # a hazard-orange warning band
            P.flat(g, b, "orange", 5)
            P.flat(g, b & ((np.floor(X + Z + Y) // 2) % 2 == 0), "steel", 3)
    # a painted ladder and teal port lights on the front facet
    front = ped & (Z < CZ - 8)
    P.flat(g, front & (np.abs(X - CX) > 2) & (np.abs(X - CX) < 3.2) & (Y > 8) & (Y < 54), "steel", 3)
    P.flat(g, front & (np.abs(X - CX) < 2.2) & (np.floor(Y) % 4 == 0) & (Y > 8) & (Y < 54), "steel", 3)
    side = ped & (X > CX + 8)
    for y0 in (14, 40):
        P.flat(g, side & (Y > y0) & (Y < y0 + 6) & (np.abs(Z - CZ) < 3), "cyan", 6)
        P.flat(g, side & (Y > y0 + 4) & (Y < y0 + 6) & (np.abs(Z - CZ) < 3), "cyan", 7)
    # the turntable: a big copper gear lying on the pedestal top
    S.gear(g, "y", CX, CZ, 11, PY1, PY1 + 4, teeth=14, depth=2.5, ramp="rust", base=4)
    top = S.disc(g, "y", CX, CZ, 7, PY1 + 4, PY1 + 6, "steel", 4)
    P.flat(g, top & (S.ngon_radius(g, "y", CX, CZ, 8) > 6), "orange", 5)
    hut(g)
    yard(g)
    return g


def hut(g: Grid) -> None:
    X, Y, Z = coords(g)
    steel_box(g, HX0, PY0, HZ0, HX1, HY1, HZ1, seed=3)
    corner_posts(g, HX0, HX1, HZ0, HZ1, PY0, HY1, size=3)
    steel_roof(g, HX0, HX1, HZ0, HZ1, HY1 + 1, HY1 + 17, ridge="z", overhang=3, seed=4)
    blast_door(g, "-z", HZ0, 7, 21, PY0, PY0 + 18, seed=5)
    sign(g, "-z", HZ0, (HX0 + HX1) / 2, HY1 + 3, "COMM", pad=2)
    window(g, "-x", HX0, 12, 22, 12, 21)
    # copper conduit from the hut into the pedestal
    S.pipe(g, [(HX1 - 3, HY1 - 4, HZ1 - 5), (HX1 + 6, HY1 - 4, HZ1 - 5), (HX1 + 6, HY1 - 4, CZ - 6)], s=4, ramp="rust", base=4)


def yard(g: Grid) -> None:
    crate(g, 56, PY0, 8, 9)
    crate(g, 58, PY0 + 9, 10, 6, ramp="steel", base=5, stripe=("orange", 5))
    fuel_drum(g, 12, 44, PY0, h=12, r=4.5)
    fuel_drum(g, 12, 55, PY0, h=10, r=4, ramp="steel")
    beacon(g, 64, PY0, 58, h=12)


def yoke() -> Grid:
    """Copper yoke with a dark counterweight at the back."""
    g = Grid(16, 14, 20)
    col = box(g, 3, 0, 3, 13, 11, 13, "rust", 4)
    P.flat(g, edges(col), "rust", 3)
    X, Y, Z = coords(g)
    P.flat(g, col & (np.floor(Y) % 4 == 1), "rust", 5)
    cw = box(g, 2, 2, 13, 14, 9, 20, "steel", 3)
    P.plates(g, cw, "steel", 3, size=(6, 4), seed=6)
    P.flat(g, cw & (Z > 19), "orange", 5)
    return g


def dish() -> Grid:
    """The giant bowl: a 12-sided frustum, white face with painted rings and
    an orange rim, plated steel back, a copper feed horn on three struts."""
    R = 30
    g = Grid(2 * R + 2, 24, 2 * R + 2)
    c = R + 1
    n0 = len(g.solids)
    bowl = S.cone(g, "y", c, c, R, 0, 7, "bone", 6, n=12, r_top=11, tip="lo")
    facet_paint(g, g.solids[n0:], plates_on("steel", 5, size=(7, 5), seed=7))
    X, Y, Z = coords(g)
    face = bowl & (Y > 6)
    d = S.ngon_radius(g, "y", c, c, 12)
    P.flat(g, face, "bone", 6)
    P.flat(g, face & (np.floor(d) % 6 == 0), "bone", 4)
    P.flat(g, face & (d > R - 3), "orange", 5)
    P.flat(g, face & (d > R - 3) & ((np.floor(np.degrees(np.arctan2(Z - c, X - c)) / 15)) % 2 == 0), "orange", 3)
    P.flat(g, face & (d < 4), "steel", 4)
    # three struts (true diagonals) to the feed
    S.bar(g, "x", (7, c - 22), (17, c - 2), 2.2, c - 1, c + 1, "steel", 4)
    S.bar(g, "z", (c - 20, 7), (c - 2, 17), 2.2, c + 8, c + 10, "steel", 4)
    S.bar(g, "z", (c + 20, 7), (c + 2, 17), 2.2, c + 8, c + 10, "steel", 4)
    n1 = len(g.solids)
    horn = S.cone(g, "y", c, c + 3, 4, 15, 21, "rust", 4, n=8, r_top=2)
    P.flat(g, horn & (Y > 19), "cyan", 7)
    box(g, c - 1, 7, c + 2, c + 1, 15, c + 4, "steel", 5)
    return g


def build() -> Asset:
    g = base()
    root = Part("comm-array", g, pivot=(CX, 0.0, CZ))
    mount = root.add(Part("dish", yoke(), pivot=(8.0, 0.0, 8.0), at=(0.0, PY1 + 6, 0.0)))
    dg = dish()
    c = dg.shape[0] / 2
    mount.add(Part("dish-bowl", dg, pivot=(c, 0.0, c), at=(0.0, 11.0, 0.0), rot=(-42.0, 0.0, 6.0)))
    slew = [(0.0, (0.0, -25.0, 0.0)), (3.0, (0.0, 25.0, 0.0)), (6.0, (0.0, -25.0, 0.0))]
    return Asset(
        id="space-buildings-comm-array", pack="space", category="buildings", name="Deep-Space Comm Array", root=root,
        clips=[Clip("idle", {"dish": {"rot": slew}})],
    )
