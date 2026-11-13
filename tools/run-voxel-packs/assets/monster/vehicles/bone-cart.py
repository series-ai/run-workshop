"""Bone cart, in the Pirate Nation haunted style.

A two-wheeled plague cart: a flared plank bed (true slopes) on two big
bone-white wheels, a giant ribcage for side rails (curved ribs built from
sloped segments, rules F2 and F4), a load of bones, skulls and sacks, a
driver's bench and long sloped pull handles resting on a prop leg. The
function prop is a skull lantern with glowing toxic eyes, hung from a
hooked pole over the handles (F6). `move`: the wheels roll and the cart
rocks. Faces -Z (the handles).
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import coords, flame_cone, parts
from pnkit import box
from voxgrid import C, Asset, Clip, Grid, Socket, turn

G = (64, 72, 88)
CX = 32.0
AZ, R = 54.0, 14.0  # axle z, wheel radius
BZ0, BZ1 = 30, 76  # bed
BY0, BY1 = 16, 30
WHEEL_X = {"l": (CX - 22, CX - 17), "r": (CX + 17, CX + 22)}
POLE = (CX + 14.0, 33.0)  # lantern pole foot x, z
HOOK_Y, LZ = 66, 20
PIVOT = (CX, R, AZ)


def cart() -> Grid:
    g = Grid(*G)
    X, Y, Z = coords(g)
    ax = box(g, CX - 18, R - 2, AZ - 2, CX + 18, R + 2, AZ + 2, "wood", 4)
    # the flared plank bed
    g.prism("z", [(CX - 12, BY0), (CX + 12, BY0), (CX + 15, BY1), (CX - 15, BY1)], BZ0, BZ1, C("wood", 6))
    bed = S.last(g)
    P.planks(g, bed, "wood", 6, width=3, across="y", length=(12, 20), seed=1)
    P.flat(g, bed & (Y > BY1 - 2), "wood", 4)
    P.flat(g, bed & (Y < BY0 + 1.5), "wood", 4)
    P.flat(g, bed & (((Z - BZ0) % 15 < 2) | (Z > BZ1 - 2)) & (Y <= BY1 - 2), "wood", 5)
    P.flat(g, bed & (Y > 21) & (Y < 23.5), "purple", 4)  # a painted band
    # the ribcage: curved ribs up each side meeting a spine over the load
    ribs = np.zeros(g.shape, dtype=bool)
    top = BY1 + 21
    for k, z in enumerate((BZ0 + 7, BZ0 + 17, BZ0 + 27, BZ0 + 37)):
        for s in (-1, 1):
            pts = [(CX + s * 14, BY1 - 1), (CX + s * 19, BY1 + 9), (CX + s * 15, top - 3), (CX + s * 3, top)]
            for i, (a, b) in enumerate(zip(pts, pts[1:])):
                g.prism("z", S.quad(a, b, 2.0 - i * 0.3, 1.7 - i * 0.3), z - 1.5, z + 1.5, C("bone", 6))
                ribs |= S.last(g)
    for k in range(9):
        z = BZ0 + 4 + k * 4.4
        ribs |= box(g, CX - 2.5, top - 2, z, CX + 2.5, top + 2.5, z + 3.4, "bone", 7 if k % 2 else 6)
    P.flat(g, ribs & (Y < BY1 + 2), "bone", 4)
    # a backbone along the rear rib tips and a pelvis plate at the tail
    spine = box(g, CX - 2, BY0 + 4, BZ1, CX + 2, BY1 + 8, BZ1 + 4, "bone", 6)
    P.flat(g, spine & (Y.astype(int) % 3 == 0), "bone", 4)
    # the load: sacks, bones and skulls
    for k, (x0, z0, x1, z1, h) in enumerate(((CX - 11, BZ0 + 22, CX - 1, BZ0 + 34, 10), (CX + 1, BZ0 + 30, CX + 11, BZ0 + 42, 8))):
        sack = box(g, x0, BY1 - 1, z0, x1, BY1 - 1 + h, z1, "sand", 5)
        P.mottle(g, sack, "sand", 5, cell=2, seed=2 + k)
        P.flat(g, sack & (Y > BY1 + h - 3.5) & (Y < BY1 + h - 2.5), "wood", 4)
    for k, (p0, p1) in enumerate((((CX - 10, BZ0 + 6), (CX + 8, BZ0 + 14)), ((CX + 9, BZ0 + 8), (CX - 4, BZ0 + 20)), ((CX - 8, BZ0 + 18), (CX + 10, BZ0 + 24)))):
        g.prism("y", S.quad(p0, p1, 1.4), BY1 - 1, BY1 + 2 + k, C("bone", 6))
        P.flat(g, S.last(g), "bone", 6)
        for q in (p0, p1):
            box(g, q[0] - 1.5, BY1 - 1, q[1] - 1.5, q[0] + 1.5, BY1 + 3 + k, q[1] + 1.5, "bone", 7)
    S.skull(g, CX - 4, BY1 + 2, BZ0 + 12, s=8, eyes=("toxic", 6), seed=5)
    S.skull(g, CX + 6, BY1 + 8, BZ0 + 38, s=7, eyes=("magenta", 6), seed=6)
    # driver's bench with a purple cushion
    bench = box(g, CX - 11, BY1, BZ0 - 1, CX + 11, BY1 + 4, BZ0 + 6, "wood", 5)
    P.planks(g, bench, "wood", 5, width=2, across="y", nails=True, seed=7)
    cush = box(g, CX - 10, BY1 + 4, BZ0, CX + 10, BY1 + 6, BZ0 + 5, "purple", 4)
    P.outline(g, cush, "purple", 3, normal="y")
    # long pull handles (true slopes), a crossbar, a prop leg
    for x in (CX - 12, CX + 9):
        S.bar(g, "x", (BY0 + 4, BZ0 + 4), (9, 3), 3, x, x + 3, "wood", 6)
        box(g, x, 0, 3, x + 3, 9, 6, "wood", 5)
    box(g, CX - 12, 8, 2, CX + 12, 11, 5, "wood", 5)
    # the hooked lantern pole and the skull lantern (the function prop)
    px, pz = POLE
    box(g, px - 1.5, BY0, pz - 1.5, px + 1.5, HOOK_Y + 3, pz + 1.5, "wood", 6)
    S.bar(g, "x", (HOOK_Y + 1.5, pz), (HOOK_Y - 2, LZ - 1), 3, px - 1.5, px + 1.5, "wood", 6)
    box(g, px - 0.5, HOOK_Y - 8, LZ - 2, px + 0.5, HOOK_Y - 2, LZ - 1, "gray", 4)
    sk = S.skull(g, px, HOOK_Y - 20, LZ - 1.5, s=11, eyes=("toxic", 7), socket=("toxic", 3), seed=8)
    flame_cone(g, px, HOOK_Y - 9, LZ - 1.5, 3, 6, "toxic")
    return g


def wheel(side: str) -> Grid:
    """A big bone wheel: pale rim segments with see-through gaps, bone
    spokes and a purple hub."""
    g = Grid(*G)
    x0, x1 = WHEEL_X[side]
    S.wheel(g, "x", AZ, 0, R, x0, x1, n=8, spokes=6, gaps=True, tyre=("bone", 4), rim=("bone", 5), spoke=("bone", 6), hub=("purple", 3))
    return g


def build() -> Asset:
    root = parts(
        {"cart": cart(), "wheel-l": wheel("l"), "wheel-r": wheel("r")},
        [("cart", None, PIVOT), ("wheel-l", "cart", ((WHEEL_X["l"][0] + WHEEL_X["l"][1]) / 2, R, AZ)), ("wheel-r", "cart", ((WHEEL_X["r"][0] + WHEEL_X["r"][1]) / 2, R, AZ))],
    )
    rock_ = [(t, (0.0, 0.0, a)) for t, a in ((0, 0.0), (0.3, 1.2), (0.6, 0.0), (0.9, -1.2), (1.2, 0.0))]
    px, pz = POLE
    glow = (px - PIVOT[0], HOOK_Y - 14 - PIVOT[1], LZ - PIVOT[2])
    return Asset(
        id="monster-vehicles-bone-cart", pack="monster", category="vehicles", name="Bone Cart", root=root,
        clips=[Clip("move", {"wheel-l": {"rot": turn(1.2, "x", -300)}, "wheel-r": {"rot": turn(1.2, "x", -300)}, "cart": {"rot": rock_}})],
        sockets=[Socket("socket-lantern", at=glow, parent="cart")],
        pfx=[{"effectId": "rvx-monster-ghost-lantern", "socket": "socket-lantern", "trigger": "idle", "size": 24}],
    )
