"""Mechanic's toolbox, in the Pirate Nation style.

A chunky signal-red two-tier box (rule K3) with its cantilever trays
swung open on true-diagonal steel arms, so the box reads as a stepped
icon. Spanners, a screwdriver and sockets lie in the trays; a hammer rests
across the top and a greasy rag droops over one tray (true slopes, rule
F5). Seams, latches and the tools' colours are paint (rule S1).
"""
import numpy as np

import paint as P
from _props import asset, child, root
from pnkit import box, edges
from pnshapes import bar, coords
from voxgrid import C, Grid

L = 22


def build():
    g = Grid(L + 2, 17, 22)
    X, Y, Z = coords(g)
    base = box(g, 1, 0, 6, L + 1, 9, 16, "red", 5)
    P.flat(g, edges(base), "red", 3)
    P.flat(g, base & (np.abs(Y - 6.5) < 0.5), "red", 3)  # the lid seam
    for lx in (4, L - 3):
        box(g, lx, 5, 5, lx + 2, 8, 6, "steel", 6)  # latches
    P.flat(g, base & (Y < 1), "red", 3)
    # the two trays, swung out to the front and the back on diagonal arms
    trays = []
    for z0, z1, y0 in ((1, 7, 10), (15, 21, 10)):
        t = box(g, 1, y0, z0, L + 1, y0 + 4, z1, "red", 6)
        P.flat(g, edges(t), "red", 4)
        trays.append((t, z0, z1, y0))
    for x in (1, L):
        bar(g, "x", (8.5, 8.0), (11.5, 4.0), 1.4, x, x + 1, "steel", 5)  # (y, z)
        bar(g, "x", (8.5, 14.0), (11.5, 18.0), 1.4, x, x + 1, "steel", 5)
    # tools painted into the trays (their top faces)
    ft, fz0, fz1, fy = trays[0]
    top = ft & (Y > fy + 3)
    P.flat(g, top & ~edges(ft), "red", 2)
    for sx, col in ((4, ("steel", 6)), (9, ("steel", 5)), (14, ("steel", 6))):  # spanners
        P.flat(g, top & (np.abs(Z - 4) < 0.6) & (X > sx) & (X < sx + 4), *col)
        P.flat(g, top & (np.abs(Z - 4) < 1.6) & ((np.abs(X - sx) < 0.8) | (np.abs(X - sx - 4) < 0.8)), *col)
    bt, bz0, bz1, by = trays[1]
    top = bt & (Y > by + 3)
    P.flat(g, top & ~edges(bt), "red", 2)
    P.flat(g, top & (np.abs(Z - 18) < 0.6) & (X > 4) & (X < 12), "steel", 6)  # screwdriver shaft
    P.flat(g, top & (np.abs(Z - 18) < 1.1) & (X > 11) & (X < 16), "gold", 5)  # its handle
    for sx in (17, 19):
        P.flat(g, top & (np.abs(Z - 17.5) < 0.8) & (np.abs(X - sx) < 0.8), "steel", 6)  # sockets
    # the greasy rag droops over the back tray's end (a true slope)
    g.prism("z", [(L - 5, 14.2), (L + 1.5, 14.2), (L + 1.8, 8.0), (L + 0.8, 8.0), (L + 0.5, 13.0), (L - 5, 13.0)], 15.5, 20.5, C("sand", 5))
    rag = g.solids[-1].mask(g.shape)
    P.flat(g, rag & ((X + Z) % 5 < 1.2), "darkwood", 5)
    r = root("toolbox", g)
    # a hammer rests across the top of the box
    hg = Grid(16, 5, 3)
    handle = box(hg, 0, 1, 0, 12, 3, 2, "wood", 6)
    P.planks(hg, handle, "wood", 6, width=2, across="y", nails=False, seed=3)
    head = box(hg, 12, 0, 0, 15, 5, 2, "steel", 5)
    P.flat(hg, head & (coords(hg)[1] > 4), "steel", 6)
    child(r, "hammer", hg, pivot=(8.0, 0.0, 1.0), at_grid=(L / 2 + 1, 9, 11), rot=(0.0, 24.0, 0.0))
    return asset("toolbox", "Toolbox", r)
