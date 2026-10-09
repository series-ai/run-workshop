"""Basilisk, the serpent king, in the Pirate Nation creature style.

A long, low lizard-serpent that hugs the ground on four splayed legs: a
wedge head held up on a thick neck, a crown crest of three red spikes with
gold tips (the mark of the king), an angry scaled brow over two glowing
ember eyes with black slits, a fanged upper jaw and a lower jaw that opens,
a red dorsal frill of bone spines down the neck and back, and a long tail
that tapers and curls to one side (rule F5). Big chamfered volumes with
true slopes (F1, F2). The detail is paint (S1): rows of forest-green
scales, a row of dark diamond saddles on the spine, pale lime spots along
the flanks, sand belly plates in a dark frame, bone claws.

Clips: idle (breathe, sway the head, flick the tail), attack (rear the
head back, then lunge with the jaw wide and the eyes on the target: the
gaze PFX at the eye socket), hit (the head snaps back), death (the legs
splay, the body drops and the head falls to the ground). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
from _fcreature_beasts import frame_seams, hide, paint_solids, ring_scales, scallops
from _life import C, Clip, Grid, Socket, asset, chamfer_rect, coords, front, keys, last, pfx, plan, rig, side
from pnshapes import quad

S = (76, 50, 128)
CX = 38.0
SCALE, BELLY, CREST = "forest", "sand", "red"
BODY_Y = 15.0  # the centre line of the trunk
NECK_HINGE = (CX, 19.0, 30.0)
JAW_HINGE = (CX, 21.0, 17.0)
TAIL_HINGE = (CX, 14.0, 76.0)
LEGS = {"leg-fl": (-1, 34.0), "leg-fr": (1, 34.0), "leg-bl": (-1, 66.0), "leg-br": (1, 66.0)}


def _sec(c, r, ch):
    return chamfer_rect(c[0] - r[0], c[1] - r[1], c[0] + r[0], c[1] + r[1], min(r) * ch)


def zseg(g: Grid, c0, c1, r0, r1, z0, z1, ramp: str, shade: int, ch: float = 0.42) -> np.ndarray:
    """A chamfered frustum along z between (x, y) centres (sheared)."""
    g.prism("z", _sec(c0, r0, ch), z0, z1, C(ramp, shade), top=_sec(c1, r1, ch))
    return last(g)


def skin(g: Grid, start: int, cx, cy, base: int = 5, belly=None, seed: int = 0, radius: float = 8.0, width: int = 5, row: int = 4) -> np.ndarray:
    """Scale rows round the centre line (cx, cy) on the prisms since
    `start`, sand belly plates where `belly` is true, dark arrises. Return
    the union mask."""
    _X, Y, Z = coords(g)
    m = np.logical_or.reduce([s_.mask(g.shape) for s_ in g.solids[start:]])
    ring_scales(g, m, SCALE, base, cx, cy, Z, radius=radius, width=width, row=row, seed=seed)
    if belly is not None:
        k = np.floor(Z).astype(np.int64) % 3
        P._paint(g, m & belly, BELLY, np.where(k == 0, 2, np.where(k == 1, 5, 4)))
    frame_seams(g, start, m, steps=1)
    return m


def claws(g: Grid, xc: float, zf: float, n: int = 3, spread: float = 2.6) -> None:
    """Hooked bone claws at the front of a foot (side-view wedges)."""
    _X, Y, _Z = coords(g)
    for k in range(n):
        x = xc + (k - (n - 1) / 2) * spread
        m = side(g, [(3.0, zf + 1.5), (3.0, zf - 0.5), (1.0, zf - 3.5), (0.0, zf - 3.6), (0.5, zf + 1.5)], x - 0.9, x + 0.9, "bone", 6)
        P.flat(g, m & (Y > 2.2), "bone", 4)


def sail(g: Grid, spines, y0: float, z0: float, z1: float) -> np.ndarray:
    """A red dorsal sail (one thin side-view prism with a notched top) on
    bone spines (painted lines from the base to each tip)."""
    _X, Y, Z = coords(g)
    top = []
    for k, (z, h) in enumerate(spines):
        if k:
            zp = (spines[k - 1][0] + z) / 2.0
            top.append((y0 + min(h, spines[k - 1][1]) * 0.45, zp + 0.5))
        top.append((y0 + h, z + 1.6))
    pts = [(y0 - 1.5, z0), (y0 - 1.5, z1)] + list(reversed(top))
    m = side(g, pts, CX - 1.0, CX + 1.0, CREST, 4)
    P.flat(g, m & (Y > y0 + 2.5), CREST, 5)
    for z, h in spines:  # the bone spines, from the base to the tip
        t = np.clip((Y - y0) / h, 0.0, 1.0)
        line = m & (np.abs(Z - (z + 1.6 * t)) < 0.75) & (Y > y0 - 0.5)
        P.flat(g, line, "bone", 6)
        P.flat(g, line & (t > 0.7), "bone", 7)
    P.flat(g, m & (Y < y0), CREST, 3)  # the dark root of the sail
    return m


# ------------------------------------------------------------------ parts
def body() -> Grid:
    """The low trunk: chest, belly and hips, with the dorsal frill and the
    spine saddles. The root part."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    start = len(g.solids)
    zseg(g, (CX, BODY_Y), (CX, BODY_Y + 0.5), (8.5, 6.5), (11, 8), 26, 40, SCALE, 4)
    zseg(g, (CX, BODY_Y + 0.5), (CX, BODY_Y), (11, 8), (11.5, 8), 40, 62, SCALE, 4)
    zseg(g, (CX, BODY_Y), (CX, BODY_Y - 1), (11.5, 8), (8.5, 6.5), 62, 78, SCALE, 4)
    belly = Y < BODY_Y - 4.5
    trunk = skin(g, start, CX, BODY_Y, belly=belly, seed=1, radius=9.0)
    # a dark line frames the belly plates
    P.flat(g, trunk & (np.abs(Y - (BODY_Y - 4.0)) < 0.6), SCALE, 2)
    # the back is one shade darker than the flanks
    P.darken(g, trunk & (Y > BODY_Y + 5.0), 1)
    # a row of dark diamond saddles down the spine, each with a gold eye
    zz = (Z - 30.0) % 10.0 - 5.0
    d = np.abs(X - CX) * 0.7 + np.abs(zz)
    saddle = trunk & (Y > BODY_Y + 3) & (d < 4.8) & (Z > 30) & (Z < 76)
    P.flat(g, saddle, SCALE, 2)
    P.flat(g, saddle & (d < 2.2), "gold", 5)
    # small pale diamonds in a row along each flank
    zs = (Z - 33.0) % 8.0 - 4.0
    dd = np.abs(Y - (BODY_Y + 1.0)) * 1.4 + np.abs(zs)
    spot = trunk & (dd < 2.6) & (np.abs(X - CX) > 8) & (Z > 30) & (Z < 74)
    P.flat(g, spot, SCALE, 2)
    P.flat(g, spot & (dd < 1.5), "lime", 4)
    sail(g, [(30, 7.0), (38, 8.0), (46, 8.5), (54, 8.0), (62, 7.0), (70, 5.0)], BODY_Y + 6.5, 27.0, 75.0)
    return g


def neck_head() -> Grid:
    """The neck, the wedge head, the brow, the eyes, the fangs and the crown
    crest (the jaw is its own part)."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    start = len(g.solids)
    zseg(g, (CX, 24.0), (CX, BODY_Y + 1.0), (6.5, 5.5), (8.5, 6.5), 15, 31, SCALE, 5)
    zseg(g, (CX, 25.0), (CX, 27.0), (4.8, 2.6), (8.0, 5.0), 0.5, 15, SCALE, 5)
    zseg(g, (CX, 27.0), (CX, 25.5), (8.0, 5.0), (7.0, 5.0), 15, 21, SCALE, 5)
    throat = (Y < 21.0) & (Z > 16) & (np.abs(X - CX) < 5.0)
    m = skin(g, start, CX, np.interp(Z, [0, 15, 31], [25.0, 27.0, BODY_Y + 1.0]), belly=throat, seed=2, radius=6.0, width=4, row=3)
    P.darken(g, m & (Y > 30.0), 1)  # the dark crown of the head
    # the mouth line along the sides of the snout, dark, with a lit lip
    P.flat(g, m & (Y < 23.4) & (Z < 16), SCALE, 2)
    P.flat(g, m & (Y >= 23.4) & (Y < 24.4) & (Z < 16), SCALE, 6)
    # nostrils on the snout tip
    P.flat(g, m & (Z < 1.6) & (np.abs(np.abs(X - CX) - 2.0) < 0.6) & (Y > 26.0) & (Y < 27.0), SCALE, 3)
    # two big eye domes on the top of the head, glowing ember slit eyes
    eye = {"d": C("darkwood", 1), "e": C("ember", 3), "E": C("ember", 5), "p": C("darkwood", 0), "r": C("red", 4)}
    for s in (-1, 1):
        e0 = len(g.solids)
        xc = CX + s * 5.5
        front(g, [(xc - 2.5, 28.8), (xc + 2.5, 28.8), (xc + 3.0, 31.4), (xc + 2.5, 34.0), (xc - 2.5, 34.0), (xc - 3.0, 31.4)], 7.0, 14.0, SCALE, 5)
        paint_solids(g, e0, lambda gg, mm, fr: hide(gg, mm, SCALE, 5, frame=fr, seed=3, cell=(4, 3)))
        frame_seams(g, e0, steps=1)
        pnglyph.stamp(g, "-z", 7.0, int(xc - 2.5), 29, [".rrr.", "reper", "eEpEe", "eEpEe", ".rer."], eye, reach=0)
        side_face = "-x" if s < 0 else "+x"
        pnglyph.stamp(g, side_face, xc + s * 3.0, 8, 29, ["rrrr", "eEpE", "eEpE", "rerr"], eye)
        # an angry brow over the eye (a true-slope ridge, low at the snout)
        b0 = len(g.solids)
        front(g, quad((CX + s * 2.0, 34.4), (CX + s * 9.0, 36.4), 1.0, 1.3), 6.6, 11.0, SCALE, 3)
        paint_solids(g, b0, lambda gg, mm, fr: scallops(gg, mm, SCALE, 3, frame=fr, width=4, row=3, seed=4, streak=False))
        frame_seams(g, b0)
    # fangs: two long bone fangs and four short teeth hang from the upper jaw
    for x, z, h in ((CX - 3.4, 3.6, 4.8), (CX + 2.2, 3.6, 4.8)):
        t = side(g, [(23.4, z - 1.3), (23.4, z + 1.3), (23.4 - h, z - 0.2)], x, x + 1.2, "bone", 7)
        P.flat(g, t & (Y > 22.4), "bone", 5)
    for x in (CX - 6.0, CX + 4.8):
        for z in (7.5, 11.5):
            side(g, [(23.6, z - 0.9), (23.6, z + 0.9), (21.4, z)], x, x + 1.2, "bone", 6)
    # the crown crest: three red spikes with gold tips on a gold band
    c0 = len(g.solids)
    front(g, [(CX - 6.0, 30.5), (CX + 6.0, 30.5), (CX + 6.0, 33.5), (CX + 8.0, 41.0), (CX + 3.2, 35.8), (CX, 44.5),
              (CX - 3.2, 35.8), (CX - 8.0, 41.0), (CX - 6.0, 33.5)], 14.5, 18.5, CREST, 4)
    crown = np.logical_or.reduce([s_.mask(g.shape) for s_ in g.solids[c0:]])
    P.flat(g, crown & (Y > 35.0), CREST, 5)
    P.flat(g, crown & (Y > 35.0) & (np.abs(np.abs(X - CX) - 5.0) < 0.7), CREST, 3)  # the dark splits between spikes
    P.flat(g, crown & (Y > 39.5), "gold", 6)
    P.flat(g, crown & (Y > 42.0), "gold", 7)
    band = crown & (Y < 33.8)
    P.flat(g, band, "gold", 5)
    P.flat(g, band & (Y < 31.5), "gold", 3)
    P.flat(g, band & (np.abs(X - CX) < 1.2) & (Y > 31.5), "red", 5)  # a ruby on the band
    P.flat(g, band & (np.abs(np.abs(X - CX) - 4.0) < 0.7) & (Y > 31.5), "sky", 5)  # two sapphires
    frame_seams(g, c0)
    sail(g, [(20.0, 6.0), (25.5, 6.0)], 28.5, 18.5, 29.0)
    return g


def jaw() -> Grid:
    """The lower jaw with a pale throat and a row of teeth."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    start = len(g.solids)
    zseg(g, (CX, 21.9), (CX, 21.0), (4.0, 1.6), (6.6, 2.6), 2.5, 18, SCALE, 4)
    throat = Y < 20.6
    m = skin(g, start, CX, 21.5, belly=throat, seed=4, radius=6.0, width=4, row=3)
    P.flat(g, m & (Y > 22.8), "red", 3)  # the red inside of the mouth
    for x in (CX - 4.0, CX + 2.8):
        for z in (5.0, 9.5):
            t = side(g, [(23.0, z - 0.8), (23.0, z + 0.8), (25.0, z)], x, x + 1.2, "bone", 7)
            P.flat(g, t & (Y < 23.6), "bone", 5)
    return g


def leg(name: str) -> Grid:
    """A splayed lizard leg: an upper leg out to the side, a forearm down to
    a broad foot with three toes and bone claws."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    s, zc = LEGS[name]
    start = len(g.solids)
    front(g, quad((CX + s * 7.0, BODY_Y - 0.5), (CX + s * 17.0, 12.5), 3.6, 3.0), zc - 3.4, zc + 3.4, SCALE, 4)
    front(g, quad((CX + s * 17.0, 13.0), (CX + s * 19.0, 3.5), 3.0, 2.6), zc - 3.0, zc + 3.0, SCALE, 4)
    xf = CX + s * 19.0
    plan(g, chamfer_rect(xf - 4.0, zc - 6.0, xf + 4.0, zc + 4.0, 1.5), 0, 3.5, SCALE, 3,
         top=chamfer_rect(xf - 3.0, zc - 4.5, xf + 3.0, zc + 3.0, 1.0))
    m = paint_solids(g, start, lambda gg, mm, fr: hide(gg, mm, SCALE, 5, frame=fr, seed=5 + int(zc), cell=(4, 4)))
    frame_seams(g, start, m, steps=1)
    P.flat(g, m & (Y < 1.0), SCALE, 2)
    foot = m & (Y < 3.5)
    for k in (-1, 1):  # toe splits
        P.flat(g, foot & (np.abs(X - (xf + k * 1.3)) < 0.5) & (Z < zc - 2.0), SCALE, 1)
    claws(g, xf, zc - 5.6)
    return g


def tail() -> Grid:
    """A long tail that tapers and curls to the right, with small bone
    spines down its ridge and a red fin at the tip."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    start = len(g.solids)
    path = [((CX, 14.5), (8.5, 6.5), 74), ((CX + 2.0, 11.0), (6.6, 5.0), 84), ((CX + 7.0, 7.5), (4.6, 3.6), 94),
            ((CX + 14.0, 5.0), (2.8, 2.4), 103), ((CX + 21.0, 3.2), (1.0, 1.0), 109)]
    for (c0, r0, z0), (c1, r1, z1) in zip(path, path[1:]):
        zseg(g, c0, c1, r0, r1, z0, z1, SCALE, 4)
    zs = [p[2] for p in path]
    m = skin(g, start, np.interp(Z, zs, [p[0][0] for p in path]), np.interp(Z, zs, [p[0][1] for p in path]),
             belly=Y < np.interp(Z, [74, 109], [9.5, 2.6]), seed=6, radius=6.0)
    P.darken(g, m & (Y > np.interp(Z, [74, 109], [18.0, 3.8])), 1)
    # dark bands round the tail, two scale rows wide
    P.darken(g, m & ((np.floor(Z).astype(int) % 9) < 2) & (Z < 103) & (Y > np.interp(Z, [74, 109], [9.5, 2.6])), 1)
    for z in (80.0, 88.0, 96.0):
        xc = float(np.interp(z, [74, 84, 94, 103], [CX, CX + 2.0, CX + 7.0, CX + 14.0]))
        y = float(np.interp(z, [74, 84, 94, 103], [21.0, 16.0, 11.0, 7.4]))
        sp = side(g, quad((y - 1.0, z), (y + 3.6, z + 2.0), 1.0, 0.4, cap=0.8), xc - 1.0, xc + 1.0, "bone", 6)
        P.flat(g, sp & (Y > y + 2.2), "bone", 7)
    fin = front(g, [(CX + 15.0, 6.5), (CX + 22.5, 3.5), (CX + 25.5, 9.5), (CX + 19.0, 9.0)], 105.0, 107.5, CREST, 5)
    P.flat(g, fin & (Y > 7.5), CREST, 6)
    P.flat(g, fin & (X > CX + 24.0), "gold", 6)
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
    parts = [("basilisk", body(), None, None),
             ("head", neck_head(), NECK_HINGE, None),
             ("jaw", jaw(), JAW_HINGE, "head"),
             ("tail", tail(), TAIL_HINGE, None)]
    for name, (s, zc) in LEGS.items():
        parts.append((name, leg(name), (CX + s * 7.0, BODY_Y - 0.5, zc), None))
    root, to_root = rig(parts)
    z = (0, 0, 0, 0)
    idle = {"basilisk": {"scale": keys((0, 1, 1, 1), (1.0, 1.02, 1.04, 1.0), (2.0, 1, 1, 1))},
            "head": {"rot": keys(z, (0.5, 4, 10, 0), (1.0, 0, 0, 0), (1.5, 4, -10, 0), (2.0, 0, 0, 0))},
            "jaw": {"rot": keys(z, (0.8, 0, 0, 0), (1.0, -8, 0, 0), (1.2, 0, 0, 0), (2.0, 0, 0, 0))},
            "tail": {"rot": keys(z, (0.5, 0, 10, 0), (1.5, 0, -10, 0), (2.0, 0, 0, 0))}}
    # the gaze: rear the head back, then lunge with the jaw wide open
    attack = {"head": {"rot": keys(z, (0.18, 22, 0, 0), (0.35, -4, 0, 0), (0.6, -3, 0, 0), (1.0, 0, 0, 0)),
                       "loc": keys(z, (0.18, 0, 1.0, 3.0), (0.35, 0, 0, -4.0), (0.6, 0, 0, -3.5), (1.0, 0, 0, 0))},
              "jaw": {"rot": keys(z, (0.18, -10, 0, 0), (0.35, -28, 0, 0), (0.6, -26, 0, 0), (1.0, 0, 0, 0))},
              "basilisk": {"loc": keys(z, (0.18, 0, 0, 1.5), (0.35, 0, 0, -2.0), (1.0, 0, 0, 0))},
              "tail": {"rot": keys(z, (0.18, 0, -18, 0), (0.35, 0, 22, 0), (0.7, 0, 8, 0), (1.0, 0, 0, 0))},
              "leg-fl": {"rot": keys(z, (0.18, 0, 0, -6), (0.35, 0, 0, -2), (1.0, 0, 0, 0))},
              "leg-fr": {"rot": keys(z, (0.18, 0, 0, 6), (0.35, 0, 0, 2), (1.0, 0, 0, 0))}}
    hit = {"head": {"rot": keys(z, (0.1, 24, -14, 8), (0.35, 18, -10, 5), (0.7, 0, 0, 0))},
           "jaw": {"rot": keys(z, (0.1, -18, 0, 0), (0.7, 0, 0, 0))},
           "basilisk": {"loc": keys(z, (0.1, 0, 0, 2.0), (0.7, 0, 0, 0))},
           "tail": {"rot": keys(z, (0.1, 0, 16, 0), (0.7, 0, 0, 0))}}
    death = {"basilisk": {"loc": keys(z, (0.3, 0, 0.5, 0), (0.9, 0, -3.5, 0), (1.4, 0, -3.5, 0))},
             "head": {"rot": keys(z, (0.3, 16, 0, 0), (0.9, -8, 0, -14), (1.4, -7, 8, -16))},
             "jaw": {"rot": keys(z, (0.9, -16, 0, 0), (1.4, -12, 0, 0))},
             "tail": {"rot": keys(z, (0.9, -8, 18, 0), (1.4, -7, 14, 0))},
             "leg-fl": {"rot": keys(z, (0.9, 0, 0, -30), (1.4, 0, 0, -28))},
             "leg-fr": {"rot": keys(z, (0.9, 0, 0, 30), (1.4, 0, 0, 28))},
             "leg-bl": {"rot": keys(z, (0.9, 0, 0, -30), (1.4, 0, 0, -28))},
             "leg-br": {"rot": keys(z, (0.9, 0, 0, 30), (1.4, 0, 0, 28))}}
    gaze = to_root((CX, 28.0, 4.0))
    return asset("creatures", "basilisk", "Basilisk", root,
                 clips=[Clip("idle", keyed(root, idle)), Clip("attack", keyed(root, attack), loop=False), Clip("hit", keyed(root, hit), loop=False), Clip("death", keyed(root, death), loop=False)],
                 sockets=[Socket("socket-function", at=gaze, parent="head")],
                 fx=[pfx("rvx-fantasy-holy-smite", "socket-function", "clip:attack", size=20, at=0.35)])
