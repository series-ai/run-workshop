"""Loads that ride on wagons. A load's origin is the centre of its base,
which goes on a wagon's `socket-load`; its `loadClass` names the wagons that
carry it ("flat": flatcar, log car, container spine; "gondola": gondola)."""
from __future__ import annotations

import numpy as np

import pnkit as K
from catalog import plain
from pnshapes import disc
from railkit import C, Grid, P, Part, coords
from shapes import extrude


def container(name="load-container", paint="teal", trim="skin") -> tuple[Part, list, list, dict]:
    """A 40-foot-style shipping container, ribbed, doors at the rear."""
    W, H, Lc = 42, 40, 112
    g = Grid(W, H, Lc)
    box = extrude(g, [(0, 0), (W, 0), (W, H), (0, H)], 0, Lc, paint, 4)
    X, Y, Z = coords(g)
    P.flat(g, box & ((Z % 5 == 0) | (Y == H - 1)), paint, 3)  # corrugation and top rail
    P.flat(g, box & ((Y == 0) | (Z < 2) | (Z >= Lc - 2)), paint, 2)  # frame
    rear = box & (Z == Lc - 1)
    P.flat(g, rear & ((X == W // 2) | (X == W // 2 - 1)), paint, 1)  # door split
    for x in (8, 16, W - 17, W - 9):  # locking bars
        P.flat(g, rear & (X == x) & (Y > 3) & (Y < H - 3), trim, 6)
    for sx in (0, W - 1):  # corner castings
        for sz in (0, Lc - 1):
            for sy in (0, H - 1):
                g.set(sx, sy, sz, C(trim, 5))
    root = Part(name, g, pivot=(W / 2, 0, Lc / 2))
    return root, [], [], {"kind": "load", "loadClass": "flat", "paint": paint, "trim": trim}


def coal(name="load-coal") -> tuple[Part, list, list, dict]:
    """A heaped load of coal that fills a gondola and mounds above its sides."""
    W, Lc, H = 38, 110, 20
    g = Grid(W, H, Lc)
    X, Y, Z = coords(g)
    # heights are set per 3 x 5 block of columns, so the heap reads as chunky lumps (and stays cheap)
    bx, bz = (X // 3) * 3 + 1.5, (Z // 5) * 5 + 2.5
    u = (bx - W / 2) / (W / 2)
    v = (bz - Lc / 2) / (Lc / 2)
    height = 5 + 13 * np.clip(1 - u ** 2, 0, 1) * np.clip(1 - v ** 8, 0, 1) + np.where(((X // 3) + (Z // 5)) % 3 == 0, 1, 0)
    heap = Y < np.floor(height)
    g.where(heap, C("iron", 2))
    rng = np.random.default_rng(5)
    noise = rng.random(g.shape)
    g.a[heap & (noise < 0.3)] = C("iron", 1)
    g.a[heap & (noise > 0.82)] = C("iron", 3)
    root = Part(name, g, pivot=(W / 2, 0, Lc / 2))
    return root, [], [], {"kind": "load", "loadClass": "gondola"}


def logs(name="load-logs") -> tuple[Part, list, list, dict]:
    """A stack of logs, four layers high, chained down at two points; the
    cut ends show their rings and the stack is staggered like a real load."""
    r, Lc = 5.0, 100
    W, H, D = 42, 38, Lc + 6
    g = Grid(W, H, D)
    rng = np.random.default_rng(11)
    X, Y, Z = coords(g)
    for k, n in enumerate((4, 3, 2, 1)):
        cy = r + k * r * 1.732
        for i in range(n):
            cx = W / 2 + (i - (n - 1) / 2) * 2 * r
            off = int(rng.integers(0, 6))
            log = disc(g, "z", cx, cy, r - 0.2, off, off + Lc, "darkwood", 3, n=8)
            P.flat(g, log & (((X + Y + Z) % 5) == 0), "darkwood", 2)  # bark
            rr = np.hypot(X + 0.5 - cx, Y + 0.5 - cy)
            cut = log & ((Z == off) | (Z == off + Lc - 1))
            P.flat(g, cut, "wood", 6)
            P.flat(g, cut & (np.abs(rr - 2.5) < 0.6), "wood", 4)
            P.flat(g, cut & (rr < 0.8), "wood", 3)
    solid = g.a > 0
    for zc in (28, 76):  # chains
        P.flat(g, solid & (Z >= zc) & (Z < zc + 2), "steel", 3)
    root = Part(name, g, pivot=(W / 2, 0, D / 2))
    return root, [], [], {"kind": "load", "loadClass": "flat"}


def crates(name="load-crates") -> tuple[Part, list, list, dict]:
    """Wooden crates of mixed sizes stacked on two pallets."""
    W, H, Lc = 40, 36, 100
    g = Grid(W, H, Lc)
    for z0, z1 in ((0, 48), (52, 100)):  # pallets
        K.box(g, 0, 0, z0, W, 3, z1, "wood", 2)
    boxes = [(1, 3, 1, 19, 21, 23), (21, 3, 1, 39, 19, 23), (1, 3, 25, 39, 23, 47), (3, 21, 3, 17, 33, 21), (5, 23, 27, 33, 33, 45),
             (2, 3, 53, 38, 31, 85), (4, 3, 87, 20, 17, 99), (22, 3, 87, 36, 19, 99), (8, 31, 58, 30, 36, 80)]
    for k, b in enumerate(boxes):
        m = K.box(g, *b, "wood", 4 + (k % 2))
        P.planks(g, m, "wood", 4 + (k % 2), width=3, across="y", nails=False, grain=False, seed=k)
        P.flat(g, K.edges(m), "darkwood", 3)
    root = Part(name, g, pivot=(W / 2, 0, Lc / 2))
    return root, [], [], {"kind": "load", "loadClass": "flat"}


def pipes(name="load-pipes") -> tuple[Part, list, list, dict]:
    """A bundle of steel pipes on timber bearers, strapped in three places;
    the open ends show dark."""
    r, Lc = 3.0, 104
    W, H, D = 42, 26, Lc + 4
    g = Grid(W, H, D)
    for z0 in (10, 92):  # bearers
        g.box(2, 0, z0, W - 2, 3, z0 + 6, C("wood", 3))
    X, Y, Z = coords(g)
    for k, n in enumerate((6, 5, 4, 3)):
        cy = 3 + r + k * r * 1.732
        for i in range(n):
            cx = W / 2 + (i - (n - 1) / 2) * 2 * r
            p = disc(g, "z", cx, cy, r, 2, 2 + Lc, "steel", 4 + (i + k) % 2, n=8)
            rr = np.hypot(X + 0.5 - cx, Y + 0.5 - cy)
            P.flat(g, p & ((Z == 2) | (Z == 1 + Lc)) & (rr < r - 1.0), "iron", 1)
    solid = g.a > 0
    for zc in (20, 53, 86):  # straps
        P.flat(g, solid & (Y >= 3) & (Z >= zc) & (Z < zc + 2), "iron", 3)
    root = Part(name, g, pivot=(W / 2, 0, D / 2))
    return root, [], [], {"kind": "load", "loadClass": "flat"}


CATALOG = [
    plain("freight-loads", container, "props", "kit", "loads", tier="slice"),
    plain("freight-loads", coal, "props", "kit", "loads"),
    plain("freight-loads", logs, "props", "kit", "loads"),
    plain("freight-loads", crates, "props", "kit", "loads"),
    plain("freight-loads", pipes, "props", "kit", "loads"),
]
