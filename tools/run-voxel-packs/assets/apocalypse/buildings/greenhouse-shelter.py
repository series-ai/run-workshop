"""Seed shelter with a framed glass roof, planters and rain storage."""
import numpy as np

import paint as P
import pnglyph
import pnpaint as PP
import pnshapes as S
from _life import make
from pnkit import box, edges, gable_roof
from voxgrid import C, Grid, Part

SIZE = (118, 110, 100)


def build():
    g = Grid(*SIZE)
    X, Y, Z = S.coords(g)
    bed = box(g, 3, 0, 7, 115, 5, 93, "sand", 4)
    PP.concrete(g, bed, "sand", 4, size=13, cracks=8, frame="top", seed=1)
    knee = box(g, 15, 5, 18, 103, 25, 23, "stone", 5)
    box(g, 15, 5, 77, 103, 25, 82, "stone", 5)
    box(g, 15, 5, 23, 20, 25, 77, "stone", 5)
    box(g, 98, 5, 23, 103, 25, 77, "stone", 5)
    P.stone(g, knee, "stone", 5, block=(9, 6), seed=2)
    P.flat(g, knee & (Y < 10), "darkwood", 3)
    # Glass wall panels use broad teal panes inside thick steel frames.
    for x0 in range(20, 100, 16):
        pane = box(g, x0, 25, 17, x0 + 12, 57, 20, "teal", 5)
        P.flat(g, pane & (np.abs(X - x0 - 3) < 1), "sky", 6)
        P.outline(g, pane, "steel", 3, normal="z")
        post = box(g, x0 - 2, 23, 14, x0 + 1, 58, 19, "steel", 5)
        P.plates(g, post, "steel", 5, size=(5, 7), seed=x0)
    for x0 in (16, 99):
        box(g, x0, 23, 18, x0 + 4, 61, 82, "steel", 5)
    for xa,xb in ((10,40),(73,108)):
        roof = gable_roof(g,xa,xb,13,87,58,94,ramp="teal",thick=3,overhang=1,
                          trim="steel",gable="teal",ridge="x",seed=3)
    for xx in (40,56,72):
        S.bar(g,"x",(58,17),(94,50),1.5,xx,xx+2,"steel",5)
        S.bar(g,"x",(94,50),(58,82),1.5,xx,xx+2,"steel",5)
    for xx in (16,99):
        for zz in (27,47,67):
            pane=box(g,xx,28,zz,xx+4,55,zz+12,"teal",5)
            P.outline(g,pane,"steel",3,normal="x")
            P.flat(g,pane & (np.abs(Z-zz-4)<1),"sky",6)
    # The center bed carries oversized vegetables and a bright seed marker.
    trough = box(g, 32, 5, 31, 88, 13, 70, "darkwood", 5)
    P.planks(g, trough, "darkwood", 5, width=4, across="x", seed=4)
    P.flat(g, edges(trough), "steel", 3)
    for k, (cx, cz, ramp) in enumerate(((42, 43, "red"), (59, 53, "gold"), (75, 43, "teal"))):
        fruit = S.disc(g, "y", cx, cz, 8.5, 13, 29, ramp, 5, n=8)
        P.flat(g, fruit & (Y > 25), ramp, 6)
        S.bar(g, "y", (cx, cz), (cx + 2, cz - 3), 1.6, 27, 32, "leaf", 5)
        if k == 0:
            P.flat(g, fruit & (np.abs(X - cx) < 1.5), "gold", 6)
    # The function prop is a wide rain tank with a big green water gauge.
    tank = S.disc(g, "y", 96, 70, 12, 5, 36, "steel", 5, n=8)
    P.plates(g, tank, "steel", 5, size=(7, 8), seed=5)
    P.flat(g, tank & (np.abs(X - 96) < 7) & (Y > 15) & (Y < 29), "teal", 6)
    S.disc(g, "z", 96, 27, 4, 68, 71, "teal", 6, n=8)
    pnglyph.text(g, "-z", 67, 92, 18, "WATER", "bone", 7, scale=1, gap=0)
    for cx in (13, 106):
        crate = box(g, cx, 5, 2, cx + 10, 17, 12, "sand", 5)
        P.planks(g, crate, "sand", 5, width=4, across="y", nails=True, seed=cx)
        P.flat(g, edges(crate), "darkwood", 3)
    sign = box(g, 40, 65, 10, 79, 83, 14, "bone", 6)
    P.outline(g, sign, "darkwood", 3, normal="z")
    pnglyph.text(g, "-z", 9, 48, 72, "SEEDS", "red", 4, scale=1, gap=1)
    return make("buildings", "greenhouse-shelter", "Greenhouse Shelter", Part("greenhouse-shelter", g))
