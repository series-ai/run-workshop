"""Heavy crossbow: an oak stock with a brass trigger plate, a steel prod
(bow) across the front, a taut string, a loaded bolt and a stirrup at the
nose. Bolt along +X; held at the trigger grip."""
from _kit import held
from voxgrid import C, Grid


def build():
    L = 38
    g = Grid(L, 10, 25)
    cy, cz = 5, 12
    g.box(0, cy - 3, cz - 1, 10, cy + 1, cz + 2, C("wood", 3))  # butt
    g.box(0, cy - 3, cz - 1, 2, cy + 1, cz + 2, C("darkwood", 2))
    g.box(10, cy - 1, cz - 1, 32, cy + 1, cz + 2, C("wood", 4))  # tiller
    g.box(9, cy - 4, cz, 12, cy - 1, cz + 1, C("darkwood", 3))  # grip below
    g.box(12, cy - 2, cz - 1, 16, cy - 1, cz + 2, C("orange", 4))  # trigger plate
    g.box(13, cy - 4, cz, 14, cy - 2, cz + 1, C("iron", 5))  # trigger
    for dz in range(-11, 12):  # prod: a shallow V toward +x at the ends
        x = 28 + abs(dz) // 4
        g.box(x, cy, cz + dz, x + 2, cy + 1, cz + dz + 1, C("steel", 5 if abs(dz) < 9 else 6))
    g.box(27, cy - 1, cz - 2, 31, cy + 2, cz + 3, C("iron", 3))
    for dz in range(-10, 11):  # string drawn back
        x = int(29 - (10 - abs(dz)) * 1.2) + abs(dz) // 4
        g.set(x, cy + 1, cz + dz, C("bone", 7))
    g.box(17, cy + 1, cz, 36, cy + 2, cz + 1, C("wood", 5))  # bolt
    g.box(36, cy + 1, cz, 38, cy + 2, cz + 1, C("steel", 6))
    g.box(17, cy + 1, cz - 1, 19, cy + 2, cz + 2, C("red", 4))
    g.box(32, cy - 2, cz - 1, 34, cy + 1, cz + 2, C("iron", 4))  # stirrup
    g.box(34, cy - 3, cz - 2, 35, cy - 2, cz + 3, C("iron", 4))
    return held("crossbow", "Heavy Crossbow", g, (10.5, cy - 2.5, cz + 0.5), {"socket-muzzle": (37, cy + 1.5, cz + 0.5)},
                [{"effectId": "rvx-fantasy-bow-release", "socket": "socket-muzzle", "trigger": "manual", "size": 0.2, "aim": [1.0, 0.0, 0.0]}])
