"""Fusion reactor core, in the Pirate Nation mecha style.

A heavy tapered base with hazard stripes and an orange deck; four copper
pipes with flanges form the cage and carry a riveted cap with a sloped
steel crown (true slopes). Inside, a tall faceted plasma core glows teal
and white. Two orange and gold containment rings, each tilted, circle it.
On `idle` the core pulses and the rings counter-rotate. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, coords, facet_paint, flat_ngon, gem, keys, light_top, mask_of, ngon_y, octo, plan, plate_facets, spin
from pnshapes import ngon_radius, pipe
from voxgrid import C

S = (34, 42, 34)
CX, CZ = 17, 17
YD, YC = 7, 32  # deck top, cap bottom
POST = 8


def reactor() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    base = plan(g, octo(CX, CZ, 14, 14, 5), 0, 5, "steel", 5, top=octo(CX, CZ, 12, 12, 4))
    plate_facets(g, [g.solids[-1]], "steel", 5, size=(9, 6), seed=1)
    band(g, base, 1, 0, 1, "steel", 3)
    band(g, base, 1, 1, 3, "orange", 5)
    deck = ngon_y(g, CX, CZ, 11, 5, YD, "orange", 6)
    light_top(g, deck, "orange", 7)
    socket = ngon_y(g, CX, CZ, 6.5, YD, YD + 2, "steel", 4)
    light_top(g, socket, "steel", 6)
    for sx in (-1, 1):
        for sz in (-1, 1):
            pipe(g, [(CX + sx * POST, YD, CZ + sz * POST), (CX + sx * POST, YC, CZ + sz * POST)], s=3, ramp="rust", base=6)
    cap = ngon_y(g, CX, CZ, 11, YC, YC + 3, "steel", 5)
    P.plates(g, cap, "steel", 5, size=(7, 3), seed=2)
    band(g, cap, 1, YC, YC + 1, "orange", 5)
    crown = ngon_y(g, CX, CZ, 10, YC + 3, YC + 6, "steel", 5, r_top=5.5)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.plates(gg, mm, "steel", 5, size=(7, 5), rivets=False, frame=fr))
    vent = ngon_y(g, CX, CZ, 5, YC + 6, YC + 7, "cyan", 6)
    light_top(g, vent, "cyan", 7)
    socket2 = ngon_y(g, CX, CZ, 5, YC - 2, YC, "steel", 4)
    del crown, socket2
    return g


def core() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    solids = gem(g, CX, CZ, YD + 2, 5, YC - 2 - (YD + 2), "cyan", 6, n=8, waist=0.5, cap=0.6)
    m = mask_of(g, solids)
    P.flat(g, m, "cyan", 7)
    P.flat(g, m & (np.abs(Y - (YD + YC) / 2) < 3), "bone", 7)
    ang = np.arctan2(Z - CZ, X - CX)
    P.flat(g, m & (np.abs(((ang / (2 * np.pi) * 8 + 0.5) % 1) - 0.5) < 0.08), "bone", 7)  # bright facet edges
    return g


def ring(y: float, r0: float, r1: float, ramp: str) -> Grid:
    g = Grid(*S)
    n = 10
    outer, inner = flat_ngon(CX, CZ, r1, n), flat_ngon(CX, CZ, r0, n)
    start = len(g.solids)
    for k in range(n):
        g.prism("y", [outer[k], outer[(k + 1) % n], inner[(k + 1) % n], inner[k]], y - 1, y + 1, C(ramp, 6))
    m = mask_of(g, g.solids[start:])
    P.flat(g, m, ramp, 6)
    X, Y, Z = coords(g)
    ang = np.arctan2(Z - CZ, X - CX)
    P.flat(g, m & (np.abs(((ang / (2 * np.pi) * 5 + 0.5) % 1) - 0.5) < 0.06), "cyan", 7)  # emitters
    P.flat(g, m & (ngon_radius(g, "y", CX, CZ, n) > r1 - 0.8), ramp, 4)
    return g


def build():
    rig = Rig()
    rig.add("reactor", reactor(), (CX, 0, CZ))
    rig.add("core", core(), (CX, (YD + YC) / 2, CZ), "reactor")
    rig.add("ring-a", ring(15, 7.2, 9.2, "orange"), (CX, 15, CZ), "reactor", rot=(16.0, 0.0, 0.0))
    rig.add("ring-b", ring(26, 7.2, 9.2, "gold"), (CX, 26, CZ), "reactor", rot=(0.0, 0.0, -16.0))
    one = (1.0, 1.0, 1.0)
    idle = {"core": {"scale": keys((0, one), (0.6, (1.08, 1.04, 1.08)), (1.2, one), (1.8, (1.08, 1.04, 1.08)), (2.4, one))},
            "ring-a": {"rot": spin(2.4, "y", 360)}, "ring-b": {"rot": spin(2.4, "y", -360)}}
    return asset("animated-props", "reactor-core", "Fusion Reactor Core", rig.root, clips=[Clip("idle", idle)])
