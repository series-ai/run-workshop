"""Zombie ghoul, in the Pirate Nation creature style.

A chunky caricature in the family of the werewolf and PN Kevin (the
zombie world boss): a huge lolling head (a third of the height) with one
bulging pale eye and one glowing toxic socket, a hanging jaw full of crooked
teeth, a stitched scar and a cracked skull cap that shows the brain; a hunched torso in a torn rust shirt
with bone ribs showing; long reaching arms with oversized clawed hands;
short legs in patched purple trousers and bare clawed feet. Limbs, head and
body are true-slope prisms; skin, cloth and wounds are painted. Clips:
idle (shamble sway), attack (grab), hit, death (collapse). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes
import pnpaint
from _fall import fall_back, hit_back
from _gait_loops import cyc, per_frame, pulse, shift
from _kit import keys, pfx, world
from _life import assemble, chunk, claw, coords, limb, side
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

Z3 = (0.0, 0.0, 0.0)


def fr(n: float) -> float:
    """Seconds of frame `n` at 30 fps (impact keys sit on whole frames)."""
    return n / 30.0

S = (40, 46, 36)
CX = 20
SKIN, SHIRT, PANTS = "teal", "rust", "purple"
HIP = (CX, 15.0, 24.0)
WAIST = (CX, 17.0, 24.0)
NECK = (CX, 29.0, 18.0)
SHOULDER = {"arm-l": (CX - 10.0, 28.0, 22.0), "arm-r": (CX + 10.0, 28.0, 22.0)}
KNEE = {"leg-l": (CX - 4.5, 15.0, 24.0), "leg-r": (CX + 4.5, 15.0, 24.0)}


def skin(g: Grid, m: np.ndarray, seed: int) -> None:
    """Zombie hide: soft teal mottling with darker rot blotches (S3)."""
    P.mottle(g, m, SKIN, 5, cell=3, seed=seed)
    pnpaint.blotch(g, m, SKIN, 3, cell=2, chance=0.05, seed=seed + 1)


def leg(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x0, x1 = CX + s * 4.5 - 2.5, CX + s * 4.5 + 2.5
    thigh = limb(g, "x", (15, 24), (8, 22.5), 3.0, 2.7, x0, x1, PANTS, 4, cap=0.4)
    shin = limb(g, "x", (8.5, 22.5), (2.5, 24), 2.5, 2.3, x0 + 0.5, x1 - 0.5, SKIN, 5, cap=0.4)
    foot = box(g, x0 - 0.5, 0, 19, x1 + 0.5, 3, 27, SKIN, 5)
    skin(g, shin | foot, seed=20 + s)
    P.mottle(g, thigh, PANTS, 4, cell=3, seed=22 + s)
    # a ragged hem: skin shows through a zigzag, and a magenta patch on one knee
    P.flat(g, thigh & (Y < 10) & (((X + Z) % 3) == 0), SKIN, 4)
    if s < 0:
        P.flat(g, thigh & (Y >= 10) & (Y < 13) & (Z < 22), "magenta", 4)
    for k in range(3):  # toe claws
        cxk = x0 + 0.5 + k * 2
        claw(g, "x", (1.5, 19.5), (0.3, 16.8), 1.2, cxk, cxk + 1.2, "bone", 6)
    return g


def hips() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = side(g, [(12, 19), (12, 29), (18, 29), (18, 19)], CX - 8, CX + 8, PANTS, 4)
    P.mottle(g, m, PANTS, 4, cell=3, seed=3)
    rope = m & (Y >= 16)
    P.flat(g, rope, "sand", 5)
    P.flat(g, rope & ((X + Y) % 3 == 0), "sand", 3)  # twisted rope
    P.flat(g, m & (Y < 15) & (np.abs(X + 0.5 - CX) < 0.8) & (Z < 21), PANTS, 2)  # fly seam
    return g


def torso() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    body = side(g, [(16, 18), (16, 30), (23, 31.5), (29, 29.5), (31, 23), (29, 16), (23, 16.5)], CX - 8, CX + 8, SHIRT, 5)
    yoke = side(g, [(24, 17), (24, 29), (31, 27), (31.5, 18)], CX - 10.5, CX + 10.5, SHIRT, 5)
    hump = side(g, [(25, 26), (30.5, 29.5), (31, 24)], CX - 5, CX + 5, SKIN, 5)
    m = body | yoke
    P.mottle(g, m, SHIRT, 5, cell=3, seed=5)
    P.flat(g, m & (Y < 17.5), SHIRT, 3)  # tattered hem shadow
    P.flat(g, m & (Y < 18.5) & ((X % 4) == 1), SKIN, 4)
    skin(g, hump, seed=6)
    # a torn hole across the chest shows dark hide and bone ribs (S1: paint)
    hole = m & (Z < 20) & (np.abs(X + 0.5 - (CX - 2)) < 5) & (Y >= 19) & (Y < 27)
    P.flat(g, hole, SKIN, 2)
    P.flat(g, hole & (Y % 2 == 0) & (np.abs(X + 0.5 - (CX - 2)) < 4) & (np.abs(X + 0.5 - CX) > 0.6), "bone", 6)
    P.flat(g, hole & (np.abs(X + 0.5 - CX) < 0.8), "bone", 5)  # breastbone
    P.flat(g, m & (Z < 20) & (Y >= 21) & (Y < 25) & (X >= CX + 3) & (X < CX + 7), "blood", 4)  # wound
    P.flat(g, m & (Z < 20) & (Y >= 22) & (Y < 24) & (X >= CX + 4) & (X < CX + 6), "red", 5)
    # buttons and a patch
    for by in (18, 20):
        P.flat(g, m & (Z < 19) & (X == CX + 1) & (Y == by), "bone", 6)
    P.flat(g, m & (Z > 29) & (Y >= 20) & (Y < 24) & (X >= CX - 5) & (X < CX), "purple", 5)
    return g


def head() -> Grid:
    """Kevin-sized caricature head: a big chamfered block lolling forward,
    a hanging jaw, mismatched eyes and a cracked cap showing the brain."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    skull = chunk(g, CX, 17, 30, 42, 8, 7.5, 2.5, SKIN, 5, taper=1.2, lean=(0.6, 0.4))
    jaw = side(g, [(27.5, 11), (27.5, 20), (31, 21), (31, 11.5)], CX - 6, CX + 6, SKIN, 4)
    ear = box(g, CX + 7, 34, 16, CX + 9.5, 38, 19, SKIN, 5)
    skin(g, skull | ear, seed=7)
    P.mottle(g, jaw, SKIN, 4, cell=2, seed=8)
    face_z = 9.5
    # mouth: a dark red gape with crooked bone teeth (paint on the jaw front)
    mouth = jaw & (Z < 12.5) & (Y >= 28) & (Y < 31) & (np.abs(X + 0.5 - CX) < 5)
    P.flat(g, mouth, "blood", 2)
    P.flat(g, mouth & (Y >= 30) & (X % 2 == 0), "bone", 6)
    P.flat(g, mouth & (Y < 29) & (X % 3 == 1), "bone", 5)
    P.flat(g, skull & (Z < 11) & (Y >= 31) & (Y < 32) & (np.abs(X + 0.5 - CX) < 5.5) & (X % 2 == 1), "bone", 7)  # upper teeth
    # eyes: a bulging pale left eye with a tiny pupil, a glowing toxic right socket
    eye = {"k": C(SKIN, 2), "w": C("bone", 7), "e": C("bone", 5), "p": C("gray", 1), "g": C("toxic", 6), "G": C("toxic", 7)}
    rows = [
        ".kkkkk...kkkkk.",
        "kwwwwwk.kgggggk",
        "kwwwwwk.kgGGggk",
        "kwwppwk.kgGGggk",
        "kwwppwk.kgggggk",
        "kewwwek..kkkkk.",
        ".kkkkk.........",
    ]
    pnglyph.stamp(g, "-z", face_z, CX - 7, 33, rows, eye, depth=2, reach=3)
    # a stitched scar over the right brow and a nose hole
    scar = skull & (Z < 12) & (Y == 40) & (X >= CX + 1) & (X < CX + 7)
    P.flat(g, scar, SKIN, 2)
    P.flat(g, skull & (Z < 12) & (Y == 41) & (X >= CX + 2) & (X < CX + 7) & (X % 2 == 0), SKIN, 2)
    P.flat(g, skull & (Z < 12) & (Y >= 32) & (Y < 33) & (np.abs(X + 0.5 - CX) < 1.2), SKIN, 2)
    # sunlit crown
    P.flat(g, skull & (Y >= 41), SKIN, 6)
    # the PN zombie mark: a cracked skull cap with the brain showing (C3)
    brain = skull & (Y >= 41) & (np.abs(X + 0.5 - (CX - 2)) < 3.6) & (np.abs(Z + 0.5 - 16) < 3.2 + (X % 2))
    P.flat(g, brain, "magenta", 6)
    P.flat(g, brain & (((X + 2 * Z) % 5) == 0), "magenta", 4)
    P.outline(g, brain, SKIN, 3, normal="y")
    return g


def arm(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + s * 10
    x0, x1 = sx - 2.5, sx + 2.5
    sleeve = limb(g, "x", (29, 22), (22, 15), 3.2, 2.8, x0 - 0.5, x1 + 0.5, SHIRT, 5, cap=0.4)
    fore = limb(g, "x", (22.5, 15.5), (21, 6), 2.4, 2.2, x0, x1, SKIN, 5, cap=0.4)
    hand = box(g, sx - 3, 16, 1, sx + 3, 22, 7, SKIN, 5)
    skin(g, fore | hand, seed=11 + s)
    P.mottle(g, sleeve, SHIRT, 5, cell=3, seed=13 + s)
    P.flat(g, sleeve & (Y < 21) & ((Y + Z) % 3 == 0), SKIN, 4)  # torn cuff
    P.flat(g, hand & (Y < 17), SKIN, 4)
    for k in range(4):  # four long hooked claws, down and forward
        cxk = sx - 3 + k * 1.5
        claw(g, "x", (17, 2.5), (12.2, 0.4), 1.3, cxk, cxk + 1.2, "bone", 6)
    return g


def _move() -> dict:
    """Move: a shambling zombie walk, 36 frames (1.2 s), two steps.

    The legs are rigid (one part each, pivoting at the hip), so each stance
    foot is solved every frame: the heel strikes, rolls flat, then the toe
    claws carry it to toe-off, and whichever sole point is on the floor
    slides back at a steady ground speed (D voxels over the stance). The
    hips drop into every footfall; a leg's loc y lifts it into the hips by
    whatever its pose needs (the trailing toe would otherwise vault the
    body). The swing leg leaves and lands at ground speed, lifted clear.
    Upper body: lurches over the new stance foot, a nod and drop on each
    footfall, the arms reach out front swinging a little, the head lolls a
    few frames behind."""
    import math
    T, ST = 36, 20  # loop frames; stance frames per foot (2 of double support each side)
    SW = T - ST
    D = 10.0  # stance travel, voxels
    LIFT = 3.0
    corners = ((-15.0, -5.0), (-15.0, 3.0), (-14.7, -7.2))  # (y, z) from the hip: sole front, heel, toe claw tip

    def pt(c, th):
        a = math.radians(th)
        return (c[0] * math.cos(a) - c[1] * math.sin(a), c[0] * math.sin(a) + c[1] * math.cos(a))

    def lowest(th):
        ps = [pt(c, th) for c in corners]
        i = min(range(len(ps)), key=lambda k: ps[k][0])
        return i, ps[i]

    # stance: start at the heel strike and slide the contact point back
    th = 0.0
    for _ in range(60):  # heel at z = 3 - D/2
        z = pt(corners[1], th)[1]
        dz = (pt(corners[1], th + 1e-3)[1] - z) / 1e-3
        th -= (z - (3.0 - D / 2)) / dz
    c, target = 1, 3.0 - D / 2
    sth, sh = [th], [-15.0 - lowest(th)[1][0]]
    n = 16
    for f in range(1, ST + 1):
        for _ in range(n):
            target += D / ST / n
            for _ in range(20):
                z = pt(corners[c], th)[1]
                dz = (pt(corners[c], th + 1e-3)[1] - z) / 1e-3
                th -= (z - target) / dz
            i, p = lowest(th)
            if i != c and p[0] < pt(corners[c], th)[0] - 1e-9:
                c, target = i, p[1]
        sth.append(th)
        sh.append(-15.0 - lowest(th)[1][0])
    m0 = (sth[-1] - sth[-2]) * SW  # leg speed at toe-off / strike, per unit of swing
    m1 = (sth[1] - sth[0]) * SW

    def leg(p):
        """(angle, needed root height or None, swing w or None) at phase p."""
        if p <= ST:
            return sth[p], sh[p], None
        w = (p - ST) / SW
        h00, h10, h01, h11 = 2 * w ** 3 - 3 * w ** 2 + 1, w ** 3 - 2 * w ** 2 + w, -2 * w ** 3 + 3 * w ** 2, w ** 3 - w ** 2
        return h00 * sth[-1] + h10 * m0 + h01 * sth[0] + h11 * m1, None, w

    half = T // 2
    drop = {0: -0.5, 1: -1.0, 2: -0.7, 3: -0.3, 4: -0.1}
    phase = {"leg-l": 0, "leg-r": half}
    hips = {}
    for f in range(T + 1):
        need = [leg((f - o) % T)[1] for o in phase.values()]
        hips[f] = min(h for h in need if h is not None) + pulse(f % half, drop)
    for s0 in (half, T):  # fall into each footfall over the last K frames, accelerating
        K = 5
        h0, h1 = hips[s0 - K], hips[s0 % T]
        for k in range(1, K):
            hips[s0 - K + k] = min(hips[s0 - K + k], h0 + (h1 - h0) * (k / K) ** 2)
    hips[T] = hips[0]
    out = {name: {"rot": [], "loc": []} for name in phase}
    for name, off in phase.items():
        for f in range(T + 1):
            p = (f - off) % T
            a, h, w = leg(p)
            if w is None:
                ly = h - hips[f]
            else:  # blend the lift-in from toe-off to strike, plus the swing lift
                f0, f1 = (off + ST) % T, off % T
                y0 = sh[-1] - hips[f0]
                y1 = sh[0] - hips[f1]
                ly = y0 + (y1 - y0) * w + LIFT * 16 * w * w * (1 - w) ** 2
            out[name]["rot"].append((f / 30.0, (a, 0.0, 0.0)))
            out[name]["loc"].append((f / 30.0, (0.0, ly, 0.0)))
    # the whole loop (frame T == frame 0) is periodic by construction
    out["hips"] = {"loc": [(f / 30.0, (0.0, hips[f], 0.0)) for f in range(T + 1)]}
    # lean over the stance foot: +z rolls the top toward -x (the left leg)
    roll = lambda f: cyc(f, T, [(0, 0.0), (4, 5.0), (half - 2, 3.5), (half, 0.0), (half + 4, -5.0), (T - 2, -3.5)])  # noqa: E731
    out["torso"] = {"rot": per_frame(T, lambda f: (-4.0 + pulse(f % half, {1: -3.0, 2: -4.0, 3: -2.5, 4: -1.0}),
                                                   cyc(f, T, [(0, -6.0), (half, 6.0)]), roll(f))),
                    "loc": per_frame(T, lambda f: (0.0, pulse(f % half, {1: -0.3, 2: -0.6, 3: -0.4, 4: -0.15}), 0.0))}
    out["head"] = {"rot": per_frame(T, lambda f: (pulse(f % half, {2: -5.0, 3: -8.0, 4: -6.0, 5: -3.0, 6: -1.0}),
                                                  cyc(f, T, [(0, 5.0), (half, -5.0)]), -1.8 * roll(f - 3)))}
    out["arm-l"] = {"rot": per_frame(T, lambda f: (36.0 + cyc(f - 2, T, [(0, -7.0), (half, 7.0)]) + pulse(f % half, {2: -5.0, 3: -7.0, 4: -4.0, 5: -1.5}), 0.0, -6.0))}
    out["arm-r"] = {"rot": per_frame(T, lambda f: (40.0 + cyc(f - 2, T, [(0, 7.0), (half, -7.0)]) + pulse(f % half, {2: -5.0, 3: -7.0, 4: -4.0, 5: -1.5}), 0.0, 6.0))}
    return out


def build():
    parts = {"hips": hips(), "torso": torso(), "head": head(), "arm-l": arm(-1), "arm-r": arm(1), "leg-l": leg(-1), "leg-r": leg(1)}
    root = assemble(parts, [
        ("hips", None, HIP),
        ("leg-l", "hips", KNEE["leg-l"]),
        ("leg-r", "hips", KNEE["leg-r"]),
        ("torso", "hips", WAIST),
        ("head", "torso", NECK),
        ("arm-l", "torso", SHOULDER["arm-l"]),
        ("arm-r", "torso", SHOULDER["arm-r"]),
    ])
    idle = {"torso": {"rot": keys((0, (6, 0, -5)), (1.1, (6, 0, 5)), (2.2, (6, 0, -5)))},
            "head": {"rot": keys((0, (0, 0, 14)), (1.1, (8, 0, -10)), (2.2, (0, 0, 14)))},
            "arm-l": {"rot": keys((0, (-10, 0, 0)), (1.1, (6, 0, 0)), (2.2, (-10, 0, 0)))},
            "arm-r": {"rot": keys((0, (6, 0, 0)), (1.1, (-10, 0, 0)), (2.2, (6, 0, 0)))},
            "leg-l": {"rot": keys((0, (-10, 0, 0)), (1.1, (10, 0, 0)), (2.2, (-10, 0, 0)))},
            "leg-r": {"rot": keys((0, (10, 0, 0)), (1.1, (-10, 0, 0)), (2.2, (10, 0, 0)))}}
    # Attack, an overhead claw smash: it sinks back on its heels, twists away
    # and cocks the right arm behind its head (frames 0-14), steps in with the
    # right foot and drives the claw down in 4 frames to the blow on frame 18,
    # sags past it, holds, and recovers by frame 42; the head and the free
    # arm settle last. The left foot stays planted (the leg counter-swings).
    attack = {"hips": {"loc": keys((0, Z3), (fr(14), (0, -0.1, 1.5)), (fr(18), (0, 0.8, -3)), (fr(21), (0, 0.8, -4.5)),
                                   (fr(24), (0, 0.6, -5.4)), (fr(30), (0, 0.1, 0.6)), (fr(34), Z3))},
              "leg-l": {"rot": keys((0, Z3), (fr(14), (5.7, 0, 0)), (fr(18), (-11.5, 0, 0)), (fr(21), (-17.5, 0, 0)),
                                    (fr(24), (-21, 0, 0)), (fr(30), (2.3, 0, 0)), (fr(34), Z3))},
              "leg-r": {"rot": keys((0, Z3), (fr(14), (5.7, 0, 0)), (fr(16), (18, 0, 0)), (fr(18), (19.5, 0, 0)),
                                    (fr(21), (13.5, 0, 0)), (fr(24), (10.8, 0, 0)), (fr(26), (10.8, 0, 0)), (fr(31), (2, 0, 0)), (fr(34), Z3)),
                        "loc": keys((0, Z3), (fr(14), Z3), (fr(16), (0, 1.8, 0)), (fr(18), Z3), (fr(26), Z3), (fr(28), (0, 1.5, 0)), (fr(31), Z3))},
              "torso": {"rot": keys((0, Z3), (fr(14), (12, -26, -4)), (fr(18), (-22, 22, 6)), (fr(21), (-28, 27, 8)),
                                    (fr(24), (-33, 30, 9)), (fr(30), (5, -4, 0)), (fr(34), Z3))},
              "arm-r": {"rot": keys((0, Z3), (fr(8), (95, 0, 14)), (fr(14), (150, 0, 18)), (fr(18), (8, 0, 12)),
                                    (fr(21), (-12, 0, 16)), (fr(24), (-24, 0, 20)), (fr(30), (8, 0, -2)), (fr(34), Z3))},
              "arm-l": {"rot": keys((0, Z3), (fr(14), (30, 0, -14)), (fr(19), (12, 0, -20)), (fr(22), (4, 0, -22)),
                                    (fr(26), (14, 0, -12)), (fr(31), (-6, 0, 2)), (fr(34), Z3))},
              "head": {"rot": keys((0, Z3), (fr(14), (14, 18, 0)), (fr(19), (-10, -14, 4)), (fr(21), (-22, -20, 6)),
                                   (fr(24), (-16, -10, 2)), (fr(28), (6, 4, 0)), (fr(31), (-3, -1, 0)), (fr(34), Z3))}}
    # Hit: the blow on frame 3 shoves it back with a little pop up; it hangs
    # a beat, lands, sways forward past rest with its weight and settles; the
    # head snaps back and the loose parts trail. See _fall.hit_back.
    hit, hit_hit = hit_back("hips", foot=(-15, 2.5, -6.5), push=3.0, pop=1.4, tilt=14, head=("head", 24), arms={"arm-l": (30, -1), "arm-r": (34, 1)},
                            extra={"torso": lambda t: keys((0, Z3), (fr(4), (10, 8, 0)), (fr(9), (6, 4, 0)), (fr(t["O"]), (-5, 0, 0)), (fr(t["E"]), Z3))})
    # Death: it rocks forward over its toes, teeters back onto its heels with
    # the arms thrown up, catches itself for a beat, then falls over
    # backwards (away from the attacker), fastest at the floor on the impact
    # frame, thuds, bounces once and settles on its back; the arms, the legs
    # and the head land late. See _fall.py for the beats.
    death, death_hit = fall_back("hips", D=8.3, F=10.0, R=84.0, roll=5.0, torso="torso",
                                 legs={"leg-l": (-4, 0, -6), "leg-r": (-6, 0, 8)},
                                 arms={"arm-l": ((-68, 0, -40), -1), "arm-r": ((-75, 0, 45), 1)},
                                 head=("head", (55, 0, 15)), settle=-0.9)
    mouth = (0.0, 29.0 - HIP[1], 10.0 - HIP[2])
    return world("zombie-ghoul", "creatures", "Zombie Ghoul", root,
                 clips=[Clip("attack", attack, loop=False, impact=fr(18)), Clip("hit", hit, loop=False, impact=hit_hit), Clip("death", death, loop=False, impact=death_hit), Clip("idle", idle),
                        Clip("move", shift(_move(), 36, 8), ease=0)],
                 sockets=[Socket("socket-mouth", at=mouth, parent="head")],
                 pfx=[pfx("rvx-monster-rot-poof", "socket-mouth", "clip:death", size=32, at=0.2)])
