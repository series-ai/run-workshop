"""Rocket: the kid's head pokes out of a round hole in a big white rocket
body. A red nose cone with a little tip ball on top, red bands, a blue
porthole below the face, three red fins round the bottom and a cartoon flame
(orange and yellow tongues) bursting out under the rocket round the kid's
shoes. The arms poke out the sides; one mitt carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

BODY, BODY_D, RED, RED_D = (0.97, 0.97, 0.95), (0.82, 0.84, 0.88), (0.95, 0.22, 0.2), (0.75, 0.12, 0.12)
BLUE, WIN, YEL, ORANGE, SILVER = (0.2, 0.45, 0.9), (0.6, 0.85, 1.0), (1.0, 0.86, 0.15), (1.0, 0.5, 0.1), (0.75, 0.78, 0.84)
HAIR = (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)
N = 16


def flame(x, y, z, r, h, rgb):
    """A flame tongue: a cone pointing down with a round top."""
    can(x, y, z - h * 0.5, r, h, rgb, n=8, r2=0.0)
    ball(x, y, z, r * 2, r * 2, r * 1.4, rgb, seg=8, ring=5)


def upflame(x, y, h):
    """A cartoon flame tongue: a round orange base tapering to a point, a yellow core in front."""
    ball(x, y, h * 0.26, h * 0.56, h * 0.56, h * 0.5, ORANGE, seg=8, ring=6)
    can(x, y, h * 0.26 + h * 0.37, h * 0.27, h * 0.74, ORANGE, n=8, r2=0.0)
    ball(x, y - h * 0.16, h * 0.2, h * 0.34, h * 0.3, h * 0.3, YEL, seg=8, ring=6)
    can(x, y - h * 0.16, h * 0.2 + h * 0.22, h * 0.16, h * 0.44, YEL, n=8, r2=0.0)


def fin(ang, R, z0):
    """A swept fin: a trapezoid slab sticking out of the body at angle `ang`."""
    t = 0.09
    prof = [(R - 0.15, z0 + 1.3), (R + 0.85, z0 + 0.05), (R + 0.85, z0 - 0.45), (R - 0.15, z0 + 0.0)]
    verts = [(r, -t, z) for r, z in prof] + [(r, t, z) for r, z in prof]
    faces = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
    me = bpy.data.meshes.new("fin")
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new("fin", me)
    o.rotation_euler = (0, 0, ang)
    bpy.context.scene.collection.objects.link(o)
    finish(o, RED, bevel=0.05, segs=2)
    o.modifiers[-1].limit_method = "ANGLE"
    return o


def build():
    body(shirt=RED, pants=(0.25, 0.3, 0.5), shoe=(0.95, 0.95, 0.95), torso=False, arms=False)
    R = 1.15
    z0, z1 = HIP + 0.3, 4.05
    zc = (z0 + z1) / 2
    can(0, 0, zc, R, z1 - z0, BODY, n=N, rot=(0, 0, math.pi / N))
    fy = -R * math.cos(math.pi / N)
    # red bands round the body and the engine bell at the bottom
    for z in (z0 + 0.12, z1 - 0.12):
        can(0, 0, z, R + 0.05, 0.24, RED, n=N, rot=(0, 0, math.pi / N))
    can(0, 0, z0 - 0.12, R * 0.6, 0.25, SILVER, n=N, r2=R * 0.85, rot=(0, 0, math.pi / N))
    # the nose cone: a pointy ogive in two red cones, a yellow tip ball
    can(0, 0, z1 + 0.35, R + 0.03, 0.7, RED, n=N, r2=R * 0.68, rot=(0, 0, math.pi / N))
    can(0, 0, z1 + 1.15, R * 0.68, 0.9, RED, n=N, r2=0.1, rot=(0, 0, math.pi / N))
    ball(0, 0, z1 + 1.62, 0.28, 0.28, 0.28, YEL, seg=8, ring=6)
    # swept fins: one at the back, two at the back corners
    for ang in (25, 90, 155):
        fin(math.radians(ang), R, z0)
    # the round hole with the kid's face poking out
    cz = HEAD_Z + 0.05
    can(0, fy + 0.02, cz, 1.0, 0.24, RED_D, n=20, rot=X90)
    can(0, fy - 0.06, cz, 0.88, 0.2, RED, n=20, rot=X90)
    can(0, fy - 0.12, cz - 0.02, 0.78, 0.26, SKIN, n=20, rot=X90)
    box(0, fy - 0.2, cz + 0.52, 1.1, 0.2, 0.36, HAIR, bevel=0.1)              # the fringe under the rim
    face(0, cz - 0.08, fy - 0.26, 1.4, eye=0.16, gap=0.2)
    # a blue porthole below the face
    pz = z0 + 0.62
    can(0, fy, pz, 0.38, 0.12, SILVER, n=14, rot=X90)
    can(0, fy - 0.05, pz, 0.28, 0.08, BLUE, n=14, rot=X90)
    box(-0.09, fy - 0.1, pz + 0.09, 0.1, 0.03, 0.07, WHITE)
    for k in range(6):  # rivets round the porthole
        a = 2 * math.pi * k / 6
        ball(0.33 * math.cos(a), fy - 0.07, pz + 0.33 * math.sin(a), 0.06, 0.04, 0.06, BODY_D, seg=6, ring=4)
    # the cartoon flame: fat tongues blasting down out of the engine to the ground,
    # behind and round the legs, so the shoes stand in the fire
    for x, y, r, c in ((-0.62, 0.15, 0.32, ORANGE), (0.62, 0.15, 0.32, ORANGE), (-0.35, 0.45, 0.36, ORANGE), (0.35, 0.45, 0.36, ORANGE), (0, 0.55, 0.4, ORANGE),
                       (-0.3, 0.25, 0.24, YEL), (0.3, 0.25, 0.24, YEL), (0, 0.4, 0.28, YEL)):
        h = z0 - 0.15
        can(x, y, h * 0.5 - 0.05, r, h + 0.1, c, n=8, r2=0.02 if c == YEL else 0.0, rot=(math.pi, 0, 0))
    # cartoon flame tongues licking up round the feet (open at the front so the shoes show)
    for x, y, h in ((-0.85, 0.0, 0.95), (0.85, 0.0, 0.95), (-0.6, 0.45, 1.05), (0.6, 0.45, 1.05), (0.0, 0.7, 1.1), (-1.0, -0.4, 0.7), (1.0, -0.4, 0.7)):
        upflame(x, y, h)
    # arms out of the sides: the left waves, the right carries the full bucket
    for s in (-1, 1):
        can(s * (R - 0.02), -0.1, TOP - 0.1, 0.24, 0.14, RED_D, n=10, rot=(0, math.radians(90), 0))  # sleeve holes
    rh = (R + 0.45, -0.2, TOP + 0.45)  # the right mitt waves
    limb((R - 0.05, -0.1, TOP - 0.1), (rh[0] - 0.12, rh[1], rh[2] - 0.2), 0.11, RED)
    hand_mitt(*rh, 1, MITT, SKIN)
    lh = (-R - 0.4, -0.3, TOP + 0.1)  # the left carries the bucket up out of the fire
    limb((-R + 0.05, -0.1, TOP - 0.1), (lh[0] + 0.08, lh[1], lh[2] + 0.1), 0.11, RED)
    hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=True, size=0.62)

if __name__ == "__main__" or True:
    run({"rocket": build})
