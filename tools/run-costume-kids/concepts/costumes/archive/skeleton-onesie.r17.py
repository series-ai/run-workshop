"""Skeleton onesie: a black onesie with chunky white bones (ribs, spine,
pelvis, arm and leg bones) and a giant skull hood: a black hood with a white
skull mask, big dark eye sockets the kid's shiny eyes look out of, a nose
triangle and a row of teeth. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

BLACK, BONE, BONE_D = (0.13, 0.12, 0.16), (0.98, 0.97, 0.92), (0.80, 0.80, 0.78)


def bone(p0, p1, r):
    """A cartoon bone: a bar with knobbly double-ball ends."""
    limb(p0, p1, r, BONE)
    import mathutils
    a, b = mathutils.Vector(p0), mathutils.Vector(p1)
    d = (b - a).normalized()
    side = d.cross(mathutils.Vector((0, -1, 0)))
    if side.length < 1e-3:
        side = mathutils.Vector((1, 0, 0))
    side.normalize()
    for p in (a, b):
        for k in (-1, 1):
            q = p + side * k * r * 0.9
            ball(q.x, q.y, q.z, r * 2.3, r * 2.3, r * 2.3, BONE, seg=8, ring=5)


def build():
    body(shirt=BLACK, pants=BLACK, sleeve=BLACK, leg_colour=BLACK, shoe=(0.85, 0.2, 0.25), arms=False)
    fy = -TD * 0.5 - 0.03
    with part("chest"):
        # the ribcage: a sternum and three curved rib bars each side
        box(0, fy, HIP + TH * 0.62, 0.12, 0.06, TH * 0.6, BONE, bevel=0.03)
        for i, z in enumerate((TOP - 0.18, TOP - 0.36, TOP - 0.54)):
            w = 0.32 - i * 0.03
            for s in (-1, 1):
                box(s * (0.08 + w * 0.5), fy, z, w, 0.06, 0.1, BONE, bevel=0.03, rot=(0, s * math.radians(-12), 0))
    # the pelvis: two round wings
    with part("body"):
        for s in (-1, 1):
            ball(s * 0.18, fy, HIP + 0.12, 0.34, 0.08, 0.26, BONE, seg=8, ring=5)
    # leg bones down the front of the stub legs
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            bone((fx, -0.12, FOOT * 0.48), (fx, -0.12, HIP - 0.02), 0.045)
    # the spine down the back
    for k in range(5):
        z = HIP + 0.1 + k * 0.17
        with part("chest" if z > HIP + TH * 0.36 else "body"):  # each vertebra on the part of the back it sits on
            box(0, TD * 0.5 + 0.03, z, 0.16, 0.06, 0.1, BONE, bevel=0.03)
    # arms: left arm hangs down, right arm out holding the bucket
    sx = -(TW * 0.5 + 0.08)
    with part("arm.r"):
        limb((sx, 0, TOP - 0.15), (sx - 0.16, -0.05, TOP - ARM_DROP), 0.11, BLACK)
        bone((sx - 0.02, -0.11, TOP - 0.2), (sx - 0.14, -0.13, TOP - 0.5), 0.035)
    with part("hand.r"):
        hand_mitt(sx - 0.18, -0.08, TOP - 0.66, -1, MITT, SKIN)
    m = (1.45, -0.2, 1.2)
    with part("arm.l"):
        limb((-sx, 0, TOP - 0.15), (m[0] - 0.15, m[1], m[2] + 0.05), 0.11, BLACK)
        bone((-sx + 0.15, -0.12, TOP - 0.13), (m[0] - 0.3, m[1] - 0.1, m[2] + 0.07), 0.035)
    with part("hand.l"):
        hand_mitt(*m, 1, MITT, SKIN)
    bucket(m, full=True, size=0.6)
    with part("head"):  # the hood and the skull mask on it
        # the hood: a giant black rounded block with two little pointy-free ear bumps
        box(0, 0.02, HEAD_Z + HEAD * 0.01, HEAD * 1.04, HEAD * 0.95, HEAD * 0.9, BLACK, bevel=HEAD * 0.16, segs=2)  # its hem level with the base head's
        hf = -HEAD * 0.95 * 0.5 + 0.02
        # the skull mask on the front: a wide round cranium and a narrower jaw
        ball(0, hf + 0.02, HEAD_Z + 0.2, HEAD * 0.88, 0.36, HEAD * 0.68, BONE, seg=14, ring=9)
        box(0, hf - 0.06, HEAD_Z - 0.6, HEAD * 0.5, 0.18, 0.6, BONE, bevel=0.2, segs=2)
        my = hf - 0.15
        # eye sockets with the kid's shiny eyes inside
        for s in (-1, 1):
            ex = s * 0.5
            ball(ex, my, HEAD_Z + 0.12, 0.72, 0.06, 0.66, (0.06, 0.05, 0.06), seg=10, ring=6)
            ball(ex - 0.12, my - 0.04, HEAD_Z + 0.24, 0.2, 0.04, 0.2, WHITE, seg=8, ring=4)
            ball(ex + 0.12, my - 0.04, HEAD_Z + 0.02, 0.09, 0.04, 0.09, WHITE, seg=6, ring=4)
            box(s * 0.78, my + 0.03, HEAD_Z - 0.2, 0.26, 0.04, 0.12, CHEEK)
        # the nose: an upside-down triangle
        can(0, my, HEAD_Z - 0.32, 0.15, 0.05, (0.06, 0.05, 0.06), n=3, rot=(math.radians(90), math.radians(180), 0))
        # the teeth: a dark mouth with a row of white teeth
        box(0, my, HEAD_Z - 0.68, 0.98, 0.04, 0.3, (0.06, 0.05, 0.06))
        for k in range(5):
            box(-0.38 + k * 0.19, my - 0.03, HEAD_Z - 0.66, 0.14, 0.04, 0.22, BONE, bevel=0.02)


if __name__ == "__main__" or True:
    run({"skeleton-onesie": build})
