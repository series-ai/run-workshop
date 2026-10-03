"""Pulse SMG: a stubby rapid-fire sub-machine gun in navy and chrome with a
drum magenta cell, a foregrip, a red-dot sight and a vented barrel.
Held-item frame: barrel along +X."""
from _kit import C, Grid, cbox, held, light, ring


def build():
    g = Grid(32, 14, 7)
    cy, cz = 8, 3.5
    cbox(g, 0, 5, 0, 20, 11, 7, C("navy", 4), r=1)
    g.box(0, 8, 1, 3, 10, 6, C("navy", 2))
    g.box(4, 0, 2, 8, 5, 5, C("iron", 2))  # grip
    g.cylinder("z", 3, 13, 3.4, 0, 7, C("magenta", 5)) if False else None
    g.cylinder("z", 13, 3, 3.3, 1, 6, C("magenta", 5))  # drum cell
    g.cylinder("z", 13, 3, 1.4, 0, 7, C("magenta", 7))
    g.box(10, 11, 2, 16, 13, 5, C("steel", 5))  # sight
    g.set(15, 12, 3, C("red", 7))
    g.cylinder("x", cy, cz, 2.0, 20, 30, C("steel", 5))
    for xx in range(21, 29, 2):
        ring(g, "x", cy, cz, 2.5, 1.8, xx, xx + 1, C("iron", 2))
    g.cylinder("x", cy, cz, 1.0, 30, 32, C("plasma", 7))
    g.box(21, 3, 2, 24, 6, 5, C("iron", 3))  # foregrip
    g.box(0, 6, 0, 18, 7, 7, C("gold", 5))
    light(g)
    return held("pulse-smg", "Pulse SMG", g, grip=(6, 3, cz), sockets={"socket-muzzle": (32, cy + 0.5, cz)},
                pfx=[{"effectId": "rvx-space-laser-bolt", "socket": "socket-muzzle", "trigger": "manual", "size": 0.25, "aim": [1.0, 0.0, 0.0]}])
