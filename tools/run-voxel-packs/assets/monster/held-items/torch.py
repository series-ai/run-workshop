"""Pitch torch: a knotted wooden shaft with an iron cage head packed
with burning pitch-soaked rags.
Held-item frame: +X forward (flame), origin = Hand.R joint."""
from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(28, 10, 10)
    c = 5
    g.box(0, c - 1, c - 1, 20, c + 1, c + 1, C("wood", 3))
    for x in (4, 11, 16):
        g.box(x, c - 1, c - 1, x + 1, c + 1, c + 1, C("wood", 2))
    g.box(18, c - 2, c - 2, 24, c + 2, c + 2, C("sand", 2))  # rags
    for yy, zz in ((c - 3, c - 3), (c + 2, c - 3), (c - 3, c + 2), (c + 2, c + 2)):
        g.box(18, yy, zz, 24, yy + 1, zz + 1, C("iron", 3))  # cage bars
    g.ellipsoid(25, c, c, 3, 2.6, 2.6, C("ember", 4))
    g.ellipsoid(26, c, c, 1.6, 1.4, 1.4, C("ember", 6))
    speck(g, 408, 0.12)
    return held("torch", "Pitch Torch", g, (8, c, c), {"socket-flame": (26, c, c)},
                pfx=[pfx("rvx-monster-torch-flame", "socket-flame", "manual", size=0.16, aim=(1.0, 0.0, 0.0))])
