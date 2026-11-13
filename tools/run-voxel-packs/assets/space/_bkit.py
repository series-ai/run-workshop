"""Space pack building kit: helpers for the scale-standard buildings.

A person is 36 voxels tall. Doors are 42-56 tall and 18-28 wide, storeys
40-52, windows 12-20, stair steps 4-6 high (contracts/data/scale.json).

Shape helpers work on a window of the grid only, so large grids stay fast.
Facade features (doors, windows, vents, lamps, signs) are small `Feat`
grids authored facing -Z: local x runs along the wall, y is up and z goes
into the wall (z = 0 is the outermost layer). `put_face` places a feature
on any of the four walls; the feature's `cut` mask carves recesses first.
"""
from __future__ import annotations

import math

import numpy as np

from _kit import C, Grid, exposed, full, idx, paint, ramp_mask, shift

# ------------------------------------------------------------ windows --


def _win(g: Grid, lo, hi):
    """Clipped slices and cell-centre coordinates for a bounding box."""
    sh = g.shape
    lo = [max(0, int(math.floor(v))) for v in lo]
    hi = [min(sh[i], int(math.ceil(hi[i]))) for i in range(3)]
    if any(hi[i] <= lo[i] for i in range(3)):
        return None
    sl = tuple(slice(lo[i], hi[i]) for i in range(3))
    x = np.arange(lo[0], hi[0])[:, None, None] + 0.5
    y = np.arange(lo[1], hi[1])[None, :, None] + 0.5
    z = np.arange(lo[2], hi[2])[None, None, :] + 0.5
    return sl, x, y, z


def _fill(g: Grid, sl, mask, c: int) -> Grid:
    sub = g.a[sl]
    sub[np.broadcast_to(mask, sub.shape)] = c
    return g


def cyl(g: Grid, axis: str, c0, c1, r, lo, hi, c: int, r2=None) -> Grid:
    """Windowed Grid.cylinder (same arguments)."""
    rr = max(r, r2 if r2 is not None else r) + 1
    if axis == "y":
        w = _win(g, (c0 - rr, lo, c1 - rr), (c0 + rr, hi, c1 + rr))
    elif axis == "x":
        w = _win(g, (lo, c0 - rr, c1 - rr), (hi, c0 + rr, c1 + rr))
    else:
        w = _win(g, (c0 - rr, c1 - rr, lo), (c0 + rr, c1 + rr, hi))
    if w is None:
        return g
    sl, x, y, z = w
    t, u, v = {"y": (y, x, z), "x": (x, y, z), "z": (z, x, y)}[axis]
    r2 = r if r2 is None else r2
    span = max(hi - lo, 1e-6)
    rad = r + (r2 - r) * np.clip((t - lo) / span, 0, 1)
    m = ((u - c0) ** 2 + (v - c1) ** 2 <= rad**2) & (t >= lo) & (t < hi)
    return _fill(g, sl, m, c)


def ell(g: Grid, cx, cy, cz, rx, ry, rz, c: int, ymin=None) -> Grid:
    """Windowed ellipsoid; `ymin` keeps only cells at or above that y."""
    w = _win(g, (cx - rx - 1, cy - ry - 1, cz - rz - 1), (cx + rx + 1, cy + ry + 1, cz + rz + 1))
    if w is None:
        return g
    sl, x, y, z = w
    m = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1.0
    if ymin is not None:
        m = m & (y >= ymin)
    return _fill(g, sl, m, c)


def seg(g: Grid, p0, p1, r: float, c: int) -> Grid:
    """Windowed capsule from p0 to p1 (voxel coordinates)."""
    lo = [min(p0[i], p1[i]) - r - 1 for i in range(3)]
    hi = [max(p0[i], p1[i]) + r + 1 for i in range(3)]
    w = _win(g, lo, hi)
    if w is None:
        return g
    sl, x, y, z = w
    a, b = np.array(p0, float), np.array(p1, float)
    d = b - a
    L2 = float(d @ d) or 1e-9
    t = np.clip(((x - a[0]) * d[0] + (y - a[1]) * d[1] + (z - a[2]) * d[2]) / L2, 0, 1)
    dist2 = (x - (a[0] + t * d[0])) ** 2 + (y - (a[1] + t * d[1])) ** 2 + (z - (a[2] + t * d[2])) ** 2
    return _fill(g, sl, dist2 <= r * r, c)


def beam(g: Grid, p0, p1, c: int, t: int = 2) -> Grid:
    """Square-section strut (t x t) stepped along the longest axis: crisp
    voxel lattice members that mesh cheaply."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    n = int(max(abs(p1 - p0).max(), 1))
    for s in range(n + 1):
        q = p0 + (p1 - p0) * s / n
        x, y, z = (int(math.floor(v)) for v in q)
        g.box(x, y, z, x + t, y + t, z + t, c)
    return g


def revolve(g: Grid, cx, cz, y0: int, y1: int, rfun, c: int, rin=None) -> Grid:
    """Solid of revolution about a vertical axis: radius rfun(y) per layer;
    `rin(y)` hollows the inside where it returns > 0."""
    rmax = max(rfun(yy) for yy in range(y0, y1)) + 1
    w = _win(g, (cx - rmax, y0, cz - rmax), (cx + rmax, y1, cz + rmax))
    if w is None:
        return g
    sl, x, y, z = w
    ys = np.arange(sl[1].start, sl[1].stop)
    R = np.array([rfun(int(v)) for v in ys], float)[None, :, None]
    d2 = (x - cx) ** 2 + (z - cz) ** 2
    m = d2 <= R * R
    if rin is not None:
        Ri = np.array([rin(int(v)) for v in ys], float)[None, :, None]
        m &= ~((Ri > 0) & (d2 < Ri * Ri))
    return _fill(g, sl, m, c)


def angle_y(g: Grid, cx, cz):
    """Angle (radians, 0..2pi) of every cell around a vertical axis."""
    x, _y, z = idx(g)
    return np.arctan2(z + 0.5 - cz, x + 0.5 - cx) + np.pi


def radius_y(g: Grid, cx, cz):
    x, _y, z = idx(g)
    return np.hypot(x + 0.5 - cx, z + 0.5 - cz)


def put(g: Grid, a: np.ndarray, ox: int, oy: int, oz: int) -> Grid:
    """Vectorised paste of the filled cells of array `a` at (ox, oy, oz)."""
    sh = g.shape
    o = (ox, oy, oz)
    lo = [max(0, -o[i]) for i in range(3)]
    hi = [min(a.shape[i], sh[i] - o[i]) for i in range(3)]
    if any(hi[i] <= lo[i] for i in range(3)):
        return g
    src = a[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]]
    dst = g.a[o[0] + lo[0]:o[0] + hi[0], o[1] + lo[1]:o[1] + hi[1], o[2] + lo[2]:o[2] + hi[2]]
    m = src != 0
    dst[m] = src[m]
    return g


def put_grid(g: Grid, sub: Grid, ox: int, oy: int, oz: int) -> Grid:
    return put(g, sub.a, ox, oy, oz)


# ------------------------------------------------------ facade features --


class Feat:
    """A facade feature authored facing -Z. `p` = layers that stand out of
    the wall (local z = p is the wall's outer layer)."""

    def __init__(self, w: int, h: int, d: int, p: int):
        self.g = Grid(w, h, d)
        self.cut = np.zeros((w, h, d), bool)
        self.p = p

    @property
    def shape(self):
        return self.g.shape


def _orient(a: np.ndarray, face: str) -> np.ndarray:
    # Mirror so that local +x reads left to right for a viewer facing the wall.
    if face == "-z":
        return a[::-1]
    if face == "+z":
        return a[:, :, ::-1]
    if face == "-x":
        return np.transpose(a, (2, 1, 0))
    if face == "+x":
        return np.transpose(a[::-1], (2, 1, 0))[::-1]
    raise ValueError(f"face must be -z, +z, -x or +x, got {face!r}")


def put_face(g: Grid, f: Feat, face: str, u: int, y: int, s: int) -> Grid:
    """Place feature `f` on wall `face`. `u` = low end of the feature along
    the wall (world x for z faces, world z for x faces), `y` = its bottom,
    `s` = index of the wall's outermost filled layer."""
    fw, fh, fd = f.shape
    a, cut = _orient(f.g.a, face), _orient(f.cut, face)
    if face == "-z":
        o = (u, y, s - f.p)
    elif face == "+z":
        o = (u, y, s + f.p - (fd - 1))
    elif face == "-x":
        o = (s - f.p, y, u)
    else:
        o = (s + f.p - (fd - 1), y, u)
    sh = g.shape
    lo = [max(0, -o[i]) for i in range(3)]
    hi = [min(a.shape[i], sh[i] - o[i]) for i in range(3)]
    if any(hi[i] <= lo[i] for i in range(3)):
        return g
    ssl = (slice(lo[0], hi[0]), slice(lo[1], hi[1]), slice(lo[2], hi[2]))
    dsl = tuple(slice(o[i] + lo[i], o[i] + hi[i]) for i in range(3))
    dst = g.a[dsl]
    dst[cut[ssl]] = 0
    src = a[ssl]
    m = src != 0
    dst[m] = src[m]
    return g


def door(w: int = 22, h: int = 48, frame: int = 3, body: str = "steel", trim: str = "gold",
         leaf: str = "sky", glow: str = "toxic", hood: bool = True, window: bool = True) -> Feat:
    """Sliding blast door: raised frame, 2-deep recess, split leaves with
    panel lines and view slits, hazard kick plate, keypad, status light and
    an optional hood. Opening w x h (person clearance)."""
    fw, fh = w + 2 * frame, h + frame + (4 if hood else 2)
    f = Feat(fw, fh, 7, 3)
    g, p = f.g, f.p
    # frame, 1 proud of the wall
    g.box(0, 0, p - 1, fw, h + frame, p + 1, C(body, 3))
    g.box(1, 0, p - 1, fw - 1, h + frame - 1, p - 1 + 1, C(body, 4))
    # recess and leaves
    f.cut[frame:frame + w, 0:h, p - 1:p + 2] = True
    g.box(frame, 0, p - 1, frame + w, h, p + 2, 0)
    g.box(frame, 0, p + 2, frame + w, h, p + 3, C(leaf, 4))
    half = frame + w // 2
    g.box(half - 1, 0, p + 2, half + 1, h, p + 3, C(leaf, 2))  # centre seam
    for yy in range(8, h, 10):
        g.box(frame, yy, p + 2, frame + w, yy + 1, p + 3, C(leaf, 3))
    g.box(frame, h - 2, p + 2, frame + w, h, p + 3, C(leaf, 2))
    if window:
        for x0 in (frame + 3, half + 3):
            x1 = min(x0 + max(2, w // 2 - 7), half - 3 if x0 < half else frame + w - 3)
            g.box(x0, h - 16, p + 2, x1, h - 8, p + 3, C("plasma", 5))
            g.box(x0, h - 10, p + 2, x1, h - 8, p + 3, C("plasma", 7))
    # hazard kick plate
    for xx in range(frame, frame + w):
        for yy in range(0, 5):
            g.set(xx, yy, p + 2, C(trim, 5) if ((xx + yy) // 2) % 2 == 0 else C("iron", 1))
    # status light and lintel plate
    g.box(half - 3, h + 1, p - 2, half + 3, h + frame - 1, p - 1, C(body, 2))
    g.box(half - 2, h + 1, p - 3, half + 2, h + frame - 1, p - 2, C(glow, 6))
    g.set(half - 1, h + 1, p - 3, C(glow, 7))
    # keypad on the right jamb
    g.box(fw - frame, h // 2 - 4, p - 2, fw - 1, h // 2 + 3, p - 1, C("iron", 2))
    for yy in range(h // 2 - 3, h // 2 + 2, 2):
        g.set(fw - frame + 1, yy, p - 2, C("plasma", 6))
    g.set(fw - frame + 1, h // 2 + 2, p - 2, C("red", 6))
    if hood:
        y0 = h + frame
        g.box(0, y0, 0, fw, y0 + 2, p + 1, C(body, 5))
        g.box(0, y0, 0, fw, y0 + 1, 1, C(trim, 4))
        g.box(0, y0 + 2, 1, fw, y0 + 3, p + 1, C(body, 6))
        for xx in (2, fw - 3):
            g.box(xx, y0 - 3, 0, xx + 1, y0, p - 1, C("iron", 3))  # brackets
    return f


def window(w: int = 14, h: int = 14, glass: str = "plasma", frame: str = "steel", mull: int = 1,
           sill: bool = True, hood: bool = False, fs: int = 5) -> Feat:
    """Framed window, glass 1 deep in the wall, mullions, sill and glints."""
    fw, fh = w + 2, h + 2 + (2 if hood else 0)
    f = Feat(fw, fh, 5, 2)
    g, p = f.g, f.p
    g.box(0, 0, p - 1, fw, h + 2, p + 1, C(frame, fs))
    f.cut[1:w + 1, 1:h + 1, p - 1:p + 1] = True
    g.box(1, 1, p - 1, w + 1, h + 1, p + 1, 0)
    g.box(1, 1, p + 1, w + 1, h + 1, p + 2, C(glass, 5))
    g.box(1, h - 2, p + 1, w + 1, h + 1, p + 2, C(glass, 4))
    for k in range(1, mull + 1):
        xx = 1 + k * w // (mull + 1)
        g.box(xx, 1, p, xx + 1, h + 1, p + 1, C(frame, fs - 1))
    for k in range(3):  # glint
        g.set(2 + k, 2 + h // 3 + k, p + 1, C(glass, 7))
    if sill:
        g.box(0, 0, p - 2, fw, 1, p, C(frame, fs + 1 if fs < 7 else 7))
    if hood:
        g.box(0, h + 2, p - 2, fw, h + 4, p + 1, C(frame, max(0, fs - 2)))
    return f


def vent(w: int = 12, h: int = 10, body: str = "steel") -> Feat:
    """Louvred vent grille recessed into the wall."""
    f = Feat(w, h, 4, 1)
    g, p = f.g, f.p
    g.box(0, 0, p - 1, w, h, p + 1, C(body, 3))
    f.cut[1:w - 1, 1:h - 1, p - 1:p + 1] = True
    g.box(1, 1, p - 1, w - 1, h - 1, p + 1, 0)
    g.box(1, 1, p + 1, w - 1, h - 1, p + 2, C("iron", 1))
    for yy in range(1, h - 1, 2):
        g.box(1, yy, p, w - 1, yy + 1, p + 1, C(body, 5))
    return f


def lamp(glow: str = "plasma", body: str = "steel") -> Feat:
    """Wall lamp: bracket and a glowing lens facing down and out."""
    f = Feat(5, 5, 5, 4)
    g = f.g
    g.box(1, 2, 3, 4, 4, 5, C(body, 3))
    g.box(0, 2, 0, 5, 4, 3, C(body, 4))
    g.box(1, 1, 0, 4, 2, 3, C(glow, 7))
    g.box(0, 4, 0, 5, 5, 3, C(body, 5))
    return f


# tiny 3x5 font for signs and hull numbers (rows top to bottom)
FONT = {
    "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"], "3": ["###", "..#", ".##", "..#", "###"],
    "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "###", "..#", "###"],
    "6": ["###", "#..", "###", "#.#", "###"], "7": ["###", "..#", ".#.", ".#.", ".#."],
    "8": ["###", "#.#", "###", "#.#", "###"], "9": ["###", "#.#", "###", "..#", "###"],
    "A": [".#.", "#.#", "###", "#.#", "#.#"], "B": ["##.", "#.#", "##.", "#.#", "##."],
    "C": ["###", "#..", "#..", "#..", "###"], "D": ["##.", "#.#", "#.#", "#.#", "##."],
    "E": ["###", "#..", "##.", "#..", "###"], "H": ["#.#", "#.#", "###", "#.#", "#.#"],
    "I": ["###", ".#.", ".#.", ".#.", "###"], "L": ["#..", "#..", "#..", "#..", "###"],
    "N": ["#.#", "###", "###", "###", "#.#"], "O": ["###", "#.#", "#.#", "#.#", "###"],
    "P": ["###", "#.#", "###", "#..", "#.."], "R": ["##.", "#.#", "##.", "#.#", "#.#"],
    "S": ["###", "#..", "###", "..#", "###"], "T": ["###", ".#.", ".#.", ".#.", ".#."],
    "U": ["#.#", "#.#", "#.#", "#.#", "###"], "X": ["#.#", "#.#", ".#.", "#.#", "#.#"],
    "F": ["###", "#..", "##.", "#..", "#.."], "G": ["###", "#..", "#.#", "#.#", "###"],
    "K": ["#.#", "#.#", "##.", "#.#", "#.#"], "M": ["#.#", "###", "###", "#.#", "#.#"],
    "W": ["#.#", "#.#", "###", "###", "#.#"], "Q": ["###", "#.#", "#.#", "###", "..#"],
    "V": ["#.#", "#.#", "#.#", "#.#", ".#."], "Y": ["#.#", "#.#", ".#.", ".#.", ".#."],
    "-": ["...", "...", "###", "...", "..."], " ": ["...", "...", "...", "...", "..."],
}


def sign(text: str, plate: str = "navy", ink: str = "gold", pad: int = 2, ps: int = 2, ks: int = 6) -> Feat:
    """Raised name plate with 3x5 letters."""
    tw = len(text) * 4 - 1
    fw, fh = tw + 2 * pad, 5 + 2 * pad
    f = Feat(fw, fh, 3, 2)
    g = f.g
    g.box(0, 0, 1, fw, fh, 2, C(plate, ps))
    g.box(0, 0, 1, fw, 1, 2, C(plate, ps + 1))
    for k, ch in enumerate(text):
        rows = FONT[ch]
        for r, row in enumerate(rows):
            for cx, v in enumerate(row):
                if v == "#":
                    g.set(pad + k * 4 + cx, pad + 4 - r, 0, C(ink, ks))
    return f


def hazard(g: Grid, mask, a: int | None = None, b: int | None = None, period: int = 4, d=(1, 1, 0)) -> Grid:
    """Diagonal hazard stripes over filled cells under `mask`."""
    a = C("gold", 5) if a is None else a
    b = C("iron", 1) if b is None else b
    x, y, z = idx(g)
    t = full(g, ((x * d[0] + y * d[1] + z * d[2]) // max(1, period // 2)) % 2)
    m = full(g, mask) & (g.a != 0)
    g.a[m & (t == 0)] = a
    g.a[m & (t == 1)] = b
    return g


# -------------------------------------------------------------- props --


def barrel(h: int = 18, r: float = 5.5, body: str = "orange", band: str = "iron", cap: str = "steel") -> Grid:
    """Fuel drum: rolled hoops, a lid with a bung and a hazard label."""
    d = int(math.ceil(2 * r)) + 1
    g = Grid(d, h, d)
    c = d / 2
    cyl(g, "y", c, c, r, 0, h, C(body, 4))
    for yy in (2, h // 2, h - 3):
        cyl(g, "y", c, c, r + 0.01, yy, yy + 1, C(band, 3))
    cyl(g, "y", c, c, r - 1, h - 1, h, C(cap, 5))
    g.set(int(c) + 1, h - 1, int(c) + 1, C(cap, 2))
    g.box(int(c) - 2, h // 2 + 2, 0, int(c) + 2, h // 2 + 6, 2, C("gold", 6))
    g.set(int(c), h // 2 + 3, 0, C("iron", 1)).set(int(c), h // 2 + 4, 0, C("iron", 1))
    return g


def cargo(w: int = 16, h: int = 16, d: int = 16, body: str = "khaki", trim: str = "orange", glow: str = "plasma") -> Grid:
    """Cargo crate one tile big: ribbed sides, corner guards, stencil and a
    latch light. Structured (no noise) so it meshes cheaply."""
    g = Grid(w, h, d)
    g.box(0, 0, 0, w, h, d, C(body, 4))
    g.box(1, 1, 0, w - 1, h - 1, d, C(body, 3))
    g.box(0, 1, 1, w, h - 1, d - 1, C(body, 3))
    g.box(1, 1, 1, w - 1, h - 1, d - 1, C(body, 4))
    for x0 in (0, w - 2):
        for z0 in (0, d - 2):
            g.box(x0, 0, z0, x0 + 2, h, z0 + 2, C(trim, 4))
    g.box(0, h - 1, 0, w, h, d, C(body, 5))
    g.box(2, h - 1, 2, w - 2, h, d - 2, C(body, 6))
    for yy in (h // 3, 2 * h // 3):
        g.box(2, yy, 0, w - 2, yy + 1, d, C(body, 2))
    g.box(w // 2 - 1, h // 2 - 1, 0, w // 2 + 1, h // 2 + 1, 1, C(glow, 6))
    g.box(3, h - 4, 0, 6, h - 3, 1, C("iron", 1))
    return g


def tank(r: float, h: int, body: str = "steel", band: str = "orange") -> Grid:
    """Upright gas tank with domed cap, bands and a gauge."""
    d = int(math.ceil(2 * r)) + 2
    g = Grid(d, h + int(r * 0.6) + 2, d)
    c = d / 2
    cyl(g, "y", c, c, r, 2, h, C(body, 5))
    ell(g, c, h, c, r, r * 0.6, r, C(body, 6), ymin=h)
    for yy in range(4, h, 8):
        cyl(g, "y", c, c, r + 0.4, yy, yy + 2, C(band, 4))
    cyl(g, "y", c, c, r * 0.7, 0, 2, C("iron", 2))  # skirt
    g.box(int(c) - 1, h // 2, 0, int(c) + 2, h // 2 + 3, 2, C("bone", 7))
    g.set(int(c), h // 2 + 1, 0, C("red", 5))
    return g


def railing(g: Grid, axis: str, a0: int, a1: int, y: int, other: int, c=None, post=None, h: int = 14, every: int = 6) -> Grid:
    """Handrail along x or z from a0 to a1 at height y (top rail h above)."""
    c = C("steel", 6) if c is None else c
    post = C("steel", 4) if post is None else post
    if axis == "x":
        g.box(a0, y + h - 1, other, a1, y + h, other + 1, c)
        g.box(a0, y + h // 2, other, a1, y + h // 2 + 1, other + 1, post)
        for t in list(range(a0, a1, every)) + [a1 - 1]:
            g.box(t, y, other, t + 1, y + h, other + 1, post)
    else:
        g.box(other, y + h - 1, a0, other + 1, y + h, a1, c)
        g.box(other, y + h // 2, a0, other + 1, y + h // 2 + 1, a1, post)
        for t in list(range(a0, a1, every)) + [a1 - 1]:
            g.box(other, y, t, other + 1, y + h, t + 1, post)
    return g


def steps_z(g: Grid, x0: int, x1: int, z_face: int, y_top: int, rise: int = 5, run: int = 6, c=None, nose=None) -> Grid:
    """Stair down from a floor at y_top in front (-Z) of z_face; steps
    `rise` high and `run` deep, nosing one shade lighter."""
    c = C("steel", 3) if c is None else c
    nose = C("gold", 5) if nose is None else nose
    n = int(math.ceil(y_top / rise))
    for k in range(n):
        top = y_top - k * rise
        z1 = z_face - k * run
        g.box(x0, 0, z1 - run, x1, top, z1, c)
        g.box(x0, top - 1, z1 - run, x1, top, z1 - run + 1, nose)
    return g


def pipe(g: Grid, pts, r: float, c: int, flange=None, every: int = 10) -> Grid:
    """Pipe run through axis-aligned points with flange rings."""
    flange = C("iron", 3) if flange is None else flange
    for a, b in zip(pts, pts[1:]):
        seg(g, a, b, r, c)
        n = int(max(abs(b[i] - a[i]) for i in range(3)) // every)
        for k in range(1, n + 1):
            q = [a[i] + (b[i] - a[i]) * k / (n + 1) for i in range(3)]
            ax = int(np.argmax([abs(b[i] - a[i]) for i in range(3)]))
            lo = [q[i] - r - 0.6 for i in range(3)]
            hi = [q[i] + r + 0.6 for i in range(3)]
            lo[ax], hi[ax] = q[ax] - 0.5, q[ax] + 0.5
            w = _win(g, lo, hi)
            if w is None:
                continue
            sl, x, y, z = w
            cc = [x, y, z]
            o = [i for i in range(3) if i != ax]
            m = (cc[o[0]] - q[o[0]]) ** 2 + (cc[o[1]] - q[o[1]]) ** 2 <= (r + 0.6) ** 2
            _fill(g, sl, m, flange)
    return g


def ground_pad(g: Grid, x0, z0, x1, z1, h: int = 3, ramp: str = "stone", tile: int = 16, shade: int = 4) -> Grid:
    """Concrete pad with tile joints every `tile` voxels and a darker skirt."""
    g.box(x0, 0, z0, x1, h, z1, C(ramp, shade))
    g.box(x0, 0, z0, x1, h - 1, z1, C(ramp, shade - 1))
    x, y, z = idx(g)
    m = (y == h - 1) & (x >= x0) & (x < x1) & (z >= z0) & (z < z1) & ((((x - x0) % tile) == 0) | (((z - z0) % tile) == 0))
    paint(g, m, C(ramp, shade - 1))
    return g


def tops(g: Grid, ramps, up: int = 1) -> Grid:
    """Lighten upward-facing faces of the given ramps (sun from above)."""
    m = exposed(g, 1, 1) & ramp_mask(g, *ramps)
    return shift(g, m, up)


def dome_radii(R: float, RY: int, course: int = 4, split: float = 0.7, fine: int = 2) -> list[float]:
    """Per-layer radius of a coursed dome (RY layers): tall courses on the
    steep lower part and short ones near the top. Coursed domes read as
    panel rings and mesh with far fewer faces than a smooth ellipsoid."""
    out: list[float] = []
    y = 0
    while y < RY:
        h = course if y < RY * split else fine
        ym = min(RY - 0.5, y + h * 0.5)
        r = R * math.sqrt(max(0.0, 1 - (ym / RY) ** 2))
        out.extend([r] * min(h, RY - y))
        y += h
    return out


def dome_tiers(g: Grid, cx, y0: int, cz, radii: list[float], c: int, grow: float = 0.0) -> Grid:
    """Fill a coursed dome from `dome_radii` standing on y0 (optionally
    grown by `grow` voxels, for raised ribs and trims)."""
    rs = [r + grow if r > 0.8 else 0.0 for r in radii]
    return revolve(g, cx, cz, y0, y0 + len(rs), lambda yy: rs[yy - y0], c)
