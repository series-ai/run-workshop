"""Plasma cannon, in the Pirate Nation mecha style.

A deck gun on a hazard-striped turntable: a compact chamfered steel turret
that tapers as it rises (true slopes, F2), with a sloped teal gunner
screen, a copper ammo drum on one flank and thick trunnion caps. The
oversized function prop is the barrel (F4): a long faceted tube in warm
white hull plate with three copper coil rings, a cyan charge rail along
the top and a flared hazard muzzle brake with a glowing bore. It sits
nose-up at rest (F5). On `attack` the barrel recoils and the breech
flashes; on `idle` the turret traverses. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, box, coords, edges, front, hazard, keys, light_top, ngon_y, octo, plan, plate_facets, plated, side, wave
from pnshapes import disc, ngon_radius

S = (46, 42, 54)
CX, CZ = 23, 34   # the turntable centre; the barrel runs out toward -Z
YP, YT = 4, 8     # plinth top, turntable top
YB = 22           # the trunnion axis: the barrel pitches here
ZM = 2            # the muzzle face
ZBR = CZ + 10     # the back of the breech


def mount() -> Grid:
    """The plinth and turntable ring the turret stands on, with two ready racks."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    pl = ngon_y(g, CX, CZ, 16, 0, YP, "iron", 5, n=8)
    hazard(g, pl, period=4, a=("orange", 5), b=("iron", 4))
    light_top(g, pl, "steel", 4)
    rail = ngon_y(g, CX, CZ, 13, YP, YT, "steel", 4, n=8)
    P.flat(g, rail, "steel", 4)
    P.flat(g, rail & (np.floor(X + Z) % 5 == 0), "steel", 6)
    light_top(g, rail, "steel", 6)
    for sx in (-1, 1):
        rack = box(g, CX + sx * 10 - 3, YP, CZ + 8, CX + sx * 10 + 3, YP + 8, CZ + 14, "orange", 5)
        P.flat(g, rack, "orange", 5)
        P.flat(g, edges(rack), "orange", 3)
        P.flat(g, rack & (Y > YP + 6.5), "cyan", 6)
        P.flat(g, rack & (np.floor(X) % 2 == 0) & (Z > CZ + 13), "bone", 6)
    return g


def turret() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    body = plan(g, octo(CX, CZ + 1, 11, 10, 4), YT, YB + 4, "steel", 5, top=octo(CX, CZ + 1, 9, 8, 3))
    plate_facets(g, g.solids[n0:], "steel", 5, size=(9, 7), seed=1)
    P.flat(g, edges(body), "steel", 3)
    band(g, body, 1, YT, YT + 2, "iron", 4)
    P.flat(g, body & (np.abs(Y - 16) < 1.2), "orange", 5)
    light_top(g, body, "steel", 6)
    # the sloped gunner screen on the back (+z), where the crew stands
    con = side(g, [(YB - 3, CZ + 11), (YB - 3, CZ + 7), (YB + 3, CZ + 8), (YB + 3, CZ + 12)], CX - 6, CX + 6, "steel", 4)
    P.flat(g, con, "steel", 4)
    P.flat(g, edges(con), "steel", 2)
    scr = con & (Z > CZ + 10.4)
    P.flat(g, scr, "teal", 4)
    P.flat(g, scr & (np.abs(X - CX) < 4.0), "cyan", 6)
    P.flat(g, scr & (np.abs(X - CX) < 1.3), "cyan", 7)
    # the copper ammo drum on the +x flank, with a gold cap and a feed chute
    n1 = len(g.solids)
    dr = disc(g, "x", YB - 6, CZ + 3, 6, CX + 9, CX + 15, "rust", 5, n=8)
    plate_facets(g, g.solids[n1:], "rust", 5, size=(5, 4), seed=2)
    P.flat(g, dr & (X > CX + 14), "rust", 6)
    P.flat(g, dr & (X > CX + 14) & (ngon_radius(g, "x", YB - 6, CZ + 3, 8) < 2.6), "gold", 6)
    chute = box(g, CX + 7, YB - 5, CZ - 1, CX + 11, YB, CZ + 5, "rust", 4)
    P.flat(g, chute, "rust", 4)
    P.flat(g, edges(chute), "rust", 2)
    # the front shield: a hazard-topped plate with a port for the barrel
    sh = front(g, [(CX - 12, YT + 1), (CX + 12, YT + 1), (CX + 10, YB + 8), (CX - 10, YB + 8)], CZ - 11, CZ - 8, "bone", 6)
    P.flat(g, sh, "bone", 6)
    plated(g, sh, "bone", 6, size=(8, 7), seed=3)
    P.flat(g, edges(sh), "bone", 4)
    hazard(g, sh & (Y > YB + 4.5), period=4, a=("orange", 5), b=("iron", 3), frame="wall")
    port = sh & (np.abs(X - CX) < 7.0) & (np.abs(Y - YB) < 7.0)
    P.flat(g, port, "steel", 3)
    P.flat(g, port & (np.abs(X - CX) < 5.6) & (np.abs(Y - YB) < 5.6), "steel", 2)
    # thick trunnion caps on both flanks (F3)
    for x0, x1 in ((CX - 14, CX - 11), (CX + 11, CX + 14)):
        cap = disc(g, "x", YB, CZ + 1, 5.0, x0, x1, "steel", 4, n=8)
        P.flat(g, cap, "steel", 4)
        P.flat(g, cap & (ngon_radius(g, "x", YB, CZ + 1, 8) < 2.2), "gold", 6)
    return g


def barrel() -> Grid:
    """The oversized barrel: a long faceted white-hull tube with copper
    coils, a cyan charge rail and a flared muzzle brake."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    tube = disc(g, "z", CX, YB, 5, ZM + 5, CZ + 2, "bone", 6, n=8)
    plate_facets(g, g.solids[n0:], "bone", 6, size=(11, 8), seed=4)
    P.flat(g, edges(tube), "bone", 4)
    rad = ngon_radius(g, "z", CX, YB, 8)
    # the breech block, inside the turret shell
    br = box(g, CX - 7, YB - 6, CZ + 1, CX + 7, YB + 6, ZBR, "steel", 5)
    plated(g, br, "steel", 5, size=(6, 5), seed=6)
    P.flat(g, edges(br), "steel", 3)
    P.flat(g, br & (Z > ZBR - 1) & (np.abs(X - CX) < 4) & (np.abs(Y - YB) < 4), "cyan", 6)
    P.flat(g, br & (Z > ZBR - 1) & (np.abs(X - CX) < 1.6) & (np.abs(Y - YB) < 1.6), "cyan", 7)
    P.flat(g, br & (np.abs(Y - (YB + 5.5)) < 0.8), "orange", 5)
    # three copper coil rings along the tube
    for zc in (ZM + 10, ZM + 18, ZM + 26):
        ring = disc(g, "z", CX, YB, 6.5, zc, zc + 3, "rust", 5, n=8)
        P.flat(g, ring, "rust", 5)
        P.flat(g, ring & (rad > 5.4), "rust", 6)
        P.flat(g, ring & (Y > YB + 4), "gold", 6)
    # a cyan charge rail along the top and a dark service line along the side
    P.flat(g, tube & (Y > YB + 3.9) & (np.abs(X - CX) < 2.0) & (Z > ZM + 6), "cyan", 6)
    P.flat(g, tube & (np.abs(Y - YB) < 1.2) & (X > CX + 3.8) & (Z > ZM + 6), "steel", 4)
    # the flared muzzle brake and the glowing bore
    n1 = len(g.solids)
    mb = disc(g, "z", CX, YB, 7.0, ZM, ZM + 5, "steel", 5, n=8)
    plate_facets(g, g.solids[n1:], "steel", 5, size=(5, 4), seed=5)
    P.flat(g, mb & (Z < ZM + 1), "steel", 4)
    hazard(g, mb & (rad > 5.6) & (Z > ZM + 1), period=3, a=("orange", 5), b=("steel", 3), frame="z")
    P.flat(g, mb & (np.abs(Y - YB) < 1.8) & (rad > 5.6) & (Z > ZM + 1), "cyan", 6)   # the brake vents
    bore = (mb | tube) & (rad < 3.6) & (Z < ZM + 1)
    P.flat(g, bore, "cyan", 6)
    P.flat(g, (mb | tube) & (rad < 1.9) & (Z < ZM + 1), "cyan", 7)
    return g


def build():
    rig = Rig()
    rig.add("cannon", mount(), (CX, 0, CZ))
    rig.add("turret", turret(), (CX, YT, CZ + 1), "cannon")
    rig.add("barrel", barrel(), (CX, YB, CZ + 1), "turret", rot=(-7.0, 0.0, 0.0))
    z = (0.0, 0.0, 0.0)
    rest = (-7.0, 0.0, 0.0)
    idle = {"turret": {"rot": wave(7.0, "y", 26.0)},
            "barrel": {"rot": wave(7.0, "x", 4.0, phase=1.1, base=rest)}}
    attack = {"barrel": {"rot": keys((0, rest), (0.12, (-15, 0, 0)), (0.5, (-4, 0, 0)), (1.0, rest)),
                         "loc": keys((0, z), (0.12, (0, 0, 7)), (0.55, (0, 0, -1)), (1.0, z))},
              "turret": {"rot": keys((0, z), (0.12, (-2, 0, 0)), (0.5, (1, 0, 0)), (1.0, z))}}
    muzzle = rig.sock("socket-muzzle", (CX, YB, ZM - 1), parent="barrel")
    return asset("animated-props", "plasma-cannon", "Plasma Cannon", rig.root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False)],
                 sockets=[muzzle],
                 pfx=[{"effectId": "rvx-space-cannon-blast", "socket": "socket-muzzle", "trigger": "clip:attack", "size": 14, "aim": [0.0, 0.0, -1.0], "at": 0.1},
                      {"effectId": "rvx-space-laser-bolt", "socket": "socket-muzzle", "trigger": "clip:attack", "size": 16, "aim": [0.0, 0.0, -1.0], "at": 0.14}])
