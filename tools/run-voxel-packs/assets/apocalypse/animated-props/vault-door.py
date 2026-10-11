"""A steel vault leaf swings across a framed emergency shelter entrance."""
import math

import numpy as np
import paint as P
import pnpaint as PP
from _life import Rig, ctr, fx, limb, make
from pnkit import box, edges
from pnshapes import disc
from voxgrid import C, Clip, Grid

SIZE = (72, 80, 34)
CX, CY, CZ = 38.0, 40.0, 17.0
G0 = 3  # the ground in the build frame: the parts above keep their old heights


def frame() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    # A steel threshold beam, 2 voxels high, carries both posts (no plinth).
    sill = box(g, 4, G0, 11, 72, G0 + 2, 26, "iron", 4)
    P.plates(g, sill, "iron", 4, size=(17, 2), rivets=True, seed=1)
    PP.hazard(g, sill & ((Z < 12) | (Z > 25)), period=6, a=("gold", 5), b=("iron", 3))
    P.flat(g, sill & (Y > G0 + 1) & (X > 19) & (X < 57) & (np.abs(Z - 18.5) < 2), "steel", 5)  # the worn tread
    left = box(g, 5, 5, 13, 18, 72, 24, "steel", 5)
    right = box(g, 58, 5, 13, 71, 72, 24, "steel", 5)
    lintel = box(g, 11, 67, 13, 65, 78, 24, "steel", 5)
    for m in (left, right, lintel):
        P.plates(g, m, "steel", 5, size=(9, 8), seed=int(np.count_nonzero(m)))
        P.flat(g, edges(m), "iron", 2)
    # Eight thick facets form an open circular surround.
    for k in range(8):
        a0, a1 = 2 * math.pi * k / 8, 2 * math.pi * (k + 1) / 8
        pts = [(CX + r * math.cos(a), CY + r * math.sin(a)) for r, a in ((27, a0), (27, a1), (21, a1), (21, a0))]
        g.prism("z", pts, 10, 15, C("gold", 5))
        P.plates(g, g.solids[-1].mask(g.shape), "gold", 5, size=(6, 5), seed=k)
    for hx in (14, 62):
        for yy in (18, 34, 50, 64):
            disc(g, "z", hx, yy, 2.0, 8, 12, "rust", 6, n=8)
    return g


def leaf() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    slab = disc(g, "z", CX, CY, 20.5, 3, 11, "steel", 5, n=12)
    P.plates(g, slab, "steel", 5, size=(8, 7), seed=12)
    P.flat(g, edges(slab), "darkwood", 3)
    hub = disc(g, "z", CX, CY, 5.0, 1, 3, "gold", 6, n=8)
    for k in range(8):
        a = math.pi * 2 * k / 8
        limb(g, (CX, CY, 2), (CX + math.cos(a) * 17, CY + math.sin(a) * 17, 2), 1.3, 1.3, "iron", 4, n=4)
    for k in range(6):
        a = math.pi * 2 * k / 6
        disc(g, "z", CX + math.cos(a) * 12, CY + math.sin(a) * 12, 1.3, 1, 3, "gold", 6, n=8)
    box(g, CX - 2, CY - 2, 10, CX + 2, CY + 2, 15, "rust", 5)
    return g


def build():
    rig = Rig("vault-door", (CX, G0, CZ), frame())
    rig.add("leaf", leaf(), (18, CY, 11))
    idle = {"leaf": {"rot": [(0, (0, 0, 0)), (1, (0, 2, 0)), (2, (0, 0, 0))]}}
    cycle = {"leaf": {"rot": [(0, (0, 0, 0)), (0.8, (0, -112, 0)), (1.6, (0, 0, 0)), (2.4, (0, -112, 0)), (3.2, (0, 0, 0))]}}
    socket = rig.socket("socket-handwheel", (CX, CY, 1), parent="leaf")
    return make("animated-props", "vault-door", "Vault Door", rig.root,
                clips=[Clip("idle", idle), Clip("active", cycle)], sockets=[socket],
                pfx=[fx("rvx-apocalypse-metal-clang", "socket-handwheel", "clip:active", at=0.8, size=14)])
