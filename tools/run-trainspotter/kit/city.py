"""Town and city scenery: buildings, roads, road vehicles, people and street
furniture, at the kit's scale (a person is 36 voxels tall).

Buildings stand with their origin at the centre of the footprint on the
ground and their front facing -Z; footprints are on a 32 grid. Street props
stand with their origin at the centre of their base. Some windows are painted
warm gold, as if lit: a night scene can make those glow.

Road vehicles and people have paint / trim / accent roles (catalogue data),
so a game can recolour them; glass, tyres, lamps and faces use fixed ramps.
"""
from __future__ import annotations

import math

import numpy as np

import pnkit as K
import pnpaint
from catalog import plain
from pnshapes import disc, flat_ngon, last
from railkit import C, Grid, P, Part, Socket, coords

M = 6  # margin round a footprint: windows, doors and roof overhangs stand proud of the walls


def _lit(i: int, j: int = 0) -> bool:
    """A steady scatter of lit windows."""
    return (i * 7 + j * 3) % 5 in (0, 3)


def _window(g, face, plane, u0, u1, v0, v1, i, j=0, frame="bone", sill="stone", cross=True):
    lit = _lit(i, j)
    K.window(g, face, plane, u0, u1, v0, v1, frame=frame, glass="gold" if lit else "navy", glow=6 if lit else 3, cross=cross, sill=sill)


def _building(name: str, g: Grid, W: int, D: int, data: dict, sockets=()) -> tuple:
    """Root part with its origin at the footprint centre on the ground."""
    root = Part(name, g, pivot=(M + W / 2, 0, M + D / 2))
    socks = [Socket(n, (x - (M + W / 2), y, z - (M + D / 2)), parent=name) for n, (x, y, z) in sockets]
    return root, socks, [], {"kind": "building", "footprint": [W, D], **data}


def _grid(W: int, H: int, D: int) -> Grid:
    return Grid(W + 2 * M, H, D + 2 * M)


def _brick(g, mask, ramp="rust", base=4):
    P.stone(g, mask, ramp, base, block=(6, 3))


# ---------------------------------------------------------------- buildings
def house_terraced(name="house-terraced"):
    """A terrace of three narrow two-storey brick houses with bay windows,
    front doors in three colours and chimney stacks on a slate roof."""
    W, D, st = 96, 48, 30
    g = _grid(W, 110, D)
    X, Y, Z = coords(g)
    x0, z0, x1, z1 = M, M, M + W, M + D
    walls = K.box(g, x0, 0, z0, x1, 2 * st + 4, z1, "rust", 4)
    _brick(g, walls)
    P.flat(g, walls & (Y < 4), "stone", 3)
    P.flat(g, walls & (Y >= st) & (Y < st + 2), "stone", 6)
    K.gable_roof(g, x0, x1, z0, z1, 2 * st + 4, 2 * st + 26, ramp="stone", base=2, thick=3, overhang=3, trim="stone", gable="rust",
                 ridge="x", trim_shade=6)
    doors = ("blood", "forest", "navy")
    for k in range(3):
        hx = x0 + k * 32
        if k:
            P.flat(g, walls & (X == hx) & (Y > 4), "stone", 5)  # party wall line
        K.door(g, "-z", z0, hx + 20, hx + 28, 4, 26, leaf=doors[k], frame="bone", base=3, arch=False)
        K.box(g, hx + 3, 4, z0 - 4, hx + 17, 24, z0, "rust", 4)  # bay window
        _window(g, "-z", z0 - 4, hx + 5, hx + 15, 8, 22, k)
        K.box(g, hx + 2, 24, z0 - 5, hx + 18, 26, z0, "stone", 5)  # bay roof
        _window(g, "-z", z0, hx + 6, hx + 14, st + 8, st + 24, k, 1)
        _window(g, "-z", z0, hx + 20, hx + 28, st + 8, st + 24, k, 2)
        _window(g, "+z", z1, hx + 10, hx + 22, st + 8, st + 24, k, 3)
        K.box(g, hx + 13, 2 * st + 12, z0 + 20, hx + 19, 2 * st + 34, z0 + 28, "rust", 3)  # chimney
        K.box(g, hx + 12, 2 * st + 32, z0 + 19, hx + 20, 2 * st + 35, z0 + 29, "stone", 5)
    return _building(name, g, W, D, {"storeys": 2, "homes": 3})


def house_detached(name="house-detached"):
    """A detached cottage: plastered walls, a steep gabled roof facing the
    street, a porch and a low picket fence round the front garden."""
    W, D = 64, 64
    g = _grid(W, 100, D)
    X, Y, Z = coords(g)
    hx0, hx1, hz0, hz1 = M + 12, M + 52, M + 22, M + 60
    walls = K.box(g, hx0, 0, hz0, hx1, 34, hz1, "sand", 6)
    P.flat(g, walls & (Y < 4), "stone", 3)
    K.gable_roof(g, hx0, hx1, hz0, hz1, 34, 62, ramp="red", base=3, thick=3, overhang=4, trim="darkwood", gable="sand", ridge="z", trim_shade=3)
    K.door(g, "-z", hz0, M + 28, M + 36, 2, 24, leaf="forest", frame="bone", base=3, arch=False)
    K.box(g, M + 24, 22, hz0 - 6, M + 40, 25, hz0, "darkwood", 3)  # porch roof
    for x in (M + 25, M + 38):
        K.box(g, x, 0, hz0 - 6, x + 1, 22, hz0 - 5, "bone", 6)
    _window(g, "-z", hz0, M + 15, M + 24, 8, 22, 1)
    _window(g, "-z", hz0, M + 40, M + 49, 8, 22, 2)
    _window(g, "-z", hz0, M + 27, M + 37, 40, 52, 3)  # gable window
    for zc in (hz0 + 10, hz0 + 26):
        _window(g, "-x", hx0, zc - 4, zc + 4, 8, 22, zc)
        _window(g, "+x", hx1, zc - 4, zc + 4, 8, 22, zc + 1)
    K.box(g, hx1 - 10, 44, hz1 - 12, hx1 - 4, 72, hz1 - 6, "rust", 3)  # chimney
    # garden: lawn and a picket fence along the front and sides
    lawn = K.box(g, M, 0, M, M + W, 1, hz0, "moss", 4)
    P.flat(g, lawn & ((X + Z) % 7 == 0), "moss", 5)
    K.box(g, M + 28, 0, M, M + 36, 1, hz0, "stone", 5)  # path
    for x in range(M, M + W, 4):
        if not (M + 27 <= x < M + 37):
            K.box(g, x, 1, M, x + 2, 9, M + 1, "bone", 6)
    K.box(g, M, 5, M, M + 27, 6, M + 1, "bone", 5)
    K.box(g, M + 37, 5, M, M + W, 6, M + 1, "bone", 5)
    for x in (M, M + W - 1):
        for z in range(M, hz0, 4):
            K.box(g, x, 1, z, x + 1, 9, z + 2, "bone", 6)
    return _building(name, g, W, D, {"storeys": 2})


def apartment_block(name="apartment-block"):
    """A four-storey block of flats: rendered walls, stacked balconies with
    rails, a flat roof with a parapet and a lift tower."""
    W, D, st = 96, 64, 28
    H = 4 * st + 4
    g = _grid(W, H + 20, D)
    X, Y, Z = coords(g)
    x0, z0, x1, z1 = M, M, M + W, M + D
    walls = K.box(g, x0, 0, z0, x1, H, z1, "bone", 5)
    P.flat(g, walls & (Y < 6), "stone", 3)
    for k in range(1, 4):
        P.flat(g, walls & (Y >= k * st) & (Y < k * st + 2), "stone", 6)
    K.box(g, x0, H, z0, x1, H + 4, z1, "stone", 5)  # parapet
    K.box(g, x0 + 3, H, z0 + 3, x1 - 3, H + 3, z1 - 3, "gray", 4)  # roof
    K.box(g, x0 + 38, H, z0 + 26, x0 + 58, H + 16, z0 + 44, "bone", 4)  # lift tower
    K.door(g, "-z", z0, x0 + 42, x0 + 54, 0, 22, leaf="navy", frame="steel", base=3, arch=False)
    for f in range(4):
        y = f * st + 6
        for k, xc in enumerate(range(x0 + 10, x1 - 4, 20)):
            if f == 0 and abs(xc - (x0 + 48)) < 10:
                continue
            _window(g, "-z", z0, xc - 5, xc + 5, y, y + 16, f, k, frame="steel", sill=None, cross=False)
            _window(g, "+z", z1, xc - 5, xc + 5, y, y + 16, f, k + 2, frame="steel", sill=None, cross=False)
            if f:  # balcony: a slab and a rail in front of every upper window
                K.box(g, xc - 8, y - 6, z0 - 6, xc + 8, y - 4, z0, "stone", 5)
                rail = K.box(g, xc - 8, y - 4, z0 - 6, xc + 8, y + 2, z0 - 5, "steel", 5)
                P.flat(g, rail & ((X - xc) % 3 != 0) & (Y < y + 1), "steel", 3)
        for zc in range(z0 + 12, z1 - 6, 20):
            _window(g, "-x", x0, zc - 5, zc + 5, y, y + 16, f, zc, frame="steel", sill=None, cross=False)
            _window(g, "+x", x1, zc - 5, zc + 5, y, y + 16, f, zc + 1, frame="steel", sill=None, cross=False)
    return _building(name, g, W, D, {"storeys": 4})


def shop_row(name="shop-row", paint="red", trim="bone", accent="teal"):
    """A row of four shops: big shop windows and striped awnings at street
    level, two floors of flats above, a cornice and chimneys."""
    W, D, st = 128, 48, 28
    H = 3 * st + 6
    g = _grid(W, H + 26, D)
    X, Y, Z = coords(g)
    x0, z0, x1, z1 = M, M, M + W, M + D
    walls = K.box(g, x0, 0, z0, x1, H, z1, "rust", 4)
    _brick(g, walls)
    P.flat(g, walls & (Y >= H - 4), "stone", 6)  # cornice
    P.flat(g, walls & (Y >= st) & (Y < st + 3), "stone", 5)  # fascia over the shops
    K.box(g, x0, H, z0, x1, H + 2, z1, "stone", 4)  # flat roof edge
    shops = (paint, accent, paint, accent)
    for k in range(4):
        sx = x0 + k * 32
        front = K.box(g, sx + 2, 0, z0 - 2, sx + 30, st, z0, shops[k], 4)  # painted shopfront
        P.flat(g, front & (Y < 2), "stone", 3)
        win = front & (Z == z0 - 2) & (X >= sx + 5) & (X < sx + 19) & (Y >= 5) & (Y < 22)
        P.flat(g, win, "gold" if _lit(k) else "navy", 6 if _lit(k) else 3)
        P.flat(g, win & ((X - sx) % 7 == 4), shops[k], 2)
        door = front & (Z == z0 - 2) & (X >= sx + 21) & (X < sx + 27) & (Y < 22)
        P.flat(g, door, shops[k], 2)
        P.flat(g, door & (Y >= 12) & (Y < 20), "navy", 3)
        K.awning(g, "-z", z0 - 2, sx + 3, sx + 29, st - 2, depth=4, drop=4, ramps=(trim, shops[k]), stripe=3)
        for f in (1, 2):
            y = f * st + 6
            _window(g, "-z", z0, sx + 6, sx + 14, y, y + 16, k, f)
            _window(g, "-z", z0, sx + 18, sx + 26, y, y + 16, k, f + 3)
            _window(g, "+z", z1, sx + 12, sx + 20, y, y + 16, k, f + 1)
        K.box(g, sx + 13, H, z0 + 30, sx + 19, H + 18, z0 + 38, "rust", 3)  # chimney
        K.box(g, sx + 12, H + 16, z0 + 29, sx + 20, H + 19, z0 + 39, "stone", 5)
    return _building(name, g, W, D, {"storeys": 3, "shops": 4, "paint": paint, "trim": trim, "accent": accent})


def office_tower(name="office-tower"):
    """A city office tower: a stone base, glazed bands between pale spandrels
    on every floor, and a roof plant room with a mast."""
    W, D, st = 64, 64, 14
    floors = 10
    H = 16 + floors * st
    g = _grid(W, H + 26, D)
    X, Y, Z = coords(g)
    x0, z0, x1, z1 = M, M, M + W, M + D
    body = K.box(g, x0, 0, z0, x1, H, z1, "khaki", 5)
    P.flat(g, body & (Y < 16), "stone", 4)  # base
    sides = body & ((X == x0) | (X == x1 - 1) | (Z == z0) | (Z == z1 - 1))
    for f in range(floors):
        y = 16 + f * st
        band = sides & (Y >= y + 3) & (Y < y + st - 2)
        P.flat(g, band, "navy", 3)
        # some offices lit: whole bays of a band
        bay = ((X + Z) // 8) % 5
        P.flat(g, band & (bay == (f * 2) % 5), "gold", 6)
        P.flat(g, band & ((X + Z) % 8 == 0), "khaki", 6)  # mullions
    entry = sides & (Z == z0) & (X >= x0 + 22) & (X < x1 - 22) & (Y >= 2) & (Y < 14)
    P.flat(g, entry, "navy", 4)
    K.box(g, x0 + 18, 14, z0 - 5, x1 - 18, 16, z0, "steel", 5)  # entrance canopy
    K.box(g, x0, H, z0, x1, H + 3, z1, "steel", 4)  # parapet
    K.box(g, x0 + 16, H, z0 + 16, x1 - 16, H + 12, z1 - 16, "stone", 5)  # plant room
    K.box(g, x0 + 31, H + 12, z0 + 31, x0 + 33, H + 26, z0 + 33, "steel", 5)  # mast
    return _building(name, g, W, D, {"storeys": floors, "height": H + 26}, sockets=[("socket-light", (x0 + 32, H + 25, z0 + 32))])


def church(name="church"):
    """A stone parish church: a nave with a steep slate roof and tall pointed
    windows, a west tower with a louvred belfry and a spire."""
    W, D = 96, 128
    g = _grid(W, 178, D)
    X, Y, Z = coords(g)
    nx0, nx1, nz0, nz1 = M + 20, M + 76, M + 36, M + D
    nave = K.box(g, nx0, 0, nz0, nx1, 44, nz1, "stone", 5)
    P.stone(g, nave, "stone", 5, block=(8, 4))
    K.gable_roof(g, nx0, nx1, nz0, nz1, 44, 82, ramp="stone", base=2, thick=3, overhang=3, trim="stone", gable="stone", ridge="z", trim_shade=6)
    for k, zc in enumerate(range(nz0 + 14, nz1 - 6, 18)):
        for face, plane in (("-x", nx0), ("+x", nx1)):
            _window(g, face, plane, zc - 4, zc + 4, 10, 36, k, frame="stone", sill="stone")
    # west tower with belfry and spire
    tx0, tx1, tz0, tz1 = M + 30, M + 66, M + 2, M + 38
    tower = K.box(g, tx0, 0, tz0, tx1, 96, tz1, "stone", 4)
    P.stone(g, tower, "stone", 4, block=(8, 4))
    P.flat(g, tower & (Y >= 92), "stone", 6)
    K.door(g, "-z", tz0, M + 42, M + 54, 0, 26, leaf="darkwood", frame="stone", base=3, arch=True)
    for face, plane, axis in (("-z", tz0, "x"), ("+x", tx1, "z"), ("-x", tx0, "z")):
        u0 = (M + 44) if axis == "x" else (tz0 + 14)
        louvre = K.box(g, *K.on_face(face, plane, u0, u0 + 8, 68, 86, 0, 1), "iron", 2)  # belfry louvres
        P.flat(g, louvre & (Y % 3 == 0), "stone", 5)
    cx, cz = (tx0 + tx1) / 2, (tz0 + tz1) / 2
    sq = [(cx - 16, cz - 16), (cx + 16, cz - 16), (cx + 16, cz + 16), (cx - 16, cz + 16)]
    g.prism("y", sq, 96, 170, C("stone", 3), top=[(cx, cz)] * 4)
    spire = last(g)
    P.flat(g, spire & ((Y // 6) % 2 == 0), "stone", 2)
    K.box(g, int(cx) - 1, 170, int(cz) - 1, int(cx) + 1, 176, int(cz) + 1, "ember", 5)  # weathervane
    return _building(name, g, W, D, {"height": 176})


def factory(name="factory"):
    """A brick factory with a north-light sawtooth roof, big loading doors and
    a tall round-topped chimney (socket-smoke at its top)."""
    W, D = 128, 96
    g = _grid(W, 160, D)
    X, Y, Z = coords(g)
    x0, z0, x1, z1 = M, M, M + W, M + D
    H = 40
    walls = K.box(g, x0, 0, z0, x1, H, z1, "rust", 4)
    _brick(g, walls)
    P.flat(g, walls & (Y >= H - 3), "stone", 5)
    # sawtooth roof: ridges along x, each tooth a slope up to a vertical glazed face
    tooth = 16
    for k, tz in enumerate(range(z0, z1, tooth)):
        g.prism("x", [(H, tz), (H, tz + tooth), (H + 14, tz + tooth)], x0, x1, C("stone", 2))
        m = last(g)
        glazed = m & (Z == tz + tooth - 1) & (Y > H + 1) & (Y < H + 13)
        P.flat(g, glazed, "gold" if k % 2 else "navy", 6 if k % 2 else 3)
    for k, xc in enumerate(range(x0 + 12, x1 - 6, 16)):
        _window(g, "-z", z0, xc - 4, xc + 4, 12, 32, k, frame="steel", sill="stone", cross=True)
        _window(g, "+z", z1, xc - 4, xc + 4, 12, 32, k + 1, frame="steel", sill="stone", cross=True)
    for zc in (z0 + 30, z0 + 66):  # loading doors on the yard side
        door = K.box(g, x1, 0, zc - 10, x1 + 1, 30, zc + 10, "teal", 3)
        P.flat(g, door & (Y % 4 == 0), "teal", 2)
    pnpaint.concrete(g, K.box(g, x1 + 1, 0, z0, x1 + M, 1, z1, "gray", 5), "gray", 5, size=16, cracks=0)
    # chimney at a back corner
    cxs, czs = x0 + 14, z1 - 14
    stack = K.box(g, cxs - 6, 0, czs - 6, cxs + 6, 150, czs + 6, "rust", 4)
    _brick(g, stack)
    P.flat(g, stack & (Y >= 144), "iron", 2)
    for y in (60, 100):
        P.flat(g, stack & (Y >= y) & (Y < y + 3), "stone", 5)
    return _building(name, g, W, D, {"height": 150}, sockets=[("socket-smoke", (cxs, 150, czs))])


def warehouse(name="warehouse"):
    """A goods warehouse: brick walls, a shallow roof, four big loading doors
    on the track side under a long timber canopy."""
    W, D = 128, 64
    g = _grid(W, 80, D + 14)
    X, Y, Z = coords(g)
    x0, z0, x1, z1 = M, M + 14, M + W, M + D + 14
    H = 44
    walls = K.box(g, x0, 0, z0, x1, H, z1, "rust", 3)
    _brick(g, walls)
    P.flat(g, walls & (Y >= H - 3), "stone", 5)
    K.gable_roof(g, x0, x1, z0, z1, H, H + 16, ramp="stone", base=3, thick=2, overhang=2, trim="stone", gable="rust", ridge="x", trim_shade=5)
    for k, xc in enumerate(range(x0 + 16, x1, 32)):
        door = K.box(g, xc - 10, 0, z0 - 1, xc + 10, 30, z0, "darkwood", 4)
        P.planks(g, door, "darkwood", 4, width=3, across="x", nails=False)
        P.flat(g, door & ((X == xc) | (Y == 15)), "darkwood", 2)
        _window(g, "-z", z0, xc - 4, xc + 4, 34, 40, k, frame="stone", sill=None, cross=False)
    # canopy over a loading dock
    K.box(g, x0, 0, z0 - 14, x1, 8, z0, "stone", 4)  # dock
    g.prism("x", [(36, z0 - 14), (36, z0), (41, z0), (39, z0 - 14)], x0 - 2, x1 + 2, C("darkwood", 4))
    for x in range(x0 + 2, x1, 32):
        K.box(g, x, 8, z0 - 13, x + 2, 36, z0 - 11, "darkwood", 3)
    return _building(name, g, W, D + 14, {"loadingSide": "-z", "dockHeight": 8})


# ---------------------------------------------------------------- roads
def _road_grid():
    return Grid(64, 3, 64)


def road_straight(name="road-straight"):
    """A 64 x 64 road tile running along z: two lanes with a dashed centre
    line, kerbs and pavements both sides. Tiles join end to end."""
    g = _road_grid()
    X, Y, Z = coords(g)
    road = K.box(g, 12, 0, 0, 52, 1, 64, "gray", 2)
    P.flat(g, road & ((X == 31) | (X == 32)) & (Z % 16 < 8), "sand", 7)  # centre dashes
    P.flat(g, road & ((X == 14) | (X == 49)), "sand", 6)  # edge lines
    for xa, xb in ((0, 12), (52, 64)):
        walk = K.box(g, xa, 0, 0, xb, 3, 64, "stone", 5)
        pnpaint.concrete(g, walk & (Y == 2), "stone", 5, size=8, cracks=0)
        P.flat(g, walk & ((X == 11) | (X == 52)), "stone", 6)  # kerb
    root = Part(name, g, pivot=(32, 0, 32))
    return root, [], [], {"kind": "road", "tile": 64, "along": "z", "lanes": 2}


def road_crossroads(name="road-crossroads"):
    """A 64 x 64 crossroads tile: roads meet from all four sides, pavements
    at the corners, zebra stripes on one arm."""
    g = _road_grid()
    X, Y, Z = coords(g)
    K.box(g, 0, 0, 0, 64, 1, 64, "gray", 2)
    for xa, xb in ((0, 12), (52, 64)):
        for za, zb in ((0, 12), (52, 64)):
            walk = K.box(g, xa, 0, za, xb, 3, zb, "stone", 5)
            pnpaint.concrete(g, walk & (Y == 2), "stone", 5, size=8, cracks=0)
    road = (g.a > 0) & (Y == 0)
    P.flat(g, road & (Z >= 2) & (Z < 10) & (X >= 14) & (X < 50) & ((X // 3) % 2 == 0), "sand", 7)  # zebra crossing
    P.flat(g, road & ((X == 31) | (X == 32)) & ((Z < 10) | (Z >= 54)), "sand", 7)
    P.flat(g, road & ((Z == 31) | (Z == 32)) & ((X < 10) | (X >= 54)), "sand", 7)
    root = Part(name, g, pivot=(32, 0, 32))
    return root, [], [], {"kind": "road", "tile": 64, "junction": "cross"}


# ---------------------------------------------------------------- road vehicles
def _wheels(g, xs, zs, r=3.5, y=None):
    for x0, x1 in xs:
        for z in zs:
            disc(g, "x", r if y is None else y, z, r, x0, x1, "iron", 2, n=10)
            m = last(g)
            X, Y, Z = coords(g)
            P.flat(g, m & (np.hypot(Y + 0.5 - r, Z + 0.5 - z) < 1.6), "steel", 5)


def _lamps(g, x0, x1, y, zf, zr):
    for x in (x0, x1):
        g.set(x, y, zf, C("sand", 7))
        g.set(x, y, zr, C("ember", 5))


def _car(name, L, roof_from, roof_to, paint, trim, accent, H=16, roof_h=10, estate=False):
    W = 20
    g = Grid(W + 2, H + roof_h + 2, L)
    X, Y, Z = coords(g)
    x0, x1 = 1, W + 1
    body = K.box(g, x0, 3, 1, x1, H, L - 1, paint, 4)
    P.flat(g, body & (Y < 5), trim, 3)  # sills
    P.flat(g, body & ((Z <= 2) | (Z >= L - 3)) & (Y < 8), accent, 5)  # bumpers
    # cabin: a sloped prism along x with glass on its faces
    poly = [(H, roof_from - 6), (H, roof_to + (0 if estate else 5)), (H + roof_h, roof_to), (H + roof_h, roof_from)]
    g.prism("x", [(y, z) for y, z in poly], x0 + 1, x1 - 1, C(paint, 4))
    cab = last(g)
    P.flat(g, cab & (Y >= H + 1) & (Y < H + roof_h - 1), "navy", 3)
    P.flat(g, cab & (Y >= H + roof_h - 1), paint, 5)
    P.flat(g, cab & (Y >= H + 1) & (Y < H + roof_h - 1) & (np.abs(Z - (roof_from + roof_to) / 2) < 0.8), paint, 4)  # pillar
    _lamps(g, x0 + 1, x1 - 2, H - 4, 1, L - 2)
    g.set(x0 + 2, H - 4, 1, C("sand", 7))
    g.set(x1 - 3, H - 4, 1, C("sand", 7))
    _wheels(g, ((0, 3), (W - 1, W + 2)), (8, L - 8), r=4)
    root = Part(name, g, pivot=((W + 2) / 2, 0, L / 2))
    return root, [], [], {"kind": "road-vehicle", "length": L, "paint": paint, "trim": trim, "accent": accent}


def car_small(name="car-small", paint="sky", trim="arcane", accent="khaki"):
    """A small round-shouldered hatchback."""
    return _car(name, 40, 12, 32, paint, trim, accent, H=14, roof_h=9)


def car_estate(name="car-estate", paint="red", trim="arcane", accent="khaki"):
    """A long estate car with a flat roof running to the tailgate."""
    return _car(name, 48, 13, 44, paint, trim, accent, H=15, roof_h=9, estate=True)


def bus(name="bus", paint="red", trim="bone", accent="arcane"):
    """A single-deck town bus: a long box body, a band of windows, a door at
    the front and in the middle, a destination box over the windscreen."""
    L, W, H = 110, 24, 32
    g = Grid(W + 2, H + 2, L)
    X, Y, Z = coords(g)
    x0, x1 = 1, W + 1
    body = K.box(g, x0, 3, 1, x1, H, L - 1, paint, 4)
    P.flat(g, body & (Y >= H - 2), trim, 5)  # roof
    P.flat(g, body & (Y < 6), accent, 3)  # skirt
    sides = body & ((X == x0) | (X == x1 - 1))
    win = sides & (Y >= 16) & (Y < 27) & (Z >= 18) & (Z < L - 6)
    P.flat(g, win, "navy", 3)
    P.flat(g, win & ((Z - 18) % 12 == 0), paint, 3)
    P.flat(g, sides & (Y >= 13) & (Y < 15), trim, 6)  # waist band
    for zd in (6, 52):  # doors on the kerb side (+x)
        d = body & (X == x1 - 1) & (Z >= zd) & (Z < zd + 9) & (Y >= 4)
        P.flat(g, d, "navy", 3)
        P.flat(g, d & (Z == zd + 4), accent, 3)
    front = body & (Z == 1)
    P.flat(g, front & (Y >= 14) & (Y < 27) & (X > x0 + 1) & (X < x1 - 2), "navy", 4)
    P.flat(g, front & (Y >= 27) & (Y < 30) & (X > x0 + 3) & (X < x1 - 4), "iron", 2)  # destination box
    P.flat(g, front & (Y >= 27) & (Y < 30) & (X > x0 + 5) & (X < x1 - 6) & (X % 2 == 0), "ember", 6)
    _lamps(g, x0 + 1, x1 - 2, 8, 0, L - 2)
    for x in (x0 + 1, x1 - 2):
        g.set(x, 8, 1, C("sand", 7))
        g.set(x, 8, L - 2, C("ember", 5))
    _wheels(g, ((0, 3), (W - 1, W + 2)), (18, L - 22), r=5)
    root = Part(name, g, pivot=((W + 2) / 2, 0, L / 2))
    return root, [], [], {"kind": "road-vehicle", "length": L, "doors": 2, "paint": paint, "trim": trim, "accent": accent}


def delivery_van(name="delivery-van", paint="skin", trim="blue", accent="arcane"):
    """A box van: a short cab and a tall box body with a coloured stripe."""
    L, W = 56, 22
    g = Grid(W + 2, 32, L)
    X, Y, Z = coords(g)
    x0, x1 = 1, W + 1
    cab = K.box(g, x0, 3, 1, x1, 22, 16, trim, 4)
    g.prism("x", [(14, 1), (22, 7), (22, 16), (14, 16)], x0 + 1, x1 - 1, C(trim, 4))
    P.flat(g, cab & (Z == 1) & (Y >= 12) & (Y < 20) & (X > x0) & (X < x1 - 1), "navy", 3)
    P.flat(g, cab & ((X == x0) | (X == x1 - 1)) & (Y >= 13) & (Y < 20) & (Z >= 5) & (Z < 13), "navy", 3)
    box = K.box(g, x0, 4, 16, x1, 30, L - 1, paint, 5)
    P.flat(g, box & (Y >= 12) & (Y < 16), trim, 4)
    P.flat(g, box & (Z == L - 2) & (X == W // 2 + 1), paint, 2)  # rear door split
    P.flat(g, (g.a > 0) & (Y < 5), accent, 3)
    for x in (x0 + 1, x1 - 2):
        g.set(x, 7, 1, C("sand", 7))
        g.set(x, 7, L - 2, C("ember", 5))
    _wheels(g, ((0, 3), (W - 1, W + 2)), (9, L - 10), r=4)
    root = Part(name, g, pivot=((W + 2) / 2, 0, L / 2))
    return root, [], [], {"kind": "road-vehicle", "length": L, "paint": paint, "trim": trim, "accent": accent}


# ---------------------------------------------------------------- street furniture and people
def street_lamp(name="street-lamp"):
    """A cast-iron street lamp with a lit lantern head."""
    g = Grid(14, 54, 14)
    X, Y, Z = coords(g)
    K.box(g, 4, 0, 4, 10, 4, 10, "iron", 3)
    K.box(g, 6, 4, 6, 8, 44, 8, "iron", 3)
    K.box(g, 3, 44, 3, 11, 45, 11, "iron", 2)  # base plate
    lens = K.box(g, 3, 45, 3, 11, 51, 11, "sand", 7)  # lit glass panes on all four sides
    P.flat(g, lens & ((X == 3) | (X == 10)) & ((Z == 3) | (Z == 10)), "iron", 2)  # corner posts
    K.box(g, 2, 51, 2, 12, 52, 12, "iron", 2)  # cap
    K.box(g, 5, 52, 5, 9, 54, 9, "iron", 3)
    root = Part(name, g, pivot=(7, 0, 7))
    return root, [Socket("socket-light", (0, 48, 0), parent=name)], [], {"kind": "lamp", "light": "warm"}


def park_bench(name="park-bench"):
    """A slatted park bench on cast-iron ends."""
    g = Grid(32, 18, 12)
    X, Y, Z = coords(g)
    for x in (2, 28):
        K.box(g, x, 0, 1, x + 2, 9, 10, "iron", 3)
        K.box(g, x, 9, 9, x + 2, 17, 11, "iron", 3)
    seat = K.box(g, 1, 9, 1, 31, 10, 9, "wood", 5)
    P.flat(g, seat & (Z % 3 == 0), "wood", 3)
    back = K.box(g, 1, 11, 9, 31, 17, 10, "wood", 5)
    P.flat(g, back & (Y % 3 == 0), "wood", 3)
    root = Part(name, g, pivot=(16, 0, 6))
    return root, [], [], {"kind": "bench", "seats": 3}


def telegraph_pole(name="telegraph-pole"):
    """A wooden telegraph pole with two crossarms of insulators."""
    g = Grid(36, 92, 6)
    X, Y, Z = coords(g)
    pole = K.box(g, 16, 0, 1, 20, 90, 5, "darkwood", 4)
    P.flat(g, pole & ((X + Y) % 9 == 0), "darkwood", 3)
    for y in (78, 86):
        K.box(g, 2, y, 2, 34, y + 2, 4, "darkwood", 3)
        for x in range(4, 34, 6):
            K.box(g, x, y + 2, 2, x + 2, y + 5, 4, "stone", 6)
    K.box(g, 15, 90, 0, 21, 92, 6, "darkwood", 2)
    root = Part(name, g, pivot=(18, 0, 3))
    return root, [], [], {"kind": "pole", "trackOffset": 44}


def _person(name, paint, trim, accent, stride: int):
    g = Grid(14, 37, 12)
    X, Y, Z = coords(g)
    # legs (trousers in trim), feet, torso (paint), arms (paint) with hands, head and hair
    for lx, dz in ((3, -stride), (8, stride)):
        K.box(g, lx, 2, 4 + dz, lx + 3, 16, 8 + dz, trim, 4)
        K.box(g, lx, 0, 3 + dz, lx + 3, 2, 8 + dz, "iron", 2)
    K.box(g, 2, 16, 3, 12, 28, 9, paint, 4)
    P.flat(g, (g.a > 0) & (Y == 16), accent, 4)  # belt
    for ax, dz in ((0, stride), (12, -stride)):
        K.box(g, ax, 17 + abs(dz) // 2, 4 + dz, ax + 2, 28, 8 + dz, paint, 3)
        K.box(g, ax, 15 + abs(dz) // 2, 4 + dz, ax + 2, 17 + abs(dz) // 2, 8 + dz, "sand", 5)
    K.box(g, 4, 28, 3, 10, 36, 9, "sand", 5)
    K.box(g, 4, 34, 3, 10, 37, 9, "darkwood", 2)  # hair
    K.box(g, 4, 31, 9, 10, 37, 10, "darkwood", 2)
    g.set(5, 32, 2, C("iron", 1))  # eyes on the front (-z)
    g.set(8, 32, 2, C("iron", 1))
    root = Part(name, g, pivot=(7, 0, 6))
    return root, [], [], {"kind": "person", "height": 36, "paint": paint, "trim": trim, "accent": accent}


def person_standing(name="person-standing", paint="teal", trim="navy", accent="arcane"):
    """A passenger standing and waiting, facing -Z."""
    return _person(name, paint, trim, accent, 0)


def person_walking(name="person-walking", paint="orange", trim="arcane", accent="khaki"):
    """A passenger mid-stride, walking toward -Z."""
    return _person(name, paint, trim, accent, 2)


CATALOG = [
    plain("city-buildings", house_terraced, "buildings", "building", "structures"),
    plain("city-buildings", house_detached, "buildings", "building", "structures"),
    plain("city-buildings", apartment_block, "buildings", "building", "structures"),
    plain("city-buildings", shop_row, "buildings", "building", "structures"),
    plain("city-buildings", office_tower, "buildings", "building", "structures"),
    plain("city-buildings", church, "buildings", "building", "structures"),
    plain("city-buildings", factory, "buildings", "building", "structures"),
    plain("city-buildings", warehouse, "buildings", "building", "structures"),
    plain("city-street", road_straight, "props", "tile", "props"),
    plain("city-street", road_crossroads, "props", "tile", "props"),
    plain("city-street", car_small, "props", "prop", "props"),
    plain("city-street", car_estate, "props", "prop", "props"),
    plain("city-street", bus, "props", "prop", "props"),
    plain("city-street", delivery_van, "props", "prop", "props"),
    plain("city-street", street_lamp, "props", "lamp", "props"),
    plain("city-street", person_standing, "props", "prop", "props"),
    plain("city-street", person_walking, "props", "prop", "props"),
    plain("city-street", park_bench, "props", "prop", "props"),
    plain("city-street", telegraph_pole, "props", "tall-prop", "props"),
]
