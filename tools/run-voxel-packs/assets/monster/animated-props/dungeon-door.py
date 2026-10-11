"""Dungeon door, in the Pirate Nation haunted style.

A short grey stone wall section with a gabled coping and a thick pointed
arch (true-slope facets) of big light voussoir blocks, crowned by a giant
skull keystone (after the PN haunted archway and mausoleum skulls). In the
arch hangs a pointed oak door of vertical planks with 2-tall iron straps,
studs and a ring pull; a person walks through it. A small barred peephole
grate on the door slides aside and shows two glowing eyes inside.
Clips: open, close (one-shot; the door swings inward), idle (the grate
slides aside and back). Faces -Z.
"""
import math

import numpy as np

import paint as P
from _kit import keys, world
from _props import pn_flame
from _pn import assemble, coords, last
from pnkit import box
from pnshapes import facets
from pnshapes import skull as s3d
from voxgrid import C, Clip, Grid

S = (44, 53, 21)
CX = 22.0
A = 11.0  # half span of the opening
YS = 15.0  # springing line
RISE = 19.0
D = ((RISE ** 2) - A ** 2) / (2 * A)  # arc centres sit D past the middle
R = A + D
T = 5.0  # arch ring thickness
H = 48  # wall top
ZF, ZB = 11, 19  # wall front and back
ZRING = 8  # arch ring front (3 proud)
ZD0, ZD1 = 12, 15  # door leaf
N_ARC = 6


def arc(side: int, r: float, n: int = N_ARC):
    """Points (x, y) of one side of the pointed arch at radius r, from the
    springing line up to the apex (side -1: low x)."""
    cx = CX - side * D
    apex_y = YS + math.sqrt(r * r - D * D)
    a0 = math.pi if side < 0 else 0.0
    a1 = math.atan2(apex_y - YS, CX - cx)
    return [(cx + r * math.cos(a0 + (a1 - a0) * k / n), YS + r * math.sin(a0 + (a1 - a0) * k / n)) for k in range(n + 1)]


def apex(r: float) -> float:
    return YS + math.sqrt(r * r - D * D)


def opening(inset: float = 0.0):
    """The door-shaped opening outline, shrunk by `inset`."""
    left = arc(-1, R - inset)
    right = arc(1, R - inset)
    return [(CX - A + inset, 0.0), (CX + A - inset, 0.0)] + right[:-1] + [(CX, apex(R - inset))] + list(reversed(left[:-1]))


def half_width(y: float, inset: float = 0.0) -> float:
    if y <= YS:
        return A - inset
    r = R - inset
    return max(0.0, math.sqrt(max(0.0, r * r - (y - YS) ** 2)) - D)


def voussoir_paint(g: Grid, m: np.ndarray, n: int = 5) -> None:
    """Big light voussoir blocks: n radial blocks per side on the arch and
    5-voxel courses on the jambs, alternating shades 6/7 with dark mortar
    joints (rule S2)."""
    X, Y, Z = coords(g)
    xc, yc = X + 0.5, Y + 0.5
    side = np.where(xc < CX, -1, 1)
    ccx = CX - side * D
    span = math.atan2(apex(R) - YS, D)  # angle one side sweeps, springing to apex
    ang = np.arctan2(yc - YS, xc - ccx)
    a_rel = np.clip(np.where(side < 0, np.pi - ang, ang), 0, span)
    f = a_rel / span * n
    on_arc = yc > YS
    block = np.where(on_arc, 10 + np.floor(f).astype(int), (Y // 5).astype(int))
    shade = np.where((block + (side > 0)) % 2 == 0, 6, 7)
    rad = np.hypot(xc - ccx, yc - YS)
    joint_arc = on_arc & (np.abs(f - np.round(f)) * span / n * rad < 0.55) & (f > 0.5)
    joint_jamb = ~on_arc & (Y % 5 == 4)
    shade = np.where(joint_arc | joint_jamb, 4, shade)
    P._paint(g, m, "gray", shade)


def torch(g: Grid, x0: float, y0: float, zf: float) -> None:
    """An iron wall bracket holding a chunky torch with the shared PN flame."""
    X, Y, Z = coords(g)
    br = box(g, x0, y0 - 2, zf - 3, x0 + 2, y0, zf, "gray", 5)
    P.flat(g, br & (Y == y0 - 2), "gray", 3)
    stick = box(g, x0, y0, zf - 3, x0 + 2, y0 + 5, zf - 1, "skindark", 4)
    P.flat(g, stick & (Y >= y0 + 3), "gray", 4)  # iron cup
    cx, cz, top = x0 + 1, zf - 2, y0 + 5
    pn_flame(g, cx, cz, top, 6, 8, cross=0.7)


def vine(g: Grid, face: str, plane: int, x0: float, y0: int, y1: int, seed: int = 0) -> None:
    """A painted climbing vine on a wall face: a wavy 1-voxel stem with
    curled leaves every few rows, purple with magenta tips (paint only)."""
    zi = plane if face == "-z" else plane - 1
    for y in range(y0, y1):
        x = int(round(x0 + 1.4 * math.sin((y + seed) / 2.6)))
        if 0 <= x < S[0] and g.a[x, y, zi]:
            g.a[x, y, zi] = C("purple", 5)
        if (y + seed) % 5 == 0:
            d = 1 if ((y + seed) // 5) % 2 == 0 else -1
            for k, dy in ((1, 0), (2, 0), (2, 1)):
                xx = x + d * k
                if 0 <= xx < S[0] and g.a[xx, y + dy, zi]:
                    g.a[xx, y + dy, zi] = C("magenta", 5 if k < 2 else 6)


def arch() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # plinth course and threshold step
    plinth = box(g, 0, 0, ZF - 1, 44, 4, ZB + 1, "gray", 3)
    P.stone(g, plinth, "gray", 3, block=(9, 4), seed=1)
    step = box(g, CX - A - 3, 0, 5, CX + A + 3, 2, ZF - 1, "gray", 4)
    P.stone(g, step, "gray", 4, block=(8, 2), seed=2)
    # the wall: two piers and a top piece over the pointed opening
    walls = []
    g.prism("z", [(1, 4), (CX - A, 4), (CX - A, H), (1, H)], ZF, ZB, C("gray", 4))
    walls.append(g.solids[-1])
    g.prism("z", [(CX + A, 4), (43, 4), (43, H), (CX + A, H)], ZF, ZB, C("gray", 4))
    walls.append(g.solids[-1])
    top = [(CX + A, YS), (CX + A, H), (CX - A, H), (CX - A, YS)] + arc(-1, R)[1:-1] + [(CX, apex(R))] + list(reversed(arc(1, R)[1:-1]))
    g.prism("z", top, ZF, ZB, C("gray", 4))
    walls.append(g.solids[-1])
    # the wall is concave around the arch, so paint it in the plain wall
    # frame (per-facet frames would streak along the extended arc planes)
    wm = np.logical_or.reduce([w.mask(g.shape) for w in walls])
    P.stone(g, wm, "gray", 5, block=(8, 4), cracks=0.08, seed=3)
    # a light band and a gabled coping on top (true slopes)
    band = box(g, 0, H - 3, ZF - 1, 44, H, ZB + 1, "gray", 6)
    P.stone(g, band, "gray", 6, block=(10, 3), seed=4)
    g.prism("x", [(H, ZF - 1.5), (H, ZB + 1.5), (H + 5, (ZF + ZB) / 2)], 0, 44, C("purple", 4))
    cop = g.solids[-1]
    for fm, fr in facets(g, [cop]):
        P.tiles(g, fm, "purple", 4, row=3, width=4, frame=fr, seed=5)
    # the arch ring: jambs and voussoirs, 3 proud of the wall
    rings = []
    for s in (-1, 1):
        inner, outer = arc(s, R), arc(s, R + T)
        x_in, x_out = CX + s * A, CX + s * (A + T)
        pts = [(x_out, 4.0), (x_in, 4.0)] + inner[:-1] + [(CX, apex(R)), (CX, apex(R + T))] + list(reversed(outer[:-1]))
        g.prism("z", pts, ZRING, ZF, C("gray", 6))
        rings.append(g.solids[-1])
    ring = rings[0].mask(g.shape) | rings[1].mask(g.shape)
    voussoir_paint(g, ring)
    # the giant 3D skull keystone at the apex, glowing toxic eyes
    s3d(g, CX, apex(R) - 2, ZRING - 2.0, s=10, ramp="bone", base=6, eyes=("toxic", 7), seed=10)
    # two wall torches in iron brackets (warm, meaningful light, C3)
    for tx in (2.0, 40.0):
        torch(g, tx, 26, ZF)
    # purple vines climb the piers (the PN haunted archway motif), front and back
    for face, plane in (("-z", ZF), ("+z", ZB)):
        for x0, top in ((3.5, 30), (40.5, 26), (14.0, 12) if face == "+z" else (3.5, 30), (30.0, 12) if face == "+z" else (40.5, 26)):
            vine(g, face, plane, x0, 4, top, seed=int(x0) + (0 if face == "-z" else 50))
    # moss and grime at the foot of the wall
    low = (g.a > 0) & (Y < 7)
    P.grime(g, low, height=4, seed=6)
    P.flat(g, low & (Y >= 4) & (Y < 6) & ((P._hash(X // 2, Z, seed=7) % np.uint64(4)) == 0), "moss", 5)
    under = (g.a > 0) & (Y >= H - 4) & (Y < H - 1) & ((Z == ZF - 1) | (Z == ZB))
    P.flat(g, under & ((P._hash(X // 2, Y, seed=8) % np.uint64(3)) != 0) & (Y >= H - 3 + (X % 3 == 0)), "moss", 5)
    return g


def door() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    g.prism("z", opening(0.3), ZD0, ZD1, C("skindark", 4))
    leaf = g.solids[-1]
    m = last(g)
    for fm, fr in facets(g, [leaf]):
        P.planks(g, fm, "skindark", 4, width=4, across="x", length=(60, 61), nails=False, frame=fr, seed=9)
    front = m & (Z == ZD0)
    P.planks(g, front, "skindark", 5, width=4, across="x", length=(60, 61), nails=False, frame="z", seed=9)
    # iron straps 2 tall and 1 proud, with bright studs
    for sy in (4, 13, 27):
        hw = min(half_width(sy, 0.3), half_width(sy + 2, 0.3)) - 0.2
        st = box(g, CX - hw, sy, ZD0 - 1, CX + hw, sy + 2, ZD0, "gray", 4)
        P.flat(g, st & (Y == sy + 1) & ((X - int(CX)) % 3 == 0), "gray", 6)
        P.flat(g, st & (Y == sy) & ((X - int(CX)) % 3 == 0), "gray", 2)
    # the peephole window: dark with two glowing eyes watching
    win = front & (np.abs(X + 0.5 - CX) < 3.1) & (Y >= 20) & (Y < 25)
    P.flat(g, win, "purple", 1)
    P.flat(g, win & (Y >= 22) & (Y < 24) & (np.abs(np.abs(X + 0.5 - CX) - 1.5) < 0.6), "toxic", 7)
    frame = front & (np.abs(X + 0.5 - CX) < 4.1) & (Y >= 19) & (Y < 26) & ~win
    P.flat(g, frame, "gray", 4)
    # an iron ring pull on the free side
    ring = box(g, CX + 5, 15, ZD0 - 1, CX + 8, 18, ZD0, "gray", 5)
    P.flat(g, ring & (X == int(CX) + 6) & (Y == 16), "skindark", 2)
    P.outline(g, m & (Z == ZD0), "skindark", 2, normal="z")
    return g


def grate() -> Grid:
    """The sliding peephole grate: an iron frame with three bars."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = box(g, CX - 4, 19, ZD0 - 2, CX + 4, 20, ZD0 - 1, "gray", 5)
    m |= box(g, CX - 4, 25, ZD0 - 2, CX + 4, 26, ZD0 - 1, "gray", 5)
    for bx in (-4, -1.5, 1, 3):
        m |= box(g, CX + bx, 20, ZD0 - 2, CX + bx + 1, 25, ZD0 - 1, "gray", 5)
    P.flat(g, m & (Y == 25), "gray", 6)
    P.flat(g, m & (Y == 19), "gray", 3)
    return g


def build():
    parts = {"arch": arch(), "door": door(), "grate": grate()}
    hinge = (CX - A + 0.3, 0.0, float(ZD1))
    root = assemble(parts, [
        ("arch", None, (CX, 0.0, (ZF + ZB) / 2)),
        ("door", "arch", hinge),
        ("grate", "door", (CX, 19.0, float(ZD0 - 1))),
    ])
    z3 = (0, 0, 0)
    return world("dungeon-door", "animated-props", "Dungeon Door", root, clips=[
        Clip("open", {"door": {"rot": keys((0, z3), (0.15, (0, -6, 0)), (0.55, (0, -98, 0)), (0.7, (0, -88, 0)), (0.85, (0, -93, 0)), (0.95, (0, -92, 0)))}}, loop=False),
        Clip("close", {"door": {"rot": keys((0, (0, -92, 0)), (0.4, z3), (0.46, (0, -4, 0)), (0.54, z3))}}, loop=False),
        Clip("idle", {"grate": {"loc": keys((0, z3), (1.0, z3), (1.25, (7, 0, 0)), (2.4, (7, 0, 0)), (2.65, z3), (3.6, z3))}}),
    ])
