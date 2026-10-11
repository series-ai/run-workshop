"""Ruined watchtower, in the Pirate Nation haunted style.

A broken octagonal grey stone keep (true facets) on a rubble plinth, with
light stone quoins, a string course, painted arrow slits and one window
glowing toxic green. Its top has collapsed into a jagged rim of wall
chunks with sloped broken ends (rule F2), charred floor beams stick out of
the walls, and a torn purple skull banner flies from a leaning pole (the
oversized landmark, F4 and F5). Crows perch on the rim, rubble and fallen
blocks lie round the foot, moss climbs one side. Faces -Z.
"""

import numpy as np

import paint as P
import pnshapes as S
from _props import TOXIC, pn_flame
from _bld import brazier, coords, crow, facet_window, flame_cone, opening, rock, rounded, sail
from _pn import blotch, pumpkin
from pnkit import box, face_prism
from voxgrid import C, Asset, Grid, Part

W, H, D = 72, 152, 72
CX = CZ = 36.0
R = 22
TOP = 92  # the intact wall height
RIM = [(0.0, 1.0, 38, 0.35), (0.0, 0.7, 22, 0.3), (0.2, 0.8, 6, 0.25), (0.0, 1.0, 14, 0.4), (0.0, 1.0, 30, 0.3), (0.0, 1.0, 46, 0.3), (0.3, 1.0, 20, 0.35), (0.0, 0.9, 28, 0.3)]


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def keep() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    S.disc(g, "y", CX, CZ, R + 6, 0, 5, "stone", 5)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(9, 5), frame=fr, seed=1))
    start = len(g.solids)
    S.disc(g, "y", CX, CZ, R, 5, TOP, "gray", 5)
    body = g.solids[start:]
    S.paint_facets(g, body, lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(8, 4), cracks=0.12, frame=fr, seed=2))
    bm = S.last(g)
    P.stone(g, bm & S.seams(g, body, 2.4), "gray", 7, block=(4, 5), seed=3)
    S.disc(g, "y", CX, CZ, R + 2, 44, 48, "gray", 6)
    P.stone(g, S.last(g), "gray", 6, block=(10, 4), seed=4)
    # painted arrow slits and a lit window on the facets
    for k, (m, fr) in enumerate(S.facets(g, body)):
        if fr == "top":
            continue
        if k in (1, 3, 5, 7):
            facet_window(g, m, fr, 58, 76, 4, glass=("purple", 3), point=False)
        if k == 2:
            facet_window(g, m, fr, 56, 76, 8, glass=("toxic", 5))
        if k in (4, 6):
            facet_window(g, m, fr, 18, 32, 4, glass=("purple", 3), point=False)
    # the broken rim: a wall chunk on every facet, sloped broken ends
    outer = S.flat_ngon(CX, CZ, R, 8)
    inner = S.flat_ngon(CX, CZ, R - 6, 8)
    rim = np.zeros(g.shape, dtype=bool)
    for k, (f0, f1, h, cut) in enumerate(RIM):
        if h <= 0:
            continue
        a0, a1 = outer[k], outer[(k + 1) % 8]
        b0, b1 = inner[k], inner[(k + 1) % 8]
        poly = [lerp(a0, a1, f0), lerp(a0, a1, f1), lerp(b0, b1, f1), lerp(b0, b1, f0)]
        if k % 2:
            top = [lerp(a0, a1, f0), lerp(a0, a1, f1 - cut), lerp(b0, b1, f1 - cut), lerp(b0, b1, f0)]
        else:
            top = [lerp(a0, a1, f0 + cut), lerp(a0, a1, f1), lerp(b0, b1, f1), lerp(b0, b1, f0 + cut)]
        g.prism("y", poly, TOP, TOP + h, C("gray", 5), top=top)
        piece = [g.solids[-1]]
        S.paint_facets(g, piece, lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(8, 4), cracks=0.2, frame=fr, seed=5 + k))
        pm = S.last(g)
        P.flat(g, pm & S.seams(g, piece, 1.0) & (Y > TOP + 2), "gray", 6)
        rim |= pm
    # the collapsed floor: purple-grey rubble inside the rim
    floor = bm & (Y > TOP - 1)
    P.stone(g, floor, "stone", 4, block=(5, 4), cracks=0.3, frame="top", seed=13)
    for k, (dx, dz, r, h) in enumerate(((-9, 7, 5, 6), (9, -6, 4, 4), (8, 9, 3.5, 5))):
        rock(g, CX + dx, CZ + dz, TOP, r, h, n=5, ramp="gray", base=5, moss=False, seed=20 + k)
    # the haunted beacon: a big fire bowl burning toxic green in the ruin (C3)
    brazier(g, CX, TOP, CZ, r=9, fire="toxic")
    # the cursed beacon: a tall shared PN flame rising over the broken crown
    pn_flame(g, CX, CZ, TOP + 8, 22, 32, colors=TOXIC, cross=0.8)
    # charred floor beams sticking out of the walls
    for (x0, z0, x1, z1, y) in ((CX - 30, CZ - 2, CX - 12, CZ + 2, 80), (CX + 10, CZ + 8, CX + 29, CZ + 12, 84), (CX - 3, CZ + 12, CX + 1, CZ + 30, 70)):
        beam = box(g, x0, y, z0, x1, y + 4, z1, "wood", 4)
        P.planks(g, beam, "wood", 4, width=4, across="y", nails=True, seed=14)
        P.flat(g, beam & ((X < CX - 27) | (X > CX + 26) | (Z > CZ + 27)), "wood", 2)
    # a round-arched doorway with a planked door, toxic light at the sill
    door = rounded(CX - 8, CX + 8, 5, 30)
    opening(g, "-z", CZ - R, door, glow=("toxic", 5), deep=("purple", 3))
    leaf = face_prism(g, "-z", CZ - R, [(CX - 7, 5), (CX + 6, 5), (CX + 6, 21), (CX - 7, 21)], 1, 2, C("wood", 5))
    P.planks(g, leaf, "wood", 5, width=3, across="x", length=(40, 41), nails=True, seed=15)
    hood = face_prism(g, "-z", CZ - R, [(CX - 11, 22), (CX - 8, 22), (CX - 5.7, 27.7), (CX, 30), (CX + 5.7, 27.7), (CX + 8, 22), (CX + 11, 22), (CX + 8, 30), (CX, 33.5), (CX - 8, 30)], 0, 2, C("gray", 6))
    P.stone(g, hood, "gray", 6, block=(4, 3), seed=16)
    # the leaning banner pole and its torn skull banner
    px, pz = CX + 11, CZ + 12
    g.prism("z", S.quad((px, TOP + 10), (px - 16, H - 4), 1.6), pz - 1.5, pz + 1.5, C("wood", 5))
    P.flat(g, S.last(g), "wood", 5)
    tip = (px - 16, H - 4)
    rag = [(tip[0] + 1, H - 7), (tip[0] + 30, H - 11), (tip[0] + 27, H - 19), (tip[0] + 31, H - 27), (tip[0] + 25, H - 34), (tip[0] + 18, H - 30), (tip[0] + 12, H - 37), (tip[0] + 6, H - 32), (tip[0] + 3.5, H - 30)]
    sail(g, "z", rag, pz - 0.5, pz + 1.5, ramp="magenta", base=4, glyph="skull", ink=("bone", 7), seed=17)
    # crows on the rim, moss up the back left, rubble and fallen blocks
    crow(g, CX - 20, TOP + 38, CZ - 6, facing=-1)
    crow(g, CX + 14, TOP + 30, CZ - 18, facing=1)
    crow(g, CX + 20, TOP + 14, CZ + 8, facing=1)
    blotch(g, bm & (X < CX) & (Z > CZ - 6), "moss", 6, cell=3, chance=0.14, seed=18)
    # ivy: leafy moss streaks climbing two facets
    ivy = bm & (X < CX + 2) & (Y < 70 - np.abs(Z - CZ) * 1.5) & (((X + Z).astype(int) % 7) < 3)
    P.flat(g, ivy, "moss", 5)
    blotch(g, ivy, "toxic", 3, cell=2, chance=0.12, seed=19)
    # torches by the door (pumpkin-orange accents)
    for tx in (CX - 15, CX + 13):
        box(g, tx, 20, CZ - R - 3, tx + 2, 28, CZ - R, "wood", 4)
        flame_cone(g, tx + 1, 28, CZ - R - 1.5, 2.2, 6, "orange")
    for k, (x, z, r, h) in enumerate(((10, 12, 8, 9), (62, 20, 7, 8), (9, 58, 9, 11), (61, 60, 6, 6))):
        rock(g, x, z, 0, r, h, n=6, ramp="gray", base=5, seed=30 + k)
    blk = box(g, 48, 0, 50, 58, 6, 58, "gray", 5)
    P.stone(g, blk, "gray", 5, block=(5, 3), seed=36)
    pumpkin(g, 22, 0, 60, w=10, h=8, seed=37)
    P.grime(g, (g.a > 0) & (Y < 14) & ~g.solid_mask(), height=4, seed=38)
    # moss caps on the broken tops and the plinth (the upward faces)
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    P.flat(g, (rim | bm) & up & (Y > TOP - 2) & ~floor, "moss", 5)
    blotch(g, (g.a > 0) & up & (Y < 6), "moss", 5, cell=3, chance=0.18, seed=39)
    return g


def build() -> Asset:
    root = Part("ruined-watchtower", keep(), pivot=(0.0, 0.0, 0.0))
    return Asset(id="monster-buildings-ruined-watchtower", pack="monster", category="buildings", name="Ruined Watchtower", root=root)
