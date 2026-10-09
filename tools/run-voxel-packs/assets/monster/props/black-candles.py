"""Black ritual candles, in the Pirate Nation haunted style.

Three fat black-violet candles of very different heights stand on a round
grey altar stone carved with a glowing magenta sigil ring. Pale wax runs
down every candle and pools on the stone, each candle sits in an oversized
gold drip pan, and a bone skull with toxic eyes leans against the tallest.
Big toxic-green PN flames read from a distance (rule F6). Faces -Z.

Size: about 24 high, so the cluster stands below the hip of a 36-voxel
person.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnshapes as S
from _kit import pfx, single
from _props import TOXIC, big_skull, bone, idx, masonry, pn_flame, union
from pnkit import box, edges
from voxgrid import C, Grid, Socket

W, H, D = 30, 27, 30
CX = CZ = 15.0
WAX = ("purple", 5)
DRIP = ("bone", 7)
# (x, z, half width, height) of the three candles
STICKS = ((-4.0, 2.0, 3.0, 11), (3.0, 4.5, 2.5, 7), (-1.5, 7.5, 2.0, 5))
TOP = 4   # the top of the altar stone
SY = TOP + 1  # the skull stands on its ledge here


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- the altar stone: a faceted disc with a chamfered cap
    start = len(g.solids)
    S.disc(g, "y", CX, CZ, 12.0, 0, TOP - 2, "gray", 4, n=8)
    g.prism("y", S.flat_ngon(CX, CZ, 12.0, 8), TOP - 2, TOP, C("gray", 5), top=S.flat_ngon(CX, CZ, 10.5, 8))
    stone = union(g, start)
    masonry(g, stone, "gray", 4, block=(6, 4), seed=1)
    S.paint_facets(g, g.solids[start + 1:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(5, 3), frame=fr, seed=2))
    top = stone & (Y == TOP - 1)
    P.flat(g, top, "gray", 6)
    # the carved sigil: a glowing ring, a pentagram and four rune ticks
    rad = np.hypot(X + 0.5 - CX, Z + 0.5 - CZ)
    ang = np.arctan2(Z + 0.5 - CZ, X + 0.5 - CX)
    P.flat(g, top & (np.abs(rad - 8.6) < 0.8), "magenta", 6)
    P.flat(g, top & (np.abs(rad - 9.9) < 0.6) & (((ang * 8 / np.pi).astype(int)) % 2 == 0), "toxic", 6)
    pts = [(CX + np.cos(np.radians(-90 + 72 * k)) * 7.6, CZ - np.sin(np.radians(-90 + 72 * k)) * 7.6) for k in range(5)]
    for k in range(5):
        a, b = pts[k], pts[(k + 2) % 5]
        dx, dz = b[0] - a[0], b[1] - a[1]
        t = np.clip(((X + 0.5 - a[0]) * dx + (Z + 0.5 - a[1]) * dz) / (dx * dx + dz * dz), 0, 1)
        P.flat(g, top & (np.hypot(X + 0.5 - (a[0] + t * dx), Z + 0.5 - (a[1] + t * dz)) < 0.7), "magenta", 5)

    # ---- the pooled wax that has run over the stone
    pool = (np.abs(rad - 3.0) < 3.0) & (Y == TOP - 1) & stone
    P.flat(g, pool, "bone", 6)
    P.flat(g, pool & (((X + Z) % 5) == 0), "bone", 7)

    # ---- three candles, each in an oversized gold drip pan
    socks = []
    for k, (ox, oz, hw, ht) in enumerate(STICKS):
        cx, cz = CX + ox, CZ + oz
        pan = S.disc(g, "y", cx, cz, hw + 2.2, TOP, TOP + 1, "gold", 4, n=8)
        P.flat(g, pan & (Y == TOP), "gold", 6)
        P.outline(g, pan & (Y == TOP), "gold", 2, normal="y")
        y0, y1 = TOP + 1, TOP + 1 + ht
        stick = box(g, cx - hw, y0, cz - hw, cx + hw, y1, cz + hw, *WAX)
        P.flat(g, stick & (Y < y0 + 2), "purple", 2)
        P.flat(g, stick & (Y > y1 - 3), "purple", 6)
        P.flat(g, stick & (Y == y1 - 2), "toxic", 3)  # the flame lights the melted lip
        P.flat(g, edges(stick), "purple", 2)
        # pale wax running down two sides of every candle
        for dx, dz, run, off in ((-hw, 0, ht * 0.5, 1), (hw - 1, 0, ht * 0.3, 2), (0, -hw, ht * 0.4, 0), (0, hw - 1, ht * 0.25, 3)):
            lane = stick & (np.abs(X + 0.5 - (cx + dx + 0.5)) < (0.9 if dx else hw)) & (np.abs(Z + 0.5 - (cz + dz + 0.5)) < (0.9 if dz else hw))
            step = ((X * 3 + Z * 5 + off + k * 7) % 3)
            P.flat(g, lane & (Y > y1 - 2 - run) & (step < 2), *DRIP)
        P.flat(g, stick & (Y == y1 - 1), "bone", 6)
        g.box(cx - 0.5, y1, cz - 0.5, cx + 0.5, y1 + 1, cz + 0.5, C("iron", 2))  # the wick
        fw, fh = hw * 2.2, hw * 2.4
        fstart = len(g.solids)
        pn_flame(g, cx, cz, y1 + 1, fw, fh, kind="small", colors=TOXIC, depth=(0.26, 0.42, 0.6))
        fm = union(g, fstart)
        P.flat(g, fm & (g.a == C("toxic", 4)) & (((Y - y1) % 3) == 0), "toxic", 2)  # stepped tiers
        P.flat(g, fm & (g.a == C("toxic", 4)) & S.seams(g, g.solids[fstart:fstart + 1], 0.9), "toxic", 2)
        socks.append(Socket(f"socket-flame-{k + 1}", at=(float(cx - W / 2), float(y1 + 1 + fh * 0.4), float(cz - D / 2))))

    # ---- a bone skull sitting on the stone, well inside the rim, and two stubs
    ledge = S.disc(g, "y", CX + 3.5, CZ - 3.5, 4.6, TOP, SY, "gray", 6, n=8)
    P.stone(g, ledge, "gray", 6, block=(4, 3), frame="top", seed=3)
    P.outline(g, ledge, "gray", 3, normal="y")
    sk = big_skull(g, CX + 3.5, SY, CZ - 3.5, s=9, base=7, eyes=("toxic", 6), seed=4)
    skx, skz = CX + 3.5, CZ - 3.5
    back = sk & (Z + 0.5 > skz - 2.0)          # everything but the painted face
    P.flat(g, back & (Y < SY + 2), "bone", 5)       # the jaw reads darker than the cranium
    P.flat(g, back & (Y == SY + 2), "bone", 3)      # a dark line under the cheekbone, round the sides and back
    for sgn, pl in ((-1, skx - 4.5), (1, skx + 3.5)):  # sockets painted on both side faces as well
        side = sk & (np.abs(X - pl) < 0.6) & (np.abs(Y + 0.5 - (SY + 5.0)) < 1.3) & (np.abs(Z + 0.5 - (skz - 1.8)) < 1.3)
        P.flat(g, side, "purple", 1)
        P.flat(g, side & (np.abs(Y + 0.5 - (SY + 5.0)) < 0.7) & (np.abs(Z + 0.5 - (skz - 1.8)) < 0.7), "toxic", 6)
    P.flat(g, back & (Y > SY + 5) & (np.abs(X + 0.5 - skx) < 0.6), "bone", 4)   # the sagittal suture
    P.flat(g, back & (Y > SY + 6) & (np.abs(Z + 0.5 - skz) < 0.6), "bone", 4)   # the coronal suture
    P.flat(g, sk & (Z + 0.5 > skz + 2.4) & (Y > SY + 3) & (Y < SY + 6), "bone", 4)  # a stepped occiput
    P.flat(g, sk & (np.abs(Z + 0.5 - (skz - 3.8)) < 0.7) & (Y > SY + 6) & (Y < SY + 8), "bone", 4)  # the brow ridge
    P.flat(g, sk & (Y > SY + 9), "bone", 5)                                     # a flatter, shaded crown
    # a femur lying on the far side, so every view carries a bone cue
    bone(g, "y", (CX - 7.5, CZ - 3.0), (CX - 2.5, CZ - 7.0), TOP, TOP + 2, r=1.4, ramp="bone", base=6)
    for sx, sz, sh in ((-8.0, 3.0, 3), (-4.5, -6.5, 2)):
        stub = box(g, CX + sx - 1.5, TOP, CZ + sz - 1.5, CX + sx + 1.5, TOP + sh, CZ + sz + 1.5, *WAX)
        P.flat(g, stub & (Y == TOP + sh - 1), "bone", 7)
        P.flat(g, edges(stub), "purple", 2)

    from pnpaint import blotch
    blotch(g, stone & (Y < 2), "moss", 5, cell=2, chance=0.12, seed=7)

    return single("black-candles", "props", "Black Ritual Candles", g, sockets=socks,
                  pfx=[pfx("rvx-monster-candle-flame", s.name, "idle", size=8) for s in socks])
