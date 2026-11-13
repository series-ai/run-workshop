"""Tesla power generator, in the Pirate Nation mecha style.

One chunky icon (rule K3): a heavy hazard-orange field generator with
chamfered corners (true slopes, F2) on a steel skid. A big octagonal fan
grille fills its front, a glowing output meter sits beside it, and two
oversized copper tesla coils with glowing plasma orbs stand on top, one
taller than the other (F4, F5). A leaning exhaust stack and a copper cable
finish it. Detail is paint (S1). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint
from _pn import pipe
from _props import cham_prism, glow, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, D = 30, 18
X0, X1, Z0, Z1 = 1, 29, 2, 16
Y0, Y1 = 3, 17


def generator() -> Grid:
    g = Grid(W, 36, D)
    X, Y, Z = coords(g)
    for z0 in (Z0 + 1, Z1 - 4):
        sk = box(g, X0 - 1, 0, z0, X1 + 1, Y0, z0 + 3, "steel", 4)
        P.flat(g, edges(sk), "steel", 3)
    body = cham_prism(g, "z", X0, Y0, X1, Y1, 3, Z0, Z1, "orange", 5)
    P.flat(g, body, "orange", 5)
    P.flat(g, body & (Y > Y1 - 3), "orange", 6)
    P.flat(g, body & (np.abs(Z - 9.5) < 0.6), "orange", 3)
    pnpaint.hazard(g, body & (Y < Y0 + 2), period=4, a=("orange", 5), b=("iron", 5))
    # the fan grille on the front
    fan = ngon_prism(g, "z", 10, 10, 5.5, Z0 - 1, Z0, "steel", 4)
    rr = np.hypot(X - 10, Y - 10)
    ang = np.arctan2(Y - 10, X - 10)
    P.flat(g, fan & (rr < 4.8), "iron", 5)
    P.flat(g, fan & (rr < 4.8) & (np.abs(((ang / (2 * math.pi) * 5 + rr / 9) % 1) - 0.5) < 0.2), "steel", 6)
    P.flat(g, fan & (rr < 1.2), "gold", 6)
    # the output meter
    glow(g, "-z", Z0, 18, 26, 8, 14, glass=("cyan", 5), rim=("rust", 3), bar=False)
    m = (g.a > 0) & (Z < Z0) & (X > 18) & (X < 26) & (Y > 8) & (Y < 14)
    P.flat(g, m & (np.abs(Y - 9 - (X - 19) * 0.6) < 0.6), "cyan", 7)
    for xx in (19.5, 22, 24.5):
        P.flat(g, body & (Z < Z0 + 1) & (np.hypot(X - xx, Y - 5.5) < 1.1), "gold", 6)
    # tesla coils: stacked copper windings on insulators, plasma orbs on top
    for cx, cz, h in ((8.0, 9.0, 11), (21.0, 9.0, 8)):
        ins = ngon_prism(g, "y", cx, cz, 2.5, Y1, Y1 + 2, "bone", 6)
        coil = ngon_prism(g, "y", cx, cz, 3.0, Y1 + 2, Y1 + 2 + h, "rust", 4, r_top=2.0)
        P.flat(g, coil & (np.floor(Y) % 2 == 0), "rust", 6)
        yb = Y1 + 2 + h
        ngon_prism(g, "y", cx, cz, 2.0, yb, yb + 2, "plasma", 4, r_top=3.2)
        ngon_prism(g, "y", cx, cz, 3.2, yb + 2, yb + 4, "plasma", 5)
        ngon_prism(g, "y", cx, cz, 3.2, yb + 4, yb + 6, "plasma", 6, r_top=1.6)
    # the cable from the side into the floor
    pipe(g, [(X1 + 0.0, 10, 12), (X1 + 0.0, 1.0, 12)], s=2, ramp="rust", base=4)
    return g


def stack() -> Grid:
    g = Grid(6, 12, 6)
    s = ngon_prism(g, "y", 3, 3, 2.2, 0, 11, "steel", 5)
    P.flat(g, s & (coords(g)[1] > 9), "iron", 5)
    P.flat(g, s & (np.abs(coords(g)[1] - 4.5) < 0.6), "orange", 5)
    return g


def build() -> Asset:
    root = Part("power-generator", generator())
    root.add(Part("exhaust", stack(), pivot=(3.0, 0.0, 3.0), at=(26.0, float(Y1), 13.0), rot=(-8.0, 0.0, -10.0)))
    return Asset(id="space-props-power-generator", pack="space", category="props", name="Tesla Power Generator", root=root)
