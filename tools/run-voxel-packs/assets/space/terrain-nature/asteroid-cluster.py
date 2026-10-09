"""Asteroid cluster, in the Pirate Nation terrain style.

A big faceted asteroid (irregular stacked frustums, true slopes) half
sunk in a low regolith mound, with painted craters, a rusty band of ore
and glowing teal crystal veins; two smaller rocks float beside it, each
held by a glowing tether crystal that points at the ground. The floaters
bob and tumble on `idle`. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, coords, facet_paint, keys, light_top, mask_of, ngon_y, rock, spots, wave
from pnshapes import cone
from _repair_terrain import ground, stone

S = (48, 40, 44)
CX, CZ = 22, 22


def paint_rock(g: Grid, solids, ramp: str = "rust", base: int = 4, seed: int = 0) -> np.ndarray:
    m = mask_of(g, solids)
    P.flat(g, m, ramp, base)
    light_top(g, m, ramp, base + 1)
    spots(g, m, ramp, base - 1, cell=8, r=2.2, chance=3, seed=seed + 1)  # craters
    spots(g, m, ramp, base + 2, cell=8, r=0.9, chance=3, seed=seed + 1)
    return m


def cluster() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    ground(g,CX,CZ,20,"sand",5)
    stone(g,CX-2,CZ,3,13,24,"rust",4,4)
    stone(g,CX+8,CZ+2,3,7,12,"steel",5,7)
    # teal crystals growing out of the rock (true slopes)
    for bx, by, bz, r, h in ((CX + 3, 15, CZ - 6, 3.2, 12), (CX + 8, 11, CZ - 4, 2.2, 8), (CX - 7, 17, CZ - 4, 2.4, 9)):
        c = cone(g, "y", bx, bz, r, by, by + h, "cyan", 6, n=6)
        P.flat(g, c, "cyan", 6)
        light_top(g, c, "cyan", 7)
    for bx, bz, h in ((CX + 13, CZ - 8, 5), (CX - 15, CZ + 7, 4)):
        pebble = rock(g, bx, bz, 1, 3.5, h, "rust", 3, n=6, seed=bx)
        paint_rock(g, pebble, "rust", 3, seed=bz)
    return g


def floater(cx, cz, y0, r, seed) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    solids = rock(g, cx, cz, y0, r, r * 1.5, "rust", 4, n=6, seed=seed)
    paint_rock(g, solids, "rust", 4, seed=seed)
    tether = cone(g, "y", cx, cz, 1.8, y0 - 5, y0 + 1, "cyan", 6, n=6, tip="lo")
    P.flat(g, tether, "cyan", 7)
    P.flat(g, tether & (Y < y0 - 3), "cyan", 6)
    return g


def build():
    rig = Rig()
    rig.add("asteroid-cluster", cluster(), (CX, 0, CZ))
    rig.add("floater-a", floater(CX + 15, CZ + 6, 20, 5, 11), (CX + 15, 23, CZ + 6), "asteroid-cluster")
    rig.add("floater-b", floater(CX - 15, CZ - 8, 26, 4, 12), (CX - 15, 28, CZ - 8), "asteroid-cluster")
    idle = {"floater-a": {"loc": wave(3.0, "y", 1.5), "rot": wave(6.0, "y", 25)},
            "floater-b": {"loc": wave(3.0, "y", 1.5, phase=2.0), "rot": keys((0, (0, 0, 0)), (1.5, (10, 20, -8)), (3.0, (0, 0, 0)))}}
    return asset("terrain-nature", "asteroid-cluster", "Asteroid Cluster", rig.root, clips=[Clip("idle", idle)])


_ = mask_of
