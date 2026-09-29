"""Data pad: a rugged holo tablet with a bumpered sky-blue frame, a glowing
star-map screen and a holo emitter that projects a small cyan planet.
Held-item frame: the emitter end along +X, screen facing +Y."""
from _kit import C, Grid, cbox, held


def build():
    g = Grid(24, 10, 14)
    cy = 2
    cbox(g, 0, 0, 0, 18, 2, 14, C("sky", 4), r=1)
    g.box(2, 2, 2, 16, 3, 12, C("navy", 1))  # screen
    for xx, zz in ((4, 4), (7, 9), (10, 5), (13, 8), (6, 6), (12, 11)):
        g.set(xx, 2, zz, C("plasma", 7))
    g.line((4, 2.5, 4.5), (10, 2.5, 5.5), 0.35, C("plasma", 5))
    g.line((10, 2.5, 5.5), (13, 2.5, 8.5), 0.35, C("plasma", 5))
    g.box(18, 0, 5, 20, 2, 9, C("steel", 5))  # emitter
    g.sphere(22, 6, 7, 2.2, C("plasma", 5))  # holo planet
    g.set(21, 7, 6, C("plasma", 7))
    return held("data-pad", "Holo Data Pad", g, grip=(6, 1, 7), sockets={"socket-holo": (22, 6, 7)},
                pfx=[{"effectId": "rvx-space-holo-scan", "socket": "socket-holo", "trigger": "manual", "size": 0.3}])
