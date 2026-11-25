"""Running gear: wheelsets, bogies, steam driving wheels and rods.

Every wheelset is its own Part named `wheel-*`, pivoted on its axle centre, so
it spins about X in clips and in the runtime helper. Treads sit on the rail
head (|x| 14..17, the rail is 14..16) with a flange inside each rail.
"""
from __future__ import annotations

import math

import numpy as np

from railkit import RAIL_X, WHEEL_RADII, C, Grid, P, Part, coords
from pnshapes import flat_ngon, last

GX = 20  # wheelset grid centre line (grid 40 wide)


def wheelset(name: str, r: int, face=("iron", 3), rim=("steel", 5), spokes: int = 0, counterweight: bool = False, crank: float = 0.0) -> Part:
    """Two flanged wheels on an axle, pivoted on the axle centre.
    spokes > 0 paints spokes (steam drivers); counterweight paints the
    crescent opposite the crank pin; crank > 0 adds crank-pin bosses."""
    if r not in WHEEL_RADII:
        raise ValueError(f"wheel radius {r} is not one of {WHEEL_RADII}")
    n = 12 if r <= 9 else 16
    size = 2 * r + 6
    cy = cz = size / 2
    g = Grid(2 * GX, size, size)
    for side in (-1, 1):
        tread = (GX + side * (RAIL_X - 1), GX + side * (RAIL_X + 2))
        flange = (GX + side * (RAIL_X - 2), GX + side * (RAIL_X - 1))
        for (a, b), rad, col in ((tread, r, rim), (flange, r + 1.5, ("steel", 3))):
            lo, hi = min(a, b), max(a, b)
            g.prism("x", [(cy + v, cz + u) for u, v in flat_ngon(0, 0, rad, n, -math.pi / 2)], lo, hi, C(*col))
    X, Y, Z = coords(g)
    rr = np.hypot(Y + 0.5 - cy, Z + 0.5 - cz)
    outer_face = (X == GX + RAIL_X + 1) | (X == GX - RAIL_X - 2)
    disc_face = outer_face & (rr < r - 1.2)
    P.flat(g, disc_face, *face)
    P.flat(g, outer_face & (rr < 2.2), "steel", 6)  # hub
    if spokes:
        ang = np.arctan2(Y + 0.5 - cy, Z + 0.5 - cz)
        for k in range(spokes):
            a = 2 * math.pi * k / spokes
            d = np.abs(np.sin(ang - a)) * rr
            P.flat(g, disc_face & (d < 0.8) & (np.cos(ang - a) > 0) & (rr > 2.2), face[0], min(7, face[1] + 2))
    if counterweight:
        ang = np.arctan2(Y + 0.5 - cy, Z + 0.5 - cz)
        P.flat(g, disc_face & (rr > r * 0.45) & (np.cos(ang + math.pi / 2) > 0.55), face[0], max(0, face[1] - 1))
    # axle
    g.prism("x", [(cy + v, cz + u) for u, v in flat_ngon(0, 0, 1.6, 8)], GX - RAIL_X + 2, GX + RAIL_X - 2, C("iron", 2))
    return Part(name, g, pivot=(GX, cy, cz), meta={"radius": r})


def bogie(name: str, wheel_r: int = 6, wheelbase: int = 20, tag: str = "f", frame=("iron", 3)) -> Part:
    """A two-axle bogie pivoted on its centre at rail level: side frames
    outside the wheels, a bolster across, two wheelsets `wheel-<tag>1/2`."""
    L = wheelbase + 2 * wheel_r + 8
    g = Grid(2 * GX + 6, 2 * wheel_r + 8, L)
    cx, cz = GX + 3, L / 2
    top = 2 * wheel_r + 3
    for side in (-1, 1):
        x0 = cx + side * (RAIL_X + 3)
        lo, hi = min(x0, x0 + side * 2), max(x0, x0 + side * 2)
        # side frame: a tapered beam over both axles, with journal boxes
        g.prism("x", [(wheel_r - 2, 1), (wheel_r - 2, L - 1), (top, L - 3), (top, 3)], lo, hi, C(*frame))
        for dz in (-wheelbase / 2, wheelbase / 2):
            g.box(lo - (1 if side > 0 else 0), wheel_r - 3, cz + dz - 3, hi + (1 if side < 0 else 0), wheel_r + 3, cz + dz + 3, C("steel", 3))
    # bolster
    g.box(cx - RAIL_X - 3, top - 4, cz - 4, cx + RAIL_X + 3, top, cz + 4, C(*frame))
    X, Y, Z = coords(g)
    P.flat(g, (g.a > 0) & (Y == top - 1), frame[0], min(7, frame[1] + 1))
    part = Part(name, g, pivot=(cx, 0, cz))
    for k, dz in enumerate((-wheelbase / 2, wheelbase / 2), 1):
        w = wheelset(f"wheel-{tag}{k}", wheel_r)
        w.at = (0, wheel_r, dz)
        part.add(w)
    return part


# ---------------------------------------------------------------- steam motion
def crank_pin(theta: float, c: float, phase: float) -> tuple[float, float]:
    """(y, z) offset of a crank pin from its axle after the wheel turns
    `theta` radians about +X; `phase` is the pin's rest angle (0 = top)."""
    a = phase
    y0, z0 = c * math.cos(a), -c * math.sin(a)
    return (y0 * math.cos(theta) - z0 * math.sin(theta), y0 * math.sin(theta) + z0 * math.cos(theta))


def rod(name: str, length: float, thick: float = 3, depth: float = 2, ramp=("steel", 5), ends: float = 2.2) -> tuple[Grid, float]:
    """A flat rod along z with round bosses at both ends; returns (grid, z of
    the first boss centre) so the caller can pivot it on a pin."""
    L = int(math.ceil(length + 2 * ends + 2))
    h = int(math.ceil(2 * ends + 2))
    g = Grid(int(math.ceil(depth)) + 1, h, L)
    cy, z0 = h / 2, ends + 1
    g.prism("x", [(cy - thick / 2, z0), (cy - thick / 2, z0 + length), (cy + thick / 2, z0 + length), (cy + thick / 2, z0)], 0, depth, C(*ramp))
    for z in (z0, z0 + length):
        g.prism("x", [(cy + v, z + u) for u, v in flat_ngon(0, 0, ends, 8)], 0, depth, C(ramp[0], max(0, ramp[1] - 1)))
    return g, z0
