"""Hover bike, in the Pirate Nation mecha style.

A chunky one-rider speeder: a hazard-orange fairing with a white racing
stripe (a side profile prism with true slopes: a tall nose, a dipped seat,
a raised tail), a slanted teal windscreen, a lit cyan dash, wide
handlebars with red grips, a padded seat at a rider's hip height, foot
pegs, two swept tail fins (true diagonals), a big steel thruster with a
copper ring and a glowing nozzle, and two glowing anti-grav pads under it.
Idle floats and bobs; move leans forward and banks (jet thrust PFX at
socket-thrust). Detail is painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import coords, facet_paint, rel
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket

W, H, L = 28, 30, 60
CX = 14
BX0, BX1 = 7, 21  # body sides
PROFILE = [(8, 3), (8, 46), (12, 54), (18, 54), (21, 42), (17, 36), (17, 28), (23, 16), (19, 6)]  # (y, z)
TH = (CX, 14, 52)  # thruster axis (x, y) and front z


def bike() -> Grid:
    g = Grid(W, H, L)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    g.prism("x", PROFILE, BX0, BX1, C("orange", 6))
    body = S.last(g)
    # White hull plating sets the main material. Keep the nose cap and the
    # upper fairing orange as the bike's racing-color focal point.
    P.flat(g, body, "bone", 6)
    side = body & ((X < BX0 + 1) | (X > BX1 - 1))
    P.plates(g, side, "bone", 6, size=(10, 7), frame="x", seed=4)
    nose_top = body & (Y > 18.5) & (Z < 15)
    P.plates(g, nose_top, "orange", 6, size=(7, 5), frame="top", seed=8)
    P.flat(g, body & (Z < 3) & (Y > 12), "orange", 5)  # nose bumper
    P.flat(g, side & ((np.abs(Z - 12.5) < 0.6) | (np.abs(Z - 40.5) < 0.6)), "steel", 3)  # panel seams
    P.flat(g, side & (np.floor(Z) % 6 == 2) & (np.abs(Y - 17) < 0.6), "steel", 7)  # rivets
    # A short hazard mark and service grille sit below the nose plates.
    hazard = side & (Z > 5) & (Z < 12) & (Y > 9) & (Y < 12)
    P.flat(g, hazard & ((np.floor(Z + Y) % 4) < 2), "orange", 6)
    P.flat(g, hazard & ((np.floor(Z + Y) % 4) >= 2), "steel", 3)
    sensor = side & (Z > 5) & (Z < 12) & (Y > 13) & (Y < 17)
    sensor_edge = sensor & ((Z < 7) | (Z > 10) | (Y < 14) | (Y > 16))
    P.flat(g, sensor_edge, "steel", 3)
    P.flat(g, sensor & ~sensor_edge, "orange", 5)
    P.flat(g, sensor & (Z > 7) & (Z < 10) & (Y > 14) & (Y < 16), "cyan", 7)
    P.flat(g, body & (np.abs(Y - 13) < 1.5) & ((X < BX0 + 1) | (X > BX1 - 1)), "bone", 6)  # racing stripe
    P.flat(g, body & (Y < 9.5), "steel", 4)  # undercarriage
    P.flat(g, body & ((X < BX0 + 1) | (X > BX1 - 1)) & (np.abs(Z - 24) < 4) & (Y > 10) & (Y < 16), "steel", 3)  # engine vent
    P.flat(g, body & ((X < BX0 + 1) | (X > BX1 - 1)) & (np.abs(Z - 24) < 4) & (Y > 10) & (Y < 16) & (np.floor(Y) % 2 == 0), "steel", 5)
    # side cowls (wider at the front: a frustum along z)
    for s in (-1, 1):
        x0 = BX0 if s < 0 else BX1
        base = [(x0, 9), (x0 + s * 3, 10), (x0 + s * 3, 16), (x0, 18)]
        g.prism("z", base, 8, 30, C("orange", 6))
        cw = S.last(g)
        P.flat(g, cw, "orange", 6)
        # Paint only the outer flank. This keeps the inset and the far side
        # orange while both visible pods read as white armored panels.
        panel = cw & ((X < 5.5) if s < 0 else (X > 22.5))
        P.plates(g, panel, "bone", 6, size=(8, 5), frame="x", seed=6 + s)
        P.flat(g, edges(cw) | (cw & (Z < 9)), "steel", 3)
        P.flat(g, panel & (Y > 15) & (Y < 17) & (Z > 13) & (Z < 25), "orange", 5)
        P.flat(g, panel & (Y > 11) & (Y < 14) & (Z > 17) & (Z < 24) & (np.floor(Z) % 3 == 0), "steel", 4)
        P.flat(g, cw & (Z < 10) & (Y > 11) & (Y < 15), "gold", 7)  # headlights
        P.flat(g, cw & (Z > 12) & (Z < 27) & (Y > 11) & (Y < 14) & (np.floor(Z) % 5 == 1), "orange", 5)  # service marks
    # windscreen and dash
    S.bar(g, "x", (22, 13), (28, 20), 1.5, BX0 + 1, BX1 - 1, "cyan", 6)
    canopy = g.solids[-1].mask(g.shape)
    P.outline(g, canopy, "steel", 3, normal="x")
    P.flat(g, canopy & (Y > 26), "cyan", 7)
    dash = body & (Y > 20.5) & (Z > 16) & (Z < 22)
    P.flat(g, dash, "steel", 3)
    P.flat(g, dash & (np.floor(X) % 3 == 0), "cyan", 7)
    # handlebars with grips
    hb = box(g, 2, 22, 21, 26, 24, 23, "steel", 3)
    for x0 in (2, 23):
        box(g, x0, 21, 20, x0 + 3, 25, 24, "red", 5)
    # the seat
    seat = box(g, BX0 + 2, 17, 26, BX1 - 2, 20, 38, "iron", 5)
    P.flat(g, seat & (np.floor(Z) % 4 == 0), "iron", 4)
    P.flat(g, edges(seat), "iron", 3)
    # foot pegs
    for x0 in (3, 21):
        box(g, x0, 10, 34, x0 + 4, 12, 38, "steel", 3)
    # tail fins (true diagonals)
    for s in (-1, 1):
        x0 = (BX0 - 1) if s < 0 else (BX1 - 1)
        g.prism("x", [(16, 40), (18, 52), (27, 57), (26, 51)], x0, x0 + 2, C("orange", 6))
        f = S.last(g)
        P.flat(g, f, "orange", 6)
        P.flat(g, f & (Y > 23), "bone", 6)
        P.flat(g, f & (Y < 19), "orange", 4)
    # the thruster
    t = S.disc(g, "z", TH[0], TH[1], 5.5, 44, L, "steel", 4, n=8)
    d = S.ngon_radius(g, "z", TH[0], TH[1], 8)
    P.flat(g, t & (Z > 48) & (Z < 51), "rust", 4)
    P.flat(g, t & (Z > L - 1) & (d < 3.8), "cyan", 7)
    P.flat(g, t & (Z > L - 1) & (d >= 3.8), "rust", 3)
    # anti-grav pads
    for zc in (14, 42):
        p = S.disc(g, "y", CX, zc, 6, 0, 4, "steel", 4, n=8)
        radius = S.ngon_radius(g, "y", CX, zc, 8)
        P.flat(g, p & (Y < 1.5), "cyan", 7)
        P.flat(g, p & (Y < 1.5) & (radius < 4.5), "cyan", 7)
        P.flat(g, p & (Y < 1.5) & (radius >= 4.5), "teal", 6)
        box(g, CX - 2, 4, zc - 2, CX + 2, 9, zc + 2, "steel", 3)
    return g


def build() -> Asset:
    pv = (W / 2, 0.0, L / 2)
    root = Part("hover-bike-base", None)
    root.add(Part("hover-bike", bike(), pivot=pv, at=(0.0, 0.0, 0.0)))
    bobk = [(i * 0.25, (0.0, 2 + 0.8 * [0, 0.7, 1, 0.7, 0, -0.7, -1, -0.7, 0][i], 0.0)) for i in range(9)]
    idle = {"hover-bike": {"loc": bobk}}
    move = {"hover-bike": {"loc": [(0.0, (0.0, 2.0, 0.0)), (1.0, (0.0, 3.0, 0.0)), (2.0, (0.0, 2.0, 0.0))],
                           "rot": [(0.0, (-6.0, 0.0, 0.0)), (0.5, (-6.0, 0.0, 15.0)), (1.0, (-6.0, 0.0, 0.0)), (1.5, (-6.0, 0.0, -15.0)), (2.0, (-6.0, 0.0, 0.0))]}}
    return Asset(
        id="space-vehicles-hover-bike", pack="space", category="vehicles", name="Hover Bike", root=root,
        clips=[Clip("idle", idle), Clip("move", move)],
        sockets=[Socket("socket-thrust", at=rel(pv, (TH[0], TH[1], L)), parent="hover-bike"), Socket("socket-pad", at=(0.0, 0.0, 0.0), parent="hover-bike")],
        pfx=[{"effectId": "rvx-space-hover-thrust", "socket": "socket-thrust", "trigger": "clip:move", "size": 24, "aim": [0.0, 0.0, 1.0]}],
    )
