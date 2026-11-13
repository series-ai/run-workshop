"""Painted crystal faces rise from broken rock ledges."""
import math

import numpy as np

import paint as P
from _life import asset, boulder, coords, crystal, pfx, rig
from voxgrid import Clip, Grid, Socket
from _scenery import broken_rock

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
    m=crystal(g,x,z,y0,r,h,tip,ramp,base,n=6,lean=lean,turn=turn,paint=True)
    X,Y,Z=coords(g)
    P.flat(g,m & (np.abs(X-x)<.8) & (Y>y0+h*.4),ramp,7)
    return m


def outcrop() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    rock=broken_rock(g,CX,CZ,0,13,10,3)
    rock|=broken_rock(g,CX-14,CZ+6,0,8,8,5)
    rock|=broken_rock(g,CX+14,CZ-7,0,7,6.5,8)
    for x,z in ((10,14),(40,34),(35,10)):
        crystal(g,x,z,0,1.8,4,3,"cyan",5,n=6)
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
    idle={"heart":{"rot":[(0,(0,0,0)),(1.2,(0,0,1.5)),(2.4,(0,0,0))]}}
    return asset("terrain-nature", "crystal-formation", "Arcane Crystal Outcrop", root, clips=[Clip("idle", idle)],
                 sockets=[Socket("socket-heart", at=to_root((CX + 0.8, HEART_Y0 + 22, CZ)), parent="heart")],
                 # the nova bursts round the lower spire, just above the rock (the socket is 22 voxels up it)
                 fx=[pfx("rvx-fantasy-frost-nova", "socket-heart", "manual", size=40, offset=(0.0, -12.0, 0.0))])
