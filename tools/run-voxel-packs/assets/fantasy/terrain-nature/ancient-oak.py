"""Ancient autumn oak in the Pirate Nation style.

PN trees are clumps of big leaf blocks on a curved faceted trunk. Here: a
thick gnarled trunk on a flared root foot with five sloped roots, a painted
knot-hole, four heavy limbs (sheared frustums: true slopes) and a broad
crown of nine chamfered leaf blocks in autumn orange, gold and red. A rope
swing hangs from the long right limb (the one oversized story prop, F4).
Leaf litter lies on the grass patch at the foot.

About 76 wide and 78 tall (tree class, height 30-100): it stands over a
person like a two-storey house. The crown sways gently on `idle`. Faces -Z.
"""
import math

import numpy as np

import paint as P
from _life import asset, coords, leaf_block, ngon, plan, rig, trunk
from pnkit import box
from voxgrid import Clip, Grid, bob

S = (84, 82, 74)
CX, CZ = 40.0, 37.0
TOP = 36.0  # trunk top: the crown pivot

# crown blocks: (dx, cy, dz, sx, sy, sz, ramp, base, lean)
BLOCKS = [
    (1, 66, 0, 30, 17, 28, "orange", 4, (1.0, 0.0)),
    (-19, 56, 3, 26, 15, 24, "ember", 4, (-1.0, 0.5)),
    (22, 55, -3, 26, 15, 24, "red", 5, (1.2, -0.5)),
    (-4, 52, -18, 24, 14, 18, "orange", 5, (0.0, -1.0)),
    (6, 55, 18, 24, 15, 18, "gold", 4, (0.5, 1.0)),
    (-11, 71, 7, 20, 13, 20, "red", 5, (-0.8, 0.5)),
    (14, 72, -6, 18, 12, 18, "ember", 4, (0.8, -0.4)),
    (-27, 46, -10, 14, 10, 14, "orange", 4, (-0.6, -0.4)),
    (28, 45, -6, 15, 11, 13, "ember", 4, (0.6, -0.4)),
]

SWING_A = (CX + 3.0, 29.0, CZ - 7.0)   # the swing limb leaves the trunk here
SWING_B = (CX + 27.0, 44.0, CZ - 7.0)  # and ends inside the low right leaf block
ROPES = (CX + 17.0, CX + 23.0)
SEAT_Y = 11


def limb_y(x: float) -> tuple[float, float]:
    """(y, z) of the swing limb axis at x."""
    t = (x - SWING_A[0]) / (SWING_B[0] - SWING_A[0])
    return SWING_A[1] + t * (SWING_B[1] - SWING_A[1]), SWING_A[2] + t * (SWING_B[2] - SWING_A[2])


def tree() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Zi = np.floor(X).astype(int), np.floor(Z).astype(int)
    # grass patch with autumn leaf litter (cells of 2, no speckle)
    turf = plan(g, ngon(CX, CZ, 21, 11, 0.2, [1.0, 0.9, 1.05, 0.95, 1.1, 0.9, 1.0, 1.08, 0.92, 1.0, 1.05]), 0, 2, "leaf", 4,
                top=ngon(CX, CZ, 19, 11, 0.2, [1.0, 0.9, 1.05, 0.95, 1.1, 0.9, 1.0, 1.08, 0.92, 1.0, 1.05]))
    P.flat(g, turf & (Y < 1), "moss", 4)
    cell = P._hash(Xi // 2, Zi // 2, seed=31) % np.uint64(9)
    top = turf & (Y > 1)
    P.flat(g, top & (cell == 1), "leaf", 5)
    P.flat(g, top & (cell == 2), "orange", 5)
    P.flat(g, top & (cell == 3), "gold", 6)
    P.flat(g, top & (cell == 4), "red", 5)
    # the trunk: a flared foot, a gnarled bend and a thick top (7-sided frustums)
    trunk(g, [(CX, 1, CZ), (CX + 0.5, 6, CZ), (CX - 1.5, 17, CZ + 0.5), (CX + 0.5, 28, CZ - 0.5), (CX + 1.5, TOP + 2, CZ)],
          [12.0, 7.8, 6.6, 6.2, 6.8], ramp="wood", base=3, n=7, turn=0.2, seed=2)
    # roots: sloped frustums that rise from the grass into the foot
    for k, (ang, reach, r0) in enumerate(((0.3, 17, 2.4), (1.6, 15, 2.2), (2.7, 18, 2.6), (3.9, 15, 2.0), (5.1, 17, 2.4))):
        ex, ez = CX + reach * math.cos(ang), CZ + reach * math.sin(ang)
        mx, mz = CX + 7 * math.cos(ang), CZ + 7 * math.sin(ang)
        trunk(g, [(ex, 2, ez), (mx, 7, mz)], [r0, 4.2], ramp="wood", base=3, n=5, turn=ang, seed=10 + k)
    # heavy limbs into the crown blocks
    for k, (dx, y1, dz, r1) in enumerate(((-17, 52, 3, 2.6), (-5, 49, -15, 2.4), (5, 51, 15, 2.4), (-8, 62, 4, 2.4), (10, 63, -4, 2.4))):
        mx, mz = CX + 1.5 + dx * 0.45, CZ + dz * 0.45
        trunk(g, [(CX + 1.5 + dx * 0.1, TOP - 2, CZ + dz * 0.1), (mx, (TOP + y1) / 2, mz), (CX + dx, y1, CZ + dz)],
              [4.6, 3.4, r1], ramp="wood", base=3, n=5, turn=0.4 * k, seed=20 + k)
    # the long swing limb (a low sloped frustum)
    trunk(g, [SWING_A, SWING_B], [4.4, 3.0], ramp="wood", base=3, n=5, turn=0.3, seed=30)
    # the knot-hole on the front of the trunk (painted: a dark oval with a lit rim)
    kx, ky, kz = CX - 1.5, 15.0, CZ - 6.6
    front = (Z < CZ - 3) & (Y > 5) & (Y < 26)
    d = ((X - kx) / 2.6) ** 2 + ((Y - ky) / 3.6) ** 2
    wood = g.a > 0
    P.flat(g, wood & front & (d < 1.9) & (Z < kz + 3), "wood", 6)
    P.flat(g, wood & front & (d < 1.0) & (Z < kz + 3), "darkwood", 1)
    # the swing: two ropes and a planked seat
    for rx in ROPES:
        ly, lz = limb_y(rx)
        box(g, int(rx), SEAT_Y + 1, int(lz) - 1, int(rx) + 1, int(ly), int(lz), "sand", 5)
    ly, lz = limb_y(ROPES[0])
    seat = box(g, int(ROPES[0]) - 2, SEAT_Y - 1, int(lz) - 3, int(ROPES[1]) + 3, SEAT_Y + 1, int(lz) + 2, "wood", 5)
    P.planks(g, seat, "wood", 5, width=3, across="x", length=(12, 14), seed=40)
    P.flat(g, seat & (Y < SEAT_Y), "wood", 3)
    return g


def crown() -> Grid:
    g = Grid(*S)
    for k, (dx, cy, dz, sx, sy, sz, ramp, base, lean) in enumerate(BLOCKS):
        leaf_block(g, CX + dx, cy, CZ + dz, sx, sy, sz, ramp, base, bevel=3.0, lean=lean, seed=50 + k)
    return g


def build():
    root, _to_root = rig([("ancient-oak", tree(), None, None), ("crown", crown(), (CX + 1.5, TOP, CZ), None)])
    sway = {"crown": {"rot": [(t, (a, 0.0, b)) for (t, (a, _, _)), (_, (_, _, b)) in zip(bob(5.0, "x", 1.5, math.pi / 2), bob(5.0, "z", 2.2))]}}
    return asset("terrain-nature", "ancient-oak", "Ancient Autumn Oak", root, clips=[Clip("idle", sway)])
