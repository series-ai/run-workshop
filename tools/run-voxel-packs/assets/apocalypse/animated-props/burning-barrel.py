"""Burning barrel, in the Pirate Nation style.

One iconic shape (rule K3): a fat octagonal rust drum with two proud hoops,
rows of punched air holes that glow, and a bed of hot coals at the open top.
Three scrap boards lean out over the rim (true slopes). Three faceted flame
tongues (a tall main one, a left and a back one) flicker on `idle`; the
fire socket sits on the coals. Rust, dents and the holes are paint.
"""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, flame, fx, keys, make, slab
from voxgrid import Clip, Grid

SZ = (30, 42, 30)
CX = CZ = 15.0
R, H = 9.0, 21


def barrel() -> Grid:
    g = Grid(*SZ)
    body = S.drum(g, CX, CZ, 0, H, R, ramp="rust", base=5, hoop="steel", band=None, wear=True, seed=4)
    X, Y, Z = ctr(g)
    top = body & (Y > H - 1)
    d = S.ngon_radius(g, "y", CX, CZ, 8)
    # the open top: a dark rim ring and a bed of glowing coals
    P.flat(g, top & (d > R - 1.6), "rust", 3)
    coals = top & (d <= R - 1.6)
    P.flat(g, coals, "ember", 2)
    PP.blotch(g, coals, "gold", 5, cell=2, chance=0.12, seed=5)
    PP.blotch(g, coals, "red", 4, cell=2, chance=0.08, seed=6)
    # punched air holes in two rows that glow from the fire inside
    ang = np.arctan2(Z - CZ, X - CX)
    side = body & ~top & (d > R - 1.2)
    for yc, off in ((8.5, 0.0), (13.5, np.pi / 8)):
        holes = side & (np.abs(Y - yc) < 1.1) & (np.abs(((ang + off) / (np.pi / 4) + 0.5) % 1 - 0.5) < 0.16)
        P.flat(g, holes, "rust", 2)
        P.flat(g, holes & (np.abs(Y - yc) < 0.6), "ember", 3)
    # scorch soot up from the rim (soft, not black)
    P.flat(g, side & (Y > H - 4) & ((np.floor(X) + np.floor(Y)) % 3 == 0), "rust", 3)
    # scrap boards leaning out of the drum
    for (u, lo, ang_deg, ramp) in ((CX - 6, CZ + 3, 18, "wood"), (CX + 5, CZ - 2, -22, "wood")):
        b = slab(g, "z", u, H + 3, 3, 12, lo - 1, lo + 1, ang_deg, ramp, 5)
        P.planks(g, b, ramp, 5, width=3, across="x", nails=True, seed=int(u))
    b = slab(g, "x", H + 2, CZ + 6, 11, 3, CX - 1, CX + 1, 70, "darkwood", 5)
    P.planks(g, b, "darkwood", 5, width=3, across="z", seed=3)
    return g


def tongue(cx, cz, y0, h, r, lean, seed) -> Grid:
    g = Grid(*SZ)
    flame(g, cx, cz, y0, h, r, lean=lean, seed=seed)
    return g


def build():
    rig = Rig("burning-barrel", (CX, 0, CZ), barrel())
    fires = {
        "flame-main": (CX, CZ, H - 1, 18, 5.0, (1.0, -0.5)),
        "flame-left": (CX - 4, CZ - 1, H - 1, 11, 3.2, (-2.0, -0.5)),
        "flame-back": (CX + 2, CZ + 4, H - 1, 13, 3.4, (1.0, 2.0)),
    }
    for k, (name, (fx_, fz, y0, h, r, lean)) in enumerate(fires.items()):
        rig.add(name, tongue(fx_, fz, y0, h, r, lean, k), (fx_, y0, fz))
    idle = {
        "flame-main": {"scale": keys((0, (1, 1, 1)), (0.2, (0.9, 1.2, 0.9)), (0.45, (1.08, 0.85, 1.08)), (0.7, (0.95, 1.14, 0.95)), (0.9, (1, 1, 1))),
                       "rot": keys((0, (0, 0, 0)), (0.3, (4, 0, -5)), (0.6, (-3, 0, 4)), (0.9, (0, 0, 0)))},
        "flame-left": {"scale": keys((0, (1, 1, 1)), (0.15, (1.1, 0.8, 1.1)), (0.4, (0.9, 1.25, 0.9)), (0.65, (1.05, 0.9, 1.05)), (0.9, (1, 1, 1))),
                       "rot": keys((0, (0, 0, 0)), (0.45, (0, 0, 8)), (0.9, (0, 0, 0)))},
        "flame-back": {"scale": keys((0, (1, 1, 1)), (0.25, (0.92, 1.18, 0.92)), (0.5, (1.1, 0.82, 1.1)), (0.75, (0.96, 1.1, 0.96)), (0.9, (1, 1, 1))),
                       "rot": keys((0, (0, 0, 0)), (0.45, (-7, 0, 0)), (0.9, (0, 0, 0)))},
    }
    return make("animated-props", "burning-barrel", "Burning Barrel", rig.root,
                clips=[Clip("idle", idle)],
                sockets=[rig.socket("socket-fire", (CX, H + 1, CZ))],
                pfx=[fx("rvx-apocalypse-barrel-fire", "socket-fire", "idle", size=18)])
