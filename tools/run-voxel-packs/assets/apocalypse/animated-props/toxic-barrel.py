"""Leaking toxic barrel, in the Pirate Nation style.

One iconic shape (rule K3): a fat hazard-yellow octagonal drum tipped on
its side, with proud rolling hoops, a big radiation trefoil on its end and
a dent. Glowing toxic sludge pours out of the open end into a pool that
pulses on `idle`; the loose lid lies in the pool and rattles. Hoops and
facets are true geometry; the trefoil, drips and dents are paint.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, blob, ctr, fx, keys, loop, make, plan, trefoil_rows
from voxgrid import C, Clip, Grid

SZ = (42, 20, 34)
R = 7.5
X0, X1 = 15.0, 35.0  # the drum runs along x; the open end is x = X0
CZ = 17.0
CY = R + 0.8  # the drum rests on its hoops


def drum() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    body = S.disc(g, "x", CY, CZ, R, X0, X1, "gold", 5, n=8)
    hoops = np.zeros(g.shape, dtype=bool)
    for hx in (X0 + 3.5, X1 - 5.5):
        hoops |= S.disc(g, "x", CY, CZ, R + 0.8, hx, hx + 2, "gold", 6, n=8)
    P.mottle(g, body & ~hoops, "gold", 5, cell=4, seed=1)
    d = S.ngon_radius(g, "x", CY, CZ, 8)
    # the far end cap: a chime ring and the trefoil; the open end: dark rim, sludge inside
    far = body & (X > X1 - 1)
    P.flat(g, far & (d > R - 1.5), "gold", 4)
    G.stamp(g, "+x", X1, int(CZ - 6.5), int(CY - 6.5), trefoil_rows(13), {"#": C("darkwood", 4)})
    near = body & (X < X0 + 1)
    P.flat(g, near, "gold", 3)
    P.flat(g, near & (d < R - 1.5), "toxic", 6)
    P.flat(g, near & (d < R - 3.5), "toxic", 7)
    # a big dent (dark pit, light rim) and rust along the ground line
    dent = body & ~hoops & (np.hypot(X - 27, Z - (CZ - R)) < 2.6) & (Y > 6)
    P.flat(g, dent, "gold", 3)
    P.flat(g, body & ~hoops & (np.hypot(X - 27.8, Z - (CZ - R)) < 1.2) & (Y > 6), "gold", 7)
    PP.blotch(g, body & (Y < 4), "rust", 5, cell=2, chance=0.12, seed=2)
    # toxic drips running down the front from the open end
    for dz, dx in ((-R + 0.5, X0 + 1.5), (-R + 0.5, X0 + 6.5)):
        run = body & (np.abs(X - dx) < 1.0) & (Z < CZ + dz + 1.4) & (Y < R + 2)
        P.flat(g, run, "toxic", 5)
    P.flat(g, hoops, "steel", 6)
    P.outline(g, hoops, "steel", 4, normal="x")
    return g


def pool() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    m = plan(g, blob(9.0, 16.0, 9.0, 12.0, n=10, jitter=0.22, seed=3), 0, 1.5, "toxic", 5)
    m |= plan(g, blob(18.0, 7.0, 7.0, 4.0, n=7, jitter=0.2, seed=4), 0, 1.0, "toxic", 5)
    P.flat(g, m, "toxic", 6)
    r = np.hypot(X - 9, (Z - 16) * 0.8)
    P.flat(g, m & (np.abs(r - 4) < 0.6), "toxic", 7)
    P.flat(g, m & (np.abs(r - 7.5) < 0.6), "toxic", 5)
    P.outline(g, m, "toxic", 3, normal="y")
    for bx, bz, br in ((6.5, 12.5, 2.6), (11.5, 21.5, 2.2), (4.5, 20.5, 2.0)):  # sludge bubbles
        m |= S.dome(g, bx, bz, 1.0, br, h=br, n=6, rings=2, ramp="toxic", base=7, ribs=None, painter=lambda gg, mm, fr: P.flat(gg, mm, "toxic", 7))
    return g


def lid() -> Grid:
    g = Grid(*SZ)
    m = S.disc(g, "y", 7.0, 26.0, 5.2, 1.0, 2.5, "gold", 5, n=8)
    X, Y, Z = ctr(g)
    d = S.ngon_radius(g, "y", 7.0, 26.0, 8)
    P.flat(g, m & (d > 4.0), "gold", 4)
    P.flat(g, m & (np.hypot(X - 8.5, Z - 25) < 1.2), "steel", 6)
    return g


def build():
    rig = Rig("toxic-barrel", (21, 0, CZ), drum())
    rig.add("sludge", pool(), (9.0, 0.0, 16.0))
    rig.add("lid", lid(), (7.0, 1.0, 26.0), rot=(0, 0, 8))
    idle = {
        "sludge": {"scale": loop(2.4, [(1, 1, 1), (1.05, 1.6, 1.05), (0.98, 0.9, 0.98), (1.03, 1.3, 1.03)])},
        "lid": {"rot": keys((0, (0, 0, 0)), (0.3, (0, 0, -6)), (0.4, (0, 0, 2)), (0.5, (0, 0, 0)), (1.5, (0, 0, 0)), (1.6, (0, 0, -5)), (1.7, (3, 0, 0)), (2.4, (0, 0, 0)))},
    }
    return make("animated-props", "toxic-barrel", "Leaking Toxic Barrel", rig.root,
                clips=[Clip("idle", idle)],
                sockets=[rig.socket("socket-leak", (X0 - 1, CY, CZ), parent="sludge")],
                pfx=[fx("rvx-apocalypse-toxic-bubbles", "socket-leak", "idle", size=22)])
