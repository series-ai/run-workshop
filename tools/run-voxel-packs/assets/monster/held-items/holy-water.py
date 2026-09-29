"""Holy water flask: a round blessed-glass bottle of glowing blue water
with a silver cross cap, cork and a rosary tied around the neck.
Held-item frame: +X forward (the flask), origin = Hand.R joint."""
from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(18, 12, 12)
    c = 6
    g.box(0, c - 1, c - 1, 5, c + 1, c + 1, C("steel", 5))  # neck held in the hand
    g.box(0, c - 1, c - 1, 1, c + 1, c + 1, C("wood", 4))  # cork
    g.box(5, c - 2, c - 2, 7, c + 2, c + 2, C("steel", 6))  # collar
    g.sphere(12, c, c, 5.5, C("sky", 5))  # bottle
    g.sphere(12, c, c, 4.2, C("plasma", 6))  # glowing water
    g.box(10, c + 4, c - 1, 14, c + 6, c + 1, C("sky", 6))
    g.box(11, c - 3, 0, 13, c + 4, 1, C("steel", 7))  # cross on the face
    g.box(9, c, 0, 15, c + 2, 1, C("steel", 7))
    for k in range(6):  # rosary beads
        g.set(6, c - 3 + k, c + 3, C("bone", 6 if k % 2 else 3))
    g.set(6, c - 4, c + 3, C("gold", 5))
    speck(g, 405, 0.08)
    return held("holy-water", "Holy Water", g, (2.5, c, c), {"socket-splash": (12, c, c)},
                pfx=[pfx("rvx-monster-holy-burst", "socket-splash", "manual", size=0.36)])
