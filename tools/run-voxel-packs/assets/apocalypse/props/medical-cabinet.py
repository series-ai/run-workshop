"""Field medical cabinet, in the Pirate Nation style.

One chunky icon (rule K3): a rusted steel cabinet framed in dark trim, with
an oversized bone cross stencilled on its side so its purpose reads at
thumbnail size (rules F6, C3). Its door hangs open on two visible hinge
barrels (rule F5) and carries a hazard-yellow label and a bar handle.
Inside, three shelves hold a signal-red medkit, bone bandage rolls and a
zombie-teal bottle; one roll has fallen on the dust at the foot. Panels,
rivets, rust and every label are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, child, chips, root, rust_wear, weeds
from pnkit import box, edges, on_face
from pnshapes import coords, disc
from voxgrid import Grid

GW, GH, GD = 30, 34, 22
X0, X1, Z0, Z1 = 4, 24, 4, 18  # the shell
Y0, Y1 = 2, 30  # 30 high: a chest-high cabinet beside the 36-voxel person
T = 3  # the wall thickness


def door() -> Grid:
    """The open door: a plated leaf with a hazard label and a bar handle."""
    w, h = X1 - X0 - 2, Y1 - Y0 - 2
    g = Grid(w, h, 5)
    X, Y, Z = coords(g)
    m = box(g, 0, 0, 0, w, h, 2, "steel", 5)
    P.plates(g, m, "steel", 5, size=(8, 9), seed=2, frame="z")
    P.outline(g, m, "steel", 2, normal="z")
    P.flat(g, m & ((X < 1) | (X > w - 1) | (Y < 1) | (Y > h - 1)), "steel", 3)
    lab = P.region(g, 3, h - 12, 0, w - 3, h - 4, 1)
    P.flat(g, lab, "gold", 6)
    pnpaint.hazard(g, lab & (Y > h - 7), period=4, a=("gold", 7), b=("darkwood", 3), frame="z")
    P.outline(g, lab, "darkwood", 2, normal="z")
    pnglyph.icon(g, "-z", 0, 4, h - 12, "cross", "red", 4)
    for hy in (6, 10):  # the bar handle on two brackets
        box(g, w - 5, hy, 2, w - 3, hy + 2, 4, "steel", 4)
    h_ = box(g, w - 5, 5, 4, w - 3, 13, 5, "steel", 6)
    P.flat(g, h_ & (np.floor(coords(g)[1]) % 3 == 0), "steel", 4)
    chips(g, m, ((2, 4, 0, 3.0), (w - 3, h - 5, 0, 2.6)), "rust", 5, seed=3)
    return g


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    weeds(g, X1 + 1, Z0 + 3, seed=1)
    # the shell: back, both sides, top and bottom, so the inside is open
    shell = box(g, X0, Y0, Z1 - T, X1, Y1, Z1, "steel", 5)
    shell |= box(g, X0, Y0, Z0, X0 + T, Y1, Z1, "steel", 5)
    shell |= box(g, X1 - T, Y0, Z0, X1, Y1, Z1, "steel", 5)
    shell |= box(g, X0, Y1 - T, Z0, X1, Y1, Z1, "steel", 5)
    shell |= box(g, X0, Y0, Z0, X1, Y0 + T, Z1, "steel", 5)
    P.plates(g, shell, "steel", 5, size=(9, 8), seed=4)
    P.flat(g, edges(shell), "steel", 2)
    rust_wear(g, shell, seed=5, shade=5, run=5, grime=4)
    chips(g, shell, ((X0, 10, Z1, 4.2), (X1, 22, Z0 + 4, 3.6), (X0 + 8, Y1, Z1 - 2, 3.4)), "rust", 5, seed=6)
    # four stubby feet and a bone cross stencilled on the +x side
    for fx in (X0 + 1, X1 - 4):
        for fz in (Z0 + 1, Z1 - 4):
            f = box(g, fx, 0, fz, fx + 3, Y0, fz + 3, "darkwood", 3)
            P.flat(g, edges(f), "darkwood", 1)
    pnglyph.icon(g, "+x", X1, Z0 + 3, 16, "cross", "bone", 7, scale=1)
    pnglyph.icon(g, "+z", Z1, X0 + 6, 16, "cross", "bone", 7, scale=1)
    # the inside: a dark back panel and three shelves
    inner = shell & (Z > Z1 - T - 0.5)
    P.flat(g, inner & (X > X0 + T) & (X < X1 - T) & (Y > Y0 + T) & (Y < Y1 - T), "steel", 3)
    shelves = np.zeros(g.shape, dtype=bool)
    for sy in (Y0 + 10, Y0 + 17):
        s = box(g, X0 + T, sy, Z0 + 1, X1 - T, sy + 2, Z1 - T, "steel", 6)
        P.flat(g, s & (Z < Z0 + 2), "steel", 4)
        shelves |= s
    P.flat(g, edges(shelves), "steel", 3)
    # the contents: a red medkit, bone rolls and a teal bottle, all oversized
    kit = box(g, X0 + 4, Y0 + 3, Z0 + 3, X0 + 15, Y0 + 10, Z1 - 4, "red", 5)
    P.plates(g, kit, "red", 5, size=(5, 4), seed=7)
    P.flat(g, edges(kit), "red", 2)
    pnglyph.icon(g, "-z", Z0 + 3, X0 + 6, Y0 + 3, "cross", "bone", 7)
    for k, rx in enumerate((X0 + 4, X0 + 9, X0 + 14)):
        roll = disc(g, "x", float(Y0 + 14.4), float(Z0 + 6), 2.4, rx, rx + 4, "bone", 7)
        P.flat(g, roll & (np.hypot(Y - (Y0 + 14.4), Z - (Z0 + 6)) < 1.0), "bone", 5)
        P.flat(g, roll & (np.floor(X) % 2 == 0), "bone", 6)
        P.outline(g, roll, "darkwood", 3, normal="x")
    bot = box(g, X0 + 5, Y0 + 19, Z0 + 4, X0 + 11, Y0 + 24, Z0 + 10, "teal", 4)
    P.flat(g, bot & (np.floor(Y) % 3 == 0), "teal", 5)
    P.flat(g, edges(bot), "teal", 2)
    box(g, X0 + 7, Y0 + 24, Z0 + 6, X0 + 10, Y0 + 25, Z0 + 9, "gold", 5)
    tin = box(g, X0 + 12, Y0 + 19, Z0 + 4, X1 - 5, Y0 + 23, Z1 - 4, "gold", 6)
    P.flat(g, edges(tin), "darkwood", 3)
    P.flat(g, tin & (Y > Y0 + 22), "gold", 7)
    # a bandage roll fallen in the dust at the foot
    fallen = disc(g, "z", float(X1 + 2), 2.4, 2.4, Z0 + 5, Z0 + 11, "bone", 7)
    P.flat(g, fallen & (np.floor(Z) % 2 == 0), "bone", 6)
    P.grime(g, fallen, height=2, seed=8)
    r = root("medical-cabinet", g)
    for hy in (Y0 + 6, Y1 - 9):  # the two hinge barrels, on the body
        hb = box(g, X0 - 1, hy, Z0 - 1, X0 + 2, hy + 4, Z0 + 2, "steel", 6)
        P.flat(g, edges(hb), "steel", 3)
    child(r, "door", door(), pivot=(0.0, 0.0, 2.0), at_grid=(float(X0), float(Y0 + 1), float(Z0)), rot=(0.0, 72.0, 0.0))
    return asset("medical-cabinet", "Medical Cabinet", r)
