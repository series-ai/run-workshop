"""Training dummy in the Pirate Nation style.

A caricature (rule F4): a fat straw body (a bellied octagon, true slopes)
bound with rope on a thick post, a big burlap head with a stitched face
(cross eyes and a grin), a crooked wooden arm bar (rule F5), a battered
red shield hung on one arm and two arrows stuck in the belly. Detail is
paint (rule S1). About 24 wide and 34 tall.
"""

import numpy as np

import paint as P
from _props import burlap, coords, heater
from pnkit import box
from pnshapes import bar, flat_ngon, last, rotate
from voxgrid import C, Asset, Grid, Part

W, H, D = 30, 38, 24
CX, CZ = 15, 13


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # base: a cross foot and a thick post
    for x0, z0, x1, z1 in ((CX - 7, CZ - 1.5, CX + 7, CZ + 1.5), (CX - 1.5, CZ - 7, CX + 1.5, CZ + 7)):
        f = box(g, x0, 0, z0, x1, 2, z1, "darkwood", 4)
        P.planks(g, f, "darkwood", 4, width=2, across="y", seed=1)
    post = box(g, CX - 1.5, 2, CZ - 1.5, CX + 1.5, 12, CZ + 1.5, "wood", 5)
    P.planks(g, post, "wood", 5, width=3, across="x", nails=False)
    # the straw body: two frustums, rope bands
    g.prism("y", flat_ngon(CX, CZ, 4.5, 8), 10, 17, C("gold", 6), top=flat_ngon(CX, CZ, 6.5, 8))
    body = last(g)
    g.prism("y", flat_ngon(CX, CZ, 6.5, 8), 17, 24, C("gold", 6), top=flat_ngon(CX, CZ, 4.5, 8))
    body |= last(g)
    P.thatch(g, body, "gold", 6, band=4, frame="wall", seed=2)
    for ry in (12, 21):
        P.flat(g, body & (Y > ry) & (Y < ry + 1.1), "darkwood", 4)
    P.flat(g, body & (Y > 23), "gold", 7)
    # the burlap head: a chunky block with a stitched face
    head = box(g, CX - 4.5, 24, CZ - 4, CX + 4.5, 32, CZ + 4, "wood", 6)
    burlap(g, head, "wood", 6, seed=3)
    face = head & (Z < CZ - 3)
    for ex in (CX - 2.5, CX + 2.5):
        P.flat(g, face & (np.abs(np.abs(X - ex) - np.abs(Y - 29.5)) < 0.6) & (np.abs(X - ex) < 1.6) & (np.abs(Y - 29.5) < 1.6), "darkwood", 3)
    P.flat(g, face & (np.abs(Y - 26.5) < 0.6) & (np.abs(X - CX) < 3), "darkwood", 3)
    P.flat(g, face & (np.abs(Y - 26.5) < 1.6) & (np.abs(X - CX) < 3) & (np.floor(X) % 2 == 0), "darkwood", 3)
    box(g, CX - 3, 32, CZ - 2, CX + 3, 33, CZ + 2, "darkwood", 4)
    box(g, CX - 2, 33, CZ - 1, CX + 2, 35, CZ + 1, "gold", 6)
    # the arm bar, tilted, through the shoulders
    pts = rotate([(CX - 12, 19), (CX + 12, 19), (CX + 12, 22), (CX - 12, 22)], CX, 20.5, 8)
    g.prism("z", pts, CZ - 1.5, CZ + 1.5, C("wood", 5))
    arm = last(g)
    P.planks(g, arm, "wood", 5, width=3, across="y", nails=True, seed=4)
    # a battered red shield hung on the left arm
    sh = heater(g, CX - 9, 8, CZ - 5, 8, 11, t=2, field=("red", 4), rim=("darkwood", 3), lean=12.0)
    P.flat(g, sh & (np.abs((X - CX + 9) + (Y - 14)) < 0.6), "red", 2)  # a slash
    # arrows stuck in the belly
    for ax, ay, dz in ((CX + 2, 16, 5), (CX - 2, 19, 4)):
        bar(g, "x", (ay, CZ - 5.5), (ay + 1.5, CZ - 5.5 - dz), 1.2, ax - 0.6, ax + 0.6, "wood", 6)
        box(g, ax - 1, int(ay + 1), int(CZ - 6 - dz), ax + 1, int(ay + 3), int(CZ - 4 - dz), "red", 5)
    root = Part("training-dummy", g)
    return Asset(id="fantasy-props-training-dummy", pack="fantasy", category="props", name="Training Dummy", root=root)
