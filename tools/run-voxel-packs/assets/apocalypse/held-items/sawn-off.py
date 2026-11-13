"""Sawn-off shotgun: a hacked-down double with a pistol grip wrapped in
electrical tape, ragged cut barrels, a rusty receiver and a lanyard ring.
Muzzles point +X."""
from _kit import FWD, held_asset
from voxgrid import C, Grid


def build():
    g = Grid(30, 12, 6)
    cz = 2
    for k in range(7):  # pistol grip angled down and back
        g.box(1 + k // 2, k, cz - 1, 6 + k // 2, k + 1, cz + 2, C("wood", 4 if k % 2 else 3))
    for k in range(1, 6, 2):
        g.box(1 + k // 2, k, cz - 1, 6 + k // 2, k + 1, cz + 2, C("iron", 1))  # tape
    g.box(0, 0, cz, 2, 2, cz + 1, C("steel", 5))  # lanyard ring
    g.box(5, 5, cz - 1, 13, 10, cz + 2, C("rust", 4))  # receiver
    g.box(6, 9, cz - 1, 12, 10, cz + 2, C("rust", 5))
    g.box(8, 10, cz - 1, 10, 11, cz, C("iron", 2))
    g.box(7, 3, cz, 11, 5, cz + 1, C("iron", 2))
    g.box(13, 6, cz - 2, 29, 9, cz + 3, C("iron", 3))  # barrels
    g.box(13, 9, cz, 29, 10, cz + 1, C("iron", 4))
    for z in (cz - 2, cz - 1, cz + 1, cz + 2):  # ragged cut
        g.set(29 if z % 2 else 28, 6, z, C("steel", 6))
    g.box(28, 7, cz - 1, 30, 8, cz, C("iron", 0)).box(28, 7, cz + 1, 30, 8, cz + 2, C("iron", 0))
    g.box(15, 5, cz - 1, 22, 6, cz + 2, C("wood", 5))
    g.box(18, 6, cz - 3, 21, 9, cz - 2, C("khaki", 4))  # tape wrap
    return held_asset("sawn-off", "Sawn-Off Shotgun", g, grip=(4, 3.5, cz + 0.5),
                      sockets=[("socket-muzzle", (30, 7.5, cz + 0.5), FWD)],
                      pfx=[{"effectId": "rvx-apocalypse-shotgun-blast", "socket": "socket-muzzle", "trigger": "manual", "size": 0.3, "aim": [0.0, 0.0, 1.0]}])
