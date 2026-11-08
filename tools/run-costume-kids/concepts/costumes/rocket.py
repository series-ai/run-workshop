"""Rocket: the kid's whole head is inside a fat white rocket body; the kid's
standard face looks out of a big round red-rimmed porthole with rivets. A
tall red nose cone with a yellow tip ball towers way over the head; red
bands, a small blue porthole on the belly, three big swept red fins round
the bottom and a cartoon flame (orange and yellow tongues) bursting out
under the rocket round the kid's shoes. The right mitt waves; the left
carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
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


def cut(obj, cutter):
    """Boolean `cutter` out of `obj` (the cutter is hidden)."""
    m = obj.modifiers.new("cut", "BOOLEAN")
    m.object, m.operation = cutter, "DIFFERENCE"
    cutter.hide_render = True
    return obj


WR = 1.24                      # the porthole radius round the standard face
FZ = HEAD_Z - HEAD * 0.06


def window(back=-0.6, front=-3.0, r=WR):
    """A round cutter for the face porthole."""
    return can(0, (back + front) / 2, FZ, r, back - front, WHITE, n=24, rot=X90)


def flame(x, y, z, r, h, rgb):
    """A flame tongue: a cone pointing down with a round top."""
    can(x, y, z - h * 0.5, r, h, rgb, n=8, r2=0.0)
    ball(x, y, z, r * 2, r * 2, r * 1.4, rgb, seg=8, ring=5)


def upflame(x, y, h):
    """A cartoon flame tongue: a round orange base tapering to a point, a yellow core in front."""
    ball(x, y, h * 0.26, h * 0.56, h * 0.56, h * 0.5, ORANGE, seg=6, ring=4)
    can(x, y, h * 0.26 + h * 0.37, h * 0.27, h * 0.74, ORANGE, n=6, r2=0.0)
    ball(x, y - h * 0.16, h * 0.2, h * 0.34, h * 0.3, h * 0.3, YEL, seg=6, ring=4)
    can(x, y - h * 0.16, h * 0.2 + h * 0.22, h * 0.16, h * 0.44, YEL, n=6, r2=0.0)


def fin(ang, R, z0, k=1.5):
    """A swept fin: a trapezoid slab sticking out of the body at angle `ang`."""
    t = 0.09
    prof = [(R - 0.15, z0 + 1.3 * k), (R + 0.85 * k, z0 + 0.05), (R + 0.85 * k, z0 - 0.45 * k), (R - 0.15, z0 + 0.0)]
    verts = [(r, -t, z) for r, z in prof] + [(r, t, z) for r, z in prof]
    faces = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
    me = bpy.data.meshes.new("fin")
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new("fin", me)
    o.rotation_euler = (0, 0, ang)
    bpy.context.scene.collection.objects.link(o)
    finish(o, RED, bevel=0.05, segs=1)
    o.modifiers[-1].limit_method = "ANGLE"
    return o


def build():
    body(shirt=RED, pants=(0.25, 0.3, 0.5), shoe=(0.95, 0.95, 0.95), torso=False, arms=False)
    kid_head(hair=HAIR)
    # the rocket is one rigid suit round the kid: body, bands, nose, fins, porthole ring, rivets and the flames out of its engine
    with part("body"):
        R = 1.78
        z0, z1 = HIP + 0.3, 4.75
        zc = (z0 + z1) / 2
        cut(can(0, 0, zc, R, z1 - z0, BODY, n=N, rot=(0, 0, math.pi / N)), window())
        fy = -R * math.cos(math.pi / N)
        # red bands round the body and the engine bell at the bottom
        for z in (z0 + 0.12, z1 - 0.12):
            can(0, 0, z, R + 0.05, 0.24, RED, n=N, rot=(0, 0, math.pi / N))
        can(0, 0, z0 - 0.12, R * 0.6, 0.25, SILVER, n=N, r2=R * 0.85, rot=(0, 0, math.pi / N))
        # the nose cone: a tall pointy ogive in two red cones, a yellow tip ball
        can(0, 0, z1 + 0.4, R + 0.03, 0.8, RED, n=N, r2=R * 0.72, rot=(0, 0, math.pi / N))
        can(0, 0, z1 + 1.45, R * 0.72, 1.3, RED, n=N, r2=0.12, rot=(0, 0, math.pi / N))
        ball(0, 0, z1 + 2.12, 0.36, 0.36, 0.36, YEL, seg=8, ring=6)
        # swept fins: one at the back, two at the back corners
        for ang in (20, 90, 160):
            fin(math.radians(ang), R, z0 + 0.05)
        # the face porthole: a fat red ring with rivets, the fringe under its top
        ring = can(0, fy - 0.1 + 0.45, FZ, WR + 0.24, 0.9, RED, n=24, rot=X90)
        cut(ring, window(back=1.0, r=WR - 0.05))
        for k in range(8):
            a = 2 * math.pi * (k + 0.5) / 8
            box((WR + 0.1) * math.cos(a), fy - 0.11, FZ + (WR + 0.1) * math.sin(a), 0.11, 0.06, 0.11, RED_D, rot=(0, -a, 0))
        with part("head"):
            box(0, -HEAD * 0.46 - 0.02, HEAD_Z + HEAD * 0.26, HEAD * 0.66, 0.1, 0.3, HAIR, bevel=0.08)   # the fringe
        # a little blue porthole on the belly
        pz = z0 + 0.42
        can(0, fy, pz, 0.3, 0.12, SILVER, n=14, rot=X90)
        can(0, fy - 0.05, pz, 0.21, 0.08, BLUE, n=14, rot=X90)
        box(-0.07, fy - 0.1, pz + 0.07, 0.08, 0.03, 0.06, WHITE)
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
    with part("body"):
        for s in (-1, 1):
            can(s * (R - 0.02), -0.3, TOP - 0.1, 0.24, 0.14, RED_D, n=10, rot=(0, math.radians(90), 0))  # sleeve holes
    # each stub sleeve flaps with its mitt where it leaves the rocket (an arm tag would swing it inside)
    rh = (R + 0.5, -0.4, TOP + 0.5)  # the right mitt waves
    with part("hand.l"):
        limb((R - 0.05, -0.3, TOP - 0.1), (rh[0] - 0.12, rh[1], rh[2] - 0.2), 0.11, RED)
        hand_mitt(*rh, 1, MITT, SKIN)
    lh = (-R - 0.45, -0.5, TOP + 0.1)  # the left carries the bucket up out of the fire
    with part("hand.r"):
        limb((-R + 0.05, -0.3, TOP - 0.1), (lh[0] + 0.08, lh[1], lh[2] + 0.1), 0.11, RED)
        hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=True, size=0.62)


if __name__ == "__main__" or True:
    render_costume("rocket", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
