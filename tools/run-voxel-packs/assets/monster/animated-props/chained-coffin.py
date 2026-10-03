"""Chained coffin, in the Pirate Nation haunted style.

After PN decoration-1x2-coffin: a tapered hexagonal wooden coffin (true
slopes in plan and on the lid) lying half-sunk in a low grave mound of
dirt (a chamfered frustum with painted clods and moss). Two thick chains
cross over the lid in an X and meet under one oversized gold padlock
(the iconic feature, rule K3). Toxic-green curse light leaks from the lid
seam. A small leaning headstone stands at the head end.
Clips: idle (the coffin bucks and rattles in its chains), open (the chains
burst off, the lid flies up and flips aside). Faces -Z.
"""
import math

import numpy as np

import paint as P
from _kit import keys, pfx, world
from _pn import assemble, coords, last
from pnkit import box, edges
from pnshapes import facets, tombstone
from voxgrid import C, Clip, Grid, Socket

S = (30, 22, 26)
CX, CZ = 15, 12
X0, X1 = 5, 26  # coffin head (x0) and foot (x1)
XS = 11  # the shoulder (widest point)
HW_HEAD, HW_SH, HW_FOOT = 3.5, 5.5, 4.0
Y0, Y1, YL = 1, 7, 10  # body bottom, lid seam, lid top
MOUND = 4  # mound top height


def hexplan(d: float = 0.0):
    """The coffin plan (x, z), grown by d on every side."""
    return offset([(X0, CZ - HW_HEAD), (XS, CZ - HW_SH), (X1, CZ - HW_FOOT), (X1, CZ + HW_FOOT), (XS, CZ + HW_SH), (X0, CZ + HW_HEAD)], d)


def offset(pts, d: float):
    """Offset a convex counter-clockwise or clockwise polygon by d (out > 0)."""
    n = len(pts)
    area = sum(pts[k][0] * pts[(k + 1) % n][1] - pts[(k + 1) % n][0] * pts[k][1] for k in range(n))
    sgn = 1.0 if area < 0 else -1.0
    lines = []
    for k in range(n):
        (ax, ay), (bx, by) = pts[k], pts[(k + 1) % n]
        ex, ey = bx - ax, by - ay
        L = math.hypot(ex, ey)
        nx, ny = sgn * ey / L, -sgn * ex / L
        lines.append(((ax + nx * d, ay + ny * d), (ex, ey)))
    out = []
    for k in range(n):
        (p, r), (q, s) = lines[k - 1], lines[k]
        den = r[0] * s[1] - r[1] * s[0]
        t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den
        out.append((p[0] + r[0] * t, p[1] + r[1] * t))
    return out


def z_edge(x: float, side: int, d: float = 0.0) -> float:
    """z of the coffin's front (side -1) or back (+1) edge at x."""
    if x <= XS:
        hw = HW_HEAD + (HW_SH - HW_HEAD) * (x - X0) / (XS - X0)
    else:
        hw = HW_SH + (HW_FOOT - HW_SH) * (x - XS) / (X1 - XS)
    return CZ + side * (hw + d)


def grave() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    base = [(2, 5), (6, 2), (24, 2), (28, 5), (28, 19), (24, 22), (6, 22), (2, 19)]
    top = [(5, 7), (8, 5), (22, 5), (25, 7), (25, 17), (22, 19), (8, 19), (5, 17)]
    g.prism("y", base, 0, MOUND, C("skindark", 4), top=top)
    solid = g.solids[-1]
    m = last(g)
    for fm, fr in facets(g, [solid]):
        P.mottle(g, fm, "skindark", 4, cell=2, seed=1)
    # painted clods: lighter lumps with a dark underside, and moss tufts
    clod = m & ((P._hash(X // 2, Z // 2, seed=2) % np.uint64(9)) == 0)
    P.flat(g, clod, "skindark", 5)
    P.flat(g, m & ((P._hash(X // 2 + 1, Z // 2, seed=3) % np.uint64(11)) == 0), "skindark", 3)
    P.flat(g, m & (Y >= MOUND - 2) & ((P._hash(X // 3, Z // 3, seed=4) % np.uint64(5)) == 0), "moss", 5)
    P.flat(g, m & (Y == 0), "skindark", 3)
    # a small leaning headstone at the head end, a painted cross on it
    tombstone(g, 7.0, 20.0, w=8, h=13, t=3, y0=0, lean=-8, ramp="gray", base=6, glyph="cross", seed=5)
    return g


def coffin() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    g.prism("y", hexplan(), Y0, Y1, C("wood", 5))
    body = g.solids[-1]
    m = last(g)
    for fm, fr in facets(g, [body]):
        P.planks(g, fm, "wood", 5, width=3, across="y", length=(7, 11), frame=fr, seed=6)
    # inside (seen when the lid flies off): purple velvet, a wooden rim and
    # a painted skeleton with glowing eyes
    top = m & (Y == Y1 - 1)
    occ = g.a > 0
    side = np.zeros_like(occ)
    for ax in (0, 2):
        for st in (1, -1):
            nb = np.roll(occ, st, axis=ax)
            side |= occ & ~nb
    P.flat(g, top, "purple", 3)
    P.flat(g, top & ~side & (P._hash(X // 2, Z // 2, seed=9) % np.uint64(4) == 0), "purple", 4)
    rim = top & ((Y == Y1 - 1) & side)
    ring = top & ~rim & np.roll(rim, 1, 0) | top & ~rim & np.roll(rim, -1, 0) | top & ~rim & np.roll(rim, 1, 2) | top & ~rim & np.roll(rim, -1, 2)
    P.flat(g, ring, "wood", 6)
    bone = top & ~ring & ~rim
    sk = bone & (X >= X0 + 2) & (X < X0 + 6) & (np.abs(Z + 0.5 - CZ) < 2.1)
    P.flat(g, sk, "bone", 6)
    P.flat(g, sk & (X == X0 + 3) & (np.abs(Z + 0.5 - CZ) > 0.5) & (np.abs(Z + 0.5 - CZ) < 1.6), "toxic", 7)
    P.flat(g, bone & (X >= X0 + 6) & (X < X1 - 5) & (np.abs(Z + 0.5 - CZ) < 0.6), "bone", 6)  # spine
    P.flat(g, bone & (X >= X0 + 7) & (X < X0 + 13) & (X % 2 == 0) & (np.abs(Z + 0.5 - CZ) < 3.1), "bone", 5)  # ribs
    P.flat(g, bone & (X >= X1 - 6) & (X < X1 - 2) & (np.abs(np.abs(Z + 0.5 - CZ) - 1.5) < 0.6), "bone", 6)  # legs
    # curse light leaking from the lid seam (C3): the top side row glows toxic
    seam = rim & side
    P.flat(g, seam, "toxic", 5)
    P.flat(g, seam & ((P._hash(X, Z, seed=7) % np.uint64(3)) == 0), "toxic", 7)
    P.flat(g, m & (Y == Y1 - 2) & side, "wood", 3)
    # chunky gold handles on the long sides
    for hx in (XS + 1, XS + 8):
        for s in (-1, 1):
            z = z_edge(hx + 1.5, s, 0.4)
            hm = box(g, hx, 4, math.floor(z) if s > 0 else math.floor(z) - 1, hx + 4, 6, (math.floor(z) + 1) if s > 0 else math.floor(z), "gold", 5)
            P.flat(g, hm & (Y == 4), "gold", 3)
    return g


def lid() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    g.prism("y", hexplan(0.5), Y1, Y1 + 1.5, C("purple", 4))
    slab = g.solids[-1]
    g.prism("y", hexplan(0.5), Y1 + 1.5, YL, C("purple", 4), top=hexplan(-1.2))
    cap = g.solids[-1]
    lm = slab.mask(g.shape) | cap.mask(g.shape)
    for fm, fr in facets(g, [slab, cap]):
        P.planks(g, fm, "purple", 5, width=3, across="z" if fr == "top" else "y", length=(9, 14), frame=fr, seed=8)
    P.flat(g, lm & (Y == Y1), "purple", 2)  # dark lid lip (rule S4)
    # a painted bone cross at the head end of the lid
    top = lm & (Y == YL - 1)
    P.flat(g, top & (np.abs(Z + 0.5 - CZ) < 1.1) & (X >= X0 + 1) & (X < X0 + 7), "bone", 6)
    P.flat(g, top & (np.abs(X + 0.5 - (X0 + 4.5)) < 1.1) & (np.abs(Z + 0.5 - CZ) < 3.1), "bone", 6)
    return g


def link_run(g: Grid, p0, p1, y: float, n: int, ramp: str = "steel") -> np.ndarray:
    """A thick chain lying on a flat top from p0 to p1 (x, z): n links as
    true-slope y-prisms, flat links (wide, low) and edge links (narrow,
    tall) in turn, painted with a dark hole and a lit rim."""
    m = np.zeros(g.shape, dtype=bool)
    (ax, az), (bx, bz) = p0, p1
    L = math.hypot(bx - ax, bz - az)
    ux, uz = (bx - ax) / L, (bz - az) / L
    nx, nz = -uz, ux
    step = L / n
    for k in range(n):
        t0, t1 = k * step - 0.35, (k + 1) * step + 0.35
        flat_link = k % 2 == 0
        hw = 1.3 if flat_link else 0.8
        pts = [(ax + ux * t0 + nx * hw, az + uz * t0 + nz * hw), (ax + ux * t1 + nx * hw, az + uz * t1 + nz * hw),
               (ax + ux * t1 - nx * hw, az + uz * t1 - nz * hw), (ax + ux * t0 - nx * hw, az + uz * t0 - nz * hw)]
        g.prism("y", pts, y, y + (1.0 if flat_link else 2.0), C(ramp, 5 if flat_link else 4))
        lm = last(g)
        X, Y, Z = coords(g)
        if flat_link:  # the link hole: a dark slot along the middle
            mid = np.abs((X + 0.5 - ax) * nx + (Z + 0.5 - az) * nz) < 0.5
            along = (X + 0.5 - ax) * ux + (Z + 0.5 - az) * uz
            P.flat(g, lm & mid & (along > t0 + 1.0) & (along < t1 - 1.0), ramp, 1)
        m |= lm
    return m


def chains() -> tuple[Grid, tuple[float, float, float]]:
    g = Grid(*S)
    X, Y, Z = coords(g)
    xa, xb = XS - 2.5, X1 - 3.5  # where the X meets the lid edges
    ins = 1.6
    fa, ba = z_edge(xa, -1, -ins), z_edge(xa, 1, -ins)
    fb, bb = z_edge(xb, -1, -ins), z_edge(xb, 1, -ins)
    m = link_run(g, (xa, fa), (xb, bb), YL, 5)
    m |= link_run(g, (xa, ba), (xb, fb), YL, 5, ramp="steel")
    # the chains run down the lid slopes and the coffin sides into the dirt
    for x, s in ((xa, -1), (xa, 1), (xb, -1), (xb, 1)):
        z = z_edge(x, s, 0.6)
        zi = int(math.floor(z)) if s > 0 else int(math.floor(z)) - 1
        xi = int(round(x)) - 1
        for k, y in enumerate(range(YL, MOUND - 1, -2)):
            if k % 2 == 0:
                m |= box(g, xi, y - 2, zi, xi + 2, y + 1, zi + 1, "steel", 5)
            else:
                m |= box(g, xi + 0.5, y - 2, zi, xi + 1.5, y + 1, zi + 1, "steel", 4)
    P.flat(g, m & (Y >= YL + 1) & (((X + Z) % 3) == 0), "steel", 6)  # lit rims
    # the oversized gold padlock standing at the crossing, facing -z
    px, pz = (xa + xb) / 2, CZ
    y0 = YL + 1
    lock = box(g, px - 4, y0, pz - 1.5, px + 4, y0 + 7, pz + 1.5, "gold", 5)
    P.flat(g, edges(lock), "gold", 3)
    P.flat(g, lock & (Y == y0 + 6), "gold", 6)
    P.flat(g, lock & (Y == y0), "gold", 3)
    # the shackle: a thick steel hoop (two posts and a sloped-shoulder top)
    for sx in (-1, 1):
        box(g, px + sx * 2.5 - 1, y0 + 7, pz - 1, px + sx * 2.5 + 1, y0 + 9, pz + 1, "steel", 5)
    g.prism("z", [(px - 3.5, y0 + 9), (px + 3.5, y0 + 9), (px + 2, y0 + 11), (px - 2, y0 + 11)], pz - 1, pz + 1, C("steel", 6))
    g.prism("z", [(px - 1.5, y0 + 9), (px + 1.5, y0 + 9), (px + 0.8, y0 + 9.8), (px - 0.8, y0 + 9.8)], pz - 1, pz + 1, C("steel", 1))
    # a painted keyhole and a little skull stamp on the lock face
    front = lock & (Z == int(math.floor(pz - 1.5 + 0.5)))
    P.flat(g, front & (np.abs(X + 0.5 - px) < 1.1) & (Y >= y0 + 3) & (Y < y0 + 5), "purple", 1)
    P.flat(g, front & (np.abs(X + 0.5 - px) < 0.6) & (Y >= y0 + 1) & (Y < y0 + 3), "purple", 1)
    P.flat(g, front & (np.abs(X + 0.5 - px) >= 2.5) & (np.abs(X + 0.5 - px) < 3.5) & (Y == y0 + 5), "gold", 7)
    return g, (px, float(YL), pz)


def build():
    cg, lock_at = chains()
    parts = {"grave": grave(), "coffin": coffin(), "lid": lid(), "chains": cg}
    root_j = (CX, 0.0, CZ)
    coffin_j = ((X0 + X1) / 2, float(Y0), CZ)
    hinge = ((X0 + X1) / 2, float(Y1), CZ + HW_SH + 0.5)
    root = assemble(parts, [
        ("grave", None, root_j),
        ("coffin", "grave", coffin_j),
        ("lid", "coffin", hinge),
        ("chains", "lid", lock_at),
    ])
    z3 = (0, 0, 0)
    idle = {
        "coffin": {"rot": keys((0, z3), (0.12, (0, 0, 3)), (0.24, (0, 0, -2.5)), (0.36, (0, 0, 1)), (0.48, z3), (1.3, z3), (1.4, (-2, 0, 0)), (1.5, (1.5, 0, 0)), (1.6, z3), (2.4, z3)),
                   "loc": keys((0, z3), (0.12, (0, 1, 0)), (0.24, z3), (0.36, (0, 0.5, 0)), (0.48, z3), (1.3, z3), (1.4, (0, 0.8, 0)), (1.6, z3), (2.4, z3))},
        "lid": {"rot": keys((0, z3), (0.12, (4, 0, 0)), (0.24, z3), (0.36, (3, 0, 0)), (0.48, z3), (1.4, z3), (1.5, (3, 0, 0)), (1.6, z3), (2.4, z3))},
        "chains": {"loc": keys((0, z3), (0.12, (0, 0.5, 0)), (0.2, z3), (0.3, (0, 0.4, 0)), (0.4, z3), (2.4, z3))},
    }
    s1 = (1, 1, 1)
    gone = (0.05, 0.05, 0.05)
    open_k = {
        "coffin": {"loc": keys((0, z3), (0.08, (0, 1.5, 0)), (0.2, z3), (1.0, z3))},
        "chains": {"scale": keys((0, s1), (0.1, (1.3, 1.3, 1.3)), (0.35, gone), (1.0, gone)),
                   "loc": keys((0, z3), (0.1, (0, 2, 0)), (0.35, (0, 10, -4)), (1.0, (0, 10, -4))),
                   "rot": keys((0, z3), (0.35, (0, 200, 25)), (1.0, (0, 200, 25)))},
        "lid": {"rot": keys((0, z3), (0.1, (10, 0, 0)), (0.4, (140, 0, 0)), (0.55, (118, 0, 0)), (0.7, (126, 0, 0)), (1.0, (124, 0, 0))),
                "loc": keys((0, z3), (0.1, (0, 3, 0)), (0.4, (0, 4, 1)), (0.55, z3), (1.0, z3))},
    }
    sock = ((X0 + X1) / 2 - CX, YL + 1.0, CZ - CZ)
    return world("chained-coffin", "animated-props", "Chained Coffin", root,
                 clips=[Clip("idle", idle), Clip("open", open_k, loop=False)],
                 sockets=[Socket("socket-lid", at=sock, parent="lid")],
                 pfx=[pfx("rvx-monster-curse-cloud", "socket-lid", "clip:open", size=30, at=0.25)])
