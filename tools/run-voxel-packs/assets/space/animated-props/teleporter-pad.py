"""Teleporter pad, in the Pirate Nation mecha style.

A round (octagonal) platform with sloped riveted sides and an orange band,
a steel deck painted with glowing teal rings and a bright centre, and
three orange emitter pylons that lean in over it (true slopes) with teal
tips; the front stays open to step on. A glowing teal halo hovers over the
deck. On `idle` it turns slowly; on `active` it rises and pulses while
the beam PFX fires from the pad centre. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, box, coords, flat_ngon, front, keys, light_top, mask_of, ngon_y, plate_facets, quad, side, spin
from pnshapes import ngon_radius
from voxgrid import C

S = (40, 26, 40)
CX, CZ = 20, 20
YD = 5  # deck top
YH = 8  # halo height at rest


def pad() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    base = ngon_y(g, CX, CZ, 16, 0, YD - 1, "steel", 5, r_top=14.5)
    plate_facets(g, [g.solids[-1]], "steel", 5, size=(9, 4), seed=1)
    band(g, base, 1, 0, 1, "steel", 3)
    band(g, base, 1, 1, 2.5, "orange", 5)
    deck = ngon_y(g, CX, CZ, 14, YD - 1, YD, "steel", 6)
    d = ngon_radius(g, "y", CX, CZ, 8)
    top = deck & (Y > YD - 1)
    P.flat(g, top, "steel", 6)
    P.flat(g, top & (d > 12.8), "steel", 4)
    for r0, r1, sh in ((9.0, 10.5, 6), (5.0, 6.0, 5)):
        P.flat(g, top & (d > r0) & (d <= r1), "cyan", sh)
    P.flat(g, top & (d <= 3.0), "cyan", 7)
    ang = np.arctan2(Z - CZ, X - CX)
    P.flat(g, top & (d > 6) & (d < 9) & (np.abs(((ang / (2 * np.pi) * 8) % 1) - 0.5) < 0.08), "steel", 4)  # spokes
    # a ramp lip at the front
    lip = side(g, [(0, CZ - 17), (0, CZ - 14), (YD - 1, CZ - 14)], CX - 6, CX + 6, "orange", 6)
    light_top(g, lip, "orange", 7)
    # three pylons leaning in: left, right and back
    pyl = np.zeros(g.shape, dtype=bool)
    tips = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        pyl |= front(g, quad((CX + s * 14, YD - 1), (CX + s * 10.5, YD + 15), 2.0, 1.4), CZ - 1.5, CZ + 1.5, "orange", 6)
        tips |= box(g, CX + s * 10.5 - 1.5, YD + 14, CZ - 1.5, CX + s * 10.5 + 1.5, YD + 17, CZ + 1.5, "cyan", 7)
    pyl |= side(g, quad((YD - 1, CZ + 14), (YD + 15, CZ + 10.5), 2.0, 1.4), CX - 1.5, CX + 1.5, "orange", 6)
    tips |= box(g, CX - 1.5, YD + 14, CZ + 9, CX + 1.5, YD + 17, CZ + 12, "cyan", 7)
    P.flat(g, pyl, "orange", 6)
    P.flat(g, pyl & (Y < YD + 3), "steel", 4)
    P.flat(g, pyl & (Y > YD + 8) & (Y < YD + 10), "steel", 5)
    P.flat(g, tips, "cyan", 7)
    P.outline(g, tips, "cyan", 5)
    return g


def halo() -> Grid:
    g = Grid(*S)
    n = 8
    outer, inner = flat_ngon(CX, CZ, 10, n), flat_ngon(CX, CZ, 7.5, n)
    start = len(g.solids)
    for k in range(n):
        g.prism("y", [outer[k], outer[(k + 1) % n], inner[(k + 1) % n], inner[k]], YH, YH + 1.5, C("cyan", 7))
    m = mask_of(g, g.solids[start:])
    X, Y, Z = coords(g)
    P.flat(g, m, "cyan", 7)
    P.flat(g, m & (ngon_radius(g, "y", CX, CZ, n) > 9.2), "cyan", 5)
    return g


def build():
    rig = Rig()
    rig.add("teleporter", pad(), (CX, 0, CZ))
    rig.add("halo", halo(), (CX, YH, CZ), "teleporter")
    beam = rig.sock("socket-beam", (CX, YD, CZ), "teleporter")
    z = (0.0, 0.0, 0.0)
    one = (1.0, 1.0, 1.0)
    idle = {"halo": {"rot": spin(6.0, "y", 360)}}
    active = {"halo": {"loc": keys((0, z), (0.5, (0, 12, 0)), (1.0, (0, 6, 0)), (1.5, (0, 12, 0)), (2.0, z)),
                       "scale": keys((0, one), (0.5, (0.8, 1, 0.8)), (1.0, (1.15, 1, 1.15)), (1.5, (0.8, 1, 0.8)), (2.0, one)),
                       "rot": spin(2.0, "y", 360)}}
    return asset("animated-props", "teleporter-pad", "Teleporter Pad", rig.root,
                 clips=[Clip("idle", idle), Clip("active", active)], sockets=[beam],
                 pfx=[{"effectId": "rvx-space-teleport-beam", "socket": "socket-beam", "trigger": "clip:active", "size": 26}])
