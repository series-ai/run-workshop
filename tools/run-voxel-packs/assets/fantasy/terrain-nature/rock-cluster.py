"""Mossy boulders in the Pirate Nation style.

Three big faceted boulders (irregular n-gon frustums: true slopes, never
voxel stairs) that lean into each other, two small stones and grass tufts
at the foot. Warm grey stone painted as big blocks with cracks, lit ridges
and soft moss caps on top. About 40 wide and 22 tall. Faces -Z.
"""
import numpy as np

import paint as P
from _life import asset, boulder, coords, grass, plan, ngon
from voxgrid import Grid, Part

S = (48, 30, 38)


def build():
    g = Grid(*S)
    boulder(g, 20, 20, 0, 11.0, 21, "stone", 5, n=7, seed=3, belly=1.1, top=0.5, lean=(1.5, 1.0), moss="leaf", moss_drape=0.2)
    boulder(g, 33, 16, 0, 8.0, 14, "sand", 3, n=6, seed=8, belly=1.12, top=0.55, lean=(1.0, -1.0), squash=(1.0, 0.9), moss="leaf", moss_drape=0.22)
    boulder(g, 11, 12, 0, 6.0, 9, "stone", 5, n=6, seed=12, belly=1.1, top=0.5, lean=(-1.0, -0.5), moss="leaf", moss_drape=0.25)
    boulder(g, 39, 27, 0, 4.0, 5, "sand", 3, n=5, seed=17, belly=1.05, top=0.55, moss="leaf", moss_drape=0.3)
    boulder(g, 24, 6, 0, 3.0, 3, "stone", 5, n=5, seed=21, belly=1.05, top=0.6, moss=None)
    # a soft moss skirt where the rocks meet the ground
    X, Y, Z = coords(g)
    skirt = plan(g, ngon(22, 19, 16.0, 9, 0.2, [1.0, 0.8, 1.1, 0.9, 1.05, 0.85, 1.0, 0.95, 0.9]), 0, 1, "leaf", 4)
    P.flat(g, skirt & ((P._hash(np.floor(X).astype(int) // 3, np.floor(Z).astype(int) // 3, seed=2) % np.uint64(3)) == 0), "leaf", 5)
    grass(g, [(8, 1, 22), (30, 1, 6), (41, 1, 20), (15, 1, 30)], "leaf", 5)
    return asset("terrain-nature", "rock-cluster", "Mossy Boulders", Part("rock-cluster", g, pivot=(S[0] / 2, 0.0, S[2] / 2)))
