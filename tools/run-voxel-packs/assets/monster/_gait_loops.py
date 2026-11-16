"""Shared maths for the `move` loops of the zombie ghoul, werewolf,
scarecrow fiend, swamp creature, vampire bat and wailing ghost (monster
pack). Only those creatures use this module.

Every loop is keyed once per frame (play with Clip(ease=0)), so contacts
and accelerations are exact; the last frame repeats the first.
Coordinates are the voxel frame: x, y up, z back (models face -Z).
Rotations are XYZ euler degrees, matrix = Rz @ Ry @ Rx (Blender's XYZ).
"""
from __future__ import annotations

import math

import numpy as np

FPS = 30
G = 600.0 / (FPS * FPS)  # 30 m/s^2 at ~20 voxels a metre, in voxels per frame^2


def fr(n: float) -> float:
    return n / FPS


def per_frame(T: int, fn):
    """Keys at every frame 0..T of a loop; frame T repeats frame 0 exactly."""
    out = []
    for f in range(T + 1):
        v = fn(f % T)
        out.append((fr(f), tuple(float(c) for c in v)))
    return out


def cyc(f: float, T: int, pts) -> float:
    """A periodic curve through (frame, value) points, cosine-blended
    between them (for continuous gait channels: sways, swings)."""
    pts = sorted(pts)
    f = f % T
    ext = [(pts[-1][0] - T, pts[-1][1])] + pts + [(pts[0][0] + T, pts[0][1])]
    for (f0, v0), (f1, v1) in zip(ext, ext[1:]):
        if f0 <= f <= f1:
            u = 0.0 if f1 == f0 else (f - f0) / (f1 - f0)
            return v0 + (v1 - v0) * (1 - math.cos(math.pi * u)) / 2
    return pts[0][1]


def pulse(d: int, table: dict) -> float:
    """A per-frame accent: table[frames since the event], 0 elsewhere."""
    return table.get(d, 0.0)


def rmat(deg) -> np.ndarray:
    x, y, z = (math.radians(a) for a in deg)
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def euler(M: np.ndarray):
    """XYZ euler degrees of a rotation matrix (inverse of rmat)."""
    y = math.asin(max(-1.0, min(1.0, -M[2, 0])))
    x = math.atan2(M[2, 1], M[2, 2])
    z = math.atan2(M[1, 0], M[0, 0])
    return (math.degrees(x), math.degrees(y), math.degrees(z))


def hop_height(d: int, ground: int, air: int) -> float:
    """Root height `d` frames after a landing for a rigid hopper: on the
    floor for `ground` frames, then a ballistic arc of `air` frames that
    lands at full speed on the next contact."""
    if d < ground:
        return 0.0
    t = d - ground
    vy = G * air / 2
    return max(0.0, vy * t - G * t * t / 2)


def shift(clip: dict, T: int, k: int) -> dict:
    """Start a per-frame loop `k` frames later, so the loop point falls in a
    smooth stretch (mid-air, mid-stance) rather than on a footfall: the seam
    check compares the speed of the first and last frame steps."""
    out = {}
    for part, chans in clip.items():
        out[part] = {}
        for ch, ks in chans.items():
            assert len(ks) == T + 1, (part, ch, len(ks))
            vals = [v for _, v in ks]
            out[part][ch] = [(t, vals[(f + k) % T]) for f, (t, _) in enumerate(ks)]
    return out
