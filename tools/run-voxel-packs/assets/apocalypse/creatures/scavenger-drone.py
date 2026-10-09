"""A salvaged scout drone hovers on two guarded lift rotors."""
import numpy as np
import math

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, keys, limb, make
from pnkit import box, edges
from voxgrid import C, Clip, Grid, turn

SIZE = (24, 26, 24)
ORIGIN = (12.0, 0.0, 12.0)


def body() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    core = S.disc(g, "z", 12, 13, 5.0, 5, 19, "steel", 5, n=8)
    P.plates(g, core, "steel", 5, size=(5, 4), seed=1)
    P.flat(g, core & (Y < 10), "steel", 5)
    P.flat(g, edges(core), "steel", 4)
    lens = S.disc(g, "z", 12, 14, 3.0, 2, 5, "teal", 6, n=8)
    P.flat(g, lens & (X < 12), "sky", 7)
    for x0 in (3, 17):
        limb(g, (x0, 13, 10), (x0 - 1 if x0 < 12 else x0 + 1, 15, 10), 1.6, 1.2, "rust", 5, n=4)
    for cx in (4,20):
        limb(g,(12,14,10),(cx,20,10),1.3,1.0,"steel",5,n=4)
        for k in range(8):
            a=k*math.tau/8; b=(k+1)*math.tau/8
            limb(g,(cx+3.2*math.cos(a),20,10+3.2*math.sin(a)),(cx+3.2*math.cos(b),20,10+3.2*math.sin(b)),0.6,0.6,"gold",5,n=4)
    for sign in (-1,1):
        limb(g,(12+sign*2,9,14),(12+sign*4,5,14),1,0.8,"steel",5,n=4)
        limb(g,(12+sign*4,5,14),(12+sign*2,4,12),0.8,0.3,"rust",5,n=4)
    # A signal mast and a painted serial mark keep the small body readable.
    S.disc(g, "y", 12, 12, 1.2, 19, 24, "gold", 6, n=6)
    P.flat(g, core & (np.abs(X - 12) < 1) & (Y > 9) & (Y < 12), "red", 5)
    return g


def rotor(side: int) -> Grid:
    g = Grid(*SIZE)
    cx = 4 if side < 0 else 20
    cz = 10
    for a in (0, 90):
        rad = np.deg2rad(a)
        dx, dz = np.cos(rad) * 3.0, np.sin(rad) * 3.0
        limb(g, (cx - dx, 21, cz - dz), (cx + dx, 21, cz + dz), 0.8, 0.8, "teal", 6, n=4)
    return g


def cannon() -> Grid:
    g = Grid(*SIZE)
    tube = S.bar(g, "y", (12, 6), (12, 2), 1.5, 14, 18, "steel", 5)
    P.flat(g, tube & (np.abs(S.coords(g)[0] - 12) < 1), "gold", 6)
    return g


def _build():
    rig = Rig("scavenger-drone", ORIGIN, body())
    rig.add("rotor-l", rotor(-1), (4, 21, 10))
    rig.add("rotor-r", rotor(1), (20, 21, 10))
    rig.add("cannon", cannon(), (12, 14, 6))
    idle = {"rotor-l": {"rot": turn(0.7, "y", 360 / 0.7)}, "rotor-r": {"rot": turn(0.7, "y", -360 / 0.7)}}
    move = {"rotor-l": {"rot": turn(0.45, "y", 800)}, "rotor-r": {"rot": turn(0.45, "y", -800)},
            "scavenger-drone": {"loc": keys((0, (0, 0, 0)), (0.22, (0, 1.3, 0)), (0.44, (0, 0, 0)))}}
    attack = {"cannon": {"loc": keys((0, (0, 0, 0)), (0.1, (0, 0, 2)), (0.3, (0, 0, 0)), (0.6, (0, 0, 0)))}}
    hit = {"scavenger-drone": {"rot": keys((0, (0, 0, 0)), (0.1, (0, 0, 16)), (0.45, (0, 0, 0)))}}
    death = {"scavenger-drone": {"rot": keys((0, (0, 0, 0)), (0.3, (0, 0, 25)), (0.85, (0, 0, 92)))}}
    return make("creatures", "scavenger-drone", "Scavenger Drone", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-muzzle", (12, 15, 2), parent="cannon")],
                pfx=[fx("rvx-apocalypse-pistol-shot", "socket-muzzle", "clip:attack", at=0.1, size=7, aim=(0, 0, -1))])


def build():
    from _death_ground import ground_death
    return ground_death(_build())
