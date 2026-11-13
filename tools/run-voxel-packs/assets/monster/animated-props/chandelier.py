"""Candle chandelier, in the Pirate Nation haunted style.

One iconic shape (rule K3): a chunky wrought-iron octagonal ring (eight
faceted segments) that carries eight big drippy candles, each lit with
the shared PN flame (nested warm flame layers, turned to face out). Four scroll arms rise from the ring to a central hub; a
skull finial with glowing eyes and a spike hangs under the hub. The ring
hangs on a thick chain from a slate ceiling rose. Iron is mid grey (never
near-black, rule C2); the detail is paint (riveted plates, wax drips).

Parts: mount (root, the ceiling rose), chain (swings on the rose hook),
ring (turns a little under the chain). Clip idle loops. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _kit import pfx, sway, world
from _pn import assemble, coords, last
from _props import pn_flame
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

SIZE = (34, 42, 34)
CX, CZ = 17.0, 17.0
TOP = 40  # the ceiling
CHAIN_TOP = 35.0  # the rose hook: the chain swings here
HANG = 24.0  # the hub eye: the ring hangs here
RING_Y0, RING_Y1 = 10, 13
RING_R, RING_W = 14.0, 4.0
CANDLE_R = RING_R - RING_W / 2


def grab(g: Grid, start: int):
    return g.solids[start:]


def iron(g: Grid, solids, base: int = 4, size=(5, 4)) -> None:
    """Wrought iron: riveted grey plates that follow every facet."""
    S.paint_facets(g, solids, lambda gg, m, fr: P.plates(gg, m, "gray", base, size=size, frame=fr))


def candle(g: Grid, cx: float, cz: float, y0: int, h: int, wax: str, seed: int, axis: str = "z") -> None:
    """A big 3×3 wax candle on a gold drip cup, painted drips, lit."""
    x0, z0 = int(round(cx - 1.5)), int(round(cz - 1.5))
    cup = box(g, x0 - 1, y0, z0 - 1, x0 + 4, y0 + 1, z0 + 4, "gold", 4)
    P.outline(g, cup, "gold", 3, normal="y")
    base = 6
    m = box(g, x0, y0 + 1, z0, x0 + 3, y0 + 1 + h, z0 + 3, wax, base)
    X, Y, Z = coords(g)
    top = y0 + h
    P.flat(g, m & (Y == top), wax, base + 1)
    # drips: lighter streaks of varying length down the sides
    streak = (P._hash(X + 3 * Z, seed=seed) % np.uint64(3)) == 0
    length = (P._hash(X, Z, seed=seed + 1) % np.uint64(max(2, h - 1))).astype(np.int64) + 1
    P.flat(g, m & streak & (Y >= top - length), wax, base + 1)
    P.flat(g, m & (Y == y0 + 1), wax, base - 1)
    pn_flame(g, x0 + 1.5, z0 + 1.5, top + 1, 5, 8, kind="small", axis=axis)


def links(g: Grid, cx: float, cz: float, y_top: int, y_bot: int, ramp: str = "gray", base: int = 5) -> np.ndarray:
    """A chunky chain of 4-tall links that turn 90° each step, each with a
    painted dark eye (the hole) and a lit rim."""
    m = np.zeros(g.shape, dtype=bool)
    X, Y, Z = coords(g)
    y = y_top
    k = 0
    xi, zi = int(cx), int(cz)
    while y - 5 >= y_bot - 2:
        if k % 2 == 0:
            lm = box(g, xi - 2, y - 5, zi - 1, xi + 2, y, zi + 1, ramp, base)
            hole = lm & (X >= xi - 1) & (X <= xi) & (Y > y - 5) & (Y < y - 1)
        else:
            lm = box(g, xi - 1, y - 5, zi - 2, xi + 1, y, zi + 2, ramp, base + 1)
            hole = lm & (Z >= zi - 1) & (Z <= zi) & (Y > y - 5) & (Y < y - 1)
        P.flat(g, hole, ramp, 2)
        P.flat(g, lm & ~hole & ((Y == y - 1) | (Y == y - 5)), ramp, base + 1)
        m |= lm
        y -= 4
        k += 1
    return m


def mount() -> Grid:
    g = Grid(*SIZE)
    s0 = len(g.solids)
    plate = S.disc(g, "y", CX, CZ, 5.5, TOP - 2, TOP, "gray", 6)
    rose = S.cone(g, "y", CX, CZ, 4.5, CHAIN_TOP + 1, TOP - 2, "gray", 5, r_top=2.0, tip="lo")
    iron(g, grab(g, s0 + 1), 5, size=(4, 3))
    X, Y, Z = coords(g)
    P.stone(g, plate, "gray", 6, block=(4, 2))
    P.flat(g, plate & (Y == TOP - 2) & (S.ngon_radius(g, "y", CX, CZ) > 4.3), "purple", 5)
    P.flat(g, rose & (Y == CHAIN_TOP + 1), "gray", 3)
    hook = box(g, int(CX) - 1, int(CHAIN_TOP) - 1, int(CZ), int(CX) + 2, int(CHAIN_TOP) + 1, int(CZ) + 1, "gray", 4)
    P.flat(g, hook & (X == int(CX)) & (Y == int(CHAIN_TOP) - 1), "gray", 2)
    return g


def chain() -> Grid:
    g = Grid(*SIZE)
    links(g, CX, CZ, int(CHAIN_TOP), int(HANG) + 1)
    return g


def ring() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = coords(g)
    down = -math.pi / 2
    # the octagonal ring: eight faceted segments
    s0 = len(g.solids)
    outer = S.flat_ngon(CX, CZ, RING_R, 8, down)
    inner = S.flat_ngon(CX, CZ, RING_R - RING_W, 8, down)
    for k in range(8):
        seg = [outer[k], outer[(k + 1) % 8], inner[(k + 1) % 8], inner[k]]
        g.prism("y", seg, RING_Y0, RING_Y1, C("gray", 4))
    ring_solids = grab(g, s0)
    ringm = np.logical_or.reduce([s.mask(g.shape) for s in ring_solids])
    iron(g, ring_solids, 4, size=(5, 3))
    P.flat(g, ringm & (Y == RING_Y1 - 1) & ((S.ngon_radius(g, "y", CX, CZ) > RING_R - 1.2) | (S.ngon_radius(g, "y", CX, CZ) < RING_R - RING_W + 1.2)), "gold", 4)
    P.flat(g, ringm & (Y == RING_Y0), "gray", 3)
    # a purple drape band on the outer face (painted cloth scallops)
    ang = np.arctan2(Z + 0.5 - CZ, X + 0.5 - CX)
    outer_face = ringm & (S.ngon_radius(g, "y", CX, CZ) > RING_R - 1.1)
    P.flat(g, outer_face & (Y == RING_Y0 + 1), "purple", 5)
    P.flat(g, outer_face & (Y == RING_Y0) & (np.cos(ang * 16) > 0.2), "purple", 5)
    P.flat(g, outer_face & (Y == RING_Y0 + 1) & (np.cos(ang * 8) > 0.92), "magenta", 6)
    # the hub, a collar and the eye it hangs by
    s1 = len(g.solids)
    hub = S.disc(g, "y", CX, CZ, 2.5, 12, 22, "gray", 5)
    collar = S.disc(g, "y", CX, CZ, 3.6, 20, 22, "gray", 4)
    iron(g, grab(g, s1), 5, size=(3, 3))
    P.flat(g, collar & (Y == 21), "gray", 6)
    eye = box(g, int(CX), 22, int(CZ) - 1, int(CX) + 1, int(HANG) + 1, int(CZ) + 2, "gray", 5)
    P.flat(g, eye & (Z == int(CZ)) & (Y == 23), "gray", 2)
    # four scroll arms from the hub down to the ring (true slopes)
    s2 = len(g.solids)
    for sgn in (-1, 1):
        for axis in ("x", "z"):
            def pt(r, y):
                # (u, v) in the prism plane: (x, y) for axis 'z', (y, z) for axis 'x'
                return (CX + sgn * r, y) if axis == "z" else (y, CZ + sgn * r)

            lo = (CZ - 1, CZ + 1) if axis == "z" else (CX - 1, CX + 1)
            a = [pt(2.0, 19.5), pt(7.5, 21.0)]
            b = [pt(7.5, 21.0), pt(CANDLE_R - 0.5, RING_Y1 - 0.5)]
            c = [pt(5.0, 16.0), pt(8.5, 18.0)]
            for p0, p1 in (a, b, c):
                S.bar(g, "z" if axis == "z" else "x", p0, p1, 2.0, lo[0], lo[1], "gray", 4)
    arms = np.logical_or.reduce([sd.mask(g.shape) for sd in grab(g, s2)])
    P.flat(g, arms, "gray", 5)
    P.flat(g, arms & (Y <= RING_Y1 + 1), "gray", 4)
    # the skull finial and a spike under it
    S.skull(g, CX, 3, CZ, s=8, ramp="bone", base=6, eyes=("toxic", 6))
    S.cone(g, "y", CX, CZ, 2.0, 0, 3, "gray", 5, tip="lo")
    P.flat(g, last(g) & (Y < 1), "gray", 6)
    # eight big candles on the ring, heights varied (rule F5)
    heights = [7, 5, 8, 6, 7, 5, 8, 6]
    for k in range(8):
        a = down + 2 * math.pi * k / 8
        cx = CX + CANDLE_R * math.cos(a)
        cz = CZ + CANDLE_R * math.sin(a)
        candle(g, cx, cz, RING_Y1, heights[k], "bone" if k % 2 == 0 else "purple", seed=10 + k, axis="x" if abs(math.cos(a)) > 0.6 else "z")
    return g


def build():
    parts = {"mount": mount(), "chain": chain(), "ring": ring()}
    root = assemble(parts, [
        ("mount", None, (CX, CHAIN_TOP, CZ)),
        ("chain", "mount", (CX, CHAIN_TOP, CZ)),
        ("ring", "chain", (CX, HANG, CZ)),
    ])
    idle = {"chain": {"rot": sway(4.0, "x", 5.0, math.pi / 2)},
            "ring": {"rot": sway(4.0, "y", 10.0, 0.8)}}
    # the front candle's flame, in root (rose hook) space
    flame = (0.0, RING_Y1 + 7.0 + 4.0 - CHAIN_TOP, -CANDLE_R)
    return world("chandelier", "animated-props", "Candle Chandelier", root,
                 clips=[Clip("idle", idle)],
                 sockets=[Socket("socket-candles", at=flame, parent="ring")],
                 pfx=[pfx("rvx-monster-candle-flame", "socket-candles", "idle", size=7)])
