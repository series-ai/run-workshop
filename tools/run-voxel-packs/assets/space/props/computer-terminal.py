"""Computer terminal, in the Pirate Nation mecha style.

One iconic shape (rule K3): a standing retro-futurist terminal in white hull
plates on a tapered steel foot (true slopes, F2). Its oversized head leans
back with a big glowing teal screen (a painted green readout), a keyboard
shelf slopes out at hand height, two tape reels spin (paint) on the lower
front, a row of status lamps runs under the screen and a copper cable trunk
drops from the back to the floor. The head sits a little skew (F5).
Detail is paint (S1). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import cham_prism, dots, hull, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from _pn import pipe
from voxgrid import C, Asset, Grid, Part

W, D = 20, 24
X0, X1, Z0, Z1 = 2, 18, 9, 20  # cabinet
YC = 22  # cabinet top


def cabinet() -> Grid:
    g = Grid(W, YC + 2, D)
    X, Y, Z = coords(g)
    foot = cham_prism(g, "y", 0, Z0 - 2, W, Z1 + 2, 3, 0, 3, "steel", 4, inset=1.5)
    for m, fr in facets(g):
        P.plates(g, m, "steel", 4, size=(8, 4), frame=fr)
    P.flat(g, foot & (Y > 2), "steel", 5)
    cab = box(g, X0, 3, Z0, X1, YC, Z1, "bone", 5)
    hull(g, cab, "bone", 5, size=(8, 7), seed=3)
    pnpaint.hazard(g, cab & (Y < 5.5), period=4, a=("orange", 5), b=("iron", 5))
    pnglyph.icon(g, "+x", X1, Z0 + 1, 8, "gear", "orange", 5)
    # tape reels on the lower front
    for cx in (6.5, 13.5):
        r = ngon_prism(g, "z", cx, 8.5, 3.2, Z0 - 1, Z0, "steel", 6)
        rr = np.hypot(X - cx, Y - 8.5)
        ang = np.arctan2(Y - 8.5, X - cx)
        P.flat(g, r & (rr < 2.3), "iron", 5)
        P.flat(g, r & (rr < 2.3) & (np.abs(((ang / (2 * math.pi) * 3) % 1) - 0.5) < 0.18), "steel", 6)
        P.flat(g, r & (rr < 0.9), "gold", 6)
    tape = box(g, 6, 12, Z0 - 1, 14, 13, Z0, "rust", 3)
    # the keyboard shelf: a wedge sloping down toward the user
    g.prism("x", [(14, Z0), (17, Z0), (16, Z0 - 7), (14.5, Z0 - 7)], 3, 17, C("steel", 4))
    kb = g.solids[-1].mask(g.shape)
    ytop = 17 - (Z0 - Z) / 7  # the sloped top of the shelf
    P.flat(g, kb, "steel", 4)
    P.flat(g, kb & (Y > ytop - 1.2), "steel", 5)
    P.flat(g, kb & (Y > ytop - 1.2) & (np.floor(X) % 2 == 0) & (X > 3) & (X < 13) & (np.floor(Z) % 2 == 0), "bone", 6)
    P.flat(g, kb & (X > 13) & (X < 16) & (Z < Z0 - 4), "orange", 6)  # the enter key
    # status lamps under the head
    dots(g, cab & (Z < Z0 + 1), "-z", [(5, 19.5), (8, 19.5), (11, 19.5), (14, 19.5)], 1.1, "cyan", 6)
    P.flat(g, cab & (Z < Z0 + 1) & (np.abs(X - 14) < 1.2) & (np.abs(Y - 19.5) < 1.2), "red", 5)
    P.flat(g, cab & (Z < Z0 + 1) & (np.abs(X - 11) < 1.2) & (np.abs(Y - 19.5) < 1.2), "gold", 6)
    # a copper cable trunk down the back
    pipe(g, [(10, YC - 3, Z1 + 1), (10, 1.5, Z1 + 1)], s=3, ramp="rust", base=4)
    return g


def head() -> Grid:
    """The oversized screen head: its front leans back (a true slope)."""
    g = Grid(22, 15, 15)
    X, Y, Z = coords(g)
    g.prism("x", [(0, 1), (0, 14), (15, 14), (15, 4)], 0, 22, C("bone", 5))
    m = g.solids[-1].mask(g.shape)
    for f, fr in facets(g):
        P.plates(g, f, "bone", 5, size=(11, 8), frame=fr)
    P.flat(g, m & ((X < 1) | (X > 21)), "orange", 5)  # orange side caps
    P.flat(g, edges(m), "bone", 3)
    zfront = 1 + Y * 3 / 15
    face = m & (Z < zfront + 1.5)
    scr = face & (X > 3) & (X < 19) & (Y > 2) & (Y < 13)
    P.flat(g, face & ~scr, "orange", 5)
    P.flat(g, scr, "teal", 4)
    P.flat(g, scr & ((X < 4.5) | (X > 17.5) | (Y < 3.5) | (Y > 11.5)), "iron", 5)
    inner = scr & (X > 4.5) & (X < 17.5) & (Y > 3.5) & (Y < 11.5)
    for k, yy in enumerate((10, 8, 6)):
        P.flat(g, inner & (np.abs(Y - yy - 0.5) < 0.5) & (X > 17.5 - (11 - 3 * k)), "toxic", 5)
    P.flat(g, inner & (np.abs(Y - 4.5) < 0.5) & (X > 15) & (X < 16), "toxic", 7)  # the cursor
    P.flat(g, inner & (np.abs((X - 6) + (Y - 11)) < 0.6), "teal", 6)  # glint
    return g


def build() -> Asset:
    root = Part("computer-terminal", cabinet())
    root.add(Part("head", head(), pivot=(11.0, 0.0, 7.5), at=(10.0, float(YC), 14.0), rot=(0.0, -6.0, 3.0)))
    return Asset(id="space-props-computer-terminal", pack="space", category="props", name="Computer Terminal", root=root)
