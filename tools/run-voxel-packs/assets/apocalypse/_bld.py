"""Apocalypse buildings and vehicles helpers, Pirate Nation style (import as `_bld`).

Scope: assets/apocalypse/buildings/* and assets/apocalypse/vehicles/*.
Big chunky prisms (true slopes), detail painted (rules F1, F2, S1). The
shared kit (pnkit, pnshapes, pnpaint, paint, pnglyph) does the work; these
helpers add the pieces the kit does not have yet:

    rel, part           child parts in the same grid frame (full-size grids)
    gable               a gable roof with a choice of painter (corrugated
                        sheet, tiles, planks, plates) and its own barge boards
    slab                a dusty concrete ground slab with an outline
    sandbags            a wall of chamfered sandbag rows (true slopes)
    leg                 an oblique post that leans in x and z (tower legs)
    bloom               soft rust or dirt blooms (no speckle, rule S3)
    sign                a framed board with centred painted text
    label               centred painted text
    wheel_grid, rig     vehicle wheels as spinning parts, body, move/idle clips

Candidates for the shared kit are marked "(kit candidate)".
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
import pnshapes as S
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Part, Socket, turn


# ------------------------------------------------------------------ parts
def rel(pivot, p) -> tuple[float, float, float]:
    """`p` (grid coordinates) in the pivot space of a part whose pivot is `pivot`."""
    return tuple(float(p[i] - pivot[i]) for i in range(3))  # type: ignore[return-value]


def part(parent: Part, name: str, grid: Grid | None, hinge, rot=(0.0, 0.0, 0.0), frame_pivot=None) -> Part:
    """Add a child whose grid shares the parent's grid frame: its pivot is
    the `hinge` point (grid coordinates) and it sits exactly where it was
    authored. `frame_pivot` is the parent's pivot in that frame (default:
    parent.pivot). (kit candidate)"""
    fp = parent.pivot if frame_pivot is None else frame_pivot
    hinge = tuple(float(v) for v in hinge)
    return parent.add(Part(name, grid, pivot=hinge, at=rel(fp, hinge), rot=tuple(float(r) for r in rot)))


# ------------------------------------------------------------------ roofs
def gable(g: Grid, x0, x1, z0, z1, wall_top, ridge_y, ridge: str = "x", thick: int = 4, overhang: int = 5,
          roof=("rust", 4), style: str = "corrugate", attic=("wood", 5), attic_style: str = "planks",
          trim=("darkwood", 5), ridge_cap: bool = True, seed: int = 0) -> dict:
    """A steep gable roof over the walls x0..x1 × z0..z1 (as pnkit.gable_roof)
    whose slabs are painted by `style`: 'corrugate' (ribs down the slope),
    'tiles', 'planks' (boards down the slope) or 'plates'. The attic (gable
    walls) is painted with `attic_style` ('planks', 'plates', 'brick',
    'mottle'). Barge boards and the ridge cap are in `trim`. Returns masks
    {'slabs', 'front', 'back', 'attic', 'ridge', 'trim'}. (kit candidate)"""
    a0, a1, b0, b1 = (z0, z1, x0, x1) if ridge == "x" else (x0, x1, z0, z1)
    ac = (a0 + a1) / 2
    ae0, ae1 = a0 - overhang, a1 + overhang
    eave = wall_top - thick // 2
    bs0, bs1 = b0 - overhang + 1, b1 + overhang - 1
    rise = (ridge_y - eave) / (ac - ae0)
    under0 = eave + (a0 - ae0) * rise
    pt = (lambda a, y: (y, a)) if ridge == "x" else (lambda a, y: (a, y))
    g.prism(ridge, [pt(a0, wall_top), pt(a1, wall_top), pt(a1, under0), pt(ac, ridge_y), pt(a0, under0)], b0, b1, C(*attic))
    am = S.last(g)
    ar, ab = attic
    if attic_style == "planks":
        P.planks(g, am, ar, ab, width=3, across="y", seed=seed)
    elif attic_style == "plates":
        P.plates(g, am, ar, ab, size=(10, 6), seed=seed)
    elif attic_style == "brick":
        P.stone(g, am, ar, ab, block=(6, 3), seed=seed)
    else:
        P.mottle(g, am, ar, ab, seed=seed)
    rr, rb = roof
    g.prism(ridge, [pt(ae0, eave), pt(ae0, eave + thick), pt(ac, ridge_y + thick), pt(ac, ridge_y)], bs0, bs1, C(rr, rb))
    front = S.last(g)
    g.prism(ridge, [pt(ae1, eave), pt(ac, ridge_y), pt(ac, ridge_y + thick), pt(ae1, eave + thick)], bs0, bs1, C(rr, rb))
    back = S.last(g)
    ridge_vec = (1.0, 0.0, 0.0) if ridge == "x" else (0.0, 0.0, 1.0)
    for m, a_end in ((front, ae0), (back, ae1)):
        down = (0.0, eave - ridge_y, a_end - ac) if ridge == "x" else (a_end - ac, eave - ridge_y, 0.0)
        fr = (ridge_vec, down)
        if style == "corrugate":
            pnpaint.corrugate(g, m, rr, rb, period=3, sheet=12, length=18, frame=fr, seed=seed)
        elif style == "tiles":
            P.tiles(g, m, rr, rb, row=4, width=5, frame=fr, seed=seed)
        elif style == "planks":
            P.planks(g, m, rr, rb, width=4, across="x", frame=fr, seed=seed)
        elif style == "plates":
            P.plates(g, m, rr, rb, size=(10, 8), frame=fr, seed=seed)
        else:
            raise ValueError(f"unknown roof style {style!r}")
        # the eave edge row: a darker lip (rule S4)
        _X, Y, _Z = S._idx(g)
        P.flat(g, m & (Y < eave + 1), rr, max(1, rb - 2))
    slabs = front | back
    X, Y, Z = S._idx(g)
    B = X if ridge == "x" else Z
    tm = slabs & ((B < bs0 + 2) | (B >= bs1 - 2))
    P.flat(g, tm, *trim)
    rm = np.zeros(g.shape, dtype=bool)
    if ridge_cap:
        if ridge == "x":
            rm = box(g, bs0 - 1, ridge_y + thick - 1, ac - 2, bs1 + 1, ridge_y + thick + 2, ac + 2, trim[0], trim[1])
        else:
            rm = box(g, ac - 2, ridge_y + thick - 1, bs0 - 1, ac + 2, ridge_y + thick + 2, bs1 + 1, trim[0], trim[1])
        P.planks(g, rm, trim[0], trim[1], width=3, across="x" if ridge == "z" else "z", seed=seed + 1)
    return {"slabs": slabs, "front": front, "back": back, "attic": am, "ridge": rm, "trim": tm}


def roof_y(x_or_z: float, a0: float, a1: float, eave: float, ridge_y: float, thick: int = 4) -> float:
    """Top surface height of a gable slab at a coordinate across the ridge
    (a0..a1 are the eave ends including the overhang)."""
    ac = (a0 + a1) / 2
    t = 1 - abs(x_or_z - ac) / (ac - a0)
    return eave + thick + t * (ridge_y - eave)


# ------------------------------------------------------------------ ground and walls
def slab(g: Grid, x0, z0, x1, z1, h: int = 3, ramp: str = "sand", base: int = 5, cracks: int = 8, seed: int = 0) -> np.ndarray:
    """A poured slab to stand the building on: concrete seams and cracks on
    top, a darker outline. (kit candidate)"""
    m = box(g, x0, 0, z0, x1, h, z1, ramp, base)
    pnpaint.concrete(g, m, ramp, base, size=16, cracks=cracks, seed=seed)
    P.outline(g, m, ramp, base - 2, normal="y")
    return m


def sandbags(g: Grid, axis: str, u0: float, u1: float, c0: float, y0: float, rows: int = 2, h: int = 5, d: int = 7,
             ramp: str = "sand", base: int = 5, bag: int = 9, seed: int = 0) -> np.ndarray:
    """A wall of sandbag rows along `axis` ('x' or 'z') from u0 to u1, its
    front at c0 on the other level axis, `d` deep. Each row is one prism
    with a chamfered section (true slopes); bag seams are painted and
    staggered. (kit candidate)"""
    m = np.zeros(g.shape, dtype=bool)
    X, Y, Z = S._idx(g)
    U = X if axis == "x" else Z
    for r in range(rows):
        y = y0 + r * h
        c = c0 + (r % 2) * 0.0
        ch = 1.5
        sec = [(c, y + ch), (c + ch, y), (c + d - ch, y), (c + d, y + ch), (c + d, y + h - ch), (c + d - ch, y + h), (c + ch, y + h), (c, y + h - ch)]
        # prism plane: (y, z) for axis 'x', (x, y) for axis 'z'
        poly = [(yy, cc) for cc, yy in sec] if axis == "x" else sec
        g.prism(axis, poly, u0 + (r % 2), u1 - (r % 2), C(ramp, base))
        row = S.last(g)
        shade = base + P._jitter(P._hash((U + (r % 2) * (bag // 2)) // bag, r, seed=seed))
        P._paint(g, row, ramp, shade)
        P.flat(g, row & ((U + (r % 2) * (bag // 2)) % bag == 0), ramp, base - 2)
        P.flat(g, row & (Y >= y + h - 1), ramp, min(7, base + 1))
        m |= row
    return m


def leg(g: Grid, x0, z0, x1, z1, y0, y1, dx: float, dz: float, ramp: str = "darkwood", base: int = 4, planks: bool = True, seed: int = 0) -> np.ndarray:
    """An oblique post: the square x0..x1 × z0..z1 at y0, shifted by (dx, dz)
    at y1, so it leans in both level axes (true slopes). (kit candidate)"""
    sq = [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
    top = [(x + dx, z + dz) for x, z in sq]
    g.prism("y", sq, y0, y1, C(ramp, base), top=top)
    m = S.last(g)
    if planks:
        P.planks(g, m, ramp, base, width=max(2, int(x1 - x0)), across="x", nails=False, length=(30, 31), seed=seed)
    return m


def bloom(g: Grid, mask: np.ndarray, n: int, box3, r=(2.0, 4.0), ramp: str = "rust", shades=(5, 4), seed: int = 0) -> None:
    """`n` soft blooms (rust, dirt, moss) inside the box ((x0, y0, z0),
    (x1, y1, z1)), each a light ring around a darker core, only on `mask`. (kit candidate)"""
    rng = np.random.default_rng(seed)
    X, Y, Z = S.coords(g)
    (bx0, by0, bz0), (bx1, by1, bz1) = box3
    for _ in range(n):
        cx, cy, cz = rng.uniform(bx0, bx1), rng.uniform(by0, by1), rng.uniform(bz0, bz1)
        rad = rng.uniform(*r)
        d = np.sqrt((X - cx) ** 2 + ((Y - cy) * 1.3) ** 2 + (Z - cz) ** 2)
        P.flat(g, mask & (d < rad), ramp, shades[0])
        P.flat(g, mask & (d < rad * 0.55), ramp, shades[1])


# ------------------------------------------------------------------ signs and text
def label(g: Grid, face: str, plane: float, uc: float, v0: float, s: str, ramp: str, shade: int, scale: int = 1, gap: int = 1) -> np.ndarray:
    """Painted text centred on uc (never mirrored)."""
    w, _h = pnglyph.text_size(s, scale, gap)
    return pnglyph.text(g, face, plane, int(round(uc - w / 2)), int(v0), s, ramp, shade, scale=scale, gap=gap)


def sign(g: Grid, face: str, plane: float, uc: float, v0: float, s: str, board=("bone", 6), ink=("red", 4), frame=("darkwood", 3),
         scale: int = 2, gap: int = 1, pad: int = 3, depth: int = 2) -> np.ndarray:
    """A board standing `depth` proud of a face with centred text and a dark
    frame. (uc, v0): centre along the face and the board's bottom. Returns the board mask."""
    from pnkit import on_face

    w, h = pnglyph.text_size(s, scale, gap)
    u0, u1 = uc - w / 2 - pad, uc + w / 2 + pad
    m = box(g, *on_face(face, plane, int(math.floor(u0)), int(math.ceil(u1)), v0, v0 + h + 2 * pad, 0, depth), board[0], board[1])
    P.mottle(g, m, board[0], board[1], seed=int(uc))
    ax = "y" if face == "top" else face[1]
    P.outline(g, m, frame[0], frame[1], normal=ax)
    out = plane + depth if face[0] == "+" else plane - depth
    label(g, face, out, uc, v0 + pad, s, ink[0], ink[1], scale=scale, gap=gap)
    return m


# ------------------------------------------------------------------ vehicles
def wheel_grid(shape, x0: float, x1: float, cz: float, r: float, rim=("steel", 5), hub=("gold", 5), spokes: int = 5,
               tyre=("gray", 3), spoke=("steel", 6), n: int = 8) -> tuple[Grid, tuple[float, float, float]]:
    """One wheel in its own full-size grid (axle along x, flat side on y=0),
    painted by pnshapes.wheel. Returns (grid, axle centre)."""
    g = Grid(*shape)
    info = S.wheel(g, "x", cz, 0, r, x0, x1, n=n, spokes=spokes, gaps=False, tyre=tyre, rim=rim, spoke=spoke, hub=hub)
    return g, info["centre"]


def rig(name: str, body: Grid, wheels, exhaust, spin_s: float = 0.8, extra_sockets=(), body_parts=(), bounce: float = 0.4):
    """A vehicle: root (no grid) → wheel-0.. (spin about x on `move`) and
    body (bounces on `move`, idles on `idle`). `wheels` is a list of
    (grid, centre); `exhaust` a grid point; `extra_sockets` (name, point);
    `body_parts` (name, grid, hinge, rot, keys_idle, keys_move) children of
    the body. Returns (root, [move, idle], sockets)."""
    occ = body.a > 0
    for wg, _c in wheels:
        occ = occ | (wg.a > 0)
    for _n, pg, *_rest in body_parts:
        occ = occ | (pg.a > 0)
    xs, _ys, zs = np.nonzero(occ)
    rp = (float(round((xs.min() + xs.max() + 1) / 2)), 0.0, float(round((zs.min() + zs.max() + 1) / 2)))
    root = Part(name, None, pivot=rp)
    for i, (wg, c) in enumerate(wheels):
        part(root, f"wheel-{i}", wg, c)
    axle_y = float(np.mean([c[1] for _wg, c in wheels]))
    bj = (rp[0], axle_y, rp[2])
    bpart = part(root, "body", body, bj)
    move = {f"wheel-{i}": {"rot": turn(spin_s, "x", -360 / spin_s)} for i in range(len(wheels))}
    move["body"] = {"loc": [(spin_s * k / 4, (0.0, bounce if k % 2 else 0.0, 0.0)) for k in range(5)],
                    "rot": [(0.0, (0.0, 0.0, 0.0)), (spin_s / 2, (1.2, 0.0, 0.6)), (spin_s, (0.0, 0.0, 0.0))]}
    idle = {"body": {"loc": [(k * 0.08, (0.0, 0.18 if k % 2 else 0.0, 0.0)) for k in range(11)]}}
    for pname, pg, hinge, prot, kidle, kmove in body_parts:
        part(bpart, pname, pg, hinge, rot=prot)
        if kidle:
            idle[pname] = kidle
        if kmove:
            move[pname] = kmove
    socks = [Socket("socket-exhaust", at=rel(rp, exhaust), parent="body")]
    for sname, pt in extra_sockets:
        socks.append(Socket(sname, at=rel(rp, pt), parent="body"))
    return root, [Clip("move", move), Clip("idle", idle)], socks


def crate(g: Grid, x0, y0, z0, s: int, ramp: str = "sand", base: int = 4, frame=("rust", 3), icon: str | None = None, ink=("red", 4), seed: int = 0) -> np.ndarray:
    """A warm supply crate: planked sides, a frame on every edge and an
    optional ICONS stamp on the front (-z). (kit candidate: pnkit.crate
    with a lighter frame and an icon)"""
    m = box(g, x0, y0, z0, x0 + s, y0 + s, z0 + s, ramp, base)
    P.planks(g, m, ramp, base, width=max(3, s // 4), across="y", nails=True, seed=seed)
    P.flat(g, edges(m), *frame)
    if icon:
        iw, ih = pnglyph.icon_size(icon)
        pnglyph.icon(g, "-z", z0, int(x0 + (s - iw) // 2), int(y0 + (s - ih) // 2), icon, *ink)
    return m
