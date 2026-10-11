"""Mine cart in the Pirate Nation style.

A small rail tub that one miner pushes. A short section of track (two steel
rails spiked to four timber sleepers) carries a tapered iron tub on four
small flanged rail wheels. The tub flares out from its floor to a heavy
rolled rim (true slopes, rule F2); it is painted as riveted plates with
dark seams, iron corner straps and a band of rust low down (rules S2, S4).
Oak buffer beams sit at both ends. The oversized function prop is the load
(rule F4): a heap of grey ore with big gold nuggets and a pickaxe across
it (rule C3). A torch in a bracket at the back carries the flame (PFX).

On `move` the cart rolls forward and back along the rails. The wheels turn
by the distance rolled, and the tub rides the wheel corners, so the treads
touch the rail heads at each frame. About 30 wide, 42 long and 28 tall.
Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _props import coords, flame_tongue, plank_box
from _vehicle_contact import Axle, body_keys, check_rest, spin_keys
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket

SZ = (34, 34, 46)
CX, ZC = 17.0, 22.0  # track centre (x) and cart centre (z)
RAIL_X = (CX - 9, CX + 9)  # rail centres
RT = 5  # rail head top
WR, NSIDE = 4.0, 10  # tread flat radius and sides
WZ = (ZC - 7, ZC + 7)  # axle z
HUB_Y = RT + WR
TUB0, TUB1 = 11, 24  # tub floor and rim
SECONDS = 2.0
TRAVEL = 3.0  # roll forward and back by this many voxels


def track() -> Grid:
    """Four sleepers and two steel rails with spikes."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    for z0 in (1, 12, 26, 37):
        sl = plank_box(g, CX - 15, 0, z0, CX + 15, 2, z0 + 5, "darkwood", 4, across="x", width=5, frame=("darkwood", 2), seed=z0)
        P.flat(g, sl & (Y > 1) & (np.floor(X).astype(int) % 7 == 3), "darkwood", 5)
    for rx in RAIL_X:
        foot = box(g, rx - 2, 2, 0, rx + 2, 3, 44, "iron", 4)
        rail = box(g, rx - 1, 3, 0, rx + 1, RT, 44, "steel", 4)
        P.flat(g, rail & (Y > RT - 1), "steel", 5)  # the polished head
        P.flat(g, rail & (Y < RT - 1), "steel", 3)
        P.flat(g, foot & ((np.floor(Z).astype(int) % 11) == 3) & (np.abs(X - rx) > 1), "iron", 6)  # spike heads
        P.flat(g, foot & ((Z < 1) | (Z > 43)), "iron", 2)
    return g


def tub(g: Grid) -> None:
    """The tapered tub, its rolled rim, straps, buffers and the axle hangers."""
    X, Y, Z = coords(g)
    bottom = [(CX - 11, ZC - 12), (CX + 11, ZC - 12), (CX + 11, ZC + 12), (CX - 11, ZC + 12)]
    top = [(CX - 13.5, ZC - 15), (CX + 13.5, ZC - 15), (CX + 13.5, ZC + 15), (CX - 13.5, ZC + 15)]
    g.prism("y", bottom, TUB0, TUB1, C("steel", 4), top=top)
    shell = S.last(g)
    for k, (fm, fr) in enumerate(S.facets(g, [g.solids[-1]])):
        if fr == "top":
            continue
        P.plates(g, fm, "steel", 4, size=(7, 5), frame=fr, seed=k)
    # the top face is the dark inside of the tub around the ore
    P.flat(g, shell & (Y > TUB1 - 1), "steel", 1)
    # rust low on the sides and iron corner straps with rivets (rule S4)
    P.flat(g, shell & (Y < TUB0 + 2), "rust", 4)
    P.flat(g, shell & (Y >= TUB0 + 2) & (Y < TUB0 + 3) & (np.floor(X + Z).astype(int) % 3 != 0), "rust", 5)
    w = 11 + (Y - TUB0) / (TUB1 - TUB0) * 2.5
    l = 12 + (Y - TUB0) / (TUB1 - TUB0) * 3.0
    corner = shell & (np.abs(np.abs(X - CX) - w) < 1.6) & (np.abs(np.abs(Z - ZC) - l) < 1.6) & (Y < TUB1 - 1)
    P.flat(g, corner, "steel", 2)
    P.flat(g, corner & (np.floor(Y).astype(int) % 3 == 1), "steel", 5)
    # the rolled rim: four proud bars around the mouth
    for x0, z0, x1, z1 in ((CX - 14.5, ZC - 16, CX + 14.5, ZC - 14), (CX - 14.5, ZC + 14, CX + 14.5, ZC + 16),
                           (CX - 14.5, ZC - 14, CX - 12.5, ZC + 14), (CX + 12.5, ZC - 14, CX + 14.5, ZC + 14)):
        rim = box(g, x0, TUB1 - 1, z0, x1, TUB1 + 1, z1, "steel", 3)
        P.flat(g, rim & (Y > TUB1), "steel", 5)
        P.flat(g, edges(rim), "steel", 2)
    # oak buffer beams at both ends
    for z0, z1 in ((ZC - 16, ZC - 12), (ZC + 12, ZC + 16)):
        bf = plank_box(g, CX - 8, TUB0 + 2, z0, CX + 8, TUB0 + 6, z1, "wood", 5, across="y", width=2, seed=int(z0))
        for bx in (CX - 6, CX + 5):
            box(g, bx, TUB0 + 3, z0 if z0 < ZC else z1 - 1, bx + 1, TUB0 + 5, (z0 + 1) if z0 < ZC else z1, "steel", 6)
    # hangers from the tub floor down to the axles, and the axles
    for wz in WZ:
        ax = S.disc(g, "x", HUB_Y, wz, 0.9, RAIL_X[0] + 2, RAIL_X[1] - 2, "iron", 3, n=6)
        for rx, s in ((RAIL_X[0], 1), (RAIL_X[1], -1)):
            xa = rx + s * 2.5
            hg = box(g, min(xa, xa + s * 2), HUB_Y - 1.5, wz - 2, max(xa, xa + s * 2), TUB0 + 0.5, wz + 2, "iron", 4)
            P.flat(g, edges(hg), "iron", 2)
            P.flat(g, hg & (np.abs(Y - HUB_Y) < 0.6) & (np.abs(Z - wz) < 0.6), "gold", 5)


def ore(g: Grid) -> None:
    """A heap of grey ore with gold nuggets and a pickaxe across it."""
    X, Y, Z = coords(g)
    start = len(g.solids)
    g.prism("y", [(CX - 12, ZC - 14), (CX + 12, ZC - 14), (CX + 12, ZC + 14), (CX - 12, ZC + 14)], TUB1 - 1, TUB1 + 1.5, C("stone", 4),
            top=[(CX - 9, ZC - 11), (CX + 10, ZC - 12), (CX + 9, ZC + 10), (CX - 10, ZC + 12)])
    g.prism("y", [(CX - 9, ZC - 11), (CX + 10, ZC - 12), (CX + 9, ZC + 10), (CX - 10, ZC + 12)], TUB1 + 1.5, TUB1 + 3.0, C("stone", 5),
            top=[(CX - 4, ZC - 4), (CX + 5, ZC - 6), (CX + 3, ZC + 5), (CX - 5, ZC + 3)])
    heap = np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])
    for k, (fm, fr) in enumerate(S.facets(g, g.solids[start:])):
        P.stone(g, fm, "stone", 5, block=(4, 3), mortar=-2, cracks=0.0, frame=fr, seed=70 + k)
    # lumps: faceted rocks on the heap, grey and gold
    for cx, cz, r, h, ramp, shade in ((CX - 6, ZC - 7, 2.6, 2.4, "stone", 5), (CX + 6, ZC - 3, 3.2, 3.0, "gold", 5),
                                      (CX - 2, ZC + 6, 3.4, 3.0, "gold", 6), (CX + 7, ZC + 8, 2.2, 2.0, "stone", 6),
                                      (CX - 8, ZC + 4, 2.8, 2.6, "gold", 5), (CX + 2, ZC - 9, 2.2, 2.2, "stone", 4)):
        y0 = TUB1 + 0.5
        g.prism("y", S.flat_ngon(cx, cz, r, 5, facing=cx), y0, y0 + h, C(ramp, shade), top=S.flat_ngon(cx + 0.4, cz - 0.3, r * 0.45, 5, facing=cx + 0.5))
        lump = S.last(g)
        P.flat(g, lump & (Y > y0 + h - 1.2), ramp, min(7, shade + 1))
        if ramp == "gold":
            P.flat(g, lump & (Y < y0 + 1), "gold", 3)
    # the pickaxe: an ash handle across the heap and an iron head
    handle = S.bar(g, "y", (CX - 11.0, ZC + 9.0), (CX + 8.0, ZC - 6.0), 1.4, TUB1 + 2.6, TUB1 + 3.8, "wood", 6)
    P.flat(g, handle & (X < CX - 8), "darkwood", 3)
    head = S.bar(g, "y", (CX + 4.5, ZC - 10.5), (CX + 11.5, ZC - 1.5), 1.6, TUB1 + 2.4, TUB1 + 4.0, "iron", 5)
    P.flat(g, head & ((X > CX + 10.0) | (X < CX + 6.0)), "steel", 6)


def torch(g: Grid) -> tuple:
    """A torch in an iron bracket on the back wall, leaning back."""
    X, Y, Z = coords(g)
    tx, z0 = CX + 7.0, ZC + 14.5
    box(g, tx - 1.5, TUB0 + 5, z0 + 0.5, tx + 1.5, TUB0 + 7, z0 + 2.5, "iron", 3)  # the bracket
    shaft = S.bar(g, "x", (TUB0 + 3.0, z0 + 1.6), (TUB1 - 0.5, z0 + 4.5), 1.6, tx - 0.8, tx + 0.8, "wood", 5)
    P.flat(g, shaft & (Y > TUB0 + 9) & (Y < TUB0 + 10.5), "iron", 4)
    cup = S.disc(g, "y", tx, z0 + 4.8, 1.5, TUB1 - 1.0, TUB1 + 0.8, "iron", 4, n=6)
    flame_tongue(g, tx, TUB1 + 0.8, z0 + 4.8, 1.6, 3.2, lean=0.4, seed=81)
    return (tx, TUB1 + 2.0, z0 + 4.8)


def rail_wheel(rx: float, inner: int, wz: float) -> tuple[Grid, tuple]:
    """A small iron rail wheel: a tread on the rail head, a flange that runs
    inside the rail, four painted spokes and a gold hub boss outside."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    tread = S.disc(g, "x", HUB_Y, wz, WR, rx - 1, rx + 1, "steel", 4, n=NSIDE)
    fx0 = rx + 1 if inner > 0 else rx - 2
    flange = S.disc(g, "x", HUB_Y, wz, WR + 1.2, fx0, fx0 + 1, "iron", 3, n=NSIDE)
    rr = S.radial(g, "x", HUB_Y, wz)
    face = (tread | flange)
    P.flat(g, tread & (rr > WR - 1.0), "steel", 6)  # the bright running band
    ang = np.arctan2(Z - wz, Y - HUB_Y)
    spoke = face & (rr < WR - 1.0) & (np.abs(((ang / (np.pi / 2)) + 0.5) % 1 - 0.5) < 0.18)
    P.flat(g, face & (rr < WR - 1.0), "iron", 3)
    P.flat(g, spoke, "iron", 5)
    bx0 = rx - 1.8 if inner > 0 else rx + 1
    boss = S.disc(g, "x", HUB_Y, wz, 1.4, bx0, bx0 + 0.8, "gold", 5, n=6)
    return g, ((rx - 1 + rx + 1) / 2, float(HUB_Y), wz)


def build() -> Asset:
    rails = track()
    cart = Grid(*SZ)
    tub(cart)
    ore(cart)
    flame = torch(cart)
    wheels = {}
    for side, rx, inner in (("l", RAIL_X[0], 1), ("r", RAIL_X[1], -1)):
        for end, wz in (("f", WZ[0]), ("b", WZ[1])):
            wheels[f"wheel-{side}{end}"] = rail_wheel(rx, inner, wz)
    occ = (rails.a > 0) | (cart.a > 0)
    for wg, _ in wheels.values():
        occ |= wg.a > 0
    xs, ys, zs = np.nonzero(occ)
    pivot = ((xs.min() + xs.max() + 1) / 2, float(ys.min()), (zs.min() + zs.max() + 1) / 2)
    if pivot[1] != 0.0:
        raise ValueError(f"mine-cart: lowest voxel is at y={pivot[1]}, the sleepers must lie on y = 0")

    def rel(p, base=pivot):
        return (p[0] - base[0], p[1] - base[1], p[2] - base[2])

    root = Part("mine-cart", rails, pivot=pivot)
    hinge = (CX, float(RT), ZC)  # the cart pivot: on the rail heads, under its middle
    body = root.add(Part("cart", cart, pivot=hinge, at=rel(hinge)))
    move = {}

    def shift(t):
        return TRAVEL * math.sin(2 * math.pi * t / SECONDS)

    def turn(t):  # a wheel rolls: its turn is the distance over its radius
        return math.degrees(shift(t) / WR)

    for name, (wg, hub) in wheels.items():
        body.add(Part(name, wg, pivot=hub, at=rel(hub, hinge)))
        move[name] = {"rot": spin_keys(SECONDS, turn)}
    axles = [Axle(HUB_Y - RT, wz - ZC, WR, NSIDE) for wz in WZ]
    check_rest(axles)
    loc, rot = body_keys(axles, lambda t: [turn(t), turn(t)], SECONDS, shift=shift)
    move["cart"] = {"loc": loc, "rot": rot}
    return Asset(id="fantasy-vehicles-mine-cart", pack="fantasy", category="vehicles", name="Mine Cart", root=root,
                 clips=[Clip("move", move)],
                 sockets=[Socket("socket-function", at=rel(flame), parent="cart")],
                 pfx=[{"effectId": "rvx-fantasy-torch-flame", "socket": "socket-function", "trigger": "idle", "size": 10}])
