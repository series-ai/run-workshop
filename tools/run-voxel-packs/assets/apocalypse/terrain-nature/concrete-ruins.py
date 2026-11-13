"""Two broken concrete walls and a tiled floor from a collapsed shelter."""
import numpy as np

import paint as P
import pnglyph
import pnpaint as PP
import pnshapes as S
from _life import rock, make
from pnkit import box, edges
from voxgrid import C, Grid, Part

SIZE = (92, 78, 82)


def build():
    g = Grid(*SIZE)
    X, Y, Z = S.coords(g)
    slab = box(g, 3, 0, 4, 89, 5, 78, "stone", 5)
    PP.concrete(g, slab, "stone", 5, size=12, cracks=11, frame="top", seed=1)
    P.flat(g, slab & (Y < 2), "darkwood", 5)
    # The front wall fractures into two clear height lines.
    g.prism("z", [(8, 5), (48, 5), (48, 47), (39, 52), (30, 43), (21, 50), (8, 39)], 13, 20, C("stone", 5))
    front = g.solids[-1].mask(g.shape)
    P.stone(g, front, "stone", 5, block=(8, 5), seed=2)
    P.flat(g, edges(front), "steel", 4)
    g.prism("z", [(54, 5), (82, 5), (82, 35), (76, 30), (70, 42), (62, 36), (54, 39)], 13, 20, C("stone", 5))
    rear = g.solids[-1].mask(g.shape)
    P.stone(g, rear, "stone", 5, block=(8, 5), seed=3)
    # Exposed steel rods end above the broken edges.
    for x0, y1 in ((13, 47), (27, 45), (43, 49), (59, 37), (76, 34)):
        S.bar(g, "z", (x0, y1 - 8), (x0 + 1, y1 + 3), 1.5, 16, 19, "rust", 5)
    # A tilted stair panel and a broken doorway make this read as a ruin.
    for k in range(5):
        step = box(g, 19 + k * 5, 5 + k * 4, 25, 25 + k * 5, 9 + k * 4, 38, "stone", 5)
        P.flat(g, step, "stone", 5)
        P.flat(g, edges(step), "darkwood", 5)
    lintel = S.bar(g, "z", (14, 39), (37, 48), 4.0, 18, 25, "steel", 5)
    P.plates(g, lintel, "steel", 5, size=(8, 6), seed=4)
    for x0, top in ((18, 14), (45, 35)):
        box(g, x0 - 1, 5, 39, x0 + 2, top, 42, "rust", 5)
    # Painted notices and one large warning sign provide scale.
    board = box(g, 31, 18, 10, 60, 33, 13, "bone", 6)
    P.outline(g, board, "darkwood", 5, normal="z")
    pnglyph.text(g, "-z", 9, 34, 23, "RUIN", "red", 4, scale=1, gap=1)
    for y0 in (10, 18, 26):
        P.flat(g, board & (Y > y0) & (Y < y0 + 1), "teal", 5)
    # One collapsed beam and a rusted stair rail sit on the shared floor.
    S.bar(g, "z", (66, 7), (49, 3), 3.0, 21, 26, "wood", 5)
    for p0, p1 in (((18, 12), (30, 32)), ((30, 32), (45, 35))):
        S.bar(g, "z", p0, p1, 1.7, 39, 42, "rust", 5)
    for k,(xx,zz,rr,hh) in enumerate(((18,39,8,12),(46,48,9,14),(55,18,6,10))):
        chunk=rock(g,xx,zz,3,rr,rr*0.8,hh,"stone",5,shrink=0.7,n=5,seed=40+k)
        PP.concrete(g,chunk,"stone",5,size=7,cracks=3,seed=k)
    return make("terrain-nature", "concrete-ruins", "Concrete Shelter Ruins", Part("concrete-ruins", g))
