"""Elven tree in the Pirate Nation style.

PN trees are clumps of big leaf blocks on a curved faceted trunk (the PN
cherry blossom, oak and palm). Here: a pale silver-bark trunk in a gentle
S-curve (sheared 7-sided frustums, true slopes) on a flared root foot and
a mossy patch, four sloped limbs, and a broad crown of eleven big
chamfered leaf blocks in fresh elven greens (some lit, some deep) that
overlap into one rounded cloud. White blossoms with gold hearts are
painted on the block tops, glowing cyan seed gems hang under the crown and cyan runes
glow on the bark (the magic accent, C3).

About 62 wide and 95 tall (tree class; PN cherry 47x55, spooky tree
37x86). The limbs and the crown form the `canopy` part that sways on
`idle` from the trunk top; the leaf-swirl PFX plays at `socket-canopy`.
Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
from _life import asset, coords, leaf_block, ngon, pfx, plan, rig, trunk, up_faces
from voxgrid import C, Clip, Grid, Socket, bob

S = (72, 98, 62)
CX, CZ = 36.0, 31.0
SPLIT = 44.0  # canopy pivot height
PATH = [(CX, 1, CZ), (CX + 0.5, 5, CZ), (CX - 2.5, 18, CZ + 1), (CX + 1.5, 32, CZ - 1), (CX + 1.0, SPLIT, CZ - 0.5),
        (CX - 0.5, 56, CZ + 0.5), (CX + 0.5, 68, CZ)]
RADII = [10.0, 6.6, 5.6, 5.2, 5.0, 3.8, 2.8]
# crown blocks: (dx, cy, dz, sx, sy, sz, ramp, base, lean)
BLOCKS = [
    (0, 70, 0, 30, 18, 28, "leaf", 4, (0.5, 0.0)),
    (-19, 61, 4, 24, 15, 22, "leaf", 5, (-1.0, 0.4)),
    (19, 63, -3, 24, 15, 22, "forest", 6, (1.0, -0.4)),
    (-3, 60, -16, 22, 14, 16, "leaf", 6, (0.0, -1.0)),
    (5, 62, 16, 22, 14, 16, "forest", 6, (0.4, 1.0)),
    (-11, 80, 6, 21, 13, 19, "leaf", 5, (-0.6, 0.4)),
    (11, 80, -6, 19, 13, 18, "leaf", 6, (0.6, -0.4)),
    (1, 89, 1, 15, 10, 15, "leaf", 5, (0.3, 0.0)),
    (-26, 51, -7, 12, 9, 12, "forest", 6, (-0.5, -0.3)),
    (25, 53, 8, 13, 10, 12, "leaf", 5, (0.5, 0.3)),
    (-8, 69, -14, 16, 12, 12, "leaf", 5, (-0.3, -0.8)),
]
# limbs from the trunk top into the crown: (dx, y1, dz, r1)
LIMBS = [(-17, 58, 4, 2.2), (16, 60, -3, 2.2), (-6, 72, 4, 2.0), (7, 74, -4, 2.0)]
RUNES = [
    ["#.#", "###", "#.#", ".#.", ".#."],
    [".#.", "#.#", ".#.", ".#.", "###"],
    ["##.", "#..", "###", "..#", ".##"],
]


def trunk_at(y: float) -> tuple[float, float]:
    """Trunk centre (x, z) at height y (linear along the path)."""
    for (x0, y0, z0), (x1, y1, z1) in zip(PATH, PATH[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            return x0 + t * (x1 - x0), z0 + t * (z1 - z0)
    raise ValueError(f"no trunk at y={y}")


def split_path(lo: float, hi: float):
    """The trunk path between lo and hi (with the radii), cut at those heights."""
    pts, rad = [], []
    for (p, r) in zip(PATH, RADII):
        if lo < p[1] < hi:
            pts.append(p)
            rad.append(r)
    for y, first in ((lo, True), (hi, False)):
        x, z = trunk_at(y)
        k = next(i for i in range(len(PATH) - 1) if PATH[i][1] <= y <= PATH[i + 1][1])
        t = (y - PATH[k][1]) / (PATH[k + 1][1] - PATH[k][1])
        at = 0 if first else len(pts)
        pts.insert(at, (x, y, z))
        rad.insert(at, RADII[k] + t * (RADII[k + 1] - RADII[k]))
    return pts, rad


def lower() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Zi = np.floor(X).astype(int), np.floor(Z).astype(int)
    # a mossy patch with a few pale stones
    turf = plan(g, ngon(CX, CZ, 15, 9, 0.3), 0, 2, "leaf", 4, top=ngon(CX, CZ, 13.5, 9, 0.3))
    P.flat(g, turf & (Y < 1), "moss", 4)
    cell = P._hash(Xi // 2, Zi // 2, seed=7) % np.uint64(8)
    P.flat(g, turf & (Y > 1) & (cell == 1), "leaf", 5)
    P.flat(g, turf & (Y > 1) & (cell == 2), "moss", 5)
    for k, (sx, sz, r) in enumerate(((CX + 10, CZ - 6, 2.6), (CX - 11, CZ + 3, 2.2), (CX - 4, CZ + 11, 1.8))):
        m = plan(g, ngon(sx, sz, r, 6, k * 0.7), 2, 4, "stone", 6, top=ngon(sx + 0.3, sz, r * 0.55, 6, k * 0.7))
        P.flat(g, m & (Y > 3), "stone", 7)
    pts, rad = split_path(1, SPLIT)
    trunk(g, pts, rad, ramp="bone", base=4, n=7, turn=0.2, seed=3)
    # roots flaring into the patch
    for k, ang in enumerate((0.5, 2.1, 3.4, 4.9)):
        ex, ez = CX + 11 * math.cos(ang), CZ + 11 * math.sin(ang)
        mx, mz = CX + 4.5 * math.cos(ang), CZ + 4.5 * math.sin(ang)
        trunk(g, [(ex, 2, ez), (mx, 8, mz)], [1.8, 3.0], ramp="bone", base=4, n=5, turn=ang, seed=10 + k)
    # glowing cyan runes on the bark (front and right side)
    for k, (face, y0) in enumerate((("-z", 7), ("-z", 26), ("+x", 15))):
        x, z = trunk_at(y0 + 2)
        if face == "-z":
            pnglyph.stamp(g, "-z", math.floor(z - 3), int(x) - 3, y0, RUNES[k], {"#": C("cyan", 4)}, scale=2, reach=5)
        else:
            pnglyph.stamp(g, "+x", math.ceil(x + 3), int(z) - 3, y0, RUNES[k], {"#": C("cyan", 4)}, scale=2, reach=5)
    return g


def gem(g: Grid, x: float, y: float, z: float, r: float = 2.6) -> np.ndarray:
    """A glowing double pyramid hung under a leaf block (y is its top)."""
    m = plan(g, [(x, z)] * 4, y - 9, y - 4.5, "plasma", 6, top=ngon(x, z, r, 4, math.pi / 4))
    m |= plan(g, ngon(x, z, r, 4, math.pi / 4), y - 4.5, y - 2, "plasma", 7, top=[(x, z)] * 4)
    g.box(int(x), int(y - 3), int(z), int(x) + 1, int(y) + 1, int(z) + 1, C("gold", 5))
    return m


def canopy() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Zi = np.floor(X).astype(int), np.floor(Z).astype(int)
    pts, rad = split_path(SPLIT, 68)
    trunk(g, pts, rad, ramp="bone", base=4, n=7, turn=0.2, seed=4)
    # limbs: sloped frustums from the trunk top out and up into the blocks
    tx, tz = trunk_at(SPLIT + 2)
    for k, (dx, y1, dz, r1) in enumerate(LIMBS):
        ex, ez = CX + dx, CZ + dz
        mx, mz = tx + dx * 0.45, tz + dz * 0.45
        trunk(g, [(tx + dx * 0.08, SPLIT + 1, tz + dz * 0.08), (mx, (SPLIT + y1) / 2 + 2, mz), (ex, y1, ez)], [3.6, 2.8, r1],
              ramp="bone", base=4, n=5, turn=0.4 * k, seed=20 + k)
    # the crown: big chamfered leaf blocks that overlap into one cloud
    crown = np.zeros(S, dtype=bool)
    for k, (dx, cy, dz, sx, sy, sz, ramp, base, lean) in enumerate(BLOCKS):
        crown |= leaf_block(g, CX + dx, cy, CZ + dz, sx, sy, sz, ramp, base, bevel=3.0, lean=lean, seed=40 + k)
    # white elven blossoms: sparse 2x2 flowers on the block tops, a gold heart
    tops = up_faces(g, crown)
    cell = P._hash(Xi // 3, Zi // 3, seed=9) % np.uint64(7)
    flower = tops & (cell == 0) & (Xi % 3 < 2) & (Zi % 3 < 2)
    P.flat(g, flower, "bone", 7)
    P.flat(g, flower & (Xi % 3 == 0) & (Zi % 3 == 0), "gold", 7)
    # glowing seed gems under the lower blocks
    for dx, dz, y, r in ((-24, -6, 47, 2.4), (-17, 8, 54, 2.0), (23, 7, 48.5, 2.4), (17, -8, 56, 2.0), (-4, -18, 53, 2.2), (7, 18, 55, 2.0)):
        gem(g, CX + dx, y, CZ + dz, r=r)
    return g


def build():
    sx, sz = trunk_at(SPLIT)
    hinge = (sx, SPLIT, sz)
    root, to_root = rig([("elven-tree", lower(), None, None), ("canopy", canopy(), hinge, None)])
    rot = [(t, (a, 0.0, b)) for (t, (a, _, _)), (_, (_, _, b)) in zip(bob(4.0, "x", 1.2, math.pi / 2), bob(4.0, "z", 2.0))]
    sway = {"canopy": {"rot": rot}}
    return asset("terrain-nature", "elven-tree", "Elven Tree", root, clips=[Clip("idle", sway)],
                 sockets=[Socket("socket-canopy", at=to_root((CX, 72, CZ)), parent="canopy")],
                 fx=[pfx("rvx-fantasy-leaf-fall", "socket-canopy", "idle", size=80)])
