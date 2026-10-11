"""Scrap workbench, in the Pirate Nation style.

A person-size icon (rules K1, K3): a plank top with a dark frame on steel
legs, a pegboard behind it and a loaded lower shelf. The pegboard is
painted on both sides: a hole grid and oversized tools in front, board
seams, cross battens and rust streaks behind. A chunky vise is the
function prop (rule F4); a hazard-yellow jerry can and a zombie-teal
toolbox brighten the lower shelf (rule C3). Grain, holes, rivets and rust
are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, chips, crate, jerry_can, root, rust_runs, seam_rust
from pnkit import box, edges
from pnshapes import bar, coords, disc
from voxgrid import Grid

GW, GH, GD = 44, 40, 24
X0, X1, Z0, Z1 = 2, 42, 3, 19
TOP = 15  # the bench top: the work surface is at 19 (table top 14-20)
BOARD = 35  # the pegboard top


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    # the steel legs, stretchers and gussets
    steel = np.zeros(g.shape, dtype=bool)
    for lx in (X0 + 1, X1 - 5):
        for lz in (Z0 + 1, Z1 - 5):
            steel |= box(g, lx, 0, lz, lx + 4, TOP, lz + 4, "steel", 5)
        steel |= box(g, lx, 6, Z0 + 1, lx + 4, 9, Z1 - 1, "steel", 4)
    steel |= box(g, X0 + 1, 6, Z0 + 2, X1 - 1, 9, Z0 + 5, "steel", 4)
    shelf = box(g, X0 + 2, 9, Z0 + 1, X1 - 2, 11, Z1 - 1, "steel", 4)
    P.plates(g, shelf, "steel", 4, size=(7, 5), seed=2, frame="top")
    steel |= shelf
    P.flat(g, steel, "steel", 5)
    P.flat(g, steel & (Z < Z0 + 2), "steel", 6)  # the lit front of every leg
    P.flat(g, edges(steel), "steel", 2)
    seam_rust(g, steel, (8, 10), shade=4)  # rust gathers on the stretcher joints
    rust_runs(g, steel, ((X0 + 1, 6, Z0 + 1, 3.0), (X1 - 1, 5, Z1 - 1, 2.8)), base=5, drip=5, seed=5)
    # the plank top with a dark frame and a painted tool shadow
    top = box(g, X0, TOP, Z0, X1, TOP + 4, Z1, "wood", 6)
    P.planks(g, top, "wood", 6, width=5, across="z", length=(22, 30), nails=False, grain=False, seed=6, frame="top")
    P.flat(g, edges(top), "darkwood", 2)
    P.flat(g, top & (Y > TOP + 3) & (np.hypot(X - 26, Z - 11) < 3.4), "darkwood", 4)  # one oil stain
    P.outline(g, top & (Y > TOP + 3) & (np.hypot(X - 26, Z - 11) < 3.4), "darkwood", 3, normal="y")
    # the pegboard: holes and tools in front, battens and rust behind
    bd = box(g, X0 + 2, TOP + 4, Z1 - 4, X1 - 2, BOARD, Z1 - 1, "wood", 6)
    P.planks(g, bd, "wood", 6, width=5, across="y", length=(22, 30), nails=False, seed=8)
    P.flat(g, edges(bd), "darkwood", 2)
    front = bd & (Z < Z1 - 3)
    P.flat(g, front & (np.floor(X) % 4 == 1) & (np.floor(Y) % 4 == 1), "darkwood", 2)  # the hole grid
    back = bd & (Z > Z1 - 2)
    for bx in (X0 + 5, 21, X1 - 9):  # the cross battens behind
        bt = back & (np.abs(X - bx) < 2)
        P.flat(g, bt, "darkwood", 4)
        P.outline(g, bt, "darkwood", 2, normal="z")
    for by in (TOP + 7, BOARD - 4):
        rl = back & (np.abs(Y - by) < 1.6)
        P.flat(g, rl, "darkwood", 4)
        P.outline(g, rl, "darkwood", 2, normal="z")
    for sx in (X0 + 6, 24):  # two rust streaks, each under a batten
        P.flat(g, back & (np.abs(X - sx) < 1.1) & (Y < TOP + 13), "rust", 4)
    pnpaint.hazard(g, back & (Y > BOARD - 4), period=8, a=("gold", 4), b=("darkwood", 2), frame="z")
    chips(g, back, ((X1 - 8, TOP + 9, Z1 - 1, 3.0),), "rust", 4, seed=9)
    # the oversized tools hung on the pegboard, each on a visible peg
    for px, py in ((8, BOARD - 10), (16, BOARD - 9), (26, BOARD - 11)):
        box(g, px, py + 5, Z1 - 5, px + 2, py + 7, Z1 - 3, "steel", 6)
    ham = box(g, 7, BOARD - 16, Z1 - 6, 10, BOARD - 5, Z1 - 4, "red", 5)  # a hammer
    P.flat(g, ham & (np.floor(Y) % 3 == 0), "red", 3)
    box(g, 4, BOARD - 7, Z1 - 7, 13, BOARD - 4, Z1 - 3, "steel", 5)
    P.flat(g, edges(ham), "red", 2)
    wr = box(g, 15, BOARD - 17, Z1 - 6, 18, BOARD - 4, Z1 - 4, "gold", 6)  # a wrench
    P.flat(g, wr & (Y > BOARD - 8), "gold", 7)
    P.flat(g, wr & (Y < BOARD - 14), "gold", 4)
    P.flat(g, edges(wr), "darkwood", 3)
    sp = box(g, 25, BOARD - 18, Z1 - 6, 28, BOARD - 6, Z1 - 4, "teal", 5)  # a teal spanner
    P.flat(g, sp & (Y > BOARD - 9), "teal", 6)
    P.flat(g, edges(sp), "teal", 2)
    tw, _ = pnglyph.text_size("FIX")
    pnglyph.text(g, "-z", Z1 - 4, X1 - 14, BOARD - 9, "FIX", "gold", 6)
    # the vise bolted to the top, the hero prop
    vb = box(g, 32, TOP + 4, Z0 + 4, 40, TOP + 8, Z0 + 12, "steel", 5)
    P.plates(g, vb, "steel", 5, size=(4, 4), seed=10)
    P.flat(g, edges(vb), "steel", 2)
    for jz in (Z0 + 4, Z0 + 9):
        jaw = box(g, 33, TOP + 8, jz, 39, TOP + 13, jz + 3, "steel", 6)
        P.flat(g, jaw & (np.floor(X) % 2 == 0), "steel", 4)
        P.flat(g, edges(jaw), "steel", 3)
    scr = bar(g, "x", (float(TOP + 10), float(Z0 + 2)), (float(TOP + 10), float(Z0 + 14)), 1.3, 35, 38, "steel", 6)
    P.flat(g, scr & (np.floor(Z) % 2 == 0), "steel", 4)
    hand = disc(g, "z", 36.5, float(TOP + 10), 2.6, Z0 + 1, Z0 + 2, "red", 5)
    P.outline(g, hand, "red", 2, normal="z")
    # the jerry can stands on the bench top, clear of the pegboard
    jerry_can(g, 4, TOP + 4, Z0 + 2, w=11, h=14, d=7, ramp="gold", base=4, seed=11)
    # the lower shelf: a plank crate and a teal toolbox
    cr = crate(g, 4, 11, Z0 + 3, 13, 4, 12, ramp="sand", base=5, frame=("rust", 3), seed=13)
    P.grime(g, cr, height=2, seed=14)
    tb = box(g, 20, 11, Z0 + 4, 34, 14, Z1 - 3, "teal", 4)
    P.plates(g, tb, "teal", 4, size=(6, 4), rivets=False, seed=12)
    P.flat(g, edges(tb), "teal", 2)
    P.flat(g, tb & (Y > 13), "teal", 5)
    return asset("scrap-workbench", "Scrap Workbench", root("scrap-workbench", g))
