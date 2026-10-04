"""Animated steel bear trap with raised jaws, trigger pan and tether stake."""
import math

import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, keys, make, plan
from pnkit import box
from voxgrid import Clip, Grid

SZ = (40, 16, 30)
CX, CZ = 17.0, 13.0
JY = 3.0
RO, RI = 11.0, 8.0


def arc_poly(front):
    """A half-circle jaw with clear gaps at both hinge ends."""
    a0, a1 = ((math.pi + 0.3, 2 * math.pi - 0.3) if front else (0.3, math.pi - 0.3))
    outer = [(CX + RO * math.cos(a0 + (a1 - a0) * k / 10),
              CZ + RO * math.sin(a0 + (a1 - a0) * k / 10)) for k in range(11)]
    inner = []
    for k in range(7):
        a = a1 - (a1 - a0) * k / 6
        r = RI - (2.3 if k % 2 else 0.0)
        inner.append((CX + r * math.cos(a), CZ + r * math.sin(a)))
    return outer + inner


def jaw(front):
    g = Grid(*SZ)
    m = plan(g, arc_poly(front), JY, JY + 3, "steel", 4)
    P.outline(g, m, "steel", 2)
    X, Y, Z = ctr(g)
    rad = np.hypot(X - CX, Z - CZ)
    P.flat(g, m & (np.abs(Y - (JY + 2.5)) < 0.6), "steel", 6)
    P.flat(g, m & (rad > RO - 1.0), "rust", 5)
    P.flat(g, m & (rad < RI + 0.8), "steel", 6)
    # Pin heads are paint on the outer band. They move with each jaw.
    rivet_top = m & (np.abs(Y - (JY + 2.5)) < 0.6)
    for a in np.linspace(a0 := (math.pi + 0.38 if front else 0.38),
                         a1 := (2 * math.pi - 0.38 if front else math.pi - 0.38), 5):
        px, pz = CX + 9.65 * math.cos(a), CZ + 9.65 * math.sin(a)
        vx, vz = np.rint(px - 0.5) + 0.5, np.rint(pz - 0.5) + 0.5
        P.flat(g, rivet_top & (np.abs(X - vx) < 0.1) & (np.abs(Z - vz) < 0.1), "steel", 3)
    return g


def base():
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    # Open cross frame keeps the center clear and makes the trap read as metal.
    frame = box(g, 4, 0, CZ - 1.5, 30, 2, CZ + 1.5, "steel", 4)
    frame |= box(g, CX - 1.5, 0, 2, CX + 1.5, 2, 24, "steel", 4)
    P.outline(g, frame, "steel", 2)
    PP.hazard(g, frame & (Y < 1), period=7, a=("gold", 5), b=("darkwood", 4), frame="top")
    # Each jaw has a chunky hinge block, a dark socket and a short spring stack.
    for hx in (CX - 10, CX + 10):
        pod = box(g, hx - 2, 1, CZ - 3, hx + 2, 5, CZ + 3, "steel", 4)
        P.outline(g, pod, "steel", 2)
        socket = S.disc(g, "x", 3.0, CZ, 2.0, hx - 3, hx - 2, "darkwood", 3, n=8)
        cap = S.disc(g, "x", 3.0, CZ, 1.0, hx - 4, hx - 3, "gold", 5, n=8)
        del socket, cap
        for yy in (1.5, 2.5, 3.5):
            box(g, hx - 1.4, yy, CZ - 2.2, hx + 1.4, yy + 0.6, CZ + 2.2, "rust", 5)
        for dx in (-1.3, 1.3):
            for dz in (-2.3, 2.3):
                vx = np.rint(hx + dx - 0.5) + 0.5
                vz = np.rint(CZ + dz - 0.5) + 0.5
                P.flat(g, pod & (np.abs(Y - 4.5) < 0.1) & (np.abs(X - vx) < 0.1) & (np.abs(Z - vz) < 0.1), "gold", 6)
    # A framed round pressure plate has a clear signal mark and teal center.
    rim = S.disc(g, "y", CX, CZ, 5.0, 2, 3, "gold", 5, n=8)
    plate = S.disc(g, "y", CX, CZ, 4.0, 3, 4, "darkwood", 3, n=8)
    d = S.ngon_radius(g, "y", CX, CZ, 8)
    P.flat(g, rim & (d > 4.0), "gold", 7)
    P.outline(g, plate, "darkwood", 1)
    # A bright ring and marked center make the pressure plate easy to read.
    plate_top = plate & (Y > 3)
    P.flat(g, plate_top, "darkwood", 2)
    P.flat(g, plate_top & (d > 2.9), "gold", 6)
    P.flat(g, plate_top & (np.abs(X - CX) < 1.5) & (np.abs(Z - CZ) < 1.5), "teal", 6)
    P.flat(g, plate_top & (np.abs(X - (CX + 0.5)) < 0.1) & (np.abs(Z - (CZ + 0.5)) < 0.1), "red", 6)
    # The chain forms a continuous, overlapping S curve from the frame to the stake.
    path = [(29.0, 1.5, 13.0), (31.0, 1.5, 15.0), (33.0, 1.5, 17.0),
            (35.0, 1.5, 19.0), (36.0, 1.5, 21.5)]
    for i, (p0, p1) in enumerate(zip(path, path[1:])):
        # Thick diagonal links overlap at their ends, so there are no floating cubes.
        dx, dz = p1[0] - p0[0], p1[2] - p0[2]
        length = math.hypot(dx, dz)
        nx, nz = -dz / length * 0.72, dx / length * 0.72
        link = plan(g, [(p0[0] + nx, p0[2] + nz), (p1[0] + nx, p1[2] + nz),
                        (p1[0] - nx, p1[2] - nz), (p0[0] - nx, p0[2] - nz)],
                   1, 2.5, "steel", 5)
        P.flat(g, link & ((X + Z + i) % 3 < 1), "steel", 7)
    # Stake is planted beside the trap and capped with a forged steel head.
    stake = box(g, 35, 0, 21, 38, 12, 24, "wood", 5)
    P.planks(g, stake, "wood", 5, width=2, across="z", length=(5, 7), nails=False, seed=2)
    P.flat(g, stake & (X == 35), "wood", 3)
    P.flat(g, stake & (X == 37) & (np.floor(Y) % 4 == 0), "sand", 5)
    cap = box(g, 34.5, 11, 20.5, 38.5, 13, 24.5, "steel", 5)
    P.outline(g, cap, "steel", 3)
    for yy in (2, 8):
        box(g, 34.5, yy, 20.5, 38.5, yy + 1, 24.5, "darkwood", 4)
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
