"""Ghost ship, in the Pirate Nation haunted style.

After the PN undead pirate ships: a chunky spectral galleon with a tall,
flared, rotting plank hull in sickly moss green (one faceted frustum, true
slopes, rule F2), a teal band of gun ports glowing toxic green with cannon
muzzles, cracks of light, a raised forecastle and a tall stern castle with
glowing gallery windows and lanterns, and a big bone skull figurehead.
Three masts carry billowing torn purple sails (curved true slopes, torn
into strips; the main sail has a painted skull, rule F6), shrouds and a
crow's nest; a torn toxic-green flag flies from the main mast. `move`: the
ship pitches and rolls, the masts sway and the flag streams; `idle`: it
bobs gently and the flag flutters. Faces -Z (the bow).
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import coords, parts, sail
from pnkit import box
from voxgrid import C, Asset, Clip, Grid, Socket

G = (64, 134, 110)
CX = 32.0
DECK = 36
STERN0, STERN1 = 80, 106  # stern castle z
MASTS = {"mast-fore": (26.0, 102), "mast-main": (50.0, 120), "mast-mizzen": (72.0, 100)}  # z, top y
KEEL = [(CX, 16), (CX + 6, 24), (CX + 10, 58), (CX + 8, 94), (CX - 8, 94), (CX - 10, 58), (CX - 6, 24)]
TOP = [(CX, 2), (CX + 17, 16), (CX + 22, 52), (CX + 20, STERN1), (CX - 20, STERN1), (CX - 22, 52), (CX - 17, 16)]
PIVOT = (CX, 0.0, 54.0)


def hull() -> Grid:
    g = Grid(*G)
    X, Y, Z = coords(g)
    g.prism("y", KEEL, 0, DECK, C("moss", 7), top=TOP)
    shell = [g.solids[-1]]
    hm = S.last(g)
    S.paint_facets(g, shell, lambda gg, mm, fr: P.planks(gg, mm, "moss", 7, width=3, across="y" if fr != "top" else "x", length=(14, 24), frame=fr, seed=1))
    P.flat(g, hm & (Y < 8), "teal", 4)
    P.flat(g, hm & (Y >= 8) & (Y < 9), "moss", 5)
    band = hm & (Y >= 20) & (Y < 28)
    P.flat(g, band, "teal", 5)
    P.flat(g, hm & (((Y >= 19) & (Y < 20)) | ((Y >= 28) & (Y < 29))), "moss", 5)
    P.flat(g, hm & (Y > DECK - 3) & (Y < DECK - 1), "teal", 5)
    # gun ports glowing toxic, cannon muzzles, cracks of light
    for z in range(24, 90, 13):
        port = band & (Z >= z) & (Z < z + 6) & (Y >= 21) & (Y < 27)
        P.flat(g, port, "teal", 2)
        P.flat(g, port & (Y < 23.5), "toxic", 5)
        xs = [x for x in range(g.shape[0]) if g.a[x, 23, z + 3] > 0]
        if xs:
            box(g, min(xs) - 3, 22, z + 1.5, min(xs), 25, z + 4.5, "gray", 3)
            box(g, max(xs) + 1, 22, z + 1.5, max(xs) + 4, 25, z + 4.5, "gray", 3)
    crack = hm & (Y > 9) & (Y < 19) & ((P._hash(Z.astype(int) // 5, X.astype(int) // 30, seed=2) % np.uint64(6)) == 0) & ((Y.astype(int) + Z.astype(int)) % 7 == 0)
    P.flat(g, crack, "toxic", 6)
    deck = hm & (Y > DECK - 1)
    P.planks(g, deck, "wood", 6, width=3, across="z", nails=True, frame="top", seed=3)
    # bulwarks, the forecastle and the tall stern castle
    for s in (-1, 1):
        x0 = CX + s * 20 - (2 if s > 0 else 0)
        rail = box(g, x0, DECK, 22, x0 + 2, DECK + 5, STERN0, "moss", 6)
        P.planks(g, rail, "moss", 6, width=2, across="y", nails=False, seed=4)
        P.flat(g, rail & (Y > DECK + 4), "wood", 6)
    fc = box(g, CX - 15, DECK, 9, CX + 15, DECK + 8, 22, "moss", 6)
    P.planks(g, fc, "moss", 6, width=3, across="y", nails=True, seed=5)
    P.flat(g, fc & (Y > DECK + 7), "wood", 6)
    sc = box(g, CX - 20, DECK, STERN0, CX + 20, DECK + 20, STERN1, "moss", 7)
    P.planks(g, sc, "moss", 7, width=3, across="y", nails=True, seed=6)
    P.flat(g, sc & (Y > DECK + 18), "moss", 5)
    for x in range(int(CX) - 15, int(CX) + 14, 8):  # gallery windows on the stern
        win = sc & (Z > STERN1 - 1) & (X >= x) & (X < x + 5) & (Y > DECK + 6) & (Y < DECK + 16)
        P.flat(g, win, "toxic", 5)
        P.flat(g, win & (Y > DECK + 13), "toxic", 6)
        P.flat(g, win & (np.abs(Y - DECK - 11.5) < 0.6), "moss", 4)
    for s in (-1, 1):
        win = sc & (np.abs(X - CX - s * 19.5) < 0.6) & (Z > STERN0 + 6) & (Z < STERN0 + 20) & (Y > DECK + 7) & (Y < DECK + 15)
        P.flat(g, win, "toxic", 5)
    stern_roof = box(g, CX - 21, DECK + 20, STERN0 - 1, CX + 21, DECK + 22, STERN1 + 1, "wood", 6)
    P.planks(g, stern_roof, "wood", 6, width=3, across="x", nails=True, frame="top", seed=7)
    for x in (CX - 20, CX + 18):
        box(g, x, DECK + 22, STERN1 - 4, x + 2, DECK + 28, STERN1, "wood", 5)
        lan = box(g, x - 1, DECK + 28, STERN1 - 5, x + 3, DECK + 34, STERN1 - 1, "toxic", 6)
        P.flat(g, lan & (Y > DECK + 32), "wood", 5)
    # the skull figurehead and the bowsprit
    S.skull(g, CX, DECK - 18, 7.0, s=14, eyes=("toxic", 7), socket=("teal", 2), seed=8)
    S.bar(g, "x", (DECK + 4, 12), (DECK + 16, 2.6), 3, CX - 1.5, CX + 1.5, "wood", 5)
    return g


def billow(g: Grid, z0: float, x0: float, x1: float, y_hi: float, y_lo: float, belly: float, ramp: str, base: int, strips: int, seed: int) -> np.ndarray:
    """A billowing torn sail: vertical strips, each a curved crescent
    (true slopes) bellying toward -z, with ragged bottoms."""
    rng = np.random.default_rng(seed)
    m = np.zeros(g.shape, dtype=bool)
    for k in range(strips):
        a, b = x0 + (x1 - x0) * k / strips, x0 + (x1 - x0) * (k + 1) / strips
        lo = y_lo + (rng.uniform(2, 8) if k % 2 else rng.uniform(0, 2))
        ym = (y_hi + lo) / 2
        pts = [(y_hi, z0), (ym, z0 - belly), (lo, z0), (lo, z0 + 2), (ym, z0 - belly + 2), (y_hi, z0 + 2)]
        g.prism("x", pts, a, b, C(ramp, base))
        m |= S.last(g)
    P.mottle(g, m, ramp, base, cell=3, seed=seed)
    return m


def mast(name: str) -> Grid:
    """A mast with two yards, billowing torn purple sails and shrouds."""
    g = Grid(*G)
    X, Y, Z = coords(g)
    z, top = MASTS[name]
    main = name == "mast-main"
    box(g, CX - 2, DECK, z - 2, CX + 2, top, z + 2, "wood", 5)
    P.flat(g, (g.a > 0) & (Y.astype(int) % 12 == 0), "wood", 4)
    half = 24 if main else 20
    y_hi = top - 8
    y_lo = DECK + 30 if main else DECK + 26
    for yy, hw in ((y_hi, half - 2), (y_lo - 3, half)):
        box(g, CX - hw, yy, z - 1.5, CX + hw, yy + 3, z + 1.5, "wood", 5)
    cloth = billow(g, z - 3, CX - half + 2, CX + half - 2, y_hi, y_lo, 6, "purple", 5, 6, seed=len(name))
    holes = cloth & ((P._hash(X.astype(int) // 3, Y.astype(int) // 3, seed=len(name)) % np.uint64(17)) == 0)
    P.flat(g, holes, "purple", 3)
    P.flat(g, cloth & (Y > y_hi - 2), "purple", 4)
    if main:
        w, h = pnglyph.icon_size("skull", 2)
        pnglyph.icon(g, "-z", z - 9, int(CX - w / 2), int((y_hi + y_lo) / 2 - h / 2), "skull", "bone", 7, scale=2, reach=4)
        billow(g, z - 3, CX - half + 4, CX + half - 4, y_lo - 3, DECK + 10, 5, "purple", 6, 5, seed=12)
    # shrouds: lines from high on the mast down to the deck edges
    for s in (-1, 1):
        S.bar(g, "z", (CX + s * 2, top - 12), (CX + s * 19, DECK + 4), 1.4, z + 1, z + 3, "wood", 3)
    return g


def nest() -> Grid:
    g = Grid(*G)
    z, top = MASTS["mast-main"]
    ny = top - 20
    S.disc(g, "y", CX, z, 6, ny, ny + 5, "wood", 5)
    P.planks(g, S.last(g), "wood", 5, width=3, across="x", nails=True, seed=13)
    S.disc(g, "y", CX, z, 6.5, ny + 4, ny + 5.5, "wood", 6)
    return g


def flag() -> Grid:
    g = Grid(*G)
    z, top = MASTS["mast-main"]
    box(g, CX - 1, top, z - 1, CX + 1, top + 5, z + 1, "wood", 4)
    fy = top + 5
    pts = [(fy, z + 1), (fy - 1, z + 20), (fy - 5, z + 16), (fy - 7, z + 22), (fy - 11, z + 17), (fy - 12, z + 1)]
    sail(g, "x", pts, CX - 1, CX + 1, ramp="toxic", base=4, seed=14)
    return g


def build() -> Asset:
    grids = {"hull": hull(), "nest": nest(), "flag": flag()}
    joints = [("hull", None, PIVOT)]
    for name, (z, _top) in MASTS.items():
        grids[name] = mast(name)
        joints.append((name, "hull", (CX, float(DECK), z)))
    z, top = MASTS["mast-main"]
    joints += [("nest", "mast-main", (CX, float(top - 20), z)), ("flag", "mast-main", (CX, float(top + 5), z))]
    root = parts(grids, joints)

    def wave(period, amp, axis, steps=8, phase=0.0):
        i = "xyz".index(axis)
        out = []
        for k in range(steps + 1):
            v = [0.0, 0.0, 0.0]
            v[i] = amp * math.sin(2 * math.pi * k / steps + phase)
            out.append((period * k / steps, tuple(v)))
        return out

    def rock(period, pitch, roll):
        return [(period * k / 8, (pitch * math.sin(2 * math.pi * k / 8), 0.0, roll * math.sin(2 * math.pi * k / 8 + 1.2))) for k in range(9)]

    move = {"hull": {"rot": rock(3.2, 3.0, 4.0), "loc": wave(1.6, 1.5, "y")}, "flag": {"rot": wave(0.8, 18.0, "y")}}
    for k, name in enumerate(MASTS):
        move[name] = {"rot": wave(1.6, 2.0, "x", phase=k * 0.7)}
    idle = {"hull": {"rot": rock(4.0, 1.2, 2.0), "loc": wave(4.0, 1.0, "y")}, "flag": {"rot": wave(2.0, 10.0, "y")}}
    rel = lambda p: (p[0] - PIVOT[0], p[1] - PIVOT[1], p[2] - PIVOT[2])  # noqa: E731
    return Asset(
        id="monster-vehicles-ghost-ship", pack="monster", category="vehicles", name="Ghost Ship", root=root,
        clips=[Clip("move", move), Clip("idle", idle)],
        sockets=[Socket("socket-deck", at=rel((CX, DECK + 6.0, 50.0)), parent="hull"), Socket("socket-stern", at=rel((CX, 16.0, 108.0)), parent="hull")],
        pfx=[
            {"effectId": "rvx-monster-ghost-wisps", "socket": "socket-deck", "trigger": "idle", "size": 70, "offset": [0.0, 60.0, 0.0]},
            {"effectId": "rvx-monster-ghost-wake", "socket": "socket-stern", "trigger": "clip:move", "size": 50, "aim": [0.0, 0.0, 1.0]},
        ],
    )
