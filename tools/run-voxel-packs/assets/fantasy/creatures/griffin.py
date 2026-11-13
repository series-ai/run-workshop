"""Griffin in the Pirate Nation creature style.

A chunky caricature after the PN world bosses and totems: a big white
eagle head with huge gold eyes that bulge out of the face, an angry brown
brow, a big hooked gold beak and a royal-blue tipped crest; a white feather
collar; a brown feathered chest on thick yellow scaly legs with big dark
talons; golden lion haunches, paws and a tail with a dark tuft; two big
feathered wings raised in a heraldic V (flat faceted panels: brown
coverts, barred flight feathers with cream tips). The detail is paint:
feather rows, fur strokes, scaly legs. About 96 wide and 72 tall.

Clips: idle (breathe, look around, flex the wings, swish the tail),
attack (rear up with the wings flared, then strike down with the beak: a
spark at the beak socket), hit (head snaps back, wings jolt), death
(rolls onto its left side). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _life import C, Clip, Grid, Socket, asset, chamfer_rect, facet_paint, front, keys, last, pfx, plan, rig, side
from pnshapes import quad

S = (124, 84, 100)
CX = 62
FEATHER, LION, WHITE, LEG, BEAK = "wood", "gold", "bone", "gold", "gold"
BODY_HINGE = (CX, 0.0, 62.0)
HEAD_HINGE = (CX, 38.0, 28.0)
TAIL_HINGE = (CX, 33.0, 75.0)
WING_HINGE = {-1: (CX - 11.0, 40.0, 32.0), 1: (CX + 11.0, 40.0, 32.0)}
WING_REST = {-1: (0.0, 12.0, -40.0), 1: (0.0, -12.0, 40.0)}

_XYZ = None


def xyz():
    """Voxel-centre coordinates of the shared grid (float32, computed once)."""
    global _XYZ
    if _XYZ is None:
        _XYZ = np.meshgrid(*(np.arange(n, dtype=np.float32) + 0.5 for n in S), indexing="ij")
    return _XYZ


# ------------------------------------------------------------------ local shapes and paint
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


def feathers(g: Grid, m: np.ndarray, frame, ramp: str, base: int, width: int = 6, row: int = 4, seed: int = 0) -> None:
    """Painted feather rows on one face: offset rows of round-tipped
    feathers (a darker U-shaped tip line, a lighter quill in the middle),
    a few feathers one shade lighter (cells, not speckle). Follows the face
    frame on slopes."""
    U, V = P.uv(g, frame)
    r = V // row
    u = U + (r % 2) * (width // 2)
    pu, pv = u % width, V % row
    cell = P._hash(r, u // width, seed=seed)
    shade = base + ((cell % np.uint64(5)) == 0).astype(np.int64)
    shade = np.where((pu == width // 2) & (pv < row - 1), base + 1, shade)
    tip = ((pv == row - 1) & (pu >= 1) & (pu <= width - 2)) | ((pv == row - 2) & ((pu == 0) | (pu == width - 1)))
    shade = np.where(tip, base - 1, shade)
    P._paint(g, m, ramp, np.clip(shade, 1, 7))


def paint_feathers(g: Grid, start: int, ramp: str, base: int, width: int = 6, row: int = 4, seed: int = 0) -> None:
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: feathers(gg, mm, fr, ramp, base, width, row, seed))


def scaly(g: Grid, m: np.ndarray, frame, ramp: str, base: int) -> None:
    """Bird-leg scales: rings of plates 3 tall with a dark line under each."""
    _U, V = P.uv(g, frame)
    P._paint(g, m, ramp, np.where(V % 3 == 2, base - 2, base))


def about(q, pivot, deg_z: float, extra=(0.0, 0.0, 0.0)):
    """A `loc` offset that makes a z rotation about `pivot` act about q."""
    a = math.radians(deg_z)
    dx, dy = pivot[0] - q[0], pivot[1] - q[1]
    rx, ry = dx * math.cos(a) - dy * math.sin(a), dx * math.sin(a) + dy * math.cos(a)
    return (rx + q[0] - pivot[0] + extra[0], ry + q[1] - pivot[1] + extra[1], extra[2])


# ------------------------------------------------------------------ parts
def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = xyz()
    start = len(g.solids)
    zseg(g, (CX, 31), (CX, 31), (12, 13), (15, 14), 16, 38, FEATHER, 4)
    zseg(g, (CX, 31), (CX, 30), (15, 14), (14, 12), 38, 60, LION, 5)
    zseg(g, (CX, 30), (CX, 31), (14, 12), (9, 8), 60, 76, LION, 5)
    trunk = g.a > 0
    # the feathered front half, with a ragged (painted) edge where the lion fur starts
    edge = 46 + 3 * (np.abs(np.sin(X * 0.9) + np.cos(Y * 0.7)) > 0.9)
    front_half = trunk & (Z < edge)

    def painter(gg, mm, fr):
        pnpaint.fur(gg, mm & ~front_half, LION, 5, frame=fr, seed=1)
        feathers(gg, mm & front_half, fr, FEATHER, 4, seed=2)
    facet_paint(g, g.solids[start:], painter)
    # a white feather bib on the chest front
    bib = trunk & (Z < 26) & (np.abs(X - CX) < np.minimum(9.5, (Y - 19) * 0.55)) & (Y > 20)
    facet_paint(g, g.solids[start:start + 1], lambda gg, mm, fr: feathers(gg, mm & bib, fr, "sand", 6, 5, 3, seed=3))
    P.flat(g, trunk & (Z >= 44) & (Y < 21), LION, 6)  # pale belly
    # front legs: yellow scaly shins, brown feather "trousers", big talons
    for s in (-1, 1):
        xl = CX + s * 9
        l0 = len(g.solids)
        yseg(g, (xl, 23), (xl, 25), (3.6, 3.6), (4.4, 4.4), 4, 18, LEG, 6)
        facet_paint(g, g.solids[l0:], lambda gg, mm, fr: scaly(gg, mm, fr, LEG, 6))
        t0 = len(g.solids)
        yseg(g, (xl, 25), (xl, 27), (5.5, 5.5), (7, 7.5), 15, 30, FEATHER, 4)
        paint_feathers(g, t0, FEATHER, 4, 5, 3, seed=4 + s)
        f0 = len(g.solids)
        plan(g, chamfer_rect(xl - 5, 15, xl + 5, 28, 2), 0, 5, LEG, 6, top=chamfer_rect(xl - 4, 17, xl + 4, 27, 1.5))
        facet_paint(g, g.solids[f0:], lambda gg, mm, fr: scaly(gg, mm, fr, LEG, 6))
        for k in range(3):  # three big hooked talons forward, one back
            x = xl + (k - 1) * 3.4
            side(g, [(5, 17.5), (5, 14.5), (2.5, 11.5), (0, 11.2), (1.5, 15), (0.5, 17.5)], x - 1.2, x + 1.2, "stone", 2)
            P.flat(g, last(g) & (Y > 3.5), "stone", 3)
        side(g, [(4, 27), (4, 30), (0, 32), (1.5, 28)], xl - 1, xl + 1, "stone", 2)
    # hind legs: lion haunches and paws
    for s in (-1, 1):
        xl = CX + s * 11
        h0 = len(g.solids)
        yseg(g, (xl, 64), (xl, 70), (4.5, 4.5), (4, 4), 4, 14, LION, 5)
        yseg(g, (xl, 70), (xl - s * 1, 61), (4, 4), (8, 10), 14, 38, LION, 5)
        facet_paint(g, g.solids[h0:], lambda gg, mm, fr: pnpaint.fur(gg, mm, LION, 5, frame=fr, seed=5))
        p0 = len(g.solids)
        plan(g, chamfer_rect(xl - 5.5, 56, xl + 5.5, 69, 2.5), 0, 6, LION, 5, top=chamfer_rect(xl - 4.5, 58, xl + 4.5, 68, 2))
        facet_paint(g, g.solids[p0:], lambda gg, mm, fr: pnpaint.fur(gg, mm, LION, 5, frame=fr, seed=6))
        paw = g.solids[-1].mask(g.shape)
        for k in (-1, 1):  # toe splits and small claws
            P.flat(g, paw & (np.abs(X - (xl + k * 2.2)) < 0.6) & (Z < 62), LION, 3)
        for k in range(3):
            x = xl + (k - 1) * 3.2
            side(g, [(3, 57), (3, 55.5), (0.5, 54.5), (0.5, 57)], x - 0.8, x + 0.8, WHITE, 6)
    return g


def head() -> Grid:
    """The neck, the feather collar and the big eagle head."""
    g = Grid(*S)
    X, Y, Z = xyz()
    n0 = len(g.solids)
    yseg(g, (CX, 27), (CX, 21), (9, 9), (8.5, 8), 36, 54, WHITE, 6)
    paint_feathers(g, n0, WHITE, 6, 5, 3, seed=7)
    c0 = len(g.solids)
    collar = yseg(g, (CX, 28), (CX, 24), (14, 13), (9.5, 9), 34, 46, WHITE, 6, ch=0.35)
    paint_feathers(g, c0, WHITE, 5, 5, 4, seed=8)
    P.flat(g, collar & (Y < 35.5), WHITE, 4)
    k0 = len(g.solids)
    zseg(g, (CX, 58), (CX, 57), (11.5, 10), (10, 9), 11, 32, WHITE, 7, ch=0.45)
    paint_feathers(g, k0, WHITE, 6, 6, 4, seed=9)
    skull = g.solids[-1].mask(g.shape)
    P.flat(g, skull & (Y > 65) & (Z > 18), WHITE, 5)  # a soft shadow cap on the crown
    # a big hooked gold beak (upper: wide root, narrower hooked tip) and a lower beak
    side(g, [(60, 13), (60.5, 6), (52.5, 6), (52.5, 13)], CX - 6, CX + 6, BEAK, 6)
    side(g, [(60, 7), (57.5, 2.5), (53, 0.5), (48.5, 1.5), (50, 4.5), (52.5, 7)], CX - 4, CX + 4, BEAK, 6)
    side(g, [(52.5, 12), (52.5, 5.5), (50.5, 4.5), (48.5, 6.5), (49, 12)], CX - 4.5, CX + 4.5, BEAK, 5)
    beak = (g.a > 0) & (Z < 13) & (Y < 61) & (Y > 48) & ~skull
    P.flat(g, beak & (Y > 59.5), BEAK, 7)  # lit ridge
    P.flat(g, beak & (Y < 53) & (Y > 51.5) & (Z > 5), "darkwood", 2)  # the mouth line
    P.flat(g, beak & (Z < 4) & (Y < 51), "darkwood", 3)  # the dark hook tip
    P.flat(g, beak & (np.abs(np.abs(X - CX) - 2.5) < 0.9) & (Y > 57) & (Y < 59) & (Z > 7.5) & (Z < 10), "darkwood", 2)  # nostrils
    # huge gold eyes bulging out of the face, under an angry brown brow (rule K3)
    for s in (-1, 1):
        xa, xb = sorted((CX + s * 6, CX + s * 14))
        front(g, [(xa + 1.5, 55), (xb - 1.5, 55), (xb, 56.5), (xb, 63.5), (xb - 1.5, 65), (xa + 1.5, 65), (xa, 63.5), (xa, 56.5)], 8.5, 13, WHITE, 7)
    eye = {"d": C(FEATHER, 2), "y": C("gold", 7), "o": C("gold", 5), "p": C("darkwood", 1), "w": C(WHITE, 7)}
    half = ["..dddd..",
            ".dwwyyd.",
            "dwwyyyod",
            "dwyppyod",
            "dyyppyod",
            "doyppood",
            "dooyyood",
            ".doooed.",
            "..dddd.."]
    eye["e"] = C("gold", 4)
    rows = [r + "." * 12 + r[::-1] for r in half]
    pnglyph.stamp(g, "-z", 8.5, CX - 14, 56, rows, eye, depth=2)
    for s in (-1, 1):  # two angry brown brows slanting down to the beak
        b0 = len(g.solids)
        front(g, quad((CX + s * 3.5, 63.2), (CX + s * 15.5, 67.2), 1.9, 1.7), 7.5, 16, FEATHER, 3)
        paint_feathers(g, b0, FEATHER, 3, 4, 3, seed=10)
    # a crest of three swept-back feathers with royal-blue tips
    crest = np.zeros(S, dtype=bool)
    for x0, x1, p0, p1 in ((CX - 1.5, CX + 1.5, (65, 24), (77, 38)), (CX - 6, CX - 3, (64, 26), (73, 38)), (CX + 3, CX + 6, (64, 26), (73, 38))):
        crest |= side(g, quad(p0, p1, 2.6, 0.9, cap=1.2), x0, x1, WHITE, 7)
    P.flat(g, crest & (Z > 33), "blue", 5)
    P.flat(g, crest & (Z > 36), "blue", 6)
    # cheek tufts flaring back
    for s in (-1, 1):
        front(g, [(CX + s * 10, 50), (CX + s * 10, 60), (CX + s * 17, 52)], 22, 30, WHITE, 6)
    return g


def tail() -> Grid:
    g = Grid(*S)
    X, Y, Z = xyz()
    t0 = len(g.solids)
    zseg(g, (CX, 33), (CX + 1, 36), (3.2, 3.2), (2.6, 2.6), 72, 86, LION, 5)
    yseg(g, (CX + 1, 84.5), (CX + 3, 91), (2.6, 2.6), (2.2, 2.2), 34, 48, LION, 5)
    facet_paint(g, g.solids[t0:], lambda gg, mm, fr: pnpaint.fur(gg, mm, LION, 5, frame=fr, seed=11))
    u0 = len(g.solids)
    yseg(g, (CX + 3, 91), (CX + 4, 94), (4.5, 4.5), (1.2, 1.2), 46, 60, FEATHER, 3, ch=0.3)  # the dark tuft
    facet_paint(g, g.solids[u0:], lambda gg, mm, fr: pnpaint.fur(gg, mm, FEATHER, 3, frame=fr, seed=12))
    return g


def wing(s: int) -> Grid:
    """A feathered wing laid flat (the part's rest rotation raises it): a
    thick covert panel along the leading edge over a thinner panel of long
    flight feathers with a serrated trailing edge."""
    g = Grid(*S)
    X, Y, Z = xyz()
    sh = (CX + s * 9.0, 27.0)
    wr = (CX + s * 36.0, 23.0)
    tip = (CX + s * 60.0, 40.0)
    tips = [tip, (CX + s * 58.0, 49.0), (CX + s * 52.0, 57.0), (CX + s * 44.0, 63.0), (CX + s * 35.0, 67.0), (CX + s * 26.0, 67.0), (CX + s * 18.0, 63.0)]
    root = (CX + s * 10.0, 52.0)
    poly = [sh, wr]
    for a, b in zip(tips, tips[1:] + [root]):
        poly.append(a)
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        poly.append((mid[0] + (wr[0] - mid[0]) * 0.12, mid[1] + (wr[1] - mid[1]) * 0.12))
    poly.append(root)
    flight = plan(g, poly, 38.5, 41.5, FEATHER, 5)
    # flight feathers: long strips radiating from the wing root, dark shafts
    # between them, darker bars across and cream tips on the trailing edge
    hub = (CX + s * 12.0, 30.0)
    ang = np.arctan2(Z - hub[1], (X - hub[0]) * s)
    dist = np.hypot(X - hub[0], Z - hub[1])
    strip = np.floor(ang / 0.14).astype(np.int64)
    shade = 5 + (strip % 2)
    shade = np.where((np.floor(dist).astype(np.int64) % 7) < 2, 3, shade)
    P._paint(g, flight, FEATHER, shade)
    P.flat(g, flight & (np.abs(ang / 0.14 - np.round(ang / 0.14)) < 0.09), FEATHER, 2)
    col = flight.any(axis=1)
    inner = col.copy()
    for k in range(3):
        nxt = inner.copy()
        for ax in (0, 1):
            for step in (1, -1):
                nxt &= np.roll(inner, step, axis=ax)
        inner = nxt
    tips_m = flight & (col & ~inner)[:, None, :] & (dist > 26)[...]
    P.flat(g, tips_m, "sand", 6)
    # the covert panel: thicker, brown feather rows, a cream leading edge
    cov = [sh, wr, (CX + s * 50.0, 33.0), (CX + s * 42.0, 40.0), (CX + s * 30.0, 45.0), (CX + s * 18.0, 45.0), (CX + s * 10.0, 40.0)]
    c0 = len(g.solids)
    plan(g, cov, 37.5, 42.5, FEATHER, 4)
    facet_paint(g, g.solids[c0:], lambda gg, mm, fr: feathers(gg, mm, fr, FEATHER, 4, 5, 3, seed=13))
    arm = plan(g, quad(sh, wr, 3.2, 2.6), 37, 43, "gold", 5)
    arm |= plan(g, quad(wr, tip, 2.6, 1.0, cap=1.0), 37.5, 42.5, "gold", 5)
    P.flat(g, arm & (Y > 41.5), "gold", 6)
    P.flat(g, arm & (Y < 38.5), "gold", 4)
    return g


# ------------------------------------------------------------------ clips
def build():
    parts = [("griffin", None, None, None),
             ("body", body(), BODY_HINGE, None),
             ("head", head(), HEAD_HINGE, "body"),
             ("tail", tail(), TAIL_HINGE, "body"),
             ("wing-l", wing(-1), WING_HINGE[-1], "body"),
             ("wing-r", wing(1), WING_HINGE[1], "body")]
    root, to_root = rig(parts)
    for part in root.walk():
        if part.name in ("wing-l", "wing-r"):
            part.rot = WING_REST[-1 if part.name == "wing-l" else 1]
    z = (0, 0, 0, 0)
    idle = {"body": {"scale": keys((0, 1, 1, 1), (1.2, 1.02, 1.035, 1.01), (2.4, 1, 1, 1))},
            "head": {"rot": keys(z, (0.6, -4, 14, 4), (1.2, 0, 0, 0), (1.8, 3, -12, -3), (2.4, 0, 0, 0))},
            "wing-l": {"rot": keys(z, (1.2, 0, 4, -10), (2.4, 0, 0, 0))},
            "wing-r": {"rot": keys(z, (1.2, 0, -4, 10), (2.4, 0, 0, 0))},
            "tail": {"rot": keys(z, (0.6, 0, 18, 0), (1.8, 0, -18, 0), (2.4, 0, 0, 0))}}
    attack = {"body": {"rot": keys(z, (0.3, 16, 0, 0), (0.5, -6, 0, 0), (0.7, -6, 0, 0), (1.0, 0, 0, 0)),
                       "loc": keys(z, (0.3, 0, 2, 3), (0.5, 0, 0, -6), (0.7, 0, 0, -6), (1.0, 0, 0, 0))},
              "head": {"rot": keys(z, (0.3, 18, 0, 0), (0.5, -32, 0, 0), (0.7, -30, 0, 0), (1.0, 0, 0, 0))},
              "wing-l": {"rot": keys(z, (0.3, 0, -10, -30), (0.5, 0, 14, 22), (0.7, 0, 10, 18), (1.0, 0, 0, 0))},
              "wing-r": {"rot": keys(z, (0.3, 0, 10, 30), (0.5, 0, -14, -22), (0.7, 0, -10, -18), (1.0, 0, 0, 0))},
              "tail": {"rot": keys(z, (0.3, -20, 0, 0), (0.5, 10, 0, 0), (1.0, 0, 0, 0))}}
    hit = {"body": {"rot": keys(z, (0.1, 10, 0, -10), (0.35, 8, 0, -8), (0.7, 0, 0, 0))},
           "head": {"rot": keys(z, (0.1, 32, -22, 12), (0.35, 28, -20, 10), (0.7, 0, 0, 0))},
           "tail": {"rot": keys(z, (0.1, -25, 0, 0), (0.35, -20, 0, 0), (0.7, 0, 0, 0))},
           "wing-l": {"rot": keys(z, (0.1, 0, 0, -22), (0.35, 0, 0, -18), (0.7, 0, 0, 0))},
           "wing-r": {"rot": keys(z, (0.1, 0, 0, 22), (0.35, 0, 0, 18), (0.7, 0, 0, 0))}}
    q = (CX - 16.0, 0.0, BODY_HINGE[2])
    roll = [(0.0, 0.0), (0.3, -5.0), (0.8, 60.0), (1.05, 86.0), (1.25, 81.0), (1.6, 83.0)]
    death = {"body": {"rot": keys(*[(t, 0, 0, a) for t, a in roll]),
                      "loc": keys(*[(t, *about(q, BODY_HINGE, a)) for t, a in roll])},
             "head": {"rot": keys(z, (0.3, 14, 0, 0), (0.9, -25, 0, -18), (1.6, -30, 0, -20))},
             "wing-l": {"rot": keys(z, (0.3, 0, 0, -16), (1.0, 0, 0, 36), (1.6, 0, 0, 34))},
             "wing-r": {"rot": keys(z, (0.3, 0, 0, 16), (1.0, 0, 0, -44), (1.6, 0, 0, -40))},
             "tail": {"rot": keys(z, (1.0, 30, 0, 0), (1.6, 26, 0, 0))}}
    beak = to_root((CX, 50.0, 0.5))
    return asset("creatures", "griffin", "Griffin", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-beak", at=beak, parent="head")],
                 fx=[pfx("rvx-fantasy-slash-arc", "socket-beak", "clip:attack", size=27.0, aim=(0.0, 0.4, -0.917), offset=(0.0, -6.6, 15.125))])
