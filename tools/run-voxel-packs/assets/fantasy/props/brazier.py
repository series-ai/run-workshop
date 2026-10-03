"""Stone brazier in the Pirate Nation style.

A wide octagonal stone bowl (a frustum, true slopes) with a gold rim sits
on three splayed iron claw legs (true diagonals). Crossed logs, a bed of
glowing embers and three chunky flame tongues fill it; the fire PFX plays
on socket-fire above the flames. About 18 wide and 24 tall.
"""

import numpy as np

import paint as P
from _props import brace, coords, flame_tongue
from pnkit import box
from pnshapes import flat_ngon, last, radial
from voxgrid import C, Asset, Grid, Part, Socket

W, H = 20, 26
CX = CZ = 10.0
B0, B1 = 9, 14  # bowl bottom and rim


def build() -> Asset:
    g = Grid(W, H, W)
    X, Y, Z = coords(g)
    # three claw legs, splayed out from under the bowl
    for k, (dx, dz) in enumerate(((-1, -1), (1, -1), (0, 1))):
        if dz < 0:
            brace(g, "z", (CX + dx * 8.5, 1.4), (CX + dx * 3.5, B0 + 1), 2.2, CZ + dz * 5 - 1, CZ + dz * 5 + 1, "steel", 3)
        else:
            brace(g, "x", (1.4, CZ + 8.5), (B0 + 1, CZ + 3.5), 2.2, CX - 1, CX + 1, "steel", 3)
    for fx, fz in ((CX - 9.5, CZ - 6), (CX + 7.5, CZ - 6), (CX - 1, CZ + 7.5)):
        box(g, fx, 0, fz, fx + 2, 1, fz + 2, "gold", 4)  # claw toes
    # the bowl: a stone frustum with a gold rim and a stone foot
    g.prism("y", flat_ngon(CX, CZ, 4.5, 8), B0 - 3, B0, C("stone", 4), top=flat_ngon(CX, CZ, 5.0, 8))
    foot = last(g)
    g.prism("y", flat_ngon(CX, CZ, 5.0, 8), B0, B1, C("stone", 5), top=flat_ngon(CX, CZ, 8.0, 8))
    bowl = last(g)
    P.stone(g, bowl | foot, "stone", 5, block=(4, 3), seed=2)
    P.flat(g, bowl & (Y > B1 - 1.5), "gold", 5)
    P.flat(g, bowl & (Y > B1 - 1.5) & (radial(g, "y", CX, CZ) < 7.0), "red", 3)  # the hot inside of the rim
    # embers heaped in the bowl and two crossed logs
    emb = box(g, CX - 6, B1 - 1, CZ - 6, CX + 6, B1 + 1, CZ + 6, "orange", 5)
    emb &= radial(g, "y", CX, CZ) < 6.5
    P.flat(g, emb, "orange", 4)
    P.flat(g, emb & (P._hash(np.floor(X).astype(int), np.floor(Z).astype(int), seed=5) % np.uint64(5) == 0), "red", 4)
    P.flat(g, emb & (P._hash(np.floor(X).astype(int), np.floor(Z).astype(int), seed=6) % np.uint64(6) == 0), "gold", 6)
    for (x0, z0, x1, z1) in ((CX - 6, CZ - 1, CX + 5, CZ + 1), (CX - 1, CZ - 5, CX + 1, CZ + 6)):
        log = box(g, x0, B1 + 1, z0, x1, B1 + 3, z1, "darkwood", 4)
        P.flat(g, log & ((X < x0 + 1) | (X > x1 - 1) | (Z < z0 + 1) | (Z > z1 - 1)) & ((x1 - x0 > 3) & ((X < x0 + 1) | (X > x1 - 1)) | (z1 - z0 > 3) & ((Z < z0 + 1) | (Z > z1 - 1))), "wood", 6)
    flame_tongue(g, CX - 1, B1 + 2, CZ, 3.2, 9, lean=-0.8)
    flame_tongue(g, CX + 2.5, B1 + 2, CZ + 1.5, 2.4, 6, lean=1.0)
    flame_tongue(g, CX - 3, B1 + 2, CZ + 2.5, 2.0, 5, lean=-1.0)
    root = Part("brazier", g)
    return Asset(id="fantasy-props-brazier", pack="fantasy", category="props", name="Stone Brazier", root=root,
                 sockets=[Socket("socket-fire", at=(CX - 1, B1 + 7, CZ))],
                 pfx=[{"effectId": "rvx-fantasy-hearth-fire", "socket": "socket-fire", "trigger": "idle", "size": 16}])
