"""Royal carriage in the Pirate Nation style.

A royal-blue lacquered coach body with a curved belly and chamfered
corners (true slopes), gold beading, a gold-framed door with the royal
crest on each side and glowing windows with red curtains, riding on a dark
perch between big gold-hubbed spoked wheels (the rear pair oversized, F4).
A raised coachman's box with a red cushion and a sloped footboard sits in
front; a luggage trunk rides at the back. The oversized function prop is
the giant gold crown on the curved roof. Two lanterns glow on the front
corners. The wheels turn and the body rocks on `move`; the body sways
gently on `idle`. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import FRONT, icon_on, idx, keys
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket, turn

SZ = (60, 90, 104)
CX = 30
FA, FR = 22, 9  # front axle z, radius
RA, RR = 78, 12  # rear axle z, radius (oversized)
WHEEL_X = {"l": (CX - 21, CX - 18), "r": (CX + 18, CX + 21)}
BZ0, BZ1 = 38, 72  # body z extent
BY0, WAIST, BTOP = 20, 32, 56  # belly bottom, waist and roof edge
HALF = 13  # half width of the body
HANG = (CX, BY0, (BZ0 + BZ1) / 2)  # the body rocks about its belly


def chassis() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = idx(g)
    for az, r in ((FA, FR), (RA, RR)):
        ax = box(g, CX - 19, r - 1, az - 1, CX + 19, r + 2, az + 2, "darkwood", 3)
        P.planks(g, ax, "darkwood", 3, width=3, across="y", nails=False)
    # the perch: a dark beam from axle to axle, bending down under the body (true slopes)
    g.prism("x", [(FR + 1, FA - 2), (FR + 5, FA - 2), (BY0 - 2, BZ0), (BY0 - 2, BZ1), (RR + 5, RA + 2), (RR + 1, RA + 2), (BY0 - 6, BZ1), (BY0 - 6, BZ0)], CX - 2, CX + 2, C("darkwood", 4))
    P.flat(g, g.solids[-1].mask(g.shape), "darkwood", 4)
    # C-springs (gold) that carry the body at both ends
    for z in (BZ0 - 2, BZ1 + 2):
        for s in (-1, 1):
            sx = CX + s * 8
            box(g, sx - 1, BY0 - 6, z - 1, sx + 1, BY0 + 2, z + 1, "gold", 4)
    # the coachman's box: a raised seat with a red cushion and a sloped footboard
    seat = box(g, CX - 12, 26, 14, CX + 12, 32, 26, "darkwood", 4)
    P.planks(g, seat, "darkwood", 4, width=2, across="y", seed=1)
    P.flat(g, edges(seat), "gold", 4)
    cushion = box(g, CX - 11, 32, 16, CX + 11, 35, 26, "red", 4)
    P.mottle(g, cushion, "red", 4, cell=2, seed=2)
    P.outline(g, cushion, "gold", 5, normal="y")
    back = box(g, CX - 12, 32, 25, CX + 12, 42, 28, "darkwood", 4)
    P.planks(g, back, "darkwood", 4, width=2, across="y", seed=3)
    P.flat(g, back & (Y >= 40), "gold", 4)
    sup = box(g, CX - 6, 14, 20, CX + 6, 26, 34, "darkwood", 4)  # box support
    P.planks(g, sup, "darkwood", 4, width=3, across="x", nails=False, seed=4)
    g.prism("x", [(17, 7), (19, 7), (27, 14), (25, 14)], CX - 9, CX + 9, C("wood", 6))  # footboard
    fb = g.solids[-1].mask(g.shape)
    P.planks(g, fb, "wood", 6, width=3, across="x", nails=False, seed=4)
    P.outline(g, fb, "darkwood", 3, normal="x")
    # a sloped tongue for the horses
    g.prism("x", [(FR - 1, FA - 4), (FR + 2, FA - 4), (6, 1), (3, 1)], CX - 1.5, CX + 1.5, C("darkwood", 4))
    # a luggage trunk on the rear platform
    plat = box(g, CX - 12, RR + 4, BZ1 + 4, CX + 12, RR + 7, BZ1 + 16, "darkwood", 4)
    P.planks(g, plat, "darkwood", 4, width=3, across="x", seed=5)
    trunk = box(g, CX - 10, RR + 7, BZ1 + 5, CX + 10, RR + 18, BZ1 + 15, "red", 3)
    P.planks(g, trunk, "red", 3, width=3, across="y", nails=False, seed=6)
    P.flat(g, edges(trunk) | (trunk & (np.abs(X + 0.5 - CX) < 1.2)), "gold", 5)
    return g


def cabin() -> Grid:
    """The coach body, its roof and the crown (its own part)."""
    g = Grid(*SZ)
    X, Y, Z = idx(g)
    prof = [(BZ0 + 6, BY0), (BZ1 - 6, BY0), (BZ1, WAIST), (BZ1 + 1, BTOP - 5), (BZ1 - 2, BTOP), (BZ0 + 2, BTOP), (BZ0 - 1, BTOP - 5), (BZ0, WAIST)]
    g.prism("x", [(y, z) for z, y in prof], CX - HALF, CX + HALF, C("blue", 4))
    body = g.solids[-1].mask(g.shape)
    for m, fr in S.facets(g):
        P.mottle(g, m, "blue", 4, cell=4, seed=7)
    # gold beading: the side rim, the waist line and the corner seams
    side = body & ((X == CX - HALF) | (X == CX + HALF - 1))
    P.flat(g, side & ((Y == WAIST) | (Y == WAIST + 1)), "gold", 5)
    P.flat(g, body & S.seams(g, [g.solids[-1]], 1.0), "gold", 5)
    ring = side & ~(np.roll(side, 1, 1) & np.roll(side, -1, 1) & np.roll(side, 1, 2) & np.roll(side, -1, 2))
    P.flat(g, ring, "gold", 5)
    # doors with the crest, windows with curtains (both sides and both ends)
    zc = (BZ0 + BZ1) // 2
    for x in (CX - HALF, CX + HALF - 1):
        door = side & (X == x) & (np.abs(Z + 0.5 - zc) < 7) & (Y >= BY0 + 3) & (Y < BTOP - 4)
        P.flat(g, door & ((np.abs(Z + 0.5 - zc) > 6) | (Y == BY0 + 3) | (Y == BTOP - 5)), "gold", 6)
        win = door & (Y >= WAIST + 4) & (Y < BTOP - 7) & (np.abs(Z + 0.5 - zc) < 5)
        P.flat(g, win, "gold", 7)
        P.flat(g, win & (np.abs(Z + 0.5 - zc) > 2.9), "red", 4)
        P.flat(g, win & (np.abs(Z + 0.5 - zc) < 0.6), "gold", 4)
        crest = door & (Y >= BY0 + 5) & (Y < WAIST - 1)
        P.flat(g, crest & (np.abs(Z + 0.5 - zc) < 4.5), "red", 4)
        icon_on(g, crest, Z, Y, zc - 4, BY0 + 5, "crown", "gold", 6, flip=(x == CX + HALF - 1))
        for zz in (BZ0 + 3, BZ1 - 8):  # side windows
            w2 = side & (X == x) & (Z >= zz) & (Z < zz + 5) & (Y >= WAIST + 4) & (Y < BTOP - 7)
            P.flat(g, w2, "gold", 7)
            P.flat(g, w2 & ((Z == zz) | (Z == zz + 4)), "red", 4)
    occ = g.a > 0
    open_front = np.zeros(g.shape, dtype=bool)
    open_front[:, :, 1:] = ~occ[:, :, :-1]
    open_back = np.zeros(g.shape, dtype=bool)
    open_back[:, :, :-1] = ~occ[:, :, 1:]
    for opened in (open_front, open_back):
        end = body & opened & (np.abs(X + 0.5 - CX) < 6) & (Y >= WAIST + 4) & (Y < BTOP - 7)
        P.flat(g, end, "gold", 7)
        P.flat(g, end & (np.abs(X + 0.5 - CX) > 3.9), "red", 4)
    # the curved roof: a low arched cap with a gold rail
    arc = [(BZ0 - 2, BTOP), (BZ1 + 2, BTOP), (BZ1 + 2, BTOP + 2), (BZ1 - 6, BTOP + 6), (BZ0 + 6, BTOP + 6), (BZ0 - 2, BTOP + 2)]
    g.prism("x", [(y, z) for z, y in arc], CX - HALF - 2, CX + HALF + 2, C("blue", 3))
    roof = g.solids[-1].mask(g.shape)
    for m, fr in S.facets(g):
        P.tiles(g, m, "blue", 3, row=3, width=5, frame=fr, seed=8)
    P.flat(g, roof & (Y < BTOP + 1), "gold", 5)
    # the giant crown (the function prop): a gold band with five points and red gems
    cz = (BZ0 + BZ1) / 2
    band = S.disc(g, "y", CX, cz, 8, BTOP + 6, BTOP + 12, "gold", 5, n=8)
    P.flat(g, band & (Y == BTOP + 6), "gold", 3)
    for k in range(8):
        a = FRONT + 2 * np.pi * k / 8
        px, pz = CX + 7.0 * np.cos(a), cz + 7.0 * np.sin(a)
        g.prism("y", S.flat_ngon(px, pz, 2.2, 4, FRONT), BTOP + 12, BTOP + 19, C("gold", 6), top=[(px, pz)] * 4)
        g.prism("y", S.flat_ngon(px, pz, 1.2, 4, FRONT), BTOP + 8, BTOP + 10, C("red", 5))
    S.disc(g, "y", CX, cz, 5, BTOP + 12, BTOP + 15, "red", 4)
    g.prism("y", S.flat_ngon(CX, cz, 2.5, 4, FRONT), BTOP + 15, BTOP + 22, C("gold", 6), top=[(CX, cz)] * 4)
    # lanterns on the front corners
    for s in (-1, 1):
        lx = CX + s * (HALF + 2)
        box(g, lx - 1, 36, BZ0 + 1, lx + 1, 40, BZ0 + 3, "gold", 4)
        lamp = box(g, lx - 2, 40, BZ0 - 1, lx + 2, 47, BZ0 + 3, "gold", 7)
        P.flat(g, edges(lamp), "gold", 4)
        g.prism("x", [(47, BZ0 - 2), (47, BZ0 + 4), (51, BZ0 + 1)], lx - 2.5, lx + 2.5, C("gold", 4))
    return g


def wheel_grid(side: str, az: int, r: int) -> Grid:
    g = Grid(*SZ)
    x0, x1 = WHEEL_X[side]
    S.wheel(g, "x", az, 0, r, x0, x1, spokes=8, gaps=True, tyre=("darkwood", 3), rim=("blue", 3), spoke=("gold", 5), hub=("gold", 4))
    return g


def build() -> Asset:
    root = Part("carriage", chassis())
    root.add(Part("cabin", cabin(), pivot=HANG, at=HANG))
    move, idle = {}, {}
    for side in ("l", "r"):
        for end, az, r in (("f", FA, FR), ("b", RA, RR)):
            name = f"wheel-{side}{end}"
            hub = ((WHEEL_X[side][0] + WHEEL_X[side][1]) / 2, float(r), float(az))
            root.add(Part(name, wheel_grid(side, az, r), pivot=hub, at=hub))
            # rear: one turn per second; front: 8 spokes, so 1.25 turns loops seamlessly
            move[name] = {"rot": turn(1.0, "x", -360)}
    move["cabin"] = {"rot": keys((0, 0, 0, 0), (0.25, 0, 0, 2), (0.5, 0, 0, 0), (0.75, 0, 0, -2), (1.0, 0, 0, 0))}
    idle["cabin"] = {"rot": keys((0, 0, 0, 0), (1.5, 1, 0, 0.5), (3.0, 0, 0, 0))}
    lamp = (CX + HALF + 2, 43.5, BZ0 + 1)
    return Asset(id="fantasy-vehicles-royal-carriage", pack="fantasy", category="vehicles", name="Royal Carriage", root=root,
                 clips=[Clip("move", move), Clip("idle", idle)], sockets=[Socket("socket-lantern", at=lamp, parent="cabin")])
