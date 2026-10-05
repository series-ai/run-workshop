"""Orbital shuttle, in the Pirate Nation mecha style.

A chunky white orbiter: an octagonal fuselage with a black heat-tile belly
and a drooping nose (frustum) with a row of glowing flight-deck windows,
painted payload-bay doors, a planet roundel and a crew hatch. Big delta
wings taper and droop (frustum prisms, true diagonals) with black leading
edges; a tall swept tail fin with a red rudder; two OMS pods; three copper
main engine bells (frustums) with glowing throats; two hazard-orange
booster pods under the wings; and stubby landing gear. The engine flames
(`flames`) flicker on `idle` and roar on `move`, when the orbiter also
rolls; the warp-jump PFX sits at the tail. Detail is painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import coords, facet_paint, hull_on, rel
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket

W, H, D = 84, 62, 96
CX = 42
FY0, FY1 = 12, 36  # fuselage bottom and top
ZN, ZF0, ZF1 = 0, 16, 84  # nose tip, fuselage
ENG_Z = 94
ENGINES = ((CX - 6, 28), (CX + 6, 28), (CX, 20))


def octo(sx: float = 1.0, sy: float = 1.0, dy: float = 0.0):
    cy = (FY0 + FY1) / 2 + dy
    hw, hh, ch = 12 * sx, 12 * sy, 4 * min(sx, sy)
    return [(CX - hw + ch, cy - hh), (CX + hw - ch, cy - hh), (CX + hw, cy - hh + ch), (CX + hw, cy + hh - ch),
            (CX + hw - ch, cy + hh), (CX - hw + ch, cy + hh), (CX - hw, cy + hh - ch), (CX - hw, cy - hh + ch)]


def orbiter() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    g.prism("z", octo(), ZF0, ZF1, C("bone", 6))
    g.prism("z", octo(0.3, 0.3, -5), ZN, ZF0, C("bone", 6), top=octo())
    solids = g.solids[n0:]
    facet_paint(g, solids, hull_on("bone", 6, size=(12, 10), seed=1))
    fus = np.logical_or.reduce([sd.mask(g.shape) for sd in solids])
    P.flat(g, fus & S.seams(g, solids, 0.7), "bone", 4)
    P.flat(g, fus & (Y < FY0 + 5), "iron", 4)  # heat tiles
    P.flat(g, fus & (Y < FY0 + 5) & ((np.floor(X) + np.floor(Z)) % 4 == 0), "iron", 5)
    P.flat(g, fus & (Z < 5), "iron", 4)  # nose cap
    # flight-deck windows on the nose slope
    win = fus & (Z > 9) & (Z < 16) & (Y > FY1 - 7) & (np.abs(X - CX) < 9)
    P.flat(g, win, "cyan", 6)
    P.flat(g, win & (np.floor(X - CX) % 4 == 0), "iron", 3)
    P.flat(g, win & (Y > FY1 - 3), "cyan", 7)
    P.flat(g, fus & (np.abs(Y - FY0 - 7) < 1.2) & (Z > 8), "red", 5)  # a red cheat line
    # payload bay doors
    top = fus & (Y > FY1 - 1) & (Z > 22) & (Z < 76)
    P.flat(g, top & ((np.abs(X - CX) < 0.6) | (np.floor(Z) % 13 == 0)), "bone", 3)
    P.flat(g, top & (np.abs(np.abs(X - CX) - 7) < 0.6), "bone", 4)
    # roundel on both flanks, a crew hatch on the left
    for face, plane in (("+x", CX + 12), ("-x", CX - 12)):
        u0 = 30 if face == "-x" else 30
        pnglyph.icon(g, face, plane, u0, FY0 + 9, "planet", "blue", 4, inks={"+": ("orange", 6)})
    hatch = fus & (X < CX - 11) & (Z > 20) & (Z < 26) & (Y > FY0 + 7) & (Y < FY0 + 17)
    P.flat(g, hatch, "bone", 4)
    P.flat(g, hatch & (Y > FY0 + 12) & (Y < FY0 + 15) & (Z > 21) & (Z < 25), "cyan", 6)
    wings(g)
    tail(g)
    engines(g)
    boosters(g)
    gear(g)
    return g


def wings(g: Grid) -> None:
    X, Y, Z = coords(g)
    for s in (-1, 1):
        r = CX + s * 11
        base = [(r, FY0 + 2), (CX + s * 16, FY0 + 2), (CX + s * 16, FY0 + 4), (r, FY0 + 6)]
        top = [(r, FY0 + 2), (CX + s * 41, FY0 - 1), (CX + s * 41, FY0 + 1), (r, FY0 + 6)]
        n0 = len(g.solids)
        g.prism("z", base, 36, 86, C("bone", 6), top=top)
        w = S.last(g)
        facet_paint(g, g.solids[n0:], hull_on("bone", 6, size=(10, 10), seed=2 + s))
        d = np.abs(X - CX)
        lead = (Z - 36) - (d - 16) * (50 / 25)
        P.flat(g, w & (lead < 4), "iron", 4)
        P.flat(g, w & (Y < FY0 + 1.5), "iron", 4)
        P.flat(g, w & (Z > 84), "iron", 5)  # elevons
        P.flat(g, w & (Z > 80) & (Z < 81), "bone", 3)
        P.flat(g, w & (d > 33) & (lead >= 4) & ((np.floor(Z) // 3) % 2 == 0), "orange", 5)
        P.flat(g, w & (d > 33) & (lead >= 4) & ((np.floor(Z) // 3) % 2 == 1), "iron", 4)
        P.flat(g, w & (np.abs(d - 24) < 1.5) & (lead >= 4) & (Y > FY0 + 1.5), "red", 5)


def tail(g: Grid) -> None:
    X, Y, Z = coords(g)
    g.prism("x", [(FY1 - 1, 60), (FY1 - 1, 86), (FY1 + 24, 94), (FY1 + 24, 84)], CX - 1.5, CX + 1.5, C("bone", 6))
    f = S.last(g)
    P.mottle(g, f, "bone", 6, cell=3, seed=4)
    P.flat(g, f & (Z > 80 + (Y - FY1) * 0.4), "red", 5)  # rudder
    P.flat(g, f & (Z > 80 + (Y - FY1) * 0.4) & (np.floor(Y) % 6 == 0), "red", 3)
    P.flat(g, f & (Z < 62 + (Y - FY1) * (24 / 25)) , "iron", 4)
    P.outline(g, f, "bone", 4, normal="x")
    # OMS pods
    for s in (-1, 1):
        base = [(CX + s * 6 - 3, FY1 - 2), (CX + s * 6 + 3, FY1 - 2), (CX + s * 6 + 3, FY1 + 3), (CX + s * 6 - 3, FY1 + 3)]
        g.prism("z", [(x * 0.5 + (CX + s * 6) * 0.5, y * 0.5 + FY1 * 0.5) for x, y in base], 66, 74, C("bone", 6), top=base)
        g.prism("z", base, 74, 88, C("bone", 6))
        m = S.last(g)
        P.flat(g, m & (Z > 86), "iron", 4)


def engines(g: Grid) -> None:
    X, Y, Z = coords(g)
    plate = box(g, CX - 11, FY0 + 2, ZF1, CX + 11, FY1 - 2, ZF1 + 2, "iron", 4)
    for ex, ey in ENGINES:
        b = S.cone(g, "z", ex, ey, 5, ZF1 + 2, ENG_Z, "rust", 4, n=8, r_top=2.5, tip="lo")
        facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.plates(gg, mm, "rust", 4, size=(4, 3), rivets=False, frame=fr))
        d = S.ngon_radius(g, "z", ex, ey, 8)
        P.flat(g, b & (Z > ENG_Z - 1) & (d < 3.8), "cyan", 7)
        P.flat(g, b & (Z > ENG_Z - 1) & (d >= 3.8), "rust", 3)


def boosters(g: Grid) -> None:
    X, Y, Z = coords(g)
    for s in (-1, 1):
        bx = CX + s * 24
        m = S.disc(g, "z", bx, 8, 5, 42, 84, "orange", 5, n=8)
        m |= S.cone(g, "z", bx, 8, 5, 32, 42, "orange", 5, n=8, r_top=0, tip="lo")
        m |= S.cone(g, "z", bx, 8, 4, 84, 90, "steel", 3, n=8, r_top=2.5, tip="lo")
        P.mottle(g, m, "orange", 5, cell=3, seed=bx)
        P.flat(g, m & ((np.abs(Z - 50) < 1.5) | (np.abs(Z - 76) < 1.5)), "bone", 6)
        P.flat(g, m & (Z > 84), "steel", 3)
        box(g, bx - 1, 12, 56, bx + 1, FY0 + 3, 62, "steel", 3)


def gear(g: Grid) -> None:
    for x, z in ((CX, 22), (CX - 12, 66), (CX + 12, 66)):
        box(g, x - 1, 3, z - 1, x + 1, FY0 + 1, z + 1, "steel", 3)
        S.wheel(g, "x", z, 0, 3, x - 2, x + 2, n=8, tyre=("iron", 3), rim=("steel", 4), hub=("gold", 5), spokes=0)


def flames() -> Grid:
    """Three flame cones (one per engine), scaled on `idle` and `move`."""
    g = Grid(28, 22, 10)
    X, Y, Z = coords(g)
    for ex, ey in ENGINES:
        u, v = ex - CX + 14, ey - 18 + 2
        f = S.cone(g, "z", u, v, 3.5, 0, 10, "orange", 6, n=8)
        P.flat(g, f & (Z < 3), "gold", 7)
        P.flat(g, f & (Z > 7), "red", 5)
    return g


def build() -> Asset:
    g = orbiter()
    pv = (CX, (FY0 + FY1) / 2, D / 2)
    root = Part("shuttle", g, pivot=pv)
    root.add(Part("flames", flames(), pivot=(14.0, 2.0, 0.0), at=rel(pv, (CX, 18, ENG_Z))))
    flick = [(i * 0.1, (1.0, 1.0, 1.0 + (0.4 if i % 2 else 0.0))) for i in range(9)]
    move = {"flames": {"scale": [(i * 0.1, (1.2, 1.2, 1.8 + (0.5 if i % 2 else 0.0))) for i in range(21)]},
            "shuttle": {"rot": [(0.0, (0.0, 0.0, 0.0)), (1.0, (-4.0, 0.0, 8.0)), (2.0, (0.0, 0.0, 0.0))]}}
    return Asset(
        id="space-vehicles-shuttle", pack="space", category="vehicles", name="Orbital Shuttle", root=root,
        clips=[Clip("idle", {"flames": {"scale": flick}}), Clip("move", move)],
        sockets=[Socket("socket-warp", at=rel(pv, (CX, 30, ENG_Z + 2))), Socket("socket-engine", at=rel(pv, (CX, 24, ENG_Z + 2)))],
        pfx=[{"effectId": "rvx-space-warp-jump", "socket": "socket-warp", "trigger": "manual", "size": 40, "aim": [0.0, 0.0, 1.0]},
             {"effectId": "rvx-space-engine-exhaust", "socket": "socket-engine", "trigger": "clip:move", "size": 36, "aim": [0.0, 0.0, 1.0]}],
    )
