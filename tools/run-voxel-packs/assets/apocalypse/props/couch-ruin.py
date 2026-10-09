"""Gutted couch, in the Pirate Nation style.

A person-size icon (rules F1, K3): a zombie-teal three-seat sofa on a dark
plank base with stubby feet. Every face carries painted upholstery: panel
seams, button tufts and piping along the arms and the back roll (rules
S2–S4). Two cushions are torn open, so sand stuffing and steel springs show
through a dark ragged edge; dust and rust stains run up from the base. A
signal-red supply tin sits on the seat and a weed grows out of a seam
(rules C3, F5). Everything but the volumes is paint (rule S1).
"""
import numpy as np

import paint as P
from _props import asset, chips, root
from pnkit import box, edges
from pnshapes import coords
from voxgrid import C, Grid

GW, GH, GD = 46, 22, 26
X0, X1, Z0, Z1 = 3, 43, 4, 22
BY, SY, TY = 4, 7, 20  # the base top, the seat frame top and the back top
CU = 3  # the cushion height: the seat surface is SY + CU = 10 (a person is 36)


def fabric(g: Grid, m: np.ndarray, base: int = 4, piping: int | None = None, tufts=(), seed: int = 0) -> None:
    """Upholstery: one broad calm cloth, a lit crown, dust gathered along
    the bottom and a single piping line. Button tufts are placed by hand and
    far apart, so the cloth never reads as a grid of drawers (rules S3, S4)."""
    X, Y, Z = coords(g)
    P.flat(g, m, "teal", base)
    ys = np.nonzero(m.any(axis=(0, 2)))[0]
    lo, hi = int(ys.min()), int(ys.max())
    P.flat(g, m & (Y > hi - 1.5), "teal", min(7, base + 1))  # the lit crown
    P.flat(g, m & (Y < lo + 2.5), "sand", 4)  # dust gathered along the bottom
    P.flat(g, m & (np.abs(Y - (lo + 2.5)) < 0.6), "teal", max(1, base - 2))
    if piping is not None:
        P.flat(g, m & (np.abs(Y - piping) < 0.6), "teal", max(1, base - 2))  # one piping line
    for k, (tx, ty) in enumerate(tufts):
        P.flat(g, m & (np.abs(X - tx) < 0.7) & (np.abs(Y - ty) < 0.7), "teal", max(1, base - 3))
    P.flat(g, edges(m), "teal", max(1, base - 2))


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    # the plank base on four stubby feet
    for fx in (X0 + 1, X1 - 4):
        for fz in (Z0 + 1, Z1 - 4):
            f = box(g, fx, 0, fz, fx + 3, 2, fz + 3, "darkwood", 5)
            P.flat(g, edges(f), "darkwood", 4)
    base = box(g, X0, 2, Z0, X1, BY, Z1, "darkwood", 6)
    P.planks(g, base, "darkwood", 6, width=4, across="y", nails=False, seed=2)
    for bx in (X0 + 7, X0 + 22, X1 - 6):  # three boards weathered grey
        P.flat(g, base & (np.abs(X - bx) < 2.0), "steel", 3)
    P.flat(g, edges(base), "darkwood", 4)
    # the seat, the back and both arms
    seat = box(g, X0 + 2, BY, Z0 + 2, X1 - 2, SY, Z1 - 2, "teal", 3)
    fabric(g, seat, 3, seed=3)
    # three big cushions, each a true sloped volume proud of the frame (rules F1, F2)
    # the cushions fill the space between the arms and stop at the front of the back
    for k, cx0 in enumerate((X0 + 5, X0 + 15, X0 + 25)):
        g.prism("y", [(cx0, Z0 + 1), (cx0 + 10, Z0 + 1), (cx0 + 10, Z1 - 8), (cx0, Z1 - 8)], SY, SY + CU, C("teal", 4),
                top=[(cx0 + 1, Z0 + 2), (cx0 + 9, Z0 + 2), (cx0 + 9, Z1 - 9), (cx0 + 1, Z1 - 9)])
        cu = g.solids[-1].mask(g.shape)
        P.flat(g, cu, "teal", 4)
        P.flat(g, cu & (Y > SY + CU - 1), "teal", 5)  # the lit crown of each cushion
        P.flat(g, cu & (Y < SY + 1), "teal", 2)  # the shadow where it meets the frame
        # one button tuft in the middle of each cushion
        P.flat(g, cu & (np.abs(X - (cx0 + 5)) < 0.7) & (np.abs(Z - (Z0 + 6)) < 0.7) & (Y > SY + CU - 1), "teal", 1)
        seat |= cu
    back = box(g, X0 + 2, BY, Z1 - 8, X1 - 2, TY, Z1 - 2, "teal", 3)
    fabric(g, back, 3, piping=TY - 4, tufts=((X0 + 10, SY + CU + 4), (X0 + 22, SY + CU + 4), (X0 + 34, SY + CU + 4)), seed=4)
    P.flat(g, back & (Y > TY - 3), "teal", 4)  # the back roll
    P.flat(g, back & (np.abs(Y - (TY - 3)) < 0.6), "teal", 2)
    for ax in (X0, X1 - 5):  # the arms, their tops rolled on a true slope
        arm = box(g, ax, BY - 1, Z0, ax + 5, SY + 5, Z1, "teal", 4)
        g.prism("y", [(ax, Z0), (ax + 5, Z0), (ax + 5, Z1), (ax, Z1)], SY + 5, SY + 8, C("teal", 4),
                top=[(ax + 1, Z0 + 2), (ax + 4, Z0 + 2), (ax + 4, Z1 - 2), (ax + 1, Z1 - 2)])
        roll = g.solids[-1].mask(g.shape)
        arm |= roll
        fabric(g, arm, 3, seed=5)
        P.flat(g, roll, "teal", 5)
        P.flat(g, arm & (np.abs(Y - (SY + 5)) < 0.6), "teal", 2)
    # two torn cushions: sand stuffing with steel springs behind a dark edge
    for tx, tz, tr in ((X0 + 10, Z0 + 6, 3.6), (X0 + 20, Z0 + 5, 3.0)):
        tear = seat & (np.hypot(X - tx, Z - tz) < tr) & (Y > SY + CU - 1)
        P.flat(g, tear, "sand", 5)
        P.flat(g, tear & (np.hypot(X - tx, Z - tz) < tr * 0.5), "steel", 4)  # the spring under it
        P.flat(g, tear & (np.hypot(X - tx, Z - tz) < tr * 0.2), "steel", 6)
        P.outline(g, tear, "teal", 1, normal="y")
    rip = back & (X > X0 + 30) & (X < X0 + 36) & (Y > TY - 9) & (Y < TY - 3)
    P.flat(g, rip, "sand", 5)
    P.outline(g, rip, "teal", 1, normal="z")
    # dust and rust stains climbing from the base
    chips(g, seat | back, ((X0 + 4, BY + 2, Z0 + 2, 4.0), (X1 - 6, TY - 6, Z1, 3.6), (X0 + 18, TY - 5, Z1, 3.2), (X0, SY + 3, Z0 + 10, 3.4), (X1, SY + 2, Z0 + 14, 3.0)), "rust", 4, seed=6)
    chips(g, seat | back, ((X0 + 12, BY + 2, Z0 + 2, 3.6), (X1 - 14, TY - 10, Z1, 3.6)), "sand", 4, seed=9)
    rip2 = back & (X > X0 + 6) & (X < X0 + 13) & (Y > TY - 7) & (Y < TY - 4) & (Z > Z1 - 4)
    P.flat(g, rip2, "sand", 5)
    P.outline(g, rip2, "teal", 1, normal="z")
    # a signal-red supply tin on the seat, and a weed out of a seam
    ty0 = SY + CU  # the seat surface
    tin = box(g, X0 + 27, ty0, Z0 + 3, X0 + 33, ty0 + 6, Z0 + 8, "red", 5)
    P.flat(g, tin & (Z < Z0 + 4), "red", 6)  # its lit face
    P.flat(g, tin & (Y > ty0 + 5), "red", 4)
    P.flat(g, edges(tin), "red", 3)
    cx, cy = X0 + 30.0, ty0 + 3.0
    panel = tin & (Z < Z0 + 4) & (np.abs(X - cx) < 2.6) & (np.abs(Y - cy) < 2.6)
    P.flat(g, panel, "bone", 7)
    cross = panel & (((np.abs(X - cx) < 0.6) & (np.abs(Y - cy) < 2.0)) | ((np.abs(Y - cy) < 0.6) & (np.abs(X - cx) < 2.0)))
    P.flat(g, cross, "red", 3)  # one painted red cross: the cache is a medical one
    box(g, X0 + 28, ty0 + 6, Z0 + 5, X0 + 32, ty0 + 7, Z0 + 6, "steel", 5)  # its handle
    # a weed grows from the floor beside the left front foot
    for k, (wx, wz, wh) in enumerate(((X0 - 2, Z0 + 1, 6), (X0 - 3, Z0 + 3, 4), (X0 - 2, Z0 + 4, 3))):
        box(g, wx, 0, wz, wx + 1, wh, wz + 1, "khaki", 4 + k % 2)
    return asset("couch-ruin", "Gutted Couch", root("couch-ruin", g))
