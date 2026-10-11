"""Medieval timber treadwheel crane in the Pirate Nation style.

A cathedral-yard hoist. A heavy oak frame of chunky corner posts, raking
struts and head beams stands on a battered stone plinth under a steep
red-tiled hood with cream plaster gables, each painted with the yard's
quartered blue-and-gold arms (rule S1: detail is paint). The front is left
open, so the big pale walk-in treadwheel shows: a twelve-sided tread band
with painted cross slats and a worn bone walking surface, six dark spokes
on each rim and a gold-capped hub in a steel-strapped bearing. The same
log axle carries a rope drum with painted coils, steel flanges and a
ratchet gear with a pawl dropped into it. The rope leaves the drum, runs
up to a gold sheave in the head of a long raking jib and drops to a
riveted hook block that slings a dressed stone block well clear of the
frame (rule K3: the wheel, the drum and the hanging block say "crane").
A royal blue pennant flies from the front left corner, a torch burns in a
steel sconce beside it, a ladder and a plastered board close the back, and
a barrel, a spare block and a crate wait in the yard. About 37 wide, 68
tall and 68 long (a person is 36). Faces -Z.
Clips: idle (the slung block sways and twists on the rope), spin (the
wheel and the drum wind a turn and a half and the block rises, then they
pay it back out; the loop closes).
Effects: the torch flame at socket-torch.
"""
import math

import numpy as np

import paint as P
import pnshapes as S_
from _life import asset, coords, facet_paint, grass, keys, pfx, plan, rig
from _props import brace, glyph, plank_box, stone_box
from pnkit import barrel, box, crate, edges, pennant
from voxgrid import C, Clip, Grid, Socket, sway

S = (38, 72, 72)

# --- the housing -----------------------------------------------------
HX = (3, 35)  # the frame footprint in x
HZ = (37, 67)  # and in z
PX = ((3, 7), (31, 35))  # the two post/rail lines in x
PZ = ((37, 41), (63, 67))  # the two post lines in z
SILL = (3, 7)  # sill beam y
RAIL = (21, 29)  # the side rails that carry the axle
HEAD = (44, 48)  # head beam y
EAVE, RIDGE, RZ, RT = 48.0, 62.0, 56.0, 3.5  # the hood: eave, ridge, ridge z, slab
# --- the wheel and the drum ------------------------------------------
AY, CZ = 24.0, 52.0  # the axle centre
R, NW = 14.5, 12  # the tread band: flat radius, facets
RIN = 9.0  # the inside of the band (the surface you walk on)
WX = (11, 21)  # the wheel width in x
DX = (22, 28)  # the rope drum in x
DR = 4.2
GX = (28, 30)  # the ratchet gear in x
# --- the jib ---------------------------------------------------------
JX = (22, 28)  # the jib, the rope and the hoist in x
JIB0, JIB1 = (44.0, 39.0), (66.0, 13.0)  # the jib foot and head (y, z)
SHV, SHR = (62.0, 12.0), 4.0  # the sheave centre (y, z) and flat radius
FZ = SHV[1] - SHR  # 8.0: the hoisting rope hangs off the front of the sheave
HOOK = (38.0, 42.0)  # the hook block y
BLOCK = (26.0, 36.0)  # the slung stone block y
LIFT = 8.0  # how far it rises in `spin`
TORCH = (5.0, 31.0)  # the torch flame centre (x, z)


def _ring(g: Grid, cu, cv, r_out, r_in, x0, x1, ramp, shade, n=NW):
    """An n-gon ring along x (two C-shaped prisms): the tread band."""
    outer = S_.flat_ngon(cu, cv, r_out, n, math.pi)
    inner = S_.flat_ngon(cu, cv, r_in, n, math.pi)
    m = np.zeros(g.shape, dtype=bool)
    start = len(g.solids)
    for half in (range(0, n // 2 + 1), range(n // 2, n + 1)):
        ks = [k % n for k in half]
        g.prism("x", [outer[k] for k in ks] + [inner[k] for k in reversed(ks)], x0, x1, C(ramp, shade))
        m |= g.solids[-1].mask(g.shape)
    return m, g.solids[start:]


# ------------------------------------------------------------------ the frame
def housing() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(v).astype(np.int64) for v in (X, Y, Z))

    # a battered coursed plinth with paved coping and moss in the joints
    start = len(g.solids)
    plan(g, [(1, 35), (37, 35), (37, 69), (1, 69)], 0, 3, "stone", 4,
         top=[(2, 36), (36, 36), (36, 68), (2, 68)])
    plinth = g.solids[-1].mask(g.shape)
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 4, block=(7, 3), cracks=0.08, frame=fr, seed=1))
    P.stone(g, plinth & (Y > 2), "stone", 6, block=(6, 6), frame="top", seed=2)
    P.flat(g, plinth & (Y > 2) & ((P._hash(Xi // 3, Zi // 3, seed=3) % np.uint64(4)) == 0), "moss", 5)
    P.flat(g, plinth & (Y < 1), "stone", 3)

    # sill beams, then four chunky corner posts (the dark frame, rule F3)
    for x0, x1 in PX:
        plank_box(g, x0, SILL[0], HZ[0], x1, SILL[1], HZ[1], "wood", 4, across="x", width=4, seed=4)
    for z0, z1 in PZ:
        plank_box(g, HX[0], SILL[0], z0, HX[1], SILL[1], z1, "wood", 4, across="x", width=4, seed=5)
    for x0, x1 in PX:
        for z0, z1 in PZ:
            post = box(g, x0, SILL[1], z0, x1, HEAD[0], z1, "wood", 3)
            P.planks(g, post, "wood", 3, width=4, across="x", nails=False, seed=6)
            P.flat(g, edges(post), "darkwood", 2)
            P.flat(g, post & (Y < SILL[1] + 3), "steel", 3)  # a steel shoe
            P.flat(g, post & (Y >= SILL[1] + 1) & (Y < SILL[1] + 2), "steel", 5)

    # low knee braces at the front feet, knees and a long rake up the back
    braces = np.zeros(S, dtype=bool)
    for p0, p1, z0, z1 in ((( 7, 8), (12, 19), PZ[0][0], PZ[0][1]),
                           ((31, 8), (26, 19), PZ[0][0], PZ[0][1]),
                           (( 7, 36), (15, HEAD[0]), PZ[1][0], PZ[1][1]),
                           ((31, 36), (23, HEAD[0]), PZ[1][0], PZ[1][1]),
                           ((33, 9), (22, HEAD[0] - 1), PZ[1][0], PZ[1][1])):
        braces |= brace(g, "z", p0, p1, 3.2, z0, z1, "wood", 4)
    P.planks(g, braces, "wood", 4, width=3, across="y", length=(14, 18), seed=7)
    P.flat(g, edges(braces), "darkwood", 3)

    # two raking struts a side carry the bearing, and the head beams run all round
    for x0, x1 in PX:
        for zf, zb in ((HZ[0] + 2, 47.0), (HZ[1] - 2, 57.0)):
            st = S_.bar(g, "x", (SILL[1] + 3, zf), (RAIL[0] + 1, zb), 3.4, x0, x1, "wood", 4)
            P.planks(g, st, "wood", 4, width=3, across="z", frame="x", length=(14, 18), nails=False, seed=8)
            P.flat(g, edges(st), "darkwood", 3)
        plank_box(g, x0, HEAD[0], HZ[0], x1, HEAD[1], HZ[1], "wood", 3, across="y", width=4, seed=9)
    for z0, z1 in PZ:
        hb = plank_box(g, HX[0], HEAD[0], z0, HX[1], HEAD[1], z1, "wood", 3, across="y", width=4, seed=10)
        P.flat(g, hb & (Y > HEAD[1] - 1.2), "wood", 5)
        for ix in (10, 19, 28):  # steel straps over the head beam
            P.flat(g, hb & (np.abs(X - ix) < 1.0), "steel", 3)

    # a steep red-tiled hood over the wheel housing (rule F4: a tall roof),
    # open at the front where the jib springs
    for sgn in (-1, 1):
        ze = RZ + sgn * 14.0
        g.prism("x", [(EAVE, ze), (EAVE + RT, ze), (RIDGE + RT, RZ), (RIDGE, RZ)], 1, 37, C("red", 4))
        slab = g.solids[-1].mask(g.shape)
        P.tiles(g, slab, "red", 4, row=4, width=5, frame=((1, 0, 0), (0.0, EAVE - RIDGE, ze - RZ)), seed=22 + sgn)
        P.flat(g, slab & ((X < 3) | (X > 35)), "darkwood", 3)  # barge ends
        P.flat(g, slab & ((X < 2) | (X > 36)) & (Y > RIDGE), "darkwood", 4)
        P.flat(g, slab & (Y < EAVE + 1.2), "red", 2)  # the dark eave lip
    cap = box(g, 1, RIDGE + RT - 1, RZ - 1.6, 37, RIDGE + RT + 1, RZ + 1.6, "darkwood", 4)
    P.planks(g, cap, "darkwood", 4, width=2, across="y", nails=False, seed=24)
    for gx0 in (3, 33):  # cream plaster gables with a red sill and the yard's arms
        g.prism("x", [(EAVE + 1.0, RZ - 12.0), (EAVE + 1.0, RZ + 12.0), (RIDGE + 0.5, RZ)], gx0, gx0 + 2, C("bone", 5))
        gb = g.solids[-1].mask(g.shape)
        P.planks(g, gb, "bone", 5, width=5, across="z", frame="x", length=(30, 31), nails=False, seed=25)
        P.flat(g, gb & (Y < EAVE + 2.6), "red", 3)
        P.flat(g, gb & (Y > RIDGE - 2.0), "red", 3)
        gu, gv = Z - RZ, (Y - 50.0) / 8.0
        ghw = np.where(gv > 0.4, 3.6, 3.6 * np.clip(gv / 0.4, 0, 1))
        gs = gb & (gv >= 0) & (gv <= 1) & (np.abs(gu) <= ghw)
        P.flat(g, gs, "blue", 5)
        P.flat(g, gs & (((gu < 0) & (gv > 0.55)) | ((gu >= 0) & (gv <= 0.55))), "gold", 4)
        P.outline(g, gs, "darkwood", 2, normal="x")

    # the two bearing blocks: timber housings with a steel strap round the axle
    rad = S_.radial(g, "x", AY, CZ)
    for bx0, bx1 in ((2, 8), (30, 36)):
        brg = box(g, bx0, 18, 46, bx1, 30, 58, "wood", 4)
        P.planks(g, brg, "wood", 4, width=3, across="y", seed=11)
        P.flat(g, edges(brg), "darkwood", 3)
        P.flat(g, brg & (rad < 5.6), "steel", 5)
        P.flat(g, brg & (rad < 5.6) & (rad > 4.4), "steel", 3)

    # the pawl, on a bracket off the right rail, dropped into the ratchet gear
    brk = box(g, 29, 29, 56, 31, 38, 60, "wood", 4)
    P.flat(g, edges(brk), "darkwood", 3)
    pawl = S_.bar(g, "x", (36.0, 58.0), (31.0, 54.0), 2.2, 29, 31, "steel", 4)
    P.flat(g, pawl, "steel", 4)
    P.flat(g, pawl & (Y < 33), "steel", 6)

    # the bolster the jib springs from, the jib, its back stay and the sheave
    bol = plank_box(g, 21, HEAD[0], 35, 29, HEAD[1] + 3, 42, "wood", 3, across="y", width=3, seed=12)
    P.flat(g, bol & (Y > HEAD[1] + 1.4), "wood", 5)
    jib = S_.bar(g, "x", JIB0, JIB1, 5.0, JX[0], JX[1], "wood", 5)
    down = (0.0, JIB1[0] - JIB0[0], JIB1[1] - JIB0[1])
    P.planks(g, jib, "wood", 5, width=4, across="z", frame=((1, 0, 0), down), nails=True, seed=13)
    P.flat(g, edges(jib), "darkwood", 3)
    along = (Y - JIB0[0]) / (JIB1[0] - JIB0[0])
    for t in (0.2, 0.5, 0.8):  # steel bands down the jib
        P.flat(g, jib & (np.abs(along - t) < 0.035), "steel", 3)
    stay = S_.bar(g, "x", (59.0, 22.0), (HEAD[1], 43.0), 3.0, 23, 27, "wood", 4)
    P.planks(g, stay, "wood", 4, width=3, across="z", frame="x", length=(20, 24), nails=False, seed=14)
    P.flat(g, edges(stay), "darkwood", 3)
    # the rope from the drum up to the sheave (one straight fall, the drum's plane)
    d = math.hypot(SHV[0] - AY, SHV[1] - CZ)
    tangent = (AY + DR * (SHV[0] - AY) / d, CZ + DR * (SHV[1] - CZ) / d)
    rope = S_.bar(g, "x", tangent, SHV, 1.8, 24, 26, "sand", 6)
    P.flat(g, rope, "sand", 6)
    P.flat(g, rope & ((Yi + Zi) % 3 == 0), "sand", 4)
    # the sheave: a gold wheel between two steel cheeks, let into the jib head
    for cx0, cx1 in ((22, 23), (27, 28)):
        ch = S_.disc(g, "x", SHV[0], SHV[1], SHR - 1.2, cx0, cx1, "steel", 4)
        P.flat(g, ch, "steel", 4)
        P.flat(g, ch & (S_.radial(g, "x", *SHV) < 1.8), "steel", 6)
    shv = S_.disc(g, "x", SHV[0], SHV[1], SHR, 23, 27, "gold", 4)
    srad = S_.radial(g, "x", *SHV)
    P.flat(g, shv, "gold", 4)
    P.flat(g, shv & (srad > SHR - 1.3), "gold", 6)
    P.flat(g, shv & (srad < 1.5), "gold", 2)

    # a planked sign board closes the left front bay (a big flat field, rule S1),
    # with the yard's blue-and-gold arms nailed on it (rules C3 and K1)
    # a plastered board closes the back bay, with the yard's mark on it
    bb = box(g, 22, 31, HZ[1], 31, HEAD[0], HZ[1] + 2, "bone", 5)
    P.planks(g, bb, "bone", 5, width=4, across="y", nails=False, seed=20)
    P.flat(g, edges(bb), "red", 3)
    glyph(g, "+z", float(HZ[1] + 2), 24, 34, "tower", "blue", 5, scale=2)
    # a red pennant on the front left corner
    pennant(g, 4, HEAD[1] - 2, 33, 15, 8, "blue", 5)

    # a torch in a steel sconce on the front left post (rule C3: a vivid accent)
    sc = box(g, 4, 26, 35, 6, 30, 37, "steel", 4)
    P.flat(g, sc & (Y > 28), "steel", 6)
    P.flat(g, edges(sc), "steel", 2)
    shaft = S_.bar(g, "x", (26.0, 36.0), (36.0, TORCH[1] + 0.5), 2.4, 4, 6, "darkwood", 4)
    P.flat(g, shaft, "darkwood", 4)
    P.flat(g, shaft & (Y > 33), "darkwood", 2)
    P.flat(g, shaft & (Y > 32) & (Y < 33.2), "steel", 4)
    # the flame: three stepped tiers, red at the root, orange, then a gold tip
    for y0, y1, r0, r1, dz, ramp, shade in (
        (36.0, 39.0, 3.8, 3.2, 0.0, "red", 4),
        (39.0, 42.0, 3.2, 2.2, -0.6, "orange", 4),
        (42.0, 45.0, 2.2, 0.9, -1.2, "gold", 4),
    ):
        g.prism("y", S_.flat_ngon(TORCH[0], TORCH[1], r0, 6), y0, y1, C(ramp, shade),
                top=S_.flat_ngon(TORCH[0] + 0.4, TORCH[1] + dz, r1, 6))
        tier = g.solids[-1].mask(g.shape)
        P.flat(g, tier, ramp, shade)
        P.flat(g, tier & (S_.radial(g, "y", *TORCH) < r1 * 0.75), "gold", 6)

    # a ladder up the back face
    for lx in (14, 18):
        st = box(g, lx, SILL[1], HZ[1], lx + 2, HEAD[0], HZ[1] + 2, "wood", 5)
        P.planks(g, st, "wood", 5, width=2, across="x", nails=False, seed=15)
        P.flat(g, edges(st), "darkwood", 3)
    for ry in range(10, 43, 4):
        rg = box(g, 15, ry, HZ[1], 19, ry + 1, HZ[1] + 2, "wood", 3)
        P.flat(g, rg, "wood", 3)
        P.flat(g, rg & (Z > HZ[1] + 1), "wood", 6)

    # the yard: a spare block and a crate out front, a barrel in the back bay
    nxt = stone_box(g, 26, 0, 22, 36, 8, 32, "stone", 5, block=(6, 4), seed=16)
    P.flat(g, nxt & (Y > 6), "stone", 6)
    P.flat(g, nxt & (Y < 1), "stone", 3)
    glyph(g, "-z", 22.0, 29, 3, "tower", "stone", 2)
    for ry in (1.5, 4.5):  # the sling rope still round it
        P.flat(g, nxt & (np.abs(Y - ry) < 0.6), "sand", 5)
    cr = crate(g, 14, 0, 26, 8, "wood", "darkwood", 5, seed=17)
    P.flat(g, cr & (Y > 7), "wood", 6)
    glyph(g, "-z", 26.0, 16, 2, "crown", "gold", 5)
    barrel(g, 7.5, 61.0, 3, 11, 3.4, "wood", "darkwood", 4)

    grass(g, [(2, 3, 40), (36, 3, 50), (3, 3, 64), (34, 3, 66), (15, 0, 22), (24, 0, 36), (30, 0, 30)], "moss", 5)
    P.grime(g, plinth, height=2, seed=18)
    return g


# ------------------------------------------------------------------ the wheel
def wheel() -> Grid:
    """The treadwheel, the log axle, the rope drum and the ratchet gear."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi = np.floor(X).astype(np.int64)

    # the tread band: a twelve-sided ring, planked along every facet
    band, solids = _ring(g, AY, CZ, R, RIN, WX[0], WX[1], "wood", 7)
    facet_paint(g, solids, lambda gg, mm, fr: P.planks(gg, mm, "wood", 7, width=3, across="x", length=(30, 31), nails=False, frame=fr, seed=20))
    nr = S_.ngon_radius(g, "x", AY, CZ, NW, math.pi)
    ang = np.arctan2(Z - CZ, Y - AY)
    slat = np.floor((ang + math.pi) / (2 * math.pi) * (NW * 2)).astype(np.int64)
    P.flat(g, band & (nr > R - 1.4), "steel", 2)  # the iron tyre
    P.flat(g, band & (nr > R - 1.4) & (slat % 2 == 0), "steel", 4)
    # the cross slats you walk on, on the inside of the band
    tread = band & (nr < RIN + 1.4)
    P.flat(g, tread, "bone", 6)
    P.flat(g, tread & (slat % 2 == 0), "bone", 3)
    # the two pale rim faces: dark rings top and bottom and a seam per facet
    side = band & ((X < WX[0] + 1) | (X > WX[1] - 1))
    seam = ((ang + math.pi) / (2 * math.pi) * NW) % 1.0
    P.flat(g, side, "wood", 7)
    P.flat(g, side & ((nr > R - 1.8) | (nr < RIN + 1.4)), "darkwood", 4)
    P.flat(g, side & (seam < 0.09) & (nr < R - 1.8) & (nr > RIN + 1.4), "wood", 4)

    # six thick dark spokes on each rim, out to the band
    for x0, x1 in ((WX[0], WX[0] + 3), (WX[1] - 3, WX[1])):
        for k in range(6):
            a = math.pi / NW + 2 * math.pi * k / 6
            p0 = (AY + 3.6 * math.cos(a), CZ + 3.6 * math.sin(a))
            p1 = (AY + (RIN + 0.8) * math.cos(a), CZ + (RIN + 0.8) * math.sin(a))
            sp = S_.bar(g, "x", p0, p1, 2.6, x0, x1, "darkwood", 4)
            P.flat(g, sp, "darkwood", 4)
            P.flat(g, sp & (S_.radial(g, "x", AY, CZ) > RIN - 2.2), "darkwood", 2)

    # the log axle, a gold-capped hub, the rope drum and the ratchet gear
    log = S_.disc(g, "x", AY, CZ, 2.6, 1, 37, "wood", 5)
    P.planks(g, log, "wood", 5, width=2, across="x", frame="x", length=(30, 31), nails=False, seed=21)
    rad = S_.radial(g, "x", AY, CZ)
    for ex0, ex1 in ((1, 3), (35, 37)):  # gold-capped axle ends, proud of the bearings
        cap = S_.disc(g, "x", AY, CZ, 3.2, ex0, ex1, "gold", 4)
        P.flat(g, cap, "gold", 4)
        P.flat(g, cap & (rad > 2.4), "gold", 2)
        P.flat(g, cap & (rad < 1.4), "gold", 6)
    hub = S_.disc(g, "x", AY, CZ, 4.4, WX[0] - 1, WX[1] + 1, "gold", 4)
    P.flat(g, hub, "gold", 4)
    P.flat(g, hub & (rad > 3.4), "gold", 2)
    P.flat(g, hub & (rad < 2.0), "gold", 6)
    for fx0, fx1 in ((DX[0] - 1, DX[0]), (DX[1], DX[1] + 1)):  # the drum flanges
        fl = S_.disc(g, "x", AY, CZ, 5.2, fx0, fx1, "steel", 4)
        P.flat(g, fl, "steel", 4)
        P.flat(g, fl & (S_.radial(g, "x", AY, CZ) > 4.2), "steel", 2)
    drum = S_.disc(g, "x", AY, CZ, DR, DX[0], DX[1], "sand", 6)
    P.flat(g, drum, "sand", 6)  # the coiled rope
    P.flat(g, drum & (Xi % 2 == 0), "sand", 5)
    P.flat(g, drum & (Xi % 4 == 0), "sand", 7)
    P.flat(g, drum & (S_.ngon_radius(g, "x", AY, CZ, 8, math.pi) > DR - 0.9), "sand", 3)
    gear = S_.gear(g, "x", AY, CZ, 4.6, GX[0], GX[1], teeth=12, depth=1.7, ramp="steel", base=4)
    P.flat(g, gear & (S_.radial(g, "x", AY, CZ) < 3.0), "steel", 2)
    return g


# ------------------------------------------------------------------ the hoist
def fall() -> Grid:
    """The hoisting rope between the sheave and the hook block."""
    g = Grid(*S)
    _X, Y, _Z = coords(g)
    Yi = np.floor(Y).astype(np.int64)
    m = box(g, 24, HOOK[1], FZ - 1, 26, SHV[0], FZ + 1, "sand", 6)
    P.flat(g, m & (Yi % 3 == 0), "sand", 4)
    return g


def load() -> Grid:
    """The steel hook block and the dressed stone block it slings."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    base = [(19, 2), (31, 2), (31, 14), (19, 14)]
    start = len(g.solids)
    plan(g, base, BLOCK[0], BLOCK[1] - 2, "stone", 5)
    plan(g, base, BLOCK[1] - 2, BLOCK[1], "stone", 5, top=[(21, 4), (29, 4), (29, 12), (21, 12)])
    stone = np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(6, 4), cracks=0.07, frame=fr, seed=30))
    P.flat(g, stone & (Y > BLOCK[1] - 1.2), "stone", 6)
    P.flat(g, stone & (Y < BLOCK[0] + 1.0), "stone", 3)
    glyph(g, "-z", 2.0, 22, int(BLOCK[0]) + 3, "tower", "stone", 2)
    # the rope slings round it and up to the hook
    for sx in (21.5, 27.5):
        P.flat(g, stone & (np.abs(X - sx) < 1.0), "sand", 6)
        sl = box(g, sx - 1, BLOCK[1] - 1, 6, sx + 1, HOOK[0] + 1, 11, "sand", 6)
        P.flat(g, sl, "sand", 6)
        P.flat(g, sl & (np.floor(Y).astype(np.int64) % 3 == 0), "sand", 4)
    for sz in (5.5, 10.5):
        P.flat(g, stone & (np.abs(Z - sz) < 1.0) & (Y > BLOCK[1] - 2.2), "sand", 4)
    # the hook block: riveted steel cheeks, a bright pin and a hook under it
    blk = box(g, 22, HOOK[0], 5, 28, HOOK[1], 12, "steel", 5)
    P.plates(g, blk, "steel", 5, size=(4, 4), rivets=True, seed=31)
    P.flat(g, edges(blk), "steel", 3)
    P.flat(g, blk & (np.abs(Y - (HOOK[0] + HOOK[1]) / 2) < 1.4) & (np.abs(Z - 8.5) < 1.4), "gold", 4)
    hk = S_.bar(g, "x", (HOOK[0] - 4.5, 8.5), (HOOK[0] + 0.5, 8.5), 2.6, 24, 26, "steel", 5)
    P.flat(g, hk, "steel", 5)
    P.flat(g, hk & (Y < HOOK[0] - 2.5), "steel", 6)
    ring = S_.disc(g, "x", HOOK[1] + 1.0, 8.5, 2.0, 24, 26, "steel", 5)
    P.flat(g, ring, "steel", 5)
    return g


def build():
    h, w, f, l = housing(), wheel(), fall(), load()
    hang = (25.0, SHV[0], FZ)
    root, to_root = rig([("treadwheel-crane", h, None, None),
                         ("wheel", w, (16.0, AY, CZ), None),
                         ("fall", f, hang, None),
                         ("load", l, hang, None)])
    rope_len = SHV[0] - HOOK[1]
    short = (rope_len - LIFT) / rope_len

    # idle: the slung block swings a little and twists on the rope
    idle = {"load": {"rot": sway(5.0, amp=(2.4, 7.0, 0.0), phase=(0.0, 1.2, 0.0), cycles=(1, 1, 1))},
            "fall": {"rot": sway(5.0, amp=(2.4, 0.0, 0.0), cycles=(1, 1, 1))}}

    # spin: a turn and a half up (the rope winds on the drum), a beat, then back
    def arc(t0, t1, a0, a1):
        steps = max(8, int(abs(a1 - a0) // 90))
        return [(t0 + (t1 - t0) * i / steps, (a0 + (a1 - a0) * i / steps, 0.0, 0.0)) for i in range(steps + 1)]

    turns = arc(0.0, 1.8, 0.0, 540.0) + [(2.0, (540.0, 0.0, 0.0))] + arc(2.0, 3.8, 540.0, 0.0)[1:] + [(4.0, (0.0, 0.0, 0.0))]
    spin = {"wheel": {"rot": turns},
            "load": {"loc": keys((0, 0, 0, 0), (1.8, 0, LIFT, 0), (2.0, 0, LIFT, 0), (3.8, 0, 0, 0), (4.0, 0, 0, 0))},
            "fall": {"scale": keys((0, 1, 1, 1), (1.8, 1, short, 1), (2.0, 1, short, 1), (3.8, 1, 1, 1), (4.0, 1, 1, 1))}}

    return asset("animated-props", "treadwheel-crane", "Treadwheel Crane", root,
                 clips=[Clip("idle", idle), Clip("spin", spin)],
                 sockets=[Socket("socket-torch", at=to_root((TORCH[0], 43.0, TORCH[1])))],
                 fx=[pfx("rvx-fantasy-torch-flame", "socket-torch", "idle", size=11)])
