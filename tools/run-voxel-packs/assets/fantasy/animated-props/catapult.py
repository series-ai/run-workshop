"""Siege catapult in the Pirate Nation style.

A compact caricature mangonel: a thick oak bed on four big octagonal spoked
wheels, two A-frame uprights (true diagonal legs) carrying a padded stop
beam, a fat rope torsion skein round the arm axle and one oversized
throwing arm (a tapered true slope) ending in a big sling bucket loaded
with a stone ball (rule K3: the arm and the bucket say "catapult"). Iron
straps, rope bindings and planks are paint; a royal blue pennant flies from
an upright. About 34 wide and 38 long.
Clips: idle (the arm trembles under tension), attack (the arm whips up
into the stop beam, the machine jolts back on its wheels, the arm winds
back down). Faces -Z (the shot flies forward).
"""
import numpy as np

import paint as P
import pnshapes as S_
from _life import asset, coords, keys, pfx, plan, rig
from pnkit import box, edges, pennant
from voxgrid import C, Clip, Grid, Socket

S = (36, 44, 44)
CX = 18.0
RAILX = (CX - 10, CX - 7, CX + 7, CX + 10)  # rail x0, x1 (left) and x0, x1 (right)
BED = (7, 11)  # rail y
BZ = (3, 39)  # bed z
WR = 6.0  # wheel flat radius
WZ = (10.0, 32.0)  # axle z
WX = ((CX - 14, CX - 11), (CX + 11, CX + 14))  # wheel x ranges
PIV = (CX, 12.0, 14.0)  # arm pivot (y, z at index 1, 2)
TIP = (17.0, 33.0)  # arm end (y, z)
APEX = (27.0, 11.0)  # upright apex (y, z)


def frame() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    wood = np.zeros(S, dtype=bool)
    # side rails and cross beams (thick oak), a planked deck between them
    for x0, x1 in ((RAILX[0], RAILX[1]), (RAILX[2], RAILX[3])):
        wood |= box(g, x0, BED[0], BZ[0], x1, BED[1], BZ[1], "wood", 5)
    for z0, z1 in ((BZ[0], BZ[0] + 3), (BZ[1] - 4, BZ[1])):
        wood |= box(g, RAILX[1], BED[0], z0, RAILX[2], BED[1] + 1, z1, "wood", 5)
    deck = box(g, RAILX[1], BED[0], BZ[0] + 3, RAILX[2], BED[0] + 2, BZ[1] - 4, "wood", 5)
    P.planks(g, deck, "wood", 5, width=3, across="x", frame="top", seed=1)
    P.planks(g, wood, "wood", 5, width=4, across="y", length=(10, 14), seed=2)
    P.flat(g, edges(wood), "darkwood", 3)
    # iron straps over the rail ends and the corners
    for z0 in (BZ[0] + 1, BZ[1] - 3):
        P.flat(g, wood & (Z > z0) & (Z < z0 + 1.5), "iron", 5)
    # axles under the rails
    for wz in WZ:
        ax = box(g, WX[0][1] - 1, WR - 1, wz - 1, WX[1][0] + 1, WR + 1, wz + 1, "darkwood", 3)
        P.flat(g, ax, "darkwood", 3)
    # A-frame uprights on both rails (true diagonal legs) and the stop beam
    legs = np.zeros(S, dtype=bool)
    for x0, x1 in ((RAILX[0], RAILX[1]), (RAILX[2], RAILX[3])):
        for fz in (BZ[0] + 1.5, PIV[2] + 9.0):
            legs |= S_.bar(g, "x", (BED[1] - 0.5, fz), (APEX[0], APEX[1]), 3.0, int(x0), int(x1), "darkwood", 4)
    P.flat(g, legs, "darkwood", 4)
    P.flat(g, legs & (Y > APEX[0] - 3), "darkwood", 3)
    beam = box(g, RAILX[0] - 1, APEX[0] - 3, APEX[1] - 2, RAILX[3] + 1, APEX[0] + 1, APEX[1] + 2, "wood", 4)
    P.planks(g, beam, "wood", 4, width=2, across="y", seed=3)
    P.flat(g, edges(beam), "darkwood", 3)
    pad = box(g, CX - 4, APEX[0] - 3, APEX[1] + 2, CX + 4, APEX[0], APEX[1] + 4, "red", 4)
    P.flat(g, pad & (np.floor(X).astype(int) % 3 == 0), "red", 3)
    P.flat(g, pad & (Y > APEX[0] - 1), "red", 5)
    # the rope torsion skein round the arm axle
    sk = S_.disc(g, "x", PIV[1], PIV[2], 3.0, int(RAILX[1]), int(CX - 2), "sand", 5)
    sk |= S_.disc(g, "x", PIV[1], PIV[2], 3.0, int(CX + 2), int(RAILX[2]), "sand", 5)
    P.flat(g, sk & (np.floor(X + Y).astype(int) % 3 == 0), "sand", 4)
    for x0, x1 in ((RAILX[0] - 1, RAILX[0]), (RAILX[3], RAILX[3] + 1)):
        hub = S_.disc(g, "x", PIV[1], PIV[2], 2.5, int(x0), int(x1), "gold", 5)
        P.flat(g, hub, "gold", 5)
    # a rope winch drum at the back
    wn = S_.disc(g, "x", BED[1] + 2.0, BZ[1] - 2.0, 2.0, int(RAILX[1]), int(RAILX[2]), "wood", 5)
    P.flat(g, wn & (np.abs(X - CX) < 3), "sand", 5)
    # a royal blue pennant on the right upright
    pennant(g, int(RAILX[3] - 2), APEX[0] + 1, int(APEX[1] - 1), 11, 8, "blue", 4)
    P.grime(g, wood, height=2, seed=4)
    return g


def arm() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = S_.bar(g, "x", (PIV[1], PIV[2] - 2.0), TIP, 4.0, int(CX - 2), int(CX + 2), "wood", 5)
    P.planks(g, m, "wood", 5, width=4, across="z", frame=((1, 0, 0), (0, -(TIP[0] - PIV[1]), -(TIP[1] - PIV[2]))), nails=False, seed=5)
    along = (Z - PIV[2]) / (TIP[1] - PIV[2])
    for t in (0.35, 0.6):  # rope bindings
        P.flat(g, m & (np.abs(along - t) < 0.05), "sand", 5)
    P.flat(g, m & (along < 0.12), "iron", 5)
    # the big sling bucket and its stone ball
    by, bz = TIP[0] - 3.0, TIP[1] + 1.0
    cup = plan(g, S_.flat_ngon(CX + 0.25, bz, 3.4, 8), by, by + 5, "wood", 4, top=S_.flat_ngon(CX + 0.25, bz, 5.2, 8))
    ang = np.floor((np.arctan2(Z - bz, X - CX - 0.25) + np.pi) / (2 * np.pi) * 16).astype(int)
    P._paint(g, cup, "wood", 4 + np.array([0, -1, 0, 1])[ang % 4])
    P.flat(g, cup & (Y > by + 4), "iron", 5)
    P.flat(g, cup & (Y > by + 2) & (Y < by + 3), "iron", 4)
    ball = plan(g, S_.flat_ngon(CX + 0.25, bz, 3.4, 8), by + 4, by + 6, "stone", 5, top=S_.flat_ngon(CX + 0.25, bz, 4.2, 8))
    ball |= plan(g, S_.flat_ngon(CX + 0.25, bz, 4.2, 8), by + 6, by + 9, "stone", 5, top=S_.flat_ngon(CX + 0.25, bz, 2.0, 8))
    P.flat(g, ball, "stone", 5)
    P.flat(g, ball & (Y > by + 8), "stone", 6)
    P.flat(g, ball & (np.abs(X - CX - 1.5) < 0.8) & (np.abs(Z - bz + 1.5) < 0.8), "stone", 3)
    return g


def wheel(k: int) -> tuple[Grid, tuple[float, float, float]]:
    g = Grid(*S)
    x0, x1 = WX[k % 2]
    info = S_.wheel(g, "x", WZ[k // 2], 0.0, WR, x0, x1, spokes=6, tyre=("iron", 5), rim=("darkwood", 4), spoke=("wood", 5))
    return g, info["centre"]


def build():
    f, a = frame(), arm()
    parts = [("catapult", f, None, None), ("arm", a, (CX, PIV[1], PIV[2]), None)]
    for k in range(4):
        wg, c = wheel(k)
        parts.append((f"wheel-{k}", wg, c, None))
    root, to_root = rig(parts)
    idle = {"arm": {"rot": keys((0, 0, 0, 0), (0.8, -2, 0, 0), (1.0, 0, 0, 0), (1.2, -1.5, 0, 0), (1.4, 0, 0, 0), (2.4, 0, 0, 0))}}
    attack = {"arm": {"rot": keys((0, 0, 0, 0), (0.12, 5, 0, 0), (0.3, -95, 0, 0), (0.38, -84, 0, 0), (0.46, -90, 0, 0), (1.4, -45, 0, 0), (2.0, 0, 0, 0))},
              "catapult": {"loc": keys((0, 0, 0, 0), (0.3, 0, 0, 0), (0.5, 0, 0, 1.5), (0.9, 0, 0, 1.5), (2.0, 0, 0, 0))}}
    for k in range(4):
        attack[f"wheel-{k}"] = {"rot": keys((0, 0, 0, 0), (0.3, 0, 0, 0), (0.5, 14, 0, 0), (0.9, 14, 0, 0), (2.0, 0, 0, 0))}
    payload = to_root((CX, TIP[0] + 5.0, TIP[1] + 1.0))
    return asset("animated-props", "catapult", "Siege Catapult", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False)],
                 sockets=[Socket("socket-payload", at=payload, parent="arm")],
                 fx=[pfx("rvx-fantasy-dust-slam", "socket-payload", "clip:attack", size=26, at=0.28)])
