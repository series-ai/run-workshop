"""Sewer crocodile, in the Pirate Nation creature style.

A long, low sewer crocodile: a flat olive body on four sprawled legs, a
long head that tapers to a narrow snout with a nose knob, raised eye
bumps, a heavy lower jaw and a thick tail that drags on the ground. Rows
of sloped scutes (small pyramids, true slopes) run down the back and join
into one crest on the tail. Olive hide, a pale belly with scale plates,
sewer mud on the legs and teeth along the jaw line are paint. The
mutation is the accent: eyes that glow teal and teal boils on the
shoulder. Clips: idle (tail sway), move (sprawl walk), attack (jaw snap),
hit, death (rolls over). Faces -Z.
"""
import numpy as np

import paint as P
from _life import Rig, ctr, fx, limb, make, seq, wave
from _rep_creatures import face_spot, ground, hide, patches, pustules, tube
from voxgrid import Clip, Grid

SIZE = (64, 30, 92)
CX = 32.0
ORIGIN = (CX, 0.0, 44.0)
BACK = ("moss", 5)
SIDE = ("khaki", 3)
BELLY = ("sand", 5)
MUD = ("darkwood", 5)
HEAD = (CX, 11.0, 21.0)
HINGE = (CX, 8.0, 19.0)
TAIL = (CX, 10.0, 56.0)
LEGS = {"leg-front-l": (CX - 10, 9.0, 25.0, -1), "leg-front-r": (CX + 10, 9.0, 25.0, 1),
        "leg-back-l": (CX - 10, 9.0, 51.0, -1), "leg-back-r": (CX + 10, 9.0, 51.0, 1)}


def skin_paint(g, m, top_y: float, seed: int, belly_y: float = 5.5) -> None:
    """Olive back, khaki flanks, a pale belly and sewer mud on the sides."""
    X, Y, Z = ctr(g)
    hide(g, m, *SIDE, seed=seed, cell=4, light=False)
    hide(g, m & (Y > top_y - 3.5), *BACK, seed=seed + 1, cell=4)
    P.flat(g, m & (Y < belly_y), *BELLY)
    mud = [(CX - 10, 6, 30, 3.5), (CX + 11, 6, 42, 4), (CX - 9, 6, 52, 3.5), (CX + 6, 7, 64, 3), (CX - 6, 9, 14, 3), (CX + 7, 8, 8, 2.5)]
    patches(g, m & (Y < 9) & (Y > belly_y - 0.5), mud, *MUD, seed=seed + 2)


def scute_row(g, pts, r: float, h: float) -> np.ndarray:
    """A row of sloped scutes: four-sided pyramids (true slopes) at (x, y, z)
    base points, dark at the foot and pale at the tip."""
    m = np.zeros(g.shape, dtype=bool)
    Y = ctr(g)[1]
    for x, y, z in pts:
        s = limb(g, (x, y - 1.0, z), (x, y + h, z + r * 0.6), r, 0.25, "moss", 3, n=4)
        P.flat(g, s & (Y > y + h * 0.55), "moss", 6)
        m |= s
    return m


# Torso sections (z, (cx, cy, rx, ry)) from the shoulders to the tail root.
BODY = ((18, (CX, 10.5, 9, 6)), (28, (CX, 11, 12, 7.5)), (50, (CX, 11, 12.5, 7.5)), (58, (CX, 10, 9, 5.5)))


def back_top(z: float) -> float:
    """The height of the flat top of the torso at z."""
    for (z0, a), (z1, b) in zip(BODY, BODY[1:]):
        if z0 <= z <= z1:
            c = _section(z, a, b, z0, z1)
            return c[1] + c[3]
    raise ValueError(f"z={z} is outside the torso")


def torso() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    m = np.zeros(g.shape, dtype=bool)
    for (z0, a), (z1, b) in zip(BODY, BODY[1:]):
        m |= tube(g, "z", a, b, z0, z1, *SIDE)
    skin_paint(g, m, 18.5, seed=1)
    belly = m & (Y < 5.5)
    P.plates(g, belly, *BELLY, size=(4, 3), rivets=False, seed=2)
    # Sloped scutes: two rows on the back, a larger centre row, small side rows.
    scute_row(g, [(CX + s * 3.6, back_top(z) - 0.1, z) for z in range(23, 55, 4) for s in (-1, 1)], 2.1, 3.0)
    scute_row(g, [(CX + s * 10.2, 15.6, z) for z in range(29, 50, 5) for s in (-1, 1)], 1.3, 1.6)
    # Mutation: teal boils on the left shoulder.
    pustules(g, [(CX - 8, 17.2, 30), (CX - 9.5, 16.0, 33.5), (CX - 7.5, 17.4, 35)], r=1.3)
    return g


def _section(z: float, a, b, z0: float, z1: float):
    """Interpolate a tube section (cu, cv, ru, rv) at z between z0 and z1."""
    f = (z - z0) / (z1 - z0)
    return tuple(a[i] + (b[i] - a[i]) * f for i in range(4))


def head() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    s0, s1, s2 = (CX, 10.5, 3.6, 2.8), (CX, 11.5, 7, 4.5), (CX, 11, 9, 6)
    snout = tube(g, "z", s0, s1, 0, 10, *SIDE)
    skull = tube(g, "z", s1, s2, 10, 22, *SIDE)
    m = snout | skull
    skin_paint(g, m, 17, seed=4)
    # Jaw line: dark gum, a row of pale teeth and a pink mouth roof.
    sec = [(_section(z, s0, s1, 0, 10) if z < 10 else _section(z, s1, s2, 10, 22)) for z in np.arange(SIZE[2]) + 0.5]
    bot = np.array([c[1] - c[3] for c in sec])[None, None, :]
    rx = np.array([c[2] for c in sec])[None, None, :]
    edge = m & (Y < bot + 2.2) & (np.abs(X - CX) > rx - 1.8)
    P.flat(g, edge, "red", 2)
    P.flat(g, edge & ((np.floor(Z) // 2) % 2 == 0) & (Z < 20) & (Y < bot + 1.6), "bone", 7)
    P.flat(g, m & (Y < bot + 0.8) & (np.abs(X - CX) < rx - 2.6), "pink", 4)
    # A nose knob with two nostrils at the snout tip.
    knob = limb(g, (CX, 12.5, 2.5), (CX, 14.8, 2.5), 1.9, 1.1, *BACK, n=6)
    P.flat(g, knob & (Y > 14) & (np.abs(np.abs(X - CX) - 1.0) < 0.6), "iron", 3)  # nostrils
    # Raised eye bumps that glow teal, with slit pupils.
    for s in (-1, 1):
        bump = limb(g, (CX + s * 5, 15, 16), (CX + s * 5.3, 19.2, 16.5), 2.5, 1.6, *BACK, n=6)
        face_spot(g, bump, CX + s * 5.2, 17.6, 1.6, "teal", 7)
        face_spot(g, bump, CX + s * 5.2, 17.6, 0.6, "iron", 1)
        P.flat(g, bump & (Y > 18.6), "moss", 6)
    scute_row(g, [(CX + s * 3.5, 16.8, z) for z in (19,) for s in (-1, 1)], 1.4, 1.8)
    return g


def jaw() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    a, b = (CX, 6, 3.4, 1.8), (CX, 6.5, 8.5, 2.6)
    m = tube(g, "z", a, b, 0.5, 21, *SIDE)
    hide(g, m, *SIDE, seed=6, cell=4, light=False)
    P.flat(g, m & (Y < 5.5), *BELLY)
    sec = [_section(min(max(z, 0.5), 21), a, b, 0.5, 21) for z in np.arange(SIZE[2]) + 0.5]
    top = np.array([c[1] + c[3] for c in sec])[None, None, :]
    rx = np.array([c[2] for c in sec])[None, None, :]
    edge = m & (Y > top - 1.6) & (np.abs(X - CX) > rx - 1.8)
    P.flat(g, edge, "red", 2)
    P.flat(g, edge & ((np.floor(Z) // 2) % 2 == 1) & (Z < 19), "bone", 6)
    P.flat(g, m & (Y > top - 0.8) & (np.abs(X - CX) < rx - 1.6), "pink", 3)  # the tongue
    return g


def tail() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    m = tube(g, "z", (CX, 10, 9, 5.5), (CX + 1, 7, 6.5, 4.5), 56, 72, *SIDE)
    m |= tube(g, "z", (CX + 1, 7, 6.5, 4.5), (CX + 3, 3, 2.5, 2.2), 72, 86, *SIDE)
    m |= limb(g, (CX + 3, 3, 85.5), (CX + 3.8, 1.6, 90), 2.3, 0.3, *SIDE, n=6)
    skin_paint(g, m, 15.5, seed=8, belly_y=2.5)
    # Paired scute ridges join into one crest down the tail.
    scute_row(g, [(CX + s * 3.6, 15.0 - (z - 58) * 0.18, z) for z in (58, 62, 66) for s in (-1, 1)], 1.6, 2.4)
    scute_row(g, [(CX + 1 + (z - 70) * 0.14, 11.4 - (z - 70) * 0.42, z) for z in (70, 74, 78, 82)], 1.6, 2.4)
    return g


def leg(name: str) -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    x, y, z, s = LEGS[name]
    fx_ = x + s * 9
    up = limb(g, (x, y, z), (x + s * 8.5, 7, z), 3.0, 2.6, *SIDE, n=6)
    low = limb(g, (x + s * 8.4, 7.5, z), (fx_, 2, z - 1), 2.5, 2.1, *SIDE, n=6)
    foot = tube(g, "y", (fx_, z - 2.5, 3.1, 3.6), (fx_, z - 2.2, 2.6, 3.0), 0, 2.4, *SIDE)
    m = up | low | foot
    hide(g, m, *SIDE, seed=10, cell=4, light=False)
    P.flat(g, m & (Y > 8), *BACK)
    P.flat(g, m & (Y < 4.5), *MUD)  # sewer mud on the feet
    for k in (-1, 0, 1):
        limb(g, (fx_ + k * 1.7, 1.0, z - 5.5), (fx_ + k * 1.9, 0.6, z - 8), 0.75, 0.15, "bone", 6, n=4)
    return g


def _build():
    rig = Rig("sewer-croc", ORIGIN, torso())
    rig.add("head", head(), HEAD)
    rig.add("jaw", jaw(), HINGE, parent="head")
    rig.add("tail", tail(), TAIL)
    for name in LEGS:
        rig.add(name, leg(name), LEGS[name][:3])
    idle = {"head": {"rot": wave(1.6, (1.5, 0, 0))}, "tail": {"rot": wave(1.6, (0, 5, 0))},
            "jaw": {"rot": seq((0, 0, 0, 0), (0.6, 0, 0, 0), (0.8, -6, 0, 0), (1.0, 0, 0, 0), (1.6, 0, 0, 0))}}
    walk = 1.0
    move = {"tail": {"rot": wave(walk, (0, 14, 0))}, "head": {"rot": wave(walk, (0, -5, 0))},
            "leg-front-l": {"rot": wave(walk, (0, 18, 0))}, "leg-back-r": {"rot": wave(walk, (0, 18, 0))},
            "leg-front-r": {"rot": wave(walk, (0, 18, 0), phase=np.pi)}, "leg-back-l": {"rot": wave(walk, (0, 18, 0), phase=np.pi)}}
    attack = {"head": {"rot": seq((0, 0, 0, 0), (0.2, 12, 0, 0), (0.4, -4, 0, 0), (0.8, 0, 0, 0))},
              "jaw": {"rot": seq((0, 0, 0, 0), (0.2, -26, 0, 0), (0.32, 0, 0, 0), (0.8, 0, 0, 0))},
              "sewer-croc": {"loc": seq((0, 0, 0, 0), (0.2, 0, 0, 1.5), (0.35, 0, 0, -4), (0.8, 0, 0, 0))}}
    hit = {"head": {"rot": seq((0, 0, 0, 0), (0.12, 10, 12, 0), (0.55, 0, 0, 0))},
           "tail": {"rot": seq((0, 0, 0, 0), (0.12, 0, -16, 0), (0.55, 0, 0, 0))}}
    death = {"sewer-croc": {"rot": seq((0, 0, 0, 0), (0.45, 0, 0, 14), (1.2, 0, 0, 80))},
             "jaw": {"rot": seq((0, 0, 0, 0), (1.2, -18, 0, 0))}}
    return make("creatures", "sewer-croc", "Sewer Crocodile", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-jaw", (CX, 8, 1), parent="head")],
                pfx=[fx("rvx-apocalypse-vomit-spray", "socket-jaw", "clip:attack", at=0.22, size=11, aim=(0, 0, -1))])


def build():
    return ground(_build())
