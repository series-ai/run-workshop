"""Mage academy in the Pirate Nation style.

A two-storey college hall of cream ashlar on a grey-blue stone plinth,
under a steep royal-blue tile roof with gold ridges (true slopes). A
gabled entrance pavilion stands forward of the hall with a tall arched
door and a big magic-cyan rose window. Tall arched cyan windows light
both storeys. On the right rises the grey-blue observatory tower: an
octagonal drum with gold string courses and round cyan windows, a
corbelled ring and a steep blue cone roof. The oversized function prop
crowns the tower: a giant faceted magic-cyan crystal held in gold prongs,
with the arcane orbit turning round it on `idle` (PFX). The tower on the
right, a chimney on the left and a pennant on the pavilion break the
symmetry (rule F5). A crystal cluster, a crate of scrolls and a
book stack stand at the base (rule K1). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import FRONT, arch_door, arch_window, cone_roof, drum, round_window, shield
from _fbld_civic import idx, plinth
from _props import book, gem
from pnkit import box, crate, edges, gable_roof, pennant, rose
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 132, 148, 100
X0, X1, Z0, Z1 = 14, 92, 42, 86  # the hall walls; the front is z = Z0
GROUND, COURSE, WALL_TOP, RIDGE = 38, 41, 74, 110
PX0, PX1, PZ0 = 38, 64, 30  # the entrance pavilion (front at z = PZ0)
TX, TZ, TR = 106, 56, 14  # the observatory tower
T_TOP, T_RING = 98, 104
CONE_H = 26
CRY_Y0 = T_RING + CONE_H - 4  # the crystal foot (on the cone tip)


def ashlar(g: Grid, mask: np.ndarray, base: int = 6, seed: int = 0, frame=None) -> None:
    """Cream ashlar: big squared blocks with a fine mortar line (rule S2)."""
    P.stone(g, mask, "bone", base, block=(10, 6), cracks=0.03, frame=frame, seed=seed)


def hall(g: Grid) -> None:
    X, Y, Z = idx(g)
    plinth(g, X0 - 3, Z0 - 3, X1 + 3, Z1 + 3, 4, "steel", 4, seed=1)
    walls = box(g, X0, 4, Z0, X1, WALL_TOP, Z1, "bone", 6)
    ashlar(g, walls, 6, seed=2)
    quoin = walls & (((X < X0 + 4) | (X >= X1 - 4)) & ((Z < Z0 + 4) | (Z >= Z1 - 4)))
    P.stone(g, quoin, "steel", 5, block=(4, 6), seed=3)
    P.stone(g, walls & (Y < 12), "steel", 4, block=(8, 4), seed=4)  # the base course
    course = box(g, X0 - 1, GROUND, Z0 - 1, X1 + 1, COURSE, Z1 + 1, "gold", 4)
    P.planks(g, course, "gold", 4, width=3, across="y", nails=False, seed=5)
    cornice = box(g, X0 - 2, WALL_TOP - 3, Z0 - 2, X1 + 2, WALL_TOP, Z1 + 2, "steel", 5)
    P.stone(g, cornice, "steel", 5, block=(6, 3), seed=6)
    roof = gable_roof(g, X0, X1, Z0, Z1, WALL_TOP, RIDGE, ramp="blue", base=4, thick=5, overhang=6, ridge="x", trim="gold", trim_shade=4, gable="bone", seed=7)
    ashlar(g, roof["attic"], 6, seed=8)
    round_window(g, "-x", X0, (Z0 + Z1) / 2, WALL_TOP + 12, 5, glass=("cyan", 6), frame=("gold", 4))
    # tall arched cyan windows on both storeys (front and back)
    for u0 in (20, 76):
        arch_window(g, "-z", Z0, u0, u0 + 10, 14, 32, glass=("cyan", 6), frame=("steel", 6))
        arch_window(g, "-z", Z0, u0, u0 + 10, 50, 68, glass=("cyan", 6), frame=("steel", 6))
    for u0 in (20, 40, 60, 78):
        arch_window(g, "+z", Z1, u0, u0 + 9, 14, 32, glass=("cyan", 6), frame=("steel", 6))
        arch_window(g, "+z", Z1, u0, u0 + 9, 50, 68, glass=("cyan", 6), frame=("steel", 6))
    for w0 in (Z0 + 12, Z1 - 20):
        arch_window(g, "-x", X0, w0, w0 + 9, 14, 32, glass=("cyan", 6), frame=("steel", 6))
    arch_window(g, "-x", X0, Z1 - 20, Z1 - 11, 50, 68, glass=("cyan", 6), frame=("steel", 6))


def pavilion(g: Grid) -> None:
    """The gabled entrance pavilion: door, rose window, crest, steps."""
    X, Y, Z = idx(g)
    pm = box(g, PX0, 4, PZ0, PX1, WALL_TOP, Z0 + 2, "bone", 6)
    ashlar(g, pm, 6, seed=10)
    quoin = pm & ((X < PX0 + 4) | (X >= PX1 - 4)) & (Z < PZ0 + 4)
    P.stone(g, quoin, "steel", 5, block=(4, 6), seed=11)
    P.stone(g, pm & (Y < 12), "steel", 4, block=(8, 4), seed=12)
    plinth(g, PX0 - 3, PZ0 - 3, PX1 + 3, Z0, 4, "steel", 4, seed=13)
    box(g, PX0 - 1, GROUND, PZ0 - 1, PX1 + 1, COURSE, Z0, "gold", 4)
    cor = box(g, PX0 - 2, WALL_TOP - 3, PZ0 - 2, PX1 + 2, WALL_TOP, Z0, "steel", 5)
    P.stone(g, cor, "steel", 5, block=(6, 3), seed=14)
    roof = gable_roof(g, PX0, PX1, PZ0, Z0 + 18, WALL_TOP, RIDGE - 4, ramp="blue", base=4, thick=5, overhang=5, ridge="z", trim="gold", trim_shade=4, gable="bone", seed=15)
    ashlar(g, roof["attic"], 6, seed=16)
    cu = (PX0 + PX1) // 2
    arch_door(g, "-z", PZ0, cu - 9, cu + 9, 4, 36, leaf=("blue", 3), frame=("steel", 6), studs=("gold", 6), seed=17)
    steps = box(g, cu - 14, 0, PZ0 - 10, cu + 14, 2, PZ0 - 3, "steel", 4) | box(g, cu - 12, 2, PZ0 - 7, cu + 12, 4, PZ0 - 3, "steel", 5)
    P.stone(g, steps, "steel", 4, block=(7, 3), frame="top", seed=18)
    rose(g, "-z", PZ0, cu, 57, 8, glass="cyan", shade=5, frame="steel", fshade=6)
    shield(g, "-z", PZ0, cu, WALL_TOP + 6, w=12, h=14, field=("blue", 4), rim=("gold", 5), charge="star", ink=("gold", 6))
    pennant(g, cu - 1, RIDGE - 1, PZ0 - 6, 10, 13, "blue")


def tower(g: Grid) -> None:
    """The octagonal observatory tower with gold courses, cyan windows, a
    corbelled ring and a steep blue cone roof."""
    X, Y, Z = idx(g)
    drum(g, TX, TZ, 0, 6, TR + 2, "steel", 3, r_top=TR + 1, block=(8, 4), seed=20)
    drum(g, TX, TZ, 6, T_TOP, TR, "steel", 4, block=(7, 5), seed=21)
    for y0 in (38, 72):
        drum(g, TX, TZ, y0, y0 + 3, TR + 1, "gold", 4,
             painter=lambda gg, mm, fr: P.planks(gg, mm, "gold", 4, width=3, across="y", nails=False, frame=fr))
    drum(g, TX, TZ, T_TOP, T_RING, TR + 3, "steel", 5, r_top=TR + 3, block=(5, 3), seed=22)
    drum(g, TX, TZ, T_TOP - 6, T_TOP, TR, "steel", 5, r_top=TR + 3, block=(5, 3), seed=23)  # the corbel
    for k in range(8):  # dark corbel brackets under the ring
        a = FRONT + 2 * np.pi * k / 8 + np.pi / 8
        cx, cz = TX + (TR + 1) * np.cos(a), TZ + (TR + 1) * np.sin(a)
        box(g, round(cx) - 1, T_TOP - 9, round(cz) - 1, round(cx) + 1, T_TOP - 6, round(cz) + 1, "steel", 2)
    cone = cone_roof(g, TX, TZ, T_RING, TR + 5, CONE_H, "blue", 4, lean=(-1.0, 0.0), trim=("gold", 5), eave=("blue", 2), seed=24)
    # small gold stars (plus shapes) painted on the cone
    U = X + Z
    u, v = U % 7, Y % 7
    pick = (P._hash(U // 7, Y // 7, seed=25) % np.uint64(3)) == 0
    plus = ((u == 3) & (v >= 2) & (v <= 4)) | ((v == 3) & (u >= 2) & (u <= 4))
    P.flat(g, cone & pick & plus & (Y > T_RING + 4) & (Y < T_RING + CONE_H - 6), "gold", 6)
    # round cyan windows on the front and side facets, a slit on the back
    for y in (24, 56, 86):
        round_window(g, "-z", TZ - TR, TX, y, 4, glass=("cyan", 6), frame=("gold", 4))
    for y in (24, 56, 86):
        round_window(g, "+x", TX + TR, TZ, y, 4, glass=("cyan", 6), frame=("gold", 4))
    for y in (24, 56, 86):
        round_window(g, "+z", TZ + TR, TX, y, 3, glass=("cyan", 6), frame=("gold", 4))
    arch_door(g, "+x", TX + TR, TZ - 7, TZ + 7, 6, 32, leaf=("wood", 4), frame=("steel", 6), studs=("gold", 6), seed=26)
    P.grime(g, (g.a > 0) & (Y < 10) & (X > X1), height=4, seed=27)


def crystal(g: Grid) -> None:
    """The giant magic-cyan crystal on the cone tip, held in gold prongs."""
    X, Y, Z = idx(g)
    cx, cz = TX - 1.0, float(TZ)
    collar = S.disc(g, "y", cx, cz, 3.5, CRY_Y0 - 1, CRY_Y0 + 3, "gold", 4)
    P.flat(g, collar & (Y == CRY_Y0 + 2), "gold", 6)
    y_mid, y_top = CRY_Y0 + 9, CRY_Y0 + 22
    start = len(g.solids)
    g.prism("y", [(cx, cz)] * 6, CRY_Y0 + 2, y_mid, C("cyan", 5), top=S.flat_ngon(cx, cz, 6.5, 6))
    g.prism("y", S.flat_ngon(cx, cz, 6.5, 6), y_mid, y_mid + 3, C("cyan", 6))
    g.prism("y", S.flat_ngon(cx, cz, 6.5, 6), y_mid + 3, y_top, C("cyan", 6), top=[(cx + 0.5, cz)] * 6)
    m = np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])
    P.flat(g, m & (X + 0.5 < cx) & (Y > y_mid), "cyan", 7)  # the lit facets
    P.flat(g, m & (X + 0.5 > cx + 2) & (Y < y_mid), "cyan", 4)
    P.flat(g, m & S.seams(g, g.solids[start:], 0.7), "plasma", 6)
    for k in range(4):  # gold prongs that grip the crystal waist
        a = np.pi / 4 + k * np.pi / 2
        px, pz = cx + 6.0 * np.cos(a), cz + 6.0 * np.sin(a)
        g.prism("y", [(px - 1, pz - 1), (px + 1, pz - 1), (px + 1, pz + 1), (px - 1, pz + 1)], CRY_Y0 + 1, y_mid + 2, C("gold", 5),
                top=[(px - 0.5, pz - 0.5), (px + 0.5, pz - 0.5), (px + 0.5, pz + 0.5), (px - 0.5, pz + 0.5)])


def chimney(g: Grid) -> None:
    """A grey-blue stone chimney on the left end of the roof."""
    cx0, cz0 = X0 + 8, Z1 - 16
    m = box(g, cx0, WALL_TOP + 10, cz0, cx0 + 10, RIDGE + 6, cz0 + 10, "steel", 4)
    P.stone(g, m, "steel", 4, block=(5, 3), seed=40)
    cap = box(g, cx0 - 1, RIDGE + 6, cz0 - 1, cx0 + 11, RIDGE + 9, cz0 + 11, "steel", 2)
    P.stone(g, cap, "steel", 3, block=(6, 2), seed=41)
    box(g, cx0 + 2, RIDGE + 8, cz0 + 2, cx0 + 8, RIDGE + 9, cz0 + 8, "iron", 2)
    P.flat(g, edges(m), "steel", 3)


def yard(g: Grid) -> None:
    """Props at the base (rule K1): a crystal cluster, a scroll crate and books."""
    X, Y, Z = idx(g)
    for cx, cz, r, h in ((92.0, 33.0, 3.0, 13.0), (97.0, 30.0, 2.2, 9.0), (88.0, 29.0, 2.0, 7.0)):
        gem(g, cx, 0, cz, r=r, h=h, ramp="cyan", shade=5)
    crate(g, 18, 0, 26, 12, seed=50)
    for k, sx in enumerate((19, 23, 27)):  # rolled scrolls standing in the crate
        sc = S.disc(g, "y", sx + 0.5, 32.0, 1.5, 12, 17 + k % 2, "bone", 6, n=6)
        P.flat(g, sc & (Y >= 16), "red", 5)
    for k, (col, sh) in enumerate((("blue", 4), ("red", 4), ("magenta", 4), ("leaf", 4))):
        book(g, 34 - k % 2, k * 2, 30 + k % 2, 42 - k % 2, k * 2 + 2, 36 + k % 2, col, sh)


def build() -> Asset:
    g = Grid(W, H, D)
    hall(g)
    pavilion(g)
    tower(g)
    crystal(g)
    chimney(g)
    yard(g)
    return Asset(
        id="fantasy-buildings-mage-academy", pack="fantasy", category="buildings", name="Mage Academy", root=Part("mage-academy", g),
        sockets=[Socket("socket-function", at=(TX - 1.0, CRY_Y0 + 10, float(TZ)))],
        pfx=[{"effectId": "rvx-fantasy-arcane-orbit", "socket": "socket-function", "trigger": "idle", "size": 22}],
    )
