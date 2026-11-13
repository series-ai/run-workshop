"""Laser pistol: a compact retro sidearm with a white body, red cooling
fins, a gold trigger guard, a glowing plasma cell and a cyan emitter tip.
Held-item frame: barrel along +X."""
from _kit import C, Grid, cbox, held, light


def build():
    g = Grid(22, 12, 5)
    cy, cz = 7, 2
    cbox(g, 2, 5, 0, 17, 10, 5, C("bone", 6), r=1)  # body
    g.box(17, 6, 1, 21, 9, 4, C("steel", 5))  # barrel
    g.box(21, 6, 1, 22, 9, 4, C("plasma", 6))
    g.set(21, 7, 2, C("plasma", 7))
    for xx in (10, 12, 14):
        g.box(xx, 10, 1, xx + 1, 12, 4, C("red", 4))  # fins
    g.box(4, 0, 1, 8, 6, 4, C("iron", 3))  # handle (palm side)
    g.box(4, 1, 1, 5, 5, 4, C("iron", 2))
    g.box(8, 3, 2, 11, 4, 3, C("gold", 5))  # trigger guard
    g.box(10, 4, 2, 11, 5, 3, C("gold", 5))
    g.box(6, 6, 0, 14, 8, 1, C("plasma", 5))  # cell window
    g.box(6, 6, 4, 14, 8, 5, C("plasma", 5))
    g.box(2, 9, 1, 5, 10, 4, C("red", 5))
    light(g)
    return held("laser-pistol", "Laser Pistol", g, grip=(6, cy, cz + 0.5), sockets={"socket-muzzle": (22, cy + 0.5, cz + 0.5)},
                pfx=[{"effectId": "rvx-space-laser-bolt", "socket": "socket-muzzle", "trigger": "manual", "size": 0.22, "aim": [1.0, 0.0, 0.0]}])
