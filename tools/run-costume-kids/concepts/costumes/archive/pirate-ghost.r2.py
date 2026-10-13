"""Pirate ghost captain: a pale mint ghost kid (lighter glow rim, an eye
patch) under a huge black tricorn with a gold trim and a skull, in a tattered
navy captain's coat with gold buttons and epaulettes. A wispy curling tail
instead of legs (no shoes, floats). A cutlass in the right mitten, the full
bucket in the left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

GHOST, GLOW, GHOST_D = (0.60, 0.92, 0.84), (0.84, 1.0, 0.96), (0.42, 0.78, 0.72)
NAVY, NAVY_D, GOLD = (0.13, 0.17, 0.42), (0.08, 0.10, 0.28), (1.0, 0.78, 0.18)
HAT, BONE, STEEL = (0.10, 0.09, 0.12), (0.97, 0.95, 0.88), (0.85, 0.88, 0.92)


def bar(p0, p1, r0, r1, rgb, n=6):
    """A tapered bar from p0 to p1."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def tricorn(z, r, hat=HAT, trim=GOLD):
    """A three-cornered hat sitting at z, one corner to the front (-y)."""
    rz = math.pi  # turn a corner of the 3-gon to the front (-y)
    can(0, 0, z + 0.25, r, 0.5, hat, n=3, r2=r * 0.86, rot=(0, 0, rz))
    can(0, 0, z + 0.53, r * 0.88, 0.07, trim, n=3, rot=(0, 0, rz))  # the gold edge
    can(0, 0, z + 0.6, r * 0.76, 0.1, hat, n=3, rot=(0, 0, rz))
    can(0, 0.1, z + 0.8, r * 0.48, 0.45, hat, n=8, r2=r * 0.36)  # the crown
    return -r  # the front corner y


def build():
    # the torso and arms only: a ghost has no legs or shoes
    cz = HIP + TH * 0.62
    box(0, 0, cz, TW + 0.06, TD + 0.04, TH * 0.78, NAVY, bevel=0.08)
    # the coat skirt flaring down, tattered at the hem
    can(0, 0, HIP - 0.05, TW * 0.6, 0.5, NAVY, n=8, r2=TW * 0.55)
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        can(TW * 0.58 * math.cos(a), TW * 0.58 * math.sin(a), HIP - 0.38, 0.13, 0.22, NAVY, n=4, r2=0.0, rot=(math.radians(180), 0, a))
    # the wispy tail: tapering, curling out to the side
    pts = [(0, 0, HIP - 0.2, 0.52), (0.08, 0.12, 0.3, 0.42), (0.35, 0.3, 0.12, 0.3), (0.75, 0.4, 0.14, 0.2), (1.05, 0.4, 0.4, 0.12), (1.0, 0.35, 0.68, 0.06), (0.85, 0.3, 0.72, 0.01)]
    for i, ((x0, y0, z0, r0), (x1, y1, z1, r1)) in enumerate(zip(pts, pts[1:])):
        bar((x0, y0, z0), (x1, y1, z1), r0, r1, GHOST if i < 3 else GLOW, n=8)
    # coat front: a gold placket, two rows of buttons, a belt with a buckle
    fy = -TD * 0.5 - 0.04
    for s in (-1, 1):
        for z in (cz - 0.18, cz + 0.05, cz + 0.26):
            ball(s * 0.2, fy, z, 0.11, 0.08, 0.11, GOLD, seg=6, ring=4)
    box(0, fy + 0.01, HIP + 0.12, TW + 0.1, 0.06, 0.13, (0.35, 0.2, 0.1))
    box(0, fy - 0.02, HIP + 0.12, 0.2, 0.04, 0.17, GOLD)
    # epaulettes with a fringe
    sx = TW * 0.5 + 0.08
    for s in (-1, 1):
        box(s * (sx - 0.05), 0, TOP + 0.02, 0.42, 0.42, 0.1, GOLD, bevel=0.03)
        for k in (-1, 0, 1):
            can(s * (sx + 0.13), k * 0.13, TOP - 0.1, 0.04, 0.16, GOLD, n=4)
    # right arm: the cutlass
    limb((sx, 0, TOP - 0.15), (sx + 0.16, -0.05, TOP - ARM_DROP), 0.12, NAVY)
    can(sx + 0.17, -0.06, TOP - 0.5, 0.15, 0.12, GOLD, n=6)  # gold cuff
    rx, ry, rz = sx + 0.18, -0.08, TOP - 0.66
    hand_mitt(rx, ry, rz, 1, MITT, GHOST)
    ball(rx, ry - 0.25, rz + 0.05, 0.42, 0.12, 0.36, GOLD, seg=8, ring=4)  # the hand guard
    blade = [(rx, ry - 0.32, rz + 0.1), (rx + 0.06, ry - 0.55, rz + 0.55), (rx + 0.12, ry - 0.62, rz + 1.0), (rx + 0.22, ry - 0.5, rz + 1.35)]
    for i, (a, b) in enumerate(zip(blade, blade[1:])):
        bar(a, b, 0.13 - i * 0.03, 0.1 - i * 0.035, STEEL, n=4)
    # left arm up with the full bucket
    hx, hy, hz = -1.15, -0.3, TOP - 0.2
    limb((-sx, 0, TOP - 0.15), (hx + 0.12, hy, hz + 0.05), 0.12, NAVY)
    hand_mitt(hx, hy, hz, -1, MITT, GHOST)
    bucket((hx, hy, hz), full=True, size=0.6)
    # the head: a glow rim behind a mint head, a big friendly face and an eye patch
    box(0, 0.12, HEAD_Z + 0.02, HEAD * 1.07, HEAD * 0.92, HEAD * 0.96, GLOW, bevel=HEAD * 0.16, segs=2)
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, GHOST, bevel=HEAD * 0.14, segs=2)
    fy = -HEAD * 0.46
    face(0, HEAD_Z - 0.18, fy, HEAD, cheeks=False)
    for s in (-1, 1):
        box(s * HEAD * 0.33, fy - 0.01, HEAD_Z - 0.38, HEAD * 0.12, 0.04, HEAD * 0.06, (0.55, 0.85, 0.95))
    # the patch over the right eye (kid's left)
    ex, ez = HEAD * 0.22, HEAD_Z - 0.18 + HEAD * 0.05
    can(ex, fy - 0.07, ez, 0.3, 0.06, HAT, n=8, rot=(math.radians(90), 0, 0))
    box(0.05, fy - 0.05, ez + 0.3, HEAD * 0.9, 0.04, 0.1, HAT, rot=(0, math.radians(-24), 0))
    # the hat
    hz = HEAD_Z + HEAD * 0.45 - 0.08  # sits on the flat top of the head
    front = tricorn(hz, 2.6)
    # a skull on the front corner
    sk = (0, front * 0.86 + 0.0, hz + 0.32)
    ball(sk[0], sk[1] - 0.05, sk[2], 0.42, 0.3, 0.36, BONE, seg=8, ring=6)
    box(sk[0], sk[1] - 0.05, sk[2] - 0.18, 0.24, 0.24, 0.12, BONE)
    for s in (-1, 1):
        ball(sk[0] + s * 0.09, sk[1] - 0.2, sk[2] + 0.02, 0.11, 0.06, 0.12, HAT, seg=6, ring=4)
        box(sk[0], sk[1] - 0.02, sk[2] - 0.12, 0.62, 0.08, 0.08, BONE, rot=(0, s * math.radians(30), 0))


if __name__ == "__main__" or True:
    run({"pirate-ghost": build})
