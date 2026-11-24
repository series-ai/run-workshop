"""Medusa: the kid under a huge wild mop of fat cartoon snakes: chunky green
snakes in three greens with big googly eyes and red forked tongues, curling
out of a green scalp in every direction. A white Greek toga dress to the
ankles with fold ridges, a gold belt and a one-shoulder drape with a gold
clasp, gold arm cuffs and sandals. A little gold hand mirror in the right
mitten, the full bucket in the left."""
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
GREENS = [(0.36, 0.78, 0.30), (0.55, 0.88, 0.32), (0.20, 0.62, 0.38)]
BELLY, SCALP, TONGUE = (0.92, 0.95, 0.55), (0.18, 0.50, 0.24), (0.95, 0.18, 0.28)
TOGA, TOGA_D, GOLD, GOLD_D = (1.0, 0.99, 0.95), (0.88, 0.88, 0.86), (1.0, 0.80, 0.18), (0.86, 0.60, 0.10)
GLASS = (0.70, 0.90, 1.0)


def bar(p0, p1, r0, r1, rgb, n=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def snake(p0, d, curl, n, col, rnd, r=0.24, step=0.36):
    """A fat cartoon snake from the scalp point p0, heading along d and
    curling by `curl` radians per segment (about the axis facing the camera,
    so it curls in the picture); ends in a head with eyes and a tongue."""
    p = Vector(p0)
    d = Vector(d).normalized()
    # the neck: sunk deep into the head so the snake grows out of the scalp
    # with no end or gap showing from any side
    inward = (Vector((0, 0.15, HEAD_Z + 0.2)) - p).normalized()
    bar(p + inward * 0.8, p, r, r, col, n=8)
    ball(*p, r * 2.05, r * 2.05, r * 2.05, col, seg=8, ring=5)
    axis = Vector((0, -1, 0))
    from mathutils import Quaternion
    for i in range(n):
        q = Quaternion(axis, curl * 2.6 * (i / max(n - 1, 1)) ** 1.6)
        d = (q @ d).normalized()
        p1 = p + d * step
        rr = r * (1.0 - 0.15 * i / n)
        bar(p, p1, rr, rr, col if i % 2 == 0 else col, n=8)
        ball(*p1, rr * 2.05, rr * 2.05, rr * 2.05, col, seg=8, ring=5)
        p = p1
    # the head: a fat bean pointing along d, eyes looking at the camera
    h = p + d * 0.22
    o = ball(0, 0, 0, 0.62, 0.52, 0.44, col, seg=10, ring=6)
    o.location = h
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("X", "Z")
    side = Vector((-d.z, 0, d.x)).normalized() if abs(d.x) + abs(d.z) > 0.1 else Vector((1, 0, 0))
    for s in (-1, 1):
        e = h + side * s * 0.13 + Vector((0, -0.2, 0.0)) + d * 0.02
        ball(*e, 0.2, 0.14, 0.2, WHITE, seg=8, ring=5)
        ball(e.x + d.x * 0.03, e.y - 0.07, e.z + d.z * 0.03, 0.1, 0.06, 0.1, DARK, seg=6, ring=4)
    # a red forked tongue out of the snout
    t0 = h + d * 0.3
    t1 = t0 + d * 0.22
    bar(t0, t1, 0.035, 0.035, TONGUE, n=4)
    for s in (-1, 1):
        bar(t1, t1 + d * 0.1 + side * s * 0.08, 0.03, 0.02, TONGUE, n=4)


def mirror():
    """The gold hand mirror around its grip (the origin), its round face to the front."""
    bar((0, 0, -0.15), (0.05, 0, 0.32), 0.06, 0.06, GOLD)
    can(0.08, 0, 0.62, 0.32, 0.08, GOLD, n=12, rot=(R(90), 0, 0))
    can(0.08, -0.04, 0.62, 0.25, 0.04, GLASS, n=12, rot=(R(90), 0, 0))


def build():
    body(shirt=TOGA, pants=TOGA, leg_colour=SKIN, shoe=GOLD_D, arms=False, torso=False)
    # sandal straps up the legs
    for s in (-1, 1):
        for z in (0.36, 0.46):
            with part("leg.l" if s > 0 else "leg.r"):
                can(s * TW * 0.24, 0, z, 0.13, 0.04, GOLD, n=6)
    with part("body"):
        # the toga: a long white dress, flaring a little, with fold ridges
        can(0, 0, HIP + 0.18, 0.56, 0.6, TOGA, n=10, r2=0.68, rot=(R(180), 0, 0))
        for k in range(-2, 3):
            x = k * 0.22
            bar((x * 1.1, -0.64, HIP - 0.08), (x, -0.52, HIP + 0.4), 0.05, 0.04, TOGA_D, n=6)
    with part("chest"):
        box(0, 0, HIP + TH * 0.62, TW * 0.95, TD * 0.92, TH * 0.82, TOGA, bevel=0.1)
    with part("body"):
        # the gold belt
        box(0, 0, HIP + 0.32, TW * 1.0, TD * 0.98, 0.12, GOLD, bevel=0.04)
        ball(0, -TD * 0.5 - 0.05, HIP + 0.32, 0.18, 0.08, 0.18, GOLD_D, seg=8, ring=5)
    with part("chest"):
        # the drape from the left shoulder across to the right hip, a gold clasp
        box(-0.05, -TD * 0.5 - 0.03, HIP + 0.62, 0.28, 0.08, 1.05, TOGA_D, bevel=0.04, rot=(0, R(-38), 0))
        box(-0.05, TD * 0.5 + 0.03, HIP + 0.62, 0.28, 0.08, 1.05, TOGA_D, bevel=0.04, rot=(0, R(38), 0))
        can(-0.42, -TD * 0.5 - 0.06, TOP - 0.08, 0.12, 0.06, GOLD, n=8, rot=(R(90), 0, 0))
    # standard hanging arms: bare with toga puffs and gold cuffs. Right (-x): the bucket; left (+x): a hand mirror
    from props import mount
    hp = hand_points()
    for s in (-1, 1):
        with part("arm.l" if s > 0 else "arm.r"):
            limb((s * SX, 0, TOP - 0.12), (s * SX + s * 0.16, -0.05, TOP - ARM_DROP), 0.11, SKIN)
            ball(s * SX, 0, TOP - 0.1, 0.36, 0.36, 0.32, TOGA, seg=8, ring=5)
            can(s * SX + s * 0.15, -0.05, TOP - ARM_DROP + 0.04, 0.14, 0.12, GOLD, n=8)
        with part("hand.l" if s > 0 else "hand.r"):
            hand_mitt(*hp[s], s, MITT, SKIN)
    bucket(hp[-1], full=True, size=0.62)
    mount(mirror, hp[1], tilt=(0, 75, 0))  # held out sideways, clear of the head
    with part("head"):
        # the head and the green scalp
        box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
        face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
        box(0, HEAD * 0.06, HEAD_Z + HEAD * 0.3, HEAD * 1.06, HEAD * 1.0, HEAD * 0.4, SCALP, bevel=HEAD * 0.14, segs=2)
        box(0, 0.35, HEAD_Z - 0.1, HEAD * 1.04, 0.8, HEAD * 0.75, SCALP, bevel=0.3, segs=2)
        # the snakes: fat, fanning out of the scalp in every direction, the tips curling
        def base(ang, y, rr=1.7):
            x = max(-1.25, min(1.25, rr * math.sin(ang)))
            z = HEAD_Z + 0.25 + max(-0.9, min(1.0, rr * math.cos(ang)))
            return (x, y, z)
        # (angle from straight up in deg, y, segments, curl: + curls to the kid's
        # right as seen from the front, - to the left)
        fans = [
            # the sides (kept from r5), fanning out and down
            (-100, -0.2, 5, 0.32), (-75, -0.3, 6, -0.32), (62, -0.3, 6, 0.32), (85, -0.3, 6, -0.32), (105, -0.2, 5, 0.32),
            # the top: three tall snakes in an open fan, each curling outward, with sky between them
            (-30, -0.3, 8, 0.36), (0, -0.25, 9, -0.2), (30, -0.3, 8, -0.36),
            # two short ones leaning back to fill the crown, and one trailing off the back
            (-40, 0.6, 5, 0.3), (40, 0.6, 5, -0.3),
        ]
        for i, (ang, y, n, curl) in enumerate(fans):
            a = R(ang)
            d = (math.sin(a), -0.2 if y < 0 else 0.9, math.cos(a))
            snake(base(a, y), d, curl, n, GREENS[i % 3], None, r=0.28, step=0.38)
        snake((0, 0.9, HEAD_Z + 0.75), (0.3, 1.0, -0.15), 0.32, 5, GREENS[1], None, r=0.28, step=0.38)

if __name__ == "__main__" or True:
    render_costume("medusa", build, sys.argv[sys.argv.index("--") + 1], ortho=9.6, target_z=3.9)
