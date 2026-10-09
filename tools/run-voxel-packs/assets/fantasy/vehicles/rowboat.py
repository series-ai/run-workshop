"""Fishing rowboat in the Pirate Nation style.

A clinker-built skiff: one tapered hull prism whose sides flare out from
the keel to the sheer (true slopes, rule F1/F2), painted as lapped strakes
of warm oak with a dark seam under each, a red sheer stripe, a cream
waterline and a tarred foot. A carved stem post rises at the bow and a
planked transom closes the stern. Two thwarts, floorboards, a coil of rope
on the fore deck, a net over the starboard gunwale, two fish crates, a
bucket and an iron anchor finish it (rule K1).

The oversized function prop is the pair of long oars (rule F4): each is a
true-slope loom from a gold oarlock out to a leaf-shaped blade. A hooped
lantern on a short stern post carries the glow (PFX). It bobs on `idle`;
the oars pull on `move`. About 78 long and 37 tall. Faces -Z (the bow).
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import idx, keys, wave
from _props import lamp_lantern
from pnkit import box, crate, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket

SZ = (86, 42, 92)
CX = 43.0
DECK = 15  # the sheer (gunwale top)
ZM = 46.0  # the hull pivot (it rocks about its middle)
STATIONS = [7, 15, 27, 41, 55, 69, 79, 85]  # z
TOP_W = [2.0, 7.5, 11.5, 13.0, 13.0, 12.0, 9.0, 3.0]  # half width at the sheer
BOT_W = [1.0, 3.0, 5.5, 7.0, 7.0, 6.0, 4.0, 1.5]  # half width at the keel
LOCK_Z = 47.0
LAMP = (CX, 20, 79.0)


def outline(widths):
    left = [(CX - w, z) for w, z in zip(widths, STATIONS)]
    right = [(CX + w, z) for w, z in zip(widths, STATIONS)]
    return left + list(reversed(right))


def hull() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = idx(g)
    g.prism("y", outline(BOT_W), 0, DECK, C("wood", 6), top=outline(TOP_W))
    body = S.last(g)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.planks(gg, mm, "wood", 6, width=3, across="y", length=(26, 34), nails=True, frame=fr, seed=1))
    P.flat(g, body & (Y < 3), "darkwood", 2)  # the tarred foot
    P.flat(g, body & (Y >= 3) & (Y < 6), "bone", 7)  # the cream waterline
    P.flat(g, body & (Y >= 6) & (Y < 7), "bone", 5)
    P.flat(g, body & (Y >= DECK - 5) & (Y < DECK - 2), "red", 5)  # the sheer stripe
    P.flat(g, body & (Y >= DECK - 5) & (Y < DECK - 4), "red", 3)
    P.flat(g, body & (Y >= DECK - 2) & (Y < DECK - 1), "gold", 5)  # a gold line under the rail
    P.flat(g, body & (Y >= DECK - 1), "darkwood", 3)  # the capping rail
    # the floor and the thwarts, painted on the prism's top face (rule S1)
    top = body & (Y == DECK - 1)
    half = np.interp(Z + 0.5, STATIONS, TOP_W)
    inner = top & (np.abs(X + 0.5 - CX) < half - 2.2)
    P.planks(g, inner, "wood", 6, width=3, across="x", length=(18, 24), frame="top", seed=2)
    P.flat(g, inner & (np.abs(X + 0.5 - CX) < 1.2), "darkwood", 3)  # the keelson
    for tz in (33, 50, 66):
        th = box(g, CX - 13, DECK - 1, tz, CX + 13, DECK + 3, tz + 5, "wood", 7)
        P.planks(g, th, "wood", 7, width=3, across="x", length=(26, 30), seed=3 + tz)
        P.flat(g, edges(th), "darkwood", 2)
        P.flat(g, th & (Y >= DECK + 2), "wood", 7)
        P.flat(g, th & (Z == tz), "darkwood", 3)
    for rz in range(18, 78, 7):  # painted frames inside the hull
        P.flat(g, inner & (Z >= rz) & (Z < rz + 2), "darkwood", 4)
    # the stem post at the bow and the transom at the stern
    g.prism("x", [(DECK - 3, 4), (DECK + 9, 9), (DECK + 9, 13), (DECK - 3, 13)], CX - 2.5, CX + 2.5, C("darkwood", 4))
    stem = S.last(g)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 4, width=3, across="y", nails=False, frame=fr, seed=6))
    P.flat(g, stem & (Y > DECK + 6), "gold", 5)  # a gold cap on the stem
    tr = box(g, CX - 4, DECK - 1, 84, CX + 4, DECK + 4, 86, "darkwood", 4)
    P.planks(g, tr, "darkwood", 4, width=3, across="x", nails=True, seed=7)
    # a coil of rope on the fore deck and an iron anchor at the stem
    coil = S.disc(g, "y", CX, 22.0, 4.6, DECK - 1, DECK + 2, "sand", 5, n=8)
    P.flat(g, coil & (((X + Z) % 3) == 0), "sand", 3)
    P.flat(g, coil & (S.radial(g, "y", CX, 22.0) < 1.8), "wood", 4)
    g.prism("z", [(CX - 1, DECK + 1), (CX + 1, DECK + 1), (CX + 1, DECK + 9), (CX - 1, DECK + 9)], 13, 15, C("iron", 4))
    g.prism("z", [(CX - 6, DECK + 1), (CX + 6, DECK + 1), (CX + 5, DECK + 3), (CX - 5, DECK + 3)], 13, 15, C("iron", 4))
    anchor = S.last(g)
    P.flat(g, anchor, "iron", 4)
    P.flat(g, anchor & (np.abs(X - CX) > 4), "steel", 6)
    # a painted eye of the boat on each bow (the PN accent, rule C3)
    for s in (-1, 1):
        bow = body & (np.sign(X + 0.5 - CX) == s) & (Z > 16) & (Z < 26) & (Y > 7) & (Y < DECK - 5)
        P.flat(g, bow & (np.abs(Z - 21) + np.abs(Y - 10) < 4.2), "bone", 7)
        P.flat(g, bow & (np.abs(Z - 21) + np.abs(Y - 10) < 2.4), "blue", 4)
        P.flat(g, bow & (np.abs(Z - 21) + np.abs(Y - 10) < 1.2), "navy", 1)
    # a net draped over the starboard gunwale and two fish crates
    net = (g.a > 0) & (X > CX + 6) & (Y > 6) & (Y < DECK) & (Z > 52) & (Z < 72)
    P.flat(g, net, "sand", 4)
    P.flat(g, net & (((X + Y + Z) % 3) == 0), "sand", 6)
    P.flat(g, net & (((X + 2 * Y) % 4) == 0), "wood", 4)
    crate(g, int(CX) - 11, DECK - 1, 55, 9, seed=8)
    crate(g, int(CX) + 2, DECK - 1, 58, 8, seed=9)
    for fx, fz in ((CX - 7.0, 58.0), (CX - 5.0, 61.0), (CX + 6.0, 62.0)):  # a few fish on the ice
        fm = S.disc(g, "y", fx, fz, 1.6, DECK + 7, DECK + 9, "sky", 6, n=6)
        P.flat(g, fm & (Y > DECK + 7), "sky", 7)
        P.flat(g, fm & (np.abs(X - fx) < 0.8) & (np.abs(Z - fz) < 0.8), "bone", 7)
    # a bucket by the stern thwart
    bk = S.disc(g, "y", CX + 8.0, 72.0, 2.6, DECK - 1, DECK + 5, "wood", 4, n=8)
    P.flat(g, bk & (Y > DECK + 3), "iron", 4)
    P.flat(g, bk & (Y < DECK + 1), "iron", 4)
    # the stern post and the hooped lantern on it (rule K3)
    box(g, CX - 1, DECK, int(LAMP[2]) - 1, CX + 1, LAMP[1], int(LAMP[2]) + 1, "darkwood", 3)
    lamp = lamp_lantern(g, int(CX), LAMP[1], int(LAMP[2]), s=6, body=7, roof="red", seed=10)
    pen = g.prism("z", [(CX + 1, lamp["top"] - 2), (CX + 11, lamp["top"] - 4), (CX + 11, lamp["top"] - 7), (CX + 1, lamp["top"] - 9)],
                  LAMP[2] - 1, LAMP[2] + 1, C("red", 5))
    pen = S.last(g)
    P.mottle(g, pen, "red", 5, cell=3, seed=11)
    P.outline(g, pen, "red", 3, normal="z")
    box(g, CX - 1, LAMP[1], int(LAMP[2]) - 1, CX + 1, lamp["top"], int(LAMP[2]) + 1, "darkwood", 3)
    # the oarlocks: gold thole pins on the capping rail
    for s in (-1, 1):
        lx = CX + s * 12.0
        pin = box(g, lx - 1.5, DECK - 1, LOCK_Z - 2, lx + 1.5, DECK + 3, LOCK_Z + 2, "gold", 5)
        P.flat(g, pin & (Y > DECK + 1), "gold", 6)
        P.flat(g, edges(pin), "gold", 3)
    return g


def oar(side: int) -> tuple[Grid, tuple]:
    """One long oar: a true-slope loom from the lock out to a leaf blade,
    with a dark grip inboard and a painted throat collar."""
    g = Grid(*SZ)
    X, Y, _Z = idx(g)
    lx = CX + side * 12.0
    grip = (CX - side * 6.0, DECK + 7.0)
    tip = (CX + side * 36.0, 5.5)
    g.prism("z", S.quad(grip, tip, 1.3, 1.1), LOCK_Z - 1, LOCK_Z + 1, C("wood", 5))
    loom = S.last(g)
    P.planks(g, loom, "wood", 5, width=2, across="y", length=(30, 34), nails=False, frame="z", seed=20)
    g.prism("z", S.quad((CX + side * 26.0, 9.5), (CX + side * 37.0, 5.0), 1.3, 3.4, cap=0.8), LOCK_Z - 1, LOCK_Z + 1, C("wood", 6))
    blade = S.last(g)
    P.planks(g, blade, "wood", 6, width=3, across="x", nails=False, frame="z", seed=21)
    P.outline(g, blade, "darkwood", 3, normal="z")
    g.prism("z", S.quad(grip, (CX - side * 1.0, DECK + 5.0), 1.6), LOCK_Z - 1, LOCK_Z + 1, C("darkwood", 3))
    P.flat(g, loom & (np.abs(X - lx) < 2.4), "iron", 4)  # the leather at the throat
    return g, (lx, float(DECK + 1), LOCK_Z)


def build() -> Asset:
    body = hull()
    root = Part("rowboat", None)
    hp = (float(CX), 0.0, ZM)
    h = root.add(Part("hull", body, pivot=hp, at=hp))
    for side, name in ((-1, "oar-l"), (1, "oar-r")):
        og, lock = oar(side)
        h.add(Part(name, og, pivot=lock, at=(lock[0] - hp[0], lock[1] - hp[1], lock[2] - hp[2])))
    idle = {"hull": {"loc": [(t, (0.0, v[1], 0.0)) for t, v in wave(3.0, "y", 1.0)],
                     "rot": keys((0, 0, 0, 0), (1.5, 2, 0, 1.5), (3.0, 0, 0, 0))},
            "oar-l": {"rot": keys((0, 0, 0, 0), (1.5, 0, -4, 3), (3.0, 0, 0, 0))},
            "oar-r": {"rot": keys((0, 0, 0, 0), (1.5, 0, 4, -3), (3.0, 0, 0, 0))}}
    pull = lambda s: keys((0, 0, 0, 0), (0.4, 0, s * 26, s * -9), (0.8, 0, s * 4, s * -14), (1.2, 0, s * -20, s * 7), (1.6, 0, 0, 0))  # noqa: E731
    move = {"hull": {"loc": [(t, (0.0, v[1], 0.0)) for t, v in wave(1.6, "y", 0.7)],
                     "rot": keys((0, 0, 0, 0), (0.4, -3, 0, 0), (0.8, 0, 0, 0), (1.2, 2, 0, 0), (1.6, 0, 0, 0))},
            "oar-l": {"rot": pull(-1)}, "oar-r": {"rot": pull(1)}}
    return Asset(id="fantasy-vehicles-rowboat", pack="fantasy", category="vehicles", name="Fishing Rowboat", root=root,
                 clips=[Clip("idle", idle), Clip("move", move)],
                 sockets=[Socket("socket-lantern", at=(LAMP[0], LAMP[1] + 7, LAMP[2]), parent="hull")],
                 pfx=[{"effectId": "rvx-fantasy-lantern-glow", "socket": "socket-lantern", "trigger": "idle", "size": 16}])
