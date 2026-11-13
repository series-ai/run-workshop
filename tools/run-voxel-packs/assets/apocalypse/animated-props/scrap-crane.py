"""Salvage crane with a moving boom and winch hook.

Crawler tracks caked with mud carry a deck of welded salvage plates (rust,
teal and gold patches, weld beads, a hazard edge). A rust mast holds the
truss boom. The operator sits in the open on a sprung seat, about 10 above
the deck, behind a console with three levers; a concrete counterweight
block sits at the back. Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
from _life import Rig, ctr, fx, keys, limb, make, slab
from pnkit import box, edges
from pnshapes import disc
from voxgrid import C, Clip, Grid

SIZE = (88, 94, 52)
PIVOT = (38.0, 0.0, 26.0)


def chassis() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    for x0, x1 in ((4, 18), (58, 74)):
        track = box(g, x0, 0, 7, x1, 9, 45, "gray", 4)
        P.flat(g, track & (np.floor(Z) % 4 == 0), "gray", 3)  # the track pads
        P.flat(g, edges(track), "gray", 2)
        P.flat(g, track & (Y > 6), "steel", 4)
        P.grime(g, track, height=3, seed=x0)
        PP.blotch(g, track & (Y < 3), "sand", 3, cell=3, chance=0.15, seed=x0 + 1)  # caked mud
        for z0 in range(11, 43, 7):
            disc(g, "x", 4, z0, 3.0, x0 + 0.5, x1 - 0.5, "iron", 4, n=8)
    # The deck: welded plates of mixed salvage, rust and hazard edges.
    deck = box(g, 10, 8, 9, 68, 15, 43, "steel", 4)
    P.plates(g, deck, "steel", 4, size=(12, 8), seed=1)
    top = deck & (Y > 14)
    for (px0, pz0, px1, pz1), ramp in (((46, 11, 60, 22), "rust"), ((22, 33, 34, 42), "teal"), ((52, 30, 66, 41), "gold")):
        patch = top & (X > px0) & (X < px1) & (Z > pz0) & (Z < pz1)
        P.flat(g, patch, ramp, 4)
        P.outline(g, patch, ramp, 2, normal="y")
        P.flat(g, patch & ((np.floor(X) == px0 + 1) | (np.floor(X) == px1 - 1)) & (np.floor(Z) % 3 == 0), "steel", 6)  # weld beads
    PP.blotch(g, deck & (Y < 14), "rust", 4, cell=3, chance=0.06, seed=2)
    PP.hazard(g, deck & (Z < 10) & (Y < 14), period=6, a=("gold", 5), b=("iron", 3))
    P.flat(g, edges(deck), "iron", 3)
    for cx, cz in ((63, 14), (15, 38), (63, 38)):
        bol = box(g, cx, 15, cz, cx + 4, 20, cz + 4, "gold", 5)
        P.flat(g, bol & (Y > 19), "gold", 6)
        P.flat(g, bol & (Y < 16), "rust", 4)
    mast = box(g, 32, 15, 23, 44, 49, 31, "rust", 5)
    P.plates(g, mast, "rust", 5, size=(8, 8), seed=2)
    for side in (22, 40):
        limb(g, (side, 16, 25.5 if side == 22 else 27), (38, 49, 25.5 if side == 22 else 27), 2.6, 2.2, "steel", 4, n=4)
    # The winch drum beside the mast.
    disc(g, "x", 24, 34, 7, 28, 34, "rust", 5, n=10)
    disc(g, "x", 24, 34, 4, 27, 35, "steel", 5, n=8)
    # A scrap counterweight block at the back left.
    cw = box(g, 11, 15, 30, 24, 25, 42, "stone", 4)
    PP.concrete(g, cw, "stone", 4, size=6, cracks=3, seed=3)
    P.flat(g, edges(cw), "stone", 2)
    PP.hazard(g, cw & (Y > 21) & (Y < 24), period=4, a=("gold", 5), b=("iron", 3))
    # The open operator station: a sprung seat, a lever console and a foot plate.
    post = box(g, 18, 15, 14, 22, 22, 19, "iron", 4)
    del post
    pan = box(g, 14, 22, 12, 26, 25, 21, "darkwood", 4)
    P.flat(g, pan & (Y > 24), "red", 3)  # the cracked seat cover
    P.flat(g, pan & (Y > 24) & ((np.floor(X) == 20) | (np.floor(Z) == 16)), "red", 2)
    back = slab(g, "x", 30.5, 21.5, 11, 2.5, 15, 25, 10, "darkwood", 4)
    P.flat(g, back & (Z < 21.5) & (Y > 26) & (Y < 35), "red", 3)
    console = box(g, 14, 15, 8, 26, 21, 12, "steel", 5)
    P.plates(g, console, "steel", 5, size=(6, 3), rivets=False, seed=4)
    P.flat(g, edges(console), "iron", 3)
    P.flat(g, console & (Z < 9) & (Y > 16) & (Y < 18) & (np.floor(X) % 3 == 0), "gold", 6)  # the gauge lamps
    for k, (lx, ramp) in enumerate(((16.5, "red"), (20, "gold"), (23.5, "teal"))):
        tip = (lx + (k - 1) * 0.8, 31 - k % 2, 8.5)
        limb(g, (lx, 21, 10), tip, 0.7, 0.6, "steel", 5, n=6)
        disc(g, "y", tip[0], tip[2], 1.3, tip[1] - 0.5, tip[1] + 1.8, ramp, 5, n=8)
    return g


def boom() -> Grid:
    g = Grid(*SIZE)
    # A triangular truss keeps the long arm open and light.
    limb(g, (38, 47, 26), (77, 82, 26), 3.0, 2.2, "gold", 5, n=4)
    limb(g, (38, 50, 26), (75, 50, 26), 2.0, 1.7, "steel", 4, n=4)
    limb(g, (75, 50, 26), (77, 82, 26), 1.8, 1.4, "steel", 4, n=4)
    for k in range(1, 5):
        f = k / 5
        x, y = 38 + 39 * f, 50 + 32 * f
        limb(g, (x - 4, y - 1.5, 26), (x + 4, y + 1.5, 26), 1.2, 1.2, "rust", 5, n=4)
    pulley = disc(g, "z", 77, 79, 6, 23, 29, "steel", 4, n=8)
    P.flat(g, pulley & (np.hypot(ctr(g)[0] - 77, ctr(g)[1] - 79) < 3), "gold", 5)
    return g


def hook() -> Grid:
    g = Grid(*SIZE)
    limb(g, (77, 75, 26), (77, 61, 26), 1.1, 1.1, "steel", 5, n=4)
    limb(g, (77, 61, 26), (81, 56, 26), 2.0, 1.5, "gold", 5, n=4)
    limb(g, (81, 56, 26), (84, 60, 26), 1.5, 0.35, "gold", 5, n=4)
    return g


def build():
    rig = Rig("scrap-crane", PIVOT, chassis())
    rig.add("boom", boom(), (38, 49, 26))
    rig.add("hook", hook(), (77, 75, 26), parent="boom")
    active = {
        "boom": {"rot": keys((0, (0, 0, 0)), (0.6, (0, 0, -7)), (1.2, (0, 0, 0)), (1.8, (0, 0, 7)), (2.4, (0, 0, 0)))},
        "hook": {"loc": keys((0, (0, 0, 0)), (0.6, (0, 8, 0)), (1.2, (0, 0, 0)), (1.8, (0, -5, 0)), (2.4, (0, 0, 0)))},
    }
    socket = rig.socket("socket-hook", (84, 57, 26), parent="hook")
    return make("animated-props", "scrap-crane", "Scrap Crane", rig.root,
                clips=[Clip("idle", {"boom": {"rot": keys((0, (0, 0, 0)), (1.2, (0, 0, 2)), (2.4, (0, 0, 0)))}}), Clip("active", active)],
                sockets=[socket], pfx=[fx("rvx-apocalypse-crate-dust", "socket-hook", "clip:active", at=1.2, size=12)])
