"""Werewolf, in the Pirate Nation creature style.

PN has no werewolf, so it follows the PN world bosses (Kevin, the giant
turtle) and totems: a chunky caricature. A big boxy head with a long
sloped muzzle, a hinged jaw with fangs, tall pointed ears and cheek tufts;
huge glowing eyes under an angry brow; a hunched barrel chest with a
spiked mane; long gorilla arms ending in oversized clawed hands with
broken shackles; short digitigrade legs in torn purple trousers; a bushy
tail. Limbs, muzzle, ears, mane and claws are true-slope prisms; the fur,
chest, face and cloth are painted. Clips: idle (breathe, sniff),
attack (lunging double swipe), hit, death. Faces -Z.
"""
import numpy as np

import paint as P
from _fall import fall_back, hit_back
from _gait_loops import cyc, hop_height, per_frame, shift
from _kit import keys, pfx, world
from _pn import assemble, coords, last, quad, stamp
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

Z3 = (0.0, 0.0, 0.0)


def fr(n: float) -> float:
    """Seconds of frame `n` at 30 fps (impact keys sit on whole frames)."""
    return n / 30.0

S = (52, 62, 48)
CX = 26
FUR, FUR_BASE = "skindark", 5
PALE, PANTS = "sand", "purple"
HIP = (CX, 20.0, 28.0)
WAIST = (CX, 25.0, 27.0)
NECK = (CX, 38.0, 18.0)
HINGE = (CX, 40.0, 10.0)
SHOULDER = {"arm-l": (CX - 15.0, 39.0, 24.0), "arm-r": (CX + 15.0, 39.0, 24.0)}


def side(g: Grid, pts_yz, x0, x1, ramp: str, shade: int) -> np.ndarray:
    """A prism across x from a side-view (y, z) polygon."""
    g.prism("x", pts_yz, x0, x1, C(ramp, shade))
    return last(g)


def front(g: Grid, pts_xy, z0, z1, ramp: str, shade: int) -> np.ndarray:
    """A prism along z from a front-view (x, y) polygon."""
    g.prism("z", pts_xy, z0, z1, C(ramp, shade))
    return last(g)


def fur(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, seed: int = 0) -> None:
    """Paint a soft hide base with short, grouped fur marks."""
    X, Y, Z = coords(g)
    P._paint(g, mask, ramp, base)
    # Two-voxel clumps break up the long stripes without adding face-wide noise.
    clump = P._hash((X + Z) // 2, (Y + ((X + Z) % 2)) // 2, seed=seed) % np.uint64(19)
    P._paint(g, mask & (clump == 0), ramp, base + 1)
    P._paint(g, mask & (clump == 1), ramp, base - 1)


def hips() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    pants = box(g, CX - 10, 16, 21, CX + 10, 26, 34, PANTS, 4)
    furm = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        x0, x1 = CX + s * 7 - 4, CX + s * 7 + 4
        pants |= side(g, quad((22, 28), (12, 22), 5.0, 4.2, cap=0.6), x0, x1, PANTS, 4)  # thigh
        furm |= side(g, quad((12, 22), (6, 29), 3.2, 2.6, cap=0.8), x0 + 1, x1 - 1, FUR, FUR_BASE)  # shin back to the hock
        furm |= side(g, quad((7, 29), (3, 24), 2.6, 2.4, cap=0.6), x0 + 1, x1 - 1, FUR, FUR_BASE)  # hock to paw
        paw = box(g, x0, 0, 17, x1, 5, 27, FUR, FUR_BASE - 1)
        furm |= paw
        for k in range(3):  # three big toe claws, hooked down (true slopes)
            cxk = x0 + 1.5 + k * 2.5
            side(g, [(4.5, 17.5), (1.5, 17.5), (0.2, 14.0)], cxk - 0.9, cxk + 0.9, "bone", 6)
    tail = side(g, quad((23, 34), (13, 44), 3.4, 2.4, cap=1.2), CX - 2.5, CX + 2.5, FUR, FUR_BASE)
    fur(g, furm | tail, FUR, FUR_BASE, seed=1)
    # A warm fur highlight marks the point without making a detached bone wedge.
    P.flat(g, tail & (Z >= 42), FUR, FUR_BASE + 1)
    P.mottle(g, pants, PANTS, 4, cell=3, seed=2)
    # torn hem (fur shows through a zigzag), a dark waistband, a magenta patch
    P.flat(g, pants & (Y < 15), FUR, FUR_BASE)
    P.flat(g, pants & (Y >= 15) & (Y < 17) & (((X + Z) % 4) < 2), FUR, FUR_BASE - 1)
    P.flat(g, pants & (Y >= 24), PANTS, 2)
    P.flat(g, pants & (Y >= 18) & (Y < 22) & (X >= CX - 12) & (X < CX - 8) & (Z < 26), "magenta", 4)
    return g


def torso() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    body = side(g, [(24, 34), (24, 20), (29, 15), (36, 13), (41, 15), (43, 21), (42, 30), (45, 36), (42, 41), (35, 43), (29, 39)], CX - 13, CX + 13, FUR, FUR_BASE)
    fur(g, body, FUR, FUR_BASE, seed=3)
    # a pale chest and belly with painted pecs and ribs (rule S1)
    chest = body & (Z < 21) & (np.abs(X + 0.5 - CX) < 9) & (Y < 40)
    fur(g, chest, PALE, 5, seed=5)
    P.flat(g, chest & (np.abs(X + 0.5 - CX) < 0.8) & (Y > 28), PALE, 3)
    P.flat(g, chest & (Y == 34) & (np.abs(X + 0.5 - CX) > 1.5), PALE, 3)
    P.flat(g, chest & ((Y == 27) | (Y == 30)) & (np.abs(X + 0.5 - CX) > 1.5) & (np.abs(X + 0.5 - CX) < 6), PALE, 4)
    return g


def head() -> Grid:
    """A big caricature head (Kevin-sized, rule K3): boxy skull, jutting
    brow, long sloped muzzle, tall ears and cheek tufts."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    skull_m = box(g, CX - 9, 38, 10, CX + 9, 53, 23, FUR, FUR_BASE)
    brow = box(g, CX - 10, 51, 9, CX + 10, 54, 13, FUR, FUR_BASE - 1)
    muzzle = side(g, [(48, 11), (46, 1.2), (44, 0.3), (40, 1), (40, 11)], CX - 3, CX + 3, PALE, 5)
    ears = np.zeros(g.shape, dtype=bool)
    tufts = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        ears |= front(g, [(CX + s * 9.5, 52), (CX + s * 2.5, 52), (CX + s * 9, 59.5)], 15, 19, FUR, FUR_BASE - 1)
        tufts |= front(g, [(CX + s * 8, 48), (CX + s * 13, 45), (CX + s * 10, 43.5), (CX + s * 13, 40), (CX + s * 8, 38.5)], 12, 21, PALE, 5)
    fur(g, skull_m, FUR, FUR_BASE, seed=6)
    fur(g, ears | brow, FUR, FUR_BASE - 1, seed=7)
    fur(g, tufts, PALE, 5, seed=8)
    P.flat(g, ears & (Z < 16) & (np.abs(np.abs(X + 0.5 - CX) - 6.5) < 1.6) & (Y > 53) & (Y < 58), "pink", 3)  # pink inner ear
    P.flat(g, skull_m & (Y < 44) & (Z < 15), PALE, 5)  # pale cheeks and chin
    fur(g, muzzle, PALE, 5, seed=9)
    P.flat(g, muzzle & (Y >= 44) & (Z < 2) & (np.abs(X + 0.5 - CX) < 2.6), "gray", 2)  # nose tip
    P.flat(g, muzzle & (Y >= 46) & (np.abs(X + 0.5 - CX) < 1.5), FUR, FUR_BASE)  # muzzle ridge
    # big glowing eyes under the angry brow (painted, rule K3)
    eye = {"d": C(FUR, 1), "g": C("toxic", 6), "G": C("toxic", 7), "p": C("gray", 1), "w": C("bone", 7)}
    rows = ["..ddddd.....ddddd..", ".dgggggd...dgggggd.", ".dGppGd.....dGppGd.", ".dGGGGGd...dGGGGGd.", ".dgggggd...dgggggd.", "..ddddd.....ddddd.."]
    stamp(g, "-z", 10, CX - 9, 45, rows, eye, depth=3)
    P.flat(g, brow & (Z < 10) & (Y == 51), FUR, FUR_BASE - 2)  # brow shadow line
    for fx in (CX - 3, CX + 2):  # upper fangs, on the head so the jaw can open
        box(g, fx, 38, 1, fx + 1, 40, 3, "bone", 7)
    return g


def jaw() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = side(g, [(41, 11), (41, 2), (39, 3), (37, 11)], CX - 3, CX + 3, PALE, 5)
    fur(g, m, PALE, 5, seed=10)
    P.flat(g, m & (Y >= 40) & (np.abs(X + 0.5 - CX) < 2.5), "red", 4)  # red mouth
    P.flat(g, m & (Y >= 40) & (np.abs(X + 0.5 - CX) >= 2.5) & (Z % 2 == 0), "bone", 7)  # lower teeth
    for fx in (CX - 3, CX + 2):
        box(g, fx, 40, 2, fx + 1, 42, 3, "bone", 7)
    return g


def arm(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + s * 15
    # A single tapered arm mass keeps the shoulder-to-forearm joint clean.
    arm_mass = front(g, [(sx - s * 3, 38), (sx + s * 2, 38), (sx + s * 5, 34), (sx + s * 4, 29), (sx + s * 3, 23), (sx + s * 3, 17), (sx - s * 3, 17), (sx - s * 3, 24), (sx - s * 4, 31)], 16, 25, FUR, FUR_BASE)
    hx = sx + s * 4
    hand = box(g, hx - 5, 8, 10, hx + 5, 18, 21, FUR, FUR_BASE - 1)
    fur(g, arm_mass, FUR, FUR_BASE, seed=11 + s)
    fur(g, hand, FUR, FUR_BASE - 1, seed=13 + s)
    P.flat(g, hand & (Y < 10), PALE, 4)  # pads
    for k in range(4):  # four oversized hooked claws, down and forward
        cxk = hx - 3.75 + k * 2.5
        side(g, [(9, 13.5), (9, 10.5), (4, 8.8), (1, 8.2), (4, 11)], cxk - 0.9, cxk + 0.9, "bone", 6)
    cuff = box(g, hx - 4, 18, 13, hx + 4, 21, 22, "magenta", 4)  # broken enchanted shackle
    P.outline(g, cuff, "purple", 2)
    P.flat(g, cuff & (Y == 19) & (Z < 16), "toxic", 6)
    for k in range(3):  # a dangling chain
        box(g, hx - s * 5 - 1, 17 - k * 3, 17, hx - s * 5 + 1, 19 - k * 3, 19, "gray", 5 - k % 2)
    return g


def _move() -> dict:
    """Move: a bounding lope, 24 frames (0.8 s), two bounds. The legs are
    part of the hips, so it travels in hops: it lands flat (frame 0 of a
    bound), sinks into the landing with the torso and the arms slamming
    down, pushes back up for 2 frames with the feet planted, and leaves the
    floor on a ballistic arc (8 frames, G = 30 m/s^2) that lands at full
    speed. On the floor the feet slide back at ground speed (the root moves
    back); in the air the body pitches forward with the legs trailing and
    the lead claw reaching, alternating arms each bound (a one-two). The
    head counters the pitch a frame late; the jaw pants open in the air."""
    T, B, GND, AIR = 24, 12, 4, 8
    V = 0.8  # ground speed while planted, voxels a frame
    slide = V * GND

    def z(f):
        d = f % B
        return -slide / 2 + V * d if d <= GND else slide / 2 - slide * (d - GND) / AIR

    pitch = lambda f: cyc(f % B, B, [(0, 0.0), (GND, 0.0), (6, -8.0), (8, -10.0), (10, -3.0), (11.99, 0.0)]) if f % B > GND else 0.0  # noqa: E731
    tdrop = {0: -0.8, 1: -1.9, 2: -1.3, 3: 0.4, 4: 0.8, 5: 0.6, 6: 0.4, 7: 0.2, 8: 0.0, 9: -0.1, 10: -0.2, 11: -0.4}
    tpitch = {0: -3.0, 1: -6.0, 2: -5.0, 3: 2.0, 4: 4.0, 5: 0.0, 6: -4.0, 7: -6.0, 8: -6.0, 9: -5.0, 10: -3.0, 11: -1.0}

    def arm(lead_bound, side):
        def fn(f):
            b, d = (f // B) % 2, f % B
            lead = b == lead_bound
            # on the floor the claws brace forward (the landing sinks and
            # pitches the torso, which would put them through the floor)
            reach = {0: 22.0, 1: 24.0, 2: 20.0, 3: 18.0, 4: 24.0, 5: 34.0, 6: 42.0, 7: 48.0, 8: 50.0, 9: 46.0, 10: 38.0, 11: 28.0}
            trail = {0: 20.0, 1: 22.0, 2: 19.0, 3: 16.0, 4: 14.0, 5: 14.0, 6: 16.0, 7: 18.0, 8: 18.0, 9: 18.0, 10: 18.0, 11: 19.0}
            spread = {0: 5.0, 1: 7.0, 2: 6.0, 3: 4.0, 4: 3.0}
            return ((reach if lead else trail)[d], 0.0, side * spread.get(d, 2.0 + 0.5 * (d - 5) if d > 7 else 2.0))
        return fn

    return {"hips": {"loc": per_frame(T, lambda f: (0.0, hop_height(f % B, GND, AIR), z(f))),
                     "rot": per_frame(T, lambda f: (pitch(f), 0.0, 0.0))},
            "torso": {"loc": per_frame(T, lambda f: (0.0, tdrop[f % B], 0.0)),
                      "rot": per_frame(T, lambda f: (tpitch[f % B], cyc(f, T, [(7, 5.0), (19, -5.0)]), 0.0))},
            "head": {"rot": per_frame(T, lambda f: (-0.6 * (pitch(f - 1) + tpitch[(f - 1) % B]) + {2: -6.0, 3: -4.0, 4: -1.0}.get(f % B, 0.0), 0.0, 0.0))},
            "jaw": {"rot": per_frame(T, lambda f: (6.0 if f % B < GND else 20.0, 0.0, 0.0))},
            "arm-l": {"rot": per_frame(T, arm(0, -1))},
            "arm-r": {"rot": per_frame(T, arm(1, 1))}}


def build():
    parts = {"hips": hips(), "torso": torso(), "head": head(), "jaw": jaw(), "arm-l": arm(-1), "arm-r": arm(1)}
    root = assemble(parts, [
        ("hips", None, HIP),
        ("torso", "hips", WAIST),
        ("head", "torso", NECK),
        ("jaw", "head", HINGE),
        ("arm-l", "torso", SHOULDER["arm-l"]),
        ("arm-r", "torso", SHOULDER["arm-r"]),
    ])
    idle = {"torso": {"rot": keys((0, (0, 0, 0)), (1.2, (4, 0, 0)), (2.4, (0, 0, 0)))},
            "head": {"rot": keys((0, (0, 0, 0)), (0.6, (-6, 10, 0)), (1.2, (0, 0, 0)), (1.8, (-4, -10, 0)), (2.4, (0, 0, 0)))},
            "jaw": {"rot": keys((0, (0, 0, 0)), (1.2, (8, 0, 0)), (2.4, (0, 0, 0)))},
            "arm-l": {"rot": keys((0, (0, 0, 0)), (1.2, (-6, 0, -4)), (2.4, (0, 0, 0)))},
            "arm-r": {"rot": keys((0, (0, 0, 0)), (1.2, (-6, 0, 4)), (2.4, (0, 0, 0)))}}
    # Attack, a double claw rip: it coils back and twists away with the right
    # claw cocked high behind its head and the jaw open (frames 0-12), lunges
    # in and rips the right claw down across in 3 frames to the blow on
    # frame 15, whips straight into a left backhand on frame 20 as the body
    # twists back, sags over it, snarls with a head shake (to 30), and
    # recovers by frame 44; the head, jaw and the free arm settle last.
    attack = {"hips": {"loc": keys((0, Z3), (fr(12), (0, 0.2, 2)), (fr(15), (0, 1.0, -5)), (fr(19), (0, 1.2, -6)), (fr(22), (0, 1.4, -6.8)),
                                   (fr(27), (0, 0.8, -7.2)), (fr(36), Z3)),
                       "rot": keys((0, Z3), (fr(12), (4, -10, 0)), (fr(15), (-6, 10, 0)), (fr(19), (-6, -8, 0)), (fr(22), (-8, -6, 0)),
                                   (fr(27), (-5, 0, 0)), (fr(36), Z3))},
              "torso": {"rot": keys((0, Z3), (fr(7), (8, -16, 0)), (fr(12), (14, -28, -4)), (fr(15), (-22, 26, 6)), (fr(19), (-24, -24, -6)),
                                    (fr(22), (-22, -18, -4)), (fr(27), (-14, -6, 0)), (fr(32), (2, 2, 0)), (fr(36), Z3))},
              "arm-r": {"rot": keys((0, Z3), (fr(6), (80, 0, 20)), (fr(12), (155, 0, 28)), (fr(15), (48, 0, -22)), (fr(18), (40, 0, -30)),
                                    (fr(21), (48, 0, -18)), (fr(26), (36, 0, -8)), (fr(32), (-6, 0, 2)), (fr(36), Z3))},
              "arm-l": {"rot": keys((0, Z3), (fr(10), (30, 0, -10)), (fr(14), (110, 0, -26)), (fr(17), (130, 0, -30)), (fr(19), (50, 0, 24)),
                                    (fr(21), (52, 0, 30)), (fr(26), (38, 0, 12)), (fr(32), (-6, 0, -2)), (fr(36), Z3))},
              "head": {"rot": keys((0, Z3), (fr(12), (18, 16, 0)), (fr(15), (-14, -16, 0)), (fr(19), (-18, 14, 0)), (fr(23), (-20, -12, 0)),
                                   (fr(25), (-16, 12, 0)), (fr(28), (-10, -4, 0)), (fr(34), (4, 0, 0)), (fr(36), Z3))},
              "jaw": {"rot": keys((0, Z3), (fr(10), (34, 0, 0)), (fr(15), (16, 0, 0)), (fr(19), (36, 0, 0)), (fr(26), (38, 0, 0)),
                                  (fr(31), (10, 0, 0)), (fr(36), Z3))}}
    # Hit: the blow on frame 3 shoves it back with a little pop up; it hangs
    # a beat, lands, sways forward past rest with its weight and settles; the
    # head snaps back and the loose parts trail. See _fall.hit_back.
    hit, hit_hit = hit_back("hips", foot=(-20, -1.5, -13.5), push=3.5, pop=1.6, tilt=12, head=("head", 26), arms={"arm-l": (34, -1), "arm-r": (34, 1)},
                            extra={"torso": lambda t: keys((0, Z3), (fr(4), (12, 8, 0)), (fr(9), (7, 4, 0)), (fr(t["O"]), (-6, 0, 0)), (fr(t["E"]), Z3)),
                                   "jaw": lambda t: keys((0, Z3), (fr(4), (30, 0, 0)), (fr(12), (10, 0, 0)), (fr(t["E"]), Z3))})
    # Death: the torso rocks forward and teeters back with a yelp, the arms
    # thrown up (the feet stay planted), catches itself, then it falls over
    # backwards (away from the attacker), fastest at the floor on the
    # impact frame, thuds, bounces once and settles on its back; the arms,
    # the head and the jaw land late. See _fall.py.
    jaw_k = lambda t: keys((0, Z3), (fr(t["B"]), (34, 0, 0)), (fr(t["I"]), (8, 0, 0)), (fr(t["L"]), (30, 0, 0)),  # noqa: E731
                         (fr(t["L"] + 5), (12, 0, 0)), (fr(t["E"]), (18, 0, 0)))
    death, death_hit = fall_back("hips", D=2.0, F=12.0, bounce=1.2, lead=3, bspan=3, R=100.0, roll=5.0, torso="torso", tee=0.25, torso_fin=(5, 0, 0),
                                 arms={"arm-l": ((-42, 0, -15), -1), "arm-r": ((-52, 0, 15), 1)},
                                 head=("head", (90, 0, 15)), extra={"jaw": jaw_k}, settle=-1.0)
    # sockets in root (hips joint) space: the mouth tip and the right claw tips
    mouth = (0.0, 40.0 - HIP[1], 1.0 - HIP[2])
    claw = (CX + 19.0 - HIP[0], 2.0 - HIP[1], 8.0 - HIP[2])
    # The claw effect starts when the right hand moves down in front of the body.
    return world("werewolf", "creatures", "Werewolf", root,
                 clips=[Clip("attack", attack, loop=False, impact=fr(15)), Clip("hit", hit, loop=False, impact=hit_hit), Clip("death", death, loop=False, impact=death_hit), Clip("idle", idle),
                        Clip("move", shift(_move(), 24, 10), ease=0)],
                 sockets=[Socket("socket-mouth", at=mouth, parent="head"), Socket("socket-claw-r", at=claw, parent="arm-r")],
                 pfx=[pfx("rvx-monster-howl", "socket-mouth", "clip:attack", size=30, offset=(0.0, 2.0, -12.0), at=fr(26)), pfx("rvx-monster-claw-slash", "socket-claw-r", "clip:attack", size=30, at=fr(13))])
