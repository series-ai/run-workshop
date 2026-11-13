"""Space pack helpers for the buildings and vehicles scope (import as `_bld`).

PN mecha look (the source of the space theme): blue-grey steel plates with
a dark riveted border, thick dark corner posts, copper pipes and gears,
teal glowing windows in copper frames, hazard orange; the space pack adds
warm white hull panels. Everything here fills the grid, paints it and
returns the mask it added. Detail is paint (rule S1); slopes are prisms
(rule F2). Faces are the pnkit faces ('-z' is the front).
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
import pnshapes as S
from pnkit import box, edges, on_face
from voxgrid import C, Grid

coords = S.coords
last = S.last


def facet_paint(g: Grid, solids, painter) -> None:
    """Paint each face of the prisms with its own frame (patterns follow slopes)."""
    S.paint_facets(g, solids, painter)


def plates_on(ramp: str, base: int, size=(9, 7), rivets: bool = True, seed: int = 0):
    """A facet painter: riveted plates along the face frame."""
    return lambda gg, mm, fr: P.plates(gg, mm, ramp, base, size=size, rivets=rivets, frame=fr, seed=seed)


def hull_on(ramp: str = "bone", base: int = 5, size=(12, 8), seed: int = 0):
    """A facet painter for white hull panels: soft mottle, a darker seam grid
    and a few rivets (rule S3: contrast at the seams only)."""
    def paint(gg, mm, fr):
        U, V = P.uv(gg, fr)
        P.mottle(gg, mm, ramp, base, cell=4, seed=seed)
        pw, ph = size
        P.flat(gg, mm & ((U % pw == 0) | (V % ph == 0)), ramp, base - 2)
        P.flat(gg, mm & (U % pw == 2) & (V % ph == 2), ramp, base - 1)
    return paint


def steel_box(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str = "steel", base: int = 5, size=(12, 9), seed: int = 0) -> np.ndarray:
    """A plated steel volume with a dark 1-voxel frame on its edges (S2, S4)."""
    m = box(g, x0, y0, z0, x1, y1, z1, ramp, base)
    pnpaint.plated(g, m, ramp, base, size=size, seed=seed)
    return m


def hull_box(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str = "bone", base: int = 5, size=(12, 8), seed: int = 0) -> np.ndarray:
    """A white hull volume: mottled panels, seams and dark edges."""
    m = box(g, x0, y0, z0, x1, y1, z1, ramp, base)
    hull_on(ramp, base, size, seed)(g, m, None)
    P.flat(g, edges(m), ramp, base - 2)
    return m


def corner_posts(g: Grid, x0, x1, z0, z1, y0, y1, size: int = 4, out: int = 1, ramp: str = "steel", base: int = 3) -> np.ndarray:
    """Thick dark steel posts on the four corners (rule F3), with rivet rows."""
    m = np.zeros(g.shape, dtype=bool)
    for cx, cz in ((x0 - out, z0 - out), (x1 + out - size, z0 - out), (x0 - out, z1 + out - size), (x1 + out - size, z1 + out - size)):
        m |= box(g, cx, y0, cz, cx + size, y1, cz + size, ramp, base)
    X, Y, Z = S._idx(g)
    P.flat(g, m & (Y % 6 == 3) & (((X + Z) % size) == 1), ramp, base + 2)
    P.flat(g, edges(m), ramp, base - 1)
    return m


def band(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str = "steel", base: int = 3) -> np.ndarray:
    """A proud dark eave or floor band (rule F3) with rivet dots."""
    m = box(g, x0, y0, z0, x1, y1, z1, ramp, base)
    X, Y, Z = S._idx(g)
    P.flat(g, m & ((X + Z) % 5 == 2) & (Y == int((y0 + y1) // 2)), ramp, base + 2)
    P.flat(g, edges(m), ramp, base - 1)
    return m


def steel_roof(g: Grid, x0, x1, z0, z1, wall_top, ridge_y, ridge: str = "z", ramp: str = "steel", base: int = 5, thick: int = 4, overhang: int = 4, gable: str = "bone", ridge_ramp: str = "rust", seed: int = 0) -> dict:
    """A steep PN mecha gable roof: two riveted steel slabs (true slopes,
    plates follow each slope), dark barge boards, a copper ridge beam and a
    white gable wall. Returns the masks {'slabs', 'attic', 'ridge'}."""
    from pnkit import gable_roof
    n0 = len(g.solids)
    r = gable_roof(g, x0, x1, z0, z1, wall_top, ridge_y, ramp=ramp, base=base, thick=thick, overhang=overhang, trim="iron", trim_shade=3, gable=gable, ridge=ridge, seed=seed)
    slabs = g.solids[n0 + 1 : n0 + 3]
    facet_paint(g, slabs, plates_on(ramp, base, size=(8, 6), seed=seed + 1))
    X, Y, Z = S._idx(g)
    B = Z if ridge == "z" else X
    b0, b1 = (z0, z1) if ridge == "z" else (x0, x1)
    P.flat(g, r["slabs"] & ((B < b0 - overhang + 3) | (B >= b1 + overhang - 3)), "iron", 3)
    P.flat(g, r["ridge"], ridge_ramp, 4)
    P.flat(g, edges(r["ridge"]), ridge_ramp, 3)
    P.mottle(g, r["attic"], gable, 5, cell=4, seed=seed + 2)
    return r


def window(g: Grid, face: str, plane, u0, u1, v0, v1, glass=("cyan", 6), rim=("rust", 3), frame=("rust", 4), bar: bool = True) -> np.ndarray:
    """A PN mecha window: a copper frame 2 proud, a glowing teal pane 1 proud
    with a bar, a lighter top band and a glint."""
    fm = box(g, *on_face(face, plane, u0 - 2, u1 + 2, v0 - 2, v1 + 2, 0, 1), *frame)
    P.flat(g, edges(fm), frame[0], frame[1] - 1)
    pm = box(g, *on_face(face, plane, u0, u1, v0, v1, 0, 1), *glass)
    fr = "top" if face == "top" else ("x" if face[1] == "x" else "z")
    pnpaint.glow_window(g, pm, rim=rim, glass=glass, bar=bar, frame=fr)
    sill = box(g, *on_face(face, plane, u0 - 3, u1 + 3, v0 - 3, v0 - 1, 0, 2), frame[0], frame[1] - 1)
    return pm | fm | sill


def blast_door(g: Grid, face: str, plane, u0, u1, v0, v1, leaf=("steel", 5), stripe=("orange", 5), seed: int = 0) -> np.ndarray:
    """A wide, short blast door (rule F4): a hazard-striped frame 2 proud, a
    plated leaf 1 proud with a dark split, a teal window strip and a gold
    handle bar."""
    fm = box(g, *on_face(face, plane, u0 - 3, u1 + 3, v0, v1 + 3, 0, 2), "iron", 3)
    fr = "x" if face[1] == "x" else "z"
    pnpaint.hazard(g, fm, period=4, a=stripe, b=("iron", 2), frame=fr)
    lm = box(g, *on_face(face, plane, u0, u1, v0, v1, 1, 3), *leaf)
    P.plates(g, lm, leaf[0], leaf[1], size=(max(4, (u1 - u0) // 2), 8), frame=fr, seed=seed)
    U, V = _face_uv(g, face)
    mid = (u0 + u1) // 2
    P.flat(g, lm & (U == mid), "iron", 3)
    P.flat(g, lm & (np.abs(U + 0.5 - (u0 + u1) / 2) < (u1 - u0) / 2 - 3) & (V >= v1 - 8) & (V < v1 - 5) & (U != mid), "cyan", 6)
    P.flat(g, lm & (np.abs(U - mid) < 5) & (U != mid) & (V >= v0 + (v1 - v0) // 2 - 1) & (V < v0 + (v1 - v0) // 2 + 1), "gold", 6)
    P.flat(g, lm & (V < v0 + 3), "iron", 3)
    return fm | lm


def _face_uv(g: Grid, face: str):
    X, Y, Z = S._idx(g)
    return {"z": (X, Y), "x": (Z, Y), "y": (X, Z)}["y" if face == "top" else face[1]]


def sign(g: Grid, face: str, plane, cu, v0, text: str, board=("orange", 5), ink=("bone", 7), scale: int = 1, pad: int = 3, depth: int = 2) -> np.ndarray:
    """A painted sign board with pixel text, centred on u = cu (never mirrored)."""
    tw, th = pnglyph.text_size(text, scale)
    u0 = int(round(cu - tw / 2))
    m = box(g, *on_face(face, plane, u0 - pad, u0 + tw + pad, v0, v0 + th + 2 * pad - 1, 0, depth), *board)
    P.flat(g, edges(m), board[0], board[1] - 2)
    pnglyph.text(g, face, _surface(face, plane, depth), u0, v0 + pad - 1, text, *ink, scale=scale)
    return m


def _surface(face: str, plane, depth):
    """The outer surface coordinate of a panel `depth` proud of `plane`."""
    return plane - depth if face[0] == "-" else plane + depth


def crate(g: Grid, x0, y0, z0, s, ramp: str = "orange", base: int = 5, stripe=("cyan", 6)) -> np.ndarray:
    """A chunky cargo crate: mottled panels, dark steel edges, a glowing stripe."""
    m = box(g, x0, y0, z0, x0 + s, y0 + s, z0 + s, ramp, base)
    P.mottle(g, m, ramp, base, seed=x0 + z0)
    P.flat(g, edges(m), "iron", 4)
    X, Y, Z = coords(g)
    P.flat(g, m & (np.abs(Y - (y0 + s / 2)) < 1) & ~edges(m), *stripe)
    return m


def fuel_drum(g: Grid, cx, cz, y0, h: int = 13, r: float = 5.5, ramp: str = "orange", icon: str | None = None) -> np.ndarray:
    return S.drum(g, cx, cz, y0, h, r, ramp=ramp, base=5, n=8, hoop="iron", band=("bone", 6) if icon else None, icon=icon, ink=("orange", 3), wear=False)


def truss(g: Grid, axis: str, p0, p1, width: float, lo, hi, ramp: str = "orange", base: int = 5, braces: int = 4, thick: float = 2.5) -> np.ndarray:
    """A flat lattice panel between two rails (true diagonal braces, rule
    F2): rails from p0 to p1 offset ±width/2 across, zig-zag braces between,
    in the plane across `axis` (PRISM_PLANE order), extruded over [lo, hi)."""
    (u0, v0), (u1, v1) = p0, p1
    L = math.hypot(u1 - u0, v1 - v0)
    nu, nv = -(v1 - v0) / L, (u1 - u0) / L
    h = width / 2
    a0, a1 = (u0 + nu * h, v0 + nv * h), (u1 + nu * h, v1 + nv * h)
    b0, b1 = (u0 - nu * h, v0 - nv * h), (u1 - nu * h, v1 - nv * h)
    m = S.bar(g, axis, a0, a1, thick + 1, lo, hi, ramp, base)
    m |= S.bar(g, axis, b0, b1, thick + 1, lo, hi, ramp, base)
    for k in range(braces):
        t0, t1 = k / braces, (k + 1) / braces
        pa = (a0[0] + (a1[0] - a0[0]) * t0, a0[1] + (a1[1] - a0[1]) * t0)
        pb = (b0[0] + (b1[0] - b0[0]) * t1, b0[1] + (b1[1] - b0[1]) * t1)
        if k % 2:
            pa = (b0[0] + (b1[0] - b0[0]) * t0, b0[1] + (b1[1] - b0[1]) * t0)
            pb = (a0[0] + (a1[0] - a0[0]) * t1, a0[1] + (a1[1] - a0[1]) * t1)
        m |= S.bar(g, axis, pa, pb, thick, lo + 0.5, hi - 0.5, ramp, base - 1)
    return m


def glass_band(g: Grid, mask: np.ndarray, solids, glass=("cyan", 6), mull=("rust", 3)) -> None:
    """Paint a glowing glass band on a faceted prism: copper mullions on the
    facet seams, a lighter top row (the sky in the glass)."""
    P.flat(g, mask, *glass)
    ys = np.nonzero(mask.any(axis=(0, 2)))[0]
    X, Y, Z = S._idx(g)
    P.flat(g, mask & (Y >= ys.max() - 1), glass[0], min(7, glass[1] + 1))
    P.flat(g, mask & S.seams(g, solids, 1.0), *mull)
    P.flat(g, mask & ((Y == ys.min()) | (Y == ys.max())), *mull)


def beacon(g: Grid, cx, y0, cz, h: int = 8, lamp=("red", 5)) -> np.ndarray:
    """A thin mast with a big glowing lamp on top."""
    m = box(g, cx - 1, y0, cz - 1, cx + 1, y0 + h, cz + 1, "iron", 4)
    lm = box(g, cx - 2, y0 + h, cz - 2, cx + 2, y0 + h + 3, cz + 2, *lamp)
    P.flat(g, lm & (coords(g)[1] > y0 + h + 2), lamp[0], min(7, lamp[1] + 2))
    return m | lm


def spot(g: Grid, face: str, plane, cu, cv, s: int = 5, lamp=("gold", 7)) -> np.ndarray:
    """A chunky wall floodlight: a dark housing with a glowing lens."""
    h = box(g, *on_face(face, plane, cu - s / 2 - 1, cu + s / 2 + 1, cv - s / 2 - 1, cv + s / 2 + 1, 0, 3), "iron", 4)
    lm = box(g, *on_face(face, plane, cu - s / 2, cu + s / 2, cv - s / 2, cv + s / 2, 3, 4), *lamp)
    return h | lm


def big_gear(g: Grid, face: str, plane, cu, cv, r: float, teeth: int = 10, thick: int = 3, ramp: str = "rust", base: int = 4) -> np.ndarray:
    """An oversized copper gear standing `thick` proud of a wall, with a gold
    hub one voxel prouder (PN mecha motif). (cu, cv) is the face centre."""
    x0, y0, z0, x1, y1, z1 = on_face(face, plane, 0, 1, 0, 1, 0, thick)
    axis = "y" if face == "top" else face[1]
    lo, hi = {"x": (x0, x1), "z": (z0, z1), "y": (y0, y1)}[axis]
    pu, pv = (cv, cu) if axis == "x" else (cu, cv)  # PRISM_PLANE order
    m = S.gear(g, axis, pu, pv, r, lo, hi, teeth=teeth, depth=3.0, ramp=ramp, base=base)
    h0, h1 = (lo - 1, hi) if face[0] == "-" else (lo, hi + 1)
    hub = S.disc(g, axis, pu, pv, max(2.0, r * 0.3), h0, h1, "gold", 5)
    return m | hub


def rel(pivot, p) -> tuple[float, float, float]:
    """A grid point in the pivot space of a part whose pivot is `pivot`."""
    return tuple(float(a - b) for a, b in zip(p, pivot))
