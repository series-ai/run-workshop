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

S = (80, 68, 74)
G = 5  # ground top
GOLDEN = math.pi * (3 - math.sqrt(5))


def _hash_rows(Y, ang, seed: int) -> np.ndarray:
    """0 on about one fibre sector in four, picked per sector (long streaks)."""
    sector = np.floor((ang + math.pi) / (2 * math.pi) * 16).astype(int)
    return (P._hash(sector, seed=seed + 40) % np.uint64(4)).astype(int) + 0 * Y.astype(int)


def shroom(g: Grid, cx, cz, h, r, cap: str, base: int, spot: tuple, glow: str = "plasma", lean=(0.0, 0.0), turn: float = 0.0, seed: int = 0, y0: int = 1) -> np.ndarray:
    """One mushroom whose stem foot is sunk one voxel into the ground at y0:
    stem, frill, glowing gills and a spotted dome cap of flat-ish radius r
    whose top is h above y=1 when y0 is 1."""
    X, Y, Z = coords(g)
    h = h + (y0 - 1)
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
    stem = plan(g, ngon(cx, cz, rs * 1.45, 8, turn), y0, y0 + max(2.0, rs * 0.8), "bone", 5, top=ngon(cx + lx * 0.1, cz + lz * 0.1, rs, 8, turn))
    y1 = y0 + max(2.0, rs * 0.8)
    stem |= plan(g, ngon(cx + lx * 0.1, cz + lz * 0.1, rs, 8, turn), y1, yb + 1, "bone", 5, top=ngon(tx, tz, rs * 0.85, 8, turn))
    ang = np.arctan2(Z - cz, X - cx)
    fibre = (np.floor((ang + math.pi) / (2 * math.pi) * 16).astype(int) % 2) == 0
    P.flat(g, stem & fibre, "bone", 4)
    P.flat(g, stem & fibre & (_hash_rows(Y, ang, seed) == 0), "sand", 4)  # a few long darker fibres
    sector = np.floor((ang + math.pi) / (2 * math.pi) * 16).astype(int)
    scale = stem & (Y > y1) & (Y < yb - 2) & ((np.floor(Y).astype(int) + (sector % 2) * 2) % 5 == 0)
    P.flat(g, scale, "sand", 5)  # snakeskin bands of the toadstool stem
    P.flat(g, stem & ~fibre & (_hash_rows(Y, ang, seed + 1) == 0), "bone", 6)  # and lit ones between
    P.flat(g, stem & (Y >= y1 - 1) & (Y < y1), "bone", 3)  # a dark ring where the bulb meets the shaft
    P.flat(g, stem & (Y > yb - 2), "bone", 3)  # shadow under the cap
    P.flat(g, stem & (Y > yb - 2) & fibre, "bone", 2)
    P.flat(g, stem & (Y < y0 + 2), "sand", 3)  # soil splash on the foot
    P.flat(g, stem & (Y < y0 + 2) & ~fibre, "sand", 4)
    # a ring frill that flares down (sloped)
    if r > 6:
        fy = yb - cap_h * 0.5
        f = fy - 1
        t = (fy - y1) / (yb + 1 - y1)
        fx, fz = cx + lx * (0.1 + 0.9 * t), cz + lz * (0.1 + 0.9 * t)
        frill = plan(g, ngon(fx, fz, rs + 2.2, 8, turn), f - 2, fy, "bone", 6, top=ngon(fx, fz, rs * 0.95, 8, turn))
        P.flat(g, frill & (Y < f - 1), "bone", 3)  # shaded underside of the frill
        P.flat(g, frill & (Y >= f - 1) & (Y < f), "bone", 5)
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
    # a dark lip on the rim's lower edge outlines the cap against the glowing gills
    P.flat(g, rim & (Y < y2 + 1), cap, max(1, base - 2))
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
    jit = [1.0, 0.94, 1.05, 0.96, 1.06, 0.93, 1.04, 0.97, 1.05, 0.95]
    # stepped ground: an earth plinth, a grassy tier, and a raised hummock under the big cap
    plinth = plan(g, ngon(39, 36, 34, 10, 0.25, jit), 0, 3, "wood", 3, top=ngon(39, 36, 33, 10, 0.25, jit))
    tier = plan(g, ngon(39, 36, 31.5, 10, 0.25, jit), 3, G, "leaf", 4, top=ngon(39, 36, 30.5, 10, 0.25, jit))
    hump = plan(g, ngon(36, 37, 14, 9, 0.4), G, G + 1, "leaf", 4, top=ngon(36, 37, 13, 9, 0.4))
    # earth sides: soil courses, darker toward the bottom, with a few stones
    P.stone(g, plinth, "wood", 3, block=(7, 2), mortar=-1, cracks=0.0, seed=3)
    P.flat(g, plinth & (Y < 1), "wood", 1)
    stones = plinth & (Y >= 1) & (P._hash((Xi + Zi) // 3, seed=8) % np.uint64(7) == 0)
    P.flat(g, stones, "stone", 5)
    P.flat(g, stones & (Y >= 2), "stone", 6)
    P.flat(g, plinth & (Y > 2), "wood", 4)  # the plinth's top ledge, lit
    side = tier & (Y < G - 1)
    P.flat(g, side, "wood", 3)
    P.flat(g, side & (P._hash(Xi + Zi, seed=11) % np.uint64(3) == 0), "leaf", 2)  # grass roots dripping over the edge
    P.flat(g, tier & (Y >= G - 1), "leaf", 3)
    # the grass top: large coherent patches, a worn soil path and a glowing pool
    top = (tier | hump) & (Y >= G - 1)
    P.flat(g, top, "leaf", 4)
    for bx, bz, br, ramp, sh in ((22, 30, 7, "leaf", 5), (54, 44, 6, "leaf", 5), (44, 20, 7, "forest", 5), (24, 50, 6, "forest", 5),
                                 (60, 30, 5, "leaf", 5), (30, 18, 4, "leaf", 5), (48, 56, 5, "forest", 5)):
        P.flat(g, top & (np.hypot(X - bx, Z - bz) < br), ramp, sh)
    path = top & (np.abs((X - 39) * 0.45 + (Z - 66) * 0.9) < 2.2) & (Z > 48)
    P.flat(g, path, "wood", 5)
    P.flat(g, path & (P._hash(Xi // 2, Zi // 2, seed=6) % np.uint64(4) == 0), "wood", 4)
    rim = top & ~hump & (np.hypot(X - 39, Z - 36) > 28.5)
    P.flat(g, rim, "leaf", 5)  # lit grass lip round the edge
    pool = top & (np.hypot(X - 35, Z - 36) < 10)
    P.flat(g, pool, "teal", 4)
    P.flat(g, pool & (np.hypot(X - 35, Z - 36) < 6.5), "teal", 5)
    P.flat(g, pool & (np.hypot(X - 35, Z - 36) < 3.5), "plasma", 6)
    shroom(g, 34, 36, 56, 19, "red", 4, ("bone", 6), lean=(1.0, -0.5), turn=0.1, seed=1, y0=G)
    shroom(g, 57, 25, 38, 13, "blue", 4, ("sky", 6), lean=(3.0, -1.5), turn=0.3, seed=2, y0=G - 1)
    shroom(g, 19, 25, 28, 9.5, "orange", 4, ("gold", 7), lean=(-2.0, -1.0), turn=0.5, seed=3, y0=G - 1)
    for k, (x, z, h, r, cap, spot) in enumerate(((57, 48, 12, 5.5, "red", ("bone", 6)), (18, 46, 10, 4.5, "blue", ("sky", 6)),
                                                 (45, 56, 8, 4.0, "orange", ("gold", 7)), (63, 37, 9, 4.0, "red", ("bone", 6)),
                                                 (28, 55, 7, 3.5, "red", ("bone", 6)), (15, 36, 7, 3.5, "blue", ("sky", 6)))):
        shroom(g, x, z, h, r, cap, 4, spot, lean=((k % 3 - 1) * 0.8, 0.4), turn=0.2 * k, seed=10 + k, y0=G - 1)
    grass(g, [(22, G, 54), (40, G, 14), (60, G, 16), (64, G, 44), (50, G, 44), (13, G, 42), (27, G, 14), (49, G, 30)], "leaf", 5)
    return g


# spores drifting down from the glowing gills: small sparkles grouped under the caps
MOTES = [(22, 38, 30, 0), (46, 41, 40, 1), (28, 34, 48, 0), (42, 36, 24, 0), (19, 42, 42, 1), (48, 33, 31, 0), (60, 22, 33, 1), (54, 19, 18, 0)]


def motes() -> Grid:
    g = Grid(*S)
    for x, y, z, k in MOTES:
        ramp = "plasma" if k == 0 else "gold"
        for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            g.set(x + dx, y + dy, z + dz, C(ramp, 5))
        g.set(x, y, z, C(ramp, 7))
    return g


def build():
    root, _to_root = rig([("giant-mushrooms", grove(), None, None), ("motes", motes(), (34.0, 32.0, 36.0), None)])
    idle = {"motes": {"loc": [(t, (0.0, 3.0 * math.sin(t / 3 * 2 * math.pi + math.pi / 2), 0.0)) for t in (0, 0.75, 1.5, 2.25, 3.0)],
                      "scale": [(0.0, (1.0, 1.0, 1.0)), (1.5, (1.2, 1.2, 1.2)), (3.0, (1.0, 1.0, 1.0))]}}
    return asset("terrain-nature", "giant-mushrooms", "Glowcap Mushrooms", root, clips=[Clip("idle", idle)])
