"""Control console, in the Pirate Nation mecha style.

One chunky icon (rule K3): a bridge desk whose top slopes up toward the
back (a true slope, F2), in white hull plates on a steel plinth with a
hazard kick strip. Rows of big coloured buttons and a glowing slider panel
are painted on the slope; a copper throttle lever with a gold knob leans
out of it. Behind it stands a split cyan holo screen in a thick orange
frame, turned a little (F5), and two copper conduits drop into the floor.
Detail is paint (S1). Faces -Z (the operator side).
"""
import numpy as np

import paint as P
import pnpaint
from _pn import pipe
from _props import glow, hull
from pnkit import box, edges
from pnshapes import bar, coords, facets
from voxgrid import C, Asset, Grid, Part

W, D = 28, 18
X0, X1 = 1, 27
ZF, ZB = 2, 14  # desk front and back
YF, YB = 11, 16  # desk top at the front and at the back


def desk() -> Grid:
    g = Grid(W, 18, D)
    X, Y, Z = coords(g)
    plinth = box(g, X0 + 1, 0, ZF + 1, X1 - 1, 3, ZB, "steel", 4)
    pnpaint.hazard(g, plinth & (Z < ZF + 2), period=4, a=("orange", 5), b=("iron", 5))
    g.prism("x", [(3, ZF), (3, ZB), (YB, ZB), (YF, ZF)], X0, X1, C("bone", 5))
    body = g.solids[-1].mask(g.shape)
    top = None
    for m, fr in facets(g):
        if fr != "top" and abs(fr[1][1]) < 0.99 and abs(fr[1][2]) > 0.2:  # the sloped desk top
            top = m
            P.plates(g, m, "steel", 5, size=(9, 13), frame=fr)
        else:
            P.plates(g, m, "bone", 5, size=(9, 5), frame=fr)
    P.flat(g, edges(body), "bone", 3)
    P.flat(g, body & (Y < 4), "bone", 4)
    # buttons: three rows on the slope, in accent colours
    cols = [("red", 5), ("gold", 6), ("cyan", 6), ("toxic", 5), ("orange", 6)]
    for r, zz in enumerate((4.5, 7.5)):
        for k, xx in enumerate(range(4, 14, 3)):
            ramp, shade = cols[(k + r * 2) % len(cols)]
            P.flat(g, top & (np.abs(X - xx - 0.5) < 1.1) & (np.abs(Z - zz) < 1.1), ramp, shade)
    # a glowing slider panel on the right of the slope
    sl = top & (X > 16) & (X < 25) & (Z > 3) & (Z < 11)
    P.flat(g, sl, "teal", 3)
    for xx in (18, 21, 24):
        P.flat(g, sl & (np.abs(X - xx + 0.5) < 0.6), "teal", 5)
        P.flat(g, sl & (np.abs(X - xx + 0.5) < 1.1) & (np.abs(Z - (5 + xx % 4)) < 0.8), "cyan", 7)
    # the throttle lever
    bar(g, "x", (YF + 1, 11), (YF + 6, 8), 1.6, 14, 16, "rust", 4)
    knob = box(g, 13, YF + 5, 6, 17, YF + 8, 10, "gold", 6)
    P.flat(g, edges(knob), "gold", 4)
    # conduits from the back into the floor
    for xx in (6, 21):
        pipe(g, [(xx, YB - 3, ZB + 1.5), (xx, 1.5, ZB + 1.5)], s=3, ramp="rust", base=4)
    return g


def holo_screen() -> Grid:
    g = Grid(26, 14, 4)
    X, Y, Z = coords(g)
    frame = box(g, 0, 0, 1, 26, 14, 4, "orange", 5)
    P.flat(g, edges(frame), "orange", 3)
    for u0 in (2, 14):
        glow(g, "-z", 1, u0, u0 + 10, 2, 12, glass=("cyan", 5), rim=("iron", 5), bar=False)
    face = (g.a > 0) & (Z < 1)
    rr = np.hypot(X - 7, Y - 7)
    P.flat(g, face & (X > 2) & (X < 12) & (np.abs(rr - 3) < 0.6), "cyan", 7)  # a ring target
    P.flat(g, face & (X > 2) & (X < 12) & (rr < 0.8), "cyan", 7)
    P.flat(g, face & (X > 14) & (X < 24) & (Y > 3) & (Y < 11) & (np.abs(Y - 3 - (X - 14) * 0.7) < 0.7), "cyan", 7)  # a graph
    return g


def build() -> Asset:
    root = Part("control-console", desk())
    root.add(Part("holo-screen", holo_screen(), pivot=(13.0, 0.0, 2.5), at=(14.0, float(YB), float(ZB - 3)), rot=(10.0, 4.0, 0.0)))
    return Asset(id="space-props-control-console", pack="space", category="props", name="Control Console", root=root)
