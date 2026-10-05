"""Unicorn in the Pirate Nation creature style.

A chunky caricature after the PN world bosses and totems: a pearl-white
horse with a big boxy head, huge royal-blue eyes with lashes that bulge
out of the head, pointed ears and a long spiralled gold horn with a magic
cyan tip; a huge faceted mane and a flowing tail of sloped locks in
rainbow colours (pink, gold, sky, purple); thick legs on big gold hooves
with white fetlock tufts. The coat is clean pearl white, painted with
soft hide strokes and a pearl shade underneath. About the
size of a PN horse-sized creature (creature-large).

Clips: idle (breathe, nod, swish the tail, paw the ground), attack (rear
up with the front hooves kicking, then stab down with the horn: holy
smite at the horn socket), hit (head tosses back, body flinches), death
(the legs buckle and it rolls onto its left side). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _life import C, Clip, Grid, Socket, asset, chamfer_rect, facet_paint, front, keys, last, pfx, plan, rig, side
from pnshapes import quad

F = 0.8  # the whole unicorn is designed in units of 1/F voxels (withers about a person's height)
D = (52, 86, 90)  # design size
S = tuple(int(math.ceil(v * F)) + 1 for v in D)
CX = 26
COAT, HOOF, HORN = "bone", "gold", "gold"
LOCKS = ["pink", "gold", "sky", "purple"]  # a rainbow mane
BODY_HINGE = (CX, 0.0, 60.0)
HEAD_HINGE = (CX, 40.0, 28.0)
TAIL_HINGE = (CX, 42.0, 66.0)
LEG_HINGE = {"leg-fl": (CX - 6.0, 32.0, 29.0), "leg-fr": (CX + 6.0, 32.0, 29.0),
             "leg-bl": (CX - 6.5, 33.0, 58.0), "leg-br": (CX + 6.5, 33.0, 58.0)}


def g3(p):
    """A design point in grid voxels."""
    return (p[0] * F, p[1] * F, p[2] * F)


def g2(pts):
    return [(a * F, b * F) for a, b in pts]


_XYZ = None


def xyz():
    """Voxel-centre coordinates of the shared grid in design units (float32, computed once)."""
    global _XYZ
    if _XYZ is None:
        _XYZ = [c / np.float32(F) for c in np.meshgrid(*(np.arange(n, dtype=np.float32) + 0.5 for n in S), indexing="ij")]
    return _XYZ


# ------------------------------------------------------------------ local shapes and paint
def _sec(c, r, ch):
    c, r = (c[0] * F, c[1] * F), (r[0] * F, r[1] * F)
    return chamfer_rect(c[0] - r[0], c[1] - r[1], c[0] + r[0], c[1] + r[1], min(r) * ch)


def zseg(g: Grid, c0, c1, r0, r1, z0, z1, ramp: str, shade: int, ch: float = 0.42) -> np.ndarray:
    """A chamfered frustum along z between (x, y) centres (sheared)."""
    g.prism("z", _sec(c0, r0, ch), z0 * F, z1 * F, C(ramp, shade), top=_sec(c1, r1, ch))
    return last(g)


def yseg(g: Grid, c0, c1, r0, r1, y0, y1, ramp: str, shade: int, ch: float = 0.42) -> np.ndarray:
    """A chamfered frustum along y between (x, z) centres (sheared)."""
    g.prism("y", _sec(c0, r0, ch), y0 * F, y1 * F, C(ramp, shade), top=_sec(c1, r1, ch))
    return last(g)


def sd(g: Grid, pts_yz, x0, x1, ramp: str, shade: int) -> np.ndarray:
    """_life.side in design units."""
    return side(g, g2(pts_yz), x0 * F, x1 * F, ramp, shade)


def fr(g: Grid, pts_xy, z0, z1, ramp: str, shade: int) -> np.ndarray:
    """_life.front in design units."""
    return front(g, g2(pts_xy), z0 * F, z1 * F, ramp, shade)


def pl(g: Grid, pts_xz, y0, y1, ramp: str, shade: int, top=None) -> np.ndarray:
    """_life.plan in design units."""
    return plan(g, g2(pts_xz), y0 * F, y1 * F, ramp, shade, top=None if top is None else g2(top))


def stamp(g: Grid, face: str, plane: float, u0: float, v0: float, rows, legend, depth: int = 2) -> np.ndarray:
    """pnglyph.stamp at a design position (the pixels stay 1 voxel)."""
    return pnglyph.stamp(g, face, plane * F, int(round(u0 * F)), int(round(v0 * F)), rows, legend, depth=depth)


def hide(g: Grid, start: int, base: int = 6, seed: int = 0) -> None:
    """The pearl coat: soft hide strokes on every face of the prisms since
    `start`, pale-blue pearl shading on the faces that look down."""
    def painter(gg, mm, fr):
        pnpaint.fur(gg, mm, COAT, base, stroke=4, frame=fr, seed=seed)
    facet_paint(g, g.solids[start:], painter)


def locks(g: Grid, m: np.ndarray, frame, ramp: str, base: int = 6) -> None:
    """Hair locks: long strands down the face (±1 shade, 2 wide) with a
    darker parting line every 5 (rule S3: strands, not speckle)."""
    U, _V = P.uv(g, frame)
    shade = np.where(U % 5 == 0, base - 2, np.where(U % 5 < 3, base, base + 1))
    P._paint(g, m, ramp, np.clip(shade, 1, 7))


def lock(g: Grid, pts_yz, x0: float, x1: float, ramp: str, base: int = 6) -> np.ndarray:
    """One sloped lock of hair: a side-view polygon extruded across x,
    painted as strands along its faces."""
    if ramp == "pink":
        base -= 1
    k = len(g.solids)
    m = sd(g, pts_yz, x0, x1, ramp, base)
    facet_paint(g, g.solids[k:], lambda gg, mm, fr: locks(gg, mm, fr, ramp, base))
    return m


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
    zseg(g, (CX, 35), (CX, 35), (9.5, 10), (11, 11), 21, 40, COAT, 6)
    zseg(g, (CX, 35), (CX, 35), (11, 11), (11, 10.5), 40, 58, COAT, 6)
    zseg(g, (CX, 35), (CX, 36), (11, 10.5), (8, 8), 58, 67, COAT, 6)
    # the haunches and shoulders: big faceted muscle blocks
    for s in (-1, 1):
        yseg(g, (CX + s * 6.5, 58), (CX + s * 6.5, 59), (4.5, 7), (5.5, 9), 26, 43, COAT, 6)
        yseg(g, (CX + s * 6.5, 29), (CX + s * 6, 30), (4, 5.5), (5, 7), 27, 41, COAT, 6)
    hide(g, start, 6, seed=1)
    m = g.a > 0
    P.flat(g, m & (Y < 27.5), COAT, 4)  # pearl shading underneath
    P.flat(g, m & (Y >= 27.5) & (Y < 29.5), COAT, 5)
    return g


def leg(name: str) -> Grid:
    """A thick leg on a big gold hoof, with a white fetlock tuft."""
    g = Grid(*S)
    X, Y, Z = xyz()
    hx, hy, hz = LEG_HINGE[name]
    s = -1 if name.endswith("l") else 1
    xl = hx + s * 0.5
    k = len(g.solids)
    if name.startswith("leg-f"):
        yseg(g, (xl, 29), (xl, 29.5), (3.2, 3.2), (4.2, 4.6), 8, 20, COAT, 6)  # cannon
        yseg(g, (xl, 29.5), (hx, 29), (4.2, 4.6), (5, 5.5), 20, 34, COAT, 6)  # forearm
        foot = 29.0
    else:
        yseg(g, (xl, 61), (xl, 63), (3.2, 3.2), (3.8, 4), 8, 18, COAT, 6)  # cannon
        yseg(g, (xl, 63), (hx, 58), (3.8, 4), (5, 6.5), 18, 35, COAT, 6)  # gaskin to the hock
        foot = 61.0
    hide(g, k, 6, seed=2)
    P.flat(g, (g.a > 0) & (Y < 20), COAT, 5)
    tuft = yseg(g, (xl, foot), (xl, foot), (4.4, 4.4), (3.4, 3.4), 4.5, 10, COAT, 7, ch=0.45)
    P.flat(g, tuft & (Y < 6), COAT, 6)
    h0 = len(g.solids)
    pl(g, chamfer_rect(xl - 4.5, foot - 5, xl + 4.5, foot + 4.5, 2), 0, 5.5, HOOF, 5, top=chamfer_rect(xl - 3.8, foot - 3.8, xl + 3.8, foot + 3.8, 1.6))
    hoof = g.solids[-1].mask(g.shape)
    P.flat(g, hoof & (Y > 4), HOOF, 6)
    P.flat(g, hoof & (Y < 1.5), HOOF, 3)
    return g


def head() -> Grid:
    """The neck, the big head, the ears, the horn and the mane."""
    g = Grid(*S)
    X, Y, Z = xyz()
    n0 = len(g.solids)
    yseg(g, (CX, 29), (CX, 21), (6.5, 8), (5.5, 7), 38, 58, COAT, 6)
    zseg(g, (CX, 61), (CX, 60.5), (9, 8.5), (8, 8), 11, 27, COAT, 7, ch=0.45)  # cranium
    zseg(g, (CX, 55), (CX, 57.5), (6.5, 5.5), (7.8, 7.5), 1.5, 14, COAT, 6, ch=0.5)  # muzzle
    hide(g, n0, 6, seed=3)
    m = g.a > 0
    muzzle = m & (Z < 11)
    P.flat(g, muzzle & (Y < 53), "pink", 6)  # soft pink nose
    P.flat(g, muzzle & (Z < 2.5) & (np.abs(np.abs(X - CX) - 3) < 1.1) & (Y > 53) & (Y < 56), "magenta", 3)  # nostrils
    P.flat(g, muzzle & (Y > 49.5) & (Y < 50.5) & (Z < 9), "magenta", 4)  # the smile line
    # big royal-blue eyes with lashes, bulging out of the sides of the head
    for s in (-1, 1):
        x0, x1 = sorted((CX + s * 7.5, CX + s * 10.5))
        sd(g, [(55.5, 12.5), (66, 12.5), (67.5, 14.5), (67.5, 21.5), (66, 23.5), (55.5, 23.5), (54, 21.5), (54, 14.5)], x0, x1, COAT, 7)
    eye = {"d": C("darkwood", 1), "b": C("blue", 4), "n": C("navy", 1), "w": C(COAT, 7), "s": C("sky", 6), "l": C("blue", 6)}
    rows = ["d.d.d...",
            "dddddd..",
            "dwwbbbd.",
            "dwbbbbbd",
            "dbbnnbbd",
            "dbbnnbbd",
            "dlbnnbld",
            ".dsssld.",
            "..dddd.."]
    stamp(g, "-x", CX - 10.5, 13, 55.5, rows, eye)
    stamp(g, "+x", CX + 10.5, 13, 55.5, [r[::-1] for r in rows], eye)
    # pointed ears with pink insides
    for s in (-1, 1):
        ear = fr(g, [(CX + s * 2.5, 67.5), (CX + s * 8, 67.5), (CX + s * 6.5, 76)], 20, 24, COAT, 7)
        P.flat(g, ear & (Z < 21) & (np.abs(X - CX - s * 5.4) < 1.3) & (Y < 73), "pink", 5)
    # the horn: a long spiralled gold cone leaning forward, with a magic tip
    h0 = len(g.solids)
    yseg(g, (CX, 14), (CX, 10.5), (2.8, 2.8), (2.0, 2.0), 67, 75, HORN, 6, ch=0.3)
    yseg(g, (CX, 10.5), (CX, 7), (2.0, 2.0), (0.4, 0.4), 75, 84, HORN, 6, ch=0.3)
    horn = np.logical_or.reduce([sol.mask(g.shape) for sol in g.solids[h0:]])
    zc = np.interp(Y, [67, 84], [14, 7])
    ang = np.arctan2(Z - zc, X - CX)
    band = np.floor(Y * 0.5 + ang * 0.95).astype(np.int64) % 2
    P._paint(g, horn, HORN, np.where(band == 0, 7, 5))
    P.flat(g, horn & (Y > 80), "cyan", 7)
    P.flat(g, horn & (Y > 78) & (Y <= 80), "cyan", 6)
    # the mane: big sloped locks down the back of the neck, a forelock, in
    # magic pastel colours (asymmetric: it falls to the right, rule F5)
    for k, t in enumerate((0.0, 0.26, 0.52, 0.78)):
        ramp = LOCKS[k % len(LOCKS)]
        yc, zc = 71 - 25 * t, 19 + 22 * t  # a point on the neck crest, poll to withers
        # a crest lock standing above the neck, and a long drape down its right side
        lock(g, [(yc + 3, zc - 3), (yc + 5, zc + 4), (yc - 5, zc + 11), (yc - 6, zc + 5), (yc - 3, zc - 1)], CX - 4, CX + 4, ramp, 4)
        lock(g, [(yc + 2, zc - 2), (yc + 2, zc + 6), (yc - 15, zc + 5), (yc - 11, zc - 2)], CX + 3.5, CX + 9, ramp, 4)
        if k < 2:  # short locks on the left side
            lock(g, [(yc + 1, zc - 1), (yc + 1, zc + 5), (yc - 8, zc + 4), (yc - 6, zc - 1)], CX - 8, CX - 3, LOCKS[(k + 2) % len(LOCKS)], 4)
    lock(g, [(72, 15), (71, 23), (64, 19), (58, 14), (63, 12)], CX - 3, CX + 4, LOCKS[1], 4)  # forelock
    return g


def tail() -> Grid:
    g = Grid(*S)
    lock(g, [(45, 63), (46, 70), (41, 79), (30, 84), (32, 77), (38, 70), (39, 63)], CX - 5, CX + 5, LOCKS[0], 4)
    lock(g, [(40, 71), (33, 83), (20, 88), (22, 81), (31, 74)], CX - 5.5, CX + 4, LOCKS[1], 4)
    lock(g, [(29, 80), (22, 88), (9, 89), (12, 84), (21, 80)], CX - 4.5, CX + 5, LOCKS[2], 4)
    lock(g, [(20, 84), (12, 89.5), (5, 86), (12, 82)], CX - 3, CX + 3.5, LOCKS[3], 4)
    return g


# ------------------------------------------------------------------ clips
def build():
    parts = [("unicorn", None, None, None),
             ("body", body(), g3(BODY_HINGE), None),
             ("head", head(), g3(HEAD_HINGE), "body"),
             ("tail", tail(), g3(TAIL_HINGE), "body")]
    parts += [(n, leg(n), g3(LEG_HINGE[n]), "body") for n in ("leg-fl", "leg-fr", "leg-bl", "leg-br")]
    root, to_root = rig(parts)
    z = (0, 0, 0, 0)
    idle = {"body": {"scale": keys((0, 1, 1, 1), (1.2, 1.02, 1.035, 1.01), (2.4, 1, 1, 1))},
            "head": {"rot": keys(z, (0.5, -8, 0, 0), (1.0, 2, 0, 0), (1.6, -2, 10, -4), (2.4, 0, 0, 0))},
            "tail": {"rot": keys(z, (0.6, 0, 16, 0), (1.8, 0, -16, 0), (2.4, 0, 0, 0))},
            "leg-fr": {"rot": keys(z, (1.0, 0, 0, 0), (1.25, 28, 0, 0), (1.5, 0, 0, 0), (2.4, 0, 0, 0))}}
    rear = [(0.0, 0.0), (0.35, 30.0), (0.7, 34.0), (0.9, -6.0), (1.05, -6.0), (1.4, 0.0)]
    attack = {"body": {"rot": keys(*[(t, a, 0, 0) for t, a in rear])},
              "head": {"rot": keys(z, (0.35, -10, 0, 0), (0.7, -14, 0, 0), (0.9, -28, 0, 0), (1.05, -26, 0, 0), (1.4, 0, 0, 0))},
              "leg-fl": {"rot": keys(z, (0.35, 60, 0, 0), (0.55, 25, 0, 0), (0.7, 70, 0, 0), (0.9, 0, 0, 0))},
              "leg-fr": {"rot": keys(z, (0.35, 30, 0, 0), (0.55, 75, 0, 0), (0.7, 35, 0, 0), (0.9, 0, 0, 0))},
              "leg-bl": {"rot": keys(z, (0.35, -30, 0, 0), (0.7, -34, 0, 0), (0.9, 0, 0, 0))},
              "leg-br": {"rot": keys(z, (0.35, -30, 0, 0), (0.7, -34, 0, 0), (0.9, 0, 0, 0))},
              "tail": {"rot": keys(z, (0.35, -25, 0, 0), (0.9, 15, 0, 0), (1.4, 0, 0, 0))}}
    hit = {"body": {"rot": keys(z, (0.1, 4, 0, -9), (0.35, 3, 0, -7), (0.7, 0, 0, 0))},
           "head": {"rot": keys(z, (0.1, 28, 16, 8), (0.35, 24, 14, 6), (0.7, 0, 0, 0))},
           "tail": {"rot": keys(z, (0.1, 20, 0, 0), (0.7, 0, 0, 0))}}
    q = g3((CX - 11.0, 0.0, BODY_HINGE[2]))
    roll = [(0.0, 0.0), (0.3, 0.0), (0.8, 55.0), (1.05, 86.0), (1.25, 82.0), (1.6, 84.0)]
    death = {"body": {"rot": keys(*[(t, 0, 0, a) for t, a in roll]),
                      "loc": keys(*[(t, *about(q, g3(BODY_HINGE), a)) for t, a in roll])},
             "leg-fl": {"rot": keys(z, (0.3, 50, 0, 0), (1.05, 20, 0, 8), (1.6, 18, 0, 8))},
             "leg-fr": {"rot": keys(z, (0.3, 50, 0, 0), (1.05, 30, 0, -10), (1.6, 28, 0, -10))},
             "leg-bl": {"rot": keys(z, (0.3, -40, 0, 0), (1.05, -15, 0, 8), (1.6, -14, 0, 8))},
             "leg-br": {"rot": keys(z, (0.3, -40, 0, 0), (1.05, -20, 0, -10), (1.6, -18, 0, -10))},
             "head": {"rot": keys(z, (0.3, -10, 0, 0), (1.05, -25, 0, -20), (1.6, -28, 0, -22))},
             "tail": {"rot": keys(z, (1.05, 0, -20, 0), (1.6, 0, -18, 0))}}
    horn = to_root(g3((CX, 84.0, 7.0)))
    return asset("creatures", "unicorn", "Unicorn", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-horn", at=horn, parent="head")],
                 fx=[pfx("rvx-fantasy-holy-smite", "socket-horn", "clip:attack", size=44, at=0.56)])
