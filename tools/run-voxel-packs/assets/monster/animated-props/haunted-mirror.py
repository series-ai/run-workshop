"""Haunted mirror, in the Pirate Nation haunted style.

A tall cheval mirror (rule K3: one iconic shape with a face): an oversized
gold frame with a pointed gothic top, purple trim, magenta gems and a
faceted gem crest; a glowing magenta glass with painted swirls; a chunky
pale ghost with huge hollow eyes and an open mouth floating in front of
the glass. The mirror swivels on gold pins between two wooden uprights
that stand on splayed claw feet. The frame, feet and ghost are true-slope
prisms; the grain, gilding, swirls and face are paint.

Parts: stand (root), mirror (tilts on the swivel pins), ghost (a child of
the mirror). Clips: idle (the mirror rocks, the ghost drifts; loops),
active (the ghost lunges out toward -z and swells, then returns). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _kit import keys, pfx, sway, world
from _pn import assemble, coords, last, stamp
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

SIZE = (36, 50, 22)
CX = 18.0
ZP0, ZP1 = 9, 12  # the uprights (z)
PIVOT_Y = 24.0  # the swivel pins
ZF = 8  # the frame front (z); the glass is 1 back, the back board behind
POST_X = ((3, 6), (30, 33))
TOP_POST = 34


def inset(poly, d: float):
    """Offset a convex polygon inward by d (a frame opening)."""
    area = sum(poly[k][0] * poly[(k + 1) % len(poly)][1] - poly[(k + 1) % len(poly)][0] * poly[k][1] for k in range(len(poly)))
    pts = poly if area > 0 else list(reversed(poly))
    n = len(pts)
    lines = []
    for k in range(n):
        (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % n]
        L = math.hypot(x1 - x0, y1 - y0)
        nx, ny = -(y1 - y0) / L, (x1 - x0) / L  # left normal = inward for CCW
        lines.append(((x0 + nx * d, y0 + ny * d), (x1 - x0, y1 - y0)))
    out = []
    for k in range(n):
        (p, r), (q, s) = lines[k - 1], lines[k]
        den = r[0] * s[1] - r[1] * s[0]
        t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den
        out.append((p[0] + r[0] * t, p[1] + r[1] * t))
    return out


# the frame outline (x, y): a chamfered foot, straight sides, a pointed top
OUTER = [(10, 7), (26, 7), (29, 10), (29, 32), (26.5, 37.5), (CX, 44), (9.5, 37.5), (7, 32), (7, 10)]
INNER = inset(OUTER, 3.2)


def stand() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    wood = np.zeros(g.shape, dtype=bool)
    for x0, x1 in POST_X:
        wood |= box(g, x0, 4, ZP0, x1, TOP_POST, ZP1, "wood", 6)
        # a splayed foot: a low bridge with sloped ends (side view y, z)
        g.prism("x", [(0, 2), (0, 19), (2.5, 19), (4.5, 14), (4.5, 7), (2.5, 2)], x0 - 0.5, x1 + 0.5, C("wood", 5))
        foot = last(g)
        P.planks(g, foot, "wood", 5, width=2, across="y", nails=False, frame="x", seed=int(x0))
        P.outline(g, foot, "wood", 4, normal="x")
        # gold claws at both toes (true slopes)
        for z_tip, z_base in ((0.2, 3.0), (20.8, 18.0)):
            g.prism("x", [(0, z_base), (2.6, z_base), (0, z_tip)] if z_tip < z_base else [(0, z_base), (0, z_tip), (2.6, z_base)], x0 - 0.5, x1 + 0.5, C("gold", 5))
            P.flat(g, last(g) & (Y == 0), "gold", 3)
        # a knob and a gold spike finial
        S.disc(g, "y", (x0 + x1) / 2, (ZP0 + ZP1) / 2, 2.4, TOP_POST, TOP_POST + 2, "wood", 5)
        P.flat(g, last(g), "wood", 6)
        S.cone(g, "y", (x0 + x1) / 2, (ZP0 + ZP1) / 2, 1.9, TOP_POST + 2, TOP_POST + 6, "gold", 5, n=4)
        P.flat(g, last(g) & (Y >= TOP_POST + 4), "gold", 6)
        # a gold swivel pin toward the mirror
        px0, px1 = (x1, x1 + 1) if x0 < CX else (x0 - 1, x0)
        box(g, px0, int(PIVOT_Y) - 1, ZP0, px1, int(PIVOT_Y) + 1, ZP1, "gold", 5)
        pin = box(g, x0 - 1, int(PIVOT_Y) - 2, ZP0 - 1, x1 + 1, int(PIVOT_Y) + 2, ZP1 + 1, "gold", 4)
        P.outline(g, pin, "gold", 3)
    rail = box(g, 6, 6, ZP0, 30, 9, ZP1, "wood", 5)
    P.planks(g, wood, "wood", 6, width=3, across="x", nails=False, grain=False, seed=3)
    P.planks(g, rail, "wood", 5, width=3, across="y", nails=True, seed=4)
    P.flat(g, wood & (Y == TOP_POST - 1), "wood", 7)
    return g


def mirror() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    # the frame ring as two halves (each a simple polygon), 3 deep: bottom
    # centre to the point along the outside, then back along the inside
    mid_o = ((OUTER[0][0] + OUTER[1][0]) / 2, OUTER[0][1])
    mid_i = ((INNER[0][0] + INNER[1][0]) / 2, INNER[0][1])
    halves = ([0, 8, 7, 6, 5], [1, 2, 3, 4, 5])
    frame = np.zeros(g.shape, dtype=bool)
    for ks in halves:
        pts = [mid_o] + [OUTER[k] for k in ks] + [INNER[k] for k in reversed(ks)] + [mid_i]
        g.prism("z", pts, ZF, ZF + 3, C("gold", 4))
        frame |= last(g)
    P.mottle(g, frame, "gold", 4, cell=2, seed=5)
    P.outline(g, frame, "gold", 2, normal="z")
    # purple trim on the lip around the opening
    from voxgrid import _inside_polygon
    inside_in = _inside_polygon(X + 0.5, Y + 0.5, INNER)
    lip = np.zeros(g.shape, dtype=bool)
    for ax, st in ((0, 1), (0, -1), (1, 1), (1, -1)):
        lip |= frame & np.roll(inside_in, st, axis=ax)
    P.flat(g, lip & (Z == ZF), "purple", 5)
    # the glowing glass, 1 back from the frame front
    g.prism("z", INNER, ZF + 1, ZF + 3, C("magenta", 6))
    glass = last(g)
    gx, gy = CX, 25.0
    ang = np.arctan2(Y + 0.5 - gy, X + 0.5 - gx)
    rad = np.hypot(X + 0.5 - gx, (Y + 0.5 - gy) * 0.8)
    swirl = np.sin(ang * 2 + rad * 0.55)
    P.flat(g, glass & (swirl > 0.5), "magenta", 7)
    P.flat(g, glass & (swirl < -0.7), "magenta", 5)
    P.flat(g, glass & (rad < 3.2), "magenta", 7)
    # the back board
    g.prism("z", OUTER, ZF + 3, ZF + 5, C("purple", 5))
    back = last(g)
    P.planks(g, back, "purple", 5, width=3, across="x", nails=False, grain=False, frame="z", seed=6)
    P.outline(g, back, "purple", 3, normal="z")
    # gems at the shoulders and the foot; a faceted gem crest on the point
    for gx0, gy0 in ((8.5, 33.5), (27.5, 33.5), (CX, 8.5)):
        stamp(g, "-z", ZF, int(gx0 - 1), int(gy0 - 1), ["mm", "mm"], {"m": C("magenta", 6)}, depth=1)
    g.prism("z", [(CX, 41.5), (CX + 2.6, 44.2), (CX, 47.2), (CX - 2.6, 44.2)], ZF - 1, ZF + 3, C("magenta", 5))
    gem = last(g)
    P.flat(g, gem & (X + 0.5 < CX) & (Y + 0.5 > 44.2), "magenta", 7)
    P.flat(g, gem & (X + 0.5 > CX) & (Y + 0.5 < 44.2), "magenta", 4)
    # swivel bosses on the frame sides
    for x0, x1 in ((6, 7), (29, 30)):
        box(g, x0, int(PIVOT_Y) - 1, ZF + 1, x1, int(PIVOT_Y) + 1, ZF + 4, "gold", 5)
    return g


GHOST = [(13.5, 25), (13.5, 31), (15, 33.5), (CX, 34.8), (21, 33.5), (22.5, 31), (22.5, 25), (23.5, 20.5), (21.5, 18), (20, 20.5), (CX, 16.8), (16, 20.5), (14.5, 18), (12.5, 20.5)]


def ghost() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    z0, z1 = ZF - 4, ZF - 1
    g.prism("z", GHOST, z0, z1, C("bone", 7))
    body = last(g)
    arms = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        g.prism("z", S.quad((CX + s * 3.5, 27.0), (CX + s * 8.5, 31.5), 1.6, 1.2, cap=0.8), z0 + 0.5, z1 - 0.5, C("bone", 7))
        arms |= last(g)
    m = body | arms
    P.mottle(g, m, "bone", 7, cell=2, seed=7)
    P.flat(g, m & (Z > z0), "bone", 6)
    P.flat(g, m & (Y < 23), "toxic", 7)
    P.flat(g, m & (Y < 20), "toxic", 6)
    rim = m & (Z == z0) & ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1))
    P.flat(g, rim & (Y >= 23), "bone", 5)
    # huge hollow eyes, a glint, and a wailing open mouth
    face = {"o": C("purple", 2), "g": C("toxic", 6), "m": C("purple", 2), "r": C("magenta", 4)}
    rows = [
        ".ooo..ooo.",
        "ogoo..ogoo",
        "oooo..oooo",
        "oooo..oooo",
        ".oo....oo.",
        "....mm....",
        "...mmmm...",
        "...mrrm...",
        "...mrrm...",
        "....mm....",
    ]
    stamp(g, "-z", z0, int(CX) - 5, 21, rows, face, depth=1)
    return g


def build():
    parts = {"stand": stand(), "mirror": mirror(), "ghost": ghost()}
    root_j = (CX, 0.0, (ZP0 + ZP1) / 2)
    swivel = (CX, PIVOT_Y, (ZP0 + ZP1) / 2)
    ghost_j = (CX, 26.0, ZF - 2.5)
    root = assemble(parts, [
        ("stand", None, root_j),
        ("mirror", "stand", swivel),
        ("ghost", "mirror", ghost_j),
    ])
    steps = 16
    drift = [(4.0 * i / steps, (round(1.0 * math.sin(2 * math.pi * i / steps), 4), round(1.5 * math.sin(4 * math.pi * i / steps), 4), 0.0)) for i in range(steps + 1)]
    idle = {"mirror": {"rot": sway(4.0, "x", 5.0, math.pi / 2)},
            "ghost": {"loc": drift}}
    active = {"ghost": {"loc": keys((0, (0, 0, 0)), (0.2, (0, 1, 2)), (0.45, (0, 3, -11)), (0.8, (0, 2, -10)), (1.3, (0, 0, 0))),
                        "scale": keys((0, (1, 1, 1)), (0.2, (0.9, 0.9, 0.9)), (0.45, (1.5, 1.5, 1.5)), (0.8, (1.4, 1.4, 1.4)), (1.3, (1, 1, 1)))},
              "mirror": {"rot": keys((0, (0, 0, 0)), (0.3, (-4, 0, 0)), (0.5, (3, 0, 0)), (0.7, (-2, 0, 0)), (1.0, (0, 0, 0)))}}
    glass = (0.0, 26.0 - root_j[1], ZF + 1 - root_j[2])
    return world("haunted-mirror", "animated-props", "Haunted Mirror", root,
                 clips=[Clip("idle", idle), Clip("active", active, loop=False)],
                 sockets=[Socket("socket-glass", at=glass, parent="mirror")],
                 pfx=[pfx("rvx-monster-ghost-wisps", "socket-glass", "idle", size=26)])
