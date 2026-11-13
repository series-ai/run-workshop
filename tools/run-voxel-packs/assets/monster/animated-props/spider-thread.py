"""Dangling spider, in the Pirate Nation haunted style.

A crooked dead-wood post on a mossy rock, with a bent arm (true slopes,
painted bark) and a cobweb of bone strands in its corner. From the arm a
silk thread hangs a chunky cartoon spider at a person's chest height: a
big faceted abdomen with a painted magenta skull mark, a chamfered head
with huge glowing eyes and bone fangs, and eight angled two-segment legs
(true-slope prisms). Detail is paint (rule S1).

Parts: stand (root), thread (scales in y from the arm to raise or lower
the spider), spider (follows the thread end). Clips: idle (the spider
bobs and turns; loops), attack (it drops and lunges; one shot). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _kit import keys, pfx, world
from _life import bark, chunk, moss_top, octo, stonework
from _pn import assemble, coords, last, stamp
from pnkit import box
from voxgrid import C, Clip, Grid, Part, Socket

SIZE = (40, 40, 18)
TZ0, TZ1 = 7, 12  # the tree plane (z)
SX, SZ = 26.5, 9.5  # the thread line (x, z)
THREAD_TOP, THREAD_BOT = 33, 26
L = THREAD_TOP - THREAD_BOT
SKULL = [".#####.", "#######", "#oo#oo#", "#oo#oo#", "###o###", ".#####.", ".#.#.#."]


def deep_glyph(g: Grid, mask: np.ndarray, rows, legend, u0: int, v0: int, plane: str) -> None:
    """Paint a glyph through a whole mask along one axis, so it shows on
    every facet it crosses (flat or slanted). plane 'xz': rows run from
    high z to low z (read from the front, looking down); 'xy': rows run
    from high y to low y, columns from high x to low x (read from +z)."""
    X, Y, Z = coords(g)
    h = len(rows)
    for r, row in enumerate(rows):
        for k, ch in enumerate(row):
            if ch not in legend:
                continue
            if plane == "xz":
                sel = (X == u0 + k) & (Z == v0 + h - 1 - r)
            else:
                sel = (X == u0 + len(row) - 1 - k) & (Y == v0 + h - 1 - r)
            hit = mask & sel
            g.a[hit] = legend[ch]


def grab(g: Grid, start: int):
    return g.solids[start:]


def qc(p0, p1, r0, r1, cap=0.5):
    """S.quad, clamped to the grid floor and its low sides."""
    return [(max(0.0, u), max(0.0, v)) for u, v in S.quad(p0, p1, r0, r1, cap=cap)]


def stand() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    # a mossy rock foot
    s0 = len(g.solids)
    rock = chunk(g, 6.5, SZ, 0, 3, 6.5, 5.5, 2.0, "gray", 5, taper=1.2)
    S.paint_facets(g, grab(g, s0), lambda gg, m, fr: stonework(gg, m, "gray", 5, block=(5, 3), frame=fr, seed=1))
    moss_top(g, rock, depth=1, seed=2)
    # the crooked post, its roots and the bent arm (true slopes)
    s1 = len(g.solids)
    segs = [
        ((6.5, 2.5), (7.5, 18.0), 2.9, 2.5, TZ0, TZ1),
        ((7.5, 17.0), (6.0, 33.5), 2.5, 2.1, TZ0 + 0.5, TZ1 - 0.5),
        ((6.0, 32.0), (16.0, 37.0), 2.0, 1.7, TZ0 + 0.5, TZ1 - 0.5),
        ((15.5, 37.0), (SX + 2.5, 33.0), 1.7, 1.4, TZ0 + 1, TZ1 - 1),
        ((4.5, 3.0), (0.4, 0.3), 1.6, 0.9, TZ0 + 1, TZ1 - 1),
        ((9.0, 3.0), (13.0, 0.3), 1.6, 0.9, TZ0 + 1, TZ1 - 1),
        ((6.8, 30.0), (3.0, 35.5), 1.1, 0.7, TZ0 + 1, TZ1 - 1),  # a dead twig
    ]
    for p0, p1, r0, r1, lo, hi in segs:
        g.prism("z", qc(p0, p1, r0, r1), lo, hi, C("wood", 5))
    # roots toward the front and back (side view y, z)
    g.prism("x", qc((3.0, SZ - 1.0), (0.3, SZ - 6.5), 1.5, 0.9), 5.5, 8.5, C("wood", 5))
    g.prism("x", qc((3.0, SZ + 1.0), (0.3, SZ + 6.5), 1.5, 0.9), 5.0, 8.0, C("wood", 5))
    wood = grab(g, s1)
    S.paint_facets(g, wood, lambda gg, m, fr: bark(gg, m, "wood", 5, frame=fr, seed=3))
    trunk = np.logical_or.reduce([sd.mask(g.shape) for sd in wood])
    P.flat(g, trunk & (Y >= 36), "wood", 6)
    # a knot hole and a painted notch on the post front
    stamp(g, "-z", TZ0, 6, 20, [".rr.", "rkkr", "rkkr", ".rr."], {"r": C("wood", 3), "k": C("purple", 2)}, depth=2)
    # the cobweb in the corner: bone strands (thin true-slope bars)
    corner = (8.8, 31.2)
    ends = [(9.3, 20.0), (17.0, 24.0), (21.5, 34.0)]
    for e in ends:
        S.bar(g, "z", corner, e, 1.1, SZ - 0.5, SZ + 0.5, "bone", 7)
    for f in (0.45, 0.8):
        pts = [(corner[0] + (e[0] - corner[0]) * f, corner[1] + (e[1] - corner[1]) * f) for e in ends]
        for a, b in zip(pts, pts[1:]):
            S.bar(g, "z", a, b, 1.1, SZ - 0.5, SZ + 0.5, "bone", 6)
    # a silk knot where the thread hangs
    box(g, int(SX) - 1, THREAD_TOP - 1, int(SZ) - 1, int(SX) + 2, THREAD_TOP + 1, int(SZ) + 2, "bone", 6)
    return g


def thread() -> Grid:
    g = Grid(*SIZE)
    m = box(g, int(SX), THREAD_BOT, int(SZ), int(SX) + 1, THREAD_TOP - 1, int(SZ) + 1, "bone", 7)
    _X, Y, _Z = coords(g)
    P.flat(g, m & (Y % 3 == 0), "bone", 6)
    return g


def spider() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    cy = THREAD_BOT - 5.5  # the abdomen centre
    # abdomen: an octagonal barrel along z with tapered ends
    s0 = len(g.solids)
    oct_ = lambda h, c: [(x, y) for x, y in reversed(octo(SX, cy, h, h, c))]  # noqa: E731
    g.prism("z", oct_(3.8, 1.4), 6.5, 8.5, C("purple", 5), top=oct_(5.5, 2.0))
    g.prism("z", oct_(5.5, 2.0), 8.5, 14.0, C("purple", 5))
    g.prism("z", oct_(5.5, 2.0), 14.0, 16.0, C("purple", 5), top=oct_(3.8, 1.4))
    abd = np.logical_or.reduce([sd.mask(g.shape) for sd in grab(g, s0)])
    P.mottle(g, abd, "purple", 5, cell=2, seed=4)
    P.flat(g, abd & (S.seams(g, grab(g, s0), 0.7)), "purple", 4)
    P.flat(g, abd & (Y + 0.5 > cy + 4.2), "purple", 6)
    # the skull mark on the back of the abdomen and on its top
    mark = {"#": C("magenta", 6), "o": C("purple", 2)}
    deep_glyph(g, abd & (Y + 0.5 > cy + 2.5), SKULL, mark, int(SX) - 3, 8, "xz")
    deep_glyph(g, abd & (Z + 0.5 > 14.0), SKULL, mark, int(SX) - 3, int(cy) - 3, "xy")
    # head: a chamfered block in front
    s1 = len(g.solids)
    head_c = (SX, cy - 3.3)
    hp = [(SX - 3.5 + 1.2, head_c[1] - 2.8), (SX + 3.5 - 1.2, head_c[1] - 2.8), (SX + 3.5, head_c[1] - 1.6), (SX + 3.5, head_c[1] + 1.6),
          (SX + 2.3, head_c[1] + 2.8), (SX - 2.3, head_c[1] + 2.8), (SX - 3.5, head_c[1] + 1.6), (SX - 3.5, head_c[1] - 1.6)]
    g.prism("z", hp, 2.0, 7.5, C("purple", 4))
    head = last(g)
    P.mottle(g, head, "purple", 4, cell=2, seed=5)
    P.outline(g, head, "purple", 3, normal="z")
    # huge glowing eyes, two small ones above, and bone fangs
    eye = {"o": C("toxic", 6), "w": C("toxic", 7), "r": C("purple", 2), "s": C("toxic", 5)}
    rows = [
        ".s...s.",
        "rrr.rrr",
        "rwo.rwo",
        "roo.roo",
    ]
    stamp(g, "-z", 2, int(SX) - 3, int(head_c[1]) - 2, rows, eye, depth=2)
    for s in (-1, 1):
        g.prism("z", [(SX + s * 0.4, head_c[1] - 2.6), (SX + s * 2.2, head_c[1] - 2.6), (SX + s * 1.3, head_c[1] - 5.4)], 2.0, 3.6, C("bone", 7))
    return g


HIPS = [(3.5, 32.0), (5.0, 12.0), (6.5, -12.0), (8.0, -32.0)]  # (z, yaw) front to back


def leg(k: int, side: int) -> tuple[Grid, tuple[float, float, float]]:
    """One two-segment leg (knee up, tip down, true slopes) in its own grid,
    reaching toward +x (side 1) or -x (side -1). Returns (grid, hip point)."""
    g = Grid(14, 14, 3)
    _X, Y, _Z = coords(g)
    hip = (1.5, 7.0)
    knee = (6.0 + 0.8 * (k % 2), 11.2 - 0.4 * k)
    tip = (10.2 + 0.6 * ((k + (side > 0)) % 3), 0.6 + 0.3 * k)
    g.prism("z", S.quad(hip, knee, 1.35, 1.2, cap=0.4), 0.2, 2.8, C("purple", 3))
    m = last(g)
    g.prism("z", S.quad(knee, tip, 1.2, 0.7, cap=0.9), 0.2, 2.8, C("purple", 3))
    m |= last(g)
    P.flat(g, m & (Y >= 9), "purple", 5)  # a lit knee
    P.flat(g, m & (Y <= 2), "magenta", 4)  # a magenta foot
    if side < 0:
        g = g.flip("x")
        return g, (14 - hip[0], hip[1], 1.5)
    return g, (hip[0], hip[1], 1.5)


def build():
    parts = {"stand": stand(), "thread": thread(), "spider": spider()}
    top = (SX, float(THREAD_TOP - 1), SZ)
    bot = (SX, float(THREAD_BOT), SZ)
    root_j = (6.5, 0.0, SZ)
    root = assemble(parts, [
        ("stand", None, root_j),
        ("thread", "stand", top),
        ("spider", "stand", bot),
    ])
    # eight legs as child parts fanned out about y at rest (rule F2)
    body = next(p for p in root.walk() if p.name == "spider")
    cy = THREAD_BOT - 5.5
    for k, (zc, yaw) in enumerate(HIPS):
        for side in (-1, 1):
            lg, pv = leg(k, side)
            hip = (SX + side * 3.0, cy - 2.5, zc)
            name = f"leg-{'l' if side < 0 else 'r'}{k}"
            body.add(Part(name, lg, pivot=pv, at=(hip[0] - bot[0], hip[1] - bot[1], hip[2] - bot[2]), rot=(0.0, side * yaw, 0.0)))
    span = THREAD_TOP - 1 - THREAD_BOT  # the thread length

    def drop(s: float):
        # the spider follows the thread end when the thread scales by s
        return (0.0, -span * (s - 1.0), 0.0)

    n = 12
    bobs = [1.0 + 0.35 * math.sin(2 * math.pi * i / n) for i in range(n + 1)]
    bobs[-1] = bobs[0]
    ts = [3.0 * i / n for i in range(n + 1)]
    turn = [(t, (0.0, round(22.0 * math.sin(2 * math.pi * i / n + 1.0), 4), 0.0)) for i, t in enumerate(ts)]
    turn[-1] = (ts[-1], turn[0][1])
    idle = {"thread": {"scale": [(t, (1.0, b, 1.0)) for t, b in zip(ts, bobs)]},
            "spider": {"loc": [(t, drop(b)) for t, b in zip(ts, bobs)], "rot": turn}}
    seq = [(0.0, 1.0, (0, 0, 0), (0, 0, 0)), (0.18, 0.7, (0, 0, 0), (12, 0, 0)), (0.4, 2.1, (0, 0, -5), (-35, 0, 0)),
           (0.6, 1.9, (0, 0, -4), (-25, 0, 0)), (1.1, 1.0, (0, 0, 0), (0, 0, 0))]
    attack = {"thread": {"scale": keys(*[(t, (1, s, 1)) for t, s, _l, _r in seq])},
              "spider": {"loc": keys(*[(t, (lz[0], drop(s)[1] + lz[1], lz[2])) for t, s, lz, _r in seq]),
                         "rot": keys(*[(t, r) for t, _s, _l, r in seq])}}
    web = (SX - root_j[0], THREAD_BOT - 9.0 - root_j[1], 2.0 - root_j[2])
    return world("spider-thread", "animated-props", "Dangling Spider", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False)],
                 sockets=[Socket("socket-web", at=web, parent="spider")],
                 pfx=[pfx("rvx-monster-web-burst", "socket-web", "clip:attack", size=24, at=0.44)])
