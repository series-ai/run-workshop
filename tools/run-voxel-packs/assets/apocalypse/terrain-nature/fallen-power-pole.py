"""A cracked utility pole lies across a patch of road with sagging wire."""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import blob, ctr, limb, make, plan, rock
from pnkit import box
from voxgrid import C, Grid, Part

SIZE = (112, 52, 64)


def build():
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    earth = blob(56, 32, 53, 28, n=10, jitter=0.08, seed=1)
    ground = plan(g, earth, 0, 3, "sand", 4)
    PP.concrete(g, ground, "sand", 4, size=14, cracks=7, frame="top", seed=2)
    # The timber mast lies at an angle. Its raised splintered end remains visible.
    mast = limb(g, (11, 8, 28), (53, 13, 31), 5.2, 4.4, "wood", 5, n=6)
    mast |= limb(g, (63, 13, 32), (98, 19, 34), 4.0, 4.0, "wood", 5, n=6)
    for z0, y0, reach in ((28,11,60),(31,15,58),(34,12,59)):
        limb(g, (50,y0,z0), (reach,y0+1,z0+1), 1.5,.1,"wood",7,n=4)
    for k,(xx,zz,rr) in enumerate(((52,28,5),(59,35,4),(66,25,3),(96,36,7))):
        chip=rock(g,xx,zz,3,rr,rr*.65,5 if k<3 else 13,"stone",5,shrink=.6,n=5,seed=30+k)
        P.flat(g,chip & (Y<5),"sand",3)
    for xx,zz in ((52,40),(64,39),(56,21)):
        limb(g,(xx,3,zz),(xx+5,4,zz+2),1.2,.5,"wood",6,n=4)
    X, Y, Z = ctr(g)
    pole = mast & (Y > 8) & (Y < 21) & (np.abs(Z - (28 + 6 * (X - 11) / 87)) < 3.6)
    P.flat(g, pole & (np.floor(X / 7) % 2 == 0), "wood", 6)
    P.flat(g, pole & (np.abs(Z - (28 + 6 * (X - 11) / 87)) < 1), "darkwood", 3)
    # A cross-arm with three ceramic insulators is still attached at the high end.
    limb(g, (87, 18, 21), (87, 18, 45), 2.5, 2.2, "rust", 5, n=4)
    for z0 in (22, 33, 44):
        insulator = S.disc(g, "y", 87, z0, 3.0, 20, 24, "teal", 5, n=8)
        P.flat(g, insulator & (Y > 22), "bone", 6)
    # Three coated cables sag between the fallen pole and a ground stake.
    for k, (x0, x1, z0) in enumerate(((87, 28, 22), (87, 38, 33), (87, 48, 44))):
        mid = (x0 + x1) / 2
        limb(g, (x0, 20, z0), (mid, 10, z0 + 2), 0.85, 0.75, "steel", 5, n=4)
        limb(g, (mid, 10, z0 + 2), (x1, 5, z0 + 1), 0.75, 0.6, "steel", 5, n=4)
        P.flat(g, (g.a > 0) & (np.abs(X - mid) < 2) & (np.abs(Y - 10) < 1) & (np.abs(Z - z0 - 2) < 1), "gold", 6)
    for k, (cx, cz, r) in enumerate(((16, 27, 7), (94, 39, 6), (83, 23, 4))):
        rock(g, cx, cz, 3, r, r * 0.8, 4, "stone", 5, shrink=0.58, n=6, seed=10 + k)
    box(g, 7, 3, 23, 12, 10, 32, "steel", 5)
    return make("terrain-nature", "fallen-power-pole", "Fallen Power Pole", Part("fallen-power-pole", g))
