"""Space pack helpers in the Pirate Nation mecha style (import as `_pn`).

PN mecha (the source of the space theme): steel plates with rivets, copper
pipes with flanges, big copper gears, teal glowing windows in copper frames,
hazard orange. The space pack adds white hull panels. Everything fills a
grid and paints it; the atlas turns colours into texture (rule S1), so the
painters here cost no triangles.

Parts built here: `gore_dome` makes a faceted dome from sloped panels (true
slopes, rule F2) as one rotated part per panel, because a prism can only
slope across one axis.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
from pnkit import box, edges, ngon
from voxgrid import C, Grid, Part


def coords(g: Grid):
    """Voxel-centre coordinates (x, y, z) of the grid."""
    return np.meshgrid(*(np.arange(n) + 0.5 for n in g.shape), indexing="ij")


def last(g: Grid) -> np.ndarray:
    """Mask of the prism added last."""
    return g.solids[-1].mask(g.shape)


def plated(g: Grid, mask: np.ndarray, ramp: str = "steel", base: int = 4, size=(10, 6), frame: bool = True, seed: int = 0) -> np.ndarray:
    """PN mecha plates: riveted panels with a darker border, and a 1-voxel
    darker frame on the edges of a box-like mask (rule S4)."""
    P.plates(g, mask, ramp, base, size=size, seed=seed)
    if frame:
        P.flat(g, edges(mask), ramp, base - 2)
    return mask


def hazard(g: Grid, mask: np.ndarray, period: int = 6, a=("orange", 5), b=("steel", 2)) -> Grid:
    """Diagonal hazard stripes on every face of a mask."""
    X, Y, Z = coords(g)
    band = ((np.floor(X + Z + Y) // (period // 2)) % 2) == 0
    P.flat(g, mask & band, *a)
    P.flat(g, mask & ~band, *b)
    return g


def prism_y(g: Grid, cx, cz, r, y0, y1, ramp: str, base: int = 4, n: int = 12) -> np.ndarray:
    """Upright n-gon prism (tank, drum, collar); r is the corner radius."""
    g.prism("y", ngon(cx, cz, r, n), y0, y1, C(ramp, base))
    return last(g)


def apothem(r: float, n: int) -> float:
    """Corner radius of an n-gon whose flat sides lie at distance r."""
    return r / math.cos(math.pi / n)


def pipe(g: Grid, pts, s: int = 4, ramp: str = "rust", base: int = 4, flange: bool = True) -> np.ndarray:
    """A square copper pipe through axis-aligned points (x, y, z), `s` thick,
    with a wider dark flange at every joint and end (PN mecha pipework)."""
    m = np.zeros(g.shape, dtype=bool)
    h = s / 2
    for (x0, y0, z0), (x1, y1, z1) in zip(pts, pts[1:]):
        m |= box(g, min(x0, x1) - h, min(y0, y1) - h, min(z0, z1) - h, max(x0, x1) + h, max(y0, y1) + h, max(z0, z1) + h, ramp, base)
    X, Y, Z = coords(g)
    # lengthwise highlight stripe: one shade lighter on the upper third
    P.flat(g, m & ((Y % s) > s * 0.66), ramp, base + 1)
    if flange:
        f = h + 1
        for x, y, z in pts:
            fm = box(g, x - f, y - f, z - f, x + f, y + f, z + f, ramp, base - 1)
            P.flat(g, edges(fm), ramp, base - 2)
            m |= fm
    return m


def gear_poly(cu: float, cv: float, r: float, teeth: int = 10, depth: float = 3.0, turn: float = 0.0) -> list[tuple[float, float]]:
    """Outline of a gear: square teeth `depth` deep around radius r."""
    pts = []
    for k in range(teeth):
        a0 = turn + 2 * math.pi * k / teeth
        step = 2 * math.pi / teeth
        for frac, rad in ((0.0, r), (0.2, r), (0.28, r + depth), (0.72, r + depth), (0.8, r)):
            a = a0 + frac * step
            pts.append((cu + rad * math.cos(a), cv + rad * math.sin(a)))
    return pts


def gear(g: Grid, axis: str, cu, cv, r, lo, hi, teeth: int = 10, depth: float = 3.0, ramp: str = "rust", base: int = 4, turn: float = 0.0) -> np.ndarray:
    """A big flat copper gear (true diagonal teeth) with a darker hub ring and
    a bright axle cap painted on its faces."""
    g.prism(axis, gear_poly(cu, cv, r, teeth, depth, turn), lo, hi, C(ramp, base))
    m = last(g)
    X, Y, Z = coords(g)
    ax = {"x": 0, "y": 1, "z": 2}[axis]
    U, V = [c for i, c in enumerate((X, Y, Z)) if i != ax]
    rr = np.hypot(U - cu, V - cv)
    P.flat(g, m & (rr > r - 1.2) & (rr <= r), ramp, base - 1)
    P.flat(g, m & (rr < r * 0.45) & (rr > r * 0.45 - 1.5), ramp, base - 2)
    P.flat(g, m & (rr < 2.2), "gold", 6)
    P.flat(g, m & (rr > r), ramp, base + 1)  # the teeth catch the light
    return m


def glow_window(g: Grid, mask: np.ndarray, frame=("rust", 3), glass=("cyan", 6), bar: bool = True) -> np.ndarray:
    """Paint a teal window into a flat box mask: copper frame, glowing glass,
    a lighter glint in the upper corner, a mullion (PN mecha windows)."""
    P.flat(g, mask, *glass)
    rim = edges(mask) | (mask & ~_inner(mask))
    P.flat(g, rim, *frame)
    X, Y, Z = coords(g)
    ys = np.nonzero(mask.any(axis=(0, 2)))[0]
    if len(ys):
        top = ys.max()
        P.flat(g, mask & ~rim & (Y > top - 2.5), glass[0], min(7, glass[1] + 1))
    if bar:
        xs = np.nonzero(mask.any(axis=(1, 2)))[0]
        zs = np.nonzero(mask.any(axis=(0, 1)))[0]
        if xs.max() - xs.min() >= zs.max() - zs.min():
            mid = (xs.min() + xs.max() + 1) / 2
            P.flat(g, mask & (np.abs(X - mid) < 0.6), *frame)
        else:
            mid = (zs.min() + zs.max() + 1) / 2
            P.flat(g, mask & (np.abs(Z - mid) < 0.6), *frame)
    return mask


def _inner(mask: np.ndarray) -> np.ndarray:
    """Voxels of the mask whose in-plane neighbours are all in the mask."""
    keep = mask.copy()
    for axis in range(3):
        if mask.shape[axis] == 1:
            continue
        for step in (1, -1):
            nb = np.roll(mask, step, axis=axis)
            edge = [slice(None)] * 3
            edge[axis] = 0 if step == 1 else -1
            nb[tuple(edge)] = False
            # ignore the thin axis: a 1–2 voxel thick panel keeps its middle
            span = np.nonzero(mask.any(axis=tuple(a for a in range(3) if a != axis)))[0]
            if len(span) and span.max() - span.min() < 2:
                continue
            keep &= nb
    return keep


# 3×5 pixel glyphs for painted signs and logos (rows top to bottom).
GLYPHS = {
    "A": ["010", "101", "111", "101", "101"], "B": ["110", "101", "110", "101", "110"],
    "H": ["101", "101", "111", "101", "101"], "S": ["011", "100", "010", "001", "110"],
    "N": ["101", "111", "111", "111", "101"], "X": ["101", "101", "010", "101", "101"],
    "O": ["010", "101", "101", "101", "010"], "1": ["010", "110", "010", "010", "111"],
    "-": ["000", "000", "111", "000", "000"], "!": ["010", "010", "010", "000", "010"],
    "R": ["110", "101", "110", "101", "101"], "V": ["101", "101", "101", "101", "010"],
    "E": ["111", "100", "110", "100", "111"], "Y": ["101", "101", "010", "010", "010"],
    "M": ["101", "111", "111", "101", "101"], "U": ["101", "101", "101", "101", "111"], "2": ["110", "001", "010", "100", "111"],
}


def text(g: Grid, face: str, plane: int, u0: int, v0: int, s: str, ramp: str, shade: int, scale: int = 1, depth: int = 1) -> Grid:
    """Paint pixel text on a wall face. `u0` is the left end as seen from
    outside, `v0` the bottom row. Faces: -z, +z, -x, +x (see pnkit.on_face)."""
    col = 0
    for ch in s:
        rows = GLYPHS[ch]
        for r, row in enumerate(rows):
            for c, bit in enumerate(row):
                if bit != "1":
                    continue
                for du in range(scale):
                    for dv in range(scale):
                        u = col + c * scale + du
                        v = v0 + (4 - r) * scale + dv
                        _paint_face_px(g, face, plane, u0, u, v, ramp, shade, depth)
        col += 4 * scale
    return g


def _paint_face_px(g: Grid, face: str, plane: int, u0: int, u: int, v: int, ramp: str, shade: int, depth: int) -> None:
    for d in range(depth):
        if face == "-z":  # seen from -z, +x is on the left
            x, z = u0 - u, plane + d
        elif face == "+z":
            x, z = u0 + u, plane - 1 - d
        elif face == "-x":
            x, z = plane + d, u0 + u
        else:  # +x
            x, z = plane - 1 - d, u0 - u
        if 0 <= x < g.shape[0] and 0 <= v < g.shape[1] and 0 <= z < g.shape[2] and g.a[x, v, z]:
            g.a[x, v, z] = C(ramp, shade)


# ------------------------------------------------------------ faceted dome --
YO = 4  # gore and rib grids start this far below the dome base (slabs reach down)

def _slab(d0, y0, d1, y1, out: float, inn: float):
    """Quad (d, y) of a slab along the segment (d0, y0)→(d1, y1): `out`
    outward of the line, `inn` inward (d is the distance from the axis)."""
    dd, dy = d1 - d0, y1 - y0
    n = math.hypot(dd, dy)
    nd, ny = dy / n, -dd / n  # outward normal
    return [(d0 + nd * out, y0 + ny * out), (d1 + nd * out, y1 + ny * out), (d1 - nd * inn, y1 - ny * inn), (d0 - nd * inn, y0 - ny * inn)]


def gore_dome(root: Part, name: str, at, rings, n: int = 12, skin: str = "bone", rib: str = "steel", thick: float = 4.0, rib_w: float = 5.0, paint_gore=None, seed: int = 0) -> list[Part]:
    """A faceted dome of `n` sloped panels (gores) with a thick rib on every
    seam: true slopes in both directions (rule F2) and thick frames (F3).
    `rings` are (d, y) points of the outer surface, from the eave up: d is
    the distance of the flat panel face from the axis, y the height above
    `at` (the base centre in root pivot space). Panel k faces -Z turned by
    k·360/n about +Y. `paint_gore(g, k, segs)` paints panel k; `segs` lists
    (mask, s, u, length, width) per segment (s runs up the slope, u across).
    Returns the parts (already added to `root`)."""
    tan = math.tan(math.pi / n)
    dmax = max(d for d, _ in rings)
    ymax = max(y for _, y in rings)
    zc = int(math.ceil(dmax + 3))  # the dome axis in part grid z
    wmax = 2 * dmax * tan + rib_w + 4
    gw = int(math.ceil(wmax)) + 2
    xc = gw / 2
    parts = []
    for k in range(n):
        g = Grid(gw, int(math.ceil(ymax + 4 + YO)), zc + 2)
        segs = []
        for (d0, y0), (d1, y1) in zip(rings, rings[1:]):
            half = d1 * tan + 0.5  # the chord at the top edge: no spikes
            quad = _slab(d0, y0, d1, y1, 0.0, thick)
            g.prism("x", [(y + YO, zc - d) for d, y in quad], xc - half, xc + half, C(skin, 5))
            m = last(g)
            X, Y, Z = coords(g)
            length = math.hypot(d1 - d0, y1 - y0)
            s = ((zc - Z - d0) * (d1 - d0) + (Y - YO - y0) * (y1 - y0)) / length  # distance up the slope
            segs.append((m, s, X - xc, length, 2 * half))
            P.flat(g, m, skin, 5)
        if paint_gore:
            paint_gore(g, k, segs)
        parts.append(root.add(Part(f"{name}-{k:02d}", g, pivot=(xc, float(YO), float(zc)), at=at, rot=(0.0, 360.0 * k / n, 0.0))))
        # the rib on the seam at +half a panel, along the corner line
        rg = Grid(int(math.ceil(rib_w)) + 4, int(math.ceil(ymax + 6 + YO)), int(math.ceil(dmax / math.cos(math.pi / n))) + 6)
        rzc = rg.shape[2] - 2
        rxc = rg.shape[0] / 2
        sc = 1 / math.cos(math.pi / n)
        pts = [(d * sc, y) for d, y in rings]
        for (d0, y0), (d1, y1) in zip(pts, pts[1:]):
            quad = _slab(d0, y0 - 0.5, d1, y1 + 0.5, 1.5, 3.0)
            rg.prism("x", [(y + YO, rzc - d) for d, y in quad], rxc - rib_w / 2, rxc + rib_w / 2, C(rib, 4))
        rm = rg.a > 0
        X, Y, Z = coords(rg)
        P.flat(rg, rm, rib, 4)
        P.flat(rg, rm & (np.abs(X - rxc) > rib_w / 2 - 1), rib, 3)  # dark edges
        P.flat(rg, rm & (np.abs(X - rxc) < 0.6) & (np.floor(Y) % 5 == 2), rib, 6)  # rivets
        parts.append(root.add(Part(f"{name}-rib-{k:02d}", rg, pivot=(rxc, float(YO), float(rzc)), at=at, rot=(0.0, 360.0 * (k + 0.5) / n, 0.0))))
    return parts
