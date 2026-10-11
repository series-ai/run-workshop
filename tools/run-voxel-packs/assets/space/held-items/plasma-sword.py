"""Plasma sword: a broad cyan energy blade on a plated steel emitter.
Held-item frame: blade along +X."""
from _kit import C, Grid, held


def build():
    g = Grid(48, 12, 8)
    cy, cz = 3, 2

    # A dark grip and broad metal collars hold the hand at the same frame.
    g.box(0, 2, 1, 10, 6, 5, C("iron", 2))
    g.box(0, 2, 1, 2, 6, 5, C("steel", 5))
    g.box(1, 2, 1, 2, 6, 5, C("rust", 4))
    for xx in (3, 6, 9):
        g.box(xx, 2, 1, xx + 1, 6, 5, C("steel", 4))
        g.box(xx, 3, 2, xx + 1, 5, 4, C("iron", 4))
    g.box(2, 3, 1, 9, 5, 2, C("steel", 3))
    g.box(2, 3, 4, 9, 5, 5, C("steel", 3))
    g.box(4, 3, 1, 7, 5, 2, C("cyan", 5))
    g.box(4, 3, 4, 7, 5, 5, C("cyan", 5))
    g.box(0, 2, 1, 1, 6, 5, C("bone", 5))

    # A layered emitter collar gives the blade a heavy, readable root.
    g.box(10, 0, 0, 15, 9, 5, C("iron", 2))
    g.box(10, 1, 0, 14, 8, 5, C("steel", 4))
    g.box(11, 2, 0, 14, 7, 5, C("bone", 5))
    g.box(12, 3, 0, 15, 6, 5, C("steel", 3))
    # Copper jaws and hazard marks frame the central energy aperture.
    g.box(10, 0, 0, 12, 2, 5, C("rust", 5))
    g.box(10, 7, 0, 12, 9, 5, C("rust", 5))
    g.box(11, 2, 0, 12, 3, 5, C("orange", 6))
    g.box(11, 6, 0, 12, 7, 5, C("orange", 6))
    # Recessed cyan cells sit on both sides of the emitter.
    for zz in (0, 4):
        g.box(12, 3, zz, 14, 6, zz + 1, C("iron", 1))
        g.box(12, 3, zz, 13, 6, zz + 1, C("cyan", 6))
        g.set(13, 5, zz, C("cyan", 7))
        g.set(10, 3, zz, C("bone", 6))

    # The blade narrows at the point. Its steel edge frames a bright core.
    g.box(14, 0, 0, 42, 8, 5, C("steel", 3))
    g.box(14, 1, 1, 42, 7, 4, C("iron", 2))
    g.box(14, 1, 0, 42, 7, 1, C("cyan", 5))
    g.box(14, 1, 4, 42, 7, 5, C("cyan", 5))
    g.box(15, 2, 0, 40, 6, 1, C("cyan", 7))
    g.box(15, 2, 4, 40, 6, 5, C("cyan", 7))
    g.box(16, 3, 0, 39, 5, 1, C("bone", 7))
    g.box(16, 3, 4, 39, 5, 5, C("bone", 7))
    # Cyan rails also mark the blade spine and the underside.
    g.box(15, 7, 2, 40, 8, 3, C("cyan", 5))
    g.box(15, 0, 2, 40, 1, 3, C("steel", 2))
    # Short edge marks break the long faces into clean energy plates.
    for xx in (20, 28, 36):
        g.box(xx, 7, 2, xx + 2, 8, 3, C("cyan", 7))
        g.box(xx, 0, 0, xx + 1, 1, 1, C("bone", 5))
        g.box(xx, 6, 0, xx + 1, 7, 1, C("bone", 5))
        g.box(xx, 0, 4, xx + 1, 1, 5, C("bone", 5))
        g.box(xx, 6, 4, xx + 1, 7, 5, C("bone", 5))

    # Three stepped sections form an integrated, faceted blade point.
    g.box(42, 1, 0, 44, 7, 5, C("steel", 4))
    g.box(42, 2, 0, 44, 6, 1, C("cyan", 6))
    g.box(42, 2, 4, 44, 6, 5, C("cyan", 6))
    g.box(44, 2, 1, 46, 6, 4, C("steel", 4))
    g.box(44, 3, 1, 46, 5, 2, C("cyan", 6))
    g.box(44, 3, 3, 46, 5, 4, C("cyan", 6))
    g.box(46, 3, 2, 48, 4, 3, C("cyan", 7))

    return held("plasma-sword", "Plasma Sword", g, grip=(5, cy + 0.5, cz + 0.5), sockets={"socket-tip": (47, cy + 0.5, cz + 0.5), "socket-trail": (30, cy + 0.5, cz + 0.5)},
                pfx=[{"effectId": "rvx-space-plasma-slash", "trigger": "manual", "size": 0.323, "aim": [-1.0, 0.0, 0.0], "offset": [-0.107, 0.03, 0.0]}])
