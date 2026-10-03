"""Derelict warehouse (a corrugated shed), in the Pirate Nation style.

A long, tall shed of blue corrugated sheet on a concrete loading dock,
framed by thick steel posts (rule F3), under a steep rust-red corrugated
gable (true slopes) with skylights and a turbine vent. A drive-in roller
door a truck fits through, a dock door jammed half open, a two-storey
office lean-to (a true slope) with lit windows, drainpipes and a fire
ladder. The function prop is oversized (rules F4, K1): a huge crooked
DEPOT 9 board hangs from the eave on two chains and swings on `idle`.
Ribs, plates, stripes and rust are paint (S1). Faces -Z (the dock side).
"""
import numpy as np

import paint as P
import pnpaint
import pnshapes as S
from _bld import bloom, crate, gable, label, part, sign
from pnkit import box, door, edges, window
from voxgrid import C, Asset, Clip, Grid, Part, bounds_pivot

W, H, D = 176, 116, 124
X0, X1, Z0, Z1 = 22, 140, 38, 100
DOCK, WALL_TOP, RIDGE = 8, 56, 94
OX1 = 164  # the office lean-to runs from X1 to OX1
SIGN_X, SIGN_Y = 84, WALL_TOP + 30  # the sign hinge (on brackets over the eave)
SIGN_Z = Z0 - 14


def shed() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = S._idx(g)
    # ---- the loading dock: raised concrete with a hazard edge and bumpers
    dock = box(g, 4, 0, 12, 172, DOCK, 116, "sand", 5)
    pnpaint.concrete(g, dock, "sand", 5, size=16, cracks=10, seed=1)
    P.outline(g, dock, "sand", 3, normal="y")
    pnpaint.hazard(g, dock & (Z < 14) & (Y >= DOCK - 3), period=8, a=("gold", 5), b=("darkwood", 4))
    for bx in (30, 44, 100, 114):
        box(g, bx, 1, 10, bx + 5, 7, 12, "gray", 4)
    for k in range(3):  # steps up to the dock at the -x end
        box(g, 4 + 0, 0, 2 + 3 * k, 20, DOCK - 2 * k, 12, "sand", 4)

    # ---- the shed: blue corrugated walls, thick steel posts
    walls = box(g, X0, DOCK, Z0, X1, WALL_TOP, Z1, "sky", 5)
    pnpaint.corrugate(g, walls, "sky", 5, period=3, sheet=14, length=48, seed=2)
    P.flat(g, walls & (Y < DOCK + 3), "sky", 3)
    for px in (X0 - 2, 60, 100, X1 - 2):
        for pz in (Z0 - 2, Z1 - 2):
            post = box(g, px, DOCK, pz, px + 4, WALL_TOP, pz + 4, "steel", 5)
            P.plates(g, post, "steel", 5, size=(4, 10), seed=px)
    eave = box(g, X0 - 3, WALL_TOP - 3, Z0 - 3, X1 + 3, WALL_TOP + 1, Z1 + 3, "steel", 5)
    P.plates(g, eave, "steel", 5, size=(12, 4), seed=3)
    bloom(g, walls, 9, ((X0, DOCK, Z0), (X1, WALL_TOP, Z1)), r=(3.0, 6.0), ramp="rust", shades=(5, 4), seed=4)

    # ---- roof: a steep rust-red corrugated gable, skylights, a turbine vent
    roof = gable(g, X0 - 3, X1 + 3, Z0 - 3, Z1 + 3, WALL_TOP + 1, RIDGE, ridge="x", thick=4, overhang=6, roof=("red", 4), style="corrugate",
                 attic=("sky", 5), attic_style="plates", trim=("steel", 5), seed=5)
    for sx in (38, 70, 102):
        P.flat(g, roof["front"] & (X >= sx) & (X < sx + 12) & (Y > WALL_TOP + 14) & (Y < WALL_TOP + 26), "sky", 7)
        P.flat(g, roof["front"] & (X >= sx) & (X < sx + 12) & (Y > WALL_TOP + 14) & (Y < WALL_TOP + 26) & ((X - sx) % 4 == 0), "steel", 5)
    bloom(g, roof["slabs"] & ~roof["trim"], 5, ((X0, WALL_TOP, Z0), (X1, RIDGE, Z1)), r=(4.0, 7.0), ramp="rust", shades=(5, 4), seed=6)
    zc = (Z0 + Z1) / 2
    S.disc(g, "y", 120, zc, 4, RIDGE, RIDGE + 8, "steel", 5)
    tv = S.dome(g, 120, zc, RIDGE + 8, 7, h=8, n=8, rings=2, ramp="steel", base=6, painter=lambda gg, mm, fr: P.flat(gg, mm, "steel", 6), ribs=("steel", 4))

    # ---- front: a drive-in roller door and a dock door jammed half open
    for u0, u1, top, half in ((30, 66, DOCK + 38, False), (86, 112, DOCK + 30, True)):
        fr = box(g, u0 - 4, DOCK, Z0 - 2, u1 + 4, top + 4, Z0, "gold", 5)
        pnpaint.hazard(g, fr, period=8, a=("gold", 5), b=("darkwood", 4))
        P.flat(g, fr & (X >= u0) & (X < u1) & (Y < top), "wood", 3)  # the dim inside
        y0 = DOCK + (top - DOCK) // 2 if half else DOCK
        d = box(g, u0, y0, Z0 - 3, u1, top, Z0 - 1, "steel", 6)
        P.flat(g, d & (Y % 3 == 0), "steel", 4)
        P.flat(g, d & (Y == y0), "darkwood", 5)
        box(g, u0 - 2, top, Z0 - 6, u1 + 2, top + 5, Z0 - 2, "steel", 4)  # the roll box
    crate(g, 90, DOCK, Z0 - 12, 11, ramp="sand", base=5, seed=7)
    crate(g, 102, DOCK, Z0 - 14, 9, ramp="khaki", base=5, seed=8)
    window(g, "-z", Z0, 118, 132, 30, 44, frame="steel", glass="teal", glow=6)

    # ---- the office lean-to: two storeys, a single steep slope
    ow = box(g, X1, DOCK, Z0 + 6, OX1, 76, Z1 - 12, "bone", 6)
    P.plates(g, ow, "bone", 6, size=(12, 10), rivets=False, seed=9)
    P.flat(g, ow & (Y >= 40) & (Y < 43), "teal", 5)
    g.prism("z", [(X1 - 2, 90), (OX1 + 5, 72), (OX1 + 5, 76), (X1 - 2, 94)], Z0 + 2, Z1 - 8, C("teal", 5))
    lr = S.last(g)
    for m, fr in S.facets(g):
        pnpaint.corrugate(g, m, "teal", 5, period=3, sheet=12, length=40, frame=fr, seed=10)
    for storey, v0 in enumerate((20, 50)):
        for u0 in (Z0 + 12, Z0 + 32):
            window(g, "+x", OX1, u0, u0 + 12, v0, v0 + 14, glass=("gold", "teal")[(storey + u0) % 2], glow=6)
    door(g, "-z", Z0 + 6, X1 + 5, X1 + 19, DOCK, DOCK + 26, leaf="teal", arch=False, seed=11)

    # ---- -x end: a fire ladder and a drainpipe
    for lz in (60, 68):
        box(g, X0 - 5, DOCK, lz, X0 - 3, WALL_TOP + 8, lz + 2, "rust", 5)
    for ly in range(DOCK + 4, WALL_TOP + 6, 5):
        box(g, X0 - 5, ly, 60, X0 - 3, ly + 1, 70, "rust", 4)
    for pz in (Z0 + 2, Z1 - 5):
        box(g, X0 - 3, DOCK, pz, X0, WALL_TOP - 2, pz + 3, "steel", 4)
    window(g, "+z", Z1, 44, 58, 30, 44, frame="steel", glass="gold", glow=6)
    window(g, "+z", Z1, 100, 114, 30, 44, frame="steel", glass="teal", glow=6)

    # ---- two brackets from the roof carry the DEPOT 9 board
    for bx in (SIGN_X - 36, SIGN_X + 34):
        S.bar(g, "x", (SIGN_Y + 4, SIGN_Z), (SIGN_Y - 10, Z0 + 12), 3, bx, bx + 3, "steel", 4)
        box(g, bx, SIGN_Y + 2, SIGN_Z, bx + 3, SIGN_Y + 5, SIGN_Z + 4, "steel", 3)

    # ---- props on the dock
    S.drum(g, 10, 28, DOCK, 17, 7, ramp="red", base=4, band=("gold", 5), seed=12)
    S.drum(g, 12, 44, DOCK, 17, 7, ramp="teal", base=5, band=("bone", 6), seed=13)
    for k in range(3):  # a pallet stack
        pal = box(g, 148, DOCK + 3 * k, 16, 166, DOCK + 3 * k + 2, 30, "wood", 5)
        P.planks(g, pal, "wood", 5, width=3, across="x", seed=20 + k)
    return g


def depot_sign() -> Grid:
    """The DEPOT 9 board and its two chains, hanging under the hinge."""
    g = Grid(W, H, D)
    z0 = SIGN_Z
    by1 = SIGN_Y - 8
    b = sign(g, "-z", z0 + 3, SIGN_X, by1 - 22, "DEPOT 9", board=("gold", 5), ink=("darkwood", 4), frame=("red", 4), scale=2, gap=1, pad=4, depth=3)
    xs = np.nonzero(b.any(axis=(1, 2)))[0]
    for cx in (xs.min() + 4, xs.max() - 5):
        box(g, cx, by1, z0 + 1, cx + 2, SIGN_Y + 1, z0 + 2, "steel", 4)
    box(g, xs.min() + 2, SIGN_Y, z0, xs.max() - 2, SIGN_Y + 3, z0 + 3, "steel", 5)  # the hanging bar
    return g


def build() -> Asset:
    g = shed()
    pivot = bounds_pivot(g)
    root = Part("warehouse-shed", g, pivot=pivot)
    # the bar is bolted to the eave; the board hangs crooked and swings
    part(root, "sign", depot_sign(), (SIGN_X, SIGN_Y + 1, SIGN_Z + 1.5), rot=(0.0, 0.0, 4.0))
    swing = [(0.0, (0.0, 0.0, 3.0)), (1.5, (0.0, 0.0, -1.0)), (3.0, (0.0, 0.0, 3.0))]
    return Asset(id="apocalypse-buildings-warehouse-shed", pack="apocalypse", category="buildings", name="Derelict Warehouse", root=root,
                 clips=[Clip("idle", {"sign": {"rot": swing}})])
