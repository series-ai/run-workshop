"""Ground contact for rolling n-gon wheels in vehicle move clips.

The old table in this file came from a second pass: it measured the lowest
vertex of an exported GLB and added hand offsets
(.plans/rvx-double/recovery/fantasy/derive-wheel-contact.py). The result
floated the carts 0.3-0.75 voxels above the floor and changed with each
export. This module replaces that table. It calculates the keys from the
wheel geometry at build time, so no second pass is necessary.

A wheel from pnshapes.wheel (or a pnshapes.disc tread) is a regular n-gon
with flat radius r. At rest a flat side is down, so the hub is r above the
ground. When the wheel turns by angle a, the lowest corner is
corner(r, n) * cos((a mod 2pi/n) - pi/n) below the hub. The body
must move up by that difference for the wheel to touch the ground.

With one axle line, only a lift is necessary. With two axle lines of
different radius or speed, the body also pitches about x, so that the two
axle lines touch the ground at the same time.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable

FPS = 30


def hub_drop(r: float, n: int, degrees: float) -> float:
    """Distance from the hub to the lowest point of a flat-bottom n-gon of
    flat radius r turned by `degrees` about its axle."""
    if r <= 0 or n < 3:
        raise ValueError(f"hub_drop needs r > 0 and n >= 3, got r={r}, n={n}")
    step = 2 * math.pi / n
    a = math.radians(degrees) % step - math.pi / n  # angle of the lowest corner from straight down
    return r / math.cos(math.pi / n) * math.cos(a)


@dataclass(frozen=True)
class Axle:
    """One axle line. `y` and `z` are the hub position relative to the pivot
    of the body part that carries it (voxels). `r` is the flat radius and
    `n` the side count of the wheel tread."""

    y: float
    z: float
    r: float
    n: int


def body_keys(axles: list[Axle], angles: Callable[[float], list[float]], seconds: float,
              ground: float = 0.0, shift: Callable[[float], float] | None = None):
    """Per-frame ('loc', 'rot') keys for the body that carries the axles.

    `angles(t)` gives the wheel turn of each axle in degrees (about x) at
    time t. `ground` is the height of the contact surface relative to the
    body pivot at rest. `shift(t)` is an optional z travel of the body.
    Returns (loc_keys, rot_keys); rot_keys is None for one axle line.
    The result is exact at every frame: each axle line touches the ground."""
    if not 1 <= len(axles) <= 2:
        raise ValueError("body_keys supports one or two axle lines")
    frames = round(seconds * FPS)
    if abs(frames - seconds * FPS) > 1e-6:
        raise ValueError(f"clip length {seconds} s is not a whole number of frames")
    loc, rot = [], []
    for i in range(frames + 1):
        t = seconds * i / frames
        turn = angles(t)
        dz = shift(t) if shift else 0.0
        alpha = 0.0
        for _ in range(6):  # the pitch changes the wheel turn a little; iterate to a fixed point
            d = [hub_drop(a.r, a.n, turn[k] + math.degrees(alpha)) for k, a in enumerate(axles)]
            if len(axles) == 1:
                break
            a1, a2 = axles
            # y1 cos(al) - z1 sin(al) - (y2 cos(al) - z2 sin(al)) = d1 - d2
            A, B, D = a1.y - a2.y, a1.z - a2.z, d[0] - d[1]
            R = math.hypot(A, B)
            phi = math.atan2(B, A)
            alpha = math.acos(max(-1.0, min(1.0, D / R))) - phi
            # pick the root nearest zero
            alpha = (alpha + math.pi) % (2 * math.pi) - math.pi
            if abs(alpha) > math.radians(10):
                alpha = -math.acos(max(-1.0, min(1.0, D / R))) - phi
                alpha = (alpha + math.pi) % (2 * math.pi) - math.pi
            if abs(alpha) > math.radians(10):
                raise ValueError(f"body_keys: pitch {math.degrees(alpha):.2f} deg is not a small rocking motion")
        a0 = axles[0]
        lift = ground + d[0] - (a0.y * math.cos(alpha) - a0.z * math.sin(alpha))
        loc.append((t, (0.0, lift, dz)))
        rot.append((t, (math.degrees(alpha), 0.0, 0.0)))
    return loc, (rot if len(axles) == 2 else None)


def check_rest(axles: list[Axle], ground: float = 0.0) -> None:
    """Fail loudly when a wheel does not stand on the ground at rest."""
    for a in axles:
        if abs(a.y - a.r - ground) > 1e-6:
            raise ValueError(f"axle at z={a.z}: hub y {a.y} minus r {a.r} is not on the ground {ground}")


def spin_keys(seconds: float, degrees: Callable[[float], float]):
    """Per-frame rotation keys about x from `degrees(t)`. The exporter
    samples Blender curves, which ease between sparse keys; a key at each
    frame keeps the wheel turn equal to the angle that body_keys uses."""
    frames = round(seconds * FPS)
    if abs(frames - seconds * FPS) > 1e-6:
        raise ValueError(f"clip length {seconds} s is not a whole number of frames")
    return [(seconds * i / frames, (degrees(seconds * i / frames), 0.0, 0.0)) for i in range(frames + 1)]
