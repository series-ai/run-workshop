"""Sewer crocodile, in the Pirate Nation creature style.

A long, low sewer crocodile: a flat olive body on four sprawled legs, a
long head that tapers to a narrow snout with a nose knob, raised eye
bumps, a heavy lower jaw and a thick tail that drags on the ground. Rows
of sloped scutes (small pyramids, true slopes) run down the back and join
into one crest on the tail. Olive hide, a pale belly with scale plates,
sewer mud on the legs and teeth along the jaw line are paint. The
mutation is the accent: eyes that glow teal and teal boils on the
shoulder. Clips: idle (tail sway), move (sprawl walk), attack (rears and gapes, lunges into
a jaw snap and a death-roll twist),
hit, death (thrashes, crumbles flat and goes limp). Faces -Z.
"""
import numpy as np

import paint as P
import _beast_falls as react
from _life import Rig, ctr, fx, limb, make, seq, wave
from _rep_creatures import face_spot, hide, patches, pustules, tube
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
    # attack: pull back, rear the snout and gape (f0-9), lunge 3 frames into
    # the snap (impact f12: jaws shut, snout slammed down, fastest on the
    # last frame). The front feet stride out and plant on the snap and the
    # hind feet scramble up behind; a death-roll twist with the jaws clamped
    # and the tail whipping a beat behind, then it backs off one foot at a
    # time, past the spot (f33), and settles; the legs tuck up through the
    # roll. Leg swings are solved in
    # build() so planted feet never slide.
    f = 1 / 30
    imp = 12 * f
    attack = {"head": {"rot": seq((0, 0, 0, 0), (7 * f, 24, 0, 0), (9 * f, 28, 0, 0), (imp, -4, 0, 0), (14 * f, -6, 0, 0), (19 * f, -5, 0, 0), (24 * f, -3, 0, 0), (32 * f, 0, 0, 0))},
              "jaw": {"rot": seq((0, 0, 0, 0), (7 * f, -38, 0, 0), (9 * f, -44, 0, 0), (11 * f, -12, 0, 0), (imp, 0, 0, 0), (20 * f, 0, 0, 0), (24 * f, -6, 0, 0), (30 * f, 0, 0, 0))},
              "sewer-croc": {"loc": seq((0, 0, 0, 0), (7 * f, 0, 1.0, 2.7), (9 * f, 0, 1.5, 3.2), (10 * f, 0, 1.5, 1.2), (11 * f, 0, 1.6, -3.5), (imp, 0, 1.8, -11), (14 * f, 0, 3.0, -13), (15 * f, 0, 3.8, -13), (18 * f, 0, 2.6, -12), (19 * f, 0, 1.8, -11.5), (21 * f, 0, 1.8, -10.8), (24 * f, 0, 1.8, -10), (33 * f, 0, 0, 0.8), (37 * f, 0, 0, 0)),
                             "rot": seq((0, 0, 0, 0), (7 * f, 0.5, 0, 0), (9 * f, 0.8, 0, 0), (imp, 0, 0, 0), (15 * f, 0, 0, 6), (19 * f, 0, 0, -5), (22 * f, 0, 0, 2), (25 * f, 0, 0, -1), (33 * f, 0.6, 0, 0), (37 * f, 0, 0, 0))},
              "tail": {"rot": seq((0, 0, 0, 0), (9 * f, -8, 18, 0), (13 * f, -8, -24, 0), (16 * f, -8, 20, 0), (20 * f, -8, -12, 0), (25 * f, -5, 5, 0), (32 * f, 0, -6, 0), (37 * f, 0, 0, 0))}}
    for name in LEGS:  # the legs fold up against the body through the death roll
        s_ = LEGS[name][3]
        attack[name] = {"rot": seq((0, 0, 0, 0), (12 * f, 0, 0, 0), (16 * f, 0, 0, s_ * 8), (17 * f, 0, 0, s_ * 16), (18 * f, 0, 0, s_ * 23), (19 * f, 0, 0, s_ * 25), (24 * f, 0, 0, 0))}
    R = "sewer-croc"
    hit = {R: react.body2(push=2.6, pop=1.4, lean=2, side=0.7, over=0.7, past=2.5),
           "head": {"rot": react.lag((16, 14, 0))},
           "jaw": {"rot": react.lag((-18, 0, 0), delay=2)},
           "tail": {"rot": seq((0, 0, 0, 0), (9 * f, 0, 0, 0), (12 * f, 1, -6, 0), (16 * f, 3, 5, 0), (18 * f, 3.5, 1, 0), (21 * f, 1.5, -2, 0), (26 * f, 0, 0, 0))}}
    # death: a last thrash: the snout rears and gapes and the tail lashes
    # one way then the other as the body heaves (f0-12), then it crumbles:
    # the legs splay out flat and the body drops onto its belly, gathering
    # speed into the thud (impact f18). One small bounce and a settle, then
    # it sags over a little; the tail and the head slap down late and the
    # jaw falls slack last.
    dimp = 18 * f
    death = {R: {"scale": seq((0, 1, 1, 1), (17 * f, 1, 1, 1), (dimp, 1.03, 0.92, 1.01), (21 * f, 1.0, 1.0, 1.0), (50 * f, 1, 1, 1)),
                 "loc": seq((0, 0, 0, 0), (6 * f, 0.8, 1.6, 0), (10 * f, -0.8, 1.2, 0), (13 * f, 0, 0.6, 0), (dimp, 0, -3.5, 0), (21 * f, 0, -2.7, 0), (24 * f, 0, -3.5, 0), (27 * f, 0, -3.5, 0), (30 * f, 0, -3.5, 0), (50 * f, 0, -3.5, 0)),
                 "rot": seq((0, 0, 0, 0), (6 * f, 2, 0, -1.5), (10 * f, 1.5, 0, 1.5), (dimp, 0, 0, 0.5), (24 * f, -1, 0, 1), (42 * f, -1, 0, 2.5), (50 * f, -1, 0, 2.5))},
             "head": {"rot": seq((0, 0, 0, 0), (6 * f, 25, -8, 0), (10 * f, 28, 8, 0), (dimp, 5, 6, 0), (22 * f, 2, 12, 0), (26 * f, 2.5, 9, 0), (30 * f, 2, 11, 0), (50 * f, 2, 11, 0))},
             "jaw": {"rot": seq((0, 0, 0, 0), (6 * f, -30, 0, 0), (9 * f, -36, 0, 0), (12 * f, -14, 0, 0), (dimp, -6, 0, 0), (23 * f, 0, 0, 0), (27 * f, -1.5, 0, 0), (50 * f, -1.5, 0, 0))},
             "tail": {"rot": seq((0, 0, 0, 0), (6 * f, -10, 24, 0), (10 * f, -12, -26, 0), (13 * f, -11, 10, 0), (dimp, -9, 0, 0), (22 * f, -5, -14, 0), (26 * f, -4.5, -6, 0), (30 * f, -4.5, -10, 0), (50 * f, -4.5, -10, 0))}}
    for name in LEGS:
        s = LEGS[name][3]
        fz = -16 if "front" in name else 16
        late = 1 if s > 0 else 0
        death[name] = {"rot": seq((0, 0, 0, 0), (6 * f, 0, fz * 0.5, -s * 5), (9 * f, 0, 0, -s * 1.5), (11 * f, 0, -fz * 0.5, s * 3), (dimp, 0, fz, s * 50), ((21 + late) * f, 0, fz, s * 58), ((24 + late) * f, 0, fz, s * 60), (50 * f, 0, fz, s * 60))}
    return make("creatures", "sewer-croc", "Sewer Crocodile", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=imp), Clip("hit", hit, loop=False), Clip("death", death, loop=False, impact=dimp)],
                sockets=[rig.socket("socket-jaw", (CX, 8, 1), parent="head")],
                pfx=[fx("rvx-apocalypse-vomit-spray", "socket-jaw", "clip:attack", at=imp, size=11, aim=(0, 0, -1))])


def build():
    # Every frame of the one-shots sits on the floor (nothing sinks or
    # floats); the hit's pop and the death's bounce are keyed lifts.
    a = _build()
    # Strike strides, the legs tucked up against the body through the death
    # roll (so the belly and jaw carry it), then the steps home.
    atk = {"leg-front-l": [(9, 12, -14, 3), (12, 23, -14, 2.0), (24, 28, 0, 1.5)], "leg-front-r": [(9, 12, -14, 3), (12, 23, -14, 2.0), (26, 30, 0, 1.5)],
           "leg-back-l": [(9, 13, -10, 1.5), (13, 23, -10, 2.0), (29, 33, 0, 1.2)], "leg-back-r": [(9, 13, -10, 1.5), (13, 23, -10, 2.0), (27, 31, 0, 1.2)]}
    react.step_legs(a, "attack", atk, axis=1)
    # All four feet are off the floor for a moment as it lunges.
    react.track_floor(a, "attack", air=react.arc(1.0, 2, 1, start=9))
    # The legs give way gradually as it rolls down onto its belly, and push
    # it back up after the roll (no drop or pop from a leg leaving the floor).
    legs = list(LEGS)
    react.sink_on_legs(a, "attack", legs, 12, 17, sign=lambda n: LEGS[n][3], power=1.6)
    react.sink_on_legs(a, "attack", legs, 20, 23, sign=lambda n: LEGS[n][3], power=1.0)
    react.pin_feet(a, "attack", atk)
    # The hit's feet fly back with the body, land with it and stay planted,
    # then step home with a lift as it sways forward past the spot.
    hits = react.hit_steps(2.6, ['leg-front-l', 'leg-front-r'], ['leg-back-r', 'leg-back-l'], slow=1.0, lift=1.8, hind_lift=0.6)
    react.step_legs(a, "hit", hits, axis=1, kick=True)
    react.track_floor(a, "hit", air=react.arc(1.0, 4, 4), kick=True)
    react.pin_feet(a, "hit", hits)
    react.track_floor(a, "death", air=react.arc(0.4, 2, 2, start=18))
    # From f10 the legs give way under it and it drops on a gravity curve
    # into the belly thud; the legs stay on the floor through the landing,
    # then slide out flat and lie there.
    side = lambda n: LEGS[n][3]  # noqa: E731
    react.sink_on_legs(a, "death", list(LEGS), 10, 18, sign=side, power=2.2)
    bounce = react.arc(0.4, 2, 2, start=18)
    react.clear_legs(a, "death", list(LEGS), range(18, 51), lambda f: 0.05 + bounce(f), sign=side)
    return a
