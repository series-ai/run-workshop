"""Dungeon floor tile, in the Pirate Nation haunted style.

Two by two PN tiles (32 x 32, 4 high), after PN deco-footpath-zombie: one
flat solid slab (no relief noise) painted as big grey flagstones of mixed
sizes. Each stone has a soft +-1 ramp, a lit near edge and a shaded far
edge; dark mortar joints lie on the low edges of each stone only, so the
tile repeats on the 16-voxel grid without double lines. A few cracks,
moss in the joints, and one chunky bone lying on top.
Faces -Z.
"""
import numpy as np

import paint as P
from _kit import single
from _life import coords, plan, quad
from voxgrid import C, Grid

N, H = 32, 4


def flagstones(n: int, seed: int, lo: int = 6):
    """Split an n x n square into stones of mixed sizes (deterministic
    recursive cuts). Returns an int map [x, z] -> stone id and the list of
    stones (x0, z0, x1, z1)."""
    stones = []

    def cut(x0, z0, x1, z1, depth):
        w, d = x1 - x0, z1 - z0
        h = int(P._hash(np.array(x0 * 97 + z0 * 13 + depth), seed=seed)) % 1000
        if (w < 2 * lo and d < 2 * lo) or (depth >= 3 and h % 3 == 0 and w < 16 and d < 16):
            stones.append((x0, z0, x1, z1))
            return
        along_x = w >= d if w != d else h % 2 == 0
        if along_x and w >= 2 * lo:
            k = x0 + lo + h % max(1, w - 2 * lo + 1)
            cut(x0, z0, k, z1, depth + 1)
            cut(k, z0, x1, z1, depth + 1)
        elif d >= 2 * lo:
            k = z0 + lo + h % max(1, d - 2 * lo + 1)
            cut(x0, z0, x1, k, depth + 1)
            cut(x0, k, x1, z1, depth + 1)
        else:
            stones.append((x0, z0, x1, z1))

    cut(0, 0, n, n, 0)
    ids = np.zeros((n, n), dtype=int)
    for i, (x0, z0, x1, z1) in enumerate(stones):
        ids[x0:x1, z0:z1] = i
    return ids, stones


def paint_flags(g: Grid, mask, ids, stones, seed: int, ramp: str = "stone", base: int = 5):
    """Paint flagstones on a solid slab: per-stone shade, lit near edges,
    shaded far edges, mortar on the low edges only, a few cracks, moss in
    some joints. Side faces carry the same stones (vertical joints)."""
    X, Y, Z = coords(g)
    xi, zi = np.clip(X, 0, ids.shape[0] - 1), np.clip(Z, 0, ids.shape[1] - 1)
    sid = ids[xi, zi]
    arr = np.array(stones)
    x0, z0, x1, z1 = (arr[:, k][sid] for k in range(4))
    shade = base + P._jitter(P._hash(sid, seed=seed))
    shade = np.where((X == x1 - 1) | (Z == z1 - 1), shade - 1, shade)  # far edges in shade
    shade = np.where((X == x0 + 1) | (Z == z0 + 1), shade + 1, shade)  # near edges catch the light
    crack = ((P._hash(sid, seed=seed + 1) % np.uint64(4)) == 0) & (np.abs((X - x0) - (Z - z0) * (x1 - x0) / np.maximum(1, z1 - z0)) < 0.6)
    crack &= (X > x0 + 1) & (X < x1 - 2) & (Z > z0 + 1) & (Z < z1 - 2)
    shade = np.where(crack, base - 2, shade)
    joint = (X == x0) | (Z == z0)
    shade = np.where(Y == 0, np.minimum(shade, base - 1), shade)
    slate = (P._hash(sid, seed=seed + 22) % np.uint64(4)) == 0  # some stones are purple slate
    P._paint(g, mask & ~slate, ramp, shade)
    P._paint(g, mask & slate, "purple", shade)
    P.flat(g, mask & joint, "teal", 2)  # dark green-grey mortar
    # moss creeping out of some joints (a soft two-shade band)
    near = joint | (((X == x0 + 1) | (Z == z0 + 1)) & ((P._hash(X, Z, seed=seed + 3) % np.uint64(2)) == 0))
    mossy = mask & near & ((P._hash(X // 5, Z // 5, seed=seed + 2) % np.uint64(3)) == 0) & (Y >= H - 1)
    P.flat(g, mossy & joint, "moss", 5)
    P.flat(g, mossy & ~joint, "moss", 6)


def bone(g: Grid, cx: float, cz: float, y0: int, length: float, angle: float, ramp: str = "bone", base: int = 6):
    """A chunky bone lying on the floor: a sloped-end shaft (true slopes in
    plan) with two knobbed ends."""
    import math

    ux, uz = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    p0 = (cx - ux * length / 2, cz - uz * length / 2)
    p1 = (cx + ux * length / 2, cz + uz * length / 2)
    m = plan(g, quad(p0, p1, 1.0), y0, y0 + 2, ramp, base)
    for px, pz in (p0, p1):
        for s in (-1, 1):
            kx, kz = px - uz * s * 1.2, pz + ux * s * 1.2
            m |= plan(g, [(kx - 1.3, kz - 1.3), (kx + 1.3, kz - 1.3), (kx + 1.3, kz + 1.3), (kx - 1.3, kz + 1.3)], y0, y0 + 2, ramp, base)
    X, Y, Z = coords(g)
    P.flat(g, m & (Y == y0), ramp, base - 1)
    return m


def build():
    g = Grid(N, H + 2, N)
    X, Y, Z = coords(g)
    slab = np.zeros(g.shape, dtype=bool)
    slab[:, :H, :] = True
    g.a[slab] = C("gray", 5)
    ids, stones = flagstones(N, seed=138)
    paint_flags(g, slab, ids, stones, seed=138)
    bone(g, 10.5, 22.5, H, 8, 30)
    return single("dungeon-floor", "terrain-nature", "Dungeon Floor Tile", g)
