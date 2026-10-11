"""Shared painters for the repaired apocalypse terrain models (import as `_rep_terrain`).

Scope: the Art Director repairs of terrain-nature/charred-stumps,
cactus-cluster, tumbleweed-patch and dry-riverbed. Originals do not import
this module, so a change here cannot change an original GLB.

    soft_ground     natural ground: big soft patches and a darker rim, no tile grid
    char            charred wood: a dark base with broken vertical grain cracks
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
from _life import ctr
from voxgrid import Grid


def soft_ground(g: Grid, mask: np.ndarray, ramp: str, base: int, patches, cx: float, cz: float, rim_r: float) -> None:
    """Paint natural ground on `mask`. Each patch is (x, z, rx, rz, delta):
    a wobbly ellipse one or two shades lighter (delta > 0) or darker
    (delta < 0) than `base`. Voxels farther than `rim_r` from (cx, cz) get
    a darker rim. The patches are large, so there is no per-texel speckle
    (rule S3) and no tile grid."""
    if not patches:
        raise ValueError("soft_ground needs at least one patch")
    X, Y, Z = ctr(g)
    P.flat(g, mask, ramp, base)
    for k, (px, pz, rx, rz, delta) in enumerate(patches):
        if not -2 <= delta <= 2 or delta == 0:
            raise ValueError(f"patch delta {delta} must be -2..-1 or 1..2")
        ang = np.arctan2(Z - pz, X - px)
        wob = 1.0 + 0.18 * np.sin(ang * 3 + k * 1.7) + 0.08 * np.sin(ang * 5 + k)
        d = np.hypot((X - px) / rx, (Z - pz) / rz)
        P.flat(g, mask & (d < wob), ramp, base + delta)
    P.flat(g, mask & (np.hypot(X - cx, Z - cz) > rim_r), ramp, base - 1)
    P.flat(g, mask & (Y < 1.2), ramp, base - 2)


def char(g: Grid, mask: np.ndarray, base: int = 2, seed: int = 0) -> None:
    """Charred wood on `mask` (darkwood ramp): a flat dark base with long
    vertical grain cracks one shade darker. Each crack line breaks every
    few voxels, so the wood does not read as brick courses. Contrast is
    in the cracks only (rule S3)."""
    if base < 1:
        raise ValueError("char base shade must be 1 or more (the cracks use base - 1)")
    X, Y, Z = ctr(g)
    u = np.floor(X + Z).astype(np.int64)
    run = np.floor(Y / 5).astype(np.int64)
    gap = P._hash(u, run, seed=seed) % np.uint64(3) == 0
    crack = (u % 3 == 0) & ~gap
    P.flat(g, mask, "darkwood", base)
    P.flat(g, mask & crack, "darkwood", base - 1)


def ring_angles(n: int, seed: int) -> list[float]:
    """`n` irregular angles round a circle (no even spacing, so a ring of
    shards does not read as a crenellated crown)."""
    rng = np.random.default_rng(seed)
    a = np.sort(rng.uniform(0, 2 * math.pi, n))
    return [float(v) for v in a]
