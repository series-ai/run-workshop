"""Body furniture shared by every vehicle: buffer beams, buffers and couplers
at both ends, and the underframe between the bogies.

All in the shapes.py body frame (x centre BX, y = 0 rail, z = 0 front
coupler face, z = L rear coupler face). Couplers and buffer faces sit exactly
on z = 0 and z = L, at COUPLER_Y, so coupled vehicles meet face to face.
"""
from __future__ import annotations

import numpy as np

from railkit import COUPLER_Y, C, Grid, P, coords
from shapes import BX, flat_ngon, last


def ends(g: Grid, L: int, beam=("iron", 3), buffers: bool = True, beam_depth: int = 4, front: bool = True, rear: bool = True) -> None:
    """Buffer beams, two buffers and a centre coupler at each end."""
    for z_face, sgn, on in ((0, 1, front), (L, -1, rear)):
        if not on:
            continue
        zb0, zb1 = sorted((z_face + sgn * 4, z_face + sgn * (4 + beam_depth)))
        g.box(BX - 20, COUPLER_Y - 4, zb0, BX + 20, COUPLER_Y + 5, zb1, C(*beam))
        zc0, zc1 = sorted((z_face, z_face + sgn * 4))
        # centre coupler: a knuckle head on a shank
        g.box(BX - 3, COUPLER_Y - 2, zc0, BX + 3, COUPLER_Y + 2, zc1, C("iron", 2))
        if buffers:
            for bx in (BX - 13, BX + 13):
                g.prism("z", flat_ngon(bx, COUPLER_Y, 2.6, 8), zc0, zc1, C("steel", 4))
                m = last(g)
                X, Y, Z = coords(g)
                P.flat(g, m & (Z == (zc0 if sgn > 0 else zc1 - 1)), "steel", 6)


def underframe(g: Grid, z0: int, z1: int, y0: int = 11, y1: int = 15, half: int = 20, ramp=("iron", 3)) -> np.ndarray:
    """The solebars and frame the body stands on."""
    g.box(BX - half, y0, z0, BX + half, y1, z1, C(*ramp))
    X, Y, Z = coords(g)
    m = (g.a > 0) & (Y >= y0) & (Y < y1) & (Z >= z0) & (Z < z1)
    P.flat(g, m & (Y == y1 - 1), ramp[0], min(7, ramp[1] + 1))
    return m


def equipment(g: Grid, z0: int, z1: int, y0: int = 6, half: int = 16, ramp=("iron", 2), boxes: int = 3) -> None:
    """Boxes slung under the floor between the bogies (tanks, batteries)."""
    span = z1 - z0
    w = span // (2 * boxes - 1)
    for k in range(boxes):
        a = z0 + 2 * k * w
        g.box(BX - half, y0, a, BX + half, 11, a + w, C(*ramp))
