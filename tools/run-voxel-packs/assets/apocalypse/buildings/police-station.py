"""Fortified precinct with a badge board and a roof watch post."""
import numpy as np

import paint as P
import pnglyph
import pnpaint as PP
import pnshapes as S
from _life import make
from pnkit import box, door, edges, window
from voxgrid import C, Grid, Part

SIZE = (112, 106, 96)


def build():
    g = Grid(*SIZE)
    X, Y, Z = S.coords(g)
    lot = box(g, 4, 0, 5, 108, 5, 91, "sand", 4)
    PP.concrete(g, lot, "sand", 4, size=14, cracks=9, frame="top", seed=1)
    shell = box(g, 12, 5, 16, 100, 72, 82, "stone", 5)
    P.stone(g, shell, "stone", 5, block=(9, 6), seed=2)
    P.flat(g, shell & (Y > 42) & (Y < 49), "teal", 5)
    P.flat(g, shell & (Y < 16), "darkwood", 5)
    P.grime(g, shell & (Y < 22), height=4, seed=3)
    # A concrete parapet makes the roof a second armed level.
    g.prism("z", [(7, 70), (105, 70), (56, 94)], 11, 87, C("steel", 5))
    roof = S.last(g)
    P.plates(g, roof, "steel", 5, size=(10, 8), seed=4)
    P.flat(g, edges(roof), "steel", 4)
    for x0 in range(12, 102, 16):
        box(g, x0, 77, 11, x0 + 7, 83, 16, "steel", 5)
    # Three broad front windows have thick bars and chipped blue frames.
    for x0 in (19, 42, 70, 86):
        pane = box(g, x0, 40, 13, x0 + 13, 58, 17, "teal", 5)
        P.outline(g, pane, "darkwood", 5, normal="z")
        for bx in (x0 + 4, x0 + 9):
            box(g, bx, 40, 11, bx + 2, 59, 13, "steel", 5)
    door(g, "-z", 16, 46, 66, 5, 36, leaf="wood", seed=5)
    box(g, 43, 5, 5, 69, 9, 16, "stone", 5)
    box(g, 45, 9, 8, 67, 12, 16, "stone", 6)
    door(g, "+z", 82, 48, 66, 5, 34, leaf="steel", seed=19)
    window(g, "+x", 100, 30, 48, 25, 45, glass="teal", glow=5)
    # The oversized shield mark and station lettering identify the building.
    shield = S.disc(g, "z", 56, 67, 13, 9, 14, "teal", 6, n=6)
    P.flat(g, edges(shield), "gold", 5)
    pnglyph.icon(g, "-z", 9, 52, 62, "star", "bone", 6, scale=2)
    pnglyph.text(g, "-z", 16, 36, 20, "POLICE", "bone", 7, scale=1, gap=1)
    # A small raised lookout and an oversized rusty siren sit on the roof.
    lookout = box(g, 40, 77, 28, 76, 98, 67, "darkwood", 5)
    P.planks(g, lookout, "darkwood", 5, width=4, across="y", seed=6)
    for x0 in (42, 60):
        box(g, x0, 82, 25, x0 + 2, 96, 28, "steel", 5)
    box(g, 37, 97, 25, 79, 101, 70, "rust", 5)
    for cx in (44, 72):
        S.disc(g, "y", cx, 46, 5, 83, 90, "red", 6, n=8)
        S.disc(g, "y", cx, 46, 3, 90, 93, "gold", 6, n=8)
    # A barrier, a drum and a framed evidence crate ground the entry.
    barrier = box(g, 15, 5, 2, 37, 9, 8, "steel", 5)
    P.plates(g, barrier, "steel", 5, size=(6, 4), seed=7)
    PP.hazard(g, barrier, period=6, frame="top")
    S.disc(g, "y", 29, 18, 7, 5, 23, "red", 5, n=8)
    crate = box(g, 77, 5, 3, 95, 18, 14, "sand", 5)
    P.planks(g, crate, "sand", 5, width=4, across="y", nails=True, seed=8)
    P.flat(g, edges(crate), "darkwood", 5)
    return make("buildings", "police-station", "Police Station", Part("police-station", g))
