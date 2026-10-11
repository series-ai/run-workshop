"""Village bakery in the Pirate Nation style.

A stone plinth, a cream plaster ground floor banded with grey-blue stone,
and a jettied half-timbered storey under a steep red tile roof with the
gable to the front (true slopes, rule F4). The shop front is a wide counter
window under a red-and-cream striped awning, with loaves and buns set out
on the board, beside a wide, short arched door.

The oversized function prop is the giant golden loaf that hangs from an
iron bracket over the counter (rules F4, F6): two faceted frustums with a
crusty top, slashed and dusted with flour. The second function piece is the
bake oven in the lean-to on the left: a faceted stone dome on a hearth
plinth with a glowing arched mouth, a long peel beside it, and a leaning
stone chimney (smoke and hearth fire, PFX). Flour sacks, a log pile, a
flour barrel, a crate of loaves and a cooling rack stand round the base
(rule K1). Detail is paint (rule S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import arch_door, half_timber, idx, log_pile, sack, sandstone
from pnkit import awning, barrel, beam, box, crate, edges, gable_roof, pennant, posts, shutters, window
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 152, 116, 104
X0, X1, Z0, Z1 = 64, 128, 30, 84  # house walls; the front is z = Z0
GROUND, UPPER, WALL_TOP, RIDGE = 40, 44, 66, 96
J = 3  # the jetty of the upper storey
OX0 = 16  # the oven lean-to reaches this far left
CHX, CHZ = 34, 50  # the oven and chimney centre
CH_TOP = 102
SIGN_X, SIGN_Z = 104.0, 14.0  # the hanging loaf


def loaf(g: Grid, cx: float, cy: float, cz: float, r: float, h: float, n: int = 8, seed: int = 0,
         crust: int = 5, slashes: int = 3) -> np.ndarray:
    """A chunky baked loaf: two stacked frustums (true slopes) in warm
    crust gold, a lighter risen top, dark bake slashes across it and a
    dusting of flour."""
    X, Y, Z = S.coords(g)
    start = len(g.solids)
    m = S.disc(g, "y", cx, cz, r * 0.72, cy, cy + h * 0.38, "gold", crust, n=n)
    g.prism("y", S.flat_ngon(cx, cz, r * 0.72, n), cy, cy + h * 0.38, C("gold", crust), top=S.flat_ngon(cx, cz, r, n))
    g.prism("y", S.flat_ngon(cx, cz, r, n), cy + h * 0.38, cy + h, C("gold", crust), top=S.flat_ngon(cx, cz, r * 0.42, n))
    m = np.logical_or.reduce([sd.mask(g.shape) for sd in g.solids[start:]])
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.flat(gg, mm, "gold", crust + 1 if fr == "top" else crust))
    P.flat(g, m & (Y > cy + h * 0.78), "gold", crust + 2)  # the risen crown
    P.flat(g, m & (Y < cy + h * 0.2), "gold", max(1, crust - 2))  # the dark base
    P.flat(g, m & (X < cx - r * 0.45) & (Z < cz - r * 0.2) & (Y > cy + h * 0.3), "gold", min(7, crust + 2))
    for k in range(slashes):
        off = (k - (slashes - 1) / 2) * max(2.0, r * 0.52)
        P.flat(g, m & (Y > cy + h * 0.6) & (np.abs((X - cx) - (Z - cz) * 0.35 - off) < 0.9), "darkwood", 3)
    dust = (P._hash(np.floor(X).astype(np.int64) // 2, np.floor(Z).astype(np.int64) // 2, seed=seed) % np.uint64(7)) == 0
    P.flat(g, m & (Y > cy + h * 0.82) & dust, "bone", 7)
    return m


def house(g: Grid) -> None:
    """The shop: plinth, banded plaster ground floor, jettied half-timbered
    storey, steep tiled gable roof, counter window, door and windows."""
    X, Y, Z = idx(g)
    plinth = box(g, X0 - 3, 0, Z0 - 3, X1 + 3, 4, Z1 + 3, "stone", 5)
    P.stone(g, plinth, "stone", 5, block=(9, 4), seed=1)
    P.flat(g, plinth & (Y < 1), "stone", 3)
    ground = box(g, X0, 4, Z0, X1, GROUND, Z1, "sand", 6)
    P.mottle(g, ground, "sand", 6, cell=5, seed=2)
    band = ground & (Y < 16)
    P.stone(g, band, "stone", 5, block=(8, 4), seed=3)
    P.flat(g, ground & (Y >= 16) & (Y < 18), "stone", 6)  # the string course over the stone band
    posts(g, X0, X1, Z0, Z1, 4, GROUND, size=4, base=4, seed=4)
    beam(g, X0 - 3, GROUND, Z0 - 3, X1 + 3, UPPER, Z1 + 3, base=4, seed=5)
    ux0, ux1, uz0, uz1 = X0 - J, X1 + J, Z0 - J, Z1 + J
    upper = box(g, ux0, UPPER, uz0, ux1, WALL_TOP, uz1, "sand", 7)
    P.mottle(g, upper, "sand", 7, cell=5, seed=6)
    half_timber(g, upper, ux0, UPPER, WALL_TOP, bay=18, t=3, ramp="darkwood", shade=4)
    posts(g, ux0, ux1, uz0, uz1, UPPER, WALL_TOP, size=4, out=1, base=4, seed=7)
    roof = gable_roof(g, ux0, ux1, uz0, uz1, WALL_TOP, RIDGE, ramp="red", thick=5, overhang=6, ridge="z", seed=8)
    gab = roof["attic"]
    P.flat(g, gab & (np.abs(X + 0.5 - (ux0 + ux1) / 2) < 1.6), "darkwood", 4)  # king post
    P.flat(g, gab & (Y >= WALL_TOP) & (Y < WALL_TOP + 3), "darkwood", 4)  # tie beam
    window(g, "-z", uz0, 90, 102, WALL_TOP + 10, WALL_TOP + 22, glow=6)  # the gable loft light
    # the shop front: a wide arched door and a counter window under an awning
    arch_door(g, "-z", Z0, 70, 90, 4, 32, leaf=("wood", 4), frame=("stone", 6), seed=9)
    step = box(g, 66, 0, Z0 - 9, 94, 4, Z0 - 3, "stone", 4)
    P.stone(g, step, "stone", 4, block=(7, 4), frame="top", seed=10)
    cw0, cw1, cv0, cv1 = 98, 124, 18, 34
    opening = box(g, cw0, cv0, Z0 - 1, cw1, cv1, Z0 + 3, "darkwood", 1)  # the dark shop interior
    P.flat(g, opening & (Z > Z0 + 1), "darkwood", 2)
    frame = box(g, cw0 - 3, cv0 - 3, Z0 - 2, cw1 + 3, cv0, Z0 + 1, "darkwood", 4)  # the counter board
    frame |= box(g, cw0 - 3, cv1, Z0 - 2, cw1 + 3, cv1 + 3, Z0 + 1, "darkwood", 4)  # the lintel
    for px in (cw0 - 3, cw1):
        frame |= box(g, px, cv0 - 3, Z0 - 2, px + 3, cv1 + 3, Z0 + 1, "darkwood", 4)
    P.planks(g, frame, "darkwood", 4, width=3, across="y", nails=True, seed=11)
    P.flat(g, edges(frame), "darkwood", 2)
    board = box(g, cw0 - 5, cv0 - 3, Z0 - 8, cw1 + 5, cv0, Z0 - 2, "wood", 6)  # the counter sticks out
    P.planks(g, board, "wood", 6, width=4, across="x", length=(20, 26), frame="top", seed=12)
    P.flat(g, edges(board), "darkwood", 3)
    for lx, lz, r, h in ((cw0 + 1, Z0 - 5.5, 3.4, 4.0), (cw0 + 10, Z0 - 5.0, 3.0, 3.6), (cw1 - 3, Z0 - 5.5, 3.2, 3.8)):
        loaf(g, lx, cv0, lz, r, h, seed=13 + int(lx))
    for bx in range(int(cw0) + 16, int(cw1) - 4, 4):  # a row of small buns
        bun = box(g, bx, cv0, Z0 - 7, bx + 3, cv0 + 3, Z0 - 4, "gold", 5)
        P.flat(g, bun & (Y > cv0 + 1), "gold", 6)
        P.flat(g, bun & (X == bx + 1) & (Y > cv0 + 2), "darkwood", 3)
    awning(g, "-z", Z0 - 2, cw0 - 6, cw1 + 6, cv1 + 4, depth=12, drop=7, ramps=("red", "bone"), stripe=4)
    for u0 in (ux0 + 7, ux1 - 21):  # the upper storey windows with blue shutters
        window(g, "-z", uz0, u0, u0 + 14, 50, 62, glow=5)
        shutters(g, "-z", uz0, u0, u0 + 14, 50, 62, ramp="blue")
    for w0 in (Z0 + 12, Z1 - 24):
        window(g, "+x", X1, w0, w0 + 12, 18, 30)
        window(g, "+x", ux1, w0, w0 + 12, 50, 62, glow=5)
    pennant(g, (ux0 + ux1) // 2 - 1, RIDGE + 4, uz0 - 8, 12, 14, "red")


def sign(g: Grid) -> None:
    """The giant loaf hanging from a wrought-iron bracket (rules F4, F6),
    with a small painted board under it."""
    X, Y, _Z = idx(g)
    by = 70
    br = box(g, int(SIGN_X) - 2, by, int(SIGN_Z) - 2, int(SIGN_X) + 2, by + 3, Z0 - 2, "darkwood", 3)
    P.planks(g, br, "darkwood", 3, width=3, across="y", nails=True, seed=20)
    g.prism("x", [(by, Z0 - 6), (by, Z0 - 2), (by - 16, Z0 - 2)], SIGN_X - 1.5, SIGN_X + 1.5, C("darkwood", 3))  # the brace
    for cx in (SIGN_X - 8, SIGN_X + 8):
        ch = box(g, cx - 1, 66, int(SIGN_Z) - 1, cx + 1, by, int(SIGN_Z) + 1, "iron", 3)
        P.flat(g, ch & (Y % 2 == 0), "iron", 5)
    loaf(g, SIGN_X, 44.0, SIGN_Z, 13.0, 22.0, seed=21, crust=5, slashes=4)


def oven(g: Grid) -> None:
    """The lean-to bake house: dark posts, a red lean-to roof on one true
    slope, a faceted stone dome oven with a glowing mouth, a peel, a
    cooling rack and the leaning chimney."""
    X, Y, Z = idx(g)
    floorm = box(g, OX0 - 2, 0, Z0 - 2, X0, 4, Z1 + 2, "stone", 4)
    P.stone(g, floorm, "stone", 4, block=(8, 6), frame="top", seed=30)
    pm = np.zeros(g.shape, dtype=bool)
    for px, pz in ((OX0, Z0), (OX0, Z1 - 10)):
        pm |= box(g, px, 4, pz, px + 5, 48, pz + 5, "darkwood", 4)
    P.planks(g, pm, "darkwood", 4, width=4, across="x", nails=False, seed=31)
    beam(g, OX0 - 2, 48, Z0 - 2, OX0 + 7, 52, Z1 + 3, base=4, seed=32)
    g.prism("z", [(X0, 62), (X0, 67), (OX0 - 9, 48), (OX0 - 9, 43)], Z0 - 6, Z1 + 4, C("red", 4))
    lean = S.last(g)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.tiles(gg, mm, "red", 4, row=4, width=5, frame=fr, seed=33))
    P.flat(g, lean & ((Z < Z0 - 4) | (Z >= Z1 + 2)), "darkwood", 3)
    P.flat(g, lean & (X < OX0 - 7), "red", 2)  # the dark eave lip
    # the hearth plinth and the dome oven on it
    hx0, hx1, hz0, hz1 = CHX - 16, CHX + 16, CHZ - 16, CHZ + 16
    hearth = box(g, hx0, 4, hz0, hx1, 16, hz1, "stone", 5)
    P.stone(g, hearth, "stone", 5, block=(7, 4), seed=34)
    P.flat(g, edges(hearth), "stone", 3)
    dome = S.dome(g, CHX, CHZ, 16, 15.0, 20.0, n=8, rings=3, ramp="sand", base=5, cap_r=5.0,
                  painter=lambda gg, mm, fr: sandstone(gg, mm, 5, block=(7, 4), honey=0.22, frame=fr, seed=35),
                  ribs=("sand", 3))
    P.flat(g, dome & (Y < 19), "sand", 3)
    # the arched mouth, glowing, with a dark soot arch round it
    mz = hz0 - 1
    mouth = box(g, CHX - 9, 16, mz - 3, CHX + 9, 30, mz + 4, "stone", 6)
    P.stone(g, mouth, "stone", 6, block=(5, 3), seed=36)
    P.flat(g, mouth & (Y > 28), "stone", 7)
    g.prism("z", S.arch(CHX, 17, 6.0, 28.0), mz - 4, mz + 1, C("orange", 5))
    fire = S.last(g)
    P.flat(g, fire & (Y < 22), "gold", 7)
    P.flat(g, fire & (Y >= 22) & (Y < 25), "orange", 5)
    P.flat(g, fire & (Y >= 25), "red", 4)
    P.flat(g, fire & (Y < 19), "red", 5)
    P.flat(g, (g.a > 0) & (np.abs(Z - mz + 4) < 1.5) & (Y > 28) & (Y < 34) & (np.abs(X - CHX) < 12), "stone", 2)  # soot
    # the chimney: a tapering stone stack that leans back off the dome
    start = len(g.solids)
    g.prism("y", [(CHX - 8, CHZ + 2), (CHX + 8, CHZ + 2), (CHX + 8, CHZ + 18), (CHX - 8, CHZ + 18)], 32, 62, C("stone", 5),
            top=[(CHX - 7, CHZ + 5), (CHX + 7, CHZ + 5), (CHX + 7, CHZ + 19), (CHX - 7, CHZ + 19)])
    g.prism("y", [(CHX - 7, CHZ + 5), (CHX + 7, CHZ + 5), (CHX + 7, CHZ + 19), (CHX - 7, CHZ + 19)], 62, CH_TOP, C("stone", 5),
            top=[(CHX - 5, CHZ + 9), (CHX + 5, CHZ + 9), (CHX + 5, CHZ + 19), (CHX - 5, CHZ + 19)])
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(6, 4), frame=fr, seed=37))
    cap = box(g, CHX - 7, CH_TOP, CHZ + 7, CHX + 7, CH_TOP + 4, CHZ + 21, "stone", 3)
    P.stone(g, cap, "stone", 3, block=(7, 2), seed=38)
    box(g, CHX - 3, CH_TOP + 3, CHZ + 11, CHX + 3, CH_TOP + 4, CHZ + 17, "iron", 3)
    # the peel leaning on the post, and a cooling rack of loaves
    g.prism("z", [(OX0 + 7, 4), (OX0 + 11, 4), (OX0 + 22, 46), (OX0 + 18, 46)], Z0 + 3, Z0 + 5, C("wood", 5))
    peel = S.last(g)
    P.planks(g, peel, "wood", 5, width=3, across="y", nails=False, frame="z", seed=39)
    g.prism("z", [(OX0 + 4, 4), (OX0 + 14, 4), (OX0 + 14, 14), (OX0 + 4, 14)], Z0 + 2, Z0 + 4, C("wood", 6))
    blade = S.last(g)
    P.planks(g, blade, "wood", 6, width=3, across="x", nails=False, frame="z", seed=40)
    P.outline(g, blade, "darkwood", 3, normal="z")
    rx, rz = OX0 + 30, Z1 - 6
    rack = np.zeros(g.shape, dtype=bool)
    for px in (rx, rx + 22):
        rack |= box(g, px, 4, rz, px + 3, 30, rz + 14, "darkwood", 4)
    for ry in (14, 26):
        rack |= box(g, rx, ry, rz, rx + 25, ry + 2, rz + 14, "darkwood", 4)
    P.planks(g, rack, "darkwood", 4, width=3, across="y", nails=False, seed=41)
    for ry in (16, 28):
        for lx in range(rx + 4, rx + 22, 7):
            loaf(g, lx + 2.0, ry, rz + 7.0, 3.0, 4.0, seed=42 + lx + ry)


def yard(g: Grid) -> None:
    """The props at the base (rule K1): flour sacks, a log pile, a flour
    barrel, a crate of loaves and flour trodden into the paving."""
    X, Y, Z = idx(g)
    for cx, cz, w, h in ((OX0 + 10, Z1 - 12, 11, 13), (OX0 + 19, Z1 - 8, 10, 12), (OX0 + 14, Z1 - 16, 9, 11)):
        sack(g, cx, cz, 4, w=w, h=h, ramp="bone", base=6, tie=("darkwood", 3))
    log_pile(g, X1 + 2, Z0 + 10, 0, length=20, r=3.0, rows=(3, 2), axis="z")
    barrel(g, X1 + 8, Z1 - 6, 0, 20, 8, ramp="wood", hoop="iron")
    P.flat(g, box(g, X1 + 2, 20, Z1 - 12, X1 + 14, 21, Z1, "bone", 7), "bone", 7)  # flour heaped in the barrel
    crate(g, X0 + 4, 0, Z0 - 18, 14, seed=50)
    for lx, lz in ((X0 + 8.0, Z0 - 12.0), (X0 + 14.0, Z0 - 14.0)):
        loaf(g, lx, 14, lz, 3.6, 4.4, seed=51 + int(lx))
    dust = (g.a > 0) & (Y == 4) & (P._hash(X // 3, Z // 3, seed=52) % np.uint64(5) == 0) & (X < X0)
    P.flat(g, dust, "bone", 7)  # flour trodden over the bake house floor


def build() -> Asset:
    g = Grid(W, H, D)
    house(g)
    oven(g)
    sign(g)
    yard(g)
    return Asset(
        id="fantasy-buildings-bakery", pack="fantasy", category="buildings", name="Bakery", root=Part("bakery", g),
        sockets=[Socket("socket-chimney", at=(CHX, CH_TOP + 4, CHZ + 14)), Socket("socket-oven", at=(CHX, 22, CHZ - 20))],
        pfx=[{"effectId": "rvx-fantasy-chimney-smoke", "socket": "socket-chimney", "trigger": "idle", "size": 34},
             {"effectId": "rvx-fantasy-hearth-fire", "socket": "socket-oven", "trigger": "idle", "size": 22}],
    )
