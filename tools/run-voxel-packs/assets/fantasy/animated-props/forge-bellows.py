"""Forge with bellows in the Pirate Nation style.

A chunky stone hearth: two piers and a back wall frame a wide glowing mouth
over a heaped bed of coals (orange and gold glow, rule C3), under a big
tapered stone hood (a leaning frustum, true slopes) with a timber lintel
and a square chimney. Beside it, on a planked stand, a fat leather bellows
(rule K3): a paddle-shaped top board with iron studs and a handle, pleated
leather and an iron nozzle into the hearth. Flame tongues lick up from the
coals. About 37 wide and 40 tall.
Clips: idle (a slow pump, soft flames), active (fast pumping, the flames
flare; loops while the forge works). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S_
from _life import asset, coords, facet_paint, keys, pfx, plan, rig
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

S = (42, 44, 26)
HX0, HX1 = 3, 21  # hearth x
HZ0, HZ1 = 6, 20  # hearth z
HY = 9  # hearth top (the coal bed)
MOUTH = 18  # top of the mouth (the lintel sits on it)
PIER = 3  # pier width
CX = (HX0 + HX1) / 2
CZ = 13.0
STAND = (24, 38, 8, 18, 7)  # x0, x1, z0, z1, top y
BOARD_Y = 8  # bottom board y0 (1 thick)
TOP_Y = 13  # top board y0
HINGE = (24.5, float(TOP_Y), CZ)
PADDLE = [(24.0, 11.2), (29.0, 8.6), (35.0, 8.6), (37.6, 10.6), (37.6, 15.4), (35.0, 17.4), (29.0, 17.4), (24.0, 14.8)]


def inset(poly, d):
    cx = sum(p[0] for p in poly) / len(poly)
    cz = sum(p[1] for p in poly) / len(poly)
    return [(cx + (x - cx) * (1 - d), cz + (z - cz) * (1 - d)) for x, z in poly]


def forge() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # the hearth block, its piers and back wall (coursed stone)
    base = box(g, HX0, 0, HZ0, HX1, HY, HZ1, "stone", 5)
    walls = box(g, HX0, HY, HZ0, HX0 + PIER, MOUTH, HZ1, "stone", 5)
    walls |= box(g, HX1 - PIER, HY, HZ0, HX1, MOUTH, HZ1, "stone", 5)
    walls |= box(g, HX0, HY, HZ1 - 4, HX1, MOUTH, HZ1, "stone", 5)
    P.stone(g, base | walls, "red", 5, block=(4, 2), mortar=-2, seed=1)
    plinth = box(g, HX0 - 1, 0, HZ0 - 1, HX1 + 1, 2, HZ1 + 1, "stone", 5)
    P.stone(g, plinth, "stone", 5, block=(5, 2), seed=11)
    P.flat(g, edges(plinth), "stone", 4)
    top = box(g, HX0 - 1, HY - 1, HZ0 - 1, HX1 + 1, HY, HZ1 + 1, "stone", 6)
    P.flat(g, edges(top), "stone", 5)
    P.grime(g, base, height=2, seed=2)
    # firelight on the inner faces of the mouth
    P.flat(g, walls & (X >= HX0 + PIER - 1) & (X < HX0 + PIER), "orange", 5)
    P.flat(g, walls & (X >= HX1 - PIER) & (X < HX1 - PIER + 1), "orange", 5)
    P.flat(g, walls & (Z >= HZ1 - 4) & (Z < HZ1 - 3) & (X > HX0 + PIER) & (X < HX1 - PIER), "orange", 4)
    # the coal bed: a low heaped frustum of embers
    coal = plan(g, [(HX0 + PIER, HZ0 + 1), (HX1 - PIER, HZ0 + 1), (HX1 - PIER, HZ1 - 4), (HX0 + PIER, HZ1 - 4)], HY, HY + 3, "red", 3,
                top=[(CX - 3.5, HZ0 + 4), (CX + 3.5, HZ0 + 4), (CX + 3.5, HZ1 - 6), (CX - 3.5, HZ1 - 6)])
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))
    lump = P._hash(Xi // 2, Yi // 2, Zi // 2, seed=3) % np.uint64(5)
    P.flat(g, coal, "ember", 1)
    P.flat(g, coal & (lump == 0), "red", 3)
    P.flat(g, coal & (lump == 1), "ember", 3)
    rr = np.hypot(X - CX, Z - (HZ0 + HZ1 - 4) / 2)
    P.flat(g, coal & (rr < 4.5), "ember", 4)
    P.flat(g, coal & (rr < 2.6), "ember", 6)
    P.flat(g, coal & (rr < 1.2), "gold", 7)
    # the timber lintel and the tapered stone hood, leaning a little
    lint = box(g, HX0 - 1, MOUTH, HZ0 - 1, HX1 + 1, MOUTH + 2, HZ1 + 1, "darkwood", 4)
    P.planks(g, lint, "darkwood", 4, width=2, across="y", seed=4)
    P.flat(g, edges(lint), "darkwood", 3)
    start = len(g.solids)
    lean = 1.0
    hood = plan(g, [(HX0 - 0.5, HZ0 - 0.5), (HX1 + 0.5, HZ0 - 0.5), (HX1 + 0.5, HZ1 + 0.5), (HX0 - 0.5, HZ1 + 0.5)], MOUTH + 2, 30,
                "stone", 5, top=[(CX - 3.5 + lean, CZ - 2.5), (CX + 3.5 + lean, CZ - 2.5), (CX + 3.5 + lean, CZ + 3.5), (CX - 3.5 + lean, CZ + 3.5)])
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 4, block=(5, 3), frame=fr, seed=5))
    P.flat(g, hood & S_.seams(g, g.solids[start:], 0.7), "stone", 5)
    P.flat(g, hood & (Y < MOUTH + 3), "stone", 3)
    # the chimney stack and its cap
    ch = box(g, CX - 3.5 + lean, 30, CZ - 2.5, CX + 3.5 + lean, 38, CZ + 3.5, "red", 5)
    P.stone(g, ch, "red", 5, block=(4, 2), mortar=-2, seed=6)
    cap = box(g, CX - 4.5 + lean, 38, CZ - 3.5, CX + 4.5 + lean, 40, CZ + 4.5, "stone", 3)
    P.flat(g, edges(cap), "stone", 2)
    P.flat(g, cap & (Y > 39) & (np.abs(X - CX - lean) < 2.6) & (np.abs(Z - CZ - 0.5) < 2.6), "stone", 1)
    # the bellows stand, the bottom board and the iron nozzle
    x0, x1, z0, z1, sy = STAND
    stand = box(g, x0, 0, z0, x1, sy, z1, "wood", 4)
    P.planks(g, stand, "wood", 4, width=3, across="y", seed=7)
    P.flat(g, edges(stand), "darkwood", 3)
    bb = plan(g, PADDLE, BOARD_Y - 1, BOARD_Y + 1, "wood", 5)
    P.planks(g, bb, "wood", 5, width=3, across="x", nails=False, seed=8)
    P.flat(g, bb & (Y < BOARD_Y), "darkwood", 3)
    noz = S_.cone(g, "x", 10.0, CZ, 1.6, HX1 - 1, 25, "steel", 4, r_top=0.9, tip="lo")
    P.flat(g, noz, "steel", 4)
    P.flat(g, noz & (X > 23), "iron", 6)
    return g


def bellows_top() -> Grid:
    """The leather (reaching down into the stand, so it never gaps when the
    board lifts) and the paddle top board with studs and a handle."""
    g = Grid(*S)
    X, Y, _Z = coords(g)
    leather = plan(g, inset(PADDLE, 0.1), 3, TOP_Y, "orange", 3)
    P.flat(g, leather, "orange", 3)
    P.flat(g, leather & ((np.floor(Y).astype(int) % 2) == 0), "orange", 4)
    P.flat(g, leather & (Y > TOP_Y - 1), "orange", 2)
    board = plan(g, PADDLE, TOP_Y, TOP_Y + 2, "wood", 5)
    P.planks(g, board, "wood", 5, width=3, across="x", nails=False, seed=9)
    P.flat(g, board & (Y < TOP_Y + 1), "wood", 3)
    studs = board & (Y > TOP_Y + 1) & (((np.floor(X).astype(int) - 25) % 4) == 0) & (np.abs(_Z - CZ) > 3.2)
    P.flat(g, studs, "gold", 6)
    P.flat(g, board & (Y > TOP_Y + 1) & (X > 30) & (X < 32) & (np.abs(_Z - CZ) < 2.2), "gold", 5)
    hnd = box(g, 37, TOP_Y, CZ - 1, 40, TOP_Y + 2, CZ + 1, "darkwood", 4)
    P.flat(g, hnd & (X > 39), "darkwood", 3)
    return g


def flames() -> Grid:
    """Three flame tongues over the coals (true slopes, glowing)."""
    g = Grid(*S)
    _X, Y, _Z = coords(g)
    m = np.zeros(S, dtype=bool)
    for dx, h, w in ((-3.0, 3.5, 1.8), (0.5, 5.0, 2.4), (3.5, 3.0, 1.6)):
        fx = CX + dx
        g.prism("z", [(fx - w, HY + 2), (fx + w, HY + 2), (fx + 0.3, HY + 2 + h)], 10, 13, C("ember", 5))
        m |= g.solids[-1].mask(S)
    P.flat(g, m, "ember", 5)
    P.flat(g, m & (Y < HY + 3.5), "gold", 7)
    P.flat(g, m & (Y > HY + 5), "orange", 5)
    return g


def build():
    f, b, fl = forge(), bellows_top(), flames()
    root, to_root = rig([("forge", f, None, None), ("bellows-top", b, HINGE, None), ("flames", fl, (CX, HY + 2.0, CZ), None)])
    idle = {"bellows-top": {"rot": keys((0, 0, 0, 0), (1.2, 0, 0, 7), (2.4, 0, 0, 0))},
            "flames": {"scale": keys((0, 1, 1, 1), (0.6, 1, 1.15, 1), (1.2, 1, 0.9, 1), (1.8, 1, 1.1, 1), (2.4, 1, 1, 1))}}
    active = {"bellows-top": {"rot": keys((0, 0, 0, 0), (0.35, 0, 0, 16), (0.7, 0, 0, 0))},
              "flames": {"scale": keys((0, 1, 1, 1), (0.35, 1.1, 1.3, 1.1), (0.5, 1.2, 1.7, 1.2), (0.7, 1, 1, 1))}}
    return asset("animated-props", "forge-bellows", "Forge with Bellows", root,
                 clips=[Clip("idle", idle), Clip("active", active)],
                 sockets=[Socket("socket-coals", at=to_root((CX, HY + 3.0, CZ - 1.0))), Socket("socket-chimney", at=to_root((CX + 1.0, 40.0, CZ + 0.5)))],
                 fx=[pfx("rvx-fantasy-forge-flare", "socket-coals", "clip:active", size=30, aim=(0.0, 0.6, -0.8)), pfx("rvx-fantasy-chimney-smoke", "socket-chimney", "idle", size=18)])
