"""Art-director repair models (group: vehicles).

This module rebuilds three new monster vehicles: the wolf sled, the bat
glider and the skeleton rowboat. Each model faces -Z. Each builder paints
its parts in one shared frame and joins them with `assemble`.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _kit import C, Clip, Grid, Socket, keys, pfx, world
from _life import front, plan, side
from _pn import SKULL_GLYPH, assemble, coords, last, quad, stamp
from pnkit import box


def _find(root, name):
    """Return the part with this name. Raise an error if it is missing."""
    for p in root.walk():
        if p.name == name:
            return p
    raise KeyError(f"no part named {name!r}")


# ---------------------------------------------------------------- wolf sled
WS_G = (64, 70, 110)
WS_CX = 32.0
WOLF_Z0 = 7.0  # the skull front of each wolf; the nose tip is 6 voxels ahead
WOLF_X = {"wolf-left": WS_CX - 9, "wolf-right": WS_CX + 9}
BOW_Z = 51.0  # front face of the sled brushbow; the traces end here


def _wolf_body(wx: float, seed: int) -> Grid:
    """One wolf without its legs: a deep chest, a high shoulder, a long
    muzzle with an open jaw, tall pointed ears, a streaming tail, a purple
    harness and two traces back to the sled."""
    g = Grid(*WS_G)
    X, Y, Z = coords(g)
    z0 = WOLF_Z0
    dx = np.abs(X + 0.5 - wx)
    torso = side(g, [(16, z0 + 9), (21, z0 + 11), (22.5, z0 + 14), (21, z0 + 22), (21, z0 + 28), (19.5, z0 + 31),
                     (16, z0 + 33), (12, z0 + 31), (11, z0 + 25), (10, z0 + 18), (10.5, z0 + 12)], wx - 4.5, wx + 4.5, "gray", 4)
    neck = side(g, [(15, z0 + 10), (19, z0 + 6), (25, z0 + 6), (23.5, z0 + 12), (19, z0 + 13)], wx - 3.5, wx + 3.5, "gray", 4)
    skull = side(g, [(20, z0 + 1), (27, z0 + 1), (28.5, z0 + 3), (28.5, z0 + 7), (26.5, z0 + 9), (20, z0 + 9)], wx - 4.5, wx + 4.5, "gray", 4)
    ruff = front(g, [(wx - 5.5, 18), (wx - 3, 16), (wx, 17.5), (wx + 3, 16), (wx + 5.5, 18), (wx + 6, 23), (wx + 4.5, 26.5),
                     (wx - 4.5, 26.5), (wx - 6, 23)], z0 + 6, z0 + 10, "bone", 5)
    muzzle = side(g, [(21, z0 + 2), (21, z0 - 5), (23.5, z0 - 5.5), (25.5, z0 - 1), (26, z0 + 2)], wx - 2.5, wx + 2.5, "gray", 4)
    jaw = side(g, [(19, z0 + 2), (21, z0 + 2), (21, z0 - 4), (19.8, z0 - 4)], wx - 2, wx + 2, "bone", 5)
    ears = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        ears |= front(g, [(wx + s * 0.8, 27.5), (wx + s * 4.4, 27.5), (wx + s * 3.6, 34)], z0 + 5, z0 + 7.5, "gray", 3)
    tail = side(g, quad((19.5, z0 + 30), (17, z0 + 38.5), 2.0, 2.7, cap=0.7), wx - 2, wx + 2, "gray", 3)
    # Fur: a soft grey hide, a darker saddle on the back, a pale belly and chest.
    PP.fur(g, torso | neck | skull | muzzle, "gray", 4, seed=seed)
    PP.fur(g, (torso | neck) & (Y >= 19), "gray", 3, seed=seed + 1)
    PP.fur(g, torso & (Y >= 21) & (dx < 2.6), "gray", 2, seed=seed + 2)
    PP.fur(g, torso & ((Y < 13.5) | ((Z < z0 + 13) & (Y < 18))), "bone", 5, seed=seed + 3)
    PP.fur(g, neck & (Y < 19) & (Z < z0 + 11), "bone", 5, seed=seed + 4)
    PP.fur(g, ruff, "bone", 5, seed=seed + 5)
    PP.fur(g, skull & (Y >= 26), "gray", 3, seed=seed + 6)
    PP.fur(g, tail, "gray", 3, seed=seed + 7)
    P.flat(g, tail & (Z >= z0 + 37), "gray", 2)  # a dark tail tip
    P.flat(g, ears & (Y >= 32), "gray", 2)  # dark ear tips
    P.flat(g, ears & (Z < z0 + 6) & (Y < 31) & (np.abs(dx - 2.6) < 0.9), "pink", 3)  # inner ear
    # The face: pale cheeks and jaw, a dark nose, glowing eyes, a red mouth and fangs.
    P.flat(g, muzzle & (Y < 22.5), "bone", 5)
    P.flat(g, muzzle & (Y >= 21) & (Y < 22) & (dx > 1.5), "red", 3)  # the mouth line
    P.flat(g, muzzle & (Z < z0 - 4.5) & (Y >= 23.5) & (dx < 1.8), "gray", 1)  # nose tip
    P.flat(g, muzzle & (Y >= 25) & (dx < 1.2), "gray", 3)  # muzzle ridge
    face = skull & (Z < z0 + 2)
    P.flat(g, face & (Y >= 23) & (Y < 27) & (dx > 2.4), "gray", 2)  # dark eye mask
    P.flat(g, face & (Y >= 24) & (Y < 26) & (dx > 2.5), "toxic", 6)
    P.flat(g, face & (Y == 24) & (dx > 3.5), "toxic", 7)
    P.flat(g, jaw & (Y >= 20), "red", 4)
    box(g, wx - 1, 17.5, z0 - 3, wx + 1, 19.2, z0 - 0.5, "red", 5)  # a lolling tongue
    for s in (-1, 1):
        box(g, wx + s * 1.6 - 0.5, 19.6, z0 - 4.6, wx + s * 1.6 + 0.5, 21.2, z0 - 3.6, "bone", 7)  # fangs
    # The harness: a padded band around the chest, a gold ring on each side
    # and a strap trace from each ring back to the sled brushbow.
    band = box(g, wx - 5, 9.5, z0 + 14, wx + 5, 23.2, z0 + 16.5, "purple", 3)
    P.outline(g, band, "purple", 1, normal="z")
    P.flat(g, band & (Y >= 22) & (dx < 1.5), "gold", 5)
    for s in (-1, 1):
        box(g, wx + s * 5 - 0.6, 13.5, z0 + 14.2, wx + s * 5 + 0.6, 16, z0 + 16.3, "gold", 5)
        lo, hi = (wx + 5, wx + 6) if s > 0 else (wx - 6, wx - 5)
        trace = S.bar(g, "x", (14.8, z0 + 16), (13.5, BOW_Z + 0.5), 1.3, lo, hi, "darkwood", 3)
        P.flat(g, trace & ((Z.astype(int) % 6) == 0), "darkwood", 2)
    return g


def _wolf_leg(wx: float, s: int, hind: bool) -> tuple[Grid, tuple[float, float, float]]:
    """One wolf leg with its paw on y = 0. Return the grid and the hip or
    shoulder pivot. The paw sits under the pivot, so a swing lifts it."""
    g = Grid(*WS_G)
    X, Y, Z = coords(g)
    z0 = WOLF_Z0
    x = wx + s * 2.6
    lo, hi = x - 1.4, x + 1.4
    if hind:
        pz = z0 + 28.5
        leg = side(g, quad((15.5, z0 + 27), (8, z0 + 30), 2.6, 1.6, cap=0.3), lo, hi, "gray", 4)
        leg |= side(g, quad((8, z0 + 30), (2, z0 + 28.6), 1.5, 1.3), lo, hi, "gray", 4)
        paw = box(g, x - 1.5, 0, z0 + 26.2, x + 1.5, 2.2, z0 + 30.2, "gray", 3)
        pivot = (x, 15.0, pz)
    else:
        pz = z0 + 12.5
        leg = side(g, quad((12.5, z0 + 13), (2, z0 + 12.6), 1.7, 1.4), lo, hi, "gray", 4)
        paw = box(g, x - 1.5, 0, z0 + 10.6, x + 1.5, 2.2, z0 + 14.4, "gray", 3)
        pivot = (x, 12.0, pz)
    PP.fur(g, leg, "gray", 4, seed=int(x * 3) + hind)
    P.flat(g, leg & (Y >= 10) & (Z > pz), "gray", 3)
    P.flat(g, leg & (Y < 6), "bone", 5)  # pale socks
    P.flat(g, paw & (Z < paw.nonzero()[2].min() + 1.0) & (Y < 1.2), "bone", 7)  # claw tips
    P.flat(g, paw & (Y >= 1.5), "gray", 4)
    return g, pivot


def _sled() -> Grid:
    g = Grid(*WS_G)
    X, Y, Z = coords(g)
    cx = WS_CX
    # Two runners: a flat iron-shod blade on y = 0 and a hooked front curl.
    for x0 in (13.0, 48.0):
        run = box(g, x0, 0, 62, x0 + 3, 3, 103, "wood", 5)
        run |= S.bar(g, "x", (1.5, 102), (5.5, 106), 3, x0, x0 + 3, "wood", 5)
        run |= S.bar(g, "x", (1.5, 63.5), (9.5, 54.5), 3, x0, x0 + 3, "wood", 5)
        run |= S.bar(g, "x", (9.5, 54.5), (15, 52), 2.6, x0, x0 + 3, "wood", 5)
        P.planks(g, run, "wood", 5, width=3, across="y", nails=False, seed=int(x0))
        P.flat(g, run & (Y < 1), "iron", 3)
        for z in (66, 82, 97):
            st = box(g, x0, 3, z, x0 + 3, 12, z + 3, "darkwood", 3)
            P.flat(g, st & (Y.astype(int) % 4 == 0), "darkwood", 2)
    # The brushbow joins the curl tips. The traces of the wolves end on it.
    bow = box(g, 13, 11, BOW_Z, 51, 16, BOW_Z + 3, "darkwood", 4)
    P.planks(g, bow, "darkwood", 4, width=2, across="y", nails=True, seed=3)
    for x in (cx - 15, cx - 3, cx + 3, cx + 15):
        box(g, x - 1, 12, BOW_Z - 0.6, x + 1, 15, BOW_Z, "gold", 5)  # trace rings
    # The bed: deck boards, side rails with bone posts, a purple front fender.
    deck = box(g, 13, 12, BOW_Z + 3, 51, 15, 102, "wood", 6)
    P.planks(g, deck, "wood", 6, width=4, across="z", nails=True, seed=4)
    P.outline(g, deck, "darkwood", 3, normal="y")
    for x0 in (13.0, 48.5):
        rail = box(g, x0, 15, 61, x0 + 2.5, 23, 100, "darkwood", 4)
        P.planks(g, rail, "darkwood", 4, width=3, across="y", nails=True, seed=int(x0) + 5)
        for z in (61, 80, 97):
            box(g, x0 - 0.5, 15, z, x0 + 3, 26, z + 3, "bone", 6)
            if z == 61:
                S.skull(g, x0 + 1.25, 26, z + 1.5, s=5, eyes=("toxic", 6), seed=z)
            else:
                box(g, x0 - 0.2, 26, z + 0.3, x0 + 2.7, 27.5, z + 2.7, "bone", 7)
    fender = box(g, 13, 15, 58, 51, 27, 61, "purple", 3)
    P.mottle(g, fender, "purple", 3, cell=3, seed=6)
    P.outline(g, fender, "gold", 4, normal="z")
    stamp(g, "-z", 58, int(cx - 4.5), 17, SKULL_GLYPH, {"#": C("bone", 6), "o": C("purple", 1)})
    # A cargo chest with iron straps and a grey wolf pelt over the lid.
    chest = box(g, 19, 15, 64, 45, 24, 80, "wood", 4)
    P.planks(g, chest, "wood", 4, width=3, across="y", nails=True, seed=7)
    P.flat(g, chest & ((np.abs(X + 0.5 - 24) < 1) | (np.abs(X + 0.5 - 40) < 1)), "iron", 3)
    pelt = box(g, 18, 24, 66, 46, 25.5, 78, "gray", 4)
    pelt |= box(g, 18, 19, 66, 19.5, 24, 78, "gray", 4) | box(g, 44.5, 19, 66, 46, 24, 78, "gray", 4)
    PP.fur(g, pelt, "gray", 4, seed=8)
    P.flat(g, pelt & (Y < 20), "gray", 3)
    # The rider bench, a cushion and a tall raked backrest with a skull crest.
    bench = box(g, 16, 15, 84, 48, 22, 98, "wood", 5)
    P.planks(g, bench, "wood", 5, width=3, across="y", nails=True, seed=9)
    cush = box(g, 17, 22, 85, 47, 24.5, 98, "purple", 4)
    P.outline(g, cush, "purple", 2, normal="y")
    back = side(g, [(15, 98), (15, 101.5), (44, 104.5), (44, 101)], 16, 48, "wood", 5)
    P.planks(g, back, "wood", 5, width=4, across="x", nails=True, seed=10)
    panel = back & (np.abs(X + 0.5 - cx) < 11) & (Y > 26) & (Y < 41) & (Z < 103)
    P.flat(g, panel, "purple", 3)
    P.outline(g, panel, "gold", 4, normal="z")
    for s in (-1, 1):
        front(g, [(cx + s * 13, 43), (cx + s * 16, 43), (cx + s * 17, 50)], 101, 104, "bone", 6)  # horns
    S.skull(g, cx, 43, 102.5, s=8, eyes=("toxic", 6), seed=11)
    # The lantern pole at the front right corner, with a hooked arm and a
    # hanging lantern that lights the trail (the function prop).
    pole = box(g, 48.5, 15, 57.5, 51.5, 66, 60.5, "darkwood", 3)
    P.flat(g, pole & (Y.astype(int) % 6 == 0), "iron", 3)
    arm = S.bar(g, "x", (65, 59), (61.5, 50), 3, 48.5, 51.5, "darkwood", 3)
    P.flat(g, arm & (Z < 52), "iron", 3)
    lamp = S.lantern(g, 50, 36, 50, s=8, body=10, glass="toxic", roof="purple", frame="darkwood", seed=12)
    WS_LAMP[:] = list(lamp["glow"])
    return g


WS_LAMP: list[float] = [0.0, 0.0, 0.0]


def _wolf_sled():
    slug = "wolf-sled"
    grids = {"sled": _sled()}
    root_j = (WS_CX, 0.0, WS_G[2] / 2)
    joints = [("sled", None, root_j)]
    legs = {}
    for k, (name, wx) in enumerate(WOLF_X.items()):
        grids[name] = _wolf_body(wx, seed=20 + k * 10)
        joints.append((name, "sled", (wx, 12.0, WOLF_Z0 + 20)))
        for s, sl in ((-1, "l"), (1, "r")):
            for hind, end in ((False, "f"), (True, "b")):
                leg = f"{name}-leg-{end}{sl}"
                grids[leg], pivot = _wolf_leg(wx, s, hind)
                joints.append((leg, name, pivot))
                legs[leg] = (hind, s, k)
    root = assemble(grids, joints)

    # A gallop: the front and hind pairs swing in opposite phase and the
    # body rises while the legs swing. The paws stay on or above y = 0.
    t = (0.0, 0.175, 0.35, 0.525, 0.7, 0.875, 1.05, 1.225, 1.4)
    move = {}
    for leg, (hind, s, k) in legs.items():
        a = 26.0 if (hind == (k == 1)) else -26.0
        a += 2.0 * s  # a small offset between left and right paws
        seq = (0, a, 0, -a, 0, a, 0, -a, 0)
        move[leg] = {"rot": [(tt, (v, 0.0, 0.0)) for tt, v in zip(t, seq)]}
    for k, name in enumerate(WOLF_X):
        lift = (0, 2.0, 0, 2.0, 0, 2.0, 0, 2.0, 0)
        move[name] = {"loc": [(tt, (0.0, v, 0.0)) for tt, v in zip(t, lift)]}
    move["sled"] = {"loc": keys((0, (0, 0, 0)), (0.7, (0, 0.6, 0)), (1.4, (0, 0, 0)))}
    idle = {"sled": {"loc": keys((0, (0, 0, 0)), (1.3, (0, 0.4, 0)), (2.6, (0, 0, 0)))},
            "wolf-left": {"loc": keys((0, (0, 0, 0)), (0.65, (0, 0.5, 0)), (1.3, (0, 0, 0)), (1.95, (0, 0.5, 0)), (2.6, (0, 0, 0)))},
            "wolf-right": {"loc": keys((0, (0, 0.5, 0)), (0.65, (0, 0, 0)), (1.3, (0, 0.5, 0)), (1.95, (0, 0, 0)), (2.6, (0, 0.5, 0)))}}
    harness = (WS_CX - root_j[0], 16.0 - root_j[1], WOLF_Z0 + 16 - root_j[2])
    return world(slug, "vehicles", "Wolf Sled", root,
                 clips=[Clip("move", move), Clip("idle", idle)],
                 sockets=[Socket("socket-harness", at=harness, parent="sled")],
                 pfx=[pfx("rvx-monster-ghost-wisps", "socket-harness", "clip:move", size=22, at=0.55)])


# ---------------------------------------------------------------- bat glider
BG_G = (98, 66, 78)
BG_CX, BG_CZ = 49.0, 40.0
BG_SHOULDER = 41.0
BG_DIHEDRAL = 20.0


def _bat_gondola() -> Grid:
    """The body part: bone skids, an open planked gondola, a rider bench, a
    steering mast, and the bat (furred body and head) that holds the gondola
    with its hind feet."""
    g = Grid(*BG_G)
    X, Y, Z = coords(g)
    cx, cz = BG_CX, BG_CZ
    # Bone skids on y = 0 with curled fronts and dark struts up to the hull.
    for x0 in (cx - 10.5, cx + 7.5):
        sk = box(g, x0, 0, cz - 20, x0 + 3, 2.5, cz + 22, "bone", 5)
        sk |= S.bar(g, "x", (1.2, cz - 19.5), (7.5, cz - 26), 2.5, x0, x0 + 3, "bone", 5)
        P.flat(g, sk & ((Z.astype(int) % 9) == 0), "bone", 4)
        P.flat(g, sk & (Y < 1), "bone", 3)
        for z in (cz - 13, cz + 12):
            box(g, x0 + 0.5, 2.5, z, x0 + 2.5, 7, z + 3, "darkwood", 3)
        box(g, x0 - 0.5, 1.5, cz - 26.5, x0 + 3.5, 4, cz - 23.5, "bone", 7)  # knuckle tips
    # The open gondola: a pointed bow, a planked floor and raised walls.
    hull = [(cx, cz - 25), (cx + 8, cz - 19), (cx + 11.5, cz - 7), (cx + 11.5, cz + 16), (cx + 8, cz + 22),
            (cx - 8, cz + 22), (cx - 11.5, cz + 16), (cx - 11.5, cz - 7), (cx - 8, cz - 19)]
    floor = plan(g, hull, 6, 9, "wood", 4)
    P.planks(g, floor, "wood", 4, width=3, across="y", nails=True, seed=1)
    inner = [(cx + (x - cx) * 0.8, cz + 1 + (z - cz - 1) * 0.86) for x, z in hull]
    for i, a in enumerate(hull):
        b, c, e = hull[(i + 1) % len(hull)], inner[(i + 1) % len(hull)], inner[i]
        wall = plan(g, [a, b, c, e], 9, 17, "wood", 6)
        P.planks(g, wall, "wood", 6, width=3, across="y", nails=True, seed=10 + i)
    walls = (g.a > 0) & (Y >= 9) & (Y < 17)
    P.flat(g, walls & (Y >= 16), "darkwood", 4)  # the gunwale cap
    P.flat(g, walls & (Y >= 11) & (Y < 13), "purple", 4)  # a painted band
    P.flat(g, floor & (Y >= 8), "darkwood", 4)
    bench = box(g, cx - 8, 9, cz + 9, cx + 8, 14, cz + 16, "wood", 5)
    P.planks(g, bench, "wood", 5, width=2, across="y", nails=True, seed=3)
    cush = box(g, cx - 7, 14, cz + 9.5, cx + 7, 16, cz + 15.5, "purple", 4)
    P.outline(g, cush, "purple", 2, normal="y")
    # The steering mast rises from the floor to the bat chest. A T-bar is the grip.
    mast = box(g, cx - 1.5, 9, cz - 10, cx + 1.5, 35, cz - 7, "darkwood", 3)
    P.flat(g, mast & ((Y.astype(int) % 7) == 0), "iron", 3)
    grip = box(g, cx - 7, 22, cz - 9.5, cx + 7, 24, cz - 7.5, "iron", 4)
    P.flat(g, grip & (np.abs(X + 0.5 - cx) > 4.5), "purple", 2)
    # The bat body: a furred barrel that tapers to the rump.
    by = 40.0
    body = front(g, [(cx - 5, by - 7), (cx + 5, by - 7), (cx + 8, by - 3), (cx + 8, by + 3), (cx + 5, by + 6.5),
                     (cx - 5, by + 6.5), (cx - 8, by + 3), (cx - 8, by - 3)], cz - 9, cz + 11, "purple", 2,
                 top=[(cx - 3, by - 5), (cx + 3, by - 5), (cx + 5, by - 2), (cx + 5, by + 3), (cx + 3, by + 5),
                      (cx - 3, by + 5), (cx - 5, by + 3), (cx - 5, by - 2)])
    PP.fur(g, body, "purple", 3, seed=4)
    PP.fur(g, body & (Y < by - 2), "purple", 5, seed=5)  # paler belly
    PP.fur(g, body & (Y >= by + 4) & (np.abs(X + 0.5 - cx) < 3), "purple", 2, seed=6)  # dark back stripe
    # The hind legs grip the gunwale with hooked bone claws.
    for s in (-1, 1):
        leg = S.bar(g, "z", (cx + s * 5, by - 4), (cx + s * 9.5, 17.5), 2.2, cz + 9.5, cz + 12, "purple", 1)
        P.flat(g, leg & (Y < 21), "purple", 2)
        for k in range(3):
            zc = cz + 8.6 + k * 1.9
            box(g, cx + s * 9.5 - 1.2, 15.5, zc, cx + s * 9.5 + 1.2, 18.5, zc + 1.2, "bone", 6 + (k % 2))
    # The head: a chamfered skull, a short pug snout with a leaf nose,
    # big glowing eyes, hanging fangs and two tall pointed ears.
    head = side(g, [(34.5, cz - 8), (46, cz - 8), (47.5, cz - 11), (46.5, cz - 16.5), (37, cz - 17), (34.5, cz - 14)],
                cx - 6, cx + 6, "purple", 2)
    snout = side(g, [(35.5, cz - 15), (41.5, cz - 15), (41, cz - 19.8), (36.5, cz - 19.2)], cx - 3.2, cx + 3.2, "purple", 5)
    leaf = front(g, [(cx - 1.6, 40.5), (cx + 1.6, 40.5), (cx, 44)], cz - 20.5, cz - 19, "pink", 3)
    ears = np.zeros(g.shape, dtype=bool)
    tufts = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        ears |= front(g, [(cx + s * 1.2, 46), (cx + s * 7, 44.5), (cx + s * 9.8, 59.5)], cz - 12.5, cz - 9.5, "purple", 3)
        tufts |= front(g, [(cx + s * 5.5, 35.5), (cx + s * 8.5, 36.5), (cx + s * 7.6, 39.5), (cx + s * 9.2, 42),
                           (cx + s * 5.5, 44)], cz - 14, cz - 9, "purple", 5)
    PP.fur(g, head, "purple", 3, seed=7)
    PP.fur(g, head & (Y < 39), "purple", 5, seed=8)
    PP.fur(g, ears, "purple", 3, seed=9)
    PP.fur(g, tufts, "purple", 5, seed=10)
    PP.fur(g, snout, "purple", 5, seed=11)
    dxh = np.abs(X + 0.5 - cx)
    inner = ears & (Z < cz - 11.5) & (Y > 47) & (Y < 56) & (dxh > 2.6) & (dxh < 0.75 + 2.0 + (Y - 46) * 0.42)
    P.flat(g, inner, "pink", 3)  # inner ear
    P.flat(g, ears & (Y >= 57), "purple", 1)
    P.flat(g, snout & (Z < cz - 18.5) & (Y < 38) & (dxh < 2.5), "purple", 1)  # mouth
    P.flat(g, snout & (Z < cz - 18.5) & (Y >= 38.5) & (Y < 40) & (dxh > 0.5) & (dxh < 2), "purple", 1)  # nostrils
    face = head & (Z < cz - 15.5)
    P.flat(g, face & (Y >= 40.5) & (Y < 45.5) & (dxh > 2) & (dxh < 6), "purple", 1)  # eye rims
    P.flat(g, face & (Y >= 41.5) & (Y < 44.5) & (dxh > 2.6) & (dxh < 5.4), "toxic", 6)
    P.flat(g, face & (Y == 43) & (dxh > 3.5) & (dxh < 4.5), "toxic", 7)
    P.flat(g, head & (Y >= 46) & (Z < cz - 14), "purple", 2)  # brow
    for s in (-1, 1):
        box(g, cx + s * 1.6 - 0.6, 33.5, cz - 19.3, cx + s * 1.6 + 0.6, 36, cz - 18.3, "bone", 7)  # fangs
    return g


def _bat_wing(s: int) -> Grid:
    """One wing in plan: a scalloped membrane with darker finger bones, a
    lighter trailing edge and a thumb claw. s = -1 is the left wing."""
    g = Grid(*BG_G)
    X, Y, Z = coords(g)
    cx, cz, y0 = BG_CX, BG_CZ, BG_SHOULDER - 1
    wrist = (cx + s * 24, cz - 13)
    tips = [(cx + s * 45, cz - 6), (cx + s * 40, cz + 12), (cx + s * 27, cz + 19)]
    pts = [(cx + s * 7, cz - 7), wrist, tips[0], (cx + s * 37, cz + 2), tips[1], (cx + s * 31, cz + 10), tips[2],
           (cx + s * 18, cz + 13), (cx + s * 7, cz + 10)]
    mem = plan(g, pts, y0, y0 + 2, "purple", 4)
    P.mottle(g, mem, "purple", 4, cell=4, seed=20 + s)
    P.flat(g, mem & (np.abs(X + 0.5 - cx) < 10), "purple", 3)  # a darker root near the body
    P.outline(g, mem, "purple", 6, normal="y")  # the lighter edge
    # Bones: a thick arm to the wrist and three fingers out to the tips.
    bones = S.bar(g, "y", (cx + s * 7, cz - 4), wrist, 2.6, y0 - 1, y0 + 3.2, "purple", 1)
    for tip in tips:
        bones |= S.bar(g, "y", wrist, tip, 1.5, y0 - 0.6, y0 + 2.8, "purple", 1)
    P.flat(g, bones & (np.abs(X + 0.5 - wrist[0]) < 1.6) & (np.abs(Z + 0.5 - wrist[1]) < 1.6), "bone", 6)  # knuckle
    claw = S.bar(g, "y", (wrist[0], wrist[1] + 1), (wrist[0] - s * 1.0, wrist[1] - 4.5), 1.6, y0 - 0.4, y0 + 2.6, "bone", 6)
    P.flat(g, claw & (Z < wrist[1] - 3), "bone", 7)
    return g


def _bat_glider():
    slug = "bat-glider"
    cx, cz = BG_CX, BG_CZ
    root_j = (cx, 0.0, cz)
    grids = {"body": _bat_gondola(), "wing-left": _bat_wing(-1), "wing-right": _bat_wing(1)}
    root = assemble(grids, [("body", None, root_j),
                            ("wing-left", "body", (cx - 7, BG_SHOULDER, cz - 3)),
                            ("wing-right", "body", (cx + 7, BG_SHOULDER, cz - 3))])
    d = BG_DIHEDRAL
    # Rest pose: the wings rise in a shallow V. Each clip key adds to the rest angle.
    _find(root, "wing-left").rot = (0.0, 0.0, -d)
    _find(root, "wing-right").rot = (0.0, 0.0, d)

    def flap(s, amp, t1, t2):
        return {"rot": keys((0, (0, 0, s * d)), (t1, (0, 0, s * (d + amp))), (t2, (0, 0, s * d)),
                            (t1 + t2, (0, 0, s * (d - amp))), (2 * t2, (0, 0, s * d)))}

    move = {"wing-left": flap(-1, 18, 0.45, 0.9), "wing-right": flap(1, 18, 0.45, 0.9),
            "body": {"loc": keys((0, (0, 0, 0)), (0.9, (0, 1, 0)), (1.8, (0, 0, 0)))}}
    idle = {"wing-left": flap(-1, 3, 0.5, 1.0), "wing-right": flap(1, 3, 0.5, 1.0),
            "body": {"loc": keys((0, (0, 0, 0)), (1, (0, 0.6, 0)), (2, (0, 0, 0)))}}
    return world(slug, "vehicles", "Bat Glider", root,
                 clips=[Clip("move", move), Clip("idle", idle)],
                 sockets=[Socket("socket-wings", at=(0, 44, 2), parent="body")],
                 pfx=[pfx("rvx-monster-ghost-wisps", "socket-wings", "clip:move", size=40, at=0.5)])


# ---------------------------------------------------------------- skeleton rowboat
def _wood(g, bounds, shade=5, seed=0, width=4, ramp="wood"):
    m = box(g, *bounds, ramp, shade)
    P.planks(g, m, ramp, shade, width=width, across="y", nails=True, seed=seed)
    P.flat(g, m & (((coords(g)[1].astype(int)) % 5) == 0), ramp, max(1, shade - 2))
    return m


def _skeleton_rowboat():
    """The pre-repair rowboat with a narrower hull (beam 34), longer oars
    whose blades reach down near the waterline outside the hull, and a stern
    lantern post."""
    slug = "skeleton-rowboat"
    w, h, d = 70, 46, 84
    cx = w / 2
    body, left, right = Grid(w, h, d), Grid(w, h, d), Grid(w, h, d)
    hull = [(cx - 2, 4), (cx + 2, 4), (cx + 14, 15), (cx + 17, 38),
            (cx + 12.5, 69), (cx + 5, 80), (cx - 5, 80), (cx - 12.5, 69),
            (cx - 17, 38), (cx - 14, 15)]
    body.prism("y", hull, 4, 7, C("wood", 5))
    inner = [(cx + (x - cx) * .78, 42 + (z - 42) * .89) for x, z in hull]
    for i, a in enumerate(hull):
        b = hull[(i + 1) % len(hull)]
        c = inner[(i + 1) % len(hull)]
        e = inner[i]
        body.prism("y", [a, b, c, e], 7, 18, C("wood", 5))
        P.planks(body, last(body), "wood", 5, width=3, across="z", nails=True, seed=i)
    for zz in (28, 52):
        _wood(body, (cx - 13, 15, zz, cx + 13, 18, zz + 5), 5, zz, width=4, ramp="wood")
    box(body, cx - 2, 7, 13, cx + 2, 10, 73, "bone", 5)
    # Bone ribs rise from the keel to the gunwales. The skull prow is oversized.
    for z in (17, 28, 40, 52, 64):
        for s in (-1, 1):
            S.bar(body, "z", (cx + s * 2, 7), (cx + s * 11.5, 16), 1.5, z, z + 2, "bone", 5)
    box(body, cx - 3, 17, 9, cx + 3, 22, 16, "bone", 6)
    S.skull(body, cx, 15, 10, s=12, eyes=("toxic", 6), socket=("purple", 1), seed=2)
    # A stern post carries a small hanging lantern.
    post = box(body, cx - 1.5, 7, 74, cx + 1.5, 40, 77, "wood", 4)
    P.planks(body, post, "wood", 4, width=3, across="x", nails=False, seed=30)
    P.flat(body, post & ((coords(body)[1].astype(int) % 8) == 0), "bone", 6)
    S.bar(body, "x", (39, 75.5), (36, 69.5), 2.5, cx - 1.25, cx + 1.25, "wood", 4)
    box(body, cx - 0.5, 32, 69, cx + 0.5, 36, 70, "gray", 4)
    lamp = box(body, cx - 2.5, 24, 67, cx + 2.5, 31, 72, "toxic", 6)
    P.flat(body, lamp & ((np.abs(coords(body)[0] + 0.5 - cx) > 1.8) | (coords(body)[1] < 25) | (coords(body)[1] > 29)), "gray", 5)
    cap = front(body, [(cx - 3.5, 31), (cx + 3.5, 31), (cx, 33.5)], 66.5, 72.5, "purple", 4)
    P.outline(body, cap, "purple", 2, normal="z")
    # Each oar: a handle inboard, a shaft over a bone rowlock, and a broad
    # blade 10 to 14 voxels outside the hull, down near the waterline.
    hb = 17.0  # half-beam at the rowlocks
    for g, sign in ((left, -1), (right, 1)):
        px = cx + sign * 15
        S.bar(g, "z", (cx + sign * 7, 24.5), (px, 21), 1.8, 36.5, 38.5, "wood", 6)
        S.bar(g, "z", (px, 21), (cx + sign * (hb + 10), 11.5), 1.8, 36.5, 38.5, "wood", 5)
        g.prism("z", [(cx + sign * (hb + 9), 13.5), (cx + sign * (hb + 11), 14.5),
                      (cx + sign * (hb + 14.6), 7.5), (cx + sign * (hb + 12.6), 6.5)], 34, 41, C("bone", 5))
        blade = last(g)
        P.outline(g, blade, "bone", 3, normal="z")
        P.flat(g, blade & (np.abs(coords(g)[2] + 0.5 - 37.5) < 0.6), "bone", 4)
        box(g, cx + sign * 7.5 - 1, 23.5, 36, cx + sign * 7.5 + 1, 26, 39, "darkwood", 3)  # handle grip
        box(body, px - 2, 16, 34, px + 2, 24, 36, "bone", 6)
        box(body, px - 2, 16, 39, px + 2, 24, 41, "bone", 6)
        box(body, px - 2, 16, 36, px + 2, 19.5, 39, "gray", 5)  # the rowlock seat under the shaft
    joints = [("body", None, (cx, 0, d / 2)),
              ("oar-left", "body", (cx - 15, 21, 37.5)),
              ("oar-right", "body", (cx + 15, 21, 37.5))]
    root = assemble({"body": body, "oar-left": left, "oar-right": right}, joints)
    # The stroke sweeps the blades back in the water. The return lifts them.
    row = {
        "oar-left": {"rot": keys((0, (0, 0, 0)), (0.6, (0, -18, 0)), (1.2, (0, 0, -8)), (1.8, (0, 18, -8)), (2.4, (0, 0, 0)))},
        "oar-right": {"rot": keys((0, (0, 0, 0)), (0.6, (0, 18, 0)), (1.2, (0, 0, 8)), (1.8, (0, -18, 8)), (2.4, (0, 0, 0)))},
        "body": {"loc": keys((0, (0, 0, 0)), (0.6, (0, 0.6, 0)), (1.2, (0, 0, 0)), (1.8, (0, 0.3, 0)), (2.4, (0, 0, 0)))},
    }
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (1.5, (0, 0.7, 0)), (3, (0, 0, 0)))}}
    return world(slug, "vehicles", "Skeleton Rowboat", root,
                 clips=[Clip("move", row), Clip("idle", idle)],
                 sockets=[Socket("socket-wake", at=(0, 4, 32), parent="body")],
                 pfx=[pfx("rvx-monster-ghost-wake", "socket-wake", "clip:move", size=30, at=0.15)])


BUILDERS = {"wolf-sled": _wolf_sled, "bat-glider": _bat_glider, "skeleton-rowboat": _skeleton_rowboat}


def build(category, slug):
    if category != "vehicles" or slug not in BUILDERS:
        raise KeyError(f"_rep_vehicles does not build {category}/{slug}")
    return BUILDERS[slug]()
