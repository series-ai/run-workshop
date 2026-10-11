"""Haunted manor, in the Pirate Nation haunted style.

After the PN haunted town hall: a grey stone house under a steep purple
tiled roof (true slopes, worn dark tiles), a taller front cross gable with
a glowing magenta rose window, a giant skull crest over a wide pointed
door, pinnacles and horned crosses on the gables, and a square corner
turret with a four-gabled spire. Its function prop is oversized: a giant
bat weathervane on the turret that swings round on `idle`. A toxic-green
skull banner, a leaning chimney, tombstones and pumpkins finish it. All
masonry, tiles and glyphs are painted.
"""
import numpy as np

import paint as P
from _kit import world
from _pn import banner, blotch, coords, cross, last, lancet, pumpkin, quad, rose, skull, spire_cap, tombstone
from pnkit import box, gable_roof
from voxgrid import C, Asset, Clip, Grid, Part, Socket, bounds_pivot

W, H, D = 128, 140, 104
X0, X1, Z0, Z1 = 22, 104, 46, 88  # main block walls; the front is z = Z0
WX0, WX1, WZ0 = 38, 74, 24  # front cross wing (its back runs into the main block)
DX0, DX1, DZ0 = 80, 100, 40  # dormer gable on the right of the wing
TX0, TX1, TZ0, TZ1 = 8, 28, 30, 50  # corner turret (front left)
WALL, RIDGE, WING_RIDGE, DORMER_RIDGE = 48, 88, 104, 80
TOWER_TOP = 76
SPIRE = 36


def walls(g: Grid, x0, y0, z0, x1, y1, z1, seed: int) -> np.ndarray:
    m = box(g, x0, y0, z0, x1, y1, z1, "gray", 4)
    P.stone(g, m, "gray", 4, block=(8, 4), cracks=0.08, seed=seed)
    return m


def pilasters(g: Grid, x0, x1, z0, z1, y0, y1, size: int = 5, seed: int = 0) -> np.ndarray:
    """Thick light stone corner piers standing 1 voxel proud (rule F3)."""
    m = np.zeros(g.shape, dtype=bool)
    for cx, cz in ((x0 - 1, z0 - 1), (x1 + 1 - size, z0 - 1), (x0 - 1, z1 + 1 - size), (x1 + 1 - size, z1 + 1 - size)):
        m |= box(g, cx, y0, cz, cx + size, y1, cz + size, "gray", 6)
    P.stone(g, m, "gray", 6, block=(5, 6), seed=seed)
    return m


def roof_paint(g: Grid, roof: dict, along: str, seed: int) -> None:
    """Worn purple tiles with dark patches, stone gable walls, and chunky
    light stone barge boards and eave lips framing the slabs (rule S4)."""
    slabs = roof["slabs"]
    blotch(g, slabs, "purple", 1, cell=3, chance=0.06, seed=seed)
    P.stone(g, roof["attic"], "gray", 4, block=(7, 4), seed=seed + 1)
    X, Y, Z = coords(g)
    B = X if along == "x" else Z
    b = B[slabs]
    ends = slabs & ((B <= b.min() + 2) | (B >= b.max() - 2))
    lip = slabs & (Y <= Y[slabs].min() + 1)
    P.stone(g, ends | lip, "gray", 5, block=(6, 3), seed=seed + 2)


def manor() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # plinth and walls: main block, front cross wing, dormer bay
    plinth = box(g, X0 - 3, 0, Z0 - 3, X1 + 3, 5, Z1 + 3, "stone", 3)
    plinth |= box(g, WX0 - 3, 0, WZ0 - 3, WX1 + 3, 5, Z0, "stone", 3)
    plinth |= box(g, DX0 - 3, 0, DZ0 - 3, DX1 + 3, 5, Z0, "stone", 3)
    P.stone(g, plinth, "stone", 3, block=(9, 5), seed=1)
    walls(g, X0, 5, Z0, X1, WALL, Z1, seed=2)
    walls(g, WX0, 5, WZ0, WX1, WALL, Z0 + 4, seed=3)
    walls(g, DX0, 5, DZ0, DX1, WALL, Z0 + 4, seed=4)
    band = box(g, X0 - 1, WALL - 3, Z0 - 1, X1 + 1, WALL, Z1 + 1, "gray", 6)
    band |= box(g, WX0 - 1, WALL - 3, WZ0 - 1, WX1 + 1, WALL, Z0, "gray", 6)
    band |= box(g, DX0 - 1, WALL - 3, DZ0 - 1, DX1 + 1, WALL, Z0, "gray", 6)
    P.stone(g, band, "gray", 6, block=(10, 3), seed=5)
    pilasters(g, X0, X1, Z0, Z1, 5, WALL, seed=6)
    pilasters(g, WX0, WX1, WZ0, Z0 + 6, 5, WALL, seed=7)
    pilasters(g, DX0, DX1, DZ0, Z0 + 6, 5, WALL, size=4, seed=8)
    # tall steep roofs (F4): main ridge along x, a taller cross gable and a dormer to the front
    main = gable_roof(g, X0, X1, Z0, Z1, WALL, RIDGE, ramp="purple", thick=5, overhang=6, trim="gray", gable="gray", ridge="x", seed=9)
    roof_paint(g, main, "x", 10)
    wing = gable_roof(g, WX0, WX1, WZ0, Z0 + 12, WALL, WING_RIDGE, ramp="purple", thick=5, overhang=5, trim="gray", gable="gray", ridge="z", seed=11)
    roof_paint(g, wing, "z", 12)
    dorm = gable_roof(g, DX0, DX1, DZ0, Z0 + 14, WALL, DORMER_RIDGE, ramp="purple", thick=4, overhang=4, trim="gray", gable="gray", ridge="z", seed=13)
    roof_paint(g, dorm, "z", 14)
    # pinnacles at the wing corners, rising through the eaves
    for px in (WX0 - 3, WX1 - 2):
        pm = box(g, px, 5, WZ0 - 3, px + 5, WALL + 22, WZ0 + 2, "gray", 6)
        P.stone(g, pm, "gray", 6, block=(5, 6), seed=15)
        spire_cap(g, px + 2.5, WZ0 - 0.5, WALL + 22, 2.5, 9, ramp="gray", base=5, overhang=0.5)
    # a giant rose window in the front gable and a giant skull over the door
    cu = (WX0 + WX1) / 2
    rose(g, "-z", WZ0, cu, 73, 12, glass="magenta", shade=6)
    skull(g, "-z", WZ0, cu, 35, s=14, depth=4)
    # wide, short pointed door (F4) with magenta light in the crack
    lancet(g, "-z", WZ0, cu - 8, cu + 8, 5, 31, glass="purple", shade=3, sill=False, mullion=False, seed=16)
    leaf = (Z < WZ0) & (Z >= WZ0 - 1) & (np.abs(X + 0.5 - cu) < 7) & (Y >= 5) & (Y < 31) & (g.a > 0)
    P.planks(g, leaf, "purple", 3, width=4, across="x", length=(40, 41), nails=True)
    P.flat(g, leaf & (np.abs(X + 0.5 - cu) < 1), "magenta", 6)
    steps = box(g, cu - 12, 0, WZ0 - 10, cu + 12, 3, WZ0 - 3, "stone", 4) | box(g, cu - 10, 3, WZ0 - 7, cu + 10, 5, WZ0 - 3, "stone", 4)
    P.stone(g, steps, "stone", 4, block=(6, 3), seed=17)
    # tall lancet windows; a few glow toxic green or magenta (C3)
    lancet(g, "-z", WZ0, WX0 + 3, WX0 + 10, 12, 30, seed=18)
    lancet(g, "-z", WZ0, WX1 - 10, WX1 - 3, 12, 30, glass="toxic", shade=5, seed=19)
    lancet(g, "-z", DZ0, DX0 + 5, DX1 - 5, 14, 40, glass="magenta", shade=4, seed=20)
    lancet(g, "-z", DZ0, DX0 + 6, DX1 - 6, 56, 70, seed=21)
    lancet(g, "-z", Z0, X0 + 7, X0 + 15, 14, 38, seed=22)
    for w0, lit in ((Z0 + 6, "toxic"), (Z0 + 24, None)):
        lancet(g, "+x", X1, w0, w0 + 9, 14, 40, glass=lit or "purple", shade=5 if lit else 2, seed=23)
        lancet(g, "-x", X0, w0 + 4, w0 + 13, 14, 40, seed=24)
    rose(g, "+x", X1, (Z0 + Z1) / 2, 64, 7, glass="toxic", shade=5)
    lancet(g, "+x", WX1, WZ0 + 6, WZ0 + 14, 14, 38, seed=25)
    # corner turret: a square stone tower with a steep four-gabled spire
    walls(g, TX0, 5, TZ0, TX1, TOWER_TOP, TZ1, seed=26)
    tp = box(g, TX0 - 2, 0, TZ0 - 2, TX1 + 2, 5, TZ1 + 2, "stone", 3)
    P.stone(g, tp, "stone", 3, block=(9, 5), seed=27)
    pilasters(g, TX0, TX1, TZ0, TZ1, 5, TOWER_TOP, size=4, seed=28)
    tb = box(g, TX0 - 2, TOWER_TOP - 4, TZ0 - 2, TX1 + 2, TOWER_TOP, TZ1 + 2, "gray", 6)
    P.stone(g, tb, "gray", 6, block=(6, 4), seed=29)
    tcx, tcz = (TX0 + TX1) / 2, (TZ0 + TZ1) / 2
    cap = spire_cap(g, tcx, tcz, TOWER_TOP, (TX1 - TX0) / 2, SPIRE, ramp="purple", base=4, overhang=2)
    P.tiles(g, cap, "purple", 4, row=4, width=5, along="x", seed=30)
    blotch(g, cap, "purple", 2, chance=0.06, seed=31)
    P.flat(g, cap & ((np.abs(X + 0.5 - tcx) < 1.5) | (np.abs(Z + 0.5 - tcz) < 1.5)), "gray", 5)  # hip ridges
    lancet(g, "-z", TZ0, tcx - 5, tcx + 5, 50, 72, glass="magenta", shade=5, seed=32)
    lancet(g, "-x", TX0, tcz - 5, tcz + 5, 50, 72, seed=33)
    lancet(g, "-z", TZ0, tcx - 4, tcx + 4, 14, 34, seed=34)
    # crosses on the gable apexes, the banner on the main ridge
    cross(g, cu, WING_RIDGE + 6, WZ0 - 3, h=16, arm=5)
    cross(g, (DX0 + DX1) / 2, DORMER_RIDGE + 5, DZ0 - 2, h=11, arm=3, horns=False)
    cross(g, X1 + 4, RIDGE + 6, (Z0 + Z1) / 2, h=13, arm=4)
    banner(g, X0 + 14, RIDGE - 4, (Z0 + Z1) // 2 - 1, 36, 24, 15, ramp="toxic", base=3)
    # graveyard props at the base (K1): tombstones and pumpkins
    tombstone(g, X1 - 2, 26, w=10, h=17, lean=-8, seed=35)
    tombstone(g, X1 + 8, 34, w=9, h=13, lean=6, seed=36)
    tombstone(g, X1 + 6, 18, w=8, h=11, lean=-4, glyph="", seed=37)
    pumpkin(g, cu - 18, 0, WZ0 - 10, w=12, h=9, seed=38)
    pumpkin(g, cu + 17, 0, WZ0 - 11, w=14, h=11, seed=39)
    pumpkin(g, cu + 27, 0, WZ0 - 4, w=10, h=8, seed=40)
    P.grime(g, (g.a > 0) & (Y < 12) & ~g.solid_mask(), height=4, seed=41)
    return g


def chimney() -> Grid:
    g = Grid(14, 40, 14)
    m = box(g, 1, 0, 1, 13, 34, 13, "stone", 4)
    P.stone(g, m, "stone", 4, block=(5, 3), seed=40)
    cap = box(g, 0, 34, 0, 14, 40, 14, "gray", 6)
    P.stone(g, cap, "gray", 6, block=(7, 3), seed=41)
    g.box(4, 37, 4, 10, 40, 10, C("toxic", 5))  # toxic glow in the flue
    return g


def weathervane() -> Grid:
    """The giant bat vane (the manor's oversized function prop, F4/F6): a
    pole with N/S arms and a big bat silhouette with glowing toxic eyes,
    its scalloped wings cut with true slopes."""
    g = Grid(44, 26, 6)
    cx = 22
    box(g, cx - 1, 0, 2, cx + 1, 26, 4, "purple", 2)
    box(g, cx - 7, 4, 2, cx + 7, 6, 4, "purple", 3)
    m = box(g, cx - 4, 10, 1, cx + 4, 20, 5, "purple", 2)  # body
    for s in (-1, 1):
        pts = [(cx + s * 3, 19), (cx + s * 10, 23), (cx + s * 21, 21), (cx + s * 19, 12), (cx + s * 15.5, 14), (cx + s * 12.5, 9), (cx + s * 9, 13), (cx + s * 4, 10)]
        g.prism("z", pts, 2, 4, C("purple", 3))
        m |= last(g)
        g.prism("z", quad((cx + s * 2.2, 19), (cx + s * 3.6, 24.5), 1.2, 0.6), 1.5, 4.5, C("purple", 2))  # ear
        m |= last(g)
    P.outline(g, m, "purple", 1, normal="z")
    X, Y, Z = coords(g)
    P.flat(g, m & (Y > 12) & (Y < 21) & (np.abs(X + 0.5 - cx) > 5) & ((X + Y) % 5 == 0), "purple", 2)  # wing bones
    for ex in (cx - 3, cx + 1):
        for z in (1, 4):
            g.box(ex, 15, z, ex + 2, 17, z + 1, C("toxic", 7))
    return g


def build() -> Asset:
    g = manor()
    pivot = bounds_pivot(g)
    cx, cy, cz = X1 - 14, WALL + 20, Z1 - 12  # chimney foot on the back right slope
    root = Part("manor", g, pivot=pivot)
    root.add(Part("chimney", chimney(), pivot=(7.0, 0.0, 7.0), at=(cx - pivot[0], cy, cz - pivot[2]), rot=(0.0, 0.0, 7.0)))
    tcx, tcz = (TX0 + TX1) / 2, (TZ0 + TZ1) / 2
    vane_y = TOWER_TOP + SPIRE - 3
    root.add(Part("weathervane", weathervane(), pivot=(22.0, 0.0, 3.0), at=(tcx - pivot[0], vane_y, tcz - pivot[2])))
    spin = {"weathervane": {"rot": [(0, (0, 0, 0)), (1.5, (0, 60, 0)), (2.0, (0, 40, 0)), (3.5, (0, 180, 0)), (4.5, (0, 300, 0)), (5.0, (0, 360, 0))]}}
    # world() centres the whole rest pose (vane included) on x/z, base on y = 0
    return world(
        "haunted-manor", "buildings", "Haunted Manor", root,
        clips=[Clip("idle", spin)],
        sockets=[Socket("socket-chimney", at=(cx - pivot[0], cy + 40, cz - pivot[2]), parent="chimney")],
        pfx=[{"effectId": "rvx-monster-ghost-smoke", "socket": "socket-chimney", "trigger": "idle", "size": 38}],
    )
