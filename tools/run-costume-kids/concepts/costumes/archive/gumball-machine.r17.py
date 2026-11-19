"""Gumball machine: no glass. The globe is a giant round ball of packed
opaque rainbow gumballs worn as a huge ball-shaped hat on top of the kid's
standard head (the full face shows below it), with the shiny red lid and
knob on top of the gumball dome. The body is the machine's red base: a
chunky rounded box with a silver coin plate (coin slot and a big turn
crank), a little chute with a flap and a gumball waiting in it, a red
collar under the head. Red sleeves, mitts out, the right one holding the
full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import bpy
import random
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

RED, RED_D, SILVER, SILVER_D, SLOT = (0.92, 0.16, 0.2), (0.72, 0.08, 0.12), (0.82, 0.84, 0.88), (0.6, 0.62, 0.68), (0.12, 0.1, 0.12)
GUMS = [(1.0, 0.25, 0.3), (1.0, 0.85, 0.15), (0.25, 0.6, 1.0), (0.35, 0.85, 0.35), (1.0, 0.55, 0.12), (1.0, 0.55, 0.8),
        (0.65, 0.4, 0.95), (1.0, 1.0, 1.0)]
HAIR = (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)
GR = 1.9                  # gumball-globe radius
GZ = HEAD_Z + 1.42        # globe centre (above the head, a ball-shaped hat)
CORE = (0.0, 0.15, HEAD_Z + 1.6, 1.4)  # a solid filler ball inside, set back off the face
CORE_RGB = (1.0, 0.72, 0.82)


def gumballs(rnd, n=200, size=0.58):
    """One shell of gumballs on the globe's outer surface (the filler ball
    shows through the gaps, nothing hides inside), leaving the face clear.
    Low-poly, then joined into one mesh per colour so the dome is a handful
    of draw calls instead of a hundred-odd objects."""
    rs = GR - size * 0.5 - 0.06
    golden = math.pi * (3 - math.sqrt(5))
    by_colour = {}
    k = 0
    deck = [GUMS[j % len(GUMS)] for j in range(n)]
    rnd.shuffle(deck)  # scattered colours (in spiral order they'd form stripes)
    for i in range(n):  # an even Fibonacci spread over the sphere, lightly jittered
        zz = 1 - 2 * (i + 0.5) / n
        rr = math.sqrt(1 - zz * zz)
        a = i * golden + rnd.uniform(-0.12, 0.12)
        x, y, z = rs * rr * math.cos(a), rs * rr * math.sin(a), GZ + rs * zz
        if z < GZ - rs * 0.9:
            continue  # down in the collar
        if abs(x) < HEAD * 0.5 + 0.2 and abs(y) < HEAD * 0.46 + 0.2 and abs(z - HEAD_Z) < HEAD * 0.45 + 0.2:
            continue  # inside the head
        if y < 0 and abs(x) < HEAD * 0.5 + 0.1 and HEAD_Z - HEAD * 0.45 - 0.1 < z < HEAD_Z + 0.88:
            continue  # in front of the face
        if y < -0.6 and abs(x) < HEAD * 0.5 + 0.1 and z < HEAD_Z + 1.3:
            continue  # high in front: the camera looks down, these would land on the brow
        rgb = deck[k]
        k += 1
        by_colour.setdefault(rgb, []).append(ball(x, y, z, size, size, size, rgb, seg=8, ring=5))
    for c, objs in enumerate(by_colour.values()):  # one mesh per colour
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        objs[0].name = f"gumballs_{c}"
    return k


def build():
    rnd = random.Random(4)
    body(shirt=RED, pants=RED, leg_colour=(0.97, 0.97, 0.97), shoe=RED_D, torso=False, arms=False)
    with part("body"):  # the machine base, coin plate, crank and chute
        # the red base: a chunky rounded box on a flared foot
        z0, z1 = 0.52, 1.55
        box(0, 0, z0 + 0.08, 2.45, 2.15, 0.16, RED_D, bevel=0.06, segs=2)
        box(0, 0, (z0 + z1) / 2 + 0.05, 2.25, 1.95, z1 - z0, RED, bevel=0.28, segs=3)
        fy = -1.95 / 2
        # the coin plate: slot and a big crank
        box(0, fy - 0.03, 1.2, 0.9, 0.08, 0.5, SILVER, bevel=0.06, segs=2)
        box(0, fy - 0.08, 1.33, 0.1, 0.04, 0.18, SLOT)
        can(0, fy - 0.12, 1.12, 0.18, 0.1, SILVER_D, n=12, rot=X90)
        box(0, fy - 0.19, 1.12, 0.46, 0.06, 0.1, SILVER, bevel=0.03)
        # the chute: a silver spout with a dark mouth, a flap and a gumball in it
        box(0, fy - 0.12, 0.8, 0.6, 0.26, 0.34, SILVER, bevel=0.07, segs=2)
        box(0, fy - 0.26, 0.78, 0.42, 0.04, 0.22, SLOT, bevel=0.03)
        ball(0, fy - 0.3, 0.76, 0.22, 0.22, 0.22, GUMS[1], seg=8, ring=6)
        box(0, fy - 0.3, 0.9, 0.46, 0.04, 0.08, SILVER_D, rot=(math.radians(-25), 0, 0))
    # sleeves; the right mitt holds the bucket
    for s in (-1, 1):  # the sleeves are part of the machine; the mitts flap where they leave it
        hand = (s * 1.75, -0.35, 1.05)
        with part("body"):
            limb((s * 1.05, -0.05, 1.35), hand, 0.13, RED)
        with part("hand.l" if s > 0 else "hand.r"):
            hand_mitt(*hand, s, MITT, SKIN)
    bucket((1.75, -0.35, 1.05), full=True, size=0.64)
    with part("head"):  # the globe is a giant ball hat: collar, head, filler, gumballs and lid
        # the collar the globe sits in
        cz = GZ - GR * 0.93
        can(0, 0, cz, 1.05, 0.4, RED, n=16, r2=0.85)
        can(0, 0, cz + 0.22, 0.88, 0.08, SILVER, n=16)
        # the kid's standard head; the gumball globe heaped over it as a giant ball hat
        kid_head(hair=HAIR)
        cx, cy, cz, cr = CORE
        ball(cx, cy, cz, cr * 2, cr * 2, cr * 2, CORE_RGB, seg=16, ring=10)
        gumballs(rnd)
        # the red lid with a knob on top
        tz = GZ + GR * 0.88
        can(0, 0, tz + 0.05, 0.85, 0.36, RED, n=16, r2=1.05)
        ball(0, 0, tz + 0.3, 1.9, 1.9, 0.5, RED, seg=16, ring=8)
        can(0, 0, tz + 0.6, 0.12, 0.3, SILVER_D, n=8)
        ball(0, 0, tz + 0.85, 0.42, 0.42, 0.38, RED_D, seg=10, ring=6)


if __name__ == "__main__" or True:
    render_costume("gumball-machine", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
