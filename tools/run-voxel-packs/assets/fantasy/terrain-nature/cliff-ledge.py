"""Cliff ledge in the Pirate Nation style.

A rock outcrop with a real ledge: a broad flat shelf 20 high (a person
stands on it, half their height above the turf) juts out in front of a
vertical cliff face that rises 28 more behind it. The faces are bedded
rock with a few cracks (rule S1); the cliff crown is a sloped cap (true
slopes, rule F2) with a grass blanket and a small bush. Three rough rock
steps climb to the shelf on the right. A spring seeps out of a crack in
the cliff face, crosses the shelf in a shallow rill and spills over the
front edge into a small pool (the waterfall-mist PFX plays there; rule C3).
About 60 wide and 52 tall. Faces -Z.
"""
import numpy as np

import paint as P
from _fterrain import fern, ground, moss_drape, noise, outline, ramp_paint, rock, rounded_rock, shrink_mask
from _kit import prop
from _life import coords, grass, leaf_block, plan
from voxgrid import Grid

SZ = (68, 60, 60)
CX, CZ = 33.0, 30.0
G = 2  # the turf top
SHELF = 20  # the shelf top
CLIFF = 47  # the cliff top
FACE_Z = 36  # the vertical cliff face
SEEP_X = 28.0  # where the spring runs


def build():
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    ground(g, outline(CX, CZ, 31.0, 26.0, 16, seed=21, wobble=0.10, turn=0.4), CX, CZ, seed=21, top_y=G, cell=8.0)

    # the cliff: the front face stays vertical, the sides and back slope in
    base = [(6, FACE_Z), (22, FACE_Z - 1), (40, FACE_Z), (58, FACE_Z - 1), (61, 44), (56, 53), (40, 55), (20, 54), (8, 50), (4, 42)]
    top = [(8, FACE_Z), (22, FACE_Z - 1), (40, FACE_Z), (55, FACE_Z - 1), (57, 44), (53, 50), (40, 51), (21, 51), (10, 48), (7, 42)]
    start = len(g.solids)
    cliff = plan(g, base, 1, CLIFF, "stone", 4, top=top)
    # the crown: a sloped cap set back from the face, higher on the left
    crown_lo = [(9, FACE_Z + 2), (30, FACE_Z + 2), (44, FACE_Z + 3), (52, 44), (40, 50), (20, 50), (10, 47)]
    crown_hi = [(13, FACE_Z + 6), (27, FACE_Z + 6), (36, FACE_Z + 8), (40, 45), (32, 47), (19, 47), (13, 45)]
    crown = plan(g, crown_lo, CLIFF, CLIFF + 6, "stone", 4, top=crown_hi)
    rock(g, g.solids[start:], seed=22, base=3, top_ramp=("stone", 4), strata=5)
    cap = cliff | crown
    moss_drape(g, cap, CLIFF - 2.5, seed=23, cx=32, cz=44, tongue=5.0)

    # the shelf: a flat walkable top, a near-vertical front face
    s_base = [(5, 13), (20, 11), (36, 12), (50, 14), (52, 24), (51, FACE_Z + 1), (6, FACE_Z + 1), (3, 24)]
    s_top = [(6, 14.5), (20, 12.5), (36, 13.5), (49, 15.5), (50.5, 24), (50, FACE_Z + 1), (7, FACE_Z + 1), (4.5, 24)]
    start = len(g.solids)
    shelf = plan(g, s_base, 1, SHELF, "stone", 4, top=s_top)
    rock(g, g.solids[start:], seed=24, base=3, top_ramp=("stone", 4), strata=4)
    deck = shelf & (Y > SHELF - 1)
    ramp_paint(g, deck, "leaf", (3, 4, 4, 5), 6.0, 25)
    P.flat(g, deck & (noise(X, Z, 9.0, 26) > 0.66), "moss", 5)
    # a worn earth path from the steps to the spring
    path = deck & (np.abs(Z - (22 + (X - 50) * -0.12)) < 3.2 + noise(X, Z, 3.0, 27) * 1.5) & (X > SEEP_X - 2)
    P.flat(g, path, "wood", 5)
    P.flat(g, path & (noise(X, Z, 2.5, 28) > 0.6), "wood", 4)
    P.flat(g, deck & ~shrink_mask(g, deck, 1), "moss", 4)  # the turf lip on the shelf edge
    P.flat(g, shelf & (Y < 3), "stone", 2)  # the damp foot

    # three rough rock steps up the right side
    for k, (x0, x1, z0, z1, h) in enumerate(((52, 64, 15, 29, 7), (49, 60, 16, 28, 13), (46, 55, 16.5, 27.5, SHELF - 0.5))):
        st = len(g.solids)
        pts = [(x0 + 1.5, z0 + 0.5), (x1 - 3, z0), (x1, z0 + 3), (x1 - 0.5, z1 - 3), (x1 - 3.5, z1), (x0 + 2, z1 - 0.5), (x0, z1 - 4), (x0 - 0.5, z0 + 4)]
        tp = [(x0 + 2.5, z0 + 1.5), (x1 - 3.5, z0 + 1), (x1 - 1.5, z0 + 3.5), (x1 - 2, z1 - 3.5), (x1 - 4, z1 - 1.5), (x0 + 2.5, z1 - 1.5), (x0 + 1, z1 - 4.5), (x0 + 0.5, z0 + 4)]
        sm = plan(g, pts, 1, h, "stone", 4, top=tp)
        rock(g, g.solids[st:], seed=30 + k, base=4, top_ramp=("stone", 5), strata=3)
        P.flat(g, sm & (Y > h - 1) & (noise(X, Z, 3.0, 33 + k) > 0.55), "wood", 5)  # trodden earth

    # the spring: a seep down the cliff face, a rill over the shelf, a spill to a pool
    face = (cliff | crown) & (np.abs(X - SEEP_X - 0.5 * np.sin(Y * 0.5)) < 2.2) & (Z < FACE_Z + 1.5) & (Y > SHELF) & (Y < CLIFF - 6)
    P.flat(g, face, "sky", 4)
    P.flat(g, face & (np.floor(Y).astype(int) % 4 == 0), "sky", 6)
    P.flat(g, (cliff | crown) & (np.abs(X - SEEP_X) < 3.5) & (np.abs(Y - (CLIFF - 6)) < 1.5) & (Z < FACE_Z + 1.5), "stone", 1)  # the crack
    rill = deck & (np.abs(X - SEEP_X - (FACE_Z - Z) * 0.08) < 2.0)
    P.flat(g, rill, "sky", 5)
    P.flat(g, rill & (np.floor(Z).astype(int) % 5 == 0), "cyan", 6)
    spill = shelf & (np.abs(X - SEEP_X - 2) < 2.2) & (Z < 16) & (Y < SHELF)
    P.flat(g, spill, "sky", 5)
    P.flat(g, spill & (np.floor(X).astype(int) % 2 == 0), "sky", 7)
    pool = plan(g, outline(SEEP_X + 2, 8.5, 6.5, 3.6, 10, seed=35, wobble=0.1), G - 0.5, G + 0.4, "sky", 4)
    P.flat(g, pool & (np.hypot(X - SEEP_X - 2, (Z - 10.5) * 1.5) < 2.5), "bone", 7)  # foam
    P.flat(g, pool & ((np.floor(np.hypot(X - SEEP_X - 2, (Z - 9) * 1.5)) % 3) == 0), "sky", 6)

    # the crown bush and the life round the foot
    leaf_block(g, 17, CLIFF + 8, 45, 12, 8, 10, "forest", 5, bevel=2.5, lean=(-0.8, 0.4), seed=40)
    leaf_block(g, 25, CLIFF + 7.5, 47, 9, 6, 8, "leaf", 4, bevel=2.0, seed=41)
    for k, (bx, bz, r, h) in enumerate(((8.5, 9.5, 4.2, 6.5), (55, 9, 3.4, 5.0), (62, 35, 4.0, 7.0))):
        bm, bs = rounded_rock(g, bx, bz, G - 1, r, h, n=8, seed=50 + k, squash=(1.1, 0.9))
        rock(g, bs, seed=50 + k, base=3, top_ramp=("stone", 4))
        moss_drape(g, bm, G - 1 + h * 0.7, seed=55 + k, cx=bx, cz=bz, tongue=1.5)
    fern(g, 14.5, SHELF, 31.5, 4.5, "forest", 5, turn=1)
    fern(g, 40.5, SHELF, 32.5, 4.0, "leaf", 4, turn=3)
    fern(g, 17.5, G, 8.5, 4.5, "forest", 5, turn=0)
    grass(g, [(9, SHELF, 22), (36, SHELF, 17), (44, G, 8), (22, G, 6), (38, G, 7), (13, G, 15)], "leaf", 5)
    return prop("fantasy-terrain-nature-cliff-ledge", "Cliff Ledge", g,
                sockets_at={"socket-function": (SEEP_X + 2, G + 4.0, 10.0)},
                pfx=[{"effectId": "rvx-fantasy-waterfall-mist", "socket": "socket-function", "trigger": "idle", "size": 14}])
