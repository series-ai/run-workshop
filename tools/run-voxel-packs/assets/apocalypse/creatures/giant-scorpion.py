"""Irradiated giant scorpion, in the Pirate Nation creature style.

A chunky caricature arachnid, bigger than a person: a broad faceted
carapace over a segmented abdomen (true slopes all round, rule F2), eight
thick jointed legs on bone claw tips, two oversized pincers held out in
front whose outer finger snaps (rule F4), and a fat five-segment tail
curling over the back to a glowing toxic stinger (rule C3). Two big eyes
and three small ones glow on the head plate. Plate seams, the warm shell
ramp, scuffs and the sickly belly are paint (rules S1, S3). Clips: idle
(the tail sways and the pincers flex), move (the legs walk and the body
rolls), attack (the tail whips over the head while both pincers snap),
hit, death (rears, the legs give and it slams flat, the tail crashes
down). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint as PP
import _big_falls as B
from _big_falls import track as T
from _life import Rig, ctr, fx, limb, make, plan, seq, skin, wave
from voxgrid import Clip, Grid

SZ = (84, 62, 100)
CX = 42.0
SHELL = ("rust", 5)
JOINT = ("khaki", 4)
BELLY = ("sand", 5)
HIPS = {f"leg-{s}{k}": (CX + sgn * 12.0, 17.0, 37.0 + k * 10.0)
        for s, sgn in (("l", -1), ("r", 1)) for k in range(4)}
SHOULDER = {"arm-l": (CX - 19.0, 16.0, 32.0), "arm-r": (CX + 19.0, 16.0, 32.0)}
HAND = {"arm-l": (CX - 25.0, 13.0, 14.0), "arm-r": (CX + 25.0, 13.0, 14.0)}
TAIL = [(CX, 24.0, 84.0), (CX, 34.0, 82.0), (CX, 44.0, 76.0), (CX, 50.0, 66.0), (CX, 52.0, 55.0), (CX, 50.0, 45.0)]
TIP = (CX, 40.0, 29.0)


def plate(g: Grid, pts, y0, y1, shrink: float, lift=(0.0, 0.0), ramp=SHELL[0], shade=SHELL[1]):
    """One carapace plate: a plan polygon rising to a smaller offset copy."""
    cx = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[1] for p in pts) / len(pts)
    top = [(cx + lift[0] + (u - cx) * shrink, cz + lift[1] + (v - cz) * shrink) for u, v in pts]
    return plan(g, pts, y0, y1, ramp, shade, top=top)


def body() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    # ---- the carapace: one broad faceted shell over the head and chest
    shell = plate(g, [(28, 27), (56, 27), (61, 37), (61, 55), (55, 63), (29, 63), (23, 55), (23, 37)],
                  10, 26, 0.74, lift=(0.0, 1.5))
    # ---- the abdomen: three tapering segments behind it (true slopes)
    seg = plate(g, [(30, 61), (54, 61), (57, 69), (54, 75), (30, 75), (27, 69)], 10, 24, 0.82, lift=(0.0, 1.0))
    seg |= plate(g, [(32, 73), (52, 73), (54, 79), (52, 84), (32, 84), (30, 79)], 10, 23, 0.84, lift=(0.0, 1.0))
    seg |= plate(g, [(34, 82), (50, 82), (52, 86), (50, 90), (34, 90), (32, 86)], 11, 22, 0.86, lift=(0.0, 0.5))
    m = shell | seg
    skin(g, m, SHELL[0], SHELL[1], seed=1, cell=5)
    P.flat(g, m & (Y > 22), SHELL[0], SHELL[1] + 1)  # the lit crown of every plate
    P.flat(g, m & (Y < 13), *BELLY)  # the pale sickly belly
    for zs in (61.0, 73.0, 82.0):  # dark seams between the segments
        P.flat(g, m & (np.abs(Z - zs) < 1.2), "darkwood", 3)
    P.flat(g, m & (np.abs(Z - 37.0) < 1.0) & (Y > 18), "darkwood", 3)
    # a ridge down the spine and two scuffed patches
    P.flat(g, m & (np.abs(X - CX) < 2.2) & (Y > 20), SHELL[0], SHELL[1] + 2)
    for sx, sz, sr in ((34.0, 47.0, 5.0), (52.0, 69.0, 4.0)):
        P.flat(g, m & (np.hypot(X - sx, Z - sz) < sr) & (Y > 19), "khaki", 4)
        P.flat(g, m & (np.hypot(X - sx, Z - sz) < sr * 0.5) & (Y > 19), "khaki", 3)
    # ---- the head plate at the front, with five glowing eyes
    head = plate(g, [(31, 21), (53, 21), (57, 27), (55, 33), (29, 33), (27, 27)], 11, 22, 0.80, lift=(0.0, 1.0))
    P.flat(g, head, SHELL[0], SHELL[1] - 1)
    P.flat(g, head & (Y > 19), SHELL[0], SHELL[1] + 1)
    P.flat(g, head & (Y < 13), *BELLY)
    top = head & (Y > 20)
    for ex, ez, r in ((CX - 7.5, 26.0, 3.6), (CX + 7.5, 26.0, 3.6)):
        d = np.hypot(X - ex, Z - ez)
        P.flat(g, top & (d < r), "darkwood", 2)
        P.flat(g, top & (d < r - 1.2), "toxic", 6)
        P.flat(g, top & (d < r - 2.4), "bone", 7)
    for ex in (CX - 3.0, CX, CX + 3.0):  # the small median eyes
        P.flat(g, top & (np.hypot(X - ex, Z - 31.0) < 1.1), "toxic", 5)
    P.flat(g, head & (np.abs(Z - 21.5) < 1.0) & (Y < 16), "darkwood", 3)  # the dark mouth line
    # the chelicerae: two little mandibles under the head plate
    for s in (-1, 1):
        limb(g, (CX + s * 4, 13.0, 24.0), (CX + s * 5, 11.0, 18.0), 1.6, 0.9, "bone", 6, n=4)
    PP.blotch(g, m | head, "darkwood", 3, cell=7, chance=0.03, seed=2)
    return g


def leg(name: str) -> Grid:
    """One leg: a thick coxa out to a high knee, a thin shin down to a
    two-claw tip on the ground (true slopes)."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hx, hy, hz = HIPS[name]
    s = -1 if name[4] == "l" else 1
    k = int(name[5])
    reach = 10.0 + k * 1.5
    kz = hz + (k - 1.5) * 2.0
    fz = hz + (k - 1.5) * 5.0
    knee = (hx + s * reach, 27.0 - k * 0.8, kz)
    foot = (hx + s * (reach + 6.0), 1.6, fz)
    m = limb(g, (hx, hy, hz), knee, 3.4, 2.6, *JOINT, n=5)
    m |= limb(g, knee, foot, 2.6, 1.3, SHELL[0], SHELL[1], n=4)
    P.flat(g, m & (Y > 24), JOINT[0], JOINT[1] + 1)
    P.flat(g, m & (Y < 8), SHELL[0], SHELL[1] - 1)
    for dz in (-1.6, 1.6):  # two bone claws at the tip
        limb(g, (foot[0], 2.2, foot[2] + dz), (foot[0] + s * 2.5, 0.6, foot[2] + dz * 1.6), 1.0, 0.4, "bone", 6, n=4)
    return g


def arm(name: str) -> Grid:
    """One pincer arm: a fat upper arm, a forearm, a heavy palm and the
    fixed lower finger, all held out in front (rule F4)."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    sx, sy, sz = SHOULDER[name]
    hx, hy, hz = HAND[name]
    s = -1 if name.endswith("l") else 1
    elbow = (CX + s * 31.0, 15.0, 22.0)
    m = limb(g, (sx, sy, sz), elbow, 4.4, 3.8, *JOINT, n=5)
    m |= limb(g, elbow, (hx, hy, hz), 4.2, 3.8, SHELL[0], SHELL[1], n=5)
    palm = limb(g, (hx, hy, hz), (hx - s * 1.0, hy, hz - 6.0), 6.4, 5.0, SHELL[0], SHELL[1], n=6)
    finger = limb(g, (hx - s * 3.0, hy - 1.5, hz - 5.0), (hx - s * 6.0, hy - 2.0, hz - 14.0), 3.2, 1.2, SHELL[0], SHELL[1] - 1, n=4)
    P.flat(g, (m | palm) & (Y > 15), SHELL[0], SHELL[1] + 1)
    P.flat(g, (m | palm) & (Y < 10), *BELLY)
    P.flat(g, palm & (np.hypot(X - (hx - s * 1.0), Z - (hz - 6.0)) < 3.4), "khaki", 4)  # the knuckle plate
    P.flat(g, finger & (Z < hz - 10), "bone", 6)  # the pale biting edge
    PP.blotch(g, m | palm, "darkwood", 4, cell=5, chance=0.06, seed=3)
    return g


def jaw(name: str) -> Grid:
    """The outer finger of one pincer: it hinges on the palm and snaps."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hx, hy, hz = HAND["arm-l" if name.endswith("l") else "arm-r"]
    s = -1 if name.endswith("l") else 1
    m = limb(g, (hx + s * 3.0, hy + 2.0, hz - 5.0), (hx + s * 6.0, hy + 2.5, hz - 14.0), 3.2, 1.2, SHELL[0], SHELL[1], n=4)
    P.flat(g, m & (Z < hz - 10), "bone", 6)
    P.flat(g, m & (Y > hy + 3), SHELL[0], SHELL[1] + 1)
    return g


def tail(k: int) -> Grid:
    """One tail segment: a barrel with a dark ring at its joint."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    p0, p1 = TAIL[k], TAIL[k + 1]
    r0 = 6.2 - k * 0.6
    m = limb(g, p0, p1, r0, r0 - 0.8, SHELL[0], SHELL[1], n=6)
    P.flat(g, m & (Y > (p0[1] + p1[1]) / 2 + r0 * 0.4), SHELL[0], SHELL[1] + 1)
    P.flat(g, m & (Y < (p0[1] + p1[1]) / 2 - r0 * 0.4), *BELLY)
    d = np.hypot(Y - p1[1], Z - p1[2])
    P.flat(g, m & (d < r0 * 0.9), *JOINT)  # the ring at the far joint
    P.flat(g, m & (d < r0 * 0.6), "darkwood", 3)
    return g


def sting() -> Grid:
    """The stinger: a venom bulb and a long toxic barb with a bone point."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    bulb = limb(g, TAIL[-1], (TIP[0], TIP[1] + 6.0, TIP[2] + 8.0), 7.2, 5.0, SHELL[0], SHELL[1], n=6)
    P.flat(g, bulb & (Y > TAIL[-1][1]), SHELL[0], SHELL[1] + 1)
    P.flat(g, bulb & (Y < TAIL[-1][1] - 4), *BELLY)
    barb = limb(g, (TIP[0], TIP[1] + 7.0, TIP[2] + 9.0), TIP, 4.6, 0.0, "toxic", 6, n=5)
    P.flat(g, barb, "toxic", 6)
    P.flat(g, barb & (Z < TIP[2] + 3.0), "bone", 7)  # the pale needle point
    P.flat(g, bulb & (np.hypot(Y - (TIP[1] + 6.0), Z - (TIP[2] + 8.0)) < 5.2), "toxic", 5)
    return g


# the tail at rest: keeled over to the left, sloping off the body onto the
# floor and curving back behind it (fitted so each segment rests on it)
TAIL_LIE = ((0, 0, 96), (35, 0, 0), (29, 0, 6), (9, 0, 17), (-21, 0, -4))
STING_LIE = (-68, 0, 38)


def _foot(name):
    """A leg's tip (the end of its bone claws, its lowest point), from its hip."""
    sg = -1 if name[4] == "l" else 1
    k = int(name[5])
    return (sg * (10.0 + k * 1.5 + 8.5), 0.4 - HIPS[name][1], (k - 1.5) * 5.0)


# the height the idle stands on in the built file (its loop seam settles
# it a little lower than the rest pose): attack, hit and death start there
# so they blend from idle without a jump
IDLE_DROP = 0.09


def _plant_legs(root, keys, frames, lift=None, steps=None):
    """Pin every leg tip to the spot it stands on, in x, y and z, while the
    body lunges, pitches or is shoved: each leg swings and stretches a
    touch (no knee) so its tip never slides. `lift(frame)` raises the tips
    off the floor (the legs dangling through a pop). `steps(name)` gives a
    leg's step windows [(f0, f1, dz)]: inside one the tip lifts on an arc
    and moves dz along the body, planting on f1 (re-planting by stepping,
    never sliding)."""
    poser = B.Poser(root)
    for name in HIPS:
        home = poser.point({}, 0, name, _foot(name)) - np.array([0.0, IDLE_DROP, 0.0])
        wins = steps(name) if steps else []

        def tgt(f, home=home, wins=wins):
            off = np.zeros(3)
            for f0, f1, dz in wins:
                u = min(1.0, max(0.0, (f - f0) / (f1 - f0)))
                off[2] += dz * u * u * (3 - 2 * u)
                if 0 < u < 1:
                    off[1] += 3.0 * 4 * u * (1 - u)
            if lift:
                off[1] += lift(f)
            return home + off
        B.pin_tip(root, keys, name, _foot(name), frames, tgt)
        # a leg that dips into the floor anywhere (a claw corner as it
        # stretches) is lifted on its tip target until it clears it
        for f in frames:
            lo = poser.chain_low(keys, f, name) - B.floor_y(poser)
            if lo < -0.05:
                B.pin_tip(root, keys, name, _foot(name), [f], (lambda d, f=f: (lambda g: tgt(g) + np.array([0.0, d, 0.0])))(-lo))
    return keys


def _attack_hit(root):
    """Baked attack and hit (see _big_falls): (attack, impact frame, hit)."""
    # attack: it rears up 2.5 and cocks the tail hard back (the base back
    # 25 degrees, the tip curled tight), the claws spread wide and open
    # (f0-9, a coiled moving hold f9-11); then it lunges, nose down, and the
    # tail whips the sting out over its head in 3 frames, fastest at the
    # hit (impact f14): the sting lands about 15 up, past the claw tips,
    # which flank the target and snap shut. The sting drives on past the
    # hit, grinds in (moving), rebounds; the claws snap again; every leg
    # tip stays where it stands; then it settles back past rest to guard.
    I = 14
    cock = (25, -8, -16, -18, -14)
    throw = (-80, 26, 26, 26, 26)
    over = (-86, 28, 28, 27, 26)
    k = {"body": {"rot": T((0, (0, 0, 0)), (8, (6, 0, 0)), (11, (7, 0, 1)), (I, (-14, 0, 0), ">"), (I + 2, (-17, 0, 0)), (I + 6, (-12, 0, 0)), (I + 9, (-14, 0, 0)),
                           (I + 16, (2, 0, 0)), (I + 21, (-0.5, 0, 0)), (I + 25, (0, 0, 0))),
                  "loc": T((0, (0, 0, 0)), (8, (0, 2.4, 2.5)), (11, (0, 2.8, 3.2)), (I, (0, 6.0, -10), ">"), (I + 2, (0, 5.6, -11.5)), (I + 6, (0, 5.9, -10)), (I + 9, (0, 5.8, -10.6)),
                           (I + 16, (0, 0.4, 0.6)), (I + 21, (0, 0, -0.1)), (I + 25, (0, 0, 0)))},
         "jaw-l": {"rot": T((0, (0, 0, 0)), (8, (0, -34, 0)), (11, (0, -40, 0)), (I, (0, 2, 0), ">"), (I + 4, (0, 2, 0)), (I + 7, (0, -28, 0)), (I + 10, (0, 2, 0), ">"), (I + 22, (0, 0, 0)))},
         "jaw-r": {"rot": T((0, (0, 0, 0)), (9, (0, 30, 0)), (12, (0, 37, 0)), (I, (0, -3, 0), ">"), (I + 5, (0, -3, 0)), (I + 8, (0, 24, 0)), (I + 11, (0, -2, 0), ">"), (I + 23, (0, 0, 0)))},
         "arm-l": {"rot": T((0, (0, 0, 0)), (8, (16, 22, 0)), (11, (18, 26, 0)), (I, (12, 44, 0), ">"), (I + 2, (11, 48, 0)), (I + 8, (12, 40, 0)), (I + 16, (2, -2, 0)), (I + 22, (0, 0, 0)))},
         "arm-r": {"rot": T((0, (0, 0, 0)), (9, (13, -20, 0)), (12, (15, -24, 0)), (I, (14, -40, 0), ">"), (I + 2, (12, -45, 0)), (I + 9, (14, -36, 0)), (I + 17, (2, 3, 0)), (I + 23, (0, 0, 0)))},
         "sting": {"rot": T((0, (0, 0, 0)), (11, (24, 0, 0)), (I, (0, 0, 0), ">"), (I + 2, (-10, 0, 0)), (I + 6, (-2, 0, 0)), (I + 10, (-6, 0, 0)), (I + 18, (3, 0, 0)), (I + 24, (0, 0, 0)))}}
    for j in range(5):
        c, t, o = cock[j], throw[j], over[j]
        lag = j // 2  # the outer tail trails the base by up to two frames on the way back
        k[f"tail-{j + 1}"] = {"rot": T((0, (0, 0, 0)), (8, (c, 0, 0)), (11, (c * 1.12, 0, 0)), (I, (t, 0, 0), ">"), (I + 2, (o, 0, 0)), (I + 6, (t * 0.92, 0, 0)), (I + 10, (t * 0.98, 0, 0)),
                                        (I + 17 + lag, (-c * 0.1, 0, 0)), (I + 23 + lag, (0, 0, 0)))}
    for name in HIPS:
        k[name] = {"rot": T((0, (0, 0, 0)), (I + 28, (0, 0, 0)))}
    attack = B.bake(k, I + 28)
    attack["body"]["loc"] = [(t, (v[0], v[1] - IDLE_DROP, v[2])) for t, v in attack["body"]["loc"]]

    def steps(name):  # the legs step forward into the lunge and back home after it, in two alternating sets
        b = (int(name[5]) + (name[4] == "r")) % 2  # set A: l0 r1 l2 r3, set B: r0 l1 r2 l3
        return [(5 + 3 * b, 8 + 3 * b, -7.0), (I + 9 + 3 * b, I + 12 + 3 * b, 7.0)]
    _plant_legs(root, attack, range(0, I + 29), steps=steps)
    # hit: shoved back and up off its feet on frame 0-1 (lands f8), the
    # claws fling open, the tail ripples back a segment at a time; it
    # drifts back through the beat, then rocks forward past rest and
    # settles. The leg tips come down exactly where they stood and stay
    # pinned there (the legs swing under the body).
    hk = {"body": B.react_body(push=3.2, pop=0.0, lean=-5, side=0.6),
          "arm-l": {"rot": B.react_lag((-10, 16, 0), delay=0)}, "arm-r": {"rot": B.react_lag((-8, -13, 0), delay=1)},
          "jaw-l": {"rot": B.react_lag((0, -28, 0), delay=1)}, "jaw-r": {"rot": B.react_lag((0, 24, 0), delay=2)},
          "sting": {"rot": B.react_lag((-16, 0, 0), delay=5)}}
    for j in range(5):
        hk[f"tail-{j + 1}"] = {"rot": B.react_lag((8, 0, 4), delay=1 + j)}
    for name in HIPS:
        hk[name] = {"rot": T((0, (0, 0, 0)), (36, (0, 0, 0)))}
    hit = B.bake(hk, 36)
    pop = B.arc(0, 8, 1.6)
    bl = hit["body"]["loc"]
    hit["body"]["loc"] = [(t, (v[0], v[1] + pop(i) - IDLE_DROP, v[2])) for i, (t, v) in enumerate(bl)]
    # the tips hang under the body through the pop and come down exactly
    # where they stood, then stay pinned there while it drifts and recovers
    _plant_legs(root, hit, range(0, 37), lift=pop)
    return B.fill(root, attack), I, B.fill(root, hit)


def _death(root):
    """Baked death (see _big_falls): (keys, impact frame).

    It rears up with the pincers raised and the tail drawn up tight
    (f0-10); then the legs give: the body drops with gravity, faster and
    faster, the legs splaying out flat as it goes (their tips stay on the
    floor), and the belly slams flat (impact f18, squashed). One small
    bounce and a hard stop; the pincers crash down a beat later and the
    claws fall open, then the heavy tail comes down last, a segment at a
    time, slapping out flat along the floor behind it, and one leg
    twitches."""
    I = 18
    drop = -9.8
    rear = T((0, (0, 0, 0)), (10, (0, 5.5, 1)), (12, (0, 5.0, 0.9)))
    d = {"body": {"loc": B.Fall(rear, 10, I, (0, drop, 0), T((I, (0, drop, 0)), (I + 2, (0, drop + 1.0, 0)), (I + 4, (0, drop, 0), "0"), (60, (0, drop, 0))), power=2.2),
                  "rot": T((0, (0, 0, 0)), (10, (4, 0, -2)), (13, (3.5, 0, -1)), (I, (-2, 0, 2), ">"), (I + 3, (1, 0, 1)), (I + 7, (-0.5, 0, 1.5)), (I + 11, (0, 0, 1.5)), (60, (0, 0, 1.5))),
                  "scale": T((0, (1, 1, 1)), (10, (0.99, 1.03, 0.99)), (I - 1, (0.99, 1.02, 1)), (I, (1.06, 0.88, 1.04), ">"), (I + 3, (0.98, 1.04, 0.99)), (I + 7, (1.01, 0.99, 1)), (I + 11, (1, 1, 1)),
                            (I + 20, (1.01, 1.03, 1.01)), (I + 30, (1, 0.98, 1)), (60, (1, 0.985, 1)))},  # a last shuddering breath
         "sting": {"rot": T((0, (0, 0, 0)), (10, (-20, 0, 0)), (I, (-6, 0, 0)), (I + 9, STING_LIE, ">"), (I + 12, (STING_LIE[0] + 8, 0, STING_LIE[2])), (I + 15, STING_LIE), (I + 30, STING_LIE),
                            (I + 34, (STING_LIE[0] - 16, 0, STING_LIE[2] + 4)), (I + 39, STING_LIE), (60, STING_LIE))}}  # the sting twitches once
    # the tail: drawn up tight as it rears; as the body drops it keels over
    # sideways (rolling about the body's long axis, so it only ever comes
    # down, never up into a pole), and slaps flat onto the floor to the
    # left, the base first and each segment a frame after the one before,
    # each arriving fast, curving back along the floor behind the body.
    curl = (-10, -6, -8, -6, -4)
    for k in range(5):
        c, v = curl[k], TAIL_LIE[k]
        if k == 0:
            keys_ = [(0, (0, 0, 0)), (10, (c, 0, 0)), (12, (c, 0, 4)), (I, (-4, 0, 56)), (I + 3, v, ">"), (I + 5, (v[0], 0, v[2] - 5)), (I + 8, v), (60, v)]
        else:
            at = I + 3 + k
            keys_ = [(0, (0, 0, 0)), (10, (c, 0, 0)), (12, (c - 4, 0, 0)), (I, (c * 0.5, 0, 0)), (I + 2, (c * 0.5, 0, 0)), (at, v, ">"), (at + 2, (v[0] - 4, 0, v[2])), (at + 5, v), (60, v)]
        d[f"tail-{k + 1}"] = {"rot": T(*keys_)}
    for name, s in (("arm-l", -1), ("arm-r", 1)):
        d[name] = {"rot": T((0, (0, 0, 0)), (10, (30, s * 8, 0)), (I, (24, s * 4, 0)), (I + 3, (12, -s * 6, 0), ">"), (I + 6, (17, -s * 5, 0)), (I + 9, (12, -s * 6, 0)), (60, (12, -s * 6, 0)))}
        d[f"jaw-{name[-1]}"] = {"rot": T((0, (0, 0, 0)), (10, (0, -s * 20, 0)), (I + 3, (0, -s * 6, 0)), (I + 6, (0, s * 26, 0)), (I + 10, (0, s * 16, 0)), (I + 14, (0, s * 19, 0)), (60, (0, s * 19, 0)))}
    for name in HIPS:
        d[name] = {"rot": T((0, (0, 0, 0)), (60, (0, 0, 0)))}
    death = B.bake(d, 60)
    # the belly lands on the floor (the squash and the hop keyed off it);
    # the loose parts are keyed to rest on it, not under it
    B.ground(root, death, "body", height=B.arc(I, I + 4, 1.0), frames=range(I, 61), skip=tuple(HIPS) + ("arm-l", "arm-r", "jaw-l", "jaw-r", "sting") + tuple(f"tail-{k}" for k in range(1, 6)))
    # the legs splay: each leg's tip stays on the floor as the body drops
    # onto them, so they spread out flat; afterwards they relax onto the
    # floor, and one twitches
    for name in HIPS:
        for f in range(0, 61):  # from the idle's stance height down onto the floor by the rear
            B.reach(root, death, name, "z", [f], height=(0.2 - IDLE_DROP) * max(0.0, 1 - f / 10), fade_in=0, fade_out=0, span=80)
        # ...and each leg folds over about its hip-to-tip line (the tip
        # does not move), so the high knee drops out flat to the floor: the
        # front legs fold forward, the back legs back
        sg = -1 if name[4] == "l" else 1
        k = int(name[5])
        hx, hy, hz = HIPS[name]
        axis = np.array([sg * (10.0 + k * 1.5 + 6.0), 1.6 - hy, (k - 1.5) * 5.0])
        fold = (-1 if k < 2 else 1) * sg * (78 + 4 * abs(k - 1.5))
        fk = B.Fall(T((0, (0, 0, 0)), (12, (0, 0, 0)), (13, (0.02, 0, 0))), 12, I, (1.0, 0, 0),
                    T((I, (1.0, 0, 0)), (I + 3, (1.08, 0, 0)), (I + 7, (0.98, 0, 0)), (I + 10, (1.0, 0, 0)), (60, (1.0, 0, 0))), power=2.0)
        rot = death[name]["rot"]
        for f in range(len(rot)):
            M = B.euler(rot[f][1]) @ B.axis_angle(axis, fold * float(fk(f)[0]))
            rot[f] = (rot[f][0], B.to_euler(M))
        # the folded knee must not dip under the floor: lift it on the splay
        for f in range(0, 61):  # from the idle's stance height down onto the floor by the rear
            B.reach(root, death, name, "z", [f], height=(0.2 - IDLE_DROP) * max(0.0, 1 - f / 10), fade_in=0, fade_out=0, span=30)
    tw = death["leg-l1"]["rot"]
    for f in range(40, 50):
        u = (f - 40) / 9
        a, b_, c = tw[f][1]
        tw[f] = (tw[f][0], (a, b_, c - 14 * math.sin(math.pi * u) ** 2))  # lifts off the floor and drops back
    return B.fill(root, death), I


def _build():
    rig = Rig("giant-scorpion", (CX, 0, 52))
    rig.add("body", body(), (CX, 10.0, 48.0))
    for name in SHOULDER:
        rig.add(name, arm(name), SHOULDER[name], parent="body")
        rig.add(f"jaw-{name[-1]}", jaw(name), HAND[name], parent=name)
    for name in HIPS:
        rig.add(name, leg(name), HIPS[name], parent="body")
    for k in range(5):
        rig.add(f"tail-{k + 1}", tail(k), TAIL[k], parent="body" if k == 0 else f"tail-{k}")
    rig.add("sting", sting(), TAIL[-1], parent="tail-5")

    def legs(seconds: float, amp: float, lift: float = 0.0):
        """Alternating leg swing: the two sides step out of phase."""
        out = {}
        for name in HIPS:
            k = int(name[5])
            ph = ((k % 2) * 0.5 + (0.25 if name[4] == "r" else 0.0)) % 1.0
            out[name] = {"rot": wave(seconds, (lift, amp, 0.0), phase=ph)}
        return out

    idle = {"body": {"loc": wave(2.4, (0, 0.5, 0), double=True)},
            "arm-l": {"rot": wave(2.4, (0, 4, 0))}, "arm-r": {"rot": wave(2.4, (0, -4, 0), phase=0.4)},
            "jaw-l": {"rot": wave(1.2, (0, -11, 0))}, "jaw-r": {"rot": wave(1.2, (0, 11, 0), phase=0.5)}}
    for k in range(5):
        idle[f"tail-{k + 1}"] = {"rot": wave(2.4, (2.5, 0, 1.5), phase=k * 0.12)}
    idle.update(legs(2.4, 2.5))

    mv = 0.7
    move = {"body": {"loc": wave(mv, (0, 1.2, 0), double=True), "rot": wave(mv, (0, 0, 2.5))},
            "arm-l": {"rot": wave(mv, (0, 7, 0))}, "arm-r": {"rot": wave(mv, (0, -7, 0), phase=0.5)}}
    for k in range(5):
        move[f"tail-{k + 1}"] = {"rot": wave(mv, (3.0, 0, 0), phase=k * 0.1)}
    move.update(legs(mv, 16.0, lift=7.0))

    attack, imp, hit = _attack_hit(rig.root)
    death, dimp = _death(rig.root)
    return make("creatures", "giant-scorpion", "Irradiated Giant Scorpion", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=imp * B.F, ease=0),
                       Clip("hit", hit, loop=False, ease=0), Clip("death", death, loop=False, impact=dimp * B.F, ease=0)],
                sockets=[rig.socket("socket-sting", TIP, parent="sting"),
                         rig.socket("socket-feet", (CX, 1.0, 52.0)),
                         rig.socket("socket-jaw", (HAND["arm-r"][0] + 6, 15.0, 2.0), parent="jaw-r")],
                pfx=[fx("rvx-apocalypse-toxic-bubbles", "socket-sting", "idle", size=14),
                     fx("rvx-apocalypse-dust-kick", "socket-feet", "clip:move", size=44, aim=(0.0, 0.0, 1.0)),
                     fx("rvx-apocalypse-gore-burst", "socket-sting", "clip:attack", size=36, at=imp * B.F)])


def build():
    return _build()
