"""Rain catcher barrel, in the Pirate Nation style.

One chunky icon (rule K3): a dusty zombie-teal drum on a weathered pallet,
banded with two heavy hoops that bleed rust down the staves. A bolted
repair patch sits between the hoops with its own rivet frame; an oversized
brass tap and a steel pail carry the function (rule F4), and a bone sight
tube on the side shows the water level. The filler cap stands on the lid
with a knurled rim, a little off centre (rule F5). Staves, rivets, drips,
chipped paint and the drop stencil are paint (rule S1).
"""
import numpy as np

import paint as P
import pnpaint
from _props import asset, chips, pallet, root, weeds
from pnkit import box, edges
from pnshapes import bar, coords, disc, drum
from voxgrid import Grid

# Real scale: the drum matches the pack oil drum (19 high, 17 wide), so
# the barrel is 18 wide and about 23 high with its pallet (class container).
GW, GH, GD = 28, 26, 32
CX, CZ, R = 14.0, 18.0, 9.0
Y0, H = 4, 17  # the drum sits on the pallet


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    pallet(g, 4, 0, 8, w=20, d=20, ramp="wood", base=5, seed=1)
    weeds(g, 25, 11, seed=2)
    body = drum(g, CX, CZ, Y0, H, R, ramp="teal", base=4, n=12, hoop="steel", band=("teal", 3), icon=None, wear=True, seed=3)
    d = np.hypot(X - CX, Z - CZ)
    # staves and a lit crown, so the barrel is never one flat colour
    P.flat(g, body & (np.floor(np.arctan2(Z - CZ, X - CX) * 6) % 2 == 0) & (d > R - 2), "teal", 5)
    P.flat(g, body & (Y > Y0 + H - 2), "teal", 5)
    P.flat(g, body & (Y < Y0 + 2), "teal", 2)
    # rust bleeding from both hoops, and chipped paint on the shoulders
    for hy in (Y0 + 3, Y0 + 12):
        hoop = body & (Y > hy) & (Y < hy + 3)
        P.flat(g, hoop, "steel", 4)
        P.flat(g, hoop & (np.floor(np.arctan2(Z - CZ, X - CX) * 4) % 2 == 0), "steel", 6)
        streak = body & (Y > hy - 3) & (Y < hy) & ((np.floor(X + Z) % 5) == 0)
        P.flat(g, streak, "rust", 4)
    chips(g, body, ((CX - R, Y0 + 8, CZ + 3, 3.0), (CX + 4, Y0 + 15, CZ - R, 2.6), (CX - 4, Y0 + 2, CZ - R, 2.4)), "rust", 5, seed=4)
    P.grime(g, body, height=3, seed=5)
    # a painted drop stencil on the front facet, between the hoops
    stencil = body & (Z < CZ - R + 2.0) & (np.abs(X - (CX + 4)) < 2.2) & (Y > Y0 + 6) & (Y < Y0 + 12)
    P.flat(g, stencil, "bone", 7)
    P.flat(g, stencil & (Y > Y0 + 10) & (np.abs(X - (CX + 4)) > 1.0), "teal", 4)
    P.flat(g, stencil & (Y < Y0 + 7.5) & (np.abs(X - (CX + 4)) > 1.6), "teal", 4)
    # the bolted repair patch, seated between the two hoops
    patch = body & (Z < CZ - R + 2.5) & (X > CX - 6) & (X < CX + 0.5) & (Y > Y0 + 6) & (Y < Y0 + 12)
    P.flat(g, patch, "steel", 5)
    P.plates(g, patch, "steel", 5, size=(4, 4), seed=6, frame="z")
    P.outline(g, patch, "steel", 2, normal="z")
    # the bone sight tube on the +x flank, with the water column in it
    tube = box(g, int(CX + R) - 2, Y0 + 4, int(CZ) - 2, int(CX + R) + 1, Y0 + H - 3, int(CZ) + 2, "bone", 7)
    P.flat(g, tube & (Y < Y0 + 10), "teal", 5)
    P.flat(g, tube & (Y > Y0 + 9) & (Y < Y0 + 11), "teal", 6)
    P.flat(g, tube & (np.floor(Y) % 3 == 0), "bone", 5)
    P.outline(g, tube, "steel", 3, normal="x")
    for by in (Y0 + 3, Y0 + H - 4):
        box(g, int(CX + R) - 3, by, int(CZ) - 3, int(CX + R) + 2, by + 2, int(CZ) + 3, "steel", 5)
    # the oversized brass tap and the pail under it
    spout = box(g, int(CX) - 2, Y0 + 2, int(CZ - R) - 3, int(CX) + 2, Y0 + 5, int(CZ - R) + 2, "gold", 5)
    P.flat(g, spout & (np.floor(Y) % 2 == 0), "gold", 4)
    P.flat(g, edges(spout), "darkwood", 3)
    handle = bar(g, "z", (CX - 3.0, float(Y0 + 7)), (CX + 3.0, float(Y0 + 7)), 1.3, int(CZ - R) - 3, int(CZ - R) - 1, "gold", 6)
    P.flat(g, handle & (np.floor(X) % 3 == 0), "gold", 4)
    box(g, int(CX) - 1, Y0 + 5, int(CZ - R) - 3, int(CX) + 1, Y0 + 7, int(CZ - R) - 1, "gold", 5)
    pail = disc(g, "y", CX, CZ - R - 4.8, 3.4, 0, 6, "steel", 5, n=10)
    P.flat(g, pail & (np.floor(Y) % 3 == 0), "steel", 4)
    P.flat(g, pail & (Y > 5), "steel", 3)
    P.flat(g, pail & (Y > 4) & (np.hypot(X - CX, Z - (CZ - R - 4.8)) < 2.2), "teal", 5)
    chips(g, pail, ((CX - 3, 2, CZ - R - 5, 2.0),), "rust", 4, seed=7)
    # the filler cap, a little off centre on the lid
    cap = disc(g, "y", CX + 2.0, CZ - 1.0, 2.8, Y0 + H, Y0 + H + 2, "steel", 5, n=8)
    P.flat(g, cap & (np.floor(np.arctan2(Z - CZ + 1, X - CX - 2) * 5) % 2 == 0), "steel", 3)
    P.flat(g, cap & (Y > Y0 + H + 0.9), "steel", 6)
    P.outline(g, cap, "steel", 2, normal="y")
    return asset("rain-barrel", "Rain Barrel", root("rain-barrel", g))
