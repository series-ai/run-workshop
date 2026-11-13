"""Shared authoring helpers for the fantasy pack only (import as `_kit`).

World grids use glTF axes: +Y up, front = -Z. Faces are named '-z', '+z',
'-x', '+x' by their outward normal.
"""
from __future__ import annotations

import math
import random

import numpy as np

from voxgrid import C, RAMP_SHADES, Grid, brickify

__all__ = [
    "shift", "light", "jitter", "planks", "shingles", "gable_roof", "cone_roof", "stamp", "put",
    "rot_y", "flip_x", "hollow", "crenellate", "rock", "chunky", "stripes_y", "ring_y", "brick",
    "rivets", "held_pivot", "GRIP", "rope", "lantern", "flag_grid", "banner_grid", "face_fc",
]

GRIP = (0, 0, 3)  # held items: palm centre relative to the Hand.R joint (voxels)


# ---------------------------------------------------------------- colour ops
def shift(g: Grid, mask: np.ndarray, delta) -> Grid:
    """Shift the shade of the filled voxels in `mask` by `delta` (int or
    array) inside their ramp, clamped to 0..7 (never index 0)."""
    a = g.a
    m = mask & (a != 0)
    if not m.any():
        return g
    vals = a[m].astype(np.int16)
    ramp, shade = vals // RAMP_SHADES, vals % RAMP_SHADES
    d = delta if np.isscalar(delta) else np.asarray(delta)[m]
    shade = np.clip(shade + d, 0, RAMP_SHADES - 1)
    out = ramp * RAMP_SHADES + shade
    out[out == 0] = 1
    a[m] = out.astype(np.uint8)
    return g


def light(g: Grid, top: int = 1, bottom: int = -1, floor: bool = False) -> Grid:
    """Lit top rims and shaded undersides: +top on voxels with open sky
    above, `bottom` on voxels with air below (not on the ground row unless
    `floor`)."""
    occ = g.a != 0
    above = np.zeros_like(occ)
    above[:, :-1, :] = occ[:, 1:, :]
    below = np.zeros_like(occ)
    below[:, 1:, :] = occ[:, :-1, :]
    if top:
        shift(g, occ & ~above, top)
    if bottom:
        m = occ & ~below
        if not floor:
            m[:, 0, :] = False
        shift(g, m, bottom)
    return g


def jitter(g: Grid, seed: int, amount: float = 0.2, mask: np.ndarray | None = None, spread: int = 1) -> Grid:
    """Deterministic per-voxel shade noise, optionally limited to a mask."""
    rng = np.random.default_rng(seed)
    occ = g.a != 0
    if mask is not None:
        occ &= mask
    roll = rng.random(g.a.shape)
    sign = np.where(rng.random(g.a.shape) < 0.5, -spread, spread)
    return shift(g, occ & (roll < amount), sign)


def planks(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str, shade: int, across: str = "x", width: int = 2, seed: int = 0, knots: float = 0.02) -> Grid:
    """Fill a box with boards `width` wide across the `across` axis: every
    board gets its own shade, seams one shade darker, a few dark knots."""
    rng = random.Random(seed)
    g.box(x0, y0, z0, x1, y1, z1, C(ramp, shade))
    ax = "xyz".index(across)
    sl = (slice(max(0, int(x0)), int(x1)), slice(max(0, int(y0)), int(y1)), slice(max(0, int(z0)), int(z1)))
    sub = g.a[sl]
    n = sub.shape[ax]
    lo = (int(x0), int(y0), int(z0))[ax]
    for i in range(n):
        board = (lo + i) // width
        rng2 = random.Random(seed * 1000 + board)
        d = rng2.choice([-1, 0, 0, 1])
        if (lo + i) % width == 0 and width > 1:
            d -= 1
        idx = [slice(None)] * 3
        idx[ax] = i
        s = max(0, min(7, shade + d))
        sub[tuple(idx)] = C(ramp, s)
    if knots:
        pts = np.argwhere(sub != 0)
        for p in pts:
            if rng.random() < knots:
                sub[tuple(p)] = C(ramp, max(0, shade - 2))
    return g


def stripes_y(g: Grid, mask: np.ndarray, period: int, delta: int, phase: int = 0) -> Grid:
    y = np.arange(g.shape[1])[None, :, None]
    return shift(g, mask & (((y + phase) % period) == 0), delta)


def ring_y(g: Grid, y0: int, y1: int, color: int, mask: np.ndarray | None = None) -> Grid:
    """Recolour the filled voxels of rows y0..y1-1 (hoops, bands, belts)."""
    m = np.zeros(g.shape, bool)
    m[:, y0:y1, :] = True
    m &= g.a != 0
    if mask is not None:
        m &= mask
    g.a[m] = color
    return g


def brick(g: Grid, ramp: str, course: int = 3, length: int = 5, seed: int = 0, mortar: int = -1) -> Grid:
    return brickify(g, ramp, course=course, length=length, mortar_delta=mortar, seed=seed)


def shingles(g: Grid, mask: np.ndarray, ramp: str, shade: int, seed: int = 0, tile: int = 3, noise: float = 0.15) -> Grid:
    """Roof tiles on `mask`: alternating row shades, staggered tile joints."""
    rng = random.Random(seed)
    xs, ys, zs = np.nonzero(mask)
    for x, y, z in zip(xs, ys, zs):
        row = int(y)
        along = int(x) + int(z) + (row % 2) * (tile // 2 + 1)
        d = 0 if row % 2 else -1
        if along % tile == 0:
            d -= 1
        elif noise and rng.random() < noise:
            d += 1
        g.a[x, y, z] = C(ramp, max(0, min(7, shade + d)))
    return g


# ---------------------------------------------------------------- roofs
def gable_roof(g: Grid, x0, x1, z0, z1, y0, ramp: str = "red", shade: int = 3, ridge: str = "x", overhang: int = 2,
               thick: int = 999, rise: int = 1, gable: int | None = None, cap: int | None = None, seed: int = 0,
               tile: int = 3, noise: float = 0.15) -> int:
    """Stepped gable roof over the footprint [x0,x1)×[z0,z1), eaves at y0.
    The ridge runs along `ridge`. Gable ends are filled with `gable` if given.
    Returns the y above the ridge."""
    if ridge == "z":
        a0, a1, b0, b1 = z0, z1, x0, x1
    else:
        a0, a1, b0, b1 = x0, x1, z0, z1
    roof = np.zeros(g.shape, bool)
    gab = np.zeros(g.shape, bool)
    capm = np.zeros(g.shape, bool)
    k = 0
    y = y0
    while True:
        lo, hi = b0 - overhang + k, b1 + overhang - k
        if hi - lo <= 0:
            break
        last = hi - lo <= 2
        for dy in range(rise):
            yy = y + dy
            if yy >= g.shape[1]:
                break
            for b in range(lo, hi):
                edge = b < lo + thick or b >= hi - thick or last
                if not edge:
                    continue
                for a in range(a0 - overhang, a1 + overhang):
                    p = (a, yy, b) if ridge == "x" else (b, yy, a)
                    if 0 <= p[0] < g.shape[0] and 0 <= p[2] < g.shape[2]:
                        (capm if last else roof)[p] = True
            if gable is not None:
                glo, ghi = max(lo + thick, b0), min(hi - thick, b1)
                for b in range(glo, ghi):
                    for a in (a0, a1 - 1):
                        p = (a, yy, b) if ridge == "x" else (b, yy, a)
                        if 0 <= p[0] < g.shape[0] and 0 <= p[2] < g.shape[2]:
                            gab[p] = True
        y += rise
        k += 1
    if gable is not None:
        g.where(gab & (g.a == 0), gable)
    g.where(roof, C(ramp, shade))
    shingles(g, roof, ramp, shade, seed=seed, tile=tile, noise=noise)
    g.where(capm, cap if cap is not None else C(ramp, max(0, shade - 1)))
    # eave row darker
    eave = roof.copy()
    eave[:, y0 + 1:, :] = False
    shift(g, eave, -1)
    return y


def cone_roof(g: Grid, cx, cz, r, y0, h, ramp: str = "blue", shade: int = 3, square: bool = False, thick: float = 999.0,
              seed: int = 0, curve: float = 1.0, lip: int = 1, tile: int = 3, noise: float = 0.15) -> None:
    """Conical (or pyramid when `square`) roof, shingled, hollow."""
    x = np.arange(g.shape[0])[:, None, None] + 0.5
    y = np.arange(g.shape[1])[None, :, None] + 0.5
    z = np.arange(g.shape[2])[None, None, :] + 0.5
    t = np.clip((y - y0) / h, 0, 1)
    rad = (r + lip) * (1 - t) ** curve
    d = np.maximum(abs(x - cx), abs(z - cz)) if square else np.sqrt((x - cx) ** 2 + (z - cz) ** 2)
    m = (d <= rad) & (d > rad - thick - 1.0 / max(h, 1) * r) & (y >= y0) & (y < y0 + h)
    m |= (d <= rad) & (y >= y0 + h - 2) & (y < y0 + h)
    g.where(m, C(ramp, shade))
    shingles(g, m, ramp, shade, seed=seed, tile=tile, noise=noise)


# ---------------------------------------------------------------- facades
def face_fc(face: str, plane: int, u: int, v: int, d: int):
    """Grid coords of facade-local (u, v, d): u along the wall, v = y,
    d outward from the wall surface at `plane`."""
    if face == "-z":
        return (u, v, plane - d)
    if face == "+z":
        return (u, v, plane + d)
    if face == "-x":
        return (plane - d, v, u)
    if face == "+x":
        return (plane + d, v, u)
    raise ValueError(face)


def stamp(g: Grid, face: str, plane: int, u0: int, v_top: int, rows: list[str], legend: dict) -> Grid:
    """Paint an ASCII facade. rows[0] is the TOP row at y = v_top, each char
    one u step. legend[ch] = [(d, colour), ...] (colour 0 carves); '.' and
    ' ' skip."""
    for r, row in enumerate(rows):
        v = v_top - r
        for i, ch in enumerate(row):
            if ch in ". ":
                continue
            for d, col in legend[ch]:
                g.set(*face_fc(face, plane, u0 + i, v, d), col)
    return g


# ---------------------------------------------------------------- grid ops
def put(dst: Grid, src: Grid, ox: int, oy: int, oz: int, overwrite: bool = True) -> Grid:
    """Vectorised paste of src's filled cells at offset, clipped."""
    sx, sy, sz = src.shape
    dx, dy, dz = dst.shape
    x0, y0, z0 = max(0, ox), max(0, oy), max(0, oz)
    x1, y1, z1 = min(dx, ox + sx), min(dy, oy + sy), min(dz, oz + sz)
    if x0 >= x1 or y0 >= y1 or z0 >= z1:
        return dst
    s = src.a[x0 - ox:x1 - ox, y0 - oy:y1 - oy, z0 - oz:z1 - oz]
    d = dst.a[x0:x1, y0:y1, z0:z1]
    m = s != 0
    if not overwrite:
        m &= d == 0
    d[m] = s[m]
    return dst


def rot_y(g: Grid, k: int) -> Grid:
    """Rotate a grid by k quarter turns about +Y (returns a new grid)."""
    return g.rot_y(k)


def flip_x(g: Grid) -> Grid:
    return g.flip("x")


def flip_z(g: Grid) -> Grid:
    return g.flip("z")


def hollow(g: Grid, keep: int = 2) -> Grid:
    """Empty voxels more than `keep` cells from the outside (lighter GLBs)."""
    occ = g.a != 0
    inner = occ.copy()
    for _ in range(keep):
        n = inner.copy()
        for ax in range(3):
            for st in (1, -1):
                sh = np.roll(inner, st, axis=ax)
                idx = [slice(None)] * 3
                idx[ax] = slice(0, 1) if st == 1 else slice(-1, None)
                sh[tuple(idx)] = False
                n &= sh
        inner = n
    g.a[inner] = 0
    return g


def crenellate(g: Grid, x0, x1, z0, z1, y, h, color, step: int = 4, w: int = 2, t: int = 2) -> Grid:
    """Merlons of width w and thickness t around a rectangle's rim."""
    for i in range(x0, x1, step):
        g.box(i, y, z0, min(i + w, x1), y + h, z0 + t, color)
        g.box(i, y, z1 - t, min(i + w, x1), y + h, z1, color)
    for i in range(z0, z1, step):
        g.box(x0, y, i, x0 + t, y + h, min(i + w, z1), color)
        g.box(x1 - t, y, i, x1, y + h, min(i + w, z1), color)
    return g


def rock(g: Grid, cx, cy, cz, rx, ry, rz, ramp: str = "stone", shade: int = 3, seed: int = 0, facets: int = 7, rough: float = 0.22, noise: float = 0.18) -> Grid:
    """Faceted boulder: ellipsoid cut by random planes, lit top, dark base."""
    rng = random.Random(seed)
    x = (np.arange(g.shape[0])[:, None, None] + 0.5 - cx) / rx
    y = (np.arange(g.shape[1])[None, :, None] + 0.5 - cy) / ry
    z = (np.arange(g.shape[2])[None, None, :] + 0.5 - cz) / rz
    m = x * x + y * y + z * z <= 1.0
    for _ in range(facets):
        th, ph = rng.uniform(0, 2 * math.pi), rng.uniform(-0.3, 1.2)
        n = (math.cos(th) * math.cos(ph), math.sin(ph), math.sin(th) * math.cos(ph))
        m &= (x * n[0] + y * n[1] + z * n[2]) <= 1.0 - rng.uniform(0.05, rough)
    tmp = Grid(*g.shape)
    tmp.where(m, C(ramp, shade))
    ys = np.nonzero(m)[1]
    if len(ys):
        yy = np.arange(g.shape[1])[None, :, None]
        span = max(1, ys.max() - ys.min())
        shift(tmp, m & (yy >= ys.min() + span * 0.66), 1)
        shift(tmp, m & (yy < ys.min() + span * 0.25), -1)
    if noise:
        jitter(tmp, seed + 7, noise)
    put(g, tmp, 0, 0, 0)
    return g


def chunky(g: Grid, cx, cy, cz, rx, ry, rz, n: int, size: tuple[int, int], color: int, seed: int = 0) -> Grid:
    """Union of random axis-aligned cubes inside an ellipsoid (PN-style
    chunky foliage)."""
    rng = random.Random(seed)
    for _ in range(n):
        while True:
            u, v, w = rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)
            if u * u + v * v + w * w <= 1:
                break
        s = rng.randint(*size)
        px, py, pz = cx + u * rx, cy + v * ry, cz + w * rz
        g.box(px - s / 2, py - s / 2, pz - s / 2, px + s / 2, py + s / 2, pz + s / 2, color)
    return g


def rivets(g: Grid, pts, color) -> Grid:
    for p in pts:
        g.set(*p, color)
    return g


def rope(g: Grid, p0, p1, color_a, color_b, r: float = 0.6) -> Grid:
    """Twisted rope: a capsule painted in alternating 2-voxel bands."""
    tmp = Grid(*g.shape)
    tmp.line(p0, p1, r, color_a)
    xs, ys, zs = np.nonzero(tmp.a)
    for x, y, z in zip(xs, ys, zs):
        if (x + y + z) % 3 == 0:
            tmp.a[x, y, z] = color_b
    return put(g, tmp, 0, 0, 0)


def lantern(g: Grid, x, y, z, glow: str = "ember") -> Grid:
    """3×4×3 iron lantern with a glowing core, base corner at (x, y, z)."""
    g.box(x, y, z, x + 3, y + 1, z + 3, C("iron", 2))
    g.box(x, y + 1, z, x + 3, y + 3, z + 3, C(glow, 6))
    g.box(x + 1, y + 1, z, x + 2, y + 3, z + 3, C(glow, 7))
    for cx_, cz_ in ((x, z), (x + 2, z), (x, z + 2), (x + 2, z + 2)):
        g.box(cx_, y + 1, cz_, cx_ + 1, y + 3, cz_ + 1, C("iron", 3))
    g.box(x, y + 3, z, x + 3, y + 4, z + 3, C("iron", 2))
    g.set(x + 1, y + 4, z + 1, C("iron", 4))
    return g


def flag_grid(w: int, h: int, main: str, trim: str, emblem: str | None = None, swallow: bool = True) -> Grid:
    """Flat pennant/flag in the x/y plane, one voxel thick (z)."""
    g = Grid(w, h, 1)
    for x in range(w):
        for y in range(h):
            if swallow and x >= w - 3 and abs(y - (h - 1) / 2) < (x - (w - 4)) * 0.8:
                continue
            c = C(main, 4 if (x // 2) % 2 == 0 else 3)
            if y in (0, h - 1):
                c = C(trim, 5)
            g.set(x, y, 0, c)
    if emblem:
        g.box(w // 3, h // 2 - 1, 0, w // 3 + 2, h // 2 + 1, 0 + 1, C(emblem, 6))
    return g


def banner_grid(w: int, h: int, main: str, trim: str, emblem_rows: list[str] | None = None, emblem: int | None = None) -> Grid:
    """Hanging banner in the x/y plane (z thickness 1) with a V-cut bottom,
    trim border and an ASCII emblem ('#' cells), top rod included."""
    g = Grid(w + 2, h + 1, 2)
    for x in range(w):
        for y in range(h):
            cut = abs(x - (w - 1) / 2)
            if y < 3 and y < 3 - cut * 3 / (w / 2) + 0.5 and cut < w / 2 - 0.5:
                pass
            if y < (w / 2 - cut) * 0.7:  # V notch at the bottom
                continue
            border = x in (0, w - 1) or y >= h - 2
            c = C(trim, 5) if border else C(main, 3 if (y % 6) < 3 else 4)
            g.set(x + 1, y, 1, c)
    if emblem_rows:
        eh = len(emblem_rows)
        ew = max(len(r) for r in emblem_rows)
        ox, oy = 1 + (w - ew) // 2, h - 4 - eh + 1
        for r, row in enumerate(emblem_rows):
            for i, ch in enumerate(row):
                if ch == "#":
                    g.set(ox + i, oy + (eh - 1 - r), 1, emblem if emblem is not None else C(trim, 6))
    g.box(0, h, 0, w + 2, h + 1, 2, C("darkwood", 3))  # rod
    g.set(0, h, 0, C("gold", 5)).set(w + 1, h, 0, C("gold", 5))
    return g


def held_pivot(grip_x: float, cy: float, cz: float) -> tuple[float, float, float]:
    """Held-item pivot so the grid point (grip_x, cy, cz) lands on GRIP."""
    return (grip_x - GRIP[0], cy - GRIP[1], cz - GRIP[2])


def barrel_into(g: Grid, cx, cz, y0, h, r, belly: float = 1.0, seed: int = 0, staves: int = 14, wood: str = "wood",
                shade: int = 3, hoops=(0.12, 0.5, 0.88), hoop_color=None, lid: bool = True) -> Grid:
    """Bellied barrel: angular staves with per-stave shades, iron hoops,
    plank lid with a dark rim. (cx, cz) centre, base at y0, height h."""
    rng = random.Random(seed)
    stave_d = [rng.choice([-1, 0, 0, 1]) for _ in range(staves)]
    x = np.arange(g.shape[0])[:, None, None] + 0.5
    y = np.arange(g.shape[1])[None, :, None] + 0.5
    z = np.arange(g.shape[2])[None, None, :] + 0.5
    t = np.clip((y - y0) / h, 0, 1)
    rad = r + belly * np.sin(np.pi * t)
    dist = np.sqrt((x - cx) ** 2 + (z - cz) ** 2)
    body = (dist <= rad) & (y >= y0) & (y < y0 + h)
    shell = body & (dist > rad - 2.2)
    ang = (np.arctan2(z - cz, x - cx) + np.pi) / (2 * np.pi) * staves
    idx = np.floor(ang).astype(int) % staves
    sh = np.clip(shade + np.array(stave_d)[idx], 0, 7)
    seam = (ang - np.floor(ang)) < 0.12
    sh = np.where(seam, np.maximum(sh - 1, 0), sh)
    rid = {"wood": 2, "darkwood": 3}.get(wood)
    from voxgrid import PALETTE
    rid = PALETTE["ramps"][wood]
    vals = (rid * RAMP_SHADES + sh).astype(np.uint8)
    full = np.broadcast_to(vals, g.shape)
    g.a[shell] = full[shell]
    hc = hoop_color if hoop_color is not None else C("iron", 3)
    for f in hoops:
        yy = int(y0 + f * (h - 1))
        m = shell.copy()
        m[:, :yy, :] = False
        m[:, yy + 1:, :] = False
        g.a[m] = hc
        m2 = body & ~shell
        m2[:, :yy, :] = False
        m2[:, yy + 1:, :] = False
        # hoops sit proud: one voxel out
        ring = (dist <= rad + 1) & (dist > rad) & (y >= yy) & (y < yy + 1)
        g.where(ring, hc)
        shift(g, ring & (((x + z).astype(int) % 5) == 0), 2)  # rivets glint
    if lid:
        top = int(y0 + h - 1)
        lidm = (dist <= rad - 1.0) & (y >= top) & (y < top + 1)
        g.where(lidm, C(wood, shade + 1 if shade < 7 else 7))
        shift(g, lidm & ((np.floor(x).astype(int) % 3) == 0), -1)
        rim = (dist <= rad) & (dist > rad - 1.0) & (y >= top) & (y < top + 1)
        g.where(rim, C(wood, max(0, shade - 1)))
    return g


def trim(g: Grid, keep_y: bool = False) -> Grid:
    """Crop to the filled bounding box (x/z always; y too unless keep_y) so
    base_pivot() centres the content exactly."""
    nz = np.nonzero(g.a)
    if len(nz[0]) == 0:
        raise ValueError("trim: empty grid")
    x0, x1 = nz[0].min(), nz[0].max() + 1
    y0, y1 = (0 if keep_y else nz[1].min()), nz[1].max() + 1
    z0, z1 = nz[2].min(), nz[2].max() + 1
    return g.crop(x0, y0, z0, x1, y1, z1)


def prop(pid: str, name: str, g: Grid, sockets_at: dict | None = None, **kw):
    """Single-part static world asset, trimmed and base-pivoted.
    `sockets_at` = {socket name: point in the UNtrimmed grid frame}."""
    from voxgrid import Asset, Part, Socket, base_pivot
    nz = np.nonzero(g.a)
    lo = [int(nz[0].min()), int(nz[1].min()), int(nz[2].min())]
    hi = [int(nz[0].max()) + 1, int(nz[1].max()) + 1, int(nz[2].max()) + 1]
    g = trim(g)
    category = None
    for cat in ("animated-props", "terrain-nature", "props", "buildings", "creatures", "vehicles"):
        if pid.startswith(f"fantasy-{cat}-"):
            category = cat
            break
    if category is None:
        raise ValueError(f"prop(): unknown category in {pid}")
    slug = pid[len(f"fantasy-{category}-"):]
    socks = list(kw.pop("sockets", []))
    for sname, p in (sockets_at or {}).items():
        socks.append(Socket(sname, at=(p[0] - (lo[0] + hi[0]) / 2, p[1] - lo[1], p[2] - (lo[2] + hi[2]) / 2)))
    return Asset(id=pid, pack="fantasy", category=category, name=name, root=Part(slug, g, pivot=base_pivot(g)), sockets=socks, **kw)


def assemble(parts: list, pad: int = 0):
    """Build a Part tree from grids that share ONE world frame.

    parts = [(name, grid, hinge, parent), ...]; the first entry is the root
    (hinge/parent ignored: its pivot is the bottom centre of the union
    bounds). `hinge` is the node origin in shared-frame voxel coords;
    `parent` names an earlier part (None = root). Grids may be None
    (empty group nodes need a hinge). All grids are cropped by the same
    union box so the model is centred exactly on x/z and sits on y=0.
    Returns (root Part, to_root) where to_root(p) maps a shared-frame point
    to root pivot space (for sockets)."""
    from voxgrid import Part

    shape = next(g.shape for _, g, _, _ in parts if g is not None)
    lo = [10 ** 9] * 3
    hi = [-1] * 3
    for _, g, _, _ in parts:
        if g is None:
            continue
        if g.shape != shape:
            raise ValueError("assemble: all grids must share one shape")
        nz = np.nonzero(g.a)
        if len(nz[0]) == 0:
            continue
        for ax in range(3):
            lo[ax] = min(lo[ax], int(nz[ax].min()))
            hi[ax] = max(hi[ax], int(nz[ax].max()) + 1)
    lo = [max(0, lo[0] - pad), lo[1], max(0, lo[2] - pad)]
    hi = [min(shape[0], hi[0] + pad), hi[1], min(shape[2], hi[2] + pad)]
    root_pivot = ((lo[0] + hi[0]) / 2, float(lo[1]), (lo[2] + hi[2]) / 2)

    def crop(g):
        if g is None:
            return None
        return g.crop(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2])

    def local(p):
        return (p[0] - lo[0], p[1] - lo[1], p[2] - lo[2])

    nodes = {}
    pivots = {}
    name0, g0, _, _ = parts[0]
    root = Part(name0, crop(g0), pivot=local(root_pivot))
    nodes[name0], pivots[name0] = root, root_pivot
    for name, g, hinge, parent in parts[1:]:
        par = parent or name0
        pp = pivots[par]
        at = (hinge[0] - pp[0], hinge[1] - pp[1], hinge[2] - pp[2])
        node = Part(name, crop(g), pivot=local(hinge), at=at)
        nodes[par].add(node)
        nodes[name], pivots[name] = node, hinge

    def to_root(p):
        return (p[0] - root_pivot[0], p[1] - root_pivot[1], p[2] - root_pivot[2])

    return root, to_root


def keys(*pairs):
    """[(t, (x, y, z)), ...] from t, x, y, z tuples."""
    return [(t, (a, b, c)) for t, a, b, c in pairs]


WIN_ARCH = [" fff ", "fgggf", "fgHgf", "fgggf", "fgggf", "fgggf", "sssss"]
WIN_SLIT = ["f", "g", "g", "g", "f"]
WIN_SQUARE = ["fffff", "fgggf", "fgHgf", "fffff", "fgggf", "fgggf", "sssss"]
WIN_ROUND = [" fff ", "fgHgf", "fgggf", "fgggf", " fff "]
DOOR_ARCH = ["  fff  ", " fdddf ", "fdDdDdf", "fdDdDdf", "fdDdDdf", "fdDdDdf", "fdDhDdf", "fdDdDdf", "fdDdDdf", "fdDdDdf", "fdDdDdf"]


def window(g: Grid, face: str, plane: int, u0: int, v_top: int, rows=None, frame=None, glass=None, sill=None, glow: bool = False) -> Grid:
    """Recessed window from an ASCII pattern (see WIN_*): f frame (proud by
    one), g glass (recessed one), H glass highlight, s sill (proud)."""
    rows = rows or WIN_ARCH
    frame = frame if frame is not None else C("darkwood", 2)
    gl = glass if glass is not None else (C("ember", 5) if glow else C("navy", 2))
    hl = C("ember", 7) if glow else C("sky", 5)
    sill = sill if sill is not None else C("stone", 5)
    legend = {"f": [(0, frame), (1, frame)], "g": [(0, 0), (-1, gl)], "H": [(0, 0), (-1, hl)], "s": [(0, sill), (1, sill)]}
    return stamp(g, face, plane, u0, v_top, rows, legend)


def door(g: Grid, face: str, plane: int, u0: int, y0: int = 0, rows=None, wood: str = "darkwood", frame=None, handle=None) -> Grid:
    """Planked door (DOOR_ARCH) with a stone frame; bottom row at y = 0
    unless the pattern is placed with stamp() directly."""
    rows = rows or DOOR_ARCH
    fr = frame if frame is not None else C("stone", 5)
    legend = {"f": [(0, fr), (1, fr)], "d": [(0, 0), (-1, C(wood, 3))], "D": [(0, 0), (-1, C(wood, 4))],
              "h": [(0, 0), (-1, C(wood, 4)), (0, handle if handle is not None else C("gold", 5))]}
    return stamp(g, face, plane, u0, y0 + len(rows) - 1, rows, legend)


def wheel_into(g: Grid, x0: int, cy: float, cz: float, r: float, width: int = 2, rim=None, spoke=None, hub=None, spokes: int = 8) -> Grid:
    """Spoked cart wheel in the y/z plane (axle along x), occupying
    x0..x0+width. Iron-shod rim, wooden spokes, gold/iron hub."""
    rim = rim if rim is not None else C("darkwood", 3)
    spoke = spoke if spoke is not None else C("wood", 4)
    hub = hub if hub is not None else C("iron", 4)
    g.cylinder("x", cy, cz, r, x0, x0 + width, rim)
    g.cylinder("x", cy, cz, r - 1.3, x0, x0 + width, 0)
    tire = Grid(*g.shape)
    tire.cylinder("x", cy, cz, r + 0.6, x0, x0 + width, C("iron", 3))
    tire.cylinder("x", cy, cz, r, x0, x0 + width, 0)
    put(g, tire, 0, 0, 0)
    for k in range(spokes):
        a = k * 2 * math.pi / spokes
        g.line((x0 + width / 2, cy, cz), (x0 + width / 2, cy + (r - 1) * math.sin(a), cz + (r - 1) * math.cos(a)), 0.55, spoke)
    g.cylinder("x", cy, cz, max(1.2, r * 0.22), x0 - 1, x0 + width + 1, hub)
    return g


def held(slug: str, name: str, g: Grid, grip, sockets_at: dict, pfx=None):
    """Held item: `grip` = grid point (continuous coords) that sits in the
    palm (GRIP from the Hand.R joint); sockets given as grid points."""
    from voxgrid import Asset, Part, Socket
    pivot = (grip[0] - GRIP[0], grip[1] - GRIP[1], grip[2] - GRIP[2])
    socks = [Socket(n, at=(p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2])) for n, p in sockets_at.items()]
    return Asset(id=f"fantasy-held-items-{slug}", pack="fantasy", category="held-items", name=name,
                 root=Part(slug, g, pivot=pivot), sockets=socks, pfx=pfx or [])


# ---------------------------------------------------------------- rig space
# PN body (species 1), rig grid indices (x forward, y up, z along the right arm):
# head x13-28 y37-58 z27-48 (face plate x = 28); torso x16-23 y16-35 z29-46;
# arms y29-34 x17-22 (L z9-28, R z47-66; hands L z9-13, R z62-66);
# legs y6-15 (L z29-37, R z38-46); feet y0-4 x16-27.
HX0, HX1, HY0, HY1, HZ0, HZ1 = 13, 28, 37, 58, 27, 48
FACE_X = 28


def rig_idx():
    from rigspace import RIG_SHAPE
    x = np.arange(RIG_SHAPE[0])[:, None, None]
    y = np.arange(RIG_SHAPE[1])[None, :, None]
    z = np.arange(RIG_SHAPE[2])[None, None, :]
    return x, y, z


def band(lo: int, hi: int, axis: int = 1) -> np.ndarray:
    from rigspace import RIG_SHAPE
    m = np.zeros(RIG_SHAPE, bool)
    idx = [slice(None)] * 3
    idx[axis] = slice(lo, hi)
    m[tuple(idx)] = True
    return m


def face(g: Grid, eye=None, eye_hi=None, brow=None, mouth=None, eye_y: int = 46, wide: bool = False) -> Grid:
    """Eyes, brows and mouth painted onto the face plate (x = FACE_X)."""
    eye = eye if eye is not None else C("navy", 1)
    for z0 in ((32, 42) if not wide else (31, 43)):
        g.box(FACE_X, eye_y, z0, FACE_X + 1, eye_y + 3, z0 + 2, eye)
        g.set(FACE_X, eye_y + 2, z0 + 1, eye_hi if eye_hi is not None else C("gray", 7))
        if brow is not None:
            g.box(FACE_X, eye_y + 4, z0 - 1, FACE_X + 1, eye_y + 5, z0 + 3, brow)
    if mouth is not None:
        g.box(FACE_X, 41, 36, FACE_X + 1, 42, 40, mouth)
    return g


def boots(g: Grid, col, cuff=None, top: int = 7, toe=None) -> Grid:
    from rigkit import leg_z_ranges
    for z0, z1 in leg_z_ranges().values():
        g.box(15, 0, z0 - 1, 27, 3, z1 + 1, col)
        g.box(15, 3, z0 - 1, 25, top, z1 + 1, col)
        if toe is not None:
            g.box(25, 0, z0, 28, 2, z1, toe)
        if cuff is not None:
            g.box(14, top, z0 - 2, 26, top + 2, z1 + 2, cuff)
    return g


def rig_part(name: str, grid: Grid, display: str, **rules):
    from rigkit import PIVOT, part_rules
    from voxgrid import Part
    return Part(name, grid, pivot=PIVOT, meta={"name": display, "rules": part_rules(**rules)})


def bdilate(mask: np.ndarray, n: int = 1) -> np.ndarray:
    """Cube (26-neighbour) dilation: keeps box corners square, so shells
    over the blocky PN body mesh into few quads."""
    out = mask.copy()
    for ax in range(3):
        for _ in range(n):
            grown = out.copy()
            for step in (1, -1):
                sh = np.roll(out, step, axis=ax)
                idx = [slice(None)] * 3
                idx[ax] = slice(0, 1) if step == 1 else slice(-1, None)
                sh[tuple(idx)] = False
                grown |= sh
            out = grown
    return out


def bshell(bones, t: int = 1) -> np.ndarray:
    from rigkit import body, region
    return bdilate(region(bones), t) & ~body()
