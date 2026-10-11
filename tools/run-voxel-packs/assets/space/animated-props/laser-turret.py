"""Laser turret, in the Pirate Nation mecha style.

A chunky defence turret: a tapered riveted base with hazard stripes, an
orange column and a steel swivel ring; on it an armoured white head, a
wedge with a sloped front (true slopes), a big teal visor, orange side
stripes and steel cheek plates. Two thick octagonal barrels with copper
coils and glowing teal muzzles ride on its sides. The head sweeps on
`idle`; on `attack` it snaps to the front and the barrels recoil in turn
while the bolt leaves the muzzle socket. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, box, coords, edges, hazard, keys, light_top, ngon_y, octo, plan, plate_facets, side, wave
from pnshapes import disc

S = (34, 34, 42)
CX, CZ = 17, 22
YS = 16  # the swivel plane
YB = 22  # the barrel axis
BX = 10  # the barrel offset from the centre


def base() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    b = plan(g, octo(CX, CZ, 12, 12, 4), 0, 6, "steel", 5, top=octo(CX, CZ, 9.5, 9.5, 3))
    plate_facets(g, [g.solids[-1]], "steel", 5, size=(9, 6), seed=1)
    band(g, b, 1, 0, 1, "steel", 3)
    band(g, b, 1, 1, 3, "orange", 6)
    col = ngon_y(g, CX, CZ, 6, 6, YS - 2, "orange", 6)
    band(g, col, 1, 6, 7, "orange", 4)
    band(g, col, 1, 10, 11, "orange", 4)
    ring = ngon_y(g, CX, CZ, 7.5, YS - 2, YS, "steel", 4)
    light_top(g, ring, "steel", 6)
    return g


def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    h = side(g, [(YS, CZ - 7), (YS, CZ + 9), (YS + 11, CZ + 8), (YS + 11, CZ - 1), (YS + 6, CZ - 9)], CX - 7, CX + 7, "bone", 6)
    P.plates(g, h, "bone", 6, size=(8, 6), rivets=False, seed=3)
    band(g, h, 1, YS + 1, YS + 3, "steel", 4)
    # orange side stripes
    P.flat(g, h & ((X < CX - 6) | (X > CX + 6)) & (Y > YS + 6) & (Y < YS + 8.5), "orange", 6)
    # a big teal visor on the sloped front
    visor = h & (Z < CZ - 1) & (np.abs(X - CX) < 5.5) & (Y > YS + 6.5) & (Y < YS + 10.5)
    P.flat(g, visor, "cyan", 6)
    P.flat(g, visor & (Y > YS + 9), "cyan", 7)
    P.flat(g, visor & (np.abs(X - CX) > 4.5), "steel", 4)
    # the chin grille
    P.flat(g, h & (Z < CZ - 6.5) & (Y < YS + 5) & (np.abs(X - CX) < 4) & (np.floor(Y) % 2 == 0), "steel", 3)
    light_top(g, h & (Y > YS + 10), "bone", 7)
    # steel cheek mounts that carry the barrels
    for s in (-1, 1):
        cheek = box(g, CX + s * 7 - (1 if s > 0 else 2), YB - 3, CZ - 3, CX + s * 7 + (2 if s > 0 else 1), YB + 3, CZ + 5, "steel", 5)
        P.flat(g, edges(cheek), "steel", 3)
    # an antenna stub on the back
    box(g, CX + 3, YS + 11, CZ + 5, CX + 5, YS + 16, CZ + 7, "steel", 4)
    box(g, CX + 3, YS + 16, CZ + 5, CX + 5, YS + 17, CZ + 7, "red", 6)
    return g


def barrel(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x = CX + s * BX
    b = disc(g, "z", x, YB, 2.5, CZ - 19, CZ + 4, "steel", 5)
    P.flat(g, b, "steel", 5)
    P.flat(g, b & (Y > YB + 1.5), "steel", 6)
    for z0 in (CZ - 8, CZ - 5, CZ - 2):
        P.flat(g, disc(g, "z", x, YB, 3.2, z0, z0 + 2, "rust", 6), "rust", 6)
    brake = disc(g, "z", x, YB, 3.4, CZ - 20, CZ - 16, "steel", 4)
    P.flat(g, brake & (Z < CZ - 19), "cyan", 7)
    P.flat(g, brake & (Z < CZ - 19) & (np.hypot(X - x, Y - YB) > 2.2), "cyan", 5)
    return g


def build():
    rig = Rig()
    rig.add("turret", base(), (CX, 0, CZ))
    rig.add("head", head(), (CX, YS, CZ), "turret")
    rig.add("barrel-l", barrel(1), (CX + BX, YB, CZ + 2), "head")
    rig.add("barrel-r", barrel(-1), (CX - BX, YB, CZ + 2), "head")
    muzzle = rig.sock("socket-muzzle", (CX - BX, YB, CZ - 20), "barrel-r")
    z = (0.0, 0.0, 0.0)
    idle = {"head": {"rot": wave(4.0, "y", 35)}}
    attack = {"head": {"rot": keys((0, (0, 12, 0)), (0.15, z), (1.0, z))},
              "barrel-r": {"loc": keys((0, z), (0.2, z), (0.28, (0, 0, 3.5)), (0.5, z), (1.0, z))},
              "barrel-l": {"loc": keys((0, z), (0.45, z), (0.53, (0, 0, 3.5)), (0.75, z), (1.0, z))}}
    return asset("animated-props", "laser-turret", "Laser Turret", rig.root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False)], sockets=[muzzle],
                 pfx=[{"effectId": "rvx-space-laser-bolt", "socket": "socket-muzzle", "trigger": "clip:attack", "size": 16, "aim": [0.0, 0.0, -1.0], "at": 0.4}])
