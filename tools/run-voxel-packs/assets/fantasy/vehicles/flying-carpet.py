"""Flying carpet in the Pirate Nation style.

A royal-blue rug that curls up at both long edges like a cradle: seven true
facets across its width (rule F2), a gold border, a red and gold diamond
medallion with a magic-cyan heart (rule C3), cream weave dots, and gold
tassels along every edge. It hovers and sways on `move`, with fairy motes
(PFX) over its middle. About 46 long, 32 wide and 10 tall with the
tassels. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _life import coords, keys, side
from voxgrid import PRISM_PLANE, Asset, Clip, Grid, Part, Socket, sway

SZ = (54, 20, 40)
X0, X1 = 6, 48  # cloth length along x
CX, CZ = 27.0, 20.0
# the cross-section (y, z) of the cloth top: low in the middle, curled up at both edges
PROFILE = [(11.0, 6.0), (8.5, 10.5), (6.5, 15.0), (5.5, 20.0), (6.5, 25.0), (8.5, 29.5), (11.0, 34.0)]
THICK = 1.5


def lowest(g: Grid) -> float:
    """The lowest prism corner (y). The exporter rounds its base shift to half
    voxels, so the lowest corner must lie on a whole voxel to sit on y = 0."""
    out = []
    for s in g.solids:
        u, v = PRISM_PLANE[s.axis]
        if s.axis == "y":
            out.append(s.lo)
        else:
            k = 0 if u == 1 else 1
            out.extend(p[k] for p in s.poly + s.upper)
    return min(out)


def cloth(drop: float = 0.0) -> Grid:
    """The rug, moved down by `drop` (see build)."""
    g = Grid(*SZ)
    parts = []
    profile = [(y - drop, z) for y, z in PROFILE]
    for (y0, z0), (y1, z1) in zip(profile, profile[1:]):
        parts.append(side(g, [(y0, z0), (y1, z1), (y1 - THICK, z1), (y0 - THICK, z0)], X0, X1, "blue", 5))
    outer = np.logical_or.reduce(parts)
    X, Y, Z = coords(g)
    border = outer & ((X < X0 + 3.5) | (X > X1 - 3.5) | (Z < profile[0][1] + 3.5) | (Z > profile[-1][1] - 3.5))
    P.flat(g, border, "gold", 5)
    P.flat(g, border & ((np.abs(X - (X0 + 1.5)) < 0.6) | (np.abs(X - (X1 - 1.5)) < 0.6)), "gold", 4)  # a woven line in the border
    diamond = np.abs(X - CX) + np.abs(Z - CZ) * 1.7
    field = outer & ~border
    P.flat(g, field & (diamond < 12.5), "red", 5)
    P.flat(g, field & (diamond < 8.5), "gold", 6)
    P.flat(g, field & (diamond < 4.2), "cyan", 6)
    P.flat(g, field & (np.abs(diamond - 12.5) < 0.6), "gold", 5)  # a gold line round the medallion
    weave = field & (diamond >= 13.1) & (np.floor(X).astype(int) % 5 == 0) & (np.floor(Z).astype(int) % 4 == 0)
    P.flat(g, weave, "bone", 6)
    # gold tassels: a fringe from both curled edges, and drops along both ends
    for z, y in ((profile[0][1], profile[0][0]), (profile[-1][1], profile[-1][0])):
        out = -1.5 if z < CZ else 1.5
        for x in range(X0 + 2, X1 - 1, 4):
            S.bar(g, "x", (y - 0.5, z), (y - 3.5, z + out), 1.1, x, x + 1.4, "gold", 5)
    for x in (X0, X1):
        out = -1.8 if x == X0 else 1.8
        for y, z in profile[1:-1]:
            S.bar(g, "z", (x, y - 0.7), (x + out, y - 4.0), 1.1, z - 0.7, z + 0.7, "gold", 5)
    return g


def build() -> Asset:
    first = cloth()
    g = cloth(math.floor(lowest(first) * 1e6) / 1e6)  # the lowest tassel tip now lies on y = 0
    if not 0 <= lowest(g) < 1e-5:
        raise ValueError(f"flying-carpet: lowest corner at y={lowest(g)}, expected 0")
    xs, ys, zs = np.nonzero(g.a)
    pivot = ((xs.min() + xs.max() + 1) / 2, float(ys.min()), (zs.min() + zs.max() + 1) / 2)
    root = Part("carpet", g, pivot=pivot)
    ride = {"carpet": {"loc": keys((0, 0, 2, 0), (1, 0, 3.2, 0), (2, 0, 2, 0)), "rot": sway(2.0, amp=(0, 0, 2))}}
    return Asset(id="fantasy-vehicles-flying-carpet", pack="fantasy", category="vehicles", name="Flying Carpet", root=root,
                 clips=[Clip("move", ride)],
                 sockets=[Socket("socket-function", at=(0.0, 10.0, 0.0))],
                 pfx=[{"effectId": "rvx-fantasy-fairy-motes", "socket": "socket-function", "trigger": "clip:move", "size": 12}])
