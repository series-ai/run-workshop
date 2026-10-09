"""Vehicle helpers for the monster pack: planked volumes, detailed
spoked wheels, lanterns, big skulls and long bones, all at 1-voxel detail.

Every helper paints into a caller grid (usually a Canvas part, so all parts
share one coordinate system and integer joints keep them on one voxel grid).
"""
from __future__ import annotations

import math

import numpy as np

from _kit import C, Grid, shift, xyz


# ---------------------------------------------------------------- volumes
def _sub(g: Grid, x0, y0, z0, x1, y1, z1):
    sx, sy, sz = g.shape
    x0, x1 = max(0, int(x0)), min(sx, int(x1))
    y0, y1 = max(0, int(y0)), min(sy, int(y1))
    z0, z1 = max(0, int(z0)), min(sz, int(z1))
    if x0 >= x1 or y0 >= y1 or z0 >= z1:
        return None
    return (slice(x0, x1), slice(y0, y1), slice(z0, z1)), (x0, y0, z0)


def planks(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str, shade: int, along: int, across: int, width: int = 3,
           length: int = 14, seed: int = 0, nail: int | None = None) -> Grid:
    """Fill a box with boards. Boards run along axis `along` and are `width`
    voxels wide across axis `across`. Each board gets its own shade (±1), a
    dark seam on its first row, staggered butt joints every `length` voxels
    and (optionally) nail heads beside each joint."""
    s = _sub(g, x0, y0, z0, x1, y1, z1)
    if s is None:
        return g
    sl, lo = s
    shp = g.a[sl].shape
    idx = np.meshgrid(*[np.arange(n) for n in shp], indexing="ij")
    a, l = idx[across], idx[along]
    board = a // width
    rng = np.random.default_rng(seed)
    jit = rng.choice([-1, 0, 0, 1], size=int(board.max()) + 2)
    off = rng.integers(0, length, size=int(board.max()) + 2)
    sh = np.clip(shade + jit[board], 0, 7)
    seam = (a % width) == 0
    joint = ((l + off[board]) % length) == 0
    sh = np.where(seam | joint, np.clip(shade - 1, 0, 7), sh)
    out = (C(ramp, 0) + sh).astype(np.uint8)
    if nail is not None:
        nl = (((l + off[board] - 1) % length) == 0) & ((a % width) == width // 2)
        out = np.where(nl, nail, out).astype(np.uint8)
    g.a[sl] = out
    return g


def panel(g: Grid, x0, y0, z0, x1, y1, z1, body: int, frame: int, inset: int = 2) -> Grid:
    """Box with a raised frame border on its faces (lacquered panel look):
    the border ring of every face gets `frame`, the inside `body`."""
    s = _sub(g, x0, y0, z0, x1, y1, z1)
    if s is None:
        return g
    sl, lo = s
    shp = g.a[sl].shape
    idx = np.meshgrid(*[np.arange(n) for n in shp], indexing="ij")
    edge = np.zeros(shp, bool)
    for ax in range(3):
        if shp[ax] > 2 * inset + 1:
            edge |= (idx[ax] < inset) | (idx[ax] >= shp[ax] - inset)
    # frame only where at least two axes are near the border (a ring per face)
    near = [((idx[ax] < inset) | (idx[ax] >= shp[ax] - inset)) for ax in range(3)]
    ring = (near[0] & near[1]) | (near[1] & near[2]) | (near[0] & near[2])
    g.a[sl] = np.where(ring, frame, body).astype(np.uint8)
    return g


def band_ring(g: Grid, mask: np.ndarray, color: int) -> Grid:
    g.a[np.broadcast_to(mask, g.a.shape) & (g.a != 0)] = color
    return g


def dots(g: Grid, pts, color: int) -> Grid:
    for p in pts:
        g.set(*p, color)
    return g


# ---------------------------------------------------------------- wheels
def wheel(g: Grid, x0: int, cy: int, cz: int, r: int, width: int = 3, tyre: int | None = None, felloe: int | None = None,
          spoke: int | None = None, hub: int | None = None, cap: int | None = None, spokes: int = 12, seg: int | None = None,
          bolts: int | None = None) -> Grid:
    """Spoked wheel in the y/z plane (axle along x) occupying x0..x0+width,
    centred on the voxel corner (cy, cz): 2r voxels across. Iron tyre with
    bolt heads, segmented wooden felloe, `spokes` 1-voxel spokes, a nave
    that sticks out 2 voxels on both sides with iron bands and a cap."""
    tyre = tyre if tyre is not None else C("iron", 2)
    felloe = felloe if felloe is not None else C("darkwood", 3)
    spoke = spoke if spoke is not None else C("darkwood", 4)
    hub = hub if hub is not None else C("darkwood", 2)
    cap = cap if cap is not None else C("iron", 4)
    seg = seg if seg is not None else C("darkwood", 1)
    bolts = bolts if bolts is not None else C("steel", 5)
    x, y, z = xyz(g)
    u, v = y + 0.5 - cy, z + 0.5 - cz
    d = np.sqrt(u * u + v * v)
    ang = np.arctan2(u, v)
    xin = (x >= x0) & (x < x0 + width)
    ring_t = xin & (d <= r) & (d > r - 1.25)
    ring_f = xin & (d <= r - 1.25) & (d > r - 3.1)
    g.where(ring_t, tyre)
    g.where(ring_f, felloe)
    nseg = max(4, spokes // 2)
    joint = ring_f & (np.abs(((ang / (2 * math.pi) * nseg) % 1) - 0.5) < 0.5 * 1.1 / max(1.0, (r - 2) * 2 * math.pi / nseg))
    g.where(joint, seg)
    fb = (ang / (2 * math.pi) * spokes) % 1
    bolt = ring_t & ((x == x0) | (x == x0 + width - 1)) & (d > r - 1.0) & (np.minimum(fb, 1 - fb) * 2 * math.pi * r / spokes < 0.6)
    g.where(bolt, bolts)
    rh = max(2.2, r * 0.26)
    for k in range(spokes):
        a = (k + 0.5) / spokes * 2 * math.pi
        su, sv = math.sin(a), math.cos(a)
        t = np.clip(u * su + v * sv, 0, None)
        perp = np.sqrt(np.maximum(d * d - t * t, 0))
        m = xin & (x > x0 - 1 + (width > 2)) & (x < x0 + width - (width > 2)) & (t > rh - 0.5) & (t < r - 2) & (perp <= 0.62)
        g.where(m, spoke)
    xh = (x >= x0 - 2) & (x < x0 + width + 2)
    g.where(xh & (d <= rh), hub)
    g.where(xh & (d <= rh) & ((x == x0 - 2) | (x == x0 + width + 1) | (x == x0) | (x == x0 + width - 1)) & (d > rh - 1.2), cap)
    g.where(((x == x0 - 3) | (x == x0 + width + 2)) & (d <= 1.3), cap)
    return g


def wheel_z(g: Grid, z0: int, cx: int, cy: int, r: int, width: int = 2, **kw) -> Grid:
    """wheel() with the axle along z (the wheel stands in the x/y plane)."""
    t = Grid(g.shape[2], g.shape[1], g.shape[0])
    wheel(t, z0, cy, cx, r, width, **kw)
    a = np.transpose(t.a, (2, 1, 0))
    g.a[a != 0] = a[a != 0]
    return g


# ---------------------------------------------------------------- lamps
def lantern(g: Grid, x: int, y: int, z: int, glow: str = "ember", frame: int | None = None, w: int = 5, h: int = 7, ring: bool = True) -> Grid:
    """Caged lantern with its base corner at (x, y, z): w×h×w box, glowing
    core, corner posts, a pyramid cap and a hanging ring on top."""
    frame = frame if frame is not None else C("iron", 2)
    g.box(x, y, z, x + w, y + 1, z + w, frame)
    g.box(x + 1, y + 1, z + 1, x + w - 1, y + h - 2, z + w - 1, C(glow, 6))
    g.box(x + 2, y + 2, z + 2, x + w - 2, y + h - 3, z + w - 2, C(glow, 7))
    for cx, cz in ((x, z), (x + w - 1, z), (x, z + w - 1), (x + w - 1, z + w - 1)):
        g.box(cx, y + 1, cz, cx + 1, y + h - 2, cz + 1, frame)
    mid = y + (h - 1) // 2
    g.box(x, mid, z, x + w, mid + 1, z + 1, frame).box(x, mid, z + w - 1, x + w, mid + 1, z + w, frame)
    g.box(x, mid, z, x + 1, mid + 1, z + w, frame).box(x + w - 1, mid, z, x + w, mid + 1, z + w, frame)
    g.box(x, y + h - 2, z, x + w, y + h - 1, z + w, frame)
    g.box(x + 1, y + h - 1, z + 1, x + w - 1, y + h, z + w - 1, C("iron", 3))
    if ring:
        c = w // 2
        g.set(x + c, y + h, z + c, C("iron", 3))
        g.set(x + c, y + h + 1, z + c - 1, C("iron", 3)).set(x + c, y + h + 1, z + c + 1, C("iron", 3)).set(x + c, y + h + 2, z + c, C("iron", 3))
    return g


# ---------------------------------------------------------------- bones
def big_skull(g: Grid, x: int, y: int, z: int, facing: str = "-z", bone: int | None = None, eye: int | None = None, s: int = 6) -> Grid:
    """An s-wide skull (s = 5..8) with its base corner at (x, y, z): cranium,
    brow, eye sockets, nose hole, cheek bones and a toothed jaw."""
    bone = bone if bone is not None else C("bone", 6)
    eye = eye if eye is not None else C("gray", 1)
    dark = C("bone", 3)
    t = Grid(s, s + 1, s + 1)  # local: x across, y up, z depth; face at z = 0
    t.ellipsoid(s / 2, s * 0.62, s / 2 + 0.5, s / 2, s * 0.5, s / 2 + 0.5, bone)
    t.box(1, 0, 0, s - 1, 2, s - 1, bone)  # jaw block
    t.box(1, 1, 0, s - 1, 2, 1, C("bone", 7))  # teeth row
    for tx in range(1, s - 1, 2):
        t.set(tx, 1, 0, dark)
    t.box(0, 2, 1, s, 3, s - 1, C("bone", 5))  # cheek bones
    e0 = max(1, s // 2 - 2)
    e1 = s - e0 - 2
    ey = 3 if s < 7 else 4
    t.box(e0, ey, 0, e0 + 2, ey + 2, 2, eye)
    t.box(e1, ey, 0, e1 + 2, ey + 2, 2, eye)
    t.box(e0, ey + 2, 0, e1 + 2, ey + 3, 1, C("bone", 7))  # brow
    t.set(s // 2 - (1 - s % 2), ey - 1, 0, dark)
    if s % 2 == 0:
        t.set(s // 2, ey - 1, 0, dark)
    a = t.a
    if facing == "+z":
        a = a[::-1, :, ::-1]
    elif facing == "-x":
        a = np.transpose(a, (2, 1, 0))
    elif facing == "+x":
        a = np.transpose(a, (2, 1, 0))[::-1, :, ::-1]
    sx, sy, sz = a.shape
    sub = g.a[x:x + sx, y:y + sy, z:z + sz]
    part = a[:sub.shape[0], :sub.shape[1], :sub.shape[2]]
    sub[part != 0] = part[part != 0]
    return g


def long_bone(g: Grid, p0, p1, shaft: int | None = None, knob: int | None = None, r: float = 0.7) -> Grid:
    """Femur-like bone: a thin shaft with two knobbed ends."""
    shaft = shaft if shaft is not None else C("bone", 6)
    knob = knob if knob is not None else C("bone", 5)
    g.line(p0, p1, r, shaft)
    for p in (p0, p1):
        g.sphere(p[0], p[1], p[2], r + 0.9, knob)
    return g


def rope(g: Grid, p0, p1, a: int | None = None, b: int | None = None) -> Grid:
    """1-voxel rope with a twisted two-shade pattern."""
    a = a if a is not None else C("sand", 4)
    b = b if b is not None else C("sand", 2)
    p0, p1 = np.array(p0, float), np.array(p1, float)
    n = int(max(np.abs(p1 - p0).max(), 1))
    for i in range(n + 1):
        p = p0 + (p1 - p0) * i / n
        g.set(round(p[0]), round(p[1]), round(p[2]), a if (i // 2) % 2 == 0 else b)
    return g


def studs(g: Grid, mask: np.ndarray, every: int, color: int, phase: int = 0) -> Grid:
    """Rivet/stud heads on the masked voxels along a regular lattice."""
    x, y, z = xyz(g)
    g.where(np.broadcast_to(mask, g.a.shape) & (((x + y + z + phase) % every) == 0) & (g.a != 0), color)
    return g


def weather(g: Grid, seed: int, mask: np.ndarray, amount: float = 0.08) -> Grid:
    """Sparse single-voxel darkening (grime) on exposed voxels in `mask`."""
    rng = np.random.default_rng(seed)
    m = np.broadcast_to(mask, g.a.shape) & (rng.random(g.a.shape) < amount)
    return shift(g, m, -1)
