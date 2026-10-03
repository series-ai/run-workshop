"""Domed mausoleum, in the Pirate Nation haunted style.

After the PN mausoleum and haunted town hall: an octagonal grey stone drum
on a stepped octagonal plinth, light stone quoins on every corner, pointed
windows glowing toxic green and violet, and a big faceted copper-green dome
(true slopes, rules F1 and F2) with light stone ribs. A glowing lantern
and a horned cross crown it. The front portico has chunky columns, a steep
purple slate gable with a giant skull crest (the oversized function prop,
F4) and bronze doors. Iron railings with urns, pumpkins and tombstones
stand round the base. Masonry, tiles and glyphs are painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import candle, coords, iron_fence, opening, rounded, steps, stone, urn
from _pn import cross, lancet, pumpkin, tombstone
from pnkit import box, gable_roof
from voxgrid import Asset, Grid, Part

W, H, D = 112, 132, 116
CX, CZ = 56.0, 62.0
R = 27  # drum flat radius
Y0, WALL = 9, 60  # drum base and top
DOME_Y, DOME_H = 64, 30
LAN_Y = DOME_Y + DOME_H - 2


def mausoleum() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # a stepped octagonal plinth
    for k, (r, y0, y1) in enumerate(((R + 16, 0, 5), (R + 11, 5, Y0))):
        S.disc(g, "y", CX, CZ, r, y0, y1, "stone", 5)
        S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(9, 5), frame=fr, seed=1 + k))
    # the drum: stone on every facet, light quoins on the corners
    start = len(g.solids)
    drum = S.disc(g, "y", CX, CZ, R, Y0, WALL, "gray", 5)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(8, 4), cracks=0.08, frame=fr, seed=3))
    quoin = drum & S.seams(g, g.solids[start:], 2.6) & (Y < WALL - 1)
    P.stone(g, quoin, "gray", 7, block=(4, 5), seed=4)
    P.flat(g, drum & (Y < Y0 + 2), "gray", 4)
    # cornice bands
    S.disc(g, "y", CX, CZ, R + 2, WALL - 4, WALL, "gray", 6)
    P.stone(g, S.last(g), "gray", 6, block=(10, 4), seed=5)
    S.disc(g, "y", CX, CZ, R + 3, WALL, DOME_Y, "gray", 6)
    P.stone(g, S.last(g), "gray", 6, block=(10, 4), seed=6)
    # the dome: copper-green tiles, light stone ribs (the landmark)
    S.dome(g, CX, CZ, DOME_Y, R + 1, h=DOME_H, n=8, rings=3, ramp="teal", base=4, cap_r=5, painter=lambda gg, mm, fr: P.tiles(gg, mm, "teal", 4, row=4, width=4, frame=fr, seed=7), ribs=("gray", 6))
    # the lantern: glowing toxic panes, a slate cone, a horned cross
    lan = S.disc(g, "y", CX, CZ, 6, LAN_Y, LAN_Y + 12, "toxic", 6)
    P.flat(g, lan & S.seams(g, [g.solids[-1]], 1.2), "gray", 6)
    P.flat(g, lan & ((Y < LAN_Y + 2) | (Y > LAN_Y + 10)), "gray", 6)
    start = len(g.solids)
    S.cone(g, "y", CX, CZ, 8, LAN_Y + 12, LAN_Y + 24, "purple", 4)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 4, row=3, width=3, frame=fr, seed=8))
    cross(g, CX, LAN_Y + 22, CZ, h=14, arm=5)
    # pointed windows on the side and back facets
    for face, plane, u in (("-x", CX - R, CZ), ("+x", CX + R, CZ), ("+z", CZ + R, CX)):
        lancet(g, face, plane, u - 5, u + 5, 18, 48, glass="toxic" if face != "+z" else "magenta", shade=5, seed=9)
    # violet slit windows painted on the diagonal facets
    for m, fr in S.facets(g, _drum_solid(g)):
        if fr == "top":
            continue
        U, V = P.uv(g, fr)
        uc = U[m].mean()
        slit = m & (np.abs(U - uc) < 2.5) & (Y > 22) & (Y < 46)
        u, _v = fr
        if abs(u[0]) > 0.1 and abs(u[2]) > 0.1:  # diagonal facets only
            P.flat(g, slit, "purple", 3)
            P.flat(g, slit & (Y < 30), "magenta", 5)
            P.outline(g, slit, "gray", 7)
    # the front portico: chunky columns, a steep slate gable, a skull crest
    PZ0, PZ1 = CZ - R - 16, CZ - R + 6
    PX0, PX1 = CX - 19, CX + 19
    for x in (PX0, PX1 - 8):
        stone(g, x, Y0, PZ0, x + 8, 52, PZ0 + 8, "gray", 6, block=(4, 6), seed=10)
        stone(g, x - 1, Y0, PZ0 - 1, x + 9, Y0 + 4, PZ0 + 9, "gray", 5, block=(5, 4), seed=11)
        stone(g, x - 1, 48, PZ0 - 1, x + 9, 52, PZ0 + 9, "gray", 5, block=(5, 2), seed=12)
    back = stone(g, PX0 + 2, Y0, PZ0 + 8, PX1 - 2, 52, PZ1, "gray", 5, seed=13)
    stone(g, PX0 - 3, 52, PZ0 - 2, PX1 + 3, 57, PZ1, "gray", 6, block=(10, 3), seed=14)
    roof = gable_roof(g, PX0 - 1, PX1 + 1, PZ0 - 2, PZ1 + 4, 57, 82, ramp="purple", thick=4, overhang=4, trim="gray", gable="gray", ridge="z", trim_shade=6, seed=15)
    S.skull(g, CX, 58, PZ0 - 6, s=16, eyes=("toxic", 7), seed=16)
    # bronze doors under a round arch, studded, with magenta light between them
    du0, du1 = CX - 10, CX + 10
    opening(g, "-z", PZ0 + 8, rounded(du0 - 2, du1 + 2, Y0, 46), glow=("magenta", 6), deep=("purple", 3), d=1)
    for a, b in ((du0, CX - 0.5), (CX + 0.5, du1)):
        leaf = box(g, a, Y0, PZ0 + 6, b, 38, PZ0 + 7, "gold", 3)
        P.planks(g, leaf, "gold", 3, width=3, across="x", length=(40, 41), nails=True, seed=17)
        P.outline(g, leaf, "gold", 2, normal="z")
    box(g, CX - 3, 24, PZ0 + 5, CX - 1, 27, PZ0 + 6, "gold", 6)
    box(g, CX + 1, 24, PZ0 + 5, CX + 3, 27, PZ0 + 6, "gold", 6)
    steps(g, CX, PZ0 - 1, 40, n=2, rise=4, run=5, seed=18)
    # railings with urns across the front of the plinth
    iron_fence(g, "x", CX - 42, CX - 22, CZ - 40, 9, h=11, gap=4)
    iron_fence(g, "x", CX + 22, CX + 42, CZ - 40, 9, h=11, gap=4)
    for ux in (CX - 44, CX + 40):
        stone(g, ux - 1, 9, CZ - 42, ux + 5, 15, CZ - 36, "gray", 6, block=(3, 3), seed=19)
        urn(g, ux + 2, 15, CZ - 39, s=8, glow=("toxic", 6))
    # graveyard props (K1)
    pumpkin(g, CX - 30, 0, 12, w=12, h=9, seed=20)
    pumpkin(g, CX + 27, 9, CZ - 30, w=10, h=8, seed=21)
    tombstone(g, CX + 36, CZ + 36, w=10, h=16, lean=8, seed=22)
    tombstone(g, CX + 26, CZ + 44, w=8, h=12, lean=-5, glyph="", seed=25)
    tombstone(g, CX - 40, CZ + 32, w=9, h=13, lean=-6, seed=23)
    for x, z in ((CX - 16, PZ0 - 11), (CX + 14, PZ0 - 12)):
        candle(g, x, 0, z, h=5)
    P.grime(g, (g.a > 0) & (Y < 16) & ~g.solid_mask(), height=4, seed=24)
    # moss creeping over the plinth steps (C1 accent, F5 wear)
    from _pn import blotch
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    blotch(g, (g.a > 0) & up & (Y < Y0) & (np.hypot(X - CX, Z - CZ) > R + 4), "moss", 5, cell=3, chance=0.12, seed=26)
    return g


def _drum_solid(g: Grid):
    """The drum prism: the first octagon of the drum radius."""
    return [s for s in g.solids if s.axis == "y" and s.lo == Y0 and s.hi == WALL][:1]


def build() -> Asset:
    root = Part("mausoleum", mausoleum(), pivot=(0.0, 0.0, 0.0))
    return Asset(id="monster-buildings-mausoleum", pack="monster", category="buildings", name="Domed Mausoleum", root=root)
