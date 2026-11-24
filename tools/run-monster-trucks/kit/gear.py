"""Wheel, tyre and spring shapes shared by the wheel modules (modules.py)
and the bolt-on parts (accessories.py)."""
from __future__ import annotations

import math

import numpy as np

from kit import C, Grid, P, box, coords, last, ngon, radial


def _mud(g: Grid, m: np.ndarray, seed: int, amount: float = 0.35, ramp="sand") -> None:
    rng = np.random.default_rng(seed)
    X, Y, Z = coords(g)
    blob = (((X // 2) * 7 + (Y // 2) * 13 + (Z // 2) * 5 + rng.integers(0, 1 << 16)) * 2654435761 % 1000) / 1000.0
    P.flat(g, m & (blob < amount), ramp, 3)
    P.flat(g, m & (blob < amount * 0.45), ramp, 2)


def lug_poly(r: float, lugs: int, depth: float, turn: float = 0.0):
    """Tyre outline: wide square-shouldered lugs (60% of the pitch) round a
    rounded carcass; slanted lug flanks like a tractor tread."""
    pts = []
    step = 2 * math.pi / lugs
    for k in range(lugs):
        a0 = turn + step * k
        for frac, rad in ((0.0, r), (0.12, r + depth * 0.15), (0.2, r + depth), (0.62, r + depth), (0.72, r + depth * 0.15)):
            a = a0 + frac * step
            pts.append((rad * math.cos(a), rad * math.sin(a)))
    return pts


def knobby_tyre(g: Grid, cx, cy, cz, r: float, w: int, lugs: int = 14, depth: float = 2.6, rim=("steel", 5), hub=("orange", 5), seed=0) -> np.ndarray:
    """A fat monster tyre: two staggered lug rings (true-slope gear prisms)
    across the tread, a painted rim and a proud hub cap. Axle along x."""
    half = w / 2
    m = np.zeros(g.shape, bool)
    step = 2 * math.pi / lugs
    for k, (lo, hi) in enumerate(((cx - half, cx), (cx, cx + half))):
        poly = [(cy + v, cz + u) for u, v in lug_poly(r - depth, lugs, depth, step * 0.5 * k)]
        g.prism("x", poly, lo, hi, C("iron", 3))
        m |= last(g)
    rr = radial(g, "x", cy, cz)
    X, Y, Z = coords(g)
    face = m & ((X < cx - half + 1) | (X >= cx + half - 1))
    P.flat(g, m & (rr > r - depth - 0.5), "iron", 2)  # lugs darker
    P.flat(g, face & (rr > r - depth - 0.5), "iron", 3)
    P.flat(g, face & (rr <= r - depth - 1.0) & (rr > r * 0.62), "iron", 4)  # sidewall
    P.flat(g, face & (rr <= r - depth - 1.0) & (rr > r - depth - 2.2), "iron", 3)  # sidewall ring
    P.flat(g, face & (rr <= r * 0.62), *rim)
    P.flat(g, face & (rr <= r * 0.62) & (rr > r * 0.62 - 1.2), rim[0], rim[1] - 2)
    P.flat(g, face & (rr <= r * 0.36) & (rr > r * 0.36 - 1.2), rim[0], rim[1] - 2)
    for k in range(6):  # lug nuts
        a = 2 * math.pi * k / 6
        P.flat(g, face & ((Y + 0.5 - cy - math.sin(a) * r * 0.3) ** 2 + (Z + 0.5 - cz - math.cos(a) * r * 0.3) ** 2 < 1.3), "steel", 6)
    # proud hub cap on both faces
    for lo, hi in ((cx - half - 1, cx - half), (cx + half, cx + half + 1)):
        g.prism("x", [(cy + v, cz + u) for u, v in ngon(0, 0, r * 0.24, 8, math.pi / 8)], lo, hi, C(*hub))
        m |= last(g)
    return m


def slick_tyre(g: Grid, cx, cy, cz, r: float, w: int, n: int = 16, rim=("steel", 6), spokes: int = 0, hub=("orange", 5), seed=0, mud: bool = True) -> np.ndarray:
    """Smooth tyre (drag slick or skinny street tyre); `spokes` paints a wire wheel."""
    half = w / 2
    g.prism("x", [(cy + v, cz + u) for u, v in ngon(0, 0, r, n, math.pi / n)], cx - half, cx + half, C("iron", 3))
    m = last(g)
    rr = radial(g, "x", cy, cz)
    X, Y, Z = coords(g)
    face = m & ((X < cx - half + 1) | (X >= cx + half - 1))
    P.flat(g, m & (rr > r - 1.2), "iron", 2)
    rim_r = r * (0.72 if spokes else 0.6)
    P.flat(g, face & (rr <= rim_r), *rim)
    P.flat(g, face & (rr <= rim_r) & (rr > rim_r - 1.2), rim[0], rim[1] - 2)
    if spokes:
        ang = np.arctan2(Y + 0.5 - cy, Z + 0.5 - cz)
        inner = face & (rr <= rim_r - 1.2) & (rr > 2.0)
        P.flat(g, inner, "iron", 1)
        spoke = (np.abs(((ang / (2 * math.pi) * spokes) % 1.0) - 0.5) > 0.38)
        P.flat(g, inner & spoke, rim[0], rim[1])
    if mud:
        _mud(g, m & (rr > r - 1.5), seed, 0.1)
    for lo, hi in ((cx - half - 1, cx - half), (cx + half, cx + half + 1)):
        g.prism("x", [(cy + v, cz + u) for u, v in ngon(0, 0, max(1.6, r * 0.2), 8, math.pi / 8)], lo, hi, C(*hub))
        m |= last(g)
    return m


def coil(g: Grid, x0, x1, z0, z1, y0, y1, ramp="orange") -> np.ndarray:
    """A coil-over shock: a chrome rod inside a chunky painted spring."""
    m = box(g, x0, y0, z0, x1, y1, z1, ramp, 5)
    X, Y, Z = coords(g)
    P.flat(g, m & ((Y + (X + Z) // 2) % 3 == 0), ramp, 2)
    P.flat(g, m & ((Y + (X + Z) // 2) % 3 == 1), ramp, 6)
    for yy in (y0, y1 - 2):
        cap = box(g, x0 - 1, yy, z0 - 1, x1 + 1, yy + 2, z1 + 1, "steel", 3)
        m |= cap
    return m


def _road_wheel(wg: Grid, face_x, wy, wz, rad: float, big: bool) -> None:
    """A steel road wheel: dark tyre ring, dished rim, rusty hub and bolts."""
    wg.prism("x", [(wy + v, wz + u) for u, v in ngon(0, 0, rad, 12 if big else 10, math.pi / 12)], *face_x, C("steel", 4))
    wm = last(wg)
    rr = radial(wg, "x", wy, wz)
    X, Y, Z = coords(wg)
    P.flat(wg, wm & (rr > rad - 1.6), "iron", 2)
    P.flat(wg, wm & (rr <= rad * 0.62) & (rr > rad * 0.62 - 1.1), "steel", 2)
    P.flat(wg, wm & (rr < rad * 0.32), "rust", 3)
    if big:
        for k in range(6):
            a = 2 * math.pi * k / 6
            P.flat(wg, wm & ((Y + 0.5 - wy - math.sin(a) * rad * 0.47) ** 2 + (Z + 0.5 - wz - math.cos(a) * rad * 0.47) ** 2 < 1.0), "steel", 6)
