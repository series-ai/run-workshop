"""Royal stables in the Pirate Nation style.

A long, low stable block (one storey, ridge along x) on a stone plinth:
light board-and-batten walls framed by thick dark posts, and a red tile
roof with a deep front eave over a row of four stalls. Each stall has a
Dutch half door: two horses (a bay and a grey) look out over the lower
leaves, one stall shows a hay rack, and one is shut. In the middle, a
tall double door stands open on the dark aisle, under a hayloft cross
gable with a loft hatch and a hoist beam. A louvred cupola with a gold
horse vane rides the ridge (rules F4, F5).

The function prop is the stall row with the horses (rule F6). A gold
horseshoe sign hangs over the aisle door and a lantern on a bracket
glows beside it (PFX). A water trough, stacked hay bales, a saddle on a
rail and a feed bucket stand round the base (rule K1). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _fbld_rural import dutch_door, hay_bale, horse_head, idx, plank_wall, straw
from _props import lamp_lantern
from pnkit import barrel, beam, box, edges, gable_roof, window
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 140, 96, 96
X0, X1, Z0, Z1 = 16, 120, 38, 80  # stable walls; the front is z = Z0
WALL_TOP, RIDGE = 42, 66  # one storey of 38 (y 4..42) and a roof of 24
POSTS = (16, 36, 56, 80, 100, 120)  # the bay posts; the middle bay is the aisle
SPLIT = 18  # the top of the lower stall leaves
LOFT = (60, 76)  # the hayloft cross gable (x)
LAMP = (51, 26, Z0 - 6)  # the lantern beside the aisle door


def block(g: Grid) -> None:
    """Plinth, plank walls, posts, top plate and the long tiled roof."""
    X, Y, Z = idx(g)
    plinth = box(g, X0 - 3, 0, Z0 - 3, X1 + 3, 4, Z1 + 3, "stone", 5)
    P.stone(g, plinth, "stone", 5, block=(9, 4), seed=1)
    P.flat(g, plinth & (Y < 1), "stone", 3)
    walls = box(g, X0, 4, Z0, X1, WALL_TOP, Z1, "wood", 6)
    plank_wall(g, walls, "wood", 6, across="x", width=4, seed=2)
    P.grime(g, walls, height=4, seed=3)
    pm = np.zeros(g.shape, dtype=bool)
    for px in POSTS:  # the bay posts on the front and back
        x0 = px - 2
        pm |= box(g, x0, 4, Z0 - 2, x0 + 4, WALL_TOP, Z0 + 2, "darkwood", 4)
        pm |= box(g, x0, 4, Z1 - 2, x0 + 4, WALL_TOP, Z1 + 2, "darkwood", 4)
    for pz in (Z0 + 21,):  # a middle post on each gable end
        pm |= box(g, X0 - 2, 4, pz - 2, X0 + 2, WALL_TOP, pz + 2, "darkwood", 4)
        pm |= box(g, X1 - 2, 4, pz - 2, X1 + 2, WALL_TOP, pz + 2, "darkwood", 4)
    P.planks(g, pm, "darkwood", 4, width=4, across="x", nails=False, seed=4)
    P.flat(g, edges(pm), "darkwood", 2)
    beam(g, X0 - 3, WALL_TOP - 3, Z0 - 3, X1 + 3, WALL_TOP + 1, Z1 + 3, base=4, seed=5)  # the top plate
    roof = gable_roof(g, X0, X1, Z0, Z1, WALL_TOP, RIDGE, ramp="red", thick=4, overhang=5, gable="wood", ridge="x", seed=6)
    gab = roof["attic"]
    plank_wall(g, gab, "wood", 5, across="z", width=4, frame="x", seed=7)
    # small vent louvres in each gable end
    for gx, face in ((X0, -1), (X1, 1)):
        cz = (Z0 + Z1) / 2
        vm = gab & (np.abs(Z + 0.5 - cz) < 5) & (Y >= WALL_TOP + 6) & (Y < WALL_TOP + 16)
        P.flat(g, vm, "darkwood", 2)
        P.flat(g, vm & (Y % 3 == 0), "wood", 4)
        P.outline(g, vm, "darkwood", 4, normal="x")
    # stall windows on the back wall, square and shuttered
    for bx0, bx1 in zip(POSTS, POSTS[1:]):
        cx = (bx0 + bx1) // 2
        window(g, "+z", Z1, cx - 6, cx + 6, 22, 32, glass="gold", glow=4)


def stalls(g: Grid) -> None:
    """The four Dutch stall doors with two horses and a hay rack, and the
    open double door of the middle aisle."""
    X, Y, Z = idx(g)
    looks = ("bay", "hay", "grey", "shut")
    for (bx0, bx1), look in zip(((16, 36), (36, 56), (80, 100), (100, 120)), looks):
        u0, u1 = bx0 + 3, bx1 - 3  # 14 wide leaves between the posts
        d = dutch_door(g, Z0, u0, u1, 4, 32, SPLIT, upper="closed" if look == "shut" else "open",
                       leaf=("wood", 4), seed=bx0)
        cx = (u0 + u1) / 2
        if look == "bay":
            horse_head(g, cx, SPLIT, Z0 + 4, coat=("wood", 3), mane=("darkwood", 2), seed=1)
        elif look == "grey":
            horse_head(g, cx, SPLIT, Z0 + 4, coat=("bone", 5), mane=("gray", 3), blaze=("bone", 7), seed=2)
        elif look == "hay":
            r = d["recess"]
            rack = box(g, r[0] + 1, SPLIT + 1, Z0 + 2, r[3] - 1, SPLIT + 9, Z0 + 5, "sand", 4)
            straw(g, rack, frame="z", base=3, tie=99, seed=10)
            P.flat(g, rack & (Y == SPLIT + 8) & (X % 2 == 0), "sand", 6)
            for hx in range(r[0] + 2, r[3] - 1, 3):  # rack bars over the hay
                box(g, hx, SPLIT + 5, Z0 + 1, hx + 1, SPLIT + 13, Z0 + 2, "darkwood", 3)
            box(g, r[0], SPLIT + 12, Z0 + 1, r[3], SPLIT + 13, Z0 + 2, "darkwood", 3)
        else:  # a name board on the shut stall
            nb = box(g, u0 + 2, 25, Z0 - 3, u1 - 2, 29, Z0 - 2, "bone", 6)
            P.outline(g, nb, "darkwood", 3, normal="z")
            P.flat(g, nb & (Y == 27) & (X % 2 == 0) & (X > u0 + 3) & (X < u1 - 3), "darkwood", 3)
    # the aisle: a dark recess with both leaves swung open
    a0, a1, top = 58, 78, 34  # a 20 wide, 30 high opening
    g.a[a0:a1, 4:top, Z0:Z0 + 8] = 0
    back = box(g, a0, 4, Z0 + 8, a1, top, Z0 + 9, "darkwood", 1)
    P.flat(g, back & (Y > top - 8), "darkwood", 0)
    side = P.region(g, a0 - 1, 4, Z0, a1 + 1, top + 1, Z0 + 8)
    P.flat(g, side, "darkwood", 2)
    floor = box(g, a0, 3, Z0, a1, 4, Z0 + 8, "sand", 3)
    straw(g, floor, frame="top", base=1, tie=99, seed=11)
    fr = box(g, a0 - 2, 4, Z0 - 2, a0, top + 3, Z0, "darkwood", 3)
    fr |= box(g, a1, 4, Z0 - 2, a1 + 2, top + 3, Z0, "darkwood", 3)
    fr |= box(g, a0 - 2, top, Z0 - 2, a1 + 2, top + 3, Z0, "darkwood", 3)
    P.planks(g, fr, "darkwood", 3, width=2, across="y", nails=False, seed=12)
    for lx0 in (a0 - 4, a1 + 2):  # the two leaves, open square to the wall
        leaf = box(g, lx0, 4, Z0 - 12, lx0 + 2, top, Z0 - 2, "wood", 4)
        P.planks(g, leaf, "wood", 4, width=4, across="z", length=(60, 61), nails=False, frame="x", seed=lx0)
        P.flat(g, edges(leaf), "darkwood", 3)
        P.flat(g, leaf & ((Y == 9) | (Y == 10) | (Y == top - 6) | (Y == top - 5)), "darkwood", 4)
    # a saddle on a rack inside the aisle catches the light
    box(g, a0 + 3, 14, Z0 + 6, a0 + 9, 16, Z0 + 8, "darkwood", 3)
    sd = box(g, a0 + 2, 16, Z0 + 5, a0 + 10, 20, Z0 + 8, "red", 3)
    P.flat(g, sd & (Y == 19), "red", 5)
    box(g, a0 + 4, 12, Z0 + 5, a0 + 5, 16, Z0 + 6, "gold", 5)  # the stirrup


def loft(g: Grid) -> None:
    """The hayloft cross gable over the aisle with an open hatch full of
    hay, a hoist beam, a rope and a hook."""
    X, Y, Z = idx(g)
    lx0, lx1 = LOFT
    lz0, ltop, lridge = Z0 - 2, 58, 64
    front = box(g, lx0, WALL_TOP, lz0, lx1, ltop, Z0 + 18, "wood", 5)
    plank_wall(g, front, "wood", 5, across="x", width=4, seed=20)
    roof = gable_roof(g, lx0, lx1, lz0, Z0 + 15, ltop, lridge, ramp="red", thick=4, overhang=4, gable="wood", ridge="z", seed=21)
    plank_wall(g, roof["attic"], "wood", 5, across="x", width=4, frame="z", seed=22)
    # the hatch: a dark opening with hay heaped in it
    h0, h1, v0, v1 = lx0 + 3, lx1 - 3, WALL_TOP + 3, WALL_TOP + 15
    g.a[h0:h1, v0:v1, lz0:lz0 + 4] = 0
    box(g, h0, v0, lz0 + 4, h1, v1, lz0 + 5, "darkwood", 1)
    P.flat(g, P.region(g, h0 - 1, v0 - 1, lz0, h1 + 1, v1 + 1, lz0 + 4), "darkwood", 2)
    hay = box(g, h0, v0, lz0 + 1, h1, v0 + 6, lz0 + 4, "sand", 4)
    straw(g, hay, frame="z", base=3, tie=99, seed=23)
    hfr = box(g, h0 - 2, v0 - 2, lz0 - 2, h0, v1 + 2, lz0, "darkwood", 3)
    hfr |= box(g, h1, v0 - 2, lz0 - 2, h1 + 2, v1 + 2, lz0, "darkwood", 3)
    hfr |= box(g, h0 - 2, v1, lz0 - 2, h1 + 2, v1 + 2, lz0, "darkwood", 3)
    hfr |= box(g, h0 - 2, v0 - 2, lz0 - 2, h1 + 2, v0, lz0, "darkwood", 3)
    P.planks(g, hfr, "darkwood", 3, width=2, across="y", nails=False, seed=24)
    # the hoist beam out of the gable, a rope and a hook
    hb = box(g, (lx0 + lx1) // 2 - 2, 61, lz0 - 14, (lx0 + lx1) // 2 + 2, 65, lz0 + 2, "darkwood", 4)
    P.planks(g, hb, "darkwood", 4, width=4, across="y", nails=True, seed=25)
    cx = (lx0 + lx1) // 2
    box(g, cx - 1, 48, lz0 - 12, cx + 1, 61, lz0 - 10, "sand", 2)
    hook = box(g, cx - 1, 45, lz0 - 13, cx + 1, 48, lz0 - 9, "iron", 4)
    P.flat(g, hook & (Y == 45), "iron", 3)


def cupola(g: Grid) -> None:
    """A louvred cupola on the ridge with a pyramid roof and a gold horse
    weather vane (a tilted, true-slope silhouette, rule F5)."""
    X, Y, Z = idx(g)
    cx, cz = 96, (Z0 + Z1) // 2
    base = box(g, cx - 6, RIDGE - 2, cz - 6, cx + 6, RIDGE + 8, cz + 6, "wood", 6)
    plank_wall(g, base, "wood", 6, across="x", width=3, seed=30)
    lv = base & (Y >= RIDGE + 2) & (Y < RIDGE + 7) & ((np.abs(X + 0.5 - cx) < 4) | (np.abs(Z + 0.5 - cz) < 4))
    P.flat(g, lv, "darkwood", 2)
    P.flat(g, lv & (Y % 2 == 0), "wood", 4)
    S.hip_roof(g, cx - 9, cz - 9, cx + 9, cz + 9, RIDGE + 8, 7, ramp="red", base=3, ridge="x", inset=9, trim=("darkwood", 3), seed=31)
    box(g, cx - 1, RIDGE + 14, cz - 1, cx + 1, RIDGE + 21, cz + 1, "iron", 4)
    # the vane: an iron arrow with a gold horse-head tail fin (rule F5)
    vy = RIDGE + 18
    box(g, cx - 8, vy, cz - 0.5, cx + 7, vy + 1, cz + 0.5, "iron", 4)
    g.prism("z", [(cx + 7, vy - 2), (cx + 11, vy + 0.5), (cx + 7, vy + 3)], cz - 0.5, cz + 0.5, C("gold", 5))
    g.prism("z", [(cx - 8, vy - 3), (cx - 3, vy - 1), (cx - 3, vy + 3), (cx - 6, vy + 5), (cx - 8, vy + 4)], cz - 0.5, cz + 0.5, C("gold", 5))
    P.flat(g, S.last(g) & (Y >= vy + 3), "gold", 6)


def yard(g: Grid) -> None:
    """The props round the base: a water trough, hay bales, a feed
    bucket, a horseshoe sign and the lantern bracket (rule K1)."""
    X, Y, Z = idx(g)
    # the water trough before the bay stall
    tr = box(g, 10, 0, Z0 - 16, 34, 9, Z0 - 8, "wood", 4)
    P.planks(g, tr, "wood", 4, width=3, across="y", nails=True, seed=40)
    P.flat(g, edges(tr), "darkwood", 2)
    water = box(g, 11, 8, Z0 - 15, 33, 9, Z0 - 9, "sky", 4)
    P.flat(g, water & ((X + Z) % 7 == 0), "sky", 6)
    for lx in (12, 30):
        box(g, lx, 0, Z0 - 17, lx + 2, 3, Z0 - 7, "darkwood", 3)
    # hay bales stacked by the right gable
    hay_bale(g, X1 + 4, 0, Z0 + 2, 14, 9, 10, seed=41)
    hay_bale(g, X1 + 4, 0, Z0 + 13, 14, 9, 10, seed=42)
    hay_bale(g, X1 + 5, 9, Z0 + 7, 13, 9, 10, seed=43)
    hay_bale(g, 102, 0, Z0 - 14, 12, 8, 9, seed=44)
    # a feed bucket and a pitchfork by the grey's stall
    barrel(g, 88, Z0 - 8, 0, 9, 4, ramp="wood", hoop="iron")
    oats = box(g, 85, 9, Z0 - 11, 91, 10, Z0 - 5, "gold", 4)
    P.flat(g, oats & ((X + Z) % 3 == 0), "gold", 5)
    g.prism("z", [(119, 4), (121, 4), (115, 36), (113, 36)], Z0 - 5, Z0 - 3, C("darkwood", 4))
    for k in range(3):
        box(g, 112 + k * 2, 36, Z0 - 5, 113 + k * 2, 41, Z0 - 3, "iron", 5)
    box(g, 112, 35, Z0 - 5, 118, 36, Z0 - 3, "iron", 4)
    # the gold horseshoe sign over the aisle door
    cx, sy, sz = 68, 37, Z0 - 4
    S.bar(g, "z", (cx - 5, sy), (cx - 6, sy + 10), 2.6, sz, sz + 2, "gold", 5)
    S.bar(g, "z", (cx + 5, sy), (cx + 6, sy + 10), 2.6, sz, sz + 2, "gold", 5)
    S.bar(g, "z", (cx - 6, sy + 10), (cx + 6, sy + 10), 2.6, sz, sz + 2, "gold", 5)
    for nx, ny in ((cx - 6, sy + 3), (cx + 5, sy + 3), (cx - 6, sy + 7), (cx + 5, sy + 7)):
        box(g, nx, ny, sz - 1, nx + 1, ny + 1, sz, "iron", 3)
    # the lantern on an iron bracket out of the post beside the aisle
    lx, ly, lz = LAMP
    box(g, lx - 1, ly + 12, lz - 1, lx + 1, ly + 14, Z0 - 2, "iron", 3)
    box(g, lx - 1, ly + 10, lz - 1, lx + 1, ly + 12, lz + 1, "iron", 4)
    lamp_lantern(g, lx, ly, lz, s=6, body=7, roof="red", seed=45)


def build() -> Asset:
    g = Grid(W, H, D)
    block(g)
    loft(g)
    stalls(g)
    cupola(g)
    yard(g)
    lx, ly, lz = LAMP
    return Asset(
        id="fantasy-buildings-stables", pack="fantasy", category="buildings", name="Royal Stables", root=Part("stables", g),
        sockets=[Socket("socket-function", at=(lx, ly + 5.5, lz))],
        pfx=[{"effectId": "rvx-fantasy-lantern-glow", "socket": "socket-function", "trigger": "idle", "size": 22}],
    )
