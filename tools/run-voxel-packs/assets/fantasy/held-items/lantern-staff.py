"""Pilgrim's lantern staff: a short crook of darkwood with an iron hook
from which a caged lantern hangs, glowing warm. Crook along +X."""
from _kit import held
from voxgrid import C, Grid


def build():
    g = Grid(34, 12, 9)
    cy, cz = 7, 4
    g.box(0, cy - 1, cz - 1, 26, cy + 1, cz + 1, C("darkwood", 4))
    g.box(3, cy - 1, cz - 1, 10, cy + 1, cz + 1, C("wood", 3))
    for k in range(6):  # crook curling down
        g.box(26 + k, cy - 1 + (k > 3) * (-(k - 3)), cz - 1, 27 + k, cy + 1 + (k > 3) * (-(k - 3)), cz + 1, C("darkwood", 4))
    g.box(31, cy - 5, cz - 1, 33, cy - 2, cz + 1, C("darkwood", 4))
    g.box(31, cy - 7, cz, 32, cy - 5, cz + 1, C("iron", 4))  # chain
    lx, ly, lz = 29, 0, cz - 2
    g.box(lx, ly, lz, lx + 5, ly + 1, lz + 5, C("iron", 3))
    g.box(lx, ly + 1, lz, lx + 5, ly + 5, lz + 5, C("ember", 6))
    g.box(lx + 1, ly + 2, lz, lx + 4, ly + 4, lz + 5, C("ember", 7))
    for px in (lx, lx + 4):
        for pz in (lz, lz + 4):
            g.box(px, ly + 1, pz, px + 1, ly + 5, pz + 1, C("iron", 3))
    g.box(lx, 5, lz, lx + 5, 6, lz + 5, C("iron", 4))
    return held("lantern-staff", "Lantern Staff", g, (6.5, cy, cz), {"socket-light": (31.5, 3, cz)},
                [{"effectId": "rvx-fantasy-torch-flame", "socket": "socket-light", "trigger": "manual", "size": 0.12, "aim": [1.0, 0.0, 0.0]}])
