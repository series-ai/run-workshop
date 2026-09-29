"""Wrecked sedan, in the Pirate Nation style (the pickup truck's family).

A chunky toy-like family car the size of the live pickup, sun-bleached
sky blue with a cream roof: a short sloped hood and a tall bubble cabin
(true slopes), flared fenders, sunk on four flat tyres. The bonnet has
sprung open over a stripped engine bay, the windows are smashed, the
driver's door is gone (a dark cab with a red seat shows), and dune sand
drifts against the wheels (true slopes). Rust blooms, cracks and glare
are paint. Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import SEDAN, ctr, flat_tyre, limb, make, plan, sedan_glass, sedan_profile, side, tuft
from pnkit import box
from voxgrid import C, Grid, Part

SZ = (58, 52, 92)
X0, X1 = SEDAN["x0"], SEDAN["x1"]
PAINT = ("sky", 5)
SINK = 2.5  # how far the body sits lower on its flat tyres


def body() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    prof = [(y - SINK, z) for z, y in sedan_profile(hood_drop=3.0)]
    shell = side(g, prof, X0, X1, *PAINT)
    PP.blotch(g, shell, PAINT[0], PAINT[1] + 1, cell=5, chance=0.05, seed=1)  # sun-bleached patches
    P.flat(g, shell & (Y >= 42 - SINK) & (Z >= 41) & (Z < 64), "bone", 6)  # the cream roof
    P.flat(g, shell & (Y >= 15 - SINK) & (Y < 18 - SINK), "bone", 6)  # a waist stripe
    glass = sedan_glass(g, shell, X0, X1, flip_y=lambda y: y + SINK)
    P.flat(g, glass, "sky", 3)
    P.flat(g, glass & ((((X + Y + Z) % 7) == 0) | (((X - Y + Z) % 9) == 0)), "sky", 7)  # crazed cracks
    P.outline(g, glass & ((X < X0 + 1) | (X >= X1 - 1)), PAINT[0], PAINT[1] - 3, normal="x")
    # the missing driver's door: a dark cab with a red seat
    hole = shell & (X >= X1 - 1) & (Y >= 12 - SINK) & (Y < 31 - SINK) & (Z >= 38) & (Z < 55)
    P.flat(g, hole, "blue", 2)
    P.flat(g, hole & (Y > 17 - SINK) & (Y < 26 - SINK) & (Z > 44) & (Z < 52), "red", 3)
    # the engine bay under the open bonnet
    bay = shell & (Z > 9) & (Z < 29) & (Y > 23 - SINK) & (X > X0 + 2) & (X < X1 - 2)
    P.flat(g, bay, "steel", 3)
    eng = box(g, X0 + 10, 22 - SINK, 12, X1 - 10, 27 - SINK, 25, "rust", 4)
    P.plates(g, eng, "rust", 4, size=(6, 4), seed=2)
    # nose, bumpers, lamps and flared fenders like the pickup
    grille = box(g, 18, 11 - SINK, 5, 38, 21 - SINK, 6, "steel", 6)
    P.flat(g, grille & ((X - 18) % 3 == 0), "steel", 4)
    for hx in (13, 43):
        lamp = S.disc(g, "z", hx, 17 - SINK, 3.8, 3, 6, "bone", 6)
        P.flat(g, lamp & (S.radial(g, "z", hx, 17 - SINK) < 2.2), "navy", 5)  # smashed
    box(g, X0 - 2, 6 - SINK, 3, X1 + 2, 10 - SINK, 6, "steel", 5)
    box(g, X0 - 1, 6 - SINK, 84, X1 + 1, 10 - SINK, 86, "steel", 4)
    for wz in SEDAN["wheel_z"]:
        for x0, x1 in ((0, X0), (X1, 58)):
            f = side(g, [(22 - SINK, wz - 14), (27 - SINK, wz - 10), (27 - SINK, wz + 10), (22 - SINK, wz + 14)], x0 + 1, x1 - 1, PAINT[0], PAINT[1] - 1)
            P.flat(g, f & (Y >= 26 - SINK), *PAINT)
    # weathering: soft rust blooms (rule S3)
    rng = np.random.default_rng(3)
    for _ in range(8):
        cx, cy, cz, r = rng.uniform(X0, X1), rng.uniform(8, 30), rng.uniform(8, 82), rng.uniform(2.0, 4.0)
        d = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2 + (Z - cz) ** 2)
        P.flat(g, shell & ~glass & (d < r), "rust", 5)
        P.flat(g, shell & ~glass & (d < r * 0.5), "rust", 4)
    # four flat tyres
    for wz in SEDAN["wheel_z"]:
        for x0, x1 in ((1, X0), (X1, 57)):
            flat_tyre(g, x0, x1, wz, SEDAN["r"], sink=SINK)
    # sand drifts against the front wheels and the +x side (true slopes)
    for x0, x1, zc in ((0, 12, 22), (46, 58, 22)):
        side(g, [(0, zc - 16), (0, zc + 2), (6, zc - 6)], x0, x1, "sand", 5)
    g.prism("z", [(50, 0), (58, 0), (58, 4)], 30, 78, C("sand", 5))
    P.mottle(g, g.solids[-1].mask(g.shape), "sand", 5, cell=3, seed=4)
    tuft(g, 55.5, 84.5, 0, 6, blades=4, spread=2.0, ramp="sand", shade=6, seed=5)
    return g


def bonnet() -> Grid:
    """The sprung bonnet, hinged at the windscreen (hung open by the rig)."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    m = side(g, [(26.5 - SINK, 9.5), (28.5 - SINK, 30), (30.5 - SINK, 30), (28.5 - SINK, 9.5)], X0 + 1, X1 - 1, *PAINT)
    P.flat(g, m & (np.floor(X) % 9 == 0), PAINT[0], PAINT[1] - 1)
    P.flat(g, m & (np.hypot(X - 20, Z - 16) < 3), "rust", 5)
    return g


def build():
    from _life import Rig
    rig = Rig("wrecked-sedan", (28, 0, 45), body())
    rig.add("bonnet", bonnet(), (28, 29.5 - SINK, 30), rot=(38, 0, 4))
    return make("terrain-nature", "wrecked-sedan", "Wrecked Sedan", rig.root)
