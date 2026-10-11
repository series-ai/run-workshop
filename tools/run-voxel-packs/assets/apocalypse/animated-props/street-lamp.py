"""Flickering street lamp, in the Pirate Nation style.

A chunky lamp post, taller than a person: a concrete footing and a base
shroud with a hatch and torn flyers, a tapered teal pole (true slopes)
with a hazard band, a bent arm made of angled segments, a tangle of cable
and a cut wire, a crooked NO PARKING plate, and an oversized cobra-head
lamp whose glowing bulb stutters on `idle`. Paint carries the rust,
flyers, bolts and glyphs.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, keys, limb, make, plan
from pnkit import box
from voxgrid import Clip, Grid

SZ = (40, 64, 24)
CX, CZ = 12.0, 12.0
POLE_TOP = 50
HEAD = (31.0, 54.0, 12.0)  # the arm end where the lamp hangs


def post() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    foot = plan(g, S.flat_ngon(CX, CZ, 6.0, 8), 0, 4, "sand", 5, top=S.flat_ngon(CX, CZ, 4.6, 8))
    PP.concrete(g, foot, "sand", 5, size=6, cracks=2, seed=1)
    for a in range(4):
        bx, bz = CX + 4.2 * np.cos(np.pi / 4 + a * np.pi / 2), CZ + 4.2 * np.sin(np.pi / 4 + a * np.pi / 2)
        P.flat(g, foot & (np.hypot(X - bx, Z - bz) < 0.9) & (Y > 3), "steel", 6)
    shroud = S.disc(g, "y", CX, CZ, 3.4, 4, 13, "teal", 3, n=8)
    P.flat(g, shroud & (Y > 12), "teal", 2)
    hatch = shroud & (Z < CZ - 2.5) & (np.abs(X - CX) < 1.3) & (Y > 6) & (Y < 11)
    P.flat(g, hatch, "teal", 2)
    for fx0, fy0, col in ((CX + 1.5, 6, ("bone", 7)), (CX - 3.5, 8, ("gold", 6))):  # torn flyers
        P.flat(g, shroud & (np.abs(X - fx0) < 1.6) & (Y > fy0) & (Y < fy0 + 4) & (Z < CZ), *col)
    pole = plan(g, S.flat_ngon(CX, CZ, 2.3, 8), 13, POLE_TOP, "teal", 4, top=S.flat_ngon(CX, CZ, 1.6, 8))
    P.flat(g, pole & (np.floor(Y) % 12 == 0), "teal", 3)
    PP.hazard(g, pole & (Y > 15) & (Y < 19), period=4, a=("gold", 5), b=("darkwood", 4))
    PP.blotch(g, pole | shroud, "rust", 5, cell=2, chance=0.06, seed=2)
    cap = S.disc(g, "y", CX, CZ, 2.4, POLE_TOP, POLE_TOP + 2, "teal", 3, n=8)
    del cap
    # the bent arm: angled segments out to the lamp
    arm = limb(g, (CX, POLE_TOP - 2, CZ), (CX + 6, POLE_TOP + 4, CZ), 1.3, 1.2, "teal", 4, n=4)
    arm |= limb(g, (CX + 5.5, POLE_TOP + 3.5, CZ), (CX + 13, POLE_TOP + 5.5, CZ), 1.2, 1.1, "teal", 4, n=4)
    arm |= limb(g, (CX + 12.5, POLE_TOP + 5.5, CZ), (HEAD[0], HEAD[1] + 1.0, CZ), 1.1, 1.0, "teal", 4, n=4)
    P.flat(g, arm & (Y > POLE_TOP + 5), "teal", 5)
    # a tangle of cable at the elbow and a cut wire hanging from the arm
    for (a, b) in (((CX + 4, POLE_TOP + 1, CZ - 2), (CX + 8, POLE_TOP + 5, CZ + 2)), ((CX + 8, POLE_TOP + 2, CZ + 2), (CX + 4, POLE_TOP + 5, CZ - 1.5)), ((CX + 3, POLE_TOP + 4, CZ + 1.5), (CX + 9, POLE_TOP + 2, CZ - 1.5))):
        limb(g, a, b, 0.7, 0.7, "gray", 3, n=4)
    wire = limb(g, (CX + 16, POLE_TOP + 5, CZ), (CX + 17, POLE_TOP - 5, CZ), 0.6, 0.6, "gray", 3, n=4)
    P.flat(g, wire & (Y < POLE_TOP - 3.5), "rust", 7)
    return g


def sign() -> Grid:
    """A NO PARKING plate; the rig hangs it crooked (a rest rotation)."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    plate = box(g, CX - 7, 23, CZ - 4, CX + 8, 37, CZ - 2.3, "bone", 7)
    P.outline(g, plate, "red", 4, normal="z")
    G.text(g, "-z", CZ - 4, int(CX - 5), 28, "NO", "red", 4)
    P.flat(g, plate & (Y >= 25) & (Y < 26.5) & (np.abs(X - CX - 0.5) < 5), "red", 4)
    return g


def lamp() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hx, hy, hz = HEAD
    # the cobra head: a sloped housing (true slope) with a glowing bulb under it
    body = S.bar(g, "z", (hx - 3, hy - 1), (hx + 8, hy - 4), 6.0, hz - 4, hz + 4, "teal", 5)
    P.mottle(g, body, "teal", 5, cell=3, seed=3)
    P.flat(g, body & (Y > hy + 1), "teal", 6)
    P.outline(g, body, "teal", 3, normal="z")
    bulb = box(g, int(hx - 1), int(hy - 9), int(hz - 3), int(hx + 7), int(hy - 6), int(hz + 3), "gold", 7)
    P.flat(g, bulb & (Y < hy - 8), "gold", 6)
    P.outline(g, bulb, "ember", 3, normal="y")
    return g


def build():
    rig = Rig("street-lamp", (CX, 0, CZ), post())
    rig.add("sign", sign(), (CX, 30.0, CZ - 3), rot=(0, 0, 7))
    rig.add("lamp", lamp(), HEAD)
    stutter = [(0, (1, 1, 1)), (0.8, (1, 1, 1)), (0.85, (0.92, 0.85, 0.92)), (0.9, (1, 1, 1)), (0.95, (0.9, 0.8, 0.9)), (1.05, (1, 1, 1)), (2.0, (1, 1, 1)), (2.05, (0.95, 0.9, 0.95)), (2.1, (1, 1, 1)), (2.4, (1, 1, 1))]
    idle = {"lamp": {"scale": keys(*stutter), "rot": keys((0, (0, 0, 0)), (0.85, (0, 0, -3)), (1.05, (0, 0, 1)), (1.4, (0, 0, 0)), (2.4, (0, 0, 0)))}}
    hx, hy, hz = HEAD
    return make("animated-props", "street-lamp", "Flickering Street Lamp", rig.root,
                clips=[Clip("idle", idle)],
                sockets=[rig.socket("socket-bulb", (hx + 3, hy - 9, hz), parent="lamp")],
                pfx=[fx("rvx-apocalypse-lamp-flicker", "socket-bulb", "idle", size=24)])
