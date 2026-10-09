"""Iron cage in the Pirate Nation style.

A hanging gaol cage set down on its stone foot: six slim bars in the theme's grey-blue steel on
a riveted base ring, bound by two hoops, under a domed cap with a gold
lifting ring. The bars are far apart and dark, so the oversized gold
padlock on the door and the glowing hoard inside both read at thumbnail
size (rules F4, F6 and C3). About 26 across and 45 tall.
"""

import math

import numpy as np

import paint as P
from _props import coords, stone_box
from pnkit import box, edges
from pnshapes import disc, dome, last, quad
from voxgrid import C, Asset, Grid, Part

W, H, D = 28, 48, 28
CX, CZ = 14, 14
RB = 9.5  # bar ring radius
BARS = 6
FLOOR = 6  # the cage floor


def ring(g: Grid, y0: int, y1: int, r: float, ramp: str, shade: int, keep=None, thick: float = 1.2) -> np.ndarray:
    """A band of chords between the bars; `keep` limits it to some segments."""
    m = np.zeros(g.shape, bool)
    for k in range(BARS):
        if keep is not None and k not in keep:
            continue
        a0 = 2 * math.pi * k / BARS
        a1 = 2 * math.pi * (k + 1) / BARS
        p0 = (CX + r * math.cos(a0), CZ + r * math.sin(a0))
        p1 = (CX + r * math.cos(a1), CZ + r * math.sin(a1))
        g.prism("y", quad(p0, p1, thick), y0, y1, C(ramp, shade))
        m |= last(g)
    return m


def loop_z(g: Grid, cx: float, cy: float, r: float, z0: float, z1: float, ramp: str, shade: int, n: int = 8) -> np.ndarray:
    """A ring standing in the x/y plane, built from n chord bars."""
    m = np.zeros(g.shape, bool)
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        p0 = (cx + r * math.cos(a0), cy + r * math.sin(a0))
        p1 = (cx + r * math.cos(a1), cy + r * math.sin(a1))
        g.prism("z", quad(p0, p1, 0.9), z0, z1, C(ramp, shade))
        m |= last(g)
    return m


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))
    rad = np.hypot(X - CX, Z - CZ)

    # a grey-blue stone foot (theme stone) under a dark riveted iron base ring
    foot = disc(g, "y", CX, CZ, 12.5, 0, 3, "stone", 3, n=8)
    P.stone(g, foot, "stone", 3, block=(5, 2), seed=1)
    P.flat(g, foot & (Yi < 1), "stone", 1)
    P.flat(g, foot & (Yi == 2), "stone", 4)
    P.flat(g, foot & (Yi == 2) & (rad > 11.4), "stone", 1)  # the dark rim
    plate = disc(g, "y", CX, CZ, 11.0, 3, FLOOR, "steel", 2, n=8)
    P.plates(g, plate, "steel", 2, size=(6, 3), rivets=True, frame="wall", seed=2)
    P.flat(g, plate & (Yi == FLOOR - 1), "steel", 4)
    P.flat(g, plate & (Yi == 3), "steel", 1)
    P.flat(g, plate & (Yi == FLOOR - 1) & (rad > 9.8), "gold", 4)  # a brass kerb band

    # the hoard: one big glowing heap of coin and one red cloth, sized to read
    straw = disc(g, "y", CX, CZ, 8.4, FLOOR, FLOOR + 2, "gold", 5, n=8)
    P.thatch(g, straw, "gold", 5, band=3, frame="top", seed=3)
    heap = disc(g, "y", CX - 1, CZ, 6.6, FLOOR + 2, FLOOR + 6, "gold", 6, n=8)
    heap |= disc(g, "y", CX - 1, CZ, 5.0, FLOOR + 6, FLOOR + 11, "gold", 6, n=8)
    heap |= disc(g, "y", CX - 1, CZ, 3.0, FLOOR + 11, FLOOR + 16, "gold", 7, n=6)
    hd = np.hypot(X - (CX - 1), Z - CZ)
    P.flat(g, heap, "gold", 6)
    P.flat(g, heap & ((Yi == FLOOR + 5) | (Yi == FLOOR + 10)), "gold", 7)  # the lit steps
    P.flat(g, heap & (hd > 5.4) & (Yi < FLOOR + 6), "gold", 4)
    P.flat(g, heap & (((Xi + Zi + Yi) % 5) == 0), "gold", 7)  # coin glints
    P.flat(g, heap & (Yi > FLOOR + 13), "ember", 6)  # the glowing crown of the hoard
    cloth = box(g, CX + 3, FLOOR + 2, CZ - 7, CX + 8, FLOOR + 6, CZ - 1, "red", 5)
    P.mottle(g, cloth, "red", 5, cell=3, seed=11)
    P.flat(g, cloth & (Yi == FLOOR + 5), "red", 6)
    P.flat(g, edges(cloth), "red", 3)

    # six slim dark bars, two hoops and a domed cap
    for k in range(BARS):
        a = 2 * math.pi * k / BARS + math.pi / BARS
        bx, bz = CX + RB * math.cos(a), CZ + RB * math.sin(a)
        bar = box(g, bx - 1.1, FLOOR - 1, bz - 1.1, bx + 1.1, 35, bz + 1.1, "steel", 3)
        P.flat(g, bar, "steel", 3)
        P.flat(g, bar & (rad < RB), "steel", 1)  # the inner face sits back in shadow
        P.flat(g, bar & ((Yi > 33) | (Yi < FLOOR + 1)), "steel", 4)  # forged collars
    for y0 in (14, 26):
        band = ring(g, y0, y0 + 3, RB, "steel", 1, thick=1.4)
        P.flat(g, band, "steel", 1)
        P.flat(g, band & (Yi == y0 + 2), "steel", 3)
        P.flat(g, band & (Yi == y0 + 1) & (((Xi + Zi) % 5) == 0), "gold", 5)  # brass studs
    cap = dome(g, CX, CZ, 35, 10.5, 7.0, n=8, rings=2, ramp="steel", base=3, cap_r=2.0,
               painter=lambda gg, mm, fr: P.plates(gg, mm, "steel", 3, size=(6, 4), rivets=True, frame=fr, seed=8),
               ribs=("steel", 1))
    P.flat(g, cap & (Yi > 40), "steel", 4)
    P.flat(g, cap & (Yi == 35), "steel", 1)  # a dark rim under the eave
    P.flat(g, cap & (Yi == 36), "gold", 5)  # a brass eave band
    hoop = loop_z(g, CX, 44, 2.8, CZ - 1.2, CZ + 1.2, "gold", 5, n=6)
    P.flat(g, hoop, "gold", 5)
    P.flat(g, hoop & (Y > 45), "gold", 6)

    # the door: one framed panel between two bars with an oversized gold padlock
    door = ring(g, FLOOR + 1, 32, RB, "steel", 3, keep=(4,), thick=1.5)
    P.plates(g, door, "steel", 3, size=(7, 6), rivets=True, frame="wall", seed=9)
    P.flat(g, door & ((Yi < FLOOR + 3) | (Yi > 29)), "steel", 1)
    P.flat(g, door & (Yi > 19) & (Yi < 22), "steel", 5)  # the lit middle rail
    lock = box(g, CX - 3, 17, CZ - 12, CX + 3, 24, CZ - 9, "gold", 5)
    P.flat(g, lock, "gold", 5)
    P.flat(g, lock & (Zi < CZ - 11), "gold", 6)
    P.flat(g, edges(lock), "gold", 3)
    P.flat(g, lock & (np.hypot(X - CX, Y - 21) < 1.3), "steel", 0)  # the keyhole
    P.flat(g, lock & (np.abs(Y - 19) < 0.6) & (np.abs(X - CX) < 0.7), "steel", 0)
    shk = loop_z(g, CX, 25, 2.8, CZ - 11.2, CZ - 9.8, "gold", 4, n=6)
    P.flat(g, shk, "gold", 4)
    P.flat(g, shk & (Y > 26), "gold", 5)

    root = Part("iron-cage", g)
    return Asset(id="fantasy-props-iron-cage", pack="fantasy", category="props", name="Iron Cage", root=root)
