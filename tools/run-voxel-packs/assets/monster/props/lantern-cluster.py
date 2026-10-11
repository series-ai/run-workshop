"""Lantern cluster, in the Pirate Nation haunted style.

A grave-keeper's lantern rack: a chamfered grey stone plinth, a stout
grey masonry pillar with violet slate bands and a bone skull finial, and
a long dark iron cantilever arm with a diagonal brace. Two lanterns of
two sizes hang well apart on chains of two lengths, so each keeps its own
volume and the row still reads as one shape in a thumbnail (rules F4,
F6). A third, broken lantern lies on the plinth at the foot. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnshapes as S
from _kit import pfx, single
from _props import chain, idx, plinth, union
from pnkit import box, edges
from voxgrid import C, Grid, Socket

W, H, D = 40, 48, 20
CZ = 10.0
POST = (5.0, 11.0)     # the pillar, x0..x1
ARM_Y = 29             # the underside of the arm
# (centre x, lantern size, body, foot y)
HANGS = ((19.0, 8, 10, 8), (33.0, 6, 7, 15))


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- a wide chamfered plinth, so every part of the prop stands on stone
    plinth(g, 0, CZ - 9, 17, CZ + 9, 0, 3, "gray", 5, bevel=1.6, seed=1)
    plinth(g, 1, CZ - 7, 15, CZ + 7, 3, 2, "gray", 6, bevel=1.2, seed=2)

    # ---- the grey masonry pillar with violet slate bands
    pillar = box(g, POST[0], 5, CZ - 3, POST[1], ARM_Y + 4, CZ + 3, "gray", 6)
    P.stone(g, pillar, "gray", 6, block=(6, 4), cracks=0.06, seed=3)
    P.flat(g, edges(pillar), "gray", 4)
    for yb in (11, 21):
        band = pillar & (Y >= yb) & (Y < yb + 3)
        P.stone(g, band, "purple", 5, block=(5, 3), seed=yb)
        P.flat(g, band & (Y == yb + 2), "purple", 6)
        P.flat(g, band & (Y == yb), "purple", 3)
    cap = box(g, POST[0] - 1, ARM_Y + 4, CZ - 4, POST[1] + 1, ARM_Y + 6, CZ + 4, "gray", 7)
    P.stone(g, cap, "gray", 7, block=(4, 3), frame="top", seed=4)
    P.flat(g, edges(cap), "gray", 4)

    # ---- the bone skull finial, facing -Z
    sk = S.skull(g, (POST[0] + POST[1]) / 2, ARM_Y + 6, CZ, s=7, ramp="bone", base=7,
                 eyes=("toxic", 6), socket=("purple", 1), seed=5)
    P.flat(g, sk & (Y < ARM_Y + 9), "bone", 5)                                    # a darker jaw
    P.flat(g, sk & (Y > ARM_Y + 12) & (np.abs(X + 0.5 - 8.0) < 0.6), "bone", 5)   # a painted suture

    # ---- the iron arm and its brace
    arm = box(g, POST[0] + 1, ARM_Y, CZ - 2, W - 2, ARM_Y + 3, CZ + 2, "iron", 7)
    P.plates(g, arm, "iron", 7, size=(6, 3), rivets=True, seed=6)
    P.flat(g, edges(arm), "iron", 4)
    P.flat(g, arm & (Y == ARM_Y + 2), "iron", 7)
    P.flat(g, arm & (Y == ARM_Y + 2) & ((X % 7) == 0), "iron", 4)
    S.bar(g, "z", (POST[1] - 1, 19), (17, ARM_Y), 2.8, CZ - 2, CZ + 2, "iron", 6)
    brace = S.last(g)
    P.flat(g, brace & S.seams(g, g.solids[-1:], 0.9), "iron", 3)

    # ---- two lanterns, well apart, on chains of two lengths
    socks, pfxs = [], []
    for k, (lx, s, body, y0) in enumerate(HANGS):
        lan = S.lantern(g, int(lx), y0, int(CZ), s=s, body=body, glass="gold", roof="purple", frame="steel", seed=7 + k)
        P.flat(g, lan["ring"], "gold", 5)
        links = max(1, (ARM_Y - lan["top"]) // 2 + 1)
        chain(g, lx, CZ, ARM_Y, links, ramp="steel", base=6)
        gl = lan["glow"]
        socks.append(Socket(f"socket-lantern-{k + 1}", at=(float(lx - W / 2), float(gl[1]), float(CZ - D / 2))))
        pfxs.append(pfx("rvx-monster-candle-flame", f"socket-lantern-{k + 1}", "idle", size=9))

    # ---- a broken lantern lying on the plinth, its pane dark
    wreck = box(g, 2, 5, CZ + 1, 9, 11, CZ + 6, "steel", 4)
    P.plates(g, wreck, "steel", 4, size=(4, 4), rivets=True, seed=9)
    P.flat(g, wreck & (Z == int(CZ) + 1) & (X > 3) & (X < 8) & (Y > 6) & (Y < 10), "gold", 2)
    P.flat(g, edges(wreck), "steel", 2)
    g.prism("z", [(2, 11), (9, 11), (5.5, 15)], CZ + 1, CZ + 6, C("purple", 4))
    roof = S.last(g)
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 4, row=3, width=4, frame=fr, seed=10))
    P.flat(g, roof & S.seams(g, g.solids[-1:], 0.9), "purple", 2)

    from pnpaint import blotch
    blotch(g, (g.a != 0) & (Y < 4), "moss", 5, cell=3, chance=0.10, seed=11)

    return single("lantern-cluster", "props", "Lantern Cluster", g, sockets=socks, pfx=pfxs)
