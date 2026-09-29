"""Painted-atlas mesher for world assets (the Pirate Nation way).

Geometry comes from the grid SHAPE only: coplanar faces merge into big
rectangles whatever their colours, and prisms (Grid.prism) become exact
geometry with diagonal faces. Colour detail becomes texture: every face gets
a canvas at 1 texel per voxel, filled from the voxels just behind the face,
and all canvases of an asset pack into one atlas. So planks, grain and stone
courses painted on voxels cost no triangles.

Coordinates are glTF axes, in voxels. Pure numpy; no Blender import.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from voxgrid import PRISM_PLANE, Grid, _AXIS_INDEX

_PLANE_AXES = {0: (1, 2), 1: (0, 2), 2: (0, 1)}
PAD = 1  # replicated border around each canvas, so nearest sampling never bleeds
MAX_ATLAS = 2048


@dataclass
class Face:
    """A planar polygon (outward CCW) with its canvas frame: texel (p, q)
    covers origin + [p, p+1]·u + [q, q+1]·v."""

    verts: np.ndarray  # (n, 3)
    normal: np.ndarray  # (3,)
    origin: np.ndarray
    u: np.ndarray
    v: np.ndarray
    size: tuple[int, int]  # (w, h) texels
    canvas: np.ndarray | None = None  # (h, w) palette indices
    uv: np.ndarray | None = None  # (n, 2) canvas coordinates of the verts
    atlas_xy: tuple[int, int] = (0, 0)
    solid: int = -1  # index of the prism a face belongs to; it paints only from that prism's voxels


@dataclass
class PartMesh:
    faces: list[Face] = field(default_factory=list)


def _greedy_bool(mask: np.ndarray):
    """Rectangles (i, j, w, h) covering the true cells of a 2D bool mask."""
    nu, nv = mask.shape
    done = np.zeros(mask.shape, dtype=bool)
    todo = mask.copy()
    for i, j in zip(*np.nonzero(mask)):
        if done[i, j]:
            continue
        h = 1
        while j + h < nv and todo[i, j + h] and not done[i, j + h]:
            h += 1
        w = 1
        while i + w < nu and todo[i + w, j : j + h].all() and not done[i + w, j : j + h].any():
            w += 1
        done[i : i + w, j : j + h] = True
        yield int(i), int(j), int(w), int(h)


def _orient(verts: np.ndarray, normal: np.ndarray) -> np.ndarray:
    """Return verts ordered counter-clockwise when seen along -normal."""
    n = np.zeros(3)
    for k in range(len(verts)):
        a, b = verts[k], verts[(k + 1) % len(verts)]
        n += np.cross(a, b)
    return verts if float(n @ normal) >= 0 else verts[::-1].copy()


def _unit(axis: int) -> np.ndarray:
    e = np.zeros(3)
    e[axis] = 1.0
    return e


def box_faces(grid: Grid, owned: np.ndarray) -> list[Face]:
    """Faces of non-prism voxels that touch empty space, merged by shape."""
    occ = grid.a > 0
    box = occ & ~owned
    faces: list[Face] = []
    for d in range(3):
        ua, va = _PLANE_AXES[d]
        B = np.transpose(box, (d, ua, va))
        O = np.transpose(occ, (d, ua, va))
        n = B.shape[0]
        Bp = np.zeros((n + 2,) + B.shape[1:], dtype=bool)
        Op = np.zeros_like(Bp)
        Bp[1:-1], Op[1:-1] = B, O
        pos = Bp[0 : n + 1] & ~Op[1 : n + 2]  # plane s: cell s-1 filled, cell s empty
        neg = Bp[1 : n + 2] & ~Op[0 : n + 1]  # plane s: cell s filled, cell s-1 empty
        for sign, M in ((1.0, pos), (-1.0, neg)):
            for s in np.nonzero(M.reshape(M.shape[0], -1).any(axis=1))[0].tolist():
                for i, j, w, h in _greedy_bool(M[s]):
                    corners = []
                    for cu, cv in ((i, j), (i + w, j), (i + w, j + h), (i, j + h)):
                        p = np.zeros(3)
                        p[d], p[ua], p[va] = s, cu, cv
                        corners.append(p)
                    normal = _unit(d) * sign
                    origin = np.zeros(3)
                    origin[d], origin[ua], origin[va] = s, i, j
                    faces.append(Face(_orient(np.array(corners), normal), normal, origin, _unit(ua), _unit(va), (w, h)))
    return faces


def _in_prisms(pts: np.ndarray, grid: Grid) -> np.ndarray:
    """Points inside any prism's exact geometry."""
    from voxgrid import _inside_polygon

    flat = pts.reshape(-1, 3)
    inside = np.zeros(len(flat), dtype=bool)
    for solid in grid.solids:
        t = _AXIS_INDEX[solid.axis]
        ua, va = PRISM_PLANE[solid.axis]
        along = (flat[:, t] > solid.lo) & (flat[:, t] < solid.hi)
        if solid.top is None:
            inside |= along & _inside_polygon(flat[:, ua], flat[:, va], solid.poly)
            continue
        for tv in np.unique(np.round(flat[along, t], 3)):
            sel = along & (np.abs(flat[:, t] - tv) < 5e-4)
            inside[sel] |= _inside_polygon(flat[sel, ua], flat[sel, va], solid.poly_at(float(tv)))
    return inside.reshape(pts.shape[:-1])


def _covered_by_prisms(face: Face, grid: Grid) -> bool:
    """A box face whose every texel lies just inside a prism is hidden by it."""
    return bool(grid.solids) and bool(_in_prisms(_texel_points(face, 0.01), grid).all())


def _planar_face(verts: list, inside_point: np.ndarray, grid_frame: tuple | None = None) -> "Face | None":
    """A face from a planar polygon: outward normal (away from inside_point),
    CCW order, and a canvas frame. Axis-aligned faces keep grid-aligned
    texels (grid_frame = (u axis, v axis)); sloped faces take u along their
    first edge."""
    pts = np.array(verts, dtype=float)
    n = np.zeros(3)
    for k in range(len(pts)):
        n += np.cross(pts[k], pts[(k + 1) % len(pts)])
    length = float(np.linalg.norm(n))
    if length < 1e-9:
        return None
    n /= length
    if float((pts.mean(axis=0) - inside_point) @ n) < 0:
        n = -n
    if grid_frame is not None:
        u, v = _unit(grid_frame[0]), _unit(grid_frame[1])
        rel = pts @ u, pts @ v
        u0, v0 = math.floor(rel[0].min() + 1e-6), math.floor(rel[1].min() + 1e-6)
        u1, v1 = math.ceil(rel[0].max() - 1e-6), math.ceil(rel[1].max() - 1e-6)
        # the (u0, v0) corner, on the face plane
        origin = u0 * u + v0 * v + (float(pts[0] @ n) - float((u0 * u + v0 * v) @ n)) * n
        size = (max(1, u1 - u0), max(1, v1 - v0))
    else:
        edge = next((pts[(k + 1) % len(pts)] - pts[k] for k in range(len(pts)) if np.linalg.norm(pts[(k + 1) % len(pts)] - pts[k]) > 1e-6), None)
        u = edge / np.linalg.norm(edge)
        v = np.cross(n, u)
        pu, pv = (pts - pts[0]) @ u, (pts - pts[0]) @ v
        origin = pts[0] + pu.min() * u + pv.min() * v
        size = (max(1, math.ceil(pu.max() - pu.min() - 1e-6)), max(1, math.ceil(pv.max() - pv.min() - 1e-6)))
    return Face(_orient(pts, n), n, origin, u, v, size)


def prism_faces(grid: Grid) -> list[Face]:
    """Exact faces of every prism: its caps and its sides (quads, split into
    triangles when a tapered side is not planar). Faces fully against filled
    voxels are dropped."""
    occ = grid.a > 0
    faces: list[Face] = []
    for si, solid in enumerate(grid.solids):
        t = _AXIS_INDEX[solid.axis]
        ua, va = PRISM_PLANE[solid.axis]

        def at(p2, tv):
            p = np.zeros(3)
            p[ua], p[va], p[t] = p2[0], p2[1], tv
            return p

        low = [at(p, solid.lo) for p in solid.poly]
        high = [at(p, solid.hi) for p in solid.upper]
        centre = (np.mean(low, axis=0) + np.mean(high, axis=0)) / 2
        made = []
        for ring in (low, high):
            f = _planar_face(ring, centre, (ua, va))
            if f is not None:
                made.append(f)
        k = len(low)
        for e in range(k):
            b0, b1, t1, t0 = low[e], low[(e + 1) % k], high[(e + 1) % k], high[e]
            quad = [p for i, p in enumerate([b0, b1, t1, t0]) if i == 0 or np.linalg.norm(p - [b0, b1, t1, t0][i - 1]) > 1e-6]
            if len(quad) > 1 and np.linalg.norm(quad[-1] - quad[0]) < 1e-6:
                quad.pop()
            if len(quad) < 3:
                continue
            if len(quad) == 4:
                nrm = np.cross(quad[1] - quad[0], quad[2] - quad[0])
                off = abs(float((quad[3] - quad[0]) @ nrm)) / max(1e-9, float(np.linalg.norm(nrm)))
                if off > 1e-4:  # twisted side: two triangles
                    for tri in ([quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]):
                        f = _planar_face(tri, centre)
                        if f is not None:
                            made.append(f)
                    continue
            f = _planar_face(quad, centre)
            if f is not None:
                made.append(f)
        for f in made:
            f.solid = si
        faces.extend(made)
    # A face is hidden only by OTHER geometry: its own prism's boundary voxels
    # (centres on the face plane) must not bury it.
    kept = []
    own_cache: dict[int, np.ndarray] = {}
    for f in faces:
        if f.solid not in own_cache:
            own_cache[f.solid] = occ & ~grid.solids[f.solid].mask(grid.shape)
        if not _buried(f, own_cache[f.solid]):
            kept.append(f)
    return kept


def _texel_points(face: Face, offset: float) -> np.ndarray:
    w, h = face.size
    p, q = np.meshgrid(np.arange(w) + 0.5, np.arange(h) + 0.5)  # (h, w)
    return face.origin + p[..., None] * face.u + q[..., None] * face.v + offset * face.normal


def _inside_face(face: Face, pts: np.ndarray) -> np.ndarray:
    """Texel centres that lie on the face polygon (caps can be concave)."""
    rel = pts - face.origin
    pu, pv = rel @ face.u, rel @ face.v
    poly = np.stack([(face.verts - face.origin) @ face.u, (face.verts - face.origin) @ face.v], axis=1)
    from voxgrid import _inside_polygon

    return _inside_polygon(pu, pv, [tuple(x) for x in poly])


def _buried(face: Face, occ: np.ndarray) -> bool:
    pts = _texel_points(face, 0.5)
    inside = _inside_face(face, pts)
    if not inside.any():
        return True
    idx = np.floor(pts[inside]).astype(int)
    ok = np.all((idx >= 0) & (idx < np.array(occ.shape)), axis=1)
    if not ok.all():
        return False
    return bool(occ[idx[:, 0], idx[:, 1], idx[:, 2]].all())


_NEIGHBOURS = sorted(
    [(dx, dy, dz) for dx in (-1, 0, 1) for dy in (-1, 0, 1) for dz in (-1, 0, 1)] + [(dx, dy, dz) for dx in (-2, 0, 2) for dy in (-2, 0, 2) for dz in (-2, 0, 2) if (dx, dy, dz) != (0, 0, 0)],
    key=lambda o: (o[0] ** 2 + o[1] ** 2 + o[2] ** 2, o),
)


def sample(a: np.ndarray, pts: np.ndarray, strict: bool = True) -> np.ndarray:
    """Palette index of the filled voxel at (or nearest to) each point. With
    strict=False, points with no voxel within 2 cells get 0."""
    flat = pts.reshape(-1, 3)
    base = np.floor(flat).astype(int)
    out = np.zeros(len(flat), dtype=np.uint8)
    todo = np.ones(len(flat), dtype=bool)
    shape = np.array(a.shape)
    for off in _NEIGHBOURS:
        if not todo.any():
            break
        idx = base[todo] + np.array(off)
        ok = np.all((idx >= 0) & (idx < shape), axis=1)
        vals = np.zeros(len(idx), dtype=np.uint8)
        vals[ok] = a[idx[ok, 0], idx[ok, 1], idx[ok, 2]]
        hit = vals > 0
        where = np.nonzero(todo)[0][hit]
        out[where] = vals[hit]
        todo[where] = False
    if todo.any() and strict:
        raise ValueError(f"{int(todo.sum())} texel(s) have no voxel within 2 cells; is a prism empty?")
    return out.reshape(pts.shape[:-1])


def paint(face: Face, a: np.ndarray) -> None:
    """Fill the face canvas from the voxels half a voxel behind it, and set
    the canvas coordinates of its verts."""
    canvas = sample(a, _texel_points(face, -0.5), strict=False)
    # Texels far outside a diagonal edge find no voxel: give them the nearest
    # painted texel, so partly covered edge texels never show black.
    while (canvas == 0).any():
        if not canvas.any():
            raise ValueError("a face has no voxel behind it; is a prism empty?")
        grown = canvas.copy()
        for axis in (0, 1):
            for step in (1, -1):
                shifted = np.roll(canvas, step, axis=axis)
                edge = [slice(None)] * 2
                edge[axis] = 0 if step == 1 else -1
                shifted[tuple(edge)] = 0
                grown = np.where((grown == 0) & (shifted > 0), shifted, grown)
        canvas = grown
    face.canvas = canvas
    rel = face.verts - face.origin
    face.uv = np.stack([rel @ face.u, rel @ face.v], axis=1)


PRISM_STEP = 1 / 32  # voxels a prism grows per rank to leave a coplanar neighbour's plane
GRID_STEP = 1 / 64  # grown vertices snap to this grid, so finalize can still quantize them


def _sub_points(face: Face, k: int = 4) -> np.ndarray:
    """k×k sample points per texel, so slivers thinner than a texel are seen."""
    w, h = face.size
    p, q = np.meshgrid((np.arange(w * k) + 0.5) / k, (np.arange(h * k) + 0.5) / k)
    return face.origin + p[..., None] * face.u + q[..., None] * face.v


def _plane_box(face: Face) -> tuple[float, float, float, float]:
    rel = face.verts - face.origin
    pu, pv = rel @ face.u, rel @ face.v
    return float(pu.min()), float(pv.min()), float(pu.max()), float(pv.max())


PLANE_TOLERANCE = 0.02  # voxels: faces closer than this count as one plane (src/validate/zfight.ts)


def _coplanar_overlap(a: Face, b: Face) -> bool:
    """Same facing, planes within PLANE_TOLERANCE, and the faces overlap (sampled at 1/4 texel)."""
    if float(a.normal @ b.normal) < 0.999 or abs(float(a.normal @ (a.verts[0] - b.verts[0]))) > PLANE_TOLERANCE:
        return False
    # Both faces in a's canvas frame: skip pairs whose bounds do not meet.
    ra = _plane_box(a)
    rel = b.verts - a.origin
    bu, bv = rel @ a.u, rel @ a.v
    if bu.max() <= ra[0] or bu.min() >= ra[2] or bv.max() <= ra[1] or bv.min() >= ra[3]:
        return False
    for f, g in ((a, b), (b, a)):
        pts = _sub_points(f)
        # Project onto g's plane before the inside test, so a near-coplanar g still counts.
        on_g = pts - ((pts - g.verts[0]) @ g.normal)[..., None] * g.normal
        if (_inside_face(f, pts) & _inside_face(g, on_g)).any():
            return True
    return False


def _conflicts(prism: list[Face], box: list[Face]) -> tuple[dict[int, set[int]], set[int]]:
    """Prism pairs that share a plane, and prisms that share one with a box face."""
    pairs: dict[int, set[int]] = {}
    floor: set[int] = set()
    for i, a in enumerate(prism):
        for b in prism[i + 1 :]:
            if a.solid != b.solid and _coplanar_overlap(a, b):
                pairs.setdefault(a.solid, set()).add(b.solid)
                pairs.setdefault(b.solid, set()).add(a.solid)
        if a.solid not in floor and any(_coplanar_overlap(a, b) for b in box):
            floor.add(a.solid)
    return pairs, floor


def _grow(own: list[Face], amount: float) -> None:
    """Moves every face of one prism `amount` along its normal, keeping the prism closed."""
    normals: dict[tuple, list[np.ndarray]] = {}
    for f in own:
        for v in f.verts:
            normals.setdefault(tuple(np.round(v, 4)), []).append(f.normal)
    shift = {}
    for key, ns in normals.items():
        n = np.array(ns)
        d, *_ = np.linalg.lstsq(n, np.full(len(n), amount), rcond=None)
        shift[key] = d
    for f in own:
        moved = np.array([v + shift[tuple(np.round(v, 4))] for v in f.verts])
        f.verts = np.round(moved / GRID_STEP) * GRID_STEP
        rel = f.verts - f.origin
        f.uv = np.stack([rel @ f.u, rel @ f.v], axis=1)


def separate_prisms(faces: list[Face]) -> None:
    """Prisms can share a face plane with another prism (two roof slabs, two
    arch stones, the segments of a ring) or with a box face (a brace cap flush
    with a wall): those faces z-fight. Each round colours the prisms that fight
    so that no two fighting prisms get the same colour and none that meets a
    box face gets colour 0, then grows each prism by colour × PRISM_STEP along
    its face normals (which keeps it closed). Growing can make neighbours meet
    in a new plane, so repeat until nothing fights. Box faces and colour-0
    prisms do not move."""
    prism = [f for f in faces if f.solid >= 0]
    box = [f for f in faces if f.solid < 0]
    by_solid: dict[int, list[Face]] = {}
    for f in prism:
        by_solid.setdefault(f.solid, []).append(f)
    for _ in range(6):
        pairs, floor = _conflicts(prism, box)
        if not pairs and not floor:
            return
        colour: dict[int, int] = {}
        for solid in sorted(set(pairs) | floor):
            used = {colour[o] for o in pairs.get(solid, ()) if o in colour}
            start = 1 if solid in floor else 0
            colour[solid] = next(c for c in range(start, start + len(used) + 1) if c not in used)
        for solid, c in colour.items():
            if c:
                _grow(by_solid[solid], c * PRISM_STEP)
    pairs, floor = _conflicts(prism, box)
    if pairs or floor:
        raise ValueError(f"prisms {sorted(set(pairs) | floor)} still share a face plane after growing; move them apart in the source")


def mesh_part(grid: Grid) -> PartMesh:
    owned = grid.solid_mask() if grid.solids else np.zeros(grid.shape, dtype=bool)
    faces = [f for f in box_faces(grid, owned) if not _covered_by_prisms(f, grid)] + prism_faces(grid)
    sources = {}
    for face in faces:
        if face.solid >= 0 and face.solid not in sources:
            sources[face.solid] = np.where(grid.solids[face.solid].mask(grid.shape), grid.a, 0)
        paint(face, sources.get(face.solid, grid.a))
    separate_prisms(faces)
    return PartMesh(faces)


def pack(faces: list[Face]) -> tuple[int, int]:
    """Shelf-pack every canvas (with PAD) into one atlas; sets face.atlas_xy
    (the canvas top-left inside the atlas). Returns (width, height)."""
    if not faces:
        return (1, 1)
    order = sorted(range(len(faces)), key=lambda k: (-faces[k].size[1], -faces[k].size[0], k))
    total = sum((f.size[0] + 2 * PAD) * (f.size[1] + 2 * PAD) for f in faces)
    widest = max(f.size[0] for f in faces) + 2 * PAD
    width = max(widest, int(math.ceil(math.sqrt(total * 1.15))))
    width = (width + 3) // 4 * 4
    x = y = shelf = 0
    for k in order:
        w, h = faces[k].size[0] + 2 * PAD, faces[k].size[1] + 2 * PAD
        if x + w > width:
            x, y, shelf = 0, y + shelf, 0
        faces[k].atlas_xy = (x + PAD, y + PAD)
        x += w
        shelf = max(shelf, h)
    height = y + shelf
    if width > MAX_ATLAS or height > MAX_ATLAS:
        raise ValueError(f"atlas {width}×{height} is over {MAX_ATLAS}; simplify the asset")
    return width, height


def atlas_image(faces: list[Face], width: int, height: int) -> np.ndarray:
    """(height, width) palette-index image, row 0 at the top."""
    img = np.zeros((height, width), dtype=np.uint8)
    for f in faces:
        x, y = f.atlas_xy
        padded = np.pad(f.canvas, PAD, mode="edge")
        img[y - PAD : y - PAD + padded.shape[0], x - PAD : x - PAD + padded.shape[1]] = padded
    return img


def face_uvs(face: Face, width: int, height: int) -> np.ndarray:
    """Per-vertex UVs with the image origin at the top left (glTF convention)."""
    x, y = face.atlas_xy
    return np.stack([(x + face.uv[:, 0]) / width, (y + face.uv[:, 1]) / height], axis=1)
