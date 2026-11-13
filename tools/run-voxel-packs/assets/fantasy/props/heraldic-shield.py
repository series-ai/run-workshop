"""Heraldic shield display in the Pirate Nation style.

One iconic shape (rule K3): a big heater shield (a true-slope prism)
quartered royal blue and red with a gold cross, a gold rim and a gold
crown, over two crossed swords (true diagonals), on a thick oak post with
splayed feet. The shield hangs a little crooked (rule F5). About 30 wide
and 34 tall.
"""

import numpy as np

import paint as P
from _props import brace, coords, heater, sword
from pnkit import box
from voxgrid import Asset, Grid, Part

W, H, D = 32, 36, 14
CX, CZ = 16, 8


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # the stand: a post on two splayed feet and a cross foot
    post = box(g, CX - 1.5, 0, CZ - 1.5, CX + 1.5, 27, CZ + 1.5, "wood", 5)
    P.planks(g, post, "wood", 5, width=3, across="x", nails=False, seed=1)
    foot = box(g, CX - 8, 0, CZ - 2, CX + 8, 2, CZ + 2, "darkwood", 4)
    P.planks(g, foot, "darkwood", 4, width=2, across="y", seed=2)
    brace(g, "z", (CX - 7, 1.5), (CX - 1, 8), 2.2, CZ - 1, CZ + 1, "darkwood", 4)
    brace(g, "z", (CX + 7, 1.5), (CX + 1, 8), 2.2, CZ - 1, CZ + 1, "darkwood", 4)
    # two crossed swords behind the shield, points up and out
    sword(g, CX - 5, 9, CZ - 3, 25, t=1, tilt=28.0)
    sword(g, CX + 5, 9, CZ - 3, 25, t=1, tilt=-28.0)
    # the shield, quartered with a gold cross
    sh = heater(g, CX, 9, CZ - 6, 20, 24, t=3, field=("blue", 4), rim=("gold", 5), lean=-3.0, quarter=("red", 4))
    P.flat(g, sh & (np.abs(X - CX) < 1.3) & (Y > 12), "gold", 6)
    P.flat(g, sh & (np.abs(Y - 22.5) < 1.3), "gold", 6)
    P.outline(g, sh, "gold", 5, normal="z")
    from _props import glyph
    glyph(g, "-z", CZ - 6, CX - 4, 26, "crown", "gold", 6)
    root = Part("heraldic-shield", g)
    return Asset(id="fantasy-props-heraldic-shield", pack="fantasy", category="props", name="Heraldic Shield Display", root=root)
