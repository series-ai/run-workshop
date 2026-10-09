"""Scrambler motorbike, in the Pirate Nation style.

A chunky caricature dirt bike (rule F4): a fat red tank with a bone stripe
(true slopes), big knobbly octagonal wheels, slanted steel forks and a
swingarm, a finned engine, high handlebars, a leather seat, saddlebags, a
jerry can on the tail rack and an upswept exhaust. The function prop is
oversized (rule K3): a big bone skull headlamp with glowing eyes on the
forks. Detail is paint (S1). Wheels roll on `move` (the dust kicks from the
exhaust); the body idles on `idle`. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import rig, wheel_grid
from pnkit import box, edges
from voxgrid import C, Asset, Grid

GW, GH, GD = 26, 48, 62
CX = 13  # centre line
R, TW = 10, 6
FZ, RZ = 11, 48


def body():
    g = Grid(GW, GH, GD)
    X, Y, Z = S._idx(g)
    # ---- forks (outside the wheel) and a front fender (true slopes)
    for fx in (CX - 5, CX + 3):
        S.bar(g, "x", (R, FZ), (31, FZ + 7), 2.2, fx, fx + 2, "steel", 6)
    g.prism("x", [(21, FZ - 9), (23, FZ - 9), (24, FZ + 4), (21, FZ + 6)], CX - 3, CX + 3, C("red", 5))
    # ---- the frame: a down tube and a subframe
    S.bar(g, "x", (30, 19), (12, 24), 3, CX - 1.5, CX + 1.5, "red", 4)
    S.bar(g, "x", (26, 36), (24, 54), 2.4, CX - 1.5, CX + 1.5, "red", 4)
    # ---- the engine with painted fins, a kick starter
    eng = box(g, CX - 5, 8, 20, CX + 5, 21, 33, "steel", 5)
    P.flat(g, eng & (Y % 2 == 0) & (Y > 12), "steel", 3)
    P.flat(g, edges(eng), "steel", 4)
    cover = S.disc(g, "x", 12, 26, 4, CX - 6, CX + 6, "gold", 5, n=8)
    # ---- the tank: a fat red wedge with a bone stripe and knee dents
    g.prism("x", [(22, 17), (29, 18), (31, 24), (30, 33), (23, 34)], CX - 5, CX + 5, C("red", 5))
    tank = S.last(g)
    for m, fr in S.facets(g):
        P.flat(g, m, "red", 5)
    P.flat(g, tank & (np.abs(X + 0.5 - CX) < 1.5), "bone", 7)
    P.flat(g, tank & (Y < 23), "red", 4)
    box(g, CX - 1, 31, 25, CX + 1, 32, 28, "steel", 6)  # the cap
    # ---- the seat and a tail rack with a jerry can
    seat = box(g, CX - 4, 25, 33, CX + 4, 29, 47, "rust", 3)
    P.flat(g, seat & (Y == 28), "rust", 4)
    P.flat(g, seat & ((Z - 33) % 4 == 0) & (Y == 28), "rust", 2)
    rack = box(g, CX - 4, 24, 47, CX + 4, 25, 56, "steel", 4)
    can = box(g, CX - 4, 25, 48, CX + 4, 35, 55, "toxic", 3)
    P.outline(g, can, "toxic", 1, normal="x")
    box(g, CX - 1, 35, 49, CX + 1, 37, 51, "steel", 5)
    strap = box(g, CX - 5, 25, 51, CX + 5, 35, 52, "sand", 4)
    # rear fender and tail light
    g.prism("x", [(22, 44), (24, 44), (22, 60), (20, 60)], CX - 3, CX + 3, C("red", 5))
    box(g, CX - 2, 20, 59, CX + 2, 22, 61, "red", 6)
    # ---- the swingarm and the rear shock
    for sx in (CX - 5, CX + 3):
        S.bar(g, "x", (14, 31), (R, RZ), 2.2, sx, sx + 2, "steel", 5)
    S.bar(g, "x", (25, 38), (15, 42), 2.4, CX - 1, CX + 1, "gold", 5)
    # ---- saddlebags (the +x bag rides higher over the pipe)
    for bx0, by0 in ((CX - 9, 16), (CX + 5, 20)):
        bag = box(g, bx0, by0, 36, bx0 + 4, by0 + 8, 45, "wood", 5)
        P.flat(g, bag & (Y >= by0 + 6), "wood", 6)
        P.flat(g, bag & ((Z == 38) | (Z == 43)), "sand", 4)
    # ---- the exhaust: down from the engine, then up and back to a muffler
    S.bar(g, "z", (CX + 5, 16), (CX + 8, 12), 2, 24, 26, "steel", 4)
    S.bar(g, "x", (12, 25), (18, 50), 2.2, CX + 7, CX + 9, "steel", 4)
    muff = box(g, CX + 6, 16, 44, CX + 10, 20, 54, "iron", 6)
    P.flat(g, muff & (Z % 3 == 0), "steel", 5)
    exhaust = (CX + 8, 18, 55)
    # ---- the bars: high risers, a crossbar, grips and mirrors
    for fx in (CX - 5, CX + 3):
        box(g, fx, 30, FZ + 6, fx + 2, 36, FZ + 8, "steel", 5)
    box(g, 1, 35, FZ + 7, GW - 1, 37, FZ + 9, "steel", 6)
    for gx in (0, GW - 4):
        box(g, gx, 34, FZ + 6, gx + 4, 38, FZ + 10, "iron", 6)
    for mx in (3, GW - 5):
        box(g, mx, 37, FZ + 8, mx + 1, 41, FZ + 9, "steel", 4)
        box(g, mx - 1, 41, FZ + 7, mx + 2, 44, FZ + 9, "sky", 6)
    # ---- the function prop: a big skull headlamp with glowing eyes
    S.skull(g, CX, 18, FZ + 2, s=11, ramp="bone", base=6, eyes=("gold", 7), socket=("darkwood", 4), seed=3)
    return g, exhaust


def build():
    g, exhaust = body()
    x0 = CX - TW / 2
    wheels = [wheel_grid(g.shape, x0, x0 + TW, wz, R, rim=("red", 5), hub=("gold", 6), spokes=6, tyre=("gray", 3), spoke=("steel", 6)) for wz in (FZ, RZ)]
    root, clips, socks = rig("motorbike", g, wheels, exhaust, spin_s=0.6, bounce=0.3)
    return Asset(id="apocalypse-vehicles-motorbike", pack="apocalypse", category="vehicles", name="Scrambler Motorbike", root=root, clips=clips,
                 sockets=socks, pfx=[{"effectId": "rvx-apocalypse-engine-smoke", "socket": "socket-exhaust", "trigger": "clip:move", "size": 22, "aim": [0.0, 0.0, 1.0]}])
