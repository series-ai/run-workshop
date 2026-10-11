"""Village granary in the Pirate Nation style.

A raised barn that stands on nine staddle stones (mushroom stones keep
the grain dry and the rats out). Barn-red board walls with cream corner
trim sit on a thick dark sill; the roof is a tall gambrel (two true slopes
each side: a steep lower pitch and a shallow upper pitch) in grey-blue
slate. The gable faces the front with a cream-braced double door at the
top of a plank ramp, an open hay loft hatch above it, and a hoist beam
with a pulley and a hanging grain sack.

The function prop is the tall stone grain silo on the right (rule F6): a
round tower of stone courses with iron bands, a slate cone roof with a
gold wheat finial, and a covered chute that feeds the barn loft. A gold
wheat sign hangs on the gable. A straw bee skep on a bench (the bees are
PFX), grain sacks, a scythe and a heap of grain stand round the base
(rule K1). Detail is paint (rule S1): planks with seams, nails and framed
edges (rules S2, S4). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import cone_roof, drum, tiles_on
from _fbld_rural import hay_bale, idx, plank_wall, staddle, straw
from _props import glyph, glyph_size, sack
from pnkit import box, edges, window
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 124, 112, 100
X0, X1, Z0, Z1 = 20, 76, 32, 80  # barn walls; the front is z = Z0
XC = (X0 + X1) // 2
SILL, FLOOR, WALL_TOP = 12, 16, 52  # staddles to y 12, a sill to y 16, one storey of 36
KNEE, RIDGE = (11, 76), 90  # the gambrel knee (inset from the wall, height) and the ridge
OV = 4  # the eave overhang
SX, SZ, SR = 100, 56, 13.0  # the silo
SILO_TOP = 80
SKEP = (10.0, 16.0)  # the bee skep (x, z)


def gambrel_pts() -> tuple[list, list]:
    """The outer roof line (x, y) from the left eave to the ridge and the
    inner line (the attic outline) under it."""
    ex = X0 - OV
    kx, ky = X0 + KNEE[0], KNEE[1]
    # the eave sits on the line from the knee down through the wall top
    s = (ky - WALL_TOP) / KNEE[0]
    ey = WALL_TOP - OV * s
    return [(ex, ey), (kx, ky), (XC, RIDGE)], s


def barn(g: Grid) -> None:
    """Staddles, sill, red board walls, cream trim and the gambrel roof."""
    X, Y, Z = idx(g)
    for sx in (X0 + 4, XC, X1 - 4):
        for sz in (Z0 + 4, (Z0 + Z1) // 2, Z1 - 4):
            staddle(g, sx, sz, SILL, r=4.0)
    sill = box(g, X0 - 2, SILL, Z0 - 2, X1 + 2, FLOOR, Z1 + 2, "darkwood", 4)
    P.planks(g, sill, "darkwood", 4, width=4, across="y", nails=True, seed=1)
    P.flat(g, edges(sill), "darkwood", 2)
    walls = box(g, X0, FLOOR, Z0, X1, WALL_TOP, Z1, "red", 3)
    plank_wall(g, walls, "red", 3, across="x", width=4, seed=2)
    trim = np.zeros(g.shape, dtype=bool)
    for cx in (X0, X1):  # cream corner boards, framed dark
        for cz in (Z0, Z1):
            trim |= box(g, cx - 2, FLOOR, cz - 2, cx + 2, WALL_TOP, cz + 2, "bone", 6)
    trim |= box(g, X0 - 1, WALL_TOP - 3, Z0 - 1, X1 + 1, WALL_TOP, Z1 + 1, "bone", 6)  # the top plate
    P.planks(g, trim, "bone", 6, width=4, across="x", nails=False, seed=3)
    P.flat(g, edges(trim), "bone", 3)
    # the gambrel: four true slopes, slate rows down each one
    pts, s = gambrel_pts()
    (ex, ey), (kx, ky), (rx, ry) = pts
    mx = lambda x: 2 * XC - x  # noqa: E731
    t = 4  # the slab thickness
    attic = [(X0, WALL_TOP), (X1, WALL_TOP), (mx(kx), ky), (XC, ry), (kx, ky)]
    g.prism("z", attic, Z0, Z1, C("red", 3))
    gab = S.last(g)
    plank_wall(g, gab, "red", 3, across="x", width=4, frame="z", seed=4)
    start = len(g.solids)
    zb0, zb1 = Z0 - OV, Z1 + OV
    for a, b in (((ex, ey), (kx, ky)), ((kx, ky), (rx, ry))):
        for flip in (False, True):
            p0 = (mx(a[0]), a[1]) if flip else a
            p1 = (mx(b[0]), b[1]) if flip else b
            g.prism("z", [p0, p1, (p1[0], p1[1] + t), (p0[0], p0[1] + t)], zb0, zb1, C("stone", 4))
    roof = np.logical_or.reduce([sd.mask(g.shape) for sd in g.solids[start:]])
    tiles_on(g, start, "stone", 4, row=4, width=5, seed=5)
    P.flat(g, roof & ((Z < zb0 + 2) | (Z >= zb1 - 2)), "darkwood", 3)  # the barge boards
    P.flat(g, roof & (Y < ey + 2), "stone", 2)  # the dark eave lip
    P.flat(g, roof & (np.abs(Y + 0.5 - (ky + t / 2)) < 1.2) & ((np.abs(X + 0.5 - kx) < 2.5) | (np.abs(X + 0.5 - mx(kx)) < 2.5)), "darkwood", 3)
    rb = box(g, XC - 2, RIDGE + t - 1, zb0 - 1, XC + 2, RIDGE + t + 2, zb1 + 1, "darkwood", 3)
    P.planks(g, rb, "darkwood", 3, width=3, across="x", seed=6)
    # the barge boards on the gable: cream, following the roof line
    for z0, z1 in ((Z0 - 2, Z0), (Z1, Z1 + 2)):
        for a, b in (((X0, WALL_TOP), (kx, ky)), ((kx, ky), (XC, ry))):
            for flip in (False, True):
                p0 = (mx(a[0]), a[1]) if flip else a
                p1 = (mx(b[0]), b[1]) if flip else b
                bm = S.bar(g, "z", (p0[0], p0[1] - 1), (p1[0], p1[1] - 1), 2.4, z0, z1, "bone", 6)
                P.flat(g, bm, "bone", 6)
    # side windows and high vents on both long walls
    for face, plane in (("-x", X0), ("+x", X1)):
        for w0 in (Z0 + 10, Z1 - 20):
            window(g, face, plane, w0, w0 + 10, 26, 38, frame="darkwood", glass="gold", glow=4)
            vt = box(g, *(_vent(face, plane, w0)), "darkwood", 2)
            P.flat(g, vt & (Y % 2 == 0), "red", 2)
            P.outline(g, vt, "bone", 5, normal="x")


def _vent(face: str, plane: int, w0: int):
    """The box of a small louvred vent under the eave above a window."""
    if face == "-x":
        return (plane - 1, 43, w0, plane, 49, w0 + 10)
    return (plane, 43, w0, plane + 1, 49, w0 + 10)


def front(g: Grid) -> None:
    """The gable front: the braced double door, the plank ramp, the loft
    hatch with hay, the hoist and the wheat sign."""
    X, Y, Z = idx(g)
    d0, d1, top = XC - 10, XC + 10, FLOOR + 28  # a 20 wide, 28 high double door
    leaves = box(g, d0, FLOOR, Z0 - 2, d1, top, Z0, "red", 4)
    P.planks(g, leaves, "red", 4, width=4, across="x", length=(60, 61), nails=False, seed=10)
    U, V = X - d0, Y - FLOOR
    half = (d1 - d0) // 2
    lu = U % half
    hh = top - FLOOR
    border = (lu < 2) | (lu >= half - 2) | (V < 2) | (V >= hh - 2)
    # one cream X brace across each leaf, from corner to corner
    xb = (np.abs((lu + 0.5) * (hh / half) - (V + 0.5)) < 2.0) | (np.abs((half - lu - 0.5) * (hh / half) - (V + 0.5)) < 2.0)
    P.flat(g, leaves & (border | xb), "bone", 6)
    P.flat(g, leaves & (U == half), "darkwood", 2)
    for hx in (d0 + half - 3, d0 + half + 2):  # the handles
        box(g, hx, FLOOR + 12, Z0 - 3, hx + 1, FLOOR + 16, Z0 - 2, "iron", 4)
    fr = box(g, d0 - 2, FLOOR, Z0 - 2, d0, top + 2, Z0, "bone", 6)
    fr |= box(g, d1, FLOOR, Z0 - 2, d1 + 2, top + 2, Z0, "bone", 6)
    fr |= box(g, d0 - 2, top, Z0 - 2, d1 + 2, top + 2, Z0, "bone", 6)
    P.flat(g, edges(fr), "bone", 3)
    # the plank ramp up to the door sill (one true slope)
    g.prism("x", [(0, 4), (0, Z0 - 2), (FLOOR, Z0 - 2), (FLOOR, Z0 - 4)], d0 - 1, d1 + 1, C("wood", 5))
    ramp = S.last(g)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr_: P.planks(gg, mm, "wood", 5, width=3, across="z" if fr_ == "x" else "y", nails=True, frame=fr_, seed=11))
    P.flat(g, ramp & ((X == d0 - 1) | (X == d1)), "darkwood", 3)
    for k in range(5):  # the cleats across the ramp
        cz = 8 + k * 4
        cy = int((cz - 4) * FLOOR / (Z0 - 6)) + 1
        box(g, d0, cy, cz, d1, cy + 1, cz + 1, "darkwood", 3)
    # the loft hatch in the gable, open on the dark loft with hay
    h0, h1, v0, v1 = XC - 8, XC + 8, 60, 76
    g.a[h0:h1, v0:v1, Z0:Z0 + 4] = 0
    box(g, h0, v0, Z0 + 4, h1, v1, Z0 + 5, "darkwood", 1)
    P.flat(g, P.region(g, h0 - 1, v0 - 1, Z0, h1 + 1, v1 + 1, Z0 + 4), "darkwood", 2)
    hay = box(g, h0, v0, Z0 + 1, h1, v0 + 7, Z0 + 4, "sand", 4)
    straw(g, hay, frame="z", base=3, tie=99, seed=12)
    hf = box(g, h0 - 2, v0 - 2, Z0 - 2, h1 + 2, v0, Z0, "bone", 6)
    hf |= box(g, h0 - 2, v1, Z0 - 2, h1 + 2, v1 + 2, Z0, "bone", 6)
    hf |= box(g, h0 - 2, v0, Z0 - 2, h0, v1, Z0, "bone", 6)
    hf |= box(g, h1, v0, Z0 - 2, h1 + 2, v1, Z0, "bone", 6)
    P.flat(g, edges(hf), "bone", 3)
    # the hatch leaf hangs open, square to the wall, on its left hinge
    lf = box(g, h0 - 4, v0, Z0 - 16, h0 - 2, v1, Z0 - 2, "red", 4)
    P.planks(g, lf, "red", 4, width=4, across="z", length=(60, 61), nails=False, frame="x", seed=13)
    P.flat(g, edges(lf), "bone", 6)
    # the hoist beam, a pulley, the rope and a hanging sack
    hb = box(g, XC - 2, 80, Z0 - 16, XC + 2, 84, Z0 + 2, "darkwood", 4)
    P.planks(g, hb, "darkwood", 4, width=4, across="y", nails=True, seed=14)
    g.prism("x", S.quad((81, Z0 - 14), (73, Z0 - 2), 1.6), XC - 1, XC + 1, C("darkwood", 3))  # the brace
    pul = S.disc(g, "x", 78, Z0 - 12, 2.6, XC - 1, XC + 1, "iron", 4)
    P.flat(g, pul & (Y > 78), "iron", 6)
    box(g, XC, 52, Z0 - 13, XC + 1, 76, Z0 - 12, "sand", 3)
    sack(g, XC + 0.5, 42, Z0 - 12.5, 4.0, 11, ramp="sand", base=6, mark=None, seed=15)
    # the gold wheat sign on the front wall, left of the door
    sb = box(g, X0 + 3, 24, Z0 - 2, X0 + 15, 38, Z0 - 1, "darkwood", 3)
    P.planks(g, sb, "darkwood", 3, width=2, across="y", nails=False, seed=16)
    P.outline(g, sb, "gold", 4, normal="z")
    gw, gh = glyph_size("wheat", 1)
    glyph(g, "-z", Z0 - 2, X0 + 9 - gw // 2, 31 - gh // 2, "wheat", "gold", 6, scale=1, reach=2)
    # back wall: a small door at the top of a short ladder, and a window
    bd = box(g, XC - 7, FLOOR, Z1, XC + 7, FLOOR + 24, Z1 + 2, "red", 4)
    P.planks(g, bd, "red", 4, width=4, across="x", length=(60, 61), nails=False, seed=17)
    P.outline(g, bd, "bone", 6, normal="z")
    for lx in (XC - 6, XC + 4):
        box(g, lx, 0, Z1 + 4, lx + 2, FLOOR, Z1 + 6, "darkwood", 4)
    for ly in range(3, FLOOR, 4):
        box(g, XC - 6, ly, Z1 + 4, XC + 6, ly + 1, Z1 + 6, "wood", 4)
    window(g, "+z", Z1, XC - 6, XC + 6, 60, 70, frame="darkwood", glass="gold", glow=4)


def silo(g: Grid) -> None:
    """The stone grain silo with iron bands, its slate cone roof, a gold
    wheat finial, a base hatch and the covered chute to the loft."""
    X, Y, Z = idx(g)
    body = drum(g, SX, SZ, 0, SILO_TOP, SR, ramp="stone", base=5, n=12, block=(7, 4), seed=20)
    P.flat(g, body & (Y < 4), "stone", 3)
    for by in (22, 48, 72):  # iron bands
        P.flat(g, body & (Y >= by) & (Y < by + 2), "iron", 4)
        P.flat(g, body & (Y == by) & (((X + Z) % 6) == 0), "iron", 6)
    rim = drum(g, SX, SZ, SILO_TOP - 2, SILO_TOP + 1, SR + 1.5, ramp="stone", base=6, n=12, block=(5, 3), seed=21)
    P.flat(g, rim & (Y == SILO_TOP), "stone", 7)
    cone_roof(g, SX, SZ, SILO_TOP + 1, SR + 3, 21, ramp="stone", base=4, n=10, lean=(-1.0, 0.0), trim=("stone", 6), eave=("stone", 2), row=4, seed=22)
    # the wheat finial: a gold sheaf on a short pole
    box(g, SX - 2, SILO_TOP + 19, SZ - 1, SX, SILO_TOP + 24, SZ + 1, "iron", 4)
    S.cone(g, "y", SX - 1, SZ, 2.6, SILO_TOP + 23, SILO_TOP + 29, "gold", 5, n=6, r_top=1.0)
    P.flat(g, S.last(g) & (Y >= SILO_TOP + 26), "gold", 6)
    # the arched hatch at the foot of the silo, facing the front
    hz = SZ - SR
    hatch = box(g, SX - 5, 4, hz - 2, SX + 5, 18, hz, "wood", 4)
    P.planks(g, hatch, "wood", 4, width=3, across="x", length=(60, 61), nails=False, seed=23)
    P.outline(g, hatch, "darkwood", 2, normal="z")
    P.flat(g, hatch & ((Y == 7) | (Y == 14)) & (X < SX - 1), "iron", 4)
    # the covered chute from the silo down into the barn loft
    # It runs from the silo wall down into the roof slab, so its low end is
    # hidden in the loft and nothing floats.
    g.prism("z", S.quad((SX - SR + 1, 72), (X1 - 4, 63), 3.2), SZ - 4, SZ + 4, C("wood", 4))
    ch = S.last(g)
    P.planks(g, ch, "wood", 4, width=3, across="y", nails=True, seed=24)
    P.flat(g, ch & (Y + 0.5 > 72 - (SX - SR + 1 - (X + 0.5)) * 0.6 + 1.8), "stone", 3)  # the shingled top
    P.flat(g, ch & ((Z == SZ - 4) | (Z == SZ + 3)) & (Y % 4 == 0), "darkwood", 3)


def yard(g: Grid) -> None:
    """The props round the base: the bee skep on its bench, grain sacks,
    a scythe, a hay bale and a heap of spilled grain (rule K1)."""
    X, Y, Z = idx(g)
    kx, kz = SKEP
    bench = box(g, kx - 7, 7, kz - 6, kx + 7, 9, kz + 6, "wood", 5)
    P.planks(g, bench, "wood", 5, width=3, across="x", nails=True, frame="top", seed=30)
    P.flat(g, edges(bench), "darkwood", 3)
    for lx in (kx - 6, kx + 4):
        for lz in (kz - 5, kz + 3):
            box(g, lx, 0, lz, lx + 2, 7, lz + 2, "darkwood", 4)
    # the skep: a coiled straw dome (stacked frustums, true slopes)
    start = len(g.solids)
    rings = ((7.0, 6.6, 9, 13), (6.6, 5.6, 13, 17), (5.6, 3.8, 17, 21), (3.8, 1.2, 21, 24))
    for r0, r1, y0, y1 in rings:
        S.cone(g, "y", kx, kz, r0, y0, y1, "sand", 4, n=10, r_top=r1)
    skep = np.logical_or.reduce([sd.mask(g.shape) for sd in g.solids[start:]])
    straw(g, skep, frame="wall", base=3, tie=3, seed=31)
    P.flat(g, skep & (Y % 3 == 0), "sand", 2)  # the coils
    P.flat(g, skep & (Y >= 9) & (Y < 12) & (np.abs(X + 0.5 - kx) < 1.6) & (Z < kz - 4), "darkwood", 0)  # the bee door
    # flowers by the bench for the bees
    for fx, fz, fr in ((kx - 9, kz - 9, "red"), (kx + 6, kz - 10, "gold"), (kx - 2, kz - 11, "pink")):
        box(g, fx, 0, fz, fx + 1, 4, fz + 1, "leaf", 3)
        box(g, fx - 1, 4, fz - 1, fx + 2, 6, fz + 2, fr, 5)
        P.flat(g, P.region(g, fx, 5, fz, fx + 1, 6, fz + 1), "gold", 7)
    # grain sacks against the ramp and the staddles
    for cx, cz, r, h, seed in ((XC - 16, 14, 4.6, 12, 32), (XC - 22, 20, 4.2, 11, 33), (XC + 16, 12, 4.4, 12, 34)):
        sack(g, cx, 0, cz, r, h, ramp="sand", base=6, mark="wheat", seed=seed)
    # spilled grain in a low heap and a hay bale by the silo
    heap = S.cone(g, "y", XC + 22, 18, 5.5, 0, 4, "gold", 4, n=8, r_top=2.0)
    P.flat(g, heap & ((X + Z) % 3 == 0), "gold", 5)
    P.flat(g, heap & (Y == 3), "gold", 6)
    hay_bale(g, SX - 8, 0, SZ - SR - 16, 14, 9, 10, seed=35)
    # a scythe leans on the front left staddle
    g.prism("z", S.quad((X0 + 1, 1), (X0 - 5, 30), 1.0), Z0 - 6, Z0 - 4, C("wood", 4))
    g.prism("z", [(X0 - 5, 30), (X0 + 9, 28), (X0 + 10, 26), (X0 - 3, 27)], Z0 - 6, Z0 - 5, C("steel", 6))
    P.flat(g, S.last(g) & (Y < 27), "steel", 4)


def build() -> Asset:
    g = Grid(W, H, D)
    barn(g)
    front(g)
    silo(g)
    yard(g)
    kx, kz = SKEP
    return Asset(
        id="fantasy-buildings-granary", pack="fantasy", category="buildings", name="Village Granary", root=Part("granary", g),
        sockets=[Socket("socket-function", at=(kx, 28, kz))],
        pfx=[{"effectId": "rvx-fantasy-bee-swarm", "socket": "socket-function", "trigger": "idle", "size": 22}],
    )
