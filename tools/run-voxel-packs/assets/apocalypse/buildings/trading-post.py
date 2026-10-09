"""A plank trading post: a gable-front shack with a TRADE board, a striped
canvas awning over the counter, a big balance scale and goods stacked
outside for barter."""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import idx, limb, make
from _rep_bld import text_c
from pnkit import awning, barrel, box, door, edges, gable_roof, posts, shutters, window
from voxgrid import C, Grid, Part

SIZE = (108, 96, 100)
X0, X1, Z0, Z1, EAVE = 26, 82, 42, 92, 42


def crate(g, x0, y0, z0, s, ramp, seed):
    m = box(g, x0, y0, z0, x0 + s, y0 + s, z0 + s, ramp, 4)
    P.planks(g, m, ramp, 4, width=3, across="y", seed=seed)
    P.flat(g, edges(m), "darkwood", 2)
    return m


def build():
    g = Grid(*SIZE)
    X, Y, Z = idx(g)
    yard = box(g, 2, 0, 2, 106, 3, 98, "sand", 4)
    PP.concrete(g, yard, "sand", 4, size=22, cracks=8, frame="top", seed=1)

    # Plank walls on all four sides over a skirt of rusty sheet.
    walls = box(g, X0, 3, Z0, X1, EAVE, Z1, "wood", 5)
    P.planks(g, walls, "wood", 5, width=4, across="x", seed=2)
    PP.corrugate(g, walls & (Y < 11), "rust", 4, period=3, sheet=9, seed=3)
    P.flat(g, walls & (Y == 11), "darkwood", 2)
    posts(g, X0, X1, Z0, Z1, 3, EAVE + 1, size=4, out=1, ramp="darkwood", base=3, seed=4)
    roof = gable_roof(g, X0, X1, Z0, Z1, EAVE, 76, ramp="rust", base=4, thick=4, overhang=5,
                      trim="darkwood", gable="wood", ridge="z", seed=5)
    PP.corrugate(g, roof["slabs"], "rust", 4, period=3, sheet=12, seed=6)
    PP.blotch(g, roof["slabs"], "rust", 2, cell=4, chance=0.05, seed=7)
    P.planks(g, roof["attic"], "wood", 4, width=3, across="y", seed=8)

    # The TRADE board hangs on the front gable.
    board = box(g, 36, 48, Z0 - 2, 72, 60, Z0, "bone", 6)
    P.outline(g, board, "darkwood", 2, normal="z")
    text_c(g, "-z", Z0 - 2, 54, 50, "TRADE", "red", 4)
    # The serving hatch: a dark opening with stocked shelves and a counter.
    g.a[34:74, 16:36, Z0:Z0 + 6] = 0
    back = box(g, 34, 16, Z0 + 6, 74, 36, Z0 + 7, "darkwood", 2)
    for y0 in (22, 29):
        shelf = box(g, 34, y0, Z0 + 3, 74, y0 + 1, Z0 + 6, "wood", 3)
        for k, x in enumerate(range(36, 72, 5)):
            ramp = ("red", "gold", "teal", "sand")[(k + y0) % 4]
            S.disc(g, "y", x + 1.5, Z0 + 4.5, 1.6, y0 + 1, y0 + 5, ramp, 5, n=6)
    counter = box(g, 32, 13, Z0 - 6, 76, 17, Z0 + 1, "darkwood", 4)
    P.planks(g, counter, "darkwood", 4, width=3, across="x", seed=9)
    P.flat(g, edges(counter), "darkwood", 2)
    for x0 in (33, 72):
        box(g, x0, 3, Z0 - 5, x0 + 3, 13, Z0 - 2, "darkwood", 3)
    # The oversized balance scale stands on the counter.
    box(g, 52, 17, Z0 - 4, 56, 34, Z0, "steel", 4)
    beam = S.bar(g, "z", (40, 33), (68, 35), 2.4, Z0 - 3.5, Z0 - 0.5, "gold", 5)
    for x0, top in ((41, 33), (67, 35)):
        limb(g, (x0, top, Z0 - 2), (x0, 22, Z0 - 2), 0.6, 0.6, "steel", 3)
        pan = S.disc(g, "y", x0, Z0 - 2, 4.5, 20, 22, "gold", 4, n=8)
        P.flat(g, edges(pan), "gold", 2)
    S.disc(g, "y", 41, Z0 - 2, 2.0, 22, 25, "red", 4, n=6)

    # A striped canvas awning on two poles shades the trade yard.
    awning(g, "-z", Z0, 24, 84, 37, depth=18, drop=7, ramps=("teal", "bone"), stripe=4)
    for x0 in (24, 81):
        pole = box(g, x0, 3, Z0 - 18, x0 + 3, 31, Z0 - 15, "darkwood", 3)
        P.planks(g, pole, "darkwood", 3, width=3, across="x", nails=False, seed=x0)

    # Goods for barter stand under the awning and by the walls.
    crate(g, 4, 3, 22, 12, "red", 10)
    crate(g, 16, 3, 24, 10, "teal", 11)
    crate(g, 6, 15, 24, 9, "sand", 12)
    for k, (cx, cz) in enumerate(((94, 30), (94, 46))):
        barrel(g, cx, cz, 3, 18, 6.5, ramp="wood", hoop="iron", base=4)
    for k in range(3):
        S.tyre(g, "y", 96, 14, 7.5, 3 + 4 * k, 7 + 4 * k, n=8)
    for cx, cz in ((80, 8), (71, 6)):
        sack = S.disc(g, "y", cx, cz, 4.0, 3, 10, "sand", 5, n=6)
        P.flat(g, sack & (Y >= 9), "sand", 3)
    # Side windows with shutters, a rear door and a stacked woodpile.
    for face, plane in (("-x", X0), ("+x", X1)):
        window(g, face, plane, 60, 74, 20, 32, glass="gold", glow=4)
        shutters(g, face, plane, 60, 74, 20, 32, ramp="teal", base=4)
    door(g, "+z", Z1, 46, 62, 3, 31, leaf="wood", seed=13)
    for k in range(4):
        log = S.disc(g, "z", 74 + 0, 5 + 4 * k, 2.2, Z1, Z1 + 5, "wood", 4, n=6)
        log |= S.disc(g, "z", 69, 5 + 4 * k, 2.2, Z1, Z1 + 5, "wood", 4, n=6)
        P.flat(g, log & (Z == Z1 + 4), "sand", 5)
    return make("buildings", "trading-post", "Trading Post", Part("trading-post", g))
