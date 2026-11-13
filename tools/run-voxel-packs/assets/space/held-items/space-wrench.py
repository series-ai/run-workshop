"""Space wrench: a heavy engineer's spanner with an orange rubber grip, a
steel shaft with a glowing torque gauge and an open jaw head. Held-item
frame: head along +X."""
from _kit import C, Grid, held, light


def build():
    g = Grid(34, 12, 4)
    cy, cz = 6, 1.5
    g.box(0, cy - 1, 0, 11, cy + 2, 3, C("orange", 5))  # grip
    for xx in range(1, 11, 3):
        g.box(xx, cy - 1, 0, xx + 1, cy + 2, 3, C("orange", 3))
    g.box(11, cy - 1, 1, 26, cy + 2, 2, C("steel", 5))  # shaft
    g.box(15, cy - 1, 0, 19, cy + 2, 3, C("iron", 2))
    g.box(16, cy, 0, 18, cy + 1, 1, C("plasma", 7))
    g.box(26, 1, 0, 34, 11, 3, C("steel", 6))  # head
    g.box(29, 4, 0, 34, 8, 3, 0)  # open jaw
    g.box(26, 1, 0, 27, 11, 3, C("steel", 4))
    light(g)
    return held("space-wrench", "Space Wrench", g, grip=(5, cy + 0.5, cz), sockets={"socket-tip": (33, cy + 0.5, cz)})
