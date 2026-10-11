"""Space pack kit: shared helpers for the RUN voxel space assets (this pack only).

Vectorised shade tools (surface-only speckle, hull panels with rivets, lit
tops), sci-fi shape helpers (chamfered boxes, domes, rings, nozzles, wheels)
and small builders reused across categories. World assets face -Z.
"""
from __future__ import annotations

import math

import numpy as np

from voxgrid import PALETTE, RAMP_SHADES, Asset, C, Clip, Grid, Part, Socket, base_pivot, bob, turn  # noqa: F401

PACK = "space"
RID = PALETTE["ramps"]


def aid(category: str, slug: str) -> str:
    return f"{PACK}-{category}-{slug}"


def asset(category: str, slug: str, name: str, root: Part, **kw) -> Asset:
    return Asset(id=aid(category, slug), pack=PACK, category=category, name=name, root=root, **kw)


# ---------------------------------------------------------------- indexing --
def idx(g: Grid):
    sx, sy, sz = g.shape
    return np.arange(sx)[:, None, None], np.arange(sy)[None, :, None], np.arange(sz)[None, None, :]


def full(g: Grid, m) -> np.ndarray:
    return np.broadcast_to(m, g.shape)


def ramp_mask(g: Grid, *ramps: str) -> np.ndarray:
    ids = [RID[r] for r in ramps]
    return np.isin(g.a // RAMP_SHADES, ids) & (g.a != 0)


def exposed(g: Grid, axis: int, sign: int) -> np.ndarray:
    f = g.a != 0
    pad = np.pad(f, 1, constant_values=False)
    sl = [slice(1, -1)] * 3
    n = f.shape[axis]
    sl[axis] = slice(1 + sign, n + 1 + sign)
    return f & ~pad[tuple(sl)]


def surface(g: Grid) -> np.ndarray:
    out = np.zeros(g.shape, bool)
    for axis in range(3):
        for sign in (1, -1):
            out |= exposed(g, axis, sign)
    return out


def shift(g: Grid, mask, delta) -> Grid:
    """Shift shades inside their ramp where `mask`; delta may be an array."""
    a = g.a.astype(np.int16)
    m = full(g, mask) & (a != 0)
    ramp, sh = a // RAMP_SHADES, a % RAMP_SHADES
    out = ramp * RAMP_SHADES + np.clip(sh + delta, 0, RAMP_SHADES - 1)
    out[out == 0] = 1
    a[m] = np.broadcast_to(out, a.shape)[m]
    g.a = a.astype(np.uint8)
    return g


def paint(g: Grid, mask, c: int) -> Grid:
    """Recolour filled voxels under `mask` (never adds voxels)."""
    m = full(g, mask) & (g.a != 0)
    g.a[m] = c
    return g


def fill(g: Grid, mask, c: int) -> Grid:
    g.a[full(g, mask)] = c
    return g


# ------------------------------------------------------------- shade tools --
def speck(g: Grid, seed: int, amount: float = 0.15, ramps: tuple[str, ...] | None = None, spread: int = 1) -> Grid:
    """Surface-only per-voxel shade jitter (keeps big faces mergeable inside)."""
    rng = np.random.default_rng(seed)
    m = surface(g)
    if ramps:
        m &= ramp_mask(g, *ramps)
    r = rng.random(g.shape)
    d = np.where(r < amount / 2, -spread, np.where(r < amount, spread, 0))
    return shift(g, m, d)


def light(g: Grid, top: int = 1, bottom: int = -1, ramps: tuple[str, ...] | None = None) -> Grid:
    """Lit tops, darker undersides (voxel-art read at thumbnail size)."""
    up = exposed(g, 1, 1)
    down = exposed(g, 1, -1) & ~up
    if ramps:
        rm = ramp_mask(g, *ramps)
        up, down = up & rm, down & rm
    shift(g, up, top)
    return shift(g, down, bottom)


def panels(g: Grid, ramp: str, size=(6, 6, 6), off=(0, 0, 0), seam: int = -1, rivet: int | None = 1, jitter: bool = True, seed: int = 0) -> Grid:
    """Hull plating on every exposed voxel of `ramp`: seam lines every `size`
    voxels (in the plane of each face), rivets where seams cross, and a small
    per-panel shade jitter."""
    m = ramp_mask(g, ramp)
    x, y, z = idx(g)
    sx, sy, sz = size
    ox, oy, oz = off
    xm, ym, zm = (x - ox) % sx == 0, (y - oy) % sy == 0, (z - oz) % sz == 0
    ex = exposed(g, 0, 1) | exposed(g, 0, -1)
    ey = exposed(g, 1, 1) | exposed(g, 1, -1)
    ez = exposed(g, 2, 1) | exposed(g, 2, -1)
    seams = (ex & (ym | zm)) | (ey & (xm | zm)) | (ez & (xm | ym))
    cross = (ex & ym & zm) | (ey & xm & zm) | (ez & xm & ym)
    surf = ex | ey | ez
    if jitter:
        px, py, pz = (x - ox) // sx, (y - oy) // sy, (z - oz) // sz
        h = (px * 73856093) ^ (py * 19349663) ^ (pz * 83492791) ^ (seed * 2654435761)
        j = np.array([-1, 0, 0, 0, 1, 0, 0])[np.asarray(h % 7)]
        shift(g, m & surf & ~seams, j)
    shift(g, m & seams, seam)
    if rivet is not None:
        shift(g, m & cross, rivet - seam)
    return g


def stripes(g: Grid, mask, a: int, b: int, period: int = 4, d=(1, 1, 0)) -> Grid:
    """Diagonal hazard stripes over filled voxels under `mask`."""
    x, y, z = idx(g)
    t = ((x * d[0] + y * d[1] + z * d[2]) // max(1, period // 2)) % 2
    m = full(g, mask) & (g.a != 0)
    t = full(g, t)
    g.a[m & (t == 0)] = a
    g.a[m & (t == 1)] = b
    return g


def bands(g: Grid, mask, axis: int, every: int, c: int, width: int = 1, off: int = 0) -> Grid:
    ax = idx(g)[axis]
    return paint(g, full(g, mask) & ((ax - off) % every < width), c)


# ---------------------------------------------------------------- shapes --
def cbox(g: Grid, x0, y0, z0, x1, y1, z1, c: int, r: int = 1, edges: str = "xyz") -> Grid:
    """Box with chamfered edges of size r. `edges` picks which edge families
    to cut: 'y' = vertical edges, 'x' = edges along x, 'z' = edges along z."""
    x, y, z = idx(g)
    inside = (x >= x0) & (x < x1) & (y >= y0) & (y < y1) & (z >= z0) & (z < z1)
    dx = np.maximum(0, r - np.minimum(x - x0, x1 - 1 - x))
    dy = np.maximum(0, r - np.minimum(y - y0, y1 - 1 - y))
    dz = np.maximum(0, r - np.minimum(z - z0, z1 - 1 - z))
    cut = np.zeros(g.shape, bool)
    if "y" in edges:
        cut |= full(g, dx + dz > r)
    if "x" in edges:
        cut |= full(g, dy + dz > r)
    if "z" in edges:
        cut |= full(g, dx + dy > r)
    return fill(g, inside & ~cut, c)


def dome(g: Grid, cx, y0, cz, r, c: int, ry=None) -> Grid:
    """Upper half ellipsoid standing on y0."""
    ry = r if ry is None else ry
    x, y, z = idx(g)
    xc, yc, zc = x + 0.5, y + 0.5, z + 0.5
    m = (((xc - cx) / r) ** 2 + ((yc - y0) / ry) ** 2 + ((zc - cz) / r) ** 2 <= 1.0) & (yc >= y0)
    return fill(g, m, c)


def ring(g: Grid, axis: str, c0, c1, r_out, r_in, lo, hi, c: int) -> Grid:
    tmp = Grid(*g.shape)
    tmp.cylinder(axis, c0, c1, r_out, lo, hi, 1)
    tmp.cylinder(axis, c0, c1, r_in, lo, hi, 0)
    return fill(g, tmp.a != 0, c)


def cone(g: Grid, axis: str, c0, c1, r0, r1, lo, hi, c: int) -> Grid:
    return g.cylinder(axis, c0, c1, r0, lo, hi, c, r2=r1)


def disc_y(g: Grid, cx, cz, r, y0, y1, c: int) -> Grid:
    return g.cylinder("y", cx, cz, r, y0, y1, c)


def glow_dot(g: Grid, x, y, z, ramp: str = "plasma", hi: int = 7) -> Grid:
    return g.set(x, y, z, C(ramp, hi))


def screen(g: Grid, x0, y0, x1, y1, z, ramp: str = "plasma", face: int = -1, frame: int | None = None) -> Grid:
    """A glowing screen on a -Z (or +Z) face with scan lines and a frame."""
    for yy in range(y0, y1):
        for xx in range(x0, x1):
            shade = 6 if (yy - y0) % 2 == 0 else 4
            if (xx + yy) % 5 == 0:
                shade = 7
            g.set(xx, yy, z, C(ramp, shade))
    if frame is not None:
        for xx in range(x0 - 1, x1 + 1):
            g.set(xx, y0 - 1, z, frame).set(xx, y1, z, frame)
        for yy in range(y0 - 1, y1 + 1):
            g.set(x0 - 1, yy, z, frame).set(x1, yy, z, frame)
    return g


def porthole(g: Grid, axis: str, c0, c1, at, r: float, glass=None, rim=None, depth: int = 1) -> Grid:
    """Round window on a face normal to `axis` (x|z) at plane `at`."""
    glass = glass if glass is not None else C("plasma", 5)
    rim = rim if rim is not None else C("steel", 6)
    ring(g, axis, c0, c1, r + 1, r, at, at + depth, rim)
    g.cylinder(axis, c0, c1, r, at, at + depth, glass)
    # glint
    if axis == "z":
        g.set(int(c0 - r / 2), int(c1 + r / 2), at, C("plasma", 7))
    elif axis == "x":
        g.set(at, int(c0 + r / 2), int(c1 - r / 2), C("plasma", 7))
    return g


def rot_y(g: Grid, k: int = 1) -> Grid:
    """Rotate a grid by k quarter turns about +Y."""
    return g.rot_y(k)


def flip_x(g: Grid) -> Grid:
    return g.flip("x")


def flip_z(g: Grid) -> Grid:
    return g.flip("z")


def mirror_x(g: Grid) -> Grid:
    """Mirror the low-x half onto the high-x half (odd widths keep the centre)."""
    sx = g.shape[0]
    half = sx // 2
    g.a[sx - half:, :, :] = g.a[:half, :, :][::-1, :, :]
    return g


def crop(g: Grid) -> tuple[Grid, tuple[int, int, int]]:
    """Crop to filled bounds; returns (grid, offset of the crop origin)."""
    nz = np.nonzero(g.a)
    lo = [int(i.min()) for i in nz]
    hi = [int(i.max()) + 1 for i in nz]
    return g.crop(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]), tuple(lo)  # type: ignore[return-value]


# ------------------------------------------------------------ components --
def wheel(r: float, w: int, tire=None, hub=None, axis: str = "x", spokes: int = 6) -> Grid:
    """A wheel spinning about `axis` (x), centred in its grid, with tread and hub."""
    tire = tire if tire is not None else C("iron", 2)
    hub = hub if hub is not None else C("steel", 5)
    d = int(math.ceil(2 * r)) + 1
    g = Grid(w, d, d)
    c = d / 2
    g.cylinder("x", c, c, r, 0, w, tire)
    g.cylinder("x", c, c, r - 1.6, 0, w, hub)
    g.cylinder("x", c, c, r - 3.0, 0, w, C("steel", 3))
    g.cylinder("x", c, c, 1.6, 0, w, C("plasma", 5))
    x, y, z = idx(g)
    ang = np.arctan2(y + 0.5 - c, z + 0.5 - c)
    rad = np.hypot(y + 0.5 - c, z + 0.5 - c)
    tread = (rad > r - 1.2) & ((np.floor((ang + math.pi) / (2 * math.pi) * 16).astype(int) % 2) == 0)
    paint(g, tread, C("iron", 1))
    spoke = (rad > 1.6) & (rad < r - 3.0) & ((np.floor((ang + math.pi) / (2 * math.pi) * spokes * 2).astype(int) % 2) == 0)
    paint(g, spoke & ((x == 0) | (x == w - 1)), C("steel", 6))
    return g


def nozzle(length: int, r: float, shell=None, glow: str = "plasma") -> Grid:
    """Engine nozzle along +Z (exhaust at the high-z end) with a glowing core."""
    shell = shell if shell is not None else C("steel", 3)
    d = int(math.ceil(2 * r)) + 2
    g = Grid(d, d, length)
    c = d / 2
    g.cylinder("z", c, c, r * 0.75, 0, length, shell, r2=r)
    g.cylinder("z", c, c, r * 0.75 - 1, length - 2, length, C(glow, 6))
    g.cylinder("z", c, c, max(0.8, r * 0.75 - 2.2), length - 2, length, C(glow, 7))
    ring(g, "z", c, c, r + 0.01, r - 1, length - 1, length, C("steel", 5))
    return g


def antenna(h: int, tip: str = "red") -> Grid:
    g = Grid(3, h + 2, 3)
    g.box(1, 0, 1, 2, h, 2, C("steel", 5))
    g.box(0, 0, 0, 3, 2, 3, C("steel", 3))
    for yy in range(4, h, 5):
        g.box(0, yy, 1, 3, yy + 1, 2, C("steel", 4))
    g.box(1, h, 1, 2, h + 2, 2, C(tip, 6))
    return g


def crate(w: int, h: int, d: int, body: str = "steel", trim: str = "gold", seed: int = 0, glow: str = "plasma") -> Grid:
    """Sci-fi cargo crate: chamfered shell, inset sides, corner guards, latch light."""
    g = Grid(w, h, d)
    cbox(g, 0, 0, 0, w, h, d, C(body, 4), r=1)
    # inset side panels
    g.box(2, 2, 0, w - 2, h - 2, 1, C(body, 3))
    g.box(2, 2, d - 1, w - 2, h - 2, d, C(body, 3))
    g.box(0, 2, 2, 1, h - 2, d - 2, C(body, 3))
    g.box(w - 1, 2, 2, w, h - 2, d - 2, C(body, 3))
    # corner guards
    for x0 in (0, w - 2):
        for z0 in (0, d - 2):
            g.box(x0, 0, z0, x0 + 2, h, z0 + 2, C(trim, 4))
    g.box(1, h - 1, 1, w - 1, h, d - 1, C(body, 5))
    g.box(w // 2 - 1, h // 2 - 1, 0, w // 2 + 1, h // 2 + 1, 1, C(glow, 6))
    g.set(w // 2 - 1, h // 2, 0, C(glow, 7))
    speck(g, seed, 0.12)
    return g


# ------------------------------------------------------------- animation --
def keys(*pairs):
    return [(float(t), tuple(float(c) for c in v)) for t, v in pairs]


def pulse_scale(seconds: float, lo: float, hi: float, steps: int = 8):
    out = []
    for i in range(steps + 1):
        s = lo + (hi - lo) * (0.5 - 0.5 * math.cos(2 * math.pi * i / steps))
        out.append((seconds * i / steps, (s, s, s)))
    return out


def bob_loc(seconds: float, axis: str, amp: float, base=(0.0, 0.0, 0.0), phase: float = 0.0, steps: int = 8):
    return [(t, tuple(base[i] + v[i] for i in range(3))) for t, v in bob(seconds, axis, amp, phase, steps)]


def sway(seconds: float, axis: str, amp: float, phase: float = 0.0):
    return bob(seconds, axis, amp, phase)


# ------------------------------------------------------------- placement --
def tree_bounds(part: Part, acc=(0.0, 0.0, 0.0)):
    """Rest-pose bounds (voxels) of a part tree in its root pivot space."""
    here = tuple(acc[i] + part.at[i] for i in range(3))
    lo, hi = [math.inf] * 3, [-math.inf] * 3
    if part.grid is not None and part.grid.count():
        nz = np.nonzero(part.grid.a)
        for i in range(3):
            lo[i] = min(lo[i], here[i] - part.pivot[i] + int(nz[i].min()))
            hi[i] = max(hi[i], here[i] - part.pivot[i] + int(nz[i].max()) + 1)
    for ch in part.children:
        clo, chi = tree_bounds(ch, here)
        for i in range(3):
            lo[i], hi[i] = min(lo[i], clo[i]), max(hi[i], chi[i])
    return lo, hi


def recenter(root: Part, sockets=()) -> Part:
    """Move the root origin to the bottom centre of the whole rest pose (world
    assets: base on y = 0, centred on x/z). Child placements and `sockets`
    (authored in the old root pivot space) keep their places."""
    lo, hi = tree_bounds(root)
    lo = [lo[i] - root.at[i] for i in range(3)]
    hi = [hi[i] - root.at[i] for i in range(3)]
    d = ((lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2)
    root.pivot = tuple(root.pivot[i] + d[i] for i in range(3))
    for ch in root.children:
        ch.at = tuple(ch.at[i] - d[i] for i in range(3))
    for s in sockets:
        s.at = tuple(s.at[i] - d[i] for i in range(3))
    return root


def solid(name: str, g: Grid) -> Part:
    """Single-grid world part with a base-centred pivot."""
    return recenter(Part(name, g, pivot=(0.0, 0.0, 0.0)))


def tilted_ring(r_out: float, r_in: float, tilt_deg: float, bands=None, thick: float = 0.6) -> Grid:
    """A flat ring tilted about X by `tilt_deg`, centred in its grid.
    `bands` = [(r_lo, r_hi, colour), ...] from the inside out."""
    n = int(2 * r_out + 3)
    g = Grid(n, n, n)
    x, y, z = idx(g)
    c = n / 2
    t = math.radians(tilt_deg)
    u, v, w = x + 0.5 - c, y + 0.5 - c, z + 0.5 - c
    vv = v * math.cos(t) - w * math.sin(t)
    ww = v * math.sin(t) + w * math.cos(t)
    r = np.sqrt(u * u + ww * ww)
    plane = np.abs(vv) <= thick
    for lo, hi, col in bands or [(r_in, r_out, C("sand", 6))]:
        g.a[plane & (r >= lo) & (r < hi)] = col
    return g


GRIP = (0, 0, 3)  # palm centre relative to the PN Hand.R joint (voxels)


def held(slug: str, name: str, g: Grid, grip, sockets: dict, pfx=()) -> Asset:
    """Held item in the Hand.R frame (+X working end, +Z along the arm,
    +Y back of the hand). `grip` is the grid point the palm wraps; socket
    positions are grid points too."""
    pivot = (grip[0] - GRIP[0], grip[1] - GRIP[1], grip[2] - GRIP[2])
    socks = [Socket(n, at=(p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2])) for n, p in sockets.items()]
    return asset("held-items", slug, name, Part(slug, g, pivot=pivot), sockets=socks, pfx=list(pfx))


# ------------------------------------------------ scale-standard helpers --
# Added for the 36-voxel-person scale pass. Grids from these helpers have
# even sizes with integer centres, so parts built from them can take integer
# pivots and stay on the model's voxel grid.

def rim_wheel(R: int, w: int, tire=None, rim=None, hub=None, lugs: int = 20, spokes: int = 5, cap: str = "plasma") -> Grid:
    """Big wheel spinning about X: grid (w, 2R, 2R), axle at (-, R, R).
    Tyre with raised tread lugs, sidewall ring, rim, spokes, hub bolts and a
    glowing cap. Pivot it at (w/2 or 0, R, R)."""
    tire = tire if tire is not None else C("iron", 2)
    rim = rim if rim is not None else C("steel", 5)
    hub = hub if hub is not None else C("steel", 3)
    n = 2 * R
    g = Grid(w, n, n)
    x, y, z = idx(g)
    u, v = y + 0.5 - R, z + 0.5 - R
    rad = np.hypot(u, v)
    ang = np.arctan2(u, v)
    seg = np.floor((ang + math.pi) / (2 * math.pi) * lugs).astype(int)
    body = rad <= R - 1.0
    lug = (rad <= R) & (seg % 2 == 0)
    fill(g, full(g, body | lug), tire)
    paint(g, full(g, lug & (rad > R - 1.0)), C("iron", 1))
    side = (x == 0) | (x == w - 1)
    paint(g, side & full(g, (rad > R - 3.2) & (rad <= R - 2.2)), C("iron", 3))  # sidewall bead
    fill(g, full(g, rad <= R - 3.2), rim)
    fill(g, full(g, rad <= R - 4.2), hub)
    sp = np.floor((ang + math.pi) / (2 * math.pi) * spokes * 2).astype(int) % 2 == 0
    paint(g, side & full(g, (rad > 2.2) & (rad <= R - 4.2) & sp), C("steel", 6))
    recess = side & full(g, (rad > 2.2) & (rad <= R - 4.2) & ~sp)
    paint(g, recess, C("steel", 2))
    fill(g, full(g, rad <= 2.2), C("steel", 5))
    paint(g, side & full(g, rad <= 1.2), C(cap, 6))
    for k in range(5):  # hub bolts
        a = 2 * math.pi * k / 5
        by, bz = int(R + 1.8 * math.sin(a)), int(R + 1.8 * math.cos(a))
        for xx in (0, w - 1):
            if math.hypot(by + 0.5 - R, bz + 0.5 - R) > 1.3:
                g.set(xx, by, bz, C("steel", 7))
    return g


def window(g: Grid, axis: str, at: int, a0: int, b0: int, a1: int, b1: int, glass=None, frame=None, mullion: int | None = None, sill=None, depth: int = 1) -> Grid:
    """Framed window on a face normal to `axis` ('x' or 'z') at plane `at`.
    (a0,b0)-(a1,b1): the glass rectangle, a along the face (z for axis x,
    x for axis z), b along y. `mullion` splits the glass every n voxels."""
    glass = glass if glass is not None else C("plasma", 5)
    frame = frame if frame is not None else C("steel", 6)
    sl = slice(at, at + depth)

    def put(a0_, b0_, a1_, b1_, c):
        if axis == "z":
            g.a[a0_:a1_, b0_:b1_, sl] = c
        else:
            g.a[sl, b0_:b1_, a0_:a1_] = c

    put(a0 - 1, b0 - 1, a1 + 1, b1 + 1, frame)
    put(a0, b0, a1, b1, glass)
    for k in range(b0, b1):  # glass gradient: lighter at the top
        if (k - b0) >= (b1 - b0) * 2 // 3:
            put(a0, k, a1, k + 1, glass + 1 if glass % RAMP_SHADES < 7 else glass)
    put(a0, b1 - 2, a0 + 1, b1 - 1, C("plasma", 7))  # glint
    if mullion:
        for k in range(a0 + mullion, a1, mullion + 1):
            put(k, b0, k + 1, b1, frame)
    if sill is not None:
        put(a0 - 1, b0 - 2, a1 + 1, b0 - 1, sill)
    return g


def vent(g: Grid, axis: str, at: int, a0: int, b0: int, a1: int, b1: int, slat=None, gap=None) -> Grid:
    """Horizontal slatted vent on a face normal to `axis` at plane `at`."""
    slat = slat if slat is not None else C("steel", 5)
    gap = gap if gap is not None else C("iron", 1)
    for k in range(b0, b1):
        c = slat if (k - b0) % 2 == 0 else gap
        if axis == "z":
            g.a[a0:a1, k, at] = c
        else:
            g.a[at, k, a0:a1] = c
    return g


def seam_rect(g: Grid, axis: str, at: int, a0: int, b0: int, a1: int, b1: int, c: int) -> Grid:
    """A one-voxel outline (door / hatch seam) on a face normal to `axis`."""
    for k in range(a0, a1):
        for yy in (b0, b1 - 1):
            if axis == "z":
                g.set(k, yy, at, c)
            else:
                g.set(at, yy, k, c)
    for yy in range(b0, b1):
        for k in (a0, a1 - 1):
            if axis == "z":
                g.set(k, yy, at, c)
            else:
                g.set(at, yy, k, c)
    return g


def container(w: int, h: int, d: int, body: str = "red", frame: str = "steel", doors: str = "+z") -> Grid:
    """Corrugated cargo container: ribbed walls (a rib every 2 voxels), a
    steel corner frame, a roof with cross ribs and locking-bar doors on the
    `doors` end ('+z' or '-z'). Solid inside."""
    g = Grid(w, h, d)
    x, y, z = idx(g)
    g.box(0, 0, 0, w, h, d, C(body, 4))
    side = (x == 0) | (x == w - 1)
    paint(g, side & full(g, (z % 2 == 0)), C(body, 3))
    endz = (z == 0) | (z == d - 1)
    paint(g, endz & full(g, (x % 2 == 0)), C(body, 3))
    paint(g, full(g, (y == h - 1) & (z % 4 == 0)), C(body, 5))
    # corner posts and rails
    for x0 in (0, w - 1):
        for z0 in (0, d - 1):
            g.box(x0, 0, z0, x0 + 1, h, z0 + 1, C(frame, 5))
    g.box(0, 0, 0, w, 1, d, C(frame, 3))
    g.box(0, h - 1, 0, w, h, 1, C(frame, 5)).box(0, h - 1, d - 1, w, h, d, C(frame, 5))
    g.box(0, h - 1, 0, 1, h, d, C(frame, 5)).box(w - 1, h - 1, 0, w, h, d, C(frame, 5))
    # doors with locking bars on one end
    zd = d - 1 if doors == "+z" else 0
    g.box(1, 1, zd, w - 1, h - 1, zd + 1, C(body, 5))
    g.box(w // 2, 1, zd, w // 2 + 1, h - 1, zd + 1, C(body, 2))
    for bx in (w // 4, w // 2 - 2, w // 2 + 2, 3 * w // 4):
        g.box(bx, 2, zd, bx + 1, h - 2, zd + 1, C(frame, 6))
        g.set(bx, h // 2, zd, C("gold", 6))
    return g


DIGITS = {
    "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"], "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "111", "001", "111"], "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"], "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
}


def digits_z(g: Grid, text: str, x0: int, y0: int, z: int, c: int, scale: int = 1) -> Grid:
    """Pixel digits (3x5 font) on a -Z face, as read by a viewer in front of
    it (at -Z, so the viewer's left is high x): x0 is the viewer's left edge."""
    for k, ch in enumerate(text):
        rows = DIGITS[ch]
        for r, row in enumerate(rows):
            for col, bit in enumerate(row):
                if bit == "1":
                    xx, yy = x0 - (k * 4 + col + 1) * scale, y0 + (4 - r) * scale
                    g.box(xx, yy, z, xx + scale, yy + scale, z + 1, c)
    return g


def plume(g: Grid, cx, cy, r0: float, length: int, ramp: str = "plasma", z0: int = 0) -> Grid:
    """Engine flame along +Z from z0: tapers one step per voxel from r0 to a
    point, white-hot at the nozzle and cooler toward the tip."""
    for k in range(length):
        t = k / max(1, length - 1)
        r = max(0.7, r0 * (1 - 0.8 * t))
        shade = 7 if t < 0.3 else (5 if t < 0.65 else 3)
        g.cylinder("z", cx, cy, r, z0 + k, z0 + k + 1, C(ramp, shade))
    return g
