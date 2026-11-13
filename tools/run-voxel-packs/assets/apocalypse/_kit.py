"""Shared helpers for the post-apocalypse pack (pack-local; import as `_kit`).

World grids use glTF axes: +Y up, the front faces -Z. A viewer in front of an
asset (at -Z) sees +X on the LEFT, so decals on the -Z face run toward -X.
"""
from __future__ import annotations

import math
import random

import numpy as np

from voxgrid import C, PALETTE, RAMP_SHADES, Grid, Part, Socket, ramp_of

PACK = "apocalypse"

# ---------------------------------------------------------------- masks


def coords(shape):
    sx, sy, sz = shape
    return np.meshgrid(np.arange(sx) + 0.5, np.arange(sy) + 0.5, np.arange(sz) + 0.5, indexing="ij")


def box_mask(shape, x0, y0, z0, x1, y1, z1):
    m = np.zeros(shape, bool)
    sx, sy, sz = shape
    m[max(0, int(x0)) : min(sx, int(x1)), max(0, int(y0)) : min(sy, int(y1)), max(0, int(z0)) : min(sz, int(z1))] = True
    return m


def cyl_mask(shape, axis, c0, c1, r, lo, hi):
    x, y, z = coords(shape)
    if axis == "y":
        t, u, v = y, x, z
    elif axis == "x":
        t, u, v = x, y, z
    else:
        t, u, v = z, x, y
    return ((u - c0) ** 2 + (v - c1) ** 2 <= r * r) & (t >= lo) & (t < hi)


def sphere_mask(shape, cx, cy, cz, r):
    x, y, z = coords(shape)
    return (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r * r


def ramp_mask(g: Grid, *ramps: str):
    ids = [PALETTE["ramps"][r] for r in ramps]
    return np.isin(g.a // RAMP_SHADES, ids) & (g.a > 0)


def surface(g: Grid):
    a = g.a > 0
    p = np.pad(a, 1)
    inner = p[:-2, 1:-1, 1:-1] & p[2:, 1:-1, 1:-1] & p[1:-1, :-2, 1:-1] & p[1:-1, 2:, 1:-1] & p[1:-1, 1:-1, :-2] & p[1:-1, 1:-1, 2:]
    return a & ~inner


# ---------------------------------------------------------------- colour


def shift(g: Grid, mask, delta: int):
    """Shift the shade of every voxel in mask by delta (clamped in its ramp)."""
    xs, ys, zs = np.nonzero(mask & (g.a > 0))
    for x, y, z in zip(xs, ys, zs):
        ramp, shade = ramp_of(int(g.a[x, y, z]))
        new = min(RAMP_SHADES - 1, max(1 if ramp == "gray" else 0, shade + delta))
        g.a[x, y, z] = C(ramp, new)
    return g


def mottle(g: Grid, mask, choices, seed: int, weights=None):
    """Paint voxels in mask with random picks from palette indices `choices`."""
    rng = random.Random(seed)
    xs, ys, zs = np.nonzero(mask)
    for x, y, z in zip(xs, ys, zs):
        g.a[x, y, z] = rng.choices(choices, weights)[0]
    return g


def stripes(g: Grid, mask, axis: int, period: int, delta: int, width: int = 1, phase: int = 0):
    """Shade shift on voxels whose coordinate along axis is in a stripe."""
    idx = np.indices(g.shape)[axis]
    return shift(g, mask & (((idx + phase) % period) < width), delta)


def diag_stripes(g: Grid, mask, c1: int, c2: int, period: int = 4, axes=(0, 1)):
    idx = np.indices(g.shape)
    band = ((idx[axes[0]] + idx[axes[1]]) // (period // 2)) % 2 == 0
    g.a[mask & band] = c1
    g.a[mask & ~band] = c2
    return g


def rust_patches(g: Grid, seed: int, count: int, from_ramps=("steel", "iron", "red", "blue", "sky", "khaki", "gold", "orange", "teal", "gray", "forest"), rmin=0.8, rmax=2.4):
    """Blotches of rust over painted metal."""
    rng = random.Random(seed)
    candidates = np.argwhere(surface(g) & ramp_mask(g, *from_ramps))
    if len(candidates) == 0:
        return g
    for _ in range(count):
        cx, cy, cz = candidates[rng.randrange(len(candidates))]
        r = rng.uniform(rmin, rmax)
        ri = int(math.ceil(r))
        for x in range(cx - ri, cx + ri + 1):
            for y in range(cy - ri, cy + ri + 1):
                for z in range(cz - ri, cz + ri + 1):
                    if not (0 <= x < g.shape[0] and 0 <= y < g.shape[1] and 0 <= z < g.shape[2]):
                        continue
                    if (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 > r * r + rng.uniform(-0.8, 0.8):
                        continue
                    v = int(g.a[x, y, z])
                    if v and ramp_of(v)[0] in from_ramps:
                        g.a[x, y, z] = C("rust", rng.choice((2, 3, 3, 4, 4, 5)))
    return g


def drips(g: Grid, seed: int, count: int, color=None, from_ramps=None, lmin=2, lmax=7):
    """Vertical streaks running down exposed side faces (rust, grime, slime)."""
    rng = random.Random(seed)
    a = g.a
    sx, sy, sz = a.shape
    filled = a > 0
    dirs = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    cand = np.argwhere(surface(g) & (ramp_mask(g, *from_ramps) if from_ramps else filled))
    if len(cand) == 0:
        return g
    for _ in range(count):
        x, y, z = cand[rng.randrange(len(cand))]
        dx, dz = rng.choice(dirs)
        nx, nz = x + dx, z + dz
        if 0 <= nx < sx and 0 <= nz < sz and filled[nx, y, nz]:
            continue
        L = rng.randint(lmin, lmax)
        for k in range(L):
            yy = y - k
            if yy < 0 or not filled[x, yy, z]:
                break
            if 0 <= nx < sx and 0 <= nz < sz and filled[nx, yy, nz]:
                break
            c = color(k, L) if callable(color) else (color if color else C("rust", max(1, 4 - k // 2)))
            a[x, yy, z] = c
    return g


def grime(g: Grid, height: int = 3, delta: int = -1, mask=None):
    """Darken the lowest `height` layers of every column (dirt and AO)."""
    ys = np.indices(g.shape)[1]
    m = (ys < height) & (g.a > 0)
    if mask is not None:
        m &= mask
    return shift(g, m, delta)


def top_light(g: Grid, delta: int = 1, mask=None):
    """Lighten voxels with nothing directly above them (sunlit tops)."""
    a = g.a > 0
    above = np.zeros_like(a)
    above[:, :-1, :] = a[:, 1:, :]
    m = a & ~above
    if mask is not None:
        m &= mask
    return shift(g, m, delta)


def edge_light(g: Grid, delta: int = 1, mask=None):
    """Lighten convex vertical edges (voxels exposed on an x side AND a z side)."""
    a = g.a > 0
    p = np.pad(a, 1)
    ex = ~p[:-2, 1:-1, 1:-1] | ~p[2:, 1:-1, 1:-1]
    ez = ~p[1:-1, 1:-1, :-2] | ~p[1:-1, 1:-1, 2:]
    m = a & ex & ez
    if mask is not None:
        m &= mask
    return shift(g, m, delta)


# ---------------------------------------------------------------- decals / text

FONT = {
    "A": [".#.", "#.#", "###", "#.#", "#.#"], "B": ["##.", "#.#", "##.", "#.#", "##."], "C": [".##", "#..", "#..", "#..", ".##"],
    "D": ["##.", "#.#", "#.#", "#.#", "##."], "E": ["###", "#..", "##.", "#..", "###"], "F": ["###", "#..", "##.", "#..", "#.."],
    "G": [".##", "#..", "#.#", "#.#", ".##"], "H": ["#.#", "#.#", "###", "#.#", "#.#"], "I": ["###", ".#.", ".#.", ".#.", "###"],
    "J": ["..#", "..#", "..#", "#.#", ".#."], "K": ["#.#", "#.#", "##.", "#.#", "#.#"], "L": ["#..", "#..", "#..", "#..", "###"],
    "M": ["#.#", "###", "###", "#.#", "#.#"], "N": ["##.", "#.#", "#.#", "#.#", "#.#"], "O": [".#.", "#.#", "#.#", "#.#", ".#."],
    "P": ["##.", "#.#", "##.", "#..", "#.."], "Q": [".#.", "#.#", "#.#", "##.", ".##"], "R": ["##.", "#.#", "##.", "#.#", "#.#"],
    "S": [".##", "#..", ".#.", "..#", "##."], "T": ["###", ".#.", ".#.", ".#.", ".#."], "U": ["#.#", "#.#", "#.#", "#.#", "###"],
    "V": ["#.#", "#.#", "#.#", "#.#", ".#."], "W": ["#.#", "#.#", "###", "###", "#.#"], "X": ["#.#", "#.#", ".#.", "#.#", "#.#"],
    "Y": ["#.#", "#.#", ".#.", ".#.", ".#."], "Z": ["###", "..#", ".#.", "#..", "###"], "0": ["###", "#.#", "#.#", "#.#", "###"],
    "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["##.", "..#", ".#.", "#..", "###"], "3": ["##.", "..#", ".#.", "..#", "##."],
    "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "##.", "..#", "##."], "6": [".##", "#..", "###", "#.#", "###"],
    "7": ["###", "..#", ".#.", ".#.", ".#."], "8": ["###", "#.#", "###", "#.#", "###"], "9": ["###", "#.#", "###", "..#", "##."],
    "!": [".#.", ".#.", ".#.", "...", ".#."], "-": ["...", "...", "###", "...", "..."], "?": ["##.", "..#", ".#.", "...", ".#."],
    " ": ["...", "...", "...", "...", "..."], "+": ["...", ".#.", "###", ".#.", "..."], "$": [".##", "##.", ".#.", ".##", "##."],
}

# face -> (u axis, u sign, march axis, march sign). v is +y except '+y'/'-y' (v = +z).
_FACES = {
    "-z": (0, -1, 2, +1),
    "+z": (0, +1, 2, -1),
    "-x": (2, +1, 0, +1),
    "+x": (2, -1, 0, -1),
    "+y": (0, +1, 1, -1),
}


def paint_at(g: Grid, face: str, u: int, v: int, c: int, depth: int = 0) -> bool:
    """Recolour the first filled voxel on the ray into `face` at grid coords
    (u along the face's u axis, v up). depth>0 also paints behind it."""
    u_axis, _us, m_axis, m_sign = _FACES[face]
    v_axis = 2 if face == "+y" else 1
    n = g.shape[m_axis]
    rng_m = range(n) if m_sign > 0 else range(n - 1, -1, -1)
    for m in rng_m:
        p = [0, 0, 0]
        p[u_axis], p[v_axis], p[m_axis] = int(u), int(v), m
        if not (0 <= p[0] < g.shape[0] and 0 <= p[1] < g.shape[1] and 0 <= p[2] < g.shape[2]):
            return False
        if g.a[p[0], p[1], p[2]]:
            for k in range(depth + 1):
                q = list(p)
                q[m_axis] = m + k * m_sign
                if 0 <= q[m_axis] < n and g.a[q[0], q[1], q[2]]:
                    g.a[q[0], q[1], q[2]] = c
            return True
    return False


def text(g: Grid, face: str, s: str, uc: float, v0: int, c: int, scale: int = 1, gap: int = 1):
    """Blocky 3x5 text centred at grid coord uc (along the face's u axis),
    bottom row at v0, reading left-to-right for a viewer facing that side."""
    s = s.upper()
    _ua, us, _m, _ms = _FACES[face]
    width = len(s) * (3 * scale + gap) - gap
    start = uc - us * width / 2.0
    for i, ch in enumerate(s):
        rows = FONT[ch]
        for r, row in enumerate(rows):
            for col, px in enumerate(row):
                if px != "#":
                    continue
                for a in range(scale):
                    for b in range(scale):
                        uu = start + us * (i * (3 * scale + gap) + col * scale + a + (0.5 if us > 0 else -0.5))
                        vv = v0 + (4 - r) * scale + b
                        paint_at(g, face, math.floor(uu), vv, c)
    return g


def splat(g: Grid, face: str, uc, vc, r: float, c: int, seed: int, ragged: float = 0.6):
    """Irregular round paint splat (graffiti blob, blood, toxic slime)."""
    rng = random.Random(seed)
    ri = int(r) + 1
    for du in range(-ri, ri + 1):
        for dv in range(-ri, ri + 1):
            if du * du + dv * dv <= r * r + rng.uniform(-ragged, ragged) * r:
                paint_at(g, face, int(uc + du), int(vc + dv), c)
    return g


def tag(g: Grid, face: str, u0, v0, w: int, h: int, colors, seed: int):
    """Random graffiti scribble: a looping stroke plus a drop shadow."""
    rng = random.Random(seed)
    _ua, us, _m, _ms = _FACES[face]
    pts = []
    u, v = 0.0, h / 2
    for i in range(w * 2):
        u = i / 2
        v = h / 2 + (h / 2 - 1) * math.sin(i * rng.uniform(0.5, 0.9) + rng.random()) * rng.uniform(0.6, 1)
        pts.append((u, v))
    for k, (u, v) in enumerate(pts):
        col = colors[(k // 4) % len(colors)]
        paint_at(g, face, int(u0 + us * u), int(v0 + v), col)
        paint_at(g, face, int(u0 + us * u), int(v0 + v + 1), col)
    return g


# ---------------------------------------------------------------- parts / pivots


def bounds(a) -> tuple[np.ndarray, np.ndarray]:
    idx = np.argwhere(a > 0)
    return idx.min(0), idx.max(0) + 1


def bounds_pivot(g: Grid):
    lo, hi = bounds(g.a)
    return ((lo[0] + hi[0]) / 2.0, float(lo[1]), (lo[2] + hi[2]) / 2.0)


def split(g: Grid, root_name: str, spec, pivot=None) -> tuple[Part, dict]:
    """Split one modelling grid into a rigid part tree sharing its coordinates.

    spec: [(name, parent, mask, joint_xyz), ...] in order; a voxel goes to the
    first part whose mask holds it; the rest stay in the root. Joints are grid
    coordinates. Returns (root Part, {name: joint}) — joints are needed for
    sockets: socket position = joint_or_point - root pivot."""
    if g.solids:
        raise ValueError("split() cannot divide prisms between parts; build each part in its own grid")
    rest = g.a.copy()
    root_pivot = pivot or bounds_pivot(g)
    root = Part(root_name, None, pivot=root_pivot)
    parts = {root_name: root}
    joints = {root_name: tuple(root_pivot)}
    for name, parent, mask, joint in spec:
        sub = Grid(*g.shape)
        sel = mask & (rest > 0)
        sub.a[sel] = rest[sel]
        rest[sel] = 0
        pj = joints[parent]
        p = Part(name, sub, pivot=tuple(float(j) for j in joint), at=tuple(float(joint[i] - pj[i]) for i in range(3)))
        parts[parent].add(p)
        parts[name] = p
        joints[name] = tuple(joint)
    base = Grid(*g.shape)
    base.a = rest
    root.grid = base
    return root, joints


def rel(point, pivot):
    """Grid point -> root pivot space."""
    return tuple(float(point[i] - pivot[i]) for i in range(3))


def keys(*frames):
    """keys((t, (x, y, z)), ...) -> list; shorthand for clip channels."""
    return [(float(t), tuple(float(c) for c in v)) for t, v in frames]


def wobble(seconds, axis, amp, steps=8, phase=0.0):
    idx = "xyz".index(axis)
    out = []
    for i in range(steps + 1):
        v = [0.0, 0.0, 0.0]
        v[idx] = amp * math.sin(2 * math.pi * i / steps + phase)
        out.append((seconds * i / steps, tuple(v)))
    return out


def flicker(seconds, pattern, axis_all=True):
    """Scale keys from a list of scale factors (loops: last = first)."""
    n = len(pattern)
    out = []
    for i, s in enumerate(pattern + [pattern[0]]):
        out.append((seconds * i / n, (s, s, s)))
    return out


# ---------------------------------------------------------------- common pieces


def draw_wheel(g: Grid, cx, cy, cz, r: float, w: int, axis="x", tire="iron", rim=("steel", 4), hub=("steel", 6), spokes=5, seed=0):
    """Tyre with tread blocks, rim, hub and lug bolts. Axis 'x' = axle along x
    (centre cx is the axle middle). Returns the wheel mask."""
    x, y, z = coords(g.shape)
    if axis == "x":
        t, u, v = x - cx, y - cy, z - cz
    else:
        t, u, v = z - cz, y - cy, x - cx
    rad = np.sqrt(u * u + v * v)
    ang = np.arctan2(u, v)
    inw = np.abs(t) <= w / 2
    tyre = inw & (rad <= r)
    g.where(tyre, C(tire, 2))
    tread = tyre & (rad > r - 1.2) & ((np.floor((ang + math.pi) / (2 * math.pi) * max(8, int(r * 4))) % 2) == 0)
    g.where(tread, C(tire, 1))
    side = tyre & (np.abs(t) > w / 2 - 1) & (rad <= r * 0.62)
    g.where(side, C(*rim))
    g.where(side & (rad <= r * 0.62) & (rad > r * 0.5), C(rim[0], max(0, rim[1] - 1)))
    g.where(side & (rad <= max(1.0, r * 0.25)), C(*hub))
    for k in range(spokes):
        a = 2 * math.pi * k / spokes
        lu, lv = math.sin(a) * r * 0.4, math.cos(a) * r * 0.4
        g.where(side & ((u - lu) ** 2 + (v - lv) ** 2 <= 0.5), C(hub[0], min(7, hub[1] + 1)))
    return tyre


def barbed_wire(g: Grid, p0, p1, c=None, spike=None):
    c = c or C("iron", 4)
    spike = spike or C("steel", 5)
    g.line(p0, p1, 0.5, c)
    n = int(max(abs(p1[i] - p0[i]) for i in range(3)))
    for k in range(0, n, 3):
        t = k / max(1, n)
        p = [p0[i] + (p1[i] - p0[i]) * t for i in range(3)]
        g.set(p[0], p[1] + 1, p[2], spike).set(p[0], p[1] - 1, p[2], spike)
    return g


def crate(g: Grid, x0, y0, z0, w, h, d, ramp="wood", shade=4, seed=0):
    """Plank crate with darker frame edges and diagonal brace on ±z faces."""
    g.box(x0, y0, z0, x0 + w, y0 + h, z0 + d, C(ramp, shade))
    m = box_mask(g.shape, x0, y0, z0, x0 + w, y0 + h, z0 + d)
    stripes(g, m, 1, 3, -1, 1, phase=-y0)
    idx = np.indices(g.shape)
    ex = (idx[0] == x0) | (idx[0] == x0 + w - 1)
    ey = (idx[1] == y0) | (idx[1] == y0 + h - 1)
    ez = (idx[2] == z0) | (idx[2] == z0 + d - 1)
    frame = m & ((ex & ey) | (ey & ez) | (ex & ez))
    g.where(frame, C(ramp, max(0, shade - 2)))
    for zz in (z0, z0 + d - 1):
        for k in range(min(w, h)):
            g.set(x0 + int(k * (w - 1) / max(1, min(w, h) - 1)), y0 + k, zz, C(ramp, max(0, shade - 1)))
    return g


def pivot_sock(name, point, pivot, parent=None, rot=(0, 0, 0)):
    return Socket(name, at=rel(point, pivot), parent=parent, rot=rot)


def panel(g: Grid, face: str, u_lo, u_hi, v_lo, v_hi, c, depth: int = 0):
    """Paint a rectangle onto the first surface seen from `face`."""
    for u in range(int(u_lo), int(u_hi)):
        for v in range(int(v_lo), int(v_hi)):
            paint_at(g, face, u, v, c, depth)
    return g


def diamond(g: Grid, face: str, uc, vc, r: int, c, border=None, glyph=None, glyph_c=None):
    """Hazard diamond decal (rotated square) with an optional 3x5 glyph."""
    _ua, us, _m, _ms = _FACES[face]
    for du in range(-r, r + 1):
        for dv in range(-r, r + 1):
            d = abs(du) + abs(dv)
            if d <= r:
                paint_at(g, face, int(uc + du), int(vc + dv), border if (border and d == r) else c)
    if glyph:
        text(g, face, glyph, uc + (0.5 if us > 0 else 0.5), int(vc) - 2, glyph_c or C("iron", 1))
    return g


def flame(g: Grid, cx, y0, cz, r: float, h: float, seed: int = 0):
    """Voxel flame: red-orange base, ember body, pale-gold tongues. Returns its mask."""
    rng = random.Random(seed)
    before = g.a.copy()
    x, y, z = coords(g.shape)
    t = (y - y0) / h
    wob = 0.9 * np.sin((y - y0) * 0.9 + seed)
    rad = r * np.clip(1.0 - t, 0, 1) ** 0.8
    m = (t >= 0) & (t <= 1) & ((x - cx - wob * 0.5) ** 2 + (z - cz) ** 2 <= rad ** 2)
    g.where(m & (t < 0.25), C("red", 4))
    g.where(m & (t >= 0.25) & (t < 0.55), C("orange", 4))
    g.where(m & (t >= 0.55), C("ember", 3))
    g.where(m & (t >= 0.85), C("ember", 4))
    core = m & ((x - cx) ** 2 + (z - cz) ** 2 <= (rad * 0.55) ** 2) & (t < 0.75) & (t > 0.1)
    g.where(core, C("gold", 4))
    for _ in range(int(r * 2)):  # stray tongues
        a = rng.uniform(0, 2 * math.pi)
        tx, tz = cx + math.cos(a) * r * 0.6, cz + math.sin(a) * r * 0.6
        th = rng.uniform(0.4, 0.8) * h
        g.line((tx, y0 + h * 0.3, tz), (tx + math.cos(a), y0 + th + 1, tz + math.sin(a)), 0.6, C("orange", 5))
        g.set(tx + math.cos(a), y0 + th + 1, tz + math.sin(a), C("ember", 4))
    return (g.a != before) | m


def spark_keys(seconds, parts, amp=0.25, steps=6, seed=0):
    """Irregular flicker scale keys per part (loops cleanly)."""
    rng = random.Random(seed)
    out = {}
    for i, name in enumerate(parts):
        vals = [1.0 + rng.uniform(-amp, amp) for _ in range(steps)]
        ks = []
        for k, v in enumerate(vals + [vals[0]]):
            ks.append((seconds * k / steps, (1.0 + (v - 1) * 0.5, v, 1.0 + (v - 1) * 0.5)))
        out[name] = {"scale": ks}
    return out


def shell_box(g: Grid, x0, y0, z0, x1, y1, z1, c, t: int = 1):
    """Hollow box (walls t thick, open interior)."""
    g.box(x0, y0, z0, x1, y1, z1, c)
    g.box(x0 + t, y0 + t, z0 + t, x1 - t, y1 - t, z1 - t, 0)
    return g


def window(g: Grid, normal: str, plane: int, u0: int, v0: int, w: int, h: int, style: str = "dark", frame=None, seed: int = 0):
    """Window on a wall whose outer surface is at `plane` along `normal`
    ('-z', '+z', '-x', '+x'); u is the other horizontal axis (x for z walls,
    z for x walls), v is y. Styles: dark, broken, boarded, lit."""
    rng = random.Random(seed)
    frame = frame if frame is not None else C("iron", 3)
    axis = 2 if normal[1] == "z" else 0
    out = -1 if normal[0] == "-" else 1  # direction pointing out of the wall

    def put(u, v, depth, c):
        p = [0, v, 0]
        p[axis] = plane - out * depth
        p[2 - axis] = u
        g.set(p[0], p[1], p[2], c)

    for u in range(u0 - 1, u0 + w + 1):
        for v in range(v0 - 1, v0 + h + 1):
            edge = u in (u0 - 1, u0 + w) or v in (v0 - 1, v0 + h)
            if edge:
                put(u, v, 0, frame)
                if v == v0 - 1:
                    put(u, v, -1, frame)  # sill sticks out
            else:
                put(u, v, 0, 0)
                glass = {"lit": C("ember", 5), "dark": C("navy", 1), "broken": C("navy", 0), "boarded": C("iron", 0)}[style]
                put(u, v, 1, glass)
                if style == "lit" and rng.random() < 0.3:
                    put(u, v, 1, C("ember", 6))
                if style == "dark" and (u - u0 + v - v0) % 5 == 0:
                    put(u, v, 1, C("sky", 3))
    if style == "broken":
        for u, v in ((u0, v0 + h - 1), (u0 + 1, v0 + h - 1), (u0, v0 + h - 2), (u0 + w - 1, v0), (u0 + w - 2, v0)):
            put(u, v, 1, C("sky", 5))
    if style == "boarded":
        for k in range(2):
            vv = v0 + (h // 3) * (k + 1) - 1
            for u in range(u0 - 1, u0 + w + 1):
                dv = int((u - u0) * (0.4 if k else -0.3))
                put(u, vv + dv, -1, C("wood", 4 + k))
        for u in range(u0, u0 + w, 2):
            put(u, v0 + 1, -1, C("wood", 5))
    return g


def roof_holes(g: Grid, seed: int, count: int, y: int, x0, z0, x1, z1, r=(1.5, 3.5)):
    rng = random.Random(seed)
    for _ in range(count):
        cx, cz, rr = rng.uniform(x0, x1), rng.uniform(z0, z1), rng.uniform(*r)
        m = sphere_mask(g.shape, cx, y, cz, rr) & (np.indices(g.shape)[1] >= y - 1)
        g.carve(m)
    return g


def sedan(g: Grid, ox: int, oy: int, oz: int, paint=("sky", 4), wrecked: bool = True, seed: int = 0):
    """Boxy 70s sedan, 16 wide (x), 36 long (z, front at low z), from corner
    (ox, oy, oz). Wheels are drawn in place. Returns wheel centres."""
    rng = random.Random(seed)
    ramp, sh = paint
    x0, z0 = ox, oz
    W, L = 16, 36
    g.box(x0, oy + 3, z0 + 1, x0 + W, oy + 9, z0 + L - 1, C(ramp, sh))  # lower body
    g.box(x0, oy + 8, z0 + 1, x0 + W, oy + 9, z0 + L - 1, C(ramp, sh + 1))  # shoulder line
    g.box(x0 - 0, oy + 5, z0, x0 + W, oy + 6, z0 + L, C("steel", 6))  # chrome strip / bumpers
    g.box(x0 + 1, oy + 3, z0 - 1, x0 + W - 1, oy + 5, z0, C("steel", 5))
    g.box(x0 + 1, oy + 3, z0 + L, x0 + W - 1, oy + 5, z0 + L + 1, C("steel", 5))
    g.box(x0 + 2, oy + 9, z0 + 11, x0 + W - 2, oy + 15, z0 + 27, C(ramp, sh))  # cabin
    g.box(x0 + 2, oy + 14, z0 + 12, x0 + W - 2, oy + 15, z0 + 26, C(ramp, sh + 1))
    glass = C("navy", 1) if wrecked else C("sky", 5)
    g.box(x0 + 3, oy + 9, z0 + 10, x0 + W - 3, oy + 14, z0 + 11, glass)  # windscreen
    g.box(x0 + 3, oy + 9, z0 + 27, x0 + W - 3, oy + 13, z0 + 28, glass)
    for xx in (x0 + 2, x0 + W - 3):
        g.box(xx, oy + 10, z0 + 12, xx + 1, oy + 14, z0 + 18, glass)
        g.box(xx, oy + 10, z0 + 19, xx + 1, oy + 14, z0 + 26, glass)
    g.box(x0 + 1, oy + 6, z0, x0 + 4, oy + 8, z0 + 1, C("gold", 6))  # headlights
    g.box(x0 + W - 4, oy + 6, z0, x0 + W - 1, oy + 8, z0 + 1, C("gold", 6))
    g.box(x0 + 5, oy + 6, z0, x0 + W - 5, oy + 8, z0 + 1, C("iron", 2))  # grille
    g.box(x0 + 1, oy + 6, z0 + L - 1, x0 + 3, oy + 8, z0 + L, C("red", 5))
    g.box(x0 + W - 3, oy + 6, z0 + L - 1, x0 + W - 1, oy + 8, z0 + L, C("red", 5))
    wheels = []
    for wz in (z0 + 7, z0 + L - 8):
        for wx in (x0 + 1, x0 + W - 1):
            draw_wheel(g, wx, oy + 3.5, wz, 3.5, 3, axis="x")
            wheels.append((wx, oy + 3.5, wz))
    if wrecked:
        rust_patches(g, seed, 14, from_ramps=(ramp, "steel"))
        drips(g, seed + 1, 14, from_ramps=(ramp,))
        for _ in range(4):  # smashed glass holes
            gx = rng.choice((x0 + 2, x0 + W - 3))
            g.set(gx, oy + rng.randint(10, 13), z0 + rng.randint(12, 25), 0)
    return wheels


def vehicle_rig(g: Grid, name: str, wheels, r: float, w: float, extra=(), spin_seconds: float = 0.6, bounce: float = 0.4):
    """Split a vehicle grid into body + wheel parts. wheels: [(cx, cy, cz)]
    with axles along x. Returns (root, clips) with `move` (wheels roll
    forward toward -Z, body bounces) and `idle` (engine shake)."""
    from voxgrid import Clip, turn

    spec = []
    x, y, z = coords(g.shape)
    for i, (cx, cy, cz) in enumerate(wheels):
        m = ((y - cy) ** 2 + (z - cz) ** 2 <= (r + 0.6) ** 2) & (np.abs(x - cx) <= w / 2 + 0.6)
        spec.append((f"wheel-{i}", name, m, (cx, cy, cz)))
    lo, hi = bounds(g.a)
    body_joint = ((lo[0] + hi[0]) / 2, float(r), (lo[2] + hi[2]) / 2)
    everything = g.a > 0
    spec.append(("body", name, everything, body_joint))
    spec.extend(extra)
    root, joints = split(g, name, spec)
    spin = turn(spin_seconds, "x", -360 / spin_seconds)
    move = {f"wheel-{i}": {"rot": spin} for i in range(len(wheels))}
    move["body"] = {"loc": [(spin_seconds * k / 4, (0, bounce if k % 2 else 0, 0)) for k in range(5)],
                    "rot": [(0.0, (0, 0, 0)), (spin_seconds / 2, (1.2, 0, 0.6)), (spin_seconds, (0, 0, 0))]}
    idle = {"body": {"loc": [(k * 0.08, (0, 0.18 if k % 2 else 0, 0)) for k in range(11)]}}
    return root, joints, [Clip("move", move), Clip("idle", idle)]


def hollow_inside(g: Grid, keep: int = 1):
    """Clear voxels deeper than `keep` layers inside solids (lighter builds)."""
    a = g.a > 0
    inner = a.copy()
    for _ in range(keep):
        p = np.pad(inner, 1)
        inner = p[:-2, 1:-1, 1:-1] & p[2:, 1:-1, 1:-1] & p[1:-1, :-2, 1:-1] & p[1:-1, 2:, 1:-1] & p[1:-1, 1:-1, :-2] & p[1:-1, 1:-1, 2:] & inner
    g.a[inner] = 0
    return g


class Humanoid:
    """Chunky PN-proportioned humanoid for world creatures (faces -Z).

    Draws into `g` around centre (cx, cz). Dimensions in voxels. Keeps the
    joint positions and part masks so `rig()` can split it into
    body/head/arm-l/arm-r/leg-l/leg-r (the character's right is +X)."""

    def __init__(self, g: Grid, cx: float, cz: float, leg_h=11, leg_w=4, hip_gap=1, torso_h=11, torso_w=12, torso_d=7,
                 head=11, head_d=10, arm_w=3, arm_len=11, pose="reach", hunch=0):
        self.g = g
        self.cx, self.cz = cx, cz
        self.leg_h, self.leg_w, self.hip_gap = leg_h, leg_w, hip_gap
        self.torso_h, self.torso_w, self.torso_d = torso_h, torso_w, torso_d
        self.head, self.head_d = head, head_d
        self.arm_w, self.arm_len, self.pose, self.hunch = arm_w, arm_len, pose, hunch
        self.hip_y = leg_h
        self.neck_y = leg_h + torso_h
        self.sh_y = self.neck_y - arm_w / 2 - 0.5
        tz = cz - hunch  # torso/head shift forward when hunched
        self.tz = tz
        self.head_z = tz - hunch
        hw = torso_w / 2
        self.boxes = {
            "leg-r": (cx + hip_gap / 2, 0, cz - 2.5, cx + hip_gap / 2 + leg_w, leg_h, cz + 2.5),
            "leg-l": (cx - hip_gap / 2 - leg_w, 0, cz - 2.5, cx - hip_gap / 2, leg_h, cz + 2.5),
            "torso": (cx - hw, leg_h, tz - torso_d / 2, cx + hw, self.neck_y, tz + torso_d / 2),
            "head": (cx - head / 2, self.neck_y, self.head_z - head_d / 2, cx + head / 2, self.neck_y + head, self.head_z + head_d / 2),
        }
        ay0, ay1 = self.sh_y - arm_w / 2, self.sh_y + arm_w / 2
        if pose == "reach":
            self.boxes["arm-r"] = (cx + hw, ay0, tz - arm_len, cx + hw + arm_w, ay1, tz + 1)
            self.boxes["arm-l"] = (cx - hw - arm_w, ay0, tz - arm_len, cx - hw, ay1, tz + 1)
        else:
            self.boxes["arm-r"] = (cx + hw, ay1 - arm_len, tz - arm_w / 2, cx + hw + arm_w, ay1, tz + arm_w / 2)
            self.boxes["arm-l"] = (cx - hw - arm_w, ay1 - arm_len, tz - arm_w / 2, cx - hw, ay1, tz + arm_w / 2)

    def draw(self, skin, shirt, pants, shoes, sleeve=None):
        g = self.g
        b = self.boxes
        for leg in ("leg-l", "leg-r"):
            x0, y0, z0, x1, y1, z1 = b[leg]
            g.box(x0, y0, z0, x1, y1, z1, pants)
            g.box(x0, 0, z0 - 1, x1, 3, z1, shoes)
        x0, y0, z0, x1, y1, z1 = b["torso"]
        g.box(x0, y0, z0, x1, y1, z1, shirt)
        g.box(x0, y0, z0, x1, y0 + 2, z1, pants)
        for arm in ("arm-l", "arm-r"):
            x0, y0, z0, x1, y1, z1 = b[arm]
            g.box(x0, y0, z0, x1, y1, z1, sleeve if sleeve is not None else shirt)
            if self.pose == "reach":
                g.box(x0, y0, z0, x1, y1, z0 + 3, skin)  # hands
                g.box(x0, y0 - 1, z0, x0 + 1, y0, z0 + 1, skin)  # fingers
                g.box(x1 - 1, y0 - 1, z0, x1, y0, z0 + 1, skin)
            else:
                g.box(x0, y0, z0, x1, y0 + 3, z1, skin)
        x0, y0, z0, x1, y1, z1 = b["head"]
        g.box(x0, y0, z0, x1, y1, z1, skin)
        g.box(x0 + 1, y1 - 1, z0 + 1, x1 - 1, y1, z1 - 1, skin)
        return self

    def face_z(self):
        return int(self.boxes["head"][2])

    def rig(self, name: str, extra=()):
        """Split into parts; returns (root, joints)."""
        g = self.g
        cx, cz = self.cx, self.cz
        pad = 1.5

        def m(key):
            x0, y0, z0, x1, y1, z1 = self.boxes[key]
            return box_mask(g.shape, x0 - pad, y0 - pad * (0 if key.startswith("leg") else 1), z0 - pad, x1 + pad, y1 + pad * (0 if key.startswith("leg") else 1), z1 + pad)

        tz = self.tz
        hw = self.torso_w / 2
        joints = {
            "leg-l": (self.boxes["leg-l"][0] + self.leg_w / 2, self.hip_y, cz),
            "leg-r": (self.boxes["leg-r"][0] + self.leg_w / 2, self.hip_y, cz),
            "body": (cx, self.hip_y, tz),
            "head": (cx, self.neck_y, self.head_z),
            "arm-l": (cx - hw - self.arm_w / 2, self.sh_y, tz),
            "arm-r": (cx + hw + self.arm_w / 2, self.sh_y, tz),
        }
        ys = np.indices(g.shape)[1]
        head = m("head") & (ys >= self.neck_y)
        legs_l = m("leg-l") & (ys < self.hip_y)
        legs_r = m("leg-r") & (ys < self.hip_y)
        order = [
            ("leg-l", name, legs_l, joints["leg-l"]),
            ("leg-r", name, legs_r, joints["leg-r"]),
            ("body", name, (g.a > 0) & ~legs_l & ~legs_r, joints["body"]),
            ("head", "body", head, joints["head"]),
            ("arm-l", "body", m("arm-l") & ~head, joints["arm-l"]),
            ("arm-r", "body", m("arm-r") & ~head, joints["arm-r"]),
        ] + list(extra)
        root, joints_out = split_claim(g, name, order)
        return root, joints_out


def split_claim(g: Grid, root_name: str, spec, pivot=None):
    """Like split(), but voxels are claimed by every non-root-level spec entry
    in *reverse* order (children before their parents), so a parent mask such
    as 'everything' only keeps what its children did not take."""
    if g.solids:
        raise ValueError("split() cannot divide prisms between parts; build each part in its own grid")
    rest = g.a.copy()
    root_pivot = pivot or bounds_pivot(g)
    grids = {}
    for name, parent, mask, joint in reversed(spec):
        sub = Grid(*g.shape)
        sel = mask & (rest > 0)
        sub.a[sel] = rest[sel]
        rest[sel] = 0
        grids[name] = sub
    root = Part(root_name, None, pivot=root_pivot)
    base = Grid(*g.shape)
    base.a = rest
    root.grid = base
    parts = {root_name: root}
    joints = {root_name: tuple(root_pivot)}
    for name, parent, mask, joint in spec:
        pj = joints[parent]
        p = Part(name, grids[name], pivot=tuple(float(j) for j in joint), at=tuple(float(joint[i] - pj[i]) for i in range(3)))
        parts[parent].add(p)
        parts[name] = p
        joints[name] = tuple(joint)
    return root, joints


def humanoid_clips(speed: float = 1.0, lurch: float = 1.0, death: bool = True):
    """idle / move / attack / hit / death for a Humanoid rig (parts body,
    head, arm-l, arm-r, leg-l, leg-r; root name given at Asset level)."""
    from voxgrid import Clip

    T = 2.0
    idle = {
        "body": {"rot": wobble(T, "z", 4 * lurch) },
        "head": {"rot": [(t, (4, v[1], v[2] * 2.5)) for t, v in wobble(T, "z", 4 * lurch, phase=1.2)]},
        "arm-l": {"rot": wobble(T, "x", 7, phase=0.0)},
        "arm-r": {"rot": wobble(T, "x", 7, phase=2.0)},
    }
    W = 1.2 / speed
    move = {
        "leg-l": {"rot": wobble(W, "x", 26)},
        "leg-r": {"rot": wobble(W, "x", -26)},
        "arm-l": {"rot": wobble(W, "x", -10)},
        "arm-r": {"rot": wobble(W, "x", 10)},
        "body": {"loc": [(W * k / 8, (0, 0.7 * abs(math.sin(math.pi * k / 4)), 0)) for k in range(9)], "rot": wobble(W, "z", 5 * lurch)},
        "head": {"rot": wobble(W, "z", 6 * lurch, phase=1.0)},
    }
    attack = {
        "arm-l": {"rot": keys((0, (0, 0, 0)), (0.25, (50, 0, -8)), (0.42, (-35, 0, 0)), (0.8, (0, 0, 0)))},
        "arm-r": {"rot": keys((0, (0, 0, 0)), (0.25, (50, 0, 8)), (0.42, (-35, 0, 0)), (0.8, (0, 0, 0)))},
        "body": {"rot": keys((0, (0, 0, 0)), (0.25, (6, 0, 0)), (0.42, (-14, 0, 0)), (0.8, (0, 0, 0)))},
        "head": {"rot": keys((0, (0, 0, 0)), (0.25, (12, 0, 0)), (0.42, (-10, 0, 0)), (0.8, (0, 0, 0)))},
    }
    hit = {
        "body": {"rot": keys((0, (0, 0, 0)), (0.1, (16, 0, -5)), (0.4, (0, 0, 0)))},
        "head": {"rot": keys((0, (0, 0, 0)), (0.1, (18, 0, 10)), (0.4, (0, 0, 0)))},
        "arm-l": {"rot": keys((0, (0, 0, 0)), (0.1, (25, 0, 0)), (0.4, (0, 0, 0)))},
        "arm-r": {"rot": keys((0, (0, 0, 0)), (0.1, (25, 0, 0)), (0.4, (0, 0, 0)))},
    }
    clips = [Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False)]
    if death:
        dk = {
            "body": {"rot": keys((0, (0, 0, 0)), (0.3, (-12, 0, 0)), (0.9, (80, 0, 6)), (1.0, (76, 0, 6)), (1.1, (80, 0, 6)))},
            "body@loc": None,
            "leg-l": {"rot": keys((0, (0, 0, 0)), (0.9, (-20, 0, 0)), (1.1, (-20, 0, 0)))},
            "leg-r": {"rot": keys((0, (0, 0, 0)), (0.9, (-10, 0, 0)), (1.1, (-10, 0, 0)))},
            "arm-l": {"rot": keys((0, (0, 0, 0)), (0.9, (60, 0, -20)), (1.1, (60, 0, -20)))},
            "arm-r": {"rot": keys((0, (0, 0, 0)), (0.9, (40, 0, 30)), (1.1, (40, 0, 30)))},
            "head": {"rot": keys((0, (0, 0, 0)), (0.9, (20, 0, 25)), (1.1, (20, 0, 25)))},
        }
        del dk["body@loc"]
        dk["body"]["loc"] = keys((0, (0, 0, 0)), (0.9, (0, -6, 0)), (1.1, (0, -6, 0)))
        clips.append(Clip("death", dk, loop=False))
    return clips


FWD = (0, 90, 0)  # socket rotation: emitter +Z -> item +X
GRIP = (0, 0, 3)  # palm centre relative to the Hand.R joint (voxels)


def held_asset(slug: str, name: str, g: Grid, grip, sockets, pfx=(), clips=()):
    """Held item in the Hand.R frame: grid x = forward (working end at +x),
    y = back of hand (up), z = along the arm. `grip` = grid point the palm
    wraps; sockets = [(name, grid point[, rot])]. FWD turns a socket's +Z
    (the emitter axis) to +X, the working direction."""
    from voxgrid import Asset

    pivot = (grip[0] - GRIP[0], grip[1] - GRIP[1], grip[2] - GRIP[2])
    socks = []
    for entry in sockets:
        n, p = entry[0], entry[1]
        rot = entry[2] if len(entry) > 2 else (0, 0, 0)
        socks.append(Socket(n, at=tuple(float(p[i] - pivot[i]) for i in range(3)), rot=rot))
    return Asset(id=f"{PACK}-held-items-{slug}", pack=PACK, category="held-items", name=name, root=Part(slug, g, pivot=pivot), sockets=socks, pfx=list(pfx), clips=list(clips))


# ---------------------------------------------------------------- rig (skins / avatar parts)


class RigBody:
    """Painting helpers on the PN species_1 body (rig space, faces +X)."""

    def __init__(self, g: Grid):
        from rigkit import bbox, body, leg_z_ranges, region, shell

        self.g = g
        self.region, self.shell, self.body = region, shell, body
        (self.hx0, self.hy0, self.hz0), (self.hx1, self.hy1, self.hz1) = bbox(region(["Head"]))
        self.legs = leg_z_ranges()
        idx = np.indices(g.shape)
        self.X, self.Y, self.Z = idx[0], idx[1], idx[2]
        self.fx = self.hx1 - 1  # face plate x

    def paint(self, skin, top, sleeve, hand, pants, boots, boot_hi=6, cuff=None):
        g, r = self.g, self.region
        g.where(r(["Head"]), skin)
        g.where(r(["Chest", "Body"]), top)
        g.where(r(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"]), sleeve)
        g.where(r(["Hand.L", "Hand.R"]), hand)
        g.where(r(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R", "Foot.L", "Foot.R"]), pants)
        g.where(r(["Body"]) & (self.Y < 18), pants)
        self.boots(boots, boot_hi, cuff)
        return self

    def boots(self, c, hi=6, cuff=None, toe=None):
        for z0, z1 in self.legs.values():
            self.g.box(15, 0, z0, 26, hi, z1, c)
            self.g.box(15, 0, z0, 27, 2, z1, toe if toe is not None else c)
            if cuff is not None:
                self.g.box(15, hi, z0, 25, hi + 1, z1, cuff)
        return self

    def eyes(self, c=None, white=None, y=None, left=(33, 35), right=(41, 43), h=2):
        y = self.hy0 + 11 if y is None else y
        for z0, z1 in (left, right):
            if white is not None:
                self.g.box(self.fx, y - 1, z0 - 1, self.fx + 1, y + h + 1, z1 + 1, white)
            self.g.box(self.fx, y, z0, self.fx + 1, y + h, z1, c if c is not None else C("navy", 1))
        return self

    def mouth(self, c, z0=36, z1=41, y=None, h=1):
        y = self.hy0 + 6 if y is None else y
        self.g.box(self.fx, y, z0, self.fx + 1, y + h, z1, c)
        return self

    def brows(self, c, y=None):
        y = self.hy0 + 14 if y is None else y
        self.g.box(self.fx, y, 32, self.fx + 1, y + 1, 36, c).box(self.fx, y, 40, self.fx + 1, y + 1, 44, c)
        return self

    def head_shell(self, t=1, y_from=0, back_x=None):
        m = self.shell(["Head"], t) & (self.Y >= self.hy0 + y_from)
        if back_x is not None:
            m &= self.X < back_x
        return m

    def hair(self, c, y_from=17, back=True):
        m = self.shell(["Head"], 1) & (self.Y >= self.hy0 + y_from)
        if back:
            m |= self.shell(["Head"], 1) & (self.X < self.hx0 + 5) & (self.Y >= self.hy0 + 6)
        self.g.where(m, c)
        return m

    def torso_shell(self, t=1, y0=16, y1=37):
        return self.shell(["Chest", "Body"], t) & (self.Y >= y0) & (self.Y < y1)

    def arm_shell(self, t=1, bones=("Arm.L", "Arm.R")):
        return self.shell(list(bones), t)

    def leg_shell(self, t=1, y1=16):
        return (self.shell(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"], t) | (self.shell(["Body"], t) & (self.Y < 19))) & (self.Y < y1 + 3)
