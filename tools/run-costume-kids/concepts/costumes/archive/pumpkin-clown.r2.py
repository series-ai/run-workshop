"""Pumpkin clown: a giant ribbed jack-o'-lantern head with a red clown nose,
a grin and a tiny purple party hat, a white-and-purple ruffled collar, a
purple polka-dot suit with orange-striped pants, pom-pom buttons and huge
red clown shoes. Carries the empty bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
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
        ball(s * TW * 0.3, -FOOT * 0.85, FOOT * 0.24, 0.62, 0.62, 0.44, RED, seg=10, ring=6)
    # pants stripes
    for k in (-1, 0, 1):
        box(k * 0.3, fy, HIP + TH * 0.18, 0.1, 0.04, TH * 0.34, PURPLE)
    # polka dots on the suit and pom-pom buttons down the front
    for x, z in ((-0.32, TOP - 0.42), (0.33, TOP - 0.25), (0.3, TOP - 0.6), (-0.3, TOP - 0.15)):
        can(x, fy, z, 0.08, 0.04, ORANGE, n=8, rot=(math.radians(90), 0, 0))
    for k, c in enumerate((ORANGE, LIME, ORANGE)):
        ball(0, fy - 0.04, TOP - 0.22 - k * 0.2, 0.17, 0.17, 0.17, c, seg=6, ring=4)
    # arms: left hangs with a ruffle cuff, right out holding the bucket
    sx = TW * 0.5 + 0.08
    limb((-sx, 0, TOP - 0.15), (-sx - 0.16, -0.05, TOP - ARM_DROP), 0.11, PURPLE)
    can(-sx - 0.17, -0.06, TOP - ARM_DROP - 0.02, 0.2, 0.1, WHITE, n=10)
    hand_mitt(-sx - 0.18, -0.08, TOP - 0.66, -1, MITT, SKIN)
    m = (1.45, -0.2, 1.2)
    limb((sx, 0, TOP - 0.15), (m[0] - 0.15, m[1], m[2] + 0.05), 0.11, PURPLE)
    can(m[0] - 0.2, m[1], m[2] + 0.06, 0.2, 0.1, WHITE, n=10, rot=(0, math.radians(80), 0))
    hand_mitt(*m, 1, MITT, SKIN)
    bucket(m, full=False, size=0.7)
    # the ruffled collar: a ring of puffs, white and purple
    for k in range(12):
        a = 2 * math.pi * k / 12
        ball(0.62 * math.cos(a), 0.55 * math.sin(a), TOP + 0.1, 0.5, 0.5, 0.36, WHITE if k % 2 else LIME, seg=8, ring=5)
    # the pumpkin head: ribbed lobes around a core
    hz = HEAD_Z + 0.02
    ball(0, 0, hz, 2.6, 2.4, 2.2, ORANGE, seg=12, ring=8)
    for k in range(8):
        a = -math.pi / 2 + 2 * math.pi * k / 8
        r = 0.78
        ball(r * math.cos(a), r * math.sin(a), hz, 1.5, 1.5, 2.2 if k % 2 == 0 else 2.1, ORANGE if k % 2 == 0 else ORANGE_D,
             seg=10, ring=8, rot=(0, 0, a))
    # the stem and a curly leaf on top
    can(0.35, 0.1, hz + 1.15, 0.16, 0.5, STEM, n=6, r2=0.11, rot=(0, math.radians(14), 0))
    ball(0.7, 0.05, hz + 1.06, 0.5, 0.3, 0.14, LIME, seg=6, ring=4, rot=(0, math.radians(-15), 0))
    # the tiny clown hat, tilted
    can(-0.45, 0.0, hz + 1.38, 0.38, 0.8, PURPLE, n=8, r2=0.02, rot=(0, math.radians(-14), 0))
    t = math.radians(-14)
    for k, d in enumerate((-0.28, -0.08, 0.12)):
        r = 0.38 - (d + 0.4) / 0.8 * 0.36 + 0.02
        can(-0.45 + math.sin(t) * d, 0.0, hz + 1.38 + math.cos(t) * d, r, 0.07, LIME if k % 2 == 0 else WHITE, n=8, rot=(0, t, 0))
    ball(-0.45 + math.sin(t) * 0.42, 0.0, hz + 1.38 + math.cos(t) * 0.42, 0.28, 0.28, 0.28, ORANGE, seg=8, ring=5)
    # the face, carved on the front lobe
    fr = -0.78 - 0.75

    def front(x):
        return -0.78 - 0.75 * math.sqrt(max(0.0, 1 - (x / 0.75) ** 2)) - 0.02
    for s in (-1, 1):
        ex = s * 0.45
        can(ex, front(ex) + 0.02, hz + 0.3, 0.3, 0.12, INK, n=3, rot=(math.radians(90), 0, 0))
        ball(ex - 0.06, front(ex) - 0.04, hz + 0.33, 0.13, 0.05, 0.13, WHITE, seg=6, ring=4)
        box(s * 0.62, front(0.62) + 0.02, hz + 0.02, 0.24, 0.12, 0.12, (0.98, 0.55, 0.55))
    # the grin: a wide dark crescent with two teeth
    # white clown paint around the mouth, then the grin on it
    ball(0, front(0) + 0.14, hz - 0.36, 1.45, 0.16, 0.62, WHITE, seg=12, ring=6)
    for k in range(9):
        x = -0.56 + k * 0.14
        z = hz - 0.42 + (x * x) * 0.5
        box(x, front(x) - 0.01, z, 0.17, 0.1, 0.13, RED, rot=(0, -math.atan(x), 0))
    # the red clown nose
    ball(0, fr - 0.1, hz - 0.08, 0.42, 0.42, 0.42, RED, seg=10, ring=7)
    ball(-0.07, fr - 0.3, hz, 0.1, 0.04, 0.1, WHITE, seg=6, ring=4)


if __name__ == "__main__" or True:
    run({"pumpkin-clown": build})
