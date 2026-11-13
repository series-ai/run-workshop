"""Centaur archer in the Pirate Nation creature style.

A bay horse body about 50 long on four tall legs (black points, two white
socks, dark hooves) with a long black tail; out of the front of it rises
the torso of a man at person proportion (rule F4: a big caricature head):
a bearded face with a nose, painted eyes and brows, ears, long black hair
in a blue headband, a bare painted chest with a leather baldric, a leather
pauldron with gold rivets and a belt with a gold buckle where man meets
horse. The oversized function prop is a tall recurve bow (true-slope
limbs, gold tips, a red grip and a taut string) held out in the left hand,
with an arrow nocked by the right hand and a quiver of red-fletched arrows
on the back. The detail is paint (S1): hide patches on the coat, hair
strands, leather wraps.

Clips: idle (breathe, look round, swish the tail, paw the ground), attack
(draw the string back, loose the arrow: the PFX at the bow socket, the
arrow leaves the string, then a new one is nocked), hit (the torso and
head snap back), death (the legs buckle and it rolls onto its left side).
Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
from _fcreature_beasts import frame_seams, paint_solids, strands
from _life import C, Clip, Grid, Socket, asset, chamfer_rect, coords, front, keys, last, pfx, plan, rig, side
from pnshapes import quad

S = (64, 80, 108)
CX = 32.0
COAT, POINTS, HAIR, SKIN, LEATHER = "wood", "darkwood", "darkwood", "skin", "wood"
BODY_Y, BODY_RY = 30.0, 8.0  # the horse barrel: centre line and half height (legs about 22)
TORSO_Z = 43.0  # the centre of the human torso (z)
BODY_HINGE = (CX, 0.0, 66.0)
TORSO_HINGE = (CX, 38.0, TORSO_Z)
NECK = (CX, 55.0, TORSO_Z)
SHOULDER = {-1: (CX - 8.5, 51.5, TORSO_Z), 1: (CX + 8.5, 51.5, TORSO_Z)}
ELBOW_R = (CX + 6.5, 49.5, 33.0)
HAND_L = (CX - 10.0, 49.5, 25.5)
BOW_X = CX - 10.0
STRING_Z = 29.6
TAIL_HINGE = (CX, 36.0, 90.0)
LEGS = {"leg-fl": (-1, 45.0, True), "leg-fr": (1, 45.0, False), "leg-bl": (-1, 84.0, False), "leg-br": (1, 84.0, True)}


def _sec(c, r, ch):
    return chamfer_rect(c[0] - r[0], c[1] - r[1], c[0] + r[0], c[1] + r[1], min(r) * ch)


def zseg(g: Grid, c0, c1, r0, r1, z0, z1, ramp: str, shade: int, ch: float = 0.42) -> np.ndarray:
    """A chamfered frustum along z between (x, y) centres (sheared)."""
    g.prism("z", _sec(c0, r0, ch), z0, z1, C(ramp, shade), top=_sec(c1, r1, ch))
    return last(g)


def yseg(g: Grid, c0, c1, r0, r1, y0, y1, ramp: str, shade: int, ch: float = 0.42) -> np.ndarray:
    """A chamfered frustum along y between (x, z) centres (sheared)."""
    g.prism("y", _sec(c0, r0, ch), y0, y1, C(ramp, shade), top=_sec(c1, r1, ch))
    return last(g)


def xseg(g: Grid, c0, c1, r0, r1, x0, x1, ramp: str, shade: int, ch: float = 0.42) -> np.ndarray:
    """A chamfered frustum along x between (y, z) centres (sheared)."""
    g.prism("x", _sec(c0, r0, ch), x0, x1, C(ramp, shade), top=_sec(c1, r1, ch))
    return last(g)


def coat(g: Grid, start: int, ramp: str = COAT, base: int = 4, seed: int = 0, cell=(7, 5)) -> np.ndarray:
    """A smooth coat on the prisms since `start`: the base tone, a lit band
    on top, a shaded band below, a few soft hair streaks (big cells, not
    speckle) and dark arrises (rule S4)."""
    _X, Y, _Z = coords(g)
    m = np.logical_or.reduce([sol.mask(g.shape) for sol in g.solids[start:]])
    lo, hi = float(Y[m].min()), float(Y[m].max())
    t = (Y - lo) / max(1.0, hi - lo)
    U, V = P.uv(g, None)
    streak = (P._hash(U // 2, V // cell[1], seed=seed) % np.uint64(9)) == 0
    shade = np.where(t > 0.78, base + 1, np.where(t < 0.25, base - 1, base))
    shade = np.where(streak & (U % 2 == 0), shade - 1, shade)
    P._paint(g, m, ramp, np.clip(shade, 1, 7))
    frame_seams(g, start, m, steps=1)
    return m


def locks(g: Grid, start: int, base: int = 3) -> np.ndarray:
    """Hair strands on the prisms since `start`."""
    return paint_solids(g, start, lambda gg, mm, fr: strands(gg, mm, HAIR, base, frame=fr, period=4))


def about(q, pivot, deg_z: float):
    """A `loc` offset that makes a z rotation about `pivot` act about q."""
    a = math.radians(deg_z)
    dx, dy = pivot[0] - q[0], pivot[1] - q[1]
    rx, ry = dx * math.cos(a) - dy * math.sin(a), dx * math.sin(a) + dy * math.cos(a)
    return (rx + q[0] - pivot[0], ry + q[1] - pivot[1], 0.0)


# ------------------------------------------------------------------ the horse
def body() -> Grid:
    """The horse barrel with shoulder and haunch muscles, a pale belly and a
    leather girth strap with a gold ring."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    start = len(g.solids)
    zseg(g, (CX, BODY_Y + 0.5), (CX, BODY_Y + 0.5), (7.5, 7.0), (9.5, BODY_RY), 38, 48, COAT, 4, ch=0.55)
    zseg(g, (CX, BODY_Y + 0.5), (CX, BODY_Y), (9.5, BODY_RY), (10.0, BODY_RY), 48, 78, COAT, 4, ch=0.55)
    zseg(g, (CX, BODY_Y), (CX, BODY_Y + 1.0), (10.0, BODY_RY), (7.5, 6.5), 78, 91, COAT, 4, ch=0.55)
    for s in (-1, 1):  # big faceted shoulder and haunch muscles
        yseg(g, (CX + s * 7.0, 45.0), (CX + s * 7.5, 46.0), (3.4, 5.0), (3.6, 6.5), 22, 35, COAT, 4)
        yseg(g, (CX + s * 7.0, 83.0), (CX + s * 7.6, 82.0), (3.8, 6.0), (3.6, 8.0), 21, 36, COAT, 4)
    m = coat(g, start, seed=1)
    P.flat(g, m & (Y < BODY_Y - BODY_RY + 2.0) & (Z > 48) & (Z < 80), "sand", 3)  # the pale belly
    P.flat(g, m & (np.abs(Y - (BODY_Y - BODY_RY + 2.4)) < 0.6) & (Z > 48) & (Z < 80), COAT, 2)
    P.flat(g, m & (Y > BODY_Y + BODY_RY - 1.0), COAT, 5)  # the lit back
    P.darken(g, m & (Y < 25.0), 1)  # shade under the muscles
    # a leather girth strap round the barrel, with a gold ring on each side
    girth = m & (np.abs(Z - 53.0) < 1.6)
    P.flat(g, girth, LEATHER, 3)
    P.flat(g, girth & (np.abs(Z - 53.0) > 1.0), POINTS, 2)
    P.flat(g, girth & (np.abs(Y - 28.0) < 1.6) & (np.abs(X - CX) > 8.5), "gold", 6)
    P.flat(g, girth & (np.abs(Y - 28.0) < 0.6) & (np.abs(X - CX) > 9.5), "gold", 4)
    # painted muscle lines: a curve round the shoulder and round the haunch
    for zc, r in ((45.0, 7.5), (83.0, 8.5)):
        ring = np.hypot((Z - zc) * 0.9, Y - 27.0)
        P.flat(g, m & (np.abs(ring - r) < 0.6) & (np.abs(X - CX) > 8.0) & (Y > 21.0), COAT, 2)
    # a dark stripe down the spine
    P.flat(g, m & (np.abs(X - CX) < 1.2) & (Y > BODY_Y + BODY_RY - 1.5) & (Z > 46), POINTS, 3)
    # a royal-blue saddle cloth with a gold border and a gold diamond on each side
    cloth = m & (Z > 57.0) & (Z < 74.0) & (Y > 24.0 + np.abs(Z - 65.5) * 0.2)
    P.flat(g, cloth, "blue", 4)
    P.flat(g, cloth & (Y > BODY_Y + BODY_RY - 1.0), "blue", 5)
    edge = cloth & ((np.abs(Z - 65.5) > 7.2) | (Y < 25.4 + np.abs(Z - 65.5) * 0.2))
    P.flat(g, edge, "gold", 5)
    P.flat(g, edge & ((np.floor(Z + Y).astype(int) % 3) == 0), "gold", 3)  # a braided trim
    dia = cloth & ((np.abs(Z - 65.5) + np.abs(Y - 29.5)) < 3.2) & (np.abs(X - CX) > 8.0)
    P.flat(g, dia, "gold", 6)
    P.flat(g, dia & ((np.abs(Z - 65.5) + np.abs(Y - 29.5)) < 1.2), "red", 5)
    P.flat(g, m & (np.abs(X - CX) < 1.2) & (Y > BODY_Y + BODY_RY - 1.5) & (Z > 57.0) & (Z < 74.0), "gold", 4)
    # a brand on the haunch: a gold star (an accent, C3)
    for s in (-1, 1):
        xs = "-x" if s < 0 else "+x"
        pnglyph.stamp(g, xs, CX + s * 11.0, 81, 29, ["..y..", ".yyy.", "yyyyy", ".y.y."], {"y": C("gold", 5)})
    return g


def leg(name: str) -> Grid:
    """A tall horse leg: forearm or gaskin, a black cannon, a white sock on
    two of the legs, and a dark hoof with a lit rim."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    s, zc, sock = LEGS[name]
    xl = CX + s * 6.0
    start = len(g.solids)
    if zc < 60:  # a front leg: forearm, knee, cannon
        yseg(g, (xl, zc), (xl, zc + 0.5), (3.0, 3.4), (4.2, 4.8), 13, 31, COAT, 4)
        foot = zc
    else:  # a hind leg: gaskin back to the hock, then the cannon
        yseg(g, (xl, zc + 3.5), (xl, zc - 1.0), (3.0, 3.4), (4.8, 6.0), 13, 32, COAT, 4)
        foot = zc + 3.5
    up = coat(g, start, seed=2 + int(zc))
    P.darken(g, up & (Y < 17.0), 1)
    c0 = len(g.solids)
    yseg(g, (xl, foot), (xl, foot), (2.6, 2.8), (3.0, 3.3), 4.0, 14.0, POINTS, 3)
    low = coat(g, c0, POINTS, 3, seed=3)
    P.flat(g, low & (Y > 12.5), POINTS, 2)  # the knee joint
    if sock:  # a white sock with a feathered top edge
        P.flat(g, low & (Y < 9.0 + (np.floor(X + Z).astype(int) % 2)), "bone", 6)
        P.flat(g, low & (Y < 5.5), "bone", 5)
    h0 = len(g.solids)
    plan(g, chamfer_rect(xl - 3.6, foot - 4.2, xl + 3.6, foot + 3.2, 1.4), 0, 4.0, "iron", 3,
         top=chamfer_rect(xl - 3.0, foot - 3.2, xl + 3.0, foot + 2.8, 1.0))
    hoof = np.logical_or.reduce([sol.mask(g.shape) for sol in g.solids[h0:]])
    P.flat(g, hoof & (Y > 3.0), "iron", 5)
    P.flat(g, hoof & (Y < 1.0), "iron", 2)
    return g


def tail() -> Grid:
    """A long black tail in three sloped locks, swept back and down."""
    g = Grid(*S)
    t0 = len(g.solids)
    side(g, [(37.5, 88.0), (39.0, 93.0), (32.0, 99.0), (24.0, 101.0), (26.0, 95.0), (32.0, 90.0)], CX - 2.6, CX + 2.6, HAIR, 3)
    side(g, [(30.0, 95.0), (26.0, 101.5), (14.0, 103.0), (16.0, 98.0), (24.0, 94.0)], CX - 3.2, CX + 2.2, HAIR, 3)
    side(g, [(20.0, 99.0), (15.0, 103.5), (8.0, 102.0), (12.0, 99.0)], CX - 1.8, CX + 2.8, HAIR, 3)
    m = locks(g, t0, 3)
    _X, Y, _Z = coords(g)
    P.flat(g, m & (Y < 12.0), HAIR, 2)  # the dark ends of the locks
    return g


# ------------------------------------------------------------------ the man
def torso() -> Grid:
    """The human torso at person proportion: a bare painted chest, a belt
    where man meets horse, a leather baldric and a quiver on the back."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    start = len(g.solids)
    yseg(g, (CX, TORSO_Z), (CX, TORSO_Z), (5.8, 4.2), (6.6, 4.4), 34, 43, SKIN, 4)
    yseg(g, (CX, TORSO_Z), (CX, TORSO_Z + 0.3), (6.6, 4.4), (8.6, 5.0), 43, 52, SKIN, 4)
    yseg(g, (CX, TORSO_Z + 0.3), (CX, TORSO_Z + 0.5), (8.6, 5.0), (4.0, 3.0), 52, 55, SKIN, 4)
    chest = coat(g, start, SKIN, 4, seed=4, cell=(6, 6))
    zf = TORSO_Z - 4.2  # the front of the chest
    front_m = chest & (Z < zf + 1.2)
    # painted muscles: the line under the pecs, the centre line and the abs
    P.flat(g, front_m & (np.abs(Y - (46.5 - np.abs(X - CX) * 0.15)) < 0.6) & (np.abs(X - CX) < 6.5), SKIN, 2)
    P.flat(g, front_m & (np.abs(X - CX) < 0.6) & (Y > 38) & (Y < 50), SKIN, 3)
    for ya in (40.5, 43.5):
        P.flat(g, front_m & (np.abs(Y - ya) < 0.5) & (np.abs(X - CX) < 3.5), SKIN, 3)
    P.flat(g, chest & (Y > 51.5), SKIN, 5)  # the lit tops of the shoulders
    # the belt where man meets horse, with a gold buckle
    b0 = len(g.solids)
    yseg(g, (CX, TORSO_Z), (CX, TORSO_Z), (7.2, 5.0), (7.0, 4.8), 36.5, 40.0, LEATHER, 3)
    belt = np.logical_or.reduce([sol.mask(g.shape) for sol in g.solids[b0:]])
    P.flat(g, belt & (Y > 39.0), LEATHER, 4)
    P.flat(g, belt & (Y < 37.5), POINTS, 2)
    buckle = belt & (Z < TORSO_Z - 4.0) & (np.abs(X - CX) < 1.8)
    P.flat(g, buckle, "gold", 6)
    P.flat(g, buckle & (np.abs(X - CX) < 0.6) & (np.abs(Y - 38.2) < 0.6), "gold", 3)
    P.flat(g, belt & (np.abs(Y - 38.2) < 0.6) & ((np.floor(X + Z).astype(int) % 4) == 0) & ~buckle, "gold", 5)  # studs
    # a leather baldric from the left hip over the right shoulder
    bald = chest & (np.abs((X - CX) * 0.75 - (Y - 46.0) * 0.66) < 1.3) & (Y > 40) & ~belt
    P.flat(g, bald, LEATHER, 3)
    P.flat(g, bald & ((np.floor(Y).astype(int) % 3) == 0), "gold", 5)
    # the quiver on the back, tilted, its arrows over the right shoulder
    q0 = len(g.solids)
    front(g, quad((CX - 5.0, 39.0), (CX + 5.0, 55.0), 2.4, 2.8), TORSO_Z + 4.0, TORSO_Z + 8.6, LEATHER, 3)
    qv = np.logical_or.reduce([sol.mask(g.shape) for sol in g.solids[q0:]])
    t = (Y - 39.0) / 16.0
    P.flat(g, qv & ((np.floor(t * 16).astype(int) % 5) == 0), POINTS, 2)  # leather bands
    P.flat(g, qv & (t > 0.88), "gold", 5)  # the gold rim of the mouth
    P.flat(g, qv & (t < 0.08), "gold", 4)
    frame_seams(g, q0, qv, steps=1)
    for k, dx in enumerate((-1.6, 0.4, 2.2)):
        x0, y0 = CX + 4.4 + dx, 54.0 + k * 0.4
        front(g, quad((x0, y0), (x0 + 2.4, y0 + 5.0), 0.55), TORSO_Z + 5.6, TORSO_Z + 6.8, "wood", 5)
        fl = front(g, quad((x0 + 1.4, y0 + 3.0), (x0 + 3.0, y0 + 6.6), 1.1, 0.5, cap=0.6), TORSO_Z + 5.4, TORSO_Z + 7.0, "red", 5)
        P.flat(g, fl & (Y > y0 + 5.2), "red", 6)
    return g


def head() -> Grid:
    """A big caricature head: painted eyes and brows, a nose, ears, a black
    beard, long black hair and a blue headband with a gold gem."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    hz0 = TORSO_Z - 5.0  # the face plane
    start = len(g.solids)
    yseg(g, (CX, TORSO_Z), (CX, TORSO_Z), (2.6, 2.6), (2.6, 2.6), 53.5, 56.0, SKIN, 3)  # the neck
    zseg(g, (CX, 60.5), (CX, 60.5), (5.0, 5.5), (5.0, 5.5), hz0, hz0 + 9.5, SKIN, 4, ch=0.3)
    for s in (-1, 1):  # ears
        front(g, [(CX + s * 4.6, 58.0), (CX + s * 6.4, 58.6), (CX + s * 6.6, 61.6), (CX + s * 4.6, 61.0)], hz0 + 3.5, hz0 + 5.5, SKIN, 4)
    head_m = coat(g, start, SKIN, 4, seed=5, cell=(5, 4))
    # the nose (a true-slope wedge)
    nose = front(g, [(CX - 1.3, 57.6), (CX + 1.3, 57.6), (CX + 0.4, 61.0), (CX - 0.4, 61.0)], hz0 - 1.4, hz0 + 0.5, SKIN, 4)
    P.flat(g, nose & (Y < 58.4), SKIN, 2)
    # the painted face (rows read left to right as seen from the front)
    ink = {"b": C(HAIR, 2), "w": C("bone", 7), "p": C("navy", 2), "s": C(SKIN, 3), "m": C("red", 2), "h": C(HAIR, 3), "H": C(HAIR, 2)}
    face = ["bbbb..bbbb",
            ".wpw..wpw.",
            ".wpw..wpw.",
            "s........s",
            "s...ss...s",
            "hhh.mm.hhh",
            "hhhhhhhhhh",
            ".hHhhhhHh."]
    pnglyph.stamp(g, "-z", hz0, int(CX - 5), 55, face, ink, reach=1)
    # a black beard below the face (a true-slope wedge)
    b0 = len(g.solids)
    front(g, [(CX - 5.0, 58.0), (CX + 5.0, 58.0), (CX + 3.6, 53.6), (CX, 52.2), (CX - 3.6, 53.6)], hz0 - 0.6, hz0 + 6.5, HAIR, 3)
    locks(g, b0, 3)
    # the hair: a cap with a fringe, long locks down the back, a blue band
    h0 = len(g.solids)
    zseg(g, (CX, 64.3), (CX, 64.0), (5.6, 2.6), (5.6, 3.0), hz0 - 0.6, hz0 + 10.2, HAIR, 3, ch=0.35)
    side(g, [(66.0, hz0 + 5.0), (66.0, hz0 + 10.4), (56.0, hz0 + 11.6), (47.0, hz0 + 11.0), (47.5, hz0 + 8.0), (56.0, hz0 + 8.6)], CX - 4.6, CX + 4.6, HAIR, 3)
    for s in (-1, 1):  # side locks behind the ears
        front(g, [(CX + s * 4.4, 63.0), (CX + s * 6.0, 63.0), (CX + s * 6.6, 54.0), (CX + s * 4.8, 54.0)], hz0 + 6.0, hz0 + 9.6, HAIR, 3)
    hair = locks(g, h0, 3)
    band = hair & (np.abs(Y - 63.2) < 0.7) & (Z < hz0 + 9.0)
    P.flat(g, band, "blue", 4)
    P.flat(g, band & (Z < hz0 + 0.5) & (np.abs(X - CX) < 1.0), "gold", 6)  # a gold gem on the band
    P.flat(g, hair & (Y < 49.0), HAIR, 2)
    return g


def arm_l() -> Grid:
    """The bow arm, held straight out forward, with a leather bracer."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx, sy, sz = SHOULDER[-1]
    start = len(g.solids)
    zseg(g, (HAND_L[0] + 0.5, HAND_L[1] + 0.2), (sx - 0.5, sy), (1.8, 1.8), (2.6, 2.6), HAND_L[2] + 1.5, sz + 1.0, SKIN, 4)
    arm = coat(g, start, SKIN, 4, seed=6, cell=(5, 4))
    br = arm & (Z > HAND_L[2] + 2.0) & (Z < HAND_L[2] + 7.5)
    P.flat(g, br, LEATHER, 3)
    P.flat(g, br & ((np.floor(Z).astype(int) % 2) == 0), LEATHER, 4)
    P.flat(g, br & (np.abs(Z - (HAND_L[2] + 4.8)) < 0.6), "gold", 5)
    # the leather pauldron on the shoulder, with gold rivets on its rim
    p0 = len(g.solids)
    plan(g, chamfer_rect(sx - 3.8, sz - 3.8, sx + 2.6, sz + 3.8, 1.6), sy + 0.5, sy + 3.6, LEATHER, 3,
         top=chamfer_rect(sx - 2.4, sz - 2.6, sx + 1.8, sz + 2.6, 1.0))
    pd = np.logical_or.reduce([sol.mask(g.shape) for sol in g.solids[p0:]])
    P.flat(g, pd & (Y > sy + 2.5), LEATHER, 4)
    P.flat(g, pd & (Y < sy + 1.5), "gold", 4)
    P.flat(g, pd & (Y < sy + 1.5) & ((np.floor(X + Z).astype(int) % 3) == 0), "gold", 6)
    # the fist round the grip
    box_m = zseg(g, (HAND_L[0], HAND_L[1]), (HAND_L[0], HAND_L[1]), (2.0, 2.2), (2.0, 2.2), HAND_L[2] - 1.6, HAND_L[2] + 2.0, SKIN, 4, ch=0.3)
    P.flat(g, box_m & (Z < HAND_L[2] - 0.8), SKIN, 3)
    return g


def bow() -> Grid:
    """A tall recurve bow: a red-wrapped grip, limbs that bend back toward
    the archer and curl forward at gold tips, and a taut string."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    hy, hz = HAND_L[1], HAND_L[2]
    x0, x1 = BOW_X - 1.0, BOW_X + 1.0
    start = len(g.solids)
    side(g, quad((hy - 3.5, hz + 0.2), (hy + 3.5, hz + 0.2), 1.4), x0, x1, "darkwood", 4)
    for sgn in (-1, 1):  # the two limbs, mirrored about the grip
        y1, y2, y3 = hy + sgn * 3.0, hy + sgn * 11.5, hy + sgn * 16.5
        side(g, quad((y1, hz + 0.2), (y2, hz + 2.6), 1.3, 1.1), x0, x1, "wood", 4)
        side(g, quad((y2, hz + 2.6), (y3, hz + 4.6), 1.1, 0.8), x0, x1, "wood", 4)
        side(g, quad((y3, hz + 4.6), (y3 + sgn * 2.6, hz + 2.4), 0.8, 0.6, cap=0.8), x0, x1, "gold", 5)
    limbs = np.logical_or.reduce([sol.mask(g.shape) for sol in g.solids[start:]])
    P.flat(g, limbs & (np.abs(Y - hy) > 3.0), "wood", 4)
    P.flat(g, limbs & (np.abs(Y - hy) > 3.0) & (Z < hz + np.interp(np.abs(Y - hy), [3, 11.5, 16.5], [0.2, 2.6, 4.6]) - 0.3), "wood", 5)  # the lit back
    P.flat(g, limbs & (np.abs(Y - hy) > 9.0) & (np.abs(Y - hy) < 10.5), "gold", 5)  # gold bands
    P.flat(g, limbs & (np.abs(Y - hy) > 16.0), "gold", 6)  # the gold tips
    grip = limbs & (np.abs(Y - hy) < 3.0)
    P.flat(g, grip, "red", 4)
    P.flat(g, grip & ((np.floor(Y).astype(int) % 2) == 0), "red", 3)
    # the taut string from tip to tip
    side(g, quad((hy - 16.8, STRING_Z), (hy + 16.8, STRING_Z), 0.55), BOW_X - 0.5, BOW_X + 0.5, "bone", 7)
    return g


def arm_r() -> Grid:
    """The upper draw arm, out to the side and forward to the elbow."""
    g = Grid(*S)
    sx, sy, sz = SHOULDER[1]
    start = len(g.solids)
    zseg(g, (ELBOW_R[0], ELBOW_R[1]), (sx, sy), (2.0, 2.0), (2.6, 2.6), ELBOW_R[2] - 1.0, sz + 1.0, SKIN, 4)
    coat(g, start, SKIN, 4, seed=7, cell=(5, 4))
    return g


def forearm_r() -> Grid:
    """The draw forearm across the chest to the string, with a bracer."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    ex, ey, ez = ELBOW_R
    hx = BOW_X + 1.6
    start = len(g.solids)
    xseg(g, (ey + 0.2, STRING_Z + 0.4), (ey, ez), (1.8, 1.8), (2.1, 2.1), hx, ex + 1.5, SKIN, 4)
    arm = coat(g, start, SKIN, 4, seed=8, cell=(5, 4))
    br = arm & (X > hx + 4.0) & (X < hx + 9.0)
    P.flat(g, br, LEATHER, 3)
    P.flat(g, br & ((np.floor(X).astype(int) % 2) == 0), LEATHER, 4)
    fist = xseg(g, (ey + 0.2, STRING_Z + 0.4), (ey + 0.2, STRING_Z + 0.4), (2.0, 2.0), (2.0, 2.0), hx - 1.2, hx + 2.2, SKIN, 4, ch=0.3)
    P.flat(g, fist & (X < hx - 0.4), SKIN, 3)
    return g


def arrow() -> Grid:
    """The nocked arrow: a shaft along the bow, an iron head in front and
    red fletching at the string."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    ay = HAND_L[1] + 0.6
    x0, x1 = BOW_X + 0.4, BOW_X + 1.4
    side(g, quad((ay, STRING_Z + 1.2), (ay, HAND_L[2] - 8.0), 0.55), x0, x1, "wood", 6)
    head = side(g, [(ay - 1.4, HAND_L[2] - 8.0), (ay + 1.4, HAND_L[2] - 8.0), (ay, HAND_L[2] - 11.0)], x0, x1, "steel", 5)
    P.flat(g, head & (Z < HAND_L[2] - 9.6), "steel", 6)
    fl = side(g, [(ay, STRING_Z + 1.4), (ay + 1.8, STRING_Z + 0.6), (ay + 1.8, STRING_Z - 3.8), (ay, STRING_Z - 3.2)], x0, x1, "red", 5)
    P.flat(g, fl & (Y > ay + 1.0), "red", 6)
    return g


# ------------------------------------------------------------------ clips
def keyed(root, clip: dict) -> dict:
    """Give every part with a grid a rest key in the clip, so a viewer that
    plays one clip per part never keeps a pose from another clip."""
    for part in root.walk():
        if part.grid is not None and part.name not in clip:
            clip[part.name] = {"rot": keys((0, 0, 0, 0))}
    return clip


def build():
    parts = [("centaur", None, None, None),
             ("body", body(), BODY_HINGE, None),
             ("tail", tail(), TAIL_HINGE, "body")]
    for name, (s, zc, _sock) in LEGS.items():
        parts.append((name, leg(name), (CX + s * 6.0, 31.0, zc), "body"))
    parts += [("torso", torso(), TORSO_HINGE, "body"),
              ("head", head(), NECK, "torso"),
              ("arm-l", arm_l(), SHOULDER[-1], "torso"),
              ("bow", bow(), HAND_L, "arm-l"),
              ("arm-r", arm_r(), SHOULDER[1], "torso"),
              ("forearm-r", forearm_r(), ELBOW_R, "arm-r"),
              ("arrow", arrow(), (BOW_X + 0.9, HAND_L[1] + 0.6, STRING_Z), "forearm-r")]
    root, to_root = rig(parts)
    z = (0, 0, 0, 0)
    idle = {"body": {"scale": keys((0, 1, 1, 1), (1.2, 1.015, 1.03, 1.0), (2.4, 1, 1, 1))},
            "torso": {"rot": keys(z, (1.2, 2, 0, 0), (2.4, 0, 0, 0))},
            "head": {"rot": keys(z, (0.6, 0, 14, 0), (1.2, 0, 0, 0), (1.8, 0, -10, 0), (2.4, 0, 0, 0))},
            "tail": {"rot": keys(z, (0.6, 0, 16, 0), (1.8, 0, -16, 0), (2.4, 0, 0, 0))},
            "leg-fr": {"rot": keys(z, (1.0, 0, 0, 0), (1.25, 26, 0, 0), (1.5, 0, 0, 0), (2.4, 0, 0, 0)),
                       "loc": keys(z, (1.0, 0, 0, 0), (1.05, 0, 0.6, 0), (1.45, 0, 0.6, 0), (1.5, 0, 0, 0), (2.4, 0, 0, 0))}}
    # draw: the elbow swings back and the forearm pulls the string hand back
    # to the chest; loose at 0.35 (the arrow is gone), nock again by 1.2
    attack = {"arm-r": {"rot": keys(z, (0.28, 0, 18, 0), (0.35, 0, 24, 0), (0.6, 0, 22, 0), (1.2, 0, 0, 0))},
              "forearm-r": {"rot": keys(z, (0.28, 0, 30, 0), (0.35, 0, 40, 0), (0.6, 0, 36, 0), (1.2, 0, 0, 0))},
              "arrow": {"scale": keys((0, 1, 1, 1), (0.34, 1, 1, 1), (0.36, 0.05, 0.05, 0.05), (1.0, 0.05, 0.05, 0.05), (1.1, 1, 1, 1))},
              "torso": {"rot": keys(z, (0.28, 0, -10, 0), (0.35, -4, -12, 0), (0.6, 0, -8, 0), (1.2, 0, 0, 0))},
              "bow": {"rot": keys(z, (0.34, 0, 0, 0), (0.4, -8, 0, 0), (0.6, 0, 0, 0))},
              "leg-fl": {"rot": keys(z, (0.3, 10, 0, 0), (0.45, 0, 0, 0)), "loc": keys(z, (0.05, 0, 0.5, 0), (0.4, 0, 0.5, 0), (0.45, 0, 0, 0))},
              "tail": {"rot": keys(z, (0.35, -18, 0, 0), (0.8, 0, 0, 0))}}
    hit = {"torso": {"rot": keys(z, (0.1, 16, 8, 0), (0.35, 12, 6, 0), (0.7, 0, 0, 0))},
           "head": {"rot": keys(z, (0.1, 18, -10, 6), (0.35, 12, -6, 4), (0.7, 0, 0, 0))},
           "body": {"loc": keys(z, (0.1, 0, 0, 2.0), (0.35, 0, 0, 1.4), (0.7, 0, 0, 0))},
           "tail": {"rot": keys(z, (0.1, -20, 0, 0), (0.7, 0, 0, 0))}}
    q = (CX - 10.0, 0.0, BODY_HINGE[2])
    roll = [(0.0, 0.0), (0.3, 0.0), (0.8, 55.0), (1.05, 86.0), (1.25, 82.0), (1.6, 84.0)]
    death = {"body": {"rot": keys(*[(t, 0, 0, a) for t, a in roll]),
                      "loc": keys(*[(t, *about(q, BODY_HINGE, a)) for t, a in roll])},
             "torso": {"rot": keys(z, (0.3, 14, 0, 0), (1.05, -10, 0, -20), (1.6, -8, 0, -22))},
             "head": {"rot": keys(z, (0.3, 10, 0, 0), (1.05, -20, 0, -10), (1.6, -18, 0, -12))},
             "arm-l": {"rot": keys(z, (1.05, 30, 0, 0), (1.6, 28, 0, 0))},
             "leg-fl": {"rot": keys(z, (0.3, 50, 0, 0), (1.05, 20, 0, 8), (1.6, 18, 0, 8)), "loc": keys(z, (0.05, 0, 0.6, 0), (1.6, 0, 0.6, 0))},
             "leg-fr": {"rot": keys(z, (0.3, 50, 0, 0), (1.05, 30, 0, -10), (1.6, 28, 0, -10)), "loc": keys(z, (0.05, 0, 0.6, 0), (1.6, 0, 0.6, 0))},
             "leg-bl": {"rot": keys(z, (0.3, -40, 0, 0), (1.05, -15, 0, 8), (1.6, -14, 0, 8)), "loc": keys(z, (0.05, 0, 0.6, 0), (1.6, 0, 0.6, 0))},
             "leg-br": {"rot": keys(z, (0.3, -40, 0, 0), (1.05, -20, 0, -10), (1.6, -18, 0, -10)), "loc": keys(z, (0.05, 0, 0.6, 0), (1.6, 0, 0.6, 0))},
             "tail": {"rot": keys(z, (1.05, 0, -20, 0), (1.6, 0, -18, 0))}}
    rest = to_root((BOW_X, HAND_L[1] + 0.6, HAND_L[2] - 2.0))
    return asset("creatures", "centaur", "Centaur", root,
                 clips=[Clip("idle", keyed(root, idle)), Clip("attack", keyed(root, attack), loop=False), Clip("hit", keyed(root, hit), loop=False), Clip("death", keyed(root, death), loop=False)],
                 sockets=[Socket("socket-function", at=rest, parent="bow")],
                 fx=[pfx("rvx-fantasy-bow-release", "socket-function", "clip:attack", size=20, at=0.35)])
