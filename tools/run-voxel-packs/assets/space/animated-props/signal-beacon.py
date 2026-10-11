"""Signal beacon, in the Pirate Nation mecha style.

One iconic shape (rule K3): a chunky chamfered battery box with a sloped
teal solar panel and hazard stripes, a tapered riveted steel pylon (true
slopes) with a copper pipe climbing it, and an oversized lamp head: an
octagonal orange lantern with two lens hoods and a steep red cap. The
lamp head turns on `idle`, so the two lenses sweep round. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, box, coords, edges, facet_paint, hazard, keys, last, ngon_y, octo, plan, plate_facets, side, spin
from pnshapes import cone, pipe

S = (40, 44, 40)
CX, CZ = 20, 20
YB, YP, YL = 7, 23, 25  # base top, pylon top, lamp bottom


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    base = plan(g, octo(CX, CZ, 9, 9, 3), 0, YB, "steel", 5)
    P.plates(g, base, "steel", 5, size=(6, 4), seed=1)
    band(g, base, 1, 0, 1, "steel", 3)
    band(g, base, 1, 1, 4, "orange", 5)
    hazard(g, base & (Z < CZ - 8) & (Y >= 1) & (Y < 4), period=4, frame="z")
    band(g, base, 1, YB - 1, YB, "steel", 6)
    # battery gauge on the front: a lit bar of cells
    for k in range(4):
        P.flat(g, base & (Z < CZ - 8) & (np.abs(X - (CX - 4.5 + 3 * k)) < 1.0) & (Y > 4.5) & (Y < 6.5), "cyan" if k < 3 else "orange", 6)
    # a sloped solar panel on the back half of the box (true slope)
    panel = side(g, [(YB, CZ + 1), (YB, CZ + 9), (YB + 6, CZ + 9), (YB + 1.5, CZ + 1)], CX - 8, CX + 8, "teal", 4)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.plates(gg, mm, "teal", 4, size=(4, 3), rivets=False, frame=fr))
    P.flat(g, edges(panel) | (panel & ((X < CX - 7) | (X > CX + 7))), "steel", 4)
    # the tapered pylon: a square frustum, riveted plates on every slope
    pylon = plan(g, octo(CX, CZ, 5, 5, 1.5), YB, YP, "steel", 5, top=octo(CX, CZ, 3, 3, 1))
    plate_facets(g, [g.solids[-1]], "steel", 5, size=(8, 7), seed=2)
    for y in (12, 19):
        band(g, pylon, 1, y, y + 2, "orange", 5)
    # a copper feed pipe up the right side
    pipe(g, [(CX + 7, 5, CZ + 3), (CX + 7, 16, CZ + 3), (CX + 4, 16, CZ + 3)], s=3, ramp="rust", base=6, flange=False)
    return g


def lamp() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    collar = ngon_y(g, CX, CZ, 5, YP, YL, "steel", 3)
    band(g, collar, 1, YL - 1, YL, "steel", 5)
    glass = ngon_y(g, CX, CZ, 5.5, YL, YL + 7, "gold", 6)
    P.flat(g, glass, "gold", 6)
    band(g, glass, 1, YL + 4, YL + 7, "gold", 7)
    P.flat(g, glass & ((Y < YL + 1) | (Y > YL + 6)), "rust", 4)
    # vertical mullions on the facet corners
    ang = np.arctan2(Z - CZ, X - CX)
    P.flat(g, glass & (np.abs(((ang / (2 * np.pi) * 8 + 0.5) % 1) - 0.5) < 0.09), "rust", 4)
    # two lens hoods, left and right, with bright gold lenses
    for s in (-1, 1):
        x0, x1 = (CX + 4, CX + 10) if s > 0 else (CX - 10, CX - 4)
        hood = box(g, x0, YL + 1, CZ - 3, x1, YL + 6, CZ + 3, "steel", 5)
        P.flat(g, edges(hood), "steel", 3)
        lens = hood & ((X > CX + 9) if s > 0 else (X < CX - 9))
        P.flat(g, lens, "gold", 7)
        P.outline(g, lens, "orange", 5, normal="x")
    # a steep red cap with a lit tip
    cap = cone(g, "y", CX, CZ, 6.5, YL + 7, YL + 13, "red", 5, n=8, r_top=1.5)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.plates(gg, mm, "red", 5, size=(9, 4), rivets=False, frame=fr))
    band(g, cap, 1, YL + 7, YL + 8, "red", 3)
    tip = box(g, CX - 1, YL + 13, CZ - 1, CX + 1, YL + 15, CZ + 1, "gold", 7)
    del tip
    return g


def build():
    rig = Rig()
    rig.add("beacon", body(), (CX, 0, CZ))
    rig.add("lamp", lamp(), (CX, YP, CZ), "beacon")
    idle = {"lamp": {"rot": spin(2.4, "y", 360)}}
    return asset("animated-props", "signal-beacon", "Signal Beacon", rig.root, clips=[Clip("idle", idle)])
