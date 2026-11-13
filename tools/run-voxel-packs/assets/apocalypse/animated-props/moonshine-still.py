"""Copper moonshine still with a cycling pressure valve and vapour plume.

A pot still at person scale (about 45 high): a riveted copper pot sits on
a stone firebox with a glowing fire mouth. A neck rises to an onion helmet
with the pressure valve wheel on top. A copper lyne arm slopes down into
a planked worm barrel, and a spout drips into a mason jar on the ground.
Split logs feed the fire. The still stands on a patch of packed earth with
ash under the fire mouth (no plinth). Copper is the rust ramp; teal patina
patches are the accent. Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, limb, make
from _rep_anim import dirt_patch
from pnkit import barrel, box, edges
from voxgrid import Clip, Grid

SIZE = (50, 50, 38)
PX, PZ = 18.0, 19.0  # the pot axis
POT_R = 10.0
WX, WZ = 38.0, 22.0  # the worm barrel axis
VALVE = (PX, 42.5, PZ - 1.5)  # the valve wheel centre


def still() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    dirt_patch(g, 24, 19, 22, 16, 0, 1, seed=4, soot=(PX, PZ - 11, 6))
    # The stone firebox, with a glowing mouth on the front.
    fire = box(g, PX - 10, 1, PZ - 10, PX + 10, 9, PZ + 10, "stone", 4)
    P.stone(g, fire, "stone", 4, block=(5, 3), seed=1)
    P.flat(g, edges(fire), "stone", 2)
    mouth = fire & (Z < PZ - 9) & (np.abs(X - PX) < 4) & (Y > 1.5) & (Y < 7)
    P.flat(g, mouth, "iron", 2)
    P.flat(g, mouth & (Y < 4), "ember", 3)
    P.flat(g, mouth & (Y < 3) & (np.abs(X - PX) < 2.5), "ember", 5)
    P.flat(g, fire & (Z < PZ - 9) & (np.abs(X - PX) < 5) & (Y > 7), "iron", 3)  # soot over the mouth
    # The riveted copper pot, two dark hoops and a patina.
    pot = S.disc(g, "y", PX, PZ, POT_R, 9, 25, "rust", 6, n=10)
    P.plates(g, pot, "rust", 6, size=(6, 5), seed=2)
    for hy in (11, 22):
        S.disc(g, "y", PX, PZ, POT_R + 0.7, hy, hy + 1.5, "rust", 3, n=10)
    PP.blotch(g, pot & (Y > 13) & (Y < 21), "teal", 5, cell=3, chance=0.035, seed=3)
    shoulder = S.cone(g, "y", PX, PZ, POT_R, 25, 30, "rust", 6, n=10, r_top=4.5)
    P.flat(g, shoulder & (Y > 28), "rust", 7)
    neck = S.disc(g, "y", PX, PZ, 3.0, 30, 35, "rust", 5, n=8)
    P.flat(g, neck & (np.floor(Y) == 32), "rust", 3)
    helmet = S.disc(g, "y", PX, PZ, 5.0, 35, 39, "rust", 6, n=8)
    P.flat(g, helmet & (Y > 38), "rust", 7)
    P.flat(g, edges(helmet), "rust", 4)
    # The valve stem rises from the helmet; the wheel turns on its front.
    vx, vy, vz = VALVE
    limb(g, (vx, 39.0, PZ), (vx, vy + 1, PZ), 0.9, 0.9, "steel", 5, n=6)
    box(g, vx - 1, vy - 1, vz, vx + 1, vy + 1, PZ + 1, "steel", 4)
    # A pressure gauge on the pot front.
    gauge = S.disc(g, "z", PX - 4, 18, 2.6, PZ - POT_R - 1, PZ - POT_R + 0.5, "bone", 6, n=8)
    P.flat(g, gauge & (S.ngon_radius(g, "z", PX - 4, 18, 8) > 1.9), "steel", 4)
    P.flat(g, gauge & (np.abs(X - (PX - 4) - (Y - 18) * 0.6) < 0.5) & (Y > 18), "red", 4)
    # The lyne arm slopes from the helmet into the worm barrel.
    arm = limb(g, (PX + 4, 37, PZ), (WX, 21, WZ), 1.5, 1.3, "rust", 6, n=6)
    P.flat(g, arm & (np.floor(X) % 6 == 0), "rust", 4)
    # The worm barrel and its spout over the jar.
    tub = barrel(g, WX, WZ, 1, 20, 6.5, "wood", "iron", 4)
    del tub
    S.disc(g, "y", WX, WZ, 4.8, 20.5, 21.2, "rust", 5, n=8)  # the copper lid
    spout = limb(g, (WX, 8, WZ - 5.5), (WX, 8, WZ - 10), 0.9, 0.7, "rust", 6, n=6)
    del spout
    jar = S.disc(g, "y", WX, WZ - 10.5, 2.4, 1, 6.5, "sky", 6, n=8)
    P.flat(g, jar & (Y < 4.5), "bone", 7)  # the clear spirit
    S.disc(g, "y", WX, WZ - 10.5, 1.6, 6.5, 7.2, "steel", 5, n=8)  # the jar neck
    for jx in (WX + 5, WX + 8.5):  # two full jars wait by the barrel
        j = S.disc(g, "y", jx, WZ - 9, 2.0, 1, 6, "sky", 6, n=8)
        P.flat(g, j & (Y < 5), "bone", 7)
        S.disc(g, "y", jx, WZ - 9, 2.1, 6, 7, "gold", 5, n=8)
    # Split logs for the fire.
    for lz, ly in ((PZ - 3, 1), (PZ + 3, 1), (PZ, 3.4)):
        log = limb(g, (2.5, ly + 1.2, lz), (8.6, ly + 1.2, lz), 1.2, 1.2, "wood", 4, n=6)
        P.flat(g, log & (X < 3.2), "wood", 6)
    return g


def valve() -> Grid:
    g = Grid(*SIZE)
    X, Y, _Z = ctr(g)
    vx, vy, vz = VALVE
    wheel = S.disc(g, "z", vx, vy, 3.4, vz - 1.2, vz, "red", 4, n=8)
    P.flat(g, wheel & (S.ngon_radius(g, "z", vx, vy, 8) < 2.3), "red", 2)
    P.flat(g, wheel & (np.abs(X - vx) < 0.6), "red", 5)
    P.flat(g, wheel & (np.abs(Y - vy) < 0.6), "red", 5)
    return g


def build():
    rig = Rig("moonshine-still", (24, 0, 19), still())
    rig.add("valve", valve(), VALVE)
    active = {"valve": {"rot": [(0, (0, 0, 0)), (0.5, (0, 0, 55)), (1, (0, 0, 0)), (1.5, (0, 0, -55)), (2, (0, 0, 0))]}}
    return make("animated-props", "moonshine-still", "Moonshine Still", rig.root,
                clips=[Clip("idle", {"valve": {"rot": [(0, (0, 0, 0)), (1, (0, 0, 8)), (2, (0, 0, 0))]}}), Clip("active", active)],
                sockets=[rig.socket("socket-steam", (PX, 46.5, PZ))],
                pfx=[fx("rvx-apocalypse-exhaust-smoke", "socket-steam", "clip:active", size=12)])
