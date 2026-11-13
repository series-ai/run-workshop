"""Cracked road tile (3x3 PN tiles, 48x48), in the Pirate Nation style.

A two-lane asphalt road running along x between two raised sandstone
sidewalks with kerbs. Lane paint repeats every 16 voxels, so tiles join
along x. A heaved slab tilts up out of the road (true slopes), a manhole
cover sits proud, and a storm drain, a pothole with murky water, skid
marks, an oil stain, cracks and weeds in the joints are paint or small
prisms. Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import ctr, make, slab, tuft
from pnkit import box
from voxgrid import Grid, Part

N = 48
SW0, SW1 = 8, 40  # the road runs between the sidewalks at z = SW0..SW1
ROAD_Y, WALK_Y = 3, 5


def build():
    g = Grid(N, 12, N)
    X, Y, Z = ctr(g)
    road = box(g, 0, 0, SW0, N, ROAD_Y, SW1, "stone", 4)
    PP.concrete(g, road, "stone", 4, size=48, cracks=12, frame="top", seed=1)
    P.flat(g, road & (Y < ROAD_Y - 1), "stone", 3)
    walks = box(g, 0, 0, 0, N, WALK_Y, SW0, "sand", 5) | box(g, 0, 0, SW1, N, WALK_Y, N, "sand", 5)
    PP.concrete(g, walks & (Y > WALK_Y - 1), "sand", 5, size=8, cracks=4, frame="top", seed=2)
    kerb = walks & (((Z >= SW0 - 1) & (Z < SW0)) | ((Z >= SW1) & (Z < SW1 + 1)))
    P.flat(g, kerb, "sand", 6)
    P.flat(g, walks & (Y < WALK_Y - 1), "sand", 4)
    top = road & (Y > ROAD_Y - 1)
    # lane paint: faded white edge lines and a dashed yellow centre line (repeats every 16)
    P.flat(g, top & ((np.abs(Z - (SW0 + 2)) < 0.6) | (np.abs(Z - (SW1 - 2)) < 0.6)), "bone", 6)
    dash = top & (np.abs(Z - (SW0 + SW1) / 2) < 1.1) & ((np.floor(X) % 16) >= 3) & ((np.floor(X) % 16) < 11)
    P.flat(g, dash, "gold", 5)
    PP.blotch(g, dash, "gold", 3, cell=2, chance=0.15, seed=3)  # worn paint
    # skid marks, an oil stain, a pothole with murky water
    P.flat(g, top & (np.abs(Z - 16) < 1.1) & (X > 4) & (X < 26) & ((np.floor(X) % 5) != 0), "stone", 2)
    P.flat(g, top & (np.hypot(X - 36, (Z - 29) * 1.4) < 3.5), "stone", 2)
    pot = top & (np.hypot(X - 13, Z - 31) < 3.6)
    P.flat(g, pot, "stone", 2)
    P.flat(g, pot & (np.hypot(X - 13, Z - 31) < 2.5), "teal", 3)
    # a storm drain grate at the kerb
    P.flat(g, kerb & (X > 30) & (X < 38) & (Z < SW0) & (np.floor(X) % 2 == 0), "stone", 2)
    # a heaved slab of asphalt tilting up out of the road (true slopes)
    heave = slab(g, "z", 24, ROAD_Y + 1.2, 12, 2.4, 26, 34, 12, "stone", 4)
    PP.concrete(g, heave, "stone", 4, size=12, cracks=2, seed=4)
    P.flat(g, heave & (Y < ROAD_Y + 0.5), "stone", 3)
    # a proud manhole cover
    mh = S.disc(g, "y", 40, 18, 3.5, ROAD_Y, ROAD_Y + 1, "steel", 5, n=8)
    P.flat(g, mh & ((np.floor(X) + np.floor(Z)) % 2 == 0), "steel", 4)
    # weeds in the joints
    for k, (tx, tz) in enumerate(((6, 5), (21, 44), (43, 4), (33, 43), (4, 42))):
        tuft(g, tx + 0.5, tz + 0.5, WALK_Y if (tz < SW0 or tz >= SW1) else ROAD_Y, 5, blades=4, spread=2.5, ramp="khaki", shade=5, seed=k)
    tuft(g, 19.5, 26.5, ROAD_Y, 4, blades=3, spread=2.0, ramp="leaf", shade=5, seed=9)
    return make("terrain-nature", "cracked-road", "Cracked Road Tile", Part("cracked-road", g))
