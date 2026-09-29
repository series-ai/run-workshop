"""Rune stone in the Pirate Nation style.

One iconic shape (rule K3): a tall leaning menhir built as a faceted
frustum (true slopes; the top is offset, so the stone leans, rule F5),
painted as coursed grey-blue stone with a column of glowing cyan runes on
its faces (rule C3: the accent is the magic). A moss cap sits on top
and it stands on a grassy mound ringed by small stones and flowers.
About 27 wide and 30 tall.
"""

import numpy as np

import paint as P
from _props import coords, slope_glyph
from pnkit import box
from pnshapes import facets, flat_ngon, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 30, 34, 28
CX, CZ = 15, 14


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    base = [(CX - 6, CZ - 4), (CX + 1, CZ - 5.5), (CX + 6, CZ - 3), (CX + 5.5, CZ + 4), (CX - 1, CZ + 5), (CX - 6.5, CZ + 3)]
    top = [(x * 0.6 + (CX + 3) * 0.4, z * 0.55 + (CZ + 1) * 0.45) for x, z in base]
    # a low grassy mound (a faceted frustum) the stones stand on
    g.prism("y", flat_ngon(CX, CZ, 13.5, 8), 0, 2, C("leaf", 4), top=flat_ngon(CX, CZ, 12.0, 8))
    mound = last(g)
    P.flat(g, mound & (P._hash(np.floor(X).astype(int), np.floor(Z).astype(int), seed=4) % np.uint64(5) == 0), "leaf", 5)
    P.flat(g, mound & (Y < 1), "leaf", 3)
    g.prism("y", base, 2, 28, C("stone", 5), top=top)
    stone = [g.solids[-1]]
    m = last(g)
    faces = facets(g, stone)
    for fm, fr in faces:
        P.stone(g, fm, "stone", 5, block=(8, 6), cracks=0.15, frame=fr, seed=2)
    P.flat(g, m & (Y > 25), "leaf", 4)  # moss cap
    P.flat(g, m & (Y > 23) & (Y <= 25) & (np.floor(X + Z) % 3 != 0), "leaf", 3)
    P.flat(g, m & (Y < 4) & (np.floor(X - Z) % 3 == 0), "leaf", 3)
    # glowing runes: a column on the front facet, and one on each side facet
    def facet_toward(dx, dz):
        return max(faces, key=lambda f: (f[0] & ((X - CX) * dx + (Z - CZ) * dz > 3)).sum())
    for (dx, dz), runes in (((0, -1), ("rune-a", "rune-c", "rune-b", "rune-e")), ((1, 0), ("rune-d", "rune-b")), ((-1, 0), ("rune-e", "rune-a"))):
        fm, fr = facet_toward(dx, dz)
        U, V = P.uv(g, fr)
        u_mid = int(np.median(U[fm]))
        v_top = int(V[fm].min())
        for k, rune in enumerate(runes):
            slope_glyph(g, fm, fr, u_mid - 1, v_top + 4 + k * 5, rune, "cyan", 6)
    # a ring of small stones and a few flowers on the mound
    for k in range(9):
        a = 2 * np.pi * k / 9 + 0.3
        sx, sz = CX + np.cos(a) * 10.0, CZ + np.sin(a) * 9.5
        h = 2 + (k % 3)
        g.prism("y", [(sx - 1.5, sz - 1.5), (sx + 1.5, sz - 1.5), (sx + 1.5, sz + 1.5), (sx - 1.5, sz + 1.5)], 2, 2 + h, C("stone", 4 + k % 2), top=[(sx - 0.8, sz - 0.8), (sx + 0.8, sz - 0.8), (sx + 0.8, sz + 0.8), (sx - 0.8, sz + 0.8)])
    for k, (fx, fz) in enumerate(((CX - 7, CZ - 7), (CX + 6, CZ - 8), (CX + 8, CZ + 5), (CX - 8, CZ + 5))):
        box(g, fx, 2, fz, fx + 1, 5, fz + 1, "leaf", 5)
        box(g, fx - 1, 5, fz - 1, fx + 2, 6, fz + 2, ("magenta", "gold", "sky", "red")[k], 5)
    root = Part("rune-stone", g)
    return Asset(id="fantasy-props-rune-stone", pack="fantasy", category="props", name="Rune Stone", root=root)
