"""Jack-o'-lanterns: a squat faceted pumpkin with a crooked stem and a carved
face that glows (GLOW panels laid into the front facets). Three faces at
three sizes: a classic toothy grin (small), a scary one with fangs (medium)
and a happy one (large). Budget <= 300 tris.

    Blender -b -t 1 --factory-startup --python neighborhood/props/jack.py -- neighborhood/renders [slug ...]
"""
import math
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from streetkit import *  # noqa: E402,F403

ORANGE = (0.95, 0.50, 0.13)
STEM = (0.36, 0.45, 0.20)
LEAF = (0.42, 0.58, 0.22)


class Pumpkin:
    def __init__(self, h):
        self.h, self.rx, self.rz = h, h * 0.64, h * 0.5
        self.cz = h * 0.5
        ball(0, 0, self.cz, self.rx * 2, self.rx * 2, h, ORANGE, seg=10, ring=6, rot=(0, 0, math.pi / 10))  # a facet faces front
        can(0.04 * h, 0, h * 0.98, 0.09 * h, 0.3 * h, STEM, n=5, r2=0.06 * h, rot=(0.0, 0.25, 0))
        box(-0.1 * h, 0.05 * h, h * 0.96, 0.26 * h, 0.14 * h, 0.03 * h, LEAF, rot=(0.2, -0.35, 0.6))

    def cut(self, pts):
        """A glowing face piece: a convex polygon in front-view (x, z) units of h about the centre."""
        h = self.h
        P = [(x * h, self.cz + z * h) for x, z in pts]
        with glow():   # every corner follows the curve, a hair proud of the facets: carved in, not stuck on
            hull([(x, self.surf(x, z) - 0.045 * h, z) for x, z in P] + [(x, self.surf(x, z) + 0.2 * h, z) for x, z in P], GLOW)

    def surf(self, x, z):
        """The front (-y) of the faceted pumpkin at (x, z): the ellipsoid pulled in to the facet chords."""
        k = 1 - (x / self.rx) ** 2 - ((z - self.cz) / self.rz) ** 2
        return -self.rx * math.sqrt(max(0.05, k)) * 0.95

    def arc(self, cx, cz, r, a0, a1, n, t, gap=0.0):
        """A carved band along an arc (degrees, 270 = bottom), split into n pieces with gaps (teeth)."""
        da = (a1 - a0) / n
        for i in range(n):
            pa, pb = math.radians(a0 + da * i + gap / 2), math.radians(a0 + da * (i + 1) - gap / 2)
            self.cut([(cx + math.cos(a) * rr, cz + math.sin(a) * rr) for a in (pa, pb) for rr in (r, r + t)])


def tri_eye(sx):
    return [(sx * 0.32, 0.06), (sx * 0.1, 0.06), (sx * 0.2, 0.26)]


def classic():
    p = Pumpkin(1.4)
    for sx in (-1, 1):
        p.cut(tri_eye(sx))
    p.cut([(-0.06, -0.02), (0.06, -0.02), (0, 0.08)])
    p.arc(0, 0.12, 0.26, 210, 330, 4, 0.13, gap=5)


def scary():
    p = Pumpkin(1.95)
    for sx in (-1, 1):                                           # angry slanted eyes
        p.cut([(sx * 0.07, 0.1), (sx * 0.33, 0.17), (sx * 0.32, 0.27), (sx * 0.1, 0.19)])
    p.cut([(-0.05, 0.0), (0.05, 0.0), (0.0, 0.1)])
    p.cut([(-0.3, -0.05), (0.3, -0.05), (0.21, -0.2), (-0.21, -0.2)])     # wide mouth
    h = p.h
    for fx, up in ((-0.16, False), (0.16, False), (0.0, True)):          # pumpkin fangs over the glow
        z0, z1 = (-0.2, -0.09) if up else (-0.05, -0.15)
        pts = [(fx - 0.06, z0), (fx + 0.06, z0), (fx, z1)]
        hull([(x * h, p.surf(x * h, p.cz + z * h) - 0.03 * h + d, p.cz + z * h) for d in (0, 0.22 * h) for x, z in pts], ORANGE)


def happy():
    p = Pumpkin(2.6)
    for sx in (-1, 1):                                           # round eyes
        p.cut([(sx * 0.2 + 0.08 * math.cos(a), 0.14 + 0.09 * math.sin(a))
               for a in [2 * math.pi * k / 6 for k in range(6)]])
    p.cut([(-0.05, 0.0), (0.05, 0.0), (0.0, 0.08)])
    p.arc(0, 0.11, 0.25, 210, 330, 3, 0.13, gap=4)


JACKS = {"jack-small": classic, "jack-medium": scary, "jack-large": happy}

main_for(JACKS, "jack")
