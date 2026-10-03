"""Pitch torch: a wooden handle bound with cloth, an iron cup and a
burning head of tongues of flame. Flame along +X."""
from _kit import held
from voxgrid import C, Grid


def build():
    g = Grid(30, 9, 9)
    cy = cz = 4
    g.box(0, cy - 1, cz - 1, 18, cy + 1, cz + 1, C("wood", 3))
    for x in range(3, 10, 2):
        g.box(x, cy - 1, cz - 1, x + 1, cy + 1, cz + 1, C("sand", 4))
    g.box(17, cy - 2, cz - 2, 21, cy + 2, cz + 2, C("iron", 3))
    g.box(20, cy - 2, cz - 2, 22, cy + 2, cz + 2, C("darkwood", 1))
    for k in range(8):
        w = 2 if k < 3 else 1
        c = C("ember", 6) if k < 2 else (C("ember", 4) if k < 5 else C("red", 5))
        g.box(22 + k, cy - w + (k % 2) * 0, cz - w, 23 + k, cy + w, cz + w, c)
    g.set(27, cy + 1, cz, C("ember", 3)).set(25, cy - 2, cz + 1, C("ember", 5))
    return held("torch", "Pitch Torch", g, (8, cy, cz), {"socket-flame": (25, cy, cz)},
                [{"effectId": "rvx-fantasy-torch-flame", "socket": "socket-flame", "trigger": "manual", "size": 0.16, "aim": [1.0, 0.0, 0.0]}])
