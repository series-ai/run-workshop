"""Cottage spinning wheel in the Pirate Nation style.

A Saxony spinning wheel, about hip high to a person. A planked oak stock
stands on three splayed legs with a treadle board between the front
legs. Two uprights hold the axle of a spoked wheel 16 across, with a dark
rim, a gold-banded tyre and a gold hub. A red drive band runs from the
wheel to the whorl of the flyer. Two small maidens on the other end of
the stock hold the flyer: a horseshoe of oak arms with gold hooks round a
bobbin wound with cream wool. A distaff behind the flyer carries a fluff
of cream wool tied with a red ribbon, and a small three-legged stool for
the spinner, about 10 high, stands in front (rule K3: the wheel, the
flyer and the wool say "spinning wheel"). Detail is paint (rule S1).
About 28 wide, 29 tall and 19 deep. Faces -Z.
Clips: idle (the wheel turns slowly), spin (the wheel turns fast and the
flyer whirls).
"""
import math

import numpy as np

import paint as P
import pnshapes as S_
from _life import asset, coords, rig
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket, turn

S = (32, 32, 22)
CZ = 14.0  # the wheel plane (z centre)
STOCK = (8, 11)  # the stock y
SX = (3, 28)  # the stock x
AX, AY = 10.0, 19.5  # the wheel axle (x, y)
WR = 8.0  # the wheel flat radius
FY = 16.0  # the flyer axis height
MX = ((20, 22), (26, 28))  # the two maidens in x
WH = (17.5, 19.0)  # the whorl x
DIS = ((27.0, 11.0), (29.0, 23.0))  # the distaff foot and head (x, y)


def frame() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(v).astype(np.int64) for v in (X, Y, Z))

    # the stock: a thick planked oak board with a dark frame
    st = box(g, SX[0], STOCK[0], CZ - 4, SX[1], STOCK[1], CZ + 4, "wood", 5)
    P.planks(g, st, "wood", 5, width=3, across="x", length=(24, 26), nails=True, seed=1)
    P.flat(g, edges(st), "darkwood", 3)
    P.flat(g, st & (Yi == STOCK[1] - 1) & (Xi % 6 == 0), "wood", 3)

    # three splayed legs (true slopes): two at the wheel end, one at the flyer end
    for (x0, x1), (z0, z1) in (((6.0, 3.5), (CZ - 4, CZ - 2)), ((6.0, 3.5), (CZ + 2, CZ + 4)), ((25.0, 27.5), (CZ - 1, CZ + 1))):
        g.prism("z", [(x0 - 1.2, STOCK[0] + 0.5), (x0 + 1.2, STOCK[0] + 0.5), (x1 + 1.2, 0.0), (x1 - 1.2, 0.0)], z0, z1, C("darkwood", 4))
        lg = S_.last(g)
        P.flat(g, lg, "darkwood", 4)
        P.flat(g, lg & (Y < 2), "darkwood", 2)
        P.flat(g, lg & (np.abs(Y - 4.5) < 0.6), "gold", 4)  # a gold ring on each leg
    # the treadle board between the front legs, resting on the floor
    tr = box(g, 4, 0, CZ - 2, 14, 1, CZ + 2, "wood", 4)
    P.planks(g, tr, "wood", 4, width=2, across="x", nails=False, seed=2)
    P.flat(g, edges(tr), "darkwood", 2)

    # the two wheel uprights, with a gold cap, and the iron axle through them
    for z0 in (CZ - 4, CZ + 2):
        up = box(g, AX - 1.5, STOCK[1], z0, AX + 1.5, AY + 3, z0 + 2, "wood", 4)
        P.planks(g, up, "wood", 4, width=3, across="x", nails=False, seed=3)
        P.flat(g, edges(up), "darkwood", 2)
        P.flat(g, up & (Yi >= int(AY) + 2), "gold", 5)
    ax = S_.disc(g, "z", AX, AY, 0.9, CZ - 4.5, CZ + 4.5, "iron", 4, n=6)
    P.flat(g, ax, "iron", 4)

    # the two maidens, with turned gold knobs
    for x0, x1 in MX:
        md = box(g, x0, STOCK[1], CZ - 1, x1, FY + 3, CZ + 1, "wood", 4)
        P.planks(g, md, "wood", 4, width=2, across="x", nails=False, seed=x0)
        P.flat(g, edges(md), "darkwood", 2)
        kn = S_.disc(g, "y", (x0 + x1) / 2, CZ, 1.5, FY + 3, FY + 5, "gold", 5, n=6)
        P.flat(g, kn, "gold", 5)
        P.flat(g, kn & (Y > FY + 4), "gold", 6)

    # the red drive band, from the wheel rim to the whorl (top and bottom runs)
    for wy, fy in ((AY + WR - 0.5, FY + 1.3), (AY - WR + 0.5, FY - 1.3)):
        bd = S_.bar(g, "z", (AX, wy), ((WH[0] + WH[1]) / 2, fy), 0.9, CZ - 0.5, CZ + 0.5, "red", 5)
        P.flat(g, bd, "red", 5)

    # the distaff: a slim pole with a fluff of cream wool tied in red
    ds = S_.bar(g, "z", DIS[0], DIS[1], 1.4, CZ + 3, CZ + 4.4, "darkwood", 4)
    P.flat(g, ds, "darkwood", 4)
    # the wool: a soft rounded fluff (three stacked frusta), tied at its foot
    wx, wz, wy = DIS[1][0], CZ + 3.7, DIS[1][1]
    wool = S_.cone(g, "y", wx, wz, 1.4, wy - 2.0, wy + 1.0, "bone", 6, n=8, r_top=3.0)
    wool |= S_.cone(g, "y", wx, wz, 3.0, wy + 1.0, wy + 4.0, "bone", 6, n=8, r_top=2.6)
    wool |= S_.cone(g, "y", wx, wz, 2.6, wy + 4.0, wy + 6.0, "bone", 6, n=8, r_top=1.2)
    ang = np.arctan2(Z - wz, X - wx)
    P.flat(g, wool, "bone", 6)
    P.flat(g, wool & ((np.floor((ang + math.pi) / (2 * math.pi) * 8 + Y * 0.5).astype(np.int64) % 3) == 0), "bone", 5)  # soft spiral streaks
    P.flat(g, wool & (Y > wy + 4.5), "bone", 7)
    P.flat(g, wool & (Y < wy - 0.8), "red", 4)  # the ribbon that ties it on
    P.flat(g, wool & (Y < wy - 1.4), "red", 5)

    # the spinner's stool: a round planked seat on three legs, about 10 high
    cx, cz = 14.0, 4.0
    for lx, lz in ((cx - 2.5, cz - 1.5), (cx + 2.5, cz - 1.5), (cx, cz + 2.0)):
        sl = box(g, lx - 0.75, 0, lz - 0.75, lx + 0.75, 9, lz + 0.75, "darkwood", 4)
        P.flat(g, sl, "darkwood", 4)
        P.flat(g, sl & (Yi == 4), "darkwood", 2)
    seat = S_.disc(g, "y", cx, cz, 3.6, 8, 10, "wood", 5, n=8)
    P.planks(g, seat, "wood", 5, width=2, across="y", frame="top", nails=False, seed=5)
    P.flat(g, seat & (Y < 9), "darkwood", 3)
    P.flat(g, seat & (Y > 9) & (np.hypot(X - cx, Z - cz) > 2.8), "wood", 3)
    return g


def wheel() -> Grid:
    """The spoked drive wheel, on its own grid so it can turn."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    w = S_.wheel(g, "z", AX, AY - WR, WR, CZ - 1, CZ + 1, n=12, spokes=8, gaps=True,
                 tyre=("darkwood", 3), rim=("wood", 5), spoke=("wood", 6), hub=("gold", 4), rim_w=2.0, hub_r=1.8, hub_out=1.0)
    rr = S_.radial(g, "z", AX, AY)
    P.flat(g, w["mask"] & (np.abs(rr - (WR - 1.6)) < 0.5), "gold", 5)  # a gold band inside the tyre
    P.flat(g, w["mask"] & (rr < 3.0) & (rr > 1.8), "wood", 4)
    return g


def flyer() -> Grid:
    """The flyer: the whorl, the orifice shaft, the wool bobbin and the arms."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    sh = S_.disc(g, "x", FY, CZ, 0.8, 16.0, MX[1][1], "iron", 5, n=6)
    P.flat(g, sh, "iron", 5)
    wh = S_.disc(g, "x", FY, CZ, 1.6, WH[0], WH[1], "gold", 4, n=8)
    P.flat(g, wh, "gold", 4)
    P.flat(g, wh & (S_.radial(g, "x", FY, CZ) > 1.2), "gold", 3)
    bob = S_.disc(g, "x", FY, CZ, 1.7, MX[0][1] + 0.5, MX[1][0] - 1.0, "bone", 6, n=8)
    P.flat(g, bob, "bone", 6)
    P.flat(g, bob & ((np.floor(X).astype(np.int64) % 2) == 0), "bone", 5)
    # the horseshoe arms with gold hooks
    for dz in (-2.6, 2.6):
        arm = box(g, MX[0][1] + 0.5, FY - 0.5, CZ + dz - 0.5, MX[1][0] - 0.5, FY + 0.5, CZ + dz + 0.5, "wood", 5)
        P.flat(g, arm, "wood", 5)
        P.flat(g, arm & ((np.floor(X).astype(np.int64) % 2) == 1), "gold", 6)
    bridge = box(g, MX[0][1] + 0.0, FY - 0.5, CZ - 3.1, MX[0][1] + 1.0, FY + 0.5, CZ + 3.1, "wood", 4)
    P.flat(g, bridge, "wood", 4)
    return g


def build():
    fr, wh, fl = frame(), wheel(), flyer()
    root, to_root = rig([("spinning-wheel", fr, None, None), ("wheel", wh, (AX, AY, CZ), None),
                         ("flyer", fl, (22.0, FY, CZ), None)])
    idle = {"wheel": {"rot": turn(6.0, "z", 60.0)}, "flyer": {"rot": turn(6.0, "x", 120.0)}}
    spin = {"wheel": {"rot": turn(2.0, "z", 180.0)}, "flyer": {"rot": turn(2.0, "x", 720.0)}}
    return asset("animated-props", "spinning-wheel", "Spinning Wheel", root,
                 clips=[Clip("idle", idle), Clip("spin", spin)],
                 sockets=[Socket("socket-function", at=to_root((24.0, FY + 2.0, CZ)), parent="flyer")])
