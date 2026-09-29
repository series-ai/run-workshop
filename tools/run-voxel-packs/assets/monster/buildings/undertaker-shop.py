"""Undertaker's shop, in the Pirate Nation haunted style.

A narrow shopfront: a grey stone ground storey with a big display window
glowing magenta (an upright coffin painted behind the glass), a pointed
door and a lantern, then a jettied timber-framed upper storey with pale
plaster, proud braces (true slopes), toxic-green windows and a very steep
purple slate front gable with a horned cross. A crooked chimney leans off
the back slope. The function prop is oversized (rules F4, F6): a big
coffin-shaped sign that hangs from a wrought-iron bracket and swings on
`idle`. Stacked coffins, a coffin standing by the door and pumpkins
finish it. Faces -Z.
"""

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import coffin, coffin_poly, coords, opening, parts, piers, plinth, pointed, roof_paint, stone
from _pn import cross, lancet, pumpkin
from pnkit import box, gable_roof
from voxgrid import C, Asset, Clip, Grid, Socket, _inside_polygon

W, H, D = 112, 136, 100
X0, X1, Z0, Z1 = 34, 80, 36, 84  # ground storey walls
JET = 4  # the upper storey juts out this far at the front and sides
FLOOR1, WALL = 44, 80
RIDGE = 118
CHIM = (72.0, 88.0, 70.0)  # chimney foot centre (x, y, z)
BRACKET = (X0 - 1.0, 68.0, Z0 - JET - 1.0)  # where the bracket meets the wall
SIGN_TOP = (X0 - 1.0, 64.0, Z0 - JET - 20.0)  # the sign hangs from here


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
    frame = up & ((Y < FLOOR1 + 3) | (Y > WALL - 3) | corner | (np.abs(Y - 62) < 1.1))
    posts = up & ((np.abs(X - (X0 + X1) / 2) < 1.6) & (Z < uz0 + 1))
    P.planks(g, frame | posts, "wood", 4, width=3, across="y", nails=True, seed=5)
    # joists under the jetty
    for x in range(int(ux0) + 2, int(ux1) - 2, 6):
        j = box(g, x, FLOOR1 - 3, uz0, x + 3, FLOOR1, Z0, "wood", 4)
        P.flat(g, j & (Z < uz0 + 1), "wood", 6)
    # proud braces on the front, true slopes
    for (a, b) in (((ux0 + 3, FLOOR1 + 3), (ux0 + 14, WALL - 3)), ((ux1 - 3, FLOOR1 + 3), (ux1 - 14, WALL - 3))):
        S.bar(g, "z", a, b, 3, uz0 - 1, uz0, "wood", 4)
    # upper windows: lit toxic green with light stone frames
    cxm = (X0 + X1) / 2
    for u in (cxm - 16, cxm + 7):
        pane = box(g, u, 54, uz0 - 1, u + 9, 70, uz0, "toxic", 5)
        P.flat(g, pane & ((np.abs(X - u - 4.5) < 0.6) | (np.abs(Y - 62) < 0.6)), "wood", 3)
        P.flat(g, pane & (Y > 67), "toxic", 6)
        sh = box(g, u - 4, 54, uz0 - 1, u - 1, 70, uz0, "purple", 3) | box(g, u + 10, 54, uz0 - 1, u + 13, 70, uz0, "purple", 3)
        P.planks(g, sh, "purple", 3, width=3, across="x", length=(40, 41), nails=False, seed=6)
        box(g, u - 1, 52, uz0 - 3, u + 10, 54, uz0, "wood", 4)
    lancet(g, "+x", ux1, Z0 + 14, Z0 + 24, 52, 74, glass="toxic", shade=5, seed=7)
    lancet(g, "-x", ux0, Z0 + 20, Z0 + 30, 52, 74, glass="magenta", shade=5, seed=8)
    # the steep front gable roof and a horned cross
    roof = gable_roof(g, ux0, ux1, uz0, Z1, WALL, RIDGE, ramp="purple", thick=5, overhang=5, trim="gray", gable="bone", ridge="z", trim_shade=6, seed=9)
    roof_paint(g, roof, "z", 10)
    P.mottle(g, roof["attic"], "bone", 5, cell=3, seed=11)
    P.planks(g, roof["attic"] & ((np.abs(X - cxm) < 1.6) | (Y < WALL + 3)), "wood", 4, width=3, across="y", nails=False, seed=12)
    lancet(g, "-z", uz0, cxm - 5, cxm + 5, 86, 104, glass="magenta", shade=5, seed=13)
    cross(g, cxm, RIDGE + 8, uz0 - 4, h=16, arm=5)
    # ground storey: the big display window with a painted coffin, the door
    wu0, wu1 = X0 + 5, X0 + 26
    win = box(g, wu0, 12, Z0 - 1, wu1, 38, Z0, "magenta", 5)
    P.flat(g, win & (Y > 32), "magenta", 6)
    cu = (wu0 + wu1) / 2 + 0.5
    cof = win & _inside_polygon(X, Y, coffin_poly(cu, 14, 11, 22))
    P.flat(g, cof, "wood", 5)
    P.flat(g, cof & _inside_polygon(X, Y, coffin_poly(cu, 16, 7, 18)), "purple", 3)
    P.flat(g, cof & (np.abs(X - cu) < 0.6) & (Y > 21) & (Y < 32), "gold", 5)
    P.flat(g, cof & (np.abs(Y - 28.5) < 0.6) & (np.abs(X - cu) < 2.6), "gold", 5)
    wf = box(g, wu0 - 2, 10, Z0 - 2, wu1 + 2, 12, Z0, "gray", 6) | box(g, wu0 - 2, 38, Z0 - 2, wu1 + 2, 41, Z0, "gray", 6)
    wf |= box(g, wu0 - 2, 12, Z0 - 2, wu0, 38, Z0, "gray", 6) | box(g, wu1, 12, Z0 - 2, wu1 + 2, 38, Z0, "gray", 6)
    wf |= box(g, cu - 1, 12, Z0 - 2, cu + 1, 38, Z0, "gray", 6)
    P.stone(g, wf, "gray", 6, block=(5, 3), seed=14)
    du = X1 - 13
    opening(g, "-z", Z0, pointed(du - 8, du + 8, 5, 36), glow=("magenta", 6), deep=("purple", 3))
    leaf = box(g, du - 7, 5, Z0 - 2, du + 7, 26, Z0 - 1, "purple", 3)
    P.planks(g, leaf, "purple", 3, width=3, across="x", length=(40, 41), nails=True, seed=15)
    box(g, du + 3, 15, Z0 - 3, du + 5, 18, Z0 - 2, "gold", 5)
    # the crooked chimney: a leaning stone frustum with a light cap
    cx, cy, cz = CHIM
    g.prism("y", [(cx - 6, cz - 6), (cx + 6, cz - 6), (cx + 6, cz + 6), (cx - 6, cz + 6)], cy, cy + 38, C("stone", 5), top=[(cx - 1, cz - 5), (cx + 9, cz - 5), (cx + 9, cz + 5), (cx - 1, cz + 5)])
    ch = [g.solids[-1]]
    S.paint_facets(g, ch, lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(5, 3), frame=fr, seed=17))
    stone(g, cx - 3, cy + 38, cz - 7, cx + 11, cy + 42, cz + 7, "gray", 6, block=(6, 2), seed=18)
    g.box(cx + 1, cy + 41, cz - 3, cx + 7, cy + 42, cz + 3, C("toxic", 6))
    # props: stacked coffins, a coffin by the door, pumpkins (K1)
    coffin(g, 13, 8, 12, 28, 0, 7, pose="z", seed=19)
    coffin(g, 26, 8, 12, 28, 0, 7, pose="z", seed=20)
    coffin(g, 19.5, 10, 11, 25, 7, 13, pose="z", lid=("magenta", 3), seed=21)
    coffin(g, X1 + 9, 0, 12, 32, Z0 - 9, Z0 - 3, pose="up", seed=22)
    pumpkin(g, X1 + 22, 0, Z0 - 14, w=12, h=9, seed=23)
    pumpkin(g, X1 + 20, 0, Z0 - 2, w=9, h=7, seed=24)
    P.grime(g, (g.a > 0) & (Y < 12) & ~g.solid_mask(), height=4, seed=25)
    return g


def bracket() -> Grid:
    """A wrought-iron arm out of the front corner with a curled brace."""
    g = Grid(W, H, D)
    bx, by, bz = BRACKET
    box(g, bx - 1, by - 3, bz - 23, bx + 1, by, bz + 1, "gray", 3)
    box(g, bx - 2, by - 6, bz, bx + 2, by + 3, bz + 2, "gray", 4)
    S.bar(g, "x", (by - 14, bz + 1), (by - 2, bz - 14), 2, bx - 1, bx + 1, "gray", 3)
    box(g, bx - 1.5, by, bz - 24, bx + 1.5, by + 3, bz - 21, "gold", 5)
    return g


def sign() -> Grid:
    """The oversized coffin sign: a six-sided board (true slopes), a dark
    rim, a pale panel with RIP painted on both faces, two chain links."""
    g = Grid(W, H, D)
    sx, sy, sz = SIGN_TOP
    X, Y, Z = coords(g)
    top = sy - 4
    poly = coffin_poly(sz, top - 32, 22, 32)
    g.prism("x", [(v, u) for u, v in poly], sx - 1.5, sx + 1.5, C("wood", 5))
    m = S.last(g)
    P.planks(g, m, "wood", 5, width=3, across="z", length=(40, 41), nails=False, seed=26)
    inner = m & _inside_polygon(Z, Y, coffin_poly(sz, top - 30, 18, 28))
    P.flat(g, inner, "bone", 6)
    P.outline(g, m, "wood", 3, normal="x")
    tw, th = pnglyph.text_size("RIP")
    for face, plane in (("-x", sx - 1.5), ("+x", sx + 1.5)):
        pnglyph.text(g, face, plane, int(round(sz - tw / 2)), int(top - 12), "RIP", "purple", 2)
        pnglyph.icon(g, face, plane, int(round(sz - 3.5)), int(top - 24), "cross", "gold", 4, reach=1)
    for dz in (-5, 5):
        box(g, sx - 1, top, sz + dz - 1, sx + 1, sy, sz + dz + 1, "gray", 4)
    return g


def build() -> Asset:
    root = parts(
        {"shop": shop(), "bracket": bracket(), "sign": sign()},
        [("shop", None, (0.0, 0.0, 0.0)), ("bracket", "shop", BRACKET), ("sign", "bracket", SIGN_TOP)],
    )
    swing = [(0.0, (0.0, 0.0, 9.0)), (0.9, (0.0, 0.0, 0.0)), (1.8, (0.0, 0.0, -9.0)), (2.7, (0.0, 0.0, 0.0)), (3.6, (0.0, 0.0, 9.0))]
    cx, cy, cz = CHIM
    return Asset(
        id="monster-buildings-undertaker-shop", pack="monster", category="buildings", name="Undertaker's Shop", root=root,
        clips=[Clip("idle", {"sign": {"rot": swing}})],
        sockets=[Socket("socket-chimney", at=(cx + 4, cy + 42, cz), parent="shop")],
        pfx=[{"effectId": "rvx-monster-ghost-smoke", "socket": "socket-chimney", "trigger": "idle", "size": 30}],
    )
