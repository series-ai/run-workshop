"""Haunted windmill, in the Pirate Nation haunted style.

After the PN haunted windmill: a tapering octagonal grey stone tower (true
slopes) with light stone quoins and painted pointed windows glowing toxic
green and magenta, a plank gallery with a railing, a crooked purple slate
cap and a small stone annex with its own steep roof and a crooked door.
The function prop is oversized (rules F4, F6): four huge sails of torn,
dripping magenta canvas on dark spars, which turn slowly on `idle`. A bat
finial, flour sacks, pumpkins and a tombstone finish it. Faces -Z (the
sails are on the front).
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _bld import bat, coords, facet_window, parts, piers, roof_paint, stone
from _pn import blotch, pumpkin, tombstone
from pnkit import box, gable_roof
from voxgrid import C, Asset, Clip, Grid, Socket, turn

W, H, D = 104, 144, 88
CX, CZ = 50.0, 52.0
R0, R1, TY0, TY1 = 22, 15, 6, 80  # tower: flat radius at the foot and the top
CAP_Y, CAP_RISE = 78, 30
HUB = (CX, 88.0, CZ - 31.0)
ARM = 50


def tower_r(y: float) -> float:
    return R0 + (R1 - R0) * (y - TY0) / (TY1 - TY0)


def mill() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    S.disc(g, "y", CX, CZ, R0 + 5, 0, TY0, "stone", 5)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(9, 5), frame=fr, seed=1))
    # the tapering tower (a frustum): stone per facet, light quoins, windows
    start = len(g.solids)
    S.cone(g, "y", CX, CZ, R0, TY0, TY1, "gray", 5, r_top=R1)
    tw = g.solids[start:]
    S.paint_facets(g, tw, lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(8, 4), cracks=0.1, frame=fr, seed=2))
    tm = S.last(g)
    P.stone(g, tm & S.seams(g, tw, 2.4), "gray", 7, block=(4, 5), seed=3)
    for k, (m, fr) in enumerate(S.facets(g, tw)):
        if fr == "top":
            continue
        glass = ("magenta", 5) if k % 3 == 0 else ("toxic", 5)
        facet_window(g, m, fr, 60, 74, 7, glass=glass)
        if k % 2 == 1:
            facet_window(g, m, fr, 18, 34, 7, glass=("purple", 3) if k % 4 == 1 else glass)
    blotch(g, tm & (Y < 30), "moss", 5, cell=3, chance=0.08, seed=4)
    # the gallery: a plank ring with posts and a railing (true slopes)
    gy = 48
    S.disc(g, "y", CX, CZ, tower_r(gy) + 7, gy, gy + 3, "wood", 5)
    deck = S.last(g)
    P.planks(g, deck, "wood", 5, width=3, across="y", nails=True, seed=5)
    P.flat(g, deck & (Y < gy + 1), "wood", 4)
    ring = S.flat_ngon(CX, CZ, tower_r(gy) + 6, 8)
    for k in range(8):
        (x0, z0), (x1, z1) = ring[k], ring[(k + 1) % 8]
        box(g, x0 - 1, gy + 3, z0 - 1, x0 + 1, gy + 11, z0 + 1, "wood", 4)
        g.prism("y", S.quad((x0, z0), (x1, z1), 0.9), gy + 8, gy + 10, C("wood", 6))
    # brackets under the gallery (true slopes)
    for a in range(4):
        ang = math.pi / 4 + a * math.pi / 2
        dx, dz = math.cos(ang), math.sin(ang)
        r = tower_r(gy - 10)
        g.prism("y", S.quad((CX + dx * r, CZ + dz * r), (CX + dx * (r + 6), CZ + dz * (r + 6)), 1.2), gy - 10, gy, C("wood", 4), top=S.quad((CX + dx * (r - 1), CZ + dz * (r - 1)), (CX + dx * (tower_r(gy) + 6), CZ + dz * (tower_r(gy) + 6)), 1.2))
    # the crooked cap: an octagon slate cone leaning to one side, a bat finial
    stone(g, CX - R1 - 1, TY1 - 3, CZ - R1 - 1, CX + R1 + 1, CAP_Y + 1, CZ + R1 + 1, "gray", 6, block=(8, 3), seed=6)
    start = len(g.solids)
    base = S.flat_ngon(CX, CZ, R1 + 5, 8)
    g.prism("y", base, CAP_Y, CAP_Y + CAP_RISE, C("purple", 4), top=[(CX + 4, CZ + 2)] * 8)
    cap = g.solids[start:]
    S.paint_facets(g, cap, lambda gg, mm, fr: P.tiles(gg, mm, "purple", 4, row=4, width=4, frame=fr, seed=7))
    cm = S.last(g)
    blotch(g, cm, "purple", 2, cell=3, chance=0.06, seed=8)
    P.flat(g, cm & S.seams(g, cap, 0.9), "gray", 5)
    P.flat(g, cm & (Y < CAP_Y + 1.5), "gray", 6)
    box(g, CX + 3, CAP_Y + CAP_RISE - 3, CZ + 1, CX + 5, CAP_Y + CAP_RISE + 8, CZ + 3, "purple", 2)
    bat(g, CX + 4, CAP_Y + CAP_RISE + 8, CZ + 1, span=12, t=2)
    # the windshaft out to the hub
    shaft = box(g, CX - 3, HUB[1] - 3, HUB[2] + 2, CX + 3, HUB[1] + 3, CZ - 8, "wood", 5)
    P.planks(g, shaft, "wood", 5, width=3, across="z", nails=False, seed=9)
    # a stone annex on the right with a steep slate roof and a crooked door
    AX0, AX1, AZ0, AZ1 = CX + 12, CX + 46, CZ - 14, CZ + 12
    stone(g, AX0, TY0, AZ0, AX1, 34, AZ1, "gray", 5, seed=10)
    piers(g, AX0, AX1, AZ0, AZ1, TY0, 34, size=5, seed=11)
    roof = gable_roof(g, AX0, AX1, AZ0, AZ1, 34, 56, ramp="purple", thick=4, overhang=4, trim="gray", gable="gray", ridge="z", trim_shade=6, seed=12)
    roof_paint(g, roof, "z", 13)
    dcx = (AX0 + AX1) / 2
    g.prism("z", [(dcx - 7, TY0), (dcx + 6, TY0), (dcx + 7.5, 26), (dcx + 1, 31), (dcx - 5.5, 27)], AZ0 - 2, AZ0, C("purple", 3))
    leaf = S.last(g)
    P.planks(g, leaf, "purple", 3, width=3, across="x", length=(40, 41), nails=True, seed=14)
    P.outline(g, leaf, "gray", 6, normal="z")
    box(g, dcx + 3, 15, AZ0 - 3, dcx + 5, 18, AZ0 - 2, "gold", 5)
    box(g, dcx - 3, 38, AZ0 - 2, dcx + 3, 44, AZ0 - 1, "toxic", 6)  # a glowing attic slit
    # flour sacks, pumpkins, a tombstone (K1)
    for k, (sx, sz, sh) in enumerate(((AX1 + 6, AZ0 + 2, 10), (AX1 + 6, AZ0 + 11, 8), (AX1 + 5, AZ0 + 6, 17))):
        sack = box(g, sx - 4, 0 if sh < 12 else 10, sz - 4, sx + 4, sh, sz + 4, "bone", 6)
        P.mottle(g, sack, "bone", 6, cell=2, seed=15 + k)
        P.flat(g, sack & (Y > sh - 2.5) & (Y < sh - 1.5), "wood", 4)
        P.flat(g, sack & (Y > sh - 1.5), "bone", 5)
    pumpkin(g, CX - 24, 0, CZ - 28, w=12, h=9, seed=18)
    pumpkin(g, CX - 16, 0, CZ - 31, w=9, h=7, seed=19)
    tombstone(g, CX - 32, CZ + 20, w=10, h=15, lean=-9, seed=20)
    P.grime(g, (g.a > 0) & (Y < 14) & ~g.solid_mask(), height=4, seed=21)
    return g


def sails() -> Grid:
    """Four stocks with torn, dripping magenta canvas and painted spars."""
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    hx, hy, hz = HUB
    for k in range(4):
        a = math.radians(20 + 90 * k)
        d = (math.cos(a), math.sin(a))
        n = (-math.sin(a), math.cos(a))

        def at(r, o):
            return (hx + d[0] * r + n[0] * o, hy + d[1] * r + n[1] * o)

        g.prism("z", S.quad(at(2, 0), at(ARM + 2, 0), 1.6), hz - 1.5, hz + 1.5, C("wood", 4))
        stock = S.last(g)
        P.flat(g, stock, "wood", 4)
        rag = [(9, 2), (ARM, 2), (ARM - 2, 7), (ARM + 1, 12), (ARM - 4, 17), (ARM - 9, 14), (ARM - 14, 18), (ARM - 20, 14.5), (ARM - 26, 18), (ARM - 31, 15), (ARM - 36, 17.5), (12, 16), (9, 10)]
        g.prism("z", [at(r, o) for r, o in rag], hz + 0.5, hz + 2, C("magenta", 4))
        cloth = S.last(g)
        P.mottle(g, cloth, "magenta", 4, cell=3, seed=30 + k)
        R = (X - hx) * d[0] + (Y - hy) * d[1]
        O = (X - hx) * n[0] + (Y - hy) * n[1]
        spar = cloth & ((np.abs((R % 7) - 3.5) > 2.9) | (np.abs(O - 9) < 0.7))
        P.flat(g, spar, "purple", 2)
        P.flat(g, cloth & (O > 13), "magenta", 3)
        P.flat(g, cloth & (O < 3), "magenta", 5)
    hub = S.disc(g, "z", hx, hy, 5, hz - 3, hz + 3, "gray", 4)
    P.flat(g, hub & (np.hypot(X - hx, Y - hy) < 2.2), "gold", 5)
    return g


def build() -> Asset:
    root = parts({"mill": mill(), "sails": sails()}, [("mill", None, (0.0, 0.0, 0.0)), ("sails", "mill", HUB)])
    return Asset(
        id="monster-buildings-haunted-windmill", pack="monster", category="buildings", name="Haunted Windmill", root=root,
        clips=[Clip("idle", {"sails": {"rot": turn(8.0, "z", 45.0)}})],
        sockets=[Socket("socket-sails", at=HUB, parent="sails")],
        pfx=[{"effectId": "rvx-monster-ghost-wisps", "socket": "socket-sails", "trigger": "idle", "size": 60}],
    )
