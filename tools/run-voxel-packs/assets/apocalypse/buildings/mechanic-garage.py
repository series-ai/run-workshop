"""Wasteland repair garage with a large striped roller door."""
import numpy as np

import paint as P
import pnglyph
import pnpaint as PP
import pnshapes as S
from _life import make
from pnkit import box, door, edges, window
from voxgrid import C, Grid, Part

SIZE = (120, 110, 104)


def build():
    g = Grid(*SIZE)
    X, Y, Z = S.coords(g)
    slab = box(g, 2, 0, 5, 118, 5, 99, "sand", 4)
    PP.concrete(g, slab, "sand", 4, size=13, cracks=8, frame="top", seed=1)
    # Plank walls with 1-voxel seams over a block base (rules S2, S3).
    walls = box(g, 13, 5, 17, 107, 54, 88, "wood", 5)
    P.planks(g, walls, "wood", 5, width=4, across="x", length=(14, 22), seed=2)
    P.stone(g, walls & (Y < 16), "steel", 4, block=(8, 4), seed=21)
    P.flat(g, walls & (Y >= 16) & (Y < 17), "darkwood", 2)
    for face, plane in (("-x", 13), ("+x", 107)):
        for u0 in (34, 62):
            window(g, face, plane, u0, u0 + 14, 26, 40, glass="gold", glow=4)
    door(g, "+z", 88, 52, 68, 5, 33, leaf="rust", arch=False, seed=22)
    for xx in (20, 100):
        pipe = box(g, xx, 5, 88, xx + 2, 56, 90, "steel", 4)
        P.flat(g, pipe & (np.floor(Y) % 9 == 0), "steel", 2)
    for x0 in (12, 99):
        post = box(g, x0, 5, 13, x0 + 7, 58, 20, "steel", 5)
        P.plates(g, post, "steel", 5, size=(7, 8), seed=x0)
        P.flat(g, edges(post), "iron", 3)
    # A single sloped roof sheds rain from the high rear wall.
    g.prism("z", [(8, 56), (112, 56), (107, 83), (18, 69)], 12, 94, C("steel", 5))
    roof = g.solids[-1].mask(g.shape)
    # Wide ribs (3 light voxels and 1 dark line) read as clean corrugation.
    PP.corrugate(g, roof, "rust", 5, period=4, sheet=12, length=30, frame="x", seed=3)
    P.flat(g, roof & (np.abs(Y - 70) < 1), "gold", 4)
    # The roller door fills the front bay with broad, readable slats.
    roller = box(g, 30, 5, 12, 88, 49, 16, "steel", 5)
    P.plates(g, roller, "steel", 5, size=(12, 8), seed=4)
    for yy in range(9, 48, 5):
        P.flat(g, roller & (np.abs(Y - yy) < 1.0), "iron", 3)
        P.flat(g, roller & (np.abs(Y - yy - 1.2) < 0.7), "steel", 6)
    P.outline(g, roller, "darkwood", 3, normal="z")
    # Painted sign and a hanging wrench mark the garage use.
    # The gear sits under the word, so the two never overlap.
    sign = box(g, 35, 58, 11, 85, 84, 16, "bone", 6)
    P.outline(g, sign, "darkwood", 3, normal="z")
    pnglyph.text(g, "-z", 10, 43, 74, "GARAGE", "red", 4, scale=1, gap=1)
    gw, _gh = pnglyph.icon_size("gear")
    pnglyph.icon(g, "-z", 10, 60 - gw // 2, 62, "gear", "steel", 3, scale=1)
    # Three repair props share the concrete forecourt.
    for cx, cz in ((19, 19), (98, 26)):
        S.tyre(g, "y", cx, cz, 9, 5, 10, rubber=("gray", 3), hub=("steel", 5))
    toolbox = box(g, 14, 5, 41, 35, 20, 57, "teal", 5)
    P.plates(g, toolbox, "teal", 5, size=(8, 6), seed=5)
    P.flat(g, edges(toolbox), "darkwood", 3)
    for x0 in (18, 25):
        box(g, x0, 20, 47, x0 + 4, 23, 51, "gold", 5)
    engine = box(g, 77, 5, 2, 101, 22, 11, "iron", 4)
    P.plates(g, engine, "steel", 5, size=(7, 6), seed=6)
    for x0 in range(80, 100, 5):
        S.disc(g, "y", x0, 7, 3.0, 22, 29, "rust", 5, n=8)
    # An air compressor and its raised hose identify the workshop.
    S.disc(g, "y", 108, 7, 6, 5, 26, "red", 5, n=10)
    S.disc(g, "y", 108, 7, 4, 26, 30, "steel", 6, n=8)
    hose = ((108, 30, 7), (114, 33, 7), (118, 29, 7), (118, 19, 7), (114, 15, 7))
    for a, b in zip(hose, hose[1:]):
        S.bar(g, "z", (a[0], a[1]), (b[0], b[1]), 1.5, 6, 9, "gold", 5)
    return make("buildings", "mechanic-garage", "Mechanic Garage", Part("mechanic-garage", g))
