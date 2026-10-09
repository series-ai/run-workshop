"""Helpers for the monster props, in the Pirate Nation haunted style.

Art direction: docs/art-direction.md. Big chunky volumes (F1), true
slopes (F2), detail painted on flat faces (S1-S4). These add the props
motifs that the shared kit (pnkit, pnshapes, paint, pnpaint, pnglyph) does
not have: the PN coffin, dog-bone bones, chunky candles, leaning flame
tongues, hanging chains, dirt mounds, grass tufts, stone plinths and the
asset wrapper. Every shape fills the grid, paints itself and returns the
mask of the voxels it added.

Files that start with "_" are not built.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnshapes as S
from pnkit import box, edges
from voxgrid import C, Asset, Grid, Part, Prism, Socket, bounds_pivot

PACK = "monster"


# ---------------------------------------------------------------- asset
def prop(slug: str, name: str, g: Grid, children=(), sockets=()) -> Asset:
    """A props asset from one grid (plus optional child parts). The export
    centres the model on its full bounds, so the pivot only matters for
    children that hinge or spin."""
    root = Part(slug, g, pivot=bounds_pivot(g))
    for ch in children:
        root.add(ch)
    return Asset(id=f"{PACK}-props-{slug}", pack=PACK, category="props", name=name, root=root, sockets=list(sockets))


def idx(g: Grid):
    """Integer voxel indices (X, Y, Z)."""
    return np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")


def last(g: Grid) -> np.ndarray:
    return g.solids[-1].mask(g.shape)


def union(g: Grid, start: int) -> np.ndarray:
    """Mask of every prism added since g.solids had `start` entries."""
    m = np.zeros(g.shape, dtype=bool)
    for s in g.solids[start:]:
        m |= s.mask(g.shape)
    return m


# ---------------------------------------------------------------- polygons
def offset_poly(poly, d: float) -> list[tuple[float, float]]:
    """Grow a convex polygon by `d` (shrink with d < 0): every edge moves out
    by d and the corners are the new edge crossings."""
    n = len(poly)
    area = sum(poly[k][0] * poly[(k + 1) % n][1] - poly[(k + 1) % n][0] * poly[k][1] for k in range(n))
    sgn = 1.0 if area > 0 else -1.0
    lines = []
    for k in range(n):
        (x0, y0), (x1, y1) = poly[k], poly[(k + 1) % n]
        ex, ey = x1 - x0, y1 - y0
        L = math.hypot(ex, ey)
        nx, ny = sgn * ey / L, -sgn * ex / L  # outward normal
        lines.append(((x0 + nx * d, y0 + ny * d), (ex, ey)))
    out = []
    for k in range(n):
        (p, e), (q, f) = lines[k - 1], lines[k]
        den = e[0] * f[1] - e[1] * f[0]
        if abs(den) < 1e-9:
            out.append(q)
            continue
        t = ((q[0] - p[0]) * f[1] - (q[1] - p[1]) * f[0]) / den
        out.append((p[0] + e[0] * t, p[1] + e[1] * t))
    return out


def coffin_poly(cx: float, cz: float, L: float, W: float, along: str = "x", head: float = 0.62, foot: float = 0.46, shoulder: float = 0.3) -> list[tuple[float, float]]:
    """Top-view outline (x, z) of the PN coffin: a long hexagon whose widest
    point (the shoulders) is `shoulder` of the length from the head end.
    The head end is at the low end of `along`."""
    a0, a1 = -L / 2, L / 2
    sh = a0 + L * shoulder
    pts = [(a0, -W * head / 2), (sh, -W / 2), (a1, -W * foot / 2), (a1, W * foot / 2), (sh, W / 2), (a0, W * head / 2)]
    if along == "x":
        return [(cx + a, cz + b) for a, b in pts]
    return [(cx + b, cz + a) for a, b in pts]


# ---------------------------------------------------------------- materials
def masonry(g: Grid, m: np.ndarray, ramp: str = "gray", base: int = 4, block=(6, 4), frame=None, seed: int = 0) -> np.ndarray:
    """Stone blocks with 1-voxel mortar and a darker outline on the edges."""
    P.stone(g, m, ramp, base, block=block, frame=frame, seed=seed)
    P.flat(g, edges(m), ramp, max(1, base - 1))
    return m


def planked(g: Grid, m: np.ndarray, ramp: str = "wood", base: int = 4, width: int = 3, across: str = "y", frame=None, nails: bool = True, seed: int = 0) -> np.ndarray:
    """Boards with dark seams and a darker frame on the edges (rule S4)."""
    P.planks(g, m, ramp, base, width=width, across=across, nails=nails, frame=frame, seed=seed)
    P.flat(g, edges(m), ramp, max(1, base - 2))
    return m


def facet_paint(g: Grid, start: int, painter) -> None:
    """Paint every face of the prisms added since `start` with its own frame."""
    S.paint_facets(g, g.solids[start:], painter)


# ---------------------------------------------------------------- ground
def mound(g: Grid, cx, cz, r: float, h: float, y0: float = 0, top: float = 0.6, n: int = 8, ramp: str = "wood", base: int = 3, moss: float = 0.12, seed: int = 0) -> np.ndarray:
    """A low faceted dirt mound (an n-gon frustum): painted soil clods and
    moss patches. `top` is the top radius as a share of r."""
    start = len(g.solids)
    S.cone(g, "y", cx, cz, r, y0, y0 + h, ramp, base, n=n, r_top=r * top)
    m = union(g, start)
    P.mottle(g, m, ramp, base, cell=2, seed=seed)
    X, Y, Z = idx(g)
    clod = (P._hash(X // 2, Z // 2, Y, seed=seed + 1) % np.uint64(9)) == 0
    P.flat(g, m & clod, ramp, max(1, base - 1))
    if moss:
        from pnpaint import blotch

        blotch(g, m, "moss", 5, cell=2, chance=moss, seed=seed + 2)
    return m


def grave(g: Grid, x0, z0, x1, z1, h: float = 3, y0: float = 0, inset: float = 2, ramp: str = "wood", base: int = 3, moss: float = 0.1, seed: int = 0) -> np.ndarray:
    """A long grave mound: a box frustum (true slopes on all four sides) of
    painted soil with moss patches."""
    g.prism("y", [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y0, y0 + h, C(ramp, base), top=[(x0 + inset, z0 + inset), (x1 - inset, z0 + inset), (x1 - inset, z1 - inset), (x0 + inset, z1 - inset)])
    m = last(g)
    P.mottle(g, m, ramp, base, cell=2, seed=seed)
    X, Y, Z = idx(g)
    P.flat(g, m & ((P._hash(X // 2, Z // 2, Y, seed=seed + 1) % np.uint64(9)) == 0), ramp, max(1, base - 1))
    if moss:
        from pnpaint import blotch

        blotch(g, m, "moss", 5, cell=2, chance=moss, seed=seed + 2)
    return m


def flowers(g: Grid, spots, y0: int, heads=(("magenta", 6), ("purple", 6), ("bone", 7))) -> np.ndarray:
    """A few wilted flowers: a moss stem 2-3 tall and a 2×1×2 bloom."""
    m = np.zeros(g.shape, dtype=bool)
    for k, (fx, fz) in enumerate(spots):
        h = 2 + k % 2
        m |= box(g, fx, y0, fz, fx + 1, y0 + h, fz + 1, "moss", 4)
        m |= box(g, fx - (k % 2), y0 + h, fz, fx + 1, y0 + h + 1, fz + 2, *heads[k % len(heads)])
    return m


def tufts(g: Grid, spots, ramp: str = "moss", base: int = 5, y0: int = 0) -> np.ndarray:
    """Little grass tufts (three blades each) at (x, z) spots."""
    m = np.zeros(g.shape, dtype=bool)
    for k, (tx, tz) in enumerate(spots):
        for dx, dz, th in ((0, 0, 4), (1, 1, 2), (-1, 1, 3)):
            m |= box(g, tx + dx, y0, tz + dz, tx + dx + 1, y0 + th, tz + dz + 1, ramp, min(7, base + (th + k) % 2))
    return m


def plinth(g: Grid, x0, z0, x1, z1, y0, h, ramp: str = "gray", base: int = 4, bevel: float = 1.5, seed: int = 0) -> np.ndarray:
    """A stone plinth whose top edge is a true chamfer (a frustum band)."""
    m = box(g, x0, y0, z0, x1, y0 + h - bevel, z1, ramp, base)
    start = len(g.solids)
    g.prism("y", [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y0 + h - bevel, y0 + h, C(ramp, base + 1), top=[(x0 + bevel, z0 + bevel), (x1 - bevel, z0 + bevel), (x1 - bevel, z1 - bevel), (x0 + bevel, z1 - bevel)])
    cap = union(g, start)
    P.stone(g, m, ramp, base, block=(6, 4), seed=seed)
    P.flat(g, edges(m), ramp, max(1, base - 1))
    facet_paint(g, start, lambda gg, mm, fr: P.stone(gg, mm, ramp, base + 1, block=(5, 3), frame=fr, seed=seed + 1))
    return m | cap


# ---------------------------------------------------------------- the shared PN flame (outlines and colours)
# Flame outlines in (u, v): u across in half widths (-1..1), v up (0..1).
# BIG: a round belly and three licking tongues (the tallest leans right).
# SMALL: a candle flame, a belly and one leaning tongue with a small lick.
FLAME_BIG = [(-0.42, 0.0), (0.42, 0.0), (0.82, 0.1), (1.0, 0.3), (0.95, 0.5), (0.8, 0.8), (0.52, 0.52), (0.42, 0.72),
             (0.3, 0.88), (0.2, 1.0), (-0.05, 0.8), (-0.22, 0.58), (-0.5, 0.72), (-0.66, 0.66), (-0.92, 0.46), (-1.0, 0.28), (-0.82, 0.1)]
FLAME_SMALL = [(-0.5, 0.0), (0.5, 0.0), (0.92, 0.22), (0.92, 0.45), (0.55, 0.72), (0.3, 1.0), (-0.02, 0.72), (-0.45, 0.58),
               (-0.92, 0.36), (-0.9, 0.14)]
# Bands from the outside in: (u scale, v scale) of the outline about its foot.
FLAME_BANDS = ((0.8, 0.84), (0.52, 0.6))
WARM = (("orange", 4), ("ember", 3), ("ember", 5))
TOXIC = (("toxic", 4), ("toxic", 6), ("toxic", 7))
MAGENTA = (("magenta", 4), ("magenta", 6), ("magenta", 7))


# ---------------------------------------------------------------- motifs
def coffin(g: Grid, cx, cz, y0, L: float, W: float, H: int, along: str = "x", wood: str = "wood", base: int = 3, lid: str = "wood", lid_base: int = 4, cross=("gold", 5), handles: bool = True, open_lining: str | None = None, lid_turn: float = 0.0, lid_shift=(0.0, 0.0), lid_lift: float = 0.0, seed: int = 0) -> np.ndarray:
    """The PN coffin (decorations-decoration-1x2-coffin): a long hexagon box
    of dark boards with a thick overhanging lid carrying a raised cross.
    The head end is at the low end of `along`. With `open_lining`, the box
    top shows a satin lining inside a wooden rim and the lid lies askew
    (turned `lid_turn` degrees about its centre, moved by `lid_shift` (x, z),
    raised by `lid_lift`). Returns the mask."""
    poly = coffin_poly(cx, cz, L, W, along)
    body_top = y0 + H - 2
    g.prism("y", poly, y0, body_top, C(wood, base))
    body = last(g)
    P.planks(g, body, wood, base, width=3, across="y", nails=False, seed=seed)
    X, Y, Z = idx(g)
    P.flat(g, body & (Y == y0), wood, max(1, base - 1))
    P.flat(g, body & S.seams(g, [g.solids[-1]], 0.8) & (Y < body_top - 1), wood, max(1, base - 2))
    P.flat(g, body & (Y == body_top - 1) & S.seams(g, [g.solids[-1]], 1.2), wood, min(7, base + 1))
    m = body
    lid_poly = offset_poly(poly, 0.8)
    ly = body_top
    if open_lining:
        inside = Prism("y", offset_poly(poly, -1.6), body_top - 1, body_top).mask(g.shape)
        P.flat(g, body & inside, open_lining, 4)
        P.flat(g, body & inside & ((X + Z) % 3 == 0), open_lining, 5)
        lid_poly = S.rotate(offset_poly(poly, 0.4), cx, cz, lid_turn)
        lid_poly = [(u + lid_shift[0], v + lid_shift[1]) for u, v in lid_poly]
        ly = body_top + lid_lift
    g.prism("y", lid_poly, ly, ly + 2, C(lid, lid_base))
    lm = last(g)
    P.planks(g, lm, lid, lid_base, width=3, across="y" if along == "x" else "x", nails=True, frame="top", seed=seed + 1)
    P.flat(g, lm & (Y == int(ly)), lid, max(1, lid_base - 2))
    P.outline(g, lm & (Y == int(ly) + 1), lid, max(1, lid_base - 1), normal="y")
    m |= lm
    if cross:
        lx = sum(p[0] for p in lid_poly) / len(lid_poly)
        lz = sum(p[1] for p in lid_poly) / len(lid_poly)
        ct = int(ly) + 2
        a = L * 0.26
        if along == "x":
            hx = lx - L * 0.06
            cm = box(g, hx - a, ct, lz - 1, hx + a, ct + 1, lz + 1, *cross)
            cm |= box(g, hx - a * 0.45 - 1, ct, lz - W * 0.26, hx - a * 0.45 + 1, ct + 1, lz + W * 0.26, *cross)
        else:
            hz = lz - L * 0.06
            cm = box(g, lx - 1, ct, hz - a, lx + 1, ct + 1, hz + a, *cross)
            cm |= box(g, lx - W * 0.26, ct, hz - a * 0.45 - 1, lx + W * 0.26, ct + 1, hz - a * 0.45 + 1, *cross)
        P.flat(g, cm & (((X + Z) % 4) == 0), cross[0], min(7, cross[1] + 1))
        m |= cm
    if handles:
        hy = y0 + max(1, (H - 2) // 2 - 1)

        def half(t):  # half-width of the outline at t along the length (0 = head)
            sh = 0.3
            if t <= sh:
                return W / 2 * (0.62 + (1 - 0.62) * t / sh)
            return W / 2 * (1 - (1 - 0.46) * (t - sh) / (1 - sh))

        for t in (0.42, 0.72):
            a = -L / 2 + L * t
            hw = half(t)
            for s in (-1, 1):
                w0, w1 = (hw - 0.6, hw + 1) if s > 0 else (-hw - 1, -hw + 0.6)
                if along == "x":
                    m |= box(g, cx + a - 2, hy, cz + w0, cx + a + 2, hy + 1, cz + w1, "gold", 3)
                else:
                    m |= box(g, cx + w0, hy, cz + a - 2, cx + w1, hy + 1, cz + a + 2, "gold", 3)
    return m


def bone(g: Grid, axis: str, p0, p1, lo, hi, r: float = 1.2, ramp: str = "bone", base: int = 6) -> np.ndarray:
    """A chunky cartoon bone (a dog bone): a bar from p0 to p1 in the plane
    across `axis` (PRISM_PLANE order) with two round knuckles at each end."""
    m = S.bar(g, axis, p0, p1, 2 * r, lo, hi, ramp, base)
    (u0, v0), (u1, v1) = p0, p1
    L = math.hypot(u1 - u0, v1 - v0)
    du, dv = (u1 - u0) / L, (v1 - v0) / L
    nu, nv = -dv, du
    k = r * 1.05
    for (eu, ev), s in ((p0, 1), (p1, -1)):
        for side in (-1, 1):
            cu, cv = eu + side * nu * k + s * du * 0.2, ev + side * nv * k + s * dv * 0.2
            g.prism(axis, S.flat_ngon(cu, cv, r * 1.15, 6), lo, hi, C(ramp, base))
            m |= last(g)
    P.flat(g, m & S.seams(g, g.solids[-5:], 0.6), ramp, base - 1)
    return m


def big_skull(g: Grid, cx, y0, cz, s: int = 10, base: int = 6, eyes=("toxic", 6), seed: int = 0) -> np.ndarray:
    """pnshapes.skull with PN-sized features: big square dark sockets with
    glowing pupils, a nose notch and a row of teeth, so the face reads from
    a distance (the kit skull paints small sockets). Faces -z."""
    m = S.skull(g, cx, y0, cz, s=s, ramp="bone", base=base, eyes=eyes, socket=("purple", 1), seed=seed)
    Xc, Yc, Zc = S.coords(g)
    jaw_h = max(3, round(s * 0.3))
    yc0 = y0 + jaw_h - 1
    yc1 = yc0 + round(s * 0.55)
    b = s * 0.45
    face = m & (Zc < cz - b + 1.2)
    e = max(2.0, round(s * 0.34))
    ex = s * 0.25
    ey = yc0 + (yc1 - yc0) * 0.6
    for sx in (-1, 1):
        ux = cx + sx * ex
        sock = face & (np.abs(Xc - ux) < e / 2 + 0.01) & (np.abs(Yc - ey) < e / 2 + 0.01)
        P.flat(g, sock, "purple", 1)
        P.flat(g, sock & (np.abs(Xc - ux - sx * 0.5) < 0.8) & (np.abs(Yc - ey - 0.5) < 0.8), *eyes)
    nose = face & (np.abs(Xc - cx) < 1.01) & (Yc < ey - e / 2) & (Yc > ey - e / 2 - 2)
    P.flat(g, nose, "purple", 1)
    teeth = face & (Yc > yc0 - 2) & (Yc < yc0 + 1) & (np.abs(Xc - cx) < s * 0.3)
    P.flat(g, teeth, "bone", min(7, base + 1))
    P.flat(g, teeth & (np.floor(Xc - cx) % 2 == 0), "purple", 2)
    return m


def candle(g: Grid, x, y0, z, h: int = 6, w: int = 2, wax: str = "bone", wax_base: int = 6, flame=WARM, drips: bool = True) -> dict:
    """A chunky candle: a w×h×w wax block with painted drips, lit with a
    small shared PN flame (pn_flame, FLAME_SMALL) of height 2w+2. `flame`
    is its colour set (WARM, TOXIC or MAGENTA). (x, z) is the low corner.
    Returns {'mask', 'flame' (centre)}."""
    m = box(g, x, y0, z, x + w, y0 + h, z + w, wax, wax_base)
    X, Y, Z = idx(g)
    P.flat(g, m & (Y == y0 + h - 1), wax, min(7, wax_base + 1))
    if drips:
        drip = m & (((X + Z) % 2) == 0) & (Y >= y0 + h - 1 - ((X * 3 + Z) % 3))
        P.flat(g, drip, wax, min(7, wax_base + 1))
        P.flat(g, m & (Y == y0), wax, max(1, wax_base - 2))
    fx, fz = x + w / 2, z + w / 2
    fy = y0 + h
    fh = 2 * w + 2
    fm = pn_flame(g, fx, fz, fy, w + 2, fh, kind="small", colors=flame)
    return {"mask": m | fm, "flame": (fx, fy + fh * 0.4, fz)}


def chain(g: Grid, x, z, y_top: int, links: int, ramp: str = "iron", base: int = 6, along: str = "x") -> np.ndarray:
    """A hanging chain of `links` alternating links (3 tall, 1 overlap)
    from y_top downwards; (x, z) is the centre line. Returns the mask."""
    m = np.zeros(g.shape, dtype=bool)
    y = y_top
    for k in range(links):
        wide = (k % 2 == 0) == (along == "x")
        if wide:
            m |= box(g, x - 1, y - 3, z - 0.5, x + 1, y, z + 0.5, ramp, base if k % 2 else base - 1)
        else:
            m |= box(g, x - 0.5, y - 3, z - 1, x + 0.5, y, z + 1, ramp, base if k % 2 else base - 1)
        y -= 2
    return m


def shackle(g: Grid, x, y, z, ramp: str = "iron", base: int = 6, face: str = "z") -> np.ndarray:
    """An open manacle: an octagonal iron ring (a disc facing `face`) with a
    painted hole, 5 across and 2 thick; (x, y, z) is its centre."""
    axis = face
    cu, cv = (x, y) if axis == "z" else ((y, z) if axis == "x" else (x, z))
    lo = (z if axis == "z" else (x if axis == "x" else y)) - 1
    m = S.disc(g, axis, cu, cv, 2.5, lo, lo + 2, ramp, base)
    rr = S.radial(g, axis, cu, cv)
    P.flat(g, m & (rr < 1.3), ramp, max(1, base - 3))
    return m


def sign(g: Grid, face: str, plane, u0, u1, v0, v1, words: str, paper=("bone", 7), ink=("blood", 4), scale: int = 1) -> np.ndarray:
    """A pinned paper notice 1 voxel proud of a face, with painted words and
    two nail heads."""
    import pnglyph
    from pnkit import on_face

    m = box(g, *on_face(face, plane, u0, u1, v0, v1, 0, 1), *paper)
    P.mottle(g, m, paper[0], paper[1], cell=2)
    P.outline(g, m, paper[0], paper[1] - 2, normal="z" if face[1] == "z" else ("x" if face[1] == "x" else "y"))
    tw, th = pnglyph.text_size(words, scale)
    uc, vc = (u0 + u1) / 2, (v0 + v1) / 2
    pnglyph.text(g, face, plane - 1 if face[0] == "-" else plane + 1, int(round(uc - tw / 2)), int(round(vc - th / 2)), words, *ink, scale=scale)
    return m


# ---------------------------------------------------------------- dungeon kit
KIT_H = 48  # wall height of the dungeon kit pieces
KIT_T = 8  # wall core thickness; the plinth and cap courses stand 1 proud on both faces


def dungeon_run(g: Grid, axis: str, a0: float, a1: float, c0: float, H: int = KIT_H, seed: int = 0) -> dict:
    """One straight run of dungeon wall along `axis` ('x' or 'z') from a0 to
    a1, its core c0..c0+KIT_T across. Grey stone blocks, a purple slate
    plinth course (4 tall) and cap course (3 tall) 1 voxel proud on both
    faces, flush at the run ends so pieces line up. Returns the masks
    {'core', 'plinth', 'cap'}."""
    c1 = c0 + KIT_T

    def run(lo, hi, out, ramp, base):
        if axis == "x":
            return box(g, a0, lo, c0 - out, a1, hi, c1 + out, ramp, base)
        return box(g, c0 - out, lo, a0, c1 + out, hi, a1, ramp, base)

    core = run(4, H - 3, 0, "gray", 4)
    P.stone(g, core, "gray", 4, block=(8, 4), cracks=0.05, seed=seed)
    plinth = run(0, 4, 1, "purple", 3)
    P.stone(g, plinth, "purple", 3, block=(8, 4), seed=seed + 1)
    cap = run(H - 3, H, 1, "purple", 5)
    P.stone(g, cap, "purple", 5, block=(6, 3), seed=seed + 2)
    X, Y, Z = idx(g)
    P.stone(g, cap & (Y == H - 1), "purple", 6, block=(6, 4), frame="top", seed=seed + 3)
    P.flat(g, plinth & (Y == 3), "purple", 4)
    return {"core": core, "plinth": plinth, "cap": cap}


def damp(g: Grid, m: np.ndarray, seed: int = 0) -> None:
    """Moss patches along the foot of a wall."""
    from pnpaint import blotch

    X, Y, Z = idx(g)
    blotch(g, m & (Y < 7), "moss", 5, cell=2, chance=0.14, seed=seed)


def torch(g: Grid, face: str, plane: float, u: float, v: float, flame=WARM) -> np.ndarray:
    """A wall torch on a face ('-z', '+z', '-x', '+x'): an iron bracket 3 proud,
    a wood handle and the shared PN flame (turned to face out of the wall,
    with a crossing flame for the side view). (u, v) is the bracket centre."""
    from pnkit import on_face

    m = box(g, *on_face(face, plane, u - 1.5, u + 1.5, v - 2, v, 0, 3), "iron", 6)
    x0, y0, z0, x1, y1, z1 = on_face(face, plane, u - 1, u + 1, v, v + 5, 2, 4)
    m |= box(g, x0, y0, z0, x1, y1, z1, "wood", 5)
    fx, fz = (x0 + x1) / 2, (z0 + z1) / 2
    m |= pn_flame(g, fx, fz, v + 5, 6, 9, colors=flame, axis=face[1], cross=0.7)
    return m

# ---------------------------------------------------------------- the shared PN flame (shapes)
def flame_outline(kind: str, cu: float, v0: float, hw: float, h: float, mirror: bool = False, su: float = 1.0, sv: float = 1.0) -> list[tuple[float, float]]:
    """A flame outline (see FLAME_BIG, FLAME_SMALL) in grid units: centred on
    cu, foot at v0, half width hw, height h; `su`, `sv` shrink it about
    its foot (for the nested colour bands)."""
    base = FLAME_BIG if kind == "big" else FLAME_SMALL
    m = -1.0 if mirror else 1.0
    return [(cu + m * u * hw * su, v0 + v * h * sv) for u, v in base]


def pn_flame(g: Grid, cx: float, cz: float, y0: float, w: float, h: float, kind: str = "big", colors=WARM, depth=(0.22, 0.38, 0.54), axis: str = "z", cross: float = 0.0) -> np.ndarray:
    """The shared PN flame: three nested flame slabs, like a cartoon fire
    drawn in layers. The outer flame (a round belly and a few licking
    tongues) is the thinnest; the smaller middle and core flames stand out
    further on both faces, so the bands are real steps and the flame has
    depth from every side. `colors` = (outer, mid, core); `w`, `h` are the
    full width and height; `depth` gives each slab's thickness as a share
    of w; `axis` is the direction the faces look ('z' or 'x'); `cross` > 0
    adds a second, mirrored flame of that scale across the first, so the
    fire also has tongues seen from the side."""
    start = len(g.solids)

    def layers(ax: str, scale: float, mirror: bool) -> None:
        cu, cw = (cx, cz) if ax == "z" else (cz, cx)
        for k, (su, sv) in enumerate(((1.0, 1.0),) + FLAME_BANDS):
            out = flame_outline(kind, cu, y0, w / 2 * scale, h * scale, mirror=mirror, su=su, sv=sv)
            if ax == "x":  # PRISM_PLANE order for x is (y, z)
                out = [(v, u) for u, v in out]
            t = max(1.0, w * depth[k] * scale)
            g.prism(ax, out, cw - t / 2, cw + t / 2, C(*colors[k]))

    layers(axis, 1.0, False)
    if cross > 0:
        layers("x" if axis == "z" else "z", cross, True)
    return union(g, start)
