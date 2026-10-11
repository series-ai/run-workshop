"""Pair of jerry cans, in the Pirate Nation style.

Two chunky icons (rule K3): a bright red can standing with its pressed X
panels, weld seam, three top handles and spout cap, and a dented khaki can
lying on its side beside it, turned (rule F5), with a painted stencil. A
steel funnel (a true frustum) and a small fuel puddle sit at the front.
Panels, seams and stencils are paint (rule S1).
"""
import math

import numpy as np

import paint as P
import pnglyph
from _props import asset, child, jerry_can, root
from pnshapes import cone, coords
from voxgrid import C, Grid


def lying_can() -> Grid:
    g = Grid(16, 19, 8)
    body = jerry_can(g, 1, 0, 1, w=11, h=14, d=6, ramp="khaki", base=5, seed=5)
    X, Y, Z = coords(g)
    P.flat(g, body & (np.hypot(X - 4, Y - 9) < 1.6), "khaki", 3)  # a dent
    pnglyph.icon(g, "-z", 1, 3, 2, "drop", "bone", 6)
    return g


def build():
    g = Grid(34, 20, 22)
    X, Y, Z = coords(g)
    # the fuel puddle: a flat slab, 1 voxel thick
    pts = [(16 + r * math.cos(a), 7 + r * math.sin(a) * 0.6) for a, r in zip(np.linspace(0, 2 * math.pi, 9)[:-1], (6, 4.5, 5.5, 4, 6.5, 5, 4.2, 5.8))]
    g.prism("y", pts, 0, 1, C("gold", 3))
    pud = g.solids[-1].mask(g.shape)
    P.flat(g, pud & (np.abs(X - 14) < 1.2) & (np.abs(Z - 6) < 0.8), "gold", 5)  # sheen
    P.flat(g, pud & (np.abs(X - 18) < 0.8) & (np.abs(Z - 8) < 0.8), "teal", 6)
    jerry_can(g, 4, 0, 11, w=12, h=15, d=7, ramp="red", base=5, seed=1)
    # the funnel, upside down beside the puddle
    f = cone(g, "y", 25, 8, 3.2, 0, 4, "steel", 6, r_top=1.2)
    P.flat(g, f & (Y < 1), "steel", 4)
    cone(g, "y", 25, 8, 1.1, 4, 6, "steel", 4)
    r = root("fuel-can", g)
    child(r, "khaki-can", lying_can(), pivot=(6.5, 0.0, 7.0), at_grid=(27, 0, 5), rot=(90.0, -20.0, 0.0))
    return asset("fuel-can", "Jerry Cans", r)
