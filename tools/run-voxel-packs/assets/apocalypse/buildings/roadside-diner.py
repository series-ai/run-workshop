"""Roadside diner, in the Pirate Nation style.

A caricature railcar diner: a long teal car with chrome flutes, a band of
glowing booth windows and a checkered skirt, under a faceted barrel roof in
red standing-seam sheet (true slopes). The function prop is oversized
(rules F4, K1): a giant burger sits on the roof crown, built of stacked
12-gon frustums (bun, patty, drooping cheese, ragged lettuce, tomato and a
seeded dome bun), so the diner reads at thumbnail size. A big DINER board
stands on the vestibule in front; its neon letters stutter on `idle`. A
boarded vestibule up one step, a dead jukebox and a parked cart finish the
lot. Panels, checks, glass and letters are paint (S1). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint
import pnshapes as S
from _bld import bloom, crate, label, part, slab
from pnkit import awning as pnkit_awning
from pnkit import box, door, edges, window
from voxgrid import C, Asset, Clip, Grid, Part, bounds_pivot

W, H, D = 150, 104, 100
X0, X1, Z0, Z1 = 30, 128, 40, 78
G, SKIRT, EAVE, CROWN = 3, 10, 40, 58
SIGN = (50, 110, 47, 65)  # x0, x1, y0, y1 of the DINER board
SIGN_Z = 32
BURGER = (84.0, 59.0, 19.0)  # centre x, z and bun radius on the roof crown


def burger(g: Grid, cx: float, cz: float, r: float, y0: float) -> None:
    """A caricature burger standing on four short legs at y0: stacked
    12-gon frustums (true slopes) with drooping cheese and ragged lettuce."""
    down = S._DOWN["y"]

    def ng(rr, n=12, turn=0.0):
        return S.flat_ngon(cx, cz, rr, n, down + turn)

    X, Y, Z = S.coords(g)
    for dx, dz in ((-1, -1), (1, -1), (1, 1), (-1, 1)):  # the stand
        lx, lz = cx + dx * (r - 7), cz + dz * (r - 7)
        box(g, lx - 1.5, y0 - 12, lz - 1.5, lx + 1.5, y0 + 1, lz + 1.5, "steel", 4)
    y = y0
    g.prism("y", ng(r - 3), y, y + 5, C("rust", 5), top=ng(r))  # the bottom bun
    bun_lo = S.last(g)
    P.flat(g, bun_lo & (Y > y + 4), "rust", 6)
    y += 5
    g.prism("y", ng(r + 0.5), y, y + 3, C("darkwood", 5), top=ng(r + 1.5))  # the patty
    patty = S.last(g)
    g.prism("y", ng(r + 1.5), y + 3, y + 6, C("darkwood", 5), top=ng(r + 0.5))
    patty |= S.last(g)
    pnpaint.blotch(g, patty, "darkwood", 4, cell=2, chance=0.12, seed=21)
    P.flat(g, patty & (Y > y + 5), "darkwood", 6)  # the seared top
    y += 6
    # cheese: a square slice turned 45 degrees, its corners droop over the patty
    g.prism("y", ng((r + 3.0) / math.sqrt(2), n=4, turn=math.pi / 4), y, y + 1.5, C("gold", 4))  # corners just past the bun
    for k in range(4):
        a = math.pi / 4 + down + k * math.pi / 2 + math.pi / 4
        tx, tz = cx + (r + 1.0) * math.cos(a), cz + (r + 1.0) * math.sin(a)
        S.cone(g, "y", tx, tz, 2.2, y - 4, y + 0.5, "gold", 4, n=4, tip="lo")
    y += 1.5
    # lettuce: a ragged star of leaves in toxic green
    star = []
    for k in range(24):
        a = down + 2 * math.pi * k / 24
        rr = r + (3.0 if k % 2 == 0 else 1.0)
        star.append((cx + rr * math.cos(a), cz + rr * math.sin(a)))
    g.prism("y", star, y, y + 2, C("toxic", 4))
    lettuce = S.last(g)
    P.flat(g, lettuce & (np.hypot(X - cx, Z - cz) > r + 1.5), "toxic", 5)
    y += 2
    g.prism("y", ng(r - 0.5), y, y + 2.5, C("red", 5))  # the tomato
    y += 2.5
    bun = S.dome(g, cx, cz, y, r + 0.5, h=16, n=12, rings=3, ramp="rust", base=6, painter=lambda gg, mm, fr: P.flat(gg, mm, "rust", 6), ribs=None)
    P.flat(g, bun & (Y > y + 11), "rust", 7)  # the lit crown of the bun
    P.flat(g, bun & (Y < y + 1.5), "rust", 5)
    seeds = bun & (Y > y + 2) & (P._hash(X // 2, Y // 2, Z // 2, seed=23) % np.uint64(4) == 0) & ((X + Y + Z) % 2 == 0)
    P.flat(g, seeds, "bone", 7)


def diner() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = S._idx(g)
    lot = slab(g, 2, 4, 148, 96, h=G, ramp="sand", base=5, seed=1)
    for px in range(10, 30, 9):  # painted parking bays
        P.flat(g, lot & (Y == G - 1) & (X >= px) & (X < px + 2) & (Z > 8) & (Z < 34), "bone", 7)

    # ---- the car: a checkered skirt, chrome flutes, teal body
    skirt = box(g, X0 + 2, G, Z0 + 2, X1 - 2, SKIRT, Z1 - 2, "bone", 7)
    P.flat(g, skirt & (((X + Z) // 3 + Y // 3) % 2 == 0), "red", 4)
    body = box(g, X0, SKIRT, Z0, X1, EAVE, Z1, "teal", 5)
    P.flat(g, body & (((X + Z) % 14) == 0), "teal", 4)
    low = body & (Y < SKIRT + 9)
    P.flat(g, low, "steel", 6)
    P.flat(g, low & (((X + Z) % 3) == 0), "steel", 4)  # chrome flutes
    P.flat(g, body & ((Y == SKIRT + 9) | (Y == EAVE - 3)), "bone", 7)
    P.flat(g, body & (Y >= EAVE - 2), "teal", 4)
    for ex in (X0, X1 - 2):  # rounded chrome end caps
        cap = box(g, ex, SKIRT, Z0 + 3, ex + 2, EAVE - 1, Z1 - 3, "steel", 6)
    # the band of booth windows (paint on the wall, glowing)
    for face, plane in (("-z", Z0), ("+z", Z1)):
        for u0 in range(X0 + 6, X1 - 12, 12):
            if face == "-z" and 66 <= u0 <= 84:
                continue  # the vestibule
            window(g, face, plane, u0, u0 + 9, SKIRT + 11, EAVE - 5, frame="steel", glass="gold", glow=6, cross=False, sill=None)
    # striped awnings over the booth windows (true slopes)
    for face, plane, spans in (("-z", Z0, ((X0 + 2, 64), (96, X1 - 2))), ("+z", Z1, ((X0 + 2, X1 - 2),))):
        for u0, u1 in spans:
            pnkit_awning(g, face, plane, u0, u1, EAVE - 2, depth=7, drop=5, ramps=("red", "bone"), stripe=4)
    bloom(g, body, 6, ((X0, SKIRT, Z0), (X1, EAVE, Z1)), r=(2.5, 4.0), ramp="rust", shades=(5, 4), seed=3)

    # ---- the barrel roof: a faceted arch in red standing-seam sheet
    half = (Z1 - Z0) / 2 + 3
    zc = (Z0 + Z1) / 2
    prof = []
    for k in range(7):
        a = math.pi * k / 6
        prof.append((EAVE + (CROWN - EAVE) * math.sin(a), zc - half * math.cos(a)))
    g.prism("x", prof, X0 - 3, X1 + 3, C("red", 5))
    roof = S.last(g)
    for m, fr in S.facets(g):
        if fr != "top" or True:
            P.plates(g, m, "red", 5, size=(8, 60), rivets=False, frame=fr, seed=4)
    P.flat(g, roof & ((X == X0 - 3) | (X == X1 + 2)), "steel", 6)
    P.flat(g, roof & (Y < EAVE + 1), "red", 3)
    # a roof vent hood
    S.cone(g, "y", X1 - 18, zc, 4, CROWN - 1, CROWN + 6, "steel", 5, n=8, r_top=2)

    # ---- the giant burger on the roof crown (the function prop)
    burger(g, *BURGER, CROWN + 6)

    # ---- the DINER board on the vestibule roof (the neon is a part)
    sx0, sx1, sy0, sy1 = SIGN
    for lx in (sx0 + 16, sx1 - 19):
        box(g, lx, EAVE + 5, SIGN_Z + 1, lx + 3, sy0 + 1, SIGN_Z + 4, "steel", 4)
    board = box(g, sx0, sy0, SIGN_Z, sx1, sy1, SIGN_Z + 3, "blue", 4)
    P.outline(g, board, "gold", 5, normal="z")
    label(g, "-z", SIGN_Z, (sx0 + sx1) / 2, sy0 + 3, "DINER", "magenta", 2, scale=2, gap=1)  # the dim tubes behind the neon

    # ---- the vestibule: a boarded door up one step
    vb = box(g, 66, SKIRT, Z0 - 8, 94, EAVE + 2, Z0, "bone", 6)
    P.plates(g, vb, "bone", 6, size=(14, 10), rivets=False, seed=5)
    P.flat(g, edges(vb), "steel", 5)
    door(g, "-z", Z0 - 8, 72, 88, SKIRT, SKIRT + 24, leaf="wood", arch=False, seed=6)
    for p0, p1 in (((70, SKIRT + 6), (90, SKIRT + 18)), ((70, SKIRT + 18), (90, SKIRT + 7))):
        b = S.bar(g, "z", p0, p1, 3, Z0 - 13, Z0 - 10, "wood", 5)
        P.planks(g, b, "wood", 5, width=3, across="y", seed=p0[1])
    for k in range(2):
        box(g, 68 - 2 * k, G, Z0 - 12 - 3 * k, 92 + 2 * k, SKIRT - 3 * k, Z0 - 8, "stone", 5)
    sign_top = box(g, 64, EAVE + 2, Z0 - 10, 96, EAVE + 5, Z0, "red", 5)
    P.flat(g, edges(sign_top), "red", 3)

    # ---- a dead jukebox by the steps and a shopping cart of junk
    jb = box(g, 100, G, Z0 - 10, 110, G + 16, Z0 - 4, "pink", 4)
    g.prism("z", [(100, G + 16), (110, G + 16), (108, G + 20), (102, G + 20)], Z0 - 10, Z0 - 4, C("gold", 5))
    P.flat(g, jb & (Z == Z0 - 10) & (Y > G + 4) & (Y < G + 13) & (X > 101) & (X < 109), "gold", 6)
    P.flat(g, jb & (Z == Z0 - 10) & (Y > G + 6) & (Y < G + 11) & (X > 102) & (X < 108), "cyan", 6)
    crate(g, 132, G, 20, 10, ramp="sand", base=5, seed=7)
    S.drum(g, 138, 60, G, 16, 6.5, ramp="teal", base=5, band=("bone", 6), seed=8)
    return g


def neon() -> Grid:
    g = Grid(W, H, D)
    sx0, sx1, sy0, sy1 = SIGN
    tube = box(g, sx0 + 1, sy0 + 1, SIGN_Z - 1, sx1 - 1, sy1 - 1, SIGN_Z, "blue", 4)
    P.outline(g, tube, "cyan", 7, normal="z")
    label(g, "-z", SIGN_Z - 1, (sx0 + sx1) / 2, sy0 + 3, "DINER", "pink", 4, scale=2, gap=1)
    return g


def build() -> Asset:
    g = diner()
    pivot = bounds_pivot(g)
    root = Part("roadside-diner", g, pivot=pivot)
    sx0, sx1, sy0, sy1 = SIGN
    part(root, "neon", neon(), ((sx0 + sx1) / 2, (sy0 + sy1) / 2, SIGN_Z - 0.5))
    on, off = (1.0, 1.0, 1.0), (0.001, 0.001, 0.001)
    fl = [(0.0, on), (1.2, on), (1.22, off), (1.3, off), (1.32, on), (1.45, on), (1.47, off), (1.7, off), (1.72, on), (3.0, on)]
    return Asset(id="apocalypse-buildings-roadside-diner", pack="apocalypse", category="buildings", name="Roadside Diner", root=root,
                 clips=[Clip("idle", {"neon": {"scale": fl}})])
