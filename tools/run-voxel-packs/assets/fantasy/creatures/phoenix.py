"""Build a phoenix with a flame tail and two taloned legs.

Parts: body (the root, with the legs), head (neck, head, beak, crest),
tail, wing-l, wing-r. Clips: idle (the wings breathe, the head bobs),
attack (rears, coils the neck and pecks at you), hit (knocked back off its
feet, hops back), death (flaps hard, stalls, falls over backwards).
Faces -Z.
"""
import math

import numpy as np
import paint as P
import pnshapes as S
from _fcreature_beasts import frame_seams, paint_solids, scallops
from _falls_flyers import flap_fall
from _move_gaits import cyc, per_frame, turn_loop
from _life import C, Clip, Grid, Socket, asset, coords, front, keys, pfx, rig, side

SH = (80, 88, 88)
CX = 40.0
NECK = (CX, 44.0, 31.0)  # the neck hinge, at the base of the neck
TAIL_HINGE = (CX, 27.0, 49.0)  # the tail hinge, on the rump
# the points of the feet that touch the floor, (y, z): the tips and the
# backs of the claws it stands on (measured on the built model: rocking back
# it pivots on the middle of the claws, the toes behind never reach the floor)
CONTACTS = [(0.0, 19.5), (0.0, 21.6)]
REST_LIFT = 5.5  # how far the lying pose would sink below the floor
WING_LAND = (0.0, 31.7, 0.0)  # wing-l lying spread on the floor (wing-r mirrors it)
HEAD_LAND = (35.5, 20.0, 0.0)  # the neck tipped back onto the floor, lolling
TAIL_LAND = (-98.0, 0.0, 0.0)  # the tail folded down past the feet, flat on the floor
TAIL_TUCK = 2.0  # how far the tail's root tucks in so it doesn't prop the body


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
    return g


def head():
    """The neck, the head with the beak, the eyes and the crest: its own
    part so the neck can thrust and snap (the peck) and lag in a fall."""
    g = Grid(*SH)
    x, y, z = coords(g)
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
    return g


def tail():
    """The flame tail: five long feathers sweeping up and back from the
    rump, its own part so it can lash and flop."""
    g = Grid(*SH)
    x, y, z = coords(g)
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


def fly_move() -> dict:
    """move: soaring flight, one huge wing beat in 36 frames. Tipped
    forward, it hauls the wings up high and slow (over 24 frames), then
    drives them down in 9 frames, accelerating, through a big sweep and
    the body is heaved up a beat later, settling back as the wings rise.
    The flame tail streams behind: it trails the heave by a few frames
    (whipped down as the body jumps up, then flicking up past level as it
    sinks) with a slow side-to-side wave; the head holds level on its line."""
    T = 36

    def z(*v):
        return np.array(v, float)
    wing = cyc([(0, z(0, 16, -60)), (9, z(0, -22, 44), "acc"), (12, z(0, -26, 36), "snap"), (22, z(0, -4, 0)), (30, z(0, 12, -48))], T)
    s = {"body": {"loc": cyc([(0, z(0, 17.0, 0)), (4, z(0, 16.4, 0), "snap"), (13, z(0, 21.0, 0), "snap"), (24, z(0, 19.5, 0))], T),
                  "rot": cyc([(0, z(-26, 0, 0)), (11, z(-22, 0, 0), "snap"), (24, z(-26, 0, 0))], T)},
         "head": {"rot": cyc([(0, z(24, 0, 0)), (12, z(21, 0, 0), "snap"), (25, z(25, 0, 0))], T)},
         "tail": {"rot": cyc([(0, z(18, 0, 3)), (8, z(16, 0, -1)), (15, z(26, 0, -4), "snap"), (25, z(8, 0, 1)), (31, z(14, 0, 4))], T)},
         "wing-l": {"rot": wing},
         "wing-r": {"rot": [w * z(1, -1, -1) for w in wing]}}
    s, _ = turn_loop(s, T)
    return per_frame(s)


def build():
    root, to_root = rig([
        ("body", body(), None, None),
        ("head", head(), NECK, None),
        ("tail", tail(), TAIL_HINGE, None),
        ("wing-l", wing(-1), (CX - 10, 40, 32), None),
        ("wing-r", wing(1), (CX + 10, 40, 32), None),
    ])
    f = 1 / 30

    def on_feet(rows):
        """Root keys that tip the bird on its feet: rows of (frame, rot x,
        extra loc). Each key pivots about whichever contact point of the
        feet is lowest in that pose (the claw tips tipping forward, the heels
        tipping back), so the feet stay on the floor without sliding."""
        rot, loc = [], []
        for fr, ax, (ex, ey, ez) in rows:
            a = math.radians(ax)
            best = None
            for cy, cz in CONTACTS:
                _, qy, qz = to_root((CX, cy, cz))
                ry, rz = qy * math.cos(a) - qz * math.sin(a), qy * math.sin(a) + qz * math.cos(a)
                if best is None or ry < best[0]:
                    best = (ry, qy - ry, qz - rz)
            rot.append((fr * f, (ax, 0, 0)))
            loc.append((fr * f, (ex, best[1] + ey, best[2] + ez)))
        return rot, loc

    def wings(rows):
        """wing-l keys as (frame, x, y, z); wing-r mirrors them."""
        return ({"rot": keys(*[(fr * f, x, y, z) for fr, x, y, z in rows])},
                {"rot": keys(*[(fr * f, x, -y, -z) for fr, x, y, z in rows])})

    def fk(*rows):
        return [(fr * f, tuple(v)) for fr, *v in rows]

    idle = {
        "wing-l": {"rot": keys((0, 0, 0, 0), (0.8, 0, 0, -8), (1.6, 0, 0, 0))},
        "wing-r": {"rot": keys((0, 0, 0, 0), (0.8, 0, 0, 8), (1.6, 0, 0, 0))},
        "head": {"rot": keys((0, 0, 0, 0), (0.4, 4, 8, 0), (0.8, -2, 0, 0), (1.2, 4, -8, 0), (1.6, 0, 0, 0))},
        "tail": {"rot": keys((0, 0, 0, 0), (0.8, -4, 0, 3), (1.6, 0, 0, 0))},
    }
    # attack, the peck ("blah"): it rears back on its heels and coils the
    # neck back with the beak up and the wings cocked high (f0-11), still
    # creeping back through the coil (f11-13), then leans in on its claws
    # and thrusts the neck straight out at you in 3 frames, beak level,
    # onto the bite (impact f16); it overshoots past it (f18) and snaps and
    # shakes the beak there (f18-24) while the wings beat forward and the
    # tail lashes, then recoils back up past rest and settles, the tail last.
    IMP = 16 * f
    rot, loc = on_feet([(0, 0, (0, 0, 0)), (6, 9, (0, 0, 0)), (11, 14, (0, 0, 0)), (13, 15, (0, 0, 0)), (16, -9, (0, 0, 0)), (18, -12, (0, 0, 0)),
                        (22, -8, (0, 0, 0)), (27, 5, (0, 0, 0)), (33, -2, (0, 0, 0)), (40, 0, (0, 0, 0))])
    wl, wr = wings([(0, 0, 0, 0), (6, 0, 10, -36), (13, 0, 16, -48), (16, 0, -24, 30), (19, 0, -30, 38), (23, 0, -12, 14), (28, 0, 8, -20), (34, 0, -2, 6),
                    (40, 0, 0, 0)])
    attack = {
        "body": {"rot": keys(*[(t, *v) for t, v in rot]), "loc": keys(*[(t, *v) for t, v in loc]),
                 "scale": fk((0, 1, 1, 1), (11, 1.03, 0.97, 1.0), (16, 0.97, 1.03, 1.0), (19, 0.98, 1.02, 1.0), (26, 1.01, 0.99, 1.0), (34, 1, 1, 1))},
        # the neck: coiled back (beak up), thrust out and down at you, the
        # neck stretched long on the bite, the beak snapping side to side
        "head": {"rot": fk((0, 0, 0, 0), (6, 24, 0, 0), (11, 34, 0, 0), (13, 37, 0, 0), (16, -44, 0, 0), (18, -52, 10, 5), (20, -42, -10, -5),
                           (22, -49, 7, 3), (24, -40, -3, 0), (28, 16, 0, 0), (33, -6, 0, 0), (40, 0, 0, 0)),
                 "loc": fk((0, 0, 0, 0), (6, 0, 1.0, 2.0), (11, 0, 1.5, 3.0), (13, 0, 1.6, 3.4), (16, 0, 0, -4.5), (18, 0, -0.3, -6.5), (20, 0, 0, -5.0),
                           (22, 0, -0.2, -5.6), (24, 0, 0, -4.0), (28, 0, 0.6, 1.6), (33, 0, 0, -0.4), (40, 0, 0, 0)),
                 "scale": fk((0, 1, 1, 1), (11, 1.02, 0.94, 1.02), (13, 1.02, 0.93, 1.02), (16, 0.95, 1.16, 0.97), (18, 0.94, 1.2, 0.96), (21, 0.97, 1.1, 0.98),
                             (24, 0.98, 1.06, 1.0), (28, 1.02, 0.95, 1.0), (34, 1, 1, 1))},
        "tail": {"rot": fk((0, 0, 0, 0), (7, -12, 0, 0), (13, -14, 0, 0), (17, 6, 0, 0), (20, 18, 0, 6), (24, 10, 0, -5), (29, -12, 0, 2), (36, 4, 0, 0),
                           (44, 0, 0, 0))},
        "wing-l": wl, "wing-r": wr,
    }
    # hit: the blow lands on frame 0: by frame 1 it is already flying back,
    # tipped back with the head whipped up and back and the wings flung
    # open, popped up off its feet (the peak at f4), it lands a hop back on
    # its heels with a squash (f8), skids back a little further (a moving
    # beat), then crouches and hops home with a flap, landing forward past
    # rest (f21) and rocking back to settle; the head and the tail last.
    rot, loc = on_feet([(0, 0, (0, 0, 0)), (1, 13, (0, 1.5, 3.2)), (4, 22, (0, 4.1, 6.2)), (8, 11, (0, 0, 7.2)), (12, 8, (0, 0, 7.9)), (15, 5, (0, 0, 7.4)),
                        (18, -5, (0, 2.2, 3.6)), (21, -9, (0, 0, -0.5)), (25, 3, (0, 0, 0)), (30, 0, (0, 0, 0))])
    wl, wr = wings([(0, 0, 0, 0), (1, 0, -20, -40), (4, 0, -26, -60), (8, 0, -6, 26), (11, 0, 4, 10), (15, 0, 6, -44), (18, 0, -4, 34), (22, 0, 0, -10),
                    (27, 0, 0, 4), (32, 0, 0, 0)])
    hit = {
        "body": {"loc": keys(*[(t, *v) for t, v in loc]), "rot": keys(*[(t, *v) for t, v in rot]),
                 "scale": fk((0, 1, 1, 1), (1, 1.04, 0.98, 0.92), (4, 0.97, 1.05, 1.0), (8, 1.08, 0.88, 1.0), (11, 1, 1, 1), (15, 1.04, 0.94, 1.0),
                             (18, 0.97, 1.04, 1.0), (21, 1.06, 0.92, 1.0), (24, 1, 1, 1), (30, 1, 1, 1))},
        "head": {"rot": fk((0, 0, 0, 0), (1, 30, 10, 6), (4, 42, 14, 8), (8, 14, 6, 2), (10, 22, 6, 3), (14, 8, 0, 0), (18, -12, 0, 0), (21, -18, -4, 0),
                           (26, 6, 0, 0), (32, 0, 0, 0)),
                 "loc": fk((0, 0, 0, 0), (1, 0, 0.5, 1.5), (4, 0, 0.8, 2.2), (9, 0, 0, 0.5), (14, 0, 0, 0), (32, 0, 0, 0))},
        "tail": {"rot": fk((0, 0, 0, 0), (1, -20, 0, 0), (4, -28, 0, 0), (8, 22, 0, 4), (13, -8, 0, 0), (18, -14, 0, 0), (21, 16, 0, -3), (27, -4, 0, 0),
                           (34, 0, 0, 0))},
        "wing-l": wl, "wing-r": wr,
    }
    # death: the blow rocks it back, it struggles up with three big frantic
    # wingbeats (the head thrashing, the tail fanning), the last one fails
    # and it stalls, then drops over backwards (away from the attacker)
    # with gravity onto its back (impact, a squash), one small bounce and a
    # hard settle; the wings slap the floor late, the neck flops back and
    # lolls, the tail flops to the side. The lying root is keyed AT the
    # floor (REST_LIFT: how far the lying pose would sink).
    # the wings swing down to lie spread on the floor beside it (a droop
    # about the body's long axis) and are nearly there as it lands, then
    # slap down and flop a little; the tail folds down past the feet to lie
    # flat; the neck tips back onto the floor
    wl = WING_LAND
    wing_after = [(-8, (0, 12, -30)), (-3, (0, wl[1] - 18, wl[2] - 8)), (0, (0, wl[1] - 12, wl[2])), (2, (0, wl[1] - 3, wl[2])), (5, wl), (24, wl)]
    death, LAND = flap_fall("body", rest_loc=(0, REST_LIFT, 3.0), rest_rot=(90, 4, 0), k=1.1, apex=13.0, bounce=1.0, head="head", body=None,
                            legs=None, tail="tail", wing_land=wl, head_land=HEAD_LAND, tail_land=TAIL_LAND, wing_after=wing_after,
                            impact_drop=0.66)
    # the tail's root sticks out past its back: tuck it in (toward the
    # belly) as it lands so the back, not the tail, takes the floor
    land_f = round(LAND * 30)
    # after the landing the loose parts only settle DOWN onto the floor (no
    # second hump): the neck is nearly back on the floor as the body lands,
    # the tail drops onto it from above
    hx, hy, hz = HEAD_LAND
    death["head"]["rot"] = [(t, v) for t, v in death["head"]["rot"] if t * 30 < land_f - 6] + [
        ((land_f - 3) * f, (0, hy * 0.5, 0)), (land_f * f, (hx + 1.0, hy, hz)), ((land_f + 2) * f, (hx + 0.5, hy, hz)), ((land_f + 4) * f, HEAD_LAND),
        ((land_f + 30) * f, HEAD_LAND)]
    tx = TAIL_LAND[0]
    death["tail"]["rot"] = [(t, v) for t, v in death["tail"]["rot"] if t * 30 < land_f - 6] + [
        ((land_f - 3) * f, (-60, 0, 0)), ((land_f + 1) * f, (tx - 10, 0, 0)), ((land_f + 4) * f, TAIL_LAND), ((land_f + 30) * f, TAIL_LAND)]
    death["tail"]["loc"] = [(0, (0, 0, 0)), ((land_f - 4) * f, (0, 0, 0)), (land_f * f, (0, 0, -TAIL_TUCK)), ((land_f + 30) * f, (0, 0, -TAIL_TUCK))]
    return asset(
        "creatures", "phoenix", "Phoenix", root,
        clips=[Clip("idle", idle), Clip("attack", attack, loop=False, impact=IMP),
               Clip("hit", hit, loop=False), Clip("death", death, loop=False, impact=LAND),
               Clip("move", fly_move(), ease=0.0, floor=False)],
        sockets=[Socket("socket-function", at=to_root((CX, 53, 11)), parent="head")],
        fx=[pfx("rvx-fantasy-dragon-breath", "socket-function",
                "clip:attack", size=20, aim=(0.0, -0.243, -0.97), at=IMP)],
    )
