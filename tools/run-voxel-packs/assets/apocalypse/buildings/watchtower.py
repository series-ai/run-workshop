"""Raider watchtower, in the Pirate Nation style.

Four thick timber legs that splay out to stone footings (oblique prisms,
true slopes in both axes), X braces, a plank lookout walled with sandbags,
and a steep corrugated pyramid roof on corner posts with a tattered flag.
The function prop is oversized (rules F4, K1): a giant searchlight on the
front rail sweeps the wasteland on `idle`. A toxic-green skull banner and
spare tyres hang on the frame, and a ladder climbs the back. Detail is
paint (S1). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
import pnshapes as S
from _bld import bloom, leg, part, sandbags
from pnkit import box, edges, pennant
from voxgrid import C, Asset, Clip, Grid, Part, Socket, bounds_pivot

W, H, D = 72, 150, 72
DECK = 72
FOOT = 6  # leg footprint offset from the grid edge at the ground
TOP = 16  # leg offset at the deck
LAMP = (36, DECK + 18, 9)  # searchlight pivot (x, y, z)


def tower() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = S._idx(g)
    # ---- stone footings and four splayed legs
    lo, hi = FOOT, W - FOOT - 5
    for fx in (lo - 1, hi - 1):
        for fz in (lo - 1, hi - 1):
            ft = box(g, fx, 0, fz, fx + 7, 4, fz + 7, "stone", 5)
            P.stone(g, ft, "stone", 5, block=(4, 2), seed=fx + fz)
    shift = TOP - FOOT
    for sx, x0 in ((1, lo), (-1, hi)):
        for sz, z0 in ((1, lo), (-1, hi)):
            leg(g, x0, z0, x0 + 5, z0 + 5, 4, DECK, sx * shift, sz * shift, ramp="darkwood", base=5, seed=x0 * 3 + z0)

    def at(y):  # leg inset at height y
        return FOOT + shift * (y - 4) / (DECK - 4)

    # ---- X braces on every side (true slopes)
    for ya, yb in ((10, 44), (44, 76)):
        ia, ib = at(ya), at(yb)
        for zf in (1, 0):  # front and back
            zc = (ia + ib) / 2 + 1 if zf else W - (ia + ib) / 2 - 4
            S.bar(g, "z", (ia + 2, ya), (W - ib - 2, yb), 3, zc, zc + 3, "wood", 5)
            S.bar(g, "z", (W - ia - 2, ya), (ib + 2, yb), 3, zc, zc + 3, "wood", 5)
            xc = (ia + ib) / 2 + 1 if zf else W - (ia + ib) / 2 - 4
            S.bar(g, "x", (ya, ia + 2), (yb, W - ib - 2), 3, xc, xc + 3, "wood", 5)
            S.bar(g, "x", (ya, W - ia - 2), (yb, ib + 2), 3, xc, xc + 3, "wood", 5)
        for m, fr in [(g.a > 0, None)]:
            pass
    # a crossbeam ring under the deck
    ring = box(g, TOP - 2, DECK - 5, TOP - 2, W - TOP + 2, DECK - 1, W - TOP + 2, "darkwood", 5)
    P.planks(g, ring, "darkwood", 5, width=4, across="y", seed=1)

    # ---- the lookout: a plank deck walled with sandbags
    deck = box(g, 8, DECK - 1, 8, W - 8, DECK + 3, W - 8, "wood", 6)
    P.planks(g, deck, "wood", 6, width=4, across="x", seed=2)
    P.flat(g, deck & (Y < DECK), "wood", 4)
    y0 = DECK + 3
    sandbags(g, "x", 8, W - 8, 8, y0, rows=3, h=5, d=6, ramp="sand", base=5, seed=3)
    sandbags(g, "x", 8, W - 8, W - 14, y0, rows=3, h=5, d=6, ramp="sand", base=5, seed=4)
    sandbags(g, "z", 14, W - 14, 8, y0, rows=3, h=5, d=6, ramp="sand", base=5, seed=5)
    sandbags(g, "z", 14, W - 14, W - 14, y0, rows=3, h=5, d=6, ramp="sand", base=5, seed=6)

    # ---- corner posts and a steep corrugated pyramid roof
    for px in (9, W - 13):
        for pz in (9, W - 13):
            post = box(g, px, y0, pz, px + 4, 116, pz + 4, "darkwood", 5)
            P.planks(g, post, "darkwood", 5, width=4, across="x", nails=False, seed=px + pz)
    eave = box(g, 6, 114, 6, W - 6, 118, W - 6, "rust", 4)
    P.planks(g, eave, "rust", 4, width=4, across="y", nails=True, seed=7)
    g.prism("y", [(2, 2), (W - 2, 2), (W - 2, W - 2), (2, W - 2)], 118, 140, C("rust", 5), top=[(W / 2, W / 2)] * 4)
    solid = [g.solids[-1]]
    roof = S.last(g)
    for m, fr in S.facets(g, solid):
        if fr != "top":
            pnpaint.corrugate(g, m, "rust", 5, period=3, sheet=10, length=10, frame=fr, seed=8)
    P.flat(g, roof & S.seams(g, solid, 0.9), "darkwood", 5)
    P.flat(g, roof & (Y < 119), "rust", 3)
    bloom(g, roof & (Y > 119), 3, ((10, 119, 10), (62, 132, 62)), r=(5.0, 7.0), ramp="teal", shades=(5, 5), seed=9)
    pennant(g, 35, 136, 35, 12, 14, "toxic")

    # ---- a toxic skull banner and spare tyres on the frame
    fz = at(40) - 1
    ban = box(g, 22, 28, fz - 1, 50, 56, fz + 1, "toxic", 4)
    P.outline(g, ban, "toxic", 2, normal="z")
    P.flat(g, ban & (Y < 31) & ((X % 4) < 2), "toxic", 2)  # a torn hem
    pnglyph.icon(g, "-z", fz - 1, 27, 36, "skull", "bone", 6, scale=2)
    box(g, 20, 55, fz - 1, 52, 57, fz + 1, "darkwood", 5)
    for tx, ty in ((at(20) + 1, 20), (W - at(30) - 3, 30)):
        S.tyre(g, "x", ty, 36, 7, tx - 2, tx + 3, rubber=("gray", 3), hub=("steel", 5))

    # ---- a ladder up the back to a hatch
    for lx in (30, 40):
        box(g, lx, 4, W - 12, lx + 2, DECK + 12, W - 10, "wood", 4)
    for ly in range(8, DECK + 10, 6):
        box(g, 30, ly, W - 12, 42, ly + 2, W - 10, "wood", 6)
    # the searchlight's pedestal on the front rail
    ped = box(g, LAMP[0] - 3, y0, LAMP[2] - 3, LAMP[0] + 3, LAMP[1], LAMP[2] + 3, "steel", 5)
    P.flat(g, edges(ped), "steel", 3)
    return g


def searchlight() -> tuple[Grid, tuple]:
    g = Grid(W, H, D)
    lx, ly, lz = LAMP
    cy = ly + 11
    yoke = box(g, lx - 13, ly, lz - 2, lx + 13, ly + 2, lz + 2, "red", 5)
    for sx in (lx - 13, lx + 11):
        box(g, sx, ly, lz - 2, sx + 2, cy + 1, lz + 2, "red", 5)
    body = S.disc(g, "z", lx, cy, 10, lz - 5, lz + 10, "steel", 6, n=10)
    P.flat(g, body & (S._idx(g)[2] > lz + 7), "steel", 4)
    rim = S.disc(g, "z", lx, cy, 11.5, lz - 7, lz - 4, "red", 5, n=10)
    lens = S.disc(g, "z", lx, cy, 9, lz - 8, lz - 6, "gold", 7, n=10)
    P.flat(g, lens & (S.radial(g, "z", lx, cy) < 4.5), "bone", 7)
    P.flat(g, lens & (np.abs(S._idx(g)[0] - lx + S._idx(g)[1] - cy) < 1), "bone", 7)
    return g, (lx, cy, lz - 8)


def build() -> Asset:
    g = tower()
    pivot = bounds_pivot(g)
    root = Part("watchtower", g, pivot=pivot)
    sg, lens = searchlight()
    part(root, "searchlight", sg, LAMP)
    sweep = [(0.0, (0.0, -40.0, 0.0)), (2.0, (8.0, 40.0, 0.0)), (4.0, (0.0, -40.0, 0.0))]
    return Asset(id="apocalypse-buildings-watchtower", pack="apocalypse", category="buildings", name="Raider Watchtower", root=root,
                 clips=[Clip("idle", {"searchlight": {"rot": sweep}})],
                 sockets=[Socket("socket-light", at=tuple(float(lens[i] - pivot[i]) for i in range(3)), parent="searchlight")],
                 pfx=[{"effectId": "rvx-apocalypse-searchlight", "socket": "socket-light", "trigger": "idle", "size": 24, "aim": [0.0, -0.243, -0.97]}])
