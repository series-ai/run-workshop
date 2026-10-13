"""Sunflower: the kid's head sits in a big round brown seed-disc hood (dotted
with dark seeds in a spiral) whose wide opening shows the full face, and a
huge ring of sunny yellow petals in two layers radiates out all round it,
cupped a little forward. The body is the stem: a green leafy suit with two
big leaves sprouting from the hips, green sleeves, mitts out, the right one
holding the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

PETAL, PETAL_B, DISC, DISC_D, SEED = (1.0, 0.84, 0.12), (1.0, 0.68, 0.08), (0.55, 0.33, 0.14), (0.42, 0.24, 0.1), (0.25, 0.14, 0.06)
GREEN, GREEN_D, GREEN_L = (0.33, 0.7, 0.28), (0.22, 0.55, 0.22), (0.5, 0.82, 0.36)
X90 = (math.radians(90), 0, 0)
DR = 1.78            # seed disc radius (encloses the standard head)
DY = 0.12            # disc centre y
FZ = HEAD_Z + 0.38   # the flower's centre: a little above the head's, so the disc clears the mitts
FACE_Y = -HEAD * 0.46 - 0.06   # the face sits on the plate, just proud of the disc


def petal(a, rad, length, width, rgb, y, tilt=0.26):
    """A petal in the face plane at angle a (from +x), its middle at radius rad, cupped forward."""
    x, z = rad * math.cos(a), FZ + rad * math.sin(a)
    ball(x, y - math.sin(tilt) * (rad - DR) * 0.5, z, width, 0.22, length, rgb, seg=10, ring=6, rot=(tilt, math.pi / 2 - a, 0))


def leaf(base, tip_dir, length, width, rgb):
    """A big flat leaf from `base`, pointing along tip_dir (in the xz plane), with a midrib."""
    dx, dz = tip_dir
    n = math.hypot(dx, dz)
    dx, dz = dx / n, dz / n
    c = (base[0] + dx * length / 2, base[1], base[2] + dz * length / 2)
    th = math.atan2(dx, dz)
    ball(*c, width, 0.18, length, rgb, seg=10, ring=6, rot=(0, th, 0))
    limb(base, (base[0] + dx * length * 0.85, base[1] - 0.08, base[2] + dz * length * 0.85), 0.04, GREEN_D, n=4)


def build():
    body(shirt=GREEN, pants=GREEN_D, leg_colour=GREEN, shoe=(0.45, 0.28, 0.12))  # green sleeves, mitts out
    # two big leaves sprouting from the hips, tips curling up
    with part("body"):
        for s in (-1, 1):
            leaf((s * 0.4, 0.45, 0.7), (s * 1.0, 0.5), 1.9, 1.0, GREEN_L)
    bucket(hand_points()[1], full=True, size=0.62)
    with part("head"):
        flower_head()


def flower_head():
    # the head (hidden by the hood, the face plate shows in the opening)
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
    # petals: a back layer (deeper yellow) and a front layer, shorter at the bottom
    for layer, (n, off, y, rgb, lmul) in enumerate(((14, 0.5, -0.45, PETAL_B, 1.08), (14, 0.0, -0.7, PETAL, 1.0))):
        for k in range(n):
            a = 2 * math.pi * (k + off) / n + math.pi / 2
            down = max(0.0, -math.sin(a))
            if down > 0.6:
                continue   # leave the bottom open so the stem body and mitts show
            L = (1.75 - 0.75 * down ** 2) * lmul
            petal(a, DR + L * 0.42, L, 0.82, rgb, y)
    # the round seed-disc hood round the head
    fy = DY - HEAD * 0.49
    can(0, fy + 0.35, FZ, DR, 0.7, DISC, n=20, rot=X90)
    # the hood's rounded green back (the flower's calyx)
    ball(0, 0.35, HEAD_Z + 0.2, 3.7, 2.7, 3.6, GREEN, seg=16, ring=10)
    # seeds in a sunflower spiral, round the face opening
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(220):
        rr = 0.12 * math.sqrt(i) * 1.0
        if rr > DR - 0.25:
            break
        a = i * golden
        x, z = rr * math.cos(a), FZ + rr * math.sin(a)
        if abs(x) < 1.22 and abs(z - (HEAD_Z - 0.05)) < 1.08:
            continue
        box(x, fy - 0.1, z, 0.11, 0.05, 0.11, SEED, rot=(0, a, 0))
    # the face opening: a skin face plate wider than the face, with the face on it
    box(0, FACE_Y + 0.06, HEAD_Z - 0.05, 2.3, 0.1, 2.0, SKIN, bevel=0.22, segs=2)
    box(0, FACE_Y + 0.04, HEAD_Z + 0.84, 2.0, 0.08, 0.3, (0.3, 0.17, 0.09), bevel=0.1, segs=2)   # a fringe of hair
    face(0, HEAD_Z - HEAD * 0.05, FACE_Y, HEAD)


if __name__ == "__main__" or True:
    render_costume("sunflower", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
