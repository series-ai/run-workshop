"""A patched watch turret with a scanning mount and recoiling barrel."""
import numpy as np

import paint as P
from _life import Rig, ctr, fx, keys, make, limb
from pnkit import box, edges
from pnshapes import disc
from voxgrid import C, Clip, Grid

SIZE = (54, 66, 54)
CX, CZ = 27.0, 27.0
G0 = 7  # the ground in the build frame: the parts above keep their old heights


def bunker() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    # The base sits on the ground; four outrigger legs end in steel foot pads (no plinth).
    base = disc(g, "y", CX, CZ, 21, G0, 17, "steel", 5, n=8)
    P.plates(g, base, "steel", 5, size=(8, 7), seed=2)
    P.flat(g, edges(base), "darkwood", 3)
    P.grime(g, base, height=3, seed=5)
    pivot = disc(g, "y", CX, CZ, 14, 16, 24, "rust", 5, n=8)
    P.plates(g, pivot, "rust", 5, size=(6, 6), seed=3)
    for sx in (-1, 1):
        for sz in (-1, 1):
            fx_, fz_ = CX + sx * 19.5, CZ + sz * 19.5
            leg = limb(g, (CX + sx * 13.5, 13, CZ + sz * 13.5), (fx_, G0 + 2.2, fz_), 1.8, 1.4, "gold", 5, n=4)
            P.flat(g, leg & (np.floor(Y) % 3 == 0), "iron", 3)  # hazard bands on the legs
            pad = disc(g, "y", fx_, fz_, 3.0, G0, G0 + 1.5, "steel", 4, n=8)
            P.flat(g, edges(pad), "iron", 3)
            box(g, fx_ - 1, G0 + 1.5, fz_ - 1, fx_ + 1, G0 + 2.8, fz_ + 1, "steel", 5)  # the swivel joint
    return g


def turret() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    shell = box(g, 14, 23, 16, 40, 43, 38, "teal", 5)
    P.plates(g, shell, "teal", 5, size=(8, 7), seed=4)
    P.flat(g, shell & (Y > 39), "steel", 6)
    P.flat(g, edges(shell), "iron", 3)
    for x0 in (17, 34):
        slit = box(g, x0, 31, 13, x0 + 3, 35, 16, "darkwood", 3)
        P.flat(g, slit, "gold", 6)
    box(g, 23, 42, 21, 31, 47, 33, "rust", 5)
    limb(g, (27, 43, 20), (27, 45, 9), 2.2, 2.2, "steel", 5, n=6)
    for side_x in (17, 34):
        box(g, side_x, 25, 16, side_x + 3, 42, 18, "gold", 5)
    return g


def barrel() -> Grid:
    g = Grid(*SIZE)
    _X, _Y, Z = ctr(g)
    tube = limb(g, (CX, 34, 20), (CX, 35, 2), 4.2, 3.1, "steel", 5, n=6)
    P.plates(g, tube, "steel", 5, size=(6, 5), seed=6)
    P.flat(g, tube & (Z < 5), "iron", 2)
    rim = disc(g, "z", CX, 35, 4.7, 1, 3, "gold", 5, n=8)
    X, Y, Z = ctr(g)
    P.flat(g, rim & (np.hypot(X-CX,Y-35) < 2.8) & (Z < 2), "iron", 1)
    return g


def build():
    rig = Rig("scrap-turret", (CX, G0, CZ), bunker())
    rig.add("turret", turret(), (CX, 24, CZ))
    rig.add("barrel", barrel(), (CX, 34, 20), parent="turret")
    idle = {"turret": {"rot": keys((0, (0, -26, 0)), (1, (0, 26, 0)), (2, (0, -26, 0)))}}
    active = {
        "turret": {"rot": keys((0, (0, -30, 0)), (0.5, (0, 32, 0)), (1, (0, -30, 0)))},
        "barrel": {"loc": keys((0, (0, 0, 0)), (0.1, (0, 0, 5)), (0.22, (0, 0, 0)), (0.5, (0, 0, 0)), (0.6, (0, 0, 5)), (0.72, (0, 0, 0)), (1, (0, 0, 0)))},
    }
    socket = rig.socket("socket-muzzle", (CX, 35, 0), parent="barrel")
    return make("animated-props", "scrap-turret", "Scrap Turret", rig.root,
                clips=[Clip("idle", idle), Clip("active", active)], sockets=[socket],
                pfx=[fx("rvx-apocalypse-shotgun-blast", "socket-muzzle", "clip:active", at=0.12, size=14, aim=(0, 0, -1))])
