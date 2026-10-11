"""Rune stone in the Pirate Nation style.

One iconic shape (rule K3): a tall leaning menhir of grey-blue stone (a
faceted frustum with a rounded capstone; true slopes, and the top is
offset, so it leans, rule F5). The front carries one big glowing cyan rune
in a carved, dark-framed panel (rule C3: the accent is the magic); the
side faces carry smaller runes. Moss drapes over the cap with a ragged,
dark-edged hem. It stands on a stepped mound: an earth ledge, a grass
tier with worn soil round the foot, three mossy boulders, a cluster of
toadstools, wildflowers, and a gold offering bowl of glowing embers in
front of the rune. About 30 wide and 32 tall.
"""
import math

import numpy as np

import paint as P
from _life import boulder, facet_paint
from _props import coords
from pnshapes import facets, flat_ngon, last, seams
from voxgrid import C, Asset, Grid, Part

W, H, D = 32, 34, 30
CX, CZ = 16, 15
G = 3  # ground top

# the big front rune ('#' = stroke)
RUNE = [
    "...#...",
    ".#####.",
    ".#.#.#.",
    ".#.#.#.",
    "...#...",
    "#######",
    "...#...",
    ".##.##.",
    ".#...#.",
    ".#...#.",
]
SMALL = {
    "a": ["#..#", "#.#.", "##..", "#.#.", "#..#"],
    "b": [".#.", "###", ".#.", "#.#", "#.#"],
    "c": ["#.#", "###", ".#.", ".#.", ".#."],
    "d": ["#..", "##.", "#.#", "##.", "#.."],
}


def _uv_down(g: Grid, fr):
    """Facet pattern coordinates with V growing downward on every face
    (vertical faces report V = y, which grows up)."""
    U, V = P.uv(g, fr)
    return (U, -V) if isinstance(fr, str) else (U, V)


def _rune(g: Grid, fm, fr, rows, u0: int, v0: int, panel: bool) -> None:
    """Paint a rune on a facet: glowing strokes, brightest at the top, and
    with `panel` a carved dark field inside a dark frame with a lit lip."""
    U, V = _uv_down(g, fr)
    h, w = len(rows), max(len(r) for r in rows)
    pix = np.zeros((h + 2, w + 2), bool)
    for r, row in enumerate(rows):
        for k, ch in enumerate(row):
            pix[r + 1, k + 1] = ch == "#"
    du, dv = U - (u0 - 1), V - (v0 - 1)
    inside = fm & (du >= 0) & (du < w + 2) & (dv >= 0) & (dv < h + 2)
    if panel:
        pu0, pu1, pv0, pv1 = u0 - 2, u0 + w + 2, v0 - 2, v0 + h + 2
        box = fm & (U >= pu0 - 1) & (U < pu1 + 1) & (V >= pv0 - 1) & (V < pv1 + 1)
        P.flat(g, box, "steel", 6)  # lit lip of the carving
        field = fm & (U >= pu0) & (U < pu1) & (V >= pv0) & (V < pv1)
        P.flat(g, field, "steel", 1)  # dark frame
        P.flat(g, fm & (U > pu0) & (U < pu1 - 1) & (V > pv0) & (V < pv1 - 1), "steel", 2)  # carved field
    sel_u = np.clip(du, 0, w + 1)
    sel_v = np.clip(dv, 0, h + 1)
    P.flat(g, inside & pix[sel_v, sel_u], "plasma", 4)
    if panel:
        P.flat(g, inside & pix[sel_v, sel_u] & (dv <= 3), "plasma", 6)  # brightest at the top
    else:
        P.flat(g, inside & pix[sel_v, sel_u], "plasma", 3)


def _toadstool(g: Grid, x, z, h, r, cap: str, spot) -> None:
    """A small toadstool on the ground: a cream stem and a two-step faceted
    cap with a dark lip and painted spots."""
    X, Y, Z = coords(g)
    g.prism("y", flat_ngon(x, z, max(0.8, r * 0.35), 6), G, G + h - 1, C("bone", 5))
    yc = G + h - 2
    start = len(g.solids)
    g.prism("y", flat_ngon(x, z, r, 8), yc, yc + 1, C(cap, 3), top=flat_ngon(x, z, r, 8))
    m = last(g)
    g.prism("y", flat_ngon(x, z, r, 8), yc + 1, yc + 3, C(cap, 4), top=flat_ngon(x, z, r * 0.45, 8))
    m |= last(g)
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.flat(gg, mm, cap, 5 if fr == "top" else 4))
    P.flat(g, m & (Y < yc + 1), cap, 2)  # dark lip
    for a in (0.4, 2.5, 4.4):
        d = np.sqrt((X - x - r * 0.55 * math.cos(a)) ** 2 + (Y - yc - 1.8) ** 2 + (Z - z - r * 0.55 * math.sin(a)) ** 2)
        P.flat(g, m & (d < 0.9) & (Y > yc + 1), *spot)


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Zi = np.floor(X).astype(int), np.floor(Z).astype(int)
    # stepped mound: an earth ledge, then a grass tier
    g.prism("y", flat_ngon(CX, CZ, 14.5, 8), 0, 2, C("wood", 3), top=flat_ngon(CX, CZ, 14.0, 8))
    ledge = last(g)
    P.stone(g, ledge, "wood", 3, block=(6, 2), mortar=-1, cracks=0.0, seed=4)
    P.flat(g, ledge & (Y < 1), "wood", 1)
    P.flat(g, ledge & (Y >= 1) & (P._hash((Xi + Zi) // 3, seed=7) % np.uint64(6) == 0), "stone", 5)  # stones in the earth
    g.prism("y", flat_ngon(CX, CZ, 13.0, 8), 2, G, C("leaf", 3), top=flat_ngon(CX, CZ, 12.5, 8))
    tier = last(g)
    top = tier
    P.flat(g, top, "leaf", 3)
    for bx, bz, br, ramp, sh in ((CX - 7, CZ - 4, 4.5, "moss", 5), (CX + 6, CZ + 6, 4.0, "moss", 4), (CX + 8, CZ - 5, 3.5, "leaf", 4), (CX - 6, CZ + 7, 3.5, "forest", 4)):
        P.flat(g, top & (np.hypot(X - bx, Z - bz) < br), ramp, sh)
    P.flat(g, top & (np.hypot(X - CX, Z - CZ) > 11.4), "moss", 6)  # lit grass lip
    P.flat(g, top & (np.hypot(X - CX - 0.5, Z - CZ) < 9.3) & (np.hypot(X - CX - 0.5, Z - CZ) > 6.0) & (Z < CZ - 3), "wood", 4)  # trodden soil in front
    P.flat(g, top & (np.hypot(X - CX - 0.5, Z - CZ) < 8.8) & (P._hash(Xi // 2, Zi // 2, seed=9) % np.uint64(3) != 0), "wood", 4)  # soil round the foot
    # the menhir: a leaning faceted frustum with a flat front face, and a rounded capstone
    base = [(CX - 6.5, CZ - 5.0), (CX + 6.0, CZ - 5.0), (CX + 8.0, CZ - 0.5), (CX + 5.5, CZ + 5.0), (CX - 5.0, CZ + 5.5), (CX - 8.0, CZ + 0.5)]
    lean = (CX + 1.5, CZ + 0.8)
    mid = [(x * 0.66 + lean[0] * 0.34, z * 0.66 + lean[1] * 0.34) for x, z in base]
    mid[0] = (mid[0][0], base[0][1])  # the rune face stays vertical (the stone leans back and right)
    mid[1] = (mid[1][0], base[1][1])
    cap = [(x * 0.4 + (lean[0] + 0.5) * 0.6, z * 0.4 + (lean[1] + 0.5) * 0.6) for x, z in base]
    start = len(g.solids)
    g.prism("y", base, G - 1, 27, C("steel", 4), top=mid)
    g.prism("y", mid, 27, 31, C("steel", 4), top=cap)
    stone = g.solids[start:]
    m = g.solids[start].mask(g.shape) | g.solids[start + 1].mask(g.shape)
    faces = facets(g, stone)

    def rock(gg, mm, fr):
        if fr == "top":
            P.flat(gg, mm, "steel", 5)
            return
        U, V = P.uv(gg, fr)
        _x, yy, _z = coords(gg)
        sh = np.where(yy > 25, 5, 4)  # calm stone, lit under the moss
        crack = (P._hash(U // 7, seed=5) % np.uint64(3) == 0) & (((U + V // 2) % 7) == 0) & (P._hash(U // 7, V // 5, seed=6) % np.uint64(2) == 0)
        P._paint(gg, mm, "steel", np.where(crack, 2, sh))

    facet_paint(g, stone, rock)
    P.flat(g, m & seams(g, stone, 0.5), "steel", 6)  # lit arrises
    P.flat(g, m & (Y < G + 2), "steel", 3)  # damp, darker foot
    P.flat(g, m & (Y < G + 1), "moss", 3)
    # runes: one big framed rune on the front, smaller ones on the side faces
    def facet_toward(dx, dz):
        return max(faces, key=lambda f: (f[0] & ((X - CX) * dx + (Z - CZ) * dz > 3) & (Y < 26)).sum())

    def place(fm, fr, rows, v_from: int, panel: bool):
        U, V = _uv_down(g, fr)
        band = fm & (V >= V[fm].min() + v_from) & (V < V[fm].min() + v_from + len(rows))
        u_mid = int(np.median(U[band]))
        _rune(g, fm, fr, rows, u_mid - len(rows[0]) // 2, int(V[fm].min()) + v_from, panel)

    fm, fr = facet_toward(0, -1)
    place(fm, fr, RUNE, 8, True)
    for (dx, dz), names in (((1, 0), ("a", "c")), ((-1, 0), ("d", "b")), ((0, 1), ("c", "a"))):
        fm2, fr2 = facet_toward(dx, dz)
        for k, n in enumerate(names):
            place(fm2, fr2, SMALL[n], 9 + k * 7, False)
    # moss over the capstone, draping down each face with a ragged dark hem
    capm = g.solids[start + 1].mask(g.shape) & (Y > 29)
    P.flat(g, capm, "moss", 5)
    P.flat(g, capm & (Y > 30), "moss", 6)
    for fm, fr in faces:
        if fr == "top":
            continue
        U, V = P.uv(g, fr)
        v0 = V[fm & ~capm].min() if (fm & ~capm).any() else V[fm].min()
        drip = (P._hash(U // 2, seed=13) % np.uint64(5)).astype(int) - (P._hash(U // 3, seed=14) % np.uint64(2)).astype(int)
        drape = fm & ~capm & (V < v0 + drip)
        P.flat(g, drape, "moss", 4)
        P.flat(g, fm & ~capm & (V == v0 + drip), "moss", 2)  # dark hem
    # three mossy grey-blue boulders, clustered, not a ring
    for bx, bz, r, h, seed in ((CX - 9.0, CZ - 4.0, 2.4, 3.5, 1), (CX + 9.0, CZ + 1.5, 2.8, 4.5, 2), (CX - 7.5, CZ + 6.5, 1.8, 2.5, 3)):
        boulder(g, bx, bz, G - 1, r, h, ramp="steel", base=4, n=6, seed=seed, moss="moss", moss_drape=0.35)
    # toadstools in a little cluster at the back right
    for x, z, h, r, cap_c, spot in ((CX + 6.0, CZ + 8.5, 5, 2.2, "red", ("bone", 7)), (CX + 8.5, CZ + 6.8, 4, 1.7, "orange", ("bone", 7)),
                                    (CX + 3.6, CZ + 9.6, 3, 1.4, "red", ("bone", 7))):
        _toadstool(g, x, z, h, r, cap_c, spot)
    # wildflowers
    for k, (fx, fz, ramp) in enumerate(((CX - 10, CZ + 1, "gold"), (CX + 2, CZ + 11, "sky"), (CX - 3, CZ + 10, "magenta"), (CX + 10, CZ - 6, "gold"))):
        g.box(fx, G, fz, fx + 1, G + 2, fz + 1, C("leaf", 2))
        g.box(fx, G + 2, fz, fx + 1, G + 3, fz + 1, C(ramp, 6))
        g.box(fx + 1, G, fz, fx + 2, G + 1, fz + 1, C("leaf", 4))
    # the offering in front of the rune: two candles and a gold bowl with a glowing ember
    g.prism("y", flat_ngon(CX + 0.5, CZ - 8.5, 1.5, 8), G, G + 1, C("gold", 3), top=flat_ngon(CX + 0.5, CZ - 8.5, 1.5, 8))
    g.prism("y", flat_ngon(CX + 0.5, CZ - 8.5, 2.0, 8), G + 1, G + 3, C("gold", 4), top=flat_ngon(CX + 0.5, CZ - 8.5, 2.6, 8))
    bowl = last(g)
    P.flat(g, bowl & (Y > G + 2), "gold", 6)
    g.box(CX - 1, G + 3, CZ - 10, CX + 2, G + 4, CZ - 7, C("red", 4))  # embers heaped in the bowl
    g.box(CX, G + 3, CZ - 9, CX + 1, G + 5, CZ - 8, C("orange", 5))
    g.box(CX, G + 5, CZ - 9, CX + 1, G + 6, CZ - 8, C("gold", 7))  # a small flame
    return Asset(id="fantasy-props-rune-stone", pack="fantasy", category="props", name="Rune Stone", root=Part("rune-stone", g))
