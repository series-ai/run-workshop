"""Crimson Wyrm (boss) in the Pirate Nation creature style.

A chunky caricature after the PN world bosses (the giant turtle): a big
boxy head with a jutting angry brow, huge gold slit eyes, a tapered snout
with oversized fangs outside the lips, swept-back cream horns and cheek
frills; a barrel body of faceted octagon frustums on short thick legs with
big clawed feet; a row of cream spikes down the back to a spaded tail that
curls to one side; vast bat wings (flat faceted panels with thick finger
bones) raised at a slant. The detail is paint: rows of red scales, gold
belly plates, orange wing panels with a dark rim, an ember glow in the
mouth. About the size of the PN giant turtle (181 x 111 x 210).

Clips: idle (breathe, sway the head, flex the wings, swish the tail),
attack (rear up, then lunge with the jaw wide open: fire breath from the
mouth socket), hit (head snaps back, body flinches), death (rears, then
rolls onto its left side). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
from _life import C, Clip, Grid, Socket, asset, chamfer_rect, facet_paint, front, keys, last, pfx, plan, rig, side
from pnshapes import quad

from _quad_falls import Planter, bake, per_frame, sample
from _fmove import Rig, gait, heavy_lift, lerp, wave_keys

S = (200, 128, 198)
CX = 100
SCALE, BELLY, HORN, WEB = "red", "gold", "bone", "orange"
BODY_HINGE = (CX, 26.0, 90.0)
NECK_HINGE = (CX, 42.0, 66.0)
JAW_HINGE = (CX, 75.0, 40.0)
TAIL_HINGE = (CX, 42.0, 122.0)
WING_HINGE = {-1: (CX - 18.0, 60.5, 70.0), 1: (CX + 18.0, 60.5, 70.0)}
WING_REST = {-1: (0.0, -55.0, -30.0), 1: (0.0, 55.0, 30.0)}
# the back line of the body: (z, top y) for the spikes
BACK = [(50, 60), (80, 64), (116, 58), (132, 50)]

_XYZ = None


def xyz():
    """Voxel-centre coordinates of the shared grid (float32, computed once)."""
    global _XYZ
    if _XYZ is None:
        _XYZ = np.meshgrid(*(np.arange(n, dtype=np.float32) + 0.5 for n in S), indexing="ij")
    return _XYZ


# ------------------------------------------------------------------ local shapes
def _sec(c, r, ch):
    return chamfer_rect(c[0] - r[0], c[1] - r[1], c[0] + r[0], c[1] + r[1], min(r) * ch)


def zseg(g: Grid, c0, c1, r0, r1, z0, z1, ramp: str, shade: int, ch: float = 0.42) -> np.ndarray:
    """A chamfered frustum along z: (x, y) centre c0 and half sizes r0 at z0,
    c1 and r1 at z1 (sheared, so bodies and tails taper and bend)."""
    g.prism("z", _sec(c0, r0, ch), z0, z1, C(ramp, shade), top=_sec(c1, r1, ch))
    return last(g)


def yseg(g: Grid, c0, c1, r0, r1, y0, y1, ramp: str, shade: int, ch: float = 0.42) -> np.ndarray:
    """A chamfered frustum along y: (x, z) centre c0 and half sizes r0 at y0,
    c1 and r1 at y1 (limbs and necks with true slopes)."""
    g.prism("y", _sec(c0, r0, ch), y0, y1, C(ramp, shade), top=_sec(c1, r1, ch))
    return last(g)


def scales(g: Grid, m: np.ndarray, frame, ramp: str = SCALE, base: int = 4, row: int = 5, width: int = 14, seed: int = 0) -> None:
    """Paint broad, quiet scale patches with narrow seams on selected cells."""
    U, V = P.uv(g, frame)
    a, b = U + V, U - V
    ca, cb = a // width, b // width
    pa, pb = a % width, b % width
    cell = P._hash(ca, cb, seed=seed)
    shade = base + 2 * ((cell % np.uint64(7)) == 0).astype(np.int64)
    shade = np.where((pa == 0) & (pb == 0), base - 1, shade)
    P._paint(g, m, ramp, shade)


def plates(g: Grid, m: np.ndarray, frame, ramp: str = BELLY, base: int = 5, row: int = 5) -> None:
    """Belly plates: wide cream bands down the face, a dark seam and a light
    upper edge per band."""
    _U, V = P.uv(g, frame)
    X, _Y, _Z = xyz()
    W = V + np.floor(np.abs(X - CX) * 0.45).astype(np.int64)  # chevrons pointing down the belly
    shade = np.where(W % row == 0, base - 2, np.where(W % row == 1, base + 1, base))
    P._paint(g, m, ramp, np.minimum(shade, 7))


def paint_scaled(g: Grid, start: int, base: int = 4, row: int = 5, width: int = 14, seed: int = 0, belly=None, plate_row: int = 5) -> None:
    """Scales on every face of the prisms added since `start`; belly plates
    where `belly` (a position mask) is true."""
    def painter(gg, mm, fr):
        scales(gg, mm, fr, SCALE, base, row, width, seed)
        if belly is not None:
            plates(gg, mm & belly, fr, BELLY, 6, plate_row)
    facet_paint(g, g.solids[start:], painter)


def spike(g: Grid, z: float, y: float, h: float, half: float = 5.0, lean: float = 6.0, x0: float = CX - 2.5, x1: float = CX + 2.5) -> np.ndarray:
    """A back spike: a side-view triangle leaning back (true slopes)."""
    m = side(g, [(y - 2, z - half), (y - 2, z + half), (y + h, z + lean)], x0, x1, HORN, 6)
    _X, Y, _Z = xyz()
    P.flat(g, m & (Y < y + 1.5), HORN, 4)
    P.flat(g, m & (Y >= y + h * 0.6), HORN, 7)
    return m


def claws(g: Grid, xc: float, zf: float, n: int = 3, spread: float = 5.0) -> None:
    """Big hooked toe claws at the front of a foot (side-view wedges)."""
    _X, Y, _Z = xyz()
    for k in range(n):
        x = xc + (k - (n - 1) / 2) * spread
        m = side(g, [(9.5, zf + 3), (9.5, zf - 1), (4, zf - 6), (0.0, zf - 6.5), (2.5, zf + 3)], x - 1.6, x + 1.6, HORN, 7)
        P.flat(g, m & (Y > 7.5), HORN, 5)


# ------------------------------------------------------------------ parts
def body() -> Grid:
    """The barrel trunk with the belly plates and the back spikes (the legs
    are their own parts, so a death can splay them flat)."""
    g = Grid(*S)
    X, Y, Z = xyz()
    start = len(g.solids)
    zseg(g, (CX, 42), (CX, 42), (21, 18), (26, 22), 50, 80, SCALE, 4)
    zseg(g, (CX, 42), (CX, 40), (26, 22), (23, 18), 80, 116, SCALE, 4)
    zseg(g, (CX, 40), (CX, 40), (23, 18), (13, 10), 116, 132, SCALE, 4)
    trunk = np.logical_or.reduce([sol.mask(g.shape) for sol in g.solids[start:]])
    belly = (np.abs(X - CX) < np.minimum(15, 10 + (52 - Y) * 0.22)) & ((Y < 27) | ((Z < 53) & (Y < 52))) & (Z < 124) & (Y > 14)
    paint_scaled(g, start, 5, seed=1, belly=belly)
    # a darker back stripe and dark belly-plate borders
    bod = g.a > 0
    P.darken(g, bod & (Y > 57) & (np.abs(X - CX) < 9) & (Z > 48) & (Z < 134))
    edge = np.minimum(15, 10 + (52 - Y) * 0.22)
    P.flat(g, trunk & (np.abs(np.abs(X - CX) - edge + 0.5) < 0.6) & ((Y < 27) | ((Z < 53) & (Y < 52))) & (Y > 14) & (Z < 124), "gold", 4)
    # back spikes: few and big
    zs, ys = zip(*BACK)
    for zb, h in ((60, 14), (76, 17), (93, 16), (109, 13), (123, 10)):
        spike(g, zb, float(np.interp(zb, zs, ys)), h, half=6.0, lean=7.0)
    return g


LEGS = {"leg-fl": (-1, True), "leg-fr": (1, True), "leg-bl": (-1, False), "leg-br": (1, False)}
LEG_HINGE = {"leg-fl": (CX - 24, 44.0, 64.0), "leg-fr": (CX + 24, 44.0, 64.0), "leg-bl": (CX - 25, 46.0, 108.0), "leg-br": (CX + 25, 46.0, 108.0)}


def leg(name: str) -> Grid:
    """A short, thick faceted leg (front: wrist-elbow-shoulder; hind:
    ankle-knee-hip) on a big foot with toes and claws."""
    s, fore = LEGS[name]
    g = Grid(*S)
    X, Y, Z = xyz()
    start = len(g.solids)
    if fore:
        yseg(g, (CX + s * 27, 62), (CX + s * 28, 70), (8, 8), (10, 10), 7, 22, SCALE, 4)
        yseg(g, (CX + s * 28, 70), (CX + s * 24, 64), (10, 10), (12.5, 13), 22, 48, SCALE, 4)
        xo, zo, yj, zf = 27, 66, 22.5, 47
    else:
        yseg(g, (CX + s * 28, 114), (CX + s * 30, 101), (8, 8), (11, 11), 7, 24, SCALE, 4)
        yseg(g, (CX + s * 30, 101), (CX + s * 24, 110), (11, 11), (15, 17), 24, 52, SCALE, 4)
        xo, zo, yj, zf = 30, 106, 24.5, 99
    paint_scaled(g, start, 5, seed=1)
    joint = (g.a > 0) & (np.abs(X - (CX + s * xo)) < 10) & (np.abs(Z - zo) < 11) & (np.abs(Y - yj) < 0.6)
    P.flat(g, joint, SCALE, 2)
    # the big foot with toes and claws
    xc = CX + s * (27 if fore else 28)
    f0 = len(g.solids)
    plan(g, chamfer_rect(xc - 11, zf, xc + 11, zf + 26, 3.5), 0, 10, SCALE, 3, top=chamfer_rect(xc - 9, zf + 4, xc + 9, zf + 23, 3))
    facet_paint(g, g.solids[f0:], lambda gg, mm, fr: scales(gg, mm, fr, SCALE, 4, 4, 14, seed=2))
    foot = g.solids[-1].mask(g.shape)
    for k in (-1, 1):  # toe splits (painted)
        P.flat(g, foot & (np.abs(X - (xc + k * 3.6)) < 0.6) & (Z < zf + 9), SCALE, 1)
    claws(g, xc, zf, 3, 7.2)
    return g


NECK = ([38, 56, 78], [68, 60, 50])  # y levels and z centres of the neck


def neck() -> Grid:
    """The neck and the big caricature head (the jaw is its own part)."""
    g = Grid(*S)
    X, Y, Z = xyz()
    start = len(g.solids)
    yseg(g, (CX, 68), (CX, 60), (14, 14), (13, 13), 38, 56, SCALE, 4)
    yseg(g, (CX, 60), (CX, 50), (13, 13), (12.5, 12.5), 56, 78, SCALE, 4)
    zc = np.interp(Y, *NECK)
    throat = (Z < zc - 5) & (np.abs(X - CX) < 10) & (Y < 76)
    paint_scaled(g, start, 5, seed=3, belly=throat)
    P.flat(g, (g.a > 0) & throat & (np.abs(np.abs(X - CX) - 9.5) < 0.6), "gold", 4)
    P.darken(g, (g.a > 0) & (Z > zc + 7) & (np.abs(X - CX) < 7))
    for yb, h in ((50, 12), (64, 12), (76, 10)):  # spikes on the back of the neck
        zb = float(np.interp(yb, *NECK)) + 12.0
        side(g, [(yb - 6, zb - 3), (yb + 4, zb - 3), (yb + 1, zb + h)], CX - 2.5, CX + 2.5, HORN, 6)
        P.flat(g, last(g) & (Z > zb + h * 0.55), HORN, 7)
    # head: a big cranium and a tapered snout (chamfered frustums), a jutting brow
    h0 = len(g.solids)
    zseg(g, (CX, 92), (CX, 90), (21, 19), (17, 14), 16, 50, SCALE, 4, ch=0.45)
    zseg(g, (CX, 84), (CX, 88), (13, 9), (17, 13), 0.5, 20, SCALE, 4, ch=0.45)
    paint_scaled(g, h0, 5, 4, 14, seed=4)
    b0 = len(g.solids)
    brow = front(g, [(CX - 24, 110), (CX - 24, 117), (CX, 111), (CX + 24, 117), (CX + 24, 110), (CX, 105)], 10.5, 21, SCALE, 3)
    facet_paint(g, g.solids[b0:], lambda gg, mm, fr: scales(gg, mm, fr, SCALE, 4, 4, 14, seed=5))
    lower = 105 + np.abs(X - CX) * 5 / 24
    P.flat(g, brow & (Z < 11.5) & (Y < lower + 1.5), SCALE, 1)  # the brow's shadow line
    head = (g.a > 0) & (Y > 70)
    snout = head & (Z < 16)
    # nostrils, a lighter muzzle and cream lips
    P.flat(g, snout & (Z < 1.5) & (np.abs(np.abs(X - CX) - 6) < 2.6) & (Y > 84) & (Y < 89), "darkwood", 2)
    P.flat(g, snout & (Z < 1.5) & (np.abs(np.abs(X - CX) - 6) < 2.6) & (Y > 88) & (Y < 90), SCALE, 2)
    P.flat(g, snout & (Y < 79), SCALE, 5)
    P.flat(g, head & (Y < 76.5) & (Z < 44), "sand", 5)
    # huge gold slit eyes on the face, bulging out of the cranium front under
    # the angry brow (rule K3); rows read as seen from the front
    eye = {"d": C(SCALE, 1), "y": C("gold", 7), "o": C("gold", 5), "p": C("darkwood", 1), "w": C(HORN, 7), "e": C("ember", 6)}
    for s in (-1, 1):
        xa, xb = sorted((CX + s * 6.5, CX + s * 22.5))
        front(g, [(xa + 2, 98), (xb - 2, 98), (xb, 100), (xb, 110), (xb - 2, 112), (xa + 2, 112), (xa, 110), (xa, 100)], 13, 17.5, "gold", 6)
    half = ["..dddddddddddd..",
            ".dwwyyyyyyyyyod.",
            "dwwyyyppppyyyood",
            "dwyyypppppyyyood",
            "dyyyyyppppyyyood",
            "dyyyyppppyyyoood",
            "dyyyyppppyyyoood",
            "doyyyyppppyoooed",
            "deoyyyppppyoeeed",
            ".deeooopppoeeed.",
            "..deeeeeeeeeed..",
            "...dddddddddd..."]
    rows = [r + "." * 12 + r[::-1] for r in half]
    pnglyph.stamp(g, "-z", 13, CX - 22, 99, rows, eye, depth=2)
    # horns: two thick swept-back spikes, banded
    horns = np.zeros(S, dtype=bool)
    for s in (-1, 1):
        x0, x1 = sorted((CX + s * 9, CX + s * 17))
        xh = CX + s * 13
        horns |= zseg(g, (xh, 104), (xh + s * 3, 113), (4.5, 5.5), (3.4, 4.0), 36, 58, HORN, 6, ch=0.4)
        horns |= zseg(g, (xh + s * 3, 113), (xh + s * 5, 121), (3.4, 4.0), (0.8, 0.8), 58, 80, HORN, 6, ch=0.3)
    P.flat(g, horns & (np.floor(Z).astype(int) % 7 == 0), HORN, 4)
    P.flat(g, horns & (Z > 70), HORN, 7)
    # cheek frills: two fins per side, flaring out and back
    for s in (-1, 1):
        for (ya, yb, yt, xo) in ((79, 94, 83, 15), (96, 106, 104, 12)):
            front(g, [(CX + s * 19, ya), (CX + s * 19, yb), (CX + s * (19 + xo), yt)], 34, 46, HORN, 6)
            P.flat(g, last(g) & (np.abs(X - CX) > 19 + xo * 0.6), HORN, 7)
    # big upper fangs hanging in front of the jaw, side teeth along the lips
    for s in (-1, 1):
        front(g, [(CX + s * 11.5, 76.5), (CX + s * 6.0, 76.5), (CX + s * 8.8, 66.5)], 0.5, 4.0, HORN, 7)
        for zt in (9, 15, 21):
            xs = 12.6 + zt * 0.2
            x0, x1 = sorted((CX + s * (xs - 1.8), CX + s * (xs + 0.2)))
            side(g, [(76.5, zt - 2), (76.5, zt + 2), (72, zt + 0.3)], x0, x1, HORN, 7)
    # the mouth roof (seen when the jaw opens): dark red with an ember glow deep inside
    roof = head & (Y < 77) & (np.abs(X - CX) < 10) & (Z > 4) & (Z < 38)
    P.flat(g, roof, SCALE, 1)
    P.flat(g, roof & (Z > 26), "ember", 5)
    return g


def jaw() -> Grid:
    g = Grid(*S)
    X, Y, Z = xyz()
    start = len(g.solids)
    zseg(g, (CX, 70.0), (CX, 69.5), (11, 5), (15, 5.5), 2, 42, SCALE, 4, ch=0.5)
    chin = Y < 67.5
    paint_scaled(g, start, 5, 4, 14, seed=6, belly=chin, plate_row=4)
    m = g.a > 0
    mouth = m & (Y > 73.5) & (np.abs(X - CX) < 10.5) & (Z > 4)
    P.flat(g, mouth, SCALE, 1)
    P.flat(g, mouth & (np.abs(X - CX) < 5), "magenta", 5)  # tongue
    P.flat(g, mouth & (Z > 26), "ember", 6)  # fire in the throat
    # oversized lower fangs outside the lips (caricature), small teeth between
    for s in (-1, 1):
        x0, x1 = sorted((CX + s * 13.0, CX + s * 17.0))
        side(g, [(74, 4), (74, 11), (85, 7.5)], x0, x1, HORN, 7)
        P.flat(g, last(g) & (Y < 76), HORN, 5)
        for zt in (18, 25):
            x0, x1 = sorted((CX + s * 11.5, CX + s * 14.0))
            side(g, [(75, zt - 2), (75, zt + 2), (79, zt)], x0, x1, HORN, 7)
    return g


TAIL = [((CX, 40), (13, 10), 122), ((CX + 3, 34), (10.5, 8.5), 142), ((CX + 10, 26), (8, 6.5), 158),
        ((CX + 20, 19), (5.8, 4.8), 172), ((CX + 31, 15), (3.6, 3.2), 183)]


def tail() -> Grid:
    g = Grid(*S)
    X, Y, Z = xyz()
    start = len(g.solids)
    for (c0, r0, z0), (c1, r1, z1) in zip(TAIL, TAIL[1:]):
        zseg(g, c0, c1, r0, r1, z0, z1, SCALE, 4)
    under = np.zeros(S, dtype=bool)
    for (c0, r0, z0), (c1, r1, z1) in zip(TAIL, TAIL[1:]):
        f = np.clip((Z - z0) / (z1 - z0), 0, 1)
        yc = c0[1] + (c1[1] - c0[1]) * f
        ry = r0[1] + (r1[1] - r0[1]) * f
        under |= (Z >= z0) & (Z < z1) & (Y < yc - ry * 0.45)
    paint_scaled(g, start, 5, 5, 14, seed=7, belly=under)
    P.darken(g, (g.a > 0) & ~under & (Y > 38) & (np.abs(X - CX) < 6))
    # A faceted side-profile barb keeps a pointed silhouette in every view.
    barb = side(g, [(11, 180), (19, 180), (22, 186), (15, 197), (8, 186)], CX + 27, CX + 35, HORN, 6)
    P.flat(g, barb & (Y < 11), HORN, 4)
    P.flat(g, barb & (Y > 18), HORN, 7)
    P.flat(g, barb & (Z > 192), HORN, 7)
    # tail spikes, shrinking
    for zb, h in ((130, 10), (145, 8), (157, 6)):
        k = 0 if zb < 142 else (1 if zb < 158 else 2)
        (c0, r0, z0), (c1, r1, z1) = TAIL[k], TAIL[k + 1]
        f = (zb - z0) / (z1 - z0)
        yc = c0[1] + (c1[1] - c0[1]) * f + r0[1] + (r1[1] - r0[1]) * f
        xc = c0[0] + (c1[0] - c0[0]) * f
        spike(g, zb, yc - 1, h, half=4.5, lean=5.0, x0=xc - 2, x1=xc + 2)
    return g


def wing(s: int) -> Grid:
    """A raised bat wing with a thick scalloped membrane and finger bones."""
    g = Grid(*S)
    X, Y, Z = xyz()
    y0, y1 = 56.0, 65.0
    sh = (CX + s * 15.0, 70.0)
    wr = (CX + s * 52.0, 57.0)
    tips = [(CX + s * 93.0, 80.0), (CX + s * 85.0, 106.0), (CX + s * 64.0, 124.0)]
    root = (CX + s * 17.0, 104.0)
    poly = [sh, wr, tips[0]]
    chain = tips + [root]
    for a, b in zip(chain, chain[1:]):
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        pull = 0.24 if b is not root else 0.12
        poly += [(mid[0] + (wr[0] - mid[0]) * pull, mid[1] + (wr[1] - mid[1]) * pull), b]
    mem = plan(g, poly, y0, y1, WEB, 5)
    # panels between the fingers alternate one shade (painted as sectors)
    ang = np.arctan2(Z - wr[1], (X - wr[0]) * s)
    cuts = sorted(math.atan2(t[1] - wr[1], (t[0] - wr[0]) * s) for t in tips)
    sector = np.searchsorted(np.array(cuts, dtype=np.float32), ang)
    P.flat(g, mem & (sector % 2 == 1), WEB, 6)
    # a dark rim on the free edges (2D erosion of the membrane)
    col = mem.any(axis=1)
    inner = col.copy()
    for ax in (0, 1):
        for step in (1, -1):
            inner &= np.roll(col, step, axis=ax)
    rim = col & ~(inner & np.roll(inner, 1, axis=0) & np.roll(inner, -1, axis=0) & np.roll(inner, 1, axis=1) & np.roll(inner, -1, axis=1))
    P.flat(g, mem & rim[:, None, :], SCALE, 3)
    # veins: a lighter line down the middle of each panel
    mids = [(cuts[k] + cuts[k + 1]) / 2 for k in range(len(cuts) - 1)]
    for a in mids:
        P.flat(g, mem & (np.abs(ang - a) < 0.035) & ~rim[:, None, :], WEB, 7)
    # bones: a thick arm to the wrist, fingers to the tips (red, faceted)
    bones = plan(g, quad(sh, wr, 5.0, 3.6), 55.5, 65.5, SCALE, 3)
    for t in tips:
        bones |= plan(g, quad(wr, t, 2.8, 1.3, cap=0.8), 56, 65, SCALE, 3)
    bones |= plan(g, chamfer_rect(wr[0] - 4.5, wr[1] - 4.5, wr[0] + 4.5, wr[1] + 4.5, 1.8), 55.5, 66, SCALE, 3)
    P.flat(g, bones & (Y > 62.5), SCALE, 4)
    P.flat(g, bones & (Y < 58.5), SCALE, 2)
    # the thumb claw at the wrist and small claws at the finger tips
    plan(g, quad((wr[0] + s * 1, wr[1] - 2), (wr[0] + s * 3, wr[1] - 12), 2.4, 0.5, cap=1.0), 58, 63.5, HORN, 7)
    for t in tips:
        dx, dz = t[0] - wr[0], t[1] - wr[1]
        n = math.hypot(dx, dz)
        plan(g, quad(t, (t[0] + dx / n * 6, t[1] + dz / n * 6), 1.6, 0.3, cap=1.0), 59, 62, HORN, 7)
    return g


# ------------------------------------------------------------------ clips
def about(q, pivot, deg_z: float, extra=(0.0, 0.0, 0.0)):
    """A `loc` offset that makes a z rotation about `pivot` act about q."""
    a = math.radians(deg_z)
    dx, dy = pivot[0] - q[0], pivot[1] - q[1]
    rx, ry = dx * math.cos(a) - dy * math.sin(a), dx * math.sin(a) + dy * math.cos(a)
    return (rx + q[0] - pivot[0] + extra[0], ry + q[1] - pivot[1] + extra[1], extra[2])


def keyed(root, clip: dict) -> dict:
    """Give every part with a grid a rest key in the clip, so a viewer that
    plays one clip per part never keeps a pose from another clip."""
    for part in root.walk():
        if part.grid is not None and part.name not in clip:
            clip[part.name] = {"rot": keys((0, 0, 0, 0))}
    return clip


def move(root, to_root):
    """A heavy prowl in 1.6 s (one stride, keyed a frame at a time): a slow
    four-beat walk (left hind, left fore, right hind, right fore), each foot
    lifted heavily, held, then dropped into the floor accelerating, and
    planted, sliding back at the ground speed. Every footfall jolts the body
    down (it keeps sinking 2 frames past contact, then stops dead) before it
    heaves on; the weight rolls and swings over the planted side. The neck
    is carried low and forward and sways against the body, nodding a
    frame or two after each jolt; the tail swings the other way behind; the
    folded wings jolt on each footfall."""
    N = 48
    legs = {"leg-bl": (0.125, 1), "leg-fl": (0.375, 1), "leg-br": (0.625, 1), "leg-fr": (0.875, 1)}  # no footfall on the seam
    beat = N // 4
    jolt = [(0, 0.0), (1, -0.4), (2, -1.2), (3, -1.0), (4, -1.1), (6, -0.9), (beat, 0.0)]
    centre = to_root((98, 40.0, 82.0))

    def d_of(f):
        return (f - N / 8) % beat

    def sway(f):  # + while the left side carries it
        return math.sin(2 * math.pi * (f - N / 8 - beat) / N)

    def body(f, _):
        return {"rot": (-1.5 + 0.8 * lerp(jolt, d_of(f)), 3.0 * sway(f), 2.0 * sway(f) + 0.6 * lerp(jolt, d_of(f)) * (1 if sway(f) > 0 else -1)),
                "pivot": centre, "dy": 1.2 * lerp(jolt, d_of(f))}

    rig = Rig(root, "body", list(legs))
    keys, info = gait(rig, N, legs, stride=16.0, duty=0.7, lift=heavy_lift(5.0, hang=0.15, drop=0.3), body=body, lean=0.85, xlock=True, smooth_passes=3)

    def lag(f, k):
        return lerp(jolt, d_of(f - k)) / 1.2  # 0 .. -1
    keys["neck"] = {"rot": wave_keys(N, lambda f: (-4.0 + 4.0 * lag(f, 2), -4.5 * sway(f - 4), 0.0))}
    keys["jaw"] = {"rot": wave_keys(N, lambda f: (-2.0 - 2.0 * lag(f, 3), 0.0, 0.0))}
    keys["tail"] = {"rot": wave_keys(N, lambda f: (2.0 * lag(f, 3), -7.0 * sway(f - 6), 0.0))}
    keys["wing-l"] = {"rot": wave_keys(N, lambda f: (0.0, 0.0, 4.0 * lag(f, 2)))}
    keys["wing-r"] = {"rot": wave_keys(N, lambda f: (0.0, 0.0, -4.0 * lag(f, 2)))}
    return keys


def build():
    parts = [("dragon", None, None, None),
             ("body", body(), BODY_HINGE, None),
             ("neck", neck(), NECK_HINGE, "body"),
             ("jaw", jaw(), JAW_HINGE, "neck"),
             ("tail", tail(), TAIL_HINGE, "body"),
             ("wing-l", wing(-1), WING_HINGE[-1], "body"),
             ("wing-r", wing(1), WING_HINGE[1], "body")]
    parts += [(name, leg(name), LEG_HINGE[name], "body") for name in LEGS]
    root, to_root = rig(parts)
    for part in root.walk():
        if part.name == "wing-l":
            part.rot = WING_REST[-1]
        elif part.name == "wing-r":
            part.rot = WING_REST[1]
        elif part.name == "neck":
            # Break the symmetric side-face overlap with the torso at rest.
            part.at = (part.at[0] + 0.5, part.at[1], part.at[2])
    z = (0, 0, 0, 0)
    idle = {"body": {"scale": keys((0, 1, 1, 1), (1.5, 1.02, 1.035, 1.015), (3.0, 1, 1, 1))},
            "neck": {"rot": keys(z, (1.0, -3, 6, 0), (2.0, 2, -5, 0), (3.0, 0, 0, 0))},
            "jaw": {"rot": keys(z, (1.2, 0, 0, 0), (1.5, -9, 0, 0), (1.9, 0, 0, 0), (3.0, 0, 0, 0))},
            "tail": {"rot": keys(z, (1.5, 0, -9, 0), (3.0, 0, 0, 0))},
            "wing-l": {"rot": keys(z, (1.5, 0, 0, -9), (3.0, 0, 0, 0))},
            "wing-r": {"rot": keys(z, (1.5, 0, 0, 9), (3.0, 0, 0, 0))}}
    f = 1 / 30

    def fk(*rows):
        """Keys from (frame, x, y, z) rows."""
        return [(fr * f, (x, y, w)) for fr, x, y, w in rows]

    def plant(dz):  # a planted leg (44 voxels hip to sole) turns as the body slides by dz
        return math.degrees(math.asin(dz / 44.0))

    def rock(dz):  # the long tilted foot rocks onto its heel or toes: lift the body that much
        return 0.3 * abs(dz)

    # The fire breath. Inhale (f0-16, the anticipation): the body draws
    # back, the chest swells, the neck rears high and back, the wings flare
    # up and open and the tail cocks. Strike (impact f20): the body lurches
    # forward and the head drives down and forward with the jaw flung wide,
    # the wings snap forward. Then the spray (secondary action): the head
    # sweeps the fire across in a wide arc and back, shaking as it goes,
    # the body and the tail countering each sweep; the jaw shuts and it
    # settles with weight. Feet stay planted.
    BREATH = 20
    bz = [(0, 0.0), (8, 3.0), (16, 4.0), (BREATH, -4.0), (24, -4.6), (34, -4.0), (44, -3.6), (52, 0.6), (60, 0.0)]
    sweep = [(0, 0, 0, 0), (8, 18, 0, 0), (14, 26, 0, 0), (16, 28, 0, 0), (BREATH, -16, 0, 0), (23, -18, -10, 5), (26, -14, -26, -6),
             (29, -18, -40, 6), (32, -13, -16, -6), (35, -17, 16, 6), (38, -13, 40, -6), (41, -17, 22, 5), (44, -14, 0, 0), (52, 3, 0, 0), (60, 0, 0, 0)]
    attack = {"body": {"loc": fk(*[(fr, 0, 0, dz) for fr, dz in bz]),
                       "rot": fk((0, 0, 0, 0), (BREATH, 0, 0, 0), (29, 0, 10, 0), (38, 0, -10, 0), (44, 0, 0, 0), (60, 0, 0, 0)),
                       "scale": fk((0, 1, 1, 1), (8, 1.04, 1, 1.01), (16, 1.07, 1, 1.02), (BREATH, 0.98, 1, 1.0), (26, 1, 1, 1), (60, 1, 1, 1))},  # the chest swells (x/z only: y would stretch the legs)
              # the neck swings sideways with the sweep and the head rolls into it, so the arc reads from the front too
              "neck": {"rot": fk(*[(fr, x, y, w - y * 0.3) for fr, x, y, w in sweep]),
                       "loc": fk(*[(fr, -y * 0.22, 0, 0) for fr, x, y, w in sweep])},
              "jaw": {"rot": fk((0, 0, 0, 0), (8, -6, 0, 0), (16, -10, 0, 0), (18, -30, 0, 0), (BREATH, -44, 0, 0), (26, -38, 0, 0), (32, -44, 0, 0),
                                (38, -38, 0, 0), (44, -42, 0, 0), (49, -2, 0, 0), (52, -6, 0, 0), (60, 0, 0, 0))},
              "wing-l": {"rot": fk((0, 0, 0, 0), (8, 0, -6, -24), (16, 0, -8, -32), (BREATH, 0, 14, 22), (24, 0, 16, 26), (32, 0, 10, 16), (44, 0, 8, 12),
                                   (52, 0, -2, -4), (60, 0, 0, 0))},
              "wing-r": {"rot": fk((0, 0, 0, 0), (8, 0, 6, 24), (16, 0, 8, 32), (BREATH, 0, -14, -22), (24, 0, -16, -26), (32, 0, -10, -16), (44, 0, -8, -12),
                                   (52, 0, 2, 4), (60, 0, 0, 0))},
              "tail": {"rot": fk((0, 0, 0, 0), (8, -6, 10, 0), (16, -8, 16, 0), (BREATH, 4, -12, 0), (27, 2, 14, 0), (34, 0, -10, 0), (41, 0, 14, 0),
                                 (48, 0, -8, 0), (55, 0, 3, 0), (60, 0, 0, 0))}}
    feet = Planter(root, "body", list(LEGS), top="dragon")
    always = {name: [(0, 1.0)] for name in LEGS}
    attack = keyed(root, bake(attack, BREATH, feet, always))  # the feet are solved a frame at a time
    # hit: a heavy blow shoves it back and up off its feet, rolling it away
    # from the strike, the neck whipped back, the wings blown up and the
    # tail flung; it lands with a squash, holds a stunned beat, then
    # recovers with weight (the head dips past rest, the wings sag).
    hit = {"dragon": {"scale": fk((0, 1, 1, 1), (4, 0.98, 1.04, 1.0), (8, 1.05, 0.9, 1.03), (11, 1.01, 0.98, 1.0), (16, 1, 1, 1), (21, 1.02, 0.96, 1.01),
                                  (26, 1, 1, 1), (34, 1, 1, 1))},
           "body": {"loc": fk((0, 0, 0, 0), (2, 0, 3.2, 3.0), (4, 0, 4.6, 5.0), (6, 0, 3.4, 6.0), (8, 0, 0, 6.5), (11, 0, 0, 7.0), (16, 0, 0, 6.6), (22, 0, 0, 1.5),
                             (27, 0, 0, -0.6), (34, 0, 0, 0)),
                    "rot": fk((0, 0, 0, 0), (4, 0, 0, -2.5), (8, 0, 0, -1), (11, 0, 0, 0), (34, 0, 0, 0))},
           "neck": {"rot": fk((0, 0, 0, 0), (4, 30, -18, 8), (8, 22, -12, 6), (12, 20, -12, 5), (16, 22, -14, 6), (22, -10, 4, -2), (28, 3, 0, 0), (34, 0, 0, 0))},
           "jaw": {"rot": fk((0, 0, 0, 0), (4, -30, 0, 0), (8, -18, 0, 0), (16, -22, 0, 0), (22, -4, 0, 0), (27, -8, 0, 0), (34, 0, 0, 0))},
           "wing-l": {"rot": fk((0, 0, 0, 0), (4, 0, -10, -32), (9, 0, -6, -20), (16, 0, -6, -22), (22, 0, 4, 10), (28, 0, -1, -2), (34, 0, 0, 0))},
           "wing-r": {"rot": fk((0, 0, 0, 0), (4, 0, 10, 32), (9, 0, 6, 20), (16, 0, 6, 22), (22, 0, -4, -10), (28, 0, 1, 2), (34, 0, 0, 0))},
           "tail": {"rot": fk((0, 0, 0, 0), (5, -16, 24, 0), (10, -6, 12, 0), (16, -8, 16, 0), (23, 4, -10, 0), (29, 0, 3, 0), (34, 0, 0, 0))}}
    for name in LEGS:  # the feet trail the shove, then land
        hit[name] = {"rot": fk((0, 0, 0, 0), (34, 0, 0, 0))}
    # the soles keep their spot through the shove (the legs trail) and the
    # body leans back over them, then comes forward over them past rest; the
    # pop leaves the floor from f1 to f7
    hit = keyed(root, bake(hit, None, feet, always, lift=[(0, 1.0), (1, 0.0), (7, 0.0), (8, 1.0)]))
    def tf(fr, anchors=((0, 0), (6, 4), (12, 6), (18, 7), (30, 17), (52, 34))):
        """Re-time a death beat: a short catch at the top, then one fast,
        hard-accelerating fall (10 frames) and a short settle."""
        for (a0, b0), (a1, b1) in zip(anchors, anchors[1:]):
            if a0 <= fr <= a1:
                return round(b0 + (b1 - b0) * (fr - a0) / (a1 - a0))
        return fr + anchors[-1][1] - anchors[-1][0]

    def dk(*rows):
        return fk(*[(tf(fr), x, y, w) for fr, x, y, w in rows])

    # death: it rears from the blow with the wings thrown open, teeters,
    # then the legs give way and splay out flat, the front pair reaching
    # forward and the hind pair back, and the barrel crumbles straight down
    # onto its belly, accelerating into the floor (impact f30) with a splat;
    # one small bounce and settle. The neck is held up a beat and then
    # slams its head down, the jaw drops open, the wings flop down onto the
    # ground and the tail slaps last.
    LAND = 30
    DROP = -20.0
    death = {"dragon": {"scale": dk((0, 1, 1, 1), (29, 1, 1, 1), (LAND, 1.06, 0.9, 1.04), (33, 0.99, 1.02, 0.99), (36, 1, 1, 1), (52, 1, 1, 1))},  # the thud
             "body": {"loc": dk((0, 0, 0, 0), (6, 0, 0, 2.0), (12, 0, 0, 2.4), (18, 0, -0.5, 2.0), (LAND, 0, DROP, 1.0), (34, 0, DROP + 1.0, 1.0),
                                (38, 0, DROP, 1.0), (52, 0, DROP, 1.0)),
                      "rot": dk((0, 0, 0, 0), (6, 0, 0, 3), (12, 0, 0, -3), (18, 0, 0, -1), (LAND, 0, 0, 0), (52, 0, 0, 0)),
                      "scale": dk((0, 1, 1, 1), (18, 1, 1, 1), (LAND, 1.05, 1.0, 1.03), (33, 0.99, 1.0, 1.0), (37, 1.0, 1.0, 1.0), (52, 1, 1, 1))},
             "neck": {"rot": dk((0, 0, 0, 0), (6, 20, -6, 0), (12, 18, 8, 0), (20, 12, 4, 0), (LAND, 6, 0, 0), (35, -34, -8, 6), (39, -26, -8, 5),
                                (44, -33, -12, 7), (52, -32, -12, 7))},
             "jaw": {"rot": dk((0, 0, 0, 0), (6, -24, 0, 0), (14, -8, 0, 0), (LAND, -6, 0, 0), (35, 0, 0, 0), (39, -26, 0, 0), (44, -16, 0, 0), (52, -18, 0, 0))},
             "wing-l": {"rot": dk((0, 0, 0, 0), (6, 0, -8, -26), (12, 0, -6, -20), (LAND, 0, 0, 10), (36, 0, 4, 44), (40, 0, 4, 36), (46, 0, 4, 42), (52, 0, 4, 41))},
             "wing-r": {"rot": dk((0, 0, 0, 0), (6, 0, 8, 26), (12, 0, 6, 20), (LAND, 0, 0, -10), (36, 0, -4, -44), (40, 0, -4, -36), (46, 0, -4, -42), (52, 0, -4, -41))},
             "tail": {"rot": dk((0, 0, 0, 0), (6, -10, -8, 0), (14, -14, 6, 0), (LAND, -26, 10, 0), (38, -16, 16, 0), (41, -22, 14, 0), (46, -17, 15, 0), (52, -18, 15, 0))}}
    f0, f1 = tf(18), tf(LAND)  # the fall: from the top to the impact
    for name, (sx, fore) in LEGS.items():  # the flinch: the legs brace a little
        death[name] = {"rot": dk((0, 0, 0, 0), (6, 0, 0, sx * 2), (12, 0, 0, sx * 1), (18, 0, 0, sx * 3), (52, 0, 0, sx * 3))}
    # Sample the whole death a frame at a time on one eased curve, then set
    # each leg's splay from the barrel's height on that same frame: the least
    # splay that keeps the sole out of the floor, so the feet slide out along
    # the floor exactly as fast as the barrel drops (no fighting, no hitch).
    # Through the bounce the legs keep the impact splay and go up with it.
    spec = {part: {ch: [(round(t / f), v) for t, v in ks] for ch, ks in chans.items()} for part, chans in death.items()}
    end = max(fr for chans in spec.values() for ks in chans.values() for fr, _ in ks)
    smp = sample(spec, end, f1, power=2.6)  # the barrel slams in at 2.6x its mean speed
    for name, (sx, fore) in LEGS.items():
        ya = sx * (1 if fore else -1) * 18.0  # the front pair reach forward, the hind pair back
        seq = smp[name]["rot"]
        fs = tf(12)  # the barrel starts to sink here: the legs give from here on
        for fr in range(fs, end + 1):
            if f1 < fr <= f1 + 6:
                seq[fr] = seq[f1].copy()
                continue
            loc, rot, sc = (smp["body"][ch][fr] for ch in ("loc", "rot", "scale"))
            rot = np.array((rot[0], rot[1], 0.0))  # splay for the drop only: the teeter's roll is the export's to lift
            u = min(1.0, max(0.0, (fr - fs) / (f1 - fs)))
            give = 0.3 + 0.9 * (1 - u) ** 2  # the big feet roll on their edges as the splay starts: let them dig in a little early on
            lo, hi = 2.0, 89.0
            for _ in range(30):
                m = (lo + hi) / 2
                if feet._world(name, loc, rot, sc, (0.0, ya * m / 78.0, sx * m), feet._top(smp, fr))[0] < -give:
                    lo = m
                else:
                    hi = m
            seq[fr] = np.array((0.0, ya * hi / 78.0, sx * hi))
        # the feet rock on their edges as the splay starts, so the raw solve
        # wobbles: keep the splay growing and smooth it (the export lifts any
        # small dig)
        ms = [abs(seq[fr][2]) for fr in range(fs - 1, f1 + 1)]
        for i in range(1, len(ms)):
            ms[i] = max(ms[i], ms[i - 1])
        sm = [ms[0]] + [(ms[i - 1] + 2 * ms[i] + ms[i + 1]) / 4 for i in range(1, len(ms) - 1)] + [ms[-1]]
        for i, fr in enumerate(range(fs - 1, f1 + 1)):
            seq[fr] = np.array((0.0, ya * sm[i] / 78.0, sx * sm[i]))
    death = keyed(root, per_frame(smp))
    mouth = to_root((CX, 75.0, 0.0))
    return asset("creatures", "dragon", "Crimson Wyrm", root,
                 clips=[Clip("idle", keyed(root, idle)), Clip("move", keyed(root, move(root, to_root)), ease=0, floor=False), Clip("attack", attack, loop=False, impact=BREATH * f, ease=0.0), Clip("hit", hit, loop=False, ease=0.0),
                        Clip("death", death, loop=False, impact=tf(LAND) * f, ease=0.0)],
                 sockets=[Socket("socket-mouth", at=mouth, parent="neck")],
                 fx=[pfx("rvx-fantasy-dragon-breath", "socket-mouth", "clip:attack", size=80, aim=(0.0, -0.243, -0.97), at=BREATH * f)])
