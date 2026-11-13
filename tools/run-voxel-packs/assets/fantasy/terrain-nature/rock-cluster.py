"""Broken rock ledges carry moss patches and ground grass."""
import numpy as np

import paint as P
from _life import asset, boulder, coords, grass, plan, ngon
from voxgrid import Grid, Part
from _scenery import broken_rock

S = (48, 30, 38)


def build():
    g = Grid(*S)
    for x,z,r,h,seed in ((20,20,11,21,3),(33,16,8,14,8),(11,12,6,9,12),(39,27,4,5,17),(24,6,3,3,21)):
        broken_rock(g,x,z,0,r,h,seed,patch_moss=True)
    # a soft moss skirt where the rocks meet the ground
    X, Y, Z = coords(g)
    skirt = plan(g, ngon(22, 19, 16.0, 9, 0.2, [1.0, 0.8, 1.1, 0.9, 1.05, 0.85, 1.0, 0.95, 0.9]), 0, 1, "leaf", 4)
    P.flat(g, skirt & ((P._hash(np.floor(X).astype(int) // 3, np.floor(Z).astype(int) // 3, seed=2) % np.uint64(3)) == 0), "leaf", 5)
    grass(g, [(8, 1, 22), (30, 1, 6), (41, 1, 20), (15, 1, 30)], "leaf", 5)
    return asset("terrain-nature", "rock-cluster", "Mossy Boulders", Part("rock-cluster", g, pivot=(S[0] / 2, 0.0, S[2] / 2)))
