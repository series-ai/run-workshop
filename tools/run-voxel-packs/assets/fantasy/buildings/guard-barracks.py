"""Guard barracks in the Pirate Nation style.

A long two-storey hall set behind a walled drill yard. The ground storey
is coursed stone with light quoins and small barred windows; a stone
string course carries a close-studded cream plaster upper storey with red
shutters. The steep slate roof runs along the hall with its gables to the
sides (true slopes), a tall stone chimney stack climbs the left gable and
a red pennant flies from the right ridge end (rule F5: no symmetric box).
The oversized function piece is the guard crest: a red heater shield with
a gold crown over two crossed spears on the upper storey (rules F4, F6).
A low crenellated yard wall closes the front, with a gate between two
stone piers that carry iron fire baskets; the right fire burns on `idle`
(PFX torch flame). In the yard stand a straw training dummy, a spear rack
and a barrel (rule K1). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import arch_door, icon, icon_size, merlons, sack, sandstone, shield
from _fbld_civic import idx, plaster, plinth
from _props import flame_tongue
from pnkit import barrel, box, edges, gable_roof, on_face, pennant, shutters, window
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 128, 116, 100
X0, X1, Z0, Z1 = 14, 112, 52, 92  # the hall walls; the front is z = Z0
GROUND, COURSE, WALL_TOP, RIDGE = 38, 41, 70, 100
YZ0 = 8  # the front face of the yard wall
WALL_H = 13  # the yard wall height (the merlons stand on it)
GATE0, GATE1 = 60, 84  # the gate opening between the piers
PIER = 9
PIER_H = 30
CHX0, CHX1, CHZ0, CHZ1 = 5, X0, 66, 78  # the chimney stack on the left gable


def barred_window(g: Grid, face: str, plane, u0, u1, v0, v1, glow=("gold", 5), bars=("iron", 3), frame=("stone", 6)) -> np.ndarray:
    """A small window with iron bars in a 2-proud stone surround and sill."""
    pane = box(g, *on_face(face, plane, u0, u1, v0, v1, 0, 1), *glow)
    U = idx(g)[0] if face in ("-z", "+z") else idx(g)[2]
    P.flat(g, pane & ((U - int(u0)) % 3 == 1), *bars)
    fm = box(g, *on_face(face, plane, u0 - 2, u0, v0, v1 + 2, 0, 2), *frame)
    fm |= box(g, *on_face(face, plane, u1, u1 + 2, v0, v1 + 2, 0, 2), *frame)
    fm |= box(g, *on_face(face, plane, u0, u1, v1, v1 + 2, 0, 2), *frame)
    fm |= box(g, *on_face(face, plane, u0 - 3, u1 + 3, v0 - 2, v0, 0, 3), *frame)
    P.stone(g, fm, frame[0], frame[1], block=(4, 2))
    return pane


def hall(g: Grid) -> None:
    X, Y, Z = idx(g)
    plinth(g, X0 - 2, Z0 - 2, X1 + 2, Z1 + 2, 4, "stone", 4, seed=1)
    ground = box(g, X0, 4, Z0, X1, GROUND, Z1, "sand", 4)
    sandstone(g, ground, 4, block=(8, 5), honey=0.3, seed=2)
    quoin = ground & (((X < X0 + 4) | (X >= X1 - 4)) & ((Z < Z0 + 4) | (Z >= Z1 - 4)))
    P.stone(g, quoin, "stone", 6, block=(4, 5), seed=3)
    P.grime(g, ground, height=4, seed=4)
    course = box(g, X0 - 1, GROUND, Z0 - 1, X1 + 1, COURSE, Z1 + 1, "stone", 6)
    P.stone(g, course, "stone", 6, block=(10, 3), seed=5)
    P.flat(g, edges(course), "stone", 4)
    upper = box(g, X0, COURSE, Z0, X1, WALL_TOP, Z1, "bone", 6)
    plaster(g, upper, "bone", 6, seed=6)
    # close studding: tall studs every 7, a sill rail and a head rail (rule S2)
    U = X + Z
    P.flat(g, upper & ((U % 7) < 2), "red", 2)  # ox-blood painted studs (the guard colour)
    P.flat(g, upper & ((Y < COURSE + 3) | (Y >= WALL_TOP - 3)), "darkwood", 3)
    P.flat(g, upper & (Y >= COURSE + 13) & (Y < COURSE + 15), "red", 2)
    for cx, cz in ((X0 - 1, Z0 - 1), (X1 - 3, Z0 - 1), (X0 - 1, Z1 - 3), (X1 - 3, Z1 - 3)):
        cp = box(g, cx, COURSE, cz, cx + 4, WALL_TOP, cz + 4, "darkwood", 3)
        P.planks(g, cp, "darkwood", 3, width=4, across="x", nails=False, seed=cx + cz)
    roof = gable_roof(g, X0, X1, Z0, Z1, WALL_TOP, RIDGE, ramp="rust", base=5, thick=5, overhang=6, ridge="x", gable="bone", seed=7)
    gab = roof["attic"]
    plaster(g, gab, "bone", 6, seed=8)
    P.flat(g, gab & ((Z % 9) < 2), "darkwood", 4)  # vertical boards on the gables
    P.flat(g, gab & (Y < WALL_TOP + 3), "darkwood", 3)  # the tie beam
    # the front: a stone-arched double door, barred ground windows, upper windows with shutters
    arch_door(g, "-z", Z0, 28, 48, 4, 34, leaf=("wood", 4), frame=("stone", 6), seed=9)
    step = box(g, 24, 0, Z0 - 7, 52, 4, Z0 - 2, "stone", 4)
    P.stone(g, step, "stone", 4, block=(7, 4), frame="top", seed=10)
    canopy = S.bar(g, "x", (36, Z0), (32, Z0 - 8), 3, 24, 52, "rust", 5)
    P.tiles(g, canopy, "rust", 5, row=2, width=4, along="x", seed=11)
    for bx0 in (62, 80, 96):
        barred_window(g, "-z", Z0, bx0, bx0 + 10, 16, 30)
    for u0 in (20, 40):
        window(g, "-z", Z0, u0, u0 + 12, 49, 61, glow=6)
        shutters(g, "-z", Z0, u0, u0 + 12, 49, 61, ramp="red")
    window(g, "-z", Z0, 100, 110, 49, 61, glow=6)
    # the back: barred windows and a small door; upper windows
    for bx0 in (22, 60, 92):
        barred_window(g, "+z", Z1, bx0, bx0 + 10, 16, 30)
    arch_door(g, "+z", Z1, 40, 54, 4, 30, leaf=("wood", 4), frame=("stone", 6), seed=12)
    for u0 in (22, 50, 78, 98):
        window(g, "+z", Z1, u0, u0 + 10, 49, 61, glow=5)
    shutters(g, "+z", Z1, 50, 60, 49, 61, ramp="red")
    # the right gable end: windows, a small crest
    window(g, "+x", X1, Z0 + 8, Z0 + 18, 16, 30, glow=5)
    window(g, "+x", X1, Z1 - 18, Z1 - 8, 49, 61, glow=5)
    shutters(g, "+x", X1, Z1 - 18, Z1 - 8, 49, 61, ramp="red")
    window(g, "+x", X1, (Z0 + Z1) // 2 - 5, (Z0 + Z1) // 2 + 5, WALL_TOP + 8, WALL_TOP + 18, glow=6)
    window(g, "-x", X0, Z1 - 12, Z1 - 4, 16, 30, glow=5)
    pennant(g, X1 + 2, RIDGE + 3, (Z0 + Z1) // 2 - 1, 11, 15, "red")


def banners(g: Grid) -> None:
    """Two long red banners with a gold crown, hung from the eave beside the crest."""
    for bx in (53, 91):
        top, bot = WALL_TOP + 1, COURSE + 5
        box(g, bx - 1, top - 2, Z0 - 2, bx + 9, top, Z0, "darkwood", 3)  # the hanging rod
        pts = [(bx, top - 2), (bx + 8, top - 2), (bx + 8, bot), (bx + 4, bot + 4), (bx, bot)]
        g.prism("z", pts, Z0 - 1, Z0, C("red", 4))
        bm = S.last(g)
        P.mottle(g, bm, "red", 4, cell=3, seed=bx)
        P.outline(g, bm, "gold", 5, normal="z")
        icon(g, "-z", Z0 - 1, bx + 4 - 4, top - 14, "crown", "gold", 6, scale=1, inks={"+": ("red", 6), "-": ("gold", 4)})


def dormers(g: Grid) -> None:
    """Two slate dormers on the front slope (not a pair: different widths)."""
    X, Y, Z = idx(g)
    for dx0, dx1 in ((20, 36), (98, 110)):
        dm = box(g, dx0, WALL_TOP - 2, Z0 - 2, dx1, WALL_TOP + 15, Z0 + 14, "bone", 6)
        plaster(g, dm, "bone", 6, seed=dx0)
        P.flat(g, edges(dm), "darkwood", 3)
        cu = (dx0 + dx1) / 2
        g.prism("z", [(dx0 - 3, WALL_TOP + 14), (dx1 + 3, WALL_TOP + 14), (cu, WALL_TOP + 14 + (dx1 - dx0) / 2 + 3)], Z0 - 4, Z0 + 16, C("rust", 5))
        S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.tiles(gg, mm, "rust", 5, row=3, width=4, frame=fr, seed=dx0))
        P.flat(g, S.last(g) & (Z < Z0 - 2), "darkwood", 3)
        window(g, "-z", Z0 - 2, int(cu) - 4, int(cu) + 4, WALL_TOP + 3, WALL_TOP + 13, glow=6)


def chimney(g: Grid) -> None:
    """A stone stack up the left gable, stepping in once, with a cap."""
    low = box(g, CHX0, 0, CHZ0, CHX1, 60, CHZ1, "stone", 4)
    P.stone(g, low, "stone", 4, block=(6, 4), seed=20)
    g.prism("x", [(60, CHZ0), (60, CHZ1), (66, CHZ1 - 1), (66, CHZ0 + 1)], CHX0, CHX1, C("stone", 4), top=None)
    sh = S.last(g)
    P.stone(g, sh, "stone", 4, block=(6, 4), seed=21)
    top = box(g, CHX0 + 1, 66, CHZ0 + 1, CHX1 - 1, RIDGE + 4, CHZ1 - 1, "stone", 5)
    P.stone(g, top, "stone", 5, block=(5, 3), seed=22)
    cap = box(g, CHX0, RIDGE + 4, CHZ0, CHX1, RIDGE + 7, CHZ1, "stone", 3)
    P.stone(g, cap, "stone", 3, block=(7, 2), seed=23)
    box(g, CHX0 + 3, RIDGE + 6, CHZ0 + 3, CHX1 - 3, RIDGE + 7, CHZ1 - 3, "iron", 2)
    P.flat(g, (low | top) & edges(low | top), "stone", 3)


def crest(g: Grid) -> None:
    """The guard crest: a red heater shield with a big gold crown over two
    crossed spears, on the upper storey (rules F4, F6)."""
    cu, v0 = 76, COURSE + 2
    for a, b in (((cu - 13, v0 - 1), (cu + 13, WALL_TOP - 1)), ((cu + 13, v0 - 1), (cu - 13, WALL_TOP - 1))):
        S.bar(g, "z", a, b, 2, Z0 - 2, Z0, "wood", 4)
        shaft = S.last(g)
        P.planks(g, shaft, "wood", 4, width=2, across="x", nails=False)
        hx, hy = b
        s = 1 if hx > a[0] else -1
        g.prism("z", [(hx - 2.5 * s, hy - 3), (hx + 1.5 * s, hy + 1), (hx + 3 * s, hy + 3.5), (hx + 0.5 * s, hy - 2)], Z0 - 2.5, Z0, C("steel", 6))
    shield(g, "-z", Z0 - 2, cu, v0 + 1, w=22, h=25, field=("red", 4), rim=("gold", 5), charge=None, depth=2)
    iw, ih = icon_size("crown", 2)
    icon(g, "-z", Z0 - 4, cu - iw // 2, v0 + 11, "crown", "gold", 6, scale=2, inks={"+": ("red", 6), "-": ("gold", 4)})


def yard(g: Grid) -> None:
    """The crenellated yard wall, the gate piers with fire baskets, and the
    drill yard with a dummy, a spear rack and a barrel."""
    X, Y, Z = idx(g)
    yard_floor = box(g, X0, 0, YZ0, X1, 1, Z0, "sand", 3)
    P.stone(g, yard_floor, "sand", 3, block=(10, 8), frame="top", seed=30)
    wm = np.zeros(g.shape, dtype=bool)
    wm |= box(g, X0, 0, YZ0, GATE0 - PIER, WALL_H, YZ0 + 5, "stone", 5)
    wm |= box(g, GATE1 + PIER, 0, YZ0, X1, WALL_H, YZ0 + 5, "stone", 5)
    wm |= box(g, X0, 0, YZ0, X0 + 5, WALL_H, Z0, "stone", 5)
    wm |= box(g, X1 - 5, 0, YZ0, X1, WALL_H, Z0, "stone", 5)
    sandstone(g, wm, 4, block=(7, 4), honey=0.3, seed=31)
    coping = (wm & (Y == WALL_H - 1))
    P.flat(g, coping, "stone", 6)
    merlons(g, "x", X0, GATE0 - PIER, YZ0, YZ0 + 5, WALL_H, 5, w=6, gap=4, ramp="stone", base=6, seed=32)
    merlons(g, "x", GATE1 + PIER, X1, YZ0, YZ0 + 5, WALL_H, 5, w=6, gap=4, ramp="stone", base=6, seed=33)
    merlons(g, "z", YZ0 + 8, Z0 - 2, X0, X0 + 5, WALL_H, 5, w=6, gap=4, ramp="stone", base=6, seed=34)
    merlons(g, "z", YZ0 + 8, Z0 - 2, X1 - 5, X1, WALL_H, 5, w=6, gap=4, ramp="stone", base=6, seed=35)
    # the gate piers with iron fire baskets
    for px in (GATE0 - PIER, GATE1):
        pier = box(g, px, 0, YZ0 - 2, px + PIER, PIER_H, YZ0 + 7, "stone", 6)
        P.stone(g, pier, "stone", 6, block=(5, 4), seed=36 + px)
        P.flat(g, edges(pier), "stone", 4)
        capm = box(g, px - 1, PIER_H, YZ0 - 3, px + PIER + 1, PIER_H + 2, YZ0 + 8, "stone", 4)
        P.stone(g, capm, "stone", 4, block=(6, 2), seed=37)
        cx, cz = px + PIER / 2, YZ0 + 2.5
        bowl = S.cone(g, "y", cx, cz, 5.5, PIER_H + 2, PIER_H + 7, "iron", 4, r_top=3.0, tip="lo")
        P.flat(g, bowl & (Y >= PIER_H + 6), "iron", 6)
        coal = box(g, int(cx) - 3, PIER_H + 6, int(cz) - 3, int(cx) + 4, PIER_H + 7, int(cz) + 4, "orange", 6)
        P.flat(g, coal & ((X + Z) % 2 == 0), "gold", 7)
        flame_tongue(g, cx, PIER_H + 7, cz, 3.6, 9, lean=0.8 if px > 70 else -0.8)
    # the open gate leaves, swung in against the wall
    for gx0, gx1 in ((GATE0 - 1, GATE0 + 1), (GATE1 - 1, GATE1 + 1)):
        leaf = box(g, gx0, 1, YZ0 + 7, gx1, 20, YZ0 + 19, "wood", 4)
        P.planks(g, leaf, "wood", 4, width=3, across="z", nails=True, seed=gx0)
        P.flat(g, leaf & ((Y == 5) | (Y == 15)), "iron", 3)
    # the training dummy: a post, a straw body, a cross arm and a pot helm
    dx, dz = 34, 30
    box(g, dx - 1, 1, dz - 1, dx + 2, 34, dz + 2, "darkwood", 4)
    body = S.disc(g, "y", dx + 0.5, dz + 0.5, 5, 12, 27, "gold", 5, n=8)
    P.thatch(g, body, "gold", 5, band=4, seed=38)
    P.flat(g, body & ((Y == 18) | (Y == 24)), "darkwood", 3)
    arm = box(g, dx - 10, 23, dz - 1, dx + 11, 25, dz + 2, "darkwood", 4)
    P.planks(g, arm, "darkwood", 4, width=2, across="y", nails=False)
    helm = S.disc(g, "y", dx + 0.5, dz + 0.5, 4, 29, 35, "steel", 5, n=8)
    P.flat(g, helm & (Y == 32), "iron", 2)
    S.disc(g, "y", dx + 0.5, dz + 0.5, 1.5, 35, 37, "red", 5)
    shield(g, "-z", dz - 4, dx + 0.5, 12, w=10, h=12, field=("blue", 4), rim=("gold", 5), charge=None, depth=2)
    # the spear rack against the right yard wall
    rx = X1 - 12
    rack = box(g, rx, 1, 18, rx + 3, 24, 21, "darkwood", 3) | box(g, rx, 1, 40, rx + 3, 24, 43, "darkwood", 3)
    rack |= box(g, rx - 1, 18, 18, rx + 4, 20, 43, "darkwood", 3)
    rack |= box(g, rx - 1, 4, 18, rx + 4, 6, 43, "darkwood", 3)
    P.planks(g, rack, "darkwood", 3, width=2, across="y", nails=False)
    for k, sz in enumerate(range(23, 40, 4)):
        tilt = 1 if k % 2 else 0
        S.bar(g, "z", (rx + 1.5, 2), (rx + 1.5 + tilt, 34), 2, sz, sz + 2, "wood", 5)
        g.prism("z", [(rx + 0.5 + tilt, 34), (rx + 2.5 + tilt, 34), (rx + 1.5 + tilt, 40)], sz, sz + 2, C("steel", 6))
    barrel(g, X0 + 13, Z0 - 10, 0, 19, 6, ramp="wood", hoop="iron")
    sack(g, X0 + 13, Z0 - 21, 1, w=8, h=9, ramp="bone", base=5, tie=("darkwood", 3))


def build() -> Asset:
    g = Grid(W, H, D)
    hall(g)
    banners(g)
    dormers(g)
    chimney(g)
    crest(g)
    yard(g)
    fire = (GATE1 + PIER / 2, PIER_H + 10, YZ0 + 2.5)
    return Asset(
        id="fantasy-buildings-guard-barracks", pack="fantasy", category="buildings", name="Guard Barracks", root=Part("guard-barracks", g),
        sockets=[Socket("socket-function", at=fire)],
        pfx=[{"effectId": "rvx-fantasy-torch-flame", "socket": "socket-function", "trigger": "idle", "size": 22}],
    )
