"""Building helpers for the fantasy pack at the shared world scale
(person = 36 voxels, doors 42-56 tall, storeys 40-52). Import as `_bkit`.

All helpers are vectorised (numpy) so that buildings of 150+ voxels build
fast. Facade helpers use facade-local coordinates like `_kit.face_fc`:
u runs along the wall, v = y, d points outward from the wall plane (d = 0
is the outer wall layer, d = 1 the air in front of it, d = -1 one voxel
inside the wall).
"""
from __future__ import annotations

import math

import numpy as np

from voxgrid import C, PALETTE, RAMP_SHADES, Grid

__all__ = [
    "fbox", "fline", "masonry", "stone_box", "plaster", "roof", "window2", "door2", "timber", "crate", "sack",
    "torch", "flower_box", "coords", "ramp_id", "table", "stairs", "shade_rows",
]


# ---------------------------------------------------------------- basics
def coords(g: Grid):
    """Integer index grids (broadcastable) for x, y, z."""
    sx, sy, sz = g.shape
    return (np.arange(sx)[:, None, None], np.arange(sy)[None, :, None], np.arange(sz)[None, None, :])


def ramp_id(ramp: str) -> int:
    return PALETTE["ramps"][ramp]


def table(seed: int, n: int = 4099, choices=(-1, 0, 0, 1)) -> np.ndarray:
    """Deterministic lookup table of shade offsets."""
    return np.random.default_rng(seed).choice(np.array(choices), n)


def _paint(g: Grid, xs, ys, zs, ramp: str, shades) -> None:
    rid = ramp_id(ramp)
    s = np.clip(shades, 1 if rid == 0 else 0, RAMP_SHADES - 1)
    g.a[xs, ys, zs] = (rid * RAMP_SHADES + s).astype(np.uint8)


# ---------------------------------------------------------------- facade boxes
def fbox(g: Grid, face: str, plane: int, u0, u1, v0, v1, d0, d1, c: int) -> Grid:
    """Box in facade-local coords: u in [u0,u1), v in [v0,v1), d in [d0,d1)."""
    if face == "-z":
        return g.box(u0, v0, plane - d1 + 1, u1, v1, plane - d0 + 1, c)
    if face == "+z":
        return g.box(u0, v0, plane + d0, u1, v1, plane + d1, c)
    if face == "-x":
        return g.box(plane - d1 + 1, v0, u0, plane - d0 + 1, v1, u1, c)
    if face == "+x":
        return g.box(plane + d0, v0, u0, plane + d1, v1, u1, c)
    raise ValueError(face)


def fline(g: Grid, face: str, plane: int, u0, v0, u1, v1, d0, d1, c: int, w: int = 2, bu: int = 2) -> Grid:
    """Stepped diagonal beam from (u0,v0) to (u1,v1) drawn with a brush
    `bu` wide in u and `w` tall in v."""
    n = int(max(abs(u1 - u0), abs(v1 - v0))) + 1
    for k in range(n):
        t = k / max(n - 1, 1)
        u = int(round(u0 + (u1 - u0) * t))
        v = int(round(v0 + (v1 - v0) * t))
        fbox(g, face, plane, u, u + bu, v, v + w, d0, d1, c)
    return g


# ---------------------------------------------------------------- materials
def masonry(g: Grid, mask: np.ndarray, ramp: str, shade: int, course: int = 4, length: int = 8, seed: int = 0,
            mortar: int = -1, var=(-1, 0, 0, 1), phase: int = 0) -> Grid:
    """Ashlar masonry on the filled voxels of `mask`: courses `course` tall,
    blocks about `length` long with a per-course random offset, per-block
    shade variation and mortar lines `mortar` shades darker."""
    xs, ys, zs = np.nonzero(np.broadcast_to(mask, g.shape) & (g.a != 0))
    if len(xs) == 0:
        return g
    row = (ys + phase) // course
    offs = np.random.default_rng(seed + 1).integers(0, length, 4099)
    along = xs + zs + offs[row % 4099]
    tab = table(seed, choices=var)
    bid = (row * 7919 + along // length) % 4099
    sh = shade + tab[bid]
    mort = ((ys + phase) % course == 0) | (along % length == 0)
    sh = np.where(mort, shade + mortar, sh)
    _paint(g, xs, ys, zs, ramp, sh)
    return g


def stone_box(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str = "stone", shade: int = 5, course: int = 4, length: int = 8,
              seed: int = 0, mortar: int = -1, var=(-1, 0, 0, 1)) -> Grid:
    """Solid box painted as ashlar masonry."""
    m = np.zeros(g.shape, bool)
    sx, sy, sz = g.shape
    m[max(0, int(x0)):min(sx, int(x1)), max(0, int(y0)):min(sy, int(y1)), max(0, int(z0)):min(sz, int(z1))] = True
    g.where(m, C(ramp, shade))
    return masonry(g, m, ramp, shade, course, length, seed, mortar, var)


def plaster(g: Grid, mask: np.ndarray, ramp: str = "bone", shade: int = 6, seed: int = 0, patch: int = 6) -> Grid:
    """Plaster: large soft patches one shade apart (structured, no speckle)."""
    xs, ys, zs = np.nonzero(np.broadcast_to(mask, g.shape) & (g.a != 0))
    tab = table(seed, choices=(0, 0, 0, -1))
    bid = ((ys // patch) * 131 + (xs + zs + (ys // patch) * 3) // (patch + 2)) % 4099
    _paint(g, xs, ys, zs, ramp, shade + tab[bid])
    return g


def shade_rows(g: Grid, mask: np.ndarray, period: int, delta: int, axis: int = 1, phase: int = 0) -> Grid:
    """Shift the shade of every `period`-th slice along `axis` inside mask."""
    idx = coords(g)[axis]
    m = np.broadcast_to(mask, g.shape) & (((idx + phase) % period) == 0) & (g.a != 0)
    vals = g.a[m].astype(np.int16)
    r, s = vals // RAMP_SHADES, vals % RAMP_SHADES
    s = np.clip(s + delta, 0, RAMP_SHADES - 1)
    out = r * RAMP_SHADES + s
    out[out == 0] = 1
    g.a[m] = out.astype(np.uint8)
    return g


# ---------------------------------------------------------------- roofs
def roof(g: Grid, kind: str, x0, x1, z0, z1, y0, pitch: float = 1.0, over: int = 3, gover: int = 2, thick: int = 2,
         ramp: str = "red", shade: int = 3, row: int = 3, tile: int = 4, cap=None, barge=None, attic=None,
         seed: int = 0, ridge: str = "x", lip: bool = True, profile=None, top_cut: float | None = None,
         var=(-1, 0, 0, 0, 1), joints: str = "all") -> int:
    """Tiled roof over the wall footprint [x0,x1)x[z0,z1) with eaves at y0.

    kind: 'gable' (ridge along `ridge`), 'hip' (pyramid / hipped) or 'cone'
    (centre of the footprint, radius = half the smaller side). `pitch` is
    rise per run voxel; `over` the eave overhang, `gover` the gable-end
    overhang. Tile courses are `row` run steps deep with a dark shadow line
    at the bottom of each course and staggered joints every `tile` voxels.
    `attic` fills the space under the roof over the footprint (gable ends).
    `profile(run)` may bend the slope (returns height above y0). `var` is
    the per-tile shade choice; `joints` = 'all' (a joint on every step),
    'edge' (joints only on the bottom step of each course: fewer quads).
    Returns the y just above the ridge."""
    x, y, z = coords(g)
    xc, zc = (x + 0.5), (z + 0.5)
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    hx, hz = (x1 - x0) / 2, (z1 - z0) / 2
    if kind == "gable":
        if ridge == "x":
            run = hz - np.abs(zc - cz) + 0 * xc
            along = x + 0 * z
            inside_a = (x >= x0 - gover) & (x < x1 + gover) & (z >= z0 - over) & (z < z1 + over)
            end = (x == x0 - gover) | (x == x1 + gover - 1)
        else:
            run = hx - np.abs(xc - cx) + 0 * zc
            along = z + 0 * x
            inside_a = (z >= z0 - gover) & (z < z1 + gover) & (x >= x0 - over) & (x < x1 + over)
            end = (z == z0 - gover) | (z == z1 + gover - 1)
        top_run = hx if ridge == "z" else hz
    elif kind == "hip":
        rx, rz = hx - np.abs(xc - cx), hz - np.abs(zc - cz)
        run = np.minimum(rx, rz)
        along = np.where(rx < rz, z + 0 * x, x + 0 * z)
        inside_a = run > -over
        end = np.zeros((1, 1, 1), bool)
        top_run = min(hx, hz)
    elif kind == "cone":
        r = min(hx, hz)
        dist = np.sqrt((xc - cx) ** 2 + (zc - cz) ** 2)
        run = r - dist
        ang = np.arctan2(zc - cz, xc - cx)
        along = np.floor((ang + np.pi) * max(r, 1)).astype(int)
        inside_a = run > -over
        end = np.zeros((1, 1, 1), bool)
        top_run = r
    else:
        raise ValueError(kind)
    if profile is None:
        hgt = run * pitch
    else:
        hgt = profile(run)
    top = np.floor(y0 + hgt)  # exclusive top of the roof skin at this column
    tv = max(thick, int(math.ceil(pitch)) + 1)
    yy = y + 0 * x
    skin = inside_a & (run > -over) & (yy < top) & (yy >= top - tv) & (yy >= y0 - over * pitch - tv)
    if top_cut is not None:
        skin &= run < top_cut
    skin = np.broadcast_to(skin, g.shape)
    if attic is not None:
        foot = (x >= x0) & (x < x1) & (z >= z0) & (z < z1)
        if kind != "gable":
            foot = foot & (run > 0)
        att = np.broadcast_to(foot & (yy >= y0) & (yy < top - tv + 1), g.shape) & ~skin
        g.where(att & (g.a == 0), attic)
    # tile shading
    s = np.floor(np.broadcast_to(run, g.shape) + over).astype(int)
    course = np.floor_divide(s, row)
    alongb = np.broadcast_to(along, g.shape)
    joint = ((alongb + (course % 2) * (tile // 2)) % tile) == 0
    tab = table(seed, choices=var)
    tid = (course * 977 + (alongb + (course % 2) * (tile // 2)) // tile) % 4099
    sh = shade + tab[tid]
    if joints == "edge":
        joint = joint & ((s % row) == 1)
    sh = np.where(joint, shade - 1, sh)
    sh = np.where((s % row) == 0, shade - 2, sh)
    # the exposed top voxel of each column is lit
    sh = np.where(np.broadcast_to(yy == top - 1, g.shape), sh + 1, sh)
    xs, ys, zs = np.nonzero(skin)
    _paint(g, xs, ys, zs, ramp, np.broadcast_to(sh, g.shape)[xs, ys, zs])
    # eave lip one shade darker
    if lip:
        lipm = skin & (np.broadcast_to(run, g.shape) < -over + 1)
        xs, ys, zs = np.nonzero(lipm)
        _paint(g, xs, ys, zs, ramp, np.full(len(xs), shade - 2))
    # barge boards at the gable ends
    if barge is not None and kind == "gable":
        g.where(skin & np.broadcast_to(end, g.shape), barge)
    # ridge cap
    ytop = int(np.floor(y0 + (profile(top_run) if profile else top_run * pitch)))
    if cap is not None:
        capm = np.broadcast_to(inside_a & (run > top_run - 1.6) & (yy >= top - tv) & (yy <= top), g.shape)
        g.where(capm, cap)
        return ytop + 1
    return ytop


# ---------------------------------------------------------------- openings
def window2(g: Grid, face: str, plane: int, u0: int, v0: int, w: int = 8, h: int = 14, arch: bool = False,
            frame=None, glass=None, glow: bool = False, mullion: bool = True, transom: bool = True,
            sill=None, lintel=None, shutters: str | None = None, depth: int = 1) -> Grid:
    """Window with its bottom-left glass voxel at (u0, v0): a proud frame,
    glass recessed `depth` (`glass` may be a function (du, dv) -> colour), mullion/transom bars, a proud sill, a lintel and
    optional plank shutters (ramp name)."""
    frame = frame if frame is not None else C("darkwood", 2)
    gl = glass if glass is not None else (C("ember", 5) if glow else C("navy", 2))
    hi = C("ember", 7) if glow else C("sky", 4)
    sill = sill if sill is not None else C("stone", 6)
    # opening mask in (u, v)
    uu = np.arange(u0 - 1, u0 + w + 1)
    vv = np.arange(v0 - 1, v0 + h + 1)
    U, V = np.meshgrid(uu, vv, indexing="ij")
    cu = u0 + w / 2
    r = w / 2
    if arch:
        vs = v0 + h - r
        op = (U >= u0) & (U < u0 + w) & (V >= v0) & ((V < vs) | (((U + 0.5 - cu) ** 2 + (V + 0.5 - vs) ** 2) <= r * r))
        rim = (U >= u0 - 1) & (U < u0 + w + 1) & (V >= v0 - 1) & ((V < vs) | (((U + 0.5 - cu) ** 2 + (V + 0.5 - vs) ** 2) <= (r + 1) ** 2)) & ~op
    else:
        op = (U >= u0) & (U < u0 + w) & (V >= v0) & (V < v0 + h)
        rim = ~op
    for (u, v) in zip(U[rim], V[rim]):
        fbox(g, face, plane, u, u + 1, v, v + 1, 0, 2, frame)
    for (u, v) in zip(U[op], V[op]):
        fbox(g, face, plane, u, u + 1, v, v + 1, -depth + 1, 1, 0)
        fbox(g, face, plane, u, u + 1, v, v + 1, -depth, -depth + 1, gl(u - u0, v - v0) if callable(gl) else gl)
    if callable(gl):
        hi = None
    # glint: short diagonal in the upper-left pane
    for k in range(min(3, w // 3) if hi is not None else 0):
        fbox(g, face, plane, u0 + 1 + k, u0 + 2 + k, v0 + h - 3 - k - (int(r) if arch else 0), v0 + h - 2 - k - (int(r) if arch else 0), -depth, -depth + 1, hi)
    if mullion and w >= 6:
        m = u0 + w // 2
        for (u, v) in zip(U[op], V[op]):
            if u == m:
                fbox(g, face, plane, u, u + 1, v, v + 1, -depth, -depth + 1, frame)
    if transom and h >= 10:
        tv = v0 + int(h * 0.6)
        for (u, v) in zip(U[op], V[op]):
            if v == tv:
                fbox(g, face, plane, u, u + 1, v, v + 1, -depth, -depth + 1, frame)
    # sill (proud 2, one wider each side) and lintel
    fbox(g, face, plane, u0 - 2, u0 + w + 2, v0 - 2, v0 - 1, 0, 3, sill)
    if lintel is not None and not arch:
        fbox(g, face, plane, u0 - 2, u0 + w + 2, v0 + h + 1, v0 + h + 3, 0, 2, lintel)
    if shutters:
        sw = max(3, w // 2)
        for su in (u0 - 1 - sw, u0 + w + 1):
            for k in range(sw):
                fbox(g, face, plane, su + k, su + k + 1, v0, v0 + h, 1, 2, C(shutters, 3 + (k % 2)))
            for vb in (v0 + 2, v0 + h - 3):
                fbox(g, face, plane, su, su + sw, vb, vb + 1, 2, 3, C("darkwood", 2))
    return g


def door2(g: Grid, face: str, plane: int, u0: int, v0: int, w: int = 22, h: int = 48, arch: bool = True,
          wood: str = "wood", shade: int = 3, frame: str | None = "stone", frame_shade: int = 5, recess: int = 2,
          handle=None, hinges=None, board: int = 3, jamb: int = 3, keystone=None, open_: bool = False) -> Grid:
    """Planked door (bottom-left at (u0, v0), w x h) set `recess` into the
    wall: vertical boards with seams, two ledger rails, iron strap hinges
    with nail heads, a ring handle and a voussoir frame (`frame` ramp, or
    None for a timber frame). An arched top has radius w/2."""
    handle = handle if handle is not None else C("gold", 5)
    hinges = hinges if hinges is not None else C("iron", 2)
    uu = np.arange(u0 - jamb, u0 + w + jamb)
    vv = np.arange(v0, v0 + h + jamb)
    U, V = np.meshgrid(uu, vv, indexing="ij")
    cu, r = u0 + w / 2, w / 2
    vs = v0 + h - r if arch else v0 + h
    if arch:
        op = (U >= u0) & (U < u0 + w) & ((V < vs) | (((U + 0.5 - cu) ** 2 + (V + 0.5 - vs) ** 2) <= r * r))
        rim = ((U >= u0 - jamb) & (U < u0 + w + jamb) & ((V < vs) | (((U + 0.5 - cu) ** 2 + (V + 0.5 - vs) ** 2) <= (r + jamb) ** 2))) & ~op
        ang = np.arctan2(V + 0.5 - vs, U + 0.5 - cu)
        vous = np.where(V >= vs, np.floor((ang) / (np.pi / 9)).astype(int), (V - v0) // 4)
    else:
        op = (U >= u0) & (U < u0 + w) & (V < v0 + h)
        rim = ~op
        vous = (V - v0) // 4 + (U > cu) * 50
    for (u, v, k) in zip(U[rim], V[rim], vous[rim]):
        if frame is None:
            c = C("darkwood", 2 + (1 if (v >= vs) else 0))
        else:
            c = C(frame, frame_shade + (0 if k % 2 else -1))
        fbox(g, face, plane, u, u + 1, v, v + 1, 0, 2, c)
    if keystone is not None and arch:
        fbox(g, face, plane, int(cu) - 1, int(cu) + 1 + (w % 2), int(vs + r), int(vs + r) + jamb + 1, 0, 3, keystone)
    for (u, v) in zip(U[op], V[op]):
        fbox(g, face, plane, u, u + 1, v, v + 1, -recess + 1, 2, 0)
        if open_:
            fbox(g, face, plane, u, u + 1, v, v + 1, -recess - 6, -recess + 1, 0)
            fbox(g, face, plane, u, u + 1, v, v + 1, -recess - 7, -recess - 6, C("darkwood", 1))
            continue
        b = (u - u0) // board
        s = shade + (1 if b % 2 else 0) - (1 if (u - u0) % board == 0 else 0)
        fbox(g, face, plane, u, u + 1, v, v + 1, -recess, -recess + 1, C(wood, max(0, s)))
    if open_:
        return g
    # ledger rails
    for vr in (v0 + 6, v0 + int(h * 0.55)):
        fbox(g, face, plane, u0, u0 + w, vr, vr + 2, -recess + 1, -recess + 2, C(wood, max(0, shade - 1)))
    # strap hinges with nail heads
    for vr in (v0 + 7, v0 + int(h * 0.55) + 1, v0 + h - int(r) - 3 if arch else v0 + h - 5):
        L = int(w * 0.6)
        fbox(g, face, plane, u0, u0 + L, vr, vr + 1, -recess + 1, -recess + 2, hinges)
        fbox(g, face, plane, u0 + L - 1, u0 + L, vr - 1, vr + 2, -recess + 1, -recess + 2, hinges)
    # ring handle
    hu = u0 + w - 4
    hv = v0 + 20
    fbox(g, face, plane, hu, hu + 1, hv, hv + 3, -recess + 1, -recess + 2, handle)
    fbox(g, face, plane, hu - 1, hu + 2, hv - 1, hv, -recess + 1, -recess + 2, handle)
    fbox(g, face, plane, hu, hu + 1, hv + 3, hv + 4, -recess + 1, -recess + 3, C("iron", 3))
    return g


def timber(g: Grid, face: str, plane: int, u0: int, u1: int, v0: int, v1: int, bay: int = 12, beam=None,
           braces="alt", w: int = 2, d: int = 1, skip=(), rail: int | None = None) -> Grid:
    """Timber framing proud of a wall: sill and head plates, posts every
    `bay`, braces. `braces` is 'alt' (alternate bays), 'all', 'x' (St
    Andrew's crosses), '' (none) or a dict {bay index: '/', '\\' (or 'b') or 'x'}.
    Bays in `skip` get no brace. `rail` adds a mid rail at that v."""
    beam = beam if beam is not None else C("darkwood", 2)
    fbox(g, face, plane, u0, u1, v0, v0 + w, 0, d + 1, beam)
    fbox(g, face, plane, u0, u1, v1 - w, v1, 0, d + 1, beam)
    if rail is not None:
        fbox(g, face, plane, u0, u1, rail, rail + w, 0, d + 1, beam)
    posts = list(range(u0, u1 - w + 1, bay))
    if posts[-1] != u1 - w:
        posts.append(u1 - w)
    for p in posts:
        fbox(g, face, plane, p, p + w, v0, v1, 0, d + 1, beam)
    for i in range(len(posts) - 1):
        if i in skip:
            continue
        a, b = posts[i] + w, posts[i + 1]
        if isinstance(braces, dict):
            kind = braces.get(i, "")
        elif braces == "all" or (braces == "alt" and i % 2 == 0):
            kind = "/" if i % 4 < 2 else "\\"
        elif braces == "x":
            kind = "x"
        else:
            kind = ""
        lo, hi = v0 + w, v1 - w - 2
        if kind in ("/", "x"):
            fline(g, face, plane, a, lo, b - 2, hi, 0, d + 1, beam, w=2)
        if kind in ("\\", "b", "x"):
            fline(g, face, plane, b - 2, lo, a, hi, 0, d + 1, beam, w=2)
    return g


# ---------------------------------------------------------------- small props
def crate(g: Grid, x, y, z, s: int = 16, wood: str = "wood", shade: int = 4) -> Grid:
    """Plank crate s^3 with darker edge battens and a diagonal brace."""
    for k in range(s):
        c = C(wood, shade + (1 if (k // 3) % 2 else 0) - (1 if k % 3 == 0 else 0))
        g.box(x, y + k, z, x + s, y + k + 1, z + s, c)
    e = C("darkwood", 3)
    for (a, b) in ((0, 0), (s - 2, 0), (0, s - 2), (s - 2, s - 2)):
        g.box(x + a, y, z + b, x + a + 2, y + s, z + b + 2, e)
    g.box(x, y, z, x + s, y + 2, z + s, e)
    g.box(x, y + s - 2, z, x + s, y + s, z + s, e)
    for k in range(2, s - 2):  # front brace
        g.box(x + k, y + k, z - 1, x + k + 1, y + k + 2, z, e)
    return g


def sack(g: Grid, x, y, z, w: int = 8, h: int = 10, ramp: str = "sand", shade: int = 5) -> Grid:
    g.ellipsoid(x + w / 2, y + h * 0.45, z + w / 2, w / 2, h * 0.5, w / 2 - 0.5, C(ramp, shade))
    g.box(x + w // 2 - 1, y + h - 2, z + w // 2 - 1, x + w // 2 + 1, y + h + 1, z + w // 2 + 1, C(ramp, shade - 1))
    g.box(x + w // 2 - 2, y + h - 3, z + w // 2 - 2, x + w // 2 + 2, y + h - 2, z + w // 2 + 2, C("wood", 2))
    return g


def torch(g: Grid, face: str, plane: int, u: int, v: int) -> Grid:
    """Wall torch: iron bracket, wooden haft and a flame; base at (u, v)."""
    fbox(g, face, plane, u - 1, u + 2, v, v + 2, 1, 2, C("iron", 2))
    fbox(g, face, plane, u, u + 1, v + 1, v + 2, 1, 4, C("iron", 3))
    fbox(g, face, plane, u, u + 1, v + 1, v + 7, 3, 4, C("darkwood", 3))
    fbox(g, face, plane, u - 1, u + 2, v + 6, v + 8, 2, 5, C("ember", 5))
    fbox(g, face, plane, u, u + 1, v + 7, v + 10, 3, 4, C("ember", 7))
    return g


def flower_box(g: Grid, face: str, plane: int, u0: int, u1: int, v: int, seed: int = 0) -> Grid:
    """Planter under a window: plank box proud 3, leaves and blossoms."""
    fbox(g, face, plane, u0, u1, v - 3, v, 1, 4, C("wood", 3))
    fbox(g, face, plane, u0, u1, v - 3, v - 2, 1, 4, C("darkwood", 3))
    rng = np.random.default_rng(seed)
    cols = ["pink", "gold", "red", "sky", "magenta"]
    for u in range(u0, u1):
        hh = int(rng.integers(1, 3))
        fbox(g, face, plane, u, u + 1, v, v + hh, 2, 4, C("leaf", 3 + (u % 2)))
        if (u - u0) % 2 == 0:
            fbox(g, face, plane, u, u + 1, v + hh, v + hh + 1, 2, 3, C(cols[int(rng.integers(0, 5))], 6))
    return g


def stairs(g: Grid, face: str, plane: int, u0: int, u1: int, n: int, rise: int = 5, tread: int = 4, ramp: str = "stone",
           shade: int = 5) -> Grid:
    """n front steps in front of a wall: the top step meets the wall at
    v = n*rise; each step `rise` high and `tread` deep, nosing lit."""
    for k in range(n):
        top = (n - k) * rise
        d0, d1 = 1 + k * tread, 1 + (k + 1) * tread
        fbox(g, face, plane, u0 - k, u1 + k, 0, top, d0 - (0 if k else 1), d1, C(ramp, shade - (k % 2)))
        fbox(g, face, plane, u0 - k, u1 + k, top - 1, top, d0, d1, C(ramp, shade + 1))
    return g


def stained_glass(cols, lead=None):
    """Glass colour function for window2: diamond quarries in `cols` with
    dark lead lines."""
    lead = lead if lead is not None else C("iron", 1)

    def f(du, dv):
        a, b = (du + dv) // 3, (du - dv) // 3
        if (du + dv) % 3 == 0 or (du - dv) % 3 == 0:
            return lead
        return cols[(a + b) % len(cols)]
    return f


def rose(g: Grid, face: str, plane: int, cu: float, cv: float, r: float, cols, frame=None, petals: int = 8) -> Grid:
    """Round rose window centred at (cu, cv): stone ring proud 1, tracery
    spokes, coloured petals recessed 1, a gold boss."""
    frame = frame if frame is not None else C("stone", 6)
    for u in range(int(cu - r - 2), int(cu + r + 3)):
        for v in range(int(cv - r - 2), int(cv + r + 3)):
            d = math.hypot(u + 0.5 - cu, v + 0.5 - cv)
            if d > r + 1.5:
                continue
            a = math.atan2(v + 0.5 - cv, u + 0.5 - cu)
            if d > r - 0.5:
                fbox(g, face, plane, u, u + 1, v, v + 1, 0, 2, frame)
                continue
            fbox(g, face, plane, u, u + 1, v, v + 1, 0, 1, 0)
            seg = (a + math.pi) / (2 * math.pi) * petals
            if d < 1.8:
                c = C("gold", 6)
            elif abs(seg - round(seg)) < 0.12 * (r / max(d, 1)) or abs(d - r * 0.45) < 0.6:
                c = frame
            else:
                c = cols[(int(seg) + (d > r * 0.45)) % len(cols)]
            fbox(g, face, plane, u, u + 1, v, v + 1, -1, 0, c)
    return g


def masonry_round(g: Grid, mask: np.ndarray, cx: float, cz: float, r: float, ramp: str, shade: int, course: int = 4,
                  length: int = 8, seed: int = 0, mortar: int = -1, var=(-1, 0, 0, 1)) -> Grid:
    """Masonry for round walls: blocks follow the circumference of radius
    `r` around (cx, cz) instead of x + z."""
    xs, ys, zs = np.nonzero(np.broadcast_to(mask, g.shape) & (g.a != 0))
    if len(xs) == 0:
        return g
    row = ys // course
    offs = np.random.default_rng(seed + 1).integers(0, length, 4099)
    ang = np.arctan2(zs + 0.5 - cz, xs + 0.5 - cx) + np.pi
    along = np.floor(ang * r).astype(int) + offs[row % 4099]
    tab = table(seed, choices=var)
    sh = shade + tab[(row * 7919 + along // length) % 4099]
    mort = (ys % course == 0) | (along % length == 0)
    _paint(g, xs, ys, zs, ramp, np.where(mort, shade + mortar, sh))
    return g


def ivy(g: Grid, face: str, plane_fn, u0: int, v0: int, height: int, seed: int = 0, spread: int = 10, ramp: str = "leaf") -> Grid:
    """Climbing ivy: a few stems that wander up from (u0, v0) with 2x2
    leaf clumps, drawn one voxel proud of the wall. `plane_fn(u, v)` gives
    the wall plane at that spot (a constant for flat walls)."""
    rng = np.random.default_rng(seed)
    for stem in range(3):
        u, v = u0 + int(rng.integers(-2, 3)), v0
        top = v0 + int(height * rng.uniform(0.5, 1.0))
        while v < top:
            p = plane_fn(u, v)
            if p is None:
                break
            fbox(g, face, p, u, u + 1, v, v + 1, 1, 2, C("forest", 2))
            if rng.random() < 0.45:
                du = int(rng.integers(-1, 2))
                fbox(g, face, p, u + du, u + du + 2, v, v + 2, 1, 2, C(ramp, int(rng.integers(3, 6))))
            v += 1
            if rng.random() < 0.3:
                u += int(rng.integers(-1, 2))
                u = max(u0 - spread, min(u0 + spread, u))
    return g


def surface(g: Grid, face: str, u: int, v: int) -> int:
    """Plane of the outermost filled voxel seen from `face` at (u, v): use
    it to stamp windows and doors onto curved walls."""
    if face == "-z":
        col = np.nonzero(g.a[u, v, :])[0]
        return int(col.min())
    if face == "+z":
        return int(np.nonzero(g.a[u, v, :])[0].max())
    if face == "-x":
        return int(np.nonzero(g.a[:, v, u])[0].min())
    if face == "+x":
        return int(np.nonzero(g.a[:, v, u])[0].max())
    raise ValueError(face)
