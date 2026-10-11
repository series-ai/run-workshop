"""Low-level painters for the fantasy cyclops, minotaur and harpy.

Only paint lives here. Each creature builds its own body, legs, head and
weapon in its own source file. Patterns follow rule S2 and S3: a flat
base, soft cells one shade off, contrast on seams and edges, no per-voxel
speckle.

    patches      skin or hide: big soft cells, a darker lower edge
    fur_strokes  short vertical fur strokes on a flat base
    wool         sheepskin curls: small rings with a lit centre
    feathers     offset rows of round-tipped feathers
    scales       rings of leg scales with a dark line under each
    seam_frame   a darker frame on the arrises of prisms (S4), along true slopes
    frame_edges  a darker 1-voxel frame on the edges of a box (S4)
    on_facets    run a painter on every face of the prisms added since `start`
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnshapes as S
from _life import facet_paint
from pnkit import edges


def patches(g, m, ramp: str, base: int, frame=None, seed: int = 0, cell=(6, 5), edge: bool = False) -> None:
    """Skin or hide: cells of `cell` voxels, one in five a shade darker, one
    in five a shade lighter, a few small dark marks. `edge` also darkens the
    lower edge of some cells (a scaly hide)."""
    U, V = P.uv(g, frame)
    h = P._hash(U // cell[0], V // cell[1], seed=seed) % np.uint64(5)
    shade = np.where(h == 0, base - 1, base)
    if edge:
        shade = np.where((h < np.uint64(2)) & ((V % cell[1]) == 0), base - 1, shade)
    shade = np.where(h == np.uint64(4), base + 1, shade)
    mark = (P._hash(U // 3, V // 3, seed=seed + 40) % np.uint64(43)) == 0
    shade = np.where(mark & ((U % 3) == 1) & ((V % 3) == 1), base - 2, shade)
    P._paint(g, m, ramp, np.clip(shade, 1, 7))


def fur_strokes(g, m, ramp: str, base: int, frame=None, seed: int = 0, stroke: int = 3, dark: int = 3, light: int = 1) -> None:
    """Fur: strokes 1 wide and `stroke` long along V, most on the base,
    `dark` in ten a shade darker and `light` in ten a shade lighter."""
    U, V = P.uv(g, frame)
    h = P._hash(U, (V + U % stroke) // stroke, seed=seed) % np.uint64(10)
    shade = base + np.where(h < np.uint64(dark), -1, np.where(h >= np.uint64(10 - light), 1, 0))
    P._paint(g, m, ramp, np.clip(shade, 1, 7))


def wool(g, m, ramp: str, base: int, frame=None, seed: int = 0) -> None:
    """Sheepskin: offset rows of 3x3 curls, a lit centre and a dark ring
    gap at the lower right of each curl."""
    U, V = P.uv(g, frame)
    r = V // 3
    u = U + (r % 2) * 2
    pu, pv = u % 4, V % 3
    shade = np.full(U.shape, base, dtype=np.int64)
    shade = np.where((pu == 1) & (pv == 1), base + 1, shade)
    shade = np.where((pu == 3) | (pv == 0), base - 1, shade)
    odd = (P._hash(r, u // 4, seed=seed) % np.uint64(6)) == 0
    shade = np.where(odd & (pu < 3) & (pv > 0), base - 1, shade)
    P._paint(g, m, ramp, np.clip(shade, 1, 7))


def feathers(g, m, ramp: str, base: int, frame=None, seed: int = 0, width: int = 5, row: int = 4) -> None:
    """Offset rows of round-tipped feathers: a darker U tip line, a lit
    quill in the middle, one feather in five a shade lighter."""
    U, V = P.uv(g, frame)
    r = V // row
    u = U + (r % 2) * (width // 2)
    pu, pv = u % width, V % row
    cell = P._hash(r, u // width, seed=seed)
    shade = base + ((cell % np.uint64(5)) == 0).astype(np.int64)
    shade = np.where((pu == width // 2) & (pv > 0), base + 1, shade)
    tip = ((pv == 0) & (pu >= 1) & (pu <= width - 2)) | ((pv == 1) & ((pu == 0) | (pu == width - 1)))
    shade = np.where(tip, base - 1, shade)
    P._paint(g, m, ramp, np.clip(shade, 1, 7))


def scales(g, m, ramp: str, base: int, frame=None, seed: int = 0) -> None:
    """Bird-leg scales: rings 3 tall with a dark line under each and a
    half-plate offset every other ring."""
    U, V = P.uv(g, frame)
    ring = V // 3
    shade = np.where(V % 3 == 0, base - 2, base)
    shade = np.where((V % 3 == 2) & (((U + ring * 2) % 4) == 0), base - 1, shade)
    P._paint(g, m, ramp, np.clip(shade, 1, 7))


def seams(g, solids, width: float = 0.8, min_angle: float = 30.0) -> np.ndarray:
    """Voxels within `width` of two faces of the prisms whose normals turn
    by `min_angle` degrees or more: the true arrises. Shallow creases
    (two faces almost in one plane) are left out, so a gently curved
    body gets no stripes. Faces as in pnshapes.facets."""
    masks = [sd.mask(g.shape) for sd in solids]
    union = np.logical_or.reduce(masks)
    idx = np.nonzero(union)
    pts = np.stack(idx, axis=1) + 0.5
    occ = g.a > 0
    best = np.full(len(pts), -np.inf)
    second = np.full(len(pts), -np.inf)
    n_best = np.zeros((len(pts), 3))
    n_second = np.zeros((len(pts), 3))
    for sd, m in zip(solids, masks):
        inside = m[idx]
        for n, p0, cap in S._faces_of(sd):
            if cap:  # a cap against other voxels is inside the model
                probe = np.floor(p0 + 0.5 * n).astype(int)
                if np.all((probe >= 0) & (probe < np.array(g.shape))) and occ[tuple(probe)]:
                    continue
            d = np.where(inside, (pts - p0) @ n - (0.5 if cap else 0.0), -np.inf)
            better = d > best
            demote = better[:, None]
            n_second = np.where(demote, n_best, np.where((d > second)[:, None], n, n_second))
            second = np.where(better, best, np.maximum(second, d))
            n_best = np.where(demote, n, n_best)
            best = np.where(better, d, best)
    turn = np.degrees(np.arccos(np.clip(np.sum(n_best * n_second, axis=1), -1.0, 1.0)))
    sel = (second > -width) & (turn >= min_angle)
    out = np.zeros(g.shape, dtype=bool)
    out[tuple(i[sel] for i in idx)] = True
    return out


def seam_frame(g, start: int, ramp: str, shade: int, width: float = 0.8, min_angle: float = 30.0) -> None:
    """Paint the arrises of the prisms added since `start` one tone (rule
    S4). The seams follow the true slopes, so they draw no voxel stairs."""
    if start >= len(g.solids):
        raise ValueError("seam_frame: no prisms were added after `start`")
    P.flat(g, seams(g, g.solids[start:], width, min_angle) & (g.a > 0), ramp, max(1, shade))


def frame_edges(g, m, ramp: str, shade: int) -> None:
    """Paint the edges of a box-like mask `m` one tone (rule S4)."""
    P.flat(g, edges(m), ramp, max(1, shade))


def on_facets(g, start: int, painter) -> None:
    """painter(g, mask, frame) on every face of the prisms added since `start`."""
    if start >= len(g.solids):
        raise ValueError("on_facets: no prisms were added after `start`")
    facet_paint(g, g.solids[start:], painter)
