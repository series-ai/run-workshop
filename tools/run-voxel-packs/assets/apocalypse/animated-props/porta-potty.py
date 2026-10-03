"""Abandoned porta-potty, in the Pirate Nation style.

One iconic shape (rule K3): a chunky sky-blue booth on a steel skid, with
darker corner ribs, a white roof that rises to a vent stack (true slopes),
vent grilles, and a tall door with moulded panels, a moon cut-out, a
handle and a red OCCUPIED slider. The door rattles on `idle`, bangs open
on `open` (a zombie arm flops out through the doorway) and shuts on
`close`. The doorway is 16 wide and 35 tall, so a person walks in.
Panels, grilles and grime are paint.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, keys, limb, make, plan, skin
from pnkit import box, edges
from voxgrid import C, Clip, Grid

SZ = (34, 54, 34)
BX0, BX1, BZ0, BZ1 = 5, 29, 6, 30
BY0, BY1 = 2, 40
DX0, DX1, DY0, DY1 = 9, 25, 3, 38  # the door
HINGE = (DX1, DY0, BZ0 - 1)


def booth() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    skid = box(g, BX0 - 1, 0, BZ0 - 1, BX1 + 1, BY0, BZ1 + 1, "steel", 4)
    P.outline(g, skid, "steel", 3)
    body = box(g, BX0, BY0, BZ0, BX1, BY1, BZ1, "sky", 4)
    P.mottle(g, body, "sky", 4, cell=4, seed=1)
    # the doorway behind the door: a deep blue shadow
    P.flat(g, body & (Z < BZ0 + 1) & (X >= DX0) & (X < DX1) & (Y >= DY0) & (Y < DY1), "blue", 3)
    ribs = np.zeros(g.shape, dtype=bool)
    for cx, cz in ((BX0 - 1, BZ0 - 1), (BX1 - 2, BZ0 - 1), (BX0 - 1, BZ1 - 2), (BX1 - 2, BZ1 - 2)):
        ribs |= box(g, cx, BY0, cz, cx + 3, BY1, cz + 3, "sky", 3)
    for x0 in (BX0 - 1,):  # moulded side ribs (the +x side carries the sign)
        for zc in (14, 22):
            ribs |= box(g, x0, BY0 + 3, zc, x0 + 1, BY1 - 3, zc + 2, "sky", 3)
    P.flat(g, edges(ribs), "sky", 2)
    # vent grilles high on the sides and a sticker on the +x side
    for x0 in (BX0, BX1 - 1):
        P.flat(g, body & (X >= x0) & (X < x0 + 1) & (Y >= 32) & (Y < 37) & (Z >= 11) & (Z < 25) & (np.floor(Y) % 2 == 0), "blue", 2)
    G.text(g, "+x", BX1, 7, 16, "WC", "bone", 7, scale=2)
    P.grime(g, body, height=6, seed=2)
    PP.blotch(g, body & (Y < 12), "khaki", 5, cell=2, chance=0.05, seed=3)
    # the roof: a white frustum lip and a hip that rises to a vent stack (true slopes)
    lip = plan(g, [(BX0 - 2, BZ0 - 2), (BX1 + 2, BZ0 - 2), (BX1 + 2, BZ1 + 2), (BX0 - 2, BZ1 + 2)], BY1, BY1 + 2, "bone", 6)
    roof = plan(g, [(BX0 - 1, BZ0 - 1), (BX1 + 1, BZ0 - 1), (BX1 + 1, BZ1 + 1), (BX0 - 1, BZ1 + 1)], BY1 + 2, BY1 + 6, "bone", 7, top=[(BX0 + 6, BZ0 + 6), (BX1 - 6, BZ0 + 6), (BX1 - 6, BZ1 - 6), (BX0 + 6, BZ1 - 6)])
    P.flat(g, lip, "bone", 5)
    for m, fr in S.facets(g, [g.solids[-1]]):
        P.tiles(g, m, "bone", 6, row=4, width=24, frame=fr)
    stack = S.disc(g, "y", BX1 - 8, BZ1 - 8, 2.0, BY1 + 4, BY1 + 9, "steel", 5, n=8)
    P.flat(g, stack & (Y > BY1 + 8), "steel", 3)
    del roof
    return g


def door() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    d = box(g, DX0, DY0, BZ0 - 2, DX1, DY1, BZ0, "sky", 5)
    P.mottle(g, d, "sky", 5, cell=4, seed=4)
    P.outline(g, d, "sky", 3, normal="z")
    for y0, y1 in ((DY0 + 3, DY0 + 17), (DY0 + 20, DY1 - 9)):  # moulded panels
        pan = d & (Z < BZ0 - 1) & (X >= DX0 + 3) & (X < DX1 - 3) & (Y >= y0) & (Y < y1)
        P.outline(g, pan, "sky", 3, normal="z")
    # the moon cut-out: a dark crescent near the top
    cx, cy = (DX0 + DX1) / 2, DY1 - 4.5
    moon = d & (np.hypot(X - cx, Y - cy) < 3.2) & ~(np.hypot(X - cx - 1.6, Y - cy - 0.8) < 2.6)
    P.flat(g, moon, "navy", 3)
    handle = box(g, DX0 + 1, 18, BZ0 - 4, DX0 + 3, 24, BZ0 - 2, "steel", 6)
    P.outline(g, handle, "steel", 4)
    slider = box(g, DX0 + 1, 26, BZ0 - 3, DX0 + 5, 29, BZ0 - 2, "red", 5)
    del slider
    return g


def arm() -> Grid:
    """A zombie arm, hidden inside the booth until the door opens."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    sleeve = limb(g, (DX0 + 3.0, 24.0, BZ0 + 3.0), (DX0 + 3.0, 24.0, BZ0 + 11.0), 2.4, 2.2, "red", 4, n=4)
    fore = limb(g, (DX0 + 3.0, 24.0, BZ0 + 11.0), (DX0 + 3.0, 24.0, BZ0 + 19.0), 2.0, 1.8, "teal", 5, n=4)
    hand = box(g, DX0, 21, BZ0 + 19, DX0 + 7, 27, BZ0 + 24, "teal", 5)
    skin(g, fore | hand, "teal", 5, seed=5)
    P.flat(g, sleeve & (Z > BZ0 + 9), "red", 3)
    for k in range(3):  # yellow nails
        box(g, DX0 + 0.5 + k * 2.2, 21, BZ0 + 24, DX0 + 1.8 + k * 2.2, 23, BZ0 + 26, "gold", 6)
    return g


def build():
    rig = Rig("porta-potty", ((BX0 + BX1) / 2, 0, (BZ0 + BZ1) / 2), booth())
    rig.add("door", door(), HINGE)
    rig.add("arm", arm(), (DX0 + 3.0, 24.0, BZ0 + 3.0))
    idle = {"door": {"rot": keys((0, (0, 0, 0)), (1.2, (0, 0, 0)), (1.28, (0, -4, 0)), (1.36, (0, 0, 0)), (1.44, (0, -2, 0)), (1.52, (0, 0, 0)), (2.4, (0, 0, 0)))}}
    openk = {"door": {"rot": keys((0, (0, 0, 0)), (0.18, (0, -112, 0)), (0.3, (0, -96, 0)), (0.42, (0, -104, 0)), (0.6, (0, -100, 0)))},
             "arm": {"rot": keys((0, (0, 0, 0)), (0.2, (0, 0, 0)), (0.45, (0, 180, 0)), (0.6, (25, 180, 0)), (0.75, (18, 180, 0)))}}
    closek = {"door": {"rot": keys((0, (0, -100, 0)), (0.25, (0, 4, 0)), (0.32, (0, -3, 0)), (0.4, (0, 0, 0)))},
              "arm": {"rot": keys((0, (18, 180, 0)), (0.15, (0, 0, 0)))}}
    return make("animated-props", "porta-potty", "Porta-Potty", rig.root,
                clips=[Clip("idle", idle), Clip("open", openk, loop=False), Clip("close", closek, loop=False)])
