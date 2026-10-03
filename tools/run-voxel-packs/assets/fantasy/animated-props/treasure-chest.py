"""Treasure chest in the Pirate Nation style.

One chunky planked box with thick gold corner caps and two iron straps, a
faceted barrel lid (true slopes) and an oversized gold lock plate with a
painted keyhole (rule K3). Inside, a heap of gold coins and gems (a low
frustum) that shows when the lid opens; the lid lining is red velvet.
PN chest scale (about 18–22 wide). The lid swings open on `open`, shuts on
`close` and rattles on `idle`. Faces -Z.
"""
import numpy as np

import paint as P
from _life import asset, coords, facet_paint, keys, pfx, plan, rig, side
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

S = (28, 26, 22)
X0, X1 = 4, 24  # body x
Z0, Z1 = 4, 18  # body z
H = 11  # body height
LID_TOP = 19
STRAPS = ((8, 10), (18, 20))


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = box(g, X0, 0, Z0, X1, H, Z1, "wood", 5)
    P.planks(g, m, "wood", 5, width=3, across="y", length=(10, 16), nails=False, seed=3)
    P.flat(g, edges(m), "darkwood", 3)
    # the coins heap on the top face (shows when the lid opens)
    top = m & (Y > H - 1) & (X > X0 + 1) & (X < X1 - 1) & (Z > Z0 + 1) & (Z < Z1 - 1)
    P.flat(g, top, "gold", 5)
    heap = plan(g, [(X0 + 3, Z0 + 3), (X1 - 3, Z0 + 3), (X1 - 3, Z1 - 3), (X0 + 3, Z1 - 3)], H, H + 4, "gold", 5,
                top=[(X0 + 8, Z0 + 6), (X1 - 7, Z0 + 6), (X1 - 7, Z1 - 5), (X0 + 8, Z1 - 5)])
    Xi, Yi, Zi = np.meshgrid(*(np.arange(n) for n in S), indexing="ij")
    coin = heap | top
    P.flat(g, coin & ((P._hash(Xi // 2, Yi, Zi // 2, seed=4) % np.uint64(4)) == 0), "gold", 7)
    P.flat(g, coin & ((P._hash(Xi // 2, Yi, Zi // 2, seed=5) % np.uint64(7)) == 0), "gold", 3)
    for gx, gz, ramp in ((X0 + 7, Z0 + 5, "red"), (X1 - 8, Z0 + 7, "sky"), (X0 + 12, Z1 - 5, "leaf")):
        P.flat(g, coin & (np.abs(X - gx - 0.5) < 1.1) & (np.abs(Z - gz - 0.5) < 1.1), ramp, 5)
    # thick gold corner caps, a gold foot band and iron straps (proud by 1)
    caps = np.zeros(S, dtype=bool)
    for cx in (X0 - 1, X1 - 2):
        for cz in (Z0 - 1, Z1 - 2):
            caps |= box(g, cx, 0, cz, cx + 3, H, cz + 3, "gold", 5)
    foot = box(g, X0 - 1, 0, Z0 - 1, X1 + 1, 2, Z1 + 1, "gold", 4)
    P.flat(g, caps & (Y > H - 1), "gold", 7)
    P.flat(g, edges(caps | foot), "gold", 3)
    for sx0, sx1 in STRAPS:
        for zf, zb in ((Z0 - 1, Z0), (Z1, Z1 + 1)):
            strap = box(g, sx0, 2, zf, sx1, H, zb, "iron", 6)
            P.flat(g, strap & ((np.floor(Y).astype(int) % 3) == 1), "steel", 6)
    # an oversized lock plate on the front, with a painted keyhole
    cx = (X0 + X1) // 2
    plate = box(g, cx - 3, 3, Z0 - 2, cx + 3, H, Z0 - 1, "gold", 5)
    P.flat(g, edges(plate), "gold", 3)
    P.flat(g, plate & (np.abs(X - cx) < 1.1) & (Y > 5) & (Y < 8), "darkwood", 1)
    P.flat(g, plate & (np.abs(X - cx) < 0.6) & (Y > 4) & (Y < 6), "darkwood", 1)
    P.flat(g, plate & (Y > H - 1), "gold", 7)
    P.grime(g, m, height=2, seed=6)
    return g


def lid() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    prof = [(H, Z0 - 0.5), (H + 4, Z0 + 0.5), (LID_TOP, Z0 + 4.5), (LID_TOP, Z1 - 4.5), (H + 4, Z1 - 0.5), (H, Z1 + 0.5)]
    m = side(g, prof, X0 - 0.5, X1 + 0.5, "wood", 5)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=3, across="y", length=(10, 16), nails=False, frame=fr, seed=7))
    # red velvet lining on the underside (seen when open)
    P.flat(g, m & (Y < H + 1) & (X > X0 + 1) & (X < X1 - 1) & (Z > Z0 + 1) & (Z < Z1 - 1), "red", 4)
    # gold end caps and a gold rim, iron straps over the vault
    ends = m & ((X < X0 + 2.5) | (X > X1 - 2.5))
    P.flat(g, ends, "gold", 5)
    P.flat(g, ends & (Y > LID_TOP - 1), "gold", 7)
    P.flat(g, m & (Y < H + 1) & ~((X > X0 + 1) & (X < X1 - 1) & (Z > Z0 + 1) & (Z < Z1 - 1)), "gold", 4)
    for sx0, sx1 in STRAPS:
        strap = m & (X > sx0) & (X < sx1)
        P.flat(g, strap, "iron", 6)
        P.flat(g, strap & (Y > LID_TOP - 1) & ((np.floor(Z).astype(int) % 4) == 1), "steel", 6)
    # the hasp that drops over the lock plate
    cx = (X0 + X1) // 2
    hasp = box(g, cx - 2, H - 2, Z0 - 2, cx + 2, H + 3, Z0 - 1, "gold", 4)
    P.flat(g, hasp & (Y < H - 1), "gold", 6)
    return g


def build():
    b, lg = body(), lid()
    hinge = ((X0 + X1) / 2, float(H), Z1 + 0.5)  # the back bottom edge of the lid
    root, to_root = rig([("chest", b, None, None), ("lid", lg, hinge, None)])
    open_k = {"lid": {"rot": keys((0, 0, 0, 0), (0.3, 105, 0, 0), (0.42, 92, 0, 0), (0.55, 98, 0, 0))}}
    close_k = {"lid": {"rot": keys((0, 98, 0, 0), (0.25, 0, 0, 0), (0.32, 5, 0, 0), (0.4, 0, 0, 0))}}
    idle_k = {"lid": {"rot": keys((0, 0, 0, 0), (0.8, 0, 0, 0), (0.9, 7, 0, 0), (1.0, 0, 0, 0), (1.1, 4, 0, 0), (1.2, 0, 0, 0), (2.0, 0, 0, 0))}}
    return asset("animated-props", "treasure-chest", "Treasure Chest", root,
                 clips=[Clip("idle", idle_k), Clip("open", open_k, loop=False), Clip("close", close_k, loop=False)],
                 sockets=[Socket("socket-loot", at=to_root(((X0 + X1) / 2, H + 2, (Z0 + Z1) / 2)))],
                 fx=[pfx("rvx-fantasy-loot-burst", "socket-loot", "clip:open", size=22, at=0.13)])
