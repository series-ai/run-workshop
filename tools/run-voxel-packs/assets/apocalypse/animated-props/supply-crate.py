"""Air-drop supply crate, in the Pirate Nation style.

One iconic shape (rule K3): a chunky olive steel crate on a pallet with a
thick dark frame, riveted plates, orange cargo straps and a big white
cross. The lid springs open on `open` (hinged at the back) and shuts on
`close`; a red strobe on its bracket blinks on `idle`. A crumpled orange
parachute (faceted true slopes) lies against its side with cords to the
lid. Plates, straps, cross and stencils are paint.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, keys, limb, make, rock
from pnkit import box, edges
from voxgrid import Clip, Grid

SZ = (42, 28, 36)
BX0, BX1, BZ0, BZ1 = 5, 29, 8, 28
BY0, BY1 = 3, 18
HINGE = (17.0, BY1, BZ1 + 1)


def crate() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    pal = box(g, BX0 - 1, 0, BZ0 - 1, BX1 + 1, BY0, BZ1 + 1, "wood", 5)
    P.planks(g, pal, "wood", 5, width=3, across="z", seed=1)
    P.flat(g, pal & (Y < 2) & (((X > BX0 + 3) & (X < BX1 - 3)) & ((Z > BZ0 + 2) & (Z < BZ1 - 2))), "darkwood", 5)
    body = box(g, BX0, BY0, BZ0, BX1, BY1, BZ1, "khaki", 5)
    P.plates(g, body, "khaki", 5, size=(8, 6), seed=2)
    P.flat(g, edges(body), "khaki", 3)
    # cargo straps round the body and a white cross on the front
    for sx in (BX0 + 4, BX1 - 6):
        P.flat(g, body & (X >= sx) & (X < sx + 2), "orange", 4)
    cross = body & (Z < BZ0 + 1) & (((np.abs(X - 17) < 2.0) & (np.abs(Y - 10.5) < 5.6)) | ((np.abs(X - 17) < 5.6) & (np.abs(Y - 10.5) < 2.0)))
    P.flat(g, cross, "bone", 7)
    P.outline(g, cross, "red", 4, normal="z")
    G.text(g, "+x", BX1, 11, 7, "AID", "bone", 6)
    # strobe bracket on the -x wall
    br = box(g, BX0 - 3, 12, 16, BX0, 15, 20, "steel", 5)
    P.outline(g, br, "steel", 3)
    # the crumpled parachute: faceted orange folds and white panels
    chute = np.zeros(g.shape, dtype=bool)
    for k, (cx, cz, rx, rz, h) in enumerate(((35.5, 19, 6, 11, 7), (35, 30, 4.5, 4, 4))):
        chute |= rock(g, cx, cz, 0, rx, rz, h, ramp="orange", shade=4, shrink=0.35, lean=(0.8, 1.0), n=9, seed=20 + k)
    gore = (np.floor((np.arctan2(Z - 19, X - 36) + np.pi) / (np.pi / 5)) % 2) == 0
    P.flat(g, chute & gore, "bone", 6)
    P.flat(g, chute & (Y < 1), "orange", 3)
    # cords from the lid corners to the chute
    for (x0, z0) in ((BX1 - 1, BZ0 + 1), (BX1 - 1, BZ1 - 1)):
        limb(g, (x0, BY1 - 1, z0), (34, 6.5, (z0 + 18) / 2), 0.6, 0.6, "bone", 5, n=4)
    return g


def lid() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    m = box(g, BX0 - 1, BY1, BZ0 - 1, BX1 + 1, BY1 + 4, BZ1 + 1, "khaki", 5)
    P.plates(g, m, "khaki", 5, size=(9, 7), frame="top", seed=3)
    P.flat(g, edges(m), "khaki", 3)
    for sx in (BX0 + 4, BX1 - 6):
        P.flat(g, m & (X >= sx) & (X < sx + 2), "orange", 4)
    top = m & (Y > BY1 + 3)
    cross = top & (((np.abs(X - 17) < 2.0) & (np.abs(Z - 18) < 6.5)) | ((np.abs(X - 17) < 6.5) & (np.abs(Z - 18) < 2.0)))
    P.flat(g, cross, "bone", 7)
    P.outline(g, cross, "red", 4, normal="y")
    hasp = box(g, 15, BY1, BZ0 - 2, 19, BY1 + 3, BZ0 - 1, "steel", 6)
    del hasp
    return g


def strobe() -> Grid:
    g = Grid(*SZ)
    m = S.disc(g, "y", BX0 - 1.5, 18.0, 1.8, 15, 16, "steel", 4, n=8)
    m |= S.dome(g, BX0 - 1.5, 18.0, 16, 1.8, h=2.5, n=8, rings=2, ramp="red", base=6, ribs=None, painter=lambda gg, mm, fr: P.flat(gg, mm, "red", 6))
    return g


def build():
    rig = Rig("supply-crate", (17, 0, 18), crate())
    rig.add("lid", lid(), HINGE)
    rig.add("beacon", strobe(), (BX0 - 1.5, 15.0, 18.0))
    openk = {"lid": {"rot": keys((0, (0, 0, 0)), (0.25, (118, 0, 0)), (0.4, (100, 0, 0)), (0.5, (106, 0, 0)))}}
    closek = {"lid": {"rot": keys((0, (106, 0, 0)), (0.3, (0, 0, 0)), (0.36, (5, 0, 0)), (0.42, (0, 0, 0)))}}
    idle = {"beacon": {"scale": keys((0, (1, 1, 1)), (0.1, (1.5, 1.6, 1.5)), (0.2, (1, 1, 1)), (1.0, (1, 1, 1)))}}
    return make("animated-props", "supply-crate", "Air-Drop Supply Crate", rig.root,
                clips=[Clip("open", openk, loop=False), Clip("close", closek, loop=False), Clip("idle", idle)],
                sockets=[rig.socket("socket-loot", (17, BY1 - 1, 18))],
                pfx=[fx("rvx-apocalypse-crate-dust", "socket-loot", "clip:open", size=30, at=0.12)])
