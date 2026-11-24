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
up with the front hooves kicking, then stamp down and lunge, stabbing with
the horn and goring up: holy smite at the horn socket), hit (shoved back
off its hooves, the head thrown back, it lands and recovers), death (the
legs splay out flat and it crumbles down onto its belly). Faces -Z.
"""
import math

import numpy as np

from _quad_falls import Planter, bake, per_frame, sample

import paint as P
import pnglyph
import pnpaint
from _life import C, Clip, Grid, Socket, asset, chamfer_rect, facet_paint, front, keys, last, pfx, plan, rig, side
from pnshapes import quad
from _move_gaits import Gait, cyc, thump, turn_loop

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
def keyed(root, clip: dict) -> dict:
    """Give every part with a grid a rest key in the clip, so a viewer that
    plays one clip per part never keeps a pose from another clip."""
    for part in root.walk():
        if part.grid is not None and part.name not in clip:
            clip[part.name] = {"rot": keys((0, 0, 0, 0))}
    return clip


def trot_move(root) -> dict:
    """move: an elegant, collected trot, 24 frames: diagonal pairs (left
    fore + right hind down on f3, right fore + left hind on f15), each
    planted hoof sliding back at one ground speed, each swing hoof lifted
    high and set down crisply (accelerating into the floor). The body
    settles a little into each diagonal plant and springs up off it; the
    head nods a beat after each plant, held proud, and the tail is carried
    high and streams, flicking a beat behind the body. (Frames as
    authored; turn_loop then starts the loop mid-stroke.)"""
    T = 24
    ph = {"leg-fl": 3, "leg-br": 3, "leg-fr": 15, "leg-bl": 15}
    gait = Gait(root, "body", list(ph))
    th = thump(T, [3, 15], depth=0.9, fall=3, past=2, rise=5)

    def z(*v):
        return np.array(v, float)
    s = gait.walk(T, {n: fr / T for n, fr in ph.items()}, duty=0.52, stride=10.0, lift=4.5,
                  height=lambda f: 0.3 - th(f), carry=0.7, land=0.3)
    nod = thump(T, [3, 15], depth=1.0, fall=1, past=2, rise=6)
    s["head"] = {"rot": [z(2 - 5 * nod((f - 1) % T), 0, 0) for f in range(T + 1)]}
    s["tail"] = {"rot": [r + z(6 * nod((f - 3) % T), 0, 0) for f, r in enumerate(
        cyc([(0, z(-22, 6, 0)), (8, z(-24, -8, 0)), (12, z(-22, -6, 0)), (20, z(-24, 8, 0))], T))]}
    s, _ = turn_loop(s, T)
    return per_frame(s)


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
    f = 1 / 30

    def fk(*rows):
        """Keys from (frame, x, y, z) rows."""
        return [(fr * f, (x, y, w)) for fr, x, y, w in rows]

    LEG = LEG_HINGE["leg-fl"][1] * F  # hip to hoof

    def plant(dz):  # a planted leg turns by this as the body slides by dz
        return math.degrees(math.asin(dz / LEG))

    # The horn charge. Gather (f0-5): the weight rocks back, the head dips.
    # Rear (f5-16, the anticipation): it rears up on the hind hooves (the
    # body pivots on them), the forelegs fold and paw, the horn raised high.
    # Strike (impact f21): it drops forward, accelerating, the forehooves
    # stamp down ahead and the body lunges, the head driving the horn
    # forward and down; then it gores, tossing the horn up and through
    # (follow-through), and settles back, the tail and mane trailing.
    GORE = 21
    bz = [(0, 0.0), (5, 1.5), (12, 1.0), (16, 0.6), (GORE, -4.5), (24, -5.0), (28, -4.4), (34, -1.5), (40, 0.3), (46, 0.0)]
    attack = {"body": {"rot": fk((0, 0, 0, 0), (5, 2, 0, 0), (12, 30, 0, 0), (16, 34, 0, 0), (GORE, -2, 0, 0), (24, -3, 0, 0), (28, 1, 0, 0),
                                 (34, 0, 0, 0), (46, 0, 0, 0)),
                       "loc": fk(*[(fr, 0, 0, dz) for fr, dz in bz])},  # its height is solved from the planted hooves
              "head": {"rot": fk((0, 0, 0, 0), (5, -10, 0, 0), (12, 8, 0, 0), (16, 12, 0, 0), (GORE, -34, 0, 0), (24, -30, 0, 0), (27, 14, 0, 0),
                                 (31, 18, 6, 0), (36, -6, 0, 0), (40, 2, 0, 0), (46, 0, 0, 0))},
              "tail": {"rot": fk((0, 0, 0, 0), (5, 6, 0, 0), (12, -50, 0, 0), (16, -56, 6, 0), (GORE, 6, -4, 0), (26, 22, 6, 0), (32, -8, 0, 0),
                                 (38, 4, 0, 0), (46, 0, 0, 0))}}
    for leg_name in ("leg-bl", "leg-br"):  # planted: solved a frame at a time
        attack[leg_name] = {"rot": fk((0, 0, 0, 0), (46, 0, 0, 0))}
    # the forehooves paw the air, stamp down far ahead on the gore (set on
    # the floor there), bear the weight, then step back one at a time
    attack["leg-fl"] = {"rot": fk((0, 0, 0, 0), (5, 4, 0, 0), (12, 70, 0, 0), (16, 40, 0, 0), (GORE, 22, 0, 0), (29, 22, 0, 0), (32, 12, 0, 0), (35, 0, 0, 0), (46, 0, 0, 0)),
                        "loc": fk((0, 0, 0, 0), (29, 0, 0, 0), (32, 0, 2.0, 0), (35, 0, 0, 0), (46, 0, 0, 0))}
    attack["leg-fr"] = {"rot": fk((0, 0, 0, 0), (5, 4, 0, 0), (12, 40, 0, 0), (16, 75, 0, 0), (GORE, 20, 0, 0), (32, 20, 0, 0), (35, 10, 0, 0), (38, 0, 0, 0), (46, 0, 0, 0)),
                        "loc": fk((0, 0, 0, 0), (32, 0, 0, 0), (35, 0, 2.0, 0), (38, 0, 0, 0), (46, 0, 0, 0))}
    LEG_NAMES = ["leg-fl", "leg-fr", "leg-bl", "leg-br"]
    feet = Planter(root, "body", LEG_NAMES, top="unicorn")
    planted = {"leg-bl": [(0, 1.0)], "leg-br": [(0, 1.0)],
               "leg-fl": [(0, 1.0), (2, 0.0), (GORE - 1, 0.0), (GORE, 1.0), (29, 1.0), (30, 0.0), (34, 0.0), (35, 1.0)],
               "leg-fr": [(0, 1.0), (2, 0.0), (GORE - 1, 0.0), (GORE, 1.0), (32, 1.0), (33, 0.0), (37, 0.0), (38, 1.0)]}
    anchors = {"leg-fl": [(0, 0.0), (GORE, "touch"), (34, 0.0)], "leg-fr": [(0, 0.0), (GORE, "touch"), (37, 0.0)]}
    attack = keyed(root, bake(attack, GORE, feet, planted, anchors))
    # hit: the blow shoves it back in a short arc (up by f4, down by f8);
    # the hooves keep their spot (the legs trail) and land there, so the
    # body leans back over them; a squash, a drifting beat, then it comes
    # forward over its hooves past rest.
    hit = {"unicorn": {"scale": fk((0, 1, 1, 1), (4, 0.98, 1.04, 1.0), (8, 1.04, 0.92, 1.02), (12, 1.01, 0.98, 1.0), (16, 1, 1, 1), (22, 1.02, 0.95, 1.01),
                                   (27, 1, 1, 1), (32, 1, 1, 1))},
           "body": {"loc": fk((0, 0, 0, 0), (2, 0, 2.2, 1.8), (4, 0, 2.8, 3.0), (6, 0, 1.8, 3.6), (8, 0, 0, 4.0), (13, 0, 0, 4.4), (17, 0, 0, 4.0),
                               (23, 0, 0, 0.6), (28, 0, 0, -0.4), (32, 0, 0, 0)),
                    "rot": fk((0, 0, 0, 0), (4, 6, 0, -6), (8, 0, 0, -2), (13, 0, 0, -1.5), (17, 0, 0, -1), (23, -1, 0, 0.6), (28, 0, 0, 0), (32, 0, 0, 0))},
           "head": {"rot": fk((0, 0, 0, 0), (3, 30, 18, 8), (7, 24, 14, 6), (13, 20, 12, 5), (17, 18, 10, 4), (23, -10, -2, -2), (28, 3, 0, 0), (32, 0, 0, 0))},
           "tail": {"rot": fk((0, 0, 0, 0), (4, -26, 10, 0), (9, -10, 6, 0), (15, -14, 8, 0), (23, 10, -4, 0), (28, -2, 0, 0), (32, 0, 0, 0))}}
    for leg_name in LEG_NAMES:
        hit[leg_name] = {"rot": fk((0, 0, 0, 0), (32, 0, 0, 0))}
    hit = keyed(root, bake(hit, None, feet, {n: [(0, 1.0)] for n in LEG_NAMES}, lift=[(0, 1.0), (1, 0.0), (7, 0.0), (8, 1.0)]))
    # death: the blow rocks it (a moving flinch and teeter, the legs starting
    # to bow), then in one accelerating stroke the legs splay out flat (the
    # forelegs reaching forward, the hind legs back, the hooves sliding out
    # along the floor) and the barrel crumbles straight down onto its belly
    # (impact f27); one small bounce, a slump to the side, the head slamming
    # down late and the tail flopping last.
    LAND = 23
    END = 40
    DROP = -18.3  # the belly onto the floor (its lowest point sits a little under the 19.2 of the barrel bottom)
    BELLY = 19.2
    spec = {"body": {"rot": [(0, (0, 0, 0)), (3, (4, 0, -4)), (6, (1, 0, 3)), (10, (-1, 0, 1)), (14, (-1.5, 0, 0)), (LAND, (-2, 0, 0.5)), (25, (-1.5, 0, 1)),
                             (27, (-2, 0, 1.5)), (END, (-2, 0, 1.5))],
                     "loc": [(0, (0, 0, 0)), (3, (0, -0.4, 0.8)), (6, (0, -1.4, 1.0)), (10, (0, -2.4, 0.8)), (14, (0, -3.6, 0.6)), (LAND, (0, DROP + BELLY * 0.1, 0.4)),  # the squash is about the body pivot: keep the belly on the floor
                             (25, (0, DROP + 1.3 - BELLY * 0.02, 0.4)), (27, (0, DROP, 0.4)), (END, (0, DROP, 0.4))],
                     "scale": [(0, (1, 1, 1)), (14, (1, 1, 1)), (LAND, (1.07, 0.9, 1.03)), (25, (0.99, 1.02, 1.0)), (27, (1, 1, 1)), (END, (1, 1, 1))]},
            # the head lands two frames after the body has settled, bounces once and flops
            "head": {"rot": [(0, (0, 0, 0)), (3, (24, 6, 0)), (6, (16, -8, 0)), (10, (14, -6, 0)), (14, (12, -4, 0)), (LAND, (8, 0, 0)), (26, (2, -4, -6)),
                             (29, (-47, -8, -16)), (31, (-44.5, -8, -15)), (33, (-46, -9, -16)), (END, (-45.5, -9, -16))]},
            "tail": {"rot": [(0, (0, 0, 0)), (4, (-14, 6, 0)), (10, (-10, -6, 0)), (14, (-16, -4, 0)), (LAND, (-62, 4, 0)), (29, (-58, 10, 0)), (32, (-56, 12, 0)),
                             (36, (-55, 13, 0)), (END, (-55, 13, 0))]}}
    smp = sample(spec, END, LAND)
    for name in LEG_NAMES:
        sx = -1 if name.endswith("l") else 1
        fore = name.startswith("leg-f")
        seq = []
        for fr in range(END + 1):
            loc, rot, sc = (smp["body"][ch][fr] for ch in ("loc", "rot", "scale"))
            lo, hi = 0.0, 89.0
            for _ in range(30):  # the least splay that keeps the hoof out of the floor: the soles slide out as it drops
                m = (lo + hi) / 2
                reach = (m / 80.0) * 20.0 * (1 if fore else -1) * -sx  # forelegs forward, hind legs back
                if feet._world(name, loc, rot, sc, (0.0, reach, sx * m), None)[0] < 0:
                    lo = m
                else:
                    hi = m
            m = hi if fr > 0 else 0.0
            if LAND < fr < 27:  # the bounce: the splayed legs go up with the barrel, off the floor
                m = seq[LAND][2] * sx
            seq.append(np.array((0.0, (m / 80.0) * 20.0 * (1 if fore else -1) * -sx, sx * m)))
        smp[name] = {"rot": seq}
    death = keyed(root, per_frame(smp))
    horn = to_root(g3((CX, 84.0, 7.0)))
    return asset("creatures", "unicorn", "Unicorn", root,
                 clips=[Clip("idle", keyed(root, idle)), Clip("attack", attack, loop=False, impact=GORE * f, ease=0.0), Clip("hit", hit, loop=False, ease=0.0),
                        Clip("death", death, loop=False, impact=LAND * f, ease=0.0),
                        Clip("move", keyed(root, trot_move(root)), ease=0.0, floor=False)],
                 sockets=[Socket("socket-horn", at=horn, parent="head")],
                 fx=[pfx("rvx-fantasy-holy-smite", "socket-horn", "clip:attack", size=44, at=GORE * f)])
