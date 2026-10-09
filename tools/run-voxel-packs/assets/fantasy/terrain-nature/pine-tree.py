"""A frost pine uses thick branch groups with uneven snow caps."""
import math

import numpy as np

import paint as P
from _life import asset, coords, leaves, leaf_block, ngon, plan, trunk
from voxgrid import Grid, Part

S = (44, 72, 44)
CX, CZ = 22.0, 22.0
# tiers: (y0, y1, bottom radius, top radius, x shift, z shift, turn)
TIERS = [
    (14, 27, 18.0, 10.0, 0.0, 0.0, 0.0),
    (23, 36, 15.5, 8.0, 0.8, -0.4, 0.2),
    (32, 45, 12.5, 6.0, 1.4, -0.6, 0.05),
    (41, 53, 9.5, 4.0, 2.0, -0.4, 0.25),
    (49, 60, 6.5, 2.0, 2.4, 0.0, 0.1),
]


def build():
    g = Grid(*S)
    X, Y, Z = coords(g)
    # root flare and a curved trunk (sheared frustums: true slopes)
    trunk(g, [(CX, 0, CZ), (CX + 0.3, 3, CZ), (CX + 0.6, 10, CZ - 0.2), (CX + 1.2, 18, CZ - 0.4)], [6.5, 4.2, 3.6, 3.0], ramp="wood", base=3, n=6, seed=1)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))
    for k,(y0,y1,r0,r1,dx,dz,angle) in enumerate(TIERS):
        crown=leaf_block(g,CX+dx,y0+5,CZ+dz,r0*1.15,11,r0*1.1,"forest",5,bevel=2,seed=10+k)
        for j,(bx,bz) in enumerate(((-r0*.65,0),(r0*.65,0),(0,-r0*.65),(0,r0*.65))):
            if k==4 and j==3: continue
            branch=leaf_block(g,CX+dx+bx,y0+2+j%2,CZ+dz+bz,r0*.78,7,r0*.70,"forest",5,bevel=1.5,seed=20+k*4+j)
            P.flat(g,branch & (Y>y0+3.5+j%2),"bone",7)
            P.flat(g,branch & (Y<y0+.5+j%2),"forest",4)
        P.flat(g,crown & (Y>y0+8.5)&((X+Z).astype(int)%7<5),"bone",7)
    # the tip: a pointed snowy cone
    plan(g, ngon(CX + 2.6, CZ, 3.5, 8, math.pi / 8), 58, 66, "bone", 7, top=[(CX + 3.4, CZ + 0.2)] * 8)
    tip = g.solids[-1].mask(g.shape)
    P.flat(g, tip & (Y < 60), "forest", 5)
    # grass and a snow patch at the foot
    base = plan(g, ngon(CX, CZ, 8.5, 7, 0.4), 0, 1, "bone", 6)
    P.flat(g, base & ((P._hash(Xi // 2, Zi // 2, seed=41) % np.uint64(3)) == 0), "bone", 7)
    root = Part("pine-tree", g, pivot=(CX, 0.0, CZ))
    return asset("terrain-nature", "pine-tree", "Frost Pine", root)
