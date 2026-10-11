"""Pirate Nation haunted-style helpers for the monster pack.

Art direction: docs/art-direction.md. These add the PN haunted
motifs to the shared kit (pnkit.py): pointed gothic windows with a proud
stone hood, rose windows, crosses, pinnacles, blocky skulls, tombstones,
PN-style rib pumpkins, skull banners and painted pixel glyphs. Big chunky
volumes and true slopes; all small detail is paint (paint.py).

Faces: '-z' is the front. `plane` is the wall surface coordinate on that
face; `u` runs along the wall (x on z faces, z on x faces), `v` is height
and `d0..d1` is the depth out of the wall.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
from pnkit import box, ngon, on_face
from voxgrid import C, Grid


# ---------------------------------------------------------------- geometry
def coords(g: Grid):
    return np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")


def last(g: Grid) -> np.ndarray:
    """Mask of the prism added last."""
    return g.solids[-1].mask(g.shape)


def face_prism(g: Grid, face: str, plane: float, pts_uv, d0: float, d1: float, c: int) -> np.ndarray:
    """A prism on a wall face: polygon `pts_uv` in (u, v), extruded from
    depth d0 to d1 out of the wall. Returns its mask."""
    x0, _y0, z0, x1, _y1, z1 = on_face(face, plane, 0, 1, 0, 1, d0, d1)
    if face[1] == "z":
        g.prism("z", list(pts_uv), z0, z1, c)
    else:
        g.prism("x", [(v, u) for u, v in pts_uv], x0, x1, c)
    return last(g)


def quad(p0, p1, r0: float, r1: float | None = None, cap: float = 0.0) -> list[tuple[float, float]]:
    """A thick 2D segment from p0 to p1 (half-widths r0 → r1), as a hexagon
    when `cap` > 0 (pointed ends make faceted limbs)."""
    r1 = r0 if r1 is None else r1
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    nx, ny = -uy, ux
    pts = [(p0[0] + nx * r0, p0[1] + ny * r0), (p1[0] + nx * r1, p1[1] + ny * r1)]
    if cap:
        pts.append((p1[0] + ux * cap * r1, p1[1] + uy * cap * r1))
    pts += [(p1[0] - nx * r1, p1[1] - ny * r1), (p0[0] - nx * r0, p0[1] - ny * r0)]
    if cap:
        pts.append((p0[0] - ux * cap * r0, p0[1] - uy * cap * r0))
    return pts


def rotate(pts, cx: float, cy: float, degrees: float):
    a = math.radians(degrees)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * ca - (y - cy) * sa, cy + (x - cx) * sa + (y - cy) * ca) for x, y in pts]


def crop(g: Grid, margin: int = 1) -> tuple[Grid, tuple[int, int, int]]:
    """Crop a grid (voxels and prisms) to its filled bounds plus a margin.
    Returns (grid, offset of the crop in the source grid)."""
    nz = np.nonzero(g.a)
    if len(nz[0]) == 0:
        raise ValueError("crop of an empty grid")
    lo = [max(0, int(v.min()) - margin) for v in nz]
    hi = [min(n, int(v.max()) + 1 + margin) for v, n in zip(nz, g.shape)]
    out = Grid(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
    out.a = g.a[lo[0] : hi[0], lo[1] : hi[1], lo[2] : hi[2]].copy()
    out.solids = [s.shifted((-lo[0], -lo[1], -lo[2])) for s in g.solids]
    return out, (lo[0], lo[1], lo[2])


# ---------------------------------------------------------------- painting
def blotch(g: Grid, mask: np.ndarray, ramp: str, shade: int, cell: int = 3, chance: float = 0.1, seed: int = 0) -> None:
    """Irregular darker patches (worn or missing roof tiles, PN haunted)."""
    X, Y, Z = coords(g)
    hit = np.zeros(g.shape, dtype=bool)
    for k, (ox, oy) in enumerate(((0, 0), (1, 2), (2, 1))):
        h = P._hash((X + ox) // cell, (Y + oy) // cell, (Z + ox + oy) // cell, seed=seed + k)
        hit |= (h % np.uint64(1000)) < np.uint64(int(chance * 1000))
    P.flat(g, mask & hit, ramp, shade)


def fur(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, seed: int = 0) -> None:
    """Painted fur: short vertical strokes (1 wide, 3 tall) of one shade
    darker or lighter on a flat base, like PN painted hide. Soft ramp
    (rule S3): most texels stay on the base shade."""
    X, Y, Z = coords(g)
    col = X + Z
    stroke = P._hash(col, (Y + col % 3) // 3, seed=seed) % np.uint64(10)
    shade = base + np.where(stroke < 2, -1, np.where(stroke == 9, 1, 0))
    P._paint(g, mask, ramp, shade)


def stamp(g: Grid, face: str, plane: int, u0: int, v0: int, rows: list[str], legend: dict[str, int], depth: int = 6, carve: str = "") -> None:
    """Paint a pixel glyph on the first filled voxels seen from outside a
    face. rows[0] is the top row; columns read left to right as seen by a
    viewer outside the face. '.' or unknown characters are skipped.
    Characters in `carve` cut the surface voxel away (box voxels only) and
    paint the voxel behind it: a 1-voxel carved recess."""
    h, w = len(rows), max(len(r) for r in rows)
    for r, row in enumerate(rows):
        v = v0 + h - 1 - r
        for k, ch in enumerate(row):
            if ch not in legend:
                continue
            flip = face in ("-z", "+x")
            u = u0 + (w - 1 - k if flip else k)
            s = -1 if face[0] == "-" else 1
            start = plane - depth if s < 0 else plane + depth - 1
            for step in range(2 * depth):
                d = start + step if s < 0 else start - step
                if face[1] == "z":
                    x, y, z = u, v, d
                else:
                    x, y, z = d, v, u
                if not (0 <= x < g.shape[0] and 0 <= y < g.shape[1] and 0 <= z < g.shape[2]):
                    continue
                if g.a[x, y, z]:
                    if ch in carve:
                        g.a[x, y, z] = 0
                        bx, bz = (x, z - s) if face[1] == "z" else (x - s, z)
                        g.a[bx, y, bz] = legend[ch]
                    else:
                        g.a[x, y, z] = legend[ch]
                    break


SKULL_GLYPH = [
    "..#####..",
    ".#######.",
    "#########",
    "#oo###oo#",
    "#oo###oo#",
    "####.####",
    ".#######.",
    "..#.#.#..",
]


# ---------------------------------------------------------------- motifs
def lancet(g: Grid, face: str, plane, u0, u1, v0, v1, glass: str = "purple", shade: int = 2, frame: str = "gray", fshade: int = 6, mullion: bool = True, sill: bool = True, seed: int = 0) -> np.ndarray:
    """Pointed gothic window: a pane 1 voxel proud, set 1 voxel back inside
    a stone frame 2 voxels proud (jambs, sill and a pointed hood with true
    slopes). Mullion and transom are painted. Returns the pane mask."""
    w = u1 - u0
    cu = (u0 + u1) / 2
    rise = w * 0.75
    top = v1 - rise
    pane = face_prism(g, face, plane, [(u0, v0), (u1, v0), (u1, top), (cu, v1), (u0, top)], 0, 1, C(glass, shade))
    P.mottle(g, pane, glass, shade, cell=2, seed=seed)
    X, Y, Z = coords(g)
    U = X if face[1] == "z" else Z
    if mullion:
        P.flat(g, pane & (np.abs(U + 0.5 - cu) < 0.6), frame, fshade - 2)
        P.flat(g, pane & (Y == int((v0 + top) / 2)), frame, fshade - 2)
    fm = box(g, *on_face(face, plane, u0 - 2, u0, v0, top, 0, 2), frame, fshade) | box(g, *on_face(face, plane, u1, u1 + 2, v0, top, 0, 2), frame, fshade)
    t = 2.2
    fm |= face_prism(g, face, plane, [(u0 - 2, top), (u0, top), (cu, v1), (u1, top), (u1 + 2, top), (cu, v1 + t * 1.25)], 0, 2, C(frame, fshade))
    if sill:
        fm |= box(g, *on_face(face, plane, u0 - 3, u1 + 3, v0 - 2, v0, 0, 3), frame, fshade)
    P.stone(g, fm, frame, fshade, block=(5, 3), seed=seed + 1)
    return pane


def rose(g: Grid, face: str, plane, cu, cv, r: float, glass: str = "magenta", shade: int = 5, frame: str = "gray", fshade: int = 6, spokes: int = 8) -> np.ndarray:
    """Round rose window: an octagonal glowing pane recessed inside a
    two-piece octagonal stone ring, with painted spokes and hub."""
    pane = face_prism(g, face, plane, ngon(cu, cv, r, 8), 0, 1, C(glass, shade))
    outer = ngon(cu, cv, r + 3, 8)
    inner = ngon(cu, cv, r, 8)
    # the ring as two C-shaped halves (each a simple polygon)
    for half in (range(0, 5), range(4, 9)):
        ks = [k % 8 for k in half]
        pts = [outer[k] for k in ks] + [inner[k] for k in reversed(ks)]
        m = face_prism(g, face, plane, pts, 0, 2, C(frame, fshade))
        P.stone(g, m, frame, fshade, block=(4, 3), seed=3)
    X, Y, Z = coords(g)
    U = (X if face[1] == "z" else Z) + 0.5 - cu
    V = Y + 0.5 - cv
    ang = np.arctan2(V, U)
    rad = np.hypot(U, V)
    spoke = np.abs(((ang / (2 * math.pi) * spokes + 0.5) % 1) - 0.5) * 2 * math.pi * rad / spokes < 0.7
    P.flat(g, pane & (spoke | (rad < 2.2) | (np.abs(rad - r * 0.62) < 0.6)), frame, fshade - 2)
    P.flat(g, pane & (rad >= 2.2) & (rad < r * 0.62 - 0.6) & ~spoke, glass, min(7, shade + 2))
    return pane


def cross(g: Grid, cx, y0, cz, h: int = 16, arm: int = 5, t: int = 3, ramp: str = "gray", base: int = 5, horns: bool = True) -> np.ndarray:
    """PN haunted finial: a thick cross on a short post, with two curled
    horns rising from its foot (true slopes). Faces -z (the x-y plane)."""
    x0 = cx - t / 2
    m = box(g, x0, y0, cz - t / 2, x0 + t, y0 + h, cz + t / 2, ramp, base)
    ay = y0 + h - arm - t
    m |= box(g, cx - arm - t / 2, ay, cz - t / 2, cx + arm + t / 2, ay + t, cz + t / 2, ramp, base)
    if horns:
        for s in (-1, 1):
            p0, p1, p2 = (cx, y0 + 1), (cx + s * 6, y0 + 5), (cx + s * 7, y0 + 9)
            g.prism("z", quad(p0, p1, 1.3), cz - 1, cz + 1, C(ramp, base))
            m |= last(g)
            g.prism("z", quad(p1, p2, 1.3, 1.0), cz - 1, cz + 1, C(ramp, base))
            m |= last(g)
    P.outline(g, m, ramp, base - 1)
    return m


def spire_cap(g: Grid, cx, cz, y0, half: float, rise: float, ramp: str = "purple", base: int = 4, overhang: float = 1.0) -> np.ndarray:
    """A steep four-gabled cap (two crossed triangular prisms): a gothic
    pyramid roof with true slopes, for pinnacles and turrets."""
    a = half + overhang
    g.prism("z", [(cx - a, y0), (cx + a, y0), (cx, y0 + rise)], cz - a, cz + a, C(ramp, base))
    m = last(g)
    g.prism("x", [(y0, cz - a), (y0, cz + a), (y0 + rise, cz)], cx - a, cx + a, C(ramp, base))
    return m | last(g)


def skull(g: Grid, face: str, plane, cu, v0, s: int = 10, depth: int = 4, ramp: str = "bone", base: int = 5, eyes: str = "toxic") -> np.ndarray:
    """Big blocky skull crest on a wall face: cranium, narrower jaw, painted
    sockets with glowing pupils, nose and teeth (PN mausoleum skull)."""
    hw = s / 2
    jaw_h = max(3, s // 3)
    m = box(g, *on_face(face, plane, cu - hw, cu + hw, v0 + jaw_h, v0 + jaw_h + s, 0, depth), ramp, base)
    m |= box(g, *on_face(face, plane, cu - hw + 2, cu + hw - 2, v0, v0 + jaw_h + 1, 0, depth - 1), ramp, base - 1)
    P.mottle(g, m, ramp, base, cell=2, seed=5)
    P.outline(g, m, ramp, base - 2, normal="z" if face[1] == "z" else "x")
    k = int(round(s / 10 * 3))
    e = max(2, k)
    rows = []
    wid = int(s)
    for r in range(int(s + jaw_h)):
        rows.append("." * wid)
    rows = [list(r) for r in rows]
    ey = int(s * 0.35)  # eye row from the top
    for dy in range(e):
        for dx in range(e):
            for ex in (1 + (wid // 2 - e) // 2, wid - 1 - (wid // 2 - e) // 2 - e):
                rows[ey + dy][ex + dx] = "o"
    for ex in (1 + (wid // 2 - e) // 2, wid - 1 - (wid // 2 - e) // 2 - e):
        rows[ey + e // 2][ex + e // 2] = "g"
    ny = ey + e + 1
    rows[ny][wid // 2 - 1] = rows[ny][wid // 2] = "o"
    ty = int(s) + 1
    for dx in range(3, wid - 3):
        if (dx - 3) % 2 == 1:
            rows[ty][dx] = "o"
    legend = {"o": C("purple", 1), "g": C(eyes, 6)}
    stamp(g, face, plane, int(cu - hw), v0, ["".join(r) for r in rows], legend)
    return m


def tombstone(g: Grid, cx, cz, w: int = 10, h: int = 16, t: int = 4, lean: float = 0.0, ramp: str = "gray", base: int = 4, glyph: str = "cross", seed: int = 0) -> np.ndarray:
    """Round-topped headstone facing -z (a prism, so it can lean), with a
    painted cross or RIP and moss at the foot."""
    x0, x1 = cx - w / 2, cx + w / 2
    top = h - w / 2
    pts = [(x0, 0.0), (x1, 0.0), (x1, top)] + [(cx + (w / 2) * math.cos(math.pi * k / 6), top + (w / 2) * math.sin(math.pi * k / 6)) for k in range(1, 6)] + [(x0, top)]
    pts = rotate(pts, cx, 0.0, lean)
    pts = [(u, max(0.0, v)) for u, v in pts]
    g.prism("z", pts, cz - t / 2, cz + t / 2, C(ramp, base))
    m = last(g)
    P.stone(g, m, ramp, base, block=(5, 4), cracks=0.2, seed=seed)
    P.outline(g, m, ramp, base - 1, normal="z")
    X, Y, Z = coords(g)
    if glyph == "cross":
        P.flat(g, m & (np.abs(X + 0.5 - cx) < 1.1) & (Y >= h * 0.35) & (Y < h * 0.8), ramp, base - 2)
        P.flat(g, m & (np.abs(X + 0.5 - cx) < 3.1) & (Y >= h * 0.6) & (Y < h * 0.6 + 2), ramp, base - 2)
    P.flat(g, m & (Y < 2) & ((P._hash(X, Z, seed=seed) % np.uint64(3)) != 0), "moss", 5)
    return m


def pumpkin(g: Grid, cx, y0, cz, w: int = 18, h: int = 14, ramp: str = "orange", base: int = 3, stem: str = "moss", seed: int = 0) -> np.ndarray:
    """PN pumpkin: a core block ringed by vertical rib slabs of stepped
    heights (the middle rib is tallest), a raised crown and a leaning,
    hooked stem (true slopes). Painted streaks and dark rib seams."""
    c = w // 2 - 2  # core half-width
    m = box(g, cx - c, y0, cz - c, cx + c, y0 + h - 1, cz + c, ramp, base)
    ribs = [(-c, -c // 3 - 1, h - 1, 1), (-c // 3 - 1, c // 3 + 1, h - 1, 0), (c // 3 + 1, c, h - 1, 1)]
    X, Y, Z = coords(g)
    seam = np.zeros(g.shape, dtype=bool)
    for a0, a1, top, lift in ribs:
        for s in (-1, 1):
            # ribs on the ±z faces (u = x) and the ±x faces (u = z)
            zr = (cz + s * c, cz + s * (c + 2))
            rz = box(g, cx + a0, y0 + lift, min(zr), cx + a1, y0 + top - lift, max(zr), ramp, base)
            xr = (cx + s * c, cx + s * (c + 2))
            rx = box(g, min(xr), y0 + lift, cz + a0, max(xr), y0 + top - lift, cz + a1, ramp, base)
            seam |= (rz & ((X == cx + a0) | (X == cx + a1 - 1))) | (rx & ((Z == cz + a0) | (Z == cz + a1 - 1)))
            m |= rz | rx
    # the ribs run over the top as a stepped plus-shaped ridge, then a crown
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
    blotch(g, m & up, ramp, base + 1, cell=2, chance=0.06, seed=seed + 2)  # sunlit patches on top
    P.flat(g, m & (Y == y0), ramp, base - 1)
    # stem: up, then a hook toward +x (PN jack-o'-lantern stem)
    sy = y0 + h
    g.prism("z", quad((cx, sy), (cx + 0.8, sy + 5), 1.4, 1.2, cap=0), cz - 1.5, cz + 1.5, C(stem, 4))
    st = last(g)
    g.prism("z", quad((cx + 0.3, sy + 4.4), (cx + 3.2, sy + 5.6), 1.1, 0.9), cz - 1.2, cz + 1.2, C(stem, 3))
    st |= last(g)
    P.flat(g, st & (Y >= sy + 4), stem, 5)
    return m | st


def banner(g: Grid, x, y, z, pole: int, fw: int, fh: int, ramp: str = "toxic", base: int = 3, pole_ramp: str = "purple", glyph: list[str] | None = None) -> np.ndarray:
    """A tall pole with a big flag flying toward +x with a torn, notched fly
    end and a painted skull on both sides (PN haunted town hall flag)."""
    box(g, x, y, z, x + 3, y + pole, z + 3, pole_ramp, 2)
    box(g, x - 1, y + pole, z - 1, x + 4, y + pole + 2, z + 4, pole_ramp, 3)
    top = y + pole - 1
    fx = x + 3
    pts = [(fx, top), (fx + fw * 0.55, top - 1.5), (fx + fw, top + 0.5), (fx + fw - 4, top - fh * 0.45), (fx + fw + 1, top - fh - 1), (fx + fw * 0.5, top - fh + 1), (fx, top - fh)]
    g.prism("z", pts, z, z + 2, C(ramp, base))
    m = last(g)
    P.mottle(g, m, ramp, base, cell=3, seed=9)
    P.outline(g, m, ramp, base - 2, normal="z")
    glyph = glyph or SKULL_GLYPH
    gw, gh = max(len(r) for r in glyph), len(glyph)
    gu = int(fx + fw * 0.45 - gw / 2)
    gv = int(top - fh / 2 - gh / 2)
    legend = {"#": C("purple", 1), "o": C(ramp, base + 3)}
    stamp(g, "-z", z, gu, gv, glyph, legend)
    stamp(g, "+z", z + 2, gu, gv, glyph, legend)
    return m


def assemble(parts: dict[str, Grid], joints: list[tuple[str, str | None, tuple[float, float, float]]]):
    """Build a Part tree from full-size part grids painted in one shared
    frame (like _kit.Canvas, but prisms survive the crop). joints: (name,
    parent or None, joint point in the shared frame), parents first."""
    from voxgrid import Part

    made: dict[str, tuple[Part, tuple]] = {}
    root = None
    for name, parent, j in joints:
        g, off = crop(parts[name])
        pivot = (j[0] - off[0], j[1] - off[1], j[2] - off[2])
        if parent is None:
            p = Part(name, g, pivot=pivot)
            root = p
        else:
            pp, pj = made[parent]
            p = pp.add(Part(name, g, pivot=pivot, at=(j[0] - pj[0], j[1] - pj[1], j[2] - pj[2])))
        made[name] = (p, j)
    missing = set(parts) - set(made)
    if missing:
        raise ValueError(f"parts without joints: {sorted(missing)}")
    return root
