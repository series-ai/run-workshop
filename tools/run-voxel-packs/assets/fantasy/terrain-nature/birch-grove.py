"""Birch grove in the Pirate Nation style.

Three slender birches of three heights (76, 62 and 49) grow from one
patch of turf. Each trunk is a curved faceted frustum stack (true slopes,
rule F2) with white bark and the birch marks painted on it: short dark
horizontal dashes and a dark rough foot (rule S1). Each crown is a few
tall leaf blocks in fresh yellow-greens, lighter at the top; a thin
branch leaves each trunk into the lowest block. Gold leaf litter, a fern
and grass tufts sit on the irregular turf patch. The tallest tree stands
twice the height of a person. Faces -Z.
"""
import numpy as np

import paint as P
from _fterrain import fern, ground, outline
from _kit import prop
from _life import coords, facet_paint, grass, leaf_block, limb, trunk
from voxgrid import Grid

SZ = (58, 82, 52)
CX, CZ = 29.0, 25.0
G = 2  # the turf top

# trees: (trunk path, radii, crown blocks (cx, y0, cz, sx, sy, sz, ramp, base), branch)
TREES = [
    ([(31, 1, 28), (29.5, 30, 29), (31.5, 58, 27)], [2.9, 2.1, 1.5],
     [(31.5, 56, 27, 18, 20, 15, "lime", 3), (25.5, 49, 29.5, 13, 13, 12, "leaf", 5), (37.5, 47, 25.5, 13, 12, 12, "lime", 2)],
     ((40, 29.5), (53, 26.5), 1.2, 0.8, 28.0, 30.5)),
    ([(18, 1, 21), (16.5, 24, 22), (15, 45, 20.5)], [2.5, 1.8, 1.25],
     [(15, 43, 20.5, 15, 19, 13, "leaf", 5), (20.5, 37, 23, 12, 11, 11, "lime", 3)],
     ((28, 16.8), (40, 20.5), 1.0, 0.7, 20.5, 23.5)),
    ([(41, 1, 17), (42, 18, 16.5), (43.5, 34, 17.5)], [2.2, 1.6, 1.1],
     [(43.5, 33, 17.5, 13, 16, 12, "lime", 3), (38.5, 29, 15.5, 11, 9, 10, "leaf", 5)],
     ((22, 42), (31, 39.5), 0.9, 0.6, 15.0, 17.5)),
]


def birch_bark(g, mask, frame, seed: int) -> None:
    """White bark with short dark horizontal dashes (the birch marks)."""
    U, V = P.uv(g, frame)
    shade = 6 + np.where((P._hash(U // 3, V // 4, seed=seed) % np.uint64(5)) == 0, -1, 0)
    P._paint(g, mask, "bone", shade)
    dash = ((V % 4) == 0) & ((P._hash(U // 2, V // 4, seed=seed + 1) % np.uint64(3)) == 0)
    P.flat(g, mask & dash, "iron", 3)
    P.flat(g, mask & dash & ((U % 2) == 0) & ((P._hash(U // 4, V // 4, seed=seed + 2) % np.uint64(2)) == 0), "stone", 2)


def build():
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    pad, turf = ground(g, outline(CX, CZ, 24.0, 21.0, 15, seed=31, wobble=0.13, turn=1.1), CX, CZ, seed=31, top_y=G, cell=6.0)
    # gold leaf litter in soft cells under the crowns
    Xi, Zi = np.floor(X).astype(np.int64), np.floor(Z).astype(np.int64)
    cell = P._hash(Xi // 2, Zi // 2, seed=32) % np.uint64(23)
    P.flat(g, turf & (cell == 1), "gold", 5)
    P.flat(g, turf & (cell == 2), "lime", 4)
    for k, (path, radii, blocks, branch) in enumerate(TREES):
        start = len(g.solids)
        stem = trunk(g, path, radii, ramp="bone", base=6, n=6, turn=0.3 * k, seed=33 + k, paint=False)
        facet_paint(g, g.solids[start:], lambda gg, mm, fr, k=k: birch_bark(gg, mm, fr, 34 + k))
        # the dark rough foot of a birch
        foot = stem & (Y < path[0][1] + 3 + (P._hash(np.floor(X + Z).astype(np.int64) // 2, seed=35 + k) % np.uint64(4)).astype(float))
        P.flat(g, foot, "stone", 3)
        P.flat(g, foot & ((P._hash(np.floor(X + Z).astype(np.int64), np.floor(Y).astype(np.int64) // 2, seed=38 + k) % np.uint64(3)) == 0), "iron", 3)
        # one thin branch into the lowest leaf block
        (y0, x0), (y1, x1), r0, r1, lo, hi = branch
        start = len(g.solids)
        bm = limb(g, "z", (x0, y0), (x1, y1), r0, r1, lo, hi, "bone", 6, seed=36 + k)
        facet_paint(g, g.solids[start:], lambda gg, mm, fr, k=k: birch_bark(gg, mm, fr, 37 + k))
        for j, (cx, y0b, cz, sx, sy, sz, ramp, base) in enumerate(blocks):
            lb = leaf_block(g, cx, y0b + sy / 2, cz, sx, sy, sz, ramp, base, bevel=3.0, lean=(0.6 * (j - 1), 0.3), seed=40 + 5 * k + j)
            P.flat(g, lb & (Y > y0b + sy - 3.5), ramp, min(7, base + 2))  # sunlit crown top
            P.flat(g, lb & (Y < y0b + 2.0), "forest", 4)  # shade under the crown
    fern(g, CX - 16.5, G, CZ - 6.5, 5.0, "forest", 5, turn=0)
    fern(g, CX + 17.5, G, CZ + 8.5, 4.5, "leaf", 4, turn=2)
    grass(g, [(int(CX) - 6, G, int(CZ) - 15), (int(CX) + 8, G, int(CZ) - 12), (int(CX) - 18, G, int(CZ) + 9), (int(CX) + 4, G, int(CZ) + 16)], "leaf", 5)
    return prop("fantasy-terrain-nature-birch-grove", "Birch Grove", g,
                sockets_at={"socket-function": (31.0, 52.0, 28.0)},
                pfx=[{"effectId": "rvx-fantasy-leaf-fall", "socket": "socket-function", "trigger": "idle", "size": 18}])
