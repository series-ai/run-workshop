"""Cryo pod, in the Pirate Nation mecha style.

A hypersleep pod long enough for a person: a riveted steel cradle that
tapers up on every side (true slopes), a flared white hull tub with an
orange stripe and status lights, a sleeper in a blue suit on a teal
mattress, a sloped control desk at the foot with a big teal screen, and a
copper coolant pipe. The faceted glass canopy (frosted teal with white
ribs) hinges at the head end: it swings up on `open` and shuts on `close`.
Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, box, coords, edges, hazard, keys, light_top, octo, plan, plate_facets, side, front
from pnshapes import arch, pipe

W, H, L = 28, 26, 50
CX = 14
Z0, Z1 = 8, 48  # the tub
YT = 13  # the tub top (the bed)
HINGE = (CX, YT, Z1 - 1)


def pod() -> Grid:
    g = Grid(W, H, L)
    X, Y, Z = coords(g)
    cz = (Z0 + Z1) / 2
    cradle = plan(g, octo(CX, cz, 12, 20, 3), 0, 7, "steel", 5, top=octo(CX, cz, 10, 18, 2))
    plate_facets(g, [g.solids[-1]], "steel", 5, size=(10, 7), seed=1)
    band(g, cradle, 1, 0, 1, "steel", 3)
    hazard(g, cradle & (Z < Z0 - 1) & (Y < 4), period=4, frame="z")
    # the flared hull tub
    tub = front(g, [(4, 7), (W - 4, 7), (W - 2, YT), (2, YT)], Z0, Z1, "bone", 6)
    P.plates(g, tub, "bone", 6, size=(12, 7), rivets=False, seed=2)
    band(g, tub, 1, 8, 11, "orange", 6)
    for k, col in enumerate(("toxic", "cyan", "red")):
        P.flat(g, tub & (X < 2.6 + (Y - 7) / 3) & (np.abs(Z - (Z1 - 8 - 3 * k)) < 1) & (np.abs(Y - 12) < 1), col, 6)
    # the bed: a teal mattress with a sleeper in a blue suit
    bed = tub & (Y > YT - 1) & (np.abs(X - CX) < 9.5) & (Z > Z0 + 1.5) & (Z < Z1 - 1.5)
    P.flat(g, bed, "teal", 5)
    P.outline(g, bed, "teal", 3, normal="y")
    suit = box(g, CX - 4, YT, Z0 + 6, CX + 4, YT + 3, Z1 - 11, "blue", 4)
    P.flat(g, suit & (Y > YT + 2), "blue", 5)
    P.flat(g, suit & (np.abs(X - CX) < 1) & (Y > YT + 2), "gold", 6)  # suit zip
    for fx in (CX - 4, CX + 1):  # boots
        box(g, fx, YT, Z0 + 3, fx + 3, YT + 4, Z0 + 6, "steel", 4)
    head = box(g, CX - 3, YT, Z1 - 10, CX + 3, YT + 4, Z1 - 5, "skin", 5)
    P.flat(g, head & (Y > YT + 3) & (Z > Z1 - 8), "gold", 4)  # hair
    P.flat(g, head & (Y > YT + 3) & (Z < Z1 - 8) & (np.abs(X - CX) > 1) & (np.abs(X - CX) < 2.5) & (np.abs(Z - (Z1 - 9)) < 0.6), "skin", 2)  # shut eyes
    # the control desk at the foot: a sloped teal screen
    desk = side(g, [(0, 1), (0, Z0 + 1), (YT + 3, Z0 + 1), (YT - 1, 1)], CX - 8, CX + 8, "steel", 5)
    P.plates(g, desk, "steel", 5, size=(8, 6), seed=3)
    slope = desk & (Z < 1 + (Y / (YT + 3)) * 4 + 1.6) & (Y > 3)
    screen = slope & (np.abs(X - CX) < 6) & (Y > 5) & (Y < YT)
    P.flat(g, screen, "cyan", 6)
    P.flat(g, screen & (Y > YT - 3), "cyan", 7)
    P.outline(g, screen, "steel", 3, normal="z")
    P.flat(g, slope & (np.abs(X - CX) < 6) & (Y > 3) & (Y < 5) & (np.floor(X) % 3 == 0), "gold", 6)
    light_top(g, desk & (Z > Z0 - 1), "steel", 6)
    # copper coolant pipe down the right side (the viewer's right is low x)
    pipe(g, [(1, 4, Z0 + 2), (1, 4, Z1 - 3), (1, 10, Z1 - 3)], s=2, ramp="rust", base=6, flange=False)
    return g


def canopy() -> Grid:
    g = Grid(W, H, L)
    X, Y, Z = coords(g)
    m = front(g, arch(CX, YT, 9.5, YT + 10, bulge=0.6), Z0 + 1, Z1 - 1, "cyan", 6)
    P.flat(g, m, "cyan", 6)
    frost = m & ((np.floor(X + Z * 0.5 + Y) % 7) < 1)
    P.flat(g, frost, "cyan", 7)
    P.flat(g, m & (Y > YT + 8.5), "cyan", 7)
    for zr in (Z0 + 1, (Z0 + Z1) // 2 - 1, Z1 - 3):
        band(g, m, 2, zr, zr + 2, "bone", 6)
    P.flat(g, m & (Y < YT + 1), "bone", 5)  # the seal rim
    return g


def build():
    rig = Rig()
    rig.add("cryo-pod", pod(), (CX, 0, (Z0 + Z1) / 2))
    rig.add("canopy", canopy(), HINGE, "cryo-pod")
    z = (0.0, 0.0, 0.0)
    open_ = {"canopy": {"rot": keys((0, z), (0.2, (3, 0, 0)), (0.9, (62, 0, 0)), (1.1, (58, 0, 0)))}}
    close = {"canopy": {"rot": keys((0, (58, 0, 0)), (0.7, (4, 0, 0)), (0.85, z), (0.95, (1.5, 0, 0)), (1.1, z))}}
    mist = rig.sock("socket-mist", (CX, YT + 1, Z0 + 3), "cryo-pod")
    return asset("animated-props", "cryo-pod", "Cryo Pod", rig.root,
                 clips=[Clip("open", open_, loop=False), Clip("close", close, loop=False)], sockets=[mist])
