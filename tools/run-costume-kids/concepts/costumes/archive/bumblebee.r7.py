"""Bumblebee: a fat round yellow-and-black striped bee suit (a big striped
ball round the little body), a black headband on the kid's own head with two
long wobbly antennae ending in big fuzzy yellow pom-poms (the silhouette),
two pairs of see-through wings on the back, a black stinger, black sleeves
with yellow cuffs. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts/costumes")
from _kit5 import *  # noqa: F401,F403

YEL, BLK, BLK_L = (1.0, 0.80, 0.10), (0.13, 0.11, 0.12), (0.24, 0.21, 0.22)
WING, HAIR = (0.80, 0.93, 1.0), (0.42, 0.24, 0.10)


def suit():
    """The round striped body: an egg of stacked bands round the torso."""
    zc, hh, R, yc = 0.98, 0.7, 1.08, 0.08

    def r(z):
        t = (z - zc) / hh
        return R * math.sqrt(max(0.0, 1 - t * t)) * 0.92 + 0.12

    cuts = [zc - hh + 0.04, 0.55, 0.8, 1.05, 1.3, 1.55, zc + hh - 0.02]
    cols = [BLK, YEL, BLK, YEL, BLK, YEL]
    for (z0, z1), c in zip(zip(cuts, cuts[1:]), cols):
        prof = [(r(z0 + (z1 - z0) * k / 3), z0 + (z1 - z0) * k / 3) for k in range(4)]
        lathe(prof, c, n=12, at=(0, yc, 0), sy=0.86, rot0=math.pi / 12)
    return zc, r


def build():
    body(shirt=BLK, pants=BLK, leg_colour=BLK, shoe=BLK, torso=False, arms=False)
    zc, r = suit()
    # arms poke out of the round suit: the right hangs, the left carries the bucket
    for s, (sh, hand) in ((1, ((0.92, 0.0, 1.25), (1.22, -0.12, 0.62))), (-1, ((-0.92, 0.0, 1.25), (-1.45, -0.38, 1.12)))):
        bar(sh, hand, 0.13, 0.12, BLK)
        hx, hy, hz = hand
        d = Vector(hand) - Vector(sh)
        c = Vector(hand) - d.normalized() * 0.2
        bar(tuple(c - d.normalized() * 0.06), tuple(c + d.normalized() * 0.06), 0.16, 0.16, YEL, n=8)
        hand_mitt(hx, hy, hz, s, MITT, SKIN)
    bucket((-1.45, -0.38, 1.12), full=True, size=0.6)
    # the stinger, out of the back of the bottom band
    can(0, 1.18, 0.5, 0.3, 0.85, BLK, n=6, r2=0.0, rot=(math.radians(-112), 0, 0))
    # see-through wings: a big upper pair and a small lower pair, on the back
    for s in (-1, 1):
        o = ball(s * 1.25, 0.95, 2.25, 2.5, 0.08, 1.2, WING, seg=12, ring=6, rot=(0, s * math.radians(-28), s * math.radians(-12)))
        glassy(o, 0.6, glow=0.3)
        o = ball(s * 1.0, 0.95, 1.35, 1.6, 0.08, 0.75, WING, seg=12, ring=6, rot=(0, s * math.radians(20), s * math.radians(-12)))
        glassy(o, 0.6, glow=0.3)
    # the kid's own head, a black headband over the top
    kid_head(hair=HAIR)
    top = HEAD_Z + HEAD * 0.48
    box(0, 0.15, top + 0.08, HEAD * 1.0, 0.36, 0.16, BLK, bevel=0.06)
    for s in (-1, 1):
        box(s * HEAD * 0.53, 0.15, HEAD_Z + 0.68, 0.16, 0.36, 1.3, BLK, bevel=0.06)
    # the long wobbly antennae with big pom-poms
    for s in (-1, 1):
        x0 = s * 0.55
        pts = [(x0, 0.15, top + 0.1), (x0 + s * 0.18, 0.1, top + 0.7), (x0 - s * 0.05, 0.05, top + 1.3),
               (x0 + s * 0.12, 0.0, top + 1.9), (x0 + s * 0.5, -0.05, top + 2.35), (x0 + s * 0.95, -0.1, top + 2.4),
               (x0 + s * 1.15, -0.1, top + 2.15)]
        chain(pts, 0.09, 0.07, BLK)
        px, py, pz = pts[-1]
        ball(px + s * 0.12, py, pz + 0.12, 0.78, 0.78, 0.78, YEL, seg=8, ring=6)
        for k in range(8):  # fuzz
            a = 2 * math.pi * k / 8
            ball(px + s * 0.12 + 0.34 * math.cos(a), py - 0.05, pz + 0.12 + 0.34 * math.sin(a), 0.26, 0.26, 0.26, YEL, seg=6, ring=4)


if __name__ == "__main__" or True:
    render_costume("bumblebee", build, out_dir(), ortho=8.5, target_z=3.0)
