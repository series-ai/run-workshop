"""Laser cannon: a heavy two-handed beam cannon with an orange armoured
housing, a coil-wrapped focusing barrel, a glowing charge chamber, a carry
handle and a hazard-striped muzzle collar. Held-item frame: barrel +X."""
from _kit import C, Grid, cbox, held, idx, light, ring, speck, stripes


def build():
    g = Grid(56, 16, 9)
    cy, cz = 8, 4.5
    x, y, z = idx(g)
    cbox(g, 0, 3, 0, 26, 13, 9, C("orange", 4), r=2)  # housing
    g.box(8, 5, 0, 20, 11, 1, C("iron", 2))  # charge window
    g.box(9, 6, 0, 19, 10, 1, C("plasma", 5))
    g.box(9, 7, 0, 19, 9, 1, C("plasma", 7))
    g.box(8, 5, 8, 20, 11, 9, C("plasma", 5))
    g.box(4, 13, 3, 20, 14, 6, C("iron", 3))  # carry handle
    g.box(4, 13, 3, 5, 16, 6, C("iron", 3)).box(19, 13, 3, 20, 16, 6, C("iron", 3))
    g.box(4, 15, 3, 20, 16, 6, C("iron", 2))
    g.box(6, 0, 3, 10, 4, 6, C("iron", 2))  # grip
    g.cylinder("x", cy, cz, 3.2, 26, 48, C("steel", 3))
    for xx in range(27, 46, 3):
        ring(g, "x", cy, cz, 3.8, 2.8, xx, xx + 2, C("gold", 4))  # coils
    g.cylinder("x", cy, cz, 4.2, 48, 52, C("steel", 5))
    stripes(g, (x >= 48) & (x < 52), C("gold", 5), C("iron", 1), 2, d=(0, 1, 1))
    g.cylinder("x", cy, cz, 2.6, 52, 56, C("steel", 4))
    g.cylinder("x", cy, cz, 1.8, 55, 56, C("red", 7))
    light(g)
    speck(g, 161, 0.08, ramps=("orange",))
    return held("laser-cannon", "Laser Cannon", g, grip=(8, 2, cz), sockets={"socket-muzzle": (56, cy + 0.5, cz)},
                pfx=[{"effectId": "rvx-space-laser-bolt", "socket": "socket-muzzle", "trigger": "manual", "size": 0.4, "aim": [1.0, 0.0, 0.0]}])
