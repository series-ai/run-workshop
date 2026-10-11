"""Art-director repair models (group: buildings).

Each model here has its own massing and silhouette (review findings B1-B5).
The look follows the original monster buildings: grey stone blocks, plank
walls, purple slate roofs, light stone frames, glowing windows on every
face, and 2-5 small props round the base (rule K1). Every door opening is
18 voxels wide and 30 voxels high or more (scale.json grammar), so the
36-voxel person can pass through.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import bat, coffin, course, crow, last, opening, piers, plinth, pointed, rock, slate, solids_since, steps, stone
from _kit import single
from _pn import blotch, lancet, pumpkin, rose, tombstone
from pnkit import barrel, box, crate, face_prism, gable_roof, on_face, shutters, window
from voxgrid import C, Grid

DOOR_W, DOOR_H = 18, 30  # door opening: width and height (with the arch)


# ---------------------------------------------------------------- shared helpers


def _uv(g: Grid, face: str):
    """(U, V) voxel-centre coordinates along a wall face."""
    X, Y, Z = S.coords(g)
    return (X if face[1] == "z" else Z), Y


def arch_door(g: Grid, face: str, plane, cu, v0, w=DOOR_W, h=DOOR_H, leaf=("purple", 3), frame=("gray", 6), glow=("magenta", 6), seed=0) -> np.ndarray:
    """A pointed door on a wall face. The opening is w wide and h high
    from v0 to the point. Light stone jambs and a pointed hood stand 3
    voxels proud. The planked leaf is 1 voxel proud. A lit transom glows
    in the point. Returns the leaf mask."""
    u0, u1 = cu - w / 2, cu + w / 2
    rise = w * 0.5
    spring = v0 + h - rise
    fr = box(g, *on_face(face, plane, u0 - 3, u0, v0, spring + 1, 0, 3), *frame)
    fr |= box(g, *on_face(face, plane, u1, u1 + 3, v0, spring + 1, 0, 3), *frame)
    fr |= face_prism(g, face, plane, S.quad((u0 - 1.5, spring), (cu, v0 + h + 1.5), 1.6), 0, 3, C(*frame))
    fr |= face_prism(g, face, plane, S.quad((u1 + 1.5, spring), (cu, v0 + h + 1.5), 1.6), 0, 3, C(*frame))
    P.stone(g, fr, frame[0], frame[1], block=(5, 3), seed=seed)
    lm = face_prism(g, face, plane, pointed(u0, u1, v0, v0 + h, rise), 0, 1, C(*leaf))
    P.planks(g, lm, leaf[0], leaf[1], width=3, across="x" if face[1] == "z" else "z", length=(40, 41), nails=True, seed=seed + 1)
    U, V = _uv(g, face)
    P.flat(g, lm & (V > spring - 1), *glow)
    P.flat(g, lm & (V > spring - 1) & (np.abs(U - (u0 + u1) / 2) < 0.6), glow[0], max(1, glow[1] - 3))
    P.flat(g, lm & (np.abs(V - spring + 1.5) < 0.8), frame[0], 3)
    for vv in (v0 + 5, v0 + (spring - v0) * 0.6):
        P.flat(g, lm & (np.abs(V - vv) < 1.0), "gray", 3)  # iron straps
    P.flat(g, lm & (np.abs(U - (u0 + u1) / 2) < 0.6) & (V < spring - 1), leaf[0], max(1, leaf[1] - 2))
    box(g, *on_face(face, plane, cu + 2, cu + 4, v0 + 13, v0 + 15, 1, 2), "gold", 5)  # the ring handle
    return lm


def slab_roof(g: Grid, axis: str, p0, p1, thick, lo, hi, ramp="purple", base=4, seed=0) -> np.ndarray:
    """One roof slab (a true slope) from p0 (eave) to p1 (ridge) in the
    plane across `axis`, with tile rows that follow the slope and a dark
    eave lip."""
    start = len(g.solids)
    S.bar(g, axis, p0, p1, thick, lo, hi, ramp, base)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.tiles(gg, mm, ramp, base, row=4, width=5, frame=fr, seed=seed))
    m = last(g)
    blotch(g, m, ramp, max(1, base - 2), cell=3, chance=0.05, seed=seed + 1)
    return m


def logs(g: Grid, mask: np.ndarray, y0, ramp="wood", base=5, rows=5, seed=0) -> None:
    """Horizontal logs painted on a wall: a light top edge, a dark lower
    edge and a pale chinking line between the logs (rules S1, S2)."""
    X, Y, Z = S.coords(g)
    v = np.floor(Y - y0).astype(int)
    p = v % rows
    row = v // rows
    U = np.floor(X + Z).astype(int)
    seg = (U + row * 7) // 11
    h = (seg * 73 + row * 151 + seed * 13) % 5
    shade = base + np.where(h == 0, -1, np.where(h == 4, 1, 0))
    shade = np.where(p == rows - 1, base + 1, shade)
    shade = np.where(p == 1, base - 1, shade)
    shade = np.where(((U + row * 3) % 9 == 0) & (p == 2), base - 2, shade)  # grain checks
    P._paint(g, mask, ramp, np.clip(shade, 0, 7))
    P.flat(g, mask & (p == 0), "bone", 3)


def tile_cone(g: Grid, cx, cz, r, y0, y1, ramp="purple", base=4, n=8, r_top=0.0, seed=0) -> np.ndarray:
    """A faceted roof cone with tile rows down each facet and light seams."""
    start = len(g.solids)
    m = S.cone(g, "y", cx, cz, r, y0, y1, ramp, base, n=n, r_top=r_top)
    slate(g, g.solids[start:], seed=seed, ramp=ramp, base=base, row=3, width=4)
    return m


def facet_stone(g: Grid, start: int, ramp="gray", base=5, block=(7, 4), seed=0) -> np.ndarray:
    """Paint stone blocks on every facet of the prisms added since `start`."""
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, ramp, base, block=block, cracks=0.05, frame=fr, seed=seed))
    return solids_since(g, start)


def glow_box(g: Grid, face: str, plane, u0, u1, v0, v1, glass=("toxic", 5), frame=("gray", 6), bars=True, seed=0) -> np.ndarray:
    """A square window: glowing glass 1 voxel proud in a light stone frame
    2 voxels proud, a painted cross bar, and a sill."""
    pane = box(g, *on_face(face, plane, u0, u1, v0, v1, 0, 1), *glass)
    P.mottle(g, pane, glass[0], glass[1], cell=2, seed=seed)
    fr = box(g, *on_face(face, plane, u0 - 2, u0, v0, v1, 0, 2), *frame) | box(g, *on_face(face, plane, u1, u1 + 2, v0, v1, 0, 2), *frame)
    fr |= box(g, *on_face(face, plane, u0 - 2, u1 + 2, v1, v1 + 2, 0, 2), *frame)
    fr |= box(g, *on_face(face, plane, u0 - 3, u1 + 3, v0 - 2, v0, 0, 3), *frame)
    P.stone(g, fr, frame[0], frame[1], block=(5, 3), seed=seed + 1)
    U, V = _uv(g, face)
    if bars:
        P.flat(g, pane & (np.abs(U - (u0 + u1) / 2) < 0.6), frame[0], 3)
        P.flat(g, pane & (np.abs(V - (v0 + v1) / 2) < 0.6), frame[0], 3)
    P.flat(g, pane & (V > v1 - 2.5), glass[0], min(7, glass[1] + 1))
    return pane


def ngon_bars(g: Grid, pts, y0, y1, half, ramp, base) -> np.ndarray:
    """Level bars along the closed outline `pts` (x, z), from y0 to y1."""
    m = np.zeros(g.shape, dtype=bool)
    for a, b in zip(pts, pts[1:] + pts[:1]):
        g.prism("y", S.quad(a, b, half), y0, y1, C(ramp, base))
        m |= last(g)
    return m


def anchor(g: Grid, x, y0, z) -> np.ndarray:
    """An iron anchor that stands on its crown, facing -z: a shank, a
    stock bar, two curved arms with flukes, and a ring (true slopes)."""
    m = box(g, x - 1, y0 + 2, z - 1, x + 1, y0 + 16, z + 1, "gray", 4)
    m |= box(g, x - 5, y0 + 13, z - 1, x + 5, y0 + 15, z + 1, "gray", 3)
    for s in (-1, 1):
        g.prism("z", S.quad((x, y0 + 1.2), (x + s * 5, y0 + 2.5), 1.2), z - 1, z + 1, C("gray", 4))
        m |= last(g)
        g.prism("z", S.quad((x + s * 5, y0 + 2.5), (x + s * 6.5, y0 + 7), 1.1), z - 1, z + 1, C("gray", 4))
        m |= last(g)
        g.prism("z", [(x + s * 5.2, y0 + 5), (x + s * 8, y0 + 8.5), (x + s * 6, y0 + 9)], z - 1, z + 1, C("gray", 5))
        m |= last(g)
    m |= S.disc(g, "z", x, y0 + 18, 2.2, z - 1, z + 1, "gray", 3)
    P.outline(g, m, "gray", 2, normal="z")
    return m


def _asset(slug: str, name: str, g: Grid):
    return single(slug, "buildings", name, g)


# ---------------------------------------------------------------- haunted lighthouse


def haunted_lighthouse():
    """A round banded lighthouse on a rock base. A stone porch holds the
    door. An outside stair winds up the shaft to a railed gallery. A wide
    glazed lamp room throws a toxic beam to the -x side under a purple cap."""
    W, H, D = 72, 166, 72
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    cx, cz = 38.0, 38.0
    s0, s1, r0, r1 = 6, 104, 16.0, 11.5  # shaft: bottom, top, radius at both

    def rad(y):
        return r0 - (r0 - r1) * (y - s0) / (s1 - s0)

    # the rock base: a faceted stone footing and rough rocks round it
    start = len(g.solids)
    g.prism("y", S.flat_ngon(cx, cz, 26, 10), 0, s0, C("stone", 4), top=S.flat_ngon(cx, cz, 24, 10))
    base = facet_stone(g, start, "stone", 4, (8, 4), 1)
    P.flat(g, base & (Y > s0 - 1) & (np.hypot(X - cx, Z - cz) > 21), "moss", 4)
    for k, (ang, rr, h) in enumerate(((35, 6, 7), (140, 5, 6), (215, 4.5, 5), (320, 5.5, 8))):
        a = math.radians(ang)
        rock(g, cx + 28 * math.cos(a) * 0.9, cz + 28 * math.sin(a) * 0.9, 0, rr, h, n=6, seed=3 + k)
    # the shaft: a 16-sided frustum in white and grey bands of stone blocks
    start = len(g.solids)
    g.prism("y", S.flat_ngon(cx, cz, r0, 16), s0, s1, C("gray", 5), top=S.flat_ngon(cx, cz, r1, 16))
    band = ((np.floor(Y - s0) // 16) % 2) == 0

    def bands(gg, mm, fr):
        P.stone(gg, mm & band, "bone", 6, block=(6, 4), cracks=0.04, frame=fr, seed=4)
        P.stone(gg, mm & ~band, "gray", 4, block=(6, 4), cracks=0.04, frame=fr, seed=5)

    S.paint_facets(g, g.solids[start:], bands)
    shaft = solids_since(g, start)
    P.flat(g, shaft & ((np.floor(Y - s0) % 16) == 0) & (Y > s0 + 2), "purple", 3)  # a dark seam between bands
    blotch(g, shaft & (Y < 40) & (X < cx), "moss", 4, cell=3, chance=0.08, seed=6)
    start = len(g.solids)
    S.cone(g, "y", cx, cz, r0 + 2, s0, s0 + 6, "gray", 5, n=16, r_top=r0 + 1)
    facet_stone(g, start, "gray", 5, (6, 3), 7)
    # the porch on the front: a stone block with a steep slate gable
    pz0, pz1, px = cz - 25, cz - 12, 12
    porch = stone(g, cx - px, s0, pz0, cx + px, 40, pz1, "gray", 5, block=(7, 4), seed=8)
    P.flat(g, porch & (Y > 38), "gray", 6)
    gable = [(cx - px, 40), (cx + px, 40), (cx, 52)]
    face_prism(g, "-z", pz1, gable, 0, pz1 - pz0, C("gray", 5))
    P.stone(g, last(g), "gray", 5, block=(6, 4), seed=9)
    for s in (-1, 1):
        slab_roof(g, "z", (cx + s * (px + 4), 38), (cx, 54.5), 3.5, pz0 - 3, cz - r0 + 4, "purple", 4, seed=10)
    arch_door(g, "-z", pz0, cx, s0, leaf=("purple", 4), glow=("toxic", 6), seed=11)
    steps(g, cx, pz0 - 3, 24, n=2, rise=3, run=4, seed=12)
    # windows at different heights on each face, between the stair turns
    for face, cu, v0 in (("-z", cx, 70), ("+x", cz, 60), ("+z", cx, 48), ("-x", cz, 34), ("+z", cx, 90)):
        r = rad(v0 + 8)
        plane = {"-z": cz - r, "+z": cz + r, "-x": cx - r, "+x": cx + r}[face]
        lancet(g, face, plane, cu - 4, cu + 4, v0, v0 + 16, glass="toxic", shade=5, seed=int(v0))
    # the outside stair: 40 treads wind down from the gallery (true turns)
    t0, y_lo, y_hi, n = 180.0, 14.0, 100.0, 40
    posts = []
    for k in range(n):
        th = math.radians(t0 - 13.5 * k)
        yk = y_lo + (y_hi - y_lo) * k / (n - 1)
        ri, ro = rad(yk) - 1.5, rad(yk) + 7.5
        ux, uz = math.cos(th), math.sin(th)
        tx, tz = -uz * 3.4, ux * 3.4
        poly = [(cx + ux * ri - tx, cz + uz * ri - tz), (cx + ux * ro - tx, cz + uz * ro - tz), (cx + ux * ro + tx, cz + uz * ro + tz), (cx + ux * ri + tx, cz + uz * ri + tz)]
        g.prism("y", poly, yk - 2, yk, C("wood", 4))
        tr = last(g)
        P.flat(g, tr & (Y > yk - 1), "wood", 5)
        P.flat(g, tr & (np.hypot(X - cx, Z - cz) > ro - 1.2), "wood", 3)
        if k % 3 == 0:
            px_, pz_ = cx + ux * (ro - 1), cz + uz * (ro - 1)
            box(g, px_ - 1, yk, pz_ - 1, px_ + 1, yk + 9, pz_ + 1, "gray", 3)
            posts.append((px_, yk + 9, pz_))
    for a, b in zip(posts, posts[1:]):
        g.line(a, b, 0.8, C("gray", 4))
    # a stone landing block under the first tread
    stone(g, cx - r0 - 9, s0, cz - 4, cx - r0 + 1, y_lo - 2, cz + 4, "gray", 5, block=(5, 3), seed=13)
    # the gallery: a corbelled deck, posts and two rails
    start = len(g.solids)
    S.cone(g, "y", cx, cz, 20, s1 - 6, s1, "gray", 6, n=16, r_top=r1 + 0.5, tip="lo")
    facet_stone(g, start, "gray", 6, (5, 3), 14)
    start = len(g.solids)
    g.prism("y", S.flat_ngon(cx, cz, 21, 16), s1, s1 + 3, C("gray", 5))
    facet_stone(g, start, "gray", 5, (6, 3), 15)
    ring = S.flat_ngon(cx, cz, 19.5, 16)
    for x, z in ring:
        box(g, x - 1, s1 + 3, z - 1, x + 1, s1 + 11, z + 1, "gray", 3)
    ngon_bars(g, ring, s1 + 10, s1 + 12, 0.8, "gray", 4)
    ngon_bars(g, ring, s1 + 6, s1 + 8, 1.0, "gray", 3)
    # the wide glazed lamp room: toxic panes in iron mullions
    l0, l1, lr = s1 + 3, s1 + 22, 13.0
    box(g, cx - lr + 1, l0, cz - lr + 1, cx + lr - 1, l0 + 3, cz + lr - 1, "gray", 3)
    start = len(g.solids)
    g.prism("y", S.flat_ngon(cx, cz, lr, 8), l0 + 3, l1, C("toxic", 5))
    lamp = solids_since(g, start)
    P.flat(g, lamp & (Y > l0 + 8) & (Y < l1 - 4), "toxic", 6)
    P.flat(g, lamp & (np.abs(Y - (l0 + l1) / 2 - 1) < 2.5) & (np.hypot(X - cx, Z - cz) < lr), "toxic", 7)
    P.flat(g, lamp & S.seams(g, g.solids[start:], 1.2), "gray", 3)
    P.flat(g, lamp & ((np.abs(Y - (l0 + 9)) < 0.6) | (Y > l1 - 1.2) | (Y < l0 + 4)), "gray", 3)
    # the beam: a widening frustum of toxic light to the -x side
    by, bx1 = (l0 + l1) / 2 + 1, cx - lr + 1
    S.cone(g, "x", by, cz, 8.5, 2, bx1, "toxic", 6, r_top=3.0, tip="hi")
    beam = last(g)
    P.flat(g, beam & (X > bx1 - 14), "toxic", 7)
    P.flat(g, beam & (X < 12), "toxic", 5)
    P.flat(g, beam & (np.abs(Y - by) < 2.0) & (np.abs(Z - cz) < 2.0), "toxic", 7)
    # the cap: an eave ring, a purple slate cone, a ball vent and a vane
    start = len(g.solids)
    S.cone(g, "y", cx, cz, lr + 3, l1, l1 + 3, "gray", 6, n=8, r_top=lr + 2)
    facet_stone(g, start, "gray", 6, (5, 3), 16)
    tile_cone(g, cx, cz, lr + 2, l1 + 3, l1 + 24, "purple", 4, n=8, seed=17)
    S.disc(g, "y", cx, cz, 3.5, l1 + 21, l1 + 27, "gray", 4)
    box(g, cx - 1, l1 + 27, cz - 1, cx + 1, H - 6, cz + 1, "gray", 3)
    bat(g, cx, H - 8, cz - 1, span=12, t=2)
    crow(g, cx + 8, s1 + 12, cz - 18, facing=1)
    # base props (K1): a coil of rope, an oil barrel, a crate and a buoy
    rope = S.disc(g, "y", cx + 17, cz - 15, 4.5, s0, s0 + 3, "sand", 4)
    P.flat(g, rope & (((np.floor(np.hypot(X - cx - 17, Z - cz + 15))) % 2) == 0), "sand", 3)
    bm = barrel(g, cx - 17, cz - 16, s0, 13, 4.5, ramp="wood", hoop="gray", base=4)
    P.flat(g, bm & (Y > s0 + 12), "toxic", 5)
    crate(g, cx + 15, s0, cz + 13, 9, ramp="wood", frame="wood", base=4, seed=18)
    anchor(g, cx + 19, s0, cz - 4)
    P.grime(g, (g.a > 0) & (Y < s0 + 6) & ~g.solid_mask(), height=4, seed=19)
    return _asset("haunted-lighthouse", "Haunted Lighthouse", g)


# ---------------------------------------------------------------- mad lab tower


def tesla_coil(g: Grid, cx, cz, y0, h, r, seed=0) -> np.ndarray:
    """A tesla coil: a stone foot, a column wound with copper rings, a
    wide toroid and a glowing ball on top (the function prop)."""
    m = stone(g, cx - r * 0.8, y0, cz - r * 0.8, cx + r * 0.8, y0 + 4, cz + r * 0.8, "gray", 5, block=(4, 2), seed=seed)
    m |= S.cone(g, "y", cx, cz, r * 0.45, y0 + 4, y0 + h, "gray", 3, r_top=r * 0.3)
    y = y0 + 6
    while y < y0 + h - 3:
        ring = S.disc(g, "y", cx, cz, r * 0.55, y, y + 2, "gold", 4)
        P.flat(g, ring & (S.coords(g)[1] > y + 1), "gold", 6)
        m |= ring
        y += 4
    tor = S.cone(g, "y", cx, cz, r * 0.6, y0 + h, y0 + h + 2, "gray", 5, r_top=r)
    tor |= S.cone(g, "y", cx, cz, r, y0 + h + 2, y0 + h + 4, "gray", 5, r_top=r * 0.6)
    P.flat(g, tor & S.seams(g, g.solids[-2:], 0.8), "gray", 3)
    m |= tor
    ball = S.disc(g, "y", cx, cz, r * 0.35, y0 + h + 4, y0 + h + 4 + r * 0.6, "toxic", 6)
    P.flat(g, ball & (S.coords(g)[1] > y0 + h + 3 + r * 0.6), "toxic", 7)
    return m | ball


def mad_lab_tower():
    """A square stone tower with a lower lab annex under a sloped metal
    roof. A leaning riveted cupola carries a crooked lightning rod. One
    tesla coil stands on the ground and one on the roof."""
    W, H, D = 72, 166, 72
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    tx0, tx1, tz0, tz1, top = 34, 64, 20, 50, 100
    ax0, ax1, az0, az1 = 6, 34, 24, 50
    plinth(g, ax0, tz0, tx1, tz1 + 2, h=5, out=3, seed=1)
    # the tower: grey stone, light corner piers and string courses
    stone(g, tx0, 5, tz0, tx1, top, tz1, "gray", 4, block=(7, 4), seed=2)
    piers(g, tx0, tx1, tz0, tz1, 5, top - 4, size=5, seed=3)
    course(g, tx0, tz0, tx1, tz1, 44, 47, seed=4)
    course(g, tx0, tz0, tx1, tz1, top - 4, top, out=2, seed=5)
    for x in range(tx0, tx1, 6):  # corbels under the cornice
        stone(g, x + 1, top - 7, tz0 - 2, x + 4, top - 4, tz0, "gray", 5, block=(3, 3), seed=6)
        stone(g, x + 1, top - 7, tz1, x + 4, top - 4, tz1 + 2, "gray", 5, block=(3, 3), seed=6)
    for z in range(tz0, tz1, 6):
        stone(g, tx1, top - 7, z + 1, tx1 + 2, top - 4, z + 4, "gray", 5, block=(3, 3), seed=6)
    arch_door(g, "-z", tz0, 50, 5, leaf=("wood", 4), glow=("toxic", 6), seed=7)
    steps(g, 50, tz0 - 3, 24, n=2, rise=2, run=3, y0=0, seed=8)
    # tower windows: barred square panes at a different height on each face
    for face, plane, u0, v0 in (("-z", tz0, 40, 54), ("-z", tz0, 48, 78), ("+x", tx1, 27, 24), ("+x", tx1, 36, 62),
                                ("+z", tz1, 40, 34), ("+z", tz1, 47, 72), ("-x", tx0, 30, 70)):
        glow_box(g, face, plane, u0, u0 + 9, v0, v0 + 11, glass=("toxic", 5), seed=v0)
    # the lab annex: stone below, riveted plates above, a sloped top
    start = len(g.solids)
    g.prism("z", [(ax0, 5), (ax1, 5), (ax1, 57), (ax0, 43)], az0, az1, C("gray", 5))
    walls = solids_since(g, start)
    P.stone(g, walls & (Y < 19), "gray", 5, block=(7, 4), seed=9)
    P.plates(g, walls & (Y >= 19), "gray", 5, size=(7, 6), seed=10)
    P.flat(g, walls & (np.abs(Y - 19) < 1), "gray", 3)
    for x in (ax0, ax1 - 3):
        for z in (az0 - 1, az1 - 2):
            stone(g, x - (1 if x == ax0 else 0), 5, z, x + 3, 43 if x == ax0 else 55, z + 3, "gray", 6, block=(3, 5), seed=11)
    start = len(g.solids)
    S.bar(g, "z", (ax0 - 5, 41.0), (ax1 + 0.5, 59.25), 3.5, az0 - 3, az1 + 3, "gray", 4)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.plates(gg, mm, "gray", 4, size=(6, 6), frame=fr, seed=12))
    roof = solids_since(g, start)
    sky = roof & (X > 12) & (X < 28) & (Z > 29) & (Z < 45) & (Y > 44)
    P.flat(g, sky, "toxic", 5)
    P.flat(g, sky & ((np.floor(X) % 5 == 0) | (np.floor(Z) % 5 == 0)), "gray", 3)
    P.flat(g, roof & (X < ax0 - 3.5), "gray", 3)
    # the big lab window with painted flasks, and windows on the other faces
    pane = glow_box(g, "-z", az0, 10, 29, 16, 34, glass=("toxic", 5), bars=False, seed=13)
    hues = (("magenta", 5), ("teal", 5), ("gold", 5), ("magenta", 6))
    for k, u in enumerate(range(11, 28, 4)):
        P.flat(g, pane & (X > u) & (X < u + 2.2) & (Y > 18) & (Y < 23 + (k % 2) * 3), *hues[k % 4])
    P.flat(g, pane & (np.abs(Y - 17.5) < 0.6), "wood", 3)
    glow_box(g, "+z", az1, 12, 22, 18, 30, glass=("toxic", 5), seed=14)
    glow_box(g, "-x", ax0, 31, 42, 16, 30, glass=("toxic", 5), seed=15)
    # copper pipes from the annex up the tower
    S.pipe(g, [(35, 8, 17), (35, 88, 17), (35, 88, 21)], s=4, ramp="gold", base=3)
    S.pipe(g, [(26, 50, 37), (26, 66, 37), (33, 66, 37)], s=4, ramp="gold", base=3)
    # the leaning riveted cupola and its steep slate cap
    c0 = [(37, 23), (55, 23), (55, 41), (37, 41)]
    lean = 3.5
    c1 = [(x + lean, z) for x, z in c0]
    start = len(g.solids)
    g.prism("y", c0, top, top + 18, C("gray", 5), top=c1)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.plates(gg, mm, "gray", 5, size=(6, 6), frame=fr, seed=16))
    cup = solids_since(g, start)
    P.flat(g, cup & S.seams(g, g.solids[start:], 1.0), "gray", 3)
    for face, plane, cu in (("-z", 23, 46 + lean / 2), ("+x", 55 + lean / 2, 32)):
        uv = (cu, top + 9) if face[1] == "z" else (top + 9, cu)
        win = S.disc(g, face[1], *uv, 3.6, plane - 1 if face[0] == "-" else plane, plane if face[0] == "-" else plane + 1, "teal", 6)
        P.flat(g, win & (np.abs((X if face[1] == "z" else Z) - cu) < 0.6), "gray", 3)
    stone(g, 35 + lean, top + 18, 21, 57 + lean, top + 20, 43, "gray", 6, block=(5, 2), seed=17)
    apex = (46 + lean + 5, 32)
    start = len(g.solids)
    g.prism("y", [(36 + lean, 20), (58 + lean, 20), (58 + lean, 44), (36 + lean, 44)], top + 20, top + 38, C("purple", 4), top=[apex] * 4)
    slate(g, g.solids[start:], seed=18, row=3, width=4)
    # the crooked lightning rod
    ax, ay = apex[0], top + 37
    pts = [(ax, ay), (ax + 2, ay + 7), (ax - 3, ay + 12), (ax + 1, ay + 19), (ax - 1, ay + 23), (ax + 3, ay + 27)]
    for a, b in zip(pts, pts[1:]):
        S.bar(g, "z", a, b, 2.2, apex[1] - 1.1, apex[1] + 1.1, "gold", 5)
    S.disc(g, "y", ax + 2, apex[1], 2.0, ay + 10, ay + 12, "gold", 3)
    box(g, pts[-1][0] - 1, pts[-1][1] - 1, apex[1] - 1, pts[-1][0] + 1, pts[-1][1] + 1, apex[1] + 1, "toxic", 7)
    # the two tesla coils: one in the yard, one on the tower roof
    tesla_coil(g, 15, 11, 0, 38, 9, seed=19)
    tesla_coil(g, 58, 45, top, 16, 6, seed=20)
    arc = [(47.0, 14.0), (51.0, 16.5), (47.5, 18.5), (51.5, 21.5)]
    for a, b in zip(arc, arc[1:]):
        S.bar(g, "x", a, b, 1.6, 14, 16, "toxic", 7)
    # base props (K1): a specimen vat, toxic drums, a big gear and a crate
    vx, vz = 65.0, 10.5
    stone(g, vx - 5.5, 0, vz - 5.5, vx + 5.5, 3, vz + 5.5, "gray", 5, block=(4, 2), seed=23)
    S.disc(g, "y", vx, vz, 4.5, 3, 20, "toxic", 5)
    glass = last(g)
    P.flat(g, glass & (Y > 17), "toxic", 6)
    P.flat(g, glass & (np.hypot(X - vx, Z - vz) < 2.2) & (Y > 7) & (Y < 16), "moss", 3)  # the shape in the brew
    P.flat(g, glass & S.seams(g, g.solids[-1:], 0.8), "gray", 4)
    S.disc(g, "y", vx, vz, 5.5, 20, 22, "gray", 4)
    S.pipe(g, [(64, 22, vz), (64, 28, vz), (64, 28, 20)], s=2, ramp="gold", base=3, flange=False)
    for bx, bz, h in ((67, 30, 12), (67, 40, 10)):
        bm = barrel(g, bx, bz, 0, h, 4, ramp="gray", hoop="gray", base=4)
        P.flat(g, bm & (Y > h - 1), "toxic", 6)
        P.flat(g, bm & (np.abs(Y - h / 2) < 1.5), "toxic", 4)
    S.gear(g, "z", 28, 14.6, 7, 53, 55, teeth=9, depth=2.5, ramp="gold", base=3)
    crate(g, 37, 0, 55, 9, ramp="wood", frame="wood", base=4, seed=21)
    P.grime(g, (g.a > 0) & (Y < 12) & ~g.solid_mask(), height=4, seed=22)
    return _asset("mad-lab-tower", "Mad Lab Tower", g)


# ---------------------------------------------------------------- vampire castle tower


def vampire_castle_tower():
    """A tall square keep. Sloped buttresses stand at its foot. A railed
    balcony is on the front. A banner hangs on the +x face. Corbels hold
    a crenellated parapet. A corner bartizan carries a flag, and a slate
    spire turret stands to the back."""
    W, H, D = 74, 172, 76
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    kx0, kx1, kz0, kz1, top = 17, 57, 22, 62, 118
    cx = (kx0 + kx1) / 2
    plinth(g, kx0, kz0, kx1, kz1, h=5, out=4, seed=1)
    stone(g, kx0, 5, kz0, kx1, top, kz1, "gray", 4, block=(8, 5), seed=2)
    course(g, kx0, kz0, kx1, kz1, 48, 51, seed=3)
    course(g, kx0, kz0, kx1, kz1, 92, 95, seed=4)
    blotch(g, (g.a > 0) & (X < kx0 + 1) & (Y < 70) & ~g.solid_mask(), "moss", 4, cell=3, chance=0.1, seed=5)
    # sloped buttresses (true slopes): two on each side face, two by the door
    bm = np.zeros(g.shape, dtype=bool)
    for u in (kx0 + 1, kx1 - 6):
        g.prism("x", [(5, kz0), (5, kz0 - 10), (16, kz0 - 10), (62, kz0)], u, u + 5, C("gray", 5))
        bm |= last(g)
    for u in (kz0 + 1, kz1 - 6):
        for xf, s in ((kx0, -1), (kx1, 1)):
            g.prism("z", [(xf, 5), (xf + s * 10, 5), (xf + s * 10, 16), (xf, 62)], u, u + 5, C("gray", 5))
            bm |= last(g)
    for u in (kx0 + 8, kx1 - 13):
        g.prism("x", [(5, kz1), (5, kz1 + 9), (14, kz1 + 9), (52, kz1)], u, u + 5, C("gray", 5))
        bm |= last(g)
    P.stone(g, bm, "gray", 5, block=(5, 4), seed=6)
    # the great door and steps
    arch_door(g, "-z", kz0, cx, 5, w=20, h=32, leaf=("purple", 4), glow=("magenta", 6), seed=7)
    steps(g, cx, kz0 - 4, 28, n=2, rise=2.5, run=4, seed=8)
    # the balcony: a corbelled slab, a stone railing and a lit door
    b0, bz = 62, kz0 - 9
    stone(g, cx - 11, b0 - 3, bz, cx + 11, b0, kz0, "gray", 6, block=(6, 3), seed=9)
    for u in (cx - 10, cx - 1.5, cx + 7):
        g.prism("x", [(b0 - 3, kz0), (b0 - 3, bz + 1), (b0 - 13, kz0)], u, u + 3, C("gray", 5))
        P.stone(g, last(g), "gray", 5, block=(3, 3), seed=10)
    rail = np.zeros(g.shape, dtype=bool)
    for k in range(6):
        x = cx - 10 + k * 3.6
        rail |= box(g, x, b0, bz, x + 2, b0 + 8, bz + 2, "gray", 6)
    for z in (bz + 4, bz + 7):
        rail |= box(g, cx - 11, b0, z - 1, cx - 9, b0 + 8, z + 1, "gray", 6) | box(g, cx + 9, b0, z - 1, cx + 11, b0 + 8, z + 1, "gray", 6)
    rail |= box(g, cx - 11, b0 + 8, bz - 0.5, cx + 11, b0 + 10, bz + 2.5, "gray", 5)
    rail |= box(g, cx - 11, b0 + 8, bz, cx - 9, b0 + 10, kz0, "gray", 5) | box(g, cx + 9, b0 + 8, bz, cx + 11, b0 + 10, kz0, "gray", 5)
    P.stone(g, rail, "gray", 6, block=(4, 3), seed=11)
    arch_door(g, "-z", kz0, cx, b0, w=14, h=26, leaf=("purple", 4), glow=("magenta", 6), seed=12)
    # windows: lancets and arrow slits at a different height on each face
    lancet(g, "-z", kz0, cx - 5, cx + 5, 98, 114, glass="toxic", shade=5, seed=13)
    lancet(g, "+z", kz1, cx - 5, cx + 5, 56, 82, glass="magenta", shade=5, seed=14)
    lancet(g, "-x", kx0, 37, 47, 34, 58, glass="toxic", shade=5, seed=15)
    for face, plane, u, v in (("-z", kz0, kx0 + 6, 72), ("+x", kx1, 52, 24), ("+x", kx1, 30, 100), ("+z", kz1, kx0 + 8, 100),
                              ("+z", kz1, kx1 - 9, 22), ("-x", kx0, 52, 82), ("-x", kx0, 30, 100)):
        glow_box(g, face, plane, u - 1.5, u + 1.5, v, v + 12, glass=("toxic", 6), bars=False, seed=int(v + u))
    # the banner on the +x face: an iron rod on brackets and torn cloth
    for z in (33, 45):
        box(g, kx1, 104, z - 1, kx1 + 4, 106, z + 1, "gray", 3)
    box(g, kx1 + 2, 106, 30, kx1 + 4, 108, 48, "gray", 3)
    cloth = [(106, 31), (106, 47), (74, 47), (68, 43), (73, 39), (66, 35), (72, 31)]
    g.prism("x", cloth, kx1 + 2, kx1 + 3.5, C("magenta", 4))
    flag = last(g)
    P.mottle(g, flag, "magenta", 4, cell=3, seed=16)
    P.outline(g, flag, "magenta", 2, normal="x")
    P.flat(g, flag & (np.abs(Y - 101) < 1.2), "gold", 5)
    for face, plane in (("+x", kx1 + 3.5), ("-x", kx1 + 2)):
        pnglyph.icon(g, face, plane, 32, 82, "bat", "bone", 6, scale=1)
    # corbels, the parapet and the merlons
    for k in range(7):
        a = kx0 + 1 + k * 6
        for z0 in (kz0 - 3, kz1):
            stone(g, a, top - 6, z0, a + 3, top, z0 + 3, "gray", 5, block=(3, 3), seed=17)
        b = kz0 + 1 + k * 6
        for x0 in (kx0 - 3, kx1):
            stone(g, x0, top - 6, b, x0 + 3, top, b + 3, "gray", 5, block=(3, 3), seed=17)
    stone(g, kx0 - 3, top, kz0 - 3, kx1 + 3, top + 8, kz1 + 3, "gray", 5, block=(7, 4), seed=18)
    pave = (g.a > 0) & (np.abs(Y - top - 7.5) < 0.6) & (X > kx0) & (X < kx1) & (Z > kz0) & (Z < kz1)
    P.stone(g, pave, "gray", 4, block=(6, 6), frame="top", seed=32)
    mer = np.zeros(g.shape, dtype=bool)
    n, a0, a1 = 6, kx0 - 3, kx1 - 2
    for k in range(n):
        a = a0 + k * (a1 - a0) / (n - 1)
        if a < kx0 + 6:
            continue  # the bartizan takes the front-left corner
        mer |= box(g, a, top + 8, kz0 - 3, a + 5, top + 15, kz0, "gray", 5)
    for k in range(n):
        a = a0 + k * (a1 - a0) / (n - 1)
        mer |= box(g, a, top + 8, kz1, a + 5, top + 15, kz1 + 3, "gray", 5)
        mer |= box(g, kx1, top + 8, a + 5, kx1 + 3, top + 15, a + 10, "gray", 5)
        if a + 5 > kz0 + 6:
            mer |= box(g, kx0 - 3, top + 8, a + 5, kx0, top + 15, a + 10, "gray", 5)
    P.stone(g, mer, "gray", 5, block=(5, 4), seed=19)
    # the bartizan at the front-left corner: a corbel cone, a drum, a cap, a flag
    bx, bzc, br = kx0 + 1.0, kz0 + 1.0, 7.0
    start = len(g.solids)
    S.cone(g, "y", bx, bzc, br, 80, 92, "gray", 5, r_top=2.0, tip="lo")
    g.prism("y", S.flat_ngon(bx, bzc, br, 8), 92, top + 12, C("gray", 4))
    facet_stone(g, start, "gray", 4, (5, 4), 20)
    S.disc(g, "y", bx, bzc, br + 1.2, top + 12, top + 15, "gray", 6)
    tile_cone(g, bx, bzc, br + 1.5, top + 15, top + 36, "purple", 4, seed=21)
    slit = (g.a > 0) & (np.hypot(X - bx, Z - bzc) > br - 1) & (Z < bzc - 3) & (np.abs(X - bx) < 1.4) & (Y > 98) & (Y < 110)
    P.flat(g, slit, "toxic", 6)
    S.banner(g, bx - 1.5, top + 33, bzc - 1.5, 13, 12, 8, ramp="magenta", base=4, pole_ramp="gray", glyph=None)
    # the spire turret to the back right
    sx0, sx1, sz0, sz1 = cx, kx1 - 1, 42, kz1 - 1
    stone(g, sx0, top + 8, sz0, sx1, top + 28, sz1, "gray", 5, block=(6, 4), seed=22)
    lancet(g, "-z", sz0, (sx0 + sx1) / 2 - 3, (sx0 + sx1) / 2 + 3, top + 12, top + 25, glass="magenta", shade=5, seed=23)
    lancet(g, "+x", sx1, (sz0 + sz1) / 2 - 3, (sz0 + sz1) / 2 + 3, top + 12, top + 25, glass="toxic", shade=5, seed=24)
    stone(g, sx0 - 1, top + 28, sz0 - 1, sx1 + 1, top + 30, sz1 + 1, "gray", 6, block=(5, 2), seed=25)
    hc, hz = (sx0 + sx1) / 2, (sz0 + sz1) / 2
    start = len(g.solids)
    g.prism("y", [(sx0 - 2, sz0 - 2), (sx1 + 2, sz0 - 2), (sx1 + 2, sz1 + 2), (sx0 - 2, sz1 + 2)], top + 30, top + 48, C("purple", 4), top=[(hc, hz)] * 4)
    slate(g, g.solids[start:], seed=26, row=4, width=4)
    box(g, hc - 1, top + 46, hz - 1, hc + 1, H - 4, hz + 1, "gray", 3)
    bat(g, hc, H - 7, hz - 1, span=10, t=2)
    # base props (K1): a standing coffin, tombstones and a brazier
    coffin(g, kx1 + 7, 0, 10, 22, 6, 9, pose="up", seed=27)
    tombstone(g, 9, 70, w=8, h=12, lean=-7, seed=28)
    tombstone(g, 64, 70, w=7, h=10, lean=6, glyph="", seed=29)
    from _bld import brazier
    brazier(g, kx0 - 6, 0, kz0 - 10, r=4, fire="magenta")
    pumpkin(g, 9, 0, 40, w=9, h=7, seed=30)
    P.grime(g, (g.a > 0) & (Y < 14) & ~g.solid_mask(), height=4, seed=31)
    return _asset("vampire-castle-tower", "Vampire Castle Tower", g)


# ---------------------------------------------------------------- cursed library


def book_pile(g: Grid, x, z, n, seed=0) -> np.ndarray:
    """A pile of chunky books, each turned a little (rule F5): coloured
    covers with pale page edges."""
    rng = np.random.default_rng(seed)
    hues = (("purple", 5), ("magenta", 5), ("moss", 5), ("orange", 4), ("teal", 5))
    m = np.zeros(g.shape, dtype=bool)
    y = 0.0
    for k in range(n):
        w, d, t = rng.uniform(10, 13), rng.uniform(7, 9), rng.choice((3.0, 4.0))
        pts = S.rotate([(x - w / 2, z - d / 2), (x + w / 2, z - d / 2), (x + w / 2, z + d / 2), (x - w / 2, z + d / 2)], x, z, rng.uniform(-14, 14))
        g.prism("y", pts, y, y + t, C(*hues[(k + seed) % len(hues)]))
        b = last(g)
        _X, Y, _Z = S.coords(g)
        P.outline(g, b, hues[(k + seed) % len(hues)][0], 2, normal="y")
        P.flat(g, b & (Y > y + 0.5) & (Y < y + t - 0.5) & ~S.seams(g, g.solids[-1:], 1.2), "bone", 6)
        m |= b
        y += t
    return m


def giant_book(g: Grid, cx, cz) -> None:
    """The oversized function prop (rules F4, F6): a stone lectern with a
    giant open spell book. The book has a purple cover, pale pages with
    painted lines and a glowing rune. Candle stands are at its sides."""
    from _bld import candle
    X, Y, Z = S.coords(g)
    start = len(g.solids)
    g.prism("y", S.flat_ngon(cx, cz, 6, 8), 0, 16, C("gray", 5), top=S.flat_ngon(cx, cz, 4, 8))
    facet_stone(g, start, "gray", 5, (4, 3), 40)
    S.disc(g, "y", cx, cz, 7, 0, 2, "gray", 4)
    z0, z1, y0 = cz - 9, cz + 9, 17.0  # the desk: low at the front, high at the back
    k = 0.5

    def dy(z):
        return y0 + (z - z0) * k

    g.prism("x", [(15.5, cz - 4), (15.5, cz + 4), (dy(cz + 4) + 0.5, cz + 4), (dy(cz - 4) + 0.5, cz - 4)], cx - 4, cx + 4, C("gray", 6))
    P.stone(g, last(g), "gray", 6, block=(4, 3), seed=41)
    desk = S.bar(g, "x", (dy(z0) + 1, z0), (dy(z1) + 1, z1), 2, cx - 12, cx + 12, "wood", 4)
    P.planks(g, desk, "wood", 4, width=3, across="z", nails=False, seed=42)
    cover = S.bar(g, "x", (dy(z0 - 1) + 3, z0 - 1), (dy(z1 + 1) + 3, z1 + 1), 2, cx - 14, cx + 14, "purple", 3)
    P.outline(g, cover, "purple", 2)
    P.flat(g, cover & (np.abs(X - cx) < 1.0), "gold", 5)
    pages = S.bar(g, "x", (dy(z0) + 5, z0), (dy(z1) + 5, z1), 3, cx - 13, cx + 13, "bone", 6)
    top = pages & S.seams(g, g.solids[-1:], 0) | pages
    _ = top
    lines = pages & ((np.floor(Z) % 3) == 0) & (np.abs(X - cx) > 2.5) & (np.abs(X - cx) < 11.5)
    P.flat(g, lines & (((np.floor(X) * 7 + np.floor(Z) * 3) % 5) != 0), "bone", 4)
    P.flat(g, pages & (np.abs(X - cx) < 1.5), "bone", 4)  # the spine fold
    rune = pages & (np.hypot(X - cx + 7, Z - cz) < 3.6) & ~(np.hypot(X - cx + 7, Z - cz) < 2.0)
    P.flat(g, rune, "toxic", 6)
    P.flat(g, pages & (np.hypot(X - cx + 7, Z - cz) < 1.0), "toxic", 7)
    P.flat(g, pages & (np.abs(X - cx + 7) < 0.6) & (np.abs(Z - cz) < 4.5), "toxic", 6)
    for sx in (cx - 17, cx + 15):
        stand = box(g, sx, 0, cz - 1, sx + 2, 20, cz + 1, "gray", 3)
        box(g, sx - 2, 0, cz - 3, sx + 4, 2, cz + 3, "gray", 4)
        box(g, sx - 1.5, 20, cz - 1.5, sx + 3.5, 21, cz + 1.5, "gray", 4)
        candle(g, sx, 21, cz - 1, h=5)
        _ = stand


def cursed_library():
    """A two-storey stone library. A gabled entrance bay with a rose window
    projects on the left. A wall of three tall gothic windows fills the
    right. A stair turret stands at the back corner, and a stone chimney
    leans on the roof. A giant spell book on a lectern stands at the front."""
    W, H, D = 124, 138, 104
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    hx0, hx1, hz0, hz1 = 26, 104, 40, 86
    eave, ridge = 76, 110
    plinth(g, hx0, hz0, hx1, hz1, h=5, out=3, seed=1)
    stone(g, hx0, 5, hz0, hx1, eave, hz1, "gray", 5, block=(8, 4), seed=2)
    piers(g, hx0, hx1, hz0, hz1, 5, eave, size=5, seed=3)
    # the string course between the storeys, on the sides, back and front left
    for b in ((hx0 - 1, 42, hz0 - 1, hx0 + 4, 46, hz1 + 1), (hx1 - 4, 42, hz0 - 1, hx1 + 1, 46, hz1 + 1), (hx0 - 1, 42, hz1 - 2, hx1 + 1, 46, hz1 + 1)):
        P.stone(g, box(g, *b, "gray", 6), "gray", 6, block=(10, 3), seed=4)
    roof = gable_roof(g, hx0, hx1, hz0, hz1, eave, ridge, ramp="purple", base=4, thick=4, overhang=5, trim="gray", gable="gray", ridge="x", trim_shade=6, seed=5)
    from _bld import roof_paint
    roof_paint(g, roof, "x", 6)
    # the entrance bay: a gabled stone block with a rose window over the door
    bx0, bx1, bz0 = 30, 56, 28
    stone(g, bx0, 5, bz0, bx1, 66, hz0, "gray", 5, block=(7, 4), seed=7)
    piers(g, bx0, bx1, bz0, hz0, 5, 66, size=4, seed=8, corners=("fl", "fr"))
    bay = gable_roof(g, bx0, bx1, bz0, hz0 + 10, 66, 94, ramp="purple", base=4, thick=4, overhang=3, trim="gray", gable="gray", ridge="z", trim_shade=6, seed=9)
    roof_paint(g, bay, "z", 10)
    bc = (bx0 + bx1) / 2
    arch_door(g, "-z", bz0, bc, 5, w=18, h=32, leaf=("wood", 4), glow=("toxic", 6), seed=11)
    steps(g, bc, bz0 - 3, 26, n=2, rise=2.5, run=4, seed=12)
    rose(g, "-z", bz0, bc, 52, 6, glass="magenta", shade=5)
    lancet(g, "-z", bz0, bc - 3, bc + 3, 70, 84, glass="toxic", shade=5, seed=13)
    # the tall gothic window wall between buttresses
    for u in (hx1 - 3, 89, 75, 58):
        g.prism("x", [(5, hz0), (5, hz0 - 7), (14, hz0 - 7), (70, hz0)], u, u + 3, C("gray", 6))
        P.stone(g, last(g), "gray", 6, block=(4, 4), seed=14)
    for k, wc in enumerate((67, 82, 96)):
        lancet(g, "-z", hz0, wc - 4.5, wc + 4.5, 12, 70, glass="magenta" if k % 2 == 0 else "toxic", shade=6 if k % 2 == 0 else 5, seed=15 + k)
    # windows on the other faces: ground and upper storeys, staggered
    lancet(g, "-x", hx0, 50, 58, 12, 34, glass="toxic", shade=5, seed=20)
    lancet(g, "-x", hx0, 66, 74, 50, 70, glass="toxic", shade=5, seed=21)
    rose(g, "-x", hx0, 63, 90, 4, glass="toxic", shade=5)
    lancet(g, "+x", hx1, 48, 56, 12, 34, glass="toxic", shade=5, seed=22)
    lancet(g, "+x", hx1, 58, 66, 50, 70, glass="magenta", shade=5, seed=23)
    for k, u in enumerate((34, 52, 70)):
        glow_box(g, "+z", hz1, u, u + 9, 14, 30, glass=("toxic", 5), seed=24 + k)
    for k, u in enumerate((40, 58, 76)):
        lancet(g, "+z", hz1, u, u + 8, 50, 70, glass="magenta" if k == 1 else "toxic", shade=5, seed=27 + k)
    # the stair turret at the back right with slit windows and a slate cone
    tx, tz, tr = 103.0, 86.0, 9.0
    start = len(g.solids)
    g.prism("y", S.flat_ngon(tx, tz, tr, 8), 0, 100, C("gray", 5))
    facet_stone(g, start, "gray", 5, (6, 4), 30)
    rr = S.ngon_radius(g, "y", tx, tz)
    tur = solids_since(g, start)
    for ang, v0 in ((0, 20), (60, 44), (20, 66), (80, 84)):
        a = math.radians(ang)
        px_, pz_ = tx + math.cos(a) * tr, tz + math.sin(a) * tr
        sl = tur & (rr > tr - 1.5) & (np.hypot(X - px_, Z - pz_) < 2.2) & (Y > v0) & (Y < v0 + 10)
        P.flat(g, sl, "toxic", 6)
        P.outline(g, sl, "gray", 7)
    S.disc(g, "y", tx, tz, tr + 1.5, 100, 103, "gray", 6)
    tile_cone(g, tx, tz, tr + 2.5, 103, 128, "purple", 4, seed=31)
    box(g, tx - 1, 124, tz - 1, tx + 1, 133, tz + 1, "gray", 3)
    # the leaning chimney on the -x end of the roof
    cz0 = 70
    g.prism("y", [(31, cz0), (41, cz0), (41, cz0 + 10), (31, cz0 + 10)], 80, 120, C("stone", 5), top=[(27, cz0), (37, cz0), (37, cz0 + 10), (27, cz0 + 10)])
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(5, 3), frame=fr, seed=32))
    stone(g, 25, 120, cz0 - 2, 39, 124, cz0 + 12, "gray", 6, block=(5, 2), seed=33)
    g.box(28, 123, cz0 + 1, 36, 124, cz0 + 9, C("toxic", 6))
    # the giant spell book, and props round the base (K1)
    giant_book(g, 21.0, 14.0)
    book_pile(g, 104, 31, 4, seed=34)
    book_pile(g, 113, 40, 3, seed=35)
    book_pile(g, 62, 30, 2, seed=36)
    pumpkin(g, 112, 0, 22, w=9, h=7, seed=37)
    crow(g, hx0 + 12, ridge + 6, (hz0 + hz1) / 2, facing=1)
    P.grime(g, (g.a > 0) & (Y < 12) & ~g.solid_mask(), height=4, seed=38)
    return _asset("cursed-library", "Cursed Library", g)


# ---------------------------------------------------------------- haunted schoolhouse


def picket(g: Grid, along: str, a, c, lean=0.0) -> np.ndarray:
    """One pointed fence picket (a true slope at the tip), 2.4 wide and
    15.5 high, at position `a` along the fence line at the other
    coordinate c; `lean` turns it a few degrees (rule F5)."""
    pts = [(a, 0), (a + 2.4, 0), (a + 2.4, 13), (a + 1.2, 15.5), (a, 13)]
    if lean:
        pts = S.rotate(pts, a + 1.2, 0.5, lean)
        pts = [(u, max(0.0, v)) for u, v in pts]
    if along == "x":
        g.prism("z", pts, c, c + 1.5, C("bone", 5))
    else:
        g.prism("x", [(v, u) for u, v in pts], c, c + 1.5, C("bone", 5))
    m = last(g)
    P.planks(g, m, "bone", 5, width=3, across="x" if along == "x" else "z", length=(40, 41), nails=False, seed=int(a))
    return m


def fence(g: Grid, along: str, a0, a1, c, gap=5, skip=()) -> None:
    """A picket fence from a0 to a1 at c: two rails behind the pickets,
    stout end posts, and a few leaning or missing pickets."""
    k = 0
    a = a0 + 3
    while a + 2.4 <= a1 - 3:
        if not any(lo <= a <= hi for lo, hi in skip) and k % 7 != 5:
            picket(g, along, a, c, lean=(7.0 if k % 5 == 2 else (-6.0 if k % 6 == 4 else 0.0)))
        a += gap
        k += 1
    for y in (3, 9):
        if along == "x":
            P.planks(g, box(g, a0, y, c + 1.5, a1, y + 2, c + 3, "wood", 4), "wood", 4, width=2, nails=True, seed=y)
        else:
            P.planks(g, box(g, c + 1.5, y, a0, c + 3, y + 2, a1, "wood", 4), "wood", 4, width=2, nails=True, seed=y)
    for a in (a0, a1 - 3):
        b = box(g, a, 0, c, a + 3, 17, c + 3, "wood", 4) if along == "x" else box(g, c, 0, a, c + 3, 17, a + 3, "wood", 4)
        P.planks(g, b, "wood", 4, width=3, across="x", nails=False, seed=int(a))


def clapboard(g: Grid, m: np.ndarray, seed=0) -> None:
    """Weathered pale clapboards with dark seams and a few grey boards."""
    P.planks(g, m, "bone", 5, width=3, across="y", length=(14, 24), nails=True, seed=seed)
    blotch(g, m, "gray", 5, cell=3, chance=0.06, seed=seed + 1)


def haunted_schoolhouse():
    """A one-room clapboard schoolhouse. A stone bell gable rises over the
    front entry, with a covered porch under it and a bell that hangs in
    a leaning bellcote. A picket fence closes the yard. A big slate board
    on an easel stands in the yard."""
    W, H, D = 124, 124, 120
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    hx0, hx1, hz0, hz1, eave, ridge = 36, 88, 54, 112, 50, 94
    plinth(g, hx0, hz0, hx1, hz1, h=5, out=3, seed=1)
    walls = box(g, hx0, 5, hz0, hx1, eave, hz1, "bone", 5)
    clapboard(g, walls, 2)
    for x in (hx0 - 1, hx1 - 2):  # corner boards
        for z in (hz0 - 1, hz1 - 2):
            P.planks(g, box(g, x, 5, z, x + 3, eave, z + 3, "wood", 4), "wood", 4, width=3, across="x", nails=False, seed=x)
    P.planks(g, box(g, hx0 - 1, eave - 3, hz0 - 1, hx1 + 1, eave, hz1 + 1, "wood", 4), "wood", 4, width=3, seed=3)
    roof = gable_roof(g, hx0, hx1, hz0, hz1, eave, ridge, ramp="purple", base=4, thick=4, overhang=5, trim="wood", gable="bone", ridge="z", trim_shade=4, seed=4)
    clapboard(g, roof["attic"], 5)
    blotch(g, roof["slabs"], "purple", 2, cell=3, chance=0.05, seed=6)
    # the entry: clapboard walls, a gable roof and the stone bell gable
    vx0, vx1, vz0, vtop, vridge = 50, 74, 38, 62, 82
    vc = (vx0 + vx1) / 2
    vest = box(g, vx0, 5, vz0, vx1, vtop, hz0, "bone", 5)
    clapboard(g, vest, 7)
    vroof = gable_roof(g, vx0, vx1, vz0, hz0 + 8, vtop, vridge, ramp="purple", base=4, thick=4, overhang=2, trim="wood", gable="bone", ridge="z", trim_shade=4, seed=8)
    clapboard(g, vroof["attic"], 9)
    gw = [(vx0 - 2, 5), (vx1 + 2, 5), (vx1 + 2, vtop + 4), (vc, vridge + 6), (vx0 - 2, vtop + 4)]
    bell_wall = face_prism(g, "-z", vz0, gw, 0, 4, C("gray", 5))
    P.stone(g, bell_wall, "gray", 5, block=(6, 4), seed=10)
    P.flat(g, bell_wall & (Y < 9), "gray", 4)
    arch_door(g, "-z", vz0 - 4, vc, 5, w=18, h=30, leaf=("purple", 4), glow=("toxic", 6), seed=11)
    # the bellcote: two piers, a beam and a hood, leaning 6 degrees
    piv, tilt = (vc, 72.0), -6.0
    bc = np.zeros(g.shape, dtype=bool)
    for x0 in (vc - 9, vc + 5):
        g.prism("z", S.rotate([(x0, 70), (x0 + 4, 70), (x0 + 4, 104), (x0, 104)], *piv, tilt), vz0 - 4, vz0, C("gray", 6))
        bc |= last(g)
    g.prism("z", S.rotate([(vc - 9, 99), (vc + 9, 99), (vc + 9, 102), (vc - 9, 102)], *piv, tilt), vz0 - 4, vz0, C("gray", 6))
    bc |= last(g)
    P.stone(g, bc, "gray", 6, block=(4, 3), seed=12)
    start = len(g.solids)
    g.prism("z", S.rotate([(vc - 12, 103), (vc + 12, 103), (vc, 113)], *piv, tilt), vz0 - 5, vz0 + 1, C("purple", 4))
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 4, row=3, width=4, frame=fr, seed=13))
    hx, hy = S.rotate([(vc, 99)], *piv, tilt)[0]
    box(g, hx - 1, hy - 4, vz0 - 3, hx + 1, hy, vz0 - 1, "gray", 3)  # the yoke strap
    bell = S.cone(g, "y", hx, vz0 - 2, 4.2, hy - 13, hy - 5, "gold", 4, r_top=2.4)
    bell |= S.cone(g, "y", hx, vz0 - 2, 2.4, hy - 5, hy - 3, "gold", 3, r_top=1.5)
    P.flat(g, bell & (Y < hy - 11.5), "gold", 3)
    P.flat(g, bell & (np.abs(Y - (hy - 8)) < 0.6), "gold", 6)
    # the covered porch: a plank deck, two posts and a shed roof
    deck = box(g, vx0 - 6, 0, 22, vx1 + 6, 5, vz0 - 4, "wood", 4)
    P.planks(g, deck, "wood", 4, width=3, across="y", nails=True, seed=14)
    steps(g, vc, 22, 22, n=2, rise=2.5, run=4, seed=15)
    for x in (vx0 - 5, vx1 + 2):
        P.planks(g, box(g, x, 5, 23, x + 3, 40, 26, "wood", 5), "wood", 5, width=3, across="x", nails=False, seed=x)
    slab_roof(g, "x", (39.0, 20.0), (46.0, vz0 - 3.5), 3, vx0 - 7, vx1 + 7, "purple", 4, seed=16)
    # windows: tall sashes with purple shutters on the long sides
    for face, plane in (("-x", hx0), ("+x", hx1)):
        for u in (62, 80, 98):
            window(g, face, plane, u, u + 9, 15, 38, frame="wood", glass="toxic", glow=5, sill="wood")
            shutters(g, face, plane, u, u + 9, 15, 38, ramp="purple", base=4)
    for u in (39, 77):
        window(g, "-z", hz0, u, u + 8, 18, 36, frame="wood", glass="toxic", glow=5, sill="wood")
    for face, plane in (("-x", vx0), ("+x", vx1)):
        window(g, face, plane, vz0 + 5, vz0 + 11, 22, 36, frame="wood", glass="magenta", glow=5, sill="wood")
    window(g, "+z", hz1, 56, 68, 16, 38, frame="wood", glass="toxic", glow=5, sill="wood")
    rose(g, "+z", hz1, 62, 68, 5, glass="toxic", shade=5)
    # a leaning brick chimney on the +x slope near the back
    g.prism("y", [(72, 96), (80, 96), (80, 104), (72, 104)], 60, 104, C("stone", 5), top=[(77, 96), (85, 96), (85, 104), (77, 104)])
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(4, 2), frame=fr, seed=17))
    stone(g, 75, 104, 94, 87, 107, 106, "gray", 6, block=(4, 2), seed=18)
    # the fenced yard with a gate arch and a painted name board
    fence(g, "x", 4, 44, 8)
    fence(g, "x", 80, 120, 8)
    fence(g, "z", 8, 60, 4)
    fence(g, "z", 8, 60, 117)
    arch = np.zeros(g.shape, dtype=bool)
    for x in (41, 80):
        arch |= box(g, x, 0, 7, x + 3, 34, 11, "wood", 4)
    sign = box(g, 40, 25, 7.5, 84, 34, 10.5, "wood", 5)
    P.planks(g, arch | sign, "wood", 4, width=3, across="y", nails=True, seed=19)
    P.outline(g, sign, "wood", 2, normal="z")
    tw, _th = pnglyph.text_size("SCHOOL")
    pnglyph.text(g, "-z", 7.5, int(62 - tw / 2), 26, "SCHOOL", "bone", 7)
    pnglyph.text(g, "+z", 10.5, int(62 - tw / 2), 26, "SCHOOL", "bone", 7)
    # the slate board on an easel: the oversized function prop
    for x in (11, 41):
        S.bar(g, "x", (2.0, 31.0), (40.0, 27.0), 2.4, x, x + 2, "wood", 4)
    S.bar(g, "x", (2.0, 40.0), (37.0, 29.5), 2.4, 26, 28, "wood", 4)
    frame = box(g, 12, 10, 26, 42, 35, 28, "wood", 5)
    P.planks(g, frame, "wood", 5, width=3, across="y", nails=True, seed=20)
    slate_m = box(g, 14, 12, 25, 40, 33, 26, "teal", 2)
    P.mottle(g, slate_m, "teal", 2, cell=3, seed=21)
    pnglyph.text(g, "-z", 25, 17, 24, "ABC", "bone", 7)
    pnglyph.text(g, "-z", 25, 19, 14, "2+2", "bone", 7)
    tray = box(g, 12, 9, 24, 42, 11, 28, "wood", 4)
    P.flat(g, tray & (Y > 10) & (X > 20) & (X < 23), "bone", 7)
    # base props (K1): a bench with a pile of books, a pail and pumpkins
    for x in (94, 106):
        box(g, x, 0, 30, x + 2, 7, 36, "wood", 3)
    bench = box(g, 92, 7, 29, 110, 9, 37, "wood", 5)
    P.planks(g, bench, "wood", 5, width=3, across="y", nails=True, seed=22)
    for k, (hue, t) in enumerate((("purple", 3), ("moss", 2), ("orange", 3))):
        bk = box(g, 96 + k, 9 + sum((3, 2, 3)[:k]), 31 + k * 0.5, 105 - k, 9 + sum((3, 2, 3)[:k + 1]), 36 - k * 0.5, hue, 5 if hue != "orange" else 4)
        P.flat(g, bk & ~(S.coords(g)[1] < 9 + sum((3, 2, 3)[:k]) + 0.6) & (np.abs(Z - 31 - k * 0.5) < 0.6), "bone", 6)
    pail = S.cone(g, "y", 84, 20, 3.0, 0, 7, "gray", 5, r_top=3.8)
    P.flat(g, pail & (Y > 6), "teal", 5)
    pumpkin(g, 106, 0, 48, w=10, h=8, seed=23)
    pumpkin(g, 18, 0, 50, w=8, h=6, seed=24)
    crow(g, 30, 17, 9, facing=-1)
    P.grime(g, (g.a > 0) & (Y < 10) & ~g.solid_mask(), height=4, seed=25)
    return _asset("haunted-schoolhouse", "Haunted Schoolhouse", g)


# ---------------------------------------------------------------- hunters lodge


def pelt(g: Grid, x, z0, w, ramp, base, seed=0) -> np.ndarray:
    """A stretched hide that hangs from the rack pole at x (a thin prism
    across x): a ragged outline with four leg points, soft mottle, a dark
    rim and a pale belly."""
    k = w / 12
    out = [(z0, 31.5), (z0 + 12 * k, 31.5), (z0 + 13 * k, 27), (z0 + 11 * k, 22), (z0 + 12.5 * k, 13), (z0 + 8 * k, 16),
           (z0 + 6 * k, 10), (z0 + 4 * k, 16), (z0 - 0.5 * k, 13), (z0 + 1 * k, 22), (z0 - 1 * k, 27)]
    g.prism("x", [(y, zz) for zz, y in out], x - 1.5, x, C(ramp, base))
    m = last(g)
    P.mottle(g, m, ramp, base, cell=2, seed=seed)
    _X, Y, Z = S.coords(g)
    P.flat(g, m & (np.abs(Z - z0 - 6 * k) < 2.2 * k) & (Y > 16) & (Y < 27), ramp, min(7, base + 1))
    P.outline(g, m, ramp, max(1, base - 2), normal="x")
    return m


def log_ends(g: Grid, x0, x1, z0, z1, y0, rows, r=2.5) -> None:
    """Crossed log ends that stick out at the four corners (log cabin
    corners): x and z logs in turn, with painted end rings."""
    X, Y, Z = S.coords(g)
    for k in range(rows):
        yc = y0 + 5 * k + 2.5
        for cxl, czl, sx, sz in ((x0, z0, -1, -1), (x1, z0, 1, -1), (x0, z1, -1, 1), (x1, z1, 1, 1)):
            if k % 2 == 0:
                zc = czl - sz * 2.5
                lo, hi = (cxl - 5, cxl + 3) if sx < 0 else (cxl - 3, cxl + 5)
                m = S.disc(g, "x", yc, zc, r, lo, hi, "wood", 4)
                endm = m & ((X < lo + 1) if sx < 0 else (X > hi - 1))
                rr = np.hypot(Y - yc, Z - zc)
            else:
                xc = cxl - sx * 2.5
                lo, hi = (czl - 5, czl + 3) if sz < 0 else (czl - 3, czl + 5)
                m = S.disc(g, "z", xc, yc, r, lo, hi, "wood", 4)
                endm = m & ((Z < lo + 1) if sz < 0 else (Z > hi - 1))
                rr = np.hypot(X - xc, Y - yc)
            P.flat(g, m & ~endm, "wood", 4)
            P.flat(g, endm, "wood", 6)
            P.flat(g, endm & (np.abs(rr - 1.3) < 0.5), "wood", 5)
            P.flat(g, endm & (rr > r - 0.6), "wood", 3)


def hunters_lodge():
    """A long log lodge under a steep slate roof. A covered porch runs
    along the front. A cross gable over the door carries a giant antler
    rack and skull. A stone chimney leans on the -x end. A drying rack
    with pelts stands on the +x side, with a log pile and a chopping
    block in the yard."""
    W, H, D = 152, 122, 104
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    hx0, hx1, hz0, hz1, eave, ridge = 34, 118, 46, 92, 46, 90
    cx = 76.0
    plinth(g, hx0, hz0, hx1, hz1, h=6, out=2, seed=1)
    walls = box(g, hx0, 6, hz0, hx1, eave, hz1, "wood", 6)
    logs(g, walls, 6, "wood", 6, seed=2)
    log_ends(g, hx0, hx1, hz0, hz1, 6, 8)
    roof = gable_roof(g, hx0, hx1, hz0, hz1, eave, ridge, ramp="purple", base=4, thick=4, overhang=5, trim="wood", gable="wood", ridge="x", trim_shade=4, seed=3)
    P.planks(g, roof["attic"], "wood", 4, width=4, across="x", nails=True, seed=4)
    blotch(g, roof["slabs"], "moss", 5, cell=3, chance=0.04, seed=5)
    # the cross gable over the door with the antler rack
    gx0, gx1 = cx - 16, cx + 16
    cg = gable_roof(g, gx0, gx1, hz0, hz0 + 26, eave, 82, ramp="purple", base=4, thick=4, overhang=3, trim="wood", gable="wood", ridge="z", trim_shade=4, seed=6)
    P.planks(g, cg["attic"], "wood", 4, width=4, across="x", nails=True, seed=7)
    plaque = face_prism(g, "-z", hz0, [(cx - 9, 50), (cx + 9, 50), (cx + 9, 66), (cx, 71), (cx - 9, 66)], 0, 2, C("wood", 3))
    P.planks(g, plaque, "wood", 3, width=3, across="x", nails=True, seed=8)
    S.skull(g, cx, 53, hz0 - 5, s=10, eyes=("ember", 6), seed=9)
    ant = np.zeros(g.shape, dtype=bool)
    for sd in (-1, 1):
        for a, b, t in (((cx + sd * 3, 64), (cx + sd * 11, 72), 2.4), ((cx + sd * 11, 72), (cx + sd * 19, 84), 2.2), ((cx + sd * 19, 84), (cx + sd * 21, 93), 1.8),
                        ((cx + sd * 8, 69), (cx + sd * 6, 79), 1.7), ((cx + sd * 14, 77), (cx + sd * 13, 88), 1.7), ((cx + sd * 17, 81), (cx + sd * 25, 85), 1.7)):
            ant |= S.bar(g, "z", a, b, t, hz0 - 4, hz0 - 1.5, "bone", 6)
    P.flat(g, ant & S.seams(g, g.solids[-12:], 0.6), "bone", 5)
    # the covered porch: a plank deck, log posts and a shed roof
    deck = box(g, hx0 + 8, 0, 24, hx1 - 8, 6, hz0, "wood", 4)
    P.planks(g, deck, "wood", 4, width=3, across="y", nails=True, seed=10)
    steps(g, cx, 24, 24, n=2, rise=3, run=4, seed=11)
    for x in (hx0 + 11, 64, 88, hx1 - 11):
        post = S.disc(g, "y", x, 28, 2.2, 6, 39, "wood", 4)
        logs(g, post, 6, "wood", 4, rows=40, seed=x)
    slab_roof(g, "x", (37.5, 22.0), (45.5, hz0 - 3), 3, hx0 + 6, hx1 - 6, "purple", 4, seed=12)
    arch_door(g, "-z", hz0, cx, 6, w=18, h=30, leaf=("wood", 4), frame=("wood", 5), glow=("ember", 6), seed=13)
    # windows with warm lamplight on every face, and shutters at the front
    for u in (50, 92):
        window(g, "-z", hz0, u, u + 10, 16, 32, frame="wood", glass="ember", glow=6, sill="wood")
        shutters(g, "-z", hz0, u, u + 10, 16, 32, ramp="moss", base=4)
    for u in (44, 70, 96):
        window(g, "+z", hz1, u, u + 10, 16, 32, frame="wood", glass="ember", glow=6, sill="wood")
    window(g, "-x", hx0, 50, 58, 16, 32, frame="wood", glass="ember", glow=6, sill="wood")
    window(g, "+x", hx1, 56, 66, 16, 32, frame="wood", glass="ember", glow=6, sill="wood")
    window(g, "+x", hx1, 64, 74, 56, 68, frame="wood", glass="ember", glow=6, sill="wood")
    window(g, "-x", hx0, 76, 84, 58, 68, frame="wood", glass="ember", glow=5, sill="wood")
    # the stone chimney on the -x end: a wide stack, a shoulder, a leaning flue
    stone(g, hx0 - 12, 0, 60, hx0, 58, 74, "stone", 5, block=(6, 4), seed=14)
    g.prism("y", [(hx0 - 12, 60), (hx0, 60), (hx0, 74), (hx0 - 12, 74)], 58, 64, C("stone", 5), top=[(hx0 - 9, 63), (hx0 - 1, 63), (hx0 - 1, 71), (hx0 - 9, 71)])
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(5, 3), frame=fr, seed=15))
    g.prism("y", [(hx0 - 9, 63), (hx0 - 1, 63), (hx0 - 1, 71), (hx0 - 9, 71)], 64, 106, C("stone", 5), top=[(hx0 - 14, 63), (hx0 - 6, 63), (hx0 - 6, 71), (hx0 - 14, 71)])
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(5, 3), frame=fr, seed=16))
    stone(g, hx0 - 16, 106, 61, hx0 - 4, 110, 73, "gray", 6, block=(5, 2), seed=17)
    g.box(hx0 - 13, 109, 64, hx0 - 7, 110, 70, C("ember", 6))
    # the drying rack with three pelts on the +x side
    rx = 136.0
    for z in (36, 72):
        S.bar(g, "z", (rx - 10, 1.0), (rx, 34), 2.4, z, z + 2.4, "wood", 4)
        S.bar(g, "z", (rx + 10, 1.0), (rx, 34), 2.4, z, z + 2.4, "wood", 4)
    S.disc(g, "z", rx, 33, 1.6, 33, 78, "wood", 5)
    pelt(g, rx - 1.2, 40, 10, "wood", 5, seed=18)
    pelt(g, rx - 1.2, 51, 10, "sand", 5, seed=19)
    pelt(g, rx - 1.2, 61.5, 9, "gray", 5, seed=20)
    # base props (K1): a log pile, a chopping block with an axe, a barrel
    for k, (x, y) in enumerate(((0, 0), (5, 0), (10, 0), (15, 0), (2.5, 4.3), (7.5, 4.3), (12.5, 4.3), (5, 8.6), (10, 8.6))):
        lg = S.disc(g, "z", 10 + x, 2.5 + y, 2.5, 24, 40, "wood", 4)
        P.planks(g, lg, "wood", 4, width=2, across="y", nails=False, seed=k)
        P.flat(g, lg & ((Z < 25) | (Z > 39)), "wood", 6)
        P.flat(g, lg & ((Z < 25) | (Z > 39)) & (np.hypot(X - 10 - x, Y - 2.5 - y) < 1.0), "wood", 4)
    blk = S.disc(g, "y", 22, 14, 4.5, 0, 7, "wood", 5)
    P.flat(g, blk & (Y > 6), "wood", 6)
    S.bar(g, "z", (20.5, 6.5), (25.5, 16), 1.6, 13, 15, "wood", 4)
    g.prism("z", S.rotate([(23.5, 13.5), (27.5, 13.5), (27.5, 17), (23.5, 16.5)], 25.5, 15, -28), 13, 15, C("gray", 5))
    P.flat(g, last(g) & (X > 26), "gray", 6)
    bm = barrel(g, hx1 - 2, 18, 0, 13, 5, ramp="wood", hoop="gray", base=4)
    P.flat(g, bm & (Y > 12), "wood", 6)
    pumpkin(g, hx1 - 14, 0, 16, w=9, h=7, seed=21)
    crow(g, cx + 21, 91, hz0 - 3, facing=-1)
    P.grime(g, (g.a > 0) & (Y < 12) & ~g.solid_mask(), height=4, seed=22)
    return _asset("hunters-lodge", "Hunters Lodge", g)


BUILDERS = {
    "haunted-lighthouse": haunted_lighthouse,
    "mad-lab-tower": mad_lab_tower,
    "vampire-castle-tower": vampire_castle_tower,
    "cursed-library": cursed_library,
    "haunted-schoolhouse": haunted_schoolhouse,
    "hunters-lodge": hunters_lodge,
}


def build(category, slug):
    if category != "buildings":
        raise KeyError(f"_rep_buildings builds buildings only, got {category}/{slug}")
    fn = BUILDERS.get(slug)
    if fn is None:
        from _double import legacy_world
        return legacy_world(category, slug)
    return fn()
