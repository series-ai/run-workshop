"""Clown: a cute traditional circus clown. The kid's head bald on top with two
huge curly rainbow hair puffs bursting out the sides, a tiny blue top hat
with a daisy perched on top, a red nose and round red cheeks. A big white
ruffle collar, a baggy yellow jumpsuit with big rainbow polka dots, pom-pom
buttons and wide trouser legs, ruffle cuffs and huge long red shoes. One
mitten holds a red balloon on a string, the other the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

SUIT, SUIT_D = (1.0, 0.86, 0.22), (0.95, 0.72, 0.12)
RED, BLUE, GREEN, ORANGE, PURPLE = (0.95, 0.15, 0.2), (0.22, 0.5, 1.0), (0.3, 0.8, 0.35), (1.0, 0.55, 0.12), (0.62, 0.32, 0.9)
RAINBOW = [RED, ORANGE, (1.0, 0.9, 0.2), GREEN, BLUE, PURPLE]
X90 = (math.radians(90), 0, 0)


def puff(cx, cz, s):
    """A big curly rainbow hair puff on side s: rings of little curls."""
    import random
    rnd = random.Random(3 if s > 0 else 5)
    for i in range(36):
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0.0, 0.95)
        x = cx + s * abs(r * math.cos(a)) * 0.9
        z = cz + r * math.sin(a) * 1.0
        y = rnd.uniform(-0.55, 0.85)
        c = RAINBOW[i % len(RAINBOW)]
        d = rnd.uniform(0.55, 0.8)
        ball(x, y, z, d, d, d, c, seg=8, ring=6)


def build():
    body(shirt=SUIT, pants=SUIT, sleeve=SUIT, leg_colour=SUIT, shoe=RED, legs=False, arms=False, torso=False)
    for s in (-1, 1):
        side = "l" if s > 0 else "r"
        # huge long clown shoes: a big round toe on each shoe
        with part(f"foot.{side}"):
            ball(s * TW * 0.36, -FOOT * 1.3, FOOT * 0.26, 0.74, 1.2, 0.5, RED, seg=10, ring=6)
            ball(s * TW * 0.36 - 0.1, -FOOT * 1.62, FOOT * 0.46, 0.16, 0.08, 0.1, WHITE, seg=6, ring=4)
        # the baggy trouser legs with ruffle hems (the leg stops under the jumpsuit so it never pokes up through it)
        with part(f"leg.{side}"):
            limb((s * TW * 0.24, 0, FOOT * 0.4), (s * TW * 0.24, 0, HIP - 0.1), 0.11, SUIT)
            can(s * TW * 0.26, 0, HIP - 0.2, 0.27, 0.18, SUIT, n=8, r2=0.2)
            can(s * TW * 0.26, 0, FOOT * 0.46, 0.29, 0.08, WHITE, n=8)  # ruffle hem
    # the baggy jumpsuit body with big rainbow polka dots and pom-pom buttons
    with part("body"):
        box(0, 0, HIP + TH * 0.45, TW + 0.3, TD + 0.25, TH * 0.95, SUIT, bevel=0.2, segs=2)
        fy = -(TD + 0.25) * 0.5 - 0.02
        for (x, z), c in zip(((-0.42, HIP + 0.65), (0.4, HIP + 0.3), (0.38, HIP + 0.75), (-0.4, HIP + 0.22), (0.0, HIP + 0.05)), (RED, BLUE, GREEN, PURPLE, ORANGE)):
            can(x, fy, z, 0.13, 0.04, c, n=10, rot=X90)
        for k, c in enumerate((RED, BLUE, GREEN)):
            ball(0, fy - 0.06, TOP - 0.2 - k * 0.24, 0.2, 0.2, 0.2, c, seg=8, ring=5)
    # the big white ruffle collar, a ring of puffs
    with part("chest"):
        for k in range(14):
            a = 2 * math.pi * k / 14
            ball(0.78 * math.cos(a), 0.7 * math.sin(a), TOP + 0.08, 0.6, 0.6, 0.38, WHITE if k % 2 else (0.85, 0.9, 1.0), seg=8, ring=5)
    # standard hanging arms with ruffle cuffs: the right mitt (-x) carries the bucket,
    # the left (+x) holds a red balloon on a string, leaning out away from the head
    hp = hand_points()
    for s in (-1, 1):
        side = "l" if s > 0 else "r"
        sx = s * (TW * 0.5 + 0.12)
        h = hp[s]
        with part(f"arm.{side}"):
            limb((sx, 0, TOP - 0.15), (h[0] - s * 0.04, h[1] + 0.03, h[2] + 0.16), 0.13, SUIT)
            can(h[0] - s * 0.04, h[1] + 0.03, h[2] + 0.2, 0.2, 0.1, WHITE, n=10, rot=(0, s * math.radians(-15), 0))
        with part(f"hand.{side}"):
            hand_mitt(*h, s, MITT, SKIN)
    bucket(hp[-1], full=True, size=0.7)
    lh = hp[1]
    with part("prop.l"):
        bx, by, bz = 3.3, -0.3, 3.15
        tilt = (0, math.radians(28), 0)
        limb((lh[0], lh[1], lh[2] + 0.1), (bx - 0.35, by, bz - 0.62), 0.02, (0.3, 0.3, 0.3))
        ball(bx, by, bz, 1.0, 0.92, 1.2, RED, seg=12, ring=8, rot=tilt)
        can(bx - 0.3, by, bz - 0.58, 0.09, 0.15, RED, n=6, r2=0.04, rot=tilt)
        ball(bx - 0.28, by - 0.38, bz + 0.2, 0.18, 0.08, 0.28, (1.0, 0.7, 0.72), seg=6, ring=4, rot=tilt)
    # the head: bald on top, a red nose and big round red cheeks
    w = HEAD
    with part("head"):
        box(0, 0, HEAD_Z, w, w * 0.92, w * 0.9, SKIN, bevel=w * 0.14, segs=2)
        face(0, HEAD_Z - w * 0.05, -w * 0.46, w, cheeks=False)
        fyh = -w * 0.46
        for s in (-1, 1):
            can(s * w * 0.33, fyh - 0.01, HEAD_Z - w * 0.13, 0.22, 0.04, (1.0, 0.45, 0.5), n=10, rot=X90)
            can(s * w * 0.22, fyh - 0.01, HEAD_Z + 0.42, 0.12, 0.04, BLUE, n=4, rot=X90)  # little diamonds over the eyes
        ball(0, fyh - 0.18, HEAD_Z - 0.1, 0.48, 0.44, 0.46, RED, seg=10, ring=7)
        ball(-0.09, fyh - 0.4, HEAD_Z + 0.0, 0.12, 0.05, 0.12, WHITE, seg=6, ring=4)
        # the huge curly rainbow hair puffs on both sides (and a fringe round the back)
        for s in (-1, 1):
            puff(s * (w * 0.5 + 0.35), HEAD_Z + 0.25, s)
        for k in range(7):
            x = -1.0 + k * 0.33
            ball(x, w * 0.44, HEAD_Z + 0.35, 0.6, 0.5, 0.6, RAINBOW[k % 6], seg=8, ring=6)
        # the tiny top hat perched on the bald top, tipped, with a daisy
        t = (0, math.radians(12), 0)
        hz = HEAD_Z + w * 0.45
        can(0.15, 0.1, hz + 0.05, 0.5, 0.08, BLUE, n=12, rot=t)
        can(0.2, 0.1, hz + 0.35, 0.32, 0.6, BLUE, n=10, rot=t)
        can(0.17, 0.1, hz + 0.16, 0.335, 0.12, RED, n=10, rot=t)
        for k in range(6):
            a = 2 * math.pi * k / 6
            ball(-0.12 + 0.1 * math.cos(a), -0.22, hz + 0.18 + 0.1 * math.sin(a), 0.13, 0.06, 0.13, WHITE, seg=6, ring=4)
        ball(-0.12, -0.25, hz + 0.18, 0.09, 0.06, 0.09, (1.0, 0.9, 0.2), seg=6, ring=4)


if __name__ == "__main__" or True:
    render_costume("clown", build, sys.argv[sys.argv.index("--") + 1], ortho=9.6, target_z=3.0)
