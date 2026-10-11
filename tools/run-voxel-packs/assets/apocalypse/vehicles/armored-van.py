"""Armoured van, in the Pirate Nation style.

A chunky toy-like cash van turned scavenger fortress (rule F4): one tall
slab-sided volume with a short sloped hood and windscreen (true slopes), in
bright bank blue with a gold waist stripe and a giant gold coin crest, a
riveted steel skirt, gun-port slits, a caged grille, a hazard bumper with a
big winch, flared fenders over four big octagonal wheels, a roof rack of
jerry cans, a hatch and a big spotlight, and a spare wheel on the back.
Plates, slits, rivets and rust are paint (S1). Wheels roll on `move`; the
body idles on `idle`. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
import pnshapes as S
from _bld import bloom, rig, wheel_grid
from pnkit import box, edges
from voxgrid import C, Asset, Grid

GW, GH, GD = 62, 72, 104
BX0, BX1 = 10, 52  # body sides
NOSE, TAIL = 6, 96
R, TW = 11, 8
WHEEL_Z = (26, 76)
# side profile (z, y): nose, hood, windscreen, roof, tail
PROFILE = [(NOSE, 9), (NOSE, 26), (NOSE + 3, 30), (24, 31), (33, 49), (36, 52), (TAIL, 52), (TAIL, 9)]


def body():
    g = Grid(GW, GH, GD)
    X, Y, Z = S._idx(g)
    g.prism("x", [(y, z) for z, y in PROFILE], BX0, BX1, C("blue", 5))
    shell = S.last(g)
    side = shell & ((X == BX0) | (X == BX1 - 1))
    # a riveted steel skirt, a gold waist stripe, a lighter roof
    skirt = shell & (Y < 20)
    P.plates(g, skirt, "steel", 5, size=(12, 11), seed=2)
    P.flat(g, shell & (Y >= 20) & (Y < 23), "gold", 5)
    P.flat(g, shell & (Y >= 51), "blue", 6)
    for pz in range(40, TAIL, 16):  # panel seams
        P.flat(g, side & (Z == pz) & (Y >= 23), "blue", 3)
    # glass: the windscreen (on the slope) and the cab side windows, with visor bars
    zfront = 24 + (Y - 31) * 9 / 18
    ws = shell & (Y >= 32) & (Y < 48) & (Z < zfront + 2) & (Z >= 24) & (X >= BX0 + 3) & (X < BX1 - 3)
    P.flat(g, ws, "sky", 5)
    P.flat(g, ws & (Y % 4 == 0), "steel", 4)
    cabwin = side & (Y >= 32) & (Y < 45) & (Z >= 37) & (Z < 50)
    P.flat(g, cabwin, "sky", 5)
    P.flat(g, cabwin & ((Z - 37) % 4 == 0), "steel", 4)
    # gun-port slits with steel shutters
    for gz in (54, 70, 84):
        P.flat(g, side & (Y >= 38) & (Y < 41) & (Z >= gz) & (Z < gz + 8), "iron", 3)
        P.flat(g, side & (Y >= 41) & (Y < 44) & (Z >= gz - 1) & (Z < gz + 9), "steel", 6)
    # a giant gold coin crest on both sides (the bank's mark)
    for face, plane in (("+x", BX1), ("-x", BX0)):
        cz = 64
        disc_m = side & (np.hypot(Z + 0.5 - cz, Y + 0.5 - 30) < 7.5) & ((X == BX0) if face == "-x" else (X == BX1 - 1))
        P.flat(g, disc_m, "gold", 5)
        P.flat(g, disc_m & (np.hypot(Z + 0.5 - cz, Y + 0.5 - 30) > 6.3), "gold", 3)
        iw, ih = pnglyph.icon_size("skull")
        pnglyph.icon(g, face, plane, cz - iw // 2, 26, "skull", "gold", 3)
    bloom(g, shell, 6, ((BX0, 10, NOSE), (BX1, 50, TAIL)), r=(2.0, 3.5), ramp="rust", shades=(5, 4), seed=3)
    # ---- nose: a caged grille, lamps, a hazard bumper and a big winch
    grille = box(g, 20, 12, NOSE - 1, 42, 25, NOSE, "steel", 6)
    P.flat(g, grille & ((X - 20) % 3 == 0), "steel", 3)
    P.outline(g, grille, "steel", 3, normal="z")
    for hx in (15, 47):
        lamp = S.disc(g, "z", hx, 19, 4.2, NOSE - 3, NOSE, "gold", 7)
        P.flat(g, lamp & (np.abs(X + 0.5 - hx) < 0.7), "steel", 3)
    bumper = box(g, BX0 - 3, 5, NOSE - 5, BX1 + 3, 12, NOSE, "gold", 5)
    pnpaint.hazard(g, bumper, period=6, a=("gold", 5), b=("darkwood", 4))
    winch = S.disc(g, "x", 15, NOSE - 2.5, 3, 22, 40, "steel", 5)
    P.flat(g, winch & ((X % 2) == 0), "steel", 3)
    box(g, 30, 4, NOSE - 6, 32, 12, NOSE - 5, "gold", 4)  # the hook
    # rear: doors, tail lights, a step bumper and a spare wheel
    P.flat(g, shell & (Z == TAIL - 1) & (np.abs(X + 0.5 - (BX0 + BX1) / 2) < 0.6) & (Y > 12) & (Y < 50), "blue", 3)
    for tx in (BX0 + 1, BX1 - 4):
        P.flat(g, shell & (Z == TAIL - 1) & (X >= tx) & (X < tx + 3) & (Y >= 24) & (Y < 32), "red", 5)
    rb = box(g, BX0 - 1, 6, TAIL, BX1 + 1, 11, TAIL + 3, "steel", 4)
    pnpaint.hazard(g, rb, period=6)
    S.tyre(g, "z", 31, 33, 9, TAIL, TAIL + 5, rubber=("gray", 3), hub=("gold", 5))
    # ---- flared fenders (true slopes) and running boards
    for wz in WHEEL_Z:
        for x0, x1 in ((BX0 - 5, BX0), (BX1, BX1 + 5)):
            g.prism("x", [(21, wz - 15), (26, wz - 11), (26, wz + 11), (21, wz + 15)], x0, x1, C("blue", 4))
            P.flat(g, S.last(g) & (Y >= 25), "blue", 5)
    for x0, x1 in ((BX0 - 4, BX0), (BX1, BX1 + 4)):
        st = box(g, x0, 12, 40, x1, 14, 70, "steel", 4)
        P.flat(g, st & (Z % 3 == 0), "steel", 3)
    # ---- roof: rails, a jerry-can rack, a hatch and the spotlight
    for rx in (BX0 + 1, BX1 - 3):
        box(g, rx, 52, 40, rx + 2, 55, TAIL - 2, "steel", 5)
    for k, ramp in enumerate(("red", "toxic", "red", "gold")):
        can = box(g, BX0 + 4 + 9 * k, 52, 76, BX0 + 11 + 9 * k, 62, 90, ramp, 4 if ramp != "toxic" else 3)
        P.outline(g, can, ramp, 2, normal="x")
        box(g, BX0 + 6 + 9 * k, 62, 78, BX0 + 9 + 9 * k, 64, 81, "steel", 5)
    hatch = S.disc(g, "y", 22, 62, 6, 52, 55, "steel", 5, n=8)
    P.flat(g, hatch & (np.abs(Z + 0.5 - 62) < 1), "steel", 3)
    ped = box(g, 36, 52, 44, 42, 56, 50, "steel", 4)
    lamp = box(g, 34, 56, 42, 44, 64, 52, "steel", 6)
    P.flat(g, edges(lamp), "steel", 4)
    P.flat(g, lamp & (Z == 42) & (X > 34) & (X < 43) & (Y > 56) & (Y < 63), "gold", 7)
    spot = (39, 60, 41)
    # exhaust stack up the back corner
    pipe = S.disc(g, "y", BX1 + 2.5, TAIL - 6, 1.8, 14, 60, "steel", 5)
    P.flat(g, pipe & (Y >= 56), "iron", 5)
    exhaust = (BX1 + 2.5, 60, TAIL - 6)
    return g, exhaust, spot


def build():
    g, exhaust, spot = body()
    wheels = [wheel_grid(g.shape, wx0, wx0 + TW, wz, R, rim=("steel", 5), hub=("gold", 5), spokes=6)
              for wz in WHEEL_Z for wx0 in (BX0 - TW + 2, BX1 - 2)]
    root, clips, socks = rig("armored-van", g, wheels, exhaust, spin_s=0.8, extra_sockets=[("socket-spotlight", spot)])
    return Asset(id="apocalypse-vehicles-armored-van", pack="apocalypse", category="vehicles", name="Armoured Van", root=root, clips=clips,
                 sockets=socks, pfx=[{"effectId": "rvx-apocalypse-exhaust-smoke", "socket": "socket-exhaust", "trigger": "idle", "size": 26, "aim": [0.0, 0.0, 1.0]}])
