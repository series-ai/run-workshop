"""Starport fuel pump, in the Pirate Nation mecha style.

One iconic shape (rule K3): a tall white hull pump with chamfered corners
(true diagonals, F2) on a hazard-striped plinth, under an oversized orange
FUEL sign that leans forward a little (F5). Its face carries a glowing
digital price display, a big cyan plasma level gauge and chunky buttons;
a copper hose loops from the +x side down and back up into a nozzle that
hangs in its holster. Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _pn import pipe
from _props import cham_prism, dots, glow, hull, panel
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, D = 26, 16
X0, X1, Z0, Z1 = 2, 20, 3, 14  # the pump body
Y0, Y1 = 4, 27


def pump() -> Grid:
    g = Grid(W, Y1 + 1, D)
    X, Y, Z = coords(g)
    plinth = cham_prism(g, "y", 0, 1, X1 + 2, D - 1, 2, 0, Y0, "steel", 4, inset=1)
    for m, fr in facets(g):
        pnpaint.hazard(g, m, period=4, a=("orange", 5), b=("iron", 5), frame=fr)
    P.flat(g, plinth & (Y > Y0 - 1), "steel", 5)
    body = cham_prism(g, "y", X0, Z0, X1, Z1, 2.5, Y0, Y1, "bone", 5)
    hull(g, body, "bone", 5, size=(9, 8), edge=0, seed=7)
    P.flat(g, body & (Y > Y1 - 1), "bone", 3)
    P.flat(g, body & (Y < Y0 + 1), "bone", 3)
    # the price display near the top
    disp = panel(g, "-z", Z0, 4, 18, 17, 25, "iron", 5, outline=1)
    pnglyph.text(g, "-z", Z0 - 1, 5, 17, "88", "cyan", 6, reach=1)
    # the plasma level gauge: a tall glowing tube in a copper frame
    gauge = glow(g, "-z", Z0, 4, 11, 6, 15, glass=("cyan", 6), rim=("rust", 4), bar=False, glint=False)
    P.flat(g, gauge & (X > 4) & (X < 10) & (Y > 12) & (Y < 14), "cyan", 3)  # the empty top of the tube
    P.flat(g, gauge & (X > 4) & (X < 6) & (np.floor(Y) % 2 == 0) & (Y > 6) & (Y < 14), "rust", 5)  # level ticks
    dots(g, body & (Z < Z0 + 1), "-z", [(14, 13.5), (14, 10.5), (14, 7.5)], 1.4, "orange", 6, hi=("orange", 7))
    P.flat(g, body & (Z < Z0 + 1) & (np.hypot(X - 14, Y - 13.5) < 1.4), "toxic", 5)
    P.flat(g, body & (Z < Z0 + 1) & (np.hypot(X - 14, Y - 7.5) < 1.4), "red", 5)
    # the holster on the +x side, and the hose looping down from it
    hol = box(g, X1, 13, 6, X1 + 3, 19, 11, "steel", 4)
    P.flat(g, edges(hol), "steel", 3)
    pipe(g, [(X1 + 1.5, 11, 12.5), (X1 + 3.5, 11, 12.5), (X1 + 3.5, 5, 12.5), (X1 + 1.5, 5, 12.5)], s=2, ramp="rust", base=4, flange=False)
    return g


def nozzle() -> Grid:
    g = Grid(5, 10, 5)
    X, Y, Z = coords(g)
    h = box(g, 1, 3, 1, 4, 10, 4, "iron", 5)
    P.flat(g, edges(h), "iron", 4)
    sp = box(g, 2, 0, 2, 3, 4, 3, "steel", 6)
    trig = box(g, 0, 5, 1, 1, 8, 4, "orange", 5)
    return g


def sign() -> Grid:
    g = Grid(27, 10, 5)
    X, Y, Z = coords(g)
    s = box(g, 0, 0, 1, 27, 10, 5, "orange", 5)
    P.flat(g, edges(s), "orange", 3)
    face = s & (Z < 2)
    P.flat(g, face & (X > 1) & (X < 26) & (Y > 1) & (Y < 9), "orange", 6)
    tw, th = pnglyph.text_size("FUEL")
    pnglyph.text(g, "-z", 1, 2, 2, "FUEL", "bone", 7)
    return g


def build() -> Asset:
    root = Part("fuel-pump", pump())
    root.add(Part("sign", sign(), pivot=(13.5, 0.0, 3.0), at=(11.0, float(Y1), 8.5), rot=(6.0, 0.0, -3.0)))
    root.add(Part("nozzle", nozzle(), pivot=(2.5, 10.0, 2.5), at=(X1 + 1.5, 22.0, 8.5), rot=(0.0, 0.0, 8.0)))
    return Asset(id="space-props-fuel-pump", pack="space", category="props", name="Starport Fuel Pump", root=root)
