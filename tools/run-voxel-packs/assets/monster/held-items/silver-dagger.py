"""Silver dagger: a wavy kris-style silver blade with a bat-wing guard,
a black grip and a garnet pommel.
Held-item frame: +X forward (point), origin = Hand.R joint."""
import math

from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(24, 11, 3)
    cy = 5
    g.box(0, cy - 1, 0, 2, cy + 2, 3, C("blood", 5))  # garnet pommel
    g.box(2, cy, 0, 8, cy + 1, 3, C("iron", 2))  # grip
    g.box(2, cy - 1, 1, 8, cy + 2, 2, C("iron", 2))
    for s in (-1, 1):  # bat-wing guard
        g.line((8, cy + 0.5, 1.5), (9, cy + 0.5 + s * 5, 1.5), 0.6, C("steel", 4))
        g.set(10, cy + s * 4, 1, C("steel", 4)).set(9, cy + s * 3, 1, C("steel", 4))
    for x in range(9, 24):  # wavy blade tapering to the point
        w = max(0, 1.5 - (x - 9) * 0.08)
        o = round(math.sin(x * 0.8) * 0.6)
        g.box(x, cy - w + o + 0.5, 1, x + 1, cy + w + o + 1.5, 2, C("steel", 6))
        g.set(x, cy + o, 1, C("steel", 7))
    speck(g, 414, 0.08)
    return held("silver-dagger", "Silver Dagger", g, (5, cy + 0.5, 1.5), {"socket-tip": (23, cy + 0.5, 1.5)},
                pfx=[pfx("rvx-monster-silver-slash", None, "manual", size=0.143, aim=(-1.0, 0.0, 0.0), offset=(-0.048, 0.03, 0.0))])
