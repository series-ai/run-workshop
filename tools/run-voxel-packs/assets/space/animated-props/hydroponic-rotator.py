"""Hydroponic rotator, in the Pirate Nation mecha style.

A carousel that turns crop trays under a lamp: an octagonal steel nutrient
tub on a hazard foot, with a glowing teal water line and a cyan control
screen on the front. A copper mast carries the rotor: six chunky white
hull trays on radial arms at two heights (true slopes on every tray, F2),
each heaped with lime and leaf foliage over a cyan grow strip. The
oversized function prop is the lamp hood over them: a wide octagonal
copper shade with a bright cyan lens that reads from across a room (F4,
F6). On `idle` the rotor turns slowly; on `active` it races and the
misters fog the trays. Faces -Z.
"""
import math

import numpy as np

from _life import C, P, Clip, Grid, Rig, asset, band, coords, edges, hazard, last, light_top, ngon_y, plate_facets, plated, side, spin
from pnshapes import ngon_radius

S = (44, 50, 44)
CX, CZ = 22, 22
YT = 9     # the tub rim
YL = 14    # the lower tray deck
YU = 26    # the upper tray deck
YM = 36    # the mast top, under the lamp
R_ARM = 14  # the tray radius


def tub() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    foot = ngon_y(g, CX, CZ, 18, 0, 3, "iron", 5, n=8)
    hazard(g, foot, period=4, a=("orange", 5), b=("iron", 4))
    light_top(g, foot, "steel", 4)
    n0 = len(g.solids)
    body = ngon_y(g, CX, CZ, 16, 3, YT, "steel", 5, n=8, r_top=15)
    plate_facets(g, g.solids[n0:], "steel", 5, size=(9, 6), seed=1)
    P.flat(g, edges(body), "steel", 3)
    band(g, body, 1, 3, 5, "iron", 4)
    P.flat(g, body & (np.abs(Y - (YT - 3)) < 1.1), "orange", 5)
    # the nutrient surface: a teal pool inside a lit steel rim
    top = body & (Y > YT - 1.5)
    P.flat(g, top, "steel", 6)
    rad = ngon_radius(g, "y", CX, CZ, 8)
    P.flat(g, top & (rad < 12.5), "teal", 4)
    P.flat(g, top & (rad < 11.0) & (np.floor(X + Z) % 6 < 3), "teal", 5)
    P.flat(g, top & (rad < 6.0), "cyan", 6)
    # the control box on the front, with a screen and two dials
    con = side(g, [(4, CZ - 19), (4, CZ - 15), (16, CZ - 16), (16, CZ - 19)], CX - 7, CX + 7, "steel", 4)
    P.flat(g, con, "steel", 4)
    P.flat(g, edges(con), "steel", 2)
    scr = con & (Z < CZ - 17.4)
    P.flat(g, scr, "teal", 4)
    P.flat(g, scr & (np.abs(X - CX) < 4.5) & (Y > 7) & (Y < 14), "cyan", 6)
    P.flat(g, scr & (np.abs(X - CX) < 1.4) & (Y > 7) & (Y < 14), "cyan", 7)
    for bx, ink in ((CX - 5, "gold"), (CX + 5, "orange")):
        P.flat(g, scr & (np.abs(X - bx) < 1.5) & (np.abs(Y - 6) < 1.5), ink, 6)
    # the copper mast
    mast = ngon_y(g, CX, CZ, 3.2, YT - 1, YM, "rust", 5, n=8)
    P.flat(g, mast, "rust", 5)
    P.flat(g, mast & (np.floor(Y) % 5 == 0), "rust", 3)
    P.flat(g, mast & (np.floor(Y) % 10 == 2), "gold", 6)
    P.flat(g, edges(mast), "rust", 3)
    return g


def lamp() -> Grid:
    """The oversized grow lamp: a wide copper shade, open at the bottom,
    with a bright cyan lens under it."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    stem = ngon_y(g, CX, CZ, 2.6, YM, YM + 3, "iron", 4, n=8)
    P.flat(g, stem, "iron", 4)
    lens = ngon_y(g, CX, CZ, 12, YM + 2, YM + 3, "cyan", 6, n=8)
    rad = ngon_radius(g, "y", CX, CZ, 8)
    P.flat(g, lens, "cyan", 6)
    P.flat(g, lens & (rad < 8.0), "cyan", 7)
    P.flat(g, lens & (rad > 11.0), "cyan", 5)
    n0 = len(g.solids)
    hood = ngon_y(g, CX, CZ, 13, YM + 3, YM + 9, "rust", 5, n=8, r_top=5)
    plate_facets(g, g.solids[n0:], "rust", 5, size=(7, 5), seed=2)
    P.flat(g, edges(hood), "rust", 3)
    light_top(g, hood, "rust", 6)
    P.flat(g, hood & (Y < YM + 4.4), "gold", 6)
    P.flat(g, hood & (Y > YM + 4.4) & (Y < YM + 5.4) & (np.floor(X + Z) % 5 == 0), "cyan", 6)
    cap = ngon_y(g, CX, CZ, 3.2, YM + 9, YM + 11, "iron", 4, n=8, r_top=1.6)
    P.flat(g, cap, "iron", 4)
    P.flat(g, cap & (Y > YM + 9.6), "gold", 6)
    return g


def _turn(a: float, pts):
    """Rotate (x, z) points about the mast by angle `a`."""
    return [(CX + u * math.cos(a) - v * math.sin(a), CZ + u * math.sin(a) + v * math.cos(a)) for u, v in pts]


def _arm(g: Grid, a: float, y0: int) -> None:
    """One radial arm from the hub to a tray."""
    g.prism("y", _turn(a, [(0, -1.8), (R_ARM, -1.8), (R_ARM, 1.8), (0, 1.8)]), y0 + 1, y0 + 3, C("iron", 5))
    m = last(g)
    P.flat(g, m, "iron", 5)
    P.flat(g, edges(m), "iron", 3)


def _tray(g: Grid, a: float, y0: int) -> None:
    """One white hull tray with sloped sides, a cyan rim light and a crop
    heap of lime and leaf over it (true slopes both ways, F2)."""
    X, Y, Z = coords(g)

    def ring(h: float, w: float):
        return _turn(a, [(R_ARM - h, -w), (R_ARM + h, -w), (R_ARM + h, w), (R_ARM - h, w)])

    g.prism("y", ring(4.0, 5.5), y0, y0 + 4, C("bone", 6), top=ring(5.2, 7.2))
    body = last(g)
    plated(g, body, "bone", 6, size=(6, 4), seed=3)
    P.flat(g, edges(body), "bone", 4)
    band(g, body, 1, y0, y0 + 1, "cyan", 6)
    for u, v in ((R_ARM - 2, -3), (R_ARM + 2, 2)):
        g.prism("y", _turn(a, [(u - 1, v - 1), (u + 1, v - 1), (u + 1, v + 1), (u - 1, v + 1)]), y0 + 4, y0 + 9, C("leaf", 3))
        for du, dv, h in ((-3, 0, 5), (3, 1, 7), (0, -3, 8)):
            g.prism("y", _turn(a, [(u, v), (u + du - 1, v + dv - 1), (u + du + 1, v + dv + 1)]), y0 + h, y0 + h + 2, C("leaf", 5))
            P.flat(g, last(g), "leaf", 5 if du < 0 else 6)



def rotor() -> Grid:
    """Six crop trays on radial arms at two heights, on steel hubs."""
    g = Grid(*S)
    for y0, phase in ((YL, 0.0), (YU, 60.0)):
        hub = ngon_y(g, CX, CZ, 5, y0, y0 + 4, "steel", 5, n=8)
        P.flat(g, hub, "steel", 5)
        P.flat(g, edges(hub), "steel", 3)
        light_top(g, hub, "steel", 6)
        for k in range(3):
            a = math.radians(phase + 120 * k)
            _arm(g, a, y0)
            _tray(g, a, y0)
    return g


def build():
    rig = Rig()
    rig.add("rotator", tub(), (CX, 0, CZ))
    rig.add("rotor", rotor(), (CX, YT, CZ), "rotator")
    rig.add("lamp", lamp(), (CX, YM, CZ), "rotator")
    idle = {"rotor": {"rot": spin(9.0, "y", 360)}}
    active = {"rotor": {"rot": spin(3.0, "y", 360)}}
    mist = rig.sock("socket-mist", (CX, YM + 1, CZ), parent="rotator")
    return asset("animated-props", "hydroponic-rotator", "Hydroponic Rotator", rig.root,
                 clips=[Clip("idle", idle), Clip("active", active)],
                 sockets=[mist],
                 pfx=[{"effectId": "rvx-space-launch-steam", "socket": "socket-mist", "trigger": "clip:active", "size": 16, "aim": [0.0, -1.0, 0.0]}])
