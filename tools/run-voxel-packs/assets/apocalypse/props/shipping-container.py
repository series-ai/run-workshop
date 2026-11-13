"""Rusted shipping container, in the Pirate Nation style.

One chunky icon (rule K3): a 10-foot teal corrugated container at real
scale (48 wide, 52 high, 64 long: a person walks in upright), on eight fat
corner castings, framed by dark top and bottom rails (rule F3). The
function prop is the cargo end (rules F4, K1): a tall doorway with two
ribbed leaves on locking bars, one leaf ajar on its hinges (rule F5) over a
bay with a pale salvage crate and a red drum. Welded rungs climb the end.
Ribs, a white placard with its stencil, a gold skull tag, rust blooms and
their bleeds are paint (rule S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint as PP
import pnshapes as S
from _props import asset, child, crate, root
import pnshapes as _S  # noqa: F401
from pnkit import box, edges
from voxgrid import Grid

GW, GH, GD = 52, 54, 66
X0, X1 = 2, 50  # the body across x (48 wide)
Z0, Z1 = 8, 60  # the body along z (the cargo doors face -z)
Y0, Y1 = 4, 52  # the body up y (48 tall on 4-high castings)
BAY = 24  # the back wall of the cargo bay
DX0, DX1, DY0, DY1 = 5, 47, 6, 49  # the doorway
LW, LH = (DX1 - DX0) // 2, DY1 - DY0  # one door leaf


def shell() -> Grid:
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)

    # ---- the body: one prism with chamfered roof edges (true slopes)
    prof = [(X0, Y0), (X1, Y0), (X1, Y1 - 2), (X1 - 2, Y1), (X0 + 2, Y1), (X0, Y1 - 2)]
    g.prism("z", prof, BAY, Z1, S.C("teal", 4))
    body = S.last(g)
    # ---- the doorway: jambs, a lintel and a sill leave the cargo bay
    for jx in (X0, DX1):
        g.prism("z", [(jx, Y0), (jx + (DX0 - X0), Y0), (jx + (DX0 - X0), Y1 - 2), (jx, Y1 - 2)], Z0, BAY, S.C("teal", 4))
        body |= S.last(g)
    body |= box(g, X0, DY1, Z0, X1, Y1 - 2, BAY, "teal", 4)
    body |= box(g, X0, Y0, Z0, X1, DY0, BAY, "teal", 4)
    g.prism("z", [(X0, Y1 - 2), (X1, Y1 - 2), (X1 - 2, Y1), (X0 + 2, Y1)], Z0, BAY, S.C("teal", 4))
    body |= S.last(g)
    # vertical ribs on the long sides and the ends, ribs along z on the roof
    PP.corrugate(g, body & ((X < X0 + 1) | (X > X1 - 1)), "teal", 4, period=4, sheet=14, length=60, frame="x", seed=1)
    PP.corrugate(g, body & ((Z > Z1 - 1) | (Z < Z0 + 1)), "teal", 4, period=4, sheet=12, length=60, frame="z", seed=2)
    PP.corrugate(g, body & (Y > Y1 - 1.5), "teal", 5, period=4, sheet=16, length=60, frame="top", seed=3)
    P.flat(g, body & (Y > Y1 - 2.4) & (Y < Y1 - 1), "teal", 3)  # the chamfer shadow

    # ---- the bay: a lit back wall and floor, with salvage inside
    bay = box(g, DX0, DY0, BAY - 1, DX1, DY1, BAY, "steel", 3)
    floor = box(g, DX0, DY0, Z0, DX1, DY0 + 1, BAY, "steel", 4)
    P.flat(g, bay, "steel", 3)
    P.flat(g, bay & (Y > DY1 - 4), "steel", 2)  # the roof of the bay stays dark
    P.flat(g, floor, "steel", 4)
    # Only the inner faces of the jambs go dark, not the outer side walls.
    P.flat(g, body & (X > DX0 - 1) & (X < DX0) & (Z < BAY) & (Y > DY0) & (Y < DY1), "steel", 3)
    P.flat(g, body & (X > DX1) & (X < DX1 + 1) & (Z < BAY) & (Y > DY0) & (Y < DY1), "steel", 2)
    crate(g, DX0 + 2, DY0 + 1, BAY - 13, 14, 14, 12, "bone", 6, frame=("darkwood", 3), seed=5)
    S.drum(g, DX1 - 10, BAY - 8, DY0 + 1, 19, 7, ramp="red", base=4, band=("bone", 6), wear=True, seed=6)

    # ---- eight corner castings and the top and bottom rails (rule F3)
    rails = np.zeros(g.shape, dtype=bool)
    for y0, y1 in ((Y0 - 1, Y0 + 3), (Y1 - 4, Y1 - 1)):
        for x0 in (X0 - 1, X1 - 2):
            rails |= box(g, x0, y0, Z0, x0 + 3, y1, Z1, "steel", 3)
        rails |= box(g, X0, y0, Z1 - 1, X1, y1, Z1, "steel", 3)
        rails |= box(g, X0, y0, Z0, X1, y1, Z0 + 1, "steel", 3)
    P.plates(g, rails, "steel", 3, size=(16, 4), rivets=True, seed=7)
    cast = np.zeros(g.shape, dtype=bool)
    for cx in (X0 - 1, X1 - 4):
        for cz in (Z0, Z1 - 5):
            for cy in (0, Y1 - 5):
                cast |= box(g, cx, cy, cz, cx + 5, cy + 6, cz + 5, "steel", 4)
    P.flat(g, cast, "steel", 4)
    P.flat(g, edges(cast), "steel", 2)
    for cx in (X0 + 1.5, X1 - 1.5):  # the lifting eyes in the top castings
        for cz in (Z0 + 2.5, Z1 - 2.5):
            P.flat(g, cast & (np.hypot(X - cx, Z - cz) < 1.8) & (Y > Y1 - 1.5), "steel", 2)
    for ry in (DY0 + 6, DY0 + 14, DY0 + 22, DY0 + 30):  # welded rungs up the +x end post
        box(g, X1 - 1, ry, Z0 - 1, X1 + 1, ry + 1, Z0 + 4, "steel", 5)

    # ---- paint: the big stencil, a serial band and a gold skull tag
    for face, plane in (("+x", X1 - 1), ("-x", X0)):
        pnglyph.text(g, face, plane, Z0 + 6, 24, "RVX", "bone", 7, scale=3, gap=2)
        pnglyph.text(g, face, plane, Z0 + 6, 13, "10FT", "bone", 5, scale=1, gap=1)
        pnglyph.icon(g, face, plane, Z0 + 44, 13, "skull", "gold", 6)
    # two shallow dents and a rust streak break up the big roof
    for dx, dz, dr in ((16.0, Z0 + 18, 6.0), (36.0, Z0 + 40, 5.0)):
        dent = body & (Y > Y1 - 1.5) & (np.hypot(X - dx, (Z - dz) * 0.7) < dr)
        P.flat(g, dent, "teal", 3)
        P.flat(g, dent & (np.hypot(X - dx, (Z - dz) * 0.7) < dr * 0.5), "teal", 2)
    P.flat(g, body & (Y > Y1 - 1.5) & (np.abs(X - 40) < 1.2) & (Z > Z0 + 20) & (Z < Z0 + 46), "rust", 4)

    # ---- paint: rust blooms with bleeds down the ribs, and a dirty skirt
    metal = body | rails
    for rx, ry, rz, rr in ((X1, 46, Z0 + 6, 5.0), (X0, 12, Z0 + 40, 5.0), (X1, 9, Z0 + 50, 4.0), (X0, 44, Z0 + 12, 4.0)):
        d = np.hypot(Y - ry, Z - rz)
        near = metal & (np.abs(X - rx) < 1.6)
        P.flat(g, near & (d < rr), "rust", 5)
        P.flat(g, near & (d < rr * 0.5), "rust", 4)
        bleed = near & (np.abs(Z - rz) < 2.2) & (Y < ry) & (Y > ry - 12)
        P.flat(g, bleed & (np.floor(Z) % 3 == 0), "rust", 4)
    P.flat(g, (body | rails | cast) & (Y < Y0 + 2), "steel", 2)
    return g


def leaf() -> Grid:
    """One cargo door leaf, hinged on its -x edge: a ribbed panel with two
    locking bars, cam handles and three hinge knuckles."""
    g = Grid(LW + 2, LH + 2, 6)
    X, Y, Z = S.coords(g)
    panel = box(g, 1, 1, 3, LW, LH, 5, "teal", 4)
    PP.corrugate(g, panel, "teal", 4, period=4, sheet=10, length=60, frame="z", seed=11)
    P.flat(g, edges(panel), "teal", 2)
    PP.blotch(g, panel, "rust", 5, cell=4, chance=0.04, seed=12)
    for bx in (5.5, LW - 4.5):  # locking bars with cam handles and keepers
        bar = S.disc(g, "y", bx, 2.0, 1.2, 2, LH - 1, "steel", 5, n=6)
        P.flat(g, bar & ((Y < 5) | (Y > LH - 4)), "steel", 3)
        box(g, bx - 1.5, 18, 0, bx + 1.5, 21, 2, "steel", 6)
        box(g, bx - 0.5, 19, 0, bx + 4.5, 21, 1, "steel", 6)
    for hy in (3, LH // 2 - 1, LH - 5):
        h = box(g, 0, hy, 3, 1, hy + 4, 6, "steel", 5)
        P.flat(g, h & (Y > hy + 3), "steel", 3)
    return g


def build():
    g = shell()
    left = leaf()
    r = root("shipping-container", g)
    child(r, "door-left", left, pivot=(1.0, 0.0, 5.0), at_grid=(float(DX0), float(DY0), float(Z0)))
    child(r, "door-right", left.flip("x"), pivot=(float(LW + 1), 0.0, 5.0), at_grid=(float(DX1), float(DY0), float(Z0)), rot=(0.0, -20.0, 0.0))
    return asset("shipping-container", "Rusted Shipping Container", r)
