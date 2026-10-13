"""Peeled banana: a tall cream banana (rounded cubes, the tip leaning a touch)
rises out of a yellow peel cup round the hips; four yellow peel flaps flop
down and curl out at the ends, with brown tips. The kid's face peeks out a
round hole in the banana; yellow sleeves, mitts out the sides between the
flaps, one holding the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

FLESH, FLESH_D = (1.0, 0.94, 0.66), (0.92, 0.8, 0.45)
PEEL, PEEL_D, PEEL_IN, TIPC = (1.0, 0.84, 0.12), (0.88, 0.66, 0.06), (1.0, 0.95, 0.8), (0.4, 0.25, 0.1)
HAIR = (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)


def face_hole(fz, fy, rim, r=0.82):
    k = r / 0.88
    can(0, fy, fz, r, 0.3, rim, n=12, rot=X90)
    can(0, fy - 0.08, fz, r - 0.13, 0.2, SKIN, n=12, rot=X90)
    box(0, fy - 0.2, fz + 0.48 * k, 0.95 * k, 0.1, 0.22, HAIR, bevel=0.04)
    face(0, fz + 0.05, fy - 0.18, 1.5 * k, eye=0.16, gap=0.2)


def flap(a, hz, hr, w=1.0, L=1.5, t=math.radians(28), t2=math.radians(70), L2=0.6):
    """A peel flap hinged at radius hr, height hz, flopping down and out toward angle a."""
    out = (math.cos(a), math.sin(a))
    h = (hr * out[0], hr * out[1], hz)
    d1 = (out[0] * math.sin(t), out[1] * math.sin(t), -math.cos(t))
    c1 = tuple(h[i] + d1[i] * L / 2 for i in range(3))
    box(*c1, w, 0.16, L, PEEL, bevel=0.06, rot=(t, 0, a - math.pi / 2))
    # the pale inside of the peel, facing the banana
    ci = tuple(c1[i] - (out[0], out[1], 0)[i] * 0.07 * math.cos(t) for i in range(3))
    box(ci[0], ci[1], ci[2] - 0.02, w * 0.84, 0.06, L * 0.9, PEEL_IN, rot=(t, 0, a - math.pi / 2))
    e1 = tuple(h[i] + d1[i] * L for i in range(3))
    d2 = (out[0] * math.sin(t2), out[1] * math.sin(t2), -math.cos(t2))
    c2 = tuple(e1[i] + d2[i] * L2 / 2 for i in range(3))
    box(*c2, w * 0.9, 0.16, L2 + 0.1, PEEL, bevel=0.06, rot=(t2, 0, a - math.pi / 2))
    e2 = tuple(e1[i] + d2[i] * (L2 + 0.05) for i in range(3))
    box(*e2, w * 0.7, 0.18, 0.16, TIPC, bevel=0.04, rot=(t2, 0, a - math.pi / 2))


def build():
    body(leg_colour=PEEL_D, shoe=(0.45, 0.28, 0.14), torso=False, arms=False)
    # the unpeeled bottom: a yellow peel cup round the hips
    box(0, 0, 1.35, 2.05, 1.85, 1.5, PEEL, bevel=0.5, segs=3)
    box(0, 0, 2.08, 1.95, 1.75, 0.16, PEEL_D, bevel=0.06)   # the torn rim
    # the banana itself: a faceted column (bananas are ridged) of frustums
    # tapering and curving gently to one side, up to a brown tip
    n = 8
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append((0.7 * t ** 2.2, 2.0 + 3.35 * t, 0.98 - 0.62 * t ** 1.7))
    for (x0, z0, r0), (x1, z1, r1) in zip(pts, pts[1:]):
        dx, dz = x1 - x0, z1 - z0
        L = math.hypot(dx, dz)
        can((x0 + x1) / 2, 0, (z0 + z1) / 2, r0, L + 0.04, FLESH, n=8, r2=r1, rot=(0, math.atan2(dx, dz), math.radians(22.5)))
    xe, ze, re = pts[-1]
    can(xe + 0.05, 0, ze + 0.12, re, 0.24, FLESH, n=8, r2=re * 0.55, rot=(0, 0.35, math.radians(22.5)))
    can(xe + 0.12, 0, ze + 0.3, re * 0.6, 0.16, TIPC, n=8, r2=re * 0.35, rot=(0, 0.35, math.radians(22.5)))
    face_hole(3.25, -0.86, FLESH_D)
    # four peel flaps flopping down, front and back, leaving the sides free for the arms
    for deg in (-58, -122, 58, 122):
        flap(math.radians(deg), 2.05, 0.82)
    # arms out the sides between the flaps; the right mitt holds the bucket
    lh = (-1.6, -0.15, 1.55)
    limb((-0.9, 0, 1.85), lh, 0.12, PEEL)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.65, -0.2, 1.7)
    limb((0.9, 0, 1.9), rh, 0.12, PEEL)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.68)


if __name__ == "__main__" or True:
    run({"banana": build})
