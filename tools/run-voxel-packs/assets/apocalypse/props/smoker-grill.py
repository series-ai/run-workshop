"""Oil-drum smoker grill, in the Pirate Nation style.

One chunky icon (rule K3): a faceted signal-red drum lying on a welded
frame of fat legs with a plank shelf and a diagonal brace (rules F2, F3).
The oversized function prop (rules F4, K1) is a tall tapered chimney with
a rain cap, leaning a little off plumb (rule F5). A riveted firebox at the
-x end shows painted embers behind a hazard-yellow door, three hinges and
a bent wooden handle run along the lid seam, a brass thermometer dial sits
on the end cap, and split logs lie on the shelf. Plates, soot, rust, the
gold flame brand and BBQ are paint (rule S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint as PP
import pnshapes as S
from _props import asset, root
from pnkit import box, edges, ngon
from voxgrid import Grid, Socket, bounds_pivot

GW, GH, GD = 36, 40, 22
CY, CZ, R = 18.0, 11.0, 7.5  # the drum axle and its flat radius
BX0, BX1 = 4, 32  # the drum along x
LEG_Y = 9  # the top of the legs
SX, SZ = 27.5, 11.0  # the chimney foot


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)

    # ---- the frame: four fat legs, foot plates, rails and a brace
    frame = np.zeros(g.shape, dtype=bool)
    for lx in (7, 23):
        for lz in (4, 15):
            frame |= box(g, lx, 0, lz, lx + 3, LEG_Y + 2, lz + 3, "steel", 4)
            frame |= box(g, lx - 1, 0, lz - 1, lx + 4, 2, lz + 4, "steel", 3)
    for lz in (4, 15):
        frame |= box(g, 7, LEG_Y - 1, lz, 26, LEG_Y + 2, lz + 3, "steel", 4)
        frame |= S.bar(g, "z", (8, 3), (25, LEG_Y - 1), 2.0, lz, lz + 3, "steel", 3)
    P.plates(g, frame, "steel", 4, size=(4, 10), rivets=False, seed=1)
    P.flat(g, edges(frame), "steel", 2)
    PP.blotch(g, frame, "rust", 5, cell=5, chance=0.06, seed=2)
    shelf = box(g, 6, 3, 3, 27, 5, 19, "wood", 5)
    P.planks(g, shelf, "wood", 5, width=4, across="x", nails=True, frame="top", seed=3)
    P.flat(g, edges(shelf), "darkwood", 3)
    for k, wz in enumerate((5, 9, 13)):  # split logs stacked on the shelf
        lg = S.disc(g, "x", 6.6, wz + 1.6, 1.6, 9 + k, 21 + k * 2, "darkwood", 4, n=6)
        P.flat(g, lg & (X < 10 + k), "wood", 6)

    # ---- the drum: one faceted prism with proud rolling hoops
    body = S.disc(g, "x", CY, CZ, R, BX0, BX1, "red", 4, n=8)
    P.plates(g, body, "red", 4, size=(9, 6), rivets=True, seed=4)
    P.mottle(g, body, "red", 4, cell=4, seed=14)
    hoops = np.zeros(g.shape, dtype=bool)
    for hx in (BX0 + 5, BX1 - 7):
        hoops |= S.disc(g, "x", CY, CZ, R + 0.8, hx, hx + 2, "steel", 5, n=8)
    P.flat(g, hoops, "steel", 5)
    P.flat(g, edges(hoops), "steel", 3)
    d = S.ngon_radius(g, "x", CY, CZ, 8)
    P.flat(g, body & (X > BX1 - 1), "steel", 5)  # the +x end cap
    P.flat(g, body & (X > BX1 - 1) & (d > R - 1.4), "steel", 3)
    P.flat(g, (body | hoops) & (Y < CY - 3), "red", 2)  # the shaded belly
    P.flat(g, body & (Y > CY + 4) & (Z > CZ), "red", 5)  # the lit top of the lid
    PP.blotch(g, body, "rust", 5, cell=5, chance=0.05, seed=12)

    # ---- the hinged lid: a painted seam, three hinges and a bent handle
    P.flat(g, body & (np.abs(Y - (CY + 1.6)) < 0.6) & (Z < CZ + 2), "red", 2)
    P.flat(g, body & (np.abs(Y - (CY + 2.8)) < 0.6) & (Z < CZ + 2), "red", 6)
    for hx in (BX0 + 3, 17, BX1 - 5):
        hg = box(g, hx, CY, CZ + R - 2.6, hx + 3, CY + 3, CZ + R + 0.6, "steel", 5)
        P.flat(g, edges(hg), "steel", 3)
    S.bar(g, "x", (CY - 1.8, CZ - R - 1.8), (CY + 1.8, CZ - R - 1.2), 1.4, 14, 22, "darkwood", 4)
    for hx in (14, 21):
        box(g, hx, CY - 2, CZ - R - 1.6, hx + 1, CY + 2, CZ - R + 0.6, "steel", 5)

    # ---- the firebox at the -x end: riveted, with a hazard door and embers
    fire = box(g, 0, 7, 3, 7, CY + 3, 19, "steel", 4)
    P.plates(g, fire, "steel", 4, size=(6, 6), rivets=True, seed=5)
    P.flat(g, edges(fire), "steel", 2)
    vent = box(g, 0, 11, 6, 1, 21, 16, "ember", 3)
    P.flat(g, vent & (np.floor(Y) % 3 == 0), "ember", 5)
    P.flat(g, vent & (np.floor(Y) % 6 == 0), "gold", 6)
    door = box(g, 0, 9, 1, 2, 23, 4, "steel", 4)
    PP.hazard(g, door, period=6, a=("gold", 5), b=("darkwood", 3), frame="x")
    P.flat(g, edges(door), "steel", 2)
    box(g, 1, 15, 0, 3, 17, 2, "gold", 5)  # the door latch
    PP.blotch(g, fire, "rust", 5, cell=4, chance=0.08, seed=6)
    P.flat(g, fire & (Y > CY + 1), "steel", 3)  # soot over the firebox

    # ---- the chimney: a tall tapered frustum with a rain cap
    g.prism("y", ngon(SX, SZ, 3.4, 8), CY + 2, 36, S.C("steel", 4), top=ngon(SX - 2.0, SZ + 0.8, 2.4, 8))
    stack = S.last(g)
    P.flat(g, stack, "steel", 4)
    P.flat(g, stack & (np.floor(Y) % 6 == 0), "steel", 3)
    PP.blotch(g, stack, "rust", 5, cell=3, chance=0.09, seed=7)
    P.flat(g, stack & (Y > 33), "steel", 2)  # soot at the mouth
    cap = S.disc(g, "y", SX - 2.0, SZ + 0.8, 3.4, 37, 38.5, "steel", 5, n=8)
    P.flat(g, cap & (Y < 37.6), "steel", 3)
    for cz in (SZ - 1.4, SZ + 2.6):
        S.bar(g, "z", (SX - 3.4, 35.0), (SX - 0.6, 35.0), 1.2, cz, cz + 1, "steel", 5)

    # ---- paint: a thermometer dial, the gold flame brand and BBQ
    dial = S.disc(g, "x", CY + 3.2, CZ - 4.6, 2.6, BX1 - 1, BX1, "bone", 7, n=8)
    P.flat(g, dial & (S.ngon_radius(g, "x", CY + 3.2, CZ - 4.6, 8) > 1.8), "steel", 3)
    P.flat(g, dial & (np.abs((Y - CY - 3.2) + (Z - CZ + 4.6)) < 0.8) & (Y > CY + 3.2), "red", 2)
    for sx0 in (16, 20):  # two gold stripes round the drum (the hazard accent)
        P.flat(g, body & (X > sx0) & (X < sx0 + 2), "gold", 5)
        P.flat(g, body & (X > sx0) & (X < sx0 + 2) & (Y < CY - 3), "gold", 3)
    pnglyph.text(g, "+z", CZ + R - 1, 11, int(CY - 3), "BBQ", "gold", 6)
    r = root("smoker-grill", g)
    pivot = bounds_pivot(g)
    sock = Socket("socket-chimney", at=(SX - 2.0 - pivot[0], 39.0 - pivot[1], SZ + 0.8 - pivot[2]))
    return asset("smoker-grill", "Oil-Drum Smoker", r, sockets=[sock],
                 pfx=[{"effectId": "rvx-apocalypse-chimney-smoke", "trigger": "idle", "socket": "socket-chimney", "size": 14}])
