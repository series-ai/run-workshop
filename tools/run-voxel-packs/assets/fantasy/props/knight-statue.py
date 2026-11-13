"""Knight statue in the Pirate Nation style.

A caricature bronze knight (rule F4; warm bronze like the PN golden tiki
statue) on a stepped stone plinth: big pauldrons, a flared tabard skirt
and chest (true-slope frustums), an oversized helm with a crest, both
hands resting on a greatsword planted point-down in front, and a shield on
the left arm. A gold plaque on the plinth, moss at its foot and a few
painted patina drips on the bronze (rule S1). About 22 wide and 44 tall.
"""

import numpy as np

import paint as P
from _props import coords, heater, stone_box, sword
from pnkit import box, edges
from pnshapes import flat_ngon, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 30, 48, 26
CX, CZ = 15, 13
PY = 9  # plinth top


def bronze(g: Grid, x0, y0, z0, x1, y1, z1, shade: int = 4):
    m = box(g, x0, y0, z0, x1, y1, z1, "gold", shade)
    P.flat(g, edges(m), "gold", shade - 1)
    return m


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    stone_box(g, CX - 11, 0, CZ - 10, CX + 11, 3, CZ + 10, "stone", 5, block=(6, 3), seed=1)
    plinth = stone_box(g, CX - 9, 3, CZ - 8, CX + 9, PY, CZ + 8, "stone", 6, block=(5, 3), seed=2)
    plaque = box(g, CX - 5, 4, CZ - 9, CX + 5, 8, CZ - 8, "gold", 5)
    P.outline(g, plaque, "gold", 3, normal="z")
    P.flat(g, plaque & (np.abs(Y - 6) < 0.6) & (np.abs(X - CX) < 3.5) & (np.floor(X) % 2 == 0), "gold", 3)
    P.flat(g, plinth & (Y < 4) & (P._hash(np.floor(X).astype(int), np.floor(Z).astype(int), seed=3) % np.uint64(3) == 0), "leaf", 4)
    # legs and feet
    for sx in (-1, 1):
        x0 = CX + sx * 3 - 2
        bronze(g, x0, PY, CZ - 2, x0 + 4, PY + 10, CZ + 2, 4)
        bronze(g, x0, PY, CZ - 4, x0 + 4, PY + 2, CZ + 2, 3)
    # tabard skirt and chest
    g.prism("y", flat_ngon(CX, CZ, 4.5, 8), PY + 8, PY + 14, C("gold", 4), top=flat_ngon(CX, CZ, 6.0, 8))
    body = last(g)
    g.prism("y", flat_ngon(CX, CZ, 5.0, 8), PY + 14, PY + 19, C("gold", 4), top=flat_ngon(CX, CZ, 6.5, 8))
    body |= last(g)
    g.prism("y", flat_ngon(CX, CZ, 6.5, 8), PY + 19, PY + 24, C("gold", 4), top=flat_ngon(CX, CZ, 5.0, 8))
    body |= last(g)
    P.flat(g, body & (np.abs(Y - (PY + 14.5)) < 0.6), "gold", 2)  # belt
    P.flat(g, body & (Y > PY + 21), "gold", 5)
    # pauldrons and arms reaching to the sword pommel in front
    for sx in (-1, 1):
        cx = CX + sx * 7.5
        pts = [(cx - 3.5, PY + 19), (cx + 3.5, PY + 19), (cx + 4, PY + 22), (cx + 2, PY + 25), (cx - 2, PY + 25), (cx - 4, PY + 22)]
        g.prism("z", pts, CZ - 3.5, CZ + 3.5, C("gold", 5))
        bronze(g, cx - 1.5 - sx * 0.5, PY + 12, CZ - 5, cx + 1.5 - sx * 0.5, PY + 20, CZ - 1, 4)  # upper arm, forward
    bronze(g, CX - 4, PY + 11, CZ - 8, CX + 4, PY + 14, CZ - 4, 5)
    # the planted greatsword in front (point down on the plinth)
    sword(g, CX, PY, CZ - 7, 16, t=1, blade=("gold", 5), guard=("gold", 6), grip=("gold", 3), up=False)
    # the big helm with a crest
    helm = bronze(g, CX - 4.5, PY + 24, CZ - 4.5, CX + 4.5, PY + 32, CZ + 4.5, 4)
    face = helm & (Z < CZ - 3.5)
    P.flat(g, face & (np.abs(Y - (PY + 28.5)) < 0.6) & (np.abs(X - CX) < 3.5), "gold", 1)
    P.flat(g, face & (np.abs(X - CX) < 0.6) & (Y < PY + 28), "gold", 2)
    g.prism("x", [(PY + 32, CZ - 4), (PY + 35, CZ - 2), (PY + 34, CZ + 5), (PY + 32, CZ + 4)], CX - 1, CX + 1, C("red", 4))
    # the shield on the left arm
    heater(g, CX - 10, PY + 7, CZ - 5, 8, 12, t=2, field=("blue", 4), rim=("gold", 5), lean=6.0, charge="crown", ink=("gold", 6))
    # a few green patina drips on the bronze (paint)
    bron = (g.a > 0) & (Y > PY) & np.isin(g.a, [C("gold", s) for s in range(1, 7)])
    for px, y0, y1 in ((CX + 2, PY + 16, PY + 19), (CX - 7, PY + 20, PY + 23), (CX + 8, PY + 20, PY + 23)):
        P.flat(g, bron & (np.floor(X) == px) & (Y > y0) & (Y < y1) & (Z < CZ), "sky", 4)
    root = Part("knight-statue", g)
    return Asset(id="fantasy-props-knight-statue", pack="fantasy", category="props", name="Knight Statue", root=root)
