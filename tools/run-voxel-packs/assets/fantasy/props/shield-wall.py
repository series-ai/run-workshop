"""Shield wall in the Pirate Nation style.

Three oversized round shields lean on a thick timber rail, each painted in
bold radial quarters with an iron rim and a steel boss (rules F4 and K3):
royal blue and cream, flame red and gold, gold and blue. Two pennants hang
from the top beam behind them, and a crested helm and a war axe stand at
the foot. About 38 wide and 30 tall.
"""

import math

import numpy as np

import paint as P
from _props import coords, plank_box
from pnkit import box
from pnshapes import cone, disc, last, rotate
from voxgrid import C, Asset, Grid, Part

W, H, D = 38, 32, 18
ZS0, ZS1 = 5, 8  # the shield plane
SHIELDS = (
    (9, 10, 8.4, ("blue", 4), ("bone", 7)),
    (19, 11, 8.8, ("red", 5), ("gold", 6)),
    (29, 10, 8.4, ("bone", 7), ("blue", 4)),
)


def shield(g: Grid, cx: float, cy: float, r: float, field, quarter) -> None:
    """A round shield facing -z: radial quarters, an iron rim, a steel boss."""
    X, Y, Z = coords(g)
    m = disc(g, "z", cx, cy, r, ZS0, ZS1, *field, n=10)
    rr = np.hypot(X - cx, Y - cy)
    ang = np.arctan2(Y - cy, X - cx)
    sector = np.floor((ang + math.pi) / (2 * math.pi) * 8).astype(int)
    P.flat(g, m & (sector % 2 == 0), *quarter)
    P.flat(g, m & (rr > r - 1.3), "iron", 5)
    P.flat(g, m & (rr > r - 2.2) & (rr < r - 1.3), "gold", 5)
    P.flat(g, m & (rr < 3.0) & (rr > 2.2), "iron", 5)
    boss = cone(g, "z", cx, cy, 2.4, ZS0 - 2, ZS0 + 1, "steel", 6, n=8, r_top=1.2, tip="lo")
    P.flat(g, boss & (Z < ZS0 - 1), "steel", 7)
    P.flat(g, boss & (Z > ZS0 - 1), "steel", 4)


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # two pennants hanging from the top beam, behind the shields
    for px, main, trim in ((7, "blue", "gold"), (23, "red", "bone")):
        g.prism("z", [(px, 25), (px + 8, 25), (px + 8, 15), (px + 4, 18), (px, 15)], 13, 14, C(main, 5))
        flag = last(g)
        P.flat(g, flag & ((Xi // 3) % 2 == 1), main, 4)
        P.outline(g, flag, trim, 6, normal="z")

    # the frame: two posts, a sill, a leaning rail and a thick top beam
    for px in (0, 34):
        post = box(g, px, 0, 9, px + 4, 27, 15, "wood", 5)
        P.planks(g, post, "wood", 5, width=4, across="x", nails=False, seed=px)
        P.outline(g, post, "darkwood", 3)
        g.prism("z", [(px, 27), (px + 4, 27), (px + 2, 30)], 9, 15, C("darkwood", 5))
        P.flat(g, last(g), "wood", 5)
    sill = plank_box(g, 0, 0, 8, 38, 3, 16, "wood", 5, across="y", width=3, seed=1)
    P.flat(g, sill & (Yi < 1), "darkwood", 3)
    rail = box(g, 2, 15, 10, 36, 18, 14, "wood", 5)
    P.planks(g, rail, "wood", 5, width=3, across="y", frame="z", nails=True, seed=2)
    P.outline(g, rail, "darkwood", 3, normal="z")
    beam = box(g, 0, 24, 8, 38, 28, 16, "wood", 6)
    P.planks(g, beam, "wood", 6, width=3, across="y", frame="wall", nails=True, seed=3)
    P.outline(g, beam, "darkwood", 3)
    P.flat(g, beam & (Zi == 8) & (Yi > 24) & (Yi < 27) & ((Xi // 4) % 2 == 0), "red", 5)
    P.flat(g, beam & (Zi == 8) & (Yi > 24) & (Yi < 27) & ((Xi // 4) % 2 == 1), "bone", 7)

    for cx, cy, r, field, quarter in SHIELDS:
        shield(g, cx, cy, r, field, quarter)

    # a crested helm and a war axe standing at the foot
    helm = disc(g, "y", 19, 4, 3.4, 0, 6, "steel", 6, n=8)
    P.plates(g, helm, "steel", 6, size=(5, 4), rivets=True, frame="wall", seed=4)
    P.flat(g, helm & (Yi > 4), "steel", 7)
    P.flat(g, helm & (Yi == 3) & (Z < 2), "darkwood", 2)  # the visor slit
    P.flat(g, helm & (Yi > 5) & (np.abs(X - 19) < 1.2), "red", 5)  # the crest
    haft = box(g, 33, 0, 1, 35, 20, 3, "wood", 6)
    P.planks(g, haft, "wood", 6, width=2, across="y", frame="z", nails=False, seed=5)
    P.outline(g, haft, "darkwood", 3, normal="z")
    P.flat(g, haft & (Yi > 14) & (Yi < 19), "red", 5)
    g.prism("z", rotate([(30, 14), (36, 12), (37, 17), (34, 21), (30, 19)], 34, 16, 0), 1, 3, C("steel", 6))
    head = last(g)
    P.plates(g, head, "steel", 6, size=(5, 4), rivets=False, frame="z", seed=6)
    P.flat(g, head & (X < 32.0), "steel", 7)
    P.outline(g, head, "steel", 3, normal="z")

    root = Part("shield-wall", g)
    return Asset(id="fantasy-props-shield-wall", pack="fantasy", category="props", name="Shield Wall", root=root)
