"""Town water tower, in the Pirate Nation style.

An oversized riveted cream tank (a faceted 12-gon, rule F4) with red
hoops, the town name HOPE painted big and struck through, rust streaks and
a leaking seam that drips into a puddle. It stands on four splayed steel
legs (oblique prisms, true slopes in both axes) with rust tension rods, a
catwalk with a railing, ladders, and a steep red cone roof (a true cone)
with a gold ball finial and a bird's nest. Detail is paint (S1). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
import pnshapes as S
from _bld import bloom, leg, slab
from pnkit import box, edges
from voxgrid import C, Asset, Grid, Part, bounds_pivot

W, H, D = 72, 156, 72
C0 = 36  # centre x and z
DECK = 78  # catwalk top
TANK0, TANK1, TR = 82, 124, 25  # tank bottom, top, flat radius
ROOF1 = 146


def tower() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = S._idx(g)
    Xc, Yc, Zc = S.coords(g)
    slab(g, 2, 2, 70, 70, h=2, ramp="sand", base=5, cracks=4, seed=1)

    # ---- four splayed steel legs on footings, rust tension rods
    lo, hi, shift = 5, W - 11, 12
    for x0 in (lo, hi):
        for z0 in (lo, hi):
            ft = box(g, x0 - 1, 2, z0 - 1, x0 + 7, 5, z0 + 7, "stone", 5)
            sx = shift if x0 == lo else -shift
            sz = shift if z0 == lo else -shift
            m = leg(g, x0, z0, x0 + 6, z0 + 6, 5, DECK - 3, sx, sz, ramp="steel", base=5, planks=False)
            P.plates(g, m, "steel", 5, size=(6, 12), rivets=True, seed=x0 + z0)

    def at(y):
        return lo + shift * (y - 5) / (DECK - 8)

    for ya, yb in ((10, 42), (42, 72)):
        ia, ib = at(ya), at(yb)
        for front in (True, False):
            zc = (ia + ib) / 2 + 2 if front else W - (ia + ib) / 2 - 4
            S.bar(g, "z", (ia + 3, ya), (W - ib - 3, yb), 2, zc, zc + 2, "rust", 5)
            S.bar(g, "z", (W - ia - 3, ya), (ib + 3, yb), 2, zc, zc + 2, "rust", 5)
            S.bar(g, "x", (ya, ia + 3), (yb, W - ib - 3), 2, zc, zc + 2, "rust", 5)
            S.bar(g, "x", (ya, W - ia - 3), (yb, ib + 3), 2, zc, zc + 2, "rust", 5)
        ring = box(g, ib, yb - 3, ib, W - ib, yb, W - ib, "steel", 4)

    # ---- the catwalk: a 12-gon deck with a railing
    deck = S.disc(g, "y", C0, C0, 33, DECK - 3, DECK, "wood", 6, n=12)
    P.planks(g, deck, "wood", 6, width=4, across="x", frame="top", seed=2)
    P.flat(g, deck & (Y < DECK - 2), "wood", 4)
    pts = S.flat_ngon(C0, C0, 32, 12)
    for k in range(12):
        (ax, az), (bx, bz) = pts[k], pts[(k + 1) % 12]
        S.bar(g, "y", (ax, az), (bx, bz), 1.6, DECK + 7, DECK + 9, "red", 5)
        box(g, round(ax) - 1, DECK, round(az) - 1, round(ax) + 1, DECK + 8, round(az) + 1, "red", 4)

    # ---- the tank: riveted cream plates, red hoops, rust streaks
    tank = S.disc(g, "y", C0, C0, TR, TANK0, TANK1, "bone", 6, n=12)
    for m, fr in S.facets(g):
        P.plates(g, m, "bone", 6, size=(9, 7), rivets=True, frame=fr, seed=3)
    for hy in (TANK0 + 1, TANK1 - 3):
        S.disc(g, "y", C0, C0, TR + 1, hy, hy + 2, "red", 5, n=12)
    P.flat(g, tank & (Y < TANK0 + 1), "bone", 4)
    ang = np.arctan2(Zc - C0, Xc - C0)
    for a0 in (0.4, 1.9, 2.8, -1.2):  # rust streaks down from the top hoop
        streak = tank & (np.abs(np.angle(np.exp(1j * (ang - a0)))) < 0.07) & (Y < TANK1 - 3) & (Y > TANK1 - 3 - 14 - 6 * np.cos(a0 * 3))
        P.flat(g, streak, "rust", 5)
    # HOPE, painted big across the front and struck through
    tw, th = pnglyph.text_size("HOPE", 2, 1)
    tv = TANK0 + 12
    for du in (0, 1):  # painted twice, one voxel apart: bold brush strokes
        pnglyph.text(g, "-z", C0 - TR, int(C0 - tw / 2) + du, tv, "HOPE", "red", 4, scale=2, gap=1, reach=12)
    strike = tank & (Z < C0) & (np.abs((Yc - (tv + th * 0.45)) - (Xc - C0) * 0.12) < 1.1) & (np.abs(Xc - C0) < tw / 2 + 3)
    P.flat(g, strike, "darkwood", 4)
    # a leaking seam: a drip down to a puddle
    lx, lz = C0 + 16, C0 - 18
    box(g, lx, 5, lz, lx + 1, TANK0, lz + 1, "cyan", 6)
    pud = box(g, lx - 5, 2, lz - 4, lx + 6, 3, lz + 5, "cyan", 5)
    P.flat(g, pud & (np.hypot(X - lx, Z - lz) > 4.5), "sand", 5)

    # ---- the roof: a steep red cone with a gold ball finial and a nest
    S.cone(g, "y", C0, C0, TR + 4, TANK1, ROOF1, "red", 5, n=12)
    cone = [g.solids[-1]]
    for m, fr in S.facets(g, cone):
        if fr != "top":
            P.tiles(g, m, "red", 5, row=4, width=5, frame=fr, seed=4)
    rm = S.last(g)
    P.flat(g, rm & S.seams(g, cone, 0.8), "red", 3)
    P.flat(g, rm & (Y < TANK1 + 1), "red", 3)
    S.disc(g, "y", C0, C0, 2, ROOF1 - 2, ROOF1 + 2, "steel", 5)
    ball = S.dome(g, C0, C0, ROOF1 + 2, 4, h=4, n=8, rings=2, ramp="gold", base=6, painter=lambda gg, mm, fr: P.flat(gg, mm, "gold", 6), ribs=("gold", 4))
    S.disc(g, "y", C0, C0, 4, ROOF1 - 2, ROOF1 + 2, "gold", 5, n=8)
    nest = S.disc(g, "y", C0 + 12, C0 - 6, 4, 132, 135, "wood", 4, n=8)
    P.flat(g, nest & ((X + Z) % 2 == 0), "wood", 3)
    box(g, C0 + 11, 135, C0 - 7, C0 + 13, 136, C0 - 5, "bone", 7)  # an egg

    # ---- ladders: ground to the catwalk (on the front leg line), catwalk to the roof
    for lz2 in (C0 - 4, C0 + 3):  # on the -x side, clear of the painted name
        box(g, 12, 2, lz2, 14, DECK, lz2 + 2, "steel", 4)
        box(g, C0 - TR - 3, DECK, lz2, C0 - TR - 1, TANK1 + 4, lz2 + 2, "steel", 4)
    for ly in range(6, DECK, 5):
        box(g, 12, ly, C0 - 4, 14, ly + 1, C0 + 5, "steel", 6)
    for ly in range(DECK + 3, TANK1 + 3, 5):
        box(g, C0 - TR - 3, ly, C0 - 4, C0 - TR - 1, ly + 1, C0 + 5, "steel", 6)
    return g


def build() -> Asset:
    g = tower()
    root = Part("water-tower", g, pivot=bounds_pivot(g))
    return Asset(id="apocalypse-buildings-water-tower", pack="apocalypse", category="buildings", name="Town Water Tower", root=root)
