"""Thatched cottage in the Pirate Nation style.

The one small home of the village: low cream wattle walls with dark
timber posts on a fieldstone plinth, under a deep straw roof that is
almost half the height of the house (rule F4). The thatch is thick, with
vertical straw streaks (rule S2), a round, heavy eave lip, a scalloped
ridge band pinned with hazel liggers and a round ridge roll on top. The
long side faces the front with a round-topped blue door under the deep
eave, and small leaded windows with flower boxes and green
shutters. A fieldstone chimney stands outside the right gable and leans
a little (rule F5).

The function prop is the cooking fire in the yard: a ring of stones, a
log fire under a black cauldron on an iron tripod (the hearth fire is
PFX). A wicker garden fence with cabbages, a log pile on the left gable
and a rain barrel at the back finish it (rule K1). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import half_timber, log_pile
from _fbld_rural import idx, straw
from _props import tufts
from pnkit import barrel, box, door, edges, shutters, window
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 100, 92, 96
X0, X1, Z0, Z1 = 20, 70, 38, 70  # cottage walls; the front is z = Z0
ZC = (Z0 + Z1) / 2
WALL_TOP, RIDGE, T = 38, 66, 6  # one storey of 34 (y 4..38); the thatch is 6 thick
EAVE_Y, EAVE_O = 33.0, 8.0  # the underside of the eave and its overhang past the walls
VERGE = 5  # the thatch overhang past the gable walls
CH = (X1 + 1, X1 + 12, 50, 60)  # chimney x0, x1, z0, z1
FIRE = (82.0, 20.0)  # the cooking fire (x, z)


def slope() -> float:
    """Rise per unit run of the thatch."""
    return (RIDGE - EAVE_Y) / (ZC - (Z0 - EAVE_O))


def slab_poly(front: bool) -> list[tuple[float, float]]:
    """One thatch slab across x as a (y, z) polygon: a straight underside
    from the eave to the ridge, a parallel top T higher, and a round,
    heavy nose at the eave (the rolled thatch lip)."""
    ez = Z0 - EAVE_O
    pts = [(EAVE_Y, ez), (RIDGE, ZC), (RIDGE + T, ZC), (EAVE_Y + T, ez),
           (EAVE_Y + T - 0.8, ez - 1.6), (EAVE_Y + T / 2, ez - 2.6), (EAVE_Y + 0.6, ez - 1.8)]
    if front:
        return pts
    return [(y, 2 * ZC - z) for y, z in pts]


def house(g: Grid) -> None:
    """Plinth, wattle walls and timbers, gables, door, windows."""
    X, Y, Z = idx(g)
    plinth = box(g, X0 - 2, 0, Z0 - 2, X1 + 2, 4, Z1 + 2, "stone", 4)
    P.stone(g, plinth, "stone", 4, block=(6, 4), cracks=0.1, seed=1)
    P.flat(g, edges(plinth), "stone", 2)
    walls = box(g, X0, 4, Z0, X1, WALL_TOP, Z1, "bone", 6)
    # whitewashed wattle: soft daub courses with a few darker patches near the ground
    U, V = P.uv(g, "wall")
    P.flat(g, walls, "bone", 6)
    P.flat(g, walls & (V % 6 == 0) & (P._hash(U // 7, V // 6, seed=2) % np.uint64(3) == 0), "bone", 5)
    P.grime(g, walls, height=5, seed=3)
    half_timber(g, walls, X0, 4, WALL_TOP, bay=17, t=3, ramp="darkwood", shade=4, braces=False)
    for cx in (X0, X1):  # thick corner posts
        for cz in (Z0, Z1):
            pm = box(g, cx - 2, 4, cz - 2, cx + 2, WALL_TOP, cz + 2, "darkwood", 4)
            P.planks(g, pm, "darkwood", 4, width=4, across="x", nails=False, seed=cx + cz)
    # the gable walls under the thatch (one prism across x)
    s = slope()
    under = EAVE_Y + (EAVE_O) * s  # the underside of the thatch at the wall line
    g.prism("x", [(WALL_TOP, Z0), (under, Z0), (RIDGE, ZC), (under, Z1), (WALL_TOP, Z1)], X0, X1, C("bone", 6))
    gab = S.last(g)
    P.flat(g, gab, "bone", 6)
    P.flat(g, gab & (np.abs(Z + 0.5 - ZC) < 1.6), "darkwood", 4)  # king post
    P.flat(g, gab & (Y >= WALL_TOP) & (Y < WALL_TOP + 3), "darkwood", 4)  # tie beam
    P.flat(g, gab & (np.abs(Y + 0.5 - (WALL_TOP + 14)) < 1.5) & (np.abs(Z + 0.5 - ZC) < 9), "darkwood", 4)  # collar
    # the door: round-topped and painted blue; the deep eave shelters it
    door(g, "-z", Z0, 28, 44, 4, 32, leaf="blue", frame="darkwood", base=4, arch=True, seed=4)
    box(g, 36, 15, Z0 - 3, 38, 18, Z0 - 2, "gold", 5)  # the latch ring
    step = box(g, 25, 0, Z0 - 7, 47, 4, Z0 - 2, "stone", 5)
    P.stone(g, step, "stone", 5, block=(7, 4), frame="top", seed=5)
    # small leaded windows with green shutters and flower boxes
    for face, plane, u0 in (("-z", Z0, 52), ("+z", Z1, 26), ("+z", Z1, 52)):
        window(g, face, plane, u0, u0 + 11, 16, 28, frame="darkwood", glass="gold", glow=5)
        shutters(g, face, plane, u0, u0 + 11, 16, 28, ramp="leaf", base=3)
        sgn = -1 if face == "-z" else 1
        z0, z1 = (plane - 4, plane) if sgn < 0 else (plane, plane + 4)
        fb = box(g, u0 - 1, 11, z0, u0 + 12, 14, z1, "wood", 4)
        P.planks(g, fb, "wood", 4, width=3, across="y", nails=False, seed=u0)
        P.flat(g, edges(fb), "darkwood", 3)
        for k, fx in enumerate(range(u0, u0 + 11, 2)):
            fz = (z0 + z1) // 2
            box(g, fx, 14, fz - 1, fx + 2, 16, fz + 1, "leaf", 4)
            box(g, fx, 16, fz, fx + 1, 17, fz + 1, ("red", "pink", "gold")[k % 3], 6)
    window(g, "-x", X0, 50, 60, 46, 56, frame="darkwood", glass="gold", glow=5)  # the gable loft light
    window(g, "+x", X1, 26, 34, 18, 28, frame="darkwood", glass="gold", glow=5)


def thatch(g: Grid) -> None:
    """The straw roof: two thick slabs with round eaves, a scalloped ridge
    band with liggers, and the round ridge roll."""
    X, Y, Z = idx(g)
    start = len(g.solids)
    for front in (True, False):
        g.prism("x", slab_poly(front), X0 - VERGE, X1 + VERGE, C("sand", 4))
    roof = np.logical_or.reduce([sd.mask(g.shape) for sd in g.solids[start:]])
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: straw(gg, mm, frame=fr, base=2, tie=11, seed=10))
    # the round eave lip is a shade darker underneath, lit along its crown
    ez = Z0 - EAVE_O
    lip = roof & (Y < EAVE_Y + T + 1) & ((Z < ez + 2) | (Z > 2 * ZC - ez - 3))
    P.flat(g, lip & (Y < EAVE_Y + 2), "sand", 2)
    P.flat(g, lip & (Y >= EAVE_Y + T - 1), "gold", 4)
    # the verges are cut straw: darker, with short horizontal bands
    ends = roof & ((X < X0 - VERGE + 1) | (X >= X1 + VERGE - 1))
    P.flat(g, ends, "gold", 2)
    P.flat(g, ends & (Y % 3 == 0), "sand", 2)
    # the scalloped ridge band (a darker, newer straw layer) with liggers
    depth = RIDGE + T - Y
    scallop = 7 + np.abs((X % 8) - 4) * 0.75
    band = roof & (depth < scallop) & (np.abs(Z + 0.5 - ZC) < 12)
    straw(g, band, frame="wall", base=1, tie=99, seed=12)
    P.flat(g, band & (np.abs(depth - scallop) < 1.0), "darkwood", 4)  # the scallop edge
    for d in (3.0,):
        P.flat(g, band & (np.abs(depth - d) < 0.6), "darkwood", 5)  # the long ligger
    P.flat(g, band & (X % 4 == 0) & (np.abs(depth - 3.0) < 2.0) & (((X // 4) % 2) == 0), "darkwood", 5)  # cross pins
    # the ridge roll: a round straw bolster along the ridge
    S.disc(g, "x", RIDGE + T, ZC, 3.4, X0 - VERGE + 1, X1 + VERGE - 1, "sand", 4, n=8)
    roll = S.last(g)
    straw(g, roll, frame="x", base=3, tie=99, seed=11)
    P.flat(g, roll & (X % 10 == 0), "sand", 2)  # the binding ties


def chimney(g: Grid) -> None:
    """A fieldstone chimney outside the right gable, tapering and leaning
    a little to the right, with a darker stone cap and a clay pot."""
    x0, x1, z0, z1 = CH
    X, Y, Z = idx(g)
    start = len(g.solids)
    g.prism("y", [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], 0, 40, C("stone", 5),
            top=[(x0 + 1, z0 + 1), (x1 - 1, z0 + 1), (x1 - 1, z1 - 1), (x0 + 1, z1 - 1)])
    g.prism("y", [(x0 + 1, z0 + 1), (x1 - 1, z0 + 1), (x1 - 1, z1 - 1), (x0 + 1, z1 - 1)], 40, 78, C("stone", 5),
            top=[(x0 + 4, z0 + 2), (x1 - 1, z0 + 2), (x1 - 1, z1 - 2), (x0 + 4, z1 - 2)])
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(5, 3), cracks=0.08, frame=fr, seed=20))
    cap = box(g, x0 + 2, 78, z0 + 1, x1 + 1, 81, z1 - 1, "stone", 3)
    P.stone(g, cap, "stone", 3, block=(5, 3), seed=21)
    pot = S.cone(g, "y", (x0 + x1) / 2 + 1.5, (z0 + z1) / 2, 2.6, 81, 85, "rust", 4, n=8, r_top=2.0)
    P.flat(g, pot & (Y == 84), "rust", 2)


def yard(g: Grid) -> None:
    """The cooking fire with the cauldron, the garden fence with cabbages,
    the log pile and the rain barrel (rule K1)."""
    X, Y, Z = idx(g)
    fx, fz = FIRE
    # the ring of stones and the burning logs
    for k in range(8):
        a = k * np.pi / 4
        sx, sz = fx + 7 * np.cos(a), fz + 7 * np.sin(a)
        st = S.cone(g, "y", sx, sz, 2.2, 0, 3, "stone", 4, n=6, r_top=1.3)
        P.flat(g, st & (Y == 2), "stone", 6)
    for p0, p1 in (((fx - 5, fz - 2), (fx + 5, fz + 2)), ((fx - 4, fz + 3), (fx + 4, fz - 3))):
        S.bar(g, "y", p0, p1, 2.2, 0, 2, "wood", 3)
    embers = box(g, int(fx) - 3, 0, int(fz) - 3, int(fx) + 3, 1, int(fz) + 3, "orange", 5)
    P.flat(g, embers & ((X + Z) % 2 == 0), "red", 4)
    # the iron tripod and the cauldron
    top = 24
    for k in range(3):
        a = np.pi / 2 + k * 2 * np.pi / 3
        lx, lz = fx + 9 * np.cos(a), fz + 9 * np.sin(a)
        g.prism("y", S.flat_ngon(lx, lz, 0.9, 4), 0, top, C("iron", 4), top=S.flat_ngon(fx, fz, 0.9, 4))
    box(g, int(fx) - 1, top - 1, int(fz) - 1, int(fx) + 1, top + 1, int(fz) + 1, "iron", 3)
    box(g, int(fx), 16, int(fz), int(fx) + 1, top - 1, int(fz) + 1, "iron", 5)  # the chain
    pot = S.cone(g, "y", fx + 0.5, fz + 0.5, 4.2, 7, 11, "iron", 3, n=8, r_top=5.4)
    pot |= S.cone(g, "y", fx + 0.5, fz + 0.5, 5.4, 11, 16, "iron", 3, n=8, r_top=4.6)
    P.flat(g, pot & (Y == 15), "iron", 5)
    P.flat(g, pot & (Y < 9), "iron", 1)  # soot
    stew = S.disc(g, "y", fx + 0.5, fz + 0.5, 3.8, 15, 16.5, "orange", 4, n=8)
    P.flat(g, stew & ((X + Z) % 3 == 0), "gold", 5)
    # the wicker garden fence in front of the left half, with cabbages
    for pz in range(12, 34, 5):
        box(g, 6, 0, pz, 8, 13, pz + 2, "darkwood", 4)
    for px in range(6, 28, 5):
        box(g, px, 0, 10, px + 2, 13, 12, "darkwood", 4)
    for wy in (4, 8):
        w1 = box(g, 6, wy, 10, 28, wy + 3, 12, "wood", 4)
        w2 = box(g, 6, wy, 10, 8, wy + 3, 34, "wood", 4)
        P.flat(g, (w1 | w2) & ((X + Z + Y) % 3 == 0), "wood", 3)
    for cx, cz in ((14, 18), (22, 18), (14, 26), (22, 27)):
        cab = S.cone(g, "y", cx, cz, 3.0, 0, 3, "leaf", 4, n=6, r_top=3.4)
        cab |= S.cone(g, "y", cx, cz, 3.4, 3, 5, "leaf", 5, n=6, r_top=1.4)
        P.flat(g, cab & (Y == 4), "leaf", 6)
    tufts(g, [(30, 22), (40, 14), (64, 26), (52, 18)], flowers=[("pink", 6), ("gold", 6)])
    # the log pile against the left gable, and a chopping block with an axe
    log_pile(g, X0 - 9, Z0 + 2, 0, length=26, r=3.0, rows=(3, 2), axis="z")
    blk = S.disc(g, "y", X0 - 7, Z0 - 8, 4.0, 0, 7, "wood", 4, n=8)
    P.flat(g, blk & (Y == 6), "sand", 5)
    g.prism("z", S.quad((X0 - 7, 7), (X0 - 3, 15), 0.9), Z0 - 9, Z0 - 7, C("wood", 5))
    g.prism("z", [(X0 - 9, 6), (X0 - 5, 6), (X0 - 4, 9), (X0 - 8, 9)], Z0 - 9, Z0 - 7, C("steel", 6))
    # the rain barrel at the back corner
    barrel(g, X1 - 6, Z1 + 7, 0, 18, 6, ramp="wood", hoop="iron")
    water = S.disc(g, "y", X1 - 6, Z1 + 7, 4.2, 17, 18, "sky", 4, n=8)
    P.flat(g, water & ((X + Z) % 4 == 0), "sky", 6)


def build() -> Asset:
    g = Grid(W, H, D)
    house(g)
    thatch(g)
    chimney(g)
    yard(g)
    fx, fz = FIRE
    return Asset(
        id="fantasy-buildings-thatched-cottage", pack="fantasy", category="buildings", name="Thatched Cottage",
        root=Part("thatched-cottage", g),
        sockets=[Socket("socket-function", at=(fx + 0.5, 3, fz + 0.5))],
        pfx=[{"effectId": "rvx-fantasy-hearth-fire", "socket": "socket-function", "trigger": "idle", "size": 22}],
    )
