"""Scavenged frying pan with a forged steel bowl and a wrapped ash handle.

The cooking face points +Y. A repaired teal plate and a few worn scratches
break up the steel without turning the face into a tiled pattern.
"""
import math

from _kit import held_asset
from voxgrid import C, Grid


def build():
    g = Grid(40, 5, 20)
    cz = 10

    # The handle has a dark steel core, warm wood cheeks and a bright wrapped
    # grip. Keep the grip centred on the Hand.R frame at the original point.
    g.box(0, 2, cz - 1, 22, 4, cz + 1, C("wood", 4))
    g.box(1, 2, cz - 1, 22, 4, cz, C("darkwood", 3))
    g.box(1, 2, cz + 1, 22, 4, cz + 2, C("darkwood", 3))
    for x in range(2, 11):
        g.box(x, 2, cz - 1, x + 1, 4, cz + 1, C("gold", 5 if x % 3 else 4))
        if x % 3 == 0:
            g.box(x, 2, cz - 1, x + 1, 4, cz + 1, C("rust", 3))
    # Dark end cap and the punched hanging hole.
    g.box(0, 2, cz - 1, 2, 4, cz + 1, C("iron", 2))
    g.set(1, 3, cz, 0)
    # A teal enamel stripe and two signal-red paint chips on the shaft.
    g.box(11, 3, cz - 1, 18, 4, cz, C("teal", 4))
    g.box(15, 3, cz + 1, 17, 4, cz + 2, C("red", 4))
    g.box(18, 2, cz - 1, 22, 4, cz + 1, C("iron", 3))
    g.box(19, 3, cz - 1, 21, 4, cz + 1, C("rust", 4))  # forged neck

    # Solid pan base. The broad, continuous steel face stays readable at a
    # distance; only the raised outer band receives segmented wear marks.
    pcx = 29.5
    for x in range(19, 40):
        for z in range(20):
            d = math.hypot(x + 0.5 - pcx, z + 0.5 - cz)
            if d <= 9.8:
                g.set(x, 1, z, C("steel", 3))
                if d <= 8.25:
                    # A broad, even cooking surface with one soft central tone.
                    shade = 4 if d < 5.0 else 3
                    g.set(x, 2, z, C("steel", shade))
                else:
                    # One dark inner seam and one continuous steel crown.
                    g.set(x, 2, z, C("iron", 3))
                    g.set(x, 3, z, C("steel", 4))

    # A short steel lip at the bowl's throat. The dark seam frames the bowl.
    for x in range(20, 24):
        for z in range(8, 12):
            d = math.hypot(x + 0.5 - pcx, z + 0.5 - cz)
            if d <= 8.25:
                g.set(x, 2, z, C("steel", 5))

    # Localized polished scuffs and a copper repair patch. These marks sit on
    # the face and leave most of the pan as one metal surface.
    g.box(25, 2, 5, 29, 3, 6, C("steel", 4))
    g.box(27, 2, 6, 30, 3, 7, C("steel", 5))
    g.box(31, 2, 13, 35, 3, 15, C("rust", 4))
    g.box(32, 2, 14, 34, 3, 15, C("rust", 3))
    for x, z in ((31, 13), (34, 13), (31, 14), (34, 14)):
        g.set(x, 2, z, C("steel", 5))
    # A small bone skull stencil gives the pan a clear apocalypse identity.
    skull = {
        7: (29, 30, 31),
        8: (28, 29, 30, 31, 32),
        9: (27, 28, 29, 30, 31, 32, 33),
        10: (27, 28, 29, 30, 31, 32, 33),
        11: (27, 28, 29, 30, 31, 32, 33),
        12: (28, 29, 30, 31, 32),
        13: (28, 29, 30, 31, 32),
    }
    for z, xs in skull.items():
        for x in xs:
            g.set(x, 2, z, C("bone", 5))
    for z in (10, 11):
        g.set(29, 2, z, C("darkwood", 3))
        g.set(31, 2, z, C("darkwood", 3))
    # The jaw teeth use signal red paint, like a hurried scavenger stencil.
    g.set(29, 2, 13, C("red", 4)).set(31, 2, 13, C("red", 4))

    # A teal maker stamp on the underside keeps the back face identifiable.
    g.box(27, 1, 8, 32, 2, 13, C("teal", 3))
    g.box(28, 1, 9, 31, 2, 12, C("steel", 4))
    g.set(29, 1, 8, C("gold", 5)).set(30, 1, 8, C("gold", 5))

    # One short rust chip on the rim keeps the wear localized.
    g.set(22, 3, 6, C("rust", 4)).set(23, 3, 6, C("rust", 4))
    # A pair of rivets secures the handle through the pan throat.
    g.set(21, 2, cz - 1, C("steel", 5)).set(21, 2, cz, C("steel", 5))

    return held_asset("frying-pan", "Frying Pan", g, grip=(5, 3, cz), sockets=[("socket-tip", (39, 2, cz))],
                      pfx=[{"effectId": "rvx-apocalypse-metal-clang", "socket": "socket-tip", "trigger": "manual", "size": 0.42}])
