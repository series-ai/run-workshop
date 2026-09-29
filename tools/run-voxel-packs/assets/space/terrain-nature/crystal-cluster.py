"""Crystal cluster, in the Pirate Nation terrain style.

A spray of oversized hexagonal crystals, violet and teal, each a hex
prism with a pointed pyramid tip (true slopes), set at different heights
and tilts (rest rotations) in a low faceted rock bed with a few small
shards around it. Each crystal has a lit facet, a darker facet and a
bright tip, like PN painted gems. No clips. Faces -Z.
"""
import numpy as np

from _life import P, Grid, Rig, asset, coords, mask_of, ngon_y, rock
from pnshapes import cone

S = (44, 36, 44)
CX, CZ = 22, 22
YB = 3  # bed top
# (dx, dz, radius, height, tilt about x, tilt about z, ramp)
CRYSTALS = [(0, 1, 5.0, 20, -6, -6, "purple"), (8, -3, 3.6, 14, -14, -24, "cyan"), (-8, -3, 3.8, 15, -12, 24, "purple"),
            (5, 8, 3.2, 12, 22, -14, "cyan"), (-6, 7, 3.0, 11, 20, 18, "purple"), (12, 4, 2.4, 8, 6, -38, "cyan"),
            (-12, 0, 2.4, 8, 0, 40, "cyan"), (1, -9, 2.6, 9, -30, 4, "purple")]


def bed() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    solids = rock(g, CX, CZ, 0, 15, 6, "steel", 4, n=8, seed=5, squash=0.9)
    m = mask_of(g, solids)
    P.flat(g, m, "steel", 4)
    P.flat(g, m & (Y > 4), "steel", 5)
    for k, (sx, sz) in enumerate(((CX + 14, CZ - 9), (CX - 15, CZ + 8), (CX - 10, CZ - 12))):
        shard = cone(g, "y", sx, sz, 1.4, 0, 4, "purple" if k % 2 else "cyan", 6, n=6)
        P.flat(g, shard, "purple" if k % 2 else "cyan", 6)
    return g


def crystal(dx, dz, r, h, ramp) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    cx, cz = CX + dx, CZ + dz
    body = ngon_y(g, cx, cz, r, YB - 2, YB + h, ramp, 5, n=6)
    tip = cone(g, "y", cx, cz, r, YB + h, YB + h + r * 1.8, ramp, 6, n=6)
    m = body | tip
    ang = np.arctan2(Z - cz, X - cx)
    sector = np.floor((ang + np.pi) / (2 * np.pi) * 6).astype(int) % 6
    P.flat(g, m, ramp, 5)
    P.flat(g, m & ((sector == 2) | (sector == 3)), ramp, 6)  # lit facets
    P.flat(g, m & (sector == 5), ramp, 4)
    P.flat(g, tip, ramp, 7)
    P.flat(g, body & (np.hypot(X - cx, Z - cz) < r * 0.45) & (Y > YB + 2), ramp, 7)  # the glowing core
    return g


def build():
    rig = Rig()
    rig.add("crystal-cluster", bed(), (CX, 0, CZ))
    for k, (dx, dz, r, h, tx, tz, ramp) in enumerate(CRYSTALS):
        rig.add(f"crystal-{k}", crystal(dx, dz, r, h, ramp), (CX + dx, YB - 2, CZ + dz), "crystal-cluster", rot=(tx, 0.0, tz))
    return asset("terrain-nature", "crystal-cluster", "Crystal Cluster", rig.root)
