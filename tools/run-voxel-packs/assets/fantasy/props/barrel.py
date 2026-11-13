"""Oak barrel in the Pirate Nation style.

One iconic shape (rule K3): a bellied octagonal barrel built from two
frustums (true slopes), painted staves, two dark iron hoops and a lid of
boards with a candle stub. A brass tap on the front and a chalk mark are
paint and one small block. About 16 wide and 19 tall (PN chest: 18×15).
"""

import math

import numpy as np

import paint as P
from _props import candle, coords
from pnkit import box
from pnshapes import flat_ngon, last
from voxgrid import C, Asset, Grid, Part

W, H = 18, 26
CX = CZ = 9.0
R0, R1, BH = 6.5, 8.0, 19  # end radius, belly radius, height


def build() -> Asset:
    g = Grid(W, H, W)
    mid = BH / 2
    g.prism("y", flat_ngon(CX, CZ, R0, 8), 0, mid, C("wood", 5), top=flat_ngon(CX, CZ, R1, 8))
    body = last(g)
    g.prism("y", flat_ngon(CX, CZ, R1, 8), mid, BH, C("wood", 5), top=flat_ngon(CX, CZ, R0, 8))
    body |= last(g)
    X, Y, Z = coords(g)
    ang = np.arctan2(Z - CZ, X - CX)
    stave = np.floor((ang + math.pi) / (2 * math.pi) * 24).astype(int)
    shade = 5 + np.array([0, 1, 0, -1])[stave % 4]
    P._paint(g, body, "wood", shade)
    P.flat(g, body & (stave % 2 == 0) & (((Y * 7 + stave * 3).astype(int) % 11) == 0), "wood", 3)  # grain
    for hy in (2.5, 6.0, BH - 7.0, BH - 3.5):
        P.flat(g, body & (Y > hy) & (Y < hy + 1.8), "darkwood", 3)
    top = body & (Y > BH - 1)
    P.planks(g, top, "wood", 4, width=3, across="y", nails=True, frame="top", seed=3)
    rim = top & (np.maximum(np.abs(X - CX), np.abs(Z - CZ)) > R0 - 1.6)
    P.flat(g, rim, "darkwood", 3)
    P.flat(g, body & (Y < 1), "darkwood", 4)
    # chalk mark on the front staves and a brass tap under it
    front = body & (Z < CZ - R1 + 1.6)
    P.flat(g, front & (np.abs(np.abs(X - CX) - (Y - 9.5)) < 0.6) & (Y > 9) & (Y < 13.5), "bone", 7)
    tap = box(g, CX - 1, 4, CZ - R1 - 1.5, CX + 1, 6, CZ - R1 + 1, "gold", 5)
    P.flat(g, tap & (Y > 5), "gold", 7)
    candle(g, CX + 2, BH, CZ + 1, h=3, w=2)
    root = Part("barrel", g)
    return Asset(id="fantasy-props-barrel", pack="fantasy", category="props", name="Oak Barrel", root=root)
