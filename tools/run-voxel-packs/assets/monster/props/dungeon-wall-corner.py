"""Dungeon wall corner, in the Pirate Nation haunted style (kit piece).

Two by two PN tiles: two runs of the dungeon kit wall (grey blocks, purple
slate plinth and cap courses) meet in an L along the back (+z) and the
left (-x), so plain walls continue flush from either end; the open side
faces -Z and +X (toward the front view). A thick light stone pilaster
fills the inner corner and carries an iron arm with a hanging toxic-green
lantern; a skull niche, two torches and moss finish it.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import KIT_H, KIT_T, damp, dungeon_run, idx, masonry, prop, torch
from pnkit import box
from voxgrid import C, Clip, Grid, Part, sway

N = 32
C0 = N - 1 - KIT_T  # core start of both arms (the plinth reaches N)


def build():
    g = Grid(N, KIT_H + 2, N)
    X, Y, Z = idx(g)
    a = dungeon_run(g, "x", 0, N, C0, seed=1)
    b = dungeon_run(g, "z", 0, N, 1, seed=4)
    # the inner corner pilaster in light stone
    pil = box(g, 1 + KIT_T, 0, C0 - 5, 6 + KIT_T, KIT_H, C0, "gray", 6)
    masonry(g, pil, "gray", 6, block=(5, 4), seed=7)
    # a skull niche in the back arm, a torch on the left arm
    box(g, 19, 18, C0 - 1, 25, 19, C0, "gray", 6)
    pnglyph.stamp(g, "-z", C0, 19, 19, [".####.", "######", "#oo#oo", "##oo##", ".#.#.#"], {"#": C("bone", 6), "o": C("toxic", 5)})
    torch(g, "+x", 1 + KIT_T, 12, 26)
    torch(g, "-z", C0, 26, 30)
    # the iron arm and the hanging lantern at the corner
    ax = 6 + KIT_T  # the pilaster face
    arm = box(g, ax, 38, C0 - 3.5, ax + 4, 40, C0 - 1.5, "iron", 6)
    S.bar(g, "z", (ax, 33), (ax + 4, 38.5), 1.4, C0 - 3, C0 - 2, "iron", 5)
    damp(g, a["core"] | b["core"] | a["plinth"] | b["plinth"], seed=9)
    lg = Grid(14, 22, 14)
    info = S.lantern(lg, 7, 0, 7, s=6, body=8, glass="toxic", roof="purple", frame="stone", seed=10)
    root = prop("dungeon-wall-corner", "Dungeon Wall Corner", g)
    piv = root.root.pivot
    hang = (7.0, float(info["top"]), 7.0)
    root.root.add(Part("lantern", lg, pivot=hang, at=(ax + 3.5 - piv[0], 38 - piv[1], C0 - 2.5 - piv[2]), rot=(4.0, 0.0, -3.0)))
    root.clips.append(Clip("idle", {"lantern": {"rot": sway(3.2, amp=(2.0, 0.0, 3.5), phase=(1.4, 0.0, 0.0))}}))
    return root
