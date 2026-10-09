"""Field comm radio, in the Pirate Nation mecha style.

One chunky icon (rule K3): a rugged backpack radio with chamfered edges
(true slopes, F2), a thick orange frame, a teal screen with a painted
green waveform, two big copper dials, chunky buttons, a copper carry
handle, orange shoulder straps on the back, a handset hanging on the +x
side and a whip antenna that leans (F5) with a red tip. Detail is paint
(S1). Faces -Z.
"""
import numpy as np

import paint as P
from _props import cham_prism, dots, hull, ngon_prism, screen
from pnkit import box, edges
from pnshapes import coords, quad
from voxgrid import C, Asset, Grid, Part

W, H, D = 18, 20, 11
X0, X1, Z0, Z1 = 1, 17, 2, 12


def radio() -> Grid:
    g = Grid(W + 4, H + 6, D + 4)
    X, Y, Z = coords(g)
    body = cham_prism(g, "z", X0, 0, X1, H, 2.5, Z0, Z1, "steel", 5)
    hull(g, body, "steel", 5, size=(8, 7), edge=0, seed=2)
    P.flat(g, body & (Y < 1), "steel", 3)
    # a thick orange frame band round the middle
    band = body & (Y > 8) & (Y < 10.5)
    P.flat(g, band, "orange", 5)
    P.flat(g, band & (Y > 9.5), "orange", 6)
    # the screen with a painted waveform
    screen(g, "-z", Z0, 3, 15, 12, 18, glass=("teal", 4), line=("toxic", 5), rim=("iron", 5))
    # two big copper dials and a row of buttons
    for cx in (5.5, 12.5):
        d = ngon_prism(g, "z", cx, 4.5, 2.5, Z0 - 1.5, Z0, "rust", 4)
        P.flat(g, d & (np.abs(X - cx) < 0.6) & (Y > 4.5), "gold", 6)  # the pointer
        P.flat(g, d & (Z < Z0 - 1) & (np.hypot(X - cx, Y - 4.5) > 1.8), "rust", 6)
    front = body & (Z < Z0 + 1)
    dots(g, front, "-z", [(4.5, 9.2), (9, 9.2), (13.5, 9.2)], 1.2, "gold", 6)
    P.flat(g, front & (np.abs(X - 9) < 1.3) & (np.abs(Y - 9.2) < 1.3), "red", 5)
    # the carry handle
    for xx in (5, 12):
        box(g, xx, H, 6, xx + 2, H + 2, 8, "rust", 3)
    grip = box(g, 5, H + 2, 5, 14, H + 4, 9, "rust", 4)
    P.flat(g, grip & (Y > H + 3), "rust", 6)
    # shoulder straps on the back
    for xx in (4, 12):
        s = box(g, xx, 2, Z1, xx + 3, H - 2, Z1 + 1, "orange", 4)
        P.flat(g, s & (np.floor(Y) % 5 == 0), "steel", 5)  # buckles
    # the handset on the +x side: a chunky C shape and a painted coil cord
    hs = box(g, X1, 6, 4, X1 + 2, 15, 7, "iron", 5)
    hs |= box(g, X1, 4, 3, X1 + 3, 7, 8, "iron", 6) | box(g, X1, 14, 3, X1 + 3, 17, 8, "iron", 6)
    P.flat(g, edges(hs), "iron", 4)
    cord = body & (X > X1 - 1) & (Z > 8) & (Z < 10.5) & (Y > 2) & (Y < 14)
    P.flat(g, cord, "iron", 5)
    P.flat(g, cord & (np.floor(Y) % 2 == 0), "iron", 6)
    return g


def antenna() -> Grid:
    g = Grid(5, 20, 5)
    base = ngon_prism(g, "y", 2.5, 2.5, 2, 0, 3, "rust", 3)
    box(g, 2, 3, 2, 3, 18, 3, "steel", 6)
    tip = box(g, 1, 17, 1, 4, 20, 4, "red", 5)
    P.flat(g, tip & (coords(g)[1] > 19), "red", 7)
    return g


def build() -> Asset:
    root = Part("comm-radio", radio())
    root.add(Part("antenna", antenna(), pivot=(2.5, 0.0, 2.5), at=(3.5, float(H - 1), 9.0), rot=(-8.0, 0.0, 12.0)))
    return Asset(id="space-props-comm-radio", pack="space", category="props", name="Field Comm Radio", root=root)
