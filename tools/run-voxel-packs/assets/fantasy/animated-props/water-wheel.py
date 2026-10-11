"""Mill water wheel in the Pirate Nation style.

A big overshot wheel of oak: two twelve-sided rims joined by twelve bucket
boards (true slopes everywhere), eight thick spokes a side and an iron-ringed
hub, with sky-blue water caught in the buckets on the rising side. It turns
on a log axle in a timber bearing on a coursed stone abutment with a battered
plinth, an arched tail arch and a mossy wet band. A planked flume on two
posts runs down from the top of the wall and tips its water over the crown
(rule K3: the flume and the buckets say "mill"); below, a stone tail race
holds rippling water. Ferns, moss and a mill stone finish it.
Clips: idle (the wheel creeps round), spin (one full turn in 2.4 s).
Effects: mist at the chute and at the splash. About 50 tall. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _life import asset, boulder, coords, grass, rig
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket, turn

SZ = (28, 56, 54)
WX0, WX1 = 3, 11  # the wheel sits between these x
CZ = 27.0  # the wheel axis z
CY = 24.0  # the axle height
R = 18.5  # the rim flat radius
AX = (WX0 + WX1) / 2  # the axle centre x
WALL_X0, WALL_X1 = 12, 25  # the stone pier behind the wheel
WALL_Z0, WALL_Z1 = 5, 49  # the tail race run
PZ0, PZ1 = 18, 37  # the pier footprint in z
WALL_TOP = 36
RACE = 6  # the tail race water surface
FLUME = 44.0  # the flume floor where it tips over the crown


def _mask(g: Grid, start: int) -> np.ndarray:
    return np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])


def mill() -> Grid:
    """The stone pier, the bearing under a red-tiled hood, the flume, the
    sluice and the tail race."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(v).astype(np.int64) for v in (X, Y, Z))
    # the tail race: a low coursed channel with rippling water
    chan = box(g, 0, 0, WALL_Z0, WALL_X0 + 1, RACE + 3, WALL_Z1, "stone", 4)
    P.stone(g, chan, "stone", 4, block=(6, 3), cracks=0.1, seed=1)
    P.flat(g, edges(chan), "stone", 2)
    g.carve((Xi < WALL_X0 - 1) & (Yi >= 2) & (Zi >= WALL_Z0 + 3) & (Zi < WALL_Z1 - 3))
    water = box(g, 0, 2, WALL_Z0 + 3, WALL_X0 - 1, RACE + 1, WALL_Z1 - 3, "sky", 4)
    P.flat(g, water & (Y > RACE), "sky", 4)
    P.flat(g, water & (Y > RACE) & (((Zi + 2 * (Xi // 2)) % 6) < 2), "sky", 5)  # ripples
    P.flat(g, water & (Y > RACE) & (((Zi + 2 * (Xi // 2)) % 6) == 3), "sky", 3)
    P.flat(g, water & (np.abs(Z - CZ) < 5.5) & (Y > RACE), "sky", 7)  # white water under the wheel
    P.flat(g, water & (Y <= RACE), "sky", 2)
    top = chan & (Y > RACE + 2)
    P.stone(g, top, "stone", 5, block=(5, 5), frame="top", seed=15)  # the paved coping
    P.flat(g, top & ((P._hash(Xi // 2, Zi // 3, seed=16) % np.uint64(3)) == 0), "moss", 5)  # moss in the joints
    P.flat(g, chan & (Y > RACE) & (Y <= RACE + 2) & (X < WALL_X0 - 1), "moss", 4)  # the wet lip
    # the pier: a battered plinth, coursed ashlar with a string course and a dark cap
    start = len(g.solids)
    g.prism("y", [(WALL_X0 - 2, PZ0 - 2), (WALL_X1, PZ0 - 2), (WALL_X1, PZ1 + 2), (WALL_X0 - 2, PZ1 + 2)], 0, 8, C("stone", 4),
            top=[(WALL_X0, PZ0), (WALL_X1, PZ0), (WALL_X1, PZ1), (WALL_X0, PZ1)])
    plinth = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 4, block=(7, 3), frame=fr, seed=2))
    P.flat(g, plinth & (Y < 1.5), "stone", 2)
    pier = box(g, WALL_X0, 8, PZ0, WALL_X1, WALL_TOP, PZ1, "stone", 5)
    P.stone(g, pier, "stone", 5, block=(8, 5), cracks=0.09, seed=3)
    P.flat(g, edges(pier), "stone", 3)
    for sy in (18, 28):  # string courses in light sandstone
        P.flat(g, pier & (Y >= sy) & (Y < sy + 2), "sand", 6)
        P.flat(g, pier & (Y >= sy + 1) & (Y < sy + 2), "sand", 4)
    cap = box(g, WALL_X0 - 2, WALL_TOP, PZ0 - 2, WALL_X1, WALL_TOP + 3, PZ1 + 2, "stone", 6)
    P.stone(g, cap, "stone", 6, block=(5, 3), seed=4)
    P.flat(g, cap & (Y > WALL_TOP + 2), "stone", 7)
    P.flat(g, cap & (Y < WALL_TOP + 1), "stone", 3)
    # a plank sluice gate with iron bands and a crank wheel on the front face
    gz = PZ0 - 0.5
    gate = box(g, WALL_X0 + 2, 9, PZ0 - 2, WALL_X1 - 3, 25, PZ0, "wood", 5)
    P.planks(g, gate, "wood", 5, width=3, across="x", length=(16, 18), nails=True, seed=12)
    P.flat(g, edges(gate), "darkwood", 3)
    for by in (12, 21):
        P.flat(g, gate & (Y >= by) & (Y < by + 2), "iron", 4)
        P.flat(g, gate & (Y >= by) & (Y < by + 2) & ((Xi % 4) == 1), "iron", 6)
    g.box(WALL_X0 + 7, 25, PZ0 - 2, WALL_X0 + 9, 32, PZ0, C("iron", 4))  # the screw stem
    cw = S.gear(g, "z", WALL_X0 + 8, 33, 4.0, PZ0 - 3, PZ0 - 1, teeth=8, depth=1.6, ramp="gold", base=5)
    P.flat(g, cw & (S.radial(g, "z", WALL_X0 + 8, 33) < 2.8), "gold", 4)
    P.flat(g, cw & ((np.abs(X - WALL_X0 - 8) < 0.6) | (np.abs(Y - 33) < 0.6)) & (S.radial(g, "z", WALL_X0 + 8, 33) < 3.6), "gold", 6)
    P.flat(g, cw & (S.radial(g, "z", WALL_X0 + 8, 33) < 1.2), "gold", 7)
    # the moss band where the pier stays wet, and ferns on the plinth
    lift = (P._hash(Zi // 3, seed=5) % np.uint64(3)).astype(np.int64)
    P.flat(g, (pier | plinth) & (Y < RACE + 2 + lift), "moss", 5)
    P.flat(g, (pier | plinth) & (Y < RACE + 1 + lift * 0.5), "moss", 4)
    # the bearing: a timber housing with an iron strap round the axle, under
    # a little red-tiled hood on two brackets (the PN accent, rule C3)
    hs = box(g, WALL_X0 - 1, CY - 6, CZ - 5, WALL_X0 + 7, CY + 6, CZ + 5, "darkwood", 4)
    P.planks(g, hs, "darkwood", 4, width=3, across="y", nails=True, seed=6)
    P.flat(g, edges(hs), "darkwood", 2)
    P.flat(g, hs & (S.radial(g, "x", CY, CZ) < 4.0), "iron", 4)
    P.flat(g, hs & (S.radial(g, "x", CY, CZ) < 2.6), "iron", 2)
    for bz in (CZ - 5.5, CZ + 4.5):
        S.bar(g, "z", (WALL_X0 - 1, CY + 7), (WALL_X0 + 5, CY + 13), 1.3, bz, bz + 1, "darkwood", 3)
    g.prism("z", [(WALL_X0 - 4, CY + 11), (WALL_X0 - 4, CY + 14), (WALL_X0 + 8, CY + 18), (WALL_X0 + 8, CY + 15)], CZ - 8, CZ + 8, C("red", 4))
    hood = _mask(g, len(g.solids) - 1)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.tiles(gg, mm, "red", 4, row=3, width=4, frame=fr, seed=14))
    P.flat(g, hood & ((Z < CZ - 7) | (Z > CZ + 7)), "darkwood", 3)
    P.flat(g, hood & (X < WALL_X0 - 2.5), "red", 2)  # the dark eave lip
    # the axle log, out through the bearing to the wheel
    log = S.disc(g, "x", CY, CZ, 2.6, WX0 - 1, WALL_X0 + 6, "wood", 5)
    P.planks(g, log, "wood", 5, width=2, across="x", frame="x", length=(30, 31), nails=False, seed=7)
    P.flat(g, log & (np.abs(X - WX0) < 1.0), "iron", 4)
    # the flume: a planked trough on a post, sloping down over the crown
    pst = box(g, WALL_X0 + 1, WALL_TOP + 3, PZ1 - 4, WALL_X0 + 5, FLUME - 1, PZ1, "darkwood", 4)
    P.planks(g, pst, "darkwood", 4, width=4, across="x", nails=False, seed=8)
    start = len(g.solids)
    g.prism("x", [(FLUME - 3, CZ - 4.0), (FLUME, CZ - 4.0), (FLUME + 2.5, PZ1 + 2), (FLUME - 0.5, PZ1 + 2)], WX0, WX0 + 10, C("wood", 5))
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=3, across="x", length=(30, 34), nails=True, frame=fr, seed=9))
    for sx in (WX0 - 1, WX0 + 9):
        g.prism("x", [(FLUME, CZ - 4.0), (FLUME + 4, CZ - 4.0), (FLUME + 6.5, PZ1 + 2), (FLUME + 2.5, PZ1 + 2)], sx, sx + 2, C("wood", 4))
        P.planks(g, S.last(g), "wood", 4, width=3, across="x", length=(30, 34), nails=True, frame="x", seed=10)
    chute = box(g, WX0 + 1, FLUME - 1, CZ - 6.5, WX0 + 9, FLUME + 2, CZ - 3.0, "sky", 5)
    P.flat(g, chute & (((Yi + Zi) % 3) == 0), "sky", 6)
    P.flat(g, chute & (Y > FLUME + 1), "sky", 7)
    flow = box(g, WX0 + 1, FLUME + 1, CZ - 3.0, WX0 + 9, FLUME + 3, PZ1 + 1, "sky", 4)
    P.flat(g, flow & (((Zi + 2 * (Xi // 2)) % 5) < 2), "sky", 5)
    P.flat(g, flow & (Y > FLUME + 2), "sky", 6)
    # a worn mill stone leaning on the pier, a mossy boulder, ferns and grass
    start = len(g.solids)
    msy, msz = 8.0, PZ1 + 3.0
    g.prism("x", S.flat_ngon(msy, msz, 7.0, 12), WALL_X1 - 4, WALL_X1 - 1, C("stone", 6))
    ms = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 6, block=(4, 3), frame=fr, seed=11))
    P.flat(g, ms & (S.radial(g, "x", msy, msz) < 2.0), "stone", 2)  # the eye
    P.flat(g, ms & (S.radial(g, "x", msy, msz) > 5.8), "stone", 4)
    for k in range(6):  # the dressing furrows on the face
        a = k * math.pi / 6
        P.flat(g, ms & (X > WALL_X1 - 2.5) & (np.abs((Y - msy) * math.sin(a) - (Z - msz) * math.cos(a)) < 0.7), "stone", 4)
    boulder(g, WALL_X1 - 3.0, PZ0 - 6.0, 0, 3.2, 5.5, ramp="stone", base=4, n=6, seed=13, moss="moss", moss_drape=0.4)
    grass(g, [(WALL_X1 - 4, 0, WALL_Z0 + 2), (WALL_X1 - 3, 0, WALL_Z1 - 4), (WALL_X0 + 2, 8, int(PZ0) + 1), (WALL_X0 + 3, 8, int(PZ1) - 3)], "moss", 5)
    return g


def wheel() -> Grid:
    """The wheel: two rims joined by bucket boards, spokes and an iron hub."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    n = 12
    down = -math.pi / 2
    outer = S.flat_ngon(CY, CZ, R, n, down)
    inner = S.flat_ngon(CY, CZ, R - 3.2, n, down)
    for side, (x0, x1) in enumerate(((WX0, WX0 + 2), (WX1 - 2, WX1))):
        start = len(g.solids)
        for k in range(n):
            seg = [outer[k], outer[(k + 1) % n], inner[(k + 1) % n], inner[k]]
            g.prism("x", seg, x0, x1, C("wood", 5 + (k % 2)))
        rim = _mask(g, start)
        S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 6, width=3, across="x", length=(20, 24), nails=True, frame=fr, seed=20 + side))
        P.flat(g, rim & (S.radial(g, "x", CY, CZ) > R - 1.4), "iron", 5)  # the iron tyre
        P.flat(g, rim & (S.radial(g, "x", CY, CZ) > R - 1.4) & ((np.floor(Y + Z).astype(np.int64) % 6) == 0), "iron", 7)
        # eight thick spokes from the hub out to the rim
        for k in range(8):
            a = down + math.pi / n + 2 * math.pi * k / 8
            p0 = (CY + 2.6 * math.cos(a), CZ + 2.6 * math.sin(a))
            p1 = (CY + (R - 2.6) * math.cos(a), CZ + (R - 2.6) * math.sin(a))
            sp = S.bar(g, "x", p0, p1, 1.6, x0, x1, "wood", 6 + (k % 2) - 1)
            P.flat(g, sp, "wood", 6 + (k % 2) - 1)
    # twelve bucket boards between the rims: a sloped float and a sole board
    for k in range(n):
        a0 = down + 2 * math.pi * k / n
        a1 = a0 + 2 * math.pi / n
        p_out = (CY + R * math.cos(a0), CZ + R * math.sin(a0))
        p_in = (CY + (R - 3.4) * math.cos(a0), CZ + (R - 3.4) * math.sin(a0))
        q_in = (CY + (R - 3.4) * math.cos(a1), CZ + (R - 3.4) * math.sin(a1))
        g.prism("x", S.quad(p_out, p_in, 1.1), WX0 + 1, WX1 - 1, C("wood", 5))  # the float
        P.planks(g, S.last(g), "wood", 5, width=3, across="x", length=(20, 24), nails=False, frame="x", seed=30 + k)
        g.prism("x", S.quad(p_in, q_in, 1.1), WX0 + 1, WX1 - 1, C("darkwood", 4))  # the sole
        P.flat(g, S.last(g), "darkwood", 4)
        # water caught in the buckets on the rising side
        mid = ((p_out[0] + q_in[0]) / 2, (p_out[1] + q_in[1]) / 2)
        if math.sin(a0 + math.pi / n) < -0.2 and math.cos(a0 + math.pi / n) > -0.2:
            g.prism("x", S.quad(((p_in[0] + p_out[0]) / 2, (p_in[1] + p_out[1]) / 2), q_in, 1.2), WX0 + 2, WX1 - 2, C("sky", 5))
            P.flat(g, S.last(g), "sky", 5)
            P.flat(g, S.last(g) & (Y > mid[0]), "sky", 6)
    # the hub: an iron-ringed drum with a gold cap
    hub = S.disc(g, "x", CY, CZ, 4.2, WX0 - 1, WX1 + 1, "darkwood", 4)
    P.flat(g, hub, "darkwood", 4)
    P.flat(g, hub & (S.radial(g, "x", CY, CZ) > 3.2), "iron", 4)
    P.flat(g, hub & (S.radial(g, "x", CY, CZ) < 1.8), "gold", 5)
    P.flat(g, hub & (S.radial(g, "x", CY, CZ) < 1.0), "gold", 7)
    return g


def build():
    root, to_root = rig([("water-wheel", mill(), None, None), ("wheel", wheel(), (AX, CY, CZ), None)])
    spin = {"wheel": {"rot": turn(2.4, "x", -150.0)}}
    idle = {"wheel": {"rot": turn(12.0, "x", -30.0)}}
    splash = to_root((AX, RACE + 2.0, CZ))
    chute = to_root((AX, FLUME + 1.0, CZ - 5.0))
    return asset("animated-props", "water-wheel", "Mill Water Wheel", root,
                 clips=[Clip("idle", idle), Clip("spin", spin)],
                 sockets=[Socket("socket-splash", at=splash), Socket("socket-chute", at=chute)],
                 fx=[{"effectId": "rvx-fantasy-waterfall-mist", "socket": "socket-splash", "trigger": "idle", "size": 22},
                     {"effectId": "rvx-fantasy-waterfall-mist", "socket": "socket-chute", "trigger": "idle", "size": 12}])
