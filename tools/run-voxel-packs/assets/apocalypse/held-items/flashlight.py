"""Heavy police flashlight: a long knurled black aluminium tube, a flared
head with a glowing lens, a rubber switch and a wrist strap. The beam
points +X."""
from _kit import FWD, held_asset
from voxgrid import C, Grid


def build():
    g = Grid(34, 11, 11)
    cy = cz = 5
    g.cylinder("x", cy + 0.5, cz + 0.5, 2.2, 0, 24, C("iron", 2))
    for x in range(3, 18, 2):
        g.cylinder("x", cy + 0.5, cz + 0.5, 2.4, x, x + 1, C("iron", 3))  # knurling
    g.cylinder("x", cy + 0.5, cz + 0.5, 2.6, 0, 2, C("iron", 1))  # tail cap
    g.cylinder("x", cy + 0.5, cz + 0.5, 2.4, 24, 26, C("iron", 2), r2=4.2)
    g.cylinder("x", cy + 0.5, cz + 0.5, 4.4, 26, 32, C("iron", 2))
    g.cylinder("x", cy + 0.5, cz + 0.5, 4.6, 30, 32, C("steel", 5))  # bezel
    g.cylinder("x", cy + 0.5, cz + 0.5, 3.4, 32, 33, C("gold", 7))  # lens
    g.cylinder("x", cy + 0.5, cz + 0.5, 1.6, 32, 34, C("ember", 7))
    g.box(18, cy + 2, cz, 21, cy + 4, cz + 1, C("red", 4))  # switch
    g.box(0, cy - 4, cz, 1, cy - 1, cz + 1, C("forest", 3))  # strap
    g.box(1, cy - 4, cz, 2, cy - 3, cz + 1, C("forest", 3))
    return held_asset("flashlight", "Police Flashlight", g, grip=(10, cy + 0.5, cz + 0.5), sockets=[("socket-beam", (34, cy + 0.5, cz + 0.5), FWD)],
                      pfx=[{"effectId": "rvx-apocalypse-flashlight-beam", "socket": "socket-beam", "trigger": "idle", "size": 0.4, "aim": [0.0, 0.0, 1.0]}])
