"""Raised road-spike trap with a cycling deployment plate."""
import numpy as np

import paint as P
import pnpaint as PP
from _life import Rig, ctr, fx, keys, limb, make
from pnkit import box, edges
from voxgrid import C, Clip, Grid

SIZE = (58, 24, 46)


def base() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    plate = box(g, 5, 0, 4, 53, 6, 42, "steel", 4)
    P.plates(g, plate, "steel", 4, size=(8, 7), seed=1)
    P.flat(g, edges(plate), "iron", 2)
    warning = plate & (Y > 4) & (((np.floor(X + Z) % 8) < 2))
    PP.hazard(g, warning, period=6, a=("gold", 6), b=("darkwood", 3), frame="top")
    for z0 in (8, 36):
        rail = box(g, 5, 6, z0, 53, 9, z0 + 3, "rust", 5)
        P.plates(g, rail, "rust", 5, size=(7, 4), seed=z0)
    for x0 in range(6, 54, 8):
        box(g, x0, 5, 10, x0 + 3, 8, 36, "iron", 4)
    return g


def teeth() -> Grid:
    g = Grid(*SIZE)
    for x0 in (8, 18, 28, 38, 48):
        for z0 in (14, 26):
            limb(g, (x0, 5, z0), (x0 + 2, 18, z0), 3.0, 0.0, "steel", 6, n=4)
            tooth = box(g, x0 - 1, 5, z0 - 1, x0 + 4, 7, z0 + 2, "rust", 4)
            P.flat(g, tooth & (np.floor(ctr(g)[1]) > 5), "gold", 5)
    return g


def build():
    rig = Rig("spike-trap", (29, 0, 23), base())
    rig.add("teeth", teeth(), (29, 5, 23))
    active = {"teeth": {"loc": keys((0, (0, 0, 0)), (0.4, (0, 7, 0)), (0.8, (0, 0, 0)), (1.2, (0, 7, 0)), (1.6, (0, 0, 0)))}}
    socket = rig.socket("socket-teeth", (29, 19, 23), parent="teeth")
    idle = {"teeth": {"loc": keys((0, (0, 0, 0)), (1, (0, 0.4, 0)), (2, (0, 0, 0)))}}
    return make("animated-props", "spike-trap", "Road Spike Trap", rig.root,
                clips=[Clip("idle", idle), Clip("active", active)], sockets=[socket],
                pfx=[fx("rvx-apocalypse-metal-clang", "socket-teeth", "clip:active", at=0.42, size=12)])
