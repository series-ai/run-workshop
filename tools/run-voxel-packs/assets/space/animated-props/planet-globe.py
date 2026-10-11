"""Ringed planet orrery, in the Pirate Nation mecha style.

A brass-and-steel desk orrery: a tapered riveted base with a big copper
gear on top, a gold axle column and a faceted gas giant (four stacked
frustums, true slopes) painted in warm bands with a red storm. A tilted
faceted ring of gold and cream circles it, and a small blue moon rides an
orbit arm near the base. On `spin` the globe turns, the ring turns about
its tilted axis and the moon orbits. Faces -Z.
"""
import math

import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, box, coords, flat_ngon, gem, light_top, mask_of, ngon_y, octo, plan, plate_facets, spin
from pnshapes import gear, ngon_radius
from voxgrid import C

S = (40, 40, 40)
CX, CZ = 20, 20
GY, GR = 21, 8.5  # globe centre height and flat radius
RING = (11.5, 15.0)  # ring inner and outer flat radius
TILT = 18.0


def stand() -> Grid:
    g = Grid(*S)
    base = plan(g, octo(CX, CZ, 9, 9, 3), 0, 4, "steel", 5, top=octo(CX, CZ, 7.5, 7.5, 2.5))
    plate_facets(g, [g.solids[-1]], "steel", 5, size=(8, 5), seed=1)
    band(g, base, 1, 0, 1, "gold", 4)
    collar = ngon_y(g, CX, CZ, 5, 4, 6, "rust", 6)
    light_top(g, collar, "rust", 7)
    col = ngon_y(g, CX, CZ, 1.8, 6, GY - GR + 1, "gold", 5)
    light_top(g, col, "gold", 6)
    cup = ngon_y(g, CX, CZ, 2, GY - GR - 1, GY - GR + 1, "gold", 4, r_top=3.5)
    del cup
    return g


def globe() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    solids = gem(g, CX, CZ, GY - GR, GR, 2 * GR, "orange", 6, n=10)
    m = mask_of(g, solids)
    bands = [("rust", 5), ("orange", 6), ("gold", 6), ("bone", 6), ("orange", 5), ("gold", 7), ("orange", 6), ("rust", 5)]
    y0 = GY - GR
    step = 2 * GR / len(bands)
    for k, (ramp, shade) in enumerate(bands):
        band(g, m, 1, y0 + k * step, y0 + (k + 1) * step, ramp, shade)
    # a red storm on the front-left
    storm = m & (np.hypot((X - (CX + 3)) * 0.7, Y - (GY - 2.5)) < 2.6) & (Z < CZ)
    P.flat(g, storm, "red", 5)
    P.flat(g, storm & (np.hypot((X - (CX + 3)) * 0.7, Y - (GY - 2.5)) < 1.3), "red", 6)
    return g


def rings() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    n = 12
    outer = flat_ngon(CX, CZ, RING[1], n)
    inner = flat_ngon(CX, CZ, RING[0], n)
    start = len(g.solids)
    for k in range(n):
        seg = [outer[k], outer[(k + 1) % n], inner[(k + 1) % n], inner[k]]
        g.prism("y", seg, GY - 1, GY + 1, C("gold", 6))
    m = mask_of(g, g.solids[start:])
    rr = ngon_radius(g, "y", CX, CZ, n)
    P.flat(g, m, "gold", 6)
    P.flat(g, m & (rr > 13.2), "bone", 6)
    return g


def moon() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    arm = box(g, CX, 6, CZ - 1, CX + 16, 7, CZ + 1, "gold", 5)
    post = box(g, CX + 15, 6, CZ - 1, CX + 17, 9, CZ + 1, "gold", 4)
    solids = gem(g, CX + 16, CZ, 9, 3, 6, "sky", 5, n=8)
    m = mask_of(g, solids)
    P.flat(g, m, "sky", 5)
    P.flat(g, m & (Y > 13), "sky", 6)
    P.flat(g, m & (np.hypot(X - (CX + 15), Y - 11) < 1.1) & (Z < CZ), "sky", 3)  # a crater
    del arm, post
    return g


def build():
    rig = Rig()
    rig.add("orrery", stand(), (CX, 0, CZ))
    rig.add("globe", globe(), (CX, GY, CZ), "orrery")
    rig.add("rings", rings(), (CX, GY, CZ), "orrery", rot=(TILT, 0.0, -8.0))
    rig.add("moon", moon(), (CX, 6, CZ), "orrery")
    clip = {"globe": {"rot": spin(6.0, "y", 360)}, "rings": {"rot": spin(12.0, "y", 360)}, "moon": {"rot": spin(4.0, "y", -360)}}
    return asset("animated-props", "planet-globe", "Ringed Planet Orrery", rig.root, clips=[Clip("spin", clip)])


_ = math
