"""Low footings for the repaired new animated props (Art Director repair).

The old new props stood on one shared sand-tile plinth, 5 to 7 voxels high,
which read as a display stand. Each repaired prop now uses one footing from
this file, 1 to 2 voxels high, and no two props use the same kind:

- `dirt_patch`: a flat irregular patch of packed earth.
- `concrete_pad`: a grey poured pad with chamfered corners and cracks.
- `bolt_plate`: a steel base flange with bolt heads round its rim.
- `tread_sheets`: two overlapping salvaged tread-plate steel sheets.
- `pallet`: a wooden shipping pallet.

Every function paints its footing and returns its mask. Only the new
animated props import this file, so the original models do not change.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import blob, ctr, last, plan
from pnkit import box, edges


def dirt_patch(g, cx: float, cz: float, rx: float, rz: float, y0: float = 0, h: float = 1, seed: int = 0, soot=None) -> np.ndarray:
    """A flat irregular patch of packed earth, h high. `soot` is an
    optional (x, z, r) area that is painted dark (ash under a fire)."""
    m = plan(g, blob(cx, cz, rx, rz, n=11, jitter=0.16, seed=seed), y0, y0 + h, "sand", 3)
    PP.blotch(g, m, "sand", 2, cell=3, chance=0.12, seed=seed + 1)
    PP.blotch(g, m, "khaki", 3, cell=2, chance=0.04, seed=seed + 2)  # a few dry weeds
    P.outline(g, m, "sand", 2, normal="y")
    if soot is not None:
        X, _Y, Z = ctr(g)
        sx, sz, sr = soot
        d = np.hypot(X - sx, Z - sz)
        P.flat(g, m & (d < sr), "darkwood", 4)
        P.flat(g, m & (d < sr * 0.55), "iron", 3)
    return m


def concrete_pad(g, x0, z0, x1, z1, y0: float = 0, h: float = 2, chamfer: float = 2.5, seed: int = 0, ramp: str = "stone", base: int = 5) -> np.ndarray:
    """A grey poured concrete pad with chamfered corners (true diagonals),
    slab seams, cracks and a darker rim."""
    c = chamfer
    pts = [(x0 + c, z0), (x1 - c, z0), (x1, z0 + c), (x1, z1 - c), (x1 - c, z1), (x0 + c, z1), (x0, z1 - c), (x0, z0 + c)]
    m = plan(g, pts, y0, y0 + h, ramp, base)
    PP.concrete(g, m, ramp, base, size=12, cracks=5, frame="top", seed=seed)
    _X, Y, _Z = ctr(g)
    P.flat(g, m & (Y < y0 + h - 0.5), ramp, base - 1)
    P.outline(g, m & (Y > y0 + h - 1), ramp, base - 2, normal="y")
    return m


def bolt_plate(g, cx: float, cz: float, r: float, y0: float = 0, h: float = 1.5, bolts: int = 8, n: int = 8, seed: int = 0) -> np.ndarray:
    """A steel base flange (an n-gon plate, h high) with `bolts` bolt heads
    on its rim and a ring of rust where the rain stands."""
    m = S.disc(g, "y", cx, cz, r, y0, y0 + h, "steel", 4, n=n)
    X, _Y, Z = ctr(g)
    d = S.ngon_radius(g, "y", cx, cz, n)
    P.flat(g, m & (d > r - 1.0), "steel", 3)
    PP.blotch(g, m & (d > r - 2.5), "rust", 4, cell=2, chance=0.12, seed=seed)
    for k in range(bolts):
        a = 2 * math.pi * (k + 0.5) / bolts
        bx, bz = cx + math.cos(a) * (r - 1.8), cz + math.sin(a) * (r - 1.8)
        m |= S.disc(g, "y", bx, bz, 0.9, y0 + h, y0 + h + 0.8, "steel", 6, n=6)
    return m


def tread_sheets(g, x0, z0, x1, z1, y0: float = 0, turn: float = 6.0) -> np.ndarray:
    """Two salvaged tread-plate steel sheets, 1 voxel thick, the upper one
    turned a little on the lower one (rule F5). Painted diamond tread,
    a dark frame and rust at the cut edges."""
    mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
    lower = [(x0, z0), (mx + 3, z0), (mx + 3, z1), (x0, z1)]
    upper = S.rotate([(mx - 3, z0 + 2), (x1, z0 + 2), (x1, z1 - 1), (mx - 3, z1 - 1)], mx + 6, mz, turn)
    m = plan(g, lower, y0, y0 + 1, "steel", 4)
    m |= plan(g, upper, y0, y0 + 1, "steel", 5)
    X, _Y, Z = ctr(g)
    tread = ((np.floor(X) + np.floor(Z)) % 4 == 0) & ((np.floor(X) - np.floor(Z)) % 4 == 2)
    P.flat(g, m & tread, "steel", 5)
    P.outline(g, m, "iron", 3, normal="y")
    vx, vz = np.floor(X), np.floor(Z)
    rim = m & ((vx <= x0) | (vx >= x1 - 1) | (vz <= z0) | (vz >= z1 - 1))
    PP.blotch(g, rim, "rust", 4, cell=3, chance=0.2, seed=3)  # rust only at the cut edges
    return m


def pallet(g, x0, z0, x1, z1, y0: float = 0) -> np.ndarray:
    """A wooden shipping pallet, 2 voxels high: deck boards across x on
    top, and three dark gaps between the stringer blocks on each side."""
    m = box(g, x0, y0, z0, x1, y0 + 2, z1, "wood", 4)
    P.planks(g, m, "wood", 4, width=3, across="z", nails=True, seed=11)
    X, Y, Z = ctr(g)
    low = m & (Y < y0 + 1)
    span_x, span_z = x1 - x0, z1 - z0
    gap_x = (np.abs(((X - x0) / span_x) * 2 - 0.5) < 0.18) | (np.abs(((X - x0) / span_x) * 2 - 1.5) < 0.18)
    gap_z = (np.abs(((Z - z0) / span_z) * 2 - 0.5) < 0.18) | (np.abs(((Z - z0) / span_z) * 2 - 1.5) < 0.18)
    P.flat(g, low & (gap_x | gap_z), "darkwood", 2)
    P.flat(g, edges(m), "wood", 2)
    return m
