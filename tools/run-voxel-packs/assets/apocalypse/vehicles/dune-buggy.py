"""Dune buggy, in the Pirate Nation style.

A chunky caricature buggy (rule F4): a bright orange wedge tub (true
slopes) with a hazard nose, a steel tube roll cage of slanted bars, a
scavenged red car seat, a V-twin engine hanging out the back with two
upswept exhaust pipes, a light bar, a whip antenna with a pennant, small
front wheels and huge balloon rear tyres. Detail is paint (S1). Wheels
roll on `move` (the dust kicks from the exhaust socket); the body idles on
`idle`. Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint
import pnshapes as S
from _bld import bloom, rig, wheel_grid
from pnkit import box, edges, pennant
from voxgrid import C, Asset, Grid

GW, GH, GD = 60, 82, 92
BX0, BX1 = 14, 46  # tub sides
FR, RR = 10, 14  # front and rear wheel radius
FZ, RZ = 18, 68  # axle z
FTW, RTW = 7, 11


def body():
    g = Grid(GW, GH, GD)
    X, Y, Z = S._idx(g)
    # ---- the tub: a wedge along x (poly is (y, z))
    prof = [(10, 6), (15, 6), (22, 26), (24, 58), (22, 76), (12, 78), (10, 70)]
    g.prism("x", prof, BX0, BX1, C("orange", 5))
    tub = S.last(g)
    for m, fr in S.facets(g):
        P.flat(g, m, "orange", 5)
    P.flat(g, tub & (Y < 12), "orange", 3)
    P.flat(g, tub & (Y >= 17) & (Y < 19) & ((X == BX0) | (X == BX1 - 1)), "bone", 7)  # a racing stripe
    nose = tub & (Z < 16)
    pnpaint.hazard(g, nose, period=6, a=("gold", 5), b=("darkwood", 4))
    # a number roundel on the sides
    for x in (BX0, BX1 - 1):
        P.flat(g, tub & (X == x) & (np.hypot(Z + 0.5 - 44, Y + 0.5 - 17) < 4.5), "bone", 7)
        P.flat(g, tub & (X == x) & (np.abs(Z + 0.5 - 44) < 0.8) & (np.abs(Y + 0.5 - 17) < 3), "red", 4)
    bloom(g, tub, 4, ((BX0, 10, 6), (BX1, 24, 78)), r=(2.0, 3.0), ramp="rust", shades=(5, 4), seed=1)
    # a spare tyre lying on the nose deck
    S.tyre(g, "y", 30, 20, 7, 18, 21, rubber=("gray", 3), hub=("steel", 5))
    # ---- the scavenged car seat
    seat = box(g, 20, 24, 44, 40, 29, 54, "red", 4)
    back = box(g, 20, 24, 53, 40, 44, 57, "red", 4)
    P.flat(g, (seat | back) & (((X - 20) % 5) == 0), "red", 3)
    P.flat(g, edges(seat | back), "red", 3)
    box(g, 24, 44, 54, 36, 48, 57, "red", 5)
    # a steering wheel on a column
    S.bar(g, "x", (24, 30), (34, 38), 2, 29, 31, "steel", 4)
    S.disc(g, "z", 30, 36, 5, 37, 39, "iron", 5, n=8)
    # ---- the roll cage: slanted steel tubes (true slopes)
    t = 3
    for x0 in (BX0 - 1, BX1 - 2):
        S.bar(g, "x", (22, 26), (50, 40), t, x0, x0 + t, "steel", 6)  # front hoop legs
        box(g, x0, 22, 58, x0 + t, 52, 58 + t, "steel", 6)  # main hoop legs
        box(g, x0, 49, 38, x0 + t, 52, 61, "steel", 6)  # top rails
        S.bar(g, "x", (51, 60), (22, 78), t, x0, x0 + t, "steel", 6)  # rear braces
    for zz in (38, 58):
        box(g, BX0 - 1, 49, zz, BX1 + 1, 52, zz + t, "steel", 6)
    # a light bar on the front hoop
    lb = box(g, BX0 + 2, 52, 38, BX1 - 2, 56, 42, "iron", 5)
    for lx in range(BX0 + 4, BX1 - 4, 6):
        P.flat(g, lb & (Z == 38) & (X >= lx) & (X < lx + 4) & (Y >= 53), "gold", 7)
    # ---- the V-twin hanging out the back, two upswept pipes
    eng = box(g, 22, 16, 70, 38, 28, 84, "steel", 5)
    P.flat(g, eng & (Y % 3 == 0), "steel", 3)
    for cx, dz in ((26, -4), (34, 4)):
        S.bar(g, "x", (26, 77), (34, 77 + dz), 6, cx - 3, cx + 3, "steel", 6)
    for px in (24, 36):
        S.bar(g, "x", (20, 84), (34, 88), 2.6, px, px + 3, "rust", 5)
    exhaust = (37.5, 35, 89)
    # headlights on the nose
    for hx in (BX0 + 3, BX1 - 8):
        lamp = box(g, hx, 14, 6, hx + 5, 18, 8, "gold", 7)
        P.outline(g, lamp, "steel", 4, normal="z")
    # a whip antenna leaning back with a pennant
    S.bar(g, "x", (52, 60), (78, 66), 1.2, BX1 - 1, BX1, "steel", 4)
    g.prism("x", [(78, 66), (72, 67), (74, 76)], BX1 - 1, BX1 + 1, C("red", 5))
    return g, exhaust


def build():
    g, exhaust = body()
    wheels = []
    for wx0 in (BX0 - FTW, BX1):
        wheels.append(wheel_grid(g.shape, wx0, wx0 + FTW, FZ, FR, rim=("steel", 6), hub=("red", 5), spokes=5))
    for wx0 in (BX0 - RTW + 1, BX1 - 1):
        wheels.append(wheel_grid(g.shape, wx0, wx0 + RTW, RZ, RR, rim=("gold", 5), hub=("red", 5), spokes=6, tyre=("gray", 3)))
    root, clips, socks = rig("dune-buggy", g, wheels, exhaust, spin_s=0.7)
    return Asset(id="apocalypse-vehicles-dune-buggy", pack="apocalypse", category="vehicles", name="Dune Buggy", root=root, clips=clips,
                 sockets=socks, pfx=[{"effectId": "rvx-apocalypse-engine-smoke", "socket": "socket-exhaust", "trigger": "clip:move", "size": 24, "aim": [0.0, 0.0, 1.0]}])
