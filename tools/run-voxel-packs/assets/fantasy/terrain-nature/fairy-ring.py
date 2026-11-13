"""Fairy ring in the Pirate Nation style.

A low grassy mound (a 12-sided frustum) with a painted glowing cyan circle,
a ring of eleven chunky toadstools (faceted domes on frustum stems; red with
cream spots, three royal-blue), wildflowers, and a mossy tree stump at the
centre (a sloped faceted frustum with painted growth rings). Over the stump
hovers a glowing sprite: a cyan gem body, a cream head and two pairs of
sky-blue wings. The sprite bobs and turns on `idle` while its wings flap;
the healing-sparkle PFX plays at `socket-sprite`.

About 44 wide and 27 tall (terrain class). Faces -Z.
"""
import math

import numpy as np

import paint as P
from _life import asset, coords, facet_paint, front, grass, ngon, pfx, plan, rig, trunk
from voxgrid import C, Clip, Grid, Socket

S = (50, 30, 50)
CX = CZ = 25.0
SY = 17.0  # sprite body centre height
GOLDEN = math.pi * (3 - math.sqrt(5))


def toadstool(g: Grid, x, z, h, r, cap: str, spot: tuple, turn: float, lean: float) -> None:
    """A small chunky toadstool on the mound top (y=2.5): a stem frustum and
    a two-step faceted cap with round painted spots."""
    X, Y, Z = coords(g)
    rs = max(1.3, r * 0.4)
    y0 = 2
    yc = y0 + h - max(3, round(r * 0.9))
    tx = x + lean * math.cos(turn)
    tz = z + lean * math.sin(turn)
    plan(g, ngon(x, z, rs * 1.25, 6, turn), y0, yc + 1, "bone", 5, top=ngon(tx, tz, rs, 6, turn))
    st = len(g.solids)
    m = plan(g, ngon(tx, tz, r * 0.55, 8, turn), yc, yc + 1, cap, 3, top=ngon(tx, tz, r, 8, turn))
    ym = yc + 1 + max(1, round(r * 0.4))
    m |= plan(g, ngon(tx, tz, r, 8, turn), yc + 1, ym, cap, 4, top=ngon(tx, tz, r * 0.8, 8, turn))
    m |= plan(g, ngon(tx, tz, r * 0.8, 8, turn), ym, y0 + h, cap, 4, top=ngon(tx, tz, r * 0.3, 8, turn))
    facet_paint(g, g.solids[st:], lambda gg, mm, fr: P.flat(gg, mm, cap, 5 if fr == "top" else 4))
    P.flat(g, m & (Y < yc + 1), "sand", 5)  # gills in shade
    for k in range(3):
        a = turn + k * GOLDEN * 2.3
        sr = r * (0.15 if k == 0 else 0.72)
        sy = y0 + h - (0.6 if k == 0 else (h - (ym - y0)) * 0.9 + 0.8)
        d = np.sqrt((X - tx - sr * math.cos(a)) ** 2 + (Y - sy) ** 2 + (Z - tz - sr * math.sin(a)) ** 2)
        P.flat(g, m & (d < max(1.0, r * 0.26)) & (Y > yc + 1), *spot)


def ring() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Zi = np.floor(X).astype(int), np.floor(Z).astype(int)
    jit = [1.0, 0.95, 1.04, 0.97, 1.03, 0.94, 1.05, 0.98, 1.02, 0.95, 1.04, 0.97]
    mound = plan(g, ngon(CX, CZ, 23, 12, 0.1, jit), 0, 2, "leaf", 4, top=ngon(CX, CZ, 21, 12, 0.1, jit))
    top = mound & (Y > 1)
    cell = P._hash(Xi // 3, Zi // 3, seed=3) % np.uint64(6)
    P.flat(g, top & (cell == 1), "leaf", 5)
    P.flat(g, top & (cell == 2), "leaf", 3)
    P.flat(g, mound & (Y < 1), "moss", 4)
    d = np.hypot(X - CX, Z - CZ)
    # the fairy circle: lush dark grass under the toadstools and a glowing inner line
    P.flat(g, top & (d > 12.5) & (d < 17.5), "forest", 5)
    P.flat(g, top & (d > 9.3) & (d < 10.8), "plasma", 6)
    P.flat(g, top & (d > 9.6) & (d < 10.5) & ((np.floor(np.arctan2(Z - CZ, X - CX) * 5).astype(int) % 3) == 0), "plasma", 7)
    # toadstools round the circle
    for k in range(11):
        th = k * 2 * math.pi / 11 + 0.15
        rr = 15 + (k % 3) * 0.8
        h = 6 + (k * 5) % 4
        r = 2.8 + ((k * 7) % 3) * 0.6
        blue = k in (2, 6, 9)
        toadstool(g, CX + rr * math.cos(th), CZ + rr * math.sin(th), h, r, "blue" if blue else "red", ("sky", 7) if blue else ("bone", 7), th, 0.6)
    # wildflowers (2×2 heads on short stems)
    for k, (fx, fz, ramp) in enumerate(((CX - 6, CZ - 5, "pink"), (CX + 7, CZ - 3, "gold"), (CX + 4, CZ + 7, "sky"), (CX - 7, CZ + 5, "gold"),
                                        (CX - 20, CZ - 3, "pink"), (CX + 19, CZ + 8, "sky"), (CX + 2, CZ - 20, "gold"))):
        x, z = int(fx), int(fz)
        g.box(x, 2, z, x + 1, 4, z + 1, C("leaf", 3))
        g.box(x - 1, 4, z - 1, x + 1, 5, z + 1, C(ramp, 6))
    grass(g, [(int(CX) - 13, 2, int(CZ) - 12), (int(CX) + 12, 2, int(CZ) + 13), (int(CX) + 16, 2, int(CZ) - 9), (int(CX) - 16, 2, int(CZ) + 11)], "leaf", 5)
    # the stump: a sloped faceted frustum, growth rings on the cut top, a moss cap
    stump = trunk(g, [(CX, 2, CZ), (CX + 0.4, 5, CZ), (CX + 0.6, 8, CZ + 0.3)], [5.5, 4.2, 3.9], ramp="wood", base=4, n=8, turn=0.2, seed=5)
    cut = stump & (Y > 7)
    dd = np.hypot(X - CX - 0.6, Z - CZ - 0.3)
    P.flat(g, cut, "wood", 6)
    P.flat(g, cut & (np.floor(dd).astype(int) % 2 == 1), "wood", 5)
    P.flat(g, cut & (dd > 3.0), "wood", 3)
    P.flat(g, cut & (X - CX > 1.0) & (Z - CZ > -1.0) & (dd < 3.0), "moss", 6)
    return g


def sprite() -> Grid:
    g = Grid(*S)
    # a glowing gem body (double pyramid) and a cream head
    plan(g, [(CX, CZ)] * 6, SY - 6, SY, "plasma", 5, top=ngon(CX, CZ, 3.3, 6, 0.0))
    plan(g, ngon(CX, CZ, 3.3, 6, 0.0), SY, SY + 2, "plasma", 6, top=ngon(CX, CZ, 2.0, 6, 0.0))
    head = plan(g, ngon(CX, CZ, 2.6, 8, math.pi / 8), SY + 2, SY + 6, "bone", 7, top=ngon(CX, CZ, 2.0, 8, math.pi / 8))
    X, Y, Z = coords(g)
    P.flat(g, head & (Y > SY + 5), "gold", 7)  # a gold crown of hair
    P.flat(g, head & (Y > SY + 3) & (Y < SY + 4) & (Z < CZ - 1.5) & (np.abs(X - CX) > 0.6) & (np.abs(X - CX) < 1.6), "blue", 3)  # eyes
    return g


def wing(side: int) -> Grid:
    """Two wing blades on one side (side = -1 left, +1 right), 1 voxel thick."""
    g = Grid(*S)
    s = side
    up = [(CX + s * 1.5, SY + 1), (CX + s * 4.0, SY + 6), (CX + s * 7.0, SY + 5.5), (CX + s * 6.5, SY + 2.0)]
    lo = [(CX + s * 1.5, SY - 0.5), (CX + s * 5.5, SY - 1.0), (CX + s * 5.0, SY - 4.0), (CX + s * 2.5, SY - 3.5)]
    X, Y, _Z = coords(g)
    for pts in (up, lo):
        m = front(g, pts, CZ + 1, CZ + 2, "plasma", 4)
        P.flat(g, m & (np.abs(X - CX) < 3.0), "plasma", 6)
        rim = m & ((np.abs(X - CX) > 5.0) | (Y > SY + 4.5) | (Y < SY - 3.0))
        P.flat(g, rim, "sky", 7)
    return g


def build():
    hinge = (CX, SY, CZ)
    root, to_root = rig([("fairy-ring", ring(), None, None), ("sprite", sprite(), hinge, None),
                         ("wing-l", wing(-1), (CX - 1.5, SY, CZ + 1.5), "sprite"), ("wing-r", wing(1), (CX + 1.5, SY, CZ + 1.5), "sprite")])
    flap = [(t, (0.0, a, 0.0)) for t, a in ((0, 0), (0.25, 35), (0.5, 0), (0.75, 35), (1.0, 0), (1.25, 35), (1.5, 0), (1.75, 35), (2.0, 0))]
    idle = {
        "sprite": {"loc": [(t, (0.0, 1.5 * math.sin(math.pi * t + math.pi / 2), 0.0)) for t in (0, 0.5, 1.0, 1.5, 2.0)],
                   "rot": [(t, (0.0, 180.0 * t, 0.0)) for t in (0, 0.5, 1.0, 1.5, 2.0)]},
        "wing-l": {"rot": flap},  # rot y + turns the left (-x) blade back toward +z
        "wing-r": {"rot": [(t, (0.0, -a, 0.0)) for t, (_, a, _) in flap]},
    }
    return asset("terrain-nature", "fairy-ring", "Fairy Ring", root, clips=[Clip("idle", idle)],
                 sockets=[Socket("socket-sprite", at=to_root((CX, SY + 1, CZ)), parent="sprite")],
                 fx=[pfx("rvx-fantasy-fairy-motes", "socket-sprite", "idle", size=40)])
