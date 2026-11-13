"""Robot dog, in the Pirate Nation mecha style.

A small boxy patrol bot with a white and steel hull, copper armor, a framed
cyan face, mounted radar ears, plated piston legs, and a lit antenna tail.
Clips: idle, move, attack, hit, death. Faces -Z.
"""
import numpy as np

import pnglyph
from _life import P, Clip, Grid, Rig, asset, box, coords, edges, front, hazard, keys, light_top, quad, side, wave
from voxgrid import C

S = (20, 30, 26)
CX = 10
LEGS = {"leg-fl": (CX + 3, 8), "leg-fr": (CX - 3, 8), "leg-bl": (CX + 3, 18), "leg-br": (CX - 3, 18)}  # (x, z) of each hip
YB = 6  # body bottom


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    belly = box(g, CX - 4, YB, 6, CX + 4, YB + 3, 21, "steel", 5)
    P.plates(g, belly, "steel", 5, size=(5, 4), seed=2)
    P.flat(g, belly & (Y < YB + 1), "steel", 3)
    back = side(g, [(YB + 3, 5), (YB + 3, 21), (YB + 7, 20), (YB + 8, 16), (YB + 8, 8), (YB + 7, 5.5)], CX - 5, CX + 5, "bone", 6)
    P.plates(g, back, "bone", 6, size=(6, 5), seed=3)
    light_top(g, back, "bone", 7)
    # Steel skirts and copper armor mark the body edge.
    P.flat(g, back & ((X < CX - 4) | (X > CX + 4)) & (Y < YB + 4), "steel", 4)
    P.flat(g, back & ((X < CX - 4) | (X > CX + 4)) & (Y > YB + 4) & (Y < YB + 6), "rust", 5)
    hazard_strip = back & ((X < CX - 4) | (X > CX + 4)) & (Y > YB + 3) & (Y < YB + 4.5) & (Z > 16) & (Z < 19)
    hazard(g, hazard_strip, period=3, a=("orange", 6), b=("steel", 3), frame="wall")
    saddle = back & (Y > YB + 7) & (Z > 10) & (Z < 16)
    P.flat(g, saddle, "steel", 5)
    P.outline(g, saddle, "steel", 3)
    P.flat(g, saddle & (np.abs(X - CX) < 1), "cyan", 6)
    P.flat(g, saddle & (np.abs(X - CX) < 1) & (Y > YB + 7.5), "cyan", 7)
    # Narrow side lamps sit inside the copper belt.
    side_lamps = back & ((X < CX - 4) | (X > CX + 4)) & (np.abs(Z - 13) < 2.5) & (Y > YB + 4.5) & (Y < YB + 6.5)
    P.flat(g, side_lamps, "cyan", 5)
    P.flat(g, side_lamps & (np.abs(Z - 13) < 1), "cyan", 7)
    # Rear service vents and small fasteners add scale without filling the panels.
    rear = back & (Z > 19) & (Y > YB + 3.5) & (Y < YB + 7)
    P.flat(g, rear & (np.floor(Y) % 2 == 0), "steel", 3)
    for x in (CX - 3, CX + 3):
        P.flat(g, back & (np.abs(X - x) < 0.6) & (Z > 19) & (Y > YB + 6), "rust", 6)
    return g


def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    h = box(g, CX - 5, YB + 5, 0, CX + 5, YB + 14, 7, "orange", 6)
    P.plates(g, h, "bone", 6, size=(5, 5), seed=1)
    P.flat(g, edges(h), "steel", 3)
    light_top(g, h, "bone", 7)
    # Copper cheek guards and steel rear panels frame the white head shell.
    P.flat(g, h & (Z < 1) & (np.abs(X - CX) > 4) & (Y > YB + 6), "rust", 5)
    P.flat(g, h & (Z > 5) & (np.abs(X - CX) > 2) & (Y > YB + 7) & (Y < YB + 13), "steel", 5)
    P.flat(g, h & (Z > 5) & (np.abs(X - CX) > 3.5) & (Y > YB + 7) & (Y < YB + 12), "bone", 6)
    P.flat(g, h & (Z > 5) & (np.abs(X - CX) < 2.5) & (Y > YB + 7) & (Y < YB + 12), "steel", 3)
    # The face sits in a dark bezel with a small cyan status rim.
    face = h & (Z < 1) & (np.abs(X - CX) < 4.5) & (Y > YB + 6) & (Y < YB + 13)
    P.flat(g, face, "steel", 2)
    screen = face & (np.abs(X - CX) < 3.5) & (Y > YB + 7) & (Y < YB + 12)
    P.flat(g, screen, "navy", 2)
    P.outline(g, screen, "cyan", 4, normal="z")
    legend = {"e": C("cyan", 7), "E": C("cyan", 5), "m": C("cyan", 6), "w": C("bone", 7)}
    rows = [".E....E.", "ew....we", "........", ".mmmmmm.", "..mwwm.."]
    pnglyph.stamp(g, "-z", 0, CX - 4, YB + 7, rows, legend)
    # Two copper sensor studs sit below the screen.
    for x in (CX - 4, CX + 4):
        P.flat(g, h & (Z < 1) & (np.abs(X - x) < 0.6) & (Y > YB + 5) & (Y < YB + 6), "rust", 6)
    ears = np.zeros(g.shape, dtype=bool)
    sockets = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        # Each ear starts inside a broad steel socket on the head crown.
        sockets |= box(g, CX + s * 3 - 1, YB + 14, 1, CX + s * 3 + 1, YB + 16, 6, "steel", 4)
        ears |= front(g, [(CX + s * 3, YB + 14), (CX + s * 5, YB + 14), (CX + s * 7, YB + 17), (CX + s * 5, YB + 17)], 2, 5, "bone", 6)
    P.flat(g, sockets, "steel", 4)
    P.flat(g, sockets & (Y > YB + 14.5), "rust", 5)
    P.flat(g, sockets & (Y > YB + 14.5) & (np.abs(X - CX) > 3.5), "cyan", 6)
    P.plates(g, ears, "bone", 6, size=(4, 3), seed=4)
    P.flat(g, ears & (Y > YB + 16), "cyan", 6)
    P.flat(g, ears & (Y > YB + 17), "cyan", 7)
    return g


def leg(x: float, z: float) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    lg = side(g, quad((YB + 1, z), (3, z + 1), 1.5, 1.2), x - 1.2, x + 1.2, "steel", 5)
    P.flat(g, lg, "steel", 5)
    # A white thigh plate follows the leg slope. A copper stripe marks its edge.
    thigh = lg & (Y > YB - 1) & (Y < YB + 3.5)
    P.plates(g, thigh, "bone", 6, size=(3, 3), seed=int(z))
    P.flat(g, thigh & (np.abs(Y - (YB + 1.5)) < 0.6), "rust", 5)
    # The hip and ankle bands define the moving joints.
    P.flat(g, lg & (Y > YB + 2.5), "steel", 3)
    P.flat(g, lg & (Y > YB + 2.5) & (np.abs(X - x) < 0.7), "cyan", 5)
    paw = box(g, x - 1.5, 0, z - 2, x + 1.5, 3, z + 2, "steel", 4)
    P.plates(g, paw, "steel", 5, size=(3, 3), seed=int(z + x))
    light_top(g, paw, "steel", 6)
    P.flat(g, paw & (Y < 1), "steel", 2)
    P.flat(g, paw & (Z < z - 1.5) & (np.abs(X - x) < 0.7), "bone", 6)
    P.flat(g, paw & (Z < z - 1.5) & (np.abs(X - x) < 0.7) & (Y > 1), "cyan", 5)
    return g


def tail() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    t = side(g, quad((YB + 7, 20), (YB + 14, 22.5), 0.7), CX - 0.6, CX + 0.6, "steel", 6)
    P.flat(g, t, "steel", 5)
    P.flat(g, t & (Y > YB + 9) & (Y < YB + 10), "rust", 6)
    P.flat(g, t & (Y > YB + 12), "steel", 4)
    tip = box(g, CX - 1, YB + 13, 21, CX + 1, YB + 15, 23, "cyan", 6)
    P.flat(g, tip, "cyan", 6)
    P.flat(g, tip & (Y > YB + 14), "cyan", 7)
    P.flat(g, tip & (Z > 22), "steel", 3)
    return g


def build():
    rig = Rig()
    rig.group("robot-dog", (CX, 0, 13))
    rig.add("body", body(), (CX, YB + 4, 13), "robot-dog")
    rig.add("head", head(), (CX, YB + 6, 5), "body")
    for name, (x, z) in LEGS.items():
        rig.add(name, leg(x, z), (x, YB + 1, z), "body")
    rig.add("tail", tail(), (CX, YB + 7, 20), "body")
    z0 = (0.0, 0.0, 0.0)
    idle = {"tail": {"rot": wave(0.6, "z", 25)}, "head": {"rot": keys((0, z0), (0.8, (0, 0, 12)), (1.6, z0), (2.4, z0))},
            "body": {"loc": wave(1.2, "y", 0.3)}}
    t = 0.5
    fwd, back = (25.0, 0.0, 0.0), (-25.0, 0.0, 0.0)
    move = {"leg-fl": {"rot": keys((0, fwd), (t / 2, back), (t, fwd))}, "leg-br": {"rot": keys((0, fwd), (t / 2, back), (t, fwd))},
            "leg-fr": {"rot": keys((0, back), (t / 2, fwd), (t, back))}, "leg-bl": {"rot": keys((0, back), (t / 2, fwd), (t, back))},
            "body": {"loc": keys((0, z0), (t / 4, (0, 1, 0)), (t / 2, z0), (t * 0.75, (0, 1, 0)), (t, z0))},
            "tail": {"rot": wave(t, "z", 20)}}
    attack = {"body": {"loc": keys((0, z0), (0.15, (0, 0, 2)), (0.3, (0, 1, -4)), (0.6, z0)), "rot": keys((0, z0), (0.15, (8, 0, 0)), (0.3, (-10, 0, 0)), (0.6, z0))},
              "head": {"rot": keys((0, z0), (0.3, (-15, 0, 0)), (0.4, (5, 0, 0)), (0.5, (-15, 0, 0)), (0.7, z0))}}
    hit = {"body": {"rot": keys((0, z0), (0.1, (0, 0, 15)), (0.4, z0))}, "head": {"rot": keys((0, z0), (0.1, (10, 0, -15)), (0.4, z0))}}
    death = {"body": {"rot": keys((0, z0), (0.4, (0, 0, 40)), (0.8, (0, 0, 88))), "loc": keys((0, z0), (0.8, (0, -5, 0)))},
             "head": {"rot": keys((0, z0), (0.8, (20, 0, 0)))}, "tail": {"rot": keys((0, z0), (0.8, (-60, 0, 0)))}}
    return asset("creatures", "robot-dog", "Robot Dog", rig.root,
                 clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)])
