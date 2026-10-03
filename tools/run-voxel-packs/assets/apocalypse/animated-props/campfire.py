"""Survivor campfire, in the Pirate Nation style.

A ring of chunky faceted stones round an ash bed, a teepee of logs (true
slopes) with glowing charred feet, and three flame tongues that flicker on
`idle`. Two forked posts hold a spit with a roasting rat that turns on
`idle`. A coffee pot sits on a stone and a tin can is the seat. Bark, ash,
labels and embers are paint.
"""
import math

import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, flame, flicker, fx, limb, make, plan, rock
from voxgrid import Clip, Grid, turn

SZ = (40, 36, 36)
CX, CZ = 20.0, 18.0
SPIT_Y = 22.0


def base() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    ash = plan(g, S.flat_ngon(CX, CZ, 9.5, 8), 0, 1, "sand", 4)
    P.mottle(g, ash, "gray", 5, cell=2, seed=1)
    PP.blotch(g, ash, "ember", 2, cell=2, chance=0.06, seed=2)
    # the stone ring: eight chunky boulders
    for k in range(9):
        a = 2 * math.pi * k / 9 + 0.2
        r = 11.5
        m = rock(g, CX + r * math.cos(a), CZ + r * math.sin(a), 0, 3.4, 3.0, 4 + (k % 3), ramp="stone", shade=5, shrink=0.55, n=6, seed=10 + k, turn=a)
        P.mottle(g, m, "stone", 5, cell=2, seed=k)
        P.flat(g, m & (Y > 4) & (np.hypot(X - CX, Z - CZ) < r - 1), "stone", 3)  # soot on the inner side
    # a log teepee: five logs leaning in to the middle
    logs = np.zeros(g.shape, dtype=bool)
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.5
        foot = (CX + 8 * math.cos(a), 1.5, CZ + 8 * math.sin(a))
        tip = (CX + 1.2 * math.cos(a), 10.0, CZ + 1.2 * math.sin(a))
        logs |= limb(g, foot, tip, 1.7, 1.3, "wood", 5, n=6)
    P.planks(g, logs, "wood", 4, width=2, across="y", nails=False, seed=3)
    P.flat(g, logs & (Y < 2.6), "ember", 2)
    P.flat(g, logs & (Y > 8.5), "darkwood", 5)
    # forked spit posts
    for px in (CX - 16, CX + 16):
        post = limb(g, (px, 0, CZ), (px, SPIT_Y - 1, CZ), 1.4, 1.2, "wood", 5, n=6)
        post |= limb(g, (px, SPIT_Y - 2, CZ), (px - 2.6, SPIT_Y + 3, CZ), 1.0, 0.9, "wood", 5, n=4)
        post |= limb(g, (px, SPIT_Y - 2, CZ), (px + 2.6, SPIT_Y + 3, CZ), 1.0, 0.9, "wood", 5, n=4)
        P.planks(g, post, "wood", 5, width=2, across="x", nails=False, seed=int(px))
        P.flat(g, post & (Y < 2), "darkwood", 4)
    # a coffee pot warming on a stone, and a tin-can seat
    pot = plan(g, S.flat_ngon(CX + 11, CZ - 9, 2.6, 8), 5, 11, "steel", 6, top=S.flat_ngon(CX + 11, CZ - 9, 1.8, 8))
    pot |= limb(g, (CX + 9, 8.5, CZ - 9), (CX + 6.5, 10.5, CZ - 9), 0.8, 0.6, "steel", 6, n=4)
    P.flat(g, pot & (Y > 10), "steel", 4)
    can = S.drum(g, CX + 12, CZ - 12.5, 0, 9, 3.6, ramp="red", base=5, hoop="steel", band=("bone", 6), wear=False, seed=4)
    del can
    return g


def fire(cx, cz, h, r, lean, seed) -> Grid:
    g = Grid(*SZ)
    flame(g, cx, cz, 2, h, r, lean=lean, seed=seed)
    return g


def spit() -> Grid:
    """The spit rod and a roasting rat (the part that turns)."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    rod = limb(g, (CX - 18.5, SPIT_Y, CZ), (CX + 18.5, SPIT_Y, CZ), 0.9, None, "steel", 5, n=4)
    crank = limb(g, (CX + 18.5, SPIT_Y, CZ), (CX + 18.5, SPIT_Y - 4, CZ), 0.8, None, "steel", 4, n=4)
    body = S.disc(g, "x", SPIT_Y, CZ, 3.2, CX - 5, CX + 4, "skindark", 5, n=8)
    head = limb(g, (CX - 5, SPIT_Y, CZ), (CX - 10, SPIT_Y - 0.5, CZ), 2.6, 1.0, "skindark", 5, n=6)
    tail = limb(g, (CX + 4, SPIT_Y, CZ), (CX + 11, SPIT_Y + 1.5, CZ), 0.8, 0.5, "pink", 3, n=4)
    for dz in (-1.6, 1.6):  # ears and four stiff legs
        limb(g, (CX - 7, SPIT_Y + 1.5, CZ + dz), (CX - 6.5, SPIT_Y + 4, CZ + dz * 1.4), 0.9, 0.6, "pink", 4, n=4)
        for lx in (CX - 3, CX + 2):
            limb(g, (lx, SPIT_Y - 2, CZ + dz), (lx + 0.5, SPIT_Y - 5.5, CZ + dz * 1.5), 0.7, 0.6, "skindark", 4, n=4)
    rat = body | head
    P.mottle(g, rat, "skindark", 6, cell=2, seed=5)
    PP.blotch(g, rat, "skindark", 4, cell=2, chance=0.2, seed=6)  # crisp roasted patches
    P.flat(g, head & (X < CX - 8.5), "skin", 3)
    del rod, crank, tail
    return g


def build():
    rig = Rig("campfire", (CX, 0, CZ), base())
    for name, (fx_, fz, h, r, lean, seed) in {
        "flame-a": (CX, CZ, 17, 4.6, (0.8, -0.6), 0),
        "flame-b": (CX - 3.5, CZ + 2, 11, 3.0, (-2.0, 1.0), 1),
        "flame-c": (CX + 3, CZ - 2.5, 12, 3.2, (1.5, -1.0), 2),
    }.items():
        rig.add(name, fire(fx_, fz, h, r, lean, seed), (fx_, 2, fz))
    rig.add("spit", spit(), (CX, SPIT_Y, CZ))
    idle = {
        "flame-a": {"scale": flicker(0, 0.9, 3.6)},
        "flame-b": {"scale": flicker(1, 0.72, 3.6)},
        "flame-c": {"scale": flicker(2, 1.2, 3.6)},
        "spit": {"rot": turn(3.6, "x", 100)},
    }
    return make("animated-props", "campfire", "Survivor Campfire", rig.root,
                clips=[Clip("idle", idle)],
                sockets=[rig.socket("socket-fire", (CX, 6, CZ))],
                pfx=[fx("rvx-apocalypse-barrel-fire", "socket-fire", "idle", size=22)])
