"""Wishing wall fountain in the Pirate Nation style.

A wall fountain, not a free-standing basin (the town stone fountain is
the round one). A coursed grey-blue stone wall with an arched top stands
between two pilasters with gold capitals and glowing cyan runes. A
carved lion mask with a gold mane and glowing cyan eyes juts from the
middle of the wall. Out of its open mouth a thick ribbon of water arcs
down into a half-octagon stone basin at the foot of the wall: the fall
is painted as running water, with light streaks, a bright lip and white
foam where it lands (rule S1). A cyan wishing orb is set in the arch
above the mask, and gold coins glint in the basin (rule C3). Moss grows at
the foot. About 36 wide, 37 tall and 23 deep. Faces -Z.
Clips: idle (the water stream pulses gently), active (the stream gushes
and swells).
Effects: the waterfall mist at socket-function, where the stream lands.
"""
import math

import numpy as np

import paint as P
import pnshapes as S_
from _fanimated import strip
from _life import asset, coords, facet_paint, front, grass, pfx, plan, rig
from _props import glyph
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket, sway

S = (36, 38, 26)
CX = 18.0
WZ = 18.0  # the front face of the wall
R_OUT, R_IN = 15.0, 12.5  # the basin flat radii (a half octagon round (CX, WZ))
RIM = 9  # the basin wall top
WATER = 7.0  # the basin water surface
MOUTH = (18.5, 11.0)  # the lion's mouth (y, z)
LAND = (WATER, 5.5)  # where the stream lands (y, z)


def half_oct(r: float) -> list[tuple[float, float]]:
    """The front half of an octagon (flat radius r) round (CX, WZ), as
    (x, z) points from +x round the front (-z) to -x."""
    rc = r / math.cos(math.pi / 8)
    pts = [(CX + r, WZ)]
    for deg in (-22.5, -67.5, -112.5, -157.5):
        a = math.radians(deg)
        pts.append((CX + rc * math.cos(a), WZ + rc * math.sin(a)))
    pts.append((CX - r, WZ))
    return pts


def wall() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(v).astype(np.int64) for v in (X, Y, Z))

    # the arched back wall of coursed stone, with dark seams and a gold trim
    start = len(g.solids)
    arch = [(2, 0), (34, 0), (34, 27), (30, 32), (24, 35.5), (18, 36.5), (12, 35.5), (6, 32), (2, 27)]
    wl = front(g, arch, WZ, WZ + 5, "stone", 4)
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 4, block=(6, 3), cracks=0.05, frame=fr, seed=1))
    P.flat(g, wl & S_.seams(g, g.solids[start:], 0.7), "steel", 2)
    # the arch band: a lighter course and a gold line just under the crown
    hx = np.abs(X - CX)
    crown = 36.5 - np.where(hx < 6, hx / 6 * 1.0, np.where(hx < 12, 1.0 + (hx - 6) / 6 * 3.5, 4.5 + (hx - 12) / 4 * 4.5))
    P.flat(g, wl & (Z < WZ + 1) & (Y > crown - 3.0) & (Y < crown - 1.0), "stone", 6)
    P.flat(g, wl & (Z < WZ + 1) & (Y > crown - 4.0) & (Y < crown - 3.0), "gold", 4)
    P.flat(g, wl & (Y > crown - 1.0), "steel", 2)  # the dark top edge (rule S4)
    P.flat(g, wl & (Y < 1), "steel", 2)

    # two pilasters with a base, gold capitals and cyan runes
    for x0 in (0, 30):
        pl = box(g, x0 + 1, 0, WZ - 2, x0 + 5, 28, WZ + 6, "stone", 5)
        P.stone(g, pl, "stone", 5, block=(4, 4), seed=2 + x0)
        P.flat(g, edges(pl), "steel", 2)
        bs = box(g, x0, 0, WZ - 3, x0 + 6, 3, WZ + 6, "stone", 3)
        P.stone(g, bs, "stone", 3, block=(3, 3), seed=3 + x0)
        P.flat(g, bs & (Yi == 2), "stone", 5)
        cp = box(g, x0, 28, WZ - 3, x0 + 6, 31, WZ + 6, "gold", 4)
        P.flat(g, cp, "gold", 4)
        P.flat(g, cp & (Yi == 30), "gold", 6)
        P.flat(g, cp & (Yi == 28), "gold", 2)
        P.flat(g, cp & ((Xi + Zi) % 3 == 0) & (Yi == 29), "gold", 5)
        for v0, name in ((7, "rune-a" if x0 == 0 else "rune-c"), (17, "rune-e" if x0 == 0 else "rune-b")):
            glyph(g, "-z", WZ - 2, x0 + 1, v0, name, "cyan", 6)

    # the carved lion mask: a gold mane plate, a stone face and a muzzle
    mane = S_.disc(g, "z", CX, 21.0, 6.2, WZ - 2, WZ, "gold", 4, n=10)
    ang = np.arctan2(Y - 21.0, X - CX)
    rr = np.hypot(X - CX, Y - 21.0)
    P.flat(g, mane, "gold", 4)
    P.flat(g, mane & ((np.floor((ang + math.pi) / (2 * math.pi) * 14).astype(np.int64) % 2) == 0), "gold", 5)  # the mane locks
    P.flat(g, mane & (rr > 5.4), "gold", 2)  # the dark outer edge
    g.prism("z", S_.flat_ngon(CX, 21.0, 3.0, 8), WZ - 5, WZ - 2, C("stone", 5), top=S_.flat_ngon(CX, 21.0, 4.3, 8))
    face = S_.last(g)
    P.flat(g, face, "stone", 5)
    P.flat(g, face & (Y > 22.8), "stone", 6)
    P.flat(g, face & (Z < WZ - 4) & (np.abs(Y - 23.2) < 0.6) & (np.abs(X - CX) < 2.6), "stone", 2)  # the heavy brow
    for ex in (CX - 1.6, CX + 1.6):  # glowing cyan eyes
        P.flat(g, face & (Z < WZ - 4) & (np.abs(X - ex) < 1.0) & (np.abs(Y - 22.0) < 1.0), "cyan", 7)
    g.prism("z", S_.flat_ngon(CX, 18.6, 1.9, 6), MOUTH[1], WZ - 4, C("stone", 5), top=S_.flat_ngon(CX, 19.2, 2.6, 6))
    muz = S_.last(g)
    P.flat(g, muz, "stone", 5)
    P.flat(g, muz & (Y > 19.6), "stone", 6)
    P.flat(g, muz & (Z < MOUTH[1] + 1) & (np.abs(X - CX) < 1.0) & (np.abs(Y - 18.4) < 0.8), "steel", 1)  # the open mouth
    P.flat(g, muz & (Z < MOUTH[1] + 1) & (np.abs(X - CX) < 0.6) & (np.abs(Y - 20.2) < 0.5), "darkwood", 2)  # the nose

    # the cyan wishing orb set in the arch, in a gold ring
    orb = S_.disc(g, "z", CX, 31.0, 2.6, WZ - 1.5, WZ, "cyan", 6, n=8)
    ro = np.hypot(X - CX, Y - 31.0)
    P.flat(g, orb, "cyan", 5)
    P.flat(g, orb & (ro < 1.6), "cyan", 7)
    P.flat(g, orb & (ro > 2.1), "gold", 5)

    # the half-octagon basin: a C-shaped stone wall, a floor and the water
    outer, inner = half_oct(R_OUT), half_oct(R_IN)
    start = len(g.solids)
    bw = plan(g, outer + inner[::-1], 0, RIM, "stone", 4)
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 4, block=(5, 3), cracks=0.05, frame=fr, seed=5))
    # a dark arris at each octagon corner of the outer face (rule S4)
    ba = np.degrees(np.arctan2(Z - WZ, X - CX))
    corner = np.zeros(S, dtype=bool)
    for deg in (-22.5, -67.5, -112.5, -157.5):
        corner |= np.abs(ba - deg) < 2.2
    outer_face = bw & (np.hypot(X - CX, Z - WZ) > R_OUT - 1.2)
    P.flat(g, outer_face & corner, "steel", 2)
    P.flat(g, bw & (Yi == RIM - 1), "stone", 6)  # the lit coping
    P.flat(g, outer_face & (Yi == RIM - 2), "gold", 4)  # a gold band under the coping
    P.flat(g, bw & (Yi == 0), "steel", 2)
    fl = plan(g, inner, 0, 2, "stone", 2)
    P.flat(g, fl, "stone", 2)
    wt = plan(g, inner, 2, WATER, "sky", 4)
    P.flat(g, wt, "sky", 3)
    surf = wt & (Yi == int(WATER) - 1)
    rl = np.hypot(X - CX, Z - LAND[1])
    P.flat(g, surf, "sky", 4)
    P.flat(g, surf & (np.abs(rl - 5.0) < 0.6), "sky", 5)  # ripple rings round the fall
    P.flat(g, surf & (np.abs(rl - 3.2) < 0.6), "cyan", 6)
    P.flat(g, surf & (rl < 2.2), "bone", 7)  # white foam where it lands
    for cx, cz in ((CX - 7, 12.0), (CX + 6, 14.5), (CX + 8, 9.0), (CX - 4, 6.0)):
        P.flat(g, surf & (np.hypot(X - cx, Z - cz) < 1.2), "gold", 6)  # thrown coins
    # moss at the foot of the wall and the basin, and grass tufts
    P.flat(g, (wl | bw) & (Yi < 2) & ((P._hash(Xi // 2, Zi // 2, seed=7) % np.uint64(3)) == 0), "moss", 4)
    grass(g, [(1, 0, 8), (33, 0, 10), (4, 0, 3)], "leaf", 5)
    return g


def stream() -> Grid:
    """The water that falls from the mouth: a ribbon that leaves the mouth,
    bends out and drops into the basin, painted as running water."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Yi = np.floor(X).astype(np.int64), np.floor(Y).astype(np.int64)
    (y0, z0), (y1, z1) = MOUTH, LAND
    pts, halves = [], []
    steps = 6
    for i in range(steps + 1):
        t = i / steps
        pts.append((y0 - (y0 - y1 + 0.5) * t * t, z0 + 0.4 - (z0 + 0.4 - z1) * t))
        halves.append(1.1 + 0.4 * t)  # the fall widens as it drops
    fall = strip(g, "x", pts, halves, CX - 1.5, CX + 1.5, "cyan", 5)
    # running water: vertical light streaks that shift down the fall, a
    # bright lip at the mouth and white foam at the foot (no masonry bands)
    P.flat(g, fall, "cyan", 5)
    P.flat(g, fall & (Xi == int(CX) - 1), "cyan", 4)  # the shaded edge
    P.flat(g, fall & (Xi == int(CX)), "cyan", 6)  # the lit core
    P.flat(g, fall & (((Yi + Xi * 3) % 5) == 0), "sky", 7)  # white streaks
    P.flat(g, fall & (Y > y0 - 1.5), "cyan", 7)  # the bright lip
    P.flat(g, fall & (Y < y1 + 1.5), "bone", 7)  # the foam at the foot
    return g


def build():
    w, s = wall(), stream()
    pivot = (CX, MOUTH[0], MOUTH[1])
    root, to_root = rig([("magic-fountain", w, None, None), ("water", s, pivot, None)])
    idle = {"water": {"scale": sway(2.0, amp=(0.12, 0.0, 0.0), base=(1.0, 1.0, 1.0))}}
    active = {"water": {"scale": sway(1.0, amp=(0.35, 0.0, 0.0), cycles=(2, 1, 1), base=(1.0, 1.0, 1.0))}}
    return asset("animated-props", "magic-fountain", "Wishing Fountain", root,
                 clips=[Clip("idle", idle), Clip("active", active)],
                 sockets=[Socket("socket-function", at=to_root((CX, LAND[0] + 1.0, LAND[1])), parent="water")],
                 fx=[pfx("rvx-fantasy-waterfall-mist", "socket-function", "idle", size=14)])
