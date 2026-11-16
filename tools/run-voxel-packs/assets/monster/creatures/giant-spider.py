"""Giant tomb spider, in the Pirate Nation creature style.

A chunky caricature in the family of the werewolf: a huge bulbous
faceted abdomen of bristly violet fur with a big magenta skull marking, a
chamfered head-body with a cluster of glowing toxic eyes (two huge, four
small), two big curved bone fangs with blood tips, and eight long jointed
legs (true-slope prisms) splayed round it at rest angles, with pale joint
bands and bone tips. Fur, marking and eyes are paint. Clips: idle (breathe,
leg twitch), attack (rear and strike), death (flip onto its back, legs twiddle, slow and curl in).
Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes
from _fall import hit_back
from _kit import keys, pfx, world
from _move_rigid import giant_spider_move
from _life import chunk, claw, coords, fur, limb, octo, plan
from voxgrid import C, Clip, Grid, Part, Socket


def _add3(a, b):
    return tuple(x + y for x, y in zip(a, b))

Z3 = (0.0, 0.0, 0.0)


def fr(n: float) -> float:
    """Seconds of frame `n` at 30 fps (impact keys sit on whole frames)."""
    return n / 30.0


S = (32, 28, 50)
CX = 16
FUR = "purple"
PIVOT = (CX, 12.0, 20.0)
HIP_Z = (8.5, 12.0, 15.5, 19.0)
ANGLES = (48.0, 18.0, -14.0, -44.0)  # rest turn about y of the right legs, front to back
LEG = (28, 27, 5)
LEG_HIP = (3.0, 13.0, 2.5)


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    thorax = chunk(g, CX, 13.5, 5, 18.5, 9.5, 8.5, 3.0, FUR, 4, taper=2.2)
    low = plan(g, octo(CX, 34, 8, 9, 3), 4, 13, FUR, 4, top=octo(CX, 34, 13, 14.5, 4.5))
    high = plan(g, octo(CX, 34, 13, 14.5, 4.5), 13, 25, FUR, 4, top=octo(CX, 35.5, 6, 7, 2.5))
    pnshapes.cone(g, "z", CX, 11, 2.5, 48, 50, FUR, 3, n=6, r_top=1.0)
    abdomen = low | high
    fur(g, thorax, FUR, 4, seed=1)
    fur(g, abdomen, FUR, 4, seed=2)
    P.flat(g, abdomen & (Y < 8), FUR, 3)
    # stripes round the abdomen and a big magenta skull on its back (C3)
    P.flat(g, abdomen & (np.abs(Z - 40) < 1) & (Y > 10), "magenta", 4)
    P.flat(g, abdomen & (np.abs(Z - 44) < 1) & (Y > 8), "magenta", 4)
    skull_rows = pnglyph.ICONS["skull"]
    pnglyph.stamp(g, "top", 25, CX - 9, 25, skull_rows, {"#": C("magenta", 6), "+": C("magenta", 7), "-": C(FUR, 2)}, scale=2, depth=2, reach=6)
    # the face: two huge toxic eyes, four small ones above, a dark brow
    face = {"k": C(FUR, 1), "g": C("toxic", 6), "G": C("toxic", 7), "s": C("toxic", 5)}
    rows = [
        "kkk.kkk....kkk.kkk",
        "kgk.kGk....kGk.kgk",
        "kkk.kkk....kkk.kkk",
        "..................",
        ".kkkkkk....kkkkkk.",
        ".kGGggk....kGGggk.",
        ".kGgggk....kGgggk.",
        ".kgggsk....kgggsk.",
        ".kggssk....kggssk.",
        ".kkkkkk....kkkkkk.",
    ]
    pnglyph.stamp(g, "-z", 5.0, CX - 9, 6, rows, face, depth=2, reach=5)
    # two big curved fangs, blood-tipped
    for s in (-1, 1):
        claw(g, "z", (CX + s * 2.8, 8.0), (CX + s * 1.6, 1.0), 1.7, 5.5, 8.5, "bone", 6)
    P.flat(g, (g.a > 0) & (Y < 3) & (Z < 9), "blood", 5)
    return g


def leg(i: int, s: int) -> tuple[Grid, Grid]:
    """A leg pointing +x (s = 1) or -x (s = -1) from the hip, in the x-y
    plane, as two parts so it can fold at the knee: the femur (up and out to
    the knee) and the shin (down to a bone tip). Each part is its own grid."""
    reach = (23.0, 24.5, 24.0, 22.0)[i]
    knee = (13.0, 23.0)
    hip = (3.0, 13.0)
    out = []
    for part in ("femur", "shin"):
        g = Grid(*LEG)
        X, Y, Z = coords(g)
        if part == "femur":
            m = limb(g, "z", hip, knee, 2.5, 2.1, 0.5, 4.5, FUR, 4, cap=0.5)
        else:
            m = limb(g, "z", knee, (reach, 1.5), 2.1, 1.3, 1.0, 4.0, FUR, 4, cap=0.6)
        fur(g, m, FUR, 4, seed=10 + i)
        P.flat(g, m & (np.hypot(X + 0.5 - knee[0], Y + 0.5 - knee[1]) < 2.4), "magenta", 4)  # joint band
        tip = m & (Y < 6)
        P.flat(g, tip, "bone", 6)
        P.flat(g, tip & (Y < 3.5), "bone", 5)
        out.append(g if s > 0 else g.flip("x"))
    return out[0], out[1]


KNEE = (13.0, 23.0, 2.5)  # the knee in the leg grid (s = 1)


def build():
    g = body()
    root = Part("body", g, pivot=PIVOT)
    for s, side in ((1, "r"), (-1, "l")):
        for i in range(4):
            femur, shin = leg(i, s)
            hip = (LEG_HIP[0] if s > 0 else LEG[0] - LEG_HIP[0], LEG_HIP[1], LEG_HIP[2])
            knee = (KNEE[0] if s > 0 else LEG[0] - KNEE[0], KNEE[1], KNEE[2])
            hx = CX + s * 7.5
            thigh = root.add(Part(f"leg-{side}{i}", femur, pivot=hip, at=(hx - PIVOT[0], 12.0 - PIVOT[1], HIP_Z[i] - PIVOT[2]), rot=(0.0, s * ANGLES[i], 0.0)))
            thigh.add(Part(f"leg-{side}{i}-shin", shin, pivot=knee, at=(knee[0] - hip[0], knee[1] - hip[1], knee[2] - hip[2])))
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (0.8, (0, 1, 0)), (1.6, (0, 0, 0)))}}
    for side, s in (("l", -1), ("r", 1)):
        for i in range(4):
            ph = 0.1 * i + (0.2 if side == "r" else 0.0)
            idle[f"leg-{side}{i}"] = {"rot": keys((0, (0, 0, 0)), (0.2 + ph, (0, 0, s * 8)), (0.4 + ph, (0, 0, 0)), (1.6, (0, 0, 0)))}
    # Attack, a scuttling lunge bite: two quick 7-voxel steps forward on
    # alternating legs, each leg lifting and planting (frames 0-14), it rears
    # up and draws back with the front legs raised high (to 21), lunges 12
    # voxels over 4 frames, stabbing the front legs down and biting on frame
    # 24, overshoots, presses in, and scuttles back to its spot in three
    # steps by frame 56. Planted feet stay put while the body moves (the legs
    # counter-swing about their hips, about 2.9 degrees a voxel).
    A_ = {"l0", "r1", "l2", "r3"}
    ST = 20.0  # degrees of swing for a 7-voxel step
    attack = {"body": {"rot": keys((0, Z3), (fr(4), (2, 0, 1)), (fr(7), (0, 0, 0)), (fr(11), (2, 0, -1)), (fr(14), (0, 0, 0)),
                                   (fr(21), (20, 0, 0)), (fr(24), (-8, 0, 0)), (fr(27), (-10, 0, 2)), (fr(29), (-12, 0, -2)), (fr(31), (-11, 0, 2)), (fr(33), (-12, 0, -1)),
                                   (fr(35), (-2, 0, 1)), (fr(41), (1, 0, -1)), (fr(48), Z3)),
                       "loc": keys((0, Z3), (fr(4), (0, 0.8, -3.5)), (fr(7), (0, 0, -7)), (fr(11), (0, 0.8, -10.5)), (fr(14), (0, 0, -14)),
                                   (fr(21), (0, 3.8, -12)), (fr(25), (0, 0.6, -24)), (fr(27), (0, 0.6, -25.5)), (fr(31), (0, 0.5, -26)),
                                   (fr(35), (0, 0.8, -18)), (fr(41), (0, 0.8, -9)), (fr(48), Z3))}}
    for side, s in (("l", -1), ("r", 1)):
        for i in range(4):
            name = f"{side}{i}"
            a = name in A_
            f = s  # + swings the tip forward
            lift = lambda: s * 22  # noqa: E731
            if i == 0:  # front legs: rise high, stab down on the bite
                mid = (0, f * 6, s * 55)
                strike, over, hold = (0, f * 18, s * 14), (0, f * 22, s * 19), (0, f * 24, s * 18)
            elif i == 1:
                mid = (0, f * 4, s * 30)
                strike, over, hold = (0, f * 12, s * 9), (0, f * 14, s * 9), (0, f * 15, s * 8)
            else:  # back legs stay planted: they swing back as the body lunges
                mid = (0, -f * 6, 0)
                strike, over, hold = (0, -f * 34, 0), (0, -f * 38, 0), (0, -f * 40, 0)
            # out: swing forward in the air while the others carry the body
            if a:
                walk = ((fr(3), (0, f * ST * 0.5, lift())), (fr(7), (0, f * ST, 0)), (fr(14), Z3))
                back = ((fr(33), (0, -f * 14, lift())), (fr(35), (0, -f * 18, 0)), (fr(41), (0, f * 14, 0)), (fr(44), (0, 0, lift())), (fr(48), Z3))
            else:
                walk = ((fr(7), (0, -f * ST, 0)), (fr(10), (0, -f * ST * 0.5, lift())), (fr(14), Z3))
                back = ((fr(35), (0, f * 24, 0)), (fr(38), (0, 0, lift())), (fr(41), (0, -f * 14, 0)), (fr(48), Z3))
            # the press-in: the legs keep working, trembling a few degrees out of step
            tr = (0, 0, s * (5 if (i + (side == "r")) % 2 else -4))
            attack[f"leg-{name}"] = {"rot": keys((0, Z3), *walk, (fr(21), mid), (fr(24), strike), (fr(27), over),
                                                 (fr(29), _add3(over, tr)), (fr(31), hold), (fr(32), _add3(hold, tr)), *back)}
    # Hit: the blow on frame 3 shoves it back with a little pop up; it hangs
    # a beat, lands, sways forward past rest with its weight and settles; the
    # head snaps back and the loose parts trail. See _fall.hit_back.
    legs_hit = {}
    for side, s_ in (("l", -1), ("r", 1)):
        for i in range(4):
            a = (24 - 8 * i)
            legs_hit[f"leg-{side}{i}"] = (lambda a, s_: lambda t: keys((0, Z3), (fr(3), (0, 0, s_ * a)), (fr(8), (0, 0, s_ * a * 0.5)),
                                                                         (fr(t["L"]), (0, 0, s_ * 1)), (fr(t["O"]), (0, 0, s_ * 0.5)), (fr(t["E"]), Z3)))(a, s_)
    hit, hit_hit = hit_back("body", foot=(-12, 13.3, -17.0), push=3.5, pop=1.2, tilt=16, twist=5, extra=legs_hit)
    # Death: the blow jolts it into a crouch with the legs flung out (frames
    # 0-2), then it hops and flips over sideways onto its back in one fast
    # roll, legs snatching in as it goes, slamming down on frame 9 (squash,
    # one tiny bounce, still by 13). On its back the legs twiddle, slow down,
    # curl in and stop (below).
    # The roll only ever turns one way (keys under 90 degrees apart).
    UP = 1.0  # loc y that rests the upturned back on the floor
    death = {"body": {"rot": keys((0, Z3), (fr(2), (0, 0, -8)), (fr(4), (0, 0, 44)), (fr(6), (0, 0, 98)), (fr(8), (0, 0, 152)), (fr(9), (0, 0, 180)),
                                  (fr(54), (0, 0, 180))),
                      "loc": keys((0, Z3), (fr(2), (0.5, -1.5, 0)), (fr(5), (-2.5, 8.0, 0)), (fr(7), (-3.8, 5.5, 0)), (fr(8), (-4.4, 2.5, 0)), (fr(9), (-5.0, UP - 2.1, 0)),
                                  (fr(11), (-5.2, UP + 0.8, 0)), (fr(13), (-5.2, UP, 0)), (fr(54), (-5.2, UP, 0))),
                      "scale": keys((0, (1, 1, 1)), (fr(2), (1.07, 0.9, 1.07)), (fr(4), (0.95, 1.07, 0.95)), (fr(7), (1, 1, 1)), (fr(9), (1.12, 0.84, 1.12)),
                                    (fr(11), (0.97, 1.04, 0.97)), (fr(13), (1, 1, 1)), (fr(54), (1, 1, 1)))}}
    # On its back the legs twiddle: fast little wiggles (a stroke every 2
    # frames, each leg out of step), then slower and smaller strokes, then
    # every leg curls in tight over 4 frames, overshoots a hair and stops
    # (frame 50; ends 54).
    FAST = 9  # 2-frame strokes, frames 12-30
    SLOW = ((3, 0.7), (3, 0.55), (4, 0.4), (5, 0.25))  # (frames, size): slowing down
    END = 54
    for side, s in (("l", -1), ("r", 1)):
        for i in range(4):
            fore = i < 2
            fm, fo = (-100.0, 50.0) if fore else (-90.0, 55.0)  # femurs folded under the belly, shins curled in: legs up in the air once flipped
            hook_f = (0, -s * 0.25 * ANGLES[i], s * fm)
            hook_s = (0, 0, -s * fo)
            curl_f = _add3(hook_f, (0, 0, s * 10))  # dead: femurs up, shins drawn in over the belly
            curl_s = _add3(hook_s, (0, 0, s * 22))
            ks_f = [(0, Z3), (fr(2), (0, 0, s * (12 if fore else 6))), (fr(4), _add3(hook_f, (0, 0, s * 6))), (fr(7), hook_f), (fr(9), _add3(hook_f, (0, 0, -s * 8))),
                    (fr(12), hook_f)]
            ks_s = [(0, Z3), (fr(2), (0, 0, s * 8)), (fr(4), _add3(hook_s, (0, 0, s * 12))), (fr(7), hook_s), (fr(9), _add3(hook_s, (0, 0, -s * 10))), (fr(12), hook_s)]
            k = i + (4 if side == "r" else 0)
            ph = (k * 3) % 2  # half the legs a frame late
            sign = 1 if (k % 3) else -1  # not all in the same direction
            size = (1.0, 0.8, 0.9, 0.75)[i]
            swing = (0, 2.5 * (1 if k % 2 else -1), 0)  # a little fore-aft in the wiggle
            f = 12 + ph
            def kick(f, a):
                ks_f.append((fr(f), _add3(hook_f, (swing[0], swing[1] * a, s * 10 * a))))
                ks_s.append((fr(f), _add3(hook_s, (0, 0, s * 16 * a))))
            for n in range(FAST):
                f += 2
                kick(f, sign * size * (1.0 - 0.025 * n) * (1 if n % 2 == 0 else -1))
            for n, (d, amp) in enumerate(SLOW):
                f += d
                kick(f, sign * size * amp * (1 if (FAST + n) % 2 == 0 else -1))
            # from the last wiggle (frame 45 or 46), curl in over 4 frames, a hair past, stop
            ks_f += [(fr(f + 4), _add3(curl_f, (0, 0, s * 1.5))), (fr(f + 5), curl_f), (fr(END), curl_f)]
            ks_s += [(fr(f + 4), _add3(curl_s, (0, 0, s * 3))), (fr(f + 5), curl_s), (fr(END), curl_s)]
            death[f"leg-{side}{i}"] = {"rot": keys(*ks_f)}
            death[f"leg-{side}{i}-shin"] = {"rot": keys(*ks_s)}
    fangs = (0.0, 2.0 - PIVOT[1], 6.0 - PIVOT[2])
    spinner = (0.0, 12.0 - PIVOT[1], 49.0 - PIVOT[2])
    return world("giant-spider", "creatures", "Giant Tomb Spider", root,
                 clips=[Clip("attack", attack, loop=False, impact=fr(24)), Clip("hit", hit, loop=False, impact=hit_hit), Clip("death", death, loop=False, impact=fr(9)), Clip("idle", idle),
                        Clip("move", giant_spider_move(ANGLES, (23.0, 24.5, 24.0, 22.0), LEG_HIP[0]), ease=0)],
                 sockets=[Socket("socket-fangs", at=fangs, parent="body"), Socket("socket-spinner", at=spinner, parent="body")],
                 pfx=[pfx("rvx-monster-venom-spit", "socket-fangs", "clip:attack", size=30, aim=(0.0, -0.243, -0.97), at=0.4), pfx("rvx-monster-rot-poof", "socket-fangs", "clip:death", size=40, at=fr(9))])
