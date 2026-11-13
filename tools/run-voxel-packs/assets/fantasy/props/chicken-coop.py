"""Chicken coop in the Pirate Nation style.

A cream half-timbered box on four stout legs under a steep rust-tiled
gable (true slopes, rule F2). The oversized function prop is the hen that
roosts on the ridge (rule F4): a chunky cream bird with a flame-red comb
and a gold beak, so the coop reads at a glance. A round pop-hole with a
cleated ramp, a latched nest hatch, straw, eggs and a feed sack finish it
(rule K1). About 34 wide and 36 tall.
"""

import numpy as np

import paint as P
from _props import coords, sack, tufts
from pnkit import box, gable_roof
from pnshapes import bar, cone, disc, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 34, 40, 28
X0, X1 = 4, 30  # coop body
ZF, ZB = 8, 24  # coop front and back
LEG, FLOOR, WALL = 4, 4, 18  # leg top, floor, wall top
RIDGE = 23


def hen(g: Grid, cx: float, cz: float, y0: int) -> None:
    """A chunky roosting hen: cream body, red comb and wattle, gold beak."""
    X, Y, Z = coords(g)
    body = disc(g, "y", cx, cz, 4.4, y0, y0 + 4, "bone", 7, n=8)
    body |= cone(g, "y", cx, cz, 4.4, y0 + 4, y0 + 6, "bone", 7, n=8, r_top=2.6)
    P.flat(g, body & (Y < y0 + 1), "bone", 5)
    P.flat(g, body & (np.abs(X - cx) > 2.6) & (Y > y0 + 1) & (Y < y0 + 4), "bone", 6)  # folded wings
    P.flat(g, body & (np.abs(X - cx) > 3.2) & (np.abs(Y - (y0 + 2.5)) < 1.1), "sand", 5)
    # tail: a true-slope wedge sweeping up at the back
    g.prism("x", [(y0 + 2, cz + 3), (y0 + 4, cz + 3), (y0 + 8, cz + 7), (y0 + 5, cz + 7)], cx - 2, cx + 2, C("bone", 6))
    tail = last(g)
    P.flat(g, tail & (Z > cz + 5.0), "sand", 5)
    # head on a short neck, with the comb, wattle and beak
    neck = box(g, cx - 1.5, y0 + 5, cz - 3.5, cx + 1.5, y0 + 8, cz - 0.5, "bone", 7)
    head = box(g, cx - 2, y0 + 7, cz - 5, cx + 2, y0 + 11, cz - 1, "bone", 7)
    P.flat(g, neck | head, "bone", 7)
    comb = box(g, cx - 0.5, y0 + 11, cz - 4.5, cx + 0.5, y0 + 13, cz - 1.5, "red", 5)
    P.flat(g, comb & (Y > y0 + 12) & (np.floor(Z).astype(int) % 2 == 0), "red", 4)
    box(g, cx - 1, y0 + 6, cz - 4.5, cx + 1, y0 + 8, cz - 3.5, "red", 5)  # wattle
    beak = cone(g, "z", cx, y0 + 9, 1.4, cz - 7, cz - 4, "gold", 5, n=4, tip="lo")
    P.flat(g, beak, "gold", 5)
    for sx in (cx - 2, cx + 1):  # eyes
        P.flat(g, head & (np.abs(X - sx - 0.5) < 1.1) & (np.abs(Y - (y0 + 9.5)) < 0.6) & (Z < cz - 4.4), "darkwood", 2)


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # four stout legs with a plank under-floor
    for lx in (X0 + 1, X1 - 4):
        for lz in (ZF + 1, ZB - 4):
            leg = box(g, lx, 0, lz, lx + 3, LEG, lz + 3, "darkwood", 4)
            P.planks(g, leg, "darkwood", 4, width=3, across="x", nails=False, seed=lx + lz)
    floor = box(g, X0, LEG, ZF, X1, FLOOR + 2, ZB, "darkwood", 4)
    P.planks(g, floor, "darkwood", 4, width=3, across="y", frame="wall", nails=True, seed=1)

    # the body: cream plaster between dark corner posts, a sill and a head rail
    walls = box(g, X0, FLOOR + 2, ZF, X1, WALL, ZB, "bone", 6)
    P.mottle(g, walls, "bone", 6, cell=4, seed=2)
    P.flat(g, walls & ((Yi < FLOOR + 4) | (Yi >= WALL - 2)), "darkwood", 4)
    for cx0 in (X0, X1 - 3):
        for cz0 in (ZF, ZB - 3):
            P.flat(g, walls & (Xi >= cx0) & (Xi < cx0 + 3) & (Zi >= cz0) & (Zi < cz0 + 3), "darkwood", 4)
    mid = (X0 + X1) // 2
    for zc in (ZF, ZB - 1):  # one painted X brace in the middle of each long face
        side = walls & (Zi == zc) & (Yi >= FLOOR + 4) & (Yi < WALL - 2)
        P.flat(g, side & (np.abs((Xi - mid) - (Yi - 11) * 1.1) < 1), "darkwood", 4)
        P.flat(g, side & (np.abs((Xi - mid) + (Yi - 11) * 1.1) < 1), "darkwood", 4)
    for xc in (X0, X1 - 1):  # a single upright on each short face
        P.flat(g, walls & (Xi == xc) & (np.abs(Zi - (ZF + ZB) // 2) < 2), "darkwood", 4)

    # the pop-hole, a landing board and a cleated ramp to the ground
    rad = np.hypot(X - 11, Y - 11.5)
    g.carve((rad < 4.0) & (Zi >= ZF) & (Zi < ZF + 3))
    P.flat(g, (g.a > 0) & (rad < 4.6) & (Zi == ZF + 3), "darkwood", 2)  # the dark interior
    P.flat(g, (g.a > 0) & (rad < 5.6) & (rad > 3.9) & (Zi == ZF), "wood", 7)  # a pale ring frame
    P.flat(g, (g.a > 0) & (rad < 6.4) & (rad > 5.5) & (Zi == ZF), "darkwood", 3)
    sill = box(g, 6, FLOOR + 2, ZF - 2, 16, FLOOR + 4, ZF, "wood", 6)
    P.planks(g, sill, "wood", 6, width=3, across="y", frame="z", nails=True, seed=3)
    ramp = bar(g, "x", (FLOOR + 3, ZF - 1), (1, 1), 2.4, 8, 14, "wood", 6)
    P.planks(g, ramp, "wood", 6, width=4, across="y", frame=((1, 0, 0), (0, -1, -1)), nails=False, seed=4)
    P.flat(g, ramp & ((Zi + Yi) % 4 == 0), "darkwood", 3)  # cleats
    P.outline(g, ramp, "darkwood", 3, normal="x")

    # the nest hatch on the +x side, with a gold latch
    hatch = (g.a > 0) & (Xi == X1 - 1) & (Yi > 8) & (Yi < 16) & (Zi > ZF + 3) & (Zi < ZB - 4)
    P.planks(g, hatch, "wood", 6, width=3, across="y", frame="x", nails=True, seed=5)
    P.outline(g, hatch, "darkwood", 3, normal="x")
    P.flat(g, hatch & (Zi > ZB - 7) & (np.abs(Yi - 12) < 2), "gold", 5)

    # the roof: a steep rust-tiled gable with dark barge boards
    gable_roof(g, X0, X1, ZF, ZB, WALL, RIDGE, ramp="red", base=5, thick=2, overhang=2,
               trim="darkwood", gable="bone", ridge="x", trim_shade=3, seed=6)

    # the hen on the ridge
    hen(g, 20, 16, RIDGE + 3)

    # straw, three eggs and a feed sack at the foot
    tufts(g, [(2, 4), (31, 6), (5, 25), (28, 24)], ramp="gold")
    for ex, ez, er in ((20, 4, 2.0), (23, 5, 1.7), (21.5, 7, 1.8)):
        egg = cone(g, "y", ex, ez, er, 0, 3, "bone", 7, n=6, r_top=er * 0.6)
        P.flat(g, egg & (Y > 2), "bone", 6)
        P.flat(g, egg & (Y < 1), "sand", 5)
    sack(g, 29, 0, 23, r=3.4, h=9, ramp="sand", base=6, mark="wheat", seed=7)

    root = Part("chicken-coop", g)
    return Asset(id="fantasy-props-chicken-coop", pack="fantasy", category="props", name="Chicken Coop", root=root)
