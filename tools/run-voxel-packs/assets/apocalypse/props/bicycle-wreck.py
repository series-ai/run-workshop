"""Abandoned bicycle, in the Pirate Nation style.

One readable icon in profile (rule F6): two chunky wheels built as solid
discs with the spokes PAINTED on the web (rule S1), a dark tread band and a
hazard-yellow hub, carried on a signal-red frame of thick tubes that are
all true diagonals (rules F2, F3). The front wheel has buckled in the fork
and sits over at an angle, and the saddle has split to show its stuffing
(rule F5). A weathered crate rides the rear rack with a zombie-teal pannier
slung beside it, and the machine stands on its own kickstand, so nothing
floats beside the prop. Chipped paint, rust at the joints, grime and the
crate boards are paint, grouped on edges and joints (rules S3, S4).
"""
import numpy as np

import paint as P
from _props import asset, bevel, child, chips, crate, root, rust_runs
from pnkit import box, edges
from pnshapes import bar, coords, disc, wheel
from voxgrid import Grid

GW, GH, GD = 22, 30, 40
WX0, WX1 = 9, 12  # the wheel and frame plane
RW, FW = 8.0, 8.0  # wheel radii
RZ, FZ = 30.0, 8.0  # rear and front hub z
HUB = ("gold", 5)
TYRE = ("steel", 2)
RIM = ("steel", 4)
SPOKE = ("steel", 6)


def _wheel(g: Grid, cz: float, r: float, x0: int, x1: int, seed: int) -> dict:
    w = wheel(g, "x", cz, 0.5, r, x0, x1, n=8, spokes=5, gaps=True,
              tyre=TYRE, rim=RIM, spoke=SPOKE, hub=HUB, rim_w=2.2, hub_r=2.4)
    X, Y, Z = coords(g)
    d = np.hypot(Y - (0.5 + r), Z - cz)
    P.flat(g, w["mask"] & (d > r - 2.3), "steel", 2)  # one calm tyre band
    P.flat(g, w["mask"] & (d > r - 2.3) & (d < r - 1.3), "steel", 4)  # the metal rim inside it
    chips(g, w["mask"], ((x0, 0.5 + r * 0.4, cz - r + 1.5, 2.6),), "rust", 5, seed=seed)
    return w


def front_wheel() -> Grid:
    g = Grid(4, 19, 19)
    X, Y, Z = coords(g)
    w = wheel(g, "x", 9.0, 0.6, FW, 0, 3, n=8, spokes=5, gaps=True,
              tyre=TYRE, rim=RIM, spoke=SPOKE, hub=HUB, rim_w=2.2, hub_r=2.4)
    d = np.hypot(Y - (0.6 + FW), Z - 9.0)
    P.flat(g, w["mask"] & (d > FW - 2.3), "steel", 2)
    P.flat(g, w["mask"] & (d > FW - 2.3) & (d < FW - 1.3), "steel", 4)
    # the buckled quarter: the rim is dented in and two spokes have gone
    bend = w["mask"] & (Z > 12.5) & (Y > 10.0)
    P.flat(g, bend, "steel", 3)
    P.flat(g, bend & (d > FW - 2.9), "steel", 2)
    chips(g, w["mask"], ((0, 14.0, 13.0, 2.8),), "rust", 5, seed=21)
    return g


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    _wheel(g, RZ, RW, WX0, WX1, seed=11)
    # the frame: six thick tubes, every one a true diagonal, in the (y, z) plane
    HUBR, SEAT, BB, HEAD, HUBF = (0.5 + RW, RZ), (21.5, 22.0), (5.5, 20.0), (19.5, 11.0), (0.6 + FW, FZ)
    tubes = []
    for p0, p1, t in ((BB, HUBR, 3.0), (SEAT, HUBR, 2.6), (BB, SEAT, 3.4), (BB, HEAD, 3.6), (SEAT, HEAD, 3.0), (HEAD, HUBF, 3.0)):
        tubes.append(bar(g, "x", p0, p1, t, WX0, WX1, "red", 5))
    frame = tubes[0]
    for t in tubes[1:]:
        frame |= t
    P.flat(g, frame, "red", 5)
    P.flat(g, frame & (X > WX1 - 1), "red", 6)  # the lit side of every tube
    P.flat(g, frame & (X > WX1 - 2) & (X < WX1 - 1), "red", 5)
    P.flat(g, frame & (X < WX0 + 1), "red", 4)
    stripe = frame & (X > WX1 - 1) & (np.abs((Y - BB[0]) - (Z - BB[1]) * 0.62) < 0.8)
    P.flat(g, stripe, "gold", 6)  # one hazard stripe marks the repaired down tube
    rust_runs(g, frame, ((WX0, BB[0], BB[1], 2.6), (WX1, HEAD[0], HEAD[1], 2.2)), base=5, drip=2, seed=12)
    # the head tube, the bars and their grips
    box(g, WX0 - 1, HEAD[0] - 3, HEAD[1] - 2, WX1 + 1, HEAD[0] + 3, HEAD[1] + 2, "steel", 3)
    bars = box(g, 2, HEAD[0] + 2, HEAD[1] - 2, GW - 2, HEAD[0] + 5, HEAD[1] + 1, "steel", 4)
    P.flat(g, bars & (Y > HEAD[0] + 4), "steel", 6)
    P.flat(g, edges(bars), "steel", 2)
    for gx in (2, GW - 5):
        gr = box(g, gx, HEAD[0] + 2, HEAD[1] - 2, gx + 3, HEAD[0] + 5, HEAD[1] + 1, "darkwood", 4)
        P.flat(g, gr & (Y > HEAD[0] + 4), "darkwood", 5)
    # the split saddle, with its stuffing showing
    sad = bevel(g, "x", SEAT[0] + 1, SEAT[1] - 4, SEAT[0] + 4, SEAT[1] + 5, WX0 - 3, WX1 + 3, "darkwood", 4, ch=1.4)
    P.flat(g, sad & (Y > SEAT[0] + 3), "darkwood", 6)
    P.flat(g, sad & (Y > SEAT[0] + 3) & (np.abs(Z - (SEAT[1] + 1)) < 1.6), "bone", 6)  # the split
    P.flat(g, sad & (Z < SEAT[1] - 2.5), "darkwood", 3)
    # the crank, the chainring and one pedal
    ring = disc(g, "x", BB[0], BB[1], 3.8, WX1, WX1 + 2, "steel", 5)
    rr = np.hypot(Y - BB[0], Z - BB[1])
    P.flat(g, ring & (rr > 2.8), "steel", 7)  # the bright chainring teeth
    P.flat(g, ring & (rr < 1.5), "steel", 3)
    crank = bar(g, "x", (BB[0], BB[1]), (BB[0] - 4.5, BB[1] + 3.0), 2.2, WX1 + 2, WX1 + 4, "steel", 5)
    P.flat(g, crank, "steel", 5)
    ped = box(g, WX1 + 3, BB[0] - 6, BB[1] + 1, WX1 + 7, BB[0] - 4, BB[1] + 5, "darkwood", 4)
    P.flat(g, edges(ped), "darkwood", 2)
    # A single clear chain run links the ring to the rear sprocket.
    for side_x in (WX1 + 1, WX0 - 1):
        chain = bar(g, "x", (BB[0] + 0.5, BB[1] + 1.2), (0.5 + RW - 0.5, RZ - 1.2), 0.9, side_x, side_x + 1.0, "iron", 3)
        P.flat(g, chain, "steel", 2)
    # the rear rack, a weathered crate on it and a teal pannier slung beside
    rack = box(g, WX0 - 4, 18, RZ - 3, WX1 + 4, 20, RZ + 8, "steel", 4)
    P.flat(g, rack & ((np.floor(Z) % 4 == 0) | (np.floor(X) % 4 == 0)), "steel", 6)
    P.flat(g, edges(rack), "steel", 2)
    for sz in (RZ - 2, RZ + 6):  # the rack stays down to the frame
        bar(g, "x", (18.0, sz), (0.5 + RW, RZ), 2.0, WX0, WX1, "steel", 3)
    crate(g, WX0 - 4, 20, int(RZ) - 2, 11, 7, 10, ramp="sand", base=5, frame=("darkwood", 3), seed=13)
    pan = bevel(g, "x", 8.0, RZ - 3.0, 17.0, RZ + 6.0, WX1 + 3, WX1 + 8, "teal", 4, ch=1.6)
    P.flat(g, pan & (Y > 15), "teal", 5)
    P.flat(g, pan & (np.abs(Y - 14.0) < 0.7), "teal", 2)  # the flap line
    P.flat(g, pan & (np.abs(Z - (RZ + 1.5)) < 1.0) & (Y > 13) & (Y < 16), "gold", 5)  # the buckle
    P.flat(g, edges(pan), "teal", 2)
    chips(g, pan, ((WX1 + 8, 10.0, RZ + 4.0, 2.4),), "rust", 5, seed=14)
    # the kickstand, so the machine stands on itself
    ks = bar(g, "z", (WX0 + 1, BB[0] - 1), (WX0 + 7, 1.5), 2.0, int(BB[1]) - 1, int(BB[1]) + 2, "steel", 3)
    P.flat(g, ks & (Y < 2), "steel", 2)
    box(g, WX0 + 5, 0, int(BB[1]) - 2, WX0 + 9, 1, int(BB[1]) + 3, "steel", 3)
    P.grime(g, g.a > 0, height=3, seed=15)
    r = root("bicycle-wreck", g)
    child(r, "front-wheel", front_wheel(), pivot=(1.5, 0.6 + FW, 9.0), at_grid=(10.5, 0.6 + FW, FZ), rot=(0.0, 0.0, 11.0))
    return asset("bicycle-wreck", "Abandoned Bicycle", r)
