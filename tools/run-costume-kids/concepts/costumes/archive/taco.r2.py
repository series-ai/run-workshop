"""Taco: the kid sandwiched in a giant crunchy taco shell standing on its
fold, the U shape seen from the front. Lettuce frills, tomato cubes, cheese
shreds and a mound of filling burst out of the top; the kid's face peeks
out a round hole in the middle of the front shell. Mitts out the sides, one
with the full bucket, tiny shoes underneath."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import random
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket
import bmesh  # noqa: E402

SHELL, SHELL_D, SHELL_IN, TOAST = (1.0, 0.8, 0.3), (0.86, 0.6, 0.18), (0.96, 0.7, 0.25), (0.8, 0.5, 0.15)
LETTUCE, LETTUCE_D, TOMATO, CHEESE, MEAT = (0.5, 0.85, 0.25), (0.35, 0.7, 0.18), (0.92, 0.18, 0.15), (1.0, 0.68, 0.1), (0.5, 0.28, 0.15)
HAIR = (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)
ZT, RX, RZ = 4.35, 2.15, 3.8


def prism(pts, y0, y1, rgb, bevel=0.0, segs=2):
    """Extrude a convex outline [(x, z)] between y0 and y1."""
    me = bpy.data.meshes.new("p")
    n = len(pts)
    v = [(x, y0, z) for x, z in pts] + [(x, y1, z) for x, z in pts]
    f = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    me.from_pydata(v, [], f)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("p", me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat(rgb))
    if bevel:
        b = o.modifiers.new("b", "BEVEL")
        b.width, b.segments, b.limit_method = bevel, segs, "ANGLE"
        b.use_clamp_overlap = False
    return o


def half_moon(rx, rz, zt, n=24):
    return [(rx * math.cos(math.pi * k / n), zt - rz * math.sin(math.pi * k / n)) for k in range(n + 1)]


def build():
    body(leg_colour=(0.2, 0.3, 0.6), shoe=(0.9, 0.2, 0.2), torso=False, arms=False)
    rnd = random.Random(3)
    # the inside of the fold, then the front and back shell halves
    prism(half_moon(RX - 0.12, RZ - 0.1, ZT - 0.15), -0.75, 0.75, SHELL_IN)
    for y0, y1 in ((-1.0, -0.72), (0.72, 1.0)):
        prism(half_moon(RX, RZ, ZT), y0, y1, SHELL, bevel=0.09)
    # toasty spots on the front shell, clear of the face
    for x, z in ((-1.35, 3.9), (1.25, 3.7), (-1.1, 2.05), (1.05, 1.8), (0.15, 1.25), (-0.55, 1.5), (1.55, 3.0), (-1.6, 3.0)):
        can(x, -1.02, z, rnd.uniform(0.09, 0.15), 0.04, TOAST, n=8, rot=X90)
    # the filling: a meat mound, frilly lettuce along both rims, tomato and cheese
    for i in range(9):
        x = -1.6 + i * 0.4
        ball(x, rnd.uniform(-0.2, 0.2), ZT + 0.05, 0.6, 0.9, 0.5, MEAT, seg=6, ring=4)
    for y in (-0.62, 0.62):
        for i in range(11):
            x = -1.95 + i * 0.39
            c = LETTUCE if i % 2 else LETTUCE_D
            box(x, y, ZT + 0.22, 0.48, 0.24, 0.42, c, bevel=0.08, rot=(rnd.uniform(-0.4, 0.4), rnd.uniform(-0.5, 0.5), 0))
    for i in range(6):
        x = -1.5 + i * 0.6 + rnd.uniform(-0.1, 0.1)
        box(x, rnd.uniform(-0.35, 0.3), ZT + 0.42, 0.34, 0.34, 0.26, TOMATO, bevel=0.06, rot=(0, 0, rnd.uniform(0, 1.5)))
    for i in range(16):
        x = rnd.uniform(-1.8, 1.8)
        box(x, rnd.uniform(-0.45, 0.45), ZT + 0.5 + rnd.uniform(0, 0.12), 0.4, 0.08, 0.08, CHEESE, rot=(0, rnd.uniform(-0.4, 0.4), rnd.uniform(0, 3.1)))
    # the face hole in the middle of the front shell
    fz, fy = 2.75, -1.0
    can(0, fy, fz, 0.86, 0.2, SHELL_D, n=12, rot=X90)
    can(0, fy - 0.05, fz, 0.73, 0.2, SKIN, n=12, rot=X90)
    box(0, fy - 0.16, fz + 0.46, 0.92, 0.1, 0.22, HAIR, bevel=0.04)
    face(0, fz + 0.05, fy - 0.15, 1.45, eye=0.16, gap=0.2)
    # mitts out the sides of the shell; the right one holds the bucket
    lh = (-1.85, -0.25, 1.45)
    limb((-1.2, 0, 1.75), lh, 0.12, SHELL_D)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.9, -0.3, 1.6)
    limb((1.2, 0, 1.8), rh, 0.12, SHELL_D)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.66)


if __name__ == "__main__" or True:
    run({"taco": build})
