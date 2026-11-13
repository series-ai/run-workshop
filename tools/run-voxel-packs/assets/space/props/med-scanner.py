"""Medical scanner bed, in the Pirate Nation mecha style.

One iconic shape (rule K3): a white hull plinth with painted panel seams and
a hazard band, a teal bed in a dark steel frame with cyan rail strips, and
an oversized scanner gantry arching right over the bed (F4): two steel
uprights and a crossbar whose underside glows cyan. The monitor is bolted to
the head mast on a copper bracket, so nothing floats. Detail is paint (S1).
Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _props import cham_prism, dots, hull, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, H, D = 40, 32, 24
BY = 11  # bed rail top
AX0, AX1 = 14, 20  # the gantry in x
MX0, MX1 = 31, 39  # the head mast in x


def bed() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # The plinth: white hull on a dark base with one hazard band.
    foot = box(g, 4, 0, 4, 30, 3, 20, "iron", 4)
    P.flat(g, foot & (Y > 2), "iron", 5)
    pnpaint.hazard(g, foot & (Y > 0.5) & (Y < 2.5), period=6, a=("orange", 5), b=("iron", 3), frame="wall")
    P.flat(g, edges(foot), "iron", 2)
    plinth = cham_prism(g, "y", 6, 5, 28, 19, 2.0, 3, BY, "bone", 6)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "bone", 6, size=(8, 6), frame=fr)
    P.flat(g, edges(plinth), "steel", 2)
    P.flat(g, plinth & (Y > 6) & (Y < 8), "rust", 5)
    P.flat(g, plinth & (np.abs(Y - 7) < 0.4), "rust", 6)
    draw = plinth & (Z < 6) & (X > 9) & (X < 25) & (Y > 3.5) & (Y < 6)
    P.flat(g, draw, "steel", 4)
    P.flat(g, draw & (np.abs(X - 17) < 0.6), "steel", 2)
    P.outline(g, draw, "steel", 2, normal="z")
    dots(g, plinth & (Z < 6), "-z", [(12.0, 9.0)], 1.0, "cyan", 7)
    dots(g, plinth & (Z < 6), "-z", [(22.0, 9.0)], 1.0, "orange", 6)

    # The bed: a teal pad in a dark steel frame with cyan rail strips.
    frame = box(g, 2, BY, 2, 32, BY + 2, 22, "steel", 4)
    P.flat(g, frame & (Y > BY + 1), "steel", 5)
    P.flat(g, edges(frame), "steel", 2)
    for zz in (2, 21):
        st = frame & (np.abs(Z - (zz + 0.5)) < 0.6) & (Y > BY + 0.5) & (X > 4) & (X < 30)
        P.flat(g, st, "cyan", 6)
        P.flat(g, st & (np.floor(X) % 4 == 0), "cyan", 7)
    pad = box(g, 4, BY + 2, 4, 30, BY + 4, 20, "teal", 5)
    P.flat(g, pad & (Y > BY + 3), "teal", 6)
    P.flat(g, pad & (Y > BY + 3) & ((np.floor(X) % 8 == 0) | (np.abs(Z - 12) < 0.6)), "teal", 4)
    P.outline(g, pad, "steel", 2, normal="y")
    pil = box(g, 23, BY + 4, 7, 29, BY + 6, 17, "bone", 7)
    P.outline(g, pil, "steel", 3, normal="y")
    P.flat(g, pil & (Y > BY + 5) & (np.abs(Z - 12) < 2.1), "bone", 6)

    # The head mast: steel with a white hull face and a hazard band.
    mast = cham_prism(g, "y", MX0, 5, MX1, 19, 1.5, 0, 28, "steel", 5)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "steel", 5, size=(6, 8), frame=fr)
    P.flat(g, edges(mast), "steel", 2)
    P.flat(g, mast & (Y > 1) & (Y < 4), "orange", 5)
    P.flat(g, mast & (np.abs(Y - 2.5) < 0.4), "orange", 3)
    face = mast & (Z < 6) & (Y > 5) & (Y < 18) & (X > MX0 + 1) & (X < MX1 - 1)
    P.flat(g, face, "bone", 6)
    P.flat(g, face & (np.abs(Y - 11.5) < 0.6), "bone", 4)
    P.outline(g, face, "steel", 2, normal="z")
    P.flat(g, mast & (Z < 6) & (Y > 19) & (Y < 21) & (X > MX0 + 1) & (X < MX1 - 1), "cyan", 6)
    for zm in (mast & (Z > 18), mast & (X > MX1 - 1)):
        P.flat(g, zm & (Y > 8) & (Y < 18), "bone", 6)
        P.flat(g, zm & (Y > 9) & (Y < 17), "bone", 7)
    P.flat(g, mast & (Y > 26), "steel", 5)

    # The scanner gantry: two uprights and a glowing crossbar over the bed.
    for z0, z1 in ((2, 6), (18, 22)):
        up = box(g, AX0, BY, z0, AX1, 25, z1, "steel", 5)
        P.plates(g, up, "steel", 5, size=(6, 7))
        P.flat(g, up & (Z < z0 + 1) & (Y > 17) & (Y < 23), "bone", 6)
        P.flat(g, edges(up), "steel", 2)
        P.flat(g, up & (Y > 14) & (Y < 16), "rust", 5)
    g.prism("x", [(25, 1), (25, 23), (29, 20), (29, 4)], AX0, AX1, P.C("steel", 5))
    bar = g.solids[-1].mask(g.shape)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "steel", 5, size=(7, 7), frame=fr)
    P.flat(g, edges(bar), "steel", 2)
    under = bar & (np.abs(Y - 25.5) < 0.6) & (Z > 3) & (Z < 21)
    P.flat(g, under, "cyan", 6)
    P.flat(g, under & (np.floor(Z) % 3 == 0), "cyan", 7)
    P.flat(g, bar & (Y > 28), "steel", 6)
    P.flat(g, bar & (Z < 3) & (Y > 26) & (Y < 28), "rust", 5)
    emit = ngon_prism(g, "y", 17.0, 12.0, 3.0, 23, 25, "rust", 5, n=8)
    P.flat(g, emit, "rust", 5)
    P.flat(g, emit & (Y < 24) & (np.hypot(X - 17, Z - 12) < 2.0), "cyan", 7)

    # The monitor, bolted to the mast on a copper bracket.
    brk = box(g, MX0 - 2, 19, 3, MX0 + 1, 23, 7, "rust", 5)
    P.flat(g, brk & (Y > 22), "rust", 6)
    P.flat(g, edges(brk), "rust", 3)
    mon = cham_prism(g, "y", MX0 - 9, 2, MX0, 7, 1.5, 17, 27, "steel", 4)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "steel", 4, size=(6, 6), frame=fr)
    P.flat(g, edges(mon), "steel", 2)
    scr = mon & (Z < 3) & (X > MX0 - 8) & (X < MX0 - 1) & (Y > 18) & (Y < 26)
    P.flat(g, scr, "cyan", 2)
    P.flat(g, scr & (X > MX0 - 7) & (X < MX0 - 2) & (Y > 19) & (Y < 25), "cyan", 5)
    for y0, wid in ((20, 3), (22, 5), (24, 2)):
        P.flat(g, scr & (np.abs(Y - (y0 + 0.5)) < 0.6) & (X > MX0 - 7) & (X < MX0 - 7 + wid), "cyan", 7)
    P.flat(g, scr & (np.abs(Y - 22.5) < 0.6) & (X > MX0 - 3) & (X < MX0 - 2), "orange", 6)

    # A copper canister clipped to the foot of the bed.
    can = ngon_prism(g, "y", 6.0, 12.0, 2.6, BY + 2, BY + 9, "rust", 5, n=8)
    P.flat(g, can & (Y > BY + 7), "steel", 4)
    P.flat(g, can & (Y > BY + 4) & (Y < BY + 6) & (Z < 10.5), "cyan", 6)
    return g


def build() -> Asset:
    root = Part("med-scanner", bed())
    return Asset(id="space-props-med-scanner", pack="space", category="props", name="Medical Scanner Bed", root=root)
