"""Witch's wand: a crooked blackthorn twig with a thorn guard, knotted
bands and a glowing toxic-green crystal clasped at the tip.
Held-item frame: +X forward (tip), origin = Hand.R joint."""
import math

from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(26, 7, 7)
    c = 3
    for x in range(0, 21):
        oy = math.sin(x * 0.6) * 0.7
        g.box(x, c + oy, c, x + 1, c + oy + 1, c + 1, C("darkwood", 2 if x % 4 else 3))
    g.box(0, c - 1, c - 1, 3, c + 2, c + 2, C("darkwood", 3))  # pommel knot
    g.set(8, c + 2, c, C("darkwood", 1)).set(9, c - 1, c, C("darkwood", 1))  # thorns
    g.box(5, c - 1, c - 1, 6, c + 2, c + 2, C("purple", 3)).box(14, c - 1, c - 1, 15, c + 2, c + 2, C("purple", 3))
    g.sphere(23, c + 0.5, c + 0.5, 2.3, C("toxic", 5))
    g.sphere(23, c + 0.5, c + 0.5, 1.2, C("toxic", 7))
    for dy, dz in ((-2, 0), (2, 0), (0, -2), (0, 2)):
        g.line((20, c + 0.5, c + 0.5), (22, c + 0.5 + dy, c + 0.5 + dz), 0.4, C("iron", 3))
    speck(g, 410, 0.1)
    return held("witch-wand", "Witch's Wand", g, (4, c + 0.5, c + 0.5), {"socket-tip": (24, c + 0.5, c + 0.5)},
                pfx=[pfx("rvx-monster-curse-cloud", "socket-tip", "manual", size=0.35)])
