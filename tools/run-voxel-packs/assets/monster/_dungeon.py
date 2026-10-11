"""Helpers for the monster dungeon kit on the PN 16-voxel tile.

The kit pieces share one wall profile so they join flush: KIT_H tall,
KIT_T thick, a full-depth plinth and cap, and a body one voxel thinner on
each face (room for 1-voxel reliefs: chains, rings, sills). Stone courses
are KIT_COURSE high everywhere, so courses line up from piece to piece.
"""
from __future__ import annotations

import math

import numpy as np

from _kit import C, Grid, exposed, moss, ramp_mask, shift, xyz

KIT_TILE = 16  # PN tile
KIT_H = 56  # wall height: one tall storey
KIT_T = 8  # wall thickness
KIT_COURSE = 4  # stone course height
PLINTH = 4  # plinth course height (full depth)
CAP0 = 50  # cap course starts here (full depth)
COPING0 = 52  # coping (inset one voxel) from here to KIT_H


def side_exposed(g: Grid) -> np.ndarray:
    """Filled voxels with an empty x or z neighbour (side faces only)."""
    return exposed(g, 0, 1) | exposed(g, 0, -1) | exposed(g, 2, 1) | exposed(g, 2, -1)


def ashlar(g: Grid, seed: int, course: int = KIT_COURSE, lo: int = 5, hi: int = 10, recess: bool = True, mask: np.ndarray | None = None, ramp: str = "stone") -> Grid:
    """Irregular dungeon ashlar on every `ramp` voxel (optionally inside `mask`):
    fixed-height courses, random block lengths lo..hi-1 per course, dark mortar,
    ±1 shade per block. With `recess`, mortar on side faces is sunk one voxel
    (real grooves), and the voxel behind shows the dark mortar."""
    rng = np.random.default_rng(seed)
    sx, sy, sz = g.shape
    x, y, z = xyz(g)
    along = np.broadcast_to(x + z, g.a.shape)
    rows = sy // course + 2
    span = sx + sz + hi + 2
    joint = np.zeros((rows, span), bool)
    block = np.zeros((rows, span), np.int16)
    jitter = np.zeros((rows, span), np.int16)
    for r in range(rows):
        p = -int(rng.integers(0, hi))
        k = 0
        while p < span:
            if p >= 0:
                joint[r, p] = True
            n = int(rng.integers(lo, hi))
            j = int(rng.choice([-1, 0, 0, 1, 1]))
            for q in range(max(p, 0), min(p + n, span)):
                block[r, q] = k
                jitter[r, q] = j
            p += n
            k += 1
    row = np.broadcast_to(y // course, g.a.shape)
    m = ramp_mask(g, ramp)
    if mask is not None:
        m &= np.broadcast_to(mask, g.a.shape)
    a_idx = np.clip(along, 0, span - 1)
    r_idx = np.clip(row, 0, rows - 1)
    is_mortar = m & ((np.broadcast_to(y, g.a.shape) % course == 0) | joint[r_idx, a_idx])
    stone = m & ~is_mortar
    shift(g, stone, jitter[r_idx, a_idx].astype(np.int16) * stone)
    shift(g, is_mortar, -2)
    if recess:
        face = is_mortar & side_exposed(g)
        # keep the bottom row and the top row of the piece whole
        face &= (np.broadcast_to(y, g.a.shape) > 0)
        top = exposed(g, 1, 1)
        face &= ~top
        g.a[face] = 0
    return g


def damp(g: Grid, seed: int, n: int, face: str = "-z", y_hi: int | None = None, length=(6, 20), x_range=None, ramp: str = "khaki") -> Grid:
    """Damp streaks running down a face: the front voxel of each column gets a
    darker, greenish tint. `face` is -z, +z, -x or +x."""
    rng = np.random.default_rng(seed)
    sx, sy, sz = g.shape
    filled = g.a != 0
    y_hi = sy - 2 if y_hi is None else y_hi
    for _ in range(n):
        u_max = sx if face in ("-z", "+z") else sz
        lo_u, hi_u = x_range if x_range else (1, u_max - 1)
        u = int(rng.integers(lo_u, hi_u))
        top = int(rng.integers(max(2, y_hi - 10), y_hi))
        ln = int(rng.integers(*length))
        for yy in range(max(0, top - ln), top):
            if face in ("-z", "+z"):
                col = filled[u, yy, :]
                idx = np.nonzero(col)[0]
                if not len(idx):
                    continue
                w = idx[0] if face == "-z" else idx[-1]
                pos = (u, yy, w)
            else:
                col = filled[:, yy, u]
                idx = np.nonzero(col)[0]
                if not len(idx):
                    continue
                w = idx[0] if face == "-x" else idx[-1]
                pos = (w, yy, u)
            v = int(g.a[pos])
            if v // 8 == C("stone", 0) // 8:
                t = (top - yy) / max(1, ln)
                g.a[pos] = C(ramp, 1) if t < 0.5 and (yy % 3) else C("stone", max(1, v % 8 - 1))
    return g


def crack(g: Grid, seed: int, start, steps: int, face: str = "-z") -> Grid:
    """A zigzag crack going down a face from `start` (x, y): sunk one voxel."""
    rng = np.random.default_rng(seed)
    u, yy = start
    sx, sy, sz = g.shape
    for _ in range(steps):
        if face in ("-z", "+z"):
            idx = np.nonzero(g.a[u, yy, :])[0]
            if len(idx) > 1:
                w = idx[0] if face == "-z" else idx[-1]
                g.a[u, yy, w] = 0
                w2 = idx[1] if face == "-z" else idx[-2]
                g.a[u, yy, w2] = C("iron", 0)
        yy -= 1
        u += int(rng.choice([-1, 0, 0, 1]))
        u = min(max(u, 1), sx - 2)
        if yy < 1:
            break
    return g


def line_local(g: Grid, p0, p1, r0: float, r1: float, c: int) -> Grid:
    """Tapered capsule from p0 (radius r0) to p1 (radius r1), evaluated only in
    the local bounding box (fast for many small branches)."""
    p0 = np.array(p0, float)
    p1 = np.array(p1, float)
    rm = max(r0, r1) + 1
    lo = np.maximum(np.floor(np.minimum(p0, p1) - rm).astype(int), 0)
    hi = np.minimum(np.ceil(np.maximum(p0, p1) + rm).astype(int), np.array(g.shape))
    if np.any(hi <= lo):
        return g
    xs = np.arange(lo[0], hi[0])[:, None, None] + 0.5
    ys = np.arange(lo[1], hi[1])[None, :, None] + 0.5
    zs = np.arange(lo[2], hi[2])[None, None, :] + 0.5
    d = p1 - p0
    L2 = float(d @ d) or 1e-9
    t = np.clip(((xs - p0[0]) * d[0] + (ys - p0[1]) * d[1] + (zs - p0[2]) * d[2]) / L2, 0, 1)
    dist2 = (xs - (p0[0] + t * d[0])) ** 2 + (ys - (p0[1] + t * d[1])) ** 2 + (zs - (p0[2] + t * d[2])) ** 2
    r = r0 + (r1 - r0) * t
    m = dist2 <= r * r
    sub = g.a[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]]
    sub[m] = c
    return g


def wall_torch(g: Grid, x: int, y: int, z_back: int, z_front: int) -> Grid:
    """Wall torch standing in a niche: iron cup and bracket on the back wall at
    z_back, a 1×1 handle, a pitch-wrapped head and a 3-voxel flame, all between
    z_front and z_back (the torch sits at z_front+1)."""
    zt = z_front + 1
    g.box(x - 1, y, z_back - 1, x + 2, y + 1, z_back + 1, C("iron", 2))  # bracket plate
    g.box(x, y, zt, x + 1, y + 7, zt + 1, C("darkwood", 3))  # handle
    g.box(x - 1, y + 2, zt - 1, x + 2, y + 3, zt + 2, C("iron", 3))  # cup ring
    g.box(x, y + 1, zt + 1, x + 1, y + 3, z_back, C("iron", 3))  # arm to the wall
    g.box(x - 1, y + 5, zt - 1, x + 2, y + 8, zt + 2, C("sand", 3))  # pitch wrap
    g.box(x - 1, y + 6, zt - 1, x + 2, y + 7, zt + 2, C("iron", 1))
    g.box(x - 1, y + 8, zt - 1, x + 2, y + 10, zt + 2, C("ember", 4))
    g.set(x, y + 10, zt, C("ember", 6)).set(x, y + 11, zt, C("gold", 7)).set(x, y + 9, zt - 1, C("gold", 7))
    return g


def soot(g: Grid, x0: int, x1: int, y0: int, y1: int, face_z: int) -> Grid:
    """Darken a soot patch on the -z face voxels at depth face_z..face_z+2."""
    x, y, z = xyz(g)
    m = (x >= x0) & (x < x1) & (y >= y0) & (y < y1) & (z >= face_z) & (z < face_z + 3)
    return shift(g, np.broadcast_to(m, g.a.shape) & ramp_mask(g, "stone"), -2)


def kit_moss(g: Grid, seed: int, amount: float = 0.14, low: int = 12, high: int = CAP0, mid: float = 0.2) -> Grid:
    """Moss on upward faces: full `amount` below `low` and from `high` up,
    `mid` times as much in between (damp foot and top, cleaner face)."""
    before = g.a.copy()
    moss(g, seed, amount)
    _x, y, _z = xyz(g)
    rng = np.random.default_rng(seed + 7)
    keep = (y < low) | (y >= high) | (rng.random(g.a.shape) < mid)
    changed = before != g.a
    g.a[changed & ~np.broadcast_to(keep, g.a.shape)] = before[changed & ~np.broadcast_to(keep, g.a.shape)]
    return g


def flagstones(seed: int, n: int, lo: int = 5, hi: int = 12):
    """Split an n×n square into flagstone rectangles (x0, z0, x1, z1), sides
    lo..hi. Returns the list; joints fall on each rectangle's low edges only, so
    the tile repeats without double mortar lines."""
    rng = np.random.default_rng(seed)
    out = []

    def split(x0, z0, x1, z1):
        w, d = x1 - x0, z1 - z0
        if w <= hi and d <= hi and (rng.random() < 0.6 or (w < 2 * lo and d < 2 * lo)):
            out.append((x0, z0, x1, z1))
            return
        if (w >= d and w >= 2 * lo) or d < 2 * lo:
            c = int(rng.integers(x0 + lo, x1 - lo + 1))
            split(x0, z0, c, z1)
            split(c, z0, x1, z1)
        else:
            c = int(rng.integers(z0 + lo, z1 - lo + 1))
            split(x0, z0, x1, c)
            split(x0, c, x1, z1)

    split(0, 0, n, n)
    return out


def arc_points(cx: float, cy: float, r: float, a0: float, a1: float, n: int):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def wall_body(g: Grid, u0: int, u1: int, axis: str = "x", w0: int = 0) -> Grid:
    """Paint the kit wall profile, running along `axis` from u0 to u1, with
    its thickness KIT_T from w0 on the other horizontal axis: plinth and cap
    at full depth, body and coping inset one voxel per face."""
    def put(ylo, yhi, inset, c):
        if axis == "x":
            g.box(u0, ylo, w0 + inset, u1, yhi, w0 + KIT_T - inset, c)
        else:
            g.box(w0 + inset, ylo, u0, w0 + KIT_T - inset, yhi, u1, c)

    put(0, PLINTH, 0, C("stone", 2))
    put(PLINTH, CAP0, 1, C("stone", 3))
    put(CAP0, COPING0, 0, C("stone", 4))
    put(COPING0, KIT_H, 1, C("stone", 3))
    return g


def arch_open(g: Grid, u0: int, u1: int, y0: int, y1: int, axis: str = "x") -> np.ndarray:
    """Round-headed opening mask: width u1-u0, from y0 up to y1 (the crown)."""
    x, y, z = xyz(g)
    u = (x if axis == "x" else z) + 0.5
    r = (u1 - u0) / 2
    cu = (u0 + u1) / 2
    spring = y1 - r
    yy = y + 0.5
    body = (u >= u0) & (u <= u1) & (yy >= y0) & (yy <= spring)
    head = ((u - cu) ** 2 + (yy - spring) ** 2 <= r * r) & (yy > spring)
    return body | head


def arch_ring(g: Grid, u0: int, u1: int, y0: int, y1: int, w0: int, w1: int, axis: str = "x", ring: int = 2, carve: bool = True) -> Grid:
    """Cut a round-headed opening through w0..w1 and frame its head with
    voussoirs (light stones, radial joints) `ring` voxels wide."""
    x, y, z = xyz(g)
    u = (x if axis == "x" else z) + 0.5
    w = z if axis == "x" else x
    r = (u1 - u0) / 2
    cu = (u0 + u1) / 2
    spring = y1 - r
    yy = y + 0.5
    d = np.sqrt((u - cu) ** 2 + (yy - spring) ** 2)
    band = (d > r) & (d <= r + ring) & (yy > spring - 0.5)
    jamb = (abs(u - cu) > r) & (abs(u - cu) <= r + ring) & (yy >= y0) & (yy <= spring) & ((np.floor(yy) % 8) < 4)
    inw = (w >= w0) & (w < w1)
    ang = np.degrees(np.arctan2(yy - spring, u - cu))
    joint = (np.floor(ang / 22.5 + 0.5) * 22.5 - ang)
    ring_m = np.broadcast_to((band | jamb) & inw, g.a.shape) & (g.a != 0)
    g.where(ring_m, C("stone", 5))
    g.where(ring_m & np.broadcast_to(band & (abs(joint) < 3.5), g.a.shape), C("stone", 3))
    if carve:
        g.carve(np.broadcast_to(arch_open(g, u0, u1, y0, y1, axis) & inw, g.a.shape))
    return g
