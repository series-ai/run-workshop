"""Ballista war cart in the Pirate Nation style.

A heavy oak platform with flared, iron-strapped sideboards (true slopes),
round shields hung along both sides, a big slanted mantlet at the front
with a painted royal crest, and four big spoked wheels. The oversized
function prop is the siege ballista on a gold turntable: a long trough
with a loaded gold-tipped bolt, two huge swept bow arms (true diagonals)
with a taut bowstring, a winch wheel and aiming handles. Wheels turn on
`move`; the ballista swings, recoils and fires on `attack` (a spark at the
bolt). A bolt rack and a pennant finish it. Faces -Z.
"""

import numpy as np

import paint as P
import pnshapes as S
from _bld import icon_on, idx, keys
from pnkit import box, crate, pennant
from voxgrid import C, Asset, Clip, Grid, Part, Socket, turn

SZ = (66, 72, 100)
CX = 33
FA, RA, WR = 28, 74, 11  # axles and wheel radius
BED0, BED1 = 15, 24  # platform bottom and rail top
BZ0, BZ1 = 12, 90
HALF = 17
DECK = 21  # deck top (inside the sideboards)
TZ = 56  # turntable centre z
WHEEL_X = {"l": (CX - 23, CX - 19), "r": (CX + 19, CX + 23)}


def cart() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = idx(g)
    for az in (FA, RA):  # axles and bolsters
        ax = box(g, CX - 20, WR - 1, az - 2, CX + 20, WR + 2, az + 2, "darkwood", 3)
        P.planks(g, ax, "darkwood", 3, width=3, across="y", nails=False)
        bol = box(g, CX - 12, WR + 2, az - 3, CX + 12, BED0, az + 3, "darkwood", 4)
        P.planks(g, bol, "darkwood", 4, width=2, across="y", nails=False)
    # the platform: a flared plank bed (true slopes), dark rail and iron straps
    poly = [(CX - HALF + 2, BED0), (CX + HALF - 2, BED0), (CX + HALF, BED1), (CX - HALF, BED1)]
    g.prism("z", poly, BZ0, BZ1, C("wood", 5))
    bed = g.solids[-1].mask(g.shape)
    P.planks(g, bed, "wood", 5, width=3, across="y", length=(14, 22), seed=1)
    P.flat(g, bed & (Y >= BED1 - 2), "darkwood", 3)
    P.flat(g, bed & (Y < BED0 + 1.5), "darkwood", 4)
    straps = bed & (((Z - BZ0) % 13 < 2) | (Z < BZ0 + 2) | (Z >= BZ1 - 2)) & (Y < BED1 - 2)
    P.flat(g, straps, "steel", 4)
    P.flat(g, straps & ((Y + Z) % 4 == 0), "steel", 6)
    deck = bed & (Y == BED1 - 1) & (np.abs(X + 0.5 - CX) < HALF - 2) & (Z >= BZ0 + 2) & (Z < BZ1 - 2)
    P.planks(g, deck, "wood", 6, width=3, across="x", length=(20, 30), frame="top", seed=2)
    # round shields hung along both sides (red and blue with gold bosses)
    for k, sz in enumerate((BZ0 + 10, BZ0 + 36, BZ0 + 62)):
        for side, x0 in ((-1, CX - HALF - 2), (1, CX + HALF)):
            ramp = "red" if (k + (side > 0)) % 2 else "blue"
            sh = S.disc(g, "x", 19, sz, 6.5, x0, x0 + 2, ramp, 4)
            rr = S.radial(g, "x", 19, sz)
            P.flat(g, sh & (rr > 5.0), "gold", 5)
            P.flat(g, sh & (rr < 2.0), "gold", 6)
            P.flat(g, sh & (rr >= 2.0) & (rr < 5.0) & (np.abs(Y + 0.5 - 19) < 0.8), "gold", 4)
    # the slanted mantlet at the front: red boards, a gold rim and the royal crest
    mz, mtop = BZ0 + 1, BED1 + 13
    g.prism("x", [(BED1 - 3, mz), (BED1 - 3, mz + 4), (mtop, mz + 9), (mtop, mz + 5)], CX - HALF - 1, CX + HALF + 1, C("red", 4))
    mant = g.solids[-1].mask(g.shape)
    for m, fr in S.facets(g):
        P.planks(g, m, "red", 4, width=3, across="x", length=(60, 61), nails=True, frame=fr, seed=3)
    P.flat(g, mant & ((Y >= mtop - 2) | (X == CX - HALF - 1) | (X == CX + HALF)), "gold", 5)
    open_front = np.zeros(g.shape, dtype=bool)
    open_front[:, :, 1:] = g.a[:, :, :-1] == 0
    front = mant & open_front & (Y > BED1 - 3) & (Y < mtop - 2) & (np.abs(X + 0.5 - CX) < 11.5)
    P.flat(g, front, "blue", 4)
    P.flat(g, front & ((np.abs(X + 0.5 - CX) > 10.4) | (Y == BED1 - 2) | (Y == mtop - 3)), "gold", 6)
    icon_on(g, front, X, Y, CX - 9, BED1, "crown", "gold", 6, scale=2, flip=True)
    # a sloped tongue with a crossbar
    g.prism("x", [(BED0 - 2, BZ0), (BED0 + 1, BZ0), (6, 1), (3, 1)], CX - 1.5, CX + 1.5, C("darkwood", 4))
    bar = box(g, CX - 8, 3, 1, CX + 8, 6, 4, "darkwood", 3)
    P.planks(g, bar, "darkwood", 3, width=3, across="y")
    # a bolt rack and a pennant at the back
    rack = box(g, CX - 14, BED1 - 2, BZ1 - 10, CX - 4, BED1 + 6, BZ1 - 3, "darkwood", 4)
    P.planks(g, rack, "darkwood", 4, width=2, across="y", nails=False)
    for k in range(3):
        bx = CX - 13 + k * 3
        box(g, bx, BED1 + 6, BZ1 - 12, bx + 2, BED1 + 8, BZ1 - 1, "wood", 6)
        g.prism("x", [(BED1 + 6, BZ1 - 12), (BED1 + 8, BZ1 - 12), (BED1 + 7, BZ1 - 16)], bx, bx + 2, C("steel", 6))
    pennant(g, CX + 12, BED1 - 2, BZ1 - 5, 30, 12, "red")
    crate(g, CX + 3, BED1 - 2, BZ1 - 11, 8, seed=4)
    return g


def ballista() -> tuple[Grid, tuple]:
    """The siege ballista on its turntable (its own part)."""
    g = Grid(*SZ)
    X, Y, Z = idx(g)
    tt = S.disc(g, "y", CX, TZ, 10, DECK, DECK + 3, "gold", 4)
    P.flat(g, tt & (S.radial(g, "y", CX, TZ) > 8.8), "gold", 3)
    post = box(g, CX - 4, DECK + 3, TZ - 4, CX + 4, DECK + 12, TZ + 4, "darkwood", 4)
    P.planks(g, post, "darkwood", 4, width=2, across="y", nails=False)
    ty = DECK + 12  # trough bottom
    trough = box(g, CX - 4, ty, 16, CX + 4, ty + 5, TZ + 22, "wood", 5)
    P.planks(g, trough, "wood", 5, width=2, across="z", length=(80, 81), nails=False, seed=5)
    P.flat(g, trough & ((Z % 10 < 2)), "iron", 5)
    # the torsion frame and two swept bow arms (true diagonals)
    frame = box(g, CX - 9, ty - 2, 24, CX + 9, ty + 12, 30, "darkwood", 4)
    P.planks(g, frame, "darkwood", 4, width=3, across="x", nails=True, seed=6)
    skeins = box(g, CX - 8, ty - 1, 23, CX - 5, ty + 11, 31, "sand", 5) | box(g, CX + 5, ty - 1, 23, CX + 8, ty + 11, 31, "sand", 5)
    P.flat(g, skeins & (Y % 2 == 0), "sand", 4)
    arm_y0, arm_y1 = ty + 3, ty + 7
    tips = []
    for s in (-1, 1):
        root = (CX + s * 8, 27)
        tip = (CX + s * 30, 36)
        g.prism("y", S.quad(root, tip, 2.4, 1.4), arm_y0, arm_y1, C("steel", 5))
        am = g.solids[-1].mask(g.shape)
        P.flat(g, am & (Y >= arm_y1 - 1), "steel", 6)
        box(g, round(tip[0]) - 2, arm_y0 - 1, round(tip[1]) - 2, round(tip[0]) + 2, arm_y1 + 1, round(tip[1]) + 2, "gold", 5)
        tips.append(tip)
    # the bowstring from the tips back to the claw at the trough
    claw_z = TZ + 12
    for tip in tips:
        g.prism("y", S.quad(tip, (CX, claw_z), 0.6), arm_y0 + 1, arm_y0 + 3, C("bone", 6))
    box(g, CX - 2, ty + 5, claw_z - 1, CX + 2, ty + 8, claw_z + 3, "iron", 5)
    # the loaded bolt: a long shaft with a gold head and red fletching
    shaft = box(g, CX - 1, ty + 5, 10, CX + 1, ty + 7, claw_z, "wood", 6)
    g.prism("x", [(ty + 3, 10), (ty + 9, 10), (ty + 6, 3)], CX - 1.5, CX + 1.5, C("gold", 5))
    g.prism("y", [(CX - 4, claw_z - 6), (CX + 4, claw_z - 6), (CX + 1, claw_z - 1), (CX - 1, claw_z - 1)], ty + 5, ty + 7, C("red", 4))
    # the winch at the back: a gold-rimmed wheel with spokes on the +x side
    wz, wy = TZ + 16, ty + 3
    wm = S.disc(g, "x", wy, wz, 6, CX + 4, CX + 6, "darkwood", 4)
    rr = S.radial(g, "x", wy, wz)
    P.flat(g, wm & (rr > 4.8), "gold", 5)
    P.flat(g, wm & ((np.abs(Y + 0.5 - wy) < 0.8) | (np.abs(Z + 0.5 - wz) < 0.8)), "wood", 6)
    for s in (-1, 1):  # aiming handles
        g.prism("y", S.quad((CX + s * 4, TZ + 22), (CX + s * 9, TZ + 28), 1.2), ty + 1, ty + 3, C("darkwood", 3))
    return g, (CX, float(DECK), float(TZ))


def wheel_grid(side: str, az: int) -> Grid:
    g = Grid(*SZ)
    x0, x1 = WHEEL_X[side]
    S.wheel(g, "x", az, 0, WR, x0, x1, spokes=8, gaps=True, tyre=("steel", 3), rim=("darkwood", 4), spoke=("wood", 5), hub=("gold", 4))
    return g


def build() -> Asset:
    root = Part("ballista-cart", cart())
    bg, bpivot = ballista()
    root.add(Part("ballista", bg, pivot=bpivot, at=bpivot))
    move = {}
    for side in ("l", "r"):
        for end, az in (("f", FA), ("b", RA)):
            name = f"wheel-{side}{end}"
            hub = ((WHEEL_X[side][0] + WHEEL_X[side][1]) / 2, float(WR), float(az))
            root.add(Part(name, wheel_grid(side, az), pivot=hub, at=hub))
            move[name] = {"rot": turn(1.2, "x", -300)}
    attack = {"ballista": {"rot": keys((0, 0, 0, 0), (0.4, 0, 20, 0), (0.6, 0, 20, 0), (0.66, -5, 20, 0), (0.85, 0, 20, 0), (1.4, 0, 0, 0))}}
    ty = DECK + 12
    return Asset(id="fantasy-vehicles-ballista-cart", pack="fantasy", category="vehicles", name="Ballista War Cart", root=root,
                 clips=[Clip("move", move), Clip("attack", attack, loop=False)],
                 sockets=[Socket("socket-bolt", at=(CX, ty + 6, 4), parent="ballista")],
                 pfx=[{"effectId": "rvx-fantasy-bow-release", "socket": "socket-bolt", "trigger": "clip:attack", "size": 44, "aim": [0.0, 0.0, -1.0], "offset": [0.0, 3.0, -8.0], "at": 0.56}])
