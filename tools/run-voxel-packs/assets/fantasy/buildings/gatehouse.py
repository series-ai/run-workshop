"""Gatehouse in the Pirate Nation style.

Twin square sandstone towers with timber hoardings and steep royal-blue
pyramid roofs flank a deep round-arched gate (a true arch, built as a
prism around the opening). A chunky iron portcullis hangs half raised in
the arch over a paved passage; a crenellated bridge room sits over the
gate. The oversized function prop is the royal banner (blue with a gold
crown) that hangs over the arch and swings on `idle`. Torches, a sloped
buttressed foot, red pennants on the roof tips and crates finish it.
Faces -Z.
"""

import numpy as np

import paint as P
import pnshapes as S
from _bld import arch_pts, arch_window, icon, icon_size, idx, merlons, pole, pyramid_roof, round_window, sandstone, slit, sub_part, wave
from pnkit import barrel, box, crate, edges
from pnshapes import flame
from voxgrid import C, Asset, Clip, Grid, Part

W, H, D = 106, 122, 70
CX = 53
Z0, Z1 = 28, 48  # gate block front and back
TW = 26  # tower width
TL0, TR0 = 6, 74  # tower x starts
TZ0, TZ1 = 24, 52  # tower depth
GX0, GX1 = 37, 69  # gate opening
SPRING = 30  # arch spring height
ROOM = 76  # top of the bridge room
TT = 80  # tower masonry top
HOARD = 91  # top of the timber hoarding
ROOF = 28


def gatehouse() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = idx(g)
    half = (GX1 - GX0) / 2
    # the gate block: two jambs and an arched lintel prism around the opening
    jambs = box(g, TL0 + TW, 0, Z0, GX0, ROOM, Z1, "sand", 4) | box(g, GX1, 0, Z0, TR0, ROOM, Z1, "sand", 4)
    sandstone(g, jambs, 4, block=(8, 5), seed=1)
    arc = arch_pts(GX0, GX1, 0, SPRING + half, segs=8)[2:]  # right spring → crown → left spring
    g.prism("z", [(GX1, ROOM), (GX1, SPRING)] + arc[1:-1] + [(GX0, SPRING), (GX0, ROOM)], Z0, Z1, C("sand", 4))
    lintel = g.solids[-1].mask(g.shape)
    sandstone(g, lintel, 4, block=(8, 5), seed=2)
    # voussoirs: a lighter stone ring painted around the arch on both faces
    d = np.hypot(X + 0.5 - CX, Y + 0.5 - SPRING)
    ring = (lintel | jambs) & (((d >= half) & (d < half + 4) & (Y >= SPRING)) | ((Y < SPRING) & (((X >= GX0 - 4) & (X < GX0)) | ((X >= GX1) & (X < GX1 + 4)))))
    P.stone(g, ring, "stone", 6, block=(4, 4), seed=3)
    P.flat(g, ring & (np.abs(X + 0.5 - CX) < 2.1) & (Y > SPRING + half), "stone", 7)  # keystone
    # paved passage and a stone sill
    pave = box(g, GX0, 0, Z0 - 6, GX1, 2, Z1 + 4, "sand", 3)
    P.stone(g, pave, "sand", 3, block=(6, 4), frame="top", seed=4)
    # the portcullis, half raised: chunky iron bars with gold spikes
    pz = Z0 + 5
    bars = np.zeros(g.shape, dtype=bool)
    for x in range(GX0 + 1, GX1 - 1, 6):
        bars |= box(g, x, 18, pz, x + 3, SPRING + half, pz + 3, "iron", 5)
        g.prism("z", [(x, 18), (x + 3, 18), (x + 1.5, 14)], pz, pz + 3, C("gold", 5))
    for y in (22, 32, 42):
        bars |= box(g, GX0, y, pz, GX1, y + 3, pz + 3, "iron", 5)
    P.flat(g, bars & (Y % 6 == 0), "iron", 6)
    # the bridge room: string course, merlons, a window row and torches
    course = box(g, TL0 + TW, ROOM - 4, Z0 - 2, TR0, ROOM, Z1 + 2, "stone", 5)
    P.stone(g, course, "stone", 5, block=(10, 4), seed=5)
    merlons(g, "x", TL0 + TW, TR0, Z0 - 2, Z0 + 2, ROOM, 9, w=8, gap=5, ramp="sand", base=5, seed=6)
    merlons(g, "x", TL0 + TW, TR0, Z1 - 2, Z1 + 2, ROOM, 7, w=8, gap=5, ramp="sand", base=5, seed=7)
    walk = box(g, TL0 + TW, ROOM, Z0 + 2, TR0, ROOM + 1, Z1 - 2, "wood", 5)
    P.planks(g, walk, "wood", 5, width=3, across="x", seed=8)
    for tx in (GX0 - 7, GX1 + 7):
        box(g, tx - 1, 24, Z0 - 4, tx + 1, 27, Z0, "darkwood", 3)
        box(g, tx - 2, 27, Z0 - 6, tx + 2, 30, Z0 - 2, "iron", 4)
        fl = box(g, tx - 2, 30, Z0 - 6, tx + 2, 37, Z0 - 2, "orange", 5)
        flame(g, fl, tx, Z0 - 4, 30, 7, 4.5)
    # twin towers
    for x0 in (TL0, TR0):
        x1 = x0 + TW
        tcx, tcz = x0 + TW / 2, (TZ0 + TZ1) / 2
        g.prism("y", [(x0 - 3, TZ0 - 5), (x1 + 3, TZ0 - 5), (x1 + 3, TZ1 + 5), (x0 - 3, TZ1 + 5)], 0, 12, C("sand", 3),
                top=[(x0, TZ0), (x1, TZ0), (x1, TZ1), (x0, TZ1)])  # battered foot
        for m, fr in S.facets(g):
            sandstone(g, m, 3, block=(9, 4), honey=0.0, frame=fr, seed=x0)
        body = box(g, x0, 12, TZ0, x1, TT, TZ1, "sand", 4)
        sandstone(g, body, 4, block=(8, 5), seed=x0 + 1)
        quoin = body & (((X < x0 + 3) | (X >= x1 - 3)) & ((Z < TZ0 + 3) | (Z >= TZ1 - 3)))
        P.stone(g, quoin, "stone", 6, block=(3, 5), seed=x0 + 2)
        # timber hoarding on brackets, like the castle towers
        for k in range(x0 - 1, x1, 5):
            g.prism("x", [(TT - 6, TZ0), (TT, TZ0), (TT, TZ0 - 3)], k, k + 2, C("darkwood", 3))
            g.prism("x", [(TT - 6, TZ1), (TT, TZ1), (TT, TZ1 + 3)], k, k + 2, C("darkwood", 3))
        hoard = box(g, x0 - 3, TT, TZ0 - 3, x1 + 3, HOARD, TZ1 + 3, "wood", 5)
        P.planks(g, hoard, "wood", 5, width=3, across="x", length=(40, 41), seed=x0 + 3)
        P.flat(g, hoard & ((Y < TT + 2) | (Y >= HOARD - 2)), "darkwood", 3)
        P.flat(g, edges(hoard) & ~((Y < TT + 1) | (Y >= HOARD - 1)), "darkwood", 3)
        round_window(g, "-z", TZ0 - 3, tcx, TT + 5.5, 3, glass=("gold", 6), frame=("darkwood", 3))
        pyramid_roof(g, x0 - 5, TZ0 - 5, x1 + 5, TZ1 + 5, HOARD, ROOF, "blue", 4, lean=(1.0 if x0 == TR0 else -1.0, 0.0), seed=x0 + 4)
        tip = (tcx + (1.0 if x0 == TR0 else -1.0), tcz)
        pole(g, round(tip[0]), round(tip[1]), HOARD + ROOF - 3, HOARD + ROOF + 1, finial=None)
        # windows and slits
        arch_window(g, "-z", TZ0, tcx - 4, tcx + 4, 44, 62)
        slit(g, "-z", TZ0, int(tcx), 20, 30)
        side = "-x" if x0 == TL0 else "+x"
        arch_window(g, side, x0 if x0 == TL0 else x1, tcz - 4, tcz + 4, 40, 58)
    # supplies at the foot (K1)
    crate(g, TR0 + 4, 0, TZ0 - 18, 10, seed=20)
    crate(g, TR0 + 16, 0, TZ0 - 16, 8, seed=21)
    barrel(g, TL0 + 8, TZ0 - 12, 0, 13, 5)
    P.grime(g, (g.a > 0) & (Y < 14) & ~g.solid_mask(), height=4, seed=22)
    return g


def banner() -> tuple[Grid, tuple]:
    """The royal banner over the arch (its own part): a rod and a big blue
    cloth with a notched foot, a gold border and a gold crown over a tower."""
    o = (CX - 14, SPRING + 16, Z0 - 6)
    g = Grid(28, ROOM - SPRING - 16, 6)
    top = ROOM - 3 - o[1]
    rod = box(g, 0, top, 1, 28, top + 2, 4, "darkwood", 3)
    P.flat(g, rod & ((np.arange(28)[:, None, None] < 2) | (np.arange(28)[:, None, None] >= 26)), "gold", 5)
    pts = [(3, top), (25, top), (25, top - 24), (14, top - 19), (3, top - 24)]
    g.prism("z", pts, 2, 4, C("blue", 4))
    cloth = g.solids[-1].mask(g.shape)
    P.mottle(g, cloth, "blue", 4, cell=3, seed=30)
    P.outline(g, cloth, "gold", 5, normal="z")
    iw, ih = icon_size("crown", 2)
    icon(g, "-z", 2, 14 - iw // 2, top - 15, "crown", "gold", 6, scale=2)
    hinge = (CX, ROOM - 2, Z0 - 3.5)
    return g, o, hinge


def build() -> Asset:
    g = gatehouse()
    bg, origin, hinge = banner()
    root = Part("gatehouse", g)
    root.add(sub_part("banner", bg, hinge, origin))
    idle = {"banner": {"rot": wave(3.0, "x", 4)}}
    return Asset(id="fantasy-buildings-gatehouse", pack="fantasy", category="buildings", name="Gatehouse", root=root, clips=[Clip("idle", idle)])
