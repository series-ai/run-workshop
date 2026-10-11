"""Tall warning siren with a rotating signal-red beacon."""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, keys, limb, make
from pnkit import box, edges
from pnshapes import disc
from voxgrid import C, Clip, Grid, turn

SIZE = (38, 68, 38)
CX, CZ = 19.0, 19.0
G0 = 3  # the ground in the build frame: the parts above keep their old heights


def mast() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    # The pole is set in an old tyre filled with concrete, 2 voxels high (no plinth).
    tyre = S.tyre(g, "y", CX, CZ, 9, G0, G0 + 2.5, rubber=("iron", 4), hub=("stone", 6), n=10)
    d = S.ngon_radius(g, "y", CX, CZ, 10)
    fill = tyre & (d < 6.4) & (Y > G0 + 2)
    PP.concrete(g, fill, "stone", 6, size=16, cracks=2, frame="top", seed=1)
    P.flat(g, tyre & (d >= 6.4) & (d < 7.4) & (Y > G0 + 2), "iron", 2)  # the inner bead of the tyre
    for dx, dz in ((-4, -4), (4, -4), (-4, 4), (4, 4)):  # the bolted brackets at the pole foot
        box(g, CX + dx - 1, G0 + 2, CZ + dz - 1, CX + dx + 1, G0 + 5, CZ + dz + 1, "steel", 5)
    pole = disc(g, "y", CX, CZ, 4.0, 5, 56, "steel", 5, n=8)
    P.flat(g, pole & (np.floor(Y) % 13 == 0), "steel", 3)
    P.flat(g, pole & (Y > 8) & (Y < 14), "gold", 6)
    P.flat(g, pole & (Y > 10) & (Y < 12) & (np.abs(X - CX) < 1), "darkwood", 3)
    P.flat(g, edges(pole), "steel", 3)
    for y0 in range(16, 52, 7):
        box(g, CX - 5, y0, CZ - 1, CX + 5, y0 + 1, CZ + 1, "steel", 4)
    limb(g, (CX - 3, 50, CZ), (CX - 11, 58, CZ), 1.8, 1.5, "rust", 5, n=4)
    limb(g, (CX + 3, 50, CZ), (CX + 11, 58, CZ), 1.8, 1.5, "rust", 5, n=4)
    return g


def beacon() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    body = disc(g, "y", CX, CZ, 9.0, 54, 60, "steel", 5, n=8)
    P.plates(g, body, "steel", 5, size=(5, 4), seed=3)
    lens = disc(g, "y", CX, CZ, 7.5, 60, 66, "red", 6, n=8)
    P.flat(g, lens & (np.abs(X - CX) < 2) & (Z < CZ), "red", 7)
    P.flat(g, lens & (Z > CZ + 5), "red", 3)
    P.flat(g, edges(lens), "darkwood", 3)
    cap = disc(g, "y", CX, CZ, 8.5, 66, 68, "gold", 5, n=8)
    P.flat(g, cap & (Y > 66), "gold", 6)
    return g


def build():
    rig = Rig("alarm-siren", (CX, G0, CZ), mast())
    rig.add("beacon", beacon(), (CX, 60, CZ))
    sweep = {"beacon": {"rot": turn(1.2, "y", 300)}}
    point = (CX, 65, CZ)
    return make("animated-props", "alarm-siren", "Alarm Siren", rig.root,
                clips=[Clip("idle", sweep), Clip("active", sweep)],
                sockets=[rig.socket("socket-beacon", point, parent="beacon")],
                pfx=[fx("rvx-apocalypse-lamp-flicker", "socket-beacon", "clip:active", size=18)])
