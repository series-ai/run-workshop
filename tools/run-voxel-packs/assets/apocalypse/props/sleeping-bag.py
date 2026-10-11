"""Survivor's bedroll, in the Pirate Nation style.

A person-size campsite icon (rules F1, K3). The bag is three true-sloped
volumes that taper from chest to foot (rule F2), so it reads as bedding and
never as a cargo crate: every side slopes, the crown is lit, the seams are
three deliberate lines and the mouth is open, showing a signal-red lining
under a turned-down collar that wraps right round the head (rule C3). A
rolled jacket lies across the head, its end face painted as a spiral of
rolled cloth. A hazard-yellow torch, a zombie-teal canteen and a steel mug
are set out on the free side of the pallet, all inside its boards, so the
prop carries no loose piece of ground beside it. Plank grain, baffles,
patches and the spiral are paint (rule S1).
"""
import numpy as np

import paint as P
from _props import asset, chips, pallet, pillow, root
from pnkit import box, edges
from pnshapes import coords, disc
from voxgrid import Grid

GW, GH, GD = 42, 20, 22
PX0, PZ0, PW, PD = 2, 3, 36, 16  # the pallet
CZ = 9.0  # the bag runs down the middle of the pallet
Y0 = 4


def seams(g: Grid, m: np.ndarray, base: int = 5) -> None:
    """Quilting: a lit crown, a shaded foot and three deliberate baffle
    seams. No modulo stripe runs over the whole bag (rule S3)."""
    X, Y, Z = coords(g)
    ys = np.nonzero(m.any(axis=(0, 2)))[0]
    hi = int(ys.max())
    P.flat(g, m, "moss", base)
    P.flat(g, m & (Y > hi - 1.5), "moss", min(7, base + 1))  # the lit crown
    P.flat(g, m & (Y < Y0 + 1.5), "moss", max(1, base - 2))  # the shaded foot
    for sx in (13, 20, 27):  # three baffle seams across the bag
        P.flat(g, m & (np.abs(X - sx) < 0.7), "moss", max(1, base - 2))
    P.flat(g, m & (np.abs(Z - CZ) < 0.6), "moss", max(1, base - 1))  # the centre seam


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    pallet(g, PX0, 0, PZ0, w=PW, d=PD, ramp="wood", base=5, seed=2)
    # the bag: three sloped volumes stepping down and in towards the foot
    bag = pillow(g, 15.0, CZ, Y0, 22, 11, 7, ramp="moss", base=5, puff=1.6)
    bag |= pillow(g, 28.0, CZ, Y0, 8, 9, 5, ramp="moss", base=5, puff=1.4)
    bag |= pillow(g, 34.0, CZ, Y0, 7, 7, 4, ramp="moss", base=5, puff=1.6)
    seams(g, bag, 5)
    # stitched sand patches, the mark of a mended bag
    for px, pz, pw, pd in ((11, int(CZ) - 4, 5, 4), (22, int(CZ) + 1, 4, 4), (29, int(CZ) - 3, 4, 3)):
        patch = bag & (X >= px) & (X < px + pw) & (Z >= pz) & (Z < pz + pd) & (Y > Y0 + 3)
        P.flat(g, patch, "sand", 5)
        P.outline(g, patch, "sand", 3, normal="y")
    # the open mouth at the head, showing the red lining inside
    mouth = bag & (X < 9) & (Y > Y0 + 2)
    P.flat(g, mouth, "darkwood", 2)
    P.flat(g, mouth & (X > 6) & (Y < Y0 + 6), "red", 4)
    # the collar, turned down and wrapped right round the head
    collar = pillow(g, 7.5, CZ, Y0 + 6, 7, 12, 4, ramp="red", base=4, puff=1.2)
    P.flat(g, collar, "red", 4)
    P.flat(g, collar & (Y > Y0 + 8), "red", 5)  # its lit fold
    P.flat(g, collar & (np.abs(Z - CZ) < 0.6), "red", 3)
    P.flat(g, collar & (X < 5.5), "red", 2)  # the shadow under the turn
    # the rolled jacket across the head, its ends painted as rolled cloth
    roll = disc(g, "z", 6.5, float(Y0 + 9), 3.0, int(CZ) - 6, int(CZ) + 7, "sand", 5)
    rr = np.hypot(X - 6.5, Y - (Y0 + 9))
    P.flat(g, roll, "sand", 5)
    P.flat(g, roll & (Y > Y0 + 10), "sand", 6)
    for k, (r0, r1) in enumerate(((2.0, 3.0), (1.1, 2.0), (0.0, 1.1))):  # the spiral of rolled layers
        P.flat(g, roll & (rr >= r0) & (rr < r1) & ((Z < CZ - 5) | (Z > CZ + 5)), "sand", 6 - 2 * (k % 2))
    P.flat(g, roll & (Z < CZ - 5) & (rr > 2.6), "khaki", 4)  # the folded sleeve on the end
    chips(g, roll, ((6, Y0 + 9, int(CZ) + 3, 2.2),), "rust", 4, seed=6)
    # the kit, laid out on the free side of the pallet and inside its boards
    torch = box(g, 13, 4, int(CZ) + 6, 22, 8, int(CZ) + 10, "gold", 4)
    P.flat(g, torch, "gold", 4)
    P.flat(g, torch & (Y > 7), "gold", 5)
    P.flat(g, edges(torch), "darkwood", 2)
    lens = box(g, 22, 4, int(CZ) + 5, 25, 9, int(CZ) + 11, "steel", 5)
    P.flat(g, lens, "steel", 5)
    P.flat(g, lens & (X > 24), "bone", 7)
    P.flat(g, edges(lens), "steel", 2)
    can = box(g, 27, 4, int(CZ) + 6, 32, 10, int(CZ) + 10, "teal", 3)
    P.flat(g, can, "teal", 3)
    P.flat(g, can & (Y > 9), "teal", 4)
    P.flat(g, can & (np.abs(Y - 7) < 0.6), "teal", 1)  # its strap
    P.flat(g, edges(can), "teal", 1)
    box(g, 29, 10, int(CZ) + 7, 31, 12, int(CZ) + 9, "steel", 5)  # its cap
    mug = disc(g, "y", 10.0, float(CZ) + 8.0, 2.2, 4, 8, "steel", 5)
    P.flat(g, mug, "steel", 5)
    P.flat(g, mug & (Y > 6.5), "steel", 3)
    P.flat(g, mug & (Y < 5), "steel", 6)
    box(g, 12, 5, int(CZ) + 7, 14, 7, int(CZ) + 9, "steel", 4)  # its handle
    P.grime(g, bag, height=2, seed=9)
    return asset("sleeping-bag", "Survivor Bedroll", root("sleeping-bag", g))
