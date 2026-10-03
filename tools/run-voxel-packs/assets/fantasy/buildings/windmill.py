"""Windmill in the Pirate Nation style.

A tapering octagonal tower (true slopes) of cream plaster on a sandstone
base, dark timber on every corner, painted windows that follow the
slope, and a steep red tile cone cap that leans a little (F5). The
oversized function prop is the set of four huge lattice sails (true
diagonals at rest) with cream canvas and dark lattice lines, turning on a
gold hub: slowly on `idle`, fast on `spin`. Flour sacks, a crate, a cart
wheel and a sack-hoist beam finish it. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _bld import FRONT, arch_door, cone_roof, drum, icon, icon_size, idx, sack, sandstone_painter
from pnkit import box, crate, face_prism
from voxgrid import C, Asset, Clip, Grid, Part, turn

W, H, D = 112, 146, 80
CX, CZ = 56, 44
R0, R1 = 22, 15  # plaster tower flat radius at the base and at the top
Y0, Y1 = 14, 82
CAP = 30
HUB = (CX, 90, CZ - R1 - 9)  # sail hub (x, y, z)
SAIL = 50  # sail reach from the hub


def tower() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = idx(g)
    drum(g, CX, CZ, 0, 4, R0 + 5, "sand", 3, painter=sandstone_painter(3, (9, 4), 0.0, seed=1))
    drum(g, CX, CZ, 4, Y0, R0 + 2, "sand", 4, r_top=R0 + 1, painter=sandstone_painter(4, (8, 5), seed=2))
    g.prism("y", S.flat_ngon(CX, CZ, R0, 8, FRONT), Y0, Y1, C("sand", 6), top=S.flat_ngon(CX, CZ, R1, 8, FRONT))
    solid = [g.solids[-1]]
    body = g.solids[-1].mask(g.shape)
    P.mottle(g, body, "sand", 6, seed=3)
    P.flat(g, body & S.seams(g, solid, 1.6), "darkwood", 4)  # corner timbers
    for yb in (Y0, 46):
        P.flat(g, body & (Y >= yb) & (Y < yb + 3), "darkwood", 4)
    # painted windows that follow the tapering facets
    for m, fr in S.facets(g, solid):
        if fr == "top":
            continue
        u, v = P.uv(g, fr)
        uc = int(np.round(np.median(u[m])))
        for wy in (30, 60):
            win = m & (np.abs(u - uc) <= 3) & (Y >= wy) & (Y < wy + 9)
            if not win.any():
                continue
            P.flat(g, win, "gold", 6)
            P.flat(g, win & ((np.abs(u - uc) == 3) | (Y == wy) | (Y == wy + 8) | (u == uc) | (Y == wy + 4)), "darkwood", 3)
    drum(g, CX, CZ, Y1, Y1 + 3, R1 + 3, "darkwood", 3, painter=lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 3, width=3, across="y", frame=fr))
    cone_roof(g, CX, CZ, Y1 + 3, R1 + 5, CAP, "red", 4, lean=(1.5, 2.0), trim=("darkwood", 3), eave=("red", 2), seed=4)
    # the windshaft out of the cap to the hub
    shaft = box(g, CX - 2, HUB[1] - 2, HUB[2], CX + 2, HUB[1] + 2, CZ - R1 + 2, "darkwood", 3)
    P.planks(g, shaft, "darkwood", 3, width=4, across="z", nails=False)
    # door on the base front, with a flour-sack sign over it
    front = CZ - R0 - 1
    arch_door(g, "-z", front, CX - 8, CX + 8, 4, 30, frame=("sand", 5), seed=5)
    iw, ih = icon_size("sack", 2)
    sign = face_prism(g, "-z", CZ - R0 + 1, [(CX - 9, 36), (CX + 9, 36), (CX + 9, 54), (CX - 9, 54)], 0, 3, C("wood", 5))
    P.planks(g, sign, "wood", 5, width=3, across="y", nails=False, seed=6)
    P.outline(g, sign, "darkwood", 3, normal="z")
    icon(g, "-z", CZ - R0 - 2, CX - iw // 2, 38, "sack", "sand", 6, scale=2, inks={"-": ("sand", 4)})
    # a hoist beam with a hanging sack on the right side
    box(g, CX + R1 + 1, 70, CZ - 2, CX + R1 + 14, 73, CZ + 2, "darkwood", 3)
    box(g, CX + R1 + 11, 58, CZ - 1, CX + R1 + 12, 70, CZ, "sand", 3)
    sack(g, CX + R1 + 11.5, CZ - 0.5, 50, w=8, h=9)
    # props at the base (K1)
    for sx, sz, h in ((CX - 30, CZ - 18, 10), (CX - 22, CZ - 24, 9), (CX - 27, CZ - 27, 8)):
        sack(g, sx, sz, 0, w=9, h=h)
    crate(g, CX + 20, 0, CZ - 30, 10, seed=7)
    S.wheel(g, "x", CZ - 14, 0, 9, CX + 32, CX + 35, spokes=6, gaps=True)
    P.grime(g, (g.a > 0) & (Y < 10) & ~g.solid_mask(), height=4, seed=8)
    return g


def sails() -> tuple[Grid, tuple[int, int, int]]:
    """Four lattice sails on a gold hub, turned 45° so every arm is a true diagonal."""
    n = 2 * SAIL + 4
    o = (HUB[0] - n // 2, HUB[1] - n // 2, HUB[2] - 6)
    g = Grid(n, n, 6)
    hx, hy = n / 2, n / 2
    X, Y, Z = S.coords(g)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        ua, va = math.cos(a), math.sin(a)
        na, nb = -va, ua  # the canvas side of the arm
        tip = (hx + ua * SAIL, hy + va * SAIL)
        S.bar(g, "z", (hx + ua * 3, hy + va * 3), tip, 3.2, 1, 5, "darkwood", 4)
        r0, r1, w = 11, SAIL - 1, 13
        quad = [(hx + ua * r0 + na * 1.5, hy + va * r0 + nb * 1.5), (hx + ua * r1 + na * 1.5, hy + va * r1 + nb * 1.5),
                (hx + ua * r1 + na * w, hy + va * r1 + nb * w), (hx + ua * r0 + na * (w - 2), hy + va * r0 + nb * (w - 2))]
        g.prism("z", quad, 2, 4, C("bone", 6))
        cm = g.solids[-1].mask(g.shape)
        along = (X - hx) * ua + (Y - hy) * va
        across = (X - hx) * na + (Y - hy) * nb
        P.mottle(g, cm, "bone", 6, cell=3, seed=k)
        lat = cm & ((np.abs(((along - r0) % 9) - 0.5) < 0.6) | (np.abs(across - 7.5) < 0.6))
        P.flat(g, lat, "wood", 5)
        P.outline(g, cm, "wood", 4, normal="z")
    S.disc(g, "z", hx, hy, 5, 0, 6, "gold", 4)
    P.flat(g, g.solids[-1].mask(g.shape) & (S.radial(g, "z", hx, hy) < 2.2), "gold", 6)
    return g, o


def build() -> Asset:
    g = tower()
    sg, o = sails()
    root = Part("windmill", g)
    hinge = (HUB[0], HUB[1], HUB[2] - 3)
    root.add(Part("sails", sg, pivot=(hinge[0] - o[0], hinge[1] - o[1], hinge[2] - o[2]), at=hinge))
    return Asset(id="fantasy-buildings-windmill", pack="fantasy", category="buildings", name="Windmill", root=root,
                 clips=[Clip("idle", {"sails": {"rot": turn(6.0, "z", -60)}}), Clip("spin", {"sails": {"rot": turn(2.0, "z", -180)}})])
