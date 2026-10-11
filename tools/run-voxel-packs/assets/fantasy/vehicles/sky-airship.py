"""Gnomish sky airship in the Pirate Nation style.

The oversized function prop is the balloon: a long octagonal envelope with
tapered nose and tail (true slopes) in red and cream facet stripes, gold
bands, a gold star emblem on both sides and four tail fins. Under it hangs
a small PN-style wooden hull (one flared prism) with a red band, a gold
rail line, a cabin with a red roof and a round window, a helm wheel, four
ropes and a glowing burner whose fire rune rises into the balloon (PFX).
A rear propeller and two propellers on outriggers turn slowly on `idle`
and fast on `move`; the ship floats and sways. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import FRONT, icon_on, idx, keys, round_window, wave
from pnkit import box, edges, gable_roof
from voxgrid import C, Asset, Clip, Grid, Part, Socket, turn

SZ = (96, 134, 150)
CX = 48
BY = 88  # balloon axis height
BR = 25  # balloon flat radius
BZ = (14, 36, 104, 130)  # nose tip, nose end, tail start, tail tip
HULL_Z = [44, 50, 60, 74, 88, 100, 106]
HULL_TOP = [2.0, 10.0, 15.0, 16.0, 15.0, 12.0, 9.0]
HULL_BOT = [1.0, 4.0, 7.0, 8.0, 7.0, 5.0, 3.0]
H0, H1 = 6, 26  # hull bottom and deck
BURNER = (CX, 48, 70)  # the fire cone's top: low enough that the flame burns in the gap under the balloon (y 63)
PROP_R = 12
STERN = (CX, 16, 110)
SIDE_Z = 70
SIDE_X = 36


def lens(widths):
    return [(CX - w, z) for w, z in zip(widths, HULL_Z)] + list(reversed([(CX + w, z) for w, z in zip(widths, HULL_Z)]))


def ship() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = idx(g)
    # --- the balloon: nose frustum, long octagon, tail frustum (true slopes)
    start = len(g.solids)
    ng = lambda r: S.flat_ngon(CX, BY, r, 8, -np.pi / 2)  # noqa: E731
    g.prism("z", ng(10), BZ[0], BZ[1], C("red", 4), top=ng(BR))
    g.prism("z", ng(BR), BZ[1], BZ[2], C("red", 4))
    g.prism("z", ng(BR), BZ[2], BZ[3], C("red", 4), top=ng(9))
    solids = g.solids[start:]
    env = np.logical_or.reduce([s.mask(g.shape) for s in solids])
    ang = np.arctan2(Y + 0.5 - BY, X + 0.5 - CX)
    sector = np.floor((ang + np.pi / 2 + np.pi / 8) / (np.pi / 4)).astype(int) % 8
    lit = (sector >= 3) & (sector <= 5)  # the upper facets catch the light (soft ramp, S3)
    P.flat(g, env & (sector % 2 == 1), "bone", 6)
    P.flat(g, env & (sector % 2 == 1) & lit, "bone", 7)
    P.flat(g, env & (sector % 2 == 0), "red", 4)
    P.flat(g, env & (sector % 2 == 0) & lit, "red", 5)
    P.flat(g, env & (sector % 2 == 1) & (Z % 11 == 0), "bone", 4)  # fabric panel seams
    P.flat(g, env & (sector % 2 == 0) & (Z % 11 == 0), "red", 3)
    for pz, py, pr in ((50, BY + 14, 3), (92, BY - 6, 3)):  # two stitched patches
        patch = env & (np.abs(Z + 0.5 - pz) < pr + 1) & (np.abs(Y + 0.5 - py) < pr)
        P.flat(g, patch, "sand", 5)
        P.flat(g, patch & ((Z + Y) % 2 == 0) & ((np.abs(Z + 0.5 - pz) > pr) | (np.abs(Y + 0.5 - py) > pr - 1)), "darkwood", 3)
    P.flat(g, env & S.seams(g, solids, 0.9), "gold", 4)
    for z0 in (BZ[1] - 1, 70, BZ[2]):
        P.flat(g, env & (Z >= z0) & (Z < z0 + 2), "gold", 5)
    P.flat(g, env & ((Z == BZ[0]) | (Z == BZ[3] - 1)), "gold", 5)
    # a gold star emblem on both sides of the balloon
    occ = g.a > 0
    for side in (-1, 1):
        opened = np.zeros(g.shape, dtype=bool)
        if side < 0:
            opened[1:] = ~occ[:-1]
        else:
            opened[:-1] = ~occ[1:]
        face = env & opened & (np.abs(X + 0.5 - (CX + side * BR)) < 1.5)
        disc = face & (np.hypot(Z + 0.5 - 70, Y + 0.5 - BY) < 11)
        P.flat(g, disc, "blue", 4)
        P.flat(g, disc & (np.hypot(Z + 0.5 - 70, Y + 0.5 - BY) > 9.6), "gold", 5)
        icon_on(g, disc, Z, Y, 70 - 9, BY - 8, "star", "gold", 6, scale=2, flip=(side > 0))
    # four tail fins (true slopes)
    fin = [(BY + BR - 4, 104), (BY + BR - 4, 130), (BY + 44, 132)]
    g.prism("x", [(y, z) for y, z in fin], CX - 1.5, CX + 1.5, C("red", 4))
    g.prism("x", [(BY - BR + 4, 104), (BY - BR + 4, 130), (BY - 40, 132)], CX - 1.5, CX + 1.5, C("red", 4))
    for s in (-1, 1):
        g.prism("y", [(CX + s * (BR - 4), 104), (CX + s * (BR - 4), 130), (CX + s * 44, 132)], BY - 1.5, BY + 1.5, C("red", 4))
    for sd in g.solids[-4:]:
        fm = sd.mask(g.shape)
        P.flat(g, fm, "bone", 6)
        P.outline(g, fm, "red", 4)
    # --- the hull: one flared prism, planks, a red band and a gold rail line
    g.prism("y", lens(HULL_BOT), H0, H1, C("wood", 5), top=lens(HULL_TOP))
    hs = [g.solids[-1]]
    hull = g.solids[-1].mask(g.shape)
    for m, fr in S.facets(g, hs):
        P.planks(g, m, "wood", 5, width=3, across="y", length=(24, 40), frame=fr, seed=1)
    P.flat(g, hull & (Y >= H1 - 7) & (Y < H1 - 4), "red", 4)
    P.flat(g, hull & (Y >= H1 - 2), "gold", 5)
    P.flat(g, hull & (Y < H0 + 2), "darkwood", 4)
    deck = hull & (Y == H1 - 1) & ~edges(hull)
    P.planks(g, deck, "wood", 6, width=3, across="x", length=(20, 30), frame="top", seed=2)
    g.prism("x", [(0, 60), (H0 + 1, 56), (H0 + 1, 94), (0, 90)], CX - 1, CX + 1, C("darkwood", 3))  # keel fin
    # the cabin at the stern with a red roof, a door and a round window
    cab = box(g, CX - 10, H1, 84, CX + 10, H1 + 14, 100, "sand", 6)
    P.mottle(g, cab, "sand", 6, seed=3)
    P.flat(g, edges(cab), "darkwood", 3)
    gable_roof(g, CX - 10, CX + 10, 84, 100, H1 + 14, H1 + 26, ramp="red", thick=3, overhang=3, ridge="z", seed=4)
    round_window(g, "-z", 84, CX + 4, H1 + 8, 3, glass=("gold", 6), frame=("gold", 4))
    door = box(g, CX - 8, H1, 83, CX - 2, H1 + 11, 84, "darkwood", 4)
    P.planks(g, door, "darkwood", 4, width=2, across="x", nails=False)
    # the helm wheel in front of the cabin
    hw = S.disc(g, "z", CX, H1 + 10, 4.5, 78, 79, "wood", 5)
    P.flat(g, hw & (S.radial(g, "z", CX, H1 + 10) < 1.5), "gold", 5)
    box(g, CX - 1, H1, 78, CX + 1, H1 + 7, 80, "darkwood", 3)
    # the burner: a gold post, a flared bowl and a fire cone
    bx, by, bz = BURNER
    box(g, bx - 1, H1, bz - 1, bx + 1, by - 10, bz + 1, "gold", 4)
    g.prism("y", S.flat_ngon(bx, bz, 2.5, 8, FRONT), by - 10, by - 6, C("gold", 4), top=S.flat_ngon(bx, bz, 5, 8, FRONT))
    g.prism("y", S.flat_ngon(bx, bz, 4, 6, FRONT), by - 6, by, C("orange", 5), top=[(bx, bz)] * 6)
    fire = g.solids[-1].mask(g.shape)
    P.flat(g, fire & (Y >= by - 3), "gold", 7)
    P.flat(g, fire & (Y < by - 5), "red", 4)
    # four ropes from the hull to the balloon (thin true diagonals)
    for sx in (-1, 1):
        for rz in (52, 98):
            g.prism("z", S.quad((CX + sx * 12, H1), (CX + sx * 17, BY - BR + 3), 0.8), rz - 1, rz + 1, C("sand", 4))
    # outriggers for the side propellers
    for sx in (-1, 1):
        g.prism("z", S.quad((CX + sx * 14, H1 - 6), (CX + sx * (SIDE_X - 3), 20), 1.6), SIDE_Z - 2, SIDE_Z + 2, C("darkwood", 3))
        S.disc(g, "z", CX + sx * SIDE_X, 20, 3, SIDE_Z - 1, SIDE_Z + 3, "gold", 4)
    # the stern shaft
    box(g, CX - 1, STERN[1] - 1, 104, CX + 1, STERN[1] + 1, STERN[2] - 1, "darkwood", 3)
    return g


def propeller(cx, cy, z0, r, blades: int = 3) -> Grid:
    """A propeller on an axle along z: pale wood blades with red tips and a gold hub."""
    g = Grid(*SZ)
    for k in range(blades):
        a = np.pi / 2 + 2 * np.pi * k / blades
        tip = (cx + r * np.cos(a), cy + r * np.sin(a))
        g.prism("z", S.quad((cx + 2 * np.cos(a), cy + 2 * np.sin(a)), tip, 1.4, 2.6, cap=0.6), z0, z0 + 2, C("wood", 6))
        bm = g.solids[-1].mask(g.shape)
        X, Y, Z = idx(g)
        P.flat(g, bm & (np.hypot(X + 0.5 - cx, Y + 0.5 - cy) > r - 3), "red", 4)
    S.disc(g, "z", cx, cy, 2.4, z0 - 1, z0 + 3, "gold", 5)
    return g


def build() -> Asset:
    sg = ship()
    root = Part("airship", None)
    sp = (float(CX), 0.0, 72.0)
    s = root.add(Part("ship", sg, pivot=sp, at=sp))
    rel = lambda p: (p[0] - sp[0], p[1] - sp[1], p[2] - sp[2])  # noqa: E731
    stern = (float(STERN[0]), float(STERN[1]), float(STERN[2]) + 1)
    s.add(Part("propeller", propeller(STERN[0], STERN[1], STERN[2], PROP_R), pivot=stern, at=rel(stern)))
    for sx, name in ((-1, "propeller-l"), (1, "propeller-r")):
        hub = (float(CX + sx * SIDE_X), 20.0, float(SIDE_Z - 2))
        s.add(Part(name, propeller(CX + sx * SIDE_X, 20, SIDE_Z - 3, 9), pivot=hub, at=rel(hub)))
    idle = {"ship": {"loc": [(t, (0.0, v[1], 0.0)) for t, v in wave(4.0, "y", 1.5)], "rot": keys((0, 0, 0, 0), (2.0, 0, 0, 2), (4.0, 0, 0, 0))},
            "propeller": {"rot": turn(4.0, "z", 90)}, "propeller-l": {"rot": turn(4.0, "z", -90)}, "propeller-r": {"rot": turn(4.0, "z", 90)}}
    move = {"ship": {"rot": keys((0, 0, 0, 0), (1.0, -3, 0, 0), (2.0, 0, 0, 0))}, "propeller": {"rot": turn(2.0, "z", 720)},
            "propeller-l": {"rot": turn(2.0, "z", -720)}, "propeller-r": {"rot": turn(2.0, "z", 720)}}
    return Asset(id="fantasy-vehicles-sky-airship", pack="fantasy", category="vehicles", name="Sky Airship", root=root,
                 clips=[Clip("idle", idle), Clip("move", move)],
                 sockets=[Socket("socket-burner", at=BURNER, parent="ship")],
                 pfx=[{"effectId": "rvx-fantasy-torch-flame", "socket": "socket-burner", "trigger": "idle", "size": 14}])
