"""Small shared helpers for the repaired apocalypse props.

Only the repaired new props import this file. No original model uses it,
so a change here cannot change an original GLB.

Sloped faces (prism sides) take their colour from the voxels half a voxel
behind the face. A paint mask that follows single surface voxels (for
example pnkit.edges) then shows as speckle on a slope. The painters here
use only smooth functions of position (height, distance, angle), so a
sloped face shows clean bands and patches (rule S3).
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
from pnshapes import coords
from voxgrid import C, Grid


def ring(cx: float, cz: float, rx: float, rz: float, n: int, lumps, turn: float = 0.0) -> list[tuple[float, float]]:
    """An irregular n-gon in the (x, z) plane. `lumps` gives one radius
    factor for each corner, so the outline is lumpy but not random."""
    if len(lumps) != n:
        raise ValueError(f"ring needs {n} lump factors, got {len(lumps)}")
    pts = []
    for k in range(n):
        a = turn + 2 * math.pi * k / n
        pts.append((cx + rx * lumps[k] * math.cos(a), cz + rz * lumps[k] * math.sin(a)))
    return pts


def stack(g: Grid, cx: float, cz: float, y0: float, rx: float, rz: float, profile, lumps, ramp: str, base: int, twist: float = 0.0) -> np.ndarray:
    """A rounded faceted body: frustum tiers stacked on y. `profile` is a
    list of (height, radius factor) from the bottom up. Each tier starts on
    the exact top ring of the tier below, so no tier passes into another.
    `twist` turns every ring a little more (degrees per tier), so the
    facets do not line up into flat stripes. Returns the mask."""
    n = len(lumps)
    m = np.zeros(g.shape, dtype=bool)
    rings = [ring(cx, cz, rx * f, rz * f, n, lumps, math.radians(twist * k)) for k, (_h, f) in enumerate(profile)]
    for k in range(len(profile) - 1):
        lo, hi = y0 + profile[k][0], y0 + profile[k + 1][0]
        g.prism("y", rings[k], lo, hi, C(ramp, base), top=rings[k + 1])
        m |= g.solids[-1].mask(g.shape)
    return m


def bands(g: Grid, mask: np.ndarray, ramp: str, y0: float, h: float, tones) -> None:
    """Paint a soft vertical ramp: `tones` is a list of (height fraction,
    shade) from the bottom up; each shade starts at its fraction of `h`."""
    _X, Y, _Z = coords(g)
    for f, shade in tones:
        P.flat(g, mask & (Y >= y0 + f * h), ramp, shade)


def glint(g: Grid, mask: np.ndarray, p, r: float, ramp: str, shade: int) -> np.ndarray:
    """A soft highlight patch: every voxel of `mask` within `r` of point
    `p`. On a slope it shows as one clean patch, not as dots."""
    X, Y, Z = coords(g)
    m = mask & (np.sqrt((X - p[0]) ** 2 + (Y - p[1]) ** 2 + (Z - p[2]) ** 2) < r)
    P.flat(g, m, ramp, shade)
    return m


def creases(g: Grid, mask: np.ndarray, cx: float, cz: float, angles, y_lo: float, y_hi: float, ramp: str, shade: int, width: float = 0.7) -> np.ndarray:
    """Fold lines that run up a round body toward its top: one line for
    each angle (degrees, measured in the x-z plane round the centre)."""
    X, Y, Z = coords(g)
    a = np.arctan2(Z - cz, X - cx)
    rad = np.hypot(X - cx, Z - cz)
    out = np.zeros(g.shape, dtype=bool)
    for deg in angles:
        d = np.abs(np.angle(np.exp(1j * (a - math.radians(deg))))) * rad
        out |= mask & (d < width) & (Y > y_lo) & (Y < y_hi)
    P.flat(g, out, ramp, shade)
    return out


def no_overlap(named) -> None:
    """Raise when two parts share a voxel: parts must touch, not pass
    through each other. `named` is a list of (name, mask)."""
    for i in range(len(named)):
        for j in range(i + 1, len(named)):
            both = int(np.count_nonzero(named[i][1] & named[j][1]))
            if both:
                raise ValueError(f"{named[i][0]} and {named[j][0]} share {both} voxels")
