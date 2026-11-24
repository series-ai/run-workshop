"""Mutant boar, in the Pirate Nation creature style.

A compact, front-heavy wasteland boar: a tall humped shoulder that slopes
down to a small rump, a ridge of black bristles along the spine, a big
wedge head with a flat pink snout, up-curved bone tusks and short stout
legs. Bristle-brown fur is paint. Scrap armour is two riveted rust plates
strapped over the shoulders. The mutation is the accent: small teal eyes
that glow and teal boils on the left haunch. Clips: idle (snuffle), move
(bouncy trot), attack (drops the head and sits back, snap-lunges into an
upward tusk rip with the hooves planted), hit, death (slaps down on its side,
bounces and settles).
Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
import _beast_falls as react
from _life import Rig, ctr, front, fx, limb, make, seq, side, wave
from _rep_creatures import face_spot, pustules, rust_plate, tube
from voxgrid import Clip, Grid

SIZE = (52, 42, 52)
CX = 26.0
ORIGIN = (CX, 0.0, 23.0)
FUR = ("skindark", 4)
NECK = (CX, 20.0, 12.0)
LEGS = {"front-l": (CX - 6.5, 14.0, 15.0, False), "front-r": (CX + 6.5, 14.0, 15.0, False),
        "rear-l": (CX - 6.5, 14.0, 33.0, True), "rear-r": (CX + 6.5, 14.0, 33.0, True)}


def fur(g, m, base=FUR[1], seed=0) -> None:
    PP.fur(g, m, FUR[0], base, stroke=4, seed=seed)


def body() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    # A humped wedge: tall at the shoulder, low at the rump (true slopes).
    m = tube(g, "z", (CX, 19.5, 8, 9), (CX, 20.5, 10.5, 10.5), 10, 18, *FUR)
    m |= tube(g, "z", (CX, 20.5, 10.5, 10.5), (CX, 18.5, 9, 8), 18, 36, *FUR)
    m |= tube(g, "z", (CX, 18.5, 9, 8), (CX, 18.5, 5.5, 5.5), 36, 41, *FUR)
    fur(g, m, seed=1)
    P.flat(g, m & (Y > 27), FUR[0], FUR[1] - 1)  # a darker back
    fur(g, m & (Y < 13), 5, seed=2)  # a paler belly
    # The bristle ridge: a saw-tooth crest down the spine.
    crest = side(g, [(26.5, 10), (29, 10), (34, 11.5), (30.5, 14), (35, 16), (31.5, 18), (34.5, 20.5), (31, 23), (33.5, 25.5),
                     (29.5, 28), (31, 30.5), (28, 33), (26.5, 33)], CX - 1.8, CX + 1.8, "darkwood", 4)
    P.flat(g, crest & (Y > 32), "darkwood", 6)
    # Scrap armour: two riveted rust plates strapped over the shoulders.
    for s in (-1, 1):
        rust_plate(g, "z", CX + s * 7, 28.5, 9, 2.2, 14, 24, s * -32, seed=3 + s)
    strap = m & (Z >= 21) & (Z < 23)
    P.flat(g, strap, "darkwood", 3)
    P.flat(g, strap & (np.abs(Y - 12.5) < 1.1), "steel", 6)  # the buckle
    # A pale old scar across the right flank.
    P.flat(g, m & (X > CX + 7) & (np.abs((Y - 19) - (Z - 28) * 0.6) < 0.7) & (Z > 24) & (Z < 33), "skindark", 7)
    # Mutation: teal boils on the left haunch.
    pustules(g, [(CX - 9.4, 20, 30), (CX - 9.2, 17, 33), (CX - 8.8, 22, 34)], normal=(-1, 0, 0), r=1.3)
    # A short curly tail.
    t = limb(g, (CX, 20, 40), (CX, 23, 43), 1.1, 0.9, *FUR, n=4)
    t |= limb(g, (CX, 22.6, 42.6), (CX + 1.6, 20.5, 45), 0.9, 0.4, *FUR, n=4)
    P.flat(g, t, FUR[0], FUR[1] - 1)
    return g


def head() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    skull = tube(g, "z", (CX, 16, 5, 4.5), (CX, 20, 8, 8), 2.5, 13, *FUR)
    fur(g, skull, seed=4)
    P.flat(g, skull & (Y > 25), FUR[0], FUR[1] - 1)
    snout = tube(g, "z", (CX, 15.5, 4, 3.5), (CX, 15.5, 4.3, 3.7), 0.5, 3, "pink", 3)
    P.flat(g, snout & (Z < 1.5), "pink", 2)
    for s in (-1, 1):
        face_spot(g, snout, CX + s * 1.6, 15.5, 1.0, "red", 2, square=True)
    jaw = tube(g, "z", (CX, 11.5, 3.6, 1.8), (CX, 12, 5.6, 2.4), 2, 10.5, *FUR)
    P.flat(g, jaw, FUR[0], FUR[1] + 1)
    P.flat(g, jaw & (Y > 13.2), "red", 2)  # the dark mouth line
    # Up-curved bone tusks out of the jaw.
    for s in (-1, 1):
        tusk = limb(g, (CX + s * 4, 12.5, 4), (CX + s * 7, 16.5, 1.8), 1.5, 1.1, "bone", 6, n=6)
        tusk |= limb(g, (CX + s * 6.8, 16.1, 2), (CX + s * 6.2, 21, 1), 1.1, 0.2, "bone", 7, n=6)
        P.flat(g, tusk & (Y < 14), "bone", 4)
    # Small eyes that glow teal under a heavy dark brow.
    for s in (-1, 1):
        face_spot(g, skull, CX + s * 3.4, 22.0, 1.6, "darkwood", 3, square=True)
        face_spot(g, skull, CX + s * 3.4, 21.0, 1.0, "teal", 7, square=True)
    # Torn pointed ears that lean back.
    for s in (-1, 1):
        ear = front(g, [(CX + s * 3.2, 25.5), (CX + s * 7.6, 24.8), (CX + s * 7.2, 31.5)], 9.5, 11.5, "skindark", 3)
        P.flat(g, ear & (Z < 10.3) & (np.abs(X - CX) > 5) & (Y < 29), "pink", 4)
    return g


def leg(name: str) -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    x, y, z, hind = LEGS[name]
    if hind:  # a thick ham and a hock that angles back
        m = limb(g, (x, y + 1.5, z), (x, 8, z + 1.6), 3.7, 2.4, *FUR, n=6)
        m |= limb(g, (x, 8.4, z + 1.6), (x, 3, z), 2.3, 2.0, *FUR, n=6)
    else:
        m = limb(g, (x, y, z), (x, 3, z - 0.5), 3.2, 2.1, *FUR, n=6)
    fur(g, m, seed=6)
    P.flat(g, m & (Y < 6.5), FUR[0], FUR[1] - 1)
    hoof = side(g, [(0, z - 2.6), (0, z + 1.8), (3.2, z + 1.5), (3.2, z - 2)], x - 2.3, x + 2.3, "iron", 3)
    P.flat(g, hoof & (np.abs(X - x) < 0.6), "iron", 2)
    P.flat(g, hoof & (Y > 2.5), "iron", 4)
    return g


def _build():
    rig = Rig("mutant-boar", ORIGIN, body())
    rig.add("head", head(), NECK)
    for name in LEGS:
        rig.add(name, leg(name), LEGS[name][:3])
    idle = {"head": {"rot": seq((0, 0, 0, 0), (0.3, -4, 0, 0), (0.45, -2, 0, 0), (0.6, -4, 0, 0), (1.2, 0, 0, 0))}}
    f = 1 / 30
    # move: a bouncy diagonal trot (18 frames, two beats). Each diagonal
    # pair lands (f0 / f9), stays planted to f6 while the sole slides
    # back at a steady rate, pushes off, and there are 2 frames with all four
    # hooves in the air before the other pair lands. The swing pair is lifted
    # highest as it passes under the body. The body sinks after each landing
    # and is highest at push-off; the head nods a beat behind. Leg swing,
    # lift and planting are keyed per frame in build() (react.gait).
    trot = 0.6
    move = {"mutant-boar": {"rot": seq((0, 0, 0, 0), (2 * f, -0.8, 0, 0), (7 * f, 0.8, 0, 0), (9 * f, 0, 0, 0), (11 * f, -0.8, 0, 0), (16 * f, 0.8, 0, 0), (trot, 0, 0, 0))},
            "head": {"rot": seq((0, -3, 0, 0), (2 * f, -6, 0, 0), (6 * f, 2, 0, 0), (9 * f, -3, 0, 0), (11 * f, -6, 0, 0), (15 * f, 2, 0, 0), (18 * f, -3, 0, 0))}}
    # attack: sit back on the haunches with the head dropped (f0-10), then a
    # 3-frame snap lunge, fastest on the last frame (impact f13). The front
    # legs stride forward and plant on the impact, the rear hooves stay
    # planted and the legs stretch back; the body drives on past contact
    # (f15) and springs back onto the contact spot (f18); the hind legs step
    # up behind it while the head keeps worrying side to side, then it
    # walks back past the spot (f32) with the front legs stepping home. The leg angles are solved in
    # build() so the planted hooves never slide.
    imp = 13 * f
    attack = {"head": {"rot": seq((0, 0, 0, 0), (9 * f, -30, 0, 0), (11 * f, -34, 0, 6), (imp, 34, 0, -16), (15 * f, 44, 0, -20), (17 * f, 30, 4, -10), (19 * f, 38, -5, -16), (21 * f, 30, 4, -10), (23 * f, 34, -2, -13), (30 * f, -6, 0, 0), (36 * f, 0, 0, 0))},
              "mutant-boar": {"loc": seq((0, 0, 0, 0), (8 * f, 0, 0, 3.2), (10 * f, 0, 0, 3.5), (12 * f, 0, 0, -1.5), (imp, 0, -0.9, -7), (15 * f, 0, -0.9, -8.8), (18 * f, 0, -0.9, -7.1), (21 * f, 0, -0.9, -7.5), (24 * f, 0, -0.6, -6.6), (28 * f, 0, 0, -3.2), (32 * f, 0, 0, 0.7), (36 * f, 0, 0, 0)),
                              "rot": seq((0, 0, 0, 0), (8 * f, 0.3, 0, 0), (10 * f, 0.4, 0, 0), (imp, -1, 0, 0), (15 * f, -1.5, 0, 0), (20 * f, -1, 0, 0), (27 * f, 0, 0, 0), (32 * f, 0.3, 0, 0), (36 * f, 0, 0, 0))}}
    R = "mutant-boar"
    hit = {R: react.body2(push=3.6, pop=2.0, lean=3, side=0.8, slow=1.1, over=0.8, past=5),
           "head": {"rot": react.lag((30, 16, 6), slow=1.1)}}
    for name in LEGS:
        hit[name] = {"rot": react.lag((-10 if "front" in name else 8, 0, 0), slow=1.1, delay=0)}
    # death: the blow rears it up onto its right legs (f0-6) and it hangs
    # there teetering, still tipping (f6-9), rocks back over its feet onto
    # the left hooves (f9-13, eased through the crossing), then slaps down
    # onto its left side, gathering speed all the way into a squashed thud
    # (impact f18, fastest at contact). One small bounce (half a voxel,
    # landed f22) and a hard settle. The upper legs swing on past the
    # landing and flop down late; the head slaps down last.
    dimp = 18 * f
    roll = []
    for k in range(19):
        if k <= 6:  # rearing onto the right legs, slowing as it goes
            u = k / 6
            th = -9 * (1 - (1 - u) ** 2)
        elif k <= 9:  # the teeter: still tipping, slowly
            th = -9 - 2 * (k - 6) / 3
        elif k <= 13:  # it rocks back over its feet onto the left side (eased)
            u = (k - 9) / 4
            th = -11 + 15 * u * u * (3 - 2 * u)
        else:  # the fall: from the rock into the floor, fastest at contact
            u = (k - 13) / 5
            th = 4 + 86 * u ** 1.7
        roll.append((k, th))
    rot, loc = [], []
    for k, th in roll:
        px = -9.0 * max(-1.0, min(1.0, th / 4.0))  # roll on the right hooves, then the left (the pivot slides across as it rocks back over)
        dx, dy = react.pivot_roll(th, px)
        back = 1.5 * min(1.0, k / 6) ** 0.7  # staggers back off the blow
        pitch = 6 * min(1.0, k / 6) * (1 - max(0, k - 9) / 9)
        rot.append((k * f, (pitch, 0, th)))
        loc.append((k * f, (dx, dy, back)))
    rest = (dx, dy, 1.5)
    # The thud squashes it (its local x is up once it lies on its side).
    scale = [(0, (1, 1, 1)), (17 * f, (1, 1, 1)), (dimp, (0.88, 1.06, 1.04)), (21 * f, (0.95, 1.03, 1.02)), (25 * f, (1, 1, 1)), (50 * f, (1, 1, 1))]
    rot += [(20 * f, (0, 0, 86.5)), (22 * f, (0, 0, 90)), (25 * f, (0, 0, 89)), (28 * f, (0, 0, 90)), (50 * f, (0, 0, 90))]
    loc += [(50 * f, rest)]
    death = {R: {"rot": rot, "loc": loc, "scale": scale},
             "head": {"rot": seq((0, 0, 0, 0), (6 * f, 22, 0, 0), (9 * f, 14, 0, -6), (dimp, 6, -10, 0), (22 * f, -10, 15, 0), (26 * f, -5, 9, 0), (30 * f, -8, 14, 0), (50 * f, -8, 14, 0))}}
    for name, s_x in (("front-r", 18), ("rear-r", -12)):  # the upper legs
        death[name] = {"rot": seq((0, 0, 0, 0), (6 * f, -10 if s_x > 0 else 8, 0, 0), (9 * f, -20 if s_x > 0 else 15, 0, 0), (dimp, s_x * 0.5, 0, 12), (21 * f, s_x * 0.8, 0, 18),
                                  (26 * f, s_x, 0, -18), (30 * f, s_x, 0, -9), (34 * f, s_x, 0, -14), (50 * f, s_x, 0, -14))}
    for name, s_x in (("front-l", 14), ("rear-l", -16)):  # the legs that hit the ground
        death[name] = {"rot": seq((0, 0, 0, 0), (6 * f, -10 if s_x > 0 else 8, 0, 0), (9 * f, -20 if s_x > 0 else 15, 0, 0), (dimp, s_x, 0, 0), (21 * f, s_x * 1.3, 0, 8),
                                  (25 * f, s_x, 0, 0), (50 * f, s_x, 0, 0))}
    return make("creatures", "mutant-boar", "Mutant Boar", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=imp), Clip("hit", hit, loop=False), Clip("death", death, loop=False, impact=dimp)],
                sockets=[rig.socket("socket-snout", (CX, 15.5, 0.5), parent="head")],
                pfx=[fx("rvx-apocalypse-gore-burst", "socket-snout", "clip:attack", size=14, at=imp)])


def trot_bob(f: int) -> float:
    """The trot's body height per frame: sinks after each landing (lowest
    0.75 below rest two frames on), rises to its highest at push-off."""
    import math
    keys = [(0, -0.3), (2, -0.75), (6.5, 0.4), (9, -0.3)]
    u = f % 9
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if a <= u <= b:
            w = (u - a) / (b - a)
            return va + (vb - va) * (1 - math.cos(math.pi * w)) / 2
    return keys[0][1]


def build():
    # Every frame of the one-shots sits on the floor (nothing sinks or
    # floats); the hit's pop and the death's bounce are keyed lifts.
    a = _build()
    react.gait(a, "move", {"front-l": (0, 6), "rear-r": (0, 6), "front-r": (9, 6), "rear-l": (9, 6)}, stride=7.6, swing=2.0, body_y=trot_bob)
    atk = {"front-l": [(10, 13, -12, 2.5), (20, 25, 0, 2)], "front-r": [(10, 13, -12, 2.5), (25, 30, 0, 2)],
                                  "rear-l": [(14, 19, -6, 1.5), (28, 33, 0, 1.5)], "rear-r": [(15, 20, -6, 1.5), (23, 28, 0, 1.5)]}
    react.step_legs(a, "attack", atk)
    react.track_floor(a, "attack")
    react.pin_feet(a, "attack", atk)
    # The hit's feet fly back with the body, land with it and stay planted,
    # then step home with a lift as it sways forward past the spot.
    hits = react.hit_steps(3.6, ['front-l', 'front-r'], ['rear-r', 'rear-l'], slow=1.1, lift=1.8, hind_lift=0.7)
    react.step_legs(a, "hit", hits, kick=True)
    react.track_floor(a, "hit", air=react.arc(1.2, 4, 4), kick=True)
    react.pin_feet(a, "hit", hits)
    react.track_floor(a, "death", air=react.arc(0.5, 2, 2, start=18))
    return a
