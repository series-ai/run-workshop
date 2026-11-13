"""Gargoyle fountain, in the Pirate Nation haunted style.

A broad octagonal basin on a stepped stone plinth, sunk two voxels deep
and brim full of glowing toxic liquid: one continuous green surface with
ripple rings under the stream, exposed stone all round the rim and purple
slate bands in the plinth and under the cap. An octagonal pier carries an
oversized hunched gargoyle (rules F4, K3) built from a few chunky volumes:
crouched hind legs, a chest leaning forward, thick forelegs gripping the
cap with bone claws over the edge, a big horned head with a heavy brow,
large toxic eyes, a jutting jaw with bone fangs and a glowing gullet, and
a tail curling down into the water. The wings are two solid folded bat
wings (true slopes) — violet membranes with painted dark ribs, no crossing
spars — so the silhouette reads at 128 px. A thick arc of toxic water
leaves the jaws and breaks on the surface in a splash.

socket-spout sits in the jaws and socket-basin over the splash.
Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _kit import pfx, single
from _props import idx, union
from pnkit import box
from voxgrid import C, Grid, Socket

W, H, D = 38, 46, 38
CX = CZ = 19.0
ST = "gray"
RIM = 17.0  # the stone rim radius
POOL = 15.0  # the liquid surface radius
WATER = 10  # the liquid surface row (the basin is sunk two voxels)
CAP = 18  # the top of the pier: the gargoyle stands here
Y0 = CAP
MOUTH = (CX, 29.0, 9.0)
SPLASH = (CX, 8.0)  # where the arc breaks on the water


def basin(g: Grid) -> None:
    """A stepped plinth, a flared bowl and a light stone rim round a sunken
    pool of glowing liquid with ripple rings under the stream."""
    X, Y, Z = idx(g)
    start = len(g.solids)
    S.disc(g, "y", CX, CZ, 17.5, 0, 2, ST, 5)
    S.cone(g, "y", CX, CZ, 17.5, 2, 4, ST, 5, n=8, r_top=15.0)
    S.cone(g, "y", CX, CZ, 14.0, 4, 10, ST, 4, n=8, r_top=16.5)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, ST, 4, block=(6, 4), cracks=0.10, frame=fr, seed=1))
    bowl = union(g, start)
    P.flat(g, bowl & (Y == 0), ST, 2)  # a dark base course, so the bowl sits
    P.flat(g, bowl & (Y >= 2) & (Y < 4), "purple", 3)  # a purple slate band in the plinth
    rs = len(g.solids)
    rim = S.disc(g, "y", CX, CZ, RIM, 10, 13, ST, 6)
    P.stone(g, rim, ST, 6, block=(5, 3), seed=3)
    P.flat(g, rim & (Y >= 12), ST, 6)
    P.stone(g, rim & (Y >= 12), ST, 6, block=(5, 3), frame="top", seed=4)
    P.flat(g, bowl & (Y == 9), "purple", 3)  # the slate band right under the rim
    rad = S.ngon_radius(g, "y", CX, CZ)
    g.a[(rad < POOL) & (Y >= 11) & (Y < 13) & (g.a > 0)] = 0  # sink the pool two voxels
    pool = (rad < POOL) & (Y == WATER) & (g.a > 0)
    P.flat(g, pool, "toxic", 4)  # one continuous liquid surface
    P.flat(g, pool & (rad > POOL - 1.8), "toxic", 2)  # the dark waterline
    P.flat(g, rim & (Y == 10) & (rad >= POOL), ST, 4)  # wet stone inside the lip
    sr = np.hypot(X + 0.5 - SPLASH[0], Z + 0.5 - SPLASH[1])
    for cr in (4.5, 8.0, 11.5):  # ripple rings leaving the splash
        P.flat(g, pool & (np.abs(sr - cr) < 0.9), "toxic", 6)
    P.flat(g, pool & (sr < 3.5), "toxic", 7)
    P.flat(g, pool & (sr < 1.8), "bone", 7)
    from pnpaint import blotch

    blotch(g, union(g, rs) & (g.a > 0) & (rad >= POOL) & (Y < 13), "moss", 5, cell=3, chance=0.07, seed=5)
    del start


def pier(g: Grid) -> None:
    """An octagonal pier out of the liquid, with a flared slate-banded cap."""
    _X, Y, _Z = idx(g)
    start = len(g.solids)
    S.cone(g, "y", CX, CZ + 2, 7.5, WATER, 15, ST, 5, n=8, r_top=6.5)
    S.cone(g, "y", CX, CZ + 2, 7.5, 15, CAP, ST, 6, n=8, r_top=8.5)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, ST, 5, block=(6, 4), cracks=0.08, frame=fr, seed=6))
    m = union(g, start)
    P.flat(g, m & (Y >= 14) & (Y < 16), "purple", 3)  # the slate band under the cap
    P.flat(g, m & (Y == CAP - 1), ST, 7)
    P.flat(g, m & S.seams(g, g.solids[start:], 0.9), ST, 2)


def wings(g: Grid) -> np.ndarray:
    """Two broad folded wings behind the shoulders: one solid prism each
    (true slopes, no crossing spars), a violet membrane framed in stone with
    painted dark ribs fanning to every scallop."""
    X, Y, _Z = idx(g)
    start = len(g.solids)
    for s in (-1, 1):
        poly = [(CX + s * 3, Y0 + 7), (CX + s * 3, Y0 + 14),
                (CX + s * 12, Y0 + 22), (CX + s * 12, Y0 + 18),
                (CX + s * 8, Y0 + 19), (CX + s * 9, Y0 + 14),
                (CX + s * 5, Y0 + 16), (CX + s * 6, Y0 + 10)]
        g.prism("z", poly, 25, 28, C("purple", 4))
    wing = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, ST, 4, block=(5, 4), cracks=0.0, frame=fr, seed=8))
    P.flat(g, wing, "purple", 4)
    P.flat(g, wing & S.seams(g, g.solids[start:], 0.9), ST, 2)
    for s, ex, ey in ((-1, 12, 22), (-1, 12, 18), (-1, 8, 19), (-1, 6, 10),
                      (1, 12, 22), (1, 12, 18), (1, 8, 19), (1, 6, 10)):
        x0, y1 = CX + s * 3, Y0 + 8
        x1, y2 = CX + s * ex, Y0 + ey
        L = max(1.0, ((x1 - x0) ** 2 + (y2 - y1) ** 2) ** 0.5)
        dist = np.abs((x1 - x0) * (Y - y1) - (y2 - y1) * (X - x0)) / L
        along = ((X - x0) * (x1 - x0) + (Y - y1) * (y2 - y1)) / (L * L)
        rib = wing & (dist < 0.8) & (along >= 0) & (along <= 1) & ((_Z == 25) | (_Z == 27))
        P.flat(g, rib, ST, 2)
    return wing


def gargoyle(g: Grid) -> None:
    """The PN haunted gargoyle, perched over its own basin: crouched hind
    legs, a hunched chest leaning forward, thick forelegs gripping the cap
    with bone claws over the edge, a big horned head with a heavy brow, big
    toxic eyes, a jutting jaw with bone fangs and a glowing gullet, and a
    tail curling down into the water."""
    X, Y, Z = idx(g)
    cx = CX
    start = len(g.solids)
    for s in (-1, 1):  # crouched hind legs
        box(g, cx + s * 5 - 2.5, Y0, 18, cx + s * 5 + 2.5, Y0 + 6, 25, ST, 5)
        box(g, cx + s * 5 - 2.5, Y0, 15, cx + s * 5 + 2.5, Y0 + 2, 19, ST, 5)
    # a narrow chest leaves a clear gap round the forearms (rule F1)
    g.prism("x", [(Y0 + 3, 24), (Y0 + 3, 18), (Y0 + 14, 16), (Y0 + 16, 20), (Y0 + 12, 25)], cx - 4, cx + 4, C(ST, 4))
    for s in (-1, 1):  # forelegs down to the cap, claws over the ledge
        S.bar(g, "x", (Y0 + 11, 16), (Y0, 13), 2.8, cx + s * 6 - 1.4, cx + s * 6 + 1.4, ST, 4)
        for k in (-1, 0, 1):
            fx = round(cx + s * 6 + k * 1.2) + 0.5
            S.bar(g, "x", (Y0 + 1, 12.5), (Y0 - 2, 10.2), 1.6, fx - 0.5, fx + 0.5, "bone", 5)
    # the tail curls off the back and dips into the liquid
    S.bar(g, "x", (Y0 + 3, 25), (Y0 - 3, 28), 2.0, cx - 1, cx + 1, ST, 5)
    S.bar(g, "x", (Y0 - 3, 28), (Y0 - 7, 27.5), 1.8, cx - 1, cx + 1, ST, 5)
    g.prism("x", [(Y0 - 7, 26.5), (Y0 - 7, 28.5), (Y0 - 10, 27.5)], cx - 1.5, cx + 1.5, C(ST, 5))
    body_s = g.solids[start:]
    hs = len(g.solids)
    head = box(g, cx - 5, Y0 + 13, 11, cx + 5, Y0 + 21, 19, ST, 4)
    jaw = box(g, cx - 4.5, Y0 + 10, 9, cx + 4.5, Y0 + 14, 17, ST, 4)
    for s in (-1, 1):  # two swept horns and a pointed ear each side
        S.bar(g, "z", (cx + s * 4, Y0 + 20), (cx + s * 8, Y0 + 26), 2.4, 14, 16, ST, 4)
        g.prism("z", [(cx + s * 5, Y0 + 15), (cx + s * 5, Y0 + 19), (cx + s * 9, Y0 + 20)], 14.5, 16, C(ST, 6))
    head_s = g.solids[hs:]
    S.paint_facets(g, body_s + head_s, lambda gg, mm, fr: P.stone(gg, mm, ST, 4, block=(6, 4), cracks=0.0, frame=fr, seed=10))
    P.stone(g, head, ST, 4, block=(5, 4), cracks=0.0, seed=11)
    P.flat(g, union(g, start) & S.seams(g, body_s, 0.8), ST, 2)  # a dark edge frames every mass
    horns = np.zeros(g.shape, dtype=bool)
    for k in (0, 2):
        horns |= g.solids[hs + k].mask(g.shape)
    P.flat(g, horns, ST, 5)
    P.flat(g, horns & (Y > Y0 + 24), "bone", 5)
    # the face: a heavy brow, large toxic eyes, a nose notch and long fangs
    face = head & (Z == 11)
    P.flat(g, face & (Y >= Y0 + 18) & (Y <= Y0 + 19), ST, 2)
    for s in (-1, 1):
        eye = face & (np.abs(X + 0.5 - (cx + s * 2.5)) < 1.6) & (Y >= Y0 + 15) & (Y < Y0 + 18)
        P.flat(g, eye, "toxic", 6)
        P.flat(g, eye & (Y == Y0 + 17), "toxic", 7)
    P.flat(g, face & (Y == Y0 + 14) & (np.abs(X - cx) <= 1), ST, 2)
    # the open, glowing jaws: a dark gullet with a toxic throat and bone fangs
    mouth = jaw & (Z == 9) & (Y >= Y0 + 10) & (Y <= Y0 + 12)
    P.flat(g, mouth, "purple", 1)
    P.flat(g, mouth & (Y == Y0 + 10), "toxic", 5)
    fang = jaw & (Z == 9) & (Y >= Y0 + 10) & (Y <= Y0 + 13) & ((X == cx - 3) | (X == cx + 2))
    P.flat(g, fang, "bone", 7)
    P.flat(g, jaw & (Y == Y0 + 10) & (Z > 9), ST, 6)  # the lit top of the lower lip


def spout(g: Grid) -> None:
    """A thick arc of glowing liquid from the open jaws into the basin, and
    the splash where it lands."""
    _X, Y, Z = idx(g)
    mx, my, mz = MOUTH
    pts = [(my, mz), (my - 7.0, mz - 1.5), (WATER + 2.0, SPLASH[1])]
    for k in range(len(pts) - 1):
        m = S.bar(g, "x", pts[k], pts[k + 1], 3.0 - k * 0.6, mx - 1.6, mx + 1.6, "toxic", 4)
        P.flat(g, m, "toxic", 4)
        P.flat(g, m & (((Y + Z) % 4) == 0), "toxic", 6)
        P.outline(g, m, "toxic", 2, normal="x")
    splash = S.cone(g, "y", mx, SPLASH[1], 1.8, WATER + 1, WATER + 5, "toxic", 5, n=6, r_top=5.5)
    P.flat(g, splash & (Y > WATER + 2), "toxic", 6)
    P.flat(g, splash & (Y > WATER + 3), "toxic", 7)


def build():
    g = Grid(W, H, D)
    basin(g)
    pier(g)
    wing_m = wings(g)
    gargoyle(g)
    spout(g)
    _X, Y, _Z = idx(g)
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    stone_now = np.isin(g.a, [C(ST, k) for k in range(3, 7)])
    P.flat(g, up & stone_now & (Y > CAP + 4), ST, 6)  # light stone on the lit tops
    from pnpaint import blotch

    blotch(g, (stone_now | wing_m) & (Y > CAP) & (Y < CAP + 8), "moss", 5, cell=3, chance=0.08, seed=11)
    return single("gargoyle-fountain", "props", "Gargoyle Fountain", g,
                  sockets=[Socket("socket-spout", at=(MOUTH[0] - W / 2, MOUTH[1], MOUTH[2] - D / 2)),
                           Socket("socket-basin", at=(SPLASH[0] - W / 2, float(WATER + 3), SPLASH[1] - D / 2))],
                  pfx=[pfx("rvx-monster-witch-brew", "socket-basin", "idle", size=18),
                       pfx("rvx-monster-spore-glow", "socket-spout", "idle", size=12)])
