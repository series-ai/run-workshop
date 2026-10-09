"""Broken rock banks surround a water channel, fall, and pool."""
import numpy as np

import paint as P
from _life import asset, boulder, coords, facet_paint, grass, keys, ngon, pfx, plan, rig, side
from voxgrid import Clip, Grid, Socket
from _scenery import broken_rock

S = (104, 76, 84)
WX0, WX1 = 43, 61  # the water sheet (x)
LIP_Y, LIP_Z = 60, 44  # where the water leaves the cliff
FOOT_Y, FOOT_Z = 2, 30  # where it lands in the pool
POOL_C, POOL_R = (52.0, 24.0), 20.0


def cliff() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    broken_rock(g,52,58,0,24,66,4,patch_moss=True)
    broken_rock(g,25,47,0,20,52,7,patch_moss=True)
    broken_rock(g,80,47,0,18,44,11,patch_moss=True)
    broken_rock(g,18,31,0,11,21,15,patch_moss=True)
    broken_rock(g,86,32,0,10,18,16,patch_moss=True)
    # the source: a spring pool painted on the rear rock top runs down to the lip (no loose plates)
    source = (g.a > 0) & (X > WX0) & (X < WX1) & (Z < LIP_Z + 14) & (Y > LIP_Y)
    P.flat(g, source, "sky", 5)
    P.flat(g, source & (np.floor(X).astype(int) % 5 == 0), "cyan", 6)
    # the gorge face behind the falls: wet, darker, with a mossy lip
    wet = (g.a > 0) & (X > WX0 - 2) & (X < WX1 + 2) & (Z < LIP_Z + 8) & (Y < LIP_Y + 1)
    P.flat(g, wet, "sand", 2)
    P.flat(g, wet & (np.floor(X).astype(int) % 5 == 0), "moss", 4)
    # the pool: water inside a rim of boulders
    pool = plan(g, ngon(POOL_C[0], POOL_C[1], POOL_R, 10, 0.3), 0, 2, "sky", 4)
    d = np.hypot(X - POOL_C[0], Z - POOL_C[1])
    P.flat(g, pool & (np.floor(d).astype(int) % 5 == 0), "sky", 5)  # ripple rings
    P.flat(g, pool & (np.hypot(X - (WX0 + WX1) / 2, (Z - FOOT_Z) * 1.4) < 9), "bone", 7)  # foam where the falls land
    P.flat(g, pool & (np.hypot(X - (WX0 + WX1) / 2, (Z - FOOT_Z) * 1.4) < 9) & (np.hypot(X - (WX0 + WX1) / 2, (Z - FOOT_Z) * 1.4) > 7), "sky", 7)
    for k, (bx, bz, r, h) in enumerate(((30, 13, 6.0, 7), (40, 7, 4.5, 5), (64, 7, 5.0, 6), (74, 13, 6.5, 8), (22, 25, 5.0, 6), (82, 25, 4.5, 5))):
        boulder(g, bx, bz, 0, r, h, "stone" if k % 2 else "sand", 5 if k % 2 else 3, n=6, seed=30 + k, belly=1.08, top=0.55, moss="leaf", moss_drape=0.3)
    grass(g, [(14, 1, 30), (90, 1, 34), (36, 1, 40), (70, 1, 38), (18, 1, 14), (88, 1, 10)], "leaf", 5)
    return g


def water() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # the sheet: a slab in the (y, z) plane, leaning out as it falls (a true slope)
    prof = [(LIP_Y + 2, LIP_Z + 2), (LIP_Y + 2, LIP_Z - 3), (FOOT_Y, FOOT_Z - 3), (FOOT_Y, FOOT_Z + 1)]
    m = side(g, prof, WX0, WX1, "sky", 4)

    def painter(gg, mm, fr):
        U, V = P.uv(gg, fr)
        lane = (P._hash(U // 2, seed=3) % np.uint64(3)).astype(np.int64)
        shade = 4 + np.where(lane == 0, 1, 0) + np.where((U % 6 == 0), 3, 0)
        P._paint(gg, mm, "sky", np.clip(shade, 1, 7))

    facet_paint(g, [g.solids[-1]], painter)
    P.flat(g, m & (Y > LIP_Y - 1), "bone", 7)  # the white lip
    P.flat(g, m & (Y > LIP_Y - 3) & (Y <= LIP_Y - 1) & (np.floor(X).astype(int) % 3 == 0), "bone", 7)
    P.flat(g, m & (Y < FOOT_Y + 5), "bone", 7)  # foam at the foot
    P.flat(g, m & (Y >= FOOT_Y + 5) & (Y < FOOT_Y + 8) & (np.floor(X).astype(int) % 3 != 1), "bone", 6)
    # a foam cushion where it lands
    foam = plan(g, ngon((WX0 + WX1) / 2, FOOT_Z - 1, 10.0, 8, 0.2), FOOT_Y, FOOT_Y + 3, "bone", 7, top=ngon((WX0 + WX1) / 2, FOOT_Z - 1, 7.0, 8, 0.2))
    P.flat(g, foam & (Y < FOOT_Y + 1), "sky", 7)
    return g


def build():
    c, w = cliff(), water()
    hinge = ((WX0 + WX1) / 2, float(LIP_Y), float(LIP_Z))
    root, to_root = rig([("cliff-waterfall", c, None, None), ("water", w, hinge, None)])
    idle = {"water": {"loc": keys((0,0,0,0),(.35,0,-.5,0),(.7,0,0,0),(1.05,0,-.5,0),(1.4,0,0,0))}}
    return asset("terrain-nature", "cliff-waterfall", "Cliff Waterfall", root, clips=[Clip("idle", idle)],
                 sockets=[Socket("socket-splash", at=to_root(((WX0 + WX1) / 2, FOOT_Y + 3, FOOT_Z - 2)))],
                 fx=[pfx("rvx-fantasy-waterfall-mist", "socket-splash", "idle", size=70)])
