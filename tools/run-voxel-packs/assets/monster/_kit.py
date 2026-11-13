"""Shared helpers for the RUN voxel monster pack (gothic horror).

Vectorized shade tools (numpy), small gothic motifs (skulls, candles, chains,
arches, roofs) and an asset wrapper that centres every world model on x/z and
puts its base on y = 0 at rest, children included.
"""
from __future__ import annotations

import math
import random

import numpy as np

import voxgrid
from voxgrid import PALETTE, RAMP_SHADES, Asset, C, Clip, Part, Socket, bob, pfx_binding, turn  # noqa: F401

PACK = "monster"
GRIP = (0, 0, 3)  # held items: palm centre relative to the Hand.R joint (voxels)


class Grid(voxgrid.Grid):
    """voxgrid.Grid whose where/carve accept partial (broadcastable) masks."""

    def where(self, mask, c: int) -> "Grid":
        self.a[np.broadcast_to(mask, self.a.shape)] = c
        return self

    def carve(self, other_mask) -> "Grid":
        self.a[np.broadcast_to(other_mask, self.a.shape)] = 0
        return self


# ---------------------------------------------------------------- coordinates
def xyz(g: Grid):
    """Broadcastable integer index arrays (x, y, z) for a grid."""
    sx, sy, sz = g.shape
    return (np.arange(sx)[:, None, None], np.arange(sy)[None, :, None], np.arange(sz)[None, None, :])


def full(g: Grid, mask) -> np.ndarray:
    """Broadcast a partial index mask (e.g. built from x and z only) to the grid."""
    return np.broadcast_to(mask, g.a.shape).copy()


def cut(g: Grid, mask) -> Grid:
    g.a[full(g, mask)] = 0
    return g


def paint(g: Grid, mask, c: int) -> Grid:
    g.a[full(g, mask)] = c
    return g


def ramp_mask(g: Grid, *ramps: str) -> np.ndarray:
    ids = [PALETTE["ramps"][r] for r in ramps]
    return np.isin(g.a // RAMP_SHADES, ids) & (g.a != 0)


# ---------------------------------------------------------------- shading
def shift(g: Grid, mask: np.ndarray, delta) -> Grid:
    """Move masked voxels `delta` shades inside their own ramp (clamped).
    `delta` may be an int or an int array shaped like the mask selection."""
    m = mask & (g.a != 0)
    if not m.any():
        return g
    vals = g.a[m].astype(np.int16)
    ramp, shade = vals // RAMP_SHADES, vals % RAMP_SHADES
    d = delta[m] if isinstance(delta, np.ndarray) and delta.shape == g.a.shape else delta
    new = np.clip(shade + d, 0, RAMP_SHADES - 1)
    idx = ramp * RAMP_SHADES + new
    idx[idx == 0] = 1  # gray shade 0 is the empty index
    g.a[m] = idx.astype(np.uint8)
    return g


def exposed(g: Grid, axis: int, sign: int) -> np.ndarray:
    """Filled voxels whose neighbour along axis*sign is empty (or outside)."""
    filled = g.a != 0
    nb = np.zeros_like(filled)
    sl_dst = [slice(None)] * 3
    sl_src = [slice(None)] * 3
    if sign > 0:
        sl_dst[axis], sl_src[axis] = slice(0, -1), slice(1, None)
    else:
        sl_dst[axis], sl_src[axis] = slice(1, None), slice(0, -1)
    nb[tuple(sl_dst)] = filled[tuple(sl_src)]
    return filled & ~nb


def light_tops(g: Grid, delta: int = 1, ramps: tuple[str, ...] | None = None) -> Grid:
    m = exposed(g, 1, 1)
    if ramps:
        m &= ramp_mask(g, *ramps)
    return shift(g, m, delta)


def dark_undersides(g: Grid, delta: int = -1) -> Grid:
    _x, y, _z = xyz(g)
    return shift(g, exposed(g, 1, -1) & (y > 0), delta)


def speck(g: Grid, seed: int, amount: float = 0.18, block: int = 1, mask: np.ndarray | None = None) -> Grid:
    """Deterministic ±1 shade jitter, in `block`-sized cubes (bigger blocks keep
    greedy meshes small on large surfaces)."""
    rng = np.random.default_rng(seed)
    sx, sy, sz = g.shape
    bs = (math.ceil(sx / block), math.ceil(sy / block), math.ceil(sz / block))
    r = rng.random(bs)
    s = rng.choice([-1, 1], size=bs)
    d = np.where(r < amount, s, 0)
    d = np.repeat(np.repeat(np.repeat(d, block, 0), block, 1), block, 2)[:sx, :sy, :sz]
    m = d != 0
    if mask is not None:
        m &= mask
    return shift(g, m, d.astype(np.int16))


def grade(g: Grid, lo: int = -1, hi: int = 1) -> Grid:
    """Darken low voxels and lighten high ones (height gradient)."""
    _x, y, _z = xyz(g)
    ys = np.nonzero(g.a)[1]
    if len(ys) == 0:
        return g
    y0, y1 = ys.min(), max(ys.max(), ys.min() + 1)
    t = np.clip((y - y0) / (y1 - y0), 0, 1)
    d = np.rint(lo + (hi - lo) * t).astype(np.int16)
    d = np.broadcast_to(d, g.a.shape)
    return shift(g, np.ones(g.a.shape, bool), d.copy())


def finish(g: Grid, seed: int, amount: float = 0.16, block: int = 1, tops: int = 1) -> Grid:
    """Standard pass: lit tops, dark undersides, per-voxel jitter."""
    if tops:
        light_tops(g, tops)
    dark_undersides(g, -1)
    return speck(g, seed, amount, block)


def seams(g: Grid, ramp: str, axis: int, every: int, delta: int = -1, offset: int = 0) -> Grid:
    """Plank / stave seams: every `every`-th slice along axis goes darker."""
    coord = xyz(g)[axis]
    m = ramp_mask(g, ramp) & (((coord + offset) % every) == 0)
    return shift(g, m, delta)


def moss(g: Grid, seed: int, amount: float = 0.35, ramp: str = "moss", shades=(2, 3, 4)) -> Grid:
    """Paint moss on some upward-facing voxels (and one voxel down, dripping)."""
    rng = np.random.default_rng(seed)
    top = exposed(g, 1, 1) & (rng.random(g.a.shape) < amount)
    drip = np.zeros_like(top)
    drip[:, :-1, :] = top[:, 1:, :] & (rng.random(g.a.shape)[:, :-1, :] < 0.45)
    m = (top | drip) & (g.a != 0)
    cols = np.array([C(ramp, s) for s in shades], dtype=np.uint8)
    g.a[m] = cols[rng.integers(0, len(cols), size=int(m.sum()))]
    return g


def scatter(g: Grid, seed: int, mask: np.ndarray, chance: float, colors: list[int]) -> Grid:
    rng = np.random.default_rng(seed)
    m = mask & (rng.random(g.a.shape) < chance)
    cols = np.array(colors, dtype=np.uint8)
    g.a[m] = cols[rng.integers(0, len(cols), size=int(m.sum()))]
    return g


# ---------------------------------------------------------------- motifs
def skull(g: Grid, x: int, y: int, z: int, facing: str = "-z", bone: int | None = None, eye: int | None = None) -> Grid:
    """A 3×3×3 skull with its base at (x, y, z) (corner), face on `facing`."""
    bone = bone or C("bone", 6)
    eye = eye or C("gray", 1)
    g.box(x, y + 1, z, x + 3, y + 3, z + 3, bone)
    g.box(x, y, z, x + 3, y + 1, z + 3, C("bone", 5))
    if facing == "-z":
        g.set(x, y + 1, z, eye).set(x + 2, y + 1, z, eye)
        g.set(x + 1, y, z, C("bone", 4))
    elif facing == "+z":
        g.set(x, y + 1, z + 2, eye).set(x + 2, y + 1, z + 2, eye)
    elif facing == "-x":
        g.set(x, y + 1, z, eye).set(x, y + 1, z + 2, eye)
    elif facing == "+x":
        g.set(x + 2, y + 1, z, eye).set(x + 2, y + 1, z + 2, eye)
    return g


def candle(g: Grid, x: int, y: int, z: int, h: int = 3, wax: str = "bone", lit: bool = True) -> Grid:
    g.box(x, y, z, x + 1, y + h, z + 1, C(wax, 6 if wax == "bone" else 4))
    g.set(x, y, z, C(wax, 4))
    if lit:
        g.set(x, y + h, z, C("ember", 7))
        g.set(x, y + h + 1, z, C("gold", 7))
    return g


def chain(g: Grid, p0, p1, color: int | None = None, alt: int | None = None) -> Grid:
    """Alternating-shade voxel chain from p0 to p1."""
    color = color or C("iron", 4)
    alt = alt or C("iron", 2)
    p0, p1 = np.array(p0, float), np.array(p1, float)
    n = int(max(abs(p1 - p0).max(), 1))
    for i in range(n + 1):
        p = p0 + (p1 - p0) * i / n
        g.set(round(p[0]), round(p[1]), round(p[2]), color if i % 2 == 0 else alt)
    return g


def arch_mask(g: Grid, cx: float, y0: int, half: float, height: int, axis: str = "x") -> np.ndarray:
    """2D pointed-arch opening mask (extruded along the other horizontal axis):
    width 2*half centred on cx (x or z), from y0 up to y0+height."""
    x, y, z = xyz(g)
    u = (x if axis == "x" else z) + 0.5
    yy = y + 0.5 - y0
    straight = height - half * 1.2
    body = (abs(u - cx) <= half) & (yy >= 0) & (yy <= straight)
    # gothic point: two circles of radius ~1.6*half offset from centre
    r = half * 1.6
    top = (yy > straight) & (yy <= height)
    left = ((u - (cx + r - half)) ** 2 + (yy - straight) ** 2) <= r * r
    right = ((u - (cx - r + half)) ** 2 + (yy - straight) ** 2) <= r * r
    return body | (top & left & right)


def gable_roof(g: Grid, x0: int, x1: int, y0: int, z0: int, z1: int, c_main: int, c_dark: int, ridge_axis: str = "z", pitch: float = 1.0) -> int:
    """Pitched roof over the rectangle, ridge along `ridge_axis`. Returns ridge y."""
    x, y, z = xyz(g)
    if ridge_axis == "z":
        mid, half, u = (x0 + x1) / 2, (x1 - x0) / 2, x + 0.5
        inside = (z >= z0) & (z < z1)
    else:
        mid, half, u = (z0 + z1) / 2, (z1 - z0) / 2, z + 0.5
        inside = (x >= x0) & (x < x1)
    h = (half - abs(u - mid)) * pitch
    rel = y + 0.5 - y0
    solid = inside & (rel >= 0) & (rel <= h + 0.5) & (abs(u - mid) <= half)
    shell_ = solid & (rel >= h - 1.5)
    g.where(shell_, c_main)
    rows = (np.floor(rel) % 3 == 0) & shell_
    g.where(rows, c_dark)
    return int(y0 + half * pitch)


def spire(g: Grid, cx: float, cz: float, y0: int, y1: int, r0: float, c_main: int, c_band: int | None = None, square: bool = True) -> Grid:
    """Tapered square (or round) spire from y0 (radius r0) to a point at y1."""
    x, y, z = xyz(g)
    t = (y + 0.5 - y0) / max(1, (y1 - y0))
    r = r0 * (1 - t)
    d = np.maximum(abs(x + 0.5 - cx), abs(z + 0.5 - cz)) if square else np.sqrt((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2)
    m = (t >= 0) & (t < 1) & (d <= r + 0.3)
    g.where(m, c_main)
    if c_band is not None:
        g.where(m & ((y % 4) == 0), c_band)
    return g


def window(g: Grid, cx: int, y0: int, z_face: int, w: int = 2, h: int = 5, glow: str = "gold", frame: int | None = None, depth: int = 2, face: str = "-z") -> Grid:
    """Lit gothic window cut into a wall face (pointed top, cross mullion)."""
    frame = frame if frame is not None else C("iron", 2)
    lit = C(glow, 6)
    lit2 = C(glow, 5)
    if face in ("-z", "+z"):
        zs = (z_face, z_face + depth) if face == "-z" else (z_face - depth + 1, z_face + 1)
        g.box(cx - w - 1, y0 - 1, zs[0], cx + w + 1, y0 + h + 1, zs[1] - depth + 1, frame)
        g.box(cx - w, y0, zs[0], cx + w, y0 + h, zs[1], lit)
        g.box(cx - w + 1, y0 + h, zs[0], cx + w - 1, y0 + h + 1, zs[1], lit2)
        g.box(cx, y0, zs[0], cx + 1, y0 + h, zs[0] + 1, frame) if w > 1 else None
        g.box(cx - w, y0 + h // 2, zs[0], cx + w, y0 + h // 2 + 1, zs[0] + 1, frame)
    else:
        xs = (z_face, z_face + depth) if face == "-x" else (z_face - depth + 1, z_face + 1)
        g.box(xs[0], y0 - 1, cx - w - 1, xs[1] - depth + 1, y0 + h + 1, cx + w + 1, frame)
        g.box(xs[0], y0, cx - w, xs[1], y0 + h, cx + w, lit)
        g.box(xs[0], y0 + h, cx - w + 1, xs[1], y0 + h + 1, cx + w - 1, lit2)
        g.box(xs[0], y0 + h // 2, cx - w, xs[0] + 1, y0 + h // 2 + 1, cx + w, frame)
    return g


def pumpkin(g: Grid, cx: float, cy: float, cz: float, r: float, carved: bool = True, face: str = "-z") -> Grid:
    x, y, z = xyz(g)
    ry = r * 0.8
    m = ((x + 0.5 - cx) / r) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + ((z + 0.5 - cz) / r) ** 2 <= 1
    g.where(m, C("orange", 4))
    ang = np.arctan2(z + 0.5 - cz, x + 0.5 - cx)
    ribs = m & (np.cos(ang * 8) > 0.75)
    g.where(ribs, C("orange", 3))
    g.where(m & (y + 0.5 > cy + ry * 0.6), C("orange", 5))
    g.box(int(cx) - 1, int(cy + ry) - 1, int(cz) - 1, int(cx) + 1, int(cy + ry) + 2, int(cz) + 1, C("forest", 2))
    if carved:
        sgn = -1 if face == "-z" else 1
        dz = (z + 0.5 - cz) * sgn
        eyes = (abs(y + 0.5 - (cy + ry * 0.22)) <= max(1.0, r * 0.16)) & (abs(abs(x + 0.5 - cx) - r * 0.38) <= max(1.0, r * 0.17))
        nose = (abs(y + 0.5 - cy) <= max(0.6, r * 0.08)) & (abs(x + 0.5 - cx) <= max(0.6, r * 0.09))
        mouth = (abs(y + 0.5 - (cy - ry * 0.35)) <= max(0.8, r * 0.13)) & (abs(x + 0.5 - cx) <= r * 0.62)
        teeth = mouth & (((x - int(cx)) % 3) == 1) & (y + 0.5 > cy - ry * 0.35)
        holes = (eyes | nose | (mouth & ~teeth)) & m & (dz > 0)
        outer = holes & (dz >= r * 0.62)
        g.where(holes & (dz < r * 0.62) & (dz >= r * 0.45), C("ember", 4))
        g.where(holes & (dz < r * 0.45), C("ember", 3))
        g.carve(outer)
        g.where(m & ~holes & (dz >= r * 0.2) & (dz < r * 0.62) & (g.a == 0), C("ember", 3))
    return g


def plank_box(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str = "darkwood", shade: int = 3, axis: int = 0, every: int = 3) -> Grid:
    g.box(x0, y0, z0, x1, y1, z1, C(ramp, shade))
    sub = np.zeros(g.a.shape, bool)
    sub[x0:x1, y0:y1, z0:z1] = True
    coord = xyz(g)[axis]
    shift(g, sub & ramp_mask(g, ramp) & (((coord - (x0, y0, z0)[axis]) % every) == 0), -1)
    return g


def rivets(g: Grid, mask: np.ndarray, every: int, color: int | None = None) -> Grid:
    x, y, z = xyz(g)
    color = color or C("steel", 6)
    g.where(mask & (((x + y + z) % every) == 0), color)
    return g


# ---------------------------------------------------------------- clips
def keys(*pairs):
    """keys((t, (x, y, z)), ...) → list of (t, tuple)."""
    return [(float(t), tuple(float(c) for c in v)) for t, v in pairs]


def sway(seconds: float, axis: str, amp: float, phase: float = 0.0, steps: int = 12):
    return bob(seconds, axis, amp, phase, steps)


def flicker(seconds: float = 0.8, lo: float = 0.8, hi: float = 1.15):
    pat = [1.0, hi, lo + 0.1, 1.05, lo, hi - 0.05, 0.95, 1.0]
    return [(seconds * i / (len(pat) - 1), (1.0 + (p - 1) * 0.5, p, 1.0 + (p - 1) * 0.5)) for i, p in enumerate(pat)]


# ---------------------------------------------------------------- assets
def rest_bounds(root: Part):
    lo = np.array([np.inf] * 3)
    hi = np.array([-np.inf] * 3)

    def visit(p: Part, acc):
        acc = acc + np.array(p.at, float)
        if p.grid is not None and p.grid.count():
            nz = np.nonzero(p.grid.a)
            for ax in range(3):
                lo[ax] = min(lo[ax], nz[ax].min() - p.pivot[ax] + acc[ax])
                hi[ax] = max(hi[ax], nz[ax].max() + 1 - p.pivot[ax] + acc[ax])
        for ch in p.children:
            visit(ch, acc)

    visit(root, np.zeros(3) - np.array(root.at, float))
    return lo, hi


def world(slug: str, category: str, name: str, root: Part, clips=(), sockets=(), pfx=(), budget_check: bool = True) -> Asset:
    """World asset: shift the root so the rest-pose model sits on y = 0 and is
    centred on x/z. Sockets stay in root pivot space (unaffected)."""
    lo, hi = rest_bounds(root)
    root.at = (-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2)
    return Asset(
        id=f"{PACK}-{category}-{slug}",
        pack=PACK,
        category=category,
        name=name,
        root=root,
        clips=list(clips),
        sockets=list(sockets),
        pfx=list(pfx),
    )


def single(slug: str, category: str, name: str, g: Grid, **kw) -> Asset:
    return world(slug, category, name, Part(slug, g, pivot=(g.shape[0] / 2, 0, g.shape[2] / 2)), **kw)


def held(slug: str, name: str, g: Grid, grip_cell, sockets: dict, pfx=(), parts: list[Part] | None = None, clips=()) -> Asset:
    """Held item: `grip_cell` is the grid cell (float ok) the palm wraps;
    `sockets` maps name → grid cell (x, y, z). The working end points +X."""
    pivot = (grip_cell[0] - GRIP[0], grip_cell[1] - GRIP[1], grip_cell[2] - GRIP[2])
    root = Part(slug, g, pivot=pivot)
    for p in parts or []:
        root.add(p)
    socks = [Socket(n, at=(c[0] - pivot[0], c[1] - pivot[1], c[2] - pivot[2])) for n, c in sockets.items()]
    return Asset(id=f"{PACK}-held-items-{slug}", pack=PACK, category="held-items", name=name, root=root, sockets=socks, pfx=list(pfx), clips=list(clips))


def pfx(effect: str, socket: str, trigger: str = "idle", **kw) -> dict:
    return pfx_binding(effect, socket, trigger, **kw)


# ---------------------------------------------------------------- dungeon kit
DUNGEON_TILE = 24  # modular pieces snap on a 24-voxel grid


def dungeon_stone(g: Grid, seed: int) -> Grid:
    """Rough dungeon masonry: big blocks, dark mortar, moss and damp streaks."""
    voxgrid.brickify(g, "stone", course=4, length=6, mortar_delta=-2, seed=seed)
    moss(g, seed + 1, 0.3)
    return g


def torch_bracket(g: Grid, x: int, y: int, z: int, face: str = "-z") -> Grid:
    """Wall torch: iron bracket + wrapped handle + static flame."""
    dz = -1 if face == "-z" else 1
    g.box(x, y, z, x + 2, y + 1, z + 1, C("iron", 3))
    g.box(x, y, z + dz, x + 2, y + 4, z + dz + 1, C("darkwood", 3))
    g.box(x, y + 1, z + dz, x + 2, y + 2, z + dz + 1, C("sand", 4))
    g.box(x, y + 4, z + dz, x + 2, y + 6, z + dz + 1, C("ember", 4))
    g.set(x, y + 6, z + dz, C("ember", 6)).set(x + 1, y + 5, z + dz, C("ember", 6))
    return g


# ---------------------------------------------------------------- coffins
def coffin_mask(w: int, L: int, shoulder: int) -> np.ndarray:
    """2D hexagonal coffin outline [w, L]: foot end at index 0, head end at L-1,
    widest at `shoulder`."""
    u = np.arange(w)[:, None] + 0.5 - w / 2
    v = np.arange(L)[None, :]
    half = np.where(v < shoulder, w / 2 - 2 + (v / shoulder) * 2, w / 2 - (v - shoulder) / (L - shoulder) * 2.2)
    return abs(u) <= half


def coffin_parts(w: int = 12, L: int = 28, depth: int = 7, lid_h: int = 2, wood: str = "darkwood", lining: str = "blood", trim: str = "gold"):
    """(box, lid) grids for a coffin lying along +Z (head at +Z), open top.
    box: [w, depth, L]; lid: [w, lid_h, L]. Both use the same outline."""
    sh = int(L * 0.3)
    m2 = coffin_mask(w, L, sh)
    box = Grid(w, depth, L)
    for yy in range(depth):
        box.a[:, yy, :][m2] = C(wood, 3 if yy % 3 else 2)
    inner = coffin_mask(w - 2, L - 2, sh - 1)
    pad = np.zeros_like(m2)
    pad[1:-1, 1:-1] = inner
    for yy in range(2, depth):
        box.a[:, yy, :][pad] = 0
    box.a[:, 1, :][pad] = C(lining, 3)
    box.a[:, 2, :][pad & (np.arange(L)[None, :] > L - 6)] = C(lining, 5)  # pillow
    edge = m2 & ~pad
    box.a[:, depth - 1, :][edge] = C(wood, 4)
    box.a[:, 0, :][m2] = C(wood, 1)
    for hz in (sh - 3, sh + 6, L - 6):  # brass handles on both sides
        box.box(0, 2, hz, 1, 4, hz + 2, C(trim, 4))
        box.box(w - 1, 2, hz, w, 4, hz + 2, C(trim, 4))
    lid = Grid(w, lid_h, L)
    for yy in range(lid_h):
        lid.a[:, yy, :][m2] = C(wood, 4 if yy == lid_h - 1 else 3)
    cx = w // 2
    lid.box(cx - 1, lid_h - 1, sh - 4, cx + 1, lid_h, L - 5, C(trim, 5))  # cross
    lid.box(cx - 3, lid_h - 1, L - 11, cx + 3, lid_h, L - 9, C(trim, 5))
    lid.a[:, lid_h - 1, :][m2 & ~pad] = C(wood, 2)
    return box, lid


# ---------------------------------------------------------------- building kit
def masonry(g: Grid, seed: int, course: int = 3, length: int = 5) -> Grid:
    voxgrid.brickify(g, "stone", course=course, length=length, mortar_delta=-1, seed=seed)
    return g


def timber_frame(g: Grid, x0: int, y0: int, z0: int, x1: int, y1: int, z1: int, plaster: int, beam: int, step: int = 6) -> Grid:
    """Tudor wall block: plaster infill with dark beams (posts, rails and
    diagonal braces) on all four outer faces."""
    g.box(x0, y0, z0, x1, y1, z1, plaster)
    x, y, z = xyz(g)
    inside = (x >= x0) & (x < x1) & (y >= y0) & (y < y1) & (z >= z0) & (z < z1)
    face = inside & ((x == x0) | (x == x1 - 1) | (z == z0) | (z == z1 - 1))
    along = np.where((z == z0) | (z == z1 - 1), x - x0, z - z0)
    posts = face & ((along % step) == 0)
    rails = face & ((y == y0) | (y == y1 - 1) | (y == (y0 + y1) // 2))
    diag = face & ((((along % step) - (y - y0) % step) == 0) & ((along // step) % 2 == 0))
    g.where(posts | rails | diag, beam)
    return g


def shingles(g: Grid, mask: np.ndarray, ramp: str, base: int = 3) -> Grid:
    """Colour a roof mask in staggered shingle rows."""
    x, y, z = xyz(g)
    m = np.broadcast_to(mask, g.a.shape)
    row = y // 2
    stagger = ((x + z + row * 2) % 4 == 0)
    g.where(m, C(ramp, base))
    g.where(m & ((y % 2) == 0), C(ramp, base - 1))
    g.where(m & stagger & ((y % 2) == 1), C(ramp, base + 1))
    return g


# ---------------------------------------------------------------- jointed creatures
class Canvas:
    """Paint a jointed model in one coordinate system: one full-size grid per
    part. `assemble` turns them into a Part tree whose pivots sit at the given
    joints (grid coordinates), so clips rotate each part about its joint."""

    def __init__(self, shape: tuple[int, int, int], names: list[str]):
        self.shape = shape
        self.parts = {n: Grid(*shape) for n in names}

    def __getitem__(self, name: str) -> Grid:
        return self.parts[name]

    def each(self):
        return self.parts.items()

    def finish(self, seed: int, amount: float = 0.14, block: int = 1, tops: int = 1) -> "Canvas":
        for i, (_n, g) in enumerate(self.parts.items()):
            finish(g, seed + i, amount, block, tops)
        return self

    def crop(self) -> dict[str, tuple[Grid, tuple[int, int, int]]]:
        """Crop every part grid to its filled bounds: name → (grid, offset)."""
        out = {}
        for n, g in self.parts.items():
            nz = np.nonzero(g.a)
            if len(nz[0]) == 0:
                raise ValueError(f"part {n!r} is empty")
            lo = [int(v.min()) for v in nz]
            hi = [int(v.max()) + 1 for v in nz]
            out[n] = (g.crop(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]), tuple(lo))
        return out

    def assemble(self, joints: list[tuple[str, str | None, tuple[float, float, float]]]) -> Part:
        """joints: (name, parent or None, joint point in canvas coordinates),
        parents first. Returns the root Part."""
        crops = self.crop()
        made: dict[str, tuple[Part, tuple]] = {}
        root = None
        for name, parent, j in joints:
            g, off = crops[name]
            pivot = (j[0] - off[0], j[1] - off[1], j[2] - off[2])
            if parent is None:
                p = Part(name, g, pivot=pivot)
                root = p
            else:
                pp, pj = made[parent]
                p = pp.add(Part(name, g, pivot=pivot, at=(j[0] - pj[0], j[1] - pj[1], j[2] - pj[2])))
            made[name] = (p, j)
        missing = set(self.parts) - set(made)
        if missing:
            raise ValueError(f"parts without joints: {sorted(missing)}")
        return root


def limb(g: Grid, pts, radii, c: int) -> Grid:
    """Tapered chain of capsules through points with per-point radii."""
    for (p0, r0), (p1, r1) in zip(zip(pts, radii), list(zip(pts, radii))[1:]):
        steps = max(2, int(np.linalg.norm(np.subtract(p1, p0))))
        for i in range(steps + 1):
            t = i / steps
            p = tuple(p0[k] + (p1[k] - p0[k]) * t for k in range(3))
            g.sphere(p[0], p[1], p[2], r0 + (r1 - r0) * t, c)
    return g


def claws(g: Grid, x: float, y: float, z: float, n: int = 3, spread: float = 1.5, length: float = 3, c: int | None = None, dz: float = -1, dy: float = -0.6) -> Grid:
    c = c or C("bone", 6)
    for i in range(n):
        ox = (i - (n - 1) / 2) * spread
        g.line((x + ox, y, z), (x + ox, y + dy * length, z + dz * length), 0.5, c)
    return g


# ---------------------------------------------------------------- vehicles
def spoked_wheel(r: float, thick: int = 2, rim: int | None = None, spoke: int | None = None, hub: int | None = None, spokes: int = 8) -> Grid:
    """Wheel in the y/z plane (axle along x), centred in its grid; spins about x."""
    rim = rim or C("darkwood", 2)
    spoke = spoke or C("darkwood", 3)
    hub = hub or C("iron", 4)
    n = int(2 * r + 2)
    g = Grid(thick, n, n)
    c = n / 2
    g.cylinder("x", c, c, r, 0, thick, rim)
    g.cylinder("x", c, c, r - 1.4, 0, thick, 0)
    for k in range(spokes):
        a = k / spokes * math.pi * 2
        g.line((thick / 2 - 0.5, c + math.sin(a) * 1.2, c + math.cos(a) * 1.2), (thick / 2 - 0.5, c + math.sin(a) * (r - 1), c + math.cos(a) * (r - 1)), 0.55, spoke)
    g.cylinder("x", c, c, max(1.2, r * 0.22), -1, thick + 1, hub)
    x, y, z = xyz(g)
    ang = np.arctan2(y + 0.5 - c, z + 0.5 - c)
    g.where((g.a == rim) & (np.cos(ang * 6) > 0.8), C("iron", 3))  # iron tyre studs
    return g


# ---------------------------------------------------------------- rig space (avatar parts, skins)
# PN body (species 1) in the rig grid (40×92×76, faces +X, right arm +Z):
HEAD = dict(x0=13, x1=29, y0=37, y1=59, z0=27, z1=49)  # the head box; face plate at x = 28
FACE_X = 28
EYE_Y = 47
EYE_Z = ((33, 35), (42, 44))  # left, right eye z spans on the face plate
MOUTH_Y = 42
TORSO = dict(x0=16, x1=24, y0=16, y1=36, z0=29, z1=47)


def rig_xyz():
    from rigkit import rig_grid

    return xyz(rig_grid())


def rig_canvas() -> Grid:
    from rigkit import rig_grid

    g = Grid(*rig_grid().shape)
    return g


def rig_part(name: str, g: Grid, display: str, **rules) -> Part:
    from rigkit import PIVOT, part_rules

    if g.count() == 0:
        raise ValueError(f"avatar part {name!r} is empty")
    return Part(name, g, pivot=PIVOT, meta={"name": display, "rules": part_rules(**rules)})


def paint_body(g: Grid, skin: int, top: int, arms: int, hands: int, legs: int, feet: int) -> Grid:
    """Colour the PN body regions (a base for skins)."""
    from rigkit import region

    g.where(region(["Head"]), skin)
    g.where(region(["Chest", "Body"]), top)
    g.where(region(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"]), arms)
    g.where(region(["Hand.L", "Hand.R"]), hands)
    g.where(region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]), legs)
    g.where(region(["Foot.L", "Foot.R"]), feet)
    return g


def face(g: Grid, eye: int, mouth: int | None = None, pupil: int | None = None, brow: int | None = None, mouth_w: int = 4) -> Grid:
    """Eyes (2×2 each), optional brows and mouth on the face plate."""
    for z0, z1 in EYE_Z:
        g.box(FACE_X, EYE_Y, z0, FACE_X + 1, EYE_Y + 2, z1, eye)
        if pupil is not None:
            g.set(FACE_X, EYE_Y, z0 + (1 if z0 < 38 else 0), pupil)
        if brow is not None:
            g.box(FACE_X, EYE_Y + 3, z0 - 1, FACE_X + 1, EYE_Y + 4, z1 + 1, brow)
    if mouth is not None:
        g.box(FACE_X, MOUTH_Y, 38 - mouth_w // 2, FACE_X + 1, MOUTH_Y + 1, 38 + mouth_w // 2, mouth)
    return g


def band(mask: np.ndarray, axis: int, lo: int, hi: int) -> np.ndarray:
    idx = [np.arange(n) for n in mask.shape]
    sel = (idx[axis] >= lo) & (idx[axis] < hi)
    shape = [1, 1, 1]
    shape[axis] = -1
    return mask & sel.reshape(shape)
