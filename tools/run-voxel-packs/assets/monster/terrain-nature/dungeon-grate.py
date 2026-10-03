"""Dungeon grate floor tile, in the Pirate Nation haunted style.

Two by two PN tiles (32 x 32, 4 high), level with the dungeon floor tile
and painted with the same flagstones (joints on the low edges, so it
repeats on the 16-voxel grid). In the middle, a big square iron grate: a
riveted frame of plates and a lattice of bars 2 wide (real geometry)
over a recessed pit whose floor glows toxic green. Toxic slime oozes over
the rim onto the stones. socket-grate sits over the glow for the poison
cloud. Faces -Z.
"""
import importlib.util
import os

import numpy as np

import paint as P
import pnpaint
from _kit import pfx, single
from _life import coords
from voxgrid import C, Grid, Socket

_spec = importlib.util.spec_from_file_location("rvx_monster_dungeon_floor", os.path.join(os.path.dirname(os.path.abspath(__file__)), "dungeon-floor.py"))
_floor = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_floor)

N, H = 32, 4
A0, A1 = 7, 25  # the pit opening (3-wide holes between 2-wide bars)
F = 2  # frame width
BARS = [(10, 12), (15, 17), (20, 22)]


def build():
    g = Grid(N, H, N)
    X, Y, Z = coords(g)
    g.a[:, :, :] = C("stone", 5)
    slab = g.a > 0
    ids, stones = _floor.flagstones(N, seed=140)
    _floor.paint_flags(g, slab, ids, stones, seed=140)
    # the riveted iron frame around the opening (flush with the floor)
    frame = slab & (X >= A0 - F) & (X < A1 + F) & (Z >= A0 - F) & (Z < A1 + F) & (Y >= H - 2)
    P.plates(g, frame, "gray", 5, size=(5, 5), seed=3)
    P.flat(g, frame & ((X == A0 - F) | (X == A1 + F - 1) | (Z == A0 - F) | (Z == A1 + F - 1)), "gray", 3)
    # the pit: cut down to a glowing toxic floor (y = 0)
    opening = (X >= A0) & (X < A1) & (Z >= A0) & (Z < A1)
    g.a[opening & (Y >= 1)] = 0
    pit = opening & (Y == 0)
    d = np.maximum(np.abs(X + 0.5 - 16), np.abs(Z + 0.5 - 16))
    P.flat(g, pit, "toxic", 7)
    P.flat(g, pit & (d > 7.5), "toxic", 6)
    bubble = pit & ((P._hash(X // 2, Z // 2, seed=5) % np.uint64(7)) == 0) & (d < 7.5)
    P.flat(g, bubble, "lime", 7)
    # the pit walls: dark stone, lit green near the glow
    wall = (g.a > 0) & ~opening & (X >= A0 - 1) & (X < A1 + 1) & (Z >= A0 - 1) & (Z < A1 + 1) & (Y < H - 2)
    P.flat(g, wall, "toxic", 4)
    P.flat(g, wall & (Y == 1), "toxic", 5)
    # the grate bars (2 wide, 2 tall) across the opening
    bars = np.zeros(g.shape, dtype=bool)
    for b0, b1 in BARS:
        bars |= opening & (Y == H - 1) & (((X >= b0) & (X < b1)) | ((Z >= b0) & (Z < b1)))
    g.a[bars] = C("gray", 5)
    P.flat(g, bars & (Y == H - 1), "gray", 6)
    P.flat(g, bars & (Y == H - 1) & (((X + Z) % 5) == 0), "gray", 5)
    cross = np.zeros(g.shape, dtype=bool)
    for b0, b1 in BARS:
        for c0, c1 in BARS:
            cross |= bars & (X >= b0) & (X < b1) & (Z >= c0) & (Z < c1) & (Y == H - 1)
    P.flat(g, cross, "gray", 7)  # rivet heads where the bars cross
    # toxic slime oozing over the rim onto the stones
    top = (g.a > 0) & (Y == H - 1)
    ring = (np.maximum(np.abs(X + 0.5 - 16), np.abs(Z + 0.5 - 16)) < 12 + 2.5 * np.sin(X * 0.9 + Z * 0.4)) & ~opening
    slime = top & ring & ((P._hash(X // 3, Z // 3, seed=8) % np.uint64(3)) == 0)
    P.flat(g, slime, "toxic", 5)
    pnpaint.blotch(g, slime, "toxic", 6, cell=2, chance=0.3, seed=9)
    drip = (g.a > 0) & ~opening & (Y == H - 2) & ((X == A0 - 1) | (X == A1) | (Z == A0 - 1) | (Z == A1)) & (X >= A0 - 1) & (X <= A1) & (Z >= A0 - 1) & (Z <= A1) & ((P._hash(X + Z, seed=10) % np.uint64(3)) == 0)
    P.flat(g, drip, "toxic", 5)
    return single("dungeon-grate", "terrain-nature", "Dungeon Grate Tile", g,
                  sockets=[Socket("socket-grate", at=(0.0, 2.0, 0.0))], pfx=[pfx("rvx-monster-sewer-fume", "socket-grate", "idle", size=26)])
