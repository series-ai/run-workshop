"""Roadside motel, in the Pirate Nation style.

A two-storey strip motel on a cracked lot (rule K1): a stone plinth, a
plaster body with a teal fascia band, six wide short doors with numbers and
glowing or boarded windows, a cantilevered upper walkway on fat posts with
a railing and an open stair, and a tall corrugated gable roof with torn
patches (rules F2, F4). The oversized function prop is the pylon sign at
the -x end: a steel mast carrying a big MOTEL board, a VACANCY panel and a
bulb-studded arrow, which stutters on `idle` (rules F4, C3). A leaning brick
flue, two ridge vents, a soda machine, drums, a tyre stack and weeds finish
the lot. Plaster, courses, grime and the lettering are paint (rule S1).
Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint as PP
import pnshapes as S
from _bld import bloom, crate, gable, label, leg, part, slab
from pnkit import box, door, edges, window
from voxgrid import C, Asset, Clip, Grid, Part, bounds_pivot

W, H, D = 152, 140, 92
X0, X1 = 14, 130  # the building along x
Z0, Z1 = 26, 74  # the building across z (the doors face -z)
G = 3  # the top of the lot slab
PLINTH = 10
BELT = 42  # the upper floor deck
EAVE = 76
RIDGE = 118
DECK = Z0 - 11  # the front edge of the walkway
UNITS = (22, 40, 58, 76, 94, 112)  # the x of each unit door
SIGN = (26.0, 128.0, 10.0)  # the pylon sign: the mast x0, its top, its z centre
BOARD = (2, 66, 86, 122)  # the MOTEL board: x0, x1, y0, y1


def shell() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)

    # ---- the lot: a cracked slab with faded parking bays and an oil stain
    lot = slab(g, 2, 4, 150, 88, h=G, ramp="sand", base=5, cracks=12, seed=1)
    for px in range(24, 140, 22):
        P.flat(g, lot & (Y > G - 1) & (X > px) & (X < px + 2) & (Z > 6) & (Z < DECK - 2), "bone", 6)
    P.flat(g, lot & (Y > G - 1) & (np.hypot(X - 70, (Z - 14) * 1.5) < 7), "sand", 3)
    P.flat(g, lot & (Y > G - 1) & (np.hypot(X - 112, (Z - 12) * 1.4) < 5), "sand", 3)

    # ---- the stone plinth, the plaster body and the upper storey
    plinth = box(g, X0 - 2, G, Z0 - 2, X1 + 2, PLINTH, Z1 + 2, "stone", 5)
    P.stone(g, plinth, "stone", 5, block=(7, 4), mortar=-2, cracks=0.1, seed=2)
    P.flat(g, edges(plinth), "stone", 3)
    low = box(g, X0, PLINTH, Z0, X1, BELT, Z1, "sand", 6)
    high = box(g, X0, BELT, Z0, X1, EAVE, Z1, "sand", 6)
    body = low | high
    PP.concrete(g, body, "sand", 6, size=20, cracks=0, seed=3)
    PP.blotch(g, body, "sand", 5, cell=11, chance=0.18, seed=50)  # sun-bleached and shaded panels
    PP.blotch(g, body, "sand", 7, cell=9, chance=0.24, seed=51)
    P.flat(g, body & (Y > BELT - 5) & (Y < BELT + 3), "teal", 4)  # the fascia band
    P.flat(g, body & (np.abs(Y - (BELT - 5)) < 0.6), "teal", 2)
    P.flat(g, body & (np.abs(Y - (BELT + 2)) < 0.6), "teal", 2)
    P.flat(g, body & (Y > EAVE - 3), "sand", 4)
    P.flat(g, body & (Z < Z0 + 1), "sand", 7)  # a fresher coat on the walkway facade
    for ex in (X0, X1 - 2):  # the masonry end walls frame the strip (rule F3)
        pil = box(g, ex, PLINTH, Z0 - 2, ex + 2, EAVE, Z1 + 2, "rust", 6)
        P.stone(g, pil, "rust", 6, block=(12, 8), mortar=-2, cracks=0.06, seed=4)
        P.flat(g, pil & (Y > EAVE - 4), "rust", 7)  # the lit top course
        P.flat(g, pil & (Y < PLINTH + 8), "rust", 4)  # the plinth courses
        P.flat(g, pil & (Y > BELT - 3) & (Y < BELT + 5), "rust", 5)  # a repair band at the floor line
        P.flat(g, pil & (np.abs(Y - (BELT + 5)) < 0.6), "rust", 7)
        P.flat(g, edges(pil), "rust", 3)
        PP.blotch(g, pil, "rust", 5, cell=12, chance=0.22, seed=52)  # damp courses
        for cz in (34.0, 48.0, 66.0):  # damp runs from the eave
            run = pil & (np.abs(Z - cz) < 2.4) & (Y > EAVE - 30)
            P.flat(g, run, "rust", 4)
            P.flat(g, run & (np.abs(Z - cz) < 1.2), "rust", 3)
    for face, plane in (("-x", float(X0)), ("+x", float(X1))):  # a boarded light in each end wall
        win = window(g, face, plane, 38, 54, BELT + 8, BELT + 22, frame="darkwood", glass="navy", glow=1, cross=False)
        for by in (BELT + 11, BELT + 18):
            P.flat(g, win & (np.abs(Y - by) < 1.6), "wood", 5)
    label(g, "-x", float(X0), float((Z0 + Z1) / 2), 28.0, "MOTEL", "bone", 7, scale=1)  # a faded painted ad
    label(g, "-x", float(X0), float((Z0 + Z1) / 2), 19.0, "ROOMS", "bone", 6, scale=1)
    for ex in (X0 - 2, X1):  # fat timber posts frame each end wall (rules F3, S4)
        post = box(g, ex, PLINTH, Z0 - 4, ex + 2, EAVE + 2, Z0, "darkwood", 5)
        post |= box(g, ex, PLINTH, Z1, ex + 2, EAVE + 2, Z1 + 4, "darkwood", 5)
        P.planks(g, post, "darkwood", 5, width=3, across="y", nails=True, seed=ex)
        P.flat(g, edges(post), "darkwood", 3)
    lad = box(g, X0 - 2, BELT + 4, 60, X0, EAVE, 62, "steel", 4)  # a roof ladder off the -x walkway
    lad |= box(g, X0 - 2, BELT + 4, 68, X0, EAVE, 70, "steel", 4)
    for k in range(4):
        lad |= box(g, X0 - 2, BELT + 10 + k * 8, 62, X0, BELT + 12 + k * 8, 68, "steel", 5)
    P.flat(g, edges(lad), "steel", 2)
    PP.blotch(g, lad, "rust", 5, cell=5, chance=0.10, seed=53)
    bloom(g, body, 14, ((X0, PLINTH, Z0 - 1), (X1, EAVE, Z0 + 1)), r=(3.0, 6.0), ramp="rust", shades=(5, 4), seed=5)
    bloom(g, body, 8, ((X0, PLINTH, Z1 - 1), (X1, EAVE, Z1 + 1)), r=(3.0, 6.0), ramp="moss", shades=(5, 4), seed=6)

    # ---- the unit doors and windows, numbered, on both storeys
    for k, ux in enumerate(UNITS):
        for floor, v0 in ((0, PLINTH + 2), (1, BELT + 4)):
            style = ("wood", "wood", "steel", "wood", "wood", "steel")[k]
            door(g, "-z", Z0, ux, ux + 18, v0, v0 + 26, leaf="red" if style == "wood" else "steel",
                 frame="darkwood", base=3, arch=False, seed=10 + k + floor)
            n = f"{1 + floor}{1 + k}"
            pnglyph.text(g, "-z", Z0 - 3, ux + 6, v0 + 20, n, "bone", 7)
            lit = (k + floor) % 3
            if lit == 2:
                win = window(g, "-z", Z0, ux - 12, ux - 2, v0 + 7, v0 + 19, frame="darkwood", glass="navy", glow=1, cross=True)
                for bz in (v0 + 9, v0 + 14):  # boards nailed across
                    P.flat(g, win & (np.abs(Y - bz) < 1.2), "wood", 4)
            else:
                window(g, "-z", Z0, ux - 12, ux - 2, v0 + 7, v0 + 19, frame="darkwood",
                       glass="gold" if lit == 0 else "sky", glow=6 if lit == 0 else 3, cross=True)
    for bx in (X0 + 6, 68, X1 - 10):  # bathroom slits on the back wall
        window(g, "+z", Z1, bx, bx + 8, BELT + 10, BELT + 18, frame="darkwood", glass="sky", glow=3, cross=False)

    # ---- the back wall: fallen plaster, boarded lights, streaks, a service door
    back = body & (Z > Z1 - 1)
    for k, (bx, by, br) in enumerate(((42.0, 28.0, 12.0), (94.0, 58.0, 10.0), (120.0, 24.0, 8.0), (24.0, 62.0, 7.0))):
        d = np.hypot((X - bx) * 0.75, Y - by)
        fall = back & (d < br)
        P.stone(g, fall, "rust", 6, block=(7, 4), mortar=-2, cracks=0.08, seed=30 + k)
        P.flat(g, fall & (d > br - 1.3), "sand", 3)  # the broken edge of the plaster
    for bx in (30, 56, 100):  # boarded ground-floor lights
        win = window(g, "+z", Z1, bx, bx + 14, PLINTH + 10, PLINTH + 24, frame="darkwood", glass="navy", glow=1, cross=False)
        for by in (PLINTH + 13, PLINTH + 20):
            P.flat(g, win & (np.abs(Y - by) < 1.6), "wood", 5)
            P.flat(g, win & (np.abs(Y - by) < 1.6) & (np.floor(X) % 7 == 0), "wood", 3)
    door(g, "+z", Z1, 70, 88, PLINTH, PLINTH + 26, leaf="steel", frame="darkwood", base=3, arch=False, seed=40)
    PP.hazard(g, body & (Z > Z1 - 1) & (X > 70) & (X < 88) & (Y > PLINTH + 10) & (Y < PLINTH + 14), period=5, a=("gold", 5), b=("darkwood", 3))
    for sx, sy, sl in ((34.0, BELT + 10, 26.0), (72.0, EAVE - 4, 30.0), (104.0, BELT + 10, 22.0), (126.0, EAVE - 6, 18.0)):
        run = back & (np.abs(X - sx) < 2.2) & (Y < sy) & (Y > sy - sl)
        P.flat(g, run, "rust", 5)
        P.flat(g, run & (np.abs(X - sx) < 1.1), "rust", 4)
    for px in (X0 + 4, X1 - 6):  # two down-pipes from the eave to the yard
        pipe = box(g, px, G, Z1 + 1, px + 4, EAVE - 2, Z1 + 5, "steel", 4)
        P.flat(g, pipe & (np.floor(Y) % 14 == 0), "steel", 2)  # its collars
        P.flat(g, edges(pipe), "steel", 2)

    # ---- the walkway: a deck on fat posts, a railing and an open stair
    deck = box(g, X0 - 2, BELT, DECK, X1 + 2, BELT + 3, Z0, "wood", 5)
    P.planks(g, deck, "wood", 5, width=4, across="x", nails=True, frame="top", seed=7)
    P.flat(g, deck & (Z < DECK + 1), "darkwood", 4)  # the dark fascia of the deck
    P.flat(g, deck & (Y < BELT + 1), "wood", 4)
    # only a header beam at the front edge, so daylight reaches the upper doors
    canopy = box(g, X0 - 2, EAVE - 4, DECK, X1 + 2, EAVE, DECK + 4, "wood", 5)
    P.planks(g, canopy, "wood", 5, width=4, across="x", nails=True, seed=8)
    P.flat(g, canopy & (Z < DECK + 1), "darkwood", 4)
    for px in (X0 + 2, 40, 68, 96, X1 - 6):
        post = box(g, px, G, DECK + 1, px + 4, EAVE, DECK + 5, "wood", 5)
        P.planks(g, post, "wood", 5, width=4, across="y", nails=False, seed=px)
        P.flat(g, edges(post), "darkwood", 4)
        S.bar(g, "z", (px + 4.0, BELT + 3.0), (px + 12.0, BELT + 3.0), 1.6, DECK + 1, DECK + 4, "wood", 4)
        S.bar(g, "z", (px - 8.0, BELT + 3.0), (px + 0.0, BELT + 3.0), 1.6, DECK + 1, DECK + 4, "wood", 4)
    rail = box(g, X0 - 2, BELT + 14, DECK, X1 + 2, BELT + 17, DECK + 3, "steel", 4)
    rail |= box(g, X0 - 2, BELT + 3, DECK, X1 + 2, BELT + 7, DECK + 3, "steel", 4)
    for rx in range(X0, X1, 7):
        rail |= box(g, rx, BELT + 3, DECK + 1, rx + 2, BELT + 16, DECK + 3, "steel", 3)
    P.flat(g, rail, "steel", 5)
    P.flat(g, edges(rail), "steel", 3)
    PP.blotch(g, rail, "rust", 5, cell=4, chance=0.08, seed=9)
    # ---- the stair at the +x end: two stringers, a landing on the walkway
    land = box(g, X1 + 2, BELT, DECK, X1 + 18, BELT + 3, Z0 + 1, "wood", 5)
    P.planks(g, land, "wood", 5, width=4, across="x", nails=True, frame="top", seed=22)
    P.flat(g, land & (Z < DECK + 1), "darkwood", 4)
    P.flat(g, land & (Y < BELT + 1), "wood", 4)
    for lx, lz in ((X1 + 3, DECK + 1), (X1 + 13, Z0 - 5)):  # the landing posts
        lp = box(g, lx, G, lz, lx + 4, BELT, lz + 4, "wood", 5)
        P.planks(g, lp, "wood", 5, width=4, across="y", nails=False, seed=lx)
        P.flat(g, edges(lp), "darkwood", 4)
    for sx0, sx1 in ((X1 + 2, X1 + 5), (X1 + 15, X1 + 18)):  # the stringers (true diagonals)
        st = S.bar(g, "x", (float(G + 2), float(Z0 + 42)), (float(BELT + 2), float(Z0 + 1)), 5.0, sx0, sx1, "steel", 4)
        P.plates(g, st, "steel", 4, size=(6, 10), rivets=True, seed=23)
        P.flat(g, edges(st), "steel", 3)
    for k in range(12):  # the treads between the stringers
        ty, tz = BELT - 3 * (k + 1), Z0 + 1 + 3.4 * k
        tr = box(g, X1 + 4, ty, tz, X1 + 16, ty + 3, tz + 4, "steel", 5)
        P.flat(g, tr & (Y > ty + 1.8), "steel", 6)
        P.flat(g, tr & (Z < tz + 1), "steel", 3)
    rail = S.bar(g, "x", (float(G + 18), float(Z0 + 40)), (float(BELT + 18), float(Z0 + 1)), 2.6, X1 + 15, X1 + 18, "steel", 5)
    for k in (1, 5, 9):  # the rail posts, each on a tread
        ty, tz = BELT - 3 * (k + 1), Z0 + 2.4 + 3.4 * k
        rail |= box(g, X1 + 15, ty, tz, X1 + 17.6, ty + 17, tz + 2.6, "steel", 4)
    P.flat(g, edges(rail), "steel", 3)
    PP.blotch(g, rail, "rust", 5, cell=5, chance=0.08, seed=24)

    # ---- the roof: a steep corrugated gable with torn patches and a vent
    r = gable(g, X0, X1, Z0, Z1, EAVE, RIDGE, ridge="x", thick=4, overhang=6,
              roof=("rust", 5), style="corrugate", attic=("sand", 5), attic_style="plates",
              trim=("wood", 4), seed=11)
    slabs = r["slabs"]
    # replacement sheets: weathered brown and bare steel, each with a seam
    eave_y = EAVE - 2
    zc0 = (Z0 + Z1) / 2
    for m, a_end in ((r["front"], Z0 - 6), (r["back"], Z1 + 6)):
        fr = ((1.0, 0.0, 0.0), (0.0, eave_y - RIDGE, a_end - zc0))
        for k, (px0, px1, ramp, sh) in enumerate(((28, 50, "darkwood", 6), (74, 92, "steel", 5), (104, 124, "sand", 5))):
            sel = m & (X > px0) & (X < px1)
            PP.corrugate(g, sel, ramp, sh, period=3, sheet=12, length=18, frame=fr, seed=60 + k)
            P.flat(g, sel & ((X < px0 + 1) | (X > px1 - 1)), ramp, max(1, sh - 2))
    for tx, ty, tr in ((44.0, 86.0, 7.0), (96.0, 78.0, 5.0), (118.0, 92.0, 4.0)):  # sheets blown clean off
        d = np.hypot(X - tx, (Y - ty) * 1.4)
        torn = slabs & (d < tr)
        P.flat(g, torn, "darkwood", 1)  # the dark attic through the hole
        P.flat(g, torn & (d > tr - 1.5), "rust", 7)  # the torn metal edge, catching the light
        P.flat(g, torn & (d > tr - 0.7), "rust", 3)
    bloom(g, slabs, 10, ((X0, EAVE, Z0 - 6), (X1, RIDGE, Z1 + 6)), r=(3.0, 6.0), ramp="rust", shades=(6, 4), seed=12)
    zc = (Z0 + Z1) / 2
    for vx in (44.0, 68.0):  # two vent hoods that straddle the ridge
        S.cone(g, "y", vx, zc, 4.4, RIDGE + 2, RIDGE + 11, "steel", 5, n=8, r_top=2.6)
        S.disc(g, "y", vx, zc, 5.4, RIDGE + 11, RIDGE + 13, "steel", 4, n=8)
    # a leaning brick flue up the back slope (rules K1, F5)
    flue = leg(g, 112, int(zc) + 8, 122, int(zc) + 18, EAVE - 18, RIDGE + 16, 4.0, -3.0,
               ramp="red", base=4, planks=False, seed=13)
    P.stone(g, flue, "red", 4, block=(5, 3), mortar=-2, cracks=0.2, seed=14)
    P.flat(g, flue & (Y > RIDGE + 12), "darkwood", 3)  # the sooted crown
    PP.blotch(g, flue, "moss", 5, cell=4, chance=0.07, seed=15)

    # ---- the pylon sign mast standing in the lot (the board is a part)
    sx, top, sz = SIGN
    mast = box(g, int(sx), G, int(sz) - 4, int(sx) + 8, int(top), int(sz) + 12, "steel", 4)
    P.plates(g, mast, "steel", 4, size=(8, 12), rivets=True, seed=15)
    P.flat(g, edges(mast), "steel", 2)
    PP.hazard(g, mast & (Y < 22), period=5, a=("gold", 5), b=("darkwood", 3))
    PP.blotch(g, mast, "rust", 5, cell=4, chance=0.09, seed=16)
    cap = box(g, int(sx) - 4, int(top) - 6, int(sz) - 4, int(sx) + 12, int(top), int(sz) + 12, "steel", 5)
    P.flat(g, cap & (Y > top - 1.4), "steel", 6)
    P.flat(g, edges(cap), "steel", 3)
    for bx in (16.0, 54.0):  # the stays that carry the board off the mast
        br = S.bar(g, "z", (sx + 4, 96.0), (bx, 112.0), 3.4, int(sz) + 6, int(sz) + 10, "steel", 4)
        P.flat(g, edges(br), "steel", 2)
    foot = S.disc(g, "y", sx + 4, sz + 4, 10.0, G, G + 7, "sand", 5, n=8)
    PP.concrete(g, foot, "sand", 5, size=8, cracks=3, seed=17)
    P.flat(g, foot & (Y > G + 5), "sand", 6)
    P.outline(g, foot, "sand", 3, normal="y")

    # ---- small props at the base (rule K1)
    sm = box(g, 52, G, 8, 72, G + 32, 21, "red", 4)
    P.plates(g, sm, "red", 4, size=(9, 10), rivets=False, seed=18)
    P.flat(g, edges(sm), "darkwood", 3)
    P.flat(g, sm & (Z < 9) & (X > 55) & (X < 69) & (Y > G + 14) & (Y < G + 28), "gold", 6)
    P.flat(g, sm & (Z < 9) & (X > 55) & (X < 69) & (np.abs(Y - (G + 21)) < 0.6), "gold", 4)
    label(g, "-z", 8.0, 62.0, G + 4, "ICE", "bone", 7)
    S.drum(g, 82, 14, G, 18, 7.0, ramp="teal", base=4, band=("bone", 6), wear=True, seed=19)
    S.drum(g, 96, 10, G, 18, 7.0, ramp="red", base=4, band=("gold", 5), wear=True, seed=20)
    for k, ty in enumerate((G, G + 5, G + 10)):
        S.tyre(g, "y", 112.0, 14.0, 8.0 - k * 0.4, ty, ty + 5, rubber=("gray", 3), hub=("steel", 4), n=8)
    crate(g, 124, G, 10, 14, ramp="wood", base=5, frame=("darkwood", 3), icon="skull", ink=("red", 4), seed=21)
    # ---- the service yard behind: two condensers, a skip and a pallet stack
    for k, ux in enumerate((32, 54)):
        unit = box(g, ux, G, Z1 + 6, ux + 16, G + 16, Z1 + 16, "steel", 5)
        P.plates(g, unit, "steel", 5, size=(8, 7), rivets=True, seed=41 + k)
        P.flat(g, edges(unit), "steel", 3)
        fc = np.hypot(X - (ux + 8), Y - (G + 9))
        P.flat(g, unit & (Z > Z1 + 15) & (fc < 6.0), "steel", 2)
        P.flat(g, unit & (Z > Z1 + 15) & (fc < 6.0) & (fc > 4.6), "steel", 6)
        for a in range(3):
            P.flat(g, unit & (Z > Z1 + 15) & (fc < 4.6) & (np.abs((Y - (G + 9)) * np.cos(a * 1.05) - (X - (ux + 8)) * np.sin(a * 1.05)) < 1.2), "steel", 5)
        PP.blotch(g, unit, "rust", 5, cell=5, chance=0.10, seed=43 + k)
    skip = box(g, 96, G, Z1 + 5, 128, G + 19, Z1 + 20, "teal", 4)
    for m, fr in S.facets(g, [g.solids[-1]]):
        P.plates(g, m, "teal", 4, size=(10, 8), rivets=True, frame=fr, seed=45)
    P.flat(g, edges(skip), "darkwood", 3)
    P.flat(g, skip & (Y > G + 17.6), "steel", 5)  # its rolled rim
    PP.hazard(g, skip & (Y > G + 4) & (Y < G + 9) & (Z < Z1 + 6), period=6, a=("gold", 5), b=("darkwood", 3))
    bloom(g, skip, 5, ((96, G, Z1 + 5), (128, G + 19, Z1 + 20)), r=(2.5, 5.0), ramp="rust", shades=(5, 4), seed=46)
    for k, by in enumerate((G, G + 4, G + 8)):  # the pallets leaning at the back door
        pl = box(g, 72 + k, by, Z1 + 4, 94 + k, by + 4, Z1 + 16, "wood", 5)
        P.planks(g, pl, "wood", 5, width=4, across="x", nails=True, frame="top", seed=47 + k)
        P.flat(g, edges(pl), "darkwood", 4)
    for k, (tx, tz) in enumerate(((8, 16), (140, 20), (30, 78), (146, 60), (60, 80), (4, 50), (20, 86), (134, 84))):
        tuft = S.bar(g, "y", (float(tx), float(tz)), (float(tx) + 1, float(tz) + 1), 1.0, G, G + 6, "khaki", 5)
        P.flat(g, tuft & (S.coords(g)[1] > G + 4), "khaki", 6)
    return g


def board() -> Grid:
    """The MOTEL board: a dark panel with a bone rim, big letters, a VACANCY
    strip and a bulb-studded arrow (the function prop)."""
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    bx0, bx1, by0, by1 = BOARD
    cu = (bx0 + bx1) / 2
    sz = int(SIGN[2])
    m = box(g, bx0, by0, sz - 5, bx1, by1, sz + 5, "darkwood", 3)
    P.plates(g, m, "darkwood", 3, size=(12, 10), rivets=True, seed=22)
    P.flat(g, edges(m), "bone", 6)
    for face, plane in (("-z", sz - 5), ("+z", sz + 5)):
        d = np.abs(Z - (plane + (0.5 if face == "-z" else -0.5)))
        P.flat(g, m & (d < 1.0) & (Y > by0 + 4) & (Y < by0 + 14) & (X > bx0 + 4) & (X < bx1 - 4), "darkwood", 1)
        label(g, face, plane, cu, by0 + 6, "VACANCY", "toxic", 6, scale=1, gap=1)
        label(g, face, plane, cu, by0 + 18, "MOTEL", "red", 5, scale=2, gap=1)
        P.flat(g, m & (d < 1.0) & (np.abs(Y - (by0 + 16)) < 0.6), "bone", 6)
    # the arrow under the board, its rim studded with painted bulbs
    g.prism("z", [(bx0 + 4, by0 - 18), (bx1 - 8, by0 - 18), (bx1 - 8, by0 - 4), (bx0 + 4, by0 - 4)], sz - 4, sz + 4, C("gold", 5))
    arrow = S.last(g)
    P.flat(g, arrow, "gold", 5)
    P.flat(g, arrow & (np.abs(Z - sz) > 2.5), "gold", 6)
    g.prism("z", [(bx1 - 8, by0 - 23), (bx1 - 8, by0 + 1), (bx1 + 6, by0 - 11)], sz - 4, sz + 4, C("gold", 5))
    tip = S.last(g)
    P.flat(g, tip, "gold", 5)
    P.flat(g, (arrow | tip) & (Y < by0 - 16.4), "gold", 3)
    for ax in range(bx0 + 6, bx1 - 8, 6):  # the bulbs along the arrow rim
        P.flat(g, arrow & (np.abs(X - ax - 0.5) < 0.6) & ((Y < by0 - 16.6) | (Y > by0 - 5.4)), "bone", 7)
    return g


def build() -> Asset:
    g = shell()
    pivot = bounds_pivot(g)
    root = Part("motel", g, pivot=pivot)
    bx0, bx1, by0, by1 = BOARD
    part(root, "sign", board(), ((bx0 + bx1) / 2, (by0 + by1) / 2, SIGN[2]), rot=(0.0, 0.0, -4.0))
    on, off, dim = (1.0, 1.0, 1.0), (0.001, 0.001, 0.001), (0.985, 0.985, 0.985)
    fl = [(0.0, on), (1.1, on), (1.14, off), (1.22, off), (1.26, on), (1.9, on), (1.94, dim), (2.0, on),
          (2.8, on), (2.84, off), (3.0, off), (3.04, on), (4.0, on)]
    tilt = [(0.0, (0, 0, -4)), (1.26, (0, 0, -4.6)), (2.6, (0, 0, -3.5)), (4.0, (0, 0, -4))]
    return Asset(id="apocalypse-buildings-motel", pack="apocalypse", category="buildings", name="Roadside Motel",
                 root=root, clips=[Clip("idle", {"sign": {"scale": fl, "rot": tilt}})])
