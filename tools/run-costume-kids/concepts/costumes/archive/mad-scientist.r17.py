"""Mad scientist: the kid under a wild explosion of white hair, a huge spiky
puff bursting out in every direction, with big brass goggles (green
lenses) pushed up on the forehead. A long white lab coat with grey lapels,
a pocket of pens and coat tails flaring past the knees, a red bow tie.
A bubbling round flask of green potion (a column of bubbles foaming up
out of the neck) held up in the right mitten, the full bucket in the left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import random
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

R = math.radians
FY = -HEAD * 0.46
SX = TW * 0.5 + 0.08
HAIR, HAIR_D = (0.98, 0.98, 1.0), (0.84, 0.86, 0.92)
COAT, COAT_D, LAPEL, SHIRT = (1.0, 1.0, 1.0), (0.86, 0.88, 0.92), (0.62, 0.66, 0.74), (0.62, 0.82, 0.98)
TIE, PANTS_ = (0.92, 0.16, 0.22), (0.25, 0.25, 0.32)
BRASS, BRASS_D, LENS, LENS_L, STRAP = (0.95, 0.68, 0.22), (0.72, 0.46, 0.14), (0.30, 0.85, 0.55), (0.80, 1.0, 0.85), (0.35, 0.22, 0.14)
GLASS, POTION, POTION_L = (0.82, 0.95, 1.0), (0.45, 0.95, 0.20), (0.75, 1.0, 0.45)
PENS = [(0.2, 0.45, 0.95), (0.95, 0.2, 0.25), (0.15, 0.15, 0.18)]


def bar(p0, p1, r0, r1, rgb, n=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def flask():
    """The flask around its grip (the origin): the mitt holds up the round glass
    bottom of green potion, out to the side; a neck, bubbles foaming up."""
    fx, fyy, fz = 0.38, -0.12, 0.36
    ball(fx, fyy, fz, 0.95, 0.95, 0.9, GLASS, seg=12, ring=8)
    ball(fx, fyy - 0.04, fz - 0.08, 0.88, 0.9, 0.7, POTION, seg=12, ring=7)
    ball(fx - 0.2, fyy - 0.44, fz + 0.15, 0.16, 0.06, 0.2, WHITE, seg=6, ring=4)
    can(fx, fyy, fz + 0.62, 0.15, 0.5, GLASS, n=8)
    can(fx, fyy, fz + 0.88, 0.2, 0.08, GLASS, n=8)
    for x, z, r in ((0.0, 0.98, 0.3), (0.12, 1.2, 0.34), (-0.1, 1.42, 0.3), (0.06, 1.62, 0.2)):
        ball(fx + x, fyy, fz + z, r, r, r, POTION_L if r > 0.22 else POTION, seg=8, ring=5)
    for x, z in ((-0.25, -0.1), (0.2, 0.05), (0.0, 0.18)):
        ball(fx + x, fyy - 0.42, fz + z, 0.12, 0.06, 0.12, POTION_L, seg=6, ring=4)


def build():
    body(shirt=SHIRT, pants=PANTS_, leg_colour=PANTS_, shoe=DARK, arms=False)
    fy = -TD * 0.5
    with part("chest"):
        # the lab coat: closed white, a little blue shirt V and grey lapels at the
        # neck, tails flaring past the knees, a pocket of pens
        box(0, 0.02, HIP + TH * 0.55, TW + 0.12, TD + 0.1, TH * 1.05, COAT, bevel=0.1)
    with part("body"):
        can(0, 0.03, HIP + 0.06, 0.62, 0.3, COAT, n=8, r2=0.68, rot=(R(180), 0, 0))
    with part("chest"):
        fy = -(TD + 0.1) * 0.5
        can(0, fy - 0.0, TOP - 0.2, 0.26, 0.04, SHIRT, n=3, rot=(R(90), 0, R(180)))
        for s in (-1, 1):
            box(s * 0.2, fy - 0.03, TOP - 0.28, 0.16, 0.05, 0.5, LAPEL, rot=(0, R(s * -24), 0))
        box(0, fy - 0.02, HIP + 0.05, 0.03, 0.04, TH * 0.9, COAT_D)  # the coat opening
        box(-0.3, fy - 0.03, HIP + 0.3, 0.28, 0.04, 0.22, COAT_D)
        for k, c in enumerate(PENS):
            limb((-0.38 + k * 0.08, fy - 0.05, HIP + 0.32), (-0.38 + k * 0.08, fy - 0.05, HIP + 0.56), 0.03, c)
        for z in (HIP + 0.45, HIP + 0.2):
            ball(0.08, fy - 0.04, z, 0.09, 0.05, 0.09, COAT_D, seg=6, ring=4)
        # the red bow tie
        for t in (-1, 1):
            can(t * 0.13, fy - 0.06, TOP - 0.06, 0.13, 0.2, TIE, n=4, r2=0.03, rot=(0, R(t * 90), 0))
        ball(0, fy - 0.08, TOP - 0.06, 0.1, 0.08, 0.1, TIE, seg=6, ring=4)
    # standard hanging arms in white sleeves. Right (-x): the bucket; left (+x): the flask held up beside him
    from props import mount
    hp = hand_points()
    for s in (-1, 1):
        with part("arm.l" if s > 0 else "arm.r"):
            limb((s * SX, 0, TOP - 0.15), (s * SX + s * 0.16, -0.05, TOP - ARM_DROP), 0.13, COAT)
            can(s * SX + s * 0.15, -0.05, TOP - ARM_DROP + 0.04, 0.15, 0.12, COAT_D, n=8)
        with part("hand.l" if s > 0 else "hand.r"):
            hand_mitt(*hp[s], s, MITT, SKIN)
    bucket(hp[-1], full=True, size=0.62)
    mount(flask, hp[1], tilt=(0, 45, 0))  # leaning out, the bubbles clear of the head
    with part("head"):
        # the head
        box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
        face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
        box(0, HEAD * 0.06, HEAD_Z + HEAD * 0.3, HEAD * 1.06, HEAD * 1.0, HEAD * 0.4, HAIR, bevel=HEAD * 0.14, segs=2)
        box(0, 0.35, HEAD_Z - 0.05, HEAD * 1.04, 0.8, HEAD * 0.78, HAIR_D, bevel=0.3, segs=2)
        # bushy white brows
        for s in (-1, 1):
            box(s * 0.55, FY - 0.06, HEAD_Z + 0.4, 0.5, 0.12, 0.14, HAIR_D, bevel=0.04, rot=(0, R(s * 12), 0))
        # the explosion of white hair: puffs round the head and spikes bursting out
        cz = HEAD_Z + 0.55
        rnd = random.Random(4)
        for k in range(14):
            a = R(-100 + k * 200 / 13)
            ball(1.25 * math.sin(a), 0.2, cz + 0.85 * math.cos(a), 1.0, 1.5, 1.0, HAIR if k % 2 else HAIR_D, seg=8, ring=5)
        for ring_, y, n, L in ((0, -0.35, 13, 1.7), (1, 0.45, 11, 1.9)):
            for k in range(n):
                a = R(-118 + k * 236 / (n - 1) + ring_ * 10)
                d = Vector((math.sin(a), 0.15 if ring_ else -0.25, math.cos(a))).normalized()
                p0 = Vector((1.2 * math.sin(a), y, cz + 0.75 * math.cos(a)))
                l = L * rnd.uniform(0.8, 1.15)
                bar(p0, p0 + d * l, 0.42, 0.0, HAIR if (k + ring_) % 2 == 0 else HAIR_D, n=5)
        for k in range(5):  # a few going out the back
            a = R(-60 + k * 30)
            d = Vector((math.sin(a) * 0.6, 1.0, 0.4 + 0.3 * math.cos(a))).normalized()
            p0 = Vector((0.8 * math.sin(a), 0.8, cz + 0.2))
            bar(p0, p0 + d * 1.5, 0.4, 0.0, HAIR, n=5)
        # the goggles pushed up on the forehead: a strap round the head, two big lenses
        gz = HEAD_Z + 0.78
        box(0, 0.06, gz, HEAD * 1.09, HEAD * 1.02, 0.24, STRAP, bevel=0.1, segs=2)
        for s in (-1, 1):
            can(s * 0.5, FY - 0.12, gz + 0.05, 0.46, 0.3, BRASS, n=12, rot=(R(90), 0, 0))
            can(s * 0.5, FY - 0.28, gz + 0.05, 0.36, 0.06, LENS, n=12, rot=(R(90), 0, 0))
            ball(s * 0.5 - 0.12, FY - 0.32, gz + 0.17, 0.14, 0.04, 0.14, LENS_L, seg=6, ring=4)
            for k in range(4):  # rivets round the rim
                a = R(45 + k * 90)
                ball(s * 0.5 + 0.41 * math.cos(a), FY - 0.28, gz + 0.05 + 0.41 * math.sin(a), 0.08, 0.06, 0.08, BRASS_D, seg=6, ring=4)
        box(0, FY - 0.14, gz + 0.05, 0.22, 0.14, 0.14, BRASS_D, bevel=0.03)


if __name__ == "__main__" or True:
    render_costume("mad-scientist", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
