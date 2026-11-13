"""Collapsed apartment block, in the Pirate Nation style.

A chunky three-storey block of warm tan brick with pale floor bands and a
steep red tiled gable (true slopes), whose right end has sheared off: the
cut face shows the painted rooms inside (pink and teal wallpaper, a door,
a picture), broken floor slabs jut out at an angle, rebar dangles, and a
big rubble slope (true slopes) spills to the ground. The function prop is
oversized (rules F4, K1): a huge SOS sheet hangs from the top balcony.
Balconies with laundry, AC boxes, a striped entrance canopy and a leaning
TV aerial give it life (F5). Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint
import pnshapes as S
from _bld import bloom, crate, label, slab
from pnkit import awning, box, door, edges, window
from voxgrid import C, Asset, Grid, Part, bounds_pivot

W, H, D = 136, 148, 92
X0, XB, X1, Z0, Z1 = 14, 84, 112, 26, 70  # XB: where the block breaks
G, ST = 3, 30  # ground, storey height
EAVE = G + 3 * ST  # 99
RIDGE = 120


def block() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = S._idx(g)
    slab(g, 4, 6, 132, 88, h=G, ramp="sand", base=5, seed=1)

    # ---- the intact part: three storeys of tan brick with pale floor bands
    walls = box(g, X0, G, Z0, XB, EAVE, Z1, "sand", 5)
    P.stone(g, walls, "sand", 5, block=(6, 3), mortar=-1, cracks=0.02, seed=2)
    # the broken part: the ground storey only
    low = box(g, XB, G, Z0, X1, G + ST, Z1, "sand", 5)
    P.stone(g, low, "sand", 5, block=(6, 3), mortar=-1, cracks=0.02, seed=2)
    for k in range(1, 4):
        y = G + k * ST
        b = box(g, X0 - 1, y - 3, Z0 - 1, (XB if k > 1 else X1) + (0 if k > 1 else 1), y, Z1 + 1, "bone", 6)
        P.flat(g, b & (Y == y - 3), "bone", 4)
    plinth = box(g, X0 - 1, G, Z0 - 1, X1 + 1, G + 5, Z1 + 1, "stone", 5)
    P.stone(g, plinth, "stone", 5, block=(8, 5), seed=3)
    for qx in (X0 - 2, XB - 3):
        q = box(g, qx, G + 5, Z0 - 2, qx + 5, EAVE - 3, Z0 + 3, "rust", 5)
        P.stone(g, q, "rust", 5, block=(5, 4), seed=4)
    bloom(g, walls | low, 7, ((X0, G, Z0), (X1, EAVE, Z1)), r=(3.0, 6.0), ramp="sand", shades=(4, 4), seed=5)

    # ---- roof: a steep red tiled gable over the intact part
    from _bld import gable
    roof = gable(g, X0 - 1, XB + 1, Z0 - 1, Z1 + 1, EAVE + 1, RIDGE, ridge="x", thick=4, overhang=5, roof=("red", 5), style="tiles",
                 attic=("sand", 5), attic_style="brick", seed=6)
    bloom(g, roof["slabs"] & ~roof["trim"], 3, ((X0, EAVE, Z0), (XB, RIDGE, Z1)), r=(3.0, 5.0), ramp="red", shades=(4, 3), seed=7)
    # a leaning TV aerial (rule F5)
    S.bar(g, "z", (30, RIDGE + 2), (26, RIDGE + 24), 2, 46, 48, "steel", 4)
    for ay in (RIDGE + 14, RIDGE + 20):
        S.bar(g, "z", (20, ay - 1), (38, ay + 1), 1.6, 46, 48, "steel", 5)
    chim = box(g, 62, RIDGE - 12, 50, 70, RIDGE + 10, 58, "rust", 5)
    P.stone(g, chim, "rust", 5, block=(4, 3), seed=8)
    box(g, 61, RIDGE + 10, 49, 71, RIDGE + 12, 59, "stone", 4)

    # ---- the cut face: rooms in painted wallpaper, floor slabs, a door
    cut = (g.a > 0) & (X == XB - 1) & (Y >= G + ST) & (Y < EAVE) & (Z >= Z0) & (Z < Z1)
    for k, (ramp, sh) in enumerate((("pink", 5), ("teal", 6))):
        y0 = G + (k + 1) * ST
        room = cut & (Y >= y0) & (Y < y0 + ST - 3)
        P.flat(g, room, ramp, sh)
        P.flat(g, room & ((Z - Z0) % 6 == 0), ramp, sh - 1)  # wallpaper stripes
        P.flat(g, room & (Y < y0 + 2), "wood", 5)  # skirting
    P.flat(g, cut & (Y >= G + 2 * ST - 3) & (Y < G + 2 * ST), "stone", 5)
    P.flat(g, cut & (Y >= EAVE - 3), "stone", 5)
    # a door and a picture on the cut
    P.flat(g, cut & (Z >= 52) & (Z < 62) & (Y >= G + ST) & (Y < G + ST + 22), "wood", 4)
    P.flat(g, cut & (Z >= 34) & (Z < 44) & (Y >= G + 2 * ST + 12) & (Y < G + 2 * ST + 20), "gold", 5)
    P.flat(g, cut & (Z >= 36) & (Z < 42) & (Y >= G + 2 * ST + 14) & (Y < G + 2 * ST + 18), "sky", 5)
    # broken floor slabs jutting out at an angle (true slopes)
    for y0, drop, z0, z1 in ((G + 2 * ST - 3, 10, Z0 + 2, Z0 + 30), (G + ST - 3, 4, Z0 + 20, Z1 - 2)):
        g.prism("z", [(XB - 1, y0), (XB + 20, y0 - drop), (XB + 20, y0 - drop + 3), (XB - 1, y0 + 3)], z0, z1, C("stone", 5))
        sl = S.last(g)
        P.flat(g, sl, "stone", 5)
        P.flat(g, sl & (X > XB + 16), "stone", 4)
    for rz, ry in ((Z0 + 6, G + 2 * ST - 8), (Z0 + 16, G + 2 * ST - 10), (Z0 + 26, G + ST - 6)):  # dangling rebar
        S.bar(g, "z", (XB + 19, ry), (XB + 23, ry - 10), 1.2, rz, rz + 1, "rust", 4)

    # ---- the rubble slope (true slopes) with a few tilted chunks
    g.prism("z", [(XB - 2, G + ST), (XB + 6, G + ST + 2), (X1 + 16, G), (XB - 2, G)], Z0 - 4, Z1 + 6, C("sand", 4))
    rub = S.last(g)
    for m, fr in S.facets(g):
        P.stone(g, m, "sand", 4, block=(7, 5), mortar=-1, cracks=0.1, frame=fr, seed=9)
    for k, (bx, bz, s, a) in enumerate(((106, 10, 10, 20), (120, 20, 8, -30), (96, 14, 7, 35), (124, 60, 9, 15), (112, 80, 7, -20))):
        pts = S.rotate([(bx, G), (bx + s, G), (bx + s, G + s * 0.7), (bx, G + s * 0.7)], bx + s / 2, G, a)
        pts = [(u, max(float(G), v)) for u, v in pts]
        ramp = ("red", "sand", "stone")[k % 3]
        g.prism("z", pts, bz - 3, bz + 4, C(ramp, 5))
        P.stone(g, S.last(g), ramp, 5, block=(5, 3), seed=20 + k)

    # ---- front: an entrance with a striped canopy, windows, balconies
    door(g, "-z", Z0, 40, 58, G + 5, G + 30, leaf="teal", arch=False, seed=11)
    awning(g, "-z", Z0 - 1, 36, 62, G + 33, depth=10, drop=6, ramps=("teal", "bone"))
    win = [("gold", 6), ("teal", 6), ("gold", 6), ("sky", 5)]
    k = 0
    for storey in range(3):
        v0 = G + storey * ST + 10
        for u0 in ((X0 + 6, 66) if storey == 0 else (X0 + 6, 40, 66)):
            glass, glow = win[k % len(win)]
            window(g, "-z", Z0, u0, u0 + 12, v0, v0 + 15, glass=glass, glow=glow)
            k += 1
    # the broken part's ground floor window is boarded
    window(g, "-z", Z0, 92, 104, G + 10, G + 25, glass="teal", glow=5)
    for p0, p1 in (((90, G + 12), (106, G + 23)), ((90, G + 22), (106, G + 13))):
        b = S.bar(g, "z", p0, p1, 3, Z0 - 3, Z0 - 1, "wood", 5)
        P.planks(g, b, "wood", 5, width=3, across="y", seed=p0[1])
    # balconies with railings, laundry and an AC box
    for storey, (bx0, bx1) in ((1, (34, 60)), (2, (34, 60))):
        y = G + storey * ST + 3
        bal = box(g, bx0, y - 3, Z0 - 9, bx1, y, Z0, "stone", 6)
        P.flat(g, edges(bal), "stone", 4)
        rail = box(g, bx0, y, Z0 - 9, bx1, y + 8, Z0 - 8, "rust", 5)
        P.flat(g, rail & ((X - bx0) % 3 != 0) & (Y < y + 7), "rust", 3)
        box(g, bx0, y + 7, Z0 - 9, bx1, y + 8, Z0 - 7, "rust", 5)
    for k2, (lx, ramp) in enumerate(((20, "red"), (26, "gold"), (72, "sky"))):
        cloth = box(g, lx, G + 2 * ST + 2, Z0 - 2, lx + 5, G + 2 * ST + 10, Z0 - 1, ramp, 5)
        P.outline(g, cloth, ramp, 4, normal="z")
    box(g, X0 + 2, G + 2 * ST + 10, Z0 - 2, 80, G + 2 * ST + 11, Z0 - 1, "bone", 5)  # the line
    ac = box(g, 68, G + ST + 12, Z0 - 7, 80, G + ST + 22, Z0, "bone", 6)
    P.flat(g, ac & (Z == Z0 - 7) & ((X - 68) % 2 == 0) & (Y > G + ST + 13), "stone", 5)
    P.flat(g, edges(ac), "stone", 5)

    # ---- the function prop: a huge SOS sheet hanging from the top balcony
    top = G + 2 * ST + 3
    sheet = box(g, 28, top - 26, Z0 - 10, 66, top, Z0 - 9, "bone", 7)
    P.mottle(g, sheet, "bone", 6, seed=12)
    P.outline(g, sheet, "bone", 4, normal="z")
    P.flat(g, sheet & (Y < top - 23) & ((X % 5) == 0), "bone", 4)  # a torn hem
    label(g, "-z", Z0 - 10, 47, top - 21, "SOS", "red", 4, scale=2, gap=1)

    # ---- back and side windows
    for storey in range(3):
        v0 = G + storey * ST + 10
        for u0 in (X0 + 8, 44, 66):
            window(g, "+z", Z1, u0, u0 + 12, v0, v0 + 15, glass=("gold", "teal")[(u0 + storey) % 2], glow=6)
        window(g, "-x", X0, Z0 + 16, Z0 + 28, v0, v0 + 15, glass=("gold", "teal")[storey % 2], glow=6)
    window(g, "+z", Z1, 92, 104, G + 10, G + 25, glass="gold", glow=6)

    # ---- props
    crate(g, 118, G, 10, 10, ramp="sand", base=4, seed=13)
    S.drum(g, 8, 14, G, 16, 6.5, ramp="red", base=4, band=("gold", 5), seed=14)
    return g


def build() -> Asset:
    g = block()
    root = Part("collapsed-apartment", g, pivot=bounds_pivot(g))
    return Asset(id="apocalypse-buildings-collapsed-apartment", pack="apocalypse", category="buildings", name="Collapsed Apartment Block", root=root)
