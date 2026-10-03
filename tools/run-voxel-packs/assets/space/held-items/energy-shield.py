"""Energy shield: a forearm-mounted hexagonal energy shield: a steel
emitter frame with a gold boss and a translucent-cyan hex field with
bright cell edges, facing forward (+X)."""
import numpy as np

from _kit import C, Grid, held, idx


def build():
    g = Grid(8, 28, 28)
    x, y, z = idx(g)
    cy, cz = 14, 14
    u, v = y + 0.5 - cy, z + 0.5 - cz
    hexd = np.maximum(np.abs(u) * 0.866 + np.abs(v) * 0.5, np.abs(v))
    face = (hexd < 13) & (x >= 5) & (x < 7)
    g.where(face, C("cyan", 5))
    g.where(face & (x == 6) & ((((y + (z // 4) * 2) % 4) == 0) | (z % 4 == 0)), C("cyan", 7))  # cell lattice
    g.where((hexd >= 11.5) & (hexd < 13) & (x >= 4) & (x < 8), C("steel", 5))  # rim
    g.where((hexd < 3) & (x >= 5) & (x < 8), C("gold", 5))  # boss
    g.where((hexd < 1.5) & (x == 7), C("plasma", 7))
    g.box(0, cy - 1, cz - 1, 5, cy + 2, cz + 2, C("iron", 3))  # arm clamp
    return held("energy-shield", "Energy Shield", g, grip=(1.5, cy + 0.5, cz + 0.5), sockets={"socket-shield": (7.5, cy + 0.5, cz + 0.5)},
                pfx=[{"effectId": "rvx-space-shield-hit", "socket": "socket-shield", "trigger": "manual", "size": 0.32}])
