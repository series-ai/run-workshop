"""Cargo crane, in the Pirate Nation mecha style.

A dockside loader: a hazard pedestal, a slew ring, a riveted machinery
house with an orange cab and big teal windows, a lattice mast and a long
lattice jib with a counterweight block (true diagonals everywhere, F2;
thick rails, F3). The oversized function prop is the hook: a steel pulley
block under a fat orange hook on a cable. On `active` the crane slews,
lowers the hook, lifts it and swings back; on `idle` the jib and hook
sway. Faces -Z.
"""
import numpy as np

from _bld import truss
from _life import P, Clip, Grid, Rig, asset, box, coords, edges, front, hazard, keys, light_top, ngon_y, plate_facets, plated, side, wave
from pnshapes import bar, last
from voxgrid import C

S = (46, 78, 64)
CX, CZ = 23, 40
YS = 10  # slew ring
YM = 58  # mast top (the jib hangs here)
TIP = 5  # the jib tip in z
HOOK = 26  # the hook block centre at rest


def base() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    pad = ngon_y(g, CX, CZ, 15, 0, 3, "iron", 4, n=8)
    hazard(g, pad, period=5, a=("orange", 5), b=("iron", 4))
    light_top(g, pad, "iron", 5)
    n0 = len(g.solids)
    ped = ngon_y(g, CX, CZ, 12, 3, YS - 2, "steel", 5, n=8, r_top=10)
    plate_facets(g, g.solids[n0:], "steel", 5, size=(9, 6), seed=1)
    P.flat(g, edges(ped), "steel", 3)
    P.flat(g, ped & (Y > YS - 4) & (Y < YS - 3), "orange", 5)
    for k in range(8):  # anchor bolts round the pad
        a = 2 * np.pi * k / 8 + 0.4
        bx, bz = CX + 13.5 * np.cos(a), CZ + 13.5 * np.sin(a)
        box(g, bx - 1, 3, bz - 1, bx + 1, 4, bz + 1, "gold", 6)
    ring = ngon_y(g, CX, CZ, 11, YS - 2, YS, "iron", 4, n=16)
    P.flat(g, ring, "iron", 4)
    light_top(g, ring, "iron", 6)
    return g


def turret() -> Grid:
    """The slewing body: machinery house, orange cab and lattice mast."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    deck = ngon_y(g, CX, CZ, 10.5, YS, YS + 3, "steel", 4, n=12)
    plated(g, deck, "steel", 4, size=(7, 3), seed=2)
    P.flat(g, edges(deck), "steel", 2)
    # the machinery house behind the mast
    house = box(g, CX - 9, YS + 3, CZ + 1, CX + 9, YS + 17, CZ + 15, "steel", 5)
    plated(g, house, "steel", 5, size=(9, 7), seed=3)
    P.flat(g, house & (Y > YS + 15), "steel", 6)
    vent = house & (Z > CZ + 14) & (Y > YS + 6) & (Y < YS + 14) & (np.abs(X - CX) < 6)
    P.flat(g, vent, "steel", 3)
    P.flat(g, vent & (np.floor(Y) % 2 == 0), "steel", 6)
    cap = box(g, CX - 10, YS + 17, CZ, CX + 10, YS + 20, CZ + 16, "orange", 5)
    P.flat(g, cap, "orange", 5)
    P.flat(g, edges(cap), "orange", 3)
    light_top(g, cap, "orange", 6)
    # the operator cab in front, with big teal windows and a sloped front
    cab = side(g, [(YS + 3, CZ - 14), (YS + 3, CZ + 1), (YS + 18, CZ + 1), (YS + 18, CZ - 9), (YS + 11, CZ - 15)], CX - 7, CX + 7, "orange", 6)
    P.flat(g, cab, "orange", 6)
    P.flat(g, cab & (Y < YS + 5), "orange", 4)
    P.flat(g, edges(cab), "orange", 3)
    glass = cab & (Y > YS + 6) & (Y < YS + 15) & ((Z < CZ - 9.5) | (np.abs(X - CX) > 6))
    P.flat(g, glass, "cyan", 6)
    P.flat(g, glass & (Y > YS + 13), "cyan", 7)
    P.flat(g, glass & (np.abs(X - CX) < 0.6), "orange", 4)
    hazard(g, cab & (Y > YS + 3) & (Y < YS + 5.5) & (Z < CZ - 13), period=4, a=("orange", 5), b=("iron", 3), frame="wall")
    light_top(g, cab, "orange", 7)
    # the lattice mast: two truss panels leaning forward
    for x0 in (CX - 8, CX + 5):
        truss(g, "x", (YS + 12, CZ + 4), (YM, CZ - 2), 12, x0, x0 + 3, ramp="orange", base=5, braces=4, thick=2.5)
    for yy in (34, 46):  # cross ties between the panels
        box(g, CX - 8, yy, CZ - 3, CX + 8, yy + 2, CZ + 1, "orange", 4)
    head = box(g, CX - 7, YM - 2, CZ - 6, CX + 7, YM + 3, CZ + 4, "steel", 5)
    plated(g, head, "steel", 5, size=(7, 4), seed=4)
    P.flat(g, edges(head), "steel", 3)
    P.flat(g, head & (Y > YM + 1), "orange", 5)
    for s in (-1, 1):  # warning lamps on the head
        P.flat(g, head & (np.abs(X - (CX + s * 6)) < 1.2) & (Y > YM + 1.5), "gold", 7)
    return g


def jib() -> Grid:
    """The boom and its counterweight tail, both lattice (true diagonals)."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    for x0 in (CX - 5, CX + 2):
        truss(g, "x", (YM - 1, CZ - 4), (YM - 7, TIP + 3), 9, x0, x0 + 3, ramp="bone", base=6, braces=6, thick=2.2)
        truss(g, "x", (YM - 1, CZ + 2), (YM - 4, CZ + 17), 8, x0, x0 + 3, ramp="bone", base=6, braces=3, thick=2.2)
    boom = g.a > 0
    P.flat(g, boom & (np.abs(X - CX) > 4.2), "bone", 4)
    light_top(g, boom, "bone", 7)
    # the tip sheave block and a hazard nose
    nose = box(g, CX - 6, YM - 11, TIP - 1, CX + 6, YM - 4, TIP + 5, "steel", 5)
    plated(g, nose, "steel", 5, size=(6, 5), seed=5)
    P.flat(g, edges(nose), "steel", 3)
    hazard(g, nose & (Z < TIP + 0.5), period=4, a=("orange", 5), b=("iron", 3), frame="wall")
    P.flat(g, nose & (np.abs(X - CX) > 5) & (Y > YM - 9) & (Y < YM - 6), "gold", 6)  # sheaves
    # the counterweight block on the tail
    cw = box(g, CX - 8, YM - 11, CZ + 13, CX + 8, YM - 2, CZ + 21, "iron", 5)
    P.flat(g, cw, "iron", 5)
    P.flat(g, edges(cw), "iron", 3)
    P.flat(g, cw & (np.floor(Y) % 3 == 0), "iron", 4)
    P.flat(g, cw & (Z > CZ + 20) & (np.abs(X - CX) < 5) & (np.abs(Y - (YM - 6)) < 2), "orange", 5)
    light_top(g, cw, "iron", 6)
    return g


def cable() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    c = box(g, CX - 1, HOOK, TIP + 1, CX + 1, YM - 10, TIP + 3, "iron", 4)
    P.flat(g, c, "iron", 4)
    P.flat(g, c & (X < CX), "iron", 6)
    return g


def hook() -> Grid:
    """A steel pulley block under a fat orange hook (a true diagonal curve)."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    blk = box(g, CX - 5, HOOK - 6, TIP - 2, CX + 5, HOOK, TIP + 6, "steel", 5)
    plated(g, blk, "steel", 5, size=(5, 4), seed=6)
    P.flat(g, edges(blk), "steel", 3)
    hazard(g, blk & (Y > HOOK - 2.5), period=4, a=("orange", 5), b=("iron", 3), frame="top")
    P.flat(g, blk & (np.abs(X - CX) > 4) & (np.abs(Y - (HOOK - 3)) < 2), "gold", 6)  # sheave caps
    shank = box(g, CX - 2, HOOK - 11, TIP + 1, CX + 2, HOOK - 5, TIP + 5, "orange", 5)
    P.flat(g, shank, "orange", 5)
    P.flat(g, edges(shank), "orange", 3)
    curve = front(g, [(CX - 3, HOOK - 12), (CX + 3, HOOK - 12), (CX + 5, HOOK - 17), (CX + 1, HOOK - 21),
                      (CX - 3, HOOK - 19), (CX - 1, HOOK - 16), (CX - 3, HOOK - 15)], TIP + 1, TIP + 5, "orange", 5)
    P.flat(g, curve, "orange", 5)
    P.flat(g, curve & (X > CX + 1), "orange", 6)
    P.flat(g, curve & (Y < HOOK - 18), "bone", 6)  # the bright tip
    P.flat(g, edges(curve), "orange", 3)
    return g


def build():
    rig = Rig()
    rig.add("cargo-crane", base(), (CX, 0, CZ))
    rig.add("turret", turret(), (CX, YS, CZ), "cargo-crane")
    rig.add("jib", jib(), (CX, YM - 1, CZ - 1), "turret")
    rig.add("cable", cable(), (CX, YM - 10, TIP + 2), "jib")
    rig.add("hook", hook(), (CX, HOOK, TIP + 2), "jib")
    z = (0.0, 0.0, 0.0)
    one = (1.0, 1.0, 1.0)
    drop = 30.0 * (1.0 - 0.45)
    active = {
        "turret": {"rot": keys((0, z), (1.0, (0, -14, 0)), (2.2, (0, -42, 0)), (3.4, (0, -16, 0)), (4.4, z))},
        "jib": {"rot": keys((0, z), (1.2, (-3, 0, 0)), (2.6, (2, 0, 0)), (4.4, z))},
        "cable": {"scale": keys((0, one), (1.2, (1, 0.45, 1)), (2.8, (1, 0.45, 1)), (4.4, one))},
        "hook": {"loc": keys((0, z), (1.2, (0, drop, 0)), (2.8, (0, drop, 0)), (4.4, z))},
    }
    idle = {
        "turret": {"rot": wave(6.0, "y", 5)},
        "jib": {"rot": wave(6.0, "x", 1.5, phase=0.9)},
        "hook": {"rot": wave(3.0, "z", 6)},
    }
    return asset("animated-props", "cargo-crane", "Cargo Crane", rig.root,
                 clips=[Clip("active", active), Clip("idle", idle)])
