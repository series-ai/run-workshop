"""A salvaged horizontal-axis wind turbine on a smooth tubular mast.

Not a lattice tower (the original windmill-pump and radio-tower are
lattices): a tapered steel tube in dirty white paint, with dark flange
rings and rust streaks below them, carries a teal-striped nacelle. A long
three-blade rotor, about 60 across, turns in front of it (true slopes,
rule F2); the blade tips have red bands. A red lamp sits on the nacelle.
At the base the mast is bolted to a steel flange plate, and a cable runs
to a battery box with a bolt badge (no plinth). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph as G
import pnshapes as S
from _life import Rig, ctr, fx, limb, make
from _rep_anim import bolt_plate
from pnkit import box, edges
from voxgrid import C, Clip, Grid, turn

SIZE = (68, 90, 40)
CX, CZ = 32.0, 22.0  # the mast axis
TOP = 53.0  # the top of the mast, under the nacelle
HUB = (CX, 56.5, 12.5)  # the rotor centre
BLADE = 30.5  # the blade length from the hub centre


def mast() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    bolt_plate(g, CX, CZ, 6.5, 0, 1.5, bolts=8, n=8, seed=1)
    tube = limb(g, (CX, 1.5, CZ), (CX, TOP + 0.5, CZ), 3.2, 2.1, "bone", 5, n=8)
    P.flat(g, tube & (np.abs(X - CX) < 1.2) & (Z < CZ), "bone", 6)  # a soft highlight down the front
    for fy in (19, 37):  # the section flanges, with rust streaks below them
        S.disc(g, "y", CX, CZ, 3.2 - (fy - 1.5) / 52 * 1.1 + 0.8, fy, fy + 1.2, "steel", 4, n=8)
        for a in (0.4, 2.3, 4.1):
            sx, sz = CX + math.cos(a) * 3, CZ + math.sin(a) * 3
            P.flat(g, tube & (np.hypot(X - sx, Z - sz) < 1.1) & (Y < fy) & (Y > fy - 6 + a), "rust", 5)
    P.flat(g, tube & (Y > 4) & (Y < 8), "gold", 5)  # a warning band at eye level for vehicles
    P.flat(g, tube & ((np.floor(Y) == 4) | (np.floor(Y) == 7)), "gold", 3)
    door = tube & (Z < CZ - 1) & (np.abs(X - CX) < 1.6) & (Y > 9) & (Y < 16)
    P.flat(g, door, "bone", 4)  # the service hatch
    P.outline(g, door, "steel", 3)
    P.grime(g, tube, height=4, seed=2)
    # The nacelle: a chamfered pod with a teal stripe and a red lamp.
    pod = [(TOP, 14.0), (TOP, 30.0), (TOP + 3, 32.0), (TOP + 7, 30.0), (TOP + 8, 26.0), (TOP + 8, 16.0), (TOP + 6, 14.0)]
    g.prism("x", pod, CX - 3.5, CX + 3.5, C("bone", 5))
    nac = g.solids[-1].mask(g.shape)
    P.flat(g, nac & (Y > TOP + 3) & (Y < TOP + 5), "teal", 5)
    P.outline(g, nac, "bone", 3, normal="x")
    P.flat(g, nac & (Z > 29) & (Y < TOP + 6) & (Y > TOP + 1.5), "steel", 3)  # the rear vent
    S.disc(g, "y", CX, 24, 1.2, TOP + 8, TOP + 9.5, "steel", 4, n=6)
    lamp = S.disc(g, "y", CX, 24, 1.3, TOP + 9.5, TOP + 11.5, "red", 6, n=8)
    P.flat(g, lamp & (Y > TOP + 11), "red", 7)
    # The battery box beside the mast, and its cable.
    bx0, bx1, bz0, bz1 = CX + 9, CX + 21, CZ - 6, CZ + 5
    batt = box(g, bx0, 0, bz0, bx1, 11, bz1, "steel", 4)
    P.flat(g, batt & (Z > bz0 + 1) & (np.floor(Y) % 3 == 0) & (Y > 3) & (Y < 10), "steel", 3)  # side vent slots
    P.flat(g, edges(batt), "iron", 3)
    P.grime(g, batt, height=2, seed=4)
    lid = box(g, bx0 - 0.5, 11, bz0 - 0.5, bx1 + 0.5, 12.5, bz1 + 0.5, "teal", 4)
    P.flat(g, edges(lid), "teal", 2)
    G.icon(g, "-z", bz0, int(bx0) + 2, 1, "bolt", "gold", 5)
    for tx in (bx0 + 2.5, bx1 - 2.5):  # the terminals
        S.disc(g, "y", tx, CZ + 1, 1.0, 12.5, 14, "red" if tx < CX + 15 else "iron", 5, n=6)
    limb(g, (bx0, 2.4, CZ), (CX + 3.0, 2.4, CZ), 0.9, 0.9, "iron", 3, n=6)  # the cable into the mast foot
    return g


def rotor() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    cx, cy, cz = HUB
    hub = S.disc(g, "z", cx, cy, 3.6, cz, 14.5, "bone", 5, n=8)
    P.flat(g, hub & (Z > 13.5), "steel", 4)
    nose = S.cone(g, "z", cx, cy, 3.6, cz - 3.5, cz, "bone", 6, n=8, tip="lo")
    P.flat(g, nose & (Z < cz - 2.5), "red", 5)
    for k in range(3):
        a = math.pi / 2 + k * 2 * math.pi / 3
        ux, uy = math.cos(a), math.sin(a)
        vx, vy = -uy, ux
        # An airfoil plan: a wide root, a swept leading edge and a narrow tip.
        shape = ((2.5, -1.6), (2.5, 1.6), (9.0, 2.8), (BLADE - 1.0, 1.1), (BLADE, -0.2), (BLADE - 2.0, -1.2), (8.0, -1.8))
        pts = [(cx + ux * r + vx * w, cy + uy * r + vy * w) for r, w in shape]
        g.prism("z", pts, cz - 0.5, cz + 1.0, C("bone", 6))
        blade = g.solids[-1].mask(g.shape)
        along = (X - cx) * ux + (Y - cy) * uy
        P.flat(g, blade & (along > BLADE - 6) & (along < BLADE - 3.5), "red", 5)
        P.flat(g, blade & (along > BLADE - 2.5), "red", 5)
        P.flat(g, blade & (along < 5), "steel", 5)  # the pitch bearing
    return g


def build():
    rig = Rig("wind-turbine", (CX, 0, CZ), mast())
    rig.add("rotor", rotor(), HUB)
    socket = rig.socket("socket-beacon", (CX, TOP + 11, 24))
    return make("animated-props", "wind-turbine", "Salvage Wind Turbine", rig.root,
                clips=[Clip("idle", {"rotor": {"rot": turn(3.0, "z", 360)}}), Clip("active", {"rotor": {"rot": turn(1.6, "z", 225)}})],
                sockets=[socket], pfx=[fx("rvx-apocalypse-lamp-flicker", "socket-beacon", "idle", size=12)])
