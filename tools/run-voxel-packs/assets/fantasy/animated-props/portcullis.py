"""Portcullis gate in the Pirate Nation style.

A slim stone arch with its portcullis (rule K3), made to stand beside the
PN pirate archway: two battered sandstone piers with capitals carry a
round arch of light voussoirs (a front and a back ring, true curves) with
a gold keystone. Between the two
rings runs a heavy oak grille with an arched top rail, iron plates at the
crossings and steel spikes along the bottom. From the pier tops two dark
timber guide posts rise to a planked winch house (the grille slides up
into it) with a royal blue shield and a gold crown under a small red hip
roof; a gold chain wheel turns on each post. On `open` the wheels turn and
the grille slides up between the posts into the house until its spikes
are above the
arch crown (44): the arch is clear for a 36-tall person. `close` drops it
with a bounce; `idle` rattles it. About 50 wide and 100 tall. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S_
from _life import asset, coords, facet_paint, front, keys, plan, rig
from _props import glyph
from pnkit import box, edges
from pnshapes import seams
from voxgrid import C, Clip, Grid

S = (50, 101, 22)
CX = 25.0
PX = ((3, 13), (37, 47))  # pier x (inner faces are the jambs)
PZ = (2, 20)  # pier z
SPRING = 32.0  # the arch springs from the pier capitals
R_IN, R_OUT = 12.0, 17.5  # arch intrados and extrados radii
CROWN = SPRING + R_IN  # 44
FRONT_RING, BACK_RING = (3, 9), (13, 19)  # the two arch rings (z)
SLOT = (10, 12)  # the grille runs between the rings
POST_Z = (7, 15)
HOUSE_Y = (68, 92)  # the winch house the raised grille slides into
RISE = CROWN + 2  # the grille rises this far: its spikes clear the crown
WY = 80.0  # chain wheel centre y


def annulus(r0: float, r1: float, n: int = 12):
    """The upper half ring (x, y) from radius r0 to r1 about (CX, SPRING)."""
    outer = [(CX + r1 * math.cos(math.pi * k / n), SPRING + r1 * math.sin(math.pi * k / n)) for k in range(n + 1)]
    inner = [(CX + r0 * math.cos(math.pi * k / n), SPRING + r0 * math.sin(math.pi * k / n)) for k in range(n, -1, -1)]
    return outer + inner


def arch_ring(g: Grid, z0: float, z1: float, n: int = 9) -> np.ndarray:
    """A round arch of n voussoirs (cream, a darker joint) with a gold keystone."""
    m = np.zeros(g.shape, dtype=bool)
    start = len(g.solids)
    for k in range(n):
        a0, a1 = math.pi * k / n, math.pi * (k + 1) / n
        pts = [(CX + R_OUT * math.cos(a0), SPRING + R_OUT * math.sin(a0)), (CX + R_OUT * math.cos(a1), SPRING + R_OUT * math.sin(a1)),
               (CX + R_IN * math.cos(a1), SPRING + R_IN * math.sin(a1)), (CX + R_IN * math.cos(a0), SPRING + R_IN * math.sin(a0))]
        key = k == n // 2
        ramp, base = ("gold", 5) if key else ("sand", 6)
        mk = front(g, pts, z0, z1, ramp, base)
        facet_paint(g, [g.solids[-1]], lambda gg, mm, fr, r=ramp, b=base: P.flat(gg, mm, r, b + 1 if fr == "top" else b))
        m |= mk
    P.flat(g, m & seams(g, g.solids[start:], 0.55) & ~(g.a == C("gold", 5)), "sand", 4)
    return m


def gate() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    for k, (x0, x1) in enumerate(PX):
        # a battered plinth, the pier shaft and a projecting capital
        start = len(g.solids)
        plan(g, [(x0 - 1, PZ[0] - 1), (x1 + 1, PZ[0] - 1), (x1 + 1, PZ[1] + 1), (x0 - 1, PZ[1] + 1)], 0, 6, "stone", 5,
             top=[(x0, PZ[0]), (x1, PZ[0]), (x1, PZ[1]), (x0, PZ[1])])
        facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 5, block=(5, 3), frame=fr, seed=4 + k))
        t = box(g, x0, 6, PZ[0], x1, SPRING - 2, PZ[1], "sand", 5)
        P.stone(g, t, "sand", 5, block=(6, 3), seed=2 + x0)
        P.flat(g, edges(t), "sand", 4)
        start = len(g.solids)
        plan(g, [(x0, PZ[0]), (x1, PZ[0]), (x1, PZ[1]), (x0, PZ[1])], SPRING - 2, SPRING + 1, "sand", 6,
             top=[(x0 - 1.5, PZ[0] - 1.5), (x1 + 1.5, PZ[0] - 1.5), (x1 + 1.5, PZ[1] + 1.5), (x0 - 1.5, PZ[1] + 1.5)])
        facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.flat(gg, mm, "sand", 7 if fr == "top" else 6))
        # the jamb groove the grille runs in (dark, on the inner face)
        jx = x1 if k == 0 else x0
        P.flat(g, t & (np.abs(X - jx) < 1.0) & (Z > SLOT[0] - 0.2) & (Z < SLOT[1] + 0.2), "stone", 2)
        # a timber guide post from the capital up to the winch beam
        px0 = x1 - 7 if k == 0 else x0
        post = box(g, px0, SPRING + 1, POST_Z[0], px0 + 7, HOUSE_Y[0], POST_Z[1], "darkwood", 4)
        P.planks(g, post, "darkwood", 4, width=3, across="x", nails=False, seed=7 + k)
        P.flat(g, edges(post), "darkwood", 3)
        gx = px0 + 7 if k == 0 else px0
        P.flat(g, post & (np.abs(X - gx) < 1.0) & (Z > SLOT[0] - 0.2) & (Z < SLOT[1] + 0.2), "darkwood", 1)
        # iron bands round the post
        for by in (50, 62):
            P.flat(g, post & (Y > by) & (Y < by + 2), "steel", 4)
        # the chain drops from the wheel down the post front
        chx = px0 + 3.5
        ch = box(g, chx - 0.5, SPRING + 2, POST_Z[0] - 1, chx + 0.5, WY, POST_Z[0], "steel", 4)
        P.flat(g, ch & (np.floor(Y).astype(int) % 2 == 0), "steel", 6)
    # the two arch rings with the grille slot between them
    arch_ring(g, *FRONT_RING)
    arch_ring(g, *BACK_RING)
    # the winch house on the posts: warm planks in a dark frame, jettied
    # sill, a royal blue shield with a gold crown, a little red hip roof
    sill = box(g, 3, HOUSE_Y[0], 4, S[0] - 3, HOUSE_Y[0] + 3, 18, "darkwood", 4)
    P.planks(g, sill, "darkwood", 4, width=3, across="y", seed=10)
    P.flat(g, edges(sill), "darkwood", 2)
    house = box(g, 5, HOUSE_Y[0] + 3, 6, S[0] - 5, HOUSE_Y[1], 16, "wood", 5)
    P.planks(g, house, "wood", 5, width=3, across="x", seed=11)
    P.flat(g, edges(house), "darkwood", 3)
    P.flat(g, house & ((np.abs(X - 5.5) < 1) | (np.abs(X - (S[0] - 5.5)) < 1) | (Y > HOUSE_Y[1] - 2)), "darkwood", 3)
    sy0 = HOUSE_Y[0] + 6
    sh = front(g, [(CX, sy0), (CX + 6, sy0 + 3.5), (CX + 6, sy0 + 13), (CX - 6, sy0 + 13), (CX - 6, sy0 + 3.5)], 5, 6, "blue", 4)
    P.flat(g, sh & ((np.abs(np.abs(X - CX) - 5.5) < 0.6) | (Y > sy0 + 12)), "gold", 5)
    glyph(g, "-z", 5, int(CX - 4.5), int(sy0 + 4), "crown", "gold", 6)
    S_.hip_roof(g, 2, 3, S[0] - 2, 19, HOUSE_Y[1], 7, "red", 4, trim=("darkwood", 3), seed=12)
    return g


def grille() -> Grid:
    g = Grid(*S)
    X, Y, _Z = coords(g)
    z0, z1 = SLOT
    xs = (19.0, 25.0, 31.0)
    yb = 3
    top = lambda x: SPRING + math.sqrt(max(0.0, (R_IN + 0.5) ** 2 - (x - CX) ** 2))  # noqa: E731
    bars = np.zeros(S, dtype=bool)
    for xc in xs:
        bars |= box(g, xc - 1.5, yb, z0, xc + 1.5, top(xc) - 1, z1, "wood", 4)
    for xe in (PX[0][1] - 1, PX[1][0] - 1):  # edge stiles run in the jamb grooves
        bars |= box(g, xe, yb, z0, xe + 2, SPRING + 1, z1, "wood", 3)
    rl = np.zeros(S, dtype=bool)
    rails = (5, 12, 19, 26)
    for yc in rails:
        rl |= box(g, PX[0][1] - 1, yc, z0 - 1, PX[1][0] + 1, yc + 3, z1 + 1, "wood", 5)
    P.planks(g, bars, "wood", 4, width=3, across="x", nails=False, seed=6)
    P.planks(g, rl, "wood", 5, width=3, across="y", nails=False, seed=7)
    P.flat(g, rl & np.isin(np.floor(Y), [r + 2 for r in rails]), "wood", 6)  # lit top edges
    # the arched top rail (a true curve) that fills the arch
    start = len(g.solids)
    front(g, annulus(R_IN - 2.5, R_IN + 0.5, 10), z0 - 1, z1 + 1, "wood", 5)
    arc = g.solids[-1].mask(S)
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.flat(gg, mm, "wood", 6 if fr == "top" else 5))
    P.flat(g, arc & seams(g, g.solids[start:], 0.5), "wood", 3)
    for xc in xs:
        for yc in rails:
            plate = (np.abs(X - xc) < 1.6) & (Y > yc - 0.5) & (Y < yc + 3.5) & rl
            P.flat(g, plate, "steel", 4)
            P.flat(g, plate & (np.abs(X - xc) < 0.6) & (np.abs(Y - yc - 1.5) < 0.6), "steel", 6)
    sp = np.zeros(S, dtype=bool)
    for xc in xs + (16.0, 34.0):
        g.prism("z", [(xc - 1.5, yb), (xc + 1.5, yb), (xc, 0.0)], z0, z1, C("steel", 5))
        sp |= g.solids[-1].mask(S)
    for xc in (16.0, 34.0):  # short bars above the two extra spikes
        bars |= box(g, xc - 1, yb, z0, xc + 1, rails[0], z1, "wood", 4)
    P.flat(g, sp, "steel", 5)
    P.flat(g, sp & (Y < 1.2), "steel", 7)
    return g


def wheel(side: int):
    g = Grid(*S)
    X, Y, _Z = coords(g)
    cx = (PX[0][1] - 3.5) if side < 0 else (PX[1][0] + 3.5)
    z1 = POST_Z[0]
    m = S_.gear(g, "z", cx, WY, 4.2, z1 - 3, z1, teeth=8, depth=1.8, ramp="gold", base=5)
    rr = np.hypot(X - cx, Y - WY)
    P.flat(g, m & (rr < 1.6), "darkwood", 3)
    P.flat(g, m & (np.abs(X - cx) < 0.6) & (rr < 4.0), "gold", 3)
    P.flat(g, m & (np.abs(Y - WY) < 0.6) & (rr < 4.0), "gold", 3)
    return g, (cx, WY, z1 - 1.5)


def build():
    gt, gr = gate(), grille()
    (wl, cl), (wr, cr) = wheel(-1), wheel(1)
    root, _to_root = rig([("portcullis", gt, None, None), ("grille", gr, (CX, 0.0, (SLOT[0] + SLOT[1]) / 2), None),
                          ("wheel-l", wl, cl, None), ("wheel-r", wr, cr, None)])
    open_k = {"grille": {"loc": keys((0, 0, 0, 0), (0.3, 0, 3, 0), (1.6, 0, RISE, 0), (1.72, 0, RISE - 1.2, 0), (1.85, 0, RISE, 0))},
              "wheel-l": {"rot": keys((0, 0, 0, 0), (0.4, 0, 0, 120), (0.8, 0, 0, 240), (1.2, 0, 0, 360), (1.6, 0, 0, 480), (1.85, 0, 0, 470))},
              "wheel-r": {"rot": keys((0, 0, 0, 0), (0.4, 0, 0, -120), (0.8, 0, 0, -240), (1.2, 0, 0, -360), (1.6, 0, 0, -480), (1.85, 0, 0, -470))}}
    close_k = {"grille": {"loc": keys((0, 0, RISE, 0), (0.55, 0, 0, 0), (0.63, 0, 2.0, 0), (0.72, 0, 0, 0), (0.78, 0, 0.6, 0), (0.84, 0, 0, 0))},
               "wheel-l": {"rot": keys((0, 0, 0, 0), (0.2, 0, 0, -160), (0.4, 0, 0, -320), (0.55, 0, 0, -420))},
               "wheel-r": {"rot": keys((0, 0, 0, 0), (0.2, 0, 0, 160), (0.4, 0, 0, 320), (0.55, 0, 0, 420))}}
    idle_k = {"grille": {"loc": keys((0, 0, 0, 0), (1.0, 0, 0.6, 0), (2.0, 0, 0, 0))}}
    return asset("animated-props", "portcullis", "Portcullis Gate", root,
                 clips=[Clip("idle", idle_k), Clip("open", open_k, loop=False), Clip("close", close_k, loop=False)])
