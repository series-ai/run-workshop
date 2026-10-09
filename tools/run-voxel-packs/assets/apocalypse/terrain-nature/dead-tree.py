"""Dead tree, in the Pirate Nation style (after the PN spooky tree).

A gnarled leafless oak about 2.3 persons tall: a thick leaning trunk of
tapered faceted segments, a root flare of wedge roots, forked bare limbs
that twist up and out (true slopes throughout), one snapped leader with
pale splinters, a tyre swing on a rope from a low limb, a crow's nest of
sticks and barbed wire round the trunk. Bark grain, the lightning scar,
the knot hole and the wire are paint. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import ctr, limb, make, plan, rock
from voxgrid import Grid, Part

SZ = (72, 90, 64)
CX, CZ = 34.0, 32.0
BARK = ("skindark", 5)


def build():
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    wood = np.zeros(g.shape, dtype=bool)
    # the trunk: three tapered segments that lean and twist
    pts = [(CX, 0.0, CZ), (CX + 1.5, 20.0, CZ + 1.0), (CX - 1.0, 38.0, CZ - 1.0), (CX + 2.0, 52.0, CZ + 0.5)]
    radii = [7.5, 6.0, 4.8, 3.8]
    for (a, b), r0, r1 in zip(zip(pts, pts[1:]), radii, radii[1:]):
        wood |= limb(g, a, b, r0, r1, *BARK, n=8)
    # a root flare: wedge roots running out along the ground
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.3
        wood |= limb(g, (CX + 3 * math.cos(a), 5.0, CZ + 3 * math.sin(a)), (CX + 13 * math.cos(a), 1.2, CZ + 13 * math.sin(a)), 3.2, 1.2, *BARK, n=4)
    # forked limbs: each a chain of tapered segments
    branches = [
        [(CX - 1.0, 36.0, CZ - 1.0), (CX - 14, 48, CZ - 4), (CX - 24, 62, CZ - 2), (CX - 30, 76, CZ + 2)],
        [(CX - 14, 48, CZ - 4), (CX - 20, 52, CZ - 14), (CX - 22, 60, CZ - 22)],
        [(CX + 1.5, 44.0, CZ), (CX + 14, 54, CZ + 3), (CX + 22, 66, CZ + 10), (CX + 26, 80, CZ + 12)],
        [(CX + 14, 54, CZ + 3), (CX + 24, 56, CZ - 6), (CX + 32, 62, CZ - 10)],
        [(CX + 2.0, 52.0, CZ + 0.5), (CX + 4, 68, CZ - 6), (CX - 2, 82, CZ - 10)],
        [(CX + 4, 68, CZ - 6), (CX + 12, 76, CZ - 16)],
        [(CX - 1, 26.0, CZ), (CX - 16, 30, CZ + 6), (CX - 26, 30, CZ + 10)],  # the low swing limb
        [(CX + 1, 30.0, CZ + 1), (CX + 8, 36, CZ + 16), (CX + 10, 44, CZ + 26)],
    ]
    for br in branches:
        r = 2.6
        for a, b in zip(br, br[1:]):
            wood |= limb(g, a, b, r, max(0.8, r - 0.9), *BARK, n=6)
            r = max(0.9, r - 0.9)
    PP.fur(g, wood, *BARK, stroke=4, seed=1)  # bark grain streaks
    P.flat(g, wood & (Y > 60), BARK[0], BARK[1] + 1)
    P.flat(g, wood & (Y < 3), BARK[0], BARK[1] - 1)
    # the snapped leader: pale splinters on top of the trunk
    for k in range(4):
        a = 2 * math.pi * k / 4 + 0.5
        sp = limb(g, (CX + 2 + 1.8 * math.cos(a), 52.0, CZ + 0.5 + 1.8 * math.sin(a)), (CX + 2 + 2.2 * math.cos(a), 57.0 + k % 2 * 2, CZ + 0.5 + 2.2 * math.sin(a)), 1.0, 0.1, "bone", 6, n=4)
        del sp
    # a lightning scar down the front, a knot hole, barbed wire round the trunk
    scar = wood & (np.abs(X - CX - 0.5 - np.sin(Y / 5) * 1.5) < 1.0) & (Z < CZ - 3) & (Y > 8) & (Y < 40)
    P.flat(g, scar, "bone", 5)
    P.flat(g, wood & (np.hypot(X - (CX + 3), Y - 30) < 1.5) & (Z < CZ - 3), "darkwood", 4)
    wire = wood & (np.abs(Y - 16 - (X - CX) * 0.2) < 0.7) & (np.hypot(X - CX, Z - CZ) < 8)
    P.flat(g, wire, "steel", 6)
    P.flat(g, wire & (np.floor(X + Z) % 3 == 0), "steel", 3)
    # a crow's nest of sticks in a high fork
    nest = rock(g, CX + 14.5, CZ + 3.5, 55, 4.5, 4.0, 3.0, ramp="wood", shade=5, shrink=1.25, n=8, seed=2)
    P.flat(g, nest & (Y > 57.5), "darkwood", 5)
    PP.blotch(g, nest, "wood", 6, cell=1, chance=0.25, seed=3)
    # the tyre swing: a rope from the low limb and a hanging tyre
    rope = limb(g, (CX - 20.5, 30.0, CZ + 8.5), (CX - 20.5, 14.0, CZ + 8.5), 0.6, None, "sand", 5, n=4)
    tyre = S.tyre(g, "z", CX - 20.5, 9.5, 5.5, CZ + 7, CZ + 10, rubber=("gray", 4), hub=("gray", 4), tread=True)
    P.flat(g, tyre & (np.hypot(X - (CX - 20.5), Y - 9.5) < 3.0), "gray", 3)
    del rope
    return make("terrain-nature", "dead-tree", "Dead Tree", Part("dead-tree", g))
