"""Helpers shared by the diesel and electric locomotive builders: body
sections, cab glazing, lamps, louvres, handrails and warning ends.

All in the shapes.py body frame (x centre BX, y = 0 on the rail, z = 0 at the
front coupler face). Painting is by region: a region mask is cut against the
body, and only the faces on its surface show the paint.
"""
from __future__ import annotations

import numpy as np

from railkit import C, Grid, P, coords
from shapes import BX, glass, round_lamp


def chamfer_box(half: float, y0: float, y1: float, ch: float = 3, cx: float = BX):
    """A box section (x, y) with its two top corners chamfered."""
    return [(cx - half, y0), (cx + half, y0), (cx + half, y1 - ch), (cx + half - ch, y1), (cx - half + ch, y1), (cx - half, y1 - ch)]


def hood_section(half: float, y0: float, y1: float, cx: float = BX):
    """A narrow engine hood: straight sides, a rounded top."""
    r = min(half * 0.5, (y1 - y0) * 0.4)
    return [(cx - half, y0), (cx + half, y0), (cx + half, y1 - r), (cx + half - r * 0.3, y1 - r * 0.3), (cx + half - r, y1),
            (cx - half + r, y1), (cx - half + r * 0.3, y1 - r * 0.3), (cx - half, y1 - r)]


def off_axis(g: Grid) -> np.ndarray:
    """|x - centre line| of every voxel centre."""
    return np.abs(coords(g)[0] + 0.5 - BX)


def side_region(g: Grid, body, half: float, z0, z1, y0, y1, depth: float = 1.5) -> np.ndarray:
    """Body voxels on both side walls of a body `half` wide, inside a z/y window."""
    X, Y, Z = coords(g)
    return body & (off_axis(g) > half - depth) & (Z >= z0) & (Z < z1) & (Y >= y0) & (Y < y1)


def side_windows(g: Grid, body, half: float, z0: int, z1: int, y0: int, y1: int, w: int = 0, gap: int = 2, frame=None) -> np.ndarray:
    """Glass on both side walls: one pane (w = 0) or a row of panes `w` wide."""
    X, Y, Z = coords(g)
    out = np.zeros(g.shape, bool)
    if w <= 0:
        spans = [(z0, z1)]
    else:
        n = max(1, (z1 - z0 + gap) // (w + gap))
        s = z0 + (z1 - z0 - (n * w + (n - 1) * gap)) // 2
        spans = [(s + k * (w + gap), s + k * (w + gap) + w) for k in range(n)]
    for a, b in spans:
        pane = side_region(g, body, half, a, b, y0, y1)
        if frame:
            P.flat(g, pane, *frame)
            pane = pane & (Z > a) & (Z < b - 1) & (Y > y0) & (Y < y1 - 1)
        glass(g, pane)
        out |= pane
    return out


def louvres(g: Grid, body, half: float, z0: int, z1: int, y0: int, y1: int, pitch: int = 3) -> np.ndarray:
    """Dark grille panels with lighter slats on both side walls."""
    m = side_region(g, body, half, z0, z1, y0, y1)
    Y = coords(g)[1]
    P.flat(g, m, "iron", 3)
    P.flat(g, m & ((Y - y0) % pitch == 0), "iron", 5)
    return m


def end_region(g: Grid, body, front: bool, depth: int, y0, y1, xhalf: float) -> np.ndarray:
    """Body voxels within `depth` of the front (or rear) end, inside a y window and |x| < xhalf."""
    X, Y, Z = coords(g)
    zs = np.nonzero(body.any(axis=(0, 1)))[0]
    zf = zs.min() if front else zs.max()
    near = (Z < zf + depth) if front else (Z > zf - depth)
    return body & near & (Y >= y0) & (Y < y1) & (off_axis(g) < xhalf)


def windscreen(g: Grid, body, front: bool, y0: int, y1: int, xhalf: float = 17, depth: int = 3, pillar: bool = True) -> np.ndarray:
    """Cab windscreen glass on an end (flat or sloped), split by a centre pillar."""
    m = end_region(g, body, front, depth, y0, y1, xhalf)
    if pillar:
        m &= off_axis(g) > 1.2
    glass(g, m)
    return m


def end_lamps(g: Grid, zface: float, front: bool, y: float = 22, spread: float = 13, r: float = 2.2, top: float | None = None) -> None:
    """A pair of lamps low on an end face (white), and optionally one high in the middle."""
    for sx in (-1, 1):
        round_lamp(g, BX + sx * spread, y, zface, r=r, lens=("sand", 7), front=front)
    if top is not None:
        round_lamp(g, BX, top, zface, r=r, lens=("sand", 7), front=front)


def warning_end(g: Grid, body, front: bool, ramp: str, shade: int, y0: int, y1: int, depth: int = 3, xhalf: float = 30) -> np.ndarray:
    """A high-visibility panel on an end (painted in a role colour)."""
    m = end_region(g, body, front, depth, y0, y1, xhalf)
    P.flat(g, m, ramp, shade)
    return m


def chevrons(g: Grid, mask, ramp: str, shade: int, period: int = 6) -> None:
    """Diagonal stripes over a mask (end steps, buffer beams); the other ink stays as painted."""
    X, Y, Z = coords(g)
    P.flat(g, mask & (((X + Y) // (period // 2)) % 2 == 0), ramp, shade)


def handrails(g: Grid, z0: int, z1: int, y: int, xhalf: int, ramp=("steel", 5), post_every: int = 12, deck: int = 17) -> None:
    """Walkway handrails along both sides: a rail at height y on posts."""
    for sx in (-1, 1):
        x = BX + sx * xhalf - (1 if sx > 0 else 0)
        g.box(x, y, z0, x + 1, y + 1, z1, C(*ramp))
        for z in range(z0, z1, post_every):
            g.box(x, deck, z, x + 1, y, z + 1, C(*ramp))
        g.box(x, deck, z1 - 1, x + 1, y, z1, C(*ramp))


def roof_fans(g: Grid, body, zs, y_from: int, r: float = 6) -> None:
    """Round radiator fans painted on a roof."""
    X, Y, Z = coords(g)
    top = body & (Y >= y_from)
    for zc in zs:
        d2 = (X + 0.5 - BX) ** 2 + (Z + 0.5 - zc) ** 2
        P.flat(g, top & (d2 < r * r), "iron", 3)
        P.flat(g, top & (d2 < (r * 0.35) ** 2), "steel", 5)
        P.flat(g, top & (d2 < r * r) & (np.abs(X + 0.5 - BX) < 0.6), "iron", 5)


def panto_socket(base, raise_by: float = 15.5) -> tuple[tuple, dict]:
    """socket-panto on the lowered pantograph head over a base at (x, y, z) (body-grid
    coords), and the catalogue note of how far the head rises when raised."""
    x, y, z = base
    return (x, y + 6, z), {"pantoRaise": raise_by}
