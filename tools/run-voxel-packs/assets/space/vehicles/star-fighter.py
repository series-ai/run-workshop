"""Star fighter, in the Pirate Nation mecha style.

A chunky retro interceptor: a hexagonal white fuselage (true facets) with a
drooping red nose cone, a faceted teal bubble canopy on copper frames,
swept wings that taper and droop (frustum prisms: true diagonals in plan
and in section) with red chevrons and hazard tips, gun pods on the tips,
twin swept tail fins, and two steel engines with copper rings and glowing
nozzles. Stubby landing legs let it sit on the ground. Idle hovers; move
banks and the flames (flame-l, flame-r) flare. Detail is painted. Faces -Z
(the nose).
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import coords, facet_paint, hull_on, rel
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket

W, H, D = 80, 48, 102
CX, YC = 40, 21
ZN, ZF0, ZF1, ZT = 0, 20, 82, 90  # nose tip, fuselage, tail
ENG = ((CX - 9, YC - 1), (CX + 9, YC - 1))
EZ = 96  # nozzle plane


def hexa(sx: float = 1.0, sy: float = 1.0, dy: float = 0.0):
    return [(CX - 6 * sx, YC - 8 * sy + dy), (CX + 6 * sx, YC - 8 * sy + dy), (CX + 11 * sx, YC + dy), (CX + 6 * sx, YC + 9 * sy + dy), (CX - 6 * sx, YC + 9 * sy + dy), (CX - 11 * sx, YC + dy)]


def hull() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    g.prism("z", hexa(), ZF0, ZF1, C("bone", 6))
    g.prism("z", hexa(0.15, 0.15, -3), ZN, ZF0, C("red", 5), top=hexa())
    g.prism("z", hexa(), ZF1, ZT, C("bone", 6), top=hexa(0.6, 0.7))
    solids = g.solids[n0:]
    facet_paint(g, solids, hull_on("bone", 6, size=(10, 9), seed=1))
    fus = np.logical_or.reduce([sd.mask(g.shape) for sd in solids])
    P.flat(g, fus & (Z < ZF0), "red", 5)
    P.flat(g, fus & (Z < ZF0) & (Y > YC + 1) & (X < CX), "red", 6)
    P.flat(g, fus & (np.abs(Z - ZF0 - 1) < 1), "bone", 3)
    P.flat(g, fus & S.seams(g, solids, 0.7), "bone", 4)
    # a red racing stripe down both flanks, a hull number
    P.flat(g, fus & (np.abs(Y - YC) < 1.5) & (Z > ZF0 + 2) & (Z < 60), "red", 5)
    P.flat(g, fus & (Y < YC - 6), "steel", 5)  # belly
    spine = box(g, CX - 3, YC + 8, 50, CX + 3, YC + 12, 84, "steel", 4)
    P.flat(g, spine & (np.abs(X - CX) < 1), "orange", 5)
    P.flat(g, edges(spine), "steel", 2)
    # intakes
    for s in (-1, 1):
        it = box(g, CX + s * 10 - (4 if s > 0 else 0), YC - 6, 28, CX + s * 10 + (0 if s < 0 else 4), YC + 2, 46, "steel", 4)
        P.flat(g, it & (Z < 31), "steel", 2)
        P.flat(g, edges(it), "steel", 3)
    canopy(g)
    wings(g)
    engines(g)
    fins(g)
    legs(g)
    return g


def canopy(g: Grid) -> None:
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    g.prism("y", [(CX - 6, 18), (CX + 6, 18), (CX + 8, 34), (CX + 6, 52), (CX - 6, 52), (CX - 8, 34)], YC + 8, YC + 18,
            C("cyan", 6), top=[(CX - 3, 27), (CX + 3, 27), (CX + 4, 35), (CX + 3, 45), (CX - 3, 45), (CX - 4, 35)])
    c = S.last(g)
    P.flat(g, c, "cyan", 6)
    P.flat(g, c & (Y > YC + 15), "cyan", 7)
    P.flat(g, c & S.seams(g, g.solids[n0:], 0.8), "rust", 4)
    P.flat(g, c & (np.abs(Z - 34) < 0.8), "rust", 4)
    P.flat(g, c & (Y < YC + 9), "rust", 3)


def wings(g: Grid) -> None:
    X, Y, Z = coords(g)
    for s in (-1, 1):
        root_, tip_x = CX + s * 9, CX + s * 37
        base = [(root_, YC - 2), (CX + s * 15, YC - 2.5), (CX + s * 15, YC + 1), (root_, YC + 2)]
        top = [(root_, YC - 2), (tip_x, YC - 7), (tip_x, YC - 4), (root_, YC + 2)]
        n0 = len(g.solids)
        g.prism("z", base, 34, 80, C("bone", 6), top=top)
        w = S.last(g)
        facet_paint(g, g.solids[n0:], hull_on("bone", 6, size=(8, 10), seed=2 + s))
        d = np.abs(X - CX)
        chev = w & (np.abs((Z - 34) - (d - 9) * 1.0 - 22) < 2.5)
        mis = S.disc(g, "z", CX + s * 21, YC - 8, 2.2, 48, 72, "bone", 6, n=6)
        P.flat(g, mis & (Z < 52), "red", 5)
        P.flat(g, mis & (Z > 69), "steel", 3)
        box(g, CX + s * 21 - 0.5, YC - 7, 56, CX + s * 21 + 1.5, YC - 3, 64, "steel", 3)
        P.flat(g, chev, "red", 5)
        P.flat(g, w & (d > 30) & ((np.floor(Z) // 3) % 2 == 0), "orange", 5)
        P.flat(g, w & (d > 30) & ((np.floor(Z) // 3) % 2 == 1), "steel", 3)
        P.flat(g, w & (Z > 79), "bone", 4)
        # gun pod on the tip
        x0 = tip_x - 2 if s > 0 else tip_x - 2
        pod = box(g, x0, YC - 11, 62, x0 + 4, YC - 5, 86, "steel", 4)
        P.flat(g, pod & (Z < 68), "red", 5)
        P.flat(g, pod & (Z < 65), "steel", 2)
        P.flat(g, edges(pod), "steel", 3)


def engines(g: Grid) -> None:
    X, Y, Z = coords(g)
    for ex, ey in ENG:
        e = S.disc(g, "z", ex, ey, 6.5, 66, EZ, "steel", 4, n=8)
        facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.plates(gg, mm, "steel", 4, size=(6, 8), frame=fr))
        d = S.ngon_radius(g, "z", ex, ey, 8)
        for z0 in (74, 88):
            P.flat(g, e & (Z > z0) & (Z < z0 + 3), "rust", 4)
        P.flat(g, e & (Z > EZ - 1) & (d < 4.5), "cyan", 7)
        P.flat(g, e & (Z > EZ - 1) & (d >= 4.5), "rust", 3)


def fins(g: Grid) -> None:
    X, Y, Z = coords(g)
    for s in (-1, 1):
        x0 = CX + s * 6 - 1
        g.prism("x", [(YC + 6, 68), (YC + 6, 90), (YC + 24, 96), (YC + 24, 88)], x0, x0 + 3, C("bone", 6))
        f = S.last(g)
        P.flat(g, f & (Y > YC + 19), "red", 5)
        P.flat(g, f & (Y > YC + 14) & (Y < YC + 16), "orange", 5)
        P.outline(g, f, "bone", 4, normal="x")


def legs(g: Grid) -> None:
    for x, z in ((CX, 22), (CX - 12, 70), (CX + 12, 70)):
        box(g, x - 1.5, 2, z - 1.5, x + 1.5, YC - 6, z + 1.5, "steel", 3)
        p = box(g, x - 2.5, 0, z - 2.5, x + 2.5, 2, z + 2.5, "steel", 4)
        P.flat(g, edges(p), "steel", 2)


def flame() -> Grid:
    g = Grid(12, 12, 11)
    X, Y, Z = coords(g)
    f = S.cone(g, "z", 6, 6, 5, 0, 11, "orange", 6, n=8)
    P.flat(g, f & (Z < 4), "gold", 7)
    P.flat(g, f & (Z > 8), "red", 5)
    return g


def build() -> Asset:
    g = hull()
    pv = (CX, YC, D / 2)  # bank and bob about the fuselage axis
    root = Part("star-fighter", g, pivot=pv)
    for name, (ex, ey) in zip(("flame-l", "flame-r"), ENG):
        root.add(Part(name, flame(), pivot=(6.0, 6.0, 0.0), at=rel(pv, (ex, ey, EZ))))
    flick = [(i * 0.1, (1.0, 1.0, 1.0 + (0.35 if i % 2 else 0.0))) for i in range(9)]
    roar = [(i * 0.1, (1.1, 1.1, 1.6 + (0.5 if i % 2 else 0.0))) for i in range(41)]
    idle = {"star-fighter": {"loc": [(i * 0.5, (0.0, [0, 0.6, 1, 0.6, 0, -0.6, -1, -0.6, 0][i], 0.0)) for i in range(9)]}, "flame-l": {"scale": flick}, "flame-r": {"scale": flick}}
    move = {"star-fighter": {"rot": [(0.0, (0.0, 0.0, 0.0)), (1.0, (0.0, 0.0, 20.0)), (2.0, (0.0, 0.0, 0.0)), (3.0, (0.0, 0.0, -20.0)), (4.0, (0.0, 0.0, 0.0))]},
            "flame-l": {"scale": roar}, "flame-r": {"scale": roar}}
    return Asset(
        id="space-vehicles-star-fighter", pack="space", category="vehicles", name="Star Fighter", root=root,
        clips=[Clip("idle", idle), Clip("move", move)],
        sockets=[Socket("socket-engine", at=rel(pv, (CX, YC - 1, EZ + 2))), Socket("socket-cannon-l", at=rel(pv, (CX - 37, YC - 8, 61))), Socket("socket-cannon-r", at=rel(pv, (CX + 37, YC - 8, 61)))],
        pfx=[{"effectId": "rvx-space-engine-exhaust", "socket": "socket-engine", "trigger": "clip:move", "size": 34, "aim": [0.0, 0.0, 1.0]},
             # the guns fire forward, along -z (the nozzles are at +z)
             {"effectId": "rvx-space-laser-bolt", "socket": "socket-cannon-l", "trigger": "manual", "size": 16, "aim": [0.0, 0.0, -1.0]},
             {"effectId": "rvx-space-laser-bolt", "socket": "socket-cannon-r", "trigger": "manual", "size": 16, "aim": [0.0, 0.0, -1.0]}],
    )
