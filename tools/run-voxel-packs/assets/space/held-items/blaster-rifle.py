"""Blaster rifle: a long military blaster with a skeletal stock, a boxy
receiver with vent slots, a scope, a glowing plasma magazine and a finned
barrel shroud. Held-item frame: barrel along +X."""
from _kit import C, Grid, cbox, held, light, speck


def build():
    g = Grid(50, 12, 5)
    cy, cz = 6, 2
    # stock (behind the grip, -x end of the grid)
    g.box(0, 3, 1, 3, 9, 4, C("iron", 3))
    g.line((2, 8, 2), (12, 8, 2), 0.7, C("iron", 3))
    g.line((2, 4, 2), (12, 5, 2), 0.7, C("iron", 3))
    cbox(g, 12, 4, 0, 30, 10, 5, C("khaki", 4), r=1)  # receiver
    for xx in range(19, 28, 2):
        g.box(xx, 8, 0, xx + 1, 9, 5, C("khaki", 2))
    g.box(15, 5, 0, 22, 7, 1, C("plasma", 6))  # side cell
    g.box(20, 0, 1, 24, 4, 4, C("plasma", 5))  # magazine
    g.box(20, 0, 1, 24, 1, 4, C("iron", 2))
    g.box(12, 1, 1, 15, 5, 4, C("iron", 2))  # pistol grip
    g.box(16, 10, 1, 26, 12, 4, C("iron", 2))  # scope
    g.box(25, 10, 1, 26, 12, 4, C("red", 6))
    g.cylinder("x", 7, 2.5, 1.8, 30, 44, C("steel", 4))  # shroud
    for xx in range(31, 44, 3):
        g.cylinder("x", 7, 2.5, 2.4, xx, xx + 1, C("steel", 3))
    g.cylinder("x", 7, 2.5, 1.0, 44, 50, C("steel", 6))
    g.cylinder("x", 7, 2.5, 1.2, 49, 50, C("plasma", 7))
    light(g)
    speck(g, 160, 0.08, ramps=("khaki",))
    return held("blaster-rifle", "Blaster Rifle", g, grip=(13.5, cy - 2, cz + 0.5), sockets={"socket-muzzle": (50, 7.5, 3)},
                pfx=[{"effectId": "rvx-space-laser-bolt", "socket": "socket-muzzle", "trigger": "manual", "size": 0.3, "aim": [1.0, 0.0, 0.0]}])
