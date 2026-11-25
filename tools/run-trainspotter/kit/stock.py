"""Rolling stock assembly: body + running gear -> a vehicle that keeps the contract.

A builder (coaches.py, wagons.py, ...) draws a body grid in the shapes.py
frame (x centre BX, y = 0 on the rail, z = 0 at the front coupler face, rear
coupler face at z = L) and describes its running gear. `assemble` places
everything so the vehicle origin is midway between its guide points, adds
the contract sockets, bakes the clips and returns the catalogue entry.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

import railkit as RK
from railkit import COUPLER_Y, MOVE_DISTANCE, MOVE_SECONDS, Clip, Grid, Part, Socket
from running import bogie, crank_pin, rod, wheelset
from shapes import BX

FPS = RK.CLIPS["fps"]


@dataclass
class Axle:
    """A rigid axle on the body frame (z in body-grid coordinates)."""

    name: str
    z: float
    r: int
    style: dict = field(default_factory=dict)


@dataclass
class Bogie:
    tag: str  # 'f' or 'r'
    z: float  # pivot, body-grid z
    r: int = 6
    wheelbase: int = 20


@dataclass
class Rods:
    """Steam motion: coupling rods over the drivers and a main rod to a crosshead."""

    drivers: list[str]  # wheel part names, all the same radius
    main: str  # the driver the main rod drives
    crank: float  # crank throw
    slide_y: float  # crosshead height above rail
    main_len: float  # main rod length (pin to crosshead)
    x: float = 20  # rods' inner face, |x| from the centre line
    tag: str = ""  # part-name suffix, for engines with more than one driver group (articulated)


@dataclass
class Stock:
    name: str
    kind: str  # locomotive | tender | coach | wagon | power-car | ...
    L: int
    body: Grid
    roles: dict  # {"paint": ramp, "trim": ramp, "accent": ramp}
    bogies: list[Bogie] = field(default_factory=list)
    axles: list[Axle] = field(default_factory=list)
    guides: tuple[float, float] | None = None  # body-grid z; default: bogie pivots / outer axles
    rods: Rods | list[Rods] | None = None  # one group, or several on articulated engines
    powered: bool = False
    extra_parts: list[Part] = field(default_factory=list)  # .at in body-grid coordinates; hung from the body
    sockets: list[tuple[str, tuple[float, float, float]]] = field(default_factory=list)  # body-grid coords
    data: dict = field(default_factory=dict)
    idle: str | None = None  # None | 'diesel' | 'steam' | 'electric'
    # Extra clips, merged by name into the vehicle's clips: {"open": {"door-l1": {"loc": [...]}}, ...}.
    # Use the prop vocabulary (open/close for doors and pantographs, active for anything that loops).
    extra_clips: dict[str, dict] = field(default_factory=dict)

    @property
    def rod_groups(self) -> list[Rods]:
        return [] if not self.rods else (self.rods if isinstance(self.rods, list) else [self.rods])


def _guides(s: Stock) -> tuple[float, float]:
    if s.guides:
        return s.guides
    if s.bogies:
        zs = sorted(b.z for b in s.bogies)
    else:
        zs = sorted(a.z for a in s.axles)
    return zs[0], zs[-1]


def assemble(s: Stock):
    """-> (root Part, sockets, clips, catalogue dict)."""
    gf, gr = _guides(s)
    zo = (gf + gr) / 2  # body-grid z of the origin
    root = Part(s.name, None)
    body = Part("body", s.body, pivot=(BX, 0, zo))
    root.add(body)
    wheels: dict[str, int] = {}
    for b in s.bogies:
        p = bogie(f"bogie-{b.tag}", b.r, b.wheelbase, b.tag)
        p.at = (0, 0, b.z - zo)
        root.add(p)
        for w in p.children:
            wheels[w.name] = w.meta["radius"]
    for a in s.axles:
        w = wheelset(a.name, a.r, **a.style)
        w.at = (0, a.r, a.z - zo)
        root.add(w)
        wheels[a.name] = a.r
    for R in s.rod_groups:
        for p in _rod_parts(s, R, zo):
            root.add(p)
    for p in s.extra_parts:  # given in body-grid coordinates
        p.at = (p.at[0] - BX, p.at[1], p.at[2] - zo)
        body.add(p)
    sockets = [
        Socket("socket-coupler-f", (0, COUPLER_Y, -zo), parent=s.name),
        Socket("socket-coupler-r", (0, COUPLER_Y, s.L - zo), parent=s.name),
        Socket("socket-bogie-f", (0, 14, gf - zo), parent=s.name),
        Socket("socket-bogie-r", (0, 14, gr - zo), parent=s.name),
    ]
    for name, (x, y, z) in s.sockets:
        sockets.append(Socket(name, (x - BX, y, z - zo), parent="body"))
    clips = vehicle_clips(s, wheels, zo)
    data = {
        "kind": s.kind, "L": s.L, "couplers": {"f": -zo, "r": s.L - zo}, "guides": [gf - zo, gr - zo],
        "bogies": [f"bogie-{b.tag}" for b in s.bogies], "wheels": wheels, "powered": s.powered,
        "paint": s.roles["paint"], "trim": s.roles["trim"], "accent": s.roles["accent"],
        "clips": [c.name for c in clips], **s.data,
    }
    if s.rod_groups:
        data["rods"] = [{"drivers": R.drivers, "main": R.main, "crank": R.crank, "slideY": R.slide_y, "mainLen": R.main_len, "tag": R.tag}
                        for R in s.rod_groups]
    return root, sockets, clips, data


# ---------------------------------------------------------------- steam rods
def _axle_of(s: Stock, name: str) -> Axle:
    return next(a for a in s.axles if a.name == name)


def _rod_parts(s: Stock, R: Rods, zo: float) -> list[Part]:
    """Coupling rods (one per side, pivoted on the first driver's pin), main
    rods (pivoted on the main driver's pin) and crossheads, at rest. Part
    names: rod-<side><tag>, mainrod-<side><tag>, crosshead-<side><tag>."""
    t = R.tag
    drivers = [_axle_of(s, n) for n in R.drivers]
    r = drivers[0].r
    zs = [a.z for a in drivers]
    out = []
    for side, phase in (("l", 0.0), ("r", math.pi / 2)):
        sx = -1 if side == "l" else 1  # -x is the left looking along -Z... keep both sides symmetric
        py, pz = crank_pin(0.0, R.crank, phase)
        # coupling rod from first to last driver pin
        g, z0 = rod(f"rod-{side}{t}", max(zs) - min(zs), thick=3, depth=2)
        x_inner = R.x if sx > 0 else -R.x - 2
        out.append(Part(f"rod-{side}{t}", g, pivot=(0, g.shape[1] / 2, z0), at=(x_inner, r + py, min(zs) + pz - zo)))
        # main rod from the main driver pin forward to the crosshead
        main = _axle_of(s, R.main)
        g2, z2 = rod(f"mainrod-{side}{t}", R.main_len, thick=3, depth=2, ramp=("steel", 6))
        my, mz = r + py, main.z + pz
        dy = R.slide_y - my
        dz = -math.sqrt(max(1e-6, R.main_len ** 2 - dy ** 2))
        beta = math.atan2(dy, -dz)
        # the rod grid runs toward +z from its pin; turn it to point forward (-z) and up/down to the crosshead
        x2 = R.x + 2 if sx > 0 else -R.x - 4
        out.append(Part(f"mainrod-{side}{t}", g2, pivot=(0, g2.shape[1] / 2, z2), at=(x2, my, mz - zo),
                        rot=(math.degrees(beta) + 180.0, 0.0, 0.0)))
        # crosshead block on the slide bars
        ch = Grid(2, 6, 6)  # in line with the main rod, inside the +/-24 loading gauge
        ch.box(0, 0, 0, 2, 6, 6, RK.C("steel", 6))
        x3 = R.x + 2 if sx > 0 else -R.x - 4
        out.append(Part(f"crosshead-{side}{t}", ch, pivot=(0, 3, 3), at=(x3, R.slide_y, mz + dz - zo)))
    return out


def _rod_keys(s: Stock, R: Rods, keys, dist_of, zo: float) -> None:
    t_ = R.tag
    main = _axle_of(s, R.main)
    r = main.r
    n = round(MOVE_SECONDS * FPS)
    for side, phase in (("l", 0.0), ("r", math.pi / 2)):
        py0, pz0 = crank_pin(0.0, R.crank, phase)
        my0, mz0 = r + py0, main.z + pz0
        dy0 = R.slide_y - my0
        dz0 = -math.sqrt(R.main_len ** 2 - dy0 ** 2)
        beta0 = math.atan2(dy0, -dz0)
        for f in range(n + 1):
            t = f / FPS
            th = -dist_of(t) / r
            py, pz = crank_pin(th, R.crank, phase)
            keys.setdefault(f"rod-{side}{t_}", {}).setdefault("loc", []).append((t, (0.0, py - py0, pz - pz0)))
            my, mz = r + py, main.z + pz
            dy = R.slide_y - my
            dz = -math.sqrt(R.main_len ** 2 - dy ** 2)
            beta = math.atan2(dy, -dz)
            keys.setdefault(f"mainrod-{side}{t_}", {}).setdefault("loc", []).append((t, (0.0, py - py0, pz - pz0)))
            keys[f"mainrod-{side}{t_}"].setdefault("rot", []).append((t, (math.degrees(beta - beta0), 0.0, 0.0)))
            keys.setdefault(f"crosshead-{side}{t_}", {}).setdefault("loc", []).append((t, (0.0, 0.0, (mz + dz) - (mz0 + dz0))))


# ---------------------------------------------------------------- clips
def vehicle_clips(s: Stock, wheels: dict[str, int], zo: float) -> list[Clip]:
    n = round(MOVE_SECONDS * FPS)
    speed = MOVE_DISTANCE / MOVE_SECONDS
    keys: dict = {}
    for name, r in wheels.items():
        turns = MOVE_DISTANCE / (2 * math.pi * r)
        if abs(turns - round(turns)) > 1e-9:
            raise ValueError(f"{s.name}: wheel {name} (r={r}) does not turn a whole number of times per loop")
        keys[name] = {"rot": [(f / FPS, (-360.0 * turns * f / n, 0.0, 0.0)) for f in range(n + 1)]}
    for R in s.rod_groups:
        _rod_keys(s, R, keys, lambda t: speed * t, zo)
    clips = [Clip("move", keys, loop=True, ease=0)]
    if s.idle == "diesel":  # a fast engine shudder
        clips.append(Clip("idle", {"body": {"loc": [(f / FPS, (0.0, (0.12, 0.0, 0.18, 0.04)[f % 4], 0.0)) for f in range(31)]}}, loop=True, ease=0))
    elif s.idle == "steam":  # a slow simmer
        clips.append(Clip("idle", {"body": {"loc": [(f / FPS, (0.0, 0.1 * math.sin(2 * math.pi * f / 60) ** 2, 0.0)) for f in range(61)]}}, loop=True, ease=0))
    for name, extra in s.extra_clips.items():
        clip = next((c for c in clips if c.name == name), None)
        if clip is None:
            clip = Clip(name, {}, loop=name not in ("open", "close"), ease=0 if name in ("open", "close") else None)
            clips.append(clip)
        for part, chans in extra.items():
            clip.keys.setdefault(part, {}).update(chans)
    return clips
