"""Blacksmith in the Pirate Nation style.

A sandstone ground floor with a jettied, half-timbered plaster storey under
a steep red tile roof (gable to the front, true slopes). An open forge
shed leans on its left side: thick dark posts, a red lean-to roof (one true
slope) and a glowing stone hearth under a tapering hood that feeds a tall,
leaning stone chimney. The oversized function prop is the giant anvil on a
stump in front of the forge (a true-slope silhouette with a pointed horn);
a crossed-hammers sign hangs over the door. A quench barrel, a sword rack,
round shields on the wall, a log pile and a coal heap finish it. Smoke
rises from the chimney and fire runes from the forge (PFX). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import arch_door, icon, icon_size, idx, log_pile, sandstone
from pnkit import barrel, beam, box, face_prism, gable_roof, posts, shutters, window
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 144, 124, 100
X0, X1, Z0, Z1 = 58, 108, 30, 80  # house walls; the front is z = Z0
GROUND, UPPER, WALL_TOP, RIDGE = 38, 42, 64, 100
J = 3
FX0 = 14  # forge shed left edge
CHX, CHZ = 30, 62  # chimney centre
CH_TOP = 112


def smithy() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = idx(g)
    # house: plinth, sandstone ground floor, dark beam, jettied timber storey, roof
    plinth = box(g, X0 - 2, 0, Z0 - 2, X1 + 2, 4, Z1 + 2, "sand", 3)
    sandstone(g, plinth, 3, block=(9, 4), honey=0.0, seed=1)
    ground = box(g, X0, 4, Z0, X1, GROUND, Z1, "sand", 4)
    sandstone(g, ground, 4, block=(8, 5), seed=2)
    posts(g, X0, X1, Z0, Z1, 4, GROUND, size=4, base=4, seed=3)
    beam(g, X0 - 3, GROUND, Z0 - 3, X1 + 3, UPPER, Z1 + 3, base=4, seed=4)
    ux0, ux1, uz0, uz1 = X0 - J, X1 + J, Z0 - J, Z1 + J
    upper = box(g, ux0, UPPER, uz0, ux1, WALL_TOP, uz1, "sand", 6)
    P.mottle(g, upper, "sand", 6, seed=5)
    studs = upper & (((X - ux0) % 14 < 3) | ((Z - uz0) % 14 < 3) | (Y >= WALL_TOP - 3))
    P.flat(g, studs, "darkwood", 4)
    posts(g, ux0, ux1, uz0, uz1, UPPER, WALL_TOP, size=4, out=1, base=4, seed=6)
    roof = gable_roof(g, ux0, ux1, uz0, uz1, WALL_TOP, RIDGE, ramp="red", thick=5, overhang=6, ridge="z", seed=7)
    gab = roof["attic"]
    P.flat(g, gab & (np.abs(X + 0.5 - (ux0 + ux1) / 2) < 1.6), "darkwood", 4)
    P.flat(g, gab & (Y >= WALL_TOP) & (Y < WALL_TOP + 3), "darkwood", 4)
    window(g, "-z", uz0, 78, 88, 72, 84, glow=6)
    # front: a wide arched door, a window with shutters, the hammer sign
    cx = (X0 + X1) // 2
    arch_door(g, "-z", Z0, cx - 9, cx + 9, 4, 32, frame=("sand", 5), seed=8)
    step = box(g, cx - 12, 0, Z0 - 8, cx + 12, 4, Z0 - 2, "sand", 3)
    P.stone(g, step, "sand", 3, block=(7, 4), frame="top", seed=9)
    window(g, "-z", Z0, X1 - 15, X1 - 5, 14, 28)
    for u0 in (ux0 + 6, ux1 - 20):
        window(g, "-z", uz0, u0, u0 + 14, 48, 60, glow=5)
        shutters(g, "-z", uz0, u0, u0 + 14, 48, 60, ramp="blue")
    for w0 in (Z0 + 10, Z1 - 22):
        window(g, "+x", X1, w0, w0 + 12, 14, 28)
        window(g, "+x", ux1, w0, w0 + 12, 48, 60, glow=5)
    # the crossed-hammers sign hangs from a bracket out of the front corner post (F6)
    sz = uz0 + 3
    box(g, ux1, 66, sz - 1, ux1 + 28, 69, sz + 2, "darkwood", 3)  # bracket
    g.prism("z", [(ux1, 58), (ux1, 66), (ux1 + 8, 66)], sz - 0.5, sz + 1.5, C("darkwood", 3))  # brace
    for cx2 in (ux1 + 6, ux1 + 24):
        box(g, cx2, 61, sz, cx2 + 1, 66, sz + 1, "iron", 4)  # chains
    sb = face_prism(g, "-z", sz, [(ux1 + 4, 61), (ux1 + 27, 61.8), (ux1 + 27, 38.8), (ux1 + 4, 38)], -1, 2, C("wood", 5))
    P.planks(g, sb, "wood", 5, width=3, across="y", nails=False, seed=10)
    P.outline(g, sb, "darkwood", 3, normal="z")
    iw, ih = icon_size("hammers", 2)
    icon(g, "-z", sz - 2, ux1 + 16 - iw // 2, 41, "hammers", "steel", 6, scale=2, inks={"-": ("wood", 3)})
    icon(g, "+z", sz + 1, ux1 + 16 - iw // 2, 41, "hammers", "steel", 6, scale=2, inks={"-": ("wood", 3)})
    # round shields on the house side wall facing the forge
    for sz, ramp in ((Z0 + 12, "blue"), (Z0 + 34, "red")):
        sh = S.disc(g, "x", 22, sz, 6, X0 - 2, X0, ramp, 4)
        rr = S.radial(g, "x", 22, sz)
        P.flat(g, sh & (rr > 4.6), "gold", 5)
        P.flat(g, sh & (rr < 1.8), "gold", 6)
    # --- the forge shed on the left
    back = box(g, FX0, 4, Z1 - 8, X0, 40, Z1, "sand", 4)  # back wall
    sandstone(g, back, 4, block=(8, 5), seed=11)
    fp = box(g, FX0 - 2, 0, Z0 - 6, X0, 4, Z1 + 2, "sand", 3)
    P.stone(g, fp, "sand", 3, block=(8, 5), frame="top", seed=12)
    pm = np.zeros(g.shape, dtype=bool)
    for px, pz in ((FX0, Z0 - 4), (FX0, Z1 - 12)):
        pm |= box(g, px, 4, pz, px + 4, 44, pz + 4, "darkwood", 4)
    P.planks(g, pm, "darkwood", 4, width=4, across="x", nails=False, seed=13)
    beam(g, FX0 - 2, 40, Z0 - 6, FX0 + 6, 44, Z1 + 2, base=4, seed=14)
    # lean-to roof: one true slope from the house wall down to the posts
    g.prism("z", [(X0, 62), (X0, 66), (FX0 - 8, 42), (FX0 - 8, 38)], Z0 - 9, Z1 + 3, C("red", 4))
    for m, fr in S.facets(g):
        P.tiles(g, m, "red", 4, row=4, width=5, frame=fr, seed=15)
    lean = g.solids[-1].mask(g.shape)
    P.flat(g, lean & ((Z < Z0 - 7) | (Z >= Z1 + 1)), "darkwood", 3)
    # the hearth: a stone block with glowing coals, a hood and a tall leaning chimney
    hx0, hx1, hz0, hz1 = CHX - 12, CHX + 12, CHZ - 10, Z1 - 8
    hearth = box(g, hx0, 4, hz0, hx1, 18, hz1, "stone", 5)
    P.stone(g, hearth, "stone", 5, block=(6, 4), seed=16)
    coals = box(g, hx0 + 3, 18, hz0 + 2, hx1 - 3, 20, hz1 - 1, "orange", 5)
    P.flat(g, coals & ((X + Z) % 3 == 0), "gold", 7)
    P.flat(g, coals & ((X * 3 + Z) % 5 == 0), "red", 5)
    mouth = hearth & (Z == hz0) & (Y >= 8) & (Y < 16) & (np.abs(X + 0.5 - CHX) < 6)
    P.flat(g, mouth, "orange", 6)
    P.flat(g, mouth & (Y >= 12), "gold", 7)
    g.prism("y", [(hx0 - 1, hz0 - 1), (hx1 + 1, hz0 - 1), (hx1 + 1, hz1), (hx0 - 1, hz1)], 30, 44, C("stone", 4),
            top=[(CHX - 6, CHZ - 5), (CHX + 6, CHZ - 5), (CHX + 6, CHZ + 7), (CHX - 6, CHZ + 7)])
    for m, fr in S.facets(g):
        P.stone(g, m, "stone", 4, block=(6, 4), frame=fr, seed=17)
    box(g, hx0 - 1, 18, hz0 - 1, hx0 + 2, 30, hz0 + 2, "darkwood", 3) | box(g, hx1 - 2, 18, hz0 - 1, hx1 + 1, 30, hz0 + 2, "darkwood", 3)
    g.prism("y", [(CHX - 6, CHZ - 5), (CHX + 6, CHZ - 5), (CHX + 6, CHZ + 7), (CHX - 6, CHZ + 7)], 44, CH_TOP, C("stone", 4),
            top=[(CHX - 3, CHZ - 3), (CHX + 7, CHZ - 3), (CHX + 7, CHZ + 7), (CHX - 3, CHZ + 7)])
    for m, fr in S.facets(g):
        P.stone(g, m, "stone", 4, block=(5, 3), frame=fr, seed=18)
    cap = box(g, CHX - 5, CH_TOP, CHZ - 5, CHX + 9, CH_TOP + 4, CHZ + 9, "stone", 3)
    P.stone(g, cap, "stone", 3, block=(7, 2), seed=19)
    box(g, CHX - 1, CH_TOP + 3, CHZ - 1, CHX + 5, CH_TOP + 4, CHZ + 5, "iron", 3)
    # the giant anvil on a stump (the function prop)
    ax, az = FX0 + 6, Z0 - 2
    S.disc(g, "y", ax + 14, az + 5, 7, 0, 10, "wood", 4)
    g.prism("z", [(ax + 3, 10), (ax + 21, 10), (ax + 18, 14), (ax + 18, 19), (ax + 23, 20), (ax + 32, 22.5), (ax + 23, 25),
                  (ax, 25), (ax, 21), (ax + 7, 19), (ax + 7, 14)], az + 1, az + 10, C("iron", 5))
    anvil = g.solids[-1].mask(g.shape)
    P.flat(g, anvil & (Y >= 24), "steel", 6)
    P.flat(g, anvil & (Y < 12), "iron", 4)
    # the quench barrel, a sword rack, logs and a coal heap
    barrel(g, FX0 + 40, Z0 - 8, 0, 13, 5.5, ramp="wood", hoop="iron")
    P.flat(g, box(g, FX0 + 36, 13, Z0 - 12, FX0 + 45, 14, Z0 - 3, "sky", 5), "sky", 5)
    rack = box(g, X1 + 3, 0, Z0 + 4, X1 + 6, 22, Z0 + 6, "darkwood", 3) | box(g, X1 + 3, 0, Z0 + 26, X1 + 6, 22, Z0 + 28, "darkwood", 3)
    rack |= box(g, X1 + 3, 18, Z0 + 4, X1 + 6, 20, Z0 + 28, "darkwood", 3)
    for k, sz in enumerate(range(Z0 + 8, Z0 + 26, 5)):
        g.prism("z", [(X1 + 6, 3), (X1 + 8, 3), (X1 + 9 + k % 2, 24), (X1 + 7 + k % 2, 24)], sz, sz + 2, C("steel", 6))
        box(g, X1 + 5, 16, sz - 1, X1 + 10, 18, sz + 3, "gold", 4)
    log_pile(g, FX0 - 2, Z1 + 4, 0, length=22, rows=(3, 2))
    g.prism("y", [(FX0 + 2, Z0 + 20), (FX0 + 14, Z0 + 20), (FX0 + 14, Z0 + 32), (FX0 + 2, Z0 + 32)], 4, 10, C("iron", 3), top=[(FX0 + 8, Z0 + 26)] * 4)
    P.flat(g, g.solids[-1].mask(g.shape) & ((X + Y + Z) % 4 == 0), "iron", 5)
    P.grime(g, (g.a > 0) & (Y < 12) & ~g.solid_mask(), height=4, seed=20)
    return g


def build() -> Asset:
    g = smithy()
    return Asset(
        id="fantasy-buildings-blacksmith", pack="fantasy", category="buildings", name="Blacksmith", root=Part("blacksmith", g),
        sockets=[Socket("socket-chimney", at=(CHX + 1, CH_TOP + 4, CHZ + 2)), Socket("socket-forge", at=(CHX, 20, (CHZ - 10 + Z1 - 8) / 2))],
        pfx=[{"effectId": "rvx-fantasy-chimney-smoke", "socket": "socket-chimney", "trigger": "idle", "size": 32}, {"effectId": "rvx-fantasy-hearth-fire", "socket": "socket-forge", "trigger": "idle", "size": 34}],
    )
