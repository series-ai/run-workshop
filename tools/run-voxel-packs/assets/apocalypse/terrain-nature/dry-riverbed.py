"""A dry riverbed, in the Pirate Nation style.

An S-shaped channel winds across the patch, about 6 below two raised
banks. Each bank is one prism whose inner wall slopes down into the
channel (true slopes, rule F2). The channel floor is dried mud with dark
crack lines and a line of pale pebbles. A concrete culvert mouth opens in
the south bank, and a half-buried tyre lies where the water stopped. Mud
cracks, strata and dust are paint (rule S1). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _life import ctr, limb, make, plan, rock, tuft
from _rep_terrain import soft_ground
from voxgrid import Grid, Part

SIZE = (76, 16, 66)
X0, X1 = 3.0, 73.0  # the bank ends along x
FLOOR, BANK = 2.5, 8.5  # the channel floor and the bank tops
HALF = 6.0  # half the floor width of the channel
SLOPE = 4.0  # how far the inner wall runs back from the floor edge


def centre(x):
    """The channel centre line: one full S across the patch."""
    return 33.0 + 10.0 * np.sin(2 * math.pi * (np.asarray(x) - X0) / (X1 - X0))


def bank(g: Grid, side: int) -> np.ndarray:
    """One raised bank. side -1: the low-z bank, side +1: the high-z bank."""
    xs = np.linspace(X0, X1, 24)
    edge = 3.0 if side < 0 else SIZE[2] - 3.0
    wob = [1.2 * math.sin(0.5 * x + side) for x in xs]
    inner = [(float(x), float(centre(x) + side * HALF)) for x in xs]
    outer = [(float(x), edge - side * w) for x, w in zip(xs, wob)][::-1]
    xt = X0 + 2 + (xs - X0) * (X1 - X0 - 4) / (X1 - X0)
    inner_t = [(float(xt[i]), float(centre(xs[i]) + side * (HALF + SLOPE))) for i in range(len(xs))]
    outer_t = [(float(xt[i]), edge - side * (wob[i] + 2.0)) for i in range(len(xs))][::-1]
    base, top = inner + outer, inner_t + outer_t
    if side > 0:  # keep one winding direction for both banks
        base, top = base[::-1], top[::-1]
    return plan(g, base, FLOOR, BANK, "sand", 5, top=top)


def build():
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    outline = [(1, 4), (12, 1), (40, 2), (66, 1), (75, 5), (75, 61), (64, 65), (36, 64), (10, 65), (1, 61)]
    floor = plan(g, outline, 0, FLOOR, "sand", 3)
    banks = bank(g, -1) | bank(g, +1)
    d = Z - centre(X)  # signed distance across the channel (in z)

    # ---- the banks: soft sand on top, strata down the inner walls
    top = banks & (Y > BANK - 1)
    soft_ground(g, top, "sand", 5, [(14, 10, 9, 5, 1), (52, 9, 10, 4, 1), (24, 58, 10, 4, 1), (60, 55, 8, 5, -1)],
                38, 33, 40)
    wall = banks & (Y < BANK - 1)
    P.flat(g, wall, "sand", 4)
    for level in (4.5, 6.5):
        P.flat(g, wall & (np.abs(Y - level - 0.4 * np.sin(X * 0.3)) < 0.6), "sand", 3)
    P.flat(g, wall & (Y < FLOOR + 1), "sand", 3)
    P.flat(g, banks & (np.abs(d) > HALF + SLOPE + 0.5) & (Y < BANK - 1), "sand", 4)  # the outer skirt

    # ---- the channel floor: dried mud plates with dark crack lines
    bed = floor & (Y > FLOOR - 1.5) & (np.abs(d) < HALF + 1.0)
    rng = np.random.default_rng(3)
    seeds = np.stack([rng.uniform(X0, X1, 70), rng.uniform(5, 61, 70)], axis=1)  # mud plate centres
    px, pz = X[..., None], Z[..., None]
    dist = np.sqrt((px - seeds[:, 0]) ** 2 + (pz - seeds[:, 1]) ** 2)
    two = np.partition(dist, 1, axis=-1)
    crack = (two[..., 1] - two[..., 0]) < 0.9
    P.flat(g, bed, "sand", 2)
    P.flat(g, bed & (np.abs(d) < HALF - 2.5), "sand", 3)  # the paler middle where the silt dried last
    P.flat(g, bed & crack, "wood", 2)
    P.flat(g, floor & (Y > FLOOR - 1.5) & (np.abs(d) >= HALF + 1.0), "sand", 3)  # floor under the bank ends

    # ---- pale pebbles along the inside of each bend
    for k, x in enumerate(np.linspace(X0 + 5, X1 - 5, 13)):
        side = -1 if math.cos(2 * math.pi * (x - X0) / (X1 - X0)) > 0 else 1
        z = float(centre(x)) + side * (HALF - 2.0 - (k % 3))
        r = 1.3 + 0.5 * (k % 3)
        peb = rock(g, float(x) + (k % 2), z, FLOOR - 0.3, r, r * 0.8, 1.2 + 0.4 * (k % 2), "bone", 5 + (k % 2), shrink=0.6, n=5, seed=20 + k)
        P.flat(g, peb & (Y < FLOOR + 0.3), "bone", 3)

    # ---- a culvert mouth in the south bank, aimed at the channel
    cx = 22.0
    cz0 = float(centre(cx)) - HALF - SLOPE - 3.0
    pipe = S.disc(g, "z", cx, FLOOR + 3.0, 3.2, cz0, float(centre(cx)) - HALF + 0.5, "stone", 5, n=8)
    P.flat(g, pipe & (np.hypot(X - cx, Y - FLOOR - 3.0) < 2.0), "stone", 2)
    P.outline(g, pipe & (Z > float(centre(cx)) - HALF - 0.5), "stone", 4, normal="z")
    P.flat(g, pipe & (Y < FLOOR + 1.2), "rust", 4)  # a rust stain where the last water ran

    # ---- a half-buried tyre where the water stopped
    tx = 56.0
    tz = float(centre(tx)) + 1.5
    S.tyre(g, "x", FLOOR + 1.5, tz, 4.0, tx - 1.5, tx + 1.5, rubber=("gray", 3), hub=("gray", 3), n=8)

    # ---- dry tufts and stones on the banks
    for k, (x, z) in enumerate(((8, 12), (32, 8), (62, 14), (12, 56), (44, 59), (68, 52))):
        tuft(g, x, z, BANK, 6, blades=4, spread=3, ramp="khaki", shade=5, seed=k)
    for k, (x, z, r) in enumerate(((48, 6, 3.5), (28, 60, 3.0), (70, 30, 2.6))):
        st = rock(g, x, z, BANK - 0.5, r, r * 0.8, r, "stone", 5, shrink=0.55, n=6, seed=40 + k)
        P.flat(g, st & (Y > BANK + r - 1.2), "stone", 6)
    # a bleached branch washed onto the north bank edge
    limb(g, (40.0, BANK + 0.6, float(centre(40.0)) + HALF + SLOPE + 2.0), (50.0, BANK + 1.0, float(centre(50.0)) + HALF + SLOPE + 3.0),
         0.9, 0.6, "bone", 4, n=4)
    return make("terrain-nature", "dry-riverbed", "Dry Riverbed", Part("dry-riverbed", g))
