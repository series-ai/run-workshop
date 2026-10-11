"""Build a phoenix with a flame tail and two taloned legs."""
import numpy as np
import paint as P
import pnshapes as S
from _fcreature_beasts import frame_seams, paint_solids, scallops
from _life import C, Clip, Grid, Socket, asset, coords, front, keys, pfx, rig, side

SH = (80, 88, 88)
CX = 40.0


def feathers(g, start, ramp, shade, seed):
    mask = paint_solids(g, start, lambda grid, face, frame: scallops(
        grid, face, ramp, shade, frame=frame, width=5, row=4,
        seed=seed, pointed=True, streak=True))
    frame_seams(g, start, mask, steps=1)
    return mask


def body():
    g = Grid(*SH)
    x, y, z = coords(g)
    start = len(g.solids)
    g.prism("z", [(29, 27), (33, 18), (47, 18), (51, 27),
                   (50, 40), (45, 47), (35, 47), (30, 40)],
            25, 50, C("red", 4), top=[(32, 28), (35, 21), (45, 21),
            (48, 28), (47, 39), (44, 44), (36, 44), (33, 39)])
    breast = feathers(g, start, "red", 4, 2)
    P.flat(g, breast & (z < 31) & (y > 24) & (y < 40), "orange", 5)
    P.flat(g, breast & (z < 30) & ((np.floor(y).astype(int) % 5) == 0), "gold", 5)
    start = len(g.solids)
    front(g, [(35, 42), (45, 42), (46, 56), (43, 62),
              (37, 62), (34, 56)], 24, 39, "orange", 5)
    feathers(g, start, "orange", 5, 3)
    start = len(g.solids)
    S.disc(g, "z", CX, 61, 8.5, 18, 34, "red", 5, n=8)
    head = feathers(g, start, "red", 5, 4)
    P.flat(g, head & (z < 21) & (y < 60), "gold", 5)
    beak = front(g, [(36, 59), (44, 59), (42, 54), (40, 51),
                     (38, 54)], 12, 19, "bone", 6)
    P.flat(g, beak & (y < 55), "iron", 4)
    for eye_x in (34, 44):
        P.flat(g, head & (abs(x - eye_x) < 2.2) & (y > 61) &
               (y < 65) & (z < 19.5), "gold", 7)
        P.flat(g, head & (abs(x - eye_x) < 0.8) & (y > 62) &
               (y < 65) & (z < 19.5), "darkwood", 1)
    for dx, tip in ((-5, 74), (0, 80), (5, 73)):
        crest = side(g, [(66, 26), (tip, 29), (70, 33), (64, 32)],
                     CX + dx - 2, CX + dx + 2, "orange", 5)
        P.flat(g, crest & (y > tip - 5), "gold", 7)
    for leg_x in (CX - 7, CX + 7):
        start = len(g.solids)
        side(g, S.quad((24, 34), (8, 31), 2.6, 1.8),
             leg_x - 2.2, leg_x + 2.2, "gold", 4)
        S.bar(g, "z", (leg_x, 8), (leg_x, 3), 2.2, 28, 35, "gold", 5)
        for toe_dx in (-3, 0, 3):
            toe_x = leg_x + toe_dx
            side(g, S.quad((3.5, 32), (1.1, 23), 1.3, 0.7),
                 toe_x - 0.9, toe_x + 0.9, "gold", 5)
            claw = side(g, [(1.5, 25), (1.5, 22), (0, 19), (0, 24)],
                        toe_x - 0.8, toe_x + 0.8, "iron", 4)
            P.flat(g, claw & (z < 21), "bone", 7)
        feathers(g, start, "gold", 4, 5)
    for index, dx in enumerate((-10, -5, 0, 5, 10)):
        tip_y = 49 + (index % 3) * 4
        tip_z = 75 + (index % 2) * 4
        tail = side(g, [(24, 48), (29, 61), (tip_y, tip_z),
                        (tip_y - 8, tip_z - 5), (26, 53)],
                    CX + dx - 2.2, CX + dx + 2.2, "red", 4)
        t = (z - 49) / max(1, tip_z - 49)
        P.flat(g, tail & (t > 0.30), "orange", 5)
        P.flat(g, tail & (t > 0.70), "gold", 6)
        P.flat(g, tail & (t > 0.88), "gold", 7)
    return g


def wing(sign):
    g = Grid(*SH)
    x, y, z = coords(g)
    root_x = CX + sign * 10
    tip_x = CX + sign * 34
    start = len(g.solids)
    S.bar(g, "z", (root_x, 40), (tip_x, 64), 5.8, 27, 37, "red", 4)
    for index in range(6):
        a = index / 5
        feather_x = root_x + sign * (7 + 16 * a)
        root_y = 40 + 22 * a
        tip_y = root_y - 13 - 4 * a
        feather = front(g, S.quad((feather_x, root_y),
                                  (feather_x + sign * 5, tip_y),
                                  3.2, 0.8, cap=1.5),
                        25 + a * 1.5, 37 - a * 1.5, "red", 5)
        P.flat(g, feather & (y < tip_y + 7), "orange", 5)
        P.flat(g, feather & (y < tip_y + 3), "gold", 6)
    feathers(g, start, "red", 4, 7 + sign)
    P.flat(g, (g.a > 0) & (y < 37) & (abs(x - CX) > 16), "gold", 6)
    return g


def build():
    root, to_root = rig([
        ("body", body(), None, None),
        ("wing-l", wing(-1), (CX - 10, 40, 32), None),
        ("wing-r", wing(1), (CX + 10, 40, 32), None),
    ])
    idle = {
        "wing-l": {"rot": keys((0, 0, 0, 0), (0.8, 0, 0, -8), (1.6, 0, 0, 0))},
        "wing-r": {"rot": keys((0, 0, 0, 0), (0.8, 0, 0, 8), (1.6, 0, 0, 0))},
    }
    attack = {
        "body": {"loc": keys((0, 0, 0, 0), (0.25, 0, 8, 0),
                              (0.45, 0, 12, -8), (0.8, 0, 0, 0))},
        "wing-l": {"rot": keys((0, 0, 0, 0), (0.2, 0, 0, -35),
                                 (0.45, 0, 0, 25), (0.8, 0, 0, 0))},
        "wing-r": {"rot": keys((0, 0, 0, 0), (0.2, 0, 0, 35),
                                 (0.45, 0, 0, -25), (0.8, 0, 0, 0))},
    }
    hit = {"body": {"rot": keys((0, 0, 0, 0), (0.12, 12, 0, 0),
                                   (0.35, 0, 0, 0))}}
    death = {"body": {"rot": keys((0, 0, 0, 0), (0.9, 75, 0, 0))},
             "wing-l": {"rot": keys((0, 0, 0, 0), (0.9, 10, 0, -25))},
             "wing-r": {"rot": keys((0, 0, 0, 0), (0.9, 10, 0, 25))}}
    return asset(
        "creatures", "phoenix", "Phoenix", root,
        clips=[Clip("idle", idle), Clip("attack", attack, loop=False),
               Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
        sockets=[Socket("socket-function", at=to_root((CX, 53, 11)), parent="body")],
        fx=[pfx("rvx-fantasy-dragon-breath", "socket-function",
                "clip:attack", size=20, aim=(0.0, -0.243, -0.97), at=0.35)],
    )
