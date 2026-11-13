"""Dead grass patch, in the Pirate Nation style.

A low cracked-earth tile with a sloped rim (true slopes), clumps of dry
khaki grass whose blades lean out (true slopes), a bleached skull, a
spent brass shell and a few stubborn green shoots. Cracks and dust are
paint. Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import blob, ctr, limb, make, plan, rock, tuft
from voxgrid import Grid, Part

N = 34


def build():
    g = Grid(N, 12, N)
    X, Y, Z = ctr(g)
    base = blob(N / 2, N / 2, 15.5, 14.5, n=11, jitter=0.1, seed=1)
    top = [(N / 2 + (u - N / 2) * 0.88, N / 2 + (v - N / 2) * 0.88) for u, v in base]
    ground = plan(g, base, 0, 2, "sand", 3, top=top)
    PP.concrete(g, ground, "sand", 3, size=40, cracks=14, frame="top", seed=2)
    PP.blotch(g, ground & (Y > 1), "rust", 4, cell=3, chance=0.06, seed=3)
    for k, (tx, tz, h) in enumerate(((8, 9, 8), (22, 7, 7), (26, 20, 9), (12, 24, 7), (18, 15, 6), (6, 18, 5), (25, 28, 6))):
        tuft(g, tx + 0.5, tz + 0.5, 2, h, blades=5, spread=3.5, ramp="sand", shade=6 if k % 2 else 5, seed=k)
    for k, (tx, tz) in enumerate(((15, 26), (20, 11))):  # stubborn green shoots
        tuft(g, tx + 0.5, tz + 0.5, 2, 4, blades=3, spread=1.5, ramp="leaf", shade=5, seed=20 + k)
    # a bleached skull half in the dust, a spent shell
    S.skull(g, 12.5, 1, 13.5, s=8, ramp="bone", base=6, eyes=("darkwood", 5), socket=("darkwood", 5), seed=4)
    shell = limb(g, (22.0, 2.6, 23.0), (26.0, 2.6, 24.5), 0.9, None, "gold", 6, n=6)
    P.flat(g, shell & (ctr(g)[0] > 25), "rust", 6)
    rock(g, 28.5, 12.5, 1.5, 2.5, 2.0, 2.0, ramp="stone", shade=5, shrink=0.55, n=6, seed=5)
    return make("terrain-nature", "dead-grass", "Dead Grass Patch", Part("dead-grass", g))
