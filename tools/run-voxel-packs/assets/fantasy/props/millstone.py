"""Edge-runner millstone in the Pirate Nation style.

A round timber bed with a kerb carries a central post. A horizontal axle
runs out of the post to a great grey-blue runner stone that stands on edge
in the bed (rule F4), and a sweep arm with a turned grip reaches out the
other way, so the machine reads at once. A planked hopper hangs from the
arm over the bed. The stone face carries a chunky dressing pattern: a dark
tread rim, eight radial furrows and a gold hub (rules S1–S3). A clean
flour mound, a sack and a scoop sit inside the kerb. About 36 across and
36 tall.
"""

import math

import numpy as np

import paint as P
from _props import coords
from pnkit import box, edges
from pnshapes import corner, disc, facets, last, quad, radial
from voxgrid import C, Asset, Grid, Part

W, H, D = 36, 38, 36
CX, CZ = 18, 18
BED = 6  # the top of the timber bed
KERB = 14.0  # the inner radius of the kerb ring
RW = 9.0  # the runner stone's flat radius
WX0, WX1 = 20, 28  # the runner stone's width along x
WCX = (WX0 + WX1) / 2
WY = BED + RW  # the runner stone's centre height
POST = 28  # the post top


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))
    d = np.hypot(X - CX, Z - CZ)

    # the timber bed: planked sides with a dark frame, a stone floor and a kerb
    curb = disc(g, "y", CX, CZ, 16.0, 0, BED, "wood", 5, n=8)
    P.planks(g, curb, "wood", 5, width=3, across="y", frame="wall", nails=True, seed=1)
    P.flat(g, curb & (Yi < 1), "darkwood", 3)
    P.flat(g, curb & (Yi == BED - 1) & (d > 15.0), "darkwood", 3)
    for k in range(8):  # iron straps round the bed
        a = k * 0.785
        P.flat(g, curb & (np.abs((X - CX) * np.sin(a) - (Z - CZ) * np.cos(a)) < 1.0) & (d > 13.0), "iron", 4)
    floor = curb & (Yi >= BED - 2) & (d < KERB)
    P.stone(g, floor, "stone", 4, block=(5, 4), frame="top", seed=2)
    kerb = np.zeros(g.shape, bool)  # eight chord walls: a true-faceted ring, never a carved disc
    kr = corner(14.8, 8)
    for k in range(8):
        a0 = -math.pi / 2 + math.pi / 8 + 2 * math.pi * k / 8
        a1 = a0 + 2 * math.pi / 8
        p0 = (CX + kr * math.cos(a0), CZ + kr * math.sin(a0))
        p1 = (CX + kr * math.cos(a1), CZ + kr * math.sin(a1))
        g.prism("y", quad(p0, p1, 1.2), BED, BED + 3, C("wood", 5))
        kerb |= last(g)
    P.planks(g, kerb, "wood", 5, width=2, across="y", frame="wall", nails=True, seed=3)
    P.flat(g, kerb & (Yi == BED + 2), "wood", 6)
    P.flat(g, kerb & ((d > 15.0) | (Yi == BED)), "darkwood", 3)

    # the runner stone, standing on the bed floor
    stone = disc(g, "x", WY, CZ, RW, WX0, WX1, "stone", 4, n=12)
    rr = radial(g, "x", WY, CZ)
    P.flat(g, stone, "stone", 4)
    P.flat(g, stone & (rr > RW - 1.6), "stone", 2)  # the dark worn tread
    P.flat(g, stone & (rr > RW - 3.0) & (rr <= RW - 1.6), "stone", 5)  # the lit shoulder
    for k in range(8):  # eight chunky dressing furrows
        a = k * 0.785 + 0.2
        P.flat(g, stone & (np.abs((Y - WY) * np.sin(a) - (Z - CZ) * np.cos(a)) < 1.0)
               & (rr > 3.6) & (rr < RW - 1.8), "stone", 2)
    P.flat(g, stone & (Xi >= WX1 - 1), "stone", 5)  # the lit near face
    hub = disc(g, "x", WY, CZ, 3.2, WX0 - 2, WX1 + 2, "gold", 5, n=8)
    P.flat(g, hub, "gold", 5)
    P.flat(g, hub & ((Xi < WX0) | (Xi >= WX1)), "gold", 6)
    P.flat(g, hub & (radial(g, "x", WY, CZ) < 1.4), "darkwood", 3)

    # the central post, the axle out to the hub and the sweep arm with a grip
    post = box(g, 13, BED - 2, 15, 19, POST, 21, "wood", 4)
    P.planks(g, post, "wood", 4, width=3, across="x", nails=False, seed=4)
    P.flat(g, edges(post), "darkwood", 3)
    for by in (BED + 4, POST - 6):
        P.flat(g, post & (Yi >= by) & (Yi < by + 2), "iron", 4)
        P.flat(g, post & (Yi == by + 1), "iron", 5)
    axle = box(g, 17, WY - 2, CZ - 2, WX0 + 3, WY + 2, CZ + 2, "darkwood", 4)
    P.flat(g, axle, "darkwood", 4)
    P.flat(g, axle & (Yi == WY + 1), "darkwood", 5)
    P.flat(g, edges(axle), "darkwood", 2)
    collar = box(g, WX0 - 2, WY - 3, CZ - 3, WX0, WY + 3, CZ + 3, "iron", 4)
    P.flat(g, collar, "iron", 4)
    P.flat(g, collar & (Yi > WY), "iron", 5)
    arm = box(g, 4, POST, 15, 22, POST + 3, 21, "wood", 5)
    P.planks(g, arm, "wood", 5, width=2, across="y", frame="wall", nails=True, seed=5)
    P.flat(g, arm & (Yi == POST + 2), "wood", 6)
    P.flat(g, edges(arm), "darkwood", 3)
    grip = box(g, 5, POST + 3, 16, 8, POST + 9, 20, "darkwood", 4)
    P.planks(g, grip, "darkwood", 4, width=2, across="x", nails=False, seed=6)
    P.flat(g, grip & (Yi > POST + 7), "wood", 5)
    P.flat(g, edges(grip), "darkwood", 2)

    # the planked hopper: a square timber box that narrows to a chute
    hw, hs = 5.0, 1.8
    g.prism("y", [(10 - hs, CZ - hs), (10 + hs, CZ - hs), (10 + hs, CZ + hs), (10 - hs, CZ + hs)],
            BED + 12, POST, C("wood", 6),
            top=[(10 - hw, CZ - hw), (10 + hw, CZ - hw), (10 + hw, CZ + hw), (10 - hw, CZ + hw)])
    hop = last(g)
    for m, fr in facets(g, g.solids[-1:]):
        P.planks(g, m, "wood", 6, width=3, across="y", frame=fr, nails=True, seed=7)
    P.flat(g, hop & (Yi > POST - 2), "darkwood", 3)  # the dark head band
    P.flat(g, hop & (Yi < BED + 14), "darkwood", 3)  # the chute mouth
    P.flat(g, hop & (Yi == POST - 3), "wood", 7)  # a lit band round the box
    P.flat(g, hop & (Yi == POST - 1) & (np.abs(X - 10) < 3.4) & (np.abs(Z - CZ) < 3.4), "gold", 5)
    for hx in (10 - 5, 10 + 4):  # two short hangers up to the sweep arm
        hang = box(g, hx, POST, CZ - 1, hx + 1, POST + 3, CZ + 1, "iron", 4)
        P.flat(g, hang, "iron", 4)

    # a red cloth tied to the post, one clean flour mound, a sack and a scoop
    P.flat(g, post & (Yi > POST - 12) & (Yi < POST - 8), "red", 5)
    P.flat(g, post & (Yi > POST - 12) & (Yi < POST - 8) & ((Yi % 2) == 0), "red", 6)
    P.flat(g, floor & (d > 7.0) & (d < 12.0), "bone", 6)  # a smooth skim of fresh flour
    P.flat(g, floor & (d > 8.5) & (d < 10.5), "bone", 7)
    mound = disc(g, "y", 12, 22, 3.6, BED, BED + 2, "bone", 7, n=8)
    mound |= disc(g, "y", 12, 22, 2.2, BED + 2, BED + 4, "bone", 7, n=6)
    md = np.hypot(X - 12, Z - 22)
    P.flat(g, mound, "bone", 7)
    P.flat(g, mound & (md > 2.6) & (Yi < BED + 2), "bone", 6)
    P.flat(g, mound & (Yi == BED), "bone", 5)
    sk = disc(g, "y", 11, 13, 4.2, BED, BED + 5, "sand", 6, n=8)  # a squat tied sack, not a jug
    sk |= disc(g, "y", 11, 13, 2.8, BED + 5, BED + 7, "sand", 6, n=8)
    P.flat(g, sk, "sand", 6)
    P.flat(g, sk & (Yi > BED + 3) & (Yi < BED + 5), "sand", 7)
    P.flat(g, sk & (Yi < BED + 1), "sand", 4)
    P.flat(g, sk & (Yi == BED + 5), "darkwood", 4)  # the cord tie
    P.flat(g, sk & (Yi == BED + 6), "sand", 7)
    P.flat(g, sk & (np.abs(X - 11) < 1.6) & (Z < 11) & (Yi > BED + 1) & (Yi < BED + 4), "darkwood", 4)
    scoop = disc(g, "y", 14, 27, 2.6, BED, BED + 3, "wood", 6, n=6)
    P.flat(g, scoop, "wood", 6)
    P.flat(g, scoop & (Yi > BED + 1) & (np.hypot(X - 14, Z - 27) < 1.8), "bone", 7)
    P.flat(g, edges(scoop), "darkwood", 3)
    sh = box(g, 14, BED, 23, 16, BED + 2, 25, "wood", 5)
    P.flat(g, sh, "wood", 5)

    root = Part("millstone", g)
    return Asset(id="fantasy-props-millstone", pack="fantasy", category="props", name="Millstone", root=root)
