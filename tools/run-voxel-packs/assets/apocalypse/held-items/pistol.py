"""Scavenged service pistol: a black slide with worn silver edges, a
tan grip with a checkered panel, a bent front sight and a strip of red
tape on the magazine. The muzzle points +X."""
from _kit import FWD, held_asset
from voxgrid import C, Grid


def build():
    g = Grid(22, 13, 4)
    cz = 1
    for k in range(8):  # grip angled back
        g.box(2 + k // 3, k, cz - 1, 7 + k // 3, k + 1, cz + 2, C("khaki", 4))
    for k in range(1, 7, 2):
        g.box(3 + k // 3, k, cz - 1, 6 + k // 3, k + 1, cz, C("khaki", 2))
    g.box(2, 0, cz - 1, 7, 1, cz + 2, C("red", 4))  # taped mag base
    g.box(4, 8, cz - 1, 21, 12, cz + 2, C("iron", 2))  # slide
    g.box(4, 11, cz - 1, 21, 12, cz + 2, C("iron", 3))
    for x in range(5, 10, 2):
        g.box(x, 9, cz - 1, x + 1, 12, cz, C("iron", 0))  # serrations
    g.box(4, 8, cz - 1, 21, 9, cz, C("steel", 5))
    g.box(20, 12, cz, 21, 13, cz + 1, C("steel", 6))  # front sight
    g.box(5, 12, cz, 7, 13, cz + 1, C("steel", 4))
    g.box(8, 5, cz, 12, 8, cz + 1, C("iron", 2))  # trigger guard
    g.set(9, 6, cz, C("steel", 6))
    g.box(20, 9, cz, 21, 11, cz + 1, C("iron", 0))
    return held_asset("pistol", "Service Pistol", g, grip=(5, 4, cz + 0.5), sockets=[("socket-muzzle", (21, 10, cz + 0.5), FWD)],
                      pfx=[{"effectId": "rvx-apocalypse-pistol-shot", "socket": "socket-muzzle", "trigger": "manual", "size": 0.2, "aim": [0.0, 0.0, 1.0]}])
