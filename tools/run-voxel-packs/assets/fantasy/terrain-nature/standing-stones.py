"""Standing stones in the Pirate Nation style.

A henge on a low grass mound: seven rough menhirs of grey stone stand in a
ring, each a faceted slab that tapers and leans (true slopes, rule F5), and
two taller portal stones carry a heavy lintel at the front (the oversized
function shape, rules F4, F6). The inward faces carry big glowing runes in
carved, dark-framed panels (rule C3: the accent is the magic); moss caps
the tops and drapes down the shoulders. In the middle a low altar slab on
two stubs stands inside a glowing rune circle painted on the turf, with a
worn earth path trodden through the portal. Mossy boulders, grass tufts
and wildflowers finish it. Detail is paint (rule S1).
About 60 wide and 42 tall. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _kit import prop
from _life import boulder, coords, facet_paint, grass, ngon, plan, rockface
from pnkit import edges
from voxgrid import C, Asset, Grid

SZ = (68, 46, 68)
CX = CZ = 34.0
G = 4  # the grass top of the mound
RING = 24.0  # the menhir ring radius, wide enough to show the altar
DARK = ("steel", 2)  # the theme's grey-blue (#47565f): every arris and bedding line
FRONT = -math.pi / 2  # the angle that looks to -z

# runes ('#' = stroke)
RUNES = {
    "gate": ["..#..", "#####", ".#.#.", "#.#.#", ".#.#.", "..#..", ".###.", "#...#"],
    "sun": [".###.", "#...#", "#.#.#", "#####", "#.#.#", "#...#", ".###."],
    "star": ["#...#", ".#.#.", "..#..", "#####", "..#..", ".#.#.", "#...#"],
    "flow": ["#...#", "##.##", "#.#.#", "#...#", "#...#", "##.##"],
    "fork": ["#...#", ".#.#.", "..#..", "..#..", "#.#.#", "#.#.#"],
}


def _uv_down(g: Grid, fr):
    """Facet coordinates with V growing downward on every face (vertical
    faces report V = y, which grows up)."""
    U, V = P.uv(g, fr)
    return (U, -V) if isinstance(fr, str) else (U, V)


def slab(cx: float, cz: float, half_u: float, half_v: float, ang: float, jit, grow: float = 1.0):
    """A rough six-sided slab outline (x, z): `half_u` across the broad
    face, `half_v` through it, turned so the broad face looks along `ang`."""
    unit = ((-1.0, -0.55), (0.1, -1.0), (1.0, -0.5), (0.95, 0.55), (-0.15, 1.0), (-1.0, 0.5))
    ca, sa = math.cos(ang + math.pi / 2), math.sin(ang + math.pi / 2)
    out = []
    for k, (u, v) in enumerate(unit):
        uu, vv = u * half_u * jit[k] * grow, v * half_v * jit[k] * grow
        out.append((cx + uu * ca - vv * sa, cz + uu * sa + vv * ca))
    return out


def rune(g: Grid, fm: np.ndarray, fr, rows, seed: int) -> None:
    """Carve one rune into the middle of a facet: a lit lip, a dark frame, a
    sunk field and glowing strokes that are brightest at the top."""
    U, V = _uv_down(g, fr)
    h, w = len(rows), max(len(r) for r in rows)
    if not fm.any():
        raise ValueError("rune: empty facet")
    u0 = int(round((U[fm].min() + U[fm].max() - w) / 2))
    v0 = int(V[fm].min()) + 6
    pix = np.zeros((h + 2, w + 2), bool)
    for r, row in enumerate(rows):
        for k, ch in enumerate(row):
            pix[r + 1, k + 1] = ch == "#"
    P.flat(g, fm & (U >= u0 - 3) & (U < u0 + w + 3) & (V >= v0 - 3) & (V < v0 + h + 3), "stone", 6)
    P.flat(g, fm & (U >= u0 - 2) & (U < u0 + w + 2) & (V >= v0 - 2) & (V < v0 + h + 2), "stone", 2)
    P.flat(g, fm & (U >= u0 - 1) & (U < u0 + w + 1) & (V >= v0 - 1) & (V < v0 + h + 1), "stone", 3)
    du, dv = U - (u0 - 1), V - (v0 - 1)
    inside = fm & (du >= 0) & (du < w + 2) & (dv >= 0) & (dv < h + 2)
    hit = inside & pix[np.clip(dv, 0, h + 1), np.clip(du, 0, w + 1)]
    P.flat(g, hit, "plasma", 4)
    P.flat(g, hit & (dv <= h // 2 + 1), "plasma", 6)
    if not hit.any():
        raise ValueError(f"rune {seed}: painted nothing")


def menhir(g: Grid, ang: float, r_ring: float, h: float, half_u: float, half_v: float, lean: float, seed: int,
           rune_rows=None, moss: bool = False) -> None:
    """One standing stone: two stacked sheared frustums (true slopes) that
    taper and lean outward, painted as rough rock with lit arrises, ochre
    lichen blotches and a damp foot. `rune_rows` carves a rune into its
    inward face; `moss` drapes a green cap over its crown."""
    rng = np.random.default_rng(seed)
    jit = list(0.86 + 0.28 * rng.random(6))
    cx, cz = CX + r_ring * math.cos(ang), CZ + r_ring * math.sin(ang)
    lx, lz = lean * math.cos(ang), lean * math.sin(ang)
    base = slab(cx, cz, half_u, half_v, ang, jit)
    mid = slab(cx + lx * 0.7, cz + lz * 0.7, half_u * 0.88, half_v * 0.88, ang, jit)
    cap = slab(cx + lx, cz + lz, half_u * 0.6, half_v * 0.66, ang, jit)
    y0, y1 = G - 2, G + h
    start = len(g.solids)
    m = plan(g, base, y0, y0 + (y1 - y0) * 0.72, "stone", 4, top=mid)
    m |= plan(g, mid, y0 + (y1 - y0) * 0.72, y1, "stone", 4, top=cap)
    stone = g.solids[start:]
    _X, Y, _Z = coords(g)

    def rock(gg, mm, fr):
        if fr == "top":
            P.flat(gg, mm, "stone", 5)
        else:
            rockface(gg, mm, "stone", 4, frame=fr, seed=seed)

    facet_paint(g, stone, rock)
    P.flat(g, m & S.seams(g, stone, 0.6), "stone", 6)  # lit arrises
    P.flat(g, edges(m), *DARK)  # dark framing, so overlapping slabs read apart
    P.flat(g, m & (Y < G + 2), *DARK)
    faces = S.facets(g, stone)
    # a calm face: a few bedding lines and a small number of lichen patches,
    # all in the theme's greys and greens. No orange camo (finding P0, C1).
    for fmask, fr in faces:
        U, V = P.uv(g, fr)
        P.flat(g, fmask & ((V % 9) == 0) & ((P._hash(U // 6, V // 9, seed=seed + 2) % np.uint64(3)) != 0), "stone", 2)
        h = P._hash(U // 5, V // 4, seed=seed + 5) % np.uint64(13)
        P.flat(g, fmask & (h == 0), "moss", 3)
        P.flat(g, fmask & (h == 0) & ((V % 4) < 2), "moss", 4)
    if rune_rows is not None:
        # the rune goes on the facet whose outward normal looks at the ring centre
        best, score = None, -1.0
        for fmask, fr in faces:
            if fr == "top" or not fmask.any():
                continue
            u, v = (np.array(fr[0]), np.array(fr[1]))
            n = np.cross(u, v)  # outward normal of the face
            toward = -(n[0] * math.cos(ang) + n[2] * math.sin(ang))
            area = float((fmask & (Y > G + 3) & (Y < y1 - 3)).sum())
            if toward > 0.55 and area > score:
                best, score = (fmask, fr), area
        if best is None:
            raise ValueError(f"menhir {seed}: no inward facet for a rune")
        rune(g, best[0] & (Y < y1 - 2), best[1], rune_rows, seed)
    if moss:  # a thin moss cap with a ragged hem on the weather side only
        capm = stone[-1].mask(g.shape) & (Y > y1 - 2)
        P.flat(g, capm, "moss", 5)
        for fmask, fr in faces:
            if fr == "top":
                continue
            U, V = P.uv(g, fr)
            sel = fmask & ~capm
            if not sel.any():
                continue
            v0 = V[sel].min()
            drip = (P._hash(U // 3, seed=seed + 11) % np.uint64(3)).astype(int)
            P.flat(g, sel & (V < v0 + drip), "moss", 4)
            P.flat(g, sel & (V == v0 + drip - 1) & (drip > 0), "moss", 2)
    P.flat(g, m & (Y < G + 1), "moss", 4)  # the damp foot in the turf


def lintel(g: Grid, a0: float, a1: float, y0: float, h: float) -> None:
    """The heavy capstone across the two portal stones: a tapered block
    (true slopes) with big painted blocks and a mossy top."""
    p0 = (CX + RING * math.cos(a0), CZ + RING * math.sin(a0))
    p1 = (CX + RING * math.cos(a1), CZ + RING * math.sin(a1))
    ux, uz = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(ux, uz)
    ux, uz = ux / n, uz / n
    nx, nz = -uz, ux
    ext, half = 5.0, 4.2
    poly = [(p0[0] - ux * ext + nx * half, p0[1] - uz * ext + nz * half),
            (p1[0] + ux * ext + nx * half, p1[1] + uz * ext + nz * half),
            (p1[0] + ux * ext - nx * half, p1[1] + uz * ext - nz * half),
            (p0[0] - ux * ext - nx * half, p0[1] - uz * ext - nz * half)]
    top = [(x * 0.94 + (p0[0] + p1[0]) / 2 * 0.06, z * 0.94 + (p0[1] + p1[1]) / 2 * 0.06) for x, z in poly]
    start = len(g.solids)
    m = plan(g, poly, y0, y0 + h, "stone", 5, top=top)
    _X, Y, _Z = coords(g)
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(9, 4), cracks=0.12, frame=fr, seed=31))
    P.flat(g, m & S.seams(g, g.solids[start:], 0.7), "stone", 6)
    P.flat(g, edges(m), *DARK)
    P.flat(g, m & (Y < y0 + 1.2), *DARK)
    cap = m & (Y > y0 + h - 1.0)
    U, V = P.uv(g, "top")  # the capstone top: moss worn through to bare stone
    P.flat(g, cap, "moss", 3)
    P.flat(g, cap & ((P._hash(U // 4, V // 4, seed=33) % np.uint64(3)) == 0), "moss", 4)
    P.flat(g, cap & ((P._hash(U // 5, V // 5, seed=34) % np.uint64(6)) == 0), "stone", 4)
    P.flat(g, cap & ((P._hash(U // 5, V // 5, seed=34) % np.uint64(6)) == 0) & ((U % 5) == 0), "moss", 2)


def altar(g: Grid) -> None:
    """The low altar in the middle: two stub stones under a thick slab with
    a carved basin and a glowing rune on its face."""
    X, Y, Z = coords(g)
    for s in (-1, 1):
        plan(g, ngon(CX + s * 4.5, CZ, 3.0, 6, 0.3), G - 1, G + 5, "stone", 4, top=ngon(CX + s * 4.5, CZ, 2.6, 6, 0.3))
        P.stone(g, S.last(g), "stone", 4, block=(5, 3), seed=40 + s)
    start = len(g.solids)
    slab_m = plan(g, [(CX - 10, CZ - 6), (CX + 10, CZ - 6), (CX + 10, CZ + 6), (CX - 10, CZ + 6)], G + 5, G + 9, "stone", 5,
                  top=[(CX - 9, CZ - 5), (CX + 9, CZ - 5), (CX + 9, CZ + 5), (CX - 9, CZ + 5)])
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(7, 4), frame=fr, seed=42))
    P.flat(g, slab_m & (Y > G + 8), "stone", 6)
    P.flat(g, edges(slab_m), *DARK)
    bowl = slab_m & (Y > G + 8) & (np.abs(X - CX) < 5.5) & (np.abs(Z - CZ) < 3.0)
    P.flat(g, bowl, "stone", 3)
    P.flat(g, bowl & (np.abs(X - CX) < 4.5) & (np.abs(Z - CZ) < 2.0), "plasma", 5)
    P.flat(g, bowl & (np.abs(X - CX) < 2.6) & (np.abs(Z - CZ) < 1.2), "plasma", 7)
    P.flat(g, slab_m & (Y < G + 6), "stone", 3)


def build() -> Asset:
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    Xi, Zi = np.floor(X).astype(np.int64), np.floor(Z).astype(np.int64)
    jit = [1.0, 0.96, 1.04, 0.97, 1.03, 0.95, 1.05, 0.98, 1.02, 0.96, 1.04, 0.97]
    # the mound: an earth ledge under a grass tier (true slopes)
    ledge = plan(g, ngon(CX, CZ, 31.0, 12, 0.15, jit), 0, 2, "wood", 3, top=ngon(CX, CZ, 30.0, 12, 0.15, jit))
    P.stone(g, ledge, "wood", 3, block=(6, 2), cracks=0.0, seed=1)
    P.flat(g, ledge & (Y < 1), "wood", 1)
    P.flat(g, ledge & (Y >= 1) & (P._hash((Xi + Zi) // 3, seed=2) % np.uint64(5) == 0), "stone", 5)
    tier = plan(g, ngon(CX, CZ, 30.0, 12, 0.15, jit), 2, G, "leaf", 3, top=ngon(CX, CZ, 29.0, 12, 0.15, jit))
    top = tier & (Y > G - 1)
    d = np.hypot(X - CX, Z - CZ)
    P.flat(g, top, "leaf", 3)
    for bx, bz, br, ramp, sh in ((CX - 14, CZ - 9, 10.0, "moss", 5), (CX + 13, CZ + 12, 9.0, "moss", 4),
                                 (CX + 15, CZ - 12, 8.0, "leaf", 4), (CX - 12, CZ + 15, 7.0, "forest", 4)):
        P.flat(g, top & (np.hypot(X - bx, Z - bz) < br), ramp, sh)
    P.flat(g, top & (d > 27.5), "moss", 6)  # the lit grass lip
    # a worn earth path trodden in through the portal to the altar
    path = top & (np.abs(X - CX) < 6.5 - np.abs(Z - CZ) * 0.06) & (Z < CZ) & (d < 27.0)
    P.flat(g, path & (P._hash(Xi // 2, Zi // 2, seed=3) % np.uint64(4) != 0), "wood", 4)
    P.flat(g, path & (np.abs(X - CX) < 4.0), "wood", 3)
    # the glowing rune circle painted on the turf round the altar
    P.flat(g, top & (d > 12.0) & (d < 13.6), "plasma", 5)
    P.flat(g, top & (d > 12.3) & (d < 13.3) & ((np.floor(np.arctan2(Z - CZ, X - CX) * 6).astype(np.int64) % 3) == 0), "plasma", 7)
    P.flat(g, top & (d > 15.4) & (d < 16.2), "plasma", 4)
    # seven ring stones, then the two taller portal stones and their lintel
    ring_spec = ((1, 19.0, 5.6, 3.0, 2.2, 11, "sun", True), (2, 15.0, 5.0, 2.8, -1.8, 12, None, False), (3, 21.0, 6.2, 3.2, 2.8, 13, "star", False),
                 (4, 16.0, 4.6, 2.6, 1.4, 14, None, True), (5, 20.0, 5.8, 3.0, -2.4, 15, "flow", False), (6, 14.0, 4.4, 2.4, 2.0, 16, None, True),
                 (7, 18.0, 5.2, 2.8, 1.6, 17, "fork", False))
    for k, h, hu, hv, lean, seed, rname, mossy in ring_spec:
        menhir(g, FRONT + 2 * math.pi * k / 8, RING, h, hu, hv, lean, seed, RUNES.get(rname) if rname else None, moss=mossy)
    a_l, a_r = FRONT - 0.30, FRONT + 0.30
    menhir(g, a_l, RING, 30.0, 6.4, 3.6, 1.2, 21, RUNES["gate"])
    menhir(g, a_r, RING, 30.0, 6.4, 3.6, 1.2, 22, RUNES["gate"])
    lintel(g, a_l, a_r, G + 29.0, 5.0)
    altar(g)
    # mossy boulders, grass tufts and wildflowers on the turf
    for bx, bz, r, h, seed in ((CX - 19, CZ + 7, 3.2, 4.6, 51), (CX + 17, CZ - 4, 2.6, 3.6, 52), (CX + 6, CZ + 19, 2.2, 3.0, 53)):
        boulder(g, bx, bz, G - 1, r, h, ramp="stone", base=4, n=6, seed=seed, moss="moss", moss_drape=0.4)
    grass(g, [(int(CX) - 24, G, int(CZ) + 2), (int(CX) + 22, G, int(CZ) + 9), (int(CX) + 9, G, int(CZ) + 24),
              (int(CX) - 10, G, int(CZ) - 22), (int(CX) + 20, G, int(CZ) - 16), (int(CX) - 20, G, int(CZ) + 17)], "leaf", 5)
    for fx, fz, ramp in ((CX - 16, CZ + 3, "gold"), (CX + 11, CZ + 15, "magenta"), (CX - 7, CZ + 21, "sky"),
                         (CX + 18, CZ + 4, "gold"), (CX - 21, CZ - 10, "magenta")):
        x, z = int(fx), int(fz)
        g.box(x, G, z, x + 1, G + 2, z + 1, C("leaf", 2))
        g.box(x, G + 2, z, x + 1, G + 3, z + 1, C(ramp, 6))
        g.box(x + 1, G, z + 1, x + 2, G + 1, z + 2, C("leaf", 4))
    return prop("fantasy-terrain-nature-standing-stones", "Standing Stones", g,
                sockets_at={"socket-runes": (CX, G + 12.0, CZ)},
                pfx=[{"effectId": "rvx-fantasy-arcane-orbit", "socket": "socket-runes", "trigger": "idle", "size": 30}])
