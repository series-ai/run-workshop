"""Apocalypse props helpers (scope: assets/apocalypse/props).

Pirate Nation style (docs/art-direction.md): few chunky volumes,
true slopes, detail painted on flat faces. These helpers wrap the shared
kit (pnkit, pnshapes, pnpaint, pnglyph, paint) with the shapes the props
need again and again: bevelled boxes, pillows (sandbags, bags, bedrolls),
faceted rocks, sharpened stakes, grass tufts, jerry cans and pallets.
Helpers marked "(kit candidate)" would suit the shared kit.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnpaint
from pnkit import box, edges
from pnshapes import coords, last, quad, rotate
from voxgrid import C, Asset, Grid, Part, bounds_pivot

PACK = "apocalypse"


# ------------------------------------------------------------------ asset
def asset(slug: str, name: str, root: Part, clips=(), sockets=(), pfx=()) -> Asset:
    """A props asset with the id apocalypse-props-<slug>."""
    return Asset(id=f"{PACK}-props-{slug}", pack=PACK, category="props", name=name, root=root, clips=list(clips), sockets=list(sockets), pfx=list(pfx))


def root(slug: str, g: Grid) -> Part:
    """The root part: the grid with its bottom-centre pivot."""
    return Part(slug, g, pivot=bounds_pivot(g))


def child(parent: Part, name: str, g: Grid, pivot, at_grid, rot=(0.0, 0.0, 0.0)) -> Part:
    """Add a child part whose pivot (in its own grid) sits at `at_grid`, a
    point in the PARENT grid's voxel coordinates."""
    px, py, pz = parent.pivot
    return parent.add(Part(name, g, pivot=tuple(float(c) for c in pivot), at=(at_grid[0] - px, at_grid[1] - py, at_grid[2] - pz), rot=tuple(float(r) for r in rot)))


# ------------------------------------------------------------------ shapes
def bevel(g: Grid, axis: str, a0, b0, a1, b1, lo, hi, ramp: str, base: int = 4, ch: float = 1.0) -> np.ndarray:
    """A box along `axis` whose four long edges are chamfered by `ch` (an
    octagon cross-section in the PRISM_PLANE (a, b) of the axis): chunky PN
    bevels as true 45° facets. (kit candidate)"""
    pts = [(a0 + ch, b0), (a1 - ch, b0), (a1, b0 + ch), (a1, b1 - ch), (a1 - ch, b1), (a0 + ch, b1), (a0, b1 - ch), (a0, b0 + ch)]
    g.prism(axis, pts, lo, hi, C(ramp, base))
    return last(g)


def pillow(g: Grid, cx, cz, y0, length, width, h, angle: float = 0.0, ramp: str = "sand", base: int = 5, puff: float = 1.5, bulge: bool = False, chamfer: float | None = None) -> np.ndarray:
    """A stuffed bag lying on y0 (sandbag, trash bag, bedroll, pillow): a
    chamfered slab in plan, turned `angle` degrees about y, whose top is
    inset by `puff` on every side, so all its sides are true slopes. With
    `bulge`, the bottom is inset too (two frustums meet at mid height), so
    the bag reads as a soft pillow. (kit candidate)"""
    hl, hw = length / 2, width / 2
    c = min(hw * 0.6, 1.8) if chamfer is None else chamfer
    plan = [(-hl + c, -hw), (hl - c, -hw), (hl, -hw + c), (hl, hw - c), (hl - c, hw), (-hl + c, hw), (-hl, hw - c), (-hl, -hw + c)]
    top = [(u * (hl - puff) / hl, v * (hw - puff * 0.8) / hw) for u, v in plan]
    turn = lambda pts: [(cx + x, cz + z) for x, z in rotate(pts, 0, 0, angle)]  # noqa: E731
    if not bulge:
        g.prism("y", turn(plan), y0, y0 + h, C(ramp, base), top=turn(top))
        return last(g)
    low = [(u * (hl - puff * 0.5) / hl, v * (hw - puff * 0.4) / hw) for u, v in plan]
    mid = y0 + h * 0.45
    g.prism("y", turn(low), y0, mid, C(ramp, base), top=turn(plan))
    m = last(g)
    g.prism("y", turn(plan), mid, y0 + h, C(ramp, base), top=turn(top))
    return m | last(g)


def rock(g: Grid, cx, cz, y0, r, h, n: int = 6, seed: int = 0, ramp: str = "stone", base: int = 5, top_frac: float = 0.55) -> np.ndarray:
    """A faceted rock: an irregular n-gon frustum (true slopes), painted
    with soft ±1 facets and a lit top. (kit candidate)"""
    rng = np.random.default_rng(seed)
    a0 = rng.uniform(0, math.pi)
    plan, top = [], []
    for k in range(n):
        a = a0 + 2 * math.pi * k / n + rng.uniform(-0.25, 0.25)
        rr = r * rng.uniform(0.8, 1.05)
        plan.append((cx + rr * math.cos(a), cz + rr * math.sin(a)))
        tr = rr * top_frac * rng.uniform(0.8, 1.1)
        top.append((cx + tr * math.cos(a + 0.2) + rng.uniform(-0.6, 0.6), cz + tr * math.sin(a + 0.2) + rng.uniform(-0.6, 0.6)))
    g.prism("y", plan, y0, y0 + h, C(ramp, base), top=top)
    m = last(g)
    P.mottle(g, m, ramp, base, cell=3, seed=seed)
    _X, Y, _Z = coords(g)
    P.flat(g, m & (Y > y0 + h - 1.2), ramp, min(7, base + 1))
    P.flat(g, m & (Y < y0 + 1), ramp, max(1, base - 1))
    return m


def stake(g: Grid, axis: str, p0, p1, r: float, lo, hi, ramp: str = "wood", base: int = 5, tip=("bone", 6), cap: float = 2.2) -> np.ndarray:
    """A sharpened stake from p0 to a point beyond p1 (PRISM_PLANE order),
    a true diagonal; the pointed end is painted `tip` (None: keep wood). (kit candidate)"""
    g.prism(axis, quad(p0, p1, r) if cap <= 0 else _pointed(p0, p1, r, cap), lo, hi, C(ramp, base))
    m = last(g)
    if tip:
        u = {"x": 1, "y": 0, "z": 0}[axis]
        v = {"x": 2, "y": 2, "z": 1}[axis]
        cc = coords(g)
        U, V = cc[u], cc[v]
        d = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        along = ((U - p0[0]) * (p1[0] - p0[0]) + (V - p0[1]) * (p1[1] - p0[1])) / d
        P.flat(g, m & (along > d - 0.5), *tip)
    return m


def _pointed(p0, p1, r, cap):
    """A thick segment p0 → p1 with a pointed end `cap`·r beyond p1."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    nx, ny = -uy, ux
    return [(p0[0] + nx * r, p0[1] + ny * r), (p1[0] + nx * r, p1[1] + ny * r), (p1[0] + ux * cap * r, p1[1] + uy * cap * r), (p1[0] - nx * r, p1[1] - ny * r), (p0[0] - nx * r, p0[1] - ny * r)]


def tuft(g: Grid, x: int, z: int, y0: int = 0, ramp: str = "khaki", seed: int = 0) -> np.ndarray:
    """A PN grass tuft: three thin blades of 2–4 voxels in two tones."""
    m = np.zeros(g.shape, dtype=bool)
    for k, (dx, dz, th) in enumerate(((0, 0, 4), (1, 1, 2), (-1, 1, 3))):
        th = th - (seed + k) % 2
        m |= box(g, x + dx, y0, z + dz, x + dx + 1, y0 + th, z + dz + 1, ramp, 4 + (th + seed) % 2)
    return m


def pallet(g: Grid, x0, y0, z0, w: int = 24, d: int = 24, ramp: str = "wood", base: int = 5, seed: int = 0) -> np.ndarray:
    """A shipping pallet, 4 tall: a top deck of boards along x with gaps,
    three runner blocks under it (the gaps between them read as the fork
    slots). Returns the mask."""
    m = np.zeros(g.shape, dtype=bool)
    for k, bz in enumerate((z0, z0 + d // 2 - 1, z0 + d - 3)):
        for bx in (x0, x0 + w // 2 - 2, x0 + w - 4):
            m |= box(g, bx, y0, bz, bx + 4, y0 + 2, bz + 3, ramp, base - 1)
        m |= box(g, x0, y0 + 2, bz, x0 + w, y0 + 3, bz + 3, ramp, base - 1)
    deck = np.zeros(g.shape, dtype=bool)
    step = 4
    for bz in range(z0, z0 + d - 2, step):
        deck |= box(g, x0, y0 + 3, bz, x0 + w, y0 + 4, min(z0 + d, bz + 3), ramp, base)
    deck |= box(g, x0, y0 + 3, z0 + d - 3, x0 + w, y0 + 4, z0 + d, ramp, base)
    P.planks(g, deck, ramp, base, width=3, across="z", length=(w + 1, w + 2), seed=seed, frame="top")
    P.planks(g, m, ramp, base - 1, width=2, across="y", length=(8, 12), nails=False, seed=seed + 1)
    return m | deck


def jerry_can(g: Grid, x0, y0, z0, w: int = 11, h: int = 14, d: int = 6, ramp: str = "red", base: int = 4, seed: int = 0) -> np.ndarray:
    """A jerry can standing on y0, its broad side facing -z: a bevelled
    slab with a painted pressed X, a weld seam, three top handles and a
    spout cap. Returns the body mask."""
    body = bevel(g, "z", x0, y0, x0 + w, y0 + h, z0, z0 + d, ramp, base, ch=1.5)
    X, Y, Z = coords(g)
    face = body & ((Z < z0 + 1) | (Z > z0 + d - 1))
    # the pressed X on both broad faces (a light and a dark edge)
    u = (X - x0) / w
    v = (Y - y0) / h
    xs = (np.abs(u - v) < 0.09) | (np.abs(u - (1 - v)) < 0.09)
    inner = (u > 0.14) & (u < 0.86) & (v > 0.1) & (v < 0.86)
    P.outline(g, face & inner, ramp, max(1, base - 1), normal="z")
    P.flat(g, face & xs & inner, ramp, min(7, base + 2))
    P.flat(g, body & (Y > y0 + h - 1.5), ramp, min(7, base + 1))
    # weld seam round the middle of the depth
    P.flat(g, body & (np.abs(Z - (z0 + d / 2)) < 0.5), ramp, max(1, base - 2))
    # handles: three bars across the top, and the spout cap at the front corner
    for k in range(3):
        hx = x0 + 1.5 + k * (w - 5) / 2
        box(g, hx, y0 + h, z0 + 1, hx + 2, y0 + h + 2, z0 + d - 1, ramp, max(1, base - 1))
    # the spout: a short true-diagonal neck and a cap, at the +x top corner
    g.prism("z", quad((x0 + w - 2.5, y0 + h - 1.5), (x0 + w + 0.5, y0 + h + 2.0), 1.5), z0 + d / 2 - 1.5, z0 + d / 2 + 1.5, C("steel", 5))
    P.flat(g, last(g), "steel", 5)
    box(g, x0 + w - 1, y0 + h + 1, z0 + d // 2 - 2, x0 + w + 2, y0 + h + 3, z0 + d // 2 + 2, "gold", 5)
    return body


def crate(g: Grid, x0, y0, z0, w, h, d, ramp: str = "sand", base: int = 5, frame=("rust", 3), seed: int = 0) -> np.ndarray:
    """A warm plank crate (PN chest wood): boards across y with nail dots,
    and a darker frame on every edge (rule S4). Returns the mask."""
    m = box(g, x0, y0, z0, x0 + w, y0 + h, z0 + d, ramp, base)
    P.planks(g, m, ramp, base, width=max(3, min(w, h) // 4), across="y", nails=True, seed=seed)
    P.flat(g, edges(m), *frame)
    X, Y, Z = coords(g)
    lid = m & (Y > y0 + h - 1)
    P.planks(g, lid & ~edges(m), ramp, base + 1, width=4, across="z" if w >= d else "x", nails=True, frame="top", seed=seed + 1)
    return m


def hazard_band(g: Grid, mask: np.ndarray, period: int = 6, frame=None) -> None:
    """Gold and dark hazard stripes (PN warning paint)."""
    pnpaint.hazard(g, mask, period=period, a=("gold", 5), b=("darkwood", 4), frame=frame)


# ------------------------------------------------------------- weathering
def _hash3(g: Grid, seed: int) -> np.ndarray:
    """A deterministic per-voxel hash of the grid coordinates."""
    X, Y, Z = coords(g)
    return P._hash(np.floor(X).astype(np.int64), np.floor(Y).astype(np.int64), np.floor(Z).astype(np.int64), seed=seed)


def rust_wear(g: Grid, mask: np.ndarray, seed: int = 0, shade: int = 4, run: int = 4, grime: int = 4, ramp: str = "rust") -> np.ndarray:
    """Deliberate corrosion on a painted metal volume (rules S1–S3): copper
    wear broken along the volume's own edges, short run-off streaks bleeding
    down from them and dirt at its foot. The rust follows the form, so it
    never reads as speckle scattered over a whole face. Returns the mask it
    painted."""
    rim = edges(mask)
    h = _hash3(g, seed)
    worn = rim & ((h % np.uint64(4)) == np.uint64(0))
    P.flat(g, worn, ramp, shade)
    P.flat(g, rim & ((h % np.uint64(13)) == np.uint64(0)), ramp, max(1, shade - 2))
    streak = np.zeros(g.shape, dtype=bool)
    src = worn
    for _ in range(run):
        src = np.roll(src, -1, axis=1)
        src[:, -1, :] = False
        streak |= src
    keep = (_hash3(g, seed + 11) % np.uint64(4)) == np.uint64(0)
    P.flat(g, streak & mask & ~rim & keep, ramp, max(1, shade - 1))
    if grime:
        P.grime(g, mask, height=grime, seed=seed + 5)
    return worn | (streak & mask)


def chips(g: Grid, mask: np.ndarray, spots, ramp: str = "rust", base: int = 5, seed: int = 0) -> np.ndarray:
    """A few chunky chipped-paint patches placed by hand: `spots` are
    (x, y, z, r) blobs with a ragged border and a darker rim, so the wear
    reads as bare metal under paint and not as a tidy rectangle."""
    out = np.zeros(g.shape, dtype=bool)
    X, Y, Z = coords(g)
    for k, (cx, cy, cz, r) in enumerate(spots):
        wob = (_hash3(g, seed + k) % np.uint64(3)).astype(float) * 0.55
        blob = mask & (np.sqrt((X - cx) ** 2 + (Y - cy) ** 2 + (Z - cz) ** 2) < r - wob)
        P.flat(g, blob, ramp, base)
        P.outline(g, blob, ramp, max(1, base - 2))
        out |= blob
    return out


def weeds(g: Grid, x: int, z: int, seed: int = 0, ramp: str = "khaki", pad: int = 5, dirt: str = "wood") -> np.ndarray:
    """A grass clump on its own patch of dust, so it reads as grounded
    rather than as loose cubes floating beside the prop."""
    m = box(g, x - 1, 0, z - 1, x - 1 + pad, 1, z - 1 + pad, dirt, 3)
    P.mottle(g, m, dirt, 3, cell=2, seed=seed)
    P.flat(g, edges(m), dirt, 2)
    return m | tuft(g, x, z, y0=1, ramp=ramp, seed=seed)


def rubble(g: Grid, cx, cz, y0: int = 0, r: float = 3.0, h: float = 3.0, seed: int = 0, ramp: str = "stone", base: int = 5) -> np.ndarray:
    """A chunk of broken concrete at a base: a faceted rock with painted
    block divisions, so bases read as dressed like the house assets."""
    m = rock(g, cx, cz, y0, r, h, n=6, seed=seed, ramp=ramp, base=base)
    P.flat(g, edges(m), ramp, max(1, base - 2))
    return m


def rust_runs(g: Grid, mask: np.ndarray, spots, ramp: str = "rust", base: int = 5, drip: int = 6, seed: int = 0) -> np.ndarray:
    """Hand-placed corrosion (rules S1–S3): a few chunky blooms with one
    solid run-off tail under each, so the wear sits where water would sit
    and no face ever carries scattered speckle. `spots` are (x, y, z, r).
    Prefer this to `rust_wear` on a volume the camera sees up close."""
    X, Y, Z = coords(g)
    out = chips(g, mask, spots, ramp=ramp, base=base, seed=seed)
    for cx, cy, cz, r in spots:
        if drip <= 0:
            break
        w = max(1.0, r * 0.4)
        tail = mask & (np.abs(X - cx) < w) & (np.abs(Z - cz) < w) & (Y < cy) & (Y > cy - drip)
        P.flat(g, tail, ramp, max(1, base - 1))
        out |= tail
    return out


def seam_rust(g: Grid, mask: np.ndarray, ys, ramp: str = "rust", shade: int = 4, thick: float = 1.0) -> np.ndarray:
    """Unbroken rust lines along the horizontal seams of a volume (rule
    S4): the corrosion follows a construction line instead of speckling a
    whole face, so long stretches of clean paint survive."""
    _X, Y, _Z = coords(g)
    out = np.zeros(g.shape, dtype=bool)
    for y in ys:
        line = mask & (np.abs(Y - y) < thick)
        P.flat(g, line, ramp, shade)
        out |= line
    return out
