"""Dead traffic light, in the Pirate Nation style.

One iconic shape (rule K3), taller than a lamp post: a cracked concrete
footing and a bolted base flange carry a tapered steel mast (a true
frustum, rule F2) whose bent arm reaches out over the road in angled
segments (rule F5). The oversized function prop (rules F4, K1) is the
signal head on the arm end: a fat hazard-yellow housing in a dark steel
frame under a deep hood, its face split into three painted sockets that
hold square stepped lenses in signal red, amber and green. One control
cabinet on the mast, one hazard band at the kerb, a cable that runs from
the arm into the cabinet, a crooked NO ENTRY octagon, a toppled cone,
rubble and weeds finish it. Rust bands and streaks, the lens sockets and
the glyphs are paint (rule S1). Clips: idle (the head swings and the dead
amber stutters), active (the signal still cycles red, green, amber).
Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, keys, limb, make, plan, tuft
from pnkit import box, edges
from voxgrid import C, Clip, Grid

SZ = (48, 60, 26)
PX, PZ = 8.0, 13.0  # the mast centre
POLE_TOP = 47
ARM = (34.0, 51.0, PZ)  # the arm end, where the head hangs
HEAD = (34.0, 44.0, PZ)  # the head hinge under the arm end
HX0, HX1, HY0, HY1, HZ0, HZ1 = 27, 41, 15, 43, 9, 18  # the signal housing
# one cell per lamp, 9 tall: the socket is painted, the lens is a part
LENS = ((37.5, "red", 4), (28.5, "ember", 3), (19.5, "toxic", 3))
CELL = 4.0  # half the painted socket square
LCX = 34.0  # the lens centre across x
CAB = (2, 15, 7, 11, 28, 12)  # the control cabinet on the mast
OFF = (0.001, 0.001, 0.001)
ON = (1.0, 1.0, 1.0)


def mast() -> Grid:
    """The footing, the bolted flange, the tapered mast, the bent arm, one
    control cabinet and the props at the kerb."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)

    def band(m, y0, y1, streaks=()):
        """One deliberate rust band, with a few streaks bleeding down the
        front of the member it sits on (rule S3: no scatter)."""
        P.flat(g, m & (Y >= y0) & (Y < y1), "rust", 5)
        P.flat(g, m & (Y >= y0 + 0.8) & (Y < y1 - 0.8), "rust", 4)
        for cz, w, h in streaks:
            run = m & (np.abs(Z - cz) < w) & (Y < y0) & (Y > y0 - h)
            P.flat(g, run, "rust", 5)
            P.flat(g, run & (Y > y0 - h * 0.45), "rust", 4)

    # ---- a cracked concrete footing with four hold-down bolts
    foot = plan(g, S.flat_ngon(PX, PZ, 6.4, 8), 0, 5, "sand", 5, top=S.flat_ngon(PX, PZ, 5.0, 8))
    PP.concrete(g, foot, "sand", 5, size=8, cracks=3, seed=1)
    P.flat(g, foot & (Y > 4), "sand", 6)
    P.outline(g, foot, "sand", 3, normal="y")
    for a in range(4):
        bx, bz = PX + 4.4 * np.cos(np.pi / 4 + a * np.pi / 2), PZ + 4.4 * np.sin(np.pi / 4 + a * np.pi / 2)
        P.flat(g, foot & (np.hypot(X - bx, Z - bz) < 1.0) & (Y > 4), "steel", 6)

    # ---- the base flange: one tapered collar, the pack's single hazard band
    flange = plan(g, S.flat_ngon(PX, PZ, 4.2, 8), 5, 14, "steel", 4, top=S.flat_ngon(PX, PZ, 3.1, 8))
    for m, fr in S.facets(g, [g.solids[-1]]):
        P.plates(g, m, "steel", 4, size=(5, 9), rivets=False, frame=fr, seed=2)
    PP.hazard(g, flange & (Y > 6) & (Y < 11), period=4, a=("gold", 5), b=("darkwood", 3))
    P.flat(g, flange & (Y > 12.6), "steel", 5)  # the lit top chamfer of the flange
    for a in range(4):  # the flange bolts, painted
        bx, bz = PX + 3.5 * np.cos(np.pi / 4 + a * np.pi / 2), PZ + 3.5 * np.sin(np.pi / 4 + a * np.pi / 2)
        P.flat(g, flange & (np.hypot(X - bx, Z - bz) < 1.2) & (Y > 5) & (Y < 6.5), "steel", 6)

    # ---- the mast: one tapered octagonal frustum (true slopes)
    pole = plan(g, S.flat_ngon(PX, PZ, 2.9, 8), 13, POLE_TOP, "steel", 5, top=S.flat_ngon(PX, PZ, 2.1, 8))
    P.flat(g, pole & (Z < PZ - 1.4), "steel", 6)  # the lit front of the mast
    for cy in (30.0, 41.0):  # two joint collars, each with its own rust band
        P.flat(g, pole & (np.abs(Y - cy) < 1.2), "steel", 3)
    band(pole, 14.0, 17.5, streaks=())  # weather climbing out of the flange
    band(pole, 29.0, 32.0, streaks=((PZ - 2.4, 1.6, 8.0), (PZ + 2.4, 1.4, 5.0)))
    band(pole, 40.0, 42.5, streaks=((PZ - 2.0, 1.3, 6.0),))

    # ---- the bent arm: three angled segments out over the road (rule F5)
    arm = limb(g, (PX, POLE_TOP - 4, PZ), (PX + 7, POLE_TOP + 5, PZ), 2.0, 1.8, "steel", 5, n=6)
    arm |= limb(g, (PX + 6.5, POLE_TOP + 4.5, PZ), (20.0, POLE_TOP + 7.0, PZ), 1.8, 1.7, "steel", 5, n=6)
    arm |= limb(g, (19.5, POLE_TOP + 7.0, PZ), (ARM[0] + 1.5, ARM[1], PZ), 1.7, 1.6, "steel", 5, n=6)
    P.flat(g, arm & (Y > POLE_TOP + 6), "steel", 6)
    P.flat(g, arm & (Y < POLE_TOP + 2), "steel", 3)
    P.flat(g, arm & (X > 13) & (X < 17), "rust", 5)  # one rust band at the elbow
    P.flat(g, arm & (X > 14) & (X < 16), "rust", 4)
    for gx in (14.0, 22.0, 30.0):  # gusset plates under the arm
        S.bar(g, "x", (POLE_TOP + 3.5, PZ - 1.6), (POLE_TOP + 5.5, PZ + 1.6), 1.4, gx, gx + 2, "steel", 3)
    # the hanger yoke the head swings on
    yoke = box(g, int(ARM[0]) - 3, int(ARM[1]) - 7, int(PZ) - 3, int(ARM[0]) + 3, int(ARM[1]) + 2, int(PZ) + 3, "steel", 4)
    P.plates(g, yoke, "steel", 4, size=(6, 6), rivets=True, seed=3)
    P.flat(g, edges(yoke), "steel", 2)

    # ---- one control cabinet on the mast: a framed door, hinges and a latch
    cx0, cy0, cz0, cx1, cy1, cz1 = CAB
    cab = box(g, cx0, cy0, cz0, cx1, cy1, cz1, "steel", 5)
    P.plates(g, cab, "steel", 5, size=(9, 6), rivets=True, seed=4)
    P.flat(g, edges(cab), "steel", 2)
    door = cab & (Z < cz0 + 1) & (X > cx0 + 1) & (X < cx1 - 1) & (Y > cy0 + 1) & (Y < cy1 - 1)
    P.flat(g, door, "steel", 6)
    P.outline(g, door, "steel", 3, normal="z")
    for hy in (cy0 + 3, cy1 - 4):  # the hinges down the -x edge
        P.flat(g, cab & (Z < cz0 + 1) & (X < cx0 + 2.2) & (np.abs(Y - hy) < 1.1), "steel", 3)
    P.flat(g, cab & (Z < cz0 + 1) & (X > cx1 - 3.2) & (X < cx1 - 1.4) & (np.abs(Y - (cy0 + cy1) / 2) < 1.6), "gold", 5)  # the latch
    G.stamp(g, "-z", cz0, cx0 + 2, cy1 - 4, ["#.#", ".#.", "#.#"], {"#": C("gold", 6)}, depth=2)  # the voltage label
    P.flat(g, cab & (Y > cy1 - 1.4), "steel", 6)  # the lit lid
    P.flat(g, cab & (Y > cy1 - 1) & (X > cx0 + 1) & (X < cx1 - 1) & (Z > cz0 + 1), "steel", 4)
    band(cab, cy0, cy0 + 2.0, streaks=())

    # ---- the cable: anchored at the arm, down the mast, into the cabinet lid
    cable = limb(g, (PX + 6.5, POLE_TOP + 4.0, PZ - 1.0), (10.2, 43.0, PZ - 3.6), 0.9, 0.9, "darkwood", 2, n=4)
    cable |= limb(g, (10.2, 43.5, PZ - 3.6), (8.2, 31.0, PZ - 4.2), 0.9, 0.9, "darkwood", 2, n=4)
    cable |= limb(g, (8.2, 31.5, PZ - 4.2), (6.6, 27.6, PZ - 4.0), 0.9, 0.9, "darkwood", 2, n=4)
    P.flat(g, cable & (Z < PZ - 4.4), "darkwood", 3)
    for cy, cz in ((43.0, PZ - 3.2), (33.0, PZ - 4.0)):  # the P-clips that hold it to the mast
        box(g, 6.6, cy - 1, cz - 0.6, 10.4, cy + 1, PZ - 1.6, "steel", 3)
    box(g, 5.6, cy1 - 1, PZ - 5.2, 7.6, cy1 + 1.4, PZ - 2.8, "steel", 3)  # the gland on the lid

    # ---- small props at the foot: a toppled cone, rubble and weeds
    cone = S.cone(g, "z", 19.0, 3.2, 3.0, 2, 12, "red", 5, n=6, r_top=0.8, tip="lo")
    P.flat(g, cone & (Z > 4) & (Z < 7), "bone", 7)
    P.flat(g, cone & (Y < 2), "red", 3)
    box(g, 15, 0, 11, 23, 2, 13, "red", 4)  # its base plate, flat on the ground
    for k, (rx, rz, rr) in enumerate(((22.0, 19.0, 2.4), (2.6, 19.0, 2.0))):
        chunk = plan(g, S.flat_ngon(rx, rz, rr, 6), 0, 3 + k, "sand", 4, top=S.flat_ngon(rx + 0.5, rz, rr * 0.7, 6))
        P.flat(g, chunk & (Y > 2), "sand", 5)
    for k, (tx, tz) in enumerate(((2.5, 7.5), (16.5, 19.5), (12.5, 2.5))):
        tuft(g, tx, tz, 0, 5, blades=4, spread=2.4, ramp="khaki", shade=5, seed=10 + k)
    return g


def housing() -> Grid:
    """The signal head: a fat yellow box in a dark steel frame under a deep
    hood, its face split into three painted lens sockets, finished behind."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    shell = box(g, HX0, HY0, HZ0, HX1, HY1, HZ1, "gold", 6)
    box(g, 32, 42, 11, 36, 46, 16, "steel", 4)
    P.plates(g, shell, "gold", 6, size=(13, 9), rivets=True, seed=7)
    P.flat(g, shell & (Y < HY0 + 2), "gold", 4)
    P.flat(g, shell & (Y > HY1 - 1.4), "gold", 7)

    # ---- the back of the housing: framed plates, a boss, a plate and rust
    back = shell & (Z > HZ1 - 1)
    P.plates(g, back, "gold", 5, size=(6, 9), rivets=True, frame="z", seed=8)
    P.outline(g, back, "darkwood", 3, normal="z")
    for px in (HX0 + 4, HX1 - 5):  # a dark pilaster each side of the back
        P.flat(g, back & (np.abs(X - px) < 1.0), "gold", 4)
    P.flat(g, back & (np.abs(X - LCX) < 4.0) & (Y > HY1 - 10) & (Y < HY1 - 4), "steel", 3)  # the mounting boss
    P.outline(g, back & (np.abs(X - LCX) < 4.0) & (Y > HY1 - 10) & (Y < HY1 - 4), "steel", 5, normal="z")
    P.flat(g, back & (np.abs(X - LCX) < 7.0) & (Y > HY0 + 2) & (Y < HY0 + 11), "gold", 7)  # the stencil plate
    P.outline(g, back & (np.abs(X - LCX) < 7.0) & (Y > HY0 + 2) & (Y < HY0 + 11), "darkwood", 3, normal="z")
    G.text(g, "+z", HZ1 - 1, HX0 + 2, HY0 + 4, "72", "darkwood", 2)
    for ry in (HY1 - 2.0, HY1 - 13.0):  # two rust runs down the back
        run = back & (np.abs(X - (LCX + (6.0 if ry > 32 else -6.0))) < 1.6) & (Y < ry) & (Y > ry - 7)
        P.flat(g, run, "rust", 5)
        P.flat(g, run & (Y > ry - 3), "rust", 4)

    # ---- the steel frame: posts, sill, cell ribs (rules F3, S4)
    frame = box(g, HX0, HY0, HZ0 - 2, HX0 + 2, HY1, HZ0, "steel", 4)
    frame |= box(g, HX1 - 2, HY0, HZ0 - 2, HX1, HY1, HZ0, "steel", 4)
    frame |= box(g, HX0, HY0, HZ0 - 2, HX1, HY0 + 2, HZ0, "steel", 4)
    for cy in (23.5, 32.5):  # the ribs between the lamp cells
        frame |= box(g, HX0, cy, HZ0 - 1.5, HX1, cy + 1.0, HZ0, "steel", 4)
    P.flat(g, frame & (Z < HZ0 - 1.4), "steel", 5)
    P.flat(g, frame & (Y > HY1 - 0.6), "steel", 6)
    P.outline(g, frame, "steel", 3, normal="z")
    for by in (HY0 + 4, 28.0, HY1 - 4):  # the frame bolts
        for bx in (HX0 + 1, HX1 - 2):
            P.flat(g, frame & (Z < HZ0 - 1.4) & (np.abs(X - bx - 0.5) < 0.6) & (np.abs(Y - by) < 0.6), "steel", 7)

    # ---- the hood: a wedge on side cheeks, tied into the frame (rule F2)
    g.prism("x", [(HY1, HZ0), (HY1, HZ0 - 6), (HY1 - 4, HZ0)], HX0, HX1, C("steel", 5))
    hood = S.last(g)
    P.flat(g, hood & (Y > HY1 - 1), "steel", 6)
    for cheek in (HX0, HX1 - 2):  # the cheeks that carry the hood down the frame
        g.prism("x", [(HY1 - 3.5, HZ0), (HY1 - 3.5, HZ0 - 4.5), (HY1 - 10, HZ0)], cheek, cheek + 2, C("steel", 4))
        hood |= S.last(g)
    P.outline(g, hood, "steel", 3, normal="z")

    # ---- the sides of the housing: the cell ribs carry round (rule S4)
    flank = shell & ((X < HX0 + 1) | (X > HX1 - 1))
    P.flat(g, flank & ((Z < HZ0 + 1.4) | (Z > HZ1 - 1.4)), "gold", 4)  # the folded front and back edges
    for cy in (23.5, 32.5):
        P.flat(g, flank & (np.abs(Y - cy - 0.5) < 1.0), "gold", 3)
        P.flat(g, flank & (np.abs(Y - cy - 1.8) < 0.5), "gold", 7)
    P.flat(g, flank & (Y > HY1 - 4.5) & (Z < HZ0 + 3.5), "steel", 4)  # the cheek of the hood, from the side

    # ---- the three lens sockets: painted recesses with a bright rim
    for cy, ramp, _shade in LENS:
        face = shell & (Z < HZ0 + 1)
        sq = (np.abs(X - LCX) < CELL + 0.8) & (np.abs(Y - cy) < CELL + 0.8)
        P.flat(g, face & sq, "steel", 5)
        P.flat(g, face & (np.abs(X - LCX) < CELL) & (np.abs(Y - cy) < CELL), "steel", 2)
        P.flat(g, face & sq & (Y > cy + CELL - 0.2), "steel", 7)  # the lit top edge of the socket
        P.flat(g, face & sq & (Y < cy - CELL + 0.2), "steel", 3)
    return g


def lens(cy: float, ramp: str, shade: int) -> Grid:
    """One lit lamp: a square lens stepped out of its socket in two flat
    plates, with a dark rim and a painted hot core."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    outer = box(g, LCX - 3.4, cy - 3.4, HZ0 - 2, LCX + 3.4, cy + 3.4, HZ0 + 1, ramp, shade)
    P.flat(g, outer & (Z < HZ0 - 1.4), ramp, shade)
    P.outline(g, outer, ramp, max(1, shade - 2), normal="z")
    P.flat(g, outer & (Y < cy - 2.6), ramp, max(1, shade - 1))
    inner = box(g, LCX - 2.3, cy - 2.3, HZ0 - 3, LCX + 2.3, cy + 2.3, HZ0 - 1, ramp, min(7, shade + 1))
    P.flat(g, inner & (Z < HZ0 - 2.4), ramp, min(7, shade + 1))
    P.flat(g, inner & (Z < HZ0 - 2.4) & (np.abs(X - LCX) < 1.5) & (np.abs(Y - cy) < 1.5), ramp, min(7, shade + 2))
    P.outline(g, inner, ramp, max(1, shade - 1), normal="z")
    return g


SIGN = (PX + 1.0, 34.0, 6.6)  # the NO ENTRY sign centre on the mast and its flat radius


def plate() -> Grid:
    """The crooked NO ENTRY plate bolted to the mast: a red octagon with a
    bone rim and a fat painted bar; behind it a framed, braced back."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    cx, cy, r = SIGN
    m = S.disc(g, "z", cx, cy, r, PZ - 6, PZ - 4, "red", 5, n=8)
    d = S.ngon_radius(g, "z", cx, cy, 8)
    P.flat(g, m & (d > r - 1.1), "bone", 7)  # the rim
    P.flat(g, m & (d > r - 2.0) & (d < r - 1.0), "red", 3)
    P.flat(g, m & (Y < cy - r + 1.2), "red", 4)  # the shaded bottom facet
    P.flat(g, m & (Z < PZ - 5) & (np.abs(Y - cy) < 1.4) & (d < r - 2.2), "bone", 7)  # the DO NOT ENTER bar
    # the back: a dark panel in a steel frame, with a painted cross brace
    back = m & (Z > PZ - 5)
    P.flat(g, back, "steel", 3)
    P.flat(g, back & (d > r - 1.1), "steel", 5)  # the folded rim, lit
    P.flat(g, back & (d > r - 2.1) & (d < r - 1.0), "steel", 2)
    for sgn in (1, -1):
        P.flat(g, back & (np.abs((Y - cy) - sgn * (X - cx)) < 1.1) & (d < r - 2.2), "steel", 5)  # the brace
    P.flat(g, back & (np.hypot(X - cx, Y - cy) < 1.6), "steel", 6)  # the boss
    for a in range(4):  # the rim rivets
        bx, by = cx + (r - 1.6) * np.cos(np.pi / 4 + a * np.pi / 2), cy + (r - 1.6) * np.sin(np.pi / 4 + a * np.pi / 2)
        P.flat(g, back & (np.hypot(X - bx, Y - by) < 0.9), "steel", 6)
    S.bar(g, "x", (cy - 3, PZ - 4), (cy + 3, PZ - 2), 1.6, cx - 1, cx + 1, "steel", 4)  # its bracket
    run = m & (Z > PZ - 5) & (np.abs(X - (cx + 2.4)) < 1.3) & (Y < cy - 1) & (Y > cy - 5)
    P.flat(g, run, "rust", 5)  # one rust run down the back
    return g


def build():
    rig = Rig("traffic-light", (PX, 0, PZ), mast())
    rig.add("plate", plate(), (SIGN[0], SIGN[1], PZ - 4), rot=(0.0, 0.0, -9.0))
    head = rig.add("head", housing(), HEAD, rot=(5.0, 0.0, 4.0))
    del head
    for name, (cy, ramp, shade) in zip(("lens-red", "lens-amber", "lens-green"), LENS):
        rig.add(name, lens(cy, ramp, shade), (LCX, cy, float(HZ0)), parent="head")

    # ---- idle: the head swings in the wind and the dead amber stutters
    swing = keys((0.0, (0, 0, 0)), (0.9, (0, 0, -3.5)), (1.8, (0, 0, 0)), (2.7, (0, 0, 3.0)), (3.6, (0, 0, 0)))
    stutter = keys((0.0, ON), (0.5, ON), (0.54, OFF), (0.62, OFF), (0.66, ON), (1.3, ON), (1.34, OFF),
                   (1.5, OFF), (1.54, ON), (2.6, ON), (2.64, OFF), (2.72, OFF), (2.76, ON), (3.6, ON))
    dim = keys((0.0, ON), (0.1, OFF), (3.5, OFF), (3.6, ON))
    idle = {"head": {"rot": swing}, "lens-amber": {"scale": stutter},
            "lens-red": {"scale": dim}, "lens-green": {"scale": dim},
            "plate": {"rot": keys((0.0, (0, 0, -9)), (1.8, (0, 0, -7)), (3.6, (0, 0, -9)))}}

    # ---- active: the signal still cycles red, green, amber
    def lamp(spans, total: float = 6.0):
        """Scale keys that hold a lens on over each (t0, t1) span."""
        k = [(0.0, ON if spans[0][0] <= 0.0 else OFF)]
        for t0, t1 in spans:
            if t0 > 0.0:
                k += [(t0 - 0.02, OFF), (t0, ON)]
            k += [(t1, ON), (t1 + 0.02, OFF)]
        k.append((total, ON if spans[0][0] <= 0.0 else OFF))
        return keys(*k)

    active = {"lens-red": {"scale": lamp([(0.0, 2.5)])},
              "lens-green": {"scale": lamp([(2.7, 4.9)])},
              "lens-amber": {"scale": lamp([(5.1, 5.9)])},
              "head": {"rot": keys((0.0, (0, 0, 0)), (1.5, (0, 0, -1.6)), (3.0, (0, 0, 0)), (4.5, (0, 0, 1.4)), (6.0, (0, 0, 0)))}}

    return make("animated-props", "traffic-light", "Dead Traffic Light", rig.root,
                clips=[Clip("idle", idle), Clip("active", active)],
                sockets=[rig.socket("socket-lamp", (LCX, LENS[1][0], float(HZ0) - 4.0), parent="lens-amber")],
                pfx=[fx("rvx-apocalypse-lamp-flicker", "socket-lamp", "idle", size=16)])
