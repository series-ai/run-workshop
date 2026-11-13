"""Spiked brazier, in the Pirate Nation haunted style.

One iconic shape (rule K3): a wide iron bowl (an octagonal frustum, true
slopes) on three splayed legs, a ring of spikes round its rim, a painted
skull on its front and a heap of glowing coals under a big fire (the
shared PN flame: licking tongues in nested warm layers). The rim is at waist height
for a person. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import idx, pn_flame, prop, union
from pnkit import box
from voxgrid import C, Grid


def build():
    g = Grid(26, 38, 26)
    cx = cz = 13
    X, Y, Z = idx(g)
    # three splayed legs with foot pads
    for k in range(3):
        a = math.radians(90 + 120 * k)
        fx, fz = cx + math.cos(a) * 10, cz + math.sin(a) * 10
        if abs(math.cos(a)) > 0.5:
            S.bar(g, "z", (cx + math.cos(a) * 3, 15), (fx, 1), 2.4, fz - 1.2, fz + 1.2, "iron", 5)
        else:
            S.bar(g, "x", (15, cz + math.sin(a) * 3), (1, fz), 2.4, fx - 1.2, fx + 1.2, "iron", 5)
        box(g, fx - 2, 0, fz - 2, fx + 2, 1.5, fz + 2, "iron", 6)
    # the bowl: a frustum widening upwards, a thick rim, spikes
    start = len(g.solids)
    g.prism("y", S.flat_ngon(cx, cz, 4.5, 8), 12, 20, C("iron", 6), top=S.flat_ngon(cx, cz, 9, 8))
    bowl = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.plates(gg, mm, "iron", 6, size=(5, 4), rivets=False, frame=fr))
    rim = S.disc(g, "y", cx, cz, 9.8, 20, 22, "iron", 7)
    P.flat(g, rim & (Y == 21) & (S.ngon_radius(g, "y", cx, cz) < 8.4), "ember", 3)  # coals
    coal_spot = rim & (Y == 21) & ((P._hash(X, Z, seed=3) % np.uint64(4)) == 0) & (S.ngon_radius(g, "y", cx, cz) < 8.4)
    P.flat(g, coal_spot, "ember", 5)
    for k in range(8):
        a = 2 * math.pi * k / 8 + math.pi / 8
        sx, sz = cx + math.cos(a) * 9.4, cz + math.sin(a) * 9.4
        g.prism("y", [(sx - 1, sz - 1), (sx + 1, sz - 1), (sx + 1, sz + 1), (sx - 1, sz + 1)], 22, 26, C("iron", 7), top=[(sx + math.cos(a) * 0.8, sz + math.sin(a) * 0.8)] * 4)
    # a skull painted on the front facet of the bowl
    sk = [".###.", "#####", "#o#o#", "##o##", ".#.#."]
    pnglyph.stamp(g, "-z", cz - 7, int(cx - 2.5), 14, sk, {"#": C("bone", 7), "o": C("orange", 4)}, reach=3)
    # the witch fire
    pn_flame(g, cx, cz, 21, 14, 16)
    return prop("brazier", "Spiked Brazier", g)
