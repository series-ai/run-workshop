"""Rubble pile, in the Pirate Nation style.

A broad cracked road slab has settled into dusty sand. A smaller broken
plate rests on it, with two short pieces of bent rebar at its torn edge.
Two low brick fragments sit behind the concrete. A leaning warning sign
marks the wreck with a teal field and a clear skull emblem. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
from _life import Rig, ctr, front, limb, make, plan, rock, slab
from pnkit import box
from voxgrid import Grid

SZ = (42, 34, 38)


def pile() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)

    # The low sand mound gives the debris one shared footing.
    mound = rock(g, 21, 20, 0, 18, 15, 9, ramp="sand", shade=4,
                 shrink=0.45, lean=(-1, 1), n=10, seed=1)
    P.mottle(g, mound, "sand", 4, cell=4, seed=2)

    # One thick road fragment leans across the mound. The low edge is sunk
    # into the sand and the raised edge keeps the broken profile readable.
    lower = slab(g, "z", 18, 7, 20, 7, 12, 26, 12, "stone", 5)
    PP.concrete(g, lower, "stone", 5, size=8, cracks=4, seed=4)
    P.outline(g, lower, "steel", 3, normal="z")
    PP.blotch(g, lower, "rust", 4, cell=5, chance=0.035, seed=5)

    # Painted detail follows the sloped upper face: a broken crack, a
    # bolted steel patch, and one rust bloom.
    top_y = 7 + (X - 18) * np.sin(np.radians(12)) + 3.5 * np.cos(np.radians(12))
    top_face = lower & (np.abs(Y - top_y) < 1.25)
    crack = top_face & (X > 16) & (X < 25) & (np.abs(Z - (14 + 0.75 * (X - 16))) < 0.65)
    branch = top_face & (X > 20) & (X < 25) & (np.abs(Z - (19 + 1.2 * (X - 20))) < 0.65)
    P.flat(g, crack | branch, "stone", 2)
    patch = top_face & (X >= 11) & (X < 16) & (Z >= 17) & (Z < 22)
    P.flat(g, patch, "steel", 4)
    P.outline(g, patch, "darkwood", 3, normal="y")
    for px, pz in ((11, 17), (14, 17), (11, 20), (14, 20)):
        rivet = top_face & (np.abs(X - (px + 0.5)) < 0.6) & (np.abs(Z - (pz + 0.5)) < 0.6)
        P.flat(g, rivet, "steel", 7)
    rust = top_face & (X >= 22) & (X < 25) & (Z >= 13) & (Z < 16)
    P.flat(g, rust, "rust", 5)

    # Bent rebar rises from the exposed, uphill edge of the slab.
    # The roots enter the concrete and the bends project beyond its edge.
    for px, py, pz, dx in ((14, 9.8, 14, -3), (24, 11.5, 22, 3)):
        limb(g, (px, py, pz), (px, py + 4.5, pz), 0.65, 0.55,
             "steel", 4, n=4)
        limb(g, (px, py + 4.0, pz), (px + dx, py + 5.6, pz + 1), 0.55, 0.4,
             "steel", 3, n=4)

    # Two low, separated brick fragments have uneven breaks and missing
    # sections. Their feet remain buried in the mound.
    left_wall = front(g, [(7, 0), (15, 0), (15, 7), (13, 9),
                          (11, 7), (9, 12), (7, 10)], 28, 32, "red", 4)
    right_wall = front(g, [(20, 0), (29, 0), (29, 8), (26, 10),
                           (24, 8), (22, 11), (20, 8)], 28, 32, "red", 4)
    wall = left_wall | right_wall
    P.stone(g, wall, "rust", 4, block=(4, 2), cracks=0.08, seed=8)
    P.flat(g, wall & (Y < 4), "sand", 4)
    P.flat(g, wall & (np.floor(Z) == 28) & (X >= 8) & (X < 13)
           & (Y >= 5) & (Y < 7), "red", 4)
    P.flat(g, wall & (X >= 24) & (X < 27) & (Y > 8) & (Y < 11),
           "stone", 3)

    # Only a few stones remain visible. Each one is partly sunk in the sand.
    for k, (bx, bz) in enumerate(((7, 11), (34, 25), (32, 12))):
        rock(g, bx, bz, 0, 2.2, 1.8, 2.2, ramp="stone", shade=5,
             shrink=0.55, n=5, seed=12 + k)
    return g


def sign() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)

    # The rust foot and steel post are fixed behind the concrete stack.
    foot = box(g, 30, 5, 22, 36, 9, 27, "rust", 5)
    P.outline(g, foot, "steel", 3, normal="z")
    P.flat(g, foot & (np.floor(Y) == 6) & (np.floor(Z) == 22), "gold", 5)
    limb(g, (33, 7, 24), (33, 27, 24), 1.5, 1.3,
         "steel", 5, n=4)

    # Dark timber frames a steel warning plate. The teal field and skull
    # are painted on both visible faces.
    frame = box(g, 24, 22, 22, 42, 34, 26, "darkwood", 3)
    back = frame & (X > 26) & (X < 40) & (Y >= 24) & (Y < 32) & (np.floor(Z) == 25)
    P.flat(g, back, "teal", 4)
    plate = box(g, 25, 23, 21, 41, 33, 24, "steel", 5)
    P.plates(g, plate, "steel", 5, size=(5, 4), frame="z", seed=10)
    P.outline(g, plate, "darkwood", 2, normal="z")
    field = plate & (X > 26) & (X < 40) & (Y >= 24) & (Y < 32)
    P.flat(g, field & (np.floor(Z) == 21), "teal", 4)
    G.icon(g, "-z", 21, 29, 24, "skull", "bone", 7, depth=2)
    G.icon(g, "+z", 26, 29, 24, "skull", "bone", 7, depth=2)

    # Yellow corner blocks make the warning frame read at a small size.
    for x0 in (26, 38):
        for y0 in (24, 30):
            P.flat(g, plate & (np.floor(Z) == 21) & (X >= x0) & (X < x0 + 2)
                   & (Y >= y0) & (Y < y0 + 2), "gold", 6)
            P.flat(g, back & (X >= x0) & (X < x0 + 2)
                   & (Y >= y0) & (Y < y0 + 2), "gold", 6)
    return g


def build():
    rig = Rig("rubble-pile", (21, 0, 20), pile())
    rig.add("sign", sign(), (33, 7, 24), rot=(8, 0, -14))
    return make("terrain-nature", "rubble-pile", "Rubble Pile", rig.root)
