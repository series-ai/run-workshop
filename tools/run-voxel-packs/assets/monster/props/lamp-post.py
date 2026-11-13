"""Gothic lamp post, in the Pirate Nation haunted style.

After PN decorations-deco-lamp-zombie (16×60): a thick iron post on a
chamfered stone foot, a gallows arm with a true diagonal brace, and an
oversized square lantern (toxic-green panes, a painted flame, a steep
purple tiled cap) hanging from a short chain at a slight tilt (rule F5).
A chunky bat perches on the arm end and a spiked cross tops the post.
About 58 tall. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _props import chain, idx, plinth, prop, tufts
from pnkit import box
from voxgrid import C, Clip, Grid, Part, sway

PX, PZ = 7, 9  # post centre
ARM_Y, ARM_X = 48, 27
LX = 22  # lantern centre x
TILT = -5.0


def post() -> Grid:
    g = Grid(34, 62, 18)
    X, Y, Z = idx(g)
    plinth(g, PX - 6, PZ - 6, PX + 6, PZ + 6, 0, 4, "gray", 4, bevel=1.5, seed=1)
    base = box(g, PX - 3, 4, PZ - 3, PX + 3, 9, PZ + 3, "gray", 5)
    P.stone(g, base, "gray", 5, block=(3, 3), seed=2)
    shaft = box(g, PX - 2, 9, PZ - 2, PX + 2, 55, PZ + 2, "iron", 6)
    P.flat(g, shaft & ((X == PX - 2) | (Z == PZ - 2)), "iron", 7)
    for by in (16, 30, 44):
        box(g, PX - 3, by, PZ - 3, PX + 3, by + 2, PZ + 3, "iron", 5)
    # a spiked cross on top
    box(g, PX - 3, 55, PZ - 3, PX + 3, 57, PZ + 3, "iron", 5)
    box(g, PX - 1, 57, PZ - 1, PX + 1, 62, PZ + 1, "gold", 4)
    box(g, PX - 3, 59, PZ - 1, PX + 3, 60.5, PZ + 1, "gold", 4)
    # the arm, its end block and a true diagonal brace
    arm = box(g, PX + 2, ARM_Y, PZ - 1.5, ARM_X, ARM_Y + 3, PZ + 1.5, "iron", 6)
    P.flat(g, arm & (Y == ARM_Y + 2), "iron", 7)
    box(g, ARM_X - 1, ARM_Y - 1, PZ - 2, ARM_X + 2, ARM_Y + 4, PZ + 2, "iron", 5)
    S.bar(g, "z", (PX + 2, ARM_Y - 10), (PX + 12, ARM_Y), 2.0, PZ - 1, PZ + 1, "iron", 5)
    S.bar(g, "z", (PX + 12, ARM_Y), (PX + 15, ARM_Y + 3.5), 1.6, PZ - 0.8, PZ + 0.8, "iron", 6)  # scroll tip
    # the bat on the arm end: a round body, big ears, spread wings (true slopes)
    bx = ARM_X - 1
    body = box(g, bx - 2, ARM_Y + 4, PZ - 2, bx + 2, ARM_Y + 9, PZ + 2, "purple", 3)
    head = box(g, bx - 2, ARM_Y + 9, PZ - 2, bx + 2, ARM_Y + 12, PZ + 2, "purple", 4)
    for s in (-1, 1):
        g.prism("z", [(bx + s * 1.5, ARM_Y + 11), (bx + s * 0.2, ARM_Y + 11.5), (bx + s * 2, ARM_Y + 14)], PZ - 0.5, PZ + 0.5, C("purple", 4))
        g.prism("x", [(ARM_Y + 5, PZ), (ARM_Y + 9, PZ), (ARM_Y + 12, PZ + s * 6), (ARM_Y + 7, PZ + s * 5), (ARM_Y + 5, PZ + s * 6)], bx - 0.5, bx + 0.5, C("purple", 3))
    P.flat(g, head & (Z == PZ - 2) & (Y == ARM_Y + 10) & (X != bx) & (X != bx - 1), "magenta", 7)
    P.flat(g, body & (Z == PZ - 2) & (Y < ARM_Y + 8) & (np.abs(X + 0.5 - bx) < 1.1), "purple", 5)
    # the chain down to the lantern ring
    chain(g, LX, PZ, ARM_Y, 2, "iron", 6)
    tufts(g, [(PX - 7, PZ - 7), (PX + 6, PZ + 7), (PX + 7, PZ - 6)])
    return g


def build():
    g = post()
    lg = Grid(16, 26, 16)
    info = S.lantern(lg, 8, 0, 8, s=8, body=10, glass="toxic", roof="purple", frame="stone", seed=5)
    # a cursed green flame in the green panes (the kit paints an orange one)
    glass = info["panes"] & (lg.a != C("stone", 3))
    P.flat(lg, glass, "toxic", 4)
    S.flame(lg, glass, 8, 8, 1.2 + 3, 10 - 2.4, 8 * 0.8, outer=("toxic", 6), inner=("bone", 7), rim=("toxic", 7))
    root = prop("lamp-post", "Gothic Lamp Post", g)
    piv = root.root.pivot
    hang = (8.0, float(info["top"]), 8.0)
    at = (LX - piv[0], ARM_Y - 3 - piv[1], PZ - piv[2])
    root.root.add(Part("lantern", lg, pivot=hang, at=at, rot=(0.0, 0.0, TILT)))
    # the lantern creaks to and fro on its hook
    root.clips.append(Clip("idle", {"lantern": {"rot": sway(3.4, amp=(3.0, 0.0, 5.0), phase=(math.pi / 2, 0.0, 0.0))}}))
    return root
