"""Broken overpass, in the Pirate Nation style.

A collapsed highway span: two fat tapered piers (true slopes, rule F2) on a
cracked apron carry a concrete deck that has dropped in the middle. One
slab hangs off the -x pier, a second slab has slid down on its nose to the
service road below (a tilted prism, rule F5) and the +x span still stands.
Bent rebar combs the broken ends, a toppled jersey barrier, a crushed
barrier run and a dead sapling ride the deck, and faceted rubble piles up
under the break. Lane paint, mortar courses, soot, graffiti and rust bleeds
are paint (rule S1). The soffit is 68 above the service road, so the pack
cars (59-70 tall) can pass under the standing spans. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import ctr, limb, make, plan, rock, slab, tuft
from pnkit import box, edges
from voxgrid import C, Grid, Part

SZ = (140, 90, 72)
Z0, Z1 = 16, 56  # the carriageway across z
DECK, TOP = 72, 78  # the deck soffit and its road surface
PIERS = (24.0, 112.0)
BREAK0, BREAK1 = 60, 96  # the gap in the deck


def pier(g: Grid, cx: float, seed: int) -> np.ndarray:
    """A tapered pier on a spread footing, with a wide head beam."""
    X, Y, Z = ctr(g)
    pad = plan(g, [(cx - 20, 18), (cx + 20, 18), (cx + 20, 54), (cx - 20, 54)], 3, 8, "sand", 4,
               top=[(cx - 17, 21), (cx + 17, 21), (cx + 17, 51), (cx - 17, 51)])
    PP.concrete(g, pad, "sand", 4, size=10, cracks=4, seed=seed)
    # a straight lower shaft (a flat face for the tags) under a tapered upper shaft
    shaft = box(g, cx - 16, 8, 22, cx + 16, 34, 50, "stone", 5)
    shaft |= plan(g, [(cx - 16, 22), (cx + 16, 22), (cx + 16, 50), (cx - 16, 50)], 34, DECK - 4, "stone", 5,
                  top=[(cx - 9, 28), (cx + 9, 28), (cx + 9, 44), (cx - 9, 44)])
    PP.concrete(g, shaft, "stone", 5, size=16, cracks=6, seed=seed + 1)
    head = box(g, cx - 14, DECK - 4, 22, cx + 14, DECK, 50, "stone", 6)
    PP.concrete(g, head, "stone", 6, size=14, cracks=2, seed=seed + 2)
    P.flat(g, edges(head), "stone", 4)
    m = pad | shaft | head
    # water stains that bleed down the shaft, and moss at the foot
    for sz_ in (30.0, 42.0):
        P.flat(g, shaft & (np.abs(Z - sz_) < 2.2) & (X < cx - 10) & (Y > 12), "stone", 3)
    # a darker joint where the straight shaft meets the taper
    P.flat(g, shaft & (np.abs(Y - 34) < 0.8), "stone", 3)
    P.flat(g, m & (Y < 14), "moss", 4)
    PP.blotch(g, m & (Y < 22), "moss", 5, cell=5, chance=0.12, seed=seed + 3)
    # rust bleeds from the bearings down the head beam and the shaft
    for bz in (26.0, 46.0):
        bleed = m & (np.abs(Z - bz) < 2.6) & (Y > DECK - 22) & (Y < DECK)
        P.flat(g, bleed & (np.floor(Y) % 3 != 2), "rust", 5)
        P.flat(g, bleed & (Y > DECK - 7), "rust", 4)
    P.flat(g, head & (Y < DECK - 3), "stone", 3)
    P.flat(g, edges(shaft), "stone", 4)
    return m


def deck_paint(g: Grid, m: np.ndarray, seed: int) -> None:
    """Concrete courses on the sides and the worn lane paint on top."""
    X, Y, Z = ctr(g)
    PP.concrete(g, m, "stone", 5, size=18, cracks=8, seed=seed)
    surf = m & (Y > TOP - 1)
    P.flat(g, surf, "stone", 3)  # the asphalt wearing course
    PP.blotch(g, surf, "stone", 2, cell=6, chance=0.07, seed=seed + 1)
    P.flat(g, surf & ((np.abs(Z - (Z0 + 5)) < 0.7) | (np.abs(Z - (Z1 - 5)) < 0.7)), "bone", 6)
    dash = surf & (np.abs(Z - (Z0 + Z1) / 2) < 1.1) & ((np.floor(X) % 16) >= 3) & ((np.floor(X) % 16) < 11)
    P.flat(g, dash, "gold", 5)
    PP.blotch(g, dash, "gold", 3, cell=2, chance=0.2, seed=seed + 2)
    P.flat(g, m & (Y < DECK + 2), "stone", 3)  # the shaded soffit
    P.flat(g, m & (Y > DECK + 1) & (Y < DECK + 3), "stone", 6)  # the edge beam highlight


def barrier(g: Grid, x0: float, x1: float, cz: float, y0: float, seed: int) -> np.ndarray:
    """A jersey barrier run along x: a chamfered prism (true slopes)."""
    sec = [(cz - 3.5, y0), (cz + 3.5, y0), (cz + 2.2, y0 + 3), (cz + 1.4, y0 + 10),
           (cz - 1.4, y0 + 10), (cz - 2.2, y0 + 3)]
    g.prism("x", [(y, z) for z, y in sec], x0, x1, C("stone", 6))
    m = S.last(g)
    for fm, fr in S.facets(g, [g.solids[-1]]):
        PP.concrete(g, fm, "stone", 6, size=12, cracks=2, frame=fr, seed=seed)
    X, Y, Z = ctr(g)
    P.flat(g, m & (np.floor(X) % 12 == 0), "stone", 4)  # the joints between sections
    P.flat(g, m & (Y > y0 + 8), "stone", 7)
    return m


def build():
    g = Grid(*SZ)
    X, Y, Z = ctr(g)

    # ---- the apron and the service road that runs under the span
    ground = box(g, 0, 0, 0, SZ[0], 3, SZ[2], "sand", 4)
    PP.concrete(g, ground, "sand", 4, size=22, cracks=14, frame="top", seed=1)
    road = box(g, 62, 0, 0, 94, 4, SZ[2], "stone", 3)
    PP.concrete(g, road, "stone", 3, size=24, cracks=8, frame="top", seed=2)
    P.flat(g, road & (Y > 3) & (np.abs(X - 78) < 1.1) & ((np.floor(Z) % 16) >= 3) & ((np.floor(Z) % 16) < 11), "gold", 5)
    for kx in (64.0, 92.0):
        P.flat(g, road & (Y > 3) & (np.abs(X - kx) < 0.7), "bone", 6)

    # ---- the two piers
    for k, cx in enumerate(PIERS):
        pier(g, cx, 10 + k * 10)

    # ---- the standing spans, and the cantilever that lost its end
    west = box(g, 0, DECK, Z0, BREAK0, TOP, Z1, "stone", 5)
    east = box(g, BREAK1, DECK, Z0, SZ[0], TOP, Z1, "stone", 5)
    deck_paint(g, west, 20)
    deck_paint(g, east, 24)
    # the broken ends: a jagged lip of lighter concrete and bent rebar
    for face_x, sgn in ((BREAK0, 1), (BREAK1, -1)):
        lip = (west | east) & (np.abs(X - face_x) < 2.5)
        P.flat(g, lip, "stone", 7)
        PP.blotch(g, lip, "stone", 4, cell=3, chance=0.3, seed=30)
        PP.hazard(g, lip & (Y > TOP - 2), period=5, a=("gold", 5), b=("darkwood", 3), frame="top")
        for k, rz in enumerate(range(Z0 + 4, Z1 - 2, 6)):
            y = DECK + 2 + (k % 3)
            limb(g, (face_x - sgn * 1.0, y, rz + 0.5), (face_x + sgn * (6 + k % 4), y + 3 + (k % 2) * 3, rz + 0.5 + (k % 3) - 1),
                 0.8, 0.6, "rust", 4, n=4)

    # ---- the fallen slab: a tilted prism nosed into the service road
    fallen = slab(g, "z", 78.0, 36.5, 72.0, 7.0, Z0 + 3, Z1 - 3, -62.0, "stone", 5)
    for fm, fr in S.facets(g, [g.solids[-1]]):
        PP.concrete(g, fm, "stone", 5, size=16, cracks=5, frame=fr, seed=31)
    P.flat(g, fallen & (Y > 60), "stone", 3)  # the road face still showing at the top
    P.flat(g, fallen & (Y < 12), "stone", 3)
    PP.blotch(g, fallen, "rust", 5, cell=5, chance=0.05, seed=32)
    for k, rz in enumerate(range(Z0 + 6, Z1 - 4, 7)):  # rebar combing out of its high end
        limb(g, (62.0, 67.0, rz + 0.5), (56.0 - k % 3, 71.0 + (k % 2) * 2, rz + 0.5), 0.8, 0.6, "rust", 4, n=4)
    for k, rz in enumerate(range(Z0 + 8, Z1 - 6, 9)):  # and out of its buried nose
        limb(g, (93.0, 9.0, rz + 0.5), (101.0 + k % 4, 5.0, rz + 0.5), 0.8, 0.6, "rust", 4, n=4)

    # ---- barriers along the deck edges, one run toppled over the break
    for cz in (Z0 + 4, Z1 - 4):
        barrier(g, 2, BREAK0 - 4, cz, TOP, 40)
        barrier(g, BREAK1 + 6, SZ[0] - 2, cz, TOP, 41)
    tipped = slab(g, "x", TOP + 4.5, Z1 - 10.0, 10.0, 7.0, BREAK1 + 10, BREAK1 + 30, 78.0, "stone", 6)
    P.flat(g, tipped & (Y > 12), "stone", 7)
    P.flat(g, tipped, "stone", 6)
    P.flat(g, edges(tipped), "stone", 4)

    # ---- a ROAD CLOSED barricade and two cones on the standing spans
    for lx in (BREAK0 - 20, BREAK0 - 8):
        box(g, lx, TOP, 26, lx + 3, TOP + 8, 29, "darkwood", 4)
    bar_board = slab(g, "z", float(BREAK0 - 11), float(TOP + 7), 26.0, 5.0, 25, 28, -6.0, "bone", 7)
    PP.hazard(g, bar_board, period=6, a=("red", 5), b=("bone", 7))
    P.flat(g, edges(bar_board), "darkwood", 3)
    for cx, cz in ((BREAK1 + 14, 24), (BREAK1 + 26, 46)):
        cone = S.cone(g, "y", float(cx), float(cz), 3.2, TOP, TOP + 10, "red", 5, n=6, r_top=0.9)
        P.flat(g, cone & (Y > TOP + 4) & (Y < TOP + 7), "bone", 7)
        box(g, cx - 4, TOP, cz - 4, cx + 4, TOP + 1, cz + 4, "red", 4)

    # ---- faceted rubble under the break, with bent bar and a burnt patch
    for k, (rx, rz, rr, rh) in enumerate(((70.0, 24.0, 7.0, 7.0), (86.0, 40.0, 9.0, 9.0), (64.0, 44.0, 6.0, 5.0),
                                          (96.0, 26.0, 6.5, 6.0), (78.0, 14.0, 7.5, 6.0), (100.0, 46.0, 5.0, 4.0))):
        ch = rock(g, rx, rz, 3, rr, rr * 0.8, rh, ramp="stone", shade=5 + (k % 2), shrink=0.55,
                  lean=(1.5 - k, 1.0), n=6, seed=50 + k)
        P.flat(g, ch & (Y > 3 + rh - 1.4), "stone", 7)
        P.flat(g, ch & (Y < 6), "stone", 3)
        PP.blotch(g, ch, "sand", 5, cell=3, chance=0.14, seed=60 + k)
        PP.blotch(g, ch, "moss", 5, cell=4, chance=0.1, seed=90 + k)
        if k % 2 == 0:
            limb(g, (rx - 2, 3 + rh - 1, rz), (rx + 4, 3 + rh + 4, rz + 2), 0.7, 0.6, "rust", 4, n=4)
    P.flat(g, ground & (Y > 2) & (np.hypot(X - 84, (Z - 30) * 1.2) < 11), "sand", 3)
    P.flat(g, ground & (Y > 2) & (np.hypot(X - 84, (Z - 30) * 1.2) < 6), "darkwood", 3)  # a burnt patch

    # ---- a toxic tag on the -x pier and a route stencil on the +x pier
    G.text(g, "-z", 22.0, int(PIERS[0]) - 16, 11, "RVX", "toxic", 5, scale=2, gap=1)
    P.flat(g, (g.a > 0) & (np.abs(Z - 22) < 1.0) & (X > PIERS[0] - 17) & (X < PIERS[0] + 16)
           & (Y > 8) & (Y < 10), "toxic", 3)
    G.text(g, "-z", 22.0, int(PIERS[1]) - 16, 11, "I-9", "bone", 6, scale=2, gap=1)

    # ---- a dead sapling in the deck crack and weeds through the apron
    # (low, so the deck stays inside the 90-voxel terrain height)
    trunk = limb(g, (30.0, TOP, 30.0), (32.0, TOP + 8, 28.0), 1.6, 0.9, "darkwood", 4, n=5)
    for a, b, r in (((31.5, TOP + 5, 28.5), (36.0, TOP + 10, 26.0), 0.8),
                    ((31.5, TOP + 6, 29.0), (27.0, TOP + 10, 31.0), 0.8),
                    ((32.0, TOP + 7, 28.0), (34.0, TOP + 11, 31.0), 0.7)):
        trunk |= limb(g, a, b, r, 0.4, "darkwood", 4, n=4)
    P.flat(g, trunk & (Y > TOP + 7), "darkwood", 5)
    for k, (tx, tz) in enumerate(((8, 10), (132, 12), (18, 62), (120, 64), (52, 8), (110, 8), (46, 66), (72, 62))):
        tuft(g, tx + 0.5, tz + 0.5, 3, 6, blades=4, spread=2.6, ramp="khaki", shade=5, seed=70 + k)
    for k, (tx, tz) in enumerate(((BREAK0 + 2, 22), (BREAK1 - 4, 48), (80, 6))):
        tuft(g, tx + 0.5, tz + 0.5, 3, 5, blades=3, spread=2.2, ramp="moss", shade=5, seed=80 + k)
    return make("terrain-nature", "broken-overpass", "Broken Overpass", Part("broken-overpass", g))
