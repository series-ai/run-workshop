"""Road-spike trap: a hazard plate on the ground whose spikes hide under it
(below the floor) and shoot up through slots on `active`.

The spikes are authored raised, so the exporter's rest bounds sit the plate
on the floor (it grounds the lowest rest vertex); every clip keys them down
by DROP when armed, so only the tips poke out of the plate slots."""
import numpy as np

import paint as P
import pnpaint as PP
from _life import Rig, ctr, fx, keys, limb, make
from pnkit import box, edges
from voxgrid import C, Clip, Grid

SIZE = (58, 24, 46)
G0 = 0  # the floor in the build frame
TIP = 3  # armed: how far the spike tips poke out above the plate top
DROP = 12 - TIP  # armed: the tips (y 18 raised) sit TIP over the plate top (y 6)


def base() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    Y0 = Y - G0
    plate = box(g, 5, G0, 4, 53, G0 + 6, 42, "steel", 4)
    P.plates(g, plate, "steel", 4, size=(8, 7), seed=1)
    P.flat(g, edges(plate), "iron", 2)
    warning = plate & (Y0 > 4) & (((np.floor(X + Z) % 8) < 2))
    PP.hazard(g, warning, period=6, a=("gold", 6), b=("darkwood", 3), frame="top")
    for z0 in (8, 36):
        rail = box(g, 5, G0 + 6, z0, 53, G0 + 9, z0 + 3, "rust", 5)
        P.plates(g, rail, "rust", 5, size=(7, 4), seed=z0)
    # Dark slots in the plate top where the spikes punch through.
    for x0 in SPIKE_X:
        for z0 in SPIKE_Z:
            slot = plate & (Y0 > 5) & (X >= x0 - 1) & (X < x0 + 4) & (Z >= z0 - 1) & (Z < z0 + 2)
            P.flat(g, slot, "iron", 1)
    return g


SPIKE_X = (8, 18, 28, 38, 48)
SPIKE_Z = (14, 26)


def teeth() -> Grid:
    """The spike bed, authored raised (see the module docstring)."""
    g = Grid(*SIZE)
    y0 = G0 + 5
    for x0 in SPIKE_X:
        for z0 in SPIKE_Z:
            limb(g, (x0, y0, z0), (x0 + 2, y0 + 13, z0), 3.0, 0.0, "steel", 6, n=4)
            tooth = box(g, x0 - 1, y0, z0 - 1, x0 + 4, y0 + 2, z0 + 2, "rust", 4)
            P.flat(g, tooth & (np.floor(ctr(g)[1]) > y0), "gold", 5)
    return g


def build():
    rig = Rig("spike-trap", (29, G0, 23), base())
    rig.add("teeth", teeth(), (29, G0 + 5, 23))
    down = (0, -DROP, 0)
    # One key a frame (ease 0), so the slam is exact. Armed, only the tips
    # show (f0-7); a 2-frame catch sinks them a voxel, then the bed slams up
    # out of the plate in 4 frames, accelerating all the way into the top
    # (impact f13), a hard stop with a small rebound, a hold, then it winds
    # back down to the tips and clunks home.
    def height(f: int) -> float:
        if f <= 7:
            return -DROP
        if f <= 9:
            return -DROP - 0.5 * (f - 7)
        if f <= 13:
            return -DROP - 1.0 + (DROP + 1.0) * ((f - 9) / 4) ** 2
        if f <= 28:
            return {14: -1.2, 15: -0.4}.get(f, 0.0)
        if f <= 36:
            u = (f - 28) / 8
            return -DROP * u * u * (3 - 2 * u) - (0.0 if f < 36 else 0.4)
        return -DROP
    imp = 13
    active = {"teeth": {"loc": [(f / 30, (0.0, height(f), 0.0)) for f in range(49)]}}
    socket = rig.socket("socket-teeth", (29, G0 + 19, 23), parent="teeth")
    idle = {"teeth": {"loc": keys((0, down), (2, down))}}
    return make("animated-props", "spike-trap", "Road Spike Trap", rig.root,
                clips=[Clip("idle", idle, ease=0), Clip("active", active, impact=imp / 30, ease=0)], sockets=[socket],
                pfx=[fx("rvx-apocalypse-metal-clang", "socket-teeth", "clip:active", at=imp / 30, size=12)])
