"""Building-scale helpers for the post-apocalypse pack (import as `_bldg`).

These helpers author buildings at the shared scale standard
(contracts/data/scale.json): a person is 36 voxels, doors are 42-56 tall,
storeys 40-52, windows 12-20. They paint structured 1-voxel detail
(courses, planks, panels, frames) instead of random noise, so large walls
stay cheap for the greedy mesher.

Wall conventions: `normal` is the outward face ('-z', '+z', '-x', '+x');
`plane` is the grid index of the outer voxel layer of that wall; `u` is the
other horizontal axis (x for z walls, z for x walls); `v` is y; `depth` 0 is
the outer layer, positive depth goes into the wall, negative depth stands
out of it.
"""
from __future__ import annotations

import math
import random

import numpy as np

from voxgrid import C, PALETTE, RAMP_SHADES, Grid

# ---------------------------------------------------------------- colour


def vshift(g: Grid, mask, delta: int):
    """Vectorised shade shift of filled voxels in mask (clamped in the ramp)."""
    m = np.broadcast_to(mask, g.shape) & (g.a > 0)
    a = g.a[m].astype(np.int16)
    ramp, shade = a // RAMP_SHADES, a % RAMP_SHADES
    lo = np.where(ramp == 0, 1, 0)
    g.a[m] = (ramp * RAMP_SHADES + np.clip(shade + delta, lo, RAMP_SHADES - 1)).astype(np.uint8)
    return g


def hash2(a, b, seed: int = 0):
    """Deterministic integer hash of two int arrays (vectorised)."""
    a = np.asarray(a, dtype=np.int64)
    b = np.asarray(b, dtype=np.int64)
    with np.errstate(over="ignore"):
        h = (a * 73856093) ^ (b * 19349663) ^ np.int64(seed * 83492791 + 0x5BD1E995)
        h = (h ^ (h >> 13)) * np.int64(1274126177)
        return np.abs(h ^ (h >> 16))


def _paint(g: Grid, m, ramp: str, shades):
    rid = PALETTE["ramps"][ramp]
    lo = 1 if rid == 0 else 0
    g.a[m] = (rid * RAMP_SHADES + np.clip(shades[m], lo, RAMP_SHADES - 1)).astype(np.uint8)


def masonry(g: Grid, mask, u_axis: int, ramp: str, shade: int, course: int = 3, length: int = 6, seed: int = 0,
            mortar_delta: int = -2, var=(-1, 0, 0, 0, 1), v0: int = 0):
    """Running-bond bricks on the voxels of mask; u_axis runs along the wall."""
    m = np.broadcast_to(mask, g.shape) & (g.a > 0)
    idx = np.indices(g.shape)
    u, y = idx[u_axis], idx[1] - v0
    row = y // course
    along = u + (row % 2) * (length // 2)
    col = along // length
    jit = np.asarray(var)[hash2(row, col, seed) % len(var)]
    sh = shade + jit
    sh = np.where((y % course == 0) | (along % length == 0), shade + mortar_delta, sh)
    _paint(g, m, ramp, sh)
    return g


def panels(g: Grid, mask, u_axis: int, ramp: str, shade: int, pw: int = 16, ph: int = 12, seed: int = 0,
           joint_delta: int = -2, var=(-1, 0, 0, 1), u0: int = 0, v0: int = 0):
    """Precast panels / sheet cladding: joints every pw along u and ph along y."""
    m = np.broadcast_to(mask, g.shape) & (g.a > 0)
    idx = np.indices(g.shape)
    u, y = idx[u_axis] - u0, idx[1] - v0
    jit = np.asarray(var)[hash2(u // pw, y // ph, seed) % len(var)]
    sh = np.where((u % pw == 0) | (y % ph == 0), shade + joint_delta, shade + jit)
    _paint(g, m, ramp, sh)
    return g


def planks(g: Grid, mask, along_axis: int, across_axis: int, ramp: str, shade: int, width: int = 3, seed: int = 0,
           seam_delta: int = -2, end: int = 24, var=(-1, 0, 0, 1)):
    """Boards running along `along_axis`, `width` voxels wide across
    `across_axis`, with dark seams, staggered board ends and per-board shade."""
    m = np.broadcast_to(mask, g.shape) & (g.a > 0)
    idx = np.indices(g.shape)
    a, b = idx[along_axis], idx[across_axis]
    board = b // width
    stag = (hash2(board, board * 3, seed) % end)
    seg = (a + stag) // end
    jit = np.asarray(var)[hash2(board, seg, seed + 1) % len(var)]
    sh = shade + jit
    sh = np.where((b % width == 0) | ((a + stag) % end == 0), shade + seam_delta, sh)
    _paint(g, m, ramp, sh)
    return g


def ribs(g: Grid, mask, u_axis: int, ramp: str, shade: int, period: int = 3, delta: int = -1, seam: int = 0):
    """Corrugated sheet: a darker rib every `period` voxels along u; optional
    horizontal sheet laps every `seam` voxels."""
    m = np.broadcast_to(mask, g.shape) & (g.a > 0)
    idx = np.indices(g.shape)
    sh = np.where(idx[u_axis] % period == 0, shade + delta, shade)
    if seam:
        sh = np.where(idx[1] % seam == 0, shade - 2, sh)
    _paint(g, m, ramp, np.broadcast_to(sh, g.shape))
    return g


def blotches(g: Grid, mask, seed: int, cell: int = 5, chance: int = 5, delta: int = -1):
    """Soft stains: shift cells (cell x cell, on a hashed lattice) by delta."""
    m = np.broadcast_to(mask, g.shape) & (g.a > 0)
    idx = np.indices(g.shape)
    h = hash2(idx[0] // cell + idx[2] // cell * 7, idx[1] // cell, seed)
    return vshift(g, m & (h % chance == 0), delta)


# ---------------------------------------------------------------- wall space


def _axes(normal: str):
    axis = 2 if normal[1] == "z" else 0
    out = -1 if normal[0] == "-" else 1
    return axis, 2 - axis, out


def wmask(shape, normal: str, plane: int, u0, u1, v0, v1, d0: int = 0, d1: int = 1):
    """Mask of wall-space box: u in [u0,u1), y in [v0,v1), depth in [d0,d1)."""
    axis, uax, out = _axes(normal)
    lo = [0, int(v0), 0]
    hi = [0, int(v1), 0]
    lo[uax], hi[uax] = int(u0), int(u1)
    if out < 0:
        lo[axis], hi[axis] = plane + d0, plane + d1
    else:
        lo[axis], hi[axis] = plane - d1 + 1, plane - d0 + 1
    m = np.zeros(shape, bool)
    sl = tuple(slice(max(0, lo[i]), max(0, min(shape[i], hi[i]))) for i in range(3))
    m[sl] = True
    return m


def wbox(g: Grid, normal: str, plane: int, u0, u1, v0, v1, d0: int, d1: int, c: int):
    g.a[wmask(g.shape, normal, plane, u0, u1, v0, v1, d0, d1)] = c
    return g


def wset(g: Grid, normal: str, plane: int, u, v, d, c: int):
    return wbox(g, normal, plane, u, u + 1, v, v + 1, d, d + 1, c)


GLASS = {"dark": ("navy", 1), "lit": ("ember", 5), "broken": ("iron", 0), "boarded": ("navy", 1), "grime": ("teal", 1)}


def win(g: Grid, normal: str, plane: int, u0: int, v0: int, w: int, h: int, style: str = "dark", frame=None,
        wall: int = 2, sill=None, lintel=None, mullion: bool = True, transom: bool = False, seed: int = 0,
        shutters=None, board=None):
    """A framed window: opening w x h (inside the frame) with its lower-left
    (u0, v0). Frame 1 voxel around the opening at depth 0; glass at depth
    `wall`-1; mullion/transom bars; projecting sill and lintel. Styles: dark,
    lit, broken (shards + dark void), boarded (planks nailed across), grime."""
    rng = random.Random(seed)
    frame = frame if frame is not None else C("iron", 3)
    gd = max(1, wall - 1)
    wbox(g, normal, plane, u0 - 1, u0 + w + 1, v0 - 1, v0 + h + 1, 0, 1, frame)
    wbox(g, normal, plane, u0, u0 + w, v0, v0 + h, 0, gd, 0)
    gr, gs = GLASS[style if style in GLASS else "dark"]
    wbox(g, normal, plane, u0, u0 + w, v0, v0 + h, gd, gd + 1, C(gr, gs))
    if style in ("dark", "grime", "boarded"):
        for k in range(min(w, h) // 2):  # diagonal glint
            wset(g, normal, plane, u0 + 1 + k, v0 + h - 2 - k, gd, C("sky", 3 if style != "grime" else 2))
        if style == "grime":
            wbox(g, normal, plane, u0, u0 + w, v0, v0 + max(1, h // 4), gd, gd + 1, C("teal", 0))
    if style == "lit":
        wbox(g, normal, plane, u0, u0 + w, v0 + h - 2, v0 + h, gd, gd + 1, C("ember", 6))
    if mullion and w >= 6 and style != "broken":
        wbox(g, normal, plane, u0 + w // 2, u0 + w // 2 + 1, v0, v0 + h, gd - 1 if gd > 1 else gd, gd + 1, frame)
    if (transom or (mullion and h >= 12)) and style != "broken":
        tv = v0 + (h * 2) // 3
        wbox(g, normal, plane, u0, u0 + w, tv, tv + 1, gd - 1 if gd > 1 else gd, gd + 1, frame)
    if style == "broken":
        wbox(g, normal, plane, u0, u0 + w, v0, v0 + h, gd, gd + 1, C("iron", 0))
        for k in range(max(2, w // 3)):  # jagged shards on the frame edges
            wset(g, normal, plane, u0 + k, v0 + h - 1 - k // 2, gd - 1, C("sky", 4))
            wset(g, normal, plane, u0 + w - 1 - k // 2, v0 + k, gd - 1, C("sky", 3))
        wset(g, normal, plane, u0, v0 + h - 2, gd - 1, C("sky", 5))
    if style == "boarded":
        bc = board or ("wood", 4)
        rows = [v0 + 1 + i * max(4, h // 3) for i in range(3)]
        for i, rv in enumerate(rows):
            if rv + 3 > v0 + h + 1:
                continue
            tilt = rng.choice((-1, 0, 0, 1))
            for u in range(u0 - 2, u0 + w + 2):
                dv = int(round((u - u0) * tilt / max(1, w)))
                wbox(g, normal, plane, u, u + 1, rv + dv, rv + dv + 3, -1, 0, C(bc[0], bc[1] - (i % 2)))
            wset(g, normal, plane, u0 - 1, rows[i] + 1, -2, C("steel", 5))
            wset(g, normal, plane, u0 + w, rows[i] + 1 + tilt, -2, C("steel", 5))
    sill = frame if sill is None else sill
    if sill:
        wbox(g, normal, plane, u0 - 2, u0 + w + 2, v0 - 2, v0 - 1, -1, 1, sill)
    if lintel:
        wbox(g, normal, plane, u0 - 2, u0 + w + 2, v0 + h + 1, v0 + h + 3, -1, 1, lintel)
    if shutters:
        sr, ss = shutters
        for side, su in ((0, u0 - 1 - max(3, w // 2)), (1, u0 + w + 1)):
            sw = max(3, w // 2)
            if side == 1 and rng.random() < 0.4:  # one shutter hangs askew
                for k in range(sw):
                    wbox(g, normal, plane, su + k, su + k + 1, v0 - 2 - k // 2, v0 + h - 3 - k // 2, -1, 0, C(sr, ss - (k % 2)))
                continue
            wbox(g, normal, plane, su, su + sw, v0, v0 + h, -1, 0, C(sr, ss))
            for k in range(su, su + sw, 2):
                wbox(g, normal, plane, k, k + 1, v0, v0 + h, -1, 0, C(sr, ss - 1))
            wbox(g, normal, plane, su, su + sw, v0 + h // 2, v0 + h // 2 + 1, -1, 0, C(sr, ss - 2))
    return g


def door(g: Grid, normal: str, plane: int, u0: int, v0: int, w: int = 22, h: int = 48, style: str = "wood",
         leaf=("darkwood", 4), frame=None, wall: int = 2, hinge_left: bool = True, step=("stone", 5), seed: int = 0,
         sign=None):
    """A person door (w x h opening, lower-left (u0, v0)). Styles: wood
    (vertical planks + Z brace), steel (ribbed panel, kick plate), open (leaf
    swung out, dark doorway), boarded (planks nailed across a dark doorway)."""
    frame = frame if frame is not None else C("iron", 3)
    lr, ls = leaf
    wbox(g, normal, plane, u0 - 2, u0 + w + 2, v0, v0 + h + 2, -1, 1, frame)  # casing
    wbox(g, normal, plane, u0 - 3, u0 + w + 3, v0 + h + 2, v0 + h + 4, -2, 1, frame)  # head / lintel
    wbox(g, normal, plane, u0, u0 + w, v0, v0 + h, -1, wall + 1, 0)
    rd = wall  # leaf depth (recessed)
    wbox(g, normal, plane, u0, u0 + w, v0, v0 + h, rd + 1, rd + 2, C("iron", 0))  # void behind
    hu = u0 if hinge_left else u0 + w - 1
    ku = u0 + w - 3 if hinge_left else u0 + 2
    if style in ("wood", "steel"):
        if style == "wood":
            wbox(g, normal, plane, u0, u0 + w, v0, v0 + h, rd, rd + 1, C(lr, ls))
            for u in range(u0, u0 + w, 4):
                wbox(g, normal, plane, u, u + 1, v0, v0 + h, rd, rd + 1, C(lr, ls - 2))
            for bv in (v0 + 6, v0 + h - 8):
                wbox(g, normal, plane, u0 + 1, u0 + w - 1, bv, bv + 3, rd - 1, rd, C(lr, ls - 1))
            for k in range(h - 18):  # diagonal brace
                uu = u0 + 1 + int(k * (w - 3) / max(1, h - 19))
                wbox(g, normal, plane, uu, uu + 2, v0 + 9 + k, v0 + 10 + k, rd - 1, rd, C(lr, ls - 1))
        else:
            wbox(g, normal, plane, u0, u0 + w, v0, v0 + h, rd, rd + 1, C(lr, ls))
            for bv in range(v0 + 4, v0 + h - 2, 6):
                wbox(g, normal, plane, u0 + 2, u0 + w - 2, bv, bv + 1, rd, rd + 1, C(lr, ls - 2))
            wbox(g, normal, plane, u0 + 1, u0 + w - 1, v0, v0 + 5, rd - 1, rd, C(lr, ls + 1))  # kick plate
            wbox(g, normal, plane, u0 + 4, u0 + w - 4, v0 + h - 14, v0 + h - 5, rd, rd + 1, C("navy", 1))  # vision slot
        for hv in (v0 + 5, v0 + h - 7):  # hinges
            wbox(g, normal, plane, hu, hu + 1, hv, hv + 3, rd - 1, rd, C("iron", 1))
        wbox(g, normal, plane, ku, ku + 1, v0 + 22, v0 + 25, rd - 2, rd, C("steel", 6))  # handle
    elif style == "open":
        # leaf swung out 90 degrees at the hinge side, standing off the wall
        su = u0 - 1 if hinge_left else u0 + w
        for d in range(1, w - 1):
            wbox(g, normal, plane, su, su + 1, v0, v0 + h, -d, -d + 1, C(lr, ls - (1 if d % 4 == 0 else 0)))
        wbox(g, normal, plane, su, su + 1, v0 + 22, v0 + 25, -w + 3, -w + 4, C("steel", 6))
    elif style == "boarded":
        wbox(g, normal, plane, u0, u0 + w, v0, v0 + h, rd, rd + 1, C("iron", 1))
        rng = random.Random(seed)
        for i, bv in enumerate(range(v0 + 4, v0 + h - 2, 9)):
            tilt = rng.choice((-2, -1, 1, 2))
            for u in range(u0 - 2, u0 + w + 2):
                dv = int(round((u - u0) * tilt / max(1, w)))
                wbox(g, normal, plane, u, u + 1, bv + dv, bv + dv + 3, -2, -1, C("wood", 4 - (i % 2)))
            wset(g, normal, plane, u0 - 1, bv + 1, -3, C("steel", 5))
            wset(g, normal, plane, u0 + w, bv + 1 + tilt, -3, C("steel", 5))
    if step:
        wbox(g, normal, plane, u0 - 3, u0 + w + 3, v0 - 2, v0, -4, 1, C(*step))  # threshold step
    if sign:
        pass
    return g


def roller(g: Grid, normal: str, plane: int, u0: int, v0: int, w: int, h: int, open_to: int = 0, slat=("steel", 4),
           wall: int = 2, housing=("steel", 3), rail=("iron", 3)):
    """Roll-up door: opening w x h at lower-left (u0, v0). `open_to` voxels of
    the bottom are open (the curtain stops that high). Horizontal slats,
    bottom bar, side guide rails and a coil housing above the opening."""
    sr, ss = slat
    wbox(g, normal, plane, u0, u0 + w, v0, v0 + h, 0, wall + 1, 0)
    wbox(g, normal, plane, u0, u0 + w, v0, v0 + h, wall + 1, wall + 2, C("iron", 0))  # dark void
    top = v0 + h
    lo = v0 + open_to
    for v in range(lo, top):
        k = (top - v) % 3
        wbox(g, normal, plane, u0, u0 + w, v, v + 1, 1, 2, C(sr, ss - 1 if k == 0 else ss + (1 if k == 1 else 0)))
    if open_to < h:
        wbox(g, normal, plane, u0, u0 + w, lo, lo + 2, 0, 2, C(sr, ss - 2))  # bottom bar
        wbox(g, normal, plane, u0 + w // 2 - 2, u0 + w // 2 + 2, lo + 2, lo + 3, 0, 1, C("steel", 6))  # lift handle
    for uu in (u0 - 2, u0 + w):
        wbox(g, normal, plane, uu, uu + 2, v0, top + 1, -1, 1, C(*rail))
    wbox(g, normal, plane, u0 - 3, u0 + w + 3, top, top + 6, -4, 1, C(*housing))
    wbox(g, normal, plane, u0 - 3, u0 + w + 3, top + 5, top + 6, -4, 1, C(housing[0], housing[1] + 2))
    wbox(g, normal, plane, u0 - 3, u0 + w + 3, top, top + 1, -4, 1, C(housing[0], housing[1] - 1))
    return g


def downpipe(g: Grid, normal: str, plane: int, u: int, v0: int, v1: int, c=None):
    """2x2 rain pipe standing off the wall with brackets and a kicked shoe."""
    c = c if c is not None else C("steel", 3)
    wbox(g, normal, plane, u, u + 2, v0 + 2, v1, -3, -1, c)
    for v in range(v0 + 8, v1 - 2, 14):
        wbox(g, normal, plane, u - 1, u + 3, v, v + 1, -3, 0, C("iron", 2))
    wbox(g, normal, plane, u, u + 2, v0, v0 + 2, -5, -1, c)
    wbox(g, normal, plane, u - 1, u + 3, v1 - 1, v1 + 1, -4, 0, c)  # hopper
    return g


def wall_lamp(g: Grid, normal: str, plane: int, u: int, v: int, lit: bool = False):
    wbox(g, normal, plane, u, u + 2, v, v + 1, -4, 0, C("iron", 2))
    wbox(g, normal, plane, u - 1, u + 3, v - 1, v + 2, -6, -3, C("iron", 3))
    wbox(g, normal, plane, u, u + 2, v - 3, v - 1, -5, -4, C("gold", 6) if lit else C("bone", 4))
    return g


def ac_unit(g: Grid, normal: str, plane: int, u0: int, v0: int, w: int = 14, h: int = 10, depth: int = 7):
    wbox(g, normal, plane, u0, u0 + w, v0, v0 + h, -depth, 0, C("gray", 6))
    for u in range(u0 + 2, u0 + w - 1, 2):
        wbox(g, normal, plane, u, u + 1, v0 + 2, v0 + h - 2, -depth, -depth + 1, C("iron", 2))
    wbox(g, normal, plane, u0, u0 + w, v0 + h - 1, v0 + h, -depth, 0, C("gray", 7))
    wbox(g, normal, plane, u0 + 1, u0 + 3, v0 - 3, v0, -depth + 2, -depth + 4, C("iron", 2))  # bracket
    wbox(g, normal, plane, u0 + w - 3, u0 + w - 1, v0 - 3, v0, -depth + 2, -depth + 4, C("iron", 2))
    return g


# ---------------------------------------------------------------- free props


def drum(g: Grid, cx, y0, cz, r: float = 6, h: int = 18, ramp: str = "blue", shade: int = 4, lid: bool = True):
    """Oil drum (standard prop: ~18 tall, 12 across) with ribs and a lid."""
    g.cylinder("y", cx, cz, r, y0, y0 + h, C(ramp, shade))
    for ry in (y0 + h // 3, y0 + (2 * h) // 3):
        g.cylinder("y", cx, cz, r + 0.5, ry, ry + 1, C(ramp, shade - 1))
    g.cylinder("y", cx, cz, r + 0.5, y0 + h - 1, y0 + h, C(ramp, shade + 1))
    g.cylinder("y", cx, cz, r - 1, y0 + h - 1, y0 + h, C(ramp, shade - 2) if lid else 0)
    g.cylinder("y", cx, cz, r + 0.3, y0, y0 + 1, C(ramp, shade - 2))
    if lid:
        g.box(cx + 1, y0 + h - 1, cz - 3, cx + 3, y0 + h, cz - 1, C("steel", 5))  # bung
    return g


def tyre(g: Grid, cx, y0, cz, r: float = 9, hole: float = 4.5, h: int = 6, flat: bool = True):
    """A tyre lying flat (flat=True) or standing on edge along x."""
    if flat:
        g.cylinder("y", cx, cz, r, y0, y0 + h, C("gray", 2))
        g.cylinder("y", cx, cz, r, y0 + h // 2, y0 + h // 2 + 1, C("iron", 1))
        g.cylinder("y", cx, cz, hole, y0, y0 + h, 0)
        g.cylinder("y", cx, cz, hole + 1.5, y0 + h - 1, y0 + h, C("gray", 1))
        g.cylinder("y", cx, cz, hole, y0 + h - 1, y0 + h, 0)
    else:
        g.cylinder("x", y0 + r, cz, r, cx - h / 2, cx + h / 2, C("gray", 2))
        g.cylinder("x", y0 + r, cz, hole, cx - h / 2, cx + h / 2, 0)
    return g


def sandbag(g: Grid, x0, y0, z0, along: str = "x", n: int = 6, rows: int = 3, ln: int = 9, seed: int = 0):
    """A stacked sandbag wall: n bags per row (ln long, 4 tall, 6 deep), each a
    chamfered block with a darker tied end, rows in running bond."""
    rng = random.Random(seed)
    for r in range(rows):
        off = (r % 2) * (ln // 2)
        for i in range(n - (r % 2)):
            a = x0 + off + i * ln if along == "x" else z0 + off + i * ln
            sh = rng.choice((3, 4, 4, 5))
            yb = y0 + r * 4
            if along == "x":
                g.box(a + 1, yb, z0, a + ln - 1, yb + 4, z0 + 6, C("khaki", sh))
                g.box(a, yb + 1, z0 + 1, a + ln, yb + 3, z0 + 5, C("khaki", sh))
                g.box(a + ln - 2, yb + 1, z0 + 1, a + ln - 1, yb + 3, z0 + 5, C("khaki", sh - 2))
            else:
                g.box(x0, yb, a + 1, x0 + 6, yb + 4, a + ln - 1, C("khaki", sh))
                g.box(x0 + 1, yb + 1, a, x0 + 5, yb + 3, a + ln, C("khaki", sh))
                g.box(x0 + 1, yb + 1, a + ln - 2, x0 + 5, yb + 3, a + ln - 1, C("khaki", sh - 2))
    return g


def mound(g: Grid, cx, cz, ax: float, az: float, h: int, corner: float, lift: int = 2, c=None, top=None):
    """A terraced earth mound: rounded-rectangle layers `lift` voxels tall that
    shrink toward the top (half-extents ax, az at the base). Straight sides
    mesh cheaply. Returns the mound mask."""
    X, Y, Z = np.indices(g.shape)
    x, z = X + 0.5 - cx, Z + 0.5 - cz
    m = np.zeros(g.shape, bool)
    for y0 in range(0, h, lift):
        t = (y0 + lift) / h
        k = math.sqrt(max(0.0, 1 - t * t)) if t < 1 else 0.35
        k = max(k, 0.35)
        hx, hz = ax * k, az * k
        r = min(corner, hx, hz)
        dx = np.maximum(np.abs(x) - (hx - r), 0)
        dz = np.maximum(np.abs(z) - (hz - r), 0)
        layer = (dx * dx + dz * dz <= r * r) & (Y >= y0) & (Y < y0 + lift)
        m |= layer
    if c is not None:
        g.a[m] = c
        if top is not None:
            above = np.zeros_like(m)
            above[:, :-1, :] = m[:, 1:, :]
            g.a[m & ~above] = top
    return m


def pallet(g: Grid, x0, y0, z0, w: int = 16, d: int = 16, ramp: str = "wood", shade: int = 4):
    for zz in (z0, z0 + d // 2 - 1, z0 + d - 2):
        g.box(x0, y0, zz, x0 + w, y0 + 2, zz + 2, C(ramp, shade - 1))
    for xx in range(x0, x0 + w, 3):
        g.box(xx, y0 + 2, z0, xx + 2, y0 + 3, z0 + d, C(ramp, shade + (xx // 3) % 2))
    return g


def box_crate(g: Grid, x0, y0, z0, s: int = 16, ramp: str = "wood", shade: int = 4, stencil=None):
    """A 16-voxel crate (one tile): framed, planked, with a cross brace."""
    g.box(x0, y0, z0, x0 + s, y0 + s, z0 + s, C(ramp, shade))
    m = np.zeros(g.shape, bool)
    m[x0:x0 + s, y0:y0 + s, z0:z0 + s] = True
    planks(g, m, 0, 1, ramp, shade, width=3, seed=x0 + z0, end=64)
    idx = np.indices(g.shape)
    ex = (idx[0] == x0) | (idx[0] == x0 + s - 1)
    ey = (idx[1] == y0) | (idx[1] == y0 + s - 1)
    ez = (idx[2] == z0) | (idx[2] == z0 + s - 1)
    g.where(m & ((ex & ey) | (ey & ez) | (ex & ez)), C(ramp, max(0, shade - 2)))
    for k in range(1, s - 1):
        g.set(x0 + k, y0 + k, z0, C(ramp, shade - 1))
        g.set(x0 + k, y0 + s - 1 - k, z0 + s - 1, C(ramp, shade - 1))
    return g


def weeds(g: Grid, pts, seed: int = 0, ground: int = 1):
    """Grass and weed tufts: 1-voxel stalks of mixed heights at (x, z) points."""
    rng = random.Random(seed)
    for x, z in pts:
        for dx, dz in ((0, 0), (1, 0), (0, 1), (-1, 0), (1, 1)):
            if rng.random() < 0.3:
                continue
            hh = rng.randint(2, 6)
            c = C(rng.choice(("moss", "moss", "leaf", "khaki")), rng.choice((3, 4, 5)))
            g.box(x + dx, ground, z + dz, x + dx + 1, ground + hh, z + dz + 1, c)
    return g


def ladder(g: Grid, normal: str, plane: int, u0: int, v0: int, v1: int, w: int = 8, stand: int = 3, c=None):
    """Steel wall ladder: two rails standing `stand` off the wall, rungs every 5."""
    c = c if c is not None else C("iron", 4)
    for uu in (u0, u0 + w - 1):
        wbox(g, normal, plane, uu, uu + 1, v0, v1, -stand, -stand + 1, c)
        for v in range(v0 + 6, v1, 16):
            wbox(g, normal, plane, uu, uu + 1, v, v + 1, -stand, 0, C("iron", 2))
    for v in range(v0 + 3, v1, 5):
        wbox(g, normal, plane, u0 + 1, u0 + w - 1, v, v + 1, -stand, -stand + 1, C("iron", 5))
    return g


def ground(g: Grid, x0, z0, x1, z1, ramp: str = "stone", shade: int = 3, seed: int = 0, cracks: int = 10):
    """One-voxel ground apron with slab joints every 16 and a few crack lines."""
    rng = random.Random(seed)
    g.box(x0, 0, z0, x1, 1, z1, C(ramp, shade))
    idx = np.indices(g.shape)
    m = (idx[1] == 0) & (idx[0] >= x0) & (idx[0] < x1) & (idx[2] >= z0) & (idx[2] < z1)
    vshift(g, m & (((idx[0] - x0) % 16 == 0) | ((idx[2] - z0) % 16 == 0)), -1)
    for _ in range(cracks):
        px, pz = rng.uniform(x0, x1), rng.uniform(z0, z1)
        a = rng.uniform(0, 2 * math.pi)
        for k in range(rng.randint(5, 12)):
            a += rng.uniform(-0.6, 0.6)
            px, pz = px + math.cos(a), pz + math.sin(a)
            if x0 <= px < x1 and z0 <= pz < z1:
                g.set(px, 0, pz, C(ramp, max(0, shade - 2)))
    return g


def stair(g: Grid, x0: int, y_top: int, z0: int, z1: int, n: int, rise: int = 5, run: int = 5, dirx: int = 1,
          tread=None, stringer=None, rail: int = 14):
    """Open steel stair along x going DOWN as x moves in `dirx`: n steps of
    `rise` x `run`, treads between z0 and z1, stringers and a handrail on the
    outer (z0) side."""
    tread = tread if tread is not None else C("iron", 4)
    stringer = stringer if stringer is not None else C("iron", 3)
    for k in range(n):
        ty = y_top - (k + 1) * rise
        xa = x0 + dirx * k * run
        xb = xa + dirx * run
        lo, hi = min(xa, xb), max(xa, xb)
        g.box(lo, ty, z0, hi, ty + 1, z1, tread)
        g.box(lo, ty, z0, hi, ty + 1, z0 + 1, C("iron", 2))
    xe = x0 + dirx * n * run
    ye = y_top - n * rise
    for zz in (z0, z1 - 1):
        g.line((x0 + 0.5, y_top - 0.5, zz + 0.5), (xe + 0.5, ye + 0.5, zz + 0.5), 0.75, stringer)
    if rail:
        g.line((x0 + 0.5, y_top + rail - 0.5, z0 + 0.5), (xe + 0.5, ye + rail + 0.5, z0 + 0.5), 0.6, stringer)
        for k in range(0, n + 1, 3):
            px = x0 + dirx * k * run
            py = y_top - k * rise
            g.box(px, py - 1, z0, px + 1, py + rail, z0 + 1, stringer)
    return g


def railing(g: Grid, x0: int, x1: int, y: int, z0: int, z1: int, h: int = 14, c=None, post: int = 6):
    """Railing around a rectangular landing (open on no side); y = deck top."""
    c = c if c is not None else C("iron", 3)
    for (a0, a1, b, ax) in ((x0, x1, z0, 0), (x0, x1, z1 - 1, 0), (z0, z1, x0, 2), (z0, z1, x1 - 1, 2)):
        if ax == 0:
            g.box(a0, y + h - 1, b, a1, y + h, b + 1, c)
            g.box(a0, y + h // 2, b, a1, y + h // 2 + 1, b + 1, c)
            for p in list(range(a0, a1, post)) + [a1 - 1]:
                g.box(p, y, b, p + 1, y + h, b + 1, c)
        else:
            g.box(b, y + h - 1, a0, b + 1, y + h, a1, c)
            g.box(b, y + h // 2, a0, b + 1, y + h // 2 + 1, a1, c)
            for p in list(range(a0, a1, post)) + [a1 - 1]:
                g.box(b, y, p, b + 1, y + h, p + 1, c)
    return g


def int_pivot(g: Grid):
    """Bottom-centre pivot rounded to whole voxels (keeps every part on one grid phase)."""
    idx = np.argwhere(g.a > 0)
    lo, hi = idx.min(0), idx.max(0) + 1
    return (float((lo[0] + hi[0]) // 2), float(lo[1]), float((lo[2] + hi[2]) // 2))


def rubble(g: Grid, cx, cz, rx: float, ry: float, rz: float, colors, seed: int = 0, chunks: int = 120, y0: int = 1):
    """A rubble heap: a solid mound in the first colour plus chunky blocks
    (brick-sized lumps, slabs) of the other colours scattered over it."""
    rng = random.Random(seed)
    x, y, z = np.indices(g.shape)
    mound = (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - y0) / ry) ** 2 + ((z + 0.5 - cz) / rz) ** 2 <= 1) & (y >= y0) & (g.a == 0)
    g.a[mound] = colors[0]
    for _ in range(chunks):
        a = rng.uniform(0, 2 * math.pi)
        t = math.sqrt(rng.random())
        px, pz = cx + math.cos(a) * rx * t, cz + math.sin(a) * rz * t
        top = y0 + ry * math.sqrt(max(0.0, 1 - t * t))
        w, h, d = rng.choice(((4, 2, 2), (2, 2, 4), (3, 2, 3), (6, 1, 4), (2, 3, 2)))
        g.box(int(px), int(top) - 1, int(pz), int(px) + w, int(top) - 1 + h, int(pz) + d, rng.choice(colors[1:]))
    return g


def roof_text(g: Grid, s: str, xc: float, zc: float, y: int, c: int, scale: int = 3, gap: int = 2):
    """Blocky letters painted flat on a roof at height y (the voxel layer),
    reading left to right for a viewer in front (at -Z) looking down: text
    runs toward -X, rows run toward +Z."""
    from _kit import FONT

    s = s.upper()
    width = len(s) * (3 * scale + gap) - gap
    x_start = xc + width / 2.0
    z_start = zc - 5 * scale / 2.0
    for i, ch in enumerate(s):
        for r, row in enumerate(FONT[ch]):
            for col, px in enumerate(row):
                if px != "#":
                    continue
                for a in range(scale):
                    for b in range(scale):
                        xx = x_start - (i * (3 * scale + gap) + col * scale + a) - 1
                        zz = z_start + (4 - r) * scale + b
                        if g.a[int(xx), y, int(zz)]:
                            g.set(xx, y, zz, c)
    return g
