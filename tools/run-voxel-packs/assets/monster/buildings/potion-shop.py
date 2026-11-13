"""Potion shop, in the Pirate Nation haunted style.

An apothecary of cures that never cured anybody. A grey stone ground
storey under a timber shopfront: a bowed bay window glowing toxic green
with rows of painted phials on its shelves, a striped awning, two lit
lanterns and a pointed magenta doorway. The jettied upper storey is pale
plaster in a thick timber frame on proud braces (true slopes), with
leaded magenta windows and bundles of herbs hanging under the jetty. A
very steep purple slate gable (rule F4) sits over it, with gold pinnacles
and a leaning stone chimney; an octagonal stone turret with two lit slits
stands at the +x corner under a tall conical spire and a bat vane.

The function prop is oversized (rules F4 and F6): a giant glass flask on
a stone plinth beside the shopfront, its magenta brew bubbling toxic
green under a gold collar and a cork. A shop board with a painted drop
hangs from a wrought-iron bracket over the door and swings on `idle`.
Barrels of herbs, a crate of phials, a mortar, glowing toadstools and
pumpkins finish the base (K1). Faces -Z.
"""

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import bat, coords, mushroom, opening, parts, piers, plinth, pointed, roof_paint, stone
from _pn import lancet, pumpkin
from pnkit import awning, barrel, box, crate, gable_roof
from voxgrid import C, Asset, Clip, Grid, Socket

W, H, D = 160, 144, 112
X0, X1, Z0, Z1 = 40, 116, 36, 88  # ground storey walls
JET = 4  # the upper storey juts out this far at the front and sides
FLOOR1, WALL = 44, 82
RIDGE = 120
CXM = (X0 + X1) / 2
TUR = (118.0, 48.0)  # turret centre x, z: it engages the +x side wall (review B6: width 110-120)
TUR_R, TUR_TOP = 12.0, 96.0  # the drum rises through the eave
CHIM = (50.0, 84.0, 76.0)  # chimney head centre (x, y, z)
FLASK = (30.0, 10.0, 19.0)  # giant flask centre x, foot y, centre z
FLASK_R, FLASK_H = 11.0, 30.0
BRACKET = (X1 - 6.0, 68.0, Z0 - JET - 1.0)  # where the bracket meets the wall
SIGN_TOP = (X1 - 6.0, 64.0, Z0 - JET - 17.0)


def shelf_bottles(g: Grid, pane: np.ndarray, u0: float, u1: float, rows) -> None:
    """Painted rows of phials behind the shop glass (rule S1): a dark
    shelf board and a run of little bottles in mixed accent hues."""
    X, Y, _Z = coords(g)
    hues = (("magenta", 5), ("toxic", 5), ("gold", 5), ("ember", 4), ("purple", 5))
    for k, v in enumerate(rows):
        P.flat(g, pane & (np.abs(Y - v) < 0.6), "wood", 3)
        u, j = u0 + 1.5, k
        while u < u1 - 3.0:
            wdt = 2.0 if j % 3 else 3.0
            bot = pane & (X >= u) & (X < u + wdt) & (Y > v) & (Y < v + 5)
            P.flat(g, bot, *hues[j % len(hues)])
            P.flat(g, bot & (Y > v + 3.5) & (np.abs(X - (u + wdt / 2)) < 0.7), "bone", 6)
            u += wdt + 2.0
            j += 1


def flask(g: Grid) -> None:
    """The oversized shop flask (rules F4, K3): a stone plinth, a faceted
    glass belly of magenta brew with toxic bubbles, a tapered shoulder, a
    gold collar and a cork."""
    X, Y, Z = coords(g)
    fx, fy, fz = FLASK
    start = len(g.solids)
    g.prism("y", S.flat_ngon(fx, fz, FLASK_R + 3.0, 8), 0, fy - 2, C("gray", 5), top=S.flat_ngon(fx, fz, FLASK_R + 1.0, 8))
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(6, 4), frame=fr, seed=30))
    cap = S.disc(g, "y", fx, fz, FLASK_R + 2.0, fy - 2, fy, "gray", 6)
    P.stone(g, cap, "gray", 6, block=(5, 3), seed=31)
    glass = S.cone(g, "y", fx, fz, FLASK_R * 0.52, fy, fy + FLASK_H * 0.42, "magenta", 4, r_top=FLASK_R)
    glass |= S.cone(g, "y", fx, fz, FLASK_R, fy + FLASK_H * 0.42, fy + FLASK_H * 0.78, "magenta", 4, r_top=FLASK_R * 0.34)
    neck = box(g, fx - 3, fy + FLASK_H * 0.78, fz - 3, fx + 3, fy + FLASK_H, fz + 3, "magenta", 5)
    rr = S.ngon_radius(g, "y", fx, fz)
    top = fy + FLASK_H * 0.56
    P.flat(g, (glass | neck) & (Y >= top), "magenta", 7)  # the empty glass over the brew
    P.flat(g, (glass | neck) & (Y >= top) & (rr > FLASK_R - 2.5), "magenta", 6)
    brew = glass & (Y < top)
    P.flat(g, brew, "magenta", 4)
    P.flat(g, brew & (Y < fy + 4), "magenta", 3)
    P.flat(g, brew & (np.abs(Y - (top - 1)) < 1.2), "magenta", 6)  # the meniscus
    for bx, bz, by, br in ((-4, -2, 0.18, 2.6), (3, 2, 0.30, 2.0), (1, -5, 0.42, 1.6), (-2, 4, 0.47, 1.3)):
        P.flat(g, brew & (np.hypot(X - fx - bx, Z - fz - bz) < br) & (np.abs(Y - (fy + FLASK_H * by)) < br), "toxic", 5)
    P.flat(g, glass & (X < fx - FLASK_R * 0.55) & (Z < fz) & (Y > fy + 5), "magenta", 7)  # a highlight down the belly
    collar = box(g, fx - 4, fy + FLASK_H - 4, fz - 4, fx + 4, fy + FLASK_H - 2, fz + 4, "gold", 4)
    P.flat(g, collar & (((X + Z).astype(int) % 4) == 0), "gold", 6)
    cork = S.cone(g, "y", fx, fz, 3.4, fy + FLASK_H - 2, fy + FLASK_H + 4, "wood", 5, r_top=2.6)
    P.flat(g, cork & (Y > fy + FLASK_H + 2), "wood", 6)


def turret(g: Grid) -> None:
    """An octagonal stone turret with string courses, two lit slits and a
    tall conical purple spire under a bat vane."""
    X, Y, Z = coords(g)
    tx, tz = TUR
    start = len(g.solids)
    g.prism("y", S.flat_ngon(tx, tz, TUR_R, 8), 0, TUR_TOP, C("gray", 5), top=S.flat_ngon(tx, tz, TUR_R - 1.2, 8))
    drum = g.solids[-1].mask(g.shape)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(7, 4), cracks=0.08, frame=fr, seed=32))
    for cy in (6, 42, TUR_TOP - 6):
        band = S.disc(g, "y", tx, tz, TUR_R + 1.2, cy, cy + 4, "gray", 6)
        P.stone(g, band, "gray", 6, block=(6, 3), seed=33)
    rr = S.ngon_radius(g, "y", tx, tz)
    for v0, hue in ((22.0, "toxic"), (56.0, "magenta")):
        slit = drum & (rr > TUR_R - 2.6) & (Z < tz - 2) & (np.abs(X - (tx + 4)) < 2.2) & (Y > v0) & (Y < v0 + 13)
        P.flat(g, slit, hue, 5)
        P.flat(g, slit & (Y < v0 + 5), hue, 6)
        P.outline(g, slit, "gray", 7, normal="z")
    eave = S.cone(g, "y", tx, tz, TUR_R + 2.5, TUR_TOP, TUR_TOP + 4, "gray", 6, n=8, r_top=TUR_R + 1.0, tip="lo")
    P.stone(g, eave, "gray", 6, block=(5, 3), seed=34)
    cone = S.cone(g, "y", tx, tz, TUR_R + 2.0, TUR_TOP + 4, TUR_TOP + 34, "purple", 4, n=8)
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 4, row=3, width=4, frame=fr, seed=35))
    P.flat(g, cone & (Y < TUR_TOP + 7), "gray", 6)
    P.flat(g, cone & S.seams(g, g.solids[-1:], 0.9), "gray", 5)
    box(g, tx - 1, TUR_TOP + 32, tz - 1, tx + 1, TUR_TOP + 43, tz + 1, "gray", 3)
    bat(g, tx, TUR_TOP + 40, tz - 1, span=14, t=2, ramp="purple", base=3)


def shopfront(g: Grid) -> None:
    """The timber shopfront: a bowed bay window of toxic glass on painted
    shelves of phials, a striped awning, a pointed magenta door with two
    lit lanterns, and stone steps."""
    X, Y, Z = coords(g)
    wu0, wu1 = X0 + 6, X0 + 38
    bay = box(g, wu0 - 3, 8, Z0 - 8, wu1 + 3, 42, Z0, "wood", 5)
    P.planks(g, bay, "wood", 5, width=3, across="y", nails=True, seed=14)
    pane = box(g, wu0, 13, Z0 - 9, wu1, 37, Z0 - 8, "toxic", 5)
    P.flat(g, pane & (Y > 33), "toxic", 6)
    shelf_bottles(g, pane, wu0, wu1, (15.0, 23.0, 31.0))
    P.flat(g, pane & ((np.abs(X - (wu0 + wu1) / 2) < 0.8) | (((X - wu0).astype(int) % 10) == 0)), "wood", 3)
    for v0, v1 in ((10, 13), (37, 42)):  # a dark sill and a dark lintel board
        P.flat(g, box(g, wu0 - 4, v0, Z0 - 10, wu1 + 4, v1, Z0 - 7, "wood", 3), "wood", 3)
    for mx in (wu0 - 4, wu1):  # the bay's corner mullions
        P.flat(g, box(g, mx, 13, Z0 - 10, mx + 4, 37, Z0 - 7, "wood", 4), "wood", 4)
    awning(g, "-z", Z0 - 10, wu0 - 5, wu1 + 5, 44, depth=9, drop=6, ramps=("purple", "bone"), stripe=4)
    du = X1 - 18
    opening(g, "-z", Z0, pointed(du - 10, du + 10, 6, 40), glow=("magenta", 6), deep=("purple", 3))
    leaf = box(g, du - 9, 6, Z0 - 2, du + 1, 30, Z0 - 1, "purple", 3)
    P.planks(g, leaf, "purple", 3, width=3, across="x", length=(40, 41), nails=True, seed=15)
    P.flat(g, leaf & ((np.abs(Y - 12) < 1.1) | (np.abs(Y - 25) < 1.1)), "gray", 3)
    box(g, du - 2, 17, Z0 - 3, du, 20, Z0 - 2, "gold", 5)
    for lx in (du - 15, du + 15):  # two lit lanterns beside the door
        box(g, lx - 1, 30, Z0 - 3, lx + 1, 34, Z0 - 1, "gray", 3)
        lan = box(g, lx - 3, 22, Z0 - 6, lx + 3, 30, Z0, "ember", 6)
        P.flat(g, lan & ((Y < 23) | (Y > 29)), "gray", 4)
        P.flat(g, lan & (np.abs(X - lx) > 1.8), "gray", 4)
        P.flat(g, lan & (np.abs(Y - 26) < 1.6) & (np.abs(X - lx) < 1.6), "ember", 7)
        S.cone(g, "y", lx, Z0 - 3, 4.0, 30, 33, "gray", 4, n=4)
    for k in range(2):
        P.stone(g, box(g, du - 14 + k, 0, Z0 - 9 + 4 * k, du + 14 - k, 3 * (k + 1), Z0 - 1, "gray", 4), "gray", 4, block=(6, 3), seed=16 + k)


def props(g: Grid) -> None:
    """The base dressing (K1): barrels of herbs, a crate of phials, a
    stone mortar, glowing toadstools and pumpkins."""
    X, Y, Z = coords(g)
    for bx, bz, h, r in ((X1 + 2, Z0 - 14, 15, 6), (X1 - 8, Z0 - 17, 12, 5), (X0 - 10, Z1 + 6, 13, 6)):
        bm = barrel(g, bx, bz, 0, h, r, ramp="wood", hoop="gray", base=4)
        P.flat(g, bm & (Y > h - 2), "moss", 5)
        P.flat(g, bm & (Y > h - 1) & (((X + Z).astype(int) % 3) == 0), "toxic", 5)
    crate(g, X0 - 14, 0, Z0 + 2, 13, ramp="wood", frame="wood", base=4, seed=22)
    cr = box(g, X0 - 12, 13, Z0 + 4, X0 - 3, 17, Z0 + 13, "toxic", 5)
    P.flat(g, cr & (((X + Z).astype(int) % 3) == 0), "magenta", 5)
    P.flat(g, cr & (((X * 2 + Z).astype(int) % 5) == 0), "gold", 5)
    mx, mz = X0 + 16, Z0 - 22  # a stone mortar and its pestle
    S.cone(g, "y", mx, mz, 3.0, 0, 7, "gray", 5, r_top=5.0)
    P.flat(g, S.last(g) & (Y > 5), "gray", 6)
    S.disc(g, "y", mx, mz, 4.0, 6, 7, "moss", 4)
    S.bar(g, "z", (mx + 1, 6), (mx + 6, 13), 2.0, mz - 1, mz + 1, "wood", 5)
    for tx, tz, h, r in ((X0 - 6, Z0 + 44, 8, 4.5), (X0 - 14, Z0 + 36, 6, 3.2), (X1 + 7, Z1 - 4, 7, 4.0)):
        mushroom(g, tx, 0, tz, h=h, r=r, cap=("toxic", 6), stem=("bone", 6))
    pumpkin(g, X1 + 10, 0, Z0 - 28, w=11, h=9, seed=23)
    pumpkin(g, X0 - 19, 0, Z0 + 22, w=10, h=8, seed=24)


def shop() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    plinth(g, X0, Z0, X1, Z1, h=5, out=3, seed=1)
    stone(g, X0, 5, Z0, X1, FLOOR1, Z1, "gray", 5, seed=2)
    piers(g, X0, X1, Z0, Z1, 5, FLOOR1, size=5, seed=3)
    # the jettied upper storey: pale plaster in a thick timber frame
    ux0, ux1, uz0 = X0 - JET, X1 + JET, Z0 - JET
    up = box(g, ux0, FLOOR1, uz0, ux1, WALL, Z1, "bone", 5)
    P.mottle(g, up, "bone", 5, cell=3, seed=4)
    corner = ((np.abs(X - ux0 - 1.5) < 1.6) | (np.abs(X - ux1 + 1.5) < 1.6)) & ((np.abs(Z - uz0 - 1.5) < 1.6) | (np.abs(Z - Z1 + 1.5) < 1.6))
    frame = up & ((Y < FLOOR1 + 3) | (Y > WALL - 3) | corner | (np.abs(Y - 64) < 1.1))
    P.planks(g, frame, "wood", 4, width=3, across="y", nails=True, seed=5)
    for x in range(int(ux0) + 3, int(ux1) - 3, 8):  # joists under the jetty
        j = box(g, x, FLOOR1 - 3, uz0, x + 3, FLOOR1, Z0, "wood", 4)
        P.flat(g, j & (Z < uz0 + 1), "wood", 6)
    for a, b in (((ux0 + 3, FLOOR1 + 3), (ux0 + 16, WALL - 3)), ((ux1 - 3, FLOOR1 + 3), (ux1 - 16, WALL - 3))):
        S.bar(g, "z", a, b, 3, uz0 - 1, uz0, "wood", 4)  # proud braces (true slopes)
    for k, hx in enumerate((ux0 + 10, ux0 + 20, ux1 - 22, ux1 - 12)):  # herb bundles under the jetty
        box(g, hx, FLOOR1 - 4, uz0 - 2, hx + 1, FLOOR1 - 3, uz0 - 1, "wood", 3)
        hb = box(g, hx - 2, FLOOR1 - 12 - (k % 2) * 3, uz0 - 3, hx + 3, FLOOR1 - 4, uz0, "moss", 4)
        P.flat(g, hb & (Y < FLOOR1 - 9), "moss", 5)
        P.flat(g, hb & (((X + Z).astype(int) % 3) == 0), "moss", 6)
        P.flat(g, hb & (Y > FLOOR1 - 6), "sand", 4)
    # upper windows: leaded magenta glass in light stone frames
    for u in (CXM - 27, CXM + 6):
        pane = box(g, u, 54, uz0 - 1, u + 21, 72, uz0, "magenta", 5)
        P.flat(g, pane & ((((X - u).astype(int) % 5) == 0) | (((Y.astype(int) + 1) % 5) == 0)), "wood", 3)
        P.flat(g, pane & (Y > 68), "magenta", 6)
        fr = box(g, u - 2, 52, uz0 - 2, u + 23, 54, uz0, "gray", 6) | box(g, u - 2, 72, uz0 - 2, u + 23, 74, uz0, "gray", 6)
        fr |= box(g, u - 2, 54, uz0 - 2, u, 72, uz0, "gray", 6) | box(g, u + 21, 54, uz0 - 2, u + 23, 72, uz0, "gray", 6)
        P.stone(g, fr, "gray", 6, block=(5, 3), seed=6)
    lancet(g, "-x", ux0, Z0 + 16, Z0 + 28, 52, 76, glass="toxic", shade=5, seed=7)
    lancet(g, "+x", ux1, Z0 + 32, Z0 + 44, 52, 76, glass="magenta", shade=5, seed=8)
    # the very steep front gable (rule F4) with light stone barge boards
    roof = gable_roof(g, ux0, ux1, uz0, Z1, WALL, RIDGE, ramp="purple", thick=5, overhang=6, trim="gray", gable="bone", ridge="z", trim_shade=6, seed=9)
    roof_paint(g, roof, "z", 10)
    P.mottle(g, roof["attic"], "bone", 5, cell=3, seed=11)
    P.planks(g, roof["attic"] & ((np.abs(X - CXM) < 1.6) | (Y < WALL + 3) | (np.abs(Y - (WALL + 20)) < 1.1)), "wood", 4, width=3, across="y", nails=False, seed=12)
    lancet(g, "-z", uz0, CXM - 7, CXM + 7, 92, 114, glass="toxic", shade=5, seed=13)
    for s in (-1, 1):  # gold pinnacles on the gable shoulders
        S.cone(g, "y", CXM + s * 36, Z0 - 4, 3.0, WALL + 2, WALL + 14, "gold", 4, n=4)
        P.flat(g, S.last(g) & (Y > WALL + 10), "gold", 6)
    # the leaning chimney: a stone frustum with a light cap and a lit flue
    cx, cy, cz = CHIM
    g.prism("y", [(cx - 7, cz - 7), (cx + 7, cz - 7), (cx + 7, cz + 7), (cx - 7, cz + 7)], cy - 40, cy, C("stone", 5),
            top=[(cx - 10, cz - 6), (cx + 4, cz - 6), (cx + 4, cz + 6), (cx - 10, cz + 6)])
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(5, 3), frame=fr, seed=20))
    stone(g, cx - 12, cy, cz - 8, cx + 6, cy + 4, cz + 8, "gray", 6, block=(6, 2), seed=21)
    g.box(cx - 9, cy + 3, cz - 4, cx - 1, cy + 4, cz + 4, C("toxic", 6))
    turret(g)
    shopfront(g)
    flask(g)
    props(g)
    P.grime(g, (g.a > 0) & (Y < 10) & ~g.solid_mask(), height=4, seed=25)
    return g


def bracket() -> Grid:
    """A wrought-iron arm out over the door with a curled brace."""
    g = Grid(W, H, D)
    bx, by, bz = BRACKET
    box(g, bx - 1, by - 3, bz - 18, bx + 1, by, bz + 1, "gray", 3)
    box(g, bx - 2, by - 7, bz - 1, bx + 2, by + 3, bz + 2, "gray", 4)
    S.bar(g, "x", (by - 2, bz - 1), (by - 13, bz - 12), 2, bx - 1, bx + 1, "gray", 3)
    box(g, bx - 1.5, by, bz - 19, bx + 1.5, by + 3, bz - 16, "gold", 5)
    return g


def sign() -> Grid:
    """The shop board: a shaped plank sign with a dark rim, a pale panel
    and a painted magenta drop on both faces, on two iron links."""
    g = Grid(W, H, D)
    sx, sy, sz = SIGN_TOP
    _X, Y, Z = coords(g)
    top = sy - 5
    poly = [(sz - 10, top - 24), (sz - 7, top - 28), (sz + 7, top - 28), (sz + 10, top - 24), (sz + 10, top), (sz - 10, top)]
    g.prism("x", [(v, u) for u, v in poly], sx - 1.5, sx + 1.5, C("wood", 5))
    m = S.last(g)
    P.planks(g, m, "wood", 5, width=4, across="y", length=(40, 41), nails=False, seed=26)
    panel = m & (np.abs(Z - sz) < 8) & (Y > top - 24) & (Y < top - 2)
    P.flat(g, panel, "bone", 6)
    P.mottle(g, panel, "bone", 6, cell=2, seed=27)
    P.outline(g, m, "wood", 3, normal="x")
    iw, _ih = pnglyph.icon_size("drop")
    for face, plane in (("-x", sx - 1.5), ("+x", sx + 1.5)):
        pnglyph.icon(g, face, plane, int(round(sz - iw / 2)), int(top - 20), "drop", "magenta", 5, reach=2, depth=2)
    for dz in (-6, 6):
        box(g, sx - 1, top, sz + dz - 1, sx + 1, sy, sz + dz + 1, "gray", 4)
    return g


def build() -> Asset:
    root = parts(
        {"shop": shop(), "bracket": bracket(), "sign": sign()},
        [("shop", None, (0.0, 0.0, 0.0)), ("bracket", "shop", BRACKET), ("sign", "bracket", SIGN_TOP)],
    )
    swing = [(0.0, (0.0, 0.0, 0.0)), (0.9, (0.0, 0.0, 8.0)), (1.8, (0.0, 0.0, 0.0)), (2.7, (0.0, 0.0, -8.0)), (3.6, (0.0, 0.0, 0.0))]
    cx, cy, cz = CHIM
    fx, fy, fz = FLASK
    return Asset(
        id="monster-buildings-potion-shop", pack="monster", category="buildings", name="Potion Shop", root=root,
        clips=[Clip("idle", {"sign": {"rot": swing}})],
        sockets=[Socket("socket-chimney", at=(cx - 5, cy + 4, cz), parent="shop"),
                 Socket("socket-flask", at=(fx, fy + FLASK_H + 3, fz), parent="shop")],
        pfx=[{"effectId": "rvx-monster-witch-smoke", "socket": "socket-chimney", "trigger": "idle", "size": 40},
             {"effectId": "rvx-monster-witch-brew", "socket": "socket-flask", "trigger": "idle", "size": 20}],
    )
