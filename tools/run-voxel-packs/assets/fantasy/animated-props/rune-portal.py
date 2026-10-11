"""Rune portal in the Pirate Nation style.

A round standing gate (rule K3): a full, thick ring of sixteen voussoir
blocks (true trapezoid prisms) that alternate cream sandstone and royal
blue glaze, with a glowing cyan rune on every blue block and a cyan glow
on the inner rim. Two sloped sandstone cradles clasp the lower ring on a
two-step dais; gold clasps with cyan gems stand out at both sides and a
big gold keystone with a pointed cap and a cyan gem crowns it, so the
silhouette reads as a ring from far away. Inside spins a vortex disc
painted as a blue and cyan spiral with a bright core. On `idle` the
vortex turns; on `active` it surges (fast spin, bulging). About 86 wide
and 95 tall (the PN pirate archway is 82x90); the opening is 55 across,
its sill a low step above the dais, so a person walks through. Faces -Z.
"""
import math

import numpy as np

import paint as P
from _life import asset, chamfer_rect, coords, facet_paint, front, keys, last, pfx, plan, rig
from pnglyph import stamp
from pnshapes import seams
from voxgrid import C, Clip, Grid, Socket, turn

K = 1.5  # design scale (the shapes were drawn at K = 1)
S = (90, 97, 36)
CX, CZ = 45.0, 18.0
DAIS = 6  # dais top
R_OUT, R_IN = 36.5, 27.5
CY = DAIS + R_OUT - 0.5  # ring centre: the full ring stands on the dais
DEPTH = 6.0  # ring half depth
N = 16
RUNES = [  # 3 wide, 5 tall, read from outside
    ["###", "#.#", "###", ".#.", ".#."],
    ["#.#", "#.#", ".#.", "#.#", "#.#"],
    [".#.", "###", ".#.", "###", ".#."],
    ["#..", "##.", "#.#", ".##", "..#"],
    ["###", ".#.", "###", ".#.", "###"],
    ["#.#", ".#.", "###", ".#.", "#.#"],
]


def clip_below(pts, ymin: float):
    """Clip a polygon (x, y) to y >= ymin (Sutherland-Hodgman); [] if none is left."""
    out = []
    for k in range(len(pts)):
        p, q = pts[k], pts[(k + 1) % len(pts)]
        pin, qin = p[1] >= ymin, q[1] >= ymin
        if pin:
            out.append(p)
        if pin != qin:
            t = (ymin - p[1]) / (q[1] - p[1])
            out.append((p[0] + t * (q[0] - p[0]), ymin))
    return out


def gem_point(g: Grid, cx: float, cy: float, z0: float, z1: float, r: float, toward: int) -> np.ndarray:
    """A hexagonal cyan gem pointing along z (toward -1: to the front)."""
    hexa = [(cx + r * math.cos(math.pi / 6 + k * math.pi / 3), cy + r * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
    if toward < 0:
        g.prism("z", [(cx, cy)] * 6, z0, z1, C("cyan", 5), top=hexa)
    else:
        g.prism("z", hexa, z0, z1, C("cyan", 5), top=[(cx, cy)] * 6)
    gm = last(g)
    k = [0]

    def facet(gg, mm, fr):
        k[0] += 1
        P.flat(gg, mm, "cyan", 4 + (k[0] % 2) * 2)

    facet_paint(g, [g.solids[-1]], facet)
    P.flat(g, gm & seams(g, [g.solids[-1]], 0.5), "cyan", 7)
    return gm


def portal() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    rr = np.hypot(X - CX, Y - CY)
    # the two-step dais (chamfered frustums), sandstone paving on top
    start = len(g.solids)
    dais = plan(g, chamfer_rect(1, 1, S[0] - 1, S[2] - 1, 4), 0, 3.5, "sand", 3, top=chamfer_rect(2.5, 2.5, S[0] - 2.5, S[2] - 2.5, 3.5))
    dais |= plan(g, chamfer_rect(7, 4, S[0] - 7, S[2] - 4, 3.5), 3.5, DAIS, "sand", 4, top=chamfer_rect(8.5, 5.5, S[0] - 8.5, S[2] - 5.5, 3))
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "sand", 4 if fr == "top" else 3, block=(6, 4) if fr == "top" else (5, 3), frame=fr, seed=1))
    P.flat(g, dais & seams(g, g.solids[start:], 0.5) & (Y > 2.5), "sand", 5)
    P.flat(g, dais & (Y < 1), "sand", 2)
    # a royal blue runner through the gate, trimmed in gold
    run = dais & (Y > DAIS - 1) & (np.abs(X - CX) < 7.5 * K)
    P.flat(g, run, "blue", 4)
    P.flat(g, run & (np.abs(np.abs(X - CX) - 6.5 * K) < 0.6), "gold", 5)
    # two sloped cradles clasp the lower ring (they stand deeper than the ring)
    start = len(g.solids)
    ang45 = math.radians(40)
    for s in (-1, 1):
        ex, ey = CX + s * (R_OUT + 1.0) * math.cos(ang45), CY - (R_OUT + 1.0) * math.sin(ang45)
        front(g, [(CX + s * 9 * K, DAIS), (CX + s * (R_OUT + 3), DAIS), (CX + s * (R_OUT + 3), DAIS + 2.5 * K), (ex, ey), (CX + s * 9 * K, DAIS + 1.5 * K)], CZ - DEPTH - 2, CZ + DEPTH + 2, "sand", 4)
    cradle = np.logical_or.reduce([sol.mask(S) for sol in g.solids[start:]])
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "sand", 4, block=(5, 3), frame=fr, seed=2))
    P.flat(g, cradle & seams(g, g.solids[start:], 0.55), "sand", 3)
    # the ring: sixteen voussoirs, cream and royal blue by turns
    co, ci = R_OUT / math.cos(math.pi / N), R_IN / math.cos(math.pi / N)
    ring = np.zeros(S, dtype=bool)
    for k in range(N):
        a0 = math.pi / 2 - math.pi / N + 2 * math.pi * k / N
        a1 = a0 + 2 * math.pi / N
        pts = [(CX + co * math.cos(a0), CY + co * math.sin(a0)), (CX + co * math.cos(a1), CY + co * math.sin(a1)),
               (CX + ci * math.cos(a1), CY + ci * math.sin(a1)), (CX + ci * math.cos(a0), CY + ci * math.sin(a0))]
        pts = clip_below(pts, DAIS - 0.5)
        if len(pts) < 3:
            continue
        blue = k % 2 == 1
        ramp, base = ("blue", 4) if blue else ("sand", 5)
        m = front(g, pts, CZ - DEPTH, CZ + DEPTH, ramp, base)
        solid = [g.solids[-1]]
        if blue:
            facet_paint(g, solid, lambda gg, mm, fr: P.mottle(gg, mm, "blue", 4, cell=3, seed=3))
        else:
            facet_paint(g, solid, lambda gg, mm, fr: P.stone(gg, mm, "sand", 5, block=(4, 3), frame=fr, seed=4 + k))
        P.flat(g, m & seams(g, solid, 0.55), ramp, base - 1)
        ring |= m
        mid = (a0 + a1) / 2
        if blue and math.sin(mid) > -0.45:  # a rune on the front and the back of every blue block above the cradles
            ux, uy = CX + (R_IN + R_OUT) / 2 * math.cos(mid), CY + (R_IN + R_OUT) / 2 * math.sin(mid)
            rows = RUNES[(k // 2) % len(RUNES)]
            for face, plane in (("-z", CZ - DEPTH), ("+z", CZ + DEPTH)):
                stamp(g, face, plane, int(round(ux - 3)), int(round(uy - 5)), rows, {"#": C("cyan", 7)}, scale=2)
    # a light outer rim line on the ring faces (the silhouette edge reads)
    P.flat(g, ring & ~cradle & (rr > R_OUT - 1.0) & (np.abs(Z - CZ) > DEPTH - 1), "sand", 6)
    # the inner rim glows with the vortex light
    rim = ring & (rr < R_IN + 1.2)
    P.flat(g, rim, "cyan", 5)
    P.flat(g, rim & (np.abs(Z - CZ) < DEPTH - 1), "cyan", 4)
    # gold clasps at both sides, each with a cyan gem to the front
    for s in (-1, 1):
        start = len(g.solids)
        x0, x1 = CX + s * (R_OUT - 3 * K), CX + s * (R_OUT + 3 * K)
        cl = front(g, [(x0, CY - 5 * K), (x1, CY - 3.5 * K), (x1, CY + 3.5 * K), (x0, CY + 5 * K)], CZ - DEPTH - 1, CZ + DEPTH + 1, "gold", 5)
        facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.flat(gg, mm, "gold", 6 if fr == "top" else 5))
        P.flat(g, cl & seams(g, g.solids[start:], 0.55), "gold", 4)
        P.flat(g, cl & (np.abs(Y - CY) < 0.6), "gold", 7)
        gem_point(g, CX + s * R_OUT, CY, CZ - DEPTH - 3.5, CZ - DEPTH - 1, 2.0 * K, -1)
    # the gold keystone with a pointed cap and a cyan gem pointing to the front
    ky = CY + R_OUT - 1
    start = len(g.solids)
    key = front(g, [(CX - 4.5 * K, ky - 3 * K), (CX + 4.5 * K, ky - 3 * K), (CX + 6 * K, ky + 4 * K), (CX - 6 * K, ky + 4 * K)], CZ - DEPTH - 1, CZ + DEPTH + 1, "gold", 5)
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.flat(gg, mm, "gold", 6 if fr == "top" else 5))
    P.flat(g, key & seams(g, g.solids[start:], 0.55), "gold", 4)
    cap = plan(g, [(CX - 6 * K, CZ - DEPTH - 1), (CX + 6 * K, CZ - DEPTH - 1), (CX + 6 * K, CZ + DEPTH + 1), (CX - 6 * K, CZ + DEPTH + 1)], ky + 4 * K, S[1] - 1.5, "gold", 6,
               top=[(CX, CZ)] * 4)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.flat(gg, mm, "gold", 6))
    P.flat(g, cap & seams(g, [g.solids[-1]], 0.5), "gold", 7)
    gy = ky + 0.5 * K
    gem_point(g, CX, gy, CZ - DEPTH - 4, CZ - DEPTH - 1, 2.8 * K, -1)
    gem_point(g, CX, gy, CZ + DEPTH + 1, CZ + DEPTH + 4, 2.8 * K, 1)
    return g


def vortex() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    n = 16
    poly = [(CX + (R_IN + 0.8) / math.cos(math.pi / n) * math.cos(2 * math.pi * k / n), CY + (R_IN + 0.8) / math.cos(math.pi / n) * math.sin(2 * math.pi * k / n)) for k in range(n)]
    m = front(g, poly, CZ - 3.5, CZ + 3.5, "blue", 4)
    # a faceted lens bulges out on each side (true slopes that catch the light)
    lens = lambda r: [(CX + r / math.cos(math.pi / n) * math.cos(2 * math.pi * k / n), CY + r / math.cos(math.pi / n) * math.sin(2 * math.pi * k / n)) for k in range(n)]  # noqa: E731
    g.prism("z", lens(9.0 * K), CZ - DEPTH - 0.5, CZ - 3.5, C("blue", 4), top=lens(R_IN - 1.5 * K))
    m |= g.solids[-1].mask(S)
    g.prism("z", lens(R_IN - 1.5 * K), CZ + 3.5, CZ + DEPTH + 0.5, C("blue", 4), top=lens(9.0 * K))
    m |= g.solids[-1].mask(S)
    rr = np.hypot(X - CX, Y - CY)
    ang = np.arctan2(Y - CY, X - CX)
    arm = np.floor((ang * 3 / (2 * math.pi) + rr * 0.08 / K) * 2).astype(int) % 2  # three spiral arms
    P._paint(g, m, "blue", np.where(arm == 0, 5, 4))
    P.flat(g, m & (arm == 0) & (rr < R_IN - 3 * K), "plasma", 5)
    P.flat(g, m & (arm == 0) & (rr < 13 * K), "plasma", 6)
    P.flat(g, m & (arm == 1) & (rr < 10 * K), "cyan", 5)
    P.flat(g, m & (arm == 0) & (rr < 9 * K), "plasma", 7)
    P.flat(g, m & (rr < 5.0 * K), "sky", 7)
    P.flat(g, m & (rr < 3.0 * K), "plasma", 7)
    P.flat(g, m & (rr > R_IN - 0.5), "blue", 3)  # a dark edge where the disc meets the ring
    return g


def build():
    c = (CX, CY, CZ)
    root, to_root = rig([("rune-portal", portal(), None, None), ("vortex", vortex(), c, None)])
    idle = {"vortex": {"rot": turn(3.0, "z", -120)}}
    active = {"vortex": {"rot": turn(1.0, "z", -720), "scale": keys((0, 1, 1, 1), (0.5, 1.04, 1.04, 2.5), (1.0, 1, 1, 1))}}
    return asset("animated-props", "rune-portal", "Rune Portal", root,
                 clips=[Clip("idle", idle), Clip("active", active)],
                 sockets=[Socket("socket-portal", at=to_root(c))],
                 fx=[pfx("rvx-fantasy-portal-swirl", "socket-portal", "idle", size=64, aim=(0.0, 0.0, 1.0)), pfx("rvx-fantasy-portal-swirl", "socket-portal", "idle", size=64, aim=(0.0, 0.0, -1.0))])
