"""Cactus: the kid potted in a terracotta flowerpot, the head inside a big
green rounded-cube cactus with dark ribs and cream spines; two huge cactus
arms branch out of its sides and bend up way over the head like a saguaro,
and a big pink flower blooms on top. The kid's standard face looks out of a
big opening in the cactus. Mitts out of the pot, the right one with the
full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

GREEN, GREEN_D, SPINE, PINK, PINK_D, POLLEN = (0.36, 0.74, 0.3), (0.22, 0.55, 0.22), (1.0, 0.96, 0.8), (1.0, 0.5, 0.72), (0.92, 0.32, 0.58), (1.0, 0.86, 0.2)
WIN, HAIR = (0.72, 0.9, 1.0), (0.3, 0.17, 0.09)
POT, POT_D, SOIL = (0.86, 0.45, 0.25), (0.7, 0.33, 0.18), (0.4, 0.26, 0.16)


def cut(obj, cutter):
    """Boolean `cutter` out of `obj` (the cutter is hidden)."""
    m = obj.modifiers.new("cut", "BOOLEAN")
    m.object, m.operation = cutter, "DIFFERENCE"
    cutter.hide_render = True
    return obj


def opening(w=HEAD * 0.86, h=HEAD * 0.78, back=-0.6, front=-3.0, bevel=0.45):
    """A cutter for the face opening round the standard face."""
    return box(0, (back + front) / 2, HEAD_Z - HEAD * 0.06, w, back - front, h, WHITE, bevel=bevel, segs=3)


def spines(x, y, z, axis):
    """A little V pair of spines sticking out along `axis` ('-y', '+x', '-x', '+z')."""
    for s in (-1, 1):
        if axis == "-y":
            can(x + s * 0.05, y - 0.08, z, 0.035, 0.2, SPINE, n=4, r2=0.0, rot=(math.radians(90), 0, s * 0.4))
        elif axis in ("+x", "-x"):
            sg = 1 if axis == "+x" else -1
            can(x + sg * 0.08, y + s * 0.05, z, 0.035, 0.2, SPINE, n=4, r2=0.0, rot=(0, sg * math.radians(90), s * 0.4))
        else:
            can(x + s * 0.05, y, z + 0.08, 0.035, 0.2, SPINE, n=4, r2=0.0, rot=(0, s * 0.4, 0))


def cactus_arm(s, hz, x0, x1, top, t=0.78):
    """A fat cactus arm: out from the side at height hz, then up to `top`."""
    box(s * (x0 + x1) / 2, 0.1, hz, x1 - x0 + 0.3, t, t, GREEN, bevel=0.3, segs=2)
    box(s * x1, 0.1, (hz + top) / 2, t, t, top - hz + t, GREEN, bevel=0.34, segs=2)
    for k in (-1, 1):
        box(s * x1 + k * 0.2, 0.1 - t / 2, (hz + top) / 2 + 0.1, 0.06, 0.04, top - hz, GREEN_D)
    for z in (hz + 0.45, (hz + top) / 2 + 0.25, top - 0.05):
        spines(s * x1, 0.1 - t / 2, z, "-y")
        spines(s * (x1 + t / 2), 0.1, z - 0.15, "+x" if s > 0 else "-x")
    spines(s * (x0 + x1) / 2, 0.1, hz + t / 2, "+z")
    spines(s * x1, 0.1, top + t / 2, "+z")


def build():
    body(shirt=GREEN, pants=GREEN_D, leg_colour=GREEN_D, shoe=(0.55, 0.32, 0.16), arms=False)
    kid_head(hair=HAIR)
    # the whole costume round the head moves as one block on the hips (the face looks out of it)
    with part("body"):
        # the flowerpot round the body: a flared pot, a rim and a little soil
        can(0, 0, 1.08, 1.15, 1.14, POT, n=12, r2=1.42, rot=(0, 0, math.pi / 12))
        can(0, 0, 1.78, 1.6, 0.36, POT_D, n=12, rot=(0, 0, math.pi / 12))
        can(0, 0, 1.97, 1.48, 0.04, SOIL, n=12, rot=(0, 0, math.pi / 12))
        # the cactus round the head, with the face opening
        W, D, z0, z1 = HEAD * 1.2, HEAD * 1.14, 1.45, 5.4
        cact = box(0, 0.1, (z0 + z1) / 2, W, D, z1 - z0, GREEN, bevel=0.8, segs=3)
        cut(cact, opening())
        rim = box(0, -1.25, HEAD_Z - HEAD * 0.06, HEAD * 0.86 + 0.3, 0.6, HEAD * 0.78 + 0.3, GREEN_D, bevel=0.29, segs=3)
        cut(rim, opening(back=0.5))
        box(0, -HEAD * 0.46 - 0.02, HEAD_Z + HEAD * 0.26, HEAD * 0.7, 0.1, 0.3, HAIR, bevel=0.08)   # the fringe
        fy = 0.1 - D / 2
        # ribs and spines over the top and down the front corners
        for x in (-1.25, 1.25):
            box(x, fy + 0.12, (z0 + z1) / 2 + 0.1, 0.07, 0.06, z1 - z0 - 1.5, GREEN_D)
            for z in (2.2, 3.0, 3.8, 4.6):
                spines(x, fy + 0.1, z, "-y")
        for x in (-0.6, 0.0, 0.6):
            spines(x, fy + 0.15, z1 - 0.35, "-y")
            spines(x, 0.1, z1, "+z")
        # huge cactus arms branching out of the sides and bending up over the head
        cactus_arm(-1, 3.2, W / 2 - 0.2, 2.4, 6.1)
        cactus_arm(1, 2.75, W / 2 - 0.2, 2.5, 5.4)
        # a big pink flower on top
        fz = z1 + 0.1
        for k in range(6):
            a = 2 * math.pi * k / 6
            ball(0.5 * math.cos(a), 0.1 + 0.5 * math.sin(a), fz, 0.75, 0.75, 0.34, PINK if k % 2 else PINK_D, seg=8, ring=4, rot=(0, 0, a))
        ball(0, 0.1, fz + 0.12, 0.4, 0.4, 0.28, POLLEN, seg=8, ring=4)
    # mitts out of the pot; the right one holds the bucket (the sleeves are the costume's; the mitts flap at their ends)
    lh = (-1.85, -0.35, 1.1)
    with part("body"):
        limb((-1.1, -0.1, 1.3), lh, 0.12, GREEN)
    with part("hand.r"):
        hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.9, -0.4, 1.2)
    with part("body"):
        limb((1.1, -0.1, 1.35), rh, 0.12, GREEN)
    with part("hand.l"):
        hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.64)


if __name__ == "__main__" or True:
    render_costume("cactus", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
