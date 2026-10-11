"""Water jug cache, in the Pirate Nation style.

One grounded icon (rules K3, F6): three heavy jugs and one tipped jug on a
weathered pallet, so the group reads as one prop from every side. Each
bottle is a chunky volume with true sloped shoulders (rule F2) and a framed
edge, painted with moulded ribs, a fill line, a bone H2O label and scuffs.
A brass tap is screwed into the front jug as the function prop; algae and
dust climb the bottoms, and caps in signal red, hazard yellow and zombie
teal mark the three rations (rule C3). Every mark is paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
from _props import asset, chips, pallet, root, weeds
from pnkit import box, edges, ngon
from pnshapes import coords, disc
from voxgrid import C, Grid

GW, GH, GD = 36, 28, 26
PY = 4  # the pallet deck


def jug(g: Grid, cx: float, cz: float, y0: float, w: float, h: float, cap: str, seed: int) -> np.ndarray:
    """A standing jug: a bevelled body with true sloped shoulders, a ribbed
    waist, a fill line and a bone label."""
    X, Y, Z = coords(g)
    plan = ngon(cx, cz, w, 8)
    neck = ngon(cx, cz, w * 0.42, 8)
    g.prism("y", plan, y0, y0 + h * 0.72, C("sky", 5))
    body = g.solids[-1].mask(g.shape)
    g.prism("y", plan, y0 + h * 0.72, y0 + h, C("sky", 5), top=neck)
    shoulder = g.solids[-1].mask(g.shape)
    m = body | shoulder
    P.flat(g, m, "sky", 5)
    P.flat(g, m & (np.floor(Y) % 4 == 0) & (Y < y0 + h * 0.7), "sky", 4)  # the moulded ribs
    P.flat(g, m & (Y < y0 + h * 0.52), "sky", 4)  # the water below the fill line
    P.flat(g, m & (np.abs(Y - (y0 + h * 0.52)) < 0.6), "sky", 7)  # the fill line
    P.flat(g, shoulder, "sky", 6)
    P.flat(g, edges(m), "sky", 3)
    lab = m & (Z < cz - w + 1.6) & (Y > y0 + h * 0.2) & (Y < y0 + h * 0.48) & (np.abs(X - cx) < w * 0.6)
    P.flat(g, lab, "bone", 7)
    P.outline(g, lab, "steel", 3, normal="z")
    tw, _ = pnglyph.text_size("H2O")
    if w * 1.2 > tw:
        pnglyph.text(g, "-z", cz - w, int(cx - tw // 2), int(y0 + h * 0.28), "H2O", "teal", 3)
    chips(g, m, ((cx - w, y0 + h * 0.3, cz + 2, 2.6), (cx + 2, y0 + h * 0.8, cz - w, 2.2)), "steel", 4, seed=seed)
    P.flat(g, m & (Y < y0 + 3) & ((np.floor(X + Z) % 4) == 0), "teal", 3)  # algae
    P.grime(g, m, height=3, seed=seed + 1)
    neck_m = disc(g, "y", cx, cz, w * 0.42, y0 + h, y0 + h + 2, "sky", 4, n=8)
    P.flat(g, neck_m, "sky", 3)
    c = disc(g, "y", cx, cz, w * 0.5, y0 + h + 2, y0 + h + 5, cap, 5, n=8)
    P.flat(g, c & (np.floor(np.arctan2(Z - cz, X - cx) * 5) % 2 == 0), cap, 3)
    P.flat(g, c & (Y > y0 + h + 3.5), cap, 6)
    P.outline(g, c, cap, 2, normal="y")
    return m


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    pallet(g, 1, 0, 2, w=26, d=22, ramp="wood", base=5, seed=1)
    weeds(g, 29, 5, seed=2)
    jug(g, 8.0, 9.0, PY, 6.0, 15.0, "red", seed=3)
    jug(g, 20.0, 8.0, PY, 6.0, 15.0, "gold", seed=5)
    jug(g, 14.0, 18.0, PY, 6.0, 15.0, "teal", seed=7)
    # the brass tap screwed into the front jug
    tap = box(g, 6, PY + 5, 1, 10, PY + 9, 4, "gold", 5)
    P.flat(g, tap & (np.floor(Y) % 2 == 0), "gold", 4)
    P.flat(g, edges(tap), "darkwood", 3)
    box(g, 7, PY + 9, 2, 9, PY + 12, 3, "gold", 6)
    # the tipped jug, lying clear of the others on the pallet deck
    lying = disc(g, "x", float(PY + 6), 20.0, 5.6, 24, 34, "sky", 5, n=8)
    rr = np.hypot(Y - (PY + 6), Z - 20)
    P.flat(g, lying & (np.floor(X) % 4 == 0), "sky", 4)
    P.flat(g, lying & (rr > 4.6), "sky", 4)
    P.flat(g, lying & (X > 32), "sky", 6)
    P.flat(g, lying & (Y < PY + 3), "sky", 3)
    P.outline(g, lying, "sky", 3, normal="x")
    llab = lying & (Y > PY + 8) & (np.abs(Z - 20) < 3.6) & (X > 26) & (X < 32)
    P.flat(g, llab, "bone", 7)
    P.outline(g, llab, "steel", 3, normal="y")
    neck = disc(g, "x", float(PY + 6), 20.0, 2.6, 22, 24, "sky", 4, n=8)
    P.flat(g, neck, "sky", 3)
    tcap = disc(g, "x", float(PY + 6), 20.0, 3.0, 20, 22, "teal", 5, n=8)
    P.flat(g, tcap & (np.floor(Z) % 2 == 0), "teal", 3)
    P.outline(g, tcap, "teal", 2, normal="x")
    P.grime(g, lying, height=3, seed=9)
    return asset("water-jugs", "Water Jug Cache", root("water-jugs", g))
