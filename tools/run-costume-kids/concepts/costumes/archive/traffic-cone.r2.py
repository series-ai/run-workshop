"""Traffic cone: a big orange cone over the whole kid, two white reflective
bands, a dark hollow at the tip, standing on a square orange base. The kid's
face peeks out a round hole in the middle; mitts poke out the sides (one
with the full bucket) and tiny shoes stick out under the base."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

ORANGE, ORANGE_D, STRIPE, HOLE = (1.0, 0.45, 0.08), (0.86, 0.32, 0.04), (0.97, 0.97, 0.95), (0.25, 0.1, 0.04)
HAIR = (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)
Z0, Z1, R0, R1 = 0.75, 5.2, 1.5, 0.32


def r_at(z):
    return R0 + (R1 - R0) * (z - Z0) / (Z1 - Z0)


def band(za, zb, rgb, grow=0.04):
    can(0, 0, (za + zb) / 2, r_at(za) + grow, zb - za, rgb, n=16, r2=r_at(zb) + grow)


def build():
    body(leg_colour=(0.22, 0.22, 0.25), shoe=(0.2, 0.5, 0.95), torso=False, arms=False)
    # the square base, a darker lip on it
    box(0, 0, 0.62, 2.9, 2.9, 0.22, ORANGE_D, bevel=0.08, segs=2)
    # the cone
    can(0, 0, (Z0 + Z1) / 2, R0, Z1 - Z0, ORANGE, n=16, r2=R1)
    band(Z0, Z0 + 0.12, ORANGE_D, grow=0.03)
    band(3.95, 4.45, STRIPE)
    band(1.55, 2.15, STRIPE)
    can(0, 0, Z1 + 0.005, R1 - 0.07, 0.02, HOLE, n=16)          # the hollow tip
    # the face hole, cut into the cone between the stripes
    fz = 3.05
    fy = -r_at(fz)
    phi = math.atan((R0 - R1) / (Z1 - Z0))
    before = set(bpy.data.objects)
    can(0, fy + 0.05, fz, 0.8, 0.3, ORANGE_D, n=14, rot=X90)
    can(0, fy - 0.1, fz, 0.68, 0.1, SKIN, n=14, rot=X90)
    box(0, fy - 0.18, fz + 0.42, 0.82, 0.08, 0.2, HAIR, bevel=0.04)
    face(0, fz + 0.03, fy - 0.15, 1.32, eye=0.16, gap=0.2)
    # lean the face disc back so it sits flush on the sloped cone
    from mathutils import Matrix
    piv = Vector((0, fy, fz))
    R = Matrix.Translation(piv) @ Matrix.Rotation(-phi, 4, "X") @ Matrix.Translation(-piv)
    for o in set(bpy.data.objects) - before:
        o.matrix_world = R @ o.matrix_world
    # mitts out the sides; the right one holds the bucket
    lh = (-1.75, -0.2, 1.4)
    limb((-1.1, 0, 1.7), lh, 0.12, ORANGE)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.8, -0.25, 1.55)
    limb((1.1, 0, 1.75), rh, 0.12, ORANGE)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.68)


if __name__ == "__main__" or True:
    run({"traffic-cone": build})
