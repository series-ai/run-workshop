"""Shared timing helpers for the space creature deaths.

`back_fall` keys a fall onto the back for an upright body whose root is
the part that topples: a jolt back, a rock forward against it, then one
unbroken stroke over backwards that starts slowly and speeds up into the
impact frame, one small bounce and a hard settle. While it topples the
root's location is solved so that the rear edge of the feet (`heel`, an
offset from the root pivot in voxels: (dy, dz)) stays pinned to the floor,
so the body hinges on its heels instead of hopping. Keys are frames at
30 fps; values are glTF degrees and voxels.
"""
from __future__ import annotations

import math
import os

F = 1 / 30
# SP_CAL=1 builds the deaths without the floor rule, to measure how far a
# lying pose sinks (calibration only).
DEATH_FLOOR = False if os.environ.get("SP_CAL") == "1" else None


def _pin(heel, ax: float):
    """Root offset that keeps `heel` fixed while the root turns `ax` degrees
    about x (backwards is +x: the top goes to +z)."""
    dy, dz = heel
    a = math.radians(ax)
    ry = dy * math.cos(a) - dz * math.sin(a)
    rz = dy * math.sin(a) + dz * math.cos(a)
    return dy - ry, dz - rz


def back_fall(heel, *, jolt: float = 7.0, rock: float = -5.0, f_jolt: int = 3, f_rock: int = 9, f_hit: int = 28,
              lie: float = 91.0, bounce_deg: float = 3.0, bounce_up: float = 1.0, drop: float = 0.4, end: int = 54,
              roll: float = 3.0, power: float = 2.0, twist: float = 0.0, fold=None):
    """Root rot and loc keys (lists of (seconds, xyz)) and the impact time.
    `fold` [(frame, degrees), ...]: the legs (pivoting on the root's own axis)
    fold by this much more than the root, and the pin follows the feet."""
    def phi(f):
        if not fold:
            return 0.0
        pts = [(0, 0.0)] + list(fold)
        for (f0, a0), (f1, a1) in zip(pts, pts[1:]):
            if f0 <= f <= f1:
                return a0 + (a1 - a0) * (f - f0) / max(1, f1 - f0)
        return pts[-1][1]

    poses = [(0, 0.0, 0.0), (f_jolt, jolt, 0.0), (f_rock, rock, 0.0)]
    span = f_hit - f_rock
    for f in range(f_rock + 2, f_hit, 2):
        u = (f - f_rock) / span
        poses.append((f, rock + (lie - rock) * u ** power, 0.0))
    poses += [(f_hit, lie, -drop), (f_hit + 3, lie - bounce_deg, -drop + bounce_up), (f_hit + 6, lie + 0.4, -drop),
              (f_hit + 9, lie, -drop), (end, lie, -drop)]
    if fold:
        have = {p[0] for p in poses}
        for f, _ in fold:
            if f not in have and f_rock < f < f_hit:
                u = (f - f_rock) / span
                poses.append((f, rock + (lie - rock) * u ** power, 0.0))
        poses.sort()
    rot, loc = [], []
    for f, ax, up in poses:
        k = 0.0 if f <= f_rock else min(1.0, (f - f_rock) / span)
        rot.append((f * F, (ax, twist * k, roll * k)))
        py, pz = _pin(heel, ax + phi(f))
        loc.append((f * F, (0.0, py + up, pz)))
    return rot, loc, f_hit * F


def curve(*pairs):
    """keys from (frame, value-tuple) pairs."""
    return [(f * F, tuple(float(c) for c in v)) for f, v in pairs]


def topple(heel, *, beats, f_hit: int, lie: float, lead: float = 0.22, power: float = 2.6, bounce_up: float = 1.0,
           bounce_deg: float = 1.5, f_up: int = 2, f_down: int = 4, end: int = 54, roll: float = 0.0, twist: float = 0.0,
           sink: float = 0.0, over: float = 0.0):
    """A fall onto the back with no dead hang: root rot and loc keys and the
    impact time.

    `beats` [(frame, degrees), ...] start at (0, 0) and key the jolt and rock
    before the fall (+ is backwards); the last beat is where the fall starts.
    From there the root is keyed every frame: it starts moving at once (a
    `lead` share of linear travel, so the teeter never freezes) and
    accelerates (`power`) into the impact key at `lie`, with the heel pinned
    to the floor the whole way. One small bounce (`bounce_up` voxels, the
    body pitching up `bounce_deg`) peaks `f_up` frames after the thud and
    lands `f_down` frames after it, then a hard settle. The impact key turns
    `over` degrees past `lie`, so the thud is the flattest frame. `sink` lowers the
    lying poses so the exporter's floor rule seats them exactly on the floor."""
    f0, a0 = beats[-1]
    span = f_hit - f0
    hit = lie + over
    poses = [(f, a, 0.0) for f, a in beats]
    for f in range(f0 + 1, f_hit):
        u = (f - f0) / span
        poses.append((f, a0 + (hit - a0) * (lead * u + (1 - lead) * u ** power), 0.0))
    poses += [(f_hit, hit, -sink), (f_hit + f_up, lie - bounce_deg, bounce_up - sink), (f_hit + f_down, lie + 0.3, -sink),
              (f_hit + f_down + 3, lie, -sink), (end, lie, -sink)]
    rot, loc = [], []
    for f, ax, up in poses:
        k = 0.0 if f <= f0 else min(1.0, (f - f0) / span)
        rot.append((f * F, (ax, twist * k, roll * k)))
        py, pz = _pin(heel, ax)
        loc.append((f * F, (0.0, py + up, pz)))
    return rot, loc, f_hit * F
