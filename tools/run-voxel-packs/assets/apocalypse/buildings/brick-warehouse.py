"""Derelict brick warehouse, in the Pirate Nation style.

A chunky two-storey block of warm red brick on a stone plinth, with pale
stone quoins, a string course and thick dark eave beams (rules F1, F3).
A steep corrugated gable (true slopes) turns its big end to the front. The
function prop is oversized (rules F4, K1): a hoist beam juts from the gable
peak over a loading hatch, and a giant crate hangs from its hook. A wide,
short barn doorway has one leaf torn off and leaning on the wall. HELP is
painted big on the side, a fire escape zig-zags up the other side (true
slopes), a brick chimney leans (F5), and a roof hole shows broken rafters.
Bricks, planks, ribs and stains are paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import bloom, gable, leg, sandbags, sign, slab
from _bld import crate as bcrate
from pnkit import box, crate, door, edges, face_prism, posts, window
from voxgrid import C, Asset, Grid, Part, bounds_pivot

W, H, D = 142, 128, 104
X0, X1, Z0, Z1 = 22, 112, 34, 88  # brick walls; the front is z = Z0
GROUND, STOREY, WALL_TOP, RIDGE = 3, 38, 72, 112
XM = (X0 + X1) // 2


def warehouse() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = S._idx(g)
    slab(g, 4, 6, 138, 100, h=GROUND, ramp="sand", base=5, seed=1)

    # ---- body: stone plinth, red brick, a string course, stone quoins
    walls = box(g, X0, GROUND, Z0, X1, WALL_TOP, Z1, "red", 5)
    P.stone(g, walls, "red", 5, block=(6, 3), mortar=-1, cracks=0.03, seed=2)
    plinth = box(g, X0 - 1, GROUND, Z0 - 1, X1 + 1, GROUND + 7, Z1 + 1, "stone", 5)
    P.stone(g, plinth, "stone", 5, block=(8, 4), seed=3)
    band = box(g, X0 - 1, STOREY, Z0 - 1, X1 + 1, STOREY + 3, Z1 + 1, "sand", 6)
    P.stone(g, band, "sand", 6, block=(10, 3), seed=4)
    P.flat(g, band & (Y == STOREY), "sand", 4)
    quoins = np.zeros(g.shape, dtype=bool)
    for qx, qz in ((X0 - 2, Z0 - 2), (X1 - 3, Z0 - 2), (X0 - 2, Z1 - 3), (X1 - 3, Z1 - 3)):
        quoins |= box(g, qx, GROUND + 7, qz, qx + 5, WALL_TOP, qz + 5, "sand", 5)
    P.stone(g, quoins, "sand", 5, block=(5, 4), seed=5)
    # a thick dark eave beam all round (rule F3)
    eave = box(g, X0 - 2, WALL_TOP - 3, Z0 - 2, X1 + 2, WALL_TOP + 1, Z1 + 2, "darkwood", 5)
    P.planks(g, eave, "darkwood", 5, width=4, across="y", seed=6)
    # soot and damp stains on the brick (soft blooms, no speckle)
    bloom(g, walls, 7, ((X0, GROUND + 8, Z0), (X1, WALL_TOP - 6, Z1)), r=(3.0, 6.0), ramp="red", shades=(4, 4), seed=7)

    # ---- roof: a steep corrugated gable, its big end to the front
    roof = gable(g, X0 - 2, X1 + 2, Z0 - 2, Z1 + 2, WALL_TOP + 1, RIDGE, ridge="z", thick=4, overhang=6,
                 roof=("teal", 5), style="corrugate", attic=("red", 5), attic_style="brick", seed=8)
    P.stone(g, roof["attic"], "red", 5, block=(6, 3), mortar=-1, seed=9)
    # rust sheets and a hole with broken rafters on the +x slope
    bloom(g, roof["slabs"] & ~roof["trim"], 4, ((X0, WALL_TOP, Z0), (X1, RIDGE, Z1)), r=(7.0, 11.0), ramp="rust", shades=(5, 4), seed=10)
    hole = roof["front"] & (X > XM + 12) & (X < XM + 30) & (Z > 60) & (Z < 76)
    if not hole.any():
        hole = roof["back"] & (X > XM + 12) & (X < XM + 30) & (Z > 60) & (Z < 76)
    P.flat(g, hole, "darkwood", 3)
    for rz in (64, 70):
        ya, yb = RIDGE - 22, RIDGE - 4
        S.bar(g, "z", (XM + 30, ya + 4), (XM + 12, yb + 4), 2.5, rz, rz + 3, "wood", 5)

    # ---- front: barn doorway (one leaf torn off), windows, hatch
    dw0, dw1 = XM - 18, XM + 18
    frame = box(g, dw0 - 3, GROUND, Z0 - 2, dw1 + 3, GROUND + 33, Z0, "darkwood", 4)
    P.planks(g, frame, "darkwood", 4, width=3, across="y", nails=False, seed=11)
    inside = box(g, dw0, GROUND, Z0 - 2, dw1, GROUND + 30, Z0 - 1, "wood", 3)
    P.planks(g, inside, "wood", 3, width=4, across="x", seed=12)  # the dim far wall of the hall
    leaf = box(g, dw0, GROUND, Z0 - 4, XM, GROUND + 30, Z0 - 2, "teal", 5)
    P.planks(g, leaf, "teal", 5, width=4, across="x", length=(40, 41), seed=13)
    P.outline(g, leaf, "teal", 3, normal="z")
    for by in (GROUND + 6, GROUND + 22):
        P.flat(g, leaf & (Y >= by) & (Y < by + 2), "steel", 4)
    # the torn leaf leans against the wall on the right (a tilted slab)
    pts = S.rotate([(dw1 + 5, GROUND), (dw1 + 22, GROUND), (dw1 + 22, GROUND + 30), (dw1 + 5, GROUND + 30)], dw1 + 22, GROUND, -12)
    pts = [(u, max(float(GROUND), v)) for u, v in pts]
    torn = face_prism(g, "-z", Z0 - 1, pts, 1, 3, C("teal", 5))
    P.planks(g, torn, "teal", 5, width=4, across="x", length=(40, 41), seed=14)
    P.outline(g, torn, "teal", 3, normal="z")
    # ground-floor windows: one glowing, one boarded
    window(g, "-z", Z0, X0 + 8, X0 + 22, 14, 30, glass="gold", glow=6)
    window(g, "-z", Z0, X1 - 22, X1 - 8, 14, 30, glass="teal", glow=6)
    for p0, p1 in (((X1 - 24, 16), (X1 - 6, 28)), ((X1 - 24, 27), (X1 - 6, 17))):
        b = S.bar(g, "z", p0, p1, 3, Z0 - 3, Z0 - 1, "wood", 5)
        P.planks(g, b, "wood", 5, width=3, across="y", seed=p0[1])
    # upper windows
    for k, u0 in enumerate((X0 + 5, X1 - 17)):
        window(g, "-z", Z0, u0, u0 + 12, 46, 64, glass=("gold", "teal")[k], glow=6)
    # loading hatch in the gable under the hoist
    hatch = door(g, "-z", Z0 - 2, XM - 9, XM + 9, WALL_TOP + 3, WALL_TOP + 25, leaf="wood", arch=False, seed=15)
    # the HELP board over the door

    # ---- the function prop: a hoist beam from the gable peak, a giant crate on the hook
    hb = box(g, XM - 3, RIDGE - 16, Z0 - 26, XM + 3, RIDGE - 10, Z0 + 2, "darkwood", 4)
    P.planks(g, hb, "darkwood", 4, width=3, across="y", seed=17)
    S.bar(g, "x", (RIDGE - 14, Z0 - 2), (RIDGE - 30, Z0 + 4), 3, XM - 2, XM + 2, "darkwood", 4)  # strut (y, z)
    pulley = S.disc(g, "x", RIDGE - 19, Z0 - 21, 3.5, XM - 2, XM + 2, "gold", 5)
    rope = box(g, XM - 1, 88, Z0 - 22, XM + 1, RIDGE - 19, Z0 - 20, "sand", 4)
    hook = box(g, XM - 3, 85, Z0 - 23, XM + 3, 89, Z0 - 19, "gold", 4)
    bcrate(g, XM - 9, 66, Z0 - 30, 18, icon="skull", ink=("red", 4), seed=18)
    for sx in (XM - 8, XM + 7):  # the sling ropes
        S.bar(g, "z", (sx + 0.5, 84), (XM, 86), 1.5, Z0 - 22, Z0 - 20, "sand", 4)

    # ---- +x side: glowing upper windows, a drainpipe
    sign(g, "+x", X1, (Z0 + Z1) / 2 + 1, 44, "HELP", board=("bone", 6), ink=("red", 4), frame=("darkwood", 5), scale=2, gap=1, pad=2)
    pipe = box(g, X1, GROUND, Z1 - 8, X1 + 3, WALL_TOP - 2, Z1 - 5, "steel", 5)
    P.flat(g, pipe & (Y % 12 == 0), "steel", 3)
    window(g, "+x", X1, Z0 + 8, Z0 + 20, 14, 28, glass="gold", glow=6)

    # ---- back: windows, one boarded, and a back door
    for k, u0 in enumerate((X0 + 10, X0 + 40, X1 - 24)):
        window(g, "+z", Z1, u0, u0 + 14, 46, 64, glass=("gold", "teal", "gold")[k], glow=6)
    window(g, "+z", Z1, X0 + 10, X0 + 24, 14, 30, glass="teal", glow=6)
    door(g, "+z", Z1, X1 - 30, X1 - 12, GROUND, GROUND + 26, leaf="wood", arch=False, seed=40)
    for p0, p1 in (((X0 + 38, 48), (X0 + 56, 62)), ((X0 + 38, 61), (X0 + 56, 49))):
        b = S.bar(g, "z", p0, p1, 3, Z1 + 1, Z1 + 3, "wood", 5)
        P.planks(g, b, "wood", 5, width=3, across="y", seed=p0[1])

    # ---- -x side: a zig-zag fire escape (true slopes)
    xo = X0 - 10
    for k, (y0, zlo, zhi) in enumerate(((GROUND, 42, 78), (STOREY, 42, 78))):
        up = k % 2 == 0
        a, b = (zhi, zlo) if up else (zlo, zhi)
        S.bar(g, "x", (y0 + 2, a), (y0 + STOREY - GROUND - 1, b), 3, xo + 1, xo + 8, "rust", 5)
        pl = box(g, xo, y0 + STOREY - GROUND - 3, b - 6 if up else b - 2, X0 - 1, y0 + STOREY - GROUND - 1, b + 2 if up else b + 6, "rust", 5)
        P.plates(g, pl, "rust", 5, size=(6, 6), seed=k)
        rail = box(g, xo, y0 + STOREY - GROUND - 1, b - 6 if up else b - 2, xo + 1, y0 + STOREY - GROUND + 6, b + 2 if up else b + 6, "rust", 4)
    for pz in (40, 80):
        box(g, xo, GROUND, pz, xo + 2, STOREY + 34, pz + 2, "rust", 4)

    # ---- a leaning brick chimney on the back slope (rule F5)
    cx0, cz0 = X1 - 26, Z1 - 12
    cy0 = RIDGE - 30
    ch = leg(g, cx0, cz0, cx0 + 9, cz0 + 9, cy0, RIDGE + 12, 3.0, 1.5, ramp="red", base=5, planks=False)
    P.stone(g, ch, "red", 5, block=(4, 3), mortar=-2, seed=19)
    box(g, cx0 + 1, RIDGE + 12, cz0, cx0 + 12, RIDGE + 15, cz0 + 11, "stone", 4)

    # ---- small props at the base
    sandbags(g, "x", 110, 134, 12, GROUND, rows=2, h=5, d=7, seed=20)
    bcrate(g, 118, GROUND, 22, 12, seed=21)
    bcrate(g, 120, GROUND + 12, 24, 8, ramp="khaki", base=5, seed=22)
    S.drum(g, 12, 20, GROUND, 17, 7.5, ramp="teal", base=5, band=("bone", 6), seed=23)
    S.drum(g, 126, 60, GROUND, 17, 7.5, ramp="gold", base=5, band=("red", 4), seed=24)
    # a spill of bricks from the collapsed back corner
    for k, (bx, bz, s, a) in enumerate(((116, 92, 9, 18), (124, 84, 7, -25), (108, 96, 6, 30), (128, 94, 5, 12))):
        pts = S.rotate([(bx, GROUND), (bx + s, GROUND), (bx + s, GROUND + s * 0.7), (bx, GROUND + s * 0.7)], bx + s / 2, GROUND, a)
        pts = [(u, max(float(GROUND), v)) for u, v in pts]
        g.prism("z", pts, bz - 3, bz + 3, C("red", 4))
        P.stone(g, S.last(g), "red", 4, block=(5, 3), mortar=-2, seed=30 + k)
    return g


def build() -> Asset:
    g = warehouse()
    root = Part("brick-warehouse", g, pivot=bounds_pivot(g))
    return Asset(id="apocalypse-buildings-brick-warehouse", pack="apocalypse", category="buildings", name="Brick Warehouse", root=root)
