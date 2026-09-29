"""Traffic cones, in the Pirate Nation style.

Two chunky icons (rule K3): an upright octagonal cone (a true frustum) in
bright hazard orange with two wide reflective bands on a square base
plate, and a second cone knocked over beside it, lying at an angle (rule
F5). Scuffs, the cracked base and the bands are paint (rule S1).
"""
import numpy as np

import paint as P
import pnpaint
from _props import asset, child, root
from pnkit import box, edges
from pnshapes import cone, coords
from voxgrid import Grid

H = 17  # cone height above the plate


def paint_cone(g: Grid, m, y0: float, h: float, axis_coord) -> None:
    """Orange body, two bone reflective bands, scuffs and a lit tip."""
    t = (axis_coord - y0) / h
    P.flat(g, m, "orange", 5)
    P.flat(g, m & (t > 0.28) & (t < 0.44), "bone", 7)
    P.flat(g, m & (t > 0.58) & (t < 0.7), "bone", 7)
    P.flat(g, m & (t > 0.9), "orange", 6)
    pnpaint.blotch(g, m & (t < 0.26), "orange", 3, cell=2, chance=0.03, seed=3)


def plate(g: Grid, x0, y0, z0, s: int) -> np.ndarray:
    m = box(g, x0, y0, z0, x0 + s, y0 + 2, z0 + s, "steel", 3)
    P.flat(g, edges(m), "steel", 2)
    X, Y, Z = coords(g)
    P.flat(g, m & (Y > y0 + 1) & (np.abs((X - x0) - (Z - z0) * 0.7 - 2) < 0.6), "steel", 5)  # a crack catches light
    return m


def upright() -> Grid:
    g = Grid(14, H + 2, 14)
    plate(g, 0, 0, 0, 14)
    m = cone(g, "y", 7, 7, 5.5, 2, 2 + H, "orange", 5, n=8, r_top=1.2)
    paint_cone(g, m, 2, H, coords(g)[1])
    return g


def knocked() -> Grid:
    """A cone that lost its plate, built lying along +x; the part turns
    it so its lower slant facet rests on the ground."""
    g = Grid(H, 12, 12)
    c = cone(g, "x", 6, 6, 5.5, 0, H, "orange", 5, n=8, r_top=1.2)
    paint_cone(g, c, 0, H, coords(g)[0])
    P.flat(g, c & (coords(g)[0] < 1), "orange", 3)  # the open base
    P.flat(g, c & (coords(g)[0] < 1) & (np.hypot(coords(g)[1] - 6, coords(g)[2] - 6) < 3.5), "orange", 2)
    return g


def build():
    g = Grid(34, 20, 26)
    base = upright()
    g.paste(base, 2, 0, 2)
    r = root("traffic-cone", g)
    # the knocked cone: its plate edge on the ground, its tip resting low
    slope = float(np.degrees(np.arctan2(5.5 - 1.2, H)))
    child(r, "fallen-cone", knocked(), pivot=(0.0, 0.5, 6.0), at_grid=(16.5, 0, 11), rot=(0.0, -32.0, -slope))
    return asset("traffic-cone", "Traffic Cones", r)
