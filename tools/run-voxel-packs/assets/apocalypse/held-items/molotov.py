"""Molotov cocktail: a green glass bottle half full of amber fuel, a torn
rag stuffed in the neck with a lit flame on the wick. The wick points +X."""
from _kit import held_asset
from voxgrid import C, Grid


def build():
    g = Grid(26, 11, 11)
    cy = cz = 5
    g.cylinder("x", cy + 0.5, cz + 0.5, 4, 0, 11, C("forest", 5))  # bottle body
    g.cylinder("x", cy + 0.5, cz + 0.5, 3.2, 1, 10, C("orange", 3))  # fuel inside
    g.box(1, cy - 3, cz - 4, 10, cy + 1, cz - 2, C("orange", 4))  # fuel seen through the glass
    g.box(2, cy + 3, cz - 3, 4, cy + 4, cz - 2, C("forest", 7))  # glint
    g.cylinder("x", cy + 0.5, cz + 0.5, 4, 11, 14, C("forest", 4), r2=1.6)  # shoulder
    g.cylinder("x", cy + 0.5, cz + 0.5, 1.6, 14, 18, C("forest", 4))  # neck
    g.box(3, cy - 1, cz - 4, 8, cy + 2, cz - 3, C("bone", 6))  # label
    g.box(4, cy, cz - 4, 7, cy + 1, cz - 3, C("red", 4))
    # rag
    g.box(17, cy - 1, cz - 1, 21, cy + 2, cz + 2, C("bone", 5))
    g.line((17, cy + 1, cz + 1), (13, cy - 3, cz + 3), 0.8, C("bone", 4))  # trailing rag end
    g.box(20, cy - 1, cz - 1, 21, cy + 2, cz + 2, C("iron", 2))  # charred
    # flame
    g.box(21, cy - 1, cz - 1, 24, cy + 2, cz + 2, C("orange", 4))
    g.box(22, cy, cz, 26, cy + 1, cz + 1, C("ember", 4))
    g.set(23, cy + 2, cz, C("ember", 5)).set(24, cy - 1, cz + 1, C("gold", 5))
    return held_asset("molotov", "Molotov Cocktail", g, grip=(6, cy + 0.5, cz + 0.5), sockets=[("socket-wick", (22, cy + 0.5, cz + 0.5))],
                      pfx=[{"effectId": "rvx-apocalypse-wick-flame", "socket": "socket-wick", "trigger": "idle", "size": 0.1, "aim": [1.0, 0.0, 0.0]}])
