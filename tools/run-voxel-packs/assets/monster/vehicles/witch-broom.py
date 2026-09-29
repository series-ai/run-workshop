"""Witch's broom mount, in the Pirate Nation haunted style.

A caricature broom (rule F4): a gnarled, kinked ash handle (true slopes),
a big flared straw brush (a faceted frustum) bound with purple bands, a
purple saddle with stirrups, two potion bottles and a black cat with
glowing eyes riding on the tail. The function prop is a jack-o'-lantern
that hangs from the handle tip and glows (F6). The broom hovers over a
forked landing stand. `idle`: it hovers and bobs; `move`: it leans
forward and sways, the lantern swinging. Faces -Z (the handle tip).
"""

import numpy as np

import paint as P
import pnshapes as S
from _bld import coords, parts
from pnkit import box
from voxgrid import C, Asset, Clip, Grid, Socket

G = (44, 60, 68)
CX = 22.0
CRADLE = (CX, 27.0, 34.0)  # where the stand holds the broom
TIP = (CX, 33.0, 4.0)  # the handle tip
KINK = (CX, 29.0, 22.0)
TAIL = (CX, 28.0, 44.0)  # where the brush starts
HANG = (CX, 30.0, 8.0)  # the lantern cord's top


def stand() -> Grid:
    g = Grid(*G)
    X, Y, Z = coords(g)
    cx, cy, cz = CRADLE
    S.disc(g, "y", cx, cz, 9, 0, 3, "gray", 5)
    P.stone(g, S.last(g), "gray", 5, block=(5, 3), frame="top", seed=1)
    S.disc(g, "y", cx, cz, 6, 3, 5, "gray", 6)
    post = box(g, cx - 2, 5, cz - 2, cx + 2, cy - 5, cz + 2, "wood", 6)
    P.planks(g, post, "wood", 6, width=4, across="x", nails=False, seed=2)
    for s in (-1, 1):
        g.prism("x", S.quad((cy - 6, cz), (cy + 1, cz + s * 5), 1.4, 1.1), cx - 1.5, cx + 1.5, C("wood", 5))
    box(g, cx - 3, cy - 7, cz - 3, cx + 3, cy - 5, cz + 3, "purple", 3)
    return g


def broom() -> Grid:
    g = Grid(*G)
    X, Y, Z = coords(g)
    # the gnarled handle: two sloped segments with knots
    for a, b, r0, r1 in ((TIP, KINK, 1.4, 1.7), (KINK, TAIL, 1.7, 2.0)):
        g.prism("x", S.quad((a[1], a[2]), (b[1], b[2]), r0, r1), CX - 1.6, CX + 1.6, C("wood", 6))
        P.flat(g, S.last(g), "wood", 6)
    for kz in (12, 26, 38):
        box(g, CX - 2, 29 + (4 if kz < 20 else 0), kz, CX + 2, 32 + (4 if kz < 20 else 0), kz + 2, "wood", 5)
    box(g, CX - 2.5, 31, 3, CX + 2.5, 36, 7, "wood", 5)  # the knobbly tip
    # the brush: a flared straw frustum with purple bands
    start = len(g.solids)
    S.cone(g, "z", CX, TAIL[1], 4, TAIL[2], 66, "gold", 5, n=8, r_top=10)
    brush = S.last(g)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.thatch(gg, mm, "gold", 5, band=40, frame=fr, seed=3))
    P.flat(g, brush & (Z > 64), "gold", 4)
    for bz in (46, 50):
        P.flat(g, brush & (Z >= bz) & (Z < bz + 2), "purple", 3)
    # the saddle with stirrups
    seat = box(g, CX - 4, 30, 26, CX + 4, 34, 36, "purple", 4)
    P.mottle(g, seat, "purple", 4, cell=2, seed=4)
    P.outline(g, seat, "purple", 3, normal="y")
    box(g, CX - 3, 34, 33, CX + 3, 37, 36, "purple", 3)  # the cantle
    for s in (-1, 1):
        box(g, CX + s * 4.5 - 0.5, 22, 30, CX + s * 4.5 + 0.5, 31, 31, "gray", 4)
        box(g, CX + s * 4.5 - 1.5, 20, 29, CX + s * 4.5 + 1.5, 22, 32, "gold", 4)
    # two potion bottles hanging off the handle
    for k, (bx, bz, ramp) in enumerate(((CX - 4, 16, "magenta"), (CX + 2, 19, "toxic"))):
        box(g, bx + 0.5, 25, bz + 0.5, bx + 1.5, 30, bz + 1.5, "wood", 4)
        bot = box(g, bx - 1, 19, bz - 1, bx + 3, 25, bz + 3, ramp, 5)
        P.flat(g, bot & (Y > 23), ramp, 6)
        box(g, bx, 25, bz, bx + 2, 26, bz + 2, "wood", 6)
    # the black cat riding the tail (big head, glowing eyes, curled tail)
    cz = 54
    cy = TAIL[1] + 8
    body = box(g, CX - 3, cy - 1, cz - 4, CX + 3, cy + 5, cz + 5, "purple", 2)
    head = box(g, CX - 3.5, cy + 3, cz - 8, CX + 3.5, cy + 10, cz - 2, "purple", 2)
    for s in (-1, 1):
        g.prism("z", [(CX + s * 3.5, cy + 9), (CX + s * 0.5, cy + 9), (CX + s * 3, cy + 13)], cz - 6, cz - 4, C("purple", 2))
    P.flat(g, head & (Z < cz - 7) & (np.abs(Y - cy - 7) < 1) & (np.abs(np.abs(X - CX) - 1.8) < 0.8), "toxic", 7)
    P.flat(g, head & (Z < cz - 7) & (np.abs(Y - cy - 5) < 0.6) & (np.abs(X - CX) < 0.6), "pink", 4)
    for a, b in (((cy + 2, cz + 5), (cy + 8, cz + 9)), ((cy + 8, cz + 9), (cy + 13, cz + 7))):
        g.prism("x", S.quad(a, b, 1.1, 0.9), CX - 1, CX + 1, C("purple", 2))
    return g


def lantern() -> Grid:
    """A carved jack-o'-lantern on a cord: a glowing face on the front."""
    g = Grid(*G)
    hx, hy, hz = HANG
    box(g, hx - 0.5, hy - 6, hz - 0.5, hx + 0.5, hy, hz + 0.5, "wood", 4)
    y0 = hy - 16
    S.pumpkin(g, hx, y0, hz, w=10, h=8, seed=5)
    X, Y, Z = coords(g)
    front = (g.a > 0) & (Z < hz - 3.5) & (Y > y0 + 0.5) & (Y < y0 + 7.5)
    eyes = front & (np.abs(Y - y0 - 5.5) < 1.1) & (np.abs(np.abs(X - hx) - 2) < 1.1)
    mouth = front & (np.abs(Y - y0 - 2.5) < 1.1) & (np.abs(X - hx) < 3.1)
    P.flat(g, eyes | mouth, "gold", 7)
    P.flat(g, mouth & (X.astype(int) % 2 == 0) & (Y > y0 + 2.5), "orange", 3)
    return g


def build() -> Asset:
    root = parts(
        {"stand": stand(), "broom": broom(), "lantern": lantern()},
        [("stand", None, (CX, 0.0, CRADLE[2])), ("broom", "stand", CRADLE), ("lantern", "broom", HANG)],
    )
    bob = [(t, (0.0, y, 0.0)) for t, y in ((0, 0.0), (0.75, 2.0), (1.5, 0.0), (2.25, -1.0), (3.0, 0.0))]
    roll = [(t, (0.0, 0.0, a)) for t, a in ((0, 0.0), (0.75, 3.0), (1.5, 0.0), (2.25, -3.0), (3.0, 0.0))]
    swing_i = [(t, (a, 0.0, 0.0)) for t, a in ((0, 0.0), (0.75, 8.0), (1.5, 0.0), (2.25, -8.0), (3.0, 0.0))]
    lean = [(t, (-12.0 + p, 0.0, r)) for t, p, r in ((0, 0.0, 0.0), (0.4, 2.0, 5.0), (0.8, 0.0, 0.0), (1.2, 2.0, -5.0), (1.6, 0.0, 0.0))]
    lift = [(t, (0.0, y, 0.0)) for t, y in ((0, 4.0), (0.4, 5.0), (0.8, 4.0), (1.2, 5.0), (1.6, 4.0))]
    swing_m = [(t, (a, 0.0, b)) for t, a, b in ((0, 18.0, 0.0), (0.4, 24.0, 8.0), (0.8, 18.0, 0.0), (1.2, 24.0, -8.0), (1.6, 18.0, 0.0))]
    hx, hy, hz = HANG
    sx, sy, sz = CX, TAIL[1], 64.0
    return Asset(
        id="monster-vehicles-witch-broom", pack="monster", category="vehicles", name="Witch's Broom", root=root,
        clips=[
            Clip("idle", {"broom": {"loc": bob, "rot": roll}, "lantern": {"rot": swing_i}}),
            Clip("move", {"broom": {"rot": lean, "loc": lift}, "lantern": {"rot": swing_m}}),
        ],
        sockets=[Socket("socket-brush", at=(sx - CX, sy, sz - CRADLE[2]), parent="broom")],
        pfx=[{"effectId": "rvx-monster-broom-trail", "socket": "socket-brush", "trigger": "clip:move", "size": 30, "aim": [0.0, 0.0, 1.0]}],
    )
