"""Research lab, in the Pirate Nation mecha style.

A two-storey block (plated steel ground floor, white hull upper floor, a
dark floor band and thick corner posts) under a steep steel gable roof
with a LAB sign in the gable, a striped awning over a wide blast door and
rows of glowing teal windows. A glass corridor on copper mullions leads to
the oversized function prop: a specimen dome of glowing teal glass panes
on copper ribs (true slopes) over a plated drum, with a sampling mast
whose dish nods on `idle`. A slanted glass greenhouse leans on the -X
wall; two chemical tanks with glowing green gauges, pipes, a gear, drums
and crates fill the yard. Detail is painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnkit
import pnshapes as S
from _bld import band, beacon, big_gear, blast_door, coords, corner_posts, crate, facet_paint, fuel_drum, hull_box, plates_on, sign, steel_box, steel_roof, window
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part

W, H, D = 134, 92, 90
G = 4
BX0, BX1, BZ0, BZ1 = 16, 62, 16, 54  # block
S1, S2 = 32, 58  # floor band and wall top
DX, DZ, DR = 106, 40, 20  # specimen dome


def body() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    slab = box(g, 2, 0, 2, 132, G, 88, "steel", 4)
    P.plates(g, slab, "steel", 4, size=(16, 16), rivets=False, seed=1)
    P.flat(g, edges(slab), "steel", 2)
    block(g)
    corridor(g)
    dome_drum(g)
    greenhouse(g)
    yard(g)
    return g


def block(g: Grid) -> None:
    X, Y, Z = coords(g)
    steel_box(g, BX0, G, BZ0, BX1, S1, BZ1, seed=2)
    hull_box(g, BX0, S1, BZ0, BX1, S2, BZ1, seed=3)
    corner_posts(g, BX0, BX1, BZ0, BZ1, G, S2)
    band(g, BX0 - 2, S1 - 1, BZ0 - 2, BX1 + 2, S1 + 3, BZ1 + 2)
    band(g, BX0 - 2, S2 - 3, BZ0 - 2, BX1 + 2, S2, BZ1 + 2)
    r = steel_roof(g, BX0, BX1, BZ0, BZ1, S2, S2 + 28, ridge="z", overhang=4, seed=4)
    sign(g, "-z", BZ0, (BX0 + BX1) / 2, S2 + 3, "LAB", scale=2, pad=2)
    blast_door(g, "-z", BZ0, 31, 47, G, G + 20, seed=5)
    pnkit.awning(g, "-z", BZ0, 26, 52, G + 26, depth=8, drop=5, ramps=("orange", "bone"), stripe=3)
    for u0 in (20, 50):
        window(g, "-z", BZ0, u0, u0 + 8, 13, 23, bar=False)
    for u0 in (21, 35, 49):
        window(g, "-z", BZ0, u0, u0 + 8, S1 + 8, S1 + 18)
    for face, plane in (("-x", BX0), ("+x", BX1)):
        for zc in (26, 44):
            window(g, face, plane, zc - 5, zc + 5, S1 + 8, S1 + 18)
    big_gear(g, "+z", BZ1, 38, 22, 9, teeth=10)
    S.pipe(g, [(BX1 - 6, G, BZ1 + 4), (BX1 - 6, S2 + 6, BZ1 + 4)], s=4, ramp="rust", base=4)
    # roof vent
    v = steel_box(g, 26, S2 + 14, 40, 34, S2 + 24, 46, seed=6)
    P.flat(g, v & (Y > S2 + 22), "orange", 5)


def corridor(g: Grid) -> None:
    X, Y, Z = coords(g)
    cz0, cz1 = 28, 44
    glass = box(g, BX1, G, cz0, DX - DR + 2, 24, cz1, "cyan", 6)
    P.flat(g, glass & (Y > 20), "cyan", 7)
    P.flat(g, glass & ((np.floor(X) % 7 == 0) | (Y < G + 3)), "rust", 4)
    roof = steel_box(g, BX1, 24, cz0 - 2, DX - DR + 2, 28, cz1 + 2, seed=7)
    P.flat(g, roof & (Y < 25), "orange", 5)


def dome_drum(g: Grid) -> None:
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    drum = S.disc(g, "y", DX, DZ, DR, G, 24, "steel", 5, n=10)
    facet_paint(g, g.solids[n0:], plates_on("steel", 5, size=(8, 7), seed=8))
    rim = S.disc(g, "y", DX, DZ, DR + 1, 22, 26, "orange", 5, n=10)
    P.flat(g, rim & ((np.floor(X + Z + Y) // 2) % 2 == 0), "steel", 3)

    def glass(gg, mm, fr):
        U, V = P.uv(gg, fr)
        P.flat(gg, mm, "cyan", 6)
        P.flat(gg, mm & ((U + V) % 9 == 0), "cyan", 7)  # glints
    dm = S.dome(g, DX, DZ, 26, DR, h=22, n=10, rings=3, ramp="cyan", base=6, cap_r=5, painter=glass, ribs=None)
    P.flat(g, dm & ((np.abs(Y - 37.5) < 0.6) | (np.abs(Y - 45.5) < 0.6) | (Y < 27.2)), "rust", 4)  # clean copper frame rings
    cap = S.disc(g, "y", DX, DZ, 5.5, 48, 51, "rust", 4, n=10)
    P.flat(g, cap & (Y > 50), "rust", 6)


def greenhouse(g: Grid) -> None:
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    g.prism("z", [(BX0 - 12, G), (BX0, G), (BX0, 30), (BX0 - 12, 18)], 22, 48, C("cyan", 5))
    gh = S.last(g)
    P.flat(g, gh, "teal", 5)
    P.flat(g, gh & ((np.floor(Z) % 6 == 0) | (Y < G + 3)), "rust", 4)
    P.flat(g, gh & (Y > G + 3) & (Y < G + 8) & (np.floor(Z) % 6 != 0), "leaf", 4)  # plants behind the glass
    P.flat(g, gh & (Y > G + 3) & (Y < G + 8) & (np.floor(Z + Y) % 5 == 0), "lime", 5)


def yard(g: Grid) -> None:
    X, Y, Z = coords(g)
    for cx, cz in ((80, 70), (94, 76)):
        t = S.disc(g, "y", cx, cz, 6, G, 34, "bone", 6, n=8)
        P.mottle(g, t, "bone", 6, seed=cx)
        gauge = t & (Z < cz - 5) & (np.abs(X - cx) < 1.8) & (Y > 10) & (Y < 28)
        P.flat(g, gauge, "toxic", 5)
        P.flat(g, gauge & (Y > 22), "toxic", 7)
        P.flat(g, t & ((np.abs(Y - 8) < 1) | (np.abs(Y - 31) < 1)), "steel", 3)
        S.cone(g, "y", cx, cz, 6, 34, 38, "rust", 4, n=8, r_top=3)
    S.pipe(g, [(80, 30, 64), (80, 30, BZ1 + 8), (BX1 - 2, 30, BZ1 + 8)], s=3, ramp="rust", base=4)
    crate(g, 120, G, 6, 9)
    crate(g, 121, G + 9, 8, 6, ramp="steel", base=5, stripe=("orange", 5))
    fuel_drum(g, 124, 22, G, h=12, r=4.5)
    fuel_drum(g, 6, 70, G, h=12, r=4.5, ramp="steel")
    beacon(g, 128, G, 80, h=14)


def mast() -> Grid:
    """Sampling mast: a striped pole with a tilted white dish and a teal feed."""
    g = Grid(20, 30, 20)
    X, Y, Z = coords(g)
    pole = box(g, 9, 0, 9, 11, 18, 11, "steel", 4)
    P.flat(g, pole & (np.floor(Y) % 4 == 0), "orange", 5)
    head = box(g, 7, 16, 7, 13, 20, 13, "rust", 4)
    P.flat(g, edges(head), "rust", 3)
    g.prism("x", [(20, 1), (22, 1), (29, 13), (27, 13)], 1, 19, C("bone", 6))
    d = S.last(g)
    P.flat(g, d & ((X < 2) | (X > 18)), "orange", 5)
    P.flat(g, d & (np.floor(X) % 6 == 0), "bone", 4)
    S.bar(g, "x", (21, 9), (24, 4), 1.5, 9, 11, "cyan", 7)
    return g


def build() -> Asset:
    g = body()
    root = Part("research-lab", g)
    root.add(Part("mast", mast(), pivot=(10.0, 0.0, 10.0), at=(DX, 51.0, DZ)))
    nod = {"mast": {"rot": [(0.0, (0.0, -20.0, 0.0)), (2.0, (12.0, 20.0, 0.0)), (4.0, (0.0, -20.0, 0.0))]}}
    return Asset(
        id="space-buildings-research-lab", pack="space", category="buildings", name="Research Lab", root=root,
        clips=[Clip("idle", nod)],
    )
