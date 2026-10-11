"""Village well in the Pirate Nation style.

A chunky octagonal stone well (a flared frustum, true slopes) on a paved
apron, with a light capstone ring round a recessed blue water surface. Two
thick timber posts carry a steep red-tiled gable roof (true slopes, planked
gable boards, a dark ridge beam) that clears a person's head. Under the
roof an oversized log windlass with a rope drum and an iron crank on the
right; a stave bucket hangs from it on a rope (rule K3: the crank and the
bucket say "well"). Moss and grass tufts at the foot. PN's wishing well is
the close reference (44×60×41); this is about 38×52×32.
Clips: idle (the bucket sways), active (the crank turns, the bucket drops
into the water and comes back up). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S_
from _life import asset, coords, facet_paint, grass, keys, plan, rig
from pnkit import box, edges
from voxgrid import C, Clip, Grid

S = (48, 60, 44)
CX, CZ = 24.0, 22.0
R0, R1 = 13.5, 12.5  # wall flat radius at the foot and at the top
WALL = (1, 11)  # wall y
RIM = (11, 14)  # capstone ring y (the water sits at the wall top, 3 below the rim)
R_IN = 9.5  # water radius
PX = (CX - 12, CX + 12)  # post centres x
POST_TOP = 45
AY = 30.0  # windlass axle height
AR = 2.6  # axle flat radius
EAVE, RIDGE = 36.0, 49.0  # roof underside at the eave and at the ridge
EZ = 15.5  # eave half-span in z
RX = (CX - 16, CX + 16)  # roof x extent
T = 3.0  # roof slab thickness (vertical)
BY = 14.0  # bucket bottom


def ring(g: Grid, cx, cz, r_out, r_in, y0, y1, ramp, shade, n=8):
    """An n-gon ring (two C-shaped prisms along y)."""
    outer = S_.flat_ngon(cx, cz, r_out, n)
    inner = S_.flat_ngon(cx, cz, r_in, n)
    m = np.zeros(g.shape, dtype=bool)
    start = len(g.solids)
    for half in (range(0, n // 2 + 1), range(n // 2, n + 1)):
        ks = [k % n for k in half]
        pts = [outer[k] for k in ks] + [inner[k] for k in reversed(ks)]
        m |= plan(g, pts, y0, y1, ramp, shade)
    return m, g.solids[start:]


def well() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # a paved apron
    apron = plan(g, S_.flat_ngon(CX, CZ, 16.5, 8), 0, 1, "stone", 4)
    P.stone(g, apron, "stone", 4, block=(5, 4), frame="top", seed=1)
    # the flared wall: an octagonal frustum, stone blocks along every facet
    start = len(g.solids)
    wall = plan(g, S_.flat_ngon(CX, CZ, R0, 8), WALL[0], WALL[1], "stone", 5, top=S_.flat_ngon(CX, CZ, R1, 8))
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(6, 3), cracks=0.08, frame=fr, seed=2))
    P.flat(g, wall & S_.seams(g, g.solids[start:], 0.7) & (Y < WALL[1] - 0.5), "stone", 4)
    # moss creeping up from the foot, in soft 3-voxel cells (no speckle)
    ang = np.floor((np.arctan2(Z - CZ, X - CX) + math.pi) / (2 * math.pi) * 24).astype(int)
    lift = (P._hash(ang, seed=3) % np.uint64(3)).astype(int)
    P.flat(g, wall & (Y < WALL[0] + 1.2 + lift), "moss", 5)
    P.flat(g, wall & (Y < WALL[0] + 0.8 + lift * 0.5) & (lift == 2), "moss", 4)
    # the water surface on the wall top, with a light ripple ring and a glint
    rr = np.hypot(X - CX, Z - CZ)
    water = wall & (Y > WALL[1] - 1) & (rr < R_IN + 1.0)
    P.flat(g, water, "sky", 4)
    P.flat(g, water & (np.abs(rr - 4.5) < 0.6), "sky", 5)
    P.flat(g, water & (rr < 1.6), "sky", 6)
    P.flat(g, water & (np.abs(X - CX + 3) < 0.8) & (np.abs(Z - CZ + 3) < 1.6), "sky", 7)
    # the capstone ring
    rim, rim_solids = ring(g, CX, CZ, R1 + 1.0, R_IN, RIM[0], RIM[1], "stone", 6)
    facet_paint(g, rim_solids, lambda gg, mm, fr: P.stone(gg, mm, "stone", 6, block=(5, 3), frame=fr, seed=4))
    P.flat(g, rim & (Y > RIM[1] - 1), "stone", 7)
    P.flat(g, rim & (Y > RIM[1] - 1) & S_.seams(g, rim_solids, 0.7), "stone", 5)
    P.flat(g, rim & (Y < RIM[0] + 1) & (rr > R1 + 0.2), "stone", 4)
    # two thick posts on the rim, a dark foot block and a cap each
    for px in PX:
        post = box(g, px - 1.5, RIM[1], CZ - 1.5, px + 1.5, POST_TOP, CZ + 1.5, "wood", 4)
        P.planks(g, post, "wood", 4, width=3, across="x", nails=False, seed=5)
        P.flat(g, edges(post), "darkwood", 3)
        foot = box(g, px - 2.5, RIM[1], CZ - 2.5, px + 2.5, RIM[1] + 2, CZ + 2.5, "darkwood", 3)
        P.flat(g, edges(foot), "darkwood", 2)
        # the axle bearing block
        brg = box(g, px - 2, AY - 3, CZ - 2.5, px + 2, AY + 3, CZ + 2.5, "darkwood", 4)
        P.flat(g, edges(brg), "darkwood", 2)
        P.flat(g, brg & (np.abs(Y - AY) < 1.2) & (np.abs(Z - CZ) < 1.2), "iron", 5)
    # the ridge beam on the post tops
    rb = box(g, RX[0] - 1, POST_TOP, CZ - 2, RX[1] + 1, POST_TOP + 3, CZ + 2, "darkwood", 3)
    P.planks(g, rb, "darkwood", 3, width=3, across="y", seed=6)
    # the roof: two tiled slabs (true slopes), barge ends and a lower lip
    ridge_top = RIDGE
    for sgn in (-1, 1):
        ze = CZ + sgn * EZ
        pts = [(EAVE, ze), (EAVE + T, ze), (ridge_top + T, CZ), (ridge_top, CZ)]
        g.prism("x", pts, RX[0], RX[1], C("red", 4))
        slab = g.solids[-1].mask(g.shape)
        down = (0.0, EAVE - ridge_top, ze - CZ)
        P.tiles(g, slab, "red", 4, row=4, width=5, frame=((1, 0, 0), down), seed=7 + sgn)
        P.flat(g, slab & ((X < RX[0] + 2) | (X > RX[1] - 2)), "darkwood", 3)
        P.flat(g, slab & ((X < RX[0] + 1) | (X > RX[1] - 1)) & (Y > ridge_top + 1), "darkwood", 4)
        P.flat(g, slab & (Y < EAVE + 1.0), "red", 2)
    # the ridge cap
    cap = box(g, RX[0] - 1, ridge_top + T - 1, CZ - 1.5, RX[1] + 1, ridge_top + T + 1, CZ + 1.5, "darkwood", 4)
    P.planks(g, cap, "darkwood", 4, width=2, across="y", nails=False, seed=8)
    # planked gable boards under both roof ends
    for gx0 in (RX[0] + 2, RX[1] - 4):
        tri = [(EAVE + 2.5, CZ - EZ + 3.2), (EAVE + 2.5, CZ + EZ - 3.2), (ridge_top + 0.5, CZ)]
        g.prism("x", tri, gx0, gx0 + 2, C("wood", 5))
        gb = g.solids[-1].mask(g.shape)
        P.planks(g, gb, "wood", 5, width=3, across="z", frame="x", length=(30, 31), nails=False, seed=9)
        P.flat(g, gb & (Y < EAVE + 3.5), "darkwood", 3)
    # grass tufts at the foot
    grass(g, [(int(CX - 14), 1, int(CZ - 8)), (int(CX + 12), 1, int(CZ - 11)), (int(CX + 15), 1, int(CZ + 5))], "leaf", 4)
    return g


def axle() -> Grid:
    """The log windlass with a rope drum and an iron crank on the right."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    x0, x1 = PX[0] - 1.5, PX[1] + 3.0
    log = S_.disc(g, "x", AY, CZ, AR, int(x0), int(x1), "wood", 5)
    P.planks(g, log, "wood", 5, width=2, across="x", frame="x", length=(30, 31), nails=False, seed=10)
    drum = log & (np.abs(X - CX) < 5.5)
    P.flat(g, drum, "sand", 5)
    P.flat(g, drum & (np.floor(X).astype(int) % 2 == 0), "sand", 4)
    P.flat(g, log & (np.abs(np.abs(X - CX) - 6.0) < 0.6), "iron", 5)
    # the crank: an iron arm down from the axle end and a wooden handle
    ex = int(x1)
    arm = S_.bar(g, "x", (AY, CZ), (AY - 6.5, CZ - 2.0), 2.0, ex, ex + 2, "iron", 5)
    P.flat(g, arm, "iron", 5)
    P.flat(g, arm & (Y > AY - 1), "steel", 5)
    hnd = box(g, ex + 2, AY - 8, CZ - 3, ex + 6, AY - 5, CZ, "darkwood", 4)
    P.flat(g, hnd & (X > ex + 5), "darkwood", 3)
    cap = box(g, ex - 1, AY - 1.5, CZ - 1.5, ex, AY + 1.5, CZ + 1.5, "iron", 4)
    P.flat(g, cap, "iron", 4)
    return g


def rope() -> Grid:
    g = Grid(*S)
    _X, Y, _Z = coords(g)
    m = box(g, CX - 0.5, BY + 9, CZ - AR - 0.5, CX + 0.5, AY, CZ - AR + 0.5, "sand", 5)
    P.flat(g, m & (np.floor(Y).astype(int) % 2 == 0), "sand", 4)
    return g


def bucket() -> Grid:
    """A stave bucket with iron hoops, water in it and a bail handle."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    bz = CZ - AR
    start = len(g.solids)
    body = plan(g, S_.flat_ngon(CX, bz, 3.0, 8), BY, BY + 6, "wood", 5, top=S_.flat_ngon(CX, bz, 3.8, 8))
    ang = np.floor((np.arctan2(Z - bz, X - CX) + math.pi) / (2 * math.pi) * 16).astype(int)
    P._paint(g, body, "wood", 5 + np.array([0, -1, 0, 1])[ang % 4])
    for hy in (BY + 1, BY + 4):
        P.flat(g, body & (Y >= hy) & (Y < hy + 1), "iron", 4)
    P.flat(g, body & (Y > BY + 5) & (np.hypot(X - CX, Z - bz) < 2.6), "sky", 5)
    # the bail: two side straps and a bar over the top
    for sx in (-1, 1):
        box(g, CX + sx * 3.5 - 0.5, BY + 5, bz - 0.5, CX + sx * 3.5 + 0.5, BY + 9, bz + 0.5, "iron", 5)
    box(g, CX - 3.5, BY + 8, bz - 0.5, CX + 3.5, BY + 9, bz + 0.5, "iron", 5)
    return g


def build():
    w, a, r, b = well(), axle(), rope(), bucket()
    hang = (CX, AY, CZ - AR)
    root, _to_root = rig([("well", w, None, None), ("axle", a, (CX, AY, CZ), None), ("rope", r, hang, None), ("bucket", b, hang, None)])
    drop = 7.0
    length = AY - (BY + 9)
    stretch = (length + drop) / length
    idle = {"bucket": {"rot": keys((0, 0, 0, 0), (1.0, 0, 0, 5), (2.0, 0, 0, 0), (3.0, 0, 0, -5), (4.0, 0, 0, 0))},
            "rope": {"rot": keys((0, 0, 0, 0), (1.0, 0, 0, 5), (2.0, 0, 0, 0), (3.0, 0, 0, -5), (4.0, 0, 0, 0))}}
    down = [(0.3 * k, 90.0 * k, 0, 0) for k in range(5)]
    up = [(1.6 + 0.3 * k, 360.0 - 90.0 * k, 0, 0) for k in range(5)]
    active = {"axle": {"rot": keys(*down, (1.6, 360, 0, 0), *up[1:], (3.2, 0, 0, 0))},
              "bucket": {"loc": keys((0, 0, 0, 0), (1.2, 0, -drop, 0), (1.6, 0, -drop, 0), (2.8, 0, 0, 0), (3.2, 0, 0, 0))},
              "rope": {"scale": keys((0, 1, 1, 1), (1.2, 1, stretch, 1), (1.6, 1, stretch, 1), (2.8, 1, 1, 1), (3.2, 1, 1, 1))}}
    return asset("animated-props", "well", "Village Well", root, clips=[Clip("idle", idle), Clip("active", active)])
