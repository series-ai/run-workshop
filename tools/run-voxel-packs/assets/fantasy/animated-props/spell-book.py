"""Floating spell book in the Pirate Nation style.

One iconic shape (rule K3): an oversized, chunky tome (royal blue leather,
gold corner caps, a gold sun sigil with a cyan gem on the cover, a gold
clasp, cream page edges) hovering over a squat lectern: a stone foot, a
planked wooden column with a glowing cyan rune and a gold-rimmed plate
painted with a magic circle. On `open` the cover swings over on its spine
and the small cyan rune sigil that spins over it grows and rises; on `close`
it shuts; on `idle` the closed book hovers and rocks under the sigil. About 21 wide and 32 tall.
Faces -Z.
"""
import math

import numpy as np

import paint as P
from _life import asset, coords, facet_paint, keys, pfx, plan, rig
from pnglyph import stamp
from pnkit import box, edges
from pnshapes import flat_ngon, seams
from voxgrid import C, Clip, Grid, Socket, turn

S = (32, 40, 26)
BX0, BX1 = 6, 25  # book x (the spine is on the left)
BZ0, BZ1 = 6, 19  # book z
BY = 19  # book bottom: back cover 19-21, pages 21-24, front cover 24-26
PAGES = (21, 24)
TOP = 26
CX, CZ = (BX0 + BX1) / 2, (BZ0 + BZ1) / 2
SIGIL_Y = 31.0

SUN = [
    "...#...",
    ".#.#.#.",
    "..###..",
    "###@###",
    "..###..",
    ".#.#.#.",
    "...#...",
]
RUNE = ["#.#.#", "#####", "..#..", ".###.", "..#.."]


def lectern() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    foot = plan(g, flat_ngon(CX, CZ, 8.5, 8), 0, 3, "stone", 5, top=flat_ngon(CX, CZ, 7.5, 8))
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(5, 3), frame=fr, seed=2))
    P.flat(g, foot & (Y < 1), "stone", 3)
    # the planked column with gold bands and a glowing rune on the front
    col = box(g, 12, 3, 9, 19, 12, 16, "wood", 5)
    P.planks(g, col, "wood", 5, width=2, across="x", nails=False, seed=3)
    P.flat(g, edges(col), "darkwood", 4)
    P.flat(g, col & ((Y < 4) | (Y > 11)), "gold", 5)
    P.flat(g, edges(col) & ((Y < 4) | (Y > 11)), "gold", 4)
    P.flat(g, col & (Z < 10) & (X > 12.9) & (X < 18.1) & (Y > 4.9) & (Y < 11.1), "blue", 3)
    stamp(g, "-z", 9, 13, 5, RUNE, {"#": C("cyan", 7)})
    # the plate: a gold-rimmed octagon frustum painted with a magic circle
    plate = plan(g, flat_ngon(CX, CZ, 3.8, 8), 12, 15, "gold", 5, top=flat_ngon(CX, CZ, 7.0, 8))
    P.flat(g, plate & seams(g, [g.solids[-1]], 0.6) & (Y < 14.5), "gold", 6)
    top = plate & (Y > 14)
    rr = np.hypot(X - CX, Z - CZ)
    P.flat(g, top & (rr < 6.6), "blue", 4)
    P.flat(g, top & (np.abs(rr - 4.8) < 0.7), "cyan", 6)
    ang = np.arctan2(Z - CZ, X - CX)
    spoke = np.abs(((ang + math.pi) / (math.pi / 3)) % 1 - 0.5) > 0.42
    P.flat(g, top & (rr < 4.1) & spoke, "cyan", 5)
    P.flat(g, top & (rr < 1.3), "cyan", 7)
    return g


def book() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # the back cover and the page block
    back = box(g, BX0, BY, BZ0, BX1, PAGES[0], BZ1, "blue", 4)
    P.mottle(g, back, "blue", 4, cell=3, seed=4)
    pages = box(g, BX0 + 1, PAGES[0], BZ0 + 1, BX1 - 1, PAGES[1], BZ1 - 1, "bone", 6)
    P.flat(g, pages & (np.floor(Y) % 2 == 0), "bone", 5)
    # the open page (seen when the cover swings over): text lines and a cyan circle
    page_top = pages & (Y > PAGES[1] - 1)
    P.flat(g, page_top, "bone", 7)
    Xi, Zi = np.floor(X).astype(int), np.floor(Z).astype(int)
    line = (Zi % 2 == 0) & (Zi > BZ0 + 1) & (Zi < BZ1 - 2) & (Xi > BX0 + 1) & (Xi < CX - 1)
    run = (P._hash(Zi, Xi // 3, seed=7) % np.uint64(4)) != 0
    P.flat(g, page_top & line & run, "wood", 3)
    circle = np.abs(np.hypot(X - (CX + 4.5), Z - CZ) - 3.2) < 0.7
    P.flat(g, page_top & circle, "cyan", 5)
    P.flat(g, page_top & (np.hypot(X - (CX + 4.5), Z - CZ) < 1.2), "cyan", 7)
    # a rounded spine with gold bands
    g.prism("z", [(BX0 - 1.5, BY + 1), (BX0 - 0.5, BY), (BX0 + 1.5, BY), (BX0 + 1.5, TOP), (BX0 - 0.5, TOP), (BX0 - 1.5, TOP - 1)], BZ0, BZ1, C("blue", 3))
    spine = g.solids[-1].mask(S)
    P.flat(g, spine & ((np.abs(Z - (BZ0 + 2.5)) < 0.8) | (np.abs(Z - (BZ1 - 2.5)) < 0.8)), "gold", 5)
    P.flat(g, spine & (np.abs(Z - CZ) < 0.8), "gold", 6)
    return g


def cover() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = box(g, BX0, PAGES[1], BZ0, BX1, TOP, BZ1, "blue", 4)
    P.mottle(g, m, "blue", 4, cell=3, seed=5)
    P.flat(g, m & (Y < PAGES[1] + 1), "red", 4)  # the end paper, seen when open
    P.flat(g, edges(m) & (Y > PAGES[1] + 1), "blue", 3)
    # gold corner caps (3×3) and a gold border line inset on the cover
    corner = ((X < BX0 + 3) | (X > BX1 - 3)) & ((Z < BZ0 + 3) | (Z > BZ1 - 3))
    P.flat(g, m & corner & (Y > PAGES[1] + 1), "gold", 6)
    P.flat(g, m & corner & (Y > PAGES[1] + 1) & ((X < BX0 + 1) | (X > BX1 - 1)) & ((Z < BZ0 + 1) | (Z > BZ1 - 1)), "gold", 7)
    inset = (np.abs(X - CX) < 7.6) & (np.abs(Z - CZ) < 4.6) & ~((np.abs(X - CX) < 6.6) & (np.abs(Z - CZ) < 3.6))
    P.flat(g, m & inset & (Y > TOP - 1) & ~corner, "gold", 4)
    # the sun sigil with a cyan gem, painted on the top (reads from the front)
    stamp(g, "top", TOP, int(CX) - 3, int(CZ) - 3, SUN, {"#": C("gold", 6), "@": C("cyan", 7)})
    # the clasp on the free edge
    clasp = box(g, BX1, PAGES[0] + 1, int(CZ) - 1, BX1 + 1, TOP, int(CZ) + 2, "gold", 5)
    P.flat(g, clasp & (Y > TOP - 1), "gold", 7)
    return g


def sigil() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    cx, cy = CX, SIGIL_Y
    pts = [(cx, cy - 4.5), (cx + 4.5, cy), (cx, cy + 4.5), (cx - 4.5, cy)]
    g.prism("z", pts, CZ - 0.5, CZ + 1.5, C("cyan", 5))
    m = g.solids[-1].mask(S)
    P.flat(g, m & seams(g, [g.solids[-1]], 0.6), "cyan", 7)
    ink = {"#": C("gold", 7)}
    stamp(g, "-z", CZ - 0.5, int(CX) - 2, int(cy) - 2, RUNE, ink)
    stamp(g, "+z", CZ + 1.5, int(CX) - 2, int(cy) - 2, RUNE, ink)
    return g


def build():
    ped, bk, cv, sg = lectern(), book(), cover(), sigil()
    book_pivot = (CX, float(BY), CZ)
    spine = (float(BX0), float(PAGES[1]), CZ)  # the cover hinges on the spine top
    root, to_root = rig([
        ("spell-book", ped, None, None),
        ("book", bk, book_pivot, None),
        ("cover", cv, spine, "book"),
        ("sigil", sg, (CX, SIGIL_Y, CZ), "book"),
    ])
    small = (0.6, 0.6, 0.6)
    hover = keys((0, 0, 0, 0), (1.0, 0, 1.2, 0), (2.0, 0, 0, 0), (3.0, 0, 1.2, 0), (4.0, 0, 0, 0))
    idle = {"book": {"loc": hover, "rot": keys((0, 0, 0, 0), (1.0, 0, 0, 2.5), (2.0, 0, 0, 0), (3.0, 0, 0, -2.5), (4.0, 0, 0, 0))},
            "cover": {"rot": keys((0, 0, 0, 0), (4.0, 0, 0, 0))},
            "sigil": {"rot": turn(4.0, "y", 90), "scale": [(0.0, small), (4.0, small)],
                      "loc": keys((0, 0, -1, 0), (1.0, 0, 0, 0), (2.0, 0, -1, 0), (3.0, 0, 0, 0), (4.0, 0, -1, 0))}}
    open_k = {"cover": {"rot": keys((0, 0, 0, 0), (0.2, 0, 0, 70), (0.4, 0, 0, 150), (0.5, 0, 0, 176), (0.6, 0, 0, 170))},
              "book": {"loc": keys((0, 0, 0, 0), (0.6, 0, 1.5, 0), (1.2, 0, 1.5, 0))},
              "sigil": {"loc": keys((0, 0, -1, 0), (0.3, 0, -1, 0), (0.9, 0, 3, 0), (1.2, 0, 2.5, 0)),
                        "rot": turn(1.2, "y", 300),
                        "scale": [(0.0, small), (0.3, small), (0.9, (1.4, 1.4, 1.4)), (1.2, (1.25, 1.25, 1.25))]}}
    close_k = {"cover": {"rot": keys((0, 0, 0, 170), (0.2, 0, 0, 90), (0.35, 0, 0, 0), (0.42, 0, 0, 6), (0.5, 0, 0, 0))},
               "book": {"loc": keys((0, 0, 1.5, 0), (0.5, 0, 0, 0))},
               "sigil": {"loc": keys((0, 0, 2.5, 0), (0.5, 0, -1, 0)), "scale": [(0.0, (1.25, 1.25, 1.25)), (0.5, small)]}}
    return asset("animated-props", "spell-book", "Floating Spell Book", root,
                 clips=[Clip("idle", idle), Clip("open", open_k, loop=False), Clip("close", close_k, loop=False)],
                 sockets=[Socket("socket-pages", at=to_root((CX, PAGES[1] + 2.0, CZ)), parent="book")],
                 fx=[pfx("rvx-fantasy-arcane-bolt", "socket-pages", "clip:open", size=24, at=0.3)])
