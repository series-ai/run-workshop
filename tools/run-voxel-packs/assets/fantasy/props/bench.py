"""Tavern settle bench in the Pirate Nation style.

Two thick pale end panels with an arched foot and an arm that slopes up to
the back post (true slopes, rule F2) carry a planked seat. The back is one
big painted board: a flame-red field with a cream band and an oversized
gold crown (rules F4 and C3), framed in dark timber under a tiled crest
with gold ball finials. A blue blanket and a tankard sit on the seat
(rule F5). About 38 long and 30 tall.
"""

import numpy as np

import paint as P
import pnglyph
from _props import coords, plank_box
from pnkit import box
from pnshapes import disc, facets, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 38, 32, 17
PX = (2, 32)  # end panel x starts (4 thick)
X0, X1 = 6, 32  # seat span between the panels
SEAT = 11  # seat top
ZF, ZB = 2, 15  # front and back of the bench
BTOP = 25  # top of the back boards

CROWN = [  # 13 x 7, rows top to bottom: four spikes over a jewelled band
    "#..#..#..#..#",
    "#..#..#..#..#",
    "##.###.###.##",
    "#############",
    "#-#-#+#-#-#-#",
    ".###########.",
    "..#########..",
]


def end_panel(g: Grid, x0: int) -> np.ndarray:
    """A plank end panel: two feet with an arched gap, an arm that slopes
    up to a tall back post."""
    poly = [
        (0, ZF), (0, ZF + 3), (2, ZF + 4), (3, ZF + 6), (2, ZF + 8), (0, ZF + 9), (0, ZB),
        (BTOP, ZB), (BTOP, ZB - 3), (18, ZB - 5), (18, ZF),
    ]
    g.prism("x", poly, x0, x0 + 4, C("wood", 6))
    m = last(g)
    P.planks(g, m, "wood", 6, width=5, across="y", frame="x", nails=False, seed=x0)
    _X, Y, Z = coords(g)
    P.flat(g, m & (Y > 16) & (Z < ZB - 4), "wood", 7)  # the arm, rubbed pale
    P.flat(g, m & (Y < 3), "wood", 4)  # feet in shadow
    P.outline(g, m, "darkwood", 3, normal="x")
    return m


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    end_panel(g, PX[0])
    end_panel(g, PX[1])

    # the seat, its apron and a pegged stretcher
    plank_box(g, X0, SEAT - 3, ZF, X1, SEAT, ZB, "wood", 7, across="y", width=4, seed=3)
    apron = box(g, X0, SEAT - 6, ZF, X1, SEAT - 3, ZF + 2, "wood", 5)
    P.planks(g, apron, "wood", 5, width=3, across="y", frame="z", nails=False, seed=4)
    P.outline(g, apron, "darkwood", 3, normal="z")
    rail = box(g, X0, 4, ZF + 5, X1, 7, ZF + 8, "wood", 5)
    P.planks(g, rail, "wood", 5, width=3, across="y", frame="z", nails=False, seed=5)
    for px in (X0 + 1, X1 - 2):  # iron pegs where the stretcher meets a panel
        P.flat(g, rail & (np.abs(X - px - 0.5) < 1.1) & (np.abs(Y - 5.5) < 1.1), "iron", 4)

    # the back: one painted board panel, the bright face of the bench
    back = box(g, X0, SEAT, ZB - 3, X1, BTOP, ZB, "bone", 6)
    P.planks(g, back, "bone", 6, width=4, across="x", nails=False, grain=False, seed=6)
    # a broad flame-red band with an oversized gold crown: the bright face
    band = back & (Y > SEAT + 2) & (Y < SEAT + 11)
    P.flat(g, band, "red", 5)
    P.flat(g, back & ((Y == SEAT + 2) | (Y == SEAT + 11)), "gold", 5)
    P.flat(g, back & ((Y < SEAT + 1) | (Y > BTOP - 2)), "darkwood", 3)
    P.flat(g, back & ((X < X0 + 1) | (X > X1 - 1)), "darkwood", 3)
    legend = {"#": C("gold", 6), "+": C("gold", 7), "-": C("red", 3)}
    for face, plane in (("-z", ZB - 3), ("+z", ZB)):
        pnglyph.stamp(g, face, plane, 12, SEAT + 4, CROWN, legend, 1, 2, 2)

    # the crest: a tiled cap with a raised middle and gold ball finials
    g.prism("z", [(PX[0], BTOP), (PX[1] + 4, BTOP), (PX[1] + 4, BTOP + 2), (25, BTOP + 2), (22, BTOP + 4), (16, BTOP + 4), (13, BTOP + 2), (PX[0], BTOP + 2)],
            ZB - 4, ZB + 1, C("rust", 6))
    crest = last(g)
    for m, fr in facets(g, g.solids[-1:]):
        P.tiles(g, m, "rust", 6, row=2, width=4, frame=fr, seed=7)
    P.outline(g, crest, "darkwood", 3, normal="z")
    for fx in (PX[0] + 2, PX[1] + 2):
        ball = disc(g, "y", fx, ZB - 1.5, 2.2, BTOP + 2, BTOP + 5, "gold", 5, n=6)
        P.flat(g, ball & (Y > BTOP + 3), "gold", 6)
        P.flat(g, ball & (Y < BTOP + 3), "gold", 4)

    # a folded blue blanket with a gold hem on the right of the seat
    bl = box(g, 20, SEAT, ZF + 1, 30, SEAT + 3, ZB - 3, "blue", 4)
    P.mottle(g, bl, "blue", 4, cell=2, seed=9)
    P.outline(g, bl, "gold", 6, normal="y")
    P.flat(g, bl & (Y > SEAT + 2) & (np.floor(X).astype(int) % 4 == 0), "blue", 3)  # folds

    # a tankard of ale with a frothy head on the left
    mug = disc(g, "y", 11.5, ZF + 5.5, 2.4, SEAT, SEAT + 6, "steel", 6, n=8)
    P.flat(g, mug & (Y > SEAT + 4), "bone", 7)
    P.flat(g, mug & (Y > SEAT + 2) & (Y < SEAT + 4), "gold", 4)  # the ale band
    P.flat(g, mug & (Y < SEAT + 1), "steel", 4)
    handle = box(g, 14, SEAT + 2, ZF + 5, 15, SEAT + 5, ZF + 7, "steel", 5)
    P.flat(g, handle, "steel", 5)

    root = Part("bench", g)
    return Asset(id="fantasy-props-bench", pack="fantasy", category="props", name="Tavern Bench", root=root)
