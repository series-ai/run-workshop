"""Dungeon trapdoor, in the Pirate Nation haunted style.

A floor slab of painted grey flagstones (its top level with a 4-high floor
tile) with a square opening. A thick plank hatch sits in it, with iron
hinge straps, a big brass ring pull and a toxic-green warning skull; a
glowing toxic pit shows through the seam around it and fills the opening
when the hatch swings up on its back hinges. A chunky iron lever with an
orange knob stands in the front-right corner. Detail is paint (rule S1).

Parts: floor (root), hatch (hinged on its back top edge), lever (pivots on
its base). Clips: open, close (one shot), idle (the hatch jolts as if
something pushes from below; loops). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _kit import keys, pfx, world
from _pn import assemble, coords, last
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

N = 32  # the slab (x, z)
H = 4  # the slab height
SIZE = (N, 20, N)
HOLE = (5, 27)  # the opening (x and z)
HATCH = (6, 26)  # the hatch (x and z), 1 in from the opening: a glowing seam
LEVER = (29.0, 3.0)  # the lever pivot (x, z)
SKULL = ["..#####..", ".#######.", "#########", "#..###..#", "#..###..#", "####.####", ".#######.", "..#.#.#.."]


def floor() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    slab = box(g, 0, 0, 0, N, H, N, "gray", 5)
    a0, a1 = HOLE
    g.box(a0, 1, a0, a1, H, a1, 0)  # the pit, 3 deep
    slab = slab & (g.a > 0)
    top = slab & (Y == H - 1)
    sides = slab & ~top
    P.stone(g, top, "gray", 5, block=(7, 5), frame="top", seed=1)
    P.stone(g, sides, "gray", 5, block=(6, 2), seed=2)
    # a light stone kerb round the opening, iron corner plates
    kerb = top & (X >= a0 - 2) & (X < a1 + 2) & (Z >= a0 - 2) & (Z < a1 + 2)
    P.flat(g, kerb, "gray", 6)
    P.flat(g, kerb & ((X == a0 - 2) | (X == a1 + 1) | (Z == a0 - 2) | (Z == a1 + 1)), "gray", 4)
    for cx, cz in ((a0 - 2, a0 - 2), (a1 - 2, a0 - 2), (a0 - 2, a1 - 2), (a1 - 2, a1 - 2)):
        plate = top & (X >= cx) & (X < cx + 4) & (Z >= cz) & (Z < cz + 4)
        P.flat(g, plate, "gray", 4)
        P.flat(g, plate & ((X + Z) % 3 == 0) & ~((X == cx) | (Z == cz)), "gray", 6)
    # moss in a few joints at the rim
    P.flat(g, top & ((X < 3) | (Z > N - 3)) & ((P._hash(X, Z, seed=3) % np.uint64(5)) == 0), "moss", 5)
    # the pit: dark walls lit green from below, a glowing toxic pool
    inner = slab & (X >= a0 - 1) & (X <= a1) & (Z >= a0 - 1) & (Z <= a1) & (Y >= 1)
    P.flat(g, inner, "gray", 3)
    P.flat(g, inner & (Y == 1), "toxic", 3)
    pool = slab & (Y == 0) & (X >= a0) & (X < a1) & (Z >= a0) & (Z < a1)
    P.flat(g, pool, "toxic", 6)
    cx = (a0 + a1) / 2
    ring = np.hypot(X + 0.5 - cx, Z + 0.5 - cx)
    P.flat(g, pool & (np.abs(np.sin(ring * 0.9)) > 0.85), "toxic", 7)
    for bx, bz in ((10, 12), (20, 9), (15, 21), (23, 19)):
        P.flat(g, pool & (np.abs(X - bx) + np.abs(Z - bz) <= 1), "toxic", 5)
        P.flat(g, pool & (X == bx) & (Z == bz), "toxic", 7)
    # hinge knuckles on the back edge
    for kx in (HATCH[0] + 2, HATCH[1] - 5):
        k = box(g, kx, H, HATCH[1], kx + 3, H + 2, HATCH[1] + 2, "gray", 5)
        P.flat(g, k & (Y == H + 1), "gray", 6)
        P.outline(g, k, "gray", 3, normal="x")
    return g


def hatch() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    h0, h1 = HATCH
    m = box(g, h0, 1, h0, h1, H, h1, "wood", 6)
    top = m & (Y == H - 1)
    under = m & (Y == 1)
    P.planks(g, m & ~top & ~under, "wood", 6, width=4, across="x", nails=False, frame="x", seed=4)
    P.planks(g, top, "wood", 6, width=4, across="x", length=(40, 41), frame="top", seed=5)
    P.planks(g, under, "wood", 5, width=4, across="x", length=(40, 41), frame="top", seed=6)
    # a Z brace on the underside (seen when open)
    P.flat(g, under & ((Z == h0 + 2) | (Z == h1 - 3)), "wood", 7)
    P.flat(g, under & (np.abs((X - h0) - (Z - h0 - 2)) <= 1) & (Z > h0 + 2) & (Z < h1 - 3), "wood", 7)
    P.outline(g, top, "wood", 4, normal="y")
    # two iron hinge straps across, running past the back edge
    for sx in (h0 + 2, h1 - 5):
        strap = m & (X >= sx) & (X < sx + 3) & (Z >= h0 + 4) & ((Y == H - 1) | (Z == h1 - 1))
        P.flat(g, strap, "gray", 4)
        P.flat(g, strap & (X == sx + 1) & ((Z - h0) % 4 == 1), "gray", 6)
    # a toxic warning skull in the middle
    pnglyph.stamp(g, "top", H, int((h0 + h1) / 2) - 4, 14, SKULL, {"#": C("toxic", 5)}, depth=1)
    # the big brass ring pull on a plate near the front edge
    rc = ((h0 + h1) / 2, h0 + 4.0)
    plate = box(g, int(rc[0]) - 2, H, h0 + 1, int(rc[0]) + 2, H + 1, h0 + 3, "gray", 4)
    P.flat(g, plate & (X == int(rc[0])), "gray", 6)
    outer = S.flat_ngon(rc[0], rc[1], 3.4, 8)
    inner = S.flat_ngon(rc[0], rc[1], 2.0, 8)
    for k in range(8):
        g.prism("y", [outer[k], outer[(k + 1) % 8], inner[(k + 1) % 8], inner[k]], H, H + 1.2, C("gold", 4 + (k % 2)))
    return g


def lever() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    lx, lz = LEVER
    base = box(g, int(lx) - 2, H, int(lz) - 2, int(lx) + 2, H + 3, int(lz) + 2, "gray", 4)
    P.plates(g, base, "gray", 4, size=(4, 3))
    P.flat(g, base & (Y == H + 2) & (X == int(lx) - 1), "gray", 2)  # the slot
    # the handle: a thick bar leaning back (a true slope) with a big knob
    g.prism("x", S.quad((H + 2.0, lz), (H + 11.0, lz + 3.0), 1.4, 1.2), lx - 1.3, lx + 1.3, C("gray", 5))
    P.flat(g, last(g) & (Y >= H + 9), "gray", 6)
    s0 = len(g.solids)
    kc = (H + 12.0, lz + 3.3)
    g.prism("x", S.flat_ngon(kc[0], kc[1], 2.3, 8, math.pi), lx - 1.8, lx + 1.8, C("orange", 5))
    knob = np.logical_or.reduce([sd.mask(g.shape) for sd in g.solids[s0:]])
    P.flat(g, knob & (Y >= kc[0]), "orange", 6)
    P.flat(g, knob & (Y < kc[0] - 1), "orange", 4)
    return g


def build():
    parts = {"floor": floor(), "hatch": hatch(), "lever": lever()}
    c = N / 2
    root_j = (c, 0.0, c)
    hinge = (c, float(H), float(HATCH[1]))
    pivot = (LEVER[0], H + 2.0, LEVER[1])
    root = assemble(parts, [
        ("floor", None, root_j),
        ("hatch", "floor", hinge),
        ("lever", "floor", pivot),
    ])
    open_ = Clip("open", {
        "lever": {"rot": keys((0, (0, 0, 0)), (0.25, (-50, 0, 0)), (0.35, (-44, 0, 0)), (0.45, (-48, 0, 0)))},
        "hatch": {"rot": keys((0, (0, 0, 0)), (0.25, (0, 0, 0)), (0.35, (12, 0, 0)), (0.75, (102, 0, 0)), (0.9, (90, 0, 0)), (1.05, (96, 0, 0)), (1.2, (94, 0, 0)))},
    }, loop=False)
    close = Clip("close", {
        "hatch": {"rot": keys((0, (94, 0, 0)), (0.15, (98, 0, 0)), (0.5, (0, 0, 0)), (0.58, (5, 0, 0)), (0.66, (0, 0, 0)))},
        "lever": {"rot": keys((0, (-48, 0, 0)), (0.5, (-48, 0, 0)), (0.75, (0, 0, 0)))},
    }, loop=False)
    idle = Clip("idle", {
        "hatch": {"rot": keys((0, (0, 0, 0)), (1.5, (0, 0, 0)), (1.6, (5, 0, 0)), (1.7, (0, 0, 0)), (1.8, (3, 0, 0)), (1.9, (0, 0, 0)), (3.0, (0, 0, 0)))},
        "lever": {"rot": keys((0, (0, 0, 0)), (1.6, (0, 0, 0)), (1.7, (-4, 0, 0)), (1.85, (0, 0, 0)), (3.0, (0, 0, 0)))},
    })
    return world("trapdoor", "animated-props", "Dungeon Trapdoor", root,
                 clips=[open_, close, idle],
                 sockets=[Socket("socket-pit", at=(0.0, 1.0, 0.0))],
                 # the mist starts as the hatch lifts (it starts at 0.25 s, after the lever), not on the closed lid
                 pfx=[pfx("rvx-monster-grave-mist", "socket-pit", "clip:open", size=34, at=0.3)])
