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
spark at the beak socket), hit (rocked back onto its haunches, head snapped back, wings jolt), death
(staggers back and falls over backward). Faces -Z.
"""
import math

import numpy as np

from _quad_falls import Planter, bake
from _fmove import Rig, gait, hermite, lerp, quick_lift, smooth, wave_keys

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


def griffin_fall(body_grid: Grid, head_grid: Grid) -> dict:
    """Per-frame keys for the backward death (see build). The body turns
    about whichever edge of it is on the floor (the hind paws, then the
    rump, then the back), so it rolls over without sliding or sinking;
    the stagger and its hops ride on top."""
    LAND, END = 26, 40
    vox = np.argwhere(body_grid.a > 0)
    corners = np.array([(i, j, k) for i in (0, 1) for j in (0, 1) for k in (0, 1)])
    pts = np.unique((vox[:, None, :] + corners[None]).reshape(-1, 3), axis=0).astype(float) - np.array(BODY_HINGE)
    floor0 = pts[:, 1].min()

    def ease(rows, fr):
        """rows (frame, value, curve into it): snap = fast out, settles; acc = gravity."""
        for (f0, v0, _), (f1, v1, kind) in zip(rows, rows[1:]):
            if f0 <= fr <= f1:
                u = (fr - f0) / max(1, f1 - f0)
                w = u * u if kind == "acc" else u ** 2.4 if kind == "fall" else 1 - (1 - u) ** 2 if kind == "snap" else u
                return np.array(v0, float) + (np.array(v1, float) - np.array(v0, float)) * w
        return np.array(rows[-1][1], float)

    pitch = [(0, 0, None), (3, 16, "snap"), (7, 22, "snap"), (11, 30, "snap"), (14, 33, None), (LAND, 168, "fall"), (29, 160, "snap"),
             (32, 168, "acc"), (END, 168, None)]
    back = [(0, 0, None), (3, 3, "snap"), (7, 7, "snap"), (11, 10, "snap"), (END, 10, None)]
    hops = ((3, 7, 1.6), (7, 11, 1.2))
    out = {n: {"rot": []} for n in ("body", "head", "tail", "wing-l", "wing-r", "leg-fl", "leg-fr")}
    out["body"]["loc"] = []
    t, prev = np.zeros(3), 0.0

    def rx(deg):
        c, sn = math.cos(math.radians(deg)), math.sin(math.radians(deg))
        return np.array([[1, 0, 0], [0, c, -sn], [0, sn, c]])
    for fr in range(END + 1):
        th = float(ease(pitch, fr))
        world = pts @ rx(prev).T + t
        low = world[world[:, 1] < world[:, 1].min() + 0.05]
        c = low[low[:, 2].argmax()] if th >= prev else low[low[:, 2].argmin()]
        t = rx(th - prev) @ (t - c) + c
        t[1] -= (pts @ rx(th).T + t)[:, 1].min() - floor0
        prev = th
        lift = 0.0
        for f0, f1, h in hops:
            if f0 < fr < f1:
                u = (fr - f0) / (f1 - f0)
                lift = 4 * h * u * (1 - u)
        T = fr / 30
        out["body"]["rot"].append((T, (th, 0.0, 0.0)))
        out["body"]["loc"].append((T, (0.0, float(t[1]) + lift, float(t[2] + ease(back, fr)))))
    F = 1 / 30

    def rows(*r):
        return [(fr * F, tuple(v)) for fr, *v in r]
    # the head: thrown back by the blow and pawing with the stagger, then
    # it goes limp: it trails the body over (a lag that grows as the fall
    # speeds up) until it hits the floor behind the shoulders, and from then
    # on the floor holds it while the body finishes landing, so the head
    # ends flopped back on its crown, lolled to one side (one small knock)
    HEAD_FLOOR, LOLL = 95.0, 35.0  # world pitch of the limp head on the floor; its roll onto one side
    hv = np.argwhere(head_grid.a > 0)
    hpts = np.unique((hv[:, None, :] + corners[None]).reshape(-1, 3), axis=0).astype(float) - np.array(HEAD_HINGE)
    hoff = np.array(HEAD_HINGE, float) - np.array(BODY_HINGE, float)

    def rz(deg):
        c, sn = math.cos(math.radians(deg)), math.sin(math.radians(deg))
        return np.array([[c, -sn, 0], [sn, c, 0], [0, 0, 1]])

    def ry(deg):
        c, sn = math.cos(math.radians(deg)), math.sin(math.radians(deg))
        return np.array([[c, 0, sn], [0, 1, 0], [-sn, 0, c]])
    head = rows((0, 0, 0, 0), (3, 26, 0, 0), (7, 18, -8, 0), (11, 22, 8, 0), (16, 30, 0, 0))
    hloc = [(0.0, (0.0, 0.0, 0.0)), (16 * F, (0.0, 0.0, 0.0))]
    for fr in range(17, END + 1):
        th = float(ease(pitch, fr))
        u = min(1.0, (fr - 16) / (LAND - 16))
        h = 30.0 - 40.0 * u * u  # the limp head lags the accelerating fall
        if th + h > HEAD_FLOOR:  # the floor stops it
            h = HEAD_FLOOR - th
        knock = {LAND + 1: -7.0, LAND + 2: -4.0, LAND + 3: -1.0}.get(fr, 0.0)  # it bounces once off the floor
        roll = LOLL * min(1.0, max(0.0, (fr - LAND + 2) / 4.0))
        r = (h + knock, 0.6 * roll, roll)
        head.append((fr * F, r))
        # the neck sits close to the floor once it is over: where the limp
        # head would dip under the back, slide it up into the collar (toward
        # world up) just enough to rest on the floor instead of propping the
        # body up
        m = rz(r[2]) @ ry(r[1]) @ rx(r[0])
        low_b = (pts @ rx(th).T)[:, 1].min()
        low_h = ((hoff + hpts @ m.T) @ rx(th).T)[:, 1].min()
        lift = max(0.0, low_b - low_h + 0.2)
        up = rx(-th) @ np.array([0.0, 1.0, 0.0])
        hloc.append((fr * F, tuple(float(v) for v in up * lift)))
    out["head"]["rot"] = head
    out["head"]["loc"] = hloc
    # the tail: whipped up by the blow, then swung back out along the floor
    # as it goes over, so it trails behind instead of propping it up
    out["tail"]["rot"] = rows((0, 0, 0, 0), (3, -18, 0, 0), (11, -24, 8, 0), (16, -20, 0, 0), (20, -46, 0, 0), (22, -76, 0, 0), (24, -112, 0, 0),
                              (LAND, -135, 0, 0), (29, -124, -10, 0), (33, -145, -6, 0), (END, -143, -6, 0))
    for name, sx in (("wing-l", -1), ("wing-r", 1)):
        # flung open by the blow, beating as it staggers, then flung out
        # flat to the sides as it goes over, so it lands on them
        out[name]["rot"] = rows((0, 0, 0, 0), (3, 0, 0, sx * 26), (7, 0, 0, sx * 6), (11, 0, 0, sx * 28), (16, 0, 0, sx * 10),
                                (LAND, 0, 0, -sx * 44), (29, 0, 0, -sx * 34), (33, 0, 0, -sx * 42), (END, 0, 0, -sx * 41))
    for name, sx in (("leg-fl", -1), ("leg-fr", 1)):
        o = 0 if sx < 0 else 2  # the forelegs paw the air out of step
        out[name]["rot"] = rows((0, 0, 0, 0), (3, 30, 0, 0), (6 + o, 60, 0, sx * 6), (9 + o, 20, 0, 0), (12 + o, 55, 0, sx * 4), (LAND, 30, 0, sx * 10),
                                (29, 52, 0, sx * 16), (33, 38, 0, sx * 12), (END, 40, 0, sx * 12))
    return out


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


FRONT_LEGS = {"leg-fl": -1, "leg-fr": 1}
FRONT_HIP = {n: (CX + s * 9, 28.0, 26.0) for n, s in FRONT_LEGS.items()}


def front_leg(name: str) -> Grid:
    """A front leg: a yellow scaly shin, brown feather "trousers" and big
    talons (its own part, so it can reach and plant)."""
    g = Grid(*S)
    X, Y, Z = xyz()
    s = FRONT_LEGS[name]
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
def keyed(root, clip: dict) -> dict:
    """Give every part with a grid a rest key in the clip, so a viewer that
    plays one clip per part never keeps a pose from another clip."""
    for part in root.walk():
        if part.grid is not None and part.name not in clip:
            clip[part.name] = {"rot": keys((0, 0, 0, 0))}
    return clip


def move(root, to_root):
    """A bounding lope in 0.8 s (one stride, keyed a frame at a time). The
    lion haunches are one block with the hind paws, so the hind pair moves
    together (a half-bound, like a big cat): the hind paws stand planted
    while the body rolls back over them at the ground speed, then the
    haunches push off, the body pitches nose-down over the forelegs (the
    hind paws lift and swing under) and surges forward, and the hind paws
    land again under the hips. The eagle forelegs strike one after the
    other (left, then right) while the hind paws are up, planted and
    sliding back at the same ground speed. The head stays level against the
    pitch, the wings lift and settle with each bound, the tail streams."""
    N = 24
    rig = Rig(root, "body", list(FRONT_LEGS), fixed=6.0)
    rig.floor += 0.05  # the export grounds this model 0.05 under the mesh-derived floor (measured with clip_probe)
    DH = 0.42  # share of the stride the hind paws stand
    SH = 7.0  # hind travel in voxels
    v = SH / (DH * N)  # ground speed, voxels a frame
    duty_f = 0.36
    legs = {"leg-fl": (0.47, 1), "leg-fr": (0.57, 1)}
    hind = rig.B + np.array([0.0, 0.0, float(np.median(rig.fixed[:, 2]))])
    hind[1] = rig.floor
    shoulder = rig.B + rig.H["leg-fl"] * np.array([0.0, 1.0, 1.0])
    reach = abs(hind[2] - shoulder[2])
    LIFT = 3.5
    off = 0.06  # the hind touchdown, off the loop seam

    def phase(f):
        return (f / N - off) % 1.0

    def body(f, _):
        u = phase(f)
        if u < DH:  # hind stance: the body rolls back over the planted hind paws
            w = u / DH
            dz = -SH / 2 + SH * w
            pitch = 2.5 * math.sin(math.pi * w)  # a little nose-up as the forelegs reach
            piv = hind + np.array([0.0, 0.0, dz])
        else:  # hind swing: push off, pitch nose-down over the forelegs, surge forward
            w = (u - DH) / (1 - DH)
            m = v * (1 - DH) * N * 0.5
            dz = hermite(w, SH / 2, -SH / 2, m, m)
            h = LIFT * math.sin(math.pi * min(1.0, w ** 0.8))
            pitch = -math.degrees(math.asin(h / reach))
            piv = shoulder + np.array([0.0, 0.0, dz])
        return {"rot": (pitch, 0.0, 0.0), "pivot": piv, "dz": dz}

    keys, info = gait(rig, N, legs, stride=v * duty_f * N, duty=duty_f, lift=quick_lift(5.0), body=body, fixed_stance=lambda f: phase(f) < DH,
                      smooth_passes=0)
    pitch = [keys["body"]["rot"][f][1][0] for f in range(N)]
    keys["head"] = {"rot": wave_keys(N, lambda f: (-0.8 * pitch[(f - 1) % N], 0.0, 0.0))}
    keys["tail"] = {"rot": wave_keys(N, lambda f: (1.6 * pitch[(f - 3) % N] - 6.0, 6.0 * math.sin(2 * math.pi * (f - 4) / N), 0.0))}
    keys["wing-l"] = {"rot": wave_keys(N, lambda f: (0.0, 0.0, 2.2 * pitch[(f - 2) % N]))}
    keys["wing-r"] = {"rot": wave_keys(N, lambda f: (0.0, 0.0, -2.2 * pitch[(f - 2) % N]))}
    return keys


def build():
    parts = [("griffin", None, None, None),
             ("body", body(), BODY_HINGE, None),
             ("head", head(), HEAD_HINGE, "body"),
             ("tail", tail(), TAIL_HINGE, "body"),
             ("wing-l", wing(-1), WING_HINGE[-1], "body"),
             ("wing-r", wing(1), WING_HINGE[1], "body")]
    parts += [(name, front_leg(name), FRONT_HIP[name], "body") for name in FRONT_LEGS]
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
    f = 1 / 30

    def fk(*rows):
        """Keys from (frame, x, y, z) rows."""
        return [(fr * f, (x, y, w)) for fr, x, y, w in rows]

    # The pounce. Rear (f0-12, the anticipation): the body rears up on the
    # lion haunches (pivoting on the hind paws, which stay planted), the
    # wings flare high, the head draws back and the front talons lift and
    # paw the air. Strike (impact f16): it drops into a play bow like a
    # dog's: the forelegs slam down far forward with the forearms along the
    # floor, chest low and rump high, the beak drives down at full speed
    # and the wings beat down. It tears (two head shakes), then steps the
    # front feet back under itself (lift, move, plant) and settles.
    STRIKE = 16
    BOW = 84  # forelegs reach out flat along the floor: a dog's play bow
    attack = {"body": {"rot": fk((0, 0, 0, 0), (8, 14, 0, 0), (12, 16, 0, 0), (STRIKE, -17, 0, 0), (19, -18, 0, 0), (24, -16, 0, 0), (30, -3, 0, 0), (34, 0.5, 0, 0), (38, 0, 0, 0))},
              "head": {"rot": fk((0, 0, 0, 0), (8, 22, 0, 0), (12, 25, 0, 0), (STRIKE, -24, 0, 0), (19, -28, 0, 0), (22, -20, 10, 5), (25, -25, -10, -5),
                                 (28, -18, 0, 0), (34, 3, 0, 0), (38, 0, 0, 0))},
              "wing-l": {"rot": fk((0, 0, 0, 0), (8, 0, -10, -34), (12, 0, -12, -38), (STRIKE, 0, 14, 24), (20, 0, 16, 28), (26, 0, 8, 14), (34, 0, -2, -4), (38, 0, 0, 0))},
              "wing-r": {"rot": fk((0, 0, 0, 0), (8, 0, 10, 34), (12, 0, 12, 38), (STRIKE, 0, -14, -24), (20, 0, -16, -28), (26, 0, -8, -14), (34, 0, 2, 4), (38, 0, 0, 0))},
              "tail": {"rot": fk((0, 0, 0, 0), (8, -24, 0, 0), (12, -26, 6, 0), (STRIKE, 14, -4, 0), (21, -6, 8, 0), (27, 4, -6, 0), (33, -2, 2, 0), (38, 0, 0, 0))}}
    planted, anchors = {}, {}
    for name, sx in FRONT_LEGS.items():
        paw = 46 if sx < 0 else 30  # the talons paw the air out of step
        o = 2 if sx > 0 else 0  # the right foot steps back two frames after the left
        # the strike: both front feet slam down far forward and wide (set on
        # the floor there, then held planted while the body bears down)
        attack[name] = {"rot": fk((0, 0, 0, 0), (8, 40, 0, 0), (12, paw, 0, 0), (STRIKE, BOW, 0, sx * 10), (24, BOW, 0, sx * 10), (28 + o, 30, 0, sx * 4),
                                  (31 + o, -3, 0, 0), (38, 0, 0, 0)),
                        "loc": fk((0, 0, 0, 0), (25 + o, 0, 0, 0), (28 + o, 0, 2.5, 0), (31 + o, 0, 0, 0), (38, 0, 0, 0))}
        planted[name] = [(0, 1.0), (2, 0.0), (STRIKE - 1, 0.0), (STRIKE, 1.0), (25 + o, 1.0), (26 + o, 0.0), (30 + o, 0.0), (31 + o, 1.0)]
        anchors[name] = [(0, 0.0), (STRIKE, "touch"), (30 + o, 0.0)]
    feet = Planter(root, "body", list(FRONT_LEGS), fixed=6.0, top="griffin")  # the hind paws are part of the body
    attack = keyed(root, bake(attack, STRIKE, feet, planted, anchors))
    # hit: the blow rocks it back up onto its haunches (the hind paws stay
    # put, the forefeet pop off the floor and trail), the head thrown back
    # and away; the forefeet come down by f8 with a squash, it drifts a
    # beat, then recovers with weight, dipping past rest.
    hit = {"griffin": {"scale": fk((0, 1, 1, 1), (4, 0.98, 1.04, 1.0), (8, 1.05, 0.92, 1.02), (12, 1.01, 0.98, 1.0), (16, 1, 1, 1), (22, 1.02, 0.95, 1.01),
                                  (27, 1, 1, 1), (32, 1, 1, 1))},
           "body": {"rot": fk((0, 0, 0, 0), (2, 6, 0, -1.5), (4, 9, 0, -2.5), (6, 6, 0, -2), (8, 0.5, 0, -1.5), (13, 1.5, 0, -1.5), (17, 1, 0, -1), (23, -2, 0, 0.6),
                               (28, 0.5, 0, 0), (32, 0, 0, 0))},
           "head": {"rot": fk((0, 0, 0, 0), (3, 32, -20, 12), (7, 26, -16, 9), (13, 22, -14, 8), (17, 20, -12, 7), (23, -10, 4, -3), (28, 3, 0, 0), (32, 0, 0, 0))},
           "tail": {"rot": fk((0, 0, 0, 0), (4, -26, 10, 0), (9, -12, 6, 0), (15, -16, 8, 0), (23, 10, -4, 0), (28, -2, 0, 0), (32, 0, 0, 0))},
           "wing-l": {"rot": fk((0, 0, 0, 0), (3, 0, 0, -26), (8, 0, 0, -14), (14, 0, 0, -18), (22, 0, 0, 8), (28, 0, 0, -2), (32, 0, 0, 0))},
           "wing-r": {"rot": fk((0, 0, 0, 0), (3, 0, 0, 26), (8, 0, 0, 14), (14, 0, 0, 18), (22, 0, 0, -8), (28, 0, 0, 2), (32, 0, 0, 0))},
           }
    for leg_name in FRONT_LEGS:  # the forefeet trail up off the floor, then land back on their spot
        hit[leg_name] = {"rot": fk((0, 0, 0, 0), (3, 14, 0, 0), (5, 16, 0, 0), (8, 0, 0, 0), (32, 0, 0, 0))}
    hit["body"]["loc"] = fk((0, 0, 0, 0), (2, 0, 1.6, 0.6), (4, 0, 2.2, 1.0), (6, 0, 1.4, 1.2), (8, 0, 0, 1.3), (12, 0, 0, 1.6), (16, 0, 0, 1.8),
                            (23, 0, 0, 0.2), (28, 0, 0, -0.2), (32, 0, 0, 0))  # a small pop off the hind paws and a drift
    hit = keyed(root, bake(hit, None, feet, {n: [(0, 1.0), (1, 0.0), (6, 0.0), (8, 1.0)] for n in FRONT_LEGS}, lift=[(0, 1.0), (1, 0.0), (7, 0.0), (8, 1.0)]))
    # death: the blow rears it up and back (f0-3), it staggers backward
    # in two hops on its hind legs with the forelegs pawing the air (to
    # f11), teeters, then its haunches give and it falls over BACKWARD in one
    # accelerating stroke, landing on its back at full speed (f26): a
    # heavy thud, one small rock, and it lies belly-up with the legs in the
    # air, the wings flung out flat and the head lolled back.
    death = griffin_fall(parts[1][1], parts[2][1])
    beak = to_root((CX, 50.0, 0.5))
    return asset("creatures", "griffin", "Griffin", root,
                 clips=[Clip("idle", keyed(root, idle)), Clip("move", keyed(root, move(root, to_root)), ease=0, floor=False), Clip("attack", attack, loop=False, impact=STRIKE * f, ease=0.0), Clip("hit", hit, loop=False, ease=0.0),
                        Clip("death", keyed(root, death), loop=False, ease=0.0)],
                 sockets=[Socket("socket-beak", at=beak, parent="head")],
                 fx=[pfx("rvx-fantasy-slash-arc", "socket-beak", "clip:attack", size=27.0, aim=(0.0, 0.4, -0.917), offset=(0.0, -6.6, 15.125), at=STRIKE * f)])
