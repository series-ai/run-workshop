"""Rocket launch pad, in the Pirate Nation mecha style.

The function prop is a giant retro rocket (rule F4): a white octagonal hull
with a painted red roll pattern and teal portholes, a tall red nose cone
and four swept red fins (true slopes), on a copper engine bell. It stands
in a copper gear launch ring on a plated pad with sloped sides and hazard
edges, and rumbles on `idle` while the thrust PFX fires at its base
(socket-steam). Beside it: a hazard-orange lattice gantry with true
diagonal braces, swing arms and a crew access arm; a squat plated bunker
with a sloped roof and a blast door; two orange propellant tanks with dome
caps piped to the ring; a T-10 countdown board and a floodlight mast.
Detail is painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import beacon, blast_door, coords, corner_posts, crate, facet_paint, fuel_drum, hull_on, plates_on, sign, spot, steel_box, window
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket

W, H, D = 122, 132, 112
PT = 8  # pad top
RX, RZ = 42, 56  # rocket axis
MT = 16  # launch ring top
GX0, GX1, GZ0, GZ1, GY1 = 66, 84, 47, 65, 122  # gantry


def body() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    g.prism("y", [(2, 2), (120, 2), (120, 110), (2, 110)], 0, PT, C("steel", 4), top=[(8, 8), (114, 8), (114, 104), (8, 104)])
    pad = S.last(g)
    facet_paint(g, g.solids[n0:], plates_on("steel", 4, size=(12, 12), rivets=False, seed=1))
    topm = pad & (Y > PT - 1)
    P.flat(g, topm, "steel", 5)
    P.flat(g, topm & ((np.floor(X - 8) % 16 == 0) | (np.floor(Z - 8) % 16 == 0)), "steel", 4)
    P.flat(g, topm & (np.abs(np.hypot(X - RX, Z - RZ) - 25) < 1.2), "gold", 6)
    rim = topm & ((X < 11) | (X > 111) | (Z < 11) | (Z > 101))
    P.flat(g, rim & ((np.floor(X + Z) // 3) % 2 == 0), "orange", 5)
    P.flat(g, rim & ((np.floor(X + Z) // 3) % 2 == 1), "steel", 2)
    scorch = topm & (np.hypot(X - RX, Z - RZ) < 22) & ~rim
    P.flat(g, scorch, "steel", 3)
    P.flat(g, scorch & (np.hypot(X - RX, Z - RZ) < 17), "iron", 4)
    # launch ring: a copper gear lying on the pad, with hold-down posts
    S.gear(g, "y", RX, RZ, 15, PT, MT - 3, teeth=16, depth=2.5, ramp="rust", base=4)
    ring = S.disc(g, "y", RX, RZ, 13, MT - 3, MT, "steel", 4, n=8)
    P.flat(g, ring & (S.ngon_radius(g, "y", RX, RZ, 8) > 11.5), "orange", 5)
    for dx, dz in ((-12, -12), (12, -12), (-12, 12), (12, 12)):
        post = box(g, RX + dx - 2, MT - 3, RZ + dz - 2, RX + dx + 2, MT + 6, RZ + dz + 2, "steel", 3)
        P.flat(g, post & (Y > MT + 4), "orange", 5)
    gantry(g)
    bunker(g)
    tanks(g)
    extras(g)
    return g


def gantry(g: Grid) -> None:
    X, Y, Z = coords(g)
    posts = np.zeros(g.shape, dtype=bool)
    for x0, z0 in ((GX0, GZ0), (GX1 - 3, GZ0), (GX0, GZ1 - 3), (GX1 - 3, GZ1 - 3)):
        posts |= box(g, x0, PT, z0, x0 + 3, GY1, z0 + 3, "orange", 5)
    P.flat(g, posts & (np.floor(Y) % 8 == 0), "orange", 3)
    for y0 in range(PT, GY1 - 10, 22):
        y1 = y0 + 22
        # braces on the four faces (true diagonals)
        for z0 in (GZ0, GZ1 - 2):
            S.bar(g, "z", (GX0 + 2, y0 + 1), (GX1 - 2, y1 - 1), 2, z0, z0 + 2, "orange", 4)
        for x0 in (GX0, GX1 - 2):
            S.bar(g, "x", (y0 + 1, GZ1 - 2), (y1 - 1, GZ0 + 2), 2, x0, x0 + 2, "orange", 4)
        deck = box(g, GX0, y1 - 2, GZ0, GX1, y1, GZ1, "steel", 4)
        P.flat(g, edges(deck), "steel", 2)
    roof = steel_box(g, GX0 - 2, GY1, GZ0 - 2, GX1 + 2, GY1 + 4, GZ1 + 2, seed=2)
    P.flat(g, roof & (Y < GY1 + 1.5), "orange", 5)
    beacon(g, GX0 + 4, GY1 + 4, GZ0 + 4, h=6)
    # elevator car
    car = box(g, GX0 + 4, 40, GZ0 + 4, GX1 - 4, 54, GZ1 - 4, "bone", 5)
    P.mottle(g, car, "bone", 5, seed=3)
    P.flat(g, car & (Y > 45) & (Y < 51) & (Z < GZ0 + 4.9) & (np.abs(X - (GX0 + GX1) / 2) < 3), "cyan", 6)
    # swing arms to the rocket, and the crew access arm near the top
    for y0 in (52, 80):
        arm = box(g, RX + 10, y0, RZ - 3, GX0, y0 + 4, RZ + 3, "steel", 4)
        P.flat(g, arm & ((np.floor(X) // 3) % 2 == 0) & (Y > y0 + 3), "orange", 5)
        P.flat(g, edges(arm), "steel", 2)
    cab = box(g, RX + 11, 96, RZ - 5, GX0 + 1, 106, RZ + 5, "bone", 5)
    P.mottle(g, cab, "bone", 5, seed=4)
    P.flat(g, edges(cab), "bone", 3)
    P.flat(g, cab & (Y > 99) & (Y < 104) & (Z < RZ - 4) & (X > RX + 13) & (X < GX0 - 1), "cyan", 6)
    box(g, RX + 11, 94, RZ - 6, GX0 + 1, 96, RZ + 6, "steel", 3)
    # a copper pipe climbs the gantry
    S.pipe(g, [(GX1 + 2, PT, GZ1 - 4), (GX1 + 2, 100, GZ1 - 4), (GX1 - 2, 100, GZ1 - 4)], s=3, ramp="rust", base=4)


def bunker(g: Grid) -> None:
    X, Y, Z = coords(g)
    bx0, bx1, bz0, bz1, by1 = 86, 114, 10, 36, 32
    steel_box(g, bx0, PT, bz0, bx1, by1, bz1, seed=5)
    corner_posts(g, bx0, bx1, bz0, bz1, PT, by1, size=3)
    n0 = len(g.solids)
    g.prism("y", [(bx0 - 2, bz0 - 2), (bx1 + 2, bz0 - 2), (bx1 + 2, bz1 + 2), (bx0 - 2, bz1 + 2)], by1, by1 + 9, C("steel", 5), top=[(bx0 + 6, bz0 + 6), (bx1 - 6, bz0 + 6), (bx1 - 6, bz1 - 6), (bx0 + 6, bz1 - 6)])
    facet_paint(g, g.solids[n0:], plates_on("steel", 5, size=(7, 5), seed=6))
    rf = S.last(g)
    P.flat(g, rf & (Y < by1 + 1), "orange", 5)
    P.flat(g, rf & S.seams(g, g.solids[n0:], 0.8), "steel", 3)
    blast_door(g, "-z", bz0, 93, 107, PT, PT + 18, seed=7)
    window(g, "+x", bx1, 16, 30, 18, 26)
    # periscope and antenna on the roof
    box(g, 97, by1 + 9, 20, 103, by1 + 13, 26, "rust", 4)


def tanks(g: Grid) -> None:
    X, Y, Z = coords(g)
    for cx, cz, h in ((16, 76, 44), (16, 96, 36)):
        body = S.disc(g, "y", cx, cz, 8, PT, PT + h, "orange", 5, n=8)
        P.mottle(g, body, "orange", 5, seed=cx + cz)
        P.flat(g, body & (np.abs(Y - (PT + 6)) < 2), "bone", 6)
        P.flat(g, body & (np.abs(Y - (PT + h - 6)) < 2), "bone", 6)
        P.flat(g, body & S.seams(g, [g.solids[-1]], 0.7), "orange", 3)
        S.dome(g, cx, cz, PT + h, 8, h=6, n=8, rings=2, ramp="bone", base=6, cap_r=2)
        S.pipe(g, [(cx + 8, PT + 10, cz), (RX - 16, PT + 10, cz), (RX - 16, PT + 10, RZ + 10)], s=4, ramp="rust", base=4)


def extras(g: Grid) -> None:
    X, Y, Z = coords(g)
    # T-10 countdown board on two legs at the front left
    for x0 in (13, 35):
        box(g, x0, PT, 16, x0 + 3, PT + 18, 19, "steel", 3)
    sign(g, "-z", 16, 25, PT + 14, "T-10", board=("orange", 5), ink=("bone", 7), scale=1, pad=3, depth=2)
    # floodlight mast at the back right
    box(g, 106, PT, 96, 110, 76, 100, "steel", 3)
    lamp = box(g, 100, 76, 94, 114, 84, 100, "steel", 4)
    P.flat(g, lamp & (Z < 94.9), "gold", 7)
    P.flat(g, edges(lamp), "steel", 2)
    crate(g, 96, PT, 44, 9)
    crate(g, 106, PT, 46, 8, ramp="steel", base=5, stripe=("orange", 5))
    fuel_drum(g, 100, 60, PT, h=12, r=4.5)


def rocket() -> Grid:
    """The retro rocket: bell, white body with a red roll pattern, portholes,
    a red nose cone and four swept fins."""
    c = 22
    g = Grid(44, 98, 44)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    bell = S.cone(g, "y", c, c, 8, 0, 8, "rust", 4, n=8, r_top=5)
    P.flat(g, bell & (Y < 1.5), "rust", 3)
    body = S.disc(g, "y", c, c, 11, 8, 70, "bone", 6, n=8)
    facet_paint(g, [g.solids[-1]], hull_on("bone", 6, size=(9, 12), seed=8))
    ang = np.floor((np.degrees(np.arctan2(Z - c, X - c)) + 360 + 22.5) / 90) % 2
    roll = body & (((Y > 14) & (Y < 26)) | ((Y > 56) & (Y < 64)))
    P.flat(g, roll & (ang == 0), "red", 5)
    P.flat(g, body & (np.abs(Y - 40) < 1), "steel", 4)
    for py in (46, 58):
        pz = body & (Z < c - 9.5) & (np.hypot(X - c, Y - py) < 3.2)
        P.flat(g, pz, "rust", 3)
        P.flat(g, pz & (np.hypot(X - c, Y - py) < 2.2), "cyan", 6)
    nose = S.cone(g, "y", c, c, 11, 70, 96, "red", 5, n=8)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.mottle(gg, mm, "red", 5, cell=3, seed=9))
    P.flat(g, nose & (Y < 73), "bone", 4)
    P.flat(g, nose & S.seams(g, [g.solids[-1]], 0.7), "red", 4)
    tip = box(g, c - 1, 95, c - 1, c + 1, 98, c + 1, "steel", 5)
    # four swept fins
    for s in (-1, 1):
        g.prism("z", [(c + s * 10, 34), (c + s * 10, 10), (c + s * 21, 1), (c + s * 21, 14)], c - 1.5, c + 1.5, C("red", 5))
        f = S.last(g)
        P.outline(g, f, "red", 3, normal="z")
        g.prism("x", [(34, c + s * 10), (10, c + s * 10), (1, c + s * 21), (14, c + s * 21)], c - 1.5, c + 1.5, C("red", 5))
        f = S.last(g)
        P.outline(g, f, "red", 3, normal="x")
    return g


def build() -> Asset:
    g = body()
    root = Part("launch-pad", g)
    rg = rocket()
    root.add(Part("rocket", rg, pivot=(22.0, 0.0, 22.0), at=(RX, MT - 1, RZ)))
    # starts and ends centred, so the loop closes
    rumble = {"rocket": {"loc": [(0.0, (0.0, 0.0, 0.0))] + [(i * 0.1, ((0.3 if i % 2 else -0.3), 0.0, (0.2 if i % 3 else -0.2))) for i in range(1, 10)] + [(1.0, (0.0, 0.0, 0.0))]}}
    return Asset(
        id="space-buildings-launch-pad", pack="space", category="buildings", name="Rocket Launch Pad", root=root,
        clips=[Clip("idle", rumble)],
        sockets=[Socket("socket-steam", at=(RX, MT - 1, RZ))],
        pfx=[{"effectId": "rvx-space-launch-steam", "socket": "socket-steam", "trigger": "idle", "size": 90}],
    )
