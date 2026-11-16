"""Wailing ghost, in the Pirate Nation creature style.

A chunky caricature in the family of the werewolf: a big pale mint
sheet ghost with a round hooded head, huge hollow eyes with toxic pupils,
a tall wailing mouth with a magenta glow deep inside, a sheet that flares
out into a ring of ragged tatters (true-slope points), and two flared
sleeves reaching out with bony hands and broken iron manacles. The sheet
folds, seams and glow are paint (S1). About 42 tall, a little taller than a
36 person. Clips: idle (float and drift), attack (lunge), death (dissolve
upward). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
from _fall import hit_back
from _gait_loops import cyc, per_frame
from _kit import keys, pfx, world
from _life import assemble, chain, chunk, claw, coords, limb, octo, plan
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

Z3 = (0.0, 0.0, 0.0)


def fr(n: float) -> float:
    """Seconds of frame `n` at 30 fps (impact keys sit on whole frames)."""
    return n / 30.0

S = (44, 46, 36)
CX, CZ = 22, 18
SHEET = "cyan"
CORE = (CX, 22.0, CZ)
SHOULDER = {"arm-l": (CX - 7.0, 28.0, CZ), "arm-r": (CX + 7.0, 28.0, CZ)}


def sheet(g: Grid, m: np.ndarray, seed: int) -> None:
    """Pale sheet: soft vertical fold lines (every 4 voxels round the body),
    one shade lighter on top (it glows from above), darker toward the hem."""
    U, V = P.uv(g)
    X, Y, Z = coords(g)
    shade = np.full(g.shape, 6, dtype=np.int64)
    shade = np.where(U % 7 == 0, 5, shade)
    shade = np.where(U % 7 == 1, 7, shade)
    shade = np.where(Y < 10, shade - 1, shade)
    P._paint(g, m, SHEET, np.minimum(7, shade))


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # the sheet flares from the shoulders to a wide hem (one frustum: true slopes)
    robe = plan(g, octo(CX, CZ + 0.5, 10.5, 9.5, 3.5), 7, 27, SHEET, 6, top=octo(CX, CZ, 7.0, 6.5, 2.5))
    head = chunk(g, CX, CZ - 0.5, 26, 37, 8.2, 7.6, 2.8, SHEET, 6, taper=0.4)
    crown = plan(g, octo(CX, CZ - 0.1, 7.8, 7.2, 2.6), 37, 42.5, SHEET, 6, top=octo(CX + 0.5, CZ + 1.0, 3.0, 2.8, 1.0))
    sheet(g, robe | head | crown, seed=1)
    P.flat(g, crown & (Y >= 40), SHEET, 7)
    P.flat(g, crown & (Y >= 41.5), "bone", 7)  # the glow on top
    # ragged tatters: a ring of points hanging from the hem
    hem = np.zeros(g.shape, dtype=bool)
    for k, dx in enumerate((-8, -3, 2, 7)):
        drop = 0.8 + (k % 2) * 1.6
        hem |= claw(g, "z", (CX + dx, 7.5), (CX + dx + (1 if k % 2 else -1), drop), 2.6, CZ - 9.4, CZ - 7.0, SHEET, 5)
        hem |= claw(g, "z", (CX - dx, 7.5), (CX - dx + (1 if k % 2 else -1), drop + 0.8), 2.6, CZ + 8.0, CZ + 10.4, SHEET, 5)
    for k, dz in enumerate((-5, 0, 5)):
        drop = 1.2 + (k % 2) * 1.4
        for sx in (-1, 1):
            x0 = CX + sx * 9.2
            hem |= claw(g, "x", (7.5, CZ + dz), (drop, CZ + dz + sx), 2.6, min(x0, x0 + sx * 2.2), max(x0, x0 + sx * 2.2), SHEET, 5)
    P.flat(g, hem, SHEET, 5)
    P.flat(g, hem & (Y < 4), SHEET, 4)
    # the face: huge hollow eyes with toxic pupils and a tall wailing mouth
    face = {"k": C("purple", 2), "K": C("purple", 1), "g": C("toxic", 6), "G": C("toxic", 7), "m": C("magenta", 5), "M": C("magenta", 7), "b": C("purple", 3)}
    rows = [
        "..kkkk....kkkk..",
        ".kkkkkk..kkkkkk.",
        "kkkkkkk..kkkkkkk",
        "kkkGgkk..kkGgkkk",
        "kkkggkk..kkggkkk",
        "kkkkkkk..kkkkkkk",
        ".kkkkk....kkkkk.",
        "................",
        "......kkkk......",
        ".....kbbbbk.....",
        ".....kmmmmk.....",
        ".....kmMMmk.....",
        ".....kmMMmk.....",
        ".....kmmmmk.....",
        ".....kbbbbk.....",
        "......kkkk......",
    ]
    pnglyph.stamp(g, "-z", CZ - 8.1, CX - 8, 22, rows, face, depth=2, reach=3)
    return g


def arm(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + s * 7.0
    sleeve = limb(g, "z", (sx, 29), (sx + s * 9, 21), 2.8, 4.2, CZ - 5.5, CZ + 0.5, SHEET, 6, cap=0.2)
    sheet(g, sleeve, seed=5 + s)
    hx = sx + s * 10.5
    hand = box(g, hx - 2, 16, CZ - 4.5, hx + 2, 21, CZ - 0.5, "bone", 6)
    P.flat(g, hand & (Y < 17), "bone", 5)
    for k in range(3):  # bony fingers, curled down
        fx = hx - 1.8 + k * 1.4
        claw(g, "x", (16.5, CZ - 3.8), (12.5, CZ - 3.2), 0.9, fx, fx + 1.1, "bone", 7)
    cuff = box(g, hx - 2.8, 20, CZ - 5.3, hx + 2.8, 22.5, CZ + 0.3, "steel", 4)
    P.outline(g, cuff, "steel", 2)
    chain(g, (hx + s * 3.0, 20.5, CZ - 2.5), (hx + s * 3.0, 11.5, CZ - 2.5), link=3, ramp="steel", shade=4)
    return g


def _move() -> dict:
    """Move: a gliding drift, 36 frames (1.2 s), one swoop. It floats clear
    of the floor tilted forward (the hem trails behind) and swoops: it dips
    and surges forward leaning deeper, stretching along the glide, then
    rises and eases back, rocking gently side to side. The sleeves trail
    back and wave a few frames behind the body."""
    T = 36
    dip = lambda f: cyc(f, T, [(0, 1.0), (18, -1.0)])  # noqa: E731  (+1 high, -1 low)
    surge = lambda f: cyc(f, T, [(6, 1.0), (24, -1.0)])  # noqa: E731  (forward on the way down)
    return {"body": {"loc": per_frame(T, lambda f: (0.6 * cyc(f, T, [(9, 1.0), (27, -1.0)]), 5.0 + 1.6 * dip(f), -1.2 * surge(f))),
                     "rot": per_frame(T, lambda f: (-14.0 - 4.0 * surge(f), 5.0 * cyc(f, T, [(9, 1.0), (27, -1.0)]), -4.0 * cyc(f, T, [(12, 1.0), (30, -1.0)]))),
                     "scale": per_frame(T, lambda f: (1.0 - 0.02 * surge(f), 1.0 - 0.02 * surge(f), 1.0 + 0.04 * surge(f)))},
            "arm-l": {"rot": per_frame(T, lambda f: (-28.0 + 8.0 * surge(f - 4), 0.0, -6.0 + 4.0 * dip(f - 3)))},
            "arm-r": {"rot": per_frame(T, lambda f: (-28.0 + 8.0 * surge(f - 5), 0.0, 6.0 - 4.0 * dip(f - 4)))}}


def build():
    parts = {"body": body(), "arm-l": arm(-1), "arm-r": arm(1)}
    root = assemble(parts, [("body", None, CORE), ("arm-l", "body", SHOULDER["arm-l"]), ("arm-r", "body", SHOULDER["arm-r"])])
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (1.0, (0, 2.5, 0)), (2.0, (0, 0, 0))), "rot": keys((0, (0, -8, 3)), (1.0, (0, 8, -3)), (2.0, (0, -8, 3)))},
            "arm-l": {"rot": keys((0, (0, 0, 0)), (1.0, (-15, 0, -8)), (2.0, (0, 0, 0)))}, "arm-r": {"rot": keys((0, (-15, 0, 8)), (1.0, (0, 0, 0)), (2.0, (-15, 0, 8)))}}
    # Attack, a shrieking lunge: it draws up and back, stretched tall with
    # the clawed sleeves raised (frames 0-12), then flings itself forward 14
    # voxels in 3 frames, squashing as it drives both claws forward and down
    # on frame 15, presses on through the target, and wobbles back to its spot by 40.
    attack = {"body": {"loc": keys((0, Z3), (fr(6), (0, 2.5, 2.5)), (fr(12), (0, 5.0, 5)), (fr(15), (0, 1.5, -14)), (fr(18), (0, 2.2, -15.5)),
                                   (fr(23), (0, 2.6, -16.5)), (fr(29), (0, 1.0, -4)), (fr(34), Z3)),
                       "rot": keys((0, Z3), (fr(12), (-14, 0, 0)), (fr(15), (22, 0, 0)), (fr(18), (26, 0, 0)), (fr(23), (28, 0, 0)),
                                   (fr(29), (-6, 0, 0)), (fr(34), Z3)),
                       "scale": keys((0, (1, 1, 1)), (fr(12), (0.86, 1.18, 0.86)), (fr(14), (0.9, 1.05, 1.2)), (fr(15), (1.2, 0.82, 1.15)),
                                     (fr(18), (0.95, 1.06, 0.95)), (fr(23), (1.04, 0.97, 1.04)), (fr(29), (0.98, 1.02, 0.98)), (fr(34), (1, 1, 1)))},
              "arm-l": {"rot": keys((0, Z3), (fr(12), (120, 0, -30)), (fr(15), (40, 0, 12)), (fr(18), (18, 0, 14)), (fr(23), (6, 0, 12)),
                                    (fr(29), (-8, 0, -4)), (fr(34), Z3))},
              "arm-r": {"rot": keys((0, Z3), (fr(12), (120, 0, 30)), (fr(15), (40, 0, -12)), (fr(18), (18, 0, -14)), (fr(23), (6, 0, -12)),
                                    (fr(29), (-8, 0, 4)), (fr(34), Z3))}}
    # Hit: the blow on frame 3 shoves it back with a little pop up; it hangs
    # a beat, lands, sways forward past rest with its weight and settles; the
    # head snaps back and the loose parts trail. See _fall.hit_back.
    hit, hit_hit = hit_back("body", foot=(-20, 9.5, -8.5), push=5.0, pop=2.0, tilt=12, snap=0.25, arms={"arm-l": (-45, -1), "arm-r": (-45, 1)})
    # Death (the published vanish, made snappy): the blow squashes it flat
    # (frames 0-3), then it shoots straight up, accelerating, spinning one
    # way only (a whole turn, keys 90 degrees apart so it can't take the
    # short way back) and stretching thin with the arms thrown up, and on
    # frame 18 it zips away to nothing in 3 frames (ends 23).
    death = {"body": {"loc": keys((0, Z3), (fr(3), (0, -1.5, 1.5)), (fr(8), (0, 1.5, 1.0)), (fr(12), (0, 5.0, 0.5)), (fr(15), (0, 9.0, 0)),
                                  (fr(18), (0, 16.0, 0)), (fr(21), (0, 19.0, 0)), (fr(23), (0, 19.0, 0))),
                      "rot": keys((0, Z3), (fr(3), (-8, 0, 0)), (fr(9), (0, 90, 0)), (fr(13), (0, 180, 0)), (fr(16), (0, 270, 0)), (fr(18), (0, 360, 0)),
                                  (fr(23), (0, 360, 0))),
                      "scale": keys((0, (1, 1, 1)), (fr(3), (1.22, 0.8, 1.22)), (fr(7), (0.95, 1.1, 0.95)), (fr(12), (0.6, 1.35, 0.6)),
                                    (fr(18), (0.06, 1.7, 0.06)), (fr(21), (0.01, 0.01, 0.01)), (fr(23), (0.01, 0.01, 0.01)))},
             "arm-l": {"rot": keys((0, Z3), (fr(3), (-35, 0, -20)), (fr(8), (110, 0, -20)), (fr(12), (135, 0, -10)), (fr(23), (135, 0, -10)))},
             "arm-r": {"rot": keys((0, Z3), (fr(3), (-35, 0, 20)), (fr(8), (110, 0, 20)), (fr(12), (135, 0, 10)), (fr(23), (135, 0, 10)))}}
    core = (0.0, 18.0 - CORE[1], CZ - 8.0 - CORE[2])
    return world("wailing-ghost", "creatures", "Wailing Ghost", root,
                 clips=[Clip("attack", attack, loop=False, impact=fr(15)), Clip("hit", hit, loop=False, impact=hit_hit), Clip("death", death, loop=False, impact=fr(18)), Clip("idle", idle),
                        Clip("move", _move(), ease=0)],
                 sockets=[Socket("socket-core", at=core, parent="body")],
                 pfx=[pfx("rvx-monster-ghost-wisps", "socket-core", "idle", size=30), pfx("rvx-monster-soul-burst", "socket-core", "clip:death", size=56, at=fr(18))])
