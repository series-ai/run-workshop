"""Flipped burnt car, in the Pirate Nation style (the pickup truck's family).

The same chunky toy sedan as the wrecked sedan, burnt out and lying on its
crushed roof with its four octagonal wheels in the air (true slopes). The
paint is scorched to rust with ash patches and a last strip of red; the
windows are gone, weeds grow through the axles, and an oil stain with
broken glass spreads on the ground. It is built upright and flipped with
Grid.flip, so its prisms stay true. Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import SEDAN, blob, ctr, make, plan, sedan_glass, sedan_profile, side, tuft
from pnkit import box
from voxgrid import Grid, Part

SZ = (58, 50, 92)
X0, X1 = SEDAN["x0"], SEDAN["x1"]
CRUSH = 7.0
GROUND = 2  # after the flip the roof rests on a thin stain slab


def upright() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    shell = side(g, [(y + 3, z) for z, y in sedan_profile(crush=CRUSH)], X0, X1, "rust", 4)
    P.flat(g, shell, "rust", 4)
    PP.blotch(g, shell, "gray", 5, cell=6, chance=0.035, seed=1)  # ash
    PP.blotch(g, shell, "rust", 3, cell=5, chance=0.04, seed=2)  # scorch
    P.flat(g, shell & (Y < 13), "rust", 3)  # the sooty underside
    P.flat(g, shell & (Y >= 18) & (Y < 21) & (Z > 12) & (Z < 60), "red", 4)  # a last strip of paint
    glass = sedan_glass(g, shell, X0, X1, crush=CRUSH, flip_y=lambda y: y - 3)
    P.flat(g, glass, "rust", 2)
    P.outline(g, glass & ((X < X0 + 1) | (X >= X1 - 1)), "rust", 3, normal="x")
    tank = box(g, X0 + 6, 9, 58, X1 - 6, 12, 76, "khaki", 4)
    P.outline(g, tank, "khaki", 3, normal="y")
    from _life import limb
    limb(g, (X0 + 8, 10.5, 30), (X0 + 8, 10.5, 88), 1.3, None, "steel", 5, n=6)  # the exhaust pipe
    box(g, X0 - 2, 9, 3, X1 + 2, 13, 6, "steel", 4)
    box(g, X0 - 1, 9, 84, X1 + 1, 13, 86, "steel", 4)
    for wz in SEDAN["wheel_z"]:
        for x0, x1 in ((0, X0), (X1, 58)):
            f = side(g, [(25, wz - 14), (30, wz - 10), (30, wz + 10), (25, wz + 14)], x0 + 1, x1 - 1, "rust", 3)
            del f
        axle = box(g, X0, 11.5, wz - 1.5, X1, 14.5, wz + 1.5, "steel", 3)
        del axle
        for x0, x1 in ((1, X0), (X1, 57)):
            S.tyre(g, "x", SEDAN["r"] + 3, wz, SEDAN["r"], x0, x1, rubber=("gray", 4), hub=("steel", 5))
    return g


def build():
    g = upright().flip("y")
    X, Y, Z = ctr(g)
    # the car now rests on its roof: find the lowest voxel and add a stain slab under it
    ys = np.nonzero(g.a.any(axis=(0, 2)))[0]
    y0 = int(ys.min())
    stain = plan(g, blob(29, 45, 27, 42, n=12, jitter=0.12, seed=3), max(0, y0 - GROUND), y0, "sand", 3)
    P.flat(g, stain & (np.hypot((X - 24) * 0.8, Z - 30) < 12), "stone", 3)  # the oil stain
    P.flat(g, stain & (P._hash(np.floor(X).astype(int), np.floor(Z).astype(int), seed=7) % np.uint64(29) == 0), "sky", 6)  # broken glass
    P.outline(g, stain, "sand", 2, normal="y")
    # weeds growing up through the axles
    top_y = int(np.nonzero(g.a.any(axis=(0, 2)))[0].max())
    for k, (tx, tz) in enumerate(((20.5, 22.5), (35.5, 68.5))):
        col = np.nonzero(g.a[int(tx), :, int(tz)])[0]
        tuft(g, tx, tz, float(col.max() + 1) if len(col) else top_y, 6, blades=4, spread=2.5, ramp="khaki", shade=5, seed=k)
    return make("terrain-nature", "flipped-car", "Flipped Burnt Car", Part("flipped-car", g))
