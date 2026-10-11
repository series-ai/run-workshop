"""Survivor shack, in the Pirate Nation style.

A patchwork hut on oil-drum stilts: a plank deck and porch, walls pieced
from rust and teal corrugated sheet, weathered planks, a car door and a
big STOP sign, under a steep rusty gable (true slopes) with a tilted solar
panel and a leaning stovepipe that smokes. The function prop is oversized
(rules F4, K1): a giant hubcap wind spinner on a tall mast, its bright
vanes turning on `idle`. A ladder, laundry on a line, a rain barrel fed
by a gutter and crates under the deck finish it. Detail is paint (S1).
Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
import pnshapes as S
from _bld import bloom, crate, gable, label, leg, part, sandbags
from pnkit import box, door, edges, face_prism, window
from voxgrid import C, Asset, Clip, Grid, Part, Socket, bounds_pivot, turn

W, H, D = 120, 122, 96
DECK = 24  # deck top
X0, X1, Z0, Z1 = 26, 80, 34, 78  # hut walls
WALL_TOP, RIDGE = 60, 88
MAST = (96, 40)  # spinner mast (x, z)
HUB = (96, 100, 34)  # spinner hub (x, y, z front)


def shack() -> tuple[Grid, tuple]:
    g = Grid(W, H, D)
    X, Y, Z = S._idx(g)
    dirt = box(g, 2, 0, 4, 110, 2, 94, "sand", 5)
    P.flat(g, dirt, "sand", 5)
    bloom(g, dirt, 6, ((4, 0, 6), (108, 2, 92)), r=(4.0, 8.0), ramp="khaki", shades=(5, 5), seed=1)
    P.outline(g, dirt, "sand", 3, normal="y")

    # ---- oil-drum stilts and a plank deck with a porch
    for k, (dx, dz) in enumerate(((22, 22), (58, 22), (84, 30), (22, 80), (58, 82), (84, 80))):
        S.drum(g, dx, dz, 2, DECK - 6, 7, ramp=("red", "teal", "gold", "red", "teal", "gold")[k], base=5 if k % 3 else 4,
               band=None, wear=True, seed=k)
    deck = box(g, 12, DECK - 4, 14, 94, DECK, 88, "wood", 6)
    P.planks(g, deck, "wood", 6, width=4, across="x", seed=2)
    P.flat(g, deck & (Y < DECK - 3), "wood", 4)
    for rx in (12, 91):  # porch railings
        rail = box(g, rx, DECK, 14, rx + 3, DECK + 10, 34, "wood", 4)
        P.planks(g, rail, "wood", 4, width=3, across="y", nails=False, seed=rx)
    box(g, 12, DECK + 9, 14, 94, DECK + 11, 16, "wood", 4)
    for px in (12, 50, 91):
        box(g, px, DECK, 14, px + 3, DECK + 11, 17, "darkwood", 5)

    # ---- the hut: patchwork walls
    walls = box(g, X0, DECK, Z0, X1, WALL_TOP, Z1, "wood", 6)
    P.planks(g, walls, "wood", 6, width=4, across="x", seed=3)
    # patches: rust, teal and yellow sheet (painted, pattern follows the wall)
    rust = walls & (X < 46) & (Z < 60)
    pnpaint.corrugate(g, rust, "gold", 5, period=3, sheet=10, length=40, seed=4)
    teal = walls & (X >= 58) & (Y >= 40) & (Z < 56)
    pnpaint.corrugate(g, teal, "teal", 5, period=3, sheet=10, length=40, seed=5)
    yel = walls & (X >= X1 - 1) & (Z >= 56) & (Y < 50)
    pnpaint.corrugate(g, yel, "red", 5, period=3, sheet=10, length=40, seed=14)
    P.flat(g, walls & (Z > Z1 - 2) & (Y > 44), "khaki", 5)
    pnpaint.corrugate(g, walls & (Z > Z1 - 2) & (Y > 44), "khaki", 5, period=3, sheet=12, length=40, seed=6)
    for cx0, cz0 in ((X0 - 2, Z0 - 2), (X1 - 2, Z0 - 2), (X0 - 2, Z1 - 2), (X1 - 2, Z1 - 2)):
        post = box(g, cx0, DECK, cz0, cx0 + 4, WALL_TOP + 2, cz0 + 4, "darkwood", 5)
        P.planks(g, post, "darkwood", 5, width=4, across="x", nails=False, seed=cx0)
    # a car door as the front door (teal, with a window)
    cd = box(g, 48, DECK, Z0 - 2, 64, DECK + 28, Z0, "teal", 4)
    P.outline(g, cd, "teal", 2, normal="z")
    P.flat(g, cd & (Y >= DECK + 16) & (Y < DECK + 25) & (X > 49) & (X < 63), "sky", 6)
    P.flat(g, cd & (Y == DECK + 12) & (X >= 59) & (X < 62), "steel", 6)
    # a big STOP sign nailed on as a patch (an octagon, text never mirrored)
    stop = face_prism(g, "-z", Z0, S.flat_ngon(38, 50, 11.5, 8, -math.pi / 2), 0, 2, C("red", 5))
    P.outline(g, stop, "bone", 7, normal="z")
    label(g, "-z", Z0 - 2, 38, 47, "STOP", "bone", 7, scale=1, gap=0)
    window(g, "-z", Z0, 66, 76, 38, 50, glass="gold", glow=6)
    window(g, "+x", X1, 46, 60, 36, 48, glass="gold", glow=6)
    for p0, p1 in (((40, 36), (54, 48)),):
        S.bar(g, "x", (p0[0], p0[1]), (p1[0], p1[1]), 3, X1, X1 + 2, "wood", 4)

    # ---- roof: a steep rusty gable, a gutter, a tilted solar panel
    roof = gable(g, X0 - 2, X1 + 2, Z0 - 2, Z1 + 2, WALL_TOP + 1, RIDGE, ridge="x", thick=3, overhang=6, roof=("rust", 5), style="corrugate",
                 attic=("wood", 5), attic_style="planks", seed=7)
    bloom(g, roof["slabs"] & ~roof["trim"], 4, ((X0, WALL_TOP, Z0), (X1, RIDGE, Z1)), r=(4.0, 6.0), ramp="teal", shades=(5, 5), seed=8)
    gut = box(g, X0 - 6, WALL_TOP - 4, Z1 + 6, X1 + 6, WALL_TOP - 1, Z1 + 9, "steel", 5)
    P.flat(g, gut & (Y == WALL_TOP - 2), "steel", 4)
    S.bar(g, "z", (X1 + 4, WALL_TOP - 3), (X1 + 8, DECK + 20), 2.2, Z1 + 6, Z1 + 8, "steel", 5)
    # solar panel on the front slope
    pz0 = Z0 - 2
    g.prism("x", [(WALL_TOP + 8, pz0 + 6), (WALL_TOP + 10, pz0 + 6), (RIDGE - 2, pz0 + 20), (RIDGE - 4, pz0 + 20)], 30, 50, C("sky", 4))
    sol = S.last(g)
    Yc = Y
    P.flat(g, sol & (((X - 30) % 5) == 0), "steel", 6)
    P.flat(g, sol & (((Yc - WALL_TOP) % 5) == 0), "steel", 6)
    P.outline(g, sol, "steel", 5, normal="x")

    # ---- a leaning stovepipe on the back slope (smoke comes out of its top)
    sx, sz = 66, Z1 - 6
    pipe = leg(g, sx - 3, sz - 3, sx + 3, sz + 3, RIDGE - 22, RIDGE + 10, 2.5, 1.0, ramp="steel", base=5, planks=False)
    P.flat(g, pipe & (Y % 8 == 0), "steel", 3)
    S.disc(g, "y", sx + 2.5, sz + 1, 5.5, RIDGE + 10, RIDGE + 13, "rust", 5)
    smoke = (sx + 2.5, RIDGE + 13, sz + 1)

    # ---- a ladder up to the porch
    for lx in (30, 40):
        S.bar(g, "x", (1.5, 5), (DECK, 14), 2.2, lx, lx + 2, "wood", 4)
    for k in range(1, 5):
        yy = k * DECK / 5
        box(g, 30, yy, 4 + yy * 10 / DECK, 42, yy + 1.5, 6 + yy * 10 / DECK, "wood", 6)

    # ---- the spinner mast, a laundry line to the hut, a rain barrel
    mx, mz = MAST
    mast = box(g, mx - 2, DECK, mz - 2, mx + 2, HUB[1] - 2, mz + 2, "darkwood", 5)
    P.planks(g, mast, "darkwood", 5, width=4, across="x", nails=False, seed=9)
    for (a, b) in (((mx - 12, DECK), (mx - 1, DECK + 18)), ((mx + 12, DECK), (mx + 1, DECK + 18))):  # braces
        S.bar(g, "z", a, b, 2.2, mz - 1, mz + 1, "darkwood", 5)
    box(g, mx - 1, HUB[1] - 3, mz - 6, mx + 1, HUB[1] + 3, mz - 2, "steel", 4)  # the axle bracket
    box(g, X1 + 2, WALL_TOP - 4, 58, mx, WALL_TOP - 3, 59, "bone", 5)  # the line
    for k2, (lx, ramp) in enumerate(((84, "red"), (89, "sky"))):
        cl = box(g, lx, WALL_TOP - 13, 57, lx + 4, WALL_TOP - 4, 60, ramp, 5)
        P.outline(g, cl, ramp, 4, normal="z")
    S.drum(g, 98, 76, DECK, 14, 6.5, ramp="teal", base=5, band=None, seed=10)

    # ---- crates stored under the deck
    crate(g, 34, 2, 44, 12, ramp="sand", base=4, seed=11)
    crate(g, 66, 2, 50, 12, ramp="khaki", base=5, seed=12)
    sandbags(g, "x", 4, 20, 90, 2, rows=2, h=4, d=5, seed=13)
    return g, smoke


def spinner() -> Grid:
    """The giant hubcap spinner: a chrome hub and six bright vanes (a true
    slope each) facing -z."""
    g = Grid(W, H, D)
    hx, hy, hz = HUB
    colours = ("red", "gold", "teal", "bone", "orange", "sky")
    for k in range(6):
        a = math.radians(60 * k)
        tip = (hx + 17 * math.cos(a), hy + 17 * math.sin(a))
        g.prism("z", S.quad((hx, hy), tip, 1.5, 4.0), hz, hz + 2, C(colours[k], 5))
        P.outline(g, S.last(g), colours[k], 3, normal="z")
    hub = S.disc(g, "z", hx, hy, 5.5, hz - 2, hz + 3, "steel", 6, n=10)
    P.flat(g, hub & (S.radial(g, "z", hx, hy) < 2), "red", 5)
    P.flat(g, hub & (S.radial(g, "z", hx, hy) > 4.4), "steel", 4)
    return g


def build() -> Asset:
    g, smoke = shack()
    pivot = bounds_pivot(g)
    root = Part("survivor-shack", g, pivot=pivot)
    part(root, "spinner", spinner(), (HUB[0], HUB[1], HUB[2]))
    return Asset(id="apocalypse-buildings-survivor-shack", pack="apocalypse", category="buildings", name="Survivor Shack", root=root,
                 clips=[Clip("idle", {"spinner": {"rot": turn(2.0, "z", 180)}})],
                 sockets=[Socket("socket-chimney", at=tuple(float(smoke[i] - pivot[i]) for i in range(3)))],
                 pfx=[{"effectId": "rvx-apocalypse-chimney-smoke", "socket": "socket-chimney", "trigger": "idle", "size": 30}])
