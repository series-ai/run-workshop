"""Candy corn: a giant three-stripe candy corn over the whole kid: a wide
yellow base, an orange middle and a white tip, a faceted, slightly bulging
cone with a glossy highlight. The kid's face peeks out a round hole in the
orange band; mitts poke out the yellow base (one with the full bucket), tiny
shoes underneath."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket
from mathutils import Matrix  # noqa: E402

YEL, ORANGE, ORANGE_D, TIP, SHINE = (1.0, 0.82, 0.12), (1.0, 0.5, 0.06), (0.86, 0.36, 0.04), (0.98, 0.97, 0.92), (1.0, 1.0, 1.0)
HAIR = (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)
Z0, Z1, RB = 0.6, 5.35, 1.6
ROT = (0, 0, math.radians(15))


def r_at(z):
    t = (z - Z0) / (Z1 - Z0)
    return max(0.05, RB * (1 - t ** 1.7))


def band(za, zb, rgb, steps=3):
    for k in range(steps):
        a = za + (zb - za) * k / steps
        b = za + (zb - za) * (k + 1) / steps
        can(0, 0, (a + b) / 2, r_at(a), b - a + 0.005, rgb, n=12, r2=r_at(b), rot=ROT)


def build():
    body(leg_colour=(0.97, 0.97, 0.97), shoe=(0.45, 0.25, 0.75), torso=False, arms=False)
    # a rounded bottom, then the three bands
    can(0, 0, Z0 - 0.05, RB - 0.12, 0.1, YEL, n=12, r2=RB, rot=ROT)
    band(Z0, 2.1, YEL)
    band(2.1, 3.95, ORANGE)
    band(3.95, Z1, TIP, steps=4)
    ball(0, 0, Z1, 0.22, 0.22, 0.16, TIP, seg=8, ring=4)
    # a glossy highlight streak on the upper left
    for z, h in ((4.3, 0.5), (3.75, 0.18)):
        x = -r_at(z) * 0.55
        box(x, -r_at(z) * 0.8, z, 0.16, 0.06, h, SHINE, rot=(math.radians(-15), 0, math.radians(-30)))
    # the face hole in the orange band, leaned back to sit on the slope
    fz = 3.0
    fy = -r_at(fz) * math.cos(math.radians(15))
    slope = math.atan((r_at(fz - 0.4) - r_at(fz + 0.4)) / 0.8)
    before = set(bpy.data.objects)
    can(0, fy + 0.05, fz, 0.8, 0.3, ORANGE_D, n=14, rot=X90)
    can(0, fy - 0.1, fz, 0.68, 0.1, SKIN, n=14, rot=X90)
    box(0, fy - 0.18, fz + 0.42, 0.82, 0.08, 0.2, HAIR, bevel=0.04)
    face(0, fz + 0.03, fy - 0.15, 1.32, eye=0.16, gap=0.2)
    piv = Vector((0, fy, fz))
    R = Matrix.Translation(piv) @ Matrix.Rotation(-slope, 4, "X") @ Matrix.Translation(-piv)
    for o in set(bpy.data.objects) - before:
        o.matrix_world = R @ o.matrix_world
    # mitts poke out of the yellow base; the right one holds the bucket
    lh = (-1.95, -0.25, 1.35)
    limb((-1.3, 0, 1.6), lh, 0.12, YEL)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.95, -0.3, 1.5)
    limb((1.3, 0, 1.65), rh, 0.12, YEL)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.66)


if __name__ == "__main__" or True:
    run({"candy-corn": build})
