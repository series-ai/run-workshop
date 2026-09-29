"""Shield generator, in the Pirate Nation mecha style.

A hex base with riveted slopes and an orange band, a tall tapered white
hull pylon (true slopes) with orange stripes and teal light strips on its
facets, crowned by an oversized faceted teal crystal. Two hexagonal
emitter rings, orange and gold, circle the pylon with glowing nodes. On
`idle` the rings spin (force-field PFX on the crystal); on `hit` the
generator shudders and the rings wobble (shield-hit PFX). Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, coords, flat_ngon, gem, keys, light_top, mask_of, ngon_y, plate_facets, spin, facet_paint
from pnshapes import ngon_radius
from voxgrid import C

S = (34, 42, 34)
CX, CZ = 17, 17
YP0, YP1 = 5, 26  # pylon
YF = 32  # crystal centre (the field socket)


def gen() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    base = ngon_y(g, CX, CZ, 13, 0, YP0, "steel", 5, n=6, r_top=11)
    plate_facets(g, [g.solids[-1]], "steel", 5, size=(8, 5), seed=1)
    band(g, base, 1, 0, 1, "steel", 3)
    band(g, base, 1, 1, 2.5, "orange", 5)
    deck = ngon_y(g, CX, CZ, 10, YP0, YP0 + 1, "steel", 4, n=6)
    light_top(g, deck, "steel", 6)
    pylon = ngon_y(g, CX, CZ, 6, YP0 + 1, YP1, "bone", 6, n=6, r_top=3.5)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.plates(gg, mm, "bone", 6, size=(6, 7), rivets=False, frame=fr))
    for y in (9, 17):
        band(g, pylon, 1, y, y + 2, "orange", 6)
    ang = np.arctan2(Z - CZ, X - CX)
    mid = np.abs(((ang / (2 * np.pi) * 6) % 1) - 0.5) < 0.1  # the middle of each facet
    P.flat(g, pylon & mid & (Y > 12) & (Y < 16), "cyan", 7)
    P.flat(g, pylon & mid & (Y > 20) & (Y < YP1 - 1), "cyan", 7)
    collar = ngon_y(g, CX, CZ, 5, YP1, YP1 + 2, "steel", 4, n=6, r_top=5.5)
    light_top(g, collar, "steel", 6)
    solids = gem(g, CX, CZ, YP1 + 1, 5.5, 13, "cyan", 6, n=6, waist=0.35, cap=0.12)
    m = mask_of(g, solids)
    P.flat(g, m, "cyan", 6)
    P.flat(g, m & (np.abs(((ang / (2 * np.pi) * 6) % 1) - 0.5) < 0.12), "cyan", 7)
    P.flat(g, m & (Y > YF + 4), "cyan", 7)
    P.flat(g, m & (Y < YP1 + 3), "cyan", 5)
    return g


def ring(y: float, r0: float, r1: float, ramp: str) -> Grid:
    g = Grid(*S)
    n = 6
    outer, inner = flat_ngon(CX, CZ, r1, n), flat_ngon(CX, CZ, r0, n)
    start = len(g.solids)
    for k in range(n):
        g.prism("y", [outer[k], outer[(k + 1) % n], inner[(k + 1) % n], inner[k]], y - 1, y + 1, C(ramp, 6))
    m = mask_of(g, g.solids[start:])
    X, Y, Z = coords(g)
    P.flat(g, m, ramp, 6)
    P.flat(g, m & (ngon_radius(g, "y", CX, CZ, n) > r1 - 0.8), ramp, 4)
    ang = np.arctan2(Z - CZ, X - CX)
    P.flat(g, m & (np.abs(((ang / (2 * np.pi) * 6) % 1) - 0.5) < 0.07), "cyan", 7)
    return g


def build():
    rig = Rig()
    rig.add("shield-gen", gen(), (CX, 0, CZ))
    rig.add("ring-a", ring(12, 8.0, 10.5, "orange"), (CX, 12, CZ), "shield-gen", rot=(10.0, 0.0, 0.0))
    rig.add("ring-b", ring(21, 6.5, 8.8, "gold"), (CX, 21, CZ), "shield-gen", rot=(0.0, 0.0, -10.0))
    field = rig.sock("socket-field", (CX, YF, CZ), "shield-gen")
    z = (0.0, 0.0, 0.0)
    idle = {"ring-a": {"rot": spin(3.0, "y", 360)}, "ring-b": {"rot": spin(3.0, "y", -360)}}
    hit = {"shield-gen": {"rot": keys((0, z), (0.06, (3, 0, -2)), (0.14, (-2, 0, 2)), (0.24, (1, 0, -1)), (0.4, z))},
           "ring-a": {"rot": keys((0, z), (0.1, (12, 30, 0)), (0.3, (-6, 60, 0)), (0.6, (0, 90, 0)))},
           "ring-b": {"rot": keys((0, z), (0.1, (0, -30, -12)), (0.3, (0, -60, 6)), (0.6, (0, -90, 0)))}}
    return asset("animated-props", "shield-generator", "Shield Generator", rig.root,
                 clips=[Clip("idle", idle), Clip("hit", hit, loop=False)], sockets=[field],
                 pfx=[{"effectId": "rvx-space-shield-dome", "socket": "socket-field", "trigger": "idle", "size": 34},
                      {"effectId": "rvx-space-shield-hit", "socket": "socket-field", "trigger": "clip:hit", "size": 34}])
