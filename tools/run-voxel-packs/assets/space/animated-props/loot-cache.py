"""Loot cache, in the Pirate Nation mecha style.

The space pack's treasure chest (PN chest scale, one tile): a chamfered
riveted steel box on stubby feet with gold corner guards, a hazard foot
band and a gold star on each side; a faceted hazard-orange lid (true
slopes) with two gold straps. A teal keypad lock on the front blinks on
`idle`. On `open` the lid swings back and shows the glowing load (plasma
cells round a gold star chip) under the teleport beam; `close` shuts it.
Faces -Z.
"""
import numpy as np

import pnglyph
from _life import P, Clip, Grid, Rig, asset, band, box, coords, edges, facet_paint, hazard, keys, light_top, octo, plan, side
from voxgrid import C

S = (28, 24, 24)
CX, CZ = 14, 12
YB = 12  # the body top
HINGE = (CX, YB, CZ + 8.5)


def cache() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    for fx, fz in ((CX - 10, CZ - 7), (CX + 7, CZ - 7), (CX - 10, CZ + 4), (CX + 7, CZ + 4)):
        box(g, fx, 0, fz, fx + 3, 2, fz + 3, "steel", 3)
    body = plan(g, octo(CX, CZ, 11, 8, 2), 2, YB, "steel", 5)
    P.plates(g, body, "steel", 5, size=(8, 5), seed=1)
    P.flat(g, body & (np.abs(X - CX) > 9.5) & (np.abs(Z - CZ) > 6.5), "gold", 6)  # corner guards
    hazard(g, body & (Y < 4.5) & (np.abs(Z - CZ) < 8.1) & (np.abs(X - CX) < 9.5), period=4, frame="wall")
    band(g, body, 1, YB - 1, YB, "gold", 5)
    for face, plane in (("-x", CX - 11), ("+x", CX + 11)):
        pnglyph.icon(g, face, plane, CZ - 4, 3, "star", "gold", 6)
    # the load, seen when the lid is open: plasma cells round a star chip
    top = body & (Y > YB - 1) & (np.abs(X - CX) < 9.5) & (np.abs(Z - CZ) < 6.5)
    P.flat(g, top, "steel", 3)
    for k, cx in enumerate((CX - 7, CX - 4, CX + 4, CX + 7)):
        P.flat(g, top & (np.abs(X - cx) < 1.2) & (np.abs(Z - CZ) < 4.5), "cyan", 7 if k % 2 else 6)
    P.flat(g, top & (np.abs(X - CX) < 2.1) & (np.abs(Z - CZ) < 2.1), "gold", 7)
    P.flat(g, top & ((np.abs(X - CX) < 0.6) | (np.abs(Z - CZ) < 0.6)) & (np.abs(X - CX) < 3.1) & (np.abs(Z - CZ) < 3.1), "gold", 7)
    return g


def lid() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = side(g, [(YB, CZ - 8.6), (YB, CZ + 8.6), (YB + 3, CZ + 8.6), (YB + 7, CZ + 4), (YB + 7, CZ - 4), (YB + 3, CZ - 8.6)], CX - 11.5, CX + 11.5, "orange", 6)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.plates(gg, mm, "orange", 6, size=(12, 5), rivets=False, frame=fr, seed=2))
    for sx in (CX - 7, CX + 6):  # gold straps
        strap = m & (X >= sx) & (X < sx + 2)
        P.flat(g, strap, "gold", 6)
    P.flat(g, m & ((X < CX - 10.5) | (X > CX + 10.5)), "orange", 4)  # end caps
    light_top(g, m & (Y > YB + 6), "orange", 7)
    P.flat(g, m & (Y < YB + 1), "orange", 4)
    return g


def lock() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    plate = box(g, CX - 3, YB - 5, CZ - 9, CX + 3, YB + 1, CZ - 8, "steel", 4)
    P.flat(g, edges(plate), "steel", 3)
    P.flat(g, plate & (np.abs(X - CX) < 2) & (Y > YB - 4) & (Y < YB - 1), "cyan", 7)
    P.flat(g, plate & (np.abs(X - CX) < 1) & (Y > YB - 1), "gold", 6)
    return g


def build():
    rig = Rig()
    rig.add("cache", cache(), (CX, 0, CZ))
    rig.add("lid", lid(), HINGE, "cache")
    rig.add("lock", lock(), (CX, YB - 2, CZ - 9), "cache")
    z = (0.0, 0.0, 0.0)
    one = (1.0, 1.0, 1.0)
    idle = {"lock": {"scale": keys((0, one), (0.5, one), (0.6, (1.25, 1.25, 1.25)), (0.8, one), (1.6, one))}}
    open_ = {"lid": {"rot": keys((0, z), (0.15, (-3, 0, 0)), (0.7, (110, 0, 0)), (0.85, (100, 0, 0)), (1.0, (104, 0, 0)))},
             "lock": {"scale": keys((0, one), (0.12, (1.3, 1.3, 1.3)), (0.3, one))}}
    close = {"lid": {"rot": keys((0, (104, 0, 0)), (0.55, (0, 0, 0)), (0.65, (4, 0, 0)), (0.8, z))}}
    loot = rig.sock("socket-loot", (CX, YB + 1, CZ), "cache")
    return asset("animated-props", "loot-cache", "Loot Cache", rig.root,
                 clips=[Clip("idle", idle), Clip("open", open_, loop=False), Clip("close", close, loop=False)], sockets=[loot],
                 pfx=[{"effectId": "rvx-space-data-burst", "socket": "socket-loot", "trigger": "clip:open", "size": 22, "at": 0.25}])


_ = C
