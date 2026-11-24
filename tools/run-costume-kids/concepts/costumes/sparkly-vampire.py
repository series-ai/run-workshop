"""Sparkly vampire: a parody of the brooding, glittery modern teen vampire,
played for laughs. Pale glitter face paint over the whole head (a paint
layer, not a different skin) speckled with sparkles, a big swoopy bronze
quiff, heavy brooding brows, a moody flat mouth with two tiny fangs. A dark
jacket with a popped collar over a grey tee, dark jeans, and he holds a shiny
red apple up like the poster. Big four-point glitter-star stickers stuck on his head corners, quiff and jacket.
Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import random
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

PALE, JACKET, JACKET_D, TEE = (0.94, 0.91, 0.97), (0.18, 0.18, 0.24), (0.11, 0.11, 0.15), (0.70, 0.72, 0.78)
JEANS, HAIR, HAIR_L, BROW = (0.20, 0.24, 0.40), (0.55, 0.32, 0.18), (0.70, 0.45, 0.26), (0.32, 0.18, 0.10)
APPLE, LEAF = (0.88, 0.08, 0.14), (0.3, 0.72, 0.3)
SPARK = [(1.0, 1.0, 1.0), (0.70, 0.95, 1.0), (1.0, 0.78, 0.95), (1.0, 0.95, 0.6)]


def star(x, y, z, s, rgb):
    """A four-point sparkle facing the camera."""
    ball(x, y, z, s, 0.06, s * 0.24, rgb, seg=4, ring=2)
    ball(x, y, z, s * 0.24, 0.06, s, rgb, seg=4, ring=2)


def glint(x, y, z, s, rgb):
    """A tiny glitter diamond."""
    ball(x, y, z, s, 0.05, s, rgb, seg=4, ring=2)


def tilt(objs, at, deg):
    """Turn objs about the y axis through `at` (positive leans their tops towards +x)."""
    from mathutils import Matrix
    M = Matrix.Translation(at) @ Matrix.Rotation(math.radians(deg), 4, "Y") @ Matrix.Translation([-v for v in at])
    for o in objs:
        o.matrix_world = M @ o.matrix_world


def build():
    body(shirt=JACKET, pants=JEANS, leg_colour=JEANS, shoe=JACKET_D, arms=False)
    fy = -TD * 0.5 - 0.02
    with part("chest"):  # the tee, lapels and popped collar
        # the open jacket: the grey tee down the middle, lapels and a popped collar
        box(0, fy, HIP + TH * 0.62, TW * 0.4, 0.04, TH * 0.6, TEE)
        for s in (-1, 1):
            box(s * 0.25, fy - 0.03, HIP + TH * 0.7, 0.12, 0.05, TH * 0.5, JACKET_D, rot=(0, s * math.radians(-12), 0))
            box(s * 0.42, -0.1, TOP + 0.1, 0.12, 0.5, 0.4, JACKET_D, bevel=0.03, rot=(0, s * math.radians(-15), 0))
    # right arm: holding up the shiny red apple
    sx = TW * 0.5 + 0.08
    m = (1.1, -0.42, TOP - 0.05)
    with part("arm.l"):
        limb((sx, 0, TOP - 0.15), (m[0] - 0.08, m[1] + 0.12, m[2] - 0.05), 0.11, JACKET)
    with part("hand.l"):
        hand_mitt(*m, 1, MITT, SKIN)
    before = set(bpy.data.objects)
    with part("prop.l"):  # the apple, its shine, stalk and leaf
        ball(m[0], m[1] - 0.15, m[2] + 0.38, 0.5, 0.5, 0.46, APPLE, seg=10, ring=8)
        ball(m[0] - 0.1, m[1] - 0.38, m[2] + 0.48, 0.1, 0.05, 0.14, WHITE, seg=6, ring=4)
        limb((m[0], m[1] - 0.15, m[2] + 0.58), (m[0] + 0.03, m[1] - 0.15, m[2] + 0.72), 0.025, BROW)
        box(m[0] + 0.12, m[1] - 0.15, m[2] + 0.68, 0.18, 0.04, 0.08, LEAF, rot=(0, math.radians(-25), 0))
    tilt(set(bpy.data.objects) - before, m, 80)  # the apple tips out, clear of the head
    # left arm: the bucket
    hx, hy, hz = -1.15, -0.3, TOP - 0.2
    with part("arm.r"):
        limb((-sx, 0, TOP - 0.15), (hx + 0.12, hy, hz + 0.05), 0.11, JACKET)
    with part("hand.r"):
        hand_mitt(hx, hy, hz, -1, MITT, SKIN)
    bucket((hx, hy, hz), full=True, size=0.6)
    with part("head"):  # the head, its paint, hair, face and glitter
        # the head: skin, then a pale glitter paint layer over it
        w = HEAD
        box(0, 0, HEAD_Z, w, w * 0.92, w * 0.9, SKIN, bevel=w * 0.14, segs=2)
        box(0, 0, HEAD_Z, w * 1.015, w * 0.92 * 1.015, w * 0.9 * 1.01, PALE, bevel=w * 0.14, segs=2)
        ffy = -w * 0.92 * 1.015 * 0.5
        # the swoopy brooding hair: a cap, a tall quiff swept up and over to one side, a side fringe
        box(0, w * 0.05, HEAD_Z + w * 0.3, w * 1.05, w * 0.99, w * 0.36, HAIR, bevel=w * 0.14, segs=2)
        # the quiff: a big wave rising from the back, curling up and forward over the brow
        for (x, y, z, sx, sy, sz, rx, ry, c) in ((0.0, 0.35, HEAD_Z + 1.25, 2.3, 1.5, 0.75, -10, 0, HAIR),
                                                 (0.1, -0.35, HEAD_Z + 1.6, 2.0, 1.1, 0.9, -28, -6, HAIR),
                                                 (0.35, -0.85, HEAD_Z + 1.85, 1.5, 0.75, 0.7, -42, -12, HAIR),
                                                 (0.6, -1.2, HEAD_Z + 1.78, 0.9, 0.5, 0.5, -70, -18, HAIR_L)):
            box(x, y, z, sx, sy, sz, c, bevel=min(sx, sy, sz) * 0.4, segs=2, rot=(math.radians(rx), math.radians(ry), 0))
        box(0.75, -1.25, HEAD_Z + 1.3, 0.3, 0.3, 0.6, HAIR_L, bevel=0.1, rot=(0, math.radians(20), 0))  # one moody strand
        for s in (-1, 1):
            box(s * w * 0.51, -0.25, HEAD_Z + 0.2, 0.12, 0.7, 0.75, HAIR, bevel=0.04)  # sideburns
        # brooding face: eyes, heavy angled brows, a moody flat mouth with tiny fangs
        face(0, HEAD_Z - w * 0.05, ffy + 0.01, w, smile=False)
        for s in (-1, 1):
            box(s * 0.55, ffy - 0.04, HEAD_Z + 0.32, 0.55, 0.06, 0.13, BROW, rot=(0, s * math.radians(-16), 0))
        mz = HEAD_Z - 0.45
        box(0, ffy - 0.03, mz, 0.4, 0.04, 0.07, DARK)
        box(0.24, ffy - 0.03, mz - 0.03, 0.12, 0.04, 0.07, DARK, rot=(0, math.radians(30), 0))
        for s in (-1, 1):
            can(s * 0.1, ffy - 0.04, mz - 0.08, 0.05, 0.03, WHITE, n=3, rot=(math.radians(90), 0, math.radians(180)))
        # glitter on the face paint
        rnd = random.Random(3)
        for i in range(26):
            x, z = rnd.uniform(-1.0, 1.0), HEAD_Z + rnd.uniform(-0.95, 0.5)
            if abs(abs(x) - 0.55) < 0.28 and abs(z - HEAD_Z) < 0.28:
                continue
            glint(x, ffy - 0.03, z, rnd.uniform(0.09, 0.16), SPARK[i % 4])
    # big glitter-star stickers stuck on the costume (on the head's corners, the
    # quiff and the jacket), poking past the outline so they still sparkle in
    # silhouette; nothing floats free
    for i, (x, y, z, s) in enumerate(((-1.22, ffy - 0.04, HEAD_Z + 0.75, 0.62), (1.22, ffy - 0.04, HEAD_Z - 0.55, 0.5),
                                      (-1.22, ffy - 0.04, HEAD_Z - 0.95, 0.36), (1.0, -1.0, HEAD_Z + 1.75, 0.42),
                                      (-0.75, -0.75, HEAD_Z + 1.55, 0.36), (0.42, fy - 0.04, HIP + 0.25, 0.3),
                                      (-0.5, fy - 0.04, TOP - 0.2, 0.26))):
        with part("head" if z > TOP else ("chest" if z > HIP + TH * 0.36 else "body")):  # each sticker on what it is stuck to
            star(x, y, z, s * 1.5, SPARK[i % 4])
    with part("chest"):
        for s in (-1, 1):
            glint(s * 0.3, fy - 0.03, HIP + 0.5, 0.1, SPARK[1])


if __name__ == "__main__" or True:
    run({"sparkly-vampire": build})
