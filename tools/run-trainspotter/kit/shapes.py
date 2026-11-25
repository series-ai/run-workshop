"""Generic shape and paint helpers for vehicle bodies.

`section`, `loft`, `glass`, `round_lamp` and the window painters are adapted
from tools/run-monster-trucks/kit (more_bodies2.py, bodies.py), with the
grid centre line passed in explicitly instead of read from a module global,
and without any weathering.

Body grids use one frame: x centre BX, y = 0 on the rail-head plane, z = 0 at
the front coupler face (the front is toward -Z, so smaller z is further
forward).
"""
from __future__ import annotations

import math

import numpy as np

from railkit import C, Grid, P, coords

BX = 26  # body grid centre line (grids are 52 wide: GAUGE_HALF + 2 each side)
BW = 2 * BX

from pnshapes import disc, flat_ngon, last  # noqa: E402,F401


# ---------------------------------------------------------------- cross-sections (x, y)
def section(w: float, y0: float, y1: float, p: float = 3.0, n: int = 16, cx: float = BX):
    """Rounded cross-section: a superellipse `w` half-wide spanning y0..y1
    (p = 2 is an ellipse, higher is boxier), flat on the bottom."""
    cy, h = (y0 + y1) / 2, (y1 - y0) / 2
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        c, s = math.cos(a), math.sin(a)
        pts.append((cx + w * math.copysign(abs(c) ** (2 / p), c), max(y0, cy + h * math.copysign(abs(s) ** (2 / p), s))))
    return pts


def loft(g: Grid, stations, ramp: str, shade: int = 4, p: float = 3.0, n: int = 16, cx: float = BX) -> np.ndarray:
    """A rounded body swept along z through stations [(z, half_width, y0, y1), ...]:
    frustum prisms between consecutive sections (noses, boilers, domes)."""
    m = np.zeros(g.shape, bool)
    for (za, wa, a0, a1), (zb, wb, b0, b1) in zip(stations, stations[1:]):
        if zb < za:  # prisms run low to high along z
            (za, wa, a0, a1), (zb, wb, b0, b1) = (zb, wb, b0, b1), (za, wa, a0, a1)
        g.prism("z", section(wa, a0, a1, p, n, cx), za, zb, C(ramp, shade), top=section(wb, b0, b1, p, n, cx))
        m |= last(g)
    return m


def car_profile(half: float, y0: float, eave: float, crown: float, cx: float = BX, round_: float = 1.0):
    """A carriage section: straight sides up to the eave, then a curved roof
    to the crown. round_ 0 is a flat roof, 1 a full curve."""
    rise = crown - eave
    pts = [(cx - half, y0), (cx + half, y0), (cx + half, eave)]
    for f in (0.35, 0.65, 0.88):
        pts.append((cx + half * (1 - 0.32 * f * round_ - 0.18 * f * f * round_), eave + rise * (1 - (1 - f) ** 2)))
    pts += [(cx + half * 0.45, crown), (cx - half * 0.45, crown)]
    for f in (0.88, 0.65, 0.35):
        pts.append((cx - half * (1 - 0.32 * f * round_ - 0.18 * f * f * round_), eave + rise * (1 - (1 - f) ** 2)))
    pts.append((cx - half, eave))
    return pts


def extrude(g: Grid, poly, z0: float, z1: float, ramp: str, shade: int = 4) -> np.ndarray:
    g.prism("z", poly, z0, z1, C(ramp, shade))
    return last(g)


# ---------------------------------------------------------------- paint
def glass(g: Grid, mask, glint: bool = True) -> None:
    X, Y, Z = coords(g)
    P.flat(g, mask, "navy", 3)
    if glint:
        P.flat(g, mask & ((X + Y + Z) % 9 == 3), "navy", 6)


def side_planes(g: Grid, mask) -> tuple[np.ndarray, np.ndarray]:
    """Voxels on the outermost -x and +x layers of a mask (body sides)."""
    X = coords(g)[0]
    xs = np.nonzero(mask.any(axis=(1, 2)))[0]
    return mask & (X == xs.min()), mask & (X == xs.max())


def window_row(g: Grid, shell, z0: int, z1: int, y0: int, y1: int, w: int, gap: int, frame, sides=(True, True), glint: bool = True) -> np.ndarray:
    """Evenly spaced windows on both body sides between z0 and z1, centred."""
    X, Y, Z = coords(g)
    n = max(1, (z1 - z0 + gap) // (w + gap))
    start = z0 + (z1 - z0 - (n * w + (n - 1) * gap)) // 2
    left, right = side_planes(g, shell)
    planes = (left if sides[0] else np.zeros_like(left)) | (right if sides[1] else np.zeros_like(right))
    out = np.zeros(g.shape, bool)
    for k in range(n):
        z = start + k * (w + gap)
        pane = planes & (Z >= z) & (Z < z + w) & (Y >= y0) & (Y < y1)
        P.flat(g, pane, *frame)
        inner = pane & (Z >= z + 1) & (Z < z + w - 1) & (Y >= y0 + 1) & (Y < y1 - 1)
        glass(g, inner, glint)
        out |= pane
    return out


def end_window(g: Grid, shell, front: bool, x0: int, x1: int, y0: int, y1: int, frame) -> np.ndarray:
    """A window on the front (smallest z) or rear face of a shell."""
    X, Y, Z = coords(g)
    zs = np.nonzero(shell.any(axis=(0, 1)))[0]
    plane = shell & (Z == (zs.min() if front else zs.max()))
    pane = plane & (X >= x0) & (X < x1) & (Y >= y0) & (Y < y1)
    P.flat(g, pane, *frame)
    glass(g, pane & (X >= x0 + 1) & (X < x1 - 1) & (Y >= y0 + 1) & (Y < y1 - 1))
    return pane


def band(g: Grid, mask, y0: int, y1: int, ramp: str, shade: int) -> np.ndarray:
    Y = coords(g)[1]
    m = mask & (Y >= y0) & (Y < y1)
    P.flat(g, m, ramp, shade)
    return m


def round_lamp(g: Grid, x: float, y: float, zface: float, r: float = 2.6, lens=("sand", 7), front: bool = True) -> np.ndarray:
    """A round lamp: a steel housing 2 deep proud of a face at zface, lens painted on its outer face."""
    z0, z1 = (zface - 2, zface) if front else (zface, zface + 2)
    g.prism("z", flat_ngon(x, y, r, 10), z0, z1, C("steel", 5))
    m = last(g)
    X, Y, Z = coords(g)
    outer = Z == (int(z0) if front else int(z1) - 1)
    P.flat(g, m & outer & ((X + 0.5 - x) ** 2 + (Y + 0.5 - y) ** 2 < (r - 0.7) ** 2), *lens)
    return m


def numbers(g: Grid, text: str, face: str, plane: int, u0: int, v0: int, ramp: str, shade: int, scale: int = 1) -> None:
    """Paint running numbers or a word onto a body side (face '-x'/'+x') with
    the pipeline's voxel glyphs; depth 1 paints the surface layer, so no extra triangles."""
    from pnglyph import text as glyphs

    glyphs(g, face, plane, u0, v0, text, ramp, shade, scale=scale, depth=1)
