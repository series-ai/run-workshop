"""Elven ruin in the Pirate Nation style.

A broken elven gateway on a chamfered plinth: two octagonal pillars that
taper (frustums), one whole with a flared capital and the first half of
a pointed arch (voussoir segments: true slopes), the other snapped off at
a slant. Fallen arch blocks lie tilted in the grass. Pale cream elven
stone painted as dressed blocks, gold bands, glowing magic-cyan rune
strips on the pillar fronts (the PN rune archway), ivy hanging from the
arch and moss on the tops. About 72 wide and 76 tall. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _life import asset, chamfer_rect, coords, facet_paint, front, grass, ngon, plan
from pnkit import box, edges
from voxgrid import C, Grid, Part

W, H, D = 84, 90, 38
CZ = 19.0
LX, RX = 17.0, 63.0  # pillar centres
PR = 7.0  # pillar shaft radius at the foot
BASE_Y = 5  # plinth top
CAP_Y = 50  # left capital bottom
APEX = (40.0, 82.0)
STONE, SB = "sand", 4  # pale warm elven stone


def dressed(g, mask, frame=None, seed=0, base=SB):
    P.stone(g, mask, STONE, base, block=(6, 4), cracks=0.1, frame=frame, seed=seed)


def plinth(g: Grid) -> np.ndarray:
    X, Y, Z = coords(g)
    m = plan(g, chamfer_rect(3, CZ - 14, W - 3, CZ + 14, 4), 0, 3, "stone", 5)
    m |= plan(g, chamfer_rect(6, CZ - 11, W - 6, CZ + 11, 3), 3, BASE_Y, STONE, SB)
    facet_paint(g, g.solids[-2:], lambda gg, mm, fr: dressed(gg, mm, fr, seed=1))
    P.flat(g, m & (Y < 1), "stone", 4)
    # moss creeping on the steps (a band with a wavy edge, not speckle)
    wave = (P._hash(np.floor(X).astype(int) // 4, seed=3) % np.uint64(3)).astype(float)
    P.flat(g, m & (Y < 1.5 + wave) & (np.floor(X).astype(int) % 11 < 6), "leaf", 4)
    return m


def pillar(g: Grid, cx: float, top: float, broken: bool) -> np.ndarray:
    X, Y, Z = coords(g)
    start = len(g.solids)
    m = plan(g, chamfer_rect(cx - 10, CZ - 10, cx + 10, CZ + 10, 2.5), BASE_Y, BASE_Y + 6, STONE, SB)  # square base block
    shaft_top = top if not broken else top
    m |= plan(g, ngon(cx, CZ, PR / math.cos(math.pi / 8), 8, math.pi / 8), BASE_Y + 6, shaft_top, STONE, SB + 1,
              top=ngon(cx, CZ, (PR - 1.2) / math.cos(math.pi / 8), 8, math.pi / 8))
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: dressed(gg, mm, fr, seed=int(cx), base=SB if fr == "top" else SB + 1))
    # gold bands on the shaft
    for by in (BASE_Y + 6, BASE_Y + 26):
        P.flat(g, m & (Y > by) & (Y < by + 2) & (np.hypot(X - cx, Z - CZ) > PR - 3), "gold", 5)
    # a glowing rune strip on the front facet
    face = CZ - PR + 0.6
    strip = m & (Z < face + 0.8) & (np.abs(X - cx) < 2.6) & (Y > BASE_Y + 9) & (Y < min(shaft_top - 3, BASE_Y + 42))
    P.flat(g, strip, "blue", 2)
    P.flat(g, strip & (np.abs(X - cx) > 2.0), "gold", 5)
    return m


def capital(g: Grid, cx: float, y0: float) -> np.ndarray:
    """A flared capital (a frustum) and an abacus block the arch springs from."""
    X, Y, Z = coords(g)
    start = len(g.solids)
    m = plan(g, ngon(cx, CZ, 6.0 / math.cos(math.pi / 8), 8, math.pi / 8), y0, y0 + 5, STONE, SB + 1,
             top=chamfer_rect(cx - 10, CZ - 9, cx + 10, CZ + 9, 2))
    m |= plan(g, chamfer_rect(cx - 10, CZ - 9, cx + 10, CZ + 9, 2), y0 + 5, y0 + 9, STONE, SB)
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: dressed(gg, mm, fr, seed=7))
    P.flat(g, m & (Y > y0 + 5) & (Y < y0 + 6.5), "gold", 5)
    return m


def arch_half(g: Grid, cx: float, spring: float, segs: int, keep: int, seed: int = 0) -> np.ndarray:
    """The first `keep` of `segs` voussoirs of one half of a pointed arch,
    from (cx, spring) up toward the apex: each a quad prism between an
    inner and an outer circle whose centre lies on the spring line (so the
    arch rises vertically from the capital). The last block ends in a
    slanted break."""
    m = np.zeros(g.shape, dtype=bool)
    ax, ay = APEX
    dx, dy = ax - cx, ay - spring
    r = (dx * dx + dy * dy) / (2 * abs(dx))
    c = (cx + math.copysign(r, dx), spring)
    a0 = math.atan2(0.0, cx - c[0])  # pi on the left half, 0 on the right half
    a1 = math.atan2(ay - c[1], ax - c[0])
    t = 5.5  # half thickness of the arch ring

    def at(rad, ang):
        return (c[0] + rad * math.cos(ang), c[1] + rad * math.sin(ang))

    for k in range(keep):
        b0 = a0 + (a1 - a0) * k / segs
        b1 = a0 + (a1 - a0) * (k + 1) / segs
        b1o = b0 + (b1 - b0) * 0.45 if k == keep - 1 else b1  # the break slants
        pts = [at(r - t, b0), at(r + t, b0), at(r + t, b1o), at(r - t, b1)]
        seg = front(g, pts, CZ - 7, CZ + 7, STONE, SB + (k % 2))
        facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: dressed(gg, mm, fr, seed=seed + k, base=SB + (k % 2)))
        m |= seg
    return m


def fallen(g: Grid) -> np.ndarray:
    """Tilted arch blocks lying in the grass (rotated prisms)."""
    m = np.zeros(g.shape, dtype=bool)
    for (x, y, ang, w, h, z0, z1) in ((44, BASE_Y, 18, 9, 6, CZ - 11, CZ - 3), (70, 0, -12, 8, 5, 4, 12), (31, BASE_Y, -8, 6, 4, CZ + 3, CZ + 9)):
        pts = S.rotate([(x - w / 2, y), (x + w / 2, y), (x + w / 2, y + h), (x - w / 2, y + h)], x, y, ang)
        pts = [(u, max(float(y), v)) for u, v in pts]
        blk = front(g, pts, z0, z1, STONE, SB)
        facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: dressed(gg, mm, fr, seed=int(x)))
        m |= blk
    return m


def build():
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    plinth(g)
    lp = pillar(g, LX, CAP_Y, broken=False)
    capital(g, LX, CAP_Y)
    rp = pillar(g, RX, CAP_Y - 6, broken=False)
    capital(g, RX, CAP_Y - 6)
    # the arch: both halves stand, the crown has fallen (a wide gap at the top)
    arch = arch_half(g, LX + 2, CAP_Y + 9, 8, 5, seed=20)
    arch |= arch_half(g, RX - 2, CAP_Y + 3, 8, 4, seed=30)
    fallen(g)
    # ivy hanging over the arch, the capital and the broken pillar, with pink flowers
    occ = g.a > 0
    Xi, Yi = np.floor(X).astype(int), np.floor(Y).astype(int)
    for x0, top, length in ((11, CAP_Y + 10, 22), (22, CAP_Y + 12, 12), (27, CAP_Y + 22, 18), (56, CAP_Y + 12, 14), (64, CAP_Y + 3, 10), (69, CAP_Y + 3, 18)):
        wig = np.where((Yi // 3) % 2 == 0, 0.0, 1.0)
        strand = occ & (np.abs(X - x0 - 0.5 - wig) < 1.2) & (Y < top) & (Y > top - length) & (Z < CZ)
        P.flat(g, strand, "leaf", 4)
        P.flat(g, strand & (Yi % 3 == 0), "leaf", 5)
        P.flat(g, strand & (Yi % 5 == 2) & (Xi % 2 == 0), "pink", 3)
    # a grass mat around the plinth and moss on its top step
    mat = plan(g, chamfer_rect(0, CZ - 17, W, CZ + 17, 6), 0, 1, "leaf", 4)
    P.flat(g, mat & ((P._hash(Xi // 3, np.floor(Z).astype(int) // 3, seed=5) % np.uint64(3)) == 0), "leaf", 5)
    top = occ & (Y > BASE_Y - 1) & (Y < BASE_Y) & ((P._hash(Xi // 4, np.floor(Z).astype(int) // 4, seed=6) % np.uint64(3)) == 0)
    P.flat(g, top, "leaf", 4)
    # runes: glowing magic cyan on the dark strips (painted glyphs, rule S1)
    rune = ["#.#", ".#.", "###", "...", "#.#", "###", ".#.", "...", "##.", ".##", "#.#", "...", "###", "#.#", ".#."]
    for cx, h in ((LX, 15), (RX, 15)):
        pnglyph.stamp(g, "-z", CZ - PR + 1, int(cx) - 1, BASE_Y + 11, rune[-h:], {"#": C("cyan", 6)}, reach=3)
    # a gold elven leaf crest on the capital
    leaf = ["..#..", ".###.", "#####", ".###.", "..#.."]
    pnglyph.stamp(g, "-z", CZ - 9, int(LX) - 2, CAP_Y + 1, leaf, {"#": C("gold", 6)}, reach=3)
    grass(g, [(8, 3, 6), (40, 5, 8), (66, 3, 30), (24, 5, 28), (74, 1, 16)], "leaf", 5)
    return asset("terrain-nature", "ruined-arch", "Elven Ruin", Part("ruined-arch", g, pivot=(W / 2, 0.0, D / 2)))
