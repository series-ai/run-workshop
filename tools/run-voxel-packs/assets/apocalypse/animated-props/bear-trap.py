"""Rusty bear trap, in the Pirate Nation style.

One iconic shape (rule K3), oversized so it reads at a glance: two thick
half-ring jaws with big saw teeth lie open on a steel spring bar, with a
gold trigger pan and a painted skull in the middle, leaf springs at both
ends and a chain to a stake. On `attack` the jaws snap up and meet; on
`open` they spring back down; on `idle` they tremble. Rust, rivets and the
skull are paint.
"""
import math

import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, keys, limb, make, plan
from pnkit import box
from voxgrid import Clip, Grid

SZ = (40, 16, 30)
CX, CZ = 18.0, 14.0
JY = 2.0  # hinge height
RO, RI, TOOTH = 12.5, 8.5, 3.2


def jaw_poly(front: bool):
    """A half ring with saw teeth on the inner edge, in plan (x, z)."""
    a0, a1 = (math.pi, 2 * math.pi) if front else (0.0, math.pi)
    n = 8
    outer = [(CX + RO * math.cos(a0 + (a1 - a0) * k / n), CZ + RO * math.sin(a0 + (a1 - a0) * k / n)) for k in range(n + 1)]
    inner = []
    teeth = 7
    for k in range(2 * teeth + 1):
        a = a1 - (a1 - a0) * k / (2 * teeth)
        r = RI - TOOTH if k % 2 else RI
        inner.append((CX + r * math.cos(a), CZ + r * math.sin(a)))
    return outer + inner


def jaw(front: bool) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    m = plan(g, jaw_poly(front), JY - 1, JY + 2, "rust", 5)
    d = np.hypot(X - CX, Z - CZ)
    P.mottle(g, m, "rust", 5, cell=3, seed=1 if front else 2)
    P.flat(g, m & (d < RI + 0.4), "steel", 7)  # bright filed teeth
    P.flat(g, m & (d > RO - 1.2), "rust", 4)
    PP.blotch(g, m & (d >= RI + 0.4), "steel", 5, cell=3, chance=0.05, seed=3 if front else 4)
    if not front:  # a torn red rag caught in the teeth
        P.flat(g, m & (np.abs(X - (CX + 4)) < 1.6) & (d < RI + 1.2), "red", 4)
    return g


def base() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    bar = box(g, 3, 0, CZ - 2, 34, 2, CZ + 2, "steel", 4)
    PP.hazard(g, bar, period=6, a=("gold", 5), b=("darkwood", 4), frame="top")
    # leaf springs: chunky bent steel wedges at both ends (true slopes)
    springs = np.zeros(g.shape, dtype=bool)
    for x0, s in ((2.0, 1), (35.0, -1)):
        springs |= S.bar(g, "z", (x0 + s * 0.5, 2.0), (x0 + s * 7, 5.0), 3.0, CZ - 2.5, CZ + 2.5, "steel", 5)
        springs |= box(g, min(x0, x0 + s * 3), 0, CZ - 3, max(x0, x0 + s * 3), 3, CZ + 3, "steel", 3)
    PP.blotch(g, springs, "rust", 5, cell=3, chance=0.08, seed=4)
    # the trigger pan: a gold octagon with a painted skull
    pan = S.disc(g, "y", CX, CZ, 5.0, 1, 3, "gold", 5, n=8)
    P.flat(g, pan & (S.ngon_radius(g, "y", CX, CZ, 8) > 4.0), "gold", 4)
    G.icon(g, "top", 3, int(CX - 4.5), int(CZ - 4), "skull", "darkwood", 4)
    # the chain to a stake
    for k in range(4):
        cx0 = 34 + k * 1.5
        box(g, int(cx0), 0, CZ + 2 + k * 2, int(cx0) + 2, 2 if k % 2 else 1, CZ + 4 + k * 2, "steel", 5 - k % 2)
    stake = limb(g, (38.0, 0.0, 24.0), (38.0, 9.0, 24.0), 1.3, 1.5, "wood", 5, n=4)
    P.flat(g, stake & (Y > 8), "steel", 5)
    del stake
    return g


def build():
    rig = Rig("bear-trap", (CX, 0, CZ), base())
    rig.add("jaw-l", jaw(True), (CX, JY, CZ))
    rig.add("jaw-r", jaw(False), (CX, JY, CZ))
    attack = {"jaw-l": {"rot": keys((0, (0, 0, 0)), (0.08, (90, 0, 0)), (0.12, (84, 0, 0)), (0.2, (89, 0, 0)), (0.6, (89, 0, 0)))},
              "jaw-r": {"rot": keys((0, (0, 0, 0)), (0.08, (-90, 0, 0)), (0.12, (-84, 0, 0)), (0.2, (-89, 0, 0)), (0.6, (-89, 0, 0)))}}
    reset = {"jaw-l": {"rot": keys((0, (89, 0, 0)), (0.35, (-4, 0, 0)), (0.45, (0, 0, 0)))},
             "jaw-r": {"rot": keys((0, (-89, 0, 0)), (0.35, (4, 0, 0)), (0.45, (0, 0, 0)))}}
    idle = {"jaw-l": {"rot": keys((0, (0, 0, 0)), (1.0, (0, 0, 0)), (1.05, (3, 0, 0)), (1.1, (0, 0, 0)), (2.0, (0, 0, 0)))},
            "jaw-r": {"rot": keys((0, (0, 0, 0)), (1.0, (0, 0, 0)), (1.05, (-3, 0, 0)), (1.1, (0, 0, 0)), (2.0, (0, 0, 0)))}}
    return make("animated-props", "bear-trap", "Bear Trap", rig.root,
                clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("open", reset, loop=False)],
                sockets=[rig.socket("socket-jaws", (CX, JY + 8, CZ))],
                pfx=[fx("rvx-apocalypse-metal-snap", "socket-jaws", "clip:attack", size=24, at=0.24)])
