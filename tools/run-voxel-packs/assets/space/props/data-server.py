"""Data server rack, in the Pirate Nation mecha style.

One iconic shape (rule K3): a chunky steel rack tower on a hazard plinth,
chamfered in plan (true diagonals, F2) and framed by two thick dark rack
rails (F3). Its oversized function prop is a big glowing teal readout at
the top with painted data bars; three white blade drawers with copper
handles, status lamps and painted vent slots fill the body. A copper
coolant trunk climbs the back corner into a leaning copper coolant drum
with a glowing core (F5). Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _pn import pipe
from _props import cham_prism, dots, lamp, ngon_prism, panel
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, D = 26, 20
X0, X1, Z0, Z1 = 2, 24, 3, 18  # cabinet
Y0, Y1 = 4, 36  # body bottom and top
DRAWERS = (8, 14, 20)  # 5 tall each  # the lower edge of each blade drawer


def cabinet() -> Grid:
    g = Grid(W, 48, D)
    X, Y, Z = coords(g)
    # the chamfered steel tower, plated on every facet
    n0 = len(g.solids)
    body = cham_prism(g, "y", X0, Z0, X1, Z1, 3, Y0, Y1, "steel", 5)
    for m, fr in facets(g, g.solids[n0:]):
        P.plates(g, m, "steel", 5, size=(10, 7), frame=fr, seed=2)
    P.flat(g, edges(body), "steel", 3)
    # hazard plinth under it
    plinth = cham_prism(g, "y", X0 - 1, Z0 - 1, X1 + 1, Z1 + 1, 3, 0, Y0, "iron", 5)
    pnpaint.hazard(g, plinth, period=4, a=("orange", 5), b=("iron", 5))
    P.flat(g, plinth & (Y > Y0 - 1), "steel", 4)
    # two thick dark rack rails frame the front (F3, S4)
    for x in (X0, X1 - 2):
        rail = box(g, x, Y0, Z0 - 1, x + 2, Y1 + 3, Z0 + 2, "iron", 5)
        P.flat(g, edges(rail), "iron", 3)
        P.flat(g, rail & (Z < Z0) & (Y > Y1 - 1), "orange", 5)  # a lit rail cap
        P.flat(g, rail & (Z < Z0) & (np.floor(Y) % 5 == 1), "gold", 6)  # rail screws
    # the oversized readout: a bright teal field with painted data bars
    frame = panel(g, "-z", Z0, 4, 22, 25, 36, "rust", 4, d=1, outline=1)
    scr = panel(g, "-z", Z0 - 1, 6, 20, 26, 35, "teal", 5, d=1, outline=0)
    face = scr & (Z < Z0 - 1.0)
    P.flat(g, face, "teal", 5)
    for k, yy in enumerate((27, 29, 31)):
        wide = (6, 11, 8)[k]
        bar = face & (np.abs(Y - (yy + 0.5)) < 0.6) & (X > 18 - wide) & (X < 19)
        P.flat(g, bar, "cyan", 6)
        P.flat(g, bar & (X < 20.5 - wide), "cyan", 7)
    P.flat(g, face & (np.abs(Y - 33.5) < 0.6), "cyan", 4)
    P.flat(g, face & (np.abs((X - 8) + (Y - 33)) < 0.6), "cyan", 7)  # glint
    pnglyph.text(g, "-z", Z0 - 2, 8, 33, "DATA", "cyan", 7, depth=2, reach=3)
    del frame
    # three blade drawers: a steel body, a white label plate, a lit strip
    for k, y0 in enumerate(DRAWERS):
        dr = panel(g, "-z", Z0, 4, 22, y0, y0 + 5, "steel", 5, d=1, outline=2)
        f = dr & (Z < Z0)
        P.flat(g, f & (Y > y0 + 1) & (Y < y0 + 4), "bone", 6)  # the blade face
        P.flat(g, f & (Y > y0 + 1) & (Y < y0 + 4) & (np.floor(X) % 4 == 0), "bone", 5)
        P.flat(g, f & ((np.abs(Y - (y0 + 0.5)) < 0.6) | (np.abs(Y - (y0 + 4.5)) < 0.6)), "steel", 3)
        strip = f & (np.abs(Y - (y0 + 2.5)) < 1.6) & (X > 6) & (X < 13)
        P.flat(g, strip, "cyan", 6)
        P.flat(g, strip & (np.abs(Y - (y0 + 2.5)) < 0.8), "cyan", 7)
        dots(g, f, "-z", [(5.0, y0 + 2.5)], 1.0, "gold" if k == 1 else "orange", 6)
        P.flat(g, f & (X > 18.5) & (Y > y0 + 1) & (Y < y0 + 4), "rust", 5)  # handle
        P.flat(g, f & (X > 18.5) & (np.abs(Y - (y0 + 2.5)) < 0.8), "rust", 6)
    # a kick vent under the drawers and a side vent on +x
    P.flat(g, body & (Z < Z0 + 1) & (Y > Y0 + 1) & (Y < Y0 + 4) & (X > 6) & (X < 20) & (np.floor(Y) % 2 == 0), "steel", 3)
    side = body & (X > X1 - 1) & (Y > 10) & (Y < 30) & (Z > Z0 + 3) & (Z < Z1 - 3)
    P.flat(g, side, "steel", 4)
    P.flat(g, side & (np.floor(Z) % 3 == 0), "steel", 3)
    P.flat(g, side & (np.abs(Z - (Z0 + Z1) / 2) < 1.6), "teal", 5)
    P.flat(g, side & (np.abs(Z - (Z0 + Z1) / 2) < 1.6) & (np.floor(Y) % 6 < 3), "cyan", 6)
    # the cap, a warning lamp and a copper coolant trunk up the back corner
    cap = cham_prism(g, "y", X0 - 1, Z0 - 1, X1 + 1, Z1 + 1, 3, Y1, Y1 + 3, "steel", 4)
    P.flat(g, edges(cap), "steel", 2)
    P.flat(g, cap & (Y > Y1 + 1.5), "steel", 6)
    lamp(g, 6.5, Y1 + 3, 8.0, r=1.7, h=2, glass=("orange", 6), cap=("steel", 3))
    pipe(g, [(X1 - 2, Y0 + 2, Z1 + 1), (X1 - 2, Y1 + 1, Z1 + 1)], s=3, ramp="rust", base=4)
    return g


def exchanger() -> Grid:
    """The leaning coolant drum on the cap: a faceted copper tank with
    hoops, a glowing cyan core window and a lit top."""
    g = Grid(16, 10, 16)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    m = ngon_prism(g, "y", 8, 8, 6.4, 0, 8, "rust", 5)
    for f, fr in facets(g, g.solids[n0:]):
        P.plates(g, f, "rust", 5, size=(6, 5), frame=fr, seed=7)
    P.flat(g, edges(m), "rust", 3)
    P.flat(g, m & ((np.abs(Y - 1.5) < 0.7) | (np.abs(Y - 6.5) < 0.7)), "rust", 3)
    P.flat(g, m & (Y > 7.4), "rust", 6)
    core = m & (Z < 3) & (np.abs(X - 8) < 3.2) & (Y > 2.5) & (Y < 5.5)
    P.flat(g, core, "cyan", 6)
    P.flat(g, core & (np.abs(X - 8) < 1.4), "cyan", 7)
    cap = ngon_prism(g, "y", 8, 8, 3.2, 8, 10, "iron", 5)
    P.flat(g, cap, "iron", 5)
    P.flat(g, cap & (Y > 9), "orange", 6)
    return g


def build() -> Asset:
    root = Part("data-server", cabinet())
    root.add(Part("exchanger", exchanger(), pivot=(8.0, 0.0, 8.0), at=(14.0, float(Y1) + 3.0, 10.0), rot=(0.0, -10.0, -6.0)))
    return Asset(id="space-props-data-server", pack="space", category="props", name="Data Server Rack", root=root)
