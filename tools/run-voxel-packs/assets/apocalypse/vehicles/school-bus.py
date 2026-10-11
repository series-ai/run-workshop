"""Fortified school bus, in the Pirate Nation style.

A chunky caricature bus (rule F4): a long hazard-yellow body with chamfered
roof edges and a short sloped hood and windscreen (true slopes), black
stripes, SAFE ZONE painted big down both sides, a row of windows (some
glowing, some grilled, some boarded), a folding door, a STOP arm and big
octagonal wheels. The function prop is oversized (rules F4, K1): a huge
hazard-striped plough bolted to the nose, and a sandbag lookout nest with
a flag on the roof. Detail is paint (S1). Wheels roll on `move`; the body
idles on `idle`. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
import pnshapes as S
from _bld import bloom, crate, label, rig, sandbags, wheel_grid
from pnkit import box, edges, face_prism, pennant
from voxgrid import C, Asset, Grid

GW, GH, GD = 64, 100, 160
BX0, BX1 = 8, 56
HOOD0, BODY0, TAIL = 10, 30, 152
FLOOR, BELT, ROOF = 12, 34, 62
R, TW = 12, 8
WHEEL_Z = (40, 128)


def body():
    g = Grid(GW, GH, GD)
    X, Y, Z = S._idx(g)
    # ---- the body: a prism along z with chamfered roof edges, and a windscreen slope
    ch = 5
    g.prism("z", [(BX0, FLOOR), (BX1, FLOOR), (BX1, ROOF - ch), (BX1 - ch, ROOF), (BX0 + ch, ROOF), (BX0, ROOF - ch)], BODY0 + 6, TAIL, C("gold", 5))
    shell = S.last(g)
    g.prism("x", [(FLOOR, BODY0), (ROOF - 2, BODY0 + 6), (FLOOR, BODY0 + 6)], BX0, BX1, C("gold", 5))
    ws = S.last(g)
    # ---- the hood: a short box with a sloped top (true slope)
    g.prism("x", [(FLOOR, HOOD0), (30, HOOD0), (BELT, HOOD0 + 6), (BELT + 2, BODY0 + 1), (FLOOR, BODY0 + 1)], BX0 + 6, BX1 - 6, C("gold", 5))
    hood = S.last(g)
    allm = shell | ws | hood
    P.flat(g, allm, "gold", 5)
    for m, fr in S.facets(g, g.solids[-3:]):
        if fr == "top":
            P.flat(g, m, "gold", 6)
    side = shell & ((X == BX0) | (X == BX1 - 1))
    # black rub stripes and a dark skirt
    for sy in (20, 30):
        P.flat(g, shell & (Y >= sy) & (Y < sy + 2) & ((X == BX0) | (X == BX1 - 1)), "darkwood", 4)
    P.flat(g, allm & (Y < FLOOR + 3), "darkwood", 5)
    # windscreen glass on the slope
    P.flat(g, ws & (Y > BELT) & (Y < ROOF - 5) & (X > BX0 + 3) & (X < BX1 - 3), "sky", 5)
    P.flat(g, ws & (Y > BELT) & (Y < ROOF - 5) & (np.abs(X + 0.5 - (BX0 + BX1) / 2) < 1), "gold", 4)
    # the window row: glowing, grilled or boarded
    k = 0
    for wz in range(BODY0 + 12, TAIL - 10, 13):
        for x in (BX0, BX1 - 1):
            win = side & (X == x) & (Z >= wz) & (Z < wz + 10) & (Y >= BELT + 4) & (Y < ROOF - 8)
            kind = (k + (x == BX0)) % 3
            if kind == 0:
                P.flat(g, win, "gold", 6)
            elif kind == 1:
                P.flat(g, win, "sky", 5)
                P.flat(g, win & (((Z - wz) % 3 == 0) | (Y % 3 == 0)), "steel", 5)  # mesh grille
            else:
                P.flat(g, win, "darkwood", 5)
                P.flat(g, win & ((Y - BELT) % 4 < 3), "wood", 5)  # boards
            P.outline(g, win, "darkwood", 4, normal="x")
        k += 1
    # SAFE ZONE painted big down both sides (never mirrored)
    for face, plane in (("+x", BX1), ("-x", BX0)):
        label(g, face, plane, (BODY0 + TAIL) / 2 + 4, 17, "SAFE ZONE", "red", 4, scale=2, gap=1)
    bloom(g, shell, 7, ((BX0, FLOOR, BODY0), (BX1, ROOF, TAIL)), r=(2.5, 4.5), ramp="rust", shades=(5, 4), seed=1)
    # ---- the nose: grille, lamps, bumper
    grille = box(g, 20, FLOOR + 3, HOOD0 - 1, 44, 28, HOOD0, "steel", 6)
    P.flat(g, grille & ((X - 20) % 3 == 0), "steel", 4)
    for hx in (BX0 + 7, BX1 - 7):
        lamp = S.disc(g, "z", hx, 24, 3.6, HOOD0 - 2, HOOD0, "bone", 7)
    # ---- the function prop: a huge hazard plough bolted to the nose
    blade = S.bar(g, "x", (4, 3), (32, 9), 4, 2, GW - 2, "gold", 5)
    pnpaint.hazard(g, blade, period=8, a=("gold", 5), b=("darkwood", 4))
    for bx in (18, 44):
        S.bar(g, "x", (16, 6), (16, HOOD0 + 2), 3, bx, bx + 3, "steel", 4)
    # ---- a folding door (+x, front) and a STOP arm (-x)
    door = side & (X == BX1 - 1) & (Z >= BODY0 + 7) & (Z < BODY0 + 17) & (Y >= FLOOR + 2) & (Y < ROOF - 8)
    P.flat(g, door, "sky", 5)
    P.flat(g, door & ((Z == BODY0 + 7) | (Z == BODY0 + 11) | (Z == BODY0 + 16) | (Y == FLOOR + 22)), "steel", 5)
    stop = face_prism(g, "-x", BX0, S.flat_ngon(BODY0 + 18, 42, 7.5, 8, -math.pi / 2), 0, 2, C("red", 5))
    P.outline(g, stop, "bone", 7, normal="x")
    # ---- roof: a sandbag nest with a flag and a crate, a hatch
    rz0, rz1 = 92, 140
    sandbags(g, "z", rz0, rz1, BX0 + 2, ROOF, rows=2, h=5, d=6, ramp="sand", base=5, seed=2)
    sandbags(g, "z", rz0, rz1, BX1 - 8, ROOF, rows=2, h=5, d=6, ramp="sand", base=5, seed=3)
    sandbags(g, "x", BX0 + 8, BX1 - 8, rz0, ROOF, rows=2, h=5, d=6, ramp="sand", base=5, seed=4)
    crate(g, 30, ROOF, 118, 12, ramp="khaki", base=5, icon="cross", ink=("red", 5), seed=5)
    pennant(g, 20, ROOF, 128, 26, 16, "red")
    hatch = box(g, 22, ROOF, 56, 42, ROOF + 2, 72, "gold", 4)
    P.flat(g, edges(hatch), "darkwood", 5)
    # rear: an emergency door, tail lights, a bumper, the exhaust
    P.flat(g, shell & (Z == TAIL - 1) & (np.abs(X + 0.5 - (BX0 + BX1) / 2) < 8) & (Y > FLOOR + 2) & (Y < ROOF - 6), "gold", 4)
    P.flat(g, shell & (Z == TAIL - 1) & (np.abs(X + 0.5 - (BX0 + BX1) / 2) < 6) & (Y > BELT + 4) & (Y < ROOF - 10), "sky", 5)
    for tx in (BX0 + 2, BX1 - 6):
        P.flat(g, shell & (Z == TAIL - 1) & (X >= tx) & (X < tx + 4) & (Y >= 36) & (Y < 44), "red", 5)
    rb = box(g, BX0 - 1, 7, TAIL, BX1 + 1, 12, TAIL + 3, "steel", 4)
    pnpaint.hazard(g, rb, period=6)
    pipe = box(g, BX1 - 10, 8, TAIL - 4, BX1 - 6, 11, TAIL + 5, "iron", 6)
    exhaust = (BX1 - 8, 9.5, TAIL + 5)
    return g, exhaust


def build():
    g, exhaust = body()
    wheels = [wheel_grid(g.shape, wx0, wx0 + TW, wz, R, rim=("steel", 6), hub=("gold", 5), spokes=6, tyre=("gray", 3))
              for wz in WHEEL_Z for wx0 in (BX0 - 2, BX1 - TW + 2)]
    root, clips, socks = rig("school-bus", g, wheels, exhaust, spin_s=0.9, bounce=0.5)
    return Asset(id="apocalypse-vehicles-school-bus", pack="apocalypse", category="vehicles", name="Fortified School Bus", root=root, clips=clips,
                 sockets=socks, pfx=[{"effectId": "rvx-apocalypse-engine-smoke", "socket": "socket-exhaust", "trigger": "clip:move", "size": 30, "aim": [0.0, 0.0, 1.0]}])
