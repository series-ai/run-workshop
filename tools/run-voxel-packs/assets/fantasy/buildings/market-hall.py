"""Market hall in the Pirate Nation style.

A long civic hall raised on an open arcade: the ground floor is a paved
stone platform under thick dark timber posts with knee braces (true
slopes) and four sandstone corner piers. Market stalls stand inside, in
full view: a counter heaped with apples, cabbages, carrots and pears, a
trestle of cloth bolts, barrels and sacks. Striped cloth valances hang
between the posts. Above, a jettied, half-timbered cream plaster hall
carries a steep red hip roof with a gabled clock dormer to the right and
an open bell cupola to the left (rule F5: no symmetric box). The bell in
the cupola is the function prop and tolls on `idle` (PFX). A giant gold
balance-scale sign hangs from a bracket at the front left corner (rules
F4, F6). A stone stair climbs the right side to the hall door. Crates of
goods, a barrel and sacks stand round the base (rule K1). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import bell, half_timber, round_window, sack
from _fbld_civic import idx, plaster, plinth
from pnkit import barrel, beam, box, crate, door, edges, pennant, posts, shutters, window
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 140, 128, 84
X0, X1, Z0, Z1 = 16, 120, 22, 66  # the arcade post outline; the front is z = Z0
ARC, FLOOR, WALL_TOP, ROOF_H = 41, 44, 72, 27  # arcade top, hall floor, wall top, roof rise
J = 3
UX0, UX1, UZ0, UZ1 = X0 - J, X1 + J, Z0 - J, Z1 + J  # the jettied hall walls
POSTS_X = (41, 66, 90)  # the inner timber posts (x0); the corners are stone piers
CUP_X, CUP_Z = 52, 44  # the bell cupola centre
CUP_Y0 = WALL_TOP + 19  # the cupola base sinks into the roof slope
CUP_STAGE, CUP_CAP = CUP_Y0 + 8, CUP_Y0 + 17
BELL_TOP = CUP_CAP - 1
WV0, WV1 = FLOOR + 7, FLOOR + 19  # the hall window sills and heads


def knee_brace(g: Grid, axis: str, foot, head, lo, hi, thick: float = 3.0, ramp: str = "darkwood", base: int = 4) -> np.ndarray:
    """A diagonal timber brace (a true slope, rule F2) with a lit top edge.
    `foot` and `head` are points in the plane across `axis`."""
    m = S.bar(g, axis, foot, head, thick, lo, hi, ramp, base)
    P.planks(g, m, ramp, base, width=3, across="x" if axis == "z" else "z", nails=False)
    P.outline(g, m, ramp, base - 2, normal=axis)
    return m


def goods_crate(g: Grid, x0, y0, z0, w: int, d: int, h: int, fruit: str = "red", fshade: int = 5, seed: int = 0) -> np.ndarray:
    """An open market crate heaped with round goods: a planked box with dark
    framed edges and a domed top of fruit painted as round dots."""
    m = box(g, x0, y0, z0, x0 + w, y0 + h, z0 + d, "wood", 5)
    P.planks(g, m, "wood", 5, width=3, across="y", nails=True, seed=seed)
    P.flat(g, edges(m), "darkwood", 3)
    cx, cz = x0 + w / 2, z0 + d / 2
    g.prism("y", [(x0 + 1, z0 + 1), (x0 + w - 1, z0 + 1), (x0 + w - 1, z0 + d - 1), (x0 + 1, z0 + d - 1)], y0 + h, y0 + h + 3,
            C(fruit, fshade), top=[(cx - w * 0.2, cz - d * 0.2), (cx + w * 0.2, cz - d * 0.2), (cx + w * 0.2, cz + d * 0.2), (cx - w * 0.2, cz + d * 0.2)])
    heap = S.last(g)
    X, _Y, Z = idx(g)
    P.flat(g, heap & (((X // 2) + (Z // 2)) % 2 == 0), fruit, min(7, fshade + 1))
    P.flat(g, heap & (X % 4 == 1) & (Z % 4 == 1), fruit, max(1, fshade - 2))
    return m | heap


def arcade(g: Grid) -> None:
    """The paved platform, the stone corner piers, the timber posts with
    knee braces, the floor beam and the striped valances."""
    X, Y, Z = idx(g)
    floor = plinth(g, X0 - 6, Z0 - 6, X1 + 6, Z1 + 6, 3, "stone", 5, seed=1)
    P.stone(g, floor & (Y == 2), "stone", 5, block=(8, 6), frame="top", seed=2)  # paving
    # four sandstone corner piers with lighter quoins
    for px, pz in ((X0 - 1, Z0 - 1), (X1 - 6, Z0 - 1), (X0 - 1, Z1 - 6), (X1 - 6, Z1 - 6)):
        pier = box(g, px, 3, pz, px + 7, ARC, pz + 7, "sand", 4)
        P.stone(g, pier, "sand", 4, block=(7, 5), seed=px + pz)
        P.flat(g, pier & (Y >= ARC - 3), "sand", 6)  # the capital
        P.flat(g, edges(pier), "sand", 3)
    # inner timber posts on stone pads, front, back and mid-sides
    spots = [(x, Z0) for x in POSTS_X] + [(x, Z1 - 5) for x in POSTS_X] + [(X0, (Z0 + Z1) // 2 - 2), (X1 - 5, (Z0 + Z1) // 2 - 2)]
    pm = np.zeros(g.shape, dtype=bool)
    for px, pz in spots:
        pad = box(g, px - 1, 3, pz - 1, px + 6, 7, pz + 6, "stone", 6)
        P.stone(g, pad, "stone", 6, block=(4, 2), seed=px)
        pm |= box(g, px, 7, pz, px + 5, ARC, pz + 5, "darkwood", 4)
    P.planks(g, pm, "darkwood", 4, width=5, across="x", nails=False, seed=3)
    P.flat(g, edges(pm), "darkwood", 2)
    # knee braces on the front and back rows (true slopes), both sides of each post
    for px in POSTS_X:
        for z0 in (Z0 + 1, Z1 - 4):
            knee_brace(g, "z", (px, ARC - 10), (px - 8, ARC), z0, z0 + 3)
            knee_brace(g, "z", (px + 5, ARC - 10), (px + 13, ARC), z0, z0 + 3)
    for z0 in (Z0 + 1, Z1 - 4):
        knee_brace(g, "z", (X0 + 6, ARC - 10), (X0 + 14, ARC), z0, z0 + 3)
        knee_brace(g, "z", (X1 - 6, ARC - 10), (X1 - 14, ARC), z0, z0 + 3)
    # the floor beam and the hall floor (the arcade ceiling), jettied out
    beam(g, UX0, ARC, UZ0, UX1, FLOOR, UZ1, base=4, seed=4)
    # striped valances between the posts under the jetty
    bays = [X0 + 6] + [x for p in POSTS_X for x in (p, p + 5)] + [X1 - 6]
    ramps = ("red", "blue", "gold", "leaf")
    for k in range(4):
        a, b = bays[2 * k], bays[2 * k + 1]
        val = box(g, a, ARC - 5, UZ0 + 1, b, ARC, UZ0 + 2, ramps[k], 4)
        P.flat(g, val & (((X - a) // 3) % 2 == 1), "bone", 6)
        g.carve(val & (Y == ARC - 5) & ((X - a) % 6 >= 4))  # the scalloped hem
        back = box(g, a, ARC - 5, UZ1 - 2, b, ARC, UZ1 - 1, ramps[(k + 2) % 4], 4)
        P.flat(g, back & (((X - a) // 3) % 2 == 1), "bone", 6)
        g.carve(back & (Y == ARC - 5) & ((X - a) % 6 >= 4))


def stalls(g: Grid) -> None:
    """The goods on show inside the open arcade."""
    X, Y, Z = idx(g)
    # the produce counter in the left bays
    top = box(g, X0 + 9, 13, Z0 + 9, X0 + 47, 15, Z0 + 18, "wood", 6)
    P.planks(g, top, "wood", 6, width=3, across="y", nails=True, seed=10)
    P.flat(g, edges(top), "darkwood", 3)
    cloth = box(g, X0 + 10, 3, Z0 + 9, X0 + 46, 13, Z0 + 10, "red", 4)
    P.flat(g, cloth & ((X // 3) % 2 == 1), "bone", 6)
    P.flat(g, cloth & (Y < 4), "darkwood", 3)
    box(g, X0 + 10, 3, Z0 + 16, X0 + 13, 13, Z0 + 18, "darkwood", 3)
    box(g, X0 + 43, 3, Z0 + 16, X0 + 46, 13, Z0 + 18, "darkwood", 3)
    for k, (fruit, sh) in enumerate((("red", 5), ("leaf", 5), ("orange", 5), ("lime", 4))):
        goods_crate(g, X0 + 11 + k * 9, 15, Z0 + 10, 8, 7, 4, fruit, sh, seed=11 + k)
    # the cloth trestle in the right bays: bolts of cloth lying across it
    tr = box(g, X0 + 58, 12, Z0 + 12, X0 + 92, 14, Z0 + 22, "wood", 5)
    P.planks(g, tr, "wood", 5, width=3, across="y", nails=False, seed=15)
    P.flat(g, edges(tr), "darkwood", 3)
    for lx in (X0 + 60, X0 + 88):
        g.prism("z", [(lx - 2, 3), (lx + 3, 3), (lx + 1, 12), (lx, 12)], Z0 + 14, Z0 + 20, C("darkwood", 3))
    for k, col in enumerate(("blue", "magenta", "gold", "sky", "red", "leaf")):
        bx = X0 + 61 + k * 5
        bolt = S.disc(g, "z", bx + 2, 16.5, 2.5, Z0 + 11, Z0 + 23, col, 4, n=6)
        P.flat(g, bolt & ((Z == Z0 + 11) | (Z == Z0 + 22)), col, 6)
        P.flat(g, bolt & (Y >= 18), col, 5)
    # barrels and sacks at the back of the arcade
    barrel(g, X0 + 54, Z1 - 12, 3, 19, 6, ramp="wood", hoop="iron")
    barrel(g, X0 + 67, Z1 - 11, 3, 16, 5, ramp="wood", hoop="iron")
    P.flat(g, box(g, X0 + 63, 19, Z1 - 15, X0 + 72, 20, Z1 - 7, "red", 5), "red", 5)  # apples heaped in it
    sack(g, X0 + 26, Z1 - 12, 3, w=9, h=11, ramp="bone", base=6, tie=("darkwood", 3))
    sack(g, X0 + 35, Z1 - 10, 3, w=8, h=10, ramp="bone", base=5, tie=("darkwood", 3))
    crate(g, X0 + 80, 3, Z1 - 18, 12, seed=16)
    crate(g, X0 + 82, 15, Z1 - 16, 8, seed=17)


def hall(g: Grid) -> None:
    """The jettied half-timbered hall, the hip roof, the clock dormer, windows."""
    X, Y, Z = idx(g)
    walls = box(g, UX0, FLOOR, UZ0, UX1, WALL_TOP, UZ1, "sand", 6)
    plaster(g, walls, "sand", 6, seed=20)
    half_timber(g, walls, UX0, FLOOR, WALL_TOP, bay=16, t=3, ramp="darkwood", shade=4)
    posts(g, UX0, UX1, UZ0, UZ1, FLOOR, WALL_TOP, size=4, out=1, base=4, seed=21)
    roof = S.hip_roof(g, UX0 - 6, UZ0 - 6, UX1 + 6, UZ1 + 6, WALL_TOP, ROOF_H, ramp="red", base=4, ridge="x", seed=22)
    P.flat(g, roof & (Y < WALL_TOP + 2), "red", 2)  # the dark eave lip
    # front windows (left pair, right pair) and the painted sign board between
    for u0 in (UX0 + 8, UX0 + 26, UX1 - 46, UX1 - 22):
        window(g, "-z", UZ0, u0, u0 + 12, WV0, WV1, glow=6)
    shutters(g, "-z", UZ0, UX1 - 22, UX1 - 10, WV0, WV1, ramp="blue")
    shutters(g, "-z", UZ0, UX0 + 8, UX0 + 20, WV0, WV1, ramp="blue")
    tw, _th = pnglyph.text_size("MARKET")
    sb = box(g, 69 - tw // 2 - 4, FLOOR + 5, UZ0 - 2, 69 + tw // 2 + 5, FLOOR + 21, UZ0, "wood", 5)
    P.planks(g, sb, "wood", 5, width=3, across="y", nails=False, seed=23)
    P.outline(g, sb, "darkwood", 3, normal="z")
    pnglyph.text(g, "-z", UZ0 - 2, 69 - tw // 2, FLOOR + 10, "MARKET", "gold", 6)
    # side and back windows; the hall door on the right side, at the stair top
    for w0 in (UZ0 + 8, UZ1 - 20):
        window(g, "-x", UX0, w0, w0 + 12, WV0, WV1, glow=5)
    window(g, "+x", UX1, UZ0 + 8, UZ0 + 20, WV0, WV1, glow=5)
    door(g, "+x", UX1, UZ1 - 22, UZ1 - 6, FLOOR, FLOOR + 26, seed=24)
    for u0 in (UX0 + 10, UX0 + 40, UX1 - 52, UX1 - 22):
        window(g, "+z", UZ1, u0, u0 + 12, WV0, WV1, glow=5)
    shutters(g, "+z", UZ1, UX0 + 40, UX0 + 52, WV0, WV1, ramp="red")
    # the gabled clock dormer on the front slope, right of centre
    dx0, dx1 = 88, 108
    dm = box(g, dx0, WALL_TOP - 3, UZ0, dx1, WALL_TOP + 12, UZ0 + 14, "sand", 6)
    plaster(g, dm, "sand", 6, seed=25)
    P.flat(g, edges(dm) & (Z < UZ0 + 1), "darkwood", 4)
    g.prism("z", [(dx0 - 3, WALL_TOP + 11), (dx1 + 3, WALL_TOP + 11), ((dx0 + dx1) / 2, WALL_TOP + 24)], UZ0 - 3, UZ0 + 16, C("red", 4))
    gab = S.last(g)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.tiles(gg, mm, "red", 4, row=3, width=4, frame=fr, seed=26))
    P.flat(g, gab & (Z < UZ0 - 1), "darkwood", 3)  # barge boards
    cu = (dx0 + dx1) // 2
    face = round_window(g, "-z", UZ0, cu, WALL_TOP + 4, 6, glass=("bone", 7), frame=("gold", 4), spokes=False)
    P.flat(g, face & (np.abs(X + 0.5 - cu) < 0.6) & (Y + 0.5 > WALL_TOP + 4) & (Y < WALL_TOP + 9), "darkwood", 2)  # minute hand
    P.flat(g, face & (np.abs(Y + 0.5 - (WALL_TOP + 4)) < 0.6) & (X + 0.5 > cu) & (X < cu + 4), "darkwood", 2)  # hour hand
    pennant(g, cu - 1, WALL_TOP + 22, UZ0 - 1, 10, 12, "red")


def cupola(g: Grid) -> None:
    """The open bell cupola on the ridge: a sky-blue louvred base, four
    posts, the gold bell (the function prop) and a steep tiled cap."""
    X, Y, Z = idx(g)
    c0x, c1x, c0z, c1z = CUP_X - 8, CUP_X + 8, CUP_Z - 8, CUP_Z + 8
    base = box(g, c0x, CUP_Y0, c0z, c1x, CUP_STAGE, c1z, "sky", 4)
    P.planks(g, base, "sky", 4, width=2, across="y", nails=False, seed=30)
    P.flat(g, edges(base), "darkwood", 3)
    rim = box(g, c0x - 1, CUP_STAGE - 1, c0z - 1, c1x + 1, CUP_STAGE + 1, c1z + 1, "darkwood", 3)
    P.planks(g, rim, "darkwood", 3, width=2, across="y", nails=False, seed=31)
    pm = np.zeros(g.shape, dtype=bool)
    for px, pz in ((c0x, c0z), (c1x - 3, c0z), (c0x, c1z - 3), (c1x - 3, c1z - 3)):
        pm |= box(g, px, CUP_STAGE + 1, pz, px + 3, CUP_CAP, pz + 3, "darkwood", 4)
    P.planks(g, pm, "darkwood", 4, width=3, across="x", nails=False, seed=32)
    box(g, c0x, CUP_CAP - 1, CUP_Z - 1, c1x, CUP_CAP, CUP_Z + 1, "darkwood", 3)  # the headstock
    bell(g, CUP_X, CUP_Z, BELL_TOP - 1, h=8, r=4.2)
    cap = S.pyramid(g, c0x - 3, c0z - 3, c1x + 3, c1z + 3, CUP_CAP, 12, "red", 4, apex=(CUP_X + 1, CUP_Z), tiles=True, seed=33)
    P.flat(g, cap & (Y < CUP_CAP + 1), "red", 2)
    P.flat(g, cap & S.seams(g, [g.solids[-1]], 0.9) & (Y >= CUP_CAP + 1), "gold", 4)
    S.disc(g, "y", CUP_X + 1, CUP_Z, 1.8, CUP_CAP + 11, CUP_CAP + 14, "gold", 5)


def scales_sign(g: Grid) -> None:
    """The giant gold balance scales hanging from a bracket at the front
    left corner (rules F4, F6): a beam with a pointer and two pans on chains."""
    X, Y, Z = idx(g)
    bx, sz = X0 + 2, 7  # the hanging point
    br = box(g, bx - 1, 65, sz - 2, bx + 2, 68, UZ0, "darkwood", 3)
    P.planks(g, br, "darkwood", 3, width=3, across="y", nails=True, seed=40)
    g.prism("x", [(65, UZ0 - 9), (65, UZ0), (53, UZ0)], bx - 0.5, bx + 1.5, C("darkwood", 3))  # brace
    box(g, bx, 61, sz - 1, bx + 1, 65, sz + 1, "iron", 3)  # the chain
    post = box(g, bx - 1, 54, sz - 1, bx + 2, 62, sz + 1, "gold", 4)
    g.prism("z", [(bx - 1, 62), (bx + 2, 62), (bx + 0.5, 66)], sz - 1, sz + 1, C("gold", 5))  # the pointer
    arm = box(g, bx - 11, 57, sz - 1, bx + 12, 59, sz + 1, "gold", 5)
    P.flat(g, edges(arm), "gold", 3)
    P.flat(g, post & (Y == 54), "gold", 3)
    for px in (bx - 10, bx + 11):
        for dz in (-1, 0):
            box(g, px - 3, 49, sz + dz, px - 2, 57, sz + dz + 1, "iron", 3)
            box(g, px + 2, 49, sz + dz, px + 3, 57, sz + dz + 1, "iron", 3)
        pan = S.cone(g, "y", px + 0.5, sz, 5, 46, 50, "gold", 5, r_top=3.0, tip="lo")
        P.flat(g, pan & (Y >= 49), "gold", 6)
        P.flat(g, pan & (Y < 47), "gold", 3)


def stair(g: Grid) -> None:
    """A stone stair up the right side to the hall door, with a timber rail."""
    X, Y, Z = idx(g)
    sx0, sx1 = UX1 + 1, UX1 + 11
    lz0 = UZ1 - 24  # the landing runs from here to the back wall
    S.bar(g, "x", (4, 6), (FLOOR - 4, lz0 + 1), 7, sx0, sx1, "stone", 5)
    flight = S.last(g)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(5, 3), frame=fr, seed=50))
    P.flat(g, flight & ((Z - 2) % 4 == 0), "stone", 3)  # the step nosings
    foot = box(g, sx0, 0, 0, sx1, 4, 8, "stone", 4)
    P.stone(g, foot, "stone", 4, block=(5, 2), seed=51)
    land = box(g, sx0, FLOOR - 4, lz0, sx1, FLOOR, UZ1, "stone", 6)
    P.stone(g, land, "stone", 6, block=(6, 3), seed=52)
    P.flat(g, edges(land), "stone", 4)
    for pz in (lz0, UZ1 - 6):
        pier = box(g, sx0 + 2, 0, pz, sx1 - 1, FLOOR - 4, pz + 6, "stone", 5)
        P.stone(g, pier, "stone", 5, block=(6, 4), seed=53 + pz)
    # the rail runs 11 above the step line, on posts that stand on the steps
    step_y = lambda z: 8.5 + (z - 6) * (FLOOR - 8) / (lz0 + 1 - 6)  # noqa: E731
    rail_y = lambda z: step_y(z) + 11  # noqa: E731
    S.bar(g, "x", (rail_y(6), 6), (rail_y(lz0), lz0), 2, sx1 - 2, sx1, "darkwood", 3)
    rp = S.last(g)
    for pz in (10, 10 + (lz0 - 12) // 2, lz0 - 2):
        rp |= box(g, sx1 - 2, int(step_y(pz)) - 1, pz, sx1, int(rail_y(pz)) + 1, pz + 2, "darkwood", 4)
    rp |= box(g, sx1 - 2, FLOOR, lz0, sx1, FLOOR + 11, lz0 + 2, "darkwood", 4)
    rp |= box(g, sx1 - 2, FLOOR + 9, lz0, sx1, FLOOR + 11, UZ1, "darkwood", 4)
    rp |= box(g, sx1 - 2, FLOOR, UZ1 - 2, sx1, FLOOR + 11, UZ1, "darkwood", 4)
    P.planks(g, rp, "darkwood", 3, width=2, across="x", nails=False, seed=54)


def yard(g: Grid) -> None:
    """Props at the base (rule K1): a crate stack of goods, a barrel, sacks."""
    goods_crate(g, 2, 0, 18, 11, 10, 7, "red", 5, seed=60)
    crate(g, 2, 0, 30, 11, seed=61)
    goods_crate(g, 3, 11, 31, 9, 8, 5, "orange", 5, seed=62)
    barrel(g, 7, 47, 0, 19, 6, ramp="wood", hoop="iron")
    sack(g, UX1 + 6, 16, 4, w=8, h=10, ramp="bone", base=6, tie=("darkwood", 3))


def build() -> Asset:
    g = Grid(W, H, D)
    arcade(g)
    stalls(g)
    hall(g)
    cupola(g)
    scales_sign(g)
    stair(g)
    yard(g)
    return Asset(
        id="fantasy-buildings-market-hall", pack="fantasy", category="buildings", name="Market Hall", root=Part("market-hall", g),
        sockets=[Socket("socket-function", at=(CUP_X, BELL_TOP - 4, CUP_Z))],
        pfx=[{"effectId": "rvx-fantasy-bell-toll", "socket": "socket-function", "trigger": "idle", "size": 22}],
    )
