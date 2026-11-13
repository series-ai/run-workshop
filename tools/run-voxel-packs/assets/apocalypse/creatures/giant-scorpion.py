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
hit, death. Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
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

    curl = ((0.0, 0), (0.25, -26), (0.45, 58), (0.6, 44), (1.1, 0))
    attack = {"body": {"rot": seq((0, 0, 0, 0), (0.25, -8, 0, 0), (0.45, 10, 0, 0), (1.1, 0, 0, 0)),
                       "loc": seq((0, 0, 0, 0), (0.45, 0, 0, -3), (1.1, 0, 0, 0))},
              "jaw-l": {"rot": seq((0, 0, 0, 0), (0.2, 0, -34, 0), (0.4, 0, 2, 0), (0.7, 0, -28, 0), (1.1, 0, 0, 0))},
              "jaw-r": {"rot": seq((0, 0, 0, 0), (0.2, 0, 34, 0), (0.4, 0, -2, 0), (0.7, 0, 28, 0), (1.1, 0, 0, 0))}}
    for k in range(5):
        attack[f"tail-{k + 1}"] = {"rot": [(t, (v * (0.8 + k * 0.12), 0.0, 0.0)) for t, v in curl]}
    attack["sting"] = {"rot": seq((0, 0, 0, 0), (0.45, 22, 0, 0), (1.1, 0, 0, 0))}

    hit = {"body": {"rot": seq((0, 0, 0, 0), (0.1, -12, 0, 7), (0.45, 0, 0, 0)),
                    "loc": seq((0, 0, 0, 0), (0.1, 0, 0, 3), (0.45, 0, 0, 0))},
           "tail-1": {"rot": seq((0, 0, 0, 0), (0.12, -16, 0, 0), (0.45, 0, 0, 0))}}
    death = {rig.root.name: {"rot": seq((0, 0, 0, 0), (0.3, 0, 0, -9), (0.8, 0, 0, 62), (1.0, 0, 0, 56), (1.3, 0, 0, 60)),
                             "loc": seq((0, 0, 0, 0), (0.8, 0, 2, 0), (1.3, 0, 2, 0))},
             "sting": {"rot": seq((0, 0, 0, 0), (0.8, -30, 0, 0), (1.3, -34, 0, 0))}}
    for k in range(5):
        death[f"tail-{k + 1}"] = {"rot": seq((0, 0, 0, 0), (0.8, -14, 0, 0), (1.3, -16, 0, 0))}
    for name in HIPS:
        death[name] = {"rot": seq((0, 0, 0, 0), (0.6, 0, 34 if name[4] == "l" else -34, 0), (1.3, 0, 30 if name[4] == "l" else -30, 0))}

    return make("creatures", "giant-scorpion", "Irradiated Giant Scorpion", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False),
                       Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-sting", TIP, parent="sting"),
                         rig.socket("socket-feet", (CX, 1.0, 52.0)),
                         rig.socket("socket-jaw", (HAND["arm-r"][0] + 6, 15.0, 2.0), parent="jaw-r")],
                pfx=[fx("rvx-apocalypse-toxic-bubbles", "socket-sting", "idle", size=14),
                     fx("rvx-apocalypse-dust-kick", "socket-feet", "clip:move", size=44, aim=(0.0, 0.0, 1.0)),
                     fx("rvx-apocalypse-gore-burst", "socket-sting", "clip:attack", size=36, at=0.45)])


def build():
    from _death_ground import ground_death
    return ground_death(_build())
