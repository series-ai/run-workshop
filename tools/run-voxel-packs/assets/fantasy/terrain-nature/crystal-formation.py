"""Arcane crystal outcrop in the Pirate Nation style.

Three faceted boulders (true slopes, painted stone blocks, a little moss)
burst open by a cluster of six-sided gem spires that lean out from the
centre: magic cyan, royal blue and a few violet. Facets alternate light and
dark with bright edges; the stone round each spire foot is lit by a
painted cyan glow. The tall centre spire is the `heart`: a separate part
that pulses on `idle` (the frost-nova PFX fires at `socket-heart` on
demand).

About 46 wide and 52 tall (terrain class). Faces -Z.
"""
import math

import numpy as np

import paint as P
from _life import asset, boulder, coords, crystal, pfx, rig
from voxgrid import Clip, Grid, Socket

S = (54, 60, 48)
CX, CZ = 27.0, 24.0
HEART_Y0 = 8.0
HEART_H, HEART_TIP = 32.0, 11.0

# outer spires: (x, z, y0, r, h, tip, ramp, base, lean_scale, turn)
SPIRES = [
    (CX - 8, CZ + 3, 6, 4.4, 18, 6, "blue", 5, 0.55, 0.2),
    (CX + 8, CZ - 2, 6, 4.0, 15, 6, "cyan", 5, 0.6, 0.5),
    (CX + 3, CZ + 9, 6, 3.6, 13, 5, "arcane", 5, 0.6, 0.1),
    (CX - 4, CZ - 8, 5, 3.4, 10, 5, "cyan", 5, 0.7, 0.8),
    (CX - 15, CZ + 7, 4, 3.2, 8, 4, "cyan", 5, 0.8, 0.3),
    (CX + 15, CZ - 7, 3, 3.0, 7, 4, "arcane", 5, 0.8, 0.9),
]


def spire(g: Grid, x, z, y0, r, h, tip, ramp: str, base: int, lean, turn) -> np.ndarray:
    """A gem spire (the _life.crystal shape, 6 facets) painted in one shade
    with a tip one step lighter. The render light already splits the
    facets; per-facet paint would zigzag at every facet border on these
    sheared faces (tested), so the only paint border is the level ring where
    the tip starts."""
    m = crystal(g, x, z, y0, r, h, tip, ramp, base, n=6, lean=lean, turn=turn, paint=False)
    _X, Y, _Z = coords(g)
    P.flat(g, m, ramp, base)
    P.flat(g, m & (Y > y0 + h), ramp, min(7, base + 1))
    return m


def outcrop() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    rock = boulder(g, CX, CZ, 0, 13.0, 10.0, "stone", 4, n=8, seed=3, lean=(0.5, 0.5), squash=(1.0, 0.9))
    rock |= boulder(g, CX - 14, CZ + 6, 0, 8.0, 8.0, "stone", 4, n=7, seed=5, lean=(-1.0, 0.5))
    rock |= boulder(g, CX + 14, CZ - 7, 0, 7.0, 6.5, "stone", 4, n=7, seed=8, lean=(1.0, -0.5))
    feet = []
    gems = np.zeros(S, dtype=bool)
    for x, z, y0, r, h, tip, ramp, base, ls, turn in SPIRES:
        dx, dz = x - CX, z - CZ
        k = (h + tip) * ls * 0.5 / max(1e-6, math.hypot(dx, dz))  # lean out from the centre
        gems |= spire(g, x, z, y0, r, h, tip, ramp, base, lean=(dx * k, dz * k), turn=turn)
        feet.append((x, z, r))
    rock &= ~gems
    # the stone round every spire foot glows cyan (a radial paint, no speckle)
    near = np.zeros(S, dtype=bool)
    nearer = np.zeros(S, dtype=bool)
    for x, z, r in feet + [(CX, CZ, 6.0)]:
        d = np.hypot(X - x, Z - z)
        near |= d < r + 2.0
        nearer |= d < r + 1.0
    rim = rock & near & (Y > 4)
    P.flat(g, rim, "cyan", 4)
    P.flat(g, rim & nearer, "plasma", 5)
    # moss creeps up the lower slopes of the outcrop (a band)
    P.flat(g, rock & ~near & (Y < 2.5), "moss", 5)
    return g


def heart() -> Grid:
    g = Grid(*S)
    spire(g, CX, CZ, HEART_Y0, 6.5, HEART_H, HEART_TIP, "cyan", 5, lean=(1.5, -0.5), turn=0.3)
    return g


def build():
    hinge = (CX, HEART_Y0, CZ)
    root, to_root = rig([("crystal-formation", outcrop(), None, None), ("heart", heart(), hinge, None)])
    idle = {"heart": {"scale": [(0.0, (1.0, 1.0, 1.0)), (1.2, (1.06, 1.03, 1.06)), (2.4, (1.0, 1.0, 1.0))],
                      "rot": [(0.0, (0.0, 0.0, 0.0)), (1.2, (0.0, 0.0, 1.5)), (2.4, (0.0, 0.0, 0.0))]}}
    return asset("terrain-nature", "crystal-formation", "Arcane Crystal Outcrop", root, clips=[Clip("idle", idle)],
                 sockets=[Socket("socket-heart", at=to_root((CX + 0.8, HEART_Y0 + 22, CZ)), parent="heart")],
                 # the nova bursts round the foot of the spire (the socket is 22 voxels up it)
                 fx=[pfx("rvx-fantasy-frost-nova", "socket-heart", "manual", size=40, offset=(0.0, -20.0, 0.0))])
