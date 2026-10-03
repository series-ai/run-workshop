"""Robotic loader arm, in the Pirate Nation mecha style.

An industrial arm in hazard orange: a tapered riveted base bolted to the
floor, a turret drum with a shoulder block, and two thick links (true
slopes) joined by steel hub joints, with hazard stripes at the joints and
a copper hydraulic line. A steel wrist carries an oversized three-finger
claw with hooked tips. On `idle` it hums with a slow sway; on `active` it
turns, reaches down, pinches the claw and lifts back. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, box, coords, edges, front, hazard, keys, light_top, ngon_y, octo, plan, plate_facets, quad, side, wave
from pnshapes import disc

S = (40, 40, 44)
CX, CZ = 20, 26
SH = (13.0, CZ)  # shoulder (y, z)
EL = (31.0, CZ - 7)  # elbow
WR = (23.0, CZ - 18)  # wrist


def base() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    b = plan(g, octo(CX, CZ, 10, 10, 3.5), 0, 4, "steel", 5, top=octo(CX, CZ, 8.5, 8.5, 3))
    plate_facets(g, [g.solids[-1]], "steel", 5, size=(8, 5), seed=1)
    band(g, b, 1, 0, 1, "steel", 3)
    for bx, bz in ((CX - 7, CZ - 7), (CX + 6, CZ - 7), (CX - 7, CZ + 6), (CX + 6, CZ + 6)):
        box(g, bx, 4, bz, bx + 1, 5, bz + 1, "gold", 6)  # bolts
    return g


def turret() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    drum = ngon_y(g, CX, CZ, 6.5, 4, 9, "orange", 6)
    band(g, drum, 1, 4, 5, "steel", 4)
    band(g, drum, 1, 8, 9, "orange", 4)
    blk = box(g, CX - 5, 9, CZ - 4, CX + 5, 15, CZ + 5, "orange", 6)
    P.flat(g, edges(blk), "orange", 4)
    hazard(g, blk & (Y > 13.5), period=4, a=("orange", 6), b=("steel", 3), frame="top")
    joint = disc(g, "x", SH[0], SH[1], 4.5, CX - 6, CX + 6, "steel", 5)
    P.flat(g, joint & ((X < CX - 5) | (X > CX + 5)) & (np.hypot(Y - SH[0], Z - SH[1]) < 2), "gold", 6)
    # a copper hydraulic line on the side
    box(g, CX + 5, 6, CZ + 2, CX + 7, 12, CZ + 4, "rust", 6)
    return g


def upper() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    link = side(g, quad(SH, EL, 3.6, 3.0, cap=0.5), CX - 3.5, CX + 3.5, "orange", 6)
    P.flat(g, link, "orange", 6)
    P.flat(g, link & (np.abs(X - CX) > 2.6), "orange", 5)
    stripe = link & (np.hypot(Y - SH[0], Z - SH[1]) < 7.5) & (np.hypot(Y - SH[0], Z - SH[1]) > 5.5)
    P.flat(g, stripe, "steel", 4)
    light_top(g, link, "orange", 7)
    joint = disc(g, "x", EL[0], EL[1], 3.8, CX - 5, CX + 5, "steel", 5)
    P.flat(g, joint & ((X < CX - 4) | (X > CX + 4)) & (np.hypot(Y - EL[0], Z - EL[1]) < 1.6), "gold", 6)
    # copper line along the link
    line = side(g, quad((SH[0] + 2, SH[1] + 3.5), (EL[0] + 1, EL[1] + 3.5), 0.9), CX + 3.5, CX + 5, "rust", 6)
    del line
    return g


def fore() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    link = side(g, quad(EL, WR, 3.0, 2.4, cap=0.4), CX - 3, CX + 3, "orange", 6)
    P.flat(g, link, "orange", 6)
    P.flat(g, link & (np.abs(X - CX) > 2.1), "orange", 5)
    light_top(g, link, "orange", 7)
    stripe = link & (np.hypot(Y - WR[0], Z - WR[1]) < 6) & (np.hypot(Y - WR[0], Z - WR[1]) > 4)
    P.flat(g, stripe, "steel", 4)
    return g


def claw() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    wy, wz = WR
    wrist = disc(g, "x", wy, wz, 3.2, CX - 4, CX + 4, "steel", 5)
    hub = box(g, CX - 4, wy - 5, wz - 3, CX + 4, wy - 2, wz + 3, "steel", 4)
    P.flat(g, edges(hub), "steel", 3)
    fingers = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):  # left and right fingers, hooked inward
        fingers |= front(g, quad((CX + s * 2.5, wy - 4), (CX + s * 6.5, wy - 11), 1.9, 1.6), wz - 2, wz + 2, "steel", 6)
        fingers |= front(g, quad((CX + s * 6.5, wy - 11), (CX + s * 2.2, wy - 15), 1.6, 1.0, cap=0.9), wz - 2, wz + 2, "steel", 6)
    fingers |= side(g, quad((wy - 4, wz + 2), (wy - 11, wz + 6), 1.9, 1.6), CX - 2, CX + 2, "steel", 6)
    fingers |= side(g, quad((wy - 11, wz + 6), (wy - 15, wz + 2), 1.6, 1.0, cap=0.9), CX - 2, CX + 2, "steel", 6)
    P.flat(g, fingers, "steel", 6)
    P.flat(g, fingers & (Y < wy - 12), "orange", 6)  # orange tips
    del wrist
    return g


def build():
    rig = Rig()
    rig.add("robot-arm", base(), (CX, 0, CZ))
    rig.add("turret", turret(), (CX, 4, CZ), "robot-arm")
    rig.add("upper", upper(), (CX, SH[0], SH[1]), "turret")
    rig.add("fore", fore(), (CX, EL[0], EL[1]), "upper")
    rig.add("claw", claw(), (CX, WR[0], WR[1]), "fore")
    z = (0.0, 0.0, 0.0)
    one = (1.0, 1.0, 1.0)
    idle = {"turret": {"rot": wave(4.0, "y", 8)}, "upper": {"rot": wave(4.0, "x", 3, phase=0.8)},
            "fore": {"rot": wave(4.0, "x", 4, phase=1.6)}, "claw": {"rot": wave(4.0, "x", 6, phase=2.4)}}
    active = {"turret": {"rot": keys((0, z), (0.6, (0, 50, 0)), (1.8, (0, 50, 0)), (2.4, (0, -20, 0)), (3.2, z))},
              "upper": {"rot": keys((0, z), (0.6, (-6, 0, 0)), (1.0, (-18, 0, 0)), (1.6, (-18, 0, 0)), (2.2, (4, 0, 0)), (3.2, z))},
              "fore": {"rot": keys((0, z), (0.6, (4, 0, 0)), (1.0, (-22, 0, 0)), (1.6, (-22, 0, 0)), (2.2, (6, 0, 0)), (3.2, z))},
              "claw": {"rot": keys((0, z), (1.0, (20, 0, 0)), (1.6, (20, 0, 0)), (2.2, z), (3.2, z)),
                       "scale": keys((0, one), (1.0, one), (1.2, (0.65, 1, 1)), (2.6, (0.65, 1, 1)), (2.9, one), (3.2, one))}}
    return asset("animated-props", "robotic-arm", "Robotic Loader Arm", rig.root, clips=[Clip("idle", idle), Clip("active", active)])
