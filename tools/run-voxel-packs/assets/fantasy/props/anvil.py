"""Smith's anvil in the Pirate Nation style.

One iconic shape (rule K3): a big blue-grey anvil with a tapered waist and
a long horn (true slopes) on a thick oak stump, a glowing hot ingot on its
face, a hammer resting across it and a quench bucket at the foot. Detail
is paint (rule S1). About 28 long and 21 tall.
"""

import numpy as np

import paint as P
from _props import coords
from pnkit import box, edges
from pnshapes import bar, disc, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 30, 23, 18
CX, CZ = 13, 9  # stump centre
SH = 8  # stump height


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # the stump: an octagon with bark sides and a ringed top
    stump = disc(g, "y", CX, CZ, 6.5, 0, SH, "wood", 4, n=8)
    P.planks(g, stump, "wood", 4, width=2, across="x", nails=False, seed=1)
    top = stump & (Y > SH - 1)
    rr = np.hypot(X - CX, Z - CZ)
    P.flat(g, top, "wood", 6)
    P.flat(g, top & (np.abs(rr - 2.5) < 0.5), "wood", 5)
    P.flat(g, top & (np.abs(rr - 4.6) < 0.5), "wood", 5)
    P.flat(g, top & (rr > 5.8), "darkwood", 4)
    # the anvil: a foot, a tapered waist and a thick face (steel, true slopes)
    y0 = SH
    g.prism("y", [(CX - 5, CZ - 4), (CX + 5, CZ - 4), (CX + 5, CZ + 4), (CX - 5, CZ + 4)], y0, y0 + 2, C("steel", 4))
    body = last(g)
    g.prism("y", [(CX - 5, CZ - 4), (CX + 5, CZ - 4), (CX + 5, CZ + 4), (CX - 5, CZ + 4)], y0 + 2, y0 + 6, C("steel", 4), top=[(CX - 3, CZ - 2), (CX + 3, CZ - 2), (CX + 3, CZ + 2), (CX - 3, CZ + 2)])
    body |= last(g)
    face = box(g, CX - 6, y0 + 6, CZ - 3, CX + 9, y0 + 11, CZ + 3, "steel", 5)
    body |= face
    # the horn: a frustum narrowing to a blunt point toward -x
    g.prism("x", [(y0 + 9.5, CZ - 0.6), (y0 + 11, CZ - 0.6), (y0 + 11, CZ + 0.6), (y0 + 9.5, CZ + 0.6)], CX - 13, CX - 6, C("steel", 5), top=[(y0 + 6.5, CZ - 3), (y0 + 11, CZ - 3), (y0 + 11, CZ + 3), (y0 + 6.5, CZ + 3)])
    horn = last(g)
    body |= horn
    P.flat(g, body, "steel", 4)
    P.flat(g, body & (Y > y0 + 10), "steel", 6)  # the worn, polished face
    P.flat(g, face & edges(face), "steel", 3)
    P.flat(g, horn & (Y > y0 + 10), "steel", 6)
    P.flat(g, face & (Y > y0 + 10) & (X > CX + 6) & (X < CX + 8) & (np.abs(Z - CZ) < 1), "steel", 2)  # hardy hole
    # a glowing hot ingot on the face
    ingot = box(g, CX - 2, y0 + 11, CZ - 2, CX + 3, y0 + 13, CZ + 1, "orange", 6)
    P.flat(g, ingot & (Y > y0 + 12), "gold", 7)
    P.flat(g, ingot & (X > CX + 1.5), "red", 5)
    # a hammer lying across the face, its handle over the edge
    head = box(g, CX + 3, y0 + 11, CZ + 1, CX + 6, y0 + 14, CZ + 4, "steel", 3)
    P.flat(g, head & (Y > y0 + 13), "steel", 5)
    handle = bar(g, "y", (CX + 5.5, CZ + 2.5), (CX + 14, CZ + 5), 1.8, y0 + 11.5, y0 + 13, "wood", 6)
    P.flat(g, handle & (X > CX + 12), "darkwood", 4)
    # a quench bucket at the foot, water catching the light
    bx, bz = CX + 11, CZ - 2
    bucket = disc(g, "y", bx, bz, 3.5, 0, 6, "wood", 5, n=8)
    P.planks(g, bucket, "wood", 5, width=2, across="x", nails=False, seed=4)
    P.flat(g, bucket & ((np.abs(Y - 1.5) < 0.5) | (np.abs(Y - 4.5) < 0.5)), "darkwood", 3)
    water = bucket & (Y > 5) & (np.hypot(X - bx, Z - bz) < 3.2)
    P.flat(g, water, "sky", 5)
    P.flat(g, water & (X < bx), "sky", 6)
    root = Part("anvil", g)
    return Asset(id="fantasy-props-anvil", pack="fantasy", category="props", name="Smith's Anvil", root=root)
