"""Torch sconce, in the Pirate Nation haunted style.

A short pilaster of light haunted stone (painted blocks and mortar, a
plinth, a cap and a sloped coping) with a bone skull plaque. On its face
an iron bat bracket holds a thick torch angled out from the wall (a true
slope) with a wrapped pitch-cloth head, and a big licking fire (the shared PN
flame: nested red-orange, orange and gold layers). Detail is paint (rule S1).

Parts: sconce (root), torch (in the bracket), flame (flickers by scale
from its base). Clip idle loops. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _kit import flicker, pfx, world
from _life import moss_top, stonework
from _pn import assemble, coords, last, stamp
from _props import pn_flame
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

SIZE = (16, 40, 22)
CX = 8.0
WZ = 12  # the wall front (z)
BASE = (12.0, 9.0)  # the torch foot (y, z)
HEAD = (27.5, 4.2)  # the torch head top (y, z)
SKULL = [".#####.", "#######", "#oo#oo#", "#oo#oo#", "###o###", ".#####.", ".#.#.#."]
BAT = [(8, 14), (9.3, 15.3), (11, 14.3), (12.5, 15.5), (14.5, 15), (14, 18.5), (11.5, 20.5), (9.6, 19.2), (9.4, 21.5), (8, 20.3),
       (6.6, 21.5), (6.4, 19.2), (4.5, 20.5), (2, 18.5), (1.5, 15), (3.5, 15.5), (5, 14.3), (6.7, 15.3)]


def grab(g: Grid, start: int):
    return g.solids[start:]


def sconce() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    # the pilaster: plinth, shaft and cap in light stone
    shaft = box(g, 2, 4, WZ, 14, 33, 20, "gray", 6)
    stonework(g, shaft, "gray", 6, block=(6, 4), seed=1)
    plinth = box(g, 1, 0, WZ - 1, 15, 4, 21, "gray", 5)
    cap = box(g, 1, 33, WZ - 1, 15, 36, 21, "gray", 5)
    for m in (plinth, cap):
        stonework(g, m, "gray", 5, block=(7, 3), seed=2)
        P.outline(g, m, "gray", 4)
    s0 = len(g.solids)
    S.pyramid(g, 1, WZ - 1, 15, 21, 36, 3.5, "purple", 4, apex=None)
    S.paint_facets(g, grab(g, s0), lambda gg, m, fr: P.tiles(gg, m, "purple", 4, row=2, width=3, frame=fr))
    moss_top(g, plinth, depth=1, seed=3)
    P.flat(g, shaft & (Y < 6) & ((P._hash(X, Z, seed=4) % np.uint64(3)) == 0), "moss", 5)
    # A small amethyst rune panel adds a clear haunted accent to the stone.
    rune = shaft & (Z == WZ) & (X >= 6) & (X <= 10) & (Y >= 23) & (Y <= 29)
    P.flat(g, rune, "purple", 5)
    glyph = rune & ((np.abs(X - CX) < 0.6) | (np.abs(Y - 26) < 0.6))
    P.flat(g, glyph, "toxic", 6)
    # a bone skull plaque under the bracket
    stamp(g, "-z", WZ, int(CX) - 4, 5, SKULL, {"#": C("bone", 6), "o": C("toxic", 5)}, depth=1)
    # the iron bat bracket and its arm
    g.prism("z", BAT, WZ - 2, WZ, C("gray", 5))
    bat = last(g)
    P.mottle(g, bat, "gray", 5, cell=2, seed=5)
    P.outline(g, bat, "gray", 3, normal="z")
    stamp(g, "-z", WZ - 2, int(CX) - 2, 18, ["o.o"], {"o": C("toxic", 6)}, depth=1)
    arm = box(g, int(CX) - 1, 16, 6, int(CX) + 1, 18, WZ - 2, "gray", 5)
    collar = box(g, int(CX) - 2, 15, 5, int(CX) + 2, 18, 8, "gray", 4)
    P.outline(g, collar, "gray", 3)
    P.flat(g, arm & (Y == 17), "gray", 6)
    return g


def torch() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    g.prism("x", S.quad(BASE, (23.0, 5.6), 1.4, 1.6, cap=0.3), CX - 1.5, CX + 1.5, C("wood", 5))
    S.paint_facets(g, [g.solids[-1]], lambda gg, m, fr: P.planks(gg, m, "wood", 5, width=3, across="x", nails=False, frame=fr, seed=6))
    g.prism("x", S.quad((21.5, 6.2), HEAD, 2.3, 2.5), CX - 2.5, CX + 2.5, C("sand", 4))
    wrap = last(g)
    # wrapped pitch cloth: diagonal bands
    band = ((Y + (Z * 0.4).astype(int)) % 3) == 0
    P.flat(g, wrap, "sand", 4)
    P.flat(g, wrap & band, "sand", 2)
    P.flat(g, wrap & (Y >= HEAD[0] - 1.5), "rust", 3)
    return g


def flame() -> Grid:
    g = Grid(*SIZE)
    fy, fz = HEAD[0] - 0.5, HEAD[1]
    pn_flame(g, CX, fz, fy, 8, 12, cross=0.75)
    return g


def build():
    parts = {"sconce": sconce(), "torch": torch(), "flame": flame()}
    root_j = (CX, 0.0, WZ + 4.0)
    base = (CX, BASE[0], BASE[1])
    fb = (CX, HEAD[0] - 0.5, HEAD[1])
    root = assemble(parts, [
        ("sconce", None, root_j),
        ("torch", "sconce", base),
        ("flame", "torch", fb),
    ])
    idle = {"flame": {"scale": flicker(0.8, 0.82, 1.18)}}
    tip = (0.0, HEAD[0] + 6.0 - root_j[1], HEAD[1] - root_j[2])
    return world("torch-sconce", "animated-props", "Torch Sconce", root,
                 clips=[Clip("idle", idle)],
                 sockets=[Socket("socket-flame", at=tip, parent="flame")],
                 pfx=[pfx("rvx-monster-torch-flame", "socket-flame", "idle", size=11)])
