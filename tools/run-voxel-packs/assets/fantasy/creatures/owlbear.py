"""Owlbear in the Pirate Nation creature style.

A hulking brown bear with the head of a great horned owl. The body is a
heavy quadruped built from few big volumes (rule F1): a high shoulder hump,
a deep belly and a low rump on four thick legs with broad paws and big
hooked bone claws on the front paws. The head is a big octagon block with
a cream heart-shaped facial disc, two huge orange eyes under an angry
brow, a hooked beak and two dark ear tufts. A feathered crown and a
layered feather nape run from the back of the head down over the
shoulders, so the rear of the head is feathers, not a plain face. The
detail is paint (S1): pointed feather rows on the head, the nape and the
chest bib, fur tufts in big rows on the body, dark arrises (S4).

Clips: idle (breathe, turn the head like an owl, shift the weight),
attack (rear up on the hind legs with the claws spread, then slam both
front paws down: the dust slam PFX at the paw socket), hit (the head snaps
back), death (the legs buckle and it rolls onto its left side). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
from _fcreature_beasts import frame_seams, paint_solids, scallops
from _life import C, Clip, Grid, Socket, asset, chamfer_rect, coords, front, keys, last, pfx, plan, rig, side
from pnshapes import quad, seams

S = (76, 80, 84)
CX = 38.0
FUR, FEATHER, DISC = "wood", "wood", "sand"
BODY_HINGE = (CX, 0.0, 67.0)
HEAD_HINGE = (CX, 40.0, 25.0)
LEGS = {"leg-fl": (-1, 29.0), "leg-fr": (1, 29.0), "leg-bl": (-1, 61.0), "leg-br": (1, 61.0)}
FACE_Z = 7.0  # the front plane of the facial disc


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


def fur(g: Grid, start: int, base: int = 4, seed: int = 0, ramp: str = FUR) -> np.ndarray:
    """Fur tufts in big pointed rows on the prisms since `start` (no
    speckle), a shaded underside and dark arrises."""
    m = paint_solids(g, start, lambda gg, mm, fr: scallops(gg, mm, ramp, base, frame=fr, width=6, row=5, seed=seed, pointed=True, streak=False, vary=False))
    frame_seams(g, start, m, steps=1)
    return m


def feathers(g: Grid, start: int, ramp: str = FEATHER, base: int = 4, seed: int = 0, width: int = 5, row: int = 4) -> np.ndarray:
    """Pointed feather rows with a light quill on the prisms since `start`."""
    m = paint_solids(g, start, lambda gg, mm, fr: scallops(gg, mm, ramp, base, frame=fr, width=width, row=row, seed=seed, pointed=True, streak=True, vary=True))
    frame_seams(g, start, m, steps=1)
    return m


def claw(g: Grid, x: float, zf: float, y0: float = 0.0, h: float = 5.5, big: bool = True) -> np.ndarray:
    """A hooked bone claw over the front of a paw (a side-view wedge)."""
    _X, Y, _Z = coords(g)
    w = 1.2 if big else 0.9
    k = 1.0 if big else 0.6
    m = side(g, [(y0 + h, zf + 2.0), (y0 + h, zf - 0.5 * k), (y0 + h * 0.45, zf - 3.6 * k), (y0, zf - 4.2 * k), (y0 + h * 0.3, zf - 1.2 * k), (y0 + h * 0.5, zf + 2.0)], x - w, x + w, "bone", 6)
    P.flat(g, m & (Y > y0 + h - 1.2), "bone", 4)
    P.flat(g, m & (Y < y0 + 1.2), "bone", 7)
    return m


def about(q, pivot, deg_z: float):
    """A `loc` offset that makes a z rotation about `pivot` act about q."""
    a = math.radians(deg_z)
    dx, dy = pivot[0] - q[0], pivot[1] - q[1]
    rx, ry = dx * math.cos(a) - dy * math.sin(a), dx * math.sin(a) + dy * math.cos(a)
    return (rx + q[0] - pivot[0], ry + q[1] - pivot[1], 0.0)


# ------------------------------------------------------------------ parts
def body() -> Grid:
    """A high shoulder hump, a deep belly and a low rump, with a feathered
    chest bib and a dark stripe down the back."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    start = len(g.solids)
    zseg(g, (CX, 31.0), (CX, 33.0), (11.0, 10.0), (14.0, 12.0), 20, 36, FUR, 4, ch=0.5)
    zseg(g, (CX, 33.0), (CX, 30.0), (14.0, 12.0), (13.0, 10.5), 36, 56, FUR, 4, ch=0.5)
    zseg(g, (CX, 30.0), (CX, 29.0), (13.0, 10.5), (9.0, 7.5), 56, 70, FUR, 4, ch=0.5)
    m = fur(g, start, 4, seed=1)
    P.darken(g, m & (Y < 23.0), 1)  # the shaded belly
    P.flat(g, m & (np.abs(X - CX) < 2.0) & (Y > 41.0), FUR, 3)  # the dark stripe down the back
    # the feathered chest bib: sand feathers on the front of the chest
    bib = m & (Z < 30.0) & (np.abs(X - CX) < 8.5 - (40.0 - Y) * 0.25) & (Y > 22.0) & (Y < 40.0)
    facet_bib = lambda gg, mm, fr: scallops(gg, mm & bib, DISC, 4, frame=fr, width=5, row=4, seed=2, pointed=True)  # noqa: E731
    paint_solids(g, start, facet_bib)
    P.flat(g, bib & (np.abs(np.abs(X - CX) - (8.5 - (40.0 - Y) * 0.25)) < 0.8), FUR, 2)  # a dark edge round the bib
    # the feather mantle on the shoulder hump: the owl half meets the bear
    # half on a ragged line (feather rows, not fur)
    edge = 37.0 + 3.0 * ((np.floor(X / 3.0).astype(int) % 2) == 0) + (Y - 30.0) * 0.12
    mantle = m & (Z < edge) & (Y > 27.0) & ~bib
    paint_solids(g, start, lambda gg, mm, fr: scallops(gg, mm & mantle, FEATHER, 3, frame=fr, width=5, row=4, seed=9, pointed=True, vary=True))
    P.flat(g, mantle & (np.abs(Z - edge) < 0.9), "darkwood", 3)  # the dark tips of the last feather row
    P.flat(g, mantle & (Y > 30.0) & ((np.floor(Y).astype(int) % 6) == 0), "darkwood", 3)  # barred feathers
    # a short fan of tail feathers on the rump, barred, with pale tips
    t0 = len(g.solids)
    for dx, lean in ((-4.0, -2.0), (0.0, 0.0), (4.0, 2.0)):
        side(g, [(30.0, 66.0), (35.5, 66.5), (38.0, 75.5), (35.5, 77.5), (32.0, 74.0)], CX + dx - 2.2 + lean * 0.3, CX + dx + 2.2 + lean * 0.3, FEATHER, 3)
    fan = paint_solids(g, t0, lambda gg, mm, fr: scallops(gg, mm, FEATHER, 3, frame=fr, width=4, row=3, seed=10, pointed=True))
    P.flat(g, fan & ((np.floor(Z).astype(int) % 4) == 0), "darkwood", 3)
    P.flat(g, fan & (Z > 75.0), DISC, 4)
    frame_seams(g, t0, fan, steps=1)
    return g


def leg(name: str) -> Grid:
    """A thick bear leg on a broad paw: big hooked claws on the front paws,
    short ones on the hind paws."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    s, zc = LEGS[name]
    fore = zc < 45
    xl = CX + s * (9.5 if fore else 10.0)
    start = len(g.solids)
    if fore:
        yseg(g, (xl, zc - 1.0), (xl, zc + 1.0), (5.2, 5.4), (6.4, 7.4), 12, 34, FUR, 4)
        yseg(g, (xl, zc - 1.5), (xl, zc - 1.0), (4.8, 5.0), (5.2, 5.4), 4, 13, FUR, 4)
        pz = zc - 1.5
    else:
        yseg(g, (xl, zc + 1.5), (xl, zc - 1.0), (5.4, 6.4), (6.8, 9.0), 14, 33, FUR, 4)
        yseg(g, (xl, zc + 1.5), (xl, zc + 1.5), (4.6, 5.0), (5.2, 5.6), 4, 15, FUR, 4)
        pz = zc + 1.5
    m = fur(g, start, 4, seed=3 + int(zc))
    P.darken(g, m & (Y < 9.0), 1)  # dark socks
    p0 = len(g.solids)
    plan(g, chamfer_rect(xl - 6.0, pz - 7.0, xl + 6.0, pz + 5.0, 2.0), 0, 5.0, FUR, 3,
         top=chamfer_rect(xl - 5.2, pz - 5.2, xl + 5.2, pz + 4.5, 1.6))
    paw = fur(g, p0, 3, seed=4)
    P.flat(g, paw & (Y < 1.0), "darkwood", 2)
    for k in (-1, 1):  # toe splits
        P.flat(g, paw & (np.abs(X - (xl + k * 1.8)) < 0.55) & (Z < pz - 3.0), "darkwood", 3)
    for k in (-1, 0, 1):
        claw(g, xl + k * 3.4, pz - 6.4, 0.0, 6.0 if fore else 3.5, big=fore)
    return g


def head() -> Grid:
    """The owl head: a big octagon block, a heart-shaped facial disc, huge
    orange eyes under an angry brow, a hooked beak, two ear tufts, a
    feathered crown and a feather nape that runs down to the shoulders."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    start = len(g.solids)
    zseg(g, (CX, 48.0), (CX, 48.5), (10.5, 10.0), (11.0, 10.5), FACE_Z + 1.0, 24.0, FEATHER, 4, ch=0.45)
    feathers(g, start, FEATHER, 4, seed=5)
    # the feathered crown: a cap of longer feathers whose back edge is cut
    # into points, and the nape: layered feathers down onto the shoulders
    c0 = len(g.solids)
    zseg(g, (CX, 56.5), (CX, 57.0), (8.5, 2.6), (9.6, 2.8), FACE_Z + 2.0, 25.5, FEATHER, 3, ch=0.5)
    nape = [(57.0, 18.0), (57.5, 26.5), (53.0, 28.5), (51.5, 31.0), (46.0, 33.0), (44.0, 36.0), (38.5, 38.5), (37.0, 33.0), (42.0, 26.0), (46.0, 20.0)]
    side(g, nape, CX - 9.5, CX + 9.5, FEATHER, 3)
    side(g, [(52.0, 24.0), (52.5, 30.5), (46.5, 33.5), (43.0, 37.0), (40.0, 34.0), (45.0, 27.0)], CX - 11.5, CX + 11.5, FEATHER, 4)
    crown = feathers(g, c0, FEATHER, 3, seed=6, width=5, row=4)
    # dark bars across the nape (the owl's barred feathers)
    bar = crown & (Y < 55.0) & ((np.floor(Y).astype(int) % 6) == 0)
    P.flat(g, bar, "darkwood", 3)
    # the heart-shaped facial disc: cream feathers in rings round each eye
    d0 = len(g.solids)
    disc = front(g, [(CX - 10.5, 52.5), (CX - 7.0, 56.5), (CX - 2.0, 55.0), (CX, 52.5), (CX + 2.0, 55.0), (CX + 7.0, 56.5), (CX + 10.5, 52.5),
                     (CX + 10.0, 44.0), (CX + 4.0, 38.5), (CX, 37.0), (CX - 4.0, 38.5), (CX - 10.0, 44.0)], FACE_Z, FACE_Z + 2.0, DISC, 5)
    for s in (-1, 1):
        ring = np.hypot(X - (CX + s * 5.0), Y - 48.5)
        own = disc & ((X - CX) * s > 0)
        P.flat(g, own & ((np.floor(ring).astype(int) % 3) == 0), DISC, 4)
        P.flat(g, own & (ring > 7.5), DISC, 6)
    P.flat(g, disc & (np.abs(X - CX) < 0.6), DISC, 3)
    inner = disc.copy()
    for ax in (0, 1):
        for step in (1, -1):
            inner &= np.roll(disc, step, axis=ax)
    P.flat(g, disc & ~inner, "darkwood", 3)  # the dark ruff round the disc
    # two huge orange eyes, bulging out of the disc
    eye = {"d": C("darkwood", 1), "o": C("orange", 5), "O": C("gold", 7), "y": C("gold", 6), "p": C("darkwood", 0), "w": C("bone", 7)}
    rows = [".dddd.",
            "dyOOyd",
            "dOppod",
            "dOppod",
            "dyooyd",
            ".dddd."]
    for s in (-1, 1):
        xc = CX + s * 5.0
        front(g, [(xc - 2.0, 45.0), (xc + 2.0, 45.0), (xc + 3.0, 46.0), (xc + 3.0, 50.0), (xc + 2.0, 51.0), (xc - 2.0, 51.0), (xc - 3.0, 50.0), (xc - 3.0, 46.0)],
              FACE_Z - 2.0, FACE_Z + 1.0, "darkwood", 2)
        pnglyph.stamp(g, "-z", FACE_Z - 2.0, int(xc - 3.0), 45, rows, eye, reach=0)
        # an angry brow: a dark feather ridge slanting down to the beak
        b0 = len(g.solids)
        front(g, quad((CX + s * 1.0, 52.0), (CX + s * 9.5, 56.0), 1.2, 1.5), FACE_Z - 1.6, FACE_Z + 3.0, "darkwood", 3)
        feathers(g, b0, "darkwood", 3, seed=7, width=4, row=3)
    # the hooked beak
    k0 = len(g.solids)
    side(g, [(48.0, FACE_Z + 1.0), (48.0, FACE_Z - 2.5), (45.5, FACE_Z - 4.5), (41.0, FACE_Z - 4.2), (39.0, FACE_Z - 2.8), (42.0, FACE_Z - 2.2), (42.5, FACE_Z + 1.0)], CX - 2.4, CX + 2.4, "stone", 4)
    beak = np.logical_or.reduce([sol.mask(g.shape) for sol in g.solids[k0:]])
    P.flat(g, beak & (Y > 46.0), "stone", 5)
    P.flat(g, beak & (np.abs(X - CX) < 0.6) & (Y > 44.0), "stone", 6)  # the lit ridge
    P.flat(g, beak & (Y < 42.5), "darkwood", 3)  # the dark hook tip
    frame_seams(g, k0, beak, steps=1)
    # two dark ear tufts, swept up and out
    for s in (-1, 1):
        t0 = len(g.solids)
        front(g, [(CX + s * 3.5, 55.0), (CX + s * 10.5, 55.0), (CX + s * 12.5, 64.5), (CX + s * 8.5, 59.0)], 12.0, 17.0, "darkwood", 2)
        tuft = feathers(g, t0, "darkwood", 2, seed=8, width=3, row=3)
        P.flat(g, tuft & (Y > 62.5), FEATHER, 5)  # pale tips
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
    parts = [("owlbear", None, None, None),
             ("body", body(), BODY_HINGE, None),
             ("head", head(), HEAD_HINGE, "body")]
    for name, (s, zc) in LEGS.items():
        fore = zc < 45
        parts.append((name, leg(name), (CX + s * (9.5 if fore else 10.0), 31.0 if fore else 30.0, zc), "body"))
    root, to_root = rig(parts)
    z = (0, 0, 0, 0)
    lift = (0, 0, 0.6, 0)
    idle = {"body": {"scale": keys((0, 1, 1, 1), (1.2, 1.02, 1.04, 1.0), (2.4, 1, 1, 1))},
            "head": {"rot": keys(z, (0.5, 0, 0, 0), (0.7, 0, 38, 4), (1.3, 0, 38, 4), (1.5, 0, 0, 0), (1.9, -6, -16, 0), (2.4, 0, 0, 0))},
            "leg-fl": {"rot": keys(z, (1.6, 0, 0, 0), (1.8, 14, 0, 0), (2.0, 0, 0, 0), (2.4, 0, 0, 0)),
                       "loc": keys(z, (1.55, *lift[1:]), (2.05, *lift[1:]), (2.1, 0, 0, 0))}}
    # rear up about the hind paws with the claws spread, then slam down
    rear = [(0.0, 0.0), (0.3, 28.0), (0.42, 3.0), (0.45, 0.0), (1.1, 0.0)]
    attack = {"body": {"rot": keys(*[(t, a, 0, 0) for t, a in rear]),
                       "loc": keys(z, (0.3, 0, 1.6, 0), (0.42, 0, 0.2, 0), (0.45, 0, 0, 0), (1.1, 0, 0, 0))},
              "head": {"rot": keys(z, (0.3, 14, 0, 0), (0.45, -16, 0, 0), (0.7, -12, 0, 0), (1.1, 0, 0, 0))},
              "leg-fl": {"rot": keys(z, (0.3, 40, 0, -14), (0.42, 8, 0, 0), (0.45, 0, 0, 0), (1.1, 0, 0, 0)),
                         "loc": keys(z, (0.05, *lift[1:]), (1.05, *lift[1:]), (1.1, 0, 0, 0))},
              "leg-fr": {"rot": keys(z, (0.3, 40, 0, 14), (0.42, 8, 0, 0), (0.45, 0, 0, 0), (1.1, 0, 0, 0)),
                         "loc": keys(z, (0.05, *lift[1:]), (1.05, *lift[1:]), (1.1, 0, 0, 0))},
              "leg-bl": {"rot": keys(z, (0.3, -26, 0, 0), (0.42, -3, 0, 0), (0.45, 0, 0, 0), (1.1, 0, 0, 0)),
                         "loc": keys(z, (0.05, *lift[1:]), (1.05, *lift[1:]), (1.1, 0, 0, 0))},
              "leg-br": {"rot": keys(z, (0.3, -26, 0, 0), (0.42, -3, 0, 0), (0.45, 0, 0, 0), (1.1, 0, 0, 0)),
                         "loc": keys(z, (0.05, *lift[1:]), (1.05, *lift[1:]), (1.1, 0, 0, 0))}}
    hit = {"head": {"rot": keys(z, (0.1, 26, 18, 8), (0.35, 20, 14, 6), (0.7, 0, 0, 0))},
           "body": {"loc": keys(z, (0.1, 0, 0, 2.5), (0.35, 0, 0, 1.6), (0.7, 0, 0, 0))}}
    q = (CX - 16.0, 0.0, BODY_HINGE[2])
    roll = [(0.0, 0.0), (0.3, 0.0), (0.8, 55.0), (1.05, 86.0), (1.25, 82.0), (1.6, 84.0)]
    death = {"body": {"rot": keys(*[(t, 0, 0, a) for t, a in roll]),
                      "loc": keys(*[(t, *about(q, BODY_HINGE, a)) for t, a in roll])},
             "head": {"rot": keys(z, (0.3, 16, 0, 0), (1.05, -14, 0, -16), (1.6, -12, 0, -18))},
             "leg-fl": {"rot": keys(z, (0.3, 30, 0, 0), (1.05, 14, 0, 8), (1.6, 12, 0, 8)), "loc": keys(z, (0.05, *lift[1:]), (1.6, *lift[1:]))},
             "leg-fr": {"rot": keys(z, (0.3, 30, 0, 0), (1.05, 24, 0, -10), (1.6, 22, 0, -10)), "loc": keys(z, (0.05, *lift[1:]), (1.6, *lift[1:]))},
             "leg-bl": {"rot": keys(z, (0.3, -24, 0, 0), (1.05, -10, 0, 8), (1.6, -9, 0, 8)), "loc": keys(z, (0.05, *lift[1:]), (1.6, *lift[1:]))},
             "leg-br": {"rot": keys(z, (0.3, -24, 0, 0), (1.05, -16, 0, -10), (1.6, -14, 0, -10)), "loc": keys(z, (0.05, *lift[1:]), (1.6, *lift[1:]))}}
    paw = to_root((CX + 9.5, 1.0, LEGS["leg-fr"][1] - 6.0))
    return asset("creatures", "owlbear", "Owlbear", root,
                 clips=[Clip("idle", keyed(root, idle)), Clip("attack", keyed(root, attack), loop=False), Clip("hit", keyed(root, hit), loop=False), Clip("death", keyed(root, death), loop=False)],
                 sockets=[Socket("socket-function", at=paw, parent="leg-fr")],
                 fx=[pfx("rvx-fantasy-dust-slam", "socket-function", "clip:attack", size=24, at=0.45)])
