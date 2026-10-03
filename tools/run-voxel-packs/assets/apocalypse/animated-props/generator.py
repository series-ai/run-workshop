"""Diesel generator on skids, in the Pirate Nation style.

A hazard-yellow cage frame with slanted braces (true slopes) on steel
skids holds a chunky rust-red engine with a tall exhaust stack and a rain
flap, a fat fuel tank and a control panel with big dials. The radiator fan
on the +x end spins; the engine rattles on `idle` and shakes hard with the
fan racing on `active`. Plates, hazard stripes, dials and labels are paint.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, keys, make
from pnkit import box, edges
from voxgrid import Clip, Grid, turn

SZ = (42, 38, 28)
X0, X1, Z0, Z1 = 3, 37, 3, 24
Y0, TOP = 3, 27
FAN = (37.0, 14.0, 13.5)


def frame() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    skids = np.zeros(g.shape, dtype=bool)
    for z0 in (Z0 + 1, Z1 - 4):
        skids |= box(g, X0 + 2, 0, z0, X1 - 2, Y0, z0 + 3, "steel", 4)
        for x0, s in ((X0 + 2, -1), (X1 - 2, 1)):
            skids |= S.bar(g, "z", (x0, Y0 - 0.9), (x0 + s * 3, 1.5), 2.2, z0, z0 + 3, "steel", 4)
    P.outline(g, skids, "steel", 3)
    cage = np.zeros(g.shape, dtype=bool)
    for cx, cz in ((X0, Z0), (X1 - 3, Z0), (X0, Z1 - 3), (X1 - 3, Z1 - 3)):
        cage |= box(g, cx, Y0, cz, cx + 3, TOP, cz + 3, "gold", 5)
    for z0 in (Z0, Z1 - 3):
        cage |= box(g, X0, TOP - 3, z0, X1, TOP, z0 + 3, "gold", 5)
        cage |= box(g, X0, Y0, z0, X1, Y0 + 3, z0 + 3, "gold", 5)
    for x0 in (X0, X1 - 3):
        cage |= box(g, x0, TOP - 3, Z0, x0 + 3, TOP, Z1, "gold", 5)
    P.flat(g, edges(cage), "gold", 4)
    PP.hazard(g, cage & (Y < Y0 + 3), period=6, a=("gold", 5), b=("darkwood", 4))
    # slanted braces on the back and the -x end
    S.bar(g, "z", (X0 + 2, Y0 + 2), (X0 + 17, TOP - 2), 2.6, Z1 - 2, Z1, "gold", 4)
    S.bar(g, "x", (Y0 + 2, Z0 + 2), (TOP - 2, Z1 - 2), 2.6, X0, X0 + 2, "gold", 4)
    # fuel tank low at the back, a control panel on the front
    tank = S.disc(g, "x", Y0 + 5.5, Z1 - 8.5, 5.0, X0 + 3, X1 - 12, "red", 5, n=8)
    P.flat(g, tank & (np.abs(X - (X0 + 8)) < 1.0), "red", 3)
    cap = S.disc(g, "y", X0 + 12, Z1 - 8.5, 1.6, Y0 + 10, Y0 + 12, "steel", 6, n=8)
    del cap
    panel = box(g, X0 + 18, Y0 + 3, Z0 - 1, X0 + 29, Y0 + 16, Z0 + 3, "steel", 5)
    P.outline(g, panel, "steel", 3, normal="z")
    for k, dx in enumerate((X0 + 20.5, X0 + 26.5)):
        dial = S.disc(g, "z", dx, Y0 + 12, 2.2, Z0 - 2, Z0 - 1, "bone", 7, n=8)
        P.flat(g, dial & (np.abs(X - dx - (0.6 if k else -0.6)) < 0.7) & (Y > Y0 + 12), "red", 4)
    btn = S.disc(g, "z", X0 + 23.5, Y0 + 6.5, 1.6, Z0 - 2, Z0 - 1, "red", 5, n=8)
    del btn
    G.text(g, "-z", Z0 - 1, X0 + 20, Y0 + 3, "ON", "gold", 6)
    return g


def engine() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    block = box(g, X0 + 6, Y0 + 3, Z0 + 5, X1 - 6, Y0 + 15, Z1 - 5, "rust", 5)
    P.plates(g, block, "rust", 5, size=(7, 5), seed=5)
    heads = box(g, X0 + 8, Y0 + 15, Z0 + 7, X1 - 8, Y0 + 19, Z1 - 7, "steel", 5)
    P.flat(g, heads & (np.floor(X) % 3 == 0), "steel", 3)
    rad = box(g, X1 - 7, Y0 + 3, Z0 + 4, X1 - 1, Y0 + 19, Z1 - 4, "steel", 4)
    P.flat(g, rad & (np.floor(Y) % 2 == 0), "steel", 3)
    P.outline(g, rad, "steel", 2)
    # the exhaust stack with a rain flap
    stack = S.disc(g, "y", X0 + 9.5, Z1 - 6.5, 1.8, Y0 + 15, 35, "steel", 5, n=8)
    P.flat(g, stack & (np.floor(Y) % 5 == 0), "steel", 3)
    P.flat(g, stack & (Y > 32), "darkwood", 5)
    S.bar(g, "z", (X0 + 7.5, 35.2), (X0 + 12, 36.8), 1.2, Z1 - 8.5, Z1 - 4.5, "steel", 6)
    return g


def fan() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    ring = S.disc(g, "x", FAN[1], FAN[2], 6.5, FAN[0] - 1, FAN[0], "steel", 3, n=8)
    blades = S.gear(g, "x", FAN[1], FAN[2], 2.0, FAN[0], FAN[0] + 1.5, teeth=4, depth=3.8, ramp="gold", base=6, turn=0.3)
    del ring, blades
    return g


def build():
    rig = Rig("generator", (20, 0, 13.5), frame())
    rig.add("engine", engine(), (20.0, Y0 + 3, 13.5))
    rig.add("fan", fan(), FAN, parent="engine")
    # eight jolts, then back to the first, so the loop closes
    rattle = lambda a, s: [(k * s, (a * ((k % 8 * 7) % 3 - 1) * 0.5, a * (k % 8 % 2), a * ((k % 8 * 5) % 3 - 1) * 0.5)) for k in range(9)]  # noqa: E731
    idle = {"engine": {"loc": keys(*rattle(0.25, 0.1)), "rot": keys((0, (0, 0, 0)), (0.4, (0, 0, 0.8)), (0.8, (0, 0, 0)))},
            "fan": {"rot": turn(0.8, "x", 450)}}
    active = {"engine": {"loc": keys(*rattle(0.6, 0.06)), "rot": keys((0, (0, 0, 0)), (0.12, (1.2, 0, -1.5)), (0.24, (-1.2, 0, 1.5)), (0.36, (0.8, 0, -1)), (0.48, (0, 0, 0)))},
              "fan": {"rot": turn(0.48, "x", 1500)}}
    return make("animated-props", "generator", "Diesel Generator", rig.root,
                clips=[Clip("idle", idle), Clip("active", active)],
                sockets=[rig.socket("socket-exhaust", (X0 + 9.5, 36, Z1 - 6.5), parent="engine")],
                pfx=[fx("rvx-apocalypse-exhaust-smoke", "socket-exhaust", "idle", size=16)])
