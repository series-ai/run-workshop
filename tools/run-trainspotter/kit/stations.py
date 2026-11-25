"""Station buildings, in the trackside frame (see structures.py): they stand
behind a platform, on the next lane out (x 64..128), with their ground floor
at platform height and a canopy reaching over the platform."""
from __future__ import annotations

import numpy as np

from catalog import plain
import pnkit as K
from railkit import PLATFORM_TOP, C, Grid, P, Part, coords

OX = 28  # grid x 0 is trackside x 28 (just behind the platform edge and canopy posts)


def country_station(name="station-country"):
    """A small brick station with a slate gable roof, chimneys and a
    timber canopy over the platform on slender posts."""
    L = 128
    g = Grid(132 - OX, 96, L + 8)
    X, Y, Z = coords(g)
    top = PLATFORM_TOP
    x0, x1 = 68 - OX, 124 - OX  # walls
    z0, z1 = 12, L - 4
    # plinth at platform height under the building
    K.box(g, x0 - 4, 0, z0 - 4, x1 + 4, top, z1 + 4, "stone", 3)
    walls = K.box(g, x0, top, z0, x1, top + 36, z1, "rust", 4)
    P.stone(g, walls, "rust", 4, block=(6, 3))
    P.flat(g, walls & (Y >= top) & (Y < top + 2), "stone", 6)  # sill course
    P.flat(g, walls & (Y >= top + 34), "stone", 6)  # cornice
    K.gable_roof(g, x0, x1, z0, z1, top + 36, top + 58, ramp="stone", base=2, thick=3, overhang=4, trim="bone", gable="rust", ridge="z", trim_shade=6)
    for zc in (z0 + 14, z1 - 14):  # chimneys
        K.box(g, x1 - 14, top + 40, zc - 3, x1 - 8, top + 66, zc + 3, "rust", 3)
        K.box(g, x1 - 15, top + 64, zc - 4, x1 - 7, top + 67, zc + 4, "stone", 5)
    # platform side (-x): a double door in the middle, tall windows either side
    zm = (z0 + z1) // 2
    K.door(g, "-x", x0, zm - 8, zm + 8, top, top + 26, leaf="blood", frame="bone", base=3, arch=False)
    for zc in list(range(z0 + 10, zm - 12, 16)) + list(range(zm + 16, z1 - 8, 16)):
        K.window(g, "-x", x0, zc - 4, zc + 4, top + 10, top + 26, frame="bone", glass="navy", glow=4, cross=True, sill="stone")
    for zc in range(z0 + 10, z1 - 8, 18):  # road side
        K.window(g, "+x", x1, zc - 4, zc + 4, top + 10, top + 26, frame="bone", glass="navy", glow=4, cross=True, sill="stone")
    # canopy: a shallow sloped timber roof from the wall over the platform
    cz0, cz1 = z0 - 4, z1 + 4
    g.prism("z", [(2, top + 38), (x0, top + 44), (x0, top + 47), (2, top + 41)], cz0, cz1, C("bone", 5))
    canopy = P.region(g, 0, top + 36, cz0, x0, top + 48, cz1) & (g.a > 0)
    P.flat(g, canopy & (X < 4), "blood", 4)  # valance
    for zc in range(cz0 + 6, cz1, 24):
        K.box(g, 6, top, zc - 1, 8, top + 39, zc + 1, "blood", 3)  # posts on the platform
    # a station nameboard on two legs at the platform end, left blank for a game to letter
    K.box(g, 10, top, 2, 12, top + 22, 4, "iron", 3)
    K.box(g, 4, top + 16, 2, 30, top + 24, 4, "bone", 6)
    P.outline(g, P.region(g, 4, top + 16, 2, 30, top + 24, 4) & (g.a > 0), "blood", 3, normal="z")
    root = Part(name, g, pivot=(-OX, 0, L))
    data = {"kind": "station", "frame": "trackside", "length": L, "floorY": PLATFORM_TOP, "footprint": [64, 128]}
    return root, [], [], data


def clock(g: Grid, face: str, plane: int, cy: float, cz: float, r: float = 6.0) -> None:
    """A round clock face standing 1 voxel proud of an x face: bone dial, dark
    rim, hour marks and hands at ten to two."""
    from pnshapes import disc

    lo, hi = (plane - 1, plane) if face == "-x" else (plane, plane + 1)
    m = disc(g, "x", cy, cz, r, lo, hi, "bone", 7, n=16)
    X, Y, Z = coords(g)
    rr = np.hypot(Y + 0.5 - cy, Z + 0.5 - cz)
    ang = np.arctan2(Y + 0.5 - cy, Z + 0.5 - cz)
    P.flat(g, m & (rr > r - 1.3), "iron", 2)  # rim
    for k in range(12):  # hour marks
        a = 2 * np.pi * k / 12
        P.flat(g, m & (np.abs(rr - (r - 2.2)) < 0.7) & (np.cos(ang - a) > 0.985), "iron", 3)
    for a, length in ((np.radians(60), r * 0.5), (np.radians(140), r * 0.75)):  # hands
        d = np.abs(np.sin(ang - a)) * rr
        P.flat(g, m & (d < 0.75) & (np.cos(ang - a) > 0) & (rr < length), "iron", 1)


def _canopy(g: Grid, x0: int, top: int, cz0: int, cz1: int, height: int = 38) -> None:
    """The platform canopy every station shares: a shallow timber roof from the
    wall at grid x0 out over the platform on slender posts (trackside x 34)."""
    g.prism("z", [(2, top + height), (x0, top + height + 6), (x0, top + height + 9), (2, top + height + 3)], cz0, cz1, C("bone", 5))
    X, Y, Z = coords(g)
    canopy = P.region(g, 0, top + height - 2, cz0, x0, top + height + 10, cz1) & (g.a > 0)
    P.flat(g, canopy & (X < 4), "blood", 4)  # valance
    for zc in range(cz0 + 6, cz1, 24):
        K.box(g, 6, top, zc - 1, 8, top + height + 1, zc + 1, "blood", 3)  # posts stand on the platform


def town_station(name="station-town"):
    """A two-storey brick town station with stone quoins and string courses,
    a slate roof, a clock turret on the ridge and a long platform canopy."""
    L = 128
    g = Grid(132 - OX, 150, L + 8)
    X, Y, Z = coords(g)
    top = PLATFORM_TOP
    x0, x1 = 68 - OX, 124 - OX
    z0, z1 = 8, L - 4
    st = 30  # storey height
    K.box(g, x0 - 4, 0, z0 - 4, x1 + 4, top, z1 + 4, "stone", 3)  # plinth at platform height
    walls = K.box(g, x0, top, z0, x1, top + 2 * st + 2, z1, "rust", 4)
    P.stone(g, walls, "rust", 4, block=(6, 3))
    for y in (top, top + st, top + 2 * st):  # string courses
        P.flat(g, walls & (Y >= y) & (Y < y + 2), "stone", 6)
    quoin = walls & ((X < x0 + 3) | (X >= x1 - 3)) & ((Z < z0 + 3) | (Z >= z1 - 3))
    P.flat(g, quoin & ((Y // 4) % 2 == 0), "stone", 6)
    K.gable_roof(g, x0, x1, z0, z1, top + 2 * st + 2, top + 2 * st + 24, ramp="stone", base=2, thick=3, overhang=4, trim="bone",
                 gable="rust", ridge="z", trim_shade=6)
    zm = (z0 + z1) // 2
    # ground floor (platform side): double doors in the middle, tall arched-head windows
    K.door(g, "-x", x0, zm - 8, zm + 8, top, top + 24, leaf="blood", frame="bone", base=3, arch=True)
    for zc in list(range(z0 + 12, zm - 12, 16)) + list(range(zm + 18, z1 - 8, 16)):
        K.window(g, "-x", x0, zc - 4, zc + 4, top + 6, top + 24, frame="bone", glass="navy", glow=4, cross=True, sill="stone")
    for zc in range(z0 + 12, z1 - 6, 16):  # first floor, both sides
        for face, plane in (("-x", x0), ("+x", x1)):
            K.window(g, face, plane, zc - 4, zc + 4, top + st + 6, top + st + 22, frame="bone", glass="navy", glow=4, cross=True, sill="stone")
    for zc in range(z0 + 12, z1 - 6, 16):  # road side ground floor
        K.window(g, "+x", x1, zc - 4, zc + 4, top + 6, top + 24, frame="bone", glass="navy", glow=4, cross=True, sill="stone")
    for zc in (z0 + 10, z1 - 10):  # chimneys
        K.box(g, x1 - 12, top + 2 * st + 8, zc - 3, x1 - 6, top + 2 * st + 34, zc + 3, "rust", 3)
        K.box(g, x1 - 13, top + 2 * st + 32, zc - 4, x1 - 5, top + 2 * st + 35, zc + 4, "stone", 5)
    # clock turret on the ridge, faces both ways, with a pyramid cap
    from pnshapes import cone

    tx, ty = (x0 + x1) // 2, top + 2 * st + 22
    turret = K.box(g, tx - 7, ty, zm - 7, tx + 7, ty + 20, zm + 7, "bone", 5)
    P.flat(g, turret & (Y >= ty + 18), "stone", 6)
    clock(g, "-x", tx - 7, ty + 10, zm, r=6)
    clock(g, "+x", tx + 7, ty + 10, zm, r=6)
    cone(g, "y", tx, zm, 9.5, ty + 20, ty + 34, "stone", 2, n=4, r_top=0.0)
    _canopy(g, x0, top, z0 - 4, z1 + 4)
    root = Part(name, g, pivot=(-OX, 0, L))
    data = {"kind": "station", "frame": "trackside", "length": L, "floorY": PLATFORM_TOP, "footprint": [64, 128], "storeys": 2}
    return root, [], [], data


def terminus(name="station-terminus"):
    """The grand frontage of a terminus: a brick screen across the end of the
    line with a great glazed arch, a clock in the pediment above it and a
    corner tower at each side.

    Frame: it stands across the end of the line. The origin is on the centre
    line of the first track at ground level; tracks run at x = 0, 64 and 128
    (toward -Z), and the facade's track-side face is at z = 0, with the
    building behind it (z < 0). Put the buffer stops just short of z = 0."""
    W, D, H = 256, 28, 168
    XL = -64  # trackside x of grid x 0
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    cx = 64 - XL  # the arch is centred over the middle track
    spring, r_out, r_in = 28, 104, 94
    wall_top = 120
    body = K.box(g, 0, 0, 0, W, wall_top, D, "rust", 4)
    P.stone(g, body, "rust", 4, block=(8, 4))
    P.flat(g, body & (Y < 6), "stone", 3)  # plinth
    for y in (wall_top - 4,):
        P.flat(g, body & (Y >= y), "stone", 6)  # cornice
    # the great arch: a glazed screen with a stone ring standing proud of the face
    rr = np.hypot(X + 0.5 - cx, Y + 0.5 - spring)
    screen = body & (Z == D - 1) & (((rr < r_in) & (Y >= spring)) | ((np.abs(X + 0.5 - cx) < r_in) & (Y < spring) & (Y >= 6)))
    P.flat(g, screen, "navy", 3)
    mull = screen & (((X - cx) % 12 == 0) | ((Y - 6) % 16 == 0) | (np.abs(rr - r_in * 0.55) < 0.8))
    P.flat(g, mull, "bone", 6)
    P.flat(g, screen & ((X + Y) % 13 == 4) & ~mull, "navy", 6)  # glints
    ring = [(cx + r_out * np.cos(a), spring + r_out * np.sin(a)) for a in np.linspace(0, np.pi, 25)]
    ring += [(cx + r_in * np.cos(a), spring + r_in * np.sin(a)) for a in np.linspace(np.pi, 0, 25)]
    g.prism("z", ring, D - 2, D + 0, C("stone", 6))
    P.flat(g, P.region(g, 0, 0, D - 2, W, H, D) & (g.a > 0) & (np.abs(np.arctan2(Y + 0.5 - spring, X + 0.5 - cx) - np.pi / 2) < 0.06) & (rr > r_in), "stone", 4)  # keystone
    for sx in (cx - r_out - 4, cx + r_out - 4):  # piers under the ring ends
        K.box(g, sx, 0, D - 3, sx + 8, spring, D, "stone", 5)
    # pediment with the clock
    from pnshapes import cone

    g.prism("z", [(cx - 44, wall_top), (cx + 44, wall_top), (cx, wall_top + 30)], 2, D - 2, C("stone", 5))
    from pnshapes import disc

    dial = disc(g, "z", cx, wall_top + 12, 9, D - 2, D - 1, "bone", 7, n=16)
    dr = np.hypot(X + 0.5 - cx, Y + 0.5 - (wall_top + 12))
    da = np.arctan2(Y + 0.5 - (wall_top + 12), X + 0.5 - cx)
    P.flat(g, dial & (dr > 7.6), "iron", 2)
    for a, length in ((np.radians(60), 4.5), (np.radians(140), 6.8)):
        P.flat(g, dial & (np.abs(np.sin(da - a)) * dr < 0.75) & (np.cos(da - a) > 0) & (dr < length), "iron", 1)
    # corner towers with pyramid caps and tall windows
    for tx0 in (0, W - 28):
        tower = K.box(g, tx0, 0, 0, tx0 + 28, wall_top + 24, D, "rust", 4)
        P.stone(g, tower, "rust", 4, block=(8, 4))
        P.flat(g, tower & ((X == tx0) | (X == tx0 + 27)) & ((Y // 5) % 2 == 0), "stone", 6)
        P.flat(g, tower & (Y >= wall_top + 20), "stone", 6)
        cone(g, "y", tx0 + 14, D / 2, 13.5, wall_top + 24, wall_top + 44, "stone", 2, n=4, r_top=0.0)
        for wy in (20, 56, 92, 128):
            K.window(g, "+z", D, tx0 + 9, tx0 + 19, wy, wy + 18, frame="bone", glass="navy", glow=4, cross=True, sill="stone")
    # windows either side of the arch, between it and the towers
    for wx in (36, 196):
        for wy in (24, 72):
            K.window(g, "+z", D, wx, wx + 12, wy, wy + 22, frame="bone", glass="navy", glow=4, cross=True, sill="stone")
    root = Part(name, g, pivot=(-XL, 0, D))
    data = {"kind": "terminus", "frame": "line-end", "tracks": [0, 64, 128], "faceZ": 0, "width": W}
    return root, [], [], data


def signal_box(name="signal-box"):
    """A raised lineside signal box: a brick locking room, a timber operating
    floor glazed all round, a slate hipped roof and an outside stair. The
    origin is the centre of its base; stand it `trackOffset` from the track."""
    Wx, Wz = 40, 52
    x0, z0 = 8, 14
    g = Grid(Wx + 16, 84, z0 + Wz + 26)
    X, Y, Z = coords(g)
    x1, z1 = x0 + Wx, z0 + Wz
    base = K.box(g, x0, 0, z0, x1, 30, z1, "rust", 4)
    P.stone(g, base, "rust", 4, block=(6, 3))
    for zc in range(z0 + 8, z1 - 4, 14):  # small locking-room windows, track side
        K.window(g, "-x", x0, zc - 3, zc + 3, 10, 20, frame="bone", glass="navy", glow=3, cross=False, sill="stone")
    cab = K.box(g, x0 - 2, 30, z0 - 2, x1 + 2, 56, z1 + 2, "bone", 5)
    P.flat(g, cab & (Y < 34), "blood", 4)  # waist
    # glazed all round: a band of panes with thin glazing bars
    band = cab & (Y >= 36) & (Y < 54) & ((X == x0 - 2) | (X == x1 + 1) | (Z == z0 - 2) | (Z == z1 + 1))
    P.flat(g, band, "navy", 3)
    P.flat(g, band & (((Z - z0) % 7 == 0) & ((X == x0 - 2) | (X == x1 + 1)) | (((X - x0) % 7 == 0) & ((Z == z0 - 2) | (Z == z1 + 1)))), "bone", 6)
    P.flat(g, band & ((Y == 44)), "bone", 6)
    K.gable_roof(g, x0 - 2, x1 + 2, z0 - 2, z1 + 2, 56, 70, ramp="stone", base=2, thick=3, overhang=4, trim="bone", gable="bone", ridge="z", trim_shade=6)
    # outside stair up the far end to a landing at the door
    from pnshapes import bar

    for k in range(10):  # treads
        y = 3 * k
        K.box(g, x1 - 12, y, z1 + 2 + 18 - 2 * k, x1 - 2, y + 3, z1 + 4 + 18 - 2 * k, "wood", 4)
    K.box(g, x1 - 12, 27, z1 + 2, x1 - 2, 30, z1 + 6, "wood", 3)  # landing
    bar(g, "x", (2, z1 + 22), (31, z1 + 4), 1.6, x1 - 2, x1 - 1, "blood", 3)  # handrail
    P.flat(g, cab & (Z == z1 + 1) & (X >= x1 - 11) & (X < x1 - 3) & (Y >= 30) & (Y < 52), "blood", 3)  # door
    root = Part(name, g, pivot=(x0 + Wx / 2, 0, z0 + Wz / 2))
    data = {"kind": "signal-box", "trackOffset": 64}
    return root, [], [], data


CATALOG = [
    plain("stations-platforms", country_station, "buildings", "building", "structures", tier="slice"),
    plain("stations-platforms", town_station, "buildings", "building", "structures"),
    plain("stations-platforms", terminus, "buildings", "building", "structures"),
    plain("stations-platforms", signal_box, "buildings", "building", "structures"),
]
