"""Graveyard bell tower, in the Pirate Nation haunted style.

A tall square grey stone tower on a plinth, with thick light stone corner
piers, sloped buttresses (true slopes), a pointed door glowing magenta, a
giant glowing clock face, and an open belfry under pointed arch hoods. A
steep purple slate spire with corner pinnacles carries a bat weathervane.
The function prop is the oversized bronze bell (rules F4, F6): on `idle`
the headstock (the yoke) rocks and the bell swings under it. Tombstones
and pumpkins stand at the foot. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _bld import bat, course, crow, opening, parts, piers, plinth, pointed, slate, stone
from _pn import lancet, pumpkin, spire_cap, tombstone
from pnkit import box, face_prism
from voxgrid import C, Asset, Clip, Grid, Socket

W, H, D = 72, 171, 72
CX = CZ = 36.0
T0, T1 = 16, 56  # tower walls, x and z
SHAFT = 70  # top of the shaft
BELFRY0, BELFRY1 = 74, 108
SPIRE0, SPIRE_RISE = 112, 46
PIER = 7
YOKE_Y = 101.0
BELL_TOP, BELL_BOT = 97, 78


def tower() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    plinth(g, T0, T0, T1, T1, h=5, out=6, seed=1)
    stone(g, T0, 5, T0, T1, SHAFT, T1, "gray", 5, seed=2)
    piers(g, T0, T1, T0, T1, 5, SHAFT, size=7, seed=3)
    course(g, T0, T0, T1, T1, 38, 42, seed=4)
    course(g, T0, T0, T1, T1, SHAFT - 2, BELFRY0, out=2, seed=5)
    # sloped buttresses at the foot of every face (true slopes, F2)
    for s in (-1, 1):
        for u in (T0 + 1, T1 - 6):
            zf = CZ + s * (T1 - CZ)
            g.prism("x", [(5, zf), (5, zf + s * 9), (14, zf + s * 9), (36, zf)], u, u + 5, C("gray", 6))
            P.stone(g, S.last(g), "gray", 6, block=(5, 4), seed=6)
            xf = CX + s * (T1 - CX)
            g.prism("z", [(xf, 5), (xf + s * 9, 5), (xf + s * 9, 14), (xf, 36)], u, u + 5, C("gray", 6))
            P.stone(g, S.last(g), "gray", 6, block=(5, 4), seed=7)
    # a wide pointed door with magenta light and a planked leaf
    opening(g, "-z", T0, pointed(CX - 10, CX + 10, 5, 34), glow=("magenta", 6), deep=("purple", 3))
    leaf = (Z < T0) & (Z > T0 - 1.2) & (np.abs(X - CX) < 8) & (Y > 5) & (Y < 24) & (g.a > 0)
    P.planks(g, leaf, "purple", 3, width=3, across="x", length=(40, 41), nails=True)
    hood = face_prism(g, "-z", T0, [(CX - 13, 20), (CX - 10, 20), (CX, 34), (CX + 10, 20), (CX + 13, 20), (CX, 38)], 0, 2, C("gray", 6))
    P.stone(g, hood, "gray", 6, block=(5, 3), seed=8)
    # the giant clock face: a glowing octagon in a light stone ring
    cy = 55
    ring = S.disc(g, "z", CX, cy, 14, T0 - 2, T0, "gray", 6)
    P.stone(g, ring, "gray", 6, block=(4, 3), seed=9)
    face = S.disc(g, "z", CX, cy, 11, T0 - 3, T0 - 1, "toxic", 6)
    U, V = X - CX, Y - cy
    rad = np.hypot(U, V)
    ang = np.arctan2(V, U)
    P.flat(g, face & (rad < 6), "toxic", 7)
    P.flat(g, face & (rad > 8.5), "toxic", 5)
    tick = face & (rad > 8.2) & (np.abs(((ang / (2 * math.pi) * 12 + 0.5) % 1) - 0.5) < 0.12)
    P.flat(g, tick, "purple", 2)
    P.flat(g, face & (np.abs(U) < 0.9) & (V > 0) & (V < 8), "purple", 2)  # minute hand to 12
    P.flat(g, face & (np.abs(V - U * 0.55) < 0.9) & (U > 0) & (U < 5.5), "purple", 2)  # hour hand
    P.flat(g, face & (rad < 1.8), "purple", 3)
    # side and back windows
    for face_, plane in (("-x", T0), ("+x", T1)):
        lancet(g, face_, plane, CZ - 5, CZ + 5, 44, 66, glass="toxic", shade=5, seed=10)
        lancet(g, face_, plane, CZ - 4, CZ + 4, 12, 32, glass="purple", shade=3, seed=11)
    lancet(g, "+z", T1, CX - 6, CX + 6, 40, 66, glass="magenta", shade=5, seed=12)
    # the open belfry: a floor, corner piers, pointed arch hoods, a cornice
    floor = stone(g, T0, BELFRY0 - 2, T0, T1, BELFRY0, T1, "gray", 6, block=(8, 3), seed=13)
    pm = np.zeros(g.shape, dtype=bool)
    for x in (T0, T1 - PIER):
        for z in (T0, T1 - PIER):
            pm |= box(g, x, BELFRY0, z, x + PIER, BELFRY1, z + PIER, "gray", 6)
    P.stone(g, pm, "gray", 6, block=(4, 6), seed=14)
    hoods = np.zeros(g.shape, dtype=bool)
    a0, a1 = T0 + PIER, T1 - PIER
    arch = [(a0, BELFRY1 - 12), (a0, BELFRY1), (a1, BELFRY1), (a1, BELFRY1 - 12), (CX, BELFRY1 - 4)]
    for z0 in (T0, T1 - 4):
        g.prism("z", arch, z0, z0 + 4, C("gray", 5))
        hoods |= S.last(g)
    for x0 in (T0, T1 - 4):
        g.prism("x", [(v, u) for u, v in arch], x0, x0 + 4, C("gray", 5))
        hoods |= S.last(g)
    P.stone(g, hoods, "gray", 5, block=(6, 3), seed=15)
    # a painted inner shadow on the belfry floor and hoods, never black (C2)
    P.flat(g, floor & (Y > BELFRY0 - 1) & (np.abs(X - CX) < 10) & (np.abs(Z - CZ) < 10), "purple", 3)
    stone(g, T0 - 3, BELFRY1, T0 - 3, T1 + 3, SPIRE0, T1 + 3, "gray", 6, block=(10, 4), seed=16)
    # the steep slate spire, corner pinnacles, a bat weathervane
    start = len(g.solids)
    g.prism("y", [(T0 - 1, T0 - 1), (T1 + 1, T0 - 1), (T1 + 1, T1 + 1), (T0 - 1, T1 + 1)], SPIRE0, SPIRE0 + SPIRE_RISE, C("purple", 4), top=[(CX, CZ)] * 4)
    slate(g, g.solids[start:], seed=17, row=4, width=4)
    for x in (T0 - 1, T1 - 5):
        for z in (T0 - 1, T1 - 5):
            pc = spire_cap(g, x + 3, z + 3, SPIRE0, 3, 14, ramp="gray", base=6, overhang=0.5)
            P.stone(g, pc, "gray", 6, block=(3, 3), seed=18)
    box(g, CX - 1, SPIRE0 + SPIRE_RISE - 3, CZ - 1, CX + 1, H - 1, CZ + 1, "purple", 2)
    box(g, CX - 5, SPIRE0 + SPIRE_RISE + 1, CZ - 1, CX + 5, SPIRE0 + SPIRE_RISE + 2, CZ + 1, "purple", 3)
    bat(g, CX, H - 6, CZ - 1, span=11, t=2)
    # crows on the belfry ledge and moss down one side (F5)
    crow(g, T0 + 4, BELFRY1 + 4, T0 - 1, facing=1)
    crow(g, T1 + 1, SHAFT + 4, CZ + 8, facing=-1)
    from _pn import blotch
    blotch(g, (g.a > 0) & (X < T0 + 1) & (Y < 60) & ~g.solid_mask(), "moss", 5, cell=3, chance=0.1, seed=25)
    # tombstones and pumpkins at the foot (K1), inside the tower footprint
    tombstone(g, 5, 60, w=8, h=13, lean=-8, seed=19)
    tombstone(g, 66, 60, w=7, h=11, lean=6, glyph="", seed=20)
    pumpkin(g, 9, 0, 8, w=10, h=8, seed=21)
    pumpkin(g, 62, 0, 10, w=12, h=9, seed=22)
    P.grime(g, (g.a > 0) & (Y < 14) & ~g.solid_mask(), height=4, seed=23)
    return g


def yoke() -> Grid:
    """The headstock: a thick wooden beam across the belfry on iron straps."""
    g = Grid(W, H, D)
    beam = box(g, T0 + 2, YOKE_Y - 3, CZ - 3, T1 - 2, YOKE_Y + 3, CZ + 3, "wood", 5)
    P.planks(g, beam, "wood", 5, width=3, across="y", nails=True, seed=24)
    straps = box(g, CX - 8, BELL_TOP - 1, CZ - 3.5, CX - 6, YOKE_Y + 3.5, CZ + 3.5, "gray", 3) | box(g, CX + 6, BELL_TOP - 1, CZ - 3.5, CX + 8, YOKE_Y + 3.5, CZ + 3.5, "gray", 3)
    for x in (T0 + 2, T1 - 5):
        box(g, x, YOKE_Y - 2, CZ - 2, x + 3, YOKE_Y + 2, CZ + 2, "gold", 4)  # bearings
    return g


def bell() -> Grid:
    """The oversized bronze bell: a flared octagon (true slopes), a heavy
    lip, a crown, a painted skull and a clapper."""
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    body = S.cone(g, "y", CX, CZ, 11, BELL_BOT + 2, BELL_TOP, "gold", 4, r_top=7)
    lip = S.cone(g, "y", CX, CZ, 12.5, BELL_BOT, BELL_BOT + 3, "gold", 3, r_top=11.5)
    crown = box(g, CX - 4, BELL_TOP, CZ - 4, CX + 4, BELL_TOP + 3, CZ + 4, "gold", 3)
    P.flat(g, body & (Y > BELL_TOP - 3), "gold", 5)
    P.flat(g, body & (Y > BELL_BOT + 6) & (Y < BELL_BOT + 8), "gold", 3)
    P.flat(g, lip & (Y > BELL_BOT + 2), "gold", 5)
    clap = box(g, CX - 1.5, BELL_BOT - 3, CZ - 1.5, CX + 1.5, BELL_BOT + 1, CZ + 1.5, "gray", 3)
    # a painted skull on the front facet (S1)
    import pnglyph

    w, h = pnglyph.icon_size("skull")
    pnglyph.icon(g, "-z", CZ - 10.5, int(CX - w / 2), BELL_BOT + 5, "skull", "gold", 2, inks={".": ("gold", 4)}, reach=3)
    return g


def build() -> Asset:
    root = parts(
        {"tower": tower(), "yoke": yoke(), "bell": bell()},
        [("tower", None, (0.0, 0.0, 0.0)), ("yoke", "tower", (CX, YOKE_Y, CZ)), ("bell", "yoke", (CX, YOKE_Y, CZ))],
    )
    swing = [(0.0, 24.0), (0.6, 0.0), (1.2, -24.0), (1.8, 0.0), (2.4, 24.0)]
    lag = [(0.0, 6.0), (0.6, 4.0), (1.2, -6.0), (1.8, -4.0), (2.4, 6.0)]
    clip = Clip("idle", {"yoke": {"rot": [(t, (a, 0.0, 0.0)) for t, a in swing]}, "bell": {"rot": [(t, (a, 0.0, 0.0)) for t, a in lag]}})
    return Asset(
        id="monster-buildings-bell-tower", pack="monster", category="buildings", name="Graveyard Bell Tower", root=root,
        clips=[clip],
        sockets=[Socket("socket-bell", at=(CX, (BELL_BOT + BELL_TOP) / 2, CZ), parent="bell")],
        pfx=[{"effectId": "rvx-monster-bat-swarm", "socket": "socket-bell", "trigger": "idle", "size": 70}],
    )
