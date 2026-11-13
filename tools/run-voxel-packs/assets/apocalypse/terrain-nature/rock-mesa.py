"""Desert mesa rock, in the Pirate Nation style (after the PN coastal rocks).

Red-sand strata that step up in three faceted tiers (irregular frustums,
true slopes) to a flat top with a balanced boulder, a cave mouth at the
foot framed by a survivor's timber posts with a hand-painted arrow board,
cut steps up to the first ledge, scree boulders round the base and dry
scrub. Strata bands, erosion grooves and the cave shadow are paint. About
2 persons tall. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import blob, ctr, limb, make, plan, rock, slab, tuft
from pnkit import box
from voxgrid import C, Grid, Part

SZ = (108, 80, 98)
CX, CZ = 54.0, 49.0


def build():
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    tiers = [
        (blob(CX, CZ, 44, 37, n=11, jitter=0.18, seed=1), 0, 28, 0.9, (3.0, 2.0)),
        (blob(CX + 6, CZ + 5, 32, 26, n=10, jitter=0.22, seed=2), 28, 50, 0.9, (-2.0, 2.5)),
        (blob(CX + 1, CZ + 9, 21, 17, n=9, jitter=0.22, seed=3), 50, 66, 0.88, (2.0, 1.0)),
    ]
    mesa = np.zeros(g.shape, dtype=bool)
    tops = np.zeros(g.shape, dtype=bool)
    for base, y0, y1, shrink, (lx, lz) in tiers:
        cx = sum(p[0] for p in base) / len(base)
        cz = sum(p[1] for p in base) / len(base)
        top = [(cx + lx + (u - cx) * shrink, cz + lz + (v - cz) * shrink) for u, v in base]
        m = plan(g, base, y0, y1, "rust", 5, top=top)
        mesa |= m
        tops |= m & (Y > y1 - 1)
    # strata: soft warm bands with a darker line between (rule S3: no speckle)
    band = ((np.floor(Y) // 6) % 4).astype(int)
    P.flat(g, mesa, "rust", 5)
    P.flat(g, mesa & (band == 1), "rust", 6)
    P.flat(g, mesa & (band == 2), "orange", 4)
    P.flat(g, mesa & (band == 3), "sand", 4)
    # a few erosion grooves running down the faces
    ang = np.arctan2(Z - CZ, X - CX)
    P.flat(g, mesa & ~tops & (np.abs(((ang / (2 * math.pi) * 9 + np.floor(Y / 17) * 0.37) % 1) - 0.5) < 0.05) & ((np.floor(Y) % 17) > 3), "rust", 4)
    # the flat tops of each tier: sandy
    P.flat(g, tops, "sand", 6)
    PP.blotch(g, tops, "sand", 5, cell=4, chance=0.06, seed=7)
    for k,(xx,zz,yy,rr,hh) in enumerate(((23,34,12,11,20),(83,42,23,10,19),(43,69,37,10,15),(69,35,51,8,15))):
        rk=rock(g,xx,zz,yy,rr,rr*0.8,hh,"rust",5,shrink=0.7,n=6,seed=51+k)
        P.flat(g,rk & (np.floor(Y/5)%2==0),"sand",5)
    for k,(xx,zz,yy,rr) in enumerate(((16,31,6,10),(88,30,9,9),(19,70,10,9),(84,75,14,8),(27,16,17,8),(63,79,29,8),(77,17,31,7))):
        foot=rock(g,xx,zz,yy,rr,rr*.75,8,"rust",4,shrink=.85,n=5,seed=80+k)
        cap=rock(g,xx-1,zz+1,yy+8,rr*.72,rr*.5,5,"sand",5,shrink=.65,n=5,seed=100+k)
        P.flat(g,foot & (Y<yy+2),"sand",4)
    # a balanced boulder on the top
    boulder = rock(g, CX + 3, CZ + 6, 66, 7.5, 6.5, 9, ramp="sand", shade=5, shrink=0.7, lean=(1, 0), n=7, seed=4)
    P.mottle(g, boulder, "sand", 5, cell=3, seed=5)
    # the cave mouth at the foot of the front face, with a timber frame
    front_z = CZ - 38
    cave = mesa & (np.abs(X - (CX - 8)) < 9) & (Y < 22) & (Y < 22 - (np.abs(X - (CX - 8)) ** 2) / 12) & (Z < front_z + 10)
    P.flat(g, cave, "rust", 2)
    P.flat(g, cave & (Y < 8), "rust", 3)
    for px in (CX - 18, CX + 1):
        post = box(g, px, 0, front_z - 1, px + 3, 20, front_z + 6, "wood", 5)
        P.planks(g, post, "wood", 5, width=3, across="x", nails=False, seed=int(px))
    lintel = slab(g, "z", CX - 8, 21, 25, 3, front_z - 1, front_z + 6, -3, "wood", 5)
    P.planks(g, lintel, "wood", 5, width=3, across="y", seed=6)
    # a hand-painted arrow board
    board = box(g, CX + 6, 12, front_z - 2, CX + 20, 19, front_z - 1, "bone", 6)
    P.outline(g, board, "wood", 4, normal="z")
    G.stamp(g, "-z", front_z - 2, int(CX + 8), 13, ["...#......", "..##......", ".#########", "..##......", "...#......"], {"#": C("red", 4)}, depth=1)
    # cut steps up to the first ledge on the +x side
    for k in range(5):
        st = box(g, CX + 30 - k * 0, 0, CZ - 22 + k * 5, CX + 42, 5 + k * 5, CZ - 16 + k * 5, "rust", 6)
        P.flat(g, st & (Y > 3.5 + k * 5), "sand", 6)
    # scree boulders and dry scrub round the base
    for k, (bx, bz, r) in enumerate(((CX - 42, CZ - 26, 4), (CX + 36, CZ - 34, 3.5), (CX - 30, CZ + 36, 5), (CX + 44, CZ + 18, 4), (CX - 20, CZ - 40, 3))):
        rk = rock(g, bx, bz, 0, r, r * 0.8, r * 1.1, ramp="rust", shade=5, shrink=0.55, n=6, seed=10 + k)
        P.flat(g, rk & (Y > r * 0.8), "rust", 6)
    for k, (tx, tz) in enumerate(((CX - 36, CZ - 34), (CX + 30, CZ - 38), (CX + 46, CZ - 4), (CX - 46, CZ + 10))):
        tuft(g, tx + 0.5, tz + 0.5, 0, 6, blades=5, spread=3, ramp="sand", shade=6, seed=20 + k)
    return make("terrain-nature", "rock-mesa", "Mesa Rock", Part("rock-mesa", g))
