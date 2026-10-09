"""Oil pumpjack, in the Pirate Nation style.

A nodding donkey at well scale: a tapered lattice Samson post (true slopes
throughout, rule F2) on a steel skid and a low grey well pad carries a fat
walking beam. The oversized function prop (rules F4, K1) is the horsehead,
a blocky curved head that hangs its bridle over the polished rod. Two
counterweight cranks turn on the gearbox, the pitman arms ride the crank
pins, and a diesel motor with a tall exhaust stack sits at the tail. A
hazard-striped skirt, a KEEP OUT board, rust and plates are paint (S1).
Clips: idle (the pump ticks over), active (it pumps hard). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, keys, lattice, make, side
from _rep_anim import concrete_pad
from pnkit import box, edges
from voxgrid import Clip, Grid

SZ = (28, 68, 92)
CX = 14.0
G0 = 1  # the ground in the build frame: the parts above keep their old heights
PIVOT = (CX, 50.0, 46.0)  # the beam saddle on the Samson post
CRANK = (CX, 18.0, 72.0)  # the crank centre
PIN_R = 7.0
PIN = (CX, CRANK[1], CRANK[2] + PIN_R)  # the crank pin at rest: level with the shaft
ROD = (CX, 20.0, 10.0)
TAIL = (-2.0, 32.0)  # the pitman joint, offset from the saddle (y, z)
FRONT = (-24.5, -36.5)  # the carrier bar, offset from the saddle (y, z)
REST = math.atan2(PIVOT[2] + TAIL[1] - PIN[2], PIVOT[1] + TAIL[0] - PIN[1])  # the pitman at rest


def base() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    # A grey poured well pad, 2 voxels high (no sand plinth), with an oil spill.
    pad = concrete_pad(g, 1, 2, 27, 90, y0=G0, h=2, chamfer=2, seed=1)
    P.flat(g, pad & (Y > 2) & (np.hypot(X - 18, (Z - 60) * 0.8) < 6), "iron", 3)  # an oil spill
    P.flat(g, pad & (Y > 2) & (np.hypot(X - 18, (Z - 60) * 0.8) < 3.5), "iron", 2)

    skids = np.zeros(g.shape, dtype=bool)
    for sx in (4, 20):
        skids |= box(g, sx, 3, 6, sx + 4, 7, 88, "steel", 4)
    P.plates(g, skids, "steel", 4, size=(12, 4), rivets=True, seed=2)
    P.flat(g, edges(skids), "steel", 2)

    # ---- the Samson post: a tapered four-leg lattice with X braces
    post = lattice(g, CX, 46.0, 7, 48, 8.5, 3.2, (16, 30), leg=1.9, brace=1.0, ramp="steel", shade=4)
    PP.blotch(g, post, "rust", 5, cell=4, chance=0.07, seed=3)
    cap = box(g, 9, 48, 41, 19, 50, 51, "steel", 5)
    P.flat(g, edges(cap), "steel", 3)
    for bx in (9, 17):  # the saddle bearing blocks
        bb = box(g, bx, 50, 43, bx + 2, 53, 49, "steel", 5)
        P.flat(g, edges(bb), "steel", 3)

    # ---- the wellhead under the horsehead: flanges, a gold valve wheel
    head = np.zeros(g.shape, dtype=bool)
    for y0, r in ((3, 5.0), (8, 4.0), (13, 4.6)):
        head |= S.disc(g, "y", CX, 10.0, r, y0, y0 + 5, "steel", 4, n=8)
    P.flat(g, head, "steel", 4)
    P.flat(g, head & (np.floor(Y) % 5 == 0), "steel", 2)
    wheel = S.disc(g, "x", 12.0, 16.5, 4.0, CX + 4, CX + 6, "red", 4, n=8)
    P.flat(g, wheel & (S.ngon_radius(g, "x", 12.0, 16.5, 8) < 2.4), "red", 6)
    S.bar(g, "x", (12.0, 10.0), (12.0, 16.5), 1.4, CX + 4, CX + 6, "steel", 5)
    PP.blotch(g, head, "rust", 5, cell=3, chance=0.08, seed=4)

    # ---- the gearbox and the diesel motor with a tall exhaust stack
    gear = box(g, 6, 7, 64, 22, 20, 80, "steel", 4)
    P.plates(g, gear, "steel", 4, size=(8, 6), rivets=True, seed=5)
    P.flat(g, edges(gear), "steel", 2)
    PP.hazard(g, gear & (Y < 10), period=6, a=("gold", 5), b=("darkwood", 3))
    motor = box(g, 7, 7, 80, 21, 22, 89, "rust", 5)
    P.plates(g, motor, "rust", 5, size=(7, 5), seed=6)
    P.flat(g, edges(motor), "rust", 3)
    for fy in range(9, 21, 3):  # cooling fins
        P.flat(g, motor & (np.abs(Y - fy) < 0.6), "rust", 3)
    stack = S.disc(g, "y", 9.5, 84.5, 2.2, 22, 34, "steel", 4, n=8)
    P.flat(g, stack & (np.floor(Y) % 5 == 0), "steel", 3)
    P.flat(g, stack & (Y > 31), "darkwood", 3)
    S.disc(g, "y", 9.5, 84.5, 3.4, 34, 35.5, "steel", 5, n=8)
    pulley = S.disc(g, "x", 13.0, 80.0, 5.0, 4, 6, "steel", 5, n=8)
    P.flat(g, pulley & (S.ngon_radius(g, "x", 13.0, 80.0, 8) > 3.8), "steel", 3)

    # ---- a KEEP OUT board bolted on the post, and a ladder
    sgn = box(g, 7, 20, 32, 21, 30, 34, "gold", 5)
    P.flat(g, edges(sgn), "darkwood", 3)
    pnglyph.text(g, "+z", 34, 9, 26, "KEEP", "darkwood", 3)
    pnglyph.text(g, "+z", 34, 9, 21, "OUT", "darkwood", 3)
    for ry in range(10, 44, 4):
        box(g, 20, ry, 44, 24, ry + 1, 48, "steel", 5)
    for rz in (44, 47):
        box(g, 22, 8, rz, 23, 46, rz + 1, "steel", 4)
    return g


def beam() -> Grid:
    """The walking beam and its horsehead, hung on the saddle."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    web = box(g, 11, 47, 16, 17, 54, 80, "steel", 5)
    P.plates(g, web, "steel", 5, size=(10, 5), rivets=True, seed=7)
    P.flat(g, edges(web), "steel", 3)
    for hz in range(20, 78, 9):  # lightening holes painted down the web
        P.flat(g, web & ((X < 12) | (X > 16)) & (np.hypot(Z - hz, (Y - 50.5) * 1.6) < 2.2), "steel", 2)
    P.flat(g, web & (Y > 53), "steel", 6)
    # the horsehead: one chunky curved prism (true slopes)
    pts = [(54, 20), (54, 6), (49, 2), (41, 2), (35, 8), (35, 15), (41, 19), (47, 20)]
    head = side(g, pts, 9, 19, "steel", 4)
    P.plates(g, head, "steel", 4, size=(7, 7), rivets=True, seed=8)
    P.flat(g, edges(head), "steel", 2)
    P.flat(g, head & (Z < 9) & (Y < 44), "gold", 5)  # the polished face of the head
    PP.blotch(g, head, "rust", 5, cell=4, chance=0.06, seed=9)
    for bx in (11, 16):  # the bridle straps hanging to the rod
        S.bar(g, "x", (36.0, 5.0), (26.0, 9.0), 1.3, bx, bx + 1, "steel", 3)
    box(g, 11, 24, 7, 17, 27, 12, "steel", 5)  # the carrier bar
    # the counterweight box on the tail
    cw = box(g, 9, 44, 74, 19, 56, 82, "rust", 4)
    P.plates(g, cw, "rust", 4, size=(6, 6), seed=10)
    P.flat(g, edges(cw), "rust", 2)
    return g


def crank() -> Grid:
    """Two counterweight cranks on the gearbox shaft, joined by the pin."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    for cx in (3, 21):
        disc = S.disc(g, "x", CRANK[1], CRANK[2], 10.0, cx, cx + 4, "steel", 4, n=10)
        d = S.ngon_radius(g, "x", CRANK[1], CRANK[2], 10)
        P.flat(g, disc & (d > 8.6), "steel", 3)
        P.flat(g, disc & (d < 3.0), "gold", 5)
        lobe = S.disc(g, "x", CRANK[1], CRANK[2] - 5.5, 6.5, cx - 1, cx + 5, "rust", 4, n=8)
        P.flat(g, lobe, "rust", 4)
        P.flat(g, edges(lobe), "rust", 2)
    S.disc(g, "x", PIN[1], PIN[2], 2.2, 3, 25, "steel", 5, n=8)
    P.flat(g, S.last(g) & ((X < 6) | (X > 22)), "steel", 6)
    return g


def pitman() -> Grid:
    """Two pitman arms from the crank pins up to the beam tail."""
    g = Grid(*SZ)
    for bx in (7, 18):
        arm = S.bar(g, "x", (PIN[1], PIN[2]), (48.0, 78.0), 3.2, bx, bx + 3, "steel", 4)
        P.flat(g, edges(arm), "steel", 2)
        S.disc(g, "x", PIN[1], PIN[2], 3.0, bx, bx + 3, "steel", 5, n=8)
        S.disc(g, "x", 48.0, 78.0, 3.0, bx, bx + 3, "steel", 5, n=8)
    return g


def rod() -> Grid:
    """The polished rod and its stuffing box, lifted by the bridle."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    r = S.disc(g, "y", ROD[0], ROD[2], 1.6, 14, 30, "bone", 6, n=6)
    P.flat(g, r & (np.floor(Y) % 4 == 0), "bone", 4)
    clamp = box(g, 11, 26, 7, 17, 29, 13, "steel", 5)
    P.flat(g, edges(clamp), "steel", 3)
    return g


def build():
    rig = Rig("oil-pumpjack", (CX, G0, 46), base())
    rig.add("beam", beam(), PIVOT)
    rig.add("crank", crank(), CRANK)
    rig.add("pitman", pitman(), PIN, parent="crank")
    rig.add("rod", rod(), ROD)

    def cycle(seconds: float, steps: int = 16) -> dict:
        """One crank turn: the beam rocks with it, the pitman arms keep
        their ends on the crank pin and the beam tail, and the polished rod
        follows the horsehead. Every channel closes on the loop."""
        ck, pk, bk, rk = [], [], [], []
        for i in range(steps + 1):
            t = seconds * i / steps
            th = 2 * math.pi * i / steps
            deg = 360.0 * i / steps
            b = math.asin(PIN_R / TAIL[1] * math.sin(th))  # the tail follows the pin
            beta = math.degrees(b)
            pin_y = CRANK[1] - PIN_R * math.sin(th)
            pin_z = CRANK[2] + PIN_R * math.cos(th)
            tail_y = PIVOT[1] + TAIL[0] * math.cos(b) - TAIL[1] * math.sin(b)
            tail_z = PIVOT[2] + TAIL[0] * math.sin(b) + TAIL[1] * math.cos(b)
            ck.append((t, (deg, 0.0, 0.0)))
            pk.append((t, (math.degrees(math.atan2(tail_z - pin_z, tail_y - pin_y) - REST) - deg, 0.0, 0.0)))
            bk.append((t, (beta, 0.0, 0.0)))
            rk.append((t, (0.0, FRONT[0] * (math.cos(b) - 1.0) - FRONT[1] * math.sin(b), 0.0)))
        return {"crank": {"rot": keys(*ck)}, "pitman": {"rot": keys(*pk)},
                "beam": {"rot": keys(*bk)}, "rod": {"loc": keys(*rk)}}

    return make("animated-props", "oil-pumpjack", "Oil Pumpjack", rig.root,
                clips=[Clip("idle", cycle(4.8)), Clip("active", cycle(1.8))],
                sockets=[rig.socket("socket-exhaust", (9.5, 36.0, 84.5)), rig.socket("socket-head", (CX, 34.0, 6.0), parent="beam")],
                pfx=[fx("rvx-apocalypse-exhaust-smoke", "socket-exhaust", "clip:active", size=18),
                     fx("rvx-apocalypse-exhaust-smoke", "socket-exhaust", "idle", size=12)])
