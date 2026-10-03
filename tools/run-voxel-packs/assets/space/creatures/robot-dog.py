"""Robot dog, in the Pirate Nation mecha style.

A small boxy patrol bot, chunky and cute: a big square head (caricature)
with a navy screen face showing cyan pixel eyes and a smile, two radar-dish
ears that lean out (true slopes), an orange armoured back with a hazard
saddle plate over a steel belly, four piston legs with steel paws, and a
whip-antenna tail with a red tip. Clips: idle (wag, tilt), move (trot),
attack (lunge and bark), hit, death. Faces -Z.
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
    P.flat(g, belly, "steel", 5)
    back = side(g, [(YB + 3, 5), (YB + 3, 21), (YB + 7, 20), (YB + 8, 16), (YB + 8, 8), (YB + 7, 5.5)], CX - 5, CX + 5, "orange", 6)
    P.flat(g, back, "orange", 6)
    light_top(g, back, "orange", 7)
    P.flat(g, back & ((X < CX - 4) | (X > CX + 4)) & (Y < YB + 4), "orange", 5)
    saddle = back & (Y > YB + 7) & (Z > 10) & (Z < 16)
    P.flat(g, saddle, "steel", 5)
    P.flat(g, saddle & (np.abs(X - CX) < 1), "cyan", 6)
    P.flat(g, back & ((X < CX - 4) | (X > CX + 4)) & (np.abs(Z - 13) < 2.5) & (Y > YB + 4.5) & (Y < YB + 6.5), "cyan", 6)  # side lights
    return g


def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    h = box(g, CX - 5, YB + 5, 0, CX + 5, YB + 14, 7, "orange", 6)
    P.flat(g, h, "orange", 6)
    P.flat(g, edges(h), "orange", 4)
    light_top(g, h, "orange", 7)
    screen = h & (Z < 1) & (np.abs(X - CX) < 4) & (Y > YB + 6) & (Y < YB + 13)
    P.flat(g, screen, "navy", 5)
    legend = {"e": C("cyan", 7), "m": C("cyan", 6)}
    rows = [".e....e.", "e.e..e.e", "........", "..mmmm..", "...mm..."]
    pnglyph.stamp(g, "-z", 0, CX - 4, YB + 7, rows, legend)
    ears = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        ears |= front(g, [(CX + s * 3, YB + 14), (CX + s * 5, YB + 14), (CX + s * 7.5, YB + 17), (CX + s * 5.5, YB + 17.5)], 2, 5, "steel", 6)
    P.flat(g, ears, "steel", 6)
    P.flat(g, ears & (Y > YB + 16), "cyan", 6)
    return g


def leg(x: float, z: float) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    lg = side(g, quad((YB + 1, z), (3, z + 1), 1.5, 1.2), x - 1.2, x + 1.2, "steel", 5)
    P.flat(g, lg, "steel", 5)
    P.flat(g, lg & (Y > YB - 2), "orange", 5)
    paw = box(g, x - 1.5, 0, z - 2, x + 1.5, 3, z + 2, "steel", 4)
    light_top(g, paw, "steel", 6)
    return g


def tail() -> Grid:
    g = Grid(*S)
    t = side(g, quad((YB + 7, 20), (YB + 14, 22.5), 0.7), CX - 0.6, CX + 0.6, "steel", 6)
    tip = box(g, CX - 1, YB + 13, 21, CX + 1, YB + 15, 23, "red", 6)
    del t, tip
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
