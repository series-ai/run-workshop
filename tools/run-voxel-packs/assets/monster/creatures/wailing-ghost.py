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
from _kit import keys, pfx, world
from _life import assemble, chain, chunk, claw, coords, limb, octo, plan
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

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


def build():
    parts = {"body": body(), "arm-l": arm(-1), "arm-r": arm(1)}
    root = assemble(parts, [("body", None, CORE), ("arm-l", "body", SHOULDER["arm-l"]), ("arm-r", "body", SHOULDER["arm-r"])])
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (1.0, (0, 2.5, 0)), (2.0, (0, 0, 0))), "rot": keys((0, (0, -8, 3)), (1.0, (0, 8, -3)), (2.0, (0, -8, 3)))},
            "arm-l": {"rot": keys((0, (0, 0, 0)), (1.0, (-15, 0, -8)), (2.0, (0, 0, 0)))}, "arm-r": {"rot": keys((0, (-15, 0, 8)), (1.0, (0, 0, 0)), (2.0, (-15, 0, 8)))}}
    attack = {"body": {"loc": keys((0, (0, 0, 0)), (0.25, (0, 3, 5)), (0.5, (0, -1, -12)), (1.0, (0, 0, 0))), "rot": keys((0, (0, 0, 0)), (0.25, (-10, 0, 0)), (0.5, (20, 0, 0)), (1.0, (0, 0, 0)))},
              "arm-l": {"rot": keys((0, (0, 0, 0)), (0.25, (-60, 0, -30)), (0.5, (15, 0, 10)), (1.0, (0, 0, 0)))},
              "arm-r": {"rot": keys((0, (0, 0, 0)), (0.25, (-60, 0, 30)), (0.5, (15, 0, -10)), (1.0, (0, 0, 0)))}}
    # hit: the sheet squashes and flinches back, the arms fly up
    hit = {"body": {"loc": keys((0, (0, 0, 0)), (0.1, (0, 1, 5)), (0.6, (0, 0, 0))), "rot": keys((0, (0, 0, 0)), (0.1, (-16, 10, 0)), (0.6, (0, 0, 0))),
                    "scale": keys((0, (1, 1, 1)), (0.1, (1.15, 0.85, 1.15)), (0.3, (0.95, 1.06, 0.95)), (0.6, (1, 1, 1)))},
           "arm-l": {"rot": keys((0, (0, 0, 0)), (0.1, (-45, 0, -25)), (0.6, (0, 0, 0)))},
           "arm-r": {"rot": keys((0, (0, 0, 0)), (0.1, (-45, 0, 25)), (0.6, (0, 0, 0)))}}
    death = {"body": {"loc": keys((0, (0, 0, 0)), (1.2, (0, 16, 0))), "scale": keys((0, (1, 1, 1)), (0.4, (1.2, 0.9, 1.2)), (1.2, (0.05, 1.6, 0.05)), (1.35, (0.01, 0.01, 0.01))), "rot": keys((0, (0, 0, 0)), (0.6, (0, 180, 0)), (1.2, (0, 360, 0)))}}
    core = (0.0, 18.0 - CORE[1], CZ - 8.0 - CORE[2])
    return world("wailing-ghost", "creatures", "Wailing Ghost", root,
                 clips=[Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False), Clip("idle", idle)],
                 sockets=[Socket("socket-core", at=core, parent="body")],
                 pfx=[pfx("rvx-monster-ghost-wisps", "socket-core", "idle", size=30), pfx("rvx-monster-soul-burst", "socket-core", "clip:death", size=56, at=0.9)])
