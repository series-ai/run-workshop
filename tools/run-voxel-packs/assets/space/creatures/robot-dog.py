"""Robot dog, in the Pirate Nation mecha style.

A small boxy patrol bot with a white and steel hull, copper armor, a framed
cyan face, mounted radar ears, plated piston legs, and a lit antenna tail.
Clips: idle, move, attack (pounce and bite), hit, death. Faces -Z.
"""
import numpy as np

import pnglyph
from _motion import DEATH_FLOOR, curve
from _life import P, Clip, Grid, Rig, asset, box, coords, edges, front, hazard, keys, light_top, quad, side, wave
from voxgrid import C

S = (20, 30, 26)
CX = 10
LEGS = {"leg-fl": (CX + 3, 8), "leg-fr": (CX - 3, 8), "leg-bl": (CX + 3, 18), "leg-br": (CX - 3, 18)}  # (x, z) of each hip
YB = 6  # body bottom


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    belly = box(g, CX - 4, YB, 6, CX + 4, YB + 3, 21, "steel", 5)
    P.plates(g, belly, "steel", 5, size=(5, 4), seed=2)
    P.flat(g, belly & (Y < YB + 1), "steel", 3)
    back = side(g, [(YB + 3, 5), (YB + 3, 21), (YB + 7, 20), (YB + 8, 16), (YB + 8, 8), (YB + 7, 5.5)], CX - 5, CX + 5, "bone", 6)
    P.plates(g, back, "bone", 6, size=(6, 5), seed=3)
    light_top(g, back, "bone", 7)
    # Steel skirts and copper armor mark the body edge.
    P.flat(g, back & ((X < CX - 4) | (X > CX + 4)) & (Y < YB + 4), "steel", 4)
    P.flat(g, back & ((X < CX - 4) | (X > CX + 4)) & (Y > YB + 4) & (Y < YB + 6), "rust", 5)
    hazard_strip = back & ((X < CX - 4) | (X > CX + 4)) & (Y > YB + 3) & (Y < YB + 4.5) & (Z > 16) & (Z < 19)
    hazard(g, hazard_strip, period=3, a=("orange", 6), b=("steel", 3), frame="wall")
    saddle = back & (Y > YB + 7) & (Z > 10) & (Z < 16)
    P.flat(g, saddle, "steel", 5)
    P.outline(g, saddle, "steel", 3)
    P.flat(g, saddle & (np.abs(X - CX) < 1), "cyan", 6)
    P.flat(g, saddle & (np.abs(X - CX) < 1) & (Y > YB + 7.5), "cyan", 7)
    # Narrow side lamps sit inside the copper belt.
    side_lamps = back & ((X < CX - 4) | (X > CX + 4)) & (np.abs(Z - 13) < 2.5) & (Y > YB + 4.5) & (Y < YB + 6.5)
    P.flat(g, side_lamps, "cyan", 5)
    P.flat(g, side_lamps & (np.abs(Z - 13) < 1), "cyan", 7)
    # Rear service vents and small fasteners add scale without filling the panels.
    rear = back & (Z > 19) & (Y > YB + 3.5) & (Y < YB + 7)
    P.flat(g, rear & (np.floor(Y) % 2 == 0), "steel", 3)
    for x in (CX - 3, CX + 3):
        P.flat(g, back & (np.abs(X - x) < 0.6) & (Z > 19) & (Y > YB + 6), "rust", 6)
    return g


def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    h = box(g, CX - 5, YB + 5, 0, CX + 5, YB + 14, 7, "orange", 6)
    P.plates(g, h, "bone", 6, size=(5, 5), seed=1)
    P.flat(g, edges(h), "steel", 3)
    light_top(g, h, "bone", 7)
    # Copper cheek guards and steel rear panels frame the white head shell.
    P.flat(g, h & (Z < 1) & (np.abs(X - CX) > 4) & (Y > YB + 6), "rust", 5)
    P.flat(g, h & (Z > 5) & (np.abs(X - CX) > 2) & (Y > YB + 7) & (Y < YB + 13), "steel", 5)
    P.flat(g, h & (Z > 5) & (np.abs(X - CX) > 3.5) & (Y > YB + 7) & (Y < YB + 12), "bone", 6)
    P.flat(g, h & (Z > 5) & (np.abs(X - CX) < 2.5) & (Y > YB + 7) & (Y < YB + 12), "steel", 3)
    # The face sits in a dark bezel with a small cyan status rim.
    face = h & (Z < 1) & (np.abs(X - CX) < 4.5) & (Y > YB + 6) & (Y < YB + 13)
    P.flat(g, face, "steel", 2)
    screen = face & (np.abs(X - CX) < 3.5) & (Y > YB + 7) & (Y < YB + 12)
    P.flat(g, screen, "navy", 2)
    P.outline(g, screen, "cyan", 4, normal="z")
    legend = {"e": C("cyan", 7), "E": C("cyan", 5), "m": C("cyan", 6), "w": C("bone", 7)}
    rows = [".E....E.", "ew....we", "........", ".mmmmmm.", "..mwwm.."]
    pnglyph.stamp(g, "-z", 0, CX - 4, YB + 7, rows, legend)
    # Two copper sensor studs sit below the screen.
    for x in (CX - 4, CX + 4):
        P.flat(g, h & (Z < 1) & (np.abs(X - x) < 0.6) & (Y > YB + 5) & (Y < YB + 6), "rust", 6)
    ears = np.zeros(g.shape, dtype=bool)
    sockets = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        # Each ear starts inside a broad steel socket on the head crown.
        sockets |= box(g, CX + s * 3 - 1, YB + 14, 1, CX + s * 3 + 1, YB + 16, 6, "steel", 4)
        ears |= front(g, [(CX + s * 3, YB + 14), (CX + s * 5, YB + 14), (CX + s * 7, YB + 17), (CX + s * 5, YB + 17)], 2, 5, "bone", 6)
    P.flat(g, sockets, "steel", 4)
    P.flat(g, sockets & (Y > YB + 14.5), "rust", 5)
    P.flat(g, sockets & (Y > YB + 14.5) & (np.abs(X - CX) > 3.5), "cyan", 6)
    P.plates(g, ears, "bone", 6, size=(4, 3), seed=4)
    P.flat(g, ears & (Y > YB + 16), "cyan", 6)
    P.flat(g, ears & (Y > YB + 17), "cyan", 7)
    return g


def leg(x: float, z: float) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    lg = side(g, quad((YB + 1, z), (3, z + 1), 1.5, 1.2), x - 1.2, x + 1.2, "steel", 5)
    P.flat(g, lg, "steel", 5)
    # A white thigh plate follows the leg slope. A copper stripe marks its edge.
    thigh = lg & (Y > YB - 1) & (Y < YB + 3.5)
    P.plates(g, thigh, "bone", 6, size=(3, 3), seed=int(z))
    P.flat(g, thigh & (np.abs(Y - (YB + 1.5)) < 0.6), "rust", 5)
    # The hip and ankle bands define the moving joints.
    P.flat(g, lg & (Y > YB + 2.5), "steel", 3)
    P.flat(g, lg & (Y > YB + 2.5) & (np.abs(X - x) < 0.7), "cyan", 5)
    paw = box(g, x - 1.5, 0, z - 2, x + 1.5, 3, z + 2, "steel", 4)
    P.plates(g, paw, "steel", 5, size=(3, 3), seed=int(z + x))
    light_top(g, paw, "steel", 6)
    P.flat(g, paw & (Y < 1), "steel", 2)
    P.flat(g, paw & (Z < z - 1.5) & (np.abs(X - x) < 0.7), "bone", 6)
    P.flat(g, paw & (Z < z - 1.5) & (np.abs(X - x) < 0.7) & (Y > 1), "cyan", 5)
    return g


def tail() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    t = side(g, quad((YB + 7, 20), (YB + 14, 22.5), 0.7), CX - 0.6, CX + 0.6, "steel", 6)
    P.flat(g, t, "steel", 5)
    P.flat(g, t & (Y > YB + 9) & (Y < YB + 10), "rust", 6)
    P.flat(g, t & (Y > YB + 12), "steel", 4)
    tip = box(g, CX - 1, YB + 13, 21, CX + 1, YB + 15, 23, "cyan", 6)
    P.flat(g, tip, "cyan", 6)
    P.flat(g, tip & (Y > YB + 14), "cyan", 7)
    P.flat(g, tip & (Z > 22), "steel", 3)
    return g


LIE, HEAD = 86.0, -24.0  # death: the roll onto the side (the body edge just clears the floor), the head drop


def build():
    rig = Rig()
    rig.group("robot-dog", (CX, 0, 13))
    rig.add("body", body(), (CX, YB + 4, 13), "robot-dog")
    rig.add("head", head(), (CX, YB + 6, 5), "body")
    for name, (x, z) in LEGS.items():
        rig.add(name, leg(x, z), (x, YB + 1, z), "body")
    rig.add("tail", tail(), (CX, YB + 7, 20), "body")
    z0 = (0.0, 0.0, 0.0)
    idle = {"tail": {"rot": wave(0.6, "z", 25)}, "head": {"rot": keys((0, z0), (0.8, (0, 0, 12)), (1.6, z0), (2.4, z0))},
            "body": {"loc": wave(1.2, "y", 0.3)}}
    t = 0.5
    fwd, back = (25.0, 0.0, 0.0), (-25.0, 0.0, 0.0)
    move = {"leg-fl": {"rot": keys((0, fwd), (t / 2, back), (t, fwd))}, "leg-br": {"rot": keys((0, fwd), (t / 2, back), (t, fwd))},
            "leg-fr": {"rot": keys((0, back), (t / 2, fwd), (t, back))}, "leg-bl": {"rot": keys((0, back), (t / 2, fwd), (t, back))},
            "body": {"loc": keys((0, z0), (t / 4, (0, 1, 0)), (t / 2, z0), (t * 0.75, (0, 1, 0)), (t, z0))},
            "tail": {"rot": wave(t, "z", 20)}}
    F = 1 / 30

    def hold(*poses):
        """Robotic keys: each (frame_in, frame_out, value) arrives at
        frame_in and stays locked until frame_out (as security-robot)."""
        out = []
        for f0, f1, v in poses:
            out.append((f0, v))
            if f1 > f0:
                out.append((f1, v))
        return curve(*out)

    def legs(*poses):
        """Per-leg robotic keys from (frame_in, frame_out, front_x, back_x)."""
        return {name: {"rot": hold(*((f0, f1, (fx if name[-2] == "f" else bx, 0, 0)) for f0, f1, fx, bx in poses))} for name in LEGS}

    # Pounce bite, robotic: move, lock, move, lock. The dog crouches back
    # with its nose up and tail high in 3 frames and locks there (the
    # wind-up), lunges forward in 2 frames and snaps its head down on the
    # target (impact 0.333 s), clamps down once more and locks, then backs
    # off in two locked steps. No shaking, no tail thrash: a machine.
    hit_f = 10
    hit_t = hit_f * F
    attack = {"robot-dog": {"loc": hold((0, 0, z0), (3, 8, (0, -0.6, 3.0)), (hit_f, 12, (0, 1.0, -11)), (14, 19, (0, 0.4, -12.5)), (22, 24, (0, 0, -5)),
                                        (27, 28, z0))},
              "body": {"rot": hold((0, 0, z0), (3, 8, (12, 0, 0)), (hit_f, 12, (-14, 0, 0)), (14, 19, (-17, 0, 0)), (22, 24, (-5, 0, 0)), (27, 28, z0))},
              "head": {"rot": hold((0, 0, z0), (3, 8, (26, 0, 0)), (hit_f, 12, (-30, 0, 0)), (14, 19, (-40, 0, 0)), (22, 24, (-10, 0, 0)), (27, 28, z0))},
              "tail": {"rot": hold((0, 0, z0), (3, 8, (-50, 0, 0)), (hit_f, 19, (24, 0, 0)), (22, 24, (6, 0, 0)), (27, 28, z0))},
              **legs((0, 0, 0, 0), (3, 8, -18, 18), (hit_f, 19, 22, -28), (22, 24, 8, -8), (27, 28, 0, 0))}
    # Hit from the front, robotic: frames 0-2 the dog jolts back with its
    # nose thrown up and locks there, snaps forward to correct and locks
    # again, then resets (0.5 s). Head and tail lock with the body.
    hit = {"robot-dog": {"loc": hold((0, 0, z0), (2, 5, (0, 0.6, 2.6)), (8, 11, (0, 0, 1.2)), (14, 15, z0))},
           "body": {"rot": hold((0, 0, z0), (2, 5, (9, 0, 4)), (8, 11, (-3, 0, 0)), (14, 15, z0))},
           "head": {"rot": hold((0, 0, z0), (2, 5, (16, 8, 0)), (8, 11, (-4, 2, 0)), (14, 15, z0))},
           "tail": {"rot": hold((0, 0, z0), (2, 5, (24, 0, 0)), (8, 11, (-6, 0, 0)), (14, 15, z0))},
           **legs((0, 0, 0, 0), (2, 5, 14, -6), (8, 11, -3, 3), (14, 15, 0, 0))}
    # Shutdown, onto its side, robotic: the blow jolts the dog back (nose
    # up) and it locks; a glitch snaps its head aside and it sags and locks
    # again; then the power cuts and it goes over sideways stiff, rolling
    # about the outer edge of its left paws, slow at first and fastest at
    # the floor (one key a frame), into a hard thud on its side (impact
    # 0.667 s), a 2-frame tick off the floor and dead still. The legs lock
    # out stiff as it goes; the head and tail clunk down a frame after the
    # body.
    f0, f_hit, end = 10, 20, 30
    edge = -4.5  # the outer edge of the paws on the side it falls to (x from the root)

    def pin(a):
        r = np.radians(a)
        return (edge - edge * np.cos(r), -edge * np.sin(r))

    roll = [(0, 0.0), (f0, 0.0)]
    for f in range(f0 + 1, f_hit):
        u = (f - f0) / (f_hit - f0)
        roll.append((f, LIE * (0.12 * u + 0.88 * u ** 2.6)))
    roll += [(f_hit, LIE), (f_hit + 1, LIE - 3.0), (f_hit + 2, LIE - 3.5), (f_hit + 3, LIE - 1.5), (f_hit + 4, LIE), (end, LIE)]
    back = {0: 0.0, 2: 2.2, 5: 2.2, 7: 2.6, 9: 2.6}

    def back_z(f):
        ks = sorted(back)
        for k0, k1 in zip(ks, ks[1:]):
            if f <= k1:
                return back[k0] + (back[k1] - back[k0]) * (f - k0) / (k1 - k0)
        return back[ks[-1]]
    death = {"robot-dog": {"rot": [(f * F, (0.0, 0.0, a)) for f, a in roll],
                           "loc": [(f * F, (pin(a)[0], pin(a)[1], back_z(f))) for f, a in roll]},
             "body": {"rot": hold((0, 0, z0), (2, 5, (9, 0, 0)), (7, 9, (-4, 0, 3)), (f0 + 2, end, z0)),
                      "loc": hold((0, 0, z0), (2, 5, (0, 0.5, 0)), (7, 9, (0, -0.8, 0)), (f0 + 2, end, z0))},
             "head": {"rot": hold((0, 0, z0), (2, 5, (18, 0, 0)), (7, 9, (-6, 0, -18)), (f0 + 2, f_hit, (-10, 0, -10)), (f_hit + 2, end, (HEAD, 0, -26)))},
             "tail": {"rot": hold((0, 0, z0), (2, 5, (24, 0, 0)), (7, 9, (-10, 0, 0)), (f0 + 2, f_hit, (10, 0, 0)), (f_hit + 2, end, (-20, 0, -40)))},
             **legs((0, 0, 0, 0), (2, 5, 14, -6), (7, 9, 4, -4), (f0 + 2, end, 26, -26))}
    return asset("creatures", "robot-dog", "Robot Dog", rig.root,
                 clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=hit_t, floor=True, ease=0), Clip("hit", hit, loop=False, floor=True, ease=0), Clip("death", death, loop=False, impact=f_hit * F, floor=DEATH_FLOOR, ease=0)])
