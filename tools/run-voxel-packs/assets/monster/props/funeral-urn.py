"""Funeral urn, in the Pirate Nation haunted style.

One iconic shape (rule K3): a big bronze urn of stacked octagonal
frustums (true slopes: a foot, a round belly, a neck and a lip) on a
chamfered stone plinth, with ring handles, a purple drape with a gold hem
round its belly, and an eternal flame (the shared PN flame) burning
over a toxic-green ember glow in its mouth.
"""
import numpy as np

import paint as P
import pnshapes as S
from _props import idx, pn_flame, plinth, prop, union
from voxgrid import C, Grid


def build():
    g = Grid(22, 36, 22)
    cx = cz = 11
    plinth(g, cx - 7, cz - 7, cx + 7, cz + 7, 0, 5, "gray", 4, bevel=1.5, seed=1)
    X, Y, Z = idx(g)
    start = len(g.solids)
    rings = [(3.0, 5), (2.4, 6), (4.0, 7), (6.8, 11), (7.0, 13), (5.2, 17), (3.6, 19), (3.6, 20)]
    for (r0, y0), (r1, y1) in zip(rings, rings[1:]):
        g.prism("y", S.flat_ngon(cx, cz, r0, 8), y0, y1, C("gold", 3), top=S.flat_ngon(cx, cz, r1, 8))
    lip = S.disc(g, "y", cx, cz, 4.8, 20, 22, "gold", 4)
    urn = union(g, start)
    S.paint_facets(g, g.solids[start:-1], lambda gg, mm, fr: P.mottle(gg, mm, "gold", 3, cell=2, seed=2))
    P.flat(g, urn & S.seams(g, g.solids[start:], 0.7), "gold", 4)
    P.flat(g, urn & (Y < 7), "gold", 2)
    P.flat(g, lip & (Y == 21), "gold", 5)
    P.flat(g, lip & (Y == 21) & (S.radial(g, "y", cx, cz) < 3.2), "toxic", 3)
    # a purple drape with a gold hem round the belly, dipping at the front
    rad = S.ngon_radius(g, "y", cx, cz, 8)
    dip = np.where(Z + 0.5 < cz, (cz - Z - 0.5) * 0.25, 0)
    drape = urn & (Y >= 12 - dip) & (Y < 15) & (rad > 4)
    P.flat(g, drape, "purple", 5)
    P.flat(g, drape & (Y == np.floor(12 - dip).astype(int)), "gold", 5)
    # ring handles on both sides (true octagon rings as two bars)
    for s in (-1, 1):
        hx = cx + s * 7.5
        S.bar(g, "x", (13, cz - 2), (17, cz - 2), 1.6, hx - 0.8, hx + 0.8, "gold", 4)
        S.bar(g, "x", (13, cz + 2), (17, cz + 2), 1.6, hx - 0.8, hx + 0.8, "gold", 4)
        S.bar(g, "x", (17.5, cz - 2.5), (17.5, cz + 2.5), 1.6, hx - 0.8, hx + 0.8, "gold", 5)
    # the eternal flame (the shared PN flame) over a toxic ember glow
    pn_flame(g, cx, cz, 21, 10, 13, kind="small")
    return prop("funeral-urn", "Funeral Urn", g)
