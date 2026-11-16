"""Living gargoyle, in the Pirate Nation creature style.

A chunky caricature in the family of the werewolf and the PN big
skull: a crouching demon of grey haunted stone (as the PN haunted
buildings: grey blocks, light stone brow, chest and lit tops, moss in the
hollows), with an oversized horned head, a heavy
angry brow over glowing toxic-green eyes, a wide fanged jaw; a hunched barrel
chest cracked with glowing toxic veins; long gorilla arms on huge clawed
knuckles; crouched legs with taloned feet; broad bat wings of dark stone
membrane on light stone finger bones raised behind it; a long tail ending in a spade. Everything is a
true-slope prism; the stone blocks, cracks, moss and glow are paint.
Clips: idle (wings flex, head turns, tail sways), move (a heavy hop-glide
on a wing beat), attack (leap and claw), death (topples over backwards). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _hitq import quick_hit
from _kit import keys, pfx, world
from _life import assemble, chunk, claw, coords, front, limb, moss_top, side
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

Z3 = (0.0, 0.0, 0.0)


def fr(n: float) -> float:
    """Seconds of frame `n` at 30 fps (impact keys sit on whole frames)."""
    return n / 30.0


S = (66, 52, 44)
CX, CZ = 33, 20
HIDE, WING = "gray", "stone"
BODY = (CX, 12.0, 22.0)
NECK = (CX, 31.0, 14.0)
TAILBASE = (CX, 15.0, 29.0)
SHOULDER = {"arm-l": (CX - 8.5, 29.0, 13.0), "arm-r": (CX + 8.5, 29.0, 13.0)}
WINGROOT = {"wing-l": (CX - 6.0, 30.0, 27.0), "wing-r": (CX + 6.0, 30.0, 27.0)}


def hide(g: Grid, m: np.ndarray, base: int, seed: int, frame=None) -> None:
    """Carved stone hide: big blocks with mortar lines and cracks."""
    P.stone(g, m, HIDE, base, block=(6, 5), cracks=0.15, frame=frame, seed=seed)


def lit_tops(g: Grid, m: np.ndarray, seed: int) -> None:
    """Light stone on the upward faces (the lit tops of PN haunted stone)."""
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    P.stone(g, m & up, HIDE, 7, block=(6, 5), cracks=0.0, frame="top", seed=seed)


def veins(g: Grid, m: np.ndarray, seed: int) -> None:
    """Glowing cursed cracks (C3): a few jagged lines of toxic light."""
    X, Y, Z = coords(g)
    for k, (x0, y0, dx) in enumerate(((CX - 4, 26, 1), (CX + 3, 22, -1), (CX - 1, 18, 1))):
        t = Y - y0
        line = (np.abs(X + 0.5 - (x0 + dx * (t // 2) + (t % 3 == 0))) < 1.1) & (t >= 0) & (t < 8)
        P.flat(g, m & line, "toxic", 5)
        P.flat(g, m & line & (np.abs(X + 0.5 - (x0 + dx * (t // 2) + (t % 3 == 0))) < 0.6), "toxic", 7)


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    torso = side(g, [(12, 13), (12, 29), (22, 31), (31, 28), (34, 20), (31, 11), (21, 10)], CX - 9, CX + 9, HIDE, 5)
    chest = side(g, [(15, 11.5), (30, 10.5), (32, 16), (16, 16)], CX - 6.5, CX + 6.5, "gray", 6)
    hide(g, torso, 5, seed=1)
    P.stone(g, chest, "gray", 6, block=(5, 3), cracks=0.05, seed=2)
    veins(g, chest | torso, seed=3)
    limbs = np.zeros(g.shape, dtype=bool)
    claws = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        # crouched legs: thigh forward, shin back down, a big taloned foot
        x0, x1 = CX + s * 8 - 3.5, CX + s * 8 + 3.5
        limbs |= limb(g, "x", (15, 24), (11, 13), 4.5, 3.8, x0, x1, HIDE, 5, cap=0.4)
        limbs |= limb(g, "x", (11, 13.5), (3, 19), 3.4, 3.0, x0 + 0.5, x1 - 0.5, HIDE, 5, cap=0.4)
        limbs |= box(g, x0, 0, 11, x1, 4, 22, HIDE, 4)
        for k in range(3):
            cxk = x0 + 0.8 + k * 2.2
            claws |= claw(g, "x", (2.5, 11.5), (0.2, 7.5), 1.4, cxk, cxk + 1.6, "bone", 6)
    hide(g, limbs, 5, seed=4)
    P.flat(g, claws & (Y < 1.5), "bone", 5)
    lit_tops(g, torso | limbs, seed=15)
    moss_top(g, (torso | limbs) & (Y > 8), depth=2, seed=5, patchy=0.3)
    return g


def arm(s: int) -> Grid:
    """A gorilla arm on a huge clawed knuckle (its own part, so it can swing
    from the shoulder)."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + s * 12.5
    m = limb(g, "z", (CX + s * 8.5, 30), (sx + s * 2, 17), 4.0, 3.4, 9, 17, HIDE, 5, cap=0.4)
    m |= limb(g, "z", (sx + s * 2, 17.5), (sx + s * 1, 6), 3.4, 3.2, 7, 14, HIDE, 5, cap=0.4)
    m |= box(g, sx + s * 1 - 4.5, 0, 3, sx + s * 1 + 4.5, 7, 13, HIDE, 4)
    claws = np.zeros(g.shape, dtype=bool)
    for k in range(4):
        cxk = sx + s * 1 - 4 + k * 2.2
        claws |= claw(g, "x", (3.0, 3.5), (0.2, -0.0 + 0.4), 1.3, cxk, cxk + 1.5, "bone", 6)
    hide(g, m, 5, seed=4)
    P.flat(g, claws & (Y < 1.5), "bone", 5)
    lit_tops(g, m, seed=15)
    moss_top(g, m & (Y > 8), depth=2, seed=5, patchy=0.3)
    return g


def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    skull = chunk(g, CX, 13, 30, 44, 8.5, 7.5, 2.5, HIDE, 5, taper=1.0)
    snout = side(g, [(30, 3), (30, 10), (38, 10), (37, 4.5)], CX - 6, CX + 6, HIDE, 5)
    jaw = side(g, [(27, 5), (27, 13), (31, 13), (31, 4)], CX - 5.5, CX + 5.5, HIDE, 4)
    hide(g, skull | snout, 5, seed=6)
    P.stone(g, jaw, HIDE, 4, block=(4, 3), seed=7)
    brow = np.zeros(g.shape, dtype=bool)
    horns = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        # an angry brow slab slanting down to the nose (like the PN big skull)
        brow |= front(g, [(CX + s * 0.5, 38.5), (CX + s * 8.8, 42), (CX + s * 8.8, 44.2), (CX + s * 0.5, 41)], 4.5, 9, HIDE, 6)
        # curled horns: out, up and back (true slopes)
        horns |= limb(g, "z", (CX + s * 6.5, 42), (CX + s * 12, 46), 2.2, 1.7, 11, 16, "bone", 5, cap=0.3)
        horns |= claw(g, "z", (CX + s * 11.6, 45.5), (CX + s * 12.5, 51.5), 1.6, 11.5, 15.5, "bone", 6)
        # pointed ears
        front(g, [(CX + s * 8.2, 36), (CX + s * 8.2, 40), (CX + s * 13, 41)], 12, 15, HIDE, 4)
    P.stone(g, brow, "gray", 6, block=(5, 3), seed=8)
    P.flat(g, horns & ((Y % 3) == 0), "bone", 4)  # horn rings
    # eyes: big toxic glow under the brow; nostrils; fangs on the jaw
    eye = {"k": C(HIDE, 1), "o": C("toxic", 6), "w": C("toxic", 7), "y": C("toxic", 7)}
    rows = ["kkkk...kkkk", "kwyo...oywk", "kyoo...ooyk", "kkkk...kkkk"]
    pnglyph.stamp(g, "-z", 5.5, CX - 5, 34, rows, eye, depth=2, reach=4)
    P.flat(g, snout & (Z < 4) & (Y >= 35) & (Y < 37) & (np.abs(np.abs(X + 0.5 - CX) - 2.5) < 1), HIDE, 2)
    mouth = jaw & (Z < 5.5) & (Y >= 29) & (Y < 31)
    P.flat(g, mouth, "blood", 3)
    for fx in (CX - 4, CX + 3):
        claw(g, "z", (fx + 0.5, 31), (fx + 0.5, 27.2), 1.1, 3.2, 5.2, "bone", 7)
    lit_tops(g, skull | snout, seed=16)
    pnpaint.blotch(g, skull & (Y >= 43), "moss", 5, cell=3, chance=0.12, seed=9)
    return g


def wing(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    u = lambda v: CX + s * v  # noqa: E731
    pts = [(u(5), 28), (u(12), 40), (u(20), 49), (u(31), 45), (u(28), 35), (u(24.5), 37.5), (u(21), 29), (u(16.5), 32), (u(12), 24)]
    m = front(g, pts, 27, 29, WING, 4)
    P.mottle(g, m, WING, 4, cell=3, seed=10 + s)
    arm = limb(g, "z", (u(5), 30), (u(20), 48.5), 1.8, 1.4, 26.5, 29.5, HIDE, 5, cap=0.3)
    arm |= limb(g, "z", (u(20), 48.5), (u(31), 45), 1.3, 1.0, 26.5, 29.5, HIDE, 5, cap=0.3)
    hide(g, arm, 5, seed=12)
    # finger bones from the wing wrist to each scallop point
    U = np.abs(X + 0.5 - CX)
    for (u1, v1) in ((28, 35), (21, 29), (12, 24)):
        u0, v0 = 20.0, 48.0
        d = np.abs((v1 - v0) * (U - u0) - (u1 - u0) * (Y + 0.5 - v0)) / np.hypot(v1 - v0, u1 - u0)
        P.flat(g, m & (d < 0.8) & (U >= min(u0, u1) - 0.5) & (U <= max(u0, u1) + 0.5), HIDE, 6)
    P.flat(g, m & (Y > 44), WING, 5)
    pnpaint.blotch(g, m & (Y < 34), "moss", 5, cell=2, chance=0.12, seed=13 + s)
    claw(g, "z", (u(20), 49), (u(19), 52), 1.0, 27, 29, "bone", 6)  # wing thumb
    return g


def tail() -> Grid:
    g = Grid(*S)
    m = limb(g, "x", (15, 29), (8, 38), 2.6, 2.0, CX - 2.2, CX + 2.2, HIDE, 5, cap=0.4)
    m |= limb(g, "x", (8, 38), (4, 42.5), 2.0, 1.6, CX - 1.8, CX + 1.8, HIDE, 5, cap=0.4)
    hide(g, m, 5, seed=14)
    spade = side(g, [(5, 41), (1.5, 43.5), (4.5, 44), (7, 43)], CX - 3, CX + 3, HIDE, 6)
    P.outline(g, spade, HIDE, 4)
    return g


# ------------------------------------------------------------------ move


def _move() -> dict:
    """Move: a heavy stone hop-glide, 1.2 s (36 frames, two hops), keyed
    once a frame (play with ease=0). It slams down on its taloned feet and
    knuckles in a squash (a 1-frame stop), rocks back with the weight,
    sinks and loads, leans in and rolls onto its toes, and pushes off in 3
    frames on a hard wing downbeat, the arms flung back as the knuckles
    leave the floor; a true ballistic arc (G 30 m/s^2, about 8 voxels high), arms
    reaching forward and the wings spread to glide, then raised to brake
    as it drops onto the next landing at full speed. Feet and knuckles are
    solved to sit exactly on the floor through every ground frame. The
    head and tail trail the body by a frame or two."""
    T, H, TO = 36, 18, 9  # loop, frames per hop, take-off (the last ground frame)
    g = 750.0 / 900.0  # G 30 m/s^2 in voxels per frame^2
    air = H - TO
    v0 = g * air / 2
    # contact points (y, z) from the body pivot (feet) and from the shoulder (knuckles)
    feet = [(-11.8, -14.5), (-12.0, -11.0), (-12.0, 0.0)]
    knuckles = [(-28.8, -12.6), (-29.0, -10.0), (-29.0, 0.0)]
    sh = (SHOULDER["arm-l"][1] - BODY[1], SHOULDER["arm-l"][2] - BODY[2])
    sq = [0.86, 0.9, 0.96, 0.99, 0.97, 0.93, 0.91, 0.95, 1.05, 1.1, 1.07, 1.02, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
    lean = [-4.0, -2.0, 1.0, 2.5, 1.5, -1.5, -5.0, -9.0, -13.0, -16.0, -17.0, -16.0, -14.0, -12.0, -10.0, -8.0, -6.5, -5.0]
    # arms (+x swings the hanging arm forward): planted on the knuckles through the push, flung
    # back as they leave the floor, then reaching forward for the landing
    arm = [None, None, None, None, None, None, None, None, None, None, 0.0, -7.0, 4.0, 17.0, 22.0, 19.0, 13.0, 7.0]
    wing = [-30.0, -38.0, -34.0, -24.0, -18.0, -24.0, -34.0, -42.0, -12.0, 16.0, 30.0, 24.0, 12.0, 4.0, 0.0, -8.0, -16.0, -24.0]
    tail = [-6.0, -2.0, -1.0, -3.0, -4.0, -5.0, -6.0, -8.0, -12.0, -18.0, -24.0, -24.0, -20.0, -16.0, -13.0, -11.0, -9.0, -8.0]
    head = [2.0, -6.0, -9.0, -6.0, -2.0, 0.0, 3.0, 6.0, 9.0, 12.0, 14.0, 13.0, 11.0, 9.0, 7.0, 5.0, 4.0, 3.0]

    def rot(p, a):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        return (p[0] * c - p[1] * s, p[0] * s + p[1] * c)  # +a tips the top back (+z)

    def low(d, b):
        """The lowest contact point (y from the rest pivot height) with
        the body squashed and leaned, the arms turned b."""
        sy = sq[d]
        sxz = 1.0 / math.sqrt(sy)
        pts = [rot((y * sy, z * sxz), lean[d]) for y, z in feet]
        for y, z in knuckles:
            ky, kz = rot((y, z), b)  # +b swings the hanging arm forward (-z)
            pts.append(rot(((sh[0] + ky) * sy, (sh[1] + kz) * sxz), lean[d]))
        return min(p[0] for p in pts), min(p[0] for p in pts[:len(feet)]), min(p[0] for p in pts[len(feet):])

    def planted(d):
        """The smallest arm turn that keeps the knuckles out of the floor
        with the feet on it (a forward lean digs them in)."""
        foot = low(d, 0.0)[1]
        for k in range(0, 161):
            for b in ((k * 0.25, -k * 0.25) if lean[d] >= 0 else (-k * 0.25, k * 0.25)):
                if low(d, b)[2] >= foot - 0.02:
                    return b
        return 0.0

    arms = [arm[d] if arm[d] is not None else planted(d) for d in range(H)]
    need = [-12.0 - low(d, arms[d])[0] for d in range(H)]
    pose = []
    for d in range(H):
        y = need[d]
        if d > TO:  # airborne: a parabola from the take-off height to the next landing
            t = d - TO
            y = max(need[d], need[TO] + (need[0] - need[TO]) * t / air + v0 * t - g * t * t / 2)
        pose.append((y, arms[d]))
    lag = lambda tbl, f, n: tbl[(f - n) % H]  # noqa: E731

    def pf(fn):
        return [(fr(f), tuple(float(c) for c in fn(f % T))) for f in range(T + 1)]

    return {"body": {"loc": pf(lambda f: (0, pose[f % H][0], 0)),
                     "rot": pf(lambda f: (lean[f % H], 0, 0)),
                     "scale": pf(lambda f: (1 / math.sqrt(sq[f % H]), sq[f % H], 1 / math.sqrt(sq[f % H])))},
            "arm-l": {"rot": pf(lambda f: (pose[f % H][1], 0, 0))},
            "arm-r": {"rot": pf(lambda f: (pose[f % H][1], 0, 0))},
            "wing-l": {"rot": pf(lambda f: (0, 0.3 * wing[f % H], wing[f % H]))},
            "wing-r": {"rot": pf(lambda f: (0, -0.3 * wing[(f - 1) % H], -wing[(f - 1) % H]))},
            "tail": {"rot": pf(lambda f: (lag(tail, f, 2), 0, 6.0 * math.sin(2 * math.pi * (f - 3) / T)))},
            "head": {"rot": pf(lambda f: (lag(head, f, 1), 4.0 * math.sin(2 * math.pi * (f - 4) / T), 0))}}


def build():
    parts = {"body": body(), "head": head(), "tail": tail(), "wing-l": wing(-1), "wing-r": wing(1), "arm-l": arm(-1), "arm-r": arm(1)}
    root = assemble(parts, [
        ("body", None, BODY),
        ("arm-l", "body", SHOULDER["arm-l"]),
        ("arm-r", "body", SHOULDER["arm-r"]),
        ("head", "body", NECK),
        ("tail", "body", TAILBASE),
        ("wing-l", "body", WINGROOT["wing-l"]),
        ("wing-r", "body", WINGROOT["wing-r"]),
    ])
    flex = lambda s: keys((0, (0, 0, 0)), (0.8, (0, -s * 12, -s * 10)), (1.6, (0, 0, 0)))  # noqa: E731
    idle = {"wing-l": {"rot": flex(1)}, "wing-r": {"rot": flex(-1)},
            "head": {"rot": keys((0, (0, 0, 0)), (0.8, (0, 15, 0)), (1.6, (0, 0, 0)))},
            "tail": {"rot": keys((0, (0, -15, 0)), (0.8, (0, 15, 0)), (1.6, (0, -15, 0)))},
            "body": {"loc": keys((0, (0, 0, 0)), (0.8, (0, 0.8, 0)), (1.6, (0, 0, 0)))}}
    # Attack, a pouncing claw strike. It rears up with the stone arms swung
    # back and the wings raised (frames 0-5), sinks into a 4-frame crouch
    # (9-13), explodes off the floor in 2 frames on a hard wing beat (to 15),
    # flies in with both clawed hands thrust out in front at chest height and
    # hits on frame 20, rakes them down through the target as it lands in a
    # crouch, flails the arms wide and back for a second swipe, snarls with
    # a head shake, and hops back to rest by frame 50.
    attack = {"body": {"rot": keys((0, Z3), (fr(5), (6, 0, 0)), (fr(9), (0, 0, 0)), (fr(13), (-6, 0, 0)), (fr(15), (-12, 0, 0)),
                                   (fr(18), (-14, 0, 0)), (fr(20), (-16, 0, 0)), (fr(23), (-20, 0, 0)), (fr(27), (-14, 6, 0)),
                                   (fr(32), (-12, -6, 0)), (fr(40), (-2, 0, 0)), (fr(45), (2, 0, 0)), (fr(50), Z3)),
                       "loc": keys((0, Z3), (fr(5), (0, 0.1, 2)), (fr(9), (0, -0.2, 1.5)), (fr(13), (0, -0.4, 1)), (fr(15), (0, 4.0, -5)),
                                   (fr(18), (0, 5.5, -11)), (fr(20), (0, 2.4, -14.5)), (fr(23), (0, 1.8, -16.5)), (fr(27), (0, 1.6, -17)),
                                   (fr(32), (0, 1.5, -16.5)), (fr(39), (0, 4.5, -6)), (fr(43), (0, -1.2, -1.2)), (fr(46), (0, 0.0, -0.4)), (fr(50), Z3)),
                       "scale": keys((0, (1, 1, 1)), (fr(9), (1.02, 0.97, 1.02)), (fr(13), (1.08, 0.84, 1.08)), (fr(15), (0.94, 1.12, 0.94)),
                                     (fr(19), (1, 1, 1)), (fr(23), (1.04, 0.95, 1.04)), (fr(27), (1, 1, 1)), (fr(39), (0.97, 1.04, 0.97)), (fr(43), (1.07, 0.9, 1.07)), (fr(47), (0.99, 1.01, 0.99)), (fr(50), (1, 1, 1)))},
              "arm-l": {"rot": keys((0, Z3), (fr(5), (-35, 0, -8)), (fr(13), (-50, 0, -14)), (fr(15), (20, 0, -20)), (fr(18), (70, 0, -10)),
                                    (fr(20), (86, 0, -6)), (fr(23), (30, 0, -12)), (fr(27), (60, 0, -55)), (fr(31), (20, 0, -20)),
                                    (fr(37), (-10, 0, -6)), (fr(44), (8, 0, 0)), (fr(50), Z3))},
              "arm-r": {"rot": keys((0, Z3), (fr(6), (-35, 0, 8)), (fr(13), (-50, 0, 14)), (fr(15), (16, 0, 20)), (fr(18), (66, 0, 10)),
                                    (fr(20), (84, 0, 6)), (fr(24), (40, 0, 60)), (fr(28), (24, 0, 14)), (fr(32), (50, 0, 30)),
                                    (fr(38), (-8, 0, 6)), (fr(45), (6, 0, 0)), (fr(50), Z3))},
              "wing-l": {"rot": keys((0, Z3), (fr(5), (0, 0, -45)), (fr(13), (0, -10, -60)), (fr(15), (0, 10, 30)), (fr(18), (0, 0, -40)),
                                     (fr(21), (0, 14, 20)), (fr(25), (0, -6, -30)), (fr(30), (0, 6, 14)), (fr(37), (0, 0, -20)), (fr(43), (0, 0, 10)), (fr(50), Z3))},
              "wing-r": {"rot": keys((0, Z3), (fr(5), (0, 0, 45)), (fr(13), (0, 10, 60)), (fr(15), (0, -10, -30)), (fr(18), (0, 0, 40)),
                                     (fr(21), (0, -14, -20)), (fr(25), (0, 6, 30)), (fr(30), (0, -6, -14)), (fr(37), (0, 0, 20)), (fr(43), (0, 0, -10)), (fr(50), Z3))},
              "head": {"rot": keys((0, Z3), (fr(5), (16, 0, 0)), (fr(13), (-10, 0, 0)), (fr(18), (6, 0, 0)), (fr(21), (-16, 0, 0)),
                                   (fr(25), (-20, 12, 0)), (fr(28), (-18, -14, 0)), (fr(31), (-16, 10, 0)), (fr(35), (-10, -4, 0)), (fr(44), (4, 0, 0)), (fr(50), Z3))},
              "tail": {"rot": keys((0, Z3), (fr(5), (-20, 0, 0)), (fr(13), (-6, 0, 0)), (fr(16), (-36, 0, 0)), (fr(21), (-10, 0, 10)),
                                   (fr(25), (-26, 0, -14)), (fr(30), (-8, 0, 10)), (fr(36), (-16, 0, -6)), (fr(44), (-4, 0, 2)), (fr(50), Z3))}}
    # Hit: the blow on frame 3 shoves it back with a little pop up; it hangs
    # a beat, lands, sways forward past rest with its weight and settles; the
    # head snaps back and the loose parts trail; over in 0.6 s. See _hitq.quick_hit.
    hit, hit_hit = quick_hit("body", foot=(-12, -0.5, -18.5), push=3.5, pop=1.5, tilt=10, head=("head", 24), arms={"arm-l": (24, -1), "arm-r": (24, 1)},
                            extra={"wing-l": lambda t: keys((0, Z3), (fr(4), (0, 0, -30)), (fr(10), (0, 0, 10)), (fr(t["O"]), (0, 0, -6)), (fr(t["E"]), Z3)),
                                   "wing-r": lambda t: keys((0, Z3), (fr(4), (0, 0, 30)), (fr(10), (0, 0, -10)), (fr(t["O"]), (0, 0, 6)), (fr(t["E"]), Z3)),
                                   "tail": lambda t: keys((0, Z3), (fr(4), (-24, 0, 0)), (fr(11), (-8, 0, 6)), (fr(t["E"]), Z3))})
    # Death (Sterf 2026-11-15b: fall BACKWARD): the blow knocks it back on
    # its heels with the wings flared (frames 0-2), it hops back a step on
    # its stone feet (2-8) and teeters (8-10), then goes over backwards about
    # its heels like a toppled statue, faster and faster (keyed a frame at a
    # time) onto its back on frame 20, a hard stone thud, a one-frame bounce
    # and dead still. The arms are flung up through the fall and slam out to
    # the sides a frame after the body, the wings crash out flat, the head
    # cracks back and lolls, the tail folds flat behind. 0.9 s.
    def piv(th: float, e=(-12.0, 0.0)) -> tuple[float, float]:
        """(dy, dz) that keep the heel edge `e` (y, z from the pivot) in
        place while the body tips back by `th` degrees."""
        c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
        return e[0] - (e[0] * c - e[1] * s), e[1] - (e[0] * s + e[1] * c)

    I, R = 20, 92.0
    pose = [(0, 0.0, 0.0, 0.0), (1, 8.0, 0.0, 1.2), (2, 12.0, 0.0, 2.0), (3, 13.0, 0.9, 2.8), (5, 14.0, 1.6, 4.2), (7, 15.0, 0.6, 5.2),
            (8, 16.0, 0.0, 5.5), (10, 19.0, 0.0, 5.7)]
    for k in range(1, I - 10 + 1):  # the fall: accelerating about the heels
        u = k / (I - 10)
        pose.append((10 + k, 19.0 + (R - 19.0) * (0.05 * u + 0.95 * u ** 2.4), 0.0, 5.7 + 0.8 * u))
    pose += [(I + 1, R - 3.0, 0.7, 6.6), (I + 2, R, 0.0, 6.6), (I + 7, R, 0.0, 6.6)]
    death = {"body": {"rot": keys(*[(fr(f), (a, 0, 2.0 * min(1.0, a / R))) for f, a, _, _ in pose]),
                      "loc": keys(*[(fr(f), (0, piv(a)[0] + y, piv(a)[1] + z)) for f, a, y, z in pose]),
                      "scale": keys((0, (1, 1, 1)), (fr(I - 1), (1, 1, 1)), (fr(I), (1.08, 1.04, 0.86)), (fr(I + 2), (0.98, 0.99, 1.03)), (fr(I + 4), (1, 1, 1)))},
             "wing-l": {"rot": keys((0, Z3), (fr(2), (0, 0, -40)), (fr(6), (0, 8, -50)), (fr(10), (0, 4, -42)), (fr(I - 1), (0, -6, -30)),
                                    (fr(I + 1), (0, -14, 16)), (fr(I + 2), (0, -12, 12)), (fr(I + 7), (0, -12, 12)))},
             "wing-r": {"rot": keys((0, Z3), (fr(2), (0, 0, 40)), (fr(6), (0, -8, 50)), (fr(10), (0, -4, 42)), (fr(I - 1), (0, 6, 30)),
                                    (fr(I + 1), (0, 14, -16)), (fr(I + 2), (0, 12, -12)), (fr(I + 7), (0, 12, -12)))},
             "head": {"rot": keys((0, Z3), (fr(2), (20, 0, 0)), (fr(5), (24, 4, 0)), (fr(10), (6, 2, 0)), (fr(I - 1), (-14, 0, 0)),
                                  (fr(I + 1), (50, 0, 14)), (fr(I + 3), (44, 0, 18)), (fr(I + 7), (44, 0, 18)))},
             "tail": {"rot": keys((0, Z3), (fr(2), (-20, 0, 0)), (fr(6), (-30, 0, 6)), (fr(10), (-40, 0, 4)), (fr(15), (-90, 8, 0)), (fr(I - 2), (-142, 22, 0)),
                                  (fr(I), (-140, 26, 0)), (fr(I + 1), (-150, 30, 4)), (fr(I + 2), (-146, 30, 4)), (fr(I + 7), (-146, 30, 4)))}}
    for name, s in (("arm-l", -1), ("arm-r", 1)):  # flung up by the blow, slammed out to the sides
        death[name] = {"rot": keys((0, Z3), (fr(2), (50, 0, s * 14)), (fr(5), (80, 0, s * 20)), (fr(10), (88, 0, s * 24)), (fr(I - 1), (100, 0, s * 30)),
                                   (fr(I + 1), (-38, 0, s * 58)), (fr(I + 2), (-34, 0, s * 56)), (fr(I + 7), (-34, 0, s * 56)))}
    eyes = (0.0, 35.5 - BODY[1], 5.0 - BODY[2])
    return world("gargoyle", "creatures", "Living Gargoyle", root,
                 clips=[Clip("move", _move(), ease=0), Clip("attack", attack, loop=False, impact=fr(20)), Clip("hit", hit, loop=False, impact=hit_hit), Clip("death", death, loop=False, impact=fr(I), ease=0), Clip("idle", idle)],
                 sockets=[Socket("socket-eyes", at=eyes, parent="head")],
                 pfx=[pfx("rvx-monster-stone-crumble", "socket-eyes", "clip:death", size=44, at=fr(I))])
