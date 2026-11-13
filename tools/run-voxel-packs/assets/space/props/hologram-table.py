"""Hologram table, in the Pirate Nation mecha style.

One iconic shape (rule K3): a round command table at table height on a
tapered octagonal pedestal (true slopes, F2) and a four-footed base. The
top has a gold rim, a ring of lit keys and a glowing projector ring. Above
it floats an oversized faceted cyan planet with a tilted ring and a small
moon (F4, F5). Detail is paint (S1). Faces -Z.
"""
import math

import numpy as np

import paint as P
from _props import ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets, flat_ngon
from voxgrid import C, Asset, Clip, Grid, Part, sway, turn

S = 32
C0 = S / 2
YT = 16  # table top


def table() -> Grid:
    g = Grid(S, YT + 2, S)
    X, Y, Z = coords(g)
    # four feet in a cross
    for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        x0, x1 = (C0 - 2, C0 + 2) if dx == 0 else ((C0, C0 + 13) if dx > 0 else (C0 - 13, C0))
        z0, z1 = (C0 - 2, C0 + 2) if dz == 0 else ((C0, C0 + 13) if dz > 0 else (C0 - 13, C0))
        f = box(g, x0, 0, z0, x1, 2, z1, "steel", 4)
        P.flat(g, edges(f), "steel", 3)
    for dx, dz in ((12, 0), (-12, 0), (0, 12), (0, -12)):
        pad = box(g, C0 + dx - 2, 0, C0 + dz - 2, C0 + dx + 2, 3, C0 + dz + 2, "orange", 5)
        P.flat(g, edges(pad), "orange", 3)
    ped = ngon_prism(g, "y", C0, C0, 5.5, 2, 12, "steel", 5, r_top=3.5)
    for m, fr in facets(g):
        P.plates(g, m, "steel", 5, size=(5, 4), rivets=False, frame=fr)
    P.flat(g, ped & (np.abs(Y - 7.5) < 0.6), "cyan", 6)
    under = ngon_prism(g, "y", C0, C0, 12, 12, YT - 1, "steel", 4, r_top=14.5)
    for m, fr in facets(g):
        P.plates(g, m, "steel", 4, size=(8, 3), rivets=True, frame=fr)
    top = ngon_prism(g, "y", C0, C0, 14.5, YT - 1, YT + 1, "gold", 5)
    rr = np.hypot(X - C0, Z - C0)
    d = top & (Y > YT)
    P.flat(g, d, "steel", 3)
    P.flat(g, d & (rr > 12.5), "gold", 6)
    P.flat(g, top & (Y < YT) , "gold", 4)
    ang = np.arctan2(Z - C0, X - C0)
    keys = d & (rr > 9.5) & (rr < 11.5) & (np.floor((ang + math.pi) / (2 * math.pi) * 24) % 2 == 0)
    P.flat(g, keys, "cyan", 6)
    P.flat(g, keys & (np.floor((ang + math.pi) / (2 * math.pi) * 24) % 6 == 0), "orange", 6)
    P.flat(g, d & (rr > 4) & (rr < 6), "cyan", 5)  # the projector ring
    P.flat(g, d & (rr < 4), "cyan", 7)
    return g


def planet() -> Grid:
    """A faceted ball of three octagonal frustums, with painted bands."""
    g = Grid(14, 14, 14)
    X, Y, Z = coords(g)
    c = 7.0
    ngon_prism(g, "y", c, c, 3.5, 0, 4, "cyan", 5, r_top=6.5)
    ngon_prism(g, "y", c, c, 6.5, 4, 10, "cyan", 5)
    ngon_prism(g, "y", c, c, 6.5, 10, 14, "cyan", 5, r_top=3.5)
    m = g.a > 0
    P.flat(g, m, "cyan", 5)
    P.flat(g, m & (Y > 11), "cyan", 7)
    P.flat(g, m & (np.abs(Y - 6.5) < 1.1), "cyan", 3)  # continents as bands
    P.flat(g, m & (np.abs(Y - 9 + 0.4 * (X - c)) < 0.8), "teal", 6)
    P.flat(g, m & (Y < 3), "cyan", 4)
    return g


def ring() -> Grid:
    """A flat octagonal ring, built as two C-shaped halves."""
    g = Grid(24, 1, 24)
    outer = flat_ngon(12, 12, 11.5, 8)
    inner = flat_ngon(12, 12, 9.0, 8)
    for half in (range(0, 5), range(4, 9)):
        ks = [k % 8 for k in half]
        g.prism("y", [outer[k] for k in ks] + [inner[k] for k in reversed(ks)], 0, 1, C("cyan", 6))
    X, Y, Z = coords(g)
    P.flat(g, (g.a > 0) & (np.hypot(X - 12, Z - 12) > 10.8), "cyan", 7)
    return g


def moon() -> Grid:
    g = Grid(4, 4, 4)
    m = box(g, 0, 0, 0, 4, 4, 4, "bone", 6)
    P.flat(g, m & (coords(g)[1] > 3), "bone", 7)
    return g


def build() -> Asset:
    root = Part("hologram-table", table())
    holo = root.add(Part("hologram", None, at=(C0, YT + 4.0, C0)))
    holo.add(Part("planet", planet(), pivot=(7.0, 7.0, 7.0), at=(0.0, 7.0, 0.0), rot=(0.0, 12.0, 0.0)))
    holo.add(Part("ring", ring(), pivot=(12.0, 0.5, 12.0), at=(0.0, 7.0, 0.0), rot=(18.0, 0.0, -14.0)))
    holo.add(Part("moon", moon(), pivot=(2.0, 2.0, 2.0), at=(10.0, 12.0, -4.0), rot=(20.0, 30.0, 10.0)))
    return Asset(id="space-props-hologram-table", pack="space", category="props", name="Hologram Table", root=root,
                 # the hologram turns and bobs; the planet and the moon spin, and the moon rides up and down
                 clips=[Clip("idle", {"hologram": {"rot": turn(12.0, "y", 30.0), "loc": sway(12.0, amp=(0.0, 0.6, 0.0), cycles=(1, 2, 1))},
                                      "planet": {"rot": turn(12.0, "y", 60.0)},
                                      "moon": {"rot": turn(12.0, "y", 90.0), "loc": sway(12.0, amp=(0.0, 1.2, 0.0), cycles=(1, 3, 1))}})])
