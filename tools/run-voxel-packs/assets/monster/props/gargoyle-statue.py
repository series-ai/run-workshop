"""Gargoyle statue, in the Pirate Nation haunted style.

A chunky caricature (rule F4) crouched on a chamfered stone pedestal: a
big horned head with pointed ears, a jutting jaw with painted fangs and
glowing toxic-green eyes, a hunched body leaning forward, thick forelegs
gripping the front edge with claws over the ledge, crouched hind legs,
folded bat wings (true triangular slopes) and a curling tail. It guards a glowing toxic orb; the pedestal is dark
haunted stone with a gold-framed purple plaque and a glowing skull. Grey
stone with light lit tops, moss clumps and glowing eyes (PN haunted
stone). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import idx, masonry, plinth, prop, union
from pnkit import box
from voxgrid import C, Grid

ST = "gray"


def build():
    g = Grid(26, 40, 22)
    X, Y, Z = idx(g)
    cx = 13
    plinth(g, cx - 9, 3, cx + 9, 19, 0, 4, "stone", 4, bevel=1, seed=1)
    ped = box(g, cx - 8, 4, 4, cx + 8, 11, 18, "stone", 5)
    masonry(g, ped, "stone", 5, block=(6, 4), seed=2)
    masonry(g, box(g, cx - 9, 11, 3, cx + 9, 13, 19, ST, 5), ST, 5, block=(6, 2), seed=3)
    y0 = 13
    start = len(g.solids)
    # hind legs (crouched blocks) and the hunched body leaning forward
    for s in (-1, 1):
        box(g, cx + s * 5 - 2.5, y0, 10, cx + s * 5 + 2.5, y0 + 6, 17, ST, 5)
        box(g, cx + s * 5 - 2.5, y0, 7, cx + s * 5 + 2.5, y0 + 2, 11, ST, 5)
    g.prism("x", [(y0 + 3, 16), (y0 + 3, 9), (y0 + 14, 7), (y0 + 16, 12), (y0 + 12, 17)], cx - 6, cx + 6, C(ST, 5))
    # forelegs down to the front edge, claws over the ledge
    for s in (-1, 1):
        S.bar(g, "x", (y0 + 11, 8), (y0, 5), 3.4, cx + s * 4 - 1.7, cx + s * 4 + 1.7, ST, 5)
        for k in (-1, 0, 1):
            fx = round(cx + s * 4 + k * 1.2) + 0.5
            S.bar(g, "x", (y0 + 1, 4.5), (y0 - 2, 2.2), 1.6, fx - 0.5, fx + 0.5, "bone", 5)
    # the big head: skull box, jutting jaw, horns, ears
    head = box(g, cx - 5, y0 + 13, 3, cx + 5, y0 + 21, 11, ST, 6)
    jaw = box(g, cx - 4, y0 + 11, 2, cx + 4, y0 + 14, 9, ST, 5)
    hs = len(g.solids)
    for s in (-1, 1):
        S.bar(g, "z", (cx + s * 4, y0 + 20), (cx + s * 8, y0 + 26), 2.4, 6, 8, "bone", 5)
        g.prism("z", [(cx + s * 5, y0 + 15), (cx + s * 5, y0 + 19), (cx + s * 9, y0 + 20)], 6.5, 8, C(ST, 6))
    # folded wings: two tall triangles rising behind the shoulders
    ws = len(g.solids)
    for s in (-1, 1):
        g.prism("x", [(y0 + 10, 11), (y0 + 12, 18), (y0 + 25, 16)], cx + s * 5 - 1, cx + s * 5 + 1, C(ST, 4))
        g.prism("z", [(cx + s * 3, y0 + 9), (cx + s * 10.5, y0 + 12), (cx + s * 7, y0 + 26)], 12, 16, C(ST, 4))
    we = len(g.solids)
    # the tail curling down the back of the pedestal
    S.bar(g, "x", (y0 + 3, 17), (y0 - 3, 20), 2.0, cx - 1, cx + 1, ST, 5)
    S.bar(g, "x", (y0 - 3, 20), (y0 - 7, 19.5), 1.8, cx - 1, cx + 1, ST, 5)
    g.prism("x", [(y0 - 7, 18.5), (y0 - 7, 20.5), (y0 - 10, 19.5)], cx - 1.5, cx + 1.5, C(ST, 5))
    body = union(g, start) | head | jaw
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, ST, 5, block=(5, 4), cracks=0.0, frame=fr, seed=4))
    P.stone(g, head, ST, 6, block=(5, 4), cracks=0.0, seed=5)
    horns = np.zeros(g.shape, dtype=bool)
    for k in (0, 2):
        horns |= g.solids[hs + k].mask(g.shape)
    P.flat(g, horns, "bone", 5)
    P.flat(g, horns & (Y > y0 + 24), "bone", 7)
    wing = union(g, ws) & ~union(g, we)
    P.flat(g, wing, ST, 4)
    P.flat(g, wing & ((Y + Z) % 4 == 0), ST, 3)
    P.flat(g, wing & S.seams(g, g.solids[ws:we], 0.9), ST, 7)
    # the face: brow, glowing eyes, nostrils, fangs
    face = head & (Z == 3)
    P.flat(g, face & (Y == y0 + 18), ST, 3)
    for s in (-1, 1):
        eye = face & (np.abs(X + 0.5 - (cx + s * 2.5)) < 1.1) & (Y >= y0 + 16) & (Y < y0 + 18)
        P.flat(g, eye, "toxic", 6)
        P.flat(g, eye & (Y == y0 + 17), "toxic", 7)
    P.flat(g, face & (Y == y0 + 14) & ((X == cx - 1) | (X == cx)), ST, 2)
    fang = jaw & (Z == 2) & (Y == y0 + 13)
    P.flat(g, fang, ST, 2)
    P.flat(g, fang & ((X == cx - 3) | (X == cx + 2)), "bone", 7)
    P.flat(g, jaw & (Z == 2) & (Y == y0 + 12) & ((X == cx - 3) | (X == cx + 2)), "bone", 7)
    # a purple plaque with a glowing skull on the pedestal, moss at its foot
    plaque = box(g, cx - 5, 5, 3, cx + 5, 10, 4, "purple", 2)
    P.flat(g, plaque & ((X == cx - 5) | (X == cx + 4) | (Y == 5) | (Y == 9)), "gold", 4)
    sk = [".###.", "#####", "#o#o#", ".###."]
    pnglyph.stamp(g, "-z", 3, cx - 2, 5, sk, {"#": C("toxic", 6), "o": C("purple", 1)})
    from pnpaint import blotch

    blotch(g, (g.a > 0) & (Y < 4), "moss", 5, cell=2, chance=0.2, seed=6)
    # light stone on the lit tops, moss in clumps on them
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    stone_now = np.isin(g.a, [C(ST, k) for k in range(1, 8)] + [C("stone", k) for k in range(8)])
    P.flat(g, (body | wing) & up & stone_now, ST, 7)
    blotch(g, body & ~horns & up, "moss", 5, cell=3, chance=0.1, seed=7)
    blotch(g, wing & up, "moss", 6, cell=2, chance=0.08, seed=8)
    # a glowing toxic orb held between the forelegs
    orb = S.dome(g, cx, 5.5, y0, 2.6, h=4.5, n=8, rings=2, ramp="toxic", base=6, painter=lambda gg, mm, fr: P.flat(gg, mm, "toxic", 6), ribs=("toxic", 5))
    P.flat(g, orb & (Y >= y0 + 3), "toxic", 7)
    return prop("gargoyle-statue", "Gargoyle Statue", g)
