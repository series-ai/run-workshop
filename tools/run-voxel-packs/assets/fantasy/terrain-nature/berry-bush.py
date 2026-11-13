"""Berry bush in the Pirate Nation style.

A round, low bush built from seven chunky leaf blocks (chamfered, with
true-slope bevels, rule F2) in two greens, so it reads as one dome with
lumps. Berries hang in bunches on the leaf faces: four round beads that stand
out of the leaves (red with a lit dot) in a loose diamond, with a ring of
painted berries round them (rule S1), plus a few dark purple bunches. A small
wicker basket half full of picked berries stands at the front (the one
story prop, rule F4). An oval turf patch with soft grass tones, two tufts
and fallen leaves finishes it. About 34 wide and 27 tall. Faces -Z.
"""
import math

import numpy as np

import paint as P
from _fterrain import ground, outline
from _kit import prop
from _life import coords, facet_paint, grass, leaf_block, plan, up_faces
from voxgrid import C, Grid

SZ = (48, 34, 50)
CX, CZ = 24.0, 25.0
G = 2  # the turf top

# leaf blocks: (dx, y0, dz, sx, sy, sz, ramp, base)
BLOCKS = [
    (0, 1.5, 0, 25, 15, 22, "forest", 5),
    (-10, 1.5, 2.5, 13, 13, 14, "leaf", 4),
    (10, 1.5, 1, 14, 14, 15, "forest", 5),
    (-1, 11, 1, 19, 10, 17, "leaf", 4),
    (-6, 1.5, -8, 12, 10, 10, "leaf", 4),
    (6.5, 1.5, -7.5, 12, 9, 11, "forest", 5),
    (2.5, 17, 4, 12, 7, 11, "leaf", 4),
]

# berry bunch centres (x, y, z) on the leaf surface, and the berry colour
# berry bunch centres (x, y, z) on the leaf surface, the berry colour, and
# whether the bunch has modelled beads (the back ones are paint only, to
# keep the plant budget)
BUNCHES = [
    (CX - 9, 9, CZ - 13, "red", True), (CX + 4, 7, CZ - 13, "red", True), (CX + 10, 13, CZ - 8, "red", True),
    (CX - 13, 13, CZ - 3, "red", True), (CX - 2, 16, CZ - 8, "magenta", True), (CX + 15, 9, CZ + 2, "red", True),
    (CX + 6, 21, CZ - 1, "red", True), (CX - 7, 18, CZ + 3, "red", True), (CX - 16, 7, CZ + 4, "magenta", False),
    (CX + 2, 13, CZ + 12, "red", False), (CX - 9, 10, CZ + 9, "magenta", True), (CX + 12, 15, CZ + 7, "red", False),
]


def berries(g, leaf: np.ndarray) -> None:
    """Berry bunches on the leaf surface near each centre: four round
    berries (2 x 2 x 2 beads that stand 1 out of the leaves) in a loose
    diamond, each with a lit dot on top and a dark lower side, and a ring
    of painted berries round them."""
    X, Y, Z = coords(g)
    skin = leaf & (g.a > 0)
    for k, (bx, by, bz, ramp, beads) in enumerate(BUNCHES):
        near = skin & (np.abs(X - bx) < 6) & (np.abs(Y - by) < 6) & (np.abs(Z - bz) < 6)
        if not near.any():
            raise ValueError(f"berry bunch {k} at {(bx, by, bz)} has no leaf near it")
        # snap the bunch to the nearest leaf voxel so it sits on the surface
        pos = np.stack([X[near], Y[near], Z[near]], axis=1)
        c = pos[np.argmin(np.sum((pos - np.array([bx, by, bz])) ** 2, axis=1))]
        out = np.array([c[0] - CX, 0.0, c[2] - CZ])
        out /= max(np.linalg.norm(out), 1e-6)
        side = np.array([-out[2], 0.0, out[0]])
        base = 4 if ramp == "red" else 3
        # painted berries in a ring round the bunch
        for a in np.linspace(0, 2 * math.pi, 6, endpoint=False):
            p = c + side * 4.2 * math.cos(a + k) + np.array([0.0, 3.6 * math.sin(a + k), 0.0])
            d = np.sqrt((X - p[0]) ** 2 + (Y - p[1]) ** 2 + (Z - p[2]) ** 2)
            P.flat(g, skin & (d < 1.0), ramp, base)
            P.flat(g, skin & (d < 1.0) & (Y > p[1]), ramp, base + 2)
        if not beads:
            continue
        # four modelled berries in a diamond
        for du, dv in ((0.0, 1.6), (-1.8, -0.2), (1.8, -0.2), (0.0, -2.0)):
            p = c + side * du + np.array([0.0, dv, 0.0]) + out * 0.8
            x0, y0, z0 = (int(math.floor(q - 0.5)) for q in p)
            g.box(x0, y0, z0, x0 + 2, y0 + 2, z0 + 2, C(ramp, base))
            g.box(x0, y0 + 1, z0, x0 + 2, y0 + 2, z0 + 2, C(ramp, base + 1))
            g.box(x0 + 1, y0 + 1, z0, x0 + 2, y0 + 2, z0 + 1, C(ramp, base + 3))  # the lit dot


def build():
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    pad, turf = ground(g, outline(CX, CZ, 20.0, 20.0, 13, seed=11, wobble=0.10, turn=0.7), CX, CZ, seed=11, top_y=G, cell=5.0)
    leaf = np.zeros(g.shape, dtype=bool)
    for k, (dx, y0, dz, sx, sy, sz, ramp, base) in enumerate(BLOCKS):
        leaf |= leaf_block(g, CX + dx, y0 + sy / 2, CZ + dz, sx, sy, sz, ramp, base, bevel=4.5, seed=20 + k)
    P.flat(g, leaf & (Y < G + 2), "forest", 3)  # the shaded foot of the bush
    berries(g, leaf)
    # fallen leaves and two lost berries on the turf (soft cells, no speckle)
    Xi, Zi = np.floor(X).astype(np.int64), np.floor(Z).astype(np.int64)
    P.flat(g, turf & ((P._hash(Xi // 2, Zi // 2, seed=13) % np.uint64(17)) == 0), "forest", 4)
    P.flat(g, turf & ((P._hash(Xi // 2, Zi // 2, seed=14) % np.uint64(41)) == 0) & ((Xi + Zi) % 2 == 0), "red", 4)
    # the wicker basket: a flared frustum with woven bands and a heap of berries
    bx, bz = CX - 3.0, CZ - 16.5
    start = len(g.solids)
    basket = plan(g, [(bx + 2.2 * math.cos(a), bz + 2.0 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 8, endpoint=False)], G - 0.5, G + 4.0, "sand", 4,
                  top=[(bx + 3.0 * math.cos(a), bz + 2.7 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 8, endpoint=False)])

    def weave(gg, mm, fr):
        U, V = P.uv(gg, fr)
        P._paint(gg, mm, "sand", np.where(((U // 2 + V) % 2) == 0, 4, 3))

    facet_paint(g, g.solids[start:], weave)
    P.flat(g, basket & (Y > G + 3.0), "wood", 4)  # the rim
    heap = plan(g, [(bx + 2.6 * math.cos(a), bz + 2.3 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 8, endpoint=False)], G + 3.6, G + 5.2, "red", 4,
                top=[(bx + 1.2 * math.cos(a), bz + 1.0 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 8, endpoint=False)])
    P.flat(g, heap & ((np.floor(X).astype(int) + np.floor(Z).astype(int)) % 2 == 0), "red", 6)
    P.flat(g, up_faces(g, heap) & ((np.floor(X).astype(int) * 3 + np.floor(Z).astype(int)) % 5 == 0), "red", 7)
    grass(g, [(int(CX) + 15, G, int(CZ) - 9), (int(CX) - 16, G, int(CZ) - 7), (int(CX) + 9, G, int(CZ) - 16)], "leaf", 5)
    return prop("fantasy-terrain-nature-berry-bush", "Berry Bush", g,
                sockets_at={"socket-function": (CX, 27.0, CZ)},
                pfx=[{"effectId": "rvx-fantasy-bee-swarm", "socket": "socket-function", "trigger": "idle", "size": 12}])
