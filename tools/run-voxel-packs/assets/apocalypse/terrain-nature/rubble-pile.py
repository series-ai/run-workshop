"""Rubble pile, in the Pirate Nation style.

A heap of broken concrete slabs tipped at angles (true slopes) over a
crushed brick wall stub with a jagged top, loose brick chunks, bent rebar
and a faded green route sign poking out of the pile on a leaning pole.
Concrete, brick courses, cracks and the sign lettering are paint. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, blob, ctr, front, limb, make, plan, rock, slab
from pnkit import box
from voxgrid import Grid

SZ = (42, 34, 38)


def pile() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    mound = rock(g, 21, 20, 0, 18, 15, 9, ramp="sand", shade=4, shrink=0.45, lean=(-1, 1), n=10, seed=1)
    P.mottle(g, mound, "sand", 4, cell=3, seed=2)
    # the crushed wall stub: brick with a jagged broken top (a true-slope outline)
    wall = front(g, [(8, 0), (26, 0), (26, 13), (22, 17), (19, 12), (15, 19), (11, 14), (8, 16)], 26, 30, "red", 4)
    P.stone(g, wall, "red", 4, block=(4, 2), cracks=0.1, seed=3)
    P.flat(g, wall & (Y < 3), "red", 3)
    # tipped concrete slabs (true slopes)
    for k, (ax, cu, cv, w, h, lo, hi, ang) in enumerate((
            ("z", 14, 8, 16, 3, 8, 20, 24), ("x", 9, 22, 3, 15, 14, 26, -30), ("z", 29, 10, 13, 3, 14, 26, -18), ("x", 12, 12, 3, 12, 24, 34, 40))):
        s = slab(g, ax, cu, cv, w, h, lo, hi, ang, "stone", 6)
        PP.concrete(g, s, "stone", 6, size=24, cracks=2, seed=k)
        P.outline(g, s, "stone", 4, normal=ax)
    # loose bricks and rubble chunks
    for k, (bx, bz, by) in enumerate(((6, 10, 0), (33, 30, 0), (36, 14, 0), (18, 33, 0), (28, 6, 0))):
        b = rock(g, bx, bz, by, 2.2, 1.8, 2.4, ramp="red" if k % 2 else "stone", shade=4 if k % 2 else 5, shrink=0.6, n=5, seed=10 + k)
        del b
    # bent rebar sticking out
    for a, b in (((16, 8, 18), (12, 17, 12)), ((24, 9, 22), (30, 16, 20)), ((20, 10, 16), (23, 18, 10))):
        limb(g, a, b, 0.7, 0.6, "rust", 5, n=4)
    return g


def sign() -> Grid:
    g = Grid(*SZ)
    pole = limb(g, (33, 6, 24), (33, 29, 24), 1.0, None, "steel", 5, n=4)
    plate = box(g, 25, 23, 22, 41, 33, 23, "leaf", 4)
    P.outline(g, plate, "bone", 7, normal="z")
    G.text(g, "-z", 22, 28, 25, "66", "bone", 7)
    del pole
    return g


def build():
    rig = Rig("rubble-pile", (21, 0, 20), pile())
    rig.add("sign", sign(), (33, 6, 24), rot=(8, 0, -14))
    return make("terrain-nature", "rubble-pile", "Rubble Pile", rig.root)
