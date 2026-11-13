"""Apocalypse helpers for the animated props, creatures and terrain scope.

Pirate Nation style (docs/art-direction.md): chunky prisms with
true slopes, detail painted on flat faces. The shared kit (pnkit, pnshapes,
pnpaint, pnglyph, paint) does most of the work; this file adds what the
scope needs on top of it:

- `Rig`: build every part in one shared voxel frame, then crop each part and
  hang it on its joint (prisms survive the crop). Sockets use the same frame.
- `limb`: a skew n-gon frustum between two 3D points (true slopes for arms,
  legs, branches, pipes, reeds). (kit candidate)
- `rock`: an irregular faceted boulder or strata tier (a frustum with a
  jittered, offset top). (kit candidate)
- `flame`: a faceted teardrop flame for flickering fire parts. (kit candidate)
- `tuft`: a clump of leaning grass blades (true slopes). (kit candidate)
- `slab`: a tilted board or slab: a rotated rectangle prism. (kit candidate)
- `skin`, `cloth`: soft painted surfaces for creatures (rule S3).
- `keys`, `fx`, `make`: clip keys, pfx bindings and the Asset.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from voxgrid import C, PRISM_PLANE, Asset, Clip, Grid, Part, Socket, _AXIS_INDEX, pfx_binding

PACK = "apocalypse"


# ------------------------------------------------------------------ basics
def idx(g: Grid):
    """Integer voxel indices (X, Y, Z)."""
    return np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")


def ctr(g: Grid):
    """Voxel-centre coordinates (X, Y, Z) = index + 0.5."""
    return S.coords(g)


def last(g: Grid) -> np.ndarray:
    return g.solids[-1].mask(g.shape)


def keys(*pairs):
    """keys((t, (x, y, z)), ...) -> clip key list."""
    return [(float(t), tuple(float(c) for c in v)) for t, v in pairs]


def loop(seconds: float, values, t0: float = 0.0):
    """Evenly spaced keys over `seconds` that return to the first value."""
    vals = list(values) + [values[0]]
    n = len(vals) - 1
    return keys(*[(t0 + seconds * k / n, v) for k, v in enumerate(vals)])


def fx(effect: str, socket: str, trigger: str = "idle", **kw) -> dict:
    return pfx_binding(effect, socket, trigger, **kw)


def make(category: str, slug: str, name: str, root: Part, clips=(), sockets=(), pfx=()) -> Asset:
    return Asset(id=f"{PACK}-{category}-{slug}", pack=PACK, category=category, name=name, root=root, clips=list(clips), sockets=list(sockets), pfx=list(pfx))


# ------------------------------------------------------------------ rig
def _extent(g: Grid) -> tuple[list[int], list[int]]:
    """Bounds of the filled voxels and every prism vertex (whole voxels)."""
    nz = np.nonzero(g.a)
    if len(nz[0]) == 0:
        raise ValueError("a part grid is empty")
    lo = [int(v.min()) for v in nz]
    hi = [int(v.max()) + 1 for v in nz]
    for s in g.solids:
        t = _AXIS_INDEX[s.axis]
        u, v = PRISM_PLANE[s.axis]
        pts = s.poly + s.upper
        for axis, vals in ((u, [p[0] for p in pts]), (v, [p[1] for p in pts]), (t, [s.lo, s.hi])):
            lo[axis] = min(lo[axis], int(math.floor(min(vals))))
            hi[axis] = max(hi[axis], int(math.ceil(max(vals))))
    return lo, hi


def tight(g: Grid, margin: int = 1) -> tuple[Grid, tuple[int, int, int]]:
    """Crop a grid (voxels and prisms, via Grid.crop) to its content plus a
    margin. Returns (grid, offset of the crop in the source grid)."""
    lo, hi = _extent(g)
    lo = [max(0, a - margin) for a in lo]
    hi = [min(n, b + margin) for b, n in zip(hi, g.shape)]
    return g.crop(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]), (lo[0], lo[1], lo[2])


class Rig:
    """Parts painted in one shared frame (full-size grids), hung on joints.

    `origin` is the root node origin in the shared frame (put it on the
    ground under the model, so a root rotation turns about the feet).
    Sockets take shared-frame points."""

    def __init__(self, name: str, origin, grid: Grid | None = None):
        self.origin = tuple(float(c) for c in origin)
        if grid is not None:
            g, off = tight(grid)
            self.root = Part(name, g, pivot=tuple(self.origin[i] - off[i] for i in range(3)))
        else:
            self.root = Part(name)
        self.joints = {name: (self.root, self.origin)}

    def add(self, name: str, grid: Grid, joint, parent: str | None = None, rot=(0.0, 0.0, 0.0)) -> Part:
        parent = parent or self.root.name
        pp, pj = self.joints[parent]
        g, off = tight(grid)
        j = tuple(float(c) for c in joint)
        p = pp.add(Part(name, g, pivot=tuple(j[i] - off[i] for i in range(3)), at=tuple(j[i] - pj[i] for i in range(3)), rot=tuple(rot)))
        self.joints[name] = (p, j)
        return p

    def socket(self, name: str, point, parent: str | None = None, rot=(0.0, 0.0, 0.0)) -> Socket:
        """A socket at a shared-frame point, in root pivot space."""
        return Socket(name, at=tuple(float(point[i]) - self.origin[i] for i in range(3)), parent=parent, rot=tuple(rot))


# ------------------------------------------------------------------ prisms
def side(g: Grid, pts_yz, x0, x1, ramp: str, shade: int) -> np.ndarray:
    """A prism across x from a side-view polygon of (y, z) points."""
    g.prism("x", pts_yz, x0, x1, C(ramp, shade))
    return last(g)


def front(g: Grid, pts_xy, z0, z1, ramp: str, shade: int) -> np.ndarray:
    """A prism along z from a front-view polygon of (x, y) points."""
    g.prism("z", pts_xy, z0, z1, C(ramp, shade))
    return last(g)


def plan(g: Grid, pts_xz, y0, y1, ramp: str, shade: int, top=None) -> np.ndarray:
    """A prism up y from a plan polygon of (x, z) points (`top`: a frustum)."""
    g.prism("y", pts_xz, y0, y1, C(ramp, shade), top=top)
    return last(g)


def limb(g: Grid, p0, p1, r0: float, r1: float | None = None, ramp: str = "teal", shade: int = 4, n: int = 4, facing: float | None = None) -> np.ndarray:
    """A skew n-gon frustum from p0 to p1 (x, y, z points): flat radius r0
    at p0 and r1 at p1. It runs along the axis where the points differ
    most; its end caps are square to that axis and its sides are true
    slopes. n=4 gives a chunky square limb, 6 or 8 a rounder one. (kit candidate)"""
    r1 = r0 if r1 is None else r1
    d = [p1[i] - p0[i] for i in range(3)]
    t = int(np.argmax(np.abs(d)))
    if abs(d[t]) < 1e-6:
        raise ValueError("limb needs two different points")
    axis = "xyz"[t]
    u, v = PRISM_PLANE[axis]
    if d[t] < 0:
        p0, p1, r0, r1 = p1, p0, r1, r0
    face = S._DOWN[axis] if facing is None else facing
    poly = S.flat_ngon(p0[u], p0[v], r0, n, face)
    top = S.flat_ngon(p1[u], p1[v], r1, n, face) if r1 > 0 else [(p1[u], p1[v])] * n
    g.prism(axis, poly, p0[t], p1[t], C(ramp, shade), top=top)
    return last(g)


def slab(g: Grid, axis: str, cu, cv, w: float, h: float, lo, hi, angle: float, ramp: str, shade: int = 4) -> np.ndarray:
    """A board or slab: a w×h rectangle centred on (cu, cv) in the plane
    across `axis`, turned by `angle` degrees, extruded over [lo, hi). (kit candidate)"""
    pts = [(cu - w / 2, cv - h / 2), (cu + w / 2, cv - h / 2), (cu + w / 2, cv + h / 2), (cu - w / 2, cv + h / 2)]
    g.prism(axis, S.rotate(pts, cu, cv, angle), lo, hi, C(ramp, shade))
    return last(g)


def blob(cu: float, cv: float, ru: float, rv: float, n: int = 9, jitter: float = 0.18, seed: int = 0, turn: float = 0.0):
    """An irregular convex-ish polygon (u, v): a jittered ellipse."""
    rng = np.random.default_rng(seed)
    pts = []
    for k in range(n):
        a = turn + 2 * math.pi * k / n
        f = 1.0 + rng.uniform(-jitter, jitter)
        pts.append((cu + ru * f * math.cos(a), cv + rv * f * math.sin(a)))
    return pts


def rock(g: Grid, cx, cz, y0, rx: float, rz: float, h: float, ramp: str = "sand", shade: int = 4, shrink: float = 0.62, lean=(0.0, 0.0), n: int = 7, seed: int = 0, turn: float = 0.0) -> np.ndarray:
    """A faceted boulder, mesa tier or rubble lump: an irregular n-gon that
    rises h to a smaller, offset copy (true slopes all round). (kit candidate)"""
    base = blob(cx, cz, rx, rz, n, 0.2, seed, turn)
    tx, tz = cx + lean[0], cz + lean[1]
    top = [(tx + (u - cx) * shrink, tz + (v - cz) * shrink) for u, v in base]
    return plan(g, base, y0, y0 + h, ramp, shade, top=top)


def flame_outline(cu: float, v0: float, h: float, w: float, lean: float = 0.0, flip: bool = False):
    """A licking flame silhouette (u, v): a round belly, a lick on each side
    and a leaning tip. `w` is the half-width at the belly."""
    s = -1 if flip else 1
    pts = [(-0.55, 0.0), (0.55, 0.0), (1.0, 0.26), (0.8, 0.5), (0.95, 0.72), (0.42, 0.62), (lean / max(w, 1e-6), 1.0), (-0.3, 0.66), (-0.72, 0.84), (-0.62, 0.52), (-1.0, 0.3)]
    return [(cu + s * a * w, v0 + b * h) for a, b in pts]


def flame(g: Grid, cx, cz, y0, h: float, r: float, lean=(0.0, 0.0), n: int = 6, seed: int = 0, t: float = 3.0) -> np.ndarray:
    """A flame of two crossed cards with a licking outline (true slopes):
    ember orange at the rim, a gold heart and a red tip. (kit candidate)"""
    lx, lz = lean
    m = front(g, flame_outline(cx, y0, h, r, lx, flip=bool(seed % 2)), cz - t / 2, cz + t / 2, "ember", 3)
    m |= side(g, [(v, u) for u, v in flame_outline(cz, y0, h, r * 0.85, lz, flip=not seed % 2)], cx - t / 2, cx + t / 2, "ember", 3)
    X, Y, Z = ctr(g)
    tt = (Y - y0) / h
    d = np.minimum(np.abs(X - cx - lx * tt), np.abs(Z - cz - lz * tt)) / max(r, 1e-6)
    far = np.maximum(np.abs(X - cx - lx * tt), np.abs(Z - cz - lz * tt)) / max(r, 1e-6)
    P.flat(g, m & (far > 0.62), "ember", 2)
    P.flat(g, m & (far <= 0.62) & (tt < 0.72), "ember", 4)
    P.flat(g, m & (far <= 0.38) & (tt < 0.5), "gold", 6)
    P.flat(g, m & (tt > 0.8), "red", 5)
    del d
    return m


def tuft(g: Grid, cx, cz, y0, h: float, blades: int = 5, spread: float = 4.0, ramp: str = "khaki", shade: int = 5, seed: int = 0) -> np.ndarray:
    """A clump of blades leaning out from (cx, cz): each blade a thin
    triangle prism (a true slope). (kit candidate)"""
    rng = np.random.default_rng(seed)
    m = np.zeros(g.shape, dtype=bool)
    for k in range(blades):
        a = 2 * math.pi * k / blades + rng.uniform(-0.4, 0.4)
        hh = h * rng.uniform(0.65, 1.0)
        tipu = spread * rng.uniform(0.5, 1.0)
        if abs(math.cos(a)) > abs(math.sin(a)):  # the blade leans along x: a prism across z
            s = 1 if math.cos(a) > 0 else -1
            tipu = min(tipu, (g.shape[0] - 0.5 - cx) if s > 0 else (cx - 0.5))
            bx = cx + s * 0.5
            m |= front(g, [(bx - 1.1, y0), (bx + 1.1, y0), (bx + s * tipu, y0 + hh)], cz - 0.6 + math.sin(a), cz + 0.6 + math.sin(a), ramp, shade + (k % 2))
        else:
            s = 1 if math.sin(a) > 0 else -1
            tipu = min(tipu, (g.shape[2] - 0.5 - cz) if s > 0 else (cz - 0.5))
            bz = cz + s * 0.5
            m |= side(g, [(y0, bz - 1.1), (y0, bz + 1.1), (y0 + hh, bz + s * tipu)], cx - 0.6 + math.cos(a), cx + 0.6 + math.cos(a), ramp, shade + (k % 2))
    X, Y, Z = ctr(g)
    P.flat(g, m & (Y > y0 + h * 0.7), ramp, min(7, shade + 1))
    P.flat(g, m & (Y < y0 + 1.5), ramp, max(1, shade - 1))
    return m


# ------------------------------------------------------------------ paint
def skin(g: Grid, mask: np.ndarray, ramp: str = "teal", base: int = 5, seed: int = 0, rot=None, cell: int = 4) -> None:
    """Zombie hide: a flat base with a few big soft patches one shade
    darker (rule S3: no speckle), and optional rot blotches. Scale `cell`
    with the creature (4 for a person, 8 for a boss)."""
    P.flat(g, mask, ramp, base)
    PP.blotch(g, mask, ramp, base - 1, cell=cell, chance=0.05, seed=seed + 1)
    PP.blotch(g, mask, ramp, min(7, base + 1), cell=max(2, cell * 3 // 4), chance=0.03, seed=seed + 3)
    if rot:
        PP.blotch(g, mask, rot[0], rot[1], cell=2, chance=0.02, seed=seed + 2)


def cloth(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, seed: int = 0, seams=True) -> None:
    """Woven cloth: soft patches, a darker hem at the bottom rows."""
    P.mottle(g, mask, ramp, base, cell=2, seed=seed)
    if seams:
        P.outline(g, mask, ramp, max(1, base - 1))


def spots(g: Grid, mask: np.ndarray, pts, r: float, ramp: str, shade: int, ring=None) -> None:
    """Round painted spots (boils, rivets, holes) at 3D points."""
    X, Y, Z = ctr(g)
    for p in pts:
        d = np.sqrt((X - p[0]) ** 2 + (Y - p[1]) ** 2 + (Z - p[2]) ** 2)
        if ring:
            P.flat(g, mask & (d < r + 1.0), *ring)
        P.flat(g, mask & (d < r), ramp, shade)


def gradient(g: Grid, mask: np.ndarray, ramp: str, lo: int, hi: int, y0: float, y1: float) -> None:
    """Shade from `lo` at y0 to `hi` at y1 (soft glow ramps, sky-lit tops)."""
    X, Y, Z = ctr(g)
    t = np.clip((Y - y0) / max(1e-6, y1 - y0), 0, 1)
    P._paint(g, mask, ramp, np.round(lo + (hi - lo) * t).astype(np.int64))


_FLICKER = (
    ((1, 1, 1), (0.9, 1.2, 0.9), (1.08, 0.86, 1.08), (0.95, 1.12, 0.95)),
    ((1, 1, 1), (1.1, 0.8, 1.1), (0.9, 1.25, 0.9), (1.05, 0.9, 1.05)),
    ((1, 1, 1), (0.92, 1.18, 0.92), (1.1, 0.82, 1.1), (0.96, 1.1, 0.96)),
)


def flicker(variant: int = 0, period: float = 0.9, total: float | None = None):
    """Scale keys for a flame that licks up and down, repeated to `total`."""
    pat = _FLICKER[variant % len(_FLICKER)]
    total = period if total is None else total
    reps = max(1, round(total / period))
    out = []
    for r in range(reps):
        for k, v in enumerate(pat):
            out.append((r * period + period * k / len(pat), v))
    out.append((reps * period, pat[0]))
    return keys(*out)


def trefoil_rows(n: int = 11) -> list[str]:
    """Pixel rows of a radiation trefoil ('#' ink, '.' clear), n×n."""
    c = (n - 1) / 2
    rows = []
    for r in range(n):
        row = ""
        for k in range(n):
            x, y = k - c, c - r
            d = math.hypot(x, y)
            a = math.degrees(math.atan2(y, x)) % 360
            blade = any(abs((a - b + 180) % 360 - 180) < 32 for b in (90, 210, 330)) and c * 0.36 < d <= c + 0.4
            row += "#" if blade or d < c * 0.22 + 0.2 else "."
        rows.append(row)
    return rows


def lattice(g: Grid, cx, cz, y0, y1, half0: float, half1: float, levels, leg: float = 1.4, brace: float = 0.8, ramp: str = "steel", shade: int = 4, braces: bool = True, faces=("-z", "+z", "-x", "+x")) -> np.ndarray:
    """A tapered four-legged lattice mast: square legs from the base corners
    (half-width half0 at y0) to the top corners (half1 at y1), level girts
    at every height in `levels` and X braces between them on each face in
    `faces` (true slopes throughout). Returns the mask. (kit candidate)"""

    def half(y):
        return half0 + (half1 - half0) * (y - y0) / (y1 - y0)

    m = np.zeros(g.shape, dtype=bool)
    corners = ((-1, -1), (1, -1), (1, 1), (-1, 1))
    for sx, sz in corners:
        m |= limb(g, (cx + sx * half0, y0, cz + sz * half0), (cx + sx * half1, y1, cz + sz * half1), leg, leg, ramp, shade, n=4)
    lv = sorted(levels)
    for y in lv:
        h = half(y)
        m |= limb(g, (cx - h, y, cz - h), (cx + h, y, cz - h), brace, None, ramp, shade, n=4)
        m |= limb(g, (cx - h, y, cz + h), (cx + h, y, cz + h), brace, None, ramp, shade, n=4)
        m |= limb(g, (cx - h, y, cz - h), (cx - h, y, cz + h), brace, None, ramp, shade, n=4)
        m |= limb(g, (cx + h, y, cz - h), (cx + h, y, cz + h), brace, None, ramp, shade, n=4)
    if braces:
        for ya, yb in zip(lv, lv[1:]):
            ha, hb = half(ya), half(yb)
            for face in faces:
                s = -1 if face[0] == "-" else 1
                if face[1] == "z":
                    a0, a1 = (cx - ha, ya, cz + s * ha), (cx + hb, yb, cz + s * hb)
                    b0, b1 = (cx + ha, ya, cz + s * ha), (cx - hb, yb, cz + s * hb)
                else:
                    a0, a1 = (cx + s * ha, ya, cz - ha), (cx + s * hb, yb, cz + hb)
                    b0, b1 = (cx + s * ha, ya, cz + ha), (cx + s * hb, yb, cz - hb)
                m |= limb(g, a0, a1, brace, None, ramp, shade, n=4)
                m |= limb(g, b0, b1, brace, None, ramp, shade, n=4)
    return m


# ------------------------------------------------------------------ creature motion
def wave(seconds: float, amp=(0.0, 0.0, 0.0), phase: float = 0.0, steps: int = 8, base=(0.0, 0.0, 0.0), double: bool = False):
    """Looping sine keys on up to three channels (rot degrees or loc
    voxels): value = base + amp * sin(2π t/seconds + phase). `double`
    runs twice per loop (a body bob that hits every step)."""
    out = []
    f = 2.0 if double else 1.0
    for i in range(steps + 1):
        t = seconds * i / steps
        s = math.sin(2 * math.pi * f * i / steps + phase)
        out.append((t, tuple(base[k] + amp[k] * s for k in range(3))))
    return keys(*out)


def seq(*frames):
    """keys() with bare tuples: seq((0, x, y, z), (0.2, x, y, z), ...)."""
    return keys(*[(f[0], tuple(f[1:])) for f in frames])


def eyes_rows(big_left: bool = True) -> tuple[list[str], dict]:
    """PN zombie eyes: one big bulging eye with a pupil and one small glowing
    red eye, as stamp rows ('w' white, 'p' pupil, 'r' red glow, 'o' rim)."""
    big = ["ooooo", "owwwo", "owppo", "owppo", "ooooo"]
    small = [".....", ".ooo.", ".oro.", ".ooo.", "....."]
    rows = []
    for a, b in zip(big, small):
        rows.append((a + "..." + b) if big_left else (b + "..." + a))
    return rows, {}


def bump(g: Grid, cx, cz, y0, r: float, h: float, ramp: str, shade: int, n: int = 6) -> np.ndarray:
    """A small faceted lump (boil, tumour, bubble, pebble): an n-gon
    frustum from flat radius r at y0 to half of it h higher, centred on
    the nearest voxel centre so even a tiny lump covers voxels."""
    cx, cz = math.floor(cx) + 0.5, math.floor(cz) + 0.5
    r = max(r, 1.0)
    return plan(g, S.flat_ngon(cx, cz, r, n), y0, y0 + max(h, 1.0), ramp, shade, top=S.flat_ngon(cx, cz, r * 0.5, n))


# ------------------------------------------------------------------ cars (echo the pickup truck)
SEDAN = {"x0": 8, "x1": 48, "nose": 6, "tail": 84, "r": 10.5, "tw": 7, "wheel_z": (22, 68)}


def sedan_profile(nose: float = 6, tail: float = 84, crush: float = 0.0, hood_drop: float = 0.0):
    """Side profile (z, y) of a chunky toy sedan in the pickup truck's
    proportions: a short sloped hood, a tall bubble cabin and a trunk.
    `crush` lowers the roof; `hood_drop` sinks the hood line (an open bay)."""
    roof = 45 - crush
    return [(nose, 9), (nose, 22), (nose + 3, 26.5 - hood_drop), (30, 28.5 - hood_drop), (34, 29.5), (41, roof - 2), (45, roof), (60, roof), (65, roof - 3),
            (70, 29.5), (tail - 3, 28), (tail, 24), (tail, 9)]


def sedan_glass(g: Grid, shell: np.ndarray, x0, x1, crush: float = 0.0, flip_y=None) -> np.ndarray:
    """The window band of a sedan shell (side windows, windscreen and rear
    window), in grid coordinates; `flip_y(y)` maps for an upside-down car."""
    X, Y, Z = ctr(g)
    yy = Y if flip_y is None else flip_y(Y)
    roof = 45 - crush
    side_band = (yy >= 31) & (yy < roof - 2) & (Z >= 40) & (Z < 64) & ((X < x0 + 1) | (X >= x1 - 1))
    screen = (yy >= 31) & (yy < roof - 1) & (Z < 34 + (yy - 29.5) * 11 / max(1.0, roof - 31.5) + 1.5) & (Z >= 32) & (X >= x0 + 3) & (X < x1 - 3)
    rear = (yy >= 31) & (yy < roof - 2) & (Z > 64 + (roof - 3 - yy) * 5 / max(1.0, roof - 32.5) - 1.5) & (Z <= 70) & (X >= x0 + 3) & (X < x1 - 3)
    return shell & (side_band | screen | rear)


def flat_tyre(g: Grid, x0, x1, cz, r: float, sink: float = 2.5, ramp=("gray", 4), hub=("steel", 5)) -> np.ndarray:
    """A flat tyre on axle x: an octagon sunk `sink` below its round
    position with its bottom squashed flat on y = 0 (true slopes)."""
    cy = r - sink
    pts = [(max(0.0, y), z) for y, z in S.flat_ngon(cy, cz, r, 8, S._DOWN["x"])]
    bulge = []
    for y, z in pts:  # the squashed bottom bulges out a little
        bulge.append((y, z + (0.8 if (y < 0.5 and z > cz) else -0.8 if (y < 0.5 and z < cz) else 0.0)))
    g.prism("x", bulge, x0, x1, C(*ramp))
    m = last(g)
    d = S.ngon_radius(g, "x", cy, cz, 8)
    P.flat(g, m & (d < r * 0.6), *hub)
    P.flat(g, m & (d < r * 0.6) & (d > r * 0.6 - 1.1), hub[0], max(1, hub[1] - 2))
    P.flat(g, m & (d < 1.5), hub[0], min(7, hub[1] + 2))
    return m
