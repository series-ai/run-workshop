"""Station module, in the Pirate Nation mecha style.

A landed space-station habitation drum: a fat 12-sided white hull (true
facets) with dark steel ribs, a hazard-orange stripe, rows of glowing teal
portholes and an RVX-1 name plate over the collar, tapered at both ends (frustums). A
steel docking collar with a hazard ring and a glowing hatch faces the
front, reached by a steep boarding stair. It stands on four splayed
landing legs (true diagonals) with foot pads, with an orange cargo pod
slung under the belly, RCS thruster blocks, copper pipes and a big gear on
the tail. The function prop is oversized: two long blue solar wings on a
roof mast that track the sun on `idle`. Detail is painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import beacon, big_gear, coords, crate, facet_paint, fuel_drum, hull_on, plates_on, sign
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part

W, H, D = 74, 94, 134
CX, CY, R = 37, 48, 26  # hull axis (x, y) and flat radius
Z0, Z1 = 32, 112  # the straight hull
WZ = 72  # wing mast (z)


def body() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    hull = S.disc(g, "z", CX, CY, R, Z0, Z1, "bone", 5, n=12)
    front = S.cone(g, "z", CX, CY, R, Z0 - 8, Z0, "bone", 5, n=12, r_top=15, tip="lo")
    tail = S.cone(g, "z", CX, CY, R, Z1, Z1 + 10, "bone", 5, n=12, r_top=13)
    solids = g.solids[n0:]
    facet_paint(g, solids, hull_on("bone", 5, size=(10, 12), seed=1))
    m = hull | front | tail
    P.flat(g, m & S.seams(g, solids, 0.7), "bone", 3)
    # dark ribs, a hazard stripe along the side, portholes
    for z in (Z0, 52, 72, 92, Z1 - 3):
        rib = S.disc(g, "z", CX, CY, R + 1, z, z + 3, "steel", 3, n=12)
        P.flat(g, rib & (np.floor(X + Y) % 5 == 0) & (np.floor(Z) == z + 1), "steel", 6)
    d = S.ngon_radius(g, "z", CX, CY, 12)
    ang = np.degrees(np.arctan2(Y - CY, X - CX))
    side = hull & ((np.abs(ang) < 20) | (np.abs(ang) > 160))
    P.flat(g, side & (np.abs(Y - CY + 6) < 1.6), "orange", 5)
    for zc in (42, 62, 82, 102):
        port = side & (np.abs(Y - CY - 2) < 3.5) & (np.abs(Z - zc) < 3.5)
        P.flat(g, port, "rust", 3)
        P.flat(g, port & (np.abs(Y - CY - 2) < 2.4) & (np.abs(Z - zc) < 2.4), "cyan", 6)
        P.flat(g, port & (Y > CY + 3) & (np.abs(Z - zc) < 1.2), "cyan", 7)
    topm = hull & (np.abs(ang - 90) < 16)
    P.flat(g, topm & (np.floor(Z) % 8 == 0) & (Z > Z0 + 4), "orange", 5)
    # the name plate on the docking collar side of the roof
    plate = box(g, CX - 16, CY + R - 3, Z0 - 6, CX + 16, CY + R + 7, Z0 - 4, "orange", 5)
    P.flat(g, edges(plate), "orange", 3)
    tw, _th = pnglyph.text_size("RVX-1")
    pnglyph.text(g, "-z", Z0 - 6, CX - tw // 2, CY + R - 1, "RVX-1", "bone", 7)
    collar(g)
    legs(g)
    topside(g)
    return g


def collar(g: Grid) -> None:
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    col = S.disc(g, "z", CX, CY, 15, Z0 - 14, Z0 - 8, "steel", 4, n=12)
    facet_paint(g, g.solids[n0:], plates_on("steel", 4, size=(6, 6), seed=2))
    face = col & (Z < Z0 - 13)
    d = S.ngon_radius(g, "z", CX, CY, 12)
    P.flat(g, face & (d > 12), "orange", 5)
    P.flat(g, face & (d > 12) & ((np.floor(X + Y) // 2) % 2 == 0), "steel", 2)
    hatch = face & (np.abs(X - CX) < 6) & (Y > CY - 10) & (Y < CY + 8)
    P.flat(g, hatch, "steel", 5)
    P.flat(g, hatch & ((np.abs(X - CX) > 5) | (Y > CY + 7) | (Y < CY - 9)), "steel", 3)
    P.flat(g, hatch & (np.abs(X - CX) < 3.5) & (Y > CY) & (Y < CY + 5), "cyan", 6)
    P.flat(g, hatch & (np.abs(X - CX) < 1.5) & (np.abs(Y - CY + 4) < 0.8), "gold", 6)
    # the boarding stair (a true slope) with painted treads and a rail
    g.prism("x", [(0, 0), (0, Z0 - 14), (CY - 10, Z0 - 14)], CX - 6, CX + 6, C("steel", 4))
    st = S.last(g)
    P.flat(g, st & (np.floor(Y) % 4 == 0), "steel", 6)
    P.flat(g, st & ((X < CX - 5) | (X > CX + 5)), "orange", 5)
    for x0 in (CX - 8, CX + 6):
        S.bar(g, "x", (6, 1), (CY - 3, Z0 - 15), 2, x0, x0 + 2, "steel", 3)


def legs(g: Grid) -> None:
    X, Y, Z = coords(g)
    for z0 in (40, 100):
        for s in (-1, 1):
            m = S.bar(g, "z", (CX + s * 16, CY - 14), (CX + s * 30, 3), 5, z0, z0 + 5, "steel", 4)
            P.flat(g, m & (np.floor(Y) % 6 == 0), "orange", 5)
            pad = box(g, CX + s * 30 - 5, 0, z0 - 2, CX + s * 30 + 5, 3, z0 + 7, "steel", 3)
            P.flat(g, edges(pad), "steel", 2)
            S.pipe(g, [(CX + s * 20, CY - 16, z0 + 2.5), (CX + s * 20, CY - 8, z0 + 2.5)], s=3, ramp="rust", base=4, flange=False)
    # belly cargo pod
    pod = box(g, CX - 10, 8, 58, CX + 10, CY - R + 2, 86, "orange", 5)
    P.mottle(g, pod, "orange", 5, seed=3)
    P.flat(g, edges(pod), "steel", 3)
    P.flat(g, pod & (np.abs(Y - 12) < 1) , "cyan", 6)
    fuel_drum(g, 8, 118, 0, h=12, r=4.5)
    fuel_drum(g, 64, 14, 0, h=11, r=4, ramp="steel")
    crate(g, 58, 0, 116, 9)


def topside(g: Grid) -> None:
    X, Y, Z = coords(g)
    top = CY + R
    mast = box(g, CX - 3, top - 2, WZ - 4, CX + 3, top + 12, WZ + 4, "steel", 4)
    P.flat(g, mast & (np.floor(Y) % 4 == 0), "orange", 5)
    P.flat(g, edges(mast), "steel", 2)
    box(g, CX - 5, top + 9, WZ - 3, CX + 5, top + 13, WZ + 3, "rust", 4)
    beacon(g, CX, top - 1, Z0 + 6, h=6)
    # RCS thruster blocks
    for z in (Z0 + 3, Z1 - 3):
        for s in (-1, 1):
            b = box(g, CX + s * (R + 1) - (3 if s > 0 else 0), CY + 10, z - 3, CX + s * (R + 1) + (0 if s > 0 else 3), CY + 16, z + 3, "steel", 3)
            P.flat(g, b & (np.abs(Y - CY - 13) < 1), "orange", 5)
    # copper pipe along the roof, into the tail
    S.pipe(g, [(CX - 9, top - 3, Z0 + 10), (CX - 9, top - 3, Z1 + 4)], s=3, ramp="rust", base=4)
    big_gear(g, "+z", Z1 + 10, CX, CY, 9, teeth=10, thick=3)


def wing(side: int) -> Grid:
    """A long blue solar wing: cells in a steel frame on a copper boom."""
    L, Wd = 56, 24
    g = Grid(L, 4, Wd)
    X, Y, Z = coords(g)
    boom = box(g, 0, 1, Wd / 2 - 2, L, 3, Wd / 2 + 2, "rust", 4)
    panel = box(g, 4, 1, 0, L, 3, Wd, "blue", 4)
    P.flat(g, panel & ((np.floor(X) % 7 == 3) | (np.floor(Z) % 5 == 0)), "blue", 2)
    P.flat(g, panel & (np.floor(X) % 7 == 5) & (np.floor(Z) % 5 == 2), "blue", 6)  # glints
    P.flat(g, panel & ((X < 5) | (X > L - 1) | (Z < 1) | (Z > Wd - 1)), "steel", 3)
    P.flat(g, panel & (np.abs(Z - Wd / 2) < 1.5), "rust", 4)
    return g if side > 0 else g.flip("x")


def build() -> Asset:
    g = body()
    root = Part("station-module", g)
    wy = CY + R + 11
    root.add(Part("wing-l", wing(-1), pivot=(56.0, 2.0, 12.0), at=(CX - 5, wy, WZ)))
    root.add(Part("wing-r", wing(1), pivot=(0.0, 2.0, 12.0), at=(CX + 5, wy, WZ)))
    track = [(0.0, (-15.0, 0.0, 0.0)), (3.0, (15.0, 0.0, 0.0)), (6.0, (-15.0, 0.0, 0.0))]
    return Asset(
        id="space-buildings-station-module", pack="space", category="buildings", name="Station Module", root=root,
        clips=[Clip("idle", {"wing-l": {"rot": track}, "wing-r": {"rot": track}})],
    )
