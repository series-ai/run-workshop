"""Teleporter pad, in the Pirate Nation mecha style.

A round (octagonal) platform with sloped riveted sides and an orange band,
a steel deck with a framed landing grid and bright receiver, and three
copper emitter pylons that lean in over it (true slopes) with steel collars
and cyan lenses; the front stays open to step on. A teal halo hovers over the
deck. On `idle` it turns slowly; on `active` it rises and pulses while
the beam PFX fires from the pad centre. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, coords, flat_ngon, front, keys, light_top, mask_of, ngon_y, plate_facets, quad, side, spin
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
    # Broad deck panels use a dark, even grid. Cyan lines mark the landing
    # target and lead into the central receiver.
    deck_face = top & (d <= 12.8)
    P.flat(g, deck_face & ((np.abs(X - 12) < 0.55) | (np.abs(X - 28) < 0.55) |
                           (np.abs(Z - 12) < 0.55) | (np.abs(Z - 28) < 0.55)), "steel", 3)
    target = deck_face & (((np.abs(X - CX) < 1.0) & (np.abs(Z - CZ) < 8.5)) |
                          ((np.abs(Z - CZ) < 1.0) & (np.abs(X - CX) < 8.5)))
    P.flat(g, target, "cyan", 5)
    P.flat(g, top & (d <= 3.0), "cyan", 7)
    P.outline(g, top, "steel", 3, normal="y")
    # Four orange stops mark the landing cross without forming a noisy ring.
    for sx, sz in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        marker = top & (np.abs(X - (CX + sx * 9.5)) < (1.5 if sx == 0 else 1.0)) & (np.abs(Z - (CZ + sz * 9.5)) < (1.5 if sz == 0 else 1.0))
        P.flat(g, marker, "orange", 6)
    # three pylons leaning in: left, right and back
    pyl = np.zeros(g.shape, dtype=bool)
    emitters = []
    for s in (-1, 1):
        px, pz = CX + s * 10.5, CZ
        pyl |= front(g, quad((CX + s * 14, YD - 1), (px, YD + 15), 2.7, 2.3), pz - 2.25, pz + 2.25, "rust", 5)
        emitters.append((px, pz))
    pz = CZ + 10.5
    pyl |= side(g, quad((YD - 1, CZ + 14), (YD + 15, pz), 2.7, 2.3), CX - 2.25, CX + 2.25, "rust", 5)
    emitters.append((CX, pz))
    P.plates(g, pyl, "rust", 5, size=(7, 5), seed=2)
    # Heavy steel feet and collars break up the copper shafts.
    P.flat(g, pyl & (Y < YD + 2), "steel", 4)
    P.flat(g, pyl & (Y >= YD + 9) & (Y < YD + 10), "steel", 5)
    # A narrow cyan service stripe sits on each forward facing panel.
    for px, pz in emitters:
        face = pyl & (Z <= pz - 2.15) & (Y > YD + 3) & (Y < YD + 8)
        panel = face & (np.abs(X - px) <= 1.0)
        P.flat(g, panel, "cyan", 5)
        rails = face & (np.abs(X - px) >= 1.7)
        P.flat(g, rails, "steel", 3)
        for yy in (YD + 4, YD + 7):
            rivet = pyl & (np.abs(Y - yy) < 0.5) & (np.abs(X - px) < 2.0) & (Z <= pz - 2.15)
            P.flat(g, rivet, "steel", 6)
        housing = ngon_y(g, px, pz, 3.2, YD + 14, YD + 17, "steel", 4)
        P.plates(g, housing, "steel", 4, size=(4, 3), seed=4)
        band(g, housing, 1, YD + 14, YD + 15, "orange", 5)
        lens = ngon_y(g, px, pz, 1.9, YD + 17, YD + 19, "cyan", 6)
        P.flat(g, lens & (Y < YD + 18), "cyan", 6)
        P.flat(g, lens & (Y >= YD + 18), "cyan", 7)
    return g


def halo() -> Grid:
    g = Grid(*S)
    n = 8
    outer, inner = flat_ngon(CX, CZ, 10, n), flat_ngon(CX, CZ, 7.5, n)
    start = len(g.solids)
    for k in range(n):
        g.prism("y", [outer[k], outer[(k + 1) % n], inner[(k + 1) % n], inner[k]], YH, YH + 1.5, C("cyan", 7))
    m = mask_of(g, g.solids[start:])
    P.flat(g, m, "cyan", 7)
    top = light_top(g, m, "cyan", 7)
    P.outline(g, top, "steel", 3, normal="y")
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
