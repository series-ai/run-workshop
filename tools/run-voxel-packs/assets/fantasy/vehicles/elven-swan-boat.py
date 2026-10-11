"""Elven swan boat in the Pirate Nation style.

A white hull whose sides flare out (one tapered prism, true slopes) with a
gold gunwale, painted gold feather scallops and a sky-blue waterline. The
oversized function prop is the swan itself: a tall S-curved neck of
faceted segments with a gilded head, an orange beak and a tiny gold
circlet at the bow, and two big feathered wings (saw-tooth true slopes)
rising along the stern. A leaf-green silk canopy on gold posts shades two
blue cushioned benches; a glowing cyan moon lantern hangs from a gold
stern crook (healing sparkles, PFX). It bobs on `idle`; the oars row on
`move`; the wings lean out and back on both. Faces -Z (the swan head).
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _bld import idx, keys, wave
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket, sway

SZ = (84, 80, 112)
CX = 42
DECK = 16
STATIONS = [12, 20, 32, 48, 64, 80, 94, 104]  # z
TOP_W = [1.0, 8.0, 13.0, 15.5, 16.0, 15.0, 12.5, 9.0]  # half width at the gunwale
BOT_W = [0.5, 3.0, 6.0, 8.0, 8.5, 8.0, 6.0, 4.0]  # half width at the keel
ZM = 58  # hull pivot z (the hull rocks about its middle)
OAR_Z = 57
LANTERN = (CX, 42, 106)


def outline(widths):
    left = [(CX - w, z) for w, z in zip(widths, STATIONS)]
    right = [(CX + w, z) for w, z in zip(widths, STATIONS)]
    return left + list(reversed(right))


def hull() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = idx(g)
    g.prism("y", outline(BOT_W), 0, DECK, C("bone", 6), top=outline(TOP_W))
    solid = [g.solids[-1]]
    body = g.solids[-1].mask(g.shape)
    P.mottle(g, body, "bone", 6, cell=4, seed=1)
    P.flat(g, body & (Y < 3), "sky", 4)
    P.flat(g, body & (Y == 3), "sky", 6)
    P.flat(g, body & (Y >= DECK - 3), "gold", 5)
    P.flat(g, body & (Y == DECK - 3), "gold", 3)
    # painted feather scallops along the sides
    sc = body & (Y >= 7) & (Y < 12) & ((((Z % 7) - 3.0) ** 2 / 10.0 + (Y - 12.0) ** 2 / 20.0) < 1.0) & (Z > 20) & (Z < 100)
    P.flat(g, sc, "bone", 7)
    P.flat(g, body & (Y >= 7) & (Y < 12) & (Z % 7 == 0) & (Z > 20) & (Z < 100), "gold", 4)
    # the deck (the prism's top face) in pale planks
    top = body & (Y == DECK - 1)
    inner = top & ~edges(body)
    P.planks(g, inner, "wood", 6, width=3, across="x", length=(20, 30), frame="top", seed=2)
    P.flat(g, top & (np.abs(X + 0.5 - CX) >= np.interp(Z + 0.5, STATIONS, TOP_W) - 2), "gold", 5)
    # the swan's S-curved neck (faceted segments, true slopes) and gilded head
    pts = [(13, 14), (9, 28), (8, 40), (11, 50), (14, 54)]  # (z, y)
    radii = [5.2, 4.4, 4.0, 3.8, 3.6]
    neck = np.zeros(g.shape, dtype=bool)
    for (z0, y0), (z1, y1), r0, r1 in zip(pts, pts[1:], radii, radii[1:]):
        g.prism("x", [(y, z) for z, y in S.quad((z0, y0), (z1, y1), r0, r1)], CX - 4, CX + 4, C("bone", 7))
        neck |= g.solids[-1].mask(g.shape)
    head = [(8, 51), (18, 50), (20, 55), (17, 61), (10, 61), (7, 56)]
    g.prism("x", [(y, z) for z, y in head], CX - 5, CX + 5, C("bone", 7))
    hm = g.solids[-1].mask(g.shape)
    g.prism("x", [(53, 8), (57, 8), (55, 0.5)], CX - 2, CX + 2, C("orange", 5))  # beak
    beak = g.solids[-1].mask(g.shape)
    P.flat(g, beak & (Z < 4), "darkwood", 3)
    P.flat(g, hm & ((X == CX - 5) | (X == CX + 4)) & (Y >= 55) & (Y < 57) & (Z >= 10) & (Z < 13), "darkwood", 2)  # eyes
    P.flat(g, neck & (Y < 20), "gold", 5)  # a gold collar where the neck meets the bow
    box(g, CX - 3, 61, 11, CX + 3, 63, 17, "gold", 5)
    for cz in (11, 15.5):
        g.prism("x", [(63, cz), (63, cz + 1.5), (66, cz + 0.75)], CX - 3, CX + 3, C("gold", 6))
    # two feathered wings rising along the stern (saw-tooth true slopes)
    wing = [(DECK - 2, 50), (DECK - 2, 102), (44, 106), (37, 97), (40, 92), (33, 85), (35, 79), (28, 72), (30, 66), (23, 60), (24, 54)]
    # gold posts, blue benches and the leaf-green silk canopy
    for px in (CX - 11, CX + 9):
        for pz in (40, 70):
            box(g, px, DECK, pz, px + 2, 44, pz + 2, "gold", 4)
    for bz in (46, 62):
        bench = box(g, CX - 10, DECK, bz, CX + 10, DECK + 6, bz + 5, "blue", 4)
        P.mottle(g, bench, "blue", 4, cell=2, seed=bz)
        P.outline(g, bench, "gold", 5, normal="y")
    S.hip_roof(g, CX - 15, 36, CX + 15, 76, 44, 12, "leaf", 4, ridge="z", inset=14, tiles=False, trim=("gold", 5))
    roof = g.solids[-1].mask(g.shape)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.planks(gg, mm, "leaf", 5, width=4, across="x" if fr != "top" else "y", length=(60, 61), nails=False, grain=False, frame=fr))
    P.flat(g, roof & (Y < 45), "gold", 5)
    # the gold stern crook with the glowing moon lantern
    g.prism("x", [(y, z) for z, y in S.quad((101, DECK - 2), (106, 48), 1.4, 1.2)], CX - 1, CX + 1, C("gold", 4))
    lx, ly, lz = LANTERN
    box(g, lx - 1, ly + 3, lz - 1, lx + 1, 49, lz + 1, "gold", 4)
    S.disc(g, "y", lx, lz, 2.4, ly + 2, ly + 4, "gold", 5)
    lamp = S.disc(g, "y", lx, lz, 3.2, ly - 5, ly + 2, "cyan", 6)
    P.flat(g, lamp & (Y == ly - 2), "cyan", 7)
    S.disc(g, "y", lx, lz, 2.0, ly - 7, ly - 5, "gold", 4)
    return g


WING = [(DECK - 2, 50), (DECK - 2, 102), (44, 106), (37, 97), (40, 92), (33, 85), (35, 79), (28, 72), (30, 66), (23, 60), (24, 54)]  # (y, z)


def wing(side: int) -> tuple[Grid, tuple]:
    """A big feathered wing (saw-tooth true slopes), 3 thick, with painted
    feather rows and gold tips; hinged at the gunwale so it can lean out."""
    g = Grid(*SZ)
    x0 = CX + 13 if side > 0 else CX - 16
    g.prism("x", WING, x0, x0 + 3, C("bone", 7))
    wm = g.solids[-1].mask(g.shape)
    X, Y, Z = idx(g)
    P.flat(g, wm & ((Z + Y) % 7 == 0), "bone", 5)
    P.flat(g, wm & ((Z - Y) % 11 == 0) & (Y > 24), "sky", 6)
    P.outline(g, wm, "gold", 5, normal="x")
    return g, (x0 + 1.5, float(DECK - 2), 76.0)


def oar(side: int) -> tuple[Grid, tuple]:
    """A long oar from its gold oarlock down to a leaf-shaped blade in the water."""
    g = Grid(*SZ)
    ox = CX + side * 16
    lock = (ox, DECK + 1, OAR_Z)
    tip = (CX + side * 38, 4)
    g.prism("z", S.quad((ox - side * 4, DECK + 4), tip, 1.1), OAR_Z - 1, OAR_Z + 1, C("wood", 5))
    g.prism("z", S.quad((CX + side * 30, 8.5), (CX + side * 39.5, 3.5), 1.2, 3.0, cap=0.8), OAR_Z - 1, OAR_Z + 1, C("gold", 5))
    box(g, ox - 1, DECK, OAR_Z - 2, ox + 1, DECK + 3, OAR_Z + 2, "gold", 4)
    return g, lock


def build() -> Asset:
    body = hull()
    root = Part("swan-boat", None)
    hp = (float(CX), 0.0, float(ZM))
    h = root.add(Part("hull", body, pivot=hp, at=hp))
    for side, name in ((-1, "wing-l"), (1, "wing-r")):
        wg, hinge = wing(side)
        h.add(Part(name, wg, pivot=hinge, at=(hinge[0] - hp[0], hinge[1] - hp[1], hinge[2] - hp[2]), rot=(0.0, 0.0, -side * 14.0)))
    for side, name in ((-1, "oar-l"), (1, "oar-r")):
        og, lock = oar(side)
        h.add(Part(name, og, pivot=lock, at=(lock[0] - hp[0], lock[1] - hp[1], lock[2] - hp[2])))
    idle = {"hull": {"loc": [(t, (0.0, v[1], 0.0)) for t, v in wave(3.0, "y", 1.2)], "rot": keys((0, 0, 0, 0), (1.5, 2, 0, 1.5), (3.0, 0, 0, 0))}}
    row = lambda s: keys((0, 0, 0, 0), (0.5, 0, s * 25, s * -8), (1.0, 0, s * -18, s * 8), (1.5, 0, 0, 0))  # noqa: E731
    move = {"hull": {"loc": [(t, (0.0, v[1], 0.0)) for t, v in wave(1.5, "y", 0.8)], "rot": keys((0, 0, 0, 0), (0.5, -2, 0, 0), (1.0, 1, 0, 0), (1.5, 0, 0, 0))},
            "oar-l": {"rot": row(-1)}, "oar-r": {"rot": row(1)}}
    # the wings lean out from the rest pose and back (never in, over the benches)
    fan = lambda side, seconds, deg: sway(seconds, amp=(0.0, 0.0, side * deg / 2), phase=(0.0, 0.0, math.pi / 2), base=(0.0, 0.0, -side * deg / 2))  # noqa: E731
    for side, name in ((-1, "wing-l"), (1, "wing-r")):
        idle[name] = {"rot": fan(side, 3.0, 5.0)}
        move[name] = {"rot": fan(side, 1.5, 12.0)}
    return Asset(id="fantasy-vehicles-elven-swan-boat", pack="fantasy", category="vehicles", name="Elven Swan Boat", root=root,
                 clips=[Clip("idle", idle), Clip("move", move)],
                 sockets=[Socket("socket-lantern", at=(LANTERN[0], LANTERN[1] - 2, LANTERN[2]), parent="hull")],
                 pfx=[{"effectId": "rvx-fantasy-lantern-glow", "socket": "socket-lantern", "trigger": "idle", "size": 24}])
