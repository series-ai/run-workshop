"""Glowcap mushrooms in the Pirate Nation style.

A grove of giant fairy mushrooms on a mossy mound: a big red toadstool with
cream spots, a leaning royal-blue cap with sky spots, an orange cap with
gold spots and a few small caps round the foot. Every cap is a faceted dome
(stacked 8-sided frustums: true slopes) over a sloped underside whose gills
glow cyan (the magic accent, C3); stems are cream frustums with a bulb, a
sloped ring frill and painted fibres. Glow motes float round the caps as a
separate `motes` part that bobs and pulses on `idle`.

About 72 wide and 58 tall (terrain class): a person walks under the big
cap. Faces -Z.
"""
import math

import numpy as np

import paint as P
from _life import asset, coords, facet_paint, grass, ngon, plan, rig
from voxgrid import C, Clip, Grid

S = (80, 64, 74)
GOLDEN = math.pi * (3 - math.sqrt(5))


def shroom(g: Grid, cx, cz, h, r, cap: str, base: int, spot: tuple, glow: str = "plasma", lean=(0.0, 0.0), turn: float = 0.0, seed: int = 0) -> np.ndarray:
    """One mushroom standing on y=1: stem, frill, glowing gills and a spotted
    dome cap of flat-ish radius r whose top is at height h."""
    X, Y, Z = coords(g)
    lx, lz = lean
    rs = max(1.6, r * 0.26)
    cap_h = max(4.0, r * 0.78)
    yb = round(h - cap_h)  # underside of the cap (gill cone bottom); whole voxels
    y2 = yb + max(1, round(cap_h * 0.3))
    y3 = y2 + max(1, round(cap_h * 0.18))
    y4 = y3 + max(1, round((h - y3) * 0.6))
    h = max(h, y4 + 1)
    tx, tz = cx + lx, cz + lz  # the stem top (the cap centre)
    # stem: a bulb, then a leaning shaft
    st = len(g.solids)
    stem = plan(g, ngon(cx, cz, rs * 1.45, 8, turn), 1, 1 + max(2.0, rs * 0.8), "bone", 5, top=ngon(cx + lx * 0.1, cz + lz * 0.1, rs, 8, turn))
    y1 = 1 + max(2.0, rs * 0.8)
    stem |= plan(g, ngon(cx + lx * 0.1, cz + lz * 0.1, rs, 8, turn), y1, yb + 1, "bone", 5, top=ngon(tx, tz, rs * 0.85, 8, turn))
    ang = np.arctan2(Z - cz, X - cx)
    fibre = (np.floor((ang + math.pi) / (2 * math.pi) * 16).astype(int) % 2) == 0
    P.flat(g, stem & fibre, "bone", 4)
    P.flat(g, stem & (Y < 2), "sand", 4)
    # a ring frill that flares down (sloped)
    if r > 6:
        fy = yb - cap_h * 0.5
        f = fy - 1
        t = (fy - y1) / (yb + 1 - y1)
        fx, fz = cx + lx * (0.1 + 0.9 * t), cz + lz * (0.1 + 0.9 * t)
        frill = plan(g, ngon(fx, fz, rs + 2.2, 8, turn), f - 2, fy, "bone", 6, top=ngon(fx, fz, rs * 0.95, 8, turn))
        P.flat(g, frill & (Y < f - 1), "bone", 4)
    # the cap: glowing gill cone, a rim band and a two-step dome
    st = len(g.solids)
    gills = plan(g, ngon(tx, tz, rs * 1.1, 8, turn), yb, y2, glow, 6, top=ngon(tx, tz, r, 8, turn))
    rim = plan(g, ngon(tx, tz, r, 8, turn), y2, y3, cap, base, top=ngon(tx, tz, r * 0.96, 8, turn))
    dome = plan(g, ngon(tx, tz, r * 0.96, 8, turn), y3, y4, cap, base, top=ngon(tx, tz, r * 0.7, 8, turn))
    dome |= plan(g, ngon(tx, tz, r * 0.7, 8, turn), y4, h, cap, base, top=ngon(tx, tz, r * 0.3, 8, turn))
    # gills: bright spokes (angle sectors) on the cyan cone, brightest near the stem
    gang = np.arctan2(Z - tz, X - tx)
    spoke = (np.floor((gang + math.pi) / (2 * math.pi) * 24).astype(int) % 2) == 0
    near = np.hypot(X - tx, Z - tz) < r * 0.55
    P.flat(g, gills & spoke, glow, 7)
    P.flat(g, gills & ~spoke & near, glow, 7)
    P.flat(g, gills & ~spoke & ~near, glow, 5)
    # cap paint: lit top facet, a dark lip on the rim, round spots
    body = rim | dome

    def painter(gg, mm, fr):
        P.flat(gg, mm, cap, min(7, base + 1) if fr == "top" else base)

    facet_paint(g, g.solids[st + 1 :], painter)
    # the rim's lower edge catches the gill glow (a bright band, seen from the side)
    P.flat(g, rim & (Y < y2 + 1), glow, 6)
    n_spots = max(4, int(r * 0.7))
    rng = np.random.default_rng(seed)
    for k in range(n_spots):
        a = k * GOLDEN + turn
        f = 0.25 + 0.7 * math.sqrt((k + 0.5) / n_spots)
        sy = h - (h - y3) * f * f
        sr = r * (0.3 + 0.62 * f)
        px, pz = tx + sr * math.cos(a), tz + sr * math.sin(a)
        rad = r * (0.13 + 0.05 * rng.random())
        d = np.sqrt((X - px) ** 2 + ((Y - sy) * 1.3) ** 2 + (Z - pz) ** 2)
        P.flat(g, body & (d < rad), spot[0], spot[1])
        P.flat(g, body & (d < rad * 0.5), spot[0], min(7, spot[1] + 1))
    return body | gills | stem


def grove() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Zi = np.floor(X).astype(int), np.floor(Z).astype(int)
    jit = [1.0, 0.92, 1.06, 0.95, 1.08, 0.9, 1.04, 0.96, 1.07, 0.93]
    mound = plan(g, ngon(39, 36, 33, 10, 0.25, jit), 0, 2, "moss", 4, top=ngon(39, 36, 30.5, 10, 0.25, jit))
    cell = P._hash(Xi // 3, Zi // 3, seed=5) % np.uint64(7)
    P.flat(g, mound & (Y > 1), "leaf", 3)
    P.flat(g, mound & (Y > 1) & (cell == 1), "leaf", 4)
    P.flat(g, mound & (Y > 1) & (cell == 2), "moss", 5)
    P.flat(g, mound & (Y < 1), "moss", 3)
    # a soft cyan glow pool on the moss under the big cap
    pool = mound & (Y > 1) & (np.hypot(X - 35, Z - 36) < 9)
    P.flat(g, pool, "teal", 4)
    P.flat(g, pool & (np.hypot(X - 35, Z - 36) < 5), "teal", 5)
    shroom(g, 34, 36, 56, 19, "red", 4, ("bone", 6), lean=(1.0, -0.5), turn=0.1, seed=1)
    shroom(g, 58, 24, 38, 13, "blue", 4, ("sky", 6), lean=(3.0, -1.5), turn=0.3, seed=2)
    shroom(g, 15, 22, 28, 9.5, "orange", 4, ("gold", 7), lean=(-2.0, -1.0), turn=0.5, seed=3)
    for k, (x, z, h, r, cap, spot) in enumerate(((60, 50, 12, 5.5, "red", ("bone", 6)), (14, 48, 10, 4.5, "blue", ("sky", 6)),
                                                 (46, 58, 8, 4.0, "orange", ("gold", 7)), (70, 38, 9, 4.0, "red", ("bone", 6)),
                                                 (26, 58, 7, 3.5, "red", ("bone", 6)), (8, 34, 7, 3.5, "blue", ("sky", 6)))):
        shroom(g, x, z, h, r, cap, 4, spot, lean=((k % 3 - 1) * 0.8, 0.4), turn=0.2 * k, seed=10 + k)
    grass(g, [(20, 2, 58), (40, 2, 14), (66, 2, 12), (72, 2, 48), (50, 2, 44), (10, 2, 40), (24, 2, 10)], "leaf", 5)
    return g


MOTES = [(20, 38, 50, 0), (50, 46, 16, 1), (66, 30, 44, 0), (10, 34, 30, 1), (44, 28, 58, 0), (26, 20, 64, 1)]


def motes() -> Grid:
    g = Grid(*S)
    for x, y, z, k in MOTES:
        ramp = "plasma" if k == 0 else "gold"
        g.box(x, y, z, x + 3, y + 3, z + 3, C(ramp, 6))
        g.box(x, y + 1, z, x + 3, y + 2, z + 3, C(ramp, 7))
    return g


def build():
    root, _to_root = rig([("giant-mushrooms", grove(), None, None), ("motes", motes(), (40.0, 30.0, 40.0), None)])
    idle = {"motes": {"loc": [(t, (0.0, 3.0 * math.sin(t / 3 * 2 * math.pi + math.pi / 2), 0.0)) for t in (0, 0.75, 1.5, 2.25, 3.0)],
                      "scale": [(0.0, (1.0, 1.0, 1.0)), (1.5, (1.2, 1.2, 1.2)), (3.0, (1.0, 1.0, 1.0))]}}
    return asset("terrain-nature", "giant-mushrooms", "Glowcap Mushrooms", root, clips=[Clip("idle", idle)])
