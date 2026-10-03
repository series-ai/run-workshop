"""Crystal ore rock, in the Pirate Nation style.

One chunky icon (rule K3), like the PN ore props: a faceted grey-violet
space boulder (tilted frustums, true slopes, F2) with painted craters and
cracks, split open by big glowing crystals: tall hexagonal cyan points and
a violet cluster, each at its own angle (F5), and loose shards at its foot.
Detail is paint (S1).
"""
import numpy as np

import paint as P
from pnshapes import coords, facets
from voxgrid import C, Asset, Grid, Part


def boulder() -> Grid:
    g = Grid(26, 16, 22)
    X, Y, Z = coords(g)
    g.prism("y", [(2, 5), (9, 1), (19, 2), (24, 8), (22, 17), (13, 21), (4, 18), (1, 11)], 0, 7, C("gray", 4),
            top=[(3, 6), (10, 2.5), (18, 3.5), (22.5, 9), (21, 16), (13, 19.5), (5, 17), (2.5, 11)])
    g.prism("y", [(3, 6), (10, 2.5), (18, 3.5), (22.5, 9), (21, 16), (13, 19.5), (5, 17), (2.5, 11)], 7, 13, C("gray", 4),
            top=[(8, 9), (12, 7), (16, 8), (18, 11), (16, 15), (11, 15), (8, 13), (7, 11)])
    rock = g.a > 0
    for m, fr in facets(g, g.solids):
        P.stone(g, m, "gray", 4, block=(6, 4), mortar=-1, cracks=0.3, frame=fr, seed=2)
    P.flat(g, rock & (P._hash(np.floor(X).astype(int) // 3, np.floor(Y).astype(int) // 3, np.floor(Z).astype(int) // 3, seed=3) % np.uint64(7) == 0), "purple", 4)
    for cx, cy, cz, r in ((6, 4, 3, 2.2), (18, 9, 4, 1.8), (21, 4, 14, 2.0)):
        crater = rock & (np.hypot(np.hypot(X - cx, Y - cy), Z - cz) < r + 1.5)
        P.flat(g, crater, "gray", 3)
        P.flat(g, crater & (np.hypot(np.hypot(X - cx, Y - cy), Z - cz) < r), "purple", 3)
    P.flat(g, rock & (Y < 1), "gray", 3)
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
        ("shard-0", 5, 1.3, "cyan", (24.0, 0.0, 4.0), (0.0, 20.0, -70.0)),
        ("shard-1", 4, 1.2, "purple", (2.0, 0.0, 3.0), (-60.0, 0.0, 20.0)),
    ]
    for name, h, r, ramp, at, rot in specs:
        g = crystal(h, r, ramp)
        root.add(Part(name, g, pivot=(g.shape[0] / 2, 0.0, g.shape[2] / 2), at=at, rot=rot))
    return Asset(id="space-props-ore-rock", pack="space", category="props", name="Crystal Ore Rock", root=root)
