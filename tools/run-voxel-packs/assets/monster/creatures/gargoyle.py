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
Clips: idle (wings flex, head turns, tail sways), attack (leap and claw),
death (crumbles). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _kit import keys, pfx, world
from _life import assemble, chunk, claw, coords, front, limb, moss_top, side
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

S = (66, 52, 44)
CX, CZ = 33, 20
HIDE, WING = "gray", "stone"
BODY = (CX, 12.0, 22.0)
NECK = (CX, 31.0, 14.0)
TAILBASE = (CX, 15.0, 29.0)
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
        # gorilla arms on huge clawed knuckles
        sx = CX + s * 12.5
        limbs |= limb(g, "z", (CX + s * 8.5, 30), (sx + s * 2, 17), 4.0, 3.4, 9, 17, HIDE, 5, cap=0.4)
        limbs |= limb(g, "z", (sx + s * 2, 17.5), (sx + s * 1, 6), 3.4, 3.2, 7, 14, HIDE, 5, cap=0.4)
        fist = box(g, sx + s * 1 - 4.5, 0, 3, sx + s * 1 + 4.5, 7, 13, HIDE, 4)
        limbs |= fist
        for k in range(4):
            cxk = sx + s * 1 - 4 + k * 2.2
            claws |= claw(g, "x", (3.0, 3.5), (0.2, -0.0 + 0.4), 1.3, cxk, cxk + 1.5, "bone", 6)
    hide(g, limbs, 5, seed=4)
    P.flat(g, claws & (Y < 1.5), "bone", 5)
    lit_tops(g, torso | limbs, seed=15)
    moss_top(g, (torso | limbs) & (Y > 8), depth=2, seed=5, patchy=0.3)
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


def build():
    parts = {"body": body(), "head": head(), "tail": tail(), "wing-l": wing(-1), "wing-r": wing(1)}
    root = assemble(parts, [
        ("body", None, BODY),
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
    attack = {"body": {"rot": keys((0, (0, 0, 0)), (0.25, (-18, 0, 0)), (0.5, (25, 0, 0)), (0.9, (0, 0, 0))), "loc": keys((0, (0, 0, 0)), (0.25, (0, 6, 4)), (0.5, (0, 1, -8)), (0.9, (0, 0, 0)))},
              "wing-l": {"rot": keys((0, (0, 0, 0)), (0.25, (0, 0, -40)), (0.5, (0, 0, 25)), (0.9, (0, 0, 0)))},
              "wing-r": {"rot": keys((0, (0, 0, 0)), (0.25, (0, 0, 40)), (0.5, (0, 0, -25)), (0.9, (0, 0, 0)))},
              "head": {"rot": keys((0, (0, 0, 0)), (0.25, (-20, 0, 0)), (0.5, (15, 0, 0)), (0.9, (0, 0, 0)))}}
    # hit: knocked back (+z) and up, the head snaps back and the wings flare
    hit = {"body": {"rot": keys((0, (0, 0, 0)), (0.1, (-14, 8, 0)), (0.3, (4, 0, 0)), (0.55, (0, 0, 0))), "loc": keys((0, (0, 0, 0)), (0.1, (0, 1, 3)), (0.55, (0, 0, 0)))},
           "head": {"rot": keys((0, (0, 0, 0)), (0.1, (-22, -12, 0)), (0.55, (0, 0, 0)))},
           "wing-l": {"rot": keys((0, (0, 0, 0)), (0.1, (0, 0, -25)), (0.55, (0, 0, 0)))},
           "wing-r": {"rot": keys((0, (0, 0, 0)), (0.1, (0, 0, 25)), (0.55, (0, 0, 0)))}}
    death = {"body": {"scale": keys((0, (1, 1, 1)), (0.3, (1.05, 0.95, 1.05)), (1.0, (1.15, 0.3, 1.15))), "loc": keys((0, (0, 0, 0)), (1.0, (0, -4, 0)))},
             "wing-l": {"rot": keys((0, (0, 0, 0)), (1.0, (0, 0, 60)))}, "wing-r": {"rot": keys((0, (0, 0, 0)), (1.0, (0, 0, -60)))},
             "head": {"rot": keys((0, (0, 0, 0)), (1.0, (35, 0, 20)))}}
    eyes = (0.0, 35.5 - BODY[1], 5.0 - BODY[2])
    return world("gargoyle", "creatures", "Living Gargoyle", root,
                 clips=[Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False), Clip("idle", idle)],
                 sockets=[Socket("socket-eyes", at=eyes, parent="head")],
                 pfx=[pfx("rvx-monster-stone-crumble", "socket-eyes", "clip:death", size=44, at=0.2)])
