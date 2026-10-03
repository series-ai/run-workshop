"""Witch hut, in the Pirate Nation haunted style.

A plank shack on crooked stilts over a toxic swamp. Its walls lean (true
slopes, rules F2 and F5), with painted boards, patches and dark corner
posts; a round window glows toxic green. The roof is a tall twisted purple
thatch cone that bends over at the tip like a witch's hat (F4). A stone
chimney puffs poison; herbs and bones hang under the eaves. The function
prop is oversized: a big iron cauldron of bubbling green brew on the
porch (F6). A ladder, reeds, rocks and pumpkins finish it. On `idle` the
door creaks open and shut. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _bld import coords, parts, rock, stone
from _props import pn_flame
from _pn import blotch, pumpkin
from pnkit import box
from voxgrid import C, Asset, Clip, Grid, Socket

W, H, D = 104, 124, 104
CX, CZ = 52.0, 54.0
DECK = 20  # platform top
HX0, HX1, HZ0, HZ1 = 30, 72, 40, 74  # hut walls at the floor
LEAN = 3  # the walls lean toward +x by this much at the top
WALL = 60
DOOR = (40.0, 24.0, HZ0 - 1.0)  # hinge: left edge, bottom, front face
DOOR_W, DOOR_H = 14, 28
CHIM = (73.0, 70.0)  # chimney centre x, z


def hut() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # the swamp: a murky toxic pool, reeds and rocks
    S.disc(g, "y", CX, CZ, 44, 0, 2, "moss", 5, n=10)
    pool = S.last(g)
    P.mottle(g, pool, "moss", 5, cell=4, seed=1)
    P.flat(g, pool & (np.hypot(X - CX + 12, Z - CZ + 24) < 12), "teal", 4)
    P.flat(g, pool & (np.hypot(X - CX + 12, Z - CZ + 24) < 7), "toxic", 4)
    P.flat(g, pool & (np.hypot(X - CX - 28, Z - CZ - 20) < 9), "teal", 4)
    P.flat(g, pool & (np.hypot(X - CX - 28, Z - CZ - 20) < 5), "toxic", 4)
    for k, (x, z, r, h) in enumerate(((16, 70, 7, 6), (88, 36, 6, 5), (84, 84, 5, 4))):
        rock(g, x, z, 2, r, h, n=6, seed=2 + k)
    for k, (x, z, h) in enumerate(((10, 40, 16), (13, 44, 12), (92, 60, 14), (89, 66, 18), (60, 94, 13))):
        box(g, x, 2, z, x + 2, 2 + h, z + 2, "moss", 5)
        box(g, x, 2 + h - 5, z - 0.5, x + 2, 2 + h, z + 2.5, "wood", 4)  # cattail heads
    # crooked stilts and the plank platform
    for k, (x, z, lean) in enumerate(((HX0 - 2, HZ0 - 8, -3), (HX1 - 2, HZ0 - 8, 2), (HX0, HZ1 - 2, -2), (HX1, HZ1 - 2, 3))):
        g.prism("y", [(x, z), (x + 5, z), (x + 5, z + 5), (x, z + 5)], 0, DECK - 3, C("wood", 4), top=[(x + lean, z), (x + 5 + lean, z), (x + 5 + lean, z + 5), (x + lean, z + 5)])
        st = S.last(g)
        P.planks(g, st, "wood", 4, width=5, across="x", nails=False, seed=5 + k)
        P.flat(g, st & (Y < 4), "moss", 4)
    deck = box(g, HX0 - 12, DECK - 4, HZ0 - 16, HX1 + 6, DECK, HZ1 + 4, "wood", 5)
    P.planks(g, deck, "wood", 5, width=4, across="y", nails=True, seed=9)
    P.flat(g, deck & (Y < DECK - 3), "wood", 4)
    # leaning plank walls: a frustum with its top shifted (true slopes)
    base = [(HX0, HZ0), (HX1, HZ0), (HX1, HZ1), (HX0, HZ1)]
    top = [(x + LEAN, z + 1) for x, z in base]
    g.prism("y", base, DECK, WALL, C("wood", 6), top=top)
    walls = [g.solids[-1]]
    S.paint_facets(g, walls, lambda gg, mm, fr: P.planks(gg, mm, "wood", 6, width=3, across="x" if fr == "top" else "y", length=(12, 20), frame=fr, seed=10))
    wm = S.last(g)
    P.flat(g, wm & S.seams(g, walls, 2.2), "wood", 4)
    P.flat(g, wm & (Y < DECK + 2), "wood", 4)
    # patches: odd boards nailed over the walls
    for k, (x0, y0, x1, y1) in enumerate(((HX0 + 26, DECK + 22, HX0 + 34, DECK + 30), (HX0 + 4, DECK + 6, HX0 + 10, DECK + 16))):
        patch = wm & (X >= x0) & (X < x1) & (Y >= y0) & (Y < y1) & (Z < HZ0 + 2)
        P.flat(g, patch, "purple", 4)
        P.outline(g, patch, "purple", 2, normal="z")
    # a round window glowing toxic green in a thick wood ring
    wx, wy = HX0 + 29.5, DECK + 28
    ring = S.disc(g, "z", wx, wy, 7, HZ0 - 2, HZ0 + 1, "wood", 4)
    pane = S.disc(g, "z", wx, wy, 5, HZ0 - 3, HZ0 - 1, "toxic", 5)
    P.flat(g, pane & ((np.abs(X - wx) < 0.6) | (np.abs(Y - wy) < 0.6)), "wood", 3)
    P.flat(g, pane & (Y > wy + 2), "toxic", 6)
    # the door frame (the door itself is a part)
    fr = box(g, DOOR[0] - 2, DECK, HZ0 - 1, DOOR[0], DECK + DOOR_H + 2, HZ0 + 1, "wood", 4) | box(g, DOOR[0] + DOOR_W, DECK, HZ0 - 1, DOOR[0] + DOOR_W + 2, DECK + DOOR_H + 2, HZ0 + 1, "wood", 4)
    fr |= box(g, DOOR[0] - 2, DECK + DOOR_H, HZ0 - 1, DOOR[0] + DOOR_W + 2, DECK + DOOR_H + 3, HZ0 + 1, "wood", 4)
    P.planks(g, fr, "wood", 4, width=2, across="y", nails=False, seed=11)
    inside = box(g, DOOR[0], DECK, HZ0, DOOR[0] + DOOR_W, DECK + DOOR_H, HZ0 + 1, "purple", 3)
    P.flat(g, inside & (Y < DECK + 8), "toxic", 4)
    # the twisted thatch cone: three turned, shifted frustums and a bent tip
    tiers = [(36, WALL - 2, 0.0, 0.0), (22, WALL + 16, -1.0, -1.0), (11, WALL + 34, -4.0, -4.0), (4.5, WALL + 48, -10.0, -10.0), (0.0, WALL + 56, -18.0, -18.0)]
    cx0, cz0 = (HX0 + HX1) / 2 + LEAN, (HZ0 + HZ1) / 2
    start = len(g.solids)
    for k in range(len(tiers) - 1):
        (r0, y0, dx0, dz0), (r1, y1, dx1, dz1) = tiers[k], tiers[k + 1]
        a0, a1 = 15 * k, 15 * (k + 1)
        p0 = S.rotate(S.flat_ngon(cx0 + dx0, cz0 + dz0, r0, 8), cx0 + dx0, cz0 + dz0, a0)
        p1 = S.rotate(S.flat_ngon(cx0 + dx1, cz0 + dz1, r1, 8), cx0 + dx1, cz0 + dz1, a1) if r1 > 0 else [(cx0 + dx1, cz0 + dz1)] * 8
        g.prism("y", p0, y0, y1, C("purple", 4), top=p1)
    roof = g.solids[start:]
    S.paint_facets(g, roof, lambda gg, mm, fr: P.thatch(gg, mm, "purple", 4, band=5, frame=fr, seed=12))
    rm = np.logical_or.reduce([s.mask(g.shape) for s in roof])
    blotch(g, rm, "moss", 5, cell=4, chance=0.025, seed=14)
    P.flat(g, rm & (Y < WALL + 1), "purple", 2)  # the dark shaggy eave
    box(g, cx0 - 20, WALL + 49, cz0 - 20, cx0 - 16, WALL + 55, cz0 - 16, "toxic", 6)  # a glowing charm on the tip
    # the chimney: a stone stack through the roof, toxic glow in the flue
    chx, chz = CHIM
    ch = stone(g, chx - 5, DECK, chz - 5, chx + 5, WALL + 26, chz + 5, "stone", 5, block=(5, 3), seed=15)
    stone(g, chx - 6, WALL + 26, chz - 6, chx + 6, WALL + 30, chz + 6, "gray", 6, block=(6, 2), seed=16)
    g.box(chx - 3, WALL + 29, chz - 3, chx + 3, WALL + 30, chz + 3, C("toxic", 6))
    # herbs and bones hanging under the front eave
    for k, x in enumerate((HX0 + 2, HX0 + 8, HX1 - 6, HX1 + 1)):
        box(g, x, WALL - 1, HZ0 - 6, x + 1, WALL + 1, HZ0 - 5, "wood", 3)
        if k % 2 == 0:
            b = box(g, x - 1, WALL - 9, HZ0 - 7, x + 2, WALL - 1, HZ0 - 4, "moss", 5)
            P.flat(g, b & (Y < WALL - 6), "toxic", 4)
        else:
            box(g, x - 1, WALL - 8, HZ0 - 6, x + 2, WALL - 6, HZ0 - 5, "bone", 6)
            box(g, x, WALL - 7, HZ0 - 6, x + 1, WALL - 1, HZ0 - 5, "bone", 6)
    # the oversized cauldron on the porch (the function prop)
    kx, kz = HX0 - 1, HZ0 - 9
    for lx, lz in ((-5, -5), (4, -5), (-5, 4), (4, 4)):
        box(g, kx + lx, DECK, kz + lz, kx + lx + 2, DECK + 3, kz + lz + 2, "gray", 3)
    pot = S.cone(g, "y", kx, kz, 7, DECK + 2, DECK + 7, "gray", 3, r_top=10)
    pot |= S.cone(g, "y", kx, kz, 10, DECK + 7, DECK + 14, "gray", 3, r_top=8.5)
    P.flat(g, pot & (Y > DECK + 12.5), "gray", 5)
    brew = S.disc(g, "y", kx, kz, 7.5, DECK + 13, DECK + 14.5, "toxic", 5)
    for bx, bz, br in ((kx - 3, kz - 2, 2.2), (kx + 3, kz + 2, 1.6), (kx + 1, kz - 4, 1.4)):
        box(g, bx - br, DECK + 14, bz - br, bx + br, DECK + 14 + br * 1.4, bz + br, "toxic", 6)
    # the fire under it: shared PN flames licking out round the pot's foot
    for fx, fz, ax in ((kx, kz - 10.5, "z"), (kx - 10.5, kz, "x"), (kx + 10.5, kz + 1, "x"), (kx + 1, kz + 10.5, "z")):
        pn_flame(g, fx, fz, DECK, 7, 13, axis=ax)
    # the ladder up to the porch, pumpkins on the deck
    for x in (HX0 + 6, HX0 + 14):
        S.bar(g, "x", (1.3, HZ0 - 30), (DECK, HZ0 - 16), 2.4, x, x + 2, "wood", 5)
    for k in range(1, 4):
        yk = DECK * k / 4
        zk = HZ0 - 30 + 14 * k / 4
        box(g, HX0 + 6, yk, zk - 1, HX0 + 16, yk + 2, zk + 1, "wood", 4)
    pumpkin(g, HX1 + 1, DECK, HZ0 - 10, w=10, h=8, seed=17)
    pumpkin(g, HX0 - 3, DECK, HZ1 - 2, w=9, h=7, seed=18)
    return g


def door() -> Grid:
    """A planked purple door with an arched top, iron straps and a moon."""
    g = Grid(W, H, D)
    x0, y0, z = DOOR
    pts = [(x0, y0), (x0 + DOOR_W, y0), (x0 + DOOR_W, y0 + DOOR_H - 5)] + [(x0 + DOOR_W / 2 + DOOR_W / 2 * math.cos(math.pi * k / 6), y0 + DOOR_H - 5 + 5 * math.sin(math.pi * k / 6)) for k in range(1, 6)] + [(x0, y0 + DOOR_H - 5)]
    g.prism("z", pts, z - 1, z + 1, C("purple", 4))
    m = S.last(g)
    P.planks(g, m, "purple", 4, width=3, across="x", length=(40, 41), nails=True, seed=19)
    X, Y, Z = coords(g)
    for yy in (y0 + 5, y0 + 18):
        P.flat(g, m & (Y > yy) & (Y < yy + 2), "gray", 3)
    moon = m & (np.hypot(X - x0 - 7, Y - y0 - 12) < 3.2) & ~(np.hypot(X - x0 - 8.4, Y - y0 - 13) < 2.6)
    P.flat(g, moon, "gold", 6)
    box(g, x0 + DOOR_W - 3, y0 + 11, z - 2, x0 + DOOR_W - 1, y0 + 13, z - 1, "gold", 5)
    return g


def build() -> Asset:
    root = parts({"hut": hut(), "door": door()}, [("hut", None, (0.0, 0.0, 0.0)), ("door", "hut", DOOR)])
    creak = [(0.0, 0.0), (0.6, 0.0), (1.1, 38.0), (1.4, 30.0), (1.7, 40.0), (2.6, 40.0), (3.2, 4.0), (3.4, 0.0), (4.0, 0.0)]
    chx, chz = CHIM
    return Asset(
        id="monster-buildings-witch-hut", pack="monster", category="buildings", name="Witch Hut", root=root,
        clips=[Clip("idle", {"door": {"rot": [(t, (0.0, a, 0.0)) for t, a in creak]}})],
        sockets=[Socket("socket-chimney", at=(chx, WALL + 30, chz), parent="hut")],
        pfx=[{"effectId": "rvx-monster-witch-smoke", "socket": "socket-chimney", "trigger": "idle", "size": 40}],
    )
