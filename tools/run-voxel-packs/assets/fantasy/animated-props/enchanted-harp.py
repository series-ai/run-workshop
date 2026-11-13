"""Enchanted floor harp in the Pirate Nation style.

A carved floor harp, about as tall as a person, on a small planked plinth
with a gold band. The harp stands in the x-y plane, so the front view
shows its triangle. A carved front pillar with gold rings and a gold
crown rises at the left. A slanted sound box with painted planks, a gold
trim and three dark sound holes on its back leans up to the right. A
curved S-shaped neck with gold tuning pins joins the pillar crown to the
top of the sound box and ends in a gold scroll (rule F2: true slopes).
Five strings glow in magic cyan (rule C3), and a cyan gem burns in the
crown. Detail is paint (rule S1). About 30 wide, 39 tall and 14 deep.
Faces -Z.
Clips: idle (the strings shimmer), active (the strings ring hard).
Effects: the bell toll at socket-function on the active clip.
"""
import math

import numpy as np

import paint as P
import pnshapes as S_
from _fanimated import strip
from _life import asset, coords, facet_paint, pfx, plan, rig
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket, sway

S = (34, 42, 20)
CZ = 10.0  # the harp plane
BASE = 3  # the plinth top
PX = 7.0  # the pillar centre x
SB = [(11.0, BASE), (19.5, BASE), (31.0, 28.5), (26.5, 31.5)]  # the sound box (x, y)
NECK = [(6.5, 33.0), (10.0, 35.5), (14.0, 35.6), (18.0, 33.6), (22.0, 31.8), (26.0, 31.6), (29.5, 33.0)]
STRINGS = [11.5 + 3.0 * k for k in range(5)]  # string x (left edges)


def _sb_left_y(x: float) -> float:
    """The y of the sound board (the upper-left face of the sound box) at x."""
    (x0, y0), (x1, y1) = SB[0], SB[3]
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def frame() -> tuple[Grid, np.ndarray, np.ndarray]:
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(v).astype(np.int64) for v in (X, Y, Z))

    # the plinth: a chamfered planked block with a gold band and dark feet
    start = len(g.solids)
    pl = plan(g, [(3, 4), (31, 4), (33, 6), (33, 14), (31, 16), (3, 16), (1, 14), (1, 6)], 0, BASE, "wood", 4,
              top=[(4, 5), (30, 5), (32, 7), (32, 13), (30, 15), (4, 15), (2, 13), (2, 7)])
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 4, width=3, across="y", nails=True, frame=fr, seed=1))
    P.flat(g, pl & (Yi == BASE - 1), "gold", 5)  # the gold band
    P.flat(g, pl & (Yi == BASE - 1) & (((Xi + Zi) % 4) == 0), "gold", 3)
    P.flat(g, pl & (Yi == 0), "darkwood", 2)
    top = pl & (Yi == BASE - 1) & (X > 3) & (X < 31) & (Z > 5) & (Z < 15)
    P.planks(g, top, "wood", 5, width=3, across="y", frame="top", nails=False, seed=2)

    # the front pillar: a fluted octagon column with gold rings, a gold
    # foot and a carved crown that holds the neck
    foot = S_.cone(g, "y", PX, CZ, 3.4, BASE, BASE + 3, "gold", 4, n=8, r_top=2.4)
    P.flat(g, foot, "gold", 4)
    P.flat(g, foot & (Y > BASE + 2), "gold", 6)
    col = S_.disc(g, "y", PX, CZ, 2.2, BASE + 3, 32, "wood", 5, n=8)
    ang = np.arctan2(Z - CZ, X - PX)
    flute = (np.floor((ang + math.pi) / (2 * math.pi) * 8).astype(np.int64) % 2) == 0
    P.flat(g, col, "wood", 5)
    P.flat(g, col & flute, "wood", 3)  # the dark flutes
    P.flat(g, col & (X < PX - 1.2) & ~flute, "wood", 6)  # the lit side
    for ry in (9, 17, 25):
        P.flat(g, col & (Yi >= ry) & (Yi < ry + 2), "gold", 5)
        P.flat(g, col & (Yi == ry + 1), "gold", 6)
    # a cyan rune vine painted up the front of the shaft
    P.flat(g, col & (Z < CZ - 1.4) & (np.abs(X - PX - 0.8 * np.sin(Y * 0.7)) < 0.6) & (Yi > 11) & (Yi < 24) & ((Yi < 17) | (Yi > 18)), "cyan", 6)
    crown = S_.cone(g, "y", PX, CZ, 2.4, 32, 35, "gold", 5, n=8, r_top=3.4)
    P.flat(g, crown, "gold", 5)
    P.flat(g, crown & (Y > 34), "gold", 6)
    P.flat(g, crown & (Y < 33), "gold", 3)
    cap = S_.disc(g, "y", PX, CZ, 3.4, 35, 36, "gold", 4, n=8)
    P.flat(g, cap, "gold", 4)
    gem = S_.cone(g, "y", PX, CZ, 1.9, 36, 39, "cyan", 6, n=6, r_top=0.6)
    P.flat(g, gem, "cyan", 6)
    P.flat(g, gem & (X < PX), "cyan", 7)
    P.flat(g, gem & (Y < 37), "cyan", 4)

    # the slanted sound box: planks along the slope, a dark frame, a gold
    # trim on the sound board and three dark sound holes on the back
    start = len(g.solids)
    g.prism("z", SB, CZ - 4, CZ + 4, C("wood", 5))
    sb = S_.last(g)
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=3, across="x", length=(40, 41), nails=False, frame=fr, seed=3))
    P.flat(g, sb & edges(sb), "darkwood", 3)
    # the sound board: the light upper-left face, framed in gold
    (lx0, ly0), (lx1, ly1) = SB[0], SB[3]
    ll = math.hypot(lx1 - lx0, ly1 - ly0)
    nx, ny = -(ly1 - ly0) / ll, (lx1 - lx0) / ll  # the outward normal (up-left)
    dl = (X - lx0) * nx + (Y - ly0) * ny  # 0 on the board, < 0 inside
    board = sb & (dl > -1.0)
    P.flat(g, board, "wood", 7)
    P.flat(g, board & (np.abs(Z - CZ) > 3.0), "gold", 5)
    P.flat(g, board & (np.abs(Z - CZ) < 0.6), "wood", 6)
    # the back: dark sound holes along the lower-right face
    (rx0, ry0), (rx1, ry1) = SB[1], SB[2]
    rl = math.hypot(rx1 - rx0, ry1 - ry0)
    mx, my = (ry1 - ry0) / rl, -(rx1 - rx0) / rl  # the outward normal (down-right)
    dr = (X - rx0) * mx + (Y - ry0) * my
    tr = ((X - rx0) * (rx1 - rx0) + (Y - ry0) * (ry1 - ry0)) / rl
    back = sb & (dr > -1.0)
    for tc in (6.0, 13.0, 20.0):
        hole = back & (np.hypot((tr - tc) / 1.6, (Z - CZ) / 1.3) < 1.0)
        P.flat(g, hole, "darkwood", 1)
        P.flat(g, back & (np.abs(np.hypot((tr - tc) / 1.6, (Z - CZ) / 1.3) - 1.4) < 0.3), "gold", 4)
    # the front face: a gold inlay line and cyan runes along the slope
    face = sb & (Z < CZ - 3.0)
    P.flat(g, face & (dl > -2.0) & (dl < -1.0), "gold", 4)
    P.flat(g, face & (dr > -2.0) & (dr < -1.0), "gold", 4)
    for t in (0.22, 0.48, 0.74):  # three cyan diamond runes down the middle of the face
        cx_ = ((lx0 + (lx1 - lx0) * t) + (rx0 + (rx1 - rx0) * t)) / 2
        cy_ = ((ly0 + (ly1 - ly0) * t) + (ry0 + (ry1 - ry0) * t)) / 2
        dd = np.abs(X - cx_) + np.abs(Y - cy_)
        P.flat(g, face & (dd < 2.6), "wood", 3)
        P.flat(g, face & (dd < 1.9), "cyan", 5)
        P.flat(g, face & (dd < 0.9), "cyan", 7)
    P.flat(g, sb & (Y < BASE + 1), "darkwood", 3)  # the dark foot

    # the curved neck: an S of true-slope segments, gold edges and pins
    nk = strip(g, "z", NECK, [2.2, 2.4, 2.3, 2.1, 2.0, 2.1, 2.3], CZ - 2, CZ + 2, "wood", 4)
    P.flat(g, nk, "wood", 5)
    P.flat(g, nk & (Z < CZ - 1) & (((np.floor(X).astype(np.int64) // 3) % 2) == 0), "wood", 6)  # soft grain bands
    near_top = np.zeros(S, dtype=bool)
    for (x0, y0), (x1, y1) in zip(NECK, NECK[1:]):
        sel = nk & (X >= min(x0, x1) - 0.5) & (X <= max(x0, x1) + 0.5)
        yc = y0 + (y1 - y0) * np.clip((X - x0) / (x1 - x0), 0, 1)
        near_top |= sel & (Y > yc + 1.2)
        P.flat(g, sel & (Y < yc - 1.3), "gold", 4)  # the gold underside trim
    P.flat(g, near_top, "gold", 5)  # the gold top trim
    for px in STRINGS:  # gold tuning pins on the front of the neck
        P.flat(g, nk & (Z < CZ - 1) & (np.abs(X - px - 0.5) < 0.5) & ~near_top, "gold", 6)
    # the gold scroll at the shoulder of the sound box
    scr = S_.disc(g, "z", 30.0, 34.0, 2.2, CZ - 2.5, CZ + 2.5, "gold", 5, n=8)
    P.flat(g, scr, "gold", 5)
    P.flat(g, scr & (np.hypot(X - 30.0, Y - 34.0) < 1.0), "gold", 3)
    P.flat(g, scr & (Y > 35.5), "gold", 6)
    P.grime(g, pl, height=1, seed=5)
    return g, sb, nk


def strings(sb: np.ndarray, nk: np.ndarray) -> Grid:
    """Five strings run from the sound board to the neck."""
    g = Grid(*S)
    _X, Y, _Z = coords(g)
    z0 = int(CZ) - 1
    for k, px in enumerate(STRINGS):
        xi = int(px)
        col_sb = np.nonzero(sb[xi, :, z0])[0]
        col_nk = np.nonzero(nk[xi, :, z0])[0]
        if len(col_sb) == 0 or len(col_nk) == 0:
            raise ValueError(f"harp string at x {xi} has no sound board or neck above it")
        y0, y1 = int(col_sb.max()), int(col_nk.min()) + 1
        if y1 - y0 < 3:
            raise ValueError(f"harp string at x {xi} is too short ({y0}..{y1})")
        m = box(g, xi, y0, z0, xi + 1, y1, z0 + 2, "cyan", 6)
        P.flat(g, m, "cyan", 6 if k % 2 == 0 else 5)
        P.flat(g, m & (np.floor(Y).astype(np.int64) % 5 == 0), "cyan", 7)
        P.flat(g, m & ((Y < y0 + 1) | (Y > y1 - 1)), "gold", 6)  # the gold eyelets
    return g


def build():
    fr, sb, nk = frame()
    st = strings(sb, nk)
    mid = (STRINGS[0] + STRINGS[-1]) / 2 + 0.5
    hinge = (mid, 20.0, CZ)
    root, to_root = rig([("enchanted-harp", fr, None, None), ("strings", st, hinge, None)])
    # idle: the strings shimmer; active: the strings ring hard and settle
    idle = {"strings": {"rot": sway(2.0, amp=(0.0, 0.0, 0.2))}}
    active = {"strings": {"rot": sway(1.2, amp=(0.4, 0.0, 0.6), cycles=(4, 1, 6))}}
    return asset("animated-props", "enchanted-harp", "Enchanted Harp", root,
                 clips=[Clip("idle", idle), Clip("active", active)],
                 sockets=[Socket("socket-function", at=to_root((mid, 30.0, CZ)), parent="strings")],
                 fx=[pfx("rvx-fantasy-bell-toll", "socket-function", "clip:active", size=14)])
