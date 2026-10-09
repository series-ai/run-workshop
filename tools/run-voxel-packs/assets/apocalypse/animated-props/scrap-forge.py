"""A salvage forge with a hinged firebox and a working bellows.

A riveted steel forge hut: two plated front pillars and a rust lintel with
rivet rows and a flame badge frame the hearth. A glowing coal bed lies in
the hearth, soot climbs the pillars and the lintel above the mouth, and
the chimney is blackened at the top. A hinged fire door swings across the
mouth. On the right, a teal air box carries a leather bellows that pumps
on `active`; a copper pipe feeds the air into the pillar. An anvil stands
on a stump on the left. The forge stands on two salvaged tread-plate steel
sheets, 1 voxel thick (no plinth). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
from _life import Rig, bump, ctr, fx, limb, make
from _rep_anim import tread_sheets
from pnkit import box, edges
from pnshapes import disc
from voxgrid import Clip, Grid

SIZE = (62, 60, 52)
G0 = 5  # the ground in the build frame: the sheets lie on it
HEARTH = (30.0, 22.0, 16.0)  # the centre of the hearth mouth


def soot(g: Grid, mask: np.ndarray) -> None:
    """Darken a mask in two soft steps toward the hearth mouth (no speckle)."""
    X, Y, Z = ctr(g)
    hx, hy, _hz = HEARTH
    d = np.hypot((X - hx) * 0.8, np.maximum(Y - hy, 0) * 0.6)
    P.darken(g, mask & (d < 15), 1)
    P.darken(g, mask & (d < 11), 1)


def forge() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    tread_sheets(g, 3, 5, 59, 47, y0=G0)
    y0 = G0 + 1
    # The hut body: riveted steel walls under a rust plate roof.
    body = box(g, 13, y0, 17, 47, 43, 40, "steel", 4)
    P.plates(g, body, "steel", 4, size=(9, 8), seed=2)
    roof = body & (Y > 39)
    P.plates(g, roof, "rust", 5, size=(9, 8), rivets=False, seed=4)
    P.flat(g, edges(body), "iron", 2)
    PP.blotch(g, body & (Y < 30), "rust", 4, cell=3, chance=0.03, seed=5)
    P.grime(g, body, height=3, seed=6)
    # The front pillars and the lintel round the hearth mouth.
    pillars = box(g, 13, y0, 7, 20, 43, 18, "steel", 5)
    pillars |= box(g, 40, y0, 7, 47, 43, 18, "steel", 5)
    P.plates(g, pillars, "steel", 5, size=(7, 9), seed=7)
    P.flat(g, edges(pillars), "iron", 3)
    lintel = box(g, 20, 33, 7, 40, 43, 18, "rust", 5)
    P.plates(g, lintel, "rust", 5, size=(20, 10), rivets=False, seed=8)
    P.flat(g, edges(lintel), "rust", 3)
    rivets = lintel & ((np.floor(Y) == 34) | (np.floor(Y) == 41)) & (np.floor(X) % 3 == 0)
    P.flat(g, rivets, "steel", 6)
    G.icon(g, "-z", 7, 26, 33, "flame", "ember", 3, inks={"+": ("gold", 6)})
    soot(g, (pillars | lintel) & ((Z < 8) | (np.abs(X - 20) < 1) | (np.abs(X - 39.5) < 1)))
    # The hearth back wall, the coal bed and an ember glow strip.
    hearth = box(g, 20, 12, 16, 40, 33, 18, "iron", 3)
    P.outline(g, hearth, "rust", 3, normal="z")
    P.flat(g, hearth & (Y > 14) & (Y < 30) & (X > 22) & (X < 38), "iron", 2)
    bed = box(g, 21, y0, 11, 39, 14, 16, "stone", 3)
    P.stone(g, bed & (Y < 12), "stone", 3, block=(5, 3), seed=9)
    coals = bed & (Y > 12)
    P.flat(g, coals, "ember", 3)
    P.flat(g, coals & (Y > 13), "ember", 4)
    for k, cx in enumerate((24, 28.5, 33, 36.5)):  # glowing lumps of coal
        lump = bump(g, cx, 13 + (k % 2) * 1.5, 14, 1.8, 1.4, "ember", 5)
        P.flat(g, lump & (Y > 14.8), "gold", 6)
    glow = hearth & (Y > 12) & (Y < 16)
    P.flat(g, glow, "ember", 5)  # the ember glow strip at the back of the coal bed
    P.flat(g, hearth & (Y >= 16) & (Y < 19) & (X > 21) & (X < 39), "ember", 2)
    # The chimney, banded and sooted at the top.
    chimney = box(g, 35, 43, 27, 43, 56, 35, "rust", 5)
    P.plates(g, chimney, "rust", 5, size=(8, 4), rivets=False, seed=10)
    P.flat(g, chimney & (np.floor(Y) % 6 == 0), "steel", 4)
    cap = box(g, 33, 55, 25, 45, 58, 37, "steel", 5)
    P.flat(g, edges(cap), "iron", 3)
    P.darken(g, (chimney | cap) & (Y > 52), 2)
    # The anvil on a stump, on the left.
    stump = box(g, 6, y0, 20, 16, 13, 36, "darkwood", 5)
    P.planks(g, stump, "darkwood", 5, width=4, across="x", seed=3)
    anvil = box(g, 4, 13, 21, 19, 18, 35, "steel", 4)
    P.flat(g, anvil & (Y > 17), "steel", 6)
    P.flat(g, edges(anvil), "iron", 3)
    horn = limb(g, (5, 16, 28), (0.5, 16.5, 28), 2.5, 0.7, "steel", 5, n=4)
    del horn
    # The air box of the bellows and its copper feed pipe.
    tank = box(g, 46, y0, 14, 57, 14, 28, "teal", 5)
    P.plates(g, tank, "teal", 5, size=(6, 5), seed=11)
    P.flat(g, edges(tank), "teal", 2)
    PP.hazard(g, tank & (Y < y0 + 2), period=4, a=("gold", 5), b=("iron", 3))
    limb(g, (52, 10, 14.5), (52, 10, 11), 1.4, 1.4, "rust", 6, n=6)
    limb(g, (52.5, 10, 11), (46.5, 10, 11), 1.4, 1.4, "rust", 6, n=6)
    disc(g, "x", 10, 11, 2.0, 46.5, 47.5, "rust", 4, n=8)  # the pipe flange on the pillar
    return g


def door() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    panel = box(g, 21, 14, 7, 39, 31, 11, "steel", 5)
    P.plates(g, panel, "steel", 5, size=(6, 6), seed=5)
    P.flat(g, edges(panel), "gold", 5)
    for x0 in (24, 30, 36):
        box(g, x0, 15, 11, x0 + 2, 30, 13, "iron", 4)
    handle = disc(g, "z", 37, 22, 3, 5.5, 7, "gold", 6, n=8)
    P.flat(g, handle & (X > 37), "steel", 4)
    return g


def bellows() -> Grid:
    """Leather pleats on the air box, under a steel lid with a weight."""
    g = Grid(*SIZE)
    for k in range(4):
        inset = 1 if k % 2 else 0
        box(g, 47 + inset, 14 + k * 2.5, 15 + inset, 56 - inset, 16.5 + k * 2.5, 27 - inset, "darkwood", 5 if k % 2 else 4)
    lid = box(g, 46, 24, 14, 57, 26, 28, "steel", 5)
    P.flat(g, edges(lid), "iron", 3)
    weight = box(g, 49, 26, 18, 54, 29, 24, "iron", 4)
    P.flat(g, edges(weight), "iron", 2)
    return g


def build():
    rig = Rig("scrap-forge", (31, G0, 26), forge())
    # Clip keys turn a part from its rest pose, so the door rests closed:
    # a key of -72 opens it and a key of 0 closes it.
    rig.add("fire-door", door(), (21, 14, 7))
    rig.add("bellows", bellows(), (51.5, 14, 21))
    open_close = {"fire-door": {"rot": [(0, (0, -72, 0)), (0.5, (0, 0, 0)), (1, (0, -72, 0)), (1.5, (0, 0, 0)), (2, (0, -72, 0))]},
                  "bellows": {"scale": [(0, (1, 1, 1)), (0.5, (1, 1.2, 1)), (1, (1, 1, 1)), (1.5, (1, 1.2, 1)), (2, (1, 1, 1))]}}
    return make("animated-props", "scrap-forge", "Scrap Forge", rig.root,
                clips=[Clip("idle", {"fire-door": {"rot": [(0, (0, -72, 0)), (1, (0, -70, 0)), (2, (0, -72, 0))]}}), Clip("active", open_close)],
                sockets=[rig.socket("socket-fire", (30, 15, 13)), rig.socket("socket-smoke", (39, 58.5, 31))],
                pfx=[fx("rvx-apocalypse-barrel-fire", "socket-fire", "idle", size=18), fx("rvx-apocalypse-exhaust-smoke", "socket-smoke", "clip:active", size=14)])
