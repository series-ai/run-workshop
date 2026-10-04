"""Crystal ore outcrop, in the Pirate Nation space style.

A faceted stone core sits in a steel survey collar. Broad stone blocks and
two deliberate violet ore seams lead to the oversized cyan crystal cluster.
"""
import numpy as np

import paint as P
from pnshapes import coords, facets
from voxgrid import C, Asset, Grid, Part


def boulder() -> Grid:
    g = Grid(26, 16, 22)
    X, Y, Z = coords(g)
    # The collar forms a narrow steel lip around the foot of the outcrop.
    collar = [(1, 4), (4, 1), (22, 1), (25, 4), (25, 18), (22, 21), (4, 21), (1, 18)]
    g.prism("y", collar, 0, 3, C("steel", 4))
    collar_mask = g.a > 0
    g.prism("y", [(2, 5), (9, 1), (19, 2), (24, 8), (22, 17), (13, 21), (4, 18), (1, 11)], 0, 7, C("gray", 4),
            top=[(3, 6), (10, 2.5), (18, 3.5), (22.5, 9), (21, 16), (13, 19.5), (5, 17), (2.5, 11)])
    g.prism("y", [(3, 6), (10, 2.5), (18, 3.5), (22.5, 9), (21, 16), (13, 19.5), (5, 17), (2.5, 11)], 7, 13, C("gray", 4),
            top=[(8, 9), (12, 7), (16, 8), (18, 11), (16, 15), (11, 15), (8, 13), (7, 11)])
    rock = np.logical_or.reduce([solid.mask(g.shape) for solid in g.solids[1:]])
    # Give each true face one broad tone. The shape carries the stone
    # facets, so a tile pattern would break the planes into visual noise.
    for i, (m, _fr) in enumerate(facets(g, g.solids[1:])):
        P.flat(g, m, "gray", (4, 5, 3, 4, 5, 4)[i % 6])
    # A single violet ore pocket marks the exposed front plane.
    front = rock & (Z < 6)
    deposit = front & ((((X - 9.0) / 3.8) ** 2 + ((Y - 5.5) / 2.2) ** 2) < 1.0)
    core = front & ((((X - 9.0) / 2.0) ** 2 + ((Y - 5.5) / 1.0) ** 2) < 1.0)
    P.flat(g, deposit, "purple", 4)
    P.flat(g, core, "purple", 6)
    P.flat(g, rock & (Y < 1), "gray", 3)
    # Finish the visible steel lip after the stone pass. Short orange and
    # bone bars mark the front edge as a mining hazard zone.
    collar_visible = collar_mask & ~rock
    P.flat(g, collar_visible, "steel", 4)
    P.flat(g, collar_visible & (Y < 1.0), "iron", 3)
    hazard = collar_visible & (Z < 2.5) & (Y > 0.5)
    P.flat(g, hazard & (np.floor(X / 3) % 2 == 0), "orange", 5)
    P.flat(g, hazard & (np.floor(X / 3) % 2 == 1), "bone", 5)
    return g


def crystal(h: float, r: float, ramp: str) -> Grid:
    """A hexagonal crystal point: a prism with a pyramid tip, a bright face
    and a dark face so its facets read."""
    s = int(np.ceil(2 * r + 2))
    g = Grid(s, int(np.ceil(h)) + 1, s)
    c = s / 2
    import math
    hexa = [(c + r * math.cos(math.pi / 6 + k * math.pi / 3), c + r * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
    g.prism("y", hexa, 0, h * 0.68, C(ramp, 5))
    g.prism("y", hexa, h * 0.68, h, C(ramp, 5), top=[(c, c)] * 6)
    X, Y, Z = coords(g)
    m = g.a > 0
    P.flat(g, m & (X - c > 0.8), ramp, 6)
    P.flat(g, m & (X - c < -0.8), ramp, 4)
    P.flat(g, m & (Y > h * 0.68), ramp, 7)
    P.flat(g, m & (Y < 1.5), ramp, 3)
    return g


def build() -> Asset:
    root = Part("ore-rock", boulder())
    specs = [
        ("crystal-0", 18, 3.0, "cyan", (12.0, 9.0, 11.0), (-8.0, 10.0, 12.0)),
        ("crystal-1", 12, 2.3, "cyan", (16.0, 8.0, 7.0), (-25.0, 30.0, -20.0)),
        ("crystal-2", 11, 2.2, "purple", (8.0, 7.0, 9.0), (-15.0, 0.0, 28.0)),
        ("crystal-3", 8, 1.8, "purple", (6.0, 5.0, 14.0), (20.0, 0.0, 35.0)),
        ("crystal-4", 9, 2.0, "cyan", (18.0, 7.0, 15.0), (22.0, 0.0, -30.0)),
    ]
    for name, h, r, ramp, at, rot in specs:
        g = crystal(h, r, ramp)
        root.add(Part(name, g, pivot=(g.shape[0] / 2, 0.0, g.shape[2] / 2), at=at, rot=rot))
    return Asset(id="space-props-ore-rock", pack="space", category="props", name="Crystal Ore Rock", root=root)
