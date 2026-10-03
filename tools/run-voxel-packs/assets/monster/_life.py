"""Monster pack helpers for the 'life' scope: animated props, creatures,
terrain and nature, in the Pirate Nation haunted style.

Art direction: docs/art-direction.md. Few big volumes (F1), true
slopes (F2), chunky caricature features (F4, K3), detail as paint (S1–S4).
These helpers add prism shortcuts, limbs, chains, candles, glowing eyes and
the haunted material presets to the shared kit. Faces -Z (the front).
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _pn import assemble, coords, crop, fur, last, quad, rotate, stamp  # noqa: F401
from pnkit import box, edges  # noqa: F401
from voxgrid import C, Grid

# ------------------------------------------------------------------ prisms


def side(g: Grid, pts_yz, x0, x1, ramp: str, shade: int, top=None) -> np.ndarray:
    """A prism across x from a side-view (y, z) polygon."""
    g.prism("x", list(pts_yz), x0, x1, C(ramp, shade), top=top)
    return last(g)


def front(g: Grid, pts_xy, z0, z1, ramp: str, shade: int, top=None) -> np.ndarray:
    """A prism along z from a front-view (x, y) polygon."""
    g.prism("z", list(pts_xy), z0, z1, C(ramp, shade), top=top)
    return last(g)


def plan(g: Grid, pts_xz, y0, y1, ramp: str, shade: int, top=None) -> np.ndarray:
    """A prism up y from a plan-view (x, z) polygon (`top` makes a frustum)."""
    g.prism("y", list(pts_xz), y0, y1, C(ramp, shade), top=top)
    return last(g)


def octo(cx, cz, hx, hz, ch) -> list[tuple[float, float]]:
    """A chamfered rectangle (x, z) centred on (cx, cz): half sizes hx, hz,
    corner cut ch. Use it for chunky heads, bodies and plinths."""
    return [(cx - hx + ch, cz - hz), (cx + hx - ch, cz - hz), (cx + hx, cz - hz + ch), (cx + hx, cz + hz - ch),
            (cx + hx - ch, cz + hz), (cx - hx + ch, cz + hz), (cx - hx, cz + hz - ch), (cx - hx, cz - hz + ch)]


def chunk(g: Grid, cx, cz, y0, y1, hx, hz, ch, ramp: str, shade: int, taper: float = 0.0, lean=(0.0, 0.0)) -> np.ndarray:
    """A chamfered block up y (a chunky head, torso or rock): its top is
    `taper` smaller on each side and shifted by `lean` (dx, dz)."""
    base = octo(cx, cz, hx, hz, ch)
    t = octo(cx + lean[0], cz + lean[1], max(0.6, hx - taper), max(0.6, hz - taper), max(0.0, ch - taper * 0.5))
    return plan(g, base, y0, y1, ramp, shade, top=t)


def limb(g: Grid, axis: str, p0, p1, r0: float, r1: float, lo, hi, ramp: str, shade: int, cap: float = 0.5) -> np.ndarray:
    """A faceted limb: a thick 2D segment p0→p1 (in the plane across `axis`,
    PRISM_PLANE order) with pointed ends, extruded over [lo, hi)."""
    g.prism(axis, quad(p0, p1, r0, r1, cap=cap), lo, hi, C(ramp, shade))
    return last(g)


def claw(g: Grid, axis: str, p0, p1, w: float, lo, hi, ramp: str = "bone", shade: int = 6) -> np.ndarray:
    """A pointed claw, fang or thorn: a triangle from a base of half-width w
    at p0 to a point at p1, extruded over [lo, hi)."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(dx, dy)
    nx, ny = -dy / n * w, dx / n * w
    g.prism(axis, [(p0[0] + nx, p0[1] + ny), p1, (p0[0] - nx, p0[1] - ny)], lo, hi, C(ramp, shade))
    return last(g)


# ------------------------------------------------------------------ motifs


def chain(g: Grid, p0, p1, link: int = 3, ramp: str = "steel", shade: int = 4) -> np.ndarray:
    """A chunky chain from p0 to p1 (voxel centres, straight line): links of
    `link` voxels that turn 90° each step, painted with a dark hole and a
    lit edge. Returns the mask."""
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    d = p1 - p0
    n = max(1, int(round(np.linalg.norm(d) / (link - 0.5))))
    m = np.zeros(g.shape, dtype=bool)
    main = int(np.argmax(np.abs(d)))
    for k in range(n + 1):
        c = p0 + d * k / n
        half = [1.0, 1.0, 1.0]
        half[main] = link / 2
        other = [a for a in range(3) if a != main][k % 2]
        half[other] = 0.5
        lo = [int(math.floor(c[a] - half[a] + 0.5)) for a in range(3)]
        hi = [lo[a] + max(1, int(round(2 * half[a]))) for a in range(3)]
        mm = box(g, *lo, *hi, ramp, shade + (k % 2))
        m |= mm
    return m


def candle(g: Grid, x, y0, z, h: int = 5, w: int = 2, wax: str = "bone", lit: bool = True) -> np.ndarray:
    """A chunky candle: a w×w wax stick h tall with a drip, lit with a small
    shared PN flame (_props.pn_flame)."""
    m = box(g, x, y0, z, x + w, y0 + h, z + w, wax, 6)
    P.flat(g, m & (coords(g)[1] == y0 + h - 1), wax, 7)
    P.flat(g, m & (coords(g)[0] == x) & (coords(g)[2] == z) & (coords(g)[1] >= y0 + h - 3), wax, 7)
    if lit:
        from _props import pn_flame

        m |= pn_flame(g, x + w / 2, z + w / 2, y0 + h, w + 2, 2 * w + 3, kind="small")
    return m


def eyes(g: Grid, face: str, plane, u0: int, v0: int, gap: int, size: int = 3, glow=("toxic", 6), rim=("purple", 1), pupil=True, depth: int = 3) -> None:
    """Two big glowing cartoon eyes painted on a face (rule K3): each a
    size×size glow square with a dark rim, a bright glint and a dark pupil.
    `u0` is the viewer's-left eye's low-u corner, `gap` the space between."""
    s = size + 2
    row_rim = "r" * s
    rows = [row_rim + "." * gap + row_rim]
    for k in range(size):
        inner = "".join("w" if (k == 0 and j == 0) else ("p" if pupil and k == size - 1 and j == size - 1 else "o") for j in range(size))
        rows.append("r" + inner + "r" + "." * gap + "r" + inner + "r")
    rows.append(row_rim + "." * gap + row_rim)
    legend = {"r": C(*rim), "o": C(*glow), "w": C(glow[0], 7), "p": C(rim[0], max(1, rim[1]))}
    pnglyph.stamp(g, face, plane, u0, v0, rows, legend, depth=2, reach=depth)


# ------------------------------------------------------------------ painters


def iron(g: Grid, mask: np.ndarray, base: int = 4, size=(6, 5), frame=None, seed: int = 0) -> None:
    """Blackened iron in the haunted theme: riveted steel-grey plates with
    dark borders (never near-black, rule C2)."""
    P.plates(g, mask, "gray", base, size=size, frame=frame, seed=seed)


def bark(g: Grid, mask: np.ndarray, ramp: str = "wood", base: int = 3, frame=None, seed: int = 0) -> None:
    """Bark: vertical plank streaks with dark furrows (thin strips, no nails)."""
    P.planks(g, mask, ramp, base, width=3, across="x", length=(6, 12), nails=False, frame=frame, seed=seed)


def stonework(g: Grid, mask: np.ndarray, ramp: str = "gray", base: int = 4, block=(6, 4), frame=None, seed: int = 0) -> None:
    """Grey haunted masonry: running-bond blocks, a few cracks."""
    P.stone(g, mask, ramp, base, block=block, cracks=0.1, frame=frame, seed=seed)


def slope_paint(g: Grid, solids, painter) -> None:
    """Paint every face of the given prisms with its own frame (F2 pitfall:
    patterns must follow the slope)."""
    import pnshapes

    for m, fr in pnshapes.facets(g, solids):
        painter(g, m, fr)


def moss_top(g: Grid, mask: np.ndarray, depth: int = 2, ramp: str = "moss", shade: int = 5, seed: int = 0, patchy: float = 1.0) -> None:
    """Moss on the upward surfaces of a mask: the top `depth` voxels of every
    column, with a broken lower edge. `patchy` < 1 keeps only that share of
    3-voxel cells, so the moss grows in clumps instead of covering every top."""
    filled = g.a > 0
    above = np.zeros_like(filled)
    above[:, :-1, :] = filled[:, 1:, :]
    up = mask & ~above
    X, Y, Z = coords(g)
    if patchy < 1.0:
        up &= (P._hash(X // 3, Y // 3, Z // 3, seed=seed + 7) % np.uint64(1000)) < np.uint64(int(patchy * 1000))
    hit = up.copy()
    for k in range(1, depth):
        shifted = np.zeros_like(up)
        shifted[:, :-k, :] = up[:, k:, :]
        keep = (P._hash(X, Z, k, seed=seed) % np.uint64(3)) != 0
        hit |= shifted & mask & keep
    P.flat(g, hit, ramp, shade)
    pnpaint.blotch(g, hit, ramp, shade + 1, cell=2, chance=0.15, seed=seed + 1)
