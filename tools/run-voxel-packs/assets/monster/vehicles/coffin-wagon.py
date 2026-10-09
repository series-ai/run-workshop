"""Coffin wagon, in the Pirate Nation haunted style.

An undertaker's flatbed on four octagonal spoked wheels (the rear pair
oversized, rule F4): a plank deck with stake rails, three big six-sided
coffins lashed on with rope (the top one turned askew, F5), a driver's
bench with a purple cushion and a sloped footboard, a spare wheel, a
rolled tarp and a crate of wooden stakes. The function prop is a hooded
lantern glowing pumpkin orange on a tall bent post over the bench (F6).
`move`: the wheels roll and the load jostles. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import coffin, coords, parts
from pnkit import box, crate, edges
from voxgrid import C, Asset, Clip, Grid, Socket, turn

G = (68, 88, 108)
CX = 34.0
FZ, FR = 28.0, 10.0  # front axle z, wheel radius
RZ, RR = 80.0, 13.0  # rear axle z, wheel radius
DZ0, DZ1 = 16, 96  # deck
DY = 24  # deck top
WX = {"l": (CX - 21, CX - 17), "r": (CX + 17, CX + 21)}
POST = (CX - 14.0, 19.0)
ARM_Y, LZ = 74, 10


def wagon() -> Grid:
    g = Grid(*G)
    X, Y, Z = coords(g)
    for az, r in ((FZ, FR), (RZ, RR)):
        box(g, CX - 17, r - 1.5, az - 1.5, CX + 17, r + 1.5, az + 1.5, "wood", 4)
        bol = box(g, CX - 10, r + 1.5, az - 2.5, CX + 10, DY - 4, az + 2.5, "wood", 5)
        P.planks(g, bol, "wood", 5, width=2, across="y", nails=False, seed=1)
    # the tongue: a sloped bar forward with a crossbar
    S.bar(g, "x", (DY - 6, DZ0 + 2), (5, 3), 3, CX - 1.5, CX + 1.5, "wood", 5)
    box(g, CX - 8, 3, 2, CX + 8, 6, 5, "wood", 4)
    # the deck with a dark sill and stake rails
    deck = box(g, CX - 16, DY - 4, DZ0, CX + 16, DY, DZ1, "wood", 7)
    P.planks(g, deck, "wood", 7, width=4, across="y", nails=True, seed=2)
    P.flat(g, deck & (Y < DY - 3), "wood", 4)
    P.flat(g, deck & (Y > DY - 3) & (Y < DY - 1.5), "purple", 4)
    for z in range(DZ0 + 20, DZ1, 12):
        for x in (CX - 16, CX + 14):
            st = box(g, x, DY, z, x + 2, DY + 9, z + 2, "wood", 5)
    for x in (CX - 16, CX + 14):
        rail = box(g, x, DY + 7, DZ0 + 20, x + 2, DY + 9, DZ1, "wood", 6)
    # three coffins lashed on with rope (the top one askew)
    coffin(g, CX - 8, DZ0 + 24, 14, 36, DY, DY + 8, pose="z", lid_h=2, seed=3)
    coffin(g, CX + 8, DZ0 + 26, 14, 36, DY, DY + 8, pose="z", lid=("magenta", 3), lid_h=2, seed=4)
    top = coffin(g, CX, DZ0 + 28, 14, 34, DY + 10, DY + 18, pose="z", wood=("wood", 6), turn=7, lid_h=2, seed=5)
    for zr in (DZ0 + 36, DZ0 + 52):
        rope = (g.a > 0) & (np.abs(Z - zr) < 1.1) & (Y > DY) & (np.abs(X - CX) < 16)
        P.flat(g, rope, "sand", 5)
        P.flat(g, rope & (Y.astype(int) % 3 == 0), "sand", 3)
    # the driver's bench, cushion and a sloped footboard
    seat = box(g, CX - 12, DY, DZ0 + 1, CX + 12, DY + 6, DZ0 + 9, "wood", 5)
    P.planks(g, seat, "wood", 5, width=2, across="y", nails=True, seed=6)
    cush = box(g, CX - 11, DY + 6, DZ0 + 2, CX + 11, DY + 8, DZ0 + 8, "purple", 4)
    P.outline(g, cush, "purple", 3, normal="y")
    box(g, CX - 12, DY + 6, DZ0 + 8, CX + 12, DY + 14, DZ0 + 10, "wood", 5)  # backrest
    g.prism("x", [(DY - 4, DZ0), (DY - 1, DZ0), (DY + 3, DZ0 - 6), (DY, DZ0 - 7)], CX - 12, CX + 12, C("wood", 5))
    P.planks(g, S.last(g), "wood", 5, width=3, across="x", nails=False, seed=7)
    # rear: a rolled tarp, a crate of stakes; a spare wheel on the right
    tarp = S.disc(g, "x", DY + 4, DZ1 - 5, 4, CX - 14, CX + 6, "purple", 4)
    P.flat(g, tarp & (np.abs(X - CX + 9) < 1) | tarp & (np.abs(X - CX - 1) < 1), "sand", 4)
    crate(g, CX + 5, DY, DZ1 - 12, 10, ramp="wood", frame="wood", base=6, seed=8)
    for k, (sx, sz, h) in enumerate(((CX + 7, DZ1 - 10, 8), (CX + 11, DZ1 - 8, 11), (CX + 9, DZ1 - 5, 6))):
        box(g, sx, DY + 10, sz, sx + 2, DY + 10 + h, sz + 2, "wood", 7)
        g.prism("y", [(sx, sz), (sx + 2, sz), (sx + 2, sz + 2), (sx, sz + 2)], DY + 10 + h, DY + 13 + h, C("bone", 6), top=[(sx + 1, sz + 1)] * 4)
    S.wheel(g, "x", DZ0 + 60, DY + 1, 7, CX + 16, CX + 18, n=8, spokes=6, tyre=("gray", 4), rim=("purple", 3), spoke=("wood", 6), hub=("gold", 4))
    # the tall bent post with the hooded lantern (the function prop)
    px, pz = POST
    post = box(g, px - 1.5, DY - 4, pz - 1.5, px + 1.5, ARM_Y + 3, pz + 1.5, "wood", 6)
    arm = box(g, px - 1.5, ARM_Y, LZ - 1.5, px + 1.5, ARM_Y + 3, pz - 1.5, "wood", 6)
    P.planks(g, post | arm, "wood", 6, width=3, across="x", nails=False, seed=9)
    g.prism("x", [(ARM_Y - 8, pz - 1.5), (ARM_Y - 5, pz - 1.5), (ARM_Y, pz - 6), (ARM_Y, pz - 9)], px - 1, px + 1, C("wood", 5))
    info = S.lantern(g, int(px), ARM_Y - 29, int(LZ), s=10, body=12, glass="orange", roof="purple", frame="wood", seed=10)
    box(g, px - 0.5, info["top"], LZ - 0.5, px + 0.5, ARM_Y, LZ + 0.5, "gray", 4)
    # an open cage, not glass: the frame stays and the panes go, so the candle's PFX flame
    # shows (inside closed panes it could not); a stubby wax candle stands on the base plate
    panes = info["panes"]
    _X, Y, _Z = coords(g)
    ys = np.nonzero(panes.any(axis=(0, 2)))[0]
    yb0, yb1 = ys.min(), ys.max() + 1
    frame = edges(panes) | (panes & (Y < yb0 + 1.0)) | (panes & (Y > yb1 - 1.0))
    g.a[panes & ~frame] = 0
    gx, _gy, gz = info["glow"]
    box(g, gx - 1.5, yb0 + 1, gz - 1.5, gx + 1.5, yb0 + 5, gz + 1.5, "bone", 7)
    return g, (gx, yb0 + 6.5, gz)


def wheel(side: str, az: float, r: float) -> Grid:
    g = Grid(*G)
    x0, x1 = WX[side]
    S.wheel(g, "x", az, 0, r, x0, x1, n=8, spokes=8 if r > 11 else 6, gaps=True, tyre=("gray", 4), rim=("purple", 3), spoke=("wood", 6), hub=("gold", 4))
    return g


def build() -> Asset:
    body, glow = wagon()
    grids = {"wagon": body}
    joints = [("wagon", None, (CX, RR, RZ))]
    clips = {}
    for side in ("l", "r"):
        for end, az, r in (("f", FZ, FR), ("b", RZ, RR)):
            name = f"wheel-{side}{end}"
            grids[name] = wheel(side, az, r)
            joints.append((name, "wagon", ((WX[side][0] + WX[side][1]) / 2, r, az)))
            clips[name] = {"rot": turn(1.2, "x", -300)}
    root = parts(grids, joints)
    clips["wagon"] = {
        "rot": [(t, (a, 0.0, b)) for t, a, b in ((0, 0.0, 0.0), (0.3, 0.8, 1.0), (0.6, 0.0, 0.0), (0.9, -0.8, -1.0), (1.2, 0.0, 0.0))],
        "loc": [(t, (0.0, y, 0.0)) for t, y in ((0, 0.0), (0.15, 0.6), (0.3, 0.0), (0.45, 0.6), (0.6, 0.0), (0.75, 0.6), (0.9, 0.0), (1.05, 0.6), (1.2, 0.0))],
    }
    gx, gy, gz = glow
    return Asset(
        id="monster-vehicles-coffin-wagon", pack="monster", category="vehicles", name="Coffin Wagon", root=root,
        clips=[Clip("move", clips)],
        sockets=[Socket("socket-lantern", at=(gx - CX, gy - RR, gz - RZ), parent="wagon")],
        # the candle flame burns in the open lantern cage (the socket is at the wick)
        pfx=[{"effectId": "rvx-monster-candle-flame", "socket": "socket-lantern", "trigger": "idle", "size": 12}],
    )
