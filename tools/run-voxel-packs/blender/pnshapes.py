"""Solid shapes for world assets in the Pirate Nation style (all packs).

Big faceted solids with true slopes (rules F1, F2): every shape here is
one or more exact prisms (Grid.prism), so its faces slope and its detail is
paint (rule S1). Colours are (ramp, shade) pairs or a ramp and a `base`
shade. Every shape fills the grid, paints itself and returns the mask of the
voxels it added; `wheel` and `lantern` return a dict with the mask and the
points you place parts by.

Conventions:
- Round shapes are regular n-gons. `r` is the FLAT radius (the centre to
  the middle of a side), so a shape of radius r is exactly 2r across its
  flats, and a wheel of radius r whose centre is r above y0 stands on y0
  with a flat side (no gap, no sinking). `corner(r, n)` is the corner radius.
- Axis shapes take (axis, cu, cv, r, lo, hi): (cu, cv) is the centre in the
  plane across `axis` in x, y, z order ((y, z) for 'x', (x, z) for 'y',
  (x, y) for 'z'), and [lo, hi) the extent along it.
- Upright shapes take (cx, cz, y0, h) or a box (x0, z0, x1, z1, y0, h).
- `facets(g, solids)` splits prisms into their faces, each with a paint
  frame (u along the face, v down the slope), so any painter can follow a
  slope: `for m, fr in facets(g): paint.tiles(g, m, "red", 4, frame=fr)`.

Faces for painted glyphs are the pnkit faces ('-z' is the front).
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
from pnkit import box, edges
from voxgrid import C, PRISM_PLANE, Grid, _AXIS_INDEX

# The angle (in the prism plane) that points down (-y); for 'y' it points to the front (-z).
_DOWN = {"x": math.pi, "z": -math.pi / 2, "y": -math.pi / 2}


# ------------------------------------------------------------------ helpers
def coords(g: Grid):
    """Voxel-centre coordinates (x, y, z), each 0.5 more than the index."""
    return np.meshgrid(*(np.arange(n) + 0.5 for n in g.shape), indexing="ij")


def _idx(g: Grid):
    """Integer voxel indices (x, y, z)."""
    return np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")


def last(g: Grid) -> np.ndarray:
    """Mask of the prism added last."""
    return g.solids[-1].mask(g.shape)


def corner(r: float, n: int) -> float:
    """Corner radius of an n-gon whose flat radius is r."""
    return r / math.cos(math.pi / n)


def flat_ngon(cu: float, cv: float, r: float, n: int = 8, facing: float = -math.pi / 2) -> list[tuple[float, float]]:
    """Regular n-gon with flat radius r and a flat side facing the angle
    `facing` (radians, in the (u, v) plane). Counter-clockwise."""
    R = corner(r, n)
    a0 = facing + math.pi / n
    # rounded, so a side on a grid line stays exactly on it (no -1e-15 overhang)
    return [(round(cu + R * math.cos(a0 + 2 * math.pi * k / n), 9), round(cv + R * math.sin(a0 + 2 * math.pi * k / n), 9)) for k in range(n)]


def _plane(g: Grid, axis: str):
    """Voxel-centre coordinates (u, v, t) for an axis (PRISM_PLANE order)."""
    X, Y, Z = coords(g)
    return {"x": (Y, Z, X), "y": (X, Z, Y), "z": (X, Y, Z)}[axis]


def radial(g: Grid, axis: str, cu, cv) -> np.ndarray:
    """Distance of every voxel centre from the line through (cu, cv) along `axis`."""
    U, V, _T = _plane(g, axis)
    return np.hypot(U - cu, V - cv)


def ngon_radius(g: Grid, axis: str, cu, cv, n: int = 8, facing: float | None = None) -> np.ndarray:
    """The n-gon 'radius' of every voxel centre: a voxel lies inside a
    flat_ngon of flat radius r exactly when this is at most r. Use it to
    paint rings and bands that follow the facets."""
    U, V, _T = _plane(g, axis)
    facing = _DOWN[axis] if facing is None else facing
    du, dv = U - cu, V - cv
    return np.max([du * math.cos(facing + 2 * math.pi * k / n) + dv * math.sin(facing + 2 * math.pi * k / n) for k in range(n)], axis=0)


def _angle(g: Grid, axis: str, cu, cv) -> np.ndarray:
    U, V, _T = _plane(g, axis)
    return np.arctan2(V - cv, U - cu)


def _fit(g: Grid, axis: str, lo: float, hi: float, out: float) -> tuple[float, float]:
    """[lo - out, hi + out], clipped to the grid along `axis`."""
    n = g.shape[_AXIS_INDEX[axis]]
    return max(0.0, lo - out), min(float(n), hi + out)


# ------------------------------------------------------------------ facets
def _newell(pts) -> np.ndarray:
    n = np.zeros(3)
    for k in range(len(pts)):
        n += np.cross(pts[k], pts[(k + 1) % len(pts)])
    return n


def _area(poly) -> float:
    return abs(sum(poly[k][0] * poly[(k + 1) % len(poly)][1] - poly[(k + 1) % len(poly)][0] * poly[k][1] for k in range(len(poly)))) / 2


def _faces_of(solid) -> list[tuple[np.ndarray, np.ndarray, bool]]:
    """Face planes (outward normal, point, is_cap) of a prism."""
    t = _AXIS_INDEX[solid.axis]
    ua, va = PRISM_PLANE[solid.axis]

    def at(p, tv):
        q = np.zeros(3)
        q[ua], q[va], q[t] = p[0], p[1], tv
        return q

    low = [at(p, solid.lo) for p in solid.poly]
    high = [at(p, solid.hi) for p in solid.upper]
    centre = (np.mean(low, axis=0) + np.mean(high, axis=0)) / 2
    out = []
    k = len(low)
    for e in range(k):
        quad = [low[e], low[(e + 1) % k], high[(e + 1) % k], high[e]]
        n = _newell(quad)
        if np.linalg.norm(n) < 1e-9:
            continue
        n = n / np.linalg.norm(n)
        p0 = np.mean(quad, axis=0)
        if float((p0 - centre) @ n) < 0:
            n = -n
        out.append((n, p0, False))
    e_t = np.zeros(3)
    e_t[t] = 1.0
    if _area(solid.upper) > 1e-9:
        out.append((e_t, np.mean(high, axis=0), True))
    if _area(solid.poly) > 1e-9:
        out.append((-e_t, np.mean(low, axis=0), True))
    return out


def frame_of(normal) -> str | tuple:
    """The paint.uv frame of a face with this outward normal: 'top' for
    flat faces, else (u, v) with u level along the face and v down it."""
    n = np.asarray(normal, dtype=float)
    if abs(n[1]) > 0.999:
        return "top"
    u = np.array([n[2], 0.0, -n[0]])
    u /= np.linalg.norm(u)
    v = np.cross(n, u)
    if v[1] > 0:
        v = -v
    return (tuple(float(c) for c in u), tuple(float(c) for c in v))


def _owners(g: Grid, solids):
    solids = [g.solids[-1]] if solids is None else list(solids)
    if not solids:
        raise ValueError("facets needs at least one prism")
    masks = [s.mask(g.shape) for s in solids]
    union = np.logical_or.reduce(masks)
    idx = np.nonzero(union)
    pts = np.stack(idx, axis=1) + 0.5
    occ = g.a > 0
    best = np.full(len(pts), -np.inf)
    second = np.full(len(pts), -np.inf)
    owner = np.full(len(pts), -1)
    normals = []
    for s, m in zip(solids, masks):
        inside = m[idx]
        for n, p0, cap in _faces_of(s):
            if cap:  # a cap against other voxels is inside the model: never the visible face
                probe = np.floor(p0 + 0.5 * n).astype(int)
                if np.all((probe >= 0) & (probe < np.array(g.shape))) and occ[tuple(probe)]:
                    continue
            # rim voxels show on a cap and on a side: the side (the slope) wins
            d = np.where(inside, (pts - p0) @ n - (0.5 if cap else 0.0), -np.inf)
            better = d > best
            second = np.where(better, best, np.maximum(second, d))
            best = np.where(better, d, best)
            owner = np.where(better, len(normals), owner)
            normals.append(n)
    return idx, owner, best, second, normals


def facets(g: Grid, solids=None) -> list[tuple[np.ndarray, str | tuple]]:
    """Split prisms (default: the last one) into their visible faces: a list
    of (mask, frame), one per face, each voxel going to the face it is
    closest to. Paint each mask with its frame so patterns follow the slope."""
    idx, owner, _best, _second, normals = _owners(g, solids)
    out = []
    for k, n in enumerate(normals):
        sel = owner == k
        if not sel.any():
            continue
        m = np.zeros(g.shape, dtype=bool)
        m[tuple(i[sel] for i in idx)] = True
        out.append((m, frame_of(n)))
    return out


def seams(g: Grid, solids=None, width: float = 1.0) -> np.ndarray:
    """Voxels within `width` of two faces of the prisms: hips, ridges and
    the corner lines of domes and cones (paint them as ribs or trims)."""
    idx, _owner, _best, second, _normals = _owners(g, solids)
    m = np.zeros(g.shape, dtype=bool)
    sel = second > -width
    m[tuple(i[sel] for i in idx)] = True
    return m


def paint_facets(g: Grid, solids, painter) -> None:
    """Call painter(g, mask, frame) for every face of the prisms."""
    for m, fr in facets(g, solids):
        painter(g, m, fr)


# ------------------------------------------------------------------ 2D polygons
def quad(p0, p1, r0: float, r1: float | None = None, cap: float = 0.0) -> list[tuple[float, float]]:
    """A thick 2D segment from p0 to p1 (half-widths r0 → r1); a hexagon
    with pointed ends when `cap` > 0. Faceted limbs, horns, claws."""
    r1 = r0 if r1 is None else r1
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(dx, dy)
    if n < 1e-9:
        raise ValueError("quad needs two different points")
    ux, uy = dx / n, dy / n
    nx, ny = -uy, ux
    pts = [(p0[0] + nx * r0, p0[1] + ny * r0), (p1[0] + nx * r1, p1[1] + ny * r1)]
    if cap:
        pts.append((p1[0] + ux * cap * r1, p1[1] + uy * cap * r1))
    pts += [(p1[0] - nx * r1, p1[1] - ny * r1), (p0[0] - nx * r0, p0[1] - ny * r0)]
    if cap:
        pts.append((p0[0] - ux * cap * r0, p0[1] - uy * cap * r0))
    return pts


def rotate(pts, cx: float, cy: float, degrees: float) -> list[tuple[float, float]]:
    """Rotate 2D points about (cx, cy), counter-clockwise in degrees."""
    a = math.radians(degrees)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * ca - (y - cy) * sa, cy + (x - cx) * sa + (y - cy) * ca) for x, y in pts]


def arch(cx: float, y0: float, half: float, top: float, bulge: float = 1.0) -> list[tuple[float, float]]:
    """A bulging hood section (u, y): bottom at y0, crown at `top`, six true
    facets, wider at the shoulders than at the base (wagon hoods, tents)."""
    hgt = top - y0
    return [
        (cx - half, y0),
        (cx + half, y0),
        (cx + half + 2 * bulge, y0 + 0.42 * hgt),
        (cx + half * 0.72, y0 + 0.84 * hgt),
        (cx + half * 0.28, top),
        (cx - half * 0.28, top),
        (cx - half * 0.72, y0 + 0.84 * hgt),
        (cx - half - 2 * bulge, y0 + 0.42 * hgt),
    ]


# ------------------------------------------------------------------ bars, pipes
def bar(g: Grid, axis: str, p0, p1, thick: float, lo, hi, ramp: str, base: int = 4) -> np.ndarray:
    """A straight board or bar `thick` wide from p0 to p1 in the plane
    across `axis` (PRISM_PLANE order), extruded over [lo, hi): braces,
    boards across a window, leaning poles, spouts (a true slope)."""
    (u0, v0), (u1, v1) = p0, p1
    length = math.hypot(u1 - u0, v1 - v0)
    if length < 1e-9:
        raise ValueError("bar needs two different points")
    nu, nv = -(v1 - v0) / length * thick / 2, (u1 - u0) / length * thick / 2
    g.prism(axis, [(u0 + nu, v0 + nv), (u1 + nu, v1 + nv), (u1 - nu, v1 - nv), (u0 - nu, v0 - nv)], lo, hi, C(ramp, base))
    return last(g)


def pipe(g: Grid, pts, s: int = 4, ramp: str = "rust", base: int = 4, flange: bool = True) -> np.ndarray:
    """A square pipe `s` thick through axis-aligned points (x, y, z), with a
    lighter stripe along its length and a wider dark flange at every joint
    and end (PN mecha pipework)."""
    m = np.zeros(g.shape, dtype=bool)
    h = s / 2
    X, Y, Z = _idx(g)
    for (x0, y0, z0), (x1, y1, z1) in zip(pts, pts[1:]):
        if sum(a != b for a, b in zip((x0, y0, z0), (x1, y1, z1))) != 1:
            raise ValueError(f"pipe segments must follow one axis: {(x0, y0, z0)} -> {(x1, y1, z1)}")
        bx0, by0, bz0 = min(x0, x1) - h, min(y0, y1) - h, min(z0, z1) - h
        seg = box(g, bx0, by0, bz0, max(x0, x1) + h, max(y0, y1) + h, max(z0, z1) + h, ramp, base)
        if y0 != y1:  # vertical: a stripe on every side face
            stripe = seg & ((X == int(bx0) + 1) | (Z == int(bz0) + 1))
        else:  # level: the top row catches the light
            stripe = seg & (Y == int(max(y0, y1) + h) - 1)
        P.flat(g, stripe, ramp, base + 1)
        m |= seg
    if flange:
        f = h + 1
        for x, y, z in pts:
            fm = box(g, x - f, y - f, z - f, x + f, y + f, z + f, ramp, base - 1)
            P.flat(g, edges(fm), ramp, base - 2)
            m |= fm
    return m


# ------------------------------------------------------------------ round solids
def disc(g: Grid, axis: str, cu, cv, r, lo, hi, ramp: str, base: int = 4, n: int = 8) -> np.ndarray:
    """An n-gon prism (flat radius r) along `axis`, a flat side down (for
    'y': to the front). Dials, lids, hubs, drum bodies, round signs."""
    g.prism(axis, flat_ngon(cu, cv, r, n, _DOWN[axis]), lo, hi, C(ramp, base))
    return last(g)


def tyre(g: Grid, axis: str, cu, cv, r, lo, hi, rubber=("gray", 3), hub=("steel", 5), n: int = 8, tread: bool = True) -> np.ndarray:
    """A solid rubber tyre: one n-gon prism with painted tread blocks on
    the outer band, a painted steel rim and a bright hub cap. Lies on any
    axis; for a wheel standing on the ground use wheel()."""
    m = disc(g, axis, cu, cv, r, lo, hi, *rubber, n=n)
    d = ngon_radius(g, axis, cu, cv, n)
    ang = _angle(g, axis, cu, cv)
    band = d > r - 2.2
    if tread:
        block = np.floor((ang + math.pi) / (2 * math.pi) * 2 * n).astype(int) % 2 == 0
        P.flat(g, m & band & block, rubber[0], max(1, rubber[1] - 1))
    rim = d <= r * 0.62
    P.flat(g, m & rim, *hub)
    P.flat(g, m & rim & (d > r * 0.62 - 1.1), hub[0], max(1, hub[1] - 2))
    P.flat(g, m & (d <= max(1.2, r * 0.2)), hub[0], min(7, hub[1] + 2))
    return m


def wheel(g: Grid, axis: str, c: float, y0: float, r: float, lo, hi, n: int = 8, spokes: int = 6, gaps: bool = False, tyre=("iron", 3), rim=("darkwood", 3), spoke=("wood", 4), hub=("gold", 4), rim_w: float | None = None, hub_r: float | None = None, hub_out: float = 1.0) -> dict:
    """A spoked wheel standing on y0: an n-gon (flat radius r) whose lowest
    side lies exactly on y0, so it neither floats nor sinks. `axis` is the
    axle ('x' or 'z'), `c` the wheel centre along the other level axis,
    [lo, hi) the width. A painted tyre band and rim, `spokes` spokes and a
    hub standing `hub_out` proud on both sides. gaps=True builds the rim,
    spokes and hub as separate prisms with see-through gaps (wagon wheels);
    gaps=False is one solid disc with painted spokes (cheaper).
    Returns {'mask', 'centre': (x, y, z) of the axle centre, 'r'}."""
    if axis not in ("x", "z"):
        raise ValueError("a wheel axle runs along 'x' or 'z'; use tyre() or disc() for a lying wheel")
    rim_w = max(2.0, r * 0.25) if rim_w is None else rim_w
    hub_r = max(1.6, r * 0.25) if hub_r is None else hub_r
    cy = y0 + r
    cu, cv = (cy, c) if axis == "x" else (c, cy)
    down = _DOWN[axis]
    m = np.zeros(g.shape, dtype=bool)
    if gaps:
        outer = flat_ngon(cu, cv, r, n, down)
        inner = flat_ngon(cu, cv, r - rim_w, n, down)
        for k in range(n):
            seg = [outer[k], outer[(k + 1) % n], inner[(k + 1) % n], inner[k]]
            g.prism(axis, seg, lo, hi, C(rim[0], rim[1] + (k % 2)))
            m |= last(g)
        inset = 0.5 if hi - lo >= 3 else 0.0
        for k in range(spokes):
            a = down + math.pi / n + 2 * math.pi * k / spokes
            p0 = (cu + (hub_r - 0.5) * math.cos(a), cv + (hub_r - 0.5) * math.sin(a))
            p1 = (cu + (r - rim_w + 0.6) * math.cos(a), cv + (r - rim_w + 0.6) * math.sin(a))
            m |= bar(g, axis, p0, p1, 1.8, lo + inset, hi - inset, spoke[0], spoke[1] + (k % 2))
    else:
        m |= disc(g, axis, cu, cv, r, lo, hi, *rim, n=n)
        d = ngon_radius(g, axis, cu, cv, n, down)
        ang = _angle(g, axis, cu, cv)
        web = m & (d <= r - rim_w)
        P.flat(g, web, rim[0], max(1, rim[1] - 1))
        rad = radial(g, axis, cu, cv)
        step = 2 * math.pi / max(1, spokes)
        off = np.abs(((ang - down - math.pi / n) / step + 0.5) % 1 - 0.5) * step * rad
        P.flat(g, web & (off < 1.0), *spoke)
    d = ngon_radius(g, axis, cu, cv, n, down)
    ang = _angle(g, axis, cu, cv)
    band = m & (d > r - 1.2)
    P.flat(g, band, *tyre)
    block = np.floor((ang + math.pi) / (2 * math.pi) * 2 * n).astype(int) % 2 == 0
    P.flat(g, band & block, tyre[0], max(1, tyre[1] - 1))
    h0, h1 = _fit(g, axis, lo, hi, hub_out)
    g.prism(axis, flat_ngon(cu, cv, hub_r, 8, down), h0, h1, C(*hub))
    hm = last(g)
    P.flat(g, hm & (radial(g, axis, cu, cv) < max(1.0, hub_r * 0.5)), hub[0], min(7, hub[1] + 2))
    m |= hm
    centre = ((lo + hi) / 2, cy, c) if axis == "x" else (c, cy, (lo + hi) / 2)
    return {"mask": m, "centre": centre, "r": r}


def drum(g: Grid, cx, cz, y0, h, r, ramp: str = "red", base: int = 4, n: int = 8, hoop: str | None = None, band=None, icon: str | None = None, ink=("darkwood", 2), wear: bool = True, seed: int = 0) -> np.ndarray:
    """An n-gon drum or barrel (flat radius r, a flat side to the front):
    two proud rolling hoops, an optional painted `band` ((ramp, shade))
    between them with an ICONS `icon` on the front facet in `ink`, a lid
    with a darker rim and two bungs, and (with `wear`) painted dents and
    rust. The front facet is 2·r·tan(180°/n) wide; the icon must fit."""
    hoop = hoop or ramp
    body = disc(g, "y", cx, cz, r, y0, y0 + h, ramp, base, n=n)
    X, Y, Z = coords(g)
    d = ngon_radius(g, "y", cx, cz, n)
    ang = np.arctan2(Z - cz, X - cx)
    lo_hoop, hi_hoop = y0 + max(2, round(h * 0.22)), y0 + h - max(3, round(h * 0.24))
    hoops = np.zeros(g.shape, dtype=bool)
    for hy in (lo_hoop, hi_hoop):
        hoops |= disc(g, "y", cx, cz, r + 0.8, hy, hy + 2, hoop, min(7, base + 1), n=n)
    if band:
        P.flat(g, body & ~hoops & (Y > lo_hoop + 2) & (Y < hi_hoop), *band)
    top = body & (Y > y0 + h - 1)
    P.flat(g, top, ramp, max(1, base - 1))
    P.flat(g, top & (d > r - 1.6), ramp, max(1, base - 2))
    for bx, bz in ((cx - r * 0.4, cz + r * 0.35), (cx + r * 0.35, cz - r * 0.3)):
        P.flat(g, top & (np.hypot(X - bx, Z - bz) < 1.3), "steel", 6)
    P.flat(g, body & (Y < y0 + 1), ramp, max(1, base - 2))
    if wear:
        rng = np.random.default_rng(seed)
        paint_zone = body & ~hoops & ~top & ((Y < lo_hoop) | (Y > hi_hoop + 2))
        for _ in range(3):
            a0 = rng.uniform(-math.pi, math.pi)
            dy = rng.choice([rng.uniform(1.0, max(1.5, lo_hoop - y0 - 0.5)), rng.uniform(hi_hoop - y0 + 2.5, max(hi_hoop - y0 + 3, h - 1.5))])
            near = paint_zone & (np.abs(np.angle(np.exp(1j * (ang - a0)))) < 0.4) & (np.abs(Y - y0 - dy) < 1.2)
            P.flat(g, near, ramp, max(1, base - 1))
            P.flat(g, near & (Y > y0 + dy), ramp, min(7, base + 2))
        rust = body & ~hoops & (P._hash(np.floor(X) // 2, np.floor(Y) // 2, np.floor(Z) // 2, seed=seed + 7) % np.uint64(11) == 0) & (np.cos(ang) > 0.2)
        P.flat(g, rust, "rust", 5)
    if icon:
        w, ih = pnglyph.icon_size(icon)
        facet = 2 * r * math.tan(math.pi / n)
        if w > facet + 1:
            raise ValueError(f"icon {icon!r} is {w} wide; the front facet is {facet:.1f}: make r at least {(w - 1) / (2 * math.tan(math.pi / n)):.1f}")
        mid = (lo_hoop + 2 + hi_hoop) / 2 if band else y0 + h / 2
        # depth 2: when cz - r is not whole, the outer layer is a boundary voxel
        # the atlas does not sample; the next layer is the one that shows.
        pnglyph.icon(g, "-z", cz - r, int(round(cx - w / 2)), int(round(mid - ih / 2)), icon, *ink, depth=2)
    return body | hoops


def gear_poly(cu: float, cv: float, r: float, teeth: int = 10, depth: float = 3.0, turn: float = 0.0) -> list[tuple[float, float]]:
    """Outline of a gear: square teeth `depth` deep around the root radius r."""
    pts = []
    step = 2 * math.pi / teeth
    for k in range(teeth):
        a0 = turn + step * k
        for frac, rad in ((0.0, r), (0.2, r), (0.28, r + depth), (0.72, r + depth), (0.8, r)):
            a = a0 + frac * step
            pts.append((cu + rad * math.cos(a), cv + rad * math.sin(a)))
    return pts


def gear(g: Grid, axis: str, cu, cv, r, lo, hi, teeth: int = 10, depth: float = 3.0, ramp: str = "rust", base: int = 4, turn: float = 0.0) -> np.ndarray:
    """A big flat gear (true diagonal teeth) with lit teeth, a darker hub
    ring and a bright axle cap painted on its faces."""
    g.prism(axis, gear_poly(cu, cv, r, teeth, depth, turn), lo, hi, C(ramp, base))
    m = last(g)
    rr = radial(g, axis, cu, cv)
    P.flat(g, m & (rr > r - 1.2) & (rr <= r), ramp, max(1, base - 1))
    P.flat(g, m & (rr < r * 0.45) & (rr > r * 0.45 - 1.5), ramp, max(1, base - 2))
    P.flat(g, m & (rr < 2.2), "gold", 6)
    P.flat(g, m & (rr > r), ramp, min(7, base + 1))
    return m


def cone(g: Grid, axis: str, cu, cv, r, lo, hi, ramp: str, base: int = 4, n: int = 8, r_top: float = 0.0, tip: str = "hi") -> np.ndarray:
    """An n-gon cone or frustum along `axis` (flat radius r at the wide
    end, r_top at the narrow end, 0 for a point). tip='hi' narrows toward
    hi (spires, horns up); tip='lo' narrows toward lo (drips, claws down)."""
    if tip not in ("hi", "lo"):
        raise ValueError("tip must be 'hi' or 'lo'")
    down = _DOWN[axis]
    wide = flat_ngon(cu, cv, r, n, down)
    narrow = flat_ngon(cu, cv, r_top, n, down) if r_top > 0 else [(cu, cv)] * n
    poly, top = (wide, narrow) if tip == "hi" else (narrow, wide)
    g.prism(axis, poly, lo, hi, C(ramp, base), top=top)
    return last(g)


def pyramid(g: Grid, x0, z0, x1, z1, y0, h, ramp: str, base: int = 4, apex=None, tiles: bool = False, seed: int = 0) -> np.ndarray:
    """A four-sided pyramid over the box x0..x1 × z0..z1, apex h above y0
    (at `apex` (x, z), default the centre). tiles=True paints roof tiles
    whose rows follow each slope."""
    ax, az = apex if apex is not None else ((x0 + x1) / 2, (z0 + z1) / 2)
    g.prism("y", [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y0, y0 + h, C(ramp, base), top=[(ax, az)] * 4)
    m = last(g)
    if tiles:
        solid = [g.solids[-1]]
        paint_facets(g, solid, lambda gg, mm, fr: P.tiles(gg, mm, ramp, base, row=3, width=4, frame=fr, seed=seed))
    return m


def hip_roof(g: Grid, x0, z0, x1, z1, y0, h, ramp: str = "red", base: int = 4, ridge: str | None = None, inset: float | None = None, tiles: bool = True, trim=("darkwood", 3), seed: int = 0) -> np.ndarray:
    """A solid hip roof over the box x0..x1 × z0..z1 (make it wider than
    the walls for eaves): four true slopes rising h to a ridge along the
    long side (or `ridge` 'x' / 'z'), inset from the ends by `inset`
    (default: half the short side, so all four slopes are equally steep).
    Tile rows follow each slope; the eave, hips and ridge get `trim`."""
    ridge = ridge or ("x" if x1 - x0 >= z1 - z0 else "z")
    if ridge == "x":
        i = (z1 - z0) / 2 if inset is None else inset
        i = min(i, (x1 - x0) / 2)
        zc = (z0 + z1) / 2
        top = [(x0 + i, zc), (x1 - i, zc), (x1 - i, zc), (x0 + i, zc)]
    elif ridge == "z":
        i = (x1 - x0) / 2 if inset is None else inset
        i = min(i, (z1 - z0) / 2)
        xc = (x0 + x1) / 2
        top = [(xc, z0 + i), (xc, z0 + i), (xc, z1 - i), (xc, z1 - i)]
    else:
        raise ValueError("ridge must be 'x' or 'z'")
    g.prism("y", [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y0, y0 + h, C(ramp, base), top=top)
    m = last(g)
    solid = [g.solids[-1]]
    if tiles:
        paint_facets(g, solid, lambda gg, mm, fr: P.tiles(gg, mm, ramp, base, row=4, width=5, frame=fr, seed=seed))
    if trim:
        _X, Y, _Z = _idx(g)
        P.flat(g, m & ((Y < y0 + 1) | seams(g, solid, 0.9)), *trim)
    return m


def dome(g: Grid, cx, cz, y0, r, h: float | None = None, n: int = 8, rings: int = 3, ramp: str = "bone", base: int = 5, cap_r: float = 0.0, painter=None, ribs=("steel", 3)) -> np.ndarray:
    """A faceted dome of `rings` stacked n-gon frustums (true slopes both
    ways, cheap: about 2·n·rings triangles), flat radius r at y0, height h
    (default r), a point at the top or a flat cap of flat radius cap_r.
    Each facet is painted by painter(g, mask, frame) (default: riveted
    plates); `ribs` ((ramp, shade) or None) paints the facet seams."""
    h = r if h is None else h
    # ring k: flat radius r·cos(a), height h·sin(a), a = 90°·k/rings;
    # heights snap to whole voxels and a ring that collapses is dropped
    snapped = [(float(r), int(round(y0)))]
    for k in range(1, rings + 1):
        a = (math.pi / 2) * k / rings
        rad = max(r * math.cos(a), cap_r) if k < rings else cap_r
        y = int(round(y0 + h * math.sin(a)))
        if y > snapped[-1][1]:
            snapped.append((rad, y))
        elif len(snapped) > 1:
            snapped[-1] = (rad, snapped[-1][1])
    if len(snapped) < 2:
        raise ValueError("dome is too flat: raise h")
    solids = []
    down = _DOWN["y"]
    for (r0, ya), (r1, yb) in zip(snapped, snapped[1:]):
        poly = flat_ngon(cx, cz, r0, n, down)
        top = flat_ngon(cx, cz, r1, n, down) if r1 > 0 else [(cx, cz)] * n
        g.prism("y", poly, ya, yb, C(ramp, base), top=top)
        solids.append(g.solids[-1])
    m = np.logical_or.reduce([s.mask(g.shape) for s in solids])
    painter = painter or (lambda gg, mm, fr: P.plates(gg, mm, ramp, base, size=(7, 5), frame=fr))
    paint_facets(g, solids, painter)
    if ribs:
        P.flat(g, m & seams(g, solids, 0.8), *ribs)
    return m


def spire(g: Grid, cx, cz, y0, half: float, rise: float, ramp: str = "purple", base: int = 4, style: str = "pyramid", overhang: float = 1.0, n: int = 4, tiles: bool = True, seed: int = 0) -> np.ndarray:
    """A steep cap for towers and pinnacles. style='pyramid': an n-sided
    pyramid (n=4 square, 8 octagonal) of half-width half + overhang;
    style='gable': two crossed gables (a gothic cap with four gable ends).
    Tile rows follow each slope."""
    a = half + overhang
    start = len(g.solids)
    if style == "pyramid":
        base_poly = [(cx - a, cz - a), (cx + a, cz - a), (cx + a, cz + a), (cx - a, cz + a)] if n == 4 else flat_ngon(cx, cz, a, n)
        g.prism("y", base_poly, y0, y0 + rise, C(ramp, base), top=[(cx, cz)] * len(base_poly))
    elif style == "gable":
        g.prism("z", [(cx - a, y0), (cx + a, y0), (cx, y0 + rise)], cz - a, cz + a, C(ramp, base))
        g.prism("x", [(y0, cz - a), (y0, cz + a), (y0 + rise, cz)], cx - a, cx + a, C(ramp, base))
    else:
        raise ValueError("style must be 'pyramid' or 'gable'")
    solids = g.solids[start:]
    m = np.logical_or.reduce([s.mask(g.shape) for s in solids])
    if tiles:
        paint_facets(g, solids, lambda gg, mm, fr: P.tiles(gg, mm, ramp, base, row=3, width=3, frame=fr, seed=seed))
    return m


# ------------------------------------------------------------------ motifs
def cross(g: Grid, cx, y0, cz, h: int = 16, arm: int = 5, t: int = 3, ramp: str = "gray", base: int = 5, horns: bool = True) -> np.ndarray:
    """PN haunted finial: a thick cross on a post, facing -z, with two
    curled horns rising from its foot (true slopes)."""
    x0 = cx - t / 2
    m = box(g, x0, y0, cz - t / 2, x0 + t, y0 + h, cz + t / 2, ramp, base)
    ay = y0 + h - arm - t
    m |= box(g, cx - arm - t / 2, ay, cz - t / 2, cx + arm + t / 2, ay + t, cz + t / 2, ramp, base)
    if horns:
        for s in (-1, 1):
            p0, p1, p2 = (cx, y0 + 1.5), (cx + s * 6, y0 + 5), (cx + s * 7, y0 + 9)
            g.prism("z", quad(p0, p1, 1.3), cz - 1, cz + 1, C(ramp, base))
            m |= last(g)
            g.prism("z", quad(p1, p2, 1.3, 1.0), cz - 1, cz + 1, C(ramp, base))
            m |= last(g)
    P.outline(g, m, ramp, base - 1)
    return m


def skull(g: Grid, cx, y0, cz, s: int = 12, ramp: str = "bone", base: int = 6, eyes=("toxic", 6), socket=("purple", 1), seed: int = 0) -> np.ndarray:
    """A chunky 3D skull facing -z (skull lamps, totems, crests): a
    chamfered cranium with a faceted crown, a narrower jaw, and painted
    sockets with glowing pupils, a nose and teeth. About s wide and
    s·1.3 tall, standing on y0."""
    a, b = s / 2, s * 0.45
    ch = s * 0.18
    jaw_h = max(3, round(s * 0.3))
    yc0 = y0 + jaw_h - 1
    yc1 = yc0 + round(s * 0.55)
    yc2 = yc0 + s

    def octo(ha, hb, c, oz=0.0):
        return [(cx - ha + c, cz - hb + oz), (cx + ha - c, cz - hb + oz), (cx + ha, cz - hb + c + oz), (cx + ha, cz + hb - c + oz), (cx + ha - c, cz + hb + oz), (cx - ha + c, cz + hb + oz), (cx - ha, cz + hb - c + oz), (cx - ha, cz - hb + c + oz)]

    g.prism("y", octo(a, b, ch), yc0, yc1, C(ramp, base))
    m = last(g)
    g.prism("y", octo(a, b, ch), yc1, yc2, C(ramp, base), top=octo(a - ch, b - ch, ch * 0.6))
    m |= last(g)
    jb = b * 0.6
    g.prism("y", octo(a * 0.62, jb, ch * 0.6, oz=-(b - jb)), y0, yc0 + 1, C(ramp, base - 1))
    jaw = last(g)
    m |= jaw
    P.mottle(g, m, ramp, base, cell=2, seed=seed)
    P.flat(g, jaw, ramp, base - 1)
    X, Y, Z = coords(g)
    front = cz - b
    face = m & (Z < front + 1.2)
    e = max(2.0, s * 0.26)
    ex = s * 0.22
    ey = yc0 + (yc1 - yc0) * 0.55
    for sx in (-1, 1):
        sock = face & (np.abs(X - (cx + sx * ex)) < e / 2 + 0.01) & (np.abs(Y - ey) < e / 2 + 0.01)
        P.flat(g, sock, *socket)
        P.flat(g, sock & (np.abs(X - (cx + sx * ex)) < 0.8) & (np.abs(Y - ey) < 0.8), *eyes)
    ny = ey - e / 2 - 0.5
    nose = face & (Y < ny) & (Y > ny - max(2.0, s * 0.18)) & (np.abs(X - cx) < (Y - (ny - max(2.0, s * 0.18))) * 0.6 + 0.2)
    P.flat(g, nose, *socket)
    jfront = cz - b
    teeth = jaw & (Z < jfront + 1.2) & (Y > yc0 - 2) & (Y < yc0 + 1)
    P.flat(g, teeth, ramp, min(7, base + 1))
    P.flat(g, teeth & (np.floor(X - cx) % 2 == 0), *socket)
    return m


def tombstone(g: Grid, cx, cz, w: int = 10, h: int = 16, t: int = 4, y0: float = 0, lean: float = 0.0, ramp: str = "gray", base: int = 4, glyph: str | None = "cross", ink=None, seed: int = 0) -> np.ndarray:
    """A round-topped headstone facing -z (a prism, so it can lean by `lean`
    degrees), stone-block paint, moss at the foot and a painted glyph:
    'cross', 'rip' (text) or any ICONS name, or None."""
    x0, x1 = cx - w / 2, cx + w / 2
    top = y0 + h - w / 2
    pts = [(x0, y0), (x1, y0), (x1, top)] + [(cx + (w / 2) * math.cos(math.pi * k / 6), top + (w / 2) * math.sin(math.pi * k / 6)) for k in range(1, 6)] + [(x0, top)]
    pts = rotate(pts, cx, y0, lean)
    pts = [(u, max(float(y0), v)) for u, v in pts]
    g.prism("z", pts, cz - t / 2, cz + t / 2, C(ramp, base))
    m = last(g)
    P.stone(g, m, ramp, base, block=(5, 4), cracks=0.2, seed=seed)
    P.outline(g, m, ramp, base - 1, normal="z")
    X, Y, Z = _idx(g)
    ink = ink or (ramp, max(1, base - 3))
    if glyph == "cross":
        P.flat(g, m & (np.abs(X + 0.5 - cx) < 1.1) & (Y >= y0 + h * 0.35) & (Y < y0 + h * 0.8), *ink)
        P.flat(g, m & (np.abs(X + 0.5 - cx) < 3.1) & (Y >= y0 + h * 0.6) & (Y < y0 + h * 0.6 + 2), *ink)
    elif glyph == "rip":
        tw, th = pnglyph.text_size("RIP")
        if tw + 2 > w:
            raise ValueError(f"'RIP' is {tw} wide; make the tombstone at least {tw + 2} wide")
        pnglyph.text(g, "-z", cz - t / 2, int(round(cx - tw / 2)), int(y0 + h * 0.3), "RIP", *ink)
    elif glyph:
        iw, ih = pnglyph.icon_size(glyph)
        if iw + 2 > w:
            raise ValueError(f"icon {glyph!r} is {iw} wide; make the tombstone at least {iw + 2} wide")
        pnglyph.icon(g, "-z", cz - t / 2, int(round(cx - iw / 2)), int(y0 + h * 0.3), glyph, *ink)
    P.flat(g, m & (Y < y0 + 2) & ((P._hash(X, Z, seed=seed) % np.uint64(3)) != 0), "moss", 5)
    return m


def pumpkin(g: Grid, cx, y0, cz, w: int = 18, h: int = 14, ramp: str = "orange", base: int = 3, stem: str = "moss", seed: int = 0) -> np.ndarray:
    """PN pumpkin: a core block ringed by rib slabs of stepped heights (the
    middle rib is tallest), a raised crown and a leaning, hooked stem (true
    slopes). Painted streaks, dark rib seams and sunlit patches on top."""
    c = w // 2 - 2  # core half-width
    m = box(g, cx - c, y0, cz - c, cx + c, y0 + h - 1, cz + c, ramp, base)
    ribs = [(-c, -c // 3 - 1, h - 1, 1), (-c // 3 - 1, c // 3 + 1, h - 1, 0), (c // 3 + 1, c, h - 1, 1)]
    X, Y, Z = _idx(g)
    seam = np.zeros(g.shape, dtype=bool)
    for a0, a1, top, lift in ribs:
        for s in (-1, 1):
            zr = (cz + s * c, cz + s * (c + 2))
            rz = box(g, cx + a0, y0 + lift, min(zr), cx + a1, y0 + top - lift, max(zr), ramp, base)
            xr = (cx + s * c, cx + s * (c + 2))
            rx = box(g, min(xr), y0 + lift, cz + a0, max(xr), y0 + top - lift, cz + a1, ramp, base)
            seam |= (rz & ((X == cx + a0) | (X == cx + a1 - 1))) | (rx & ((Z == cz + a0) | (Z == cz + a1 - 1)))
            m |= rz | rx
    r = c // 3 + 1
    top = box(g, cx - r, y0 + h - 1, cz - c - 1, cx + r, y0 + h, cz + c + 1, ramp, base)
    top |= box(g, cx - c - 1, y0 + h - 1, cz - r, cx + c + 1, y0 + h, cz + r, ramp, base)
    top |= box(g, cx - r + 1, y0 + h, cz - r + 1, cx + r - 1, y0 + h + 1, cz + r - 1, ramp, base)
    m |= top
    shade = base + P._jitter(P._hash(X + Z, Y // 3, seed=seed)) * (P._hash(X - Z, seed=seed + 1) % np.uint64(2)).astype(np.int64)
    P._paint(g, m, ramp, shade)
    P.flat(g, m & seam, ramp, base - 1)
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    up[:, -1, :] = True
    pnpaint.blotch(g, m & up, ramp, base + 1, cell=2, chance=0.06, seed=seed + 2)
    P.flat(g, m & (Y == y0), ramp, base - 1)
    sy = y0 + h
    g.prism("z", quad((cx, sy), (cx + 0.8, sy + 5), 1.4, 1.2), cz - 1.5, cz + 1.5, C(stem, 4))
    st = last(g)
    g.prism("z", quad((cx + 0.3, sy + 4.4), (cx + 3.2, sy + 5.6), 1.1, 0.9), cz - 1.2, cz + 1.2, C(stem, 3))
    st |= last(g)
    P.flat(g, st & (Y >= sy + 4), stem, 5)
    return m | st


def banner(g: Grid, x, y, z, pole: int, fw: int, fh: int, ramp: str = "toxic", base: int = 3, pole_ramp: str = "purple", glyph: str | None = "skull", ink=("purple", 1), torn: bool = True) -> np.ndarray:
    """A tall pole (3×3, foot at (x, y, z)) with a big flag flying toward +x
    (a 2-voxel prism in the x-y plane), a notched fly end when `torn`, and
    an ICONS `glyph` painted on both sides; each side reads correctly."""
    box(g, x, y, z, x + 3, y + pole, z + 3, pole_ramp, 2)
    box(g, x - 1, y + pole, z - 1, x + 4, y + pole + 2, z + 4, pole_ramp, 3)
    top = y + pole - 1
    fx = x + 3
    if torn:
        pts = [(fx, top), (fx + fw * 0.55, top - 1.5), (fx + fw, top + 0.5), (fx + fw - 4, top - fh * 0.45), (fx + fw + 1, top - fh - 1), (fx + fw * 0.5, top - fh + 1), (fx, top - fh)]
    else:
        pts = [(fx, top), (fx + fw, top - 1), (fx + fw, top - fh - 1), (fx, top - fh)]
    g.prism("z", pts, z, z + 2, C(ramp, base))
    m = last(g)
    P.mottle(g, m, ramp, base, cell=3, seed=9)
    P.outline(g, m, ramp, base - 2, normal="z")
    if glyph:
        gw, gh = pnglyph.icon_size(glyph)
        gu = int(fx + fw * 0.45 - gw / 2)
        gv = int(top - fh / 2 - gh / 2)
        inks = {"+": (ramp, min(7, base + 3))}
        pnglyph.icon(g, "-z", z, gu, gv, glyph, *ink, inks=inks)
        pnglyph.icon(g, "+z", z + 2, gu, gv, glyph, *ink, inks=inks)
    return m


def flame(g: Grid, mask: np.ndarray, cx: float, cz: float, v0: float, height: float, width: float, outer=("orange", 5), inner=("gold", 7), rim=("red", 4)) -> None:
    """Paint a teardrop flame on every vertical face of a box mask: a round
    belly at v0 that tapers to a point `height` above it, centred on cx
    (on z faces) or cz (on x faces)."""
    X, Y, Z = coords(g)
    zface = mask & ((np.roll(mask, 1, axis=2) == 0) | (np.roll(mask, -1, axis=2) == 0))
    du = np.where(zface, np.abs(X - cx), np.abs(Z - cz))
    v = (Y - v0) / height
    belly = 0.38
    r = np.where(v < belly, np.sqrt(np.clip(1 - ((v - belly) / belly) ** 2, 0, 1)), np.clip((1 - v) / (1 - belly), 0, 1) ** 1.3)
    shape = mask & (v >= 0) & (v <= 1) & (du <= r * width / 2)
    P.flat(g, shape, *outer)
    P.flat(g, shape & (v > 0.72), *rim)
    core = mask & (v >= 0.1) & (v <= 0.45) & (du <= r * width / 2 - 2.2)
    P.flat(g, core, *inner)


def lantern(g: Grid, cx: int, y0: int, cz: int, s: int = 10, body: int = 13, glass: str = "gold", roof: str = "red", frame: str = "darkwood", seed: int = 0) -> dict:
    """An oversized square lantern (rule K3): a tapered dark base (true
    slopes), tall glowing panes with a painted flame inside a thick frame,
    and a steep tiled gable cap with a hanging ring. (cx, cz) is the centre,
    y0 the bottom. Returns {'mask', 'glow' (centre), 'top' (ring top y),
    'reach' (cap half-width), 'panes', 'ring'}."""
    h = s // 2
    start = len(g.solids)
    g.prism("z", [(cx - 2, y0), (cx + 2, y0), (cx + h + 1, y0 + 3), (cx - h - 1, y0 + 3)], cz - h - 1, cz + h + 1, C(frame, 4))
    plate = last(g)
    P.planks(g, plate, frame, 4, width=2, across="y", nails=False, seed=seed)
    yb0, yb1 = y0 + 3, y0 + 3 + body
    panes = box(g, cx - h, yb0, cz - h, cx + h, yb1, cz + h, glass, 6)
    flame(g, panes, cx, cz, yb0 + 1.2, body - 2.4, s * 0.8)
    _X, Y, _Z = coords(g)
    fr = edges(panes) | (panes & (Y < yb0 + 1.0)) | (panes & (Y > yb1 - 1.0))
    P.flat(g, fr, frame, 3)
    eave = box(g, cx - h - 1, yb1, cz - h - 1, cx + h + 1, yb1 + 2, cz + h + 1, frame, 4)
    P.planks(g, eave, frame, 4, width=2, across="y", nails=False, seed=seed + 1)
    rise = s
    g.prism("z", [(cx - h - 2, yb1 + 2), (cx + h + 2, yb1 + 2), (cx, yb1 + 2 + rise)], cz - h - 2, cz + h + 2, C(roof, 4))
    cap = last(g)
    P.tiles(g, cap, roof, 4, row=3, width=4, along="z", seed=seed + 2)
    ring_y = yb1 + 2 + rise - 2
    ring = box(g, cx - 1, ring_y, cz - 2, cx + 1, ring_y + 3, cz + 2, "gold", 4)
    m = panes | fr | eave | ring | np.logical_or.reduce([sd.mask(g.shape) for sd in g.solids[start:]])
    return {"mask": m, "glow": (cx, yb0 + body / 2, cz), "top": ring_y + 3, "reach": h + 2, "panes": panes, "ring": ring}

