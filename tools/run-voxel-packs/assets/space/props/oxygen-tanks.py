"""Oxygen tank rack, in the Pirate Nation mecha style.

One chunky icon (rule K3): three tall octagonal O2 cylinders (true facets,
F2) in white hull paint with a blue band and domed tops, strapped into a
steel rack with orange straps. Each tank has a copper neck and a red valve
wheel, the middle one a big pressure gauge; a copper hose loops from the
right tank to the floor. The left tank leans a little in its strap (F5).
Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
from _pn import pipe
from _props import dots, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets, gear
from voxgrid import Asset, Grid, Part

W, D = 30, 13
R = 4.0
TH = 22  # tank body height
XS = (6.0, 15.0, 24.0)
CZ = 6.0


def tank(gauge: bool = False) -> Grid:
    g = Grid(10, TH + 9, 10)
    X, Y, Z = coords(g)
    body = ngon_prism(g, "y", 5, 5, R, 0, TH, "bone", 5)
    ngon_prism(g, "y", 5, 5, R, TH, TH + 3, "bone", 5, r_top=2.0)
    m = g.a > 0
    for f, fr in facets(g, g.solids[-1:]):
        P.flat(g, f, "bone", 6)
    P.flat(g, body & (Y > 3) & (Y < 10), "sky", 3)
    P.flat(g, body & (np.abs(Y - 6.5) < 0.6), "sky", 5)
    P.flat(g, body & (Y > TH - 3), "sky", 3)
    P.flat(g, body & (Y < 1), "bone", 3)
    neck = ngon_prism(g, "y", 5, 5, 1.3, TH + 3, TH + 5, "rust", 4)
    gear(g, "y", 5, 5, 2.2, TH + 5, TH + 6, teeth=6, depth=1.2, ramp="red", base=4)
    if gauge:
        front = body & (Z < 5 - R + 1)
        dots(g, front, "-z", [(5, 15)], 2.2, "bone", 7)
        P.flat(g, front & (np.hypot(X - 5, Y - 15) > 1.7) & (np.hypot(X - 5, Y - 15) < 2.3), "iron", 5)
        P.flat(g, front & (np.abs(X - 5 - (Y - 15) * 0.6) < 0.5) & (np.abs(Y - 15) < 1.4) & (Y > 15), "red", 4)
    return g


def rack() -> Grid:
    g = Grid(W, TH, D)
    X, Y, Z = coords(g)
    base = box(g, 0, 0, 0, W, 2, D, "steel", 4)
    P.flat(g, edges(base), "steel", 3)
    back = box(g, 1, 2, D - 2, W - 1, TH - 2, D, "steel", 5)
    P.plates(g, back, "steel", 5, size=(7, 6))
    P.flat(g, edges(back), "steel", 3)
    for x0 in (0, W - 2):
        post = box(g, x0, 2, 1, x0 + 2, TH - 2, D, "orange", 5)
        P.flat(g, edges(post), "orange", 3)
    for y0 in (5, 14):
        strap = box(g, 2, y0, CZ - R - 1, W - 2, y0 + 2, CZ - R, "orange", 5)
        P.flat(g, strap & (np.floor(X) % 9 == 1), "steel", 6)  # buckles
    pipe(g, [(W - 3.0, 12, CZ), (W - 1.0, 12, CZ), (W - 1.0, 2.5, CZ), (W - 5.0, 2.5, CZ)], s=2, ramp="rust", base=4, flange=False)
    return g


def build() -> Asset:
    root = Part("oxygen-tanks", rack())
    for k, x in enumerate(XS):
        rot = (0.0, 20.0 * k, 4.0 if k == 0 else 0.0)
        root.add(Part(f"tank-{k}", tank(gauge=(k == 1)), pivot=(5.0, 0.0, 5.0), at=(x, 2.0, CZ), rot=rot if k != 1 else (0.0, 0.0, 0.0)))
    return Asset(id="space-props-oxygen-tanks", pack="space", category="props", name="Oxygen Tank Rack", root=root)
