"""Lay track pieces end to end by mating connectors (pure Python).

The same maths as the runtime helper (viewer/trackpath.js): a placed piece is
a turn `theta` about +Y (degrees, same sense as headings) and an offset in
x, y and z (y lifts pieces that follow a ramp). Used by the lint to prove that
layouts close exactly.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from track import Connector, PieceSpec


def rotate(x: float, z: float, theta: float) -> tuple[float, float]:
    t = math.radians(theta)
    return (x * math.cos(t) + z * math.sin(t), -x * math.sin(t) + z * math.cos(t))


@dataclass
class Placed:
    spec: PieceSpec
    theta: float
    tx: float
    tz: float
    ty: float = 0.0

    def connector(self, name: str) -> Connector:
        c = self.spec.connectors[name]
        x, z = rotate(c.p[0], c.p[2], self.theta)
        return Connector((x + self.tx, c.p[1] + self.ty, z + self.tz), (c.yaw + self.theta) % 360)


def place(spec: PieceSpec, enter: str, onto: Connector) -> Placed:
    """Place `spec` so its connector `enter` mates with world connector `onto`."""
    c = spec.connectors[enter]
    theta = (onto.yaw + 180 - c.yaw) % 360
    x, z = rotate(c.p[0], c.p[2], theta)
    return Placed(spec, theta, onto.p[0] - x, onto.p[2] - z, onto.p[1] - c.p[1])


def chain(steps: list[tuple[PieceSpec, str, str]], start: Connector | None = None) -> tuple[list[Placed], Connector]:
    """Lay (piece, enter, leave) steps end to end; the first enters at `start`
    (default: the origin, facing +Z, so the track runs toward -Z)."""
    onto = start or Connector((0.0, 0.0, 0.0), 0.0)
    placed = []
    for spec, enter, leave in steps:
        p = place(spec, enter, onto)
        placed.append(p)
        onto = p.connector(leave)
    return placed, onto


def mates(a: Connector, b: Connector, tol: float = 1e-6) -> bool:
    d = abs(((a.yaw - b.yaw) % 360) - 180)
    return math.dist(a.p, b.p) <= tol and d <= 1e-6


def same(a: Connector, b: Connector, tol: float = 1e-6) -> bool:
    d = (a.yaw - b.yaw) % 360
    return math.dist(a.p, b.p) <= tol and min(d, 360 - d) <= 1e-6


def on_lattice(c: Connector, step: float, tol: float = 1e-6) -> bool:
    return all(abs(v / step - round(v / step)) <= tol for v in c.p) and abs(c.yaw / 45 - round(c.yaw / 45)) <= 1e-6
