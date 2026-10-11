"""UFO saucer, in the Pirate Nation mecha style.

A classic flying saucer as big faceted frustums (true slopes): a chrome
bowl underneath with a ring of drive lights and a copper tractor-beam
emitter, a sloped chrome upper deck with glowing portholes and radial
panel seams, and an oversized teal glass dome on copper ribs with two
little green alien pilots painted behind the glass. The rim (`rim`) is a
separate spinning ring of chasing gold and orange lights. Four splayed
landing legs (true diagonals) with pads. Idle spins the rim and bobs;
move tilts and spins faster; active lifts off and lowers a teal tractor
beam (`beam`, teleport PFX at socket-beam). Detail is painted. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _bld import coords, facet_paint, rel
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket, turn

W = 98
c = W / 2
B0, B1, R0, R1 = 8, 19, 18, 45  # lower bowl: y and flat radius
U0, U1, RU = 23, 34, 23  # upper deck: y, top radius
DOME_R = 20


def chrome(ramp: str = "steel", base: int = 6):
    """Facet painter: clean polished panels, a lit upper band, rivet dots."""
    def paint(gg, mm, fr):
        U, V = P.uv(gg, fr)
        P.flat(gg, mm, ramp, base)
        P.flat(gg, mm & (V % 6 == 1), ramp, min(7, base + 1))
        P.flat(gg, mm & (U % 6 == 3) & (V % 6 == 3), ramp, base - 2)
    return paint


def hull() -> Grid:
    g = Grid(W, 60, W)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    bowl = S.cone(g, "y", c, c, R1, B0, B1, "steel", 6, n=16, r_top=R0, tip="lo")
    core = S.disc(g, "y", c, c, R1 - 3, B1, U0, "steel", 3, n=16)
    deck = S.cone(g, "y", c, c, R1 - 2, U0, U1, "steel", 6, n=16, r_top=RU)
    facet_paint(g, [g.solids[n0]], chrome("steel", 5))
    facet_paint(g, [g.solids[n0 + 2]], chrome("bone", 6))
    P.flat(g, bowl & S.seams(g, [g.solids[n0]], 0.7), "steel", 3)
    P.flat(g, deck & S.seams(g, [g.solids[n0 + 2]], 0.7), "bone", 4)
    # drive lights under the bowl
    d = S.ngon_radius(g, "y", c, c, 16)
    ang = np.degrees(np.arctan2(Z - c, X - c)) % 360
    under = bowl & (Y < B0 + 4)
    P.flat(g, under & (np.abs(d - 30) < 2.5) & ((ang % 30) < 12), "cyan", 6)
    P.flat(g, bowl & (Y > B1 - 2), "steel", 4)
    # portholes on the deck
    P.flat(g, deck & (Y < U0 + 2), "orange", 5)
    port = deck & (Y > U0 + 3) & (Y < U0 + 6) & ((ang % 22.5) > 7) & ((ang % 22.5) < 15)
    P.flat(g, port, "cyan", 6)
    P.flat(g, port & (Y > U0 + 5), "cyan", 7)
    P.flat(g, deck & (Y > U0 + 7) & (Y < U0 + 9), "orange", 5)
    P.flat(g, deck & (Y > U1 - 1.5), "rust", 4)
    P.flat(g, bowl & (Y > B0 + 5) & (Y < B0 + 7), "orange", 5)
    # the oversized glass dome with two little pilots
    def glass(gg, mm, fr):
        P.flat(gg, mm, "cyan", 6)
        P.flat(gg, mm & (coords(gg)[1] > U1 + 12), "cyan", 7)
    dome = S.dome(g, c, c, U1, DOME_R, h=18, n=12, rings=3, ramp="cyan", base=6, cap_r=5, painter=glass, ribs=None)
    P.flat(g, dome & ((np.abs(Y - U1 - 9.5) < 0.6) | (Y < U1 + 1.2)), "rust", 4)  # clean copper frame rings
    for px in (c - 7, c + 7):
        head = dome & (np.hypot(X - px, Y - (U1 + 7)) < 4) & (Z < c - 8)
        P.flat(g, head, "lime", 5)
        P.flat(g, head & (np.abs(Y - (U1 + 7.5)) < 1.2) & (np.abs(np.abs(X - px) - 2) < 1), "iron", 3)  # big black eyes
        P.flat(g, dome & (np.abs(X - px) < 1) & (Y > U1 + 10.5) & (Y < U1 + 14) & (Z < c - 6), "lime", 4)  # antennae
    cap = S.disc(g, "y", c, c, 4, U1 + 18, U1 + 20, "rust", 4, n=8)
    P.flat(g, cap & (Y > U1 + 19), "gold", 6)
    # tractor-beam emitter
    em = S.disc(g, "y", c, c, 7, B0 - 3, B0, "rust", 4, n=8)
    P.flat(g, em & (Y < B0 - 2), "cyan", 7)
    legs(g)
    return g


def legs(g: Grid) -> None:
    X, Y, Z = coords(g)
    for axis, s in (("z", -1), ("z", 1), ("x", -1), ("x", 1)):
        if axis == "z":  # a leg in the x-y plane
            m = S.bar(g, "z", (c + s * 16, B0 + 3), (c + s * 34, 2), 3, c - 1.5, c + 1.5, "steel", 3)
            pad = box(g, c + s * 34 - 4, 0, c - 4, c + s * 34 + 4, 2, c + 4, "steel", 4)
        else:
            m = S.bar(g, "x", (B0 + 3, c + s * 16), (2, c + s * 34), 3, c - 1.5, c + 1.5, "steel", 3)
            pad = box(g, c - 4, 0, c + s * 34 - 4, c + 4, 2, c + s * 34 + 4, "steel", 4)
        P.flat(g, m & (np.floor(Y) % 4 == 0), "orange", 5)
        P.flat(g, edges(pad), "steel", 2)


def rim() -> Grid:
    """The spinning rim: a 16-sided ring of chasing lights."""
    g = Grid(W, 4, W)
    X, Y, Z = coords(g)
    r = S.disc(g, "y", c, c, R1 + 2, 0, 4, "steel", 5, n=16)
    ang = np.degrees(np.arctan2(Z - c, X - c)) % 360
    d = S.ngon_radius(g, "y", c, c, 16)
    edge = r & (d > R1)
    P.flat(g, edge & ((ang % 22.5) < 11), "gold", 7)
    P.flat(g, edge & ((ang % 45) < 11), "orange", 6)
    P.flat(g, r & ((Y < 0.9) | (Y > 3.1)) & (d > R1 - 1), "steel", 3)
    return g


def beam() -> Grid:
    """A short teal cone of light; the `active` clip stretches it to the ground."""
    g = Grid(12, 4, 12)
    b = S.cone(g, "y", 6, 6, 5.5, 0, 4, "cyan", 7, n=8, r_top=3.5)
    X, Y, Z = coords(g)
    P.flat(g, b & (Y < 1), "cyan", 6)
    return g


def build() -> Asset:
    g = hull()
    pv = (c, 20.0, c)
    root = Part("ufo-saucer", g, pivot=pv)
    root.add(Part("rim", rim(), pivot=(c, 2.0, c), at=rel(pv, (c, B1 + 2, c))))
    root.add(Part("beam", beam(), pivot=(6.0, 4.0, 6.0), at=rel(pv, (c, B0 - 3, c))))
    bobk = [(i * 0.25, (0.0, 0.8 * [0, 0.7, 1, 0.7, 0, -0.7, -1, -0.7, 0][i], 0.0)) for i in range(9)]
    idle = {"rim": {"rot": turn(2.0, "y", 180.0)}, "ufo-saucer": {"loc": bobk}}
    move = {"rim": {"rot": turn(2.0, "y", 360.0)}, "ufo-saucer": {"rot": [(0.0, (-8.0, 0.0, 0.0)), (1.0, (-8.0, 0.0, 6.0)), (2.0, (-8.0, 0.0, 0.0))]}}
    lift = 20.0
    reach = (B0 - 3 + lift) / 4.0  # stretch the beam from the emitter to the ground
    active = {"rim": {"rot": turn(2.0, "y", 360.0)},
              "ufo-saucer": {"loc": [(0.0, (0.0, 0.0, 0.0)), (0.5, (0.0, lift, 0.0)), (1.5, (0.0, lift, 0.0)), (2.0, (0.0, 0.0, 0.0))]},
              "beam": {"scale": [(0.0, (1.0, 1.0, 1.0)), (0.5, (2.2, reach, 2.2)), (1.5, (2.4, reach, 2.4)), (2.0, (1.0, 1.0, 1.0))]}}
    return Asset(
        id="space-vehicles-ufo-saucer", pack="space", category="vehicles", name="UFO Saucer", root=root,
        clips=[Clip("idle", idle), Clip("move", move), Clip("active", active)],
        sockets=[Socket("socket-beam", at=rel(pv, (c, 0.0, c)))],
        pfx=[{"effectId": "rvx-space-tractor-beam", "socket": "socket-beam", "trigger": "clip:active", "size": 36, "aim": [0.0, -1.0, 0.0]}],
    )
