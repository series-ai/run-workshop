"""Witch's broom mount, in the Pirate Nation haunted style.

A caricature broom (rule F4): a kinked ash handle, a compact ochre brush
with violet bindings, a fitted saddle, two potion bottles and a violet cat
with toxic eyes. The function prop is a jack-o'-lantern on the handle tip.
`idle`: the broom bobs; `move`: it leans and sways, and the lantern swings.
Faces -Z (the handle tip).
"""

import numpy as np

import paint as P
import pnshapes as S
from _bld import coords, parts
from pnkit import box
from voxgrid import C, Asset, Clip, Grid, Socket

G = (44, 60, 68)
CX = 22.0
CRADLE = (CX, 27.0, 34.0)  # broom pivot
TIP = (CX, 33.0, 4.0)  # the handle tip
KINK = (CX, 29.0, 22.0)
TAIL = (CX, 29.0, 46.0)  # where the brush starts
HANG = (CX, 30.0, 8.0)  # the lantern cord's top


def broom() -> Grid:
    g = Grid(*G)
    X, Y, Z = coords(g)
    # The gnarled handle has enough weight to balance the brush.
    for a, b, r0, r1 in ((TIP, KINK, 2.0, 2.2), (KINK, TAIL, 2.2, 2.5)):
        g.prism("x", S.quad((a[1], a[2]), (b[1], b[2]), r0, r1), CX - 2.2, CX + 2.2, C("wood", 6))
        P.flat(g, S.last(g), "wood", 6)
    handle = np.logical_or.reduce([s.mask(g.shape) for s in g.solids])
    P.flat(g, handle & (np.abs(X - CX) < 1.2) & ((Z.astype(int) % 9) < 4), "wood", 4)
    P.flat(g, handle & (Z >= 23) & (Z < 25), "magenta", 5)
    P.flat(g, handle & (Z >= 33) & (Z < 35), "bone", 5)
    for kz in (13, 28, 41):
        box(g, CX - 2.5, 29 + (4 if kz < 20 else 0), kz, CX + 2.5, 32 + (4 if kz < 20 else 0), kz + 2, "wood", 5)
    box(g, CX - 3, 31, 3, CX + 3, 36, 7, "wood", 5)
    # Clean ochre strands replace the pale speckle on the compact brush.
    start = len(g.solids)
    S.cone(g, "z", CX, TAIL[1], 4, TAIL[2], 64, "wood", 5, n=8, r_top=9)
    brush = S.last(g)

    def straw(gg, mm, fr):
        P.flat(gg, mm, "wood", 5)
        u, _v = P.uv(gg, fr)
        strand = (u.astype(int) % 7) < 2
        groove = (u.astype(int) % 7) == 2
        P.flat(gg, mm & strand, "wood", 7)
        P.flat(gg, mm & groove, "wood", 4)

    S.paint_facets(g, g.solids[start:], straw)
    end = brush & (Z > 62.5)
    radius = np.hypot(X - CX, Y - TAIL[1])
    P.flat(g, end, "wood", 5)
    P.flat(g, end & (radius > 7), "wood", 4)
    fibers = (np.abs(X - CX) < 1.1) | (np.abs(Y - TAIL[1]) < 1.1)
    fibers |= np.abs(np.abs(X - CX) - np.abs(Y - TAIL[1])) < 1.1
    P.flat(g, end & (radius <= 7) & fibers, "wood", 7)
    P.flat(g, end & (radius <= 7) & ~fibers, "wood", 5)
    P.flat(g, end & (radius <= 1.1), "wood", 4)
    for bz in (50, 53):
        P.flat(g, brush & (Z >= bz) & (Z < bz + 2), "purple", 3)
    # The saddle sits below the rider and binds to the handle.
    seat = box(g, CX - 5, 31, 39, CX + 5, 36, 45, "purple", 5)
    P.flat(g, seat & ((Z < 41) | (Z > 43)), "purple", 3)
    P.flat(g, seat & (Y > 34) & (Z > 41) & (Z < 43), "magenta", 4)
    P.outline(g, seat, "purple", 3, normal="y")
    box(g, CX - 4, 36, 42, CX + 4, 40, 45, "purple", 4)
    P.flat(g, handle & (Z >= 40) & (Z < 42), "magenta", 5)
    # two potion bottles hanging off the handle
    for bx, bz, ramp in ((CX - 4, 16, "magenta"), (CX + 2, 19, "toxic")):
        box(g, bx + 0.5, 29, bz + 0.5, bx + 1.5, 31, bz + 1.5, "wood", 4)
        bot = box(g, bx - 1, 19, bz - 1, bx + 3, 24, bz + 3, ramp, 5)
        P.flat(g, bot & (Y > 22), ramp, 6)
        g.prism("z", [(bx - 1, 24), (bx + 3, 24), (bx + 2, 26), (bx, 26)], bz - 1, bz + 3, C(ramp, 5))
        box(g, bx, 26, bz, bx + 2, 28, bz + 2, "wood", 6)
        box(g, bx - 0.5, 28, bz - 0.5, bx + 2.5, 29, bz + 2.5, "gold", 4)
    # The violet cat rides the handle, clear of the brush binding.
    cz = 45
    cy = TAIL[1] + 8
    body_poly = [
        (CX - 2.5, cy - 1), (CX + 2.5, cy - 1),
        (CX + 3.5, cy + 1), (CX + 3.5, cy + 4),
        (CX + 2.0, cy + 6), (CX - 2.0, cy + 6),
        (CX - 3.5, cy + 4), (CX - 3.5, cy + 1),
    ]
    g.prism("z", body_poly, cz - 4, cz + 5, C("purple", 4))
    body = S.last(g)
    P.flat(g, body & (Y > cy + 3), "purple", 6)
    P.flat(g, body & (Y < cy + 1), "magenta", 4)
    fur_marks = body & (np.abs(Y - cy - 3) < 0.7) & ((Z.astype(int) % 4) == 0)
    P.flat(g, fur_marks, "purple", 7)
    for s in (-1, 1):
        box(g, CX + s * 2.5 - 1, cy - 1, cz - 6, CX + s * 2.5 + 1, cy + 1, cz - 4, "purple", 6)
    head = box(g, CX - 4, cy + 6, cz - 9, CX + 4, cy + 14, cz - 2, "purple", 5)
    P.flat(g, head & (Y > cy + 9), "purple", 6)
    P.flat(g, head & (Y < cy + 6), "purple", 3)
    for s in (-1, 1):
        g.prism("z", [(CX + s * 3.5, cy + 14), (CX + s * 0.5, cy + 14), (CX + s * 3, cy + 18)], cz - 6, cz - 4, C("purple", 4))
    face = head & (Z < cz - 8) & (np.abs(X - CX) < 3.5) & (Y > cy + 6.5) & (Y < cy + 13)
    P.flat(g, face, "purple", 3)
    sockets = face & (np.abs(Y - cy - 10) < 1.6) & (np.abs(np.abs(X - CX) - 2.2) < 1.6)
    P.flat(g, sockets, "purple", 2)
    eyes = sockets & (np.abs(Y - cy - 10) < 0.8) & (np.abs(np.abs(X - CX) - 2.2) < 0.8)
    P.flat(g, eyes, "toxic", 6)
    P.flat(g, eyes & (np.abs(np.abs(X - CX) - 2.2) < 0.45), "toxic", 7)
    mouth = face & (np.abs(Y - cy - 7.5) < 0.8) & (np.abs(X - CX) < 2)
    P.flat(g, mouth, "purple", 1)
    P.flat(g, face & (np.abs(Y - cy - 8.5) < 0.7) & (np.abs(X - CX) < 1), "pink", 5)
    for a, b in (((cy + 2, cz + 5), (cy + 8, cz + 9)), ((cy + 8, cz + 9), (cy + 13, cz + 7))):
        g.prism("x", S.quad(a, b, 1.3, 1.0), CX - 1.5, CX + 1.5, C("purple", 4))
    return g


def lantern() -> Grid:
    """A carved jack-o'-lantern on a cord: a glowing face on the front."""
    g = Grid(*G)
    hx, hy, hz = HANG
    box(g, hx - 0.5, hy - 6, hz - 0.5, hx + 0.5, hy, hz + 0.5, "wood", 4)
    y0 = hy - 16
    S.pumpkin(g, hx, y0, hz, w=10, h=8, seed=5)
    X, Y, Z = coords(g)
    front = (g.a > 0) & (Z < hz - 1.8) & (Y > y0 + 0.5) & (Y < y0 + 7.5)
    panel = front & (np.abs(X - hx) < 3.2) & (Y > y0 + 1) & (Y < y0 + 7)
    frame = panel & ((np.abs(X - hx) > 2.5) | (Y < y0 + 1.8) | (Y > y0 + 6.2))
    P.flat(g, frame, "orange", 2)
    eyes = panel & (np.abs(Y - y0 - 5.5) < 1.5) & (np.abs(np.abs(X - hx) - 2) < 1.5)
    mouth = panel & (np.abs(Y - y0 - 2.5) < 1.2) & (np.abs(X - hx) < 3.1)
    P.flat(g, eyes | mouth, "purple", 2)
    pupils = eyes & (np.abs(np.abs(X - hx) - 2) < 0.8)
    P.flat(g, pupils, "toxic", 6)
    teeth = mouth & (np.floor(X - hx).astype(int) % 2 == 0) & (Y < y0 + 2.7)
    P.flat(g, teeth, "gold", 6)
    return g


def build() -> Asset:
    root = parts(
        {"broom": broom(), "lantern": lantern()},
        [("broom", None, CRADLE), ("lantern", "broom", HANG)],
    )
    bob = [(t, (0.0, y, 0.0)) for t, y in ((0, 0.0), (0.75, 2.0), (1.5, 0.0), (2.25, -1.0), (3.0, 0.0))]
    roll = [(t, (0.0, 0.0, a)) for t, a in ((0, 0.0), (0.75, 3.0), (1.5, 0.0), (2.25, -3.0), (3.0, 0.0))]
    swing_i = [(t, (a, 0.0, 0.0)) for t, a in ((0, 0.0), (0.75, 8.0), (1.5, 0.0), (2.25, -8.0), (3.0, 0.0))]
    lean = [(t, (-12.0 + p, 0.0, r)) for t, p, r in ((0, 0.0, 0.0), (0.4, 2.0, 5.0), (0.8, 0.0, 0.0), (1.2, 2.0, -5.0), (1.6, 0.0, 0.0))]
    lift = [(t, (0.0, y, 0.0)) for t, y in ((0, 4.0), (0.4, 5.0), (0.8, 4.0), (1.2, 5.0), (1.6, 4.0))]
    swing_m = [(t, (a, 0.0, b)) for t, a, b in ((0, 18.0, 0.0), (0.4, 24.0, 8.0), (0.8, 18.0, 0.0), (1.2, 24.0, -8.0), (1.6, 18.0, 0.0))]
    hx, hy, hz = HANG
    sx, sy, sz = CX, TAIL[1], 62.0
    return Asset(
        id="monster-vehicles-witch-broom", pack="monster", category="vehicles", name="Witch's Broom", root=root,
        clips=[
            Clip("idle", {"broom": {"loc": bob, "rot": roll}, "lantern": {"rot": swing_i}}),
            Clip("move", {"broom": {"rot": lean, "loc": lift}, "lantern": {"rot": swing_m}}),
        ],
        sockets=[Socket("socket-brush", at=(sx - CX, sy, sz - CRADLE[2]), parent="broom")],
        pfx=[{"effectId": "rvx-monster-broom-trail", "socket": "socket-brush", "trigger": "clip:move", "size": 30, "aim": [0.0, 0.0, 1.0]}],
    )
