"""Hedge maze corner in the Pirate Nation style.

One square maze tile, exactly 48 x 48 (three 16-voxel tiles), so corners
join straight runs. An L-shaped clipped hedge, 14 thick at the foot and 46 high (over
the 36-voxel person, so a player cannot see over it), stands flush to the
left (-x) and back (+z) edges. The hedge is one leaf block with flat
clipped faces and a slight batter (true slopes, rule F2), painted as dense
leaves with faint shear lines, a lit top edge and a dark foot (rule S1). The
rest of the tile is the path floor: a gravel walk with a grass verge along
the hedge foot and a few worn flagstones. No island pad. Faces -Z.
"""
import numpy as np

import paint as P
from _fterrain import noise
from _kit import prop
from _life import coords, foliage, plan
from voxgrid import Grid

T = 48  # the tile size
SZ = (T, 50, T)
G = 2  # the path floor top
TOP = 46  # the hedge top
THICK = 14
BAT = 2.0  # the batter: the hedge top is this much inside its foot


def hedge(g) -> np.ndarray:
    """The L hedge as ONE clipped leaf block: flat faces with a slight
    batter (2 in over the full height, like a trimmed hedge), flush to the
    -x and +z tile edges at the floor. It is one prism, so no face shares
    a plane with the floor and the tile stays exactly 48 x 48."""
    lo = [(0, 0), (THICK, 0), (THICK, T - THICK), (T, T - THICK), (T, T), (0, T)]
    hi = [(BAT, BAT), (THICK - BAT, BAT), (THICK - BAT, T - THICK + BAT), (T - BAT, T - THICK + BAT), (T - BAT, T - BAT), (BAT, T - BAT)]
    m = plan(g, lo, G - 1, TOP, "leaf", 4, top=hi)
    foliage(g, m, "leaf", 4, frame=None, seed=95)  # the L is concave: paint in world pattern space
    return m


def build():
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    Xi, Zi = np.floor(X).astype(np.int64), np.floor(Z).astype(np.int64)
    # the path floor: the whole tile, flush to all four edges
    floor = plan(g, [(0, 0), (T, 0), (T, T), (0, T)], 0, G, "sand", 4)
    top = floor & (Y > G - 1)
    P.flat(g, floor & (Y < G - 1), "wood", 3)  # the soil edge
    P.flat(g, floor & (Y >= G - 1) & ~top, "sand", 3)
    # gravel: soft patches of three sand tones, a few pebbles
    n = noise(X, Z, 5.0, 91)
    P._paint(g, top, "sand", np.where(n < 0.33, 3, np.where(n < 0.7, 4, 5)))
    P.flat(g, top & ((P._hash(Xi, Zi, seed=92) % np.uint64(23)) == 0), "stone", 3)
    # worn flagstones down the middle of the walk (it turns the corner)
    for k, (fx, fz, w, d) in enumerate(((31, 4, 7, 5), (32, 12, 6, 5), (31, 20, 7, 5), (25, 26, 5, 6), (38, 25, 6, 5), (45, 26, 3, 5))):
        flag = top & (X > fx - w / 2) & (X < fx + w / 2) & (Z > fz - d / 2) & (Z < fz + d / 2)
        P.flat(g, flag, "stone", 5)
        P.flat(g, flag & ((X < fx - w / 2 + 1) | (Z < fz - d / 2 + 1)), "stone", 4)  # the shaded lip (S4)
        P.flat(g, flag & ((P._hash(Xi // 2, Zi // 2, seed=93 + k) % np.uint64(5)) == 0), "stone", 6)
    # the grass verge along the hedge foot, and a curb of dark soil
    verge = top & ((X < THICK + 3) | (Z > T - THICK - 3))
    P.flat(g, verge, "leaf", 3)
    P.flat(g, verge & (noise(X, Z, 3.0, 94) > 0.55), "leaf", 4)
    P.flat(g, top & (((X >= THICK + 3) & (X < THICK + 4)) & (Z <= T - THICK - 3) | ((Z <= T - THICK - 3) & (Z > T - THICK - 4) & (X >= THICK + 3))), "wood", 3)

    # the L hedge: a back run and a left run, flush to the tile edges
    hm = hedge(g)
    # faint shear lines every 7 rows, a lit top, a dark foot with bare stems
    U, V = P.uv(g, None)
    side = hm & (Y < TOP - 1)
    P.flat(g, side & ((np.floor(Y).astype(int) % 7) == 0) & ((P._hash(U // 4, np.floor(Y).astype(int) // 7, seed=97) % np.uint64(3)) != 0), "leaf", 3)
    crown = hm & (Y > TOP - 1)
    P.flat(g, crown, "leaf", 5)
    P.flat(g, crown & (noise(X, Z, 3.0, 98) > 0.6), "leaf", 6)
    P.flat(g, hm & (Y > TOP - 2) & (Y <= TOP - 1), "leaf", 6)  # the lit clipped top edge (S4)
    P.flat(g, hm & (Y > TOP - 3) & (Y <= TOP - 2), "leaf", 3)
    foot = hm & (Y < G + 3)
    P.flat(g, foot, "forest", 3)
    P.flat(g, foot & (Y < G + 2) & ((U % 4) == 0), "wood", 2)  # bare stems at the foot
    # small white and gold flowers painted in the verge
    bloom = verge & ~hm & ((P._hash(Xi // 2, Zi // 2, seed=99) % np.uint64(19)) == 0) & ((Xi + Zi) % 2 == 0)
    P.flat(g, bloom, "bone", 7)
    P.flat(g, bloom & ((P._hash(Xi // 2, Zi // 2, seed=100) % np.uint64(2)) == 0), "gold", 6)
    return prop("fantasy-terrain-nature-hedge-maze-corner", "Hedge Maze Corner", g,
                sockets_at={"socket-function": (THICK / 2, TOP, T - THICK / 2)},
                pfx=[{"effectId": "rvx-fantasy-leaf-fall", "socket": "socket-function", "trigger": "idle", "size": 14}])
