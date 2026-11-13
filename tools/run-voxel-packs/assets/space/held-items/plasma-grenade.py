"""Plasma grenade: a palm-sized orb grenade with a steel cage, a glowing
plasma core, a red arming button and a pull ring. Held-item frame: the
button end along +X."""
from _kit import C, Grid, held, light, ring


def build():
    g = Grid(12, 10, 10)
    c = (5, 5, 5)
    g.sphere(5, 5, 5, 4.2, C("plasma", 5))
    g.sphere(5, 5, 5, 3.0, C("plasma", 7))
    ring(g, "x", 5, 5, 4.5, 3.6, 4, 6, C("steel", 4))
    ring(g, "y", 5, 5, 4.5, 3.6, 4, 6, C("steel", 4))
    g.box(9, 4, 4, 11, 6, 6, C("steel", 5))
    g.box(11, 4, 4, 12, 6, 6, C("red", 6))
    ring(g, "z", 9, 8, 1.6, 0.8, 4, 6, C("gold", 5))
    light(g)
    return held("plasma-grenade", "Plasma Grenade", g, grip=(4, 3, 5), sockets={"socket-core": (5.5, 5.5, 5.5)},
                pfx=[{"effectId": "rvx-space-plasma-blast", "socket": "socket-core", "trigger": "manual", "size": 0.3}])
