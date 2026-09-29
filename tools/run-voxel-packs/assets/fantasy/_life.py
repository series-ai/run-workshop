"""Fantasy helpers for animated props, creatures and terrain (import as `_life`).

Pirate Nation style (docs/art-direction.md): few big volumes, true
slopes, detail painted on flat faces. Everything here fills a grid, paints
it and returns the mask it added. Grids use glTF axes: +Y up, the front is
-Z.

    prisms     side (across x), front (along z), plan (along y) from 2D polygons
    nature     trunk (a curved faceted trunk), limb (a sloped branch),
               leaf_block (a chamfered leaf clump), leaves (leaf paint),
               boulder (a faceted rock), crystal (a faceted gem spire)
    paint      facet_paint (a painter per face), bark, fur, rim_light, glow
    assets     rig (a part tree from grids in one shared frame), keys, pfx,
               asset (an Asset with the spec fields)
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnpaint
import pnshapes as S
from voxgrid import C, Asset, Clip, Grid, Part, Socket, pfx_binding

PACK = "fantasy"


# ------------------------------------------------------------------ grids
def coords(g: Grid):
    """Voxel-centre coordinates (x, y, z)."""
    return np.meshgrid(*(np.arange(n) + 0.5 for n in g.shape), indexing="ij")


def last(g: Grid) -> np.ndarray:
    return g.solids[-1].mask(g.shape)


def side(g: Grid, pts_yz, x0, x1, ramp: str, shade: int) -> np.ndarray:
    """A prism across x from a side-view polygon of (y, z) points."""
    g.prism("x", list(pts_yz), x0, x1, C(ramp, shade))
    return last(g)


def front(g: Grid, pts_xy, z0, z1, ramp: str, shade: int) -> np.ndarray:
    """A prism along z from a front-view polygon of (x, y) points."""
    g.prism("z", list(pts_xy), z0, z1, C(ramp, shade))
    return last(g)


def plan(g: Grid, pts_xz, y0, y1, ramp: str, shade: int, top=None) -> np.ndarray:
    """A prism along y from a plan polygon of (x, z) points; `top` makes a
    frustum (same point count)."""
    g.prism("y", list(pts_xz), y0, y1, C(ramp, shade), top=None if top is None else list(top))
    return last(g)


def ngon(cu: float, cv: float, r: float, n: int = 8, turn: float = 0.0, jitter=None) -> list[tuple[float, float]]:
    """A polygon of n corners at radius r (corner radius), turned by `turn`
    radians; `jitter` is a list of n radius factors for rough shapes."""
    out = []
    for k in range(n):
        a = turn + 2 * math.pi * k / n
        rr = r * (jitter[k] if jitter is not None else 1.0)
        out.append((cu + rr * math.cos(a), cv + rr * math.sin(a)))
    return out


def chamfer_rect(x0, z0, x1, z1, c: float) -> list[tuple[float, float]]:
    """A rectangle with its four corners cut by c (an octagon)."""
    return [(x0 + c, z0), (x1 - c, z0), (x1, z0 + c), (x1, z1 - c), (x1 - c, z1), (x0 + c, z1), (x0, z1 - c), (x0, z0 + c)]


# ------------------------------------------------------------------ paint
def facet_paint(g: Grid, solids, painter) -> None:
    """Call painter(g, mask, frame) for every face of the prisms."""
    for m, fr in S.facets(g, solids):
        painter(g, m, fr)


def fur(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, frame=None, seed: int = 0) -> None:
    pnpaint.fur(g, mask, ramp, base, frame=frame, seed=seed)


def bark(g: Grid, mask: np.ndarray, ramp: str = "wood", base: int = 3, frame=None, seed: int = 0) -> None:
    """Bark: vertical plates 2–3 wide with dark cracks and a few knots."""
    U, V = P.uv(g, frame)
    plate = U // 3
    shade = base + P._jitter(P._hash(plate, V // 5, seed=seed))
    shade = np.where(U % 3 == 0, base - 1, shade)
    knot = (P._hash(plate, V // 4, seed=seed + 1) % np.uint64(23)) == 0
    shade = np.where(knot & (V % 4 < 2), base - 2, shade)
    P._paint(g, mask, ramp, shade)


def up_faces(g: Grid, mask: np.ndarray) -> np.ndarray:
    """Voxels of `mask` with open air right above them."""
    occ = g.a > 0
    above = np.zeros_like(occ)
    above[:, :-1, :] = occ[:, 1:, :]
    return mask & ~above


def down_faces(g: Grid, mask: np.ndarray) -> np.ndarray:
    occ = g.a > 0
    below = np.zeros_like(occ)
    below[:, 1:, :] = occ[:, :-1, :]
    return mask & ~below


def foliage(g: Grid, mask: np.ndarray, ramp: str = "leaf", base: int = 4, frame=None, seed: int = 0) -> None:
    """PN painted foliage on one face: big soft leaf patches (3×3 cells of
    ±1 shade, most on the base), short lighter leaf dashes and a few darker
    gaps. Pass the face frame on slopes (see facet_paint) so the pattern
    follows the face; no per-voxel speckle (rule S3)."""
    U, V = P.uv(g, frame)
    cell = P._hash(U // 3, V // 3, seed=seed)
    shade = base + np.where(cell % np.uint64(5) == 0, 1, np.where(cell % np.uint64(7) == 0, -1, 0))
    dash = ((P._hash(U // 2, V // 2, seed=seed + 1) % np.uint64(6)) == 0) & (U % 2 == 0)
    shade = np.where(dash, base + 1, shade)
    gap = ((P._hash(U // 2, V // 3, seed=seed + 2) % np.uint64(13)) == 0) & (V % 3 == 0)
    shade = np.where(gap, base - 1, shade)
    if frame == "top":
        shade = shade + 1
    P._paint(g, mask, ramp, np.clip(shade, 1, 7))


def leaves(g: Grid, solids, ramp: str = "leaf", base: int = 4, seed: int = 0) -> None:
    """Paint foliage on every face of the prisms (see foliage)."""
    facet_paint(g, solids, lambda gg, mm, fr: foliage(gg, mm, ramp, base, frame=fr, seed=seed))


def rim_light(g: Grid, mask: np.ndarray, ramp: str, shade: int) -> None:
    """Light the top rim of a mask (voxels with air above)."""
    P.flat(g, up_faces(g, mask), ramp, shade)


def glow(g: Grid, mask: np.ndarray, centre, r: float, ramp: str, inner: int = 7, outer: int = 5) -> None:
    """A radial glow painted on a mask: `inner` at the centre, `outer` at r."""
    X, Y, Z = coords(g)
    d = np.sqrt((X - centre[0]) ** 2 + (Y - centre[1]) ** 2 + (Z - centre[2]) ** 2) / max(r, 1e-6)
    shade = np.clip(np.round(inner - (inner - outer) * d), min(inner, outer), max(inner, outer)).astype(np.int64)
    P._paint(g, mask, ramp, shade)


# ------------------------------------------------------------------ nature
def trunk(g: Grid, path, radii, ramp: str = "wood", base: int = 3, n: int = 6, turn: float = 0.3, seed: int = 0, paint: bool = True) -> np.ndarray:
    """A curved faceted trunk: stacked n-gon frustums through `path`
    ((x, y, z) points, y rising) with a corner radius per point. Each
    segment is a sheared frustum, so the trunk leans and bends with true
    slopes. Painted as bark along each facet."""
    if len(path) != len(radii) or len(path) < 2:
        raise ValueError("trunk needs matching path and radii (2+ points)")
    start = len(g.solids)
    m = np.zeros(g.shape, dtype=bool)
    for (p0, r0), (p1, r1) in zip(zip(path, radii), zip(path[1:], radii[1:])):
        if p1[1] <= p0[1]:
            raise ValueError("trunk path must rise")
        m |= plan(g, ngon(p0[0], p0[2], r0, n, turn), p0[1], p1[1], ramp, base, top=ngon(p1[0], p1[2], r1, n, turn))
    if paint:
        facet_paint(g, g.solids[start:], lambda gg, mm, fr: bark(gg, mm, ramp, base, frame=fr, seed=seed))
    return m


def limb(g: Grid, axis: str, p0, p1, r0: float, r1: float, lo, hi, ramp: str = "wood", base: int = 3, cap: float = 0.0, seed: int = 0) -> np.ndarray:
    """A sloped branch or limb: a thick 2D segment (half-widths r0 → r1) in
    the plane across `axis` ((y, z) for 'x', (x, y) for 'z'), extruded over
    [lo, hi). Painted as bark along its faces."""
    g.prism(axis, S.quad(p0, p1, r0, r1, cap=cap), lo, hi, C(ramp, base))
    m = last(g)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: bark(gg, mm, ramp, base, frame=fr, seed=seed))
    return m


def leaf_block(g: Grid, cx, cy, cz, sx, sy, sz, ramp: str = "leaf", base: int = 4, bevel: float = 2.0, lean=(0.0, 0.0), seed: int = 0, paint: bool = True) -> np.ndarray:
    """A PN leaf clump: a big chamfered block (octagon plan, bevelled top
    and bottom: true slopes) centred on (cx, cy, cz), size sx × sy × sz.
    `lean` shifts the top by (dx, dz) for a tilted clump."""
    b = min(bevel, sx / 3, sz / 3, sy / 3)
    x0, x1, z0, z1 = cx - sx / 2, cx + sx / 2, cz - sz / 2, cz + sz / 2
    y0, y1 = cy - sy / 2, cy + sy / 2
    lx, lz = lean
    outer = chamfer_rect(x0, z0, x1, z1, b)
    inner = chamfer_rect(x0 + b, z0 + b, x1 - b, z1 - b, max(0.5, b * 0.6))
    shift = lambda pts, f: [(u + lx * f, v + lz * f) for u, v in pts]  # noqa: E731
    fy = lambda y: (y - y0) / max(1e-6, y1 - y0)  # noqa: E731
    start = len(g.solids)
    m = plan(g, shift(inner, 0), y0, y0 + b, ramp, base, top=shift(outer, fy(y0 + b)))
    m |= plan(g, shift(outer, fy(y0 + b)), y0 + b, y1 - b, ramp, base, top=shift(outer, fy(y1 - b)))
    m |= plan(g, shift(outer, fy(y1 - b)), y1 - b, y1, ramp, base, top=shift(inner, 1))
    if paint:
        leaves(g, g.solids[start:], ramp, base, seed=seed)
        _X, Y, _Z = coords(g)
        P.flat(g, m & (Y < y0 + 1), ramp, max(1, base - 1))
    return m


def rockface(g: Grid, mask: np.ndarray, ramp: str = "stone", base: int = 4, frame=None, seed: int = 0) -> None:
    """Natural rock on one face: big irregular patches (4×3 cells of ±1
    shade, merged by pairs), a few long dark cracks that run down the face,
    and a lighter upper edge. Pass the face frame on slopes."""
    U, V = P.uv(g, frame)
    cell = P._hash((U + (V // 3) % 2 * 2) // 4, V // 3, seed=seed)
    shade = base + np.where(cell % np.uint64(4) == 0, 1, np.where(cell % np.uint64(5) == 0, -1, 0))
    crack_u = (P._hash(U // 5, seed=seed + 3) % np.uint64(5)) == 0
    crack = crack_u & (((U + V // 2) % 5) == 0) & ((P._hash(U // 5, V // 6, seed=seed + 4) % np.uint64(2)) == 0)
    shade = np.where(crack, base - 2, shade)
    P._paint(g, mask, ramp, np.clip(shade, 1, 7))


def boulder(g: Grid, cx, cz, y0, r: float, h: float, ramp: str = "stone", base: int = 4, n: int = 7, seed: int = 0, belly: float = 1.12, top: float = 0.55, lean=(0.0, 0.0), squash=(1.0, 1.0), moss: str | None = "moss", moss_drape: float = 0.3, paint: bool = True) -> np.ndarray:
    """A faceted rock: an irregular n-gon footprint that swells to a belly at
    40% of its height and narrows to a smaller, shifted top (two stacked
    frustums, all true slopes). Painted as big stone blocks per facet with
    cracks, lit top faces and moss on top when `moss`."""
    rng = np.random.default_rng(seed)
    jit = list(0.8 + 0.4 * rng.random(n))
    turn = float(rng.uniform(0, math.pi))
    sx, sz = squash

    def ring(rad, dx=0.0, dz=0.0):
        pts = ngon(0, 0, rad, n, turn, jit)
        return [(cx + u * sx + dx, cz + v * sz + dz) for u, v in pts]

    yb = y0 + h * 0.4
    lx, lz = lean
    start = len(g.solids)
    m = plan(g, ring(r), y0, yb, ramp, base, top=ring(r * belly, lx * 0.4, lz * 0.4))
    m |= plan(g, ring(r * belly, lx * 0.4, lz * 0.4), yb, y0 + h, ramp, base, top=ring(r * top, lx, lz))
    if paint:
        _X, Y, _Z = coords(g)
        Xi, Zi = np.meshgrid(np.arange(g.shape[0]), np.arange(g.shape[2]), indexing="ij")

        caps = np.zeros(g.shape, dtype=bool)

        def painter(gg, mm, fr):
            if fr == "top" and moss and float(Y[mm].mean()) > y0 + h * 0.5:
                caps[mm] = True
                P.flat(gg, mm, moss, 5)
                patch = (P._hash(Xi // 3, Zi // 3, seed=seed + 5) % np.uint64(3)) == 0
                P.flat(gg, mm & patch[:, None, :], moss, 6)
            elif fr == "top":
                P.flat(gg, mm, ramp, max(1, base - 1))
            else:
                rockface(gg, mm, ramp, base, frame=fr, seed=seed)

        facet_paint(g, g.solids[start:], painter)
        P.flat(g, m & S.seams(g, g.solids[start:], 0.8), ramp, min(7, base + 1))
        if moss:  # moss drapes over the upper slopes with a wavy lower edge (bands, not speckle)
            X, _Y, Z = coords(g)
            sector = np.floor((np.arctan2(Z - cz, X - cx) + math.pi) * 3).astype(int)
            drip = (P._hash(sector, seed=seed + 9) % np.uint64(3)).astype(float)
            drape = m & ~caps & (Y > y0 + h * (1.0 - moss_drape) - drip * 1.5)
            P.flat(g, drape, moss, 4)
            P.flat(g, drape & (Y > y0 + h - 2.5), moss, 5)
    return m


def crystal(g: Grid, cx, cz, y0, r: float, h: float, tip: float, ramp: str = "cyan", base: int = 5, n: int = 6, lean=(0.0, 0.0), turn: float = 0.0, paint: bool = True) -> np.ndarray:
    """A faceted gem spire: an n-sided prism that leans by `lean` (dx, dz)
    over its height h, with a pointed tip `tip` tall. Facets alternate
    light and dark, with a bright edge line and a glint (painted)."""
    lx, lz = lean
    f = h / (h + tip)
    start = len(g.solids)
    body = ngon(cx, cz, r, n, turn)
    mid = [(u + lx * f, v + lz * f) for u, v in body]
    m = plan(g, body, y0, y0 + h, ramp, base, top=mid)
    m |= plan(g, mid, y0 + h, y0 + h + tip, ramp, base, top=[(cx + lx, cz + lz)] * n)
    if paint:
        k = [0]

        def painter(gg, mm, fr):
            s = base + (1 if k[0] % 2 == 0 else -1) if fr != "top" else base + 2
            k[0] += 1
            P.flat(gg, mm, ramp, max(1, min(7, s)))

        facet_paint(g, g.solids[start:], painter)
        P.flat(g, m & S.seams(g, g.solids[start:], 0.7), ramp, 7)
    return m


def grass(g: Grid, pts, ramp: str = "leaf", base: int = 5) -> np.ndarray:
    """Small grass tufts (three blades of 2–4 voxels) at (x, y, z) points."""
    m = np.zeros(g.shape, dtype=bool)
    for x, y, z in pts:
        for dx, dz, th in ((0, 0, 4), (1, 1, 2), (-1, 1, 3)):
            g.box(x + dx, y, z + dz, x + dx + 1, y + th, z + dz + 1, C(ramp, base + th % 2))
            m[max(0, x + dx), y : y + th, max(0, z + dz)] = True
    return m


# ------------------------------------------------------------------ assets
def keys(*pairs):
    """[(t, (x, y, z)), ...] from (t, x, y, z) tuples."""
    return [(t, (a, b, c)) for t, a, b, c in pairs]


def pfx(effect: str, socket: str, trigger: str = "idle", **kw) -> dict:
    return pfx_binding(effect, socket, trigger, **kw)


def rig(parts: list):
    """A part tree from grids in ONE shared frame. parts = [(name, grid,
    hinge, parent), ...]; the first is the root (its hinge is ignored).
    `hinge` is the part origin in the shared frame; `parent` an earlier
    part name (None = the root). Grids are cropped to the union bounds (the
    prisms move with them). Returns (root, to_root) where to_root maps a
    shared-frame point to root pivot space (for sockets)."""
    shape = next(g.shape for _, g, _, _ in parts if g is not None)
    lo, hi = [10**9] * 3, [-1] * 3
    for _, g, _, _ in parts:
        if g is None:
            continue
        if g.shape != shape:
            raise ValueError("rig: every grid must share one shape")
        nz = np.nonzero(g.a)
        if len(nz[0]) == 0:
            raise ValueError("rig: a part grid is empty")
        for ax in range(3):
            lo[ax] = min(lo[ax], int(nz[ax].min()))
            hi[ax] = max(hi[ax], int(nz[ax].max()) + 1)
    root_pivot = ((lo[0] + hi[0]) / 2, float(lo[1]), (lo[2] + hi[2]) / 2)

    def local(p):
        return (p[0] - lo[0], p[1] - lo[1], p[2] - lo[2])

    def crop(g):
        return None if g is None else g.crop(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2])

    name0, g0, _, _ = parts[0]
    root = Part(name0, crop(g0), pivot=local(root_pivot))
    nodes, pivots = {name0: root}, {name0: root_pivot}
    for name, g, hinge, parent in parts[1:]:
        par = parent or name0
        if par not in nodes:
            raise ValueError(f"rig: parent {par!r} of {name!r} is not defined before it")
        pp = pivots[par]
        node = Part(name, crop(g), pivot=local(hinge), at=(hinge[0] - pp[0], hinge[1] - pp[1], hinge[2] - pp[2]))
        nodes[par].add(node)
        nodes[name], pivots[name] = node, hinge

    def to_root(p):
        return (p[0] - root_pivot[0], p[1] - root_pivot[1], p[2] - root_pivot[2])

    return root, to_root


def asset(category: str, slug: str, name: str, root: Part, clips=(), sockets=(), fx=()) -> Asset:
    return Asset(id=f"{PACK}-{category}-{slug}", pack=PACK, category=category, name=name, root=root, clips=list(clips), sockets=list(sockets), pfx=list(fx))


__all__ = [
    "PACK", "coords", "last", "side", "front", "plan", "ngon", "chamfer_rect", "facet_paint", "fur", "bark", "up_faces", "down_faces",
    "foliage", "leaves", "rockface", "rim_light", "glow", "trunk", "limb", "leaf_block", "boulder", "crystal", "grass", "keys", "pfx", "rig", "asset",
    "Clip", "Socket", "Grid", "C",
]
