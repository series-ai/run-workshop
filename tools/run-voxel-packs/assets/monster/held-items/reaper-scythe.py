"""Reaper's scythe: a long crooked black snath with two grips, a bone
collar and a great curved blade with a blood-rust edge.
Held-item frame: +X forward (blade end), origin = Hand.R joint."""
import math

from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(56, 30, 5)
    cy, cz = 4, 2
    for x in range(0, 50):
        oy = math.sin(x / 50 * math.pi) * 1.5
        g.box(x, cy + oy, cz - 1, x + 1, cy + oy + 2, cz + 2, C("iron", 2 if x % 7 else 1))
    g.box(18, cy - 2, cz - 1, 20, cy + 4, cz + 2, C("darkwood", 3))  # second grip peg
    g.box(46, cy - 1, cz - 1, 50, cy + 3, cz + 2, C("bone", 5))  # collar
    for k in range(34):  # blade arcs up (+y) and back (-x)
        t = k / 33
        bx = 50 - math.sin(t * 2.2) * 22
        by = cy + 2 + t * 24
        w = 3.5 * (1 - t) + 0.8
        g.line((bx, by, cz + 0.5), (bx + w, by - w * 0.6, cz + 0.5), 0.6, C("steel", 5))
        g.set(bx - 0.2, by, cz, C("blood", 3 if k % 3 else 4))  # rusty cutting edge
    speck(g, 407, 0.1)
    return held("reaper-scythe", "Reaper's Scythe", g, (8, cy + 1, cz + 0.5), {"socket-blade": (38, 22, 2.5)},
                pfx=[pfx("rvx-monster-reaper-slash", None, "manual", size=0.352, aim=(-1.0, 0.0, 0.0), offset=(-0.117, 0.03, 0.11))])
