"""Smith's quench trough in the Pirate Nation style.

A hooped timber trough in warm plank wood stands on a grey-blue stone
kerb, brim-full of bright cyan water. The oversized function prop is the
glowing blade held in long steel tongs over the water (rules F4 and C3):
its tip is still forge-orange where it breaks the surface. The tongs lie
level on the -x end rim with the handles out past it, and the jaw closes
on the blade just above the water, so nothing hangs in the air. A hammer lying
on the kerb, a whetstone and a hooped pail fill the free end of the kerb,
each with a clear contact. The waterfall-mist effect plays at
socket-steam. About 40 wide and 28 tall.
"""

import numpy as np

import paint as P
from _props import coords, stone_box
from pnkit import box, edges
from pnshapes import disc, last, quad, rotate
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 40, 30, 26
X0, X1 = 12, 38
ZF, ZB = 5, 21
TOP = 17  # the trough rim
WATER = 15  # the water surface
BX, BZ = 25, 13  # where the blade enters
KERB = 4  # the kerb top


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # a grey-blue stone kerb, wide enough to carry the loose tools
    kerb = stone_box(g, 0, 0, 2, W, KERB, 24, "stone", 3, block=(6, 3), rim=-2, seed=1)
    P.flat(g, kerb & (Yi == KERB - 1), "stone", 4)
    P.stone(g, kerb & (Yi == KERB - 1), "stone", 4, block=(5, 4), frame="top", seed=2)

    # the trough: a plank floor and four plank walls, hooped in iron
    floor = box(g, X0, KERB, ZF, X1, KERB + 4, ZB, "wood", 5)
    walls = box(g, X0, KERB + 4, ZF, X1, TOP, ZF + 3, "wood", 5)
    walls |= box(g, X0, KERB + 4, ZB - 3, X1, TOP, ZB, "wood", 5)
    walls |= box(g, X0, KERB + 4, ZF, X0 + 3, TOP, ZB, "wood", 5)
    walls |= box(g, X1 - 3, KERB + 4, ZF, X1, TOP, ZB, "wood", 5)
    body = floor | walls
    P.planks(g, body, "wood", 5, width=3, across="y", frame="wall", nails=True, seed=3)
    P.flat(g, edges(body), "darkwood", 3)  # a 1-voxel frame, not the whole skin
    P.flat(g, body & (Yi == TOP - 1), "wood", 7)  # the lit rim
    P.flat(g, body & (Yi == KERB + 4), "wood", 3)  # the shaded foot course
    for hx in (X0 + 3, 24, X1 - 6):  # iron hoops
        P.flat(g, body & (Xi >= hx) & (Xi < hx + 3) & (Yi < TOP - 1), "iron", 4)
        P.flat(g, body & (Xi == hx + 1) & (Yi < TOP - 1), "iron", 5)
        P.flat(g, body & (Xi >= hx) & (Xi < hx + 3) & (Yi == KERB + 5), "iron", 2)
    P.flat(g, body & (Yi > KERB + 4) & (Yi < TOP - 1) & (Zi > ZF + 2) & (Zi < ZB - 2)
           & (Xi > X0 + 2) & (Xi < X1 - 2), "wood", 3)  # the wet inner faces

    # the water, with a bright ring where the blade enters
    water = box(g, X0 + 3, WATER - 4, ZF + 3, X1 - 3, WATER + 1, ZB - 3, "cyan", 4)
    P.flat(g, water, "cyan", 4)
    P.flat(g, water & (Yi == WATER), "cyan", 5)
    wd = np.hypot(X - BX, Z - BZ)
    P.flat(g, water & (Yi == WATER) & (wd < 6.5) & (wd > 4.8), "cyan", 6)
    P.flat(g, water & (Yi == WATER) & (wd < 3.6) & (wd > 2.2), "cyan", 7)
    P.flat(g, water & (Yi == WATER) & (wd < 1.6), "bone", 7)

    # the blade, dipped at an angle
    pts = rotate(quad((BX, WATER - 3), (BX, WATER + 13), 2.6, 1.3, cap=0.9), BX, WATER, -20)
    g.prism("z", pts, BZ - 1, BZ + 1, C("steel", 6))
    blade = last(g)
    P.flat(g, blade, "steel", 6)
    P.flat(g, blade & (Zi == BZ - 1), "steel", 7)
    P.flat(g, blade & (Yi > WATER + 4) & (Yi < WATER + 9), "orange", 5)  # still forge-hot
    P.flat(g, blade & (Yi > WATER + 1) & (Yi <= WATER + 4), "orange", 6)
    P.flat(g, blade & (Yi > WATER - 1) & (Yi <= WATER + 1), "gold", 7)  # white-hot at the waterline
    P.flat(g, blade & (Yi < WATER), "steel", 4)  # quenched, under water

    # the tongs lie level on the trough: both arms rest on the -x end rim,
    # their handles hang out past it, and the jaw closes on the blade just
    # above the water. So the tongs have a clear contact at the rim.
    TY = TOP  # the underside of the arms: the top of the rim
    for dz0, sh in ((BZ - 3, 6), (BZ + 1, 5)):
        t = box(g, X0 - 5, TY, dz0, BX - 2, TY + 2, dz0 + 2, "steel", sh)
        P.flat(g, t, "steel", 3)  # the shaded underside and sides
        P.flat(g, t & (Yi == TY + 1), "steel", sh)  # the lit top
        P.flat(g, t & (Xi < X0 + 1), "darkwood", 4)  # the leather grips
        P.flat(g, t & (Xi < X0 + 1) & (Yi == TY + 1) & ((Xi % 2) == 0), "darkwood", 5)
    rivet = box(g, 18, TY, BZ - 3, 20, TY + 3, BZ + 3, "steel", 5)
    P.flat(g, rivet, "steel", 5)
    P.flat(g, rivet & (Yi > TY + 1), "steel", 7)
    P.flat(g, edges(rivet), "steel", 2)
    jaw = box(g, BX - 3, TY, BZ - 3, BX + 3, TY + 3, BZ + 3, "steel", 4)
    P.flat(g, jaw, "steel", 4)
    P.flat(g, jaw & (Yi > TY + 1), "steel", 6)
    P.flat(g, edges(jaw), "steel", 2)

    # a hammer lying flat on the kerb, a whetstone and a hooped pail
    hd = box(g, 1, KERB, 15, 6, KERB + 5, 21, "steel", 5)
    P.plates(g, hd, "steel", 5, size=(5, 4), rivets=False, frame="wall", seed=4)
    P.flat(g, hd & (Xi > 4), "steel", 7)
    P.flat(g, hd & (Yi > KERB + 3), "steel", 6)
    P.flat(g, edges(hd), "steel", 2)
    haft = box(g, 6, KERB + 1, 17, 11, KERB + 4, 20, "wood", 5)
    P.planks(g, haft, "wood", 5, width=2, across="x", frame="x", nails=False, seed=5)
    P.flat(g, haft & (Xi > 9), "red", 5)
    P.flat(g, edges(haft), "darkwood", 3)
    ws = box(g, 1, KERB, 3, 8, KERB + 3, 8, "stone", 4)
    P.stone(g, ws, "stone", 4, block=(4, 3), seed=6)
    P.flat(g, ws & (Yi > KERB + 1), "stone", 5)
    P.flat(g, edges(ws), "stone", 2)
    pail = disc(g, "y", 6, 11, 4.0, KERB, KERB + 8, "wood", 6, n=8)
    P.planks(g, pail, "wood", 6, width=2, across="x", frame="wall", nails=False, seed=7)
    P.flat(g, pail & ((Yi == KERB + 1) | (Yi == KERB + 6)), "iron", 4)
    P.flat(g, pail & (Yi > KERB + 6) & (np.hypot(X - 6, Z - 11) < 2.8), "cyan", 5)
    P.flat(g, pail & (Yi > KERB + 6) & (np.hypot(X - 6, Z - 11) < 1.4), "cyan", 7)

    root = Part("quench-trough", g)
    return Asset(id="fantasy-props-quench-trough", pack="fantasy", category="props", name="Quench Trough", root=root,
                 sockets=[Socket("socket-steam", at=(float(BX), float(WATER + 2), float(BZ)))],
                 pfx=[{"effectId": "rvx-fantasy-waterfall-mist", "socket": "socket-steam", "trigger": "idle", "size": 10}])
