"""Hand-built purifier that pumps rain water through a visible filter stack."""
import numpy as np

import paint as P
from _life import Rig, ctr, fx, keys, limb, make
from _rep_anim import pallet
from pnkit import box, edges
from pnshapes import disc
from voxgrid import C, Clip, Grid

SIZE = (64, 58, 52)
G0 = 3  # the ground in the build frame: the parts above keep their old heights


def frame() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    # Two wooden shipping pallets, 2 voxels high, carry the frame (no plinth).
    pallet(g, 4, 5, 31, 47, y0=G0)
    pallet(g, 32, 5, 60, 47, y0=G0)
    for x0 in (8, 54):
        for z0 in (10, 35):
            leg = box(g, x0, G0 + 2, z0, x0 + 4, 45, z0 + 4, "steel", 4)
            P.plates(g, leg, "steel", 4, size=(6, 9), seed=x0 + z0)
    for sx, sz in ((14, 16), (31, 16), (14, 34), (31, 34)):  # short stands under the tank
        box(g, sx, G0 + 2, sz, sx + 3, 10, sz + 3, "steel", 3)
    for sz in (16, 33):  # two saddles under the filter cans
        saddle = box(g, 37, G0 + 2, sz, 55, 14.5, sz + 3, "rust", 4)
        P.flat(g, edges(saddle), "rust", 2)
    tank = box(g, 12, 10, 14, 36, 44, 39, "steel", 5)
    P.plates(g, tank, "steel", 5, size=(9, 8), seed=1)
    P.flat(g, tank & (Z < 15) & (Y > 27), "teal", 5)
    P.flat(g, tank & (Z < 15) & (Y > 11) & (Y < 14), "gold", 5)
    P.flat(g, edges(tank), "iron", 3)
    for x0, ramp in ((41, "rust"), (50, "teal")):
        can = disc(g, "z", x0, 22, 8, 12, 40, ramp, 5, n=8)
        P.flat(g, can & (np.abs(Y - 22) < 1), ramp, 3)
        for yy in (18, 30):
            disc(g, "y", x0, 26, 8.5, yy, yy + 2, "steel", 5, n=8)
    # Two thick pipe runs connect the rain inlet to the clean-water tap.
    limb(g, (9, 43, 17), (14, 50, 17), 2.2, 2.2, "steel", 5, n=6)
    limb(g, (14, 50, 17), (44, 50, 17), 2.2, 1.8, "steel", 5, n=6)
    limb(g, (44, 50, 17), (50, 41, 17), 1.8, 1.8, "teal", 5, n=6)
    limb(g, (50, 41, 17), (50, 22, 17), 1.8, 1.8, "teal", 5, n=6)
    limb(g, (14, 50, 17), (14, 40, 17), 2.2, 2.2, "steel", 5, n=6)
    limb(g, (50, 22, 17), (50, 29, 8), 1.8, 1.8, "steel", 5, n=6)
    tap = box(g, 45, 27, 3, 55, 31, 13, "steel", 5)
    P.flat(g, edges(tap), "iron", 2)
    limb(g, (52, 27, 8), (52, 21, 8), 1.5, 1.5, "teal", 6, n=6)
    box(g, 49, 20, 5, 55, 22, 11, "gold", 6)
    # Printed clear-water gauge and a hazard label.
    dial = disc(g, "z", 24, 34, 5.5, 12, 14, "bone", 6, n=8)
    P.flat(g, dial & (np.abs(X - 24) < 1) & (Y > 34), "teal", 6)
    P.flat(g, dial & (np.abs(X - 24) < 1) & (Y < 34), "rust", 4)
    P.flat(g, tank & (np.abs(X - 16) < 2) & (Z < 15) & (Y > 15) & (Y < 21), "gold", 7)
    edges_mask = edges(tank)
    P.flat(g, edges_mask, "steel", 3)
    return g


def handle() -> Grid:
    g = Grid(*SIZE)
    limb(g, (42, 42, 10), (42, 52, 10), 1.3, 1.3, "rust", 5, n=4)
    limb(g, (34, 52, 10), (50, 52, 10), 2.0, 2.0, "wood", 5, n=4)
    box(g, 32, 50, 8, 36, 54, 12, "gold", 5)
    return g


def build():
    rig = Rig("water-purifier", (32, G0, 26), frame())
    rig.add("pump-handle", handle(), (42, 42, 10))
    active = {"pump-handle": {"rot": keys((0, (0, 0, -18)), (0.5, (0, 0, 16)), (1.0, (0, 0, -18)), (1.5, (0, 0, 16)), (2.0, (0, 0, -18)))}}
    idle = {"pump-handle": {"rot": keys((0, (0, 0, 0)), (1, (0, 0, 2)), (2, (0, 0, 0)))}}
    socket = rig.socket("socket-intake", (47, 22, 17))
    return make("animated-props", "water-purifier", "Rain Water Purifier", rig.root,
                clips=[Clip("idle", idle), Clip("active", active)], sockets=[socket],
                pfx=[fx("rvx-apocalypse-toxic-bubbles", "socket-intake", "clip:active", size=11)])
