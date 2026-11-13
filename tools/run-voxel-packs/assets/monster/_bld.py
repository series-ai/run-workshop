"""Monster buildings and vehicles in the Pirate Nation haunted style.

Art direction: docs/art-direction.md. The haunted manor
(buildings/haunted-manor.py) sets the look: grey stone walls with light
stone piers and trims, steep purple slate roofs, crosses, skulls, bats,
toxic-green and magenta glow, pumpkin-orange accents. These helpers add the
pieces that the other monster buildings and vehicles share, on top of the
shared kit (pnkit, pnshapes, pnglyph, paint, pnpaint) and the pack's
_pn.py. Big chunky volumes, true slopes, detail painted.

Every helper fills the grid, paints what it adds and returns its mask.
Sources build each part in one shared frame (a full-size grid per part)
and join them with `parts()`, so part pivots and sockets use the same
coordinates as the geometry.

Dark-value rule (C2): in the monster theme the whole `darkwood` ramp and
`iron` 0-3 are darker than value 0.25. Use them only for thin seams and
outlines; use `wood` 3-6, `gray` 2-3 or `purple` 2-3 for dark members.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnshapes as S
from _pn import assemble, blotch
from pnkit import box, on_face
from voxgrid import C, Grid, Part

# ---------------------------------------------------------------- basics


def coords(g: Grid):
    """Voxel-centre coordinates (x, y, z), each 0.5 more than the index."""
    return S.coords(g)


def idx(g: Grid):
    """Integer voxel indices (x, y, z)."""
    return np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")


def last(g: Grid) -> np.ndarray:
    return g.solids[-1].mask(g.shape)


def solids_since(g: Grid, start: int) -> np.ndarray:
    """Mask of every prism added since len(g.solids) was `start`."""
    if len(g.solids) <= start:
        return np.zeros(g.shape, dtype=bool)
    return np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])


def parts(grids: dict[str, Grid], joints) -> Part:
    """Join full-size part grids painted in one shared frame. joints:
    (name, parent or None, pivot in the shared frame), parents first."""
    return assemble(grids, joints)


# ---------------------------------------------------------------- masonry


def stone(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str = "gray", base: int = 4, block=(8, 4), seed: int = 0) -> np.ndarray:
    """A solid stone block with running-bond masonry painted on it."""
    m = box(g, x0, y0, z0, x1, y1, z1, ramp, base)
    P.stone(g, m, ramp, base, block=block, cracks=0.08, seed=seed)
    return m


def piers(g: Grid, x0, x1, z0, z1, y0, y1, size: int = 5, out: int = 1, seed: int = 0, corners=None) -> np.ndarray:
    """Thick light stone corner piers standing `out` voxels proud of the
    walls (rule F3, as the manor). `corners` limits them to some of
    ('fl', 'fr', 'bl', 'br')."""
    m = np.zeros(g.shape, dtype=bool)
    spots = {"fl": (x0 - out, z0 - out), "fr": (x1 + out - size, z0 - out), "bl": (x0 - out, z1 + out - size), "br": (x1 + out - size, z1 + out - size)}
    for key, (cx, cz) in spots.items():
        if corners is None or key in corners:
            m |= box(g, cx, y0, cz, cx + size, y1, cz + size, "gray", 6)
    P.stone(g, m, "gray", 6, block=(5, 6), seed=seed)
    return m


def course(g: Grid, x0, z0, x1, z1, y0, y1, out: int = 1, seed: int = 0) -> np.ndarray:
    """A light stone string course (a band 1 voxel proud) round a block."""
    m = box(g, x0 - out, y0, z0 - out, x1 + out, y1, z1 + out, "gray", 6)
    P.stone(g, m, "gray", 6, block=(10, 3), seed=seed)
    return m


def plinth(g: Grid, x0, z0, x1, z1, h: int = 5, out: int = 3, seed: int = 0) -> np.ndarray:
    m = box(g, x0 - out, 0, z0 - out, x1 + out, h, z1 + out, "stone", 5)
    P.stone(g, m, "stone", 5, block=(9, 5), seed=seed)
    return m


def steps(g: Grid, cx, z_front, w: int, n: int = 2, rise: int = 3, run: int = 4, y0: int = 0, seed: int = 0) -> np.ndarray:
    """`n` stone steps rising toward +z up to the wall plane z_front."""
    m = np.zeros(g.shape, dtype=bool)
    for k in range(n):
        m |= box(g, cx - w / 2 + k, y0, z_front - run * (n - k), cx + w / 2 - k, y0 + rise * (k + 1), z_front, "stone", 4)
    P.stone(g, m, "stone", 4, block=(6, 3), seed=seed)
    return m


def roof_paint(g: Grid, roof: dict, along: str, seed: int, lip: bool = True) -> None:
    """Worn purple slate with dark patches, stone gable walls, and light
    stone barge boards and eave lips framing the slabs (as the manor)."""
    slabs = roof["slabs"]
    blotch(g, slabs, "purple", 2, cell=3, chance=0.05, seed=seed)
    P.stone(g, roof["attic"], "gray", 4, block=(7, 4), seed=seed + 1)
    X, Y, Z = coords(g)
    B = X if along == "x" else Z
    b = B[slabs]
    ends = slabs & ((B <= b.min() + 2) | (B >= b.max() - 2))
    edge = ends
    if lip:
        edge = edge | (slabs & (Y <= Y[slabs].min() + 1))
    P.stone(g, edge, "gray", 5, block=(6, 3), seed=seed + 2)


def slate(g: Grid, solids, seed: int = 0, ramp: str = "purple", base: int = 4, row: int = 4, width: int = 5, trim=("gray", 5)) -> None:
    """Tile rows that follow every face of the prisms, worn patches, and
    light stone seams on the hips and ridges."""
    S.paint_facets(g, solids, lambda gg, mm, fr: P.tiles(gg, mm, ramp, base, row=row, width=width, frame=fr, seed=seed))
    m = np.logical_or.reduce([s.mask(g.shape) for s in solids])
    blotch(g, m, ramp, max(1, base - 2), cell=3, chance=0.05, seed=seed + 1)
    if trim:
        P.flat(g, m & S.seams(g, solids, 0.9), *trim)


# ---------------------------------------------------------------- 2D shapes


def pointed(u0, u1, v0, v1, rise: float | None = None) -> list[tuple[float, float]]:
    """A pointed (gothic) arch outline: jambs up to the springing, two
    straight slopes to the point at v1."""
    cu = (u0 + u1) / 2
    rise = (u1 - u0) * 0.7 if rise is None else rise
    return [(u0, v0), (u1, v0), (u1, v1 - rise), (cu, v1), (u0, v1 - rise)]


def rounded(u0, u1, v0, v1, n: int = 6) -> list[tuple[float, float]]:
    """A round arch outline: jambs, then a half n-gon to the crown at v1."""
    cu, r = (u0 + u1) / 2, (u1 - u0) / 2
    spring = v1 - r
    pts = [(u0, v0), (u1, v0), (u1, spring)]
    pts += [(cu + r * math.cos(math.pi * k / n), spring + r * math.sin(math.pi * k / n)) for k in range(1, n)]
    pts.append((u0, spring))
    return pts


def face_poly(g: Grid, face: str, plane, pts_uv, d0, d1, ramp: str, shade: int) -> np.ndarray:
    """A prism on a face from a (u, v) outline (see pnkit.face_prism)."""
    from pnkit import face_prism

    return face_prism(g, face, plane, pts_uv, d0, d1, C(ramp, shade))


def opening(g: Grid, face: str, plane, pts_uv, glow=("magenta", 5), deep=("purple", 2), d: float = 1, seed: int = 0) -> np.ndarray:
    """A painted doorway or arch opening: a panel `d` voxels proud in the
    outline, dark violet at the top and glowing toward the floor (a lit
    room or stair seen through it; never murky, rule C2)."""
    m = face_poly(g, face, plane, pts_uv, 0, d, *deep)
    _X, Y, _Z = coords(g)
    v0 = min(v for _u, v in pts_uv)
    v1 = max(v for _u, v in pts_uv)
    t = (Y - v0) / max(1.0, v1 - v0)
    P.flat(g, m & (t < 0.55), glow[0], max(1, glow[1] - 2))
    P.flat(g, m & (t < 0.3), *glow)
    P.flat(g, m & (t < 0.12), glow[0], min(7, glow[1] + 1))
    return m


# ---------------------------------------------------------------- motifs


def coffin_poly(cu, a0, w, L) -> list[tuple[float, float]]:
    """Coffin outline in (across, along): head at a0 + L, foot at a0,
    shoulders at 72% of the length."""
    sh = a0 + L * 0.72
    return [(cu - w * 0.32, a0), (cu + w * 0.32, a0), (cu + w / 2, sh), (cu + w * 0.36, a0 + L), (cu - w * 0.36, a0 + L), (cu - w / 2, sh)]


def coffin(g: Grid, cu, a0, w, L, lo, hi, pose: str = "up", wood=("wood", 5), lid=("purple", 3), trim=("gold", 4), cross: bool = True, turn: float = 0.0, lid_h: float = 0.0, seed: int = 0) -> np.ndarray:
    """A chunky six-sided coffin (true slopes).
    pose='up': standing, facing -z; (cu, a0) = (x centre, foot y), lid on
    the z = lo face; [lo, hi) its depth along z.
    pose='z': lying along z, head toward +z; (cu, a0) = (x centre, foot z),
    [lo, hi) its height along y, lid on top.
    pose='x': lying along x, head toward +x; (cu, a0) = (z centre, foot x).
    `turn` (degrees) turns a lying coffin about its centre (poses 'z', 'x').
    `lid_h` > 0 adds a separate lid slab, 1 voxel wider all round, on the
    lid face (outside [lo, hi)). Painted planks, a dark rim, a lid panel
    and a painted cross."""
    if turn and pose == "up":
        raise ValueError("turn applies to lying coffins only")
    ca = a0 + L / 2

    def spin(pts):
        return S.rotate(pts, cu, ca, turn) if turn else pts

    poly = spin(coffin_poly(cu, a0, w, L))
    if pose == "up":
        g.prism("z", poly, lo, hi, C(*wood))
    elif pose == "z":
        g.prism("y", poly, lo, hi, C(*wood))
    elif pose == "x":
        g.prism("y", [(v, u) for u, v in poly], lo, hi, C(*wood))
    else:
        raise ValueError("pose must be 'up', 'z' or 'x'")
    m = last(g)
    across = "x" if pose in ("up", "z") else "z"
    P.planks(g, m, wood[0], wood[1], width=3, across=across, length=(40, 41), nails=False, seed=seed)
    X, Y, Z = coords(g)
    if pose == "up":
        U, A, N, lid_face = X, Y, Z, (Z < lo + 1)
    elif pose == "z":
        U, A, N, lid_face = X, Z, Y, (Y > hi - 1)
    else:
        U, A, N, lid_face = Z, X, Y, (Y > hi - 1)
    from voxgrid import _inside_polygon

    if turn:  # measure the lid pattern in the coffin's own frame
        t = np.radians(-turn)
        du, da = U - cu, A - ca
        U, A = cu + du * np.cos(t) - da * np.sin(t), ca + du * np.sin(t) + da * np.cos(t)
    rim = m & ~lid_face & ((N < lo + 1.2) | (N > hi - 1.2))
    P.flat(g, rim, wood[0], max(1, wood[1] - 2))
    face = m & lid_face
    if lid_h > 0:
        if pose == "up":
            outline, l0, l1 = coffin_poly(cu, a0, w + 2, L + 1), lo - lid_h, lo
            g.prism("z", outline, l0, l1, C(*lid))
        else:
            outline, l0, l1 = spin(coffin_poly(cu, a0 - 1, w + 2, L + 2)), hi, hi + lid_h
            g.prism("y", outline if pose == "z" else [(v, u) for u, v in outline], l0, l1, C(*lid))
        lm = last(g)
        P.planks(g, lm, lid[0], lid[1], width=3, across=across, length=(40, 41), nails=False, seed=seed + 1)
        face = lm & ((Z < l0 + 1) if pose == "up" else (Y > l1 - 1))
        P.outline(g, face, lid[0], max(1, lid[1] - 1), normal={"up": "z", "z": "y", "x": "y"}[pose])
        P.flat(g, lm & ~face, lid[0], max(1, lid[1] - 1))
        m = m | lm
    else:
        inner = _inside_polygon(U, A, coffin_poly(cu, a0 + 2, w - 4, L - 4))
        P.flat(g, face & inner, *lid)
        P.outline(g, face & inner, lid[0], max(1, lid[1] - 1), normal={"up": "z", "z": "y", "x": "y"}[pose])
    if cross:
        cc = a0 + L * 0.62
        arm = max(2.0, w * 0.22)
        bar = (np.abs(U - cu) < 1.0) & (np.abs(A - cc) < L * 0.26)
        bar |= (np.abs(A - (cc + L * 0.08)) < 1.0) & (np.abs(U - cu) < arm)
        P.flat(g, face & bar, *trim)
    return m


def rock(g: Grid, cx, cz, y0, r: float, h: float, n: int = 6, twist: float = 18, shrink: float = 0.55, tilt=(0.0, 0.0), ramp: str = "stone", base: int = 4, moss: bool = True, seed: int = 0) -> np.ndarray:
    """A faceted boulder: an n-gon frustum whose smaller top is turned and
    shifted (true slopes on every side), stone paint and moss on top."""
    rng = np.random.default_rng(seed)
    radii = [r * rng.uniform(0.82, 1.0) for _ in range(n)]
    a0 = rng.uniform(0, 2 * math.pi)
    poly = [(cx + radii[k] * math.cos(a0 + 2 * math.pi * k / n), cz + radii[k] * math.sin(a0 + 2 * math.pi * k / n)) for k in range(n)]
    tw = math.radians(twist)
    top = [(cx + tilt[0] + shrink * radii[k] * math.cos(a0 + tw + 2 * math.pi * k / n), cz + tilt[1] + shrink * radii[k] * math.sin(a0 + tw + 2 * math.pi * k / n)) for k in range(n)]
    g.prism("y", poly, y0, y0 + h, C(ramp, base), top=top)
    m = last(g)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, ramp, base, block=(7, 5), cracks=0.15, frame=fr, seed=seed))
    if moss:
        _X, Y, _Z = coords(g)
        up = np.zeros(g.shape, dtype=bool)
        up[:, :-1, :] = g.a[:, 1:, :] == 0
        P.flat(g, m & up & (Y > y0 + h * 0.5), "moss", 5)
        blotch(g, m & up & (Y > y0 + h * 0.5), "moss", 6, cell=2, chance=0.15, seed=seed + 3)
    return m


def iron_fence(g: Grid, axis: str, a0, a1, c, y0, h: int = 14, gap: int = 4, ramp=("gray", 2)) -> np.ndarray:
    """An iron railing along `axis` ('x' or 'z') at the other coordinate c:
    2-voxel bars every `gap`, two rails and pyramid spear tips (true slopes)."""
    m = np.zeros(g.shape, dtype=bool)
    ka = 0 if axis == "x" else 2

    def bx(a_lo, a_hi, yy0, yy1, c0, c1):
        lo, hi = [0, yy0, 0], [0, yy1, 0]
        lo[ka], hi[ka] = a_lo, a_hi
        lo[2 - ka], hi[2 - ka] = c0, c1
        return box(g, lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], *ramp)

    a = a0
    while a + 2 <= a1:
        m |= bx(a, a + 2, y0, y0 + h, c, c + 2)
        x, z = (a, c) if axis == "x" else (c, a)
        g.prism("y", [(x - 0.5, z - 0.5), (x + 2.5, z - 0.5), (x + 2.5, z + 2.5), (x - 0.5, z + 2.5)], y0 + h, y0 + h + 4, C("gray", 4), top=[(x + 1, z + 1)] * 4)
        m |= last(g)
        a += gap
    for ry in (y0 + 3, y0 + h - 4):
        m |= bx(a0, a1, ry, ry + 2, c - 0.0, c + 2)
    return m


def urn(g: Grid, cx, y0, cz, s: int = 8, ramp: str = "gray", base: int = 6, glow=None) -> np.ndarray:
    """A funeral urn on a square foot: a flared octagon body (two
    frustums) and a lip; `glow` paints a burning top."""
    r = s / 2
    m = box(g, cx - r + 1, y0, cz - r + 1, cx + r - 1, y0 + 2, cz + r - 1, ramp, base - 1)
    m |= S.cone(g, "y", cx, cz, r * 0.5, y0 + 2, y0 + 2 + s * 0.5, ramp, base, r_top=r)
    m |= S.cone(g, "y", cx, cz, r, y0 + 2 + s * 0.5, y0 + 2 + s * 0.9, ramp, base, r_top=r * 0.7)
    lip = box(g, cx - r * 0.8, y0 + 2 + s * 0.9, cz - r * 0.8, cx + r * 0.8, y0 + 3 + s * 0.9, cz + r * 0.8, ramp, base - 1)
    m |= lip
    if glow:
        P.flat(g, lip, *glow)
    return m


def flame_cone(g: Grid, cx, y0, cz, r: float, h: float, ramp: str = "toxic") -> np.ndarray:
    """A fire of radius r and height h: the shared PN flame (_props.pn_flame),
    with a crossing flame so it reads from every side. `ramp` picks the
    colours: 'toxic' or 'magenta' for cursed fire, anything else warm."""
    from _props import MAGENTA, TOXIC, WARM, pn_flame

    colors = {"toxic": TOXIC, "magenta": MAGENTA}.get(ramp, WARM)
    w = max(4.0, 2.4 * r)
    return pn_flame(g, cx, cz, y0, w, max(5.0, h * 1.1), kind="big" if w >= 7 else "small", colors=colors, cross=0.8)


def brazier(g: Grid, cx, y0, cz, r: float = 5, fire: str = "toxic", legs: bool = True) -> np.ndarray:
    """An iron fire bowl (an upturned octagon frustum) with a chunky flame."""
    m = np.zeros(g.shape, dtype=bool)
    if legs:
        m |= S.cone(g, "y", cx, cz, r * 0.45, y0, y0 + 3, "gray", 3, r_top=r * 0.3)
        y0 += 3
    bowl = S.cone(g, "y", cx, cz, r * 0.55, y0, y0 + 4, "gray", 3, r_top=r)
    _X, Y, _Z = coords(g)
    P.flat(g, bowl & (Y > y0 + 3), "gray", 5)
    m |= bowl
    m |= box(g, cx - r + 1.5, y0 + 3, cz - r + 1.5, cx + r - 1.5, y0 + 4.5, cz + r - 1.5, fire, 5)
    m |= flame_cone(g, cx, y0 + 4, cz, r * 0.75, r * 1.6, fire)
    return m


def candle(g: Grid, x, y0, z, h: int = 4) -> np.ndarray:
    """A 2×2 wax candle lit with a small shared PN flame."""
    from _props import pn_flame

    m = box(g, x, y0, z, x + 2, y0 + h, z + 2, "bone", 6)
    P.flat(g, m & P.region(g, x, y0 + h - 1, z, x + 2, y0 + h, z + 2), "bone", 7)
    m |= pn_flame(g, x + 1, z + 1, y0 + h, 4, 7, kind="small")
    return m


def bat(g: Grid, cx, cy, z0, span: float = 21, t: int = 2, ramp: str = "purple", base: int = 3, eyes=("toxic", 7)) -> np.ndarray:
    """A flat bat silhouette in the x-y plane (the manor vane): a body
    block, scalloped wings and ears (true slopes), glowing eyes."""
    k = span / 21
    m = box(g, cx - 4 * k, cy - 5 * k, z0 - 1, cx + 4 * k, cy + 5 * k, z0 + t + 1, ramp, base - 1)
    for s in (-1, 1):
        pts = [(cx + s * 3 * k, cy + 4 * k), (cx + s * 10 * k, cy + 8 * k), (cx + s * 21 * k, cy + 6 * k), (cx + s * 19 * k, cy - 3 * k), (cx + s * 15.5 * k, cy - 1 * k), (cx + s * 12.5 * k, cy - 6 * k), (cx + s * 9 * k, cy - 2 * k), (cx + s * 4 * k, cy - 5 * k)]
        g.prism("z", pts, z0, z0 + t, C(ramp, base))
        m |= last(g)
        g.prism("z", S.quad((cx + s * 2.2 * k, cy + 4 * k), (cx + s * 3.6 * k, cy + 9.5 * k), 1.2 * k, 0.6 * k), z0 - 0.5, z0 + t + 0.5, C(ramp, base - 1))
        m |= last(g)
    P.outline(g, m, ramp, max(1, base - 2), normal="z")
    for ex in (cx - 3 * k, cx + 1 * k):
        g.box(ex, cy, z0 - 1, ex + 2, cy + 2, z0, C(*eyes))
        g.box(ex, cy, z0 + t, ex + 2, cy + 2, z0 + t + 1, C(*eyes))
    return m


def crow(g: Grid, x, y0, z, facing: int = 1, ramp: str = "purple", base: int = 2) -> np.ndarray:
    """A small perched crow facing +x (facing=1) or -x: a body wedge, a
    head block, a beak and a tail (true slopes), a gold eye."""
    s = facing
    g.prism("z", [(x - 4 * s, y0 + 2), (x + 2 * s, y0 + 1), (x + 3 * s, y0 + 5), (x - 2 * s, y0 + 6)], z - 1.5, z + 1.5, C(ramp, base))
    m = last(g)
    m |= box(g, min(x + 1 * s, x + 4 * s), y0 + 5, z - 1, max(x + 1 * s, x + 4 * s), y0 + 8, z + 1, ramp, base)
    g.prism("z", [(x + 4 * s, y0 + 6), (x + 4 * s, y0 + 7.5), (x + 7 * s, y0 + 6.5)], z - 0.5, z + 0.5, C("gold", 5))
    m |= last(g)
    g.prism("z", [(x - 3 * s, y0 + 2.5), (x - 3 * s, y0 + 5), (x - 8 * s, y0 + 3)], z - 1, z + 1, C(ramp, base - 1) if base > 1 else C(ramp, 1))
    m |= last(g)
    m |= box(g, min(x - 1 * s, x), y0, z - 1, max(x - 1 * s, x) + 1, y0 + 1, z + 1, "gold", 3)
    P.flat(g, m & P.region(g, min(x + 2 * s, x + 3 * s), y0 + 6, z - 1, max(x + 2 * s, x + 3 * s), y0 + 7, z + 1), "gold", 6)
    return m


def sail(g: Grid, axis: str, pts, lo, hi, ramp: str = "purple", base: int = 4, glyph: str | None = None, ink=("bone", 7), faces=("-z", "+z"), seed: int = 0) -> np.ndarray:
    """A torn cloth panel: a thin prism from an outline in the plane
    across `axis`, soft mottle, a darker hem, and an optional icon painted
    on both faces."""
    g.prism(axis, pts, lo, hi, C(ramp, base))
    m = last(g)
    P.mottle(g, m, ramp, base, cell=3, seed=seed)
    P.outline(g, m, ramp, max(1, base - 2), normal=axis)
    if glyph:
        import pnglyph

        us = [p[0] for p in pts]
        vs = [p[1] for p in pts]
        w, h = pnglyph.icon_size(glyph)
        cu, cv = (min(us) + max(us)) / 2, (min(vs) + max(vs)) / 2
        for f in faces:
            plane = lo if f[0] == "-" else hi
            pnglyph.icon(g, f, plane, int(round(cu - w / 2)), int(round(cv - h / 2)), glyph, *ink)
    return m


def tatter(pts_top, pts_bottom_y, u0, u1, teeth: int, depth: float, seed: int = 0) -> list[tuple[float, float]]:
    """A torn lower hem: the top edge `pts_top` (left to right), then a
    ragged edge from u1 back to u0 near y = pts_bottom_y."""
    rng = np.random.default_rng(seed)
    out = list(pts_top)
    for k in range(teeth, -1, -1):
        u = u0 + (u1 - u0) * k / teeth
        out.append((u, pts_bottom_y + (depth * rng.uniform(0.3, 1.0) if k % 2 else 0.0)))
    return out


def glow_pane(g: Grid, face: str, plane, u0, u1, v0, v1, glass=("toxic", 5), frame=("gray", 6), bars: int = 1) -> np.ndarray:
    """A square window 1 voxel proud: glowing glass, a light stone frame
    2 voxels proud, painted mullion bars and a sill."""
    pane = box(g, *on_face(face, plane, u0, u1, v0, v1, 0, 1), *glass)
    fr = box(g, *on_face(face, plane, u0 - 2, u0, v0, v1, 0, 2), *frame) | box(g, *on_face(face, plane, u1, u1 + 2, v0, v1, 0, 2), *frame)
    fr |= box(g, *on_face(face, plane, u0 - 2, u1 + 2, v1, v1 + 2, 0, 2), *frame)
    fr |= box(g, *on_face(face, plane, u0 - 3, u1 + 3, v0 - 2, v0, 0, 3), *frame)
    P.stone(g, fr, frame[0], frame[1], block=(5, 3), seed=3)
    X, Y, Z = idx(g)
    U = X if face[1] == "z" else Z
    for k in range(1, bars + 1):
        um = u0 + (u1 - u0) * k // (bars + 1)
        P.flat(g, pane & (U == um), frame[0], frame[1] - 2)
    P.flat(g, pane & (Y == (v0 + v1) // 2), frame[0], frame[1] - 2)
    P.flat(g, pane & (Y >= v1 - 2) & (U != u0), glass[0], min(7, glass[1] + 1))
    return pane


def facet_window(g: Grid, mask: np.ndarray, frame, v0: float, v1: float, w: float, glass=("toxic", 5), rim=("gray", 7), point: bool = True) -> np.ndarray:
    """Paint a pointed window on one facet of a sloped or turned prism
    (S1: paint, not geometry): centred on the facet, from height v0 to v1
    (grid y), `w` wide, a light rim and a painted cross bar. `mask` and
    `frame` come from pnshapes.facets."""
    U, _V = P.uv(g, frame)
    _X, Y, _Z = coords(g)
    uc = U[mask].mean() + 0.5
    du = np.abs(U + 0.5 - uc)
    half = w / 2
    if point:
        half = np.minimum(half, (v1 - Y) * (w / 2) / (w * 0.7))
    pane = mask & (Y > v0) & (Y < v1) & (du <= half)
    outer = mask & (Y > v0 - 1.5) & (Y < v1 + 1.5) & (du <= half + 1.5) & ~pane
    P.flat(g, outer, *rim)
    P.flat(g, pane, *glass)
    P.flat(g, pane & (Y < v0 + (v1 - v0) * 0.35), glass[0], min(7, glass[1] + 1))
    P.flat(g, pane & ((du < 0.5) | (np.abs(Y - (v0 + v1) / 2) < 0.5)), rim[0], max(1, rim[1] - 3))
    return pane


def mushroom(g: Grid, cx, y0, cz, h: int = 6, r: float = 3.5, cap=("toxic", 6), stem=("bone", 6)) -> np.ndarray:
    """A glowing toadstool: a square stem and a faceted cone cap (true
    slopes) with painted spots."""
    m = box(g, cx - 1, y0, cz - 1, cx + 1, y0 + h, cz + 1, *stem)
    m |= S.cone(g, "y", cx, cz, r, y0 + h - 1, y0 + h + r * 0.9, cap[0], cap[1], n=6)
    X, _Y, Z = idx(g)
    P.flat(g, m & (Y_above(g, y0 + h)) & (((X + Z) % 3) == 0), cap[0], min(7, cap[1] + 1))
    return m


def Y_above(g: Grid, y: float) -> np.ndarray:
    _X, Y, _Z = coords(g)
    return Y > y
