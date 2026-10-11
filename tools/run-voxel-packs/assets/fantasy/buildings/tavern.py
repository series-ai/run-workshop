"""The Prancing Griffin tavern, in the Pirate Nation style.

Chunky volumes: a stone plinth, a plaster storey framed by thick dark posts,
a jettied upper storey, a steep tiled gable roof (true slopes) and a leaning
stone chimney. Its function prop is oversized: a giant foaming mug sign that
swings on `idle`. Detail (stone courses, planks, tiles, plaster) is painted.
"""
import numpy as np

import paint as P
from pnkit import awning, barrel, beam, box, crate, door, gable_roof, pennant, posts, shutters, window
from voxgrid import C, Asset, Clip, Grid, Part, Socket, bounds_pivot

W, H, D = 100, 132, 100
X0, X1, Z0, Z1 = 20, 80, 22, 80  # ground-floor walls; the front is z = Z0
J = 3  # jetty: the upper storey overhangs by this much
GROUND, UPPER, WALL_TOP, RIDGE = 42, 46, 72, 110


def tavern() -> Grid:
    g = Grid(W, H, D)
    plinth = box(g, X0 - 2, 0, Z0 - 2, X1 + 2, 4, Z1 + 2, "stone", 4)
    P.stone(g, plinth, "stone", 4, block=(8, 4), seed=1)
    walls = box(g, X0, 4, Z0, X1, GROUND, Z1, "sand", 5)
    low = walls & P.region(g, 0, 0, 0, W, 16, D)
    P.stone(g, low, "stone", 5, block=(7, 5), seed=2)
    P.mottle(g, walls & ~low, "sand", 5, seed=3)
    P.grime(g, low, height=3, seed=4)
    posts(g, X0, X1, Z0, Z1, 4, GROUND, size=4, base=4, seed=5)
    beam(g, X0 - 3, GROUND, Z0 - 3, X1 + 3, UPPER, Z1 + 3, base=4, seed=6)
    # jettied upper storey with painted half-timber
    ux0, ux1, uz0, uz1 = X0 - J, X1 + J, Z0 - J, Z1 + J
    upper = box(g, ux0, UPPER, uz0, ux1, WALL_TOP, uz1, "sand", 6)
    P.mottle(g, upper, "sand", 6, seed=7)
    X, Y, Z = np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    studs = upper & (((X - ux0) % 22 < 3) | ((Z - uz0) % 22 < 3))
    P.flat(g, studs, "darkwood", 4)
    posts(g, ux0, ux1, uz0, uz1, UPPER, WALL_TOP, size=4, out=1, base=4, seed=8)
    # steep roof with the gable to the front (rules F4, K1)
    roof = gable_roof(g, ux0, ux1, uz0, uz1, WALL_TOP, RIDGE, ramp="red", thick=5, overhang=6, ridge="z", seed=9)
    gable = roof["attic"]
    P.flat(g, gable & (np.abs(X - (ux0 + ux1) / 2) < 1.6), "darkwood", 4)  # king post
    P.flat(g, gable & (Y >= WALL_TOP) & (Y < WALL_TOP + 3), "darkwood", 4)  # tie beam
    window(g, "-z", uz0, 44, 56, 82, 94, glow=6)
    # ground floor front: a wide, short arched door between big windows with awnings
    door(g, "-z", Z0, 42, 58, 4, 34, seed=10)
    box(g, 38, 0, Z0 - 8, 62, 4, Z0 - 2, "stone", 5)  # doorstep
    for u0 in (25, 63):
        window(g, "-z", Z0, u0, u0 + 12, 16, 32)
        awning(g, "-z", Z0 - 1, u0 - 3, u0 + 15, 38, depth=9, drop=6)
    for u0 in (ux0 + 7, ux1 - 21):
        window(g, "-z", uz0, u0, u0 + 14, 52, 66, glow=5)
        shutters(g, "-z", uz0, u0, u0 + 14, 52, 66)
    for w0 in (Z0 + 10, Z1 - 24):
        window(g, "-x", X0, w0, w0 + 14, 16, 32)
        window(g, "+x", X1, w0, w0 + 14, 16, 32)
        shutters(g, "-x", ux0, w0, w0 + 14, 52, 66, ramp="blue")
        window(g, "-x", ux0, w0, w0 + 14, 52, 66, glow=5)
    # props at the base: a giant barrel, a crate stack, a pennant on the ridge
    barrel(g, 11, Z0 + 2, 0, 30, 9)
    crate(g, X1 + 3, 0, Z0 - 10, 12, seed=11)
    crate(g, X1 + 3, 12, Z0 - 8, 9, seed=13)
    crate(g, X1 + 6, 0, Z0 + 4, 10, seed=12)
    pennant(g, (ux0 + ux1) // 2 - 1, RIDGE + 4, uz0 - 8, 16, 14, "red")
    # beam that carries the mug sign, out from the gable
    box(g, 49, 76, 2, 51, 79, uz0, "darkwood", 3)
    return g


def chimney() -> Grid:
    g = Grid(14, 52, 14)
    m = box(g, 1, 0, 1, 13, 46, 13, "stone", 4)
    P.stone(g, m, "stone", 4, block=(5, 3), seed=20)
    cap = box(g, 0, 46, 0, 14, 52, 14, "stone", 2)
    P.stone(g, cap, "stone", 2, block=(7, 3), seed=21)
    g.box(4, 49, 4, 10, 52, 10, 0)  # flue opening
    return g


def tankard() -> Grid:
    """A giant foaming tankard hanging from the gable: the tavern's function
    prop, oversized so it reads in a thumbnail (rules F4, F6)."""
    g = Grid(28, 30, 20)
    barrel(g, 11, 10, 2, 17, 8, ramp="wood", hoop="gold")
    for x0, z0, h in ((4, 4, 3), (8, 3, 4), (13, 5, 3), (6, 11, 4), (11, 10, 5), (15, 12, 3), (9, 15, 3)):
        foam = box(g, x0, 19, z0, x0 + 6, 19 + h, z0 + 5, "bone", 6)
        P.mottle(g, foam, "bone", 6, cell=2)
    handle = box(g, 19, 5, 8, 25, 17, 12, "gold", 4)
    g.box(20, 8, 8, 24, 14, 12, 0)
    handle &= g.a > 0
    P.outline(g, handle, "gold", 3, normal="z")
    box(g, 10, 24, 9, 12, 30, 11, "iron", 2)  # chain to the beam
    return g


def build() -> Asset:
    g = tavern()
    pivot = bounds_pivot(g)
    cx, cy, cz = X1 - 6, WALL_TOP + 4, Z1 - 16  # chimney foot on the right roof slope
    root = Part("tavern", g, pivot=pivot)
    root.add(Part("chimney", chimney(), pivot=(7.0, 0.0, 7.0), at=(cx - pivot[0], cy, cz - pivot[2]), rot=(0.0, 0.0, -6.0)))
    sign = root.add(Part("sign", tankard(), pivot=(11.0, 30.0, 10.0), at=(50 - pivot[0], 76, 8 - pivot[2])))
    swing = {sign.name: {"rot": [(t, (8 * float(np.sin(t / 3.0 * 2 * np.pi)), 0.0, 0.0)) for t in (0, 0.75, 1.5, 2.25, 3.0)]}}
    return Asset(
        id="fantasy-buildings-tavern", pack="fantasy", category="buildings", name="Tavern", root=root,
        clips=[Clip("idle", swing)],
        sockets=[Socket("socket-chimney", at=(cx - pivot[0], cy + 52, cz - pivot[2]), parent="chimney")],
        pfx=[{"effectId": "rvx-fantasy-chimney-smoke", "socket": "socket-chimney", "trigger": "idle", "size": 32}],
    )
