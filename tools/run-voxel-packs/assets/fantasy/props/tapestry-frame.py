"""Tapestry frame in the Pirate Nation style.

A standing loom frame of turned posts and rollers holds the oversized
function prop (rule F4): a woven hanging with a flame-red border, a cream
ground and a bold gold tree over royal-blue hills (rule C3). A shuttle
and a basket of coloured yarn stand at the foot. About 36 wide and 44
tall.
"""

import numpy as np

import paint as P
from _props import coords, plank_box
from pnkit import box
from pnshapes import cone, disc, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 38, 46, 24
PX = (2, 31)  # post x starts (5 thick)
ZC = 8  # the cloth plane
Y0, Y1 = 8, 38  # the woven panel
YARN = ("red", "blue", "cyan", "gold", "magenta", "leaf")


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # two feet and two turned posts
    for px in PX:
        foot = plank_box(g, px - 2, 0, ZC - 6, px + 7, 3, ZC + 8, "darkwood", 4, across="y", width=3, seed=px)
        P.flat(g, foot & (Yi > 1), "wood", 5)
        post = box(g, px, 3, ZC - 1, px + 5, 41, ZC + 5, "wood", 7)
        P.planks(g, post, "wood", 7, width=5, across="x", nails=False, seed=px + 1)
        P.outline(g, post, "darkwood", 3)
        for ky in (10, 22, 34):  # turned collars
            P.flat(g, post & (Yi >= ky) & (Yi < ky + 2), "darkwood", 4)
        ball = disc(g, "y", px + 2.5, ZC + 2, 3.2, 41, 44, "gold", 5, n=6)
        P.flat(g, ball & (Yi > 42), "gold", 6)

    # the top and bottom rollers
    for ry in (Y1, Y0 - 4):
        rol = disc(g, "x", ry + 2, ZC + 2, 2.8, PX[0], PX[1] + 5, "darkwood", 5, n=8)
        P.flat(g, rol & ((Xi % 5) == 0), "darkwood", 4)
        P.flat(g, rol & ((Xi < PX[0] + 3) | (Xi > PX[1] + 1)), "gold", 5)

    # the woven hanging
    cloth = box(g, PX[0] + 3, Y0, ZC, PX[1] + 2, Y1 + 2, ZC + 3, "bone", 7)
    P.planks(g, cloth, "bone", 7, width=3, across="y", frame="wall", nails=False, grain=False, seed=3)
    U, V = X - 19, Y - Y0
    P.flat(g, cloth & ((Xi < PX[0] + 7) | (Xi > PX[1] - 2) | (Yi < Y0 + 4) | (Yi > Y1 - 2)), "red", 6)
    P.flat(g, cloth & ((Xi < PX[0] + 5) | (Xi > PX[1]) | (Yi < Y0 + 2) | (Yi > Y1)), "red", 4)
    # cream diamonds in the border
    P.flat(g, cloth & (Yi >= Y0 + 2) & (Yi < Y0 + 4) & (((Xi // 3) % 2) == 0), "bone", 7)
    P.flat(g, cloth & (Yi > Y1 - 2) & (Yi <= Y1) & (((Xi // 3) % 2) == 0), "bone", 7)
    P.flat(g, cloth & (Xi >= PX[0] + 5) & (Xi < PX[0] + 7) & (((Yi // 3) % 2) == 0), "bone", 7)
    P.flat(g, cloth & (Xi > PX[1] - 2) & (Xi <= PX[1]) & (((Yi // 3) % 2) == 0), "bone", 7)
    inner = cloth & (Xi >= PX[0] + 7) & (Xi <= PX[1] - 2) & (Yi >= Y0 + 4) & (Yi <= Y1 - 2)
    # royal-blue hills, a gold tree and a sky of small gold stars
    P.flat(g, inner & (V < 9 + 3 * np.cos(U / 4.0)), "blue", 5)
    P.flat(g, inner & (V < 7 + 3 * np.cos(U / 4.0)), "blue", 4)
    P.flat(g, inner & (np.abs(U - 0) < 2.2) & (V > 7) & (V < 17), "wood", 4)  # the trunk
    canopy = inner & (np.hypot(U, V - 21) < 8.0)
    P.flat(g, canopy, "leaf", 5)
    P.flat(g, canopy & (np.hypot(U, V - 21) > 6.2), "leaf", 4)
    P.flat(g, canopy & (np.hypot(U, V - 21) < 3.6), "leaf", 6)
    for ax, ay in ((-4, 23), (4, 19), (0, 25), (-2, 18), (5, 24)):
        P.flat(g, canopy & (np.hypot(U - ax, V - ay) < 1.4), "gold", 7)  # golden fruit
    for sx, sy in ((-12, 24), (11, 23), (-9, 17), (13, 16)):
        P.flat(g, inner & (np.hypot(U - sx, V - sy) < 1.4), "gold", 7)

    # a shuttle and a basket of coloured yarn at the foot
    shut = box(g, 14, 3, ZC + 9, 24, 5, ZC + 12, "wood", 7)
    P.flat(g, shut, "wood", 7)
    P.flat(g, shut & ((Xi < 16) | (Xi > 22)), "darkwood", 4)
    P.flat(g, shut & (Xi > 17) & (Xi < 21), "red", 5)
    basket = disc(g, "y", 10, ZC + 11, 4.4, 0, 6, "sand", 5, n=8)
    P.planks(g, basket, "sand", 5, width=2, across="x", frame="wall", nails=False, seed=5)
    P.flat(g, basket & (Yi == 5), "sand", 4)
    for k, (bx, bz) in enumerate(((8, ZC + 10), (12, ZC + 10), (10, ZC + 13))):
        ball = disc(g, "y", bx, bz, 2.0, 5, 8, YARN[k % len(YARN)], 5, n=6)
        P.flat(g, ball & (Yi > 7), YARN[k % len(YARN)], 6)

    root = Part("tapestry-frame", g)
    return Asset(id="fantasy-props-tapestry-frame", pack="fantasy", category="props", name="Tapestry Frame", root=root)
