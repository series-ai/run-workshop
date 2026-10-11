"""Raider warning totem, in the Pirate Nation style.

One tall icon (rule K3): a thick stake driven into a cairn of faceted
rocks (true slopes), crowned by a big horned skull (rule F4). A crossbar
carries a hanging tyre on one side and rattling cans on wire on the
other, so the totem is lopsided (rule F5). The red painted X, the rope
bands and the skull's glowing eyes are paint (rule S1).
"""
import numpy as np

import paint as P
from _props import asset, rock, root
from pnkit import box
from pnshapes import bar, coords, disc, ngon_radius, quad, skull
from voxgrid import C, Grid

PX, PZ = 14, 9  # stake centre
TOP = 24  # stake top (the skull sits on it)
BAR_Y = 19


def build():
    g = Grid(30, 41, 18)
    X, Y, Z = coords(g)
    # the cairn: three rocks
    rock(g, PX, PZ, 0, 7.5, 5, n=7, seed=1, ramp="sand", base=5)
    rock(g, PX - 4, PZ + 2, 0, 4.5, 3, n=5, seed=2, ramp="rust", base=5)
    rock(g, PX + 1, PZ, 4, 5, 4, n=6, seed=3, ramp="sand", base=6)
    # the stake with rope bands and a red painted X
    post = box(g, PX - 1.5, 5, PZ - 1.5, PX + 1.5, TOP, PZ + 1.5, "wood", 5)
    P.planks(g, post, "wood", 5, width=3, across="x", nails=False, seed=4)
    for y0 in (10, BAR_Y - 2):
        P.flat(g, post & (Y > y0) & (Y < y0 + 2), "sand", 6)
    fx = post & (Z < PZ - 1)
    P.flat(g, fx & (Y > 13) & (Y < 19) & ((np.abs((X - PX) - (Y - 16) * 0.5) < 0.6) | (np.abs((X - PX) + (Y - 16) * 0.5) < 0.6)), "red", 4)
    # the crossbar (a little tilted: a true slope)
    bar(g, "z", (PX - 11, BAR_Y - 1.0), (PX + 11, BAR_Y + 1.0), 2.4, PZ - 1, PZ + 1, "rust", 4)
    # a tyre hangs from the -x end on a rope
    box(g, PX - 9, BAR_Y - 5, PZ - 0.5, PX - 8, BAR_Y, PZ + 0.5, "sand", 6)
    tyre = disc(g, "z", PX - 8.5, BAR_Y - 10, 5, PZ - 1.5, PZ + 1.5, "gray", 4)
    d = ngon_radius(g, "z", PX - 8.5, BAR_Y - 10)
    P.flat(g, tyre & (d < 2.4), "gray", 3)
    P.flat(g, tyre & (d > 4.0) & (np.floor(np.arctan2(Y - BAR_Y + 10, X - PX + 8.5) * 2.5) % 2 == 0), "gray", 5)
    # rattling cans on wire from the +x end
    for k, (cx, cy) in enumerate(((PX + 7, BAR_Y - 6), (PX + 10, BAR_Y - 9))):
        box(g, cx, cy + 3, PZ - 0.5, cx + 0.8, BAR_Y, PZ + 0.5, "steel", 5)
        can = disc(g, "y", cx + 0.4, PZ, 1.6, cy, cy + 3.5, ("red", "gold")[k], 5, n=6)
        P.flat(g, can & (Y > cy + 3), "steel", 6)
    # a torn red rag tied to the crossbar, beside the stake
    g.prism("z", [(PX + 2, BAR_Y), (PX + 7, BAR_Y + 0.5), (PX + 6, BAR_Y - 4), (PX + 7.5, BAR_Y - 8), (PX + 4.5, BAR_Y - 6), (PX + 2.5, BAR_Y - 7.5)], PZ + 1, PZ + 2, C("red", 5))
    rag = g.solids[-1].mask(g.shape)
    P.mottle(g, rag, "red", 5, cell=2, seed=6)
    P.flat(g, rag & (Y > BAR_Y - 1), "red", 3)
    # the horned skull on top (true-slope horns)
    skull(g, PX, TOP, PZ, s=10, ramp="bone", base=6, eyes=("toxic", 6), socket=("rust", 2))
    for s in (-1, 1):
        p0, p1, p2 = (PX + s * 4.0, TOP + 8.0), (PX + s * 9.0, TOP + 9.0), (PX + s * 10.5, TOP + 13.0)
        g.prism("z", quad(p0, p1, 1.5, 1.2), PZ - 1.2, PZ + 1.2, C("bone", 5))
        g.prism("z", quad(p1, p2, 1.2, 0.5, cap=1.5), PZ - 1, PZ + 1, C("bone", 4))
    return asset("skull-pike", "Skull Warning Pike", root("skull-pike", g))
