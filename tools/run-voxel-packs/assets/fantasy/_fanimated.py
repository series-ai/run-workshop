"""Low-level shape helpers for five fantasy animated props (import as `_fanimated`).

The enchanted harp, the weather vane, the enchanted anvil, the spinning
wheel and the magic fountain use these helpers. Each helper makes one
low-level shape only. Each model keeps its own massing and silhouette.

    strip   a curved thick bar along a centre line (a chain of true-slope
            quads): harp necks, scroll arms, curved legs
    ring    an n-gon ring along an axis (two C-shaped prisms): wheel rims,
            basin rims, hoops
"""
from __future__ import annotations

import math

import numpy as np

import pnshapes as S
from voxgrid import C, Grid


def strip(g: Grid, axis: str, pts, half, lo, hi, ramp: str, base: int = 4) -> np.ndarray:
    """A curved bar through the centre-line points `pts` (in the PRISM_PLANE
    of `axis`), with the half-width `half` (one value, or one value for each
    point), extruded over [lo, hi). Each segment is one convex quad. The
    quads overlap at the joints, so the bar has no gaps. Returns the mask."""
    if len(pts) < 2:
        raise ValueError("strip needs two or more points")
    halves = [half] * len(pts) if isinstance(half, (int, float)) else list(half)
    if len(halves) != len(pts):
        raise ValueError("strip needs one half-width for each point")
    m = np.zeros(g.shape, dtype=bool)
    for k in range(len(pts) - 1):
        (u0, v0), (u1, v1) = pts[k], pts[k + 1]
        n = math.hypot(u1 - u0, v1 - v0)
        if n < 1e-9:
            raise ValueError(f"strip has two equal points at {k}")
        # extend each segment a little along its line, so the joints close
        eu, ev = (u1 - u0) / n * 0.6, (v1 - v0) / n * 0.6
        a = (u0 - eu, v0 - ev) if k > 0 else (u0, v0)
        b = (u1 + eu, v1 + ev) if k < len(pts) - 2 else (u1, v1)
        g.prism(axis, S.quad(a, b, halves[k], halves[k + 1]), lo, hi, C(ramp, base))
        m |= S.last(g)
    return m


def ring(g: Grid, axis: str, cu, cv, r_out, r_in, lo, hi, ramp: str, base: int = 4, n: int = 8, facing: float | None = None):
    """An n-gon ring along `axis` (flat radii r_out and r_in), built from two
    C-shaped prisms, so the inside stays open. Returns (mask, solids)."""
    if r_in >= r_out:
        raise ValueError("ring needs r_in < r_out")
    if n % 2:
        raise ValueError("ring needs an even n")
    face = S._DOWN[axis] if facing is None else facing
    outer = S.flat_ngon(cu, cv, r_out, n, face)
    inner = S.flat_ngon(cu, cv, r_in, n, face)
    m = np.zeros(g.shape, dtype=bool)
    start = len(g.solids)
    for half in (range(0, n // 2 + 1), range(n // 2, n + 1)):
        ks = [k % n for k in half]
        g.prism(axis, [outer[k] for k in ks] + [inner[k] for k in reversed(ks)], lo, hi, C(ramp, base))
        m |= S.last(g)
    return m, g.solids[start:]


__all__ = ["strip", "ring"]
