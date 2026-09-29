"""Fantasy buildings and vehicles in the Pirate Nation style (import as `_bld`).

Shared by the fantasy buildings and vehicles so they read as one family:
octagonal stone drums with facet-following masonry, steep cone and pyramid
roofs with tile rows down every slope, battlements, arched openings,
waving flags (as separate parts) and chunky painted crests. Everything
fills a grid and paints it; the atlas turns colours into texture (rule S1).

Conventions (as pnkit / pnshapes): +y up, the front is -z. Upright shapes
take a centre (cx, cz) and a y range. Octagons have a flat side to the
front, so the '-z', '+z', '-x' and '+x' facets are plain pnkit faces at
cz - r, cz + r, cx - r and cx + r: windows and doors go there.

Parts: `sub_part` builds a small grid for a moving part and places it so
its voxels stay on the model grid (the offset between pivot and `at` is a
whole number of voxels).
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from pnkit import box, face_prism, on_face
from voxgrid import C, Grid, Part

FRONT = -math.pi / 2  # the flat_ngon facing of the front (-z) side for axis 'y'


def last(g: Grid) -> np.ndarray:
    return g.solids[-1].mask(g.shape)


def idx(g: Grid):
    """Integer voxel indices (X, Y, Z)."""
    return np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")


# ------------------------------------------------------------------ masonry drums
def drum(g: Grid, cx, cz, y0, y1, r, ramp: str = "stone", base: int = 5, n: int = 8, r_top: float | None = None, painter=None, block=(7, 4), seed: int = 0) -> np.ndarray:
    """An upright n-gon drum (flat radius r, a flat side to the front); a
    different r_top makes a frustum (battered foot, tapering tower, corbel).
    Each facet is painted with its own frame (default: stone blocks)."""
    poly = S.flat_ngon(cx, cz, r, n, FRONT)
    top = None if r_top is None else S.flat_ngon(cx, cz, r_top, n, FRONT)
    g.prism("y", poly, y0, y1, C(ramp, base), top=top)
    solid = [g.solids[-1]]
    m = last(g)
    painter = painter or (lambda gg, mm, fr: P.stone(gg, mm, ramp, base, block=block, frame=fr, seed=seed))
    S.paint_facets(g, solid, painter)
    return m


def cone_roof(g: Grid, cx, cz, y0, r, h, ramp: str = "blue", base: int = 4, n: int = 8, lean=(0.0, 0.0), trim=("gold", 4), eave=("blue", 2), row: int = 3, seed: int = 0) -> np.ndarray:
    """A steep n-gon cone roof (rule F4) from flat radius r at y0 to a point
    h above, the tip shifted by `lean` (dx, dz) for life (F5). Tile rows run
    down every facet, the hips get `trim` and the eave a dark lip."""
    poly = S.flat_ngon(cx, cz, r, n, FRONT)
    tip = (cx + lean[0], cz + lean[1])
    g.prism("y", poly, y0, y0 + h, C(ramp, base), top=[tip] * n)
    solid = [g.solids[-1]]
    m = last(g)
    S.paint_facets(g, solid, lambda gg, mm, fr: P.tiles(gg, mm, ramp, base, row=row, width=4, frame=fr, seed=seed))
    _X, Y, _Z = idx(g)
    if eave:
        P.flat(g, m & (Y < y0 + 2), *eave)
    if trim:
        P.flat(g, m & S.seams(g, solid, 0.9) & (Y >= y0 + 2), *trim)
    return m


def pyramid_roof(g: Grid, x0, z0, x1, z1, y0, h, ramp: str = "blue", base: int = 4, lean=(0.0, 0.0), trim=("gold", 4), eave=("blue", 2), seed: int = 0) -> np.ndarray:
    """A steep four-sided pyramid roof over x0..x1 × z0..z1 with tile rows
    following each slope, trimmed hips and a dark eave lip."""
    ax, az = (x0 + x1) / 2 + lean[0], (z0 + z1) / 2 + lean[1]
    g.prism("y", [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y0, y0 + h, C(ramp, base), top=[(ax, az)] * 4)
    solid = [g.solids[-1]]
    m = last(g)
    S.paint_facets(g, solid, lambda gg, mm, fr: P.tiles(gg, mm, ramp, base, row=3, width=4, frame=fr, seed=seed))
    _X, Y, _Z = idx(g)
    if eave:
        P.flat(g, m & (Y < y0 + 2), *eave)
    if trim:
        P.flat(g, m & S.seams(g, solid, 0.9) & (Y >= y0 + 2), *trim)
    return m


def ring_merlons(g: Grid, cx, cz, y0, h, r, n: int = 8, w: float = 7.0, t: float = 3.0, ramp: str = "stone", base: int = 6, seed: int = 0) -> np.ndarray:
    """Battlements on an n-gon rim: one chunky merlon in the middle of every
    facet (outer face flush with the facet at flat radius r), each a prism
    turned to its facet. Lighter stone with a darker outline (rule S4)."""
    m = np.zeros(g.shape, dtype=bool)
    for k in range(n):
        a = FRONT + 2 * math.pi * k / n
        ca, sa = math.cos(a), math.sin(a)
        tu, tv = -sa, ca  # along the facet
        mx, mz = cx + (r - t / 2) * ca, cz + (r - t / 2) * sa
        pts = [(mx + tu * s1 * w / 2 + ca * s2 * t / 2, mz + tv * s1 * w / 2 + sa * s2 * t / 2) for s1, s2 in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        g.prism("y", pts, y0, y0 + h, C(ramp, base))
        mm = last(g)
        P.stone(g, mm, ramp, base, block=(4, 3), seed=seed + k)
        m |= mm
    _X, Y, _Z = idx(g)
    P.flat(g, m & (Y >= y0 + h - 1), ramp, min(7, base + 1))
    return m


def merlons(g: Grid, axis: str, u0, u1, a0, a1, y0, h, w: int = 7, gap: int = 5, ramp: str = "stone", base: int = 6, seed: int = 0) -> np.ndarray:
    """A row of box merlons along `axis` ('x' or 'z') from u0 to u1, each
    w wide with `gap` between, a0..a1 across. Centred on the run."""
    m = np.zeros(g.shape, dtype=bool)
    count = max(1, int((u1 - u0 + gap) // (w + gap)))
    span = count * w + (count - 1) * gap
    s = u0 + ((u1 - u0) - span) / 2
    for k in range(count):
        b0 = int(round(s + k * (w + gap)))
        if axis == "x":
            mm = box(g, b0, y0, a0, b0 + w, y0 + h, a1, ramp, base)
        else:
            mm = box(g, a0, y0, b0, a1, y0 + h, b0 + w, ramp, base)
        m |= mm
    P.stone(g, m, ramp, base, block=(4, 3), seed=seed)
    _X, Y, _Z = idx(g)
    P.flat(g, m & (Y >= y0 + h - 1), ramp, min(7, base + 1))
    P.outline(g, m, ramp, base - 2, normal="y")
    return m


# ------------------------------------------------------------------ openings
def arch_pts(u0, u1, v0, v1, segs: int = 6) -> list[tuple[float, float]]:
    """A round-topped opening outline (u, v): straight jambs and a half-round head."""
    cu, half = (u0 + u1) / 2, (u1 - u0) / 2
    top = v1 - half
    pts = [(u0, v0), (u1, v0), (u1, top)]
    for k in range(1, segs):
        a = math.pi * k / segs
        pts.append((cu + half * math.cos(a), top + half * math.sin(a)))
    pts.append((u0, top))
    return pts


def arch_window(g: Grid, face: str, plane, u0, u1, v0, v1, glass=("gold", 6), frame=("stone", 6), mullion=("darkwood", 2), sill: bool = True) -> np.ndarray:
    """An arched window: a glowing pane 1 proud inside a 2-proud stone surround
    (jambs and a round head), a painted mullion and transom, a stone sill."""
    pane = face_prism(g, face, plane, arch_pts(u0, u1, v0, v1), 0, 1, C(*glass))
    fm = box(g, *on_face(face, plane, u0 - 2, u0, v0, v1 - (u1 - u0) / 2, 0, 2), *frame)
    fm |= box(g, *on_face(face, plane, u1, u1 + 2, v0, v1 - (u1 - u0) / 2, 0, 2), *frame)
    outer = arch_pts(u0 - 2, u1 + 2, v1 - (u1 - u0) / 2 - 0.01, v1 + 2)
    inner = arch_pts(u0, u1, v1 - (u1 - u0) / 2 - 0.01, v1)
    ring = outer[2:] + list(reversed(inner[2:]))
    fm |= face_prism(g, face, plane, ring, 0, 2, C(*frame))
    if sill:
        fm |= box(g, *on_face(face, plane, u0 - 3, u1 + 3, v0 - 2, v0, 0, 3), *frame)
    P.stone(g, fm, frame[0], frame[1], block=(4, 3), frame="top" if face == "top" else None)
    U, V = face_uv(g, face)
    cu = (u0 + u1) / 2
    if mullion:
        P.flat(g, pane & (np.abs(U + 0.5 - cu) < 0.6), *mullion)
        P.flat(g, pane & (V == int(v0 + (v1 - v0) * 0.45)), *mullion)
        P.flat(g, pane & (V >= v1 - (u1 - u0) / 2) & (np.abs(U + 0.5 - cu) >= 0.6), glass[0], min(7, glass[1] + 1))
    return pane


def arch_door(g: Grid, face: str, plane, u0, u1, v0, v1, leaf=("wood", 4), frame=("stone", 6), studs=("gold", 5), seed: int = 0) -> np.ndarray:
    """A wide, short arched door (F4): a planked leaf 2 proud with dark
    straps and gold studs, inside a 3-proud stone arch with a keystone."""
    leafm = face_prism(g, face, plane, arch_pts(u0, u1, v0, v1), 0, 2, C(*leaf))
    fr = "top" if face == "top" else None
    across = "x" if face in ("-z", "+z", "top") else "z"
    P.planks(g, leafm, leaf[0], leaf[1], width=4, across=across, length=(60, 61), nails=False, frame=fr, seed=seed)
    U, V = face_uv(g, face)
    for sv in (v0 + (v1 - v0) * 0.25, v0 + (v1 - v0) * 0.6):
        strap = leafm & (V >= int(sv)) & (V < int(sv) + 2)
        P.flat(g, strap, "darkwood", 2)
        if studs:
            P.flat(g, strap & ((U - int(u0)) % 4 == 2), *studs)
    cu = (u0 + u1) / 2
    P.flat(g, leafm & (np.abs(U + 0.5 - cu) < 0.6), leaf[0], max(1, leaf[1] - 2))
    half = (u1 - u0) / 2
    top = v1 - half
    fm = box(g, *on_face(face, plane, u0 - 3, u0, v0, top, 0, 3), *frame)
    fm |= box(g, *on_face(face, plane, u1, u1 + 3, v0, top, 0, 3), *frame)
    outer = arch_pts(u0 - 3, u1 + 3, top - 0.01, v1 + 3)
    inner = arch_pts(u0, u1, top - 0.01, v1)
    fm |= face_prism(g, face, plane, outer[2:] + list(reversed(inner[2:])), 0, 3, C(*frame))
    P.stone(g, fm, frame[0], frame[1], block=(5, 4), frame=fr, seed=seed + 1)
    key = fm & (np.abs(U + 0.5 - cu) < 2.1) & (V >= v1 - 1)
    P.flat(g, key, frame[0], min(7, frame[1] + 1))
    return leafm


def round_window(g: Grid, face: str, plane, cu, cv, r, glass=("cyan", 6), frame=("gold", 4), n: int = 8, spokes: bool = True) -> np.ndarray:
    """A round (octagonal) glowing window 1 proud in a 2-proud ring."""
    pane = face_prism(g, face, plane, S.flat_ngon(cu, cv, r, n, FRONT), 0, 1, C(*glass))
    outer = S.flat_ngon(cu, cv, r + 2, n, FRONT)
    inner = S.flat_ngon(cu, cv, r, n, FRONT)
    ring = np.zeros(g.shape, dtype=bool)
    for half in (range(0, n // 2 + 1), range(n // 2, n + 1)):
        ks = [k % n for k in half]
        ring |= face_prism(g, face, plane, [outer[k] for k in ks] + [inner[k] for k in reversed(ks)], 0, 2, C(*frame))
    P.outline(g, ring, frame[0], max(1, frame[1] - 1), normal=axis_of(face))
    U, V = face_uv(g, face)
    if spokes:
        P.flat(g, pane & ((np.abs(U + 0.5 - cu) < 0.6) | (np.abs(V + 0.5 - cv) < 0.6)), frame[0], max(1, frame[1] - 1))
    P.flat(g, pane & (U + 0.5 < cu) & (V + 0.5 > cv) & (np.abs(U + 0.5 - cu) >= 0.6) & (np.abs(V + 0.5 - cv) >= 0.6), glass[0], 7)
    return pane


def slit(g: Grid, face: str, plane, u, v0, v1, ink=("stone", 1), lip=("stone", 6)) -> None:
    """A painted arrow slit (a dark 1×n stroke with a light lip under it)."""
    U, V = face_uv(g, face)
    near = face_band(g, face, plane)
    P.flat(g, near & (U == int(u)) & (V >= v0) & (V < v1), *ink)
    P.flat(g, near & (np.abs(U - int(u)) <= 1) & (V == v0 - 1), *lip)


def axis_of(face: str) -> str:
    return "y" if face == "top" else face[1]


def face_uv(g: Grid, face: str):
    """Integer (U, V) of a pnkit face (u along it, v up)."""
    X, Y, Z = idx(g)
    return {"z": (X, Y), "x": (Z, Y), "y": (X, Z)}[axis_of(face)]


def face_band(g: Grid, face: str, plane, reach: int = 2) -> np.ndarray:
    """Filled voxels within `reach` of a face plane (the visible skin)."""
    X, Y, Z = idx(g)
    D = {"z": Z, "x": X, "y": Y}[axis_of(face)] + 0.5
    return (g.a > 0) & (np.abs(D - plane) < reach)


# ------------------------------------------------------------------ surfaces
def sandstone(g: Grid, mask: np.ndarray, base: int = 4, block=(8, 5), honey: float = 0.2, frame=None, seed: int = 0) -> None:
    """Warm honey sandstone for the castle family (PN warm palette, C1/C2):
    running-bond blocks in sand base/base+1, about `honey` of them in a
    light warm orange, with a darker sand mortar line (rules S2, S3)."""
    U, V = P.uv(g, frame)
    bw, bh = block
    course = V // bh
    u = U + (course % 2) * (bw // 2)
    cell = u // bw
    h = P._hash(course, cell, seed=seed) % np.uint64(100)
    joint = (V % bh == 0) | (u % bw == 0)
    P.flat(g, mask, "sand", base)
    P.flat(g, mask & (h < np.uint64(25)), "sand", min(7, base + 1))
    P.flat(g, mask & (h >= np.uint64(100 - int(honey * 100))), "orange", 7)
    P.flat(g, mask & joint, "sand", max(1, base - 1))


def sandstone_painter(base: int = 4, block=(8, 5), honey: float = 0.2, seed: int = 0):
    """A facet painter (for drum/paint_facets) that paints sandstone()."""
    return lambda gg, mm, fr: sandstone(gg, mm, base, block, honey, frame=fr, seed=seed)


def half_timber(g: Grid, mask: np.ndarray, u0: int, v0: int, v1: int, bay: int = 16, t: int = 3, ramp: str = "darkwood", shade: int = 4, braces: bool = True) -> None:
    """Paint PN half-timbering on plaster walls: studs every `bay`, a top
    and bottom rail and a diagonal brace in every other bay (rule S2)."""
    U, V = P.uv(g, "wall")
    du = (U - u0) % bay
    P.flat(g, mask & (du < t), ramp, shade)
    P.flat(g, mask & ((V < v0 + t) | (V >= v1 - t)), ramp, shade)
    if braces:
        k = ((U - u0) // bay) % 2 == 0
        slope = (v1 - v0 - 2 * t) / max(1, bay - t)
        along = (du - t) * slope + v0 + t
        P.flat(g, mask & k & (du >= t) & (np.abs(V - along) < t * 0.75), ramp, shade)


def tiles_on(g: Grid, solid_from: int, ramp: str, base: int = 4, row: int = 3, width: int = 4, seed: int = 0) -> None:
    """Tile rows down every facet of the prisms added since `solid_from`."""
    S.paint_facets(g, g.solids[solid_from:], lambda gg, mm, fr: P.tiles(gg, mm, ramp, base, row=row, width=width, frame=fr, seed=seed))


# ------------------------------------------------------------------ crests and icons
ICONS = {
    "crown": [
        "#...#...#",
        "##.###.##",
        "#########",
        "#+##+##+#",
        "#########",
        "---------",
    ],
    "hammers": [
        "###...###",
        "###...###",
        ".##...##.",
        "..#...#..",
        "...#.#...",
        "....#....",
        "...#.#...",
        "..#...#..",
        ".#.....#.",
    ],
    "anvil": [
        "###########",
        "-#########.",
        "..#######..",
        "....###....",
        "....###....",
        "..#######..",
        ".#########.",
    ],
    "star": [
        "....#....",
        "....#....",
        "...###...",
        "#########",
        ".#######.",
        "..#####..",
        "..##.##..",
        ".##...##.",
    ],
    "moon": [
        "..####.",
        ".###...",
        "###....",
        "###....",
        "###....",
        ".###...",
        "..####.",
    ],
    "leaf": [
        "....##.",
        "..####.",
        ".#####.",
        "###+##.",
        "##+###.",
        "#+###..",
        "+.##...",
        "+......",
    ],
    "tower": [
        "#.#.#.#",
        "#######",
        ".#####.",
        ".##.##.",
        ".##.##.",
        ".#####.",
        "#######",
    ],
    "rune": [
        "..#..",
        ".###.",
        "#.#.#",
        "..#..",
        ".#.#.",
        "#...#",
    ],
    "sack": [
        "..#.#..",
        "...#...",
        "..###..",
        ".#####.",
        "#######",
        "#######",
        ".#####.",
    ],
}


def icon(g: Grid, face: str, plane, u0: int, v0: int, name: str, ramp: str, shade: int, scale: int = 1, inks=None) -> np.ndarray:
    """Paint one of this file's ICONS (or a pnglyph icon) on a face."""
    rows = ICONS.get(name) or pnglyph.ICONS.get(name)
    if rows is None:
        raise ValueError(f"unknown icon {name!r}")
    clamp = lambda s: min(7, max(1, s))  # noqa: E731
    legend = {"#": C(ramp, shade), "+": C(ramp, clamp(shade + 2)), "-": C(ramp, clamp(shade - 2))}
    for ch, (r, s) in (inks or {}).items():
        legend[ch] = C(r, s)
    return pnglyph.stamp(g, face, plane, u0, v0, rows, legend, scale)


def icon_size(name: str, scale: int = 1) -> tuple[int, int]:
    rows = ICONS.get(name) or pnglyph.ICONS[name]
    return (max(len(r) for r in rows) * scale, len(rows) * scale)


def shield(g: Grid, face: str, plane, cu, v0, w: int = 14, h: int = 17, field=("blue", 4), rim=("gold", 5), charge: str | None = "crown", ink=("gold", 6), depth: int = 2) -> np.ndarray:
    """A heater shield crest standing `depth` proud of a face: a pointed
    bottom (true slopes), a gold rim and a painted charge."""
    u0, u1 = cu - w / 2, cu + w / 2
    pts = [(u0, v0 + h), (u0, v0 + h * 0.45), (cu, v0), (u1, v0 + h * 0.45), (u1, v0 + h)]
    m = face_prism(g, face, plane, pts, 0, depth, C(*field))
    P.outline(g, m, *rim, normal=axis_of(face))
    if charge:
        iw, ih = icon_size(charge)
        out = plane - depth if face in ("-z", "-x") else plane + depth
        icon(g, face, out, int(round(cu - iw / 2)), int(round(v0 + h * 0.55 - ih / 2)), charge, *ink)
    return m


# ------------------------------------------------------------------ flags
def flag_grid(size, pole_x: float, top_y: float, z: float, fw: int, fh: int, ramp: str = "red", base: int = 4, fly: str = "x", charge: str | None = None, ink=("gold", 6), swallow: bool = True) -> Grid:
    """A flag for a separate waving part: a 2-thick board with a swallowtail
    fly end, hanging from a pole at (pole_x, z) with its top at top_y and
    flying toward +x (fly='x') or -x. Wave it with a rot about y at the pole."""
    g = Grid(*size)
    s = 1 if fly == "x" else -1
    x0 = pole_x
    x1 = pole_x + s * fw
    pts = [(x0, top_y), (x0 + s * fw * 0.5, top_y - 1), (x1, top_y + 0.5)]
    if swallow:
        pts += [(x1 - s * 4, top_y - fh / 2)]
    pts += [(x1, top_y - fh - 0.5), (x0 + s * fw * 0.5, top_y - fh + 0.5), (x0, top_y - fh)]
    g.prism("z", pts, z - 1, z + 1, C(ramp, base))
    m = last(g)
    P.mottle(g, m, ramp, base, cell=3, seed=5)
    P.outline(g, m, ramp, base - 2, normal="z")
    if charge:
        iw, ih = icon_size(charge)
        cu = x0 + s * fw * 0.42
        u0, v0 = int(round(cu - iw / 2)), int(round(top_y - fh / 2 - ih / 2))
        icon(g, "-z", z - 1, u0, v0, charge, *ink)
        icon(g, "+z", z + 1, u0, v0, charge, *ink)
    return g


def pole(g: Grid, x, z, y0, y1, ramp: str = "darkwood", shade: int = 3, finial=("gold", 5)) -> None:
    """A 2×2 flag pole with a gold ball finial."""
    box(g, x - 1, y0, z - 1, x + 1, y1, z + 1, ramp, shade)
    if finial:
        S.disc(g, "y", x, z, 1.8, y1, y1 + 3, *finial)


def sub_part(name: str, g: Grid, hinge, origin=(0, 0, 0), rot=(0.0, 0.0, 0.0)) -> Part:
    """A moving part whose grid starts at `origin` in model grid voxels,
    hinged at `hinge` (model grid voxels). The pivot/at offset is whole
    voxels, so the part stays on the model grid."""
    ox, oy, oz = (int(o) for o in origin)
    hx, hy, hz = hinge
    return Part(name, g, pivot=(hx - ox, hy - oy, hz - oz), at=(hx, hy, hz), rot=rot)


def keys(*frames):
    """Rotation keys from (t, x, y, z) tuples."""
    return [(t, (x, y, z)) for t, x, y, z in frames]


def wave(seconds: float, axis: str, amp: float, phase: float = 0.0, steps: int = 8):
    """Sine rotation keys on one axis (loops)."""
    i = "xyz".index(axis)
    out = []
    for k in range(steps + 1):
        t = seconds * k / steps
        v = [0.0, 0.0, 0.0]
        v[i] = amp * math.sin(2 * math.pi * k / steps + phase)
        out.append((t, tuple(v)))
    return out


# ------------------------------------------------------------------ props at the base (rule K1)
def sack(g: Grid, cx, cz, y0, w: int = 8, h: int = 9, ramp: str = "sand", base: int = 5, tie=("darkwood", 3)) -> np.ndarray:
    """A plump grain sack: an octagonal body narrowing to a tied neck (true slopes)."""
    r = w / 2
    g.prism("y", S.flat_ngon(cx, cz, r, 8, FRONT), y0, y0 + h * 0.6, C(ramp, base), top=S.flat_ngon(cx, cz, r * 0.9, 8, FRONT))
    m = last(g)
    g.prism("y", S.flat_ngon(cx, cz, r * 0.9, 8, FRONT), y0 + h * 0.6, y0 + h, C(ramp, base), top=S.flat_ngon(cx, cz, r * 0.3, 8, FRONT))
    m |= last(g)
    P.mottle(g, m, ramp, base, cell=2)
    _X, Y, _Z = idx(g)
    P.flat(g, m & (Y >= int(y0 + h * 0.72)) & (Y < int(y0 + h * 0.72) + 1), *tie)
    return m


def log_pile(g: Grid, x0, z0, y0, length: int = 18, r: float = 2.6, rows=(3, 2), axis: str = "x", ramp: str = "wood", base: int = 4) -> np.ndarray:
    """Stacked octagonal logs with pale end grain."""
    m = np.zeros(g.shape, dtype=bool)
    d = 2 * r
    for level, count in enumerate(rows):
        for k in range(count):
            off = k * d + level * r
            cy = y0 + r + level * (d - 0.6)
            if axis == "x":
                cu, cv = cy, z0 + r + off
                mm = S.disc(g, "x", cu, cv, r, x0, x0 + length, ramp, base)
            else:
                cu, cv = x0 + r + off, cy
                mm = S.disc(g, "z", cu, cv, r, z0, z0 + length, ramp, base)
            P.planks(g, mm, ramp, base, width=2, across="y" if axis == "x" else "x", length=(length, length + 1), nails=False)
            X, Y, Z = idx(g)
            end = mm & ((X == x0) | (X == x0 + length - 1)) if axis == "x" else mm & ((Z == z0) | (Z == z0 + length - 1))
            P.flat(g, end, "sand", 5)
            m |= mm
    return m


def bell(g: Grid, cx, cz, y_top, h: int = 16, r: float = 8, ramp: str = "gold", base: int = 5) -> np.ndarray:
    """A big faceted bell hanging from y_top: a flared lip, a tapering body
    and a round crown with a hanging loop (true slopes), a darker sound
    ring painted round the waist and a lit shoulder."""
    yb = y_top - h
    n = 8
    ng = lambda rr: S.flat_ngon(cx, cz, rr, n, FRONT)  # noqa: E731
    start = len(g.solids)
    g.prism("y", ng(r + 1.2), yb, yb + 2, C(ramp, base - 1), top=ng(r + 0.4))
    g.prism("y", ng(r), yb + 2, y_top - 4, C(ramp, base), top=ng(r * 0.55))
    g.prism("y", ng(r * 0.55), y_top - 4, y_top - 2, C(ramp, base), top=ng(r * 0.3))
    m = np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])
    _X, Y, _Z = idx(g)
    P.flat(g, m & (Y >= yb + 5) & (Y < yb + 6), ramp, base - 2)
    P.flat(g, m & (Y >= y_top - 6), ramp, min(7, base + 1))
    m |= box(g, cx - 1, y_top - 2, cz - 2, cx + 1, y_top, cz + 2, "iron", 4)
    return m


def icon_on(g: Grid, mask: np.ndarray, U: np.ndarray, V: np.ndarray, u0: int, v0: int, name: str, ramp: str, shade: int, scale: int = 1, flip: bool = False, inks=None) -> np.ndarray:
    """Paint an icon on any masked surface (slopes and facets too) through
    integer surface coordinates U (along) and V (up): (u0, v0) is the
    lowest corner of the icon box. flip=True runs the columns toward low U
    (use it on faces seen from -z or +x, so the icon is never mirrored)."""
    rows = ICONS.get(name) or pnglyph.ICONS.get(name)
    if rows is None:
        raise ValueError(f"unknown icon {name!r}")
    w = max(len(r) for r in rows) * scale
    h = len(rows) * scale
    clamp = lambda s: min(7, max(1, s))  # noqa: E731
    legend = {"#": (ramp, shade), "+": (ramp, clamp(shade + 2)), "-": (ramp, clamp(shade - 2))}
    legend.update(inks or {})
    du = U - u0
    dv = V - v0
    inside = mask & (du >= 0) & (du < w) & (dv >= 0) & (dv < h)
    col = np.where(flip, w - 1 - du, du) // scale
    row = (h - 1 - dv) // scale
    painted = np.zeros(g.shape, dtype=bool)
    for r, line in enumerate(rows):
        for k, ch in enumerate(line):
            if ch not in legend:
                continue
            hit = inside & (row == r) & (col == k)
            if hit.any():
                P.flat(g, hit, *legend[ch])
                painted |= hit
    if not painted.any():
        raise ValueError(f"icon {name!r} painted nothing")
    return painted
