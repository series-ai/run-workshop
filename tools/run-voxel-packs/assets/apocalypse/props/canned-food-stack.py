"""Stack of salvaged tins, in the Pirate Nation style.

One chunky icon (rule K3): three tiers of fat tins on a weathered pallet,
each tin ringed with a dark rolled rim top and bottom so the pile never
merges into one blob. Every label is painted: a bone band, a bold mark and
a dark title bar, in the theme accents only. The tins are dented, rusted on
the rims and dusty at the foot; one has rolled off into the dust,
and a crowbar leans on the pallet (rules C3, F5).
Rims, labels, dents and rust are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
from _props import asset, chips, pallet, root, weeds
from pnkit import box, edges
from pnshapes import coords, disc
from voxgrid import Grid

GW, GH, GD = 32, 28, 30
PY = 4  # the pallet deck
R, TH = 4.0, 7  # the tin radius and height
LABELS = (("red", 5), ("gold", 6), ("teal", 4))


def tin(g: Grid, cx: float, cz: float, y0: int, k: int) -> np.ndarray:
    """One tin: a steel can with rolled rims and a painted paper label."""
    X, Y, Z = coords(g)
    m = disc(g, "y", cx, cz, R, y0, y0 + TH, "steel", 5, n=10)
    ramp, base = LABELS[k % len(LABELS)]
    lab = m & (Y > y0 + 1) & (Y < y0 + TH - 1)
    P.flat(g, lab, "bone", 7)
    P.flat(g, lab & (Y > y0 + 2) & (Y < y0 + 5), ramp, base)
    P.flat(g, lab & (np.floor(Y) == y0 + 5), "darkwood", 2)  # the title bar
    P.flat(g, lab & (np.floor(Y) == y0 + 2), ramp, max(1, base - 2))
    P.flat(g, m & (Y < y0 + 1), "steel", 3)  # the rolled rims
    P.flat(g, m & (Y > y0 + TH - 2), "steel", 3)
    P.flat(g, m & (Y > y0 + TH - 1), "steel", 6)
    P.flat(g, m & (Y > y0 + TH - 1) & (np.hypot(X - cx, Z - cz) < R - 1.4), "steel", 4)
    d = np.hypot(X - cx, Z - cz)
    P.flat(g, m & (d > R - 0.8) & ((np.floor(X + Z + y0) % 7) == 0), "rust", 4)  # rust on the rims
    P.flat(g, m & (np.hypot(X - cx - R, Y - y0 - 4) < 1.8), "steel", 4)  # one dent
    return m


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    pallet(g, 2, 0, 3, w=24, d=24, ramp="wood", base=5, seed=1)
    weeds(g, 27, 18, seed=2)
    rows = (
        (PY, ((8.0, 9.0), (17.0, 9.0), (8.0, 18.0), (17.0, 18.0))),
        (PY + TH, ((11.0, 11.0), (20.0, 11.0), (11.0, 20.0))),
        (PY + 2 * TH, ((14.0, 13.0), (14.0, 21.0))),
    )
    for ry, (y0, spots) in enumerate(rows):
        for k, (cx, cz) in enumerate(spots):
            tin(g, cx, cz, y0, k + ry)
    # The stack stops at three tiers, so the cache stays near the original
    # prop scale (about 25 high, like the 24-high wooden crate).
    # a tin rolled off into the dust, lying on its side
    roll = disc(g, "x", float(R), 24.0, R, 4, 11, "steel", 5, n=10)
    rr = np.hypot(Y - R, Z - 24)
    P.flat(g, roll & (X > 5) & (X < 10), "bone", 7)
    P.flat(g, roll & (X > 6) & (X < 8), "red", 5)
    P.flat(g, roll & (X < 5), "steel", 3)
    P.flat(g, roll & (X > 10), "steel", 3)
    P.flat(g, roll & (rr < R - 1.4) & (X > 10), "steel", 6)
    P.grime(g, roll, height=3, seed=3)
    # the crowbar leaning on the pallet
    cb = box(g, 25, 0, 7, 28, 16, 10, "steel", 5)
    P.flat(g, cb & (np.floor(Y) % 4 == 0), "steel", 3)
    P.flat(g, cb & (Y > 14), "steel", 6)
    box(g, 25, 16, 6, 28, 19, 10, "red", 4)
    P.flat(g, edges(cb), "steel", 2)
    chips(g, cb, ((26, 4, 8, 2.4),), "rust", 4, seed=4)
    tw, _ = pnglyph.text_size("EAT")
    return asset("canned-food-stack", "Tin Cache", root("canned-food-stack", g))
