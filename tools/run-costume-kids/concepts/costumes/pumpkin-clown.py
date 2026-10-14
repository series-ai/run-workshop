"""Pumpkin clown: a rounded-cube ribbed jack-o'-lantern head (enclosing the
standard head) with a red clown nose,
a grin and a tiny purple party hat, a white-and-purple ruffled collar, a
purple polka-dot suit with orange-striped pants, pom-pom buttons and huge
red clown shoes. Carries the empty bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

ORANGE, ORANGE_D = (1.0, 0.52, 0.08), (0.90, 0.40, 0.04)
PURPLE, PURPLE_D = (0.55, 0.28, 0.80), (0.42, 0.18, 0.65)
LIME, RED, INK = (0.45, 0.80, 0.25), (0.92, 0.12, 0.15), (0.16, 0.07, 0.04)
STEM = (0.35, 0.55, 0.18)


def build():
    body(shirt=PURPLE, pants=ORANGE, sleeve=PURPLE, leg_colour=PURPLE, shoe=RED, arms=False)
    fy = -TD * 0.5 - 0.02
    # clown shoes: a big round toe bulging out of each shoe
    for s in (-1, 1):
        with part("foot.l" if s > 0 else "foot.r"):
            ball(s * TW * 0.3, -FOOT * 0.85, FOOT * 0.24, 0.62, 0.62, 0.44, RED, seg=10, ring=6)
    # pants stripes
    with part("body"):
        for k in (-1, 0, 1):
            box(k * 0.3, fy, HIP + TH * 0.18, 0.1, 0.04, TH * 0.34, PURPLE)
    # polka dots on the suit and pom-pom buttons down the front (each on the shirt or the pants it sits on)
    for x, z in ((-0.32, TOP - 0.42), (0.33, TOP - 0.25), (0.3, TOP - 0.6), (-0.3, TOP - 0.15)):
        with part("chest" if z > HIP + TH * 0.36 else "body"):
            can(x, fy, z, 0.08, 0.04, ORANGE, n=8, rot=(math.radians(90), 0, 0))
    for k, c in enumerate((ORANGE, LIME, ORANGE)):
        z = TOP - 0.22 - k * 0.2
        with part("chest" if z > HIP + TH * 0.36 else "body"):
            ball(0, fy - 0.04, z, 0.17, 0.17, 0.17, c, seg=6, ring=4)
    # arms: left hangs with a ruffle cuff, right out holding the bucket
    sx = TW * 0.5 + 0.08
    with part("arm.r"):
        limb((-sx, 0, TOP - 0.15), (-sx - 0.16, -0.05, TOP - ARM_DROP), 0.11, PURPLE)
        can(-sx - 0.17, -0.06, TOP - ARM_DROP - 0.02, 0.2, 0.1, WHITE, n=10)
    with part("hand.r"):
        hand_mitt(-sx - 0.18, -0.08, TOP - 0.66, -1, MITT, SKIN)
    m = (1.45, -0.2, 1.2)
    with part("arm.l"):
        limb((sx, 0, TOP - 0.15), (m[0] - 0.15, m[1], m[2] + 0.05), 0.11, PURPLE)
        can(m[0] - 0.2, m[1], m[2] + 0.06, 0.2, 0.1, WHITE, n=10, rot=(0, math.radians(80), 0))
    with part("hand.l"):
        hand_mitt(*m, 1, MITT, SKIN)
    bucket(m, full=False, size=0.7)
    # the ruffled collar: a ring of puffs, white and purple
    for k in range(12):
        a = 2 * math.pi * k / 12
        with part("chest"):
            ball(0.62 * math.cos(a), 0.55 * math.sin(a), TOP + 0.1, 0.5, 0.5, 0.36, WHITE if k % 2 else LIME, seg=8, ring=5)
    with part("head"):  # the pumpkin head, its stem, leaf, hat and face
        # the pumpkin head: a rounded-cube pumpkin that encloses the standard head,
        # ribbed by four tall rounded lobes side by side
        w = HEAD
        hz = HEAD_Z
        box(0, 0, hz + w * 0.01, w * 1.04, w * 0.94, w * 0.9, ORANGE_D, bevel=0.4, segs=2)  # its bottom no lower than the base head's, so waving mitts clear it
        for k in range(4):
            x = -w * 0.39 + k * w * 0.26
            even = k in (0, 3)
            box(x, 0, hz + (w * 0.02 if even else 0.0), w * 0.3, w * (0.98 if even else 1.0), w * (0.9 if even else 0.97), ORANGE if k % 2 == 0 else (1.0, 0.58, 0.12),
                bevel=0.28, segs=2)
        top = hz + w * 0.485
        # the stem and a curly leaf on top
        can(0.3, 0.1, top + 0.2, 0.18, 0.55, STEM, n=6, r2=0.12, rot=(0, math.radians(14), 0))
        ball(0.7, 0.05, top + 0.05, 0.55, 0.32, 0.14, LIME, seg=6, ring=4, rot=(0, math.radians(-15), 0))
        # the tiny clown hat, tilted
        hx, t = -0.55, math.radians(-14)
        can(hx, 0.0, top + 0.38, 0.4, 0.8, PURPLE, n=8, r2=0.02, rot=(0, t, 0))
        for k, d in enumerate((-0.28, -0.08, 0.12)):
            r = 0.4 - (d + 0.4) / 0.8 * 0.38 + 0.02
            can(hx + math.sin(t) * d, 0.0, top + 0.38 + math.cos(t) * d, r, 0.07, LIME if k % 2 == 0 else WHITE, n=8, rot=(0, t, 0))
        ball(hx + math.sin(t) * 0.42, 0.0, top + 0.38 + math.cos(t) * 0.42, 0.3, 0.3, 0.3, ORANGE, seg=8, ring=5)
        # the carved face at the standard face spot
        fy = -w * 0.5 - 0.02
        ez = hz - w * 0.05 + w * 0.05
        for s in (-1, 1):
            ex = s * w * 0.22
            can(ex, fy + 0.02, ez + 0.05, 0.34, 0.12, INK, n=3, rot=(math.radians(90), 0, 0))
            ball(ex - 0.07, fy - 0.04, ez + 0.08, 0.14, 0.05, 0.14, WHITE, seg=6, ring=4)
            box(s * w * 0.33, fy - 0.01, ez - 0.32, 0.3, 0.06, 0.14, (0.98, 0.55, 0.55))
        # white clown paint round the mouth, the red grin on it, and the red nose
        ball(0, fy + 0.02, hz - 0.62, 1.6, 0.16, 0.7, WHITE, seg=12, ring=6)
        for k in range(9):
            x = -0.6 + k * 0.15
            z = hz - 0.7 + (x * x) * 0.5
            box(x, fy - 0.08, z, 0.18, 0.08, 0.14, RED, rot=(0, -math.atan(x), 0))
        ball(0, fy - 0.12, hz - 0.3, 0.48, 0.42, 0.48, RED, seg=10, ring=7)
        ball(-0.08, fy - 0.32, hz - 0.2, 0.11, 0.04, 0.11, WHITE, seg=6, ring=4)


if __name__ == "__main__" or True:
    run({"pumpkin-clown": build})
