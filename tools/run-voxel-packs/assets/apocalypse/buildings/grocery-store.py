"""An abandoned big-box grocery store: a brick front with a tall
parapet sign, a boarded glass shopfront, and a cart corral in the lot."""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import idx, limb, make
from _rep_bld import text_c
from pnkit import box, edges, gable_roof
from voxgrid import C, Grid, Part

SIZE = (124, 84, 104)
X0, X1, Z0, Z1, TOP = 10, 114, 36, 98, 50


def cart(g, x0, z0, seed):
    """A small shopping cart: a wire basket on a frame with four wheels."""
    basket = box(g, x0, 7, z0, x0 + 9, 14, z0 + 13, "steel", 5)
    U = np.arange(g.shape[0])[:, None, None] + np.arange(g.shape[2])[None, None, :]
    V = np.arange(g.shape[1])[None, :, None]
    P.flat(g, basket & (((U % 3) == 0) | ((V % 3) == 0)), "steel", 3)
    P.flat(g, edges(basket), "steel", 2)
    limb(g, (x0 + 4.5, 14, z0 + 13), (x0 + 4.5, 17, z0 + 15), 0.8, 0.8, "red", 4)
    box(g, x0, 17, z0 + 14, x0 + 9, 19, z0 + 16, "red", 4)
    box(g, x0 + 1, 4, z0 + 1, x0 + 8, 7, z0 + 12, "steel", 3)
    for xx in (x0 + 1, x0 + 7):
        for zz in (z0 + 1, z0 + 10):
            S.disc(g, "x", 4.5, zz + 1, 1.5, xx, xx + 1.5, "iron", 2, n=6)


def build():
    g = Grid(*SIZE)
    X, Y, Z = idx(g)
    # The parking lot: cracked asphalt with faded bay lines.
    lot = box(g, 2, 0, 2, 122, 3, 102, "sand", 4)
    PP.concrete(g, lot, "sand", 4, size=16, cracks=14, frame="top", seed=1)
    for x0 in (14, 34, 54, 74):
        P.flat(g, lot & (Y == 2) & (X >= x0) & (X < x0 + 2) & (Z < 28) & (Z > 6), "bone", 5)

    # Side and rear walls: teal corrugated cladding on a block base.
    shell = box(g, X0, 3, Z0, X1, TOP, Z1, "teal", 4)
    PP.corrugate(g, shell, "teal", 4, period=4, sheet=12, seed=2)
    P.stone(g, shell & (Y < 10), "stone", 4, block=(8, 4), seed=3)
    PP.blotch(g, shell & (Y > 10), "rust", 4, cell=4, chance=0.05, seed=4)
    for x0 in (X0 - 1, X1 - 3):
        for z0 in (Z0, Z1 - 3):
            post = box(g, x0, 3, z0, x0 + 4, TOP + 1, z0 + 4, "darkwood", 3)
            P.planks(g, post, "darkwood", 3, width=4, across="x", nails=False, seed=x0 + z0)
    # A low corrugated gable roof hides behind the tall front parapet, as on
    # a big-box store. Its true slopes satisfy rule F2.
    roof = gable_roof(g, X0, X1, Z0, Z1, TOP, TOP + 11, ramp="rust", base=4, thick=3, overhang=5,
                      trim="darkwood", gable="teal", ridge="z", trim_shade=2, seed=5)
    PP.corrugate(g, roof["slabs"], "rust", 4, period=4, sheet=14, seed=51)
    PP.blotch(g, roof["slabs"], "rust", 3, cell=4, chance=0.05, seed=52)
    PP.corrugate(g, roof["attic"], "teal", 4, period=4, sheet=12, seed=53)
    # Two roof vents stand on the ridge.
    for z0 in (60, 80):
        vent = S.disc(g, "y", (X0 + X1) / 2, z0, 3.5, TOP + 15, TOP + 21, "steel", 5, n=8)
        P.flat(g, vent & (Y >= TOP + 19), "steel", 2)

    # The brick front rises into a tall stepped parapet that holds the sign.
    front = box(g, X0 - 2, 3, Z0 - 4, X1 + 2, TOP + 4, Z0, "red", 4)
    g.prism("z", [(16, TOP + 4), (108, TOP + 4), (108, TOP + 18), (98, TOP + 18), (98, TOP + 24), (26, TOP + 24), (26, TOP + 18), (16, TOP + 18)], Z0 - 4, Z0, C("red", 4))
    front |= g.solids[-1].mask(g.shape)
    P.stone(g, front, "red", 4, block=(6, 3), mortar=-2, cracks=0.04, seed=6)
    cap = box(g, 24, TOP + 24, Z0 - 5, 100, TOP + 26, Z0 + 1, "bone", 5)
    cap |= box(g, 14, TOP + 18, Z0 - 5, 26, TOP + 20, Z0 + 1, "bone", 5) | box(g, 98, TOP + 18, Z0 - 5, 110, TOP + 20, Z0 + 1, "bone", 5)
    P.flat(g, cap, "bone", 5)
    P.flat(g, edges(cap), "bone", 3)
    sign = box(g, 20, TOP + 2, Z0 - 6, 104, TOP + 18, Z0 - 4, "bone", 6)
    P.outline(g, sign, "gold", 4, normal="z")
    text_c(g, "-z", Z0 - 6, 62, TOP + 4, "GROCERY", "red", 4, scale=2)
    # Two letters fell off: only their dark ghosts stay.
    P.flat(g, sign & (X >= 33) & (X < 43) & (Y >= TOP + 4) & (Y < TOP + 18) & (g.a == C("red", 4)), "bone", 4)

    # The glass shopfront: tall panes, most boarded, one smashed.
    glass = box(g, 14, 6, Z0 - 5, 110, 38, Z0 - 4, "sky", 3)
    P.mottle(g, glass, "sky", 3, cell=4, seed=7)
    P.flat(g, glass & ((X - 14) % 16 == 0), "steel", 2)
    P.flat(g, glass & ((Y == 6) | (Y == 37) | (Y == 22)), "steel", 2)
    P.flat(g, glass & (X >= 94) & (X < 110) & (Y > 8) & (Y < 30) & ((X + 2 * Y) % 7 < 3), "navy", 1)
    door_glass = glass & (X >= 54) & (X < 70) & (Y < 34)
    P.flat(g, door_glass & (np.abs(X - 62) < 1), "steel", 1)
    for x0, x1 in ((15, 46), (78, 93)):
        for y0 in (9, 15, 26, 31):
            plank = box(g, x0, y0, Z0 - 7, x1, y0 + 4, Z0 - 5, "wood", 5)
            P.planks(g, plank, "wood", 5, width=4, across="y", seed=x0 + y0)
    for x0, word in ((22, "SALE"), (80, "OPEN")):
        poster = box(g, x0, 19, Z0 - 6, x0 + 24, 27, Z0 - 5, "gold", 6)
        P.outline(g, poster, "darkwood", 3, normal="z")
        text_c(g, "-z", Z0 - 6, x0 + 12, 20, word, "red", 3)
    sill = box(g, X0 - 3, 3, Z0 - 7, X1 + 3, 6, Z0 - 4, "stone", 4)
    P.flat(g, edges(sill), "stone", 2)

    # A loading door in a hazard frame on the rear wall.
    dock = box(g, 40, 3, Z1, 70, 32, Z1 + 1, "steel", 4)
    P.flat(g, dock & (Y % 3 == 0), "steel", 2)
    PP.hazard(g, box(g, 38, 32, Z1, 72, 35, Z1 + 2, "gold", 5), period=6)


    # The cart corral: a red rail pen with three carts.
    for x0, z0, x1, z1 in ((84, 8, 120, 10), (84, 24, 120, 26), (84, 8, 86, 26)):
        rail = box(g, x0, 12, z0, x1, 14, z1, "red", 4)
        P.flat(g, edges(rail), "red", 2)
    for xx, zz in ((84, 8), (84, 24), (102, 8), (102, 24), (118, 8), (118, 24)):
        box(g, xx, 3, zz, xx + 2, 14, zz + 2, "steel", 4)
    for k, x0 in enumerate((88, 98, 108)):
        cart(g, x0, 10, k)
    cart(g, 30, 10, 9)
    return make("buildings", "grocery-store", "Neighborhood Grocery Store", Part("grocery-store", g))
