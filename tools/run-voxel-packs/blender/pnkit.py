"""Pirate Nation style building blocks for world assets (all packs).

Art direction: docs/art-direction.md. Big chunky volumes (rule F1),
true slopes (F2), thick dark frames (F3), detail painted on flat faces
(S1–S4). Everything here fills the grid and paints it; atlas.py turns the
colours into texture, so painted detail costs no triangles.

Faces: '-z' is the front; '+z', '-x', '+x' are the other walls and 'top'
is an upward surface (skylights, hatches, trapdoors). `plane` is the surface
coordinate on that face (the boundary between the surface voxels and the
air); `u` runs along the face (x on z faces and on 'top', z on x faces), `v`
is height (z on 'top') and `d0..d1` is the depth outward from the surface.
Every feature here (window, door, lancet, rose, shutters) works on every face.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
from voxgrid import C, Grid


def ngon(cu: float, cv: float, r: float, n: int = 8, turn: float | None = None) -> list[tuple[float, float]]:
    """Regular polygon; by default a flat side faces each axis (octagon: 22.5°)."""
    turn = math.pi / n if turn is None else turn
    return [(cu + r * math.cos(turn + 2 * math.pi * k / n), cv + r * math.sin(turn + 2 * math.pi * k / n)) for k in range(n)]


FACES = ("-z", "+z", "-x", "+x", "top")


def on_face(face: str, plane: float, u0, u1, v0, v1, d0, d1) -> tuple[float, float, float, float, float, float]:
    """Box (x0, y0, z0, x1, y1, z1) on a face: u runs along the face (x on z
    faces and on 'top', z on x faces), v is height (z on 'top'), d is the
    depth out of the surface."""
    if face == "-z":
        return (u0, v0, plane - d1, u1, v1, plane - d0)
    if face == "+z":
        return (u0, v0, plane + d0, u1, v1, plane + d1)
    if face == "-x":
        return (plane - d1, v0, u0, plane - d0, v1, u1)
    if face == "+x":
        return (plane + d0, v0, u0, plane + d1, v1, u1)
    if face == "top":
        return (u0, plane + d0, v0, u1, plane + d1, v1)
    raise ValueError(f"face must be one of {FACES}, got {face!r}")


def _axis(face: str) -> str:
    """The axis a face looks along ('x', 'y' or 'z')."""
    return "y" if face == "top" else face[1]


def face_prism(g: Grid, face: str, plane: float, pts_uv, d0: float, d1: float, c: int) -> np.ndarray:
    """A prism on a face: polygon `pts_uv` in the face's (u, v), extruded
    from depth d0 to d1 out of the surface. Returns its mask."""
    x0, y0, z0, x1, y1, z1 = on_face(face, plane, 0, 1, 0, 1, d0, d1)
    axis = _axis(face)
    if axis == "z":  # prism plane (x, y) = (u, v)
        g.prism("z", list(pts_uv), z0, z1, c)
    elif axis == "x":  # prism plane (y, z) = (v, u)
        g.prism("x", [(v, u) for u, v in pts_uv], x0, x1, c)
    else:  # 'top': prism plane (x, z) = (u, v)
        g.prism("y", list(pts_uv), y0, y1, c)
    return _last(g)


def box(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str, base: int = 4) -> np.ndarray:
    """Fill a box and return its mask (for painting)."""
    g.box(x0, y0, z0, x1, y1, z1, C(ramp, base))
    return P.region(g, x0, y0, z0, x1, y1, z1)


def edges(mask: np.ndarray) -> np.ndarray:
    """Voxels of a box-like mask that lie on two or more of its outer planes: its edges."""
    count = np.zeros(mask.shape, dtype=np.int8)
    for axis in range(3):
        for step in (1, -1):
            nb = np.roll(mask, step, axis=axis)
            edge = [slice(None)] * 3
            edge[axis] = 0 if step == 1 else -1
            nb[tuple(edge)] = False
            count += (mask & ~nb).astype(np.int8)
    return mask & (count >= 2)


def _last(g: Grid) -> np.ndarray:
    """Mask of the prism added last."""
    return g.solids[-1].mask(g.shape)


def gable_roof(g: Grid, x0, x1, z0, z1, wall_top, ridge_y, ramp: str = "red", base: int = 4, thick: int = 4, overhang: int = 5, trim: str = "darkwood", gable: str = "sand", ridge: str = "x", trim_shade: int = 3, seed: int = 0) -> dict:
    """Gable roof over the walls x0..x1 × z0..z1 with the ridge along `ridge`
    ('x' or 'z'; 'z' turns the gable to the front, as PN usually does). Two
    tiled slabs (true slopes), a solid attic under them whose ends are the
    gable walls, barge boards at the slab ends and a ridge beam in `trim`
    at `trim_shade` (dark wood by default; pass trim='stone', trim_shade=6
    for light stone barge boards). Returns the masks {'slabs', 'attic',
    'ridge'} for extra painting."""
    # a0..a1: across the ridge (the slope direction); b0..b1: along the ridge
    a0, a1, b0, b1 = (z0, z1, x0, x1) if ridge == "x" else (x0, x1, z0, z1)
    ac = (a0 + a1) / 2
    ae0, ae1 = a0 - overhang, a1 + overhang
    eave = wall_top - thick // 2
    bs0, bs1 = b0 - overhang + 1, b1 + overhang - 1
    rise = (ridge_y - eave) / (ac - ae0)
    under0 = eave + (a0 - ae0) * rise
    # prism polygons are (y, z) for axis 'x' and (x, y) for axis 'z'
    pt = (lambda a, y: (y, a)) if ridge == "x" else (lambda a, y: (a, y))
    g.prism(ridge, [pt(a0, wall_top), pt(a1, wall_top), pt(a1, under0), pt(ac, ridge_y), pt(a0, under0)], b0, b1, C(gable, 5))
    attic = _last(g)
    P.mottle(g, attic, gable, 5)
    g.prism(ridge, [pt(ae0, eave), pt(ae0, eave + thick), pt(ac, ridge_y + thick), pt(ac, ridge_y)], bs0, bs1, C(ramp, base))
    front = _last(g)
    g.prism(ridge, [pt(ae1, eave), pt(ac, ridge_y), pt(ac, ridge_y + thick), pt(ae1, eave + thick)], bs0, bs1, C(ramp, base))
    back = _last(g)
    slabs = front | back
    ridge_vec = (1, 0, 0) if ridge == "x" else (0, 0, 1)
    for m, a_end in ((front, ae0), (back, ae1)):
        down = (0.0, eave - ridge_y, a_end - ac) if ridge == "x" else (a_end - ac, eave - ridge_y, 0.0)
        P.tiles(g, m, ramp, base, row=4, width=5, frame=(ridge_vec, down), seed=seed)
    X, Y, Z = np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    B = X if ridge == "x" else Z
    P.flat(g, slabs & ((B < bs0 + 2) | (B >= bs1 - 2)), trim, trim_shade)
    if ridge == "x":
        rm = box(g, bs0 - 1, ridge_y + thick - 1, ac - 2, bs1 + 1, ridge_y + thick + 2, ac + 2, trim, trim_shade)
    else:
        rm = box(g, ac - 2, ridge_y + thick - 1, bs0 - 1, ac + 2, ridge_y + thick + 2, bs1 + 1, trim, trim_shade)
    P.planks(g, rm, trim, trim_shade, width=3, across="x" if ridge == "z" else "z", seed=seed + 1)
    return {"slabs": slabs, "attic": attic, "ridge": rm}


def awning(g: Grid, face: str, plane, u0, u1, v_top, depth: int = 8, drop: int = 5, ramps=("red", "bone"), stripe: int = 3) -> np.ndarray:
    """A striped cloth awning sloping out from a wall (a true slope)."""
    if face == "top":
        raise ValueError("an awning hangs on a wall face, not on 'top'")
    axis = "x" if face[1] == "z" else "z"  # the prism runs along the wall
    s = -1 if face[0] == "-" else 1
    d0, d1 = plane, plane + s * depth
    # polygon in the plane across the wall: (y, z) for axis 'x', (x, y) for axis 'z'
    pts = [(d0, v_top), (d0, v_top + 2), (d1, v_top + 2 - drop), (d1, v_top - drop)]
    poly = [(v, d) for d, v in pts] if axis == "x" else pts
    g.prism(axis, poly, u0, u1, C(ramps[0], 4))
    m = _last(g)
    X, Y, Z = np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    U = X if axis == "x" else Z
    P.flat(g, m & ((U - u0) // stripe % 2 == 1), ramps[1], 6)
    return m


def shutters(g: Grid, face: str, plane, u0, u1, v0, v1, ramp: str = "blue", base: int = 4) -> np.ndarray:
    """A pair of planked shutters beside a window."""
    m = box(g, *on_face(face, plane, u0 - 5, u0 - 1, v0, v1, 0, 1), ramp, base) | box(g, *on_face(face, plane, u1 + 1, u1 + 5, v0, v1, 0, 1), ramp, base)
    P.planks(g, m, ramp, base, width=2, across="x" if _axis(face) == "z" else "z", length=(40, 41), nails=False, frame=_face_frame(face))
    P.outline(g, m, ramp, base - 2, normal=_axis(face))
    return m


def posts(g: Grid, x0, x1, z0, z1, y0, y1, size: int = 3, out: int = 1, ramp: str = "darkwood", base: int = 3, seed: int = 0) -> np.ndarray:
    """Thick corner posts standing `out` voxels proud of the walls (rule F3)."""
    mask = np.zeros(g.shape, dtype=bool)
    for cx, cz in ((x0 - out, z0 - out), (x1 + out - size, z0 - out), (x0 - out, z1 + out - size), (x1 + out - size, z1 + out - size)):
        mask |= box(g, cx, y0, cz, cx + size, y1, cz + size, ramp, base)
    P.planks(g, mask, ramp, base, width=size, across="x", nails=False, seed=seed)
    return mask


def beam(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str = "darkwood", base: int = 3, seed: int = 0) -> np.ndarray:
    mask = box(g, x0, y0, z0, x1, y1, z1, ramp, base)
    P.planks(g, mask, ramp, base, width=max(2, int(y1 - y0)), across="y", nails=True, seed=seed)
    return mask


def window(g: Grid, face: str, plane, u0, u1, v0, v1, frame: str = "darkwood", glass: str = "gold", glow: int = 6, cross: bool = True, sill: str | None = "darkwood") -> np.ndarray:
    """A framed window standing 1 voxel proud of the face: dark 1-voxel
    frame, glowing panes, a cross mullion, and a sill under it (on 'top':
    a skylight with a lip on its -z side)."""
    m = box(g, *on_face(face, plane, u0, u1, v0, v1, 0, 1), glass, glow)
    P.outline(g, m, frame, 2, normal=_axis(face))
    if cross:
        um, vm = (u0 + u1) // 2, (v0 + v1) // 2
        P.flat(g, m & P.region(g, *on_face(face, plane, um, um + 1, v0, v1, 0, 1)), frame, 2)
        P.flat(g, m & P.region(g, *on_face(face, plane, u0, u1, vm, vm + 1, 0, 1)), frame, 2)
    if sill:
        s = box(g, *on_face(face, plane, u0 - 1, u1 + 1, v0 - 2, v0, 0, 2), sill, 3)
        P.planks(g, s, sill, 3, width=2, across="y", nails=False, frame=_face_frame(face))
    return m


def door(g: Grid, face: str, plane, u0, u1, v0, v1, leaf: str = "wood", frame: str = "darkwood", base: int = 3, arch: bool = True, seed: int = 0) -> np.ndarray:
    """A wide, short door (rule F4) with an arched top: a dark frame 2 voxels
    proud of the face and a planked leaf 2 voxels proud (on 'top': a
    trapdoor whose arch points to +z)."""
    width = u1 - u0
    rise = width // 3 if arch else 0
    fm = box(g, *on_face(face, plane, u0 - 2, u1 + 2, v0, v1 - rise + 2, 0, 2), frame, 2)
    P.planks(g, fm, frame, 2, width=2, across="y", nails=False, frame=_face_frame(face), seed=seed)
    cu = (u0 + u1) / 2
    top = v1 - rise
    pts = [(u0, v0), (u1, v0), (u1, top)]
    if arch:
        for k in range(1, 6):
            a = math.pi * k / 6
            pts.append((cu + (width / 2) * math.cos(a), top + rise * math.sin(a)))
    pts.append((u0, top))
    lm = face_prism(g, face, plane, pts, 0, 2, C(leaf, base))
    frame_uv = _face_frame(face)
    P.planks(g, lm, leaf, base, width=4, across="x" if _axis(face) == "z" else "z", length=(40, 41), frame=frame_uv, seed=seed + 1)
    return lm


def _face_frame(face: str):
    """The paint.uv frame of a face: None (the default) on walls, 'top' on tops."""
    return "top" if face == "top" else None


def barrel(g: Grid, cx, cz, y0, h, r, ramp: str = "wood", hoop: str = "iron", base: int = 4) -> np.ndarray:
    """Octagonal barrel (true facets), vertical staves, two dark hoops, a darker lid rim."""
    g.prism("y", ngon(cx, cz, r, 8), y0, y0 + h, C(ramp, base))
    m = _last(g)
    X, Y, Z = np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    stave = (np.floor((np.arctan2(Z + 0.5 - cz, X + 0.5 - cx) + math.pi) / (2 * math.pi) * 16)).astype(int)
    shade = base + np.array([-1, 0, 0, 1])[stave % 4]
    P._paint(g, m, ramp, shade)
    for hy in (y0 + max(2, h // 5), y0 + h - max(3, h // 5)):
        P.flat(g, m & (Y >= hy) & (Y < hy + 2), hoop, 3)
    P.flat(g, m & (Y == y0 + h - 1) & ((X + 0.5 - cx) ** 2 + (Z + 0.5 - cz) ** 2 > (r - 2) ** 2), ramp, base - 2)
    return m


def crate(g: Grid, x0, y0, z0, s, ramp: str = "wood", frame: str = "darkwood", base: int = 4, seed: int = 0) -> np.ndarray:
    """Crate: planked sides with a dark frame on every edge."""
    m = box(g, x0, y0, z0, x0 + s, y0 + s, z0 + s, ramp, base)
    P.planks(g, m, ramp, base, width=max(3, s // 4), across="y", nails=True, seed=seed)
    P.flat(g, edges(m), frame, 2)
    return m


def pennant(g: Grid, x, y, z, pole: int, length: int, ramp: str = "red", base: int = 4) -> np.ndarray:
    """A pole with a triangular pennant flying toward +z (a true slope)."""
    box(g, x, y, z, x + 2, y + pole, z + 2, "darkwood", 2)
    top = y + pole - 1
    g.prism("x", [(top - 8, z + 2), (top, z + 2), (top - 3, z + 2 + length)], x, x + 2, C(ramp, base))
    m = _last(g)
    P.flat(g, m & P.region(g, 0, top - 8, 0, 999, top - 6, 999), ramp, base - 1)
    return m


def _face_coords(g: Grid, face: str) -> tuple[np.ndarray, np.ndarray]:
    """Integer (u, v) voxel coordinates of a face (see on_face)."""
    X, Y, Z = np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    axis = _axis(face)
    return {"z": (X, Y), "x": (Z, Y), "y": (X, Z)}[axis]


def lancet(g: Grid, face: str, plane, u0, u1, v0, v1, glass: str = "purple", shade: int = 2, frame: str = "gray", fshade: int = 6, mullion: bool = True, sill: bool = True, seed: int = 0) -> np.ndarray:
    """Pointed gothic window (PN haunted): a pane 1 voxel proud, inside a
    stone frame 2 voxels proud (jambs, a sill and a pointed hood with true
    slopes). The mullion and the transom are painted. Returns the pane mask."""
    w = u1 - u0
    cu = (u0 + u1) / 2
    rise = w * 0.75
    top = v1 - rise
    pane = face_prism(g, face, plane, [(u0, v0), (u1, v0), (u1, top), (cu, v1), (u0, top)], 0, 1, C(glass, shade))
    P.mottle(g, pane, glass, shade, cell=2, seed=seed)
    U, V = _face_coords(g, face)
    fr = _face_frame(face)
    if mullion:
        P.flat(g, pane & (np.abs(U + 0.5 - cu) < 0.6), frame, fshade - 2)
        P.flat(g, pane & (V == int((v0 + top) / 2)), frame, fshade - 2)
    fm = box(g, *on_face(face, plane, u0 - 2, u0, v0, top, 0, 2), frame, fshade) | box(g, *on_face(face, plane, u1, u1 + 2, v0, top, 0, 2), frame, fshade)
    t = 2.2
    fm |= face_prism(g, face, plane, [(u0 - 2, top), (u0, top), (cu, v1), (u1, top), (u1 + 2, top), (cu, v1 + t * 1.25)], 0, 2, C(frame, fshade))
    if sill:
        fm |= box(g, *on_face(face, plane, u0 - 3, u1 + 3, v0 - 2, v0, 0, 3), frame, fshade)
    P.stone(g, fm, frame, fshade, block=(5, 3), frame=fr, seed=seed + 1)
    return pane


def rose(g: Grid, face: str, plane, cu, cv, r: float, glass: str = "magenta", shade: int = 5, frame: str = "gray", fshade: int = 6, spokes: int = 8) -> np.ndarray:
    """Round rose window: an octagonal glowing pane 1 voxel proud, inside
    an octagonal stone ring 2 voxels proud, with painted spokes, a hub and
    an inner ring. (cu, cv) is the centre on the face. Returns the pane mask."""
    pane = face_prism(g, face, plane, ngon(cu, cv, r, 8), 0, 1, C(glass, shade))
    outer = ngon(cu, cv, r + 3, 8)
    inner = ngon(cu, cv, r, 8)
    fr = _face_frame(face)
    # the ring as two C-shaped halves (each a simple polygon)
    for half in (range(0, 5), range(4, 9)):
        ks = [k % 8 for k in half]
        pts = [outer[k] for k in ks] + [inner[k] for k in reversed(ks)]
        m = face_prism(g, face, plane, pts, 0, 2, C(frame, fshade))
        P.stone(g, m, frame, fshade, block=(4, 3), frame=fr, seed=3)
    U, V = _face_coords(g, face)
    U = U + 0.5 - cu
    V = V + 0.5 - cv
    ang = np.arctan2(V, U)
    rad = np.hypot(U, V)
    spoke = np.abs(((ang / (2 * math.pi) * spokes + 0.5) % 1) - 0.5) * 2 * math.pi * rad / spokes < 0.7
    P.flat(g, pane & (spoke | (rad < 2.2) | (np.abs(rad - r * 0.62) < 0.6)), frame, fshade - 2)
    P.flat(g, pane & (rad >= 2.2) & (rad < r * 0.62 - 0.6) & ~spoke, glass, min(7, shade + 2))
    return pane
