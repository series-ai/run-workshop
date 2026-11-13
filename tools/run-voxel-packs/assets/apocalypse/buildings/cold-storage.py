"""Derelict cold-storage depot, in the Pirate Nation style.

A chunky block of white precast panels with a teal cold-chain band on a
raised loading dock, under a steep corrugated teal hip roof whose flat top
carries three big condenser units; their fans still turn on `idle`. The
function prop is oversized (rules F4, K1): a giant tilted ice cube sits on
the roof by a big ICE COLD board. Three bays: one shut, one jammed half
open, one holding a rusty reefer trailer that backed in and never left.
Moss and vines creep up the walls. Detail is paint (S1). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint
import pnshapes as S
from _bld import bloom, crate, part, sign
from pnkit import box, door, edges, window
from voxgrid import C, Asset, Clip, Grid, Part, bounds_pivot, turn

W, H, D = 152, 112, 124
X0, X1, Z0, Z1 = 16, 136, 40, 106
DOCK, WALL_TOP, ROOF_TOP = 8, 58, 94
INSET = 27  # the hip roof's flat top is inset this far
FANS = [(52, 73), (76, 73), (100, 73)]  # condenser centres (x, z)
UNIT_Y0, UNIT_H = ROOF_TOP, 10


def depot() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = S._idx(g)
    # ---- the loading dock: a raised concrete deck with a hazard edge
    dock = box(g, 4, 0, 16, 148, DOCK, 114, "sand", 5)
    pnpaint.concrete(g, dock, "sand", 5, size=16, cracks=8, seed=1)
    P.outline(g, dock, "sand", 3, normal="y")
    pnpaint.hazard(g, dock & (Z < 18) & (Y >= DOCK - 3), period=8, a=("gold", 5), b=("darkwood", 4))
    for bx in (30, 62, 94):  # rubber bumpers under the bays
        box(g, bx, 2, 14, bx + 6, 7, 16, "gray", 4)

    # ---- the body: white precast panels, a teal band, pilasters
    walls = box(g, X0, DOCK, Z0, X1, WALL_TOP, Z1, "bone", 6)
    P.plates(g, walls, "bone", 6, size=(16, 12), rivets=False, seed=2)
    band = walls & (Y >= 40) & (Y < 46)
    P.flat(g, band, "teal", 5)
    P.flat(g, band & ((Y == 40) | (Y == 45)), "teal", 4)
    for px in (X0 - 2, 56, 88, X1 - 3):
        pil = box(g, px, DOCK, Z0 - 2, px + 5, WALL_TOP, Z0 + 1, "stone", 6)
        P.flat(g, edges(pil), "stone", 5)
    for pz in (Z1 - 3,):
        for px in (X0 - 2, X1 - 3):
            box(g, px, DOCK, pz, px + 5, WALL_TOP, pz + 5, "stone", 6)
    eave = box(g, X0 - 3, WALL_TOP - 2, Z0 - 3, X1 + 3, WALL_TOP + 2, Z1 + 3, "teal", 4)
    P.planks(g, eave, "teal", 4, width=4, across="y", nails=False, seed=3)
    # moss creeping up from the dock, vines on the pilasters
    bloom(g, walls, 8, ((X0, DOCK, Z0), (X1, DOCK + 10, Z1)), r=(4.0, 8.0), ramp="khaki", shades=(5, 4), seed=4)
    for vx, vz in ((X0 + 1, Z0 - 2), (X1 - 1, Z0 - 2)):
        vine = (g.a > 0) & (np.abs(X - vx - 1.5 * np.sin(Y / 4.0)) < 1.3) & (Z < Z0 + 2) & (Y > DOCK) & (Y < 50)
        P.flat(g, vine, "leaf", 4)

    # ---- roof: a steep corrugated hip with a flat deck on top
    g.prism("y", [(X0 - 4, Z0 - 4), (X1 + 4, Z0 - 4), (X1 + 4, Z1 + 4), (X0 - 4, Z1 + 4)], WALL_TOP + 2, ROOF_TOP, C("teal", 5),
            top=[(X0 + INSET, Z0 + INSET), (X1 - INSET, Z0 + INSET), (X1 - INSET, Z1 - INSET), (X0 + INSET, Z1 - INSET)])
    roof = S.last(g)
    solid = [g.solids[-1]]
    for m, fr in S.facets(g, solid):
        if fr == "top":
            P.plates(g, m, "steel", 6, size=(12, 12), rivets=True, frame="top", seed=5)
        else:
            pnpaint.corrugate(g, m, "teal", 5, period=3, sheet=12, length=12, frame=fr, seed=5)
    P.flat(g, roof & S.seams(g, solid, 0.9), "teal", 3)
    P.flat(g, roof & (Y < WALL_TOP + 3), "teal", 3)
    bloom(g, roof & (Y < ROOF_TOP - 1), 5, ((X0, WALL_TOP, Z0), (X1, ROOF_TOP, Z1)), r=(5.0, 8.0), ramp="rust", shades=(5, 4), seed=6)
    # condenser housings on the deck
    for fx, fz in FANS:
        u = box(g, fx - 11, UNIT_Y0, fz - 11, fx + 11, UNIT_Y0 + UNIT_H, fz + 11, "steel", 6)
        P.plates(g, u, "steel", 6, size=(11, 5), seed=fx)
        P.flat(g, edges(u), "steel", 4)
        P.flat(g, u & (Y == UNIT_Y0 + UNIT_H - 1) & (np.hypot(X + 0.5 - fx, Z + 0.5 - fz) < 9.5), "stone", 4)  # the fan well
        P.flat(g, u & (Y < UNIT_Y0 + UNIT_H - 1) & (Z == fz - 11) & (Y > UNIT_Y0 + 1) & ((X - fx) % 3 == 0), "steel", 4)

    # ---- the function prop: a giant ice cube, tilted, on the roof corner
    cx, cy = 124, ROOF_TOP - 22
    sq = S.rotate([(cx - 13, cy), (cx + 13, cy), (cx + 13, cy + 26), (cx - 13, cy + 26)], cx, cy, 14)
    g.prism("z", sq, 48, 74, C("cyan", 6))
    cube = S.last(g)
    P.flat(g, cube & (Y > cy + 18), "cyan", 7)
    P.outline(g, cube, "cyan", 4, normal="z")
    glint = cube & (np.abs((X - cx) + (Y - cy - 16)) < 1.2) & (Z < 50)
    P.flat(g, glint, "bone", 7)
    # the ICE COLD board over the bays
    sign(g, "-z", Z0 - 3, 64, 62, "ICE COLD", board=("sky", 5), ink=("bone", 7), frame=("bone", 5), scale=2, gap=1, pad=3, depth=2)
    for px in (22, 104):
        box(g, px, WALL_TOP, Z0 - 4, px + 3, 62, Z0 - 1, "steel", 4)

    # ---- three bays
    bays = [(24, 50), (60, 86), (96, 122)]
    for k, (u0, u1) in enumerate(bays):
        fr = box(g, u0 - 3, DOCK, Z0 - 2, u1 + 3, DOCK + 34, Z0, "stone", 5)
        P.flat(g, edges(fr), "stone", 4)
        P.flat(g, fr & (X >= u0) & (X < u1) & (Y < DOCK + 31), "wood", 3)  # the dim inside
        if k == 0:  # shut: a rolled steel door
            d = box(g, u0, DOCK, Z0 - 3, u1, DOCK + 31, Z0 - 1, "gold", 5)
            pnpaint.corrugate(g, d, "gold", 5, period=3, sheet=40, length=4, frame="z")
            P.flat(g, d & (Y < DOCK + 3), "darkwood", 5)
        elif k == 1:  # jammed half open
            d = box(g, u0, DOCK + 15, Z0 - 3, u1, DOCK + 31, Z0 - 1, "gold", 5)
            P.flat(g, d & (Y % 4 == 0), "gold", 4)
            P.flat(g, d & (Y == DOCK + 15), "darkwood", 5)
            crate(g, u0 + 4, DOCK, Z0 - 10, 10, ramp="sand", base=5, seed=7)
    # the reefer trailer backed into bay 3 and left to rust
    tu0, tu1 = bays[2][0] + 1, bays[2][1] - 1
    tr = box(g, tu0, 14, 2, tu1, 42, Z0 + 4, "bone", 6)
    P.plates(g, tr, "bone", 6, size=(12, 7), rivets=True, seed=8)
    P.flat(g, tr & (Y >= 30) & (Y < 34), "teal", 5)
    P.flat(g, edges(tr), "bone", 4)
    bloom(g, tr, 5, ((tu0, 14, 2), (tu1, 42, 30)), r=(2.5, 4.5), ramp="rust", shades=(5, 4), seed=9)
    fridge = box(g, tu0 + 3, 42, 4, tu1 - 3, 50, 14, "steel", 5)  # the reefer unit on the nose
    P.flat(g, fridge & (Z == 4) & ((X - tu0) % 3 == 0), "steel", 3)
    for wz in (8, 18):
        S.wheel(g, "x", wz, 0, 6, tu0 - 1, tu0 + 5, tyre=("gray", 3), rim=("steel", 5), spoke=("steel", 6), hub=("gold", 5))
        S.wheel(g, "x", wz, 0, 6, tu1 - 5, tu1 + 1, tyre=("gray", 3), rim=("steel", 5), spoke=("steel", 6), hub=("gold", 5))
    pnpaint.hazard(g, box(g, tu0, 11, 1, tu1, 14, 4, "gold", 5), period=6)

    # ---- +x side: an office door up a few steps, a lit window
    door(g, "+x", X1, 70, 88, DOCK, DOCK + 26, leaf="teal", arch=False, seed=10)
    window(g, "+x", X1, 48, 62, 24, 36, glass="gold", glow=6)
    window(g, "-x", X0, 60, 74, 24, 36, glass="gold", glow=6)
    for u0 in (30, 70, 110):
        window(g, "+z", Z1, u0, u0 + 14, 22, 34, glass=("gold" if u0 != 70 else "teal"), glow=6)
    sign(g, "+z", Z1, 76, 47, "NO 7", board=("teal", 5), ink=("bone", 7), frame=("teal", 3), scale=1, gap=1, pad=2, depth=1)
    for k in range(3):
        st = box(g, X1 + 3, DOCK - 2 - 2 * k, 68 - 2 * k, X1 + 9 + 3 * k, DOCK - 2 * k, 90 + 2 * k, "stone", 5)
    # props on the dock
    crate(g, 128, DOCK, 22, 10, ramp="khaki", base=5, seed=11)
    S.drum(g, 12, 26, DOCK, 17, 7.5, ramp="teal", base=5, band=("bone", 6), seed=12)
    return g


def fan(fx: int, fz: int) -> Grid:
    g = Grid(W, H, D)
    y0 = UNIT_Y0 + UNIT_H
    for k in range(4):
        a = math.radians(45 + 90 * k)
        g.prism("y", S.quad((fx, fz), (fx + 8.5 * math.cos(a), fz + 8.5 * math.sin(a)), 1.2, 2.6), y0, y0 + 2, C("steel", 7))
    S.disc(g, "y", fx, fz, 2.2, y0, y0 + 3, "red", 5)
    return g


def build() -> Asset:
    g = depot()
    pivot = bounds_pivot(g)
    root = Part("cold-storage", g, pivot=pivot)
    idle = {}
    for k, (fx, fz) in enumerate(FANS):
        part(root, f"fan-{k}", fan(fx, fz), (fx, UNIT_Y0 + UNIT_H, fz))
        sec = 0.8 + 0.25 * k
        idle[f"fan-{k}"] = {"rot": turn(sec, "y", 360 / sec)}
    return Asset(id="apocalypse-buildings-cold-storage", pack="apocalypse", category="buildings", name="Cold-Storage Depot", root=root,
                 clips=[Clip("idle", idle)])
