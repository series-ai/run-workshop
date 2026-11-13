"""Builders for the second Space world-model wave.

Each public builder returns one typed RVX asset. The model source files keep
the ids and authored model choices visible. Shared helpers keep the voxel
scale, paint rules and rig setup consistent across the wave.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnglyph
from _bld import beacon, blast_door, corner_posts, crate, fuel_drum, hull_box, sign, steel_box, steel_roof, window
from _life import (
    Clip, Grid, Rig, asset, band, box, coords, edges, facet_paint, front, gem,
    hazard, light_top, loft, mask_of, ngon_y, plan, plated, rock, side, spin, wave,
)
from pnshapes import bar, cone, disc, dome, pipe, pyramid, quad, wheel
from voxgrid import C, Part
from _repair_motion import ground_death


def _plate(g: Grid, m: np.ndarray, ramp: str, base: int = 5, seed: int = 0, size=(8, 6)) -> np.ndarray:
    P.plates(g, m, ramp, base, size=size, seed=seed)
    P.flat(g, edges(m), ramp, max(2, base - 2))
    return m


def _box(g: Grid, xyz, ramp: str = "steel", base: int = 5, seed: int = 0, size=(8, 6)) -> np.ndarray:
    m = box(g, *xyz, ramp, base)
    return _plate(g, m, ramp, base, seed, size)


def _solid(g: Grid, cx, cz, r, y0, y1, ramp, base=5, n=8, top=None) -> np.ndarray:
    m = ngon_y(g, cx, cz, r, y0, y1, ramp, base, n=n, r_top=top)
    light_top(g, m, ramp, min(7, base + 1))
    P.plates(g, m, ramp, base, size=(7, 5), seed=round(cx + cz))
    P.flat(g, edges(m), ramp, max(2, base - 2))
    return m


class _ScaledYGrid(Grid):
    """Map design y coordinates to whole voxel rows before a shape is added."""

    def __init__(self, sx: int, sy: int, sz: int, factor: float):
        super().__init__(sx, sy, sz)
        self.factor = factor

    def _y(self, value: float) -> float:
        return float(math.floor(value * self.factor + 0.5))

    def prism(self, axis, poly, lo, hi, c, top=None):
        if axis == "x":
            poly = [(self._y(u), v) for u, v in poly]
            top = None if top is None else [(self._y(u), v) for u, v in top]
        elif axis == "z":
            poly = [(u, self._y(v)) for u, v in poly]
            top = None if top is None else [(u, self._y(v)) for u, v in top]
        else:
            lo, hi = self._y(lo), self._y(hi)
        if hi <= lo:
            hi = lo + 1
        return super().prism(axis, poly, lo, hi, c, top)


def _coords_design_y(g: Grid, factor: float):
    X, Y, Z = coords(g)
    return X, Y / factor, Z


def _box_design_y(g: Grid, factor: float, x0, y0, z0, x1, y1, z1, ramp: str, shade: int = 4):
    lo, hi = math.floor(y0 * factor), math.ceil(y1 * factor)
    return box(g, x0, lo, z0, x1, max(lo + 1, hi), z1, ramp, shade)


# ---------------------------------------------------------------- animated props
def _drone_dock() -> object:
    S = (54, 52, 56)
    cx, cz = 27, 28

    def base_grid() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        pl = _solid(g, cx, cz, 24, 0, 4, "iron", 4, 8, 21)
        P.flat(g, pl, "iron", 4)
        P.flat(g, pl & (Y < 2), "orange", 5)
        mast = _box(g, (cx - 12, 4, cz - 13, cx + 12, 24, cz + 13), "steel", 5, 2, (8, 7))
        P.flat(g, mast & (Z < cz - 12) & (Y > 12) & (Y < 21), "cyan", 6)
        P.flat(g, mast & (Z < cz - 12) & (Y > 17) & (np.floor(X) % 3 == 0), "cyan", 7)
        deck = _box(g, (cx - 19, 24, cz - 18, cx + 19, 28, cz + 18), "bone", 6, 3, (10, 8))
        P.flat(g, deck & (np.abs(X - cx) < 1.2), "orange", 5)
        P.flat(g, deck & (np.abs(Z - cz) < 1.2), "orange", 5)
        for x in (cx - 15, cx + 11):
            box(g, x, 28, cz - 15, x + 4, 35, cz - 11, "steel", 4)
        return g

    def arm(s: int) -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        pts = [(cx + s * 14, 27), (cx + s * 18, 27), (cx + s * 19, 35),
               (cx + s * 10, 44), (cx + s * 7, 42), (cx + s * 14, 34)]
        m = front(g, pts, cz - 3, cz + 3, "steel", 5)
        P.plates(g, m, "steel", 5, size=(6, 5), seed=4 + s)
        P.flat(g, edges(m), "steel", 3)
        pad = m & (Y > 39) & (np.abs(X - (cx + s * 9)) < 3)
        P.flat(g, pad, "orange", 6)
        P.flat(g, m & (Y > 32) & (Y < 35), "rust", 5)
        return g

    def drone_grid() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        shell = _solid(g, cx, cz, 12, 35, 42, "bone", 6, 8, 7)
        P.flat(g, shell & (Z < cz - 10) & (np.abs(X - cx) < 6), "cyan", 6)
        P.flat(g, shell & (Z < cz - 10) & (Y > 39), "cyan", 7)
        for s in (-1, 1):
            bar(g, "x", (cx + s * 8, 36), (cx + s * 15, 31), 2, cz - 1, cz + 1, "steel", 5)
            disc(g, "y", cx + s * 17, cz, 4, 29, 31, "steel", 4, n=8)
        return g

    rig = Rig()
    rig.add("dock", base_grid(), (cx, 0, cz))
    rig.add("arm-l", arm(-1), (cx - 14, 28, cz), "dock")
    rig.add("arm-r", arm(1), (cx + 14, 28, cz), "dock")
    rig.add("drone", drone_grid(), (cx, 35, cz), "dock")
    z = (0.0, 0.0, 0.0)
    open_clip = {"arm-l": {"rot": [(0.0, z), (0.3, (0, -10, -22)), (1.0, (0, -8, -42))]},
                 "arm-r": {"rot": [(0.0, z), (0.3, (0, 10, 22)), (1.0, (0, 8, 42))]},
                 "drone": {"loc": [(0.0, z), (1.0, (0, 8, 0))]}}
    close_clip = {"arm-l": {"rot": [(0.0, (0, -8, -42)), (0.7, (0, 4, 10)), (1.0, z)]},
                  "arm-r": {"rot": [(0.0, (0, 8, 42)), (0.7, (0, -4, -10)), (1.0, z)]},
                  "drone": {"loc": [(0.0, (0, 8, 0)), (1.0, z)]}}
    idle = {"drone": {"rot": wave(4.0, "y", 8), "loc": wave(2.0, "y", 0.7, base=(0, 4, 0))}}
    sock = rig.sock("socket-scan", (cx, 39, cz - 12), parent="drone")
    return asset("animated-props", "drone-dock", "Drone Dock", rig.root,
                 clips=[Clip("idle", idle), Clip("open", open_clip, loop=False), Clip("close", close_clip, loop=False)],
                 sockets=[sock], pfx=[{"effectId": "rvx-space-holo-scan", "socket": "socket-scan", "trigger": "clip:open", "size": 12, "aim": [0, 0, -1], "at": 0.55}])


def _conveyor_belt() -> object:
    S = (68, 36, 40)
    cx, cz = 34, 20

    def frame() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        base = box(g, 2, 0, 3, 66, 7, 37, "iron", 4)
        hazard(g, base & (Y < 3), period=5)
        for x in (4, 59):
            disc(g, "x", 8, cz, 7, x, x + 5, "steel", 5, n=8)
        for x in (5, 60):
            for z in (5, 32):
                _box(g, (x, 6, z, x + 4, 24, z + 3), "steel", 5, x, (7, 6))
        belt = box(g, 8, 7, 8, 60, 10, 32, "iron", 4)
        P.flat(g, belt & (np.floor(X) % 6 == 0), "steel", 4)
        P.flat(g, belt & (np.floor(X) % 12 == 0), "orange", 5)
        for z in (6, 31):
            rail = box(g, 8, 10, z, 60, 15, z + 3, "bone", 6)
            _plate(g, rail, "bone", 6, 9, (9, 5))
            P.flat(g, rail & (np.floor(X) % 12 == 0), "cyan", 6)
        return g

    def roller(x0: int) -> Grid:
        g = Grid(*S)
        _X, Y, Z = coords(g)
        m = disc(g, "z", x0 + 2, 8, 4, 8, 32, "steel", 5, n=8)
        P.flat(g, m, "steel", 5)
        P.flat(g, m & (np.abs(Z-9)<1)|(m & (np.abs(Z-31)<1)), "rust", 5)
        return g

    rig = Rig()
    rig.add("conveyor", frame(), (cx, 0, cz))
    for i, x0 in enumerate((7, 19, 31, 43, 55)):
        rig.add(f"roller-{i}", roller(x0), (x0 + 2, 8, cz), "conveyor")
    active = {f"roller-{i}": {"rot": spin(1.2, "z", 360)} for i in range(5)}
    active["conveyor"] = {"loc": wave(1.2, "y", 0.2)}
    return asset("animated-props", "conveyor-belt", "Conveyor Belt", rig.root,
                 clips=[Clip("idle", {}), Clip("active", active)])


def _gravity_lift() -> object:
    S = (44, 88, 44)
    cx, cz = 22, 22

    def shaft() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        base = _solid(g, cx, cz, 18, 0, 5, "iron", 4, 8, 15)
        P.flat(g, base, "iron", 4)
        P.flat(g, base & (Y < 2), "orange", 5)
        for sx in (-1, 1):
            post = box(g, cx + sx * 13 - 2, 5, cz - 2, cx + sx * 13 + 2, 77, cz + 2, "steel", 5)
            P.flat(g, post, "steel", 5)
            P.flat(g, edges(post), "steel", 3)
            P.flat(g, post & (np.floor(Y) % 12 < 2), "orange", 5)
            P.flat(g, post & (np.abs(Z - cz) < 1) & (np.floor(Y) % 8 == 0), "cyan", 6)
            if sx > 0:
                P.flat(g, post & (np.abs(X - (cx + 11)) < 1.5) & (np.abs(Y - 42) < 2.5) & (np.abs(Z - cz) < 2), "cyan", 7)
        for y in (12, 38, 64):
            for sx in (-1, 1):
                box(g, cx + sx * 13 - 3, y, cz - 3, cx + sx * 13 + 3, y + 3, cz + 3, "rust", 4)
        return g

    def platform() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        deck = _solid(g, cx, cz, 15, 39, 45, "bone", 6, 8, 12)
        P.flat(g, deck & (np.hypot(X - cx, Z - cz) > 10), "orange", 5)
        ring = disc(g, "y", cx, cz, 11, 45, 48, "cyan", 6, n=8)
        P.flat(g, ring, "cyan", 7)
        for sx in (-1, 1):
            box(g, cx + sx * 13 - 3, 45, cz - 3, cx + sx * 13 + 3, 52, cz + 3, "steel", 5)
        return g

    rig = Rig()
    rig.add("shaft", shaft(), (cx, 0, cz))
    rig.add("platform", platform(), (cx, 39, cz), "shaft")
    idle = {"platform": {"loc": wave(3.0, "y", 24)}}
    active = {"platform": {"loc": wave(2.4, "y", 25)}}
    sock = rig.sock("socket-beam", (cx + 11, 42, cz), parent="shaft")
    return asset("animated-props", "gravity-lift", "Gravity Lift", rig.root,
                 clips=[Clip("idle", idle), Clip("active", active)], sockets=[sock],
                 pfx=[{"effectId": "rvx-space-teleport-beam", "socket": "socket-beam", "trigger": "clip:active", "size": 40, "aim": [0, 1, 0]}])


def _alien_artifact() -> object:
    S = (44, 52, 44)
    cx, cz = 22, 22

    def pedestal() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        base = _solid(g, cx, cz, 18, 0, 5, "steel", 4, 8, 15)
        P.flat(g, base, "steel", 4)
        P.flat(g, base & (Y < 2), "orange", 5)
        col = _solid(g, cx, cz, 8, 5, 19, "iron", 4, 8, 5)
        P.flat(g, col & (np.abs(X - cx) < 2) & (Y > 8), "cyan", 6)
        for sx in (-1, 1):
            bar(g, "x", (14, 14), (20, 30), 3.0, cx + sx * 9 - 1.5, cx + sx * 9 + 1.5, "rust", 5)
        return g

    def relic() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        solids = gem(g, cx, cz, 19, 10, 24, "purple", 5, n=8, waist=0.28, cap=0.05)
        m = mask_of(g, solids)
        P.flat(g, m, "purple", 5)
        facet_paint(g, solids, lambda gg, mm, fr: P.plates(gg, mm, "purple", 5, size=(8, 6), rivets=False, frame=fr, seed=11))
        P.flat(g, m & (Z < cz - 8) & (np.abs(X - cx) < 3), "cyan", 6)
        P.flat(g, m & (Z < cz - 8) & (Y > 28), "cyan", 7)
        # A broad glow band keeps the gem clear of thin crossing rods.
        P.flat(g, m & (np.abs(Y - 27) < 2) & (np.abs(X - cx) > 6), "cyan", 7)
        return g

    rig = Rig()
    rig.add("pedestal", pedestal(), (cx, 0, cz))
    rig.add("relic", relic(), (cx, 19, cz), "pedestal")
    idle = {"relic": {"rot": spin(12.0, "y", 360)}}
    active = {"relic": {"loc": [(0.0, (0, 0, 0)), (0.45, (0, 3, 0)), (1.0, (0, 0, 0))], "rot": spin(1.0, "y", 360)}}
    sock = rig.sock("socket-pulse", (cx, 31, cz - 8), parent="relic")
    return asset("animated-props", "alien-artifact", "Alien Artifact", rig.root,
                 clips=[Clip("idle", idle), Clip("active", active)], sockets=[sock],
                 pfx=[{"effectId": "rvx-space-holo-scan", "socket": "socket-pulse", "trigger": "clip:active", "size": 18, "aim": [0, 0, -1], "at": 0.45}])


def _escape_pod() -> object:
    S = (48, 56, 64)
    cx, cz = 24, 32

    def capsule() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        body = ngon_y(g, cx, cz, 17, 5, 40, "bone", 6, n=8, r_top=14)
        P.plates(g, body, "bone", 6, size=(9, 8), seed=4)
        P.flat(g, edges(body), "steel", 3)
        P.flat(g, body & (np.abs(Y - 18) < 1.4), "orange", 5)
        P.flat(g, body & (np.abs(Y - 18) < 1.4) & (np.floor(X + Z) % 4 == 0), "iron", 3)
        nose = cone(g, "y", cx, cz, 14, 39, 54, "steel", 5, n=8, r_top=3)
        P.plates(g, nose, "steel", 5, size=(8, 7), seed=5)
        # Dark paint and a raised frame show the entry when the hatch opens.
        entry = body & (Z < cz - 11) & (np.abs(X - cx) < 9) & (Y > 7) & (Y < 33)
        P.flat(g, entry, "iron", 2)
        P.flat(g, entry & (np.abs(X - cx) > 7), "steel", 3)
        for x0 in (cx - 11, cx + 9):
            jamb = box(g, x0, 5, 12, x0 + 2, 35, 18, "steel", 4)
            P.flat(g, jamb & (Z < 14), "orange", 5)
        lintel = box(g, cx - 11, 33, 12, cx + 11, 35, 18, "steel", 4)
        P.flat(g, lintel & (Z < 14), "orange", 5)
        sill = box(g, cx - 11, 5, 12, cx + 11, 7, 18, "steel", 4)
        P.flat(g, sill & (Z < 14), "orange", 5)
        for fx, fz in ((cx - 11, cz - 8), (cx + 11, cz - 8), (cx, cz + 12)):
            foot = box(g, fx - 3, 0, fz - 4, fx + 3, 8, fz + 4, "steel", 4)
            P.flat(g, foot & (Y < 2), "orange", 5)
            vent = cone(g, "y", fx, fz, 4, 0, 8, "rust", 4, n=8, r_top=1.5)
            P.flat(g, vent & (Y < 2), "cyan", 7)
        return g

    def hatch() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        leaf = front(g, [(cx - 10, 7), (cx + 10, 7), (cx + 10, 30), (cx + 7, 33), (cx - 7, 33), (cx - 10, 30)], 10, 13, "steel", 5)
        P.plates(g, leaf, "steel", 5, size=(7, 8), seed=7)
        P.flat(g, edges(leaf), "orange", 5)
        P.flat(g, leaf & (Z < 11) & (np.abs(X - cx) < 5) & (Y > 18), "cyan", 6)
        return g

    rig = Rig()
    rig.add("pod", capsule(), (cx, 0, cz))
    rig.add("hatch", hatch(), (cx, 30, 11), "pod")
    z = (0.0, 0.0, 0.0)
    open_clip = {"hatch": {"rot": [(0.0, z), (0.35, (-30, 0, 0)), (1.0, (-88, 0, 0))]}}
    close_clip = {"hatch": {"rot": [(0.0, (-88, 0, 0)), (0.7, (-6, 0, 0)), (1.0, z)]}}
    move = {"pod": {"loc": [(0.0, (0, 0, 0)), (0.4, (0, 8, 0)),
                             (1.2, (0, 10, 0)), (1.6, (0, 8, 0)), (2.0, (0, 0, 0))],
                    "rot": wave(2.0, "x", 5)}}
    idle = {"pod": {"rot": wave(3.0, "y", 2)}}
    sock = rig.sock("socket-engine", (cx, 3, cz + 16), parent="pod")
    return asset("animated-props", "escape-pod", "Escape Pod", rig.root,
                 clips=[Clip("idle", idle), Clip("open", open_clip, loop=False), Clip("close", close_clip, loop=False), Clip("move", move)],
                 sockets=[sock], pfx=[{"effectId": "rvx-space-engine-exhaust", "socket": "socket-engine", "trigger": "clip:move", "size": 12, "aim": [0, -0.5, 1], "at": 0.2}])


def make_animated(slug: str) -> object:
    builders = {
        "drone-dock": _drone_dock,
        "conveyor-belt": _conveyor_belt,
        "gravity-lift": _gravity_lift,
        "alien-artifact": _alien_artifact,
        "escape-pod": _escape_pod,
    }
    return builders[slug]()


# ---------------------------------------------------------------- buildings
_BUILDINGS = {
    "med-bay": ("MED", "clinic", "bone", "cyan", 68),
    "greenhouse-dome": ("GROW", "greenhouse", "bone", "teal", 74),
    "cantina": ("CANT", "cantina", "orange", "cyan", 64),
    "barracks-pod": ("BARR", "barracks", "steel", "orange", 72),
    "refinery": ("FUEL", "refinery", "iron", "orange", 84),
    "spaceport-terminal": ("PORT", "terminal", "bone", "cyan", 82),
    "alien-temple": ("XENO", "temple", "purple", "lime", 92),
    "cargo-depot": ("CARGO", "depot", "steel", "orange", 76),
    "power-relay": ("GRID", "relay", "steel", "cyan", 104),
}


def _building_grid(slug: str) -> Grid:
    label, form, body_ramp, accent, roof_y = _BUILDINGS[slug]
    W, H, D = 128, 124, 112
    cx, cz = 64, 58
    x0, x1, z0, z1 = 22, 106, 22, 90
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    plinth = plan(g, [(18, 30), (28, 20), (100, 20), (112, 32), (112, 80), (100, 96), (28, 96), (18, 82)], 0, 5, "iron", 4,
                  top=[(22, 31), (30, 25), (98, 25), (106, 34), (106, 78), (98, 90), (30, 90), (22, 80)])
    P.plates(g, plinth, "iron", 4, size=(12, 7), seed=1)
    hazard(g, plinth & (Y < 2), period=5)

    if form in ("clinic", "cantina", "depot"):
        walls = hull_box(g, x0, 5, z0, x1, roof_y - 12, z1, body_ramp, 5, seed=2)
        corner_posts(g, x0, x1, z0, z1, 5, roof_y - 12, size=4, out=1, ramp="steel", base=3)
        if form == "clinic":
            # A low, flat medical roof separates the clinic from the other gabled buildings.
            cap = box(g, x0 - 5, roof_y - 12, z0 - 5, x1 + 5, roof_y, z1 + 5, "bone", 6)
            P.plates(g, cap, "bone", 6, size=(12, 7), seed=3)
            box(g, cx - 22, roof_y, cz - 5, cx + 22, roof_y + 4, cz + 5, "cyan", 6)
            # A compact sloped skylight keeps the clinic profile distinct and
            # preserves the building slope requirement.
            steel_roof(g, cx - 24, cx + 24, cz - 25, cz + 25,
                       roof_y + 4, roof_y + 20, ridge="x", ramp="cyan", base=6,
                       thick=3, overhang=3, gable="bone", ridge_ramp="steel", seed=9)
        else:
            steel_roof(g, x0 - 4, x1 + 4, z0 - 4, z1 + 4, roof_y - 12, roof_y, ridge="x", ramp="steel", base=5, thick=5, seed=3)
    elif form == "barracks":
        hull_box(g, 30, 5, 28, 98, 49, 84, "steel", 5, seed=2)
        corner_posts(g, 30, 98, 28, 84, 5, 49, size=4, out=1, ramp="iron", base=3)
        for px in (38, 64, 90):
            pod = _solid(g, px, 56, 16, 48, 76, "bone", 6, 8, 12)
            P.plates(g, pod, "bone", 6, size=(8, 7), seed=px)
            P.flat(g, pod & (Z < 42) & (np.abs(X - px) < 8) & (Y > 55) & (Y < 68), "cyan", 6)
            P.flat(g, pod & (Y > 70), "orange", 5)
    elif form == "refinery":
        steel_box(g, 28, 5, 28, 100, 58, 84, "iron", 5, seed=2)
        # A large side tank and its raised feed pipe show the refinery's job.
        tank = disc(g, "x", 20, 58, 15, 14, 39, "steel", 5, n=12)
        P.plates(g, tank, "steel", 5, size=(8, 6), seed=7)
        P.flat(g, tank & ((np.abs(X - 16) < 2) | (np.abs(X - 37) < 2)), "rust", 5)
        P.flat(g, tank & (Z < 46) & (Y > 14) & (Y < 28), "cyan", 6)
        pipe(g, [(22, 32, 58), (22, 50, 58), (30, 50, 58), (43, 50, 58)], s=5, ramp="rust", base=5)
        # The front outlet gives the tank a visible loading connection.
        pipe(g, [(20, 22, 44), (20, 15, 44), (20, 15, 37), (20, 10, 37), (20, 10, 34)], s=4, ramp="orange", base=5)
        for px, pz, height in ((40, 38, 91), (66, 60, 108), (88, 42, 82)):
            stack = _solid(g, px, pz, 10, 58, height, "steel", 5, 8, 7)
            P.plates(g, stack, "steel", 5, size=(8, 9), seed=px)
            band(g, stack, 1, height - 7, height - 4, "orange", 6)
            cone(g, "y", px, pz, 9, height, height + 6, "rust", 4, n=8, r_top=6)
        for px in (36, 95):
            box(g, px, 8, 20, px + 6, 55, 26, "rust", 5)
            for py in (18, 31, 44):
                box(g, px - 2, py, 20, px + 8, py + 3, 26, "steel", 4)
    elif form == "terminal":
        hull_box(g, 18, 5, 24, 108, 56, 92, "bone", 6, seed=2)
        steel_box(g, 34, 56, 32, 96, 76, 82, "steel", 5, seed=3)
        steel_roof(g, 14, 112, 20, 96, 56, roof_y, ridge="x", ramp="bone", base=6, thick=5, overhang=6, seed=4)
        tower = _solid(g, 80, 54, 14, 5, 102, "steel", 5, 8, 9)
        P.plates(g, tower, "steel", 5, size=(9, 8), seed=5)
        beacon(g, 80, 102, 54, h=10, lamp=("orange", 7))
        bridge = steel_box(g, 28, 30, 3, 54, 40, 25, "steel", 4, seed=6)
        hazard(g, bridge & (Y < 34), period=4)
    elif form == "temple":
        base = _solid(g, cx, cz, 39, 5, 32, "purple", 5, 8, 34)
        P.plates(g, base, "purple", 5, size=(10, 7), seed=2)
        temple = _solid(g, cx, cz, 31, 32, 65, "steel", 5, 8, 24)
        P.plates(g, temple, "steel", 5, size=(8, 7), seed=3)
        pyramid(g, 28, 22, 100, 94, 64, 26, "purple", 5, apex=(cx, cz), seed=4)
        for px in (42, 64, 86):
            ob = _solid(g, px, 58, 7, 5, 86, "bone", 5, 6, 2)
            P.flat(g, ob & (Z < 52) & (np.abs(X - px) < 3), "lime", 6)
        orb = gem(g, cx, cz - 26, 74, 8, 16, "purple", 5, n=8, cap=0.1)
        P.flat(g, mask_of(g, orb), "purple", 5)
        P.flat(g, mask_of(g, orb) & (Z < cz - 31), "lime", 7)
    elif form == "relay":
        hull_box(g, 34, 5, 32, 94, 48, 84, "steel", 5, seed=2)
        tower = _solid(g, cx, cz, 23, 48, 97, "iron", 5, 8, 13)
        P.plates(g, tower, "iron", 5, size=(8, 9), seed=3)
        for y0, y1, r in ((65, 69, 32), (80, 84, 29)):
            ring = disc(g, "y", cx, cz, r, y0, y1, "rust", 5, n=8)
            P.plates(g, ring, "rust", 5, size=(8, 4), seed=y0)
            P.flat(g, ring & (np.floor(X + Z) % 5 == 0), "cyan", 6)
        for sx in (-1, 1):
            bar(g, "x", (45, 56), (cx + sx * 4, 104), 3, cx + sx * 17 - 2, cx + sx * 17 + 2, "steel", 5)
        mast = box(g, cx - 3, 96, cz - 3, cx + 3, 117, cz + 3, "rust", 5)
        P.flat(g, mast & (np.floor(Y) % 4 == 0), "cyan", 7)
    elif form == "greenhouse":
        drum = _solid(g, cx, cz, 38, 5, 20, "steel", 5, 12, 32)
        P.plates(g, drum, "steel", 5, size=(8, 7), seed=2)
        shell = dome(g, cx, cz, 20, 34, 52, n=12, rings=5, ramp="bone", base=6, ribs=("steel", 3))
        P.plates(g, shell, "bone", 6, size=(11, 9), seed=3)
        # Use opaque cyan panels and open framed bays. The open bays expose the
        # crop rows without adding a transparent material.
        panes = shell & (Z < cz - 10) & (Y > 25) & (np.abs(X - cx) < 27)
        P.flat(g, panes, "cyan", 6)
        P.flat(g, panes & (Y > 36) & (np.floor(Y) % 8 < 2), "teal", 5)
        P.flat(g, panes & ((np.abs(X - (cx - 16)) < 1.7) | (np.abs(X - cx) < 1.7) | (np.abs(X - (cx + 16)) < 1.7)), "steel", 5)
        P.flat(g, panes & ((Y < 28) | (Y > 45)), "steel", 4)
        for px in (48, 64, 80):
            bay = panes & (np.abs(X - px) < 3.6) & (Y > 30) & (Y < 44)
            g.a[bay] = 0
        for px in (45, 64, 83):
            planter = box(g, px - 5, 5, 48, px + 5, 10, 68, "iron", 4)
            P.flat(g, planter & (Y > 8), "teal", 5)
            for dx in (-3, 0, 3):
                bar(g, "z", (px + dx, 14), (px + dx + (1 if dx == 0 else -1), 46), 2.2, 57, 59, "lime", 6)
        # Two front beds and opaque cyan panels make the greenhouse use read
        # at native scale. The panels use the one opaque palette material.
        for px in (46, 82):
            frame = box(g, px - 7, 25, 30, px + 7, 46, 39, "steel", 4)
            P.flat(g, edges(frame), "steel", 3)
            pane = box(g, px - 5, 27, 24, px + 5, 44, 31, "cyan", 6)
            P.flat(g, pane & (Y > 38), "teal", 5)
        for px in (34, 94):
            planter = box(g, px - 8, 5, 19, px + 8, 11, 31, "iron", 4)
            P.flat(g, planter & (Y > 8), "teal", 6)
            for dx in (-4, 0, 4):
                bar(g, "z", (px + dx, 12), (px + dx + (1 if dx == 0 else -1), 37), 2.5, 21, 26, "lime", 7)
                if dx != 0:
                    bar(g, "z", (px + dx, 22), (px, 28), 3.2, 20, 27, "teal", 6)
        steel_roof(g, 42, 86, 2, 20, 38, 57, ridge="x", ramp="steel", base=4, thick=3, overhang=0, seed=6)
    else:
        # cantina: deep awning, wide gable and a rooftop dish.
        walls = hull_box(g, x0, 5, z0, x1, 50, z1, "orange", 5, seed=2)
        corner_posts(g, x0, x1, z0, z1, 5, 50, size=4, out=1, ramp="steel", base=3)
        roof = steel_roof(g, x0 - 5, x1 + 5, z0 - 5, z1 + 5, 50, roof_y, ridge="x", ramp="steel", base=5, thick=5, seed=3)
        P.flat(g, roof["slabs"] & (Y > 51), "orange", 5)
        for px in (34, 94):
            box(g, px - 3, 50, 7, px + 3, 57, 33, "rust", 5)

    if form not in ("temple", "relay", "refinery", "greenhouse"):
        # A full-height entry and two broad, lit windows keep each frontage readable.
        blast_door(g, "-z", z0, cx - 12, cx + 12, 5, 33, seed=8)
        for px in (x0 + 13, x1 - 25):
            window(g, "-z", z0, px, px + 13, 24, 42, bar=False)
    if form == "clinic":
        # A dark board makes the MED sign read against the white wall.
        sign(g, "-z", z0 - 5, cx, roof_y - 10, "MED", board=("iron", 3), ink=("cyan", 7), scale=2, pad=4)
        # An upper window row, windows on both sides, a red-cross panel on
        # +x and a vent and pipe run on the rear give every face detail.
        for px in (x0 + 13, x1 - 25):
            window(g, "-z", z0, px, px + 13, 46, 53, bar=False)
        for face, plane in (("-x", x0), ("+x", x1)):
            for zc in (34, 70):
                window(g, face, plane, zc, zc + 12, 22, 36, bar=False)
                window(g, face, plane, zc, zc + 12, 44, 52, bar=False)
        for xa, xb in ((x0 - 2, x0), (x1, x1 + 2)):
            for u0, u1, v0, v1 in ((54, 62, 24, 50), (49, 67, 33, 41)):
                panel = box(g, xa, v0, u0, xb, v1, u1, "red", 5)
                P.flat(g, panel, "red", 5)
                P.flat(g, panel & (Y > v1 - 1.5), "red", 6)
        for px in (36, 80):
            window(g, "+z", z1, px, px + 12, 22, 36, bar=False)
        vent = box(g, 56, 30, z1, 72, 46, z1 + 4, "steel", 4)
        P.plates(g, vent, "steel", 4, size=(4, 4), seed=21)
        P.flat(g, vent & (np.floor(Y) % 3 == 0), "iron", 3)
        pipe(g, [(52, 6, z1 + 2), (52, 50, z1 + 2), (100, 50, z1 + 2), (100, 6, z1 + 2)], s=3, ramp="rust", base=4)
        # A comm mast on one roof end breaks the symmetric box (F5).
        mast = box(g, x0 + 2, roof_y, z0 + 4, x0 + 5, roof_y + 22, z0 + 7, "steel", 4)
        P.flat(g, mast & (np.floor(Y) % 6 < 2), "orange", 5)
        beacon(g, x0 + 3, roof_y + 22, z0 + 5, h=3, lamp=("red", 6))
    elif form == "greenhouse":
        sign(g, "-z", z0 - 1, cx, 26, label, board=("steel", 5), ink=("lime", 7), scale=2)
    elif form == "cantina":
        sign(g, "-z", z0 - 1, cx, 53, label, board=("iron", 5), ink=("cyan", 7), scale=2)
        # Oversized roof dish: its white bowl and copper feed read at thumbnail size.
        dish = cone(g, "z", cx, roof_y + 1, 18, z0 - 9, z0 - 3, "bone", 6, n=12, r_top=6)
        P.flat(g, dish & (Z < z0 - 7), "bone", 7)
        P.flat(g, dish & (Z < z0 - 7) & (np.hypot(X - cx, Y - (roof_y + 1)) < 4), "cyan", 6)
        for sx in (-1, 1):
            bar(g, "y", (cx + sx * 16, z0 - 5), (cx + sx * 2, z0 - 6), 2.2, roof_y - 4, roof_y - 1, "steel", 5)
    elif form == "barracks":
        sign(g, "-z", z0 - 1, cx, 36, label, board=("orange", 5), ink=("bone", 7), scale=2)
    elif form == "refinery":
        # A 24 x 28 blast door under the FUEL sign, and a window row, a pipe
        # rack and a service hatch on the rear face.
        blast_door(g, "-z", 28, cx - 12, cx + 12, 5, 33, seed=8)
        sign(g, "-z", 27, cx, 39, label, board=("iron", 5), ink=("orange", 7), scale=2)
        for px in (34, 56, 78):
            window(g, "+z", 84, px, px + 12, 32, 44, bar=False)
        blast_door(g, "+z", 84, 40, 58, 5, 31, seed=9)
        pipe(g, [(66, 22, 88), (98, 22, 88)], s=4, ramp="rust", base=4)
        pipe(g, [(66, 14, 88), (98, 14, 88)], s=3, ramp="orange", base=5)
        for px in (68, 96):
            box(g, px - 1, 5, 87, px + 1, 24, 89, "steel", 3)
    elif form == "terminal":
        sign(g, "-z", 22, cx, 78, label, board=("steel", 5), ink=("cyan", 7), scale=2)
    elif form == "temple":
        sign(g, "-z", 21, cx, 46, label, board=("purple", 5), ink=("lime", 7), scale=2)
    elif form == "depot":
        sign(g, "-z", z0 - 1, cx, roof_y - 23, label, board=("steel", 5), ink=("orange", 7), scale=2)
        # The raised four-post gantry gives the cargo depot a crane silhouette.
        for sx in (-1, 1):
            for sz in (-1, 1):
                box(g, cx + sx * 30 - 2, roof_y - 2, cz + sz * 24 - 2,
                    cx + sx * 30 + 2, roof_y + 19, cz + sz * 24 + 2, "steel", 5)
        for sz in (-1, 1):
            box(g, cx - 32, roof_y + 15, cz + sz * 24 - 2,
                cx + 32, roof_y + 19, cz + sz * 24 + 2, "rust", 5)
        for sx in (-1, 1):
            box(g, cx + sx * 30 - 2, roof_y + 15, cz - 26,
                cx + sx * 30 + 2, roof_y + 19, cz + 26, "steel", 5)
        box(g, cx - 9, roof_y + 12, cz - 7, cx + 9, roof_y + 16, cz + 7, "orange", 6)
        hook = box(g, cx - 3, roof_y + 2, cz - 3, cx + 3, roof_y + 12, cz + 3, "orange", 6)
        P.flat(g, hook & (np.floor(Y) % 3 == 0), "steel", 4)
    elif form == "relay":
        sign(g, "-z", 32, cx, 29, label, board=("iron", 5), ink=("cyan", 7), scale=2)

    # Three ground props satisfy the shop-yard recipe and add scale cues.
    crate(g, 22, 5, 10, 11, "orange", 5, stripe=("cyan", 6))
    crate(g, 39, 5, 12, 9, "steel", 5, stripe=("orange", 6))
    fuel_drum(g, 100, 14, 5, h=15, r=11, ramp="orange", icon="star")
    beacon(g, 103, 5, 86, h=13, lamp=("orange", 7))
    # Add an accent band around the lower body after large surfaces are set.
    facade = (Y > 8) & (Y < 12) & (X > 24) & (X < 104) & (Z > 24) & (Z < 88) & (g.a != 0)
    P.flat(g, facade, accent, 5)
    return g


def make_building(slug: str) -> object:
    label = _BUILDINGS[slug][0]
    g = _building_grid(slug)
    root = Part(f"{slug}-body", g, pivot=(64, 0, 56))
    clips = []
    return asset("buildings", slug, label.title() + (" Greenhouse" if slug == "greenhouse-dome" else ""), root, clips=clips)


# ---------------------------------------------------------------- terrain
def _comet() -> Grid:
    g = Grid(96, 54, 108)
    X, Y, Z = coords(g)
    cx, cz = 48, 34
    tail = plan(g, [(cx - 14, cz + 5), (cx - 9, cz - 5), (cx + 17, 8), (cx + 11, 1)], 9, 20,
                "cyan", 5, top=[(cx - 9, cz + 3), (cx - 6, cz - 3), (cx + 10, 10), (cx + 7, 6)])
    P.flat(g, tail, "cyan", 5)
    P.flat(g, tail & (np.floor(X + Z) % 7 == 0), "bone", 6)
    solids = rock(g, cx, cz, 8, 19, 28, "bone", 5, n=8, seed=7, lean=(-2, 1), squash=0.82)
    m = mask_of(g, solids)
    P.plates(g, m, "bone", 5, size=(9, 8), seed=8)
    P.flat(g, m & ((Z - cz) > 7), "steel", 4)
    P.flat(g, m & (np.abs(Y - (19 + 0.22 * (X - cx))) < 1.2), "orange", 5)
    for dx, dy, r in ((-6, 22, 2.2), (6, 17, 1.6), (0, 30, 1.4)):
        mark = m & (np.hypot(X - (cx + dx), Y - dy) < r) & (Z < cz - 12)
        P.flat(g, mark, "iron", 3)
    return g


def _alien_mushrooms() -> Grid:
    g = Grid(88, 48, 80)
    X, Y, Z = coords(g)
    ground = plan(g, [(8, 18), (18, 5), (69, 6), (80, 20), (72, 70), (20, 75), (7, 55)], 0, 4,
                  "purple", 4, top=[(12, 20), (20, 10), (66, 11), (75, 22), (68, 65), (22, 69), (11, 53)])
    P.plates(g, ground, "purple", 4, size=(11, 8), seed=1)
    for k, (mx, mz, sh, cap_r) in enumerate(((25, 32, 23, 15), (51, 45, 31, 19), (64, 22, 17, 12))):
        stem = cone(g, "y", mx, mz, cap_r * 0.34, 3, sh, "bone", 5, n=8, r_top=cap_r * 0.22)
        P.plates(g, stem, "bone", 5, size=(6, 5), seed=k + 2)
        P.flat(g, stem & (Y < sh * 0.55) & (np.abs(X - mx) < 1), "teal", 5)
        cap = dome(g, mx, mz, sh - 2, cap_r, 10, n=10, rings=4, ramp="magenta", base=5, ribs=("purple", 3))
        P.plates(g, cap, "magenta", 5, size=(7, 5), seed=k + 7)
        P.flat(g, cap & (Y < sh + 2) & (np.floor(X + Z) % 7 == 0), "pink", 6)
        P.flat(g, cap & (Y < sh + 1) & (np.abs(np.hypot(X - mx, Z - mz) - cap_r * 0.72) < 1), "lime", 6)
        P.flat(g, cap & (Z < mz - cap_r * 0.55) & (Y > sh + 2), "cyan", 6)
    return g


def _basalt_columns() -> Grid:
    g = Grid(80, 78, 76)
    X, Y, Z = coords(g)
    ground = plan(g, [(7, 22), (18, 8), (63, 6), (73, 24), (68, 62), (23, 69), (8, 58)], 0, 4,
                  "iron", 4, top=[(11, 23), (20, 13), (60, 11), (69, 25), (64, 57), (24, 64), (12, 54)])
    P.plates(g, ground, "iron", 4, size=(10, 7), seed=4)
    columns = [(21, 22, 46, 8), (37, 20, 67, 9), (53, 22, 53, 8), (28, 48, 40, 7), (47, 49, 58, 7), (62, 43, 35, 6)]
    for k, (cx, cz, h, r) in enumerate(columns):
        bot = ngon_y(g, cx, cz, r, 3, h, "steel", 4, n=6, r_top=r * 0.78)
        P.plates(g, bot, "steel", 4, size=(8, 7), seed=k + 1)
        P.flat(g, bot & (np.floor(Y) % 8 < 2), "iron", 3)
        P.flat(g, bot & (np.abs(X - cx) < 1.1) & (Z < cz - r * 0.55), "bone", 5)
        cap = ngon_y(g, cx + (1 if k % 2 else -1), cz, r * 0.62, h - 2, h + 2, "iron", 5, n=5, r_top=r * 0.4)
        P.flat(g, cap & (Y > h), "steel", 4)
    # A white mineral seam ties the clustered basalt faces together.
    seam = (g.a != 0) & (Y > 17) & (Y < 20) & (np.abs((X - 40) - 0.5 * (Z - 36)) < 1.2)
    P.flat(g, seam, "bone", 6)
    return g


def _crystal_spires() -> Grid:
    g = Grid(76, 84, 76)
    X, Y, Z = coords(g)
    mound = rock(g, 38, 39, 0, 25, 18, "steel", 4, n=8, seed=12, squash=0.85)
    mm = mask_of(g, mound)
    P.plates(g, mm, "steel", 4, size=(10, 7), seed=12)
    specs = [(28, 30, 10, 64, "cyan"), (48, 39, 9, 78, "magenta"), (39, 53, 8, 58, "purple"), (19, 48, 6, 44, "cyan"), (58, 24, 6, 50, "magenta")]
    for k, (cx, cz, r, h, ramp) in enumerate(specs):
        c = cone(g, "y", cx, cz, r, 10, h, ramp, 6, n=6, r_top=0.7)
        P.flat(g, c, ramp, 5)
        P.flat(g, c & (X < cx), "bone", 6)
        P.flat(g, c & (X > cx + r * 0.45), ramp, 7)
        P.flat(g, c & (np.abs(X - cx) < 1) & (Y > h * 0.55), "cyan", 7)
    return g


def _meteor_boulder() -> Grid:
    g = Grid(78, 58, 76)
    X, Y, Z = coords(g)
    apron = plan(g, [(5, 25), (18, 7), (55, 5), (72, 21), (67, 58), (20, 69), (7, 53)], 0, 3,
                 "sand", 4, top=[(10, 25), (20, 12), (54, 11), (67, 23), (62, 53), (21, 64), (12, 50)])
    P.plates(g, apron, "sand", 4, size=(10, 8), seed=2)
    P.flat(g, apron & (Y < 1), "iron", 3)
    b = rock(g, 39, 37, 2, 18, 36, "iron", 5, n=7, seed=17, lean=(3, -3), squash=0.78)
    m = mask_of(g, b)
    P.plates(g, m, "iron", 5, size=(8, 7), seed=17)
    P.flat(g, m & (np.abs(Y - (17 + 0.35 * (X - 39))) < 1.1), "orange", 6)
    P.flat(g, m & (np.abs(X - 45 - 0.25 * (Y - 20)) < 0.9) & (Y > 17), "gold", 6)
    for sx, sz, r in ((20, 35, 4), (58, 47, 5), (24, 56, 3)):
        chip = rock(g, sx, sz, 2, r, 7, "steel", 4, n=6, seed=sx)
        P.plates(g, mask_of(g, chip), "steel", 4, size=(6, 5), seed=sz)
    return g


def _alien_coral() -> Grid:
    g = Grid(84, 68, 84)
    X, Y, Z = coords(g)
    base = plan(g, [(9, 23), (22, 9), (61, 7), (76, 24), (70, 67), (18, 73), (6, 54)], 0, 5,
                "teal", 4, top=[(14, 25), (23, 15), (59, 13), (70, 27), (64, 62), (20, 68), (12, 52)])
    P.plates(g, base, "teal", 4, size=(9, 7), seed=3)
    # Branches taper as they fork. All members use real diagonal prisms.
    paths = [((42, 5), (42, 42), 7, "teal"), ((42, 25), (25, 58), 5, "magenta"),
             ((42, 31), (60, 57), 5, "cyan"), ((42, 39), (34, 65), 4, "purple"),
             ((29, 30), (18, 48), 4, "cyan"), ((56, 34), (68, 46), 4, "magenta")]
    for k, (p0, p1, thick, ramp) in enumerate(paths):
        branch = bar(g, "z", p0, p1, thick, 36 - thick / 2, 36 + thick / 2, ramp, 5)
        P.flat(g, branch, ramp, 5)
        P.flat(g, branch & (np.floor(Y) % 7 == 0), "bone", 6)
        tip = cone(g, "y", p1[0], 39, thick * 0.7, p1[1] - 3, p1[1] + 3, "lime", 6, n=6, r_top=1)
        P.flat(g, tip, "lime", 6)
    # Fan-shaped side plates make this read as reef, not a tree.
    for s in (-1, 1):
        for y0, dx in ((16, 10), (25, 15), (34, 12)):
            front(g, [(42, y0), (42 + s * dx, y0 + 5), (42 + s * (dx + 7), y0 + 10),
                      (42 + s * dx, y0 + 7), (42, y0 + 9)], 36, 42, "magenta", 5)
    return g


def _ice_shards() -> Grid:
    g = Grid(78, 70, 78)
    X, Y, Z = coords(g)
    ground = plan(g, [(7, 24), (20, 8), (57, 8), (71, 26), (65, 64), (22, 70), (8, 54)], 0, 5,
                  "cyan", 4, top=[(12, 24), (22, 13), (55, 13), (66, 28), (61, 59), (24, 65), (13, 52)])
    P.plates(g, ground, "cyan", 4, size=(11, 8), seed=4)
    P.flat(g, ground & (Y < 2), "steel", 3)
    for k, (cx, cz, r, h) in enumerate(((22, 31, 8, 61), (40, 46, 10, 68), (56, 31, 8, 54), (33, 20, 6, 43), (60, 54, 5, 40))):
        shard = cone(g, "y", cx, cz, r, 4, h, "bone", 7, n=6, r_top=0.5)
        P.flat(g, shard, "bone", 6)
        P.flat(g, shard & (X > cx + r * 0.2), "cyan", 6)
        P.flat(g, shard & (X < cx - r * 0.25), "cyan", 7)
        P.flat(g, shard & (np.abs(Z - cz) < 1.1) & (Y > h * 0.48), "teal", 6)
    for sx, sz in ((18, 52), (54, 14), (66, 42)):
        mark = ground & (np.hypot(X - sx, Z - sz) < 4) & (Y > 3)
        P.flat(g, mark, "cyan", 7)
    return g


def _alien_cactus() -> Grid:
    g = Grid(74, 82, 74)
    X, Y, Z = coords(g)
    ground = plan(g, [(8, 24), (19, 9), (57, 8), (68, 26), (66, 60), (22, 68), (7, 53)], 0, 5,
                  "sand", 4, top=[(12, 23), (21, 14), (55, 13), (64, 28), (61, 56), (23, 63), (12, 51)])
    P.plates(g, ground, "sand", 4, size=(10, 8), seed=5)
    main = cone(g, "y", 38, 38, 12, 4, 68, "teal", 5, n=8, r_top=7)
    P.plates(g, main, "teal", 5, size=(7, 8), seed=6)
    P.flat(g, main & (np.abs(X - 38) < 1.2), "lime", 6)
    P.flat(g, main & (Z < 29) & (np.floor(Y) % 6 < 2), "teal", 3)
    for s, y0, y1, dx in ((-1, 29, 54, 19), (1, 36, 60, 17)):
        arm = front(g, [(38, y0), (38 + s * 5, y0 + 3), (38 + s * dx, y0 + 18),
                        (38 + s * (dx + 5), y0 + 18), (38 + s * 5, y0 + 9)], 35, 41, "teal", 5)
        P.plates(g, arm, "teal", 5, size=(6, 8), seed=8 + s)
        top = cone(g, "y", 38 + s * dx, 38, 7, y0 + 15, y1, "teal", 5, n=8, r_top=5)
        P.flat(g, top, "teal", 6)
        for yy in (y0 + 8, y0 + 17, y0 + 25):
            for dz in (-1, 1):
                thorn = front(g, [(38 + s * (dx - 2), yy), (38 + s * (dx - 7), yy + 4),
                                  (38 + s * (dx - 3), yy + 2)], 38 + dz * 5 - 1, 38 + dz * 5 + 1, "bone", 6)
                P.flat(g, thorn, "bone", 7)
    blossom = cone(g, "y", 38, 38, 5, 66, 79, "magenta", 6, n=8, r_top=1)
    P.flat(g, blossom & (Y > 74), "lime", 7)
    return g


def _lava_vent() -> Grid:
    g = Grid(72, 54, 72)
    X, Y, Z = coords(g)
    mound = rock(g, 36, 36, 0, 30, 30, "iron", 4, n=9, seed=24, squash=0.92)
    m = mask_of(g, mound)
    P.plates(g, m, "iron", 4, size=(10, 7), seed=24)
    # A stepped black rim frames the open vent. The crater uses a flat annulus.
    crater = disc(g, "y", 36, 36, 14, 22, 26, "steel", 3, n=10)
    P.flat(g, crater, "steel", 3)
    inner = disc(g, "y", 36, 36, 10, 19, 23, "orange", 5, n=10)
    P.flat(g, inner, "orange", 5)
    P.flat(g, inner & (np.hypot(X - 36, Z - 36) < 6), "gold", 7)
    for k, a in enumerate(np.linspace(0, 2 * math.pi, 7)[:-1]):
        px, pz = 36 + 22 * math.cos(a), 36 + 22 * math.sin(a)
        shard = cone(g, "y", px, pz, 5, 15, 32 + (k % 2) * 4, "iron", 4, n=6, r_top=2)
        P.flat(g, shard, "iron", 4)
        P.flat(g, shard & (np.abs(X - px) < 2), "orange", 6)
    for k in range(3):
        lava = front(g, [(30 + k * 4, 20), (33 + k * 4, 20), (38 + k * 4, 4), (34 + k * 4, 4)], 8 + 4 * k, 12 + 4 * k, "orange", 5)
        P.flat(g, lava & (np.floor(Y) % 4 == 0), "gold", 7)
    return g


_TERRAIN = {
    "comet": ("Comet", _comet),
    "alien-mushrooms": ("Alien Mushrooms", _alien_mushrooms),
    "basalt-columns": ("Basalt Columns", _basalt_columns),
    "crystal-spires": ("Crystal Spires", _crystal_spires),
    "meteor-boulder": ("Meteor Boulder", _meteor_boulder),
    "alien-coral": ("Alien Coral", _alien_coral),
    "ice-shards": ("Ice Shards", _ice_shards),
    "alien-cactus": ("Alien Cactus", _alien_cactus),
    "lava-vent": ("Lava Vent", _lava_vent),
}


def make_terrain(slug: str) -> object:
    name, builder = _TERRAIN[slug]
    g = builder()
    root = Part(f"{slug}-terrain", g, pivot=(g.shape[0] / 2, 0, g.shape[2] / 2))
    return asset("terrain-nature", slug, name, root)


# ---------------------------------------------------------------- creatures
def _humanoid_creature(slug: str, kind: str) -> object:
    factor = 0.62
    if kind == "brute":
        S, cx, cz, half, skin, shell, accent = (50, 43, 54), 25, 27, 11, "purple", "steel", "orange"
        head_w, arm_w = 10, 5
    elif kind == "psionic":
        S, cx, cz, half, skin, shell, accent = (50, 43, 50), 25, 25, 9, "magenta", "purple", "cyan"
        head_w, arm_w = 9, 4
    else:
        S, cx, cz, half, skin, shell, accent = (48, 43, 48), 24, 24, 9, "teal", "bone", "cyan"
        head_w, arm_w = 8, 4

    def torso() -> Grid:
        g = _ScaledYGrid(*S, factor)
        X, Y, Z = _coords_design_y(g, factor)
        w = half - 2
        body = front(g, [(cx - w, 21), (cx + w, 21), (cx + w + 2, 28), (cx + w - 1, 39),
                         (cx + 5, 42), (cx - w + 1, 39), (cx - w - 2, 28)], cz - 9, cz + 10, skin, 5)
        P.plates(g, body, skin, 5, size=(7, 8), seed=2)
        P.flat(g, edges(body), skin, 3)
        chest = front(g, [(cx - w + 2, 22), (cx + w - 2, 22), (cx + w - 3, 35), (cx, 39), (cx - w + 3, 35)], cz - 11, cz - 8, shell, 6)
        P.plates(g, chest, shell, 6, size=(7, 6), seed=3)
        P.flat(g, chest & (np.abs(X - cx) < 1.4), accent, 6)
        P.flat(g, chest & (np.abs(X - cx) < 1.4) & (Y > 31), accent, 7)
        P.flat(g, body & (np.abs(Y - 17) < 1.2), "iron", 3)
        if kind == "brute":
            for sx in (-1, 1):
                shoulder = cone(g, "y", cx + sx * 15, cz, 7, 34, 45, "orange", 5, n=6, r_top=2)
                P.flat(g, shoulder, "orange", 5)
            hazard(g, chest & (Y < 25), period=4)
        elif kind == "scout":
            pack = _box_design_y(g, factor, cx - 11, 23, cz + 8, cx + 11, 37, cz + 14, "steel", 5)
            P.plates(g, pack, "steel", 5, size=(6, 7), seed=4)
            for sx in (-1, 1):
                P.flat(g, pack & (np.abs(X - (cx + sx * 8)) < 2), "orange", 6)
        else:
            robe = front(g, [(cx - 8, 23), (cx + 8, 23), (cx + 3, 5), (cx - 3, 5)], cz - 8, cz + 9, "purple", 5)
            P.flat(g, robe & (np.floor(X + Y) % 8 == 0), "magenta", 6)
        return g

    def head() -> Grid:
        g = _ScaledYGrid(*S, factor)
        X, Y, Z = _coords_design_y(g, factor)
        y0 = 39 if kind != "psionic" else 40
        h = front(g, [(cx - head_w, y0), (cx + head_w, y0), (cx + head_w + 1, y0 + 9),
                      (cx + head_w - 2, y0 + 17), (cx + 4, y0 + 21), (cx - head_w + 2, y0 + 17),
                      (cx - head_w - 1, y0 + 9)], cz - 9, cz + 4, skin, 5)
        P.plates(g, h, skin, 5, size=(6, 5), seed=5)
        P.flat(g, edges(h), shell, 3)
        face = h & (Z < cz - 7) & (Y > y0 + 5) & (Y < y0 + 13)
        P.flat(g, face, "iron", 3)
        if kind == "brute":
            P.flat(g, face & (np.abs(X - cx) < 6), "orange", 5)
            for sx in (-1, 1):
                tusk = cone(g, "y", cx + sx * 6, cz - 2, 3, y0 - 1, y0 + 8, "bone", 7, n=6, r_top=0, tip="lo")
                P.flat(g, tusk, "bone", 7)
            P.flat(g, face & ((np.abs(X - (cx - 4)) < 1.7) | (np.abs(X - (cx + 4)) < 1.7)), "cyan", 6)
        else:
            P.flat(g, face, "navy", 2)
            P.flat(g, face & (Y > y0 + 8) & (Y < y0 + 11), accent, 7)
            P.flat(g, face & (Y > y0 + 8) & (Y < y0 + 11) & (np.abs(X - cx) < 2), "bone", 7)
        if kind == "psionic":
            for dx in (-5, 0, 5):
                p = cone(g, "y", cx + dx, cz, 3, y0 + 17, y0 + 23, "gold", 6, n=6, r_top=0)
                P.flat(g, p, "gold", 6)
        else:
            for sx in (-1, 1):
                horn = front(g, [(cx + sx * head_w, y0 + 13), (cx + sx * (head_w + 7), y0 + 17),
                                 (cx + sx * (head_w + 10), y0 + 25), (cx + sx * (head_w + 4), y0 + 21)], cz - 1, cz + 2, shell, 5)
                P.flat(g, horn, shell, 6)
        return g

    def arm(s: int) -> Grid:
        g = _ScaledYGrid(*S, factor)
        X, Y, Z = _coords_design_y(g, factor)
        x0 = cx + s * (half + arm_w + 2)
        m = front(g, [(cx + s * (half - 1), 36), (x0 + s * 3, 36),
                      (x0 + s * 6, 25), (x0 + s * 7, 12),
                      (x0 + s * 2, 10), (x0 + s * 1, 24)],
                  cz - 6, cz + 6, skin, 5)
        P.plates(g, m, skin, 5, size=(6, 7), seed=9 + s)
        P.flat(g, edges(m), shell, 3)
        guard = m & (Y > 23) & (Y < 32)
        P.plates(g, guard, shell, 6, size=(5, 5), seed=10 + s)
        P.flat(g, m & (Y < 12) & (np.abs(X - x0) < arm_w), accent, 5)
        return g

    def leg(s: int) -> Grid:
        g = _ScaledYGrid(*S, factor)
        X, Y, Z = _coords_design_y(g, factor)
        x0 = cx + s * 7
        m = front(g, [(x0 - 3, 23), (x0 + 3, 23), (x0 + 3, 8), (x0 + 4, 2),
                      (x0 - 4, 2), (x0 - 3, 8)], cz - 7, cz + 7, shell, 5)
        P.plates(g, m, shell, 5, size=(5, 6), seed=13 + s)
        P.flat(g, m & (Y < 5), "iron", 3)
        P.flat(g, m & (np.abs(X - x0) < 1.5) & (Y > 8), accent, 5)
        return g

    rig = Rig()
    rig.group("actor", (cx, 0, cz))
    rig.add("body", torso(), (cx, 15 * factor, cz), "actor")
    rig.add("head", head(), (cx, 39 * factor, cz - 4), "body")
    rig.add("arm-l", arm(-1), (cx - half, 34 * factor, cz), "body")
    rig.add("arm-r", arm(1), (cx + half, 34 * factor, cz), "body")
    rig.add("leg-l", leg(-1), (cx - half * 0.55, 18 * factor, cz), "body")
    rig.add("leg-r", leg(1), (cx + half * 0.55, 18 * factor, cz), "body")
    if kind == "psionic":
        orb = _ScaledYGrid(*S, factor)
        solids = gem(orb, cx + 15, cz - 1, 46, 5.5, 17, "cyan", 6, n=8, cap=0.1)
        om = mask_of(orb, solids)
        P.flat(orb, om, "cyan", 6)
        P.flat(orb, om & (_coords_design_y(orb, factor)[2] < cz - 5), "bone", 7)
        rig.add("orb", orb, (cx + 15, 49 * factor, cz - 1), "body")

    z = (0.0, 0.0, 0.0)
    idle = {"head": {"rot": wave(2.4, "y", 4)}, "body": {"loc": wave(2.4, "y", 0.35 * factor)},
            "arm-l": {"rot": wave(2.4, "z", 3, phase=1.0)}, "arm-r": {"rot": wave(2.4, "z", 3, phase=2.2)}}
    move = {"arm-l": {"rot": wave(0.9, "x", 26)}, "arm-r": {"rot": wave(0.9, "x", -26)},
            "leg-l": {"rot": wave(0.9, "x", -24)}, "leg-r": {"rot": wave(0.9, "x", 24)},
            "body": {"loc": wave(0.9, "y", 0.8 * factor)}}
    attack = {"body": {"rot": [(0.0, z), (0.2, (-8, 0, 0)), (0.45, (12, 0, 0)), (0.8, z)]},
              "arm-r": {"rot": [(0.0, z), (0.25, (-8, 0, -38)), (0.5, (26, 0, 8)), (0.8, z)],
                        "loc": [(0.0, z), (0.25, (0, 1, 2)), (0.5, (0, -1, -2)), (0.8, z)]}}
    hit = {"body": {"rot": [(0.0, z), (0.1, (8, 0, 12)), (0.5, z)],
                    "loc": [(0.0, z), (0.1, (0, 0, 2)), (0.5, z)]},
           "head": {"rot": [(0.0, z), (0.1, (8, 0, -8)), (0.5, z)]}}
    death = {"body": {"rot": [(0.0, z), (0.4, (0, 0, 28)), (1.0, (0, 0, 84))],
                      "loc": [(0.0, z), (1.0, (0, -9 * factor, 0))]},
             "head": {"rot": [(0.0, z), (1.0, (25, 0, 0))]},
             "arm-l": {"rot": [(0.0, z), (1.0, (0, 0, 32))]},
             "arm-r": {"rot": [(0.0, z), (1.0, (0, 0, -32))]}}
    sockets = []
    pfx = []
    if kind == "scout":
        sockets.append(rig.sock("socket-ray", (cx + 13, 27 * factor, cz - 6), parent="arm-r"))
        pfx.append({"effectId": "rvx-space-ray-zap", "socket": "socket-ray", "trigger": "clip:attack", "size": 10, "aim": [0, 0, -1], "at": 0.52})
    elif kind == "brute":
        sockets.append(rig.sock("socket-impact", (cx + 20, 5 * factor, cz - 3), parent="arm-r"))
        pfx.append({"effectId": "rvx-space-gravity-slam", "socket": "socket-impact", "trigger": "clip:attack", "size": 18, "aim": [0, -1, 0], "at": 0.5})
    else:
        sockets.append(rig.sock("socket-psionic", (cx + 15, 54 * factor, cz - 6), parent="orb"))
        pfx.append({"effectId": "rvx-space-teleport-beam", "socket": "socket-psionic", "trigger": "clip:attack", "size": 15, "aim": [0, 0, -1], "at": 0.5})
    clips = [Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)]
    return asset("creatures", slug, slug.replace("-", " ").title(), rig.root, clips=clips, sockets=sockets, pfx=pfx)


def _crystal_golem() -> object:
    S, cx, cz = (76, 84, 72), 38, 36

    def body() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        torso = front(g, [(cx-14,25),(cx+14,25),(cx+18,49),(cx+11,57),(cx-11,57),(cx-18,49)], cz-11,cz+12,"steel",5)
        P.flat(g,torso,"steel",5)
        P.flat(g,torso & (Y>45),"steel",6)
        P.flat(g,torso & (Z<cz-9) & (np.abs(X-cx)<4),"cyan",6)
        box(g,cx-5,54,cz-5,cx+5,61,cz+5,"purple",4)
        head=front(g,[(cx-10,59),(cx+10,59),(cx+11,69),(cx+7,77),(cx-7,77),(cx-11,69)],cz-10,cz+7,"purple",5)
        P.flat(g,head,"purple",5)
        P.flat(g,head & (Z<cz-8) & (Y>65)&(Y<71),"navy",2)
        for dx in (-5,5):
            P.flat(g,head & (Z<cz-8)&(np.abs(X-cx-dx)<2)&(Y>66)&(Y<69),"cyan",7)
        for dx,dz,h,ramp in ((-15,5,23,"cyan"),(15,6,19,"magenta")):
            crystals=gem(g,cx+dx,cz+dz,49,5,h,ramp,5,n=5,waist=.3,cap=.15)
            P.flat(g,mask_of(g,crystals),ramp,5)
            P.flat(g,mask_of(g,crystals)&(X>cx+dx),ramp,6)
        return g

    def arm(s: int) -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        m = front(g, [(cx + s * 17, 58), (cx + s * 31, 54), (cx + s * 32, 34),
                      (cx + s * 27, 17), (cx + s * 25, 18), (cx + s * 22, 36)], cz - 10, cz + 10, "steel", 5)
        P.plates(g, m, "steel", 5, size=(8, 8), seed=10 + s)
        P.flat(g, m & (Y < 30), "iron", 3)
        P.flat(g, m & (np.abs(X - (cx + s * 23)) < 2) & (Y > 30), "cyan", 6)
        fist = box(g, cx + s * 27 - 6, 13, cz - 11, cx + s * 27 + 6, 24, cz + 11, "bone", 6)
        P.plates(g, fist, "bone", 6, size=(6, 7), seed=12 + s)
        P.flat(g, edges(fist), "steel", 3)
        return g

    def leg(s: int) -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        m = front(g, [(cx + s * 10 - 8, 22), (cx + s * 10 + 8, 22),
                      (cx + s * 13 + 8, 9), (cx + s * 15 + 12, 2),
                      (cx + s * 15 - 12, 2), (cx + s * 13 - 8, 10)], cz - 9, cz + 9, "iron", 5)
        P.plates(g, m, "iron", 5, size=(7, 6), seed=15 + s)
        P.flat(g, m & (Y < 7), "steel", 3)
        return g

    rig = Rig()
    rig.group("golem", (cx, 0, cz))
    rig.add("body", body(), (cx, 12, cz), "golem")
    rig.add("arm-l", arm(-1), (cx - 17, 55, cz), "body")
    rig.add("arm-r", arm(1), (cx + 17, 55, cz), "body")
    rig.add("leg-l", leg(-1), (cx - 10, 22, cz), "body")
    rig.add("leg-r", leg(1), (cx + 10, 22, cz), "body")
    z = (0.0, 0.0, 0.0)
    idle = {"body": {"rot": wave(3.2, "y", 2)}, "arm-l": {"rot": wave(3.2, "z", 2)}, "arm-r": {"rot": wave(3.2, "z", -2)}}
    move = {"leg-l": {"rot": wave(1.4, "x", 18)}, "leg-r": {"rot": wave(1.4, "x", -18)},
            "arm-l": {"rot": wave(1.4, "x", -12)}, "arm-r": {"rot": wave(1.4, "x", 12)}, "body": {"loc": wave(1.4, "y", 1)}}
    attack = {"arm-r": {"rot": [(0, z), (0.25, (-15, 0, -20)), (0.55, (50, 0, 4)), (1.0, z)],
                        "loc": [(0, z), (0.25, (0, 1, 0)), (0.55, (0, -2, 0)), (1.0, z)]}}
    hit = {"body": {"rot": [(0, z), (0.12, (10, 0, -12)), (0.5, z)]}}
    death = {"body": {"rot": [(0, z), (0.45, (0, 0, 16)), (1.0, (0, 0, 72))], "loc": [(0, z), (1.0, (0, -12, 0))]},
             "arm-l": {"rot": [(0, z), (1.0, (0, 0, 28))]}, "arm-r": {"rot": [(0, z), (1.0, (0, 0, -34))]}}
    sock = rig.sock("socket-impact", (cx + 32, 13, cz - 3), parent="arm-r")
    clips = [Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)]
    return asset("creatures", "crystal-golem", "Crystal Golem", rig.root, clips=clips, sockets=[sock],
                 pfx=[{"effectId": "rvx-space-gravity-slam", "socket": "socket-impact", "trigger": "clip:attack", "size": 24, "aim": [0, -1, 0], "at": 0.55}])


def _space_jelly() -> object:
    S, cx, cz = (72, 72, 72), 36, 36

    def bell() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        cap = dome(g, cx, cz, 29, 25, 26, n=10, rings=5, ramp="purple", base=5, cap_r=3, ribs=("magenta", 4))
        P.flat(g, cap & (Y > 47), "magenta", 6)
        P.flat(g, cap & (Y > 49) & (np.floor(X + Z) % 8 == 0), "cyan", 7)
        underside = cap & (Y < 36) & (np.hypot(X - cx, Z - cz) < 20)
        P.flat(g, underside, "teal", 5)
        # Two large eye glyphs sit on the bell front.
        for ex in (cx - 9, cx + 9):
            eye = underside & (Z < cz - 12) & (np.abs(X - ex) < 4) & (Y > 34) & (Y < 42)
            P.flat(g, eye, "bone", 7)
            P.flat(g, eye & (Y > 36) & (Y < 40), "lime", 6)
            P.flat(g, eye & (np.abs(X - ex) < 1.5), "navy", 1)
        return g

    def tentacle(s: int) -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        pts = [(cx + s * 4, 30), (cx + s * 10, 18), (cx + s * 18, 6), (cx + s * 25, 3)]
        mask = np.zeros(g.shape, dtype=bool)
        for i, (a, b) in enumerate(zip(pts, pts[1:])):
            mask |= front(g, quad(a, b, 4 - i * 0.7, 3 - i * 0.6, cap=1), cz - 3, cz + 3, "teal", 5)
        P.flat(g, mask, "teal", 5)
        P.flat(g, mask & (np.floor(X) % 4 == 0) & (Y < 18), "pink", 6)
        P.flat(g, mask & (X > cx + s * 22) & (Y < 8), "lime", 6)
        return g

    rig = Rig()
    rig.group("jelly", (cx, 0, cz))
    rig.add("bell", bell(), (cx, 29, cz), "jelly")
    for i, s in enumerate((-1, 1, -1, 1)):
        name = f"tentacle-{i}"
        rig.add(name, tentacle(s), (cx + s * 4, 30, cz), "jelly", rot=(0, i * 90, 0))
    z = (0.0, 0.0, 0.0)
    idle = {"bell": {"rot": wave(2.8, "z", 3)}, "jelly": {"loc": wave(2.8, "y", 1.2)}}
    move = {f"tentacle-{i}": {"rot": wave(1.8, "z", 12, phase=i * 0.7)} for i in range(4)}
    attack = {f"tentacle-{i}": {"rot": [(0, z), (0.28, (0, 0, 42 if i % 2 else -42)), (0.54, (0, 0, -8)), (1, z)]} for i in (0, 1)}
    hit = {"bell": {"rot": [(0, z), (0.1, (12, 0, 0)), (0.48, z)]}, "jelly": {"loc": [(0, z), (0.1, (0, 0, 2)), (0.48, z)]}}
    death = {"bell": {"rot": [(0, z), (1, (72, 0, 0))], "loc": [(0, z), (1, (0, -14, 0))]},
             **{f"tentacle-{i}": {"rot": [(0, z), (1, (0, 0, 34 if i % 2 else -34))]} for i in range(4)}}
    sock = rig.sock("socket-spores", (cx, 52, cz - 14), parent="bell")
    spit = rig.sock("socket-acid", (cx, 37, cz - 20), parent="bell")
    clips = [Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)]
    return asset("creatures", "space-jelly", "Space Jelly", rig.root, clips=clips, sockets=[sock, spit],
                 pfx=[{"effectId": "rvx-space-spore-drift", "socket": "socket-spores", "trigger": "idle", "size": 13},
                      {"effectId": "rvx-space-acid-spray", "socket": "socket-acid", "trigger": "clip:attack", "size": 12, "aim": [0, 0, -1], "at": 0.5}])


def _astro_crab() -> object:
    S, cx, cz = (82, 58, 82), 41, 41

    def shell() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        cap = dome(g, cx, cz, 20, 27, 22, n=10, rings=4, ramp="bone", base=6, cap_r=4, ribs=("steel", 3))
        P.flat(g, cap & (Y > 26), "orange", 5)
        P.flat(g, cap & (Y > 27) & (np.floor(X + Z) % 8 == 0), "steel", 4)
        P.flat(g, cap & (Z < cz - 20) & (Y > 24) & (Y < 32), "cyan", 6)
        P.flat(g, cap & (Z < cz - 20) & (Y > 30), "cyan", 7)
        belly = box(g, cx - 18, 15, cz - 22, cx + 18, 23, cz + 18, "steel", 4)
        P.plates(g, belly, "steel", 4, size=(7, 6), seed=3)
        return g

    def leg(s: int, index: int) -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        end = cx + s * (24 + (index % 2) * 4)
        z0 = cz + (-16 if index == 0 else (0 if index == 1 else 16))
        knee = end + s * 9
        m = front(g, [(cx + s * 18, 23), (cx + s * 22, 27), (knee, 16), (end, 2),
                      (end - s * 6, 2), (knee - s * 4, 19)], z0 - 3, z0 + 3, "steel", 5)
        P.plates(g, m, "steel", 5, size=(6, 6), seed=6 + index)
        P.flat(g, m & (Y < 7), "bone", 6)
        P.flat(g, m & (np.abs(X - knee) < 1.2), "rust", 5)
        return g

    def claw(s: int) -> Grid:
        g=Grid(*S)
        px=cx+s*25
        m=plan(g,[(cx+s*16,cz-13),(px+s*4,cz-16),(px+s*5,cz-27),(px-s*2,cz-30),(px-s*5,cz-21)],16,22,"steel",5)
        P.flat(g,m,"steel",5)
        disc(g,"y",px,cz-25,5,18,24,"rust",5,n=8)
        # Two shaped fingers leave an open pincer gap toward the front.
        for t in (-1,1):
            finger=plan(g,[(px+t*2,cz-23),(px+t*8,cz-28),(px+t*7,cz-38),(px+t*3,cz-39),(px+t*4,cz-30)],19,25,"orange",6)
            P.flat(g,finger,"orange",6)
            X,Y,Z=coords(g)
            P.flat(g,finger&(Z<cz-35),"bone",7)
        return g

    rig = Rig()
    rig.group("crab", (cx, 0, cz))
    rig.add("shell", shell(), (cx, 14, cz), "crab")
    for i, s in enumerate((-1, -1, -1, 1, 1, 1)):
        z0 = cz + (-16 if i % 3 == 0 else (0 if i % 3 == 1 else 16))
        rig.add(f"leg-{i}", leg(s, i), (cx + s * 18, 22, z0), "shell", rot=(0, (i % 3 - 1) * 13, 0))
    rig.add("claw-l", claw(-1), (cx - 24, 18, cz - 29), "shell")
    rig.add("claw-r", claw(1), (cx + 24, 18, cz - 29), "shell")
    z = (0.0, 0.0, 0.0)
    idle = {"shell": {"rot": wave(3.2, "y", 2)}, "claw-l": {"rot": wave(3.2, "z", 3)}, "claw-r": {"rot": wave(3.2, "z", -3)}}
    move = {f"leg-{i}": {"rot": wave(1.2, "x", 16, phase=i * math.pi / 3)} for i in range(6)}
    attack = {"claw-l": {"rot": [(0, z), (0.3, (0, 0, 24)), (0.55, (0, 0, -12)), (0.9, z)]},
              "claw-r": {"rot": [(0, z), (0.3, (0, 0, -24)), (0.55, (0, 0, 12)), (0.9, z)]}}
    hit = {"shell": {"rot": [(0, z), (0.12, (0, 0, 10)), (0.5, z)]}}
    death = {"shell": {"rot": [(0, z), (1.0, (42, 0, 0))], "loc": [(0, z), (1.0, (0, -8, 0))]},
             "claw-l": {"rot": [(0, z), (1.0, (0, 0, 35))]}, "claw-r": {"rot": [(0, z), (1.0, (0, 0, -35))]}}
    sock = rig.sock("socket-claw-impact", (cx + 35, 11, cz - 25), parent="claw-r")
    clips = [Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)]
    return asset("creatures", "astro-crab", "Astro Crab", rig.root, clips=clips, sockets=[sock],
                 pfx=[{"effectId": "rvx-space-gravity-slam", "socket": "socket-claw-impact", "trigger": "clip:attack", "size": 16, "aim": [0, -1, 0], "at": 0.58}])


def _void_stalker() -> object:
    S, cx, cz = (88, 48, 76), 44, 38

    def torso() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        body = side(g, [(15, 17), (15, 58), (24, 69), (31, 58), (30, 27), (24, 16)], cx - 12, cx + 12, "purple", 4)
        P.plates(g, body, "purple", 4, size=(9, 7), seed=2)
        P.flat(g, body & (np.abs(Y - 23) < 1.3), "steel", 3)
        P.flat(g, body & (np.abs(Y - 24) < 1.2) & (Z > 40), "magenta", 6)
        neck = side(g, [(22,14),(22,29),(31,28),(35,18)], cx-7,cx+7,"purple",5)
        P.flat(g,neck,"purple",5)
        head = front(g, [(cx - 12, 28), (cx + 12, 28), (cx + 11, 42), (cx + 5, 47), (cx - 10, 41)], 7, 20, "purple", 5)
        P.plates(g, head, "purple", 5, size=(6, 5), seed=3)
        face = head & (Z < 9) & (Y > 34) & (Y < 40)
        P.flat(g, face, "navy", 1)
        P.flat(g, face & ((np.abs(X - (cx - 5)) < 2) | (np.abs(X - (cx + 5)) < 2)), "cyan", 7)
        for s in (-1, 1):
            horn = cone(g, "y", cx + s * 10, 13, 4, 36, 47, "bone", 6, n=6, r_top=0)
            P.flat(g, horn, "bone", 6)
        tail = side(g, [(22, 53), (20, 70), (13, 75), (11, 67), (17, 60)], cx - 4, cx + 4, "purple", 5)
        P.flat(g, tail, "purple", 5)
        return g

    def leg(s: int, front_leg: bool) -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        z0 = 20 if front_leg else 57
        x0 = cx + s * 8
        m = front(g, [(x0, 24), (x0 + s * 13, 20), (x0 + s * 20, 7),
                      (x0 + s * 24, 2), (x0 + s * 14, 2), (x0 + s * 4, 16)], z0 - 4, z0 + 4, "steel", 5)
        P.plates(g, m, "steel", 5, size=(5, 5), seed=int(x0 + z0))
        P.flat(g, m & (Y < 6), "bone", 6)
        P.flat(g, m & (np.abs(Y - 17) < 1), "magenta", 5)
        return g

    rig = Rig()
    rig.group("stalker", (cx, 0, cz))
    rig.add("body", torso(), (cx, 13, cz), "stalker")
    for i, (s, fore) in enumerate(((-1, True), (1, True), (-1, False), (1, False))):
        rig.add(f"leg-{i}", leg(s, fore), (cx + s * 8, 22, 20 if fore else 57), "body")
    z = (0.0, 0.0, 0.0)
    idle = {"body": {"rot": wave(2.8, "y", 2)}, "leg-0": {"rot": wave(2.8, "z", 3)}, "leg-1": {"rot": wave(2.8, "z", -3)}}
    move = {f"leg-{i}": {"rot": wave(0.8, "x", 24, phase=i * math.pi / 2)} for i in range(4)}
    attack = {"body": {"loc": [(0, z), (0.2, (0, 0, -3)), (0.42, (0, 2, 4)), (0.85, z)],
                       "rot": [(0, z), (0.2, (-8, 0, 0)), (0.42, (14, 0, 0)), (0.85, z)]}}
    hit = {"body": {"rot": [(0, z), (0.1, (0, 0, 14)), (0.5, z)]}}
    death = {"body": {"rot": [(0, z), (1.0, (0, 0, 78))], "loc": [(0, z), (1.0, (0, -8, 0))]},
             **{f"leg-{i}": {"rot": [(0, z), (1.0, (0, 0, 18 if i % 2 else -18))]} for i in range(4)}}
    sock = rig.sock("socket-slash", (cx + 18, 15, 16), parent="leg-1")
    clips = [Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)]
    return asset("creatures", "void-stalker", "Void Stalker", rig.root, clips=clips, sockets=[sock],
                 pfx=[{"effectId": "rvx-space-plasma-slash", "socket": "socket-slash", "trigger": "clip:attack", "size": 14, "aim": [0, 0, -1], "at": 0.42}])


def make_creature(slug: str) -> object:
    if slug in ("alien-scout", "alien-brute", "psionic-alien"):
        from _ad_creatures import make_humanoid
        return make_humanoid(slug)
    if slug == "crystal-golem":
        return ground_death(_crystal_golem())
    if slug == "space-jelly":
        return _space_jelly()
    if slug == "astro-crab":
        return ground_death(_astro_crab())
    if slug == "void-stalker":
        return ground_death(_void_stalker())
    raise KeyError(slug)


# ---------------------------------------------------------------- vehicles
def _vehicle_grid(kind: str) -> tuple[Grid, dict, dict, list, list]:
    """Return the body, named moving grids, pivots, clips and PFX bindings."""
    specs = {
        "cargo-mech": (76, 82, 78),
        "space-tug": (68, 52, 92),
        "hover-tank": (76, 44, 84),
        "mining-crawler": (68, 54, 96),
        "patrol-speeder": (52, 34, 64),
    }
    S = specs[kind]
    cx, cz = S[0] // 2, S[2] // 2
    body = Grid(*S)
    X, Y, Z = coords(body)
    parts: dict[str, Grid] = {}
    joints: dict[str, tuple] = {}
    clips: list[Clip] = []
    pfx: list[dict] = []

    def add_wheel(name: str, x: int, y: int, z: int, r: int = 7, width: int = 8):
        g = Grid(*S)
        tire = disc(g, "x", y, z, r, x - width // 2, x + width // 2, "iron", 5, n=8)
        P.plates(g, tire, "iron", 5, size=(5, 4), seed=x + z)
        hub = disc(g, "x", y, z, r * 0.45, x - width // 2 - 1, x + width // 2 + 1, "steel", 5, n=8)
        P.flat(g, hub, "steel", 5)
        P.flat(g, hub & (np.hypot(Y - y, Z - z) < 1.8), "orange", 6)
        P.flat(g, tire & (np.floor(np.degrees(np.arctan2(Y - y, Z - z)) / 22.5) % 2 == 0), "iron", 6)
        parts[name], joints[name] = g, (x, y, z)

    z0 = (0.0, 0.0, 0.0)
    if kind == "cargo-mech":
        # A walking cargo handler with two separate clamp arms and a central cab.
        base = _solid(body, cx, cz, 23, 5, 19, "steel", 5, 8, 19)
        P.plates(body, base, "steel", 5, size=(10, 8), seed=2)
        P.flat(body, base & (Z < cz - 19) & (Y > 10), "orange", 6)
        cab = front(body, [(cx - 15, 18), (cx + 15, 18), (cx + 13, 43), (cx + 8, 52), (cx - 9, 52), (cx - 15, 44)], cz - 14, cz + 13, "bone", 6)
        P.plates(body, cab, "bone", 6, size=(9, 8), seed=3)
        wind = cab & (Z < cz - 12) & (Y > 30) & (Y < 45)
        P.flat(body, wind, "cyan", 6)
        P.flat(body, wind & (Y > 40), "cyan", 7)
        P.flat(body, cab & (Y > 47), "bone", 7)
        for s in (-1, 1):
            leg = front(body, [(cx + s * 8 - 7, 21), (cx + s * 8 + 7, 21), (cx + s * 11 + 9, 8),
                               (cx + s * 12 + 8, 3), (cx + s * 4 - 7, 3)], cz - 11, cz + 11, "iron", 5)
            P.plates(body, leg, "iron", 5, size=(6, 6), seed=5 + s)
            P.flat(body, leg & (Y < 6), "orange", 5)
            # A walker leg on each side (the mech walks; it has no wheels).
            lg = Grid(*S)
            lx0, lx1 = cx + s * 25 - 4, cx + s * 25 + 4
            hip = disc(lg, "x", 21, cz + 4, 5, lx0 - 1, lx1 + 1, "rust", 5, n=8)
            P.flat(lg, hip, "rust", 5)
            thigh = side(lg, quad((21, cz + 4), (11, cz - 3), 3.6, 3.2), lx0, lx1, "steel", 5)
            shin = side(lg, quad((11, cz - 3), (3, cz + 2), 3.2, 3.0), lx0, lx1, "iron", 5)
            P.plates(lg, thigh, "steel", 5, size=(5, 6), seed=20 + s)
            P.plates(lg, shin, "iron", 5, size=(5, 6), seed=22 + s)
            knee = disc(lg, "x", 11, cz - 3, 3, lx0 - 1, lx1 + 1, "orange", 5, n=8)
            P.flat(lg, knee, "orange", 6)
            foot = side(lg, [(0, cz - 7), (0, cz + 8), (3, cz + 7), (4, cz + 2), (3, cz - 6)], lx0 - 1.5, lx1 + 1.5, "steel", 4)
            P.plates(lg, foot, "steel", 4, size=(5, 3), seed=24 + s)
            hazard(lg, foot & (coords(lg)[2] < cz - 5), period=4)
            parts[f"leg-{s}"], joints[f"leg-{s}"] = lg, (cx + s * 25, 21, cz + 4)
            # Separate forks read as the machine's working tool.
            arm = Grid(*S)
            X2, Y2, Z2 = coords(arm)
            beam = front(arm, [(cx + s * 16, 44), (cx + s * 22, 44), (cx + s * 31, 28),
                               (cx + s * 29, 25), (cx + s * 21, 38)], cz - 4, cz + 4, "orange", 6)
            P.plates(arm, beam, "orange", 6, size=(6, 5), seed=7 + s)
            fork_x = cx + s * 29
            fork = box(arm, fork_x - 3, 24, cz - 17, fork_x + 3, 27, cz + 3, "steel", 5)
            P.flat(arm, fork & (Y > 25), "steel", 6)
            disc(arm,"z",fork_x,27,5,cz-7,cz+5,"rust",5,n=8)
            for dz in (-18,-7):
                plan(arm,[(fork_x-s*3,cz+dz),(fork_x+s*3,cz+dz),(fork_x+s*3,cz+dz-5),(fork_x-s*4,cz+dz-5)],22,28,"orange",6)
            parts[f"fork-{s}"] = arm
            joints[f"fork-{s}"] = (cx + s * 16, 42, cz)
        # Raised pallet between forks. Keep it as a body detail for one clear silhouette.
        box(body,cx-27,19,cz-32,cx+27,22,cz-15,"steel",5)
        # The carried crate uses plates with a dark border (no speckle, S3).
        cr = box(body, cx - 9, 22, cz - 31, cx + 9, 40, cz - 13, "rust", 5)
        P.plates(body, cr, "rust", 5, size=(6, 6), seed=26)
        P.flat(body, edges(cr), "iron", 4)
        P.flat(body, cr & (np.abs(coords(body)[1] - 31) < 1) & ~edges(cr), "cyan", 6)
        pfx.append({"effectId": "rvx-space-hover-thrust", "socket": "socket-drive", "trigger": "clip:move", "size": 14, "aim": [0, -1, 0]})
        pfx.append({"effectId": "rvx-space-weld-sparks", "socket": "socket-clamp", "trigger": "clip:active", "size": 9, "aim": [0, 0, -1], "at": 0.55})
        clips = [Clip("idle", {"body": {"loc": wave(3.0, "y", 0.5)}}),
                 Clip("move", {"leg-1": {"rot": wave(1.0, "x", 18)}, "leg--1": {"rot": wave(1.0, "x", -18)},
                               "body": {"loc": [(k / 16, (0.0, 2.2 * abs(math.sin(2 * math.pi * k / 16)), 0.0)) for k in range(17)]}}),
                 Clip("active", {f"fork-{s}": {"rot": [(0, z0), (0.3, (0, 0, s * 18)), (0.6, (0, 0, s * -8)), (1, z0)]} for s in (-1, 1)}, loop=False)]
    elif kind == "space-tug":
        # A short tow ship: broad cockpit, twin engine nacelles and an active bow clamp.
        hull = loft(body, cx, [(8, 10, 8, 18), (20, 17, 12, 20), (70, 16, 12, 20), (83, 10, 8, 20)], "bone", 6, k=0.36)
        hm = mask_of(body, hull)
        facet_paint(body, hull, lambda gg, mm, fr: P.plates(gg, mm, "bone", 6, size=(10, 8), frame=fr, seed=2))
        P.flat(body, hm & (Y < 15), "steel", 4)
        P.flat(body, hm & (np.abs(Y - 24) < 1.2), "orange", 5)
        canopy = front(body, [(cx - 11, 28), (cx + 11, 28), (cx + 8, 43), (cx - 8, 43)], 8, 18, "cyan", 6)
        P.flat(body, canopy & (Y > 38), "cyan", 7)
        P.flat(body, edges(canopy), "steel", 4)
        for s in (-1, 1):
            nac = _solid(body, cx + s * 23, 65, 8, 12, 26, "steel", 5, 8, 5)
            P.plates(body, nac, "steel", 5, size=(7, 6), seed=4 + s)
            P.flat(body, nac & (Z > 69), "cyan", 7)
            P.flat(body, nac & (np.abs(Y - 14) < 1), "orange", 6)
            # tow arms swing clear of a container, then lock around it.
            arm_grid = Grid(*S)
            box(body, cx+s*15-3,16,8,cx+s*15+3,24,23,"steel",5)
            disc(body,"z",cx+s*15,20,4,7,12,"rust",5,n=8)
            arm = front(arm_grid, [(cx + s * 15, 20), (cx + s * 23, 23), (cx + s * 31, 13), (cx + s * 28, 10)], 4, 11, "orange", 5)
            P.plates(arm_grid, arm, "orange", 5, size=(5, 4), seed=s + 8)
            parts[f"tow-arm-{s}"] = arm_grid
            joints[f"tow-arm-{s}"] = (cx + s * 16, 19, 8)
        # keep the bow cargo grip visible and separate from the canopy
        emitter = box(body, cx - 5, 10, 2, cx + 5, 18, 8, "rust", 5)
        P.flat(body, emitter & (Z < 3), "lime", 7)
        # twin thruster mouths
        for s in (-1, 1):
            disc(body, "z", cx + s * 11, 18, 6, 78, 86, "rust", 5, n=8)
            disc(body, "z", cx + s * 11, 18, 3, 85, 89, "cyan", 6, n=8)
        pfx.extend([
            {"effectId": "rvx-space-tractor-beam", "socket": "socket-tow", "trigger": "clip:active", "size": 24, "aim": [0, 0, -1], "at": 0.5},
            {"effectId": "rvx-space-engine-exhaust", "socket": "socket-engine", "trigger": "clip:move", "size": 14, "aim": [0, 0, 1]},
        ])
        clips = [Clip("idle", {"body": {"loc": wave(2.6, "y", 0.6)}}),
                 Clip("move", {"body": {"rot": wave(1.3, "z", 5)}, "tow-arm-1": {"rot": wave(1.3, "x", 3)}, "tow-arm--1": {"rot": wave(1.3, "x", -3)}}),
                 Clip("active", {"tow-arm-1": {"rot": [(0, z0), (0.3, (0, 0, -24)), (0.65, (0, 0, 12)), (1, z0)]},
                               "tow-arm--1": {"rot": [(0, z0), (0.3, (0, 0, 24)), (0.65, (0, 0, -12)), (1, z0)]}}, loop=False)]
    elif kind == "hover-tank":
        hull = _solid(body, cx, cz, 31, 6, 22, "steel", 5, 8, 25)
        P.plates(body, hull, "steel", 5, size=(10, 8), seed=2)
        nose = front(body, [(cx - 26, 11), (cx + 26, 11), (cx + 19, 32), (cx - 19, 32)], 4, 20, "bone", 6)
        P.plates(body, nose, "bone", 6, size=(10, 7), seed=3)
        P.flat(body, nose & (Z < cz - 25), "bone", 6)
        P.flat(body, nose & (Z < cz - 25)&(Y<16), "orange", 5)
        for s in (-1, 1):
            for zc in (22, 61):
                box(body,cx+s*23-4,11,zc,cx+s*23+4,14,zc+3,"steel",5)
                lamp = box(body, cx + s * 28 - 3, 11, zc, cx + s * 28 + 3, 16, zc + 3, "orange", 5)
                P.flat(body, lamp, "gold", 7)
        P.flat(body,nose &(np.abs(X-cx)<9)&(Y>15)&(Y<24),"steel",5)
        P.flat(body,nose &(np.abs(X-cx)<7)&(Y>17)&(Y<22),"cyan",5)
        tg = Grid(*S)
        tv = _solid(tg, cx, cz - 3, 19, 21, 34, "bone", 6, 8, 11)
        P.plates(tg, tv, "bone", 6, size=(8, 7), seed=4)
        barrel = disc(tg, "z", cx, 35, 4, 1, 35, "steel", 5, n=8)
        P.plates(tg, barrel, "steel", 5, size=(7, 5), seed=5)
        P.flat(tg, barrel & (Z < 5), "rust", 5)
        muzzle=disc(tg,"z",cx,35,6,0,5,"steel",5,n=8)
        Xt,Yt,Zt=coords(tg)
        P.flat(tg,muzzle & (Zt<1)&(np.hypot(Xt-cx,Yt-35)<3.2),"navy",1)
        P.flat(tg,muzzle & (Zt<1)&(np.hypot(Xt-cx,Yt-35)>=3.2),"rust",6)
        parts["turret"] = tg
        joints["turret"] = (cx, 21, cz - 3)
        # distinct child pads are the visible animated thrusters
        for s in (-1, 1):
            pg = Grid(*S)
            pd = _solid(pg, cx + s * 28, cz, 7, 1, 9, "cyan", 5, 8, 6)
            P.flat(pg, pd, "cyan", 6)
            parts[f"hover-pad-{s}"] = pg
            joints[f"hover-pad-{s}"] = (cx + s * 28, 5, cz)
        pfx.extend([
            {"effectId": "rvx-space-hover-thrust", "socket": "socket-thrust", "trigger": "clip:move", "size": 18, "aim": [0, -1, 0]},
            {"effectId": "rvx-space-cannon-blast", "socket": "socket-muzzle", "trigger": "clip:attack", "size": 18, "aim": [0, 0, -1], "at": 0.45},
        ])
        clips = [Clip("idle", {"turret": {"rot": spin(8.0, "y", 360)}}),
                 Clip("move", {"hover-pad--1": {"loc": wave(1.4, "y", 1.1)}, "hover-pad-1": {"loc": wave(1.4, "y", 1.1, phase=math.pi)}, "body": {"rot": wave(1.4, "x", 2)}}),
                 Clip("attack", {"turret": {"rot": [(0, z0), (0.22, (0, 4, 0)), (0.6, (0, -3, 0)), (1, z0)], "loc": [(0, z0), (0.2, (0, 0, -2)), (0.55, (0, 0, 1)), (1, z0)]}}, loop=False)]
    elif kind == "mining-crawler":
        # Six large wheels, a glazed driver cab, and a powered front drill.
        hull = plan(body, [(12, 8), (56, 8), (63, 20), (63, 75), (55, 88), (13, 88), (5, 72), (5, 22)], 13, 30, "steel", 5,
                    top=[(17, 14), (51, 14), (57, 23), (57, 72), (51, 81), (17, 81), (11, 70), (11, 25)])
        P.plates(body, hull, "steel", 5, size=(10, 8), seed=2)
        P.flat(body, hull & (Y < 17), "iron", 3)
        cab = front(body, [(cx - 17, 26), (cx + 17, 26), (cx + 13, 44), (cx - 12, 44)], 13, 28, "bone", 6)
        P.plates(body, cab, "bone", 6, size=(8, 7), seed=3)
        glass = cab & (Z < 15) & (Y > 31)&(np.abs(X-cx)<12)
        P.flat(body, glass, "cyan", 6)
        P.flat(body, glass & (Y > 39), "cyan", 7)
        P.flat(body, glass &(np.abs(X-cx)<1.1),"steel",4)
        P.flat(body, cab & (Y>42),"steel",5)
        for x in (cx - 17, cx + 17):
            light = box(body, x - 3, 20, 10, x + 3, 25, 14, "orange", 5)
            P.flat(body, light, "gold", 7)
        # central articulated auger carries the focal tool silhouette
        drill = Grid(*S)
        Xd, Yd, Zd = coords(drill)
        disc(drill,"z",cx,21,8,19,29,"steel",5,n=8)
        # The auger tapers toward -Z. Broad flights define its cutting edge.
        for zz,rr in ((15,11),(9,8),(4,5)):
            tip=cone(drill,"z",cx,21,rr,zz-4,zz+5,"rust",5,n=8,r_top=max(1,rr-4),tip="lo")
            P.flat(drill,tip,"rust",5)
            flight=disc(drill,"z",cx,21,rr+1,zz,zz+2,"orange",5,n=8)
            P.flat(drill,flight,"orange",6)
        for dx,dy in ((-7,0),(7,0),(0,-7),(0,7)):
            cone(drill,"z",cx+dx,21+dy,2,2,9,"bone",6,n=5,r_top=0,tip="lo")
        parts["drill"] = drill
        joints["drill"] = (cx, 21, 12)
        for s in (-1, 1):
            for i, zc in enumerate((20, 48, 76)):
                add_wheel(f"wheel-{s}-{i}", cx + s * 24, 10, zc, 9, 9)
        pfx.extend([
            {"effectId": "rvx-space-weld-sparks", "socket": "socket-drill", "trigger": "clip:active", "size": 13, "aim": [0, 0, -1], "at": 0.5},
            {"effectId": "rvx-space-engine-exhaust", "socket": "socket-engine", "trigger": "clip:move", "size": 14, "aim": [0, 0, 1]},
        ])
        move = {name: {"rot": spin(1.3, "x", 360)} for name in parts if name.startswith("wheel-")}
        clips = [Clip("idle", {"body": {"loc": wave(3.0, "y", 0.3)}}),
                 Clip("move", {**move, "body": {"rot": wave(1.3, "x", 2)}}),
                 Clip("active", {"drill": {"rot": spin(1.0, "z", 360), "loc": [(0, z0), (0.3, (0, 0, -2)), (0.7, (0, 0, 1)), (1, z0)]}}, loop=False)]
    else:  # patrol-speeder
        # A light interceptor with a swept nose, wing tips, canopy and two jets.
        fuselage = loft(body, cx, [(3, 4, 4, 16), (12, 8, 7, 16), (43, 7, 6, 16), (56, 4, 4, 16)], "bone", 6, k=0.34)
        fm = mask_of(body, fuselage)
        facet_paint(body, fuselage, lambda gg, mm, fr: P.plates(gg, mm, "bone", 6, size=(7, 6), frame=fr, seed=2))
        P.flat(body, fm & (Y < 11), "steel", 4)
        canopy = side(body,[(17,11),(17,29),(25,26),(29,21),(23,13)],cx-6,cx+6,"cyan",6)
        P.flat(body,canopy,"cyan",6)
        P.flat(body,edges(canopy),"steel",4)
        P.flat(body,canopy &(Y>25),"cyan",7)
        for x in (cx-7,cx+5):
            side(body,[(16,11),(16,30),(19,30),(19,13)],x,x+2,"bone",6)
        for s in (-1, 1):
            wing = plan(body, [(cx + s * 6, 25), (cx + s * 22, 37), (cx + s * 24, 51), (cx + s * 6, 44)], 10, 14, "steel", 5)
            P.plates(body, wing, "steel", 5, size=(7, 5), seed=s + 3)
            P.flat(body, wing & (Z > 48), "orange", 5)
            P.flat(body, wing & (np.abs(X - (cx + s * 21)) < 2) & (Z > 37), "cyan", 6)
            disc(body, "z", cx + s * 5, 15, 4, 47, 59, "rust", 5, n=8)
            disc(body, "z", cx + s * 5, 15, 2, 57, 63, "cyan", 6, n=8)
            flare = Grid(*S)
            cone(flare, "z", cx + s * 5, 15, 4, 55, 63, "orange", 5, n=8, r_top=0)
            parts[f"flare-{s}"] = flare
            joints[f"flare-{s}"] = (cx + s * 5, 15, 56)
        P.flat(body, fm & (np.abs(X - cx) < 1.2) & (Z > 20), "orange", 5)
        P.flat(body, fm & (np.abs(X - cx) < 0.8) & (Z > 20), "orange", 6)
        for s in (-1, 1):
            mark = box(body, cx + s * 17 - 2, 13, 37, cx + s * 17 + 2, 15, 43, "cyan", 6)
            P.flat(body, mark, "cyan", 7)
        pfx.extend([
            {"effectId": "rvx-space-engine-exhaust", "socket": "socket-engine", "trigger": "clip:move", "size": 10, "aim": [0, 0, 1]},
            {"effectId": "rvx-space-laser-bolt", "socket": "socket-gun", "trigger": "clip:attack", "size": 8, "aim": [0, 0, -1], "at": 0.4},
        ])
        clips = [Clip("idle", {"body": {"loc": wave(2.4, "y", 0.4)}}),
                 Clip("move", {"body": {"rot": wave(0.8, "z", 12)}, "flare--1": {"loc": wave(0.8, "z", 1)}, "flare-1": {"loc": wave(0.8, "z", 1, phase=math.pi)}}),
                 Clip("attack", {"body": {"rot": [(0, z0), (0.2, (-3, 0, 0)), (0.45, (4, 0, 0)), (0.8, z0)]}}, loop=False)]
    return body, parts, joints, clips, pfx


def make_vehicle(slug: str) -> object:
    if slug == "space-tug":
        # Rebuilt so that a seated pilot fits the cab (Art Director repair).
        from _ad_vehicles import space_tug
        return space_tug()
    kind = slug
    body, parts, joints, clips, pfx = _vehicle_grid(kind)
    # Frame-specific sockets sit on the visible surface at rest and follow each animated tool.
    if kind == "cargo-mech":
        S = body.shape
        cx, cz = S[0] // 2, S[2] // 2
        root = Rig()
        root.add("body", body, (cx, 0, cz))
        for name, grid in parts.items():
            root.add(name, grid, joints[name], "body")
        sockets = [root.sock("socket-drive", (cx, 8, cz + 22)), root.sock("socket-clamp", (cx + 30, 26, cz - 12), parent="fork-1")]
    elif kind == "space-tug":
        S = body.shape
        cx, cz = S[0] // 2, S[2] // 2
        root = Rig()
        # The helper stores the body once. `root-body` marks that grid for children.
        root.add("body", body, (cx, 0, cz))
        for name, grid in list(parts.items()):
            if name.startswith("tow-arm"):
                root.add(name, grid, joints[name], "body")
        sockets = [root.sock("socket-tow", (cx, 11, 3), parent="body"), root.sock("socket-engine", (cx + 11, 18, cz + 39), parent="body")]
    elif kind == "hover-tank":
        S = body.shape
        cx, cz = S[0] // 2, S[2] // 2
        root = Rig()
        root.add("body", body, (cx, 0, cz))
        for name, grid in parts.items():
            root.add(name, grid, joints[name], "body")
        sockets = [root.sock("socket-thrust", (cx, 4, cz + 25), parent="body"), root.sock("socket-muzzle", (cx, 35, 0), parent="turret")]
    elif kind == "mining-crawler":
        S = body.shape
        cx, cz = S[0] // 2, S[2] // 2
        root = Rig()
        root.add("body", body, (cx, 0, cz))
        for name, grid in parts.items():
            root.add(name, grid, joints[name], "body")
        sockets = [root.sock("socket-drill", (cx, 21, 0), parent="drill"), root.sock("socket-engine", (cx, 18, cz + 41), parent="body")]
    else:
        S = body.shape
        cx, cz = S[0] // 2, S[2] // 2
        root = Rig()
        root.add("body", body, (cx, 0, cz))
        for name, grid in parts.items():
            root.add(name, grid, joints[name], "body")
        sockets = [root.sock("socket-engine", (cx, 15, cz + 29), parent="body"), root.sock("socket-gun", (cx, 15, 5), parent="body")]
    return asset("vehicles", slug, slug.replace("-", " ").title(), root.root, clips=clips, sockets=sockets, pfx=pfx)
