"""Siege tower in the Pirate Nation style.

A tall tapering timber tower (one frustum, true slopes) of painted planks
with thick dark corner posts and storey beams, sand-coloured wet hides
stitched on the front, iron-riveted plates, a crenellated fighting deck
with red and blue banners, a heavy chassis and six big spoked wheels that
turn on `move`. The oversized function prop is the hinged assault bridge
on the front: a big planked drawbridge with iron straps and gold studs
that drops forward on `attack` (a smoke puff where it lands). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import icon, icon_on, idx, keys, merlons
from pnkit import box, edges, pennant
from voxgrid import C, Asset, Clip, Grid, Part, Socket, turn

SZ = (84, 152, 104)
CX = 42
X0, X1, Z0, Z1 = 14, 70, 22, 86  # tower foot
T0, T1, U0, U1 = 20, 64, 30, 78  # tower top
BASE, TOP = 16, 122
WR = 11
AXLES = (32, 54, 76)
WHEEL_X = {"l": (X0 - 7, X0 - 3), "r": (X1 + 3, X1 + 7)}
BR_W, BR_H = 32, 38  # bridge width and height
BR_Y0 = 80  # bridge hinge height


def front_z(y: float) -> float:
    """The z of the sloping front face at height y."""
    return Z0 + (U0 - Z0) * (y - BASE) / (TOP - BASE)


def tower() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = idx(g)
    # the heavy chassis and axles
    for az in AXLES:
        ax = box(g, X0 - 3, WR - 1, az - 2, X1 + 3, WR + 2, az + 2, "darkwood", 3)
        P.planks(g, ax, "darkwood", 3, width=3, across="y", nails=False)
    ch = box(g, X0 - 2, WR + 2, Z0 - 2, X1 + 2, BASE, Z1 + 2, "darkwood", 4)
    P.planks(g, ch, "darkwood", 4, width=3, across="y", seed=1)
    P.flat(g, edges(ch), "iron", 5)
    # the tapering tower: one frustum, painted planks, dark posts and beams
    g.prism("y", [(X0, Z0), (X1, Z0), (X1, Z1), (X0, Z1)], BASE, TOP, C("wood", 5), top=[(T0, U0), (T1, U0), (T1, U1), (T0, U1)])
    solid = [g.solids[-1]]
    body = g.solids[-1].mask(g.shape)
    for m, fr in S.facets(g, solid):
        P.planks(g, m, "wood", 5, width=4, across="y", length=(30, 50), frame=fr, seed=2)
    P.flat(g, body & S.seams(g, solid, 2.2), "darkwood", 3)  # corner posts
    for yb in (BASE, 50, 86, TOP - 3):
        P.flat(g, body & (Y >= yb) & (Y < yb + 3), "darkwood", 3)
    # stitched hides on the lower front and the sides (sand, with dark stitches)
    hide = body & (Y >= BASE + 5) & (Y < 48) & (np.abs(X + 0.5 - CX) < 20) & (Z < front_z(48) + 2)
    P.flat(g, hide, "sand", 5)
    P.flat(g, hide & (((X - CX) % 10 == 0) | ((Y - BASE) % 11 == 0)), "sand", 3)
    P.flat(g, hide & (((X - CX) % 10 == 0) | ((Y - BASE) % 11 == 0)) & (Y % 2 == 0), "darkwood", 3)
    for side in (X0, X1 - 1):
        sh = body & (np.abs(X - side) < 3) & (Y >= 54) & (Y < 82) & (Z > Z0 + 14) & (Z < Z1 - 12)
        P.flat(g, sh, "sand", 5)
        P.flat(g, sh & ((Z % 9 == 0) | (Y % 9 == 0)), "sand", 3)
    # big royal banners painted on both sides (blue with a gold crown, red with a gold tower)
    occ = g.a > 0
    for side, ramp, charge in ((-1, "blue", "crown"), (1, "red", "tower")):
        opened = np.zeros(g.shape, dtype=bool)
        if side < 0:
            opened[1:] = ~occ[:-1]
        else:
            opened[:-1] = ~occ[1:]
        zc = (Z0 + Z1) / 2 + 2
        ban = body & opened & (np.abs(Z + 0.5 - zc) < 10) & (Y >= 54) & (Y < 84)
        P.flat(g, ban, ramp, 4)
        P.flat(g, ban & ((np.abs(Z + 0.5 - zc) > 9) | (Y == 54) | (Y == 83)), "gold", 5)
        P.flat(g, ban & (Y < 58) & (np.abs(Z + 0.5 - zc) < 3.5 + (Y - 54)), ramp, 4)
        icon_on(g, ban, Z, Y, int(zc) - 9, 62, charge, "gold", 6, scale=2, flip=(side > 0))
    # iron plates with rivets on the upper corners
    plates = body & (Y >= 90) & (Y < TOP - 4) & ((np.abs(X + 0.5 - CX) > 14))
    P.plates(g, plates, "steel", 4, size=(7, 8), frame=None)
    # the fighting deck: a plank floor, a wooden crenellated parapet and banners
    deck = box(g, T0 - 3, TOP, U0 - 3, T1 + 3, TOP + 3, U1 + 3, "wood", 5)
    P.planks(g, deck, "wood", 5, width=4, across="x", length=(30, 50), seed=3)
    P.flat(g, edges(deck), "darkwood", 3)
    par = box(g, T0 - 3, TOP + 3, U0 - 3, T1 + 3, TOP + 8, U0, "wood", 4) | box(g, T0 - 3, TOP + 3, U1, T1 + 3, TOP + 8, U1 + 3, "wood", 4)
    par |= box(g, T0 - 3, TOP + 3, U0, T0, TOP + 8, U1, "wood", 4) | box(g, T1, TOP + 3, U0, T1 + 3, TOP + 8, U1, "wood", 4)
    P.planks(g, par, "wood", 4, width=3, across="x", length=(40, 41), nails=True, seed=4)
    P.flat(g, par & (Y == TOP + 7), "darkwood", 3)
    for axis, a0, a1, u0, u1 in (("x", U0 - 3, U0, T0 - 3, T1 + 3), ("x", U1, U1 + 3, T0 - 3, T1 + 3), ("z", T0 - 3, T0, U0, U1), ("z", T1, T1 + 3, U0, U1)):
        mm = merlons(g, axis, u0, u1, a0, a1, TOP + 8, 7, w=7, gap=5, ramp="wood", base=4, seed=5)
        P.planks(g, mm, "wood", 4, width=3, across="x" if axis == "x" else "z", length=(40, 41), nails=True, seed=6)
        P.flat(g, mm & (Y >= TOP + 14), "darkwood", 3)
    pennant(g, T1 - 2, TOP + 3, U1, 24, 14, "red")
    pennant(g, T0 + 1, TOP + 3, U1, 20, 12, "blue")
    # the bridge frame on the front: dark jambs and a lintel around the hatch
    fz = front_z(BR_Y0 + BR_H)
    jambs = box(g, CX - BR_W // 2 - 4, BR_Y0 - 2, fz - 4, CX - BR_W // 2, BR_Y0 + BR_H + 4, fz + 2, "darkwood", 3)
    jambs |= box(g, CX + BR_W // 2, BR_Y0 - 2, fz - 4, CX + BR_W // 2 + 4, BR_Y0 + BR_H + 4, fz + 2, "darkwood", 3)
    jambs |= box(g, CX - BR_W // 2 - 4, BR_Y0 + BR_H, fz - 4, CX + BR_W // 2 + 4, BR_Y0 + BR_H + 4, fz + 2, "darkwood", 3)
    P.planks(g, jambs, "darkwood", 3, width=4, across="x", nails=True, seed=7)
    # chains from the lintel to the bridge top
    for s in (-1, 1):
        box(g, CX + s * (BR_W // 2 - 3), BR_Y0 + BR_H, fz - 7, CX + s * (BR_W // 2 - 3) + 1, BR_Y0 + BR_H + 2, fz - 4, "iron", 5)
    return g


def bridge() -> tuple[Grid, tuple]:
    """The assault bridge (its own part), closed at rest: a planked board
    with iron straps and gold studs, hinged at its foot."""
    g = Grid(*SZ)
    fz = front_z(BR_Y0 + BR_H)
    z1 = fz - 4
    b = box(g, CX - BR_W // 2, BR_Y0, z1 - 4, CX + BR_W // 2, BR_Y0 + BR_H, z1, "wood", 5)
    P.planks(g, b, "wood", 5, width=4, across="x", length=(60, 61), nails=False, seed=8)
    X, Y, Z = idx(g)
    straps = b & (((Y - BR_Y0) % 12 >= 4) & ((Y - BR_Y0) % 12 < 7))
    P.flat(g, straps, "iron", 5)
    P.flat(g, straps & (X % 4 == 0), "gold", 6)
    P.flat(g, edges(b), "darkwood", 3)
    # a big painted crest on the face: a red field with a gold tower
    field = b & (Z == z1 - 4) & (np.abs(X + 0.5 - CX) < 11) & (Y >= BR_Y0 + 8) & (Y < BR_Y0 + 32)
    P.flat(g, field, "red", 4)
    P.flat(g, field & ((np.abs(X + 0.5 - CX) > 10) | (Y == BR_Y0 + 8) | (Y == BR_Y0 + 31)), "gold", 5)
    icon(g, "-z", z1 - 4, CX - 7, BR_Y0 + 13, "tower", "gold", 6, scale=2)
    return g, (float(CX), float(BR_Y0), float(z1 - 2))


def wheel_grid(side: str, az: int) -> Grid:
    g = Grid(*SZ)
    x0, x1 = WHEEL_X[side]
    S.wheel(g, "x", az, 0, WR, x0, x1, spokes=8, gaps=True, tyre=("steel", 3), rim=("darkwood", 4), spoke=("wood", 5), hub=("iron", 5))
    return g


def build() -> Asset:
    root = Part("siege-tower", tower())
    bg, hinge = bridge()
    root.add(Part("bridge", bg, pivot=hinge, at=hinge))
    move = {}
    for i, az in enumerate(AXLES):
        for side in ("l", "r"):
            name = f"wheel-{i}{side}"
            hub = ((WHEEL_X[side][0] + WHEEL_X[side][1]) / 2, float(WR), float(az))
            root.add(Part(name, wheel_grid(side, az), pivot=hub, at=hub))
            move[name] = {"rot": turn(2.0, "x", -180)}
    attack = {"bridge": {"rot": keys((0, 0, 0, 0), (0.6, -60, 0, 0), (0.8, -95, 0, 0), (0.9, -86, 0, 0), (1.0, -90, 0, 0))}}
    tip = (CX, hinge[1], hinge[2] - BR_H)
    return Asset(id="fantasy-vehicles-siege-tower", pack="fantasy", category="vehicles", name="Siege Tower", root=root,
                 clips=[Clip("move", move), Clip("attack", attack, loop=False)],
                 sockets=[Socket("socket-bridge", at=tip)],
                 pfx=[{"effectId": "rvx-fantasy-dust-slam", "socket": "socket-bridge", "trigger": "clip:attack", "size": 70, "at": 0.4}])
