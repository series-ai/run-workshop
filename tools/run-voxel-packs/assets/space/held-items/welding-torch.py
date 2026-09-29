"""Welding torch: a plasma cutter with a brass fuel canister, a hose
coil, a trigger grip and a ceramic nozzle with a blue-white flame tip.
Held-item frame: nozzle along +X."""
from _kit import C, Grid, held, light


def build():
    g = Grid(30, 12, 8)
    cy, cz = 6, 4
    g.cylinder("x", 7, 4, 3, 0, 9, C("gold", 5))  # canister
    g.cylinder("x", 7, 4, 3.2, 3, 4, C("gold", 3))
    g.box(4, 1, 3, 8, 5, 6, C("iron", 2))  # grip
    g.cylinder("x", 7, 4, 1.5, 9, 22, C("steel", 5))
    g.cylinder("x", 7, 4, 2.0, 12, 14, C("red", 4))
    g.cylinder("x", 7, 4, 2.2, 22, 26, C("bone", 5))  # nozzle
    g.cylinder("x", 7, 4, 1.4, 26, 28, C("plasma", 7))
    g.cylinder("x", 7, 4, 0.8, 28, 30, C("sky", 7))
    g.line((1, 7, 4), (3, 11, 6), 0.6, C("iron", 1))
    light(g)
    return held("welding-torch", "Welding Torch", g, grip=(6, 3, cz), sockets={"socket-flame": (29, 7.5, 4.5)},
                pfx=[{"effectId": "rvx-space-weld-sparks", "socket": "socket-flame", "trigger": "manual", "size": 0.25, "aim": [1.0, 0.0, 0.0]}])
