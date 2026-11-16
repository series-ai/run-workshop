"""UFO drone, in the Pirate Nation mecha style.

A small flying saucer drone with a face, a toy caricature. The saucer: a
riveted steel belly, a thick dark rim with recessed cyan running lights
(every third one hazard orange) and a white hull deck with dark panel
seams, a hazard-orange outer band and a copper patch plate. On top sits
the drone's head: a white hull pod with one big dark-framed cyan sensor
eye (lens, pupil and glint) under a steel brow, a side ear sensor and two
antennae (one bent, with orange tips). A copper tractor emitter with a
cyan glow hangs underneath. Faceted frustums (true slopes); detail is
paint. Clips: idle (hover, the saucer spins), move (cruise nose-down),
attack (tilt and zap from
the beam socket, plasma impact PFX), hit (wobble), death (power
failure, drop, crash and settle on its rim).
Faces -Z.
"""
import math

import numpy as np

from _motion import DEATH_FLOOR, curve
from _life import C, P, Clip, Grid, Rig, asset, coords, keys, ngon_y, spin, wave
from pnshapes import bar, flat_ngon, ngon_radius, seams

S = (26, 24, 26)
CX, CZ = 13, 13
YR = 5            # rim bottom
RIM = 3           # rim height
DECK = YR + RIM   # deck bottom
HEAD = DECK + 3   # head bottom (on the collar)
EY = HEAD + 3.5   # eye centre height
N = 12


def sector(g: Grid, n: int = N):
    """Facet index and position across the facet (0..1) round the y axis."""
    X, Y, Z = coords(g)
    a = (np.arctan2(Z - CZ, X - CX) + math.pi / 2 - math.pi / n) % (2 * math.pi)
    f = a / (2 * math.pi) * n
    return np.floor(f).astype(int) % n, f % 1


def core() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # tractor emitter under the belly: copper with a cyan glowing mouth
    em = ngon_y(g, CX, CZ, 2.5, 0, YR - 1, "rust", 4, n=8, r_top=3.5)
    P.flat(g, em & (Y > 2), "rust", 5)
    P.flat(g, em & (Y > 1) & (Y < 2), "steel", 3)
    P.flat(g, em & (Y < 1), "plasma", 6)
    # the head pod: an eight-sided white hull frustum and a cap
    n0 = len(g.solids)
    head = ngon_y(g, CX, CZ, 4.8, HEAD, HEAD + 6, "bone", 6, n=8, r_top=4.4)
    cap = ngon_y(g, CX, CZ, 4.4, HEAD + 6, HEAD + 8, "bone", 6, n=8, r_top=2.6)
    pod = head | cap
    P.flat(g, pod, "bone", 6)
    # two dark vents on the back of the head
    P.flat(g, head & (Z > CZ + 3.8) & (np.abs(Y - (HEAD + 3.5)) < 1.6) & ((np.abs(X - (CX - 1)) < 0.5) | (np.abs(X - (CX + 1)) < 0.5)), "steel", 3)
    P.flat(g, pod & seams(g, g.solids[n0:], 0.6), "bone", 4)
    P.flat(g, head & (Y < HEAD + 1), "steel", 3)        # neck ring
    P.flat(g, head & (np.abs(Y - (HEAD + 1.5)) < 0.5), "bone", 4)
    P.flat(g, pod & (np.abs(Y - (HEAD + 6.5)) < 0.5), "steel", 4)  # cap seam
    P.flat(g, cap & (Y > HEAD + 7), "bone", 7)
    # the big sensor eye on the front: a dark ring, a cyan lens, a pupil
    zf = CZ - 4.8
    g.prism("z", flat_ngon(CX, EY, 3.1, 10), zf - 1.2, zf + 2, C("steel", 2))
    ring = g.solids[-1].mask(g.shape)
    g.prism("z", flat_ngon(CX, EY, 2.2, 10), zf - 2, zf, C("plasma", 4))
    lens = g.solids[-1].mask(g.shape)
    r = np.hypot(X - CX, Y - EY)
    P.flat(g, ring, "steel", 2)
    P.flat(g, ring & (Y > EY + 2.2), "steel", 3)
    P.flat(g, lens, "plasma", 4)
    P.flat(g, lens & (r < 1.6), "plasma", 5)
    P.flat(g, lens & (r < 0.9), "navy", 1)               # pupil
    P.flat(g, lens & (np.abs(X - (CX - 1)) < 0.5) & (np.abs(Y - (EY + 1)) < 0.5), "plasma", 7)  # glint
    # a steel brow over the eye (a slight frown: it is a guard drone)
    bar(g, "z", (CX - 2.9, EY + 3.5), (CX + 2.9, EY + 2.9), 1.2, zf - 1.0, zf + 1.0, "steel", 3)
    # an ear sensor on the right side with an orange lamp
    g.prism("x", flat_ngon(EY, CZ, 1.2, 6), CX + 4.0, CX + 5.6, C("steel", 4))
    ear = g.solids[-1].mask(g.shape)
    P.flat(g, ear & (X > CX + 4.8), "orange", 5)
    # two antennae: a straight one, and a bent one with a kink
    bar(g, "z", (CX - 2.0, HEAD + 7), (CX - 3.5, HEAD + 10.5), 1.0, CZ - 0.5, CZ + 0.5, "steel", 4)
    bar(g, "z", (CX + 1.8, HEAD + 7), (CX + 2.6, HEAD + 9), 1.0, CZ - 0.5, CZ + 0.5, "steel", 4)
    bar(g, "z", (CX + 2.6, HEAD + 9), (CX + 4.6, HEAD + 10), 1.0, CZ - 0.5, CZ + 0.5, "steel", 4)
    for (tx, ty) in ((CX - 3.6, HEAD + 10.5), (CX + 4.8, HEAD + 10)):
        g.prism("y", flat_ngon(tx, CZ, 0.9, 6), ty - 0.5, ty + 1.3, C("orange", 5))
        P.flat(g, g.solids[-1].mask(g.shape), "orange", 5)
    return g


def saucer() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    k, f = sector(g)
    d = ngon_radius(g, "y", CX, CZ, N)
    # belly: riveted steel, radial seams, a copper ring round the emitter
    n0 = len(g.solids)
    low = ngon_y(g, CX, CZ, 5.5, YR - 2, YR, "steel", 4, n=N, r_top=11.5)
    P.flat(g, low, "steel", 4)
    P.flat(g, low & seams(g, g.solids[n0:], 0.6), "steel", 2)
    P.flat(g, low & (d < 6.5), "rust", 3)
    # rim: a steel band with recessed running lights and a hazard lip
    rim = ngon_y(g, CX, CZ, 11.5, YR, YR + RIM, "steel", 3, n=N)
    P.flat(g, rim, "steel", 4)
    P.flat(g, rim & (Y < YR + 1), "steel", 3)
    frame = rim & (np.abs(f - 0.5) < 0.34) & (np.abs(Y - (YR + 1.5)) < 0.6)
    P.flat(g, frame, "steel", 2)
    lamp = rim & (np.abs(f - 0.5) < 0.18) & (np.abs(Y - (YR + 1.5)) < 0.6)
    P.flat(g, lamp, "plasma", 6)
    P.flat(g, lamp & (k % 3 == 0), "orange", 6)
    P.flat(g, rim & (Y > YR + RIM - 1), "orange", 4)   # hazard-orange lip
    P.flat(g, rim & (Y > YR + RIM - 1) & (np.abs(f - 0.5) > 0.44), "steel", 2)
    # deck: white hull panels with seams, an orange band and a copper patch
    n0 = len(g.solids)
    deck = ngon_y(g, CX, CZ, 11.5, DECK, DECK + 2, "bone", 6, n=N, r_top=6.5)
    P.flat(g, deck, "bone", 6)
    P.flat(g, deck & (d < 7.6), "bone", 7)
    P.flat(g, deck & (d > 9.1), "orange", 4)
    P.flat(g, deck & (np.abs(d - 7.9) < 0.45), "bone", 4)
    P.flat(g, deck & ((f < 0.1) | (f > 0.9)) & (k % 2 == 0), "bone", 4)   # panel seams
    P.flat(g, deck & (d > 9.1) & ((f < 0.1) | (f > 0.9)), "orange", 3)
    patch = deck & (k == 4) & (d > 6.9) & (d < 7.9) & (np.abs(f - 0.5) < 0.3)
    P.flat(g, patch, "rust", 4)
    # collar the head sits in
    col = ngon_y(g, CX, CZ, 6.5, DECK + 2, DECK + 3, "steel", 3, n=N, r_top=5.6)
    P.flat(g, col, "steel", 3)
    P.flat(g, col & (np.abs(f - 0.5) < 0.15), "plasma", 5)
    return g


REST_TILT, LAND, BOUNCE, REST = 29.5, 1.0, 1.0, 0.5  # death: the resting tilt and heights


def build():
    rig = Rig()
    rig.add("ufo-drone", core(), (CX, 0, CZ))
    rig.add("saucer", saucer(), (CX, YR, CZ), "ufo-drone")
    beam = rig.sock("socket-beam", (CX, 0, CZ), "ufo-drone")
    z = (0.0, 0.0, 0.0)
    idle = {"ufo-drone": {"loc": wave(2.0, "y", 1.2), "rot": wave(2.0, "z", 4, phase=0.7)}, "saucer": {"rot": spin(2.0, "y", 360)}}
    # Charge and zap: the drone surges up and rears back while the saucer
    # spins up hard, hangs there, then snaps forward and dives at the
    # target and fires the beam (impact 0.4 s); the recoil kicks it back up
    # and over, it holds the zap with a shudder, then floats home as the
    # spin winds down.
    F = 1 / 30
    fire_t = 12 * F
    attack = {"ufo-drone": {"rot": curve((0, z), (5, (18, 0, 0)), (9, (30, 0, 0)), (10, (31, 0, 0)), (12, (-34, 0, 0)), (13, (-40, 0, 0)), (15, (-16, 0, 6)),
                                         (18, (-26, 0, -6)), (21, (-18, 0, 5)), (24, (-22, 0, -3)), (28, (8, 0, 0)), (32, (-2, 0, 0)), (36, z)),
                            "loc": curve((0, z), (5, (0, 5, 3)), (9, (0, 8, 4.5)), (10, (0, 8.2, 4.6)), (12, (0, 4.4, -6)), (13, (0, 4.2, -7)), (15, (0, 5.5, -2)),
                                         (18, (0, 3.2, -3.4)), (21, (0, 4.0, -2.4)), (24, (0, 3.4, -2.8)), (28, (0, 0.8, 1.2)), (32, (0, 0, -0.3)), (36, z))},
              "saucer": {"rot": curve((0, z), (10, (0, 460, 0)), (12, (0, 580, 0)), (24, (0, 980, 0)), (36, (0, 1080, 0)))}}
    # Knockback: the blow pops the drone up and back and tips it over, it
    # wobbles, sinks a beat and floats back level.
    hit = {"ufo-drone": {"rot": keys((0, z), (2 * F, (14, 0, 16)), (5 * F, (18, 0, 20)), (10 * F, (-8, 0, -10)), (15 * F, (4, 0, 6)), (21 * F, (-2, 0, -2)), (28 * F, z)),
                         "loc": keys((0, z), (2 * F, (1, 1.5, 2)), (5 * F, (1.5, 2.5, 3.5)), (10 * F, (0.5, 0.5, 3)), (16 * F, (0, 1, 2.4)), (23 * F, (0, 0, 0.3)),
                                     (28 * F, z))},
           "saucer": {"loc": keys((0, z), (3 * F, (0, -0.6, 0)), (7 * F, (0, 0.3, 0)), (11 * F, z), (28 * F, z))}}
    # Power failure: the engine coughs and surges, lurching the drone high
    # up and tipping it while the saucer spin falters; it sputters (drops a
    # little, catches, surges again) and wobbles at the top, then the power
    # dies and it falls with gravity (impact 1.033 s), crashes onto its rim
    # edge, bounces a little and tips over to rest with its rim and belly on
    # the floor.
    die_t = 31 * F
    death = {"ufo-drone": {"rot": curve((0, z), (3, (0, 0, 16)), (6, (-12, 0, -14)), (9, (10, 0, 12)), (12, (-8, 0, -10)), (15, (6, 0, 8)), (18, (-6, 0, -6)),
                                        (21, (4, 0, 6)), (24, (-3, 0, 2)), (31, (4, 0, 26)), (34, (3, 0, 20)), (38, (2, 0, REST_TILT + 2)), (42, (2, 0, REST_TILT - 1)),
                                        (47, (2, 0, REST_TILT)), (56, (2, 0, REST_TILT))),
                           "loc": curve((0, z), (3, (0, 5, 0)), (6, (0, 3, 0)), (9, (0, 10, 0)), (12, (0, 8.5, 0)), (15, (0, 15, 0)), (18, (0, 17.5, 0)),
                                        (21, (0.6, 16.5, 0)), (24, (0, 18.5, 0)), (31, (-1.0, LAND, 0)), (34, (-1.4, LAND + BOUNCE, 0)), (38, (-2.0, REST, 0)),
                                        (56, (-2.0, REST, 0)))},
             "saucer": {"rot": curve((0, z), (3, (0, 40, 0)), (6, (0, 50, 0)), (9, (0, 90, 0)), (12, (0, 100, 0)), (15, (0, 140, 0)), (18, (0, 170, 0)),
                                     (24, (0, 190, 0)), (31, (0, 205, 0)), (38, (0, 214, 0)), (48, (0, 218, 0)), (56, (0, 218, 0))),
                        "loc": curve((0, z), (31, z), (33, (0, -0.4, 0)), (36, (0, 0.3, 0)), (40, z), (56, z))}}
    # Move: the drone cruises nose-down, riding a little higher than its
    # hover, bobbing once a loop with the bank rocking a quarter-beat behind
    # and the nose dipping on each sink; the saucer spins twice as fast as
    # in idle (2 turns a loop). Loops seamlessly.
    move = {"ufo-drone": {"loc": wave(1.2, "y", 0.8, base=(0.0, 2.6, 0.0)),
                          "rot": [(t, (-12.0 + 2.0 * math.sin(2 * math.pi * t / 1.2 + 0.6), 0.0, 3.0 * math.sin(2 * math.pi * t / 1.2 - math.pi / 2)))
                                  for t in (k * 1.2 / 8 for k in range(9))]},
            "saucer": {"rot": spin(1.2, "y", 720)}}
    return asset("creatures", "ufo-drone", "UFO Drone", rig.root,
                 clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=fire_t), Clip("hit", hit, loop=False, floor=True), Clip("death", death, loop=False, impact=die_t, floor=DEATH_FLOOR)],
                 sockets=[beam], pfx=[{"effectId": "rvx-space-ray-zap", "socket": "socket-beam", "trigger": "clip:attack", "size": 16, "aim": [0.0, -1.0, 0.0], "at": round(fire_t, 3)}])
