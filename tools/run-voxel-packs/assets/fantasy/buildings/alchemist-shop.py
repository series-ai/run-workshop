"""Alchemist shop in the Pirate Nation style.

A narrow, tall shop with a crooked look. The stone ground floor has a
magenta door and a deep bay window painted with coloured potion bottles.
The jettied, half-timbered upper storey leans to the right (a skewed
prism with true slopes, rule F5), with toxic-green glowing windows and
magenta shutters, and carries a steep teal shingle roof whose ridge sits
off centre. A tall stone chimney leans off the right wall.

The oversized function prop stands on the left: a big copper still on a
brick furnace with a glowing mouth, its swan-neck pipe running down into a
giant glowing green retort flask on a stand. The flask fizzes on `idle`
(PFX potion fizz). A hanging flask sign, a crate of potions, a barrel and
herb pots stand round the base (rule K1). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
import pnglyph
from _bld import round_window, sack
from _fbld_civic import idx, plaster, plinth
from _props import gem, potion
from pnkit import barrel, beam, box, crate, door, edges, on_face, shutters, window
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 100, 118, 74
X0, X1, Z0, Z1 = 34, 72, 22, 58  # the ground floor walls; the front is z = Z0
GROUND, UPPER, WALL_TOP = 34, 37, 66
J = 3
LEAN = 5.0  # the upper storey top shifts this far to +x
RIDGE = 102
APEX_DX = 5.0  # the ridge sits this far right of the upper storey centre
STILL_X, STILL_Z = 18, 40  # the copper still
FLASK_X, FLASK_Z = 20, 12  # the retort flask
FLASK_Y0 = 8

ICON_FLASK = [
    "..###..",
    "...#...",
    "...#...",
    "..###..",
    ".#####.",
    "##+####",
    "#+#####",
    "#######",
    ".#####.",
]


def skew_box(g: Grid, x0, z0, x1, z1, y0, y1, dx: float = 0.0, dz: float = 0.0, ramp: str = "sand", base: int = 6) -> list:
    """A box whose top is shifted by (dx, dz): a leaning, crooked storey
    (rule F5) with true slopes. Returns the new solids for paint_facets."""
    start = len(g.solids)
    rect = [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
    g.prism("y", rect, y0, y1, C(ramp, base), top=[(x + dx, z + dz) for x, z in rect])
    return g.solids[start:]


def solids_mask(g: Grid, solids) -> np.ndarray:
    return np.logical_or.reduce([s.mask(g.shape) for s in solids])


def hanging_board(g: Grid, face: str, plane, u0, u1, v0, v1, ramp: str = "wood", base: int = 5, frame=("darkwood", 3), depth: int = 2) -> np.ndarray:
    """A planked sign board `depth` thick standing on a face plane, with a
    dark frame (S4). Paint an icon on it afterwards."""
    m = box(g, *on_face(face, plane, u0, u1, v0, v1, 0, depth), ramp, base)
    across = "y"
    P.planks(g, m, ramp, base, width=3, across=across, nails=False)
    P.outline(g, m, *frame, normal=face[1] if face != "top" else "y")
    return m


def lean_x(y):
    """The x shift of the leaning upper storey at height y."""
    return LEAN * np.clip((y - UPPER) / (WALL_TOP - UPPER), 0.0, 1.0)


def shop(g: Grid) -> None:
    """The stone ground floor: plinth, walls, door, bay window, windows."""
    X, Y, Z = idx(g)
    plinth(g, X0 - 2, Z0 - 2, X1 + 2, Z1 + 2, 4, "stone", 4, seed=1)
    walls = box(g, X0, 4, Z0, X1, GROUND, Z1, "stone", 5)
    P.stone(g, walls, "stone", 5, block=(7, 5), seed=2)
    quoin = walls & (((X < X0 + 3) | (X >= X1 - 3)) & ((Z < Z0 + 3) | (Z >= Z1 - 3)))
    P.stone(g, quoin, "stone", 6, block=(3, 5), seed=3)
    P.grime(g, walls, height=4, seed=4)
    door(g, "-z", Z0, 37, 51, 4, 30, leaf="magenta", base=3, seed=5)
    step = box(g, 35, 0, Z0 - 6, 53, 4, Z0 - 2, "stone", 4)
    P.stone(g, step, "stone", 4, block=(6, 4), frame="top", seed=6)
    # the deep bay window: a dark frame box with painted bottles on teal glass
    bx0, bx1, by0, by1, bz = 54, 70, 10, 28, Z0 - 6
    frame = box(g, bx0 - 2, by0 - 3, bz, bx1 + 2, by1 + 2, Z0, "darkwood", 4)
    P.planks(g, frame, "darkwood", 4, width=3, across="y", nails=False, seed=7)
    pane = box(g, bx0, by0, bz - 1, bx1, by1, bz, "teal", 6)
    P.flat(g, pane & (Y >= by1 - 3), "teal", 7)
    shelf_ys = (by0, by0 + 9)
    colours = (("magenta", 5), ("toxic", 5), ("gold", 6), ("sky", 5), ("red", 5))
    for row, sy in enumerate(shelf_ys):
        P.flat(g, pane & (Y == sy), "darkwood", 3)
        for k, bx in enumerate(range(bx0 + 1, bx1 - 2, 4)):
            col, sh = colours[(k + row * 2) % len(colours)]
            body = pane & (X >= bx) & (X < bx + 3) & (Y > sy) & (Y < sy + 5)
            neck = pane & (X == bx + 1) & (Y >= sy + 5) & (Y < sy + 7)
            P.flat(g, body, col, sh)
            P.flat(g, body & (X == bx) & (Y == sy + 3), col, 7)
            P.flat(g, neck, "bone", 7)
    P.flat(g, pane & ((X == (bx0 + bx1) // 2)), "darkwood", 2)
    P.outline(g, pane, "darkwood", 2, normal="z")
    hood = S.bar(g, "x", (by1 + 6, Z0), (by1 + 2, bz - 2), 3, bx0 - 3, bx1 + 3, "teal", 3)
    P.tiles(g, hood, "teal", 3, row=2, width=3, along="x", seed=8)
    # side and back windows
    window(g, "+x", X1, Z0 + 10, Z0 + 22, 14, 26, glass="toxic", glow=5)
    window(g, "-x", X0, Z1 - 18, Z1 - 8, 14, 26, glass="gold", glow=6)
    window(g, "+z", Z1, X0 + 8, X0 + 20, 14, 26, glass="gold", glow=6)
    door(g, "+z", Z1, X1 - 20, X1 - 6, 4, 28, leaf="wood", base=4, seed=9)


def upper(g: Grid) -> None:
    """The jettied upper storey that leans to +x, painted with crooked
    half-timbering, toxic-green windows and magenta shutters."""
    X, Y, Z = idx(g)
    beam(g, X0 - J - 1, GROUND, Z0 - J - 1, X1 + J + 1, UPPER, Z1 + J + 1, base=4, seed=10)
    ux0, ux1, uz0, uz1 = X0 - J, X1 + J, Z0 - J, Z1 + J
    sol = skew_box(g, ux0, uz0, ux1, uz1, UPPER, WALL_TOP, dx=LEAN, ramp="sand", base=6)
    m = solids_mask(g, sol)
    plaster(g, m, "sand", 6, seed=11)
    # crooked studs that lean with the wall, rails, and braces
    xs = X - lean_x(Y)
    U = np.floor(xs).astype(np.int64) + Z
    du = (U - ux0) % 13
    P.flat(g, m & (du < 3), "darkwood", 4)
    P.flat(g, m & ((Y < UPPER + 3) | (Y >= WALL_TOP - 3) | ((Y >= UPPER + 13) & (Y < UPPER + 15))), "darkwood", 4)
    k = ((U - ux0) // 13) % 2 == 0
    brace = np.abs((du - 3) * 1.2 + UPPER + 3 - Y) < 1.6
    P.flat(g, m & k & brace & (Y < UPPER + 13), "darkwood", 3)
    # corner posts, leaning (true slopes)
    for cx, cz in ((ux0 - 1, uz0 - 1), (ux1 - 3, uz0 - 1), (ux0 - 1, uz1 - 3), (ux1 - 3, uz1 - 3)):
        g.prism("y", [(cx, cz), (cx + 4, cz), (cx + 4, cz + 4), (cx, cz + 4)], UPPER, WALL_TOP, C("darkwood", 3),
                top=[(cx + LEAN, cz), (cx + LEAN + 4, cz), (cx + LEAN + 4, cz + 4), (cx + LEAN, cz + 4)])
        P.planks(g, S.last(g), "darkwood", 3, width=4, across="x", nails=False, seed=cx + cz)
    # windows: placed at mid height, shifted with the lean
    mid = (UPPER + 16 + UPPER + 28) / 2
    sh = int(round(lean_x(mid)))
    for u0 in (ux0 + 7, ux1 - 18):
        window(g, "-z", uz0, u0 + sh, u0 + sh + 11, UPPER + 16, UPPER + 28, glass="toxic", glow=5)
    shutters(g, "-z", uz0, ux0 + 7 + sh, ux0 + 18 + sh, UPPER + 16, UPPER + 28, ramp="magenta")
    for w0 in (uz0 + 8, uz1 - 18):
        window(g, "-x", ux0 + sh, w0, w0 + 10, UPPER + 16, UPPER + 28, glass="toxic", glow=5)
    window(g, "+x", ux1 + sh, uz0 + 8, uz0 + 18, UPPER + 16, UPPER + 28, glass="toxic", glow=5)
    shutters(g, "+x", ux1 + sh, uz0 + 8, uz0 + 18, UPPER + 16, UPPER + 28, ramp="magenta")
    window(g, "+z", uz1, ux0 + 10 + sh, ux0 + 21 + sh, UPPER + 16, UPPER + 28, glass="gold", glow=6)


def roof(g: Grid) -> None:
    """A steep crooked gable roof (gable to the front): the ridge sits off
    centre, so the two slopes differ (true slopes, rules F2, F4, F5)."""
    X, Y, Z = idx(g)
    a0, a1 = X0 - J + LEAN, X1 + J + LEAN  # the leaned wall tops
    z0, z1 = Z0 - J, Z1 + J
    ac = (a0 + a1) / 2 + APEX_DX
    t, o = 5, 5
    ae0, ae1 = a0 - o, a1 + o
    eave = WALL_TOP - 2
    r0 = (RIDGE - eave) / (ac - ae0)
    r1 = (RIDGE - eave) / (ae1 - ac)
    under0 = eave + (a0 - ae0) * r0
    under1 = eave + (ae1 - a1) * r1
    g.prism("z", [(a0, WALL_TOP), (a1, WALL_TOP), (a1, under1), (ac, RIDGE), (a0, under0)], z0, z1, C("sand", 6))
    attic = S.last(g)
    plaster(g, attic, "sand", 6, seed=20)
    P.flat(g, attic & (np.abs(X + 0.5 - ac) < 1.6), "darkwood", 4)  # king post
    P.flat(g, attic & (Y >= WALL_TOP) & (Y < WALL_TOP + 3), "darkwood", 4)  # tie beam
    P.flat(g, attic & (Y >= WALL_TOP + 24) & (Y < WALL_TOP + 26), "darkwood", 4)  # collar beam
    for sx in (ac - 12, ac + 9):  # queen struts, set unevenly (F5)
        P.flat(g, attic & (np.abs(X + 0.5 - sx) < 1.1) & (Y < WALL_TOP + 25), "darkwood", 4)
    zs0, zs1 = z0 - o + 1, z1 + o - 1
    g.prism("z", [(ae0, eave), (ae0, eave + t), (ac, RIDGE + t), (ac, RIDGE)], zs0, zs1, C("teal", 3))
    left = S.last(g)
    g.prism("z", [(ae1, eave), (ac, RIDGE), (ac, RIDGE + t), (ae1, eave + t)], zs0, zs1, C("teal", 3))
    right = S.last(g)
    for m, a_end in ((left, ae0), (right, ae1)):
        P.tiles(g, m, "teal", 3, row=4, width=4, frame=((0, 0, 1), (a_end - ac, eave - RIDGE, 0.0)), seed=21)
    slabs = left | right
    P.flat(g, slabs & ((Z < zs0 + 2) | (Z >= zs1 - 2)), "darkwood", 3)  # barge boards
    rm = box(g, int(ac) - 2, RIDGE + t - 1, zs0 - 1, int(ac) + 2, RIDGE + t + 2, zs1 + 1, "darkwood", 3)
    P.planks(g, rm, "darkwood", 3, width=3, across="x", seed=22)
    # a round toxic-green loft light in the front gable
    round_window(g, "-z", z0, ac - 1, WALL_TOP + 15, 5, glass=("toxic", 5), frame=("magenta", 4))
    window(g, "+z", z1, int(ac) - 5, int(ac) + 5, WALL_TOP + 10, WALL_TOP + 20, glass="toxic", glow=5)
    # a magenta crystal finial on the front of the ridge
    gem(g, ac, RIDGE + t, zs0 + 2, r=2.5, h=7, ramp="magenta", shade=5)
    # a crooked dormer on the left slope with a green loft light
    dx0, dx1, dz0, dz1 = int(a0) - 2, int(a0) + 10, 34, 46
    dm = box(g, dx0, WALL_TOP + 4, dz0, dx1, WALL_TOP + 28, dz1, "sand", 6)
    plaster(g, dm, "sand", 6, seed=23)
    P.flat(g, edges(dm), "darkwood", 3)
    window(g, "-x", dx0, dz0 + 2, dz1 - 2, WALL_TOP + 14, WALL_TOP + 24, glass="toxic", glow=5)
    g.prism("x", [(WALL_TOP + 27, dz0 - 3), (WALL_TOP + 27, dz1 + 3), (WALL_TOP + 37, (dz0 + dz1) / 2 + 1.5)], dx0 - 3, dx1 + 2, C("teal", 3))
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.tiles(gg, mm, "teal", 3, row=3, width=4, frame=fr, seed=24))
    P.flat(g, S.last(g) & (X < dx0 - 1), "darkwood", 3)


def chimney(g: Grid) -> None:
    """A tall stone chimney that leans off the right wall."""
    cx0, cx1, cz0, cz1 = X1 + 1, X1 + 11, Z1 - 20, Z1 - 8
    low = box(g, cx0, 0, cz0, cx1, 40, cz1, "stone", 4)
    P.stone(g, low, "stone", 4, block=(6, 4), seed=30)
    lean = 4.0
    g.prism("y", [(cx0 + 1, cz0 + 1), (cx1, cz0 + 1), (cx1, cz1 - 1), (cx0 + 1, cz1 - 1)], 40, 104, C("stone", 4),
            top=[(cx0 + 2 + lean, cz0 + 2), (cx1 - 1 + lean, cz0 + 2), (cx1 - 1 + lean, cz1 - 2), (cx0 + 2 + lean, cz1 - 2)])
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "stone", 4, block=(5, 3), frame=fr, seed=31))
    cap = box(g, int(cx0 + 1 + lean), 104, cz0 + 1, int(cx1 + lean), 107, cz1 - 1, "stone", 3)
    P.stone(g, cap, "stone", 3, block=(6, 2), seed=32)
    box(g, int(cx0 + 3 + lean), 106, cz0 + 3, int(cx1 - 2 + lean), 107, cz1 - 3, "iron", 2)
    P.flat(g, edges(low), "stone", 3)


def still(g: Grid) -> dict:
    """The oversized copper still on a brick furnace, its swan-neck pipe and
    the giant glowing retort flask (the function prop, rules F4, F6)."""
    X, Y, Z = idx(g)
    # the brick furnace with a glowing arched mouth
    fx0, fx1, fz0, fz1 = STILL_X - 13, STILL_X + 13, STILL_Z - 12, STILL_Z + 12
    fur = box(g, fx0, 0, fz0, fx1, 14, fz1, "red", 3)
    P.stone(g, fur, "red", 3, block=(5, 3), seed=40)
    P.flat(g, edges(fur), "red", 2)
    g.prism("z", S.arch(STILL_X, 2, 5.0, 11.0, bulge=0.3), fz0 - 1, fz0 + 1, C("orange", 5))
    fire = S.last(g)
    P.flat(g, fire & (Y < 6), "gold", 7)
    P.flat(g, fire & (Y >= 9), "red", 5)
    # the copper pot: a belly, a shoulder, a neck and the alembic helm
    cx, cz = float(STILL_X), float(STILL_Z)
    start = len(g.solids)
    g.prism("y", S.flat_ngon(cx, cz, 9.0, 8), 14, 18, C("orange", 3), top=S.flat_ngon(cx, cz, 11.0, 8))
    g.prism("y", S.flat_ngon(cx, cz, 11.0, 8), 18, 30, C("orange", 4))
    g.prism("y", S.flat_ngon(cx, cz, 11.0, 8), 30, 37, C("orange", 4), top=S.flat_ngon(cx, cz, 4.0, 8))
    g.prism("y", S.flat_ngon(cx, cz, 3.0, 8), 37, 41, C("orange", 3))
    g.prism("y", S.flat_ngon(cx, cz, 5.0, 8), 41, 44, C("orange", 4), top=S.flat_ngon(cx, cz, 6.0, 8))
    g.prism("y", S.flat_ngon(cx, cz, 6.0, 8), 44, 52, C("orange", 5), top=S.flat_ngon(cx, cz, 1.5, 8))
    pot = solids_mask(g, g.solids[start:])
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.plates(gg, mm, "orange", 4, size=(6, 5), frame=fr, seed=41))
    P.flat(g, pot & ((Y == 22) | (Y == 29) | (Y == 42)), "gold", 5)  # brass hoops
    P.flat(g, pot & (X + 0.5 < cx - 5) & (Y > 19) & (Y < 28), "orange", 6)  # the lit side
    # the swan-neck pipe from the helm, down to the flask mouth (true slopes)
    S.bar(g, "x", (49, cz), (24, FLASK_Z + 1), 3, cx - 1.5, cx + 1.5, "orange", 4)
    P.flat(g, S.last(g), "orange", 4)
    P.outline(g, S.last(g), "orange", 2, normal="x")
    # the retort flask: a round glowing body, a neck, on an iron ring stand
    fx, fz = float(FLASK_X), float(FLASK_Z)
    stand = np.zeros(g.shape, dtype=bool)
    for dx, dz in ((-6, -6), (5, -6), (-6, 5), (5, 5)):
        stand |= box(g, int(fx) + dx, 0, int(fz) + dz, int(fx) + dx + 2, FLASK_Y0 + 2, int(fz) + dz + 2, "iron", 3)
    stand |= box(g, int(fx) - 7, FLASK_Y0, int(fz) - 7, int(fx) + 8, FLASK_Y0 + 2, int(fz) + 8, "iron", 4)
    P.flat(g, stand & (Y == FLASK_Y0 + 1), "iron", 5)
    start = len(g.solids)
    g.prism("y", S.flat_ngon(fx + 0.5, fz + 0.5, 4.0, 8), FLASK_Y0 + 2, FLASK_Y0 + 4, C("toxic", 4), top=S.flat_ngon(fx + 0.5, fz + 0.5, 7.0, 8))
    g.prism("y", S.flat_ngon(fx + 0.5, fz + 0.5, 7.0, 8), FLASK_Y0 + 4, FLASK_Y0 + 10, C("toxic", 5))
    g.prism("y", S.flat_ngon(fx + 0.5, fz + 0.5, 7.0, 8), FLASK_Y0 + 10, FLASK_Y0 + 14, C("toxic", 5), top=S.flat_ngon(fx + 0.5, fz + 0.5, 2.5, 8))
    g.prism("y", S.flat_ngon(fx + 0.5, fz + 0.5, 2.0, 8), FLASK_Y0 + 14, FLASK_Y0 + 19, C("sky", 7))
    flask = solids_mask(g, g.solids[start:])
    P.flat(g, flask & (Y >= FLASK_Y0 + 9) & (Y < FLASK_Y0 + 14), "sky", 7)  # the glass above the liquid
    P.flat(g, flask & (Y == FLASK_Y0 + 9), "toxic", 7)  # the bright surface line
    P.flat(g, flask & (X + 0.5 < fx - 3) & (Y > FLASK_Y0 + 5) & (Y < FLASK_Y0 + 9), "toxic", 7)  # glint
    P.flat(g, flask & (Y < FLASK_Y0 + 4), "toxic", 3)
    mouth = (fx + 0.5, FLASK_Y0 + 20.0, fz + 0.5)
    # small potions on the furnace ledge
    for k, (col, sh) in enumerate((("magenta", 5), ("toxic", 5), ("sky", 5))):
        potion(g, fx1 - 4.0, 14, fz0 + 4.0 + k * 6, r=2.0, h=5, liquid=col, shade=sh)
    return {"mouth": mouth}


def sign(g: Grid) -> None:
    """A hanging board with a big magenta flask on a bracket from the
    front corner post (rules F4, F6)."""
    sz = Z0 - J - 1
    bx0 = X1 + J + int(LEAN) - 1
    br = box(g, bx0, 58, sz - 1, bx0 + 16, 61, sz + 2, "darkwood", 3)
    P.planks(g, br, "darkwood", 3, width=3, across="y", nails=True, seed=50)
    g.prism("z", [(bx0, 50), (bx0, 58), (bx0 + 8, 58)], sz - 0.5, sz + 1.5, C("darkwood", 3))
    for cx in (bx0 + 3, bx0 + 13):
        box(g, cx, 54, sz, cx + 1, 58, sz + 1, "iron", 4)
    hanging_board(g, "-z", sz + 2, bx0 + 1, bx0 + 16, 36, 54, "wood", 5, depth=3)
    stamp_flask(g, "-z", sz - 1, bx0 + 5, 40)
    stamp_flask(g, "+z", sz + 2, bx0 + 5, 40)


def stamp_flask(g: Grid, face: str, plane, u0: int, v0: int) -> None:
    """Paint the flask icon on one face of the sign board."""
    legend = {"#": C("magenta", 5), "+": C("pink", 7)}
    pnglyph.stamp(g, face, plane, u0, v0, ICON_FLASK, legend, scale=1)


def yard(g: Grid) -> None:
    """Props at the base (rule K1): a crate of potions, a barrel, herb pots, a sack."""
    X, Y, Z = idx(g)
    crate(g, X1 - 4, 0, Z0 - 18, 12, seed=60)
    for k, (col, sh) in enumerate((("magenta", 5), ("toxic", 5), ("gold", 6), ("sky", 5))):
        potion(g, X1 - 1.0 + (k % 2) * 5, 12, Z0 - 15.0 + (k // 2) * 5, r=2.0, h=5, liquid=col, shade=sh)
    barrel(g, X1 + 14, Z0 + 4, 0, 19, 6, ramp="wood", hoop="iron")
    for k, px in enumerate((X0 - 8, X0 - 1)):
        pot = S.cone(g, "y", px + 0.5, Z0 - 6.5, 3.5, 0, 6, "red", 3, r_top=4.5)
        P.flat(g, pot & (Y == 5), "red", 5)
        S.dome(g, px + 0.5, Z0 - 6.5, 6, 4.5, h=5 + k, n=8, rings=2, ramp="leaf", base=4, ribs=None,
               painter=lambda gg, mm, fr: P.mottle(gg, mm, "leaf", 4, cell=2, seed=61))
    sack(g, STILL_X + 8, STILL_Z + 18, 0, w=8, h=10, ramp="bone", base=5, tie=("darkwood", 3))
    # a small bubbling cauldron on three iron legs, behind the shop
    kx, kz = X0 + 10.5, Z1 + 9.5
    for dx, dz in ((-4, -3), (3, -3), (0, 4)):
        box(g, int(kx) + dx, 0, int(kz) + dz, int(kx) + dx + 2, 4, int(kz) + dz + 2, "iron", 3)
    cauldron = S.cone(g, "y", kx, kz, 4.0, 3, 6, "iron", 4, r_top=6.0)
    cauldron |= S.disc(g, "y", kx, kz, 6.0, 6, 11, "iron", 4)
    P.flat(g, cauldron & (Y == 9), "iron", 6)
    brew = box(g, int(kx) - 4, 11, int(kz) - 4, int(kx) + 5, 12, int(kz) + 5, "magenta", 5)
    P.flat(g, brew & ((X + Z) % 3 == 0), "pink", 7)
    # bundles of drying herbs hung under the front jetty
    for k, hx in enumerate(range(X0 + 2, X0 + 14, 4)):
        box(g, hx, GROUND - 3, Z0 - 2, hx + 1, GROUND, Z0 - 1, "darkwood", 3)
        g.prism("z", [(hx - 1, GROUND - 3), (hx + 2, GROUND - 3), (hx + 1.5, GROUND - 9 - k % 2), (hx - 0.5, GROUND - 9 - k % 2)], Z0 - 3, Z0 - 1, C("leaf" if k % 2 else "moss", 5))


def build() -> Asset:
    g = Grid(W, H, D)
    shop(g)
    upper(g)
    roof(g)
    chimney(g)
    out = still(g)
    sign(g)
    yard(g)
    return Asset(
        id="fantasy-buildings-alchemist-shop", pack="fantasy", category="buildings", name="Alchemist Shop", root=Part("alchemist-shop", g),
        sockets=[Socket("socket-function", at=out["mouth"])],
        pfx=[{"effectId": "rvx-fantasy-potion-fizz", "socket": "socket-function", "trigger": "idle", "size": 22}],
    )
