"""Pile of refuse sacks, in the Pirate Nation style.

Three plump sacks (rule K3). Each sack is a stack of lumpy faceted tiers:
a soft foot, a wide belly, a round shoulder and a gathered neck with a
tied knot and two ears on top (rules F1, F2). The sacks touch but never
pass into one another. Paint is a soft three-tone ramp from the foot to
the shoulder, one highlight on the lit shoulder and a few fold lines that
run up to the neck (rules S1, S3). Each knot carries a coloured tie in
signal red, hazard yellow or bone (rule C3). A lying drink can, a crushed
carton and a flat can lie at the front. There is no ground pad.
"""
import numpy as np

import paint as P
from _props import asset, root
from _rep_props import bands, creases, glint, no_overlap, stack
from pnkit import box, edges
from pnshapes import bar, coords, disc
from voxgrid import Grid

GW, GH, GD = 36, 20, 30

# (height fraction, radius factor) from the foot up to the neck
BODY = ((0.0, 0.80), (0.16, 1.0), (0.45, 0.98), (0.68, 0.80), (0.84, 0.48), (0.92, 0.24))


def sack(g: Grid, cx: float, cz: float, rx: float, rz: float, h: float, lumps, ramp: str, base: int,
         tie: tuple[str, int], ear: float, twist: float, fold_angles) -> np.ndarray:
    """One refuse sack standing on y = 0. Returns the mask of the sack."""
    prof = [(f * h, r) for f, r in BODY]
    body = stack(g, cx, cz, 0.0, rx, rz, prof, lumps, ramp, base, twist=twist)
    # the soft ramp: a dark foot, the body tone, a lit shoulder
    bands(g, body, ramp, 0.0, h, ((0.0, base - 1), (0.18, base), (0.62, base + 1)))
    creases(g, body, cx, cz, fold_angles, 0.30 * h, 0.80 * h, ramp, base - 1, width=1.0)
    glint(g, body, (cx - 0.55 * rx, 0.66 * h, cz - 0.55 * rz), 0.36 * min(rx, rz) + 1.0, ramp, base + 2)
    # the gathered neck: a short twisted post on the top ring
    ny0 = h * BODY[-1][0]
    nr = max(1.4, 0.22 * min(rx, rz))
    neck = disc(g, "y", cx, cz, nr, ny0, ny0 + 2.0, ramp, base, n=6)
    P.flat(g, neck, *tie)  # the tie wraps the neck
    # the two ears of the knot, leaning out from the top of the neck
    ears = np.zeros(g.shape, dtype=bool)
    ky = ny0 + 1.6
    for side in (-1.0, 1.0):
        ears |= bar(g, "z", (cx, ky), (cx + side * ear, ky + ear * 0.9), 2.0, cz - 1.0, cz + 1.0, ramp, base + 1)
    X, Y, Z = coords(g)
    P.flat(g, ears & (Y > ky + ear * 0.55), ramp, base + 2)  # the lit tips
    return body | neck | ears


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    a = sack(g, 10.0, 14.0, 8.0, 7.0, 14.0, (1.0, 0.92, 1.04, 0.95, 0.9, 1.05, 0.96, 0.9, 1.02), "steel", 3,
             ("red", 5), 2.6, 9.0, (-125, -35, 60))
    b = sack(g, 25.5, 12.5, 7.0, 6.4, 12.0, (0.95, 1.04, 0.9, 1.0, 1.05, 0.92, 1.0, 0.94), "forest", 4,
             ("gold", 5), 2.2, -11.0, (-115, -30))
    c = sack(g, 18.5, 24.0, 5.6, 5.0, 9.5, (1.0, 0.9, 1.05, 0.95, 0.9, 1.04, 0.97), "teal", 3,
             ("bone", 7), 1.8, 14.0, (-100, -10))
    # a drink can that rolled out of the grey sack, lying on its side
    wad = disc(g, "x", 1.6, 4.0, 1.6, 4, 9, "red", 5, n=8)
    P.flat(g, wad & (X < 5), "steel", 6)  # the bare metal end
    P.flat(g, wad & (np.abs(X - 6.5) < 1.0), "bone", 7)  # the label band
    # a crushed carton in front of the green sack: a box, so it may keep framed edges
    cart = box(g, 21, 0, 2, 30, 5, 6, "sand", 5)
    P.flat(g, cart & (Y > 4), "sand", 6)
    P.flat(g, edges(cart), "sand", 3)
    panel = P.region(g, 23, 1, 2, 28, 4, 3)
    P.flat(g, panel, "red", 4)
    P.outline(g, panel, "red", 2, normal="z")
    # a flattened can beside the small sack
    can = disc(g, "y", 30.5, 21.0, 2.2, 0, 1.5, "steel", 5)
    P.flat(g, can & (np.hypot(X - 30.5, Z - 21.0) < 1.0), "red", 4)
    no_overlap([("grey sack", a), ("green sack", b), ("teal sack", c), ("lying can", wad), ("carton", cart), ("can", can)])
    return asset("trash-bags", "Refuse Sacks", root("trash-bags", g))
