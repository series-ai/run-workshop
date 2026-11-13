"""IBC water tote, in the Pirate Nation style.

One chunky icon (rule K3): a milky tank with bevelled corners (true
slopes), bright blue water showing in its lower half, inside a galvanised cage
of thick bars on a wooden pallet. A brass tap and a hose sit at the front
foot; a hand-painted yellow H2O board hangs on the cage, a little crooked (rule
F5). Water level, seams and the label are paint (rule S1).
"""

import paint as P
import pnglyph
from _props import asset, bevel, child, pallet, root
from pnkit import box
from pnshapes import bar, coords, disc
from voxgrid import Grid

S = 22  # footprint
TY0, TY1 = 4, 24  # tank bottom and top


def build():
    g = Grid(S + 4, TY1 + 4, S + 6)
    X, Y, Z = coords(g)
    oz = 3  # the front of the pallet
    pallet(g, 0, 0, oz, S, S, ramp="sand", base=5, seed=3)
    # the tank: milky plastic with water in its lower half
    tank = bevel(g, "y", 1, oz + 1, S - 1, oz + S - 1, TY0, TY1, "bone", 6, ch=2.0)
    P.mottle(g, tank, "bone", 6, cell=3, seed=1)
    P.flat(g, tank & (Y < 19), "cyan", 4)  # clear blue water: the vivid accent
    P.flat(g, tank & (Y < 8), "cyan", 3)
    P.flat(g, tank & (Y > 18) & (Y < 19), "cyan", 6)
    P.flat(g, tank & (Y < 19) & ((X + Y) % 9 < 1), "cyan", 6)  # glints
    cap = disc(g, "y", S / 2, oz + S / 2, 3.0, TY1, TY1 + 2, "red", 5)
    # the cage: thick bars a voxel proud of every side and over the top
    for x in (1, 10, 20):
        box(g, x, 4, oz, x + 1, TY1 + 1, oz + 1, "steel", 6)
        box(g, x, 4, oz + S - 1, x + 1, TY1 + 1, oz + S, "steel", 6)
    for z in (oz + 1, oz + 10, oz + S - 2):
        box(g, 0, 4, z, 1, TY1 + 1, z + 1, "steel", 6)
        box(g, S - 1, 4, z, S, TY1 + 1, z + 1, "steel", 6)
    for y in (13, TY1):
        box(g, 0, y, oz, S, y + 1, oz + 1, "steel", 5)
        box(g, 0, y, oz + S - 1, S, y + 1, oz + S, "steel", 5)
        box(g, 0, y, oz, 1, y + 1, oz + S, "steel", 5)
        box(g, S - 1, y, oz, S, y + 1, oz + S, "steel", 5)
    box(g, 10, TY1, oz, 11, TY1 + 1, oz + S, "steel", 5)
    # the brass tap at the front foot and a hose to the ground
    box(g, 9, 5, oz - 2, 13, 9, oz, "gold", 5)
    tap = disc(g, "z", 11, 7, 1.4, oz - 3, oz - 2, "gold", 6)
    bar(g, "z", (13, 6), (20, 1), 2.2, oz - 2, oz, "red", 5)
    r = root("water-tank", g)
    # the hand-painted H2O board on the front of the cage
    bg = Grid(20, 10, 1)
    b = box(bg, 0, 0, 0, 20, 10, 1, "gold", 6)  # a hazard-yellow board
    P.planks(bg, b, "gold", 6, width=5, across="y", seed=2)
    P.outline(bg, b, "rust", 3, normal="z")
    tw, _ = pnglyph.text_size("H2O")
    pnglyph.text(bg, "-z", 0, 10 - tw // 2, 2, "H2O", "blue", 3)
    child(r, "label", bg, pivot=(10.0, 10.0, 1.0), at_grid=(S / 2, TY1 - 3, oz), rot=(0.0, 0.0, -5.0))
    return asset("water-tank", "Water Tote", r)
