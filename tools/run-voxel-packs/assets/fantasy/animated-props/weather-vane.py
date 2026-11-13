"""Rooster weather vane on a roof ridge, in the Pirate Nation style.

A short piece of village roof: a stone footing, cream plaster walls in a
dark timber frame, two steep red-tiled slopes with dark barge boards and
a dark ridge cap (rule F4). A lead saddle on the ridge holds an iron mast
with gold rings. Four compass arms cross on the mast, and each arm end
carries a gold cut-out letter, N, E, S and W. On top a large gold rooster
stands on a gold arrow with blue fletching and turns in the wind (rule K3:
the rooster and the letters say "weather vane"). The rooster has a red
comb and wattle, a dark eye and banded tail feathers. Detail is paint
(rule S1). About 30 wide, 46 tall and 20 deep. Faces -Z.
Clips: idle (the rooster swings to and fro in a light wind), spin (the
rooster turns round in a gust).
Effects: falling leaves at socket-function on the spin clip.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S_
from _life import asset, coords, pfx, rig
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket, sway, turn

S = (34, 48, 28)
CX, CZ = 17.0, 14.0  # the mast axis
RX = (2, 32)  # the roof length in x
WALL = 6  # the wall top (the eave)
RIDGE = 14.0  # the ridge (the underside of the slabs at the ridge)
RT = 2.5  # the roof slab thickness
EZ = 10.0  # the eave half-span in z
ARM_Y = (21, 23)  # the compass arms
ARM = 10  # the arm reach from the mast
PIV = 32.0  # the vane pivot (the mast top)


def roof() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(v).astype(np.int64) for v in (X, Y, Z))

    # a stone footing and cream plaster walls in a dark timber frame
    ft = box(g, 2, 0, CZ - 7, 32, 2, CZ + 7, "stone", 4)
    P.stone(g, ft, "stone", 4, block=(5, 2), seed=1)
    P.flat(g, edges(ft), "stone", 2)
    wl = box(g, 3, 2, CZ - 6, 31, WALL, CZ + 6, "bone", 6)
    P.flat(g, wl, "bone", 6)
    P.flat(g, wl & (((Xi * 7 + Yi * 3 + Zi * 5) % 11) == 0), "bone", 5)
    P.flat(g, wl & (Yi == WALL - 1), "darkwood", 3)  # the wall plate
    P.flat(g, wl & (Yi == 2), "darkwood", 3)  # the sill
    for px in (3, 10, 16, 23, 30):  # the timber posts
        P.flat(g, wl & (Xi == px), "darkwood", 3)
    P.flat(g, wl & ((Zi == CZ - 6) | (Zi == CZ + 5)) & ((Xi == 3) | (Xi == 30)), "darkwood", 2)

    # the two tiled slopes (true slopes, rule F2), dark eaves and barge ends
    for sgn in (-1, 1):
        ze = CZ + sgn * EZ
        g.prism("x", [(WALL - 1.0, ze), (WALL - 1.0 + RT, ze), (RIDGE + RT, CZ), (RIDGE, CZ)], RX[0], RX[1], C("red", 4))
        slab = S_.last(g)
        P.tiles(g, slab, "red", 4, row=3, width=4, frame=((1, 0, 0), (0.0, WALL - RIDGE, ze - CZ)), seed=2 + sgn)
        P.flat(g, slab & ((X < RX[0] + 1.5) | (X > RX[1] - 1.5)), "darkwood", 3)  # the barge boards
        P.flat(g, slab & (Y < WALL + 0.8), "red", 2)  # the dark eave lip
    cap = box(g, RX[0], int(RIDGE + RT) - 1, int(CZ) - 2, RX[1], int(RIDGE + RT) + 1, int(CZ) + 2, "darkwood", 4)
    P.planks(g, cap, "darkwood", 4, width=2, across="y", nails=True, seed=4)
    # cream plaster gables with a dark timber cross
    for gx in (3, 29):
        g.prism("x", [(WALL, CZ - EZ + 1.5), (WALL, CZ + EZ - 1.5), (RIDGE + 0.5, CZ)], gx, gx + 2, C("bone", 6))
        gb = S_.last(g)
        P.flat(g, gb, "bone", 6)
        P.flat(g, gb & (np.abs(Z - CZ) < 1.0), "darkwood", 3)
        P.flat(g, gb & (np.abs(Y - 9.5) < 0.6), "darkwood", 3)
        P.outline(g, gb, "darkwood", 3, normal="x")

    # the lead saddle on the ridge and the iron mast with gold rings
    sad = box(g, int(CX) - 3, int(RIDGE + RT), int(CZ) - 3, int(CX) + 3, int(RIDGE + RT) + 2, int(CZ) + 3, "steel", 4)
    P.plates(g, sad, "steel", 4, size=(3, 3), rivets=True, seed=5)
    P.flat(g, edges(sad), "steel", 2)
    mast = S_.disc(g, "y", CX, CZ, 1.1, RIDGE + RT + 2, PIV - 1, "iron", 4, n=6)
    P.flat(g, mast, "iron", 4)
    P.flat(g, mast & (X < CX), "iron", 5)
    for ry in (19, 26):
        ringm = S_.disc(g, "y", CX, CZ, 1.8, ry, ry + 1, "gold", 5, n=6)
        P.flat(g, ringm, "gold", 5)
    ball = S_.disc(g, "y", CX, CZ, 1.9, PIV - 3, PIV - 1, "gold", 5, n=6)
    P.flat(g, ball, "gold", 6)

    # the compass arms and a gold ball on each arm end
    for ax in ("x", "z"):
        if ax == "x":
            arm = box(g, CX - ARM, ARM_Y[0], CZ - 1, CX + ARM, ARM_Y[1], CZ + 1, "iron", 4)
        else:
            arm = box(g, CX - 1, ARM_Y[0], CZ - ARM, CX + 1, ARM_Y[1], CZ + ARM, "iron", 4)
        P.flat(g, arm, "iron", 4)
        P.flat(g, arm & (Yi == ARM_Y[1] - 1), "iron", 6)
    hub = box(g, CX - 2, ARM_Y[0] - 1, CZ - 2, CX + 2, ARM_Y[1] + 1, CZ + 2, "gold", 4)
    P.flat(g, hub, "gold", 4)
    P.flat(g, hub & (Yi == ARM_Y[1]), "gold", 6)

    # gold cut-out letters on the arm ends: E (+x), W (-x) face the front;
    # N (-z) and S (+z) face the sides
    y0 = ARM_Y[1]
    for ch, (ex, ez), plane in (("E", (CX + ARM - 2.5, CZ), "z"), ("W", (CX - ARM + 2.5, CZ), "z"),
                                ("N", (CX, CZ - ARM + 2.5), "x"), ("S", (CX, CZ + ARM - 2.5), "x")):
        rows = pnglyph.FONT[ch]
        letter = np.zeros(S, dtype=bool)
        for r, row in enumerate(rows):
            for k, px in enumerate(row):
                if px != "#":
                    continue
                vy = y0 + (len(rows) - 1 - r)
                if plane == "z":  # read from the front (-z): the viewer's left is +x, so column 0 is at high x
                    vx = int(ex) + 2 - k
                    letter |= box(g, vx, vy, int(CZ) - 1, vx + 1, vy + 1, int(CZ) + 1, "gold", 5)
                else:  # read from the +x side: column 0 at the left (high z)
                    vz = int(ez) + 2 - k
                    letter |= box(g, int(CX) - 1, vy, vz, int(CX) + 1, vy + 1, vz + 1, "gold", 5)
        P.flat(g, letter, "gold", 4)
        P.flat(g, letter & (Yi >= y0 + 5), "gold", 5)
        P.flat(g, letter & (Yi == y0), "gold", 2)

    P.grime(g, ft, height=1, seed=6)
    return g


def vane() -> Grid:
    """The gold rooster on its arrow, built in the x-y plane round the pivot."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Yi = np.floor(X).astype(np.int64), np.floor(Y).astype(np.int64)
    z0, z1 = CZ - 1.0, CZ + 1.0
    b = PIV  # the arrow axis height

    def poly(pts, ramp, shade, lo=z0, hi=z1):
        g.prism("z", [(CX + u, b + v) for u, v in pts], lo, hi, C(ramp, shade))
        return S_.last(g)

    # the hub that turns on the mast
    hub = S_.disc(g, "y", CX, CZ, 1.6, PIV - 1, PIV + 1.5, "gold", 4, n=6)
    P.flat(g, hub, "gold", 4)
    # the arrow: a shaft, a gold head (+x) and blue fletching (-x)
    shaft = poly([(-12.0, 0.6), (11.0, 0.6), (11.0, 2.0), (-12.0, 2.0)], "gold", 4, CZ - 0.6, CZ + 0.6)
    P.flat(g, shaft, "gold", 4)
    head = poly([(10.0, -1.0), (14.0, 1.3), (10.0, 3.6)], "gold", 5)
    P.flat(g, head, "gold", 5)
    P.outline(g, head, "gold", 3, normal="z")
    # the fletching sits above the shaft only, so it clears the letters below
    for u0 in (-14.0, -11.0):
        fl = poly([(u0, 6.0), (u0 + 2.5, 6.0), (u0 + 5.0, 2.0), (u0 + 2.5, 2.0)], "blue", 4)
        P.flat(g, fl, "blue", 4)
        P.outline(g, fl, "blue", 2, normal="z")
    # the rooster: body, breast, neck and head, three tail feathers, comb,
    # beak, wattle and legs, each a convex true-slope piece
    body = poly([(-5.0, 4.5), (3.5, 4.5), (6.0, 7.5), (5.0, 10.0), (-4.0, 10.5), (-6.5, 8.0)], "gold", 5)
    neck = poly([(2.5, 8.5), (5.5, 8.0), (7.0, 12.0), (6.5, 14.0), (4.0, 14.0), (2.5, 12.0)], "gold", 5)
    feathers = []
    for pts in ([(-5.5, 6.0), (-3.5, 9.5), (-7.0, 14.5), (-9.0, 13.5)],
                [(-6.0, 5.5), (-4.5, 8.0), (-10.0, 11.5), (-11.0, 9.5)],
                [(-6.0, 5.0), (-5.5, 6.5), (-11.5, 7.0), (-10.5, 5.0)]):
        feathers.append(poly(pts, "gold", 4))
    comb = poly([(3.5, 13.5), (4.5, 15.5), (6.0, 15.0), (7.0, 15.5), (7.0, 13.5)], "red", 5)
    beak = poly([(6.5, 12.0), (9.0, 11.6), (6.8, 10.8)], "orange", 5)
    wattle = poly([(5.8, 10.0), (7.0, 10.5), (6.8, 8.6)], "red", 4)
    legs = []
    for u in (-1.5, 1.5):
        legs.append(poly([(u - 0.6, 1.8), (u + 0.6, 1.8), (u + 0.6, 4.8), (u - 0.6, 4.8)], "orange", 4, CZ - 0.6, CZ + 0.6))
    gold = body | neck
    P.flat(g, gold, "gold", 5)
    P.flat(g, gold & (Y > b + 9.0) & (X < CX + 3.0), "gold", 6)  # the lit back
    P.flat(g, body & (Y < b + 6.0), "gold", 4)  # the shaded belly
    wing = body & (np.abs((X - CX + 0.5) * 0.5 + (Y - b - 7.0)) < 0.6) & (X < CX + 3.5)
    P.flat(g, wing, "gold", 3)  # the wing line
    P.flat(g, body & (np.abs(X - CX + 1.0) < 0.6) & (Y > b + 6.0) & (Y < b + 9.0), "gold", 3)
    for k, f in enumerate(feathers):
        P.flat(g, f, "gold", 4 if k % 2 else 5)
        P.flat(g, f & (((Xi + Yi) % 3) == 0), "gold", 3)  # banded feathers
        P.outline(g, f, "gold", 3, normal="z")
    P.outline(g, gold, "gold", 3, normal="z")
    P.flat(g, neck & (np.abs(X - CX - 5.5) < 0.6) & (np.abs(Y - b - 12.5) < 0.6), "darkwood", 1)  # the eye
    for m, sh in ((comb, 5), (wattle, 4)):
        P.flat(g, m, "red", sh)
        P.outline(g, m, "red", 3, normal="z")
    P.flat(g, beak, "orange", 5)
    for leg in legs:
        P.flat(g, leg, "orange", 4)
    return g


def build():
    r, v = roof(), vane()
    root, to_root = rig([("weather-vane", r, None, None), ("vane", v, (CX, PIV, CZ), None)])
    idle = {"vane": {"rot": sway(6.0, amp=(0.0, 25.0, 0.0), cycles=(1, 1, 1))}}
    spin = {"vane": {"rot": turn(2.0, "y", 360.0)}}
    return asset("animated-props", "weather-vane", "Weather Vane", root,
                 clips=[Clip("idle", idle), Clip("spin", spin)],
                 sockets=[Socket("socket-function", at=to_root((CX, PIV + 8.0, CZ)), parent="vane")],
                 fx=[pfx("rvx-fantasy-leaf-fall", "socket-function", "clip:spin", size=10)])
