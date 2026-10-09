"""A dry scrub patch with three dense tumbleweeds, in the Pirate Nation style.

Each tumbleweed is a dense ball: a dark faceted core (the shadowed inside)
wrapped in many thin crossing twigs. The twigs lie along the ball surface
in all directions, so the ball reads as a tangle and not as a wheel or a
ring. The largest weed has a dust trail behind it, as if it rolled in.
The ground has soft sand patches and no tile grid (rule S1). Faces -Z.
"""
import math

import numpy as np

import paint as P
from _life import blob, ctr, limb, make, plan, rock, tuft
from _rep_terrain import soft_ground
from voxgrid import Grid, Part

SIZE = (76, 34, 68)
GROUND = 3.0


def tumbleweed(g: Grid, cx: float, cz: float, radius: float, twigs: int, seed: int) -> np.ndarray:
    """A dense twig ball that rests on the ground at (cx, cz)."""
    rng = np.random.default_rng(seed)
    cy = GROUND + radius - 1.0  # it sits a little into the soft sand
    X, Y, Z = ctr(g)
    # The dark core fills the ball, so the gaps between twigs read as shadow.
    core = rock(g, cx, cz, cy - radius * 0.62, radius * 0.66, radius * 0.6, radius * 1.24, "darkwood", 3,
                shrink=0.55, n=7, seed=seed)
    core_low = rock(g, cx, cz, GROUND - 0.5, radius * 0.5, radius * 0.46, cy - radius * 0.62 - GROUND + 0.8, "darkwood", 3,
                    shrink=1.3, n=7, seed=seed + 1)
    ball = core | core_low
    # Twigs: short chords tangent to the shell, at points spread evenly
    # over the sphere (a Fibonacci spiral), each in a random direction.
    golden = math.pi * (3 - math.sqrt(5))
    for k in range(twigs):
        yk = 1 - 2 * (k + 0.5) / twigs
        rk = math.sqrt(1 - yk * yk)
        a = golden * k + seed
        n = np.array([math.cos(a) * rk, yk, math.sin(a) * rk])
        ref = np.array([0.0, 1.0, 0.0]) if abs(yk) < 0.9 else np.array([1.0, 0.0, 0.0])
        t1 = np.cross(n, ref)
        t1 /= np.linalg.norm(t1)
        t2 = np.cross(n, t1)
        phi = rng.uniform(0, math.pi)
        t = t1 * math.cos(phi) + t2 * math.sin(phi)
        shell = radius * rng.uniform(0.8, 0.98)
        half = radius * rng.uniform(0.55, 0.8)
        p = np.array([cx, cy, cz]) + n * shell
        p0, p1 = p - t * half, p + t * half
        if min(p0[1], p1[1]) < GROUND - 0.5:  # keep the twigs out of the ground
            lift = GROUND - 0.5 - min(p0[1], p1[1])
            p0[1] += lift
            p1[1] += lift
        shade = (4, 5, 5, 6)[k % 4]
        ball |= limb(g, tuple(p0), tuple(p1), 0.75, 0.55, "wood", shade, n=4)
    # Darker twigs under the ball and a pale sun-bleached cap on top.
    d = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2 + (Z - cz) ** 2)
    P.flat(g, ball & (d < radius * 0.62), "darkwood", 3)
    P.flat(g, ball & (d >= radius * 0.62) & (Y < cy - radius * 0.45), "wood", 3)
    P.flat(g, ball & (d >= radius * 0.62) & (Y > cy + radius * 0.6), "sand", 6)
    return ball


def build():
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    patch = blob(38, 34, 35, 30, n=11, jitter=0.1, seed=1)
    ground = plan(g, patch, 0, GROUND, "sand", 5, top=[(38 + (x - 38) * 0.95, 34 + (z - 34) * 0.95) for x, z in patch])
    soft_ground(g, ground, "sand", 5, [(20, 22, 11, 8, 1), (52, 48, 12, 8, 1), (60, 18, 7, 6, -1), (14, 46, 8, 6, -1)],
                38, 34, 28)
    # A dust trail: the largest weed rolled in from the +x side.
    trail = ground & (Y > GROUND - 1) & (np.abs(Z - 30 - (X - 28) * 0.18) < 3.2) & (X > 34) & (X < 70)
    P.flat(g, trail, "sand", 6)
    tumbleweed(g, 27, 29, 12.5, 64, 5)
    tumbleweed(g, 50, 44, 9.0, 44, 6)
    tumbleweed(g, 58, 17, 5.5, 26, 7)
    for k, (tx, tz) in enumerate(((9, 34), (17, 13), (40, 14), (66, 54), (68, 33), (30, 54))):
        tuft(g, tx, tz, GROUND, 7, blades=5, spread=3.4, ramp="khaki", shade=5, seed=k)
    for k, (cx, cz) in enumerate(((12, 51), (66, 11), (39, 59))):
        rock(g, cx, cz, GROUND - 1, 3.4, 2.6, 3.0, "stone", 5, shrink=0.55, n=6, seed=10 + k)
    return make("terrain-nature", "tumbleweed-patch", "Tumbleweed Patch", Part("tumbleweed-patch", g))
